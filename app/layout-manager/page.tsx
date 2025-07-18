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
  const [isInitializing, setIsInitializing] = useState(false);
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

  const handleInitializeTemplates = async () => {
    if (!confirm('모든 기존 템플릿을 삭제하고 기본 템플릿 36개를 다시 생성하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    setIsInitializing(true);
    
    try {
      const response = await fetch('/api/admin/init-templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        alert(`템플릿 초기화 완료!\n생성된 템플릿: ${data.insertedCount}개`);
        // 페이지 새로고침하여 새로운 템플릿 목록 로드
        window.location.reload();
      } else {
        const error = await response.json();
        alert(`초기화 실패: ${error.error}`);
      }
    } catch (error) {
      console.error('Template initialization error:', error);
      alert('템플릿 초기화 중 오류가 발생했습니다.');
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">레이아웃 템플릿 관리자</h1>
            <div className="flex space-x-3">
              <button
                onClick={handleInitializeTemplates}
                disabled={isInitializing}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isInitializing ? '초기화 중...' : '템플릿 DB 초기화'}
              </button>
              <button
                onClick={handleCreateTemplate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                새 템플릿 생성
              </button>
            </div>
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