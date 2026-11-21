import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, type Permissions, type User } from './api';

type PermissionKey = keyof Permissions;

const DEFAULTS: Record<PermissionKey, boolean> = {
  canChangeStatus: true,
  canEditRepairs: true,
  canManageClients: false,
  canCreateQuotes: false,
};

interface AuthValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  can: (permission: PermissionKey) => boolean;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await api.me();
      setUser(response.user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.login(email, password);
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    setUser(null);
  }, []);

  const can = useCallback(
    (permission: PermissionKey) => {
      if (!user) return false;
      if (user.role === 'ADMIN') return true;
      const value = user.permissions?.[permission];
      return typeof value === 'boolean' ? value : DEFAULTS[permission];
    },
    [user],
  );

  const value = useMemo<AuthValue>(
    () => ({ user, loading, login, logout, refresh, can }),
    [user, loading, login, logout, refresh, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return context;
}
