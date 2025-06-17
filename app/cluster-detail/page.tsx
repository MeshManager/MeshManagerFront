'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

interface NamespaceListResponse {
  namespaces: string[];
}

interface ServiceNameListResponse {
  serviceNames: string[];
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

export default function ClusterDetailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const uuid = searchParams.get('clusterId');
  
  const [clusterDetail, setClusterDetail] = useState<ClusterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState<string>('');
  const [selectedService, setSelectedService] = useState<string>('');

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

  useEffect(() => {
    const fetchNamespaces = async () => {
      if (!uuid) return;
      
      try {
        const apiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL_CLUSTER || 'http://localhost:8082';
        const response = await fetch(`${apiUrl}/api/v1/cluster/namespaces?clusterId=${uuid}`);
        if (!response.ok) throw new Error('네임스페이스 목록을 불러오는데 실패했습니다.');
        
        const data: NamespaceListResponse = await response.json();
        setNamespaces(data.namespaces);
        if (data.namespaces.length > 0) {
          setSelectedNamespace(data.namespaces[0]);
        }
      } catch (error) {
        console.error('네임스페이스 목록을 불러오는데 실패했습니다:', error);
      }
    };

    fetchNamespaces();
  }, [uuid]);

  useEffect(() => {
    const fetchServices = async () => {
      if (!uuid || !selectedNamespace) return;
      
      try {
        const apiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL_CLUSTER || 'http://localhost:8082';
        const response = await fetch(`${apiUrl}/api/v1/cluster/services?clusterId=${uuid}&namespace=${selectedNamespace}`);
        if (!response.ok) throw new Error('서비스 목록을 불러오는데 실패했습니다.');
        
        const data: ServiceNameListResponse = await response.json();
        setServices(data.serviceNames);
        if (data.serviceNames.length > 0) {
          setSelectedService(data.serviceNames[0]);
        }
      } catch (error) {
        console.error('서비스 목록을 불러오는데 실패했습니다:', error);
      }
    };

    fetchServices();
  }, [uuid, selectedNamespace]);

  useEffect(() => {
    const fetchResources = async () => {
      if (!uuid || !selectedNamespace || !selectedService) return;
      
      try {
        const apiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL_CLUSTER || 'http://localhost:8082';
        const response = await fetch(`${apiUrl}/api/v1/cluster/deployments?clusterId=${uuid}&namespace=${selectedNamespace}&serviceName=${selectedService}`);
        if (!response.ok) throw new Error('디플로이먼트 정보를 불러오는데 실패했습니다.');
        
        const data: DeploymentListResponse = await response.json();
        
        if (data.data.length > 0) {
          const deployment = data.data[0];
          setClusterDetail(prev => prev ? {
            ...prev,
            containers: deployment.containers,
            podLabels: deployment.podLabels,
            replicaCount: deployment.replicas
          } : null);
        }
      } catch (error) {
        console.error('디플로이먼트 정보를 불러오는데 실패했습니다:', error);
      }
    };

    fetchResources();
  }, [uuid, selectedNamespace, selectedService]);

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
          <CardTitle>클러스터: {clusterDetail.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p><strong>Name:</strong> {clusterDetail.name}</p>
          <p><strong>Token:</strong> {clusterDetail.token}</p>
          <p><strong>Prometheus URL:</strong> {clusterDetail.prometheusUrl}</p>
          <hr style={{ margin: '30px 0' }}/>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">네임스페이스</label>
              <Select value={selectedNamespace} onValueChange={setSelectedNamespace}>
                <SelectTrigger>
                  <SelectValue placeholder="네임스페이스를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {namespaces.map((namespace) => (
                    <SelectItem key={namespace} value={namespace}>
                      {namespace}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">서비스</label>
              <Select value={selectedService} onValueChange={setSelectedService}>
                <SelectTrigger>
                  <SelectValue placeholder="서비스를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service} value={service}>
                      {service}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {clusterDetail.containers && clusterDetail.containers.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mt-4 mb-2">컨테이너 정보</h3>
              <ul className="list-disc pl-5 space-y-1">
                {clusterDetail.containers.map((container, index) => (
                  <React.Fragment key={index}>
                    <li>이름: {container.name}</li>
                    <li>이미지: {container.image}</li>
                  </React.Fragment>
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
            <Button style={{ marginTop: '50px' }}>목록으로 돌아가기</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
} 