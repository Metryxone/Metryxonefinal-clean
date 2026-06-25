import type { Pool } from 'pg';
import { computeBenchmarkForReport } from './benchmark-engine';
import { resolveVizData } from './viz-data-resolver';

// ── Types ──────────────────────────────────────────────────────────────────

export type ReportType = 'capadex' | 'career' | 'competency' | 'employability' | 'employer' | 'passport' | 'enterprise_workforce' | 'outcome' | 'custom';
export type SectionType = 'header' | 'narrative' | 'insight' | 'chart' | 'benchmark' | 'table' | 'score' | 'footer' | 'custom';
export type ChartType = 'bar' | 'line' | 'radar' | 'gauge' | 'donut' | 'scatter' | 'heatmap' | 'funnel' | 'waterfall';
export type BenchmarkType = 'peer' | 'industry' | 'national' | 'institutional' | 'custom';
export type InsightSeverity = 'positive' | 'info' | 'warning' | 'critical';
export type ExportFormat = 'pdf' | 'csv' | 'json' | 'xlsx';
export type ReportStatus = 'pending' | 'generating' | 'complete' | 'failed';
export type ExportStatus = 'queued' | 'processing' | 'done' | 'failed';
export type NarrativeTone = 'professional' | 'empathetic' | 'developmental' | 'clinical' | 'motivational';
export type ConditionType = 'threshold' | 'range' | 'comparison' | 'pattern' | 'composite' | 'presence';

// ── DDL ────────────────────────────────────────────────────────────────────

const DDL = `
-- 1. Report Templates
CREATE TABLE IF NOT EXISTS rf_templates (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  report_type     TEXT NOT NULL DEFAULT 'custom',
  description     TEXT,
  layout          JSONB NOT NULL DEFAULT '{"orientation":"portrait","page_size":"A4","margin":"normal"}',
  version         INT NOT NULL DEFAULT 1,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  is_default      BOOLEAN NOT NULL DEFAULT false,
  tenant_id       TEXT,
  language        TEXT NOT NULL DEFAULT 'en',
  tags            TEXT[] DEFAULT '{}',
  thumbnail_url   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Template Sections
CREATE TABLE IF NOT EXISTS rf_template_sections (
  id              SERIAL PRIMARY KEY,
  template_id     INT NOT NULL REFERENCES rf_templates(id) ON DELETE CASCADE,
  section_key     TEXT NOT NULL,
  section_type    TEXT NOT NULL DEFAULT 'custom',
  title           TEXT,
  subtitle        TEXT,
  config          JSONB NOT NULL DEFAULT '{}',
  order_index     INT NOT NULL DEFAULT 0,
  is_required     BOOLEAN NOT NULL DEFAULT false,
  is_visible      BOOLEAN NOT NULL DEFAULT true,
  conditions      JSONB NOT NULL DEFAULT '{}',
  width           TEXT NOT NULL DEFAULT 'full',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS rf_template_sections_template_id_idx ON rf_template_sections(template_id);

-- 3. Narrative Blocks
CREATE TABLE IF NOT EXISTS rf_narrative_blocks (
  id              SERIAL PRIMARY KEY,
  block_key       TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  variables       JSONB NOT NULL DEFAULT '[]',
  report_types    TEXT[] NOT NULL DEFAULT '{}',
  tone            TEXT NOT NULL DEFAULT 'professional',
  language        TEXT NOT NULL DEFAULT 'en',
  category        TEXT NOT NULL DEFAULT 'general',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  usage_count     INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS rf_narrative_blocks_report_types_idx ON rf_narrative_blocks USING gin(report_types);

-- 4. Insight Rules
CREATE TABLE IF NOT EXISTS rf_insight_rules (
  id              SERIAL PRIMARY KEY,
  rule_key        TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  description     TEXT,
  condition_type  TEXT NOT NULL DEFAULT 'threshold',
  condition       JSONB NOT NULL,
  insight_template TEXT NOT NULL,
  variables       JSONB NOT NULL DEFAULT '[]',
  severity        TEXT NOT NULL DEFAULT 'info',
  priority        INT NOT NULL DEFAULT 50,
  report_types    TEXT[] NOT NULL DEFAULT '{}',
  data_source     TEXT NOT NULL DEFAULT 'any',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  fire_count      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS rf_insight_rules_report_types_idx ON rf_insight_rules USING gin(report_types);

-- 5. Visualization Configs
CREATE TABLE IF NOT EXISTS rf_visualization_configs (
  id              SERIAL PRIMARY KEY,
  config_key      TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  description     TEXT,
  chart_type      TEXT NOT NULL DEFAULT 'bar',
  data_source     TEXT NOT NULL DEFAULT 'custom',
  data_binding    JSONB NOT NULL DEFAULT '{}',
  style_config    JSONB NOT NULL DEFAULT '{}',
  dimensions      JSONB NOT NULL DEFAULT '[]',
  color_palette   TEXT[] DEFAULT '{}',
  report_types    TEXT[] NOT NULL DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Benchmark Configs
CREATE TABLE IF NOT EXISTS rf_benchmark_configs (
  id              SERIAL PRIMARY KEY,
  config_key      TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  description     TEXT,
  benchmark_type  TEXT NOT NULL DEFAULT 'peer',
  cohort_definition JSONB NOT NULL DEFAULT '{}',
  metrics         TEXT[] NOT NULL DEFAULT '{}',
  aggregations    JSONB NOT NULL DEFAULT '{"mean":true,"median":true,"p25":true,"p75":true}',
  percentile_bands JSONB NOT NULL DEFAULT '{"top10":90,"top25":75,"bottom25":25}',
  min_cohort_size INT NOT NULL DEFAULT 30,
  display_format  TEXT NOT NULL DEFAULT 'percentile',
  report_types    TEXT[] NOT NULL DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. White Label Configs
CREATE TABLE IF NOT EXISTS rf_white_label_configs (
  id              SERIAL PRIMARY KEY,
  tenant_id       TEXT NOT NULL UNIQUE,
  org_name        TEXT NOT NULL,
  logo_url        TEXT,
  favicon_url     TEXT,
  primary_color   TEXT NOT NULL DEFAULT '#6366f1',
  secondary_color TEXT NOT NULL DEFAULT '#8b5cf6',
  accent_color    TEXT NOT NULL DEFAULT '#10b981',
  text_color      TEXT NOT NULL DEFAULT '#111827',
  font_family     TEXT NOT NULL DEFAULT 'Inter, sans-serif',
  report_header   TEXT,
  report_footer   TEXT,
  custom_css      TEXT,
  allowed_report_types TEXT[] DEFAULT '{}',
  contact_email   TEXT,
  privacy_url     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Language Packs
CREATE TABLE IF NOT EXISTS rf_language_packs (
  id              SERIAL PRIMARY KEY,
  language_code   TEXT NOT NULL UNIQUE,
  language_name   TEXT NOT NULL,
  native_name     TEXT NOT NULL,
  translations    JSONB NOT NULL DEFAULT '{}',
  report_types    TEXT[] NOT NULL DEFAULT '{}',
  completeness_pct INT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT false,
  is_default      BOOLEAN NOT NULL DEFAULT false,
  rtl             BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Generated Reports
CREATE TABLE IF NOT EXISTS rf_generated_reports (
  id              SERIAL PRIMARY KEY,
  report_uuid     UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  template_id     INT REFERENCES rf_templates(id) ON DELETE SET NULL,
  user_id         TEXT,
  session_id      TEXT,
  report_type     TEXT NOT NULL DEFAULT 'custom',
  data_snapshot   JSONB NOT NULL DEFAULT '{}',
  generated_content JSONB NOT NULL DEFAULT '{}',
  narrative_texts JSONB NOT NULL DEFAULT '{}',
  insights        JSONB NOT NULL DEFAULT '[]',
  language        TEXT NOT NULL DEFAULT 'en',
  tenant_id       TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  error_message   TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS rf_generated_reports_user_id_idx    ON rf_generated_reports(user_id);
CREATE INDEX IF NOT EXISTS rf_generated_reports_report_type_idx ON rf_generated_reports(report_type);
CREATE INDEX IF NOT EXISTS rf_generated_reports_status_idx      ON rf_generated_reports(status);

-- 10. Export Jobs
CREATE TABLE IF NOT EXISTS rf_export_jobs (
  id              SERIAL PRIMARY KEY,
  job_uuid        UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  report_id       INT REFERENCES rf_generated_reports(id) ON DELETE CASCADE,
  format          TEXT NOT NULL DEFAULT 'pdf',
  status          TEXT NOT NULL DEFAULT 'queued',
  config          JSONB NOT NULL DEFAULT '{}',
  output_url      TEXT,
  file_size_bytes BIGINT,
  page_count      INT,
  error_message   TEXT,
  requested_by    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS rf_export_jobs_report_id_idx ON rf_export_jobs(report_id);
CREATE INDEX IF NOT EXISTS rf_export_jobs_status_idx    ON rf_export_jobs(status);
`;

// ── Schema initialisation ──────────────────────────────────────────────────

let schemaReady = false;

export async function ensureReportFactorySchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  try {
    await pool.query(DDL);
    await seedDefaults(pool);
    // Idempotent backfill: any already-seeded Employability template whose headline
    // gauge still points at the career-readiness viz must be re-pointed at the
    // dedicated EI gauge so the lead chart reflects the actual Employability Index.
    await pool.query(
      `UPDATE rf_template_sections s
          SET config = jsonb_set(s.config, '{viz_key}', '"employability_gauge"')
         FROM rf_templates t
        WHERE s.template_id = t.id
          AND t.report_type = 'employability'
          AND s.section_key = 'ei_gauge'
          AND s.config->>'viz_key' = 'readiness_gauge'`,
    ).catch((e) => console.error('[ReportFactory] ei_gauge backfill skipped:', e));
    schemaReady = true;
  } catch (e) {
    console.error('[ReportFactory] schema init error:', e);
    throw e;
  }
}

// ── Default seed data ──────────────────────────────────────────────────────

async function seedDefaults(pool: Pool): Promise<void> {
  await seedLanguages(pool);
  await seedNarrativeBlocks(pool);
  await seedInsightRules(pool);
  await seedVisualizationConfigs(pool);
  await seedBenchmarkConfigs(pool);
  await seedDefaultTemplates(pool);
}

// Language packs seed
async function seedLanguages(pool: Pool): Promise<void> {
  const langs = [
    { code: 'en', name: 'English', native: 'English', rtl: false, is_default: true, pct: 100 },
    { code: 'hi', name: 'Hindi', native: 'हिन्दी', rtl: false, is_default: false, pct: 0 },
    { code: 'ta', name: 'Tamil', native: 'தமிழ்', rtl: false, is_default: false, pct: 0 },
    { code: 'te', name: 'Telugu', native: 'తెలుగు', rtl: false, is_default: false, pct: 0 },
    { code: 'bn', name: 'Bengali', native: 'বাংলা', rtl: false, is_default: false, pct: 0 },
    { code: 'mr', name: 'Marathi', native: 'मराठी', rtl: false, is_default: false, pct: 0 },
    { code: 'ar', name: 'Arabic', native: 'العربية', rtl: true, is_default: false, pct: 0 },
    { code: 'fr', name: 'French', native: 'Français', rtl: false, is_default: false, pct: 0 },
    { code: 'de', name: 'German', native: 'Deutsch', rtl: false, is_default: false, pct: 0 },
  ];
  for (const l of langs) {
    await pool.query(
      `INSERT INTO rf_language_packs (language_code,language_name,native_name,rtl,is_default,completeness_pct,is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (language_code) DO NOTHING`,
      [l.code, l.name, l.native, l.rtl, l.is_default, l.pct, l.is_default],
    );
  }
}

// Narrative blocks seed
async function seedNarrativeBlocks(pool: Pool): Promise<void> {
  const blocks = [
    {
      key: 'report_intro_capadex', title: 'CAPADEX Report Introduction',
      content: 'This report presents the results of {{name}}\'s CAPADEX Behavioural Intelligence Assessment. The assessment was completed on {{date}} and covers {{concern_count}} areas of concern across {{domain_count}} developmental domains.',
      variables: ['name','date','concern_count','domain_count'],
      report_types: ['capadex'], tone: 'professional', category: 'introduction',
    },
    {
      key: 'report_intro_career', title: 'Career Readiness Introduction',
      content: '{{name}}\'s Career Readiness Profile has been compiled from multiple data sources including assessments, competency evaluations, and behavioural signals. The overall readiness score stands at {{score}} out of 100.',
      variables: ['name','score'],
      report_types: ['career'], tone: 'professional', category: 'introduction',
    },
    {
      key: 'report_intro_competency', title: 'Competency Assessment Introduction',
      content: 'The following report details the competency assessment results for {{name}}. Across {{framework_name}}, {{competency_count}} competencies were evaluated covering {{domain_count}} domains.',
      variables: ['name','framework_name','competency_count','domain_count'],
      report_types: ['competency'], tone: 'professional', category: 'introduction',
    },
    {
      key: 'strength_narrative', title: 'Strengths Narrative',
      content: '{{name}} demonstrates notable strengths in {{top_strength_1}} and {{top_strength_2}}. These capabilities position them well for roles requiring {{strength_application}}.',
      variables: ['name','top_strength_1','top_strength_2','strength_application'],
      report_types: ['capadex','career','competency'], tone: 'developmental', category: 'strengths',
    },
    {
      key: 'growth_narrative', title: 'Growth Opportunity Narrative',
      content: 'Key areas for focused development include {{growth_area_1}} and {{growth_area_2}}. Targeted interventions in these areas are likely to yield the most significant improvement in overall readiness.',
      variables: ['name','growth_area_1','growth_area_2'],
      report_types: ['capadex','career','competency'], tone: 'developmental', category: 'growth',
    },
    {
      key: 'readiness_summary', title: 'Readiness Summary',
      content: 'Based on the comprehensive assessment data, {{name}} is assessed at the {{readiness_level}} readiness tier. This reflects {{readiness_description}} across the evaluated dimensions.',
      variables: ['name','readiness_level','readiness_description'],
      report_types: ['career','employability'], tone: 'professional', category: 'summary',
    },
    {
      key: 'report_intro_employability', title: 'Employability Index Introduction',
      content: 'This report presents {{name}}\'s Employability Index, a composite developmental signal compiled from the underlying competency profile and behavioural assessment data. The index currently stands at {{ei_score}} out of 100, with measured coverage across {{coverage_pct}}% of the evaluated dimensions. Coverage (how much data exists) and confidence (how trustworthy that data is) are reported separately and never blended.',
      variables: ['name','ei_score','coverage_pct'],
      report_types: ['employability'], tone: 'professional', category: 'introduction',
    },
    {
      key: 'intervention_recommendation', title: 'Intervention Recommendation',
      content: 'The following interventions are recommended based on the assessment findings: {{intervention_list}}. These are prioritised by potential impact and alignment with {{name}}\'s stated goals.',
      variables: ['name','intervention_list'],
      report_types: ['capadex','career'], tone: 'developmental', category: 'recommendations',
    },
    {
      key: 'report_footer_standard', title: 'Standard Report Footer',
      content: 'This report has been generated by MetryxOne\'s Behavioural Intelligence Engine. All assessments are developmental tools and should not be used for hiring or promotional decisions. Report generated on {{generated_date}}.',
      variables: ['generated_date'],
      report_types: ['capadex','career','competency','employability','employer'], tone: 'professional', category: 'footer',
    },
    {
      key: 'report_intro_employer', title: 'Employer Match Introduction',
      content: 'This Employer Match report summarises the competency alignment between {{name}} and the target role. Match strength reflects developmental fit across the evaluated competencies and is a decision-support signal only — never a hiring or suitability prediction.',
      variables: ['name'],
      report_types: ['employer'], tone: 'professional', category: 'introduction',
    },
    {
      key: 'employer_match_summary', title: 'Employer Match Summary',
      content: 'Across the evaluated competencies, {{name}} shows an overall match of {{score}} against the role profile. Strengths and development areas below are provided to support a holistic, evidence-based review.',
      variables: ['name','score'],
      report_types: ['employer'], tone: 'professional', category: 'summary',
    },
    {
      key: 'passport_summary', title: 'Career Passport Summary',
      content: '{{name}}\'s Career Passport reflects {{section_count}} active sections with a completeness score of {{completeness}}%. {{verified_count}} items have been independently verified, lending credibility to the documented achievements.',
      variables: ['name','section_count','completeness','verified_count'],
      report_types: ['passport'], tone: 'professional', category: 'summary',
    },
    {
      key: 'empathetic_opener', title: 'Empathetic Opening',
      content: 'Understanding your unique strengths and areas for growth is a meaningful step in your journey. This report has been crafted to provide you with clear, actionable insights tailored to where you are right now.',
      variables: [],
      report_types: ['capadex','career'], tone: 'empathetic', category: 'introduction',
    },
    {
      key: 'report_intro_enterprise_workforce', title: 'Enterprise Workforce Introduction',
      content: 'This Enterprise Workforce report summarises aggregate competency readiness across {{department_count}} departments covering {{employee_count}} employees. All figures are aggregate-only and suppressed below a cohort of {{k_min}} to preserve individual privacy.',
      variables: ['department_count','employee_count','k_min'],
      report_types: ['enterprise_workforce'], tone: 'professional', category: 'introduction',
    },
    {
      key: 'enterprise_workforce_summary', title: 'Enterprise Workforce Summary',
      content: 'Across the measurable cohort, aggregate readiness stands at {{aggregate_readiness}}. Department-level coverage and confidence are reported separately; cohorts below the privacy threshold are withheld rather than estimated.',
      variables: ['aggregate_readiness'],
      report_types: ['enterprise_workforce'], tone: 'professional', category: 'summary',
    },
    {
      key: 'report_intro_outcome', title: 'Outcome Intelligence Introduction',
      content: 'This Outcome report consolidates realised outcomes (hiring, performance, promotion, retention, career, and learning) into one developmental picture. Coverage (outcome types observed) and Confidence (calibration against realised results) are reported as separate axes and never blended.',
      variables: [],
      report_types: ['outcome'], tone: 'professional', category: 'introduction',
    },
    {
      key: 'outcome_summary', title: 'Outcome Intelligence Summary',
      content: 'Realised-outcome coverage is {{realized_coverage}}. Confidence is {{confidence_state}}; where fewer than {{k_min}} realised outcomes exist, the report abstains rather than projecting an unsupported figure.',
      variables: ['realized_coverage','confidence_state','k_min'],
      report_types: ['outcome'], tone: 'professional', category: 'summary',
    },
  ];
  for (const b of blocks) {
    await pool.query(
      `INSERT INTO rf_narrative_blocks (block_key,title,content,variables,report_types,tone,category)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (block_key) DO NOTHING`,
      [b.key, b.title, b.content, JSON.stringify(b.variables), b.report_types, b.tone, b.category],
    );
  }
}

// Insight rules seed
async function seedInsightRules(pool: Pool): Promise<void> {
  const rules = [
    {
      key: 'high_readiness', title: 'High Readiness',
      condition_type: 'threshold', condition: { field: 'readiness_score', operator: '>=', value: 75 },
      template: '{{name}} has achieved a high readiness score of {{score}}, placing them in the top tier of assessed individuals.',
      variables: ['name','score'], severity: 'positive', priority: 90,
      report_types: ['career','employability'], data_source: 'career',
    },
    {
      key: 'low_readiness', title: 'Low Readiness Alert',
      condition_type: 'threshold', condition: { field: 'readiness_score', operator: '<', value: 40 },
      template: 'The readiness score of {{score}} indicates significant development opportunities. Structured intervention is recommended.',
      variables: ['score'], severity: 'warning', priority: 85,
      report_types: ['career','employability'], data_source: 'career',
    },
    {
      key: 'competency_gap', title: 'Competency Gap Detected',
      condition_type: 'threshold', condition: { field: 'gap_score', operator: '>', value: 20 },
      template: 'A competency gap of {{gap_score}} points has been identified in {{competency_area}}. This represents a priority development target.',
      variables: ['gap_score','competency_area'], severity: 'warning', priority: 80,
      report_types: ['competency'], data_source: 'competency',
    },
    {
      key: 'strong_competency', title: 'Strong Competency',
      condition_type: 'threshold', condition: { field: 'competency_score', operator: '>=', value: 80 },
      template: '{{name}} demonstrates exceptional proficiency in {{competency_name}} ({{score}}/100), which is a confirmed strength.',
      variables: ['name','competency_name','score'], severity: 'positive', priority: 70,
      report_types: ['competency'], data_source: 'competency',
    },
    {
      key: 'behavioural_concern', title: 'Behavioural Concern Flagged',
      condition_type: 'presence', condition: { field: 'active_concerns', operator: '>', value: 3 },
      template: '{{concern_count}} active behavioural concerns have been identified. The highest priority areas are {{top_concern_1}} and {{top_concern_2}}.',
      variables: ['concern_count','top_concern_1','top_concern_2'], severity: 'warning', priority: 88,
      report_types: ['capadex'], data_source: 'capadex',
    },
    {
      key: 'passport_strong', title: 'Strong Passport Profile',
      condition_type: 'threshold', condition: { field: 'passport_completeness', operator: '>=', value: 70 },
      template: 'Career Passport completeness of {{completeness}}% with {{verified_count}} verified items reflects a well-documented professional profile.',
      variables: ['completeness','verified_count'], severity: 'positive', priority: 65,
      report_types: ['passport'], data_source: 'passport',
    },
    {
      key: 'missing_certifications', title: 'No Certifications on Record',
      condition_type: 'threshold', condition: { field: 'certification_count', operator: '=', value: 0 },
      template: 'No certifications are currently recorded. Adding industry-recognised certifications would strengthen the profile.',
      variables: [], severity: 'info', priority: 40,
      report_types: ['passport','career'], data_source: 'passport',
    },
    {
      key: 'benchmark_above_peer', title: 'Above Peer Benchmark',
      condition_type: 'comparison', condition: { field: 'score', operator: '>', comparison_field: 'peer_median' },
      template: 'The overall score of {{score}} exceeds the peer group median of {{peer_median}}, placing {{name}} in the {{percentile}}th percentile.',
      variables: ['score','peer_median','name','percentile'], severity: 'positive', priority: 75,
      report_types: ['career','competency'], data_source: 'any',
    },
    {
      key: 'employer_strong_match', title: 'Strong Role Match',
      condition_type: 'threshold', condition: { field: 'score', operator: '>=', value: 75 },
      template: 'An overall match of {{score}} indicates strong competency alignment with the role profile. This is a developmental decision-support signal, not a hiring recommendation.',
      variables: ['score'], severity: 'positive', priority: 72,
      report_types: ['employer'], data_source: 'any',
    },
    {
      key: 'workforce_cohort_suppressed', title: 'Cohort Below Privacy Threshold',
      condition_type: 'threshold', condition: { field: 'cohort_size', operator: '<', value: 30 },
      template: 'One or more departments fall below the privacy threshold of {{k_min}} and have been withheld from the aggregate rather than estimated.',
      variables: ['k_min'], severity: 'info', priority: 50,
      report_types: ['enterprise_workforce'], data_source: 'any',
    },
    {
      key: 'outcome_abstained', title: 'Outcome Evidence Insufficient',
      condition_type: 'threshold', condition: { field: 'realized_outcomes', operator: '<', value: 30 },
      template: 'Fewer than {{k_min}} realised outcomes are on record, so outcome confidence abstains. Coverage is reported, but no calibrated accuracy claim is made.',
      variables: ['k_min'], severity: 'info', priority: 55,
      report_types: ['outcome'], data_source: 'any',
    },
  ];
  for (const r of rules) {
    await pool.query(
      `INSERT INTO rf_insight_rules (rule_key,title,condition_type,condition,insight_template,variables,severity,priority,report_types,data_source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (rule_key) DO NOTHING`,
      [r.key, r.title, r.condition_type, JSON.stringify(r.condition), r.template,
       JSON.stringify(r.variables), r.severity, r.priority, r.report_types, r.data_source],
    );
  }
}

// Visualization configs seed
async function seedVisualizationConfigs(pool: Pool): Promise<void> {
  const configs = [
    {
      key: 'competency_radar', title: 'Competency Radar Chart',
      chart_type: 'radar', data_source: 'competency',
      data_binding: { labels_field: 'competency_names', values_field: 'scores', max_value: 100 },
      style_config: { fill: true, fill_opacity: 0.2, point_radius: 4 },
      dimensions: ['competency_name', 'score', 'target_score'],
      report_types: ['competency'],
    },
    {
      key: 'readiness_gauge', title: 'Readiness Score Gauge',
      chart_type: 'gauge', data_source: 'career',
      data_binding: { value_field: 'readiness_score', min: 0, max: 100 },
      style_config: { thresholds: [{ value: 40, color: '#ef4444' }, { value: 70, color: '#f59e0b' }, { value: 100, color: '#10b981' }] },
      dimensions: ['readiness_score'],
      report_types: ['career', 'employability'],
    },
    {
      key: 'employability_gauge', title: 'Employability Index Gauge',
      chart_type: 'gauge', data_source: 'employability',
      data_binding: { value_field: 'ei_score', min: 0, max: 100 },
      style_config: { thresholds: [{ value: 40, color: '#ef4444' }, { value: 70, color: '#f59e0b' }, { value: 100, color: '#10b981' }] },
      dimensions: ['ei_score'],
      report_types: ['employability'],
    },
    {
      key: 'domain_bar', title: 'Domain Score Bar Chart',
      chart_type: 'bar', data_source: 'capadex',
      data_binding: { labels_field: 'domain_names', values_field: 'domain_scores', orientation: 'horizontal' },
      style_config: { bar_radius: 4, color_by_value: true },
      dimensions: ['domain_name', 'score'],
      report_types: ['capadex'],
    },
    {
      key: 'benchmark_percentile', title: 'Peer Benchmark Percentile',
      chart_type: 'bar', data_source: 'any',
      data_binding: { show_distribution: true, highlight_user: true },
      style_config: { user_color: '#6366f1', peer_color: '#e5e7eb' },
      dimensions: ['score', 'peer_median', 'percentile'],
      report_types: ['career', 'competency'],
    },
    {
      key: 'passport_donut', title: 'Passport Section Completeness',
      chart_type: 'donut', data_source: 'passport',
      data_binding: { labels_field: 'section_names', values_field: 'section_counts' },
      style_config: { hole_size: 0.65, show_legend: true },
      dimensions: ['section_name', 'item_count'],
      report_types: ['passport'],
    },
    {
      key: 'skills_heatmap', title: 'Skills Coverage Heatmap',
      chart_type: 'heatmap', data_source: 'competency',
      data_binding: { x_field: 'category', y_field: 'level', value_field: 'count' },
      style_config: { color_scale: ['#eef2ff', '#6366f1'] },
      dimensions: ['category', 'proficiency_level', 'count'],
      report_types: ['competency', 'career'],
    },
    {
      key: 'trend_line', title: 'Score Trend Line',
      chart_type: 'line', data_source: 'career',
      data_binding: { x_field: 'snapshot_date', y_field: 'score', series: ['readiness', 'competency', 'behaviour'] },
      style_config: { smooth: true, show_points: true, area_fill: false },
      dimensions: ['date', 'score', 'series'],
      report_types: ['career', 'employability'],
    },
    {
      key: 'employer_match_bar', title: 'Employer Match Benchmark',
      chart_type: 'bar', data_source: 'any',
      data_binding: { show_distribution: true, highlight_user: true },
      style_config: { user_color: '#344E86', peer_color: '#e5e7eb' },
      dimensions: ['score', 'peer_median', 'percentile'],
      report_types: ['employer'],
    },
    {
      key: 'workforce_department_bar', title: 'Department Readiness (Aggregate)',
      chart_type: 'bar', data_source: 'any',
      data_binding: { labels_field: 'department_names', values_field: 'aggregate_readiness', orientation: 'horizontal', suppress_below: 30 },
      style_config: { bar_radius: 4, color_by_value: true },
      dimensions: ['department_name', 'aggregate_readiness', 'cohort_size'],
      report_types: ['enterprise_workforce'],
    },
    {
      key: 'outcome_coverage_donut', title: 'Realised Outcome Coverage',
      chart_type: 'donut', data_source: 'any',
      data_binding: { labels_field: 'outcome_types', values_field: 'outcome_counts' },
      style_config: { hole_size: 0.65, show_legend: true },
      dimensions: ['outcome_type', 'count'],
      report_types: ['outcome'],
    },
  ];
  for (const c of configs) {
    await pool.query(
      `INSERT INTO rf_visualization_configs (config_key,title,chart_type,data_source,data_binding,style_config,dimensions,report_types)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (config_key) DO NOTHING`,
      [c.key, c.title, c.chart_type, c.data_source,
       JSON.stringify(c.data_binding), JSON.stringify(c.style_config),
       JSON.stringify(c.dimensions), c.report_types],
    );
  }
}

// Benchmark configs seed
async function seedBenchmarkConfigs(pool: Pool): Promise<void> {
  const configs = [
    {
      key: 'peer_career_readiness', title: 'Peer Career Readiness Benchmark',
      benchmark_type: 'peer', metrics: ['readiness_score', 'competency_score', 'behaviour_score'],
      cohort: { same_age_band: true, same_education_level: true, same_domain: false },
      report_types: ['career', 'employability'],
    },
    {
      key: 'industry_competency', title: 'Industry Competency Benchmark',
      benchmark_type: 'industry', metrics: ['competency_score', 'gap_score'],
      cohort: { same_industry: true, same_role_family: true },
      report_types: ['competency'],
    },
    {
      key: 'national_behavioural', title: 'National Behavioural Benchmark',
      benchmark_type: 'national', metrics: ['behaviour_score', 'concern_count', 'intervention_readiness'],
      cohort: { same_persona: true, same_age_band: true },
      report_types: ['capadex'],
    },
    {
      key: 'institutional_passport', title: 'Institutional Passport Benchmark',
      benchmark_type: 'institutional', metrics: ['completeness_score', 'strength_score', 'verified_count'],
      cohort: { same_institution: true, same_programme: false },
      report_types: ['passport'],
    },
  ];
  for (const c of configs) {
    await pool.query(
      `INSERT INTO rf_benchmark_configs (config_key,title,benchmark_type,cohort_definition,metrics,report_types)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (config_key) DO NOTHING`,
      [c.key, c.title, c.benchmark_type, JSON.stringify(c.cohort), c.metrics, c.report_types],
    );
  }
}

// Default templates seed
async function seedDefaultTemplates(pool: Pool): Promise<void> {
  const templates = [
    {
      name: 'CAPADEX Behavioural Report',
      report_type: 'capadex',
      description: 'Standard behavioural intelligence report for CAPADEX assessment sessions',
      sections: [
        { key: 'header', type: 'header', title: 'Report Header', order: 0, required: true },
        { key: 'intro', type: 'narrative', title: 'Introduction', order: 1, config: { block_key: 'report_intro_capadex' }, required: true },
        { key: 'domain_chart', type: 'chart', title: 'Domain Scores', order: 2, config: { viz_key: 'domain_bar' }, required: true },
        { key: 'insights', type: 'insight', title: 'Key Insights', order: 3, config: { rules: ['behavioural_concern', 'high_readiness', 'benchmark_above_peer'] }, required: true },
        { key: 'interventions', type: 'narrative', title: 'Recommendations', order: 4, config: { block_key: 'intervention_recommendation' }, required: false },
        { key: 'footer', type: 'footer', title: 'Report Footer', order: 5, config: { block_key: 'report_footer_standard' }, required: true },
      ],
    },
    {
      name: 'Career Readiness Report',
      report_type: 'career',
      description: 'Comprehensive career readiness report with benchmark comparisons',
      sections: [
        { key: 'header', type: 'header', title: 'Report Header', order: 0, required: true },
        { key: 'intro', type: 'narrative', title: 'Introduction', order: 1, config: { block_key: 'report_intro_career' }, required: true },
        { key: 'readiness_gauge', type: 'chart', title: 'Readiness Score', order: 2, config: { viz_key: 'readiness_gauge' }, required: true },
        { key: 'trend', type: 'chart', title: 'Score Trend', order: 3, config: { viz_key: 'trend_line' }, required: false },
        { key: 'benchmark', type: 'benchmark', title: 'Peer Comparison', order: 4, config: { benchmark_key: 'peer_career_readiness' }, required: false },
        { key: 'strengths', type: 'narrative', title: 'Strengths', order: 5, config: { block_key: 'strength_narrative' }, required: true },
        { key: 'insights', type: 'insight', title: 'Insights', order: 6, config: { rules: ['high_readiness', 'low_readiness', 'benchmark_above_peer'] }, required: true },
        { key: 'footer', type: 'footer', title: 'Footer', order: 7, config: { block_key: 'report_footer_standard' }, required: true },
      ],
    },
    {
      name: 'Competency Assessment Report',
      report_type: 'competency',
      description: 'Detailed competency framework assessment with radar visualisation',
      sections: [
        { key: 'header', type: 'header', title: 'Report Header', order: 0, required: true },
        { key: 'intro', type: 'narrative', title: 'Introduction', order: 1, config: { block_key: 'report_intro_competency' }, required: true },
        { key: 'radar', type: 'chart', title: 'Competency Radar', order: 2, config: { viz_key: 'competency_radar' }, required: true },
        { key: 'heatmap', type: 'chart', title: 'Skills Heatmap', order: 3, config: { viz_key: 'skills_heatmap' }, required: false },
        { key: 'benchmark', type: 'benchmark', title: 'Industry Benchmark', order: 4, config: { benchmark_key: 'industry_competency' }, required: false },
        { key: 'insights', type: 'insight', title: 'Key Findings', order: 5, config: { rules: ['competency_gap', 'strong_competency', 'benchmark_above_peer'] }, required: true },
        { key: 'footer', type: 'footer', title: 'Footer', order: 6, config: { block_key: 'report_footer_standard' }, required: true },
      ],
    },
    {
      name: 'Employability Index Report',
      report_type: 'employability',
      description: 'Branded employability index report compiling competency and behavioural signals into a developmental readiness picture',
      sections: [
        { key: 'header', type: 'header', title: 'Report Header', order: 0, required: true },
        { key: 'intro', type: 'narrative', title: 'Introduction', order: 1, config: { block_key: 'report_intro_employability' }, required: true },
        { key: 'ei_gauge', type: 'chart', title: 'Employability Index', order: 2, config: { viz_key: 'employability_gauge' }, required: true },
        { key: 'trend', type: 'chart', title: 'Score Trend', order: 3, config: { viz_key: 'trend_line' }, required: false },
        { key: 'benchmark', type: 'benchmark', title: 'Peer Comparison', order: 4, config: { benchmark_key: 'peer_career_readiness' }, required: false },
        { key: 'summary', type: 'narrative', title: 'Readiness Summary', order: 5, config: { block_key: 'readiness_summary' }, required: true },
        { key: 'insights', type: 'insight', title: 'Key Insights', order: 6, config: { rules: ['high_readiness', 'low_readiness', 'benchmark_above_peer'] }, required: true },
        { key: 'footer', type: 'footer', title: 'Footer', order: 7, config: { block_key: 'report_footer_standard' }, required: true },
      ],
    },
    {
      name: 'Career Passport Export',
      report_type: 'passport',
      description: 'Formatted export of the career passport for sharing with employers',
      sections: [
        { key: 'header', type: 'header', title: 'Passport Header', order: 0, required: true },
        { key: 'summary', type: 'narrative', title: 'Profile Summary', order: 1, config: { block_key: 'passport_summary' }, required: true },
        { key: 'donut', type: 'chart', title: 'Profile Completeness', order: 2, config: { viz_key: 'passport_donut' }, required: true },
        { key: 'benchmark', type: 'benchmark', title: 'Peer Benchmark', order: 3, config: { benchmark_key: 'institutional_passport' }, required: false },
        { key: 'insights', type: 'insight', title: 'Profile Highlights', order: 4, config: { rules: ['passport_strong', 'missing_certifications'] }, required: false },
        { key: 'footer', type: 'footer', title: 'Footer', order: 5, config: { block_key: 'report_footer_standard' }, required: true },
      ],
    },
  ];

  for (const t of templates) {
    const existing = await pool.query(`SELECT id FROM rf_templates WHERE name=$1`, [t.name]);
    if (existing.rows.length > 0) continue;
    const { rows } = await pool.query(
      `INSERT INTO rf_templates (name,report_type,description,is_default) VALUES ($1,$2,$3,true) RETURNING id`,
      [t.name, t.report_type, t.description],
    );
    const templateId = rows[0].id;
    for (const s of t.sections) {
      await pool.query(
        `INSERT INTO rf_template_sections (template_id,section_key,section_type,title,order_index,config,is_required)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [templateId, s.key, s.type, s.title, s.order, JSON.stringify(s.config ?? {}), s.required],
      );
    }
  }
}

// ── Report generation engine ──────────────────────────────────────────────

export function renderNarrative(template: string, variables: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(variables[key] ?? `[${key}]`));
}

export function evaluateInsightRule(
  rule: { condition_type: string; condition: Record<string, unknown> },
  data: Record<string, unknown>,
): boolean {
  const c = rule.condition;
  const field = c.field as string;
  const val = data[field];
  if (val === undefined || val === null) return false;
  const numVal = Number(val);
  const threshold = Number(c.value);
  switch (c.operator as string) {
    case '>=': return numVal >= threshold;
    case '>':  return numVal > threshold;
    case '<=': return numVal <= threshold;
    case '<':  return numVal < threshold;
    case '=':  return numVal === threshold;
    case '!=': return numVal !== threshold;
    default:   return false;
  }
}

export interface GenerateReportParams {
  templateId: number;
  data: Record<string, unknown>;
  language?: string;
  tenantId?: string;
  userId?: string;
  sessionId?: string;
}

export async function generateReport(pool: Pool, params: GenerateReportParams) {
  const { templateId, data, language = 'en', tenantId, userId, sessionId } = params;

  const tmplRes = await pool.query(`SELECT * FROM rf_templates WHERE id=$1 AND is_active=true`, [templateId]);
  if (!tmplRes.rows.length) throw new Error('Template not found');
  const template = tmplRes.rows[0];

  const sectRes = await pool.query(
    `SELECT * FROM rf_template_sections WHERE template_id=$1 ORDER BY order_index ASC`,
    [templateId],
  );
  const sections = sectRes.rows;

  const narrativeTexts: Record<string, string> = {};
  const firedInsights: Array<Record<string, unknown>> = [];
  const generatedContent: Record<string, unknown> = { sections: [] };

  for (const sec of sections) {
    const cfg = sec.config ?? {};
    const outSection: Record<string, unknown> = { key: sec.section_key, type: sec.section_type, title: sec.title };

    if (sec.section_type === 'narrative' && cfg.block_key) {
      const nb = await pool.query(`SELECT * FROM rf_narrative_blocks WHERE block_key=$1 AND is_active=true`, [cfg.block_key]);
      if (nb.rows.length) {
        const rendered = renderNarrative(nb.rows[0].content, data);
        narrativeTexts[sec.section_key] = rendered;
        outSection.text = rendered;
      }
    }

    if (sec.section_type === 'insight' && cfg.rules) {
      const ruleKeys = Array.isArray(cfg.rules) ? cfg.rules : [];
      if (ruleKeys.length) {
        const rules = await pool.query(
          `SELECT * FROM rf_insight_rules WHERE rule_key = ANY($1) AND is_active=true ORDER BY priority DESC`,
          [ruleKeys],
        );
        for (const rule of rules.rows) {
          if (evaluateInsightRule(rule, data)) {
            const insightText = renderNarrative(rule.insight_template, data);
            firedInsights.push({ rule_key: rule.rule_key, text: insightText, severity: rule.severity, priority: rule.priority });
            await pool.query(`UPDATE rf_insight_rules SET fire_count=fire_count+1 WHERE id=$1`, [rule.id]);
          }
        }
        outSection.insights = firedInsights;
      }
    }

    if (sec.section_type === 'chart' && cfg.viz_key) {
      const viz = await pool.query(`SELECT * FROM rf_visualization_configs WHERE config_key=$1`, [cfg.viz_key]);
      if (viz.rows.length) {
        outSection.visualization = viz.rows[0];
        const resolved = await resolveVizData(pool, {
          configKey: String(cfg.viz_key),
          userId, sessionId,
          reportDataSnapshot: data,
        }).catch(() => null);
        if (resolved) outSection.resolved_data = resolved;
      }
    }

    if (sec.section_type === 'benchmark' && cfg.benchmark_key) {
      const bm = await pool.query(`SELECT * FROM rf_benchmark_configs WHERE config_key=$1`, [cfg.benchmark_key]);
      if (bm.rows.length) {
        outSection.benchmark = bm.rows[0];
        const benchResults = await computeBenchmarkForReport(pool, String(cfg.benchmark_key), data).catch(() => []);
        outSection.benchmark_results = benchResults;
      }
    }

    (generatedContent.sections as unknown[]).push(outSection);
  }

  const { rows } = await pool.query(
    `INSERT INTO rf_generated_reports
       (template_id,user_id,session_id,report_type,data_snapshot,generated_content,narrative_texts,insights,language,tenant_id,status,completed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'complete',NOW())
     RETURNING *`,
    [templateId, userId ?? null, sessionId ?? null, template.report_type,
     JSON.stringify(data), JSON.stringify(generatedContent),
     JSON.stringify(narrativeTexts), JSON.stringify(firedInsights),
     language, tenantId ?? null],
  );
  return rows[0];
}
