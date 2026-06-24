import React, { useCallback, useEffect, useState } from 'react';
import {
  Briefcase, Target, ShieldCheck, AlertTriangle, ClipboardList,
  TrendingUp, RefreshCw, Info, CheckCircle2, CircleDashed, Gauge,
} from 'lucide-react';

const LS_TARGET_ROLE = 'mx-career-target-role';

function authHeader(): HeadersInit {
  const t = localStorage.getItem('metryx_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

interface Requirement {
  competencyKey?: string;
  competencyName?: string;
  targetLevel?: number | null;
  candidateLevel?: number | null;
  attainmentPct?: number | null;
  assessed?: boolean;
  status?: string;
}
interface Gap {
  competencyKey?: string;
  competencyName?: string;
  targetLevel?: number | null;
  candidateLevel?: number | null;
  gapBand?: string;
  shortfall?: number | null;
}
interface Readiness {
  available?: boolean;
  readinessScore?: number | null;
  band?: string | null;
  coveragePct?: number | null;
  note?: string;
}
interface Confidence {
  state?: string;
  realizedOutcomes?: number | null;
  minRequired?: number | null;
  note?: string;
}
interface ReadinessPayload {
  ok: boolean;
  available?: boolean;
  subjectId?: string;
  targetRole?: string;
  roleResolved?: boolean;
  requirementSource?: string;
  competencyMatch?: number | null;
  fitBand?: string | null;
  assessedBand?: string | null;
  coverage?: { pct?: number | null; matched?: number | null; total?: number | null; sufficient?: boolean; note?: string };
  readiness?: Readiness;
  confidence?: Confidence;
  requirements?: Requirement[];
  developmentPlan?: { priorityGaps?: Gap[]; evidenceToBuild?: Requirement[]; focusAreas?: any[] };
  disclaimer?: string;
  note?: string;
  version?: string;
  feature_flag?: Record<string, boolean>;
  generatedAt?: string;
}

const BAND_TONE: Record<string, string> = {
  strong_fit: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  developing_fit: 'text-amber-700 bg-amber-50 border-amber-200',
  emerging_fit: 'text-orange-700 bg-orange-50 border-orange-200',
  early_fit: 'text-slate-700 bg-slate-50 border-slate-200',
};
const GAP_TONE: Record<string, string> = {
  critical: 'text-red-700 bg-red-50 border-red-200',
  significant: 'text-orange-700 bg-orange-50 border-orange-200',
  moderate: 'text-amber-700 bg-amber-50 border-amber-200',
  minor: 'text-slate-700 bg-slate-50 border-slate-200',
};

function prettyBand(b?: string | null): string {
  if (!b) return '—';
  return b.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function Pct({ v }: { v?: number | null }) {
  if (v == null || !Number.isFinite(v)) return <span className="text-slate-400">Not measured</span>;
  return <span>{Math.round(v)}%</span>;
}

export default function HiringReadinessTab({ userId }: { userId: string }) {
  const [data, setData] = useState<ReadinessPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [role, setRole] = useState<string>(() => {
    try { return localStorage.getItem(LS_TARGET_ROLE) || ''; } catch { return ''; }
  });
  const [roleInput, setRoleInput] = useState(role);

  const load = useCallback(async (targetRole: string) => {
    if (!userId) return;
    setLoading(true);
    setErr(null);
    try {
      const qs = targetRole ? `?role=${encodeURIComponent(targetRole)}` : '';
      const r = await fetch(`/api/v2/candidate/competency-readiness/${userId}${qs}`, { headers: authHeader() });
      if (r.status === 503) {
        setErr('This feature is not currently enabled.');
        setData(null);
        return;
      }
      const j: ReadinessPayload = await r.json();
      setData(j);
      if (!j.ok && j.note) setErr(j.note);
    } catch {
      setErr('Could not load hiring readiness.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(role); }, [load, role]);

  const applyRole = () => {
    const next = roleInput.trim();
    setRole(next);
    try { next ? localStorage.setItem(LS_TARGET_ROLE, next) : localStorage.removeItem(LS_TARGET_ROLE); } catch {}
  };

  const cov = data?.coverage;
  const gaps = data?.developmentPlan?.priorityGaps ?? [];
  const evidence = data?.developmentPlan?.evidenceToBuild ?? [];
  const reqs = data?.requirements ?? [];

  return (
    <div className="p-4 md:p-6 overflow-auto h-full space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <Gauge size={20} className="text-indigo-600" />
            Hiring Readiness
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            A developmental view of how your assessed competencies map to a target role. Not a hiring decision.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={roleInput}
            onChange={(e) => setRoleInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') applyRole(); }}
            placeholder="Target role (e.g. Software Engineer)"
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg w-60 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <button
            onClick={applyRole}
            className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
          >
            Analyze
          </button>
          <button
            onClick={() => load(role)}
            className="p-2 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {err && (
        <div className="flex items-start gap-2 p-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{err}</span>
        </div>
      )}

      {loading && !data && (
        <div className="p-8 text-center text-slate-400 text-sm">Loading readiness…</div>
      )}

      {data && data.ok && data.available === false && (
        <div className="flex items-start gap-2 p-4 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg">
          <Info size={16} className="mt-0.5 shrink-0 text-slate-400" />
          <span>{data.note || 'Complete a competency assessment to see your role readiness.'}</span>
        </div>
      )}

      {data && data.ok && data.available && (
        <>
          {/* Top summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 bg-white border border-slate-200 rounded-xl">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
                <Briefcase size={14} /> Target role
              </div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{data.targetRole || '—'}</div>
              <div className="mt-1 text-xs text-slate-400">
                {data.roleResolved ? `Requirements: ${data.requirementSource || 'role DNA'}` : 'Role not resolved to curated requirements'}
              </div>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
                <Target size={14} /> Competency match
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900"><Pct v={data.competencyMatch} /></div>
              <div className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${BAND_TONE[data.fitBand || ''] || 'text-slate-600 bg-slate-50 border-slate-200'}`}>
                {data.fitBand ? prettyBand(data.fitBand) : 'Coverage too thin for a band'}
              </div>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
                <ClipboardList size={14} /> Requirement coverage
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900"><Pct v={cov?.pct} /></div>
              <div className="mt-1 text-xs text-slate-400">
                {cov?.matched != null && cov?.total != null ? `${cov.matched}/${cov.total} requirements assessed` : 'Not measured'}
                {cov?.sufficient === false && <span className="text-amber-600"> · thin</span>}
              </div>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
                <ShieldCheck size={14} /> Confidence
              </div>
              <div className="mt-2 text-lg font-semibold text-slate-900 capitalize">{data.confidence?.state || 'Unknown'}</div>
              <div className="mt-1 text-xs text-slate-400">
                {data.confidence?.realizedOutcomes != null
                  ? `${data.confidence.realizedOutcomes} realized outcome(s) ${data.confidence.state === 'calibrated' ? 'calibrated' : 'recorded (calibration pending)'}`
                  : 'Calibration pending'}
              </div>
            </div>
          </div>

          {/* Readiness band */}
          {data.readiness && (
            <div className="p-4 bg-white border border-slate-200 rounded-xl">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-2">
                <TrendingUp size={16} className="text-indigo-600" /> Role readiness
              </div>
              {data.readiness.available ? (
                <div className="flex items-center gap-4">
                  <div className="text-3xl font-bold text-slate-900"><Pct v={data.readiness.readinessScore} /></div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${BAND_TONE[data.readiness.band || ''] || 'text-slate-600 bg-slate-50 border-slate-200'}`}>
                    {prettyBand(data.readiness.band)}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-slate-500">{data.readiness.note || 'Readiness not yet measurable.'}</p>
              )}
            </div>
          )}

          {/* Development plan: priority gaps */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-3">
              <AlertTriangle size={16} className="text-amber-600" /> Priority development areas
              <span className="text-xs font-normal text-slate-400">(measured gaps below target)</span>
            </div>
            {gaps.length === 0 ? (
              <p className="text-sm text-slate-500 flex items-center gap-2">
                <CheckCircle2 size={15} className="text-emerald-500" />
                No measured gaps below target for assessed requirements.
              </p>
            ) : (
              <ul className="space-y-2">
                {gaps.map((g, i) => (
                  <li key={g.competencyKey || i} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <div>
                      <div className="text-sm font-medium text-slate-800">{g.competencyName || g.competencyKey}</div>
                      <div className="text-xs text-slate-400">
                        Current {g.candidateLevel ?? '—'} · Target {g.targetLevel ?? '—'}
                      </div>
                    </div>
                    {g.gapBand && (
                      <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${GAP_TONE[g.gapBand] || 'text-slate-600 bg-white border-slate-200'}`}>
                        {prettyBand(g.gapBand)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Evidence to build (unassessed) */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-3">
              <CircleDashed size={16} className="text-slate-500" /> Evidence still to build
              <span className="text-xs font-normal text-slate-400">(role requirements not yet assessed)</span>
            </div>
            {evidence.length === 0 ? (
              <p className="text-sm text-slate-500">All resolved role requirements have assessment data.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {evidence.map((r, i) => (
                  <span key={r.competencyKey || i} className="px-2.5 py-1 rounded-md text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200">
                    {r.competencyName || r.competencyKey}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Full requirement breakdown */}
          {reqs.length > 0 && (
            <div className="p-4 bg-white border border-slate-200 rounded-xl">
              <div className="text-sm font-semibold text-slate-800 mb-3">Requirement breakdown</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-400 uppercase tracking-wide">
                      <th className="py-2 pr-4 font-medium">Competency</th>
                      <th className="py-2 pr-4 font-medium">Target</th>
                      <th className="py-2 pr-4 font-medium">You</th>
                      <th className="py-2 pr-4 font-medium">Attainment</th>
                      <th className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reqs.map((r, i) => (
                      <tr key={r.competencyKey || i} className="border-t border-slate-100">
                        <td className="py-2 pr-4 text-slate-800">{r.competencyName || r.competencyKey}</td>
                        <td className="py-2 pr-4 text-slate-600">{r.targetLevel ?? '—'}</td>
                        <td className="py-2 pr-4 text-slate-600">{r.assessed ? (r.candidateLevel ?? '—') : <span className="text-slate-400">n/a</span>}</td>
                        <td className="py-2 pr-4 text-slate-600"><Pct v={r.attainmentPct} /></td>
                        <td className="py-2">
                          {r.assessed
                            ? <span className="text-emerald-600 text-xs font-medium">Assessed</span>
                            : <span className="text-slate-400 text-xs">Unassessed</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Disclaimer + provenance */}
          <div className="flex items-start gap-2 p-3 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg">
            <Info size={14} className="mt-0.5 shrink-0" />
            <div>
              <p>{data.disclaimer}</p>
              {cov?.note && <p className="mt-1">{cov.note}</p>}
              {data.confidence?.note && <p className="mt-1">{data.confidence.note}</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
