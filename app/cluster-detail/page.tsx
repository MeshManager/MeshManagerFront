'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ContainerInfo {
  name: string;
  image: string;
}

interface ServiceInfo {
  name: string;
  clusterIp: string;
  type: string;
  selector: Record<string, string>;
}

interface ClusterDetail {
  uuid: string;
  name: string;
  prometheusUrl: string;
  token: string;
  namespace?: string;
  containers?: ContainerInfo[];
  podLabels?: Record<string, string>;
  replicaCount?: number;
  services?: ServiceInfo[];
}

function ClusterDetailContent() {
  const searchParams = useSearchParams();
  const uuid = searchParams.get('clusterId');
  
  const [clusterDetail, setClusterDetail] = useState<ClusterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uuid) {
      setError('클러스터 UUID가 제공되지 않았습니다.');
      setLoading(false);
      return;
    }

    const fetchClusterDetails = async () => {
      try {
        setLoading(true);
        const apiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL_CLUSTER || 'http://localhost:8082';
        const response = await fetch(`${apiUrl}/api/v1/cluster/${uuid}/details`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('클러스터를 찾을 수 없습니다.');
            return;
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data: ClusterDetail = await response.json();
        setClusterDetail(data);
      } catch (error) {
        console.error('클러스터 상세 정보를 불러오는데 실패했습니다:', error);
        setError('클러스터 정보를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchClusterDetails();
  }, [uuid]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>로딩 중...</CardTitle>
          </CardHeader>
          <CardContent>
            <p>클러스터 정보를 불러오고 있습니다...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !clusterDetail) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>오류</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error || '클러스터를 찾을 수 없습니다.'}</p>
            <Link href="/" passHref>
              <Button className="mt-4">목록으로 돌아가기</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>클러스터 상세 정보: {clusterDetail.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p><strong>UUID:</strong> {clusterDetail.uuid}</p>
          <p><strong>클러스터 이름:</strong> {clusterDetail.name}</p>
          <p><strong>Prometheus URL:</strong> {clusterDetail.prometheusUrl}</p>
          <p><strong>Token:</strong> {clusterDetail.token}</p>
          {clusterDetail.namespace && <p><strong>네임스페이스:</strong> {clusterDetail.namespace}</p>}
          {clusterDetail.replicaCount && <p><strong>Replica 수:</strong> {clusterDetail.replicaCount}</p>}

          {clusterDetail.containers && clusterDetail.containers.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mt-4 mb-2">컨테이너 정보</h3>
              <ul className="list-disc pl-5 space-y-1">
                {clusterDetail.containers.map((container, index) => (
                  <li key={index}>이름: {container.name}, 이미지: {container.image}</li>
                ))}
              </ul>
            </div>
          )}

          {clusterDetail.podLabels && Object.keys(clusterDetail.podLabels).length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mt-4 mb-2">Pod 라벨</h3>
              <ul className="list-disc pl-5 space-y-1">
                {Object.entries(clusterDetail.podLabels).map(([key, value]) => (
                  <li key={key}>{key}: {value}</li>
                ))}
              </ul>
            </div>
          )}

          {clusterDetail.services && clusterDetail.services.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mt-4 mb-2">Service 정보</h3>
              <ul className="list-disc pl-5 space-y-1">
                {clusterDetail.services.map((service, index) => (
                  <li key={index}>
                    이름: {service.name}, Cluster IP: {service.clusterIp}, 타입: {service.type},
                    Selector: {Object.entries(service.selector).map(([k, v]) => `${k}:${v}`).join(', ')}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Link href="/" passHref>
            <Button>목록으로 돌아가기</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ClusterDetailPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>로딩 중...</CardTitle>
          </CardHeader>
          <CardContent>
            <p>클러스터 정보를 불러오고 있습니다...</p>
          </CardContent>
        </Card>
      </div>
    }>
      <ClusterDetailContent />
    </Suspense>
  );
}