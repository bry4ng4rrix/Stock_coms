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
      const response = await fetch(`${API_BASE_URL}/users/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: this.tokens.refresh }),
      })

      if (!response.ok) {
        this.clearTokensFromStorage()
        window.location.href = '/users/login'
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
    register: async (
      email: string,
      username: string,
      password: string,
      role: string,
      extraData?: {
        full_name?: string
        company_name?: string
        shop_name?: string
        admin_email?: string
        position?: string
      }
    ) => {
      let backendRole = role
      if (role === 'store_manager') backendRole = 'magasin'
      if (role === 'employee') backendRole = 'employer'

      return this.post<any>('/users/register/', {
        email,
        username,
        password,
        role: backendRole,
        full_name: extraData?.full_name || username,
        ...extraData,
      })
    },

    login: async (email: string, password: string) => {
      // Backend SimpleJWT expects 'username' and 'password'
      const response = await this.post<{ access: string; refresh: string }>('/users/login/', {
        username: email,
        password,
      })
      this.saveTokensToStorage({ access: response.access, refresh: response.refresh })
      
      // Fetch complete user profile immediately
      const user = await this.getCurrentUser()
      
      return {
        access: response.access,
        refresh: response.refresh,
        user,
      } as unknown as AuthResponse
    },

    logout: () => {
      this.clearTokensFromStorage()
    },

    getCurrentUser: async () => {
      const response = await this.get<any>('/users/me/')
      // Map role from backend value if necessary
      let mappedRole: 'admin' | 'store_manager' | 'employee' = 'employee'
      if (response.role === 'admin') mappedRole = 'admin'
      else if (response.role === 'magasin') mappedRole = 'store_manager'
      else if (response.role === 'employer') mappedRole = 'employee'

      return {
        id: response.id,
        email: response.email,
        username: response.username,
        first_name: response.full_name?.split(' ')[0] || '',
        last_name: response.full_name?.split(' ').slice(1).join(' ') || '',
        role: mappedRole,
        is_approved: response.is_confirmed,
      } as any
    },

    approveUser: async (userId: number) => {
      return this.put(`/users/approve/${userId}/`)
    },

    rejectUser: async (userId: number) => {
      // Fallback stub: backend doesn't have a direct reject endpoint, but can delete/reject if needed
      return this.post(`/users/reject/${userId}/`)
    },

    getPendingUsers: async () => {
      return this.get<any[]>('/users/pending-users/')
    },
  }

  // ==================== Products Service ====================
  products = {
    list: async (filters?: { store_id?: number; category?: string }) => {
      const params = new URLSearchParams()
      if (filters?.store_id) params.append('store_id', filters.store_id.toString())
      if (filters?.category) params.append('category', filters.category)
      const query = params.toString() ? `?${params.toString()}` : ''
      return this.get<any[]>(`/users/products/${query}`)
    },

    getById: async (id: number) => {
      return this.get<any>(`/users/products/${id}/`)
    },

    create: async (data: any) => {
      return this.post<any>('/users/products/', data)
    },

    update: async (id: number, data: any) => {
      return this.put<any>(`/users/products/${id}/`, data)
    },

    delete: async (id: number) => {
      return this.delete(`/users/products/${id}/`)
    },

    search: async (query: string) => {
      return this.get<any[]>(`/users/products/?search=${encodeURIComponent(query)}`)
    },
  }

  // ==================== Sales Service ====================
  sales = {
    create: async (data: any) => {
      return this.post<any>('/users/sales/', data)
    },

    list: async (filters?: { store_id?: number; date_range?: string }) => {
      const params = new URLSearchParams()
      if (filters?.store_id) params.append('store_id', filters.store_id.toString())
      if (filters?.date_range) params.append('date_range', filters.date_range)
      const query = params.toString() ? `?${params.toString()}` : ''
      return this.get<any[]>(`/users/sales/${query}`)
    },

    getById: async (id: number) => {
      return this.get<any>(`/users/sales/${id}/`)
    },

    update: async (id: number, data: any) => {
      return this.put<any>(`/users/sales/${id}/`, data)
    },

    delete: async (id: number) => {
      return this.delete(`/users/sales/${id}/`)
    },

    getByStore: async (storeId: number) => {
      return this.get<any[]>(`/users/sales/?store_id=${storeId}`)
    },

    getRevenueSummary: async (storeId?: number) => {
      const [totals, profit] = await Promise.all([
        this.get<any>('/users/sales/totals/'),
        this.get<any>('/users/sales/profit/'),
      ])
      return {
        ...totals,
        ...profit,
      }
    },
  }

  // ==================== Users Service ====================
  users = {
    list: async (role?: string) => {
      return this.get<any[]>('/users/magasins/users/')
    },

    getById: async (id: number) => {
      return this.get<any>(`/users/me/`)
    },

    update: async (id: number, data: any) => {
      return this.put<any>(`/users/role/${id}/`, data)
    },

    delete: async (id: number) => {
      // backend standard user deletion via standard views
      return this.delete(`/users/delete/${id}/`)
    },

    updateProfile: async (data: any) => {
      return this.patch<any>('/users/me/', data)
    },

    getEmployeesByStore: async (storeId: number) => {
      const list = await this.get<any[]>('/users/magasins/users/')
      const found = list.find((m: any) => m.magasin_id === storeId)
      return found ? found.employers : []
    },
  }

  // ==================== Dashboard Service ====================
  dashboard = {
    getStats: async (storeId?: number) => {
      const res = await this.get<any>('/users/dashboard/')
      return res.kpis
    },

    getTopProducts: async (storeId?: number, limit: number = 5) => {
      const res = await this.get<any>('/users/dashboard/')
      return res.lists?.top_products || []
    },

    getRevenueChart: async (storeId?: number, period: string = 'monthly') => {
      const res = await this.get<any>('/users/dashboard/')
      return res.lists?.recent_sales || []
    },

    getSalesAnalytics: async (storeId?: number) => {
      return this.get<any>('/users/dashboard/')
    },
  }

  // ==================== Stores Service ====================
  stores = {
    list: async () => {
      return this.get<any[]>('/users/magasins/users/')
    },

    getById: async (id: number) => {
      const list = await this.list()
      return list.find((m: any) => m.magasin_id === id) || null
    },

    create: async (data: any) => {
      return this.post<any>('/users/magasins/users/', data)
    },

    update: async (id: number, data: any) => {
      return this.put<any>(`/users/magasins/users/${id}/`, data)
    },

    delete: async (id: number) => {
      return this.delete(`/users/magasins/users/${id}/`)
    },

    getStoreByManager: async (managerId: number) => {
      const list = await this.list()
      return list.find((m: any) => m.manager?.id === managerId) || null
    },
  }

  // ==================== Suppliers Service ====================
  suppliers = {
    list: async () => {
      return []
    },

    getById: async (id: number) => {
      return null
    },

    create: async (data: any) => {
      return {}
    },

    update: async (id: number, data: any) => {
      return {}
    },

    delete: async (id: number) => {
      return {}
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

