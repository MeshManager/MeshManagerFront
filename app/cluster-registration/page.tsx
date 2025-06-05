'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Eye, EyeOff } from "lucide-react";

function ClusterRegistrationPage() {
  const router = useRouter();
  const { isLoggedIn, logout, isLoading } = useAuth();

  const [clusterName, setClusterName] = useState('');
  const [prometheusUrl, setPrometheusUrl] = useState('');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [showCommandDialog, setShowCommandDialog] = useState(false);
  const [agentInstallCommand, setAgentInstallCommand] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isDuplicateChecked, setIsDuplicateChecked] = useState(false);

  useEffect(() => {
    // 페이지 로드 시 토큰 자동 생성
    const newToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    setToken(newToken);
  }, []);

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push('/login');
    }
  }, [isLoggedIn, isLoading, router]);

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

  const handleDuplicateCheck = () => {
    if (clusterName.trim() === '') {
      alert("클러스터 이름을 입력해주세요.");
      return;
    }
    alert(`'${clusterName}' 중복 확인! (시뮬레이션: 사용 가능)`);
    setIsDuplicateChecked(true);
  };

  const handleRegisterCluster = async () => {
    if (!isDuplicateChecked) {
      alert("클러스터 이름 중복 확인을 먼저 해주세요.");
      return;
    }
    if (clusterName.trim() === '' || prometheusUrl.trim() === '' || token.trim() === '') {
      alert("모든 필드를 입력해주세요.");
      return;
    }

    // 즉시 로딩 상태로 변경
    setIsRegistering(true);

    // 명령어 생성 및 팝업을 즉시 표시
    const command = `kubectl apply -f https://example.com/agent-manifest.yaml?token=${token}&cluster=${clusterName}`;
    setAgentInstallCommand(command);
    setShowCommandDialog(true);

    // 백엔드 API 호출 로직
    const clusterData = {
        clusterName: clusterName,
        prometheusUrl: prometheusUrl,
        token: token
    };

    // 백엔드 API의 기본 URL (백엔드 기본 포트 8080 가정)
    const backendApiUrl = 'http://localhost:8080/api/clusters'; 

    try {
        const response = await fetch(backendApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // 필요에 따라 인증 토큰 등 추가 헤더 포함 (예: 'Authorization': `Bearer ${yourAuthToken}`)
            },
            body: JSON.stringify(clusterData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const result = await response.json();
        console.log('클러스터 등록 성공:', result);
        
        // 로딩 상태는 Agent 연결까지 계속 유지
        // Agent 연결 확인 API가 없으므로 현재는 무한 로딩 상태

    } catch (error: unknown) {
        let errorMessage = '클러스터 등록 중 알 수 없는 오류 발생';
        if (error instanceof Error) {
            errorMessage = `클러스터 등록에 실패했습니다: ${error.message}`;
        } else if (typeof error === 'string') {
            errorMessage = `클러스터 등록에 실패했습니다: ${error}`;
        }
        console.error('클러스터 등록 중 오류 발생:', error);
        alert(errorMessage);
        setIsRegistering(false); // 에러 시에만 로딩 상태 해제
    }
  };

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(agentInstallCommand);
    alert("명령어가 복사되었습니다!");
  };

  const handleAgentConnected = () => {
    setIsRegistering(false);
    setShowCommandDialog(false);
    alert("Agent 연결이 완료되었습니다!");
    router.push('/');
  };

  const handleClusterNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setClusterName(e.target.value);
    setIsDuplicateChecked(false);
  };

  const handlePrometheusUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPrometheusUrl(e.target.value);
  };

  const handleLogout = () => {
    logout();
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
            <Button variant="outline" onClick={handleLogout}>
              로그아웃
            </Button>
          </div>
          <Card className="max-w-xl mx-auto">
            <CardHeader>
              <CardTitle>클러스터 등록</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="cluster-name" className="block text-sm font-medium text-gray-700">클러스터 이름</label>
                <div className="mt-1 flex space-x-2">
                  <Input
                    id="cluster-name"
                    type="text"
                    value={clusterName}
                    onChange={handleClusterNameChange}
                    placeholder="클러스터 이름을 입력하세요"
                    className="flex-1"
                  />
                  <Button onClick={handleDuplicateCheck} variant="outline" disabled={clusterName.trim() === '' || isRegistering}>
                    중복확인
                  </Button>
                </div>
              </div>

              <div>
                <label htmlFor="prometheus-url" className="block text-sm font-medium text-gray-700">프로메테우스 URL</label>
                <div className="mt-1">
                  <Input
                    id="prometheus-url"
                    type="url"
                    value={prometheusUrl}
                    onChange={handlePrometheusUrlChange}
                    placeholder="http://prometheus.example.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="token" className="block text-sm font-medium text-gray-700">Token</label>
                <div className="mt-1 flex space-x-2 relative">
                  <Input
                    id="token"
                    type={showToken ? "text" : "password"}
                    value={showToken ? token : '*'.repeat(token.length)}
                    readOnly
                    className="flex-1 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute inset-y-0 right-0 flex items-center pr-3"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? <EyeOff className="h-4 w-4 text-gray-500" /> : <Eye className="h-4 w-4 text-gray-500" />}
                  </Button>
                </div>
              </div>

              <div className="flex justify-center space-x-4">
                <Button onClick={handleRegisterCluster} disabled={isRegistering || clusterName.trim() === '' || prometheusUrl.trim() === '' || token.trim() === '' || !isDuplicateChecked}>
                  {isRegistering ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      로딩 중...
                    </>
                  ) : (
                    "등록하기"
                  )}
                </Button>
                <Button 
                  onClick={() => setShowCommandDialog(true)} 
                  variant="outline"
                  disabled={!agentInstallCommand}
                >
                  명령어 다시 보기
                </Button>
              </div>
            </CardContent>
          </Card>

          <Dialog open={showCommandDialog} onOpenChange={setShowCommandDialog}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>에이전트 설치 명령어</DialogTitle>
                <DialogDescription>
                  새 클러스터를 등록하려면 다음 명령어를 실행하세요.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <label htmlFor="command-input" className="sr-only">설치 명령어</label>
                  <Input
                    id="command-input"
                    value={agentInstallCommand}
                    readOnly
                    className="col-span-3 h-10"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" onClick={handleCopyCommand}>
                  명령어 복사
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
      </SidebarProvider>
    </div>
  );
}

export default ClusterRegistrationPage;