"use client"

import React from "react"

import { useState, useRef, useCallback } from "react"
import type { Photo, PhotoLayout } from "@/types/album"

interface PhotoFrameProps {
  layout: PhotoLayout
  photo: Photo
  editMode: boolean
  pageId: string
  isSelected: boolean
  onLayoutChange: (newLayout: Partial<PhotoLayout>) => void
  onPhotoSelect: (layoutId: string, pageId: string) => void
  metadataTextColor?: string;
  metadataTextSize?: string;
  theme?: string;
}

export function PhotoFrame({ 
  layout, 
  photo, 
  editMode, 
  pageId, 
  isSelected, 
  onLayoutChange, 
  onPhotoSelect,
  metadataTextColor,
  metadataTextSize,
  theme 
}: PhotoFrameProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const frameRef = useRef<HTMLDivElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // 미리보기 URL 동적 생성 및 해제
  React.useEffect(() => {
    if (photo.thumbnailUrl) {
      setPreviewUrl(photo.thumbnailUrl)
    } else if (photo.file) {
      const url = URL.createObjectURL(photo.file)
      setPreviewUrl(url)
      return () => {
        URL.revokeObjectURL(url)
      }
    } else if (photo.url) {
      setPreviewUrl(photo.url)
    } else {
      setPreviewUrl("/placeholder.svg")
    }
  }, [photo.thumbnailUrl, photo.file, photo.url])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!editMode) return

      e.preventDefault()
      setIsDragging(true)
      setDragStart({ x: e.clientX, y: e.clientY })
    },
    [editMode],
  )

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!editMode || isDragging) return
      e.stopPropagation()
      onPhotoSelect(layout.id, pageId)
    },
    [editMode, isDragging, layout.id, pageId, onPhotoSelect],
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !frameRef.current) return

      const frame = frameRef.current
      const rect = frame.getBoundingClientRect()

      const deltaX = e.clientX - dragStart.x
      const deltaY = e.clientY - dragStart.y

      // 프레임 크기 대비 이동 비율 계산
      const moveX = (deltaX / rect.width) * 50
      const moveY = (deltaY / rect.height) * 50

      const currentPhotoX = layout.photoX || 50
      const currentPhotoY = layout.photoY || 50

      const newPhotoX = Math.max(0, Math.min(100, currentPhotoX - moveX))
      const newPhotoY = Math.max(0, Math.min(100, currentPhotoY - moveY))

      onLayoutChange({
        photoX: newPhotoX,
        photoY: newPhotoY,
      })

      setDragStart({ x: e.clientX, y: e.clientY })
    },
    [isDragging, dragStart, layout.photoX, layout.photoY, onLayoutChange],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // 마우스 이벤트 리스너 등록
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)

      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  const photoX = layout.photoX || 50
  const photoY = layout.photoY || 50

  return (
    <div
      ref={frameRef}
      className={`absolute overflow-hidden rounded-md shadow-sm transition-all duration-200 ${
        editMode 
          ? `border-2 cursor-move ${
              isSelected 
                ? "border-blue-500 shadow-lg transform scale-105 z-10" 
                : "border-dashed border-blue-400 hover:border-blue-500"
            }` 
          : "border border-gray-200"
      }`}
      style={{
        left: `${layout.x}%`,
        top: `${layout.y}%`,
        width: `${layout.width}%`,
        height: `${layout.height}%`,
      }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      <img
        src={previewUrl || "/placeholder.svg"}
        alt=""
        className="w-full h-full object-cover select-none"
        style={{
          objectPosition: `${photoX}% ${photoY}%`,
          transform: isDragging ? "scale(1.02)" : "scale(1)",
          transition: isDragging ? "none" : "transform 0.2s ease",
        }}
        draggable={false}
      />
      {editMode && (
        <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center pointer-events-none">
          <div className={`rounded px-2 py-1 text-xs shadow ${
            theme === 'black' 
              ? 'bg-gray-800 text-white border border-gray-600' 
              : 'bg-white text-gray-900'
          }`}>
            {isSelected ? "선택됨 - 다른 사진 클릭" : "클릭하여 선택"}
          </div>
        </div>
      )}
      {(photo.date || photo.location) && (
        <div 
          className={`absolute bottom-0 left-0 right-0 p-1.5 bg-black bg-opacity-60 pointer-events-none ${metadataTextSize || 'text-xs'}`}
          style={{ color: metadataTextColor || '#FFFFFF' }}
        >
          {photo.date && <span>{photo.date}</span>}
          {photo.date && photo.location && <span className="mx-1">|</span>}
          {photo.location && <span>{photo.location}</span>}
        </div>
      )}
    </div>
  )
}
