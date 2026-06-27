/**
 * MX-302H — Institutional Intelligence REAL view (flag-ON path).
 *
 * Rendered ONLY when `/api/institutional-intelligence/enabled` reports
 * `{enabled:true}`. It replaces the legacy MOCK constants (BATCH_STATS /
 * DEPARTMENTS / DOMAIN_HEATMAP / TOP_EMPLOYERS / MENTOR_SESSIONS) with REAL
 * institute-scoped aggregation from the backend composer, honouring:
 *   - k-anonymity: masked cohorts (<30) render a privacy notice, NEVER a number.
 *   - null ≠ 0: a missing aggregate renders "—" / "Building cohort", never 0.
 *   - honest unavailability: placement pipeline / mentorship / domain heatmap show
 *     honest empty states when their substrate is absent — never fabricated.
 *   - tenant scope: a caller with no institute gets an honest access state (403).
 *
 * Flag-OFF never mounts this component, so the legacy dashboard stays byte-identical.
 */

import { useEffect, useState } from 'react';
import { BRAND } from '@/design-system/tokens';
import { Navbar } from '@/components/layout/Navbar';
import type { Screen } from '../../App';
import {
  Brain, Briefcase, AlertCircle, Users, FileText, Building2, LogOut,
  ShieldAlert, Info, Award, GraduationCap, TrendingUp,
} from 'lucide-react';

type Tab = 'heatmap' | 'placement' | 'gaps' | 'industry' | 'faculty' | 'mentorship' | 'reports';

interface Props { onNavigate: (screen: Screen | string) => void; }

interface ApiState<T> { status: 'loading' | 'ok' | 'forbidden' | 'error'; data: T | null; }

async function getJson(url: string): Promise<{ http: number; body: any }> {
  try {
    const res = await fetch(url, { credentials: 'include' });
    let body: any = null;
    try { body = await res.json(); } catch { body = null; }
    return { http: res.status, body };
  } catch {
    return { http: 0, body: null };
  }
}

function fmtScore(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : String(v);
}

const cohortLabel: Record<string, string> = {
  masked: 'Building privacy-safe cohort (n<30)',
  provisional: 'Provisional (30–99)',
  verified: 'Verified (≥100)',
};

function PrivacyBanner({ cohort }: { cohort: any }) {
  if (!cohort) return null;
  const masked = cohort.status === 'masked';
  return (
    <div className="rounded-xl px-4 py-2.5 flex items-center gap-2 text-[11px] font-medium"
      style={{ backgroundColor: masked ? '#fef3c7' : '#ecfdf5', color: masked ? '#92400e' : '#065f46' }}>
      <Info size={13} />
      <span>
        Cohort n={cohort.n} · {cohortLabel[cohort.status] ?? cohort.status}
        {cohort.privacy_notice ? ` — ${cohort.privacy_notice}` : ''}
      </span>
    </div>
  );
}

function EmptyState({ icon, title, notes }: { icon: React.ReactNode; title: string; notes?: string[] }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm text-center">
      <div className="flex justify-center mb-3" style={{ color: BRAND.primary }}>{icon}</div>
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      {notes && notes.length > 0 && (
        <ul className="mt-2 space-y-1">
          {notes.map((n, i) => <li key={i} className="text-[11px] text-gray-500">{n}</li>)}
        </ul>
      )}
    </div>
  );
}

export default function InstitutionCareerRealView({ onNavigate }: Props) {
  const [tab, setTab] = useState<Tab>('heatmap');
  const [loaded, setLoaded] = useState(false);
  const [overview, setOverview] = useState<ApiState<any>>({ status: 'loading', data: null });
  const [placement, setPlacement] = useState<ApiState<any>>({ status: 'loading', data: null });
  const [gaps, setGaps] = useState<ApiState<any>>({ status: 'loading', data: null });
  const [accreditation, setAccreditation] = useState<ApiState<any>>({ status: 'loading', data: null });
  const [heatmap, setHeatmap] = useState<ApiState<any>>({ status: 'loading', data: null });
  const [industry, setIndustry] = useState<ApiState<any>>({ status: 'loading', data: null });
  const [faculty, setFaculty] = useState<ApiState<any>>({ status: 'loading', data: null });

  useEffect(() => {
    let alive = true;
    const base = '/api/institutional-intelligence';
    const apply = <T,>(set: (s: ApiState<T>) => void, r: { http: number; body: any }) => {
      if (r.http === 403) { set({ status: 'forbidden', data: null }); return; }
      if (r.http === 200 && r.body) { set({ status: 'ok', data: r.body }); return; }
      set({ status: 'error', data: null });
    };
    (async () => {
      // All surfaces are role-gated server-side (403 role_not_authorised when the
      // caller's role may not read that surface). We fetch them all and let the UI
      // show only the tabs the caller is authorised for — a faculty (denied on the
      // university surfaces) still loads the Faculty Roster tab.
      const [ov, pl, gp, ac, hm, ia, fc] = await Promise.all([
        getJson(`${base}/overview`),
        getJson(`${base}/placement`),
        getJson(`${base}/gaps`),
        getJson(`${base}/accreditation`),
        getJson(`${base}/heatmap`),
        getJson(`${base}/industry-alignment`),
        getJson(`${base}/faculty`),
      ]);
      if (!alive) return;
      apply(setOverview, ov);
      apply(setPlacement, pl);
      apply(setGaps, gp);
      apply(setAccreditation, ac);
      apply(setHeatmap, hm);
      apply(setIndustry, ia);
      apply(setFaculty, fc);
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, []);

  // A surface is accessible unless the server explicitly returned 403 for its
  // backing endpoint (role_not_authorised / no_institute_scope). During loading we
  // keep everything visible, then narrow once the role is known.
  const allowed = (s: ApiState<any>) => !loaded || s.status !== 'forbidden';
  const access: Record<Tab, boolean> = {
    heatmap: allowed(overview) && allowed(heatmap),
    placement: allowed(placement),
    gaps: allowed(gaps),
    industry: allowed(industry),
    faculty: allowed(faculty),
    // Mentorship is an informational empty surface — show it to any authorised role.
    mentorship: allowed(overview) || allowed(faculty) || allowed(placement),
    reports: allowed(accreditation),
  };
  // Truly no access to ANY surface → the caller is not an institute member.
  const noAccess = loaded &&
    overview.status === 'forbidden' && placement.status === 'forbidden' &&
    gaps.status === 'forbidden' && industry.status === 'forbidden' &&
    accreditation.status === 'forbidden' && faculty.status === 'forbidden';

  const ALL_NAV: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'heatmap', label: 'Competency Heatmap', icon: <Brain size={16} /> },
    { id: 'placement', label: 'Placement Dashboard', icon: <Briefcase size={16} /> },
    { id: 'gaps', label: 'Gap Analysis', icon: <AlertCircle size={16} /> },
    { id: 'industry', label: 'Industry Alignment', icon: <TrendingUp size={16} /> },
    { id: 'faculty', label: 'Faculty Roster', icon: <GraduationCap size={16} /> },
    { id: 'mentorship', label: 'Mentorship', icon: <Users size={16} /> },
    { id: 'reports', label: 'Reports', icon: <FileText size={16} /> },
  ];
  const NAV = ALL_NAV.filter(n => access[n.id]);

  // If the active tab is not authorised for this role, fall back to the first
  // accessible one (e.g. a faculty defaulting off 'heatmap' onto 'faculty').
  useEffect(() => {
    if (loaded && !access[tab] && NAV.length > 0) setTab(NAV[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const ov = overview.data;
  const roster = ov?.roster;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8fafc' }}>
      <Navbar onNavigate={onNavigate} currentScreen="institution-career-portal" />
      <div className="flex gap-0 max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-10 min-h-[calc(100vh-80px)]">

        {/* Sidebar */}
        <aside className="w-64 shrink-0 mr-6 space-y-1 pt-4">
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm mb-4">
            <div className="flex items-center gap-2 mb-1">
              <Building2 size={16} style={{ color: BRAND.primary }} />
              <span className="text-xs font-bold text-gray-800">Institution Portal</span>
            </div>
            <div className="text-[10px] text-gray-400">
              {ov?.institute?.display_name ?? 'Career Readiness Intelligence'}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-50 grid grid-cols-2 gap-2">
              <div>
                <div className="text-base font-bold" style={{ color: BRAND.primary }}>{roster ? roster.total_students : '—'}</div>
                <div className="text-[9px] text-gray-400">Students</div>
              </div>
              <div>
                <div className="text-base font-bold" style={{ color: BRAND.green }}>{roster ? roster.assessed_students : '—'}</div>
                <div className="text-[9px] text-gray-400">Assessed</div>
              </div>
            </div>
          </div>

          {NAV.map(n => (
            <button key={n.id} onClick={() => setTab(n.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all text-left ${tab === n.id ? 'text-white shadow-sm' : 'text-gray-600 hover:bg-white hover:shadow-sm'}`}
              style={tab === n.id ? { backgroundColor: BRAND.primary } : {}}>
              {n.icon} {n.label}
            </button>
          ))}

          <div className="pt-3 mt-3 border-t border-gray-100">
            <button onClick={() => onNavigate('unified-institute-dashboard')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-500 hover:bg-white hover:text-gray-700 transition-all">
              <LogOut size={14} /> Institution Dashboard
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 pt-4 space-y-5">

          {noAccess ? (
            <EmptyState
              icon={<ShieldAlert size={28} />}
              title="Institution access required"
              notes={['This portal surfaces live, tenant-scoped institutional intelligence. Sign in with an institution administrator, placement officer, or faculty account linked to an institute to view your authorised surfaces.']}
            />
          ) : (
            <>
              {/* ── HEATMAP ── */}
              {tab === 'heatmap' && (
                <div className="space-y-5">
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">Competency Heatmap</h1>
                    <p className="text-xs text-gray-500 mt-0.5">Live batch-level competency scores — privacy-safe (k-anonymity gated)</p>
                  </div>
                  {ov?.cohort && <PrivacyBanner cohort={ov.cohort} />}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Total Students', val: roster ? roster.total_students : '—', color: BRAND.primary },
                      { label: 'Assessed', val: roster ? roster.assessed_students : '—', color: BRAND.accent },
                      { label: 'High Readiness', val: ov?.readiness ? ov.readiness.high_readiness : '—', color: BRAND.green },
                      { label: 'At Risk', val: ov?.readiness ? ov.readiness.at_risk : '—', color: BRAND.red },
                    ].map(k => (
                      <div key={k.label} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                        <div className="text-2xl font-bold" style={{ color: k.color }}>{k.val}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">{k.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Department (=batch) breakdown */}
                  <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-50">
                      <h3 className="text-sm font-semibold text-gray-800">Readiness by Batch</h3>
                      <p className="text-[10px] text-gray-400 mt-0.5">{ov?.grouping_note ?? 'Aggregated by batch'}</p>
                    </div>
                    {ov?.departments && ov.departments.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-gray-50">
                              <th className="text-left py-3 px-4 text-[10px] font-semibold text-gray-500">Batch</th>
                              <th className="text-center py-3 px-3 text-[10px] font-semibold text-gray-500">Students</th>
                              <th className="text-center py-3 px-3 text-[10px] font-semibold text-gray-500">Assessed</th>
                              <th className="text-center py-3 px-3 text-[10px] font-semibold text-gray-500">Avg Readiness</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ov.departments.map((d: any) => (
                              <tr key={d.batch_id} className="border-b border-gray-50">
                                <td className="py-2.5 px-4 text-xs font-medium text-gray-700">{d.name}</td>
                                <td className="py-2.5 px-3 text-center text-gray-600">{d.students}</td>
                                <td className="py-2.5 px-3 text-center text-gray-600">{d.assessed}</td>
                                <td className="py-2.5 px-3 text-center font-bold text-gray-800">
                                  {d.avg_readiness === null
                                    ? <span className="text-[10px] font-medium text-amber-600">masked</span>
                                    : fmtScore(d.avg_readiness)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-6 text-center text-[11px] text-gray-500">
                        {(ov?.notes && ov.notes[0]) || 'No batches with assessed students yet.'}
                      </div>
                    )}
                  </div>

                  {/* Domain heatmap — real per-domain competency aggregation */}
                  {heatmap.data?.cohort && <PrivacyBanner cohort={heatmap.data.cohort} />}
                  {heatmap.data?.available && heatmap.data.domains?.length > 0 ? (
                    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                      <div className="p-4 border-b border-gray-50">
                        <h3 className="text-sm font-semibold text-gray-800">Competency by Domain</h3>
                        <p className="text-[10px] text-gray-400 mt-0.5">Cohort-average proficiency per competency domain — each domain k-anonymity gated</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-gray-50">
                              <th className="text-left py-3 px-4 text-[10px] font-semibold text-gray-500">Domain</th>
                              <th className="text-center py-3 px-3 text-[10px] font-semibold text-gray-500">Assessed</th>
                              <th className="text-center py-3 px-3 text-[10px] font-semibold text-gray-500">Avg Score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {heatmap.data.domains.map((d: any) => (
                              <tr key={d.domain} className="border-b border-gray-50">
                                <td className="py-2.5 px-4 text-xs font-medium text-gray-700">{d.label}</td>
                                <td className="py-2.5 px-3 text-center text-gray-600">{d.n}</td>
                                <td className="py-2.5 px-3 text-center font-bold text-gray-800">
                                  {d.avg_score === null
                                    ? <span className="text-[10px] font-medium text-amber-600">masked</span>
                                    : fmtScore(d.avg_score)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    heatmap.data && (
                      <EmptyState
                        icon={<Brain size={24} />}
                        title="Domain heatmap not yet available"
                        notes={heatmap.data.notes ?? ['Per-domain competency data required.']}
                      />
                    )
                  )}
                </div>
              )}

              {/* ── PLACEMENT ── */}
              {tab === 'placement' && (
                <div className="space-y-5">
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">Placement Dashboard</h1>
                    <p className="text-xs text-gray-500 mt-0.5">Live placement outcomes — privacy-safe (k-anonymity gated)</p>
                  </div>
                  {placement.data?.cohort && <PrivacyBanner cohort={placement.data.cohort} />}
                  {placement.data && !placement.data.pipeline_available && (
                    <div className="rounded-xl px-4 py-2.5 flex items-center gap-2 text-[11px] font-medium"
                      style={{ backgroundColor: '#eff6ff', color: '#1e40af' }}>
                      <Info size={13} />
                      <span>Employer drive/application pipeline not provisioned for this institute — outcomes shown reflect linked employer offers only.</span>
                    </div>
                  )}
                  {placement.data?.offers ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: 'Offers', val: placement.data.offers.offers, color: BRAND.primary },
                        { label: 'Placed', val: placement.data.offers.placed, color: BRAND.green },
                        { label: 'Placement Rate', val: placement.data.offers.placement_rate === null ? 'masked' : `${placement.data.offers.placement_rate}%`, color: BRAND.accent },
                        { label: 'Avg CTC', val: placement.data.offers.avg_ctc === null ? 'masked' : `₹${placement.data.offers.avg_ctc}`, color: BRAND.green },
                      ].map(k => (
                        <div key={k.label} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                          <div className="text-xl font-bold" style={{ color: k.color }}>{k.val}</div>
                          <div className="text-[10px] text-gray-500 mt-0.5">{k.label}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={<Briefcase size={24} />}
                      title="No placement outcomes recorded yet"
                      notes={placement.data?.notes ?? ['Employer offers linked to this institute will appear here.']}
                    />
                  )}
                </div>
              )}

              {/* ── GAPS ── */}
              {tab === 'gaps' && (
                <div className="space-y-5">
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">Gap Analysis</h1>
                    <p className="text-xs text-gray-500 mt-0.5">Institution-wide competency &amp; readiness gaps — privacy-safe (k-anonymity gated)</p>
                  </div>

                  {/* PRIMARY — real competency-domain gaps (onto_competency_scores) */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-800">Lowest-scoring competency domains</h3>
                      {gaps.data?.competency_cohort && (
                        <span className="text-[10px] text-gray-400">cohort n={gaps.data.competency_cohort.n} · {cohortLabel[gaps.data.competency_cohort.status] ?? gaps.data.competency_cohort.status}</span>
                      )}
                    </div>
                    {gaps.data?.competency_gaps && gaps.data.competency_gaps.length > 0 ? (
                      gaps.data.competency_gaps.map((g: any) => (
                        <div key={g.domain} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-800">{g.area}</span>
                          <span className="text-lg font-bold" style={{ color: BRAND.red }}>{fmtScore(g.avg_score)}</span>
                        </div>
                      ))
                    ) : (
                      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-[11px] text-gray-500">
                        Competency-domain gaps unavailable — a privacy-safe assessed competency cohort is required.
                      </div>
                    )}
                  </div>

                  {/* SECONDARY — coarse readiness-block gaps */}
                  {gaps.data?.readiness_gaps && gaps.data.readiness_gaps.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-800">Readiness blocks</h3>
                        {gaps.data?.readiness_cohort && (
                          <span className="text-[10px] text-gray-400">cohort n={gaps.data.readiness_cohort.n} · {cohortLabel[gaps.data.readiness_cohort.status] ?? gaps.data.readiness_cohort.status}</span>
                        )}
                      </div>
                      {gaps.data.readiness_gaps.map((g: any) => (
                        <div key={g.area} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-800">{g.area}</span>
                          <span className="text-lg font-bold" style={{ color: BRAND.accent }}>{fmtScore(g.avg_score)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {gaps.data && (!gaps.data.competency_gaps || gaps.data.competency_gaps.length === 0) &&
                   (!gaps.data.readiness_gaps || gaps.data.readiness_gaps.length === 0) && (
                    <EmptyState
                      icon={<AlertCircle size={24} />}
                      title="Gap analysis not yet available"
                      notes={gaps.data?.notes ?? ['A privacy-safe assessed cohort is required.']}
                    />
                  )}
                </div>
              )}

              {/* ── INDUSTRY ALIGNMENT ── */}
              {tab === 'industry' && (
                <div className="space-y-5">
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">Industry Alignment</h1>
                    <p className="text-xs text-gray-500 mt-0.5">Future-readiness alignment &amp; recurring industry gaps (industry-gap engine) — privacy-safe</p>
                  </div>
                  {industry.data?.cohort && <PrivacyBanner cohort={industry.data.cohort} />}
                  <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <div className="text-[10px] text-gray-500 mb-1">Alignment score (future-readiness, market-weighted)</div>
                    <div className="text-3xl font-bold" style={{ color: BRAND.primary }}>
                      {industry.data?.alignment_score === null || industry.data?.alignment_score === undefined
                        ? <span className="text-base text-amber-600">masked / unavailable</span>
                        : fmtScore(industry.data.alignment_score)}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-800">Recurring industry gap competencies</h3>
                      {industry.data?.industry_gap_cohort && (
                        <span className="text-[10px] text-gray-400">contributing n={industry.data.industry_gap_cohort.n} · {cohortLabel[industry.data.industry_gap_cohort.status] ?? industry.data.industry_gap_cohort.status}</span>
                      )}
                    </div>
                    {industry.data?.top_industry_gaps && industry.data.top_industry_gaps.length > 0 ? (
                      industry.data.top_industry_gaps.map((g: any, i: number) => (
                        <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-800">{g.competency}</span>
                          <span className="text-[11px] text-gray-500">{g.students_affected} affected · avg gap {fmtScore(g.avg_gap)}</span>
                        </div>
                      ))
                    ) : (
                      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-[11px] text-gray-500">
                        {(industry.data?.notes && industry.data.notes[industry.data.notes.length - 1]) || 'No recurring industry gaps derivable from current readiness snapshots.'}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── FACULTY ROSTER ── */}
              {tab === 'faculty' && (
                <div className="space-y-5">
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">Faculty Roster</h1>
                    <p className="text-xs text-gray-500 mt-0.5">Per-student readiness for your students — roster-level (not a peer benchmark)</p>
                  </div>
                  {faculty.data?.students && faculty.data.students.length > 0 ? (
                    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                      <div className="p-4 border-b border-gray-50 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-800">Students</h3>
                        <span className="text-[10px] text-gray-400">{faculty.data.assessed_count}/{faculty.data.total} assessed</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-gray-50">
                              <th className="text-left py-3 px-4 text-[10px] font-semibold text-gray-500">Student</th>
                              <th className="text-left py-3 px-3 text-[10px] font-semibold text-gray-500">Code</th>
                              <th className="text-center py-3 px-3 text-[10px] font-semibold text-gray-500">Overall</th>
                              <th className="text-center py-3 px-3 text-[10px] font-semibold text-gray-500">Band</th>
                            </tr>
                          </thead>
                          <tbody>
                            {faculty.data.students.map((s: any) => (
                              <tr key={s.student_id} className="border-b border-gray-50">
                                <td className="py-2.5 px-4 text-xs font-medium text-gray-700">{s.full_name}</td>
                                <td className="py-2.5 px-3 text-gray-500">{s.student_code ?? '—'}</td>
                                <td className="py-2.5 px-3 text-center font-bold text-gray-800">
                                  {s.assessed ? fmtScore(s.overall_score) : <span className="text-[10px] text-gray-400">not assessed</span>}
                                </td>
                                <td className="py-2.5 px-3 text-center text-gray-600">{s.band ?? '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <EmptyState
                      icon={<GraduationCap size={24} />}
                      title="No students in scope"
                      notes={faculty.data?.notes ?? ['Students linked to your institute will appear here.']}
                    />
                  )}
                </div>
              )}

              {/* ── MENTORSHIP ── */}
              {tab === 'mentorship' && (
                <EmptyState
                  icon={<Users size={28} />}
                  title="Mentorship analytics not yet wired to live data"
                  notes={['Live mentor-session analytics are not part of this intelligence layer. This surface intentionally shows no fabricated sessions.']}
                />
              )}

              {/* ── REPORTS ── */}
              {tab === 'reports' && (
                <div className="space-y-5">
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">Reports &amp; Accreditation</h1>
                    <p className="text-xs text-gray-500 mt-0.5">Live accreditation records on file for this institute</p>
                  </div>
                  {accreditation.data?.available ? (
                    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-50">
                            <th className="text-left py-3 px-4 text-[10px] font-semibold text-gray-500">Authority</th>
                            <th className="text-left py-3 px-3 text-[10px] font-semibold text-gray-500">Grade</th>
                            <th className="text-left py-3 px-3 text-[10px] font-semibold text-gray-500">Valid Until</th>
                          </tr>
                        </thead>
                        <tbody>
                          {accreditation.data.accreditations.map((a: any, i: number) => (
                            <tr key={i} className="border-b border-gray-50">
                              <td className="py-2.5 px-4 font-medium text-gray-700 flex items-center gap-1.5"><Award size={13} style={{ color: BRAND.primary }} /> {a.authority}</td>
                              <td className="py-2.5 px-3 text-gray-600">{a.grade}</td>
                              <td className="py-2.5 px-3 text-gray-600">{a.valid_until ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState
                      icon={<FileText size={24} />}
                      title="No accreditation records on file"
                      notes={accreditation.data?.notes ?? ['Accreditation records for this institute will appear here.']}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
