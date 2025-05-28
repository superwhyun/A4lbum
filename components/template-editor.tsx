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
  const [availableLayoutSamples, setAvailableLayoutSamples] = useState<Array<{ name: string, layouts: Omit<PhotoLayout, 'photoId'>[] }>>([]);
  const [metadataTextColor, setMetadataTextColor] = useState(template?.metadataTextColor || '#FFFFFF');
  const [metadataTextSize, setMetadataTextSize] = useState(template?.metadataTextSize || 'text-xs');
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string>('');
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const previewRef = useRef<HTMLDivElement>(null);

  function generatePageLayoutSamples(count: number, orient: 'portrait' | 'landscape'): Array<{ name: string, layouts: Omit<PhotoLayout, 'photoId'>[] }> {
    const samples: Array<{ name: string, layouts: Omit<PhotoLayout, 'photoId'>[] }> = [];

    // Helper to create unique IDs for layouts within a sample
    const createLayouts = (coords: Array<Omit<PhotoLayout, 'id' | 'photoId'>>): Omit<PhotoLayout, 'photoId'>[] => {
      return coords.map((coord, index) => ({
        id: `layout-${index}`,
        ...coord,
      }));
    };

    if (count === 1) {
      if (orient === 'portrait') {
        samples.push({
          name: "Portrait Single - Full Frame",
          layouts: createLayouts([{ x: 5, y: 5, width: 90, height: 90 }]),
        });
        samples.push({
          name: "Portrait Single - Centered",
          layouts: createLayouts([{ x: 15, y: 15, width: 70, height: 70 }]),
        });
      } else { // landscape
        samples.push({
          name: "Landscape Single - Full Frame",
          layouts: createLayouts([{ x: 5, y: 5, width: 90, height: 90 }]),
        });
        samples.push({
          name: "Landscape Single - Centered",
          layouts: createLayouts([{ x: 15, y: 15, width: 70, height: 70 }]),
        });
      }
    } else if (count === 2) {
      if (orient === 'portrait') {
        samples.push({
          name: "Portrait Duo - Top Bottom",
          layouts: createLayouts([
            { x: 10, y: 5, width: 80, height: 42.5 },
            { x: 10, y: 52.5, width: 80, height: 42.5 },
          ]),
        });
        samples.push({
          name: "Portrait Duo - Side by Side (Narrow)",
          layouts: createLayouts([
            { x: 5, y: 10, width: 42.5, height: 80 },
            { x: 52.5, y: 10, width: 42.5, height: 80 },
          ]),
        });
      } else { // landscape
        samples.push({
          name: "Landscape Duo - Side by Side",
          layouts: createLayouts([
            { x: 5, y: 10, width: 42.5, height: 80 },
            { x: 52.5, y: 10, width: 42.5, height: 80 },
          ]),
        });
        samples.push({
          name: "Landscape Duo - Top Bottom (Narrow)",
          layouts: createLayouts([
            { x: 10, y: 5, width: 80, height: 42.5 },
            { x: 10, y: 52.5, width: 80, height: 42.5 },
          ]),
        });
      }
    } else if (count === 3) {
      if (orient === 'portrait') {
        samples.push({
          name: "Portrait Trio - Stacked",
          layouts: createLayouts([
            { x: 10, y: 5, width: 80, height: 28 },
            { x: 10, y: 36, width: 80, height: 28 },
            { x: 10, y: 67, width: 80, height: 28 },
          ]),
        });
        samples.push({
          name: "Portrait Trio - One Large Two Small",
          layouts: createLayouts([
            { x: 5, y: 5, width: 90, height: 55 },
            { x: 5, y: 62.5, width: 42.5, height: 32.5 },
            { x: 52.5, y: 62.5, width: 42.5, height: 32.5 },
          ]),
        });
      } else { // landscape
        samples.push({
          name: "Landscape Trio - Columned",
          layouts: createLayouts([
            { x: 5, y: 10, width: 28, height: 80 },
            { x: 36, y: 10, width: 28, height: 80 },
            { x: 67, y: 10, width: 28, height: 80 },
          ]),
        });
        samples.push({
          name: "Landscape Trio - One Large Two Small",
          layouts: createLayouts([
            { x: 5, y: 5, width: 55, height: 90 },
            { x: 62.5, y: 5, width: 32.5, height: 42.5 },
            { x: 62.5, y: 52.5, width: 32.5, height: 42.5 },
          ]),
        });
      }
    } else if (count === 4) {
      if (orient === 'portrait') {
        samples.push({
          name: "Portrait Quad - 2x2 Grid",
          layouts: createLayouts([
            { x: 5, y: 5, width: 42.5, height: 42.5 }, { x: 52.5, y: 5, width: 42.5, height: 42.5 },
            { x: 5, y: 52.5, width: 42.5, height: 42.5 }, { x: 52.5, y: 52.5, width: 42.5, height: 42.5 },
          ]),
        });
        samples.push({
          name: "Portrait Quad - Vertical Stack",
          layouts: createLayouts([
            { x: 10, y: 2, width: 80, height: 22 }, { x: 10, y: 26, width: 80, height: 22 },
            { x: 10, y: 50, width: 80, height: 22 }, { x: 10, y: 74, width: 80, height: 22 },
          ]),
        });
      } else { // landscape
        samples.push({
          name: "Landscape Quad - 2x2 Grid",
          layouts: createLayouts([
            { x: 5, y: 5, width: 42.5, height: 42.5 }, { x: 52.5, y: 5, width: 42.5, height: 42.5 },
            { x: 5, y: 52.5, width: 42.5, height: 42.5 }, { x: 52.5, y: 52.5, width: 42.5, height: 42.5 },
          ]),
        });
        samples.push({
          name: "Landscape Quad - Horizontal Strip",
          layouts: createLayouts([
            { x: 2, y: 10, width: 22, height: 80 }, { x: 26, y: 10, width: 22, height: 80 },
            { x: 50, y: 10, width: 22, height: 80 }, { x: 74, y: 10, width: 22, height: 80 },
          ]),
        });
      }
    } else if (count === 5) {
      if (orient === 'portrait') {
        samples.push({
          name: "Portrait Quint - 1 Large, 4 Small",
          layouts: createLayouts([
            { x: 5, y: 5, width: 90, height: 45 },
            { x: 5, y: 52.5, width: 21, height: 21 }, { x: 28.5, y: 52.5, width: 21, height: 21 },
            { x: 52, y: 52.5, width: 21, height: 21 }, { x: 75.5, y: 52.5, width: 21, height: 21 },
          ]),
        });
        samples.push({
          name: "Portrait Quint - Vertical Center + Sides",
          layouts: createLayouts([
            { x: 5, y: 5, width: 28, height: 90 },
            { x: 36, y: 5, width: 28, height: 42.5 }, { x: 36, y: 52.5, width: 28, height: 42.5 },
            { x: 67, y: 5, width: 28, height: 42.5 }, { x: 67, y: 52.5, width: 28, height: 42.5 },
          ]),
        });
      } else { // landscape
        samples.push({
          name: "Landscape Quint - 1 Large, 4 Small",
          layouts: createLayouts([
            { x: 5, y: 5, width: 45, height: 90 },
            { x: 52.5, y: 5, width: 21, height: 21 }, { x: 75.5, y: 5, width: 21, height: 21 },
            { x: 52.5, y: 28.5, width: 21, height: 21 }, { x: 75.5, y: 28.5, width: 21, height: 21 },
          ]),
        });
         samples.push({
          name: "Landscape Quint - Horizontal Center + Top/Bottom",
          layouts: createLayouts([
            { x: 5, y: 5, width: 90, height: 28 },
            { x: 5, y: 36, width: 42.5, height: 28 }, { x: 52.5, y: 36, width: 42.5, height: 28 },
            { x: 5, y: 67, width: 42.5, height: 28 }, { x: 52.5, y: 67, width: 42.5, height: 28 },
          ]),
        });
      }
    } else if (count === 6) {
      if (orient === 'portrait') {
        samples.push({
          name: "Portrait Hex - 2x3 Grid",
          layouts: createLayouts([
            { x: 5, y: 5, width: 42.5, height: 28 }, { x: 52.5, y: 5, width: 42.5, height: 28 },
            { x: 5, y: 36, width: 42.5, height: 28 }, { x: 52.5, y: 36, width: 42.5, height: 28 },
            { x: 5, y: 67, width: 42.5, height: 28 }, { x: 52.5, y: 67, width: 42.5, height: 28 },
          ]),
        });
        samples.push({
          name: "Portrait Hex - 3x2 Grid",
          layouts: createLayouts([
            { x: 5, y: 5, width: 28, height: 42.5 }, { x: 36, y: 5, width: 28, height: 42.5 }, { x: 67, y: 5, width: 28, height: 42.5 },
            { x: 5, y: 52.5, width: 28, height: 42.5 }, { x: 36, y: 52.5, width: 28, height: 42.5 }, { x: 67, y: 52.5, width: 28, height: 42.5 },
          ]),
        });
      } else { // landscape
        samples.push({
          name: "Landscape Hex - 3x2 Grid",
          layouts: createLayouts([
            { x: 5, y: 5, width: 28, height: 42.5 }, { x: 36, y: 5, width: 28, height: 42.5 }, { x: 67, y: 5, width: 28, height: 42.5 },
            { x: 5, y: 52.5, width: 28, height: 42.5 }, { x: 36, y: 52.5, width: 28, height: 42.5 }, { x: 67, y: 52.5, width: 28, height: 42.5 },
          ]),
        });
        samples.push({
          name: "Landscape Hex - 2x3 Grid",
          layouts: createLayouts([
            { x: 5, y: 5, width: 42.5, height: 28 }, { x: 52.5, y: 5, width: 42.5, height: 28 },
            { x: 5, y: 36, width: 42.5, height: 28 }, { x: 52.5, y: 36, width: 42.5, height: 28 },
            { x: 5, y: 67, width: 42.5, height: 28 }, { x: 52.5, y: 67, width: 42.5, height: 28 },
          ]),
        });
      }
    }

    return samples;
  }

  // 초기 레이아웃 설정
  useEffect(() => {
    if (template?.layouts) {
      setLayouts(template.layouts);
      // If we have a template, we might want to generate samples based on its count and orientation
      // or assume the template itself is one of the 'samples'
      const samples = generatePageLayoutSamples(template.photoCount, template.orientation);
      setAvailableLayoutSamples(samples);
    } else {
      const samples = generatePageLayoutSamples(photoCount, orientation);
      setAvailableLayoutSamples(samples);
      if (samples.length > 0) {
        setLayouts(samples[0].layouts);
      } else {
        setLayouts([]); // Fallback to empty if no samples
      }
    }
  }, [template, photoCount, orientation]); // Added photoCount and orientation to dependencies

  const handlePhotoCountChange = (newCount: number) => {
    setPhotoCount(newCount);
    const samples = generatePageLayoutSamples(newCount, orientation);
    setAvailableLayoutSamples(samples);
    if (samples.length > 0) {
      setLayouts(samples[0].layouts);
    } else {
      setLayouts([]); // Fallback to empty if no samples
    }
  };

  const handleOrientationChange = (newOrientation: 'portrait' | 'landscape') => {
    setOrientation(newOrientation);
    const samples = generatePageLayoutSamples(photoCount, newOrientation);
    setAvailableLayoutSamples(samples);
    if (samples.length > 0) {
      setLayouts(samples[0].layouts);
    } else {
      setLayouts([]); // Fallback to empty if no samples
    }
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
      metadataTextColor,
      metadataTextSize,
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">메타데이터 텍스트 색상</label>
            <input
              type="color"
              value={metadataTextColor}
              onChange={(e) => setMetadataTextColor(e.target.value)}
              className="w-full h-10 px-1 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">메타데이터 텍스트 크기</label>
            <select
              value={metadataTextSize}
              onChange={(e) => setMetadataTextSize(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="text-xs">Extra Small</option>
              <option value="text-sm">Small</option>
              <option value="text-base">Medium</option>
              <option value="text-lg">Large</option>
            </select>
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