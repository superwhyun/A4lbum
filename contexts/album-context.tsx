"use client"

import React from "react"
import { createContext, useContext, useState, type ReactNode } from "react"
import { useAuth } from "@/contexts/auth-context"
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
  updateTemplate: (template: LayoutTemplate) => void
  deleteTemplate: (templateId: string) => void
  resetAlbum: () => void
  uploadProgress: number
  setUploadProgress: (value: number) => void
  pdfProgress: number
  setPdfProgress: (value: number) => void
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

      newPhotos.push({
        id: `photo-${Date.now()}-${Math.random()}`,
        file,
        url: "",
        width: img.width,
        height: img.height,
        thumbnailUrl,
      })
      URL.revokeObjectURL(url)
      setUploadProgress(Math.round(((i + 1) / files.length) * 100))
    }

    setPhotos((prev) => [...prev, ...newPhotos])
    setTimeout(() => setUploadProgress(0), 500)
  }

  const generateRandomLayout = (
    photoCount: number,
    orientation: "portrait" | "landscape",
  ): Omit<PhotoLayout, "photoId">[] => {
    const layouts: Omit<PhotoLayout, "photoId">[] = []
    const pageWidth = 100
    const pageHeight = 100
    const gap = 2

    if (photoCount === 3) {
      layouts.push(
        { id: "layout-0", x: 0, y: 0, width: 100, height: 65, photoX: 50, photoY: 50 },
        { id: "layout-1", x: 0, y: 67, width: 49, height: 31, photoX: 50, photoY: 50 },
        { id: "layout-2", x: 51, y: 67, width: 49, height: 31, photoX: 50, photoY: 50 },
      )
    } else if (photoCount === 5) {
      layouts.push(
        { id: "layout-0", x: 0, y: 0, width: 49, height: 30, photoX: 50, photoY: 50 },
        { id: "layout-1", x: 51, y: 0, width: 49, height: 30, photoX: 50, photoY: 50 },
        { id: "layout-2", x: 0, y: 32, width: 100, height: 36, photoX: 50, photoY: 50 },
        { id: "layout-3", x: 0, y: 70, width: 49, height: 28, photoX: 50, photoY: 50 },
        { id: "layout-4", x: 51, y: 70, width: 49, height: 28, photoX: 50, photoY: 50 },
      )
    } else {
      const cols = Math.ceil(Math.sqrt(photoCount))
      const rows = Math.ceil(photoCount / cols)
      const cellWidth = (pageWidth - gap * (cols - 1)) / cols
      const cellHeight = (pageHeight - gap * (rows - 1)) / rows

      for (let i = 0; i < photoCount; i++) {
        const col = i % cols
        const row = Math.floor(i / cols)
        layouts.push({
          id: `layout-${i}`,
          x: col * (cellWidth + gap),
          y: row * (cellHeight + gap),
          width: cellWidth,
          height: cellHeight,
          photoX: 50 + (Math.random() - 0.5) * 20,
          photoY: 50 + (Math.random() - 0.5) * 20,
        })
      }
    }

    return layouts
  }

  // %%%%%LAST%%%%%
  const selectRandomTemplate = (photoCount: number, orientation: "portrait" | "landscape") => {
    const matchingTemplates = templates.filter(
      (t) => t.photoCount === photoCount && t.orientation === orientation,
    )
    if (matchingTemplates.length > 0) {
      return matchingTemplates[Math.floor(Math.random() * matchingTemplates.length)]
    }
    return null
  }

  const createAlbum = (theme: string, orientation: "portrait" | "landscape") => {
    if (photos.length === 0) return

    const pages: AlbumPage[] = []
    let remainingPhotos = [...photos]

    while (remainingPhotos.length > 0) {
      const photosPerPage = Math.min(3 + Math.floor(Math.random() * 4), remainingPhotos.length)
      const pagePhotos = remainingPhotos.splice(0, photosPerPage)

      const template = selectRandomTemplate(photosPerPage, orientation)
      let layouts: PhotoLayout[]

      if (template) {
        layouts = template.layouts.map((layout, index) => ({
          ...layout,
          photoId: pagePhotos[index]?.id || "",
        }))
      } else {
        const randomLayouts = generateRandomLayout(photosPerPage, orientation)
        layouts = randomLayouts.map((layout, index) => ({
          ...layout,
          photoId: pagePhotos[index]?.id || "",
        }))
      }

      pages.push({
        id: `page-${Date.now()}-${Math.random()}`,
        layouts,
        templateId: template?.id,
      })
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

  const updatePage = (pageId: string, layouts: PhotoLayout[]) => {
    if (!album) return

    setAlbum((prev) => ({
      ...prev!,
      pages: prev!.pages.map((page) => (page.id === pageId ? { ...page, layouts } : page)),
    }))
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
        
        let userLayouts: LayoutTemplate[];

        if (saved) {
          try {
            const parsedSavedLayouts = JSON.parse(saved) as LayoutTemplate[];
            if (Array.isArray(parsedSavedLayouts)) {
              const filteredUserLayouts = parsedSavedLayouts.filter(
                (t: LayoutTemplate) => t.id && !t.id.toString().startsWith('server-')
              );
              // If local storage existed but contained no valid user-specific templates (empty or only server-like ones),
              // then fall back to default templates.
              if (filteredUserLayouts.length > 0) {
                userLayouts = filteredUserLayouts;
              } else {
                userLayouts = [...defaultTemplates];
              }
            } else {
              // Parsed data is not an array, fallback to defaults
              console.error('Saved templates format is not an array:', parsedSavedLayouts);
              userLayouts = [...defaultTemplates];
            }
          } catch (error) {
            console.error('템플릿 파싱 실패:', error);
            // If parsing fails, use default templates
            userLayouts = [...defaultTemplates];
          }
        } else {
          // No saved data in local storage, use default templates
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
        addTemplate,
        updateTemplate,
        deleteTemplate,
        resetAlbum,
        uploadProgress,
        setUploadProgress,
        pdfProgress,
        setPdfProgress,
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
