/**
 * test-runtimes.ts — smoke matrix for POST /api/capadex/concern/analyze.
 *
 * Run:  npx tsx backend/scripts/test-runtimes.ts
 *
 * Covers:
 *   1. Token-match path  — typed phrase resolves to a master concern_id and
 *      Tier 1 returns master-curated clarity questions.
 *   2. Fallback cascade  — gibberish text never 500s; clarity_source drops
 *      to adaptive_bank or static_fallback and a usable questions array is
 *      still returned.
 *   3. Context envelope  — runtime_envelope echoes primary_persona /
 *      is_proxy / target_age_band; runtime_context carries the derived
 *      actor/target/relationship triple. Neither should be null/missing.
 */

const BASE = process.env.API_BASE ?? 'http://localhost:8080';
const ENDPOINT = `${BASE}/api/capadex/concern/analyze`;

type AnalyzeResponse = {
  clarity_source?: 'master_curated' | 'adaptive_bank' | 'static_fallback';
  resolved_concern_id?: string | null;
  clarification_questions?: Array<{ id: string; question: string; options: string[] }>;
  runtime_context?: {
    actor_persona?: string;
    target_persona?: string;
    relationship_type?: string;
    target_age?: number | null;
    persisted?: boolean;
  } | null;
  runtime_envelope?: {
    primary_persona?: string | null;
    is_proxy?: boolean | null;
    target_age_band?: string | null;
    assessee_name?: string | null;
    contextual_anchor?: string | null;
    validation_missing?: string[];
  } | null;
  error?: string;
};

let passed = 0;
let failed = 0;

function log(name: string, ok: boolean, detail: string) {
  if (ok) {
    passed++;
    console.log(`PASSED ✅  ${name} — ${detail}`);
  } else {
    failed++;
    console.log(`FAILED ❌  ${name} — ${detail}`);
  }
}

async function callAnalyze(body: Record<string, unknown>): Promise<{ status: number; data: AnalyzeResponse }> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: AnalyzeResponse;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: `non-JSON response: ${text.slice(0, 120)}` };
  }
  return { status: res.status, data };
}

// ─── Test 1: Token Matching ───────────────────────────────────────────────────
async function testTokenMatching() {
  const label = 'Test 1 — Token Matching ("Severe work stress and burnout")';
  const { status, data } = await callAnalyze({
    raw_concern_text: 'Severe work stress and burnout',
    primary_persona: 'mid_career_professional',
    is_proxy: false,
    target_age_band: '24-45',
    assessee_name: 'Smoke Test',
    contextual_anchor: 'Acme Corp',
  });

  if (status !== 200) {
    log(label, false, `expected status 200, got ${status}`);
    return;
  }
  if (!data.resolved_concern_id) {
    log(label, false, `resolved_concern_id is missing/null (got ${data.resolved_concern_id})`);
    return;
  }
  if (data.clarity_source !== 'master_curated') {
    log(label, false, `clarity_source expected 'master_curated', got '${data.clarity_source}'`);
    return;
  }
  log(
    label,
    true,
    `status=200, resolved_concern_id=${data.resolved_concern_id}, clarity_source=master_curated, n_questions=${data.clarification_questions?.length ?? 0}`,
  );
}

// ─── Test 2: Fallback Cascade ─────────────────────────────────────────────────
async function testFallbackCascade() {
  const label = 'Test 2 — Fallback Cascade ("xyz_unmapped_string")';
  const { status, data } = await callAnalyze({
    raw_concern_text: 'xyz_unmapped_string',
    primary_persona: 'mid_career_professional',
    is_proxy: false,
    target_age_band: '24-45',
    assessee_name: 'Smoke Test',
    contextual_anchor: 'Acme Corp',
  });

  if (status !== 200) {
    log(label, false, `expected status 200 (never 500 on unmapped text), got ${status}`);
    return;
  }
  const allowedFallbacks = new Set(['adaptive_bank', 'static_fallback']);
  if (!data.clarity_source || !allowedFallbacks.has(data.clarity_source)) {
    log(
      label,
      false,
      `clarity_source expected one of ${[...allowedFallbacks].join('|')}, got '${data.clarity_source}'`,
    );
    return;
  }
  const qs = data.clarification_questions ?? [];
  if (!Array.isArray(qs) || qs.length === 0) {
    log(label, false, `clarification_questions array empty or invalid (length=${qs.length})`);
    return;
  }
  log(
    label,
    true,
    `status=200, clarity_source=${data.clarity_source}, n_questions=${qs.length}`,
  );
}

// ─── Test 3: Context Envelope ─────────────────────────────────────────────────
async function testContextEnvelope() {
  const label = 'Test 3 — Context Envelope (runtime_envelope + runtime_context populated)';
  const { status, data } = await callAnalyze({
    raw_concern_text: 'work stress',
    primary_persona: 'mid_career_professional',
    is_proxy: false,
    target_age_band: '24-45',
    assessee_name: 'Smoke Test',
    contextual_anchor: 'Acme Corp',
  });

  if (status !== 200) {
    log(label, false, `expected status 200, got ${status}`);
    return;
  }
  // runtime_envelope carries the canonical client-facing fields the user
  // asked for (primary_persona / is_proxy / target_age_band). runtime_context
  // carries the derived actor/target triple persisted to the runtime table.
  // Both must be present and non-null for the orchestration layer to work.
  const env = data.runtime_envelope;
  const ctx = data.runtime_context;
  if (!env) {
    log(label, false, 'runtime_envelope is null/missing');
    return;
  }
  if (!ctx) {
    log(label, false, 'runtime_context is null/missing');
    return;
  }
  const missing: string[] = [];
  if (!env.primary_persona) missing.push('runtime_envelope.primary_persona');
  if (env.is_proxy === null || env.is_proxy === undefined) missing.push('runtime_envelope.is_proxy');
  if (!env.target_age_band) missing.push('runtime_envelope.target_age_band');
  if (!ctx.actor_persona) missing.push('runtime_context.actor_persona');
  if (!ctx.target_persona) missing.push('runtime_context.target_persona');
  if (!ctx.relationship_type) missing.push('runtime_context.relationship_type');
  if (missing.length > 0) {
    log(label, false, `null/missing fields: ${missing.join(', ')}`);
    return;
  }
  log(
    label,
    true,
    `primary_persona=${env.primary_persona}, is_proxy=${env.is_proxy}, target_age_band=${env.target_age_band}, actor=${ctx.actor_persona}, target=${ctx.target_persona}, rel=${ctx.relationship_type}`,
  );
}

// ─── Runner ───────────────────────────────────────────────────────────────────
(async () => {
  console.log(`\n▶  CAPADEX /analyze smoke matrix — ${ENDPOINT}\n`);
  try {
    await testTokenMatching();
    await testFallbackCascade();
    await testContextEnvelope();
  } catch (err) {
    failed++;
    console.log(`FAILED ❌  runner crashed — ${err instanceof Error ? err.message : String(err)}`);
  }
  console.log(`\n▶  Summary: ${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
})();
