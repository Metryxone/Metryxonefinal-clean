import { BRAND } from '@/design-system/tokens';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Zap, TrendingUp, Activity, Clock, Target, BarChart2, Brain,
  ChevronRight, ArrowUp, ArrowDown, Minus, Plus, RefreshCw,
  CheckCircle, AlertTriangle, Star, Calendar, Layers, Flag
} from 'lucide-react';
import { inferCompetencyLevels, detectCurrentRole } from '@/lib/careerIntelligence';



const careerFetch = async (method: string, path: string, body?: unknown) => {
  const r = await fetch(`/api/career${path}`, {
    method, headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
};

type SubTab = 'velocity' | 'trajectory' | 'memory';

function VelocityGauge({ value, band, label }: { value: number; band: string; label: string }) {
  const color = value >= 70 ? BRAND.green : value >= 50 ? BRAND.accent : value >= 30 ? BRAND.orange : BRAND.red;
  const deg = Math.round((value / 100) * 180) - 90;
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-20 overflow-hidden mb-2">
        <div className="absolute inset-0 rounded-t-full border-8 border-gray-100" style={{ borderBottomColor: 'transparent', borderLeftColor: 'transparent', borderRightColor: 'transparent' }} />
        <div className="absolute inset-0 rounded-t-full border-8 border-transparent" style={{
          borderTopColor: color, borderLeftColor: value > 25 ? color : 'transparent', borderRightColor: value > 75 ? color : 'transparent',
        }} />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
          <p className="text-3xl font-black" style={{ color }}>{value}</p>
          <p className="text-[10px] text-gray-400">/ 100</p>
        </div>
      </div>
      <p className="font-bold text-[14px]" style={{ color }}>{band}</p>
      <p className="text-[11px] text-gray-500">{label}</p>
    </div>
  );
}

function MiniSparkline({ points }: { points: number[] }) {
  if (!points.length) return null;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const w = 120; const h = 40;
  const pts = points.map((v, i) => `${(i / (points.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={BRAND.accent} strokeWidth={2} strokeLinejoin="round" />
      {points.map((v, i) => (
        <circle key={i} cx={(i / (points.length - 1)) * w} cy={h - ((v - min) / range) * h} r={3} fill={BRAND.accent} />
      ))}
    </svg>
  );
}

function VelocitySection({ profile }: { profile: unknown }) {
  const [velocity, setVelocity] = useState<any>(null);
  const [projection, setProjection] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      careerFetch('POST', '/velocity/compute', { profile }),
      careerFetch('POST', '/velocity/projection', { profile }),
    ]).then(([v, p]) => {
      setVelocity(v);
      setProjection(p);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" /></div>;

  if (!velocity) return <div className="text-center text-gray-400 py-12">Build your profile to unlock velocity tracking.</div>;

  const projPts = (projection?.projectionPoints ?? []).map((p: any) => p.ei ?? 0);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="font-semibold text-gray-800 text-lg">Career Velocity</h3>
            <p className="text-[12px] text-gray-400 mt-0.5">How fast you are growing relative to your experience and potential</p>
          </div>
          <VelocityGauge value={velocity.overallVelocity ?? 0} band={velocity.velocityBand ?? '—'} label={velocity.velocityBandLabel ?? ''} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Growth Acceleration', value: velocity.growthAcceleration ?? 0, color: BRAND.green },
            { label: 'Adaptability', value: velocity.adaptabilityScore ?? 0, color: BRAND.accent },
            { label: 'Execution Consistency', value: velocity.executionConsistency ?? 0, color: BRAND.primary },
          ].map(m => (
            <div key={m.label} className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-black mb-1" style={{ color: m.color }}>{m.value}</p>
              <p className="text-[11px] text-gray-500">{m.label}</p>
            </div>
          ))}
        </div>
      </div>

      {projection && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2"><TrendingUp size={15} style={{ color: BRAND.accent }} /> EI Projection</h3>
          <p className="text-[11px] text-gray-400 mb-4">Forecast of your Employability Index over the next 36 months</p>
          <div className="flex items-end gap-4">
            <MiniSparkline points={projPts.slice(0, 13)} />
            <div className="text-right">
              <p className="text-2xl font-black" style={{ color: BRAND.accent }}>{projPts[projPts.length - 1] ?? 0}</p>
              <p className="text-[11px] text-gray-400">Projected EI (36mo)</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {(projection.projectionPoints ?? []).filter((_: any, i: number) => [2, 5, 8, 11].includes(i)).slice(0, 3).map((p: any, i: number) => (
              <div key={i} className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="font-bold text-[14px]" style={{ color: BRAND.primary }}>{p.ei ?? 0}</p>
                <p className="text-[10px] text-gray-400">{p.label ?? `Month ${(i + 1) * 9}`}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {velocity.momentumDrivers?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><Zap size={15} style={{ color: BRAND.orange }} /> Momentum Drivers</h3>
          <div className="flex flex-wrap gap-2">
            {velocity.momentumDrivers.map((d: string) => (
              <span key={d} className="text-[12px] px-3 py-1 rounded-full text-white font-medium" style={{ background: BRAND.green }}>{d}</span>
            ))}
          </div>
        </div>
      )}

      {velocity.dragFactors?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><AlertTriangle size={15} style={{ color: BRAND.red }} /> Drag Factors</h3>
          <div className="flex flex-wrap gap-2">
            {velocity.dragFactors.map((d: string) => (
              <span key={d} className="text-[12px] px-3 py-1 rounded-full text-white font-medium" style={{ background: BRAND.orange }}>{d}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TrajectorySection({ profile, userId }: { profile: unknown; userId: string }) {
  const [traj, setTraj] = useState<any>(null);
  const [probability, setProbability] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState('');
  const [checking, setChecking] = useState(false);

  const competencyLevels = inferCompetencyLevels(profile as any);
  const skills = [...((profile as any)?.skills?.technical ?? []), ...((profile as any)?.skills?.soft ?? [])];
  const eiScore = Math.min(99, Math.round(((profile as any)?.competencyProfile?.completeness ?? 30) * 0.45 + Math.min(skills.length * 2.5, 30)));

  useEffect(() => {
    careerFetch('POST', '/trajectory/compute', { profile }).then(d => {
      setTraj(d);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const checkProbability = async (roleId: string) => {
    setChecking(true);
    const d = await careerFetch('POST', '/trajectory/probability', { competencyLevels, eiScore, targetRoleId: roleId });
    setProbability(d);
    setChecking(false);
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      {traj && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
              <p className="text-3xl font-black mb-1" style={{ color: BRAND.primary }}>{traj.currentEI ?? 0}</p>
              <p className="text-[11px] text-gray-400">Current EI Score</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
              <p className="text-[14px] font-bold mb-1 truncate" style={{ color: BRAND.accent }}>
                {typeof traj.forecastedRole12mo === 'object' ? (traj.forecastedRole12mo?.title ?? '—') : (traj.forecastedRole12mo ?? '—')}
              </p>
              <p className="text-[11px] text-gray-400">12-Month Target</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
              <p className="text-[14px] font-bold mb-1 truncate" style={{ color: BRAND.green }}>
                {typeof traj.forecastedRole36mo === 'object' ? (traj.forecastedRole36mo?.title ?? '—') : (traj.forecastedRole36mo ?? '—')}
              </p>
              <p className="text-[11px] text-gray-400">36-Month Target</p>
            </div>
          </div>

          {traj.adjacentRoles?.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Layers size={15} style={{ color: BRAND.primary }} /> Adjacent Roles You Can Reach</h3>
              <div className="grid grid-cols-2 gap-3">
                {(traj.adjacentRoles ?? []).slice(0, 6).map((r: any) => {
                  const roleId = r.roleId ?? r.id ?? r.title;
                  return (
                  <div key={roleId} className="p-3 bg-gray-50 rounded-xl flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[13px] text-gray-800">{r.title}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{r.etaMonths}mo · {r.switchabilityScore ?? r.switchability ?? 0}% switch</p>
                    </div>
                    <button
                      onClick={() => { setSelectedRole(roleId); checkProbability(roleId); }}
                      className="text-[11px] px-2 py-1 rounded-lg text-white shrink-0"
                      style={{ background: BRAND.primary }}>
                      Check
                    </button>
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          {traj.trajectorySteps?.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Activity size={15} style={{ color: BRAND.accent }} /> Trajectory Timeline</h3>
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-100" />
                {(traj.trajectorySteps ?? []).map((s: any, i: number) => (
                  <div key={i} className="flex gap-4 mb-4 relative pl-10">
                    <div className="absolute left-2 top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-sm" style={{ background: i === 0 ? BRAND.primary : BRAND.accent }} />
                    <div>
                      <p className="font-semibold text-[13px] text-gray-800">{s.predictedRoleTitle}</p>
                      <p className="text-[11px] text-gray-400">{s.label} · {s.confidence}% confidence</p>
                      {s.keyMilestones?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {s.keyMilestones.map((m: string) => (
                            <span key={m} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">{m}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {probability && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Target size={15} style={{ color: BRAND.green }} /> Transition Probability: {probability.title}</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <p className="text-3xl font-black" style={{ color: probability.probability >= 70 ? BRAND.green : probability.probability >= 50 ? BRAND.orange : BRAND.red }}>{probability.probability}%</p>
              <p className="text-[11px] text-gray-400">Success Probability</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-black" style={{ color: BRAND.accent }}>{probability.etaMonths}mo</p>
              <p className="text-[11px] text-gray-400">Estimated Timeline</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-black" style={{ color: BRAND.primary }}>{probability.switchability ?? 0}</p>
              <p className="text-[11px] text-gray-400">Switchability</p>
            </div>
          </div>
          {probability.barriers?.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-gray-500 mb-2">Key Barriers</p>
              {probability.barriers.map((b: string) => (
                <div key={b} className="flex items-center gap-2 text-[12px] text-gray-600 mb-1">
                  <AlertTriangle size={11} style={{ color: BRAND.orange }} />{b}
                </div>
              ))}
            </div>
          )}
          {probability.accelerators?.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] font-semibold text-gray-500 mb-2">Accelerators</p>
              {probability.accelerators.map((a: string) => (
                <div key={a} className="flex items-center gap-2 text-[12px] text-gray-600 mb-1">
                  <Zap size={11} style={{ color: BRAND.green }} />{a}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MemorySection({ profile, userId }: { profile: unknown; userId: string }) {
  const [snapshots, setSnapshots] = useState<any>(null);
  const [evolution, setEvolution] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedNow, setSavedNow] = useState(false);

  const load = useCallback(() => {
    if (!userId) { setLoading(false); return; }
    Promise.all([
      careerFetch('GET', `/memory/summary?userId=${userId}`),
      careerFetch('GET', `/memory/evolution?userId=${userId}`),
    ]).then(([s, e]) => {
      setSnapshots(s);
      setEvolution(e);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const saveSnapshot = async () => {
    if (!userId || !profile) return;
    setSaving(true);
    await careerFetch('POST', '/memory/snapshot', { userId, profile });
    setSaving(false);
    setSavedNow(true);
    setTimeout(() => setSavedNow(false), 3000);
    load();
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] text-gray-500">Capture and track your career progress over time.</p>
        </div>
        <button onClick={saveSnapshot} disabled={saving || savedNow}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-white transition-all disabled:opacity-50"
          style={{ background: savedNow ? BRAND.green : BRAND.primary }}>
          {saving ? <RefreshCw size={13} className="animate-spin" /> : savedNow ? <CheckCircle size={13} /> : <Plus size={13} />}
          {saving ? 'Saving…' : savedNow ? 'Saved!' : 'Save Snapshot'}
        </button>
      </div>

      {snapshots && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <p className="text-3xl font-black mb-1" style={{ color: BRAND.primary }}>{snapshots.snapshots ?? 0}</p>
            <p className="text-[11px] text-gray-400">Snapshots</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <p className="text-3xl font-black mb-1" style={{ color: BRAND.accent }}>{snapshots.interventions ?? 0}</p>
            <p className="text-[11px] text-gray-400">Interventions logged</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <p className="text-xl font-black mb-1 truncate" style={{ color: BRAND.green }}>
              {snapshots.firstSnapshot ? new Date(snapshots.firstSnapshot).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) : '—'}
            </p>
            <p className="text-[11px] text-gray-400">Since</p>
          </div>
        </div>
      )}

      {evolution?.longitudinal && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Activity size={15} style={{ color: BRAND.accent }} /> Longitudinal Growth</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-[11px] text-gray-400 mb-1">EI Delta</p>
              <p className="text-2xl font-black" style={{ color: evolution.longitudinal.eiDelta > 0 ? BRAND.green : evolution.longitudinal.eiDelta < 0 ? BRAND.red : BRAND.accent }}>
                {evolution.longitudinal.eiDelta > 0 ? '+' : ''}{evolution.longitudinal.eiDelta ?? 0}
              </p>
              <p className="text-[11px] text-gray-500 mt-1 capitalize">{evolution.longitudinal.trend ?? 'stable'}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-[11px] text-gray-400 mb-1">Avg Gain / Month</p>
              <p className="text-2xl font-black" style={{ color: BRAND.primary }}>{evolution.longitudinal.avgGainPerMonth ?? 0}</p>
              <p className="text-[11px] text-gray-500 mt-1">EI points / month</p>
            </div>
          </div>
          {evolution.longitudinal.growing?.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-semibold text-gray-500 mb-2">Growing Competencies</p>
              <div className="flex flex-wrap gap-1">
                {evolution.longitudinal.growing.map((c: string) => (
                  <span key={c} className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700">{c}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {evolution?.milestones?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Flag size={15} style={{ color: BRAND.orange }} /> Milestones</h3>
          <div className="space-y-3">
            {evolution.milestones.map((m: any, i: number) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl">
                <Star size={14} style={{ color: BRAND.orange }} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[12px] text-gray-800">{m.label ?? m.type}</p>
                  {m.detail && <p className="text-[11px] text-gray-500 mt-0.5">{m.detail}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(!snapshots?.snapshots || snapshots.snapshots === 0) && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 text-center">
          <Brain size={32} className="mx-auto mb-3" style={{ color: BRAND.primary }} />
          <p className="font-semibold text-gray-800 mb-1">No snapshots yet</p>
          <p className="text-[12px] text-gray-500 mb-4">Save your first snapshot to start tracking your career growth over time.</p>
          <button onClick={saveSnapshot} disabled={saving}
            className="px-5 py-2 rounded-xl text-[13px] font-semibold text-white"
            style={{ background: BRAND.primary }}>
            {saving ? 'Saving…' : 'Save first snapshot'}
          </button>
        </div>
      )}
    </div>
  );
}

export function CareerVelocityTab({ profile, eiScore, userId }: { profile: unknown; eiScore: number; userId: string }) {
  const [subTab, setSubTab] = useState<SubTab>('velocity');

  const inferredLevels = inferCompetencyLevels(profile as any);
  const currentRoleObj = detectCurrentRole(profile as any);
  const skills = [...((profile as any)?.skills?.technical ?? []), ...((profile as any)?.skills?.soft ?? [])];
  const exp = ((profile as any)?.experience ?? []).reduce((s: number, e: any) => s + (Number(e.years) || 1), 0);

  const intelProfile = {
    currentRole: currentRoleObj?.title ?? 'Professional',
    targetRole: localStorage.getItem('mx-career-target-role') ?? '',
    yearsExperience: exp,
    skills,
    competencyLevels: inferredLevels,
    eiScore,
    industry: 'engineering',
  };

  const tabs: { id: SubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'velocity', label: 'Career Velocity', icon: <Zap size={14} /> },
    { id: 'trajectory', label: 'Trajectory', icon: <TrendingUp size={14} /> },
    { id: 'memory', label: 'Behavioral Memory', icon: <Brain size={14} /> },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Zap size={20} style={{ color: BRAND.primary }} /> Career Velocity & Trajectory
        </h2>
        <p className="text-sm text-gray-500 mt-1">Measure your growth momentum, forecast your trajectory, and track your behavioral evolution.</p>
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

      {subTab === 'velocity' && <VelocitySection profile={intelProfile} />}
      {subTab === 'trajectory' && <TrajectorySection profile={intelProfile} userId={userId} />}
      {subTab === 'memory' && <MemorySection profile={profile} userId={userId} />}
    </div>
  );
}
