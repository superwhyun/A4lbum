'use client';

import React, { useState } from 'react';
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ImageIcon, Settings, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from '@/contexts/auth-context';
import { useAlbum } from '@/contexts/album-context';
import { AuthModal } from './auth-modal';

type HeaderProps = {
  onGoToPreview: () => void;
  albumExists: boolean;
};

export const Header: React.FC<HeaderProps> = ({
  onGoToPreview,
  albumExists,
}) => {
  const { user, logout } = useAuth();
  const { resetAlbum } = useAlbum();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    logout();
  };

  const handleNewAlbum = () => {
    resetAlbum();
    if (pathname === "/") {
      router.refresh();
    } else {
      router.push("/");
    }
  };

  return (
    <>
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center">
              <Link
                href="/"
                className="flex items-center hover:opacity-80 transition-opacity"
              >
                <ImageIcon className="h-12 w-12 text-blue-600 mr-4" />
                <h1 className="text-4xl font-bold text-gray-900">A4lbum</h1>
              </Link>
              {/* "새 앨범 만들기" button removed from header */}
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <span className="text-gray-700 flex items-center">
                    {user.username} ({user.role === 'admin' ? '관리자' : '사용자'})
                    <Link href="/layout-manager" className="ml-4">
                      <Button variant="outline" size="sm">
                        <Settings className="w-4 h-4 mr-1" />
                        레이아웃 관리자
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center ml-2"
                      onClick={handleNewAlbum}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      새 앨범 만들기
                    </Button>
                  </span>
                  <button
                    onClick={handleLogout}
                    className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                  >
                    로그아웃
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  로그인
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </>
  );
};