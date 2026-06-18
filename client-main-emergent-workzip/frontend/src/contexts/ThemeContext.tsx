import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  syncing: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const TOKEN_KEY = 'metryx_token';

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
}

async function fetchThemeFromServer(token: string): Promise<Theme | null> {
  try {
    const res = await fetch('/api/user/theme', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.theme === 'dark' ? 'dark' : 'light';
  } catch {
    return null;
  }
}

async function saveThemeToServer(token: string, theme: Theme): Promise<void> {
  try {
    await fetch('/api/user/theme', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ theme }),
    });
  } catch {
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = localStorage.getItem('theme') as Theme | null;
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [syncing, setSyncing] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    setSyncing(true);
    fetchThemeFromServer(token).then(serverTheme => {
      if (serverTheme) {
        setThemeState(serverTheme);
        localStorage.setItem('theme', serverTheme);
      }
      setSyncing(false);
    });
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== TOKEN_KEY) return;

      if (!e.newValue) {
        const local = localStorage.getItem('theme') as Theme | null;
        if (local === 'light' || local === 'dark') setThemeState(local);
        return;
      }

      setSyncing(true);
      fetchThemeFromServer(e.newValue).then(serverTheme => {
        if (serverTheme) {
          setThemeState(serverTheme);
          localStorage.setItem('theme', serverTheme);
        }
        setSyncing(false);
      });
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);

    const token = getToken();
    if (!token) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveThemeToServer(token, newTheme);
    }, 400);
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, syncing }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}
