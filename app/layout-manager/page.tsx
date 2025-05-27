'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ImageIcon } from 'lucide-react';
import { useAlbum } from '@/contexts/album-context';
import { LayoutTemplate } from '@/types/album';
import LayoutSidebar from '@/components/layout-sidebar';
import TemplateGrid from '@/components/template-grid';
import TemplateEditor from '@/components/template-editor';

export default function LayoutManagerPage() {
  const [selectedPhotoCount, setSelectedPhotoCount] = useState<number | 'all'>('all');
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<LayoutTemplate | null>(null);
  const { addTemplate, updateTemplate } = useAlbum();

  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setIsCreatingTemplate(true);
  };

  const handleEditTemplate = (template: LayoutTemplate) => {
    setEditingTemplate(template);
    setIsCreatingTemplate(true);
  };

  const handleSaveTemplate = (template: LayoutTemplate) => {
    if (editingTemplate) {
      // 기존 템플릿 수정
      updateTemplate(template);
    } else {
      // 새 템플릿 생성
      addTemplate(template);
    }
    setIsCreatingTemplate(false);
    setEditingTemplate(null);
  };

  const handleCancel = () => {
    setIsCreatingTemplate(false);
    setEditingTemplate(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">레이아웃 템플릿 관리자</h1>
            <button
              onClick={handleCreateTemplate}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              새 템플릿 생성
            </button>
          </div>
        </div>
      </header>

      <div className="flex max-w-7xl mx-auto">
        <LayoutSidebar 
          selectedPhotoCount={selectedPhotoCount}
          onPhotoCountChange={setSelectedPhotoCount}
        />
        
        <main className="flex-1 p-6">
          {isCreatingTemplate ? (
            <TemplateEditor 
              template={editingTemplate || undefined}
              onSave={handleSaveTemplate}
              onCancel={handleCancel}
            />
          ) : (
            <TemplateGrid 
              selectedPhotoCount={selectedPhotoCount} 
              onEditTemplate={handleEditTemplate}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// %%%%%LAST%%%%%