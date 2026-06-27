import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield, DollarSign, Cpu, Network, Brain, Users2, Grid3X3, GitBranch,
  AlertTriangle, BarChart3, Megaphone, Shuffle, BookOpen, RefreshCw,
  Globe, TrendingUp, Play, Gauge, FileText, LayoutDashboard, Target,
  CheckCircle2, PieChart, Sliders, Plug, Box, Award, ChevronRight,
  Loader2, XCircle, ArrowUp, ArrowDown, Minus, Activity, Briefcase,
  Building2, Star, Zap, Flag, Search, Eye, BarChart2, Users, Layers,
  Clock, CheckSquare, AlertCircle, Link2, Server, Database, GitMerge,
  Download, Upload, X,
} from 'lucide-react';

interface PillarDef { id: number; label: string; group: string; icon: React.ReactNode; route: string; badge?: string; }

const PILLARS: PillarDef[] = [
  { id: 1,  label: 'Security & Enterprise', group: 'Foundation',    icon: <Shield size={14} />,          route: '',                                             badge: 'W1'  },
  { id: 2,  label: 'Commercial OS',          group: 'Foundation',    icon: <DollarSign size={14} />,      route: '',                                             badge: 'W1'  },
  { id: 3,  label: 'Role & Competency',      group: 'Intelligence',  icon: <Cpu size={14} />,             route: '/api/employer/eios/p3/role-competency' },
  { id: 4,  label: 'Talent Graph',           group: 'Intelligence',  icon: <Network size={14} />,         route: '',                                             badge: 'W2'  },
  { id: 5,  label: 'Hiring Intelligence',    group: 'Intelligence',  icon: <Brain size={14} />,           route: '',                                             badge: 'W3'  },
  { id: 6,  label: 'Recruiter Intelligence', group: 'Workforce',     icon: <Users2 size={14} />,          route: '/api/employer/eios/p6/recruiter-scorecard' },
  { id: 7,  label: '9-Box Matrix',           group: 'Workforce',     icon: <Grid3X3 size={14} />,         route: '/api/employer/eios/p7/nine-box' },
  { id: 8,  label: 'Succession Intelligence',group: 'Workforce',     icon: <GitBranch size={14} />,       route: '/api/employer/eios/p8/succession' },
  { id: 9,  label: 'Critical Roles',         group: 'Workforce',     icon: <AlertTriangle size={14} />,   route: '/api/employer/eios/p9/critical-roles' },
  { id: 10, label: 'Workforce Intelligence', group: 'Workforce',     icon: <BarChart3 size={14} />,       route: '/api/employer/eios/p10/workforce' },
  { id: 11, label: 'Assessment Campaigns',   group: 'Workforce',     icon: <Megaphone size={14} />,       route: '/api/employer/eios/p11/campaigns' },
  { id: 12, label: 'Talent Marketplace',     group: 'Workforce',     icon: <Shuffle size={14} />,         route: '/api/employer/eios/p12/marketplace' },
  { id: 13, label: 'L&D Intelligence',       group: 'Learning',      icon: <BookOpen size={14} />,        route: '/api/employer/eios/p13/learning' },
  { id: 14, label: 'Employee Lifecycle',     group: 'Learning',      icon: <RefreshCw size={14} />,       route: '/api/employer/eios/p14/lifecycle' },
  { id: 15, label: 'Network Intelligence',   group: 'Learning',      icon: <Globe size={14} />,           route: '/api/employer/eios/p15/network' },
  { id: 16, label: 'Workforce Forecasting',  group: 'Learning',      icon: <TrendingUp size={14} />,      route: '/api/employer/eios/p16/forecast' },
  { id: 17, label: 'Scenario Intelligence',  group: 'Learning',      icon: <Play size={14} />,            route: '/api/employer/eios/p17/scenarios' },
  { id: 18, label: 'Benchmark Intelligence', group: 'Advanced',      icon: <Gauge size={14} />,           route: '/api/employer/eios/p18/benchmarks' },
  { id: 19, label: 'AI Readiness',           group: 'Advanced',      icon: <Zap size={14} />,             route: '/api/employer/eios/p19/ai-readiness' },
  { id: 20, label: 'Report Factory',         group: 'Advanced',      icon: <FileText size={14} />,        route: '/api/employer/eios/p20/reports' },
  { id: 21, label: 'Executive Cockpit',      group: 'Advanced',      icon: <LayoutDashboard size={14} />, route: '/api/employer/eios/p21/executive' },
  { id: 22, label: 'Outcome Intelligence',   group: 'Governance',    icon: <Target size={14} />,          route: '/api/employer/eios/p22/outcomes' },
  { id: 23, label: 'Assessment Effectiveness',group:'Governance',    icon: <CheckCircle2 size={14} />,    route: '/api/employer/eios/p23/assessment-effectiveness' },
  { id: 24, label: 'Workforce Planning',     group: 'Governance',    icon: <PieChart size={14} />,        route: '/api/employer/eios/p24/workforce-plan' },
  { id: 25, label: 'Governance & Compliance',group: 'Governance',    icon: <Sliders size={14} />,         route: '/api/employer/eios/p25/governance' },
  { id: 26, label: 'Model Monitoring',       group: 'Governance',    icon: <Activity size={14} />,        route: '/api/employer/eios/p26/model-health' },
  { id: 27, label: 'Integration & APIs',     group: 'Enterprise',    icon: <Plug size={14} />,            route: '/api/employer/eios/p27/integrations' },
  { id: 28, label: 'Org Digital Twin',       group: 'Enterprise',    icon: <Box size={14} />,             route: '/api/employer/eios/p28/digital-twin' },
  { id: 29, label: 'Employee Workforce',     group: 'Operations',    icon: <Users size={14} />,           route: '/api/employer/eios/employees' },
];

const GROUPS = ['Foundation', 'Intelligence', 'Workforce', 'Learning', 'Advanced', 'Governance', 'Enterprise', 'Operations'];
const GROUP_COLORS: Record<string, string> = {
  Foundation: 'text-purple-400', Intelligence: 'text-blue-400', Workforce: 'text-teal-400',
  Learning: 'text-green-400', Advanced: 'text-amber-400', Governance: 'text-rose-400',
  Enterprise: 'text-indigo-400', Operations: 'text-cyan-400',
};

async function apiFetch(url: string) {
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

// EP-WORLDCLASS-98 Enh4: download a flag-gated export via authenticated fetch→blob
// (cookie auth, honours Content-Disposition filename). Surfaces 503 (flag OFF) gracefully.
async function downloadExport(url: string, fallbackName: string, onError?: (m: string) => void) {
  try {
    const r = await fetch(url, { credentials: 'include' });
    if (!r.ok) { onError?.(r.status === 503 ? 'Export disabled (flag off)' : `Export failed (${r.status})`); return; }
    const blob = await r.blob();
    const cd = r.headers.get('Content-Disposition') || '';
    const m = cd.match(/filename="?([^"]+)"?/);
    const name = m ? m[1] : fallbackName;
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(href);
  } catch (e: any) { onError?.(e?.message || 'Export error'); }
}

// EP-WORLDCLASS-98 Enh2: minimal RFC-4180 CSV parser (handles quoted fields/commas/newlines).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = []; let field = ''; let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

function ScoreBadge({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const color = score >= 75 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              : score >= 55 ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              : 'bg-rose-500/20 text-rose-300 border-rose-500/30';
  const sz = size === 'lg' ? 'text-2xl font-bold px-3 py-1' : size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm font-semibold px-2 py-1';
  return <span className={`rounded border ${color} ${sz}`}>{score}</span>;
}

function RiskBadge({ risk }: { risk: string }) {
  const map: Record<string, string> = {
    critical: 'bg-rose-500/20 text-rose-300', high: 'bg-orange-500/20 text-orange-300',
    moderate: 'bg-amber-500/20 text-amber-300', low: 'bg-emerald-500/20 text-emerald-300',
    monitoring: 'bg-blue-500/20 text-blue-300',
  };
  return <span className={`text-xs px-2 py-0.5 rounded capitalize ${map[risk] || 'bg-slate-700 text-slate-300'}`}>{risk}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-emerald-500/20 text-emerald-300', available: 'bg-emerald-500/20 text-emerald-300',
    roadmap: 'bg-blue-500/20 text-blue-300', operational: 'bg-emerald-500/20 text-emerald-300',
    monitoring: 'bg-amber-500/20 text-amber-300', no_data: 'bg-slate-600 text-slate-400',
    enabled: 'bg-emerald-500/20 text-emerald-300', ready: 'bg-blue-500/20 text-blue-300',
  };
  const normalized = status?.toLowerCase().replace(/[^a-z_]/g, '_') || 'unknown';
  return <span className={`text-xs px-2 py-0.5 rounded capitalize ${map[normalized] || 'bg-slate-700 text-slate-300'}`}>{status}</span>;
}

function Bar({ value, max = 100, color = 'bg-blue-500' }: { value: number; max?: number; color?: string }) {
  return (
    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.min(100, value / max * 100)}%` }} />
    </div>
  );
}

function KPI({ label, value, sub, delta }: { label: string; value: string | number | React.ReactNode; sub?: string; delta?: number }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className="text-xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
      {delta !== undefined && (
        <div className={`text-xs mt-1 flex items-center gap-1 ${delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
          {delta > 0 ? <ArrowUp size={10} /> : delta < 0 ? <ArrowDown size={10} /> : <Minus size={10} />}
          {Math.abs(delta)} vs industry
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-3">
      <div className="text-sm font-semibold text-white">{title}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function EmptyState({ message, icon }: { message: string; icon?: React.ReactNode }) {
  return (
    <div className="text-center py-10 text-slate-500 text-sm">
      <div className="mb-2 opacity-40">{icon || <Database size={24} className="mx-auto" />}</div>
      {message}
    </div>
  );
}

// ─── P3 ───────────────────────────────────────────────────────────────────────
function P3Panel({ data }: { data: any }) {
  const { profiles = [], summary = {} } = data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Total Roles" value={summary.totalRoles ?? 0} />
        <KPI label="Avg Readiness" value={`${summary.avgReadiness ?? 0}%`} />
        <KPI label="High Risk Roles" value={summary.highRisk ?? 0} />
        <KPI label="Behavioral Match" value={`${summary.behavioralMatch ?? 0}%`} />
      </div>
      {profiles.length === 0 ? <EmptyState message="No roles found. Post jobs to see competency profiles." icon={<Cpu size={24} className="mx-auto" />} /> : (
        <div className="space-y-3">
          {profiles.slice(0, 6).map((p: any) => (
            <div key={p.jobId} className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-semibold text-white text-sm">{p.roleName}</div>
                  <div className="text-xs text-slate-400">{p.department} · {p.seniority} · {p.candidateCount} candidates</div>
                </div>
                <ScoreBadge score={p.readinessIndex} />
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                {[['Behavioral', p.behavioralMatch], ['Functional', p.functionalMatch], ['Cognitive', p.cognitiveMatch]].map(([label, val]) => (
                  <div key={label as string}>
                    <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">{label}</span><span className="text-white">{val}%</span></div>
                    <Bar value={val as number} color="bg-blue-500" />
                  </div>
                ))}
              </div>
              {p.competencyGaps?.slice(0, 3).map((g: any) => (
                <div key={g.name} className="flex items-center justify-between text-xs py-1 border-t border-slate-700/30">
                  <span className="text-slate-300">{g.name}</span>
                  <div className="flex items-center gap-2"><RiskBadge risk={g.severity} /><span className="text-slate-400">Gap: {g.gap}</span></div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── P6 ───────────────────────────────────────────────────────────────────────
function P6Panel({ data }: { data: any }) {
  const sc = data.scorecard || {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Candidates Managed" value={sc.candidatesManaged ?? 0} />
        <KPI label="Time To Hire" value={sc.timeToHire ? `${sc.timeToHire}d` : 'N/A'} />
        <KPI label="Quality of Hire" value={`${sc.qualityOfHire ?? 0}%`} />
        <KPI label="Offer Acceptance" value={`${sc.offerAcceptanceRate ?? 0}%`} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <KPI label="Active Jobs" value={sc.activeJobs ?? 0} />
        <KPI label="Pipeline Conversion" value={`${sc.pipelineConversionRate ?? 0}%`} />
        <KPI label="Interview Conversion" value={`${sc.interviewConversionRate ?? 0}%`} />
      </div>
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
        <SectionHeader title="Source Effectiveness" />
        {Object.entries(sc.sourceEffectiveness || {}).map(([src, pct]: any) => (
          <div key={src} className="mb-2">
            <div className="flex justify-between text-xs mb-1 capitalize"><span className="text-slate-400">{src}</span><span className="text-white">{pct}%</span></div>
            <Bar value={pct} color={src === 'referral' ? 'bg-emerald-500' : src === 'direct' ? 'bg-blue-500' : 'bg-purple-500'} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── P7 ───────────────────────────────────────────────────────────────────────
function P7Panel({ data }: { data: any }) {
  const { matrix = [], summary = {}, classifications = {}, talent_pools = {} } = data;
  const CLASS_COLORS: Record<string, string> = {
    'Future Leader': 'bg-emerald-500', 'High Potential': 'bg-blue-500', 'Critical Talent': 'bg-purple-500',
    'Emerging Talent': 'bg-teal-500', 'Effective Performer': 'bg-sky-500', 'Consistent Performer': 'bg-slate-500',
    'At-Risk Talent': 'bg-rose-500', 'Development Candidate': 'bg-amber-500',
  };
  const POOL_COLORS: Record<string, string> = {
    high_potential: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300',
    high_performer: 'border-blue-500/30 bg-blue-500/5 text-blue-300',
    future_leader:  'border-purple-500/30 bg-purple-500/5 text-purple-300',
    at_risk:        'border-rose-500/30 bg-rose-500/5 text-rose-300',
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Total People" value={summary.totalPeople ?? 0} />
        <KPI label="Future Leaders" value={summary.futureLeaders ?? 0} />
        <KPI label="High Potentials" value={summary.highPotentials ?? 0} />
        <KPI label="At-Risk" value={summary.atRisk ?? 0} />
      </div>
      {Object.keys(talent_pools).length > 0 && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
          <SectionHeader title="Talent Pools" sub="4 pools — High Potential · High Performer · Future Leader · At-Risk" />
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(talent_pools).map(([key, pool]: any) => (
              <div key={key} className={`border rounded-lg p-3 ${POOL_COLORS[key] || 'border-slate-600/40 bg-slate-700/30 text-slate-300'}`}>
                <div className="flex justify-between items-start mb-1">
                  <div className="text-xs font-semibold">{pool.label}</div>
                  <div className="text-xl font-bold">{pool.count}</div>
                </div>
                <div className="text-xs opacity-70 leading-tight">{pool.description}</div>
                {pool.members?.length > 0 && (
                  <div className="mt-2 space-y-0.5">
                    {pool.members.slice(0, 2).map((m: any) => (
                      <div key={m.id} className="text-xs opacity-80 flex justify-between">
                        <span>{m.name}</span><span>{m.score}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
        <SectionHeader title="Performance × Potential Matrix" />
        <div className="grid grid-cols-3 gap-1.5 mb-4 text-center text-xs">
          {['At-Risk Talent', 'Emerging Talent', 'Future Leader',
            'Development Candidate', 'Effective Performer', 'High Potential',
            'Consistent Performer', 'Core Contributor', 'Critical Talent'].map((cls) => (
            <div key={cls} className="bg-slate-700/50 rounded p-2 border border-slate-600/40">
              <div className={`w-2 h-2 rounded-full ${CLASS_COLORS[cls] || 'bg-slate-500'} mx-auto mb-1`} />
              <div className="text-slate-300 leading-tight">{cls}</div>
              <div className="text-white font-bold mt-0.5">{classifications[cls] ?? 0}</div>
            </div>
          ))}
        </div>
        <div className="text-xs text-slate-500 flex justify-between"><span>← Low Performance</span><span>High Performance →</span></div>
      </div>
      {data.behavioralEnrichment && (
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-300 flex items-center gap-2">
          <Activity size={12} /> Behavioral spine enriched from WCL-0 intelligence ({data.behavioralEnrichment.enriched} / {data.behavioralEnrichment.total} candidates)
        </div>
      )}
      {matrix.slice(0, 8).map((m: any) => (
        <div key={m.candidateId} className="flex items-center justify-between bg-slate-800/40 border border-slate-700/30 rounded p-3 text-sm">
          <div><div className="text-white font-medium">{m.name}</div><div className="text-xs text-slate-400">{m.department}</div></div>
          <div className="flex items-center gap-3">
            <div className="text-center"><div className="text-xs text-slate-400">Perf</div><ScoreBadge score={m.performanceScore} size="sm" /></div>
            <div className="text-center"><div className="text-xs text-slate-400">Pot</div><ScoreBadge score={m.potentialScore} size="sm" /></div>
            {m.behavioralScore !== undefined && <div className="text-center"><div className="text-xs text-slate-400">Behav</div><ScoreBadge score={m.behavioralScore} size="sm" /></div>}
            <span className={`text-xs px-2 py-0.5 rounded-full text-white ${CLASS_COLORS[m.classification] || 'bg-slate-600'}`}>{m.classification}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── P8 ───────────────────────────────────────────────────────────────────────
function P8Panel({ data }: { data: any }) {
  const { summary = {}, pipeline = [], succession_timeline = [] } = data;
  const TIMELINE_COLORS: Record<string, string> = {
    emerald: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300',
    blue:    'border-blue-500/30 bg-blue-500/5 text-blue-300',
    amber:   'border-amber-500/30 bg-amber-500/5 text-amber-300',
    slate:   'border-slate-500/30 bg-slate-700/30 text-slate-300',
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Ready Now" value={summary.readyNow ?? 0} sub="Succession-ready" />
        <KPI label="Ready 6 Months" value={summary.ready6Months ?? 0} />
        <KPI label="Ready 12 Months" value={summary.ready12Months ?? 0} />
        <KPI label="Bench Strength" value={`${summary.benchStrength ?? 0}%`} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <KPI label="Leadership Pipeline" value={summary.leadershipPipeline ?? 0} />
        <KPI label="Critical Role Coverage" value={`${summary.criticalRoleCoverage ?? 0}%`} />
        <KPI label="Successor Risk" value={<RiskBadge risk={summary.successorRisk || 'low'} />} />
      </div>
      {succession_timeline.length > 0 && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
          <SectionHeader title="Succession Timeline" sub="Ready Now · 6M · 12M · 24M" />
          <div className="grid grid-cols-2 gap-3">
            {succession_timeline.map((t: any) => (
              <div key={t.stage} className={`border rounded-lg p-3 ${TIMELINE_COLORS[t.color] || TIMELINE_COLORS.slate}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xs font-semibold">{t.stage}</div>
                    <div className="text-xs opacity-60 mt-0.5">{t.horizon}</div>
                  </div>
                  <div className="text-2xl font-bold">{t.count}</div>
                </div>
                <div className="text-xs opacity-60 mt-1 leading-tight">{t.criteria}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {pipeline.slice(0, 8).map((p: any) => (
        <div key={p.candidateId} className="flex items-center justify-between bg-slate-800/40 border border-slate-700/30 rounded p-3 text-sm">
          <div><div className="text-white font-medium">{p.name}</div><div className="text-xs text-slate-400">{p.role} · {p.department}</div></div>
          <div className="flex items-center gap-2">
            {p.behavioralScore !== undefined && <div className="text-center"><div className="text-xs text-slate-400">Behav</div><ScoreBadge score={p.behavioralScore} size="sm" /></div>}
            <ScoreBadge score={p.readinessScore} size="sm" />
            <span className={`text-xs px-2 py-0.5 rounded ${p.successionStage === 'ready_now' ? 'bg-emerald-500/20 text-emerald-300' : p.successionStage === 'ready_6m' ? 'bg-blue-500/20 text-blue-300' : p.successionStage === 'ready_12m' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-600 text-slate-300'}`}>
              {p.successionStage.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── P9 ───────────────────────────────────────────────────────────────────────
function P9Panel({ data }: { data: any }) {
  const { roles = [], summary = {} } = data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Total Roles" value={summary.totalRoles ?? 0} />
        <KPI label="Critical Vacancy" value={summary.criticalVacancyRisk ?? 0} sub="No candidates" />
        <KPI label="High Vacancy Risk" value={summary.highVacancyRisk ?? 0} />
        <KPI label="Single Point Dependencies" value={summary.singlePointDependencies ?? 0} />
      </div>
      {roles.slice(0, 8).map((r: any) => (
        <div key={r.jobId} className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
          <div className="flex justify-between mb-2">
            <div><div className="font-semibold text-white text-sm">{r.roleName}</div><div className="text-xs text-slate-400">{r.department}</div></div>
            <RiskBadge risk={r.vacancyRisk} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div><span className="text-slate-400">Dependency: </span><RiskBadge risk={r.dependencyRisk} /></div>
            <div><span className="text-slate-400">Capability Exposure: </span><span className="text-white">{r.capabilityExposure}%</span></div>
            <div><span className="text-slate-400">Time to Replace: </span><span className="text-white">{r.timeToReplace}d</span></div>
            <div><span className="text-slate-400">SPDR: </span><span className={r.singlePointDependency ? 'text-rose-400' : 'text-emerald-400'}>{r.singlePointDependency ? 'Yes' : 'No'}</span></div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── P10 ──────────────────────────────────────────────────────────────────────
function P10Panel({ data }: { data: any }) {
  const { heatmap = [], orgSummary = {} } = data;
  const DIMS = [
    { key: 'capabilityScore', label: 'Capability', color: 'bg-blue-500' },
    { key: 'leadershipScore', label: 'Leadership', color: 'bg-purple-500' },
    { key: 'innovationScore', label: 'Innovation', color: 'bg-teal-500' },
    { key: 'executionScore',  label: 'Execution',  color: 'bg-amber-500' },
    { key: 'aiReadiness',     label: 'AI Ready',   color: 'bg-rose-500' },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Departments" value={orgSummary.totalDepartments ?? 0} />
        <KPI label="Total People" value={orgSummary.totalPeople ?? 0} />
        <KPI label="Workforce Health" value={`${orgSummary.workforceHealth ?? 0}%`} />
        <KPI label="AI Readiness" value={`${orgSummary.aiReadiness ?? 0}%`} />
      </div>
      {heatmap.length === 0 ? <EmptyState message="No department data. Assign candidates to jobs." /> : (
        <div className="space-y-3">
          {heatmap.map((h: any) => (
            <div key={h.department} className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
              <div className="flex justify-between mb-3">
                <div className="font-semibold text-white text-sm">{h.department}</div>
                <div className="text-xs text-slate-400">{h.headcount} people</div>
              </div>
              <div className="space-y-2">
                {DIMS.map(d => (
                  <div key={d.key}>
                    <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">{d.label}</span><span className="text-white">{(h as any)[d.key]}%</span></div>
                    <Bar value={(h as any)[d.key]} color={d.color} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── P11 ──────────────────────────────────────────────────────────────────────
function P11Panel({ data }: { data: any }) {
  const { summary = {}, jobCoverage = [] } = data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Total Candidates" value={summary.totalCandidates ?? 0} />
        <KPI label="Assessed" value={summary.assessed ?? 0} />
        <KPI label="Pending" value={summary.pending ?? 0} />
        <KPI label="Coverage" value={`${summary.coverage ?? 0}%`} />
      </div>
      {jobCoverage.map((j: any) => (
        <div key={j.jobId} className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3">
          <div className="flex justify-between mb-2">
            <div className="text-sm text-white">{j.roleName}<span className="text-slate-400 text-xs ml-2">{j.department}</span></div>
            <span className={`text-xs px-2 py-0.5 rounded ${j.status === 'complete' ? 'bg-emerald-500/20 text-emerald-300' : j.status === 'in_progress' ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-600 text-slate-400'}`}>{j.status}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-400 mb-1"><span>{j.assessed}/{j.totalCandidates} assessed</span><span>{j.coverageRate}%</span></div>
          <Bar value={j.coverageRate} color="bg-teal-500" />
        </div>
      ))}
    </div>
  );
}

// ─── P12 ──────────────────────────────────────────────────────────────────────
function P12Panel({ data }: { data: any }) {
  const { marketplace = [], summary = {} } = data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Opportunities" value={summary.totalOpportunities ?? 0} />
        <KPI label="Internal Matches" value={summary.internalMatchAvailable ?? 0} />
        <KPI label="Promotion Ready" value={summary.promotionReady ?? 0} />
        <KPI label="Reskilling Ready" value={summary.reskillingReady ?? 0} />
      </div>
      {marketplace.slice(0, 5).map((m: any) => (
        <div key={m.jobId} className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
          <div className="font-semibold text-white text-sm mb-2">{m.roleName} <span className="text-slate-400 text-xs">{m.department}</span></div>
          <div className="flex gap-3 text-xs mb-3">
            <span className="bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded">Promotion: {m.promotionMatch}</span>
            <span className="bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded">Career Path: {m.careerPathMatch}</span>
            <span className="bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded">Reskilling: {m.reskillingMatch}</span>
          </div>
          {m.internalMatches?.slice(0, 2).map((match: any) => (
            <div key={match.candidateId} className="flex items-center justify-between text-xs py-1.5 border-t border-slate-700/30">
              <div className="text-slate-300">{match.name}<span className="text-slate-500 ml-2">{match.currentRole}</span></div>
              <ScoreBadge score={match.fitScore} size="sm" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── P13: L&D Intelligence ────────────────────────────────────────────────────
function P13Panel({ data }: { data: any }) {
  const di = data.developmentIntelligence || {};
  const hasData = data.dataSource !== 'no_frp_data' && data.learningEffectiveness !== null;
  const totalLearners = (di.highLearners || 0) + (di.midLearners || 0) + (di.atRiskLearners || 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Learning Effectiveness" value={hasData ? `${data.learningEffectiveness}%` : '—'} sub={hasData ? 'FRI-derived' : 'Awaiting FRP data'} />
        <KPI label="Skill Growth Velocity" value={data.skillGrowthVelocity ?? '—'} />
        <KPI label="Development Readiness" value={data.developmentReadiness ?? 0} sub="EI score ≥65" />
        <KPI label="FRP Coverage" value={`${data.coverage ?? 0}%`} sub="Candidates profiled" />
      </div>
      {hasData && (
        <div className="grid grid-cols-2 gap-3">
          <KPI label="Learning ROI Index" value={`${data.learningROI ?? 0}%`} />
          <KPI label="Capability Improvement" value={`+${data.capabilityImprovement ?? 0} pts`} />
        </div>
      )}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
        <SectionHeader title="Learner Distribution" sub="Based on Future Readiness Index (FRI)" />
        {!hasData ? (
          <EmptyState message="Future Readiness Profile data not yet available for your candidates." icon={<BookOpen size={24} className="mx-auto" />} />
        ) : (
          <div className="space-y-3">
            {[
              { label: 'High Learners (FRI ≥70)', count: di.highLearners || 0, color: 'bg-emerald-500', textColor: 'text-emerald-300' },
              { label: 'Mid Learners (FRI 50–69)', count: di.midLearners || 0, color: 'bg-amber-500', textColor: 'text-amber-300' },
              { label: 'At-Risk Learners (FRI <50)', count: di.atRiskLearners || 0, color: 'bg-rose-500', textColor: 'text-rose-300' },
            ].map(({ label, count, color, textColor }) => {
              const pct = totalLearners > 0 ? Math.round(count / totalLearners * 100) : 0;
              return (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className={textColor}>{label}</span>
                    <span className="text-white">{count} <span className="text-slate-500">({pct}%)</span></span>
                  </div>
                  <Bar value={pct} color={color} />
                </div>
              );
            })}
          </div>
        )}
      </div>
      {data.wcl0Enriched && (
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-300 flex items-center gap-2">
          <Activity size={12} /> Behavioural intelligence enriched from WCL-0 ({data.wcl0Coverage ?? 0}% candidates with behavioural profiles)
        </div>
      )}
    </div>
  );
}

// ─── P14: Employee Lifecycle ──────────────────────────────────────────────────
function P14Panel({ data }: { data: any }) {
  const stages = data.stageCounts || {};
  const li = data.lifecycleIntelligence || {};
  const STAGE_COLORS: Record<string, string> = {
    hire: 'bg-emerald-500', onboard: 'bg-blue-500', develop: 'bg-teal-500',
    promote: 'bg-purple-500', retain: 'bg-amber-500', exit: 'bg-rose-500',
  };
  const STAGE_LABELS: Record<string, string> = {
    hire: 'Hired', onboard: 'Onboarding', develop: 'Developing', promote: 'Promotion', retain: 'Retention', exit: 'Exited',
  };
  const total = Object.values(stages).reduce((s: number, v: any) => s + (Number(v) || 0), 0) as number;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Total in Pipeline" value={li.totalCandidates ?? 0} />
        <KPI label="Hired" value={li.hired ?? 0} />
        <KPI label="Conversion Rate" value={`${li.conversionRate ?? 0}%`} />
        <KPI label="Onboarding Readiness" value={data.onboardingReadiness ?? '—'} />
      </div>
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
        <SectionHeader title="Lifecycle Stage Distribution" />
        <div className="space-y-2.5">
          {Object.entries(stages).map(([stage, count]: any) => {
            const pct = total > 0 ? Math.round(count / total * 100) : 0;
            return (
              <div key={stage}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300 capitalize">{STAGE_LABELS[stage] || stage}</span>
                  <span className="text-white">{count} <span className="text-slate-500">({pct}%)</span></span>
                </div>
                <Bar value={pct} color={STAGE_COLORS[stage] || 'bg-slate-500'} />
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3">
          <div className="text-xs text-slate-400 mb-1">Promotion Ready</div>
          <div className="text-xl font-bold text-purple-300">{data.promotionReadiness ?? 0}</div>
          <div className="text-xs text-slate-500">EI score ≥75</div>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3">
          <div className="text-xs text-slate-400 mb-1">Retention Risk</div>
          <div className="text-xl font-bold text-rose-300">{data.retentionRisk ?? 0}</div>
          <div className="text-xs text-slate-500">EI score &lt;50</div>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3">
          <div className="text-xs text-slate-400 mb-1">Exit Risk</div>
          <div className="text-xl font-bold text-amber-300">{data.exitRisk ?? 0}</div>
          <div className="text-xs text-slate-500">High talent, rejected</div>
        </div>
      </div>
    </div>
  );
}

// ─── P15: Network Intelligence ────────────────────────────────────────────────
function P15Panel({ data }: { data: any }) {
  const connectors = data.organizationalConnectors || [];
  const nodesByType = data.nodesByType || {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Network Nodes" value={data.nodeCount ?? 0} />
        <KPI label="Connections" value={data.edgeCount ?? 0} />
        <KPI label="Network Density" value={`${data.networkDensity ?? 0}%`} />
        <KPI label="Hidden Leaders" value={data.hiddenLeaders ?? 0} sub="High-degree nodes" />
      </div>
      {data.nodeCount === 0 ? (
        <EmptyState message="No Talent Intelligence Graph data yet. Build your TIG network to unlock org network analysis." icon={<Globe size={24} className="mx-auto" />} />
      ) : (
        <>
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
            <SectionHeader title="Node Type Distribution" />
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(nodesByType).map(([type, count]: any) => (
                <div key={type} className="text-center bg-slate-700/40 rounded p-2">
                  <div className="text-xs text-slate-400 capitalize mb-1">{type}</div>
                  <div className="text-white font-bold">{count}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
            <SectionHeader title="Top Org Connectors" sub="Highest-degree nodes by connection count" />
            {connectors.length === 0 ? (
              <EmptyState message="No edge data available." />
            ) : connectors.map((c: any, i: number) => (
              <div key={c.nodeId} className="flex items-center justify-between py-2 border-b border-slate-700/30 last:border-0 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-blue-500/20 text-blue-300 rounded-full text-xs flex items-center justify-center font-bold">{i + 1}</div>
                  <div><div className="text-white">{c.name}</div><div className="text-xs text-slate-400 capitalize">{c.type}</div></div>
                </div>
                <div className="text-xs text-slate-300">{c.degree} connections</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-1">Knowledge Risk</div>
              <RiskBadge risk={data.knowledgeRisk || 'monitoring'} />
            </div>
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-1">Data Source</div>
              <div className="text-xs text-white">{data.dataSource || 'tig_nodes'}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── P16: Workforce Forecasting ───────────────────────────────────────────────
function P16Panel({ data }: { data: any }) {
  const cf = data.capabilityForecast || {};
  const hf = data.hiringForecast || {};
  const lf = data.leadershipForecast || {};
  const periods = [['30d', cf['30d']], ['60d', cf['60d']], ['90d', cf['90d']]];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Capability Supply" value={data.capabilitySupply ?? 0} sub="Match score ≥70" />
        <KPI label="Capability Demand" value={data.capabilityDemand ?? 0} sub="Open roles × 2" />
        <KPI label="Attrition Forecast" value={data.attritionForecast ?? 0} sub="12% annual" />
        <KPI label="Hiring Demand" value={data.hiringDemand ?? 0} sub="Open roles" />
      </div>
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
        <SectionHeader title="Capability Supply vs Demand Forecast" />
        <div className="space-y-3">
          {periods.map(([label, period]: any) => period && (
            <div key={label}>
              <div className="flex justify-between text-xs mb-1 text-slate-400"><span className="font-medium text-white">{label} horizon</span><span>Supply {period.supply} · Demand {period.demand}</span></div>
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <div className="text-xs text-slate-500 mb-0.5">Supply</div>
                  <Bar value={period.supply} max={Math.max(1, period.supply, period.demand)} color="bg-emerald-500" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-0.5">Demand</div>
                  <Bar value={period.demand} max={Math.max(1, period.supply, period.demand)} color="bg-rose-500" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
          <SectionHeader title="Hiring Forecast" />
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">Projected Hires</span><span className="text-white">{hf.projectedHires ?? 0}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Avg Pipeline Size</span><span className="text-white">{hf.avgPipelineSize ?? 0}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Fill Rate</span><span className="text-white">{hf.fillRate ?? 0}%</span></div>
          </div>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
          <SectionHeader title="Leadership Forecast" />
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">6M Ready</span><span className="text-white">{lf['6m'] ?? 0}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">12M Ready</span><span className="text-white">{lf['12m'] ?? 0}</span></div>
          </div>
        </div>
      </div>
      {data.frpEnriched && (
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-300 flex items-center gap-2">
          <Zap size={12} /> Forecast enriched with Future Readiness Platform projections
        </div>
      )}
    </div>
  );
}

// ─── P18: Benchmark Intelligence ──────────────────────────────────────────────
function P18Panel({ data }: { data: any }) {
  const { kAnonymity = {}, yourOrg = {}, vsIndustry, industry, suppressionNote } = data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Your Avg EI Score" value={yourOrg.avgEIScore ?? 0} delta={vsIndustry?.eiDelta} />
        <KPI label="Your Avg Match Score" value={yourOrg.avgMatchScore ?? 0} delta={vsIndustry?.matchDelta} />
        <KPI label="Candidate Count" value={yourOrg.candidateCount ?? 0} />
        <KPI label="k-Anonymity" value={kAnonymity.enforced ? `k=${kAnonymity.kMin}` : 'Off'} sub={kAnonymity.suppressed ? 'Suppressed' : `Pool: ${kAnonymity.poolSize} orgs`} />
      </div>
      {suppressionNote ? (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-sm text-amber-300 flex items-center gap-3">
          <AlertCircle size={16} /> {suppressionNote}
        </div>
      ) : industry ? (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
          <SectionHeader title="Your Organisation vs Industry Benchmarks" sub={industry.label} />
          <div className="space-y-4">
            {[
              { label: 'EI Score', yours: yourOrg.avgEIScore, industry: industry.avgEIScore, delta: vsIndustry?.eiDelta },
              { label: 'Match Score', yours: yourOrg.avgMatchScore, industry: industry.avgMatchScore, delta: vsIndustry?.matchDelta },
            ].map(({ label, yours, industry: ind, delta }) => (
              <div key={label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">{label}</span>
                  <span className={`font-medium ${(delta ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{(delta ?? 0) >= 0 ? '+' : ''}{delta ?? 0} vs industry avg {ind}</span>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <div><div className="text-xs text-slate-500 mb-0.5">Your Org</div><Bar value={yours ?? 0} color={(delta ?? 0) >= 0 ? 'bg-emerald-500' : 'bg-rose-500'} /></div>
                  <div><div className="text-xs text-slate-500 mb-0.5">Industry Avg</div><Bar value={ind ?? 0} color="bg-slate-500" /></div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-700/40 grid grid-cols-2 gap-3 text-xs">
            <div className="text-slate-400">Leadership Readiness Index: <span className="text-white">{data.leadership?.readinessIndex ?? 0}</span></div>
            <div className="text-slate-400">Top Performer Threshold: <span className="text-white">≥{industry.topPerformerThreshold}</span></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── P19: AI Readiness ────────────────────────────────────────────────────────
function P19Panel({ data }: { data: any }) {
  const deptReadiness = data.deptReadiness || [];
  const classColor = (c: string) => c === 'AI Ready' ? 'text-emerald-300 bg-emerald-500/20' : c === 'AI Emerging' ? 'text-amber-300 bg-amber-500/20' : 'text-rose-300 bg-rose-500/20';
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="AI Readiness Index" value={data.aiReadinessIndex ?? 0} />
        <KPI label="Digital Readiness" value={data.digitalReadiness ?? 0} />
        <KPI label="Future Readiness" value={data.futureReadinessIndex ?? 0} />
        <KPI label="Org Classification" value={<span className={`text-sm px-2 py-0.5 rounded ${classColor(data.orgClassification)}`}>{data.orgClassification || '—'}</span>} />
      </div>
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
        <SectionHeader title="AI Readiness Distribution" />
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: 'AI Ready', count: data.aiReady ?? 0, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
            { label: 'AI Emerging', count: data.aiEmerging ?? 0, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
            { label: 'AI Risk', count: data.aiRisk ?? 0, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' },
          ].map(({ label, count, color, bg }) => (
            <div key={label} className={`border rounded-lg p-3 ${bg}`}>
              <div className={`text-2xl font-bold ${color}`}>{count}</div>
              <div className="text-xs text-slate-400 mt-1">{label}</div>
            </div>
          ))}
        </div>
      </div>
      {deptReadiness.length > 0 && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
          <SectionHeader title="Department AI Readiness" />
          <div className="space-y-2">
            {deptReadiness.map((d: any) => (
              <div key={d.department} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">{d.department}</span>
                    <span className="text-white">{d.aiReadiness}% · {d.headcount} people</span>
                  </div>
                  <Bar value={d.aiReadiness} color={d.aiReadiness >= 70 ? 'bg-emerald-500' : d.aiReadiness >= 50 ? 'bg-amber-500' : 'bg-rose-500'} />
                </div>
                <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${classColor(d.classification)}`}>{d.classification}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <KPI label="FRP Data Coverage" value={`${data.frpDataCoverage ?? 0}%`} sub="Candidates with Future Readiness Profile" />
    </div>
  );
}

// ─── P20: Report Factory ──────────────────────────────────────────────────────
function P20Panel({ data }: { data: any }) {
  const [generating, setGenerating] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, any>>({});
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const da = data.dataAvailability || {};

  const generate = async (typeId: string) => {
    setGenerating(typeId);
    try {
      const r = await fetch('/api/employer/eios/p20/generate', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportType: typeId }),
      });
      const d = await r.json();
      setResults(prev => ({ ...prev, [typeId]: d.report }));
    } catch {}
    setGenerating(null);
  };

  const ICONS: Record<string, React.ReactNode> = {
    hiring: <Users size={14} />, talent: <Star size={14} />, competency: <Cpu size={14} />,
    capability: <BarChart3 size={14} />, leadership: <GitBranch size={14} />, succession: <GitMerge size={14} />,
    learning: <BookOpen size={14} />, workforce: <Building2 size={14} />, recruiter: <Briefcase size={14} />, executive: <Award size={14} />,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KPI label="Candidates" value={da.candidates ?? 0} />
        <KPI label="Open Roles" value={da.jobs ?? 0} />
        <KPI label="Assessments" value={da.assessments ?? 0} />
      </div>
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3 text-xs text-slate-400 flex gap-2">
        <FileText size={12} className="shrink-0 mt-0.5" />
        <span>Reports compose from all 28 intelligence pillars. Generated reports are persisted to the Report Factory archive.</span>
      </div>
      {data.worldClass && (
        <div className="bg-slate-800/60 border border-amber-500/30 rounded-lg p-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-slate-300 flex items-center gap-1.5"><Download size={12} /> Export executive report:</span>
            <button onClick={() => downloadExport('/api/employer/eios/p20/export.pdf?reportType=executive', 'eios_executive_report.pdf', setExportMsg)} className="bg-rose-600/80 hover:bg-rose-600 text-white text-xs px-3 py-1.5 rounded flex items-center gap-1.5"><FileText size={11} /> PDF</button>
            <button onClick={() => downloadExport('/api/employer/eios/p20/export.csv', 'eios_report.csv', setExportMsg)} className="bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs px-3 py-1.5 rounded flex items-center gap-1.5"><Database size={11} /> CSV</button>
          </div>
          {exportMsg && <div className="text-xs text-amber-300 mt-2">{exportMsg}</div>}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3">
        {(data.reportTypes || []).map((rt: any) => {
          const res = results[rt.id];
          const isGen = generating === rt.id;
          return (
            <div key={rt.id} className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="text-blue-400 mt-0.5">{ICONS[rt.id] || <FileText size={14} />}</div>
                  <div>
                    <div className="text-sm font-semibold text-white">{rt.label}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{rt.description}</div>
                    <div className="text-xs text-slate-500 mt-1">For: {rt.readyFor}</div>
                  </div>
                </div>
                <button onClick={() => generate(rt.id)} disabled={!!generating} className="shrink-0 bg-blue-600/80 hover:bg-blue-600 disabled:opacity-40 text-white text-xs px-3 py-1.5 rounded flex items-center gap-1.5">
                  {isGen ? <Loader2 size={11} className="animate-spin" /> : <FileText size={11} />}
                  {isGen ? 'Generating...' : 'Generate'}
                </button>
              </div>
              {res && (
                <div className="mt-3 pt-3 border-t border-slate-700/40">
                  <div className="flex gap-4 text-xs mb-2">
                    <span className="text-slate-400">Candidates: <span className="text-white">{res.scores?.candidateCount ?? 0}</span></span>
                    <span className="text-slate-400">Avg Fit: <span className="text-white">{res.scores?.avgFitScore ?? 0}%</span></span>
                    <span className="text-slate-400">Confidence: <span className="text-white capitalize">{res.confidence?.replace(/_/g, ' ')}</span></span>
                  </div>
                  <div className="space-y-1">
                    {(res.insights || []).map((insight: string, i: number) => (
                      <div key={i} className="text-xs text-slate-300 flex items-start gap-1.5"><CheckCircle2 size={10} className="text-emerald-400 mt-0.5 shrink-0" />{insight}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── P21: Executive Cockpit ───────────────────────────────────────────────────
// Helper: extract value from 6-lens metric or plain number
function lensVal(metric: any): number {
  if (metric == null) return 0;
  if (typeof metric === 'object' && metric.current_state) return metric.current_state.value ?? 0;
  return Number(metric) || 0;
}
function LensCard({ metricKey, metric, label }: { metricKey: string; metric: any; label: string }) {
  // No lens reading yet → show an honest "No data yet" state, never a fabricated 0 (null ≠ 0).
  if (!metric || typeof metric !== 'object' || !metric.current_state) {
    const raw = Number(metric);
    const hasReading = metric != null && metric !== '' && Number.isFinite(raw);
    return (
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
        <div className="text-xs font-medium text-slate-300 mb-2">{label}</div>
        {hasReading ? (
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-white tabular-nums">{raw}</span>
            <span className="text-xs text-slate-500">/ 100</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-slate-500"><Minus size={14} /><span className="text-sm">No data yet</span></div>
        )}
      </div>
    );
  }
  const v = metric.current_state.value ?? 0;
  const trend = metric.trend?.direction ?? 'stable';
  const risk  = metric.risk?.level ?? 'low';
  const trendColor = trend === 'improving' ? 'text-emerald-400' : trend === 'declining' ? 'text-rose-400' : 'text-slate-400';
  const trendArrow = trend === 'improving' ? '↑' : trend === 'declining' ? '↓' : '→';
  const scoreText  = v >= 75 ? 'text-emerald-300' : v >= 55 ? 'text-amber-300' : 'text-rose-300';
  const barColor   = v >= 75 ? 'bg-emerald-500'   : v >= 55 ? 'bg-amber-500'   : 'bg-rose-500';
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 hover:border-slate-600/60 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-300">{label}</span>
        <RiskBadge risk={risk} />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-3xl font-bold tabular-nums ${scoreText}`}>{v}</span>
        <span className="text-xs text-slate-500">/ 100</span>
        <span className={`ml-auto text-xs flex items-center gap-0.5 ${trendColor}`}>{trendArrow} {trend}</span>
      </div>
      <div className="mt-2.5"><Bar value={v} color={barColor} /></div>
      {metric.forecast?.value_3m != null && (
        <div className="text-xs text-slate-500 mt-2">Forecast 3m: <span className="text-slate-300">{metric.forecast.value_3m}</span></div>
      )}
      {metric.intervention?.action && (
        <div className="text-xs text-slate-400 mt-2 leading-tight flex items-start gap-1 truncate" title={metric.intervention.action}>
          <ChevronRight size={11} className="mt-0.5 shrink-0 text-blue-400" /><span className="truncate">{metric.intervention.action}</span>
        </div>
      )}
    </div>
  );
}

// EP-WORLDCLASS-98 Enh3: longitudinal trend/forecast from persisted snapshots.
// Coverage (data availability) and Confidence (trustworthiness) shown as SEPARATE axes.
const LONG_METRIC_LABELS: Record<string, string> = {
  talentHealth: 'Talent Health', capabilityHealth: 'Capability Health', leadershipHealth: 'Leadership Health',
  workforceHealth: 'Workforce Health', successionHealth: 'Succession Health', attritionRisk: 'Attrition Risk',
};
function LongitudinalPanel({ longitudinal }: { longitudinal: any }) {
  const metrics = longitudinal.metrics || {};
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
      <SectionHeader title="Longitudinal Intelligence" sub="Trend & forecast from persisted daily snapshots" />
      <div className="bg-blue-500/5 border border-blue-500/20 rounded px-3 py-2 text-xs text-blue-300 mb-3">
        {longitudinal.mode === 'real_history' ? 'Real history' : longitudinal.mode} · depth {longitudinal.snapshotDepth ?? 0} snapshots. Coverage (data availability) and Confidence (trustworthiness) are reported separately — never composited. No synthetic deltas.
      </div>
      {longitudinal.captureNote && <div className="text-xs text-amber-300 mb-3 flex items-center gap-1.5"><Clock size={11} /> {longitudinal.captureNote}</div>}
      <div className="space-y-2">
        {Object.entries(metrics).map(([key, m]: any) => {
          const dir = m.trend?.direction ?? 'insufficient_history';
          const tColor = dir === 'improving' ? 'text-emerald-400' : dir === 'declining' ? 'text-rose-400' : 'text-slate-400';
          const arrow = dir === 'improving' ? '↑' : dir === 'declining' ? '↓' : dir === 'stable' ? '→' : '•';
          return (
            <div key={key} className="bg-slate-700/30 rounded p-3">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-sm text-white">{LONG_METRIC_LABELS[key] || key}</span>
                <span className={`text-xs ${tColor}`}>{arrow} {String(dir).replace(/_/g, ' ')}{m.trend?.delta_pts != null ? ` (${m.trend.delta_pts > 0 ? '+' : ''}${m.trend.delta_pts} pts/mo)` : ''}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div className="text-slate-400">Forecast 3m: <span className="text-white">{m.forecast?.value_3m ?? '—'}</span></div>
                <div className="text-slate-400">Forecast 6m: <span className="text-white">{m.forecast?.value_6m ?? '—'}</span></div>
                <div className="text-slate-500">Coverage: <span className="text-slate-300">{m.coverage?.snapshotCount ?? 0} snaps · {m.coverage?.daysSpan ?? 0}d</span></div>
                <div className="text-slate-500">Confidence: <span className="text-slate-300 capitalize">{String(m.confidence?.grade ?? 'baseline_only').replace(/_/g, ' ')}</span></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const COCKPIT_STATS: { key: string; label: string; icon: React.ComponentType<any>; accent: string; glow: string }[] = [
  { key: 'totalCandidates',  label: 'Candidates',  icon: Users,       accent: 'text-sky-300',     glow: 'from-sky-500/15' },
  { key: 'totalJobs',        label: 'Open Roles',  icon: Briefcase,   accent: 'text-violet-300',  glow: 'from-violet-500/15' },
  { key: 'totalAssessments', label: 'Assessments', icon: CheckSquare, accent: 'text-amber-300',   glow: 'from-amber-500/15' },
  { key: 'totalNodes',       label: 'TIG Nodes',   icon: Network,     accent: 'text-emerald-300', glow: 'from-emerald-500/15' },
  { key: 'hired',            label: 'Hired',       icon: Award,       accent: 'text-rose-300',    glow: 'from-rose-500/15' },
];
const VIEW_META: Record<string, { label: string; icon: React.ComponentType<any>; focus: string }> = {
  ceo:  { label: 'CEO',  icon: Building2, focus: 'Enterprise health' },
  chro: { label: 'CHRO', icon: Users,     focus: 'Talent & succession' },
  coo:  { label: 'COO',  icon: Activity,  focus: 'Operational capacity' },
  clo:  { label: 'CLO',  icon: BookOpen,  focus: 'Learning & development' },
};
function P21Panel({ data, onRefresh }: { data: any; onRefresh?: () => void }) {
  const [view, setView] = useState<'ceo' | 'chro' | 'coo' | 'clo'>('ceo');
  const summary = data.summary || {};
  const views: Record<string, any> = { ceo: data.ceoView, chro: data.chroView, coo: data.cooView, clo: data.cloView };
  const vd = views[view] || {};
  const TABS = [{ id: 'ceo', label: 'CEO' }, { id: 'chro', label: 'CHRO' }, { id: 'coo', label: 'COO' }, { id: 'clo', label: 'CLO' }];
  const lensFramework = data.lensFramework;
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [captureMsg, setCaptureMsg] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  // Explicit, user-initiated daily snapshot capture (the GET cockpit is read-only).
  // Reports the server's HONEST per-metric outcome (inserted vs already-captured-today
  // vs failed) — never a blanket success. Refreshes the panel only if rows were added.
  const captureSnapshot = async () => {
    setCapturing(true); setCaptureMsg(null);
    try {
      const r = await fetch('/api/employer/eios/p21/snapshots/capture', { method: 'POST', credentials: 'include' });
      if (!r.ok) { setCaptureMsg(r.status === 503 ? 'Not available' : `Failed (${r.status})`); setCapturing(false); return; }
      const j = await r.json();
      const parts: string[] = [];
      if (j.inserted) parts.push(`${j.inserted} captured`);
      if (j.skipped) parts.push(`${j.skipped} already today`);
      if (j.errors) parts.push(`${j.errors} failed`);
      setCaptureMsg(parts.length ? parts.join(' · ') : 'Nothing to capture');
      if (j.inserted > 0) onRefresh?.();
    } catch (e: any) {
      setCaptureMsg(e?.message || 'Capture failed');
    }
    setCapturing(false);
  };

  const ceoMetrics    = [['talentHealth','Talent Health'],['capabilityHealth','Capability Health'],['leadershipHealth','Leadership Health'],['workforceHealth','Workforce Health']];
  const chroMetrics   = [['talentHealth','Talent Health'],['successionHealth','Succession Health'],['leadershipHealth','Leadership Health'],['attritionRisk','Attrition Risk']];
  const cooMetrics    = [['workforceCapacity','Workforce Capacity'],['productivityRisk','Productivity Risk'],['capabilityRisk','Capability Risk'],['operationalReadiness','Operational Readiness']];
  const cloMetrics    = [['learningReadiness','Learning Readiness'],['developmentCoverage','Development Coverage'],['learningROI','Learning ROI']];
  const metricsMap: Record<string, [string,string][]> = { ceo: ceoMetrics, chro: chroMetrics, coo: cooMetrics, clo: cloMetrics };
  const activeMetrics = metricsMap[view] || ceoMetrics;
  const isFirstRun = (summary.totalCandidates ?? 0) === 0 && (summary.totalJobs ?? 0) === 0 && (summary.totalAssessments ?? 0) === 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {COCKPIT_STATS.map(s => {
          const Icon = s.icon;
          const val = summary[s.key] ?? 0;
          return (
            <div key={s.key} className="relative overflow-hidden bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${s.glow} to-transparent`} />
              <div className="relative flex items-center gap-3">
                <div className={`shrink-0 w-9 h-9 rounded-lg bg-slate-900/40 border border-slate-700/50 flex items-center justify-center ${s.accent}`}><Icon size={18} /></div>
                <div className="min-w-0">
                  <div className="text-2xl font-bold text-white leading-none tabular-nums">{val}</div>
                  <div className="text-xs text-slate-400 mt-1 truncate">{s.label}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {lensFramework && (
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg px-3 py-2 text-xs text-blue-300 flex items-center gap-2">
          <LayoutDashboard size={12} /> {lensFramework}
        </div>
      )}
      {isFirstRun && (
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-500/10 via-slate-800/40 to-transparent border border-blue-500/25 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-9 h-9 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-300"><Target size={18} /></div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-white">Your cockpit is ready — let's bring it to life</div>
              <div className="text-xs text-slate-400 mt-0.5">Executive intelligence populates from real activity. Nothing here is simulated.</div>
              <div className="grid sm:grid-cols-3 gap-2 mt-3">
                {[
                  { n: 1, t: 'Post a role', d: 'Open a position on the Job Board' },
                  { n: 2, t: 'Assess candidates', d: 'Invite applicants and run assessments' },
                  { n: 3, t: 'Read the intelligence', d: 'Health, risk & forecasts appear here' },
                ].map(step => (
                  <div key={step.n} className="bg-slate-900/30 border border-slate-700/40 rounded-lg p-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold flex items-center justify-center">{step.n}</span>
                      <span className="text-xs font-semibold text-white">{step.t}</span>
                    </div>
                    <div className="text-xs text-slate-400 leading-tight">{step.d}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {data.worldClass && (
        <div className="flex items-center justify-end gap-2">
          {captureMsg && <span className="text-xs text-blue-300">{captureMsg}</span>}
          {exportMsg && <span className="text-xs text-amber-300">{exportMsg}</span>}
          <button onClick={captureSnapshot} disabled={capturing} className="bg-blue-600/80 hover:bg-blue-600 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded flex items-center gap-1.5">{capturing ? <Loader2 size={11} className="animate-spin" /> : <Clock size={11} />} Capture snapshot</button>
          <button onClick={() => downloadExport('/api/employer/eios/p21/export.csv', 'eios_executive_longitudinal.csv', setExportMsg)} className="bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs px-3 py-1.5 rounded flex items-center gap-1.5"><Download size={11} /> Export CSV</button>
        </div>
      )}
      <div>
        <div className="text-xs text-slate-500 mb-1.5 flex items-center gap-1.5"><Eye size={11} /> Executive lens</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TABS.map(t => {
            const meta = VIEW_META[t.id] || { label: t.label, icon: LayoutDashboard, focus: '' };
            const Icon = meta.icon;
            const active = view === t.id;
            return (
              <button key={t.id} onClick={() => setView(t.id as any)}
                className={`text-left rounded-lg p-2.5 border transition-all ${active ? 'bg-blue-600/90 border-blue-500 text-white shadow-lg shadow-blue-900/30' : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-600'}`}>
                <div className="flex items-center gap-1.5"><Icon size={13} /><span className="text-xs font-semibold">{meta.label}</span></div>
                <div className={`text-xs mt-0.5 leading-tight ${active ? 'text-blue-100' : 'text-slate-500'}`}>{meta.focus}</div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {activeMetrics.map(([key, label]) => (
          <LensCard key={key} metricKey={key} metric={vd[key]} label={label} />
        ))}
      </div>
      {(view === 'ceo' || view === 'chro') && vd.riskIntelligence && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
          <SectionHeader title="Risk & Forecast Intelligence" />
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-slate-400">At-Risk Talent</span><span className="text-rose-300">{vd.riskIntelligence.atRisk ?? 0}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Open Critical Roles</span><span className="text-amber-300">{vd.riskIntelligence.criticalRoles ?? 0}</span></div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-slate-400">Projected Hires 90d</span><span className="text-emerald-300">{vd.forecastIntelligence?.projectedHires90d ?? 0}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Conversion Rate</span><span className="text-white">{vd.outcomeIntelligence?.conversionRate ?? 0}%</span></div>
            </div>
          </div>
        </div>
      )}
      {data.worldClass && data.longitudinal && <LongitudinalPanel longitudinal={data.longitudinal} />}
    </div>
  );
}

// ─── P22: Outcome Intelligence ────────────────────────────────────────────────
function P22Panel({ data }: { data: any }) {
  const outcomes = data.outcomes || {};
  const attribution = data.attribution || {};
  const OUTCOME_TYPES = [
    { key: 'hiringDecision', label: 'Hiring Decision', icon: <CheckSquare size={12} /> },
    { key: 'performance', label: 'Performance', icon: <BarChart2 size={12} /> },
    { key: 'retention', label: 'Retention', icon: <Users size={12} /> },
    { key: 'promotion', label: 'Promotion', icon: <ArrowUp size={12} /> },
    { key: 'leadershipGrowth', label: 'Leadership Growth', icon: <Star size={12} /> },
    { key: 'learningImpact', label: 'Learning Impact', icon: <BookOpen size={12} /> },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Tracked Outcomes" value={data.trackedOutcomes ?? 0} />
        <KPI label="Hiring Effectiveness" value={`${attribution.hiringEffectiveness ?? 0}%`} />
        <KPI label="Leadership Attribution" value={attribution.leadershipEffectiveness === 'pending_outcome_data' ? 'Pending' : attribution.leadershipEffectiveness} />
        <KPI label="Learning Attribution" value={attribution.learningEffectiveness === 'pending_outcome_data' ? 'Pending' : attribution.learningEffectiveness} />
      </div>
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
        <SectionHeader title="Outcome Tracking by Type" sub="Track real-world outcomes against assessment predictions" />
        <div className="space-y-2">
          {OUTCOME_TYPES.map(({ key, label, icon }) => {
            const oc = outcomes[key] || {};
            const tracked = oc.tracked ?? 0;
            return (
              <div key={key} className="flex items-center justify-between py-2 border-b border-slate-700/30 last:border-0 text-sm">
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="text-slate-500">{icon}</span>{label}
                </div>
                <div className="flex items-center gap-3">
                  {oc.effectiveness !== undefined && <span className="text-xs text-slate-400">{oc.effectiveness}% effective</span>}
                  <span className={`text-xs px-2 py-0.5 rounded ${tracked > 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-600 text-slate-400'}`}>{tracked > 0 ? `${tracked} tracked` : 'No data'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-300">
        Use <code className="bg-blue-500/10 px-1 rounded">POST /api/employer/eios/p22/outcomes</code> to track real-world outcomes against predictions.
      </div>
    </div>
  );
}

// ─── P23: Assessment Effectiveness ───────────────────────────────────────────
function P23Panel({ data }: { data: any }) {
  const reliabilityColor = data.assessmentReliability === 'high' ? 'text-emerald-300' : data.assessmentReliability === 'moderate' ? 'text-amber-300' : 'text-rose-300';
  const predictColor = data.assessmentPredictiveness === 'high' ? 'text-emerald-300' : data.assessmentPredictiveness === 'moderate' ? 'text-amber-300' : 'text-slate-400';
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Assessment Accuracy" value={`${data.assessmentAccuracy ?? 0}%`} sub="Hire prediction accuracy" />
        <KPI label="Assessment Coverage" value={`${data.assessmentCoverage ?? 0}%`} sub="Candidates assessed" />
        <KPI label="Quality Index" value={data.qualityIndex ?? 0} sub="Accuracy + Coverage" />
        <KPI label="Confidence Index" value={data.confidenceIndex ?? 0} />
      </div>
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
        <SectionHeader title="Effectiveness Indicators" />
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs text-slate-400 mb-1">Predictiveness</div>
            <div className={`font-semibold capitalize ${predictColor}`}>{data.assessmentPredictiveness?.replace(/_/g, ' ') || '—'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">Reliability</div>
            <div className={`font-semibold capitalize ${reliabilityColor}`}>{data.assessmentReliability?.replace(/_/g, ' ') || '—'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">Drift Status</div>
            <div className="text-blue-300 capitalize">{data.assessmentDrift || 'monitoring'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">ROI Attribution</div>
            <div className="text-slate-300 capitalize">{data.assessmentROI?.replace(/_/g, ' ') || '—'}</div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3">
          <div className="text-xl font-bold text-white">{data.totalAssessments ?? 0}</div>
          <div className="text-xs text-slate-400 mt-1">Total Assessments</div>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3">
          <div className="text-xl font-bold text-teal-300">{data.covered ?? 0}</div>
          <div className="text-xs text-slate-400 mt-1">Candidates Covered</div>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3">
          <div className="text-xl font-bold text-slate-300">{data.total ?? 0}</div>
          <div className="text-xs text-slate-400 mt-1">Total Candidates</div>
        </div>
      </div>
    </div>
  );
}

// ─── P24: Workforce Planning ──────────────────────────────────────────────────
function P24Panel({ data }: { data: any }) {
  const hc = data.headcountPlanning || {};
  const cap = data.capabilityPlanning || {};
  const hp = data.hiringPlanning || {};
  const sp = data.successionPlanning || {};
  const byDept = hc.byDepartment || {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Current Headcount" value={hc.currentHeadcount ?? 0} />
        <KPI label="Open Roles" value={hc.openRoles ?? 0} />
        <KPI label="Projected Hires" value={hc.projectedHires ?? 0} />
        <KPI label="Fill Rate" value={`${hp.currentFillRate ?? 0}%`} sub={`Target: ${hp.targetFillRate ?? 80}%`} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
          <SectionHeader title="Capability Distribution" />
          <div className="space-y-2">
            {[
              { label: 'High Capability (≥70)', count: cap.highCapability || 0, color: 'bg-emerald-500' },
              { label: 'Mid Capability (50–69)', count: cap.medCapability || 0, color: 'bg-amber-500' },
              { label: 'Low Capability (<50)', count: cap.lowCapability || 0, color: 'bg-rose-500' },
            ].map(({ label, count, color }) => {
              const total = (cap.highCapability || 0) + (cap.medCapability || 0) + (cap.lowCapability || 0);
              const pct = total > 0 ? Math.round(count / total * 100) : 0;
              return (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">{label}</span><span className="text-white">{count}</span></div>
                  <Bar value={pct} color={color} />
                </div>
              );
            })}
            <div className="text-xs text-slate-500 pt-1">Capability gaps: {cap.gapCount ?? 0} unfilled roles</div>
          </div>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
          <SectionHeader title="Succession Planning" />
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">Ready Now (EI≥80)</span><span className="text-emerald-300 font-bold">{sp.readyNow ?? 0}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Ready 6M (EI≥65)</span><span className="text-blue-300 font-bold">{sp.ready6m ?? 0}</span></div>
          </div>
        </div>
      </div>
      {Object.keys(byDept).length > 0 && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
          <SectionHeader title="Headcount by Department" />
          <div className="space-y-1.5">
            {Object.entries(byDept).map(([dept, count]: any) => (
              <div key={dept} className="flex items-center gap-3 text-xs">
                <div className="flex-1 text-slate-300">{dept}</div>
                <Bar value={count} max={Math.max(...Object.values(byDept).map(Number))} color="bg-blue-500" />
                <div className="text-white w-6 text-right">{count}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {(data.savedPlans || []).length > 0 && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
          <SectionHeader title="Saved Workforce Plans" />
          {data.savedPlans.map((plan: any) => (
            <div key={plan.id} className="flex justify-between items-center py-2 border-b border-slate-700/30 last:border-0 text-sm">
              <span className="text-white">{plan.plan_name}</span>
              <span className="text-xs text-slate-400">{new Date(plan.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── P25: Governance & Compliance ─────────────────────────────────────────────
function P25Panel({ data }: { data: any }) {
  const SCORE_DIMS = [
    { key: 'governanceScore', label: 'Governance Score', color: 'bg-blue-500' },
    { key: 'complianceScore', label: 'Compliance Score', color: 'bg-emerald-500' },
  ];
  const POLICY_KEYS = ['hiringPolicy', 'assessmentPolicy', 'dataRetention'];
  const policies = data.policyCompliance || {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className={`border rounded-lg p-4 ${data.governanceScore >= 80 ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
          <div className="text-xs text-slate-400 mb-1">Governance Score</div>
          <div className="text-2xl font-bold text-white">{data.governanceScore ?? 0}</div>
          <Bar value={data.governanceScore ?? 0} color="bg-blue-500" />
        </div>
        <div className={`border rounded-lg p-4 ${data.complianceScore >= 80 ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
          <div className="text-xs text-slate-400 mb-1">Compliance Score</div>
          <div className="text-2xl font-bold text-white">{data.complianceScore ?? 0}</div>
          <Bar value={data.complianceScore ?? 0} color="bg-emerald-500" />
        </div>
        <div className={`border rounded-lg p-4 ${data.riskScore <= 25 ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-rose-500/30 bg-rose-500/5'}`}>
          <div className="text-xs text-slate-400 mb-1">Risk Score</div>
          <div className="text-2xl font-bold text-white">{data.riskScore ?? 0}</div>
          <Bar value={data.riskScore ?? 0} color="bg-rose-500" />
        </div>
      </div>
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
        <SectionHeader title="AI & Bias Governance" />
        <div className="grid grid-cols-3 gap-3 text-center text-sm">
          {[
            { label: 'AI Governance', status: data.aiGovernance?.status },
            { label: 'Bias Monitoring', status: data.biasMonitoring?.status },
            { label: 'DEI Monitoring', status: data.deiMonitoring?.status },
          ].map(({ label, status }) => (
            <div key={label} className="bg-slate-700/40 rounded p-2">
              <div className="text-xs text-slate-400 mb-1.5">{label}</div>
              <StatusBadge status={status || 'unknown'} />
            </div>
          ))}
        </div>
      </div>
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
        <SectionHeader title="Policy Compliance" />
        <div className="space-y-2">
          {POLICY_KEYS.map(key => (
            <div key={key} className="flex justify-between items-center text-sm py-1 border-b border-slate-700/30 last:border-0">
              <span className="text-slate-300 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
              <StatusBadge status={policies[key] || 'unknown'} />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-slate-800/60 border border-slate-700/50 rounded p-3">
          <span className="text-slate-400">Audit Logs: </span>
          <span className="text-white">{data.auditCompliance?.logsPresent ?? 0} entries</span>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/50 rounded p-3">
          <span className="text-slate-400">Explainability: </span>
          <span className="text-emerald-300">{data.assessmentCompliance?.explainability || 'full'}</span>
        </div>
      </div>
    </div>
  );
}

// ─── P26: Model Monitoring ────────────────────────────────────────────────────
function P26Panel({ data }: { data: any }) {
  const models = data.models || [];
  const modelStatusColor = (s: string) => s === 'active' ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' : s === 'monitoring' ? 'text-blue-300 bg-blue-500/10 border-blue-500/30' : 'text-slate-400 bg-slate-700/40 border-slate-600/30';
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Model Health" value={data.modelHealth?.replace(/_/g, ' ') || '—'} />
        <KPI label="Prediction Accuracy" value={data.predictionAccuracy?.replace(/_/g, ' ') || '—'} />
        <KPI label="Drift Status" value={data.modelDrift || '—'} />
        <KPI label="AI Reliability" value={data.aiReliability || '—'} />
      </div>
      <div className="space-y-2">
        {models.map((m: any) => (
          <div key={m.id} className={`border rounded-lg p-3 ${modelStatusColor(m.status)}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{m.label}</div>
                <div className="text-xs opacity-70 mt-0.5">Sample size: {m.sampleSize ?? 0}</div>
              </div>
              <StatusBadge status={m.status} />
            </div>
            {m.avgScore !== undefined && (
              <div className="mt-2">
                <div className="flex justify-between text-xs mb-1"><span className="opacity-70">Avg Score</span><span>{m.avgScore}</span></div>
                <Bar value={m.avgScore} color="bg-blue-400" />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 text-center text-xs">
        {[
          { label: 'False Positives', val: data.falsePositives },
          { label: 'False Negatives', val: data.falseNegatives },
          { label: 'Calibration', val: data.calibration },
        ].map(({ label, val }) => (
          <div key={label} className="bg-slate-800/60 border border-slate-700/50 rounded p-2">
            <div className="text-slate-400 mb-1">{label}</div>
            <div className="text-white capitalize">{String(val || '—').replace(/_/g, ' ')}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── P27: Integration & APIs ──────────────────────────────────────────────────
function P27Panel({ data }: { data: any }) {
  const integrations = data.integrations || [];
  const available = integrations.filter((i: any) => i.status === 'available');
  const roadmap = integrations.filter((i: any) => i.status === 'roadmap');
  const ICONS: Record<string, React.ReactNode> = {
    ats_api: <Users size={14} />, hrms_api: <Building2 size={14} />, erp_api: <Layers size={14} />,
    payroll_api: <DollarSign size={14} />, lms_api: <BookOpen size={14} />, identity_api: <Shield size={14} />,
    partner_api: <Globe size={14} />, webhooks: <Server size={14} />, marketplace: <Shuffle size={14} />,
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
          <div className="text-2xl font-bold text-emerald-300">{available.length}</div>
          <div className="text-xs text-slate-400 mt-1">Available Now</div>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
          <div className="text-2xl font-bold text-blue-300">{roadmap.length}</div>
          <div className="text-xs text-slate-400 mt-1">On Roadmap</div>
        </div>
        <div className="bg-slate-700/30 border border-slate-600/40 rounded-lg p-3">
          <div className="text-2xl font-bold text-white">{integrations.length}</div>
          <div className="text-xs text-slate-400 mt-1">Total Integrations</div>
        </div>
      </div>
      <div className="space-y-2">
        {integrations.map((intg: any) => (
          <div key={intg.id} className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3 flex items-center gap-3">
            <div className={`p-2 rounded ${intg.status === 'available' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700/50 text-slate-500'}`}>
              {ICONS[intg.id] || <Link2 size={14} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white">{intg.label}</div>
              <div className="text-xs text-slate-400 truncate">{intg.description}</div>
            </div>
            <StatusBadge status={intg.status} />
          </div>
        ))}
      </div>
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3 text-xs text-slate-400">
        <div className="font-medium text-slate-300 mb-1">Authentication</div>
        <span>{data.apiAuthentication?.method?.replace(/_/g, ' ')} · {data.apiAuthentication?.scope?.replace(/_/g, ' ')}</span>
      </div>
    </div>
  );
}

// ─── P28: Org Digital Twin ────────────────────────────────────────────────────
function P28Panel({ data }: { data: any }) {
  const twin = data.digitalTwin || {};
  const org = twin.organization || {};
  const simulations = data.simulations || {};
  const completeness = data.twinCompleteness ?? 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Total People Modelled" value={org.totalPeople ?? 0} />
        <KPI label="Open Roles" value={org.openRoles ?? 0} />
        <KPI label="TIG Nodes" value={org.networkNodes ?? 0} />
        <KPI label="Departments" value={(org.departments || []).length} />
      </div>
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
        <div className="flex justify-between items-center mb-3">
          <SectionHeader title="Twin Completeness" sub="Based on data coverage across all pillars" />
          <span className={`text-lg font-bold ${completeness >= 70 ? 'text-emerald-400' : completeness >= 40 ? 'text-amber-400' : 'text-rose-400'}`}>{completeness}%</span>
        </div>
        <Bar value={completeness} color={completeness >= 70 ? 'bg-emerald-500' : completeness >= 40 ? 'bg-amber-500' : 'bg-rose-500'} />
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            {twin.people?.length > 0 ? <CheckCircle2 size={11} className="text-emerald-400" /> : <XCircle size={11} className="text-slate-500" />}
            <span className="text-slate-400">People layer</span>
          </div>
          <div className="flex items-center gap-1.5">
            {org.networkNodes > 0 ? <CheckCircle2 size={11} className="text-emerald-400" /> : <XCircle size={11} className="text-slate-500" />}
            <span className="text-slate-400">Network layer (TIG)</span>
          </div>
          <div className="flex items-center gap-1.5">
            {org.openRoles > 0 ? <CheckCircle2 size={11} className="text-emerald-400" /> : <XCircle size={11} className="text-slate-500" />}
            <span className="text-slate-400">Role layer</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={11} className="text-emerald-400" />
            <span className="text-slate-400">Intelligence base</span>
          </div>
        </div>
      </div>
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
        <SectionHeader title="Available Simulations" sub="Use the Scenario Intelligence pillar (P17) to run these" />
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(simulations).map(([key, sim]: any) => (
            <div key={key} className="flex items-start gap-2 text-xs bg-slate-700/30 rounded p-2">
              <Play size={10} className="text-slate-500 mt-0.5 shrink-0" />
              <div>
                <div className="text-slate-300 capitalize font-medium">{key.replace(/_/g, ' ')}</div>
                <div className="text-slate-500">{sim.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Generic Panel (final fallback for unknown pillar IDs) ────────────────────
function GenericPanel({ data, pillarId }: { data: any; pillarId: number }) {
  const entries = Object.entries(data).filter(([k]) => !['pillar', 'name', 'dataSource', 'suppressionNote'].includes(k));
  const render = (key: string, val: any): React.ReactNode => {
    if (val === null || val === undefined) return <span className="text-slate-500 italic">no data</span>;
    if (typeof val === 'object' && !Array.isArray(val)) {
      return (
        <div className="ml-3 space-y-1">
          {Object.entries(val).map(([k2, v2]) => (
            <div key={k2} className="text-xs"><span className="text-slate-400 capitalize">{k2.replace(/_/g, ' ')}: </span>{render(k2, v2)}</div>
          ))}
        </div>
      );
    }
    if (Array.isArray(val)) {
      if (val.length === 0) return <span className="text-slate-500 italic">empty</span>;
      return (
        <div className="space-y-1 ml-3">
          {val.slice(0, 5).map((item: any, i: number) => (
            <div key={i} className="text-xs text-slate-300">
              {typeof item === 'object' ? Object.entries(item).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(' · ') : String(item)}
            </div>
          ))}
          {val.length > 5 && <div className="text-xs text-slate-500">+{val.length - 5} more</div>}
        </div>
      );
    }
    if (typeof val === 'number') return <ScoreBadge score={val} size="sm" />;
    if (typeof val === 'boolean') return <span className={val ? 'text-emerald-400' : 'text-rose-400'}>{val ? '✓' : '✗'}</span>;
    return <span className="text-white">{String(val)}</span>;
  };
  return (
    <div className="space-y-3">
      {entries.map(([key, val]) => (
        <div key={key} className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3">
          <div className="text-xs font-semibold text-slate-300 capitalize mb-1">{key.replace(/_/g, ' ')}</div>
          {render(key, val)}
        </div>
      ))}
    </div>
  );
}

// ─── Certification Panel ──────────────────────────────────────────────────────
function CertificationPanel({ data }: { data: any }) {
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<any>(null);
  const [showAllAxes, setShowAllAxes] = useState(false);

  const runSeedDemo = async () => {
    setSeeding(true);
    try {
      const r = await fetch('/api/employer/eios/seed-demo', { method: 'POST', credentials: 'include' });
      const d = await r.json();
      setSeedResult(d);
    } catch (e: any) { setSeedResult({ success: false, error: e.message }); }
    setSeeding(false);
  };

  const AXIS_LABELS: Record<string, string> = {
    structural: 'Structural', activation: 'Activation (data-bound)', data: 'Data Sources',
    intelligence: 'Intelligence', security: 'Security', commercial: 'Commercial',
    enterprise: 'Enterprise', executive: 'Executive Intelligence', governance: 'Governance',
    ai_reliability: 'AI Reliability', reporting: 'Reporting',
    ws15_architecture: 'WS15 Architecture', ws15_hiring: 'WS15 Hiring',
    ws15_talent: 'WS15 Talent', ws15_competency: 'WS15 Competency',
    ws15_workforce: 'WS15 Workforce', ws15_succession: 'WS15 Succession',
    ws15_learning: 'WS15 Learning', ws15_forecast: 'WS15 Forecast',
    ws15_outcome: 'WS15 Outcome', ws15_reporting: 'WS15 Reporting',
  };
  const ACTIVATION_AXES = new Set(['activation', 'data']);
  const isDataBound = (axis: string) => ACTIVATION_AXES.has(axis);

  const verdictColor = data.verdict === 'GO'
    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
    : data.verdict === 'CONDITIONAL_GO'
    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
    : 'bg-rose-500/20 border-rose-500/40 text-rose-300';

  // Use new structural score if available, fall back to legacy
  const structuralScore  = data.structuralScore  ?? data.structural ?? 0;
  const activationScore  = data.activationScore  ?? 0;
  const structuralPassed = data.structuralPassed ?? data.passed ?? 0;
  const structuralTotal  = data.structuralTotal  ?? data.total ?? 0;
  const ws15             = data.ws15Summary;

  const axisList = Object.entries(data.axisScores || {});
  const structuralAxes = axisList.filter(([axis]) => !isDataBound(axis) && !axis.startsWith('ws15_'));
  const ws15Axes       = axisList.filter(([axis]) => axis.startsWith('ws15_'));
  const dataAxes       = axisList.filter(([axis]) => isDataBound(axis));

  return (
    <div className="space-y-5">
      {/* ── Verdict Banner ── */}
      <div className={`border rounded-xl p-5 ${verdictColor}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold">{data.verdict}</div>
            <div className="text-sm mt-1">{data.worldClassReadiness}</div>
          </div>
          <Award size={48} className="opacity-60" />
        </div>
        <div className="mt-3 text-sm opacity-80">{data.certification} · {data.version}</div>
      </div>

      {/* ── Dual-Axis Score ── */}
      <div className="grid grid-cols-3 gap-3">
        <KPI label="Structural Score" value={`${structuralScore}%`} sub={`${structuralPassed}/${structuralTotal} checks · verdict basis`} />
        <KPI label="Activation Score" value={`${activationScore}%`} sub="Data-bound (0% until live data)" />
        <KPI label="All Targets Met" value={data.allTargetsMet ? '✓ Yes' : '✗ Pending data'} />
      </div>

      {/* ── WS15 Summary ── */}
      {ws15 && (
        <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-lg p-4">
          <SectionHeader title="WS15 World-Class Dimensions" sub={`${ws15.passed}/${ws15.total} checks — all structural`} />
          <Bar value={ws15.score} color="bg-indigo-500" />
          <div className="text-xs text-indigo-300 mt-2">{ws15.score}% — {ws15.score === 100 ? '✓ All 31 WS15 structural dimensions certified' : `${ws15.total - ws15.passed} pending`}</div>
        </div>
      )}

      {/* ── WS15 Runtime Verification (EP-WORLDCLASS-98 Enh1) ── */}
      {data.worldClass && data.ws15Verification && (
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4">
          <SectionHeader title="WS15 Runtime Verification" sub={data.ws15Verification.method} />
          <div className="grid grid-cols-3 gap-3 mb-3">
            <KPI label="Mode" value={data.ws15Verification.mode} />
            <KPI label="Verified" value={`${data.ws15Verification.verified}/${data.ws15Verification.total}`} />
            <KPI label="Runtime Score" value={`${data.ws15Verification.score}%`} />
          </div>
          {(data.ws15Verification.failing || []).length > 0 ? (
            <div className="space-y-1">
              <div className="text-xs text-rose-300 mb-1">Failing checks ({data.ws15Verification.failing.length}) — re-derived from live router + schema, not asserted:</div>
              {data.ws15Verification.failing.map((f: any) => (
                <div key={f.id} className="text-xs bg-slate-800/60 rounded p-2">
                  <span className="text-rose-300 font-mono">{f.id}</span>
                  {Array.isArray(f.missing) && f.missing.length > 0 && <span className="text-slate-500"> — missing: {f.missing.join(', ')}</span>}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-emerald-300 flex items-center gap-1.5"><CheckCircle2 size={12} /> All {data.ws15Verification.total} WS15 checks verified at runtime (routes registered + tables exist + seed rows present).</div>
          )}
        </div>
      )}

      {/* ── Activation Note + Seed Demo ── */}
      {activationScore < 100 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4">
          <SectionHeader title="Activation Intelligence" sub="Data-bound — needs live employer data" />
          <p className="text-xs text-slate-400 mb-3">{data.activationNote || 'Import candidates and run assessments to activate all intelligence layers.'}</p>
          <button onClick={runSeedDemo} disabled={seeding} className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs px-4 py-2 rounded flex items-center gap-2">
            {seeding ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
            Seed Demo Data (10 candidates + 7 assessments)
          </button>
          {seedResult && (
            <div className={`mt-3 text-xs p-2 rounded ${seedResult.success ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>
              {seedResult.message || seedResult.error}
            </div>
          )}
        </div>
      )}

      {/* ── Structural Axes ── */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
        <div className="flex justify-between items-center mb-3">
          <SectionHeader title="Structural Readiness by Axis" />
          <button onClick={() => setShowAllAxes(v => !v)} className="text-xs text-slate-400 hover:text-white">{showAllAxes ? 'Hide WS15' : 'Show all'}</button>
        </div>
        <div className="space-y-2">
          {structuralAxes.map(([axis, scores]: any) => (
            <div key={axis}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">{AXIS_LABELS[axis] || axis}</span>
                <span className="text-white">{scores.pct}% <span className="text-slate-500">({scores.passed}/{scores.total})</span>{data.targets?.[axis] && scores.pct < data.targets[axis] && <span className="text-rose-400 ml-1">↓ {data.targets[axis]}%</span>}</span>
              </div>
              <Bar value={scores.pct} color={scores.pct >= (data.targets?.[axis] || 95) ? 'bg-emerald-500' : 'bg-amber-500'} />
            </div>
          ))}
          {/* WS15 axes collapsed by default */}
          {showAllAxes && ws15Axes.map(([axis, scores]: any) => (
            <div key={axis}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-indigo-400">{AXIS_LABELS[axis] || axis}</span>
                <span className="text-white">{scores.pct}% <span className="text-slate-500">({scores.passed}/{scores.total})</span></span>
              </div>
              <Bar value={scores.pct} color="bg-indigo-500" />
            </div>
          ))}
          {/* Data-bound axes — clearly labelled */}
          {dataAxes.length > 0 && (
            <div className="pt-2 border-t border-slate-700/40">
              <div className="text-xs text-slate-500 mb-2">Data-bound (excluded from verdict)</div>
              {dataAxes.map(([axis, scores]: any) => (
                <div key={axis}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">{AXIS_LABELS[axis] || axis}</span>
                    <span className="text-slate-400">{scores.pct}% <span className="text-slate-600">({scores.passed}/{scores.total})</span></span>
                  </div>
                  <Bar value={scores.pct} color="bg-slate-600" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 29 Pillars ── */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
        <SectionHeader title="29 Intelligence Pillars" />
        <div className="grid grid-cols-2 gap-1.5">
          {(data.pillars || []).map((p: any) => (
            <div key={p.id} className="flex items-center gap-2 text-xs">
              {p.passCount > 0 || p.totalCount === 0
                ? <CheckCircle2 size={12} className={p.status === 'complete' ? 'text-emerald-400' : 'text-amber-400'} />
                : <XCircle size={12} className="text-rose-400" />}
              <span className="text-slate-300"><span className="text-slate-500 mr-1">P{p.id}</span>{p.name}</span>
              {p.totalCount > 0 && <span className="text-slate-500 ml-auto">{p.passCount}/{p.totalCount}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── P17: Scenario Simulator ──────────────────────────────────────────────────
function P17Panel({ data: initialData }: { data: any }) {
  const [selected, setSelected] = useState<string>('hiring_expansion');
  const [magnitude, setMagnitude] = useState(10);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runSim = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/employer/eios/p17/simulate', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: selected, magnitude }),
      });
      const d = await r.json();
      setResult(d.simulation);
    } catch {}
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
        <SectionHeader title="Configure & Run Scenario" />
        <div className="grid grid-cols-2 gap-3 mb-3">
          <select value={selected} onChange={e => setSelected(e.target.value)} className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white">
            {(initialData.availableScenarios || []).map((s: any) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Magnitude %:</span>
            <input type="number" value={magnitude} onChange={e => setMagnitude(Number(e.target.value))} min={1} max={100} className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white w-20" />
          </div>
        </div>
        <button onClick={runSim} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded flex items-center gap-2 disabled:opacity-50">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Run Simulation
        </button>
      </div>
      {result && (
        <div className="bg-slate-800/60 border border-emerald-500/30 rounded-lg p-4">
          <div className="text-sm font-semibold text-emerald-400 mb-3">Simulation Result — {result.scenario} ({result.magnitude}%)</div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[['Capability Impact', result.capabilityImpact], ['Cost Impact', result.costImpact], ['Leadership Impact', result.leadershipImpact], ['Readiness Impact', result.readinessImpact], ['Time to Impact', result.timeToImpact], ['People Affected', result.peopleAffected]].map(([label, val]) => (
              <div key={label as string} className="bg-slate-700/50 rounded p-2">
                <div className="text-xs text-slate-400 mb-1">{label}</div>
                <div className="text-white font-medium">{val}</div>
              </div>
            ))}
          </div>
          {result.frpContext && (
            <div className="mt-3 pt-3 border-t border-slate-700/40 text-xs text-blue-300 flex items-center gap-1.5">
              <Zap size={11} /> FRP enrichment: avg Future Readiness Index {result.frpContext.avgFRI}, {result.frpContext.frpCoverage}% coverage
            </div>
          )}
        </div>
      )}
      <div className="space-y-2">
        {(initialData.availableScenarios || []).map((s: any) => (
          <div key={s.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selected === s.id ? 'border-blue-500/50 bg-blue-500/10' : 'border-slate-700/50 bg-slate-800/40 hover:border-slate-600'}`} onClick={() => setSelected(s.id)}>
            <Play size={14} className="text-slate-400" />
            <div><div className="text-sm text-white">{s.label}</div><div className="text-xs text-slate-400">{s.description}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── P29: Employee Workforce Panel ───────────────────────────────────────────
function P29WorkforcePanel({ data }: { data: any }) {
  const { employees = [], total = 0, byDepartment = {}, byStatus = {} } = data;
  const wc = !!data.worldClass;
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [csvRows, setCsvRows] = useState<any[] | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvMsg, setCsvMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<any | null>(null);

  // EP-WORLDCLASS-98 Enh2: parse a CSV file client-side into employee rows (preview before import).
  const onCsvFile = (file: File) => {
    setCsvError(null); setCsvMsg(null); setCsvRows(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const grid = parseCsv(String(reader.result || ''));
        if (grid.length < 2) { setCsvError('CSV needs a header row and at least one data row.'); return; }
        const header = grid[0].map(h => h.trim().toLowerCase());
        const col = (name: string) => header.indexOf(name);
        const ei = col('email');
        if (ei < 0) { setCsvError('CSV must have an "email" column.'); return; }
        const nameIdx = col('full_name') >= 0 ? col('full_name') : col('name');
        const parsed = grid.slice(1).map(r => ({
          email: (r[ei] || '').trim(),
          full_name: nameIdx >= 0 ? (r[nameIdx] || '').trim() : undefined,
          role_code: col('role_code') >= 0 ? (r[col('role_code')] || '').trim() : undefined,
          department: col('department') >= 0 ? (r[col('department')] || '').trim() : undefined,
          seniority: col('seniority') >= 0 ? (r[col('seniority')] || '').trim() : undefined,
        })).filter(e => e.email);
        if (parsed.length === 0) { setCsvError('No rows with a valid email found.'); return; }
        if (parsed.length > 500) { setCsvError('Max 500 rows per import.'); return; }
        setCsvRows(parsed);
      } catch (e: any) { setCsvError(e?.message || 'Could not parse CSV.'); }
    };
    reader.readAsText(file);
  };

  const importCsv = async () => {
    if (!csvRows) return;
    setCsvImporting(true); setCsvMsg(null);
    try {
      const r = await fetch('/api/employer/eios/employees/import', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employees: csvRows }),
      });
      const d = await r.json();
      if (r.ok && d.success) { setCsvMsg(`Imported ${d.imported ?? csvRows.length}${d.skipped ? `, skipped ${d.skipped}` : ''}. Reload pillar to see data.`); setCsvRows(null); }
      else setCsvMsg(d.error || `Import failed (${r.status})`);
    } catch (e: any) { setCsvMsg(e?.message || 'Import error'); }
    setCsvImporting(false);
  };

  const seedEmployees = async () => {
    setImporting(true); setImportMsg(null);
    try {
      const SAMPLE = [
        { email: 'hr.demo1@metryx.demo', full_name: 'Aisha Kapoor',    role_code: 'MANAGER',    department: 'HR',           seniority: 'Manager' },
        { email: 'eng.demo1@metryx.demo', full_name: 'Rohan Mehta',    role_code: 'VP',          department: 'Engineering',  seniority: 'VP' },
        { email: 'prod.demo1@metryx.demo',full_name: 'Sneha Rao',      role_code: 'DIRECTOR',    department: 'Product',      seniority: 'Director' },
        { email: 'ceo.demo@metryx.demo',  full_name: 'Arjun Sharma',   role_code: 'CEO',         department: 'Executive',    seniority: 'C-Suite' },
        { email: 'eng.demo2@metryx.demo', full_name: 'Priya Nair',     role_code: 'CRITICAL_SPECIALIST', department: 'Engineering', seniority: 'Individual Contributor' },
      ];
      const r = await fetch('/api/employer/eios/employees/import', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employees: SAMPLE }),
      });
      const d = await r.json();
      setImportMsg(d.success ? `Imported ${d.imported} employees. Reload pillar to see data.` : d.error || 'Error importing');
    } catch (e: any) { setImportMsg(e.message); }
    setImporting(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Total Employees" value={total} />
        <KPI label="Active" value={byStatus.active ?? 0} />
        <KPI label="Departments" value={Object.keys(byDepartment).length} />
        <KPI label="Roles Mapped" value={employees.filter((e: any) => e.role_code).length} />
      </div>

      {wc && (
        <div className="bg-slate-800/60 border border-cyan-500/30 rounded-lg p-4">
          <SectionHeader title="Bulk CSV Upload" sub="Columns: email (required), full_name, role_code, department, seniority" />
          <label className="inline-flex items-center gap-2 bg-cyan-600/80 hover:bg-cyan-600 text-white text-xs px-3 py-1.5 rounded cursor-pointer w-fit">
            <Upload size={12} /> Choose CSV
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onCsvFile(f); e.target.value = ''; }} />
          </label>
          {csvError && <div className="text-xs text-rose-300 mt-2 flex items-center gap-1.5"><AlertCircle size={11} /> {csvError}</div>}
          {csvRows && (
            <div className="mt-3">
              <div className="text-xs text-slate-400 mb-2">Preview — {csvRows.length} row{csvRows.length === 1 ? '' : 's'} ready (showing first 10):</div>
              <div className="max-h-48 overflow-y-auto border border-slate-700/50 rounded">
                <table className="w-full text-xs">
                  <thead className="bg-slate-800 sticky top-0">
                    <tr className="text-slate-400 text-left">
                      <th className="px-2 py-1">Email</th><th className="px-2 py-1">Name</th><th className="px-2 py-1">Role</th><th className="px-2 py-1">Dept</th><th className="px-2 py-1">Seniority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.slice(0, 10).map((e, i) => (
                      <tr key={i} className="border-t border-slate-700/30 text-slate-300">
                        <td className="px-2 py-1">{e.email}</td><td className="px-2 py-1">{e.full_name || '—'}</td><td className="px-2 py-1">{e.role_code || '—'}</td><td className="px-2 py-1">{e.department || '—'}</td><td className="px-2 py-1">{e.seniority || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button onClick={importCsv} disabled={csvImporting} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs px-4 py-1.5 rounded flex items-center gap-2">
                  {csvImporting ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                  Import {csvRows.length} Employee{csvRows.length === 1 ? '' : 's'}
                </button>
                <button onClick={() => { setCsvRows(null); setCsvMsg(null); }} className="text-slate-400 hover:text-white text-xs px-3 py-1.5 rounded border border-slate-700">Cancel</button>
              </div>
            </div>
          )}
          {csvMsg && <div className="text-xs text-emerald-300 mt-2">{csvMsg}</div>}
        </div>
      )}

      {total === 0 ? (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-6 text-center">
          <Users size={32} className="mx-auto text-slate-600 mb-3" />
          <div className="text-slate-400 text-sm mb-4">No employees imported yet.</div>
          <div className="flex flex-col gap-2 items-center">
            <button onClick={seedEmployees} disabled={importing} className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs px-4 py-2 rounded flex items-center gap-2">
              {importing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
              Seed Sample Employees (5 across 6-role hierarchy)
            </button>
            <div className="text-xs text-slate-500">Or POST to /api/employer/eios/employees/import with your employee list</div>
          </div>
          {importMsg && <div className="mt-3 text-xs text-emerald-300">{importMsg}</div>}
        </div>
      ) : (
        <>
          {Object.keys(byDepartment).length > 0 && (
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
              <SectionHeader title="By Department" />
              <div className="space-y-2">
                {Object.entries(byDepartment).map(([dept, count]: any) => (
                  <div key={dept}>
                    <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">{dept}</span><span className="text-white">{count}</span></div>
                    <Bar value={Math.round(count / total * 100)} color="bg-cyan-500" />
                  </div>
                ))}
              </div>
            </div>
          )}
          {employees.slice(0, 8).map((e: any) => (
            <div key={e.id} onClick={() => wc && setSelected(e)} className={`flex items-center justify-between bg-slate-800/40 border border-slate-700/30 rounded p-3 text-sm ${wc ? 'cursor-pointer hover:border-cyan-500/40 transition-colors' : ''}`}>
              <div>
                <div className="text-white font-medium">{e.full_name || e.email}</div>
                <div className="text-xs text-slate-400">{e.department} · {e.seniority || 'Unknown'}</div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {e.role_name && <span className="bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded">{e.role_name}</span>}
                <span className={`px-2 py-0.5 rounded ${e.status === 'active' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-600 text-slate-400'}`}>{e.status}</span>
                {wc && <ChevronRight size={14} className="text-slate-500" />}
              </div>
            </div>
          ))}
        </>
      )}

      <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
        <SectionHeader title="Competency Architecture" sub="6-role canonical hierarchy — import by role_code" />
        <div className="grid grid-cols-2 gap-2 text-xs">
          {['CEO','CXO','VP','DIRECTOR','MANAGER','CRITICAL_SPECIALIST'].map(code => (
            <div key={code} className="flex items-center gap-2 bg-slate-700/30 rounded p-2">
              <span className="text-indigo-400 font-mono">{code}</span>
            </div>
          ))}
        </div>
        <div className="text-xs text-slate-500 mt-2">Full architecture: GET /api/employer/eios/competency-architecture</div>
      </div>

      {wc && selected && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-5" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="text-lg font-bold text-white">{selected.full_name || selected.email}</div>
                <div className="text-xs text-slate-400">{selected.email}</div>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Department', selected.department],
                ['Seniority', selected.seniority],
                ['Role Code', selected.role_code],
                ['Role', selected.role_name],
                ['Function', selected.function_name],
                ['Status', selected.status],
                ['Imported', selected.imported_at ? new Date(selected.imported_at).toLocaleDateString() : null],
              ].map(([label, value]) => (
                <div key={label as string} className="bg-slate-800/60 rounded p-2">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
                  <div className="text-slate-200">{value || '—'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Panel Dispatcher ─────────────────────────────────────────────────────────
function PillarContent({ pillarId, data, onRefresh }: { pillarId: number; data: any; onRefresh?: () => void }) {
  if (!data) return <EmptyState message="Loading..." />;
  switch (pillarId) {
    case 3:  return <P3Panel data={data} />;
    case 6:  return <P6Panel data={data} />;
    case 7:  return <P7Panel data={data} />;
    case 8:  return <P8Panel data={data} />;
    case 9:  return <P9Panel data={data} />;
    case 10: return <P10Panel data={data} />;
    case 11: return <P11Panel data={data} />;
    case 12: return <P12Panel data={data} />;
    case 13: return <P13Panel data={data} />;
    case 14: return <P14Panel data={data} />;
    case 15: return <P15Panel data={data} />;
    case 16: return <P16Panel data={data} />;
    case 17: return <P17Panel data={data} />;
    case 18: return <P18Panel data={data} />;
    case 19: return <P19Panel data={data} />;
    case 20: return <P20Panel data={data} />;
    case 21: return <P21Panel data={data} onRefresh={onRefresh} />;
    case 22: return <P22Panel data={data} />;
    case 23: return <P23Panel data={data} />;
    case 24: return <P24Panel data={data} />;
    case 25: return <P25Panel data={data} />;
    case 26: return <P26Panel data={data} />;
    case 27: return <P27Panel data={data} />;
    case 28: return <P28Panel data={data} />;
    case 29: return <P29WorkforcePanel data={data} />;
    default: return <GenericPanel data={data} pillarId={pillarId} />;
  }
}

// ─── Main Cockpit ─────────────────────────────────────────────────────────────
export default function EIOSCockpit() {
  const [selectedPillar, setSelectedPillar] = useState<number>(21);
  const [pillarData, setPillarData] = useState<Record<number, any>>({});
  const [loading, setLoading]       = useState(false);
  const [cert, setCert]             = useState<any>(null);
  const [showCert, setShowCert]     = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const loadPillar = useCallback(async (id: number) => {
    const pillar = PILLARS.find(p => p.id === id);
    if (!pillar?.route) { setPillarData(prev => ({ ...prev, [id]: { _linked: true } })); return; }
    if (pillarData[id]) return;
    setLoading(true); setError(null);
    try {
      const d = await apiFetch(pillar.route);
      setPillarData(prev => ({ ...prev, [id]: d }));
    } catch (e: any) { setError(`P${id}: ${e.message}`); }
    setLoading(false);
  }, [pillarData]);

  useEffect(() => { loadPillar(selectedPillar); }, [selectedPillar, loadPillar]);

  const loadCertification = async () => {
    try {
      const d = await apiFetch('/api/employer/eios/certification');
      setCert(d); setShowCert(true);
    } catch {}
  };

  const currentPillar = PILLARS.find(p => p.id === selectedPillar);
  const data = pillarData[selectedPillar];
  const LINKED_LABELS: Record<number, string> = {
    1: 'Security Dashboard (W1)', 2: 'Employer Portal Commercial', 4: 'Talent Intelligence Graph (W2)', 5: 'Hiring Intelligence (W3)',
  };

  return (
    <div className="flex h-full bg-slate-900 text-white">
      {/* Left Sidebar */}
      <div className="w-52 flex-shrink-0 border-r border-slate-700/50 overflow-y-auto bg-slate-900/80">
        <div className="p-3 border-b border-slate-700/50">
          <div className="text-xs font-bold text-slate-300 tracking-widest uppercase">EIOS</div>
          <div className="text-xs text-slate-500">29 Intelligence Pillars</div>
        </div>
        <div className="px-3 py-2">
          <button onClick={loadCertification} className="w-full flex items-center gap-2 text-xs bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded px-2 py-1.5 transition-all">
            <Award size={12} /> Run Certification
          </button>
        </div>
        {GROUPS.map(group => (
          <div key={group} className="mb-1">
            <div className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider ${GROUP_COLORS[group]}`}>{group}</div>
            {PILLARS.filter(p => p.group === group).map(pillar => (
              <button key={pillar.id}
                onClick={() => { setSelectedPillar(pillar.id); setShowCert(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-all ${selectedPillar === pillar.id && !showCert ? 'bg-blue-500/20 text-white border-l-2 border-blue-400' : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border-l-2 border-transparent'}`}
              >
                {pillar.icon}
                <span className="flex-1 leading-tight">{pillar.label}</span>
                {pillar.badge && <span className="text-xs bg-slate-700 text-slate-400 px-1 rounded">{pillar.badge}</span>}
                <span className="text-slate-600 text-xs">P{pillar.id}</span>
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {showCert && cert ? (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <Award size={20} className="text-amber-400" />
              <h2 className="text-lg font-bold">EIOS World-Class Certification</h2>
              <button onClick={() => setShowCert(false)} className="ml-auto text-xs text-slate-400 hover:text-white">← Back</button>
            </div>
            <CertificationPanel data={cert} />
          </div>
        ) : (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-5">
              {currentPillar?.icon && <span className="text-blue-400">{currentPillar.icon}</span>}
              <div>
                <h2 className="text-lg font-bold">P{selectedPillar}: {currentPillar?.label}</h2>
                <div className="text-xs text-slate-400">{currentPillar?.group} · {data?.name || ''}</div>
              </div>
              <button onClick={() => { setPillarData(prev => { const n = { ...prev }; delete n[selectedPillar]; return n; }); setTimeout(() => loadPillar(selectedPillar), 50); }} className="ml-auto text-slate-400 hover:text-white p-1" title="Refresh">
                <RefreshCw size={14} />
              </button>
            </div>
            {currentPillar && !currentPillar.route && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-sm text-blue-300 flex items-center gap-3">
                <Eye size={16} />
                <span>This pillar is served by: <strong>{LINKED_LABELS[selectedPillar]}</strong>. Navigate to that tab in the portal sidebar for the full experience.</span>
              </div>
            )}
            {error && <div className="bg-rose-500/10 border border-rose-500/30 rounded p-3 text-sm text-rose-300 mb-4">{error}</div>}
            {loading && !data ? (
              <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-blue-400" /></div>
            ) : data && !data._linked ? (
              <PillarContent pillarId={selectedPillar} data={data} onRefresh={() => { setPillarData(prev => { const n = { ...prev }; delete n[selectedPillar]; return n; }); setTimeout(() => loadPillar(selectedPillar), 50); }} />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
