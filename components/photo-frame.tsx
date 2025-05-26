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
}

export function PhotoFrame({ layout, photo, editMode, pageId, isSelected, onLayoutChange, onPhotoSelect }: PhotoFrameProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const frameRef = useRef<HTMLDivElement>(null)

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
        src={photo.url || "/placeholder.svg"}
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
          <div className="bg-white rounded px-2 py-1 text-xs shadow">
            {isSelected ? "선택됨 - 다른 사진 클릭" : "클릭하여 선택"}
          </div>
        </div>
      )}
    </div>
  )
}
