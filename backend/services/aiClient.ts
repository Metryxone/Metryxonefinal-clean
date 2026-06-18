/**
 * /app/backend/services/aiClient.ts
 *
 * Production-safe AI client wrapper.
 *
 * Resolution order for the OpenAI baseURL/key:
 *   1. AI_INTEGRATIONS_OPENAI_BASE_URL + AI_INTEGRATIONS_OPENAI_API_KEY  (preferred)
 *   2. OPENAI_BASE_URL + OPENAI_API_KEY                                  (fallback)
 *
 * Behaviour:
 *   • In dev: points at the local FastAPI proxy (http://localhost:8002/llm/v1) which
 *     uses the Python `emergentintegrations` library to fan out to OpenAI / Anthropic /
 *     Gemini using the EMERGENT_LLM_KEY.
 *   • In prod (Emergent native deploy / GCP Cloud Run): users must either
 *       (a) set OPENAI_BASE_URL=https://api.openai.com/v1 with a real OpenAI key, OR
 *       (b) co-deploy the FastAPI proxy and keep the localhost URL.
 *     This wrapper auto-pings the configured baseURL on first use; if unreachable, it
 *     throws a structured `AIServiceUnavailableError` so route handlers can return 503
 *     with a clear message instead of timing out.
 */
import OpenAI from 'openai';

let cachedHealth: { ok: boolean; checkedAt: number; reason?: string } | null = null;
const HEALTH_TTL_MS = 60_000;

export class AIServiceUnavailableError extends Error {
  status = 503;
  detail: string;
  constructor(detail: string) {
    super(`AI service unavailable: ${detail}`);
    this.detail = detail;
    this.name = 'AIServiceUnavailableError';
  }
}

export function getAIConfig() {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || '';
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
  const model = process.env.AI_INTEGRATIONS_OPENAI_MODEL || 'gpt-4.1-mini';
  return { baseURL, apiKey, model };
}

/**
 * Pings the LLM baseURL to detect dead Python proxy. Cached for 60s.
 * Tries `${baseURL}/health` first (FastAPI proxy), then falls back to a HEAD on
 * the base. For api.openai.com, considers "200 from /models" as healthy.
 */
export async function checkAIHealth(force = false): Promise<{ ok: boolean; reason?: string }> {
  if (!force && cachedHealth && Date.now() - cachedHealth.checkedAt < HEALTH_TTL_MS) {
    return cachedHealth;
  }
  const { baseURL, apiKey } = getAIConfig();
  if (!baseURL || !apiKey) {
    cachedHealth = { ok: false, checkedAt: Date.now(), reason: 'AI base URL / key not configured' };
    return cachedHealth;
  }
  try {
    const ctrl = new AbortController();
    const tm = setTimeout(() => ctrl.abort(), 3000);
    // Most OpenAI-compatible endpoints expose either /health (FastAPI proxy) or /models
    const tryUrls = [`${baseURL.replace(/\/$/, '')}/health`, `${baseURL.replace(/\/$/, '')}/models`];
    let ok = false;
    for (const u of tryUrls) {
      try {
        const r = await fetch(u, { signal: ctrl.signal, headers: { Authorization: `Bearer ${apiKey}` } });
        // 200 is healthy, 401/403 means endpoint exists but key is wrong (still "reachable")
        if (r.status < 500) { ok = true; break; }
      } catch { /* try next */ }
    }
    clearTimeout(tm);
    cachedHealth = ok
      ? { ok: true, checkedAt: Date.now() }
      : { ok: false, checkedAt: Date.now(), reason: `LLM base URL ${baseURL} unreachable` };
    return cachedHealth;
  } catch (err: any) {
    cachedHealth = { ok: false, checkedAt: Date.now(), reason: err?.message || 'health check failed' };
    return cachedHealth;
  }
}

/**
 * Returns a configured OpenAI client. Throws AIServiceUnavailableError if the
 * underlying proxy/endpoint is unreachable (so callers can return 503).
 */
export async function getOpenAIClient(): Promise<{ client: OpenAI; model: string }> {
  const { baseURL, apiKey, model } = getAIConfig();
  if (!baseURL || !apiKey) throw new AIServiceUnavailableError('AI base URL / key not configured (set AI_INTEGRATIONS_OPENAI_*)');
  const health = await checkAIHealth();
  if (!health.ok) throw new AIServiceUnavailableError(health.reason || 'unreachable');
  const client = new OpenAI({ apiKey, baseURL });
  return { client, model };
}

/**
 * Convenience: chat-completions call with JSON-mode-ish parsing. Throws
 * AIServiceUnavailableError if the AI backend isn't reachable.
 */
export async function chatJSON(opts: { system: string; user: string; model?: string; temperature?: number; max_tokens?: number; }): Promise<any> {
  const { client, model } = await getOpenAIClient();
  const completion = await client.chat.completions.create({
    model: opts.model || model,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user },
    ],
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.max_tokens ?? 700,
  });
  const text = completion.choices?.[0]?.message?.content || '';
  const m = text.match(/\{[\s\S]*\}/);
  return JSON.parse(m ? m[0] : text);
}

// Print one-time deployment readiness banner at startup
export function logAIStartupBanner() {
  const { baseURL, model } = getAIConfig();
  const isLocalhost = baseURL.startsWith('http://localhost') || baseURL.startsWith('http://127.');
  // eslint-disable-next-line no-console
  console.log(
    `[ai] base=${baseURL || '(not set)'} model=${model} ` +
    (isLocalhost
      ? '— DEV MODE (localhost FastAPI proxy). For production deploy: either co-deploy the Python proxy OR set OPENAI_BASE_URL=https://api.openai.com/v1 with a real OpenAI key.'
      : '— PROD MODE (remote endpoint).')
  );
}
