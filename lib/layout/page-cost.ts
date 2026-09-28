// 페이지 한 장(셀 배치)의 비용 계산과 mm → 페이지 % 변환 — 템플릿 맞춤과 행/열 솔버가 같은 기준을 쓴다
import type { PhotoLayout } from "@/types/album"
import { imageRatio, placePhoto, visibleRatio, type PhotoFit, type Placement, type PlacementOptions } from "@/lib/layout/geometry"
import type { PageSize, PhotoSpec } from "@/lib/layout/types"

/** mm 단위 셀 하나와 거기에 들어갈 사진 */
export interface SolvedCell {
  id: string
  photo: PhotoSpec
  x: number
  y: number
  width: number
  height: number
  fit: PhotoFit
}

export interface PageMetrics {
  /** 콘텐츠 영역 중 비어 있는 비율 (contain 여백 포함) */
  whitespace: number
  /** cover 크롭으로 잘려나간 원본 비율 (면적 가중) */
  cropLoss: number
  /** 인쇄 시 너무 작은 셀 벌점 */
  tiny: number
  /** 1 − 최소 면적 / 최대 면적 */
  imbalance: number
  /** contain(레터박스)으로 들어간 사진 수 */
  contained: number
  /** 읽기 순서가 시간 순서와 어긋난 쌍의 수 */
  inversions: number
}

export interface SolvedPage {
  /** 읽기 순서(= 시간 순서)로 정렬된 셀 */
  cells: SolvedCell[]
  cost: number
  metrics: PageMetrics
  source: "procedural" | "template"
  /** 구조 설명 (예: rows:2-1, template:<id>) */
  label: string
  templateId?: string
}

export const PAGE_COST_WEIGHTS = {
  whitespace: 1.0,
  cropLoss: 0.6,
  tiny: 0.8,
  imbalance: 0.15,
  contain: 1.0,
  order: 0.05,
} as const

/** 짧은 변이 이보다 작으면 인쇄물에서 알아보기 어렵다 */
export const TINY_SIDE_MM = 35

/** 셀 목록의 비용. contentArea는 사진이 차지할 수 있는 영역(mm²) */
export function evaluatePage(
  cells: readonly SolvedCell[],
  contentArea: number,
  inversions = 0,
): { cost: number; metrics: PageMetrics } {
  let totalArea = 0
  let filledArea = 0
  let lostArea = 0
  let tiny = 0
  let contained = 0
  let minArea = Number.POSITIVE_INFINITY
  let maxArea = 0

  for (const cell of cells) {
    const area = cell.width * cell.height
    const visible = visibleRatio(imageRatio(cell.photo), cell.width / cell.height)
    totalArea += area
    minArea = Math.min(minArea, area)
    maxArea = Math.max(maxArea, area)
    tiny += Math.max(0, TINY_SIDE_MM - Math.min(cell.width, cell.height)) / TINY_SIDE_MM

    if (cell.fit === "contain") {
      contained += 1
      filledArea += area * visible
    } else {
      filledArea += area
      lostArea += area * (1 - visible)
    }
  }

  const metrics: PageMetrics = {
    whitespace: contentArea > 0 ? Math.max(0, 1 - filledArea / contentArea) : 0,
    cropLoss: totalArea > 0 ? lostArea / totalArea : 0,
    tiny,
    imbalance: maxArea > 0 ? 1 - minArea / maxArea : 0,
    contained,
    inversions,
  }

  const w = PAGE_COST_WEIGHTS
  const cost =
    w.whitespace * metrics.whitespace +
    w.cropLoss * metrics.cropLoss +
    w.tiny * metrics.tiny +
    w.imbalance * metrics.imbalance +
    w.contain * metrics.contained +
    w.order * metrics.inversions

  return { cost, metrics }
}

export interface PlacedLayout {
  layout: PhotoLayout
  placement: Placement
  cell: SolvedCell
}

/** mm 셀을 페이지 % 레이아웃으로 바꾸고 피사체 기준 photoX/photoY를 채운다 */
export function cellsToLayouts(
  cells: readonly SolvedCell[],
  pageMm: PageSize,
  options: PlacementOptions = {},
): PlacedLayout[] {
  return cells.map((cell) => {
    const placement = placePhoto(cell, cell.photo, { ...options, fit: cell.fit })
    const layout: PhotoLayout = {
      id: cell.id,
      x: (cell.x / pageMm.width) * 100,
      y: (cell.y / pageMm.height) * 100,
      width: (cell.width / pageMm.width) * 100,
      height: (cell.height / pageMm.height) * 100,
      photoId: cell.photo.id,
      photoX: placement.photoX,
      photoY: placement.photoY,
      ...(cell.fit === "contain" ? { fit: "contain" as const } : {}),
    }
    return { layout, placement, cell }
  })
}
