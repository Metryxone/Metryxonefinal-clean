import { BRAND } from '@/design-system/tokens';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Building2, AlertTriangle, Info, CheckCircle2, Ban } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';


const BASE = '/api/enterprise-workforce';

type Provenance = { engines: string[]; tables: string[]; notes?: string[] };
type ViewMeta = { available: boolean; abstained: boolean; reason: string | null; provenance: Provenance };
type Overview = {
  ok?: boolean;
  engine?: string;
  version?: string;
  org_id?: string;
  views?: Record<string, ViewMeta>;
  summary?: { total_views: number; available: number; abstained: number };
  disclaimer?: string;
  error?: string;
};
type DetailView = {
  view: string;
  available: boolean;
  abstained: boolean;
  reason: string | null;
  provenance: Provenance;
  data: any;
};

const VIEW_ORDER = [
  'skill-gap',
  'succession',
  'internal-mobility',
  'workforce-planning',
  'talent-risk',
  'talent-forecasting',
  'readiness-forecasting',
] as const;

const VIEW_LABEL: Record<string, string> = {
  'skill-gap': 'Skill-Gap',
  succession: 'Succession',
  'internal-mobility': 'Internal Mobility',
  'workforce-planning': 'Workforce Planning',
  'talent-risk': 'Talent Risk',
  'talent-forecasting': 'Talent Forecasting',
  'readiness-forecasting': 'Readiness Forecasting',
};

const VIEW_PATH: Record<string, string> = {
  'skill-gap': 'skill-gap',
  succession: 'succession',
  'internal-mobility': 'mobility',
  'workforce-planning': 'workforce-planning',
  'talent-risk': 'talent-risk',
  'talent-forecasting': 'talent-forecasting',
  'readiness-forecasting': 'readiness-forecasting',
};

function AvailabilityBadge({ available }: { available: boolean }) {
  return available ? (
    <Badge className="bg-emerald-600 hover:bg-emerald-600">available</Badge>
  ) : (
    <Badge variant="outline" className="text-amber-600 border-amber-400">Insufficient Evidence</Badge>
  );
}

/** Render a coverage map honestly: every count shown; an abstained view says so rather than faking 0. */
function CoverageList({ coverage }: { coverage: Record<string, unknown> | null | undefined }) {
  if (!coverage || typeof coverage !== 'object') {
    return <div className="text-xs text-amber-600 italic">Not measurable</div>;
  }
  const entries = Object.entries(coverage);
  if (entries.length === 0) return <div className="text-xs text-amber-600 italic">Not measurable</div>;
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{k}</span>
          <span className="font-medium tabular-nums">
            {v === null || v === undefined ? (
              <span className="text-amber-600 italic">null</span>
            ) : (
              String(v)
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function EnterpriseWorkforceConsolePanel() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<{
    overview: Overview;
    details: Record<string, DetailView | null>;
  }>({
    queryKey: [`${BASE}/console`],
    queryFn: async () => {
      const ovRes = await fetch(`${BASE}/overview`, { credentials: 'include' });
      if (!ovRes.ok) {
        if (ovRes.status === 503) {
          return { overview: { ok: false, error: 'enterprise_workforce_console_disabled' }, details: {} };
        }
        throw new Error(`overview ${ovRes.status}`);
      }
      const overview: Overview = await ovRes.json();
      const pairs = await Promise.all(
        VIEW_ORDER.map(async (v) => {
          try {
            const r = await fetch(`${BASE}/${VIEW_PATH[v]}`, { credentials: 'include' });
            if (!r.ok) return [v, null] as const;
            return [v, (await r.json()) as DetailView] as const;
          } catch {
            return [v, null] as const;
          }
        }),
      );
      const details: Record<string, DetailView | null> = {};
      for (const [v, d] of pairs) details[v] = d;
      return { overview, details };
    },
  });

  const overview = data?.overview;
  const disabled = overview?.ok === false;
  const summary = overview?.summary;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6" style={{ color: BRAND.primary }} />
          <div>
            <h2 className="text-xl font-semibold" style={{ color: BRAND.primary }}>
              Enterprise Workforce Console
            </h2>
            <p className="text-sm text-muted-foreground">
              Read-only composer over TIG · M5 Workforce OS · succession · capability · skill-gap ·
              mobility · planning · predictive (MX-77X). Compose-never-recompute; unmeasured abstains.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {isError && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertTriangle className="w-4 h-4" /> Failed to load the Enterprise Workforce Console.
        </div>
      )}
      {disabled && (
        <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded p-3">
          <Ban className="w-4 h-4" /> Enterprise Workforce Console is disabled (flag{' '}
          <code>enterpriseWorkforceConsole</code> OFF). Enable{' '}
          <code>FF_ENTERPRISE_WORKFORCE_CONSOLE=1</code> to activate.
        </div>
      )}

      {overview && !disabled && summary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-lg border p-4">
              <div className="text-xs text-muted-foreground">Views available</div>
              <div className="text-2xl font-semibold">
                {summary.available}
                <span className="text-base text-muted-foreground"> / {summary.total_views}</span>
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-xs text-muted-foreground">Views abstained</div>
              <div className="text-2xl font-semibold">{summary.abstained}</div>
              <div className="text-xs text-muted-foreground mt-1">Insufficient Evidence</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-xs text-muted-foreground">Org</div>
              <div className="text-2xl font-semibold tabular-nums">{overview.org_id}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-xs text-muted-foreground">Engine version</div>
              <div className="text-2xl font-semibold">{overview.version}</div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {VIEW_ORDER.map((v) => {
              const meta = overview.views?.[v];
              const detail = data?.details?.[v];
              const coverage = detail?.data?.coverage as Record<string, unknown> | undefined;
              const available = meta?.available ?? detail?.available ?? false;
              const reason = meta?.reason ?? detail?.reason ?? null;
              const prov = meta?.provenance ?? detail?.provenance;
              return (
                <section key={v} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">{VIEW_LABEL[v]}</h3>
                    <AvailabilityBadge available={available} />
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Coverage</div>
                    <CoverageList coverage={coverage} />
                  </div>

                  {!available && reason && (
                    <div className="flex items-start gap-1 text-xs text-amber-600">
                      <Info className="w-3 h-3 mt-0.5 shrink-0" />
                      {reason}
                    </div>
                  )}

                  {prov && (
                    <div className="text-[11px] text-muted-foreground border-t pt-2 space-y-1">
                      <div>
                        <span className="font-medium">engines:</span> {prov.engines.join(', ')}
                      </div>
                      <div>
                        <span className="font-medium">tables:</span> {prov.tables.join(', ')}
                      </div>
                      {prov.notes?.map((n, i) => (
                        <div key={i} className="italic flex items-start gap-1">
                          <Info className="w-3 h-3 mt-0.5 shrink-0" /> {n}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          {overview.disclaimer && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-slate-50 border rounded p-3">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
              <span>
                <strong>Honesty:</strong> {overview.disclaimer}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
