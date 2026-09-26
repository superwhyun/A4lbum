// 헤드리스 브라우저에 하네스 페이지와 원본 사진을 넘겨주는 로컬 정적 서버
import { createServer, type Server } from "node:http"
import { createReadStream } from "node:fs"
import { extname } from "node:path"
import { once } from "node:events"
import sharp from "sharp"
import { buildBrowserBundle } from "@/cli/render/bundle"

/** 브라우저가 디코딩하지 못하는 포맷은 JPEG으로 변환해서 넘긴다 */
const TRANSCODE_EXTENSIONS = new Set([".heic", ".heif", ".tif", ".tiff"])
const TRANSCODE_QUALITY = 92

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
}

const HARNESS_HTML = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>A4lbum renderer</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Nanum+Pen+Script&display=swap" rel="stylesheet">
<style>body{margin:0;font-family:'Nanum Pen Script',cursive}</style>
</head>
<body>
<script src="/bundle.js"></script>
</body>
</html>`

export interface PhotoRoute {
  id: string
  path: string
}

export interface RenderServer {
  origin: string
  photoUrl: (id: string) => string
  close: () => Promise<void>
}

/** 사진 id → 실제 파일 경로 매핑을 받아 임시 서버를 띄운다 */
export async function startRenderServer(routes: readonly PhotoRoute[]): Promise<RenderServer> {
  const byId = new Map(routes.map((route) => [route.id, route.path]))
  const bundle = await buildBrowserBundle()

  const server: Server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1")

    if (url.pathname === "/" || url.pathname === "/index.html") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      response.end(HARNESS_HTML)
      return
    }

    if (url.pathname === "/favicon.ico") {
      response.writeHead(204).end()
      return
    }

    if (url.pathname === "/bundle.js") {
      response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" })
      response.end(bundle)
      return
    }

    if (url.pathname.startsWith("/photo/")) {
      const id = decodeURIComponent(url.pathname.slice("/photo/".length))
      const filePath = byId.get(id)

      if (!filePath) {
        response.writeHead(404).end("unknown photo")
        return
      }

      const extension = extname(filePath).toLowerCase()

      try {
        if (TRANSCODE_EXTENSIONS.has(extension)) {
          const converted = await sharp(filePath).rotate().jpeg({ quality: TRANSCODE_QUALITY }).toBuffer()
          response.writeHead(200, { "Content-Type": "image/jpeg" })
          response.end(converted)
          return
        }

        response.writeHead(200, { "Content-Type": MIME_TYPES[extension] ?? "application/octet-stream" })
        createReadStream(filePath).pipe(response)
      } catch (error) {
        console.warn(`[render] 사진 전송 실패: ${filePath}`, error)
        if (!response.headersSent) response.writeHead(500)
        response.end("photo read error")
      }
      return
    }

    response.writeHead(404).end("not found")
  })

  server.listen(0, "127.0.0.1")
  await once(server, "listening")

  const address = server.address()
  if (!address || typeof address === "string") {
    throw new Error("렌더 서버 주소를 확인할 수 없습니다")
  }

  const origin = `http://127.0.0.1:${address.port}`

  return {
    origin,
    photoUrl: (id) => `${origin}/photo/${encodeURIComponent(id)}`,
    close: async () => {
      server.close()
      await once(server, "close")
    },
  }
}
