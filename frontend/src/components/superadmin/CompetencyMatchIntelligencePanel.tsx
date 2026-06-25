import { BRAND } from '@/design-system/tokens';
/**
 * MX-107A — Competency Match Intelligence (READ-ONLY super-admin panel).
 *
 * One legible surface over the unified competency crosswalk: candidate Competency Assessment →
 * employer Role DNA → readiness → hiring fit → career recommendations, all running off ONE
 * canonical framework. It COMPOSES already-built engines and recomputes nothing.
 *
 * Reads GET /api/admin/competency-match-intelligence/{coverage,super-admin,founder,certification}.
 * PRECISE (comp_*-level mapping) and OPERATIONAL (domain-proxy) coverage are shown as SEPARATE
 * axes — canonical precision is never inflated by the proxy. null renders as "—" (not a fake 0).
 *
 * The tab only mounts when the `competencyMatchIntelligence` flag is ON (the dashboard probes
 * /enabled first), so flag-OFF is byte-identical legacy.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { GitBranch, RefreshCw, AlertTriangle, Info, ShieldCheck, Layers, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';



function pct(v?: number | null) {
  return v == null ? '—' : `${v}%`;
}
function num(v?: number | null) {
  return v == null ? '—' : new Intl.NumberFormat('en-IN').format(v);
}

const TONE: Record<string, { bg: string; fg: string }> = {
  PASS: { bg: '#DCFCE7', fg: '#166534' },
  PARTIAL: { bg: '#FEF3C7', fg: '#92400E' },
  FAIL: { bg: '#FEE2E2', fg: '#991B1B' },
};
function VerdictBadge({ status }: { status?: string }) {
  const t = TONE[status ?? ''] ?? { bg: '#E5E7EB', fg: '#374151' };
  return <Badge style={{ backgroundColor: t.bg, color: t.fg }} className="border-0">{status ?? '—'}</Badge>;
}

function useGet<T>(path: string) {
  return useQuery<T>({
    queryKey: [path],
    queryFn: async () => {
      const res = await fetch(path, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });
}

export default function CompetencyMatchIntelligencePanel() {
  const base = '/api/admin/competency-match-intelligence';
  const coverageQ = useGet<any>(`${base}/coverage`);
  const superAdminQ = useGet<any>(`${base}/super-admin`);
  const founderQ = useGet<any>(`${base}/founder`);
  const certQ = useGet<any>(`${base}/certification`);

  const refetchAll = () => {
    coverageQ.refetch();
    superAdminQ.refetch();
    founderQ.refetch();
    certQ.refetch();
  };

  const loading = coverageQ.isLoading || superAdminQ.isLoading || founderQ.isLoading || certQ.isLoading;
  const cov = coverageQ.data;
  const sa = superAdminQ.data;
  const founder = founderQ.data;
  const cert = certQ.data;
  const h = cov?.headline;

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: `${BRAND.primary}15` }}>
            <GitBranch className="h-6 w-6" style={{ color: BRAND.primary }} />
          </div>
          <div>
            <h1 className="text-xl font-semibold" style={{ color: BRAND.primary }}>Competency Match Intelligence</h1>
            <p className="text-sm text-muted-foreground max-w-3xl">
              The unified competency crosswalk — assessment → competency → Role DNA → readiness → match → recommendation —
              running off ONE canonical framework. Read-only composition; PRECISE and OPERATIONAL coverage are kept separate.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {cert?.overall_verdict && <VerdictBadge status={cert.overall_verdict} />}
          <Button variant="outline" size="sm" onClick={refetchAll} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Honesty note */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground rounded-md border p-3 bg-muted/30">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          Developmental signals only — NOT hiring/promotion predictions. <b>Precise</b> = competencies/requirements with an
          authored question→competency map. <b>Operational</b> = domain-proxy reachable today. Reaching 100% precise is a
          data-mapping effort, never fabricated by this surface. <code>—</code> means not measurable (never a fake 0).
        </span>
      </div>

      {/* Headline axes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" /> Headline axes (Precise ⟂ Operational)</CardTitle>
          <CardDescription>Never composited into one number.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Precise competency coverage', value: pct(h?.precise_competency_coverage_pct), sub: 'mapped / genome' },
              { label: 'Operational competency coverage', value: pct(h?.operational_competency_coverage_pct), sub: 'domain-proxy' },
              { label: 'Precise requirement reachability', value: pct(h?.precise_requirement_reachability_pct), sub: 'Role DNA reqs' },
              { label: 'Operational requirement reachability', value: pct(h?.operational_requirement_reachability_pct), sub: 'domain-proxy' },
            ].map((m) => (
              <div key={m.label} className="rounded-lg border p-3">
                <div className="text-2xl font-semibold" style={{ color: BRAND.primary }}>{m.value}</div>
                <div className="text-xs font-medium mt-1">{m.label}</div>
                <div className="text-[11px] text-muted-foreground">{m.sub}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Phase 1 — Crosswalk coverage hops */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Layers className="h-4 w-4" /> Phase 1 — Crosswalk coverage (hop by hop)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hop</TableHead>
                <TableHead>Axis</TableHead>
                <TableHead className="text-right">Coverage</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(cov?.hops ?? []).map((hop: any) => (
                <TableRow key={hop.hop}>
                  <TableCell className="font-medium align-top">{hop.hop}</TableCell>
                  <TableCell className="align-top"><Badge variant="outline">{hop.axis}</Badge></TableCell>
                  <TableCell className="text-right align-top">{pct(hop.coverage_pct)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground align-top max-w-md">{hop.note}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Phase 5 — Super admin coverage console */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Phase 5 — Coverage console</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sa?.coverage && Object.entries<any>(sa.coverage).map(([k, c]) => (
            <div key={k} className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{c.label}</span>
                <Badge variant={c.available ? 'default' : 'secondary'}>{c.available ? 'available' : 'absent'}</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{c.note}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Phase 6 — Founder dashboard */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Phase 6 — Founder dashboard</CardTitle>
          <CardDescription>
            Match reachability (share of role weight the engine can score) — NOT a live candidate→role match.
            {founder?.liveMatch && <> Live employer match: <b>{founder.liveMatch.state}</b>.</>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-lg border p-3">
              <div className="text-2xl font-semibold" style={{ color: BRAND.primary }}>{pct(founder?.matchReachability?.average_precise_reachability_pct)}</div>
              <div className="text-xs font-medium mt-1">Avg precise reachability</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-2xl font-semibold" style={{ color: BRAND.primary }}>{pct(founder?.matchReachability?.average_operational_reachability_pct)}</div>
              <div className="text-xs font-medium mt-1">Avg operational reachability</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-2xl font-semibold" style={{ color: BRAND.primary }}>{num(founder?.roleDnaHealth?.roles_with_dna)}</div>
              <div className="text-xs font-medium mt-1">Roles with DNA</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-2xl font-semibold" style={{ color: BRAND.primary }}>{num(founder?.competencyCoverage?.genome_competencies)}</div>
              <div className="text-xs font-medium mt-1">Genome competencies</div>
            </div>
          </div>
          {founder?.highestMatchRoles?.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role (highest precise reachability)</TableHead>
                  <TableHead className="text-right">Precise %</TableHead>
                  <TableHead className="text-right">Operational %</TableHead>
                  <TableHead className="text-right">Reqs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {founder.highestMatchRoles.map((r: any) => (
                  <TableRow key={r.role_id}>
                    <TableCell className="font-medium">{r.role_title ?? r.role_id}</TableCell>
                    <TableCell className="text-right">{pct(r.precise_reachable_pct)}</TableCell>
                    <TableCell className="text-right">{pct(r.proxy_reachable_pct)}</TableCell>
                    <TableCell className="text-right">{num(r.requirement_count)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Phase 8 — Certification */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Phase 8 — Certification</CardTitle>
          <CardDescription className="flex items-center gap-2">
            <VerdictBadge status={cert?.overall_verdict} />
            {cert?.summary && <span>PASS {cert.summary.pass} · PARTIAL {cert.summary.partial} · FAIL {cert.summary.fail}</span>}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cert?.note && (
            <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 rounded-md border border-amber-200 p-3 mb-3">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> <span>{cert.note}</span>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Verdict</TableHead>
                <TableHead>Question</TableHead>
                <TableHead>Evidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(cert?.questions ?? []).map((q: any) => (
                <TableRow key={q.id}>
                  <TableCell className="align-top"><VerdictBadge status={q.verdict} /></TableCell>
                  <TableCell className="align-top text-sm font-medium max-w-xs">{q.question}</TableCell>
                  <TableCell className="align-top text-xs text-muted-foreground max-w-md">{q.evidence}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
