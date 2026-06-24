/**
 * MX-75X — Outcome Validation & Calibration console (READ-ONLY, super-admin).
 *
 * The honest surface for the closed-loop intelligence architecture:
 *   Assessment → Hiring → Performance → Promotion → Retention → Outcome → Calibration → Prediction
 *
 * Reads GET /api/validation-loop/status + /api/validation-loop/calibration. The loop is structurally
 * wired and the intake is live; the employer hiring feeder is CONNECTED read-only. Empirical accuracy
 * is deliberately ABSTAINED until ≥ k_min realized NON-demo outcomes accrue — this panel NEVER
 * fabricates accuracy or outcomes. Coverage (data exists) and Confidence/Calibration-trust are shown
 * as SEPARATE axes; null renders as "—" (missing), never a fake 0.
 *
 * The tab is only rendered when the `validationLoop` flag is ON (SuperAdminDashboard probes the
 * endpoint before mounting), so flag-OFF is byte-identical legacy.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Target, RefreshCw, AlertTriangle, Info, CheckCircle2, Clock, GitBranch,
  Database, Gauge, ShieldCheck, Layers,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

const BRAND = { primary: '#344E86', accent: '#4ECDC4' };

function num(n?: number | null) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-IN').format(n);
}
function fixed(n?: number | null, d = 3) {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toFixed(d);
}

interface CalibrationBand {
  band: string; n: number; observed_rate: number | null; calibrated_rate: number | null; mean_predicted: number | null;
}
interface CalibrationSummary {
  status: string; total_outcomes: number; k_min: number; remaining_to_calibrated: number;
  brier: number | null; ece: number | null; method: string; bands: CalibrationBand[];
}
interface ValidationStatus {
  ok: boolean; degraded?: boolean; version?: string; loop?: string[];
  intake?: { table_present: boolean; by_type: Record<string, { realized: number; demo: number }> };
  calibration?: {
    realized: CalibrationSummary; connected: CalibrationSummary;
    platform_realized: CalibrationSummary; demo_illustrative: CalibrationSummary;
  };
  coverage?: Record<string, number | null>;
  prediction?: { engines_wired: string[]; empirical_accuracy_available: boolean; outcome_coverage: number; abstained: boolean; reason: string | null; note: string };
  confidence?: { engine_wired: string; kind: string; note: string };
  evidence?: { evidence_backed: boolean; realized_outcomes: number; k_min: number; reason: string | null };
  verdict?: string;
  language_policy?: { allowed: string[]; disallowed: string[]; note: string };
}

const STATUS_TONE: Record<string, { bg: string; fg: string; label: string }> = {
  calibrated:  { bg: '#DCFCE7', fg: '#166534', label: 'Calibrated' },
  provisional: { bg: '#FEF3C7', fg: '#92400E', label: 'Provisional' },
  cold_start:  { bg: '#E5E7EB', fg: '#374151', label: 'Cold start' },
};

function StatusBadge({ status }: { status?: string }) {
  const t = STATUS_TONE[status ?? ''] ?? { bg: '#E5E7EB', fg: '#374151', label: status ?? '—' };
  return <Badge style={{ backgroundColor: t.bg, color: t.fg }} className="border-0">{t.label}</Badge>;
}

const COVERAGE_LABEL: Record<string, string> = {
  validation_loop_realized: 'Validation-loop intake (realized, non-demo)',
  connected_realized: 'Employer hiring feeder (connected)',
  platform_realized: 'Platform realized (union — evidence axis)',
  career_outcomes: 'career_outcomes (candidate milestones)',
  hiring_outcomes: 'hiring_outcomes (employability graph)',
  interview_outcomes: 'interview_outcomes (employability graph)',
  ti_outcome_predictions: 'ti_outcome_predictions (prediction store)',
  tig_calibration: 'tig_calibration (talent graph)',
  employer_candidates_terminal: 'employer_candidates (terminal decisions)',
};

function CalibrationCard({ title, hint, model, icon: Icon }: { title: string; hint: string; model?: CalibrationSummary; icon: any }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm"><Icon className="h-4 w-4" /> {title}</CardTitle>
        <CardDescription className="text-xs">{hint}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {!model ? (
          <p className="text-sm text-gray-400">—</p>
        ) : (
          <>
            <div className="mb-3 flex items-center gap-3">
              <StatusBadge status={model.status} />
              <span className="text-xs text-gray-500">{num(model.total_outcomes)} outcome{model.total_outcomes === 1 ? '' : 's'}</span>
              {model.remaining_to_calibrated > 0 && (
                <span className="text-xs text-amber-700">{num(model.remaining_to_calibrated)} more to reach k≥{model.k_min}</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-md border border-gray-100 bg-gray-50 px-2.5 py-1.5">
                <span className="text-gray-500">Brier</span><div className="font-semibold">{fixed(model.brier)}</div>
              </div>
              <div className="rounded-md border border-gray-100 bg-gray-50 px-2.5 py-1.5">
                <span className="text-gray-500">ECE</span><div className="font-semibold">{fixed(model.ece)}</div>
              </div>
              <div className="rounded-md border border-gray-100 bg-gray-50 px-2.5 py-1.5">
                <span className="text-gray-500">Method</span><div className="font-semibold truncate">{model.method ?? '—'}</div>
              </div>
            </div>
            {model.bands.length > 0 && (
              <Table className="mt-3">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Band</TableHead>
                    <TableHead className="text-xs">n</TableHead>
                    <TableHead className="text-xs">Predicted</TableHead>
                    <TableHead className="text-xs">Observed</TableHead>
                    <TableHead className="text-xs">Calibrated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {model.bands.map((b) => (
                    <TableRow key={b.band}>
                      <TableCell className="text-xs">{b.band}</TableCell>
                      <TableCell className="text-xs">{num(b.n)}</TableCell>
                      <TableCell className="text-xs">{fixed(b.mean_predicted, 2)}</TableCell>
                      <TableCell className="text-xs">{fixed(b.observed_rate, 2)}</TableCell>
                      <TableCell className="text-xs">{fixed(b.calibrated_rate, 2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function OutcomeValidationPanel() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<ValidationStatus>({
    queryKey: ['/api/validation-loop/status'],
    queryFn: async () => {
      const res = await fetch('/api/validation-loop/status', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  const evidenceBacked = data?.evidence?.evidence_backed === true;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold" style={{ color: BRAND.primary }}>
            <Target className="h-6 w-6" /> Outcome Validation &amp; Calibration
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            The closed-loop intelligence surface — Assessment → Prediction → Outcome → Validation →
            Calibration → Improved Prediction. The loop is wired and the intake is live; empirical
            accuracy is <strong>abstained</strong> until enough realized non-demo outcomes accrue.
            Nothing here is fabricated.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading validation status…</p>}
      {isError && (
        <Card><CardContent className="flex items-center gap-2 p-5 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4" /> Could not load validation status (the loop may be disabled).
        </CardContent></Card>
      )}

      {data && (
        <>
          {data.degraded && (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <AlertTriangle className="h-4 w-4" /> Some sources were unreadable; figures below reflect available data only.
            </div>
          )}

          {/* Verdict banner */}
          <Card style={{ borderColor: evidenceBacked ? '#86EFAC' : '#FCD34D' }}>
            <CardContent className="flex items-start gap-3 p-5">
              {evidenceBacked
                ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
                : <Clock className="mt-0.5 h-5 w-5 text-amber-600" />}
              <div>
                <p className="text-sm font-semibold" style={{ color: BRAND.primary }}>
                  {evidenceBacked ? 'EVIDENCE-BACKED' : 'PARTIAL — loop activated, evidence pending'}
                </p>
                <p className="mt-1 text-sm text-gray-600">{data.verdict ?? '—'}</p>
                {data.evidence && (
                  <p className="mt-1 text-xs text-gray-500">
                    Realized outcomes: <strong>{num(data.evidence.realized_outcomes)}</strong> / k_min{' '}
                    <strong>{num(data.evidence.k_min)}</strong>
                    {data.evidence.reason ? ` — ${data.evidence.reason}` : ''}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* The loop chain */}
          {data.loop && (
            <Card>
              <CardContent className="flex flex-wrap items-center gap-2 p-4 text-xs">
                <GitBranch className="h-4 w-4 text-gray-400" />
                {data.loop.map((step, i) => (
                  <React.Fragment key={step}>
                    <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 font-medium text-gray-600">{step}</span>
                    {i < data.loop!.length - 1 && <span className="text-gray-300">→</span>}
                  </React.Fragment>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Calibration axis (Confidence/trust) */}
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Gauge className="h-4 w-4" /> Calibration trust (Confidence axis — distinct from accuracy)
            </h3>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <CalibrationCard title="Platform realized (union)" hint="Manual intake + connected feeders — the honest total evidence axis." model={data.calibration?.platform_realized} icon={Layers} />
              <CalibrationCard title="Connected — employer hiring feeder" hint="Terminal decision + decision-time prediction (demo excluded)." model={data.calibration?.connected} icon={GitBranch} />
              <CalibrationCard title="Manual intake (realized)" hint="Non-demo realized outcomes recorded via the intake." model={data.calibration?.realized} icon={Database} />
              <CalibrationCard title="Demo (illustrative only)" hint="Proves the mechanism RUNS — never claimed as validated." model={data.calibration?.demo_illustrative} icon={Info} />
            </div>
          </div>

          {/* Coverage axis */}
          {data.coverage && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4" /> Coverage (realized-outcome substrates)</CardTitle>
                <CardDescription>Which realized-outcome surfaces exist and how populated. "—" = table absent/unreadable (never a fabricated 0).</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Substrate</TableHead><TableHead className="text-right">Rows</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(data.coverage).map(([k, v]) => (
                      <TableRow key={k}>
                        <TableCell className="text-sm">{COVERAGE_LABEL[k] ?? k}</TableCell>
                        <TableCell className="text-right text-sm font-semibold">{num(v)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Intake by type */}
          {data.intake && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base"><Layers className="h-4 w-4" /> Outcome intake by type</CardTitle>
                <CardDescription>Realized (non-demo) vs demo per outcome type. Table present: {String(data.intake.table_present)}.</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Outcome type</TableHead><TableHead className="text-right">Realized</TableHead><TableHead className="text-right">Demo</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(data.intake.by_type).map(([t, c]) => (
                      <TableRow key={t}>
                        <TableCell className="text-sm capitalize">{t}</TableCell>
                        <TableCell className="text-right text-sm font-semibold">{num(c.realized)}</TableCell>
                        <TableCell className="text-right text-sm text-gray-400">{num(c.demo)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Prediction (abstained) + Confidence notes */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {data.prediction && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm"><Clock className="h-4 w-4" /> Prediction (accuracy abstained)</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-xs text-gray-600">
                  <p className="mb-2">
                    Empirical accuracy available:{' '}
                    <Badge className="border-0" style={{ backgroundColor: data.prediction.empirical_accuracy_available ? '#DCFCE7' : '#FEF3C7', color: data.prediction.empirical_accuracy_available ? '#166534' : '#92400E' }}>
                      {String(data.prediction.empirical_accuracy_available)}
                    </Badge>
                    {data.prediction.reason && <span className="ml-2 text-gray-500">{data.prediction.reason}</span>}
                  </p>
                  <p className="mb-2 text-gray-500">{data.prediction.note}</p>
                  <p className="font-medium text-gray-600">Engines wired:</p>
                  <ul className="ml-4 list-disc">
                    {data.prediction.engines_wired.map((e) => <li key={e}>{e}</li>)}
                  </ul>
                </CardContent>
              </Card>
            )}
            {data.confidence && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4" /> Model confidence</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-xs text-gray-600">
                  <p className="mb-1">Engine: <span className="font-medium">{data.confidence.engine_wired}</span></p>
                  <p className="mb-1">Kind: <span className="font-medium">{data.confidence.kind}</span></p>
                  <p className="text-gray-500">{data.confidence.note}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Language policy */}
          {data.language_policy && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm"><Info className="h-4 w-4" /> Language policy</CardTitle>
                <CardDescription className="text-xs">{data.language_policy.note}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 grid grid-cols-1 gap-4 text-xs md:grid-cols-2">
                <div>
                  <p className="mb-1 font-medium text-green-700">Allowed</p>
                  <ul className="ml-4 list-disc text-gray-600">{data.language_policy.allowed.map((a) => <li key={a}>{a}</li>)}</ul>
                </div>
                <div>
                  <p className="mb-1 font-medium text-red-700">Disallowed</p>
                  <ul className="ml-4 list-disc text-gray-600">{data.language_policy.disallowed.map((a) => <li key={a}>{a}</li>)}</ul>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
