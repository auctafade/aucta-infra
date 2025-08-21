'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PlanIndexPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the new start page
    router.replace('/sprint-8/logistics/plan/start');
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to quote creation...</p>
      </div>
    </div>
  );
}