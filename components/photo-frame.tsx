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
  onPhotoContextMenu?: (layoutId: string, pageId: string) => void;
  metadataTextColor?: string;
  metadataTextSize?: string;
  theme?: string;
  isCoverPage?: boolean;
  showMetadata?: boolean;
}

export function PhotoFrame({
  layout,
  photo,
  editMode,
  pageId,
  isSelected,
  onLayoutChange,
  onPhotoSelect,
  onPhotoContextMenu,
  metadataTextColor,
  metadataTextSize,
  theme,
  isCoverPage = false,
  showMetadata = true
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

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!editMode) return
      e.preventDefault()
      e.stopPropagation()
      if (onPhotoContextMenu) {
        onPhotoContextMenu(layout.id, pageId)
      }
    },
    [editMode, layout.id, pageId, onPhotoContextMenu]
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

      const currentPhotoX = layout.photoX ?? 50
      const currentPhotoY = layout.photoY ?? 50

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

  const photoX = layout.photoX ?? 50
  const photoY = layout.photoY ?? 50

  return (
    <div
      ref={frameRef}
      className={`absolute overflow-hidden rounded-md shadow-sm transition-all duration-200 ${isEmpty
        ? editMode
          ? `border-2 border-dashed cursor-pointer ${isSelected
            ? "border-blue-500 bg-blue-50 shadow-lg transform scale-105 z-10"
            : "border-gray-300 bg-gray-50 hover:border-blue-300 hover:bg-blue-25"
          }`
          : "border border-gray-200 bg-gray-50"
        : editMode
          ? `border-2 ${isSelected
            ? "border-blue-500 shadow-lg transform scale-105 z-10 cursor-move"
            : "border-transparent hover:border-blue-300 cursor-pointer"
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
      onContextMenu={handleContextMenu}
    >
      {isEmpty ? (
        // 빈 슬롯 표시
        <div className="w-full h-full flex items-center justify-center">
          {editMode && (
            <div className={`text-xs text-center p-2 ${isSelected ? 'text-blue-600' : 'text-gray-400'
              }`}>
              <div className="mb-1">📷</div>
              <div className="font-medium">빈 슬롯</div>
              {isSelected ? (
                <>
                  <div className="text-[10px] mt-1 text-blue-500 font-bold">선택됨</div>
                </>
              ) : (
                <>
                  <div className="text-[10px] mt-1 text-gray-400">클릭하여 선택</div>
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
            className={`w-full h-full select-none ${layout.fit === "contain" ? "object-contain" : "object-cover"}`}
            style={{
              objectPosition: `${photoX}% ${photoY}%`,
              transform: isDragging ? "scale(1.02)" : "scale(1)",
              transition: isDragging ? "none" : "transform 0.2s ease",
            }}
            draggable={false}
          />
          {editMode && isSelected && (
            <div className="absolute inset-0 border-4 border-blue-500 pointer-events-none z-10 flex items-start justify-end p-2">
              <div className="bg-blue-500 text-white rounded-full p-1 shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
            </div>
          )}
          {!isCoverPage && showMetadata && photo && (photo.date || photo.location) && (
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
