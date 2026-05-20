'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function LogoutPage() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const logout = async () => {
      await supabase.auth.signOut();
      router.push('/login');
      router.refresh();
    };

    logout();
  }, [supabase, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">Déconnexion...</p>
    </div>
  );
}
