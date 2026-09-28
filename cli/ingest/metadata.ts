// 파일에서 EXIF 촬영일/GPS와 실제 표시 크기를 읽어온다
import exifr from "exifr"
import sharp from "sharp"
import type { GpsCoords, TimeSource } from "@/cli/types"

/** EXIF orientation 5-8은 가로/세로가 뒤바뀐 상태로 저장돼 있다 */
const SWAPPED_ORIENTATIONS = new Set([5, 6, 7, 8])

const KAKAO_GEOCODE_URL = "https://dapi.kakao.com/v2/local/geo/coord2address.json"
/** 같은 장소를 반복 조회하지 않도록 좌표를 이 자리수까지 반올림해 캐시 */
const GEOCODE_PRECISION = 3

export interface FileMetadata {
  width: number
  height: number
  date?: string
  takenAt?: string
  timeSource: TimeSource
  gps?: GpsCoords
}

/**
 * 파일명 속 촬영 시각. 예) IMG_20240512_143012, PXL_20240512_143012345, KakaoTalk_20240512_143012…,
 * 20240512_143012, Screenshot_2024-05-12-14-30-12, photo_2024-05-12 14.30.12
 */
const FILENAME_TIMESTAMP =
  /(?<!\d)(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})[ _T-]?(\d{2})[-_.:]?(\d{2})(?:[-_.:]?(\d{2}))?/

/** 파일명에서 촬영 시각(로컬 시간)을 읽는다. 형식이 아니거나 범위를 벗어나면 undefined */
export function parseFilenameTimestamp(fileName: string): Date | undefined {
  const match = FILENAME_TIMESTAMP.exec(fileName)
  if (!match) return undefined

  const [year, month, day, hour, minute] = match.slice(1, 6).map(Number)
  const second = match[6] ? Number(match[6]) : 0
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined
  if (hour > 23 || minute > 59 || second > 59) return undefined

  const date = new Date(year, month - 1, day, hour, minute, second)
  // 2월 30일처럼 넘어간 날짜는 거른다
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return undefined
  return date
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}.${month}.${day}`
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime())
}

/**
 * 촬영 시각과 그 출처를 정한다: EXIF 촬영 시각 → 파일명 → EXIF 수정 시각 → 파일 mtime.
 * mtime은 OneDrive 동기화/다운로드 시각일 수 있어 "mtime"으로 표시해 그룹 경계 근거에서 뺀다.
 */
function resolveTakenAt(
  exif: Record<string, unknown> | null,
  fileName: string,
  fallbackDate: Date,
): { date: Date; timeSource: TimeSource } {
  const captured = [exif?.DateTimeOriginal, exif?.CreateDate, exif?.DateTimeDigitized].find(isValidDate)
  if (captured) return { date: captured, timeSource: "exif" }

  const fromName = parseFilenameTimestamp(fileName)
  if (fromName) return { date: fromName, timeSource: "filename" }

  if (isValidDate(exif?.ModifyDate)) return { date: exif.ModifyDate, timeSource: "exif" }

  return { date: fallbackDate, timeSource: "mtime" }
}

/**
 * 렌더링 시점에 보이는 크기(EXIF 회전 적용 후)와 촬영 정보를 읽는다.
 * 브라우저가 EXIF orientation을 자동 적용하므로 CLI도 같은 기준을 써야 레이아웃이 어긋나지 않는다.
 */
export async function readFileMetadata(filePath: string, fileName: string, fallbackDate: Date): Promise<FileMetadata> {
  const metadata = await sharp(filePath).metadata()
  const storedWidth = metadata.width ?? 0
  const storedHeight = metadata.height ?? 0
  const swapped = metadata.orientation ? SWAPPED_ORIENTATIONS.has(metadata.orientation) : false

  const exif = await exifr
    .parse(filePath, { tiff: true, exif: true, gps: true })
    .catch(() => null)

  const { date, timeSource } = resolveTakenAt(exif, fileName, fallbackDate)
  const hasGps = typeof exif?.latitude === "number" && typeof exif?.longitude === "number"

  return {
    width: swapped ? storedHeight : storedWidth,
    height: swapped ? storedWidth : storedHeight,
    date: formatDate(date),
    takenAt: date.toISOString(),
    timeSource,
    gps: hasGps ? { lat: exif.latitude, lon: exif.longitude } : undefined,
  }
}

/** v1 매니페스트(출처 없음)의 촬영 시각이 mtime보다 이만큼 이르면 EXIF로 본다 */
const EXIF_AGREEMENT_MS = 2 * 60 * 1000

/**
 * 출처가 기록되지 않은(v1) 사진의 촬영 시각 출처를 파일 I/O 없이 추정한다.
 * - GPS가 있으면 EXIF를 읽을 수 있었던 사진 → exif
 * - 파일명 시각이 있고 기록된 시각이 그보다 늦지 않으면 → exif (mtime은 파일 생성보다 이를 수 없다)
 * - 기록된 시각이 파일명보다 늦으면 mtime이었을 가능성이 커서 파일명 시각으로 바꾼다
 */
export function deriveTimeSource(photo: {
  fileName: string
  takenAt?: string
  gps?: GpsCoords
}): { takenAt?: string; date?: string; timeSource: TimeSource } {
  if (photo.gps && photo.takenAt) return { takenAt: photo.takenAt, timeSource: "exif" }

  const fromName = parseFilenameTimestamp(photo.fileName)
  if (!fromName) return { takenAt: photo.takenAt, timeSource: "unknown" }

  const recorded = photo.takenAt ? Date.parse(photo.takenAt) : Number.NaN
  if (Number.isFinite(recorded) && recorded <= fromName.getTime() + EXIF_AGREEMENT_MS) {
    return { takenAt: photo.takenAt, timeSource: "exif" }
  }
  return { takenAt: fromName.toISOString(), date: formatDate(fromName), timeSource: "filename" }
}

const geocodeCache = new Map<string, string | undefined>()

/**
 * 카카오 로컬 API로 좌표를 주소로 바꾼다 (웹 앱과 동일한 엔드포인트).
 * 키가 없거나 실패하면 undefined — 위치 표기 없이 진행한다.
 */
export async function reverseGeocode(gps: GpsCoords, apiKey?: string): Promise<string | undefined> {
  if (!apiKey) return undefined

  const cacheKey = `${gps.lat.toFixed(GEOCODE_PRECISION)},${gps.lon.toFixed(GEOCODE_PRECISION)}`
  const cached = geocodeCache.get(cacheKey)
  if (geocodeCache.has(cacheKey)) return cached

  try {
    const url = `${KAKAO_GEOCODE_URL}?x=${gps.lon}&y=${gps.lat}&input_coord=WGS84`
    const response = await fetch(url, { headers: { Authorization: `KakaoAK ${apiKey}` } })
    if (!response.ok) {
      geocodeCache.set(cacheKey, undefined)
      return undefined
    }

    const data = (await response.json()) as {
      documents?: Array<{
        address?: { region_1depth_name?: string; region_2depth_name?: string; region_3depth_name?: string }
        road_address?: { region_1depth_name?: string; region_2depth_name?: string }
      }>
    }

    const address = data.documents?.[0]?.address
    const parts = [address?.region_1depth_name, address?.region_2depth_name, address?.region_3depth_name].filter(
      (part): part is string => Boolean(part),
    )
    const location = parts.length > 0 ? parts.slice(0, 2).join(" ") : undefined

    geocodeCache.set(cacheKey, location)
    return location
  } catch {
    geocodeCache.set(cacheKey, undefined)
    return undefined
  }
}
