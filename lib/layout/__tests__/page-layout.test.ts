import { toLayoutTemplate } from "@/cli/plan/templates"
import { defaultTemplates } from "@/lib/default-templates"
import { feasibleRange, isRatioFeasible, placePhoto } from "@/lib/layout/geometry"
import { contentBox, enumerateStructures, layoutPage, solveStructure } from "@/lib/layout/page-layout"
import type { SolvedPage } from "@/lib/layout/page-cost"
import type { PhotoSpec } from "@/lib/layout/types"

const TOLERANCE = 1e-6

function makeRandom(seed: number) {
  let state = seed
  return () => {
    state = (state * 48271) % 2147483647
    return state / 2147483647
  }
}

const SHAPES = [
  [4000, 3000],
  [3000, 4000],
  [1920, 1080],
  [1080, 2340],
  [3000, 3000],
  [6000, 1500],
] as const

function randomPhotos(count: number, rnd: () => number): PhotoSpec[] {
  return Array.from({ length: count }, (_, i) => {
    const [width, height] = SHAPES[Math.floor(rnd() * SHAPES.length)]
    const hasSubject = rnd() < 0.8
    const w = 10 + rnd() * 80
    const h = 10 + rnd() * 80
    return {
      id: `p${i}`,
      width,
      height,
      subject: hasSubject ? { x: w / 2 + rnd() * (100 - w), y: h / 2 + rnd() * (100 - h), w, h } : undefined,
    }
  })
}

function assertPageProperties(page: SolvedPage, photos: PhotoSpec[], orientation: "portrait" | "landscape") {
  const box = contentBox(orientation)
  const left = box.margin
  const top = box.margin
  const right = box.page.width - box.margin
  const bottom = box.page.height - box.margin

  // 입력 순서 = 셀 순서
  expect(page.cells.map((cell) => cell.photo.id)).toEqual(photos.map((photo) => photo.id))

  for (const cell of page.cells) {
    // 콘텐츠 영역 안
    expect(cell.x).toBeGreaterThanOrEqual(left - TOLERANCE)
    expect(cell.y).toBeGreaterThanOrEqual(top - TOLERANCE)
    expect(cell.x + cell.width).toBeLessThanOrEqual(right + TOLERANCE)
    expect(cell.y + cell.height).toBeLessThanOrEqual(bottom + TOLERANCE)
    // 셀 비율이 허용 범위 안 → 피사체 잘림 0
    expect(isRatioFeasible(feasibleRange(cell.photo), cell.width / cell.height)).toBe(true)
    expect(placePhoto(cell, cell.photo).subjectCut).toBe(0)
  }

  // 겹치지 않음
  for (let i = 0; i < page.cells.length; i++) {
    for (let j = i + 1; j < page.cells.length; j++) {
      const a = page.cells[i]
      const b = page.cells[j]
      const overlapW = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
      const overlapH = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
      expect(overlapW <= TOLERANCE || overlapH <= TOLERANCE).toBe(true)
    }
  }
}

/** 구조의 읽기 순서(행: 위→아래, 왼→오른 / 열: 왼→오른, 위→아래)가 셀 순서와 같은지 */
function assertReadingOrder(page: SolvedPage) {
  const [kind] = page.label.split(":")
  const major = (cell: SolvedPage["cells"][number]) => (kind === "cols" ? cell.x : cell.y)
  const minor = (cell: SolvedPage["cells"][number]) => (kind === "cols" ? cell.y : cell.x)
  for (let i = 1; i < page.cells.length; i++) {
    const prev = page.cells[i - 1]
    const cell = page.cells[i]
    const sameLine = Math.abs(major(prev) - major(cell)) < TOLERANCE
    if (sameLine) expect(minor(cell)).toBeGreaterThan(minor(prev))
    else expect(major(cell)).toBeGreaterThan(major(prev))
  }
}

describe("enumerateStructures", () => {
  test("covers every row split and prunes over-long rows", () => {
    const structures = enumerateStructures(5, "portrait")
    const rows = structures.filter((s) => s.kind === "rows")
    // 2^4 = 16 가지 중 한 행 5장만 제외
    expect(rows).toHaveLength(15)
    expect(rows.every((s) => Math.max(...s.sizes) <= 4)).toBe(true)
    expect(structures.every((s) => s.sizes.reduce((a, b) => a + b, 0) === 5)).toBe(true)
  })

  test("returns one structure for a single photo", () => {
    expect(enumerateStructures(1, "portrait")).toEqual([{ kind: "rows", sizes: [1] }])
  })
})

describe("solveStructure / layoutPage properties", () => {
  for (const orientation of ["portrait", "landscape"] as const) {
    test(`n = 1..9 on ${orientation}: inside the box, in order, never cutting the subject`, () => {
      const rnd = makeRandom(orientation === "portrait" ? 3 : 5)
      for (let n = 1; n <= 9; n++) {
        for (let trial = 0; trial < 4; trial++) {
          const photos = randomPhotos(n, rnd)
          const pages = layoutPage(photos, contentBox(orientation), { orientation, layoutSource: "procedural", topK: 20 })
          expect(pages.length).toBeGreaterThan(0)
          for (const page of pages) {
            assertPageProperties(page, photos, orientation)
            assertReadingOrder(page)
          }
        }
      }
    })
  }

  test("fills the content box with no page margins when the ranges allow it", () => {
    // 피사체가 작아 허용 범위가 넓은 사진들
    const photos: PhotoSpec[] = Array.from({ length: 4 }, (_, i) => ({
      id: `p${i}`,
      width: 3000,
      height: 2000,
      subject: { x: 50, y: 50, w: 10, h: 10 },
    }))
    const box = contentBox("portrait")
    // (한 행에 4장([4])은 콘텐츠 높이를 채우려면 셀 비율이 lo 아래로 내려가야 해서 제외)
    for (const sizes of [[2, 2], [1, 3], [1, 1, 2], [1, 1, 1, 1]]) {
      const page = solveStructure({ kind: "rows", sizes }, photos, box)
      expect(page).not.toBeNull()
      const cells = page!.cells
      expect(Math.min(...cells.map((c) => c.x))).toBeCloseTo(box.margin, 6)
      expect(Math.min(...cells.map((c) => c.y))).toBeCloseTo(box.margin, 6)
      expect(Math.max(...cells.map((c) => c.x + c.width))).toBeCloseTo(box.page.width - box.margin, 6)
      expect(Math.max(...cells.map((c) => c.y + c.height))).toBeCloseTo(box.page.height - box.margin, 6)
    }
  })

  test("gives a wide group photo its own wide row next to portraits", () => {
    const photos: PhotoSpec[] = [
      { id: "tall1", width: 3000, height: 4000, subject: { x: 50, y: 40, w: 50, h: 50 } },
      { id: "tall2", width: 3000, height: 4000, subject: { x: 50, y: 40, w: 50, h: 50 } },
      { id: "group", width: 4000, height: 3000, subject: { x: 50, y: 50, w: 100, h: 40 } },
    ]
    const [best] = layoutPage(photos, contentBox("portrait"), { orientation: "portrait", layoutSource: "procedural" })
    const group = best.cells.find((cell) => cell.photo.id === "group")!
    expect(group.width / group.height).toBeGreaterThanOrEqual(4 / 3 - TOLERANCE)
    expect(placePhoto(group, group.photo).subjectCut).toBe(0)
  })

  test("puts a panorama in a full-width row", () => {
    const pano: PhotoSpec = { id: "pano", width: 8000, height: 2000, subject: { x: 50, y: 50, w: 100, h: 60 } }
    const [best] = layoutPage([pano], contentBox("portrait"), { orientation: "portrait", layoutSource: "procedural" })
    const [cell] = best.cells
    expect(cell.width).toBeCloseTo(contentBox("portrait").page.width - 16, 6)
    expect(cell.width / cell.height).toBeCloseTo(4, 6)
  })

  test("mixes template candidates in when asked", () => {
    const templates = defaultTemplates.map(toLayoutTemplate)
    const photos = randomPhotos(3, makeRandom(9)).map((photo) => ({ ...photo, subject: { x: 50, y: 50, w: 10, h: 10 } }))
    const pages = layoutPage(photos, contentBox("portrait"), {
      orientation: "portrait",
      layoutSource: "templates",
      templates,
      topK: 10,
    })
    expect(pages.length).toBeGreaterThan(0)
    expect(pages.every((page) => page.source === "template")).toBe(true)
  })
})
