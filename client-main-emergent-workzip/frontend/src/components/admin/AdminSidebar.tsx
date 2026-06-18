import React from 'react';
import metryxLogo from '@/assets/metryx-logo-transparent.png';
import {
  FlaskConical, UserCheck, Brain, UserCircle2, Baby, LogOut,
} from 'lucide-react';
import { BRAND } from '@/lib/behavioural-insights';

type NavItem = {
  id: string;
  icon: React.ElementType;
  label: string;
  external?: boolean;
  badge?: number;
  badgeColor?: string;
};

type NavGroup = {
  label: string | null;
  items: NavItem[];
  isLabs?: boolean;
};

type AdminSidebarProps = {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  activeTab: string;
  setActiveTab: React.Dispatch<React.SetStateAction<string>>;
  navGroups: NavGroup[];
  labsOpen: boolean;
  setLabsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  crisisPending?: number;
  handleLogout: () => Promise<void>;
  onNavigate?: (screen: string) => void;
};

export function AdminSidebar(props: AdminSidebarProps) {
  const {
    sidebarCollapsed, setSidebarCollapsed, activeTab, setActiveTab,
    navGroups, labsOpen, setLabsOpen, crisisPending, handleLogout, onNavigate,
  } = props;

  return (
    <>
      <aside
        className={`fixed left-0 top-0 h-full z-40 transition-all duration-300 flex flex-col ${sidebarCollapsed ? 'w-20' : 'w-64'}`}
        style={{ backgroundColor: BRAND.primary }}
      >
        {/* Logo */}
        <div className="p-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <img src={metryxLogo} alt="MetryxOne" className={sidebarCollapsed ? "h-10 object-contain rounded" : "h-12 object-contain rounded"} />
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-3 overflow-y-auto flex-1">
          {navGroups.map((group, gi) => {
            if (group.isLabs) {
              const labsBadge = group.items.reduce((sum, it) => sum + (it.badge ?? 0), 0);
              return (
                <div key={gi} className="mt-3">
                  <button
                    onClick={() => setLabsOpen(v => !v)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
                    title="Advanced Labs — experimental modules"
                  >
                    <FlaskConical className="h-4 w-4 flex-shrink-0" />
                    {!sidebarCollapsed && (
                      <>
                        <span className="text-[10px] font-semibold uppercase tracking-widest flex-1 text-left">Advanced Labs</span>
                        {labsBadge > 0 && (
                          <span className="text-[10px] font-bold text-white bg-red-600 rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1">
                            {labsBadge > 99 ? '99+' : labsBadge}
                          </span>
                        )}
                        <svg
                          className={`h-3 w-3 flex-shrink-0 transition-transform ${labsOpen ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </>
                    )}
                  </button>
                  {(labsOpen || (!sidebarCollapsed && group.items.some(it => it.id === activeTab))) && (
                    <div className="space-y-0.5 mt-0.5">
                      {group.items.map((item: NavItem) => (
                        <button
                          key={item.id}
                          onClick={() => setActiveTab(item.id)}
                          title={sidebarCollapsed ? item.label : undefined}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                            activeTab === item.id
                              ? 'bg-white/15 text-white'
                              : 'text-white/50 hover:bg-white/8 hover:text-white/80'
                          }`}
                          data-testid={`nav-${item.id}`}
                        >
                          <item.icon className="h-4 w-4 flex-shrink-0 opacity-70" />
                          {!sidebarCollapsed && <span className="text-xs font-medium flex-1 text-left">{item.label}</span>}
                          {!sidebarCollapsed && item.badge != null && item.badge > 0 && (
                            <span
                              className="text-[10px] font-bold text-white rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1"
                              style={{ backgroundColor: item.badgeColor || '#DC2626' }}
                            >
                              {item.badge > 99 ? '99+' : item.badge}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div key={gi} className={gi > 0 ? 'mt-3' : ''}>
                {group.label && !sidebarCollapsed && (
                  <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-white/40 select-none">
                    {group.label}
                  </p>
                )}
                {group.label && sidebarCollapsed && gi > 0 && (
                  <div className="my-2 border-t border-white/10" />
                )}
                <div className="space-y-0.5">
                  {group.items.map((item: NavItem) => (
                    <button
                      key={item.id}
                      onClick={() => item.external ? onNavigate?.(item.id) : setActiveTab(item.id)}
                      title={sidebarCollapsed ? item.label : undefined}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                        !item.external && activeTab === item.id
                          ? 'bg-white/20 text-white'
                          : 'text-white/70 hover:bg-white/10 hover:text-white'
                      }`}
                      data-testid={`nav-${item.id}`}
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {!sidebarCollapsed && <span className="text-sm font-medium flex-1 text-left">{item.label}</span>}
                      {!sidebarCollapsed && item.badge != null && item.badge > 0 && (
                        <span
                          className="text-[10px] font-bold text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1"
                          style={{ backgroundColor: item.badgeColor || '#DC2626' }}
                        >
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                      {!sidebarCollapsed && item.external && (
                        <svg className="h-3 w-3 flex-shrink-0 opacity-50" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Platform Access Quick Links */}
        <div className="flex-shrink-0 px-3 pb-2 border-t border-white/10 pt-2">
          {!sidebarCollapsed && (
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-white/40 select-none">Platform Access</p>
          )}
          <div className="space-y-0.5">
            {([
              { icon: UserCheck, label: 'Mentor Marketplace', screen: 'mentor-marketplace' },
              { icon: Brain, label: 'LBI Assessment', screen: 'parent-lbi' },
              { icon: UserCircle2, label: 'Parent Portal', screen: 'unified-parent-dashboard' },
              { icon: Baby, label: 'Student Portal', screen: 'student-dashboard' },
            ] as const).map(link => (
              <button
                key={link.screen}
                onClick={() => onNavigate?.(link.screen)}
                title={link.label}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-all"
              >
                <link.icon className="h-4 w-4 flex-shrink-0" />
                {!sidebarCollapsed && (
                  <span className="text-xs font-medium flex-1 text-left truncate">{link.label}</span>
                )}
                {!sidebarCollapsed && (
                  <svg className="h-3 w-3 flex-shrink-0 opacity-50" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Logout */}
        <div className="flex-shrink-0 p-3 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-all"
            data-testid="button-logout"
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="text-sm font-medium">Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
