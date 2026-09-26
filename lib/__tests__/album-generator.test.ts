import {
  buildAlbum,
  createRng,
  focusLayoutOnSubject,
  generateGridLayout,
  pickTemplate,
  visibleRatio,
  type PhotoSpec,
} from "@/lib/album-generator"
import type { LayoutTemplate, PhotoLayout } from "@/types/album"

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

function makePhotos(count: number): PhotoSpec[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `photo-${i}`,
    width: i % 2 === 0 ? 1600 : 1200,
    height: i % 2 === 0 ? 1067 : 1600,
    date: `2026.09.${String(i + 1).padStart(2, "0")}`,
  }))
}

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

describe("focusLayoutOnSubject", () => {
  const slot: PhotoLayout = { id: "s", x: 0, y: 0, width: 50, height: 50, photoId: "a", photoX: 50, photoY: 50 }

  test("pans horizontally toward a subject on a wide photo", () => {
    const wide: PhotoSpec = { id: "a", width: 3000, height: 2000, subject: { x: 20, y: 50 } }
    const focused = focusLayoutOnSubject(slot, wide, "portrait")
    expect(focused.photoX).toBeLessThan(50)
    expect(focused.photoY).toBe(50)
  })

  test("pans vertically toward a subject on a tall photo", () => {
    const tall: PhotoSpec = { id: "b", width: 2000, height: 3000, subject: { x: 50, y: 15 } }
    const wideSlot: PhotoLayout = { ...slot, id: "s2", photoId: "b", width: 100, height: 25 }
    const focused = focusLayoutOnSubject(wideSlot, tall, "portrait")
    expect(focused.photoY).toBeLessThan(50)
    expect(focused.photoX).toBe(50)
  })

  test("keeps the layout untouched when the subject is unknown", () => {
    const plain: PhotoSpec = { id: "c", width: 3000, height: 2000 }
    expect(focusLayoutOnSubject(slot, plain, "portrait")).toEqual(slot)
  })

  test("never moves the crop window outside the image", () => {
    const wide: PhotoSpec = { id: "d", width: 4000, height: 1000, subject: { x: 0, y: 0 } }
    const focused = focusLayoutOnSubject(slot, wide, "portrait")
    expect(focused.photoX).toBeGreaterThanOrEqual(0)
    expect(focused.photoX).toBeLessThanOrEqual(100)
  })
})

describe("generateGridLayout", () => {
  test("produces one slot per photo", () => {
    const layouts = generateGridLayout(7, "portrait", createRng(1))
    expect(layouts).toHaveLength(7)
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

    const placed = album.pages.flatMap((page) => page.layouts.map((layout) => layout.photoId)).filter(Boolean)
    expect(placed.sort()).toEqual(photos.map((photo) => photo.id).sort())
  })

  test("makes the first page a full-bleed cover with a title", () => {
    const album = buildAlbum({ ...baseInput, photos: makePhotos(5), rng: createRng(7) })
    const [cover] = album.pages

    expect(cover.isCoverPage).toBe(true)
    expect(cover.layouts).toHaveLength(1)
    expect(cover.layouts[0]).toMatchObject({ x: 0, y: 0, width: 100, height: 100 })
    expect(cover.title).toBe("2026.09.01")
  })

  test("is reproducible for the same seed", () => {
    const photos = makePhotos(12)
    const first = buildAlbum({ ...baseInput, photos, rng: createRng(3) })
    const again = buildAlbum({ ...baseInput, photos, rng: createRng(3) })

    expect(JSON.stringify(first)).toBe(JSON.stringify(again))
  })

  test("produces more than one distinct arrangement across seeds", () => {
    const photos = makePhotos(12)
    const shapes = new Set(
      Array.from({ length: 8 }, (_, seed) =>
        JSON.stringify(buildAlbum({ ...baseInput, photos, rng: createRng(seed) })),
      ),
    )

    expect(shapes.size).toBeGreaterThan(1)
  })

  test("respects density when filling pages", () => {
    const photos = makePhotos(16)
    const sparse = buildAlbum({ ...baseInput, photos, density: "sparse", rng: createRng(8) })
    const dense = buildAlbum({ ...baseInput, photos, density: "dense", rng: createRng(8) })

    expect(sparse.pages.length).toBeGreaterThan(dense.pages.length)
  })

  test("applies subject focus only when asked", () => {
    const photos: PhotoSpec[] = [
      { id: "cover", width: 1600, height: 1067 },
      { id: "wide", width: 3000, height: 1000, subject: { x: 10, y: 50 } },
      { id: "plain", width: 1200, height: 1600 },
    ]

    const withoutFocus = buildAlbum({ ...baseInput, photos, rng: createRng(2) })
    const withFocus = buildAlbum({ ...baseInput, photos, rng: createRng(2), focusOnSubject: true })

    const findSlot = (album: typeof withFocus) =>
      album.pages.flatMap((page) => page.layouts).find((layout) => layout.photoId === "wide")

    // 템플릿 슬롯은 photoX를 지정하지 않는다 (렌더 시 50% 기본값)
    expect(findSlot(withoutFocus)?.photoX ?? 50).toBe(50)
    expect(findSlot(withFocus)?.photoX).toBeLessThan(50)
  })

  test("returns an empty album for no photos", () => {
    const album = buildAlbum({ ...baseInput, photos: [], rng: createRng(1) })
    expect(album.pages).toHaveLength(0)
  })
})
