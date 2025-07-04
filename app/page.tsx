'use client';

import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface ClusterResponse {
  uuid: string;
  name: string;
  agentConnected?: boolean;
}

// SidebarTrigger의 위치를 동적으로 관리하는 새로운 컴포넌트
function SidebarToggleButton() {
  const { state } = useSidebar();

  const leftPosition = state === "expanded"
    ? `calc(16rem + 1rem)` // 사이드바가 열려 있을 때 (16rem) + 1rem 여백
    : `1rem`; // 사이드바가 닫혀 있을 때, 좌측 상단에 딱 붙도록

  return (
    <div
      className="fixed top-4 z-50 transition-all duration-200 ease-linear"
      style={{ left: leftPosition }} // 동적으로 계산된 left 위치 적용
    >
      {state === "collapsed" && <SidebarTrigger />}
    </div>
  );
}

function App() {
  const router = useRouter();
  const { isLoggedIn, logout } = useAuth();
  const [clusters, setClusters] = useState<ClusterResponse[]>([]);
  const [showAgentDeleteDialog, setShowAgentDeleteDialog] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<string>('');

  // 백엔드에서 클러스터 목록을 가져오는 함수
  const fetchClusters = async () => {
    try {
      // cluster-service에서 클러스터 목록을 가져옴
      const clusterApiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL_CLUSTER || 'http://localhost:8082';
      const clusterResponse = await fetch(`${clusterApiUrl}/api/v1/cluster`);
      if (!clusterResponse.ok) {
        throw new Error(`HTTP error! status: ${clusterResponse.status}, message: ${await clusterResponse.text()}`);
      }
      const clusterResult = await clusterResponse.json();
      const clusterList = clusterResult.data || [];

      // 먼저 클러스터 목록을 화면에 표시 (agent 연결 상태는 undefined)
      setClusters(clusterList.map((cluster: ClusterResponse) => ({
        ...cluster,
        agentConnected: undefined // 아직 확인 중
      })));

      // agent-service에서 연결된 agent 이름들을 가져옴 (실패해도 클러스터 목록은 표시)
      let connectedAgents = [];
      try {
        const agentApiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL_AGENT || 'http://localhost:8081';
        
        // AbortController로 timeout 설정 (5초)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const agentResponse = await fetch(`${agentApiUrl}/api/v1/agent/connected`, {
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        clearTimeout(timeoutId);
        
        if (agentResponse.ok) {
          connectedAgents = await agentResponse.json();
        }
      } catch (agentError: unknown) {
        const errorMessage = agentError instanceof Error && agentError.name === 'AbortError' ? 'Timeout' : agentError;
        console.error("Agent API 실패 (클러스터 목록은 정상 표시):", errorMessage);
      }

      // 클러스터 이름과 Redis 키(agent 이름) 매칭하여 최종 업데이트
      const clustersWithStatus = clusterList.map((cluster: ClusterResponse) => ({
        ...cluster,
        agentConnected: connectedAgents.includes(cluster.name)
      }));

      setClusters(clustersWithStatus);
    } catch (error) {
      console.error("Failed to fetch clusters from backend:", error);
      // 에러 발생 시 빈 배열로 설정
      setClusters([]);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      // 백엔드에서 클러스터 데이터 로드
      fetchClusters();
    } else {
      setClusters([]); // 로그인 안된 상태에서는 클러스터 목록 비우기
    }
  }, [isLoggedIn]);

  const handleRegisterCluster = () => {
    if (!isLoggedIn) {
      router.push('/login');
    } else {
      router.push('/cluster-registration');
    }
  };

  const handleDeleteCluster = async (clusterId: string, clusterName: string, agentConnected: boolean) => {
    if (agentConnected) {
      alert(`클러스터 '${clusterName}'에 연결된 Agent가 있습니다. Agent를 먼저 삭제해주세요.`);
      return;
    }

    if (window.confirm(`정말로 클러스터 '${clusterName}'를 삭제하시겠습니까?`)) {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL_CLUSTER || 'http://localhost:8082';
        const response = await fetch(`${apiUrl}/api/v1/cluster/${clusterId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        alert(`클러스터 '${clusterName}'가 성공적으로 삭제되었습니다.`);
        fetchClusters(); // 목록 새로고침
      } catch (error: unknown) {
        let errorMessage = '클러스터 삭제 중 알 수 없는 오류 발생';
        if (error instanceof Error) {
            errorMessage = `클러스터 삭제에 실패했습니다: ${error.message}`;
        } else if (typeof error === 'string') {
            errorMessage = `클러스터 삭제에 실패했습니다: ${error}`;
        }
        console.error('클러스터 삭제 중 오류 발생:', error);
        alert(errorMessage);
      }
    }
  };

  const handleDeleteAgent = (clusterName: string) => {
    setSelectedCluster(clusterName);
    setShowAgentDeleteDialog(true);
  };

  const handleAuthButtonClick = () => {
    if (isLoggedIn) {
      logout();
    } else {
      router.push('/login');
    }
  };

  return (
    <div>
      <SidebarProvider>
        <AppSidebar />

        {/* SidebarTrigger를 고정된 위치에 배치 */} 
        <SidebarToggleButton />

        <main className="flex-1 p-4 md:p-6">
          {/* 로그인/로그아웃 버튼 */} 
          <div className="flex justify-end mb-4">
            <div className="group relative flex items-center">
              {isLoggedIn && <Button variant="ghost" className="mr-2 cursor-pointer">user</Button>}
              <Button
                variant="outline"
                onClick={handleAuthButtonClick}
                className={`absolute right-0 transition-opacity duration-200 ${isLoggedIn ? 'opacity-0 group-hover:opacity-100' : ''}`}
              >
                {isLoggedIn ? "로그아웃" : "로그인"}
              </Button>
            </div>
          </div>

          {isLoggedIn ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-2xl font-bold">클러스터 목록</CardTitle>
                <Button onClick={handleRegisterCluster}>클러스터 등록하기</Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>클러스터 이름</TableHead>
                      <TableHead>Agent 연결 여부</TableHead>
                      <TableHead className="text-right">액션</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clusters.length === 0 ? (
                      <TableRow key="no-clusters-row">
                        <TableCell colSpan={3} className="text-center text-gray-500 py-8">
                          등록된 클러스터가 없습니다.
                        </TableCell>
                      </TableRow>
                    ) : (
                      clusters.map((cluster) => (
                        <TableRow key={cluster.uuid}>
                          <TableCell className="font-medium">
                            <Link href={`/cluster-detail?clusterId=${cluster.uuid}`} className="text-blue-600 hover:underline">
                              {cluster.name}
                            </Link>
                          </TableCell>
                          <TableCell>
                            {cluster.agentConnected === undefined ? "확인 중..." : cluster.agentConnected ? "연결됨" : "연결 안됨"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteCluster(cluster.uuid, cluster.name, cluster.agentConnected || false)}
                              className="mr-2"
                              disabled={cluster.agentConnected}
                            >
                              클러스터 삭제
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleDeleteAgent(cluster.name)}
                            >
                              Agent 삭제
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <div className="text-center text-gray-500 py-8">
              로그인이 필요합니다.
            </div>
          )}

          {/* Agent 삭제 명령어 팝업 */}
          <Dialog open={showAgentDeleteDialog} onOpenChange={setShowAgentDeleteDialog}>
            <DialogContent className="sm:max-w-[625px]">
              <DialogHeader>
                <DialogTitle>Agent 삭제 명령어</DialogTitle>
                <DialogDescription>
                  클러스터에서 Agent를 삭제하기 위한 명령어를 제공합니다.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  클러스터 <strong>{selectedCluster}</strong>에서 Agent를 삭제하려면 다음 명령어를 실행하세요:
                </p>
                <div className="bg-gray-100 p-4 rounded-md">
                  <code className="text-sm font-mono">make undeploy</code>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowAgentDeleteDialog(false)}
                  >
                    닫기
                  </Button>
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText('make undeploy');
                      alert('명령어가 클립보드에 복사되었습니다.');
                    }}
                  >
                    명령어 복사
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </main>
      </SidebarProvider>
    </div>
  );
}

export default App;