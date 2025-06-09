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
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface Cluster {
  uuid: string;
  name: string;
  prometheusUrl: string;
  token: string;
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
  const [clusters, setClusters] = useState<Cluster[]>([]);

  // 백엔드에서 클러스터 목록을 가져오는 함수
  const fetchClusters = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8080';
      const response = await fetch(`${apiUrl}/api/v1/cluster`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      // agentConnected 필드가 없으면 false로 기본값 설정
      const clustersWithAgent = data.map((cluster: Cluster) => ({
        ...cluster,
        agentConnected: cluster.agentConnected ?? false
      }));
      setClusters(clustersWithAgent);
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

  const handleDeleteCluster = async (clusterUuid: string, clusterName: string) => {
    if (window.confirm(`정말로 클러스터 '${clusterName}'를 삭제하시겠습니까?`)) {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8080';
        const response = await fetch(`${apiUrl}/api/v1/cluster/${clusterUuid}`, {
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
    // Agent 삭제 로직
    alert(`클러스터 '${clusterName}' Agent 삭제 로직 (프론트엔드)`);
    // TODO: 백엔드 Agent 상태 업데이트 API 호출 후 목록 새로고침
    fetchClusters();
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
              <Button variant="outline" onClick={handleAuthButtonClick} className="absolute right-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
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
                            <Link href={`/cluster-detail?uuid=${cluster.uuid}`} className="text-blue-600 hover:underline">
                              {cluster.name}
                            </Link>
                          </TableCell>
                          <TableCell>
                            {cluster.agentConnected ? "연결됨" : "연결 안됨"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteCluster(cluster.uuid, cluster.name)}
                              className="mr-2"
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
        </main>
      </SidebarProvider>
    </div>
  );
}

export default App;