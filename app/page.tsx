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
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface Cluster {
  id: string;
  name: string;
  agentConnected: boolean;
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

  useEffect(() => {
    if (isLoggedIn) {
      // localStorage에서 클러스터 데이터 로드
      try {
        const savedClusters = localStorage.getItem('clusters');
        if (savedClusters) {
          setClusters(JSON.parse(savedClusters));
        }
      } catch (error) {
        console.error("Failed to load clusters from localStorage:", error);
      }
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

  const handleDeleteCluster = (clusterName: string) => {
    // 클러스터 삭제 로직
    alert(`클러스터 '${clusterName}' 삭제 로직 (프론트엔드)`);
    // 실제 로직: localStorage에서 클러스터 삭제
    try {
      const existingClustersString = localStorage.getItem('clusters');
      if (existingClustersString) {
        const existingClusters: Cluster[] = JSON.parse(existingClustersString);
        const updatedClusters = existingClusters.filter(c => c.name !== clusterName);
        localStorage.setItem('clusters', JSON.stringify(updatedClusters));
        setClusters(updatedClusters); // UI 업데이트
        alert(`클러스터 '${clusterName}'가 삭제되었습니다.`);
      }
    } catch (error) {
      console.error("Failed to delete cluster from localStorage:", error);
      alert("클러스터 삭제에 실패했습니다. 콘솔을 확인해주세요.");
    }
  };

  const handleDeleteAgent = (clusterName: string) => {
    // Agent 삭제 로직
    alert(`클러스터 '${clusterName}' Agent 삭제 로직 (프론트엔드)`);
    // 실제 로직: localStorage에서 Agent 연결 상태 변경 (예: false로)
    try {
      const existingClustersString = localStorage.getItem('clusters');
      if (existingClustersString) {
        const existingClusters: Cluster[] = JSON.parse(existingClustersString);
        const updatedClusters = existingClusters.map(c => 
          c.name === clusterName ? { ...c, agentConnected: false } : c
        );
        localStorage.setItem('clusters', JSON.stringify(updatedClusters));
        setClusters(updatedClusters); // UI 업데이트
        alert(`클러스터 '${clusterName}'의 Agent 연결 상태가 '연결 안됨'으로 변경되었습니다.`);
      }
    } catch (error) {
      console.error("Failed to update agent status in localStorage:", error);
      alert("Agent 연결 상태 업데이트에 실패했습니다. 콘솔을 확인해주세요.");
    }
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
            <Button variant="outline" onClick={handleAuthButtonClick}>
              {isLoggedIn ? "로그아웃" : "로그인"}
            </Button>
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
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-gray-500 py-8">
                          등록된 클러스터가 없습니다.
                        </TableCell>
                      </TableRow>
                    ) : (
                      clusters.map((cluster) => (
                        <TableRow key={cluster.id}>
                          <TableCell className="font-medium">
                            {cluster.name}
                          </TableCell>
                          <TableCell>
                            {cluster.agentConnected ? "연결됨" : "연결 안됨"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteCluster(cluster.name)}
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