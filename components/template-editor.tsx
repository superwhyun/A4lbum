'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { LayoutTemplate, PhotoLayout } from '@/types/album';

interface TemplateEditorProps {
  onSave: (template: LayoutTemplate) => void;
  onCancel: () => void;
  template?: LayoutTemplate;
}

export default function TemplateEditor({ onSave, onCancel, template }: TemplateEditorProps) {
  const [name, setName] = useState(template?.name || '');
  const [photoCount, setPhotoCount] = useState(template?.photoCount || 3);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(template?.orientation || 'portrait');
  const [layouts, setLayouts] = useState<Omit<PhotoLayout, 'photoId'>[]>([]);
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string>('');
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const previewRef = useRef<HTMLDivElement>(null);

  function generateDefaultLayouts(count: number, orient: 'portrait' | 'landscape'): Omit<PhotoLayout, 'photoId'>[] {
    const layouts: Omit<PhotoLayout, 'photoId'>[] = [];
    const cols = count <= 2 ? count : count <= 4 ? 2 : 3;
    const rows = Math.ceil(count / cols);
    const cellWidth = 100 / cols - 1;
    const cellHeight = 100 / rows - 1;

    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      layouts.push({
        id: `layout-${i}`,
        x: col * (cellWidth + 1),
        y: row * (cellHeight + 1),
        width: cellWidth,
        height: cellHeight,
      });
    }
    return layouts;
  }

  // 초기 레이아웃 설정
  useEffect(() => {
    if (template?.layouts) {
      setLayouts(template.layouts);
    } else {
      setLayouts(generateDefaultLayouts(photoCount, orientation));
    }
  }, [template]);

  const handlePhotoCountChange = (newCount: number) => {
    setPhotoCount(newCount);
    setLayouts(generateDefaultLayouts(newCount, orientation));
  };

  const handleOrientationChange = (newOrientation: 'portrait' | 'landscape') => {
    setOrientation(newOrientation);
    setLayouts(generateDefaultLayouts(photoCount, newOrientation));
  };

  const handleLayoutMouseDown = useCallback((e: React.MouseEvent, layoutId: string) => {
    e.preventDefault();
    setSelectedLayoutId(layoutId);
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, []);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, layoutId: string, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedLayoutId(layoutId);
    setIsResizing(true);
    setResizeHandle(handle);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if ((!isDragging && !isResizing) || !selectedLayoutId || !previewRef.current) return;

    const preview = previewRef.current;
    const rect = preview.getBoundingClientRect();
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    const moveX = (deltaX / rect.width) * 100;
    const moveY = (deltaY / rect.height) * 100;

    setLayouts(prev => prev.map(layout => {
      if (layout.id === selectedLayoutId) {
        if (isDragging) {
          // 드래그: 위치 이동
          return {
            ...layout,
            x: Math.max(0, Math.min(100 - layout.width, layout.x + moveX)),
            y: Math.max(0, Math.min(100 - layout.height, layout.y + moveY)),
          };
        } else if (isResizing) {
          // 리사이즈: 크기 조정
          let newLayout = { ...layout };
          
          if (resizeHandle.includes('right')) {
            newLayout.width = Math.max(5, Math.min(100 - layout.x, layout.width + moveX));
          }
          if (resizeHandle.includes('left')) {
            const newWidth = Math.max(5, layout.width - moveX);
            const newX = Math.max(0, Math.min(layout.x + moveX, layout.x + layout.width - 5));
            newLayout.width = newWidth;
            newLayout.x = newX;
          }
          if (resizeHandle.includes('bottom')) {
            newLayout.height = Math.max(5, Math.min(100 - layout.y, layout.height + moveY));
          }
          if (resizeHandle.includes('top')) {
            const newHeight = Math.max(5, layout.height - moveY);
            const newY = Math.max(0, Math.min(layout.y + moveY, layout.y + layout.height - 5));
            newLayout.height = newHeight;
            newLayout.y = newY;
          }
          
          return newLayout;
        }
      }
      return layout;
    }));

    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isDragging, isResizing, selectedLayoutId, dragStart, resizeHandle]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle('');
  }, []);

  // 마우스 이벤트 리스너
  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  const handleSave = () => {
    if (!name.trim()) {
      alert('템플릿 이름을 입력해주세요.');
      return;
    }

    const newTemplate: LayoutTemplate = {
      id: template?.id || `template-${Date.now()}`,
      name,
      photoCount,
      orientation,
      layouts,
    };

    onSave(newTemplate);
  };

  return (
    <div className="grid grid-cols-2 gap-8 h-full">
      {/* 왼쪽: 설정 패널 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          {template ? '템플릿 편집' : '새 템플릿 생성'}
        </h2>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">템플릿 이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="템플릿 이름을 입력하세요"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">사진 개수</label>
            <select
              value={photoCount}
              onChange={(e) => handlePhotoCountChange(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[1, 2, 3, 4, 5, 6].map(count => (
                <option key={count} value={count}>{count}장</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">방향</label>
            <select
              value={orientation}
              onChange={(e) => handleOrientationChange(e.target.value as 'portrait' | 'landscape')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="portrait">세로형</option>
              <option value="landscape">가로형</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="showGrid"
              checked={showGrid}
              onChange={(e) => setShowGrid(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="showGrid" className="text-sm text-gray-700">그리드 표시</label>
          </div>
        </div>

        <div className="flex justify-end space-x-4 mt-8">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            저장
          </button>
        </div>
      </div>

      {/* 오른쪽: 미리보기 및 편집 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">레이아웃 미리보기</h3>
        <p className="text-sm text-gray-600 mb-4">
          사진 프레임을 드래그해서 이동하거나, 모서리를 드래그해서 크기를 조정하세요
        </p>
        
        <div className="flex justify-center">
          <div 
            ref={previewRef}
            className={`relative bg-gray-50 border-2 border-dashed border-gray-300 ${
              orientation === 'landscape' ? 'w-80 h-56' : 'w-56 h-80'
            }`}
            style={{
              backgroundImage: showGrid ? `
                linear-gradient(to right, #e5e7eb 1px, transparent 1px),
                linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
              ` : undefined,
              backgroundSize: showGrid ? '20px 20px' : undefined,
            }}
          >
            {layouts.map((layout, index) => (
              <div
                key={layout.id}
                className={`absolute bg-blue-100 border-2 rounded transition-all ${
                  selectedLayoutId === layout.id 
                    ? 'border-blue-500 shadow-lg z-10' 
                    : 'border-blue-300 hover:border-blue-400'
                }`}
                style={{
                  left: `${layout.x}%`,
                  top: `${layout.y}%`,
                  width: `${layout.width}%`,
                  height: `${layout.height}%`,
                  cursor: isDragging ? 'grabbing' : 'grab',
                }}
                onMouseDown={(e) => handleLayoutMouseDown(e, layout.id)}
              >
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-blue-600 font-medium text-sm">{index + 1}</span>
                </div>
                
                {/* 리사이즈 핸들 */}
                {selectedLayoutId === layout.id && (
                  <>
                    {/* 모서리 핸들 */}
                    <div 
                      className="absolute w-2 h-2 bg-blue-500 rounded-full -top-1 -left-1 cursor-nw-resize"
                      onMouseDown={(e) => handleResizeMouseDown(e, layout.id, 'top-left')}
                    />
                    <div 
                      className="absolute w-2 h-2 bg-blue-500 rounded-full -top-1 -right-1 cursor-ne-resize"
                      onMouseDown={(e) => handleResizeMouseDown(e, layout.id, 'top-right')}
                    />
                    <div 
                      className="absolute w-2 h-2 bg-blue-500 rounded-full -bottom-1 -left-1 cursor-sw-resize"
                      onMouseDown={(e) => handleResizeMouseDown(e, layout.id, 'bottom-left')}
                    />
                    <div 
                      className="absolute w-2 h-2 bg-blue-500 rounded-full -bottom-1 -right-1 cursor-se-resize"
                      onMouseDown={(e) => handleResizeMouseDown(e, layout.id, 'bottom-right')}
                    />
                    
                    {/* 중간 핸들 */}
                    <div 
                      className="absolute w-2 h-1 bg-blue-500 rounded -top-0.5 left-1/2 transform -translate-x-1/2 cursor-n-resize"
                      onMouseDown={(e) => handleResizeMouseDown(e, layout.id, 'top')}
                    />
                    <div 
                      className="absolute w-2 h-1 bg-blue-500 rounded -bottom-0.5 left-1/2 transform -translate-x-1/2 cursor-s-resize"
                      onMouseDown={(e) => handleResizeMouseDown(e, layout.id, 'bottom')}
                    />
                    <div 
                      className="absolute w-1 h-2 bg-blue-500 rounded -left-0.5 top-1/2 transform -translate-y-1/2 cursor-w-resize"
                      onMouseDown={(e) => handleResizeMouseDown(e, layout.id, 'left')}
                    />
                    <div 
                      className="absolute w-1 h-2 bg-blue-500 rounded -right-0.5 top-1/2 transform -translate-y-1/2 cursor-e-resize"
                      onMouseDown={(e) => handleResizeMouseDown(e, layout.id, 'right')}
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// %%%%%LAST%%%%%