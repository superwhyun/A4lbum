import jsPDF from "jspdf"
import type { Album, Photo, PhotoLayout, AlbumPage } from "@/types/album"
import { A4_SIZE } from "@/types/album"

/**
 * object-fit: cover, object-position (%)을 canvas crop에 반영
 */
function drawCroppedImageToCanvas(
  img: HTMLImageElement,
  layout: PhotoLayout,
  photo: Photo,
  framePx: { width: number; height: number },
  photoX: number,
  photoY: number
): HTMLCanvasElement {
  // 프레임 크기(px)
  const frameW = framePx.width
  const frameH = framePx.height

  // 원본 이미지 크기
  const imgW = img.naturalWidth
  const imgH = img.naturalHeight

  // object-fit: cover 기준, 프레임에 맞게 이미지 비율 계산
  const frameRatio = frameW / frameH
  const imgRatio = imgW / imgH

  let drawW, drawH
  if (imgRatio > frameRatio) {
    // 이미지가 더 넓음: 높이를 프레임에 맞추고, 좌우 crop
    drawH = imgH
    drawW = imgH * frameRatio
  } else {
    // 이미지가 더 높음: 너비를 프레임에 맞추고, 상하 crop
    drawW = imgW
    drawH = imgW / frameRatio
  }

  // object-position: (%) → crop 시작점 계산
  // photoX, photoY는 0~100, 기본 50
  const posX = ((photoX ?? 50) / 100) * (imgW - drawW)
  const posY = ((photoY ?? 50) / 100) * (imgH - drawH)

  // 고해상도 출력을 위해 프레임 크기를 4배로 (A4 300dpi 기준)
  // PDF 용량 최적화: 해상도 3배(300dpi 기준, 필요시 2~4로 조정)
  const scale = 3
  const canvas = document.createElement("canvas")
  canvas.width = frameW * scale
  canvas.height = frameH * scale
  const ctx = canvas.getContext("2d")!

  ctx.drawImage(
    img,
    posX, posY, drawW, drawH, // 원본 crop 영역
    0, 0, canvas.width, canvas.height // 캔버스에 꽉 채움
  )

  return canvas
}

/**
 * PDF로 앨범 내보내기 (고해상도, crop/position 반영)
 */
export async function exportAlbumToPDF(album: Album, photosInput: Photo[] | Record<string, Photo>) {
  console.log("exportAlbumToPDF called", { album, photosInput });
  // photosInput이 배열이 아니면 Object.values로 배열화
  const photos: Photo[] = Array.isArray(photosInput) ? photosInput : Object.values(photosInput)

  const pdf = new jsPDF({
    orientation: album.orientation === "portrait" ? "portrait" : "landscape",
    unit: "mm",
    format: "a4",
  })

  // mm → px 변환 (A4 210x297mm, 1mm = 3.7795px @96dpi)
  const MM_TO_PX = 3.7795
  const pdfWidthPx = (album.orientation === "portrait" ? A4_SIZE.WIDTH : A4_SIZE.HEIGHT) * MM_TO_PX
  const pdfHeightPx = (album.orientation === "portrait" ? A4_SIZE.HEIGHT : A4_SIZE.WIDTH) * MM_TO_PX

  for (let pageIdx = 0; pageIdx < album.pages.length; pageIdx++) {
    const page = album.pages[pageIdx]
    console.log("PDF page", { pageIdx, page, layouts: page.layouts });
    // PDF 첫 페이지는 addPage 필요 없음
    if (pageIdx > 0) pdf.addPage()

    // 각 프레임(사진)마다 crop/resize해서 PDF에 addImage
    for (const layout of page.layouts) {
      console.log("PDF layout", { layout });
      const photo = photos.find(p => p.id === layout.photoId)
      if (!photo) continue

      // 원본 이미지 로드
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new window.Image()
        // 외부 이미지일 때만 crossOrigin 적용
        if (!photo.url.startsWith(window.location.origin)) {
          image.crossOrigin = "anonymous"
        }
        image.onload = () => resolve(image)
        image.onerror = (e) => {
          console.warn("이미지 로딩 실패:", photo.url, e)
          reject(new Error("이미지 로딩 실패: " + photo.url))
        }
        image.src = photo.url
      }).catch((err) => {
        console.warn("이미지 로딩 에러, PDF에 포함되지 않음:", photo.url, err)
        return null
      })
      if (!img) continue

      // 프레임 위치/크기 (A4 px 기준)
      const framePx = {
        width: (layout.width / 100) * pdfWidthPx,
        height: (layout.height / 100) * pdfHeightPx,
      }
      const framePos = {
        x: (layout.x / 100) * pdfWidthPx,
        y: (layout.y / 100) * pdfHeightPx,
      }
      const photoX = layout.photoX ?? 50
      const photoY = layout.photoY ?? 50

      // crop/resize된 이미지를 canvas에 그림
      const canvas = drawCroppedImageToCanvas(img, layout, photo, framePx, photoX, photoY)
      // PDF 용량 최적화: JPEG 품질 0.8로 저장
      const imgData = canvas.toDataURL("image/jpeg", 0.8)
      if (!imgData || imgData.length < 100) {
        console.warn("imgData 생성 실패, PDF에 포함되지 않음:", photo.url)
        continue
      }

      // PDF에 프레임 위치/크기에 맞게 addImage (단위: mm)
      const pdfFrameW = (layout.width / 100) * (album.orientation === "portrait" ? A4_SIZE.WIDTH : A4_SIZE.HEIGHT)
      const pdfFrameH = (layout.height / 100) * (album.orientation === "portrait" ? A4_SIZE.HEIGHT : A4_SIZE.WIDTH)
      const pdfFrameX = (layout.x / 100) * (album.orientation === "portrait" ? A4_SIZE.WIDTH : A4_SIZE.HEIGHT)
      const pdfFrameY = (layout.y / 100) * (album.orientation === "portrait" ? A4_SIZE.HEIGHT : A4_SIZE.WIDTH)

      // 디버깅: addImage 직전 값 출력
      console.log("PDF addImage", {
        photoUrl: photo.url,
        imgDataPrefix: imgData.slice(0, 30),
        imgDataLength: imgData.length,
        pdfFrameX, pdfFrameY, pdfFrameW, pdfFrameH
      })

      pdf.addImage(
        imgData,
        "JPEG",
        pdfFrameX,
        pdfFrameY,
        pdfFrameW,
        pdfFrameH
      )
    }
  }

  // PDF 다운로드
  const fileName = `album-${new Date().toISOString().split("T")[0]}.pdf`
  pdf.save(fileName)
}
