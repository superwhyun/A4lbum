// 사진 한 장의 기하 계산 — 피사체 영역, 허용 셀 비율 범위, 잘림 없는 크롭 위치
// 좌표는 모두 원본 이미지 대비 0-1 비율. pdf-export.ts / CSS object-position과 같은 크롭 수식을 쓴다.
import type { PhotoLayout } from "@/types/album"
import { A4_SIZE } from "@/types/album"
import type { Orientation, PageSize, PhotoSpec } from "@/lib/layout/types"

/** 피사체 상자에 더하는 여백 (상자 크기 대비 비율). 위쪽은 얼굴 위 여백을 위해 더 크게 */
export interface SubjectPadding {
  side: number
  top: number
  bottom: number
}

export const DEFAULT_SUBJECT_PADDING: SubjectPadding = { side: 0.1, top: 0.2, bottom: 0.1 }
export const NO_SUBJECT_PADDING: SubjectPadding = { side: 0, top: 0, bottom: 0 }

/** 피사체 정보가 없을 때 지켜야 할 가운데 영역 크기 (이미지 대비 0-1) */
export const DEFAULT_SAFE_BOX = 0.7

/** 세로 방향으로 잘릴 때 피사체 중심을 프레임 높이의 이 위치에 둔다 (얼굴 위 여백) */
export const HEADROOM_TARGET = 0.42

/** 허용 비율 범위를 원본 비율의 이 배수 안으로 제한한다 (무한대/0 방지) */
const MAX_STRETCH = 8

const CENTER_PERCENT = 50
const EPSILON = 1e-9

export interface GeometryOptions {
  padding?: SubjectPadding
  /** 피사체 정보가 없을 때 쓰는 가운데 안전 영역 크기. null이면 사진 전체를 잘라도 된다 */
  defaultBox?: number | null
}

export interface SubjectRect {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** 피사체를 자르지 않는 셀 종횡비(가로/세로) 범위. preferred는 원본 비율(잘림 0) */
export interface FeasibleRange {
  lo: number
  hi: number
  preferred: number
}

/** mm 단위 셀 */
export interface CellMm {
  x?: number
  y?: number
  width: number
  height: number
}

export type PhotoFit = "cover" | "contain"

export interface Placement {
  photoX: number
  photoY: number
  fit: PhotoFit
  /** 피사체 상자 중 잘려나간 비율 (0이면 온전) */
  subjectCut: number
}

export interface PlacementOptions extends GeometryOptions {
  fit?: PhotoFit
  /** subject: 피사체 기준 배치, center: 가운데 고정 */
  mode?: "subject" | "center"
}

/** 이미지에서 실제로 보이는 영역 (0-1) */
export type CropWindow = SubjectRect

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))
const clamp01 = (value: number): number => clamp(value, 0, 1)

/** A4 페이지의 mm 크기 */
export function pageSizeMm(orientation: Orientation): PageSize {
  return orientation === "portrait"
    ? { width: A4_SIZE.WIDTH, height: A4_SIZE.HEIGHT }
    : { width: A4_SIZE.HEIGHT, height: A4_SIZE.WIDTH }
}

export function imageRatio(photo: Pick<PhotoSpec, "width" | "height">): number {
  return photo.width > 0 && photo.height > 0 ? photo.width / photo.height : 1
}

/**
 * object-fit: cover 기준으로 실제 화면에 보이는 원본 비율.
 * 1이면 잘림 없음, 0.6이면 원본의 60%만 보인다는 뜻.
 */
export function visibleRatio(imageRatio: number, frameRatio: number): number {
  if (imageRatio <= 0 || frameRatio <= 0) return 1
  return Math.min(imageRatio, frameRatio) / Math.max(imageRatio, frameRatio)
}

/** 크기를 유지한 채 [0,1] 안으로 밀어 넣은 구간 */
function shiftedSpan(center: number, size: number): [number, number] {
  const start = clamp(center - size / 2, 0, 1 - size)
  return [start, start + size]
}

/**
 * 피사체 영역을 이미지 대비 0-1 사각형으로 만든다.
 * - 경계상자(w/h)가 있으면 이미지 밖으로 나간 부분을 잘라내고 여백을 더한다.
 * - 중심만 있으면(웹 얼굴 검출) 그 점을 포함하는 기본 안전 영역을 쓴다.
 * - 아무 정보가 없으면 가운데 기본 안전 영역을 쓴다.
 */
export function normalizeSubject(photo: PhotoSpec, options: GeometryOptions = {}): SubjectRect {
  const padding = options.padding ?? DEFAULT_SUBJECT_PADDING
  const defaultBox = options.defaultBox === undefined ? DEFAULT_SAFE_BOX : options.defaultBox
  const subject = photo.subject

  if (subject && Number.isFinite(subject.x) && Number.isFinite(subject.y)) {
    const cx = clamp01(subject.x / 100)
    const cy = clamp01(subject.y / 100)

    if (subject.w && subject.h && subject.w > 0 && subject.h > 0) {
      const x0 = clamp01(cx - subject.w / 200)
      const x1 = clamp01(cx + subject.w / 200)
      const y0 = clamp01(cy - subject.h / 200)
      const y1 = clamp01(cy + subject.h / 200)
      const boxW = x1 - x0
      const boxH = y1 - y0
      return {
        x0: clamp01(x0 - padding.side * boxW),
        x1: clamp01(x1 + padding.side * boxW),
        y0: clamp01(y0 - padding.top * boxH),
        y1: clamp01(y1 + padding.bottom * boxH),
      }
    }

    const size = clamp01(defaultBox ?? 0)
    const [x0, x1] = shiftedSpan(cx, size)
    const [y0, y1] = shiftedSpan(cy, size)
    return { x0, y0, x1, y1 }
  }

  const size = clamp01(defaultBox ?? 0)
  const [x0, x1] = shiftedSpan(0.5, size)
  const [y0, y1] = shiftedSpan(0.5, size)
  return { x0, y0, x1, y1 }
}

/** 피사체 영역을 자르지 않는 셀 비율 범위: [r·sw, r/sh] */
export function feasibleRange(photo: PhotoSpec, options: GeometryOptions = {}): FeasibleRange {
  const r = imageRatio(photo)
  const rect = normalizeSubject(photo, options)
  const sw = rect.x1 - rect.x0
  const sh = rect.y1 - rect.y0
  const lo = Math.max(r * sw, r / MAX_STRETCH)
  const hi = sh > EPSILON ? Math.min(r / sh, r * MAX_STRETCH) : r * MAX_STRETCH
  return { lo: Math.min(lo, r), hi: Math.max(hi, r), preferred: r }
}

export function isRatioFeasible(range: FeasibleRange, ratio: number, tolerance = 1e-6): boolean {
  return ratio >= range.lo * (1 - tolerance) && ratio <= range.hi * (1 + tolerance)
}

/** 페이지 % 단위 레이아웃의 실제(mm 기준) 종횡비 */
export function cellRatio(layout: Pick<PhotoLayout, "width" | "height">, pageMm: PageSize): number {
  return ((layout.width / 100) * pageMm.width) / ((layout.height / 100) * pageMm.height)
}

/** photoX/photoY와 종횡비로부터 원본에서 보이는 영역을 구한다 (object-position 수식) */
export function cropWindow(
  imgRatio: number,
  frameRatio: number,
  photoX: number = CENTER_PERCENT,
  photoY: number = CENTER_PERCENT,
  fit: PhotoFit = "cover",
): CropWindow {
  if (fit === "contain" || imgRatio <= 0 || frameRatio <= 0) return { x0: 0, y0: 0, x1: 1, y1: 1 }

  if (imgRatio > frameRatio) {
    const size = frameRatio / imgRatio
    const start = clamp01(photoX / 100) * (1 - size)
    return { x0: start, x1: start + size, y0: 0, y1: 1 }
  }

  const size = imgRatio / frameRatio
  const start = clamp01(photoY / 100) * (1 - size)
  return { x0: 0, x1: 1, y0: start, y1: start + size }
}

/** 한 축에서 [a0,a1]이 [w0,w1]에 얼마나 들어있는지. 길이 0이면 점 포함 여부 */
function axisOverlap(a0: number, a1: number, w0: number, w1: number): number {
  const length = a1 - a0
  if (length <= EPSILON) return a0 >= w0 - 1e-6 && a0 <= w1 + 1e-6 ? 1 : 0
  return clamp01((Math.min(a1, w1) - Math.max(a0, w0)) / length)
}

/** 피사체 영역 중 크롭 창 안에 남는 비율 (0-1) */
export function visibleSubjectFraction(rect: SubjectRect, window: CropWindow): number {
  return axisOverlap(rect.x0, rect.x1, window.x0, window.x1) * axisOverlap(rect.y0, rect.y1, window.y0, window.y1)
}

/**
 * 한 축의 크롭 창 시작점을 정해 object-position(%)으로 돌려준다.
 * 창(폭 v)이 피사체 [a0,a1]을 포함하는 범위 안에서, 피사체 중심이 창의 target 위치에 오도록 한다.
 */
function axisPosition(a0: number, a1: number, size: number, target: number): number {
  const slack = 1 - size
  if (slack <= EPSILON) return CENTER_PERCENT

  const desired = (a0 + a1) / 2 - target * size
  const lower = Math.max(0, a1 - size)
  const upper = Math.min(a0, slack)
  const start = lower <= upper + EPSILON ? clamp(desired, lower, Math.max(lower, upper)) : clamp(desired, 0, slack)
  return (clamp(start, 0, slack) / slack) * 100
}

/**
 * 셀(mm)에 사진을 넣을 때 피사체 상자가 잘리지 않는 photoX/photoY를 구한다.
 * 창은 항상 최대 크기 cover 창이므로 렌더러(pdf-export, object-fit: cover)는 그대로 쓴다.
 */
export function placePhoto(cell: CellMm, photo: PhotoSpec, options: PlacementOptions = {}): Placement {
  const fit = options.fit ?? "cover"
  const r = imageRatio(photo)
  const c = cell.height > 0 ? cell.width / cell.height : 0

  if (fit === "contain" || !(c > 0)) {
    return { photoX: CENTER_PERCENT, photoY: CENTER_PERCENT, fit, subjectCut: 0 }
  }

  const rect = normalizeSubject(photo, options)
  let photoX = CENTER_PERCENT
  let photoY = CENTER_PERCENT

  if (options.mode !== "center") {
    if (r > c) photoX = axisPosition(rect.x0, rect.x1, c / r, 0.5)
    else if (r < c) photoY = axisPosition(rect.y0, rect.y1, r / c, HEADROOM_TARGET)
  }

  const cut = 1 - visibleSubjectFraction(rect, cropWindow(r, c, photoX, photoY))
  return { photoX, photoY, fit, subjectCut: cut < 1e-6 ? 0 : cut }
}
