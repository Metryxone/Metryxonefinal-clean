import { useCallback } from 'react';

/**
 * Pragati → CAPADEX assessment session bridge.
 *
 * When a user starts the Pragati conversational runtime and exits mid-way
 * (before completing the FSM), we stash the little context we managed to learn
 * — the concern they raised — into sessionStorage. The CAPADEX
 * FreeAssessmentModal IntroPhase reads this on mount so the user lands
 * pre-hydrated instead of starting from a blank form.
 *
 * sessionStorage (not localStorage) is deliberate: the handoff should only
 * survive within the same tab/session, and a short TTL guards against a stale
 * handoff hijacking an unrelated later visit.
 */

const PRAGATI_HANDOFF_KEY = 'capadex_pragati_handoff';
const HANDOFF_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface PragatiHandoff {
  concern_id?: string;
  concern?: string;
  savedAt: number;
}

export function writePragatiHandoff(data: Omit<PragatiHandoff, 'savedAt'>): void {
  try {
    const hasAny = data.concern_id || data.concern;
    if (!hasAny) return;
    sessionStorage.setItem(
      PRAGATI_HANDOFF_KEY,
      JSON.stringify({ ...data, savedAt: Date.now() }),
    );
  } catch {
    /* sessionStorage unavailable (private mode / quota) — handoff is best-effort */
  }
}

export function readPragatiHandoff(): PragatiHandoff | null {
  try {
    const raw = sessionStorage.getItem(PRAGATI_HANDOFF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PragatiHandoff;
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > HANDOFF_TTL_MS) {
      sessionStorage.removeItem(PRAGATI_HANDOFF_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPragatiHandoff(): void {
  try {
    sessionStorage.removeItem(PRAGATI_HANDOFF_KEY);
  } catch {
    /* noop */
  }
}

/**
 * Shared hook exposing the bridge read/write/clear helpers as stable callbacks.
 * Pragati uses `write`; the assessment IntroPhase uses `read` + `clear`.
 */
export function usePragatiHandoff() {
  const write = useCallback((data: Omit<PragatiHandoff, 'savedAt'>) => writePragatiHandoff(data), []);
  const read = useCallback(() => readPragatiHandoff(), []);
  const clear = useCallback(() => clearPragatiHandoff(), []);
  return { write, read, clear };
}
