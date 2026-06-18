/**
 * EP-98-W3 — Hiring Intelligence Panel
 *
 * Replaces keyword hiring with intelligence hiring.
 * Tabs: Overview · Jobs · Assessments · Blueprint · Recommendation
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Brain, Briefcase, Users, ChevronRight, RefreshCw,
  Target, TrendingUp, Clock, Award, Zap, CheckCircle,
  AlertCircle, XCircle, Activity, BarChart3, Layers,
  ChevronDown, ChevronUp, Shield, Star, ArrowRight,
  FileText, Lightbulb, Flag, Search,
} from 'lucide-react';

const BRAND = {
  primary: '#344E86', accent: '#4ECDC4', green: '#2A9D8F',
  red: '#e63946', orange: '#f4a261', purple: '#8b5cf6', gold: '#f59e0b',
};

function authHdr() {
  const t = localStorage.getItem('metryx_token');
  return t
    ? { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface JobRow {
  id: string; title: string; department: string; status: string;
  assessment_count: number; avg_fit_score: number | null;
  strong_hire_count: number; hire_count: number; no_hire_count: number;
}

interface Assessment {
  id: string; candidate_id: string; candidate_name: string;
  job_id: string;
  competency_match: number; behavior_match: number; culture_match: number;
  potential_match: number; growth_match: number;
  fit_score: number; readiness_score: number; success_probability: number;
  ramp_up_days: number; retention_probability: number;
  performance_prediction: number; leadership_prediction: number;
  interview_recommendation: string;
  hiring_recommendation: {
    verdict: 'STRONG_HIRE' | 'HIRE' | 'CONDITIONAL_HIRE' | 'NO_HIRE';
    confidence: number; rationale: string;
    conditions: string[]; strengths: string[]; risks: string[];
    developmentAreas: string[];
  };
}

interface BlueprintSection {
  focus: string; rationale: string;
  questions: string[]; probeFor: string[]; redFlags: string[];
}

interface Blueprint {
  candidateName: string; fitScore: number; readinessScore: number;
  recommendation: string;
  blueprint: {
    sections: BlueprintSection[];
    recommendedFormat: string;
    estimatedDurationMinutes: number;
    priorityFocusArea: string;
  };
}

interface ReadinessData {
  structuralReadiness: number; passed: number; total: number;
  data: { ep98Tables: number; assessmentsComputed: number };
  note: string;
  checks: Array<{ id: string; category: string; label: string; pass: boolean }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const VERDICT_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  STRONG_HIRE:      { label: 'Strong Hire',  color: '#16a34a', bg: '#dcfce7', icon: <Star    size={12} /> },
  HIRE:             { label: 'Hire',          color: BRAND.green,  bg: '#d1fae5', icon: <CheckCircle size={12} /> },
  CONDITIONAL_HIRE: { label: 'Conditional',  color: BRAND.orange, bg: '#fef3c7', icon: <AlertCircle size={12} /> },
  NO_HIRE:          { label: 'No Hire',      color: BRAND.red,    bg: '#fee2e2', icon: <XCircle    size={12} /> },
};

function VerdictBadge({ verdict }: { verdict: string }) {
  const m = VERDICT_META[verdict] ?? VERDICT_META.NO_HIRE!;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold"
      style={{ backgroundColor: m.bg, color: m.color }}>
      {m.icon}{m.label}
    </span>
  );
}

function ScoreBar({ value, color = BRAND.primary, label }: { value: number; color?: string; label?: string }) {
  return (
    <div className="space-y-0.5">
      {label && <div className="text-[10px] text-gray-500 flex justify-between"><span>{label}</span><span className="font-semibold" style={{ color }}>{Math.round(value)}</span></div>}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, value)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function ScorePill({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="text-center">
      <div className="text-lg font-bold" style={{ color }}>{Math.round(value)}</div>
      <div className="text-[9px] text-gray-400 leading-tight">{label}</div>
    </div>
  );
}

function ReadinessGauge({ pct }: { pct: number }) {
  const color = pct >= 98 ? BRAND.green : pct >= 80 ? BRAND.orange : BRAND.red;
  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="3" />
        <circle cx="18" cy="18" r="15.9" fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${pct} ${100 - pct}`} strokeLinecap="round" />
      </svg>
      <div className="absolute text-center">
        <div className="text-xl font-bold" style={{ color }}>{pct}%</div>
        <div className="text-[9px] text-gray-400">readiness</div>
      </div>
    </div>
  );
}

type HiTab = 'overview' | 'jobs' | 'assessments' | 'blueprint' | 'recommendation';

// ── Main Component ─────────────────────────────────────────────────────────────

export default function HiringIntelligencePanel() {
  const [tab, setTab]                         = useState<HiTab>('overview');
  const [readiness, setReadiness]             = useState<ReadinessData | null>(null);
  const [jobs, setJobs]                       = useState<JobRow[]>([]);
  const [selectedJobId, setSelectedJobId]     = useState<string>('');
  const [assessments, setAssessments]         = useState<Assessment[]>([]);
  const [selectedCandId, setSelectedCandId]   = useState<string>('');
  const [blueprint, setBlueprint]             = useState<Blueprint | null>(null);
  const [recommendation, setRecommendation]   = useState<any | null>(null);
  const [analyzing, setAnalyzing]             = useState<string>('');   // jobId being analyzed
  const [loadingAssess, setLoadingAssess]     = useState(false);
  const [loadingBlueprint, setLoadingBlueprint] = useState(false);
  const [loadingRec, setLoadingRec]           = useState(false);
  const [checksOpen, setChecksOpen]           = useState(false);
  const [searchQ, setSearchQ]                 = useState('');

  // Fetch readiness + jobs on mount
  const loadOverview = useCallback(async () => {
    const [rRes, jRes] = await Promise.all([
      fetch('/api/employer/hiring/readiness', { headers: authHdr() as HeadersInit }).catch(() => null),
      fetch('/api/employer/hiring/jobs',      { headers: authHdr() as HeadersInit }).catch(() => null),
    ]);
    if (rRes?.ok) setReadiness(await rRes.json());
    if (jRes?.ok) { const d = await jRes.json(); setJobs(d.jobs ?? []); }
  }, []);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  const runAnalyze = useCallback(async (jobId: string) => {
    setAnalyzing(jobId);
    await fetch(`/api/employer/hiring/analyze/${jobId}`, {
      method: 'POST', headers: authHdr() as HeadersInit,
    }).catch(() => {});
    await loadOverview();
    setAnalyzing('');
  }, [loadOverview]);

  const loadAssessments = useCallback(async (jobId: string) => {
    if (!jobId) return;
    setLoadingAssess(true);
    const res = await fetch(`/api/employer/hiring/assessments/${jobId}`, { headers: authHdr() as HeadersInit }).catch(() => null);
    if (res?.ok) { const d = await res.json(); setAssessments(d.assessments ?? []); }
    setLoadingAssess(false);
  }, []);

  const loadBlueprint = useCallback(async (jobId: string, candId: string) => {
    if (!jobId || !candId) return;
    setLoadingBlueprint(true);
    const res = await fetch(`/api/employer/hiring/blueprint/${jobId}/${candId}`, { headers: authHdr() as HeadersInit }).catch(() => null);
    if (res?.ok) setBlueprint(await res.json());
    else setBlueprint(null);
    setLoadingBlueprint(false);
  }, []);

  const loadRecommendation = useCallback(async (jobId: string, candId: string) => {
    if (!jobId || !candId) return;
    setLoadingRec(true);
    const res = await fetch(`/api/employer/hiring/recommendation/${jobId}/${candId}`, { headers: authHdr() as HeadersInit }).catch(() => null);
    if (res?.ok) setRecommendation(await res.json());
    else setRecommendation(null);
    setLoadingRec(false);
  }, []);

  // Auto-load when job/cand changes
  useEffect(() => {
    if (tab === 'assessments' && selectedJobId) loadAssessments(selectedJobId);
  }, [tab, selectedJobId, loadAssessments]);

  useEffect(() => {
    if (tab === 'blueprint') loadBlueprint(selectedJobId, selectedCandId);
  }, [tab, selectedJobId, selectedCandId, loadBlueprint]);

  useEffect(() => {
    if (tab === 'recommendation') loadRecommendation(selectedJobId, selectedCandId);
  }, [tab, selectedJobId, selectedCandId, loadRecommendation]);

  const TABS: Array<{ id: HiTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview',        label: 'Overview',          icon: <Activity size={14} /> },
    { id: 'jobs',            label: 'Jobs',              icon: <Briefcase size={14} /> },
    { id: 'assessments',     label: 'Assessments',       icon: <BarChart3 size={14} /> },
    { id: 'blueprint',       label: 'Interview Blueprint', icon: <FileText size={14} /> },
    { id: 'recommendation',  label: 'Hiring Decision',   icon: <Flag size={14} /> },
  ];

  // Summary stats
  const totalAssessed   = jobs.reduce((s, j) => s + j.assessment_count, 0);
  const totalStrongHire = jobs.reduce((s, j) => s + j.strong_hire_count, 0);
  const totalHire       = jobs.reduce((s, j) => s + j.hire_count, 0);
  const avgFit          = jobs.filter(j => j.avg_fit_score !== null).length > 0
    ? Math.round(jobs.filter(j => j.avg_fit_score !== null)
        .reduce((s, j) => s + (j.avg_fit_score ?? 0), 0) /
        jobs.filter(j => j.avg_fit_score !== null).length)
    : 0;

  const filteredAssessments = assessments.filter(a =>
    !searchQ || a.candidate_name?.toLowerCase().includes(searchQ.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${BRAND.primary}15` }}>
              <Brain size={20} style={{ color: BRAND.primary }} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Hiring Intelligence</h2>
              <p className="text-[11px] text-gray-500">EP-98-W3 · Intelligence hiring replacing keyword hiring</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {readiness && (
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg`}
                style={{
                  backgroundColor: readiness.structuralReadiness >= 98 ? '#dcfce7' : '#fef3c7',
                  color: readiness.structuralReadiness >= 98 ? '#16a34a' : BRAND.orange,
                }}>
                {readiness.structuralReadiness}% ready
              </span>
            )}
            <button onClick={loadOverview}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Tab strip */}
        <div className="flex gap-1 mt-4 border-b border-gray-100 pb-0">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-all ${
                tab === t.id ? 'border-current' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              style={tab === t.id ? { color: BRAND.primary, borderColor: BRAND.primary } : {}}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── OVERVIEW ───────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Jobs with Intelligence', value: jobs.filter(j => j.assessment_count > 0).length, icon: <Briefcase size={16} />, color: BRAND.primary },
              { label: 'Candidates Assessed',    value: totalAssessed,   icon: <Users size={16} />,      color: BRAND.accent },
              { label: 'Strong Hire + Hire',     value: totalStrongHire + totalHire, icon: <Star size={16} />, color: BRAND.green },
              { label: 'Avg Fit Score',          value: totalAssessed > 0 ? `${avgFit}/100` : '—', icon: <Target size={16} />, color: BRAND.orange },
            ].map(kpi => (
              <div key={kpi.label} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2"
                  style={{ backgroundColor: `${kpi.color}15` }}>
                  <span style={{ color: kpi.color }}>{kpi.icon}</span>
                </div>
                <div className="text-xl font-bold text-gray-900">{kpi.value}</div>
                <div className="text-[10px] text-gray-500">{kpi.label}</div>
              </div>
            ))}
          </div>

          {/* Readiness + system check */}
          {readiness && (
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-start gap-6">
                <ReadinessGauge pct={readiness.structuralReadiness} />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-800 mb-1">System Readiness</h3>
                  <p className="text-xs text-gray-500 mb-3">{readiness.note}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: BRAND.green }} />
                      <span>{readiness.passed}/{readiness.total} checks pass</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: BRAND.accent }} />
                      <span>{readiness.data.ep98Tables} tables deployed</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: BRAND.primary }} />
                      <span>{readiness.data.assessmentsComputed} assessments computed</span>
                    </div>
                  </div>
                  <button onClick={() => setChecksOpen(!checksOpen)}
                    className="mt-3 flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600">
                    {checksOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    {checksOpen ? 'Hide' : 'Show'} all {readiness.total} structural checks
                  </button>
                </div>
              </div>

              {checksOpen && (
                <div className="mt-4 border-t border-gray-50 pt-4 space-y-1 max-h-96 overflow-y-auto">
                  {Object.entries(
                    readiness.checks.reduce((acc, c) => {
                      (acc[c.category] = acc[c.category] ?? []).push(c);
                      return acc;
                    }, {} as Record<string, typeof readiness.checks>),
                  ).map(([cat, items]) => (
                    <div key={cat} className="mb-3">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">{cat}</div>
                      {items.map(c => (
                        <div key={c.id} className="flex items-center gap-2 py-0.5">
                          {c.pass
                            ? <CheckCircle size={11} style={{ color: BRAND.green }} />
                            : <XCircle    size={11} style={{ color: BRAND.orange }} />}
                          <span className={`text-[11px] ${c.pass ? 'text-gray-600' : 'text-orange-600'}`}>{c.label}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Intelligence capabilities */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Intelligence Capabilities</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { title: 'Role Intelligence', color: BRAND.primary, items: ['Competency Requirements', 'Behavioral Profile (7 dims)', 'Culture Signal Extraction', 'Growth Ceiling Classification'] },
                { title: '6 Match Dimensions', color: BRAND.accent, items: ['Competency Match (35%)', 'Behavior Match (25%)', 'Culture Match (15%)', 'Potential Match (15%)', 'Growth Match (10%)', '→ Composite Fit Score'] },
                { title: '7 Predictions + 3 Outputs', color: BRAND.green, items: ['Fit · Readiness · Success', 'Ramp-Up Days · Retention %', 'Performance · Leadership', 'Interview Blueprint', 'Interview Recommendation', 'Hiring Recommendation'] },
              ].map(cap => (
                <div key={cap.title} className="p-3 rounded-xl border border-gray-100">
                  <div className="text-xs font-bold mb-2" style={{ color: cap.color }}>{cap.title}</div>
                  {cap.items.map(item => (
                    <div key={item} className="flex items-center gap-1.5 py-0.5">
                      <div className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: cap.color }} />
                      <span className="text-[11px] text-gray-600">{item}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── JOBS ───────────────────────────────────────────────────────────── */}
      {tab === 'jobs' && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Jobs · Run Intelligence Analysis</h3>
            <button onClick={loadOverview}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
          {jobs.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-sm">
              No jobs found. Create jobs in the Job Board tab first.
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {jobs.map(job => (
                <div key={job.id} className="p-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{job.title}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md font-medium"
                        style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }}>
                        {job.department || 'No Dept'}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md font-medium"
                        style={{ backgroundColor: job.status === 'Active' ? '#dcfce7' : '#f1f5f9',
                                 color: job.status === 'Active' ? '#16a34a' : '#64748b' }}>
                        {job.status}
                      </span>
                    </div>
                    {job.assessment_count > 0 ? (
                      <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                        <span className="text-[11px] text-gray-500">{job.assessment_count} assessed</span>
                        {job.avg_fit_score !== null && (
                          <span className="text-[11px] font-semibold" style={{ color: BRAND.primary }}>
                            avg fit {Math.round(job.avg_fit_score)}/100
                          </span>
                        )}
                        {job.strong_hire_count > 0 && (
                          <span className="text-[11px] font-semibold" style={{ color: '#16a34a' }}>
                            {job.strong_hire_count} strong hire
                          </span>
                        )}
                        {job.hire_count > 0 && (
                          <span className="text-[11px]" style={{ color: BRAND.green }}>
                            {job.hire_count} hire
                          </span>
                        )}
                        {job.no_hire_count > 0 && (
                          <span className="text-[11px]" style={{ color: BRAND.red }}>
                            {job.no_hire_count} no-hire
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="text-[11px] text-gray-400 mt-1">Not yet analyzed</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {job.assessment_count > 0 && (
                      <button
                        onClick={() => { setSelectedJobId(job.id); setTab('assessments'); }}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">
                        View
                      </button>
                    )}
                    <button
                      onClick={() => runAnalyze(job.id)}
                      disabled={analyzing === job.id}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white transition-all disabled:opacity-60"
                      style={{ backgroundColor: BRAND.primary }}>
                      {analyzing === job.id ? (
                        <span className="flex items-center gap-1"><RefreshCw size={11} className="animate-spin" />Analyzing…</span>
                      ) : (
                        <span className="flex items-center gap-1"><Zap size={11} />{job.assessment_count > 0 ? 'Re-analyze' : 'Analyze'}</span>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ASSESSMENTS ────────────────────────────────────────────────────── */}
      {tab === 'assessments' && (
        <div className="space-y-4">
          {/* Job selector */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-3">
            <label className="text-xs font-semibold text-gray-600">Select Job:</label>
            <select
              value={selectedJobId}
              onChange={e => { setSelectedJobId(e.target.value); setSelectedCandId(''); }}
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none"
              style={{ maxWidth: 320 }}>
              <option value="">— choose a job —</option>
              {jobs.map(j => (
                <option key={j.id} value={j.id}>{j.title} ({j.assessment_count} assessed)</option>
              ))}
            </select>
            {selectedJobId && (
              <div className="relative flex-1" style={{ maxWidth: 220 }}>
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  placeholder="Search candidates…"
                  className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none" />
              </div>
            )}
          </div>

          {/* Candidate leaderboard */}
          {selectedJobId && (
            loadingAssess ? (
              <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center text-gray-400 text-sm shadow-sm">
                <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-gray-300" />
                Loading assessments…
              </div>
            ) : filteredAssessments.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center text-gray-400 text-sm shadow-sm">
                {assessments.length === 0
                  ? 'No assessments yet — go to Jobs tab and click Analyze.'
                  : 'No candidates match search.'}
              </div>
            ) : (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-50">
                  <h3 className="text-sm font-semibold text-gray-800">
                    Candidate Leaderboard — {filteredAssessments.length} candidate{filteredAssessments.length !== 1 ? 's' : ''}
                    <span className="text-xs text-gray-400 font-normal ml-2">sorted by Fit Score ↓</span>
                  </h3>
                </div>

                {/* Score legend */}
                <div className="px-4 py-2 bg-gray-50/50 border-b border-gray-50 flex flex-wrap gap-3 text-[10px] text-gray-500">
                  {[
                    { label: 'Fit', color: BRAND.primary },
                    { label: 'Readiness', color: BRAND.accent },
                    { label: 'Success', color: BRAND.green },
                    { label: 'Ramp-Up', color: BRAND.orange, suffix: 'd' },
                    { label: 'Retention', color: BRAND.purple },
                    { label: 'Performance', color: '#0ea5e9' },
                    { label: 'Leadership', color: BRAND.gold },
                  ].map(s => (
                    <span key={s.label} className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: s.color }} />
                      {s.label}
                    </span>
                  ))}
                </div>

                <div className="divide-y divide-gray-50">
                  {filteredAssessments.map((a, i) => (
                    <div key={a.id} className="p-4 hover:bg-gray-50/30 transition-colors">
                      <div className="flex items-start gap-3">
                        {/* Rank */}
                        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold mt-0.5"
                          style={{
                            backgroundColor: i === 0 ? '#fef3c7' : i === 1 ? '#f1f5f9' : '#f9fafb',
                            color: i === 0 ? '#d97706' : '#64748b',
                          }}>
                          {i + 1}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Name + verdict */}
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span className="text-sm font-semibold text-gray-900">{a.candidate_name || '—'}</span>
                            <VerdictBadge verdict={a.hiring_recommendation?.verdict ?? 'NO_HIRE'} />
                            <span className="text-[10px] text-gray-400">confidence {Math.round(a.hiring_recommendation?.confidence ?? 0)}/100</span>
                          </div>

                          {/* Score pills */}
                          <div className="grid grid-cols-7 gap-2 mb-3">
                            <ScorePill value={a.fit_score}              label="Fit"         color={BRAND.primary} />
                            <ScorePill value={a.readiness_score}        label="Ready"       color={BRAND.accent} />
                            <ScorePill value={a.success_probability}    label="Success"     color={BRAND.green} />
                            <ScorePill value={a.ramp_up_days}           label="Ramp-Up(d)"  color={BRAND.orange} />
                            <ScorePill value={a.retention_probability}  label="Retention"   color={BRAND.purple} />
                            <ScorePill value={a.performance_prediction} label="Perform."    color="#0ea5e9" />
                            <ScorePill value={a.leadership_prediction}  label="Leadership"  color={BRAND.gold} />
                          </div>

                          {/* Dimension bars */}
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-x-4 gap-y-1">
                            <ScoreBar value={a.competency_match} label="Competency" color={BRAND.primary} />
                            <ScoreBar value={a.behavior_match}   label="Behavior"   color={BRAND.accent} />
                            <ScoreBar value={a.culture_match}    label="Culture"    color={BRAND.green} />
                            <ScoreBar value={a.potential_match}  label="Potential"  color={BRAND.orange} />
                            <ScoreBar value={a.growth_match}     label="Growth"     color={BRAND.purple} />
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-1.5 shrink-0">
                          <button
                            onClick={() => { setSelectedCandId(a.candidate_id); setTab('blueprint'); }}
                            className="text-[11px] px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1">
                            <FileText size={10} />Blueprint
                          </button>
                          <button
                            onClick={() => { setSelectedCandId(a.candidate_id); setTab('recommendation'); }}
                            className="text-[11px] px-2.5 py-1.5 rounded-lg text-white flex items-center gap-1"
                            style={{ backgroundColor: BRAND.primary }}>
                            <Flag size={10} />Decision
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* ── BLUEPRINT ──────────────────────────────────────────────────────── */}
      {tab === 'blueprint' && (
        <div className="space-y-4">
          {/* Selectors */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-3">
            <select value={selectedJobId}
              onChange={e => { setSelectedJobId(e.target.value); setSelectedCandId(''); setBlueprint(null); }}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none" style={{ maxWidth: 280 }}>
              <option value="">— select job —</option>
              {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
            <select value={selectedCandId}
              onChange={e => setSelectedCandId(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none" style={{ maxWidth: 280 }}
              disabled={!selectedJobId}>
              <option value="">— select candidate —</option>
              {assessments.map(a => <option key={a.candidate_id} value={a.candidate_id}>{a.candidate_name}</option>)}
            </select>
          </div>

          {loadingBlueprint && (
            <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm">
              <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-400">Loading blueprint…</p>
            </div>
          )}

          {!loadingBlueprint && blueprint && (
            <div className="space-y-4">
              {/* Header card */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">{blueprint.candidateName}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Interview Blueprint</p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-xs font-semibold" style={{ color: BRAND.primary }}>
                        Fit {blueprint.fitScore}/100
                      </span>
                      <span className="text-xs text-gray-500">·</span>
                      <span className="text-xs font-semibold" style={{ color: BRAND.accent }}>
                        Readiness {blueprint.readinessScore}/100
                      </span>
                      <span className="text-xs text-gray-500">·</span>
                      <span className="text-xs font-medium capitalize text-gray-600">
                        {blueprint.blueprint.recommendedFormat} interview
                      </span>
                      <span className="text-xs text-gray-500">·</span>
                      <span className="text-xs text-gray-600">
                        {blueprint.blueprint.estimatedDurationMinutes} min
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[11px] text-gray-400 mb-1">Priority Focus</div>
                    <div className="text-xs font-bold px-2.5 py-1 rounded-lg"
                      style={{ backgroundColor: `${BRAND.orange}15`, color: BRAND.orange }}>
                      {blueprint.blueprint.priorityFocusArea}
                    </div>
                  </div>
                </div>
                {blueprint.recommendation && (
                  <div className="mt-4 p-3 rounded-xl text-xs text-gray-700 border-l-4 bg-blue-50/50 border-blue-300">
                    <span className="font-semibold text-gray-800">Interviewer guidance: </span>
                    {blueprint.recommendation}
                  </div>
                )}
              </div>

              {/* Sections */}
              {blueprint.blueprint.sections.map((section, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                      style={{ backgroundColor: BRAND.primary }}>
                      {i + 1}
                    </div>
                    <h4 className="text-sm font-bold text-gray-900">{section.focus}</h4>
                    {i === 0 && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded"
                        style={{ backgroundColor: `${BRAND.orange}20`, color: BRAND.orange }}>
                        PRIORITY
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 italic mb-4 pl-8">{section.rationale}</p>

                  <div className="pl-8 space-y-4">
                    {/* Questions */}
                    <div>
                      <div className="text-[11px] font-bold text-gray-700 mb-2 flex items-center gap-1">
                        <Lightbulb size={11} style={{ color: BRAND.accent }} /> Questions
                      </div>
                      <div className="space-y-2">
                        {section.questions.map((q, qi) => (
                          <div key={qi} className="flex gap-2">
                            <span className="text-[10px] text-gray-400 font-bold shrink-0 mt-0.5">{qi + 1}.</span>
                            <p className="text-xs text-gray-700 leading-relaxed">{q}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Probe for */}
                      <div>
                        <div className="text-[11px] font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                          <Target size={11} style={{ color: BRAND.green }} /> Probe For
                        </div>
                        {section.probeFor.map((p, pi) => (
                          <div key={pi} className="flex items-start gap-1.5 mb-1">
                            <div className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: BRAND.green }} />
                            <span className="text-[11px] text-gray-600">{p}</span>
                          </div>
                        ))}
                      </div>

                      {/* Red flags */}
                      <div>
                        <div className="text-[11px] font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                          <AlertCircle size={11} style={{ color: BRAND.red }} /> Red Flags
                        </div>
                        {section.redFlags.map((f, fi) => (
                          <div key={fi} className="flex items-start gap-1.5 mb-1">
                            <div className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: BRAND.red }} />
                            <span className="text-[11px] text-gray-600">{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loadingBlueprint && !blueprint && selectedJobId && selectedCandId && (
            <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm">
              <AlertCircle size={24} className="mx-auto mb-2 text-orange-400" />
              <p className="text-sm text-gray-500">Blueprint not available. Run <strong>Analyze</strong> for this job first.</p>
            </div>
          )}

          {!selectedJobId && (
            <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm text-gray-400 text-sm">
              Select a job and candidate to view the Interview Blueprint.
            </div>
          )}
        </div>
      )}

      {/* ── HIRING RECOMMENDATION ──────────────────────────────────────────── */}
      {tab === 'recommendation' && (
        <div className="space-y-4">
          {/* Selectors */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-3">
            <select value={selectedJobId}
              onChange={e => { setSelectedJobId(e.target.value); setSelectedCandId(''); setRecommendation(null); }}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none" style={{ maxWidth: 280 }}>
              <option value="">— select job —</option>
              {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
            <select value={selectedCandId}
              onChange={e => setSelectedCandId(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none" style={{ maxWidth: 280 }}
              disabled={!selectedJobId}>
              <option value="">— select candidate —</option>
              {assessments.map(a => <option key={a.candidate_id} value={a.candidate_id}>{a.candidate_name}</option>)}
            </select>
          </div>

          {loadingRec && (
            <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm">
              <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-400">Loading recommendation…</p>
            </div>
          )}

          {!loadingRec && recommendation && (() => {
            const rec = recommendation.recommendation as Assessment['hiring_recommendation'];
            const vm  = VERDICT_META[rec.verdict] ?? VERDICT_META.NO_HIRE!;
            return (
              <div className="space-y-4">
                {/* Verdict card */}
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-gray-900">{recommendation.candidateName}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Hiring Recommendation</p>
                    </div>
                    <div className="shrink-0 text-center">
                      <div className="text-2xl font-black px-4 py-2 rounded-xl" style={{ backgroundColor: vm.bg, color: vm.color }}>
                        {vm.label.toUpperCase()}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1">confidence {Math.round(rec.confidence)}/100</div>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-gray-600 leading-relaxed border-l-4 pl-3 italic"
                    style={{ borderColor: vm.color }}>
                    {rec.rationale}
                  </p>
                </div>

                {/* Prediction scores */}
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                  <h4 className="text-sm font-semibold text-gray-800 mb-4">Intelligence Scores</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Fit Score',           value: recommendation.fitScore,              color: BRAND.primary,  suffix: '/100' },
                      { label: 'Readiness',           value: recommendation.readinessScore,        color: BRAND.accent,   suffix: '/100' },
                      { label: 'Success Probability', value: recommendation.successProbability,    color: BRAND.green,    suffix: '/100' },
                      { label: 'Ramp-Up',             value: recommendation.rampUpDays,            color: BRAND.orange,   suffix: ' days' },
                      { label: 'Retention',           value: recommendation.retentionProbability,  color: BRAND.purple,   suffix: '%' },
                      { label: 'Performance (T+6)',   value: recommendation.performancePrediction, color: '#0ea5e9',      suffix: '/100' },
                      { label: 'Leadership',          value: recommendation.leadershipPrediction,  color: BRAND.gold,     suffix: '/100' },
                    ].map(s => (
                      <div key={s.label} className="p-3 rounded-xl border border-gray-100 text-center">
                        <div className="text-xl font-bold" style={{ color: s.color }}>
                          {Math.round(s.value)}{s.suffix}
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Strengths / Risks / Conditions / Development */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <h4 className="text-xs font-bold mb-3 flex items-center gap-1.5" style={{ color: BRAND.green }}>
                      <CheckCircle size={13} /> Strengths
                    </h4>
                    {rec.strengths.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: BRAND.green }} />
                        <span className="text-xs text-gray-700">{s}</span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <h4 className="text-xs font-bold mb-3 flex items-center gap-1.5" style={{ color: BRAND.red }}>
                      <AlertCircle size={13} /> Risks
                    </h4>
                    {rec.risks.map((r, i) => (
                      <div key={i} className="flex items-start gap-2 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: BRAND.red }} />
                        <span className="text-xs text-gray-700">{r}</span>
                      </div>
                    ))}
                  </div>

                  {rec.conditions.length > 0 && (
                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                      <h4 className="text-xs font-bold mb-3 flex items-center gap-1.5" style={{ color: BRAND.orange }}>
                        <Shield size={13} /> Conditions Before Offer
                      </h4>
                      {rec.conditions.map((c, i) => (
                        <div key={i} className="flex items-start gap-2 mb-2">
                          <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: BRAND.orange }} />
                          <span className="text-xs text-gray-700">{c}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {rec.developmentAreas.length > 0 && (
                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                      <h4 className="text-xs font-bold mb-3 flex items-center gap-1.5" style={{ color: BRAND.purple }}>
                        <TrendingUp size={13} /> Development Areas
                      </h4>
                      {rec.developmentAreas.map((d, i) => (
                        <div key={i} className="flex items-start gap-2 mb-2">
                          <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: BRAND.purple }} />
                          <span className="text-xs text-gray-700">{d}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {!loadingRec && !recommendation && selectedJobId && selectedCandId && (
            <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm">
              <AlertCircle size={24} className="mx-auto mb-2 text-orange-400" />
              <p className="text-sm text-gray-500">Recommendation not available. Run <strong>Analyze</strong> for this job first.</p>
            </div>
          )}

          {!selectedJobId && (
            <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm text-gray-400 text-sm">
              Select a job and candidate to view the Hiring Decision.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
