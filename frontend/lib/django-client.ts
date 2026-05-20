// Django Backend API Client with JWT Authentication
// Handles all API calls to Django backend with automatic token management

const API_BASE_URL = process.env.NEXT_PUBLIC_DJANGO_API_URL || 'http://localhost:8000/api'

interface AuthTokens {
  access: string
  refresh: string
}

interface AuthResponse {
  access: string
  refresh: string
  user: {
    id: number
    email: string
    username: string
    first_name: string
    last_name: string
    role: 'admin' | 'store_manager' | 'employee'
    is_approved: boolean
    store_id?: number
  }
}

interface ApiErrorResponse {
  detail?: string
  [key: string]: any
}

class DjangoAPIClient {
  private tokens: AuthTokens | null = null
  private isRefreshing = false
  private refreshQueue: Array<(token: string) => void> = []

  constructor() {
    this.loadTokensFromStorage()
  }

  // ==================== Token Management ====================
  private loadTokensFromStorage(): void {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem('django_tokens')
    if (stored) {
      try {
        this.tokens = JSON.parse(stored)
      } catch (e) {
        console.error('[v0] Failed to parse stored tokens')
      }
    }
  }

  private saveTokensToStorage(tokens: AuthTokens): void {
    if (typeof window === 'undefined') return
    this.tokens = tokens
    localStorage.setItem('django_tokens', JSON.stringify(tokens))
  }

  private clearTokensFromStorage(): void {
    if (typeof window === 'undefined') return
    this.tokens = null
    localStorage.removeItem('django_tokens')
  }

  private async refreshAccessToken(): Promise<string | null> {
    if (!this.tokens?.refresh) return null

    if (this.isRefreshing) {
      return new Promise((resolve) => {
        this.refreshQueue.push(resolve)
      })
    }

    this.isRefreshing = true

    try {
      const response = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: this.tokens.refresh }),
      })

      if (!response.ok) {
        this.clearTokensFromStorage()
        window.location.href = '/auth/login'
        return null
      }

      const data = await response.json()
      this.tokens = { ...this.tokens!, access: data.access }
      this.saveTokensToStorage(this.tokens)

      this.refreshQueue.forEach((callback) => callback(data.access))
      this.refreshQueue = []

      return data.access
    } catch (error) {
      console.error('[v0] Token refresh failed:', error)
      this.clearTokensFromStorage()
      return null
    } finally {
      this.isRefreshing = false
    }
  }

  private getAuthHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...(this.tokens?.access && { Authorization: `Bearer ${this.tokens.access}` }),
    }
  }

  // ==================== Core HTTP Methods ====================
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`
    const headers = this.getAuthHeaders()

    let response = await fetch(url, {
      ...options,
      headers: { ...headers, ...options.headers },
    })

    if (response.status === 401) {
      const newToken = await this.refreshAccessToken()
      if (!newToken) throw new Error('Authentication failed')

      response = await fetch(url, {
        ...options,
        headers: { ...this.getAuthHeaders(), ...options.headers },
      })
    }

    if (!response.ok) {
      const error = (await response.json()) as ApiErrorResponse
      throw new Error(error.detail || `API Error: ${response.status}`)
    }

    return response.json()
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' })
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }

  // ==================== Authentication Service ====================
  auth = {
    register: async (email: string, username: string, password: string, role: string) => {
      return this.post<AuthResponse>('/auth/register/', {
        email,
        username,
        password,
        role,
      })
    },

    login: async (email: string, password: string) => {
      const response = await this.post<AuthResponse>('/auth/login/', { email, password })
      this.saveTokensToStorage({ access: response.access, refresh: response.refresh })
      return response
    },

    logout: () => {
      this.clearTokensFromStorage()
    },

    getCurrentUser: async () => {
      return this.get<AuthResponse['user']>('/auth/me/')
    },

    approveUser: async (userId: number) => {
      return this.post(`/auth/users/${userId}/approve/`)
    },

    rejectUser: async (userId: number) => {
      return this.post(`/auth/users/${userId}/reject/`)
    },

    getPendingUsers: async () => {
      return this.get<any[]>('/auth/pending-users/')
    },
  }

  // ==================== Products Service ====================
  products = {
    list: async (filters?: { store_id?: number; category?: string }) => {
      const params = new URLSearchParams()
      if (filters?.store_id) params.append('store_id', filters.store_id.toString())
      if (filters?.category) params.append('category', filters.category)
      const query = params.toString() ? `?${params.toString()}` : ''
      return this.get<any[]>(`/products/${query}`)
    },

    getById: async (id: number) => {
      return this.get<any>(`/products/${id}/`)
    },

    create: async (data: any) => {
      return this.post<any>('/products/', data)
    },

    update: async (id: number, data: any) => {
      return this.put<any>(`/products/${id}/`, data)
    },

    delete: async (id: number) => {
      return this.delete(`/products/${id}/`)
    },

    search: async (query: string) => {
      return this.get<any[]>(`/products/search/?q=${encodeURIComponent(query)}`)
    },
  }

  // ==================== Sales Service ====================
  sales = {
    create: async (data: any) => {
      return this.post<any>('/sales/', data)
    },

    list: async (filters?: { store_id?: number; date_range?: string }) => {
      const params = new URLSearchParams()
      if (filters?.store_id) params.append('store_id', filters.store_id.toString())
      if (filters?.date_range) params.append('date_range', filters.date_range)
      const query = params.toString() ? `?${params.toString()}` : ''
      return this.get<any[]>(`/sales/${query}`)
    },

    getById: async (id: number) => {
      return this.get<any>(`/sales/${id}/`)
    },

    update: async (id: number, data: any) => {
      return this.put<any>(`/sales/${id}/`, data)
    },

    delete: async (id: number) => {
      return this.delete(`/sales/${id}/`)
    },

    getByStore: async (storeId: number) => {
      return this.get<any[]>(`/sales/?store_id=${storeId}`)
    },

    getRevenueSummary: async (storeId?: number) => {
      const endpoint = storeId ? `/sales/revenue/?store_id=${storeId}` : '/sales/revenue/'
      return this.get<any>(endpoint)
    },
  }

  // ==================== Users Service ====================
  users = {
    list: async (role?: string) => {
      const query = role ? `?role=${role}` : ''
      return this.get<any[]>(`/users/${query}`)
    },

    getById: async (id: number) => {
      return this.get<any>(`/users/${id}/`)
    },

    update: async (id: number, data: any) => {
      return this.put<any>(`/users/${id}/`, data)
    },

    delete: async (id: number) => {
      return this.delete(`/users/${id}/`)
    },

    updateProfile: async (data: any) => {
      return this.patch<any>('/users/me/', data)
    },

    getEmployeesByStore: async (storeId: number) => {
      return this.get<any[]>(`/users/?store_id=${storeId}&role=employee`)
    },
  }

  // ==================== Dashboard Service ====================
  dashboard = {
    getStats: async (storeId?: number) => {
      const endpoint = storeId ? `/dashboard/stats/?store_id=${storeId}` : '/dashboard/stats/'
      return this.get<any>(endpoint)
    },

    getTopProducts: async (storeId?: number, limit: number = 5) => {
      const endpoint = storeId
        ? `/dashboard/top-products/?store_id=${storeId}&limit=${limit}`
        : `/dashboard/top-products/?limit=${limit}`
      return this.get<any[]>(endpoint)
    },

    getRevenueChart: async (storeId?: number, period: string = 'monthly') => {
      const endpoint = storeId
        ? `/dashboard/revenue/?store_id=${storeId}&period=${period}`
        : `/dashboard/revenue/?period=${period}`
      return this.get<any>(endpoint)
    },

    getSalesAnalytics: async (storeId?: number) => {
      const endpoint = storeId ? `/dashboard/analytics/?store_id=${storeId}` : '/dashboard/analytics/'
      return this.get<any>(endpoint)
    },
  }

  // ==================== Stores Service ====================
  stores = {
    list: async () => {
      return this.get<any[]>('/stores/')
    },

    getById: async (id: number) => {
      return this.get<any>(`/stores/${id}/`)
    },

    create: async (data: any) => {
      return this.post<any>('/stores/', data)
    },

    update: async (id: number, data: any) => {
      return this.put<any>(`/stores/${id}/`, data)
    },

    delete: async (id: number) => {
      return this.delete(`/stores/${id}/`)
    },

    getStoreByManager: async (managerId: number) => {
      return this.get<any>(`/stores/?manager_id=${managerId}`)
    },
  }

  // ==================== Suppliers Service ====================
  suppliers = {
    list: async () => {
      return this.get<any[]>('/suppliers/')
    },

    getById: async (id: number) => {
      return this.get<any>(`/suppliers/${id}/`)
    },

    create: async (data: any) => {
      return this.post<any>('/suppliers/', data)
    },

    update: async (id: number, data: any) => {
      return this.put<any>(`/suppliers/${id}/`, data)
    },

    delete: async (id: number) => {
      return this.delete(`/suppliers/${id}/`)
    },
  }

  // ==================== Token Status ====================
  isAuthenticated(): boolean {
    return !!this.tokens?.access
  }

  getAccessToken(): string | null {
    return this.tokens?.access || null
  }
}

export const djangoClient = new DjangoAPIClient()
export type { AuthResponse, AuthTokens }
