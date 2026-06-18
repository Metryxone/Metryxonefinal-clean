import { Search, Map, Moon, Sun, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import NotificationCenter from '@/components/NotificationCenter';
import { useTheme } from '@/contexts/ThemeContext';
import logoTransparent from '@/assets/metryx-logo-transparent.png';
import logoTransparentDark from '@/assets/metryx-logo-transparent-dark.png';

interface AppTopBarProps {
  title: string;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  onSearch?: () => void;
  onTour?: () => void;
  onLogout?: () => void;
  rightExtra?: React.ReactNode;
}

export function AppTopBar({
  title,
  onToggleDarkMode,
  onSearch,
  onTour,
  onLogout,
  rightExtra,
}: AppTopBarProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <header
      className="sticky top-0 z-30 flex-shrink-0 flex items-center justify-between px-4 md:px-6"
      style={{
        height: 56,
        backgroundColor: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-subtle)',
        boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
      }}
    >
      <div className="flex items-center gap-2">
        <img
          src={isDark ? logoTransparentDark : logoTransparent}
          alt="MetryxOne"
          className="h-7 md:hidden"
        />
        <span
          className="hidden md:block text-[13px] font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          {title}
        </span>
      </div>

      <div className="flex items-center gap-1">
        {rightExtra}

        {onSearch && (
          <button
            onClick={onSearch}
            className="hidden sm:flex items-center gap-2 h-8 px-3 rounded-lg text-[12px] font-medium border transition-colors"
            style={{
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-muted)',
              backgroundColor: 'var(--bg-secondary)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.backgroundColor = isDark
                ? 'rgba(255,255,255,0.06)' : 'var(--bg-secondary)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-secondary)';
            }}
            title="Search (⌘K)"
            data-testid="btn-global-search"
          >
            <Search size={13} />
            <span>Search</span>
            <kbd
              className="ml-1 text-[9px] px-1 py-0.5 rounded font-mono"
              style={{
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-muted)',
              }}
            >
              ⌘K
            </kbd>
          </button>
        )}

        <NotificationCenter variant={isDark ? 'dark' : 'default'} />

        {onTour && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onTour}
            className="hidden sm:flex items-center gap-1.5 text-xs font-medium"
            style={{ color: 'var(--text-muted)' }}
            title="Quick Tour"
          >
            <Map size={14} />
            Quick Tour
          </Button>
        )}

        {onToggleDarkMode && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleDarkMode}
            style={{ color: 'var(--text-muted)' }}
            data-testid="theme-toggle"
          >
            {isDark ? <Sun size={17} /> : <Moon size={17} />}
          </Button>
        )}

        {onLogout && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onLogout}
            style={{ color: 'var(--text-muted)' }}
            data-testid="logout-button"
          >
            <LogOut size={17} />
          </Button>
        )}
      </div>
    </header>
  );
}
