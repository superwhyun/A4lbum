// sharp 기반 결정론적 화질 지표 + 유사컷 해시
import sharp from "sharp"
import type { QualityMetrics } from "@/cli/types"

/** 지표 계산용 축소 크기 — 원본 해상도에 따라 점수가 흔들리지 않게 고정한다 */
const ANALYSIS_WIDTH = 1024
const LUMA_SAMPLE = 128
/** dHash 격자 (9x8 → 가로 인접 비교로 64bit) */
const HASH_WIDTH = 9
const HASH_HEIGHT = 8

/** sharp sharpness 값이 이 정도면 충분히 선명하다고 본다 */
const SHARPNESS_CEILING = 6
/**
 * 인쇄용 앨범에서 흐린 사진은 다른 지표가 좋아도 쓸 수 없다.
 * 정규화된 선명도가 이 값에 못 미치면 총점을 비례해 끌어내린다.
 */
const SHARPNESS_GATE = 0.2
/** 그레이스케일 평균이 이 값에 가까울 때 노출이 가장 좋다 */
const IDEAL_LUMA = 125
const LUMA_TOLERANCE = 90
/** 완전히 뭉개진/날아간 픽셀 비율이 이 이상이면 노출 점수를 크게 깎는다 */
const CLIP_PENALTY_WEIGHT = 2.5
const CONTRAST_CEILING = 70
const ENTROPY_CEILING = 7

const WEIGHTS = {
  sharpness: 0.45,
  exposure: 0.3,
  contrast: 0.15,
  entropy: 0.1,
} as const

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))

interface LumaSummary {
  mean: number
  stdev: number
  clipped: number
}

function summarizeLuma(buffer: Buffer): LumaSummary {
  if (buffer.length === 0) return { mean: 0, stdev: 0, clipped: 1 }

  let sum = 0
  let squares = 0
  let clipped = 0

  for (const value of buffer) {
    sum += value
    squares += value * value
    if (value <= 2 || value >= 253) clipped += 1
  }

  const mean = sum / buffer.length
  const variance = Math.max(0, squares / buffer.length - mean * mean)
  return { mean, stdev: Math.sqrt(variance), clipped: clipped / buffer.length }
}

/** 가로로 인접한 픽셀의 명암 비교로 difference hash를 만든다 */
function toDifferenceHash(buffer: Buffer): string {
  const bits: number[] = []
  for (let y = 0; y < HASH_HEIGHT; y++) {
    for (let x = 0; x < HASH_WIDTH - 1; x++) {
      const left = buffer[y * HASH_WIDTH + x] ?? 0
      const right = buffer[y * HASH_WIDTH + x + 1] ?? 0
      bits.push(left > right ? 1 : 0)
    }
  }

  let hex = ""
  for (let i = 0; i < bits.length; i += 4) {
    const nibble = (bits[i] << 3) | (bits[i + 1] << 2) | (bits[i + 2] << 1) | bits[i + 3]
    hex += nibble.toString(16)
  }
  return hex
}

/** 두 해시가 얼마나 다른지 (0이면 동일) */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Number.MAX_SAFE_INTEGER

  let distance = 0
  for (let i = 0; i < a.length; i++) {
    let diff = parseInt(a[i], 16) ^ parseInt(b[i], 16)
    while (diff > 0) {
      distance += diff & 1
      diff >>= 1
    }
  }
  return distance
}

export interface QualityResult {
  quality: QualityMetrics
  hash: string
}

/** 사진 한 장의 화질 지표와 유사컷 해시를 계산한다 */
export async function analyzePhoto(filePath: string): Promise<QualityResult> {
  const analysis = sharp(filePath).rotate()
  const analysisBuffer = await analysis
    .resize(ANALYSIS_WIDTH, ANALYSIS_WIDTH, { fit: "inside", withoutEnlargement: true })
    .toBuffer()

  const [stats, lumaBuffer, hashBuffer] = await Promise.all([
    sharp(analysisBuffer).stats(),
    sharp(analysisBuffer)
      .greyscale()
      .resize(LUMA_SAMPLE, LUMA_SAMPLE, { fit: "inside" })
      .raw()
      .toBuffer(),
    sharp(analysisBuffer)
      .greyscale()
      .resize(HASH_WIDTH, HASH_HEIGHT, { fit: "fill" })
      .raw()
      .toBuffer(),
  ])

  const luma = summarizeLuma(lumaBuffer)

  const sharpness = clamp01(stats.sharpness / SHARPNESS_CEILING)
  const exposureFit = clamp01(1 - Math.abs(luma.mean - IDEAL_LUMA) / LUMA_TOLERANCE)
  const exposure = clamp01(exposureFit - luma.clipped * CLIP_PENALTY_WEIGHT)
  const contrast = clamp01(luma.stdev / CONTRAST_CEILING)
  const entropy = clamp01(stats.entropy / ENTROPY_CEILING)

  const weighted =
    sharpness * WEIGHTS.sharpness +
    exposure * WEIGHTS.exposure +
    contrast * WEIGHTS.contrast +
    entropy * WEIGHTS.entropy

  // 흐린 사진은 다른 지표로 만회하지 못하게 총점을 깎는다
  const sharpnessGate = Math.min(1, sharpness / SHARPNESS_GATE)
  const score = clamp01(weighted * sharpnessGate)

  return {
    quality: { sharpness, exposure, contrast, entropy, score },
    hash: toDifferenceHash(hashBuffer),
  }
}
