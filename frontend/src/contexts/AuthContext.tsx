import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export type AuthRole =
  | 'parent' | 'student' | 'campus_student' | 'job_seeker'
  | 'institute' | 'school' | 'college'
  | 'mentor' | 'hr_recruiter' | 'ld_manager'
  | 'ngo' | 'super_admin';

export interface AuthUser {
  id: string;
  fullName?: string;
  mobile?: string;
  email?: string;
  role: AuthRole;
  roles: AuthRole[];
  isVerified: boolean;
  profilePicture?: string;
  dashboardTarget: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const TOKEN_KEY = 'metryx_token';
const USER_KEY  = 'metryx_user';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const user  = localStorage.getItem(USER_KEY);
      return {
        token,
        user: user ? (JSON.parse(user) as AuthUser) : null,
        isLoading: !!token,
        isAuthenticated: false,
      };
    } catch {
      return { token: null, user: null, isLoading: false, isAuthenticated: false };
    }
  });

  const login = useCallback((token: string, user: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setState({ token, user, isLoading: false, isAuthenticated: true });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setState({ token: null, user: null, isLoading: false, isAuthenticated: false });
    fetch('/api/logout', { method: 'POST' }).catch(() => {});
  }, []);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setState(s => ({ ...s, isLoading: false, isAuthenticated: false }));
      return;
    }
    try {
      const res = await fetch('/api/user', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const raw = await res.json() as AuthUser & { user?: AuthUser };
        const user = raw.user ?? raw;
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        setState({ token, user, isLoading: false, isAuthenticated: true });
      } else {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setState({ token: null, user: null, isLoading: false, isAuthenticated: false });
      }
    } catch {
      const cached = localStorage.getItem(USER_KEY);
      setState({
        token,
        user: cached ? JSON.parse(cached) as AuthUser : null,
        isLoading: false,
        isAuthenticated: !!cached,
      });
    }
  }, []);

  useEffect(() => {
    if (state.isLoading) {
      refreshUser();
    }
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem(TOKEN_KEY);
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
}
