// 앨범 페이지 구성 로직 (브라우저 API 비의존 — 웹과 CLI가 공유)
import type { Album, AlbumDensity, AlbumPage, LayoutTemplate, PhotoLayout } from "@/types/album"
import { A4_SIZE } from "@/types/album"

/** 레이아웃 계산에 필요한 사진 정보의 최소 형태 */
export interface PhotoSpec {
  id: string
  width: number
  height: number
  date?: string
  /** 피사체(얼굴 등) 중심 좌표. 원본 이미지 크기 대비 0-100% */
  subject?: { x: number; y: number }
}

export type Rng = () => number

export interface BuildAlbumInput {
  photos: readonly PhotoSpec[]
  templates: readonly LayoutTemplate[]
  theme: string
  orientation: "portrait" | "landscape"
  density?: AlbumDensity
  /** 피사체 중심으로 프레임 내 사진 위치를 보정할지 여부 */
  focusOnSubject?: boolean
  rng?: Rng
  /** 페이지/앨범 id 접두어. 지정하지 않으면 Date.now() 사용 */
  idSeed?: string
}

interface DensityRange {
  min: number
  max: number
}

const DENSITY_RANGES: Record<AlbumDensity, DensityRange> = {
  sparse: { min: 1, max: 2 },
  medium: { min: 3, max: 5 },
  dense: { min: 5, max: 8 },
}

const DEFAULT_DENSITY_RANGE: DensityRange = { min: 2, max: 4 }

const GRID_GAP = 2
const CENTER_PERCENT = 50
const JITTER_PERCENT = 20

/** 결정론적 난수 생성기 (mulberry32) — 같은 seed면 같은 앨범이 재현된다 */
export function createRng(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A4 페이지의 mm 크기 */
export function pageSizeMm(orientation: "portrait" | "landscape"): { width: number; height: number } {
  return orientation === "portrait"
    ? { width: A4_SIZE.WIDTH, height: A4_SIZE.HEIGHT }
    : { width: A4_SIZE.HEIGHT, height: A4_SIZE.WIDTH }
}

/** 템플릿이 없을 때 쓰는 격자 폴백 레이아웃 */
export function generateGridLayout(
  photoCount: number,
  orientation: "portrait" | "landscape",
  rng: Rng,
): Omit<PhotoLayout, "photoId">[] {
  if (photoCount === 3) {
    return [
      { id: "layout-0", x: 0, y: 0, width: 100, height: 65, photoX: 50, photoY: 50 },
      { id: "layout-1", x: 0, y: 67, width: 49, height: 31, photoX: 50, photoY: 50 },
      { id: "layout-2", x: 51, y: 67, width: 49, height: 31, photoX: 50, photoY: 50 },
    ]
  }

  if (photoCount === 5) {
    return [
      { id: "layout-0", x: 0, y: 0, width: 49, height: 30, photoX: 50, photoY: 50 },
      { id: "layout-1", x: 51, y: 0, width: 49, height: 30, photoX: 50, photoY: 50 },
      { id: "layout-2", x: 0, y: 32, width: 100, height: 36, photoX: 50, photoY: 50 },
      { id: "layout-3", x: 0, y: 70, width: 49, height: 28, photoX: 50, photoY: 50 },
      { id: "layout-4", x: 51, y: 70, width: 49, height: 28, photoX: 50, photoY: 50 },
    ]
  }

  const cols = Math.ceil(Math.sqrt(photoCount))
  const rows = Math.ceil(photoCount / cols)
  const cellWidth = (100 - GRID_GAP * (cols - 1)) / cols
  const cellHeight = (100 - GRID_GAP * (rows - 1)) / rows

  return Array.from({ length: photoCount }, (_, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    return {
      id: `layout-${i}`,
      x: col * (cellWidth + GRID_GAP),
      y: row * (cellHeight + GRID_GAP),
      width: cellWidth,
      height: cellHeight,
      photoX: CENTER_PERCENT + (rng() - 0.5) * JITTER_PERCENT,
      photoY: CENTER_PERCENT + (rng() - 0.5) * JITTER_PERCENT,
    }
  })
}

/** 사진 수/방향이 일치하는 템플릿 중 하나를 무작위 선택 */
export function pickTemplate(
  templates: readonly LayoutTemplate[],
  photoCount: number,
  orientation: "portrait" | "landscape",
  rng: Rng,
): LayoutTemplate | null {
  const matching = templates.filter((t) => t.photoCount === photoCount && t.orientation === orientation)
  if (matching.length === 0) return null
  return matching[Math.floor(rng() * matching.length)]
}

/** 사진 종횡비와 슬롯 종횡비를 정렬 매칭해 배정 */
export function assignPhotosToTemplate(
  template: LayoutTemplate,
  pagePhotos: readonly PhotoSpec[],
): PhotoLayout[] {
  const sortedPhotos = [...pagePhotos].sort((a, b) => a.width / a.height - b.width / b.height)
  const slotsWithIndex = template.layouts.map((layout, index) => ({ ...layout, originalIndex: index }))
  slotsWithIndex.sort((a, b) => a.width / a.height - b.width / b.height)

  const assignment = new Map<number, string>()
  slotsWithIndex.forEach((slot, i) => {
    const photo = sortedPhotos[i]
    if (photo) assignment.set(slot.originalIndex, photo.id)
  })

  return template.layouts.map((layout, index) => ({
    ...layout,
    photoId: assignment.get(index) ?? "",
  }))
}

/**
 * object-fit: cover 기준으로 실제 화면에 보이는 원본 비율.
 * 1이면 잘림 없음, 0.6이면 원본의 60%만 보인다는 뜻.
 */
export function visibleRatio(imageRatio: number, frameRatio: number): number {
  if (imageRatio <= 0 || frameRatio <= 0) return 1
  return Math.min(imageRatio, frameRatio) / Math.max(imageRatio, frameRatio)
}

/**
 * 피사체 중심이 프레임 가운데 오도록 photoX/photoY를 계산한다.
 * pdf-export.ts의 crop 수식(object-position)과 동일한 좌표계를 사용.
 */
export function focusLayoutOnSubject(
  layout: PhotoLayout,
  photo: PhotoSpec,
  orientation: "portrait" | "landscape",
): PhotoLayout {
  const subject = photo.subject
  if (!subject || photo.width <= 0 || photo.height <= 0) return layout

  const page = pageSizeMm(orientation)
  const frameRatio = ((layout.width / 100) * page.width) / ((layout.height / 100) * page.height)
  const imageRatio = photo.width / photo.height
  if (!Number.isFinite(frameRatio) || frameRatio <= 0) return layout

  const clamp = (value: number) => Math.max(0, Math.min(100, value))

  if (imageRatio > frameRatio) {
    // 좌우가 잘린다 → 가로 위치만 보정
    const visibleWidthFraction = frameRatio / imageRatio
    const slack = 1 - visibleWidthFraction
    if (slack <= 0) return layout
    const photoX = clamp(((subject.x / 100 - visibleWidthFraction / 2) / slack) * 100)
    return { ...layout, photoX, photoY: CENTER_PERCENT }
  }

  // 상하가 잘린다 → 세로 위치만 보정
  const visibleHeightFraction = imageRatio / frameRatio
  const slack = 1 - visibleHeightFraction
  if (slack <= 0) return layout
  const photoY = clamp(((subject.y / 100 - visibleHeightFraction / 2) / slack) * 100)
  return { ...layout, photoX: CENTER_PERCENT, photoY }
}

function densityRange(density: AlbumDensity): DensityRange {
  return DENSITY_RANGES[density] ?? DEFAULT_DENSITY_RANGE
}

/**
 * 사진 목록으로 A4 앨범 한 권을 구성한다.
 * 첫 페이지는 표지(사진 1장 전면), 이후 페이지는 밀도에 따라 무작위 템플릿으로 채운다.
 */
export function buildAlbum(input: BuildAlbumInput): Album {
  const {
    photos,
    templates,
    theme,
    orientation,
    density = "medium",
    focusOnSubject = false,
    rng = Math.random,
    idSeed = String(Date.now()),
  } = input

  const pages: AlbumPage[] = []
  const remaining = [...photos]
  const photoById = new Map(photos.map((photo) => [photo.id, photo]))

  const applyFocus = (layouts: PhotoLayout[]): PhotoLayout[] => {
    if (!focusOnSubject) return layouts
    return layouts.map((layout) => {
      const photo = photoById.get(layout.photoId)
      return photo ? focusLayoutOnSubject(layout, photo, orientation) : layout
    })
  }

  // 표지: 사진 1장으로 전면을 채우고 날짜를 타이틀로
  const coverPhoto = remaining.shift()
  if (coverPhoto) {
    const coverLayout: PhotoLayout = {
      id: "cover-layout",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      photoId: coverPhoto.id,
      photoX: CENTER_PERCENT,
      photoY: CENTER_PERCENT,
    }
    pages.push({
      id: `page-${idSeed}-cover`,
      layouts: applyFocus([coverLayout]),
      isCoverPage: true,
      title: coverPhoto.date || new Date().toISOString().split("T")[0],
      titlePosition: { x: 50, y: 85 },
    })
  }

  const { min, max } = densityRange(density)

  let pageIndex = 0
  while (remaining.length > 0) {
    const photosPerPage = Math.min(min + Math.floor(rng() * (max - min + 1)), remaining.length)
    const pagePhotos = remaining.splice(0, photosPerPage)
    const template = pickTemplate(templates, photosPerPage, orientation, rng)

    const layouts = template
      ? assignPhotosToTemplate(template, pagePhotos)
      : generateGridLayout(photosPerPage, orientation, rng).map((layout, index) => ({
          ...layout,
          photoId: pagePhotos[index]?.id ?? "",
        }))

    pages.push({
      id: `page-${idSeed}-${pageIndex}`,
      layouts: applyFocus(layouts),
      templateId: template?.id,
    })
    pageIndex += 1
  }

  return { id: `album-${idSeed}`, pages, theme, orientation, showMetadata: true }
}
