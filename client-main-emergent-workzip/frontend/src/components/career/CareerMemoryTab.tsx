/**
 * Career Memory (Phase 5 — Growth & Memory).
 *
 * Reads the longitudinal memory (GET /api/career/memory/:userId) and shows the
 * snapshot timeline plus computed growth deltas — improving / worsening signals
 * and stable / emerging patterns. A "Save snapshot" button persists the current
 * Career Brain so the trend can build over time. Per-user only (k-anonymity safe).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { History, TrendingUp, TrendingDown, Minus, Sparkles, Save, LineChart, Target, Flag, BookOpen, Award, RotateCcw, AlertTriangle } from 'lucide-react';
import { COLOR } from '@/design-system';
import { SectionCard } from './SectionCard';
import { EmptyState } from './EmptyState';
import { LoadingState } from './LoadingState';
import type { CareerBrain } from '@/lib/services/useCareerBrain';
import { buildProgressLedger, deriveMilestones, type GrowthTimeline, type GrowthAxis, type Milestone, type MilestoneKind, type MemorySnapshotRaw } from '@/lib/intelligence/progressLedger';
import { attributeOutcomes, deriveActionLog, buildGrowthStory, type Attribution, type GrowthStory } from '@/lib/intelligence/outcomeAttributionEngine';

function authHeader(): Record<string, string> {
  try {
    const t = localStorage.getItem('metryx_token');
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch { return {}; }
}

interface MemoryResponse {
  ok: boolean;
  snapshot_count: number;
  latest_snapshot_at: string | null;
  snapshots: any[];
  growth: {
    improving_signals: any[];
    worsening_signals: any[];
    stable_patterns: any[];
    emerging_patterns: any[];
  };
}

export function CareerMemoryTab({ userId, brain, eiScore }: { userId: string; brain: CareerBrain; eiScore?: number }) {
  const [data, setData] = useState<MemoryResponse | null>(null);
  const [ledger, setLedger] = useState<GrowthTimeline | null>(null);
  const [attributions, setAttributions] = useState<Attribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    try {
      const r = await fetch(`/api/career/behavioural-memory/${userId}`, { headers: authHeader() as HeadersInit, credentials: 'include' });
      if (r.ok) {
        const d: MemoryResponse = await r.json();
        setData(d);
        // Progress Ledger (P5) + Outcome Attribution (P6) — additive, best-effort,
        // built from the SAME snapshots already fetched (no extra requests). When
        // there's too little history the builders return null / [] and the new
        // cards simply don't render — the rest of the tab is unchanged.
        try {
          const snaps = (Array.isArray(d?.snapshots) ? d.snapshots : []) as unknown as MemorySnapshotRaw[];
          const built = snaps.length >= 2 ? buildProgressLedger({ snapshots: snaps }) : null;
          const lg = built && built.entries.length > 0 ? built : null;
          setLedger(lg);
          const actionLog = deriveActionLog(snaps);
          setAttributions(lg && actionLog.length ? attributeOutcomes({ ledger: lg, actionLog }) : []);
        } catch { setLedger(null); setAttributions([]); }
      }
    } catch { /* degrade */ }
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const saveSnapshot = async () => {
    if (!userId || saving) return;
    setSaving(true); setMsg('');
    try {
      const r = await fetch('/api/career/behavioural-memory/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() } as HeadersInit,
        credentials: 'include',
        body: JSON.stringify({
          userId,
          ei_score: typeof eiScore === 'number' ? eiScore : brain.marketReadiness,
          current_stage: brain.currentStage,
          target_role: brain.targetRole,
          transition_probability: brain.transitionProbability / 100,
          core_bottleneck: brain.coreBottleneck,
          market_readiness: brain.marketReadiness,
          interview_readiness: brain.interviewReadiness,
          signals: brain.signals,
          patterns: brain.patterns,
          brain,
        }),
      });
      setMsg(r.ok ? 'Snapshot saved.' : 'Could not save snapshot.');
      if (r.ok) await load();
    } catch {
      setMsg('Could not save snapshot.');
    }
    setSaving(false);
  };

  // Milestones (P5) + Growth Story (P6) — pure, deterministic reshape of the SAME
  // already-fetched ledger/attributions. No extra requests; render only when they
  // carry real content (story degrades to a truthful "not enough history" state).
  const milestones = useMemo(() => deriveMilestones(ledger), [ledger]);
  const story = useMemo(() => buildGrowthStory(ledger, attributions), [ledger, attributions]);

  if (loading) return <LoadingState message="Loading your career memory…" />;

  const growth = data?.growth;
  const hasGrowth = growth && (growth.improving_signals.length || growth.worsening_signals.length || growth.stable_patterns.length || growth.emerging_patterns.length);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Career memory</h2>
          <p className="text-xs text-gray-500 mt-1">How your behavioural profile is trending over time.</p>
        </div>
        <button
          onClick={saveSnapshot}
          disabled={saving}
          className="inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-2 rounded-lg text-white hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: COLOR.primary }}
        >
          <Save size={13} /> {saving ? 'Saving…' : 'Save snapshot'}
        </button>
      </div>
      {msg && <p className="text-xs text-gray-500">{msg}</p>}

      {ledger && <GrowthStoryCard story={story} />}

      {!hasGrowth ? (
        <EmptyState
          icon={<History size={40} />}
          title="No trend yet"
          description="Save a couple of snapshots over time and your improving, worsening, stable and emerging signals will appear here."
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <GrowthCard title="Improving" icon={<TrendingUp size={16} />} color="#2A9D8F" items={growth!.improving_signals} field="label" />
          <GrowthCard title="Needs attention" icon={<TrendingDown size={16} />} color="#e63946" items={growth!.worsening_signals} field="label" />
          <GrowthCard title="Stable" icon={<Minus size={16} />} color="#94a3b8" items={growth!.stable_patterns} field="label" />
          <GrowthCard title="Emerging" icon={<Sparkles size={16} />} color={COLOR.accent} items={growth!.emerging_patterns} field="label" />
        </div>
      )}

      {ledger && <GrowthTimelineCard ledger={ledger} />}

      {milestones.length > 0 && <MilestonesCard milestones={milestones} />}

      {attributions.length > 0 && <AttributionCard attributions={attributions} />}

      <SectionCard title="Snapshot history" icon={<History size={16} />}>
        {!data?.snapshots?.length ? (
          <p className="text-xs text-gray-400">No snapshots recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {data.snapshots.map((s) => (
              <li key={s.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 text-xs">
                <span className="text-gray-600">{new Date(s.snapshot_at).toLocaleString('en-IN')}</span>
                <span className="text-gray-400">
                  {s.current_stage || '—'} · readiness {s.market_readiness != null ? Math.round(Number(s.market_readiness)) : '—'}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

// ── Progress Ledger (P5) — one unified growth timeline across axes ─────────────
const AXIS_META: Record<GrowthAxis, { label: string; color: string }> = {
  employability: { label: 'Employability', color: '#2A9D8F' },
  career: { label: 'Career', color: COLOR.primary },
  behavior: { label: 'Behaviour', color: COLOR.accent },
  competency: { label: 'Competency', color: '#6366f1' },
  learning: { label: 'Learning', color: '#f59e0b' },
};

function deltaTone(delta: number): string {
  if (delta > 0) return '#2A9D8F';
  if (delta < 0) return '#e63946';
  return '#94a3b8';
}

function GrowthTimelineCard({ ledger }: { ledger: GrowthTimeline }) {
  const { summary } = ledger;
  const axes = (Object.keys(AXIS_META) as GrowthAxis[]).filter((a) => ledger.byAxis[a]?.length);
  const recent = ledger.entries.filter((e) => e.delta !== 0).slice(-8).reverse();
  return (
    <SectionCard title="Growth timeline" icon={<LineChart size={16} />}>
      <p className="text-xs text-gray-500 -mt-1 mb-3">
        How far you've come across every axis — net movement{summary.window ? ` since ${new Date(summary.window.from).toLocaleDateString('en-IN')}` : ''}.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
        {axes.map((a) => {
          const d = summary.byAxisDelta[a];
          return (
            <div key={a} className="border border-gray-100 rounded-xl p-3">
              <div className="text-[11px] font-black uppercase tracking-widest" style={{ color: AXIS_META[a].color }}>
                {AXIS_META[a].label}
              </div>
              <div className="text-sm font-bold mt-1" style={{ color: deltaTone(d) }}>
                {d > 0 ? '+' : ''}{d}
              </div>
            </div>
          );
        })}
      </div>
      {recent.length > 0 && (
        <ul className="space-y-1.5">
          {recent.map((e, i) => (
            <li key={e.axis + e.metric + e.ts + i} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-gray-700 flex items-center gap-2 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: AXIS_META[e.axis].color }} />
                <span className="truncate">{e.metric}</span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="font-semibold" style={{ color: deltaTone(e.delta) }}>{e.delta > 0 ? '+' : ''}{e.delta}</span>
                <span className="text-gray-400">{new Date(e.ts).toLocaleDateString('en-IN')}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

// ── Outcome Attribution (P6) — what moved your metrics ─────────────────────────
const METHOD_LABEL: Record<Attribution['method'], string> = {
  pre_post: 'pre/post delta',
  intervention_outcome_score: 'verified outcome',
  learning_attribution: 'learning attribution',
};

function AttributionCard({ attributions }: { attributions: Attribution[] }) {
  return (
    <SectionCard title="What moved your metrics" icon={<Target size={16} />}>
      <p className="text-xs text-gray-500 -mt-1 mb-3">
        Actions linked to measurable change, net of baseline drift. Confidence reflects timing and how isolated each action was.
      </p>
      <ul className="space-y-2.5">
        {attributions.slice(0, 6).map((a, i) => (
          <li key={a.action.id + i} className="p-3 rounded-xl border border-gray-100">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-gray-800 truncate">{a.action.label}</span>
              <span className="text-xs font-bold shrink-0" style={{ color: deltaTone(a.attributedDelta) }}>
                {a.outcomeMetric} {a.attributedDelta > 0 ? '+' : ''}{a.attributedDelta}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mt-1">{a.explanation}</p>
            <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-400">
              <span className="px-1.5 py-0.5 rounded bg-gray-50 border border-gray-100">{METHOD_LABEL[a.method]}</span>
              <span>confidence {Math.round(a.confidence * 100)}%</span>
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

// ── Growth Story (P6) — grounded narrative over ledger + attributions ──────────
function GrowthStoryCard({ story }: { story: GrowthStory }) {
  return (
    <div className="rounded-2xl p-5 border border-gray-100 shadow-sm" style={{ background: 'linear-gradient(135deg, #f8fafc, #eef2fb)' }}>
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest" style={{ color: COLOR.primary }}>
        <BookOpen size={14} /> Your growth story
      </div>
      <p className="text-sm font-semibold text-gray-800 mt-2">{story.headline}</p>
      <div className="mt-2 space-y-1.5">
        {story.chapters.map((c, i) => (
          <p key={i} className="text-xs text-gray-600 leading-relaxed">{c}</p>
        ))}
      </div>
      {(story.drivers.length > 0 || story.blockers.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          {story.drivers.length > 0 && (
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-[#2A9D8F]">What created growth</div>
              <ul className="mt-1.5 space-y-1">
                {story.drivers.map((d, i) => (
                  <li key={i} className="text-[11px] text-gray-600 flex items-start gap-1.5">
                    <TrendingUp size={11} className="mt-0.5 shrink-0 text-[#2A9D8F]" /> {d}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {story.blockers.length > 0 && (
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-[#e63946]">What held you back</div>
              <ul className="mt-1.5 space-y-1">
                {story.blockers.map((b, i) => (
                  <li key={i} className="text-[11px] text-gray-600 flex items-start gap-1.5">
                    <TrendingDown size={11} className="mt-0.5 shrink-0 text-[#e63946]" /> {b}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <p className="text-[10px] text-gray-400 mt-3">Narrative confidence {Math.round(story.confidence * 100)}% · grounded in your recorded metric history.</p>
    </div>
  );
}

// ── Milestones (P5) — notable points on the timeline ───────────────────────────
const MILESTONE_META: Record<MilestoneKind, { label: string; color: string; icon: React.ReactNode }> = {
  breakthrough: { label: 'Breakthrough', color: '#2A9D8F', icon: <Award size={13} /> },
  recovery: { label: 'Recovery', color: COLOR.primary, icon: <RotateCcw size={13} /> },
  setback: { label: 'Setback', color: '#e63946', icon: <AlertTriangle size={13} /> },
  baseline: { label: 'Baseline', color: '#94a3b8', icon: <Flag size={13} /> },
};

function MilestonesCard({ milestones }: { milestones: Milestone[] }) {
  return (
    <SectionCard title="Milestones" icon={<Flag size={16} />}>
      <p className="text-xs text-gray-500 -mt-1 mb-3">
        The moments that defined your trajectory — each tied to a real metric movement.
      </p>
      <ul className="space-y-2">
        {milestones.slice(0, 8).map((m, i) => {
          const meta = MILESTONE_META[m.kind];
          return (
            <li key={m.axis + m.metric + m.ts + i} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100">
              <span className="mt-0.5 shrink-0 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ color: meta.color, backgroundColor: `${meta.color}1a` }}>
                {meta.icon} {meta.label}
              </span>
              <div className="min-w-0">
                <p className="text-sm text-gray-700">{m.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{new Date(m.ts).toLocaleDateString('en-IN')}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

function GrowthCard({ title, icon, color, items, field }: { title: string; icon: React.ReactNode; color: string; items: any[]; field: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest" style={{ color }}>
        {icon} {title}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400 mt-3">None right now.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {items.slice(0, 6).map((it, i) => (
            <li key={(it.key || i) + ''} className="text-xs text-gray-700 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              {it[field] || it.key}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
