"use client"

import React from "react"
import { createContext, useContext, useState, type ReactNode } from "react"
import { useAuth } from "@/contexts/auth-context"
import type { Photo, Album, LayoutTemplate, AlbumPage, PhotoLayout, AlbumDensity } from "@/types/album"
import { extractPhotoDate, extractPhotoLocation } from "@/utils/photo-metadata"
import { detectFaceCenter } from "@/utils/face-detection"
import { buildAlbum, type PhotoSpec } from "@/lib/album-generator"

interface AlbumContextType {
  photos: Photo[]
  album: Album | null
  templates: LayoutTemplate[]
  addPhotos: (files: File[]) => void
  createAlbum: (
    theme: string,
    orientation: "portrait" | "landscape",
    density?: AlbumDensity,
    autoFaceCenter?: boolean,
  ) => Promise<void>
  updatePage: (pageId: string, layouts: PhotoLayout[], pageUpdates?: Partial<AlbumPage>) => void
  swapPhotos: (sourceLayoutId: string, targetLayoutId: string, sourcePageId: string, targetPageId: string) => void
  insertPage: (afterPageIndex: number, newPage: AlbumPage) => void
  removeEmptyPages: () => { removedPages: string[], removedIndices: number[], newTotalPages: number }
  addTemplate: (template: LayoutTemplate) => void
  updateTemplate: (template: LayoutTemplate) => void
  deleteTemplate: (templateId: string) => void
  resetAlbum: () => void
  uploadProgress: number
  setUploadProgress: (value: number) => void
  pdfProgress: number
  setPdfProgress: (value: number) => void
  deletePhoto: (photoId: string) => void
  toggleMetadata: () => void
}

const AlbumContext = createContext<AlbumContextType | undefined>(undefined)

export function AlbumProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [album, setAlbum] = useState<Album | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [pdfProgress, setPdfProgress] = useState(0)

  // 서버에서 관리자 레이아웃 불러오기
  const loadServerLayouts = async () => {
    try {
      const response = await fetch('/api/layouts');
      if (response.ok) {
        const data = await response.json();
        return data.layouts.map((layout: any) => ({
          id: `server-${layout.id}`,
          name: layout.name,
          photoCount: layout.config.photoCount,
          orientation: layout.config.orientation,
          layouts: layout.config.layouts,
        }));
      }
    } catch (error) {
      console.error('Failed to load server layouts:', error);
    }
    return [];
  };

  // 사용자별 localStorage 키 생성
  const getStorageKey = (key: string) => {
    if (!user) return `a4lbum-${key}-guest`;
    const userId = user.id ? String(user.id) : 'guest';
    return `a4lbum-${key}-user-${userId}`;
  };

  const defaultTemplates: LayoutTemplate[] = [
    // 1장 (Sparse)
    {
      id: "template-1-portrait",
      name: "1장 전체",
      photoCount: 1,
      orientation: "portrait",
      layouts: [
        { id: "1", x: 0, y: 0, width: 100, height: 100 },
      ],
    },
    {
      id: "template-1-landscape",
      name: "1장 전체",
      photoCount: 1,
      orientation: "landscape",
      layouts: [
        { id: "1", x: 0, y: 0, width: 100, height: 100 },
      ],
    },
    // 2장 (Sparse)
    {
      id: "template-2-portrait-v",
      name: "2장 상하",
      photoCount: 2,
      orientation: "portrait",
      layouts: [
        { id: "1", x: 0, y: 0, width: 100, height: 49 },
        { id: "2", x: 0, y: 51, width: 100, height: 49 },
      ],
    },
    {
      id: "template-2-landscape-h",
      name: "2장 좌우",
      photoCount: 2,
      orientation: "landscape",
      layouts: [
        { id: "1", x: 0, y: 0, width: 49, height: 100 },
        { id: "2", x: 51, y: 0, width: 49, height: 100 },
      ],
    },
    // 3장 (Medium)
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
    // 4장 (Medium)
    {
      id: "template-4-portrait",
      name: "4장 그리드",
      photoCount: 4,
      orientation: "portrait",
      layouts: [
        { id: "1", x: 0, y: 0, width: 49, height: 48 },
        { id: "2", x: 51, y: 0, width: 49, height: 48 },
        { id: "3", x: 0, y: 52, width: 49, height: 48 },
        { id: "4", x: 51, y: 52, width: 49, height: 48 },
      ],
    },
    // 5장 (Medium/Dense)
    {
      id: "template-5-portrait",
      name: "5장 혼합",
      photoCount: 5,
      orientation: "portrait",
      layouts: [
        { id: "1", x: 0, y: 0, width: 49, height: 32 },
        { id: "2", x: 51, y: 0, width: 49, height: 32 },
        { id: "3", x: 0, y: 34, width: 100, height: 32 },
        { id: "4", x: 0, y: 68, width: 49, height: 32 },
        { id: "5", x: 51, y: 68, width: 49, height: 32 },
      ],
    },
    // 6장 (Dense)
    {
      id: "template-6-portrait",
      name: "6장 그리드",
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
    // 8장 (Dense)
    {
      id: "template-8-portrait",
      name: "8장 그리드",
      photoCount: 8,
      orientation: "portrait",
      layouts: [
        { id: "1", x: 0, y: 0, width: 49, height: 23 },
        { id: "2", x: 51, y: 0, width: 49, height: 23 },
        { id: "3", x: 0, y: 25, width: 49, height: 23 },
        { id: "4", x: 51, y: 25, width: 49, height: 23 },
        { id: "5", x: 0, y: 50, width: 49, height: 23 },
        { id: "6", x: 51, y: 50, width: 49, height: 23 },
        { id: "7", x: 0, y: 75, width: 49, height: 23 },
        { id: "8", x: 51, y: 75, width: 49, height: 23 },
      ],
    },
    // 9장 (Dense)
    {
      id: "template-9-portrait",
      name: "9장 3x3",
      photoCount: 9,
      orientation: "portrait",
      layouts: [
        { id: "1", x: 0, y: 0, width: 32, height: 32 },
        { id: "2", x: 34, y: 0, width: 32, height: 32 },
        { id: "3", x: 68, y: 0, width: 32, height: 32 },
        { id: "4", x: 0, y: 34, width: 32, height: 32 },
        { id: "5", x: 34, y: 34, width: 32, height: 32 },
        { id: "6", x: 68, y: 34, width: 32, height: 32 },
        { id: "7", x: 0, y: 68, width: 32, height: 32 },
        { id: "8", x: 34, y: 68, width: 32, height: 32 },
        { id: "9", x: 68, y: 68, width: 32, height: 32 },
      ],
    },
  ]

  const [templates, setTemplates] = useState<LayoutTemplate[]>([])

  // %%%%%LAST%%%%%
  const addPhotos = async (files: File[]) => {
    const newPhotos: Photo[] = []
    setUploadProgress(0)
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const url = URL.createObjectURL(file)
      const img = new Image()
      await new Promise((resolve) => {
        img.onload = resolve
        img.src = url
      })

      const canvas = document.createElement("canvas")
      const maxSize = 200
      let { width: tw, height: th } = img
      if (tw > th) {
        if (tw > maxSize) {
          th = (th * maxSize) / tw
          tw = maxSize
        }
      } else {
        if (th > maxSize) {
          tw = (tw * maxSize) / th
          th = maxSize
        }
      }
      canvas.width = tw
      canvas.height = th
      const ctx = canvas.getContext("2d")!
      ctx.drawImage(img, 0, 0, tw, th)
      const thumbnailUrl = canvas.toDataURL("image/jpeg", 0.7)

      // 사진 촬영 날짜 및 위치 정보 추출
      const photoDate = await extractPhotoDate(file)
      const photoLocation = await extractPhotoLocation(file)

      newPhotos.push({
        id: `photo-${Date.now()}-${Math.random()}`,
        file,
        url: "",
        width: img.width,
        height: img.height,
        thumbnailUrl,
        date: photoDate,
        location: photoLocation,
      })
      URL.revokeObjectURL(url)
      setUploadProgress(Math.round(((i + 1) / files.length) * 100))
    }

    setPhotos((prev) => [...prev, ...newPhotos])
    setTimeout(() => setUploadProgress(0), 500)
  }

  // 레이아웃 구성 로직은 lib/album-generator.ts에 있다 (CLI와 공유)
  const createAlbum = async (theme: string, orientation: "portrait" | "landscape", density: AlbumDensity = "medium", autoFaceCenter: boolean = false) => {
    if (photos.length === 0) return

    // 얼굴 중심 배치를 켠 경우에만 사진별 피사체 좌표를 미리 계산
    const specs: PhotoSpec[] = autoFaceCenter
      ? await Promise.all(
          photos.map(async (photo) => ({
            id: photo.id,
            width: photo.width,
            height: photo.height,
            date: photo.date,
            subject: (await detectFaceCenter(photo.url)) ?? undefined,
          })),
        )
      : photos.map((photo) => ({
          id: photo.id,
          width: photo.width,
          height: photo.height,
          date: photo.date,
        }))

    setAlbum(
      buildAlbum({
        photos: specs,
        templates,
        theme,
        orientation,
        density,
        focusOnSubject: autoFaceCenter,
      }),
    )
  }

  const toggleMetadata = () => {
    if (!album) return
    setAlbum(prev => prev ? { ...prev, showMetadata: !prev.showMetadata } : null)
  }

  const swapPhotos = (sourceLayoutId: string, targetLayoutId: string, sourcePageId: string, targetPageId: string) => {
    if (!album) return

    const sourcePage = album.pages.find(p => p.id === sourcePageId)
    const targetPage = album.pages.find(p => p.id === targetPageId)

    if (!sourcePage || !targetPage) return

    const sourceLayout = sourcePage.layouts.find(l => l.id === sourceLayoutId)
    const targetLayout = targetPage.layouts.find(l => l.id === targetLayoutId)

    if (!sourceLayout || !targetLayout) return

    // %%%%%LAST%%%%%    const sourcePhotoId = sourceLayout.photoId
    const sourcePhotoId = sourceLayout.photoId
    const targetPhotoId = targetLayout.photoId

    const newAlbum = {
      ...album,
      pages: album.pages.map((page) => ({
        ...page,
        layouts: page.layouts.map((layout) => {
          if (layout.id === sourceLayoutId && page.id === sourcePageId) {
            return { ...layout, photoId: targetPhotoId }
          } else if (layout.id === targetLayoutId && page.id === targetPageId) {
            return { ...layout, photoId: sourcePhotoId }
          }
          return layout
        })
      }))
    }

    setAlbum(newAlbum)
  }

  const updatePage = (pageId: string, layouts: PhotoLayout[], pageUpdates?: Partial<AlbumPage>) => {
    if (!album) return

    setAlbum((prev) => ({
      ...prev!,
      pages: prev!.pages.map((page) =>
        page.id === pageId ? { ...page, layouts, ...pageUpdates } : page
      ),
    }))
  }

  const insertPage = (afterPageIndex: number, newPage: AlbumPage) => {
    if (!album) return

    setAlbum((prev) => ({
      ...prev!,
      pages: [
        ...prev!.pages.slice(0, afterPageIndex + 1),
        newPage,
        ...prev!.pages.slice(afterPageIndex + 1)
      ]
    }))
  }

  const removeEmptyPages = () => {
    if (!album) return { removedPages: [], removedIndices: [], newTotalPages: 0 }

    const removedPageIds: string[] = []
    const removedIndices: number[] = []

    const nonEmptyPages = album.pages.filter((page, index) => {
      // 표지 페이지는 삭제하지 않음
      if (page.isCoverPage) return true

      // 모든 레이아웃이 빈 경우 (photoId가 없거나 빈 문자열인 경우)
      const isEmpty = page.layouts.every(layout => !layout.photoId || layout.photoId === "")

      if (isEmpty) {
        removedPageIds.push(page.id)
        removedIndices.push(index)
      }

      return !isEmpty
    })

    // 삭제할 페이지가 있는 경우에만 상태 업데이트
    if (removedPageIds.length > 0) {
      setAlbum((prev) => ({
        ...prev!,
        pages: nonEmptyPages
      }))
    }

    return {
      removedPages: removedPageIds,
      removedIndices,
      newTotalPages: nonEmptyPages.length
    }
  }

  const addTemplate = async (template: LayoutTemplate) => {
    if (user && user.role === "admin") {
      try {
        const response = await fetch("/api/layouts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: template.name,
            config: {
              photoCount: template.photoCount,
              orientation: template.orientation,
              layouts: template.layouts,
            },
          }),
        })

        if (response.ok) {
          const apiResponse = await response.json()
          const newServerTemplate: LayoutTemplate = {
            ...template,
            id: `server-${apiResponse.id}`,
          }
          setTemplates((prev) => [...prev, newServerTemplate])
          // Admin templates are not saved to local storage
        } else {
          console.error("Failed to save template to server:", await response.text())
          // Optionally, handle server error (e.g., show a notification to the admin)
        }
      } catch (error) {
        console.error("Error saving template to server:", error)
        // Optionally, handle network error
      }
    } else {
      // Non-admin users: save to local storage
      setTemplates((prev) => {
        // Ensure the template ID for non-admins doesn't accidentally start with server-
        // This could happen if a non-admin somehow submits a template with such an ID.
        const newTemplate = {
          ...template,
          id: template.id.startsWith('server-') ? `user-${Date.now()}-${Math.random()}` : template.id
        };
        const newTemplates = [...prev, newTemplate];

        if (typeof window !== "undefined") {
          const userTemplates = newTemplates.filter(t => !t.id.startsWith('server-'));
          const storageKey = getStorageKey('templates');
          localStorage.setItem(storageKey, JSON.stringify(userTemplates));
        }
        return newTemplates;
      });
    }
  }

  const updateTemplate = async (template: LayoutTemplate) => {
    if (user && user.role === "admin" && template.id.startsWith("server-")) {
      const numericIdString = template.id.split("server-")[1]
      const numericId = parseInt(numericIdString, 10)

      if (isNaN(numericId)) {
        console.error("Invalid server template ID for update:", template.id)
        return // Or handle error appropriately
      }

      try {
        const response = await fetch(`/api/layouts`, { // As per prompt, PUT to /api/layouts
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: numericId, // numeric ID in body
            name: template.name,
            config: {
              photoCount: template.photoCount,
              orientation: template.orientation,
              layouts: template.layouts,
            },
          }),
        })

        if (response.ok) {
          // const updatedServerTemplate = await response.json(); // API might return the updated template
          setTemplates((prev) =>
            prev.map((t) => (t.id === template.id ? { ...template /*, id: `server-${updatedServerTemplate.id}` if ID can change */ } : t)),
          )
          // Server-managed templates are not saved to local storage by admin actions
        } else {
          console.error("Failed to update template on server:", await response.text())
          // Optionally, handle server error (e.g., show a notification to the admin)
        }
      } catch (error) {
        console.error("Error updating template on server:", error)
        // Optionally, handle network error
      }
    } else {
      // Non-admin users or user-specific templates: update in state and local storage
      setTemplates((prev) => {
        const newTemplates = prev.map((t) => (t.id === template.id ? template : t))

        if (typeof window !== "undefined" && !template.id.startsWith("server-")) {
          // Only save to localStorage if it's a user template
          const userTemplates = newTemplates.filter(t => !t.id.startsWith('server-'));
          const storageKey = getStorageKey('templates');
          localStorage.setItem(storageKey, JSON.stringify(userTemplates));
        }
        return newTemplates
      })
    }
  }

  // %%%%%LAST%%%%%
  const deleteTemplate = async (templateId: string) => {
    if (user && user.role === "admin" && templateId.startsWith("server-")) {
      const numericIdString = templateId.split("server-")[1]
      const numericId = parseInt(numericIdString, 10)

      if (isNaN(numericId)) {
        console.error("Invalid server template ID for delete:", templateId)
        return // Or handle error appropriately
      }

      try {
        const response = await fetch(`/api/layouts?id=${numericId}`, {
          method: "DELETE",
        })

        if (response.ok) {
          setTemplates((prev) => prev.filter((t) => t.id !== templateId))
          // Server-managed templates are not manipulated in local storage by admin actions
        } else {
          console.error("Failed to delete template from server:", await response.text())
          // Optionally, handle server error (e.g., show a notification to the admin)
        }
      } catch (error) {
        console.error("Error deleting template from server:", error)
        // Optionally, handle network error
      }
    } else {
      // For non-admins, or for user-specific templates (even if admin is deleting their own local template)
      setTemplates((prev) => {
        const newTemplates = prev.filter((t) => t.id !== templateId)

        if (typeof window !== "undefined" && !templateId.startsWith("server-")) {
          // Only update local storage if it's a user-specific template being deleted.
          // Server templates (even if removed from local view for non-admins) should not affect user template storage.
          const userOnlyTemplates = newTemplates.filter(t => !t.id.startsWith('server-'));
          const storageKey = getStorageKey('templates');
          localStorage.setItem(storageKey, JSON.stringify(userOnlyTemplates));
        }
        return newTemplates
      })
    }
  }

  React.useEffect(() => {
    const loadAllTemplates = async () => {
      if (typeof window !== "undefined") {
        const serverLayouts = await loadServerLayouts();

        const storageKey = getStorageKey('templates');
        const saved = localStorage.getItem(storageKey);

        let userLayouts: LayoutTemplate[] = [];

        if (saved) {
          try {
            const parsedSavedLayouts = JSON.parse(saved) as LayoutTemplate[];
            if (Array.isArray(parsedSavedLayouts)) {
              // Filter out server templates from local storage just in case
              const savedUserLayouts = parsedSavedLayouts.filter(
                (t: LayoutTemplate) => t.id && !t.id.toString().startsWith('server-')
              );

              // Merge saved layouts with default templates
              // If a default template ID is NOT in saved layouts, add it.
              // This ensures new default templates appear even for existing users.
              const savedIds = new Set(savedUserLayouts.map(t => t.id));
              const missingDefaults = defaultTemplates.filter(t => !savedIds.has(t.id));

              userLayouts = [...savedUserLayouts, ...missingDefaults];
            } else {
              userLayouts = [...defaultTemplates];
            }
          } catch (error) {
            console.error('템플릿 파싱 실패:', error);
            userLayouts = [...defaultTemplates];
          }
        } else {
          userLayouts = [...defaultTemplates];
        }

        const allTemplates = [...serverLayouts, ...userLayouts];
        setTemplates(allTemplates);
      }
    };

    if (user !== undefined) {
      loadAllTemplates();
    }
  }, [user]);

  const resetAlbum = () => {
    setAlbum(null);
    setPhotos([]);
  };

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
        insertPage,
        removeEmptyPages,
        addTemplate,
        updateTemplate,
        deleteTemplate,
        resetAlbum,
        uploadProgress,
        setUploadProgress,
        pdfProgress,
        setPdfProgress,
        toggleMetadata,
        deletePhoto: (photoId: string) => {
          setPhotos((prev) => prev.filter((p) => p.id !== photoId))
          // Also remove from album if used
          if (album) {
            setAlbum((prev) => ({
              ...prev!,
              pages: prev!.pages.map((page) => ({
                ...page,
                layouts: page.layouts.map((layout) =>
                  layout.photoId === photoId ? { ...layout, photoId: "" } : layout
                )
              }))
            }))
          }
        },
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
