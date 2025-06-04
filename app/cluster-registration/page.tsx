'use client';

import React, { useState } from 'react';
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
import { Loader2 } from "lucide-react";

function ClusterRegistrationPage() {
  const [clusterName, setClusterName] = useState('');
  const [prometheusUrl, setPrometheusUrl] = useState('');
  const [token, setToken] = useState('');
  const [showCommandDialog, setShowCommandDialog] = useState(false);
  const [agentInstallCommand, setAgentInstallCommand] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDuplicateChecked, setIsDuplicateChecked] = useState(false);

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

  const handleGenerateToken = () => {
    if (clusterName.trim() === '' || prometheusUrl.trim() === '') {
        alert("클러스터 이름과 프로메테우스 URL을 먼저 입력해주세요.");
        return;
    }
    const newToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    setToken(newToken);
  };

  const handleRegisterCluster = () => {
    if (!isDuplicateChecked) {
      alert("클러스터 이름 중복 확인을 먼저 해주세요.");
      return;
    }
    if (clusterName.trim() === '' || prometheusUrl.trim() === '' || token.trim() === '') {
      alert("모든 필드를 입력해주세요.");
      return;
    }

    setIsLoading(true);

    const command = `kubectl apply -f https://example.com/agent-manifest.yaml?token=${token}&cluster=${clusterName}`;
    setAgentInstallCommand(command);

    setShowCommandDialog(true);

    const newCluster = {
      id: Date.now().toString(),
      name: clusterName,
      agentConnected: false,
    };

    try {
      const existingClustersString = localStorage.getItem('clusters');
      let existingClusters = [];
      if (existingClustersString) {
        existingClusters = JSON.parse(existingClustersString);
      }
      const updatedClusters = [...existingClusters, newCluster];
      localStorage.setItem('clusters', JSON.stringify(updatedClusters));
      alert("클러스터가 등록되었습니다!");
    } catch (error) {
      console.error("Failed to save cluster to localStorage:", error);
      alert("클러스터 저장에 실패했습니다. 콘솔을 확인해주세요.");
    }
  };

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(agentInstallCommand);
    alert("명령어가 복사되었습니다!");
  };

  const handleClusterNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setClusterName(e.target.value);
    setIsDuplicateChecked(false);
  };

  const handlePrometheusUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPrometheusUrl(e.target.value);
    setToken('');
  };

  return (
    <div>
      <SidebarProvider>
        <AppSidebar />
        <SidebarToggleButton />

        <main className="flex-1 p-4 md:p-6">
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
                  <Button onClick={handleDuplicateCheck} variant="outline" disabled={clusterName.trim() === '' || isLoading}>
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
                <div className="mt-1 flex space-x-2">
                  <Input
                    id="token"
                    type="text"
                    value={token}
                    readOnly
                    className="flex-1"
                  />
                  <Button onClick={handleGenerateToken} variant="outline" disabled={clusterName.trim() === '' || prometheusUrl.trim() === '' || isLoading}>
                    토큰 생성
                  </Button>
                </div>
              </div>

              <div className="flex justify-center">
                <Button onClick={handleRegisterCluster} disabled={isLoading || clusterName.trim() === '' || prometheusUrl.trim() === '' || token.trim() === '' || !isDuplicateChecked}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      로딩 중...
                    </>
                  ) : (
                    "등록하기"
                  )}
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