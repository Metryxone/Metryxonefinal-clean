import { BRAND } from '@/design-system/tokens';
/**
 * FRPDesignPanel — Future Readiness Platform Admin
 * Super Admin panel: 7 tabs
 *   Overview · Skill Library · AI Impact · Automation Risk · Industry Forecast · Role Evolution · Analytics
 */
import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Plus, Search, Edit3, Trash2, AlertTriangle, TrendingUp, CheckCircle, Save, X } from 'lucide-react';



function authHeader(): Record<string, string> {
  const t = localStorage.getItem('metryx_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', ...authHeader(), ...(opts?.headers || {}) } });
  return res.json();
}

function Spinner() {
  return <div className="flex items-center justify-center py-10"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: BRAND.primary, borderTopColor: 'transparent' }} /></div>;
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: BRAND.border }}>
      <p className="text-2xl font-bold" style={{ color: color ?? BRAND.primary }}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

// ── Overview Tab ───────────────────────────────────────────────────────────
function OverviewTab() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    const r = await apiFetch(`/api/admin/frp/stats${refresh ? '?refresh=1' : ''}`);
    setStats(r);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;
  if (stats?.error) return <p className="text-sm text-red-500 p-4">{stats.error}</p>;
  if (!stats || stats.__flagOff) return <p className="text-sm text-amber-600 p-4">FF_FUTURE_READINESS is off — enable flag and restart backend.</p>;

  const dist: any[] = stats.band_distribution ?? [];
  const BAND_COLOR: Record<string, string> = { pioneering:'#43C59E', resilient:'#45AAF2', capable:'#6C63FF', developing:'#F7B731', emerging:'#FC5C65' };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Active Skills" value={stats.skill_count ?? 0} color={BRAND.primary} />
        <StatCard label="Roles Profiled" value={stats.role_count ?? 0} color={BRAND.blue} />
        <StatCard label="Industries" value={stats.industry_count ?? 0} color={BRAND.green} />
        <StatCard label="Evolution Paths" value={stats.evolution_count ?? 0} color={BRAND.amber} />
        <StatCard label="Users Assessed" value={stats.users_assessed ?? 0} color={BRAND.accent} />
        <StatCard label="Avg FRI (30d)" value={stats.avg_fri_30d ?? 0} color={BRAND.primary} />
      </div>

      {dist.length > 0 && (
        <div className="rounded-xl border p-5" style={{ borderColor: BRAND.border }}>
          <h4 className="text-sm font-semibold text-gray-700 mb-4">Band Distribution (last 30 days)</h4>
          <div className="space-y-2">
            {dist.map((d: any) => {
              const color = BAND_COLOR[d.band] ?? BRAND.primary;
              const max = Math.max(...dist.map((x: any) => Number(x.cnt)));
              const pct = max > 0 ? (Number(d.cnt) / max) * 100 : 0;
              return (
                <div key={d.band} className="flex items-center gap-3">
                  <span className="text-xs capitalize text-gray-600 w-20 shrink-0">{d.band}</span>
                  <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                  <span className="text-xs font-semibold text-gray-700 w-8 text-right">{d.cnt}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button onClick={() => load(true)} className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border"
        style={{ borderColor: BRAND.primary, color: BRAND.primary }}>
        <RefreshCw size={13} /> Refresh Stats
      </button>
    </div>
  );
}

// ── Skill Library Tab ──────────────────────────────────────────────────────
function SkillLibraryTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [domain, setDomain] = useState('all');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<any>({ skill_code:'', name:'', description:'', domain:'Human Intelligence', cluster:'', durability_score:75, human_quotient:70, data_intensity:30, emergence_horizon:'established', demand_trend:'stable' });

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ search, domain });
    const r = await apiFetch(`/api/admin/frp/skill-library?${params}`);
    setItems(r.items ?? []);
    setLoading(false);
  }, [search, domain]);

  useEffect(() => { load(); }, [load]);

  const domains = ['all', ...Array.from(new Set(items.map((i: any) => i.domain as string)))];

  const create = async () => {
    await apiFetch('/api/admin/frp/skill-library', { method:'POST', body: JSON.stringify(form) });
    setCreating(false);
    load();
  };

  const deactivate = async (id: number) => {
    if (!confirm('Deactivate this skill?')) return;
    await apiFetch(`/api/admin/frp/skill-library/${id}`, { method:'DELETE' });
    load();
  };

  const IMPACT_COLOR: Record<string, string> = { low:'#43C59E', moderate:'#F7B731', high:'#FC5C65', transformative:'#FF6584' };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search skills…"
            className="w-full text-xs border rounded-lg pl-7 pr-3 py-2 outline-none" style={{ borderColor: BRAND.border }} />
        </div>
        <select value={domain} onChange={e => setDomain(e.target.value)}
          className="text-xs border rounded-lg px-3 py-2 outline-none" style={{ borderColor: BRAND.border }}>
          {domains.map(d => <option key={d} value={d}>{d === 'all' ? 'All Domains' : d}</option>)}
        </select>
        <button onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg text-white"
          style={{ backgroundColor: BRAND.primary }}>
          <Plus size={12} /> Add Skill
        </button>
      </div>

      {creating && (
        <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: BRAND.primary, backgroundColor: `${BRAND.primary}04` }}>
          <h4 className="text-sm font-semibold text-gray-700">New Skill</h4>
          <div className="grid grid-cols-2 gap-2">
            {[['skill_code','Skill Code'],['name','Name'],['domain','Domain'],['cluster','Cluster']].map(([field, label]) => (
              <div key={field}>
                <label className="text-[10px] text-gray-500">{label}</label>
                <input value={form[field] ?? ''} onChange={e => setForm((f: any) => ({ ...f, [field]: e.target.value }))}
                  className="w-full text-xs border rounded-lg px-2 py-1.5 mt-0.5 outline-none" style={{ borderColor: BRAND.border }} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[['durability_score','Durability (0-100)'],['human_quotient','Human Quotient'],['data_intensity','Data Intensity']].map(([field, label]) => (
              <div key={field}>
                <label className="text-[10px] text-gray-500">{label}</label>
                <input type="number" min={0} max={100} value={form[field] ?? 50} onChange={e => setForm((f: any) => ({ ...f, [field]: Number(e.target.value) }))}
                  className="w-full text-xs border rounded-lg px-2 py-1.5 mt-0.5 outline-none" style={{ borderColor: BRAND.border }} />
              </div>
            ))}
          </div>
          <textarea placeholder="Description…" value={form.description ?? ''} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))}
            rows={2} className="w-full text-xs border rounded-lg px-2 py-1.5 outline-none resize-none" style={{ borderColor: BRAND.border }} />
          <div className="flex gap-2">
            <button onClick={create} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: BRAND.green }}><Save size={12} /> Save</button>
            <button onClick={() => setCreating(false)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg" style={{ borderWidth:1, borderColor: BRAND.border, color:'#6B7280' }}><X size={12} /> Cancel</button>
          </div>
        </div>
      )}

      {loading ? <Spinner /> : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: BRAND.border }}>
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b" style={{ borderColor: BRAND.border }}>
              <tr>{['Skill','Domain','Cluster','Durability','AI Impact','Trend',''].map(h => <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: BRAND.border }}>
              {items.map((s: any) => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2">
                    <p className="font-medium text-gray-800">{s.name}</p>
                    <p className="text-gray-400">{s.skill_code}</p>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{s.domain}</td>
                  <td className="px-3 py-2 text-gray-500">{s.cluster || '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-12 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${s.durability_score}%`, backgroundColor: s.durability_score >= 75 ? BRAND.green : s.durability_score >= 50 ? BRAND.blue : BRAND.red }} />
                      </div>
                      <span className="text-gray-700 font-medium">{s.durability_score}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {s.impact_band && <span className="capitalize px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${IMPACT_COLOR[s.impact_band]}15`, color: IMPACT_COLOR[s.impact_band] }}>{s.impact_band}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className="capitalize text-gray-500">{s.demand_trend?.replace('_',' ')}</span>
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => deactivate(s.id)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length && <p className="text-center text-xs text-gray-400 py-8">No skills matched.</p>}
        </div>
      )}
    </div>
  );
}

// ── AI Impact Tab ──────────────────────────────────────────────────────────
function AIImpactAdminTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [band, setBand] = useState('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ impact_band: band, search });
    const r = await apiFetch(`/api/admin/frp/ai-impact?${params}`);
    setItems(r.items ?? []);
    setLoading(false);
  }, [band, search]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing) return;
    await apiFetch(`/api/admin/frp/ai-impact/${editing.id}`, { method:'PATCH', body: JSON.stringify(editing) });
    setEditing(null);
    load();
  };

  const IMPACT_COLOR: Record<string, string> = { low:'#43C59E', moderate:'#F7B731', high:'#FC5C65', transformative:'#FF6584' };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[140px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search skills…"
            className="w-full text-xs border rounded-lg pl-7 pr-3 py-2 outline-none" style={{ borderColor: BRAND.border }} />
        </div>
        <select value={band} onChange={e => setBand(e.target.value)}
          className="text-xs border rounded-lg px-3 py-2 outline-none" style={{ borderColor: BRAND.border }}>
          {['all','low','moderate','high','transformative'].map(b => <option key={b} value={b}>{b === 'all' ? 'All Bands' : b.charAt(0).toUpperCase() + b.slice(1)}</option>)}
        </select>
      </div>

      {editing && (
        <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: BRAND.blue, backgroundColor: `${BRAND.blue}04` }}>
          <h4 className="text-sm font-semibold text-gray-700">Edit: {editing.name}</h4>
          <div className="grid grid-cols-2 gap-2">
            {[['displacement_risk','Displacement Risk (0–1)'],['augmentation_potential','Augmentation Potential (0–1)'],['new_work_creation','New Work Creation (0–1)'],['timeline_years','Timeline (years)']].map(([f, l]) => (
              <div key={f}>
                <label className="text-[10px] text-gray-500">{l}</label>
                <input type="number" step={f === 'timeline_years' ? 1 : 0.01} min={0} max={f === 'timeline_years' ? 20 : 1} value={editing[f] ?? ''} onChange={e => setEditing((ed: any) => ({ ...ed, [f]: e.target.value }))}
                  className="w-full text-xs border rounded-lg px-2 py-1.5 mt-0.5 outline-none" style={{ borderColor: BRAND.border }} />
              </div>
            ))}
            <div>
              <label className="text-[10px] text-gray-500">Impact Band</label>
              <select value={editing.impact_band ?? ''} onChange={e => setEditing((ed: any) => ({ ...ed, impact_band: e.target.value }))}
                className="w-full text-xs border rounded-lg px-2 py-1.5 mt-0.5 outline-none" style={{ borderColor: BRAND.border }}>
                {['low','moderate','high','transformative'].map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>
          <textarea placeholder="Resilience rationale…" value={editing.resilience_rationale ?? ''} onChange={e => setEditing((ed: any) => ({ ...ed, resilience_rationale: e.target.value }))}
            rows={2} className="w-full text-xs border rounded-lg px-2 py-1.5 outline-none resize-none" style={{ borderColor: BRAND.border }} />
          <div className="flex gap-2">
            <button onClick={save} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: BRAND.green }}><Save size={12} /> Save</button>
            <button onClick={() => setEditing(null)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg" style={{ borderWidth:1, borderColor:BRAND.border, color:'#6B7280' }}><X size={12} /> Cancel</button>
          </div>
        </div>
      )}

      {loading ? <Spinner /> : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: BRAND.border }}>
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b" style={{ borderColor: BRAND.border }}>
              <tr>{['Skill','Band','Displacement','Augmentation','New Work','Timeline',''].map(h => <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: BRAND.border }}>
              {items.map((s: any) => {
                const ic = IMPACT_COLOR[s.impact_band] ?? BRAND.amber;
                return (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-800">{s.name}</p>
                      <p className="text-gray-400">{s.domain}</p>
                    </td>
                    <td className="px-3 py-2"><span className="capitalize px-1.5 py-0.5 rounded-full text-[10px]" style={{ backgroundColor:`${ic}15`, color:ic }}>{s.impact_band}</span></td>
                    <td className="px-3 py-2 font-medium" style={{ color:BRAND.red }}>{Math.round(Number(s.displacement_risk)*100)}%</td>
                    <td className="px-3 py-2 font-medium" style={{ color:BRAND.blue }}>{Math.round(Number(s.augmentation_potential)*100)}%</td>
                    <td className="px-3 py-2 font-medium" style={{ color:BRAND.green }}>{Math.round(Number(s.new_work_creation)*100)}%</td>
                    <td className="px-3 py-2 text-gray-500">~{s.timeline_years}y</td>
                    <td className="px-3 py-2"><button onClick={() => setEditing(s)} className="text-gray-400 hover:text-blue-500 transition-colors"><Edit3 size={13} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!items.length && <p className="text-center text-xs text-gray-400 py-8">No records matched.</p>}
        </div>
      )}
    </div>
  );
}

// ── Automation Risk Tab ────────────────────────────────────────────────────
function AutomationRiskAdminTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [riskBand, setRiskBand] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ search, risk_band: riskBand });
    const r = await apiFetch(`/api/admin/frp/automation-risk?${params}`);
    setItems(r.items ?? []);
    setLoading(false);
  }, [search, riskBand]);

  useEffect(() => { load(); }, [load]);

  const RISK_COLOR: Record<string, string> = { low:'#43C59E', moderate_low:'#45AAF2', moderate:'#F7B731', high:'#FC5C65', critical:'#FF0000' };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[140px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search roles…"
            className="w-full text-xs border rounded-lg pl-7 pr-3 py-2 outline-none" style={{ borderColor: BRAND.border }} />
        </div>
        <select value={riskBand} onChange={e => setRiskBand(e.target.value)}
          className="text-xs border rounded-lg px-3 py-2 outline-none" style={{ borderColor: BRAND.border }}>
          {[['all','All Bands'],['low','Low'],['moderate_low','Moderate-Low'],['moderate','Moderate'],['high','High'],['critical','Critical']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {loading ? <Spinner /> : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: BRAND.border }}>
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b" style={{ borderColor: BRAND.border }}>
              <tr>{['Role','Industry','Risk Score','Band','Timeline','Upskill Priorities'].map(h => <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: BRAND.border }}>
              {items.map((r: any) => {
                const color = RISK_COLOR[r.risk_band] ?? BRAND.amber;
                return (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-800">{r.role_name}</p>
                      <p className="text-gray-400">{r.role_code}</p>
                    </td>
                    <td className="px-3 py-2 text-gray-500 capitalize">{r.industry || '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-10 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width:`${r.risk_score}%`, backgroundColor:color }} />
                        </div>
                        <span className="font-bold" style={{ color }}>{r.risk_score}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2"><span className="capitalize px-1.5 py-0.5 rounded-full text-[10px]" style={{ backgroundColor:`${color}15`, color }}>{r.risk_band.replace('_',' ')}</span></td>
                    <td className="px-3 py-2 text-gray-500">~{r.timeline_years}y</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">{(r.upskill_priorities as string[]).slice(0,2).map((p, i) => <span key={i} className="text-[9px] px-1 py-0.5 rounded-full" style={{ backgroundColor:`${BRAND.blue}12`, color:BRAND.blue }}>{p}</span>)}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!items.length && <p className="text-center text-xs text-gray-400 py-8">No roles matched.</p>}
        </div>
      )}
    </div>
  );
}

// ── Industry Forecast Tab ──────────────────────────────────────────────────
function IndustryForecastAdminTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await apiFetch('/api/admin/frp/industry-forecast');
    setItems(r.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const OUTLOOK: Record<string, string> = { exceptional:'#43C59E', strong:'#45AAF2', moderate:'#6C63FF', stable:'#F7B731', declining:'#FC5C65' };

  return (
    <div className="space-y-3">
      {loading ? <Spinner /> : items.map((ind: any) => {
        const oc = OUTLOOK[ind.growth_outlook] ?? BRAND.primary;
        const sds = ind.skill_demand_shift ?? {};
        return (
          <div key={ind.id} className="rounded-xl border p-4 space-y-3" style={{ borderColor: BRAND.border }}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-gray-800">{ind.industry_name}</p>
                <p className="text-[10px] text-gray-400">{ind.industry_code}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="capitalize text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor:`${oc}15`, color:oc }}>{ind.growth_outlook}</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor:`${BRAND.blue}12`, color:BRAND.blue }}>AI-ready: {ind.ai_readiness_score}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-[10px]">
              <div>
                <p className="font-semibold text-gray-500 mb-1">Rising Skills</p>
                <div className="space-y-0.5">{sds.rising?.map((s: string, i: number) => <p key={i} className="text-gray-600">▸ {s}</p>)}</div>
              </div>
              <div>
                <p className="font-semibold text-gray-500 mb-1">Top Growing Roles</p>
                <div className="space-y-0.5">{ind.top_growing_roles?.slice(0,3).map((r: string, i: number) => <p key={i} className="text-gray-600">▸ {r}</p>)}</div>
              </div>
              <div>
                <p className="font-semibold text-gray-500 mb-1">Top Declining Roles</p>
                <div className="space-y-0.5">{ind.top_declining_roles?.slice(0,3).map((r: string, i: number) => <p key={i} className="text-gray-600">▸ {r}</p>)}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Role Evolution Tab ─────────────────────────────────────────────────────
function RoleEvolutionAdminTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [evoType, setEvoType] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ search, evolution_type: evoType });
    const r = await apiFetch(`/api/admin/frp/role-evolution?${params}`);
    setItems(r.items ?? []);
    setLoading(false);
  }, [search, evoType]);

  useEffect(() => { load(); }, [load]);

  const TYPE_COLOR: Record<string, string> = { adjacent:BRAND.blue, uplevel:BRAND.green, pivot:BRAND.accent, specialize:BRAND.primary, lateral:BRAND.amber };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[140px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search roles…"
            className="w-full text-xs border rounded-lg pl-7 pr-3 py-2 outline-none" style={{ borderColor: BRAND.border }} />
        </div>
        <select value={evoType} onChange={e => setEvoType(e.target.value)}
          className="text-xs border rounded-lg px-3 py-2 outline-none" style={{ borderColor: BRAND.border }}>
          {['all','adjacent','uplevel','pivot','specialize','lateral'].map(t => <option key={t} value={t}>{t === 'all' ? 'All Types' : t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
        </select>
      </div>

      {loading ? <Spinner /> : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: BRAND.border }}>
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b" style={{ borderColor: BRAND.border }}>
              <tr>{['From','To','Type','Feasibility','Timeline','AI-Driven','Required Skills'].map(h => <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: BRAND.border }}>
              {items.map((e: any) => {
                const tc = TYPE_COLOR[e.evolution_type] ?? BRAND.primary;
                return (
                  <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2 text-gray-600 max-w-[120px] truncate">{e.from_role}</td>
                    <td className="px-3 py-2 font-medium text-gray-800 max-w-[120px] truncate">{e.to_role}</td>
                    <td className="px-3 py-2"><span className="capitalize px-1.5 py-0.5 rounded-full text-[10px]" style={{ backgroundColor:`${tc}15`, color:tc }}>{e.evolution_type}</span></td>
                    <td className="px-3 py-2 font-bold" style={{ color:e.feasibility_score >= 70 ? BRAND.green : e.feasibility_score >= 50 ? BRAND.amber : BRAND.red }}>{e.feasibility_score}</td>
                    <td className="px-3 py-2 text-gray-500">{e.transition_months_min}–{e.transition_months_max}mo</td>
                    <td className="px-3 py-2">{e.is_ai_driven ? <CheckCircle size={13} style={{ color:BRAND.green }} /> : <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">{(e.required_skills as string[]).slice(0,2).map((s, i) => <span key={i} className="text-[9px] px-1 py-0.5 rounded-full" style={{ backgroundColor:`${BRAND.primary}10`, color:BRAND.primary }}>{s}</span>)}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!items.length && <p className="text-center text-xs text-gray-400 py-8">No evolution paths matched.</p>}
        </div>
      )}
    </div>
  );
}

// ── Analytics Tab ──────────────────────────────────────────────────────────
function AnalyticsTab() {
  const [benchmarks, setBenchmarks] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [backfill, setBackfill] = useState<{ loading: boolean; result: any | null }>({ loading: false, result: null });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    const [b, u, a] = await Promise.all([
      apiFetch(`/api/admin/frp/benchmarks${refresh ? '?refresh=1' : ''}`),
      apiFetch('/api/admin/frp/user-readiness?limit=20'),
      apiFetch('/api/admin/frp/analytics'),
    ]);
    setBenchmarks(b.benchmarks ?? {});
    setUsers(u.users ?? []);
    setAnalytics(a?.ok ? a : null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const runBackfill = async () => {
    setBackfill({ loading: true, result: null });
    const r = await apiFetch('/api/admin/frp/backfill-users', { method: 'POST' });
    setBackfill({ loading: false, result: r });
    if (r?.ok) setTimeout(() => load(true), 1800);
  };

  const BAND_COLOR: Record<string, string> = { pioneering:'#43C59E', resilient:'#45AAF2', capable:'#6C63FF', developing:'#F7B731', emerging:'#FC5C65' };
  const METRICS = ['composite','skill_durability','adaptability','market_alignment','learning_velocity','role_resilience'];

  return (
    <div className="space-y-5">
      {loading ? <Spinner /> : (
        <>
          {/* FRI Band Distribution */}
          {analytics && analytics.total_assessed > 0 && (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: BRAND.border }}>
              <div className="bg-gray-50 px-4 py-2.5 border-b" style={{ borderColor: BRAND.border }}>
                <p className="text-xs font-semibold text-gray-700">FRI Band Distribution (90d · {analytics.total_assessed} users)</p>
              </div>
              <div className="p-4 space-y-2">
                {(analytics.band_distribution as any[]).map((b: any) => (
                  <div key={b.band} className="flex items-center gap-2">
                    <span className="w-20 text-[10px] font-medium capitalize text-gray-600">{b.band}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width:`${b.pct}%`, backgroundColor: BAND_COLOR[b.band] ?? BRAND.primary }} />
                    </div>
                    <span className="w-8 text-right text-[10px] font-semibold text-gray-700">{b.pct}%</span>
                    <span className="w-6 text-right text-[10px] text-gray-400">{b.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Backfill action */}
          <div className="rounded-xl border p-4" style={{ borderColor: BRAND.border }}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs font-semibold text-gray-700">FRI Backfill</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {(analytics?.backfill_candidates ?? 0) > 0
                    ? `${analytics.backfill_candidates} users with career profiles are missing FRI snapshots.`
                    : analytics ? 'All users with career profiles have FRI snapshots.' : 'Load analytics to check backfill status.'}
                </p>
              </div>
              <button
                onClick={runBackfill}
                disabled={backfill.loading}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-white disabled:opacity-50 shrink-0"
                style={{ backgroundColor: BRAND.primary }}
              >
                {backfill.loading ? <><RefreshCw size={11} className="animate-spin" /> Running…</> : <><TrendingUp size={11} /> Run Backfill</>}
              </button>
            </div>
            {backfill.result && (
              <div className="mt-3 text-[10px] rounded-lg px-3 py-2 flex gap-4 flex-wrap" style={{ backgroundColor: backfill.result.ok ? `${BRAND.green}10` : `${BRAND.red}10` }}>
                <span style={{ color: BRAND.green }}>✓ {backfill.result.succeeded} succeeded</span>
                {backfill.result.failed > 0 && <span style={{ color: BRAND.red }}>✗ {backfill.result.failed} failed</span>}
                <span className="text-gray-500">{backfill.result.attempted} attempted</span>
              </div>
            )}
          </div>

          {/* Signal Quality */}
          {analytics?.signal_quality?.length > 0 && (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: BRAND.border }}>
              <div className="bg-gray-50 px-4 py-2.5 border-b" style={{ borderColor: BRAND.border }}>
                <p className="text-xs font-semibold text-gray-700">Signal Quality — real data vs. default fallback</p>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b" style={{ borderColor: BRAND.border }}>
                  <tr>{['Signal Axis','Real','Default','Real %','Quality'].map(h => <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: BRAND.border }}>
                  {(analytics.signal_quality as any[]).map((s: any) => {
                    const q = s.real_pct >= 70 ? { label:'Good', color: BRAND.green } : s.real_pct >= 30 ? { label:'Partial', color: BRAND.amber } : { label:'Sparse', color: BRAND.red };
                    return (
                      <tr key={s.axis} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-700 capitalize">{s.axis.replace(/_/g,' ')}</td>
                        <td className="px-3 py-2 text-gray-600">{s.real}</td>
                        <td className="px-3 py-2 text-gray-400">{s.default_fallback}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-14 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                              <div className="h-full rounded-full" style={{ width:`${s.real_pct}%`, backgroundColor: q.color }} />
                            </div>
                            <span className="font-semibold text-[10px]" style={{ color: q.color }}>{s.real_pct}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2"><span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor:`${q.color}15`, color:q.color }}>{q.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Outcome Action Coverage */}
          {analytics?.outcome_action_coverage?.length > 0 && (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: BRAND.border }}>
              <div className="bg-gray-50 px-4 py-2.5 border-b" style={{ borderColor: BRAND.border }}>
                <p className="text-xs font-semibold text-gray-700">FRP Outcome Model Coverage</p>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b" style={{ borderColor: BRAND.border }}>
                  <tr>{['Model','Constructs','Actions','Gated','Status'].map(h => <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: BRAND.border }}>
                  {(analytics.outcome_action_coverage as any[]).map((m: any) => {
                    const active = !m.gated && m.il_count > 0;
                    const sc = active ? { label:'Active', color: BRAND.green } : m.gated ? { label:'Gated', color: BRAND.amber } : { label:'No actions', color: BRAND.red };
                    return (
                      <tr key={m.model_key} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-700">{m.display_label}</td>
                        <td className="px-3 py-2 text-gray-600">{m.ck_count}</td>
                        <td className="px-3 py-2 font-semibold" style={{ color: m.il_count > 0 ? BRAND.green : BRAND.red }}>{m.il_count}</td>
                        <td className="px-3 py-2">{m.gated ? <span className="text-amber-500 text-[10px]">Yes</span> : <span className="text-gray-400 text-[10px]">No</span>}</td>
                        <td className="px-3 py-2"><span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor:`${sc.color}15`, color:sc.color }}>{sc.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Skill Coverage Heatmap */}
          {analytics?.top_skills?.length > 0 && (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: BRAND.border }}>
              <div className="bg-gray-50 px-4 py-2.5 border-b" style={{ borderColor: BRAND.border }}>
                <p className="text-xs font-semibold text-gray-700">Skill Profile Coverage (top 20 by user count)</p>
              </div>
              <div className="p-3 space-y-1.5">
                {(analytics.top_skills as any[]).map((s: any) => {
                  const maxCount = (analytics.top_skills[0]?.user_count ?? 1) || 1;
                  const pct = Math.round((s.user_count / maxCount) * 100);
                  return (
                    <div key={s.skill_code} className="flex items-center gap-2">
                      <span className="w-32 text-[10px] text-gray-700 truncate" title={s.name}>{s.name}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width:`${pct}%`, backgroundColor: BRAND.blue }} />
                      </div>
                      <span className="w-6 text-right text-[10px] text-gray-500">{s.user_count}</span>
                      {s.avg_proficiency > 0 && <span className="w-8 text-right text-[10px]" style={{ color: BRAND.primary }}>{s.avg_proficiency}%</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Benchmarks */}
          {benchmarks && Object.keys(benchmarks).length > 0 ? (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: BRAND.border }}>
              <div className="bg-gray-50 px-4 py-2.5 border-b flex items-center justify-between" style={{ borderColor: BRAND.border }}>
                <p className="text-xs font-semibold text-gray-700">Platform Benchmarks (global 30d)</p>
                <button onClick={() => load(true)} className="flex items-center gap-1 text-[10px] text-blue-500"><RefreshCw size={11} /> Recompute</button>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b" style={{ borderColor: BRAND.border }}>
                  <tr>{['Metric','P25','P50 (Median)','P75','P90','Sample'].map(h => <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: BRAND.border }}>
                  {METRICS.filter(m => benchmarks[m]).map(m => {
                    const bm = benchmarks[m];
                    return (
                      <tr key={m} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-700 capitalize">{m.replace(/_/g,' ')}</td>
                        <td className="px-3 py-2 text-gray-600">{Math.round(bm.p25)}</td>
                        <td className="px-3 py-2 font-semibold text-gray-800">{Math.round(bm.p50)}</td>
                        <td className="px-3 py-2 text-gray-600">{Math.round(bm.p75)}</td>
                        <td className="px-3 py-2 text-gray-600">{Math.round(bm.p90)}</td>
                        <td className="px-3 py-2 text-gray-400">{bm.sample_size}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border p-6 text-center" style={{ borderColor: BRAND.border }}>
              <p className="text-xs text-gray-500">No benchmark data yet — at least 5 user assessments required in the last 30 days.</p>
              <button onClick={() => load(true)} className="mt-3 flex items-center gap-1.5 text-xs text-blue-500 mx-auto"><RefreshCw size={11} /> Try Recompute</button>
            </div>
          )}

          {/* User Readiness table */}
          {users.length > 0 && (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: BRAND.border }}>
              <div className="bg-gray-50 px-4 py-2.5 border-b" style={{ borderColor: BRAND.border }}>
                <p className="text-xs font-semibold text-gray-700">Latest User Assessments (up to 20)</p>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b" style={{ borderColor: BRAND.border }}>
                  <tr>{['User','FRI','Band','Skill Dur.','Adaptability','Market','Confidence','When'].map(h => <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: BRAND.border }}>
                  {users.map((u: any) => {
                    const bc = BAND_COLOR[u.band] ?? BRAND.primary;
                    return (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-500 max-w-[80px] truncate">{u.user_id}</td>
                        <td className="px-3 py-2 font-bold" style={{ color: bc }}>{u.composite}</td>
                        <td className="px-3 py-2"><span className="capitalize px-1.5 py-0.5 rounded-full text-[10px]" style={{ backgroundColor:`${bc}15`, color:bc }}>{u.band}</span></td>
                        <td className="px-3 py-2 text-gray-600">{u.skill_durability}</td>
                        <td className="px-3 py-2 text-gray-600">{u.adaptability}</td>
                        <td className="px-3 py-2 text-gray-600">{u.market_alignment}</td>
                        <td className="px-3 py-2 text-gray-500">{Math.round(Number(u.confidence)*100)}%</td>
                        <td className="px-3 py-2 text-gray-400">{new Date(u.computed_at).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!analytics?.total_assessed && !users.length && (
            <div className="rounded-xl border p-6 text-center" style={{ borderColor: BRAND.border }}>
              <p className="text-xs text-gray-500">No FRI data yet. Run backfill above to compute readiness snapshots for existing users.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────
type PanelTab = 'overview' | 'skills' | 'ai-impact' | 'automation' | 'forecast' | 'evolution' | 'analytics';

export default function FRPDesignPanel() {
  const [activeTab, setActiveTab] = useState<PanelTab>('overview');

  const TABS: { id: PanelTab; label: string }[] = [
    { id:'overview',   label:'Overview' },
    { id:'skills',     label:'Skill Library' },
    { id:'ai-impact',  label:'AI Impact' },
    { id:'automation', label:'Automation Risk' },
    { id:'forecast',   label:'Industry Forecast' },
    { id:'evolution',  label:'Role Evolution' },
    { id:'analytics',  label:'Analytics' },
  ];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-gray-800">Future Readiness Platform</h2>
        <p className="text-xs text-gray-500 mt-1">Master data · AI impact framework · Automation risk · Industry forecasts · Role evolution · Analytics</p>
        <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1"><AlertTriangle size={10} /> Requires FF_FUTURE_READINESS=1 in Backend API workflow.</p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 flex-wrap border-b pb-1" style={{ borderColor: BRAND.border }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className="text-xs font-medium px-3 py-1.5 rounded-t-lg transition-all"
            style={activeTab === t.id
              ? { backgroundColor: BRAND.primary, color: '#fff' }
              : { color: '#6B7280' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Panels */}
      {activeTab === 'overview'   && <OverviewTab />}
      {activeTab === 'skills'     && <SkillLibraryTab />}
      {activeTab === 'ai-impact'  && <AIImpactAdminTab />}
      {activeTab === 'automation' && <AutomationRiskAdminTab />}
      {activeTab === 'forecast'   && <IndustryForecastAdminTab />}
      {activeTab === 'evolution'  && <RoleEvolutionAdminTab />}
      {activeTab === 'analytics'  && <AnalyticsTab />}
    </div>
  );
}
