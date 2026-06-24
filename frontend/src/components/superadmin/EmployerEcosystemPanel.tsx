/**
 * MX-103X — Live Employer Ecosystem (READ-ONLY funnel certification, super-admin).
 *
 * One honest surface over the end-to-end employer hiring funnel
 * (Onboarding · Create Job · Role DNA · Competencies · Assessment · Candidate Match ·
 *  Interview · Hiring Decision · Outcome Tracking), composed from the engines that already exist —
 * it never recomputes a score and never fabricates a row.
 *
 * Reads GET /api/admin/employer-ecosystem/audit + /certification. Two axes are kept STRICTLY
 * SEPARATE: COVERAGE (is the stage exercisable end-to-end) and CONFIDENCE (is the data real /
 * calibrated). Demo rows (@example.com / is_demo) are counted separately and never proof of real
 * operation; null renders as "—", never a fake 0.
 *
 * The tab is only rendered when the `liveEmployerEcosystem` flag is ON (the dashboard probes
 * /api/admin/employer-ecosystem/enabled before mounting), so flag-OFF is byte-identical legacy.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Building2, RefreshCw, AlertTriangle, Info, CheckCircle2, Clock, Layers, ListChecks,
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

interface StageReport {
  id: number;
  name: string;
  criterion: string;
  status: 'operational' | 'demo_only' | 'gated' | 'gap' | 'empty';
  coverage: string;
  confidence: string;
  flagEnabled: boolean;
  totalRows?: number | null;
  realRows: number | null;
  demoRows: number | null;
  note: string;
}
interface AuditResult {
  ok: boolean;
  version?: string;
  kMin?: number;
  stages?: StageReport[];
  summary?: {
    totalStages: number; operational: number; demoOnly: number; gated: number; gap: number; empty: number;
    coverageReachable: number; realDataStages: number; outcomeCalibrated: boolean;
  };
  verdict?: 'OPERATIONAL' | 'PARTIAL';
  verdictReasons?: string[];
  demoTransparency?: string;
  degraded?: boolean;
}

const STATUS_TONE: Record<string, { bg: string; fg: string; label: string }> = {
  operational: { bg: '#DCFCE7', fg: '#166534', label: 'Operational' },
  demo_only:   { bg: '#FEF3C7', fg: '#92400E', label: 'Demo only' },
  gated:       { bg: '#E5E7EB', fg: '#374151', label: 'Gated' },
  gap:         { bg: '#FEE2E2', fg: '#991B1B', label: 'Gap' },
  empty:       { bg: '#EFF6FF', fg: '#1E40AF', label: 'Empty' },
};

function StatusBadge({ status }: { status: string }) {
  const t = STATUS_TONE[status] ?? { bg: '#E5E7EB', fg: '#374151', label: status };
  return <Badge style={{ backgroundColor: t.bg, color: t.fg }} className="border-0">{t.label}</Badge>;
}

export default function EmployerEcosystemPanel() {
  const auditQ = useQuery<AuditResult>({
    queryKey: ['/api/admin/employer-ecosystem/audit'],
    queryFn: async () => {
      const res = await fetch('/api/admin/employer-ecosystem/audit', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  const data = auditQ.data;
  const stages = data?.stages ?? [];
  const isFetching = auditQ.isFetching;
  const operational = data?.verdict === 'OPERATIONAL';

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold" style={{ color: BRAND.primary }}>
            <Building2 className="h-6 w-6" /> Live Employer Ecosystem
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            One honest certification of the end-to-end hiring funnel — onboarding, jobs, Role DNA,
            competencies, assessment, candidate match, interview, hiring decision and outcome tracking.
            <strong> Coverage</strong> (can a stage be exercised end-to-end) and <strong>Confidence</strong>
            {' '}(is the data real / calibrated) are kept as separate axes; demo data is counted separately
            and outcome confidence is <strong>abstained</strong> until realized outcomes reach k_min.
            Nothing here is fabricated.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => auditQ.refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {auditQ.isLoading && <p className="text-sm text-gray-500">Loading employer ecosystem audit…</p>}
      {auditQ.isError && (
        <Card><CardContent className="flex items-center gap-2 p-5 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4" /> Could not load the ecosystem audit (the surface may be disabled).
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
          <Card style={{ borderColor: operational ? '#86EFAC' : '#FCD34D' }}>
            <CardContent className="flex items-start gap-3 p-5">
              {operational
                ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
                : <Clock className="mt-0.5 h-5 w-5 text-amber-600" />}
              <div>
                <p className="text-sm font-semibold" style={{ color: BRAND.primary }}>
                  {operational ? 'OPERATIONAL — full funnel live on real data' : 'PARTIAL — funnel reachable, real-world data pending'}
                </p>
                {(data.verdictReasons ?? []).map((r, i) => (
                  <p key={i} className="mt-1 text-sm text-gray-600">• {r}</p>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Rollup — Coverage ⟂ Confidence */}
          {data.summary && (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Card><CardContent className="p-4">
                <p className="text-xs text-gray-500">Coverage reachable <span className="text-gray-400">(axis 1)</span></p>
                <p className="text-xl font-bold" style={{ color: BRAND.primary }}>{num(data.summary.coverageReachable)} / {num(data.summary.totalStages)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-xs text-gray-500">Stages with real data <span className="text-gray-400">(axis 2)</span></p>
                <p className="text-xl font-bold" style={{ color: BRAND.primary }}>{num(data.summary.realDataStages)} / {num(data.summary.totalStages)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-xs text-gray-500">Demo-only stages</p>
                <p className="text-xl font-bold" style={{ color: BRAND.primary }}>{num(data.summary.demoOnly)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-xs text-gray-500">Outcome confidence</p>
                <Badge className="mt-1 border-0" style={{ backgroundColor: data.summary.outcomeCalibrated ? '#DCFCE7' : '#FEF3C7', color: data.summary.outcomeCalibrated ? '#166534' : '#92400E' }}>
                  {data.summary.outcomeCalibrated ? 'Calibrated' : 'Abstained'}
                </Badge>
              </CardContent></Card>
            </div>
          )}

          {/* Per-stage funnel matrix */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base"><Layers className="h-4 w-4" /> Funnel stages — Coverage ⟂ Confidence</CardTitle>
              <CardDescription>
                Coverage = exercisable (flag on + substrate). Confidence = real (non-demo) / calibrated data.
                "—" = substrate absent (never a fabricated 0).
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Coverage</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead className="text-right">Real</TableHead>
                    <TableHead className="text-right">Demo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stages.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-xs font-medium">{s.id}</TableCell>
                      <TableCell className="text-sm font-medium">{s.name}</TableCell>
                      <TableCell><StatusBadge status={s.status} /></TableCell>
                      <TableCell className="text-xs capitalize text-gray-600">{s.coverage}</TableCell>
                      <TableCell className="text-xs capitalize text-gray-600">{s.confidence.replace('_', ' ')}</TableCell>
                      <TableCell className="text-right text-sm font-semibold">{num(s.realRows)}</TableCell>
                      <TableCell className="text-right text-xs text-gray-400">{num(s.demoRows)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Per-stage criteria + notes */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base"><ListChecks className="h-4 w-4" /> Stage criteria</CardTitle>
              <CardDescription>Each stage's success criterion and honest status note. Demo-only / abstained states are never inflated.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {stages.map((s) => (
                <div key={s.id} className="rounded-md border border-gray-100 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: BRAND.primary }}>{s.id}. {s.name}</span>
                    <StatusBadge status={s.status} />
                  </div>
                  <p className="mt-1 text-xs text-gray-600">{s.criterion}</p>
                  <p className="mt-1 text-xs text-gray-400">{s.note}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Demo transparency */}
          {data.demoTransparency && (
            <Card>
              <CardContent className="flex items-start gap-2 p-4 text-xs text-gray-500">
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0" /> {data.demoTransparency}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
