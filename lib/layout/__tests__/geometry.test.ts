import {
  cellRatio,
  cropWindow,
  feasibleRange,
  normalizeSubject,
  NO_SUBJECT_PADDING,
  placePhoto,
  visibleSubjectFraction,
} from "@/lib/layout/geometry"
import type { PhotoSpec } from "@/lib/layout/types"

const noPad = { padding: NO_SUBJECT_PADDING }

/** 셀 비율 c (가로/세로)를 가진 100mm 높이의 셀 */
const cellOf = (ratio: number) => ({ width: 100 * ratio, height: 100 })

describe("normalizeSubject", () => {
  test("converts center + size into clamped edges", () => {
    const photo: PhotoSpec = { id: "a", width: 4000, height: 3000, subject: { x: 50, y: 50, w: 40, h: 20 } }
    expect(normalizeSubject(photo, noPad)).toEqual({ x0: 0.3, x1: 0.7, y0: 0.4, y1: 0.6 })
  })

  test("clamps a box that runs past the image", () => {
    const photo: PhotoSpec = { id: "a", width: 4000, height: 3000, subject: { x: 95, y: 5, w: 30, h: 30 } }
    const rect = normalizeSubject(photo, noPad)
    expect(rect.x1).toBe(1)
    expect(rect.y0).toBe(0)
    expect(rect.x0).toBeCloseTo(0.8)
    expect(rect.y1).toBeCloseTo(0.2)
  })

  test("adds more headroom above than below", () => {
    const photo: PhotoSpec = { id: "a", width: 4000, height: 3000, subject: { x: 50, y: 50, w: 20, h: 20 } }
    const rect = normalizeSubject(photo)
    expect(0.4 - rect.y0).toBeCloseTo(0.04)
    expect(rect.y1 - 0.6).toBeCloseTo(0.02)
    expect(0.4 - rect.x0).toBeCloseTo(0.02)
  })

  test("uses a centered safe box when there is no subject", () => {
    const rect = normalizeSubject({ id: "a", width: 100, height: 100 })
    expect(rect.x0).toBeCloseTo(0.15)
    expect(rect.x1).toBeCloseTo(0.85)
  })

  test("allows any crop when the default box is disabled", () => {
    const range = feasibleRange({ id: "a", width: 3000, height: 2000 }, { defaultBox: null })
    expect(range.lo).toBeLessThan(0.5)
    expect(range.hi).toBeGreaterThan(5)
  })

  test("keeps a center-only subject inside its safe box", () => {
    const rect = normalizeSubject({ id: "a", width: 100, height: 100, subject: { x: 5, y: 50 } })
    expect(rect.x0).toBe(0)
    expect(rect.x1).toBeCloseTo(0.7)
  })
})

describe("feasibleRange", () => {
  test("is [r·sw, r/sh] and always contains the photo's own ratio", () => {
    const photo: PhotoSpec = { id: "g", width: 4000, height: 3000, subject: { x: 50, y: 50, w: 100, h: 40 } }
    const range = feasibleRange(photo, noPad)
    expect(range.lo).toBeCloseTo(4 / 3)
    expect(range.hi).toBeCloseTo(4 / 3 / 0.4)
    expect(range.preferred).toBeCloseTo(4 / 3)
  })

  test("collapses to the image ratio when the subject is the whole frame", () => {
    const photo: PhotoSpec = { id: "g", width: 3000, height: 2000, subject: { x: 50, y: 50, w: 100, h: 100 } }
    const range = feasibleRange(photo, noPad)
    expect(range.lo).toBeCloseTo(1.5)
    expect(range.hi).toBeCloseTo(1.5)
  })
})

describe("placePhoto", () => {
  const randomPhotos = (count: number): PhotoSpec[] => {
    let seed = 7
    const rnd = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    return Array.from({ length: count }, (_, i) => {
      const w = 5 + rnd() * 90
      const h = 5 + rnd() * 90
      return {
        id: `p${i}`,
        width: 1000 + Math.round(rnd() * 3000),
        height: 1000 + Math.round(rnd() * 3000),
        subject: { x: w / 2 + rnd() * (100 - w), y: h / 2 + rnd() * (100 - h), w, h },
      }
    })
  }

  test("keeps the whole padded box inside the window whenever the cell ratio is feasible", () => {
    for (const photo of randomPhotos(200)) {
      const range = feasibleRange(photo)
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const ratio = range.lo * (range.hi / range.lo) ** t
        const placement = placePhoto(cellOf(ratio), photo)
        expect(placement.subjectCut).toBe(0)
        expect(placement.photoX).toBeGreaterThanOrEqual(0)
        expect(placement.photoX).toBeLessThanOrEqual(100)
        expect(placement.photoY).toBeGreaterThanOrEqual(0)
        expect(placement.photoY).toBeLessThanOrEqual(100)
      }
    }
  })

  test("pans all the way to the edge (photoX = 0) for a subject at the left edge", () => {
    const photo: PhotoSpec = { id: "w", width: 3000, height: 1000, subject: { x: 5, y: 50, w: 10, h: 40 } }
    const placement = placePhoto(cellOf(1), photo, noPad)
    expect(placement.photoX).toBe(0)
    expect(placement.photoY).toBe(50)
    expect(placement.subjectCut).toBe(0)
  })

  test("pans vertically and leaves headroom above the subject", () => {
    const photo: PhotoSpec = { id: "t", width: 2000, height: 3000, subject: { x: 50, y: 20, w: 30, h: 10 } }
    const placement = placePhoto(cellOf(2), photo, noPad)
    expect(placement.photoX).toBe(50)
    expect(placement.photoY).toBeLessThan(50)
    const window = cropWindow(2 / 3, 2, placement.photoX, placement.photoY)
    const center = (0.2 - window.y0) / (window.y1 - window.y0)
    expect(center).toBeCloseTo(0.42)
  })

  test("reports the cut fraction when the cell is outside the feasible range", () => {
    const photo: PhotoSpec = { id: "g", width: 4000, height: 3000, subject: { x: 50, y: 50, w: 100, h: 40 } }
    const placement = placePhoto(cellOf(0.7), photo, noPad)
    expect(placement.subjectCut).toBeGreaterThan(0.3)
  })

  test("contain never cuts", () => {
    const photo: PhotoSpec = { id: "g", width: 4000, height: 1000, subject: { x: 50, y: 50, w: 100, h: 100 } }
    expect(placePhoto(cellOf(0.5), photo, { fit: "contain" })).toMatchObject({ fit: "contain", subjectCut: 0 })
  })
})

describe("cellRatio and visibleSubjectFraction", () => {
  test("uses mm, not percent, for the cell ratio", () => {
    expect(cellRatio({ width: 50, height: 50 }, { width: 210, height: 297 })).toBeCloseTo(210 / 297)
  })

  test("measures how much of a rectangle survives a crop", () => {
    const fraction = visibleSubjectFraction({ x0: 0, x1: 0.5, y0: 0, y1: 1 }, { x0: 0.25, x1: 1, y0: 0, y1: 1 })
    expect(fraction).toBeCloseTo(0.5)
  })
})
