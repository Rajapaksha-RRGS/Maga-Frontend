import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { login as authLogin } from '../features/auth/services/authService';
import { cacheManager } from '../utils/cacheManager';
import { isTokenExpired, getTokenRemainingMs } from '../utils/token';

export type Role = 'super_admin' | 'admin' | 'supervisor';

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  tenantId: string;
  tenantName: string;
  token?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  tenantName: string | null;
  role: Role | null;
  isLoading: boolean;
  login: (tenant: string, username: string, password: string) => Promise<void>;
  logout: (reason?: 'expired' | 'manual') => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = 'les_auth_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = (reason?: 'expired' | 'manual'): void => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('token');
    cacheManager.clear();
    if (reason === 'expired' && typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/login?expired=1');
    }
    setUser(null);
  };

  // Rehydrate from localStorage on mount (persists session across refreshes)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const token = localStorage.getItem('token');
      if (stored) {
        const parsed = JSON.parse(stored) as AuthUser;
        const activeToken = parsed.token || token;

        if (isTokenExpired(activeToken)) {
          console.warn('Stored session token has expired. Clearing session.');
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem('token');
          cacheManager.clear();
          setUser(null);
        } else {
          setUser(parsed);
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('token');
      cacheManager.clear();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Timer to automatically log out when token expires in active session
  useEffect(() => {
    if (!user) return;
    const token = user.token || localStorage.getItem('token');
    const remainingMs = getTokenRemainingMs(token);

    if (remainingMs <= 0) {
      logout('expired');
      return;
    }

    const timer = setTimeout(() => {
      logout('expired');
    }, remainingMs);

    return () => clearTimeout(timer);
  }, [user]);

  const login = async (tenant: string, username: string, password: string): Promise<void> => {
    const loggedInUser = await authLogin(tenant, username, password);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loggedInUser));
    cacheManager.clear();
    setUser(loggedInUser);
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
