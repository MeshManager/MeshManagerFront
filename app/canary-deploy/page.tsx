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
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Clock, TrendingUp } from 'lucide-react';

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

interface RatioSchedule {
  delayMs: number;
  newRatio: number;
}

interface CanaryDeployment {
  id: number;
  name: string;
  namespace: string;
  serviceType: string;
  ratio: number;
  commitHash: string[];
  podScale?: boolean;
  ratioSchedules?: {triggerTime?: number; delayMs?: number; newRatio: number}[];
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
  const [podScaleEnabled, setPodScaleEnabled] = useState<boolean>(false);
  const [deployments, setDeployments] = useState<DeploymentInfo[]>([]);
  const [currentCanaryDeployments, setCurrentCanaryDeployments] = useState<CanaryDeployment[]>([]);
  
  // RatioSchedule 관련 상태 추가
  const [ratioSchedules, setRatioSchedules] = useState<RatioSchedule[]>([]);
  const [enableSchedule, setEnableSchedule] = useState<boolean>(false);
  
  // CRD API URL 정의
  const crdApiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL_CRD || 'http://localhost:8084';

  // 시간을 human-readable 형식으로 변환
  const formatDelay = (delayMs: number): string => {
    if (delayMs < 1000) return `${delayMs}ms`;
    if (delayMs < 60000) return `${delayMs / 1000}s`;
    if (delayMs < 3600000) return `${Math.floor(delayMs / 60000)}m ${Math.floor((delayMs % 60000) / 1000)}s`;
    return `${Math.floor(delayMs / 3600000)}h ${Math.floor((delayMs % 3600000) / 60000)}m`;
  };

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

  // 현재 카나리 배포 목록을 조회하는 useEffect - fetchCurrentCanaryDeployments 함수 정의 후에 배치
  useEffect(() => {
    // 초기 로딩이 완료되고 클러스터가 선택되었을 때만 호출
    if (selectedClusterUuid) {
      fetchCurrentCanaryDeployments();
    }
  }, [selectedClusterUuid, fetchCurrentCanaryDeployments]);

  // 현재 선택된 서비스의 카나리 배포 상태 확인
  const currentServiceCanaryDeployment = React.useMemo((): CanaryDeployment | null => {
    if (!selectedService || !selectedNamespace || !currentCanaryDeployments) {
      return null;
    }
    return currentCanaryDeployments.find(
      deployment => deployment.name === selectedService && deployment.namespace === selectedNamespace
    ) || null;
  }, [selectedService, selectedNamespace, currentCanaryDeployments]);

  // RatioSchedule 관련 함수들
  const addRatioSchedule = () => {
    if (ratioSchedules.length >= 100) {
      alert("최대 100개까지만 스케줄을 추가할 수 있습니다.");
      return;
    }
    
    setRatioSchedules([...ratioSchedules, { delayMs: 10000, newRatio: 50 }]);
  };

  const removeRatioSchedule = (index: number) => {
    setRatioSchedules(ratioSchedules.filter((_, i) => i !== index));
  };

  const updateRatioSchedule = (index: number, field: keyof RatioSchedule, value: number) => {
    const updated = [...ratioSchedules];
    updated[index] = { ...updated[index], [field]: value };
    setRatioSchedules(updated);
  };

  const handleLogout = () => {
    logout();
  };

  // 스케줄 유효성 검증
  const validateSchedules = (): string | null => {
    if (!enableSchedule || ratioSchedules.length === 0) return null;
    
    for (const schedule of ratioSchedules) {
      if (schedule.delayMs <= 0) {
        return "지연 시간은 0보다 커야 합니다.";
      }
      if (schedule.newRatio < 0 || schedule.newRatio > 100) {
        return "비율은 0-100 사이여야 합니다.";
      }
    }
    
    // 중복 시간 체크
    const delays = ratioSchedules.map(s => s.delayMs);
    const uniqueDelays = new Set(delays);
    if (delays.length !== uniqueDelays.size) {
      return "중복된 지연 시간이 있습니다.";
    }
    
    return null;
  };

  const handleDeploy = async () => {
    // 스케줄 유효성 검증
    const validationError = validateSchedules();
    if (validationError) {
      alert(`스케줄 설정 오류: ${validationError}`);
      return;
    }

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
      // 1단계: GET - 기존 ServiceEntity 확인 (Canary → Canary 업데이트 처리)
      console.log('🔍 1단계: 기존 ServiceEntity 확인 (Canary → Canary 업데이트 처리)...');
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
                      console.log(`🚀 기존 ${entityData.serviceType} ServiceEntity 발견: ID ${entityId} (삭제 후 새로 생성 예정)`, entityData);
                      return { 
                        id: entityId, 
                        type: entityData.serviceType,
                        commitHash: entityData.commitHash,
                        darknessReleaseID: entityData.darknessReleaseID
                      };
                    } else if (entityData.serviceType === 'StandardType') {
                      console.log(`🌑 기존 StandardType ServiceEntity 발견: ID ${entityId} (Dark Release용, 건드리지 않음)`, entityData);
                      return { 
                        id: entityId, 
                        type: 'StandardType',
                        commitHash: entityData.commitHash,
                        darknessReleaseID: entityData.darknessReleaseID
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
            
            // CanaryType과 StandardType 구분하여 처리
            const canaryEntities = foundEntities.filter(entity => 
              entity.type === 'CanaryType' || entity.type === 'StickyCanaryType'
            );
            const standardEntities = foundEntities.filter(entity => entity.type === 'StandardType');
            
            if (canaryEntities.length > 0) {
              existingCanaryEntityIds = canaryEntities.map(entity => entity.id);
              console.log(`🔄 Canary → Canary 업데이트 감지: ${existingCanaryEntityIds.length}개의 기존 Canary/StickyCanary ServiceEntity 삭제 후 새로 생성`);
            }
            
            if (standardEntities.length > 0) {
              hasStandardDeployment = true;
              console.log(`🌑 StandardType ServiceEntity 감지: ${standardEntities.length}개`);
              
              // StandardType이 DarkRelease가 아닌 일반 배포인 경우 삭제 확인
              const standardDeploymentsToDelete = standardEntities.filter(entity => 
                !entity.darknessReleaseID || entity.darknessReleaseID === null
              );
              
              if (standardDeploymentsToDelete.length > 0) {
                const confirmDeleteStandard = confirm(
                  `'${selectedService}' 서비스에 일반 배포가 존재합니다.\n` +
                  `카나리 배포를 진행하기 위해 기존 일반 배포를 삭제하시겠습니까?\n\n` +
                  `삭제할 일반 배포:\n` +
                  standardDeploymentsToDelete.map(standard => 
                    `- StandardType (버전: ${standard.commitHash?.join(', ') || 'N/A'})`
                  ).join('\n') +
                  `\n\n※ 다크릴리즈가 연결된 배포는 유지됩니다.`
                );
                
                if (!confirmDeleteStandard) {
                  throw new Error('사용자가 일반 배포 삭제를 취소했습니다.');
                }
                
                console.log(`🗑️ ${standardDeploymentsToDelete.length}개의 일반 배포 삭제 진행`);
                
                for (const standardDeployment of standardDeploymentsToDelete) {
                  try {
                    console.log(`🗑️ 일반 배포 삭제 시도: ID ${standardDeployment.id}`);
                    const deleteResponse = await fetch(`${crdApiUrl}/api/v1/crd/service/${standardDeployment.id}`, {
                      method: 'DELETE',
                    });

                    if (!deleteResponse.ok) {
                      const errorText = await deleteResponse.text();
                      console.error(`❌ 일반 배포 ${standardDeployment.id} 삭제 실패:`, errorText);
                      throw new Error(`일반 배포 삭제 실패: ${deleteResponse.status} - ${errorText}`);
                    }

                    const deleteResult = await deleteResponse.json();
                    console.log(`✅ 일반 배포 ${standardDeployment.id} 삭제 완료:`, deleteResult);
                  } catch (error) {
                    console.error(`❌ 일반 배포 ${standardDeployment.id} 삭제 중 오류:`, error);
                    throw error;
                  }
                }
                
                // 일반 배포 삭제 후 대기
                console.log('⏳ 일반 배포 삭제 완료 후 대기 중...');
                await new Promise(resolve => setTimeout(resolve, 1500));
              } else {
                console.log(`🌑 모든 StandardType이 DarkRelease 연결됨 - 유지`);
              }
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
        console.log(`🗑️ 2단계: Canary → Canary 업데이트 - ${existingCanaryEntityIds.length}개의 기존 Canary/StickyCanary ServiceEntity 삭제 (StandardType은 유지)...`);
        
        for (const entityId of existingCanaryEntityIds) {
          try {
            console.log(`🗑️ 기존 Canary/StickyCanary ServiceEntity ${entityId} 삭제 시도...`);
            const deleteResponse = await fetch(`${crdApiUrl}/api/v1/crd/service/${entityId}`, {
              method: 'DELETE',
            });
            
            if (deleteResponse.ok) {
              console.log(`✅ 기존 Canary/StickyCanary ServiceEntity ${entityId} 삭제 성공`);
            } else {
              const errorText = await deleteResponse.text();
              console.error(`❌ 기존 Canary/StickyCanary ServiceEntity ${entityId} 삭제 실패:`, errorText);
              console.warn(`⚠️ ServiceEntity 삭제 실패했지만 배포를 계속 진행합니다.`);
            }
          } catch (error) {
            console.error(`❌ 기존 Canary/StickyCanary ServiceEntity ${entityId} 삭제 중 오류:`, error);
            console.warn(`⚠️ ServiceEntity 삭제 중 오류가 발생했지만 배포를 계속 진행합니다.`);
          }
        }
        
        // 삭제 후 잠시 대기 (DB 정리 시간 확보)
        console.log('⏳ 기존 Canary 삭제 완료 후 대기 중...');
        await new Promise(resolve => setTimeout(resolve, 1500));
      } else {
        console.log('✅ 중복되는 Canary/StickyCanary ServiceEntity 없음 - 새로 생성');
        if (hasStandardDeployment) {
          console.log('🌑 StandardType과 독립적으로 Canary/StickyCanary 생성');
        }
      }

      // 3단계: POST - 새로운 ServiceEntity 생성
      const deploymentType = existingCanaryEntityIds.length > 0 ? '업데이트 (기존 삭제 후 새로 생성)' : '새로 생성';
      console.log(`🆕 3단계: 새로운 ServiceEntity 생성 - ${deploymentType}...`);
      
      // 백엔드 API 형식에 맞춰 데이터 준비
      const apiData = {
        name: selectedService,
        namespace: selectedNamespace,
        serviceType: stickySession ? "StickyCanaryType" : "CanaryType",
        ratio: canaryRatio[0],
        commitHash: [originalVersion, canaryVersion],
        podScale: podScaleEnabled,
        // delayMs를 triggerTime(절대시간)으로 변환
        ratioSchedules: enableSchedule ? ratioSchedules.map(schedule => ({
          delayMs: schedule.delayMs, // 백엔드 요청 DTO에서는 delayMs 사용
          newRatio: schedule.newRatio
        })) : []
      };

      console.log('🚀 카나리 배포 요청 데이터:', apiData);

      const response = await fetch(`${crdApiUrl}/api/v1/crd/${selectedClusterUuid}/serviceEntity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiData)
      });

      if (!response.ok) {
        throw new Error(`배포 요청 실패: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ 배포 성공:', result);
      
      alert(`카나리 배포가 성공적으로 완료되었습니다!\n` +
            `${deploymentType}\n` +
            `서비스: ${selectedService}\n` +
            `네임스페이스: ${selectedNamespace}\n` +
            `타입: ${stickySession ? 'StickyCanaryType' : 'CanaryType'}\n` +
            `트래픽 비율: ${canaryRatio[0]}%\n` +
            `버전: ${originalVersion} → ${canaryVersion}\n` +
            `${enableSchedule ? `스케줄: ${ratioSchedules.length}개 설정됨` : '스케줄: 없음'}\n` +
            `${existingCanaryEntityIds.length > 0 ? `(기존 ${existingCanaryEntityIds.length}개 Canary 배포 삭제 후 새로 생성됨)` : '(새로 생성됨)'}\n` +
            `${hasStandardDeployment ? '🌑 Dark Release와 독립적으로 공존' : ''}`);
      
      // 배포 후 목록 새로고침
      await fetchCurrentCanaryDeployments();
      
    } catch (error) {
      console.error("❌ 배포 중 오류 발생:", error);
      alert(`배포 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  };

  const handleRollback = async () => {
    if (!currentServiceCanaryDeployment) {
      alert("롤백할 카나리 배포가 없습니다.");
      return;
    }

    const confirmed = confirm(`${currentServiceCanaryDeployment.name} 서비스의 카나리 배포를 롤백하시겠습니까?`);
    if (!confirmed) return;

    try {
      const response = await fetch(`${crdApiUrl}/api/v1/crd/service/${currentServiceCanaryDeployment.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`롤백 요청 실패: ${response.status} ${response.statusText}`);
      }

      console.log('✅ 롤백 성공');
      alert("카나리 배포가 성공적으로 롤백되었습니다!");
      
      // 롤백 후 목록 새로고침
      await fetchCurrentCanaryDeployments();
      
    } catch (error) {
      console.error("❌ 롤백 중 오류 발생:", error);
      alert(`롤백 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  };

  const handleAgentDelete = async (canaryDeployment: CanaryDeployment) => {
    const confirmMessage = `'${canaryDeployment.name}' 카나리 배포를 삭제하시겠습니까?\n\n` +
      `서비스: ${canaryDeployment.name}\n` +
      `네임스페이스: ${canaryDeployment.namespace}\n` +
      `현재 비율: ${canaryDeployment.ratio}%\n` +
      `버전: ${canaryDeployment.commitHash?.join(', ') || 'N/A'}\n\n` +
      `※ 카나리 배포만 삭제되고 다른 배포는 영향받지 않습니다.`;
    
    const confirmed = confirm(confirmMessage);
    if (!confirmed) return;

    try {
      console.log('🗑️ 카나리 배포 삭제 시도:', canaryDeployment);
      
      const response = await fetch(`${crdApiUrl}/api/v1/crd/service/${canaryDeployment.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`카나리 배포 삭제 실패: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('카나리 배포 삭제 API 응답:', JSON.stringify(result, null, 2));
      
      // 성공 조건을 더 유연하게 처리
      const isSuccess = result.success === true || 
                       result.success === "true" ||
                       (result.message && result.message.includes("삭제 성공")) ||
                       (result.msg && result.msg.includes("삭제 성공"));
      
      if (isSuccess) {
        console.log('✅ 카나리 배포 삭제 성공:', result);
        alert("카나리 배포가 성공적으로 삭제되었습니다!\n다른른 배포는 그대로 유지됩니다.");
      } else {
        // 메시지를 기반으로 한 번 더 성공 체크
        const message = result.message || result.msg || "";
        if (message.includes("성공") || message.includes("success")) {
          console.log('✅ 카나리 배포 삭제 성공 (메시지 기반):', result);
          alert(`카나리 배포가 삭제되었습니다!\n메시지: ${message}\n다른른 배포는 그대로 유지됩니다.`);
        } else {
          throw new Error(message || '카나리 배포 삭제 중 오류가 발생했습니다.');
        }
      }
      
      // 삭제 후 목록 새로고침
      setTimeout(async () => {
        await fetchCurrentCanaryDeployments();
      }, 1000);
      
    } catch (error) {
      console.error("❌ 카나리 배포 삭제 중 오류 발생:", error);
      
      let errorMessage = '카나리 배포 삭제 중 오류가 발생했습니다.';
      if (error instanceof Error) {
        errorMessage = `카나리 배포 삭제 실패: ${error.message}`;
      }
      
      alert(errorMessage);
    }
  };

  // useEffect는 fetchCurrentCanaryDeployments 함수 정의 후에 배치
  // 현재 선택된 서비스의 카나리 배포 상태가 변경될 때 스케줄 정보도 업데이트
  useEffect(() => {
    if (currentServiceCanaryDeployment) {
      if (currentServiceCanaryDeployment.ratio !== undefined) {
        setCanaryRatio([currentServiceCanaryDeployment.ratio]);
      }
      
      // 기존 ratioSchedules 로드 - 백엔드 triggerTime을 delayMs로 변환
      if (currentServiceCanaryDeployment.ratioSchedules && currentServiceCanaryDeployment.ratioSchedules.length > 0) {
        const convertedSchedules: RatioSchedule[] = currentServiceCanaryDeployment.ratioSchedules.map((schedule) => {
          // triggerTime이 절대 시간인 경우 상대 시간으로 변환
          const currentTime = Date.now();
          const delayMs = schedule.triggerTime ? Math.max(0, schedule.triggerTime - currentTime) : (schedule.delayMs || 0);
          return {
            delayMs: delayMs,
            newRatio: schedule.newRatio
          };
        });
        setRatioSchedules(convertedSchedules);
        setEnableSchedule(true);
      } else {
        setRatioSchedules([]);
        setEnableSchedule(false);
      }
    }
  }, [currentServiceCanaryDeployment]);

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

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      // 현재 페이지를 로그인 후 리다이렉션 대상으로 저장
      localStorage.setItem('redirectAfterLogin', '/canary-deploy');
      router.push('/login');
    }
  }, [isLoggedIn, isLoading, router]);

  // 로딩 중이거나 로그인되지 않은 경우 빈 화면 반환
  if (isLoading || !isLoggedIn) {
    return <div></div>;
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
              <div className="flex justify-end mb-4">
                <div className="group relative flex items-center">
                  <Button variant="ghost" className="mr-2 cursor-pointer">user</Button>
                  <Button variant="outline" onClick={handleLogout} className="absolute right-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    로그아웃
                  </Button>
                </div>
              </div>

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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="sticky-session"
                    checked={stickySession}
                    onCheckedChange={setStickySession}
                  />
                  <UiLabel htmlFor="sticky-session">Sticky Session 활성화</UiLabel>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="pod-scale"
                    checked={podScaleEnabled}
                    onCheckedChange={setPodScaleEnabled}
                  />
                  <UiLabel htmlFor="pod-scale">비율에 따른 파드 수 조정</UiLabel>
                </div>
              </div>

              {/* RatioSchedule 설정 섹션 */}
              <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="enable-schedule"
                      checked={enableSchedule}
                      disabled={!selectedClusterUuid || !selectedNamespace || !selectedService || !originalVersion || !canaryVersion || canaryRatio[0] === undefined}
                      onCheckedChange={(checked) => {
                        setEnableSchedule(checked);
                        if (!checked) {
                          setRatioSchedules([]);
                        }
                      }}
                    />
                    <UiLabel htmlFor="enable-schedule" className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      시간별 비율 스케줄링
                      {(!selectedClusterUuid || !selectedNamespace || !selectedService || !originalVersion || !canaryVersion || canaryRatio[0] === undefined) && (
                        <span className="text-xs text-red-500 ml-2">
                          (기본 설정을 먼저 완료하세요)
                        </span>
                      )}
                    </UiLabel>
                  </div>
                  
                  {enableSchedule && (selectedClusterUuid && selectedNamespace && selectedService && originalVersion && canaryVersion && canaryRatio[0] !== undefined) && (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addRatioSchedule}
                        disabled={ratioSchedules.length >= 100}
                        className="flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        스케줄 추가 ({ratioSchedules.length}/100)
                      </Button>
                    </div>
                  )}
                </div>

                {!selectedClusterUuid || !selectedNamespace || !selectedService || !originalVersion || !canaryVersion || canaryRatio[0] === undefined ? (
                  // 기본 설정이 완료되지 않았을 때는 아무것도 표시하지 않음
                  null
                ) : enableSchedule && (
                  <div className="space-y-4">
                    <div className="text-sm text-gray-600 mb-4">
                      <p>📅 배포 시점에 미리 계획된 시간별 카나리 트래픽 비율 변경을 스케줄링합니다.</p>
                      <p>💡 초기 비율: {canaryRatio[0]}% → 설정된 시간 후 스케줄된 비율로 변경</p>
                      <p>⏱️ 지연시간은 밀리초(ms) 단위로 입력하세요 (예: 10000ms = 10초)</p>
                      <p className="text-amber-600 text-xs mt-2">
                        ⚠️ 참고: 스케줄은 배포 시점에 설정되며, 실시간으로 변경되지 않습니다.
                      </p>
                    </div>

                    {/* 폼 뷰만 유지 */}
                    <div className="space-y-4">
                      {ratioSchedules.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>스케줄이 없습니다. &quot;스케줄 추가&quot; 버튼을 눌러 시간별 비율 변경을 설정하세요.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="font-medium text-sm flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            스케줄 목록 ({ratioSchedules.length}개)
                          </div>
                          
                          {/* 초기 상태 표시 */}
                          <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg border">
                            <div className="text-sm">
                              <span className="font-medium">시작:</span> {canaryRatio[0]}%
                            </div>
                            <div className="text-xs text-gray-500">
                              ⏰ 0ms (배포 직후)
                            </div>
                          </div>

                          {/* 스케줄 항목들 */}
                          {ratioSchedules.map((schedule, index) => (
                            <div key={index} className="flex items-center gap-4 p-3 bg-white rounded-lg border">
                              <div className="flex-1 grid grid-cols-2 gap-4">
                                <div>
                                  <UiLabel className="text-xs text-gray-600">지연시간 (ms)</UiLabel>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={schedule.delayMs}
                                    onChange={(e) => updateRatioSchedule(index, 'delayMs', parseInt(e.target.value) || 0)}
                                    placeholder="10000"
                                    className="h-8"
                                  />
                                  <div className="text-xs text-gray-500 mt-1">
                                    = {formatDelay(schedule.delayMs)}
                                  </div>
                                </div>
                                <div>
                                  <UiLabel className="text-xs text-gray-600">새로운 비율 (%)</UiLabel>
                                  <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={schedule.newRatio}
                                    onChange={(e) => updateRatioSchedule(index, 'newRatio', parseInt(e.target.value) || 0)}
                                    placeholder="50"
                                    className="h-8"
                                  />
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeRatioSchedule(index)}
                                className="flex items-center gap-1 text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}

                          {/* 스케줄 미리보기 */}
                          {ratioSchedules.length > 0 && (
                            <div className="mt-4 p-3 bg-green-50 rounded-lg border">
                              <div className="text-sm font-medium mb-2 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4" />
                                스케줄 미리보기
                              </div>
                              <div className="text-xs space-y-1">
                                <div>0초 후: {canaryRatio[0]}% (배포 직후)</div>
                                {[...ratioSchedules].sort((a, b) => a.delayMs - b.delayMs).map((schedule, index) => (
                                  <div key={`preview-${index}`}>
                                    {formatDelay(schedule.delayMs)} 후: {schedule.newRatio}%
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
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
                        <p><strong>파드 스케일:</strong> {currentServiceCanaryDeployment.podScale ? '활성화' : '비활성화'}</p>
                      </div>

                      {/* 스케줄 정보 표시 - 항상 표시 */}
                      <div className="mt-3 p-3 bg-white rounded border">
                        <div className="font-medium text-sm mb-2 flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          비율 스케줄링 현황
                        </div>
                        {currentServiceCanaryDeployment.ratioSchedules && currentServiceCanaryDeployment.ratioSchedules.length > 0 ? (
                          <div>
                            <div className="text-xs text-green-600 mb-2 font-medium">
                              ✅ {currentServiceCanaryDeployment.ratioSchedules.length}개의 스케줄이 활성화되어 있습니다
                            </div>
                            {/* 실제 스케줄 설정값들 표시 */}
                            <div className="text-xs text-gray-600 space-y-1 bg-gray-50 p-2 rounded">
                              <div className="font-medium text-blue-600 mb-2">⏰ 스케줄 설정값:</div>
                              {currentServiceCanaryDeployment.ratioSchedules
                                .map((schedule: {triggerTime?: number; delayMs?: number; newRatio: number}) => {
                                  // 백엔드에서 triggerTime으로 올 경우 처리
                                  const displayTime = schedule.triggerTime && schedule.triggerTime > 0
                                    ? new Date(schedule.triggerTime).toLocaleString()
                                    : formatDelay(schedule.delayMs || 0);
                                  return { ...schedule, displayTime };
                                })
                                .sort((a: {triggerTime?: number; delayMs?: number}, b: {triggerTime?: number; delayMs?: number}) => {
                                  // triggerTime이 있으면 그걸로, 없으면 delayMs로 정렬
                                  const timeA = a.triggerTime || a.delayMs || 0;
                                  const timeB = b.triggerTime || b.delayMs || 0;
                                  return timeA - timeB;
                                })
                                .map((schedule: {displayTime: string; newRatio: number; triggerTime?: number; delayMs?: number}, index: number) => (
                                  <div key={index} className="flex justify-between items-center bg-white p-2 rounded border-l-2 border-blue-300">
                                    <div className="flex flex-col">
                                      <span className="text-xs text-gray-700">📅 실행 시간: {schedule.displayTime}</span>
                                      {schedule.triggerTime && (
                                        <span className="text-xs text-gray-500">triggerTime: {schedule.triggerTime}</span>
                                      )}
                                      {schedule.delayMs && (
                                        <span className="text-xs text-gray-500">delayMs: {schedule.delayMs}ms</span>
                                      )}
                                    </div>
                                    <span className="font-medium text-orange-600">→ {schedule.newRatio}%</span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-xs text-gray-500 mb-2">
                              ⚪ 자동 스케줄 없음 (수동 관리)
                            </div>
                            <div className="text-xs text-gray-400 bg-gray-50 p-2 rounded">
                              📝 스케줄 설정값: 없음<br />
                              💡 새 배포 시 시간별 비율 변경을 설정할 수 있습니다.
                            </div>
                          </div>
                        )}
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
                            // 기존 스케줄도 복원
                            if (currentServiceCanaryDeployment.ratioSchedules && currentServiceCanaryDeployment.ratioSchedules.length > 0) {
                              const convertedSchedules: RatioSchedule[] = currentServiceCanaryDeployment.ratioSchedules.map((schedule) => {
                                // triggerTime이 절대 시간인 경우 상대 시간으로 변환
                                const currentTime = Date.now();
                                const delayMs = schedule.triggerTime ? Math.max(0, schedule.triggerTime - currentTime) : (schedule.delayMs || 0);
                                return {
                                  delayMs: delayMs,
                                  newRatio: schedule.newRatio
                                };
                              });
                              setRatioSchedules(convertedSchedules);
                              setEnableSchedule(true);
                            } else {
                              setRatioSchedules([]);
                              setEnableSchedule(false);
                            }
                          }}
                        >
                          현재 설정으로 복원
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
                        <div className="flex-1">
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
                          <p className="text-sm text-gray-600 mb-1">
                            파드 스케일: {canaryDeployment.podScale ? '활성화' : '비활성화'}
                          </p>
                          <p className="text-sm text-gray-600 mb-2">
                            버전: {canaryDeployment.commitHash ? canaryDeployment.commitHash.join(', ') : 'N/A'}
                          </p>
                          
                          {/* 스케줄 정보 표시 - 항상 표시 */}
                          <div className="mt-2 p-3 bg-white rounded border">
                            <div className="flex items-center gap-2 mb-2">
                              <Clock className="w-4 h-4 text-blue-500" />
                              <span className="text-sm font-medium">비율 스케줄링 상태</span>
                            </div>
                            {canaryDeployment.ratioSchedules && canaryDeployment.ratioSchedules.length > 0 ? (
                              <div>
                                <div className="text-xs text-green-600 mb-3 font-medium">
                                  ✅ {canaryDeployment.ratioSchedules.length}개의 스케줄이 활성화되어 있습니다
                                </div>
                                {/* 실제 스케줄 설정값들 표시 */}
                                <div className="text-xs text-gray-600 space-y-1 bg-gray-50 p-2 rounded">
                                  <div className="font-medium text-blue-600 mb-2">⏰ 스케줄 설정값:</div>
                                  {canaryDeployment.ratioSchedules
                                    .map((schedule: {triggerTime?: number; delayMs?: number; newRatio: number}) => {
                                      // 백엔드에서 triggerTime으로 올 경우 처리
                                      const displayTime = schedule.triggerTime && schedule.triggerTime > 0
                                        ? new Date(schedule.triggerTime).toLocaleString()
                                        : formatDelay(schedule.delayMs || 0);
                                      return { ...schedule, displayTime };
                                    })
                                    .sort((a: {triggerTime?: number; delayMs?: number}, b: {triggerTime?: number; delayMs?: number}) => {
                                      // triggerTime이 있으면 그걸로, 없으면 delayMs로 정렬
                                      const timeA = a.triggerTime || a.delayMs || 0;
                                      const timeB = b.triggerTime || b.delayMs || 0;
                                      return timeA - timeB;
                                    })
                                    .map((schedule: {displayTime: string; newRatio: number; triggerTime?: number; delayMs?: number}, index: number) => (
                                      <div key={index} className="flex justify-between items-center bg-white p-2 rounded border-l-2 border-blue-300">
                                        <div className="flex flex-col">
                                          <span className="text-xs text-gray-700">📅 실행 시간: {schedule.displayTime}</span>
                                          {schedule.triggerTime && (
                                            <span className="text-xs text-gray-500">triggerTime: {schedule.triggerTime}</span>
                                          )}
                                          {schedule.delayMs && (
                                            <span className="text-xs text-gray-500">delayMs: {schedule.delayMs}ms</span>
                                          )}
                                        </div>
                                        <span className="font-medium text-orange-600">→ {schedule.newRatio}%</span>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="text-xs text-gray-500 mb-2">
                                  ⚪ 자동 스케줄 없음 (수동 관리)
                                </div>
                                <div className="text-xs text-gray-400 bg-gray-50 p-2 rounded">
                                  📝 스케줄 설정값: 없음<br />
                                  💡 새 배포 시 시간별 비율 변경을 설정할 수 있습니다.
                                </div>
                              </div>
                            )}
                          </div>
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