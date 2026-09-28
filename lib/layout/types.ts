// 레이아웃 엔진이 공유하는 타입 (브라우저/Node API 비의존 — 웹과 CLI가 공유)

export type Orientation = "portrait" | "landscape"

/** 촬영 시각의 출처. mtime은 동기화/다운로드 시각일 수 있어 그룹 경계 근거로 쓰지 않는다 */
export type TimeSource = "exif" | "filename" | "mtime" | "unknown"

/** 피사체 경계상자. 중심(x, y)과 크기(w, h) 모두 원본 이미지 크기 대비 0-100% */
export interface SubjectBox {
  x: number
  y: number
  w?: number
  h?: number
}

/** 레이아웃 계산에 필요한 사진 정보의 최소 형태 */
export interface PhotoSpec {
  id: string
  /** EXIF 회전 적용 후 표시 크기 */
  width: number
  height: number
  /** 표시용 날짜 (YYYY.MM.DD) */
  date?: string
  /** 정렬/그룹용 촬영 시각 (epoch ms) */
  takenAt?: number
  timeSource?: TimeSource
  gps?: { lat: number; lon: number }
  /** 주소 문자열. GPS가 없을 때(웹) 약한 그룹 근거로 쓴다 */
  location?: string
  subject?: SubjectBox
  /** 판정 점수 0-1. 표지 선택과 동점 처리에 쓴다 */
  score?: number
}

/** 0 이상 1 미만 난수 생성기 */
export type Rng = () => number

export interface PageSize {
  width: number
  height: number
}
