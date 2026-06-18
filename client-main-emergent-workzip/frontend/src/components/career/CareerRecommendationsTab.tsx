import React, { useState, useEffect, useCallback } from 'react';
import {
  Route, TrendingUp, ArrowRight, BookOpen, Loader2, AlertCircle,
  ChevronRight, Sparkles, Target, Clock, DollarSign, Star, FileText, ExternalLink,
} from 'lucide-react';

function authHeader(): Record<string, string> {
  const t = localStorage.getItem('metryx_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

interface RoleRec {
  role_id: number;
  role_key: string;
  title: string;
  seniority: string;
  function_area: string;
  avg_salary_inr: number | null;
  demand_score: number;
  growth_30mo: number;
  segment: string;
  rec_score: number;
  readiness_score: number | null;
  market_score: number;
  salary_delta_pct: number | null;
  transition_probability: number;
  avg_months_transition: number;
  edge_type: string;
  confidence: number;
}

interface RecBundle {
  next_steps:    RoleRec[];
  quick_wins:    RoleRec[];
  laterals:      RoleRec[];
  stretch_goals: RoleRec[];
  pivots:        RoleRec[];
  confidence:    number;
  data_sources:  string[];
}

const BAND_PILL: Record<string, string> = {
  overqualified: 'bg-emerald-100 text-emerald-700',
  ready:         'bg-emerald-100 text-emerald-700',
  approaching:   'bg-blue-100   text-blue-700',
  developing:    'bg-amber-100  text-amber-700',
  not_ready:     'bg-rose-100   text-rose-700',
};

function bandFromScore(score: number | null): string | null {
  if (score === null) return null;
  if (score >= 90) return 'overqualified';
  if (score >= 70) return 'ready';
  if (score >= 50) return 'approaching';
  if (score >= 30) return 'developing';
  return 'not_ready';
}

function ReadinessBar({ score }: { score: number | null }) {
  if (score === null) return null;
  const pct = Math.max(0, Math.min(100, score));
  const color = pct >= 70 ? 'from-emerald-400 to-emerald-500' : pct >= 45 ? 'from-blue-400 to-indigo-500' : 'from-amber-400 to-rose-400';
  return (
    <div className="space-y-0.5">
      <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-slate-500">{Math.round(pct)}% ready</p>
    </div>
  );
}

function RoleCard({
  rec, onSelectTarget,
}: {
  rec: RoleRec;
  onSelectTarget: (rec: RoleRec) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  const handleSelect = async () => {
    setSaving(true);
    await fetch('/api/career/path', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ to_role_id: rec.role_id, source: rec.segment }),
    }).catch(() => {});
    setSaving(false);
    setSaved(true);
    onSelectTarget(rec);
    setTimeout(() => setSaved(false), 3000);
  };

  const band = bandFromScore(rec.readiness_score);
  const bandClass = BAND_PILL[band ?? ''] ?? BAND_PILL.developing;

  return (
    <div className="group p-4 bg-white rounded-xl border border-slate-200 hover:border-indigo-200 hover:shadow-sm transition-all space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 text-sm leading-snug">{rec.title}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {rec.seniority}
            {rec.function_area ? ` · ${rec.function_area}` : ''}
          </p>
        </div>
        {band && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${bandClass}`}>
            {band.replace('_', ' ')}
          </span>
        )}
      </div>

      <ReadinessBar score={rec.readiness_score} />

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Clock size={11} />~{rec.avg_months_transition}mo
        </span>
        <span className="flex items-center gap-1">
          <Target size={11} />{Math.round(rec.transition_probability * 100)}% match
        </span>
        {rec.salary_delta_pct !== null && rec.salary_delta_pct !== 0 && (
          <span className={`flex items-center gap-1 ${rec.salary_delta_pct > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
            <DollarSign size={11} />{rec.salary_delta_pct > 0 ? '+' : ''}{rec.salary_delta_pct.toFixed(0)}%
          </span>
        )}
        <span className="flex items-center gap-1">
          <Star size={11} className="text-amber-400" />{rec.demand_score}/100
        </span>
      </div>

      <button
        onClick={handleSelect}
        disabled={saving}
        className={`w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition-all ${
          saved
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
        } disabled:opacity-50`}
      >
        {saving ? (
          <><Loader2 size={12} className="animate-spin" /> Saving…</>
        ) : saved ? (
          <><ChevronRight size={12} /> Path saved!</>
        ) : (
          <><Route size={12} /> Select as target</>
        )}
      </button>
    </div>
  );
}

function Column({
  title, icon, color, recs, onSelectTarget,
}: {
  title: string;
  icon: React.ReactNode;
  color: string;
  recs: RoleRec[];
  onSelectTarget: (rec: RoleRec) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className={`flex items-center gap-2 p-3 rounded-xl ${color} border`}>
        {icon}
        <div>
          <p className="font-semibold text-sm">{title}</p>
          <p className="text-xs opacity-70">{recs.length} role{recs.length !== 1 ? 's' : ''}</p>
        </div>
      </div>
      {recs.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-10 text-slate-400 text-xs text-center border-2 border-dashed border-slate-200 rounded-xl">
          No roles in this segment yet
        </div>
      ) : (
        recs.map(rec => (
          <RoleCard key={rec.role_id} rec={rec} onSelectTarget={onSelectTarget} />
        ))
      )}
    </div>
  );
}

export default function CareerRecommendationsTab({ userId }: { userId: string }) {
  const [bundle, setBundle] = useState<RecBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [selectedTarget, setSelectedTarget] = useState<RoleRec | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const url = selectedTarget
      ? `/api/career/recommendations?current_role_id=${selectedTarget.role_id}`
      : '/api/career/recommendations';
    fetch(url, { headers: authHeader() })
      .then(r => r.json())
      .then(d => {
        if (d.ok) setBundle(d);
        else setError(d.error ?? 'Could not load recommendations');
      })
      .catch(() => setError('Network error'))
      .finally(() => setLoading(false));
  }, [selectedTarget]);

  // Re-run whenever `load` identity changes (which happens when selectedTarget changes)
  useEffect(() => { load(); }, [load]);

  const handleSelectTarget = (rec: RoleRec) => {
    setSelectedTarget(rec);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
      <Loader2 size={24} className="animate-spin mb-3" />
      <p className="text-sm">Building your career path recommendations…</p>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center h-64">
      <AlertCircle size={24} className="text-amber-500 mb-3" />
      <p className="text-sm text-slate-600">{error}</p>
      <button onClick={load} className="mt-3 text-xs text-indigo-600 hover:underline">Try again</button>
    </div>
  );

  const nextSteps = [...(bundle?.next_steps ?? []), ...(bundle?.quick_wins ?? [])];
  const laterals  = bundle?.laterals      ?? [];
  const stretches = bundle?.stretch_goals ?? [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Route size={20} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 text-lg">Career Paths</h2>
            <p className="text-xs text-slate-500">Personalised role recommendations from your career graph</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {bundle && (
            <p className="text-xs text-slate-400">
              Confidence {Math.round(bundle.confidence * 100)}% · {bundle.data_sources?.length ?? 0} sources
            </p>
          )}
          <a
            href="/api/career/report"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
          >
            <FileText size={12} />
            Report
            <ExternalLink size={10} className="opacity-60" />
          </a>
          <button
            onClick={load}
            className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {selectedTarget && (
        <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-sm">
          <Target size={14} className="text-indigo-600 shrink-0" />
          <span className="text-indigo-800">
            Starting from: <strong>{selectedTarget.title}</strong>
          </span>
          <button
            onClick={() => { setSelectedTarget(null); setBundle(null); load(); }}
            className="ml-auto text-xs text-indigo-500 hover:text-indigo-700"
          >
            Clear
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Column
          title="Next Steps"
          icon={<ArrowRight size={16} className="text-emerald-700" />}
          color="bg-emerald-50 border-emerald-200 text-emerald-900"
          recs={nextSteps}
          onSelectTarget={handleSelectTarget}
        />
        <Column
          title="Lateral Moves"
          icon={<TrendingUp size={16} className="text-blue-700" />}
          color="bg-blue-50 border-blue-200 text-blue-900"
          recs={laterals}
          onSelectTarget={handleSelectTarget}
        />
        <Column
          title="Stretch Goals"
          icon={<Sparkles size={16} className="text-violet-700" />}
          color="bg-violet-50 border-violet-200 text-violet-900"
          recs={stretches}
          onSelectTarget={handleSelectTarget}
        />
      </div>

      {nextSteps.length + laterals.length + stretches.length === 0 && !loading && (
        <div className="text-center py-16 text-slate-400">
          <BookOpen size={32} className="mx-auto mb-4 text-slate-200" />
          <p className="text-sm font-medium">No path recommendations yet</p>
          <p className="text-xs mt-1">Complete your profile and career assessment to unlock personalised paths.</p>
        </div>
      )}
    </div>
  );
}
