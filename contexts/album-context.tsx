"use client"

import React from "react"
import { createContext, useContext, useState, type ReactNode } from "react"
import type { Photo, Album, LayoutTemplate, AlbumPage, PhotoLayout } from "@/types/album"

interface AlbumContextType {
  photos: Photo[]
  album: Album | null
  templates: LayoutTemplate[]
  addPhotos: (files: File[]) => void
  createAlbum: (theme: string, orientation: "portrait" | "landscape") => void
  updatePage: (pageId: string, layouts: PhotoLayout[]) => void
  swapPhotos: (sourceLayoutId: string, targetLayoutId: string, sourcePageId: string, targetPageId: string) => void
  addTemplate: (template: LayoutTemplate) => void
  deleteTemplate: (templateId: string) => void
}

const AlbumContext = createContext<AlbumContextType | undefined>(undefined)

export function AlbumProvider({ children }: { children: ReactNode }) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [album, setAlbum] = useState<Album | null>(null)
  const defaultTemplates: LayoutTemplate[] = [
    {
      id: "template-3-portrait",
      name: "3장 세로형",
      photoCount: 3,
      orientation: "portrait",
      layouts: [
        { id: "1", x: 0, y: 0, width: 100, height: 63 },
        { id: "2", x: 0, y: 67, width: 49, height: 31 },
        { id: "3", x: 51, y: 67, width: 49, height: 31 },
      ],
    },
    {
      id: "template-4-portrait",
      name: "4장 세로형",
      photoCount: 4,
      orientation: "portrait",
      layouts: [
        { id: "1", x: 0, y: 0, width: 49, height: 48 },
        { id: "2", x: 51, y: 0, width: 49, height: 48 },
        { id: "3", x: 0, y: 52, width: 49, height: 48 },
        { id: "4", x: 51, y: 52, width: 49, height: 48 },
      ],
    },
    {
      id: "template-6-portrait",
      name: "6장 세로형",
      photoCount: 6,
      orientation: "portrait",
      layouts: [
        { id: "1", x: 0, y: 0, width: 32, height: 31 },
        { id: "2", x: 34, y: 0, width: 32, height: 31 },
        { id: "3", x: 68, y: 0, width: 32, height: 31 },
        { id: "4", x: 0, y: 34, width: 32, height: 31 },
        { id: "5", x: 34, y: 34, width: 32, height: 31 },
        { id: "6", x: 68, y: 34, width: 32, height: 31 },
      ],
    },
  ]
  const [templates, setTemplates] = useState<LayoutTemplate[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("a4lbum-templates")
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch {
          return defaultTemplates
        }
      }
    }
    return defaultTemplates
  })

  // templates가 바뀔 때마다 localStorage에 저장
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("a4lbum-templates", JSON.stringify(templates))
    }
  }, [templates])

  const addPhotos = async (files: File[]) => {
    const newPhotos: Photo[] = []

    for (const file of files) {
      // width/height 추출을 위해 임시 URL 사용
      const url = URL.createObjectURL(file)
      const img = new Image()
  
      await new Promise((resolve) => {
        img.onload = resolve
        img.src = url
      })
  
      // 썸네일 생성 (최대 200x200)
      const thumbnailUrl = await new Promise<string>((resolve) => {
        const canvas = document.createElement("canvas")
        const maxSize = 200
        let tw = img.width
        let th = img.height
        if (tw > th) {
          if (tw > maxSize) {
            th = Math.round((th * maxSize) / tw)
            tw = maxSize
          }
        } else {
          if (th > maxSize) {
            tw = Math.round((tw * maxSize) / th)
            th = maxSize
          }
        }
        canvas.width = tw
        canvas.height = th
        const ctx = canvas.getContext("2d")!
        ctx.drawImage(img, 0, 0, tw, th)
        resolve(canvas.toDataURL("image/jpeg", 0.7))
      })

      newPhotos.push({
        id: `photo-${Date.now()}-${Math.random()}`,
        file,
        url: "", // 타입만 맞추고, 실제 사용 시점에 동적 생성
        width: img.width,
        height: img.height,
        thumbnailUrl,
      })
      // 메모리 해제
      URL.revokeObjectURL(url)
    }

    setPhotos((prev) => [...prev, ...newPhotos])
  }

  const generateRandomLayout = (
    photoCount: number,
    orientation: "portrait" | "landscape",
  ): Omit<PhotoLayout, "photoId">[] => {
    const layouts: Omit<PhotoLayout, "photoId">[] = []
    const pageWidth = 100
    const pageHeight = 100
    const gap = 2 // 사진 간 여백

    // 홀수/짝수에 따른 최적 레이아웃 생성
    if (photoCount === 3) {
      // 3장: 위에 1장 크게, 아래 2장 작게
      layouts.push(
        { id: "layout-0", x: 0, y: 0, width: 100, height: 65, photoX: 50, photoY: 50 },
        { id: "layout-1", x: 0, y: 67, width: 49, height: 31, photoX: 50, photoY: 50 },
        { id: "layout-2", x: 51, y: 67, width: 49, height: 31, photoX: 50, photoY: 50 },
      )
    } else if (photoCount === 5) {
      // 5장: 위에 2장, 가운데 1장 크게, 아래 2장
      layouts.push(
        { id: "layout-0", x: 0, y: 0, width: 49, height: 30, photoX: 50, photoY: 50 },
        { id: "layout-1", x: 51, y: 0, width: 49, height: 30, photoX: 50, photoY: 50 },
        { id: "layout-2", x: 0, y: 32, width: 100, height: 36, photoX: 50, photoY: 50 },
        { id: "layout-3", x: 0, y: 70, width: 49, height: 28, photoX: 50, photoY: 50 },
        { id: "layout-4", x: 51, y: 70, width: 49, height: 28, photoX: 50, photoY: 50 },
      )
    } else {
      // 기본 그리드 레이아웃 (4, 6장 등)
      const cols = Math.ceil(Math.sqrt(photoCount))
      const rows = Math.ceil(photoCount / cols)
      const cellWidth = (pageWidth - (cols - 1) * gap) / cols
      const cellHeight = (pageHeight - (rows - 1) * gap) / rows

      for (let i = 0; i < photoCount; i++) {
        const col = i % cols
        const row = Math.floor(i / cols)

        layouts.push({
          id: `layout-${i}`,
          x: col * (cellWidth + gap),
          y: row * (cellHeight + gap),
          width: cellWidth,
          height: cellHeight,
          photoX: 50,
          photoY: 50,
        })
      }
    }

    return layouts
  }

  const createAlbum = (theme: string, orientation: "portrait" | "landscape") => {
    if (photos.length === 0) return

    const pages: AlbumPage[] = []
    let photoIndex = 0

    while (photoIndex < photos.length) {
      const photosPerPage = Math.floor(Math.random() * 4) + 3 // 3-6장
      const remainingPhotos = photos.length - photoIndex
      const actualPhotosPerPage = Math.min(photosPerPage, remainingPhotos)

      // 템플릿 후보 필터 후 랜덤 선택
      const candidates = templates.filter((t) => t.photoCount === actualPhotosPerPage && t.orientation === orientation)
      const template = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : undefined

      let layouts: PhotoLayout[]

      if (template) {
        layouts = template.layouts.map((layout, index) => ({
          ...layout,
          photoId: photos[photoIndex + index].id,
          photoX: 50, // 기본 중앙 위치
          photoY: 50, // 기본 중앙 위치
        }))
      } else {
        const randomLayouts = generateRandomLayout(actualPhotosPerPage, orientation)
        layouts = randomLayouts.map((layout, index) => ({
          ...layout,
          photoId: photos[photoIndex + index].id,
        }))
      }

      pages.push({
        id: `page-${pages.length}`,
        layouts,
        templateId: template?.id,
      })

      photoIndex += actualPhotosPerPage
    }

    setAlbum({
      id: `album-${Date.now()}`,
      pages,
      theme,
      orientation,
    })
  }

  const swapPhotos = (sourceLayoutId: string, targetLayoutId: string, sourcePageId: string, targetPageId: string) => {
    if (!album) return

    console.log('swapPhotos called:', { sourceLayoutId, targetLayoutId, sourcePageId, targetPageId })

    // 소스와 타겟 레이아웃 찾기
    let sourceLayout: PhotoLayout | null = null
    let targetLayout: PhotoLayout | null = null

    album.pages.forEach(page => {
      page.layouts.forEach(layout => {
        if (layout.id === sourceLayoutId && page.id === sourcePageId) {
          sourceLayout = layout
          console.log('Found source layout:', layout)
        }
        if (layout.id === targetLayoutId && page.id === targetPageId) {
          targetLayout = layout
          console.log('Found target layout:', layout)
        }
      })
    })

    if (!sourceLayout || !targetLayout) {
      console.log('Missing layouts:', { sourceLayout, targetLayout })
      return
    }

    // photoId만 교체
    const sourcePhotoId = sourceLayout.photoId
    const targetPhotoId = targetLayout.photoId
    
    console.log('Swapping photoIds:', { sourcePhotoId, targetPhotoId })

    // 새로운 앨범 객체 생성 (불변성 보장)
    const newAlbum = {
      ...album,
      pages: album.pages.map((page) => ({
        ...page,
        layouts: page.layouts.map((layout) => {
          if (layout.id === sourceLayoutId && page.id === sourcePageId) {
            console.log('Updating source layout photoId from', layout.photoId, 'to', targetPhotoId)
            return { ...layout, photoId: targetPhotoId }
          } else if (layout.id === targetLayoutId && page.id === targetPageId) {
            console.log('Updating target layout photoId from', layout.photoId, 'to', sourcePhotoId)
            return { ...layout, photoId: sourcePhotoId }
          }
          return layout
        })
      }))
    }
    
    console.log('New album:', newAlbum)
    setAlbum(newAlbum)
  }

  const updatePage = (pageId: string, layouts: PhotoLayout[]) => {
    if (!album) return

    setAlbum((prev) => ({
      ...prev!,
      pages: prev!.pages.map((page) => (page.id === pageId ? { ...page, layouts } : page)),
    }))
  }

  const addTemplate = (template: LayoutTemplate) => {
    setTemplates((prev) => [...prev, template])
  }

  const deleteTemplate = (templateId: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== templateId))
  }

  return (
    <AlbumContext.Provider
      value={{
        photos,
        album,
        templates,
        addPhotos,
        createAlbum,
        updatePage,
        swapPhotos,
        addTemplate,
        deleteTemplate,
      }}
    >
      {children}
    </AlbumContext.Provider>
  )
}

export function useAlbum() {
  const context = useContext(AlbumContext)
  if (context === undefined) {
    throw new Error("useAlbum must be used within an AlbumProvider")
  }
  return context
}
