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

interface ContainerInfo {
  image: string;
  name?: string;
}

interface DeploymentInfo {
  name: string;
  containers: ContainerInfo[];
}

interface DarkReleaseDeployment {
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
  const [currentDarkReleases, setCurrentDarkReleases] = useState<DarkReleaseDeployment[]>([]);

  // CRD API URL 정의
  const crdApiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL_CRD || 'http://localhost:8084';

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      // 현재 페이지를 로그인 후 리다이렉션 대상으로 저장
      localStorage.setItem('redirectAfterLogin', '/dark-release');
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
        setAvailableServices(data.serviceNames.filter((svc: string) => svc !== 'kubernetes').map((svc: string) => ({ name: svc, versions: [] })));
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
          data.data.forEach((deployment: DeploymentInfo) => {
            if (deployment.containers && Array.isArray(deployment.containers)) {
              deployment.containers.forEach((container: ContainerInfo) => {
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

  // 현재 다크 릴리즈 배포 목록을 조회하는 useEffect - 클러스터 변경 시에만 호출
  useEffect(() => {
    // 초기 로딩이 완료되고 클러스터가 선택되었을 때만 호출
    if (selectedClusterUuid) {
      fetchCurrentDarkReleases();
    }
  }, [selectedClusterUuid]); // eslint-disable-line react-hooks/exhaustive-deps
  // 의도적으로 fetchCurrentDarkReleases를 의존성에서 제외하여 무한 호출 방지

  // 현재 다크 릴리즈 배포 목록을 조회하는 함수
  const fetchCurrentDarkReleases = React.useCallback(async () => {
    if (!selectedClusterUuid) {
      setCurrentDarkReleases([]);
      return;
    }
    
    try {
      console.log('🔍 다크 릴리즈 배포 목록 조회 시작:', selectedClusterUuid);
      const response = await fetch(`${crdApiUrl}/api/v1/crd/${selectedClusterUuid}/list`);
      
      console.log('📡 응답 상태:', response.status, response.statusText);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn('⚠️ CRD API 엔드포인트를 찾을 수 없습니다. 다크 릴리즈 배포 목록이 비어있을 수 있습니다.');
          setCurrentDarkReleases([]);
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('📋 전체 응답:', result);
      
      // API 응답 구조: result.result.serviceEntityID 형태
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
        
        // StandardType 중에서 DarknessRelease가 연결된 것만 다크 릴리즈 배포 목록에 표시
        const darkReleaseEntities = validEntities.filter(entity => 
          entity.serviceType === 'StandardType' && 
          entity.darknessReleaseID != null && 
          entity.darknessReleaseID !== undefined
        );
        console.log('🌑 DarknessRelease가 연결된 StandardType만 필터링:', darkReleaseEntities);
        
        setCurrentDarkReleases(darkReleaseEntities as DarkReleaseDeployment[]);
      } else {
        console.log('📭 다크 릴리즈 배포 목록이 비어있습니다.');
        setCurrentDarkReleases([]);
      }
    } catch (error) {
      console.error("❌ 다크 릴리즈 배포 목록 조회 중 오류 발생:", error);
      setCurrentDarkReleases([]);
      // 404 에러가 아닌 경우에만 사용자에게 알림
      if (error instanceof Error && !error.message.includes('404')) {
        console.error('다크 릴리즈 배포 목록 조회 실패 상세:', error.message);
      }
    }
  }, [selectedClusterUuid, crdApiUrl]);

  const handleLogout = () => {
    logout();
  };

  const handleDarkReleaseDelete = async (darkRelease: DarkReleaseDeployment) => {
    const confirmation = window.confirm(
      `'${darkRelease.name}' 다크 릴리즈를 삭제하시겠습니까?\n\n` +
      `서비스: ${darkRelease.name}\n` +
      `네임스페이스: ${darkRelease.namespace}\n` +
      `버전: ${darkRelease.commitHash?.join(', ') || 'N/A'}\n\n` +
      `※ 다크 릴리즈만 삭제되고 다른른 배포는 유지됩니다.`
    );
    
    if (!confirmation) {
      return;
    }

    try {
      console.log(`🗑️ DarknessRelease 삭제 시작: ServiceEntity ID ${darkRelease.id}`);
      console.log(`📋 삭제 대상 정보:`, darkRelease);

      // DarknessRelease ID가 있는 경우에만 삭제 진행
      if (!darkRelease.darknessReleaseID) {
        throw new Error('DarknessRelease ID를 찾을 수 없습니다. 이미 삭제되었거나 다크 릴리즈 상태가 아닐 수 있습니다.');
      }

      // ServiceEntity를 삭제하는 대신 DarknessRelease만 삭제
      const deleteResponse = await fetch(`${crdApiUrl}/api/v1/crd/darkness/${darkRelease.darknessReleaseID}`, {
        method: 'DELETE',
      });

      console.log(`📡 DarknessRelease 삭제 응답 상태: ${deleteResponse.status} ${deleteResponse.statusText}`);

      if (!deleteResponse.ok) {
        let errorMessage = `다크 릴리즈 삭제 실패! status: ${deleteResponse.status}`;
        
        try {
          const errorText = await deleteResponse.text();
          console.log(`📄 에러 응답 내용:`, errorText);
          
          if (deleteResponse.status === 500) {
            errorMessage = `서버 내부 오류가 발생했습니다.\n\n` +
                          `이는 백엔드에서 다크 릴리즈 삭제 처리 중 문제가 발생한 것입니다.\n` +
                          `관리자에게 문의하거나 잠시 후 다시 시도해주세요.\n\n` +
                          `상세 오류: ${errorText}`;
          } else if (deleteResponse.status === 404) {
            errorMessage = `삭제하려는 DarknessRelease를 찾을 수 없습니다.\n` +
                          `이미 삭제되었거나 존재하지 않는 다크 릴리즈일 수 있습니다.`;
          } else {
            errorMessage = `다크 릴리즈 삭제 실패: ${errorText}`;
          }
        } catch (parseError) {
          console.error(`❌ 에러 응답 파싱 실패:`, parseError);
          errorMessage = `다크 릴리즈 삭제 실패! HTTP ${deleteResponse.status}`;
        }

        throw new Error(errorMessage);
      }

      console.log(`✅ DarknessRelease ${darkRelease.darknessReleaseID} 삭제 성공`);
      alert(`다크 릴리즈 '${darkRelease.name}'이(가) 성공적으로 삭제되었습니다.\n다른 배포는 그대로 유지됩니다.`);
      
      // 목록 새로고침 (지연 추가)
      setTimeout(() => {
        fetchCurrentDarkReleases();
      }, 1000);
      
    } catch (error) {
      console.error(`❌ 다크 릴리즈 삭제 중 오류 발생:`, error);
      alert(`다크 릴리즈 삭제 실패:\n\n${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleStartDarkRelease = async () => {
    if (!selectedClusterUuid || !selectedNamespace || !selectedService || !selectedServiceVersion || !ipAddress) {
      alert("모든 필드를 입력해주세요.");
      return;
    }

    // CommitHash 개수 검증 (1개만 있으면 Dark Release 배포 불가)
    if (availableVersions.length < 2) {
      alert("Dark Release 배포를 위해서는 최소 2개의 서로 다른 버전이 필요합니다.");
      return;
    }

    // 기존 Standard 또는 Canary 배포 존재 여부 검증
    console.log('🔍 기존 배포 상태 검증 시작...');
    let hasStandardDeployment = false;
    let hasCanaryDeployment = false;

    try {
      const existingListResponse = await fetch(`${crdApiUrl}/api/v1/crd/${selectedClusterUuid}/list`);
      if (existingListResponse.ok) {
        const existingListResult = await existingListResponse.json();
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
                  
                  if (entityData.serviceType === 'StandardType' && entityData.ratio > 0) {
                    console.log(`✅ 활성화된 StandardType 배포 발견: ID ${entityId}`);
                    return { type: 'StandardType', active: true };
                  } else if ((entityData.serviceType === 'CanaryType' || entityData.serviceType === 'StickyCanaryType') && entityData.ratio > 0) {
                    console.log(`🚀 활성화된 Canary 배포 발견: ID ${entityId}, Type: ${entityData.serviceType}`);
                    return { type: 'CanaryType', active: true };
                  }
                }
              }
            } catch (error) {
              console.error(`❌ Entity ${entityId} 조회 실패:`, error);
            }
            return null;
          });
          
          const foundEntities = (await Promise.all(entityCheckPromises)).filter(entity => entity !== null);
          hasStandardDeployment = foundEntities.some(entity => entity.type === 'StandardType' && entity.active);
          hasCanaryDeployment = foundEntities.some(entity => entity.type === 'CanaryType' && entity.active);
        }
      }
    } catch (error) {
      console.error('❌ 기존 배포 상태 검증 중 오류:', error);
    }

    // 기존 배포가 없으면 Dark Release 배포 차단
    if (!hasStandardDeployment && !hasCanaryDeployment) {
      alert(
        "Dark Release를 배포하기 전에 먼저 Standard Deploy 또는 Canary Deploy 중 하나를 배포해야 합니다.\n\n" +
        "다음 중 하나를 먼저 진행해주세요:\n" +
        "1. Deploy 페이지에서 Standard 배포 진행\n" +
        "2. Canary Deploy 페이지에서 Canary 배포 진행\n\n" +
        "기존 배포가 있어야 Dark Release를 추가로 배포할 수 있습니다."
      );
      return;
    }

    console.log(`✅ 기존 배포 확인 완료 - Standard: ${hasStandardDeployment}, Canary: ${hasCanaryDeployment}`);

    try {
      const crdApiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL_CRD || 'http://localhost:8084';
      
      // 1단계: GET - 기존 ServiceEntity 및 DarknessRelease 확인
      console.log('🔍 1단계: 기존 ServiceEntity 및 DarknessRelease 확인...');
      let existingServiceEntityId = null;
      let existingDarknessReleaseId = null;
      
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
                    
                    if (entityData.serviceType === 'StandardType') {
                      console.log(`✅ 기존 StandardType ServiceEntity 발견: ID ${entityId}`, entityData);
                      return {
                        id: entityId,
                        data: entityData,
                        darknessReleaseID: entityData.darknessReleaseID,
                        type: 'StandardType'
                      };
                    } else if (entityData.serviceType === 'CanaryType') {
                      console.log(`🚀 기존 CanaryType ServiceEntity 발견: ID ${entityId} (건드리지 않음)`, entityData);
                      return {
                        id: entityId,
                        data: entityData,
                        type: 'CanaryType'
                      };
                    }
                  }
                }
              } catch (error) {
                console.error(`❌ Entity ${entityId} 조회 실패:`, error);
              }
              return null;
            });
            
            const foundEntities = (await Promise.all(entityCheckPromises)).filter(entity => entity !== null);
            
            // StandardType과 CanaryType 구분하여 처리
            const standardEntity = foundEntities.find(entity => entity.type === 'StandardType');
            const canaryEntity = foundEntities.find(entity => entity.type === 'CanaryType');
            
            if (standardEntity) {
              existingServiceEntityId = standardEntity.id;
              existingDarknessReleaseId = standardEntity.darknessReleaseID;
              console.log(`🔗 기존 StandardType ServiceEntity 재사용: ID ${existingServiceEntityId}, DarknessRelease ID: ${existingDarknessReleaseId}`);
            }
            
            if (canaryEntity) {
              console.log(`🚀 Canary 배포 감지: ID ${canaryEntity.id} (독립적으로 유지)`);
            }
          }
        } else {
          console.warn(`⚠️ CRD 목록 조회 실패 (${existingListResponse.status})`);
        }
      } catch (error) {
        console.error('❌ 기존 ServiceEntity 확인 중 오류:', error);
      }

      // 2단계: DELETE - 기존 DarknessRelease만 삭제 (ServiceEntity는 유지)
      if (existingDarknessReleaseId) {
        console.log(`🗑️ 2단계: 기존 DarknessRelease ${existingDarknessReleaseId} 삭제 (ServiceEntity는 유지)...`);
        try {
          const deleteResponse = await fetch(`${crdApiUrl}/api/v1/crd/darkness/${existingDarknessReleaseId}`, {
            method: 'DELETE',
          });
          
          if (deleteResponse.ok) {
            console.log(`✅ DarknessRelease ${existingDarknessReleaseId} 삭제 성공`);
          } else {
            const errorText = await deleteResponse.text();
            console.error(`❌ DarknessRelease ${existingDarknessReleaseId} 삭제 실패:`, errorText);
          }
        } catch (error) {
          console.error(`❌ DarknessRelease ${existingDarknessReleaseId} 삭제 중 오류:`, error);
        }
      }

      // 3단계: 기존 배포의 ServiceEntity ID 활용 (일반배포 자동생성 방지)
      let serviceEntityId = null;
      
      // 3-1단계: 기존 StandardType 또는 CanaryType ServiceEntity 찾기
      try {
        const existingListResponse = await fetch(`${crdApiUrl}/api/v1/crd/${selectedClusterUuid}/list`);
        if (existingListResponse.ok) {
          const existingListResult = await existingListResponse.json();
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
                      console.log(`✅ 기존 StandardType ServiceEntity 발견: ID ${entityId} (재사용)`);
                      return { id: entityId, type: 'StandardType', data: entityData };
                    } else if (entityData.serviceType === 'CanaryType' || entityData.serviceType === 'StickyCanaryType') {
                      console.log(`🚀 기존 ${entityData.serviceType} ServiceEntity 발견: ID ${entityId} (다크릴리즈용 재사용)`);
                      return { id: entityId, type: 'CanaryType', data: entityData };
                    }
                  }
                }
              } catch (error) {
                console.error(`❌ Entity ${entityId} 조회 실패:`, error);
              }
              return null;
            });
            
            const foundEntities = (await Promise.all(entityCheckPromises)).filter(entity => entity !== null);
            
            // 우선순위: StandardType > CanaryType 순으로 선택
            const standardEntity = foundEntities.find(entity => entity.type === 'StandardType');
            const canaryEntity = foundEntities.find(entity => entity.type === 'CanaryType');
            
            if (standardEntity) {
              serviceEntityId = standardEntity.id;
              console.log(`🔗 기존 StandardType ServiceEntity 재사용: ID ${serviceEntityId}`);
            } else if (canaryEntity) {
              serviceEntityId = canaryEntity.id;
              console.log(`🔗 기존 CanaryType ServiceEntity를 다크릴리즈용으로 재사용: ID ${serviceEntityId}`);
            }
          }
        }
      } catch (error) {
        console.error('❌ 기존 ServiceEntity 찾기 중 오류:', error);
      }
      
      // 3-2단계: 기존 ServiceEntity가 없으면 에러 (일반배포 자동생성 방지)
      if (!serviceEntityId) {
        throw new Error(
          '다크릴리즈를 생성하려면 먼저 StandardType 또는 CanaryType 배포가 있어야 합니다.\n\n' +
          '다음 중 하나를 먼저 진행해주세요:\n' +
          '1. Standard Deploy 페이지에서 일반 배포 진행\n' +
          '2. Canary Deploy 페이지에서 카나리 배포 진행\n\n' +
          '기존 배포의 ServiceEntity를 활용하여 다크릴리즈를 생성합니다.'
        );
      }

      // 4단계: POST - 새로운 DarknessRelease 생성
      console.log(`🌑 4단계: 새로운 DarknessRelease 생성... (ServiceEntity ID: ${serviceEntityId})`);
      const darknessReleaseData = {
        serviceEntityId: serviceEntityId,
        commitHash: selectedServiceVersion,
        ips: [ipAddress]
      };

      console.log('DarknessRelease 요청 데이터:', darknessReleaseData);

      const darknessResponse = await fetch(`${crdApiUrl}/api/v1/crd/${selectedClusterUuid}/darknessRelease`, {
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
              `ServiceEntity ID: ${serviceEntityId} (기존 배포의 ServiceEntity 재사용)\n` +
              `서비스: ${selectedService}\n` +
              `네임스페이스: ${selectedNamespace}\n` +
              `버전: ${selectedServiceVersion}\n` +
              `IP: ${ipAddress}\n` +
              `${existingDarknessReleaseId ? '(기존 DarknessRelease 삭제 후 새로 생성됨)' : '(새로 생성됨)'}\n` +
              `\n✅ 기존 배포와 연동하여 다크릴리즈가 생성되었습니다.`);
        
        // 성공 후 폼 초기화
        setSelectedService(null);
        setSelectedServiceVersion(null);
        setIpAddress("");
        
        // 목록 새로고침 (지연 추가)
        setTimeout(() => {
          fetchCurrentDarkReleases();
        }, 1500);
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

          <Card className="max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle>Dark Release</CardTitle>
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>📋 사전 요구사항:</strong> Dark Release를 배포하기 전에 먼저 <strong>Standard Deploy</strong> 또는 <strong>Canary Deploy</strong> 중 하나가 배포되어 있어야 합니다.
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  기존 배포가 없는 경우, Deploy 페이지 또는 Canary Deploy 페이지에서 먼저 배포를 진행해주세요.
                </p>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
              {/* 클러스터 선택 드롭다운 */}
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

              {/* 현재 다크 릴리즈 배포 목록 섹션 */}
              {selectedClusterUuid && currentDarkReleases.length > 0 && (
                <div className="mt-6 space-y-4">
                  <hr className="my-4" />
                  <h3 className="text-lg font-semibold">현재 다크 릴리즈 배포 목록</h3>
                  
                  {currentDarkReleases.map((darkRelease, index) => (
                    <Card key={index} className="p-4 bg-purple-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium mb-2">
                            Service: {darkRelease.name} (ID: {darkRelease.id})
                          </h4>
                          <p className="text-sm text-gray-600 mb-1">
                            네임스페이스: {darkRelease.namespace}
                          </p>
                          <p className="text-sm text-gray-600 mb-1">
                            타입: {darkRelease.serviceType}
                          </p>
                          <p className="text-sm text-gray-600 mb-1">
                            비율: {darkRelease.ratio}% (일반 사용자 접근 차단)
                          </p>
                          <p className="text-sm text-gray-600 mb-2">
                            버전: {darkRelease.commitHash ? darkRelease.commitHash.join(', ') : 'N/A'}
                          </p>
                          {darkRelease.darknessReleaseID && (
                            <p className="text-sm text-purple-600 mb-2">
                              🌑 DarknessRelease ID: {darkRelease.darknessReleaseID}
                            </p>
                          )}
                        </div>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => handleDarkReleaseDelete(darkRelease)}
                        >
                          삭제
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </SidebarProvider>
    </div>
  );
}