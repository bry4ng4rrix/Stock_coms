import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/users';

let axiosInstance: AxiosInstance;

export function getApiClient(): AxiosInstance {
  if (axiosInstance) {
    return axiosInstance;
  }

  axiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Add token to requests
  axiosInstance.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Handle token refresh
  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        const refreshToken = localStorage.getItem('refresh_token');

        if (refreshToken) {
          try {
            const response = await axios.post(`${API_BASE_URL}/refresh/`, {
              refresh: refreshToken,
            });

            const { access } = response.data;
            localStorage.setItem('access_token', access);
            originalRequest.headers.Authorization = `Bearer ${access}`;

            return axiosInstance(originalRequest);
          } catch (refreshError) {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            return Promise.reject(refreshError);
          }
        }
      }

      return Promise.reject(error);
    }
  );

  return axiosInstance;
}

// Fetcher for SWR
export const fetcher = (url: string) => getApiClient().get(url).then((res) => res.data);

// Authentication APIs
export const authAPI = {
  login: (email: string, password: string) =>
    getApiClient().post('/login/', { email, username: email, password }),
  
  refresh: (refresh_token: string) =>
    getApiClient().post('/refresh/', { refresh: refresh_token }),
  
  register: (data: any) =>
    getApiClient().post('/register/', data),
  
  getMe: () =>
    getApiClient().get('/me/'),
};

// User Management APIs
export const userAPI = {
  approve: (userId: number) =>
    getApiClient().put(`/approve/${userId}/`),
  
  updateRole: (userId: number, role: string) =>
    getApiClient().put(`/role/${userId}/`, { role }),
};

// Product APIs
export const productAPI = {
  list: (params?: any) =>
    getApiClient().get('/products/', { params }),
  
  create: (data: any) =>
    getApiClient().post('/products/', data),
  
  get: (id: number) =>
    getApiClient().get(`/products/${id}/`),
  
  update: (id: number, data: any) =>
    getApiClient().put(`/products/${id}/`, data),
  
  patch: (id: number, data: any) =>
    getApiClient().patch(`/products/${id}/`, data),
  
  delete: (id: number) =>
    getApiClient().delete(`/products/${id}/`),
};

// Sales APIs
export const salesAPI = {
  list: (params?: any) =>
    getApiClient().get('/sales/', { params }),
  
  create: (data: any) =>
    getApiClient().post('/sales/', data),
  
  get: (id: number) =>
    getApiClient().get(`/sales/${id}/`),
  
  update: (id: number, data: any) =>
    getApiClient().put(`/sales/${id}/`, data),
  
  patch: (id: number, data: any) =>
    getApiClient().patch(`/sales/${id}/`, data),
  
  delete: (id: number) =>
    getApiClient().delete(`/sales/${id}/`),
  
  getTotals: () =>
    getApiClient().get('/sales/totals/'),
  
  getProfit: () =>
    getApiClient().get('/sales/profit/'),
};

// Analytics APIs
export const analyticsAPI = {
  getMagazinsUsers: () =>
    getApiClient().get('/magasins/users/'),
  
  getDashboard: () =>
    getApiClient().get('/dashboard/'),
  
  getEndpoints: () =>
    getApiClient().get('/endpoints/'),
};
