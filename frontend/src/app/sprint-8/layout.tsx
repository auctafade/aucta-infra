// frontend/src/app/sprint-8/layout.tsx
'use client';

import { usePathname } from 'next/navigation';
import LogisticsDashboardLayout from '@/components/LogisticsDashboardLayout';
import Sprint8StyleWrapper from '@/components/Sprint8StyleWrapper';

export default function Sprint8Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  return (
    <Sprint8StyleWrapper>
      <LogisticsDashboardLayout>{children}</LogisticsDashboardLayout>
    </Sprint8StyleWrapper>
  );
}
