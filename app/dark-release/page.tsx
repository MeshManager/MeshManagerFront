'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

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

export default function DarkReleasePage() {
  const router = useRouter();
  const { isLoggedIn, logout, isLoading } = useAuth();

  const [namespace, setNamespace] = useState<string>("");
  const [service, setService] = useState<string>("");
  const [serviceVersion, setServiceVersion] = useState<string>("");
  const [ipAddress, setIpAddress] = useState<string>("");

  // Dummy data for demonstration
  const availableNamespaces = ["default", "kube-system", "mesh-app"];
  const availableServices: { [key: string]: string[] } = {
    "mesh-app": ["frontend-service", "backend-service"],
    "default": ["my-app"],
  };
  const availableVersions: { [key: string]: string[] } = {
    "frontend-service": ["v1.0.0", "v1.0.1", "v1.1.0"],
    "backend-service": ["v2.0.0", "v2.0.1"],
    "my-app": ["v1.0.0"],
  };

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push('/login');
    }
  }, [isLoggedIn, isLoading, router]);

  const handleLogout = () => {
    logout();
  };

  const handleStartDarkRelease = () => {
    if (!namespace || !service || !serviceVersion || !ipAddress) {
      alert("모든 필드를 입력해주세요.");
      return;
    }
    alert(`다크 릴리즈 시작:\n네임스페이스: ${namespace}\n서비스: ${service}\n서비스 버전: ${serviceVersion}\nIP 주소: ${ipAddress}`);
    // 여기에 실제 다크 릴리즈 로직을 추가합니다.
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
            <Button variant="outline" onClick={handleLogout}>
              로그아웃
            </Button>
          </div>

          <Card className="max-w-xl mx-auto">
            <CardHeader>
              <CardTitle>Dark Release</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div>
                <label htmlFor="namespace" className="block text-sm font-medium text-gray-700">네임스페이스</label>
                <Select onValueChange={setNamespace} value={namespace}>
                  <SelectTrigger id="namespace" className="mt-1">
                    <SelectValue placeholder="네임스페이스 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableNamespaces.map((ns) => (
                      <SelectItem key={ns} value={ns}>{ns}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label htmlFor="service" className="block text-sm font-medium text-gray-700">서비스</label>
                <Select onValueChange={setService} value={service}>
                  <SelectTrigger id="service" className="mt-1" disabled={!namespace}>
                    <SelectValue placeholder="서비스 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {namespace && availableServices[namespace]?.map((svc) => (
                      <SelectItem key={svc} value={svc}>{svc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label htmlFor="service-version" className="block text-sm font-medium text-gray-700">서비스 버전</label>
                <Select onValueChange={setServiceVersion} value={serviceVersion}>
                  <SelectTrigger id="service-version" className="mt-1" disabled={!service}>
                    <SelectValue placeholder="서비스 버전 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {service && availableVersions[service]?.map((version) => (
                      <SelectItem key={version} value={version}>{version}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label htmlFor="ip-address" className="block text-sm font-medium text-gray-700">IP 주소</label>
                <Input
                  id="ip-address"
                  type="text"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  placeholder="예: 192.168.1.100"
                  className="mt-1"
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleStartDarkRelease} disabled={!namespace || !service || !serviceVersion || !ipAddress}>
                  배포
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </SidebarProvider>
    </div>
  );
} 