"use client"

import { useState } from "react"
import Link from "next/link"
import { Settings, ImageIcon, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/header"
import { PhotoDropzone } from "@/components/photo-dropzone"
import { ThemeSelector } from "@/components/theme-selector"
import { AlbumViewer } from "@/components/album-viewer"
import { useAlbum } from "@/contexts/album-context"
import { useAuth } from "@/contexts/auth-context"
import type { Theme } from "@/types/album"

export default function HomePage() {
  const { photos, album, createAlbum } = useAlbum()
  const { user } = useAuth()
  const [selectedTheme, setSelectedTheme] = useState<Theme>("classic")
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait")
  const [showPreview, setShowPreview] = useState(true)

  const handleCreateAlbum = () => {
    createAlbum(selectedTheme, orientation)
    setShowPreview(true)
  }

  const handleGoToPreview = () => {
    setShowPreview(true)
  }

  return (
    <div className="min-h-screen bg-gray-50">

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!album || !showPreview ? (
          <div className="space-y-8">
            <div className="text-center">
              <p className="text-lg text-gray-600">사진을 업로드하고 테마를 선택하여 아름다운 앨범을 만들어보세요</p>
            </div>

            <PhotoDropzone />

            {photos.length > 0 && (
              <div className="bg-white rounded-lg p-6 shadow">
                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-4">업로드된 사진 ({photos.length}장)</h3>
                  <div className="grid grid-cols-6 gap-2">
                    {photos.slice(0, 12).map((photo) => (
                      <PhotoThumbnail key={photo.id} photo={photo} />
                    ))}
                    {photos.length > 12 && (
                      <div className="aspect-square bg-gray-100 rounded flex items-center justify-center">
                        <span className="text-sm text-gray-500">+{photos.length - 12}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <ThemeSelector selectedTheme={selectedTheme} onThemeChange={setSelectedTheme} />

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">방향 선택</h3>
                    <div className="flex gap-4">
                      <button
                        onClick={() => setOrientation("portrait")}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          orientation === "portrait" ? "border-blue-500 bg-blue-50" : "border-gray-300"
                        }`}
                      >
                        <div className="w-12 h-16 bg-gray-200 rounded mb-2"></div>
                        <div className="text-sm">세로형</div>
                      </button>
                      <button
                        onClick={() => setOrientation("landscape")}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          orientation === "landscape" ? "border-blue-500 bg-blue-50" : "border-gray-300"
                        }`}
                      >
                        <div className="w-16 h-12 bg-gray-200 rounded mb-2"></div>
                        <div className="text-sm">가로형</div>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="mt-8 text-center">
                  <Button onClick={handleCreateAlbum} size="lg">
                    앨범 만들기
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold text-gray-900">내 앨범</h2>
            </div>
            <AlbumViewer />
          </div>
        )}
      </main>
    </div>
  )
}

// 썸네일 미리보기용 컴포넌트
import React from "react"
function PhotoThumbnail({ photo }: { photo: { thumbnailUrl?: string } }) {
  return (
    <div className="aspect-square">
      <img
        src={photo.thumbnailUrl || "/placeholder.svg"}
        alt=""
        className="w-full h-full object-cover rounded"
      />
    </div>
  )
}
