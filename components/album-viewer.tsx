"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronLeft, ChevronRight, Edit, Download } from "lucide-react"
import { useAlbum } from "@/contexts/album-context"
import { Button } from "@/components/ui/button"
import { AlbumPage } from "./album-page"
import { exportAlbumToPDF } from "@/utils/pdf-export"
import { Progress } from "@/components/ui/progress"

export function AlbumViewer() {
  const { album, photos, swapPhotos, templates, updatePage, insertPage, removeEmptyPages, pdfProgress, setPdfProgress } = useAlbum()
  const [currentPage, setCurrentPage] = useState(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])
  const [editMode, setEditMode] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<{ layoutId: string; pageId: string } | null>(null)
  const [showPdfModal, setShowPdfModal] = useState(false)

  if (!album || album.pages.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">앨범이 생성되지 않았습니다.</p>
      </div>
    )
  }

  const nextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, album.pages.length - 1))
  }

  const prevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 0))
  }

  // Center the selected page in the scroll area when currentPage changes
  useEffect(() => {
    const container = scrollContainerRef.current
    const page = pageRefs.current[currentPage]
    if (container && page) {
      const containerRect = container.getBoundingClientRect()
      const pageRect = page.getBoundingClientRect()
      const scrollLeft = container.scrollLeft
      const offset = pageRect.left - containerRect.left
      const centerOffset = offset - (containerRect.width / 2) + (pageRect.width / 2)
      container.scrollTo({ left: scrollLeft + centerOffset, behavior: "smooth" })
    }
  }, [currentPage, album.pages.length])

  const handlePhotoSelect = (layoutId: string, pageId: string) => {
    
    if (selectedPhoto) {
      // 이미 선택된 사진/슬롯이 있으면 스위치
      if (selectedPhoto.layoutId !== layoutId || selectedPhoto.pageId !== pageId) {
        
        // 빈 슬롯과 사진 스와핑도 처리
        swapPhotos(selectedPhoto.layoutId, layoutId, selectedPhoto.pageId, pageId)
      }
      setSelectedPhoto(null)
    } else {
      // 첫 번째 선택 (빈 슬롯이든 사진이든 상관없이)
      setSelectedPhoto({ layoutId, pageId })
    }
  }

  const handleLayoutChangeWithPhotoManagement = (
    pageIndex: number,
    page: any,
    selectedTemplate: any
  ) => {
    const currentPhotoCount = page.layouts.length
    const newPhotoCount = selectedTemplate.layouts.length
    
    // 기존 사진들을 순서대로 새 레이아웃에 매핑
    const newLayouts = selectedTemplate.layouts.map((layout: any, idx: number) => ({
      ...layout,
      photoId: page.layouts[idx]?.photoId || "",
      photoX: 50,
      photoY: 50,
    }))
    
    // 현재 페이지를 새로운 레이아웃으로 업데이트
    updatePage(page.id, newLayouts, { templateId: selectedTemplate.id })
    
    // 사진이 남는 경우 (새 레이아웃의 사진 장수가 더 적은 경우)
    if (currentPhotoCount > newPhotoCount) {
      const remainingPhotos = page.layouts.slice(newPhotoCount)
      
      if (remainingPhotos.length > 0) {
        // 남은 사진들로 새 페이지 생성
        createNewPageWithRemainingPhotos(pageIndex, remainingPhotos)
      }
    }
  }
  
  const createNewPageWithRemainingPhotos = (afterPageIndex: number, remainingLayouts: any[]) => {
    if (!album || !templates) return
    
    // 남은 사진 수에 맞는 적절한 템플릿 찾기
    const availableTemplates = templates.filter(
      (t) => t.photoCount === remainingLayouts.length && t.orientation === album.orientation
    )
    
    let selectedTemplate = availableTemplates[0]
    
    // 적절한 템플릿이 없으면 기본 레이아웃 생성
    if (!selectedTemplate) {
      selectedTemplate = generateDefaultTemplate(remainingLayouts.length, album.orientation)
    }
    
    // 새 페이지의 레이아웃 생성
    const newLayouts = selectedTemplate.layouts.map((layout: any, idx: number) => ({
      ...layout,
      photoId: remainingLayouts[idx]?.photoId || "",
      photoX: remainingLayouts[idx]?.photoX || 50,
      photoY: remainingLayouts[idx]?.photoY || 50,
    }))
    
    // 새 페이지 생성
    const newPage = {
      id: `page-${Date.now()}-${Math.random()}`,
      layouts: newLayouts,
      templateId: selectedTemplate.id,
    }
    
    // 현재 페이지 다음에 새 페이지 삽입
    insertPage(afterPageIndex, newPage)
    
    // 새 페이지로 이동
    setTimeout(() => {
      setCurrentPage(afterPageIndex + 1)
    }, 100)
  }
  
  const generateDefaultTemplate = (photoCount: number, orientation: "portrait" | "landscape") => {
    const layouts = []
    const cols = Math.ceil(Math.sqrt(photoCount))
    const rows = Math.ceil(photoCount / cols)
    const cellWidth = (100 - (cols - 1) * 2) / cols
    const cellHeight = (100 - (rows - 1) * 2) / rows
    
    for (let i = 0; i < photoCount; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)
      layouts.push({
        id: `layout-${i}`,
        x: col * (cellWidth + 2),
        y: row * (cellHeight + 2),
        width: cellWidth,
        height: cellHeight,
        photoX: 50,
        photoY: 50,
      })
    }
    
    return {
      id: `temp-${photoCount}-${orientation}`,
      name: `${photoCount}장 ${orientation}`,
      photoCount,
      orientation,
      layouts,
    }
  }

  const handleDownloadPDF = async () => {
    if (!album) return

    setShowPdfModal(true)
    try {
      await exportAlbumToPDF(album, photos, setPdfProgress)
    } catch (error) {
      console.error("PDF 생성 중 오류:", error)
      alert("PDF 생성 중 오류가 발생했습니다.")
    }
    setShowPdfModal(false)
  }

  return (
    <div className="space-y-4">
      {showPdfModal && pdfProgress > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-8 flex flex-col items-center min-w-[300px]">
            <div className="mb-4 text-lg font-semibold">PDF 변환 중...</div>
            <Progress value={pdfProgress} />
            <div className="text-xs text-gray-500 mt-2">{pdfProgress}%</div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          앨범 미리보기 ({currentPage + 1} / {album.pages.length})
        </h2>
        <div className="flex gap-2">
          <Button onClick={handleDownloadPDF} variant="default">
            <Download className="w-4 h-4 mr-2" />
            PDF 다운로드
          </Button>
          <Button variant={editMode ? "default" : "outline"} onClick={() => {
            setEditMode(!editMode)
            if (editMode) setSelectedPhoto(null) // 편집 모드 해제 시 선택 초기화
          }}>
            <Edit className="w-4 h-4 mr-2" />
            {editMode ? "편집 완료" : "편집 모드"}
          </Button>
          {editMode && (
            <Button variant="outline" onClick={() => {
              const result = removeEmptyPages()
              if (result.removedPages.length > 0) {
                // 현재 페이지 조정
                const wasCurrentPageRemoved = result.removedIndices.includes(currentPage)
                
                if (wasCurrentPageRemoved) {
                  const newCurrentPage = Math.max(0, Math.min(currentPage, result.newTotalPages - 1))
                  setCurrentPage(newCurrentPage)
                } else {
                  const removedBeforeCurrent = result.removedIndices.filter(idx => idx < currentPage).length
                  if (removedBeforeCurrent > 0) {
                    setCurrentPage(currentPage - removedBeforeCurrent)
                  }
                }
              }
            }}>
              🗑️ 빈 페이지 정리
            </Button>
          )}
        </div>
      </div>

      <div className="relative" id="album-viewer">
        <div className="overflow-x-auto" ref={scrollContainerRef}>
          <div className="flex gap-4 pb-4" style={{ width: "max-content" }}>
            {album.pages.map((page, index) => {
              // 편집 모드에서는 모든 해당 orientation의 템플릿 표시 (사진 장수 무관)
              const availableTemplates = templates
                ? templates.filter((t) => t.orientation === album.orientation)
                : [];
              
              // 현재 페이지와 같은 사진 수의 템플릿과 다른 사진 수의 템플릿 분리
              const sameCountTemplates = availableTemplates.filter(
                (t) => t.photoCount === page.layouts.length
              );
              const differentCountTemplates = availableTemplates.filter(
                (t) => t.photoCount !== page.layouts.length
              );
              return (
                <div
                  key={page.id}
                  ref={el => { pageRefs.current[index] = el }}
                  className={`album-page flex-shrink-0 transition-opacity ${index === currentPage ? "opacity-100" : "opacity-50"}`}
                  style={{
                    width: album.orientation === "portrait" ? "400px" : "600px",
                    height: album.orientation === "portrait" ? "566px" : "400px",
                  }}
                >
                  {editMode && index === currentPage && (
                    <div className="mb-2 flex items-center gap-2">
                      <label className="text-xs text-gray-500">레이아웃 변경:</label>
                      <select
                        className="p-1 border rounded text-xs"
                        value={page.templateId || ""}
                        onChange={(e) => {
                          const selectedId = e.target.value;
                          const selectedTemplate = templates.find((t) => t.id === selectedId);
                          if (selectedTemplate) {
                            handleLayoutChangeWithPhotoManagement(index, page, selectedTemplate);
                          }
                        }}
                      >
                        <option value="">선택하세요</option>
                        {sameCountTemplates.length > 0 && (
                          <optgroup label={`현재와 동일 (${page.layouts.length}장)`}>
                            {sameCountTemplates.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {differentCountTemplates.length > 0 && (
                          <optgroup label="다른 장수 (새 페이지 생성)">
                            {differentCountTemplates.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name} ({t.photoCount}장)
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                  )}
                  <AlbumPage
                    page={page}
                    photos={photos}
                    theme={album.theme}
                    orientation={album.orientation}
                    editMode={editMode}
                    selectedPhoto={selectedPhoto}
                    onPhotoSelect={handlePhotoSelect}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <Button
          variant="outline"
          size="icon"
          className="absolute left-2 top-1/2 transform -translate-y-1/2"
          onClick={prevPage}
          disabled={currentPage === 0}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          className="absolute right-2 top-1/2 transform -translate-y-1/2"
          onClick={nextPage}
          disabled={currentPage === album.pages.length - 1}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex justify-center">
        <div className="flex gap-2">
          {album.pages.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentPage(index)}
              className={`px-3 py-1 rounded transition-colors font-semibold border
                ${index === currentPage
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-blue-100"}
              `}
              style={{
                minWidth: "2.5rem"
              }}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
