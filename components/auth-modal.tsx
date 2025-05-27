'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false); // For username/password form
  const [isGoogleLoading, setIsGoogleLoading] = useState(false); // For Google Sign-In

  const { login, register, signInWithGoogle } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      let success = false;
      
      if (isLoginMode) {
        success = await login(username, password);
        if (!success) {
          setError('잘못된 사용자명 또는 비밀번호입니다.');
        }
      } else {
        success = await register(username, password);
        if (success) {
          setError('');
          setIsLoginMode(true);
          setUsername('');
          setPassword('');
          alert('회원가입이 완료되었습니다. 로그인해주세요.');
        } else {
          setError('회원가입에 실패했습니다.');
        }
      }

      if (success && isLoginMode) {
        onClose();
        setUsername('');
        setPassword('');
      }
    } catch (error) {
      setError('서버 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            {isLoginMode ? '로그인' : '회원가입'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              사용자명
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              minLength={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              minLength={4}
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {isLoading ? '처리중...' : (isLoginMode ? '로그인' : '회원가입')}
          </button>

          <div className="my-4 flex items-center">
            <hr className="flex-grow border-t border-gray-300" />
            <span className="mx-2 text-gray-500 text-sm">또는</span>
            <hr className="flex-grow border-t border-gray-300" />
          </div>

          <button
            type="button"
            disabled={isGoogleLoading}
            onClick={async () => {
              setError('');
              setIsGoogleLoading(true);
              try {
                const success = await signInWithGoogle();
                if (success) {
                  onClose();
                  setUsername('');
                  setPassword('');
                } else {
                  setError('Google 로그인에 실패했습니다. 다시 시도해주세요.');
                }
              } catch (err) {
                setError('Google 로그인 중 예기치 않은 오류가 발생했습니다.');
              } finally {
                setIsGoogleLoading(false);
              }
            }}
            className="w-full bg-white text-gray-700 py-2 px-4 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center"
          >
            {/* Basic Google Icon (SVG) - Optional */}
            {/* <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg> */}
            {isGoogleLoading ? '처리중...' : 'Google 계정으로 로그인'}
          </button>
        </form>

        <div className="mt-6 text-center"> {/* Increased margin-top for spacing */}
          <button
            onClick={() => {
              setIsLoginMode(!isLoginMode);
              setError('');
              setUsername('');
              setPassword('');
            }}
            className="text-blue-500 hover:underline"
          >
            {isLoginMode ? '회원가입하기' : '로그인하기'}
          </button>
        </div>
      </div>
    </div>
  );
};