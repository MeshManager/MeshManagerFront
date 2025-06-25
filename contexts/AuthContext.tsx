'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  isLoggedIn: boolean;
  login: (token: string) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // 새로고침 시 안전한 초기화를 위해 더 긴 시간 대기
    const initializeAuth = () => {
      try {
        const token = localStorage.getItem('authToken');
        if (token) {
          setIsLoggedIn(true);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        // 충분한 시간을 두고 로딩 상태 해제
        setTimeout(() => {
          setIsLoading(false);
        }, 100);
      }
    };

    // DOM이 완전히 로드된 후 실행
    if (typeof window !== 'undefined') {
      setTimeout(initializeAuth, 50);
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = (token: string) => {
    localStorage.setItem('authToken', token);
    setIsLoggedIn(true);
    
    // 로그인 후 원래 페이지로 리다이렉션
    const redirectTo = localStorage.getItem('redirectAfterLogin');
    if (redirectTo && redirectTo !== '/login') {
      localStorage.removeItem('redirectAfterLogin');
      router.push(redirectTo);
    } else {
      router.push('/');
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('redirectAfterLogin');
    setIsLoggedIn(false);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 