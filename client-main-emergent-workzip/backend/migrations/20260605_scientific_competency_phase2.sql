-- =====================================================================
-- Phase 2 — Scientific Competency Intelligence Engine
-- Enhancement-only. All tables namespaced sci_* to preserve existing
-- competency_* / onto_* / psychometric_* schema. Read-only mappings to
-- ontology via nullable soft FK columns.
-- =====================================================================
BEGIN;

-- ──────────────────────────────────────────────────────────────────────
-- 1. BARS — Behavioural Anchored Rating System
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sci_competency_bars (
  id              TEXT PRIMARY KEY,
  competency_id   TEXT NOT NULL,                 -- maps to onto_competencies.id (soft)
  role_layer      TEXT NOT NULL,                 -- IC|LEAD|MGR|STRAT|EXEC
  score_min       INTEGER NOT NULL,
  score_max       INTEGER NOT NULL,
  proficiency_level TEXT NOT NULL,               -- Foundational|Developing|Proficient|Advanced|Expert
  behavioral_anchor TEXT NOT NULL,
  observable_behavior TEXT,
  version         INTEGER NOT NULL DEFAULT 1,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (score_min >= 0 AND score_max <= 100 AND score_min < score_max)
);
CREATE INDEX IF NOT EXISTS ix_sci_bars_comp_layer
  ON sci_competency_bars(competency_id, role_layer) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS sci_bars_behavioral_anchors (
  id              TEXT PRIMARY KEY,
  bars_id         TEXT NOT NULL REFERENCES sci_competency_bars(id) ON DELETE CASCADE,
  context         TEXT NOT NULL,                 -- e.g. 'team' | 'cross-functional' | 'enterprise'
  anchor_text     TEXT NOT NULL,
  evidence_hint   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sci_bars_evidence_examples (
  id              TEXT PRIMARY KEY,
  bars_id         TEXT NOT NULL REFERENCES sci_competency_bars(id) ON DELETE CASCADE,
  example_text    TEXT NOT NULL,
  source          TEXT,                          -- 'sme'|'literature'|'synthetic'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sci_bars_calibration_versions (
  id              TEXT PRIMARY KEY,
  version_label   TEXT NOT NULL,
  notes           TEXT,
  is_current      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────────
-- 2. Functional Frameworks (SHRM/SFIA/NICE/CFA/PMI/Pragmatic/SAFe)
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sci_functional_frameworks (
  id              TEXT PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  authority       TEXT,
  function_id     TEXT,                          -- soft FK -> gro_business_functions
  description     TEXT,
  version         TEXT NOT NULL DEFAULT '1.0.0',
  is_current      BOOLEAN NOT NULL DEFAULT true,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sci_framework_domains (
  id              TEXT PRIMARY KEY,
  framework_id    TEXT NOT NULL REFERENCES sci_functional_frameworks(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (framework_id, code)
);

CREATE TABLE IF NOT EXISTS sci_framework_competencies (
  id              TEXT PRIMARY KEY,
  framework_id    TEXT NOT NULL REFERENCES sci_functional_frameworks(id) ON DELETE CASCADE,
  domain_id       TEXT REFERENCES sci_framework_domains(id) ON DELETE SET NULL,
  external_code   TEXT NOT NULL,                 -- e.g. SFIA 'PROG' or NICE 'SP-DEV-001'
  name            TEXT NOT NULL,
  description     TEXT,
  ontology_competency_id TEXT,                   -- soft FK -> onto_competencies.id (M:N via mapping table also allowed)
  proficiency_level TEXT,
  version         TEXT,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (framework_id, external_code)
);
CREATE INDEX IF NOT EXISTS ix_sci_fw_comp_onto ON sci_framework_competencies(ontology_competency_id);

CREATE TABLE IF NOT EXISTS sci_framework_role_mappings (
  id              TEXT PRIMARY KEY,
  framework_id    TEXT NOT NULL REFERENCES sci_functional_frameworks(id) ON DELETE CASCADE,
  role_id         TEXT NOT NULL,                 -- soft FK -> gro_canonical_roles.id
  framework_competency_id TEXT NOT NULL REFERENCES sci_framework_competencies(id) ON DELETE CASCADE,
  expected_level  TEXT,                          -- framework-native level label
  weight          NUMERIC(4,2) NOT NULL DEFAULT 1.00,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sci_framework_aliases (
  id              TEXT PRIMARY KEY,
  framework_competency_id TEXT NOT NULL REFERENCES sci_framework_competencies(id) ON DELETE CASCADE,
  alias           TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_sci_fw_alias ON sci_framework_aliases(LOWER(alias));

CREATE TABLE IF NOT EXISTS sci_framework_versions (
  id              TEXT PRIMARY KEY,
  framework_id    TEXT NOT NULL REFERENCES sci_functional_frameworks(id) ON DELETE CASCADE,
  version_label   TEXT NOT NULL,
  changelog       TEXT,
  is_current      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────────
-- 3. Competency Dependency Graph
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sci_competency_relationships (
  id              TEXT PRIMARY KEY,
  source_competency_id TEXT NOT NULL,
  target_competency_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL,               -- prerequisite|amplification|dependency|acceleration|leadership_progression|strategic_maturity
  strength        NUMERIC(4,3) NOT NULL DEFAULT 0.500,  -- 0..1
  evidence_basis  TEXT,
  bidirectional   BOOLEAN NOT NULL DEFAULT false,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (strength >= 0 AND strength <= 1),
  CHECK (source_competency_id <> target_competency_id),
  UNIQUE (source_competency_id, target_competency_id, relationship_type)
);
CREATE INDEX IF NOT EXISTS ix_sci_rel_src ON sci_competency_relationships(source_competency_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_sci_rel_tgt ON sci_competency_relationships(target_competency_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS sci_competency_dependency_paths (
  id              TEXT PRIMARY KEY,
  origin_competency_id TEXT NOT NULL,
  terminal_competency_id TEXT NOT NULL,
  path            JSONB NOT NULL,                -- ordered array of competency_ids
  hop_count       INTEGER NOT NULL,
  cumulative_strength NUMERIC(5,4) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_sci_paths_origin ON sci_competency_dependency_paths(origin_competency_id);

CREATE TABLE IF NOT EXISTS sci_competency_influence_weights (
  id              TEXT PRIMARY KEY,
  competency_id   TEXT NOT NULL,
  influences_competency_id TEXT NOT NULL,
  weight          NUMERIC(4,3) NOT NULL,         -- aggregate influence
  influence_basis TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (competency_id, influences_competency_id)
);

CREATE TABLE IF NOT EXISTS sci_capability_evolution_paths (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  ordered_competencies JSONB NOT NULL,           -- [{competency_id, expected_level, sequence}]
  target_role_id  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────────
-- 4. Psychometric Validation
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sci_psychometric_results (
  id              TEXT PRIMARY KEY,
  assessment_id   TEXT NOT NULL,
  competency_id   TEXT,
  sample_size     INTEGER NOT NULL,
  cronbach_alpha  NUMERIC(5,4),
  reliability_tier TEXT,                         -- A|B|C|D|provisional
  validity_score  NUMERIC(5,4),
  test_retest_r   NUMERIC(5,4),
  inter_rater_kappa NUMERIC(5,4),
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  methodology_version TEXT NOT NULL DEFAULT '2.0.0'
);
CREATE INDEX IF NOT EXISTS ix_sci_psych_assess ON sci_psychometric_results(assessment_id);

CREATE TABLE IF NOT EXISTS sci_reliability_metrics (
  id              TEXT PRIMARY KEY,
  assessment_id   TEXT NOT NULL,
  metric_type     TEXT NOT NULL,                 -- cronbach|split_half|test_retest|inter_rater
  value           NUMERIC(6,4) NOT NULL,
  k_items         INTEGER,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sci_validity_metrics (
  id              TEXT PRIMARY KEY,
  assessment_id   TEXT NOT NULL,
  validity_type   TEXT NOT NULL,                 -- content|criterion|construct|discriminant|convergent
  value           NUMERIC(6,4) NOT NULL,
  notes           TEXT,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sci_fairness_metrics (
  id              TEXT PRIMARY KEY,
  assessment_id   TEXT NOT NULL,
  protected_attribute TEXT NOT NULL,             -- gender|age_band|geography
  group_a_value   NUMERIC(6,4) NOT NULL,
  group_b_value   NUMERIC(6,4) NOT NULL,
  adverse_impact_ratio NUMERIC(6,4),             -- group_b / group_a (must be >= 0.80 — four-fifths rule)
  passes_four_fifths BOOLEAN NOT NULL DEFAULT false,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sci_assessment_calibration_results (
  id              TEXT PRIMARY KEY,
  assessment_id   TEXT NOT NULL,
  calibration_method TEXT NOT NULL,              -- irt|equipercentile|linear
  scale_min       NUMERIC(6,2),
  scale_max       NUMERIC(6,2),
  parameters      JSONB,
  fit_index       NUMERIC(6,4),
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────────
-- 5. Adaptive Assessment Intelligence
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sci_assessment_confidence_scores (
  id              TEXT PRIMARY KEY,
  session_id      TEXT NOT NULL,
  competency_id   TEXT NOT NULL,
  confidence      NUMERIC(5,4) NOT NULL,         -- 0..1 composite
  reliability_component  NUMERIC(5,4) NOT NULL,
  consistency_component  NUMERIC(5,4) NOT NULL,
  evidence_component     NUMERIC(5,4) NOT NULL,
  historical_component   NUMERIC(5,4) NOT NULL,
  benchmark_component    NUMERIC(5,4) NOT NULL,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_sci_conf_session ON sci_assessment_confidence_scores(session_id);

CREATE TABLE IF NOT EXISTS sci_assessment_uncertainty (
  id              TEXT PRIMARY KEY,
  session_id      TEXT NOT NULL,
  competency_id   TEXT NOT NULL,
  uncertainty     NUMERIC(5,4) NOT NULL,         -- 0..1
  source          TEXT NOT NULL,                 -- low_coverage|low_consistency|insufficient_evidence|contradiction
  recommendation  TEXT,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sci_adaptive_assessment_paths (
  id              TEXT PRIMARY KEY,
  session_id      TEXT NOT NULL,
  step_index      INTEGER NOT NULL,
  selected_question_id TEXT,
  targeted_competency_id TEXT,
  rationale       TEXT,
  expected_information_gain NUMERIC(5,4),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sci_response_behavioral_patterns (
  id              TEXT PRIMARY KEY,
  session_id      TEXT NOT NULL,
  pattern_type    TEXT NOT NULL,                 -- straight_lining|inconsistent|contradiction|fatigue
  evidence        JSONB,
  severity        NUMERIC(4,3) NOT NULL DEFAULT 0.500,
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────────
-- 6. Confidence engine outputs (versioned snapshots)
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sci_confidence_snapshots (
  id              TEXT PRIMARY KEY,
  session_id      TEXT NOT NULL,
  competency_id   TEXT NOT NULL,
  raw_score       NUMERIC(6,2),
  confidence      NUMERIC(5,4) NOT NULL,
  reliability_tier TEXT NOT NULL,
  evidence_strength TEXT NOT NULL,               -- weak|moderate|strong|very_strong
  components      JSONB NOT NULL,
  methodology_version TEXT NOT NULL DEFAULT '2.0.0',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────────
-- 7. Audit + versions
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sci_audit_logs (
  id              BIGSERIAL PRIMARY KEY,
  domain          TEXT NOT NULL,                 -- bars|framework|graph|psychometric|adaptive|confidence|gap
  operation       TEXT NOT NULL,
  entity_id       TEXT,
  actor           TEXT,
  payload         JSONB,
  request_id      TEXT,
  ip_address      TEXT,
  ts              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_sci_audit_domain_ts ON sci_audit_logs(domain, ts DESC);

CREATE TABLE IF NOT EXISTS sci_versions (
  id              TEXT PRIMARY KEY,
  component       TEXT NOT NULL,                 -- bars_engine|framework_intelligence|graph_engine|psychometric_engine|adaptive_intelligence|confidence_engine|gap_intelligence
  version         TEXT NOT NULL,
  is_current      BOOLEAN NOT NULL DEFAULT true,
  released_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes           TEXT
);

-- =====================================================================
-- SEED (minimal but functional — covers core competencies & engineering)
-- =====================================================================

-- Versions
INSERT INTO sci_versions (id, component, version, notes) VALUES
  ('sciv_bars_1',     'bars_engine',           '2.0.0', 'Phase 2 BARS calibration'),
  ('sciv_fw_1',       'framework_intelligence','2.0.0', 'Phase 2 functional frameworks'),
  ('sciv_graph_1',    'graph_engine',          '2.0.0', 'Phase 2 dependency graph'),
  ('sciv_psych_1',    'psychometric_engine',   '2.0.0', 'Phase 2 psychometrics'),
  ('sciv_adapt_1',    'adaptive_intelligence', '2.0.0', 'Phase 2 adaptive assessment'),
  ('sciv_conf_1',     'confidence_engine',     '2.0.0', 'Phase 2 confidence scoring'),
  ('sciv_gap_1',      'gap_intelligence',      '2.0.0', 'Phase 2 gap intelligence')
ON CONFLICT (id) DO NOTHING;

-- BARS calibration version
INSERT INTO sci_bars_calibration_versions (id, version_label, notes, is_current) VALUES
  ('sci_calv_1', '2.0.0', 'Phase 2 initial calibration anchors', true)
ON CONFLICT (id) DO NOTHING;

-- BARS anchors — 5 proficiency levels for 5 core competencies × 1 layer (IC baseline)
-- Note: competency_id values map by code to onto_competencies (LBI/COG/COM/EXE/EIQ/LEA)
-- Each row's score range follows: Foundational 0-39, Developing 40-54, Proficient 55-69, Advanced 70-84, Expert 85-100
DO $seed_bars$
DECLARE
  layers TEXT[] := ARRAY['IC','LEAD','MGR','STRAT','EXEC'];
  comps  TEXT[][] := ARRAY[
    ARRAY['COM','Interpersonal Skills'],
    ARRAY['LEA','Leadership'],
    ARRAY['COG','Cognitive Capability'],
    ARRAY['EXE','Execution'],
    ARRAY['EIQ','Emotional Intelligence']
  ];
  c TEXT[]; l TEXT;
BEGIN
  FOREACH l IN ARRAY layers LOOP
    FOREACH c SLICE 1 IN ARRAY comps LOOP
      INSERT INTO sci_competency_bars (id, competency_id, role_layer, score_min, score_max, proficiency_level, behavioral_anchor, observable_behavior) VALUES
        ('sbars_' || c[1] || '_' || l || '_1', c[1], l,  0, 39, 'Foundational',
          c[2] || ': basic, supervised behaviour at ' || l || ' level',
          'demonstrates basic competency manifestation; requires guidance'),
        ('sbars_' || c[1] || '_' || l || '_2', c[1], l, 40, 54, 'Developing',  c[2] || ': operational capability with occasional support',
          'operates independently on routine work; collaborates within team'),
        ('sbars_' || c[1] || '_' || l || '_3', c[1], l, 55, 69, 'Proficient',  c[2] || ': independent execution across the role scope',
          'independently delivers in scope; coaches peers; cross-functional contributions'),
        ('sbars_' || c[1] || '_' || l || '_4', c[1], l, 70, 84, 'Advanced',    c[2] || ': cross-functional influence and mentoring impact',
          'influences across functions; mentors others; resolves stakeholder conflicts'),
        ('sbars_' || c[1] || '_' || l || '_5', c[1], l, 85,100, 'Expert',      c[2] || ': enterprise-wide transformation influence',
          'shapes enterprise alignment; sets standards; transforms practice')
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;
END
$seed_bars$;

-- Functional frameworks
INSERT INTO sci_functional_frameworks (id, code, name, authority, function_id, description) VALUES
  ('sfw_shrm',     'SHRM',      'SHRM Body of Competency',         'Society for HR Management', 'fn_hr',      'HR professional competencies'),
  ('sfw_sfia',     'SFIA',      'Skills Framework for the Information Age', 'SFIA Foundation', 'fn_eng',     'Global engineering & IT skills framework'),
  ('sfw_nice',     'NICE',      'NICE Cybersecurity Workforce Framework',   'NIST',           'fn_sec',     'US cybersecurity workforce competencies'),
  ('sfw_cfa',      'CFA',       'CFA Institute Competency Framework',       'CFA Institute',  'fn_finance', 'Investment & finance professional competencies'),
  ('sfw_pmi',      'PMI',       'PMI Talent Triangle',                      'Project Mgmt Institute', 'fn_pm', 'PM technical/leadership/strategy'),
  ('sfw_pragmatic','PRAGMATIC', 'Pragmatic Institute Product Framework',    'Pragmatic Institute', 'fn_prod', 'Product management competencies'),
  ('sfw_safe',     'SAFE',      'SAFe Competency Model',                    'Scaled Agile',   'fn_eng',     'Lean-Agile enterprise competencies')
ON CONFLICT (id) DO NOTHING;

-- A small set of representative framework competencies + mappings to ontology
INSERT INTO sci_framework_competencies (id, framework_id, external_code, name, description, ontology_competency_id, proficiency_level) VALUES
  ('sfwc_sfia_prog', 'sfw_sfia', 'PROG', 'Programming/software development',     'Designs, codes, tests software components', 'EXE', 'Level 3-5'),
  ('sfwc_sfia_arch', 'sfw_sfia', 'ARCH', 'Solution architecture',                'Defines technical solutions for business needs', 'COG', 'Level 5-6'),
  ('sfwc_sfia_lead', 'sfw_sfia', 'ITMG', 'IT management & leadership',           'Leads delivery teams and engineering practice', 'LEA', 'Level 5-7'),
  ('sfwc_shrm_rel',  'sfw_shrm', 'REL',  'Relationship management',              'Builds workplace relationships',             'COM', 'Foundational-Senior'),
  ('sfwc_shrm_eth',  'sfw_shrm', 'ETH',  'Ethical practice',                     'Maintains integrity and ethical conduct',    'EIQ', 'Foundational-Senior'),
  ('sfwc_nice_sec',  'sfw_nice', 'SP-DEV-001', 'Securely Provision — Software Dev', 'Develops secure software',                'EXE', 'Entry-Advanced'),
  ('sfwc_pmi_lead',  'sfw_pmi',  'LEAD', 'Leadership',                           'Influence, coaching, negotiation',           'LEA', 'Practitioner-Strategic'),
  ('sfwc_pmi_strat', 'sfw_pmi',  'STRAT','Strategic & business management',      'Aligns projects to enterprise strategy',     'COG', 'Practitioner-Strategic'),
  ('sfwc_prag_disc', 'sfw_pragmatic', 'DISC', 'Discovery',                       'Customer & problem discovery',               'COG', 'PMC I-III'),
  ('sfwc_safe_dec',  'sfw_safe', 'DEC',  'Decentralised decision-making',        'Empowers teams; pushes decisions down',      'LEA', 'Practitioner-SPC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO sci_framework_aliases (id, framework_competency_id, alias) VALUES
  ('sfwa_1', 'sfwc_sfia_prog', 'Software Engineering'),
  ('sfwa_2', 'sfwc_sfia_prog', 'Coding'),
  ('sfwa_3', 'sfwc_sfia_lead', 'Engineering Leadership'),
  ('sfwa_4', 'sfwc_shrm_rel',  'Stakeholder Management'),
  ('sfwa_5', 'sfwc_pmi_lead',  'Project Leadership')
ON CONFLICT (id) DO NOTHING;

-- Competency dependency edges (illustrative; aligns with prompt example)
INSERT INTO sci_competency_relationships (id, source_competency_id, target_competency_id, relationship_type, strength, evidence_basis) VALUES
  ('srel_eiq_com', 'EIQ', 'COM', 'prerequisite',          0.700, 'EI underpins effective communication (Goleman 1998)'),
  ('srel_com_lea', 'COM', 'LEA', 'prerequisite',          0.650, 'Communication is foundational to leadership influence'),
  ('srel_lea_str', 'LEA', 'STR', 'leadership_progression',0.600, 'Leadership matures into strategic influence'),
  ('srel_cog_exe', 'COG', 'EXE', 'amplification',         0.500, 'Cognitive capability amplifies execution quality'),
  ('srel_exe_lea', 'EXE', 'LEA', 'dependency',            0.400, 'Reliable execution earns leadership opportunity'),
  ('srel_eiq_lea', 'EIQ', 'LEA', 'amplification',         0.600, 'EI amplifies leadership effectiveness'),
  ('srel_com_str', 'COM', 'STR', 'acceleration',          0.450, 'Strong communication accelerates strategic influence'),
  ('srel_lea_eiq', 'LEA', 'EIQ', 'amplification',         0.300, 'Leadership practice deepens EI')
ON CONFLICT (source_competency_id, target_competency_id, relationship_type) DO NOTHING;

INSERT INTO sci_competency_influence_weights (id, competency_id, influences_competency_id, weight, influence_basis) VALUES
  ('siw_1', 'EIQ', 'LEA', 0.620, 'aggregate of direct + amplification edges'),
  ('siw_2', 'COM', 'LEA', 0.580, 'communication → leadership pathway'),
  ('siw_3', 'COG', 'EXE', 0.500, 'cognitive amplifies execution'),
  ('siw_4', 'LEA', 'STR', 0.600, 'leadership maturity → strategic influence')
ON CONFLICT (competency_id, influences_competency_id) DO NOTHING;

INSERT INTO sci_capability_evolution_paths (id, name, description, ordered_competencies, target_role_id) VALUES
  ('scep_lead', 'Leadership maturity ladder',
   'Canonical EI → Communication → Leadership → Strategic influence path',
   '[{"competency_id":"EIQ","expected_level":"Proficient","sequence":1},
     {"competency_id":"COM","expected_level":"Proficient","sequence":2},
     {"competency_id":"LEA","expected_level":"Advanced","sequence":3},
     {"competency_id":"STR","expected_level":"Advanced","sequence":4}]'::JSONB,
   'cr_sw_engmgr')
ON CONFLICT (id) DO NOTHING;

COMMIT;
