'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from "lucide-react";

interface ContainerInfo {
  name: string;
  image: string;
}

interface DeploymentInfo {
  name: string;
  containers: ContainerInfo[];
  podLabels: Record<string, string>;
  replicas: number;
}

interface DeploymentListResponse {
  data: DeploymentInfo[];
}

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

interface DeploymentEntity {
  id: number;
  name: string;
  namespace: string;
  serviceType: string;
  ratio: number;
  commitHash: string[];
  darknessReleaseID?: number;
  dependencyID?: number[];
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
  const [availableVersions, setAvailableVersions] = useState<string[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [currentDeployments, setCurrentDeployments] = useState<DeploymentEntity[]>([]);

  // CRD API URL 정의
  const crdApiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL_CRD || 'http://localhost:8084';



  // 현재 배포 목록을 조회하는 함수 (useCallback으로 메모이제이션)
  const fetchCurrentDeployments = useCallback(async () => {
    console.log('=== fetchCurrentDeployments 시작 ===');
    console.log('selectedClusterUuid:', selectedClusterUuid);
    
    if (!selectedClusterUuid) {
      console.log('클러스터가 선택되지 않아 배포 목록 초기화');
      setCurrentDeployments([]);
      return;
    }
    
    try {
      const url = `${crdApiUrl}/api/v1/crd/${selectedClusterUuid}/list`;
      console.log('배포 목록 조회 URL:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error('현재 배포 목록 조회 실패:', response.status, response.statusText);
        setCurrentDeployments([]);
        return;
      }
      
      const result = await response.json();
      console.log('배포 목록 API 응답:', JSON.stringify(result, null, 2));
      
      // API 응답 구조 수정: result.result.serviceEntityID 형태로 변경
      const serviceEntityIDs = result?.result?.serviceEntityID || result?.data?.serviceEntityID || [];
      
      if (Array.isArray(serviceEntityIDs) && serviceEntityIDs.length > 0) {
        console.log('ServiceEntity ID 목록:', serviceEntityIDs);
        
        const entityDetailsPromises = serviceEntityIDs.map(async (entityId: number) => {
          try {
            const entityUrl = `${crdApiUrl}/api/v1/crd/service/${entityId}`;
            console.log(`Entity ${entityId} 상세 조회 URL:`, entityUrl);
            
            const entityResponse = await fetch(entityUrl);
                          if (entityResponse.ok) {
                const entityResult = await entityResponse.json();
                console.log(`Entity ${entityId} 상세 응답:`, JSON.stringify(entityResult, null, 2));
                
                // API 응답 구조 수정: result 또는 data에서 엔티티 데이터 추출
                const entityData = entityResult?.result || entityResult?.data;
                if (entityData) {
                  const processedData = { id: entityId, ...entityData };
                  console.log(`Entity ${entityId} 처리된 데이터:`, processedData);
                  return processedData;
                }
            } else {
              console.error(`Entity ${entityId} 조회 실패:`, entityResponse.status, entityResponse.statusText);
            }
          } catch (error) {
            console.error(`Entity ${entityId} 조회 실패:`, error);
          }
          return null;
        });
        
        Promise.all(entityDetailsPromises).then(details => {
          console.log('모든 Entity 상세 데이터:', details);
          
          const validEntities = details.filter(entity => entity !== null);
          console.log('Valid entities (null 제외):', validEntities);
          
          const standardTypeEntities = validEntities.filter(entity => entity.serviceType === 'StandardType');
          console.log('StandardType entities:', standardTypeEntities);
          
          setCurrentDeployments(standardTypeEntities as DeploymentEntity[]);
          console.log('최종 설정된 배포 목록:', standardTypeEntities);
        });
      } else {
        console.log('조건에 맞지 않는 응답 구조:', {
          success: result.success,
          hasData: !!result.data,
          hasServiceEntityID: result.data && Array.isArray(result.data.serviceEntityID),
          serviceEntityIDLength: result.data?.serviceEntityID?.length || 0
        });
        setCurrentDeployments([]);
      }
    } catch (error) {
      console.error("배포 목록 조회 중 오류 발생:", error);
      setCurrentDeployments([]);
    }
    
    console.log('=== fetchCurrentDeployments 종료 ===');
  }, [selectedClusterUuid, setCurrentDeployments, crdApiUrl]);

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

  // 선택된 서비스에 따라 디플로이먼트 정보 및 버전 업데이트
  useEffect(() => {
    const fetchDeployments = async () => {
      if (!selectedClusterUuid || !selectedNamespace || !selectedService) {
        setAvailableVersions([]);
        setSelectedVersion(null);
        return;
      }
      
      try {
        const apiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL_CLUSTER || 'http://localhost:8082';
        const response = await fetch(`${apiUrl}/api/v1/cluster/deployments?clusterId=${selectedClusterUuid}&namespace=${selectedNamespace}&serviceName=${selectedService}`);
        if (!response.ok) throw new Error('디플로이먼트 정보를 불러오는데 실패했습니다.');
        
        const data: DeploymentListResponse = await response.json();
        
        // 컨테이너 이미지 태그에서 version 추출
        const versions = new Set<string>();
        if (data.data && Array.isArray(data.data)) {
          data.data.forEach((deployment) => {
            if (deployment.containers && Array.isArray(deployment.containers)) {
              deployment.containers.forEach((container) => {
                if (container.image) {
                  const imageTag = container.image.split(':')[1] || 'latest';
                  versions.add(imageTag);
                }
              });
            }
          });
        }
        
        setAvailableVersions(Array.from(versions));
        setSelectedVersion(null);
      } catch (error) {
        console.error('디플로이먼트 정보를 불러오는데 실패했습니다:', error);
        setAvailableVersions([]);
      }
    };

    fetchDeployments();
  }, [selectedClusterUuid, selectedNamespace, selectedService]);

  // 현재 배포 목록을 조회하는 useEffect
  useEffect(() => {
    fetchCurrentDeployments();
  }, [fetchCurrentDeployments]);

  const handleLogout = () => {
    logout();
  };

  const handleDeploy = async () => {
    if (!selectedClusterUuid || !selectedNamespace || !selectedService || !selectedVersion) {
      alert("모든 필드를 선택/입력해주세요.");
      return;
    }

    setIsDeploying(true);

    try {
      // 1단계: 최신 배포 목록 조회 후 기존 배포 확인
      console.log('🔍 1단계: 기존 배포 확인...');
      let existingStandardDeployment = null;
      let existingCanaryDeployments: DeploymentEntity[] = [];
      
      try {
        const existingListResponse = await fetch(`${crdApiUrl}/api/v1/crd/${selectedClusterUuid}/list`);
        if (existingListResponse.ok) {
          const existingListResult = await existingListResponse.json();
          console.log('📋 기존 ServiceEntity 목록:', existingListResult);
          
          const serviceEntityIDs = existingListResult?.result?.serviceEntityID || existingListResult?.data?.serviceEntityID || [];
          
          if (Array.isArray(serviceEntityIDs) && serviceEntityIDs.length > 0) {
            const entityCheckPromises = serviceEntityIDs.map(async (entityId: number) => {
              try {
                const entityResponse = await fetch(`${crdApiUrl}/api/v1/crd/service/${entityId}`);
                if (entityResponse.ok) {
                  const entityResult = await entityResponse.json();
                  const entityData = entityResult?.result || entityResult?.data;
                  
                  if (entityData && 
                      entityData.name === selectedService && 
                      entityData.namespace === selectedNamespace) {
                    
                    if (entityData.serviceType === 'StandardType') {
                      console.log(`✅ 기존 StandardType 배포 발견: ID ${entityId}`);
                      return { id: entityId, ...entityData, type: 'StandardType' };
                    } else if (entityData.serviceType === 'CanaryType' || entityData.serviceType === 'StickyCanaryType') {
                      console.log(`🚀 기존 ${entityData.serviceType} 배포 발견: ID ${entityId}`);
                      return { id: entityId, ...entityData, type: 'CanaryType' };
                    }
                  }
                }
              } catch (error) {
                console.error(`❌ Entity ${entityId} 조회 실패:`, error);
              }
              return null;
            });
            
            const foundEntities = (await Promise.all(entityCheckPromises)).filter(entity => entity !== null);
            
            existingStandardDeployment = foundEntities.find(entity => entity.type === 'StandardType');
            existingCanaryDeployments = foundEntities.filter(entity => entity.type === 'CanaryType');
          }
        }
      } catch (error) {
        console.error('❌ 기존 배포 확인 중 오류:', error);
      }

      // 1-2단계: 기존 StandardType 배포 교체 확인
      if (existingStandardDeployment) {
        const confirmReplace = confirm(
          `'${selectedService}' 서비스에 이미 일반 배포가 존재합니다.\n` +
          `기존 배포 (버전: ${existingStandardDeployment.commitHash?.join(', ') || 'N/A'})를 ` +
          `새 배포 (버전: ${selectedVersion})로 교체하시겠습니까?`
        );
        
        if (!confirmReplace) {
          setIsDeploying(false);
          return;
        }
        
        console.log('🗑️ 기존 StandardType 배포 삭제 진행:', existingStandardDeployment);
        
        const deleteResponse = await fetch(`${crdApiUrl}/api/v1/crd/service/${existingStandardDeployment.id}`, {
          method: 'DELETE',
        });

        if (!deleteResponse.ok) {
          const errorText = await deleteResponse.text();
          throw new Error(`기존 일반 배포 삭제 실패: ${deleteResponse.status} - ${errorText}`);
        }

        const deleteResult = await deleteResponse.json();
        console.log('✅ 기존 일반 배포 삭제 완료:', deleteResult);
        
        // 삭제 후 잠시 대기 (백엔드 처리 시간)
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // 1-3단계: 기존 카나리 배포 삭제 (일반 배포와 카나리 배포는 동시에 존재할 수 없음)
      if (existingCanaryDeployments.length > 0) {
        const confirmDeleteCanary = confirm(
          `'${selectedService}' 서비스에 카나리 배포가 존재합니다.\n` +
          `일반 배포를 진행하기 위해 기존 카나리 배포를 삭제하시겠습니까?\n\n` +
          `삭제할 카나리 배포:\n` +
          existingCanaryDeployments.map(canary => 
            `- ${canary.serviceType} (버전: ${canary.commitHash?.join(', ') || 'N/A'})`
          ).join('\n')
        );
        
        if (!confirmDeleteCanary) {
          setIsDeploying(false);
          return;
        }
        
        console.log(`🗑️ ${existingCanaryDeployments.length}개의 카나리 배포 삭제 진행`);
        
        for (const canaryDeployment of existingCanaryDeployments) {
          try {
            console.log(`🗑️ 카나리 배포 삭제 시도: ID ${canaryDeployment.id}`);
            const deleteResponse = await fetch(`${crdApiUrl}/api/v1/crd/service/${canaryDeployment.id}`, {
              method: 'DELETE',
            });

            if (!deleteResponse.ok) {
              const errorText = await deleteResponse.text();
              console.error(`❌ 카나리 배포 ${canaryDeployment.id} 삭제 실패:`, errorText);
              throw new Error(`카나리 배포 삭제 실패: ${deleteResponse.status} - ${errorText}`);
            }

            const deleteResult = await deleteResponse.json();
            console.log(`✅ 카나리 배포 ${canaryDeployment.id} 삭제 완료:`, deleteResult);
          } catch (error) {
            console.error(`❌ 카나리 배포 ${canaryDeployment.id} 삭제 중 오류:`, error);
            throw error;
          }
        }
        
        // 모든 카나리 배포 삭제 후 대기
        console.log('⏳ 카나리 배포 삭제 완료 후 대기 중...');
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      
      // 2단계: 새로운 Service Entity 생성 요청 데이터
      const serviceEntityData = {
        name: selectedService,
        namespace: selectedNamespace,
        serviceType: "StandardType", // 일반 배포용
        ratio: 100, // 일반 배포에서는 ratio를 null로 설정
        commitHash: [selectedVersion] // 배포할 버전을 배열로 전달
      };

      console.log("배포 시작:", {
        cluster: selectedClusterUuid,
        namespace: selectedNamespace,
        service: selectedService,
        version: selectedVersion,
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
      
      console.log("배포 API 응답 전체:", JSON.stringify(result, null, 2));
      
      // 응답 구조 확인 후 적절히 처리
      if (result.success === true || result.success === "true" || (result.data && result.data.id)) {
        const hasExistingDeployment = existingStandardDeployment || existingCanaryDeployments.length > 0;
        const successMessage = hasExistingDeployment 
          ? `배포가 성공적으로 교체되었습니다!\n이전 배포를 삭제하고 새 배포를 생성했습니다.\nService Entity ID: ${result.data?.id || 'N/A'}`
          : `배포가 성공적으로 완료되었습니다!\nService Entity ID: ${result.data?.id || 'N/A'}`;
        alert(successMessage);
        console.log("배포 성공:", result);
        
        // 폼 초기화
        setSelectedVersion(null);
        
        // 배포 목록 새로고침
        await fetchCurrentDeployments();
      } else {
        // 성공 메시지가 포함된 경우에도 성공으로 처리
        const message = result.message || result.msg || "";
        if (message.includes("성공") || message.includes("success")) {
          const hasExistingDeployment = existingStandardDeployment || existingCanaryDeployments.length > 0;
          const successMessage = hasExistingDeployment 
            ? `배포가 성공적으로 교체되었습니다!\n이전 배포를 삭제하고 새 배포를 생성했습니다.\n메시지: ${message}`
            : `배포가 완료되었습니다!\n메시지: ${message}`;
          alert(successMessage);
          console.log("배포 성공 (메시지 기반):", result);
          
          // 폼 초기화
          setSelectedVersion(null);
          
          // 배포 목록 새로고침
          await fetchCurrentDeployments();
        } else {
          throw new Error(message || "배포 처리 중 오류가 발생했습니다.");
        }
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

  const handleDeploymentDelete = async (deployment: DeploymentEntity) => {
    // 확인 메시지
    let confirmMessage = `'${deployment.name}' 일반 배포를 삭제하시겠습니까?\n\n`;
    confirmMessage += `서비스: ${deployment.name}\n`;
    confirmMessage += `네임스페이스: ${deployment.namespace}\n`;
    confirmMessage += `버전: ${deployment.commitHash?.join(', ') || 'N/A'}\n\n`;
    
    if (deployment.darknessReleaseID) {
      confirmMessage += `※ 이 서비스에 다크 릴리즈가 연결되어 있습니다.\n`;
      confirmMessage += `ServiceEntity를 삭제하면 다크 릴리즈도 함께 삭제됩니다.`;
    } else {
      confirmMessage += `※ 연결된 다른 배포가 없으므로 ServiceEntity가 완전히 삭제됩니다.`;
    }
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      console.log('일반 배포 삭제 시도:', deployment);
      console.log('다크 릴리즈 연결 여부:', deployment.darknessReleaseID ? 'Y' : 'N');
      
      // 백엔드에는 PUT API가 없으므로 모든 경우에 DELETE 사용
      console.log('🗑️ ServiceEntity 삭제 모드');
      
      const response = await fetch(`${crdApiUrl}/api/v1/crd/service/${deployment.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`배포 삭제 실패: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('배포 삭제 API 응답:', JSON.stringify(result, null, 2));
      
      // 성공 조건을 더 유연하게 처리
      const isSuccess = result.success === true || 
                       result.success === "true" ||
                       (result.message && result.message.includes("삭제 성공")) ||
                       (result.msg && result.msg.includes("삭제 성공"));
      
      if (isSuccess) {
        alert('배포가 성공적으로 삭제되었습니다.');
        console.log('배포 삭제 성공:', result);
      } else {
        // 메시지를 기반으로 한 번 더 성공 체크
        const message = result.message || result.msg || "";
        if (message.includes("성공") || message.includes("success")) {
          alert(`배포가 삭제되었습니다.\n메시지: ${message}`);
          console.log('배포 삭제 성공 (메시지 기반):', result);
        } else {
          throw new Error(message || '배포 삭제 중 오류가 발생했습니다.');
        }
      }
      
      // 로컬 상태에서 먼저 삭제된 항목 제거
      setCurrentDeployments(prevDeployments => 
        prevDeployments.filter(dep => dep.id !== deployment.id)
      );
      
      // 백엔드 처리 시간을 고려한 지연 후 목록 새로고침
      setTimeout(async () => {
        await fetchCurrentDeployments();
      }, 1000);
      
    } catch (error) {
      console.error('일반 배포 삭제 중 오류 발생:', error);
      
      let errorMessage = '일반 배포 삭제 중 오류가 발생했습니다.';
      if (error instanceof Error) {
        errorMessage = `일반 배포 삭제 실패: ${error.message}`;
      }
      
      alert(errorMessage);
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
              <CardTitle>Standard Deploy</CardTitle>
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
                <Select 
                  value={selectedVersion || ''} 
                  onValueChange={setSelectedVersion}
                  disabled={!selectedService}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="버전을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableVersions.map((version) => (
                      <SelectItem key={version} value={version}>
                        {version}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 현재 배포 목록 섹션 */}
              {selectedClusterUuid && (
                <div className="mt-6 space-y-4">
                  <hr className="my-4" />
                  <h3 className="text-lg font-semibold">현재 배포 목록</h3>
                  
                  {currentDeployments.length > 0 ? (
                    currentDeployments.map((deployment, index) => (
                      <Card key={index} className="p-4 bg-green-50">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium mb-2">
                              Service: {deployment.name} (ID: {deployment.id})
                            </h4>
                            <p className="text-sm text-gray-600 mb-1">
                              네임스페이스: {deployment.namespace}
                            </p>
                            <p className="text-sm text-gray-600 mb-1">
                              타입: {deployment.serviceType}
                            </p>
                            <p className="text-sm text-gray-600 mb-2">
                              버전: {deployment.commitHash ? deployment.commitHash.join(', ') : 'N/A'}
                            </p>
                          </div>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => handleDeploymentDelete(deployment)}
                          >
                            삭제
                          </Button>
                        </div>
                      </Card>
                    ))
                  ) : (
                    <Card className="p-4 bg-gray-50">
                      <p className="text-center text-gray-500">
                        현재 StandardType 배포가 없습니다.
                      </p>
                    </Card>
                  )}
                </div>
              )}

              {/* 배포 버튼 */}
              <div className="flex justify-end gap-2">
                <Button 
                  onClick={handleDeploy} 
                  disabled={isDeploying || !selectedClusterUuid || !selectedNamespace || !selectedService || !selectedVersion}
                >
                  {isDeploying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      배포 중...
                    </>
                  ) : (
                    "배포"
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