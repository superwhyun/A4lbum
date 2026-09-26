import { scoreAlbum, type ScoringPhoto } from "@/cli/plan/score"
import type { Album, AlbumPage } from "@/types/album"

function album(pages: AlbumPage[]): Album {
  return { id: "album", pages, theme: "classic", orientation: "portrait", showMetadata: true }
}

const squarePhoto: ScoringPhoto = { id: "sq", width: 1000, height: 1000, score: 0.8 }

describe("scoreAlbum", () => {
  test("rewards a page that fills the sheet over one that leaves holes", () => {
    const full = album([
      { id: "p", layouts: [{ id: "l", x: 0, y: 0, width: 100, height: 100, photoId: "sq" }] },
    ])
    const sparse = album([
      { id: "p", layouts: [{ id: "l", x: 0, y: 0, width: 40, height: 40, photoId: "sq" }] },
    ])

    expect(scoreAlbum(full, [squarePhoto]).coverage).toBeGreaterThan(scoreAlbum(sparse, [squarePhoto]).coverage)
  })

  test("penalizes frames that crop the photo hard", () => {
    const wide: ScoringPhoto = { id: "w", width: 3000, height: 1000, score: 0.8 }
    const matching = album([
      { id: "p", layouts: [{ id: "l", x: 0, y: 0, width: 100, height: 23.6, photoId: "w" }] },
    ])
    const cropping = album([
      { id: "p", layouts: [{ id: "l", x: 0, y: 0, width: 30, height: 100, photoId: "w" }] },
    ])

    expect(scoreAlbum(matching, [wide]).framing).toBeGreaterThan(scoreAlbum(cropping, [wide]).framing)
  })

  test("penalizes a crop that pushes the subject out of frame", () => {
    const wide: ScoringPhoto = { id: "w", width: 3000, height: 1000, score: 0.8, subject: { x: 5, y: 50 } }
    const page = (photoX: number): Album =>
      album([{ id: "p", layouts: [{ id: "l", x: 0, y: 0, width: 50, height: 50, photoId: "w", photoX, photoY: 50 }] }])

    // 피사체가 왼쪽 끝에 있으므로 왼쪽으로 팬한 쪽이 안전하다
    expect(scoreAlbum(page(0), [wide]).subjectSafety).toBeGreaterThan(scoreAlbum(page(100), [wide]).subjectSafety)
  })

  test("treats a photo without a subject as safe", () => {
    const single = album([
      { id: "p", layouts: [{ id: "l", x: 0, y: 0, width: 100, height: 100, photoId: "sq" }] },
    ])
    expect(scoreAlbum(single, [squarePhoto]).subjectSafety).toBe(1)
  })

  test("rewards chronological order", () => {
    const photos: ScoringPhoto[] = [
      { id: "a", width: 1000, height: 1000, score: 0.8, takenAt: "2026-09-01T00:00:00.000Z" },
      { id: "b", width: 1000, height: 1000, score: 0.8, takenAt: "2026-09-02T00:00:00.000Z" },
      { id: "c", width: 1000, height: 1000, score: 0.8, takenAt: "2026-09-03T00:00:00.000Z" },
    ]
    const layoutsFor = (ids: string[]): AlbumPage => ({
      id: "p",
      layouts: ids.map((photoId, i) => ({ id: `l${i}`, x: 0, y: i * 33, width: 100, height: 32, photoId })),
    })

    expect(scoreAlbum(album([layoutsFor(["a", "b", "c"])]), photos).chronology).toBe(1)
    expect(scoreAlbum(album([layoutsFor(["c", "a", "b"])]), photos).chronology).toBeLessThan(1)
  })

  test("rewards an even number of photos per page", () => {
    const photos: ScoringPhoto[] = Array.from({ length: 6 }, (_, i) => ({
      id: `p${i}`,
      width: 1000,
      height: 1000,
      score: 0.8,
    }))
    const slot = (photoId: string, i: number) => ({ id: `l${i}`, x: 0, y: i * 30, width: 100, height: 29, photoId })

    const even = album([
      { id: "a", layouts: [slot("p0", 0), slot("p1", 1), slot("p2", 2)] },
      { id: "b", layouts: [slot("p3", 0), slot("p4", 1), slot("p5", 2)] },
    ])
    const lopsided = album([
      { id: "a", layouts: [slot("p0", 0), slot("p1", 1), slot("p2", 2)] },
      { id: "b", layouts: [slot("p3", 0)] },
      { id: "c", layouts: [slot("p4", 0)] },
      { id: "d", layouts: [slot("p5", 0)] },
    ])

    expect(scoreAlbum(even, photos).balance).toBeGreaterThan(scoreAlbum(lopsided, photos).balance)
  })

  test("ignores layouts whose photo is missing", () => {
    const page = album([
      {
        id: "p",
        layouts: [
          { id: "l1", x: 0, y: 0, width: 100, height: 50, photoId: "sq" },
          { id: "l2", x: 0, y: 50, width: 100, height: 50, photoId: "gone" },
        ],
      },
    ])

    expect(scoreAlbum(page, [squarePhoto]).total).toBeGreaterThan(0)
  })

  test("keeps the total within 0-1", () => {
    const page = album([
      { id: "p", layouts: [{ id: "l", x: 0, y: 0, width: 100, height: 100, photoId: "sq" }] },
    ])
    const { total } = scoreAlbum(page, [{ ...squarePhoto, score: 1 }])

    expect(total).toBeGreaterThan(0)
    expect(total).toBeLessThanOrEqual(1)
  })
})
