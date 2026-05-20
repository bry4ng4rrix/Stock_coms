'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';

export type UserRole = 'admin' | 'magasin' | 'employer';

export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  is_confirmed: boolean;
  full_name?: string;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  getToken: () => string | null;
  hasRole: (role: UserRole | UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/users';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          const response = await axios.get(`${API_BASE_URL}/me/`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setUser(response.data);
        } catch (error) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/login/`, {
        email,
        username: email,
        password,
      });

      const { access, refresh } = response.data;
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);

      // Fetch user data
      const userResponse = await axios.get(`${API_BASE_URL}/me/`, {
        headers: { Authorization: `Bearer ${access}` },
      });
      setUser(userResponse.data);
    } catch (error) {
      throw new Error('Login failed');
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  };

  const getToken = () => localStorage.getItem('access_token');

  const hasRole = (role: UserRole | UserRole[]) => {
    if (!user) return false;
    const roles = Array.isArray(role) ? role : [role];
    return roles.includes(user.role);
  };

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
    getToken,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
