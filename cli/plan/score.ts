// 후보 앨범을 정량 평가한다 (피사체 보존 / 잘림 / 지면 채움 / 그룹 응집 / 화질 / 시간순 / 균형)
// 레이아웃과 같은 기하 계산(lib/layout/geometry.ts)을 써서 배치와 평가의 기준이 어긋나지 않게 한다.
import {
  cropWindow,
  imageRatio,
  NO_SUBJECT_PADDING,
  normalizeSubject,
  pageSizeMm,
  visibleRatio,
  visibleSubjectFraction,
} from "@/lib/layout/geometry"
import type { SubjectBox } from "@/lib/layout/types"
import type { Album } from "@/types/album"
import type { VariantScore } from "@/cli/types"

export interface ScoringPhoto {
  id: string
  width: number
  height: number
  /** 비전/휴리스틱 판정 점수 0-1 */
  score: number
  /** 피사체 경계상자 (중심 + 크기, 이미지 대비 %) */
  subject?: SubjectBox
  takenAt?: string
  /** 시간/장소 그룹 id */
  groupId?: string
}

export interface ScoreWeights {
  subjectSafety: number
  framing: number
  coverage: number
  groupCohesion: number
  photoQuality: number
  chronology: number
  balance: number
}

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  subjectSafety: 0.3,
  framing: 0.2,
  coverage: 0.15,
  groupCohesion: 0.15,
  photoQuality: 0.1,
  chronology: 0.05,
  balance: 0.05,
}

export interface ScoreOptions {
  weights?: Partial<ScoreWeights>
  /** 콘텐츠 영역을 정하는 페이지 여백 (mm). coverage의 분모 */
  marginMm?: number
}

const DEFAULT_MARGIN_MM = 8
/** 그룹 응집 점수 중 "나뉜 그룹이 연속 페이지에 있는가"의 비중 */
const SPLIT_ORDER_SHARE = 0.2

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))

const mean = (values: readonly number[]): number =>
  values.length === 0 ? 1 : values.reduce((sum, value) => sum + value, 0) / values.length

const weightedMean = (pairs: ReadonlyArray<{ value: number; weight: number }>): number => {
  const total = pairs.reduce((sum, pair) => sum + pair.weight, 0)
  return total <= 0 ? 1 : pairs.reduce((sum, pair) => sum + pair.value * pair.weight, 0) / total
}

function coefficientOfVariation(values: readonly number[]): number {
  if (values.length <= 1) return 0
  const average = mean(values)
  if (average <= 0) return 0
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length
  return Math.sqrt(variance) / average
}

/** 피사체 상자(여백 없이) 중 크롭 창 안에 남은 비율. 피사체 정보가 없으면 1 */
function subjectSafety(photo: ScoringPhoto, frameRatio: number, photoX = 50, photoY = 50, fit: "cover" | "contain" = "cover"): number {
  if (!photo.subject) return 1
  const { id, width, height, subject } = photo
  const rect = normalizeSubject({ id, width, height, subject }, { padding: NO_SUBJECT_PADDING, defaultBox: null })
  return visibleSubjectFraction(rect, cropWindow(imageRatio(photo), frameRatio, photoX, photoY, fit))
}

/** 나뉜 그룹이 연속된 페이지에 놓였는지 (나뉜 그룹이 없으면 1) */
function splitOrder(pagesByGroup: Map<string, number[]>): number {
  const split = [...pagesByGroup.values()].filter((pages) => pages.length > 1)
  if (split.length === 0) return 1
  const consecutive = split.filter((pages) => pages.every((page, i) => i === 0 || page === pages[i - 1] + 1))
  return consecutive.length / split.length
}

export function scoreAlbum(album: Album, photos: readonly ScoringPhoto[], options: ScoreOptions = {}): VariantScore {
  const weights = { ...DEFAULT_SCORE_WEIGHTS, ...options.weights }
  const photoById = new Map(photos.map((photo) => [photo.id, photo]))
  const page = pageSizeMm(album.orientation)
  const margin = options.marginMm ?? DEFAULT_MARGIN_MM
  const contentArea = Math.max(1, (page.width - 2 * margin) * (page.height - 2 * margin))

  const framing: Array<{ value: number; weight: number }> = []
  const safety: Array<{ value: number; weight: number }> = []
  const qualityScores: number[] = []
  const coverageScores: number[] = []
  const purityScores: number[] = []
  const areaPerPhoto: number[] = []
  const placedTimes: number[] = []
  const pagesByGroup = new Map<string, number[]>()

  album.pages.forEach((albumPage, pageIndex) => {
    let placedOnPage = 0
    let filledArea = 0
    const groupsOnPage = new Set<string>()

    for (const layout of albumPage.layouts) {
      const photo = photoById.get(layout.photoId)
      if (!photo || photo.width <= 0 || photo.height <= 0) continue

      const widthMm = (layout.width / 100) * page.width
      const heightMm = (layout.height / 100) * page.height
      if (widthMm <= 0 || heightMm <= 0) continue

      const area = widthMm * heightMm
      const frameRatio = widthMm / heightMm
      const fit = layout.fit ?? "cover"
      const visible = visibleRatio(imageRatio(photo), frameRatio)

      placedOnPage += 1
      filledArea += fit === "contain" ? area * visible : area
      safety.push({ value: subjectSafety(photo, frameRatio, layout.photoX, layout.photoY, fit), weight: area })
      if (!albumPage.isCoverPage) framing.push({ value: fit === "contain" ? 1 : visible, weight: area })
      qualityScores.push(photo.score)
      if (photo.takenAt) placedTimes.push(Date.parse(photo.takenAt))
      if (photo.groupId) groupsOnPage.add(photo.groupId)
    }

    if (albumPage.isCoverPage || placedOnPage === 0) return

    coverageScores.push(clamp01(filledArea / contentArea))
    areaPerPhoto.push(filledArea / placedOnPage)
    if (groupsOnPage.size > 0) purityScores.push(groupsOnPage.size === 1 ? 1 : 0)
    for (const groupId of groupsOnPage) {
      const pages = pagesByGroup.get(groupId) ?? []
      pages.push(pageIndex)
      pagesByGroup.set(groupId, pages)
    }
  })

  let ordered = 0
  for (let i = 1; i < placedTimes.length; i++) {
    if (placedTimes[i] >= placedTimes[i - 1]) ordered += 1
  }
  const chronology = placedTimes.length <= 1 ? 1 : ordered / (placedTimes.length - 1)

  const groupSplitOrder = splitOrder(pagesByGroup)
  const groupCohesion = (1 - SPLIT_ORDER_SHARE) * mean(purityScores) + SPLIT_ORDER_SHARE * groupSplitOrder

  const score = {
    framing: weightedMean(framing),
    subjectSafety: weightedMean(safety),
    photoQuality: mean(qualityScores),
    coverage: mean(coverageScores),
    groupCohesion,
    chronology,
    balance: clamp01(1 - coefficientOfVariation(areaPerPhoto)),
  }

  const weightSum = Object.values(weights).reduce((sum, value) => sum + value, 0) || 1
  const total = clamp01(
    (score.subjectSafety * weights.subjectSafety +
      score.framing * weights.framing +
      score.coverage * weights.coverage +
      score.groupCohesion * weights.groupCohesion +
      score.photoQuality * weights.photoQuality +
      score.chronology * weights.chronology +
      score.balance * weights.balance) /
      weightSum,
  )

  return { total, ...score, groupSplitOrder }
}
