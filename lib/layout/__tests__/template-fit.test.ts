import { toLayoutTemplate } from "@/cli/plan/templates"
import { defaultTemplates } from "@/lib/default-templates"
import { pageSizeMm, placePhoto } from "@/lib/layout/geometry"
import { fitTemplate, fitTemplates, solveAssignment } from "@/lib/layout/template-fit"
import type { PhotoSpec } from "@/lib/layout/types"

const templates = defaultTemplates.map(toLayoutTemplate)
const portrait = pageSizeMm("portrait")
const byName = (name: string) => {
  const found = templates.find((template) => template.name === name)
  if (!found) throw new Error(`missing template ${name}`)
  return found
}

/** 4:3 단체 사진 — 피사체가 가로 전체, 세로 40% */
const groupPhoto = (id: string): PhotoSpec => ({
  id,
  width: 4000,
  height: 3000,
  subject: { x: 50, y: 50, w: 100, h: 40 },
})

function permutations(n: number): number[][] {
  if (n === 0) return [[]]
  return permutations(n - 1).flatMap((perm) =>
    Array.from({ length: n }, (_, i) => [...perm.slice(0, i), n - 1, ...perm.slice(i)]),
  )
}

function bruteForce(cost: number[][], orderWeight: number): number {
  let best = Number.POSITIVE_INFINITY
  for (const perm of permutations(cost.length)) {
    // perm[k] = 사진 인덱스 (k번째 셀)
    let total = 0
    for (let k = 0; k < perm.length; k++) {
      total += cost[perm[k]][k]
      for (let j = 0; j < k; j++) if (perm[j] > perm[k]) total += orderWeight
    }
    best = Math.min(best, total)
  }
  return best
}

describe("solveAssignment", () => {
  test("matches brute force for n <= 6", () => {
    let seed = 11
    const rnd = () => {
      seed = (seed * 48271) % 2147483647
      return seed / 2147483647
    }

    for (let n = 1; n <= 6; n++) {
      for (let trial = 0; trial < 10; trial++) {
        const cost = Array.from({ length: n }, () =>
          Array.from({ length: n }, () => (rnd() < 0.15 ? Number.POSITIVE_INFINITY : rnd())),
        )
        const expected = bruteForce(cost, 0.05)
        const solved = solveAssignment(cost, 0.05)
        if (!Number.isFinite(expected)) {
          expect(solved).toBeNull()
        } else {
          expect(solved?.cost).toBeCloseTo(expected, 9)
          expect([...(solved?.cellToPhoto ?? [])].sort()).toEqual(Array.from({ length: n }, (_, i) => i))
        }
      }
    }
  })

  test("keeps reading order when costs tie", () => {
    const cost = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]
    expect(solveAssignment(cost)?.cellToPhoto).toEqual([0, 1, 2])
  })
})

describe("fitTemplate", () => {
  test("picks the 3-row template for wide group photos instead of cutting them", () => {
    const photos = [groupPhoto("a"), groupPhoto("b"), groupPhoto("c")]
    const [best] = fitTemplates(templates, photos, portrait, "portrait")

    expect(best.templateId).toBe(byName("3장 세로형 - 세로 3단 분할").id)
    for (const cell of best.cells) {
      expect(placePhoto(cell, cell.photo).subjectCut).toBe(0)
    }
  })

  test("rejects a 2x2 grid whose cells would cut a group photo", () => {
    const photos = [groupPhoto("a"), groupPhoto("b"), groupPhoto("c"), groupPhoto("d")]
    expect(fitTemplate(byName("4장 세로형 - 2x2 그리드"), photos, portrait)).toBeNull()
  })

  test("falls back to contain instead of cutting when asked", () => {
    const photos = [groupPhoto("a"), groupPhoto("b"), groupPhoto("c"), groupPhoto("d")]
    const fitted = fitTemplate(byName("4장 세로형 - 2x2 그리드"), photos, portrait, { allowContain: true })
    expect(fitted?.metrics.contained).toBe(4)
    expect(fitted?.cells.every((cell) => cell.fit === "contain")).toBe(true)
  })

  test("returns null when the photo count does not match", () => {
    expect(fitTemplate(byName("4장 세로형 - 2x2 그리드"), [groupPhoto("a")], portrait)).toBeNull()
  })

  test("rejects a stacked template when a tall subject cannot fit a wide cell", () => {
    const wide: PhotoSpec = { id: "wide", width: 4000, height: 2000, subject: { x: 50, y: 50, w: 90, h: 60 } }
    const tall: PhotoSpec = { id: "tall", width: 2000, height: 4000, subject: { x: 50, y: 50, w: 60, h: 90 } }
    const template = byName("2장 세로형 - 상하 분할")
    const fitted = fitTemplate(template, [tall, wide], portrait)
    // 상하 분할은 두 셀 모두 가로로 길다 → 세로 사진의 피사체가 잘리므로 불가
    expect(fitted).toBeNull()
  })
})
