'use client';

import { useAlbum } from '@/contexts/album-context';
import { useAuth } from '@/contexts/auth-context';
import { LayoutTemplate } from '@/types/album';
import { useState } from 'react';

interface TemplateGridProps {
  selectedPhotoCount: number | 'all';
  onEditTemplate: (template: LayoutTemplate) => void;
}

export default function TemplateGrid({ selectedPhotoCount, onEditTemplate }: TemplateGridProps) {
  const { templates, deleteTemplate } = useAlbum();
  const { user } = useAuth();

  const filteredTemplates = selectedPhotoCount === 'all' 
    ? templates 
    : templates.filter(template => template.photoCount === selectedPhotoCount);

  const renderLayoutPreview = (template: LayoutTemplate) => {
    return (
      <div className="absolute inset-4 flex flex-wrap">
        {template.layouts.map((layout, index) => (
          <div
            key={layout.id}
            className="absolute bg-blue-100 border border-blue-300 rounded flex items-center justify-center"
            style={{
              left: `${layout.x}%`,
              top: `${layout.y}%`,
              width: `${layout.width}%`,
              height: `${layout.height}%`,
            }}
          >
            <span className="text-xs text-blue-600 font-medium">{index + 1}</span>
          </div>
        ))}
      </div>
    );
  };

  const handleDeleteTemplate = (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('이 템플릿을 삭제하시겠습니까?')) {
      deleteTemplate(templateId);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          {selectedPhotoCount === 'all' ? '전체 템플릿' : `${selectedPhotoCount}장 사진 템플릿`}
        </h2>
        <p className="text-gray-600 mt-1">{filteredTemplates.length}개의 템플릿</p>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {filteredTemplates.map((template) => (
          <div key={template.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
            <div 
              className={`bg-gray-50 border-b border-gray-200 relative ${
                template.orientation === 'landscape' ? 'aspect-[297/210]' : 'aspect-[210/297]'
              }`}
            >
              {renderLayoutPreview(template)}
              
              <div className="absolute top-2 right-2 flex space-x-1">
                {template.id.startsWith('server-') && (
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">관리자</span>
                )}
                <button 
                  onClick={() => onEditTemplate(template)}
                  className="p-1 bg-white rounded shadow hover:bg-gray-50"
                >
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                {!template.id.startsWith('server-') || user?.role === 'admin' ? (
                  <button 
                    onClick={(e) => handleDeleteTemplate(template.id, e)}
                    className="p-1 bg-white rounded shadow hover:bg-red-50"
                  >
                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                ) : null}
              </div>
            </div>
            
            <div className="p-4">
              <h3 className="font-medium text-gray-900 mb-2">{template.name}</h3>
              <div className="flex justify-between text-sm text-gray-500">
                <span>{template.photoCount}장 레이아웃</span>
                <span>{template.orientation}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// %%%%%LAST%%%%%