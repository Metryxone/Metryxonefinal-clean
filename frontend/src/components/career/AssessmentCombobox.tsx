import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Check, Search, Sparkles, Plus, X } from 'lucide-react';
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';

export interface ComboItem {
  value: string;
  label: string;
  meta?: string;
  group?: string;
  groupOrder?: number;
}

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  items: ComboItem[];
  suggestions?: ComboItem[];
  suggestionsLabel?: string;
  suggestionsLoading?: boolean;
  allowFreeText?: boolean;
  placeholder?: string;
  emptyText?: string;
  brandColor?: string;
  caption?: React.ReactNode;
  badge?: React.ReactNode;
  testId?: string;
  borderColor?: string;
  /** When provided, items whose `meta === 'Custom'` render an inline ✕ that
   *  invokes this callback (used to remove user-added custom entries). */
  onRemoveItem?: (value: string) => void;
}

/**
 * Predictive typeahead input.
 *
 * - Renders as a real text input (not a click-to-open dropdown button) so the
 *   field feels like typing, not selecting. Opens the suggestion popover on
 *   focus; the popover is anchored to the input wrapper so width matches.
 * - Arrow/Enter keys typed on the input are forwarded to cmdk's hidden
 *   CommandInput so keyboard users can navigate + select results without
 *   moving focus.
 * - `allowFreeText=false` (roles/industries): only items committed via select
 *   are stored. Enter on an exact-match label still commits.
 * - `allowFreeText=true`: typed-but-unmatched text becomes a "Use <text>"
 *   option at the bottom of the list.
 */
export function AssessmentCombobox({
  label, value, onChange, items, suggestions = [], suggestionsLabel = 'Suggested for you',
  suggestionsLoading = false, allowFreeText = true,
  placeholder = 'Search or type\u2026', emptyText = 'No matches',
  brandColor = '#344E86', caption, badge, testId, borderColor, onRemoveItem,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cmdInputRef = useRef<HTMLInputElement | null>(null);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [anchorWidth, setAnchorWidth] = useState<number | null>(null);

  // Render the canonical label for the committed value (e.g. "junior" → "Junior").
  const displayLabel = useMemo(() => {
    if (!value) return '';
    const all = [...suggestions, ...items];
    return all.find(i => i.value === value)?.label || value;
  }, [value, items, suggestions]);

  // Sync the input text with the committed value when closed.
  useEffect(() => { if (!open) setDraft(displayLabel); }, [open, displayLabel]);

  // Measure anchor width so popover content matches exactly.
  useEffect(() => {
    if (!open || !anchorRef.current) return;
    setAnchorWidth(anchorRef.current.getBoundingClientRect().width);
  }, [open]);

  const { suggested, mainGroups } = useMemo(() => {
    const valueLower = (value || '').trim().toLowerCase();
    const sugSeen = new Set<string>();
    const suggested = suggestions.filter(s => {
      const k = s.label.toLowerCase();
      if (sugSeen.has(k)) return false;
      sugSeen.add(k);
      return true;
    });
    const sugKeys = new Set(suggested.map(s => s.label.toLowerCase()));
    const filtered = items.filter(i => !sugKeys.has(i.label.toLowerCase()));
    // Partition by `group` so custom entries can render in their own labelled
    // CommandGroup pinned to the top. Items without `group` fall into the
    // default catalog group (rendered without a heading when it's the only
    // group, otherwise headed "All options"). `groupOrder` ascending wins;
    // items within a group are sorted alphabetically with the selected value
    // pinned first so it stays visible after commit.
    const buckets = new Map<string, { name: string; order: number; items: ComboItem[] }>();
    for (const it of filtered) {
      const name = it.group || '';
      const order = it.groupOrder ?? (name ? 0 : 1000);
      const b = buckets.get(name) || { name, order, items: [] };
      // Keep the smallest groupOrder seen for the bucket
      if (order < b.order) b.order = order;
      b.items.push(it);
      buckets.set(name, b);
    }
    const groups = Array.from(buckets.values())
      .map(b => ({
        ...b,
        items: b.items.slice().sort((a, b2) => {
          const av = a.label.toLowerCase() === valueLower ? -1 : 0;
          const bv = b2.label.toLowerCase() === valueLower ? -1 : 0;
          return av - bv || a.label.localeCompare(b2.label);
        }),
      }))
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    return { suggested, mainGroups: groups };
  }, [items, suggestions, value]);

  // Flat list of all main-group items — used by filterFn callers and the
  // exact-match Enter handler.
  const main = useMemo(() => mainGroups.flatMap(g => g.items), [mainGroups]);

  const filterFn = useCallback(
    (i: ComboItem) =>
      !draft || i.label.toLowerCase().includes(draft.toLowerCase()) ||
      (i.meta || '').toLowerCase().includes(draft.toLowerCase()),
    [draft],
  );

  const allVisible = useMemo(
    () => [...suggested.filter(filterFn), ...main.filter(filterFn).slice(0, 60)],
    [suggested, main, filterFn],
  );

  // Closest-match fallback. When the user types something with no substring
  // match in the catalog (e.g. "Startup Founder" against an IT-focused role
  // list), surface the top fuzzy matches by token overlap so the user can
  // still pick a canonical option instead of being left with only "Use …".
  // Mirrors the CAPADEX concern-area selector UX.
  const closestMatches = useMemo<ComboItem[]>(() => {
    const q = draft.trim().toLowerCase();
    if (q.length < 2) return [];
    if (allVisible.length > 0) return []; // substring matches already exist
    const tokenize = (s: string) =>
      new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length >= 2));
    const qt = tokenize(q);
    if (qt.size === 0) return [];
    const seen = new Set<string>();
    const scored: { item: ComboItem; score: number }[] = [];
    for (const it of [...suggested, ...main]) {
      const key = it.label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const it_t = tokenize(`${it.label} ${it.meta || ''}`);
      let shared = 0;
      qt.forEach(t => { if (it_t.has(t)) shared++; });
      // Token-overlap (Jaccard-like) + char-trigram boost for typos.
      const jaccard = shared / Math.max(1, qt.size + it_t.size - shared);
      let trigram = 0;
      if (q.length >= 3 && key.length >= 3) {
        const grams = (s: string) => { const g = new Set<string>(); for (let i = 0; i <= s.length - 3; i++) g.add(s.slice(i, i + 3)); return g; };
        const qg = grams(q); const ig = grams(key);
        let inter = 0; qg.forEach(g => { if (ig.has(g)) inter++; });
        trigram = inter / Math.max(1, qg.size);
      }
      const score = jaccard * 1.2 + trigram * 0.8;
      if (score > 0.05) scored.push({ item: it, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 6).map(s => s.item);
  }, [draft, allVisible.length, suggested, main]);

  const showAddFreeText = allowFreeText && draft.trim() &&
    !suggested.some(s => s.label.toLowerCase() === draft.trim().toLowerCase()) &&
    !main.some(m => m.label.toLowerCase() === draft.trim().toLowerCase());

  const select = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onChange('');
    setDraft('');
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // Forward Arrow/Enter to cmdk's hidden CommandInput so keyboard navigation
  // through results works without focus leaving the visible input.
  const forwardToCmdk = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const target = cmdInputRef.current;
    if (!target) return;
    const ev = new KeyboardEvent('keydown', {
      key: e.key, code: e.code, bubbles: true, cancelable: true,
    });
    target.dispatchEvent(ev);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!open) { setOpen(true); return; }
      e.preventDefault();
      forwardToCmdk(e);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (open) {
        // Let cmdk pick the highlighted item.
        forwardToCmdk(e);
        return;
      }
      const exact = [...suggested, ...main].find(i => i.label.toLowerCase() === draft.trim().toLowerCase());
      if (exact) select(exact.value);
      else if (allowFreeText && draft.trim()) select(draft.trim());
    }
  };

  return (
    <div>
      <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 flex items-center gap-1">
        {label}
        {badge}
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div
            ref={anchorRef}
            className="w-full h-9 px-3 text-xs border rounded-lg bg-white flex items-center gap-2 focus-within:ring-2 focus-within:ring-offset-0 hover:border-gray-300"
            style={{ borderColor: borderColor || '#e5e7eb' }}
          >
            <Search size={13} className="text-gray-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              data-testid={testId}
              value={open ? draft : displayLabel}
              placeholder={placeholder}
              onFocus={() => { setDraft(''); setOpen(true); }}
              onChange={(e) => { setDraft(e.target.value); if (!open) setOpen(true); }}
              onKeyDown={onKeyDown}
              className="flex-1 bg-transparent outline-none text-xs text-gray-800 placeholder:text-gray-400 truncate"
              autoComplete="off"
              spellCheck={false}
            />
            {value && (
              <button
                type="button"
                onClick={clear}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clear(e as any); } }}
                className="text-gray-300 hover:text-gray-500 shrink-0"
                aria-label={`Clear ${label}`}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => {
            // Radix treats clicks on the Anchor (our input) as "outside"
            // since we're not using a Trigger. Cancel the close so the
            // popover doesn't flash open-and-shut when the user clicks
            // the input to focus it.
            if (anchorRef.current && anchorRef.current.contains(e.target as Node)) {
              e.preventDefault();
            }
          }}
          onFocusOutside={(e) => {
            if (anchorRef.current && anchorRef.current.contains(e.target as Node)) {
              e.preventDefault();
            }
          }}
          className="p-0 max-w-none"
          style={anchorWidth ? { width: anchorWidth } : undefined}
        >
          <Command shouldFilter={false} className="rounded-lg">
            {/* Hidden CommandInput that receives forwarded key events for nav.
                Wrapped in sr-only so both the cmdk input wrapper (icon + border)
                and the input itself are visually hidden. */}
            <div className="sr-only" aria-hidden="true">
              <CommandInput ref={cmdInputRef} value={draft} onValueChange={setDraft} />
            </div>
            <CommandList className="max-h-72">
              {suggestionsLoading && (
                <div className="py-2 px-3 text-[10px] text-gray-400">Loading suggestions\u2026</div>
              )}
              {suggested.filter(filterFn).length > 0 && (
                <CommandGroup
                  heading={
                    <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider"
                          style={{ color: brandColor }}>
                      <Sparkles size={10} /> {suggestionsLabel}
                    </span>
                  }
                >
                  {suggested.filter(filterFn).map(s => (
                    <CommandItem
                      key={`sug:${s.value}`}
                      value={s.value}
                      onSelect={() => select(s.value)}
                      className="text-xs cursor-pointer"
                    >
                      <Check size={12} className={value === s.value ? 'opacity-100' : 'opacity-0'} style={{ color: brandColor }} />
                      <span className="ml-2 flex-1 truncate">{s.label}</span>
                      {s.meta && <span className="text-[10px] text-gray-400 ml-2 shrink-0">{s.meta}</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {(() => {
                // Render each main bucket as its own CommandGroup so custom
                // entries surface under "Your custom roles/industries" at the
                // top, distinct from the canonical catalog. 60-item cap is
                // applied to the *combined* visible main list (after group
                // filtering) so a giant custom list can't crowd out catalog.
                const visibleGroups = mainGroups
                  .map(g => ({ ...g, visible: g.items.filter(filterFn) }))
                  .filter(g => g.visible.length > 0);
                const namedExists = visibleGroups.some(g => !!g.name);
                let remaining = 60;
                return visibleGroups.map(g => {
                  if (remaining <= 0) return null;
                  const slice = g.visible.slice(0, remaining);
                  remaining -= slice.length;
                  const heading = g.name
                    ? <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-600">{g.name}</span>
                    : (suggested.length > 0 || namedExists)
                      ? <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">All options</span>
                      : undefined;
                  return (
                    <CommandGroup key={g.name || '__default'} heading={heading}>
                      {slice.map(m => {
                        const removable = m.meta === 'Custom' && !!onRemoveItem;
                        return (
                          <CommandItem
                            key={`opt:${m.value}`}
                            value={m.value}
                            onSelect={() => select(m.value)}
                            className="text-xs cursor-pointer group"
                          >
                            <Check size={12} className={value === m.value ? 'opacity-100' : 'opacity-0'} style={{ color: brandColor }} />
                            <span className="ml-2 flex-1 truncate">{m.label}</span>
                            {m.meta && (
                              <span
                                className={`text-[10px] ml-2 shrink-0 ${m.meta === 'Custom' ? 'text-violet-600 font-semibold' : 'text-gray-400'}`}
                              >
                                {m.meta}
                              </span>
                            )}
                            {removable && (
                              <button
                                type="button"
                                aria-label={`Remove custom entry ${m.label}`}
                                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemoveItem!(m.value); }}
                                className="ml-1.5 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-violet-100 text-violet-500 hover:text-violet-700 transition"
                              >
                                <X size={10} />
                              </button>
                            )}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  );
                });
              })()}
              {closestMatches.length > 0 && (
                <CommandGroup
                  heading={
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                      Closest matches
                    </span>
                  }
                >
                  {closestMatches.map(m => (
                    <CommandItem
                      key={`near:${m.value}`}
                      value={`near:${m.value}`}
                      onSelect={() => select(m.value)}
                      className="text-xs cursor-pointer"
                    >
                      <Check size={12} className={value === m.value ? 'opacity-100' : 'opacity-0'} style={{ color: brandColor }} />
                      <span className="ml-2 flex-1 truncate">{m.label}</span>
                      {m.meta && <span className="text-[10px] text-gray-400 ml-2 shrink-0">{m.meta}</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {showAddFreeText && (
                <CommandGroup>
                  <CommandItem
                    value={`__add:${draft}`}
                    onSelect={() => select(draft.trim())}
                    className="text-xs cursor-pointer"
                  >
                    <Plus size={12} style={{ color: brandColor }} />
                    <span className="ml-2">Use <strong>"{draft.trim()}"</strong></span>
                    <span className="ml-auto text-[10px] text-gray-400">custom entry</span>
                  </CommandItem>
                </CommandGroup>
              )}
              {!suggestionsLoading && allVisible.length === 0 && closestMatches.length === 0 && !showAddFreeText && (
                <CommandEmpty className="text-xs text-gray-400 py-4">{emptyText}</CommandEmpty>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {caption && <div className="text-[9.5px] text-gray-400 mt-1 leading-tight truncate">{caption}</div>}
    </div>
  );
}
