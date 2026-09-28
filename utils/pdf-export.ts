import jsPDF from "jspdf"
import type { Album, Photo, AlbumPage } from "@/types/album"
import { A4_SIZE } from "@/types/album"

/**
 * 앨범 테마 이름을 PDF 배경색 hex로 매핑
 */
const THEME_COLORS: Record<string, string> = {
  classic: "#FEF3C7",
  modern: "#F9FAFB",
  vintage: "#FEF9C3",
  minimal: "#FFFFFF",
  colorful: "#F0ABFC", // 보라/핑크 계열
  elegant: "#F3E8FF",
  rustic: "#FFEDD5",
  artistic: "#FCE7F3",
  nature: "#DCFCE7",
  urban: "#DBEAFE",
  black: "#000000",
};

const THEME_TEXT_COLORS: Record<string, string> = {
  classic: "#1F2937",
  modern: "#1F2937",
  vintage: "#1F2937",
  minimal: "#1F2937",
  colorful: "#1F2937",
  elegant: "#1F2937",
  rustic: "#1F2937",
  artistic: "#1F2937",
  nature: "#1F2937",
  urban: "#1F2937",
  black: "#FFFFFF",
};

interface PhotoPlacement {
  /** object-position (0~100, 기본 50) */
  photoX: number
  photoY: number
  /** cover: 꽉 채우고 넘치는 부분 crop, contain: 자르지 않고 배경색 위에 레터박스 */
  fit: "cover" | "contain"
  /** contain일 때 여백을 채울 테마 배경색 */
  background: string
}

function drawPhotoToCanvas(
  img: HTMLImageElement,
  framePx: { width: number; height: number },
  placement: PhotoPlacement
): HTMLCanvasElement {
  // 프레임 크기(px)
  const frameW = framePx.width
  const frameH = framePx.height

  // 원본 이미지 크기
  const imgW = img.naturalWidth
  const imgH = img.naturalHeight

  const frameRatio = frameW / frameH
  const imgRatio = imgW / imgH

  // 고해상도 출력을 위해 프레임 크기를 3배로 (PDF 용량과 300dpi 사이 절충, 필요시 2~4로 조정)
  const scale = 3
  const canvas = document.createElement("canvas")
  canvas.width = frameW * scale
  canvas.height = frameH * scale
  const ctx = canvas.getContext("2d")!

  if (placement.fit === "contain") {
    // 사진 전체를 프레임 안에 맞추고 가운데 정렬, 남는 곳은 테마 배경색
    ctx.fillStyle = placement.background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const drawScale = Math.min(canvas.width / imgW, canvas.height / imgH)
    const drawW = imgW * drawScale
    const drawH = imgH * drawScale
    ctx.drawImage(img, (canvas.width - drawW) / 2, (canvas.height - drawH) / 2, drawW, drawH)
    return canvas
  }

  // object-fit: cover 기준, 프레임 비율의 최대 crop 창
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
  const posX = (placement.photoX / 100) * (imgW - drawW)
  const posY = (placement.photoY / 100) * (imgH - drawH)

  ctx.drawImage(
    img,
    posX, posY, drawW, drawH, // 원본 crop 영역
    0, 0, canvas.width, canvas.height // 캔버스에 꽉 채움
  )

  return canvas
}

/**
 * 텍스트를 Canvas에 렌더링하여 이미지로 변환
 */
function createTextImage(
  text: string,
  textColor: string,
  fontSize: number = 24
): { imageData: string; width: number; height: number } {
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")!

  // 폰트 설정 - 나눔펜스크립트
  ctx.font = `${fontSize}px 'Nanum Pen Script', cursive`
  ctx.fillStyle = textColor
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"

  // 텍스트 크기 측정
  const textMetrics = ctx.measureText(text)
  const textWidth = textMetrics.width
  const textHeight = fontSize * 1.2 // 대략적인 텍스트 높이

  // Canvas 크기 설정 (패딩 포함)
  const padding = 10
  canvas.width = textWidth + padding * 2
  canvas.height = textHeight + padding * 2

  // 폰트 재설정 (canvas 크기 변경으로 리셋됨)
  ctx.font = `${fontSize}px 'Nanum Pen Script', cursive`
  ctx.fillStyle = textColor
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"

  // 텍스트 그림자 효과 (가독성 향상)
  ctx.shadowColor = textColor === "#FFFFFF" ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.3)"
  ctx.shadowBlur = 2
  ctx.shadowOffsetX = 1
  ctx.shadowOffsetY = 1

  // 텍스트 렌더링
  ctx.fillText(text, canvas.width / 2, canvas.height / 2)

  // PNG로 변환 (투명 배경 유지)
  return {
    imageData: canvas.toDataURL("image/png"),
    width: canvas.width,
    height: canvas.height
  }
}

/**
 * PDF에 메타정보를 렌더링 (배경 박스와 텍스트)
 */
function renderMetadataToPDF(
  pdf: jsPDF,
  photo: Photo,
  frameX: number,
  frameY: number,
  frameWidth: number,
  frameHeight: number,
  theme: string
) {
  if (!photo.date && !photo.location) return

  // 메타정보 텍스트 구성
  let metadataText = ''
  if (photo.date && photo.location) {
    metadataText = `${photo.date} | ${photo.location}`
  } else if (photo.date) {
    metadataText = photo.date
  } else if (photo.location) {
    metadataText = photo.location
  }

  // 텍스트 색상 (흰색 고정)
  const textColor = '#FFFFFF'

  // 폰트 크기 (PDF용으로 더 크게)
  const fontSize = 24 // PDF에서 보기 좋은 크기

  // 메타정보를 이미지로 변환
  const textImage = createTextImage(metadataText, textColor, fontSize)

  // px → mm 변환
  const PX_TO_MM = 25.4 / 96
  const textWidth = textImage.width * PX_TO_MM
  const textHeight = textImage.height * PX_TO_MM

  // 배경 박스 크기 및 위치 (프레임 하단) - 매우 얇게
  const boxHeight = textHeight * 0.52 // 텍스트 높이의 절반 정도로 매우 얇게
  const boxY = frameY + frameHeight - boxHeight

  // 반투명 검은색 배경 박스
  pdf.setFillColor(0, 0, 0) // 검은색
  pdf.setDrawColor(0, 0, 0)
  pdf.setGState(pdf.GState({ opacity: 0.3 })) // 30% 불투명도
  pdf.rect(frameX, boxY, frameWidth, boxHeight, 'F')

  // 불투명도 리셋
  pdf.setGState(pdf.GState({ opacity: 1.0 }))

  // 텍스트 위치 (오른쪽 정렬)
  const textX = frameX + frameWidth - textWidth - 2 // 오른쪽에서 2mm 여백
  const textY = boxY + (boxHeight - textHeight) / 2

  // 텍스트 렌더링
  pdf.addImage(
    textImage.imageData,
    "PNG",
    textX,
    textY,
    textWidth,
    textHeight
  )
}

/**
 * PDF에 타이틀 텍스트를 이미지로 렌더링
 */
function renderTitleToPDF(
  pdf: jsPDF,
  page: AlbumPage,
  theme: string,
  orientation: "portrait" | "landscape"
) {
  if (!page.title || !page.titlePosition) return

  const { title, titlePosition } = page
  const textColor = THEME_TEXT_COLORS[theme] || "#1F2937"

  // 위치 좌표 변환 (% → mm)
  const pageWidth = orientation === "portrait" ? A4_SIZE.WIDTH : A4_SIZE.HEIGHT
  const pageHeight = orientation === "portrait" ? A4_SIZE.HEIGHT : A4_SIZE.WIDTH

  const titleX = (titlePosition.x / 100) * pageWidth
  const titleY = (titlePosition.y / 100) * pageHeight

  // 텍스트를 이미지로 변환 (크기 2배)
  const textImage = createTextImage(title, textColor, 48)

  // 실제 Canvas 크기를 기반으로 PDF 크기 계산
  // px → mm 변환 (96 DPI 기준: 1 inch = 25.4mm, 96px = 25.4mm)
  const PX_TO_MM = 25.4 / 96
  const pdfWidth = textImage.width * PX_TO_MM
  const pdfHeight = textImage.height * PX_TO_MM

  // PDF에 이미지 삽입 (중앙 정렬)
  pdf.addImage(
    textImage.imageData,
    "PNG",
    titleX - pdfWidth / 2,
    titleY - pdfHeight / 2,
    pdfWidth,
    pdfHeight
  )
}

/** 그룹 캡션 여백 (mm) — 레이아웃 엔진의 기본 페이지 여백(8mm) 안에 들어간다 */
const CAPTION_MARGIN_MM = 8

/**
 * 그룹 캡션("2024.05.12 · 제주 서귀포")을 페이지 아래 여백에 왼쪽 정렬로 렌더링
 */
function renderCaptionToPDF(
  pdf: jsPDF,
  page: AlbumPage,
  theme: string,
  orientation: "portrait" | "landscape"
) {
  if (!page.caption || page.isCoverPage) return

  const textColor = THEME_TEXT_COLORS[theme] || "#1F2937"
  const pageHeight = orientation === "portrait" ? A4_SIZE.HEIGHT : A4_SIZE.WIDTH
  const textImage = createTextImage(page.caption, textColor, 20)

  const PX_TO_MM = 25.4 / 96
  const width = textImage.width * PX_TO_MM
  const height = textImage.height * PX_TO_MM

  // 아래 여백의 세로 가운데에 텍스트 중심을 둔다
  pdf.addImage(
    textImage.imageData,
    "PNG",
    CAPTION_MARGIN_MM - 10 * PX_TO_MM,
    pageHeight - CAPTION_MARGIN_MM / 2 - height / 2,
    width,
    height
  )
}

/**
 * 앨범을 jsPDF 문서로 렌더링 (고해상도, crop/position 반영).
 * 저장/다운로드는 하지 않으므로 헤드리스 렌더링에서도 그대로 재사용할 수 있다.
 */
export async function buildAlbumPdf(
  album: Album,
  photosInput: Photo[] | Record<string, Photo>,
  onProgress?: (percent: number) => void,
  showMetadata: boolean = true
): Promise<jsPDF> {
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

  const totalPages = album.pages.length
  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const page = album.pages[pageIdx]
    // PDF 첫 페이지는 addPage 필요 없음
    if (pageIdx > 0) pdf.addPage()

    // 테마 배경색 채우기
    const themeColor = THEME_COLORS[album.theme] || "#FFFFFF"
    pdf.setFillColor(themeColor)
    pdf.rect(
      0,
      0,
      album.orientation === "portrait" ? A4_SIZE.WIDTH : A4_SIZE.HEIGHT,
      album.orientation === "portrait" ? A4_SIZE.HEIGHT : A4_SIZE.WIDTH,
      "F"
    )

    // 각 프레임(사진)마다 crop/resize해서 PDF에 addImage
    for (const layout of page.layouts) {
      const photo = photos.find(p => p.id === layout.photoId)
      if (!photo) continue

      // 원본 이미지 로드
      // PDF 생성 시점에만 파일을 base64로 읽어 이미지로 로드
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new window.Image()
        if (photo.file) {
          const reader = new FileReader()
          reader.onload = () => {
            image.src = reader.result as string
          }
          reader.onerror = (e) => {
            console.warn("FileReader 에러:", e)
            reject(new Error("FileReader 에러"))
          }
          image.onload = () => resolve(image)
          image.onerror = (e) => {
            console.warn("이미지 로딩 실패 (file):", e)
            reject(new Error("이미지 로딩 실패 (file)"))
          }
          reader.readAsDataURL(photo.file)
        } else if (photo.url) {
          // 외부 이미지일 때만 crossOrigin 적용
          if (!photo.url.startsWith(window.location.origin)) {
            image.crossOrigin = "anonymous"
          }
          image.onload = () => resolve(image)
          image.onerror = (e) => {
            console.warn("이미지 로딩 실패 (url):", photo.url, e)
            reject(new Error("이미지 로딩 실패 (url): " + photo.url))
          }
          image.src = photo.url
        } else {
          reject(new Error("photo.file과 photo.url이 모두 없음"))
        }
      }).catch((err) => {
        console.warn("이미지 로딩 에러, PDF에 포함되지 않음:", photo, err)
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
      // crop/resize된 이미지를 canvas에 그림
      const canvas = drawPhotoToCanvas(img, framePx, {
        photoX: layout.photoX ?? 50,
        photoY: layout.photoY ?? 50,
        fit: layout.fit ?? "cover",
        background: themeColor,
      })
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

      pdf.addImage(
        imgData,
        "JPEG",
        pdfFrameX,
        pdfFrameY,
        pdfFrameW,
        pdfFrameH
      )

      // 메타정보 렌더링 (표지 페이지가 아닌 경우에만)
      if (showMetadata && !page.isCoverPage && photo && (photo.date || photo.location)) {
        renderMetadataToPDF(pdf, photo, pdfFrameX, pdfFrameY, pdfFrameW, pdfFrameH, album.theme)
      }
    }

    // 타이틀 렌더링 (표지 페이지나 타이틀이 있는 페이지)
    renderTitleToPDF(pdf, page, album.theme, album.orientation)
    renderCaptionToPDF(pdf, page, album.theme, album.orientation)

    if (onProgress) {
      onProgress(Math.round(((pageIdx + 1) / totalPages) * 100))
    }
  }

  return pdf
}

/**
 * PDF로 앨범 내보내기 (브라우저 다운로드 포함)
 */
export async function exportAlbumToPDF(
  album: Album,
  photosInput: Photo[] | Record<string, Photo>,
  onProgress?: (percent: number) => void,
  showMetadata: boolean = true
) {
  console.log("exportAlbumToPDF called", { album, photosInput, showMetadata });

  const pdf = await buildAlbumPdf(album, photosInput, onProgress, showMetadata)

  // PDF 다운로드
  const fileName = `album-${new Date().toISOString().split("T")[0]}.pdf`

  // 방법 1: pdf.save() 시도 (Safari/Firefox용)
  try {
    pdf.save(fileName)
    console.log("pdf.save() 호출 완료")
  } catch (e) {
    console.warn("pdf.save() 실패:", e)
  }

  // 방법 2: Blob URL 생성하여 반환 (Chrome용 백업)
  const pdfBlob = pdf.output("blob")
  const blobUrl = URL.createObjectURL(pdfBlob)

  if (onProgress) {
    setTimeout(() => onProgress(0), 500)
  }

  // 다운로드 URL 반환
  return { url: blobUrl, fileName }
}
