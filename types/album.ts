export interface Photo {
  id: string
  /** 브라우저에서 업로드된 원본 파일. CLI 렌더링 경로에서는 없음 */
  file?: File
  url: string
  width: number
  height: number
  thumbnailUrl?: string
  date?: string;
  location?: string;
  /** CLI 경로에서 원본 이미지의 로컬 파일 경로 */
  path?: string;
}

export interface PhotoLayout {
  id: string
  x: number
  y: number
  width: number
  height: number
  photoId: string
  photoX?: number // 사진의 X 위치 (0-100%)
  photoY?: number // 사진의 Y 위치 (0-100%)
  /** 예약 필드 — 어떤 렌더러도 아직 구현하지 않으며 자동 배치도 설정하지 않는다 */
  photoScale?: number
  /** cover(기본): 프레임을 꽉 채우고 넘치는 부분을 자름. contain: 자르지 않고 테마 배경 위에 레터박스 */
  fit?: "cover" | "contain"
}

export interface AlbumPage {
  id: string
  layouts: PhotoLayout[]
  templateId?: string
  /** 이 페이지 사진들이 속한 그룹(시간/장소 묶음) id */
  groupIds?: string[]
  /** 그룹 캡션 (예: "2024.05.12 · 제주 서귀포") */
  caption?: string
  /** 앞 페이지에서 이어지는 그룹이면 true */
  continued?: boolean
  isCoverPage?: boolean
  title?: string
  titlePosition?: { x: number; y: number }
  titleStyle?: {
    fontSize?: number;
    color?: string;
    fontFamily?: string;
  }
}

export interface Album {
  id: string
  pages: AlbumPage[]
  theme: string
  orientation: "portrait" | "landscape"
  showMetadata?: boolean
}

export interface LayoutTemplate {
  id: string
  name: string
  photoCount: number
  layouts: Omit<PhotoLayout, "photoId">[]
  orientation: "portrait" | "landscape"
  metadataTextColor?: string;
  metadataTextSize?: string;
}

export const THEMES = [
  "classic",
  "modern",
  "vintage",
  "minimal",
  "colorful",
  "elegant",
  "rustic",
  "artistic",
  "nature",
  "urban",
  "black",
] as const

export type Theme = (typeof THEMES)[number]

export type AlbumDensity = "sparse" | "medium" | "dense"

// A4 크기 상수 (mm 단위)
export const A4_SIZE = {
  WIDTH: 210,
  HEIGHT: 297,
  MARGIN: 10, // 여백 10mm
} as const
