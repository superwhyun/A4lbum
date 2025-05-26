'use client';

import { useAlbum } from '@/contexts/album-context';

interface LayoutSidebarProps {
  selectedPhotoCount: number | 'all';
  onPhotoCountChange: (count: number | 'all') => void;
}

export default function LayoutSidebar({ selectedPhotoCount, onPhotoCountChange }: LayoutSidebarProps) {
  const { templates } = useAlbum();

  const getTemplateCountByPhotoCount = (count: number | 'all') => {
    if (count === 'all') return templates.length;
    return templates.filter(template => template.photoCount === count).length;
  };

  const photoCountOptions = [
    { count: 'all' as const, label: '전체 보기' },
    { count: 1, label: '1장' },
    { count: 2, label: '2장' },
    { count: 3, label: '3장' },
    { count: 4, label: '4장' },
    { count: 5, label: '5장' },
    { count: 6, label: '6장' },
  ];
  return (
    <aside className="w-64 bg-white border-r border-gray-200 h-screen sticky top-0">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">사진 개수별 필터</h2>
        
        <nav className="space-y-2">
          {photoCountOptions.map((option) => {
            const templateCount = getTemplateCountByPhotoCount(option.count);
            return (
              <button
                key={option.count}
                onClick={() => onPhotoCountChange(option.count)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-colors ${
                  selectedPhotoCount === option.count
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="font-medium">{option.label}</span>
                <span className={`text-sm px-2 py-1 rounded-full ${
                  selectedPhotoCount === option.count
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {templateCount}개
                </span>
              </button>
            );
          })}
        </nav>
      </div>
      
      <div className="px-6 py-4 border-t border-gray-200">
        <div className="text-sm text-gray-500">
          <p>총 템플릿: <span className="font-medium text-gray-700">{templates.length}개</span></p>
          <p className="mt-1">서버 템플릿: <span className="font-medium text-gray-700">
            {templates.filter(t => t.id.startsWith('server-')).length}개
          </span></p>
        </div>
      </div>
    </aside>
  );
}

// %%%%%LAST%%%%%