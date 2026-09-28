// CLI 파이프라인에서 단계 간에 주고받는 데이터 형태
import type { Album } from "@/types/album"
import type { TimeSource } from "@/lib/layout/types"
import type { PhotoGroup } from "@/lib/layout/grouping"
import type { PlanAlbumResult } from "@/lib/album-generator"

export type { TimeSource } from "@/lib/layout/types"

/** v2: 사진별 timeSource 추가. v1도 읽을 수 있다 (build 시 파일명으로 출처를 다시 추정) */
export const MANIFEST_VERSION = 2
export const SUPPORTED_MANIFEST_VERSIONS: readonly number[] = [1, 2]

/** sharp로 계산한 결정론적 화질 지표. 모두 0-1 정규화 */
export interface QualityMetrics {
  /** 선명도 (라플라시안 분산 기반) */
  sharpness: number
  /** 노출 적정도 — 너무 어둡거나 날아간 사진에서 낮아짐 */
  exposure: number
  /** 대비 */
  contrast: number
  /** 정보량 (단조로운 사진에서 낮아짐) */
  entropy: number
  /** 위 지표의 가중 합 */
  score: number
}

export interface GpsCoords {
  lat: number
  lon: number
}

/** scan 단계의 산출물 — 사진 1장 */
export interface ScannedPhoto {
  id: string
  path: string
  fileName: string
  width: number
  height: number
  bytes: number
  /** 웹과 동일한 표기 포맷 (YYYY.MM.DD) */
  date?: string
  /** 정렬용 ISO 타임스탬프 */
  takenAt?: string
  /** takenAt의 출처 (exif / filename / mtime / unknown). v1 매니페스트에는 없다 */
  timeSource?: TimeSource
  location?: string
  gps?: GpsCoords
  /** 유사컷 판정용 difference hash (64bit, 16자리 hex) */
  hash: string
  quality: QualityMetrics
}

/** scan 단계 전체 산출물 */
export interface ScanManifest {
  version: number
  sourceDir: string
  scannedAt: string
  photos: ScannedPhoto[]
}

/** 비전 AI(또는 휴리스틱)의 사진별 판정 */
export interface Judgement {
  id: string
  /** 앨범에 넣을지 여부 */
  keep: boolean
  /** 0-1. 후보 앨범 점수 계산에도 쓰인다 */
  score: number
  /** 주요 피사체 중심 좌표 (이미지 크기 대비 0-100%). w/h는 피사체 경계상자 크기로 사진 배치 시 비율 매칭에 쓰인다. */
  subject?: { x: number; y: number; w?: number; h?: number }
  reason?: string
  /** 판정 주체 (heuristic / file:<경로> / http:<모델> …) */
  source?: string
}

export interface JudgementFile {
  judgements: Judgement[]
}

/** 후보 앨범 1개와 그 평가 결과 */
export interface Variant {
  index: number
  seed: number
  album: Album
  score: VariantScore
  /** 시간/장소 그룹 (표지 사진 제외) */
  groups: PhotoGroup[]
  groupingMode: PlanAlbumResult["groupingMode"]
  /** 사진별 배치 결과 (디버깅용) */
  diagnostics: PlanAlbumResult["diagnostics"]
}

export interface VariantScore {
  /** 최종 점수 (높을수록 좋음) */
  total: number
  /** 원본이 잘려나가지 않은 정도 (표지 제외, 면적 가중) */
  framing: number
  /** 피사체 경계상자가 크롭 창 안에 남은 비율 (면적 가중). 1이 정상 */
  subjectSafety: number
  /** 배치된 사진들의 화질/비전 점수 평균 */
  photoQuality: number
  /** 콘텐츠 영역을 사진으로 채운 정도 */
  coverage: number
  /** 한 페이지가 한 그룹(시간/장소 묶음)의 사진만 담는 정도 */
  groupCohesion: number
  /** 여러 페이지로 나뉜 그룹이 연속된 페이지에 놓인 정도 */
  groupSplitOrder: number
  /** 촬영 시간 순서가 유지된 정도 */
  chronology: number
  /** 페이지별 사진 1장당 면적의 균형 */
  balance: number
}
