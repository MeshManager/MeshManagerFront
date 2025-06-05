'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label as UiLabel } from '@/components/ui/label';

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

// Temporary data for demonstration
const namespaces = [
  { name: 'default', services: [
    { name: 'my-service-v1', versions: ['v1.0', 'v1.1'] },
    { name: 'another-service', versions: ['v2.0', 'v2.1'] }
  ] },
  { name: 'kube-system', services: [
    { name: 'kube-dns', versions: ['1.0'] }
  ] },
  { name: 'test-ns', services: [
    { name: 'test-app', versions: ['v1.0.0', 'v1.0.1', 'v1.1.0'] },
    { name: 'test-db', versions: ['2.0'] }
  ] },
];

export default function CanaryDeployPage() {
  const router = useRouter();
  const { isLoggedIn, logout, isLoading } = useAuth();

  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(null);
  const [availableServices, setAvailableServices] = useState<Array<{ name: string; versions: string[]; }>>([]);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [availableVersions, setAvailableVersions] = useState<string[]>([]);
  const [originalVersion, setOriginalVersion] = useState<string | null>(null);
  const [canaryVersion, setCanaryVersion] = useState<string | null>(null);
  const [canaryRatio, setCanaryRatio] = useState<number[]>([10]); // Default to 10%
  const [stickySession, setStickySession] = useState<boolean>(false);

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push('/login');
    }
  }, [isLoggedIn, isLoading, router]);

  useEffect(() => {
    if (selectedNamespace) {
      const ns = namespaces.find(n => n.name === selectedNamespace);
      setAvailableServices(ns ? ns.services : []);
      setSelectedService(null); // Reset service when namespace changes
      setOriginalVersion(null);
      setCanaryVersion(null);
    } else {
      setAvailableServices([]);
      setSelectedService(null);
      setOriginalVersion(null);
      setCanaryVersion(null);
    }
  }, [selectedNamespace]);

  useEffect(() => {
    if (selectedService) {
      const service = availableServices.find(s => s.name === selectedService);
      setAvailableVersions(service ? service.versions : []);
      setOriginalVersion(null); // Reset versions when service changes
      setCanaryVersion(null);
    } else {
      setAvailableVersions([]);
      setOriginalVersion(null);
      setCanaryVersion(null);
    }
  }, [selectedService, availableServices]);

  const handleLogout = () => {
    logout();
  };

  const handleDeploy = () => {
    if (selectedNamespace && selectedService && originalVersion && canaryVersion && canaryRatio[0] !== undefined) {
      alert(`Deploying Canary:\nNamespace: ${selectedNamespace}\nService: ${selectedService}\nOriginal Version: ${originalVersion}\nCanary Version: ${canaryVersion}\nRatio: ${canaryRatio[0]}%\nSticky Session: ${stickySession ? 'On' : 'Off'}`);
      // 여기에 실제 배포 로직을 추가합니다.
    } else {
      alert('모든 필드를 선택해주세요.');
    }
  };

  const handleRollback = () => {
    if (selectedNamespace && selectedService) {
      alert(`Rolling back:\nNamespace: ${selectedNamespace}\nService: ${selectedService}`);
      // 여기에 실제 롤백 로직을 추가합니다.
    } else {
      alert('네임스페이스와 서비스를 선택해주세요.');
    }
  };

  if (isLoading) {
    return null; // 또는 로딩 스피너 등을 표시할 수 있습니다.
  }

  if (!isLoggedIn) {
    return null; // 로그인되지 않은 경우 아무것도 렌더링하지 않고 리다이렉션을 기다립니다. (이 로직은 위 useEffect에서 처리되므로 사실상 도달하지 않습니다.)
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

          <Card>
            <CardHeader>
              <CardTitle>Canary Deploy</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <UiLabel htmlFor="namespace">네임스페이스</UiLabel>
                  <Select onValueChange={setSelectedNamespace} value={selectedNamespace || ''}>
                    <SelectTrigger id="namespace">
                      <SelectValue placeholder="네임스페이스 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {namespaces.map(ns => (
                        <SelectItem key={ns.name} value={ns.name}>{ns.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <UiLabel htmlFor="service">서비스</UiLabel>
                  <Select onValueChange={setSelectedService} value={selectedService || ''} disabled={!selectedNamespace}>
                    <SelectTrigger id="service">
                      <SelectValue placeholder="서비스 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableServices.map(svc => (
                        <SelectItem key={svc.name} value={svc.name}>{svc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <UiLabel htmlFor="original-version">카나리 보낼 버전</UiLabel>
                  <Select onValueChange={setOriginalVersion} value={originalVersion || ''} disabled={!selectedService}>
                    <SelectTrigger id="original-version">
                      <SelectValue placeholder="버전 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableVersions
                        .map(version => (
                          <SelectItem 
                            key={version} 
                            value={version} 
                            disabled={version === canaryVersion}
                          >{version}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <UiLabel htmlFor="canary-version">카나리 받을 버전</UiLabel>
                  <Select onValueChange={setCanaryVersion} value={canaryVersion || ''} disabled={!selectedService}>
                    <SelectTrigger id="canary-version">
                      <SelectValue placeholder="버전 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableVersions
                        .map(version => (
                          <SelectItem 
                            key={version} 
                            value={version} 
                            disabled={version === originalVersion}
                          >{version}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <UiLabel htmlFor="canary-ratio">카나리 트래픽 비율: {canaryRatio[0]}%</UiLabel>
                <Slider
                  id="canary-ratio"
                  min={0}
                  max={100}
                  step={5}
                  value={canaryRatio}
                  onValueChange={setCanaryRatio}
                  className="mt-2"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="sticky-session"
                  checked={stickySession}
                  onCheckedChange={setStickySession}
                />
                <UiLabel htmlFor="sticky-session">Sticky Session</UiLabel>
              </div>

              <div className="flex gap-4 mt-4">
                <Button onClick={handleDeploy} disabled={!selectedNamespace || !selectedService || !originalVersion || !canaryVersion || canaryRatio[0] === undefined}>
                  배포
                </Button>
                <Button onClick={handleRollback} variant="destructive" disabled={!selectedNamespace || !selectedService}>
                  롤백
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </SidebarProvider>
    </div>
  );
} 