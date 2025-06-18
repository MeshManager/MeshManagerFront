import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // S3 정적 호스팅을 위해 standalone 모드 사용
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  // 환경 변수 설정
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
    // 백엔드 API 엔드포인트들 - 실제 배포할 때 이 주소들을 변경하세요
    NEXT_PUBLIC_BACKEND_API_URL_CLUSTER: process.env.NEXT_PUBLIC_BACKEND_API_URL_CLUSTER || 'http://your-backend-cluster-service:8082',
    NEXT_PUBLIC_BACKEND_API_URL_AGENT: process.env.NEXT_PUBLIC_BACKEND_API_URL_AGENT || 'http://your-backend-agent-service:8081',
    NEXT_PUBLIC_BACKEND_API_URL_MANAGEMENT: process.env.NEXT_PUBLIC_BACKEND_API_URL_MANAGEMENT || 'http://your-backend-management-service:8083',
    NEXT_PUBLIC_BACKEND_API_URL_CRD: process.env.NEXT_PUBLIC_BACKEND_API_URL_CRD || 'http://your-backend-crd-service:8084',
  },
  // 동적 라우팅 허용을 위한 설정
  distDir: 'out',
};

export default nextConfig;
