'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export function ClientRouter({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Static export 환경에서 새로고침 시 라우팅 처리
    const handleRouting = () => {
      if (typeof window === 'undefined') return;
      
      const currentPath = window.location.pathname;
      
      // 브라우저 URL과 Next.js pathname이 다르고, 메인페이지가 아닌 경우
      if (currentPath !== pathname && currentPath !== '/') {
        router.replace(currentPath);
      }
    };

    // DOM이 완전히 로드된 후 실행
    const timer = setTimeout(handleRouting, 100);
    
    return () => clearTimeout(timer);
  }, [router, pathname]);

  return <>{children}</>;
} 