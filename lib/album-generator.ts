// 앨범 페이지 구성 로직 (브라우저 API 비의존 — 웹과 CLI가 공유)
// 흐름: 표지 선택 → 시간/장소 그룹 → 타임라인 DP 페이지 나누기 → 페이지별 셀 풀이 → 피사체 기준 배치
import type { Album, AlbumDensity, AlbumPage, LayoutTemplate, PhotoLayout } from "@/types/album"
import {
  feasibleRange,
  imageRatio,
  isRatioFeasible,
  pageSizeMm,
  placePhoto,
  visibleRatio,
  type GeometryOptions,
  type Placement,
  type SubjectPadding,
} from "@/lib/layout/geometry"
import { groupPhotos, type Boundary, type GroupingOptions, type PhotoGroup } from "@/lib/layout/grouping"
import { cellsToLayouts, type SolvedPage } from "@/lib/layout/page-cost"
import { contentBox, DEFAULT_GUTTER_MM, DEFAULT_MARGIN_MM, type LayoutSource } from "@/lib/layout/page-layout"
import { paginate, type PaginationWeights } from "@/lib/layout/paginate"
import { fitTemplate } from "@/lib/layout/template-fit"
import type { PageSize, PhotoSpec, Rng } from "@/lib/layout/types"

export type { PhotoSpec, Rng, SubjectBox, TimeSource } from "@/lib/layout/types"
export type { LayoutSource } from "@/lib/layout/page-layout"
export { pageSizeMm, visibleRatio } from "@/lib/layout/geometry"

export interface BuildAlbumInput {
  photos: readonly PhotoSpec[]
  templates: readonly LayoutTemplate[]
  theme: string
  orientation: "portrait" | "landscape"
  density?: AlbumDensity
  /** @deprecated placement를 쓴다. false면 placement "center" */
  focusOnSubject?: boolean
  /** 있으면 변형 모드 (페이지 구조를 상위 후보 중 무작위로). 없으면 최적해 하나로 결정론적 */
  rng?: Rng
  /** 페이지/앨범 id 접두어. 지정하지 않으면 Date.now() 사용 */
  idSeed?: string
  /** procedural: 사진에 맞춘 행/열 구조, templates: 기존 템플릿, both: 둘 다 후보 */
  layoutSource?: LayoutSource
  /** false면 그룹 없이 시간순으로만 나눈다 */
  grouping?: GroupingOptions | false
}

export interface PlanAlbumInput extends BuildAlbumInput {
  /** 피사체 상자 여백 */
  padding?: SubjectPadding
  /** 피사체 정보가 없을 때 지킬 가운데 영역 (0-1). null이면 전체 크롭 허용 */
  defaultSubjectBox?: number | null
  margins?: { margin?: number; gutter?: number }
  paginationWeights?: Partial<PaginationWeights>
  /** subject: 피사체 상자 기준 photoX/photoY, center: 가운데 고정 */
  placement?: "subject" | "center"
  /** 표지로 쓸 사진 id (없으면 자동 선택) */
  coverPhotoId?: string
  /** false면 표지 없이 본문만 */
  cover?: boolean
  /** 그룹 첫 페이지에 "날짜 · 장소" 캡션을 단다 */
  captions?: boolean
  /** 변형 모드 softmax 온도 */
  temperature?: number
  /** 변형 모드에서 목표 사진 수를 ±이만큼 흔든다 */
  densityJitter?: number
  /** 같은 사진·같은 옵션으로 여러 번 계획할 때(변형 후보) 공유하는 구간 레이아웃 캐시 */
  layoutCache?: Map<string, SolvedPage[]>
}

export interface PlacementDiagnostic {
  photoId: string
  pageIndex: number
  /** 셀 위치/크기 (mm) */
  cell: { x: number; y: number; width: number; height: number }
  photoX: number
  photoY: number
  fit: "cover" | "contain"
  subjectCut: number
}

export interface PlanAlbumResult {
  album: Album
  groups: PhotoGroup[]
  boundaries: Boundary[]
  /** off: 그룹 끔, chronological: 시간 정보 부족으로 시간순만 */
  groupingMode: "grouped" | "chronological" | "off"
  diagnostics: {
    placements: PlacementDiagnostic[]
    /** contain(레터박스)으로 들어간 사진 id */
    contained: string[]
    cover: { photoId: string; framed: boolean } | null
    /** 페이지별 구조 설명 (예: rows:2-1, template:<id>) */
    pageLabels: string[]
  }
}

const GRID_GAP = 2
const CENTER_PERCENT = 50
/** 액자형 표지에서 사진이 차지할 수 있는 최대 페이지 높이 비율 */
const FRAMED_COVER_MAX_HEIGHT = 0.8
/** 액자형 표지에서 사진 아래 타이틀 공간 (mm) */
const FRAMED_COVER_TITLE_SPACE_MM = 30
const FULL_BLEED_TITLE_Y = 85
const DEFAULT_PHOTO_SCORE = 0.5

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

/** 단순 격자 레이아웃 (레이아웃 관리자 등에서 쓰는 폴백). 사진 위치는 가운데 고정 */
export function generateGridLayout(
  photoCount: number,
  // 예전 시그니처 호환용 (지터 제거로 더 이상 쓰지 않음)
  _orientation?: "portrait" | "landscape",
  _rng?: Rng,
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
      photoX: CENTER_PERCENT,
      photoY: CENTER_PERCENT,
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

/**
 * @deprecated fitTemplate(lib/layout/template-fit.ts)를 직접 쓴다.
 * 템플릿 셀에 사진을 최적 배정한다. 피사체가 들어갈 셀이 없는 사진은 contain으로 넣는다.
 * 사진 수가 셀 수와 다르면 앞에서부터 채우고 남는 셀은 빈 슬롯으로 둔다.
 */
export function assignPhotosToTemplate(
  template: LayoutTemplate,
  pagePhotos: readonly PhotoSpec[],
  orientation: "portrait" | "landscape" = template.orientation,
): PhotoLayout[] {
  const pageMm = pageSizeMm(orientation)
  const fitted = fitTemplate(template, pagePhotos, pageMm, { allowContain: true })
  if (fitted) return cellsToLayouts(fitted.cells, pageMm).map(({ layout }) => layout)

  return template.layouts.map((layout, index) => ({ ...layout, photoId: pagePhotos[index]?.id ?? "" }))
}

export interface CoverChoice {
  photo: PhotoSpec
  layout: PhotoLayout
  placement: Placement
  /** true면 전면이 아니라 사진 비율 그대로의 액자형 표지 */
  framed: boolean
  titlePosition: { x: number; y: number }
}

export interface PickCoverOptions extends GeometryOptions {
  coverPhotoId?: string
  margin?: number
  placement?: "subject" | "center"
}

/**
 * 표지를 고른다. 전면(페이지 비율)으로 넣어도 피사체가 잘리지 않는 사진 중 점수 × 보이는 비율이 가장 높은 것.
 * 그런 사진이 없으면 가장 점수가 높은 사진을 원본 비율 그대로 액자처럼 넣고 타이틀을 아래에 둔다.
 */
export function pickCover(
  photos: readonly PhotoSpec[],
  pageMm: PageSize,
  options: PickCoverOptions = {},
): CoverChoice | null {
  if (photos.length === 0) return null

  const pageRatio = pageMm.width / pageMm.height
  const score = (photo: PhotoSpec) => photo.score ?? DEFAULT_PHOTO_SCORE
  const bestBy = (list: readonly PhotoSpec[], value: (photo: PhotoSpec) => number) =>
    list.reduce((best, photo) => (value(photo) > value(best) ? photo : best))

  const forced = options.coverPhotoId ? photos.find((photo) => photo.id === options.coverPhotoId) : undefined
  const fullBleedOk = (photo: PhotoSpec) => isRatioFeasible(feasibleRange(photo, options), pageRatio)
  const candidates = forced ? [forced].filter(fullBleedOk) : photos.filter(fullBleedOk)
  const placementOptions = { ...options, mode: options.placement }

  if (candidates.length > 0) {
    const photo = bestBy(candidates, (p) => score(p) * visibleRatio(imageRatio(p), pageRatio))
    const placement = placePhoto({ width: pageMm.width, height: pageMm.height }, photo, placementOptions)
    return {
      photo,
      placement,
      framed: false,
      titlePosition: { x: 50, y: FULL_BLEED_TITLE_Y },
      layout: {
        id: "cover-layout",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        photoId: photo.id,
        photoX: placement.photoX,
        photoY: placement.photoY,
      },
    }
  }

  // 액자형 표지: 원본 비율 그대로 (잘림 없음)
  const photo = forced ?? bestBy(photos, score)
  const margin = options.margin ?? DEFAULT_MARGIN_MM
  const ratio = imageRatio(photo)
  const maxWidth = pageMm.width - 2 * margin
  const maxHeight = Math.min(FRAMED_COVER_MAX_HEIGHT * pageMm.height, pageMm.height - 2 * margin - FRAMED_COVER_TITLE_SPACE_MM)
  const width = Math.min(maxWidth, maxHeight * ratio)
  const height = width / ratio
  const x = (pageMm.width - width) / 2
  const y = Math.max(margin, (pageMm.height - height - FRAMED_COVER_TITLE_SPACE_MM) / 2)
  const placement = placePhoto({ width, height }, photo, placementOptions)

  return {
    photo,
    placement,
    framed: true,
    titlePosition: { x: 50, y: ((y + height + FRAMED_COVER_TITLE_SPACE_MM / 2) / pageMm.height) * 100 },
    layout: {
      id: "cover-layout",
      x: (x / pageMm.width) * 100,
      y: (y / pageMm.height) * 100,
      width: (width / pageMm.width) * 100,
      height: (height / pageMm.height) * 100,
      photoId: photo.id,
      photoX: placement.photoX,
      photoY: placement.photoY,
    },
  }
}

function formatDay(epochMs: number): string {
  const date = new Date(epochMs)
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`
}

/** 그룹 캡션: "2024.05.12 · 제주 서귀포" */
function groupCaption(group: PhotoGroup, firstPhoto: PhotoSpec | undefined): string | undefined {
  const day = group.start !== undefined ? formatDay(group.start) : firstPhoto?.date
  const parts = [day, group.location].filter((part): part is string => Boolean(part))
  return parts.length > 0 ? parts.join(" · ") : undefined
}

/**
 * 사진 목록으로 A4 앨범 한 권을 계획한다 (사진은 시간순으로 넘겨야 한다).
 * 표지 → 그룹 → 페이지 나누기(DP) → 셀 풀이 → 피사체 기준 배치. 피사체는 잘리지 않는 것이 원칙이고,
 * 어쩔 수 없는 경우 contain(레터박스)으로 넣고 diagnostics.contained에 남긴다.
 */
export function planAlbum(input: PlanAlbumInput): PlanAlbumResult {
  const {
    photos,
    templates,
    theme,
    orientation,
    density = "medium",
    rng,
    idSeed = String(Date.now()),
    layoutSource = "both",
    grouping = {},
    padding,
    defaultSubjectBox,
    margins,
    paginationWeights,
    coverPhotoId,
    cover = true,
    captions = false,
    temperature,
    densityJitter,
    layoutCache,
  } = input
  const placement = input.placement ?? (input.focusOnSubject === false ? "center" : "subject")
  const geometry: GeometryOptions = { padding, defaultBox: defaultSubjectBox }
  const pageMm = pageSizeMm(orientation)
  const box = contentBox(orientation, margins?.margin ?? DEFAULT_MARGIN_MM, margins?.gutter ?? DEFAULT_GUTTER_MM)

  const pages: AlbumPage[] = []
  const placements: PlacementDiagnostic[] = []

  // 표지 사진은 본문에서 뺀다 (두 번 나오지 않게)
  const coverChoice = cover
    ? pickCover(photos, pageMm, { ...geometry, coverPhotoId, margin: box.margin, placement })
    : null
  const body = coverChoice ? photos.filter((photo) => photo.id !== coverChoice.photo.id) : [...photos]

  if (coverChoice) {
    const firstDated = photos.find((photo) => photo.date)
    pages.push({
      id: `page-${idSeed}-cover`,
      layouts: [coverChoice.layout],
      isCoverPage: true,
      title: firstDated?.date || new Date().toISOString().split("T")[0],
      titlePosition: coverChoice.titlePosition,
    })
    const { layout } = coverChoice
    placements.push({
      photoId: coverChoice.photo.id,
      pageIndex: 0,
      cell: {
        x: (layout.x / 100) * pageMm.width,
        y: (layout.y / 100) * pageMm.height,
        width: (layout.width / 100) * pageMm.width,
        height: (layout.height / 100) * pageMm.height,
      },
      photoX: coverChoice.placement.photoX,
      photoY: coverChoice.placement.photoY,
      fit: coverChoice.placement.fit,
      subjectCut: coverChoice.placement.subjectCut,
    })
  }

  const grouped =
    grouping === false
      ? {
          groups: body.length > 0 ? [{ id: "g1", photoIds: body.map((p) => p.id), boundaryAfter: "none" as const }] : [],
          boundaries: body.slice(1).map((_, index): Boundary => ({ index, kind: "unknown", reason: "grouping-off" })),
          mode: "off" as const,
        }
      : groupPhotos(body, grouping)

  const groupOf = new Map<string, PhotoGroup>()
  for (const group of grouped.groups) for (const id of group.photoIds) groupOf.set(id, group)

  const plans = paginate(body, grouped.boundaries, {
    ...geometry,
    box,
    orientation,
    density,
    layoutSource,
    templates,
    weights: paginationWeights,
    rng,
    temperature,
    densityJitter,
    cache: layoutCache,
  })

  const seenGroups = new Set<string>()
  const pageLabels: string[] = []
  plans.forEach((plan, index) => {
    const placed = cellsToLayouts(plan.page.cells, pageMm, { ...geometry, mode: placement })
    const groupIds = [...new Set(plan.photos.map((photo) => groupOf.get(photo.id)?.id).filter((id): id is string => !!id))]
    const firstGroup = groupOf.get(plan.photos[0].id)
    const continued = firstGroup ? seenGroups.has(firstGroup.id) : false
    groupIds.forEach((id) => seenGroups.add(id))

    const caption = captions && firstGroup && !continued ? groupCaption(firstGroup, plan.photos[0]) : undefined
    const pageIndex = pages.length

    pages.push({
      id: `page-${idSeed}-${index}`,
      layouts: placed.map(({ layout }) => layout),
      ...(plan.page.templateId ? { templateId: plan.page.templateId } : {}),
      ...(groupIds.length > 0 ? { groupIds } : {}),
      ...(continued ? { continued: true } : {}),
      ...(caption ? { caption } : {}),
    })
    pageLabels.push(plan.page.label)

    for (const { cell, placement: p } of placed) {
      placements.push({
        photoId: cell.photo.id,
        pageIndex,
        cell: { x: cell.x, y: cell.y, width: cell.width, height: cell.height },
        photoX: p.photoX,
        photoY: p.photoY,
        fit: p.fit,
        subjectCut: p.subjectCut,
      })
    }
  })

  return {
    album: { id: `album-${idSeed}`, pages, theme, orientation, showMetadata: true },
    groups: grouped.groups,
    boundaries: grouped.boundaries,
    groupingMode: grouped.mode,
    diagnostics: {
      placements,
      contained: placements.filter((p) => p.fit === "contain").map((p) => p.photoId),
      cover: coverChoice ? { photoId: coverChoice.photo.id, framed: coverChoice.framed } : null,
      pageLabels,
    },
  }
}

/**
 * 사진 목록으로 A4 앨범 한 권을 구성한다 (planAlbum의 호환 래퍼 — 웹 앱이 쓰는 진입점).
 * 첫 페이지는 표지, 이후 페이지는 그룹과 사진 비율에 맞춰 나눈다.
 */
export function buildAlbum(input: BuildAlbumInput): Album {
  return planAlbum(input).album
}
