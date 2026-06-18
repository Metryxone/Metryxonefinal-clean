import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ToggleLeft, ToggleRight, RefreshCw, SlidersHorizontal, Info,
  ChevronDown, ChevronRight, Plus, Trash2, Zap, Shield, Brain,
  Activity, TrendingUp, Network, Cpu, Loader2, AlertTriangle, Check,
  Flag, Percent, Layers, Radio, Wifi,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const BRAND = { primary: '#344E86', accent: '#4ECDC4', success: '#10b981', warning: '#f59e0b', danger: '#ef4444', purple: '#8b5cf6' };

interface FlagOverride {
  tenant_id: string;
  enabled:   boolean;
}

interface FeatureFlag {
  flag_key:    string;
  label:       string;
  description: string | null;
  enabled:     boolean;
  rollout_pct: number;
  phase:       string;
  created_at:  string;
  updated_at:  string;
  overrides:   FlagOverride[];
}

const FLAG_ICONS: Record<string, React.ElementType> = {
  adaptive_questioning:    Brain,
  contradiction_detection: AlertTriangle,
  signal_intelligence:     Activity,
  dynamic_reporting:       TrendingUp,
  interventions:           Shield,
  longitudinal_memory:     Network,
  cognitive_load_engine:   Cpu,
  hypothesis_engine:       Zap,
  confidence_engine:       SlidersHorizontal,
  websocket_runtime:       Activity,
};

const FLAG_COLORS: Record<string, string> = {
  adaptive_questioning:    BRAND.primary,
  contradiction_detection: BRAND.danger,
  signal_intelligence:     BRAND.accent,
  dynamic_reporting:       BRAND.purple,
  interventions:           BRAND.warning,
  longitudinal_memory:     '#0ea5e9',
  cognitive_load_engine:   '#f97316',
  hypothesis_engine:       BRAND.success,
  confidence_engine:       '#8b5cf6',
  websocket_runtime:       '#06b6d4',
};

// ── Phase 1 Streams ────────────────────────────────────────────────────────
const STREAMS: { label: string; color: string; keys: string[] }[] = [
  {
    label: 'Core Engine',
    color: BRAND.primary,
    keys:  ['cognitive_load_engine', 'hypothesis_engine', 'confidence_engine', 'contradiction_detection'],
  },
  {
    label: 'Assessment Intelligence',
    color: BRAND.success,
    keys:  ['adaptive_questioning'],
  },
  {
    label: 'Signal & Memory',
    color: BRAND.accent,
    keys:  ['signal_intelligence', 'longitudinal_memory'],
  },
  {
    label: 'Reporting & Actions',
    color: BRAND.purple,
    keys:  ['dynamic_reporting', 'interventions', 'websocket_runtime'],
  },
];

function formatDate(d?: string | null) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function FlagCard({
  flag,
  onUpdate,
  liveSessionCount,
}: {
  flag: FeatureFlag;
  onUpdate: (key: string, body: Record<string, unknown>) => void;
  liveSessionCount?: number;
}) {
  const [overridesOpen, setOverridesOpen] = useState(false);
  const [newTenantId, setNewTenantId]     = useState('');
  const [rolloutLocal, setRolloutLocal]   = useState(flag.rollout_pct);
  const [rolloutEditing, setRolloutEditing] = useState(false);

  const Icon  = FLAG_ICONS[flag.flag_key] ?? Flag;
  const color = FLAG_COLORS[flag.flag_key] ?? BRAND.primary;

  const handleToggle = () => onUpdate(flag.flag_key, { enabled: !flag.enabled });

  const handleRolloutCommit = () => {
    if (rolloutLocal !== flag.rollout_pct) {
      onUpdate(flag.flag_key, { rollout_pct: rolloutLocal });
    }
    setRolloutEditing(false);
  };

  const handleAddOverride = (tenantId: string, enabled: boolean) => {
    if (!tenantId.trim()) return;
    onUpdate(flag.flag_key, { tenant_id: tenantId.trim(), tenant_enabled: enabled });
    setNewTenantId('');
  };

  const handleRemoveOverride = (tenantId: string) => {
    onUpdate(flag.flag_key, { tenant_id: tenantId, tenant_enabled: null });
  };

  return (
    <Card className="border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${color}18` }}>
              <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-gray-800 leading-tight">{flag.label}</CardTitle>
              <p className="text-xs text-gray-500 mt-0.5 font-mono">{flag.flag_key}</p>
            </div>
          </div>
          <Switch
            checked={flag.enabled}
            onCheckedChange={handleToggle}
            style={flag.enabled ? { backgroundColor: color } : undefined}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {flag.description && (
          <p className="text-xs text-gray-600 leading-relaxed">{flag.description}</p>
        )}

        {/* Status row */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="text-[10px] px-1.5 py-0" style={{
            backgroundColor: flag.enabled ? `${BRAND.success}18` : '#f3f4f6',
            color: flag.enabled ? BRAND.success : '#6b7280',
          }}>
            {flag.enabled ? 'Active' : 'Disabled'}
          </Badge>
          {flag.overrides.length > 0 && (
            <Badge className="text-[10px] px-1.5 py-0 bg-purple-50 text-purple-600">
              {flag.overrides.length} override{flag.overrides.length > 1 ? 's' : ''}
            </Badge>
          )}
          {liveSessionCount !== undefined && flag.enabled && (
            <Badge
              className="text-[10px] px-1.5 py-0 flex items-center gap-1"
              style={{ backgroundColor: '#06b6d418', color: '#0891b2' }}
            >
              <Radio className="h-2.5 w-2.5 animate-pulse" />
              {liveSessionCount} live session{liveSessionCount !== 1 ? 's' : ''}
            </Badge>
          )}
          {liveSessionCount !== undefined && !flag.enabled && (
            <Badge className="text-[10px] px-1.5 py-0 bg-gray-50 text-gray-400 flex items-center gap-1">
              <Wifi className="h-2.5 w-2.5" />
              WS off
            </Badge>
          )}
        </div>

        {/* One-click Enable / Disable button for websocket_runtime */}
        {liveSessionCount !== undefined && (
          <button
            onClick={handleToggle}
            className={`w-full flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-colors ${
              flag.enabled
                ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                : 'text-white hover:opacity-90 border border-transparent'
            }`}
            style={flag.enabled ? undefined : { backgroundColor: '#06b6d4' }}
          >
            {flag.enabled ? (
              <>
                <Wifi className="h-3.5 w-3.5" />
                Disable Live Sync
              </>
            ) : (
              <>
                <Radio className="h-3.5 w-3.5" />
                Enable Live Sync
              </>
            )}
          </button>
        )}

        {/* Rollout percentage */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] text-gray-500 flex items-center gap-1">
              <Percent className="h-3 w-3" /> Rollout
            </Label>
            {rolloutEditing ? (
              <div className="flex items-center gap-1">
                <span className="text-xs font-semibold" style={{ color }}>{rolloutLocal}%</span>
                <button className="text-[10px] text-green-600 font-medium hover:text-green-700"
                  onClick={handleRolloutCommit}>Save</button>
                <button className="text-[10px] text-gray-400 hover:text-gray-600"
                  onClick={() => { setRolloutLocal(flag.rollout_pct); setRolloutEditing(false); }}>×</button>
              </div>
            ) : (
              <button className="text-xs font-semibold hover:underline" style={{ color }}
                onClick={() => setRolloutEditing(true)}>
                {flag.rollout_pct}%
              </button>
            )}
          </div>
          {rolloutEditing ? (
            <Slider
              value={[rolloutLocal]}
              min={0} max={100} step={5}
              onValueChange={([v]) => setRolloutLocal(v)}
              className="w-full"
            />
          ) : (
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-300"
                style={{ width: `${flag.rollout_pct}%`, backgroundColor: color }} />
            </div>
          )}
        </div>

        {/* Tenant overrides */}
        <div>
          <button
            className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700 font-medium"
            onClick={() => setOverridesOpen(v => !v)}
          >
            {overridesOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Tenant Overrides
          </button>

          {overridesOpen && (
            <div className="mt-2 space-y-2">
              {flag.overrides.length === 0 && (
                <p className="text-[11px] text-gray-400 italic">No overrides yet</p>
              )}
              {flag.overrides.map(o => (
                <div key={o.tenant_id} className="flex items-center justify-between bg-gray-50 rounded px-2 py-1">
                  <span className="text-xs text-gray-700 font-mono">{o.tenant_id}</span>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-[10px] px-1.5 py-0 ${o.enabled ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                      {o.enabled ? 'ON' : 'OFF'}
                    </Badge>
                    <button onClick={() => handleAddOverride(o.tenant_id, !o.enabled)}
                      className="text-[10px] text-blue-500 hover:text-blue-700">flip</button>
                    <button onClick={() => handleRemoveOverride(o.tenant_id)}
                      className="text-red-400 hover:text-red-600">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Add override */}
              <div className="flex items-center gap-1 mt-1">
                <Input
                  placeholder="tenant_id"
                  value={newTenantId}
                  onChange={e => setNewTenantId(e.target.value)}
                  className="h-6 text-xs font-mono px-1.5 flex-1"
                  onKeyDown={e => { if (e.key === 'Enter') handleAddOverride(newTenantId, true); }}
                />
                <button
                  onClick={() => handleAddOverride(newTenantId, true)}
                  className="text-[10px] px-2 py-0.5 rounded bg-green-50 text-green-600 hover:bg-green-100 font-medium"
                  disabled={!newTenantId.trim()}>ON</button>
                <button
                  onClick={() => handleAddOverride(newTenantId, false)}
                  className="text-[10px] px-2 py-0.5 rounded bg-red-50 text-red-500 hover:bg-red-100 font-medium"
                  disabled={!newTenantId.trim()}>OFF</button>
              </div>
            </div>
          )}
        </div>

        <p className="text-[10px] text-gray-400">Updated {formatDate(flag.updated_at)}</p>
      </CardContent>
    </Card>
  );
}

function StreamSection({
  stream,
  flags,
  onUpdate,
  wsActiveCount,
}: {
  stream: typeof STREAMS[0];
  flags: FeatureFlag[];
  onUpdate: (key: string, body: Record<string, unknown>) => void;
  wsActiveCount?: number;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const activeCount = flags.filter(f => f.enabled).length;

  if (flags.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Stream header */}
      <button
        className="w-full flex items-center gap-3 text-left group"
        onClick={() => setCollapsed(v => !v)}
      >
        <div className="flex items-center gap-2 flex-1">
          <div className="w-1 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: stream.color }} />
          <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">{stream.label}</span>
          <Badge className="text-[10px] px-1.5 py-0 ml-1"
            style={{ backgroundColor: `${stream.color}18`, color: stream.color }}>
            {activeCount}/{flags.length} active
          </Badge>
        </div>
        {collapsed
          ? <ChevronRight className="h-4 w-4 text-gray-400" />
          : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>

      {!collapsed && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pl-3 border-l-2"
          style={{ borderColor: `${stream.color}30` }}>
          {flags.map(flag => (
            <FlagCard
              key={flag.flag_key}
              flag={flag}
              onUpdate={onUpdate}
              liveSessionCount={flag.flag_key === 'websocket_runtime' ? wsActiveCount : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FeatureFlagsPanel() {
  const { toast }   = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-feature-flags'],
    queryFn: async () => {
      const r = await fetch('/api/admin/feature-flags');
      if (!r.ok) throw new Error(await r.text());
      return r.json() as Promise<{ flags: FeatureFlag[] }>;
    },
    refetchInterval: 60_000,
  });

  // Poll the WS runtime status every 5 s to keep session count fresh.
  const { data: wsStatus } = useQuery({
    queryKey: ['admin-ff-ws-status'],
    queryFn: async () => {
      const r = await fetch('/api/admin/feature-flags/ws-status');
      if (!r.ok) return { enabled: false, active_sessions: 0 };
      return r.json() as Promise<{ enabled: boolean; active_sessions: number }>;
    },
    refetchInterval: 5_000,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ key, body }: { key: string; body: Record<string, unknown> }) => {
      const r = await fetch(`/api/admin/feature-flags/${key}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-feature-flags'] });
      const f = data?.flag;
      if (f) {
        toast({
          title: f.label,
          description: f.enabled ? 'Flag enabled' : 'Flag disabled',
        });
      }
    },
    onError: (err: Error) => {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    },
  });

  const handleUpdate = (key: string, body: Record<string, unknown>) => {
    updateMutation.mutate({ key, body });
  };

  const flags         = data?.flags ?? [];
  const enabled       = flags.filter(f => f.enabled).length;
  const withOverrides = flags.filter(f => f.overrides.length > 0).length;

  // Build a map for fast lookup
  const flagMap = new Map(flags.map(f => [f.flag_key, f]));

  // Flags that don't belong to any declared stream
  const assignedKeys = new Set(STREAMS.flatMap(s => s.keys));
  const ungrouped    = flags.filter(f => !assignedKeys.has(f.flag_key));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: BRAND.primary }}>Feature Flags</h2>
          <p className="text-sm text-gray-500 mt-0.5">Control Phase 1 adaptive intelligence rollouts at runtime</p>
        </div>
        <Button
          variant="outline" size="sm"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-feature-flags'] })}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Flags',    value: flags.length, color: BRAND.primary },
          { label: 'Active',         value: enabled,      color: BRAND.success },
          { label: 'Disabled',       value: flags.length - enabled, color: '#6b7280' },
          { label: 'With Overrides', value: withOverrides, color: BRAND.purple },
        ].map(kpi => (
          <Card key={kpi.label} className="border border-gray-100 shadow-sm">
            <CardContent className="pt-4 pb-3">
              <p className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
        <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-relaxed">
          All Phase 1 flags are <strong>disabled by default</strong>. Enabling a flag gates the corresponding
          execution path in real time — cache refreshes every 60 s. Rollout percentage uses deterministic hash
          bucketing so the same tenant always lands in the same bucket. Per-tenant overrides take precedence over global settings.
        </p>
      </div>

      {/* Loading / Error */}
      {isLoading && (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: BRAND.primary }} />
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-lg p-4">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm">Failed to load feature flags. Check your session and try refreshing.</p>
        </div>
      )}

      {/* Streams — grouped by Phase 1 stream */}
      {!isLoading && !error && flags.length > 0 && (
        <div className="space-y-8">
          {STREAMS.map(stream => {
            const streamFlags = stream.keys
              .map(k => flagMap.get(k))
              .filter((f): f is FeatureFlag => f !== undefined);
            return (
              <StreamSection
                key={stream.label}
                stream={stream}
                flags={streamFlags}
                onUpdate={handleUpdate}
                wsActiveCount={wsStatus?.active_sessions}
              />
            );
          })}

          {/* Ungrouped flags (safety net) */}
          {ungrouped.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-semibold text-gray-600">Other</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {ungrouped.map(flag => (
                  <FlagCard key={flag.flag_key} flag={flag} onUpdate={handleUpdate} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && flags.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Flag className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No feature flags found. Run the migration to seed Phase 1 flags.</p>
        </div>
      )}
    </div>
  );
}
