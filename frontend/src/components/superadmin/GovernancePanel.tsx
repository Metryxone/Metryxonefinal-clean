import { BRAND } from '@/design-system/tokens';
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity, Brain, FlaskConical, Flag, Search, RefreshCw, ChevronRight,
  ChevronDown, AlertTriangle, Cpu, Zap, TrendingUp, Eye, Play,
  CheckCircle, Clock, Info, Lightbulb, MousePointerClick, Sparkles, Radio,
  Wifi, WifiOff,
} from 'lucide-react';
import { useRuntimeSync } from '@/hooks/useRuntimeSync';
import type { RuntimeSyncEvent } from '@/hooks/useRuntimeSync';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import FeatureFlagsPanel from './FeatureFlagsPanel';



type SubTab = 'runtime-state' | 'explainability-log' | 'simulator' | 'feature-flags';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RuntimeStateRow {
  session_id:          string;
  concern_name:        string;
  stage_code:          string;
  guest_email:         string | null;
  status:              string;
  version:             number;
  updated_at:          string;
  contradiction_active: boolean;
  snapshot_count:      number;
}

interface RuntimeStateDetail {
  session_id: string;
  state:      Record<string, unknown>;
  version:    number;
  updated_at: string;
  history:    Array<{ snapshot_at: string; version: number; state: Record<string, unknown> }>;
}

interface ExplainabilityEvent {
  id:               string;
  session_id:       string;
  event_type:       string;
  sub_type:         string | null;
  reason_why:       string;
  hypothesis_label: string | null;
  value_before:     string | null;
  value_after:      string | null;
  occurred_at:      string;
}

interface SimulateResult {
  simulation_id:          string;
  concern_text:           string;
  persona:                string;
  hypotheses:             Array<{
    construct_key:    string;
    label:            string;
    confidence:       number;
    uncertainty:      number;
    reason_why:       string;
    lifecycle_state:  string;
    evidence_sources: string[];
  }>;
  top_3_confidence_scores: Array<{ label: string; confidence: number; construct_key: string }>;
  top_confidence_band:  string;
  predicted_questions:  Array<{
    id:                number | string;
    question_text:     string;
    focus_area:        string | null;
    construct_key:     string | null;
    adaptive_score:    number;
    adaptive_priority: number;
    confidence_gain:   number;
    reason:            string;
  }>;
  intervention_preview: Array<{
    construct_key:     string;
    confidence_band:   string;
    persona:           string;
    safety_level:      string;
    intervention_text: string;
  }>;
  scoring_weights: {
    hypothesis_relevance:   number;
    confidence_gain_factor: number;
    contradiction_probe:    number;
    base_priority_factor:   number;
    load_penalty:           number;
    note:                   string;
  };
  meta: { hypothesis_count: number; question_count: number; intervention_count: number; note: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Format an explainability event value_before / value_after.
 * Values arrive as strings from the DB. If a value looks like a 0-1 float
 * (e.g. "0.75") it is rendered as a percentage; otherwise shown as-is.
 */
function formatExplainValue(v: string | null): string {
  if (v === null) return '—';
  const n = parseFloat(v);
  if (!isNaN(n) && n >= 0 && n <= 1 && v.trim().startsWith('0.')) {
    return (n * 100).toFixed(1) + '%';
  }
  return v;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EventTypeBadge({ type, sub }: { type: string; sub?: string | null }) {
  const config: Record<string, { color: string; icon: React.ElementType; label: string }> = {
    hypothesis_generated:       { color: BRAND.primary, icon: Lightbulb,       label: 'Hypothesis' },
    confidence_update:          { color: '#6366f1',     icon: TrendingUp,       label: 'Confidence Update' },
    contradiction_detected:     { color: BRAND.danger,  icon: AlertTriangle,    label: 'Contradiction' },
    cognitive_load_snapshot:    { color: BRAND.warning, icon: Cpu,              label: 'Cognitive Load' },
    adaptive_question_selected: { color: BRAND.accent,  icon: MousePointerClick, label: 'Adaptive Q Selected' },
    intervention_triggered:     { color: BRAND.success, icon: Sparkles,         label: 'Intervention' },
  };
  const cfg = config[type] ?? { color: '#6b7280', icon: Info, label: type.replace(/_/g, ' ') };
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-white"
      style={{ backgroundColor: cfg.color }}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
      {sub && <span className="opacity-80">· {sub}</span>}
    </span>
  );
}

function JsonTree({ data, depth = 0 }: { data: unknown; depth?: number }) {
  const [open, setOpen] = useState(depth === 0);

  if (data === null || data === undefined) {
    return <span className="text-gray-400 text-xs italic">null</span>;
  }
  if (typeof data === 'boolean') {
    return <span className={`text-xs font-mono ${data ? 'text-green-600' : 'text-red-500'}`}>{String(data)}</span>;
  }
  if (typeof data === 'number') {
    return <span className="text-xs font-mono text-blue-600">{data}</span>;
  }
  if (typeof data === 'string') {
    return <span className="text-xs font-mono text-orange-600">"{data}"</span>;
  }
  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-gray-400 text-xs">[]</span>;
    return (
      <span>
        <button onClick={() => setOpen(!open)} className="text-xs text-gray-500 hover:text-gray-700">
          {open ? <ChevronDown className="inline h-3 w-3" /> : <ChevronRight className="inline h-3 w-3" />}
          <span className="ml-0.5">Array({data.length})</span>
        </button>
        {open && (
          <div className="ml-4 border-l border-gray-200 pl-2 mt-0.5 space-y-0.5">
            {data.map((item, i) => (
              <div key={i} className="flex gap-1 text-xs">
                <span className="text-gray-400">[{i}]</span>
                <JsonTree data={item} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }
  if (typeof data === 'object') {
    const keys = Object.keys(data as Record<string, unknown>);
    if (keys.length === 0) return <span className="text-gray-400 text-xs">{'{}'}</span>;
    return (
      <span>
        <button onClick={() => setOpen(!open)} className="text-xs text-gray-500 hover:text-gray-700">
          {open ? <ChevronDown className="inline h-3 w-3" /> : <ChevronRight className="inline h-3 w-3" />}
          <span className="ml-0.5 text-gray-600">{`{${keys.length} keys}`}</span>
        </button>
        {open && (
          <div className="ml-4 border-l border-gray-200 pl-2 mt-0.5 space-y-0.5">
            {keys.map((k) => (
              <div key={k} className="flex gap-1 text-xs flex-wrap">
                <span className="text-purple-600 font-mono shrink-0">{k}:</span>
                <JsonTree data={(data as Record<string, unknown>)[k]} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }
  return <span className="text-xs font-mono text-gray-700">{String(data)}</span>;
}

// ─── Named state sections (replaces raw JSON dump in drawer) ─────────────────

const STATE_SECTIONS: Array<{ keys: string[]; label: string; color: string }> = [
  { keys: ['hypotheses', 'active_hypotheses'],                    label: 'Hypotheses',             color: BRAND.primary  },
  { keys: ['confidence_scores', 'confidence'],                    label: 'Confidence Scores',      color: '#6366f1'      },
  { keys: ['emotional_state', 'emotion'],                         label: 'Emotional State',         color: '#ec4899'      },
  { keys: ['contradiction_state', 'contradictions', 'flags'],     label: 'Contradiction State',    color: BRAND.danger   },
  { keys: ['adaptive_runtime_state', 'adaptive_state'],           label: 'Adaptive Selection State', color: BRAND.accent },
  { keys: ['load_snapshot', 'cognitive_load', 'composite_load'],  label: 'Load Snapshot',          color: BRAND.warning  },
  { keys: ['signal_profile', 'signals'],                          label: 'Signal Profile',         color: '#8b5cf6'      },
];

function StateDetailSections({
  state,
  history,
}: {
  state:   Record<string, unknown>;
  history: Array<{ snapshot_at: string; version: number }>;
}) {
  const [rawOpen, setRawOpen] = useState(false);
  const matched = new Set<string>();

  return (
    <div className="space-y-4">
      {STATE_SECTIONS.map(({ keys, label, color }) => {
        // Find the first key in the state that matches this section
        const hit = keys.find((k) => Object.prototype.hasOwnProperty.call(state, k));
        if (!hit) return null;
        matched.add(hit);
        const value = state[hit];
        return (
          <div key={label}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600">{label}</h4>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-xs font-mono overflow-auto max-h-40 border-l-2" style={{ borderColor: color }}>
              <JsonTree data={value} depth={0} />
            </div>
          </div>
        );
      })}

      {/* Remaining / unknown keys */}
      {(() => {
        const remaining = Object.entries(state).filter(([k]) => !matched.has(k));
        if (!remaining.length) return null;
        return (
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2 h-2 rounded-full shrink-0 bg-gray-400" />
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600">Other Fields</h4>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-xs font-mono overflow-auto max-h-40">
              <JsonTree data={Object.fromEntries(remaining)} depth={0} />
            </div>
          </div>
        );
      })()}

      {/* Fallback: raw JSON toggle if no sections matched */}
      {matched.size === 0 && (
        <div>
          <button
            onClick={() => setRawOpen(!rawOpen)}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-1.5"
          >
            {rawOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Full State
          </button>
          {rawOpen && (
            <div className="bg-gray-50 rounded-lg p-4 text-xs font-mono overflow-auto max-h-80">
              <JsonTree data={state} depth={0} />
            </div>
          )}
        </div>
      )}

      {/* History timeline */}
      {history.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1.5">
            Snapshot History ({history.length})
          </h4>
          <div className="space-y-1.5">
            {history.map((snap, i) => (
              <div key={i} className="flex gap-2 items-center text-xs">
                <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: BRAND.primary }} />
                <span className="text-gray-500">
                  {new Date(snap.snapshot_at).toLocaleString()} · v{snap.version}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Live Event Row ───────────────────────────────────────────────────────────

const EVENT_TYPE_STYLES: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  hypothesis_generated:  { color: BRAND.primary,  icon: Lightbulb,    label: 'Hypothesis'     },
  confidence_updated:    { color: '#6366f1',       icon: TrendingUp,   label: 'Confidence'     },
  contradiction_detected:{ color: BRAND.danger,   icon: AlertTriangle, label: 'Contradiction' },
  cognitive_load_alert:  { color: BRAND.warning,  icon: Cpu,          label: 'Load Alert'     },
  stage_transitioned:    { color: BRAND.success,  icon: CheckCircle,  label: 'Stage Change'   },
  intervention_ready:    { color: BRAND.accent,   icon: Sparkles,     label: 'Intervention'   },
  state_updated:         { color: '#0ea5e9',       icon: Activity,     label: 'State Update'   },
  quality_updated:       { color: '#8b5cf6',       icon: Zap,          label: 'Quality'        },
};

function LiveEventRow({ event }: { event: RuntimeSyncEvent }) {
  const cfg = EVENT_TYPE_STYLES[event.type] ?? { color: '#6b7280', icon: Info, label: event.type.replace(/_/g, ' ') };
  const Icon = cfg.icon;
  return (
    <div className="flex items-start gap-2.5 rounded-lg border bg-white px-3 py-2 text-xs">
      <div
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded"
        style={{ backgroundColor: `${cfg.color}18` }}
      >
        <Icon className="h-3 w-3" style={{ color: cfg.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
          <span className="text-gray-400 ml-auto shrink-0 font-mono tabular-nums">
            {new Date(event.timestamp).toLocaleTimeString()}
          </span>
        </div>
        {event.explain && (
          <p className="text-gray-600 mt-0.5 leading-relaxed truncate" title={event.explain}>
            {event.explain}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Runtime State sub-tab ────────────────────────────────────────────────────

function RuntimeStateTab() {
  const [search, setSearch]             = useState('');
  const [debouncedSearch, setDebounced] = useState('');
  const [page, setPage]                 = useState(1);
  const [selected, setSelected]         = useState<RuntimeStateRow | null>(null);
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // Share the same ws-status query as FeatureFlagsPanel (polled every 5 s there).
  // Using the same query key means this component benefits from the running poll
  // without opening a second fetch cycle. Flag changes reflect within ~5 s.
  const { data: wsStatus } = useQuery({
    queryKey: ['admin-ff-ws-status'],
    queryFn: async () => {
      const r = await fetch('/api/admin/feature-flags/ws-status', { credentials: 'include' });
      if (!r.ok) return { enabled: false, active_sessions: 0 };
      return r.json() as Promise<{ enabled: boolean; active_sessions: number }>;
    },
    refetchInterval: 5_000,
  });
  const wsRuntimeEnabled = wsStatus?.enabled ?? false;

  // Live WS sync — only active when:
  //   • websocket_runtime feature flag is enabled
  //   • the drawer is open and a session is selected
  // Admin session cookie is sent automatically (same-origin WS upgrade) — no token needed.
  const { connectionState, latestEvent, runtimeEvents, clearEvents } = useRuntimeSync(
    wsRuntimeEnabled && drawerOpen ? selected?.session_id : null,
  );

  // Track the most recent stage_transitioned / intervention_ready events for the badge display
  const [lastTransition,    setLastTransition]    = useState<RuntimeSyncEvent | null>(null);
  const [lastIntervention,  setLastIntervention]  = useState<RuntimeSyncEvent | null>(null);

  // Clear badge state whenever the active session changes to prevent stale cross-session display
  useEffect(() => {
    setLastTransition(null);
    setLastIntervention(null);
  }, [selected?.session_id]);

  // Invalidate detail + list queries when relevant runtime events arrive
  useEffect(() => {
    if (!latestEvent || !selected) return;
    // Guard against stale events from a previous session arriving on the new session's feed
    if (latestEvent.session_id !== selected.session_id) return;
    const invalidatingTypes = [
      'confidence_updated', 'hypothesis_generated', 'state_updated',
      'contradiction_detected', 'stage_transitioned', 'intervention_ready',
    ];
    if (invalidatingTypes.includes(latestEvent.type)) {
      queryClient.invalidateQueries({ queryKey: ['gov-runtime-detail', selected.session_id] });
    }
    if (latestEvent.type === 'state_updated' || latestEvent.type === 'stage_transitioned') {
      queryClient.invalidateQueries({ queryKey: ['gov-runtime-state'] });
    }
    if (latestEvent.type === 'stage_transitioned')   setLastTransition(latestEvent);
    if (latestEvent.type === 'intervention_ready')   setLastIntervention(latestEvent);
  }, [latestEvent, selected, queryClient]);

  // Clear event feed and badge state whenever the drawer closes
  const closeDrawer = () => {
    setDrawerOpen(false);
    clearEvents();
    setLastTransition(null);
    setLastIntervention(null);
  };

  const PAGE_SIZE = 20;
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['gov-runtime-state', page, debouncedSearch],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (debouncedSearch) qs.set('search', debouncedSearch);
      const r = await fetch(`/api/admin/bios/runtime-state?${qs}`, { credentials: 'include' });
      const json = await r.json() as { rows: RuntimeStateRow[]; total: number; page: number; limit: number };
      // Backend does not include `pages` — derive it
      return { ...json, pages: Math.ceil((json.total ?? 0) / (json.limit ?? PAGE_SIZE)) };
    },
  });

  const { data: detail } = useQuery({
    queryKey: ['gov-runtime-detail', selected?.session_id],
    enabled:  !!selected && drawerOpen,
    queryFn: async () => {
      // Use admin-guarded routes (requireSuperAdmin) instead of unguarded /api/bios/…
      const [stateR, histR] = await Promise.all([
        fetch(`/api/admin/bios/runtime-state/${selected!.session_id}`, { credentials: 'include' }).then(r => r.json()),
        fetch(`/api/admin/bios/runtime-state/${selected!.session_id}/history`, { credentials: 'include' }).then(r => r.json()),
      ]);
      // Backend history endpoint returns { history: [...] } (not snapshots)
      return { ...stateR, history: histR.history ?? [] } as RuntimeStateDetail;
    },
  });

  const statusColor = (s: string) => s === 'completed' ? BRAND.success : s === 'in_progress' ? BRAND.primary : BRAND.warning;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by concern or email…" className="pl-10" />
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
        <span className="text-sm text-gray-500">{data?.total ?? 0} sessions</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <RefreshCw className="h-6 w-6 animate-spin" style={{ color: BRAND.primary }} />
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Session', 'Concern', 'Stage', 'Status', 'Version', 'Contradiction', 'Updated'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(data?.rows ?? []).map((row) => (
                <tr
                  key={row.session_id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => { setSelected(row); setDrawerOpen(true); }}
                >
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs text-gray-500">{row.session_id.slice(0, 8)}…</span>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-gray-800 max-w-[180px] truncate">{row.concern_name}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant="outline" className="text-xs">{row.stage_code}</Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="px-2 py-0.5 rounded-full text-xs text-white" style={{ backgroundColor: statusColor(row.status) }}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">v{row.version}</td>
                  <td className="px-4 py-2.5">
                    {row.contradiction_active
                      ? <AlertTriangle className="h-4 w-4 text-red-500" />
                      : <CheckCircle className="h-4 w-4 text-green-400" />}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{new Date(row.updated_at).toLocaleString()}</td>
                </tr>
              ))}
              {(data?.rows ?? []).length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No runtime states found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {(data?.pages ?? 1) > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="text-sm text-gray-500 self-center">Page {page} / {data?.pages}</span>
          <Button variant="outline" size="sm" disabled={page >= (data?.pages ?? 1)} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}

      {/* Detail Drawer */}
      {drawerOpen && selected && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={closeDrawer} />
          <div className="w-[640px] max-w-[95vw] bg-white shadow-2xl overflow-y-auto flex flex-col">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-800">Runtime State Detail</h3>
                  {connectionState === 'open' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <Radio className="h-3 w-3 animate-pulse" />
                      Live
                    </span>
                  )}
                  {connectionState === 'connecting' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      Connecting
                    </span>
                  )}
                  {!wsRuntimeEnabled && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-gray-400 border border-gray-200">
                      <WifiOff className="h-3 w-3" />
                      WS disabled
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 font-mono mt-0.5">{selected.session_id}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={closeDrawer}>✕</Button>
            </div>

            <div className="p-6 space-y-6 flex-1">
              {/* Meta */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Concern', selected.concern_name],
                  ['Stage', selected.stage_code],
                  ['Status', selected.status],
                  ['Version', `v${selected.version}`],
                  ['Snapshots', String(selected.snapshot_count)],
                  ['Email', selected.guest_email ?? '—'],
                ].map(([k, v]) => (
                  <div key={k} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">{k}</p>
                    <p className="text-sm font-medium text-gray-800 truncate">{v}</p>
                  </div>
                ))}
              </div>

              {/* ── Stage Transition & Intervention Ready Badges ────── */}
              {wsRuntimeEnabled && (lastTransition || lastIntervention) && (
                <div className="space-y-2">
                  {lastTransition && (() => {
                    const d = lastTransition.data as Record<string, unknown>;
                    const stageCode  = String(d.stage_code  ?? '');
                    const score      = typeof d.score === 'number' ? d.score : null;
                    const scoreLevel = String(d.score_level ?? '');
                    const hasNext    = Boolean(d.has_next);
                    const nextStage  = d.next_stage as { code?: string; label?: string } | null;
                    return (
                      <div
                        className="rounded-lg border-2 p-3 flex items-start gap-3"
                        style={{ borderColor: BRAND.success, backgroundColor: `${BRAND.success}0d` }}
                      >
                        <div
                          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                          style={{ backgroundColor: `${BRAND.success}22` }}
                        >
                          <CheckCircle className="h-4 w-4" style={{ color: BRAND.success }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: BRAND.success }}>
                              Stage Transitioned
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono ml-auto">
                              {new Date(lastTransition.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold text-white"
                              style={{ backgroundColor: BRAND.success }}
                            >
                              {stageCode}
                            </span>
                            {score !== null && (
                              <span className="text-xs text-gray-700 font-medium">
                                Score: <span className="font-mono font-bold">{score}</span>
                              </span>
                            )}
                            {scoreLevel && (
                              <span className="text-xs text-gray-500">· {scoreLevel}</span>
                            )}
                            {hasNext && nextStage && (
                              <>
                                <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                <span
                                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold text-white"
                                  style={{ backgroundColor: BRAND.primary }}
                                >
                                  {nextStage.code ?? ''}
                                </span>
                                {nextStage.label && (
                                  <span className="text-xs text-gray-500">{nextStage.label}</span>
                                )}
                              </>
                            )}
                            {!hasNext && (
                              <span className="text-xs font-medium" style={{ color: BRAND.accent }}>
                                · Final stage completed
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {lastIntervention && (() => {
                    const d          = lastIntervention.data as Record<string, unknown>;
                    const count      = typeof d.count === 'number' ? d.count : 0;
                    const priorities = Array.isArray(d.priorities) ? (d.priorities as string[]) : [];
                    return (
                      <div
                        className="rounded-lg border-2 p-3 flex items-start gap-3"
                        style={{ borderColor: BRAND.accent, backgroundColor: `${BRAND.accent}0d` }}
                      >
                        <div
                          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                          style={{ backgroundColor: `${BRAND.accent}22` }}
                        >
                          <Sparkles className="h-4 w-4" style={{ color: BRAND.accent }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: BRAND.accent }}>
                              Intervention Ready
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono ml-auto">
                              {new Date(lastIntervention.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold text-white"
                              style={{ backgroundColor: BRAND.accent }}
                            >
                              {count} intervention{count !== 1 ? 's' : ''} generated
                            </span>
                          </div>
                          {priorities.length > 0 && (
                            <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                              {priorities.map((p, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] bg-teal-50 text-teal-700 rounded px-1.5 py-0.5 border border-teal-200"
                                >
                                  {p}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* ── Live Event Feed ─────────────────────────────────── */}
              {wsRuntimeEnabled && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Wifi className="h-3.5 w-3.5" style={{ color: BRAND.accent }} />
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Live Event Feed
                    </h4>
                    {connectionState === 'open' && (
                      <span className="ml-auto text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                        <Radio className="h-2.5 w-2.5 animate-pulse" /> streaming
                      </span>
                    )}
                    {connectionState === 'connecting' && (
                      <span className="ml-auto text-[10px] text-amber-500 flex items-center gap-1">
                        <RefreshCw className="h-2.5 w-2.5 animate-spin" /> connecting…
                      </span>
                    )}
                    {(connectionState === 'closed' || connectionState === 'error') && (
                      <span className="ml-auto text-[10px] text-gray-400">waiting for connection</span>
                    )}
                  </div>

                  {runtimeEvents.length === 0 ? (
                    <div className="border border-dashed border-gray-200 rounded-lg px-4 py-6 text-center">
                      <Activity className="h-6 w-6 mx-auto mb-1.5 text-gray-300" />
                      <p className="text-xs text-gray-400">No events yet — events appear here as the session progresses.</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                      {runtimeEvents.map((ev, i) => (
                        <LiveEventRow key={`${ev.timestamp}-${i}`} event={ev} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* State JSONB — named sections */}
              {detail ? (
                <StateDetailSections state={detail.state} history={detail.history} />
              ) : (
                <div className="flex items-center justify-center h-24">
                  <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Explainability Log sub-tab ───────────────────────────────────────────────

function ExplainabilityLogTab() {
  const [page, setPage]             = useState(1);
  const [sessionFilter, setSession] = useState('');
  const [typeFilter, setType]       = useState('all');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['gov-expl-log', page, sessionFilter, typeFilter],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: String(page), limit: '25' });
      if (sessionFilter) qs.set('session_id', sessionFilter);
      if (typeFilter !== 'all') qs.set('event_type', typeFilter);
      const r = await fetch(`/api/admin/bios/explainability-log?${qs}`);
      return r.json() as Promise<{ events: ExplainabilityEvent[]; total: number; pages: number }>;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={sessionFilter}
            onChange={(e) => { setSession(e.target.value); setPage(1); }}
            placeholder="Filter by session ID…"
            className="pl-10 font-mono text-xs"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => { setType(v); setPage(1); }}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Event type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All event types</SelectItem>
            <SelectItem value="hypothesis_generated">Hypothesis Generated</SelectItem>
            <SelectItem value="confidence_update">Confidence Update</SelectItem>
            <SelectItem value="contradiction_detected">Contradiction</SelectItem>
            <SelectItem value="cognitive_load_snapshot">Cognitive Load</SelectItem>
            <SelectItem value="adaptive_question_selected">Adaptive Q Selected</SelectItem>
            <SelectItem value="intervention_triggered">Intervention Triggered</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
        <span className="text-sm text-gray-500">{data?.total ?? 0} events</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <RefreshCw className="h-6 w-6 animate-spin" style={{ color: BRAND.primary }} />
        </div>
      ) : (
        <div className="space-y-2">
          {(data?.events ?? []).map((ev) => (
            <div key={ev.id} className="bg-white rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <EventTypeBadge type={ev.event_type} sub={ev.sub_type} />
                {ev.hypothesis_label && (
                  <Badge variant="outline" className="text-xs">{ev.hypothesis_label}</Badge>
                )}
                <span className="text-xs text-gray-400 font-mono ml-auto">
                  <Clock className="inline h-3 w-3 mr-1" />
                  {new Date(ev.occurred_at).toLocaleString()}
                </span>
              </div>

              <p className="text-sm text-gray-700">{ev.reason_why}</p>

              {(ev.value_before !== null || ev.value_after !== null) && (
                <div className="flex gap-4 text-xs text-gray-500">
                  {ev.value_before !== null && (
                    <span>Before: <span className="font-mono font-medium text-gray-700">
                      {formatExplainValue(ev.value_before)}
                    </span></span>
                  )}
                  {ev.value_after !== null && (
                    <span>After: <span className="font-mono font-medium text-gray-700">
                      {formatExplainValue(ev.value_after)}
                    </span></span>
                  )}
                </div>
              )}

              <button
                className="text-xs text-indigo-500 hover:text-indigo-700 font-mono transition-colors text-left"
                title="Click to filter by this session"
                onClick={() => { setSession(ev.session_id); setPage(1); }}
              >
                session: {ev.session_id.slice(0, 16)}…
                <span className="ml-1 text-indigo-400 opacity-70">(filter ↗)</span>
              </button>
            </div>
          ))}
          {(data?.events ?? []).length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No explainability events found</p>
              <p className="text-xs mt-1">Events are generated as sessions run through the intelligence engines.</p>
            </div>
          )}
        </div>
      )}

      {(data?.pages ?? 1) > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="text-sm text-gray-500 self-center">Page {page} / {data?.pages}</span>
          <Button variant="outline" size="sm" disabled={page >= (data?.pages ?? 1)} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}

// ─── Runtime Simulator sub-tab ────────────────────────────────────────────────

function SimulatorTab() {
  const [concernText, setConcern] = useState('');
  const [persona, setPersona]     = useState('student');
  const [result, setResult]       = useState<SimulateResult | null>(null);
  const [showRaw, setShowRaw]     = useState(false);
  const { toast } = useToast();

  const simulate = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/admin/bios/simulate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ concern_text: concernText.trim(), persona }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error((e as { error?: string }).error ?? 'Simulation failed');
      }
      return r.json() as Promise<SimulateResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      toast({ title: 'Simulation complete', description: `${data.meta.hypothesis_count} hypotheses generated.` });
    },
    onError: (err: Error) => {
      toast({ title: 'Simulation failed', description: err.message, variant: 'destructive' });
    },
  });

  const bandColor = (band: string) =>
    band === 'high' ? BRAND.success : band === 'moderate' ? BRAND.warning : BRAND.danger;

  const safetyColor = (s: string) =>
    s === 'informational' ? BRAND.success : s === 'supportive' ? BRAND.accent : BRAND.danger;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Input form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FlaskConical className="h-4 w-4" style={{ color: BRAND.purple }} />
            Dry-run Simulation
          </CardTitle>
          <p className="text-xs text-gray-500">Runs a concern through S3 hypothesis generation → S4 confidence scoring → question prediction → intervention preview. No database records are created.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Concern text</Label>
            <Input
              value={concernText}
              onChange={(e) => setConcern(e.target.value)}
              placeholder="e.g. my child can't focus in school…"
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Persona</Label>
            <Select value={persona} onValueChange={setPersona}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="parent">Parent</SelectItem>
                <SelectItem value="teacher">Teacher</SelectItem>
                <SelectItem value="counsellor">Counsellor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => simulate.mutate()}
            disabled={simulate.isPending || concernText.trim().length < 2}
            style={{ backgroundColor: BRAND.purple }}
            className="text-white"
          >
            {simulate.isPending ? (
              <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Simulating…</>
            ) : (
              <><Play className="h-4 w-4 mr-2" /> Simulate</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Meta banner + view toggle */}
          <div className="rounded-lg p-4 text-sm text-white flex items-center gap-3 flex-wrap" style={{ backgroundColor: BRAND.purple }}>
            <CheckCircle className="h-5 w-5 shrink-0" />
            <div>
              <span className="font-semibold">Simulation complete</span>
              <span className="mx-2 opacity-70">·</span>
              <span>{result.meta.hypothesis_count} hypotheses</span>
              <span className="mx-2 opacity-70">·</span>
              <span>{result.meta.question_count} predicted questions</span>
              <span className="mx-2 opacity-70">·</span>
              <span>{result.meta.intervention_count} intervention templates</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs opacity-70">{result.meta.note}</span>
              <button
                onClick={() => setShowRaw(r => !r)}
                className="text-xs border border-white/40 rounded px-2 py-0.5 hover:bg-white/10 transition-colors"
              >
                {showRaw ? 'Card view' : 'Raw JSON'}
              </button>
            </div>
          </div>

          {/* Raw JSON tree view */}
          {showRaw ? (
            <div className="rounded-lg border bg-gray-950 p-4 overflow-auto max-h-[600px]">
              <pre className="text-xs text-green-300 whitespace-pre-wrap break-all">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          ) : null}

          {/* Card sections — hidden when raw JSON view is active */}
          {!showRaw && <>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="h-4 w-4" style={{ color: BRAND.primary }} />
                S3 Hypotheses ({result.hypotheses.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.hypotheses.map((h) => (
                <div key={h.construct_key} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm text-gray-800">{h.label}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-xs font-mono">{h.construct_key}</Badge>
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: bandColor(h.confidence >= 0.65 ? 'high' : h.confidence >= 0.4 ? 'moderate' : 'low') }}
                      >
                        {(h.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  {/* Confidence bar */}
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${h.confidence * 100}%`, backgroundColor: bandColor(h.confidence >= 0.65 ? 'high' : h.confidence >= 0.4 ? 'moderate' : 'low') }}
                    />
                  </div>
                  <p className="text-xs text-gray-500">{h.reason_why}</p>
                  <div className="flex gap-1 flex-wrap">
                    {h.evidence_sources.map((s) => (
                      <span key={s} className="text-xs bg-blue-50 text-blue-700 rounded px-1.5 py-0.5">{s}</span>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Predicted questions */}
          {result.predicted_questions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4" style={{ color: BRAND.warning }} />
                  Predicted Question Selection Order (top {result.predicted_questions.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.predicted_questions.map((q, i) => (
                  <div key={q.id} className="flex gap-3 border rounded-lg p-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5"
                      style={{ backgroundColor: BRAND.primary }}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-sm text-gray-800">{q.question_text}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                        {q.focus_area && <Badge variant="outline" className="text-xs">{q.focus_area}</Badge>}
                        {q.construct_key && <Badge variant="outline" className="text-xs font-mono">{q.construct_key}</Badge>}
                        <span>S7 score: <span className="font-mono font-medium text-indigo-600">{(q.adaptive_score * 100).toFixed(0)}%</span></span>
                        <span>priority: <span className="font-mono">{q.adaptive_priority}</span></span>
                        <span>gain: <span className="font-mono">{(q.confidence_gain * 100).toFixed(0)}%</span></span>
                      </div>
                      <p className="text-xs text-gray-400 italic">{q.reason}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Intervention preview */}
          {result.intervention_preview.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="h-4 w-4" style={{ color: BRAND.accent }} />
                  Intervention Preview ({result.intervention_preview.length})
                  <Badge variant="outline" className="ml-1 text-xs"
                    style={{ borderColor: bandColor(result.top_confidence_band), color: bandColor(result.top_confidence_band) }}>
                    {result.top_confidence_band} confidence band
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.intervention_preview.map((iv, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">{iv.construct_key}</Badge>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                        style={{ backgroundColor: safetyColor(iv.safety_level) }}
                      >
                        {iv.safety_level}
                      </span>
                      <span className="text-xs text-gray-400">persona: {iv.persona}</span>
                    </div>
                    <p className="text-sm text-gray-700">{iv.intervention_text}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* S7 Scoring weights transparency panel */}
          {result.scoring_weights && (
            <div className="rounded-lg border bg-gray-50 p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                S7 Scoring Engine Weights (Phase 1 — identical to production)
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {([
                  ['Hypothesis Relevance', result.scoring_weights.hypothesis_relevance],
                  ['Confidence Gain',      result.scoring_weights.confidence_gain_factor],
                  ['Contradiction Probe',  result.scoring_weights.contradiction_probe],
                  ['Base Priority',        result.scoring_weights.base_priority_factor],
                  ['Load Penalty (−)',     result.scoring_weights.load_penalty],
                ] as [string, number][]).map(([label, w]) => (
                  <div key={label} className="bg-white rounded p-2 border">
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="text-sm font-semibold font-mono" style={{ color: BRAND.primary }}>
                      {(w * 100).toFixed(0)}%
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 italic">{result.scoring_weights.note}</p>
            </div>
          )}
          </>}
        </div>
      )}
    </div>
  );
}

// ─── Main GovernancePanel ─────────────────────────────────────────────────────

const TABS: { id: SubTab; label: string; icon: React.ElementType }[] = [
  { id: 'runtime-state',     label: 'Runtime State',     icon: Activity },
  { id: 'explainability-log', label: 'Explainability Log', icon: Brain },
  { id: 'simulator',         label: 'Runtime Simulator', icon: FlaskConical },
  { id: 'feature-flags',     label: 'Feature Flags',     icon: Flag },
];

export default function GovernancePanel() {
  const [activeTab, setActiveTab] = useState<SubTab>('runtime-state');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: BRAND.primary }}>Governance & Explainability</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Observe, understand, and govern every Phase 1 intelligence system in real-time.
          </p>
        </div>
        <Badge className="text-white text-xs" style={{ backgroundColor: BRAND.purple }}>
          Phase 1 S11
        </Badge>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all flex-1 justify-center ${
              activeTab === id ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'runtime-state'      && <RuntimeStateTab />}
      {activeTab === 'explainability-log' && <ExplainabilityLogTab />}
      {activeTab === 'simulator'          && <SimulatorTab />}
      {activeTab === 'feature-flags'      && (
        <div className="rounded-lg border bg-white p-6">
          <FeatureFlagsPanel />
        </div>
      )}
    </div>
  );
}
