export interface Photo {
  id: string
  file: File
  url: string
  width: number
  height: number
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
}

export interface AlbumPage {
  id: string
  layouts: PhotoLayout[]
  templateId?: string
}

export interface Album {
  id: string
  pages: AlbumPage[]
  theme: string
  orientation: "portrait" | "landscape"
}

export interface LayoutTemplate {
  id: string
  name: string
  photoCount: number
  layouts: Omit<PhotoLayout, "photoId">[]
  orientation: "portrait" | "landscape"
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
] as const

export type Theme = (typeof THEMES)[number]

// A4 크기 상수 (mm 단위)
export const A4_SIZE = {
  WIDTH: 210,
  HEIGHT: 297,
  MARGIN: 10, // 여백 10mm
} as const
