"use client"

import { useState } from "react"
import type { Photo, AlbumPage as AlbumPageType, PhotoLayout } from "@/types/album"
import { useAlbum } from "@/contexts/album-context"
import { PhotoFrame } from "./photo-frame"
import { TitleInput } from "./title-input"
import { A4_SIZE } from "@/types/album"

interface AlbumPageProps {
  page: AlbumPageType
  photos: Photo[]
  theme: string
  orientation: "portrait" | "landscape"
  editMode: boolean
  selectedPhoto: { layoutId: string; pageId: string } | null
  onPhotoSelect: (layoutId: string, pageId: string) => void
}

export function AlbumPage({ page, photos, theme, orientation, editMode, selectedPhoto, onPhotoSelect }: AlbumPageProps) {
  const { updatePage } = useAlbum()
  
  // 로컬 상태 제거하고 직접 page.layouts 사용
  const layouts = page.layouts

  const getThemeStyles = (theme: string) => {
    const styles = {
      classic: "bg-amber-50 border-amber-200",
      modern: "bg-gray-50 border-gray-200",
      vintage: "bg-yellow-50 border-yellow-200",
      minimal: "bg-white border-gray-100",
      colorful: "bg-gradient-to-br from-pink-50 to-blue-50 border-purple-200",
      elegant: "bg-purple-50 border-purple-200",
      rustic: "bg-orange-50 border-orange-200",
      artistic: "bg-pink-50 border-pink-200",
      nature: "bg-green-50 border-green-200",
      urban: "bg-blue-50 border-blue-200",
      black: "bg-black border-gray-900 text-white",
    }
    return styles[theme as keyof typeof styles] || styles.classic
  }

  const handleLayoutChange = (layoutId: string, newLayout: Partial<PhotoLayout>) => {
    const updatedLayouts = layouts.map((layout) => (layout.id === layoutId ? { ...layout, ...newLayout } : layout))
    updatePage(page.id, updatedLayouts)
  }

  const handleTitleChange = (newTitle: string) => {
    updatePage(page.id, layouts, { title: newTitle })
  }

  const handleTitlePositionChange = (newPosition: { x: number; y: number }) => {
    updatePage(page.id, layouts, { titlePosition: newPosition })
  }

  // A4 비율과 여백 계산 - 상하좌우 동일한 여백
  const aspectRatio = orientation === "portrait" ? A4_SIZE.WIDTH / A4_SIZE.HEIGHT : A4_SIZE.HEIGHT / A4_SIZE.WIDTH
  const marginPercent = 8 // 8% 여백으로 증가

  return (
    <div
      className={`relative border-2 rounded-lg shadow-lg ${getThemeStyles(theme)}`}
      style={{
        width: "100%",
        height: "100%",
        aspectRatio: aspectRatio,
      }}
    >
      {/* 상하좌우 동일한 여백을 가진 컨텐츠 영역 */}
      <div
        className="relative w-full h-full"
        style={{
          padding: `${marginPercent}%`,
        }}
      >
        {layouts.map((layout) => {
          const photo = photos.find((p) => p.id === layout.photoId)
          if (!photo) return null

          return (
            <PhotoFrame
              key={layout.id}
              layout={layout}
              photo={photo}
              editMode={editMode}
              pageId={page.id}
              isSelected={selectedPhoto?.layoutId === layout.id && selectedPhoto?.pageId === page.id}
              onLayoutChange={(newLayout) => handleLayoutChange(layout.id, newLayout)}
              onPhotoSelect={onPhotoSelect}
              theme={theme}
            />
          )
        })}
        
        {/* 표지 페이지 타이틀 */}
        {page.isCoverPage && (
          <TitleInput
            title={page.title || ""}
            position={page.titlePosition || { x: 50, y: 85 }}
            editMode={editMode}
            theme={theme}
            onTitleChange={handleTitleChange}
            onPositionChange={handleTitlePositionChange}
          />
        )}
      </div>
    </div>
  )
}
