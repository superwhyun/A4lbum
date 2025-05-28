"use client"

import type React from "react"

import { useCallback, useState } from "react"
import { Upload } from "lucide-react"
import { useAlbum } from "@/contexts/album-context"
import { Progress } from "@/components/ui/progress"

export function PhotoDropzone() {
  const [isDragOver, setIsDragOver] = useState(false)
  const { addPhotos, uploadProgress } = useAlbum()

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)

      const files = Array.from(e.dataTransfer.files).filter((file) => file.type.startsWith("image/"))

      if (files.length > 0) {
        addPhotos(files)
      }
    },
    [addPhotos],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      if (files.length > 0) {
        addPhotos(files)
      }
    },
    [addPhotos],
  )

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
        isDragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {uploadProgress > 0 && (
        <div className="mb-4">
          <Progress value={uploadProgress} />
          <div className="text-xs text-gray-500 mt-1">{uploadProgress}%</div>
        </div>
      )}
      <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
      <p className="text-lg font-medium text-gray-900 mb-2">사진을 드래그하여 업로드하세요</p>
      <p className="text-sm text-gray-500 mb-4">또는 클릭하여 파일을 선택하세요</p>
      <input type="file" multiple accept="image/*" onChange={handleFileInput} className="hidden" id="file-input" />
      <label
        htmlFor="file-input"
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
      >
        파일 선택
      </label>
    </div>
  )
}
