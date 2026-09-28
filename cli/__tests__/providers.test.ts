import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileProvider, heuristicProvider } from "@/cli/select/providers"
import type { ScannedPhoto } from "@/cli/types"

function photo(id: string, score: number): ScannedPhoto {
  return {
    id,
    path: `/photos/${id}.jpg`,
    fileName: `${id}.jpg`,
    width: 1600,
    height: 1067,
    bytes: 1000,
    hash: "0000000000000000",
    quality: { sharpness: score, exposure: score, contrast: score, entropy: score, score },
  }
}

async function writeJudgements(contents: unknown): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "a4lbum-test-"))
  const filePath = join(dir, "scores.json")
  await writeFile(filePath, JSON.stringify(contents), "utf8")
  return filePath
}

describe("heuristicProvider", () => {
  test("keeps photos at or above the threshold", async () => {
    const judgements = await heuristicProvider(0.5).judge([photo("good", 0.7), photo("bad", 0.2)])

    expect(judgements.find((item) => item.id === "good")?.keep).toBe(true)
    expect(judgements.find((item) => item.id === "bad")?.keep).toBe(false)
  })
})

describe("fileProvider", () => {
  test("reads the documented { judgements: [...] } shape", async () => {
    const filePath = await writeJudgements({
      judgements: [{ id: "a", keep: true, score: 0.9, subject: { x: 30, y: 40 } }],
    })

    const [judgement] = await fileProvider(filePath).judge([photo("a", 0.5)])
    expect(judgement).toMatchObject({ id: "a", keep: true, score: 0.9, subject: { x: 30, y: 40 } })
  })

  test("also accepts a bare array", async () => {
    const filePath = await writeJudgements([{ id: "a", keep: false, score: 0.1 }])
    const [judgement] = await fileProvider(filePath).judge([photo("a", 0.5)])

    expect(judgement.keep).toBe(false)
  })

  test("clamps out-of-range scores and subject coordinates", async () => {
    const filePath = await writeJudgements({
      judgements: [{ id: "a", keep: true, score: 42, subject: { x: -10, y: 900 } }],
    })

    const [judgement] = await fileProvider(filePath).judge([photo("a", 0.5)])
    expect(judgement.score).toBe(1)
    expect(judgement.subject).toEqual({ x: 0, y: 100 })
  })

  test("trims a subject box that runs past the image into valid edges", async () => {
    const filePath = await writeJudgements({
      judgements: [{ id: "a", keep: true, score: 0.8, subject: { x: 95, y: 10, w: 30, h: 40 } }],
    })

    const [judgement] = await fileProvider(filePath).judge([photo("a", 0.5)])
    // x: 80..110 → 80..100, y: -10..30 → 0..30
    expect(judgement.subject).toEqual({ x: 90, w: 20, y: 15, h: 30 })
  })

  test("defaults keep to true when the field is absent", async () => {
    const filePath = await writeJudgements({ judgements: [{ id: "a", score: 0.6 }] })
    const [judgement] = await fileProvider(filePath).judge([photo("a", 0.5)])

    expect(judgement.keep).toBe(true)
  })

  test("rejects entries without an id", async () => {
    const filePath = await writeJudgements({ judgements: [{ keep: true, score: 0.6 }] })

    await expect(fileProvider(filePath).judge([photo("a", 0.5)])).rejects.toThrow("id")
  })

  test("rejects a file that is not a judgement list", async () => {
    const filePath = await writeJudgements({ nope: true })

    await expect(fileProvider(filePath).judge([photo("a", 0.5)])).rejects.toThrow("형식")
  })
})
