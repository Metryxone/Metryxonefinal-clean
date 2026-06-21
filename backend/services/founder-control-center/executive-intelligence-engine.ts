/**
 * Phase 6.15 — Executive Intelligence engine (executive_intelligence deliverable). READ-ONLY.
 *
 * Four composite health domains, each a mean of ONLY its measurable component scores
 * (each component normalised to 0..100). A domain with no measurable component is `null`
 * (band 'unmeasurable') — never a fabricated number:
 *   Customer Health    — engagement, profile activation, EI measurability.
 *   Institution Health — active-institution ratio.
 *   Employer Health    — verification, active-job ratio, candidate-decision throughput.
 *   Platform Health    — COMPOSED from Global Monitoring (subsystem coverage + alert clearance).
 */
import pg from 'pg';
import { buildGlobalMonitoring } from '../command-center/global-monitoring-engine';
import {
  safeScalar, tableExists, ratioPct, clampScore, meanMeasurable, healthBand, type HealthBand,
} from './founder-control-center-lib';

export interface HealthComponent {
  key: string;
  label: string;
  value: number | null; // 0..100
  measurable: boolean;
  detail: string;
}
export interface HealthDomain {
  key: string;
  label: string;
  score: number | null; // 0..100
  band: HealthBand;
  measurable: boolean;
  components: HealthComponent[];
}
export interface ExecutiveIntelligence {
  generated_at: string;
  degraded: boolean;
  domains: HealthDomain[];
  overall_score: number | null;
  overall_band: HealthBand;
  notes: string[];
}

function domainFrom(key: string, label: string, components: HealthComponent[]): HealthDomain {
  const score = meanMeasurable(components.map((c) => c.value));
  return { key, label, score, band: healthBand(score), measurable: score != null, components };
}

/** Component from numerator/denominator ratio; unmeasurable when the source is absent. */
async function ratioComponent(
  pool: pg.Pool, key: string, label: string, table: string, numWhere: string, denWhere = 'TRUE',
): Promise<HealthComponent> {
  const present = await tableExists(pool, table);
  if (!present) return { key, label, value: null, measurable: false, detail: `${table} absent` };
  const num = await safeScalar(pool, `SELECT COUNT(*)::int AS n FROM ${table} WHERE ${denWhere} AND (${numWhere})`);
  const den = await safeScalar(pool, `SELECT COUNT(*)::int AS n FROM ${table} WHERE ${denWhere}`);
  const value = ratioPct(num, den);
  return {
    key, label, value,
    measurable: value != null,
    detail: den == null || den === 0 ? `no rows in ${table}` : `${num ?? 0}/${den}`,
  };
}

export async function buildExecutiveIntelligence(pool: pg.Pool): Promise<ExecutiveIntelligence> {
  const generated_at = new Date().toISOString();
  let degraded = false;

  // ── Customer Health ───────────────────────────────────────────────────────────
  const engagement = await ratioComponent(
    pool, 'engagement', 'Assessment Completion', 'capadex_sessions',
    `lower(coalesce(status,'')) = 'completed'`,
  );
  const activation = await ratioComponent(
    pool, 'profile_activation', 'Profile Activation', 'career_seeker_profiles',
    `coalesce(completeness,0) >= 50`,
  );
  const eiMeasure = await ratioComponent(
    pool, 'ei_measurability', 'EI Measurability', 'ei_profile_snapshots',
    `coalesce(measurable,false) = true`,
  );
  const customer = domainFrom('customer_health', 'Customer Health', [engagement, activation, eiMeasure]);

  // ── Institution Health ─────────────────────────────────────────────────────────
  const instActive = await ratioComponent(
    pool, 'institution_active', 'Active Institutions', 'institutes',
    `lower(coalesce(status,'')) = 'active'`,
  );
  const institution = domainFrom('institution_health', 'Institution Health', [instActive]);

  // ── Employer Health ─────────────────────────────────────────────────────────────
  const empVerified = await ratioComponent(
    pool, 'employer_verified', 'Verified Employers', 'employer_organizations',
    `coalesce(verified,false) = true`,
  );
  const jobsActive = await ratioComponent(
    pool, 'jobs_active', 'Active Jobs', 'employer_jobs',
    `lower(coalesce(status,'')) IN ('open','active','published')`,
  );
  const candidateDecisions = await ratioComponent(
    pool, 'candidate_decisions', 'Candidate Decisions Reached', 'employer_candidates',
    `decision_at IS NOT NULL`,
  );
  const employer = domainFrom('employer_health', 'Employer Health', [empVerified, jobsActive, candidateDecisions]);

  // ── Platform Health — COMPOSED from Global Monitoring (never recompute) ──────────
  const monitoring = await buildGlobalMonitoring(pool);
  if (monitoring.degraded) degraded = true;
  const platformComponents: HealthComponent[] = [];
  {
    const { measurable, total } = monitoring.subsystem_coverage;
    platformComponents.push({
      key: 'subsystem_coverage', label: 'Subsystem Coverage',
      value: total > 0 ? clampScore((measurable / total) * 100) : null,
      measurable: total > 0, detail: `${measurable}/${total} subsystems measurable`,
    });
    const crit = monitoring.alerts.critical_escalations;
    platformComponents.push({
      key: 'escalation_clearance', label: 'Escalation Clearance',
      value: crit == null ? null : clampScore(100 - crit * 10),
      measurable: crit != null, detail: crit == null ? 'escalations unreadable' : `${crit} critical open`,
    });
    const gov = monitoring.alerts.active_governance_alerts;
    platformComponents.push({
      key: 'governance_clearance', label: 'Governance Clearance',
      value: gov == null ? null : clampScore(100 - gov * 5),
      measurable: gov != null, detail: gov == null ? 'governance alerts unreadable' : `${gov} active alerts`,
    });
  }
  const platform = domainFrom('platform_health', 'Platform Health', platformComponents);

  const domains = [customer, institution, employer, platform];
  const overall_score = meanMeasurable(domains.map((d) => d.score));

  return {
    generated_at,
    degraded,
    domains,
    overall_score,
    overall_band: healthBand(overall_score),
    notes: [
      'Each health score is the mean of ONLY its measurable components; a domain with no measurable input is null (unmeasurable), never 0.',
      'Platform Health is composed from the Global Monitoring engine — counts are not recomputed here.',
      'Ratios over an empty source are unmeasurable (no denominator), not 0%.',
    ],
  };
}
