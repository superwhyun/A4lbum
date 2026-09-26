// 브라우저 진입점을 esbuild로 묶는다 (tsconfig의 @/ 경로 별칭 사용)
import { build } from "esbuild"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const currentDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(currentDir, "../..")

let cached: string | null = null

/** pdf-export를 포함한 브라우저용 IIFE 번들 문자열 */
export async function buildBrowserBundle(): Promise<string> {
  if (cached) return cached

  const result = await build({
    entryPoints: [resolve(currentDir, "browser-entry.ts")],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: ["chrome120"],
    absWorkingDir: projectRoot,
    alias: { "@": projectRoot },
    logLevel: "silent",
  })

  const output = result.outputFiles?.[0]
  if (!output) throw new Error("브라우저 번들 생성 실패")

  cached = output.text
  return cached
}
