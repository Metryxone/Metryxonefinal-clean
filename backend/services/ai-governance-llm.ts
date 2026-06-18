/**
 * AI Governance LLM Execution Engine
 *
 * Real OpenAI calls via the existing Replit-managed integration client.
 * Tracks cost_usd, tokens, and latency per call; updates aig_models latency fields.
 * Falls back to rule-based methods if the API key is absent or the call fails.
 */
import type { Pool } from 'pg';
import { runHallucinationCheck, runRuleBasedEvaluation } from './ai-governance-schema';

// ── OpenAI client (reuse existing integration) ───────────────────────────────
function getOpenAI() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const OpenAI = require('openai');
  return new OpenAI({
    apiKey:  process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '',
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
}

const hasApiKey = () =>
  !!(process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY);

// ── Types ────────────────────────────────────────────────────────────────────
export interface LlmCallResult {
  content:       string;
  tokens_input:  number;
  tokens_output: number;
  cost_usd:      number;
  duration_ms:   number;
  model_used:    string;
  raw_response?: unknown;
  error?:        string;
}

export interface WorkflowStepTrace {
  step:        number;
  type:        string;
  status:      'completed' | 'failed' | 'skipped';
  duration_ms: number;
  output?:     unknown;
  tokens?:     number;
  cost_usd?:   number;
  error?:      string;
}

// ── Model cost lookup ────────────────────────────────────────────────────────
const MODEL_COST_DEFAULTS: Record<string, { in: number; out: number }> = {
  'gpt-4o':              { in: 0.002500, out: 0.010000 },
  'gpt-4o-mini':         { in: 0.000150, out: 0.000600 },
  'gpt-4o-mini-2024-07': { in: 0.000150, out: 0.000600 },
  'gpt-4-turbo':         { in: 0.010000, out: 0.030000 },
};

async function lookupModelCost(
  pool: Pool,
  modelName: string,
): Promise<{ in: number; out: number }> {
  const { rows } = await pool.query<{ cost_per_1k_input_tokens: string; cost_per_1k_output_tokens: string }>(
    `SELECT cost_per_1k_input_tokens, cost_per_1k_output_tokens
     FROM aig_models WHERE model_name=$1 AND status='available'
     ORDER BY is_default DESC LIMIT 1`,
    [modelName],
  ).catch(() => ({ rows: [] as any[] }));
  if (rows.length) return { in: Number(rows[0].cost_per_1k_input_tokens), out: Number(rows[0].cost_per_1k_output_tokens) };
  return MODEL_COST_DEFAULTS[modelName] ?? { in: 0.000150, out: 0.000600 };
}

// ── Latency tracker (exponential moving average → p50 / p95 fields) ──────────
const latencyWindow: Record<string, number[]> = {};
async function updateModelLatency(pool: Pool, modelName: string, durationMs: number) {
  if (!latencyWindow[modelName]) latencyWindow[modelName] = [];
  const win = latencyWindow[modelName];
  win.push(durationMs);
  if (win.length > 100) win.shift();
  const sorted = [...win].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.50)] ?? durationMs;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? durationMs;
  await pool.query(
    `UPDATE aig_models SET latency_p50_ms=$1,latency_p95_ms=$2,updated_at=NOW()
     WHERE model_name=$3`,
    [Math.round(p50), Math.round(p95), modelName],
  ).catch(() => null);
}

// ── Core LLM call ────────────────────────────────────────────────────────────
export async function callOpenAI(
  pool: Pool,
  opts: {
    model?:        string;
    system:        string;
    user:          string;
    temperature?:  number;
    max_tokens?:   number;
    top_p?:        number;
  },
): Promise<LlmCallResult> {
  const model = opts.model ?? 'gpt-4o-mini';

  if (!hasApiKey()) {
    return {
      content: '{"_no_api_key":true,"note":"Set AI_INTEGRATIONS_OPENAI_API_KEY or OPENAI_API_KEY."}',
      tokens_input: 0, tokens_output: 0, cost_usd: 0,
      duration_ms: 0, model_used: model,
      error: 'No OpenAI API key configured',
    };
  }

  const t0 = Date.now();
  try {
    const openai   = getOpenAI();
    const cost     = await lookupModelCost(pool, model);
    const response = await openai.chat.completions.create({
      model,
      temperature:  opts.temperature  ?? 0.4,
      max_tokens:   opts.max_tokens   ?? 1024,
      top_p:        opts.top_p        ?? 1.0,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user',   content: opts.user   },
      ],
    });

    const duration      = Date.now() - t0;
    const tokensIn      = response.usage?.prompt_tokens     ?? 0;
    const tokensOut     = response.usage?.completion_tokens ?? 0;
    const costUsd       = (tokensIn / 1000) * cost.in + (tokensOut / 1000) * cost.out;
    const content       = response.choices[0]?.message?.content ?? '';

    await updateModelLatency(pool, model, duration);

    return { content, tokens_input: tokensIn, tokens_output: tokensOut,
             cost_usd: costUsd, duration_ms: duration, model_used: model };
  } catch (err: any) {
    return {
      content: '', tokens_input: 0, tokens_output: 0, cost_usd: 0,
      duration_ms: Date.now() - t0, model_used: model,
      error: err.message ?? 'LLM call failed',
    };
  }
}

// ── Template renderer ────────────────────────────────────────────────────────
function renderTemplate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (_, k) =>
    vars[k] !== undefined ? String(vars[k]) : `{${k}}`);
}

// ── Prompt executor (fetch active version + render + call) ───────────────────
export async function executePrompt(
  pool: Pool,
  promptSlug: string,
  variables:  Record<string, unknown>,
  configName?: string,
): Promise<LlmCallResult & { prompt_id?: string; version?: number }> {
  // Fetch active prompt version
  const { rows: [pv] } = await pool.query<{
    id: string; prompt_id: string; version: number;
    template: string; system_context: string; token_estimate: number;
  }>(
    `SELECT pv.id,pv.prompt_id,pv.version,pv.template,pv.system_context,pv.token_estimate
     FROM aig_prompt_versions pv
     JOIN aig_prompts p ON p.id=pv.prompt_id
     WHERE p.slug=$1 AND pv.is_active=true LIMIT 1`,
    [promptSlug],
  ).catch(() => ({ rows: [] as any[] }));

  if (!pv) {
    return {
      content: '', tokens_input: 0, tokens_output: 0, cost_usd: 0,
      duration_ms: 0, model_used: 'none',
      error: `Prompt slug '${promptSlug}' not found or has no active version`,
    };
  }

  // Resolve model + config
  let model       = 'gpt-4o-mini';
  let temperature = 0.4;
  let max_tokens  = 800;
  if (configName) {
    const { rows: [cfg] } = await pool.query<{
      temperature: string; max_tokens: number;
      top_p: string; model_name: string;
    }>(
      `SELECT mc.temperature,mc.max_tokens,mc.top_p,m.model_name
       FROM aig_model_configs mc JOIN aig_models m ON m.id=mc.model_id
       WHERE mc.config_name=$1 AND mc.is_active=true LIMIT 1`,
      [configName],
    ).catch(() => ({ rows: [] as any[] }));
    if (cfg) {
      model       = cfg.model_name ?? model;
      temperature = Number(cfg.temperature) ?? temperature;
      max_tokens  = cfg.max_tokens ?? max_tokens;
    }
  }

  const userMessage = renderTemplate(pv.template, variables);
  const system      = pv.system_context || 'You are a MetryxOne behavioural intelligence assistant.';

  const result = await callOpenAI(pool, { model, system, user: userMessage, temperature, max_tokens });
  return { ...result, prompt_id: pv.prompt_id, version: pv.version };
}

// ── LLM-assisted hallucination check ─────────────────────────────────────────
export async function runLlmHallucinationCheck(
  pool: Pool,
  text:       string,
  sourceData: Record<string, unknown> = {},
  runId?:     string,
): Promise<{ score: number; flags: Array<{ pattern: string; severity: string; reason: string }>; method: string }> {
  // First run the fast rule-based check
  const ruleResult = await runHallucinationCheck(pool, text, runId);

  // If no API key, return rule-based result
  if (!hasApiKey()) return { ...ruleResult, method: 'rule_based' };

  // Run LLM check using the stored hallucination checker prompt
  const llmResult = await executePrompt(pool, 'hallucination_checker_v1', {
    ai_output:   text.slice(0, 2000),
    source_data: JSON.stringify(sourceData).slice(0, 1000),
  });

  if (llmResult.error || !llmResult.content) {
    return { ...ruleResult, method: 'rule_based_fallback' };
  }

  try {
    const parsed = JSON.parse(llmResult.content) as {
      hallucination_score?: number;
      flags?: Array<{ text: string; reason: string; severity: string }>;
      clean?: boolean;
    };

    const llmScore  = Math.min(1, Math.max(0, parsed.hallucination_score ?? 0));
    const llmFlags  = (parsed.flags ?? []).map(f => ({
      pattern:  f.text  ?? '',
      severity: f.severity ?? 'medium',
      reason:   f.reason ?? 'LLM detected',
    }));
    // Blend: rule-based is conservative safety net; take max
    const blendedScore = Math.max(ruleResult.score, llmScore * 0.8);
    const allFlags     = [...ruleResult.flags, ...llmFlags];

    if (runId && (llmScore > 0.15 || ruleResult.score > 0)) {
      const maxSev = allFlags.reduce((m, f) => {
        const w: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
        return (w[f.severity] ?? 0) > (w[m] ?? 0) ? f.severity : m;
      }, 'low');
      await pool.query(
        `INSERT INTO aig_hallucination_flags (run_id,detection_method,flagged_content,severity,confidence,reason,grounding_sources)
         VALUES ($1,'llm_assisted',$2,$3,$4,$5,'[]'::jsonb)
         ON CONFLICT DO NOTHING`,
        [runId, text.slice(0, 500), maxSev, blendedScore,
         allFlags.map(f => f.reason).join('; ')],
      ).catch(() => null);
      await pool.query(
        `UPDATE aig_workflow_runs SET hallucination_score=$1 WHERE id=$2`,
        [blendedScore, runId],
      ).catch(() => null);
    }

    return { score: blendedScore, flags: allFlags, method: 'llm_assisted' };
  } catch {
    return { ...ruleResult, method: 'rule_based_fallback' };
  }
}

// ── LLM-assisted evaluation ───────────────────────────────────────────────────
export async function runLlmEvaluation(
  pool:    Pool,
  output:  string,
  context: Record<string, unknown>,
  runId?:  string,
): Promise<{ overall: number; passed: boolean; scores: Record<string, number>; failure_reasons: string[]; method: string }> {
  // Rule-based baseline (always fast)
  const ruleResult = await runRuleBasedEvaluation(pool, output, context);

  if (!hasApiKey()) return { ...ruleResult, method: 'rule_based' };

  const llmResult = await executePrompt(pool, 'evaluation_rubric_v1', {
    ai_output:        output.slice(0, 2000),
    original_context: JSON.stringify(context).slice(0, 500),
  });

  if (llmResult.error || !llmResult.content) {
    if (runId) {
      await pool.query(
        `INSERT INTO aig_evaluations (run_id,evaluator,rubric,dimension_scores,overall_score,passed,failure_reasons)
         VALUES ($1,'rule_based',$2::jsonb,$3::jsonb,$4,$5,$6) ON CONFLICT DO NOTHING`,
        [runId,
         JSON.stringify({ type: 'rule_based', version: '1.0' }),
         JSON.stringify(ruleResult.scores),
         ruleResult.overall, ruleResult.passed, ruleResult.failure_reasons],
      ).catch(() => null);
    }
    return { ...ruleResult, method: 'rule_based_fallback' };
  }

  try {
    const parsed = JSON.parse(llmResult.content) as {
      scores?:  Record<string, number>;
      overall?: number;
      passed?:  boolean;
      notes?:   string;
    };

    const llmScores  = parsed.scores ?? {};
    // Blend: average LLM scores with rule-based scores where both exist
    const blended: Record<string, number> = { ...ruleResult.scores };
    for (const [k, v] of Object.entries(llmScores)) {
      blended[k] = ruleResult.scores[k] != null
        ? (ruleResult.scores[k] + v) / 2
        : v;
    }
    const overall  = Object.values(blended).reduce((s, v) => s + v, 0) / Math.max(1, Object.keys(blended).length);
    const passed   = overall >= 0.65;
    const failures = Object.entries(blended).filter(([, v]) => v < 0.6).map(([k]) => k.replace(/_/g, ' '));

    if (runId) {
      await pool.query(
        `INSERT INTO aig_evaluations (run_id,evaluator,rubric,dimension_scores,overall_score,passed,failure_reasons,feedback)
         VALUES ($1,'llm_assisted',$2::jsonb,$3::jsonb,$4,$5,$6,$7)
         ON CONFLICT DO NOTHING`,
        [runId,
         JSON.stringify({ type: 'llm_assisted', version: '1.0', model: llmResult.model_used }),
         JSON.stringify(blended),
         overall, passed, failures, parsed.notes ?? null],
      ).catch(() => null);
      await pool.query(
        `UPDATE aig_workflow_runs SET evaluation_score=$1 WHERE id=$2`,
        [overall, runId],
      ).catch(() => null);
    }

    return { overall, passed, scores: blended, failure_reasons: failures, method: 'llm_assisted' };
  } catch {
    return { ...ruleResult, method: 'rule_based_fallback' };
  }
}

// ── Workflow step executor ─────────────────────────────────────────────────────
export async function executeWorkflowStep(
  pool:     Pool,
  step:     any,
  stepIdx:  number,
  context:  Record<string, unknown>,
  runId:    string,
): Promise<WorkflowStepTrace> {
  const t0     = Date.now();
  const base   = { step: stepIdx + 1, type: step.type as string };

  try {
    switch (step.type) {

      case 'prompt': {
        const slug   = step.prompt_slug   as string | undefined;
        const config = step.model_config  as string | undefined;
        if (!slug) throw new Error('prompt step requires prompt_slug');
        const result = await executePrompt(pool, slug, context, config);
        if (result.error && !result.content) throw new Error(result.error);
        let parsed: unknown = result.content;
        try { parsed = JSON.parse(result.content); } catch { /* keep as string */ }
        return { ...base, status: 'completed', duration_ms: Date.now() - t0,
                 output: parsed, tokens: result.tokens_input + result.tokens_output,
                 cost_usd: result.cost_usd };
      }

      case 'validate': {
        const prev     = context._last_output as string | undefined;
        const text     = typeof prev === 'string' ? prev : JSON.stringify(prev ?? '');
        const method   = step.evaluator as string | undefined;
        const result   = method === 'rule_based' || !hasApiKey()
          ? { ...(await runRuleBasedEvaluation(pool, text, context, runId)), method: 'rule_based' }
          : await runLlmEvaluation(pool, text, context, runId);
        const threshold = Number(step.pass_threshold ?? 0.65);
        if (!result.passed || result.overall < threshold)
          console.warn(`[ai-governance] validate step: score=${result.overall.toFixed(2)} below threshold=${threshold}`);
        return { ...base, status: 'completed', duration_ms: Date.now() - t0,
                 output: { overall: result.overall, passed: result.passed, method: result.method } };
      }

      case 'filter': {
        const prev   = context._last_output as string | undefined;
        const text   = typeof prev === 'string' ? prev : JSON.stringify(prev ?? '');
        const result = await runLlmHallucinationCheck(pool, text, context as any, runId);
        return { ...base, status: 'completed', duration_ms: Date.now() - t0,
                 output: { score: result.score, flagged: result.score > 0.2, flags: result.flags.length, method: result.method } };
      }

      case 'transform': {
        const prev = context._last_output;
        let out    = prev;
        if (step.operation === 'extract_insights') {
          try {
            const p = typeof prev === 'string' ? JSON.parse(prev) : prev;
            out = Array.isArray(p?.insights) ? p.insights : p;
          } catch { out = prev; }
        }
        return { ...base, status: 'completed', duration_ms: Date.now() - t0, output: out };
      }

      case 'rank': {
        const prev = context._last_output;
        let arr    = Array.isArray(prev) ? prev : [prev];
        if (step.strategy === 'priority_score' || step.strategy === 'confidence') {
          arr = [...arr].sort((a: any, b: any) =>
            (Number(b?.confidence ?? b?.priority_score ?? 0)) -
            (Number(a?.confidence ?? a?.priority_score ?? 0)));
        }
        return { ...base, status: 'completed', duration_ms: Date.now() - t0, output: arr };
      }

      case 'fetch': {
        let data: unknown = [];
        if (step.source === 'recent_runs') {
          const lim = Math.min(Number(step.limit ?? 10), 50);
          const { rows } = await pool.query(
            `SELECT id,status,duration_ms,hallucination_score,evaluation_score,created_at,model_used
             FROM aig_workflow_runs ORDER BY created_at DESC LIMIT $1`, [lim]);
          data = rows;
        }
        return { ...base, status: 'completed', duration_ms: Date.now() - t0, output: data };
      }

      case 'eval': {
        const items = Array.isArray(context._last_output) ? context._last_output as any[] : [];
        const halScores = items.map((r: any) => Number(r.hallucination_score ?? 0)).filter(isFinite);
        const avgHal    = halScores.length ? halScores.reduce((s, v) => s + v, 0) / halScores.length : 0;
        return { ...base, status: 'completed', duration_ms: Date.now() - t0,
                 output: { avg_hallucination: avgHal, items_evaluated: items.length } };
      }

      case 'flag': {
        const evalOut  = (context._last_output as any) ?? {};
        const thresh   = Number(step.threshold ?? 0.2);
        const flagged  = Number(evalOut.avg_hallucination ?? 0) > thresh;
        if (flagged) {
          await pool.query(
            `INSERT INTO aig_hallucination_flags (run_id,detection_method,flagged_content,severity,confidence,reason,grounding_sources)
             VALUES ($1,'workflow_audit',$2,'medium',$3,$4,'[]'::jsonb)`,
            [runId,
             `Audit found avg hallucination ${(evalOut.avg_hallucination ?? 0).toFixed(2)} > threshold ${thresh}`,
             evalOut.avg_hallucination ?? 0,
             `Workflow audit: ${evalOut.items_evaluated ?? 0} runs evaluated`],
          ).catch(() => null);
        }
        return { ...base, status: 'completed', duration_ms: Date.now() - t0,
                 output: { flagged, threshold: thresh, value: evalOut.avg_hallucination } };
      }

      case 'report': {
        const prev = context._last_output;
        return { ...base, status: 'completed', duration_ms: Date.now() - t0,
                 output: { destination: step.destination ?? 'admin_dashboard', report: prev } };
      }

      default:
        return { ...base, status: 'skipped', duration_ms: Date.now() - t0,
                 output: `Unknown step type: ${step.type}` };
    }
  } catch (err: any) {
    return { ...base, status: 'failed', duration_ms: Date.now() - t0,
             error: err.message ?? 'Step failed' };
  }
}

// ── Full workflow executor ─────────────────────────────────────────────────────
export async function executeWorkflow(
  pool:        Pool,
  workflowId:  string,
  triggeredBy: string,
  triggerType: string,
  input:       Record<string, unknown>,
): Promise<{ run_id: string; status: string; steps_trace: WorkflowStepTrace[]; duration_ms: number; hallucination_score: number | null; evaluation_score: number | null }> {
  const { rows: [wf] } = await pool.query(
    `SELECT * FROM aig_ai_workflows WHERE id=$1`, [workflowId]);
  if (!wf) throw new Error(`Workflow ${workflowId} not found`);
  if (wf.status !== 'active') throw new Error(`Workflow is ${wf.status}, not active`);

  const started = Date.now();

  // Create run record
  const { rows: [run] } = await pool.query(
    `INSERT INTO aig_workflow_runs (workflow_id,triggered_by,trigger_type,input,status)
     VALUES ($1,$2,$3,$4::jsonb,'running') RETURNING id`,
    [workflowId, triggeredBy, triggerType, JSON.stringify(input)]);
  const runId = run.id as string;

  const steps:   WorkflowStepTrace[] = [];
  let   context: Record<string, unknown> = { ...input };
  let   totalTokens  = 0;
  let   totalCost    = 0;
  let   modelUsed    = '';
  let   finalStatus  = 'completed';

  for (let i = 0; i < (wf.steps ?? []).length; i++) {
    const step   = wf.steps[i];
    const trace  = await executeWorkflowStep(pool, step, i, context, runId);
    steps.push(trace);
    totalTokens += trace.tokens ?? 0;
    totalCost   += trace.cost_usd ?? 0;
    if (trace.status === 'failed') {
      finalStatus = 'failed';
      break;
    }
    // Thread output into context for next step
    context._last_output = trace.output;
    if (step.type === 'prompt' && !modelUsed) modelUsed = step.model_config ?? 'gpt-4o-mini';
  }

  const duration  = Date.now() - started;
  const lastOut   = context._last_output;
  const outStr    = typeof lastOut === 'string' ? lastOut : JSON.stringify(lastOut ?? {});

  // Read back scores written by sub-calls
  const { rows: [scoreRow] } = await pool.query<{ hallucination_score: string; evaluation_score: string }>(
    `SELECT hallucination_score, evaluation_score FROM aig_workflow_runs WHERE id=$1`, [runId]);

  await pool.query(
    `UPDATE aig_workflow_runs SET
       status=$1, output=$2::jsonb, steps_trace=$3::jsonb, duration_ms=$4,
       completed_at=NOW(), tokens_input=$5, tokens_output=0, cost_usd=$6, model_used=$7
     WHERE id=$8`,
    [finalStatus,
     JSON.stringify({ result: outStr.slice(0, 4000) }),
     JSON.stringify(steps),
     duration, totalTokens, totalCost, modelUsed || 'gpt-4o-mini', runId]);

  await pool.query(
    `UPDATE aig_ai_workflows SET run_count=run_count+1, last_run_at=NOW(),
       avg_duration_ms = COALESCE(avg_duration_ms, 0) * 0.8 + $1 * 0.2
     WHERE id=$2`,
    [duration, workflowId]);

  return {
    run_id: runId,
    status: finalStatus,
    steps_trace: steps,
    duration_ms: duration,
    hallucination_score: scoreRow?.hallucination_score != null ? Number(scoreRow.hallucination_score) : null,
    evaluation_score:    scoreRow?.evaluation_score    != null ? Number(scoreRow.evaluation_score)    : null,
  };
}

// ── Prompt test case runner ───────────────────────────────────────────────────
export async function runTestCase(
  pool:       Pool,
  testCaseId: string,
): Promise<{ score: number; passed: boolean; actual_output: string; execution: LlmCallResult }> {
  const { rows: [tc] } = await pool.query(
    `SELECT * FROM aig_prompt_test_cases WHERE id=$1`, [testCaseId]);
  if (!tc) throw new Error('Test case not found');

  const { rows: [pv] } = await pool.query(
    `SELECT * FROM aig_prompt_versions WHERE prompt_id=$1 AND is_active=true LIMIT 1`,
    [tc.prompt_id]);
  if (!pv) throw new Error('No active prompt version for this test case');

  const vars: Record<string, unknown> = tc.input_variables ?? {};
  const result = await executePrompt(pool, '', vars);   // slug path skipped — render direct
  // Render directly from the fetched version (executePrompt by slug would also work)
  const userMessage = renderTemplate(pv.template, vars);
  const system      = pv.system_context || 'You are a MetryxOne behavioural intelligence assistant.';
  const llmResult   = await callOpenAI(pool, { system, user: userMessage });

  // Score: if expected_output exists, compute character-level overlap; otherwise use rule-based eval
  let score = 0;
  if (tc.expected_output) {
    const a = llmResult.content.toLowerCase();
    const b = String(tc.expected_output).toLowerCase();
    const shared = a.split(' ').filter(w => b.includes(w)).length;
    score = Math.min(1, shared / Math.max(1, b.split(' ').length));
  } else {
    const ev = await runRuleBasedEvaluation(pool, llmResult.content, vars);
    score = ev.overall;
  }

  const passed = score >= 0.65;

  await pool.query(
    `UPDATE aig_prompt_test_cases
     SET last_run_at=NOW(), last_result=$1, last_score=$2
     WHERE id=$3`,
    [llmResult.content.slice(0, 1000), score, testCaseId]);

  // Update version pass rate (rolling avg over test cases)
  await pool.query(
    `UPDATE aig_prompt_versions pv
     SET test_pass_rate = (
       SELECT AVG(last_score) FROM aig_prompt_test_cases
       WHERE prompt_id = pv.prompt_id AND last_score IS NOT NULL
     )
     WHERE id=$1`,
    [pv.id]).catch(() => null);

  return { score, passed, actual_output: llmResult.content, execution: llmResult };
}
