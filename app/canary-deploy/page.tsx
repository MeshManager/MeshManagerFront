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

  // CRD API URL 정의
  const crdApiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL_CRD || 'http://localhost:8084';

  // 현재 카나리 배포 목록을 조회하는 함수 (useCallback으로 메모이제이션)
  const fetchCurrentCanaryDeployments = React.useCallback(async () => {
    if (!selectedClusterUuid) {
      setCurrentCanaryDeployments([]);
      return;
    }
    
    try {
      console.log('🔍 카나리 배포 목록 조회 시작:', selectedClusterUuid);
      const response = await fetch(`${crdApiUrl}/api/v1/crd/${selectedClusterUuid}/list`);
      
      console.log('📡 응답 상태:', response.status, response.statusText);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn('⚠️ CRD API 엔드포인트를 찾을 수 없습니다. 카나리 배포 목록이 비어있을 수 있습니다.');
          setCurrentCanaryDeployments([]);
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('📋 전체 응답:', result);
      
      // API 응답 구조 수정: result.result.serviceEntityID 형태로 변경
      const serviceEntityIDs = result?.result?.serviceEntityID || result?.data?.serviceEntityID || [];
      
      if (Array.isArray(serviceEntityIDs) && serviceEntityIDs.length > 0) {
        console.log('📊 ServiceEntity IDs:', serviceEntityIDs);
        
        const entityDetailsPromises = serviceEntityIDs.map(async (entityId: number) => {
          try {
            console.log(`🔍 Entity ${entityId} 상세 정보 조회...`);
            const entityResponse = await fetch(`${crdApiUrl}/api/v1/crd/service/${entityId}`);
            if (entityResponse.ok) {
              const entityResult = await entityResponse.json();
              console.log(`📄 Entity ${entityId} 응답:`, entityResult);
              // API 응답 구조에 맞게 수정
              const entityData = entityResult?.result || entityResult?.data;
              if (entityData) {
                return { id: entityId, ...entityData };
              }
            } else {
              console.warn(`⚠️ Entity ${entityId} 조회 실패: ${entityResponse.status}`);
            }
          } catch (error) {
            console.error(`❌ Entity ${entityId} 조회 실패:`, error);
          }
          return null;
        });
        
        const details = await Promise.all(entityDetailsPromises);
        const validEntities = details.filter(entity => entity !== null);
        console.log('✅ 유효한 ServiceEntity들:', validEntities);
        
        // CanaryType과 StandardType 구분하여 처리
        const canaryEntities = validEntities.filter(entity => 
          entity.serviceType === 'CanaryType' || entity.serviceType === 'StickyCanaryType'
        );
        const standardEntities = validEntities.filter(entity => entity.serviceType === 'StandardType');
        
        if (canaryEntities.length > 0) {
          const existingCanaryEntityIds = canaryEntities.map(entity => entity.id);
          console.log(`🗑️ 삭제할 Canary/StickyCanary ServiceEntity IDs:`, existingCanaryEntityIds);
        }
        
        if (standardEntities.length > 0) {
          console.log(`🌑 StandardType ServiceEntity 감지: ${standardEntities.length}개 (독립적으로 유지)`);
        }
        
        setCurrentCanaryDeployments(canaryEntities as CanaryDeployment[]);
      } else {
        console.log('📭 카나리 배포 목록이 비어있습니다.');
        setCurrentCanaryDeployments([]);
      }
    } catch (error) {
      console.error("❌ 카나리 배포 목록 조회 중 오류 발생:", error);
      setCurrentCanaryDeployments([]);
      // 404 에러가 아닌 경우에만 사용자에게 알림
      if (error instanceof Error && !error.message.includes('404')) {
        console.error('카나리 배포 목록 조회 실패 상세:', error.message);
      }
    }
  }, [selectedClusterUuid, crdApiUrl]);

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      // 현재 페이지를 로그인 후 리다이렉션 대상으로 저장
      localStorage.setItem('redirectAfterLogin', '/canary-deploy');
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
        setAvailableServices(data.serviceNames.filter(serviceName => serviceName !== 'kubernetes'));
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
        
        // 컨테이너 이미지 태그에서 version 추출 (다크릴리즈와 동일한 방식)
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

  // 현재 카나리 배포 목록을 조회하는 useEffect - 클러스터 변경 시에만 호출
  useEffect(() => {
    // 초기 로딩이 완료되고 클러스터가 선택되었을 때만 호출
    if (selectedClusterUuid) {
      fetchCurrentCanaryDeployments();
    }
  }, [selectedClusterUuid]); // eslint-disable-line react-hooks/exhaustive-deps
  // 의도적으로 fetchCurrentCanaryDeployments를 의존성에서 제외하여 무한 호출 방지

  // 현재 선택된 서비스의 카나리 배포 상태 확인
  const currentServiceCanaryDeployment = React.useMemo(() => {
    if (!selectedService || !selectedNamespace || !currentCanaryDeployments) {
      return null;
    }
    return currentCanaryDeployments.find(
      deployment => deployment.name === selectedService && deployment.namespace === selectedNamespace
    );
  }, [selectedService, selectedNamespace, currentCanaryDeployments]);

  // 현재 선택된 서비스의 카나리 배포 상태가 변경될 때 비율 슬라이더 업데이트
  useEffect(() => {
    if (currentServiceCanaryDeployment && currentServiceCanaryDeployment.ratio !== undefined) {
      setCanaryRatio([currentServiceCanaryDeployment.ratio]);
    }
  }, [currentServiceCanaryDeployment]);

  const handleLogout = () => {
    logout();
  };

  // 로딩 중일 때는 아무것도 렌더링하지 않음
  if (isLoading) {
    return null;
  }

  // 로그인되지 않은 경우 아무것도 렌더링하지 않고 리다이렉션을 기다림
  if (!isLoggedIn) {
    return null;
  }

  const handleDeploy = async () => {
    if (!selectedClusterUuid || !selectedNamespace || !selectedService || !originalVersion || !canaryVersion || canaryRatio[0] === undefined) {
      alert("모든 필드를 입력해주세요.");
      return;
    }

    // CommitHash 개수 검증 (2개 미만이면 Canary 배포 불가)
    const allVersions = new Set([originalVersion, canaryVersion]);
    if (allVersions.size < 2) {
      alert("Canary 배포를 위해서는 최소 2개의 서로 다른 버전이 필요합니다.");
      return;
    }

    try {
      // 1단계: GET - 기존 ServiceEntity 확인
      console.log('🔍 1단계: 기존 ServiceEntity 확인...');
      let existingCanaryEntityIds: number[] = [];
      let hasStandardDeployment = false;
      
      try {
        const existingListResponse = await fetch(`${crdApiUrl}/api/v1/crd/${selectedClusterUuid}/list`);
        if (existingListResponse.ok) {
          const existingListResult = await existingListResponse.json();
          console.log('📋 기존 ServiceEntity 목록:', existingListResult);
          
          const serviceEntityIDs = existingListResult?.result?.serviceEntityID || existingListResult?.data?.serviceEntityID || [];
          
          if (Array.isArray(serviceEntityIDs) && serviceEntityIDs.length > 0) {
            // 같은 서비스 이름과 네임스페이스를 가진 ServiceEntity 찾기
            const entityCheckPromises = serviceEntityIDs.map(async (entityId: number) => {
              try {
                const entityResponse = await fetch(`${crdApiUrl}/api/v1/crd/service/${entityId}`);
                if (entityResponse.ok) {
                  const entityResult = await entityResponse.json();
                  const entityData = entityResult?.result || entityResult?.data;
                  
                  if (entityData && 
                      entityData.name === selectedService && 
                      entityData.namespace === selectedNamespace) {
                    
                    if (entityData.serviceType === 'CanaryType' || entityData.serviceType === 'StickyCanaryType') {
                      console.log(`🚀 중복 ${entityData.serviceType} ServiceEntity 발견: ID ${entityId}`, entityData);
                      return { id: entityId, type: entityData.serviceType };
                    } else if (entityData.serviceType === 'StandardType') {
                      console.log(`🌑 기존 StandardType ServiceEntity 발견: ID ${entityId} (Dark Release용, 건드리지 않음)`, entityData);
                      return { id: entityId, type: 'StandardType' };
                    }
                  }
                }
              } catch (error) {
                console.error(`❌ Entity ${entityId} 조회 실패:`, error);
              }
              return null;
            });
            
            const foundEntities = (await Promise.all(entityCheckPromises)).filter(entity => entity !== null);
            
            // CanaryType과 StandardType 구분하여 처리
            const canaryEntities = foundEntities.filter(entity => 
              entity.type === 'CanaryType' || entity.type === 'StickyCanaryType'
            );
            const standardEntities = foundEntities.filter(entity => entity.type === 'StandardType');
            
            if (canaryEntities.length > 0) {
              existingCanaryEntityIds = canaryEntities.map(entity => entity.id);
              console.log(`🗑️ 삭제할 Canary/StickyCanary ServiceEntity IDs:`, existingCanaryEntityIds);
            }
            
            if (standardEntities.length > 0) {
              hasStandardDeployment = true;
              console.log(`🌑 StandardType ServiceEntity 감지: ${standardEntities.length}개 (독립적으로 유지)`);
            }
          }
        } else {
          console.warn(`⚠️ CRD 목록 조회 실패 (${existingListResponse.status})`);
        }
      } catch (error) {
        console.error('❌ 기존 ServiceEntity 확인 중 오류:', error);
      }

      // 2단계: DELETE - 기존 CanaryType ServiceEntity들만 삭제 (StandardType은 유지)
      if (existingCanaryEntityIds.length > 0) {
        console.log(`🗑️ 2단계: ${existingCanaryEntityIds.length}개의 Canary/StickyCanary ServiceEntity 삭제 (StandardType은 유지)...`);
        
        for (const entityId of existingCanaryEntityIds) {
          try {
            console.log(`🗑️ Canary/StickyCanary ServiceEntity ${entityId} 삭제 시도...`);
            const deleteResponse = await fetch(`${crdApiUrl}/api/v1/crd/service/${entityId}`, {
              method: 'DELETE',
            });
            
            if (deleteResponse.ok) {
              console.log(`✅ Canary/StickyCanary ServiceEntity ${entityId} 삭제 성공`);
            } else {
              const errorText = await deleteResponse.text();
              console.error(`❌ Canary/StickyCanary ServiceEntity ${entityId} 삭제 실패:`, errorText);
              console.warn(`⚠️ ServiceEntity 삭제 실패했지만 배포를 계속 진행합니다.`);
            }
          } catch (error) {
            console.error(`❌ Canary/StickyCanary ServiceEntity ${entityId} 삭제 중 오류:`, error);
            console.warn(`⚠️ ServiceEntity 삭제 중 오류가 발생했지만 배포를 계속 진행합니다.`);
          }
        }
        
        // 삭제 후 잠시 대기 (DB 정리 시간 확보)
        console.log('⏳ 삭제 완료 후 대기 중...');
        await new Promise(resolve => setTimeout(resolve, 1500));
      } else {
        console.log('✅ 중복되는 Canary/StickyCanary ServiceEntity 없음');
        if (hasStandardDeployment) {
          console.log('🌑 StandardType과 독립적으로 Canary/StickyCanary 생성');
        }
      }

      // 3단계: POST - 새로운 ServiceEntity 생성
      console.log('🆕 3단계: 새로운 ServiceEntity 생성...');
      const serviceEntityType: string = stickySession ? 'StickyCanaryType' : 'CanaryType';
      console.log(`📋 ServiceType 설정: ${serviceEntityType} (Sticky Session: ${stickySession})`);
      
      const serviceEntityResponseList = await fetch(`${crdApiUrl}/api/v1/crd/${selectedClusterUuid}/serviceEntity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: selectedService,
          namespace: selectedNamespace,
          serviceType: serviceEntityType,
          ratio: canaryRatio[0], // ratio 필드 추가
          commitHash: [originalVersion, canaryVersion]
        })
      });

      if (!serviceEntityResponseList.ok) {
        const errorText = await serviceEntityResponseList.text();
        console.error('ServiceEntity 생성 에러 응답:', errorText);
        throw new Error(`ServiceEntity 생성 실패! status: ${serviceEntityResponseList.status}, 응답: ${errorText}`);
      }

      const serviceEntityResultList = await serviceEntityResponseList.json();
      console.log('🎯 ServiceEntity 응답 전체 구조:', JSON.stringify(serviceEntityResultList, null, 2));
      
      // 안전한 ID 추출 로직
      let serviceEntityId = null;
      
      // 다양한 응답 구조에 대응
      if (serviceEntityResultList.data) {
        serviceEntityId = serviceEntityResultList.data.ID || serviceEntityResultList.data.id;
        console.log('📍 data에서 ID 추출:', serviceEntityId);
      } else if (serviceEntityResultList.result) {
        serviceEntityId = serviceEntityResultList.result.ID || serviceEntityResultList.result.id;
        console.log('📍 result에서 ID 추출:', serviceEntityId);
      } else if (serviceEntityResultList.ID || serviceEntityResultList.id) {
        serviceEntityId = serviceEntityResultList.ID || serviceEntityResultList.id;
        console.log('📍 최상위에서 ID 추출:', serviceEntityId);
      }

      console.log('🆔 최종 추출된 ServiceEntity ID:', serviceEntityId);

      if (!serviceEntityId) {
        console.error('❌ ID 추출 실패. 응답 구조 분석:');
        console.error('- data:', serviceEntityResultList.data);
        console.error('- result:', serviceEntityResultList.result);
        console.error('- 전체 키들:', Object.keys(serviceEntityResultList));
        throw new Error('ServiceEntity ID를 받아오지 못했습니다. 백엔드 응답 구조를 확인해주세요.');
      }

      alert(`Canary 배포가 성공적으로 생성되었습니다!\n` +
            `ServiceEntity ID: ${serviceEntityId}\n` +
            `서비스: ${selectedService}\n` +
            `네임스페이스: ${selectedNamespace}\n` +
            `트래픽 비율: ${canaryRatio[0]}%\n` +
            `버전: ${originalVersion} -> ${canaryVersion}\n` +
            `${existingCanaryEntityIds.length > 0 ? `(기존 ${existingCanaryEntityIds.length}개 중복 배포 삭제 후 새로 생성됨)` : '(새로 생성됨)'}\n` +
            `${hasStandardDeployment ? '🌑 Dark Release와 독립적으로 공존' : ''}`);
      
      // 목록 새로고침 (지연 추가)
      setTimeout(() => {
        fetchCurrentCanaryDeployments();
      }, 1500);
    } catch (error) {
      console.error("카나리 배포 요청 실패:", error);
      alert(`카나리 배포 요청 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleRollback = async () => {
    if (!selectedClusterUuid || !selectedService || !selectedNamespace || currentCanaryDeployments.length === 0) {
      alert("롤백할 카나리 배포가 없습니다.");
      return;
    }

    const deploymentToRollback = currentCanaryDeployments.find(
      (dep) => dep.name === selectedService && dep.namespace === selectedNamespace
    );

    if (!deploymentToRollback) {
      alert("선택된 서비스에 대한 카나리 배포를 찾을 수 없습니다.");
      return;
    }

    try {
      // 1단계: ServiceEntity 정보 조회
      const listResponse = await fetch(`${crdApiUrl}/api/v1/crd/${selectedClusterUuid}/list`);
      if (!listResponse.ok) throw new Error('ServiceEntity 목록 조회 실패');
      const listResult = await listResponse.json();

      // API 응답 구조 수정
      const serviceEntityIDs = listResult?.result?.serviceEntityID || listResult?.data?.serviceEntityID || [];
      
      if (!Array.isArray(serviceEntityIDs) || serviceEntityIDs.length === 0) {
        alert("롤백할 ServiceEntity를 찾을 수 없습니다.");
        return;
      }

      // 2단계: 해당 서비스의 ServiceEntity ID 찾기
      let targetEntityId = null;
      for (const entityId of serviceEntityIDs) {
        try {
          const entityResponse = await fetch(`${crdApiUrl}/api/v1/crd/service/${entityId}`);
          if (entityResponse.ok) {
            const entityResult = await entityResponse.json();
            const entityData = entityResult?.result || entityResult?.data;
            if (entityData && entityData.name === selectedService && entityData.namespace === selectedNamespace) {
              targetEntityId = entityId;
              break;
            }
          }
        } catch (error) {
          console.error(`Entity ${entityId} 조회 실패:`, error);
        }
      }

      if (!targetEntityId) {
        alert("롤백할 ServiceEntity를 찾을 수 없습니다.");
        return;
      }

      // 3단계: ServiceEntity 삭제 (롤백)
      const deleteResponse = await fetch(`${crdApiUrl}/api/v1/crd/service/${targetEntityId}`, {
        method: 'DELETE',
      });

      if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text();
        throw new Error(`카나리 배포 롤백 실패! status: ${deleteResponse.status}, 응답: ${errorText}`);
      }

      alert("카나리 배포가 성공적으로 롤백되었습니다.");
      
      // 목록 새로고침 (지연 추가)
      setTimeout(() => {
        fetchCurrentCanaryDeployments();
      }, 1000);
    } catch (error) {
      console.error("카나리 배포 롤백 실패:", error);
      alert(`카나리 배포 롤백 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleAgentDelete = async (canaryDeployment: CanaryDeployment) => {
    const confirmation = window.confirm(
      `'${canaryDeployment.name}' 카나리 배포를 삭제하시겠습니까?\n\n` +
      `서비스: ${canaryDeployment.name}\n` +
      `네임스페이스: ${canaryDeployment.namespace}\n` +
      `현재 비율: ${canaryDeployment.ratio}%`
    );
    
    if (!confirmation) {
      return;
    }

    try {
      console.log(`🗑️ ServiceEntity 삭제 시작: ID ${canaryDeployment.id}`);
      console.log(`📋 삭제 대상 정보:`, canaryDeployment);

      const deleteResponse = await fetch(`${crdApiUrl}/api/v1/crd/service/${canaryDeployment.id}`, {
        method: 'DELETE',
      });

      console.log(`📡 삭제 응답 상태: ${deleteResponse.status} ${deleteResponse.statusText}`);

      if (!deleteResponse.ok) {
        let errorMessage = `삭제 실패! status: ${deleteResponse.status}`;
        
        try {
          const errorText = await deleteResponse.text();
          console.log(`📄 에러 응답 내용:`, errorText);
          
          if (deleteResponse.status === 500) {
            errorMessage = `서버 내부 오류가 발생했습니다.\n\n` +
                          `이는 백엔드에서 삭제 처리 중 문제가 발생한 것입니다.\n` +
                          `관리자에게 문의하거나 잠시 후 다시 시도해주세요.\n\n` +
                          `상세 오류: ${errorText}`;
          } else if (deleteResponse.status === 404) {
            errorMessage = `삭제하려는 ServiceEntity를 찾을 수 없습니다.\n` +
                          `이미 삭제되었거나 존재하지 않는 배포일 수 있습니다.`;
          } else {
            errorMessage = `삭제 실패: ${errorText}`;
          }
        } catch (parseError) {
          console.error(`❌ 에러 응답 파싱 실패:`, parseError);
          errorMessage = `삭제 실패! HTTP ${deleteResponse.status}`;
        }

        throw new Error(errorMessage);
      }

      console.log(`✅ ServiceEntity ${canaryDeployment.id} 삭제 성공`);
      alert(`카나리 배포 '${canaryDeployment.name}'이(가) 성공적으로 삭제되었습니다.`);
      
      // 목록 새로고침 (지연 추가)
      setTimeout(() => {
        fetchCurrentCanaryDeployments();
      }, 1000);
      
    } catch (error) {
      console.error(`❌ 카나리 배포 삭제 중 오류 발생:`, error);
      alert(`카나리 배포 삭제 실패:\n\n${error instanceof Error ? error.message : String(error)}`);
    }
  };

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

              {/* 현재 선택된 서비스의 카나리 배포 상태 */}
              {selectedService && selectedNamespace && (
                <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                  <h3 className="text-lg font-semibold mb-3">현재 서비스 상태</h3>
                  {currentServiceCanaryDeployment ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          🚀 Canary 배포 중
                        </span>
                        <span className="text-sm text-gray-600">
                          비율: {currentServiceCanaryDeployment.ratio}%
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-600">
                        <p><strong>서비스:</strong> {currentServiceCanaryDeployment.name}</p>
                        <p><strong>네임스페이스:</strong> {currentServiceCanaryDeployment.namespace}</p>
                        <p><strong>버전:</strong> {currentServiceCanaryDeployment.commitHash?.join(' → ') || 'N/A'}</p>
                        <p><strong>타입:</strong> {currentServiceCanaryDeployment.serviceType}</p>
                      </div>

                      {/* 비율 수정 슬라이더 */}
                      <div className="space-y-2">
                        <UiLabel>비율 수정: {canaryRatio[0]}%</UiLabel>
                        <div className="flex items-center gap-4">
                          <Slider
                            min={0}
                            max={100}
                            step={5}
                            value={canaryRatio}
                            onValueChange={setCanaryRatio}
                            className="flex-1"
                          />
                          <Button 
                            size="sm" 
                            onClick={() => {
                              alert(
                                `비율 수정을 위해서는 새로 배포해주세요.\n\n` +
                                `1. 아래 "삭제" 버튼을 눌러 기존 배포를 삭제하세요.\n` +
                                `2. 원하는 비율(${canaryRatio[0]}%)로 "배포" 버튼을 눌러 새로 배포하세요.\n\n` +
                                `※ 백엔드에 PUT API가 구현되면 즉시 수정이 가능합니다.`
                              );
                            }}
                            disabled={canaryRatio[0] === currentServiceCanaryDeployment.ratio}
                          >
                            비율 적용 (안내)
                          </Button>
                        </div>
                      </div>

                      {/* 배포 관리 버튼들 */}
                      <div className="flex gap-2 pt-2">
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => handleAgentDelete(currentServiceCanaryDeployment)}
                        >
                          🗑️ 삭제
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setCanaryRatio([currentServiceCanaryDeployment.ratio]);
                          }}
                        >
                          현재 비율로 복원
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
                        ⚪ Canary 배포 없음
                      </span>
                      <p className="text-sm text-gray-500 mt-2">
                        선택된 서비스에 활성화된 Canary 배포가 없습니다.
                      </p>
                    </div>
                  )}
                </div>
              )}

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
                          onClick={() => handleAgentDelete(canaryDeployment)}
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
                <Button 
                  onClick={handleDeploy} 
                  disabled={!selectedClusterUuid || !selectedNamespace || !selectedService || !originalVersion || !canaryVersion || canaryRatio[0] === undefined}
                >
                  {currentServiceCanaryDeployment ? '업데이트' : '배포'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </SidebarProvider>
    </div>
  );
} 