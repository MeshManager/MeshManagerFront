'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2 } from "lucide-react";



interface NamespaceListResponse {
  namespaces: string[];
}

interface ServiceNameListResponse {
  serviceNames: string[];
}

interface ClusterInfo {
  uuid: string;
  name: string;
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

export default function DeployPage() {
  const router = useRouter();
  const { isLoggedIn, logout, isLoading } = useAuth();

  const [clusters, setClusters] = useState<ClusterInfo[]>([]);
  const [selectedClusterUuid, setSelectedClusterUuid] = useState<string | null>(null);
  const [availableNamespaces, setAvailableNamespaces] = useState<string[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(null);
  const [availableServices, setAvailableServices] = useState<string[]>([]);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [deployVersion, setDeployVersion] = useState<string>('');
  const [isDeploying, setIsDeploying] = useState<boolean>(false);

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      // 현재 페이지를 로그인 후 리다이렉션 대상으로 저장
      localStorage.setItem('redirectAfterLogin', '/deploy');
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
        const result = await response.json();
        if (result && result.data) {
          setClusters(result.data);
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
        
        const data: NamespaceListResponse = await response.json();
        setAvailableNamespaces(data.namespaces);
        setSelectedNamespace(null);
        setSelectedService(null);
      } catch (error) {
        console.error('네임스페이스 목록을 불러오는데 실패했습니다:', error);
        setAvailableNamespaces([]);
      }
    };

    fetchNamespaces();
  }, [selectedClusterUuid]);

  // 선택된 클러스터와 네임스페이스에 따라 서비스 업데이트
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
        
        const data: ServiceNameListResponse = await response.json();
        setAvailableServices(data.serviceNames);
        setSelectedService(null);
      } catch (error) {
        console.error('서비스 목록을 불러오는데 실패했습니다:', error);
        setAvailableServices([]);
      }
    };

    fetchServices();
  }, [selectedClusterUuid, selectedNamespace]);

  const handleLogout = () => {
    logout();
  };

  const handleDeploy = async () => {
    if (!selectedClusterUuid || !selectedNamespace || !selectedService || !deployVersion.trim()) {
      alert("모든 필드를 선택/입력해주세요.");
      return;
    }

    setIsDeploying(true);

    try {
      // CRD 서비스 API URL
      const crdApiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL_CRD || 'http://localhost:8084';
      
      // Service Entity 생성 요청 데이터
      const serviceEntityData = {
        name: selectedService,
        namespace: selectedNamespace,
        serviceType: "StandardType", // 일반 배포용
        ratio: null, // 일반 배포에서는 ratio를 null로 설정
        commitHash: [deployVersion] // 배포할 버전을 배열로 전달
      };

      console.log("배포 시작:", {
        cluster: selectedClusterUuid,
        namespace: selectedNamespace,
        service: selectedService,
        version: deployVersion,
        requestData: serviceEntityData
      });

      // Service Entity 생성 API 호출
      const response = await fetch(`${crdApiUrl}/api/v1/crd/${selectedClusterUuid}/serviceEntity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(serviceEntityData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`배포 API 호출 실패: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        alert(`배포가 성공적으로 완료되었습니다!\nService Entity ID: ${result.data.id}`);
        console.log("배포 성공:", result);
        
        // 폼 초기화
        setDeployVersion('');
      } else {
        throw new Error(result.message || "배포 처리 중 오류가 발생했습니다.");
      }
      
    } catch (error) {
      console.error("배포 중 오류 발생:", error);
      
      let errorMessage = "배포 중 오류가 발생했습니다.";
      if (error instanceof Error) {
        errorMessage = `배포 실패: ${error.message}`;
      }
      
      alert(errorMessage);
    } finally {
      setIsDeploying(false);
    }
  };

  if (isLoading) {
    return null;
  }

  if (!isLoggedIn) {
    return null;
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

          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Deploy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 클러스터 선택 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">클러스터 선택</label>
                <Select value={selectedClusterUuid || ''} onValueChange={setSelectedClusterUuid}>
                  <SelectTrigger>
                    <SelectValue placeholder="클러스터를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {clusters.map((cluster) => (
                      <SelectItem key={cluster.uuid} value={cluster.uuid}>
                        {cluster.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 네임스페이스 선택 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">네임스페이스</label>
                <Select 
                  value={selectedNamespace || ''} 
                  onValueChange={setSelectedNamespace}
                  disabled={!selectedClusterUuid}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="네임스페이스를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableNamespaces.map((namespace) => (
                      <SelectItem key={namespace} value={namespace}>
                        {namespace}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 서비스 선택 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">서비스</label>
                <Select 
                  value={selectedService || ''} 
                  onValueChange={setSelectedService}
                  disabled={!selectedNamespace}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="서비스를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableServices.map((service) => (
                      <SelectItem key={service} value={service}>
                        {service}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 배포할 버전 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">배포할 버전</label>
                <Input
                  type="text"
                  value={deployVersion}
                  onChange={(e) => setDeployVersion(e.target.value)}
                  placeholder="예: v1.2.3, latest, main-abc123"
                />
              </div>

              {/* 배포 버튼 */}
              <div className="flex justify-center pt-4">
                <Button 
                  onClick={handleDeploy} 
                  disabled={isDeploying || !selectedClusterUuid || !selectedNamespace || !selectedService || !deployVersion.trim()}
                  className="w-full max-w-sm"
                >
                  {isDeploying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      배포 중...
                    </>
                  ) : (
                    "배포하기"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </SidebarProvider>
    </div>
  );
} 