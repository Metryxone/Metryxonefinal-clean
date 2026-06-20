/**
 * PHASE 5.1 + 5.2 — Talent Foundation Aggregator (additive, read-only, compose-only).
 *
 * A strictly additive consolidation surface for the Employer Foundation (5.1) and
 * Job Architecture Engine (5.2). It COMPOSES the canonical foundation deliverables
 * into ONE coherent read model. It NEVER recomputes, NEVER writes, NEVER runs DDL,
 * and NEVER throws — every probe is wrapped so a missing/unreadable table degrades
 * to an honest `absent`/`missing` entry instead of a 500.
 *
 * The deliverable NAMES are compatibility VIEWS over single canonical source tables
 * (no duplicate data), plus one thin additive table (`job_templates`, a genuine
 * gap). Each deliverable carries its `source_authority` for full transparency.
 *
 * Honesty contract (mirrors the platform-wide convention):
 *   - Coverage   = does the underlying data EXIST? (table/view present + row count)
 *   - Confidence = is the data SUFFICIENT? (volume)
 *   Reported as SEPARATE axes, NEVER composited. Absent data is reported as absent
 *   — never fabricated, never coerced to 0. Cross-namespace joins are NOT asserted.
 */

import type { Pool } from 'pg';

export const TALENT_FOUNDATION_VERSION = '5.1.0';

export type CoverageState = 'missing' | 'absent' | 'present';
export type ConfidenceBand = 'none' | 'provisional' | 'sufficient';

export interface DeliverableSummary {
  name: string;
  kind: 'view' | 'table';
  source_authority: string;
  org_scoped: boolean;
  coverage: CoverageState;
  confidence: ConfidenceBand;
  rows: number | null; // null => unreadable (never fabricated to 0)
  notes: string[];
}

export interface DomainSummary {
  key: string;
  label: string;
  deliverables: DeliverableSummary[];
}

export interface TalentFoundationOverview {
  version: string;
  scope: { kind: 'platform' | 'org'; employer_id: string | null };
  domains: DomainSummary[];
  rollup: {
    deliverables_total: number;
    deliverables_with_data: number;
    deliverables_absent: number;
    deliverables_missing: number;
    honest_state: string;
  };
  _meta: {
    read_only: true;
    composed: true;
    generated_at: string;
    disclaimer: string;
  };
}

// ---- low-level helpers (never throw) ---------------------------------------

async function relExists(pool: Pool, rel: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT to_regclass($1) AS reg', [`public.${rel}`]);
    return r.rows?.[0]?.reg != null;
  } catch {
    return false;
  }
}

async function countRows(
  pool: Pool,
  rel: string,
  where?: string,
  params: unknown[] = [],
): Promise<number | null> {
  try {
    const sql = `SELECT count(*)::int AS n FROM ${rel}${where ? ` WHERE ${where}` : ''}`;
    const r = await pool.query(sql, params);
    const n = r.rows?.[0]?.n;
    return typeof n === 'number' ? n : null;
  } catch {
    return null;
  }
}

interface DeliverableSpec {
  name: string;
  kind: 'view' | 'table';
  source_authority: string;
  orgColumn: string | null; // column to filter by employer when org-scoped
  sufficientAt: number; // rows >= this => 'sufficient'
}

const EMPLOYER_DELIVERABLES: DeliverableSpec[] = [
  { name: 'employer_master', kind: 'view', source_authority: 'employer_organizations', orgColumn: 'employer_id', sufficientAt: 1 },
  { name: 'organization_master', kind: 'view', source_authority: 'employer_business_units', orgColumn: 'employer_id', sufficientAt: 1 },
  { name: 'employer_rbac', kind: 'view', source_authority: 'role_definitions+role_permissions+permission_definitions', orgColumn: null, sufficientAt: 1 },
  { name: 'employer_profiles', kind: 'view', source_authority: 'employer_company_profiles', orgColumn: 'employer_id', sufficientAt: 1 },
];

const JOB_DELIVERABLES: DeliverableSpec[] = [
  { name: 'job_architecture', kind: 'view', source_authority: 'cg_roles', orgColumn: null, sufficientAt: 1 },
  { name: 'job_role_framework', kind: 'view', source_authority: 'onto_role_competency_profiles', orgColumn: null, sufficientAt: 1 },
  { name: 'job_templates', kind: 'table', source_authority: 'job_templates (new — genuine gap)', orgColumn: 'employer_id', sufficientAt: 1 },
];

async function summarizeDeliverable(
  pool: Pool,
  spec: DeliverableSpec,
  employerId: string | null,
): Promise<DeliverableSummary> {
  const notes: string[] = [];
  const exists = await relExists(pool, spec.name);
  if (!exists) {
    return {
      name: spec.name,
      kind: spec.kind,
      source_authority: spec.source_authority,
      org_scoped: spec.orgColumn != null,
      coverage: 'missing',
      confidence: 'none',
      rows: null,
      notes: ['Deliverable not present (view/table missing — run the canonical foundation migration).'],
    };
  }

  let where: string | undefined;
  let params: unknown[] = [];
  if (employerId && spec.orgColumn) {
    where = `${spec.orgColumn} = $1`;
    params = [employerId];
  } else if (employerId && !spec.orgColumn) {
    notes.push('Global deliverable (not employer-scoped) — org filter not applicable.');
  }

  const rows = await countRows(pool, spec.name, where, params);
  let coverage: CoverageState;
  let confidence: ConfidenceBand;
  if (rows == null) {
    coverage = 'absent';
    confidence = 'none';
    notes.push('Present but unreadable — reported honestly (never coerced to 0).');
  } else if (rows > 0) {
    coverage = 'present';
    confidence = rows >= spec.sufficientAt ? 'sufficient' : 'provisional';
    notes.push(`${rows} row(s) via ${spec.source_authority}.`);
  } else {
    coverage = 'absent';
    confidence = 'none';
    notes.push('Schema present, source has no rows yet (honest empty — not fabricated).');
  }

  return {
    name: spec.name,
    kind: spec.kind,
    source_authority: spec.source_authority,
    org_scoped: spec.orgColumn != null,
    coverage,
    confidence,
    rows,
    notes,
  };
}

export async function buildTalentFoundationOverview(
  pool: Pool,
  employerId: string | null,
): Promise<TalentFoundationOverview> {
  const employer = await Promise.all(EMPLOYER_DELIVERABLES.map((s) => summarizeDeliverable(pool, s, employerId)));
  const job = await Promise.all(JOB_DELIVERABLES.map((s) => summarizeDeliverable(pool, s, employerId)));

  const all = [...employer, ...job];
  const withData = all.filter((d) => d.coverage === 'present').length;
  const absent = all.filter((d) => d.coverage === 'absent').length;
  const missing = all.filter((d) => d.coverage === 'missing').length;

  return {
    version: TALENT_FOUNDATION_VERSION,
    scope: { kind: employerId ? 'org' : 'platform', employer_id: employerId },
    domains: [
      { key: 'employer_foundation', label: 'Employer Foundation (Phase 5.1)', deliverables: employer },
      { key: 'job_architecture', label: 'Job Architecture (Phase 5.2)', deliverables: job },
    ],
    rollup: {
      deliverables_total: all.length,
      deliverables_with_data: withData,
      deliverables_absent: absent,
      deliverables_missing: missing,
      honest_state:
        missing > 0
          ? `${missing} deliverable(s) not provisioned`
          : withData === 0
            ? 'all deliverables provisioned but no operational data yet'
            : `${withData}/${all.length} deliverable(s) carry data`,
    },
    _meta: {
      read_only: true,
      composed: true,
      generated_at: new Date().toISOString(),
      disclaimer:
        'Compose-only read surface over canonical foundation deliverables. Deliverable names are compatibility views over single source tables (no duplicate data); job_templates is a thin additive gap-fill. Coverage and Confidence are separate axes; absent data is reported as absent, never fabricated. Cross-namespace role spines (cg_*/onto_*) are surfaced separately and never joined.',
    },
  };
}
