// 파일에서 EXIF 촬영일/GPS와 실제 표시 크기를 읽어온다
import exifr from "exifr"
import sharp from "sharp"
import type { GpsCoords } from "@/cli/types"

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
  gps?: GpsCoords
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
 * 렌더링 시점에 보이는 크기(EXIF 회전 적용 후)와 촬영 정보를 읽는다.
 * 브라우저가 EXIF orientation을 자동 적용하므로 CLI도 같은 기준을 써야 레이아웃이 어긋나지 않는다.
 */
export async function readFileMetadata(filePath: string, fallbackDate: Date): Promise<FileMetadata> {
  const metadata = await sharp(filePath).metadata()
  const storedWidth = metadata.width ?? 0
  const storedHeight = metadata.height ?? 0
  const swapped = metadata.orientation ? SWAPPED_ORIENTATIONS.has(metadata.orientation) : false

  const exif = await exifr
    .parse(filePath, { tiff: true, exif: true, gps: true })
    .catch(() => null)

  const taken = [exif?.DateTimeOriginal, exif?.CreateDate, exif?.DateTimeDigitized, exif?.ModifyDate].find(
    isValidDate,
  )
  const effectiveDate = taken ?? fallbackDate

  const hasGps = typeof exif?.latitude === "number" && typeof exif?.longitude === "number"

  return {
    width: swapped ? storedHeight : storedWidth,
    height: swapped ? storedWidth : storedHeight,
    date: formatDate(effectiveDate),
    takenAt: effectiveDate.toISOString(),
    gps: hasGps ? { lat: exif.latitude, lon: exif.longitude } : undefined,
  }
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
