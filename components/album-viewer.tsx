"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronLeft, ChevronRight, Edit, Download, Layout, Image as ImageIcon, ArrowRightLeft, Trash2, X } from "lucide-react"
import { useAlbum } from "@/contexts/album-context"
import { Button } from "@/components/ui/button"
import { AlbumPage } from "./album-page"
import { exportAlbumToPDF } from "@/utils/pdf-export"
import { Progress } from "@/components/ui/progress"
import { PhotoSidebar } from "./photo-sidebar"
import { Badge } from "@/components/ui/badge"

export function AlbumViewer() {
  const { album, photos, swapPhotos, templates, updatePage, insertPage, removeEmptyPages, pdfProgress, setPdfProgress } = useAlbum()
  const [currentPage, setCurrentPage] = useState(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])
  const [editMode, setEditMode] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<{ layoutId: string; pageId: string } | null>(null)
  const [swapSource, setSwapSource] = useState<{ layoutId: string; pageId: string } | null>(null)
  const [showPdfModal, setShowPdfModal] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const [scale, setScale] = useState(1)

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
    if (!editMode) return

    if (swapSource) {
      // 스왑 모드인 경우, 클릭한 대상과 스왑 실행
      if (swapSource.layoutId !== layoutId || swapSource.pageId !== pageId) {
        swapPhotos(swapSource.layoutId, layoutId, swapSource.pageId, pageId)
      }
      setSwapSource(null) // 스왑 모드 종료
      setSelectedPhoto(null) // 선택 해제
      return
    }

    // 일반 선택 모드
    if (selectedPhoto?.layoutId === layoutId && selectedPhoto?.pageId === pageId) {
      setSelectedPhoto(null) // 이미 선택된 것 클릭 시 해제
    } else {
      setSelectedPhoto({ layoutId, pageId }) // 선택
    }
  }

  const startSwap = () => {
    if (selectedPhoto) {
      setSwapSource(selectedPhoto)
      // 토스트나 알림으로 "교체할 다른 사진을 클릭하세요"라고 알려주면 좋음
    }
  }

  const cancelSwap = () => {
    setSwapSource(null)
  }

  const removePhotoFromLayout = () => {
    if (selectedPhoto) {
      const page = album.pages.find(p => p.id === selectedPhoto.pageId)
      if (page) {
        const newLayouts = page.layouts.map(l =>
          l.id === selectedPhoto.layoutId ? { ...l, photoId: "" } : l
        )
        updatePage(page.id, newLayouts)
        setSelectedPhoto(null)
      }
    }
  }

  const handleSidebarPhotoSelect = (photoId: string) => {
    console.log("Sidebar photo selected:", photoId, "Current selection:", selectedPhoto);

    if (selectedPhoto) {
      const page = album.pages.find(p => p.id === selectedPhoto.pageId)
      if (page) {
        // Check if layout exists
        const layoutExists = page.layouts.some(l => l.id === selectedPhoto.layoutId);
        if (!layoutExists) {
          console.error("Layout not found:", selectedPhoto.layoutId);
          return;
        }

        const newLayouts = page.layouts.map(l =>
          l.id === selectedPhoto.layoutId ? { ...l, photoId: photoId } : l
        )
        console.log("Updating page with new layouts:", newLayouts);
        updatePage(page.id, newLayouts)

        // Optional: Provide feedback
        // alert("사진이 추가되었습니다.");
      } else {
        console.error("Page not found:", selectedPhoto.pageId);
      }
    } else {
      alert("사진을 넣을 앨범 칸을 먼저 선택해주세요.")
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

  // 화면 크기에 따라 앨범 페이지 크기 조정 (기본값보다 크게)
  const baseWidth = album.orientation === "portrait" ? 600 : 900 // 기존 400/600에서 1.5배 증가
  const baseHeight = album.orientation === "portrait" ? 849 : 600 // 비율 유지

  return (
    <div className="flex h-[calc(100vh-100px)]">
      {showPdfModal && pdfProgress > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-8 flex flex-col items-center min-w-[300px]">
            <div className="mb-4 text-lg font-semibold">PDF 변환 중...</div>
            <Progress value={pdfProgress} />
            <div className="text-xs text-gray-500 mt-2">{pdfProgress}%</div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-100">
        {/* Toolbar */}
        <div className="bg-white border-b px-6 py-3 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-gray-800">
              {currentPage + 1} / {album.pages.length}
            </h2>
            <div className="h-6 w-px bg-gray-300 mx-2" />
            <div className="flex gap-2">
              <Button
                variant={editMode ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setEditMode(!editMode)
                  if (editMode) {
                    setSelectedPhoto(null)
                    setSwapSource(null)
                  }
                }}
                className={editMode ? "bg-blue-600 hover:bg-blue-700" : ""}
              >
                <Edit className="w-4 h-4 mr-2" />
                {editMode ? "편집 종료" : "편집 모드"}
              </Button>

              {editMode && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSidebar(!showSidebar)}
                    className={showSidebar ? "bg-gray-100" : ""}
                  >
                    <ImageIcon className="w-4 h-4 mr-2" />
                    사진 보관함
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    const result = removeEmptyPages()
                    if (result.removedPages.length > 0) {
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
                    <Trash2 className="w-4 h-4 mr-2" />
                    빈 페이지 정리
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleDownloadPDF} variant="default" size="sm" className="bg-green-600 hover:bg-green-700">
              <Download className="w-4 h-4 mr-2" />
              PDF 다운로드
            </Button>
          </div>
        </div>

        {/* Selected Photo Actions Toolbar (Floating) */}
        {editMode && selectedPhoto && !swapSource && (
          <div className="bg-blue-50 border-b border-blue-100 px-6 py-2 flex items-center justify-center gap-4 animate-in slide-in-from-top-2">
            <span className="text-sm font-medium text-blue-900">선택된 칸 작업:</span>
            <Button size="sm" variant="secondary" onClick={startSwap} className="bg-white hover:bg-blue-100 border border-blue-200 text-blue-700">
              <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />
              위치 교체
            </Button>
            <Button size="sm" variant="secondary" onClick={removePhotoFromLayout} className="bg-white hover:bg-red-50 border border-red-200 text-red-600">
              <X className="w-3.5 h-3.5 mr-1.5" />
              사진 비우기
            </Button>
            <span className="text-xs text-blue-400 ml-2">💡 사진 보관함에서 사진을 클릭하면 이곳에 채워집니다</span>
          </div>
        )}

        {/* Swap Mode Indicator */}
        {editMode && swapSource && (
          <div className="bg-yellow-50 border-b border-yellow-100 px-6 py-2 flex items-center justify-center gap-4 animate-in slide-in-from-top-2">
            <span className="text-sm font-medium text-yellow-900 flex items-center">
              <Badge variant="outline" className="mr-2 bg-yellow-100 border-yellow-300 text-yellow-800">교체 모드</Badge>
              교체할 대상 사진을 클릭하세요
            </span>
            <Button size="sm" variant="ghost" onClick={cancelSwap} className="h-7 text-yellow-700 hover:text-yellow-900 hover:bg-yellow-100">
              취소
            </Button>
          </div>
        )}

        {/* Album View Area */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
          <div className="flex-1 overflow-auto p-8 flex items-center" ref={scrollContainerRef}>
            <div className="flex gap-8 mx-auto" style={{ width: "max-content" }}>
              {album.pages.map((page, index) => {
                const availableTemplates = templates
                  ? templates.filter((t) => t.orientation === album.orientation)
                  : [];

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
                    className={`flex flex-col gap-3 transition-all duration-300 ${index === currentPage ? "opacity-100 scale-100" : "opacity-40 scale-95 blur-[1px]"
                      }`}
                  >
                    {/* Template Selector */}
                    {editMode && index === currentPage && (
                      <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border border-gray-200 w-full">
                        <Layout className="w-4 h-4 text-gray-500" />
                        <select
                          className="flex-1 text-sm bg-transparent border-none focus:ring-0 cursor-pointer"
                          value={page.templateId || ""}
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            const selectedTemplate = templates.find((t) => t.id === selectedId);
                            if (selectedTemplate) {
                              handleLayoutChangeWithPhotoManagement(index, page, selectedTemplate);
                            }
                          }}
                        >
                          <option value="">레이아웃 변경...</option>
                          {sameCountTemplates.length > 0 && (
                            <optgroup label={`현재와 동일 (${page.layouts.length}장)`}>
                              {sameCountTemplates.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </optgroup>
                          )}
                          {differentCountTemplates.length > 0 && (
                            <optgroup label="다른 장수 (새 페이지 생성)">
                              {differentCountTemplates.map((t) => (
                                <option key={t.id} value={t.id}>{t.name} ({t.photoCount}장)</option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </div>
                    )}

                    {/* Album Page */}
                    <div
                      className="relative shadow-2xl transition-all duration-300 bg-white"
                      style={{
                        width: `${baseWidth}px`,
                        height: `${baseHeight}px`,
                      }}
                    >
                      <AlbumPage
                        page={page}
                        photos={photos}
                        theme={album.theme}
                        orientation={album.orientation}
                        editMode={editMode}
                        selectedPhoto={selectedPhoto}
                        onPhotoSelect={handlePhotoSelect}
                      />

                      {/* Swap Source Indicator Overlay */}
                      {swapSource && swapSource.pageId === page.id && (
                        <div className="absolute inset-0 pointer-events-none z-20">
                          {page.layouts.map(layout => {
                            if (layout.id === swapSource.layoutId) {
                              return (
                                <div
                                  key={`swap-indicator-${layout.id}`}
                                  className="absolute border-4 border-yellow-400 animate-pulse"
                                  style={{
                                    left: `${layout.x}%`,
                                    top: `${layout.y}%`,
                                    width: `${layout.width}%`,
                                    height: `${layout.height}%`,
                                  }}
                                />
                              )
                            }
                            return null
                          })}
                        </div>
                      )}
                    </div>

                    <div className="text-center font-medium text-gray-500">
                      Page {index + 1}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Navigation Buttons */}
          <Button
            variant="secondary"
            size="icon"
            className="absolute left-4 top-1/2 transform -translate-y-1/2 h-12 w-12 rounded-full shadow-lg bg-white/80 hover:bg-white"
            onClick={prevPage}
            disabled={currentPage === 0}
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>

          <Button
            variant="secondary"
            size="icon"
            className="absolute right-4 top-1/2 transform -translate-y-1/2 h-12 w-12 rounded-full shadow-lg bg-white/80 hover:bg-white"
            onClick={nextPage}
            disabled={currentPage === album.pages.length - 1}
          >
            <ChevronRight className="w-6 h-6" />
          </Button>

          {/* Page Indicator */}
          <div className="h-16 border-t bg-white flex items-center justify-center gap-2 overflow-x-auto px-4">
            {album.pages.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentPage(index)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all
                  ${index === currentPage
                    ? "bg-blue-600 text-white shadow-md scale-110"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"}
                `}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Photo Sidebar */}
      <PhotoSidebar
        isOpen={showSidebar}
        onClose={() => setShowSidebar(false)}
        onPhotoSelect={handleSidebarPhotoSelect}
      />
    </div>
  )
}
