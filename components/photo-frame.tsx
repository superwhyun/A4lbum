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
  isCoverPage?: boolean;
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
  theme,
  isCoverPage = false
}: PhotoFrameProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const frameRef = useRef<HTMLDivElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // 빈 슬롯인지 확인
  const isEmpty = !layout.photoId || layout.photoId === ""

  // 미리보기 URL 동적 생성 및 해제
  React.useEffect(() => {
    if (isEmpty) {
      setPreviewUrl(null)
      return
    }
    
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
  }, [photo?.thumbnailUrl, photo?.file, photo?.url, isEmpty])

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
      // 빈 슬롯도 선택 가능하도록 수정
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
        isEmpty
          ? editMode
            ? `border-2 border-dashed cursor-pointer ${
                isSelected 
                  ? "border-blue-500 bg-blue-50 shadow-lg transform scale-105 z-10" 
                  : "border-gray-300 bg-gray-50 hover:border-blue-300 hover:bg-blue-25"
              }`
            : "border border-gray-200 bg-gray-50"
          : editMode 
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
      onMouseDown={isEmpty ? undefined : handleMouseDown}
      onClick={handleClick}
    >
      {isEmpty ? (
        // 빈 슬롯 표시
        <div className="w-full h-full flex items-center justify-center">
          {editMode && (
            <div className={`text-xs text-center p-2 ${
              isSelected ? 'text-blue-600' : 'text-gray-400'
            }`}>
              <div className="mb-1">📷</div>
              <div className="font-medium">빈 슬롯</div>
              {isSelected ? (
                <>
                  <div className="text-[10px] mt-1 text-blue-500">선택됨!</div>
                  <div className="text-[10px]">다른 사진 클릭하여</div>
                  <div className="text-[10px]">여기로 이동</div>
                </>
              ) : (
                <>
                  <div className="text-[10px] mt-1">클릭하여 선택 후</div>
                  <div className="text-[10px]">다른 사진과 스워핑</div>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        // 사진이 있는 경우
        <>
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
          {!isCoverPage && photo && (photo.date || photo.location) && (
            <div 
              className={`absolute bottom-0 left-0 right-0 px-1.5 py-0.5 bg-black bg-opacity-30 pointer-events-none text-[10px] text-right font-nanum-pen`}
              style={{ color: metadataTextColor || '#FFFFFF' }}
            >
              {photo.date && <span>{photo.date}</span>}
              {photo.date && photo.location && <span className="mx-1">|</span>}
              {photo.location && <span>{photo.location}</span>}
            </div>
          )}
        </>
      )}
    </div>
  )
}
