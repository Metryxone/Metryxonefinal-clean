/**
 * Phase 3.4 + 3.5 — Candidate Employability Profile dashboard.
 *
 * Read-only viewer over:
 *   - GET  /api/competency-ei/profile/:subject            (3.4 EI Profile Engine)
 *   - POST /api/competency-ei/profile/:subject/snapshot   (3.4 history capture)
 *   - GET  /api/competency-ei/profile/:subject/history     (3.4 history)
 *   - GET  /api/competency-ei/role-readiness-v2/:subject   (3.5 Role Readiness V2)
 *
 * Surfaces the candidate profile (Overall EI · Dimension Scores · Strength Areas
 * · Development Areas · Critical Risks · Growth Potential) and the five-component
 * V2 role view (Readiness · Match · Gap · Risk · Potential). COMPOSES already-
 * computed numbers — nothing is recomputed here. Coverage (how much measured) and
 * Confidence (how trustworthy) are shown as SEPARATE axes; unmeasurable surfaces
 * show a reason, never a fabricated 0.
 *
 * Only mounted when the `competencyEi` flag probe succeeds (nav self-hides when
 * OFF, keeping flag-OFF UI byte-identical). Snapshot capture is an EXPLICIT POST.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserCheck, Gauge, ShieldAlert, Sparkles, Target, TrendingUp, Camera,
  AlertTriangle, CheckCircle2, Info, History as HistoryIcon, Search, Layers,
} from 'lucide-react';

const BRAND = { primary: '#344E86', accent: '#5B7BD5' };

const BAND_COLOR: Record<string, string> = {
  Excellent: '#15803d', Strong: '#16a34a', Developing: '#ca8a04',
  Emerging: '#ea580c', Early: '#dc2626',
};
const CONF_COLOR: Record<string, string> = {
  High: '#15803d', Moderate: '#ca8a04', Limited: '#ea580c', Low: '#dc2626', None: '#6b7280',
};
const LEVEL_COLOR: Record<string, string> = {
  High: '#16a34a', Medium: '#ca8a04', Moderate: '#ca8a04', Low: '#dc2626', Unmeasured: '#6b7280',
};
const RISK_COLOR: Record<string, string> = {
  Low: '#16a34a', Medium: '#ca8a04', High: '#dc2626', Unmeasured: '#6b7280',
};

interface ConfidenceShape { score: number; band: string; measurement: string; caps: string[]; factors: string[]; }
interface DimensionScore {
  ei_dimension_id: string; dimension_name: string; measurable: boolean;
  score: number | null; band: string | null; coverage_pct: number; reason?: string;
}
interface StrengthArea { ei_dimension_id: string; dimension_name: string; score: number; band: string; rationale: string; }
interface DevelopmentArea { ei_dimension_id: string; dimension_name: string; score: number; band: string; headroom: number; rationale: string; }
interface CriticalRisk { type: string; ei_dimension_id: string | null; dimension_name: string | null; detail: string; severity: string; }
interface GrowthPotential {
  level: string; score: number | null;
  improvable_dimensions: Array<{ ei_dimension_id: string; dimension_name: string; headroom: number }>;
  drivers: string[]; reason: string | null;
}
interface EiProfile {
  ok: boolean; subject_id: string; role_id: string | null; version: string; measurable: boolean;
  overall_ei: { measurable: boolean; ei_score: number | null; band: string | null; coverage_pct: number };
  confidence: ConfidenceShape;
  dimension_scores: DimensionScore[];
  strength_areas: StrengthArea[];
  development_areas: DevelopmentArea[];
  critical_risks: CriticalRisk[];
  growth_potential: GrowthPotential;
  notes: string[];
}

interface Factor { key: string; label: string; contribution: number; }
interface RoleRisk { level: string; score: number | null; blocking_gaps: number; factors: Factor[]; notes: string[]; }
interface RolePotential { level: string; score: number | null; closable_gaps: number; factors: Factor[]; notes: string[]; }
interface RoleReadinessV2 {
  ok: boolean; subject_id: string; role_id: string | null; role_title: string | null;
  version: string; measurable: boolean;
  readiness: { measured: boolean; score: number | null; band: string | null; label: string | null; coverage_pct: number | null };
  role_match: { fit_band: string; label: string; score: number | null; capped_by_critical: boolean };
  role_gap: {
    top_gap: { competency_id: string; competency_name: string | null; required_level: number; actual_level: number | null; gap: number; criticality: string; blocking: boolean } | null;
    gap_areas: any[]; critical_gaps: any[]; blocking_gaps: number;
  };
  role_risk: RoleRisk;
  role_potential: RolePotential;
  ei_profile_summary: { measurable: boolean; ei_score: number | null; band: string | null; coverage_pct: number; confidence: ConfidenceShape };
  language_policy: { disclaimer: string };
  notes: string[];
}

async function getJSON(url: string) {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export default function EiProfileDashboardPanel() {
  const qc = useQueryClient();
  const [subjectInput, setSubjectInput] = useState('demo_subj_swe');
  const [subject, setSubject] = useState('demo_subj_swe');

  const profile = useQuery<{ data: EiProfile }>({
    queryKey: ['/api/competency-ei/profile', subject],
    queryFn: () => getJSON(`/api/competency-ei/profile/${encodeURIComponent(subject)}`),
    enabled: !!subject,
  });
  const v2 = useQuery<{ data: RoleReadinessV2 }>({
    queryKey: ['/api/competency-ei/role-readiness-v2', subject],
    queryFn: () => getJSON(`/api/competency-ei/role-readiness-v2/${encodeURIComponent(subject)}`),
    enabled: !!subject,
  });
  const history = useQuery<{ data: any[] }>({
    queryKey: ['/api/competency-ei/profile', subject, 'history'],
    queryFn: () => getJSON(`/api/competency-ei/profile/${encodeURIComponent(subject)}/history`),
    enabled: !!subject,
  });

  const snapshot = useMutation({
    mutationFn: () =>
      fetch(`/api/competency-ei/profile/${encodeURIComponent(subject)}/snapshot`, {
        method: 'POST', credentials: 'include',
      }).then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/competency-ei/profile', subject, 'history'] });
    },
  });

  const p = profile.data?.data;
  const r = v2.data?.data;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: BRAND.primary }}>
            <UserCheck className="h-6 w-6" /> Candidate Employability Profile
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Composes the employability scoring chain into a candidate profile (Overall EI, dimensions,
            strengths, development areas, critical risks, growth potential) and a five-component role view.
            Read-only · additive · flag-gated. <span className="text-gray-400">Phase 3.4 + 3.5</span>
          </p>
        </div>
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
          data-testid="input-eiprofile-subject"
        />
        <button
          className="px-4 py-2 rounded-lg text-white text-sm font-medium"
          style={{ backgroundColor: BRAND.primary }}
          onClick={() => setSubject(subjectInput.trim())}
          data-testid="button-eiprofile-load"
        >Load</button>
        <button
          className="px-4 py-2 rounded-lg text-sm font-medium border flex items-center gap-1.5 disabled:opacity-50"
          style={{ color: BRAND.primary, borderColor: BRAND.primary }}
          disabled={snapshot.isPending || !p?.measurable}
          onClick={() => snapshot.mutate()}
          data-testid="button-eiprofile-snapshot"
          title={p?.measurable ? 'Append an immutable profile snapshot' : 'Not measurable — nothing to capture'}
        >
          <Camera className="h-4 w-4" /> {snapshot.isPending ? 'Capturing…' : 'Capture Snapshot'}
        </button>
      </div>

      {profile.isLoading && <div className="text-gray-500 text-sm">Loading profile…</div>}
      {profile.isError && <div className="text-red-600 text-sm">Failed to load profile.</div>}

      {p && !p.measurable && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
          <Info className="h-5 w-5 text-amber-600 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800">Not measurable</p>
            <p className="text-sm text-amber-700 mt-1">
              {p.notes?.[0] ?? 'This subject has no measured employability profile.'}
            </p>
          </div>
        </div>
      )}

      {p && p.measurable && (
        <>
          {/* Overall EI + Coverage + Confidence — separate axes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border p-5 text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs uppercase tracking-wide text-gray-500 mb-2">
                <Gauge className="h-4 w-4" /> Overall EI
              </div>
              <div className="text-5xl font-bold" style={{ color: BAND_COLOR[p.overall_ei.band ?? ''] ?? BRAND.primary }}>
                {p.overall_ei.ei_score ?? '—'}
              </div>
              <div className="text-sm font-medium mt-1" style={{ color: BAND_COLOR[p.overall_ei.band ?? ''] ?? '#6b7280' }}>
                {p.overall_ei.band ?? 'n/a'} <span className="text-gray-400">(developmental band)</span>
              </div>
              {p.role_id && <div className="text-xs text-gray-400 mt-2">Role: {p.role_id}</div>}
            </div>

            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-gray-500 mb-2">
                <Layers className="h-4 w-4" /> Coverage <span className="text-gray-300">(how much measured)</span>
              </div>
              <MeterRow label="EI coverage" pct={p.overall_ei.coverage_pct} />
              <div className="text-xs text-gray-500 mt-2">
                {p.dimension_scores.filter((d) => d.measurable).length}/{p.dimension_scores.length} dimensions measurable
              </div>
            </div>

            <ConfidenceCard conf={p.confidence} />
          </div>

          {/* Dimension scores */}
          <Section icon={<Target className="h-4 w-4" />} title={`Dimension Scores (${p.dimension_scores.length})`}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {p.dimension_scores.map((d) => (
                <div key={d.ei_dimension_id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-gray-800">{d.dimension_name}</div>
                    {d.measurable && d.score != null ? (
                      <div className="text-xl font-bold" style={{ color: BAND_COLOR[d.band ?? ''] ?? BRAND.primary }}>
                        {d.score}<span className="text-xs font-medium ml-1.5">{d.band}</span>
                      </div>
                    ) : (
                      <div className="text-xs font-medium text-gray-400 italic">Not measurable</div>
                    )}
                  </div>
                  {d.measurable && d.score != null
                    ? <div className="mt-1.5"><MeterRow label="Coverage" pct={d.coverage_pct} /></div>
                    : <div className="text-xs text-gray-400 mt-1">{d.reason ?? 'No mapped, measured competencies.'}</div>}
                </div>
              ))}
            </div>
          </Section>

          {/* Strengths + Development + Risks */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Section icon={<Sparkles className="h-4 w-4 text-green-600" />} title={`Strength Areas (${p.strength_areas.length})`}>
              {p.strength_areas.length === 0 && <Empty text="No strength-level dimensions surfaced." />}
              {p.strength_areas.map((s) => (
                <div key={s.ei_dimension_id} className="border-l-2 border-green-400 pl-3 py-1">
                  <div className="text-sm font-medium text-gray-800">{s.dimension_name} <span className="text-green-700">· {s.score}</span></div>
                  <div className="text-xs text-gray-500">{s.rationale}</div>
                </div>
              ))}
            </Section>

            <Section icon={<Target className="h-4 w-4 text-amber-600" />} title={`Development Areas (${p.development_areas.length})`}>
              {p.development_areas.length === 0 && <Empty text="No development gaps surfaced." />}
              {p.development_areas.map((dv) => (
                <div key={dv.ei_dimension_id} className="border-l-2 border-amber-400 pl-3 py-1">
                  <div className="text-sm font-medium text-gray-800">{dv.dimension_name} <span className="text-amber-700">· {dv.score ?? '?'}</span></div>
                  <div className="text-xs text-gray-500">{dv.rationale}</div>
                </div>
              ))}
            </Section>

            <Section icon={<ShieldAlert className="h-4 w-4 text-red-600" />} title={`Critical Risks (${p.critical_risks.length})`}>
              {p.critical_risks.length === 0 && <Empty text="No critical risks flagged." />}
              {p.critical_risks.map((cr, i) => (
                <div key={`${cr.type}-${cr.ei_dimension_id ?? i}`} className="border-l-2 border-red-400 pl-3 py-1">
                  <div className="text-sm font-medium text-gray-800">{cr.dimension_name ?? cr.type.replace(/_/g, ' ')} <span className="text-[10px] uppercase tracking-wide text-gray-400">{cr.severity}</span></div>
                  <div className="text-xs text-gray-500">{cr.detail}</div>
                </div>
              ))}
            </Section>
          </div>

          {/* Growth potential */}
          <Section icon={<TrendingUp className="h-4 w-4" style={{ color: BRAND.accent }} />} title="Growth Potential">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="text-center">
                <div className="text-3xl font-bold" style={{ color: LEVEL_COLOR[p.growth_potential.level] ?? BRAND.primary }}>
                  {p.growth_potential.score ?? '—'}
                </div>
                <div className="text-xs font-medium" style={{ color: LEVEL_COLOR[p.growth_potential.level] ?? '#6b7280' }}>
                  {p.growth_potential.level}
                </div>
              </div>
              <div className="flex-1 min-w-[240px]">
                {p.growth_potential.drivers.map((dr, i) => (
                  <div key={i} className="text-xs text-gray-600">• {dr}</div>
                ))}
                <div className="text-[11px] text-gray-400 mt-1.5">{p.growth_potential.reason}</div>
              </div>
            </div>
          </Section>
        </>
      )}

      {/* ============ Phase 3.5 — Role Readiness V2 ============ */}
      <div className="border-t pt-5">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-1" style={{ color: BRAND.primary }}>
          <Gauge className="h-5 w-5" /> Role Readiness V2 <span className="text-[11px] uppercase tracking-wide text-gray-400 font-normal">Phase 3.5</span>
        </h2>
        {v2.isLoading && <div className="text-gray-500 text-sm">Loading role readiness…</div>}
        {v2.isError && <div className="text-red-600 text-sm">Failed to load role readiness.</div>}

        {r && !r.measurable && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3 mt-2">
            <Info className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800">Role readiness unmeasured</p>
              <p className="text-sm text-amber-700 mt-1">{r.notes?.[0] ?? 'No scored profile or no linked role.'}</p>
            </div>
          </div>
        )}

        {r && r.measurable && (
          <div className="space-y-4 mt-3">
            <div className="text-sm text-gray-600">
              Role: <span className="font-semibold text-gray-800">{r.role_title ?? r.role_id ?? '—'}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <V2Card label="Readiness" value={r.readiness.score} suffix="%" sub={r.readiness.label ?? r.readiness.band ?? ''} color={BAND_COLOR[r.readiness.band ?? ''] ?? BRAND.primary} />
              <V2Card label="Match" value={r.role_match.score} suffix="%" sub={r.role_match.label} color={BRAND.accent} />
              <V2Card label="Gap" value={r.role_gap.gap_areas.length} sub={r.role_gap.blocking_gaps > 0 ? `${r.role_gap.blocking_gaps} critical` : 'no critical'} color={r.role_gap.blocking_gaps > 0 ? '#dc2626' : '#6b7280'} />
              <V2Card label="Risk" value={r.role_risk.score} sub={r.role_risk.level} color={RISK_COLOR[r.role_risk.level] ?? '#6b7280'} />
              <V2Card label="Potential" value={r.role_potential.score} sub={r.role_potential.level} color={LEVEL_COLOR[r.role_potential.level] ?? '#6b7280'} />
            </div>

            {/* Coverage caveat */}
            {r.readiness.coverage_pct != null && r.readiness.coverage_pct < 100 && (
              <div className="text-xs text-amber-700 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> {Math.round(100 - r.readiness.coverage_pct)}% of role weight unassessed — readiness is provisional (Coverage and readiness are separate axes).
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Section icon={<Target className="h-4 w-4 text-amber-600" />} title="Top Gap">
                {r.role_gap.top_gap ? (
                  <div className="border-l-2 border-amber-400 pl-3 py-1">
                    <div className="text-sm font-medium text-gray-800">{r.role_gap.top_gap.competency_name ?? r.role_gap.top_gap.competency_id}</div>
                    <div className="text-xs text-gray-500">
                      {r.role_gap.top_gap.actual_level ?? '?'} → {r.role_gap.top_gap.required_level} · gap {r.role_gap.top_gap.gap}
                      {r.role_gap.top_gap.blocking && <span className="text-red-600"> · critical</span>}
                    </div>
                  </div>
                ) : <Empty text="No gaps — role requirements met." />}
              </Section>

              <Section icon={<ShieldAlert className="h-4 w-4 text-red-600" />} title={`Risk Factors (${r.role_risk.factors.length})`}>
                {r.role_risk.factors.length === 0 && <Empty text="No risk factors." />}
                {r.role_risk.factors.map((f) => (
                  <FactorRow key={f.key} f={f} />
                ))}
                {r.role_risk.notes.map((n, i) => <div key={i} className="text-[11px] text-gray-400 mt-1">{n}</div>)}
              </Section>

              <Section icon={<TrendingUp className="h-4 w-4" style={{ color: BRAND.accent }} />} title={`Potential Factors (${r.role_potential.factors.length})`}>
                {r.role_potential.factors.length === 0 && <Empty text="No potential factors." />}
                {r.role_potential.factors.map((f) => (
                  <FactorRow key={f.key} f={f} />
                ))}
                {r.role_potential.notes.map((n, i) => <div key={i} className="text-[11px] text-gray-400 mt-1">{n}</div>)}
              </Section>
            </div>
          </div>
        )}
      </div>

      {/* History */}
      <Section icon={<HistoryIcon className="h-4 w-4" />} title={`Profile Snapshot History (${history.data?.data?.length ?? 0})`}>
        {(history.data?.data?.length ?? 0) === 0 && <Empty text="No snapshots captured yet." />}
        {(history.data?.data ?? []).map((h: any) => (
          <div key={h.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
            <span className="text-gray-600">{new Date(h.created_at).toLocaleString()}</span>
            <span className="font-medium" style={{ color: BAND_COLOR[h.ei_band] ?? '#6b7280' }}>
              {h.ei_score ?? '—'} {h.ei_band ?? ''}
            </span>
            <span className="text-xs text-gray-400">
              {h.strength_count}S · {h.development_count}D · {h.risk_count}R · conf {h.confidence_band}
            </span>
          </div>
        ))}
      </Section>

      {/* Language policy */}
      {r?.language_policy?.disclaimer && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-800">{r.language_policy.disclaimer}</p>
        </div>
      )}
    </div>
  );
}

function V2Card({ label, value, suffix, sub, color }: { label: string; value: number | null; suffix?: string; sub: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border p-4 text-center">
      <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-bold" style={{ color }}>
        {value ?? '—'}{value != null && suffix ? suffix : ''}
      </div>
      <div className="text-[11px] font-medium mt-0.5" style={{ color }}>{sub}</div>
    </div>
  );
}

function FactorRow({ f }: { f: { label: string; contribution: number } }) {
  const positive = f.contribution >= 0;
  return (
    <div className="flex items-start justify-between gap-2 text-xs py-0.5">
      <span className="text-gray-600">{f.label}</span>
      <span className="font-medium shrink-0" style={{ color: positive ? '#16a34a' : '#dc2626' }}>
        {positive ? '+' : ''}{f.contribution}
      </span>
    </div>
  );
}

function ConfidenceCard({ conf }: { conf: ConfidenceShape }) {
  return (
    <div className="bg-white rounded-xl border p-5">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-gray-500 mb-2">
        <ShieldAlert className="h-4 w-4" /> Confidence <span className="text-gray-300">(how trustworthy)</span>
      </div>
      <div className="text-3xl font-bold" style={{ color: CONF_COLOR[conf.band] ?? '#6b7280' }}>
        {conf.score}<span className="text-base font-medium ml-2">{conf.band}</span>
      </div>
      <div className="text-xs text-gray-400 mt-1">measurement: {conf.measurement}</div>
      {conf.caps.map((c, i) => (
        <div key={i} className="text-xs text-amber-700 mt-1.5 flex items-start gap-1">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> {c}
        </div>
      ))}
      {conf.factors.map((f, i) => (
        <div key={i} className="text-xs text-gray-500 mt-1">• {f}</div>
      ))}
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
