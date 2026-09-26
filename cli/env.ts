// .env.local을 읽어 필요한 값만 꺼내온다 (dotenv 의존 없이)
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

const ENV_FILES = [".env.local", ".env"]

let cache: Record<string, string> | null = null

async function loadEnvFiles(projectRoot: string): Promise<Record<string, string>> {
  if (cache) return cache

  const merged: Record<string, string> = {}

  for (const fileName of ENV_FILES) {
    const raw = await readFile(resolve(projectRoot, fileName), "utf8").catch(() => null)
    if (!raw) continue

    for (const line of raw.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue

      const separator = trimmed.indexOf("=")
      if (separator === -1) continue

      const key = trimmed.slice(0, separator).trim()
      const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "")
      if (key && !(key in merged)) merged[key] = value
    }
  }

  cache = merged
  return merged
}

/** process.env가 우선, 없으면 .env.local에서 찾는다 */
export async function readEnv(key: string, projectRoot: string): Promise<string | undefined> {
  if (process.env[key]) return process.env[key]
  const values = await loadEnvFiles(projectRoot)
  return values[key]
}
