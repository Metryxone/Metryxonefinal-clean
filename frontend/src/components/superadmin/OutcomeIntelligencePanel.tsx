/**
 * MX-102X — Outcome Intelligence (READ-ONLY founder dashboard, super-admin).
 *
 * The unified, honest surface over the SIX realized-outcome types
 * (hiring · performance · promotion · retention · career · learning), composed from the engines that
 * already exist — it never recomputes a score and never fabricates an outcome or an accuracy claim.
 *
 * Reads GET /api/outcome-intelligence/overview + /certification + /ledger. Two axes are kept
 * STRICTLY SEPARATE: COVERAGE (realized outcomes captured — a data axis) and CONFIDENCE (empirical
 * calibration trust, ABSTAINED until ≥ k_min realized {prediction,outcome} pairs accrue). null
 * renders as "—" (missing), never a fake 0.
 *
 * The tab is only rendered when the `outcomeIntelligenceActivation` flag is ON (the dashboard probes
 * /api/outcome-intelligence/enabled before mounting), so flag-OFF is byte-identical legacy.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Target, RefreshCw, AlertTriangle, Info, CheckCircle2, Clock,
  Database, Gauge, Layers, ListChecks,
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

interface TypeBlock {
  type: string; label: string; sources: string[]; calibration_method: string;
  coverage: { realized: number | null; demo: number | null; table_present: boolean; detail: Record<string, number | null> };
  calibration: { method_applies: boolean; pairs_used: number; summary: any | null };
  validation: { evidence_backed: boolean; realized_outcomes?: number; k_min?: number; reason: string | null };
  abstained: boolean; confidence_note: string; note: string;
}
interface Overview {
  ok: boolean; version?: string; k_min?: number; types?: TypeBlock[];
  platform?: {
    type_count: number; types_with_coverage: number; realized_coverage: number | null;
    evidence_pairs: number; types_evidence_backed: number; abstained: boolean;
  };
  verdict?: string; prediction_note?: string; degraded?: boolean;
}
interface CertCheck { id: string; criterion: string; status: 'PASS' | 'PARTIAL' | 'FAIL'; detail: string; }
interface Certification { ok: boolean; verdict?: 'CERTIFIED' | 'PARTIAL' | 'FAIL'; summary?: string; checks?: CertCheck[]; degraded?: boolean; }
interface LedgerRow {
  type: string; substrate: string; outcome_kind?: string; outcome_value?: number | string;
  predicted_prob_at_decision?: number | null; is_demo?: boolean; source?: string; subject?: string; observed_at?: string;
}
interface Ledger { ok: boolean; count?: number; rows?: LedgerRow[]; degraded?: boolean; }

const METHOD_LABEL: Record<string, string> = {
  binary_calibration: 'Binary calibration',
  'binary_calibration+feeder': 'Binary calibration + feeder',
  association_correlation: 'Association (native, off-surface)',
  not_wired: 'Not wired (coverage only)',
};

const CERT_TONE: Record<string, { bg: string; fg: string }> = {
  PASS:    { bg: '#DCFCE7', fg: '#166534' },
  PARTIAL: { bg: '#FEF3C7', fg: '#92400E' },
  FAIL:    { bg: '#FEE2E2', fg: '#991B1B' },
};

function CertBadge({ status }: { status: string }) {
  const t = CERT_TONE[status] ?? { bg: '#E5E7EB', fg: '#374151' };
  return <Badge style={{ backgroundColor: t.bg, color: t.fg }} className="border-0">{status}</Badge>;
}

export default function OutcomeIntelligencePanel() {
  const overviewQ = useQuery<Overview>({
    queryKey: ['/api/outcome-intelligence/overview'],
    queryFn: async () => {
      const res = await fetch('/api/outcome-intelligence/overview', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });
  const certQ = useQuery<Certification>({
    queryKey: ['/api/outcome-intelligence/certification'],
    queryFn: async () => {
      const res = await fetch('/api/outcome-intelligence/certification', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });
  const ledgerQ = useQuery<Ledger>({
    queryKey: ['/api/outcome-intelligence/ledger', 'recent'],
    queryFn: async () => {
      const res = await fetch('/api/outcome-intelligence/ledger?limit=25', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  const data = overviewQ.data;
  const cert = certQ.data;
  const ledger = ledgerQ.data;
  const isFetching = overviewQ.isFetching || certQ.isFetching || ledgerQ.isFetching;
  const evidenceBacked = data?.platform?.abstained === false;

  const refetchAll = () => { overviewQ.refetch(); certQ.refetch(); ledgerQ.refetch(); };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold" style={{ color: BRAND.primary }}>
            <Target className="h-6 w-6" /> Outcome Intelligence
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            One honest surface unifying all six realized-outcome types — hiring, performance, promotion,
            retention, career and learning. <strong>Coverage</strong> (how many realized outcomes are
            captured) and <strong>Confidence</strong> (empirical calibration trust) are kept as
            separate axes; accuracy is <strong>abstained</strong> until realized outcomes reach k_min.
            Nothing here is fabricated.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refetchAll} disabled={isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {overviewQ.isLoading && <p className="text-sm text-gray-500">Loading outcome intelligence…</p>}
      {overviewQ.isError && (
        <Card><CardContent className="flex items-center gap-2 p-5 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4" /> Could not load outcome intelligence (the surface may be disabled).
        </CardContent></Card>
      )}

      {data && (
        <>
          {(data.degraded || cert?.degraded || ledger?.degraded) && (
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
                  {cert?.verdict === 'CERTIFIED' ? 'CERTIFIED' : 'PARTIAL — surface unified, evidence pending'}
                </p>
                <p className="mt-1 text-sm text-gray-600">{cert?.summary ?? data.verdict ?? '—'}</p>
                <p className="mt-1 text-xs text-gray-500">{data.prediction_note}</p>
              </div>
            </CardContent>
          </Card>

          {/* Platform rollup — Coverage ⟂ Confidence */}
          {data.platform && (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <Card><CardContent className="p-4">
                <p className="text-xs text-gray-500">Types unified</p>
                <p className="text-xl font-bold" style={{ color: BRAND.primary }}>{num(data.platform.type_count)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-xs text-gray-500">Types with coverage</p>
                <p className="text-xl font-bold" style={{ color: BRAND.primary }}>{num(data.platform.types_with_coverage)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-xs text-gray-500">Realized coverage <span className="text-gray-400">(data axis)</span></p>
                <p className="text-xl font-bold" style={{ color: BRAND.primary }}>{num(data.platform.realized_coverage)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-xs text-gray-500">Evidence pairs <span className="text-gray-400">(confidence axis)</span></p>
                <p className="text-xl font-bold" style={{ color: BRAND.primary }}>{num(data.platform.evidence_pairs)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-xs text-gray-500">Accuracy</p>
                <Badge className="mt-1 border-0" style={{ backgroundColor: data.platform.abstained ? '#FEF3C7' : '#DCFCE7', color: data.platform.abstained ? '#92400E' : '#166534' }}>
                  {data.platform.abstained ? 'Abstained' : 'Evidence-backed'}
                </Badge>
              </CardContent></Card>
            </div>
          )}

          {/* Per-type matrix */}
          {data.types && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base"><Layers className="h-4 w-4" /> Outcome types — Coverage ⟂ Confidence</CardTitle>
                <CardDescription>
                  Coverage = realized (non-demo) outcomes captured. Evidence pairs = calibratable
                  {' '}{`{prediction,outcome}`} pairs. "—" = substrate unreadable (never a fabricated 0).
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Sources</TableHead>
                      <TableHead className="text-right">Coverage</TableHead>
                      <TableHead className="text-right">Demo</TableHead>
                      <TableHead>Calibration</TableHead>
                      <TableHead className="text-right">Evidence pairs</TableHead>
                      <TableHead>Accuracy</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.types.map((t) => (
                      <TableRow key={t.type}>
                        <TableCell className="text-sm font-medium">{t.label}</TableCell>
                        <TableCell className="text-xs text-gray-500">{t.sources.join(', ')}</TableCell>
                        <TableCell className="text-right text-sm font-semibold">{num(t.coverage.realized)}</TableCell>
                        <TableCell className="text-right text-xs text-gray-400">{num(t.coverage.demo)}</TableCell>
                        <TableCell className="text-xs text-gray-600">{METHOD_LABEL[t.calibration_method] ?? t.calibration_method}</TableCell>
                        <TableCell className="text-right text-sm">{num(t.calibration.pairs_used)}</TableCell>
                        <TableCell>
                          <Badge className="border-0" style={{ backgroundColor: t.abstained ? '#FEF3C7' : '#DCFCE7', color: t.abstained ? '#92400E' : '#166534' }}>
                            {t.abstained ? 'Abstained' : 'Backed'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Per-type notes */}
          {data.types && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {data.types.map((t) => (
                <Card key={t.type}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Gauge className="h-4 w-4" /> {t.label}
                      {t.validation.reason && <span className="text-xs font-normal text-gray-400">— {t.validation.reason}</span>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 text-xs text-gray-600">
                    <p className="mb-2">{t.note}</p>
                    {Object.keys(t.coverage.detail).length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(t.coverage.detail).map(([k, v]) => (
                          <span key={k} className="rounded-md border border-gray-100 bg-gray-50 px-2 py-1">
                            {k}: <span className="font-semibold">{num(v)}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Certification checklist */}
          {cert?.checks && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base"><ListChecks className="h-4 w-4" /> Certification — success criteria</CardTitle>
                <CardDescription>Structural criteria PASS; empirical-accuracy criteria stay PARTIAL until realized outcomes reach k_min. Never inflated.</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>#</TableHead><TableHead>Criterion</TableHead><TableHead>Status</TableHead><TableHead>Detail</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {cert.checks.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-xs font-medium">{c.id}</TableCell>
                        <TableCell className="text-xs">{c.criterion}</TableCell>
                        <TableCell><CertBadge status={c.status} /></TableCell>
                        <TableCell className="text-xs text-gray-500">{c.detail}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Unified ledger */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4" /> Unified outcome ledger (recent)</CardTitle>
              <CardDescription>
                Subjects are irreversibly pseudonymised; demo rows are labelled and never counted as evidence.
                {ledger?.count != null ? ` ${num(ledger.count)} row(s).` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {!ledger || (ledger.rows?.length ?? 0) === 0 ? (
                <p className="flex items-center gap-2 text-sm text-gray-400">
                  <Info className="h-4 w-4" /> No realized outcomes captured yet — honest empty (outcomes accrue once the platform is used at scale).
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead><TableHead>Substrate</TableHead><TableHead>Kind</TableHead>
                      <TableHead className="text-right">Value</TableHead><TableHead className="text-right">Pred@decision</TableHead>
                      <TableHead>Demo</TableHead><TableHead>Subject</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledger.rows!.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs capitalize">{r.type}</TableCell>
                        <TableCell className="text-xs text-gray-500">{r.substrate}</TableCell>
                        <TableCell className="text-xs">{r.outcome_kind ?? '—'}</TableCell>
                        <TableCell className="text-right text-xs">{r.outcome_value ?? '—'}</TableCell>
                        <TableCell className="text-right text-xs">{r.predicted_prob_at_decision ?? '—'}</TableCell>
                        <TableCell className="text-xs">
                          {r.is_demo
                            ? <Badge className="border-0" style={{ backgroundColor: '#E5E7EB', color: '#374151' }}>demo</Badge>
                            : <span className="text-gray-400">—</span>}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-gray-500">{r.subject ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
