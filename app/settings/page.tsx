'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

function SidebarToggleButton() {
  const { state } = useSidebar();

  const leftPosition = state === "expanded"
    ? `calc(16rem + 1rem)`
    : `1rem`;

  return (
    <div
      className="fixed top-4 z-50 transition-all duration-200 ease-linear"
      style={{ left: leftPosition }}
    >
      {state === "collapsed" && <SidebarTrigger />}
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { isLoggedIn, logout, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push('/login');
    }
  }, [isLoggedIn, isLoading, router]);

  const handleLogout = () => {
    logout();
  };

  if (isLoading) {
    return null; // 또는 로딩 스피너 등을 표시할 수 있습니다.
  }

  if (!isLoggedIn) {
    return null; // 로그인되지 않은 경우 아무것도 렌더링하지 않고 리다이렉션을 기다립니다.
  }

  return (
    <div>
      <SidebarProvider>
        <AppSidebar />
        <SidebarToggleButton />

        <main className="flex-1 p-4 md:p-6">
          <div className="flex justify-end mb-4">
            <div className="group relative flex items-center">
              <Button variant="ghost" className="mr-2 cursor-pointer">user</Button>
              <Button variant="outline" onClick={handleLogout} className="absolute right-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                로그아웃
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>About</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                 
                  <div className="text-sm leading-relaxed space-y-2">
                    <p>Copyright © 2025 Istiozo. All rights reserved.</p>
                    <p>This software, Meshmanager, is a proprietary product developed and owned by Istiozo.</p>
                    <p>Unauthorized copying, reproduction, modification, distribution, or reverse engineering of this software, in whole or in part, is strictly prohibited without explicit written permission from the copyright holder.</p>
                    <p>This software is intended solely for authorized use. Any unauthorized access, use, or disclosure is a violation of intellectual property rights and may result in legal action.</p>
                    <p>The software is provided &quot;as is,&quot; without warranty of any kind, either express or implied. The author shall not be liable for any damages arising from the use of this software.</p>
                    <p>For licensing inquiries, please contact: Istiozo</p>
                  </div>
                </div>
                
                <div>
                 
                  <div className="text-sm leading-relaxed space-y-2">
                    <p>저작권 © 2025 Istiozo. 모든 권리 보유.</p>
                    <p>본 소프트웨어 &apos;Meshmanager&apos;는 Istiozo이 개발 및 소유한 독점 소프트웨어입니다.</p>
                    <p>저작권자의 명시적 서면 허가 없이, 본 소프트웨어의 전체 또는 일부를 무단으로 복사, 재배포, 수정, 변형하거나 리버스 엔지니어링하는 행위는 금지되어 있습니다.</p>
                    <p>이 소프트웨어는 허가된 사용자만 사용할 수 있으며, 무단 접근, 사용 또는 공개는 지적 재산권 침해에 해당하며 법적 조치를 초래할 수 있습니다.</p>
                    <p>본 소프트웨어는 &quot;있는 그대로&quot;(as-is) 제공되며, 명시적 또는 묵시적인 어떠한 보증도 하지 않습니다. 사용으로 인해 발생하는 모든 손해에 대하여 저작권자는 책임을 지지 않습니다.</p>
                    <p>라이선스 관련 문의: Istiozo</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </SidebarProvider>
    </div>
  );
} 