// 시간순 사진을 페이지로 나눈다 — 타임라인 위의 동적 계획법 한 번으로
// "한 페이지보다 큰 그룹", "작은 그룹 합치기", "시간순 폴백"을 함께 처리한다.
import type { AlbumDensity } from "@/types/album"
import type { Boundary, BoundaryKind } from "@/lib/layout/grouping"
import { layoutPage, type LayoutPageOptions, type PageBox } from "@/lib/layout/page-layout"
import type { SolvedPage } from "@/lib/layout/page-cost"
import type { PhotoSpec, Rng } from "@/lib/layout/types"

export interface PaginationWeights {
  /** 페이지 1장당 비용 — 페이지 수 폭증을 막는다 */
  page: number
  /** |사진 수 − 목표| / 목표 에 곱하는 비용 */
  density: number
  /** 페이지 안에 hard 경계가 들어갈 때 비용 */
  hard: number
  /** 페이지 안에 soft 경계가 들어갈 때 비용 */
  soft: number
}

export const DEFAULT_PAGINATION_WEIGHTS: PaginationWeights = { page: 0.3, density: 1.0, hard: 3.0, soft: 0.6 }

/** 밀도별 페이지당 목표/최대 사진 수 */
export const DENSITY_TARGETS: Record<AlbumDensity, { target: number; max: number }> = {
  sparse: { target: 2, max: 3 },
  medium: { target: 4, max: 6 },
  dense: { target: 6, max: 9 },
}

export interface PaginateOptions extends LayoutPageOptions {
  box: PageBox
  density?: AlbumDensity
  /** 페이지당 최소 사진 개수 (기본 1). 마지막 페이지는 이보다 적어도 허용된다. */
  minPerPage?: number
  weights?: Partial<PaginationWeights>
  /** 있으면 변형(variant) 모드: 페이지마다 상위 후보 중 softmax로 고르고 목표 밀도를 흔든다 */
  rng?: Rng
  /** softmax 온도 (비용 차이 기준) */
  temperature?: number
  /** 목표 사진 수를 ±이만큼 흔든다 (rng가 있을 때만) */
  densityJitter?: number
  /**
   * 구간별 후보 페이지 캐시. 같은 사진 목록·같은 옵션으로 여러 번(변형마다) 나눌 때 공유하면 다시 풀지 않는다.
   * 옵션(여백, 레이아웃 소스, 여백 비율 등)이 다른 호출끼리 공유하면 안 된다.
   */
  cache?: Map<string, SolvedPage[]>
}

export interface PagePlan {
  /** photos[start..end) */
  start: number
  end: number
  photos: PhotoSpec[]
  page: SolvedPage
  /** 이 페이지의 전체 비용 (레이아웃 + 페이지 + 밀도 + 경계) */
  cost: number
}

const DEFAULT_TEMPERATURE = 0.15
const VARIANT_CANDIDATES = 3

function boundaryPenalty(kind: BoundaryKind, weights: PaginationWeights): number {
  if (kind === "hard") return weights.hard
  if (kind === "soft") return weights.soft
  return 0
}

/** 비용이 낮을수록 확률이 높은 softmax 선택 */
function softmaxPick(pages: readonly SolvedPage[], temperature: number, rng: Rng): SolvedPage {
  const best = pages[0].cost
  const weights = pages.map((page) => Math.exp(-(page.cost - best) / Math.max(temperature, 1e-6)))
  const total = weights.reduce((sum, w) => sum + w, 0)
  let roll = rng() * total
  for (let i = 0; i < pages.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return pages[i]
  }
  return pages[pages.length - 1]
}

/**
 * best[j] = min_{i<j, j-i ≤ max} best[i] + pageCost(i..j)
 * pageCost = 레이아웃 비용 + W_PAGE + W_DENSITY·|n − 목표|/목표 + 구간 안 경계 비용
 * boundaries[k]는 photos[k]와 photos[k+1] 사이 경계 (길이 n-1).
 */
export function paginate(photos: readonly PhotoSpec[], boundaries: readonly Boundary[], options: PaginateOptions): PagePlan[] {
  const n = photos.length
  if (n === 0) return []

  const weights = { ...DEFAULT_PAGINATION_WEIGHTS, ...options.weights }
  const { target: baseTarget, max: maxPerPage } = DENSITY_TARGETS[options.density ?? "medium"] ?? DENSITY_TARGETS.medium
  const rng = options.rng
  const jitter = rng && options.densityJitter ? Math.round((rng() * 2 - 1) * options.densityJitter) : 0
  const target = Math.max(1, Math.min(maxPerPage, baseTarget + jitter))
  const temperature = options.temperature ?? DEFAULT_TEMPERATURE

  // 경계 비용 누적합: 구간 [i, j) 안의 경계는 boundaries[i..j-2]
  const penaltyPrefix = [0]
  for (let k = 0; k < n - 1; k++) {
    penaltyPrefix.push(penaltyPrefix[k] + boundaryPenalty(boundaries[k]?.kind ?? "none", weights))
  }
  const insidePenalty = (i: number, j: number): number => (j - i >= 2 ? penaltyPrefix[j - 1] - penaltyPrefix[i] : 0)

  const cache = options.cache ?? new Map<string, SolvedPage[]>()
  const memo = new Map<string, SolvedPage | null>()
  const segmentPage = (i: number, j: number): SolvedPage | null => {
    const key = `${i}:${j}`
    if (memo.has(key)) return memo.get(key) ?? null

    // 연속 구간은 첫/마지막 사진 id와 길이로 식별된다
    const cacheKey = `${photos[i].id}|${photos[j - 1].id}|${j - i}`
    let candidates = cache.get(cacheKey)
    if (!candidates) {
      candidates = layoutPage(photos.slice(i, j), options.box, { ...options, topK: VARIANT_CANDIDATES })
      cache.set(cacheKey, candidates)
    }
    const chosen = candidates.length === 0 ? null : rng ? softmaxPick(candidates, temperature, rng) : candidates[0]
    memo.set(key, chosen)
    return chosen
  }

  const best = new Array<number>(n + 1).fill(Number.POSITIVE_INFINITY)
  const from = new Array<number>(n + 1).fill(-1)
  best[0] = 0

  const minPerPage = Math.max(1, options.minPerPage ?? 1)

  for (let j = 1; j <= n; j++) {
    for (let i = Math.max(0, j - maxPerPage); i < j; i++) {
      if (!Number.isFinite(best[i])) continue
      const count = j - i
      // 최소 사진 수 제약: 마지막 페이지(j===n)는 count < minPerPage여도 허용
      if (count < minPerPage && j !== n) continue
      const page = segmentPage(i, j)
      if (!page) continue
      const cost =
        page.cost + weights.page + (weights.density * Math.abs(count - target)) / target + insidePenalty(i, j)
      if (best[i] + cost < best[j]) {
        best[j] = best[i] + cost
        from[j] = i
      }
    }
  }

  if (!Number.isFinite(best[n])) throw new Error("페이지를 구성할 수 없습니다 (배치 가능한 레이아웃 없음)")

  const plans: PagePlan[] = []
  for (let j = n; j > 0; j = from[j]) {
    const i = from[j]
    const page = segmentPage(i, j) as SolvedPage
    plans.push({ start: i, end: j, photos: photos.slice(i, j), page, cost: best[j] - best[i] })
  }
  return plans.reverse()
}
