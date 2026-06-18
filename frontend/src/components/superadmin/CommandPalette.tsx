import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, CornerDownLeft, ArrowUp, ArrowDown, X, Loader2, Database } from 'lucide-react';
import { useAdminDashboard } from '@/contexts/AdminDashboardContext';

/**
 * Global ⌘K / Ctrl+K command palette.
 * Two surfaces in one list:
 *  1. Navigation — instant, local fuzzy match over EVERY admin tab (navGroups).
 *  2. Entities — debounced backend GET /api/admin/search across 13 entity types
 *     (users, candidates, employers, signals, jobs, skills, …). Each entity row
 *     shows Type · Health · Location and navigates to its location tab on enter.
 * Additive: keyed by setActiveTab. Does not replace the sidebar or any panel.
 */

interface FlatItem {
  id: string;
  label: string;
  group: string;
  icon: React.ElementType;
  badge?: number;
}

interface EntityResult {
  id: string;
  entity: string;
  subtitle: string | null;
  type: string;
  type_label: string;
  health: number | null;
  location: { tab: string; label: string };
  actions: { key: string; label: string; tab: string }[];
}
interface EntityGroup { type: string; label: string; tab: string; count: number; results: EntityResult[]; }

// A unified selectable row across both surfaces.
type Row =
  | { kind: 'nav'; nav: FlatItem }
  | { kind: 'entity'; entity: EntityResult };

// subsequence + substring scorer (lower = better; -1 = no match)
function score(label: string, group: string, q: string): number {
  if (!q) return 0;
  const L = label.toLowerCase();
  const G = group.toLowerCase();
  const idx = L.indexOf(q);
  if (idx === 0) return 0;
  if (idx > 0) return 1 + idx * 0.01;
  if (G.indexOf(q) >= 0) return 50;
  let li = 0;
  for (let qi = 0; qi < q.length; qi++) {
    li = L.indexOf(q[qi], li);
    if (li === -1) return -1;
    li++;
  }
  return 100;
}

function healthColor(h: number): string {
  if (h >= 75) return '#16A34A';
  if (h >= 50) return '#CA8A04';
  return '#DC2626';
}

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { navGroups, setActiveTab, activeTab, BRAND } = useAdminDashboard() as any;
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const [entityGroups, setEntityGroups] = useState<EntityGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const reqIdRef = useRef(0);

  const PRIMARY = BRAND?.primary || '#344E86';

  const all: FlatItem[] = useMemo(() => {
    const out: FlatItem[] = [];
    for (const g of navGroups || []) {
      const group = g.label || 'Mission Control';
      for (const it of g.items) out.push({ id: it.id, label: it.label, group, icon: it.icon, badge: it.badge });
    }
    return out;
  }, [navGroups]);

  const navResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all.slice(0, 40);
    return all
      .map(it => ({ it, s: score(it.label, it.group, q) }))
      .filter(x => x.s >= 0)
      .sort((a, b) => a.s - b.s)
      .slice(0, 40)
      .map(x => x.it);
  }, [query, all]);

  // Debounced backend entity search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setEntityGroups([]); setLoading(false); return; }
    setLoading(true);
    const myReq = ++reqIdRef.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}&limit=6`, { credentials: 'include' });
        if (myReq !== reqIdRef.current) return; // stale
        if (res.ok) {
          const d = await res.json();
          setEntityGroups(Array.isArray(d.groups) ? d.groups : []);
        } else {
          setEntityGroups([]);
        }
      } catch {
        if (myReq === reqIdRef.current) setEntityGroups([]);
      } finally {
        if (myReq === reqIdRef.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  // Flatten into a single selectable list (nav first, then entities).
  const rows: Row[] = useMemo(() => {
    const r: Row[] = navResults.map(nav => ({ kind: 'nav', nav } as Row));
    for (const g of entityGroups) for (const e of g.results) r.push({ kind: 'entity', entity: e });
    return r;
  }, [navResults, entityGroups]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSel(0);
      setEntityGroups([]);
      const id = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(id);
    }
  }, [open]);

  useEffect(() => { setSel(0); }, [query]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${sel}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [sel, open]);

  if (!open) return null;

  const chooseRow = (row?: Row) => {
    if (!row) return;
    if (row.kind === 'nav') setActiveTab(row.nav.id);
    else setActiveTab(row.entity.location.tab);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, Math.max(0, rows.length - 1))); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); chooseRow(rows[sel]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  // Build a render plan with section headers, tracking the flat selectable index.
  let flatIdx = -1;
  const navStart = 0;
  const entityFlatBase = navResults.length;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4"
      style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)' }}
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden border"
        style={{ borderColor: '#e2e8f0' }}
        onMouseDown={e => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {/* search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b" style={{ borderColor: '#eef2f7' }}>
          <Search className="h-5 w-5 shrink-0" style={{ color: PRIMARY }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search screens, users, employers, signals, jobs, skills…"
            className="flex-1 outline-none text-[15px] text-slate-800 placeholder:text-slate-400 bg-transparent"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
          <button onClick={onClose} className="p-1 rounded-md hover:bg-slate-100 text-slate-400" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* results */}
        <div ref={listRef} className="max-h-[56vh] overflow-y-auto py-1.5">
          {rows.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-400">
              {query.trim().length >= 2 && !loading
                ? <>No screens or records match “{query}”.</>
                : <>Type to search screens and records.</>}
            </div>
          ) : (
            <>
              {/* Navigation section */}
              {navResults.length > 0 && (
                <div className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Navigation</div>
              )}
              {navResults.map((it) => {
                flatIdx++;
                const i = flatIdx;
                const Icon = it.icon || Search;
                const active = i === sel;
                const current = it.id === activeTab;
                return (
                  <button
                    key={`nav-${it.id}`}
                    data-idx={i}
                    onMouseEnter={() => setSel(i)}
                    onClick={() => chooseRow({ kind: 'nav', nav: it })}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                    style={{ background: active ? 'rgba(52,78,134,0.08)' : 'transparent' }}
                  >
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: active ? PRIMARY : '#f1f5f9' }}>
                      <Icon className="h-4 w-4" style={{ color: active ? '#fff' : '#64748b' }} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13.5px] font-medium text-slate-800 truncate">{it.label}</span>
                      <span className="block text-[11px] text-slate-400 truncate">{it.group}</span>
                    </span>
                    {current && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                        style={{ color: PRIMARY, background: 'rgba(52,78,134,0.10)' }}>current</span>
                    )}
                    {!!it.badge && it.badge > 0 && (
                      <span className="text-[10px] font-bold text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shrink-0"
                        style={{ background: '#DC2626' }}>{it.badge > 99 ? '99+' : it.badge}</span>
                    )}
                  </button>
                );
              })}

              {/* Entity sections */}
              {entityGroups.map((g) => (
                <div key={`grp-${g.type}`}>
                  <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Database className="h-3 w-3" /> {g.label}
                    <span className="text-slate-300 font-normal">· {g.count}</span>
                  </div>
                  {g.results.map((e) => {
                    flatIdx++;
                    const i = flatIdx;
                    const active = i === sel;
                    return (
                      <button
                        key={e.id}
                        data-idx={i}
                        onMouseEnter={() => setSel(i)}
                        onClick={() => chooseRow({ kind: 'entity', entity: e })}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                        style={{ background: active ? 'rgba(52,78,134,0.08)' : 'transparent' }}
                      >
                        <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold uppercase"
                          style={{ background: active ? PRIMARY : '#f1f5f9', color: active ? '#fff' : '#64748b' }}>
                          {e.type_label.slice(0, 2)}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13.5px] font-medium text-slate-800 truncate">{e.entity}</span>
                          <span className="block text-[11px] text-slate-400 truncate">
                            {e.type_label}{e.subtitle ? ` · ${e.subtitle}` : ''} · ↳ {e.location.label}
                          </span>
                        </span>
                        {e.health != null && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                            style={{ color: healthColor(e.health), background: `${healthColor(e.health)}1A` }}>
                            {e.health}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </>
          )}
        </div>

        {/* footer hints */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t bg-slate-50 text-[11px] text-slate-500" style={{ borderColor: '#eef2f7' }}>
          <span className="flex items-center gap-1"><ArrowUp className="h-3 w-3" /><ArrowDown className="h-3 w-3" /> navigate</span>
          <span className="flex items-center gap-1"><CornerDownLeft className="h-3 w-3" /> open</span>
          <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-sans">Esc</kbd> close</span>
          <span className="ml-auto">{navResults.length} screen{navResults.length === 1 ? '' : 's'}{entityGroups.length > 0 ? ` · ${rows.length - navResults.length} record${rows.length - navResults.length === 1 ? '' : 's'}` : ''}</span>
        </div>
      </div>
    </div>
  );
}
