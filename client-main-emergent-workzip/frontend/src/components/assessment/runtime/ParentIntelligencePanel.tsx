import type { StakeholderSummary, Palette } from './types';
import { SummarySections } from './SummarySections';
import { RuntimePanelShell } from './RuntimePanelShell';

/**
 * Parent-facing runtime view: Child Strengths · Growth Areas · Home Support
 * Actions · Intervention Suggestions. Read-only over the stakeholder summary;
 * Child Strengths come ONLY from the canon strength profile (never raw signals).
 */
export function ParentIntelligencePanel({ summary, B }: { summary: StakeholderSummary; B: Palette }) {
  return (
    <RuntimePanelShell
      B={B}
      accent={B.teal}
      title="Parent View"
      archetypeName={summary.archetype?.name ?? null}
      degraded={summary.degraded}
      blurb="A snapshot mapped from your child's responses — what to build on, where they're stretching, and concrete ways to support them at home."
    >
      <SummarySections sections={summary.sections} B={B} accent={B.teal} />
    </RuntimePanelShell>
  );
}
