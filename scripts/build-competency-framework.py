#!/usr/bin/env python3
"""Recover the FULL Professional Competency Framework lost when Postgres was wiped.

Re-creates the schema (tables NOT in drizzle schema.ts but used by routes.ts) AND
seeds it from the source-of-truth file in attached_assets:
  /app/frontend/attached_assets/Pasted--Domain-Subdomain-Micro-Competenc-...txt

Outputs a single idempotent SQL file: /app/scripts/seed-competency-framework.sql

Tables recovered:
  competency_domains            (12 domains)
  competencies                  (101 sub-domains, codes like CGN_01..GLO_07)
  competency_clusters           (empty, schema only)
  competency_cluster_map        (empty, schema only)
  stage_competency_norms        (5 stages × 101 = 505 default rows)
  scoring_configs               (defaults)
  competency_assessment_items   (empty, schema only)
  competency_assessment_options (empty, schema only)
  role_competency_weights       (7 default hiring roles × 101 = 707 default rows)
  learning_mappings             (empty, schema only)
  competency_user_responses     (empty, schema only)
"""
from __future__ import annotations
import re
from pathlib import Path
from collections import OrderedDict

SRC = Path('/app/frontend/attached_assets/Pasted--Domain-Subdomain-Micro-Competenc-1775311517211_1775311517211.txt')
DST = Path('/app/scripts/seed-competency-framework.sql')

# Canonical 3-letter codes for the 12 domains (matches the order they appear)
DOMAIN_CODES = {
    'Cognitive & Analytical Intelligence': 'CGN',
    'Communication & Expression': 'COM',
    'Social & Interpersonal Intelligence': 'SOC',
    'Leadership & Influence': 'LEA',
    'Personal Effectiveness & Self-Management': 'PER',
    'Execution, Operations & Productivity': 'EXE',
    'Innovation, Entrepreneurship & Value Creation': 'INN',
    'Career & Professional Readiness': 'CAR',
    'Digital, Data & Technology Skills': 'DIG',
    'Health, Wellbeing & Sustainability': 'HEA',
    'Ethics, Governance & Responsibility': 'ETH',
    'Global & Future Readiness': 'GLO',
}
DOMAIN_COLORS = {
    'CGN': '#2563EB', 'COM': '#10B981', 'SOC': '#F59E0B', 'LEA': '#8B5CF6',
    'PER': '#EC4899', 'EXE': '#0EA5E9', 'INN': '#F97316', 'CAR': '#14B8A6',
    'DIG': '#6366F1', 'HEA': '#84CC16', 'ETH': '#EF4444', 'GLO': '#06B6D4',
}
# Default 7 hiring roles (codes user can rename in Super Admin)
DEFAULT_ROLES = [
    ('SDE',   'Software Engineer'),
    ('PM',    'Product Manager'),
    ('DA',    'Data Analyst'),
    ('TL',    'Team Lead'),
    ('DIR',   'Director'),
    ('CONS',  'Consultant'),
    ('SALES', 'Sales / BD'),
]
# Career stage codes
DEFAULT_STAGES = ['FRESHER', 'JR', 'MID', 'SR', 'EXEC']


def esc(s: str) -> str:
    return s.replace("'", "''")


def parse_table(text: str):
    """Yields ordered (domain, [(subdomain, micros[]), ...]) preserving file order."""
    by_domain: 'OrderedDict[str, OrderedDict[str, list[str]]]' = OrderedDict()
    for line in text.splitlines():
        if not line.strip().startswith('|'):
            continue
        if re.match(r'^\|\s*\*\*', line):
            continue
        if re.match(r'^\|[\s\-:|]+\|$', line):
            continue
        cells = [c.strip() for c in line.strip().strip('|').split('|')]
        if len(cells) < 3:
            continue
        domain, subdomain, micros_raw = cells[0], cells[1], cells[2]
        if not domain or domain.startswith('---'):
            continue
        micros = [m.strip() for m in micros_raw.split(',') if m.strip()]
        by_domain.setdefault(domain, OrderedDict()).setdefault(subdomain, []).extend(micros)
    return by_domain


def main() -> None:
    by_domain = parse_table(SRC.read_text(encoding='utf-8'))
    out: list[str] = []
    out.append('-- /app/scripts/seed-competency-framework.sql')
    out.append('-- Auto-generated. Idempotent. Recreates tables used by routes.ts that are NOT in drizzle schema.')
    out.append('-- Source: /app/frontend/attached_assets/Pasted--Domain-Subdomain-Micro-Competenc-...txt')
    out.append('')
    out.append('BEGIN;')
    out.append('')

    # ── DDL ──────────────────────────────────────────────────────────────
    out.append('-- ─── DDL (CREATE TABLE IF NOT EXISTS — safe to re-run) ─────────────')
    out.append('''
CREATE TABLE IF NOT EXISTS competency_domains (
  id            varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text UNIQUE NOT NULL,
  name          text NOT NULL,
  description   text,
  color         text,
  weight        real NOT NULL DEFAULT 1,
  display_order integer NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamp NOT NULL DEFAULT now(),
  updated_at    timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS competencies (
  id                 varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id          varchar NOT NULL REFERENCES competency_domains(id) ON DELETE CASCADE,
  code               text UNIQUE NOT NULL,
  name               text NOT NULL,
  description        text,
  competency_type    text NOT NULL DEFAULT 'behavioral',
  proficiency_levels jsonb NOT NULL DEFAULT '{"1":"Basic awareness","2":"Guided execution","3":"Independent execution","4":"Advanced application","5":"Strategic mastery"}'::jsonb,
  display_order      integer NOT NULL DEFAULT 0,
  is_active          boolean NOT NULL DEFAULT true,
  created_at         timestamp NOT NULL DEFAULT now(),
  updated_at         timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_competencies_domain ON competencies(domain_id);

CREATE TABLE IF NOT EXISTS competency_clusters (
  id          varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS competency_cluster_map (
  cluster_id    varchar NOT NULL REFERENCES competency_clusters(id) ON DELETE CASCADE,
  competency_id varchar NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  PRIMARY KEY (cluster_id, competency_id)
);

CREATE TABLE IF NOT EXISTS stage_competency_norms (
  id            varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_code    text NOT NULL,
  competency_id varchar NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  min_score     real NOT NULL DEFAULT 0,
  median_score  real NOT NULL DEFAULT 50,
  top10_score   real NOT NULL DEFAULT 100,
  UNIQUE(stage_code, competency_id)
);
CREATE INDEX IF NOT EXISTS idx_stage_norms_stage ON stage_competency_norms(stage_code);

CREATE TABLE IF NOT EXISTS scoring_configs (
  id         varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text UNIQUE NOT NULL,
  value      real NOT NULL,
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS competency_assessment_items (
  id             varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_id  varchar NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  code           text UNIQUE NOT NULL,
  item_type      text NOT NULL DEFAULT 'mcq',
  difficulty     integer NOT NULL DEFAULT 3,
  level          integer NOT NULL DEFAULT 3,
  question       text NOT NULL,
  expected_time  integer NOT NULL DEFAULT 60,
  scoring_type   text NOT NULL DEFAULT 'auto',
  industry       text,
  role_tag       text,
  language_code  text NOT NULL DEFAULT 'en',
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_items_competency ON competency_assessment_items(competency_id);
CREATE INDEX IF NOT EXISTS idx_items_lang ON competency_assessment_items(language_code);

CREATE TABLE IF NOT EXISTS competency_assessment_options (
  id            varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       varchar NOT NULL REFERENCES competency_assessment_items(id) ON DELETE CASCADE,
  text          text NOT NULL,
  score_value   real NOT NULL DEFAULT 0,
  display_order integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_options_item ON competency_assessment_options(item_id);

CREATE TABLE IF NOT EXISTS role_competency_weights (
  id            varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code     text NOT NULL,
  role_name     text NOT NULL,
  competency_id varchar NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  weight        real NOT NULL DEFAULT 1,
  weight_type   text NOT NULL DEFAULT 'core',
  UNIQUE(role_code, competency_id)
);
CREATE INDEX IF NOT EXISTS idx_role_weights_role ON role_competency_weights(role_code);

CREATE TABLE IF NOT EXISTS learning_mappings (
  id             varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_id  varchar NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  level          integer NOT NULL DEFAULT 3,
  action_type    text,
  title          text,
  resource_link  text,
  created_at     timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS competency_user_responses (
  id             varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        varchar NOT NULL,
  item_id        varchar NOT NULL REFERENCES competency_assessment_items(id) ON DELETE CASCADE,
  option_id      varchar REFERENCES competency_assessment_options(id) ON DELETE SET NULL,
  score_obtained real,
  time_taken     integer,
  created_at     timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_resp_user ON competency_user_responses(user_id);

-- Add language_code column on existing items table (idempotent)
ALTER TABLE competency_assessment_items
  ADD COLUMN IF NOT EXISTS language_code text NOT NULL DEFAULT 'en';
'''.strip())
    out.append('')

    # ── Domains ──────────────────────────────────────────────────────────
    out.append("-- ─── 12 Competency Domains ─────────────────────────────────")
    out.append('INSERT INTO competency_domains (code, name, color, weight, display_order, is_active) VALUES')
    rows = []
    for i, name in enumerate(by_domain.keys(), start=1):
        code = DOMAIN_CODES.get(name)
        if not code:
            raise SystemExit(f'Unknown domain in source: {name!r}')
        color = DOMAIN_COLORS[code]
        rows.append(f"('{code}','{esc(name)}','{color}',1,{i},true)")
    out.append(',\n'.join(rows))
    out.append('ON CONFLICT (code) DO UPDATE SET')
    out.append('  name = EXCLUDED.name, color = EXCLUDED.color,')
    out.append('  display_order = EXCLUDED.display_order, is_active = EXCLUDED.is_active,')
    out.append('  updated_at = now();')
    out.append('')

    # ── Competencies (subdomains as competencies) ───────────────────────
    out.append("-- ─── 101 Competencies (one per subdomain) ──────────────────")
    out.append('INSERT INTO competencies (domain_id, code, name, description, competency_type, display_order, is_active) VALUES')
    rows = []
    for d_idx, (d_name, subs) in enumerate(by_domain.items(), start=1):
        d_code = DOMAIN_CODES[d_name]
        for s_idx, (s_name, micros) in enumerate(subs.items(), start=1):
            code = f"{d_code}_{s_idx:02d}"
            desc = ', '.join(micros[:6])  # description = first 6 micro competencies
            rows.append(
                f"((SELECT id FROM competency_domains WHERE code='{d_code}'),"
                f"'{code}','{esc(s_name)}','{esc(desc)}','behavioral',{s_idx},true)"
            )
    out.append(',\n'.join(rows))
    out.append('ON CONFLICT (code) DO UPDATE SET')
    out.append('  name = EXCLUDED.name, description = EXCLUDED.description,')
    out.append('  display_order = EXCLUDED.display_order, is_active = EXCLUDED.is_active,')
    out.append('  updated_at = now();')
    out.append('')

    # ── Scoring configs ─────────────────────────────────────────────────
    out.append("-- ─── Scoring Configs ────────────────────────────────────────")
    out.append("""
INSERT INTO scoring_configs (name, value) VALUES
  ('normalisation_top_pct', 90),
  ('weighted_score_floor', 0),
  ('benchmark_top10_pct', 10),
  ('proficiency_pass_threshold', 60),
  ('idp_top_n_gaps', 5)
ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
""".strip())
    out.append('')

    # ── Stage norms (sensible defaults) ─────────────────────────────────
    out.append("-- ─── Stage Norms (5 stages × 101 competencies = 505 rows) ──")
    out.append("""
INSERT INTO stage_competency_norms (stage_code, competency_id, min_score, median_score, top10_score)
SELECT s.stage, c.id,
       CASE s.stage WHEN 'FRESHER' THEN 25 WHEN 'JR' THEN 35 WHEN 'MID' THEN 45 WHEN 'SR' THEN 55 ELSE 60 END,
       CASE s.stage WHEN 'FRESHER' THEN 45 WHEN 'JR' THEN 55 WHEN 'MID' THEN 65 WHEN 'SR' THEN 72 ELSE 78 END,
       CASE s.stage WHEN 'FRESHER' THEN 75 WHEN 'JR' THEN 82 WHEN 'MID' THEN 88 WHEN 'SR' THEN 92 ELSE 95 END
FROM competencies c, (VALUES ('FRESHER'),('JR'),('MID'),('SR'),('EXEC')) AS s(stage)
ON CONFLICT (stage_code, competency_id) DO NOTHING;
""".strip())
    out.append('')

    # ── Default 7 hiring roles weights ──────────────────────────────────
    out.append("-- ─── 7 Default Hiring Roles × 101 Competencies ─────────────")
    role_values = ',\n'.join(f"('{c}','{esc(n)}')" for c, n in DEFAULT_ROLES)
    out.append(f"""
INSERT INTO role_competency_weights (role_code, role_name, competency_id, weight, weight_type)
SELECT r.code, r.name, c.id, 1, 'core'
FROM competencies c, (VALUES {role_values}) AS r(code, name)
ON CONFLICT (role_code, competency_id) DO NOTHING;
""".strip())
    out.append('')

    out.append('COMMIT;')
    out.append('')
    DST.write_text('\n'.join(out), encoding='utf-8')
    print(f'Wrote {DST}')
    print(f'  Domains: {len(by_domain)}')
    print(f'  Competencies: {sum(len(s) for s in by_domain.values())}')
    print(f'  Stages: {len(DEFAULT_STAGES)}, Roles: {len(DEFAULT_ROLES)}')


if __name__ == '__main__':
    main()
