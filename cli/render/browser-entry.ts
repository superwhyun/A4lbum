// 헤드리스 브라우저 안에서 실행되는 진입점.
// 웹 앱과 똑같은 buildAlbumPdf를 쓰기 때문에 CLI 출력과 웹 출력이 어긋나지 않는다.
import { buildAlbumPdf } from "@/utils/pdf-export"
import type { Album, Photo } from "@/types/album"

const BASE64_CHUNK = 0x8000

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK))
  }
  return btoa(binary)
}

declare global {
  interface Window {
    __renderAlbumPdf: (album: Album, photos: Photo[], showMetadata: boolean) => Promise<string>
    __albumFontReady: boolean
  }
}

window.__renderAlbumPdf = async (album, photos, showMetadata) => {
  const pdf = await buildAlbumPdf(album, photos, undefined, showMetadata)
  return toBase64(pdf.output("arraybuffer"))
}
