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
import { Label as UiLabel } from '@/components/ui/label';

interface ServiceInfo {
  name: string;
  versions?: string[];
}

interface NamespaceInfo {
  name: string;
  services?: ServiceInfo[];
}

interface ClusterInfo {
  uuid: string;
  name: string;
  namespaces?: NamespaceInfo[];
}

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

  const [clusters, setClusters] = useState<ClusterInfo[]>([]);
  const [selectedClusterUuid, setSelectedClusterUuid] = useState<string | null>(null);
  const [availableNamespaces, setAvailableNamespaces] = useState<NamespaceInfo[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(null);
  const [availableServices, setAvailableServices] = useState<ServiceInfo[]>([]);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [availableVersions, setAvailableVersions] = useState<string[]>([]);
  const [selectedServiceVersion, setSelectedServiceVersion] = useState<string | null>(null);
  const [ipAddress, setIpAddress] = useState<string>("");

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push('/login');
    }
  }, [isLoggedIn, isLoading, router]);

  // 클러스터 목록을 불러오는 useEffect
  useEffect(() => {
    const fetchClusters = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL_CLUSTER || 'http://localhost:8082';
        const response = await fetch(`${apiUrl}/api/v1/cluster`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json(); // DataResponse 객체 전체를 받음
        if (result && result.data) { // result.data가 존재하는지 확인
          // agentConnected 필드가 없으면 false로 기본값 설정 (필요 시)
          const clustersWithAgent = result.data.map((cluster: any) => ({
            ...cluster,
            agentConnected: cluster.agentConnected ?? false
          }));
          setClusters(clustersWithAgent);
        } else {
          setClusters([]);
        }
      } catch (error) {
        console.error("Failed to fetch clusters:", error);
        setClusters([]);
      }
    };

    if (isLoggedIn) {
      fetchClusters();
    }
  }, [isLoggedIn]);

  // 선택된 클러스터에 따라 네임스페이스 업데이트
  useEffect(() => {
    if (selectedClusterUuid) {
      const cluster = clusters.find(c => c.uuid === selectedClusterUuid);
      setAvailableNamespaces(cluster && cluster.namespaces ? cluster.namespaces : []);
      setSelectedNamespace(null); // 클러스터 변경 시 네임스페이스 초기화
      setSelectedService(null);
      setSelectedServiceVersion(null);
    } else {
      setAvailableNamespaces([]);
      setSelectedNamespace(null);
    }
  }, [selectedClusterUuid, clusters]);

  // 선택된 네임스페이스에 따라 서비스 업데이트
  useEffect(() => {
    if (selectedNamespace) {
      const ns = availableNamespaces.find(n => n.name === selectedNamespace);
      setAvailableServices(ns && ns.services ? ns.services : []);
      setSelectedService(null); // 서비스 변경 시 초기화
      setSelectedServiceVersion(null);
    } else {
      setAvailableServices([]);
      setSelectedService(null);
    }
  }, [selectedNamespace, availableNamespaces]);

  // 선택된 서비스에 따라 버전 업데이트
  useEffect(() => {
    if (selectedService) {
      const service = availableServices.find(s => s.name === selectedService);
      setAvailableVersions(service && service.versions ? service.versions : []);
      setSelectedServiceVersion(null); // 버전 변경 시 초기화
    } else {
      setAvailableVersions([]);
      setSelectedServiceVersion(null);
    }
  }, [selectedService, availableServices]);

  const handleLogout = () => {
    logout();
  };

  const handleStartDarkRelease = () => {
    if (!selectedClusterUuid || !selectedNamespace || !selectedService || !selectedServiceVersion || !ipAddress) {
      alert("모든 필드를 입력해주세요.");
      return;
    }
    alert(`다크 릴리즈 시작:\n클러스터 UUID: ${selectedClusterUuid}\n네임스페이스: ${selectedNamespace}\n서비스: ${selectedService}\n서비스 버전: ${selectedServiceVersion}\nIP 주소: ${ipAddress}`);
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
            <div className="group relative flex items-center">
              <Button variant="ghost" className="mr-2 cursor-pointer">user</Button>
              <Button variant="outline" onClick={handleLogout} className="absolute right-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                로그아웃
              </Button>
            </div>
          </div>

          <Card className="max-w-xl mx-auto">
            <CardHeader>
              <CardTitle>Dark Release</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {/* 클러스터 선택 드롭다운 추가 */}
              <div>
                <UiLabel htmlFor="cluster">클러스터</UiLabel>
                <Select onValueChange={setSelectedClusterUuid} value={selectedClusterUuid || ''}>
                  <SelectTrigger id="cluster" className="mt-1">
                    <SelectValue placeholder="클러스터 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {(clusters || []).map(cluster => (
                      <SelectItem key={cluster.uuid} value={cluster.uuid}>{cluster.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <UiLabel htmlFor="namespace" className="block text-sm font-medium text-gray-700">네임스페이스</UiLabel>
                <Select onValueChange={setSelectedNamespace} value={selectedNamespace || ''} disabled={!selectedClusterUuid}>
                  <SelectTrigger id="namespace" className="mt-1">
                    <SelectValue placeholder="네임스페이스 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {(availableNamespaces || []).map(ns => (
                      <SelectItem key={ns.name} value={ns.name}>{ns.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <UiLabel htmlFor="service" className="block text-sm font-medium text-gray-700">서비스</UiLabel>
                <Select onValueChange={setSelectedService} value={selectedService || ''} disabled={!selectedNamespace}>
                  <SelectTrigger id="service" className="mt-1">
                    <SelectValue placeholder="서비스 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {(availableServices || []).map(svc => (
                      <SelectItem key={svc.name} value={svc.name}>{svc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <UiLabel htmlFor="service-version" className="block text-sm font-medium text-gray-700">서비스 버전</UiLabel>
                <Select onValueChange={setSelectedServiceVersion} value={selectedServiceVersion || ''} disabled={!selectedService}>
                  <SelectTrigger id="service-version" className="mt-1">
                    <SelectValue placeholder="서비스 버전 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {(availableVersions || []).map(version => (
                      <SelectItem key={version} value={version}>{version}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <UiLabel htmlFor="ip-address" className="block text-sm font-medium text-gray-700">IP 주소</UiLabel>
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
                <Button onClick={handleStartDarkRelease} disabled={!selectedClusterUuid || !selectedNamespace || !selectedService || !selectedServiceVersion || !ipAddress}>
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