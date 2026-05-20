'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { DashboardNav } from '@/components/dashboard-nav';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    // Redirect to role-specific dashboard
    switch (user.role) {
      case 'admin':
        router.push('/dashboard/admin');
        break;
      case 'magasin':
        router.push('/dashboard/magasin');
        break;
      case 'employer':
        router.push('/dashboard/employer');
        break;
      default:
        router.push('/login');
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen">
      <DashboardNav />
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
        <Spinner />
      </div>
    </div>
  );
}
