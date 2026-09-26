// Playwright로 헤드리스 브라우저를 띄우고 웹과 동일한 PDF 렌더 경로를 실행한다
import { chromium, type Browser, type Page } from "playwright"
import { startRenderServer, type PhotoRoute, type RenderServer } from "@/cli/render/server"
import type { Album, Photo } from "@/types/album"

const PAGE_TIMEOUT_MS = 180_000
const FONT_TIMEOUT_MS = 8_000
const TITLE_FONT = "48px 'Nanum Pen Script'"

export interface AlbumRenderer {
  photoUrl: (id: string) => string
  render: (album: Album, photos: readonly Photo[], showMetadata: boolean) => Promise<Buffer>
  close: () => Promise<void>
}

async function launchBrowser(): Promise<Browser> {
  // 설치된 시스템 Chrome을 먼저 쓴다 (별도 브라우저 다운로드 불필요)
  try {
    return await chromium.launch({ channel: "chrome" })
  } catch (chromeError) {
    try {
      return await chromium.launch()
    } catch {
      throw new Error(
        `브라우저를 띄울 수 없습니다. Chrome이 없으면 \`npx playwright install chromium\`을 실행하세요. (${
          chromeError instanceof Error ? chromeError.message : chromeError
        })`,
      )
    }
  }
}

async function waitForTitleFont(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(
      async ({ font, timeout }) => {
        const loading = document.fonts.load(font)
        const timer = new Promise<never[]>((resolveTimer) => setTimeout(() => resolveTimer([]), timeout))
        await Promise.race([loading, timer])
        return document.fonts.check(font)
      },
      { font: TITLE_FONT, timeout: FONT_TIMEOUT_MS },
    )
  } catch {
    return false
  }
}

/** 사진 목록으로 렌더러를 준비한다. 여러 후보 앨범을 같은 브라우저에서 연속 렌더한다 */
export async function createRenderer(routes: readonly PhotoRoute[]): Promise<AlbumRenderer> {
  const server: RenderServer = await startRenderServer(routes)
  let browser: Browser

  try {
    browser = await launchBrowser()
  } catch (error) {
    await server.close()
    throw error
  }

  const page = await browser.newPage()
  page.setDefaultTimeout(PAGE_TIMEOUT_MS)

  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      console.warn(`[browser] ${message.text()}`)
    }
  })
  page.on("pageerror", (error) => console.warn(`[browser] ${error.message}`))

  await page.goto(`${server.origin}/index.html`, { waitUntil: "load" })
  await page.waitForFunction(() => typeof window.__renderAlbumPdf === "function")

  const fontReady = await waitForTitleFont(page)
  if (!fontReady) {
    console.warn("[render] 나눔펜스크립트 웹폰트를 불러오지 못했습니다 — 타이틀이 기본 필기체로 렌더됩니다")
  }

  return {
    photoUrl: server.photoUrl,
    async render(album, photos, showMetadata) {
      const base64 = await page.evaluate(
        ({ albumData, photoData, metadata }) => window.__renderAlbumPdf(albumData, photoData, metadata),
        { albumData: album, photoData: photos as Photo[], metadata: showMetadata },
      )
      return Buffer.from(base64, "base64")
    },
    async close() {
      await page.close().catch(() => undefined)
      await browser.close().catch(() => undefined)
      await server.close()
    },
  }
}
