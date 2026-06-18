import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Award, CheckCircle, Database, FlaskConical, RefreshCw, ShieldCheck,
  TrendingUp, Users, AlertTriangle, Info,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { useToast } from '@/hooks/use-toast';

const BRAND = { primary: '#344E86', accent: '#4ECDC4', success: '#10b981', warning: '#f59e0b', danger: '#ef4444' };

interface EvidenceResult {
  kind: string;
  n: number;
  r: number | null;
  ci95: [number, number] | null;
  pValue: number | null;
  groups: {
    achieved: { n: number; meanPriorScore: number | null };
    notAchieved: { n: number; meanPriorScore: number | null };
    meanScoreGap: number | null;
  } | null;
  validated: boolean;
  status: 'VALIDATED' | 'PRELIMINARY' | 'INSUFFICIENT_EVIDENCE';
  caveats: string[];
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'VALIDATED') return <Badge className="bg-green-100 text-green-700 border-green-300">VALIDATED</Badge>;
  if (status === 'PRELIMINARY') return <Badge className="bg-amber-100 text-amber-700 border-amber-300">PRELIMINARY</Badge>;
  return <Badge className="bg-gray-100 text-gray-600 border-gray-300">INSUFFICIENT EVIDENCE</Badge>;
}

function MetricCard({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg p-2.5" style={{ backgroundColor: (color || BRAND.primary) + '15' }}>
            <Icon className="h-5 w-5" style={{ color: color || BRAND.primary }} />
          </div>
          <div>
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function fmt(n: number | null, digits = 3): string {
  return n == null ? '—' : n.toFixed(digits);
}

function CohortCard({ title, isDemo, result }: { title: string; isDemo: boolean; result: EvidenceResult | undefined }) {
  if (!result) return null;
  return (
    <Card className={isDemo ? 'border-dashed border-amber-300 bg-amber-50/40' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {isDemo ? <FlaskConical className="h-4 w-4 text-amber-500" /> : <ShieldCheck className="h-4 w-4 text-[#344E86]" />}
            {title}
          </CardTitle>
          <StatusBadge status={result.status} />
        </div>
        <CardDescription>
          {isDemo
            ? 'Synthetic illustration of the pipeline — never counted as validation.'
            : 'Real captured outcomes linked to the prior score that preceded them.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div><p className="text-gray-500">Sample size (n)</p><p className="font-bold text-gray-900">{result.n}</p></div>
          <div><p className="text-gray-500">Correlation r</p><p className="font-bold text-gray-900">{fmt(result.r)}</p></div>
          <div><p className="text-gray-500">95% CI</p><p className="font-bold text-gray-900">{result.ci95 ? `${fmt(result.ci95[0], 2)} … ${fmt(result.ci95[1], 2)}` : '—'}</p></div>
          <div><p className="text-gray-500">p-value</p><p className="font-bold text-gray-900">{result.pValue == null ? '—' : result.pValue.toFixed(4)}</p></div>
        </div>
        {result.groups && (
          <div className="grid grid-cols-3 gap-3 text-sm border-t pt-3">
            <div><p className="text-gray-500">Achieved (n)</p><p className="font-semibold">{result.groups.achieved.n} · μ {fmt(result.groups.achieved.meanPriorScore, 1)}</p></div>
            <div><p className="text-gray-500">Not achieved (n)</p><p className="font-semibold">{result.groups.notAchieved.n} · μ {fmt(result.groups.notAchieved.meanPriorScore, 1)}</p></div>
            <div><p className="text-gray-500">Mean score gap</p><p className="font-semibold">{fmt(result.groups.meanScoreGap, 1)}</p></div>
          </div>
        )}
        {result.caveats.length > 0 && (
          <div className="border-t pt-3 space-y-1.5">
            {result.caveats.map((c, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                <Info className="h-3.5 w-3.5 mt-0.5 text-gray-400 shrink-0" />
                <span>{c}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function CareerEvidencePanel() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const summary = useQuery({
    queryKey: ['career-evidence-summary'],
    queryFn: async () => {
      const r = await fetch('/api/admin/career-evidence/summary?refresh=1', { credentials: 'include' });
      if (!r.ok) throw new Error('summary failed');
      return r.json();
    },
  });

  const validation = useQuery({
    queryKey: ['career-evidence-validation'],
    queryFn: async () => {
      const r = await fetch('/api/admin/career-evidence/validation?outcome_type=goal_achieved&prior_score_type=readiness&refresh=1', { credentials: 'include' });
      if (!r.ok) throw new Error('validation failed');
      return r.json();
    },
  });

  const refetchAll = () => {
    qc.invalidateQueries({ queryKey: ['career-evidence-summary'] });
    qc.invalidateQueries({ queryKey: ['career-evidence-validation'] });
  };

  const backfill = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/admin/career-evidence/backfill', { method: 'POST', credentials: 'include' });
      if (!r.ok) throw new Error('backfill failed');
      return r.json();
    },
    onSuccess: (d) => { toast({ title: 'Backfill complete', description: `${d.captured} captured from ${d.completedGoalsFound} completed goals.` }); refetchAll(); },
    onError: () => toast({ title: 'Backfill failed', variant: 'destructive' }),
  });

  const seedDemo = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/admin/career-evidence/seed-demo?n=40', { method: 'POST', credentials: 'include' });
      if (!r.ok) throw new Error('seed failed');
      return r.json();
    },
    onSuccess: (d) => { toast({ title: 'Demo cohort seeded', description: `${d.seeded} synthetic rows (never validated).` }); refetchAll(); },
    onError: () => toast({ title: 'Seed failed', variant: 'destructive' }),
  });

  const headline = validation.data?.headline;
  const real: EvidenceResult | undefined = validation.data?.real;
  const demo: EvidenceResult | undefined = validation.data?.demoPreview;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Award className="h-5 w-5" style={{ color: BRAND.primary }} />
            First Outcome Evidence Loop — Career Builder
          </h2>
          <p className="text-sm text-gray-500 mt-1 max-w-3xl">
            Links a prior MetryxOne score to a real observed outcome (goal achieved / EI lift) and reports the
            association honestly with sample size and confidence. Demo data is shown only to illustrate the
            pipeline and can never be presented as validated.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refetchAll} className="text-xs font-medium px-3 py-1.5 rounded-md border text-gray-600 flex items-center gap-1">
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
          <button onClick={() => backfill.mutate()} disabled={backfill.isPending} className="text-xs font-medium px-3 py-1.5 rounded-md text-white flex items-center gap-1" style={{ background: BRAND.primary }}>
            <Database className="h-3 w-3" /> Backfill real outcomes
          </button>
          <button onClick={() => seedDemo.mutate()} disabled={seedDemo.isPending} className="text-xs font-medium px-3 py-1.5 rounded-md border border-amber-300 text-amber-700 flex items-center gap-1">
            <FlaskConical className="h-3 w-3" /> Seed demo cohort
          </button>
        </div>
      </div>

      {/* Headline claim */}
      <Card style={{ borderLeft: `4px solid ${headline?.validated ? BRAND.success : BRAND.warning}` }}>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-start gap-3">
            {headline?.validated
              ? <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              : <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />}
            <div>
              <p className="text-sm font-semibold text-gray-900">Validated claim</p>
              <p className="text-sm text-gray-600 mt-0.5">{headline?.claim ?? 'Loading…'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Capture summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon={TrendingUp} label="Total outcomes" value={summary.data?.totalOutcomes ?? '—'} />
        <MetricCard icon={ShieldCheck} label="Real outcomes" value={summary.data?.realOutcomes ?? '—'} color={BRAND.success} sub="counted toward validation" />
        <MetricCard icon={FlaskConical} label="Demo outcomes" value={summary.data?.demoOutcomes ?? '—'} color={BRAND.warning} sub="illustration only" />
        <MetricCard icon={Users} label="Distinct real users" value={summary.data?.distinctRealUsers ?? '—'} />
      </div>

      {/* Per outcome-type validation (real cohort, prior readiness) */}
      {Array.isArray(summary.data?.validations) && summary.data.validations.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#344E86]" />
              Outcome types — honest evidence state
            </CardTitle>
            <CardDescription>
              Every captured outcome type linked to prior readiness, each with its own real sample size and
              validation status. New job-tracker milestones (interview reached, offer received) appear here as
              they accrue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-4 font-medium">Outcome type</th>
                    <th className="py-2 pr-4 font-medium">Prior score</th>
                    <th className="py-2 pr-4 font-medium">Real n</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.data.validations.map((v: { outcomeType: string; priorScoreType: string; n: number; status: string }) => (
                    <tr key={v.outcomeType} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium text-gray-900">{v.outcomeType}</td>
                      <td className="py-2 pr-4 text-gray-600">{v.priorScoreType}</td>
                      <td className="py-2 pr-4 font-semibold text-gray-900">{v.n}</td>
                      <td className="py-2 pr-4"><StatusBadge status={v.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cohorts */}
      <div className="grid grid-cols-1 gap-4">
        <CohortCard title="Real cohort — prior readiness → goal achieved" isDemo={false} result={real} />
        <CohortCard title="Demo preview cohort (synthetic)" isDemo={true} result={demo} />
      </div>

      <p className="text-xs text-gray-400">
        Validation rule: a claim is marked VALIDATED only when the real (non-demo) cohort reaches
        n ≥ {validation.data?.minValidationN ?? 30}, has both outcome groups populated, and shows a
        statistically significant association (p &lt; 0.05). Nothing is fabricated.
      </p>
    </div>
  );
}
