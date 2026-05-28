import React, { createContext, useContext, useState, useEffect } from 'react';

export interface Tenant {
  id: string;
  name: string;
  domain: string;
}

export interface UserProfile {
  id?: number;
  username: string;
  email: string;
  role: 'ADMIN' | 'CLIENT' | 'ANALYST' | 'AUDITOR';
  tenant?: Tenant | null;
  assigned_tenants?: Tenant[];
}

interface AuthContextType {
  user: UserProfile | null;
  tenants: Tenant[];
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => void;
  refreshTenants: () => void;
  refreshUsers: () => void;
  allUsers: UserProfile[];
  apiBase: string;
}

export const AuthContext = createContext<AuthContextType>({} as AuthContextType);
export const useAuth = () => useContext(AuthContext);

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    refreshTenants();
    const saved = localStorage.getItem('esg_session');
    if (saved) {
      try { setUser(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  const refreshTenants = () => {
    fetch(`${API_BASE}/tenants/`).then(r => r.json()).then(setTenants).catch(() => {});
  };

  const refreshUsers = () => {
    fetch(`${API_BASE}/admin/users/`).then(r => r.json()).then(setAllUsers).catch(() => {});
  };

  useEffect(() => { 
    if (user?.role === 'ADMIN') refreshUsers(); 
  }, [user]);

  const login = async (email: string, password: string): Promise<string | null> => {
    try {
      const res = await fetch(`${API_BASE}/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) {
        const d = await res.json();
        return d.error || 'Invalid credentials';
      }
      const data = await res.json();
      const profile: UserProfile = {
        id: data.id, username: data.username, email: data.email,
        role: data.role, tenant: data.tenant, assigned_tenants: data.assigned_tenants
      };
      setUser(profile);
      localStorage.setItem('esg_session', JSON.stringify(profile));
      return null;
    } catch {
      return 'Server unreachable. Is the backend running?';
    }
  };

  const logout = () => {
    fetch(`${API_BASE}/auth/logout/`, { method: 'POST' }).catch(() => {});
    setUser(null);
    localStorage.removeItem('esg_session');
  };

  return (
    <AuthContext.Provider value={{ user, tenants, login, logout, refreshTenants, refreshUsers, allUsers, apiBase: API_BASE }}>
      {children}
    </AuthContext.Provider>
  );
}
