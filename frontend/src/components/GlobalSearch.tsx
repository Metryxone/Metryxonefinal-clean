import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, ArrowUp, ArrowDown, CornerDownLeft, Command } from 'lucide-react';
import { filterAndScore, type SearchItem, type SearchRole } from '@/lib/searchIndex';

const BRAND = { primary: '#0B3C5D', teal: '#4ECDC4' };
const TEAL = BRAND.teal;

const CATEGORY_LABELS: Record<string, string> = {
  navigation: 'Navigation',
  action:     'Quick Actions',
  feature:    'Platform Features',
  help:       'Help & Settings',
};

interface Props {
  role: SearchRole;
  onNavigate: (screen: string, data?: Record<string, unknown>) => void;
  onMenuSelect?: (item: string) => void;
  onClose: () => void;
  onShowTour?: () => void;
}

export function GlobalSearch({ role, onNavigate, onMenuSelect, onClose, onShowTour }: Props) {
  const [query, setQuery]         = useState('');
  const [results, setResults]     = useState<SearchItem[]>([]);
  const [active, setActive]       = useState(0);
  const [visible, setVisible]     = useState(false);

  const inputRef    = useRef<HTMLInputElement>(null);
  const listRef     = useRef<HTMLDivElement>(null);
  const itemRefs    = useRef<(HTMLButtonElement | null)[]>([]);

  /* ── mount animation ── */
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    inputRef.current?.focus();
  }, []);

  /* ── search ── */
  useEffect(() => {
    setResults(filterAndScore(role, query));
    setActive(0);
  }, [query, role]);

  /* ── keyboard navigation ── */
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') { handleClose(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(a => Math.min(a + 1, results.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(a => Math.max(a - 1, 0));
    }
    if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      executeItem(results[active]);
    }
  }, [results, active]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  /* ── scroll active item into view ── */
  useEffect(() => {
    itemRefs.current[active]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [active]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 150);
  };

  const executeItem = (item: SearchItem) => {
    if (item.action.type === 'navigate') {
      if (item.action.screen === '__quick-tour') {
        onShowTour?.();
      } else {
        onNavigate(item.action.screen, item.action.data);
      }
    } else if (item.action.type === 'menuSelect') {
      onMenuSelect?.(item.action.item);
    }
    handleClose();
  };

  /* ── group results by category ── */
  const grouped = results.reduce<Record<string, SearchItem[]>>((acc, item) => {
    const cat = item.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const categoryOrder = ['navigation', 'action', 'feature', 'help'];
  const orderedGroups = categoryOrder.filter(c => grouped[c]?.length > 0);

  let globalIdx = 0;

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  const kbdIcon = isMac ? '⌘K' : 'Ctrl K';

  return (
    <>
      <style>{`
        @keyframes gs-backdrop { from { opacity: 0; } to { opacity: 1; } }
        @keyframes gs-card     { from { opacity: 0; transform: scale(0.96) translateY(-10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .gs-backdrop { animation: gs-backdrop 0.15s ease both; }
        .gs-card     { animation: gs-card 0.18s cubic-bezier(0.23,1,0.32,1) both; }
        .gs-item { transition: background 0.08s; }
        .gs-item:hover, .gs-item-active { background: rgba(78,205,196,0.08); }
        .dark .gs-item:hover, .dark .gs-item-active { background: rgba(78,205,196,0.12); }
      `}</style>

      {/* Backdrop */}
      <div
        className="gs-backdrop fixed inset-0 z-[500] flex items-start justify-center pt-[12vh]"
        style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
        onClick={handleClose}
      >
        {/* Card */}
        <div
          className="gs-card relative w-full mx-4"
          style={{ maxWidth: 600, borderRadius: 16, background: 'var(--bg-primary)', boxShadow: '0 24px 64px rgba(0,0,0,0.28)', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Teal accent bar */}
          <div style={{ height: 3, background: `${BRAND.primary}` }} />

          {/* Search input row */}
          <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <Search size={18} className="shrink-0" style={{ color: TEAL }} />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search features, navigation, actions…"
              className="flex-1 bg-transparent text-[15px] outline-none"
              style={{ color: 'var(--text-primary)' }}
              autoComplete="off"
              spellCheck={false}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-100"
              >
                <X size={13} className="text-gray-400" />
              </button>
            )}
            <kbd
              className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', fontFamily: 'monospace', color: 'var(--text-muted)' }}
            >
              Esc
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="overflow-y-auto" style={{ maxHeight: 420 }}>
            {results.length === 0 && query ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Search size={28} className="text-gray-200" />
                <p className="text-sm text-gray-400">No results for <span className="font-semibold text-gray-500">"{query}"</span></p>
                <p className="text-xs text-gray-300">Try different keywords or browse navigation below.</p>
              </div>
            ) : results.length === 0 && !query ? (
              /* Empty state — show prompt */
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `${TEAL}15` }}>
                  <Search size={18} style={{ color: TEAL }} />
                </div>
                <p className="text-sm font-medium text-gray-500 mt-1">Search anything in MetryxOne</p>
                <p className="text-xs text-gray-400 text-center max-w-[260px]">
                  Find navigation sections, features, quick actions, exams, reports, mentors, and more.
                </p>
                <div className="flex flex-wrap gap-2 mt-3 justify-center">
                  {['Dashboard', 'LBI Assessment', 'Missions', 'Exam Readiness', 'Mentor', 'Rewards'].map(s => (
                    <button
                      key={s}
                      onClick={() => setQuery(s)}
                      className="text-[11px] px-2.5 py-1 rounded-full font-medium hover:opacity-80 transition-opacity"
                      style={{ background: `${BRAND.primary}10`, color: BRAND.primary }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-1.5">
                {orderedGroups.map(category => (
                  <div key={category}>
                    {/* Category header */}
                    <div className="px-4 pt-3 pb-1">
                      <p
                        className="text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: `${BRAND.primary}80` }}
                      >
                        {CATEGORY_LABELS[category]}
                      </p>
                    </div>

                    {/* Items */}
                    {grouped[category].map(item => {
                      const idx = globalIdx++;
                      const isActive = idx === active;
                      return (
                        <button
                          key={item.id}
                          ref={el => { itemRefs.current[idx] = el; }}
                          onClick={() => executeItem(item)}
                          onMouseEnter={() => setActive(idx)}
                          className={`gs-item w-full flex items-center gap-3 px-4 py-2.5 text-left ${isActive ? 'gs-item-active' : ''}`}
                        >
                          {/* Icon */}
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: `${item.iconColor}14` }}
                          >
                            <item.icon size={15} style={{ color: item.iconColor }} />
                          </div>

                          {/* Text */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-semibold text-gray-800 leading-none">{item.title}</span>
                              {item.badge && (
                                <span
                                  className="text-[9px] font-bold uppercase px-1.5 py-[1px] rounded-full leading-none"
                                  style={{
                                    background: item.badge === 'new' ? `${TEAL}18` : item.badge === 'core' ? `${BRAND.primary}14` : 'var(--bg-secondary)',
                                    color:      item.badge === 'new' ? TEAL : item.badge === 'core' ? BRAND.primary : 'var(--text-muted)',
                                  }}
                                >
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-400 mt-0.5 truncate leading-snug">{item.description}</p>
                          </div>

                          {/* Arrow hint when active */}
                          {isActive && (
                            <CornerDownLeft size={13} className="shrink-0" style={{ color: TEAL }} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="flex items-center gap-4 px-4 py-2.5"
            style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}
          >
            <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded font-mono text-[9px]" style={{ border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)' }}>↑</kbd>
                <kbd className="px-1 py-0.5 rounded font-mono text-[9px]" style={{ border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)' }}>↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded font-mono text-[9px]" style={{ border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)' }}>↵</kbd>
                select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded font-mono text-[9px]" style={{ border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)' }}>Esc</kbd>
                close
              </span>
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: TEAL }} />
              <span className="text-[10px] font-semibold" style={{ color: BRAND.primary }}>MetryxOne Search</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
