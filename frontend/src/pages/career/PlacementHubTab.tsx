import { BRAND } from '@/design-system/tokens';
import React, { useState, useEffect, useCallback } from 'react';
import {
  GraduationCap, Building2, Calendar, Briefcase, Award, ClipboardList,
  Plus, X, Trash2, CheckCircle, AlertCircle, Info, Gauge, TrendingUp,
  Search, ChevronRight, RefreshCw, Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * MX-302E — Placement Hub & Company Explorer (student-facing).
 *
 * Flag-gated upstream (campusPlacement). Every panel reads from
 * /api/campus-placement/* which is honest-by-construction: null ≠ 0, no
 * fabricated CTC, k-anonymised cohort benchmarks, Company DNA only from real
 * role-DNA / market signal. When the substrate is empty the API returns
 * `{ empty: true }` and these panels show an honest empty state.
 */

type SubTab =
  | 'overview' | 'calendar' | 'internships' | 'programs' | 'drives'
  | 'applications' | 'offers' | 'companies' | 'profile';

const FRESHER_LS_DRIVES = 'mx-fresher-drives';

const api = (path: string, init?: RequestInit) =>
  fetch(`/api/campus-placement${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });

const fmtMoney = (v: number | null | undefined, currency = 'INR'): string => {
  if (v == null) return '—'; // null ≠ 0 — never render a missing figure as 0
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v);
  } catch {
    return `${currency} ${v.toLocaleString()}`;
  }
};

const fmtDate = (d: string | null | undefined): string => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return String(d); }
};

const SUB_TABS: { id: SubTab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview',     label: 'Overview',          icon: <Gauge size={15} /> },
  { id: 'calendar',     label: 'Calendar',          icon: <Calendar size={15} /> },
  { id: 'drives',       label: 'Company Drives',    icon: <Building2 size={15} /> },
  { id: 'internships',  label: 'Internships',       icon: <Briefcase size={15} /> },
  { id: 'programs',     label: 'Graduate Programs', icon: <GraduationCap size={15} /> },
  { id: 'applications', label: 'Applications',      icon: <ClipboardList size={15} /> },
  { id: 'offers',       label: 'Offers & Packages', icon: <Award size={15} /> },
  { id: 'companies',    label: 'Company Explorer',  icon: <Search size={15} /> },
  { id: 'profile',      label: 'My Profile',        icon: <Target size={15} /> },
];

function Empty({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
      <Info size={18} className="mt-0.5 shrink-0 text-gray-400" />
      <span>{msg}</span>
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}

export function PlacementHubTab({ profile, userId }: { profile?: any; userId?: string }) {
  const [sub, setSub] = useState<SubTab>('overview');

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${BRAND.navy ?? '#0f2a4a'}, ${BRAND.teal ?? '#0f766e'})` }}>
        <div className="flex items-center gap-3">
          <GraduationCap size={26} />
          <div>
            <h1 className="text-xl font-bold">Placement Hub</h1>
            <p className="text-sm text-white/80">Campus drives, internships, offers and live company intelligence — all in one place.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              sub === t.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      <div>
        {sub === 'overview'     && <OverviewPanel onNavigate={setSub} />}
        {sub === 'calendar'     && <CalendarPanel />}
        {sub === 'drives'       && <DrivesPanel />}
        {sub === 'internships'  && <InternshipsPanel />}
        {sub === 'programs'     && <ProgramsPanel />}
        {sub === 'applications' && <ApplicationsPanel />}
        {sub === 'offers'       && <OffersPanel />}
        {sub === 'companies'    && <CompaniesPanel userId={userId} />}
        {sub === 'profile'      && <ProfilePanel />}
      </div>
    </div>
  );
}

// ── Overview (placement readiness + quick stats) ─────────────────────────────
function OverviewPanel({ onNavigate }: { onNavigate: (s: SubTab) => void }) {
  const [readiness, setReadiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/readiness').then(r => r.json()).then(d => setReadiness(d.readiness ?? null)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Empty msg="Loading your placement readiness…" />;

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold text-gray-800"><Gauge size={18} /> Placement Readiness</h3>
          {readiness?.score != null && (
            <span className="text-2xl font-bold" style={{ color: BRAND.teal ?? '#0f766e' }}>{readiness.score}<span className="text-sm text-gray-400">/100</span></span>
          )}
        </div>
        {readiness?.score == null ? (
          <Empty msg={readiness?.note || 'No placement activity yet — complete your profile and start tracking applications to build your readiness score.'} />
        ) : (
          <div className="space-y-2">
            {readiness.components.map((c: any) => (
              <div key={c.key} className="flex items-center gap-3">
                <div className="w-44 text-sm text-gray-600">{c.label}</div>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                  {/* null value renders as an empty (not zero) bar with a dashed marker */}
                  {c.value == null
                    ? <div className="h-full w-full bg-[repeating-linear-gradient(45deg,#e5e7eb,#e5e7eb_4px,#f3f4f6_4px,#f3f4f6_8px)]" />
                    : <div className="h-full rounded-full" style={{ width: `${c.value}%`, background: BRAND.teal ?? '#0f766e' }} />}
                </div>
                <div className="w-28 text-right text-xs text-gray-500">{c.value == null ? 'No data' : `${c.value}%`}</div>
              </div>
            ))}
            <p className="pt-1 text-xs text-gray-400">{readiness.note}</p>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { id: 'drives' as SubTab, label: 'Company Drives', icon: <Building2 size={18} /> },
          { id: 'internships' as SubTab, label: 'Internships', icon: <Briefcase size={18} /> },
          { id: 'offers' as SubTab, label: 'Offers & Packages', icon: <Award size={18} /> },
          { id: 'companies' as SubTab, label: 'Company Explorer', icon: <Search size={18} /> },
        ].map((q) => (
          <button key={q.id} onClick={() => onNavigate(q.id)} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 text-left text-sm font-medium text-gray-700 shadow-sm transition hover:border-gray-300 hover:shadow">
            <span style={{ color: BRAND.teal ?? '#0f766e' }}>{q.icon}</span>{q.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Calendar ─────────────────────────────────────────────────────────────────
function CalendarPanel() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api('/calendar').then(r => r.json()).then(d => setEvents(d.events || [])).catch(() => {}).finally(() => setLoading(false)); }, []);
  if (loading) return <Empty msg="Loading calendar…" />;
  if (events.length === 0) return <Empty msg="No placement events scheduled yet. Drives, deadlines and test dates appear here as they're published." />;
  return (
    <div className="space-y-2">
      {events.map((e) => (
        <Card key={e.id} className="flex items-center gap-4">
          <div className="flex w-16 flex-col items-center rounded-lg bg-gray-50 p-2 text-center">
            <span className="text-lg font-bold text-gray-800">{e.event_date ? new Date(e.event_date).getDate() : '—'}</span>
            <span className="text-[10px] uppercase text-gray-500">{e.event_date ? new Date(e.event_date).toLocaleDateString('en-IN', { month: 'short' }) : ''}</span>
          </div>
          <div className="flex-1">
            <div className="font-medium text-gray-800">{e.title}</div>
            <div className="text-xs text-gray-500">{e.event_type}{e.location ? ` · ${e.location}` : ''}{e.event_time ? ` · ${e.event_time}` : ''}</div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Drives (with eligibility check) ──────────────────────────────────────────
function DrivesPanel() {
  const [drives, setDrives] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [elig, setElig] = useState<Record<string, any>>({});
  useEffect(() => { api('/drives').then(r => r.json()).then(d => setDrives(d.drives || [])).catch(() => {}).finally(() => setLoading(false)); }, []);

  const checkEligibility = useCallback(async (driveId: string) => {
    try { const d = await (await api(`/eligibility/${driveId}`)).json(); setElig(prev => ({ ...prev, [driveId]: d.result })); } catch { /* ignore */ }
  }, []);

  if (loading) return <Empty msg="Loading company drives…" />;
  if (drives.length === 0) return <Empty msg="No published drives yet. When your campus / partners publish recruitment drives, they appear here with eligibility checks." />;

  return (
    <div className="space-y-3">
      {drives.map((d) => {
        const e = elig[d.id];
        return (
          <Card key={d.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-gray-800">{d.role_title || d.title}</div>
                <div className="text-sm text-gray-500">{d.company_name || 'Company'}{d.location ? ` · ${d.location}` : ''}{d.work_mode ? ` · ${d.work_mode}` : ''}</div>
              </div>
              <div className="text-right text-sm">
                <div className="font-medium text-gray-800">
                  {d.ctc_min != null || d.ctc_max != null ? `${fmtMoney(d.ctc_min, d.currency)} – ${fmtMoney(d.ctc_max, d.currency)}` : <span className="text-gray-400">CTC not disclosed</span>}
                </div>
                <div className="text-xs text-gray-500">Drive: {fmtDate(d.drive_date)}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => checkEligibility(d.id)}>Check eligibility</Button>
              {e && (
                <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                  e.eligible === true ? 'bg-green-100 text-green-700' : e.eligible === false ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {e.eligible === true ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                  {e.eligible === true ? 'Eligible' : e.eligible === false ? 'Not eligible' : 'Insufficient data'}
                </span>
              )}
            </div>
            {e && (
              <div className="mt-2 space-y-1 rounded-lg bg-gray-50 p-2 text-xs">
                {e.checks?.map((c: any, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-gray-600">{c.criterion}</span>
                    <span className={c.pass === true ? 'text-green-600' : c.pass === false ? 'text-red-600' : 'text-amber-600'}>
                      need {String(c.required)} · you {c.actual == null ? '—' : String(c.actual)}
                    </span>
                  </div>
                ))}
                <p className="pt-1 text-gray-400">{e.note}</p>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ── Internships ──────────────────────────────────────────────────────────────
function InternshipsPanel() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api('/internships').then(r => r.json()).then(d => setItems(d.internships || [])).catch(() => {}).finally(() => setLoading(false)); }, []);
  if (loading) return <Empty msg="Loading internships…" />;
  if (items.length === 0) return <Empty msg="No internships listed yet. The marketplace fills as partners post opportunities." />;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((i) => (
        <Card key={i.id}>
          <div className="font-semibold text-gray-800">{i.title}</div>
          <div className="text-sm text-gray-500">{i.company_name || 'Company'}{i.domain ? ` · ${i.domain}` : ''}</div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
            <span>{i.location || 'Location N/A'}{i.work_mode ? ` · ${i.work_mode}` : ''}</span>
            <span>{i.duration_months ? `${i.duration_months} months` : 'Duration N/A'}</span>
            <span>Stipend: {i.stipend_min != null || i.stipend_max != null ? `${fmtMoney(i.stipend_min, i.currency)} – ${fmtMoney(i.stipend_max, i.currency)}` : 'Not disclosed'}</span>
            {i.ppo_available && <span className="font-medium text-green-600">PPO possible</span>}
          </div>
          {i.apply_deadline && <div className="mt-1 text-xs text-amber-600">Apply by {fmtDate(i.apply_deadline)}</div>}
        </Card>
      ))}
    </div>
  );
}

// ── Graduate programs ────────────────────────────────────────────────────────
function ProgramsPanel() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api('/graduate-programs').then(r => r.json()).then(d => setItems(d.programs || [])).catch(() => {}).finally(() => setLoading(false)); }, []);
  if (loading) return <Empty msg="Loading graduate programs…" />;
  if (items.length === 0) return <Empty msg="No graduate / leadership programs listed yet." />;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((g) => (
        <Card key={g.id}>
          <div className="font-semibold text-gray-800">{g.name}</div>
          <div className="text-sm text-gray-500">{g.company_name || 'Company'}{g.program_type ? ` · ${g.program_type}` : ''}</div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
            <span>{g.location || 'Location N/A'}</span>
            <span>{g.duration_months ? `${g.duration_months} months` : 'Duration N/A'}</span>
            <span>CTC: {g.ctc_min != null || g.ctc_max != null ? `${fmtMoney(g.ctc_min, g.currency)} – ${fmtMoney(g.ctc_max, g.currency)}` : 'Not disclosed'}</span>
          </div>
          {g.eligibility && <div className="mt-1 text-xs text-gray-500">Eligibility: {g.eligibility}</div>}
          {g.apply_deadline && <div className="mt-1 text-xs text-amber-600">Apply by {fmtDate(g.apply_deadline)}</div>}
        </Card>
      ))}
    </div>
  );
}

// ── Applications tracker ─────────────────────────────────────────────────────
const APP_STATUSES = ['interested', 'applied', 'shortlisted', 'test', 'interview', 'offer', 'rejected', 'withdrawn'];
function ApplicationsPanel() {
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<{ company_name: string; role_title: string; status: string }>({ company_name: '', role_title: '', status: 'interested' });
  const [adding, setAdding] = useState(false);

  const reload = useCallback(() => { api('/applications').then(r => r.json()).then(d => setApps(d.applications || [])).catch(() => {}).finally(() => setLoading(false)); }, []);
  useEffect(() => { reload(); }, [reload]);

  const add = async () => {
    if (!form.company_name.trim()) return;
    await api('/applications', { method: 'POST', body: JSON.stringify(form) });
    setForm({ company_name: '', role_title: '', status: 'interested' });
    setAdding(false);
    reload();
  };
  const updateStatus = async (id: string, status: string) => { await api(`/applications/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }); reload(); };
  const remove = async (id: string) => { await api(`/applications/${id}`, { method: 'DELETE' }); reload(); };

  const importLocal = async () => {
    try {
      const raw = localStorage.getItem(FRESHER_LS_DRIVES);
      const drives = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(drives) || drives.length === 0) return;
      const applications = drives.map((d: any) => ({ company_name: d.company, role_title: d.role, status: 'applied', notes: d.notes }));
      const res = await (await api('/import-local', { method: 'POST', body: JSON.stringify({ applications }) })).json();
      if (res?.ok) reload();
    } catch { /* best-effort */ }
  };

  if (loading) return <Empty msg="Loading your applications…" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">My Applications</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={importLocal} title="Import drives you tracked on this device in Fresher Hub">Import from device</Button>
          <Button size="sm" onClick={() => setAdding(v => !v)}><Plus size={15} /> Add</Button>
        </div>
      </div>

      {adding && (
        <Card className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-3">
            <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Company *" value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} />
            <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Role" value={form.role_title} onChange={e => setForm({ ...form, role_title: e.target.value })} />
            <select className="rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              {APP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex gap-2"><Button size="sm" onClick={add}>Save</Button><Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button></div>
        </Card>
      )}

      {apps.length === 0 ? (
        <Empty msg="No applications tracked yet. Add one, or import drives you tracked on this device." />
      ) : (
        <div className="space-y-2">
          {apps.map((a) => (
            <Card key={a.id} className="flex items-center gap-3">
              <div className="flex-1">
                <div className="font-medium text-gray-800">{a.company_name || '—'}</div>
                <div className="text-xs text-gray-500">{a.role_title || ''}{a.source === 'imported' ? ' · imported' : ''}</div>
              </div>
              <select className="rounded-lg border border-gray-300 px-2 py-1 text-xs" value={a.status} onChange={e => updateStatus(a.id, e.target.value)}>
                {APP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={() => remove(a.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={15} /></button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Offers + package analytics ───────────────────────────────────────────────
function OffersPanel() {
  const [offers, setOffers] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<{ company_name: string; role_title: string; ctc: string; offer_type: string }>({ company_name: '', role_title: '', ctc: '', offer_type: 'full_time' });

  const reload = useCallback(() => {
    Promise.all([
      api('/offers').then(r => r.json()).then(d => setOffers(d.offers || [])),
      api('/package-analytics').then(r => r.json()).then(d => setAnalytics(d.analytics ?? null)),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const add = async () => {
    if (!form.company_name.trim()) return;
    // Leave CTC blank → backend stores null (never 0). We send empty string through untouched.
    await api('/offers', { method: 'POST', body: JSON.stringify(form) });
    setForm({ company_name: '', role_title: '', ctc: '', offer_type: 'full_time' });
    setAdding(false);
    reload();
  };
  const remove = async (id: string) => { await api(`/offers/${id}`, { method: 'DELETE' }); reload(); };

  if (loading) return <Empty msg="Loading offers and package analytics…" />;

  return (
    <div className="space-y-4">
      {analytics && (
        <Card>
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-800"><TrendingUp size={18} /> Package Analytics</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="text-xs uppercase text-gray-500">Your offers</div>
              <div className="text-lg font-bold text-gray-800">{analytics.self.count}</div>
              <div className="text-xs text-gray-500">Median {fmtMoney(analytics.self.median, analytics.self.currency || 'INR')}</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="text-xs uppercase text-gray-500">Cohort median</div>
              {analytics.cohort.suppressed
                ? <div className="text-sm font-medium text-amber-600">Suppressed</div>
                : <div className="text-lg font-bold text-gray-800">{fmtMoney(analytics.cohort.median, analytics.cohort.currency || 'INR')}</div>}
              <div className="text-xs text-gray-500">{analytics.cohort.suppressed ? `Needs ≥ ${analytics.cohort.k_min} offers (k-anonymity)` : `n=${analytics.cohort.n}`}</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="text-xs uppercase text-gray-500">Market reference</div>
              <div className="text-sm text-gray-700">{analytics.market.length} role{analytics.market.length === 1 ? '' : 's'}</div>
              <div className="text-xs text-gray-500">From ingested salary data</div>
            </div>
          </div>
          <p className="pt-2 text-xs text-gray-400">{analytics.note}</p>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">My Offers</h3>
        <Button size="sm" onClick={() => setAdding(v => !v)}><Plus size={15} /> Add offer</Button>
      </div>

      {adding && (
        <Card className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-4">
            <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Company *" value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} />
            <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Role" value={form.role_title} onChange={e => setForm({ ...form, role_title: e.target.value })} />
            <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="CTC (leave blank if N/A)" inputMode="numeric" value={form.ctc} onChange={e => setForm({ ...form, ctc: e.target.value })} />
            <select className="rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.offer_type} onChange={e => setForm({ ...form, offer_type: e.target.value })}>
              <option value="full_time">Full-time</option><option value="internship">Internship</option><option value="ppo">PPO</option>
            </select>
          </div>
          <div className="flex gap-2"><Button size="sm" onClick={add}>Save</Button><Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button></div>
        </Card>
      )}

      {offers.length === 0 ? (
        <Empty msg="No offers recorded yet. Add an offer to track your packages — leave CTC blank if it's not disclosed (we never assume zero)." />
      ) : (
        <div className="space-y-2">
          {offers.map((o) => (
            <Card key={o.id} className="flex items-center gap-3">
              <div className="flex-1">
                <div className="font-medium text-gray-800">{o.company_name || '—'}</div>
                <div className="text-xs text-gray-500">{o.role_title || ''} · {o.offer_type} · {o.status}</div>
              </div>
              <div className="text-right text-sm font-medium text-gray-800">{fmtMoney(o.ctc != null ? Number(o.ctc) : null, o.currency)}</div>
              <button onClick={() => remove(o.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={15} /></button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Company Explorer (list + Company DNA drill-down) ─────────────────────────
function CompaniesPanel({ userId }: { userId?: string }) {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [dna, setDna] = useState<any>(null);
  const [dnaLoading, setDnaLoading] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => { api('/company-explorer').then(r => r.json()).then(d => setCompanies(d.companies || [])).catch(() => {}).finally(() => setLoading(false)); }, []);

  const open = async (c: any) => {
    setSelected(c); setDna(null); setDnaLoading(true);
    try { const d = await (await api(`/company-explorer/${c.id}`)).json(); setDna(d.company ?? null); } catch { /* ignore */ } finally { setDnaLoading(false); }
  };

  if (loading) return <Empty msg="Loading companies…" />;
  if (companies.length === 0) return <Empty msg="No companies in the explorer yet. Company DNA appears once company and role data exists." />;

  const filtered = q ? companies.filter(c => c.name.toLowerCase().includes(q.toLowerCase())) : companies;

  if (selected) {
    return (
      <div className="space-y-3">
        <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"><ChevronRight size={15} className="rotate-180" /> Back to companies</button>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100"><Building2 size={22} className="text-gray-600" /></div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">{selected.name}</h2>
              <p className="text-sm text-gray-500">{[selected.industry, selected.hq_location, selected.size_band].filter(Boolean).join(' · ') || '—'}</p>
            </div>
          </div>
          {selected.description && <p className="mt-2 text-sm text-gray-600">{selected.description}</p>}
        </Card>

        {dnaLoading ? <Empty msg="Composing Company DNA from real role and market signal…" /> : dna ? (
          <>
            <Card>
              <h3 className="mb-2 font-semibold text-gray-800">Recruited Roles</h3>
              {dna.roles.length === 0 ? <Empty msg="No roles recorded for this company yet." /> : (
                <div className="space-y-1.5">
                  {dna.roles.map((r: any, i: number) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                      <span className="text-gray-800">{r.role_title} <span className="text-xs text-gray-400">×{r.drive_count}</span></span>
                      <span className="text-xs text-gray-500">
                        {r.resolved_role_id
                          ? `Role-DNA matched (${r.crosswalk_confidence ?? '—'}%${r.crosswalk_estimated ? ', estimated' : ''}) · ${r.competency_count} competencies`
                          : 'No curated Role-DNA match (abstained)'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <h3 className="mb-2 font-semibold text-gray-800">Hiring Competencies</h3>
              {dna.hiring_competencies.length === 0 ? <Empty msg="No competency signal — none of this company's roles resolved to curated Role-DNA. Nothing is guessed." /> : (
                <div className="flex flex-wrap gap-1.5">
                  {dna.hiring_competencies.map((c: any) => (
                    <span key={c.competency_id} className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      c.max_criticality === 'critical' ? 'bg-red-100 text-red-700' : c.max_criticality === 'important' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {c.competency_name || c.competency_id}{c.avg_required_level != null ? ` · L${c.avg_required_level}` : ''}
                    </span>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <h3 className="mb-2 font-semibold text-gray-800">Salary Trends</h3>
              {(!dna.salary_trends || dna.salary_trends.length === 0)
                ? <Empty msg="No market salary trends matched this company's recruited roles. Nothing is fabricated." />
                : (
                  <div className="space-y-1.5">
                    {dna.salary_trends.map((s: any, i: number) => (
                      <div key={i} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                        <span className="text-gray-800">{s.market_title} <span className="text-xs text-gray-400">· matched to {s.matched_role_title}{s.geo && s.geo !== 'unspecified' ? ` · ${s.geo}` : ''}</span></span>
                        <span className="text-xs text-gray-600">
                          {s.p25 != null ? fmtMoney(s.p25, s.currency || 'INR') : '—'} – {s.p50 != null ? fmtMoney(s.p50, s.currency || 'INR') : '—'} – {s.p75 != null ? fmtMoney(s.p75, s.currency || 'INR') : '—'}
                        </span>
                      </div>
                    ))}
                    <p className="text-xs text-gray-400">Market p25 – p50 – p75 from ingested salary data, not this company's actuals.</p>
                  </div>
                )}
            </Card>

            <div className="grid gap-3 sm:grid-cols-2">
              <Card>
                <h3 className="mb-2 font-semibold text-gray-800">Preparation Checklist</h3>
                {(!dna.prep_checklist || dna.prep_checklist.length === 0)
                  ? <Empty msg="No grounded checklist yet — appears once this company's role/eligibility data exists." />
                  : (
                    <ul className="space-y-1.5">
                      {dna.prep_checklist.map((p: any, i: number) => (
                        <li key={i} className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
                          <div className="text-gray-800">{p.item}</div>
                          <div className="text-xs text-gray-400">{p.basis}</div>
                        </li>
                      ))}
                    </ul>
                  )}
              </Card>
              <Card>
                <h3 className="mb-2 font-semibold text-gray-800">Learning Focus</h3>
                {(!dna.learning_focus || dna.learning_focus.length === 0)
                  ? <Empty msg="No learning focus yet — derived from this company's hiring competencies once they resolve." />
                  : (
                    <div className="space-y-1.5">
                      {dna.learning_focus.map((l: any) => (
                        <div key={l.competency_id} className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
                          <div className="text-gray-800">{l.competency_name || l.competency_id}{l.criticality === 'critical' ? <span className="ml-1 text-xs text-red-600">critical</span> : ''}</div>
                          <div className="text-xs text-gray-400">{l.note}</div>
                        </div>
                      ))}
                    </div>
                  )}
              </Card>
            </div>

            <Card>
              <h3 className="mb-2 font-semibold text-gray-800">Interview & Assessment Patterns</h3>
              <Empty msg={dna.interview_assessment?.reason || 'Interview / assessment patterns are not available.'} />
            </Card>

            <div className="grid gap-3 sm:grid-cols-2">
              <Card>
                <h3 className="mb-2 font-semibold text-gray-800">Your Package Signal</h3>
                {dna.package_signal.self_offers_at_company === 0
                  ? <Empty msg="You have no recorded offers at this company yet." />
                  : <div className="text-sm text-gray-700">Median of your {dna.package_signal.self_offers_at_company} offer(s): <span className="font-semibold">{fmtMoney(dna.package_signal.recorded_ctc_median, dna.package_signal.currency || 'INR')}</span></div>}
              </Card>
              <Card>
                <h3 className="mb-2 font-semibold text-gray-800">Cultural DNA</h3>
                <Empty msg={dna.cultural_dna.reason} />
              </Card>
            </div>
            <p className="text-xs text-gray-400">{dna.coverage_note}</p>
          </>
        ) : <Empty msg="Company DNA is not available." />}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2">
        <Search size={16} className="text-gray-400" />
        <input className="flex-1 text-sm outline-none" placeholder="Search companies…" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((c) => (
          <button key={c.id} onClick={() => open(c)} className="rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-gray-300 hover:shadow">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100"><Building2 size={18} className="text-gray-600" /></div>
              <div className="min-w-0">
                <div className="truncate font-semibold text-gray-800">{c.name}</div>
                <div className="truncate text-xs text-gray-500">{c.industry || '—'}</div>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-end text-xs font-medium" style={{ color: BRAND.teal ?? '#0f766e' }}>Explore DNA <ChevronRight size={14} /></div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Student placement profile (eligibility inputs) ───────────────────────────
function ProfilePanel() {
  const [p, setP] = useState<{ cgpa: string; branch: string; backlogs: string; batch_year: string; tenth_pct: string; twelfth_pct: string }>({ cgpa: '', branch: '', backlogs: '', batch_year: '', tenth_pct: '', twelfth_pct: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api('/student-profile').then(r => r.json()).then(d => {
      if (d.profile) {
        const x = d.profile;
        setP({
          cgpa: x.cgpa ?? '', branch: x.branch ?? '', backlogs: x.backlogs ?? '',
          batch_year: x.batch_year ?? '', tenth_pct: x.tenth_pct ?? '', twelfth_pct: x.twelfth_pct ?? '',
        });
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true); setSaved(false);
    try { await api('/student-profile', { method: 'PUT', body: JSON.stringify(p) }); setSaved(true); } catch { /* ignore */ } finally { setSaving(false); }
  };

  if (loading) return <Empty msg="Loading your placement profile…" />;

  const fields: { key: keyof typeof p; label: string; placeholder: string }[] = [
    { key: 'cgpa', label: 'CGPA', placeholder: 'e.g. 8.2' },
    { key: 'branch', label: 'Branch', placeholder: 'e.g. CSE' },
    { key: 'backlogs', label: 'Active backlogs', placeholder: 'e.g. 0' },
    { key: 'batch_year', label: 'Batch year', placeholder: 'e.g. 2026' },
    { key: 'tenth_pct', label: '10th %', placeholder: 'e.g. 92' },
    { key: 'twelfth_pct', label: '12th %', placeholder: 'e.g. 88' },
  ];

  return (
    <Card className="space-y-3">
      <h3 className="font-semibold text-gray-800">My Placement Profile</h3>
      <p className="text-xs text-gray-500">These details power eligibility checks. Leave a field blank if it doesn't apply — eligibility stays honest (insufficient data, never an assumed pass).</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <label key={f.key} className="text-sm">
            <span className="mb-1 block text-gray-600">{f.label}</span>
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder={f.placeholder} value={p[f.key]} onChange={e => { setP({ ...p, [f.key]: e.target.value }); setSaved(false); }} />
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={saving}>{saving ? <RefreshCw size={15} className="animate-spin" /> : null} Save profile</Button>
        {saved && <span className="flex items-center gap-1 text-sm text-green-600"><CheckCircle size={15} /> Saved</span>}
      </div>
    </Card>
  );
}

export default PlacementHubTab;
