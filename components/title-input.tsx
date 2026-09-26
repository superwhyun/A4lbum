"use client"

import { useState, useCallback, useRef, useEffect } from "react"

interface TitleInputProps {
  title: string
  position: { x: number; y: number }
  editMode: boolean
  theme: string
  onTitleChange: (title: string) => void
  onPositionChange: (position: { x: number; y: number }) => void
  style?: { fontSize?: number; color?: string; fontFamily?: string }
  onStyleChange?: (style: { fontSize?: number; color?: string; fontFamily?: string }) => void
}

export function TitleInput({
  title,
  position,
  editMode,
  theme,
  onTitleChange,
  onPositionChange,
  style,
  onStyleChange
}: TitleInputProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isEditing, setIsEditing] = useState(false)
  const [localTitle, setLocalTitle] = useState(title)
  const titleRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Default styles
  const fontSize = style?.fontSize || 24
  const color = style?.color || (theme === 'black' ? '#FFFFFF' : '#111827')

  useEffect(() => {
    setLocalTitle(title)
  }, [title])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!editMode) return
    // 편집 중일 때는 드래그 방지 (입력 필드 포커스 유지 등을 위해)
    if (isEditing) return

    e.preventDefault()
    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
  }, [editMode, isEditing])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !titleRef.current) return

    const container = titleRef.current.parentElement
    if (!container) return

    const rect = container.getBoundingClientRect()
    const deltaX = e.clientX - dragStart.x
    const deltaY = e.clientY - dragStart.y

    const moveX = (deltaX / rect.width) * 100
    const moveY = (deltaY / rect.height) * 100

    const newX = Math.max(0, Math.min(100, position.x + moveX))
    const newY = Math.max(0, Math.min(100, position.y + moveY))

    onPositionChange({ x: newX, y: newY })
    setDragStart({ x: e.clientX, y: e.clientY })
  }, [isDragging, dragStart, position, onPositionChange])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // 드래그 이벤트 리스너
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  const handleDoubleClick = useCallback(() => {
    if (!editMode) return
    setIsEditing(true)
  }, [editMode])

  const handleTitleSubmit = useCallback(() => {
    onTitleChange(localTitle)
    setIsEditing(false)
  }, [localTitle, onTitleChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSubmit()
    } else if (e.key === 'Escape') {
      setLocalTitle(title)
      setIsEditing(false)
    }
  }, [handleTitleSubmit, title])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isEditing && containerRef.current && !containerRef.current.contains(event.target as Node)) {
        handleTitleSubmit()
      }
    }

    if (isEditing) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isEditing, handleTitleSubmit])

  const getTextColor = () => {
    if (style?.color) return style.color
    if (theme === 'black') return 'text-white'
    return 'text-gray-900'
  }

  const getEditStyles = () => {
    if (theme === 'black') {
      return 'bg-gray-800 text-white border-gray-600'
    }
    return 'bg-white text-gray-900 border-gray-300'
  }

  return (
    <div
      ref={containerRef}
      className={`absolute select-none ${editMode && !isEditing ? 'cursor-move' : 'cursor-default'} ${editMode && !isEditing ? 'hover:bg-black hover:bg-opacity-10 rounded p-1' : ''
        }`}
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: 20,
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {isEditing ? (
        <div className="flex flex-col items-center gap-2">
          {/* Style Toolbar */}
          <div
            className="flex items-center gap-2 bg-white p-1.5 rounded shadow-lg border border-gray-200 mb-1"
            onMouseDown={(e) => e.stopPropagation()} // 툴바 클릭 시 드래그/이벤트 전파 방지
          >
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">크기</span>
              <input
                type="number"
                value={fontSize}
                onChange={(e) => onStyleChange?.({ ...style, fontSize: Number(e.target.value) })}
                className="w-12 px-1 py-0.5 text-xs border rounded text-black"
                min="12"
                max="100"
              />
            </div>
            <div className="w-px h-4 bg-gray-200 mx-1"></div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">색상</span>
              <input
                type="color"
                value={color}
                onChange={(e) => onStyleChange?.({ ...style, color: e.target.value })}
                className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
              />
            </div>
          </div>

          <input
            type="text"
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`text-center font-bold px-2 py-1 border rounded ${getEditStyles()}`}
            autoFocus
            style={{
              minWidth: '200px',
              whiteSpace: 'nowrap',
              fontSize: `${fontSize}px`,
              color: color
            }}
          />
        </div>
      ) : (
        <div
          className={`font-bold text-center px-2 py-1 ${theme === 'black' ? 'text-shadow-lg' : 'drop-shadow-lg'
            }`}
          style={{
            fontSize: `${fontSize}px`,
            color: style?.color || (theme === 'black' ? '#FFFFFF' : '#111827'),
            textShadow: theme === 'black' ? '2px 2px 4px rgba(255,255,255,0.3)' : '2px 2px 4px rgba(0,0,0,0.3)',
            whiteSpace: 'nowrap',
            minWidth: 'max-content'
          }}
        >
          {title}
          {editMode && (
            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded opacity-0 hover:opacity-100 transition-opacity whitespace-nowrap">
              더블클릭하여 편집
            </div>
          )}
        </div>
      )}
    </div>
  )
}