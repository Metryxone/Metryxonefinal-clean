import { BRAND } from '@/design-system/tokens';
import React from 'react';
import { Award } from 'lucide-react';

// ── Shared renderers for a generated report body (generated_content.sections) ──
// Extracted from superadmin/ReportFactoryPanel.tsx so the SAME on-screen view can
// be reused by candidate-facing surfaces. Mirrors the section types emitted by
// generateReport (backend/services/report-factory-schema.ts) and the precise-vs-
// domain-proxy competency layout in backend/services/pdf-renderer.ts.
// No fabrication: score == null renders "—" (never 0).



const SEVERITY_COLORS: Record<string, string> = {
  positive: BRAND.green, info: BRAND.primary, warning: BRAND.amber, critical: BRAND.red,
};

function Pill({ label, color }: { label: string; color?: string }) {
  const c = color ?? BRAND.muted;
  return (
    <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize"
      style={{ background: `${c}18`, color: c }}>{label}</span>
  );
}

// ── Precise Competency section renderer (mirrors pdf-renderer.ts) ──────────
// Renders the `precise_competency` section produced by generateReport, clearly
// labelled precise (measured per competency) vs domain-proxy (aggregate).
// No fabrication: score == null renders "—" (never 0); falls back to domain
// when precise absent. Mirrors backend/services/pdf-renderer.ts.
export function PreciseCompetencySection({ section }: { section: any }) {
  const precise: any[] = Array.isArray(section?.precise) ? section.precise : [];
  const domains: any[] = Array.isArray(section?.domains) ? section.domains : [];
  const notOnPreciseScale: any[] = Array.isArray(section?.notOnPreciseScale) ? section.notOnPreciseScale : [];
  const note = String(section?.note ?? '');

  const ScoreRow = ({ c }: { c: any }) => {
    const hasScore = c?.score != null;
    const score = hasScore ? Math.round(Number(c.score)) : null;
    return (
      <div className="flex items-center gap-2 py-1">
        <span className="flex-1 text-gray-700">{c.name ?? c.code}</span>
        {c.levelLabel && <Pill label={c.levelLabel} color={BRAND.muted} />}
        <span className="font-semibold tabular-nums" style={{ color: hasScore ? BRAND.primary : BRAND.muted }}>
          {hasScore ? `${score} / 100` : '—'}
        </span>
      </div>
    );
  };

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: BRAND.border, background: BRAND.bg }}>
      <div className="flex items-center gap-2 mb-2">
        <Award size={14} style={{ color: BRAND.green }} />
        <p className="font-semibold text-gray-800 text-sm">{section.title ?? 'Precise Competency Scores'}</p>
      </div>
      {note && <p className="text-[11px] text-gray-400 italic mb-3">{note}</p>}
      {precise.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-semibold uppercase mb-1" style={{ color: BRAND.green }}>
            Precise (measured per competency)
          </p>
          <div className="divide-y" style={{ borderColor: BRAND.border }}>
            {precise.map((c, i) => <ScoreRow key={c.code ?? i} c={c} />)}
          </div>
        </div>
      )}
      {domains.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase mb-1" style={{ color: BRAND.primary }}>
            Domain proxy (aggregate)
          </p>
          <div className="divide-y" style={{ borderColor: BRAND.border }}>
            {domains.map((c, i) => <ScoreRow key={c.code ?? i} c={c} />)}
          </div>
        </div>
      )}
      {precise.length === 0 && domains.length === 0 && (
        <p className="text-xs text-gray-400">No competency scores available.</p>
      )}
      {notOnPreciseScale.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2.5">
          <p className="text-[11px] font-medium text-amber-800">
            {notOnPreciseScale.length} of your competencies aren't on the precise scale yet
          </p>
          <p className="text-[10px] text-amber-700/90 mt-1 leading-relaxed">
            These were measured in your broader assessment, but there isn't a genuine matching
            competency in our genome yet, so we don't show a precise score rather than fabricate one:
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {notOnPreciseScale.map((c, i) => (
              <span key={c.code ?? i}
                className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white border border-amber-200 text-amber-800">
                {c.name ?? c.code}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Generic report-section renderer ───────────────────────────────────────
// Renders one entry of generated_content.sections on screen. Mirrors the
// section types emitted by generateReport (backend/services/report-factory-schema.ts).
export function ReportSection({ section }: { section: any }) {
  const type = section?.type;
  if (type === 'precise_competency') return <PreciseCompetencySection section={section} />;

  const Wrap = ({ children }: { children: React.ReactNode }) => (
    <div className="rounded-xl border p-4" style={{ borderColor: BRAND.border }}>
      <div className="flex items-center gap-2 mb-2">
        <p className="font-semibold text-gray-800 text-sm">{section.title ?? section.key}</p>
        <Pill label={String(type ?? 'section')} />
      </div>
      {children}
    </div>
  );

  if (type === 'narrative' && section.text) {
    return <Wrap><p className="text-xs text-gray-600 whitespace-pre-line">{section.text}</p></Wrap>;
  }
  if (type === 'insight') {
    const insights: any[] = Array.isArray(section.insights) ? section.insights : [];
    return (
      <Wrap>
        {insights.length === 0
          ? <p className="text-xs text-gray-400">No insights fired.</p>
          : <div className="space-y-1.5">
              {insights.map((ins, i) => (
                <div key={ins.rule_key ?? i} className="flex items-start gap-2 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                    style={{ background: SEVERITY_COLORS[ins.severity] ?? BRAND.muted }} />
                  <span className="text-gray-600">{ins.text}</span>
                </div>
              ))}
            </div>}
      </Wrap>
    );
  }
  if (type === 'benchmark') {
    const results: any[] = Array.isArray(section.benchmark_results) ? section.benchmark_results : [];
    return (
      <Wrap>
        {results.length === 0
          ? <p className="text-xs text-gray-400">No benchmark results.</p>
          : <div className="space-y-1 text-xs text-gray-600">
              {results.map((b, i) => (
                <div key={i} className="flex justify-between">
                  <span>{b.metric ?? b.label ?? `Metric ${i + 1}`}</span>
                  <span className="font-semibold tabular-nums">{b.percentile != null ? `${b.percentile}th pct` : (b.value ?? '—')}</span>
                </div>
              ))}
            </div>}
      </Wrap>
    );
  }
  if (type === 'chart') {
    return <Wrap><p className="text-xs text-gray-400">Chart: {section.visualization?.name ?? section.key} (rendered in PDF/visual export).</p></Wrap>;
  }
  // header / footer / score / custom — show whatever text the section carries
  return (
    <Wrap>
      {section.text
        ? <p className="text-xs text-gray-600 whitespace-pre-line">{section.text}</p>
        : <p className="text-xs text-gray-400">No on-screen content for this section type.</p>}
    </Wrap>
  );
}

// ── Convenience wrapper ───────────────────────────────────────────────────
// Renders an entire generated_content.sections array, with honest empty states.
export function GeneratedReportBody({ sections }: { sections: any[] }) {
  const list = Array.isArray(sections) ? sections : [];
  if (list.length === 0) {
    return <p className="text-gray-400 text-center py-4 text-xs">This report has no body sections.</p>;
  }
  return (
    <div className="space-y-2">
      {list.map((s, i) => <ReportSection key={s?.key ?? i} section={s} />)}
    </div>
  );
}
