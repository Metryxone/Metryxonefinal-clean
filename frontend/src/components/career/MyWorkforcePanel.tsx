import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Compass, AlertTriangle, Info, CheckCircle2, Ban, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

const BRAND = { primary: '#344E86' };
const BASE = '/api/my-workforce';

type Provenance = { engines: string[]; tables: string[]; notes?: string[] };
type Trend = {
  metric: string;
  label: string;
  available: boolean;
  abstained: boolean;
  reason: string | null;
  points: number;
  first: number | null;
  last: number | null;
  delta: number | null;
  slope: number | null;
  direction: 'improving' | 'declining' | 'stable' | null;
  forecast_next: number | null;
} | null;
type TrendView = { view: string; available: boolean; abstained: boolean; reason: string | null; provenance: Provenance; data: { subject_id: string | null; trend: Trend } };
type FutureReadiness = {
  view: string;
  available: boolean;
  abstained: boolean;
  reason: string | null;
  provenance: Provenance;
  personalized: boolean;
  data: { emerging_roles: any[]; trends: any };
};
type Overview = {
  engine?: string;
  version?: string;
  scope?: string;
  subject_id?: string | null;
  my_readiness_trend?: TrendView;
  future_readiness?: FutureReadiness;
  notes?: string[];
  disclaimer?: string;
  disabled?: boolean;
};

function authHdr(): Record<string, string> {
  const t = localStorage.getItem('metryx_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function DirectionBadge({ direction }: { direction: Trend extends null ? never : 'improving' | 'declining' | 'stable' | null }) {
  if (direction === 'improving') return <Badge className="bg-emerald-600 hover:bg-emerald-600"><TrendingUp className="w-3 h-3 mr-1" />improving</Badge>;
  if (direction === 'declining') return <Badge variant="outline" className="text-red-600 border-red-400"><TrendingDown className="w-3 h-3 mr-1" />declining</Badge>;
  return <Badge variant="outline" className="text-slate-600 border-slate-400"><Minus className="w-3 h-3 mr-1" />stable</Badge>;
}

function ProvenanceBlock({ prov }: { prov?: Provenance }) {
  if (!prov) return null;
  return (
    <div className="text-[11px] text-muted-foreground border-t pt-2 space-y-1">
      {prov.engines.length > 0 && <div><span className="font-medium">engines:</span> {prov.engines.join(', ')}</div>}
      <div><span className="font-medium">tables:</span> {prov.tables.join(', ')}</div>
      {prov.notes?.map((n, i) => (
        <div key={i} className="italic flex items-start gap-1"><Info className="w-3 h-3 mt-0.5 shrink-0" /> {n}</div>
      ))}
    </div>
  );
}

export default function MyWorkforcePanel() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<Overview>({
    queryKey: [`${BASE}/overview`],
    queryFn: async () => {
      const res = await fetch(`${BASE}/overview`, { headers: authHdr() });
      if (!res.ok) {
        if (res.status === 503) return { disabled: true };
        throw new Error(`overview ${res.status}`);
      }
      return (await res.json()) as Overview;
    },
  });

  const disabled = data?.disabled === true;
  const trend = data?.my_readiness_trend?.data?.trend ?? null;
  const trendAvailable = data?.my_readiness_trend?.available ?? false;
  const fr = data?.future_readiness;
  const emergingRoles = Array.isArray(fr?.data?.emerging_roles) ? fr!.data.emerging_roles : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Compass className="w-6 h-6" style={{ color: BRAND.primary }} />
          <div>
            <h2 className="text-xl font-semibold" style={{ color: BRAND.primary }}>
              My Workforce Outlook
            </h2>
            <p className="text-sm text-muted-foreground">
              Your <strong>own</strong> readiness over time + role-general future-readiness signals.
              Developmental, never an evaluation against peers. Unmeasured says so — never a fake 0.
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
          <AlertTriangle className="w-4 h-4" /> Failed to load My Workforce Outlook.
        </div>
      )}
      {disabled && (
        <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded p-3">
          <Ban className="w-4 h-4" /> My Workforce Outlook is disabled (flag{' '}
          <code>enterpriseWorkforceConsole</code> OFF).
        </div>
      )}

      {data && !disabled && (
        <>
          <div className="grid md:grid-cols-2 gap-4">
            {/* My readiness trend */}
            <section className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">My Readiness Trend</h3>
                {trendAvailable
                  ? <Badge className="bg-emerald-600 hover:bg-emerald-600">available</Badge>
                  : <Badge variant="outline" className="text-amber-600 border-amber-400">Insufficient History</Badge>}
              </div>
              {trendAvailable && trend ? (
                <>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div><div className="text-xs text-muted-foreground">First</div><div className="text-lg font-semibold tabular-nums">{trend.first ?? '—'}</div></div>
                    <div><div className="text-xs text-muted-foreground">Latest</div><div className="text-lg font-semibold tabular-nums">{trend.last ?? '—'}</div></div>
                    <div><div className="text-xs text-muted-foreground">Δ</div><div className="text-lg font-semibold tabular-nums">{trend.delta ?? '—'}</div></div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{trend.points} measured point(s)</span>
                    <DirectionBadge direction={trend.direction} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Projected next: <span className="font-medium tabular-nums">{trend.forecast_next ?? '—'}</span>{' '}
                    <span className="italic">(least-squares projection, directional)</span>
                  </div>
                </>
              ) : (
                <div className="flex items-start gap-1 text-xs text-amber-600">
                  <Info className="w-3 h-3 mt-0.5 shrink-0" />
                  {data.my_readiness_trend?.reason ?? trend?.reason ?? 'No measurable readiness history yet (need ≥ 2 points).'}
                </div>
              )}
              <ProvenanceBlock prov={data.my_readiness_trend?.provenance} />
            </section>

            {/* Future-readiness (role-general) */}
            <section className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Future-Readiness</h3>
                {fr?.available
                  ? <Badge className="bg-emerald-600 hover:bg-emerald-600">available</Badge>
                  : <Badge variant="outline" className="text-amber-600 border-amber-400">Insufficient Evidence</Badge>}
              </div>
              <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                Role-general market signal — <strong>not a personalized prediction</strong> about you.
              </div>
              {emergingRoles.length > 0 ? (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground mb-1">Emerging roles (forward indicator)</div>
                  {emergingRoles.slice(0, 8).map((r: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span>{r.role_title ?? r.title ?? r.role ?? r.name ?? `role ${i + 1}`}</span>
                      {r.emergence_score != null && <span className="font-medium tabular-nums">{r.emergence_score}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-start gap-1 text-xs text-amber-600">
                  <Info className="w-3 h-3 mt-0.5 shrink-0" />
                  {fr?.reason ?? 'No emerging-role or trend indicators available.'}
                </div>
              )}
              <ProvenanceBlock prov={fr?.provenance} />
            </section>
          </div>

          {data.disclaimer && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-slate-50 border rounded p-3">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
              <span><strong>Honesty &amp; privacy:</strong> {data.disclaimer}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
