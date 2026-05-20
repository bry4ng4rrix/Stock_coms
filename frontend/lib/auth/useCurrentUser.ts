'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export interface CurrentUser {
  id: string;
  email: string;
  role: string;
  full_name: string;
  status: string;
  store_id: string | null;
  store_name?: string | null;
  store_logo?: string | null;
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          setUser(null);
          setLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from('users')
          .select('role, full_name, status, store_id, stores(name, logo_url)')
          .eq('id', authUser.id)
          .maybeSingle();

        const storeData = (profile as any)?.stores;

        // Fallback to auth metadata if profile row missing or role not set
        const meta = authUser.user_metadata ?? {};
        const resolvedRole = profile?.role || meta.role || 'employer';

        setUser({
          id: authUser.id,
          email: authUser.email || '',
          role: resolvedRole,
          full_name: profile?.full_name || meta.full_name || '',
          status: profile?.status || meta.status || 'pending',
          store_id: profile?.store_id || null,
          store_name: storeData?.name || null,
          store_logo: storeData?.logo_url || null,
        });
      } catch (err) {
        console.error('Error fetching current user:', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [supabase]);

  return { 
    user, 
    loading, 
    isAdmin: user?.role?.toLowerCase() === 'admin',
    isSuperAdmin: user?.role?.toLowerCase() === 'superadmin',
    isAdminOrSuperAdmin: user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'superadmin',
    isManager: user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'magasinier'
  };
}
