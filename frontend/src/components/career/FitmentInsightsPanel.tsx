/**
 * Fitment Insights Panel
 * ──────────────────────
 * Three lenses for a candidate sitting inside the Career Builder:
 *
 *   1. Peer ranking      — overall + top/bottom competency percentile vs cohort
 *                          (sourced from /api/competency/get-percentile/:userId)
 *   2. Applied positions — fitment score for every job the user is tracking
 *                          (computed in-browser via rankJobsForUser)
 *   3. Recruiter openings — active job postings published by employers on the
 *                          platform, each ranked by computeFitment against the
 *                          user's profile. If no postings exist yet, falls back
 *                          to demand-driven MARKET_CATALOG roles tagged as
 *                          "Suggested openings — demand-driven".
 *
 * All scores are derived deterministically from the user's profile + the
 * shared career-intelligence functions; no estimates, no fake data.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Users, Briefcase, Target, TrendingUp, ChevronRight, Sparkles,
  AlertCircle, Award, MapPin, Building2,
} from 'lucide-react';
import {
  computeFitment, rankJobsForUser, detectCurrentRole,
  type CareerProfile, type JobLike, type BehaviorContext,
} from '@/lib/careerIntelligence';
import { MARKET_CATALOG, findRoleByTitle, type MarketRole } from '@/data/marketCatalog';

interface Posting {
  _id: string;
  title: string;
  department?: string;
  location?: string;
  type?: string;
  salary?: string;
  skills?: string[];
}

interface PercentileRow {
  competencyCode: string;
  competencyName: string;
  percentile: number;
  percentileLabel: string;
  sampleSize: number;
}

interface PercentileResp {
  overallPercentile: number;
  percentiles: PercentileRow[];
}

const BRAND = { primary: '#6366f1', accent: '#f59e0b', green: '#10b981' };

function authHeader(): Record<string, string> {
  try {
    const t = localStorage.getItem('metryx_token');
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

function fitColor(score: number): string {
  if (score >= 75) return '#10b981';
  if (score >= 55) return '#6366f1';
  if (score >= 35) return '#f59e0b';
  return '#ef4444';
}

function fitLabel(score: number): string {
  if (score >= 85) return 'Excellent fit';
  if (score >= 70) return 'Strong fit';
  if (score >= 55) return 'Good fit';
  if (score >= 40) return 'Developing fit';
  return 'Significant gap';
}

function FitRing({ score, size = 56 }: { score: number; size?: number }) {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const off = c - (score / 100) * c;
  const color = fitColor(score);
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="4"
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 600ms ease' }}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle"
        fontSize={size * 0.32} fontWeight={700} fill={color}>
        {score}
      </text>
    </svg>
  );
}

interface Props {
  profile: CareerProfile | null;
  jobs: JobLike[];
  userId: string;
  behavior?: BehaviorContext | null;
}

export default function FitmentInsightsPanel({ profile, jobs, userId, behavior }: Props) {
  const [percentile, setPercentile] = useState<PercentileResp | null>(null);
  const [percentileErr, setPercentileErr] = useState<string | null>(null);
  const [postings, setPostings] = useState<Posting[]>([]);
  const [postingsLoaded, setPostingsLoaded] = useState(false);
  const [postingsError, setPostingsError] = useState(false);
  const [tab, setTab] = useState<'peer' | 'applied' | 'openings'>('peer');

  // ── Peer ranking ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/competency/get-percentile/${userId}`, {
          headers: authHeader(),
        });
        if (!r.ok) {
          if (!cancelled) setPercentileErr(r.status === 404 ? 'Complete the competency assessment to see your peer ranking.' : 'Peer ranking unavailable right now.');
          return;
        }
        const d = await r.json();
        if (!cancelled) {
          if (!d.percentiles || d.percentiles.length === 0) {
            setPercentileErr('Complete the competency assessment to see your peer ranking.');
          } else {
            setPercentile(d);
          }
        }
      } catch {
        if (!cancelled) setPercentileErr('Peer ranking unavailable right now.');
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // ── Recruiter postings ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/career/recruiter-postings', { headers: authHeader() });
        const d = await r.json().catch(() => ({}));
        if (!cancelled) {
          // A read failure (non-OK status or note: 'unavailable') is distinct
          // from a genuinely empty list — surface it so candidates aren't told
          // there are zero jobs when the listings simply failed to load.
          if (!r.ok || d?.note === 'unavailable') {
            setPostingsError(true);
            setPostings([]);
          } else {
            setPostingsError(false);
            setPostings(Array.isArray(d.postings) ? d.postings : []);
          }
          setPostingsLoaded(true);
        }
      } catch {
        if (!cancelled) { setPostingsError(true); setPostings([]); setPostingsLoaded(true); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Applied position fitment (computed in-browser) ──────────────────────
  const rankedApplied = useMemo(() => {
    return rankJobsForUser(profile, jobs, behavior ?? undefined).slice(0, 6);
  }, [profile, jobs, behavior]);

  // ── Recruiter postings ranked by fitment ────────────────────────────────
  const rankedPostings = useMemo(() => {
    if (postings.length === 0) return [];
    return postings
      .map(p => {
        const role = findRoleByTitle(p.title);
        if (!role) {
          return { posting: p, role: undefined as MarketRole | undefined, fitment: null, fitScore: 50 };
        }
        const f = computeFitment(profile, role);
        return { posting: p, role, fitment: f, fitScore: f.fitScore };
      })
      .sort((a, b) => b.fitScore - a.fitScore)
      .slice(0, 8);
  }, [postings, profile]);

  // ── Fallback: demand-driven suggestions when no employer postings exist ─
  const demandSuggestions = useMemo(() => {
    if (!postingsLoaded || postings.length > 0) return [];
    const current = detectCurrentRole(profile);
    return MARKET_CATALOG
      .filter(r => !current || r.id !== current.id)
      .map(role => ({ role, fitment: computeFitment(profile, role) }))
      .filter(x => x.fitment.fitScore >= 40)
      .sort((a, b) => {
        // Blend fit + demand for relevance
        const sa = a.fitment.fitScore * 0.6 + a.role.demandScore * 0.4;
        const sb = b.fitment.fitScore * 0.6 + b.role.demandScore * 0.4;
        return sb - sa;
      })
      .slice(0, 6);
  }, [postingsLoaded, postings, profile]);

  // ── Peer ranking derived stats ──────────────────────────────────────────
  const peerStats = useMemo(() => {
    if (!percentile || percentile.percentiles.length === 0) return null;
    const sorted = [...percentile.percentiles].sort((a, b) => b.percentile - a.percentile);
    return {
      overall: percentile.overallPercentile,
      top3: sorted.slice(0, 3),
      bottom3: sorted.slice(-3).reverse(),
      cohort: Math.max(...percentile.percentiles.map(p => p.sampleSize)),
    };
  }, [percentile]);

  const appliedAvg = rankedApplied.length
    ? Math.round(rankedApplied.reduce((s, r) => s + r.fitScore, 0) / rankedApplied.length)
    : 0;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/40 to-amber-50/30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.primary}15` }}>
            <Target size={16} style={{ color: BRAND.primary }} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">Fitment Intelligence</h2>
            <p className="text-[10px] text-gray-500 mt-0.5">Peer ranking · Applied positions · Open roles from employers</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-4 text-[10px] text-gray-500">
          {peerStats && (
            <div>
              <div className="font-semibold text-gray-700">P{peerStats.overall}</div>
              <div>vs cohort</div>
            </div>
          )}
          {rankedApplied.length > 0 && (
            <div>
              <div className="font-semibold text-gray-700">{appliedAvg}%</div>
              <div>avg applied fit</div>
            </div>
          )}
          {(rankedPostings.length > 0 || demandSuggestions.length > 0) && (
            <div>
              <div className="font-semibold text-gray-700">
                {rankedPostings[0]?.fitScore ?? demandSuggestions[0]?.fitment.fitScore ?? 0}%
              </div>
              <div>top opening</div>
            </div>
          )}
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex border-b border-gray-100">
        {([
          { id: 'peer', label: 'Peer ranking', icon: <Users size={12} />, count: peerStats?.overall ? `P${peerStats.overall}` : null },
          { id: 'applied', label: 'Applied positions', icon: <Briefcase size={12} />, count: rankedApplied.length || null },
          { id: 'openings', label: 'Recruiter openings', icon: <Sparkles size={12} />, count: rankedPostings.length || demandSuggestions.length || null },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 px-4 py-2.5 text-[11px] font-medium flex items-center justify-center gap-1.5 border-b-2 transition-all ${
              tab === t.id ? 'border-indigo-500 text-indigo-600 bg-indigo-50/40' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.icon}
            <span>{t.label}</span>
            {t.count !== null && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab body */}
      <div className="p-5">
        {/* ─── Peer ranking ─── */}
        {tab === 'peer' && (
          <>
            {!peerStats ? (
              <div className="flex items-start gap-2 p-4 rounded-xl border border-amber-100 bg-amber-50/40">
                <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800">
                  {percentileErr ?? 'Loading peer ranking…'}
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4 mb-4 p-3 rounded-xl border border-indigo-100 bg-indigo-50/30">
                  <FitRing score={peerStats.overall} size={64} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-800">
                      You rank in the {peerStats.overall >= 75 ? 'top quartile' : peerStats.overall >= 50 ? 'upper half' : peerStats.overall >= 25 ? 'lower half' : 'developing tier'} of the cohort
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      Overall percentile · {peerStats.cohort < 30
                        ? <span className="text-amber-600">Provisional — cohort building (n={peerStats.cohort})</span>
                        : `vs n=${peerStats.cohort} peers`}
                    </div>
                  </div>
                  <Award size={20} style={{ color: BRAND.accent }} className="hidden sm:block shrink-0" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 mb-1.5 flex items-center gap-1">
                      <TrendingUp size={10} /> Top strengths vs peers
                    </div>
                    <div className="space-y-1.5">
                      {peerStats.top3.map(p => (
                        <div key={p.competencyCode} className="flex items-center gap-2 text-xs">
                          <span className="text-[9px] font-bold w-9 text-center px-1 py-0.5 rounded"
                            style={{ backgroundColor: '#10b98115', color: '#10b981' }}>P{p.percentile}</span>
                          <span className="flex-1 truncate text-gray-700">{p.competencyName}</span>
                          <span className="text-[9px] text-gray-400">{p.percentileLabel}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 mb-1.5 flex items-center gap-1">
                      <Target size={10} /> Closest to cohort floor
                    </div>
                    <div className="space-y-1.5">
                      {peerStats.bottom3.map(p => (
                        <div key={p.competencyCode} className="flex items-center gap-2 text-xs">
                          <span className="text-[9px] font-bold w-9 text-center px-1 py-0.5 rounded"
                            style={{ backgroundColor: '#f59e0b15', color: '#f59e0b' }}>P{p.percentile}</span>
                          <span className="flex-1 truncate text-gray-700">{p.competencyName}</span>
                          <span className="text-[9px] text-gray-400">{p.percentileLabel}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ─── Applied positions ─── */}
        {tab === 'applied' && (
          <>
            {rankedApplied.length === 0 ? (
              <div className="text-center py-6">
                <Briefcase size={20} className="mx-auto mb-1.5 text-gray-300" />
                <div className="text-xs text-gray-500">No applications tracked yet.</div>
                <div className="text-[10px] text-gray-400 mt-0.5">Add applications below to see how well your profile fits each role.</div>
              </div>
            ) : (
              <div className="space-y-2">
                {rankedApplied.map((r, i) => (
                  <div key={r.job._id || i} className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/20 transition-colors">
                    <FitRing score={r.fitScore} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-gray-800 truncate">{r.job.role || 'Untitled role'}</div>
                      <div className="text-[11px] text-gray-500 truncate flex items-center gap-1">
                        <Building2 size={10} />{r.job.company || '—'}
                        {r.job.status && <>
                          <span className="text-gray-300">·</span>
                          <span className="text-[10px]">{r.job.status}</span>
                        </>}
                      </div>
                      {r.fitment ? (
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: `${fitColor(r.fitScore)}15`, color: fitColor(r.fitScore) }}>
                            {fitLabel(r.fitScore)}
                          </span>
                          <span className="text-[9px] text-gray-500">Skills {r.fitment.skillMatch}% · Comp {r.fitment.competencyMatch}% · Exp {r.fitment.experienceMatch}%</span>
                          {r.fitment.topGapCompetency && (
                            <span className="text-[9px] text-amber-700">Gap: {r.fitment.topGapCompetency.label}</span>
                          )}
                        </div>
                      ) : (
                        <div className="text-[9px] text-gray-400 mt-1 italic">Role not in canonical catalog — using baseline match</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ─── Recruiter openings ─── */}
        {tab === 'openings' && (
          <>
            {!postingsLoaded ? (
              <div className="text-xs text-gray-500 py-4 text-center">Loading openings…</div>
            ) : postingsError ? (
              <div className="space-y-2">
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-50/50 border border-rose-100">
                  <AlertCircle size={11} className="text-rose-500 shrink-0 mt-0.5" />
                  <div className="text-[10px] text-rose-800">
                    We couldn’t load live employer postings right now — this isn’t a sign there are no openings. Please try again in a moment.{demandSuggestions.length > 0 && ' In the meantime, here are demand-driven suggestions from the live market catalog.'}
                  </div>
                </div>
                {demandSuggestions.map((r, i) => (
                  <div key={r.role.id || i} className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/20 transition-colors">
                    <FitRing score={r.fitment.fitScore} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-gray-800 truncate">{r.role.title}</div>
                      <div className="text-[11px] text-gray-500 truncate">
                        Family: {r.role.family} · Demand {r.role.demandScore} · Growth {r.role.growth36mo}%
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: `${fitColor(r.fitment.fitScore)}15`, color: fitColor(r.fitment.fitScore) }}>
                          {fitLabel(r.fitment.fitScore)}
                        </span>
                        <span className="text-[9px] text-gray-500">Hire prob {r.fitment.hireProbability}%</span>
                        {r.fitment.missingSkills.length > 0 && (
                          <span className="text-[9px] text-amber-700 truncate">Missing: {r.fitment.missingSkills.slice(0, 3).join(', ')}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : rankedPostings.length > 0 ? (
              <div className="space-y-2">
                <div className="text-[10px] text-gray-500 mb-1.5">
                  {rankedPostings.length} active opening{rankedPostings.length !== 1 ? 's' : ''} from employers on MetryxOne — ranked by your fitment.
                </div>
                {rankedPostings.map((r, i) => (
                  <div key={r.posting._id || i} className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/20 transition-colors">
                    <FitRing score={r.fitScore} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-gray-800 truncate">{r.posting.title}</div>
                      <div className="text-[11px] text-gray-500 truncate flex items-center gap-1">
                        {r.posting.department && <span>{r.posting.department}</span>}
                        {r.posting.location && <><MapPin size={10} />{r.posting.location}</>}
                        {r.posting.type && <><span className="text-gray-300">·</span>{r.posting.type}</>}
                      </div>
                      {r.fitment && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: `${fitColor(r.fitScore)}15`, color: fitColor(r.fitScore) }}>
                            {fitLabel(r.fitScore)}
                          </span>
                          <span className="text-[9px] text-gray-500">Hire prob {r.fitment.hireProbability}%</span>
                          {r.fitment.missingSkills.length > 0 && (
                            <span className="text-[9px] text-amber-700 truncate">Missing: {r.fitment.missingSkills.slice(0, 3).join(', ')}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <ChevronRight size={14} className="text-gray-300 shrink-0" />
                  </div>
                ))}
              </div>
            ) : demandSuggestions.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50/40 border border-amber-100 mb-2">
                  <Sparkles size={11} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-[10px] text-amber-800">
                    No employer postings on the platform yet. Showing <span className="font-semibold">demand-driven suggested openings</span> from the live market catalog where your fitment is ≥ 40.
                  </div>
                </div>
                {demandSuggestions.map((r, i) => (
                  <div key={r.role.id || i} className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/20 transition-colors">
                    <FitRing score={r.fitment.fitScore} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-gray-800 truncate">{r.role.title}</div>
                      <div className="text-[11px] text-gray-500 truncate">
                        Family: {r.role.family} · Demand {r.role.demandScore} · Growth {r.role.growth36mo}%
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: `${fitColor(r.fitment.fitScore)}15`, color: fitColor(r.fitment.fitScore) }}>
                          {fitLabel(r.fitment.fitScore)}
                        </span>
                        <span className="text-[9px] text-gray-500">Hire prob {r.fitment.hireProbability}%</span>
                        {r.fitment.missingSkills.length > 0 && (
                          <span className="text-[9px] text-amber-700 truncate">Missing: {r.fitment.missingSkills.slice(0, 3).join(', ')}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Sparkles size={20} className="mx-auto mb-1.5 text-gray-300" />
                <div className="text-xs text-gray-500">No openings to compare against yet.</div>
                <div className="text-[10px] text-gray-400 mt-0.5">Complete your profile to unlock demand-driven suggestions.</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
