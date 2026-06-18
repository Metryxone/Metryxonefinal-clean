import React, { useState, useEffect } from 'react';
import {
  Lightbulb, Search, ArrowRight, TrendingUp, DollarSign,
  Clock, Target, Zap, RefreshCw, AlertCircle, CheckCircle, Award
} from 'lucide-react';

const P = {
  primary: '#4F46E5', green: '#10B981', orange: '#F59E0B',
  accent: '#7C3AED', red: '#EF4444', slate: '#64748B',
};

interface Role { id: number; title: string; domain: string; demand_score: number; salary_p50: number }

interface WhatIfResult {
  scenario: {
    from: { id: number; title: string; domain: string } | null;
    to: { id: number; title: string; domain: string };
  };
  transition_analysis: {
    path_hops: number | null;
    salary_delta_pct: number | null;
    target_salary_p50: number;
    target_salary_p75: number;
    demand_score: number;
    growth_36mo: number;
    months_to_ready: number;
    transition_probability: number;
    segment: string;
  };
  current_readiness: { overall: number; skills: number; behaviour: number; market: number };
  top_skill_gaps: Array<{ skill: string; required: number; weight: number }>;
  recommendation: string;
}

const REC_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  strong_candidate: { label: 'Strong Candidate', color: P.green,   icon: <CheckCircle size={14} /> },
  near_ready:       { label: 'Near Ready',        color: P.primary, icon: <Target size={14} /> },
  developing:       { label: 'Developing',         color: P.orange,  icon: <TrendingUp size={14} /> },
  early_stage:      { label: 'Early Stage',        color: P.red,     icon: <AlertCircle size={14} /> },
};

function fmtSalary(n: number) {
  return n >= 10000000 ? `₹${(n / 10000000).toFixed(1)} Cr` : `₹${(n / 100000).toFixed(1)} L`;
}

function ReadinessGauge({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="text-center">
      <div className="relative w-14 h-14 mx-auto mb-1">
        <svg viewBox="0 0 48 48" className="w-full h-full -rotate-90">
          <circle cx="24" cy="24" r="20" fill="none" stroke="#e2e8f0" strokeWidth="4" />
          <circle cx="24" cy="24" r="20" fill="none" stroke={color} strokeWidth="4"
            strokeDasharray={`${(value / 100) * 125.6} 125.6`}
            strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold" style={{ color }}>{value}</span>
        </div>
      </div>
      <div className="text-[9px] text-gray-400 font-medium">{label}</div>
    </div>
  );
}

export function WhatIfAnalysis({ userId }: { userId: string }) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [fromId, setFromId] = useState<number | null>(null);
  const [toId, setToId] = useState<number | null>(null);
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [error, setError] = useState('');
  const [fromSearch, setFromSearch] = useState('');
  const [toSearch, setToSearch] = useState('');
  const [showFromList, setShowFromList] = useState(false);
  const [showToList, setShowToList] = useState(false);

  useEffect(() => {
    fetch('/api/career/roles?limit=200')
      .then(r => r.json())
      .then(d => { if (d.roles) setRoles(d.roles); })
      .catch(() => {})
      .finally(() => setRolesLoading(false));
  }, []);

  const filteredFrom = roles.filter(r =>
    fromSearch ? r.title.toLowerCase().includes(fromSearch.toLowerCase()) ||
      r.domain.toLowerCase().includes(fromSearch.toLowerCase()) : true
  ).slice(0, 8);

  const filteredTo = roles.filter(r =>
    toSearch ? r.title.toLowerCase().includes(toSearch.toLowerCase()) ||
      r.domain.toLowerCase().includes(toSearch.toLowerCase()) : true
  ).slice(0, 8);

  async function runAnalysis() {
    if (!toId) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const params = new URLSearchParams({ to_role_id: String(toId), user_id: userId });
      if (fromId) params.set('from_role_id', String(fromId));
      const r = await fetch(`/api/career/pi/what-if?${params}`);
      const d = await r.json();
      if (d.ok) setResult(d);
      else setError(d.error ?? 'Analysis failed');
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  }

  const fromRole = roles.find(r => r.id === fromId);
  const toRole   = roles.find(r => r.id === toId);
  const recMeta  = result ? (REC_META[result.recommendation] ?? REC_META.early_stage) : null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
          <Lightbulb size={16} style={{ color: P.orange }} /> What-If Analysis
        </h2>
        <p className="text-[11px] text-gray-400 mt-0.5">Explore any career transition scenario instantly</p>
      </div>

      {/* Input row */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
          {/* From role */}
          <div className="relative">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">From Role (optional)</label>
            <div className="relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={fromRole ? fromRole.title : "Current role…"}
                value={fromRole ? fromRole.title : fromSearch}
                onChange={e => { setFromSearch(e.target.value); setFromId(null); setShowFromList(true); }}
                onFocus={() => setShowFromList(true)}
                className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-indigo-400"
              />
            </div>
            {showFromList && filteredFrom.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden max-h-44 overflow-y-auto">
                <button className="w-full px-3 py-2 text-left text-xs text-gray-400 hover:bg-gray-50 border-b border-gray-100"
                  onClick={() => { setFromId(null); setFromSearch(''); setShowFromList(false); }}>
                  None (no source role)
                </button>
                {filteredFrom.map(r => (
                  <button key={r.id} onClick={() => { setFromId(r.id); setFromSearch(''); setShowFromList(false); }}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0">
                    <div className="text-xs font-medium text-gray-800">{r.title}</div>
                    <div className="text-[10px] text-gray-400">{r.domain}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* To role */}
          <div className="relative">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Target Role *</label>
            <div className="relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={toRole ? toRole.title : "Search target role…"}
                value={toRole ? toRole.title : toSearch}
                onChange={e => { setToSearch(e.target.value); setToId(null); setShowToList(true); }}
                onFocus={() => setShowToList(true)}
                className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-indigo-400"
              />
            </div>
            {showToList && filteredTo.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden max-h-44 overflow-y-auto">
                {filteredTo.map(r => (
                  <button key={r.id} onClick={() => { setToId(r.id); setToSearch(''); setShowToList(false); }}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0">
                    <div className="text-xs font-medium text-gray-800">{r.title}</div>
                    <div className="text-[10px] text-gray-400">{r.domain} · Demand {r.demand_score}/100</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={runAnalysis}
          disabled={!toId || loading || rolesLoading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
          style={{ background: toId ? P.primary : '#e2e8f0', cursor: toId ? 'pointer' : 'not-allowed' }}>
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <Lightbulb size={14} />}
          {loading ? 'Analysing…' : 'Run Analysis'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
          <AlertCircle size={14} className="inline mr-1.5 text-red-400" />
          <span className="text-xs text-red-600">{error}</span>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-3">
          {/* Scenario header */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 flex-wrap">
              {result.scenario.from && (
                <>
                  <div className="text-sm font-semibold text-gray-700">{result.scenario.from.title}</div>
                  <ArrowRight size={14} style={{ color: P.slate }} />
                </>
              )}
              <div className="text-sm font-bold" style={{ color: P.primary }}>{result.scenario.to.title}</div>
              {recMeta && (
                <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                  style={{ background: recMeta.color + '15', color: recMeta.color }}>
                  {recMeta.icon}
                  <span className="text-xs font-semibold">{recMeta.label}</span>
                </div>
              )}
            </div>
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
              <DollarSign size={14} className="mx-auto mb-1" style={{ color: P.green }} />
              <div className="text-[10px] text-gray-400 mb-1">Target Salary</div>
              <div className="text-sm font-bold text-gray-800">{fmtSalary(result.transition_analysis.target_salary_p50)}</div>
              <div className="text-[10px] text-gray-400">median</div>
              {result.transition_analysis.salary_delta_pct !== null && (
                <div className="text-[11px] font-semibold mt-1"
                  style={{ color: result.transition_analysis.salary_delta_pct >= 0 ? P.green : P.red }}>
                  {result.transition_analysis.salary_delta_pct >= 0 ? '+' : ''}{result.transition_analysis.salary_delta_pct}%
                </div>
              )}
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
              <Clock size={14} className="mx-auto mb-1" style={{ color: P.orange }} />
              <div className="text-[10px] text-gray-400 mb-1">Months to Ready</div>
              <div className="text-2xl font-bold" style={{ color: P.orange }}>
                {result.transition_analysis.months_to_ready}
              </div>
              <div className="text-[10px] text-gray-400">at consistent effort</div>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
              <Zap size={14} className="mx-auto mb-1" style={{ color: P.accent }} />
              <div className="text-[10px] text-gray-400 mb-1">Demand Score</div>
              <div className="text-2xl font-bold" style={{ color: P.accent }}>
                {result.transition_analysis.demand_score}
              </div>
              <div className="text-[10px] text-gray-400">out of 100</div>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
              <TrendingUp size={14} className="mx-auto mb-1" style={{ color: P.green }} />
              <div className="text-[10px] text-gray-400 mb-1">36mo Growth</div>
              <div className="text-2xl font-bold" style={{ color: P.green }}>
                +{result.transition_analysis.growth_36mo}%
              </div>
              <div className="text-[10px] text-gray-400">market demand</div>
            </div>
          </div>

          {/* Readiness gauges */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-700 mb-4">Your Current Readiness</h3>
            <div className="grid grid-cols-4 gap-2">
              <ReadinessGauge value={result.current_readiness.overall}   label="Overall"   color={P.primary} />
              <ReadinessGauge value={result.current_readiness.skills}    label="Skills"    color={P.green} />
              <ReadinessGauge value={result.current_readiness.behaviour} label="Behaviour" color={P.accent} />
              <ReadinessGauge value={result.current_readiness.market}    label="Market"    color={P.orange} />
            </div>
            <div className="mt-4">
              <div className="text-[10px] text-gray-400 mb-2 font-semibold uppercase tracking-wide">Transition probability</div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full"
                  style={{ width: `${result.transition_analysis.transition_probability * 100}%`, background: P.primary }} />
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                {Math.round(result.transition_analysis.transition_probability * 100)}% — {result.transition_analysis.path_hops !== null ? `${result.transition_analysis.path_hops} hop${result.transition_analysis.path_hops !== 1 ? 's' : ''} on career graph` : 'direct transition'}
              </div>
            </div>
          </div>

          {/* Skill gaps */}
          {result.top_skill_gaps.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <h3 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                <Target size={12} style={{ color: P.orange }} /> Top Skills to Develop
              </h3>
              <div className="space-y-2">
                {result.top_skill_gaps.map(gap => (
                  <div key={gap.skill} className="flex items-center gap-3">
                    <span className="text-[11px] text-gray-700 w-32 shrink-0 truncate">{gap.skill}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(gap.required / 5) * 100}%`, background: P.orange }} />
                    </div>
                    <span className="text-[10px] text-gray-400 w-10 text-right">L{gap.required}/5</span>
                    <span className="text-[10px] font-medium w-10 text-right"
                      style={{ color: gap.weight > 0.5 ? P.red : gap.weight > 0.3 ? P.orange : P.slate }}>
                      {Math.round(gap.weight * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
