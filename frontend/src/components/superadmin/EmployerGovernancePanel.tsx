import React, { useCallback, useEffect, useState } from 'react';
import {
  Building2, Briefcase, Users, Gauge, ShieldCheck, RefreshCw,
  AlertTriangle, Info, TrendingUp,
} from 'lucide-react';

function authHeader(): HeadersInit {
  const t = localStorage.getItem('metryx_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

interface OrgCalibration {
  orgId: string;
  status: string;
  totalOutcomes: number | null;
  method: string | null;
  brier: number | null;
  ece: number | null;
}
interface Overview {
  ok: boolean;
  degraded?: boolean;
  error?: string;
  counts?: { employers: number | null; jobs: number | null; candidates: number | null; demoCandidates: number | null };
  hiringScore?: {
    scored: number;
    avgFit: number | null;
    distribution: { strong: number; developing: number; emerging: number; early: number } | null;
    note: string;
  } | null;
  calibration?: { orgs: OrgCalibration[]; calibratedOrgs: number; note: string } | null;
  substrate?: Record<string, boolean>;
  demoTransparency?: string;
  feature_flag?: Record<string, boolean>;
  generatedAt?: string;
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="p-4 bg-white border border-slate-200 rounded-xl">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
        {icon} {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

function num(v: number | null | undefined): React.ReactNode {
  return v == null ? <span className="text-slate-400 text-base font-normal">Not measurable</span> : v;
}

const BAND_COLORS: Record<string, string> = {
  strong: 'bg-emerald-500',
  developing: 'bg-amber-500',
  emerging: 'bg-orange-500',
  early: 'bg-slate-400',
};

export default function EmployerGovernancePanel() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch('/api/admin/employer-governance/overview', { headers: authHeader() });
      if (r.status === 503) { setErr('Employer competency hiring is not currently enabled (feature flag off).'); setData(null); return; }
      if (r.status === 401 || r.status === 403) { setErr('Super-admin access required.'); setData(null); return; }
      const j: Overview = await r.json();
      setData(j);
      if (j.degraded) setErr('Governance overview is temporarily degraded.');
    } catch {
      setErr('Could not load employer governance overview.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const c = data?.counts;
  const hs = data?.hiringScore;
  const cal = data?.calibration;
  const distTotal = hs?.distribution
    ? hs.distribution.strong + hs.distribution.developing + hs.distribution.emerging + hs.distribution.early
    : 0;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <Building2 size={20} className="text-indigo-600" />
            Employer Competency Governance
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Platform-wide, read-only view of the competency-driven hiring subsystem. All counts are real stored rows.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {err && (
        <div className="flex items-start gap-2 p-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{err}</span>
        </div>
      )}

      {loading && !data && <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>}

      {data && data.ok && (
        <>
          {/* Counts */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat icon={<Building2 size={14} />} label="Employers" value={num(c?.employers)} />
            <Stat icon={<Briefcase size={14} />} label="Jobs" value={num(c?.jobs)} />
            <Stat
              icon={<Users size={14} />}
              label="Candidates"
              value={num(c?.candidates)}
              sub={c?.demoCandidates != null ? `${c.demoCandidates} demo (@example.com)` : undefined}
            />
            <Stat
              icon={<ShieldCheck size={14} />}
              label="Calibrated orgs"
              value={cal ? cal.calibratedOrgs : <span className="text-slate-400 text-base font-normal">—</span>}
            />
          </div>

          {/* Hiring score distribution */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-3">
              <Gauge size={16} className="text-indigo-600" /> Hiring-score distribution
              {hs?.avgFit != null && <span className="text-xs font-normal text-slate-400">avg fit {hs.avgFit}</span>}
            </div>
            {!hs ? (
              <p className="text-sm text-slate-400">Assessment substrate not present.</p>
            ) : hs.scored === 0 || !hs.distribution ? (
              <p className="text-sm text-slate-500">{hs.note}</p>
            ) : (
              <>
                <div className="flex h-4 rounded-full overflow-hidden bg-slate-100 mb-3">
                  {(['strong', 'developing', 'emerging', 'early'] as const).map((k) => {
                    const v = hs.distribution![k];
                    const pct = distTotal > 0 ? (v / distTotal) * 100 : 0;
                    return pct > 0 ? <div key={k} className={BAND_COLORS[k]} style={{ width: `${pct}%` }} title={`${k}: ${v}`} /> : null;
                  })}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {(['strong', 'developing', 'emerging', 'early'] as const).map((k) => (
                    <div key={k} className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-sm ${BAND_COLORS[k]}`} />
                      <span className="capitalize text-slate-600">{k}</span>
                      <span className="font-semibold text-slate-800">{hs.distribution![k]}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-slate-400">{hs.note}</p>
              </>
            )}
          </div>

          {/* Calibration per org */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-3">
              <TrendingUp size={16} className="text-indigo-600" /> Calibration state by org
            </div>
            {!cal || cal.orgs.length === 0 ? (
              <p className="text-sm text-slate-500">{cal?.note || 'No calibration data.'}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-400 uppercase tracking-wide">
                      <th className="py-2 pr-4 font-medium">Org</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">Outcomes</th>
                      <th className="py-2 pr-4 font-medium">Method</th>
                      <th className="py-2 pr-4 font-medium">Brier</th>
                      <th className="py-2 font-medium">ECE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cal.orgs.map((o) => (
                      <tr key={o.orgId} className="border-t border-slate-100">
                        <td className="py-2 pr-4 font-mono text-xs text-slate-600">{o.orgId.slice(0, 12)}…</td>
                        <td className="py-2 pr-4">
                          <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${o.status === 'calibrated' ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-slate-600 bg-slate-50 border border-slate-200'}`}>
                            {o.status}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-slate-600">{o.totalOutcomes ?? '—'}</td>
                        <td className="py-2 pr-4 text-slate-600">{o.method ?? '—'}</td>
                        <td className="py-2 pr-4 text-slate-600">{o.brier ?? '—'}</td>
                        <td className="py-2 text-slate-600">{o.ece ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-slate-400">{cal.note}</p>
              </div>
            )}
          </div>

          {/* Transparency footer */}
          <div className="flex items-start gap-2 p-3 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg">
            <Info size={14} className="mt-0.5 shrink-0" />
            <div>
              <p>{data.demoTransparency}</p>
              {data.substrate && (
                <p className="mt-1">
                  Substrate: {Object.entries(data.substrate).map(([k, v]) => `${k}=${v ? '✓' : '✗'}`).join(' · ')}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
