// 후보 앨범을 정량 평가한다 (잘림 / 피사체 보존 / 화질 / 시간순 / 밀도 균형)
import { pageSizeMm, visibleRatio } from "@/lib/album-generator"
import type { Album, PhotoLayout } from "@/types/album"
import type { VariantScore } from "@/cli/types"

export interface ScoringPhoto {
  id: string
  width: number
  height: number
  /** 비전/휴리스틱 판정 점수 0-1 */
  score: number
  subject?: { x: number; y: number }
  takenAt?: string
}

const WEIGHTS = {
  framing: 0.25,
  subjectSafety: 0.2,
  photoQuality: 0.2,
  coverage: 0.15,
  chronology: 0.1,
  balance: 0.1,
} as const

/** 페이지당 사진 수 표준편차를 이 값으로 정규화 */
const BALANCE_STDEV_CEILING = 3

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))

const mean = (values: readonly number[]): number =>
  values.length === 0 ? 1 : values.reduce((sum, value) => sum + value, 0) / values.length

interface CropWindow {
  /** 보이는 구간의 시작점과 폭 (0-1) */
  start: number
  size: number
}

/** photoX/photoY와 종횡비로부터 실제로 보이는 구간을 구한다 */
function cropWindow(imageRatio: number, frameRatio: number, positionPercent: number, axis: "x" | "y"): CropWindow {
  const cropsHorizontally = imageRatio > frameRatio
  const cropsThisAxis = axis === "x" ? cropsHorizontally : !cropsHorizontally

  if (!cropsThisAxis) return { start: 0, size: 1 }

  const size = clamp01(axis === "x" ? frameRatio / imageRatio : imageRatio / frameRatio)
  const slack = 1 - size
  const start = clamp01((positionPercent / 100) * slack)
  return { start, size }
}

/** 피사체가 프레임 중앙에 가까우면 1, 잘려나가면 0 */
function subjectSafety(photo: ScoringPhoto, layout: PhotoLayout, frameRatio: number): number {
  if (!photo.subject) return 1

  const imageRatio = photo.width / photo.height
  const axes: Array<{ axis: "x" | "y"; position: number; target: number }> = [
    { axis: "x", position: layout.photoX ?? 50, target: photo.subject.x / 100 },
    { axis: "y", position: layout.photoY ?? 50, target: photo.subject.y / 100 },
  ]

  const margins = axes.map(({ axis, position, target }) => {
    const window = cropWindow(imageRatio, frameRatio, position, axis)
    if (window.size <= 0) return 0
    const distanceToEdge = Math.min(target - window.start, window.start + window.size - target)
    return clamp01(distanceToEdge / (window.size / 2))
  })

  return Math.min(...margins)
}

function standardDeviation(values: readonly number[]): number {
  if (values.length <= 1) return 0
  const average = mean(values)
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

export function scoreAlbum(album: Album, photos: readonly ScoringPhoto[]): VariantScore {
  const photoById = new Map(photos.map((photo) => [photo.id, photo]))
  const page = pageSizeMm(album.orientation)

  const framingScores: number[] = []
  const safetyScores: number[] = []
  const qualityScores: number[] = []
  const coverageScores: number[] = []
  const placedTimes: number[] = []
  const photosPerPage: number[] = []

  for (const albumPage of album.pages) {
    let placedOnPage = 0
    let coveredArea = 0

    for (const layout of albumPage.layouts) {
      const photo = photoById.get(layout.photoId)
      if (!photo || photo.width <= 0 || photo.height <= 0) continue

      placedOnPage += 1
      coveredArea += (layout.width / 100) * (layout.height / 100)
      const frameRatio = ((layout.width / 100) * page.width) / ((layout.height / 100) * page.height)
      const imageRatio = photo.width / photo.height

      framingScores.push(visibleRatio(imageRatio, frameRatio))
      safetyScores.push(subjectSafety(photo, layout, frameRatio))
      qualityScores.push(photo.score)
      if (photo.takenAt) placedTimes.push(Date.parse(photo.takenAt))
    }

    if (!albumPage.isCoverPage) {
      photosPerPage.push(placedOnPage)
      coverageScores.push(clamp01(coveredArea))
    }
  }

  const framing = mean(framingScores)
  const safety = mean(safetyScores)
  const quality = mean(qualityScores)
  const coverage = mean(coverageScores)

  let ordered = 0
  for (let i = 1; i < placedTimes.length; i++) {
    if (placedTimes[i] >= placedTimes[i - 1]) ordered += 1
  }
  const chronology = placedTimes.length <= 1 ? 1 : ordered / (placedTimes.length - 1)

  const balance = clamp01(1 - standardDeviation(photosPerPage) / BALANCE_STDEV_CEILING)

  const total = clamp01(
    framing * WEIGHTS.framing +
      safety * WEIGHTS.subjectSafety +
      quality * WEIGHTS.photoQuality +
      coverage * WEIGHTS.coverage +
      chronology * WEIGHTS.chronology +
      balance * WEIGHTS.balance,
  )

  return { total, framing, subjectSafety: safety, photoQuality: quality, coverage, chronology, balance }
}
