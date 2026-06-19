/**
 * Phase 3 — Competency Employability Intelligence (CEI) admin panel.
 *
 * Read-only viewer over `/api/competency-ei/*`. COMPOSES the Phase 2
 * competency-runtime outputs into an Employability Intelligence envelope:
 * an Employability Index (re-normalised over AVAILABLE component weights),
 * drivers, positive-only strengths, gap-led development priorities, fired-risk
 * flags, and Coverage vs Confidence shown as two SEPARATE axes.
 *
 * The panel is only mounted when the `competencyEi` flag probe succeeds (the
 * nav item self-hides when OFF, keeping flag-OFF UI byte-identical). Snapshot
 * capture is an EXPLICIT user action (POST), mirroring the engine's write path.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity, Gauge, ShieldAlert, Sparkles, Target, Layers, Camera,
  AlertTriangle, CheckCircle2, Info, History as HistoryIcon, Search,
} from 'lucide-react';

const BRAND = { primary: '#344E86', accent: '#5B7BD5' };

interface Driver {
  key: string; label: string; weight: number; raw_score: number | null;
  status: 'available' | 'unavailable'; reason?: string;
  contribution: number | null; direction: 'lift' | 'drag' | 'neutral' | null;
}
interface Strength { source: string; label: string; detail: string; }
interface Priority {
  competency_id: string; competency_name: string; onto_domain: string | null;
  required_level: number | null; current_level: number | null; gap: number | null;
  severity: string; priority: string;
}
interface Risk {
  signal_id: string; name: string; category: string | null; interpretation: string | null;
  triggered_by: Array<{ competency_id: string; competency_name: string; level: number }>;
}
interface Intelligence {
  ok: boolean; subject_id: string; role_id: string | null; measurable: boolean;
  index_score: number | null; index_band: string | null;
  drivers: Driver[]; strengths: Strength[]; priorities: Priority[]; risks: Risk[];
  coverage: {
    index_coverage_pct: number; components_available: string[]; components_unavailable: string[];
    role_readiness_coverage_pct: number | null; competency_measurable: number;
    competency_unmeasurable: number; competency_coverage_pct: number | null;
    benchmark_dimensions_total: number; benchmark_dimensions_available: number;
    benchmark_suppressed: number;
  };
  confidence: { score: number; band: string; measurement: string; caps: string[]; factors: string[]; };
  language_policy: { disclaimer: string; allowed_terms: string[]; disallowed_terms: string[]; };
  notes: string[];
}

const BAND_COLOR: Record<string, string> = {
  Excellent: '#15803d', Strong: '#16a34a', Developing: '#ca8a04',
  Emerging: '#ea580c', Early: '#dc2626',
};
const CONF_COLOR: Record<string, string> = {
  High: '#15803d', Moderate: '#ca8a04', Limited: '#ea580c', Low: '#dc2626', None: '#6b7280',
};

async function getJSON(url: string) {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export default function CompetencyEIPanel() {
  const qc = useQueryClient();
  const [subjectInput, setSubjectInput] = useState('demo_subj_swe');
  const [subject, setSubject] = useState('demo_subj_swe');

  const overview = useQuery({
    queryKey: ['/api/competency-ei/admin/overview'],
    queryFn: () => getJSON('/api/competency-ei/admin/overview'),
  });

  const intel = useQuery<{ data: Intelligence }>({
    queryKey: ['/api/competency-ei/intelligence', subject],
    queryFn: () => getJSON(`/api/competency-ei/intelligence/${encodeURIComponent(subject)}`),
    enabled: !!subject,
  });

  const history = useQuery<{ data: any[] }>({
    queryKey: ['/api/competency-ei/intelligence', subject, 'history'],
    queryFn: () => getJSON(`/api/competency-ei/intelligence/${encodeURIComponent(subject)}/history`),
    enabled: !!subject,
  });

  const snapshot = useMutation({
    mutationFn: () =>
      fetch(`/api/competency-ei/intelligence/${encodeURIComponent(subject)}/snapshot`, {
        method: 'POST', credentials: 'include',
      }).then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/competency-ei/intelligence', subject, 'history'] });
      qc.invalidateQueries({ queryKey: ['/api/competency-ei/admin/overview'] });
    },
  });

  const d = intel.data?.data;
  const ov = overview.data?.data;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: BRAND.primary }}>
            <Activity className="h-6 w-6" /> Competency Employability Intelligence
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Composes role readiness, development gaps, behavioural signals & cohort benchmark into a
            developmental Employability Index. Read-only · additive · flag-gated.
          </p>
        </div>
        {ov && (
          <div className="flex gap-4 text-sm">
            <Stat label="Snapshots" value={ov.total_snapshots} />
            <Stat label="Subjects" value={ov.distinct_subjects} />
            <Stat label="Avg Index" value={ov.avg_index_score ?? '—'} />
          </div>
        )}
      </div>

      {/* Subject selector */}
      <div className="bg-white rounded-xl border p-4 flex items-center gap-3 flex-wrap">
        <Search className="h-4 w-4 text-gray-400" />
        <input
          className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[220px]"
          value={subjectInput}
          onChange={(e) => setSubjectInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') setSubject(subjectInput.trim()); }}
          placeholder="Subject id (e.g. demo_subj_swe)"
          data-testid="input-cei-subject"
        />
        <button
          className="px-4 py-2 rounded-lg text-white text-sm font-medium"
          style={{ backgroundColor: BRAND.primary }}
          onClick={() => setSubject(subjectInput.trim())}
          data-testid="button-cei-load"
        >Load</button>
        <button
          className="px-4 py-2 rounded-lg text-sm font-medium border flex items-center gap-1.5 disabled:opacity-50"
          style={{ color: BRAND.primary, borderColor: BRAND.primary }}
          disabled={snapshot.isPending || !d?.measurable}
          onClick={() => snapshot.mutate()}
          data-testid="button-cei-snapshot"
          title={d?.measurable ? 'Append an immutable snapshot' : 'Not measurable — nothing to capture'}
        >
          <Camera className="h-4 w-4" /> {snapshot.isPending ? 'Capturing…' : 'Capture Snapshot'}
        </button>
      </div>

      {intel.isLoading && <div className="text-gray-500 text-sm">Loading…</div>}
      {intel.isError && <div className="text-red-600 text-sm">Failed to load intelligence.</div>}

      {d && !d.measurable && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
          <Info className="h-5 w-5 text-amber-600 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800">Not measurable</p>
            <p className="text-sm text-amber-700 mt-1">
              {d.notes?.[0] ?? 'This subject has no measured competency profile.'}
            </p>
          </div>
        </div>
      )}

      {d && d.measurable && (
        <>
          {/* Index + Confidence — two separate axes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border p-5 text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs uppercase tracking-wide text-gray-500 mb-2">
                <Gauge className="h-4 w-4" /> Employability Index
              </div>
              <div className="text-5xl font-bold" style={{ color: BAND_COLOR[d.index_band ?? ''] ?? BRAND.primary }}>
                {d.index_score ?? '—'}
              </div>
              <div className="text-sm font-medium mt-1" style={{ color: BAND_COLOR[d.index_band ?? ''] ?? '#6b7280' }}>
                {d.index_band ?? 'n/a'} <span className="text-gray-400">(developmental band)</span>
              </div>
              {d.role_id && <div className="text-xs text-gray-400 mt-2">Role: {d.role_id}</div>}
            </div>

            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-gray-500 mb-2">
                <Layers className="h-4 w-4" /> Coverage <span className="text-gray-300">(how much measured)</span>
              </div>
              <MeterRow label="Index coverage" pct={d.coverage.index_coverage_pct} />
              <MeterRow label="Role readiness" pct={d.coverage.role_readiness_coverage_pct} />
              <MeterRow label="Competency" pct={d.coverage.competency_coverage_pct} />
              <div className="text-xs text-gray-500 mt-2 space-y-0.5">
                <div>Benchmark dims: {d.coverage.benchmark_dimensions_available}/{d.coverage.benchmark_dimensions_total}</div>
                {d.coverage.benchmark_suppressed > 0 && (
                  <div className="text-amber-600">{d.coverage.benchmark_suppressed} k-anonymity suppressed</div>
                )}
                {d.coverage.competency_unmeasurable > 0 && (
                  <div className="text-amber-600">{d.coverage.competency_unmeasurable} unmeasurable competencies</div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-gray-500 mb-2">
                <ShieldAlert className="h-4 w-4" /> Confidence <span className="text-gray-300">(how trustworthy)</span>
              </div>
              <div className="text-3xl font-bold" style={{ color: CONF_COLOR[d.confidence.band] ?? '#6b7280' }}>
                {d.confidence.score}
                <span className="text-base font-medium ml-2">{d.confidence.band}</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">measurement: {d.confidence.measurement}</div>
              {d.confidence.caps.map((c, i) => (
                <div key={i} className="text-xs text-amber-700 mt-1.5 flex items-start gap-1">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> {c}
                </div>
              ))}
              {d.confidence.factors.map((f, i) => (
                <div key={i} className="text-xs text-gray-500 mt-1">• {f}</div>
              ))}
            </div>
          </div>

          {/* Drivers */}
          <Section icon={<Target className="h-4 w-4" />} title="Drivers (weighted contribution to the index)">
            <div className="space-y-2">
              {d.drivers.map((dr) => (
                <div key={dr.key} className="flex items-center gap-3 text-sm">
                  <div className="w-44 shrink-0 text-gray-700">{dr.label}</div>
                  <div className="flex-1 h-3 bg-gray-100 rounded overflow-hidden">
                    {dr.status === 'available' && dr.raw_score != null && (
                      <div className="h-full rounded" style={{
                        width: `${dr.raw_score}%`,
                        backgroundColor: dr.direction === 'drag' ? '#dc2626' : dr.direction === 'lift' ? BRAND.accent : '#9ca3af',
                      }} />
                    )}
                  </div>
                  <div className="w-16 text-right text-gray-600">
                    {dr.status === 'available' ? dr.raw_score : <span className="text-gray-400 text-xs">n/a</span>}
                  </div>
                  <div className="w-28 text-right text-xs text-gray-500">
                    {dr.status === 'available'
                      ? `+${dr.contribution} (w${dr.weight})`
                      : <span title={dr.reason}>unavailable</span>}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Strengths + Priorities + Risks */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Section icon={<Sparkles className="h-4 w-4 text-green-600" />} title={`Strengths (${d.strengths.length})`}>
              {d.strengths.length === 0 && <Empty text="No positive-source strengths surfaced." />}
              {d.strengths.map((s, i) => (
                <div key={i} className="border-l-2 border-green-400 pl-3 py-1">
                  <div className="text-sm font-medium text-gray-800">{s.label}</div>
                  <div className="text-xs text-gray-500">{s.detail}</div>
                  <div className="text-[10px] uppercase tracking-wide text-gray-400 mt-0.5">{s.source}</div>
                </div>
              ))}
            </Section>

            <Section icon={<Target className="h-4 w-4 text-amber-600" />} title={`Development Priorities (${d.priorities.length})`}>
              {d.priorities.length === 0 && <Empty text="No prioritised development gaps." />}
              {d.priorities.map((p, i) => (
                <div key={i} className="border-l-2 border-amber-400 pl-3 py-1">
                  <div className="text-sm font-medium text-gray-800">{p.competency_name}</div>
                  <div className="text-xs text-gray-500">
                    {p.current_level ?? '?'} → {p.required_level ?? '?'} · gap {p.gap ?? '?'} · {p.severity}
                  </div>
                </div>
              ))}
            </Section>

            <Section icon={<ShieldAlert className="h-4 w-4 text-red-600" />} title={`Risk Flags (${d.risks.length})`}>
              {d.risks.length === 0 && <Empty text="No fired risk signals." />}
              {d.risks.map((r, i) => (
                <div key={i} className="border-l-2 border-red-400 pl-3 py-1">
                  <div className="text-sm font-medium text-gray-800">{r.name}</div>
                  {r.interpretation && <div className="text-xs text-gray-500">{r.interpretation}</div>}
                </div>
              ))}
            </Section>
          </div>

          {/* History */}
          <Section icon={<HistoryIcon className="h-4 w-4" />} title={`Snapshot History (${history.data?.data?.length ?? 0})`}>
            {(history.data?.data?.length ?? 0) === 0 && <Empty text="No snapshots captured yet." />}
            {(history.data?.data ?? []).map((h: any) => (
              <div key={h.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                <span className="text-gray-600">{new Date(h.created_at).toLocaleString()}</span>
                <span className="font-medium" style={{ color: BAND_COLOR[h.index_band] ?? '#6b7280' }}>
                  {h.index_score ?? '—'} {h.index_band ?? ''}
                </span>
                <span className="text-xs text-gray-400">conf {h.confidence_band}</span>
              </div>
            ))}
          </Section>

          {/* Language policy */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-800">{d.language_policy.disclaimer}</p>
          </div>

          {d.notes.length > 0 && (
            <div className="text-xs text-gray-400">
              {d.notes.map((n, i) => <div key={i}>note: {n}</div>)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="text-center">
      <div className="text-lg font-bold" style={{ color: BRAND.primary }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border p-5">
      <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-3">{icon} {title}</h2>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-xs text-gray-400 italic">{text}</div>;
}

function MeterRow({ label, pct }: { label: string; pct: number | null }) {
  return (
    <div className="flex items-center gap-2 text-xs mb-1.5">
      <div className="w-28 text-gray-500 shrink-0">{label}</div>
      <div className="flex-1 h-2 bg-gray-100 rounded overflow-hidden">
        {pct != null && <div className="h-full rounded" style={{ width: `${pct}%`, backgroundColor: BRAND.accent }} />}
      </div>
      <div className="w-12 text-right text-gray-600">{pct != null ? `${pct}%` : 'n/a'}</div>
    </div>
  );
}
