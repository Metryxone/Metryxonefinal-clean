import React from 'react';
import { BRAND } from '@/design-system/tokens';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

/**
 * SimulationRunner — first-class interactive SIMULATION delivery mode (GAP-AD-2).
 *
 * A task-based interactive runner: the candidate works through an ordered set of
 * steps (each with a prompt + a discrete set of actions). The runner records the
 * chosen action + timing per step and emits a transcript on completion so the
 * parent can persist to ad_responses / ad_events. Scoring of the transcript is
 * Phase 3.5 — this runner only DELIVERS the simulation and captures behaviour.
 */
export interface SimulationAction { id: string; label: string }
export interface SimulationStep { id: string; prompt: string; actions: SimulationAction[] }
export interface SimulationChoice { stepId: string; actionId: string; elapsedMs: number }

export interface SimulationRunnerProps {
  title: string;
  steps: SimulationStep[];
  onCommit?: (payload: { transcript: SimulationChoice[]; completed: boolean }) => void;
}

export default function SimulationRunner({ title, steps, onCommit }: SimulationRunnerProps) {
  const [idx, setIdx] = React.useState(0);
  const [transcript, setTranscript] = React.useState<SimulationChoice[]>([]);
  const stepStartRef = React.useRef<number>(Date.now());

  React.useEffect(() => { stepStartRef.current = Date.now(); }, [idx]);

  const done = idx >= steps.length;
  const step = steps[idx];

  const choose = React.useCallback((actionId: string) => {
    const elapsedMs = Date.now() - stepStartRef.current;
    const next = [...transcript, { stepId: step.id, actionId, elapsedMs }];
    setTranscript(next);
    const nextIdx = idx + 1;
    setIdx(nextIdx);
    if (nextIdx >= steps.length) onCommit?.({ transcript: next, completed: true });
  }, [transcript, step, idx, steps.length, onCommit]);

  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold" style={{ color: BRAND.primary }}>Simulation · {title}</span>
        <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">
          {done ? 'complete' : `step ${idx + 1}/${steps.length}`}
        </Badge>
      </div>
      {!done && step ? (
        <>
          <p className="mb-3 text-xs text-muted-foreground">{step.prompt}</p>
          <div className="flex flex-wrap gap-2">
            {step.actions.map((a) => (
              <Button key={a.id} size="sm" variant="outline" onClick={() => choose(a.id)}>{a.label}</Button>
            ))}
          </div>
        </>
      ) : (
        <div className="text-xs text-emerald-700">
          Simulation complete — {transcript.length} action{transcript.length === 1 ? '' : 's'} captured.
          <Button size="sm" variant="ghost" className="ml-2" onClick={() => { setIdx(0); setTranscript([]); }}>Restart</Button>
        </div>
      )}
    </div>
  );
}
