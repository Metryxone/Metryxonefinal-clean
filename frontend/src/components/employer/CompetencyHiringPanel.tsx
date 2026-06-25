import { BRAND } from '@/design-system/tokens';
/**
 * §7 — Competency Hiring Intelligence Panel (MX-73X / MX-100X Phase 5)
 *
 * REAL UI over the competency-driven employer hiring flow. Reads ONLY from
 *   GET /api/v2/employer/competency-match/:candidateId/:jobId/intelligence
 * (flag-gated: adaptiveIntelligenceFoundation -> employerCompetencyHiring -> auth -> org-scope).
 *
 * Honesty-first surface:
 *  - Coverage (requirements assessed) and Confidence (calibration) shown as SEPARATE axes.
 *  - Withheld fit band (null) below the coverage floor is rendered as "Withheld", never 0.
 *  - null / abstain values render as "—" / explicit notes, never fabricated.
 *  - Flag-OFF → endpoint 503 → panel shows an explicit "feature disabled" state.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Brain, Target, Gauge, ShieldCheck, AlertTriangle, CheckCircle,
  RefreshCw, Users, Briefcase, BarChart3, Layers, Info, Search,
} from 'lucide-react';



function authHdr() {
  const t = localStorage.getItem('metryx_token');
  return t
    ? { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

// ── Types (mirror backend EmployerCompetencyIntelligence) ──────────────────────
interface ReqMatch {
  code: string; name: string; importanceTier: string; weight: number;
  source: string; targetScore: number; candidateScore: number | null;
  attainment: number | null; assessed: boolean;
  matchedKey?: string | null; matchedLedger?: string | null;
  matchVia?: 'direct_competency' | 'domain_proxy' | null;
}
interface FocusArea {
  code: string; name: string; importanceTier: string; targetScore: number;
  candidateScore: number | null; attainment: number | null;
  shortfall: number | null; note: string;
}
interface Intelligence {
  subjectId: string | null; jobId: string | null; jobTitle: string | null;
  match: {
    source: string; competencyProfileAvailable: boolean;
    competencyMatch: number | null; requirementCoveragePct: number | null;
    matchedRequirementCount: number; totalRequirementCount: number;
    requirements: ReqMatch[]; gaps: ReqMatch[]; unassessedRequirements: ReqMatch[];
    roleDna: {
      resolved: boolean; roleTitle: string | null; requirementSource: string;
      confidence: number; band: string; provisional: boolean;
      benchmark: { available: boolean; sampleSize: number | null };
    };
    candidateReadiness: {
      available: boolean; readinessScore: number | null; band: string | null;
      coveragePct: number | null; note: string;
    };
    calibration: { state: 'calibrated' | 'uncalibrated'; realizedOutcomes: number | null; minRequired: number; note: string };
    fitSignal: {
      band: string | null; assessedBand: string | null; coverageSufficient: boolean;
      provisional: boolean; rationale: string; validated: boolean;
    };
    coverageNote: string; confidenceNote: string;
  };
  interviewRecommendation: {
    focusAreas: FocusArea[]; probeAreas: FocusArea[]; structure: string;
    coverageSufficient: boolean; note: string;
  };
  hiringRecommendation: {
    action: string; fitBand: string | null; competencyMatch: number | null;
    requirementCoveragePct: number | null; coverageSufficient: boolean;
    calibrationState: string; provisional: boolean; validated: boolean;
    rationale: string; disclaimer: string;
  };
  hiringScore: {
    hiringScore: number | null; band: string | null; withheld: boolean;
    withheldReason: string | null;
    components: Array<{ key: string; label: string; value: number | null; baseWeight: number; effectiveWeight: number; present: boolean; contribution: number | null; note: string }>;
    provisional: boolean; validated: boolean; calibrationState: string;
    rationale: string; disclaimer: string;
  };
  benchmark: {
    available: boolean; source: string | null; percentiles: Record<string, number | null> | null;
    sampleSize: number | null; suppressed: boolean; suppressionReason?: string; kMin: number; note: string;
  };
}

interface JobLite { _id: string; title: string; department?: string; status?: string }
interface CandLite { _id: string; name: string; email: string; jobId: string; stage?: string; eiScore?: number }

// ── Small helpers ──────────────────────────────────────────────────────────────
const FIT_META: Record<string, { label: string; color: string; bg: string }> = {
  strong_fit:        { label: 'Strong Fit',       color: '#16a34a', bg: '#dcfce7' },
  fit:               { label: 'Fit',              color: BRAND.green, bg: '#d1fae5' },
  conditional:       { label: 'Conditional',      color: BRAND.orange, bg: '#fef3c7' },
  development_focus: { label: 'Development Focus', color: BRAND.red,   bg: '#fee2e2' },
};
const ACTION_META: Record<string, { label: string; color: string; bg: string }> = {
  advance_to_interview:            { label: 'Advance to Interview',    color: '#16a34a', bg: '#dcfce7' },
  targeted_interview:              { label: 'Targeted Interview',      color: BRAND.orange, bg: '#fef3c7' },
  gather_more_evidence:            { label: 'Gather More Evidence',    color: BRAND.primary, bg: '#e8edf7' },
  development_focus:               { label: 'Development Focus',       color: BRAND.red,   bg: '#fee2e2' },
  insufficient_competency_evidence:{ label: 'Insufficient Evidence',   color: '#64748b', bg: '#f1f5f9' },
};
const SCORE_BAND_COLOR: Record<string, string> = {
  strong: '#16a34a', promising: BRAND.green, developing: BRAND.orange, early: BRAND.red,
};

function num(n: number | null | undefined, suffix = '') {
  return n == null ? '—' : `${Math.round(n * 10) / 10}${suffix}`;
}

function FitBadge({ band }: { band: string | null }) {
  if (!band) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold"
        style={{ backgroundColor: '#f1f5f9', color: '#64748b' }}>
        <Info size={12} /> Withheld
      </span>
    );
  }
  const m = FIT_META[band] ?? FIT_META.development_focus!;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold"
      style={{ backgroundColor: m.bg, color: m.color }}>{m.label}</span>
  );
}

// ── Panel ────────────────────────────────────────────────────────────────────
export default function CompetencyHiringPanel({ jobs = [], candidates = [] }: { jobs?: JobLite[]; candidates?: CandLite[] }) {
  const [jobId, setJobId]   = useState<string>('');
  const [candId, setCandId] = useState<string>('');
  const [intel, setIntel]   = useState<Intelligence | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<{ code: number; message: string } | null>(null);
  const [search, setSearch] = useState('');

  // Default to first active job.
  useEffect(() => {
    if (!jobId && jobs.length) {
      const active = jobs.find(j => j.status === 'Active') ?? jobs[0];
      if (active) setJobId(active._id);
    }
  }, [jobs, jobId]);

  const jobCands = candidates.filter(c => c.jobId === jobId &&
    (search.trim() === '' || c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase())));

  const loadIntel = useCallback(async (cid: string, jid: string) => {
    if (!cid || !jid) return;
    setLoading(true); setErr(null); setIntel(null);
    try {
      const res = await fetch(`/api/v2/employer/competency-match/${cid}/${jid}/intelligence`,
        { headers: authHdr() as HeadersInit });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr({ code: res.status, message: body?.error || `Request failed (${res.status})` });
        return;
      }
      setIntel(body.intelligence ?? null);
    } catch {
      setErr({ code: 0, message: 'Network error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (candId && jobId) loadIntel(candId, jobId);
  }, [candId, jobId, loadIntel]);

  const selectedCand = candidates.find(c => c._id === candId);

  return (
    <div className="h-full flex flex-col" style={{ background: '#f8fafc' }}>
      {/* Header */}
      <div className="px-6 py-4 border-b bg-white flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${BRAND.primary}15` }}>
            <Brain size={20} style={{ color: BRAND.primary }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Competency Hiring Intelligence</h2>
            <p className="text-xs text-gray-500">Competency-driven candidate ↔ role match · developmental decision-support (never a hire/no-hire verdict)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={jobId} onChange={e => { setJobId(e.target.value); setCandId(''); setIntel(null); }}
            className="text-sm border rounded-lg px-3 py-2 bg-white" style={{ minWidth: 220 }}>
            <option value="">Select a role…</option>
            {jobs.map(j => <option key={j._id} value={j._id}>{j.title}{j.department ? ` · ${j.department}` : ''}</option>)}
          </select>
          {candId && jobId && (
            <button onClick={() => loadIntel(candId, jobId)} className="p-2 rounded-lg border hover:bg-gray-50" title="Refresh">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} style={{ color: BRAND.primary }} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Candidate list */}
        <div className="w-72 border-r bg-white flex flex-col">
          <div className="p-3 border-b">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search candidates…"
                className="w-full text-sm border rounded-lg pl-8 pr-3 py-2" />
            </div>
            <p className="text-[11px] text-gray-400 mt-2">{jobCands.length} candidate(s) for this role</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {!jobId && <p className="text-xs text-gray-400 p-4">Select a role to list candidates.</p>}
            {jobId && jobCands.length === 0 && <p className="text-xs text-gray-400 p-4">No candidates for this role.</p>}
            {jobCands.map(c => (
              <button key={c._id} onClick={() => setCandId(c._id)}
                className={`w-full text-left px-4 py-3 border-b hover:bg-gray-50 ${candId === c._id ? 'bg-blue-50' : ''}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900 truncate">{c.name}</span>
                  {c.stage && <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{c.stage}</span>}
                </div>
                <span className="text-[11px] text-gray-400 truncate block">{c.email}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Detail */}
        <div className="flex-1 overflow-y-auto p-6">
          {!candId && (
            <div className="h-full flex flex-col items-center justify-center text-center text-gray-400">
              <Users size={40} className="mb-3 opacity-40" />
              <p className="text-sm">Select a candidate to view competency-driven hiring intelligence.</p>
            </div>
          )}

          {loading && (
            <div className="h-full flex items-center justify-center text-gray-400">
              <RefreshCw size={24} className="animate-spin" />
            </div>
          )}

          {err && !loading && (
            <div className="max-w-lg mx-auto mt-10 rounded-xl border p-6 text-center"
              style={{ background: err.code === 503 ? '#fffbeb' : '#fef2f2', borderColor: err.code === 503 ? BRAND.gold : BRAND.red }}>
              <AlertTriangle size={28} className="mx-auto mb-3" style={{ color: err.code === 503 ? BRAND.gold : BRAND.red }} />
              <p className="font-semibold text-gray-800">
                {err.code === 503 ? 'Feature disabled' : err.code === 404 ? 'Not found in your organization' : 'Could not load intelligence'}
              </p>
              <p className="text-xs text-gray-500 mt-1">{err.message}</p>
              {err.code === 503 && <p className="text-[11px] text-gray-400 mt-2">The competency hiring feature flag is OFF — enable it to use this surface.</p>}
            </div>
          )}

          {intel && !loading && !err && (
            <div className="max-w-5xl mx-auto space-y-5">
              {/* Top: hiring score + fit + action */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Hiring score */}
                <div className="rounded-xl border bg-white p-5">
                  <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-gray-500"><Gauge size={14} /> Unified Hiring Score</div>
                  {intel.hiringScore.withheld ? (
                    <>
                      <div className="text-3xl font-bold text-gray-400">Withheld</div>
                      <p className="text-[11px] text-gray-500 mt-1">{intel.hiringScore.withheldReason}</p>
                    </>
                  ) : (
                    <>
                      <div className="text-4xl font-bold" style={{ color: SCORE_BAND_COLOR[intel.hiringScore.band ?? ''] ?? BRAND.primary }}>
                        {num(intel.hiringScore.hiringScore)}
                        <span className="text-base text-gray-400 font-medium">/100</span>
                      </div>
                      <div className="mt-1 text-xs font-semibold capitalize" style={{ color: SCORE_BAND_COLOR[intel.hiringScore.band ?? ''] ?? BRAND.primary }}>
                        {intel.hiringScore.band} band
                      </div>
                    </>
                  )}
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: intel.hiringScore.validated ? '#dcfce7' : '#f1f5f9', color: intel.hiringScore.validated ? '#16a34a' : '#64748b' }}>
                      {intel.hiringScore.validated ? 'Validated' : 'Not validated'}
                    </span>
                    {intel.hiringScore.provisional && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Provisional</span>}
                  </div>
                </div>

                {/* Competency match + fit */}
                <div className="rounded-xl border bg-white p-5">
                  <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-gray-500"><Target size={14} /> Competency Match</div>
                  <div className="text-4xl font-bold" style={{ color: BRAND.primary }}>
                    {num(intel.match.competencyMatch)}<span className="text-base text-gray-400 font-medium">/100</span>
                  </div>
                  <div className="mt-2"><FitBadge band={intel.match.fitSignal.band} /></div>
                  {intel.match.fitSignal.band == null && intel.match.fitSignal.assessedBand && (
                    <p className="text-[10px] text-gray-400 mt-1">Assessed-only band: {FIT_META[intel.match.fitSignal.assessedBand]?.label ?? intel.match.fitSignal.assessedBand} (coverage below floor)</p>
                  )}
                </div>

                {/* Recommended action */}
                <div className="rounded-xl border bg-white p-5">
                  <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-gray-500"><CheckCircle size={14} /> Decision Support</div>
                  {(() => {
                    const m = ACTION_META[intel.hiringRecommendation.action] ?? ACTION_META.insufficient_competency_evidence!;
                    return <span className="inline-flex px-3 py-1.5 rounded-lg text-sm font-bold" style={{ background: m.bg, color: m.color }}>{m.label}</span>;
                  })()}
                  <p className="text-[11px] text-gray-500 mt-3 leading-relaxed">{intel.hiringRecommendation.rationale}</p>
                </div>
              </div>

              {/* Coverage vs confidence (separate axes) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border bg-white p-5">
                  <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-gray-500"><Layers size={14} /> Coverage (requirements assessed)</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-gray-900">{num(intel.match.requirementCoveragePct, '%')}</span>
                    <span className="text-xs text-gray-400">{intel.match.matchedRequirementCount}/{intel.match.totalRequirementCount} requirements</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${intel.match.requirementCoveragePct ?? 0}%`, background: intel.match.fitSignal.coverageSufficient ? BRAND.green : BRAND.orange }} />
                  </div>
                  <p className="text-[11px] text-gray-500 mt-2">{intel.match.coverageNote}</p>
                </div>
                <div className="rounded-xl border bg-white p-5">
                  <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-gray-500"><ShieldCheck size={14} /> Confidence (calibration)</div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold capitalize px-2.5 py-1 rounded-lg" style={{ background: intel.match.calibration.state === 'calibrated' ? '#dcfce7' : '#f1f5f9', color: intel.match.calibration.state === 'calibrated' ? '#16a34a' : '#64748b' }}>
                      {intel.match.calibration.state}
                    </span>
                    <span className="text-xs text-gray-400">{num(intel.match.calibration.realizedOutcomes)}/{intel.match.calibration.minRequired} realized outcomes</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-2">{intel.match.confidenceNote}</p>
                </div>
              </div>

              {/* Role DNA */}
              <div className="rounded-xl border bg-white p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-500"><Briefcase size={14} /> Role DNA — {intel.match.roleDna.roleTitle ?? 'Unresolved'}</div>
                  <div className="flex gap-2 text-[10px] text-gray-400">
                    <span>source: {intel.match.roleDna.requirementSource}</span>
                    <span>· confidence {num(intel.match.roleDna.confidence)}</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-400 border-b">
                        <th className="text-left py-1.5 font-medium">Competency</th>
                        <th className="text-left font-medium">Tier</th>
                        <th className="text-right font-medium">Target</th>
                        <th className="text-right font-medium">Candidate</th>
                        <th className="text-right font-medium">Attainment</th>
                        <th className="text-right font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {intel.match.requirements.map(r => (
                        <tr key={r.code} className="border-b last:border-0">
                          <td className="py-1.5 font-medium text-gray-800">{r.name}</td>
                          <td className="text-gray-500 capitalize">{r.importanceTier}</td>
                          <td className="text-right text-gray-600">{num(r.targetScore)}</td>
                          <td className="text-right text-gray-600">{num(r.candidateScore)}</td>
                          <td className="text-right font-semibold" style={{ color: r.attainment == null ? '#94a3b8' : r.attainment >= 100 ? '#16a34a' : r.attainment >= 70 ? BRAND.orange : BRAND.red }}>
                            {num(r.attainment, '%')}
                          </td>
                          <td className="text-right">
                            {r.assessed
                              ? (r.matchVia === 'domain_proxy'
                                  ? <span className="text-[10px] text-amber-600" title="Scored from the candidate's measured onto-domain score (domain-proxy) — a developmental approximation, not a per-competency measurement.">assessed · domain-proxy</span>
                                  : <span className="text-[10px] text-green-600">assessed</span>)
                              : <span className="text-[10px] text-gray-400">unassessed</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Readiness + benchmark */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border bg-white p-5">
                  <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-gray-500"><BarChart3 size={14} /> Candidate Readiness</div>
                  {intel.match.candidateReadiness.available ? (
                    <>
                      <div className="text-2xl font-bold text-gray-900">{num(intel.match.candidateReadiness.readinessScore)}
                        <span className="text-sm text-gray-400 font-medium capitalize"> · {intel.match.candidateReadiness.band}</span></div>
                      <p className="text-[11px] text-gray-500 mt-1">{intel.match.candidateReadiness.note}</p>
                    </>
                  ) : <p className="text-xs text-gray-400">{intel.match.candidateReadiness.note}</p>}
                </div>
                <div className="rounded-xl border bg-white p-5">
                  <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-gray-500"><Users size={14} /> Role Benchmark (k≥{intel.benchmark.kMin})</div>
                  {intel.benchmark.available && !intel.benchmark.suppressed ? (
                    <>
                      <div className="text-sm text-gray-700">Cohort n={intel.benchmark.sampleSize}</div>
                      <p className="text-[11px] text-gray-500 mt-1">{intel.benchmark.note}</p>
                    </>
                  ) : (
                    <p className="text-xs text-gray-400">{intel.benchmark.note}</p>
                  )}
                </div>
              </div>

              {/* Interview recommendation */}
              <div className="rounded-xl border bg-white p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-500"><Brain size={14} /> Interview Recommendation</div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 capitalize">{intel.interviewRecommendation.structure.replace(/_/g, ' ')}</span>
                </div>
                <p className="text-[11px] text-gray-500 mb-3">{intel.interviewRecommendation.note}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] font-semibold text-gray-600 mb-1.5">Measured focus areas ({intel.interviewRecommendation.focusAreas.length})</p>
                    {intel.interviewRecommendation.focusAreas.length === 0 && <p className="text-[11px] text-gray-400">No measured gaps.</p>}
                    {intel.interviewRecommendation.focusAreas.map(f => (
                      <div key={f.code} className="text-[11px] py-1 border-b last:border-0">
                        <span className="font-medium text-gray-800">{f.name}</span>
                        <span className="text-gray-400"> · {num(f.candidateScore)}/{num(f.targetScore)}{f.shortfall != null ? ` (−${num(f.shortfall)})` : ''}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-gray-600 mb-1.5">Evidence to gather ({intel.interviewRecommendation.probeAreas.length})</p>
                    {intel.interviewRecommendation.probeAreas.length === 0 && <p className="text-[11px] text-gray-400">All requirements assessed.</p>}
                    {intel.interviewRecommendation.probeAreas.map(f => (
                      <div key={f.code} className="text-[11px] py-1 border-b last:border-0">
                        <span className="font-medium text-gray-800">{f.name}</span>
                        <span className="text-gray-400 capitalize"> · {f.importanceTier}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="rounded-xl border p-4 flex gap-3" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
                <Info size={16} className="text-gray-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-gray-500 leading-relaxed">{intel.hiringRecommendation.disclaimer}</p>
              </div>

              {selectedCand && (
                <p className="text-[10px] text-gray-300 text-center">subject: {intel.subjectId ?? selectedCand.email} · source: {intel.match.source}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
