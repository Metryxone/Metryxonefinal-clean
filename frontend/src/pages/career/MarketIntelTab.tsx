import { BRAND } from '@/design-system/tokens';
import React, { useState, useEffect } from 'react';
import {
  TrendingUp, BarChart2, Target, Brain, Zap, Star, ChevronRight,
  ArrowUp, ArrowDown, Minus, RefreshCw, Award, Layers, Search,
  Globe, Flame, Activity, CheckCircle, AlertTriangle, Lightbulb, Shield
} from 'lucide-react';
import { inferCompetencyLevels, detectCurrentRole } from '@/lib/careerIntelligence';



const careerFetch = async (method: string, path: string, body?: unknown) => {
  const r = await fetch(`/api/career${path}`, {
    method, headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
};

type SubTab = 'benchmark' | 'genome' | 'success';

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center">
      <p className="text-3xl font-black mb-1" style={{ color: color ?? BRAND.primary }}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mb-1">{sub}</p>}
      <p className="text-[12px] font-medium text-gray-600">{label}</p>
    </div>
  );
}

function BarRow({ label, value, maxVal = 100, color }: { label: string; value: number; maxVal?: number; color?: string }) {
  const pct = Math.round((value / maxVal) * 100);
  const fill = color ?? (pct >= 70 ? BRAND.green : pct >= 50 ? BRAND.orange : '#94a3b8');
  return (
    <div className="mb-2.5">
      <div className="flex justify-between text-[11px] mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-bold" style={{ color: fill }}>{value}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: fill }} />
      </div>
    </div>
  );
}

function BenchmarkSection({ profile }: { profile: unknown }) {
  const [market, setMarket] = useState<any>(null);
  const [skills, setSkills] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      careerFetch('GET', '/benchmark/market'),
      careerFetch('POST', '/benchmark/skills', { profile }),
    ]).then(([m, s]) => {
      setMarket(m);
      setSkills(s);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      {market && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Roles tracked" value={market.roles?.length ?? 0} sub="in market" color={BRAND.primary} />
            <StatCard label="Avg Demand" value={market.summary?.avgDemand ?? 0} sub="/ 100 index" color={BRAND.accent} />
            <StatCard label="Hot Roles" value={market.summary?.hotRoles ?? 0} sub="demand > 80" color={BRAND.orange} />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Globe size={15} style={{ color: BRAND.primary }} /> Market Role Demand</h3>
            <div className="space-y-1.5">
              {(market.roles ?? []).slice(0, 12).map((r: any) => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                  <div>
                    <p className="text-[13px] font-medium text-gray-800">{r.title}</p>
                    <p className="text-[10px] text-gray-400">{r.family} · {r.growth36mo}% 36-mo growth</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-[12px] font-bold" style={{ color: r.demandScore >= 80 ? BRAND.green : r.demandScore >= 60 ? BRAND.orange : '#94a3b8' }}>{r.demandScore}</p>
                      <p className="text-[9px] text-gray-400">demand</p>
                    </div>
                    {r.aiRisk && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold text-white" style={{ background: r.aiRisk === 'high' ? BRAND.red : r.aiRisk === 'medium' ? BRAND.orange : BRAND.green }}>
                        AI: {r.aiRisk}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {skills && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2"><BarChart2 size={15} style={{ color: BRAND.primary }} /> Your Skills vs Market</h3>
            <p className="text-[11px] text-gray-400 mb-4">{skills.aboveCount} of your skills are market-strong · {skills.coveragePct}% coverage</p>
            <div className="space-y-2">
              {(skills.comparisons ?? []).slice(0, 10).map((c: any) => (
                <div key={c.skill} className="flex items-center justify-between text-[12px]">
                  <span className="text-gray-700">{c.skill}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold" style={{ color: c.youHaveIt ? BRAND.green : '#94a3b8' }}>
                      {c.youHaveIt ? '✓' : '—'}
                    </span>
                    <span className="text-gray-400 w-8 text-right">{c.demandScore}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Zap size={15} style={{ color: BRAND.orange }} /> Top Opportunities</h3>
            <div className="space-y-3">
              {(skills.topOpportunities ?? []).slice(0, 6).map((o: any) => (
                <div key={o.skill} className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[12px] font-semibold text-gray-800">{o.skill}</p>
                    <p className="text-[10px] text-gray-400">Demand: {o.demandScore} · {o.roles?.length ?? 0} roles need it</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white shrink-0" style={{ background: o.priority === 'critical' ? BRAND.red : o.priority === 'high' ? BRAND.orange : BRAND.green }}>
                    {o.priority}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GenomeSection({ profile }: { profile: unknown }) {
  const [pathData, setPathData] = useState<any>(null);
  const [futureMap, setFutureMap] = useState<any>(null);
  const [gapSeq, setGapSeq] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      careerFetch('POST', '/genome/detect-path', { profile }),
      careerFetch('POST', '/genome/future-map', { profile }),
      careerFetch('POST', '/genome/gap-sequence', { profile }),
    ]).then(([p, f, g]) => {
      setPathData(p);
      setFutureMap(f);
      setGapSeq(g);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      {pathData && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2"><Layers size={15} style={{ color: BRAND.primary }} /> Detected Career Path</h3>
          <p className="text-[11px] text-gray-400 mb-4">Based on your competency profile and skill distribution</p>
          <div className="flex items-center gap-4 mb-4">
            <div className="text-center bg-blue-50 rounded-xl p-4 flex-1">
              <p className="text-lg font-black" style={{ color: BRAND.primary }}>{pathData.pathId?.toUpperCase() ?? '—'}</p>
              <p className="text-[11px] text-gray-500 mt-1">Career Path</p>
            </div>
            <div className="text-center bg-teal-50 rounded-xl p-4 flex-1">
              <p className="text-lg font-black" style={{ color: BRAND.accent }}>{pathData.topDomain ?? '—'}</p>
              <p className="text-[11px] text-gray-500 mt-1">Top Domain</p>
            </div>
          </div>
          {pathData.domainScores && (
            <div>
              <p className="text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">Domain Fit Scores</p>
              {Object.entries(pathData.domainScores as Record<string, number>).sort(([, a], [, b]) => b - a).slice(0, 5).map(([d, s]) => (
                <BarRow key={d} label={d} value={Math.round(s)} color={BRAND.primary} />
              ))}
            </div>
          )}
        </div>
      )}

      {futureMap && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2"><Flame size={15} style={{ color: BRAND.orange }} /> Hot Competencies</h3>
            <p className="text-[11px] text-gray-400 mb-3">High demand in the next 3 years</p>
            <div className="space-y-2">
              {(futureMap.hotCompetencies ?? []).length === 0 && (
                <p className="text-[11px] text-gray-400 italic">Build your profile to unlock hot competency data.</p>
              )}
              {(futureMap.hotCompetencies ?? []).slice(0, 6).map((c: any) => {
                const label = typeof c === 'string' ? c : (c.label ?? c.id ?? '');
                return (
                  <div key={label} className="flex items-center gap-2 text-[12px]">
                    <ArrowUp size={12} style={{ color: BRAND.green }} />
                    <span className="text-gray-700">{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2"><AlertTriangle size={15} style={{ color: BRAND.red }} /> Gaps to Close</h3>
            <p className="text-[11px] text-gray-400 mb-3">Competencies you currently lack</p>
            <div className="space-y-2">
              {(futureMap.priorityGaps ?? []).slice(0, 6).map((c: any) => {
                const label = typeof c === 'string' ? c : (c.label ?? c.competencyId ?? '');
                const key = typeof c === 'string' ? c : (c.competencyId ?? c.label ?? Math.random());
                return (
                  <div key={String(key)} className="flex items-center gap-2 text-[12px]">
                    <AlertTriangle size={12} style={{ color: BRAND.red }} />
                    <span className="text-gray-700">{label}</span>
                    {c.priority && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold text-white ml-auto" style={{ background: c.priority === 'high' ? BRAND.red : BRAND.orange }}>{c.priority}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {futureMap && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Activity size={15} style={{ color: BRAND.accent }} /> Future Readiness Score</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Your competency alignment with the market in 3 years</p>
            </div>
            <p className="text-4xl font-black" style={{ color: (futureMap.futureReadinessScore ?? 0) >= 70 ? BRAND.green : BRAND.orange }}>
              {futureMap.futureReadinessScore ?? '—'}
            </p>
          </div>
        </div>
      )}

      {gapSeq?.sequence?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Target size={15} style={{ color: BRAND.primary }} /> Recommended Gap Sequence</h3>
          <div className="space-y-3">
            {(gapSeq.sequence ?? []).slice(0, 6).map((g: any, i: number) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-6 h-6 rounded-full text-white text-[11px] font-bold flex items-center justify-center shrink-0" style={{ background: BRAND.primary }}>{i + 1}</div>
                <div>
                  <p className="font-semibold text-[12px] text-gray-800">{g.competency ?? g}</p>
                  {g.why && <p className="text-[11px] text-gray-500 mt-0.5">{g.why}</p>}
                  {g.action && <p className="text-[11px] text-gray-400 mt-0.5 italic">{g.action}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SuccessSection({ profile }: { profile: unknown }) {
  const [analysis, setAnalysis] = useState<any>(null);
  const [pattern, setPattern] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      careerFetch('POST', '/success/analyze', { profile }),
      careerFetch('POST', '/success/competency-pattern', { profile }),
    ]).then(([a, p]) => {
      setAnalysis(a);
      setPattern(p);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      {analysis && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2"><Star size={15} style={{ color: BRAND.orange }} /> Success Cluster</h3>
            <p className="text-2xl font-black mb-1" style={{ color: BRAND.primary }}>
              {typeof analysis.cluster === 'object' ? (analysis.cluster?.label ?? '—') : (analysis.cluster ?? '—')}
            </p>
            <div className="mb-3">
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-gray-500">Cluster Fit</span>
                <span className="font-bold" style={{ color: BRAND.accent }}>{analysis.clusterFit ?? 0}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${analysis.clusterFit ?? 0}%`, background: BRAND.accent }} />
              </div>
            </div>
            {analysis.alternativeClusters?.length > 0 && (
              <div>
                <p className="text-[11px] text-gray-400 mb-2">Also fits:</p>
                {analysis.alternativeClusters.slice(0, 2).map((c: any) => {
                  const clusterLabel = typeof c.cluster === 'object' ? (c.cluster?.label ?? c.cluster?.id ?? '') : (c.cluster ?? '');
                  const fitVal = c.fit ?? 0;
                  return (
                    <div key={clusterLabel} className="text-[11px] text-gray-600 mb-1">• {clusterLabel} ({fitVal}%)</div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2"><Award size={15} style={{ color: BRAND.green }} /> Leadership Maturity</h3>
            <p className="text-2xl font-black mb-1" style={{ color: BRAND.green }}>
              {analysis.leadershipMaturity?.label ?? analysis.leadershipMaturity?.level ?? '—'}
            </p>
            <p className="text-[12px] text-gray-500">{analysis.leadershipMaturity?.description}</p>
            {analysis.leadershipMaturity?.nextStep && (
              <p className="text-[11px] text-gray-400 italic mt-1">Next: {analysis.leadershipMaturity.nextStep}</p>
            )}
          </div>
        </div>
      )}

      {pattern && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Brain size={15} style={{ color: BRAND.primary }} /> Competency Pattern</h3>
            {Array.isArray(pattern.competencyPattern) ? (
              pattern.competencyPattern.length === 0
                ? <p className="text-[11px] text-gray-400 italic">Complete your profile to see your competency pattern.</p>
                : pattern.competencyPattern.map((c: any) => (
                    <BarRow key={c.id ?? c.label} label={c.label ?? c.id} value={Math.round(c.level ?? 0)} color={BRAND.primary} />
                  ))
            ) : (
              Object.entries((pattern.competencyPattern ?? {}) as Record<string, number>).map(([k, v]) => (
                <BarRow key={k} label={k} value={Math.round(v)} color={BRAND.primary} />
              ))
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><TrendingUp size={15} style={{ color: BRAND.green }} /> Success Metrics</h3>
            <div className="space-y-4">
              <div className="text-center bg-green-50 rounded-xl p-4">
                <p className="text-3xl font-black" style={{ color: BRAND.green }}>{pattern.successProbability ?? 0}%</p>
                <p className="text-[11px] text-gray-500 mt-1">Success Probability</p>
              </div>
              <div className="text-center bg-blue-50 rounded-xl p-4">
                <p className="text-3xl font-black" style={{ color: BRAND.primary }}>{pattern.futureAlignmentScore ?? 0}</p>
                <p className="text-[11px] text-gray-500 mt-1">Future Alignment Score</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {pattern?.strengthSignals?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><CheckCircle size={15} style={{ color: BRAND.green }} /> Your Strength Signals</h3>
          <div className="flex flex-wrap gap-2">
            {pattern.strengthSignals.map((s: string) => (
              <span key={s} className="text-[12px] px-3 py-1 rounded-full text-white font-medium" style={{ background: BRAND.green }}>{s}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function MarketIntelTab({ profile }: { profile: unknown; eiScore: number }) {
  const [subTab, setSubTab] = useState<SubTab>('benchmark');

  const inferredLevels = inferCompetencyLevels(profile as any);
  const currentRoleObj = detectCurrentRole(profile as any);
  const exp = ((profile as any)?.experience ?? []).reduce((s: number, e: any) => s + (Number(e.years) || 1), 0);
  const skills = [...((profile as any)?.skills?.technical ?? []), ...((profile as any)?.skills?.soft ?? [])];

  const intelProfile = {
    currentRole: currentRoleObj?.title ?? (profile as any)?.experience?.[0]?.title ?? 'Professional',
    targetRole: localStorage.getItem('mx-career-target-role') ?? '',
    yearsExperience: exp,
    skills,
    competencyLevels: inferredLevels,
    eiScore: Math.min(99, Math.round(((profile as any)?.competencyProfile?.completeness ?? 30) * 0.45 + Math.min(skills.length * 2.5, 30))),
    industry: 'engineering',
  };

  const tabs: { id: SubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'benchmark', label: 'Market Benchmark', icon: <BarChart2 size={14} /> },
    { id: 'genome', label: 'Career Genome', icon: <Layers size={14} /> },
    { id: 'success', label: 'Success Patterns', icon: <Star size={14} /> },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Globe size={20} style={{ color: BRAND.primary }} /> Market Intelligence
        </h2>
        <p className="text-sm text-gray-500 mt-1">Benchmark your skills, map your career genome, and identify your success cluster.</p>
      </div>

      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all"
            style={subTab === t.id ? { background: BRAND.primary, color: '#fff' } : { color: '#6b7280' }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {subTab === 'benchmark' && <BenchmarkSection profile={profile} />}
      {subTab === 'genome' && <GenomeSection profile={intelProfile} />}
      {subTab === 'success' && <SuccessSection profile={intelProfile} />}
    </div>
  );
}
