// 사진에 맞춰 페이지 셀을 만든다 — 행(또는 열) 구조를 나열하고, 각 셀 비율을 사진의 허용 범위 안에서 풀어낸다.
// 남는 불일치는 사진을 자르지 않고 페이지 여백으로 흡수한다.
import type { LayoutTemplate } from "@/types/album"
import { feasibleRange, pageSizeMm, type FeasibleRange, type GeometryOptions } from "@/lib/layout/geometry"
import { evaluatePage, type SolvedCell, type SolvedPage } from "@/lib/layout/page-cost"
import { fitTemplates } from "@/lib/layout/template-fit"
import type { Orientation, PageSize, PhotoSpec } from "@/lib/layout/types"

export const DEFAULT_MARGIN_MM = 8
export const DEFAULT_GUTTER_MM = 4

/** 한 행에 둘 수 있는 최대 사진 수 (세로 용지 / 가로 용지) */
const MAX_PER_LINE: Record<Orientation, { rows: number; cols: number }> = {
  portrait: { rows: 4, cols: 5 },
  landscape: { rows: 5, cols: 4 },
}

/** 남는 세로 공간을 행 간격에 나눠 줄 때 간격의 최대 배수 */
const MAX_GUTTER_SPREAD = 3
/** 이보다 짧은 변을 가진 셀은 만들지 않는다 (mm) */
const MIN_CELL_MM = 12
/** 뉴턴 반복 최대 횟수 (보통 5회 안쪽에서 수렴) */
const SOLVE_STEPS = 40
const SOLVE_TOLERANCE_MM = 1e-9
const EPSILON = 1e-9

export type LayoutSource = "procedural" | "templates" | "both"

/** 페이지와 사진이 들어갈 콘텐츠 영역 (mm) */
export interface PageBox {
  page: PageSize
  margin: number
  gutter: number
}

export interface Structure {
  /** rows: 위→아래 행, 각 행은 왼→오른쪽. cols: 왼→오른쪽 열, 각 열은 위→아래 */
  kind: "rows" | "cols"
  /** 행(열)별 사진 수. 합이 사진 수 */
  sizes: number[]
}

export interface LayoutPageOptions extends GeometryOptions {
  orientation: Orientation
  layoutSource?: LayoutSource
  templates?: readonly LayoutTemplate[]
  /** 비용순 상위 몇 개를 돌려줄지 */
  topK?: number
}

export function contentBox(
  orientation: Orientation,
  margin: number = DEFAULT_MARGIN_MM,
  gutter: number = DEFAULT_GUTTER_MM,
): PageBox {
  return { page: pageSizeMm(orientation), margin, gutter }
}

function contentSize(box: PageBox): { width: number; height: number } {
  return { width: box.page.width - 2 * box.margin, height: box.page.height - 2 * box.margin }
}

/** n을 순서 있는 양의 정수 합으로 나누는 모든 방법 (각 항 ≤ maxPart) */
function compositions(n: number, maxPart: number): number[][] {
  if (n === 0) return [[]]
  const result: number[][] = []
  for (let first = 1; first <= Math.min(n, maxPart); first++) {
    for (const rest of compositions(n - first, maxPart)) result.push([first, ...rest])
  }
  return result
}

/**
 * n장을 연속된 행(또는 열)으로 나누는 구조를 모두 나열한다.
 * 사진 순서는 읽기 순서 그대로이므로 시간 순서가 저절로 유지된다.
 * 한 열짜리 cols(= 1장씩 쌓은 rows)와 1장씩인 cols(= 한 줄 rows)는 중복이라 뺀다.
 */
export function enumerateStructures(n: number, orientation: Orientation): Structure[] {
  if (n <= 0) return []
  const limits = MAX_PER_LINE[orientation]
  const rows = compositions(n, limits.rows).map((sizes): Structure => ({ kind: "rows", sizes }))
  const cols = compositions(n, limits.cols)
    .filter((sizes) => sizes.length > 1 && sizes.some((size) => size > 1))
    .map((sizes): Structure => ({ kind: "cols", sizes }))
  return [...rows, ...cols]
}

interface LineCell {
  x: number
  y: number
  width: number
  height: number
}

/**
 * 폭 W, 높이 H인 영역에 행 구조를 푼다. ranges는 사진별 허용 셀 비율(가로/세로).
 * 1) 원본 비율에서 출발 2) 너무 높으면 셀을 넓히고, 낮으면 좁힌다: a_i(t) = p_i·(bound_i/p_i)^t (로그 공간 보간)
 *    T(t)는 단조라 뉴턴법(구간 보호)으로 T(t) = H를 푼다.
 * 3) 범위 끝까지 가도 안 맞으면 블록 폭을 줄이거나(좌우 여백) 행 간격/상하 여백으로 흡수한다.
 */
function solveRows(sizes: readonly number[], ranges: readonly FeasibleRange[], W: number, H: number, g: number): LineCell[] | null {
  const n = ranges.length
  const k = sizes.length
  const preferred = new Float64Array(n)
  const logHi = new Float64Array(n)
  const logLo = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    preferred[i] = ranges[i].preferred
    logHi[i] = Math.log(ranges[i].hi / ranges[i].preferred)
    logLo[i] = Math.log(ranges[i].lo / ranges[i].preferred)
  }

  const ratios = new Float64Array(preferred)
  const setRatios = (t: number, logBound: Float64Array) => {
    for (let i = 0; i < n; i++) ratios[i] = preferred[i] * Math.exp(t * logBound[i])
  }

  /** 전체 높이와 t에 대한 도함수 (logBound가 주어졌을 때) */
  const measure = (width: number, logBound?: Float64Array): { total: number; slope: number } => {
    let total = g * (k - 1)
    let slope = 0
    let index = 0
    for (let j = 0; j < k; j++) {
      const usable = width - g * (sizes[j] - 1)
      let sum = 0
      let weighted = 0
      for (let m = 0; m < sizes[j]; m++, index++) {
        sum += ratios[index]
        if (logBound) weighted += ratios[index] * logBound[index]
      }
      total += usable / sum
      slope -= (usable / (sum * sum)) * weighted
    }
    return { total, slope }
  }

  /** T(t) = H가 되는 t (T(0), T(1)이 H를 사이에 둘 때) */
  const solveT = (logBound: Float64Array, f0: number, f1: number) => {
    let low = 0
    let high = 1
    let t = f0 / (f0 - f1) // 할선으로 시작
    for (let step = 0; step < SOLVE_STEPS; step++) {
      setRatios(t, logBound)
      const { total, slope } = measure(W, logBound)
      const f = total - H
      if (Math.abs(f) < SOLVE_TOLERANCE_MM) return
      if (Math.sign(f) === Math.sign(f0)) low = t
      else high = t
      const next = slope !== 0 ? t - f / slope : Number.NaN
      t = next > low && next < high ? next : (low + high) / 2
    }
    setRatios(t, logBound)
  }

  let width = W
  const initial = measure(W).total

  if (initial > H + EPSILON) {
    setRatios(1, logHi)
    const widest = measure(W).total
    if (widest > H) {
      // 가장 넓혀도 높다 → 블록 폭을 줄여 좌우 여백으로 흡수 (T(W') = H를 닫힌 식으로)
      let inverseSum = 0
      let gutterTerm = 0
      let index = 0
      for (let j = 0; j < k; j++) {
        let sum = 0
        for (let m = 0; m < sizes[j]; m++, index++) sum += ratios[index]
        inverseSum += 1 / sum
        gutterTerm += (sizes[j] - 1) / sum
      }
      width = (H - g * (k - 1) + g * gutterTerm) / inverseSum
    } else {
      solveT(logHi, initial - H, widest - H)
    }
  } else if (initial < H - EPSILON) {
    setRatios(1, logLo)
    const narrowest = measure(W).total
    if (narrowest >= H) solveT(logLo, initial - H, narrowest - H)
  }

  if (!(width > 0) || sizes.some((size) => width - g * (size - 1) <= 0)) return null

  const heights: number[] = []
  let index = 0
  for (let j = 0; j < k; j++) {
    let sum = 0
    for (let m = 0; m < sizes[j]; m++, index++) sum += ratios[index]
    heights.push((width - g * (sizes[j] - 1)) / sum)
  }
  const blockHeight = heights.reduce((sum, h) => sum + h, 0) + g * (k - 1)
  const leftover = Math.max(0, H - blockHeight)
  // 남는 높이는 행 간격(최대 3배)으로 먼저, 나머지는 위아래 여백으로
  const extraGap = k > 1 ? Math.min(leftover / (k - 1), g * (MAX_GUTTER_SPREAD - 1)) : 0
  const rowGap = g + extraGap
  const usedHeight = blockHeight + extraGap * (k - 1)
  const offsetX = (W - width) / 2
  let y = (H - Math.min(usedHeight, H)) / 2

  const cells: LineCell[] = []
  index = 0
  for (let j = 0; j < k; j++) {
    let x = offsetX
    for (let m = 0; m < sizes[j]; m++, index++) {
      const cellWidth = ratios[index] * heights[j]
      if (Math.min(cellWidth, heights[j]) < MIN_CELL_MM) return null
      cells.push({ x, y, width: cellWidth, height: heights[j] })
      x += cellWidth + g
    }
    y += heights[j] + rowGap
  }
  return cells
}

const structureLabel = (structure: Structure): string => `${structure.kind}:${structure.sizes.join("-")}`

/** 구조 하나를 풀어 페이지를 만든다. 셀 비율은 항상 각 사진의 허용 범위 안이다 */
export function solveStructure(
  structure: Structure,
  photos: readonly PhotoSpec[],
  box: PageBox,
  options: GeometryOptions = {},
): SolvedPage | null {
  return solveWithRanges(structure, photos, photos.map((photo) => feasibleRange(photo, options)), box)
}

function solveWithRanges(
  structure: Structure,
  photos: readonly PhotoSpec[],
  ranges: readonly FeasibleRange[],
  box: PageBox,
): SolvedPage | null {
  const total = structure.sizes.reduce((sum, size) => sum + size, 0)
  if (photos.length === 0 || total !== photos.length) return null

  const content = contentSize(box)
  if (content.width <= 0 || content.height <= 0) return null

  const transposed = structure.kind === "cols"

  // 열 구조는 가로/세로를 바꿔 행 구조로 푼다 (비율도 역수)
  const lineCells = transposed
    ? solveRows(
        structure.sizes,
        ranges.map((range) => ({ lo: 1 / range.hi, hi: 1 / range.lo, preferred: 1 / range.preferred })),
        content.height,
        content.width,
        box.gutter,
      )
    : solveRows(structure.sizes, ranges, content.width, content.height, box.gutter)

  if (!lineCells) return null

  const cells: SolvedCell[] = lineCells.map((cell, i) => ({
    id: `cell-${i}`,
    photo: photos[i],
    x: box.margin + (transposed ? cell.y : cell.x),
    y: box.margin + (transposed ? cell.x : cell.y),
    width: transposed ? cell.height : cell.width,
    height: transposed ? cell.width : cell.height,
    fit: "cover",
  }))

  const { cost, metrics } = evaluatePage(cells, content.width * content.height)
  return { cells, cost, metrics, source: "procedural", label: structureLabel(structure) }
}

/** 어떤 구조로도 풀리지 않는 1장짜리 페이지 — 콘텐츠 영역 전체에 contain으로 넣는다 */
function containHero(photo: PhotoSpec, box: PageBox): SolvedPage {
  const content = contentSize(box)
  const cells: SolvedCell[] = [
    { id: "cell-0", photo, x: box.margin, y: box.margin, width: content.width, height: content.height, fit: "contain" },
  ]
  const { cost, metrics } = evaluatePage(cells, content.width * content.height)
  return { cells, cost, metrics, source: "procedural", label: "contain" }
}

/**
 * 사진 묶음(한 페이지 분량)에 대한 후보 페이지들을 비용순으로 돌려준다.
 * layoutSource가 templates인데 맞는 템플릿이 없으면 행/열 솔버로 대신한다 (사진을 자르지 않기 위해).
 */
export function layoutPage(photos: readonly PhotoSpec[], box: PageBox, options: LayoutPageOptions): SolvedPage[] {
  if (photos.length === 0) return []
  const source = options.layoutSource ?? "both"
  const topK = options.topK ?? 3

  const procedural = (): SolvedPage[] => {
    const ranges = photos.map((photo) => feasibleRange(photo, options))
    return enumerateStructures(photos.length, options.orientation)
      .map((structure) => solveWithRanges(structure, photos, ranges, box))
      .filter((page): page is SolvedPage => page !== null)
  }

  const templated = (): SolvedPage[] =>
    options.templates ? fitTemplates(options.templates, photos, box.page, options.orientation, options) : []

  let candidates: SolvedPage[]
  if (source === "procedural") candidates = procedural()
  else if (source === "templates") {
    candidates = templated()
    if (candidates.length === 0) candidates = procedural()
  } else candidates = [...procedural(), ...templated()]

  if (candidates.length === 0 && photos.length === 1) candidates = [containHero(photos[0], box)]

  return candidates.sort((a, b) => a.cost - b.cost).slice(0, topK)
}
