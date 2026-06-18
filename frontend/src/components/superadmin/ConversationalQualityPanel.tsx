import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardData {
  flag_active:             boolean;
  total_sessions:          number;
  avg_quality:             number;
  avg_safety:              number;
  avg_adaptation:          number;
  sessions_with_directives: number;
  directive_frequency:     Record<string, number>;
  quality_distribution:    { bucket: string; count: number }[];
  worst_sessions:          WorstSession[];
  quality_trend:           { day: string; avg_quality: number; avg_safety: number; session_count: number }[];
}

interface WorstSession {
  session_id:     string;
  avg_quality:    number;
  avg_safety:     number;
  avg_adaptation: number;
  directive_count: number;
  last_directives: string[];
  snapshot_count:  number;
}

interface QualitySession {
  session_id:       string;
  avg_quality:      number;
  avg_safety:       number;
  avg_adaptation:   number;
  avg_orchestration: number;
  max_directives:   number;
  last_directives:  string[];
  snapshot_count:   number;
  last_evaluated:   string;
}

interface SessionsData {
  sessions: QualitySession[];
  total:    number;
  page:     number;
  limit:    number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DIRECTIVE_LABELS: Record<string, string> = {
  simplify_runtime:           'Simplify Runtime',
  reduce_adaptation_intensity: 'Reduce Intensity',
  trigger_fallback_flow:      'Fallback Flow',
  slow_pacing:                'Slow Pacing',
  prevent_escalation:         'Prevent Escalation',
};

const DIRECTIVE_COLORS: Record<string, string> = {
  simplify_runtime:           'bg-blue-100 text-blue-700',
  reduce_adaptation_intensity: 'bg-yellow-100 text-yellow-700',
  trigger_fallback_flow:      'bg-red-100 text-red-700',
  slow_pacing:                'bg-orange-100 text-orange-700',
  prevent_escalation:         'bg-purple-100 text-purple-700',
};

function qualityColor(score: number): string {
  if (score >= 75) return 'text-green-600';
  if (score >= 55) return 'text-yellow-600';
  if (score >= 35) return 'text-orange-600';
  return 'text-red-600';
}

function qualityBg(score: number): string {
  if (score >= 75) return 'bg-green-500';
  if (score >= 55) return 'bg-yellow-500';
  if (score >= 35) return 'bg-orange-500';
  return 'bg-red-500';
}

function ScoreBar({ value, color }: { value: number; color?: string }) {
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all ${color ?? qualityBg(value)}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className={`text-xs font-semibold w-8 text-right ${qualityColor(value)}`}>
        {value.toFixed(0)}
      </span>
    </div>
  );
}

function KPICard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</span>
      <span className={`text-2xl font-bold ${color ?? 'text-gray-800'}`}>{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  );
}

// ─── Worst sessions drawer ────────────────────────────────────────────────────

function SessionRow({ s, onClick, selected }: { s: QualitySession; onClick: () => void; selected: boolean }) {
  return (
    <tr
      className={`cursor-pointer hover:bg-blue-50 transition-colors ${selected ? 'bg-blue-50' : ''}`}
      onClick={onClick}
    >
      <td className="px-4 py-3 font-mono text-xs text-gray-500 max-w-[160px] truncate">
        {s.session_id.slice(0, 16)}…
      </td>
      <td className="px-4 py-3">
        <ScoreBar value={s.avg_quality} />
      </td>
      <td className="px-4 py-3">
        <ScoreBar value={s.avg_safety} color="bg-purple-500" />
      </td>
      <td className="px-4 py-3">
        <ScoreBar value={s.avg_adaptation} color="bg-blue-500" />
      </td>
      <td className="px-4 py-3 text-center">
        {s.max_directives > 0 ? (
          <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
            {s.max_directives}
          </span>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-gray-400">
        {new Date(s.last_evaluated).toLocaleDateString()}
      </td>
    </tr>
  );
}

function SessionDrawer({ session, onClose }: { session: QualitySession; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ['quality-history', session.session_id],
    queryFn: () =>
      fetch(`/api/bios/quality/${session.session_id}/history`, { credentials: 'include' })
        .then(r => r.json()),
    staleTime: 30_000,
  });

  const history: any[] = data?.history ?? [];
  const latest = history[history.length - 1];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-[480px] bg-white h-full shadow-2xl overflow-y-auto flex flex-col">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-800">Quality Profile</h3>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{session.session_id}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>

        {/* Score hero */}
        <div className="p-5 bg-gradient-to-br from-slate-50 to-white border-b border-gray-100">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className={`text-4xl font-black ${qualityColor(session.avg_quality)}`}>
                {session.avg_quality.toFixed(0)}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">Overall Quality</div>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-3">
              {[
                { label: 'Safety', value: session.avg_safety, color: 'text-purple-600' },
                { label: 'Adaptation', value: session.avg_adaptation, color: 'text-blue-600' },
                { label: 'Orchestration', value: session.avg_orchestration, color: 'text-teal-600' },
                { label: 'Snapshots', value: session.snapshot_count, color: 'text-gray-600' },
              ].map(m => (
                <div key={m.label} className="text-center">
                  <div className={`text-lg font-bold ${m.color}`}>{typeof m.value === 'number' ? m.value.toFixed(0) : m.value}</div>
                  <div className="text-xs text-gray-400">{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Active directives */}
        {session.last_directives.length > 0 && (
          <div className="p-5 border-b border-gray-100">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Active Directives</h4>
            <div className="flex flex-wrap gap-2">
              {session.last_directives.map(d => (
                <span key={d} className={`text-xs font-semibold px-2.5 py-1 rounded-full ${DIRECTIVE_COLORS[d] ?? 'bg-gray-100 text-gray-600'}`}>
                  {DIRECTIVE_LABELS[d] ?? d}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Latest dimension scores */}
        {latest && (
          <div className="p-5 border-b border-gray-100">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Latest Quality Dimensions</h4>
            <div className="space-y-2">
              {[
                { label: 'Coherence',       value: latest.conversational_coherence },
                { label: 'Engagement',      value: latest.engagement_quality },
                { label: 'Emotional Safety', value: latest.emotional_safety },
                { label: 'Smoothness',      value: latest.conversational_smoothness },
                { label: 'Effectiveness',   value: latest.adaptive_effectiveness },
                { label: 'Evidence Quality', value: latest.evidence_quality },
                { label: 'Friction (inv)',  value: 100 - latest.runtime_friction },
                { label: 'Energy (inv)',    value: 100 - latest.user_fatigue },
              ].map(d => (
                <div key={d.label} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-32 shrink-0">{d.label}</span>
                  <ScoreBar value={parseFloat(d.value)} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quality trend sparkline */}
        {history.length > 1 && (
          <div className="p-5">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Quality Over Time</h4>
            <div className="flex items-end gap-1 h-16">
              {history.map((h, i) => {
                const q = parseFloat(h.overall_quality_score);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`Q${i + 1}: ${q.toFixed(0)}`}>
                    <div
                      className={`w-full rounded-t ${qualityBg(q)} transition-all`}
                      style={{ height: `${(q / 100) * 56}px` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Start</span>
              <span>Latest</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function ConversationalQualityPanel() {
  const [tab, setTab]             = useState<'dashboard' | 'sessions'>('dashboard');
  const [page, setPage]           = useState(1);
  const [onlyRisk, setOnlyRisk]   = useState(false);
  const [selected, setSelected]   = useState<QualitySession | null>(null);

  const { data: dashboard, isLoading: loadingDash } = useQuery<DashboardData>({
    queryKey: ['quality-dashboard'],
    queryFn: () =>
      fetch('/api/admin/quality/dashboard', { credentials: 'include' }).then(r => r.json()),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: sessionsData, isLoading: loadingSessions } = useQuery<SessionsData>({
    queryKey: ['quality-sessions', page, onlyRisk],
    queryFn: () =>
      fetch(`/api/admin/quality/sessions?page=${page}&limit=20&only_risk=${onlyRisk}`, { credentials: 'include' })
        .then(r => r.json()),
    staleTime: 30_000,
    enabled: tab === 'sessions',
  });

  if (!dashboard?.flag_active && !loadingDash) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-2">
        <div className="text-4xl">⚙️</div>
        <p className="text-sm font-medium">Conversational Quality Engine is disabled</p>
        <p className="text-xs">Enable the <code className="bg-gray-100 px-1 rounded">conversational_quality</code> feature flag to activate.</p>
      </div>
    );
  }

  const d = dashboard;
  const totalDirectiveTriggers = Object.values(d?.directive_frequency ?? {}).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Conversational Quality Intelligence</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Runtime quality monitoring across 8 dimensions — safety, coherence, engagement, and more
          </p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['dashboard', 'sessions'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                tab === t ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {tab === 'dashboard' && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              label="Avg Quality Score"
              value={d ? `${d.avg_quality.toFixed(0)}/100` : '—'}
              sub="All sessions"
              color={qualityColor(d?.avg_quality ?? 0)}
            />
            <KPICard
              label="Emotional Safety Index"
              value={d ? `${d.avg_safety.toFixed(0)}/100` : '—'}
              sub="Avg safety score"
              color="text-purple-600"
            />
            <KPICard
              label="Adaptation Quality"
              value={d ? `${d.avg_adaptation.toFixed(0)}/100` : '—'}
              sub="Evidence + effectiveness"
              color="text-blue-600"
            />
            <KPICard
              label="Sessions with Directives"
              value={d ? String(d.sessions_with_directives) : '—'}
              sub={d ? `of ${d.total_sessions} total` : ''}
              color={d && d.sessions_with_directives > 0 ? 'text-orange-600' : 'text-green-600'}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Directive frequency */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Runtime Directive Frequency</h3>
              {totalDirectiveTriggers === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">No active directives recorded</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(d?.directive_frequency ?? {}).map(([key, cnt]) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${DIRECTIVE_COLORS[key] ?? 'bg-gray-100 text-gray-600'}`}>
                        {DIRECTIVE_LABELS[key] ?? key}
                      </span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full ${DIRECTIVE_COLORS[key]?.includes('red') ? 'bg-red-400' : DIRECTIVE_COLORS[key]?.includes('orange') ? 'bg-orange-400' : DIRECTIVE_COLORS[key]?.includes('purple') ? 'bg-purple-400' : DIRECTIVE_COLORS[key]?.includes('yellow') ? 'bg-yellow-400' : 'bg-blue-400'}`}
                          style={{ width: `${(cnt / totalDirectiveTriggers) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 font-medium w-6 text-right">{cnt}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quality distribution */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Quality Score Distribution</h3>
              {!d?.quality_distribution?.length ? (
                <p className="text-xs text-gray-400 py-4 text-center">No data yet</p>
              ) : (
                <div className="space-y-3">
                  {d.quality_distribution.map(bucket => {
                    const maxCount = Math.max(...(d.quality_distribution.map(b => b.count) ?? [1]));
                    const [lo] = bucket.bucket.split('-').map(Number);
                    const bucketColor = lo >= 80 ? 'bg-green-400' : lo >= 60 ? 'bg-yellow-400' : lo >= 40 ? 'bg-orange-400' : 'bg-red-400';
                    return (
                      <div key={bucket.bucket} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-14 shrink-0">{bucket.bucket}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full ${bucketColor}`}
                            style={{ width: `${maxCount > 0 ? (bucket.count / maxCount) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-6 text-right">{bucket.count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 7-day trend */}
          {(d?.quality_trend?.length ?? 0) > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">7-Day Quality Trend</h3>
              <div className="flex items-end gap-2 h-24">
                {d!.quality_trend.map((t, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${t.day}: Q${t.avg_quality.toFixed(0)} / S${t.avg_safety.toFixed(0)}`}>
                    <div className="w-full flex flex-col items-center gap-0.5">
                      <div
                        className={`w-full rounded-t ${qualityBg(t.avg_quality)}`}
                        style={{ height: `${(t.avg_quality / 100) * 72}px` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 truncate max-w-full">{t.day.slice(5)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Worst sessions */}
          {(d?.worst_sessions?.length ?? 0) > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Lowest Quality Sessions</h3>
                <p className="text-xs text-gray-400 mt-0.5">Sessions requiring most attention</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-5 py-3">Session</th>
                      <th className="text-left px-4 py-3 w-32">Quality</th>
                      <th className="text-left px-4 py-3 w-32">Safety</th>
                      <th className="text-left px-4 py-3 w-32">Adaptation</th>
                      <th className="text-center px-4 py-3">Directives</th>
                      <th className="text-left px-4 py-3">Directives Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {d!.worst_sessions.map(s => (
                      <tr key={s.session_id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-mono text-xs text-gray-500">{s.session_id.slice(0, 16)}…</td>
                        <td className="px-4 py-3"><ScoreBar value={s.avg_quality} /></td>
                        <td className="px-4 py-3"><ScoreBar value={s.avg_safety} color="bg-purple-500" /></td>
                        <td className="px-4 py-3"><ScoreBar value={s.avg_adaptation} color="bg-blue-500" /></td>
                        <td className="px-4 py-3 text-center">
                          {s.directive_count > 0
                            ? <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">{s.directive_count}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {s.last_directives.map(d => (
                              <span key={d} className={`text-xs px-1.5 py-0.5 rounded ${DIRECTIVE_COLORS[d] ?? 'bg-gray-100 text-gray-600'}`}>
                                {DIRECTIVE_LABELS[d] ?? d}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'sessions' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Session Quality List</h3>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyRisk}
                onChange={e => { setOnlyRisk(e.target.checked); setPage(1); }}
                className="rounded"
              />
              Only sessions with active directives
            </label>
          </div>

          {loadingSessions ? (
            <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-4 py-3">Session ID</th>
                      <th className="text-left px-4 py-3 w-28">Quality</th>
                      <th className="text-left px-4 py-3 w-28">Safety</th>
                      <th className="text-left px-4 py-3 w-28">Adaptation</th>
                      <th className="text-center px-4 py-3">Max Directives</th>
                      <th className="text-left px-4 py-3">Last Evaluated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sessionsData?.sessions.map(s => (
                      <SessionRow
                        key={s.session_id}
                        s={s}
                        onClick={() => setSelected(selected?.session_id === s.session_id ? null : s)}
                        selected={selected?.session_id === s.session_id}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {sessionsData && sessionsData.total > 20 && (
                <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
                  <span>{sessionsData.total} sessions total</span>
                  <div className="flex gap-2">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage(p => p - 1)}
                      className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                    >← Prev</button>
                    <span className="px-3 py-1 text-gray-600">Page {page}</span>
                    <button
                      disabled={page * 20 >= sessionsData.total}
                      onClick={() => setPage(p => p + 1)}
                      className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                    >Next →</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Session drawer */}
      {selected && <SessionDrawer session={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
