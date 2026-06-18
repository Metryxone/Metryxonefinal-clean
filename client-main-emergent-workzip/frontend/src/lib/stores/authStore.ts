import { create } from 'zustand';

interface AuthUser {
  id:    string;
  email: string;
  name:  string;
  role?: string;
}

interface AuthState {
  user:   AuthUser | null;
  token:  string | null;
  isAuth: boolean;
  setUser:  (user: AuthUser) => void;
  setToken: (token: string) => void;
  logout:   () => void;
  init:     () => void;
}

function decodeToken(token: string): AuthUser | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return { id: payload.id ?? payload.userId, email: payload.email ?? '', name: payload.name ?? '', role: payload.role };
  } catch { return null; }
}

export const useAuthStore = create<AuthState>((set) => ({
  user:   null,
  token:  null,
  isAuth: false,

  setUser: (user) => set({ user, isAuth: true }),

  setToken: (token) => {
    localStorage.setItem('metryx_token', token);
    const user = decodeToken(token);
    set({ token, user, isAuth: !!user });
  },

  logout: () => {
    localStorage.removeItem('metryx_token');
    set({ user: null, token: null, isAuth: false });
  },

  init: () => {
    const token = localStorage.getItem('metryx_token');
    if (!token) return;
    const user = decodeToken(token);
    if (user) set({ token, user, isAuth: true });
  },
}));
