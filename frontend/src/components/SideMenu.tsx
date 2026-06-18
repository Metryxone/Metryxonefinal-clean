import { cn } from "@/lib/utils";
import {
  Home,
  Brain,
  BookOpen,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  BarChart3,
  FileText,
  TrendingUp,
  Sparkles,
  Shield,
  HelpCircle,
  Target,
  MessageCircle,
  PieChart,
  Crown,
  Heart,
  Award,
  Compass,
  Zap,
  PlayCircle,
  RefreshCw,
  Package,
  Handshake,
  CalendarDays,
  ClipboardList,
  Briefcase,
  HeartPulse,
} from "lucide-react";
import { useState } from "react";
import metryxLogoLight from "@/assets/metryx-logo-light.png";

const C = {
  bg:          '#FFFFFF',
  bgSub:       '#F5F7FA',
  border:      '#E8ECF2',
  primary:     '#0B3C5D',
  primaryBg:   '#EDF2F7',
  primaryText: '#0B3C5D',
  text:        '#1A2236',
  textSub:     '#64748B',
  textMuted:   '#9AA4B2',
  teal:        '#4ECDC4',
  tealBg:      '#EDF7F2',
  amber:       '#D97706',
  rose:        '#D97706',
  white:       '#FFFFFF',
};

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: 'core' | 'new' | 'upgrade' | 'beta';
  description?: string;
}

interface MenuSection {
  id: string;
  label?: string;
  items: MenuItem[];
}

interface Props {
  role: 'parent' | 'student' | 'institute';
  activeItem: string;
  onMenuSelect: (itemId: string) => void;
  onLogout: () => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  userName?: string;
  userEmail?: string;
  childCount?: number;
  notificationCount?: number;
  progressPct?: number;
}

const BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  core:    { bg: '#EDF7F2', fg: '#4ECDC4', label: 'Core' },
  new:     { bg: '#FFF8E1', fg: '#D97706', label: 'New' },
  upgrade: { bg: '#FFF8E1', fg: '#D97706', label: 'Upgrade' },
  beta:    { bg: '#E8EEF3', fg: '#0B3C5D', label: 'Beta' },
};

const PARENT_SECTIONS: MenuSection[] = [
  {
    id: 'main',
    items: [
      { id: 'dashboard',           label: 'Dashboard',           icon: <Home size={16} /> },
      { id: 'education',           label: 'Education Planner',   icon: <GraduationCap size={16} /> },
      { id: 'exam-ready',          label: 'Exam Readiness',      icon: <Target size={16} />,        badge: 'new' },
      { id: 'lbi-product',         label: 'LBI Assessment',      icon: <Brain size={16} />,         badge: 'core' },
      { id: 'exam-trends',         label: 'Exam Analytics',      icon: <TrendingUp size={16} /> },
      { id: 'ai-powered-reports',  label: 'AI Reports',          icon: <Sparkles size={16} /> },
      { id: 'metryxai-assistant',  label: 'MetryxAI',            icon: <MessageCircle size={16} /> },
      { id: 'my-packages',         label: 'My Packages',         icon: <Package size={16} /> },
      { id: 'enterprise-hub',      label: 'Mentor Services',     icon: <Handshake size={16} /> },
    ],
  },
];

const STUDENT_SECTIONS: MenuSection[] = [
  {
    id: 'main',
    items: [
      { id: 'dashboard',        label: 'Dashboard',          icon: <Home size={16} /> },
      { id: 'education',        label: 'Education Planner',  icon: <GraduationCap size={16} /> },
      { id: 'exam-ready',       label: 'Exam Readiness',     icon: <Target size={16} />,        badge: 'new' },
      { id: 'lbi',              label: 'LBI Assessment',     icon: <Brain size={16} />,          badge: 'core' },
      { id: 'analytics',        label: 'Exam Analytics',     icon: <TrendingUp size={16} /> },
      { id: 'ai-reports',       label: 'AI Reports',         icon: <Sparkles size={16} /> },
      { id: 'career',           label: 'Career Intelligence',icon: <Briefcase size={16} />,      badge: 'new' },
      { id: 'packages',         label: 'My Packages',        icon: <Package size={16} /> },
      { id: 'mentor-services',  label: 'Mentor Services',    icon: <Handshake size={16} /> },
    ],
  },
  {
    id: 'student',
    items: [
      { id: 'missions',      label: 'Daily Missions',   icon: <Zap size={16} />,            badge: 'new' },
      { id: 'exams',         label: 'My Exams',         icon: <FileText size={16} /> },
      { id: 'progress',      label: 'My Progress',      icon: <BarChart3 size={16} /> },
      { id: 'study-planner', label: 'Study Planner',    icon: <CalendarDays size={16} /> },
      { id: 'assignments',   label: 'Assignments',      icon: <ClipboardList size={16} /> },
      { id: 'forum',         label: 'Learning Forum',   icon: <MessageCircle size={16} />,  badge: 'new' },
      { id: 'collab',        label: 'My Collab',        icon: <Users size={16} /> },
      { id: 'wellness',      label: 'Wellness Hub',     icon: <HeartPulse size={16} /> },
      { id: 'rewards',       label: 'XP & Rewards',     icon: <Crown size={16} />,          badge: 'new' },
      { id: 'profile',       label: 'My Profile',       icon: <GraduationCap size={16} /> },
    ],
  },
];

const INSTITUTE_SECTIONS: MenuSection[] = [
  {
    id: 'main',
    items: [
      { id: 'dashboard', label: 'Dashboard',           icon: <Home size={16} /> },
      { id: 'students',  label: 'Students',            icon: <Users size={16} /> },
      { id: 'exams',     label: 'Exams',               icon: <FileText size={16} /> },
      { id: 'reports',   label: 'Reports',             icon: <BarChart3 size={16} /> },
      { id: 'lbi-product',         label: 'LBI Assessment',  icon: <Brain size={16} />,     badge: 'core' },
      { id: 'exam-ready',          label: 'Exam Readiness',  icon: <Target size={16} />,    badge: 'new' },
      { id: 'ai-powered-reports',  label: 'AI Reports',      icon: <Sparkles size={16} /> },
      { id: 'metryxai-assistant',  label: 'Ask MetryxAI',    icon: <MessageCircle size={16} /> },
      { id: 'education', label: 'Education Plans',     icon: <BookOpen size={16} /> },
      { id: 'pricing',   label: 'Plans & Pricing',     icon: <Crown size={16} />,     badge: 'upgrade' },
    ],
  },
];

function getInitials(name?: string) {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function getRoleLabel(role: string, childCount: number) {
  if (role === 'parent') return `Parent Portal${childCount > 0 ? ` · ${childCount} child${childCount !== 1 ? 'ren' : ''}` : ''}`;
  if (role === 'student') return 'Student Portal';
  return 'Institute Portal';
}

export function SideMenu({
  role, activeItem, onMenuSelect, onLogout,
  collapsed = false, onCollapsedChange,
  userName, userEmail, childCount = 0, notificationCount = 0,
  progressPct = 0,
}: Props) {
  const [isCollapsed, setIsCollapsed] = useState(collapsed);

  const sections =
    role === 'parent'  ? PARENT_SECTIONS  :
    role === 'student' ? STUDENT_SECTIONS :
    INSTITUTE_SECTIONS;

  const handleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    onCollapsedChange?.(next);
  };

  const renderItem = (item: MenuItem) => {
    const isActive = activeItem === item.id;
    const badge = item.badge ? BADGE[item.badge] : null;

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onMenuSelect(item.id)}
        title={isCollapsed ? item.label : undefined}
        data-testid={`menu-${item.id}`}
        className="relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150"
        style={{
          backgroundColor: isActive ? C.primary : 'transparent',
          color: isActive ? C.white : C.textSub,
          fontWeight: isActive ? 600 : 400,
          justifyContent: isCollapsed ? 'center' : undefined,
        }}
        onMouseEnter={e => {
          if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = C.bgSub;
        }}
        onMouseLeave={e => {
          if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
        }}
      >
        <span className="shrink-0" style={{ color: isActive ? C.white : C.textSub }}>
          {item.icon}
        </span>

        {!isCollapsed && (
          <>
            <span className="flex-1 text-left truncate text-[13px]">{item.label}</span>
            {badge && (
              <span
                className="px-1.5 py-0.5 text-[9px] font-bold rounded-full flex-shrink-0"
                style={
                  isActive
                    ? { background: 'rgba(255,255,255,0.22)', color: C.white }
                    : { background: badge.bg, color: badge.fg, border: `1px solid ${badge.fg}30` }
                }
              >
                {badge.label}
              </span>
            )}
          </>
        )}

        {isCollapsed && badge && (
          <span
            className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
            style={{ background: isActive ? C.white : badge.fg }}
          />
        )}
      </button>
    );
  };

  return (
    <div
      className="h-full flex flex-col transition-all duration-300 overflow-hidden"
      style={{
        width: isCollapsed ? 64 : 240,
        background: C.bg,
        borderRight: `1px solid ${C.border}`,
        boxShadow: '2px 0 16px rgba(0,0,0,0.05)',
      }}
      data-testid="side-menu"
    >
      {/* ── Logo bar ── */}
      <div
        className="flex items-center flex-shrink-0 px-3"
        style={{
          height: 56,
          borderBottom: `1px solid ${C.border}`,
          justifyContent: isCollapsed ? 'center' : 'space-between',
        }}
      >
        {isCollapsed ? (
          <button
            onClick={handleCollapse}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: C.textMuted }}
            onMouseEnter={e => (e.currentTarget.style.background = C.bgSub)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            data-testid="btn-expand-menu"
          >
            <ChevronRight size={14} />
          </button>
        ) : (
          <>
            <img
              src={metryxLogoLight}
              alt="MetryxOne"
              className="h-7 w-auto object-contain"
              data-testid="sidemenu-logo"
            />
            <button
              onClick={handleCollapse}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: C.textMuted }}
              onMouseEnter={e => (e.currentTarget.style.background = C.bgSub)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              data-testid="btn-collapse-menu"
            >
              <ChevronLeft size={13} />
            </button>
          </>
        )}
      </div>

      {/* ── User profile ── */}
      {!isCollapsed ? (
        <div className="px-4 pt-5 pb-3 flex-shrink-0">
          {/* Avatar + name */}
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold flex-shrink-0"
              style={{ background: C.teal, color: C.white }}
            >
              {getInitials(userName)}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-[13.5px] font-semibold truncate" style={{ color: C.text }}>
                {userName || (role === 'parent' ? 'Parent' : role === 'student' ? 'Student' : 'Institute')}
              </p>
              <p className="text-[11px] truncate mt-0.5" style={{ color: C.textMuted }}>
                {getRoleLabel(role, childCount)}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px]" style={{ color: C.textMuted }}>Profile complete</span>
              <span className="text-[10px] font-semibold" style={{ color: C.textMuted }}>{progressPct}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.border }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%`, background: C.primary }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex justify-center mt-4 mb-2 flex-shrink-0">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold"
            style={{ background: C.teal, color: C.white }}
          >
            {getInitials(userName)}
          </div>
        </div>
      )}

      {/* ── Divider ── */}
      <div className="mx-3 flex-shrink-0" style={{ height: 1, background: C.border }} />

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {sections.map(section =>
          section.items.map(item => renderItem(item))
        )}

        {/* Quick Tour — teal highlight row */}
        {!isCollapsed && (
          <button
            type="button"
            onClick={() => {}}
            data-testid="menu-quick-tour"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150 mt-1"
            style={{ color: C.teal, backgroundColor: 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = C.tealBg)}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <PlayCircle size={16} style={{ color: C.teal, flexShrink: 0 }} />
            <span>Quick Tour</span>
          </button>
        )}
      </nav>

      {/* ── Footer ── */}
      <div className="flex-shrink-0 px-2 pb-3 pt-1" style={{ borderTop: `1px solid ${C.border}` }}>
        {!isCollapsed ? (
          <div className="space-y-0.5">
            {/* Help & Guides */}
            <button
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-colors"
              style={{ color: C.textSub }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = C.bgSub)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              data-testid="btn-help"
            >
              <HelpCircle size={16} className="flex-shrink-0" />
              <span>Help &amp; Guides</span>
            </button>

            {/* Refresh */}
            <button
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-colors"
              style={{ color: C.textSub }}
              onClick={() => window.location.reload()}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = C.bgSub)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              data-testid="btn-refresh"
            >
              <RefreshCw size={16} className="flex-shrink-0" />
              <span>Refresh</span>
            </button>

            {/* Collapse */}
            <button
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-colors"
              style={{ color: C.textSub }}
              onClick={handleCollapse}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = C.bgSub)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              data-testid="btn-collapse-footer"
            >
              <ChevronLeft size={16} className="flex-shrink-0" />
              <span>Collapse</span>
            </button>

            {/* Sign Out */}
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-colors"
              style={{ color: C.textSub }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.backgroundColor = '#FFF0F3';
                (e.currentTarget as HTMLElement).style.color = C.rose;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                (e.currentTarget as HTMLElement).style.color = C.textSub;
              }}
              data-testid="btn-logout"
            >
              <LogOut size={16} className="flex-shrink-0" />
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          /* Collapsed footer — just icons */
          <div className="flex flex-col items-center gap-1 pt-1">
            <button
              className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors"
              style={{ color: C.textMuted }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = C.bgSub)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              data-testid="btn-help"
              title="Help & Guides"
            >
              <HelpCircle size={15} />
            </button>
            <button
              className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors"
              style={{ color: C.textMuted }}
              onClick={() => window.location.reload()}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = C.bgSub)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              data-testid="btn-refresh"
              title="Refresh"
            >
              <RefreshCw size={15} />
            </button>
            <button
              className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors"
              style={{ color: C.textMuted }}
              onClick={handleCollapse}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = C.bgSub)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              data-testid="btn-collapse-footer"
              title="Expand"
            >
              <ChevronRight size={15} />
            </button>
            <button
              onClick={onLogout}
              className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors"
              style={{ color: C.textMuted }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.backgroundColor = '#FFF0F3';
                (e.currentTarget as HTMLElement).style.color = C.rose;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                (e.currentTarget as HTMLElement).style.color = C.textMuted;
              }}
              data-testid="btn-logout"
              title="Sign Out"
            >
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
