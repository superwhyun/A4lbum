import { screenPhotos } from "@/cli/select/screen"
import { hammingDistance } from "@/cli/ingest/quality"
import type { Judgement, ScannedPhoto } from "@/cli/types"

function photo(overrides: Partial<ScannedPhoto> & { id: string }): ScannedPhoto {
  return {
    path: `/photos/${overrides.id}.jpg`,
    fileName: `${overrides.id}.jpg`,
    width: 1600,
    height: 1067,
    bytes: 1000,
    date: "2026.09.01",
    takenAt: "2026-09-01T00:00:00.000Z",
    hash: "0000000000000000",
    quality: { sharpness: 0.5, exposure: 0.8, contrast: 0.4, entropy: 0.6, score: 0.6 },
    ...overrides,
  }
}

function judgement(id: string, overrides: Partial<Judgement> = {}): Judgement {
  return { id, keep: true, score: 0.8, ...overrides }
}

describe("hammingDistance", () => {
  test("is zero for identical hashes", () => {
    expect(hammingDistance("abcd1234abcd1234", "abcd1234abcd1234")).toBe(0)
  })

  test("counts differing bits", () => {
    expect(hammingDistance("0000000000000000", "0000000000000001")).toBe(1)
    expect(hammingDistance("0000000000000000", "000000000000000f")).toBe(4)
  })

  test("treats mismatched lengths as incomparable", () => {
    expect(hammingDistance("abcd", "abcdef")).toBe(Number.MAX_SAFE_INTEGER)
  })
})

describe("screenPhotos", () => {
  test("drops photos the judge rejected", () => {
    const photos = [photo({ id: "a" }), photo({ id: "b", hash: "ffffffffffffffff" })]
    const result = screenPhotos(photos, [judgement("a"), judgement("b", { keep: false, reason: "흐림" })])

    expect(result.kept.map((item) => item.photo.id)).toEqual(["a"])
    expect(result.rejected[0].reason).toContain("흐림")
  })

  test("drops photos below the minimum score", () => {
    const photos = [photo({ id: "a" }), photo({ id: "b", hash: "ffffffffffffffff" })]
    const result = screenPhotos(photos, [judgement("a", { score: 0.9 }), judgement("b", { score: 0.2 })], {
      minScore: 0.5,
    })

    expect(result.kept.map((item) => item.photo.id)).toEqual(["a"])
    expect(result.rejected[0].reason).toContain("점수 미달")
  })

  test("falls back to the quality score when a judgement is missing", () => {
    const photos = [photo({ id: "a", quality: { sharpness: 0.1, exposure: 0.1, contrast: 0.1, entropy: 0.1, score: 0.1 } })]
    const result = screenPhotos(photos, [], { minScore: 0.5 })

    expect(result.kept).toHaveLength(0)
    expect(result.rejected).toHaveLength(1)
  })

  test("keeps only the best of a near-duplicate group", () => {
    const photos = [
      photo({ id: "dup-low", hash: "aaaaaaaaaaaaaaaa", takenAt: "2026-09-01T00:00:00.000Z" }),
      photo({ id: "dup-high", hash: "aaaaaaaaaaaaaaab", takenAt: "2026-09-01T00:01:00.000Z" }),
      photo({ id: "other", hash: "1234567890abcdef", takenAt: "2026-09-01T00:02:00.000Z" }),
    ]
    const result = screenPhotos(
      photos,
      [judgement("dup-low", { score: 0.5 }), judgement("dup-high", { score: 0.95 }), judgement("other")],
      { duplicateDistance: 4 },
    )

    expect(result.kept.map((item) => item.photo.id).sort()).toEqual(["dup-high", "other"])
    expect(result.rejected[0].reason).toContain("유사컷")
  })

  test("keeps near-duplicates when deduplication is turned off", () => {
    const photos = [
      photo({ id: "one", hash: "aaaaaaaaaaaaaaaa" }),
      photo({ id: "two", hash: "aaaaaaaaaaaaaaab" }),
    ]
    const result = screenPhotos(photos, [judgement("one"), judgement("two")], { duplicateDistance: 0 })

    expect(result.kept).toHaveLength(2)
  })

  test("returns photos in shooting order", () => {
    const photos = [
      photo({ id: "late", hash: "1111111111111111", takenAt: "2026-09-03T00:00:00.000Z" }),
      photo({ id: "early", hash: "2222222222222222", takenAt: "2026-09-01T00:00:00.000Z" }),
      photo({ id: "mid", hash: "3333333333333333", takenAt: "2026-09-02T00:00:00.000Z" }),
    ]
    const result = screenPhotos(photos, photos.map((item) => judgement(item.id)))

    expect(result.kept.map((item) => item.photo.id)).toEqual(["early", "mid", "late"])
  })

  test("applies the photo cap by score but restores shooting order", () => {
    const photos = [
      photo({ id: "first", hash: "1111111111111111", takenAt: "2026-09-01T00:00:00.000Z" }),
      photo({ id: "second", hash: "2222222222222222", takenAt: "2026-09-02T00:00:00.000Z" }),
      photo({ id: "third", hash: "3333333333333333", takenAt: "2026-09-03T00:00:00.000Z" }),
    ]
    const result = screenPhotos(
      photos,
      [
        judgement("first", { score: 0.9 }),
        judgement("second", { score: 0.1 }),
        judgement("third", { score: 0.8 }),
      ],
      { minScore: 0, maxPhotos: 2 },
    )

    expect(result.kept.map((item) => item.photo.id)).toEqual(["first", "third"])
    expect(result.rejected.map((item) => item.photo.id)).toEqual(["second"])
  })
})
