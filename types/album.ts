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
  photoScale?: number // 사진 확대 배율 (기본 1)
}

export interface AlbumPage {
  id: string
  layouts: PhotoLayout[]
  templateId?: string
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
