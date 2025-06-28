'use client';

import React, { createContext, useState, useContext, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, auth } from '@/lib/api';

interface User {
  id: number;
  name: string;
  walletAddress: string;
  email?: string;
  createdAt: string;
  ownedProducts?: number;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
  login: async () => ({ success: false }),
  logout: async () => {},
  checkAuth: async () => {},
  isAuthenticated: false,
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Check if user is authenticated on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      setLoading(true);
      
      // Check if we have auth data in localStorage
      const token = auth.getToken();
      const clientData = auth.getClientData();
      
      if (token && clientData) {
        // We have stored auth data, use it
        setUser(clientData);
      } else {
        // No auth data
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string) => {
    try {
      setError(null);
      setLoading(true);
      
      // Use the biometric login with email endpoint
      const response = await api.biometricLoginEmail(email);
      
      if (response.success && response.token && response.client) {
        // Store auth data
        auth.setAuth(response.token, response.client);
        
        // Set user in state
        setUser(response.client);
        
        // Navigate to vault
        router.push('/sprint-2/vault-client');
        
        return { success: true };
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Authentication failed. Please check your email.';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Call logout endpoint (optional - it works even without token)
      await api.logout().catch(() => {
        // Ignore errors - we're logging out anyway
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local auth data
      auth.clearAuth();
      setUser(null);
      
      // Redirect to login
      router.push('/sprint-2/login-client');
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    error,
    login,
    logout,
    checkAuth,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}