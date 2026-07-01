import React from 'react';
import { BRAND } from '@/design-system/tokens';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

/**
 * AdaptivePlayer — first-class delivery-layer ADAPTIVE routing (GAP-AD-3).
 *
 * Routes to the next item on OBJECTIVE correctness + a difficulty ladder: a
 * correct answer steps difficulty up, an incorrect answer steps it down. This
 * mirrors the pure backend mechanism `adaptiveNext(items, history)` exposed at
 * POST /api/admin/assessment-delivery/adaptive/next. Scope boundary: psychometric
 * IRT / ability-estimation routing is Phase 3.5 (scoring) — NOT a gap; this is
 * the honest delivery-layer form.
 *
 * The client value is a naive correctness proxy by design (the authoritative
 * scoring lives in 3.5). onCommit fires with the full answered history.
 */
export interface AdaptiveItem { id: string; difficulty: 1 | 2 | 3; prompt: string; options: { id: string; label: string; correct?: boolean }[] }
export interface AdaptiveAnswer { itemId: string; optionId: string; correct: boolean; difficulty: number }

export interface AdaptivePlayerProps {
  items: AdaptiveItem[];
  maxItems?: number;
  onCommit?: (payload: { history: AdaptiveAnswer[]; finalDifficulty: number }) => void;
}

/** Pure next-item selector: mirrors backend adaptiveNext (correct → harder). */
export function pickNext(items: AdaptiveItem[], history: AdaptiveAnswer[]): AdaptiveItem | null {
  const answered = new Set(history.map((h) => h.itemId));
  const remaining = items.filter((i) => !answered.has(i.id));
  if (remaining.length === 0) return null;
  const last = history[history.length - 1];
  const target = !last ? 2 : Math.max(1, Math.min(3, last.difficulty + (last.correct ? 1 : -1)));
  const byDistance = [...remaining].sort(
    (a, b) => Math.abs(a.difficulty - target) - Math.abs(b.difficulty - target),
  );
  return byDistance[0];
}

export default function AdaptivePlayer({ items, maxItems, onCommit }: AdaptivePlayerProps) {
  const cap = maxItems ?? items.length;
  const [history, setHistory] = React.useState<AdaptiveAnswer[]>([]);
  const current = history.length >= cap ? null : pickNext(items, history);

  const answer = React.useCallback((item: AdaptiveItem, optionId: string) => {
    const opt = item.options.find((o) => o.id === optionId);
    const next = [...history, { itemId: item.id, optionId, correct: !!opt?.correct, difficulty: item.difficulty }];
    setHistory(next);
    if (next.length >= cap || pickNext(items, next) === null) {
      onCommit?.({ history: next, finalDifficulty: next[next.length - 1]?.difficulty ?? 0 });
    }
  }, [history, items, cap, onCommit]);

  const correct = history.filter((h) => h.correct).length;

  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold" style={{ color: BRAND.primary }}>Adaptive</span>
        <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">
          {current ? `L${current.difficulty} · ${history.length + 1}/${cap}` : 'complete'}
        </Badge>
      </div>
      {current ? (
        <>
          <p className="mb-3 text-xs text-muted-foreground">{current.prompt}</p>
          <div className="flex flex-wrap gap-2">
            {current.options.map((o) => (
              <Button key={o.id} size="sm" variant="outline" onClick={() => answer(current, o.id)}>{o.label}</Button>
            ))}
          </div>
        </>
      ) : (
        <div className="text-xs text-emerald-700">
          Adaptive set complete — {correct}/{history.length} correct.
          <Button size="sm" variant="ghost" className="ml-2" onClick={() => setHistory([])}>Restart</Button>
        </div>
      )}
    </div>
  );
}
