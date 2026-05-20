'use client';

import { useEffect, useState } from 'react';
import { djangoClient } from '@/lib/django-client';

export interface CurrentUser {
  id: number;
  email: string;
  role: 'admin' | 'magasin' | 'employer';
  full_name: string;
  is_confirmed: boolean;
  phone?: string;
  company_name?: string;
  shop_name?: string;
  magasin_id?: number;
  position?: string;
  store_id?: number | null;
  store_name?: string | null;
  store_logo?: string | null;
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        if (!djangoClient.isAuthenticated()) {
          setUser(null);
          setLoading(false);
          return;
        }
        const data = await djangoClient.get<any>('/users/me/');
        setUser({
          id: data.id,
          email: data.email,
          role: data.role,
          full_name: data.full_name || data.username || '',
          is_confirmed: data.is_confirmed,
          phone: data.phone || undefined,
          company_name: data.company_name || undefined,
          shop_name: data.shop_name || undefined,
          magasin_id: data.magasin_id || undefined,
          position: data.position || undefined,
          store_id: data.magasin_id ?? null,
          store_name: data.shop_name ?? null,
          store_logo: null,
        });
      } catch (err) {
        console.error('Error fetching current user:', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const role = user?.role;
  return {
    user,
    loading,
    isAdmin: role === 'admin',
    isMagasin: role === 'magasin',
    isEmployer: role === 'employer',
    isSuperAdmin: role === 'admin',
    isAdminOrSuperAdmin: role === 'admin' || role === 'magasin',
    isManager: role === 'admin' || role === 'magasin',
  };
}
