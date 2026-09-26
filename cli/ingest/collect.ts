// 이미지 폴더 탐색
import { readdir, stat } from "node:fs/promises"
import { extname, join, resolve } from "node:path"

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".tif", ".tiff"])
/** OneDrive/맥OS가 남기는 부산물 */
const IGNORED_NAMES = new Set([".DS_Store", "Thumbs.db", "desktop.ini"])

export interface SourceFile {
  path: string
  fileName: string
  bytes: number
  modifiedAt: Date
}

export interface CollectOptions {
  recursive?: boolean
  /** 하위 폴더 탐색 깊이 제한 */
  maxDepth?: number
}

const DEFAULT_MAX_DEPTH = 8

function isImage(fileName: string): boolean {
  if (fileName.startsWith(".")) return false
  if (IGNORED_NAMES.has(fileName)) return false
  return IMAGE_EXTENSIONS.has(extname(fileName).toLowerCase())
}

/** 폴더에서 이미지 파일을 모아 파일명 순으로 돌려준다 */
export async function collectImages(dir: string, options: CollectOptions = {}): Promise<SourceFile[]> {
  const { recursive = false, maxDepth = DEFAULT_MAX_DEPTH } = options
  const root = resolve(dir)
  const found: SourceFile[] = []

  const walk = async (current: string, depth: number): Promise<void> => {
    const entries = await readdir(current, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(current, entry.name)

      if (entry.isDirectory()) {
        if (recursive && depth < maxDepth && !entry.name.startsWith(".")) {
          await walk(fullPath, depth + 1)
        }
        continue
      }

      if (!entry.isFile() || !isImage(entry.name)) continue

      const info = await stat(fullPath)
      found.push({
        path: fullPath,
        fileName: entry.name,
        bytes: info.size,
        modifiedAt: info.mtime,
      })
    }
  }

  await walk(root, 0)
  return found.sort((a, b) => a.path.localeCompare(b.path))
}
