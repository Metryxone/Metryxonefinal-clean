import React, { useState, useEffect } from 'react';
import {
  Globe, TrendingUp, Zap, AlertTriangle, Shield, BarChart2,
  ArrowUp, ArrowDown, Activity, Brain, Target, Star, Layers,
  ChevronRight, Flame, Clock, RefreshCw, CheckCircle, Users
} from 'lucide-react';

const BRAND = { primary: '#344E86', accent: '#4ECDC4', green: '#2A9D8F', red: '#e63946', orange: '#f4a261' };

const careerFetch = async (method: string, path: string, body?: unknown) => {
  const r = await fetch(`/api/career${path}`, {
    method, headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
};

type SubTab = 'pulse' | 'skills' | 'forecast';

function RiskBadge({ level }: { level: string }) {
  const bg = level === 'high' ? BRAND.red : level === 'medium' ? BRAND.orange : BRAND.green;
  return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: bg }}>{level}</span>;
}

function PulseSection() {
  const [signals, setSignals] = useState<any>(null);
  const [hotRoles, setHotRoles] = useState<any>(null);
  const [emerging, setEmerging] = useState<any>(null);
  const [aiDisruption, setAiDisruption] = useState<any>(null);
  const [laborTrends, setLaborTrends] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      careerFetch('GET', '/workforce/signals'),
      careerFetch('GET', '/workforce/hot-roles'),
      careerFetch('GET', '/workforce/emerging-roles'),
      careerFetch('GET', '/workforce/ai-disruption'),
      careerFetch('GET', '/workforce/labor-trends'),
    ]).then(([s, h, e, a, l]) => {
      setSignals(s); setHotRoles(h); setEmerging(e); setAiDisruption(a); setLaborTrends(l);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      {signals?.summary && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Market Index', value: signals.summary.marketIndex ?? 0, color: BRAND.primary },
            { label: 'Demand Shift', value: signals.summary.demandShift ?? 0, color: BRAND.accent },
            { label: 'AI Disruption', value: signals.summary.aiDisruptionIndex ?? 0, color: BRAND.orange },
            { label: 'Hot Signals', value: signals.signals?.filter((s: any) => s.strength === 'high')?.length ?? 0, color: BRAND.green },
          ].map(m => (
            <div key={m.label} className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
              <p className="text-3xl font-black mb-1" style={{ color: m.color }}>{m.value}</p>
              <p className="text-[11px] text-gray-400">{m.label}</p>
            </div>
          ))}
        </div>
      )}

      {signals?.signals?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Activity size={15} style={{ color: BRAND.primary }} /> Market Signals</h3>
          <div className="space-y-3">
            {(signals.signals ?? []).slice(0, 8).map((s: any) => (
              <div key={s.id ?? s.signal} className="flex items-start justify-between gap-3 py-2 border-b border-gray-50">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: s.direction === 'rising' ? BRAND.green : s.direction === 'falling' ? BRAND.red : BRAND.orange }} />
                  <div>
                    <p className="font-semibold text-[13px] text-gray-800">{s.signal ?? s.title}</p>
                    {s.detail && <p className="text-[11px] text-gray-400 mt-0.5">{s.detail}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {s.direction === 'rising' && <ArrowUp size={13} style={{ color: BRAND.green }} />}
                  {s.direction === 'falling' && <ArrowDown size={13} style={{ color: BRAND.red }} />}
                  {s.direction === 'stable' && <div className="w-3 h-0.5 bg-gray-300 rounded" />}
                  <RiskBadge level={s.strength ?? 'medium'} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {hotRoles?.roles?.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><Flame size={15} style={{ color: BRAND.orange }} /> Hot Roles Now</h3>
            <div className="space-y-2.5">
              {hotRoles.roles.slice(0, 6).map((r: any) => (
                <div key={r.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-[12px] text-gray-800">{r.title}</p>
                    <p className="text-[10px] text-gray-400">{r.family}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ArrowUp size={12} style={{ color: BRAND.green }} />
                    <span className="font-bold text-[12px]" style={{ color: BRAND.green }}>{r.demandScore}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {emerging?.roles?.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><Star size={15} style={{ color: BRAND.accent }} /> Emerging Roles</h3>
            <div className="space-y-2.5">
              {emerging.roles.slice(0, 6).map((r: any) => (
                <div key={r.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-[12px] text-gray-800">{r.title}</p>
                    <div className="flex gap-1 mt-0.5">
                      {r.aiNative && <span className="text-[9px] px-1.5 py-0.5 rounded-full text-white font-bold" style={{ background: BRAND.accent }}>AI-Native</span>}
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-gray-500">{r.timeToMainstream ?? '2-3yr'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {aiDisruption && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Brain size={15} style={{ color: BRAND.primary }} /> AI Disruption Signals</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Tasks and skills being disrupted by AI automation</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black" style={{ color: aiDisruption.avgRisk >= 70 ? BRAND.red : aiDisruption.avgRisk >= 50 ? BRAND.orange : BRAND.green }}>{aiDisruption.avgRisk}%</p>
              <p className="text-[10px] text-gray-400">Avg Risk</p>
            </div>
          </div>
          <div className="space-y-2">
            {(aiDisruption.signals ?? []).slice(0, 6).map((s: any) => (
              <div key={s.task ?? s.id} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                <p className="text-[12px] text-gray-700">{s.task}</p>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${s.automationRisk ?? s.risk ?? 0}%`, background: s.automationRisk >= 70 ? BRAND.red : BRAND.orange }} />
                  </div>
                  <span className="text-[11px] font-bold w-8 text-right" style={{ color: BRAND.red }}>{s.automationRisk ?? s.risk ?? 0}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {laborTrends?.trends?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Globe size={15} style={{ color: BRAND.primary }} /> Labor Market Trends</h3>
          <div className="grid grid-cols-2 gap-3">
            {(laborTrends.highImpact ?? laborTrends.trends ?? []).slice(0, 4).map((t: any) => (
              <div key={t.id ?? t.trend} className="p-3 bg-gray-50 rounded-xl">
                <p className="font-semibold text-[12px] text-gray-800">{t.trend}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{t.description ?? t.detail}</p>
                {t.impact && <RiskBadge level={t.impact} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SkillEvolutionSection() {
  const [skillEvo, setSkillEvo] = useState<any>(null);
  const [safeRoles, setSafeRoles] = useState<any>(null);
  const [riskFlags, setRiskFlags] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      careerFetch('GET', '/workforce/skill-evolution'),
      careerFetch('GET', '/workforce/safe-roles'),
      careerFetch('GET', '/workforce/risk-flags'),
    ]).then(([s, sr, r]) => {
      setSkillEvo(s); setSafeRoles(sr); setRiskFlags(r);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      {skillEvo && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><ArrowUp size={15} style={{ color: BRAND.green }} /> Critical to Learn</h3>
              <div className="space-y-2.5">
                {(skillEvo.criticalToLearn ?? []).slice(0, 6).map((s: any) => (
                  <div key={s.skill ?? s} className="flex items-center justify-between">
                    <p className="text-[12px] text-gray-700">{s.skill ?? s}</p>
                    {s.urgency && <RiskBadge level={s.urgency} />}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><Star size={15} style={{ color: BRAND.orange }} /> Top Opportunities</h3>
              <div className="space-y-2.5">
                {(skillEvo.topOpportunities ?? []).slice(0, 6).map((s: any) => (
                  <div key={s.skill ?? s} className="flex items-center justify-between">
                    <p className="text-[12px] text-gray-700">{s.skill ?? s}</p>
                    {s.demandScore && <span className="text-[11px] font-bold" style={{ color: BRAND.green }}>{s.demandScore}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {skillEvo.byStatus && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><BarChart2 size={15} style={{ color: BRAND.primary }} /> Skill Status by Category</h3>
              {Object.entries(skillEvo.byStatus as Record<string, any[]>).map(([status, items]) => (
                <div key={status} className="mb-4">
                  <p className="text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">{status.replace('-', ' ')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {items.slice(0, 8).map((item: any) => (
                      <span key={item.skill ?? item} className="text-[11px] px-2 py-0.5 rounded-full border"
                        style={{
                          borderColor: status === 'rising' ? BRAND.green : status === 'declining' ? BRAND.red : '#e5e7eb',
                          color: status === 'rising' ? BRAND.green : status === 'declining' ? BRAND.red : '#6b7280',
                          background: status === 'rising' ? '#f0fdf4' : status === 'declining' ? '#fef2f2' : '#f9fafb',
                        }}>
                        {item.skill ?? item}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="grid grid-cols-2 gap-4">
        {safeRoles?.roles?.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><Shield size={15} style={{ color: BRAND.green }} /> AI-Safe Roles</h3>
            <div className="space-y-2">
              {safeRoles.roles.slice(0, 6).map((r: any) => (
                <div key={r.id} className="flex items-center gap-2 text-[12px]">
                  <CheckCircle size={12} style={{ color: BRAND.green }} />
                  <span className="text-gray-700">{r.title}</span>
                  {r.safetyScore && <span className="font-bold ml-auto" style={{ color: BRAND.green }}>{r.safetyScore}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {riskFlags?.roles?.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><AlertTriangle size={15} style={{ color: BRAND.red }} /> At-Risk Roles</h3>
            <div className="space-y-2">
              {riskFlags.roles.slice(0, 6).map((r: any) => (
                <div key={r.id} className="flex items-center gap-2 text-[12px]">
                  <AlertTriangle size={12} style={{ color: BRAND.red }} />
                  <span className="text-gray-700">{r.title}</span>
                  {r.riskScore && <span className="font-bold ml-auto" style={{ color: BRAND.red }}>{r.riskScore}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ForecastSection() {
  const [skillDemand, setSkillDemand] = useState<any>(null);
  const [roleClusters, setRoleClusters] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      careerFetch('GET', '/workforce/predictive/skill-demand'),
      careerFetch('GET', '/workforce/predictive/role-clusters'),
    ]).then(([s, r]) => {
      setSkillDemand(s); setRoleClusters(r);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      {skillDemand && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><TrendingUp size={15} style={{ color: BRAND.accent }} /> Predictive Skill Demand (36-Month Horizon)</h3>
          {skillDemand.criticalUpskill?.length > 0 && (
            <div className="mb-5 p-3 bg-red-50 rounded-xl border border-red-100">
              <p className="text-[11px] font-bold text-red-700 mb-2 uppercase tracking-wide">Act Now — Critical Upskill</p>
              <div className="flex flex-wrap gap-1.5">
                {skillDemand.criticalUpskill.map((s: any) => {
                  const name = typeof s === 'string' ? s : (s?.skill ?? '');
                  return (
                    <span key={name} className="text-[12px] px-2 py-0.5 rounded-full text-white font-semibold" style={{ background: BRAND.red }}>{name}</span>
                  );
                })}
              </div>
            </div>
          )}
          <div className="space-y-2">
            {(skillDemand.forecasts ?? []).slice(0, 12).map((f: any) => {
              const demand36 = f.forecast36mo ?? f.demandIn36mo ?? 0;
              const status = f.status ?? f.trend;
              const isRising = status === 'accelerating' || status === 'emerging' || status === 'rising';
              const isFalling = status === 'plateauing' || status === 'falling' || status === 'declining';
              return (
                <div key={f.skill} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                  <div>
                    <p className="font-medium text-[12px] text-gray-800">{f.skill}</p>
                    <p className="text-[10px] text-gray-400">{f.category ?? f.urgency ?? status ?? ''}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-[12px] font-bold" style={{ color: demand36 >= 80 ? BRAND.green : BRAND.orange }}>{demand36}</p>
                      <p className="text-[9px] text-gray-400">36-mo</p>
                    </div>
                    {isRising && <ArrowUp size={12} style={{ color: BRAND.green }} />}
                    {isFalling && <ArrowDown size={12} style={{ color: BRAND.red }} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {roleClusters && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Layers size={15} style={{ color: BRAND.primary }} /> Role Clusters & Convergence</h3>
          {roleClusters.actNow?.length > 0 && (
            <div className="mb-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
              <p className="text-[11px] font-bold text-amber-700 mb-2">High Convergence Clusters — Position Now</p>
              {roleClusters.actNow.map((c: any) => (
                <p key={c.name ?? c} className="text-[12px] font-semibold text-amber-800 mb-1">• {c.name ?? c}</p>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {(roleClusters.clusters ?? []).slice(0, 4).map((c: any) => (
              <div key={c.name} className="p-3 bg-gray-50 rounded-xl">
                <p className="font-semibold text-[12px] text-gray-800">{c.name}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 mb-2">{c.description ?? ''}</p>
                <div className="flex flex-wrap gap-1">
                  {(c.keySkills ?? c.skills ?? c.roles ?? []).slice(0, 3).map((s: string) => (
                    <span key={s} className="text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full">{s}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function WorkforceTab({ profile: _profile, eiScore: _eiScore }: { profile: unknown; eiScore: number }) {
  const [subTab, setSubTab] = useState<SubTab>('pulse');

  const tabs: { id: SubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'pulse', label: 'Market Pulse', icon: <Activity size={14} /> },
    { id: 'skills', label: 'Skill Evolution', icon: <TrendingUp size={14} /> },
    { id: 'forecast', label: 'Career Forecast', icon: <BarChart2 size={14} /> },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Globe size={20} style={{ color: BRAND.primary }} /> Workforce Intelligence
        </h2>
        <p className="text-sm text-gray-500 mt-1">Real-time market signals, skill evolution trends, and 36-month career forecasts.</p>
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

      {subTab === 'pulse' && <PulseSection />}
      {subTab === 'skills' && <SkillEvolutionSection />}
      {subTab === 'forecast' && <ForecastSection />}
    </div>
  );
}
