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
  const [isLoading, setIsLoading] = useState(false);

  const { login, register } = useAuth();

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
        </form>

        <div className="mt-4 text-center">
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