/**
 * CompetencyWizard — a guided, deduplicated view of the Competency Framework
 * admin panels. It reuses the EXACT same panel nodes that the classic
 * FrameworkPanel renders (passed in via `extraTabs`), but presents them as an
 * ordered pipeline: Import reference data → Build framework → Map roles →
 * Author questions → Scoring → Validate & Report.
 *
 * Additive + reversible: the host (CompetencyFrameworkShell) lets the user flip
 * back to the classic all-tabs view at any time. Nothing is removed.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Check, type LucideIcon } from 'lucide-react';
import type { FrameworkExtraTab } from '@/components/admin/FrameworkPanel';

export type WizardStep = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Panel ids (from extraTabs) that belong to this step, in display order. */
  tabIds: string[];
};

export default function CompetencyWizard({
  extraTabs,
  steps,
  color,
}: {
  extraTabs: FrameworkExtraTab[];
  steps: WizardStep[];
  color: string;
}) {
  const byId = useMemo(() => {
    const m = new Map<string, FrameworkExtraTab>();
    extraTabs.forEach((t) => m.set(t.id, t));
    return m;
  }, [extraTabs]);

  // Resolve each step to the panels that actually exist (respects flag-gated
  // panels that may be absent from extraTabs), and drop any empty step.
  const resolvedSteps = useMemo(
    () =>
      steps
        .map((s) => ({
          ...s,
          panels: s.tabIds
            .map((id) => byId.get(id))
            .filter((t): t is FrameworkExtraTab => !!t),
        }))
        .filter((s) => s.panels.length > 0),
    [steps, byId],
  );

  const [stepIdx, setStepIdx] = useState(0);
  const [panelId, setPanelId] = useState<string | null>(null);

  // Dev guard: every panel passed in should be assigned to exactly one step,
  // otherwise it silently disappears from the wizard view. Surfaces the gap so
  // a newly-added competency-fw tab gets placed into a step.
  if (import.meta.env.DEV) {
    const covered = new Set(steps.flatMap((s) => s.tabIds));
    const uncovered = extraTabs.filter((t) => !covered.has(t.id)).map((t) => t.id);
    if (uncovered.length) {
      // eslint-disable-next-line no-console
      console.warn(`[CompetencyWizard] panel(s) not assigned to any wizard step (hidden in wizard view, reachable via "All tabs"): ${uncovered.join(', ')}`);
    }
  }

  if (resolvedSteps.length === 0) {
    return <div className="text-sm text-gray-500 p-6">No framework panels are available.</div>;
  }

  const safeIdx = Math.min(stepIdx, resolvedSteps.length - 1);
  const step = resolvedSteps[safeIdx];
  const activePanelId = panelId && step.panels.some((p) => p.id === panelId) ? panelId : step.panels[0].id;
  const activePanel = step.panels.find((p) => p.id === activePanelId)!;

  const goStep = (i: number) => {
    setStepIdx(i);
    setPanelId(null); // default to the step's first panel
  };

  return (
    <div className="space-y-5">
      {/* ── Stepper ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-stretch gap-2">
        {resolvedSteps.map((s, i) => {
          const Icon = s.icon;
          const active = i === safeIdx;
          const done = i < safeIdx;
          return (
            <button
              key={s.id}
              onClick={() => goStep(i)}
              className="group flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-all"
              style={{
                borderColor: active ? color : done ? `${color}55` : '#e5e7eb',
                backgroundColor: active ? `${color}10` : '#fff',
              }}
            >
              <span
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                style={{
                  backgroundColor: active || done ? color : '#f3f4f6',
                  color: active || done ? '#fff' : '#9ca3af',
                }}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className="flex flex-col leading-tight">
                <span
                  className="flex items-center gap-1.5 text-xs font-semibold"
                  style={{ color: active ? color : '#374151' }}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {s.title}
                </span>
                <span className="text-[10px] text-gray-400">{s.panels.length} step{s.panels.length === 1 ? '' : 's'}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Step header ─────────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-100 bg-gray-50/60 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold" style={{ color }}>
          <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: color }}>
            {safeIdx + 1}
          </span>
          {step.title}
        </div>
        <p className="mt-1 text-xs text-gray-500">{step.description}</p>
      </div>

      {/* ── Within-step panel sub-nav (only when >1 panel) ─────── */}
      {step.panels.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {step.panels.map((p) => {
            const Icon = p.icon;
            const active = p.id === activePanelId;
            return (
              <button
                key={p.id}
                onClick={() => setPanelId(p.id)}
                className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-all"
                style={{
                  borderColor: active ? color : '#e5e7eb',
                  color: active ? color : '#6b7280',
                  backgroundColor: active ? `${color}0d` : '#fff',
                }}
              >
                <Icon className="h-3.5 w-3.5" />
                {p.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Active panel body ───────────────────────────────────── */}
      <div>{activePanel.node as ReactNode}</div>

      {/* ── Back / Next footer ──────────────────────────────────── */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-4">
        <button
          onClick={() => goStep(Math.max(0, safeIdx - 1))}
          disabled={safeIdx === 0}
          className="flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40"
          style={{ borderColor: '#e5e7eb', color: '#374151' }}
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
        <span className="text-[11px] text-gray-400">
          Step {safeIdx + 1} of {resolvedSteps.length}
        </span>
        <button
          onClick={() => goStep(Math.min(resolvedSteps.length - 1, safeIdx + 1))}
          disabled={safeIdx === resolvedSteps.length - 1}
          className="flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40"
          style={{ backgroundColor: color }}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
