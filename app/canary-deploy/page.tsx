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
  agentConnected?: boolean;
}

interface CanaryDeployment {
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

export default function CanaryDeployPage() {
  const router = useRouter();
  const { isLoggedIn, logout, isLoading } = useAuth();

  const [clusters, setClusters] = useState<ClusterInfo[]>([]);
  const [selectedClusterUuid, setSelectedClusterUuid] = useState<string | null>(null);
  const [availableNamespaces, setAvailableNamespaces] = useState<string[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(null);
  const [availableServices, setAvailableServices] = useState<string[]>([]);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [availableVersions, setAvailableVersions] = useState<string[]>([]);
  const [originalVersion, setOriginalVersion] = useState<string | null>(null);
  const [canaryVersion, setCanaryVersion] = useState<string | null>(null);
  const [canaryRatio, setCanaryRatio] = useState<number[]>([10]); // Default to 10%
  const [stickySession, setStickySession] = useState<boolean>(false);
  const [deployments, setDeployments] = useState<DeploymentInfo[]>([]);
  const [currentCanaryDeployments, setCurrentCanaryDeployments] = useState<CanaryDeployment[]>([]);

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
        const result = await response.json();
        if (result && result.data) {
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
        
        const data: NamespaceListResponse = await response.json();
        setAvailableNamespaces(data.namespaces);
        setSelectedNamespace(null);
        setSelectedService(null);
        setOriginalVersion(null);
        setCanaryVersion(null);
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
        
        const data: ServiceNameListResponse = await response.json();
        setAvailableServices(data.serviceNames);
        setSelectedService(null);
        setOriginalVersion(null);
        setCanaryVersion(null);
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
        setDeployments([]);
        setAvailableVersions([]);
        setOriginalVersion(null);
        setCanaryVersion(null);
        return;
      }
      
      try {
        const apiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL_CLUSTER || 'http://localhost:8082';
        const response = await fetch(`${apiUrl}/api/v1/cluster/deployments?clusterId=${selectedClusterUuid}&namespace=${selectedNamespace}&serviceName=${selectedService}`);
        if (!response.ok) throw new Error('디플로이먼트 정보를 불러오는데 실패했습니다.');
        
        const data: DeploymentListResponse = await response.json();
        setDeployments(data.data);
        
        // pod 라벨에서 version 추출
        const versions = new Set<string>();
        data.data.forEach(deployment => {
          if (deployment.podLabels && deployment.podLabels.version) {
            versions.add(deployment.podLabels.version);
          }
        });
        
        setAvailableVersions(Array.from(versions));
        setOriginalVersion(null);
        setCanaryVersion(null);
      } catch (error) {
        console.error('디플로이먼트 정보를 불러오는데 실패했습니다:', error);
        setDeployments([]);
        setAvailableVersions([]);
      }
    };

    fetchDeployments();
  }, [selectedClusterUuid, selectedNamespace, selectedService]);

  // 현재 카나리 배포 목록을 조회하는 useEffect
  useEffect(() => {
    const fetchCurrentCanaryDeployments = async () => {
      if (!selectedClusterUuid) {
        setCurrentCanaryDeployments([]);
        return;
      }
      
      try {
        const crdApiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL_CRD || 'http://localhost:8084';
        const response = await fetch(`${crdApiUrl}/crd/api/v1/${selectedClusterUuid}/list`);
        
        if (!response.ok) {
          console.error('현재 카나리 배포 목록 조회 실패');
          return;
        }
        
        const result = await response.json();
        
        if (result.success && result.data.serviceEntityID.length > 0) {
          // 각 Service Entity의 상세 정보를 조회
          const entityDetailsPromises = result.data.serviceEntityID.map(async (entityId: number) => {
            try {
              const entityResponse = await fetch(`${crdApiUrl}/crd/api/v1/service/${entityId}`);
              if (entityResponse.ok) {
                const entityResult = await entityResponse.json();
                if (entityResult.success) {
                  return {
                    id: entityId,
                    ...entityResult.data
                  };
                }
              }
            } catch (error) {
              console.error(`Entity ${entityId} 조회 실패:`, error);
            }
            return null;
          });
          
          const entityDetails = await Promise.all(entityDetailsPromises);
          const validEntities = entityDetails.filter(entity => entity !== null);
          setCurrentCanaryDeployments(validEntities);
        } else {
          setCurrentCanaryDeployments([]);
        }
      } catch (error) {
        console.error('현재 카나리 배포 목록 조회 중 오류:', error);
        setCurrentCanaryDeployments([]);
      }
    };

    fetchCurrentCanaryDeployments();
  }, [selectedClusterUuid]);

  const handleLogout = () => {
    logout();
  };

  const handleDeploy = async () => {
    if (selectedClusterUuid && selectedNamespace && selectedService && originalVersion && canaryVersion && canaryRatio[0] !== undefined) {
      try {
        const crdApiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL_CRD || 'http://localhost:8084';
        
        // ServiceEntity 생성 API 호출
        const serviceEntityData = {
          name: selectedService,
          namespace: selectedNamespace,
          serviceType: stickySession ? 'StickyCanaryType' : 'CanaryType',
          ratio: canaryRatio[0],
          commitHash: [originalVersion, canaryVersion]
        };

        const response = await fetch(`${crdApiUrl}/crd/api/v1/${selectedClusterUuid}/serviceEntity`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(serviceEntityData),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        // 백엔드 응답 형식에 맞게 수정: result 객체가 있고 code가 성공 코드인지 확인
        if (result.result && result.code) {
          alert(`카나리 배포가 성공적으로 생성되었습니다!\n생성된 Service Entity ID: ${result.result.ID}\n메시지: ${result.message}`);
          
          // 성공 후 폼 초기화
          setOriginalVersion(null);
          setCanaryVersion(null);
          setCanaryRatio([10]);
          setStickySession(false);
          
          // 카나리 배포 목록 새로고침
          const crdApiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL_CRD || 'http://localhost:8084';
          fetch(`${crdApiUrl}/crd/api/v1/${selectedClusterUuid}/list`)
            .then(res => res.json())
            .then(listResult => {
              if (listResult.result && listResult.result.serviceEntityID && listResult.result.serviceEntityID.length > 0) {
                const entityDetailsPromises = listResult.result.serviceEntityID.map(async (entityId: number) => {
                  try {
                    const entityResponse = await fetch(`${crdApiUrl}/crd/api/v1/service/${entityId}`);
                    if (entityResponse.ok) {
                      const entityResult = await entityResponse.json();
                      if (entityResult.result) {
                        return { id: entityId, ...entityResult.result };
                      }
                    }
                  } catch (error) {
                    console.error(`Entity ${entityId} 조회 실패:`, error);
                  }
                  return null;
                });
                
                Promise.all(entityDetailsPromises).then(details => {
                  const validEntities = details.filter(entity => entity !== null);
                  setCurrentCanaryDeployments(validEntities);
                });
              }
            })
            .catch(error => console.error('카나리 배포 목록 새로고침 실패:', error));
        } else {
          throw new Error(result.message || '카나리 배포 생성에 실패했습니다.');
        }
              } catch (error) {
          console.error('카나리 배포 생성 중 오류 발생:', error);
          alert(`카나리 배포 생성에 실패했습니다: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      alert('모든 필드를 선택해주세요.');
    }
  };

  const handleRollback = async () => {
    if (selectedClusterUuid && selectedNamespace && selectedService) {
      try {
        const crdApiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL_CRD || 'http://localhost:8084';
        
        // 먼저 해당 클러스터의 Service Entity 목록을 조회
        const listResponse = await fetch(`${crdApiUrl}/crd/api/v1/${selectedClusterUuid}/list`);
        if (!listResponse.ok) {
          throw new Error('Service Entity 목록 조회에 실패했습니다.');
        }
        
        const listResult = await listResponse.json();
        
        if (listResult.result && listResult.result.serviceEntityID && listResult.result.serviceEntityID.length > 0) {
          // 각 Service Entity에 대해 삭제 처리
          const deletePromises = listResult.result.serviceEntityID.map(async (entityId: number) => {
            // 먼저 해당 Service Entity의 정보를 확인
            const entityResponse = await fetch(`${crdApiUrl}/crd/api/v1/service/${entityId}`);
            if (entityResponse.ok) {
              const entityResult = await entityResponse.json();
              
              // 선택된 서비스와 네임스페이스가 일치하는 경우에만 삭제
              if (entityResult.result && 
                  entityResult.result.name === selectedService && 
                  entityResult.result.namespace === selectedNamespace) {
                
                const deleteResponse = await fetch(`${crdApiUrl}/crd/api/v1/service/${entityId}`, {
                  method: 'DELETE',
                });
                
                if (!deleteResponse.ok) {
                  throw new Error(`Service Entity ${entityId} 삭제에 실패했습니다.`);
                }
                return entityId;
              }
            }
            return null;
          });
          
          const deletedIds = await Promise.all(deletePromises);
          const actuallyDeleted = deletedIds.filter(id => id !== null);
          
          if (actuallyDeleted.length > 0) {
            alert(`롤백이 완료되었습니다!\n삭제된 Service Entity IDs: ${actuallyDeleted.join(', ')}`);
            
            // 롤백 후 폼 초기화
            setOriginalVersion(null);
            setCanaryVersion(null);
            setCanaryRatio([10]);
            setStickySession(false);
            
            // 카나리 배포 목록 새로고침
            setCurrentCanaryDeployments(prev => 
              prev.filter(item => !actuallyDeleted.includes(item.id))
            );
          } else {
            alert('해당 서비스에 대한 카나리 배포를 찾을 수 없습니다.');
          }
        } else {
          alert('롤백할 카나리 배포가 없습니다.');
        }
              } catch (error) {
          console.error('롤백 중 오류 발생:', error);
          alert(`롤백에 실패했습니다: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      alert('클러스터, 네임스페이스, 서비스를 선택해주세요.');
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
                        <SelectItem key={ns} value={ns}>{ns}</SelectItem>
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
                        <SelectItem key={svc} value={svc}>{svc}</SelectItem>
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
                        .filter(version => version !== canaryVersion)
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
                        .filter(version => version !== originalVersion)
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

              {/* 현재 카나리 배포 목록 섹션 */}
              {selectedClusterUuid && currentCanaryDeployments.length > 0 && (
                <div className="mt-6 space-y-4">
                  <hr className="my-4" />
                  <h3 className="text-lg font-semibold">현재 카나리 배포 목록</h3>
                  
                  {currentCanaryDeployments.map((canaryDeployment, index) => (
                    <Card key={index} className="p-4 bg-blue-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium mb-2">
                            Service: {canaryDeployment.name} (ID: {canaryDeployment.id})
                          </h4>
                          <p className="text-sm text-gray-600 mb-1">
                            네임스페이스: {canaryDeployment.namespace}
                          </p>
                          <p className="text-sm text-gray-600 mb-1">
                            타입: {canaryDeployment.serviceType}
                          </p>
                          <p className="text-sm text-gray-600 mb-1">
                            트래픽 비율: {canaryDeployment.ratio}%
                          </p>
                          <p className="text-sm text-gray-600 mb-2">
                            버전: {canaryDeployment.commitHash ? canaryDeployment.commitHash.join(', ') : 'N/A'}
                          </p>
                        </div>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={async () => {
                            if (window.confirm(`${canaryDeployment.name} 카나리 배포를 삭제하시겠습니까?`)) {
                              try {
                                const crdApiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL_CRD || 'http://localhost:8084';
                                const deleteResponse = await fetch(`${crdApiUrl}/crd/api/v1/service/${canaryDeployment.id}`, {
                                  method: 'DELETE',
                                });
                                
                                if (deleteResponse.ok) {
                                  alert('카나리 배포가 성공적으로 삭제되었습니다.');
                                  // 목록 새로고침
                                  setCurrentCanaryDeployments(prev => 
                                    prev.filter(item => item.id !== canaryDeployment.id)
                                  );
                                } else {
                                  throw new Error('삭제 요청 실패');
                                }
                              } catch (error) {
                                console.error('카나리 배포 삭제 중 오류:', error);
                                alert(`카나리 배포 삭제에 실패했습니다: ${error instanceof Error ? error.message : String(error)}`);
                              }
                            }
                          }}
                        >
                          삭제
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* 리소스 정보 표시 섹션 */}
              {deployments.length > 0 && (
                <div className="mt-6 space-y-4">
                  <hr className="my-4" />
                  <h3 className="text-lg font-semibold">리소스 정보</h3>
                  
                  {deployments.map((deployment, index) => (
                    <Card key={index} className="p-4">
                      <h4 className="font-medium mb-2">Deployment: {deployment.name}</h4>
                      <p className="text-sm text-gray-600 mb-2">Replicas: {deployment.replicas}</p>
                      
                      {deployment.containers && deployment.containers.length > 0 && (
                        <div className="mb-3">
                          <h5 className="font-medium text-sm mb-1">컨테이너 정보</h5>
                          <ul className="list-disc pl-5 space-y-1 text-sm">
                            {deployment.containers.map((container, containerIndex) => (
                              <li key={containerIndex}>
                                <span className="font-medium">{container.name}</span>: {container.image}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {deployment.podLabels && Object.keys(deployment.podLabels).length > 0 && (
                        <div>
                          <h5 className="font-medium text-sm mb-1">Pod 라벨</h5>
                          <ul className="list-disc pl-5 space-y-1 text-sm">
                            {Object.entries(deployment.podLabels).map(([key, value]) => (
                              <li key={key}>
                                <span className="font-medium">{key}</span>: {value}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}

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