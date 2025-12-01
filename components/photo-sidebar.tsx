"use client"

import { useState } from "react"
import { X, Trash2, Image as ImageIcon } from "lucide-react"
import { useAlbum } from "@/contexts/album-context"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

interface PhotoSidebarProps {
    isOpen: boolean
    onClose: () => void
    onPhotoSelect?: (photoId: string) => void
}

export function PhotoSidebar({ isOpen, onClose, onPhotoSelect }: PhotoSidebarProps) {
    const { photos, deletePhoto, album } = useAlbum()
    const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null)

    if (!isOpen) return null

    // Check if a photo is used in the album
    const isPhotoUsed = (photoId: string) => {
        if (!album) return false
        return album.pages.some(page =>
            page.layouts.some(layout => layout.photoId === photoId)
        )
    }

    const handleDelete = (photoId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (confirm("정말로 이 사진을 삭제하시겠습니까? 앨범에서도 제거됩니다.")) {
            deletePhoto(photoId)
        }
    }

    return (
        <div
            className="w-80 bg-white border-l border-gray-200 h-full flex flex-col shadow-xl fixed right-0 top-0 bottom-0 z-50 transition-transform duration-300 transform translate-x-0"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                    <ImageIcon className="w-5 h-5" />
                    사진 보관함 ({photos.length})
                </h3>
                <Button variant="ghost" size="icon" onClick={onClose}>
                    <X className="w-5 h-5" />
                </Button>
            </div>

            <ScrollArea className="flex-1 p-4">
                <div className="grid grid-cols-2 gap-3">
                    {photos.map((photo) => {
                        const isUsed = isPhotoUsed(photo.id)
                        return (
                            <div
                                key={photo.id}
                                className={`relative group rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${selectedPhotoId === photo.id ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-100 hover:border-gray-300"
                                    }`}
                                onClick={() => {
                                    console.log("PhotoSidebar item clicked:", photo.id);
                                    setSelectedPhotoId(photo.id)
                                    if (onPhotoSelect) {
                                        console.log("Calling onPhotoSelect prop");
                                        onPhotoSelect(photo.id)
                                    } else {
                                        console.log("onPhotoSelect prop is missing");
                                    }
                                }}
                            >
                                <div className="aspect-square relative">
                                    <img
                                        src={photo.thumbnailUrl || photo.url || "/placeholder.svg"}
                                        alt=""
                                        className="w-full h-full object-cover"
                                    />
                                    {isUsed && (
                                        <div className="absolute top-1 right-1 bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded-full shadow-sm">
                                            사용중
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all" />

                                    <button
                                        onClick={(e) => handleDelete(photo.id, e)}
                                        className="absolute bottom-1 right-1 p-1.5 bg-white text-red-500 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                                        title="사진 삭제"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
                {photos.length === 0 && (
                    <div className="text-center py-10 text-gray-500">
                        <p>업로드된 사진이 없습니다.</p>
                    </div>
                )}
            </ScrollArea>
        </div>
    )
}
