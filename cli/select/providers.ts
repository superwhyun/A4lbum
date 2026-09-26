// 사진 판정 주체(비전 AI)를 갈아끼울 수 있게 만든 provider 계층.
// hermes 같은 외부 에이전트는 heuristic으로 1차 선별된 결과를 받아
// 판정 JSON을 파일로 주거나, OpenAI 호환 비전 엔드포인트를 제공하면 된다.
import { readFile } from "node:fs/promises"
import sharp from "sharp"
import type { Judgement, JudgementFile, ScannedPhoto } from "@/cli/types"

export interface VisionProvider {
  name: string
  judge(photos: readonly ScannedPhoto[]): Promise<Judgement[]>
}

/** 휴리스틱 단독으로 쓸 때의 채택 기준 */
const HEURISTIC_KEEP_THRESHOLD = 0.42

/** 비전 요청에 보낼 이미지 크기 — 판정에는 충분하고 전송은 가볍게 */
const VISION_IMAGE_WIDTH = 768
const VISION_JPEG_QUALITY = 78
const DEFAULT_CONCURRENCY = 3
const DEFAULT_TIMEOUT_MS = 120_000

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))
const clampPercent = (value: number): number => Math.max(0, Math.min(100, value))

/** sharp 지표만으로 판정한다. 비전 AI가 없어도 파이프라인이 끝까지 돈다 */
export function heuristicProvider(keepThreshold = HEURISTIC_KEEP_THRESHOLD): VisionProvider {
  return {
    name: "heuristic",
    async judge(photos) {
      return photos.map((photo) => ({
        id: photo.id,
        keep: photo.quality.score >= keepThreshold,
        score: photo.quality.score,
        source: "heuristic",
        reason: `sharpness=${photo.quality.sharpness.toFixed(2)} exposure=${photo.quality.exposure.toFixed(2)}`,
      }))
    },
  }
}

/**
 * 외부 에이전트가 만들어 둔 판정 파일을 읽는다.
 * 형식: { "judgements": [{ "id", "keep", "score", "subject": {"x","y"} }] }
 * 또는 같은 객체들의 배열.
 */
export function fileProvider(filePath: string): VisionProvider {
  return {
    name: `file:${filePath}`,
    async judge() {
      const raw = await readFile(filePath, "utf8")
      const parsed = JSON.parse(raw) as JudgementFile | Judgement[]
      const list = Array.isArray(parsed) ? parsed : parsed.judgements

      if (!Array.isArray(list)) {
        throw new Error(`판정 파일 형식이 올바르지 않습니다: ${filePath}`)
      }

      return list.map((item) => normalizeJudgement(item, `file:${filePath}`))
    },
  }
}

export interface HttpProviderOptions {
  /** 예: http://hermes-box.local:11434/v1 */
  baseUrl: string
  model: string
  apiKey?: string
  concurrency?: number
  timeoutMs?: number
  prompt?: string
}

const DEFAULT_PROMPT = [
  "You are curating photos for a printed A4 photo album.",
  "Judge whether this photo is good enough to print.",
  "Reject blurry, badly exposed, duplicated-looking, or uninteresting shots.",
  "Also locate the main subject (face or focal point).",
  'Answer with JSON only: {"keep": boolean, "score": 0..1, "subject": {"x": 0..100, "y": 0..100}, "reason": "short"}',
  "subject.x/y are percentages of image width/height.",
].join(" ")

/** OpenAI 호환 비전 엔드포인트(ollama, LM Studio, 자체 서버 등)로 판정 */
export function httpProvider(options: HttpProviderOptions): VisionProvider {
  const {
    baseUrl,
    model,
    apiKey,
    concurrency = DEFAULT_CONCURRENCY,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    prompt = DEFAULT_PROMPT,
  } = options
  const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`
  const source = `http:${model}`

  const judgeOne = async (photo: ScannedPhoto): Promise<Judgement> => {
    const dataUrl = await toDataUrl(photo.path)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
        }),
      })

      if (!response.ok) {
        const body = await response.text().catch(() => "")
        throw new Error(`비전 엔드포인트 오류 ${response.status}: ${body.slice(0, 200)}`)
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      const content = payload.choices?.[0]?.message?.content ?? ""
      const parsed = extractJson(content)

      return normalizeJudgement({ ...parsed, id: photo.id }, source)
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    name: source,
    async judge(photos) {
      return mapWithConcurrency(photos, concurrency, async (photo) => {
        try {
          return await judgeOne(photo)
        } catch (error) {
          // 한 장이 실패해도 배치 전체를 죽이지 않는다 — 휴리스틱 점수로 대체
          console.warn(`[vision] ${photo.fileName} 판정 실패, 휴리스틱으로 대체: ${describeError(error)}`)
          return {
            id: photo.id,
            keep: photo.quality.score >= HEURISTIC_KEEP_THRESHOLD,
            score: photo.quality.score,
            source: "heuristic-fallback",
            reason: describeError(error),
          }
        }
      })
    },
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function toDataUrl(filePath: string): Promise<string> {
  const buffer = await sharp(filePath)
    .rotate()
    .resize(VISION_IMAGE_WIDTH, VISION_IMAGE_WIDTH, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: VISION_JPEG_QUALITY })
    .toBuffer()
  return `data:image/jpeg;base64,${buffer.toString("base64")}`
}

/** 모델이 설명을 덧붙여도 JSON만 골라낸다 */
function extractJson(content: string): Record<string, unknown> {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1] : content
  const start = candidate.indexOf("{")
  const end = candidate.lastIndexOf("}")

  if (start === -1 || end <= start) {
    throw new Error(`JSON 응답을 찾을 수 없음: ${content.slice(0, 120)}`)
  }

  return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>
}

function normalizeJudgement(raw: Record<string, unknown> | Judgement, source: string): Judgement {
  const value = raw as Record<string, unknown>
  const id = typeof value.id === "string" ? value.id : ""
  if (!id) throw new Error("판정 항목에 id가 없습니다")

  const rawSubject = value.subject as { x?: unknown; y?: unknown } | undefined
  const subject =
    rawSubject && typeof rawSubject.x === "number" && typeof rawSubject.y === "number"
      ? { x: clampPercent(rawSubject.x), y: clampPercent(rawSubject.y) }
      : undefined

  return {
    id,
    keep: value.keep !== false,
    score: typeof value.score === "number" ? clamp01(value.score) : 0.5,
    subject,
    reason: typeof value.reason === "string" ? value.reason : undefined,
    source: typeof value.source === "string" ? value.source : source,
  }
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0

  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await worker(items[index], index)
    }
  })

  await Promise.all(runners)
  return results
}
