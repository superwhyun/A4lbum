// 고정 템플릿에 사진을 배정한다 — 셀 비율(mm)이 피사체 허용 범위를 벗어나면 배정 불가, 최적 배정은 비트마스크 DP
import type { LayoutTemplate } from "@/types/album"
import { feasibleRange, imageRatio, isRatioFeasible, visibleRatio, type GeometryOptions } from "@/lib/layout/geometry"
import { evaluatePage, PAGE_COST_WEIGHTS, type SolvedCell, type SolvedPage } from "@/lib/layout/page-cost"
import type { PageSize, PhotoSpec } from "@/lib/layout/types"

/** 비트마스크 DP 상태 수 제한 (2^12) */
const MAX_DP_PHOTOS = 12
/** 같은 줄로 보는 y 차이 (mm) */
const ROW_TOLERANCE_MM = 1

export interface TemplateFitOptions extends GeometryOptions {
  /** 어느 셀에도 맞지 않는 사진을 contain(레터박스)으로라도 넣는다. 끄면 그런 배정은 불가능(null) */
  allowContain?: boolean
  /** 읽기 순서가 시간 순서와 뒤집힌 쌍 하나당 벌점 */
  orderWeight?: number
}

export interface Assignment {
  /** 읽기 순서 k번째 셀에 들어갈 사진 인덱스 */
  cellToPhoto: number[]
  cost: number
}

function popcount(value: number): number {
  let count = 0
  let rest = value
  while (rest) {
    rest &= rest - 1
    count += 1
  }
  return count
}

/**
 * cost[p][k] (사진 p를 읽기 순서 k번째 셀에 넣는 비용)로 최소 비용 배정을 구한다.
 * 셀을 읽기 순서대로 채우므로, 이미 배치된 사진 중 p보다 늦은 사진 수가 곧 뒤집힘 수다.
 */
export function solveAssignment(cost: readonly (readonly number[])[], orderWeight: number = PAGE_COST_WEIGHTS.order): Assignment | null {
  const n = cost.length
  if (n === 0) return { cellToPhoto: [], cost: 0 }
  if (n > MAX_DP_PHOTOS) throw new Error(`배정할 사진이 너무 많습니다 (${n} > ${MAX_DP_PHOTOS})`)

  const size = 1 << n
  const best = new Float64Array(size).fill(Number.POSITIVE_INFINITY)
  const parent = new Int8Array(size).fill(-1)
  best[0] = 0

  for (let mask = 0; mask < size; mask++) {
    const base = best[mask]
    if (!Number.isFinite(base)) continue
    const k = popcount(mask)
    if (k === n) continue

    for (let p = 0; p < n; p++) {
      if (mask & (1 << p)) continue
      const step = cost[p][k]
      if (!Number.isFinite(step)) continue
      const next = mask | (1 << p)
      const value = base + step + orderWeight * popcount(mask >> (p + 1))
      if (value < best[next]) {
        best[next] = value
        parent[next] = p
      }
    }
  }

  const full = size - 1
  if (!Number.isFinite(best[full])) return null

  const cellToPhoto = new Array<number>(n)
  let mask = full
  for (let k = n - 1; k >= 0; k--) {
    const p = parent[mask]
    cellToPhoto[k] = p
    mask &= ~(1 << p)
  }
  return { cellToPhoto, cost: best[full] }
}

function countInversions(sequence: readonly number[]): number {
  let inversions = 0
  for (let i = 0; i < sequence.length; i++) {
    for (let j = i + 1; j < sequence.length; j++) {
      if (sequence[i] > sequence[j]) inversions += 1
    }
  }
  return inversions
}

/**
 * 템플릿 하나에 사진들을 최적 배정한다. 사진 수가 다르거나 피사체를 자르지 않는 배정이 없으면 null.
 * 셀 비율은 페이지 % 가 아니라 mm 기준으로 계산한다.
 */
export function fitTemplate(
  template: LayoutTemplate,
  photos: readonly PhotoSpec[],
  pageMm: PageSize,
  options: TemplateFitOptions = {},
): SolvedPage | null {
  const n = photos.length
  if (n === 0 || template.layouts.length !== n || n > MAX_DP_PHOTOS) return null

  const pageArea = pageMm.width * pageMm.height
  const slots = template.layouts
    .map((layout) => ({
      id: layout.id,
      x: (layout.x / 100) * pageMm.width,
      y: (layout.y / 100) * pageMm.height,
      width: (layout.width / 100) * pageMm.width,
      height: (layout.height / 100) * pageMm.height,
    }))
    .sort((a, b) => (Math.abs(a.y - b.y) > ROW_TOLERANCE_MM ? a.y - b.y : a.x - b.x))

  if (slots.some((slot) => slot.width <= 0 || slot.height <= 0)) return null

  const ranges = photos.map((photo) => feasibleRange(photo, options))
  const containCells = new Set<string>()

  const cost = photos.map((photo, p) =>
    slots.map((slot, k) => {
      const ratio = slot.width / slot.height
      const lost = (1 - visibleRatio(imageRatio(photo), ratio)) * ((slot.width * slot.height) / pageArea)
      if (isRatioFeasible(ranges[p], ratio)) return lost
      if (!options.allowContain) return Number.POSITIVE_INFINITY
      containCells.add(`${p}:${k}`)
      return PAGE_COST_WEIGHTS.contain + lost
    }),
  )

  const assignment = solveAssignment(cost, options.orderWeight)
  if (!assignment) return null

  const cells: SolvedCell[] = slots.map((slot, k) => {
    const p = assignment.cellToPhoto[k]
    return { ...slot, photo: photos[p], fit: containCells.has(`${p}:${k}`) ? "contain" : "cover" }
  })

  const { cost: pageCost, metrics } = evaluatePage(cells, pageArea, countInversions(assignment.cellToPhoto))
  return { cells, cost: pageCost, metrics, source: "template", label: `template:${template.id}`, templateId: template.id }
}

/** 사진 수/방향이 맞는 템플릿들을 모두 맞춰보고 비용순으로 돌려준다 */
export function fitTemplates(
  templates: readonly LayoutTemplate[],
  photos: readonly PhotoSpec[],
  pageMm: PageSize,
  orientation: "portrait" | "landscape",
  options: TemplateFitOptions = {},
): SolvedPage[] {
  return templates
    .filter((template) => template.orientation === orientation && template.layouts.length === photos.length)
    .map((template) => fitTemplate(template, photos, pageMm, options))
    .filter((page): page is SolvedPage => page !== null)
    .sort((a, b) => a.cost - b.cost)
}
