import React from 'react';
import { BRAND } from '@/design-system/tokens';
import CodeEditorRunner from './CodeEditorRunner';
import RecordedResponseRunner from './RecordedResponseRunner';
import SimulationRunner from './SimulationRunner';
import AdaptivePlayer from './AdaptivePlayer';
import ProctoringGuard from './ProctoringGuard';

export { CodeEditorRunner, RecordedResponseRunner, SimulationRunner, AdaptivePlayer, ProctoringGuard };

/**
 * DeliveryModesPreview — a compact, self-contained showcase of the five
 * first-class delivery runners that engineering-close GAP-AD-1..4. It is embedded
 * live inside the super-admin AssessmentDeliveryPanel so the components are
 * exercised (not dead code) and a certifier can see the real delivery modes.
 *
 * These are interactive demos with static sample content; wiring each runner's
 * onCommit to the ad_* overlay happens in the candidate delivery flow.
 */
export default function DeliveryModesPreview() {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <ProctoringGuard active webcam={false} onViolation={() => undefined}>
        <AdaptivePlayer
          maxItems={3}
          items={[
            { id: 'a1', difficulty: 2, prompt: 'What is 6 × 7?', options: [{ id: 'o1', label: '42', correct: true }, { id: 'o2', label: '36' }, { id: 'o3', label: '48' }] },
            { id: 'a2', difficulty: 3, prompt: 'Derivative of x²?', options: [{ id: 'o1', label: '2x', correct: true }, { id: 'o2', label: 'x' }, { id: 'o3', label: 'x²' }] },
            { id: 'a3', difficulty: 1, prompt: 'What is 2 + 2?', options: [{ id: 'o1', label: '4', correct: true }, { id: 'o2', label: '3' }, { id: 'o3', label: '5' }] },
          ]}
        />
      </ProctoringGuard>

      <CodeEditorRunner
        prompt="Return the sum of two numbers."
        functionName="add"
        starterCode={'function add(a, b) {\n  return a + b;\n}'}
        testCases={[
          { input: [2, 3], expected: 5, label: 'add(2,3)' },
          { input: [-1, 1], expected: 0, label: 'add(-1,1)' },
        ]}
      />

      <SimulationRunner
        title="Customer escalation"
        steps={[
          { id: 's1', prompt: 'An angry customer messages you. First action?', actions: [{ id: 'a', label: 'Acknowledge & apologise' }, { id: 'b', label: 'Ignore' }] },
          { id: 's2', prompt: 'They ask for a refund outside policy. Next?', actions: [{ id: 'a', label: 'Escalate to manager' }, { id: 'b', label: 'Refuse flatly' }] },
        ]}
      />

      <RecordedResponseRunner prompt="Introduce yourself in 30 seconds." mode="video" maxSeconds={30} />

      <p className="col-span-full text-[11px] text-muted-foreground">
        <span className="font-semibold" style={{ color: BRAND.primary }}>Scope boundaries (not gaps):</span> coding execution is
        JS-only (multi-language server sandbox is 3.5+ infra); adaptive routing is correctness + difficulty ladder
        (psychometric IRT is Phase 3.5 scoring); proctoring is web-level (OS-level secure browser is not web-achievable).
      </p>
    </div>
  );
}
