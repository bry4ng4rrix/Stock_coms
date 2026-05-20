# Django Backend Integration - Documentation Technique Complète

## 1. Vue d'ensemble de l'Architecture

### Stack Technique
- **Frontend:** Next.js 16 (React 19) + TypeScript
- **Backend:** Django + Django REST Framework
- **Authentification:** JWT (JSON Web Tokens)
- **Base de Données:** PostgreSQL (côté Django)
- **API Base URL:** `http://localhost:8000/api/users/`

### Flux de Données
```
Client (Next.js)
    ↓
HTTP Request + JWT Token
    ↓
Django API (/api/users/*)
    ↓
Django REST Framework (Permissions + Serializers)
    ↓
Django Models + PostgreSQL
    ↓
Response JSON
    ↓
Client (Next.js) - Mise à jour de l'état
```

---

## 2. Configuration du Client Django

### 2.1 Fichier: `lib/api/django-client.ts`

```typescript
import { toast } from '@/components/ui/sonner';

interface RequestOptions extends RequestInit {
  timeout?: number;
}

interface APIResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
  detail?: string;
}

class DjangoAPIClient {
  private baseURL: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenRefreshPromise: Promise<string> | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.loadTokens();
  }

  // Charger les tokens depuis le stockage
  private loadTokens(): void {
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('access_token');
      this.refreshToken = localStorage.getItem('refresh_token');
    }
  }

  // Sauvegarder les tokens
  setTokens(access: string, refresh: string): void {
    this.accessToken = access;
    this.refreshToken = refresh;
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
    }
  }

  // Récupérer le token d'accès
  getAccessToken(): string | null {
    return this.accessToken;
  }

  // Supprimer les tokens (logout)
  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  }

  // Vérifier si le token est expiré (basique)
  private isTokenExpired(token: string | null): boolean {
    if (!token) return true;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return true;
      
      const decoded = JSON.parse(
        atob(parts[1])
      );
      const exp = decoded.exp;
      if (!exp) return false;
      
      return Date.now() >= exp * 1000;
    } catch {
      return true;
    }
  }

  // Renouveler le token d'accès
  private async refreshAccessToken(): Promise<string> {
    // Éviter les appels concurrents
    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }

    this.tokenRefreshPromise = (async () => {
      try {
        const response = await fetch(`${this.baseURL}/refresh/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            refresh: this.refreshToken,
          }),
        });

        if (!response.ok) {
          throw new Error('Token refresh failed');
        }

        const data = await response.json();
        this.accessToken = data.access;
        
        if (typeof window !== 'undefined') {
          localStorage.setItem('access_token', data.access);
        }

        return data.access;
      } catch (error) {
        console.error('Token refresh error:', error);
        this.clearTokens();
        // Rediriger vers la connexion
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        throw error;
      } finally {
        this.tokenRefreshPromise = null;
      }
    })();

    return this.tokenRefreshPromise;
  }

  // Préparer les en-têtes de requête
  private getHeaders(options?: RequestInit): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };

    if (this.accessToken) {
      (headers as any)['Authorization'] = `Bearer ${this.accessToken}`;
    }

    return headers;
  }

  // Effectuer une requête
  private async request<T>(
    endpoint: string,
    options?: RequestOptions
  ): Promise<APIResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    const timeout = options?.timeout || 30000;

    try {
      // Renouveler le token si expiré
      if (this.isTokenExpired(this.accessToken) && this.refreshToken) {
        try {
          await this.refreshAccessToken();
        } catch {
          return {
            error: 'Authentication failed',
          };
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...options,
        headers: this.getHeaders(options),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Gestion des codes de statut
      if (response.status === 401) {
        // Token expiré, essayer de le renouveler
        if (this.refreshToken) {
          try {
            await this.refreshAccessToken();
            return this.request<T>(endpoint, options);
          } catch {
            this.clearTokens();
            return { error: 'Session expired. Please login again.' };
          }
        }
        return { error: 'Unauthorized' };
      }

      if (response.status === 403) {
        return { error: 'Permission denied' };
      }

      if (response.status === 404) {
        return { error: 'Not found' };
      }

      const data = await response.json();

      if (!response.ok) {
        return {
          error: data.detail || data.error || data.message || 'Request failed',
          ...data,
        };
      }

      return { data };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return { error: 'Request timeout' };
      }

      return {
        error: error.message || 'Network error',
      };
    }
  }

  // GET
  async get<T>(endpoint: string, options?: RequestOptions): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'GET',
    });
  }

  // POST
  async post<T>(
    endpoint: string,
    body?: any,
    options?: RequestOptions
  ): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  // PATCH
  async patch<T>(
    endpoint: string,
    body?: any,
    options?: RequestOptions
  ): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  // PUT
  async put<T>(
    endpoint: string,
    body?: any,
    options?: RequestOptions
  ): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  // DELETE
  async delete<T>(endpoint: string, options?: RequestOptions): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'DELETE',
    });
  }
}

// Instance globale
const djangoClient = new DjangoAPIClient(
  process.env.NEXT_PUBLIC_DJANGO_API_URL || 'http://localhost:8000/api/users'
);

export default djangoClient;
```

### 2.2 Fichier: `lib/api/endpoints.ts`

```typescript
import { z } from 'zod';

// Types d'authentification
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
}

export interface RefreshRequest {
  refresh: string;
}

export interface RefreshResponse {
  access: string;
}

export interface RegisterRequest {
  full_name: string;
  email: string;
  password: string;
  phone?: string;
  role: 'admin' | 'magasin' | 'employer';
  company_name?: string;
  shop_name?: string;
  position?: string;
  admin_email?: string;
}

export interface CurrentUserResponse {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'magasin' | 'employer';
  is_confirmed: boolean;
}

// Types de produit
export interface Product {
  id: number;
  name: string;
  reference: string;
  brand: string;
  category: string;
  description: string;
  unit_price?: number; // Masqué pour magasin/employer
  shell_price: number;
  initial_quantity: number;
  alert_threshold: number;
  expiry_date: string;
  created_at: string;
  updated_at: string;
  magasin: number;
}

export interface CreateProductRequest {
  name: string;
  reference: string;
  brand: string;
  category: string;
  description: string;
  unit_price: number;
  shell_price: number;
  initial_quantity: number;
  alert_threshold: number;
  expiry_date: string;
  magasin?: number; // Optionnel pour magasin (défini automatiquement)
}

// Types de vente
export interface Sale {
  id: number;
  product: number;
  magasin: number;
  shop_name: string;
  seller: number;
  seller_name: string;
  quantity: number;
  sale_price: number;
  total_price: number;
  sold_at: string;
}

export interface CreateSaleRequest {
  product: number;
  quantity: number;
  sale_price: number;
}

export interface SalesTotal {
  total_unit_price: number;
  total_shell_price: number;
}

export interface Profit {
  profit: number;
}

// Types de magasin et utilisateurs
export interface EmployerInfo {
  id: number;
  full_name: string;
  email: string;
  is_confirmed: boolean;
  position: string;
  role: string;
}

export interface MagasinManager {
  id: number;
  full_name: string;
  email: string;
  is_confirmed: boolean;
  role: string;
}

export interface MagasinUsers {
  magasin_id: number;
  shop_name: string;
  manager: MagasinManager;
  employers: EmployerInfo[];
}

// Types de dashboard
export interface DashboardAdmin {
  role: 'admin';
  kpis: {
    total_revenue: number;
    total_profit: number;
    total_stock_value: number;
    total_magasins: number;
    total_employers: number;
    total_products: number;
    total_sales: number;
    sales_today: number;
    profit_today: number;
    low_stock_count: number;
    expired_count: number;
    expiring_soon_count: number;
  };
  lists: {
    top_products: Array<{
      product__name: string;
      product__magasin__shop_name: string;
      qty_sold: number;
      profit: number;
    }>;
    bottom_products: Array<{
      name: string;
      initial_quantity: number;
      qty_sold: number;
    }>;
    low_stock_products: Array<{
      name: string;
      initial_quantity: number;
      alert_threshold: number;
      magasin__shop_name: string;
    }>;
    expired_products: Array<{
      name: string;
      expiry_date: string;
      magasin__shop_name: string;
    }>;
    expiring_soon_products: Array<{
      name: string;
      expiry_date: string;
      magasin__shop_name: string;
    }>;
    recent_sales: Array<{
      product_name: string;
      quantity: number;
      sale_price: number;
      total_price: number;
      seller_name: string;
      shop_name: string;
      sold_at: string;
    }>;
    best_employees: Array<{
      seller__full_name: string;
      sales_count: number;
      total_amount: number;
      profit: number;
    }>;
    best_shops: Array<{
      magasin__shop_name: string;
      total_amount: number;
      profit: number;
      sales_count: number;
      total_stock: number;
    }>;
  };
}

export interface DashboardMagasin {
  role: 'magasin';
  kpis: {
    sales_today: number;
    profit_today: number;
    stock_value: number;
    total_products: number;
    total_sales: number;
    low_stock_count: number;
    expired_count: number;
  };
  lists: {
    top_products: Array<{
      product__name: string;
      qty_sold: number;
    }>;
    bottom_products: Array<{
      name: string;
      initial_quantity: number;
      qty_sold: number;
    }>;
    low_stock_products: Array<{
      name: string;
      initial_quantity: number;
    }>;
    recent_sales: Array<{
      product_name: string;
      quantity: number;
      total_price: number;
      seller_name: string;
      sold_at: string;
    }>;
    best_sellers: Array<{
      seller__full_name: string;
      sales_count: number;
      total_amount: number;
    }>;
  };
}

export interface DashboardEmployer {
  role: 'employer';
  kpis: {
    my_sales_today: number;
    total_amount_sold: number;
    products_sold_count: number;
    clients_count: number;
  };
  lists: {
    recent_sales: Array<{
      product_name: string;
      quantity: number;
      total_price: number;
      sold_at: string;
    }>;
  };
}

export type Dashboard = DashboardAdmin | DashboardMagasin | DashboardEmployer;

// Énumération des endpoints
export const ENDPOINTS = {
  AUTH: {
    LOGIN: '/login/',
    REGISTER: '/register/',
    REFRESH: '/refresh/',
    ME: '/me/',
    APPROVE: (userId: number) => `/approve/${userId}/`,
    CHANGE_ROLE: (userId: number) => `/role/${userId}/`,
  },
  PRODUCTS: {
    LIST: '/products/',
    CREATE: '/products/',
    GET: (id: number) => `/products/${id}/`,
    UPDATE: (id: number) => `/products/${id}/`,
    DELETE: (id: number) => `/products/${id}/`,
  },
  SALES: {
    LIST: '/sales/',
    CREATE: '/sales/',
    GET: (id: number) => `/sales/${id}/`,
    UPDATE: (id: number) => `/sales/${id}/`,
    DELETE: (id: number) => `/sales/${id}/`,
    TOTALS: '/sales/totals/',
    PROFIT: '/sales/profit/',
  },
  DASHBOARD: '/dashboard/',
  MAGASINS: {
    USERS: '/magasins/users/',
  },
  ENDPOINTS_LIST: '/endpoints/',
};

// Validations Zod
export const loginSchema = z.object({
  username: z.string().email(),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
  role: z.enum(['admin', 'magasin', 'employer']),
  company_name: z.string().optional(),
  shop_name: z.string().optional(),
  position: z.string().optional(),
  admin_email: z.string().email().optional(),
});

export const createProductSchema = z.object({
  name: z.string().min(1),
  reference: z.string().min(1),
  brand: z.string().min(1),
  category: z.string().min(1),
  description: z.string(),
  unit_price: z.number().positive(),
  shell_price: z.number().positive(),
  initial_quantity: z.number().int().positive(),
  alert_threshold: z.number().int().nonnegative(),
  expiry_date: z.string(),
  magasin: z.number().optional(),
});

export const createSaleSchema = z.object({
  product: z.number().int().positive(),
  quantity: z.number().int().positive(),
  sale_price: z.number().positive(),
});
```

---

## 3. Gestion de l'Authentification

### 3.1 Fichier: `lib/auth/django-auth.ts`

```typescript
import djangoClient from '@/lib/api/django-client';
import {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  CurrentUserResponse,
  ENDPOINTS,
} from '@/lib/api/endpoints';

class DjangoAuth {
  async login(email: string, password: string): Promise<LoginResponse | null> {
    const response = await djangoClient.post<LoginResponse>(
      ENDPOINTS.AUTH.LOGIN,
      {
        username: email,
        password,
      }
    );

    if (response.error || !response.data) {
      throw new Error(response.error || 'Login failed');
    }

    // Sauvegarder les tokens
    djangoClient.setTokens(response.data.access, response.data.refresh);

    return response.data;
  }

  async register(data: RegisterRequest): Promise<{ message: string } | null> {
    const response = await djangoClient.post<{ message: string }>(
      ENDPOINTS.AUTH.REGISTER,
      data
    );

    if (response.error) {
      throw new Error(response.error);
    }

    return response.data || { message: 'Registration successful' };
  }

  async getCurrentUser(): Promise<CurrentUserResponse | null> {
    const response = await djangoClient.get<CurrentUserResponse>(
      ENDPOINTS.AUTH.ME
    );

    if (response.error) {
      return null;
    }

    return response.data || null;
  }

  async logout(): Promise<void> {
    djangoClient.clearTokens();
  }

  isAuthenticated(): boolean {
    return djangoClient.getAccessToken() !== null;
  }
}

export const djangoAuth = new DjangoAuth();
```

### 3.2 Modifier: `lib/auth/useCurrentUser.ts`

Remplacer le code existant par:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { djangoAuth } from '@/lib/auth/django-auth';
import type { CurrentUserResponse } from '@/lib/api/endpoints';

export interface CurrentUser extends CurrentUserResponse {
  store_id?: string | null;
  store_name?: string | null;
  store_logo?: string | null;
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const authUser = await djangoAuth.getCurrentUser();
        if (!authUser) {
          setUser(null);
          setLoading(false);
          return;
        }

        setUser({
          ...authUser,
          store_id: null,
          store_name: null,
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

  return {
    user,
    loading,
    isAdmin: user?.role === 'admin',
    isMagasin: user?.role === 'magasin',
    isEmployer: user?.role === 'employer',
    isAdminOrMagasin: user?.role === 'admin' || user?.role === 'magasin',
    isApproved: user?.is_confirmed === true,
  };
}
```

---

## 4. Services Métier

### 4.1 Fichier: `lib/services/products-service.ts`

```typescript
import djangoClient from '@/lib/api/django-client';
import {
  Product,
  CreateProductRequest,
  ENDPOINTS,
} from '@/lib/api/endpoints';

export interface ProductFilters {
  magasin?: number;
  category?: string;
  brand?: string;
}

class ProductsService {
  async getProducts(filters?: ProductFilters) {
    let url = ENDPOINTS.PRODUCTS.LIST;
    if (filters) {
      const params = new URLSearchParams();
      if (filters.magasin) params.append('magasin', filters.magasin.toString());
      if (filters.category) params.append('category', filters.category);
      if (filters.brand) params.append('brand', filters.brand);
      if (params.toString()) {
        url += '?' + params.toString();
      }
    }

    const response = await djangoClient.get<Product[]>(url);
    if (response.error) throw new Error(response.error);
    return response.data || [];
  }

  async getProduct(id: number) {
    const response = await djangoClient.get<Product>(
      ENDPOINTS.PRODUCTS.GET(id)
    );
    if (response.error) throw new Error(response.error);
    return response.data;
  }

  async createProduct(data: CreateProductRequest) {
    const response = await djangoClient.post<Product>(
      ENDPOINTS.PRODUCTS.CREATE,
      data
    );
    if (response.error) throw new Error(response.error);
    return response.data;
  }

  async updateProduct(id: number, data: Partial<CreateProductRequest>) {
    const response = await djangoClient.patch<Product>(
      ENDPOINTS.PRODUCTS.UPDATE(id),
      data
    );
    if (response.error) throw new Error(response.error);
    return response.data;
  }

  async deleteProduct(id: number) {
    const response = await djangoClient.delete(ENDPOINTS.PRODUCTS.DELETE(id));
    if (response.error) throw new Error(response.error);
  }
}

export const productsService = new ProductsService();
```

### 4.2 Fichier: `lib/services/sales-service.ts`

```typescript
import djangoClient from '@/lib/api/django-client';
import {
  Sale,
  CreateSaleRequest,
  SalesTotal,
  Profit,
  MagasinUsers,
  ENDPOINTS,
} from '@/lib/api/endpoints';

export interface SalesFilters {
  product?: number;
  magasin?: number;
  seller?: number;
  ordering?: string;
}

class SalesService {
  async getSales(filters?: SalesFilters) {
    let url = ENDPOINTS.SALES.LIST;
    if (filters) {
      const params = new URLSearchParams();
      if (filters.product) params.append('product', filters.product.toString());
      if (filters.magasin) params.append('magasin', filters.magasin.toString());
      if (filters.seller) params.append('seller', filters.seller.toString());
      if (filters.ordering) params.append('ordering', filters.ordering);
      if (params.toString()) {
        url += '?' + params.toString();
      }
    }

    const response = await djangoClient.get<Sale[]>(url);
    if (response.error) throw new Error(response.error);
    return response.data || [];
  }

  async getSale(id: number) {
    const response = await djangoClient.get<Sale>(ENDPOINTS.SALES.GET(id));
    if (response.error) throw new Error(response.error);
    return response.data;
  }

  async createSale(data: CreateSaleRequest) {
    const response = await djangoClient.post<Sale>(
      ENDPOINTS.SALES.CREATE,
      data
    );
    if (response.error) throw new Error(response.error);
    return response.data;
  }

  async updateSale(id: number, data: Partial<CreateSaleRequest>) {
    const response = await djangoClient.patch<Sale>(
      ENDPOINTS.SALES.UPDATE(id),
      data
    );
    if (response.error) throw new Error(response.error);
    return response.data;
  }

  async deleteSale(id: number) {
    const response = await djangoClient.delete(ENDPOINTS.SALES.DELETE(id));
    if (response.error) throw new Error(response.error);
  }

  async getTotals() {
    const response = await djangoClient.get<SalesTotal>(
      ENDPOINTS.SALES.TOTALS
    );
    if (response.error) throw new Error(response.error);
    return response.data;
  }

  async getProfit() {
    const response = await djangoClient.get<Profit>(ENDPOINTS.SALES.PROFIT);
    if (response.error) throw new Error(response.error);
    return response.data;
  }

  async getMagasinUsers() {
    const response = await djangoClient.get<MagasinUsers[]>(
      ENDPOINTS.MAGASINS.USERS
    );
    if (response.error) throw new Error(response.error);
    return response.data || [];
  }
}

export const salesService = new SalesService();
```

### 4.3 Fichier: `lib/services/dashboard-service.ts`

```typescript
import djangoClient from '@/lib/api/django-client';
import { Dashboard, ENDPOINTS } from '@/lib/api/endpoints';

class DashboardService {
  async getDashboard() {
    const response = await djangoClient.get<Dashboard>(ENDPOINTS.DASHBOARD);
    if (response.error) throw new Error(response.error);
    return response.data;
  }
}

export const dashboardService = new DashboardService();
```

---

## 5. Hooks Personnalisés

### 5.1 Fichier: `hooks/useDjangoAuth.ts`

```typescript
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { djangoAuth } from '@/lib/auth/django-auth';
import { useCurrentUser } from '@/lib/auth/useCurrentUser';
import type { RegisterRequest } from '@/lib/api/endpoints';

export function useDjangoAuth() {
  const router = useRouter();
  const { user, loading, isApproved } = useCurrentUser();
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await djangoAuth.login(email, password);
      const currentUser = await djangoAuth.getCurrentUser();

      if (currentUser?.is_confirmed) {
        router.push('/dashboard');
      } else {
        router.push('/pending-approval');
      }
    } catch (error: any) {
      setAuthError(error.message || 'Login failed');
    } finally {
      setAuthLoading(false);
    }
  }, [router]);

  const register = useCallback(async (data: RegisterRequest) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await djangoAuth.register(data);
      router.push('/pending-approval');
    } catch (error: any) {
      setAuthError(error.message || 'Registration failed');
    } finally {
      setAuthLoading(false);
    }
  }, [router]);

  const logout = useCallback(async () => {
    setAuthLoading(true);
    try {
      await djangoAuth.logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setAuthLoading(false);
    }
  }, [router]);

  return {
    user,
    loading: loading || authLoading,
    authError,
    isApproved,
    login,
    register,
    logout,
    isAuthenticated: !!user,
  };
}
```

---

## 6. Modification des Pages d'Authentification

### 6.1 Exemple: `app/login/page.tsx`

```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDjangoAuth } from '@/hooks/useDjangoAuth';
import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useDjangoAuth();

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  return (
    <main className="flex items-center justify-center min-h-screen">
      <LoginForm />
    </main>
  );
}
```

### 6.2 Exemple: `components/auth/login-form.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDjangoAuth } from '@/hooks/useDjangoAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';

export function LoginForm() {
  const router = useRouter();
  const { login, loading, authError } = useDjangoAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await login(email, password);
      toast.success('Login successful!');
    } catch (error: any) {
      toast.error(error.message || 'Login failed');
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-md space-y-4">
      {authError && (
        <div className="p-4 bg-red-100 text-red-600 rounded">
          {authError}
        </div>
      )}

      <Input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <Input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Logging in...' : 'Login'}
      </Button>
    </form>
  );
}
```

---

## 7. Gestion des Erreurs

### 7.1 Fichier: `lib/utils/error-handler.ts`

```typescript
export interface APIError {
  status: number;
  message: string;
  details?: any;
}

export function parseAPIError(error: any): APIError {
  if (error instanceof Response) {
    return {
      status: error.status,
      message: error.statusText,
    };
  }

  if (typeof error === 'string') {
    return {
      status: 0,
      message: error,
    };
  }

  if (error.message) {
    return {
      status: 0,
      message: error.message,
      details: error,
    };
  }

  return {
    status: 0,
    message: 'An unknown error occurred',
  };
}

export function getErrorMessage(error: any): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error.error) {
    return error.error;
  }

  if (error.detail) {
    return error.detail;
  }

  if (error.message) {
    return error.message;
  }

  return 'An error occurred';
}
```

---

## 8. Configuration de l'Environnement

### 8.1 `.env.local`

```env
# Django Backend
NEXT_PUBLIC_DJANGO_API_URL=http://localhost:8000/api/users

# À supprimer (anciennes variables Supabase)
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

---

## 9. Flux d'Authentification Détaillé

### Diagramme de flux

```
┌─────────────────────────────────────────────────────────────┐
│                        LOGIN FLOW                           │
└─────────────────────────────────────────────────────────────┘

1. Utilisateur entre email + password
2. POST /login/ (djangoAuth.login)
   ↓
3. Reçoit {access_token, refresh_token}
4. Stocker les tokens (localStorage)
5. GET /me/ (vérifier l'utilisateur)
   ↓
6. if (is_confirmed === true)
     → Rediriger vers /dashboard
   else
     → Rediriger vers /pending-approval

┌─────────────────────────────────────────────────────────────┐
│                    PROTECTED REQUEST FLOW                   │
└─────────────────────────────────────────────────────────────┘

1. Client fait une requête à l'API
   + Authorization: Bearer <access_token>
   ↓
2. Django vérifie le token
   ↓
3. if (token valid)
     → Répondre avec les données
   else if (token expired)
     → Retourner 401 Unauthorized
   else
     → Retourner 403 Forbidden

┌─────────────────────────────────────────────────────────────┐
│                   TOKEN REFRESH FLOW                        │
└─────────────────────────────────────────────────────────────┘

1. djangoClient détecte token expiré
2. POST /refresh/ avec {refresh_token}
   ↓
3. Reçoit nouveau {access_token}
4. Sauvegarder le token
5. Réessayer la requête originale
```

---

## 10. Checklist d'Intégration

- [ ] `.env.local` configuré avec `NEXT_PUBLIC_DJANGO_API_URL`
- [ ] `lib/api/django-client.ts` créé
- [ ] `lib/api/endpoints.ts` créé
- [ ] `lib/auth/django-auth.ts` créé
- [ ] `lib/auth/useCurrentUser.ts` modifié
- [ ] `hooks/useDjangoAuth.ts` créé
- [ ] `lib/services/products-service.ts` créé
- [ ] `lib/services/sales-service.ts` créé
- [ ] `lib/services/dashboard-service.ts` créé
- [ ] Pages d'authentification modifiées
- [ ] Page `pending-approval` créée
- [ ] Composants adaptés (masquer `unit_price` pour non-admin)
- [ ] Tests d'authentification réussis
- [ ] Tests des permissions par rôle réussis
- [ ] Gestion des erreurs implémentée

---

## 11. Ressources et Documentation

- **Endpoints complètes:** `endpoint-D5635.md`
- **Fonctionnalités métier:** `fonctionalite-ktrk1.md`
- **Data dashboard:** `dasboard-0rhpt.md`
- **Guide d'intégration:** `ajouter.md`

