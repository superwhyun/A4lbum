// 시간/장소로 사진을 묶는다 — 시간순으로 놓인 이웃 사이에서만 자르므로 그룹은 항상 연속 구간이고 순서가 유지된다.
// Node/브라우저 API 비의존 (웹과 CLI가 공유)
import type { PhotoSpec } from "@/lib/layout/types"

export interface GroupingOptions {
  /** 이 거리(km) 넘게 움직이면 시간과 무관하게 새 그룹 */
  hardDistanceKm?: number
  /** 시간 간격이 soft 기준을 넘을 때, 이 거리(km) 넘게 움직였으면 새 그룹 */
  softDistanceKm?: number
  /** 이 간격(분)을 넘으면 새 그룹 */
  hardGapMinutes?: number
  /** 이 간격(분)을 넘고 장소도 바뀌었으면(또는 GPS가 없으면) 약한 경계 */
  softGapMinutes?: number
  /** 날짜가 바뀌고 이 간격(분)을 넘으면 새 그룹 */
  dayChangeGapMinutes?: number
  /** 이 시각 전까지는 전날로 본다 (새벽 촬영) */
  dayCutoffHour?: number
  /** 주소 문자열이 다르고 이 간격(분)을 넘으면 약한 경계 (GPS 없는 웹 경로) */
  locationGapMinutes?: number
  /** 1장짜리 그룹을 이웃 그룹에 붙일 수 있는 최대 간격(분) */
  mergeGapMinutes?: number
  /** 시간 정보를 믿을 수 없는 사진이 이 비율을 넘고 GPS도 없으면 시간순 모드 */
  unreliableShare?: number
}

export const DEFAULT_GROUPING: Required<GroupingOptions> = {
  hardDistanceKm: 5,
  softDistanceKm: 0.5,
  hardGapMinutes: 180,
  softGapMinutes: 45,
  dayChangeGapMinutes: 60,
  dayCutoffHour: 4,
  locationGapMinutes: 20,
  mergeGapMinutes: 360,
  unreliableShare: 0.5,
}

/** hard: 거의 항상 페이지를 나눔 / soft: 가능하면 나눔 / unknown: 근거 없음 / none: 같은 그룹 */
export type BoundaryKind = "hard" | "soft" | "unknown" | "none"

/** photos[index]와 photos[index + 1] 사이의 경계 */
export interface Boundary {
  index: number
  kind: BoundaryKind
  gapMinutes?: number
  distanceKm?: number
  reason: string
  /** 1장짜리 그룹을 붙이느라 지운 경계 */
  merged?: boolean
}

export interface PhotoGroup {
  id: string
  photoIds: string[]
  /** 첫/마지막 사진 촬영 시각 (epoch ms) */
  start?: number
  end?: number
  centroid?: { lat: number; lon: number }
  /** 그룹에서 가장 많이 나온 주소 */
  location?: string
  /** 이 그룹 뒤 경계 (마지막 그룹은 none) */
  boundaryAfter: BoundaryKind
}

export interface GroupingResult {
  groups: PhotoGroup[]
  boundaries: Boundary[]
  /** chronological: 시간 정보가 부족해 경계를 모두 unknown으로 둔 경우 */
  mode: "grouped" | "chronological"
}

const EARTH_RADIUS_KM = 6371
const MS_PER_MINUTE = 60_000
const MS_PER_HOUR = 3_600_000

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180

/** 두 좌표 사이 대원 거리 (km) */
export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = toRadians(b.lat - a.lat)
  const dLon = toRadians(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** 경계 판단에 쓸 수 있는 촬영 시각인가 (mtime은 동기화 시각일 수 있다) */
function hasReliableTime(photo: PhotoSpec): boolean {
  return Number.isFinite(photo.takenAt) && photo.timeSource !== "mtime"
}

/** 그룹 모드 판단용: 출처를 모르는 시각도 믿지 않는다 */
function isTimeUntrusted(photo: PhotoSpec): boolean {
  return !Number.isFinite(photo.takenAt) || photo.timeSource === "mtime" || photo.timeSource === "unknown"
}

function localDayKey(epochMs: number, cutoffHour: number): string {
  const shifted = new Date(epochMs - cutoffHour * MS_PER_HOUR)
  return `${shifted.getFullYear()}-${shifted.getMonth()}-${shifted.getDate()}`
}

function resolveOptions(options: GroupingOptions = {}): Required<GroupingOptions> {
  const resolved = { ...DEFAULT_GROUPING }
  for (const [key, value] of Object.entries(options) as Array<[keyof GroupingOptions, number | undefined]>) {
    if (typeof value === "number" && Number.isFinite(value)) resolved[key] = value
  }
  return resolved
}

function classifyPair(a: PhotoSpec, b: PhotoSpec, index: number, opts: Required<GroupingOptions>): Boundary {
  const distanceKm = a.gps && b.gps ? haversineKm(a.gps, b.gps) : undefined

  if (distanceKm !== undefined && distanceKm > opts.hardDistanceKm) {
    return { index, kind: "hard", distanceKm, reason: "distance" }
  }
  if (!hasReliableTime(a) || !hasReliableTime(b)) {
    return { index, kind: "unknown", distanceKm, reason: "untrusted-time" }
  }

  const gapMinutes = Math.abs((b.takenAt as number) - (a.takenAt as number)) / MS_PER_MINUTE
  const base = { index, gapMinutes, distanceKm }

  const dayChanged =
    localDayKey(a.takenAt as number, opts.dayCutoffHour) !== localDayKey(b.takenAt as number, opts.dayCutoffHour)
  if (dayChanged && gapMinutes > opts.dayChangeGapMinutes) return { ...base, kind: "hard", reason: "day" }
  if (gapMinutes > opts.hardGapMinutes) return { ...base, kind: "hard", reason: "gap" }
  if (gapMinutes > opts.softGapMinutes && (distanceKm === undefined || distanceKm > opts.softDistanceKm)) {
    return { ...base, kind: "soft", reason: distanceKm === undefined ? "gap" : "gap+distance" }
  }
  if (a.location && b.location && a.location !== b.location && gapMinutes > opts.locationGapMinutes) {
    return { ...base, kind: "soft", reason: "location" }
  }
  return { ...base, kind: "none", reason: "same" }
}

/** 이웃한 사진 쌍마다 경계 종류를 판정한다 (길이 n-1) */
export function classifyBoundaries(photos: readonly PhotoSpec[], options?: GroupingOptions): Boundary[] {
  const opts = resolveOptions(options)
  return photos.slice(1).map((photo, i) => classifyPair(photos[i], photo, i, opts))
}

const splits = (kind: BoundaryKind): boolean => kind === "hard" || kind === "soft"

/** 1장짜리 그룹을 붙여도 되는 경계인가: 같은 날, 간격 제한 안, 멀리 이동하지 않음 */
function canMergeAcross(boundary: Boundary, photos: readonly PhotoSpec[], opts: Required<GroupingOptions>): boolean {
  if (boundary.gapMinutes === undefined || boundary.gapMinutes >= opts.mergeGapMinutes) return false
  if (boundary.distanceKm !== undefined && boundary.distanceKm >= opts.hardDistanceKm) return false
  const a = photos[boundary.index].takenAt as number
  const b = photos[boundary.index + 1].takenAt as number
  return localDayKey(a, opts.dayCutoffHour) === localDayKey(b, opts.dayCutoffHour)
}

function mostCommon(values: ReadonlyArray<string | undefined>): string | undefined {
  const counts = new Map<string, number>()
  for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1)
  let best: string | undefined
  let bestCount = 0
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value
      bestCount = count
    }
  }
  return best
}

function describeGroup(members: readonly PhotoSpec[], id: string, boundaryAfter: BoundaryKind): PhotoGroup {
  const times = members.map((photo) => photo.takenAt).filter((time): time is number => Number.isFinite(time))
  const located = members.filter((photo) => photo.gps)
  return {
    id,
    photoIds: members.map((photo) => photo.id),
    start: times.length > 0 ? Math.min(...times) : undefined,
    end: times.length > 0 ? Math.max(...times) : undefined,
    centroid:
      located.length > 0
        ? {
            lat: located.reduce((sum, photo) => sum + photo.gps!.lat, 0) / located.length,
            lon: located.reduce((sum, photo) => sum + photo.gps!.lon, 0) / located.length,
          }
        : undefined,
    location: mostCommon(members.map((photo) => photo.location)),
    boundaryAfter,
  }
}

/**
 * 시간순으로 놓인 사진을 그룹으로 나눈다.
 * 시간 정보를 믿을 수 없는 사진이 절반을 넘고 GPS도 없으면 경계를 모두 unknown으로 두고 한 그룹(시간순 모드)으로 돌려준다.
 */
export function groupPhotos(photos: readonly PhotoSpec[], options?: GroupingOptions): GroupingResult {
  const opts = resolveOptions(options)
  if (photos.length === 0) return { groups: [], boundaries: [], mode: "grouped" }

  const untrusted = photos.filter(isTimeUntrusted).length
  const anyGps = photos.some((photo) => photo.gps)
  if (untrusted / photos.length > opts.unreliableShare && !anyGps) {
    const boundaries = photos.slice(1).map((_, index): Boundary => ({ index, kind: "unknown", reason: "chronological" }))
    return { groups: [describeGroup(photos, "g1", "none")], boundaries, mode: "chronological" }
  }

  const boundaries = classifyBoundaries(photos, opts)

  // 경계로 나눈 구간 [start, end)
  const runs: Array<{ start: number; end: number }> = []
  let start = 0
  boundaries.forEach((boundary, i) => {
    if (splits(boundary.kind)) {
      runs.push({ start, end: i + 1 })
      start = i + 1
    }
  })
  runs.push({ start, end: photos.length })

  // 1장짜리 그룹은 간격이 더 짧은 이웃에 붙인다 (조건이 맞을 때만)
  for (let r = 0; r < runs.length; r++) {
    const run = runs[r]
    if (run.end - run.start !== 1) continue

    const before = r > 0 ? boundaries[run.start - 1] : undefined
    const after = r < runs.length - 1 ? boundaries[run.end - 1] : undefined
    const options = [
      before && canMergeAcross(before, photos, opts) ? { boundary: before, target: r - 1 } : undefined,
      after && canMergeAcross(after, photos, opts) ? { boundary: after, target: r + 1 } : undefined,
    ].filter((option): option is { boundary: Boundary; target: number } => option !== undefined)
    if (options.length === 0) continue

    const chosen = options.reduce((a, b) => ((a.boundary.gapMinutes ?? 0) <= (b.boundary.gapMinutes ?? 0) ? a : b))
    boundaries[chosen.boundary.index] = { ...chosen.boundary, kind: "none", merged: true }

    const target = runs[chosen.target]
    const merged = { start: Math.min(target.start, run.start), end: Math.max(target.end, run.end) }
    const low = Math.min(r, chosen.target)
    runs.splice(low, 2, merged)
    r = low
  }

  const groups = runs.map((run, i) =>
    describeGroup(
      photos.slice(run.start, run.end),
      `g${i + 1}`,
      i < runs.length - 1 ? boundaries[run.end - 1].kind : "none",
    ),
  )

  return { groups, boundaries, mode: "grouped" }
}
