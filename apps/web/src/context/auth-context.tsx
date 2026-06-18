'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string;
  branchId?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  tenantId: string;
  loading: boolean;
  login: (token: string, user: UserProfile, tenantId: string) => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
}

function setCookie(name: string, value: string, days = 7) {
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = `; expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value}${expires}; path=/`;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
}

function decodeJwt(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const decoded = JSON.parse(jsonPayload);
    return {
      id: decoded.sub,
      email: decoded.email,
      firstName: decoded.firstName,
      lastName: decoded.lastName,
      role: decoded.role,
      tenantId: decoded.tenantId,
      branchId: decoded.branchId,
    };
  } catch (e) {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [tenantId, setTenantId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = getCookie('sm_session');
    const savedTenant = getCookie('sm_tenant_id');

    if (token) {
      const decodedUser = decodeJwt(token);
      if (decodedUser) {
        setUser(decodedUser);
        setTenantId(decodedUser.tenantId);
      } else {
        // Clear corrupt session
        deleteCookie('sm_session');
      }
    }
    if (savedTenant) {
      setTenantId(savedTenant);
    }
    setLoading(false);
  }, []);

  const login = (token: string, userProfile: UserProfile, tenant: string) => {
    setCookie('sm_session', token);
    setCookie('sm_tenant_id', tenant);
    setUser(userProfile);
    setTenantId(tenant);
    router.replace('/dashboard');
  };

  const logout = () => {
    deleteCookie('sm_session');
    deleteCookie('sm_tenant_id');
    setUser(null);
    setTenantId('');
    router.replace('/login');
  };

  const hasPermission = (permission: string): boolean => {
    // Single User Mode: Unrestricted access to all UI modules/actions
    return true;
  };

  return (
    <AuthContext.Provider value={{ user, tenantId, loading, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
