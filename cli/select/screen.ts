// 판정 결과로 앨범에 넣을 사진을 고른다 (컷오프 → 유사컷 제거 → 정렬 → 상한)
import { hammingDistance } from "@/cli/ingest/quality"
import type { Judgement, ScannedPhoto } from "@/cli/types"

export interface SelectedPhoto {
  photo: ScannedPhoto
  judgement: Judgement
}

export interface RejectedPhoto {
  photo: ScannedPhoto
  reason: string
}

export interface ScreenOptions {
  /** 이 점수 미만은 탈락 */
  minScore?: number
  /** dHash 거리가 이 값 이하면 같은 장면으로 본다 (0이면 유사컷 제거 끔) */
  duplicateDistance?: number
  /** 앨범에 넣을 최대 장수 */
  maxPhotos?: number
}

export interface ScreenResult {
  kept: SelectedPhoto[]
  rejected: RejectedPhoto[]
}

const DEFAULT_MIN_SCORE = 0.42
const DEFAULT_DUPLICATE_DISTANCE = 8

function toTime(photo: ScannedPhoto): number {
  return photo.takenAt ? Date.parse(photo.takenAt) : Number.MAX_SAFE_INTEGER
}

function byTime(a: SelectedPhoto, b: SelectedPhoto): number {
  const diff = toTime(a.photo) - toTime(b.photo)
  return diff !== 0 ? diff : a.photo.fileName.localeCompare(b.photo.fileName)
}

/** 판정에 빠진 사진은 화질 점수로 메운다 — 외부 판정이 일부만 와도 동작해야 한다 */
function resolveJudgement(photo: ScannedPhoto, judgements: Map<string, Judgement>): Judgement {
  const given = judgements.get(photo.id)
  if (given) return given

  return {
    id: photo.id,
    keep: true,
    score: photo.quality.score,
    source: "heuristic-default",
    reason: "판정 결과 없음 — 화질 점수로 대체",
  }
}

export function screenPhotos(
  photos: readonly ScannedPhoto[],
  judgementList: readonly Judgement[],
  options: ScreenOptions = {},
): ScreenResult {
  const {
    minScore = DEFAULT_MIN_SCORE,
    duplicateDistance = DEFAULT_DUPLICATE_DISTANCE,
    maxPhotos,
  } = options

  const judgements = new Map(judgementList.map((item) => [item.id, item]))
  const rejected: RejectedPhoto[] = []
  const survivors: SelectedPhoto[] = []

  for (const photo of photos) {
    const judgement = resolveJudgement(photo, judgements)

    if (!judgement.keep) {
      rejected.push({ photo, reason: judgement.reason ? `비전 탈락: ${judgement.reason}` : "비전 탈락" })
      continue
    }

    if (judgement.score < minScore) {
      rejected.push({ photo, reason: `점수 미달 (${judgement.score.toFixed(2)} < ${minScore})` })
      continue
    }

    survivors.push({ photo, judgement })
  }

  const deduped = duplicateDistance > 0 ? removeNearDuplicates(survivors, duplicateDistance, rejected) : survivors

  const ordered = [...deduped].sort(byTime)
  if (maxPhotos === undefined || ordered.length <= maxPhotos) {
    return { kept: ordered, rejected }
  }

  // 상한을 넘으면 점수 높은 것부터 남기고, 다시 시간순으로 되돌린다
  const ranked = [...ordered].sort((a, b) => b.judgement.score - a.judgement.score)
  const kept = ranked.slice(0, maxPhotos)
  const dropped = ranked.slice(maxPhotos)

  for (const item of dropped) {
    rejected.push({ photo: item.photo, reason: `장수 상한(${maxPhotos}) 초과` })
  }

  return { kept: kept.sort(byTime), rejected }
}

/** 시간순으로 훑으면서 비슷한 장면이 연달아 나오면 점수가 가장 높은 한 장만 남긴다 */
function removeNearDuplicates(
  items: readonly SelectedPhoto[],
  maxDistance: number,
  rejected: RejectedPhoto[],
): SelectedPhoto[] {
  const ordered = [...items].sort(byTime)
  const groups: SelectedPhoto[][] = []

  for (const item of ordered) {
    const group = groups.find((candidate) =>
      candidate.some((member) => hammingDistance(member.photo.hash, item.photo.hash) <= maxDistance),
    )
    if (group) {
      group.push(item)
    } else {
      groups.push([item])
    }
  }

  const kept: SelectedPhoto[] = []
  for (const group of groups) {
    const best = group.reduce((prev, current) => (current.judgement.score > prev.judgement.score ? current : prev))
    kept.push(best)

    for (const item of group) {
      if (item !== best) {
        rejected.push({ photo: item.photo, reason: `유사컷 (${best.photo.fileName} 선택)` })
      }
    }
  }

  return kept
}
