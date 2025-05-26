"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAlbum } from "@/contexts/album-context"
import { useAuth } from "@/contexts/auth-context"
import type { LayoutTemplate } from "@/types/album"

export default function LayoutManagerPage() {
  const { templates, addTemplate, deleteTemplate } = useAlbum()
  const { user } = useAuth()
  const [isCreating, setIsCreating] = useState(false)
  const [newTemplate, setNewTemplate] = useState<Partial<LayoutTemplate>>({
    name: "",
    photoCount: 3,
    orientation: "portrait",
    layouts: [],
  })

  const GRID_SIZE = 1.67; // 약 1.67% 단위 그리드 (60x60 그리드)

  const snapToGrid = (value: number) => {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  };

  const createDefaultLayout = (photoCount: number, orientation: "portrait" | "landscape") => {
    const layouts = []
    const cols = Math.ceil(Math.sqrt(photoCount))
    const rows = Math.ceil(photoCount / cols)
    const cellWidth = 100 / cols
    const cellHeight = 100 / rows

    for (let i = 0; i < photoCount; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)

      layouts.push({
        id: `layout-${i}`,
        x: snapToGrid(col * cellWidth),
        y: snapToGrid(row * cellHeight),
        width: snapToGrid(cellWidth - 2),
        height: snapToGrid(cellHeight - 2),
      })
    }

    return layouts
  }

  const handleStartCreating = () => {
    setIsCreating(true)
    setNewTemplate({
      name: "",
      photoCount: 3,
      orientation: "portrait",
      layouts: createDefaultLayout(3, "portrait"),
    })
  }

  const handleSaveTemplate = async () => {
    if (newTemplate.name && newTemplate.layouts) {
      const template: LayoutTemplate = {
        id: `template-${Date.now()}`,
        name: newTemplate.name,
        photoCount: newTemplate.photoCount || 3,
        orientation: newTemplate.orientation || "portrait",
        layouts: newTemplate.layouts,
      }

      // 관리자면 서버에 저장
      if (user?.role === 'admin') {
        try {
          const response = await fetch('/api/layouts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: template.name,
              config: {
                photoCount: template.photoCount,
                orientation: template.orientation,
                layouts: template.layouts
              }
            })
          });

          if (response.ok) {
            console.log('Template saved to server');
          } else {
            console.error('Failed to save template to server');
          }
        } catch (error) {
          console.error('Error saving template to server:', error);
        }
      }

      // 로컬에도 저장 (기존 동작 유지)
      addTemplate(template)
      setIsCreating(false)
      setNewTemplate({})
    }
  }

  const handlePhotoCountChange = (count: number) => {
    setNewTemplate((prev) => ({
      ...prev,
      photoCount: count,
      layouts: createDefaultLayout(count, prev.orientation || "portrait"),
    }))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                돌아가기
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 ml-4">레이아웃 관리자</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">레이아웃 템플릿</h2>
            {!isCreating && (
              <Button onClick={handleStartCreating}>
                <Plus className="w-4 h-4 mr-2" />새 템플릿 만들기
              </Button>
            )}
          </div>

          {isCreating && (
            <div className="bg-white rounded-lg p-6 shadow">
              <h3 className="text-lg font-medium mb-4">새 템플릿 만들기</h3>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">템플릿 이름</label>
                    <Input
                      value={newTemplate.name || ""}
                      onChange={(e) => setNewTemplate((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="템플릿 이름을 입력하세요"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">사진 개수</label>
                    <select
                      value={newTemplate.photoCount || 3}
                      onChange={(e) => handlePhotoCountChange(Number(e.target.value))}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    >
                      {[3, 4, 5, 6].map((count) => (
                        <option key={count} value={count}>
                          {count}장
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">방향</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setNewTemplate((prev) => ({ 
                          ...prev, 
                          orientation: "portrait",
                          layouts: createDefaultLayout(prev.photoCount || 3, "portrait")
                        }))}
                        className={`px-4 py-2 rounded border ${
                          newTemplate.orientation === "portrait" ? "bg-blue-500 text-white" : "bg-white text-gray-700"
                        }`}
                      >
                        세로형
                      </button>
                      <button
                        onClick={() => setNewTemplate((prev) => ({ 
                          ...prev, 
                          orientation: "landscape",
                          layouts: createDefaultLayout(prev.photoCount || 3, "landscape")
                        }))}
                        className={`px-4 py-2 rounded border ${
                          newTemplate.orientation === "landscape" ? "bg-blue-500 text-white" : "bg-white text-gray-700"
                        }`}
                      >
                        가로형
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleSaveTemplate}>
                      <Save className="w-4 h-4 mr-2" />
                      저장
                    </Button>
                    <Button variant="outline" onClick={() => setIsCreating(false)}>
                      취소
                    </Button>
                  </div>
                  {/* 리사이즈 핸들 */}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">미리보기</label>
                  <div
                    className="border-2 border-gray-300 bg-white relative"
                    style={{
                      width: newTemplate.orientation === "portrait" ? "300px" : "424px",
                      height: newTemplate.orientation === "portrait" ? "424px" : "300px",
                      backgroundImage: `
                        linear-gradient(to right, #e5e7eb 1px, transparent 1px),
                        linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
                      `,
                      backgroundSize: `${(newTemplate.orientation === "portrait" ? 300 : 424) * GRID_SIZE / 100}px ${(newTemplate.orientation === "portrait" ? 424 : 300) * GRID_SIZE / 100}px`,
                    }}
                  >
                    {newTemplate.layouts?.map((layout, index) => (
                      <div
                        key={layout.id}
                        className="absolute bg-gray-200 border border-gray-400 flex items-center justify-center text-sm cursor-move select-none"
                        style={{
                          left: `${layout.x}%`,
                          top: `${layout.y}%`,
                          width: `${layout.width}%`,
                          height: `${layout.height}%`,
                          zIndex: 10 + index,
                        }}
                        draggable={false}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const startX = e.clientX;
                          const startY = e.clientY;
                          const startLayout = { ...layout };
                          const dragIndex = index;
                          const container = (e.target as HTMLElement).closest("div[style]") as HTMLElement;
                          const containerRect = container.getBoundingClientRect();

                          function onMouseMove(ev: MouseEvent) {
                            const dx = ev.clientX - startX;
                            const dy = ev.clientY - startY;
                            // px → % 변환
                            const percentX = (dx / containerRect.width) * 100;
                            const percentY = (dy / containerRect.height) * 100;
                            setNewTemplate((prev) => {
                              if (!prev.layouts) return prev;
                              const newLayouts = prev.layouts.map((l, idx) =>
                                idx === dragIndex
                                  ? {
                                      ...l,
                                      x: snapToGrid(Math.max(0, Math.min(100 - l.width, startLayout.x + percentX))),
                                      y: snapToGrid(Math.max(0, Math.min(100 - l.height, startLayout.y + percentY))),
                                    }
                                  : l
                              );
                              return { ...prev, layouts: newLayouts };
                            });
                          }
                          function onMouseUp() {
                            window.removeEventListener("mousemove", onMouseMove);
                            window.removeEventListener("mouseup", onMouseUp);
                          }
                          window.addEventListener("mousemove", onMouseMove);
                          window.addEventListener("mouseup", onMouseUp);
                        }}
                      >
                        사진 {index + 1}
                        {/* 리사이즈 핸들 */}
                        <div
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            const startX = e.clientX;
                            const startY = e.clientY;
                            const startLayout = { ...layout };
                            const resizeIndex = index;
                            const container = (e.target as HTMLElement).closest("div[style]")?.parentElement as HTMLElement;
                            const containerRect = container.getBoundingClientRect();

                            function onMouseMove(ev: MouseEvent) {
                              const dx = ev.clientX - startX;
                              const dy = ev.clientY - startY;
                              // px → % 변환
                              // 민감도 더 완화: 0.25배
                              const percentW = (dx / containerRect.width) * 100 * 0.25;
                              const percentH = (dy / containerRect.height) * 100 * 0.25;
                              setNewTemplate((prev) => {
                                if (!prev.layouts) return prev;
                                const newLayouts = prev.layouts.map((l, idx) =>
                                  idx === resizeIndex
                                    ? {
                                        ...l,
                                        width: snapToGrid(Math.max(GRID_SIZE, Math.min(100 - l.x, startLayout.width + percentW))),
                                        height: snapToGrid(Math.max(GRID_SIZE, Math.min(100 - l.y, startLayout.height + percentH))),
                                      }
                                    : l
                                );
                                return { ...prev, layouts: newLayouts };
                              });
                            }
                            function onMouseUp() {
                              window.removeEventListener("mousemove", onMouseMove);
                              window.removeEventListener("mouseup", onMouseUp);
                            }
                            window.addEventListener("mousemove", onMouseMove);
                            window.addEventListener("mouseup", onMouseUp);
                          }}
                          style={{
                            position: "absolute",
                            right: 0,
                            bottom: 0,
                            width: "16px",
                            height: "16px",
                            background: "rgba(0,0,0,0.15)",
                            borderRadius: "0 0 4px 0",
                            cursor: "nwse-resize",
                            zIndex: 100,
                            display: "flex",
                            alignItems: "flex-end",
                            justifyContent: "flex-end",
                          }}
                        >
                          <div
                            style={{
                              width: "10px",
                              height: "10px",
                              background: "rgba(0,0,0,0.25)",
                              borderRadius: "2px",
                              margin: "2px",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <div key={template.id} className="bg-white rounded-lg p-4 shadow">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-medium">{template.name}</h3>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsCreating(true);
                        setNewTemplate({
                          ...template,
                          // layouts 깊은 복사
                          layouts: template.layouts.map(l => ({ ...l })),
                        });
                      }}
                    >
                      수정
                    </Button>
                    {!template.id.startsWith('server-') && (
                      <Button variant="ghost" size="sm" onClick={() => deleteTemplate(template.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="text-sm text-gray-600 mb-3">
                  {template.photoCount}장 · {template.orientation === "portrait" ? "세로형" : "가로형"}
                  {template.id.startsWith('server-') && (
                    <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                      관리자 템플릿
                    </span>
                  )}
                </div>

                <div
                  className="border border-gray-300 bg-gray-50 relative mx-auto"
                  style={{
                    width: template.orientation === "portrait" ? "150px" : "212px",
                    height: template.orientation === "portrait" ? "212px" : "150px",
                  }}
                >
                  {template.layouts.map((layout, index) => (
                    <div
                      key={layout.id}
                      className="absolute bg-blue-200 border border-blue-400 flex items-center justify-center text-xs"
                      style={{
                        left: `${layout.x}%`,
                        top: `${layout.y}%`,
                        width: `${layout.width}%`,
                        height: `${layout.height}%`,
                      }}
                    >
                      {index + 1}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
