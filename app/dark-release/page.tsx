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
  agentConnected?: boolean;
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
          const clustersWithAgent = result.data.map((cluster: ClusterInfo) => ({
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
    const fetchNamespaces = async () => {
      if (!selectedClusterUuid) {
        setAvailableNamespaces([]);
        setSelectedNamespace(null);
        return;
      }
      
      try {
        const apiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL_CLUSTER || 'http://localhost:8082';
        const response = await fetch(`${apiUrl}/api/v1/cluster/namespaces?clusterId=${selectedClusterUuid}`);
        if (!response.ok) throw new Error('네임스페이스 목록을 불러오는데 실패했습니다.');
        
        const data = await response.json();
        setAvailableNamespaces(data.namespaces.map((ns: string) => ({ name: ns })));
        setSelectedNamespace(null);
        setSelectedService(null);
        setSelectedServiceVersion(null);
      } catch (error) {
        console.error('네임스페이스 목록을 불러오는데 실패했습니다:', error);
        setAvailableNamespaces([]);
      }
    };

    fetchNamespaces();
  }, [selectedClusterUuid]);

  // 선택된 네임스페이스에 따라 서비스 업데이트
  useEffect(() => {
    const fetchServices = async () => {
      if (!selectedClusterUuid || !selectedNamespace) {
        setAvailableServices([]);
        setSelectedService(null);
        return;
      }
      
      try {
        const apiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL_CLUSTER || 'http://localhost:8082';
        const response = await fetch(`${apiUrl}/api/v1/cluster/services?clusterId=${selectedClusterUuid}&namespace=${selectedNamespace}`);
        if (!response.ok) throw new Error('서비스 목록을 불러오는데 실패했습니다.');
        
        const data = await response.json();
        setAvailableServices(data.serviceNames.map((svc: string) => ({ name: svc, versions: [] })));
        setSelectedService(null);
        setSelectedServiceVersion(null);
      } catch (error) {
        console.error('서비스 목록을 불러오는데 실패했습니다:', error);
        setAvailableServices([]);
      }
    };

    fetchServices();
  }, [selectedClusterUuid, selectedNamespace]);

  // 선택된 서비스에 따라 버전 업데이트
  useEffect(() => {
    const fetchVersions = async () => {
      if (!selectedClusterUuid || !selectedNamespace || !selectedService) {
        setAvailableVersions([]);
        setSelectedServiceVersion(null);
        return;
      }
      
      try {
        const apiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL_CLUSTER || 'http://localhost:8082';
        const response = await fetch(`${apiUrl}/api/v1/cluster/deployments?clusterId=${selectedClusterUuid}&namespace=${selectedNamespace}&serviceName=${selectedService}`);
        if (!response.ok) throw new Error('디플로이먼트 정보를 불러오는데 실패했습니다.');
        
        const data = await response.json();
        const versions = new Set<string>();
        
        if (data.data && Array.isArray(data.data)) {
          data.data.forEach((deployment: any) => {
            if (deployment.containers && Array.isArray(deployment.containers)) {
              deployment.containers.forEach((container: any) => {
                if (container.image) {
                  const imageTag = container.image.split(':')[1] || 'latest';
                  versions.add(imageTag);
                }
              });
            }
          });
        }
        
        setAvailableVersions(Array.from(versions));
        setSelectedServiceVersion(null);
      } catch (error) {
        console.error('버전 목록을 불러오는데 실패했습니다:', error);
        setAvailableVersions([]);
      }
    };

    fetchVersions();
  }, [selectedClusterUuid, selectedNamespace, selectedService]);

  const handleLogout = () => {
    logout();
  };

  const handleStartDarkRelease = async () => {
    if (!selectedClusterUuid || !selectedNamespace || !selectedService || !selectedServiceVersion || !ipAddress) {
      alert("모든 필드를 입력해주세요.");
      return;
    }

    try {
      const crdApiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL_CRD || 'http://localhost:8084';
      
      // 1단계: 먼저 ServiceEntity 생성
      const serviceEntityData = {
        name: selectedService,
        namespace: selectedNamespace,
        serviceType: 'StandardType', // 다크 릴리스는 StandardType 사용
        commitHash: [selectedServiceVersion] // 선택된 버전으로 설정
      };
      
      console.log('ServiceEntity 요청 데이터:', serviceEntityData);

      const serviceEntityResponse = await fetch(`${crdApiUrl}/crd/api/v1/${selectedClusterUuid}/serviceEntity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(serviceEntityData),
      });

      if (!serviceEntityResponse.ok) {
        const errorText = await serviceEntityResponse.text();
        console.error('ServiceEntity 에러 응답:', errorText);
        throw new Error(`ServiceEntity 생성 실패! status: ${serviceEntityResponse.status}, 응답: ${errorText}`);
      }

      const serviceEntityResult = await serviceEntityResponse.json();
      
      console.log('ServiceEntity 응답 전체:', JSON.stringify(serviceEntityResult, null, 2));
      console.log('ServiceEntity result:', serviceEntityResult.result);
      console.log('ServiceEntity result의 모든 키:', serviceEntityResult.result ? Object.keys(serviceEntityResult.result) : 'result가 없음');
      console.log('ServiceEntity 응답 result.ID:', serviceEntityResult.result?.ID);
      console.log('ServiceEntity 응답 result.id (소문자):', serviceEntityResult.result?.id);
      
      if (!serviceEntityResult.result || !serviceEntityResult.code) {
        throw new Error(serviceEntityResult.message || 'ServiceEntity 생성에 실패했습니다.');
      }

      // ID 또는 id 둘 다 시도
      const serviceEntityId = serviceEntityResult.result.ID || serviceEntityResult.result.id;
      console.log('추출된 serviceEntityId:', serviceEntityId);
      console.log('serviceEntityId 타입:', typeof serviceEntityId);
      
      if (!serviceEntityId) {
        console.error('ID 추출 실패. result 구조:', serviceEntityResult.result);
        throw new Error('ServiceEntity ID를 받아오지 못했습니다.');
      }

      // 2단계: 생성된 ServiceEntity ID로 DarknessRelease 생성
      const darknessReleaseData = {
        serviceEntityId: serviceEntityId,
        commitHash: selectedServiceVersion,
        ips: [ipAddress]
      };

      console.log('DarknessRelease 요청 데이터:', darknessReleaseData);

      const darknessResponse = await fetch(`${crdApiUrl}/crd/api/v1/${selectedClusterUuid}/darknessRelease`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(darknessReleaseData),
      });

      if (!darknessResponse.ok) {
        const errorText = await darknessResponse.text();
        console.error('DarknessRelease 에러 응답:', errorText);
        throw new Error(`DarknessRelease 생성 실패! status: ${darknessResponse.status}, 응답: ${errorText}`);
      }

      const darknessResult = await darknessResponse.json();
      
      if (darknessResult.result && darknessResult.code) {
        alert(`다크 릴리스가 성공적으로 생성되었습니다!\n` +
              `ServiceEntity ID: ${serviceEntityId}\n` +
              `서비스: ${selectedService}\n` +
              `네임스페이스: ${selectedNamespace}\n` +
              `버전: ${selectedServiceVersion}\n` +
              `IP: ${ipAddress}`);
        
        // 성공 후 폼 초기화
        setSelectedService(null);
        setSelectedServiceVersion(null);
        setIpAddress("");
      } else {
        throw new Error(darknessResult.message || '다크 릴리스 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('다크 릴리스 생성 중 오류 발생:', error);
      alert(`다크 릴리스 생성에 실패했습니다: ${error instanceof Error ? error.message : String(error)}`);
    }
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
                <UiLabel htmlFor="service-version" className="block text-sm font-medium text-gray-700">deployment 버전</UiLabel>
                <Select onValueChange={setSelectedServiceVersion} value={selectedServiceVersion || ''} disabled={!selectedService}>
                  <SelectTrigger id="service-version" className="mt-1">
                    <SelectValue placeholder="deployment 버전 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableVersions.length > 0 ? (
                      availableVersions.map(version => (
                        <SelectItem key={version} value={version}>{version}</SelectItem>
                      ))
                    ) : selectedService ? (
                      <SelectItem key="no-deployment" value="no-deployment" disabled>deployment가 없습니다</SelectItem>
                    ) : null}
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