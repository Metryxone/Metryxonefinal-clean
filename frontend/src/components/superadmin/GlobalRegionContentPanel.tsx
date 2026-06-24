import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Globe, AlertTriangle, Info, CheckCircle2, Plus, RotateCcw, Trash2, History, Tag, Undo2, XCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';

const BRAND = { primary: '#344E86' };
const BASE = '/api/global-competency';

type RegionMeta = { code: string; name: string; is_default: boolean };
type SurfaceMeta = { key: string; label: string };

type SurfaceCoverage = {
  surface: string;
  label: string;
  backing_table: string;
  global_content: number | null;
  assigned_overlay: number | null;
  effective_content: number | null;
  has_content: boolean;
};
type RegionCoverage = {
  code: string;
  name: string;
  is_default: boolean;
  surfaces: SurfaceCoverage[];
  surfaces_with_content: number;
  total_effective_content: number | null;
};
type Coverage = {
  ok: boolean;
  version?: string;
  default_region?: string;
  overlay_table_present?: boolean;
  regions?: RegionCoverage[];
  note?: string;
  degraded?: boolean;
};

type ContentItem = { entity_ref: string; label: string | null; detail?: unknown };
type SurfaceContent = {
  surface: string;
  label: string;
  backing_table: string;
  source: 'base' | 'overlay' | 'empty' | null;
  localized: boolean;
  count: number | null;
  items: ContentItem[];
};
type RegionContent = {
  ok: boolean;
  region?: string;
  name?: string;
  is_default?: boolean;
  surfaces?: SurfaceContent[];
  note?: string;
  degraded?: boolean;
};

type Registry = {
  ok: boolean;
  default_region?: string;
  regions?: RegionMeta[];
  surfaces?: SurfaceMeta[];
  note?: string;
};

type AssignResult = {
  ok: boolean;
  error?: string;
  surface?: string;
  region?: string;
  requested?: number;
  written?: number;
  skipped?: number;
  rejected?: number;
  rejected_refs?: string[];
};

type AuditRow = {
  id: number;
  action: 'assign' | 'untag' | 'rollback';
  surface: string | null;
  region_code: string | null;
  actor_id: string | null;
  actor_email: string | null;
  requested_refs: string[];
  applied_refs: string[];
  rejected_refs: string[];
  applied_count: number;
  rejected_count: number;
  detail?: any;
  created_at: string;
};
type AuditLog = {
  ok: boolean;
  present?: boolean;
  entries?: AuditRow[];
  limit?: number;
  degraded?: boolean;
};

// A removal awaiting explicit confirmation. `item`/`surface` are targeted untags
// (one or many refs in a single surface); `bulk` is the legacy provenance-wide rollback.
type PendingRemoval =
  | { kind: 'item' | 'surface'; surface: string; surfaceLabel: string; refs: string[]; sampleLabel?: string }
  | { kind: 'bulk' };

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path, { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed (${res.status})`);
  return res.json();
}

// null = unreadable/not-measurable → '—' (never coerce to 0).
function n(v: number | null | undefined): string {
  return v == null ? '—' : String(v);
}

function ActionBadge({ action }: { action: AuditRow['action'] }) {
  if (action === 'assign')
    return (
      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 gap-1">
        <Tag className="h-3 w-3" /> Tagged
      </Badge>
    );
  if (action === 'untag')
    return (
      <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 gap-1">
        <Trash2 className="h-3 w-3" /> Untagged
      </Badge>
    );
  return (
    <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 gap-1">
      <Undo2 className="h-3 w-3" /> Rollback
    </Badge>
  );
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function surfaceLabel(key: string | null, surfaces: SurfaceMeta[]): string {
  if (!key) return '—';
  return surfaces.find((s) => s.key === key)?.label ?? key;
}

// Human-readable summary of what a pending removal will delete (shown in the confirm dialog).
function removalCopy(p: PendingRemoval, regionName: string): { title: string; body: string; action: string } {
  if (p.kind === 'bulk') {
    return {
      title: 'Roll back all region overlay content?',
      body:
        'This deletes every curated region overlay row across all surfaces and all regions for this provenance. ' +
        'The underlying entities are never deleted — you can re-tag them afterwards — but the entire curated overlay will be removed.',
      action: 'Roll back all overlay',
    };
  }
  if (p.kind === 'item') {
    const name = p.sampleLabel || p.refs[0];
    return {
      title: 'Remove this item from the region?',
      body:
        `“${name}” will be untagged from ${p.surfaceLabel} in ${regionName}. ` +
        'This deletes the region overlay row only — the underlying entity is not deleted, and you can re-tag it later.',
      action: 'Remove item',
    };
  }
  return {
    title: `Remove all ${p.refs.length} item(s) from this surface?`,
    body:
      `All ${p.refs.length} curated item(s) in ${p.surfaceLabel} for ${regionName} will be untagged. ` +
      'This deletes the region overlay rows only — the underlying entities are not deleted, and you can re-tag them later.',
    action: `Remove ${p.refs.length} item(s)`,
  };
}

function SourceBadge({ source }: { source: SurfaceContent['source'] }) {
  if (source === 'base') return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Default (base)</Badge>;
  if (source === 'overlay') return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Overlay (curated)</Badge>;
  if (source === 'empty') return <Badge variant="outline" className="text-gray-500">Empty</Badge>;
  return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Unreadable</Badge>;
}

export default function GlobalRegionContentPanel() {
  const qc = useQueryClient();
  const [selectedRegion, setSelectedRegion] = useState<string>('IN');

  // Assign form state
  const [assignSurface, setAssignSurface] = useState<string>('');
  const [assignRefs, setAssignRefs] = useState<string>('');
  const [assignNote, setAssignNote] = useState<string>('');

  const registryQ = useQuery<Registry>({
    queryKey: [`${BASE}/regions`],
    queryFn: () => getJson<Registry>('/regions'),
  });
  const coverageQ = useQuery<Coverage>({
    queryKey: [`${BASE}/coverage`],
    queryFn: () => getJson<Coverage>('/coverage'),
  });
  const contentQ = useQuery<RegionContent>({
    queryKey: [`${BASE}/content`, selectedRegion],
    queryFn: () => getJson<RegionContent>(`/content/${selectedRegion}`),
    enabled: !!selectedRegion,
  });
  const auditQ = useQuery<AuditLog>({
    queryKey: [`${BASE}/audit`, selectedRegion],
    queryFn: () => getJson<AuditLog>(`/audit?region=${encodeURIComponent(selectedRegion)}&limit=50`),
    enabled: !!selectedRegion,
  });

  const regions = registryQ.data?.regions ?? coverageQ.data?.regions?.map((r) => ({ code: r.code, name: r.name, is_default: r.is_default })) ?? [];
  const surfaces = registryQ.data?.surfaces ?? [];

  const surfaceOptions = useMemo(() => {
    if (surfaces.length) return surfaces;
    const first = coverageQ.data?.regions?.[0]?.surfaces ?? [];
    return first.map((s) => ({ key: s.surface, label: s.label }));
  }, [surfaces, coverageQ.data]);

  const selectedMeta = regions.find((r) => r.code === selectedRegion);

  const assignMut = useMutation<AssignResult, Error, void>({
    mutationFn: async () => {
      const refs = assignRefs
        .split(/[\n,]+/)
        .map((x) => x.trim())
        .filter(Boolean);
      const res = await fetch(`${BASE}/assign`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surface: assignSurface,
          region: selectedRegion,
          entity_refs: refs,
          detail: assignNote ? { note: assignNote } : {},
        }),
      });
      const j = (await res.json().catch(() => ({}))) as AssignResult;
      if (!res.ok) {
        // Surface the honesty guard / validation error verbatim (e.g. no_valid_entity_refs).
        throw Object.assign(new Error(j.error || `Failed (${res.status})`), { detail: j });
      }
      return j;
    },
    onSuccess: () => {
      setAssignRefs('');
      setAssignNote('');
      qc.invalidateQueries({ queryKey: [`${BASE}/coverage`] });
      qc.invalidateQueries({ queryKey: [`${BASE}/content`, selectedRegion] });
      qc.invalidateQueries({ queryKey: [`${BASE}/audit`, selectedRegion] });
    },
    onError: () => {
      // A rejected assign is still recorded in the audit trail (honesty) — refresh it.
      qc.invalidateQueries({ queryKey: [`${BASE}/audit`, selectedRegion] });
    },
  });

  // Removal awaiting confirmation (per-item, multi-ref, or bulk provenance rollback).
  const [pending, setPending] = useState<PendingRemoval | null>(null);

  const untagMut = useMutation<AssignResult, Error, { surface: string; entity_refs: string[] }>({
    mutationFn: async ({ surface, entity_refs }) => {
      const res = await fetch(`${BASE}/rollback`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surface, region: selectedRegion, entity_refs }),
      });
      const j = (await res.json().catch(() => ({}))) as AssignResult;
      if (!res.ok) throw new Error(j.error || `Failed (${res.status})`);
      return j;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`${BASE}/coverage`] });
      qc.invalidateQueries({ queryKey: [`${BASE}/content`, selectedRegion] });
      qc.invalidateQueries({ queryKey: [`${BASE}/audit`, selectedRegion] });
    },
  });

  // Legacy bulk provenance rollback — deletes every overlay row for the provenance.
  const bulkRollbackMut = useMutation<AssignResult, Error, void>({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/rollback`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const j = (await res.json().catch(() => ({}))) as AssignResult;
      if (!res.ok) throw new Error(j.error || `Failed (${res.status})`);
      return j;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`${BASE}/coverage`] });
      qc.invalidateQueries({ queryKey: [`${BASE}/content`, selectedRegion] });
    },
  });

  const removalPending = untagMut.isPending || bulkRollbackMut.isPending;
  const removalError = (untagMut.error ?? bulkRollbackMut.error) as Error | null;

  // Open the confirm dialog for a removal, clearing any stale mutation error first.
  const requestRemoval = (p: PendingRemoval) => {
    untagMut.reset();
    bulkRollbackMut.reset();
    setPending(p);
  };

  const confirmRemoval = () => {
    if (!pending) return;
    if (pending.kind === 'bulk') {
      bulkRollbackMut.mutate(undefined, { onSuccess: () => setPending(null) });
    } else {
      untagMut.mutate(
        { surface: pending.surface, entity_refs: pending.refs },
        { onSuccess: () => setPending(null) },
      );
    }
  };

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: [`${BASE}/coverage`] });
    qc.invalidateQueries({ queryKey: [`${BASE}/content`, selectedRegion] });
    qc.invalidateQueries({ queryKey: [`${BASE}/audit`, selectedRegion] });
  };

  const assignErr = assignMut.error as (Error & { detail?: AssignResult }) | null;

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: '#EEF2FB' }}>
            <Globe className="h-6 w-6" style={{ color: BRAND.primary }} />
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ color: BRAND.primary }}>
              Global Region Content
            </h2>
            <p className="text-sm text-gray-500 max-w-3xl">
              Region-tag existing entities (roles, benchmarks, competencies, readiness, demand) into each
              region's curated set. The default region (IN) inherits today's content; non-default regions
              serve only their curated overlay. No regional content is fabricated.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={refreshAll} data-testid="button-refresh-region-content">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Coverage matrix */}
      <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center gap-2">
          <h3 className="font-semibold text-gray-800">Coverage matrix · region × surface</h3>
          {coverageQ.data?.overlay_table_present === false && (
            <Badge variant="outline" className="text-gray-500">no overlay yet</Badge>
          )}
        </div>
        {coverageQ.isLoading ? (
          <div className="p-6 text-sm text-gray-500">Loading coverage…</div>
        ) : coverageQ.isError ? (
          <div className="p-6 text-sm text-red-600 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Failed to load coverage.
          </div>
        ) : coverageQ.data?.degraded ? (
          <div className="p-6 text-sm text-amber-600 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Coverage temporarily unavailable.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Region</TableHead>
                  {(coverageQ.data?.regions?.[0]?.surfaces ?? []).map((s) => (
                    <TableHead key={s.surface} className="text-center">{s.label}</TableHead>
                  ))}
                  <TableHead className="text-center">Surfaces w/ content</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(coverageQ.data?.regions ?? []).map((r) => (
                  <TableRow
                    key={r.code}
                    className={`cursor-pointer ${r.code === selectedRegion ? 'bg-blue-50' : ''}`}
                    onClick={() => setSelectedRegion(r.code)}
                    data-testid={`row-region-${r.code}`}
                  >
                    <TableCell className="font-medium">
                      {r.name} <span className="text-gray-400">({r.code})</span>
                      {r.is_default && <Badge className="ml-2 bg-blue-100 text-blue-800 hover:bg-blue-100">default</Badge>}
                    </TableCell>
                    {r.surfaces.map((s) => (
                      <TableCell key={s.surface} className="text-center">
                        <span className={s.has_content ? 'text-gray-900 font-medium' : 'text-gray-400'}>
                          {n(s.effective_content)}
                        </span>
                      </TableCell>
                    ))}
                    <TableCell className="text-center">
                      {r.surfaces_with_content}/{r.surfaces.length}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {coverageQ.data?.note && (
          <div className="px-5 py-3 border-t text-xs text-gray-500 flex items-start gap-2">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{coverageQ.data.note}</span>
          </div>
        )}
      </section>

      {/* Region selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-600 mr-1">Region:</span>
        {regions.map((r) => (
          <button
            key={r.code}
            onClick={() => setSelectedRegion(r.code)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              r.code === selectedRegion
                ? 'text-white border-transparent'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
            style={r.code === selectedRegion ? { backgroundColor: BRAND.primary } : {}}
            data-testid={`button-region-${r.code}`}
          >
            {r.name} <span className="opacity-70">({r.code})</span>
          </button>
        ))}
      </div>

      {/* Region content */}
      <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">
            {selectedMeta?.name ?? selectedRegion} content
          </h3>
          {selectedMeta?.is_default && (
            <span className="text-xs text-gray-500">Default region — inherits base content (read-only)</span>
          )}
        </div>
        {contentQ.isLoading ? (
          <div className="p-6 text-sm text-gray-500">Loading content…</div>
        ) : contentQ.isError ? (
          <div className="p-6 text-sm text-red-600 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Failed to load content.
          </div>
        ) : (
          <div className="divide-y">
            {(contentQ.data?.surfaces ?? []).map((s) => (
              <div key={s.surface} className="px-5 py-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-800">{s.label}</span>
                    <SourceBadge source={s.source} />
                    <span className="text-xs text-gray-400">{n(s.count)} item(s)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {!selectedMeta?.is_default && s.items.length > 1 && (
                      <button
                        onClick={() =>
                          requestRemoval({
                            kind: 'surface',
                            surface: s.surface,
                            surfaceLabel: s.label,
                            refs: s.items.map((it) => it.entity_ref),
                          })
                        }
                        disabled={removalPending}
                        className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 disabled:opacity-50 transition-colors"
                        title="Untag all items in this surface from this region"
                        data-testid={`button-untag-all-${s.surface}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Untag all ({s.items.length})
                      </button>
                    )}
                    <span className="text-xs text-gray-400">{s.backing_table}</span>
                  </div>
                </div>
                {s.items.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">
                    {s.source === 'empty'
                      ? 'No curated content for this region (not falling back to base).'
                      : s.source === null
                      ? 'Backing table unreadable.'
                      : 'No items to show.'}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {s.items.map((it) => (
                      <span
                        key={it.entity_ref}
                        className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-md bg-gray-50 border text-sm text-gray-700"
                        data-testid={`item-${s.surface}-${it.entity_ref}`}
                      >
                        <span className="truncate max-w-[220px]" title={it.label ?? it.entity_ref}>
                          {it.label ?? <span className="text-gray-400">#{it.entity_ref}</span>}
                        </span>
                        {!selectedMeta?.is_default && (
                          <button
                            onClick={() =>
                              requestRemoval({
                                kind: 'item',
                                surface: s.surface,
                                surfaceLabel: s.label,
                                refs: [it.entity_ref],
                                sampleLabel: it.label ?? it.entity_ref,
                              })
                            }
                            disabled={removalPending}
                            className="p-0.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors"
                            title="Untag from this region"
                            data-testid={`button-untag-${s.surface}-${it.entity_ref}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {contentQ.data?.note && (
          <div className="px-5 py-3 border-t text-xs text-gray-500 flex items-start gap-2">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{contentQ.data.note}</span>
          </div>
        )}
      </section>

      {/* Assign / tag entities (non-default regions only) */}
      {selectedMeta && !selectedMeta.is_default && (
        <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b">
            <h3 className="font-semibold text-gray-800">
              Region-tag existing entities → {selectedMeta.name} ({selectedMeta.code})
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Only real existing entity ids/codes can be tagged. Nonexistent refs are rejected (never fabricate coverage).
            </p>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Surface</label>
                <select
                  value={assignSurface}
                  onChange={(e) => setAssignSurface(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  data-testid="select-assign-surface"
                >
                  <option value="">Select a surface…</option>
                  {surfaceOptions.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Curation note (optional)</label>
                <input
                  type="text"
                  value={assignNote}
                  onChange={(e) => setAssignNote(e.target.value)}
                  placeholder="e.g. localized for EU market"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  data-testid="input-assign-note"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Entity ids/codes (comma or newline separated)
              </label>
              <textarea
                value={assignRefs}
                onChange={(e) => setAssignRefs(e.target.value)}
                rows={3}
                placeholder="123, 456, role_data_scientist"
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                data-testid="textarea-assign-refs"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => assignMut.mutate()}
                disabled={assignMut.isPending || !assignSurface || !assignRefs.trim()}
                style={{ backgroundColor: BRAND.primary }}
                data-testid="button-assign-region"
              >
                <Plus className="h-4 w-4 mr-2" />
                {assignMut.isPending ? 'Tagging…' : 'Tag entities'}
              </Button>
              {assignMut.isSuccess && assignMut.data && (
                <span className="text-sm text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  Tagged {assignMut.data.written ?? 0} · skipped {assignMut.data.skipped ?? 0}
                  {(assignMut.data.rejected ?? 0) > 0 && (
                    <span className="text-amber-700"> · rejected {assignMut.data.rejected}</span>
                  )}
                </span>
              )}
            </div>

            {/* Honesty guard surfaced: rejected / invalid refs */}
            {assignErr && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  {assignErr.detail?.error === 'no_valid_entity_refs'
                    ? 'None of those refs exist in the backing table — nothing was tagged.'
                    : assignErr.message}
                </div>
                {assignErr.detail?.rejected_refs && assignErr.detail.rejected_refs.length > 0 && (
                  <div className="mt-1 font-mono text-xs">
                    Rejected: {assignErr.detail.rejected_refs.join(', ')}
                  </div>
                )}
              </div>
            )}
            {assignMut.isSuccess && (assignMut.data?.rejected_refs?.length ?? 0) > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800 font-mono">
                Rejected (nonexistent): {assignMut.data!.rejected_refs!.join(', ')}
              </div>
            )}
          </div>
        </section>
      )}

      {selectedMeta?.is_default && (
        <div className="text-sm text-gray-500 flex items-center gap-2">
          <RotateCcw className="h-4 w-4" />
          The default region (IN) is the base — it can't be re-tagged. Select a non-default region to curate its overlay.
        </div>
      )}

      {/* Audit trail — read-only history of who changed what, when */}
      <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-gray-500" />
            <h3 className="font-semibold text-gray-800">
              Change history · {selectedMeta?.name ?? selectedRegion}
            </h3>
          </div>
          <span className="text-xs text-gray-400">Read-only · most recent first</span>
        </div>
        {auditQ.isLoading ? (
          <div className="p-6 text-sm text-gray-500">Loading history…</div>
        ) : auditQ.isError ? (
          <div className="p-6 text-sm text-red-600 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Failed to load change history.
          </div>
        ) : auditQ.data?.degraded ? (
          <div className="p-6 text-sm text-amber-600 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Change history temporarily unavailable.
          </div>
        ) : (auditQ.data?.entries?.length ?? 0) === 0 ? (
          <div className="p-6 text-sm text-gray-400 italic">
            No recorded changes for this region yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Surface</TableHead>
                  <TableHead className="text-center">Applied</TableHead>
                  <TableHead className="text-center">Rejected</TableHead>
                  <TableHead>Refs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(auditQ.data?.entries ?? []).map((e) => (
                  <TableRow key={e.id} data-testid={`row-audit-${e.id}`}>
                    <TableCell className="whitespace-nowrap text-xs text-gray-600">{fmtTime(e.created_at)}</TableCell>
                    <TableCell><ActionBadge action={e.action} /></TableCell>
                    <TableCell className="text-sm text-gray-700">
                      {e.actor_email ?? (e.actor_id ? `#${e.actor_id}` : <span className="text-gray-400">unknown</span>)}
                    </TableCell>
                    <TableCell className="text-sm text-gray-700">{surfaceLabel(e.surface, surfaceOptions)}</TableCell>
                    <TableCell className="text-center">
                      <span className={e.applied_count > 0 ? 'text-emerald-700 font-medium' : 'text-gray-400'}>
                        {e.applied_count}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {e.rejected_count > 0 ? (
                        <span className="inline-flex items-center gap-1 text-rose-700 font-medium">
                          <XCircle className="h-3.5 w-3.5" />
                          {e.rejected_count}
                        </span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[280px]">
                      {e.applied_refs.length > 0 && (
                        <div className="text-xs text-emerald-700 font-mono truncate" title={e.applied_refs.join(', ')}>
                          ✓ {e.applied_refs.join(', ')}
                        </div>
                      )}
                      {e.rejected_refs.length > 0 && (
                        <div className="text-xs text-rose-700 font-mono truncate" title={e.rejected_refs.join(', ')}>
                          ✗ rejected: {e.rejected_refs.join(', ')}
                        </div>
                      )}
                      {e.action === 'rollback' && (
                        <div className="text-xs text-gray-500 italic">
                          bulk rollback{e.detail?.deleted != null ? ` · ${e.detail.deleted} row(s) removed` : ''}
                        </div>
                      )}
                      {e.applied_refs.length === 0 && e.rejected_refs.length === 0 && e.action !== 'rollback' && (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                      {e.detail?.note && (
                        <div className="text-xs text-gray-400 truncate" title={String(e.detail.note)}>
                          note: {String(e.detail.note)}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="px-5 py-3 border-t text-xs text-gray-500 flex items-start gap-2">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Every tag / untag / rollback is recorded with the acting super-admin and timestamp.
            Rejected refs (entities that don't exist) are recorded as rejected — never counted as applied.
          </span>
        </div>
      </section>

      {/* Danger zone — legacy bulk provenance rollback (wipes the entire overlay). */}
      <section className="rounded-xl border border-red-200 bg-red-50/50 overflow-hidden">
        <div className="px-5 py-3 border-b border-red-200">
          <h3 className="font-semibold text-red-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Danger zone
          </h3>
        </div>
        <div className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-sm text-red-700 max-w-2xl">
            Roll back the entire region overlay — every curated row across all surfaces and all regions for this
            provenance. The underlying entities are never deleted (you can re-tag afterwards), but the whole curated
            overlay will be removed.
          </p>
          <Button
            variant="outline"
            onClick={() => requestRemoval({ kind: 'bulk' })}
            disabled={removalPending}
            className="border-red-300 text-red-700 hover:bg-red-100 shrink-0"
            data-testid="button-bulk-rollback"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Roll back all overlay
          </Button>
        </div>
        {bulkRollbackMut.isSuccess && (
          <div className="px-5 py-3 border-t border-red-200 text-sm text-emerald-700 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            Rolled back {bulkRollbackMut.data?.written ?? 0} overlay row(s).
          </div>
        )}
      </section>

      {/* Confirmation dialog — gates every overlay removal (per-item, multi-ref, bulk). */}
      <AlertDialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open && !removalPending) setPending(null);
        }}
      >
        <AlertDialogContent data-testid="dialog-confirm-removal">
          {pending &&
            (() => {
              const copy = removalCopy(pending, selectedMeta?.name ?? selectedRegion);
              return (
                <>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      {copy.title}
                    </AlertDialogTitle>
                    <AlertDialogDescription>{copy.body}</AlertDialogDescription>
                  </AlertDialogHeader>
                  {removalError && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-800">
                      {removalError.message}
                    </div>
                  )}
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={removalPending} data-testid="button-cancel-removal">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.preventDefault();
                        confirmRemoval();
                      }}
                      disabled={removalPending}
                      className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                      data-testid="button-confirm-removal"
                    >
                      {removalPending ? 'Removing…' : copy.action}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </>
              );
            })()}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
