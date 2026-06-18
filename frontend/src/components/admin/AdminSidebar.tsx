import React, { useEffect, useMemo, useRef, useState } from 'react';
import metryxLogo from '@/assets/metryx-logo-transparent.png';
import {
  FlaskConical, UserCheck, Brain, UserCircle2, Baby, LogOut, Search, X, ChevronDown,
  PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { BRAND } from '@/lib/behavioural-insights';

// Drag-resize bounds for the expanded sidebar (must stay in sync with SuperAdminDashboard).
const SIDEBAR_MIN = 208;
const SIDEBAR_MAX = 420;
const SIDEBAR_DEFAULT = 256;

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
  sidebarWidth: number;
  setSidebarWidth: React.Dispatch<React.SetStateAction<number>>;
  sidebarResizing: boolean;
  setSidebarResizing: React.Dispatch<React.SetStateAction<boolean>>;
  activeTab: string;
  setActiveTab: React.Dispatch<React.SetStateAction<string>>;
  navGroups: NavGroup[];
  labsOpen: boolean;
  setLabsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  crisisPending?: number;
  handleLogout: () => Promise<void>;
  onNavigate?: (screen: string) => void;
};

const ExternalIcon = () => (
  <svg className="h-3 w-3 flex-shrink-0 opacity-50" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

export function AdminSidebar(props: AdminSidebarProps) {
  const {
    sidebarCollapsed, setSidebarCollapsed,
    sidebarWidth, setSidebarWidth, sidebarResizing, setSidebarResizing,
    activeTab, setActiveTab,
    navGroups, labsOpen, setLabsOpen, handleLogout, onNavigate,
  } = props;

  // Drag the right edge to resize; persistence is handled by the parent.
  // Holds the active drag's teardown so we can always release listeners/body
  // styles — even if pointerup is missed (released off-window, cancelled, or
  // the component unmounts mid-drag).
  const endResizeRef = useRef<(() => void) | null>(null);
  const startResize = (e: React.PointerEvent) => {
    if (sidebarCollapsed) return;
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidth;
    setSidebarResizing(true);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    const onMove = (ev: PointerEvent) => {
      const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startW + (ev.clientX - startX)));
      setSidebarWidth(next);
    };
    const end = () => {
      setSidebarResizing(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      window.removeEventListener('blur', end);
      endResizeRef.current = null;
    };
    endResizeRef.current = end;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    window.addEventListener('blur', end);
  };
  // Safety net: always release an in-flight drag on unmount.
  useEffect(() => () => endResizeRef.current?.(), []);

  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const totalItems = useMemo(
    () => navGroups.reduce((n, g) => n + g.items.length, 0),
    [navGroups],
  );

  // Which named groups are expanded (keyed by label — robust to reordering/filtering).
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set());

  // Auto-open the group that owns the active tab (e.g. on deep-link / programmatic nav).
  const activeGroupLabel = useMemo(
    () => navGroups.find(g => !g.isLabs && g.label && g.items.some(it => it.id === activeTab))?.label ?? null,
    [navGroups, activeTab],
  );
  useEffect(() => {
    if (!activeGroupLabel) return;
    setOpenGroups(prev => {
      if (prev.has(activeGroupLabel)) return prev;
      const next = new Set(prev);
      next.add(activeGroupLabel);
      return next;
    });
  }, [activeGroupLabel]);

  const toggleGroup = (label: string) =>
    setOpenGroups(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  const expandAll = () =>
    setOpenGroups(new Set(navGroups.filter(g => g.label && !g.isLabs).map(g => g.label as string)));
  const collapseAll = () => setOpenGroups(new Set());

  // External platform quick-links — rendered inside the scrollable nav (as a
  // collapsible section) so they never crowd out the menu options.
  const platformLinks = [
    { icon: UserCheck, label: 'Mentor Marketplace', screen: 'mentor-marketplace' },
    { icon: Brain, label: 'LBI Assessment', screen: 'parent-lbi' },
    { icon: UserCircle2, label: 'Parent Portal', screen: 'unified-parent-dashboard' },
    { icon: Baby, label: 'Student Portal', screen: 'student-dashboard' },
  ] as const;
  const PLATFORM_KEY = '__platform_access__';

  // When searching, filter items by label across every group (incl. Labs).
  const visibleGroups: NavGroup[] = useMemo(() => {
    if (!searching) return navGroups;
    return navGroups
      .map(g => ({ ...g, items: g.items.filter(it => it.label.toLowerCase().includes(q)) }))
      .filter(g => g.items.length > 0);
  }, [navGroups, q, searching]);

  const renderItem = (item: NavItem, small: boolean) => {
    const active = !item.external && activeTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => (item.external ? onNavigate?.(item.id) : setActiveTab(item.id))}
        title={sidebarCollapsed ? item.label : undefined}
        className={`w-full flex items-center gap-3 rounded-lg transition-all ${small ? 'px-3 py-2' : 'px-3 py-2.5'} ${
          active
            ? (small ? 'bg-white/15 text-white' : 'bg-white/20 text-white')
            : (small ? 'text-white/50 hover:bg-white/8 hover:text-white/80' : 'text-white/70 hover:bg-white/10 hover:text-white')
        }`}
        data-testid={`nav-${item.id}`}
      >
        <item.icon className={`${small ? 'h-4 w-4 opacity-70' : 'h-5 w-5'} flex-shrink-0`} />
        {!sidebarCollapsed && <span className="text-[13px] font-medium flex-1 text-left">{item.label}</span>}
        {!sidebarCollapsed && item.badge != null && item.badge > 0 && (
          <span
            className="text-[10px] font-bold text-white rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1"
            style={{ backgroundColor: item.badgeColor || '#DC2626' }}
          >
            {item.badge > 99 ? '99+' : item.badge}
          </span>
        )}
        {!sidebarCollapsed && item.external && <ExternalIcon />}
      </button>
    );
  };

  return (
    <>
      <aside
        className={`fixed left-0 top-0 h-full z-40 flex flex-col ${sidebarResizing ? '' : 'transition-all duration-300'}`}
        style={{ width: sidebarCollapsed ? 80 : sidebarWidth, backgroundColor: BRAND.primary }}
      >
        {/* Logo + collapse/expand toggle */}
        <div className={`p-4 border-b border-white/10 flex-shrink-0 flex items-center gap-2 ${sidebarCollapsed ? 'flex-col' : ''}`}>
          <img src={metryxLogo} alt="MetryxOne" className={sidebarCollapsed ? "h-9 object-contain rounded" : "h-12 object-contain rounded"} />
          {!sidebarCollapsed && <div className="flex-1" />}
          <button
            onClick={() => setSidebarCollapsed(v => !v)}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            data-testid="button-sidebar-toggle"
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
        </div>

        {/* Search + bulk controls (expanded mode only) */}
        {!sidebarCollapsed && (
          <div className="flex-shrink-0 px-3 pt-3 pb-2 border-b border-white/10">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search menu…"
                aria-label="Search menu options"
                data-testid="input-nav-search"
                className="w-full pl-8 pr-8 py-2 rounded-lg bg-white/10 text-white text-[13px] placeholder-white/40 outline-none focus:bg-white/15 focus:ring-1 focus:ring-white/25"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {!searching && (
              <div className="flex items-center justify-between px-1 mt-2">
                <span className="text-[10px] text-white/30 select-none">{totalItems} options</span>
                <div className="flex items-center gap-2">
                  <button onClick={expandAll} className="text-[10px] text-white/40 hover:text-white/80 transition-colors">Expand all</button>
                  <span className="text-white/20 text-[10px]">·</span>
                  <button onClick={collapseAll} className="text-[10px] text-white/40 hover:text-white/80 transition-colors">Collapse all</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <nav className="p-3 overflow-y-auto flex-1">
          {searching && visibleGroups.length === 0 && (
            <p className="px-3 py-6 text-center text-[13px] text-white/40">No menu options match “{query}”.</p>
          )}

          {visibleGroups.map((group, gi) => {
            // ── Tier groups (Advanced Mode / Developer Mode) — collapsible ─────
            // Each is keyed by its own label so multiple tier sections can be
            // toggled independently (the legacy single `labsOpen` boolean only
            // supported one). They stay collapsed by default.
            if (group.isLabs) {
              const tierLabel = group.label || 'Advanced';
              const tierBadge = group.items.reduce((sum, it) => sum + (it.badge ?? 0), 0);
              const isOpen = openGroups.has(tierLabel);
              const showItems = sidebarCollapsed || searching || isOpen || group.items.some(it => it.id === activeTab);
              return (
                <div key={`tier-${tierLabel}`} className="mt-3">
                  {!sidebarCollapsed && (
                    <button
                      onClick={() => !searching && toggleGroup(tierLabel)}
                      aria-expanded={showItems}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
                      title={`${tierLabel} — lower-frequency screens`}
                    >
                      <FlaskConical className="h-4 w-4 flex-shrink-0" />
                      <span className="text-[13px] font-semibold lowercase tracking-widest flex-1 text-left">{tierLabel}</span>
                      {tierBadge > 0 && (
                        <span className="text-[10px] font-bold text-white bg-red-600 rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1">
                          {tierBadge > 99 ? '99+' : tierBadge}
                        </span>
                      )}
                      {!searching && (
                        <>
                          <span className="text-[10px] text-white/25">{group.items.length}</span>
                          <ChevronDown className={`h-3 w-3 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </>
                      )}
                    </button>
                  )}
                  {sidebarCollapsed && gi > 0 && <div className="my-2 border-t border-white/10" />}
                  {showItems && (
                    <div className="space-y-0.5 mt-0.5">
                      {group.items.map(item => renderItem(item, true))}
                    </div>
                  )}
                </div>
              );
            }

            // ── Ungrouped (Overview) — always visible, no header ───────────────
            if (!group.label) {
              return (
                <div key={`g-${gi}`} className={gi > 0 ? 'mt-3' : ''}>
                  <div className="space-y-0.5">{group.items.map(item => renderItem(item, false))}</div>
                </div>
              );
            }

            // ── Named, collapsible group ───────────────────────────────────────
            const open = sidebarCollapsed || searching || openGroups.has(group.label);
            return (
              <div key={group.label} className={gi > 0 ? 'mt-3' : ''}>
                {!sidebarCollapsed && (
                  <button
                    onClick={() => !searching && toggleGroup(group.label as string)}
                    aria-expanded={open}
                    className="w-full flex items-center gap-2 px-3 mb-1 py-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
                  >
                    <span className="text-[13px] font-semibold lowercase tracking-widest flex-1 text-left select-none">{group.label}</span>
                    {!searching && (
                      <>
                        <span className="text-[10px] text-white/25">{group.items.length}</span>
                        <ChevronDown className={`h-3 w-3 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                      </>
                    )}
                  </button>
                )}
                {sidebarCollapsed && gi > 0 && <div className="my-2 border-t border-white/10" />}
                {open && <div className="space-y-0.5">{group.items.map(item => renderItem(item, false))}</div>}
              </div>
            );
          })}

          {/* Platform Access quick-links — collapsible, inside the scroll area so it never crowds the menu */}
          {!searching && (
            <div className="mt-3">
              {!sidebarCollapsed ? (
                <button
                  onClick={() => toggleGroup(PLATFORM_KEY)}
                  aria-expanded={openGroups.has(PLATFORM_KEY)}
                  className="w-full flex items-center gap-2 px-3 mb-1 py-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
                >
                  <span className="text-[13px] font-semibold lowercase tracking-widest flex-1 text-left select-none">Platform Access</span>
                  <span className="text-[10px] text-white/25">{platformLinks.length}</span>
                  <ChevronDown className={`h-3 w-3 flex-shrink-0 transition-transform ${openGroups.has(PLATFORM_KEY) ? 'rotate-180' : ''}`} />
                </button>
              ) : (
                <div className="my-2 border-t border-white/10" />
              )}
              {(sidebarCollapsed || openGroups.has(PLATFORM_KEY)) && (
                <div className="space-y-0.5">
                  {platformLinks.map(link => (
                    <button
                      key={link.screen}
                      onClick={() => onNavigate?.(link.screen)}
                      title={link.label}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-all"
                    >
                      <link.icon className="h-4 w-4 flex-shrink-0" />
                      {!sidebarCollapsed && (
                        <span className="text-[13px] font-medium flex-1 text-left truncate">{link.label}</span>
                      )}
                      {!sidebarCollapsed && <ExternalIcon />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Logout */}
        <div className="flex-shrink-0 p-3 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-all"
            data-testid="button-logout"
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="text-[13px] font-medium">Logout</span>}
          </button>
        </div>

        {/* Drag-resize handle (expanded mode only) */}
        {!sidebarCollapsed && (
          <div
            onPointerDown={startResize}
            onDoubleClick={() => setSidebarWidth(SIDEBAR_DEFAULT)}
            title="Drag to resize · double-click to reset"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            aria-valuemin={SIDEBAR_MIN}
            aria-valuemax={SIDEBAR_MAX}
            aria-valuenow={sidebarWidth}
            data-testid="sidebar-resize-handle"
            className="group absolute top-0 right-0 h-full w-1.5 cursor-col-resize z-50"
          >
            <div className={`absolute inset-y-0 right-0 w-px transition-colors ${sidebarResizing ? 'bg-white/50' : 'bg-white/10 group-hover:bg-white/40'}`} />
          </div>
        )}
      </aside>
    </>
  );
}
