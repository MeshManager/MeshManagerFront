import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // S3 정적 호스팅을 위해 standalone 모드 사용
  output: 'export',
  trailingSlash: false,
  images: {
    unoptimized: true
  },
  // 환경 변수 설정
  
  // 동적 라우팅 허용을 위한 설정
  distDir: 'out',
  
  // SPA 라우팅을 위한 설정
  skipMiddlewareUrlNormalize: true,
};

export default nextConfig;
