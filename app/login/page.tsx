'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const { login } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!id || !password) {
      setError('아이디와 비밀번호를 모두 입력해주세요.');
      return;
    }

    console.log('Attempting to log in with:', { id, password });
    if (id === 'user' && password === 'pass') {
      login('dummy-auth-token');
      alert('로그인 성공!');
      router.refresh();
      router.push('/');
    } else {
      setError('잘못된 아이디 또는 비밀번호입니다.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">로그인</CardTitle>
          <CardDescription>아이디와 비밀번호를 입력하여 로그인하세요.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="id">아이디</Label>
              <Input
                id="id"
                type="text"
                placeholder="user"
                value={id}
                onChange={(e) => setId(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full">로그인</Button>
            <div className="flex justify-between w-full text-sm">
              <Link href="/forgot-id" className="text-gray-500 hover:underline">아이디 찾기</Link>
              <Link href="/forgot-password" className="text-gray-500 hover:underline">비밀번호 찾기</Link>
              <Link href="/register" className="text-gray-500 hover:underline">회원가입</Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
} 