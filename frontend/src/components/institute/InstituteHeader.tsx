import { Search, Map, Moon, Sun, LogOut, Menu } from 'lucide-react';
import { Button } from "@/components/ui/button";
import NotificationCenter from '@/components/NotificationCenter';
import { RoleSwitcher } from '../RoleSwitcher';
import metryxLogo from '@/assets/metryx-logo-light.png';

interface Props {
  instituteName?: string;
  instituteCode?: string;
  onLogout?: () => void;
  onMenuToggle?: () => void;
  onProfileClick?: () => void;
  onSettingsClick?: () => void;
  onSearchOpen?: () => void;
  notificationCount?: number;
  currentRole?: string;
  availableRoles?: string[];
  onRoleChange?: (role: string) => void;
  activeSection?: string;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  onTour?: () => void;
}

const SECTION_TITLES: Record<string, string> = {
  dashboard: 'Dashboard', analytics: 'Live Analytics', reports: 'Reports',
  'lbi-product': 'Behavior Assessment', 'exam-ready': 'Exam Readiness',
  'ai-powered-reports': 'AI Reports', 'metryxai-assistant': 'Ask MetryxAI',
  education: 'Education Plans', packages: 'LBI Packages',
  talent: 'Talent & HR', 'school-health': 'School Health',
  exams: 'Exams', students: 'Students', batches: 'Batches',
};

export function InstituteHeader({
  instituteName,
  onLogout,
  onMenuToggle,
  onSearchOpen,
  currentRole,
  availableRoles,
  onRoleChange,
  activeSection,
  isDarkMode = false,
  onToggleDarkMode,
  onTour,
}: Props) {
  const title = activeSection ? (SECTION_TITLES[activeSection] ?? 'Dashboard') : 'Dashboard';

  return (
    <header
      className="sticky top-0 z-30 flex-shrink-0 flex items-center justify-between px-4 md:px-6"
      style={{
        height: 56,
        background: isDarkMode ? '#1f2937' : '#ffffff',
        borderBottom: `1px solid ${isDarkMode ? '#374151' : '#E8ECF2'}`,
        boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
      }}
      data-testid="institute-header"
    >
      <div className="flex items-center gap-2">
        {onMenuToggle && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open menu" onClick={onMenuToggle}
            className={`lg:hidden h-8 w-8 ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'}`}
            data-testid="btn-menu-toggle"
          >
            <Menu size={18} />
          </Button>
        )}
        <img src={metryxLogo} alt="MetryxOne" className="h-7 md:hidden" />
        <span
          className="hidden md:block text-[13px] font-semibold"
          style={{ color: isDarkMode ? '#f9fafb' : '#1A2236' }}
        >
          {title}
        </span>
        {instituteName && (
          <span className={`hidden lg:inline text-[11px] px-2 py-0.5 rounded-full font-medium ml-1 ${isDarkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
            {instituteName}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        {currentRole && availableRoles && availableRoles.length > 1 && onRoleChange && (
          <RoleSwitcher
            currentRole={currentRole}
            availableRoles={availableRoles}
            onRoleChange={onRoleChange}
            variant="minimal"
          />
        )}

        {onSearchOpen && (
          <button
            onClick={onSearchOpen}
            className={`hidden sm:flex items-center gap-2 h-8 px-3 rounded-lg text-[12px] font-medium border transition-colors ${
              isDarkMode
                ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
            title="Search (⌘K)"
            data-testid="btn-global-search"
          >
            <Search size={13} />
            <span>Search</span>
            <kbd
              className={`ml-1 text-[9px] px-1 py-0.5 rounded font-mono border ${
                isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50'
              }`}
            >
              ⌘K
            </kbd>
          </button>
        )}

        <NotificationCenter variant={isDarkMode ? 'dark' : 'default'} />

        {onTour && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onTour}
            className={`hidden sm:flex items-center gap-1.5 text-xs font-medium ${
              isDarkMode
                ? 'text-gray-300 hover:text-white hover:bg-gray-700'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
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
            aria-label="Toggle dark mode" onClick={onToggleDarkMode}
            className={
              isDarkMode
                ? 'text-gray-300 hover:text-white hover:bg-gray-700'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
            }
            data-testid="theme-toggle"
          >
            {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
          </Button>
        )}

        {onLogout && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Log out" onClick={onLogout}
            className={
              isDarkMode
                ? 'text-gray-300 hover:text-white hover:bg-gray-700'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
            }
            data-testid="btn-logout"
          >
            <LogOut size={17} />
          </Button>
        )}
      </div>
    </header>
  );
}
