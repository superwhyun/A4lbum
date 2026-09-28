// scan: 이미지 폴더를 읽어 매니페스트(사진 목록 + 화질 지표)를 만든다
import { createHash } from "node:crypto"
import { relative, resolve } from "node:path"
import { collectImages, type SourceFile } from "@/cli/ingest/collect"
import { readFileMetadata, reverseGeocode } from "@/cli/ingest/metadata"
import { analyzePhoto } from "@/cli/ingest/quality"
import { MANIFEST_VERSION, type ScanManifest, type ScannedPhoto } from "@/cli/types"

const ID_LENGTH = 10
const DEFAULT_CONCURRENCY = 4

export interface ScanOptions {
  dir: string
  recursive?: boolean
  /** GPS → 주소 변환 여부 */
  geocode?: boolean
  kakaoApiKey?: string
  concurrency?: number
  onProgress?: (done: number, total: number, fileName: string) => void
}

/** 경로 기반 안정 id — 재실행해도 같은 사진은 같은 id를 갖는다 */
function photoId(root: string, filePath: string): string {
  const key = relative(root, filePath) || filePath
  return `p-${createHash("sha1").update(key).digest("hex").slice(0, ID_LENGTH)}`
}

async function scanOne(
  root: string,
  file: SourceFile,
  options: ScanOptions,
): Promise<ScannedPhoto> {
  const metadata = await readFileMetadata(file.path, file.fileName, file.modifiedAt)
  const { quality, hash } = await analyzePhoto(file.path)

  const location =
    options.geocode && metadata.gps ? await reverseGeocode(metadata.gps, options.kakaoApiKey) : undefined

  return {
    id: photoId(root, file.path),
    path: file.path,
    fileName: file.fileName,
    width: metadata.width,
    height: metadata.height,
    bytes: file.bytes,
    date: metadata.date,
    takenAt: metadata.takenAt,
    timeSource: metadata.timeSource,
    location,
    gps: metadata.gps,
    hash,
    quality,
  }
}

export interface ScanResult {
  manifest: ScanManifest
  failed: Array<{ path: string; reason: string }>
}

export async function scanDirectory(options: ScanOptions): Promise<ScanResult> {
  const root = resolve(options.dir)
  const files = await collectImages(root, { recursive: options.recursive })

  if (files.length === 0) {
    throw new Error(`이미지를 찾을 수 없습니다: ${root}${options.recursive ? "" : " (하위 폴더는 --recursive)"}`)
  }

  const photos: ScannedPhoto[] = []
  const failed: Array<{ path: string; reason: string }> = []
  const limit = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY)

  let cursor = 0
  let done = 0

  const workers = Array.from({ length: Math.min(limit, files.length) }, async () => {
    while (cursor < files.length) {
      const file = files[cursor]
      cursor += 1

      try {
        photos.push(await scanOne(root, file, options))
      } catch (error) {
        // 온라인 전용 OneDrive 파일이나 깨진 이미지는 건너뛴다
        failed.push({ path: file.path, reason: error instanceof Error ? error.message : String(error) })
      }

      done += 1
      options.onProgress?.(done, files.length, file.fileName)
    }
  })

  await Promise.all(workers)

  photos.sort((a, b) => a.path.localeCompare(b.path))

  return {
    manifest: {
      version: MANIFEST_VERSION,
      sourceDir: root,
      scannedAt: new Date().toISOString(),
      photos,
    },
    failed,
  }
}
