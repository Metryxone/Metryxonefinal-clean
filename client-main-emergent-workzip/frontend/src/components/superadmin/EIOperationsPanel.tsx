import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity, AlertTriangle, CheckCircle, Database, RefreshCw,
  TrendingUp, Users, Zap, Clock, BarChart3, ShieldCheck, PlayCircle
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { useToast } from '@/hooks/use-toast';

const BRAND = { primary: '#344E86', accent: '#4ECDC4', success: '#10b981', warning: '#f59e0b', danger: '#ef4444' };

function statusColor(status: string) {
  if (status === 'healthy') return BRAND.success;
  if (status === 'active') return BRAND.accent;
  if (status === 'partial') return BRAND.warning;
  return BRAND.danger;
}

function CoverageBar({ pct, label }: { pct: number; label: string }) {
  const color = pct >= 80 ? BRAND.success : pct >= 50 ? BRAND.warning : BRAND.danger;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

interface PipelineHealth {
  generated_at: string;
  status: 'inactive' | 'partial' | 'active' | 'healthy';
  pipeline: {
    mei_scores: number;
    mei_history_rows: number;
    last_compute: string | null;
    triggers_24h: number;
    users_scored: number;
  };
  coverage: {
    profiles_total: number;
    users_total: number;
    mei_coverage_pct: number;
    ucip_profiles: number;
    ucip_coverage_pct: number;
    recommendations: number;
    rec_coverage_pct: number;
  };
  ucip_statuses: Record<string, number>;
}

export default function EIOperationsPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [rebuildUserId, setRebuildUserId] = useState('');

  const health = useQuery<{ ok: boolean; health: PipelineHealth }>({
    queryKey: ['admin', 'mei', 'pipeline-health'],
    queryFn: () => fetch('/api/admin/mei/pipeline-health', { credentials: 'include' }).then(r => r.json()),
    refetchInterval: 30_000,
  });

  const backfill = useMutation({
    mutationFn: () =>
      fetch('/api/admin/mei/pipeline-health/backfill', { method: 'POST', credentials: 'include' }).then(r => r.json()),
    onSuccess: (data) => {
      toast({ title: 'Backfill started', description: `Queued ${data.queued} users for MEI + UCIP rebuild.` });
      setTimeout(() => qc.invalidateQueries({ queryKey: ['admin', 'mei', 'pipeline-health'] }), 5000);
    },
    onError: () => toast({ title: 'Backfill failed', variant: 'destructive' }),
  });

  const rebuildOne = useMutation({
    mutationFn: (userId: string) =>
      fetch(`/api/admin/mei/pipeline-health/rebuild/${encodeURIComponent(userId)}`, {
        method: 'POST', credentials: 'include',
      }).then(r => r.json()),
    onSuccess: (data) => {
      toast({
        title: 'Rebuild complete',
        description: data.score
          ? `Score: ${data.score.composite_score} (${data.score.band})`
          : 'No profile found for this user.',
      });
      qc.invalidateQueries({ queryKey: ['admin', 'mei', 'pipeline-health'] });
    },
    onError: () => toast({ title: 'Rebuild failed', variant: 'destructive' }),
  });

  const h = health.data?.health;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">EI Pipeline Operations</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            MEI score generation · UCIP rebuild · recommendation coverage · forecast intelligence
          </p>
        </div>
        <div className="flex items-center gap-2">
          {h && (
            <Badge
              className="text-xs font-semibold px-2.5 py-1"
              style={{ backgroundColor: statusColor(h.status) + '20', color: statusColor(h.status), border: `1px solid ${statusColor(h.status)}40` }}
            >
              {h.status.toUpperCase()}
            </Badge>
          )}
          <Button
            variant="outline" size="sm"
            onClick={() => qc.invalidateQueries({ queryKey: ['admin', 'mei', 'pipeline-health'] })}
            disabled={health.isFetching}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${health.isFetching ? 'animate-spin' : ''}`}/>
            Refresh
          </Button>
        </div>
      </div>

      {health.isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse"/>)}
        </div>
      )}

      {h && (
        <>
          {/* Pipeline Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: BarChart3, label: 'MEI Scores', value: h.pipeline.mei_scores, color: BRAND.primary },
              { icon: Database, label: 'History Rows', value: h.pipeline.mei_history_rows, color: BRAND.accent },
              { icon: Zap, label: 'Triggers (24h)', value: h.pipeline.triggers_24h, color: BRAND.success },
              { icon: Users, label: 'UCIP Profiles', value: h.coverage.ucip_profiles, color: BRAND.warning },
            ].map(({ icon: Icon, label, value, color }) => (
              <Card key={label}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-lg p-2" style={{ backgroundColor: color + '15' }}>
                      <Icon className="h-4 w-4" style={{ color }} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Coverage bars */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Coverage Analysis</CardTitle>
              <CardDescription className="text-xs">
                Population: {h.coverage.profiles_total} career profiles · {h.coverage.users_total} total users
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <CoverageBar pct={h.coverage.mei_coverage_pct} label="MEI Score Coverage (profiles with score)"/>
              <CoverageBar pct={h.coverage.ucip_coverage_pct} label="UCIP Profile Coverage (scored users with UCIP)"/>
              <CoverageBar pct={h.coverage.rec_coverage_pct} label="Recommendation Coverage (scored users with recs)"/>
            </CardContent>
          </Card>

          {/* Last compute + UCIP statuses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-gray-500"/>
                  Pipeline Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Last compute</span>
                  <span className="font-medium text-gray-800">
                    {h.pipeline.last_compute
                      ? new Date(h.pipeline.last_compute).toLocaleString()
                      : <span className="text-amber-600">Never</span>}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Users scored (distinct)</span>
                  <span className="font-medium text-gray-800">{h.pipeline.users_scored}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Recommendations total</span>
                  <span className="font-medium text-gray-800">{h.coverage.recommendations}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-gray-500"/>
                  UCIP Pipeline Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.keys(h.ucip_statuses).length === 0 ? (
                  <p className="text-xs text-gray-400">No UCIP runs logged yet.</p>
                ) : (
                  Object.entries(h.ucip_statuses).map(([status, count]) => (
                    <div key={status} className="flex justify-between text-xs">
                      <span className="flex items-center gap-1.5">
                        {status === 'success'
                          ? <CheckCircle className="h-3.5 w-3.5 text-green-500"/>
                          : status === 'partial'
                          ? <AlertTriangle className="h-3.5 w-3.5 text-amber-500"/>
                          : <AlertTriangle className="h-3.5 w-3.5 text-red-500"/>}
                        <span className="text-gray-600 capitalize">{status}</span>
                      </span>
                      <span className="font-semibold text-gray-800">{count}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <PlayCircle className="h-4 w-4 text-gray-500"/>
                Rebuild Actions
              </CardTitle>
              <CardDescription className="text-xs">
                Triggers MEI score computation → recommendations → UCIP rebuild for users.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  onClick={() => backfill.mutate()}
                  disabled={backfill.isPending}
                  className="shrink-0"
                  style={{ backgroundColor: BRAND.primary }}
                >
                  {backfill.isPending
                    ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin"/>Running...</>
                    : <><TrendingUp className="h-3.5 w-3.5 mr-1.5"/>Backfill All Users</>}
                </Button>
                <p className="text-xs text-gray-500">
                  Runs MEI + UCIP chain for all {h.coverage.profiles_total} career profiles in background.
                </p>
              </div>

              <div className="border-t pt-3 flex items-center gap-2">
                <input
                  type="text"
                  value={rebuildUserId}
                  onChange={e => setRebuildUserId(e.target.value)}
                  placeholder="User ID..."
                  className="flex-1 text-xs border rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300"
                />
                <Button
                  size="sm" variant="outline"
                  onClick={() => rebuildUserId.trim() && rebuildOne.mutate(rebuildUserId.trim())}
                  disabled={rebuildOne.isPending || !rebuildUserId.trim()}
                >
                  {rebuildOne.isPending
                    ? <RefreshCw className="h-3.5 w-3.5 animate-spin"/>
                    : <><Clock className="h-3.5 w-3.5 mr-1"/>Rebuild Single</>}
                </Button>
              </div>
            </CardContent>
          </Card>

          {h.pipeline.mei_scores === 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0"/>
              <div>
                <p className="text-sm font-semibold text-amber-800">MEI chain not yet activated</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  No MEI scores exist. The post-assessment trigger is now wired — run "Backfill All Users" to
                  populate scores for existing career profiles, then future assessments will trigger automatically.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
