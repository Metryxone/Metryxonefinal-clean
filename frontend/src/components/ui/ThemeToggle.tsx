import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from './button';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="h-9 w-9 rounded-full"
      data-testid="button-theme-toggle"
    >
      {theme === 'light' ? (
        <Moon size={18} style={{ color: 'var(--text-secondary)' }} />
      ) : (
        <Sun size={18} style={{ color: 'var(--text-secondary)' }} />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
