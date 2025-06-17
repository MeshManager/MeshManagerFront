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

interface ServiceInfo {
  name: string;
  versions: string[];
}

interface NamespaceInfo {
  name: string;
  services: ServiceInfo[];
}

interface ClusterInfo {
  uuid: string;
  name: string;
  agentConnected?: boolean;
  // 백엔드에서 namespaces를 직접 주지 않을 경우, 이 필드는 없을 수 있습니다.
  // namespaces?: NamespaceInfo[]; // 제거하거나 선택적 필드로 유지
}

// MOCK DATA: 백엔드에서 실제 데이터를 제공하기 전까지 사용
const MOCK_NAMESPACES: NamespaceInfo[] = [
  {
    name: 'default',
    services: [
      { name: 'my-service-v1', versions: ['1.0.0', '1.1.0'] },
      { name: 'another-service', versions: ['2.0.0', '2.1.0'] },
    ],
  },
  {
    name: 'kube-system',
    services: [{ name: 'kube-dns', versions: ['1.0.0'] }],
  },
  {
    name: 'mesh-app',
    services: [
      { name: 'frontend-service', versions: ['v1.0.0', 'v1.0.1', 'v1.1.0'] },
      { name: 'backend-service', versions: ['v2.0.0', 'v2.0.1'] },
    ],
  },
];

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

export default function CanaryDeployPage() {
  const router = useRouter();
  const { isLoggedIn, logout, isLoading } = useAuth();

  const [clusters, setClusters] = useState<ClusterInfo[]>([]);
  const [selectedClusterUuid, setSelectedClusterUuid] = useState<string | null>(null);
  const [availableNamespaces, setAvailableNamespaces] = useState<NamespaceInfo[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(null);
  const [availableServices, setAvailableServices] = useState<ServiceInfo[]>([]);
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
          const clustersWithAgent = result.data.map((cluster: ClusterInfo) => ({
            ...cluster,
            agentConnected: cluster.agentConnected ?? false // app/page.tsx 와 일관되게 처리
          }));
          setClusters(clustersWithAgent);
          // if (clustersWithAgent.length > 0) {
          //   setSelectedClusterUuid(clustersWithAgent[0].uuid); // 첫 번째 클러스터 자동 선택
          // }
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

  // 선택된 클러스터에 따라 네임스페이스 업데이트 (현재는 MOCK 데이터 사용)
  useEffect(() => {
    // 실제 백엔드에서 클러스터별 네임스페이스를 제공할 경우, 여기 로직을 업데이트해야 합니다.
    setAvailableNamespaces(MOCK_NAMESPACES); // 모든 클러스터에 동일한 MOCK 네임스페이스 적용
    setSelectedNamespace(null); // 클러스터 변경 시 네임스페이스 초기화
    setSelectedService(null);
    setOriginalVersion(null);
    setCanaryVersion(null);
  }, [selectedClusterUuid]); // 'clusters' 의존성을 제거 (mock data 사용 시 불필요)

  // 선택된 네임스페이스에 따라 서비스 업데이트
  useEffect(() => {
    if (selectedNamespace) {
      const ns = availableNamespaces.find(n => n.name === selectedNamespace);
      setAvailableServices(ns ? ns.services : []);
      setSelectedService(null); // 서비스 변경 시 초기화
      setOriginalVersion(null);
      setCanaryVersion(null);
    } else {
      setAvailableServices([]);
      setSelectedService(null);
    }
  }, [selectedNamespace, availableNamespaces]);

  // 선택된 서비스에 따라 버전 업데이트
  useEffect(() => {
    if (selectedService) {
      const service = availableServices.find(s => s.name === selectedService);
      setAvailableVersions(service ? service.versions : []);
      setOriginalVersion(null); // 버전 변경 시 초기화
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
    if (selectedClusterUuid && selectedNamespace && selectedService && originalVersion && canaryVersion && canaryRatio[0] !== undefined) {
      alert(`Deploying Canary:\nCluster UUID: ${selectedClusterUuid}\nNamespace: ${selectedNamespace}\nService: ${selectedService}\nOriginal Version: ${originalVersion}\nCanary Version: ${canaryVersion}\nRatio: ${canaryRatio[0]}%\nSticky Session: ${stickySession ? 'On' : 'Off'}`);
      // 여기에 실제 배포 로직을 추가합니다.
    } else {
      alert('모든 필드를 선택해주세요.');
    }
  };

  const handleRollback = () => {
    if (selectedClusterUuid && selectedNamespace && selectedService) {
      alert(`Rolling back:\nCluster UUID: ${selectedClusterUuid}\nNamespace: ${selectedNamespace}\nService: ${selectedService}`);
      // 여기에 실제 롤백 로직을 추가합니다.
    } else {
      alert('클러스터, 네임스페이스, 서비스를 선택해주세요.');
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
            <div className="group relative flex items-center">
              <Button variant="ghost" className="mr-2 cursor-pointer">user</Button>
              <Button variant="outline" onClick={handleLogout} className="absolute right-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                로그아웃
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Canary Deploy</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <UiLabel htmlFor="cluster">클러스터</UiLabel>
                  <Select onValueChange={setSelectedClusterUuid} value={selectedClusterUuid || ''}>
                    <SelectTrigger id="cluster">
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
                  <UiLabel htmlFor="namespace">네임스페이스</UiLabel>
                  <Select onValueChange={setSelectedNamespace} value={selectedNamespace || ''} disabled={!selectedClusterUuid}>
                    <SelectTrigger id="namespace">
                      <SelectValue placeholder="네임스페이스 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {(availableNamespaces || []).map(ns => (
                        <SelectItem key={ns.name} value={ns.name}>{ns.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <UiLabel htmlFor="service">서비스</UiLabel>
                  <Select onValueChange={setSelectedService} value={selectedService || ''} disabled={!selectedNamespace}>
                    <SelectTrigger id="service">
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
                  <UiLabel htmlFor="original-version">카나리 보낼 버전</UiLabel>
                  <Select onValueChange={setOriginalVersion} value={originalVersion || ''} disabled={!selectedService}>
                    <SelectTrigger id="original-version">
                      <SelectValue placeholder="버전 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {(availableVersions || [])
                        .filter(version => version !== canaryVersion) // 카나리 받을 버전과 겹치지 않게 필터링
                        .map(version => (
                          <SelectItem 
                            key={version} 
                            value={version} 
                          >{version}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <UiLabel htmlFor="canary-version">카나리 받을 버전</UiLabel>
                  <Select onValueChange={setCanaryVersion} value={canaryVersion || ''} disabled={!selectedService || !originalVersion}>
                    <SelectTrigger id="canary-version">
                      <SelectValue placeholder="버전 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {(availableVersions || [])
                        .filter(version => version !== originalVersion) // 기존 버전과 겹치지 않게 필터링
                        .map(version => (
                          <SelectItem 
                            key={version} 
                            value={version} 
                          >{version}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
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
                    className="w-[60%]"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="sticky-session"
                  checked={stickySession}
                  onCheckedChange={setStickySession}
                />
                <UiLabel htmlFor="sticky-session">Sticky Session 활성화</UiLabel>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleRollback} disabled={!selectedClusterUuid || !selectedNamespace || !selectedService}>
                  롤백
                </Button>
                <Button onClick={handleDeploy} disabled={!selectedClusterUuid || !selectedNamespace || !selectedService || !originalVersion || !canaryVersion || canaryRatio[0] === undefined}>
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