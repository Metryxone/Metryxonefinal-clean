/**
 * Adaptive Assessment V2 — client service.
 */

async function safeJson<T>(p: Promise<Response>): Promise<T | null> {
  try {
    const r = await p;
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export type AdaptiveFlag = { feature_flag?: { adaptiveAssessmentRuntimeV2?: boolean } };

export const adaptiveAssessmentV2 = {
  async isEnabled(): Promise<boolean> {
    const r = await safeJson<AdaptiveFlag>(fetch('/api/v2/assessment/feature-flag'));
    return r?.feature_flag?.adaptiveAssessmentRuntimeV2 === true;
  },

  async start(runtimeContext: Record<string, unknown>) {
    return safeJson<{ result: Record<string, unknown> }>(
      fetch('/api/v2/assessment/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ runtimeContext }),
      }),
    );
  },

  async nextQuestion(sessionId: string) {
    return safeJson<{ current_competency: string; state: Record<string, unknown>; all_states: Array<Record<string, unknown>> }>(
      fetch('/api/v2/assessment/next-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId }),
      }),
    );
  },

  async submitResponse(payload: {
    sessionId: string;
    competencyCode: string;
    score: number;
    confidence?: number;
    responseTimeMs?: number;
    flaggedContradiction?: boolean;
    questionId?: string;
    questionType?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
  }) {
    return safeJson<{ decision: Record<string, unknown>; states: Array<Record<string, unknown>> }>(
      fetch('/api/v2/assessment/submit-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      }),
    );
  },

  async complete(sessionId: string) {
    return safeJson<{ result: { final_score: number; behavioural_signals: Array<Record<string, unknown>> } }>(
      fetch('/api/v2/assessment/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId }),
      }),
    );
  },

  async explainability(sessionId: string) {
    return safeJson<{ logs: Array<{ log_type: string; rationale: string; payload: Record<string, unknown>; created_at: string }> }>(
      fetch(`/api/v2/assessment/explainability/${encodeURIComponent(sessionId)}`, {
        credentials: 'include',
      }),
    );
  },
};
