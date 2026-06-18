/**
 * AI Governance Platform — Schema + Service Layer
 *
 * 15 aig_* tables (avoids collision with existing gov_* ontology tables).
 * Audit writes reuse gov_audit_framework. Rate-limit checks reuse gov_rate_limits.
 *
 * Flag: FF_AI_GOVERNANCE
 */
import type { Pool } from 'pg';
import crypto from 'crypto';

// ── DDL ─────────────────────────────────────────────────────────────────────

export async function ensureAiGovernanceSchema(pool: Pool): Promise<void> {
  await pool.query(`
    -- Prompt Repository
    CREATE TABLE IF NOT EXISTS aig_prompts (
      id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      name          TEXT        NOT NULL,
      slug          TEXT        UNIQUE NOT NULL,
      description   TEXT,
      category      TEXT        NOT NULL DEFAULT 'general',
      tags          TEXT[]      DEFAULT '{}',
      current_version INTEGER   DEFAULT 1,
      status        TEXT        NOT NULL DEFAULT 'draft',
      owner         TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS aig_prompts_status ON aig_prompts(status);
    CREATE INDEX IF NOT EXISTS aig_prompts_category ON aig_prompts(category);

    -- Prompt Versions
    CREATE TABLE IF NOT EXISTS aig_prompt_versions (
      id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      prompt_id      UUID        NOT NULL REFERENCES aig_prompts(id) ON DELETE CASCADE,
      version        INTEGER     NOT NULL DEFAULT 1,
      template       TEXT        NOT NULL,
      system_context TEXT,
      variables      TEXT[]      DEFAULT '{}',
      changelog      TEXT,
      author         TEXT,
      parent_version INTEGER,
      content_hash   TEXT,
      is_active      BOOLEAN     NOT NULL DEFAULT false,
      test_pass_rate NUMERIC(5,2),
      token_estimate INTEGER,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(prompt_id, version)
    );
    CREATE INDEX IF NOT EXISTS aig_pv_prompt ON aig_prompt_versions(prompt_id, version DESC);
    CREATE INDEX IF NOT EXISTS aig_pv_active ON aig_prompt_versions(prompt_id) WHERE is_active;

    -- Prompt Test Cases
    CREATE TABLE IF NOT EXISTS aig_prompt_test_cases (
      id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      prompt_id           UUID        NOT NULL REFERENCES aig_prompts(id) ON DELETE CASCADE,
      version             INTEGER,
      name                TEXT        NOT NULL,
      input_variables     JSONB       NOT NULL DEFAULT '{}',
      expected_output     TEXT,
      evaluation_criteria JSONB       NOT NULL DEFAULT '{}',
      last_run_at         TIMESTAMPTZ,
      last_result         TEXT,
      last_score          NUMERIC(4,3),
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS aig_ptc_prompt ON aig_prompt_test_cases(prompt_id);

    -- Model Registry
    CREATE TABLE IF NOT EXISTS aig_models (
      id                         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      provider                   TEXT        NOT NULL,
      model_name                 TEXT        NOT NULL,
      model_version              TEXT        NOT NULL DEFAULT 'latest',
      capabilities               TEXT[]      DEFAULT '{}',
      context_window             INTEGER     DEFAULT 8192,
      cost_per_1k_input_tokens   NUMERIC(10,6) DEFAULT 0,
      cost_per_1k_output_tokens  NUMERIC(10,6) DEFAULT 0,
      status                     TEXT        NOT NULL DEFAULT 'available',
      is_default                 BOOLEAN     NOT NULL DEFAULT false,
      latency_p50_ms             INTEGER,
      latency_p95_ms             INTEGER,
      metadata                   JSONB       NOT NULL DEFAULT '{}',
      created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(provider, model_name, model_version)
    );
    CREATE INDEX IF NOT EXISTS aig_models_status ON aig_models(status);
    CREATE INDEX IF NOT EXISTS aig_models_default ON aig_models(is_default) WHERE is_default;

    -- Model Configuration Profiles
    CREATE TABLE IF NOT EXISTS aig_model_configs (
      id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      model_id          UUID        NOT NULL REFERENCES aig_models(id) ON DELETE CASCADE,
      config_name       TEXT        NOT NULL,
      temperature       NUMERIC(4,3) DEFAULT 0.700,
      max_tokens        INTEGER     DEFAULT 1024,
      top_p             NUMERIC(4,3) DEFAULT 1.000,
      frequency_penalty NUMERIC(4,3) DEFAULT 0.000,
      presence_penalty  NUMERIC(4,3) DEFAULT 0.000,
      stop_sequences    TEXT[]      DEFAULT '{}',
      use_case          TEXT        DEFAULT 'general',
      is_active         BOOLEAN     NOT NULL DEFAULT true,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(model_id, config_name)
    );
    CREATE INDEX IF NOT EXISTS aig_mc_model ON aig_model_configs(model_id);

    -- AI Workflow Engine
    CREATE TABLE IF NOT EXISTS aig_ai_workflows (
      id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      name           TEXT        UNIQUE NOT NULL,
      description    TEXT,
      steps          JSONB       NOT NULL DEFAULT '[]',
      trigger_type   TEXT        NOT NULL DEFAULT 'manual',
      trigger_config JSONB       NOT NULL DEFAULT '{}',
      input_schema   JSONB       NOT NULL DEFAULT '{}',
      output_schema  JSONB       NOT NULL DEFAULT '{}',
      status         TEXT        NOT NULL DEFAULT 'draft',
      version        INTEGER     NOT NULL DEFAULT 1,
      tags           TEXT[]      DEFAULT '{}',
      created_by     TEXT,
      run_count      INTEGER     NOT NULL DEFAULT 0,
      last_run_at    TIMESTAMPTZ,
      avg_duration_ms INTEGER,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS aig_wf_status ON aig_ai_workflows(status);

    -- Workflow Runs (execution history)
    CREATE TABLE IF NOT EXISTS aig_workflow_runs (
      id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      workflow_id        UUID        NOT NULL REFERENCES aig_ai_workflows(id) ON DELETE CASCADE,
      triggered_by       TEXT,
      trigger_type       TEXT        DEFAULT 'manual',
      input              JSONB       NOT NULL DEFAULT '{}',
      output             JSONB,
      status             TEXT        NOT NULL DEFAULT 'pending',
      steps_trace        JSONB       NOT NULL DEFAULT '[]',
      model_used         TEXT,
      prompt_ids         TEXT[]      DEFAULT '{}',
      tokens_input       INTEGER     DEFAULT 0,
      tokens_output      INTEGER     DEFAULT 0,
      cost_usd           NUMERIC(10,6) DEFAULT 0,
      duration_ms        INTEGER,
      hallucination_score NUMERIC(4,3),
      evaluation_score   NUMERIC(4,3),
      error_message      TEXT,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at       TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS aig_wr_workflow ON aig_workflow_runs(workflow_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS aig_wr_status ON aig_workflow_runs(status);
    CREATE INDEX IF NOT EXISTS aig_wr_created ON aig_workflow_runs(created_at DESC);

    -- Insight Generation Rules
    CREATE TABLE IF NOT EXISTS aig_insight_rules (
      id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      name              TEXT        NOT NULL,
      description       TEXT,
      rule_type         TEXT        NOT NULL DEFAULT 'threshold',
      condition_logic   JSONB       NOT NULL DEFAULT '{}',
      output_template   TEXT,
      model_config_id   UUID        REFERENCES aig_model_configs(id),
      priority          INTEGER     NOT NULL DEFAULT 50,
      confidence_floor  NUMERIC(4,3) DEFAULT 0.600,
      max_output_tokens INTEGER     DEFAULT 500,
      tags              TEXT[]      DEFAULT '{}',
      is_active         BOOLEAN     NOT NULL DEFAULT true,
      trigger_count     INTEGER     NOT NULL DEFAULT 0,
      last_triggered_at TIMESTAMPTZ,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS aig_ir_active ON aig_insight_rules(is_active, priority DESC);

    -- Recommendation Rules
    CREATE TABLE IF NOT EXISTS aig_recommendation_rules (
      id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      name                  TEXT        NOT NULL,
      description           TEXT,
      rule_type             TEXT        NOT NULL DEFAULT 'stage_based',
      eligibility_criteria  JSONB       NOT NULL DEFAULT '{}',
      recommendation_template JSONB    NOT NULL DEFAULT '{}',
      model_config_id       UUID        REFERENCES aig_model_configs(id),
      priority              INTEGER     NOT NULL DEFAULT 50,
      ab_test_group         TEXT,
      min_confidence        NUMERIC(4,3) DEFAULT 0.500,
      cooldown_hours        INTEGER     DEFAULT 24,
      is_active             BOOLEAN     NOT NULL DEFAULT true,
      trigger_count         INTEGER     NOT NULL DEFAULT 0,
      acceptance_rate       NUMERIC(5,2),
      last_triggered_at     TIMESTAMPTZ,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS aig_rr_active ON aig_recommendation_rules(is_active, priority DESC);

    -- AI Evaluation Framework
    CREATE TABLE IF NOT EXISTS aig_evaluations (
      id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      run_id           UUID        REFERENCES aig_workflow_runs(id) ON DELETE SET NULL,
      evaluator        TEXT        NOT NULL DEFAULT 'rule_based',
      rubric           JSONB       NOT NULL DEFAULT '{}',
      dimension_scores JSONB       NOT NULL DEFAULT '{}',
      overall_score    NUMERIC(4,3),
      passed           BOOLEAN,
      failure_reasons  TEXT[]      DEFAULT '{}',
      feedback         TEXT,
      evaluated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS aig_eval_run ON aig_evaluations(run_id);
    CREATE INDEX IF NOT EXISTS aig_eval_passed ON aig_evaluations(passed, evaluated_at DESC);

    -- Hallucination Flags
    CREATE TABLE IF NOT EXISTS aig_hallucination_flags (
      id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      run_id           UUID        REFERENCES aig_workflow_runs(id) ON DELETE SET NULL,
      detection_method TEXT        NOT NULL DEFAULT 'keyword',
      flagged_content  TEXT        NOT NULL,
      severity         TEXT        NOT NULL DEFAULT 'low',
      confidence       NUMERIC(4,3) DEFAULT 0.500,
      reason           TEXT,
      grounding_sources JSONB      NOT NULL DEFAULT '[]',
      review_status    TEXT        NOT NULL DEFAULT 'pending',
      reviewed_by      TEXT,
      reviewed_at      TIMESTAMPTZ,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS aig_hf_status ON aig_hallucination_flags(review_status, created_at DESC);
    CREATE INDEX IF NOT EXISTS aig_hf_severity ON aig_hallucination_flags(severity);

    -- Content Filters (blocklists + pattern rules for hallucination prevention)
    CREATE TABLE IF NOT EXISTS aig_content_filters (
      id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      filter_name  TEXT        NOT NULL,
      filter_type  TEXT        NOT NULL DEFAULT 'keyword',
      pattern      TEXT        NOT NULL,
      scope        TEXT        NOT NULL DEFAULT 'output',
      severity     TEXT        NOT NULL DEFAULT 'medium',
      action       TEXT        NOT NULL DEFAULT 'flag',
      is_active    BOOLEAN     NOT NULL DEFAULT true,
      match_count  INTEGER     NOT NULL DEFAULT 0,
      created_by   TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS aig_cf_active ON aig_content_filters(is_active, filter_type);

    -- Monitoring Metrics (time-series)
    CREATE TABLE IF NOT EXISTS aig_monitoring_metrics (
      id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      metric_name     TEXT        NOT NULL,
      metric_value    NUMERIC(14,6) NOT NULL,
      dimension       TEXT        DEFAULT 'global',
      dimension_value TEXT,
      period          TEXT        NOT NULL DEFAULT 'hourly',
      recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS aig_mm_name_time ON aig_monitoring_metrics(metric_name, recorded_at DESC);
    CREATE INDEX IF NOT EXISTS aig_mm_recent ON aig_monitoring_metrics(recorded_at DESC);

    -- Governance Policies
    CREATE TABLE IF NOT EXISTS aig_governance_policies (
      id                TEXT        PRIMARY KEY,
      name              TEXT        UNIQUE NOT NULL,
      policy_type       TEXT        NOT NULL,
      scope             TEXT        NOT NULL DEFAULT 'global',
      scope_id          TEXT,
      configuration     JSONB       NOT NULL DEFAULT '{}',
      is_active         BOOLEAN     NOT NULL DEFAULT true,
      enforcement_mode  TEXT        NOT NULL DEFAULT 'enforce',
      violation_count   INTEGER     NOT NULL DEFAULT 0,
      last_violated_at  TIMESTAMPTZ,
      created_by        TEXT        DEFAULT 'system',
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Governance Alerts
    CREATE TABLE IF NOT EXISTS aig_alerts (
      id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      alert_name        TEXT        NOT NULL,
      alert_type        TEXT        NOT NULL DEFAULT 'threshold',
      severity          TEXT        NOT NULL DEFAULT 'warning',
      condition         JSONB       NOT NULL DEFAULT '{}',
      notification_channels TEXT[]  DEFAULT '{}',
      is_active         BOOLEAN     NOT NULL DEFAULT true,
      trigger_count     INTEGER     NOT NULL DEFAULT 0,
      last_triggered_at TIMESTAMPTZ,
      acknowledged_at   TIMESTAMPTZ,
      acknowledged_by   TEXT,
      resolved_at       TIMESTAMPTZ,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS aig_alerts_active ON aig_alerts(is_active, severity);
  `);
}

// ── Seed default data ────────────────────────────────────────────────────────

export async function seedAiGovernanceDefaults(pool: Pool): Promise<void> {
  // Default models
  await pool.query(`
    INSERT INTO aig_models (provider,model_name,model_version,capabilities,context_window,
      cost_per_1k_input_tokens,cost_per_1k_output_tokens,status,is_default,metadata)
    VALUES
      ('openai','gpt-4o','2024-11-20',
       ARRAY['chat','function_calling','vision'],128000,0.002500,0.010000,'available',true,
       '{"description":"OpenAI GPT-4o — default model","tier":"production"}'::jsonb),
      ('openai','gpt-4o-mini','2024-07-18',
       ARRAY['chat','function_calling'],128000,0.000150,0.000600,'available',false,
       '{"description":"GPT-4o Mini — cost-optimised","tier":"cost-efficient"}'::jsonb),
      ('anthropic','claude-3-5-sonnet','20241022',
       ARRAY['chat','vision'],200000,0.003000,0.015000,'available',false,
       '{"description":"Claude 3.5 Sonnet — high-reasoning","tier":"production"}'::jsonb),
      ('local','llama-3-8b','latest',
       ARRAY['chat'],8192,0.000000,0.000000,'testing',false,
       '{"description":"Local Llama 3 8B — offline testing","tier":"dev"}'::jsonb)
    ON CONFLICT (provider,model_name,model_version) DO NOTHING
  `);

  // Default model config for default model
  await pool.query(`
    INSERT INTO aig_model_configs (model_id,config_name,temperature,max_tokens,use_case)
    SELECT id,'insight_gen_default',0.400,600,'insight_gen'
    FROM aig_models WHERE is_default AND provider='openai'
    ON CONFLICT (model_id,config_name) DO NOTHING;

    INSERT INTO aig_model_configs (model_id,config_name,temperature,max_tokens,use_case)
    SELECT id,'recommendation_default',0.500,400,'recommendation'
    FROM aig_models WHERE is_default AND provider='openai'
    ON CONFLICT (model_id,config_name) DO NOTHING;

    INSERT INTO aig_model_configs (model_id,config_name,temperature,max_tokens,use_case)
    SELECT id,'evaluation_default',0.100,800,'evaluation'
    FROM aig_models WHERE is_default AND provider='openai'
    ON CONFLICT (model_id,config_name) DO NOTHING;
  `);

  // Default content filters
  await pool.query(`
    INSERT INTO aig_content_filters (filter_name,filter_type,pattern,scope,severity,action,created_by)
    VALUES
      ('PII Email Pattern','regex','[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}','output','high','redact','system'),
      ('PII Phone Pattern','regex','(\\+?[0-9][0-9\\-\\(\\) ]{7,}[0-9])','output','high','redact','system'),
      ('Fabricated Statistics','keyword','studies show','output','medium','flag','system'),
      ('Absolute Certainty','keyword','guaranteed to','output','medium','flag','system'),
      ('Medical Diagnosis','keyword','you are diagnosed','output','critical','block','system'),
      ('Legal Advice','keyword','you should sue','output','critical','block','system'),
      ('Hiring Prediction','keyword','will be hired','output','high','block','system'),
      ('Score Fabrication','keyword','your score indicates you will','output','high','flag','system')
    ON CONFLICT DO NOTHING
  `);

  // Default governance policies
  await pool.query(`
    INSERT INTO aig_governance_policies (id,name,policy_type,scope,configuration,enforcement_mode)
    VALUES
      ('pol_rate_api','API Rate Limit','rate_limit','global',
       '{"requests_per_minute":60,"requests_per_hour":1000,"burst_limit":10}'::jsonb,'enforce'),
      ('pol_cost_daily','Daily Cost Cap','cost_cap','global',
       '{"max_usd_per_day":50.00,"max_usd_per_run":2.00,"alert_threshold_pct":80}'::jsonb,'enforce'),
      ('pol_token_limit','Max Token Policy','token_limit','global',
       '{"max_input_tokens":4096,"max_output_tokens":2048,"max_context_tokens":16384}'::jsonb,'enforce'),
      ('pol_pii_filter','PII Data Policy','content_filter','global',
       '{"block_pii_in_prompts":true,"redact_pii_in_outputs":true,"log_violations":true}'::jsonb,'enforce'),
      ('pol_retention','Data Retention','data_retention','global',
       '{"run_logs_days":90,"audit_logs_days":365,"evaluation_days":180,"hallucination_flags_days":365}'::jsonb,'enforce'),
      ('pol_hallucination','Hallucination Tolerance','hallucination_control','global',
       '{"max_hallucination_score":0.30,"auto_flag_threshold":0.20,"block_threshold":0.50}'::jsonb,'enforce')
    ON CONFLICT (id) DO NOTHING
  `);

  // Default alerts
  await pool.query(`
    INSERT INTO aig_alerts (alert_name,alert_type,severity,condition,notification_channels)
    VALUES
      ('High Hallucination Rate','threshold','critical',
       '{"metric":"hallucination_rate","operator":"gt","threshold":0.30,"window_minutes":60}'::jsonb,
       ARRAY['admin_dashboard']),
      ('Low Eval Pass Rate','threshold','warning',
       '{"metric":"eval_pass_rate","operator":"lt","threshold":0.70,"window_minutes":60}'::jsonb,
       ARRAY['admin_dashboard']),
      ('Cost Cap Approaching','threshold','warning',
       '{"metric":"daily_cost_usd","operator":"gt","threshold":40.00,"window_minutes":1440}'::jsonb,
       ARRAY['admin_dashboard']),
      ('Workflow Failure Spike','threshold','critical',
       '{"metric":"workflow_error_rate","operator":"gt","threshold":0.20,"window_minutes":30}'::jsonb,
       ARRAY['admin_dashboard']),
      ('Content Filter Triggered','threshold','info',
       '{"metric":"content_filter_matches","operator":"gt","threshold":5,"window_minutes":60}'::jsonb,
       ARRAY['admin_dashboard'])
    ON CONFLICT DO NOTHING
  `);

  // Default AI workflows
  await pool.query(`
    INSERT INTO aig_ai_workflows (name,description,steps,trigger_type,status,tags,created_by)
    VALUES
      ('Insight Generation Pipeline',
       'Generates behavioural insights from CAPADEX session data',
       '[{"step":1,"type":"prompt","prompt_slug":"insight_generation_v1","model_config":"insight_gen_default"},
         {"step":2,"type":"transform","operation":"extract_insights"},
         {"step":3,"type":"validate","evaluator":"rule_based","pass_threshold":0.7}]'::jsonb,
       'event','active',ARRAY['insight','capadex'],'system'),
      ('Recommendation Engine',
       'Produces personalised growth recommendations per user stage',
       '[{"step":1,"type":"prompt","prompt_slug":"recommendation_stage_v1","model_config":"recommendation_default"},
         {"step":2,"type":"filter","filter":"content_safety"},
         {"step":3,"type":"rank","strategy":"priority_score"}]'::jsonb,
       'api','active',ARRAY['recommendation','career'],'system'),
      ('Hallucination Audit Workflow',
       'Audits completed workflow runs for hallucination signals',
       '[{"step":1,"type":"fetch","source":"recent_runs","limit":50},
         {"step":2,"type":"eval","method":"consistency_check"},
         {"step":3,"type":"flag","threshold":0.2},
         {"step":4,"type":"report","destination":"admin_dashboard"}]'::jsonb,
       'scheduled','active',ARRAY['safety','audit'],'system')
    ON CONFLICT (name) DO NOTHING
  `);

  // Default insight rules
  await pool.query(`
    INSERT INTO aig_insight_rules (name,description,rule_type,condition_logic,output_template,priority,confidence_floor,tags)
    VALUES
      ('High Distress Signal','Triggers when CAPADEX session shows elevated distress',
       'threshold',
       '{"field":"distress_score","operator":"gte","threshold":0.7,"source":"capadex_session"}'::jsonb,
       'User shows elevated {concern_domain} distress signals. Recommended: immediate support pathway.',
       90,0.750,ARRAY['safety','distress']),
      ('Career Stage Transition','Fires at career stage boundaries in Career Builder',
       'ml_signal',
       '{"signal":"stage_change","stages":["emerging","developing","established"],"source":"career_builder"}'::jsonb,
       'User is transitioning from {from_stage} to {to_stage}. Growth opportunities: {opportunities}.',
       70,0.600,ARRAY['career','transition']),
      ('Low Competency Coverage','Triggers when assessed competency coverage drops below threshold',
       'threshold',
       '{"field":"competency_coverage_pct","operator":"lt","threshold":0.4,"source":"cp_competencies"}'::jsonb,
       'Competency profile incomplete ({coverage_pct}% coverage). Focus areas: {gaps}.',
       60,0.650,ARRAY['competency','gap'])
    ON CONFLICT DO NOTHING
  `);

  // Default recommendation rules
  await pool.query(`
    INSERT INTO aig_recommendation_rules (name,description,rule_type,eligibility_criteria,recommendation_template,priority,min_confidence,cooldown_hours)
    VALUES
      ('Career Path Recommendation','Suggests career paths based on competency + BIOS profile',
       'hybrid',
       '{"requires":["capadex_session","competency_assessment"],"min_score":0.4}'::jsonb,
       '{"type":"career_path","template":"Based on your {strength_domain} strengths, consider {paths}","cta":"Explore Paths"}'::jsonb,
       80,0.600,48),
      ('Learning Resource Suggestion','Recommends learning resources for identified skill gaps',
       'content_based',
       '{"requires":["gap_analysis"],"min_gap_count":2}'::jsonb,
       '{"type":"learning","template":"Close your {top_gap} gap with: {resources}","cta":"Start Learning"}'::jsonb,
       70,0.550,24),
      ('Mentor Connection','Connects users with mentors aligned to their stage',
       'stage_based',
       '{"requires":["career_stage"],"stages":["developing","emerging"]}'::jsonb,
       '{"type":"mentor","template":"Connect with a mentor specialising in {domain}","cta":"Find Mentor"}'::jsonb,
       65,0.500,168)
    ON CONFLICT DO NOTHING
  `);

  // Default prompts
  await pool.query(`
    INSERT INTO aig_prompts (name,slug,description,category,status,owner,tags)
    VALUES
      ('Insight Generation v1','insight_generation_v1',
       'Generates actionable insights from CAPADEX session data',
       'insight','active','system',ARRAY['capadex','insight','core']),
      ('Recommendation Stage v1','recommendation_stage_v1',
       'Produces stage-based growth recommendations',
       'recommendation','active','system',ARRAY['recommendation','career','core']),
      ('Evaluation Rubric v1','evaluation_rubric_v1',
       'Evaluates AI output against quality dimensions',
       'evaluation','active','system',ARRAY['evaluation','quality','core']),
      ('Hallucination Checker v1','hallucination_checker_v1',
       'Identifies potential hallucinations in AI-generated content',
       'safety','active','system',ARRAY['safety','hallucination','core'])
    ON CONFLICT (slug) DO NOTHING
  `);

  // Default prompt versions
  await pool.query(`
    INSERT INTO aig_prompt_versions (prompt_id,version,template,system_context,variables,is_active,token_estimate,changelog)
    SELECT p.id,1,
      CASE p.slug
        WHEN 'insight_generation_v1' THEN
          'You are a behavioural intelligence analyst. Given the following session data, generate 2-3 concise, actionable insights.

Session context: {session_context}
Concern domain: {concern_domain}
Distress signals: {distress_signals}
Behavioural dimensions: {behaviour_dims}

Generate insights that:
1. Are developmentally framed (never diagnostic)
2. Highlight growth opportunities
3. Are specific to the individual''s profile
4. Use hopeful, constructive language

Output as JSON: {"insights": [{"text": "...", "confidence": 0.0-1.0, "priority": 1-5}]}'
        WHEN 'recommendation_stage_v1' THEN
          'You are a career development advisor. Based on the profile below, generate 2-3 personalised recommendations.

Career stage: {career_stage}
Strength domains: {strength_domains}
Gap areas: {gap_areas}
Previous recommendations: {prev_recommendations}

Rules:
- Recommend specific, actionable next steps
- Align recommendations to the user''s current stage
- Do not recommend actions beyond 2 stage-steps ahead
- Never make hiring or promotion predictions

Output as JSON: {"recommendations": [{"type": "...", "text": "...", "confidence": 0.0-1.0, "cta": "..."}]}'
        WHEN 'evaluation_rubric_v1' THEN
          'Evaluate the following AI-generated output against the quality rubric.

Output to evaluate: {ai_output}
Context: {original_context}

Score each dimension 0.0–1.0:
- accuracy: factually correct and grounded
- relevance: directly addresses the user context
- safety: no harmful, diagnostic, or biased content
- clarity: clear and understandable
- actionability: provides concrete next steps

Output as JSON: {"scores": {"accuracy": 0.0, "relevance": 0.0, "safety": 0.0, "clarity": 0.0, "actionability": 0.0}, "overall": 0.0, "passed": true/false, "notes": "..."}'
        WHEN 'hallucination_checker_v1' THEN
          'Review the following AI output for potential hallucinations or unsupported claims.

AI output: {ai_output}
Source data available: {source_data}

Check for:
1. Claims not supported by source data
2. Fabricated statistics or percentages
3. Made-up names, resources, or organisations
4. Overly specific predictions without grounding
5. Diagnostic or medical language

Output as JSON: {"hallucination_score": 0.0-1.0, "flags": [{"text": "...", "reason": "...", "severity": "low|medium|high|critical"}], "clean": true/false}'
        ELSE 'Placeholder template for {prompt_name}. Variables: {variables}.'
      END,
      CASE p.slug
        WHEN 'insight_generation_v1' THEN 'You are a behavioural intelligence expert operating within MetryxOne platform guidelines. Always produce developmental insights, never diagnostic ones.'
        WHEN 'recommendation_stage_v1' THEN 'You are a career development advisor. Never make hiring, promotion, or suitability predictions. Always frame recommendations developmentally.'
        WHEN 'evaluation_rubric_v1' THEN 'You are an AI quality evaluator. Be strict and objective. A score of 0.7 or above on all dimensions is required to pass.'
        WHEN 'hallucination_checker_v1' THEN 'You are an AI safety auditor. Flag any ungrounded claims conservatively — it is better to over-flag than under-flag.'
        ELSE 'System context for ' || p.name
      END,
      CASE p.slug
        WHEN 'insight_generation_v1' THEN ARRAY['{session_context}','{concern_domain}','{distress_signals}','{behaviour_dims}']
        WHEN 'recommendation_stage_v1' THEN ARRAY['{career_stage}','{strength_domains}','{gap_areas}','{prev_recommendations}']
        WHEN 'evaluation_rubric_v1' THEN ARRAY['{ai_output}','{original_context}']
        WHEN 'hallucination_checker_v1' THEN ARRAY['{ai_output}','{source_data}']
        ELSE ARRAY['{prompt_name}','{variables}']
      END,
      true,
      CASE p.slug
        WHEN 'insight_generation_v1' THEN 320
        WHEN 'recommendation_stage_v1' THEN 290
        WHEN 'evaluation_rubric_v1' THEN 280
        WHEN 'hallucination_checker_v1' THEN 300
        ELSE 50
      END,
      'Initial version'
    FROM aig_prompts p
    WHERE NOT EXISTS (
      SELECT 1 FROM aig_prompt_versions pv WHERE pv.prompt_id = p.id AND pv.version = 1
    )
  `);
}

// ── Audit helper (writes to existing gov_audit_framework) ────────────────────

export async function logAiGovernanceAudit(
  pool: Pool,
  actor: string,
  action: string,
  entityType: string,
  entityId: string | null,
  payload: Record<string, unknown>,
  outcome: 'success' | 'failure' | 'blocked' = 'success',
  ip?: string,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO gov_audit_framework (actor,action,entity_type,entity_id,domain,payload,ip_address,outcome)
       VALUES ($1,$2,$3,$4,'ai_governance',$5,$6,$7)`,
      [actor, action, entityType, entityId, JSON.stringify(payload), ip ?? null, outcome],
    );
  } catch { /* never throw — audit is best-effort */ }
}

// ── Rate limit helper (reuses gov_rate_limits) ───────────────────────────────

export async function checkAiRateLimit(
  pool: Pool,
  bucket: string,
  limitPerMinute: number,
): Promise<{ allowed: boolean; count: number }> {
  const window = new Date(Math.floor(Date.now() / 60000) * 60000).toISOString();
  const { rows } = await pool.query<{ count: number }>(
    `INSERT INTO gov_rate_limits (bucket,window_start,count) VALUES ($1,$2,1)
     ON CONFLICT (bucket,window_start) DO UPDATE SET count = gov_rate_limits.count + 1
     RETURNING count`,
    [bucket, window],
  );
  const count = rows[0]?.count ?? 1;
  return { allowed: count <= limitPerMinute, count };
}

// ── Hallucination check (rule-based, no AI call) ─────────────────────────────

export async function runHallucinationCheck(
  pool: Pool,
  text: string,
  runId?: string,
): Promise<{ score: number; flags: Array<{ pattern: string; severity: string; reason: string }> }> {
  const { rows: filters } = await pool.query<{
    pattern: string; filter_type: string; severity: string; filter_name: string;
  }>(
    `SELECT pattern, filter_type, severity, filter_name
     FROM aig_content_filters WHERE is_active AND scope IN ('output','both')`,
  );

  const flags: Array<{ pattern: string; severity: string; reason: string }> = [];
  for (const f of filters) {
    const matched = f.filter_type === 'regex'
      ? new RegExp(f.pattern, 'i').test(text)
      : text.toLowerCase().includes(f.pattern.toLowerCase());
    if (matched) {
      flags.push({ pattern: f.pattern, severity: f.severity, reason: f.filter_name });
      await pool.query(
        `UPDATE aig_content_filters SET match_count = match_count + 1 WHERE pattern = $1`,
        [f.pattern],
      ).catch(() => null);
    }
  }

  const severityWeight: Record<string, number> = { critical: 0.4, high: 0.25, medium: 0.15, low: 0.05 };
  const score = Math.min(1, flags.reduce((s, f) => s + (severityWeight[f.severity] ?? 0.1), 0));

  if (runId && flags.length > 0) {
    const maxSev = flags.reduce((m, f) => {
      const w = severityWeight[f.severity] ?? 0;
      return w > (severityWeight[m] ?? 0) ? f.severity : m;
    }, 'low');
    await pool.query(
      `INSERT INTO aig_hallucination_flags (run_id,detection_method,flagged_content,severity,confidence,reason,grounding_sources)
       VALUES ($1,'content_filter',$2,$3,$4,$5,'[]'::jsonb)`,
      [runId, text.slice(0, 500), maxSev, score, flags.map(f => f.reason).join('; ')],
    ).catch(() => null);
    await pool.query(
      `UPDATE aig_workflow_runs SET hallucination_score=$1 WHERE id=$2`,
      [score, runId],
    ).catch(() => null);
  }

  return { score, flags };
}

// ── Rule-based evaluator ─────────────────────────────────────────────────────

export async function runRuleBasedEvaluation(
  pool: Pool,
  output: string,
  context: Record<string, unknown>,
  runId?: string,
): Promise<{ overall: number; passed: boolean; scores: Record<string, number>; failure_reasons: string[] }> {
  const scores: Record<string, number> = {
    length_adequacy:    output.length >= 50 && output.length <= 3000 ? 1.0 : 0.4,
    non_empty:          output.trim().length > 0 ? 1.0 : 0.0,
    no_error_signals:   !/(error|exception|undefined|null|NaN)/i.test(output) ? 1.0 : 0.3,
    no_placeholder:     !/(TODO|FIXME|\{[a-z_]+\})/i.test(output) ? 1.0 : 0.2,
    developmental_tone: !/(diagnosis|disorder|hire|fire|promote|demote)/i.test(output) ? 1.0 : 0.0,
    json_valid:         (() => { try { JSON.parse(output); return 1.0; } catch { return 0.6; } })(),
  };
  const overall = Object.values(scores).reduce((s, v) => s + v, 0) / Object.keys(scores).length;
  const passed = overall >= 0.65;
  const failure_reasons = Object.entries(scores)
    .filter(([, v]) => v < 0.6)
    .map(([k]) => k.replace(/_/g, ' '));

  if (runId) {
    await pool.query(
      `INSERT INTO aig_evaluations (run_id,evaluator,rubric,dimension_scores,overall_score,passed,failure_reasons)
       VALUES ($1,'rule_based',$2::jsonb,$3::jsonb,$4,$5,$6)`,
      [runId, JSON.stringify({ type: 'rule_based', version: '1.0' }), JSON.stringify(scores), overall, passed, failure_reasons],
    ).catch(() => null);
    await pool.query(
      `UPDATE aig_workflow_runs SET evaluation_score=$1 WHERE id=$2`,
      [overall, runId],
    ).catch(() => null);
  }

  return { overall, passed, scores, failure_reasons };
}

// ── Monitoring metrics computation ───────────────────────────────────────────

export async function computeAiMonitoringMetrics(pool: Pool): Promise<number> {
  const now = new Date().toISOString();
  const period = 'hourly';

  const { rows: runStats } = await pool.query<{
    total: string; completed: string; failed: string;
    avg_duration: string; avg_tokens_input: string; avg_tokens_output: string; total_cost: string;
  }>(`
    SELECT
      COUNT(*)::text AS total,
      COUNT(*) FILTER (WHERE status='completed')::text AS completed,
      COUNT(*) FILTER (WHERE status='failed')::text AS failed,
      COALESCE(AVG(duration_ms),0)::text AS avg_duration,
      COALESCE(AVG(tokens_input),0)::text AS avg_tokens_input,
      COALESCE(AVG(tokens_output),0)::text AS avg_tokens_output,
      COALESCE(SUM(cost_usd),0)::text AS total_cost
    FROM aig_workflow_runs
    WHERE created_at > NOW() - INTERVAL '1 hour'
  `);
  const rs = runStats[0];

  const { rows: evalStats } = await pool.query<{ total: string; passed: string; avg_score: string }>(
    `SELECT COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE passed)::text AS passed,
            COALESCE(AVG(overall_score),0)::text AS avg_score
     FROM aig_evaluations WHERE evaluated_at > NOW() - INTERVAL '1 hour'`
  );
  const es = evalStats[0];

  const { rows: hallStats } = await pool.query<{ total: string; critical: string }>(
    `SELECT COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE severity='critical')::text AS critical
     FROM aig_hallucination_flags WHERE created_at > NOW() - INTERVAL '1 hour'`
  );
  const hs = hallStats[0];

  const { rows: filterStats } = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(match_count),0)::text AS total FROM aig_content_filters`
  );

  const total = Number(rs?.total ?? 0);
  const metrics: Array<[string, number, string]> = [
    ['workflow_runs_total',    total,                          'global'],
    ['workflow_runs_completed',Number(rs?.completed ?? 0),    'global'],
    ['workflow_runs_failed',   Number(rs?.failed ?? 0),        'global'],
    ['workflow_error_rate',    total > 0 ? Number(rs?.failed ?? 0) / total : 0, 'global'],
    ['avg_duration_ms',        Number(rs?.avg_duration ?? 0),  'global'],
    ['avg_tokens_input',       Number(rs?.avg_tokens_input ?? 0), 'global'],
    ['avg_tokens_output',      Number(rs?.avg_tokens_output ?? 0), 'global'],
    ['hourly_cost_usd',        Number(rs?.total_cost ?? 0),    'global'],
    ['eval_pass_rate',         Number(es?.total ?? 0) > 0 ? Number(es?.passed ?? 0) / Number(es?.total ?? 1) : 0, 'global'],
    ['eval_avg_score',         Number(es?.avg_score ?? 0),     'global'],
    ['hallucination_flags',    Number(hs?.total ?? 0),          'global'],
    ['hallucination_critical', Number(hs?.critical ?? 0),       'global'],
    ['hallucination_rate',     total > 0 ? Number(hs?.total ?? 0) / total : 0, 'global'],
    ['content_filter_matches', Number(filterStats[0]?.total ?? 0), 'global'],
  ];

  for (const [name, value, dim] of metrics) {
    await pool.query(
      `INSERT INTO aig_monitoring_metrics (metric_name,metric_value,dimension,period,recorded_at)
       VALUES ($1,$2,$3,$4,$5)`,
      [name, value, dim, period, now],
    ).catch(() => null);
  }

  return metrics.length;
}

// ── Dashboard summary ────────────────────────────────────────────────────────

export interface AiGovernanceSummary {
  prompts:       { total: number; active: number; draft: number };
  models:        { total: number; available: number; default_model: string | null };
  workflows:     { total: number; active: number; runs_today: number; error_rate: number };
  rules:         { insight_active: number; recommendation_active: number };
  safety:        { flags_pending: number; flags_critical: number; eval_pass_rate: number };
  monitoring:    { hourly_cost_usd: number; total_tokens_today: number };
  audit:         { actions_today: number };
  policies:      { total: number; active: number };
}

export async function computeAiGovernanceSummary(pool: Pool): Promise<AiGovernanceSummary> {
  const [prompts, models, workflows, runsToday, rules, safety, monitoring, audit, policies] = await Promise.all([
    pool.query<{ total: string; active: string; draft: string }>(
      `SELECT COUNT(*)::text AS total,
              COUNT(*) FILTER (WHERE status='active')::text AS active,
              COUNT(*) FILTER (WHERE status='draft')::text AS draft
       FROM aig_prompts`),
    pool.query<{ total: string; available: string; default_name: string }>(
      `SELECT COUNT(*)::text AS total,
              COUNT(*) FILTER (WHERE status='available')::text AS available,
              MAX(model_name) FILTER (WHERE is_default) AS default_name
       FROM aig_models`),
    pool.query<{ total: string; active: string }>(
      `SELECT COUNT(*)::text AS total,
              COUNT(*) FILTER (WHERE status='active')::text AS active
       FROM aig_ai_workflows`),
    pool.query<{ runs: string; failed: string; tokens: string; cost: string }>(
      `SELECT COUNT(*)::text AS runs,
              COUNT(*) FILTER (WHERE status='failed')::text AS failed,
              COALESCE(SUM(tokens_input+tokens_output),0)::text AS tokens,
              COALESCE(SUM(cost_usd),0)::text AS cost
       FROM aig_workflow_runs WHERE created_at > NOW()-INTERVAL '24 hours'`),
    pool.query<{ ir: string; rr: string }>(
      `SELECT (SELECT COUNT(*) FROM aig_insight_rules WHERE is_active)::text AS ir,
              (SELECT COUNT(*) FROM aig_recommendation_rules WHERE is_active)::text AS rr`),
    pool.query<{ pending: string; critical: string; pass_rate: string }>(
      `SELECT (SELECT COUNT(*) FROM aig_hallucination_flags WHERE review_status='pending')::text AS pending,
              (SELECT COUNT(*) FROM aig_hallucination_flags WHERE severity='critical' AND review_status='pending')::text AS critical,
              COALESCE((SELECT AVG(overall_score)*100 FROM aig_evaluations WHERE evaluated_at > NOW()-INTERVAL '24 hours'),0)::text AS pass_rate`),
    pool.query<{ cost: string; tokens: string }>(
      `SELECT COALESCE(SUM(cost_usd),0)::text AS cost,
              COALESCE(SUM(tokens_input+tokens_output),0)::text AS tokens
       FROM aig_workflow_runs WHERE created_at > NOW()-INTERVAL '1 hour'`),
    pool.query<{ actions: string }>(
      `SELECT COUNT(*)::text AS actions FROM gov_audit_framework
       WHERE domain='ai_governance' AND ts > NOW()-INTERVAL '24 hours'`),
    pool.query<{ total: string; active: string }>(
      `SELECT COUNT(*)::text AS total, COUNT(*) FILTER (WHERE is_active)::text AS active
       FROM aig_governance_policies`),
  ]);

  const rd = runsToday.rows[0];
  const runsN  = Number(rd?.runs ?? 0);
  const failed = Number(rd?.failed ?? 0);

  return {
    prompts:    { total: Number(prompts.rows[0]?.total ?? 0), active: Number(prompts.rows[0]?.active ?? 0), draft: Number(prompts.rows[0]?.draft ?? 0) },
    models:     { total: Number(models.rows[0]?.total ?? 0), available: Number(models.rows[0]?.available ?? 0), default_model: models.rows[0]?.default_name ?? null },
    workflows:  { total: Number(workflows.rows[0]?.total ?? 0), active: Number(workflows.rows[0]?.active ?? 0), runs_today: runsN, error_rate: runsN > 0 ? failed / runsN : 0 },
    rules:      { insight_active: Number(rules.rows[0]?.ir ?? 0), recommendation_active: Number(rules.rows[0]?.rr ?? 0) },
    safety:     { flags_pending: Number(safety.rows[0]?.pending ?? 0), flags_critical: Number(safety.rows[0]?.critical ?? 0), eval_pass_rate: Number(safety.rows[0]?.pass_rate ?? 0) },
    monitoring: { hourly_cost_usd: Number(monitoring.rows[0]?.cost ?? 0), total_tokens_today: Number(rd?.tokens ?? 0) },
    audit:      { actions_today: Number(audit.rows[0]?.actions ?? 0) },
    policies:   { total: Number(policies.rows[0]?.total ?? 0), active: Number(policies.rows[0]?.active ?? 0) },
  };
}
