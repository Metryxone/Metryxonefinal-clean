/**
 * MX-75X — Employer Hiring Validation surface (READ-ONLY).
 *
 * The employer-scoped honest view of the closed-loop intelligence architecture: how trustworthy
 * the hiring success-probability model is for THIS org, derived from realized terminal hire
 * outcomes (Hired/Rejected) via the existing calibration engine.
 *
 * Reads GET /api/employer/tig/readiness (org-scoped, session-auth). Honest by construction:
 *   - Calibration status is cold_start / provisional / calibrated (never "calibrated" below
 *     k_min = 30 realized hire outcomes).
 *   - Coverage (does the graph data exist?) and Confidence (is the model calibrated yet?) are
 *     shown as SEPARATE axes; null renders "—", never a fabricated 0.
 *   - When evidence is insufficient an explicit "Insufficient Evidence" state is shown.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Target, RefreshCw, AlertTriangle, CheckCircle, Clock, Gauge, Database, Info,
} from 'lucide-react';

const BRAND = { primary: '#344E86', accent: '#4ECDC4', green: '#2A9D8F', orange: '#f4a261', slate: '#94a3b8' };

const CALIB_META: Record<string, { label: string; color: string; bg: string; note: string }> = {
  calibrated:  { label: 'Calibrated',   color: BRAND.green,  bg: `${BRAND.green}18`,  note: 'Probabilities empirically calibrated on ≥30 realized hire outcomes.' },
  provisional: { label: 'Provisional',  color: BRAND.orange, bg: `${BRAND.orange}18`, note: 'Learning from realized outcomes — directional until ≥30 are recorded.' },
  cold_start:  { label: 'Uncalibrated', color: BRAND.slate,  bg: `${BRAND.slate}18`,  note: 'No realized hire outcomes yet — predictions are model-derived and directional.' },
};

interface CalibBand {
  bandId: string; min: number; max: number; sampleSize: number; positives: number;
  observedRate: number | null; calibratedRate: number | null; meanPredicted: number | null; priorSource: string;
}
interface Readiness {
  structuralReadiness: number;
  activationReadiness: number;
  gap: string | null;
  calibration: {
    status: string; totalOutcomes: number; method: string;
    brier: number | null; ece: number | null; usingGlobalPrior: boolean; bands: CalibBand[];
  };
  data: { tables: number; nodes: number; edges: number; intelligenceSnapshots: number; clusters: number };
  lastBuiltAt: string | null;
}

function fixed(n: number | null | undefined, d = 3) {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toFixed(d);
}

export default function HiringValidationPanel() {
  const [data, setData] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const res = await fetch('/api/employer/tig/readiness', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const calib = data?.calibration;
  const meta = CALIB_META[calib?.status ?? 'cold_start'] ?? CALIB_META.cold_start;
  const k = 30;
  const remaining = calib ? Math.max(0, k - calib.totalOutcomes) : k;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold" style={{ color: BRAND.primary }}>
            <Target size={22} /> Hiring Validation &amp; Calibration
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            How trustworthy your hiring success-probability model is — learned from realized hire
            decisions (Hired / Rejected). Coverage (data exists) and calibration trust are separate
            axes; nothing is fabricated.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {loading && <p className="text-sm text-slate-500">Loading hiring validation…</p>}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertTriangle size={16} /> Could not load hiring validation.
        </div>
      )}

      {data && calib && (
        <>
          {/* Calibration verdict */}
          <div className="rounded-xl border p-5" style={{ borderColor: meta.color, backgroundColor: meta.bg }}>
            <div className="flex items-start gap-3">
              {calib.status === 'calibrated'
                ? <CheckCircle size={20} style={{ color: meta.color }} className="mt-0.5" />
                : <Clock size={20} style={{ color: meta.color }} className="mt-0.5" />}
              <div>
                <p className="text-sm font-bold" style={{ color: meta.color }}>{meta.label}</p>
                <p className="mt-1 text-sm text-slate-600">{meta.note}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Realized hire outcomes: <strong>{calib.totalOutcomes}</strong> / {k}
                  {remaining > 0 && ` — ${remaining} more to reach empirical calibration`}
                  {calib.usingGlobalPrior && ' · borrowing a platform-wide prior while sparse'}
                </p>
              </div>
            </div>
          </div>

          {data.gap && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
              <Info size={14} className="mt-0.5 shrink-0" /> {data.gap}
            </div>
          )}

          {/* Metric tiles */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: 'Brier score', value: fixed(calib.brier), hint: 'lower is better' },
              { label: 'ECE', value: fixed(calib.ece), hint: 'calibration error' },
              { label: 'Method', value: calib.method ?? '—', hint: 'calibration map' },
              { label: 'Structural readiness', value: `${data.structuralReadiness}%`, hint: 'engine wired' },
            ].map((t) => (
              <div key={t.label} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{t.label}</p>
                <p className="mt-1 text-2xl font-bold" style={{ color: BRAND.primary }}>{t.value}</p>
                <p className="mt-0.5 text-xs text-slate-400">{t.hint}</p>
              </div>
            ))}
          </div>

          {/* Coverage axis */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Database size={16} /> Coverage — talent graph substrate
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">Whether the data the model reads from exists yet (distinct from whether it is calibrated).</p>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
              {[
                { label: 'Nodes', v: data.data.nodes },
                { label: 'Edges', v: data.data.edges },
                { label: 'Snapshots', v: data.data.intelligenceSnapshots },
                { label: 'Clusters', v: data.data.clusters },
                { label: 'Activation', v: `${data.activationReadiness}%` },
              ].map((c) => (
                <div key={c.label} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">{c.label}</p>
                  <p className="text-lg font-semibold text-slate-700">{typeof c.v === 'number' ? c.v.toLocaleString('en-IN') : c.v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Calibration bands */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Gauge size={16} /> Calibration reliability bands
            </h3>
            {calib.bands.length === 0 ? (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-4 py-6 text-sm text-slate-400">
                <Info size={15} /> Insufficient Evidence — no realized hire outcomes recorded yet. Bands appear once Hired/Rejected decisions with a decision-time prediction accrue.
              </div>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                      <th className="py-2">Band</th><th>n</th><th>Predicted</th><th>Observed</th><th>Calibrated</th><th>Prior</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calib.bands.map((b) => (
                      <tr key={b.bandId} className="border-b border-slate-50">
                        <td className="py-2 text-slate-600">{b.min.toFixed(2)}–{b.max.toFixed(2)}</td>
                        <td className="text-slate-600">{b.sampleSize}</td>
                        <td className="text-slate-600">{fixed(b.meanPredicted, 2)}</td>
                        <td className="text-slate-600">{fixed(b.observedRate, 2)}</td>
                        <td className="text-slate-600">{fixed(b.calibratedRate, 2)}</td>
                        <td className="text-xs text-slate-400">{b.priorSource}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {data.lastBuiltAt && (
            <p className="text-xs text-slate-400">Talent graph last built: {new Date(data.lastBuiltAt).toLocaleString('en-IN')}</p>
          )}
        </>
      )}
    </div>
  );
}
