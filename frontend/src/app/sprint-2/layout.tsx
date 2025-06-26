// frontend/src/app/sprint-2/layout.tsx
'use client';

import { usePathname } from 'next/navigation';
import ClientDashboardLayout from '@/components/ClientDashboardLayout';

export default function Sprint2Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname();
  
  // Don't use dashboard layout for login page
  if (pathname === '/sprint-2/login-client') {
    return <>{children}</>;
  }
  
  return <ClientDashboardLayout>{children}</ClientDashboardLayout>;
}