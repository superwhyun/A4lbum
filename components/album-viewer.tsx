"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, Edit, Download } from "lucide-react"
import { useAlbum } from "@/contexts/album-context"
import { Button } from "@/components/ui/button"
import { AlbumPage } from "./album-page"
import { exportAlbumToPDF } from "@/utils/pdf-export"

export function AlbumViewer() {
  const { album, photos, swapPhotos, templates, updatePage } = useAlbum()
  const [currentPage, setCurrentPage] = useState(0)
  const [editMode, setEditMode] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<{ layoutId: string; pageId: string } | null>(null)

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

  const handlePhotoSelect = (layoutId: string, pageId: string) => {
    console.log('Photo selected:', { layoutId, pageId, currentSelected: selectedPhoto })
    
    if (selectedPhoto) {
      // 이미 선택된 사진이 있으면 스위치
      if (selectedPhoto.layoutId !== layoutId || selectedPhoto.pageId !== pageId) {
        console.log('Swapping photos:', {
          from: selectedPhoto,
          to: { layoutId, pageId }
        })
        swapPhotos(selectedPhoto.layoutId, layoutId, selectedPhoto.pageId, pageId)
      }
      setSelectedPhoto(null)
    } else {
      // 첫 번째 선택
      setSelectedPhoto({ layoutId, pageId })
    }
  }

  const handleDownloadPDF = async () => {
    if (!album) return

    try {
      await exportAlbumToPDF(album, photos)
    } catch (error) {
      console.error("PDF 생성 중 오류:", error)
      alert("PDF 생성 중 오류가 발생했습니다.")
    }
  }

  return (
    <div className="space-y-4">
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
        </div>
      </div>

      <div className="relative" id="album-viewer">
        <div className="overflow-x-auto">
          <div className="flex gap-4 pb-4" style={{ width: "max-content" }}>
            {album.pages.map((page, index) => {
              // 편집 모드에서만, 해당 페이지의 사진 수와 orientation이 일치하는 템플릿 목록
              const matchingTemplates = templates
                ? templates.filter(
                    (t) =>
                      t.photoCount === page.layouts.length &&
                      t.orientation === album.orientation
                  )
                : [];
              return (
                <div
                  key={page.id}
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
                            // 기존 photoId 순서대로 새 템플릿에 매핑
                            const newLayouts = selectedTemplate.layouts.map((layout, idx) => ({
                              ...layout,
                              photoId: page.layouts[idx]?.photoId || "",
                              photoX: 50,
                              photoY: 50,
                            }));
                            updatePage(page.id, newLayouts);
                          }
                        }}
                      >
                        <option value="">선택하세요</option>
                        {matchingTemplates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
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
              className={`w-3 h-3 rounded-full transition-colors ${
                index === currentPage ? "bg-blue-500" : "bg-gray-300"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
