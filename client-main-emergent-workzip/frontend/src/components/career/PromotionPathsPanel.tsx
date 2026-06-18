import React, { useState, useEffect } from 'react';
import {
  ArrowUpRight, ArrowLeftRight, CheckCircle2, XCircle,
  Clock, Loader2, AlertCircle, Target, ChevronRight,
  Zap, TrendingUp,
} from 'lucide-react';

function authHeader(): Record<string, string> {
  const t = localStorage.getItem('metryx_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

interface CgRole {
  id: number;
  title: string;
  seniority: string;
  function_area: string | null;
}

interface PromotionPath {
  id: number;
  to_role_id: number;
  to_role_title: string;
  to_role_seniority: string;
  function_area: string | null;
  avg_salary_inr: number | null;
  demand_score: number;
  min_months: number;
  required_skills: string[];
  condition_text: string | null;
  readiness_score: number | null;
  readiness_band: string | null;
}

interface LateralOption {
  id: number;
  to_role_id: number;
  to_role_title: string;
  to_role_seniority: string;
  function_area: string | null;
  avg_salary_inr: number | null;
  demand_score: number;
  similarity_score: number;
  skills_to_gain: string[];
  condition_text: string | null;
  readiness_score: number | null;
}

const BAND_COLORS: Record<string, string> = {
  not_ready:      'bg-red-100 text-red-700',
  developing:     'bg-orange-100 text-orange-700',
  approaching:    'bg-yellow-100 text-yellow-700',
  ready:          'bg-green-100 text-green-700',
  overqualified:  'bg-blue-100 text-blue-700',
};

const BAND_LABELS: Record<string, string> = {
  not_ready: 'Not Ready', developing: 'Developing',
  approaching: 'Approaching', ready: 'Ready', overqualified: 'Overqualified',
};

function ReadinessBar({ score, band }: { score: number | null; band: string | null }) {
  if (score === null) return <span className="text-xs text-gray-400">No data</span>;
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-1.5 rounded-full bg-gray-100">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${score}%`,
            background: score >= 70 ? '#16a34a' : score >= 50 ? '#f59e0b' : '#ef4444',
          }}
        />
      </div>
      <span className="text-xs font-semibold text-gray-700">{Math.round(score)}</span>
      {band && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${BAND_COLORS[band] ?? 'bg-gray-100 text-gray-600'}`}>
          {BAND_LABELS[band] ?? band}
        </span>
      )}
    </div>
  );
}

function fmt(n: number | null): string {
  if (!n) return '—';
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

type PanelTab = 'promotion' | 'lateral';

export default function PromotionPathsPanel({ userId }: { userId: string }) {
  const [activeTab, setActiveTab] = useState<PanelTab>('promotion');
  const [currentRole, setCurrentRole] = useState<CgRole | null>(null);
  const [promotionPaths, setPromotionPaths] = useState<PromotionPath[]>([]);
  const [lateralOptions, setLateralOptions] = useState<LateralOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingRoleId, setSavingRoleId] = useState<number | null>(null);
  const [savedRoleIds, setSavedRoleIds] = useState<Set<number>>(new Set());

  useEffect(() => { void load(); }, [userId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [promoRes, lateralRes] = await Promise.all([
        fetch('/api/career/promotion-paths', { headers: authHeader() }),
        fetch('/api/career/lateral-options', { headers: authHeader() }),
      ]);
      const promoData = await promoRes.json() as {
        ok: boolean; current_role?: CgRole; promotion_paths?: PromotionPath[];
      };
      const lateralData = await lateralRes.json() as {
        ok: boolean; current_role?: CgRole; lateral_options?: LateralOption[];
      };
      if (!promoData.ok) throw new Error('Failed to load promotion paths');
      setCurrentRole(promoData.current_role ?? lateralData.current_role ?? null);
      setPromotionPaths(promoData.promotion_paths ?? []);
      setLateralOptions(lateralData.lateral_options ?? []);
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setLoading(false);
    }
  }

  async function selectTarget(roleId: number) {
    setSavingRoleId(roleId);
    try {
      await fetch('/api/career/path', {
        method: 'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_role_id: roleId, source: 'user_selected' }),
      });
      setSavedRoleIds(prev => new Set([...prev, roleId]));
    } catch { /* silent */ }
    finally { setSavingRoleId(null); }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24 gap-3 text-gray-400">
      <Loader2 size={20} className="animate-spin" />
      <span className="text-sm">Loading paths…</span>
    </div>
  );

  if (error) return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-5 flex items-center gap-3">
      <AlertCircle size={18} className="text-red-500 shrink-0" />
      <p className="text-sm text-red-700">{error}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <Target size={18} className="text-blue-600" />
          Your Path Forward
        </h2>
        {currentRole ? (
          <p className="text-xs text-gray-500 mt-0.5">
            From <span className="font-medium text-gray-700">{currentRole.title}</span>
            {' '}· {currentRole.seniority}
            {currentRole.function_area && ` · ${currentRole.function_area}`}
          </p>
        ) : (
          <p className="text-xs text-gray-400 mt-0.5">Complete your profile to resolve your current role.</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('promotion')}
          className={`px-4 py-2.5 text-sm font-medium flex items-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'promotion'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ArrowUpRight size={14} />
          Promotion Paths
          <span className="ml-1 text-[10px] bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">
            {promotionPaths.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('lateral')}
          className={`px-4 py-2.5 text-sm font-medium flex items-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'lateral'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ArrowLeftRight size={14} />
          Lateral Options
          <span className="ml-1 text-[10px] bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">
            {lateralOptions.length}
          </span>
        </button>
      </div>

      {/* Promotion Paths */}
      {activeTab === 'promotion' && (
        <div className="space-y-3">
          {promotionPaths.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              {currentRole
                ? `No curated promotion rules found from ${currentRole.title}.`
                : 'Set your current role to see promotion paths.'}
            </div>
          ) : promotionPaths.map(path => {
            const isSaved = savedRoleIds.has(path.to_role_id);
            return (
              <div key={path.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
                {/* Role header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-900">{path.to_role_title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-medium capitalize">
                        {path.to_role_seniority}
                      </span>
                      {path.function_area && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                          {path.function_area}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      {path.avg_salary_inr && (
                        <span className="text-xs text-gray-500">{fmt(path.avg_salary_inr)}/yr</span>
                      )}
                      {path.demand_score > 0 && (
                        <span className="flex items-center gap-0.5 text-xs text-amber-600">
                          <TrendingUp size={11} /> {Math.round(path.demand_score)} demand
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => selectTarget(path.to_role_id)}
                    disabled={savingRoleId === path.to_role_id || isSaved}
                    className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg text-white flex items-center gap-1 disabled:opacity-60 transition-all"
                    style={{ background: isSaved ? '#16a34a' : '#1D3E8B' }}
                  >
                    {isSaved ? <><CheckCircle2 size={12} /> Saved</> : <><Target size={12} /> Set as target</>}
                  </button>
                </div>

                {/* Readiness */}
                <div>
                  <div className="text-[10px] text-gray-500 mb-1 font-medium uppercase tracking-wide">Your Readiness</div>
                  <ReadinessBar score={path.readiness_score} band={path.readiness_band} />
                </div>

                {/* Tenure requirement */}
                <div>
                  <div className="text-[10px] text-gray-500 mb-1 font-medium uppercase tracking-wide flex items-center gap-1">
                    <Clock size={10} /> Minimum Tenure
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-blue-400"
                        style={{ width: `${Math.min(100, (12 / path.min_months) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600 whitespace-nowrap">{path.min_months} months required</span>
                  </div>
                </div>

                {/* Required skills */}
                {path.required_skills.length > 0 && (
                  <div>
                    <div className="text-[10px] text-gray-500 mb-2 font-medium uppercase tracking-wide">Skill Gates</div>
                    <div className="flex flex-wrap gap-1.5">
                      {path.required_skills.map(sk => (
                        <span key={sk} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-600">
                          <Zap size={9} className="text-blue-500" />
                          {sk.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Condition text */}
                {path.condition_text && (
                  <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
                    <p className="text-xs text-blue-700"><ChevronRight size={11} className="inline mr-0.5" />{path.condition_text}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Lateral Options */}
      {activeTab === 'lateral' && (
        <div className="space-y-3">
          {lateralOptions.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              {currentRole
                ? `No curated lateral options found from ${currentRole.title}.`
                : 'Set your current role to see lateral options.'}
            </div>
          ) : lateralOptions.map(opt => {
            const simPct = Math.round(opt.similarity_score * 100);
            const isSaved = savedRoleIds.has(opt.to_role_id);
            return (
              <div key={opt.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
                {/* Role header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-900">{opt.to_role_title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 font-medium capitalize">
                        {opt.to_role_seniority}
                      </span>
                      {opt.function_area && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                          {opt.function_area}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      {opt.avg_salary_inr && (
                        <span className="text-xs text-gray-500">{fmt(opt.avg_salary_inr)}/yr</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => selectTarget(opt.to_role_id)}
                    disabled={savingRoleId === opt.to_role_id || isSaved}
                    className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg text-white flex items-center gap-1 disabled:opacity-60 transition-all"
                    style={{ background: isSaved ? '#16a34a' : '#1D3E8B' }}
                  >
                    {isSaved ? <><CheckCircle2 size={12} /> Saved</> : <><Target size={12} /> Set as target</>}
                  </button>
                </div>

                {/* Similarity */}
                <div>
                  <div className="text-[10px] text-gray-500 mb-1 font-medium uppercase tracking-wide">Role Similarity</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${simPct}%`,
                          background: simPct >= 70 ? '#16a34a' : simPct >= 40 ? '#f59e0b' : '#6b7280',
                        }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-gray-700">{simPct}%</span>
                  </div>
                </div>

                {/* Readiness */}
                <div>
                  <div className="text-[10px] text-gray-500 mb-1 font-medium uppercase tracking-wide">Your Readiness</div>
                  <ReadinessBar score={opt.readiness_score} band={null} />
                </div>

                {/* Skills to gain */}
                {opt.skills_to_gain.length > 0 && (
                  <div>
                    <div className="text-[10px] text-gray-500 mb-2 font-medium uppercase tracking-wide">Skills to Gain</div>
                    <div className="flex flex-wrap gap-1.5">
                      {opt.skills_to_gain.map(sk => (
                        <span key={sk} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-orange-200 bg-orange-50 text-orange-700">
                          <XCircle size={9} className="text-orange-400" />
                          {sk.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Condition */}
                {opt.condition_text && (
                  <div className="rounded-lg bg-teal-50 border border-teal-100 px-3 py-2">
                    <p className="text-xs text-teal-700"><ChevronRight size={11} className="inline mr-0.5" />{opt.condition_text}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-gray-400 text-center pt-2">
        Paths are developmental signals — not hiring or promotion decisions.
      </p>
    </div>
  );
}
