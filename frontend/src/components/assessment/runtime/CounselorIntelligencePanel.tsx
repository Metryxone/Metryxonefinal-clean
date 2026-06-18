import type { StakeholderSummary, Palette } from './types';
import { SummarySections } from './SummarySections';
import { RuntimePanelShell } from './RuntimePanelShell';

/**
 * Counselor-facing runtime view: Priority Risks · Priority Interventions ·
 * Recommended Follow-Ups · Progress Monitoring. Read-only over the stakeholder
 * summary; Priority Risks are the activated signals ranked by severity.
 */
export function CounselorIntelligencePanel({ summary, B }: { summary: StakeholderSummary; B: Palette }) {
  return (
    <RuntimePanelShell
      B={B}
      accent={B.navy}
      title="Counselor View"
      archetypeName={summary.archetype?.name ?? null}
      degraded={summary.degraded}
      blurb="A clinical-style snapshot — the highest-priority risk signals, the interventions to lead with, follow-up checkpoints, and what to monitor over time."
    >
      <SummarySections sections={summary.sections} B={B} accent={B.navy} />
    </RuntimePanelShell>
  );
}
