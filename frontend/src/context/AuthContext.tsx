import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { login as authLogin } from '../features/auth/services/authService';
import { cacheManager } from '../utils/cacheManager';

export type Role = 'admin' | 'supervisor';

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  tenantId: string;
  tenantName: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** Tenant/company name resolved from the logged-in user */
  tenantName: string | null;
  role: Role | null;
  isLoading: boolean;
  /**
   * Attempt login with a tenant subdomain, username, and password.
   * Resolves the tenant first, then authenticates within that tenant's scope.
   * Throws an Error with a user-facing message on failure.
   */
  login: (tenant: string, username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = 'les_auth_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Rehydrate from localStorage on mount (persists session across refreshes)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setUser(JSON.parse(stored) as AuthUser);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (
    tenant: string,
    username: string,
    password: string
  ): Promise<void> => {
    const loggedInUser = await authLogin(tenant, username, password);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loggedInUser));
    cacheManager.clear();
    setUser(loggedInUser);
  };

  const logout = (): void => {
    localStorage.removeItem(STORAGE_KEY);
    cacheManager.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tenantName: user?.tenantName ?? null,
        role: user?.role ?? null,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
