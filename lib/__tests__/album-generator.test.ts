import {
  assignPhotosToTemplate,
  buildAlbum,
  createRng,
  generateGridLayout,
  pickCover,
  pickTemplate,
  planAlbum,
  visibleRatio,
  type PhotoSpec,
} from "@/lib/album-generator"
import { cropWindow, NO_SUBJECT_PADDING, normalizeSubject, pageSizeMm, visibleSubjectFraction } from "@/lib/layout/geometry"
import { defaultTemplates } from "@/lib/default-templates"
import { toLayoutTemplate } from "@/cli/plan/templates"
import type { Album, LayoutTemplate } from "@/types/album"

const templates: LayoutTemplate[] = [
  {
    id: "t2",
    name: "2장 상하",
    photoCount: 2,
    orientation: "portrait",
    layouts: [
      { id: "1", x: 0, y: 0, width: 100, height: 49 },
      { id: "2", x: 0, y: 51, width: 100, height: 49 },
    ],
  },
  {
    id: "t3",
    name: "3장",
    photoCount: 3,
    orientation: "portrait",
    layouts: [
      { id: "1", x: 0, y: 0, width: 100, height: 63 },
      { id: "2", x: 0, y: 67, width: 49, height: 31 },
      { id: "3", x: 51, y: 67, width: 49, height: 31 },
    ],
  },
]

const HOUR = 3_600_000
const BASE = new Date(2026, 8, 1, 9).getTime()

function makePhotos(count: number): PhotoSpec[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `photo-${i}`,
    width: i % 2 === 0 ? 1600 : 1200,
    height: i % 2 === 0 ? 1067 : 1600,
    date: `2026.09.${String(i + 1).padStart(2, "0")}`,
  }))
}

const placedIds = (album: Album) => album.pages.flatMap((page) => page.layouts.map((layout) => layout.photoId)).filter(Boolean)

describe("createRng", () => {
  test("returns the same sequence for the same seed", () => {
    const first = Array.from({ length: 5 }, createRng(99))
    const second = Array.from({ length: 5 }, createRng(99))
    expect(first).toEqual(second)
  })

  test("returns a different sequence for a different seed", () => {
    expect(createRng(1)()).not.toBe(createRng(2)())
  })
})

describe("visibleRatio", () => {
  test("returns 1 when image and frame share the same aspect ratio", () => {
    expect(visibleRatio(1.5, 1.5)).toBe(1)
  })

  test("returns the cropped fraction when ratios differ", () => {
    expect(visibleRatio(3, 1.5)).toBeCloseTo(0.5)
    expect(visibleRatio(1.5, 3)).toBeCloseTo(0.5)
  })
})

describe("generateGridLayout", () => {
  test("produces one centered slot per photo", () => {
    const layouts = generateGridLayout(7, "portrait", createRng(1))
    expect(layouts).toHaveLength(7)
    expect(layouts.every((layout) => layout.photoX === 50 && layout.photoY === 50)).toBe(true)
  })

  test("keeps every slot inside the page", () => {
    const layouts = generateGridLayout(6, "portrait", createRng(2))
    for (const layout of layouts) {
      expect(layout.x + layout.width).toBeLessThanOrEqual(100.01)
      expect(layout.y + layout.height).toBeLessThanOrEqual(100.01)
    }
  })
})

describe("pickTemplate", () => {
  test("only returns templates matching photo count and orientation", () => {
    const picked = pickTemplate(templates, 3, "portrait", createRng(5))
    expect(picked?.id).toBe("t3")
  })

  test("returns null when nothing matches", () => {
    expect(pickTemplate(templates, 3, "landscape", createRng(5))).toBeNull()
  })
})

describe("assignPhotosToTemplate", () => {
  test("fills every slot and never cuts a subject (contain if it must)", () => {
    const group: PhotoSpec = { id: "g", width: 4000, height: 3000, subject: { x: 50, y: 50, w: 100, h: 40 } }
    const tall: PhotoSpec = { id: "t", width: 3000, height: 4000 }
    const layouts = assignPhotosToTemplate(templates[0], [tall, group])
    expect(layouts.map((layout) => layout.photoId).sort()).toEqual(["g", "t"])
    const tallLayout = layouts.find((layout) => layout.photoId === "t")!
    expect(tallLayout.fit).toBe("contain")
  })
})

describe("pickCover", () => {
  const page = pageSizeMm("portrait")

  test("uses a full-bleed cover when a photo fits the page ratio", () => {
    const photos: PhotoSpec[] = [
      { id: "wide", width: 4000, height: 3000, score: 0.9, subject: { x: 50, y: 50, w: 90, h: 50 } },
      { id: "tall", width: 3000, height: 4000, score: 0.7, subject: { x: 50, y: 40, w: 40, h: 40 } },
    ]
    const cover = pickCover(photos, page)
    expect(cover).toMatchObject({ framed: false, photo: { id: "tall" } })
    expect(cover?.placement.subjectCut).toBe(0)
  })

  test("frames the cover at its own ratio when nothing fits full-bleed", () => {
    const photos: PhotoSpec[] = [{ id: "group", width: 4000, height: 3000, subject: { x: 50, y: 50, w: 100, h: 40 } }]
    const cover = pickCover(photos, page)!
    expect(cover.framed).toBe(true)
    const ratio = ((cover.layout.width / 100) * page.width) / ((cover.layout.height / 100) * page.height)
    expect(ratio).toBeCloseTo(4 / 3)
    expect(cover.titlePosition.y).toBeGreaterThan(cover.layout.y + cover.layout.height)
  })

  test("honors a forced cover photo", () => {
    const photos = makePhotos(4)
    expect(pickCover(photos, page, { coverPhotoId: "photo-3" })?.photo.id).toBe("photo-3")
  })
})

describe("buildAlbum", () => {
  const baseInput = {
    templates,
    theme: "classic",
    orientation: "portrait" as const,
    density: "medium" as const,
    idSeed: "test",
  }

  test("places every photo exactly once", () => {
    const photos = makePhotos(9)
    const album = buildAlbum({ ...baseInput, photos, rng: createRng(7) })
    expect(placedIds(album).sort()).toEqual(photos.map((photo) => photo.id).sort())
  })

  test("starts with a cover titled with the earliest date", () => {
    const album = buildAlbum({ ...baseInput, photos: makePhotos(5) })
    const [cover] = album.pages
    expect(cover.isCoverPage).toBe(true)
    expect(cover.layouts).toHaveLength(1)
    expect(cover.title).toBe("2026.09.01")
  })

  test("is reproducible for the same seed", () => {
    const photos = makePhotos(12)
    const first = buildAlbum({ ...baseInput, photos, rng: createRng(3) })
    const again = buildAlbum({ ...baseInput, photos, rng: createRng(3) })
    expect(JSON.stringify(first)).toBe(JSON.stringify(again))
  })

  test("is deterministic without an rng", () => {
    const photos = makePhotos(12)
    expect(JSON.stringify(buildAlbum({ ...baseInput, photos }))).toBe(JSON.stringify(buildAlbum({ ...baseInput, photos })))
  })

  test("produces more than one distinct arrangement across seeds", () => {
    const photos = makePhotos(12)
    const shapes = new Set(
      Array.from({ length: 8 }, (_, seed) =>
        JSON.stringify(
          buildAlbum({ ...baseInput, photos, layoutSource: "both", rng: createRng(seed) }).pages.map((page) =>
            page.layouts.map((layout) => [layout.photoId, layout.x.toFixed(1), layout.y.toFixed(1)]),
          ),
        ),
      ),
    )
    expect(shapes.size).toBeGreaterThan(1)
  })

  test("respects density when filling pages", () => {
    const photos = makePhotos(16)
    const sparse = buildAlbum({ ...baseInput, photos, density: "sparse" })
    const dense = buildAlbum({ ...baseInput, photos, density: "dense" })
    expect(sparse.pages.length).toBeGreaterThan(dense.pages.length)
  })

  test("keeps every subject box inside its crop window", () => {
    const photos: PhotoSpec[] = Array.from({ length: 10 }, (_, i) => ({
      id: `s${i}`,
      width: [4000, 3000, 6000][i % 3],
      height: [3000, 4000, 2000][i % 3],
      subject: { x: 15 + i * 7, y: 30 + (i % 4) * 10, w: 20 + (i % 3) * 25, h: 20 + (i % 2) * 30 },
    }))
    const album = buildAlbum({ ...baseInput, photos, layoutSource: "both" })
    const page = pageSizeMm("portrait")
    const byId = new Map(photos.map((p) => [p.id, p]))

    for (const layout of album.pages.flatMap((p) => p.layouts)) {
      const photo = byId.get(layout.photoId)!
      const frame = ((layout.width / 100) * page.width) / ((layout.height / 100) * page.height)
      const window = cropWindow(photo.width / photo.height, frame, layout.photoX, layout.photoY, layout.fit)
      const rect = normalizeSubject(photo, { padding: NO_SUBJECT_PADDING })
      expect(visibleSubjectFraction(rect, window)).toBeCloseTo(1, 6)
    }
  })

  test("keeps the web's template look when asked for templates", () => {
    // 피사체가 작아 템플릿 셀에 넣어도 잘리지 않는 사진들
    const photos: PhotoSpec[] = Array.from({ length: 5 }, (_, i) => ({
      id: `w${i}`,
      width: 3000,
      height: 2000,
      subject: { x: 50, y: 50, w: 15, h: 15 },
    }))
    const album = buildAlbum({
      ...baseInput,
      templates: defaultTemplates.map(toLayoutTemplate),
      photos,
      layoutSource: "templates",
      grouping: false,
    })
    const body = album.pages.filter((page) => !page.isCoverPage)
    expect(body.length).toBeGreaterThan(0)
    expect(body.every((page) => page.templateId)).toBe(true)
  })

  test("falls back to fitted rows instead of cutting when no template can hold the photos", () => {
    // 피사체 정보가 없으면 가운데 70%를 지킨다 → 세로 템플릿의 좁은 셀에는 가로 사진이 못 들어간다
    const photos: PhotoSpec[] = Array.from({ length: 5 }, (_, i) => ({ id: `w${i}`, width: 3000, height: 2000 }))
    const result = planAlbum({ ...baseInput, photos, layoutSource: "templates", grouping: false })
    expect(result.diagnostics.placements.every((p) => p.subjectCut === 0)).toBe(true)
    expect(result.diagnostics.contained).toEqual([])
  })

  test("returns an empty album for no photos", () => {
    const album = buildAlbum({ ...baseInput, photos: [], rng: createRng(1) })
    expect(album.pages).toHaveLength(0)
  })
})

describe("planAlbum", () => {
  const input = { templates, theme: "classic", orientation: "portrait" as const, idSeed: "plan" }

  test("keeps groups on their own pages and records them", () => {
    const morning = Array.from({ length: 4 }, (_, i) => ({ id: `m${i}`, width: 4000, height: 3000, takenAt: BASE + i * 60_000, timeSource: "exif" as const }))
    const evening = Array.from({ length: 4 }, (_, i) => ({ id: `e${i}`, width: 4000, height: 3000, takenAt: BASE + 9 * HOUR + i * 60_000, timeSource: "exif" as const, location: "서울 마포구" }))
    const result = planAlbum({ ...input, photos: [...morning, ...evening], captions: true, cover: false })

    expect(result.groups.map((g) => g.photoIds.length)).toEqual([4, 4])
    for (const page of result.album.pages) expect(page.groupIds).toHaveLength(1)
    const eveningPage = result.album.pages.find((page) => page.groupIds?.[0] === "g2")!
    expect(eveningPage.caption).toBe("2026.09.01 · 서울 마포구")
  })

  test("marks continued pages of a split group", () => {
    const photos = Array.from({ length: 9 }, (_, i) => ({ id: `c${i}`, width: 4000, height: 3000, takenAt: BASE + i * 60_000, timeSource: "exif" as const }))
    const result = planAlbum({ ...input, photos, cover: false, density: "sparse" })
    expect(result.album.pages[0].continued).toBeUndefined()
    expect(result.album.pages.slice(1).every((page) => page.continued)).toBe(true)
  })

  test("letterboxes an impossible photo instead of cutting it, and reports it", () => {
    // 25:1 파노라마, 피사체가 가로 전체 → 어떤 셀도 12mm 높이를 못 넘는다
    const photos: PhotoSpec[] = [
      ...makePhotos(6),
      { id: "strip", width: 25000, height: 1000, subject: { x: 50, y: 50, w: 100, h: 100 } },
    ]
    const result = planAlbum({ ...input, photos, density: "dense", cover: false })
    expect(result.diagnostics.contained).toEqual(["strip"])
    const layout = result.album.pages.flatMap((page) => page.layouts).find((l) => l.photoId === "strip")!
    expect(layout.fit).toBe("contain")
    expect(placedIds(result.album).sort()).toEqual(photos.map((p) => p.id).sort())
  })

  test("reports per-photo placement diagnostics", () => {
    const photos = makePhotos(6)
    const result = planAlbum({ ...input, photos })
    expect(result.diagnostics.placements.map((p) => p.photoId).sort()).toEqual(photos.map((p) => p.id).sort())
    expect(result.diagnostics.placements.every((p) => p.subjectCut === 0)).toBe(true)
    expect(result.groupingMode).toBe("chronological")
  })
})
