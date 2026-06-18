/**
 * AI Governance Platform — API Routes
 * Flag: FF_AI_GOVERNANCE
 * All mutation routes: requireAuth + requireSuperAdmin + audit log.
 * Rate limit: 60 req/min per IP on write endpoints.
 */
import type { Application } from 'express';
import type { Pool } from 'pg';
import {
  ensureAiGovernanceSchema, seedAiGovernanceDefaults,
  logAiGovernanceAudit, checkAiRateLimit,
  runHallucinationCheck, runRuleBasedEvaluation,
  computeAiMonitoringMetrics, computeAiGovernanceSummary,
} from '../services/ai-governance-schema';
import {
  executeWorkflow, runTestCase,
  runLlmHallucinationCheck, runLlmEvaluation,
} from '../services/ai-governance-llm';
import { startAiGovernanceScheduler } from '../services/ai-governance-scheduler';

let schemaReady: Promise<void> | null = null;

function getSchema(pool: Pool) {
  if (!schemaReady) {
    schemaReady = ensureAiGovernanceSchema(pool)
      .then(() => seedAiGovernanceDefaults(pool))
      .then(() => { console.log('[ai-governance] schema ready'); })
      .catch((e) => { console.error('[ai-governance] schema error:', e.message); schemaReady = null; });
  }
  return schemaReady!;
}

function flagOff(res: any) {
  res.status(503).json({ error: 'AI Governance Platform disabled. Set FF_AI_GOVERNANCE=1.' });
}

function isEnabled() { return process.env.FF_AI_GOVERNANCE === '1'; }

export function registerAiGovernanceRoutes(
  app: Application,
  pool: Pool,
  requireAuth: any,
  requireSuperAdmin: any,
): void {
  // ── Middleware ──────────────────────────────────────────────────────────────
  const guard = [requireAuth, requireSuperAdmin];

  const rl = async (req: any, res: any, next: any) => {
    const ip = req.ip ?? 'unknown';
    const { allowed } = await checkAiRateLimit(pool, `aig:${ip}`, 60).catch(() => ({ allowed: true }));
    if (!allowed) return res.status(429).json({ error: 'Rate limit exceeded (60/min)' });
    next();
  };

  const actor = (req: any) => req.user?.email ?? req.session?.superadmin_email ?? 'superadmin';

  // ── Schema init ─────────────────────────────────────────────────────────────
  app.use('/api/governance/ai', async (_req, _res, next) => {
    await getSchema(pool).catch(() => null);
    next();
  });

  // ════════════════════════════════════════════════════════════════════════════
  // STATUS & DASHBOARD
  // ════════════════════════════════════════════════════════════════════════════

  app.get('/api/governance/ai/status', guard, async (_req, res) => {
    if (!isEnabled()) return flagOff(res);
    const summary = await computeAiGovernanceSummary(pool);
    res.json({ ok: true, flag: true, summary, generated_at: new Date().toISOString() });
  });

  app.get('/api/governance/ai/dashboard', guard, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    const cached = (req as any)._aigDash;
    if (cached) return res.json(cached);
    try {
      const [summary, recentRuns, recentFlags, recentAudit, metricRows] = await Promise.all([
        computeAiGovernanceSummary(pool),
        pool.query(
          `SELECT wr.id,wr.status,wr.duration_ms,wr.hallucination_score,wr.evaluation_score,
                  wr.cost_usd,wr.created_at,wf.name AS workflow_name
           FROM aig_workflow_runs wr
           JOIN aig_ai_workflows wf ON wf.id=wr.workflow_id
           ORDER BY wr.created_at DESC LIMIT 10`),
        pool.query(
          `SELECT id,severity,reason,review_status,created_at
           FROM aig_hallucination_flags ORDER BY created_at DESC LIMIT 10`),
        pool.query(
          `SELECT action,entity_type,entity_id,outcome,ts
           FROM gov_audit_framework WHERE domain='ai_governance'
           ORDER BY ts DESC LIMIT 20`),
        pool.query(
          `SELECT metric_name,metric_value,recorded_at FROM aig_monitoring_metrics
           WHERE recorded_at > NOW()-INTERVAL '24 hours'
           ORDER BY metric_name,recorded_at DESC`),
      ]);
      const data = {
        summary, recent_runs: recentRuns.rows,
        recent_flags: recentFlags.rows,
        recent_audit: recentAudit.rows,
        metrics: metricRows.rows,
        generated_at: new Date().toISOString(),
      };
      (req as any)._aigDash = data;
      res.json(data);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // PROMPT REPOSITORY
  // ════════════════════════════════════════════════════════════════════════════

  app.get('/api/governance/ai/prompts', guard, async (_req, res) => {
    if (!isEnabled()) return flagOff(res);
    const { rows } = await pool.query(
      `SELECT p.*,
         (SELECT COUNT(*) FROM aig_prompt_versions pv WHERE pv.prompt_id=p.id)::int AS version_count,
         (SELECT MAX(version) FROM aig_prompt_versions pv WHERE pv.prompt_id=p.id) AS latest_version,
         (SELECT test_pass_rate FROM aig_prompt_versions pv WHERE pv.prompt_id=p.id AND pv.is_active LIMIT 1) AS active_pass_rate
       FROM aig_prompts p ORDER BY p.updated_at DESC`);
    res.json({ prompts: rows });
  });

  app.post('/api/governance/ai/prompts', guard, rl, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    const { name, slug, description, category, tags, owner } = req.body;
    if (!name?.trim() || !slug?.trim()) return res.status(400).json({ error: 'name and slug required' });
    const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    try {
      const { rows } = await pool.query(
        `INSERT INTO aig_prompts (name,slug,description,category,tags,owner)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [name.trim(), cleanSlug, description ?? null, category ?? 'general',
         tags ?? [], owner ?? actor(req)]);
      await logAiGovernanceAudit(pool, actor(req), 'prompt.created', 'prompt', rows[0].id,
        { name, slug: cleanSlug }, 'success', req.ip);
      res.status(201).json({ prompt: rows[0] });
    } catch (e: any) {
      if (e.code === '23505') return res.status(409).json({ error: 'Slug already exists' });
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/governance/ai/prompts/:id', guard, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    const { rows } = await pool.query(`SELECT * FROM aig_prompts WHERE id=$1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Prompt not found' });
    const { rows: versions } = await pool.query(
      `SELECT * FROM aig_prompt_versions WHERE prompt_id=$1 ORDER BY version DESC`, [req.params.id]);
    res.json({ prompt: rows[0], versions });
  });

  app.put('/api/governance/ai/prompts/:id', guard, rl, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    const { name, description, category, tags, status, owner } = req.body;
    const { rows } = await pool.query(
      `UPDATE aig_prompts SET name=COALESCE($1,name), description=COALESCE($2,description),
       category=COALESCE($3,category), tags=COALESCE($4,tags), status=COALESCE($5,status),
       owner=COALESCE($6,owner), updated_at=NOW() WHERE id=$7 RETURNING *`,
      [name, description, category, tags, status, owner, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Prompt not found' });
    await logAiGovernanceAudit(pool, actor(req), 'prompt.updated', 'prompt', req.params.id,
      req.body, 'success', req.ip);
    res.json({ prompt: rows[0] });
  });

  app.delete('/api/governance/ai/prompts/:id', guard, rl, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    await pool.query(`UPDATE aig_prompts SET status='archived',updated_at=NOW() WHERE id=$1`, [req.params.id]);
    await logAiGovernanceAudit(pool, actor(req), 'prompt.archived', 'prompt', req.params.id, {}, 'success', req.ip);
    res.json({ ok: true });
  });

  // ── Prompt Versions ──────────────────────────────────────────────────────────

  app.get('/api/governance/ai/prompts/:id/versions', guard, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    const { rows } = await pool.query(
      `SELECT * FROM aig_prompt_versions WHERE prompt_id=$1 ORDER BY version DESC`, [req.params.id]);
    res.json({ versions: rows });
  });

  app.post('/api/governance/ai/prompts/:id/versions', guard, rl, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    const { template, system_context, variables, changelog, author } = req.body;
    if (!template?.trim()) return res.status(400).json({ error: 'template required' });
    const { rows: [p] } = await pool.query(`SELECT current_version FROM aig_prompts WHERE id=$1`, [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Prompt not found' });
    const nextVer = (p.current_version ?? 0) + 1;
    const hash = crypto.createHash('sha256').update(template.trim()).digest('hex').slice(0, 16);
    const tokenEst = Math.ceil(template.split(/\s+/).length * 1.3);
    const { rows } = await pool.query(
      `INSERT INTO aig_prompt_versions
         (prompt_id,version,template,system_context,variables,changelog,author,content_hash,parent_version,token_estimate)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.params.id, nextVer, template.trim(), system_context ?? null,
       variables ?? [], changelog ?? null, author ?? actor(req),
       hash, p.current_version, tokenEst]);
    await pool.query(`UPDATE aig_prompts SET current_version=$1,updated_at=NOW() WHERE id=$2`,
      [nextVer, req.params.id]);
    await logAiGovernanceAudit(pool, actor(req), 'prompt.version_created', 'prompt_version',
      rows[0].id, { version: nextVer }, 'success', req.ip);
    res.status(201).json({ version: rows[0] });
  });

  app.post('/api/governance/ai/prompt-versions/:vid/activate', guard, rl, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    const { rows: [ver] } = await pool.query(
      `SELECT * FROM aig_prompt_versions WHERE id=$1`, [req.params.vid]);
    if (!ver) return res.status(404).json({ error: 'Version not found' });
    await pool.query(`UPDATE aig_prompt_versions SET is_active=false WHERE prompt_id=$1`, [ver.prompt_id]);
    await pool.query(`UPDATE aig_prompt_versions SET is_active=true WHERE id=$1`, [req.params.vid]);
    await pool.query(`UPDATE aig_prompts SET current_version=$1,updated_at=NOW() WHERE id=$2`,
      [ver.version, ver.prompt_id]);
    await logAiGovernanceAudit(pool, actor(req), 'prompt.version_activated', 'prompt_version',
      req.params.vid, { version: ver.version }, 'success', req.ip);
    res.json({ ok: true, activated_version: ver.version });
  });

  // ── Prompt test cases ───────────────────────────────────────────────────────

  app.get('/api/governance/ai/prompts/:id/test-cases', guard, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    const { rows } = await pool.query(
      `SELECT * FROM aig_prompt_test_cases WHERE prompt_id=$1 ORDER BY created_at DESC`, [req.params.id]);
    res.json({ test_cases: rows });
  });

  app.post('/api/governance/ai/prompts/:id/test-cases', guard, rl, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    const { name, input_variables, expected_output, evaluation_criteria } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name required' });
    const { rows } = await pool.query(
      `INSERT INTO aig_prompt_test_cases (prompt_id,name,input_variables,expected_output,evaluation_criteria)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.id, name.trim(), input_variables ?? {}, expected_output ?? null, evaluation_criteria ?? {}]);
    res.status(201).json({ test_case: rows[0] });
  });

  // Execute a test case against the active prompt version (real LLM call)
  app.post('/api/governance/ai/prompts/:id/test-cases/:tcid/run', guard, rl, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    try {
      const result = await runTestCase(pool, req.params.tcid);
      await logAiGovernanceAudit(pool, actor(req), 'prompt.test_case_run', 'prompt_test_case',
        req.params.tcid, { score: result.score, passed: result.passed }, 'success', req.ip);
      res.json(result);
    } catch (e: any) {
      if (e.message?.includes('not found')) return res.status(404).json({ error: e.message });
      res.status(500).json({ error: e.message });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // MODEL REGISTRY
  // ════════════════════════════════════════════════════════════════════════════

  app.get('/api/governance/ai/models', guard, async (_req, res) => {
    if (!isEnabled()) return flagOff(res);
    const { rows } = await pool.query(
      `SELECT m.*,
         (SELECT COUNT(*) FROM aig_model_configs mc WHERE mc.model_id=m.id)::int AS config_count,
         (SELECT COUNT(*) FROM aig_workflow_runs wr WHERE wr.model_used=m.model_name)::int AS run_count
       FROM aig_models m ORDER BY m.is_default DESC, m.status, m.provider, m.model_name`);
    res.json({ models: rows });
  });

  app.post('/api/governance/ai/models', guard, rl, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    const { provider, model_name, model_version, capabilities, context_window,
            cost_per_1k_input_tokens, cost_per_1k_output_tokens, status, metadata } = req.body;
    if (!provider?.trim() || !model_name?.trim()) return res.status(400).json({ error: 'provider and model_name required' });
    try {
      const { rows } = await pool.query(
        `INSERT INTO aig_models (provider,model_name,model_version,capabilities,context_window,
           cost_per_1k_input_tokens,cost_per_1k_output_tokens,status,metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [provider.trim(), model_name.trim(), model_version ?? 'latest', capabilities ?? [],
         context_window ?? 8192, cost_per_1k_input_tokens ?? 0,
         cost_per_1k_output_tokens ?? 0, status ?? 'available', metadata ?? {}]);
      await logAiGovernanceAudit(pool, actor(req), 'model.registered', 'model', rows[0].id,
        { provider, model_name }, 'success', req.ip);
      res.status(201).json({ model: rows[0] });
    } catch (e: any) {
      if (e.code === '23505') return res.status(409).json({ error: 'Model already registered' });
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/governance/ai/models/:id', guard, rl, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    const { status, is_default, latency_p50_ms, latency_p95_ms, metadata } = req.body;
    if (is_default) {
      await pool.query(`UPDATE aig_models SET is_default=false`);
    }
    const { rows } = await pool.query(
      `UPDATE aig_models SET status=COALESCE($1,status), is_default=COALESCE($2,is_default),
       latency_p50_ms=COALESCE($3,latency_p50_ms), latency_p95_ms=COALESCE($4,latency_p95_ms),
       metadata=COALESCE($5::jsonb,metadata), updated_at=NOW() WHERE id=$6 RETURNING *`,
      [status, is_default, latency_p50_ms, latency_p95_ms,
       metadata ? JSON.stringify(metadata) : null, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Model not found' });
    await logAiGovernanceAudit(pool, actor(req), 'model.updated', 'model', req.params.id,
      req.body, 'success', req.ip);
    res.json({ model: rows[0] });
  });

  // Model configs
  app.get('/api/governance/ai/models/:id/configs', guard, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    const { rows } = await pool.query(
      `SELECT * FROM aig_model_configs WHERE model_id=$1 ORDER BY created_at DESC`, [req.params.id]);
    res.json({ configs: rows });
  });

  app.post('/api/governance/ai/models/:id/configs', guard, rl, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    const { config_name, temperature, max_tokens, top_p, frequency_penalty,
            presence_penalty, stop_sequences, use_case } = req.body;
    if (!config_name?.trim()) return res.status(400).json({ error: 'config_name required' });
    try {
      const { rows } = await pool.query(
        `INSERT INTO aig_model_configs
           (model_id,config_name,temperature,max_tokens,top_p,frequency_penalty,presence_penalty,stop_sequences,use_case)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [req.params.id, config_name.trim(), temperature ?? 0.7, max_tokens ?? 1024,
         top_p ?? 1.0, frequency_penalty ?? 0.0, presence_penalty ?? 0.0,
         stop_sequences ?? [], use_case ?? 'general']);
      res.status(201).json({ config: rows[0] });
    } catch (e: any) {
      if (e.code === '23505') return res.status(409).json({ error: 'Config name already exists for this model' });
      res.status(500).json({ error: e.message });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // AI WORKFLOW ENGINE
  // ════════════════════════════════════════════════════════════════════════════

  app.get('/api/governance/ai/ai-workflows', guard, async (_req, res) => {
    if (!isEnabled()) return flagOff(res);
    const { rows } = await pool.query(
      `SELECT w.*,
         (SELECT COUNT(*) FROM aig_workflow_runs wr WHERE wr.workflow_id=w.id)::int AS total_runs,
         (SELECT COUNT(*) FROM aig_workflow_runs wr WHERE wr.workflow_id=w.id AND wr.status='failed')::int AS failed_runs,
         (SELECT AVG(duration_ms) FROM aig_workflow_runs wr WHERE wr.workflow_id=w.id AND wr.status='completed') AS avg_ms
       FROM aig_ai_workflows w ORDER BY w.status,w.updated_at DESC`);
    res.json({ workflows: rows });
  });

  app.post('/api/governance/ai/ai-workflows', guard, rl, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    const { name, description, steps, trigger_type, trigger_config, input_schema,
            output_schema, tags } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name required' });
    if (!Array.isArray(steps) || !steps.length) return res.status(400).json({ error: 'steps array required' });
    try {
      const { rows } = await pool.query(
        `INSERT INTO aig_ai_workflows
           (name,description,steps,trigger_type,trigger_config,input_schema,output_schema,tags,created_by)
         VALUES ($1,$2,$3::jsonb,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9) RETURNING *`,
        [name.trim(), description ?? null, JSON.stringify(steps),
         trigger_type ?? 'manual', JSON.stringify(trigger_config ?? {}),
         JSON.stringify(input_schema ?? {}), JSON.stringify(output_schema ?? {}),
         tags ?? [], actor(req)]);
      await logAiGovernanceAudit(pool, actor(req), 'workflow.created', 'ai_workflow', rows[0].id,
        { name, steps: steps.length }, 'success', req.ip);
      res.status(201).json({ workflow: rows[0] });
    } catch (e: any) {
      if (e.code === '23505') return res.status(409).json({ error: 'Workflow name already exists' });
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/governance/ai/ai-workflows/:id', guard, rl, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    const { name, description, steps, trigger_type, status, tags } = req.body;
    const { rows } = await pool.query(
      `UPDATE aig_ai_workflows SET
         name=COALESCE($1,name), description=COALESCE($2,description),
         steps=COALESCE($3::jsonb,steps), trigger_type=COALESCE($4,trigger_type),
         status=COALESCE($5,status), tags=COALESCE($6,tags),
         version=version+1, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [name, description, steps ? JSON.stringify(steps) : null,
       trigger_type, status, tags, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Workflow not found' });
    await logAiGovernanceAudit(pool, actor(req), 'workflow.updated', 'ai_workflow', req.params.id, req.body, 'success', req.ip);
    res.json({ workflow: rows[0] });
  });

  // Trigger a workflow run — real LLM execution via OpenAI
  app.post('/api/governance/ai/ai-workflows/:id/run', guard, rl, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    try {
      const result = await executeWorkflow(
        pool,
        req.params.id,
        actor(req),
        req.body.trigger_type ?? 'manual',
        req.body.input ?? {},
      );
      await logAiGovernanceAudit(pool, actor(req), 'workflow.run_completed', 'workflow_run',
        result.run_id, { duration_ms: result.duration_ms, status: result.status }, 'success', req.ip);
      res.json(result);
    } catch (e: any) {
      if (e.message?.includes('not found'))  return res.status(404).json({ error: e.message });
      if (e.message?.includes('not active')) return res.status(422).json({ error: e.message });
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/governance/ai/ai-workflows/:id/runs', guard, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    const { rows } = await pool.query(
      `SELECT * FROM aig_workflow_runs WHERE workflow_id=$1 ORDER BY created_at DESC LIMIT $2`,
      [req.params.id, limit]);
    res.json({ runs: rows });
  });

  app.get('/api/governance/ai/workflow-runs', guard, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    const limit  = Math.min(Number(req.query.limit ?? 50), 200);
    const status = req.query.status as string | undefined;
    const { rows } = await pool.query(
      `SELECT wr.*,wf.name AS workflow_name
       FROM aig_workflow_runs wr JOIN aig_ai_workflows wf ON wf.id=wr.workflow_id
       ${status ? `WHERE wr.status=$2` : ''}
       ORDER BY wr.created_at DESC LIMIT $1`,
      status ? [limit, status] : [limit]);
    res.json({ runs: rows });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // INSIGHT GENERATION RULES
  // ════════════════════════════════════════════════════════════════════════════

  app.get('/api/governance/ai/insight-rules', guard, async (_req, res) => {
    if (!isEnabled()) return flagOff(res);
    const { rows } = await pool.query(
      `SELECT ir.*,
         (SELECT config_name FROM aig_model_configs mc WHERE mc.id=ir.model_config_id) AS config_name
       FROM aig_insight_rules ir ORDER BY ir.priority DESC, ir.updated_at DESC`);
    res.json({ rules: rows });
  });

  app.post('/api/governance/ai/insight-rules', guard, rl, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    const { name, description, rule_type, condition_logic, output_template,
            model_config_id, priority, confidence_floor, max_output_tokens, tags } = req.body;
    if (!name?.trim() || !condition_logic) return res.status(400).json({ error: 'name and condition_logic required' });
    const { rows } = await pool.query(
      `INSERT INTO aig_insight_rules
         (name,description,rule_type,condition_logic,output_template,model_config_id,
          priority,confidence_floor,max_output_tokens,tags)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [name.trim(), description ?? null, rule_type ?? 'threshold',
       JSON.stringify(condition_logic), output_template ?? null,
       model_config_id ?? null, priority ?? 50,
       confidence_floor ?? 0.6, max_output_tokens ?? 500, tags ?? []]);
    await logAiGovernanceAudit(pool, actor(req), 'insight_rule.created', 'insight_rule', rows[0].id,
      { name }, 'success', req.ip);
    res.status(201).json({ rule: rows[0] });
  });

  app.put('/api/governance/ai/insight-rules/:id', guard, rl, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    const { name, description, condition_logic, output_template, priority,
            confidence_floor, is_active, tags } = req.body;
    const { rows } = await pool.query(
      `UPDATE aig_insight_rules SET
         name=COALESCE($1,name), description=COALESCE($2,description),
         condition_logic=COALESCE($3::jsonb,condition_logic),
         output_template=COALESCE($4,output_template),
         priority=COALESCE($5,priority), confidence_floor=COALESCE($6,confidence_floor),
         is_active=COALESCE($7,is_active), tags=COALESCE($8,tags), updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [name, description, condition_logic ? JSON.stringify(condition_logic) : null,
       output_template, priority, confidence_floor, is_active, tags, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Rule not found' });
    await logAiGovernanceAudit(pool, actor(req), 'insight_rule.updated', 'insight_rule', req.params.id, req.body, 'success', req.ip);
    res.json({ rule: rows[0] });
  });

  app.delete('/api/governance/ai/insight-rules/:id', guard, rl, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    await pool.query(`UPDATE aig_insight_rules SET is_active=false,updated_at=NOW() WHERE id=$1`, [req.params.id]);
    await logAiGovernanceAudit(pool, actor(req), 'insight_rule.deactivated', 'insight_rule', req.params.id, {}, 'success', req.ip);
    res.json({ ok: true });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // RECOMMENDATION RULES
  // ════════════════════════════════════════════════════════════════════════════

  app.get('/api/governance/ai/recommendation-rules', guard, async (_req, res) => {
    if (!isEnabled()) return flagOff(res);
    const { rows } = await pool.query(
      `SELECT * FROM aig_recommendation_rules ORDER BY priority DESC, updated_at DESC`);
    res.json({ rules: rows });
  });

  app.post('/api/governance/ai/recommendation-rules', guard, rl, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    const { name, description, rule_type, eligibility_criteria, recommendation_template,
            model_config_id, priority, ab_test_group, min_confidence, cooldown_hours } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name required' });
    if (!eligibility_criteria || !recommendation_template)
      return res.status(400).json({ error: 'eligibility_criteria and recommendation_template required' });
    const { rows } = await pool.query(
      `INSERT INTO aig_recommendation_rules
         (name,description,rule_type,eligibility_criteria,recommendation_template,
          model_config_id,priority,ab_test_group,min_confidence,cooldown_hours)
       VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8,$9,$10) RETURNING *`,
      [name.trim(), description ?? null, rule_type ?? 'stage_based',
       JSON.stringify(eligibility_criteria), JSON.stringify(recommendation_template),
       model_config_id ?? null, priority ?? 50, ab_test_group ?? null,
       min_confidence ?? 0.5, cooldown_hours ?? 24]);
    await logAiGovernanceAudit(pool, actor(req), 'rec_rule.created', 'recommendation_rule',
      rows[0].id, { name }, 'success', req.ip);
    res.status(201).json({ rule: rows[0] });
  });

  app.put('/api/governance/ai/recommendation-rules/:id', guard, rl, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    const { name, description, priority, min_confidence, cooldown_hours,
            is_active, ab_test_group } = req.body;
    const { rows } = await pool.query(
      `UPDATE aig_recommendation_rules SET
         name=COALESCE($1,name), description=COALESCE($2,description),
         priority=COALESCE($3,priority), min_confidence=COALESCE($4,min_confidence),
         cooldown_hours=COALESCE($5,cooldown_hours), is_active=COALESCE($6,is_active),
         ab_test_group=COALESCE($7,ab_test_group), updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [name, description, priority, min_confidence, cooldown_hours,
       is_active, ab_test_group, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Rule not found' });
    await logAiGovernanceAudit(pool, actor(req), 'rec_rule.updated', 'recommendation_rule',
      req.params.id, req.body, 'success', req.ip);
    res.json({ rule: rows[0] });
  });

  app.delete('/api/governance/ai/recommendation-rules/:id', guard, rl, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    await pool.query(`UPDATE aig_recommendation_rules SET is_active=false,updated_at=NOW() WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // EVALUATION FRAMEWORK
  // ════════════════════════════════════════════════════════════════════════════

  app.get('/api/governance/ai/evaluations', guard, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const { rows } = await pool.query(
      `SELECT e.*,wr.workflow_id,
         (SELECT name FROM aig_ai_workflows wf WHERE wf.id=wr.workflow_id) AS workflow_name
       FROM aig_evaluations e LEFT JOIN aig_workflow_runs wr ON wr.id=e.run_id
       ORDER BY e.evaluated_at DESC LIMIT $1`, [limit]);
    const { rows: stats } = await pool.query(
      `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE passed)::int AS passed,
              COALESCE(AVG(overall_score),0) AS avg_score
       FROM aig_evaluations WHERE evaluated_at > NOW()-INTERVAL '7 days'`);
    res.json({ evaluations: rows, stats: stats[0] });
  });

  app.post('/api/governance/ai/evaluations', guard, rl, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    const { output, context, run_id } = req.body;
    if (!output?.trim()) return res.status(400).json({ error: 'output required' });
    const result = await runLlmEvaluation(pool, output, context ?? {}, run_id ?? null);
    const { rows: [ev] } = await pool.query(
      `SELECT * FROM aig_evaluations WHERE run_id=$1 ORDER BY evaluated_at DESC LIMIT 1`, [run_id]);
    await logAiGovernanceAudit(pool, actor(req), 'evaluation.run', 'evaluation',
      ev?.id ?? null, { passed: result.passed, overall: result.overall, method: result.method }, 'success', req.ip);
    res.json({ result, evaluation: ev ?? null });
  });

  app.get('/api/governance/ai/evaluations/:id', guard, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    const { rows } = await pool.query(`SELECT * FROM aig_evaluations WHERE id=$1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Evaluation not found' });
    res.json({ evaluation: rows[0] });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // HALLUCINATION CONTROLS
  // ════════════════════════════════════════════════════════════════════════════

  app.get('/api/governance/ai/hallucination-flags', guard, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    const limit    = Math.min(Number(req.query.limit ?? 50), 200);
    const status   = req.query.status as string | undefined;
    const severity = req.query.severity as string | undefined;
    const conditions: string[] = [];
    const params: any[] = [limit];
    if (status)   { conditions.push(`review_status=$${params.push(status)}`); }
    if (severity) { conditions.push(`severity=$${params.push(severity)}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT * FROM aig_hallucination_flags ${where} ORDER BY created_at DESC LIMIT $1`, params);
    const { rows: stats } = await pool.query(
      `SELECT review_status, severity, COUNT(*)::int AS n
       FROM aig_hallucination_flags GROUP BY review_status,severity`);
    res.json({ flags: rows, stats: stats });
  });

  app.post('/api/governance/ai/hallucination-flags/:id/review', guard, rl, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    const { review_status, notes } = req.body;
    const validStatuses = ['reviewed', 'confirmed', 'dismissed'];
    if (!validStatuses.includes(review_status))
      return res.status(400).json({ error: `review_status must be one of: ${validStatuses.join(', ')}` });
    const { rows } = await pool.query(
      `UPDATE aig_hallucination_flags SET review_status=$1,reviewed_by=$2,reviewed_at=NOW()
       WHERE id=$3 RETURNING *`,
      [review_status, actor(req), req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Flag not found' });
    await logAiGovernanceAudit(pool, actor(req), 'hallucination.reviewed', 'hallucination_flag',
      req.params.id, { review_status, notes }, 'success', req.ip);
    res.json({ flag: rows[0] });
  });

  // Content Filters
  app.get('/api/governance/ai/content-filters', guard, async (_req, res) => {
    if (!isEnabled()) return flagOff(res);
    const { rows } = await pool.query(`SELECT * FROM aig_content_filters ORDER BY severity DESC, filter_type`);
    res.json({ filters: rows });
  });

  app.post('/api/governance/ai/content-filters', guard, rl, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    const { filter_name, filter_type, pattern, scope, severity, action } = req.body;
    if (!filter_name?.trim() || !pattern?.trim())
      return res.status(400).json({ error: 'filter_name and pattern required' });
    const { rows } = await pool.query(
      `INSERT INTO aig_content_filters (filter_name,filter_type,pattern,scope,severity,action,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [filter_name.trim(), filter_type ?? 'keyword', pattern.trim(),
       scope ?? 'output', severity ?? 'medium', action ?? 'flag', actor(req)]);
    await logAiGovernanceAudit(pool, actor(req), 'content_filter.created', 'content_filter',
      rows[0].id, { filter_name, pattern, severity }, 'success', req.ip);
    res.status(201).json({ filter: rows[0] });
  });

  app.delete('/api/governance/ai/content-filters/:id', guard, rl, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    await pool.query(`UPDATE aig_content_filters SET is_active=false WHERE id=$1`, [req.params.id]);
    await logAiGovernanceAudit(pool, actor(req), 'content_filter.disabled', 'content_filter',
      req.params.id, {}, 'success', req.ip);
    res.json({ ok: true });
  });

  // Scan arbitrary text — LLM-assisted hallucination check with rule-based fallback
  app.post('/api/governance/ai/hallucination-check', guard, rl, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    const { text, run_id, source_data } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'text required' });
    const result = await runLlmHallucinationCheck(pool, text, source_data ?? {}, run_id ?? undefined);
    res.json(result);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // AUDIT LOGS
  // ════════════════════════════════════════════════════════════════════════════

  app.get('/api/governance/ai/audit-logs', guard, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    const limit  = Math.min(Number(req.query.limit ?? 100), 500);
    const action = req.query.action as string | undefined;
    const entity = req.query.entity_type as string | undefined;
    const since  = req.query.since as string | undefined;
    const conditions = [`domain='ai_governance'`];
    const params: any[] = [];
    if (action) conditions.push(`action LIKE $${params.push('%' + action + '%')}`);
    if (entity) conditions.push(`entity_type=$${params.push(entity)}`);
    if (since)  conditions.push(`ts >= $${params.push(since)}`);
    const { rows } = await pool.query(
      `SELECT id,ts,actor,action,entity_type,entity_id,outcome,payload,ip_address
       FROM gov_audit_framework
       WHERE ${conditions.join(' AND ')}
       ORDER BY ts DESC LIMIT $${params.push(limit)}`,
      params);
    res.json({ logs: rows, total: rows.length });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // MONITORING
  // ════════════════════════════════════════════════════════════════════════════

  app.get('/api/governance/ai/monitoring', guard, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    const hours = Math.min(Number(req.query.hours ?? 24), 168);
    const [metrics, alerts, policies] = await Promise.all([
      pool.query(
        `SELECT metric_name, metric_value, recorded_at FROM aig_monitoring_metrics
         WHERE recorded_at > NOW() - ($1 || ' hours')::INTERVAL
         ORDER BY metric_name, recorded_at DESC`,
        [hours]),
      pool.query(`SELECT * FROM aig_alerts ORDER BY severity DESC, last_triggered_at DESC NULLS LAST`),
      pool.query(`SELECT * FROM aig_governance_policies ORDER BY policy_type, name`),
    ]);
    // Compute triggered alerts based on latest metric values
    const latestMetrics: Record<string, number> = {};
    for (const r of metrics.rows) {
      if (!(r.metric_name in latestMetrics)) latestMetrics[r.metric_name] = Number(r.metric_value);
    }
    const triggeredAlerts = alerts.rows.filter((a: any) => {
      const c = a.condition;
      if (!c?.metric) return false;
      const val = latestMetrics[c.metric];
      if (val == null) return false;
      if (c.operator === 'gt')  return val > Number(c.threshold);
      if (c.operator === 'lt')  return val < Number(c.threshold);
      if (c.operator === 'gte') return val >= Number(c.threshold);
      if (c.operator === 'lte') return val <= Number(c.threshold);
      return false;
    });
    res.json({ metrics: metrics.rows, latest_metrics: latestMetrics,
               alerts: alerts.rows, triggered_alerts: triggeredAlerts,
               policies: policies.rows });
  });

  app.post('/api/governance/ai/monitoring/refresh', guard, rl, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    const n = await computeAiMonitoringMetrics(pool);
    await logAiGovernanceAudit(pool, actor(req), 'monitoring.refreshed', 'monitoring',
      null, { metrics_written: n }, 'success', req.ip);
    res.json({ ok: true, metrics_written: n, refreshed_at: new Date().toISOString() });
  });

  // Alerts CRUD
  app.post('/api/governance/ai/alerts', guard, rl, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    const { alert_name, alert_type, severity, condition, notification_channels } = req.body;
    if (!alert_name?.trim() || !condition) return res.status(400).json({ error: 'alert_name and condition required' });
    const { rows } = await pool.query(
      `INSERT INTO aig_alerts (alert_name,alert_type,severity,condition,notification_channels)
       VALUES ($1,$2,$3,$4::jsonb,$5) RETURNING *`,
      [alert_name.trim(), alert_type ?? 'threshold', severity ?? 'warning',
       JSON.stringify(condition), notification_channels ?? ['admin_dashboard']]);
    res.status(201).json({ alert: rows[0] });
  });

  app.post('/api/governance/ai/alerts/:id/acknowledge', guard, rl, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    const { rows } = await pool.query(
      `UPDATE aig_alerts SET acknowledged_at=NOW(),acknowledged_by=$1 WHERE id=$2 RETURNING *`,
      [actor(req), req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Alert not found' });
    await logAiGovernanceAudit(pool, actor(req), 'alert.acknowledged', 'alert',
      req.params.id, {}, 'success', req.ip);
    res.json({ alert: rows[0] });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // GOVERNANCE POLICIES
  // ════════════════════════════════════════════════════════════════════════════

  app.get('/api/governance/ai/policies', guard, async (_req, res) => {
    if (!isEnabled()) return flagOff(res);
    const { rows } = await pool.query(
      `SELECT * FROM aig_governance_policies ORDER BY policy_type, name`);
    res.json({ policies: rows });
  });

  app.post('/api/governance/ai/policies', guard, rl, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    const { name, policy_type, scope, scope_id, configuration, enforcement_mode } = req.body;
    if (!name?.trim() || !policy_type?.trim() || !configuration)
      return res.status(400).json({ error: 'name, policy_type, and configuration required' });
    const id = 'pol_' + name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
    try {
      const { rows } = await pool.query(
        `INSERT INTO aig_governance_policies (id,name,policy_type,scope,scope_id,configuration,enforcement_mode,created_by)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8) RETURNING *`,
        [id, name.trim(), policy_type.trim(), scope ?? 'global', scope_id ?? null,
         JSON.stringify(configuration), enforcement_mode ?? 'enforce', actor(req)]);
      await logAiGovernanceAudit(pool, actor(req), 'policy.created', 'governance_policy',
        rows[0].id, { name, policy_type }, 'success', req.ip);
      res.status(201).json({ policy: rows[0] });
    } catch (e: any) {
      if (e.code === '23505') return res.status(409).json({ error: 'Policy name already exists' });
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/governance/ai/policies/:id', guard, rl, async (req, res) => {
    if (!isEnabled()) return flagOff(res);
    const { configuration, enforcement_mode, is_active } = req.body;
    const { rows } = await pool.query(
      `UPDATE aig_governance_policies SET
         configuration=COALESCE($1::jsonb,configuration),
         enforcement_mode=COALESCE($2,enforcement_mode),
         is_active=COALESCE($3,is_active), updated_at=NOW()
       WHERE id=$4 RETURNING *`,
      [configuration ? JSON.stringify(configuration) : null,
       enforcement_mode, is_active, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Policy not found' });
    await logAiGovernanceAudit(pool, actor(req), 'policy.updated', 'governance_policy',
      req.params.id, req.body, 'success', req.ip);
    res.json({ policy: rows[0] });
  });

  console.log('[ai-governance] routes registered — /api/governance/ai/*');

  // Start background scheduler (idempotent — no-op if already running or flag off)
  getSchema(pool).then(() => startAiGovernanceScheduler(pool)).catch(() => null);
}
