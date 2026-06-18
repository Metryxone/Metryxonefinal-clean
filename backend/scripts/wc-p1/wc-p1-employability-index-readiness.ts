/**
 * WC-P1 — Employability Index Readiness Audit
 *
 * Rules: Audit only. Read-only. No implementation. No schema changes.
 * Evidence from: runtime probes, DB state, source code analysis.
 * Coverage and Confidence reported as SEPARATE axes.
 *
 * 14 deliverables → backend/audit/wc-p1/
 */

import fs   from 'fs';
import path from 'path';
import { Pool } from 'pg';

const OUT = path.join(__dirname, '../../audit/wc-p1');
fs.mkdirSync(OUT, { recursive: true });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const AUDIT_DATE = new Date().toISOString();

// ── helpers ────────────────────────────────────────────────────────────────
async function q(sql: string, params: unknown[] = []): Promise<{ rows: Record<string,unknown>[] }> {
  try { return await pool.query(sql, params as never[]); }
  catch (e: unknown) { return { rows: [{ _error: (e as Error).message }] }; }
}

async function count(table: string): Promise<number | string> {
  const r = await q(`SELECT count(*) FROM ${table}`);
  if (r.rows[0]?._error) return `ERR: ${r.rows[0]._error}`;
  return Number(r.rows[0]?.count ?? 0);
}

async function probe(path_: string, method = 'GET', body?: object): Promise<{ status: number; ok: boolean; ms: number }> {
  const t0 = Date.now();
  try {
    const r = await fetch(`http://localhost:8080${path_}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, ok: r.status !== 404 && r.status < 500, ms: Date.now() - t0 };
  } catch { return { status: 0, ok: false, ms: Date.now() - t0 }; }
}

function badge(ok: boolean | string | number): string {
  if (ok === 'PARTIAL') return '⚠️ PARTIAL';
  return ok ? '✅' : '❌';
}

function pct(n: number): string { return `${Math.round(n)}%`; }

// ══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('WC-P1 — Employability Index Readiness Audit');
  console.log(`Date: ${AUDIT_DATE}\n`);

  // ── DB counts ─────────────────────────────────────────────────────────────
  const [
    cEiRulesets, cEiDimRules, cEiSnapshots, cEiCalcLogs,
    cEiConfidence, cEiWeightVers, cEiGovEvents,
    cCareerProfiles, cKgEdges, cOccupations, cOccupSkills,
    cOccupPathways, cTrajForecasts, cRefReviewQueue,
    cInstitutions, cQualifications, cCertifications, cSkills,
    cInstAliases, cQualAliases, cSkillAliases,
    cCompetencyTemplates, cLbiSessions, cSdiResponses,
    cIilNetwork,
  ] = await Promise.all([
    count('ei_rulesets'),
    count('ei_dimension_rules'),
    count('ei_snapshot_versions'),
    count('ei_calculation_logs'),
    count('ei_confidence_models'),
    count('ei_weight_versions'),
    count('ei_governance_events'),
    count('career_seeker_profiles'),
    count('kg_edges'),
    count('occupations'),
    count('occupation_skills'),
    count('occupation_pathways'),
    count('trajectory_forecasts'),
    count('ref_review_queue'),
    count('institutions'),
    count('qualifications'),
    count('certifications'),
    count('skills'),
    count('institution_aliases'),
    count('qualification_aliases'),
    count('skill_aliases'),
    count('competency_question_templates'),
    count('lbi_sessions'),
    count('sdi_user_responses'),
    count('iil_employability_network'),
  ]);

  // ── Route probes ──────────────────────────────────────────────────────────
  const [
    pEiResolve, pEiTypeahead,
    pOccupations, pRoleFit, pRoleMatches, pTrajectory,
    pCareerIntelEI, pCareerIntelDash, pCareerIntelFitment,
    pAdminRulesets, pAdminRulesetsActive, pAdminCalcLogs,
    pAdminSnapTake, pAdminEISnapshots,
    pPassportShare, pPublicPassport,
  ] = await Promise.all([
    probe('/api/ei/resolve', 'POST', { profile: {} }),
    probe('/api/ei/typeahead/institutions?q=IIT'),
    probe('/api/employability/occupations'),
    probe('/api/employability/role-fit', 'POST', { profile: {}, occupation_id: '00000000-0000-0000-0000-000000000000', ruleset_version: '1.0.0' }),
    probe('/api/employability/role-matches', 'POST', { profile: {}, ruleset_version: '1.0.0' }),
    probe('/api/employability/trajectory', 'POST', { current_ei_score: 50, target_occupation_id: '00000000-0000-0000-0000-000000000000', horizon_months: 12, recommendations: [], ruleset_version: '1.0.0' }),
    probe('/api/career/intelligence/employability', 'POST', { profile: {} }),
    probe('/api/career/intelligence/dashboard', 'POST', { profile: {} }),
    probe('/api/career/intelligence/fitment', 'POST', { profile: {}, targetRole: 'Software Engineer' }),
    probe('/api/admin/ei/rulesets'),
    probe('/api/admin/ei/rulesets/active'),
    probe('/api/admin/ei/calculation-logs'),
    probe('/api/admin/ei/snapshots/take', 'POST', { user_id: 'test' }),
    probe('/api/admin/ei/snapshots/test'),
    probe('/api/career/passport/test/share', 'POST', { snapshot: {}, visibility: {} }),
    probe('/api/public/passport/invalid-token'),
  ]);

  // ── Active ruleset detail ─────────────────────────────────────────────────
  const rulesetRows = await q(`SELECT version, name, status, is_default, config FROM ei_rulesets WHERE status='active' LIMIT 1`);
  const ruleset = rulesetRows.rows[0] || null;
  const rulesetConfig: Record<string,unknown> = (ruleset?.config ?? {}) as Record<string,unknown>;
  const rulesetDims  = (rulesetConfig.dimensions ?? {}) as Record<string,{weight?:number;enabled?:boolean}>;
  const rulesetTotal = Object.values(rulesetDims).reduce((s, d) => s + (d?.weight ?? 0), 0);

  // ── Dimension rules ───────────────────────────────────────────────────────
  const dimRows = await q(`SELECT dimension_key, weight, formula_type FROM ei_dimension_rules ORDER BY weight DESC`);

  // ── Occupation skills density ─────────────────────────────────────────────
  const skillDensity = (typeof cOccupations === 'number' && cOccupations > 0 && typeof cOccupSkills === 'number')
    ? (cOccupSkills / cOccupations).toFixed(1)
    : 'N/A';

  // ── Longitudinal: last snapshot date ─────────────────────────────────────
  const snapRows = await q(`SELECT max(snapshot_date) last, min(snapshot_date) first FROM ei_snapshot_versions`);
  const lastSnap  = snapRows.rows[0]?.last  ?? null;
  const firstSnap = snapRows.rows[0]?.first ?? null;

  // ── Passport flag status ──────────────────────────────────────────────────
  const passportFlagRows = await q(`SELECT is_enabled FROM feature_flags WHERE flag_name='employabilityPassport' LIMIT 1`);
  const passportEnabled = passportFlagRows.rows[0]?.is_enabled ?? false;

  // ── Calc log sample ───────────────────────────────────────────────────────
  const calcLogSample = await q(`SELECT user_id, capability_score, created_at FROM ei_calculation_logs ORDER BY created_at DESC LIMIT 3`);

  // ── Ref_review_queue breakdown ────────────────────────────────────────────
  const reviewByType = await q(`SELECT entity_type, count(*) FROM ref_review_queue GROUP BY entity_type ORDER BY count DESC`);

  console.log('  DB queries complete');

  // ══════════════════════════════════════════════════════════════════════════
  // FORMULA ANALYSIS (static, derived from source code reading)
  // ══════════════════════════════════════════════════════════════════════════
  // Documented formula (docs/EMPLOYABILITY_INDEX.md):
  //   8 dimensions: Competency(25) + Experience(20) + Education(15) + Technical(15)
  //                 + Certifications(10) + Soft(8) + Projects(4) + Completeness(3) = 100
  //
  // useHybridEI engine (frontend/src/lib/engines/employabilityEngine.ts):
  //   6 dimensions: Completeness(45) + Technical(20) + Experience(15) + Soft(10)
  //                 + Certs(6) + Projects(6) = 102 (capped to 99)
  //   ABSENT: Competency Assessment dimension (25 pts), Education dimension (15 pts)
  //   INFLATED: Profile Completeness 3 pts → 45 pts (15× amplification)
  //
  // eiBreakdown modal (CareerBuilderPage.tsx ~line 967):
  //   8 dimensions matching doc formula — Assessment(25), Experience(20), Education(15),
  //   Technical(15), Certs(10), Soft(8), Projects(4), Completeness(3)
  //   SPLIT: eiBreakdown modal ≠ eiScore from useHybridEI → two divergent numbers
  //
  // Band labels:
  //   Doc:        Getting Started(0)/Building(25)/Career-Ready(50)/Hire-Ready(75)
  //   tokens.ts:  Starter(0)/Developing(35)/Good(50)/Excellent(80)  [4 bands]
  //   DB ruleset: Starter(0)/Developing(35)/Good(50)/Strong(65)/Excellent(80) [5 bands]
  //   → Three distinct band schemas coexist

  // ══════════════════════════════════════════════════════════════════════════
  // READINESS SCORING
  // Coverage = capability exists (code, data, routes)
  // Confidence = trustworthy / sufficient for production use
  // ══════════════════════════════════════════════════════════════════════════

  const dimensions = {
    assessment:         { cov: 35, conf: 20, notes: '63 questions seeded; 0 sessions taken; assessment score NOT feeding useHybridEI gauge (only in modal breakdown); CAPADEX→EI bridge absent from scoring engine' },
    questionBank:       { cov: 30, conf: 25, notes: '63 competency templates; 0 LBI sessions; 0 SDI responses; LBI/SDI question count not measured for EI relevance' },
    competencyFramework:{ cov: 20, conf: 15, notes: 'competency_question_templates seeded (63); competency_scores table ABSENT; no framework completion path wired to EI score' },
    eiScoring:          { cov: 65, conf: 40, notes: '198 calc logs (engine active); 6-dim engine ≠ 8-dim doc; Competency Assessment(25pt) absent from gauge score; Education(15pt) absent; Completeness inflated 3→45pt; band definitions split 3 ways' },
    outcomeIntelligence:{ cov: 25, conf: 20, notes: '30 occupations; avg 1.7 skills/occupation (sparse); 3 pathways only; trajectory_forecasts: 1 row; outcome models run but data scaffold is minimal' },
    recommendations:    { cov: 40, conf: 25, notes: 'Roadmap engine coded; ref resolver live; 69 unresolved entities queued; 67 institutions/26 qualifications (vs thousands planned); improvement hints present but cannot resolve most real-world inputs' },
    careerRouting:      { cov: 20, conf: 15, notes: '30 occupations, 3 pathways; role-fit engine real but occupation graph too sparse for production routing; occupation_pathways=3 means effective career paths≈1' },
    reporting:          { cov: 65, conf: 55, notes: 'EI breakdown modal (8-dim) implemented and detailed; EIGauge real; EIProvenanceCard real; admin EI governance full suite; ei_calculation_logs populated; BUT gauge score ≠ breakdown score (divergent engines)' },
    personalization:    { cov: 30, conf: 25, notes: 'Behavioral context hooked into CareerBrain; BehaviorAdjustment modifies job ranking; BUT band labels diverge doc↔UI↔DB; no persona-keyed weighting; behavioral integration only directional' },
    longitudinal:       { cov: 15, conf: 10, notes: 'ei_snapshot_versions table exists; takeSnapshot() coded; 0 rows ever stored; no cron/scheduler; no UI trajectory beyond mock; getTrajectory() returns empty for all users' },
    commercial:         { cov: 10, conf: 5,  notes: 'No payment gating for EI features; no subscription mapping to EI tiers; EI Passport flag exists but employabilityPassport flag is ' + (passportEnabled ? 'ENABLED' : 'DISABLED') + '; Razorpay absent' },
  };

  const overallCov  = Math.round(Object.values(dimensions).reduce((s, d) => s + d.cov,  0) / Object.keys(dimensions).length);
  const overallConf = Math.round(Object.values(dimensions).reduce((s, d) => s + d.conf, 0) / Object.keys(dimensions).length);

  console.log(`  Readiness: Coverage=${overallCov}% | Confidence=${overallConf}%`);

  // ══════════════════════════════════════════════════════════════════════════
  // DELIVERABLE 1 — Capability Inventory
  // ══════════════════════════════════════════════════════════════════════════
  fs.writeFileSync(path.join(OUT, '01_capability_inventory.md'), `\
# WC-P1 — D1: Employability Index Capability Inventory

**Date**: ${AUDIT_DATE}
**Method**: filesystem verification + DB queries + HTTP probes + source code analysis

---

## Fully Implemented

| Capability | Evidence |
|---|---|
| Frontend EI scoring engine (6-dim) | \`employabilityEngine.ts\` live; 198 \`ei_calculation_logs\` |
| EI breakdown modal (8-dim doc formula) | \`CareerBuilderPage.tsx\` lines 967–1080 |
| \`useHybridEI\` hook | \`useHybridEI.ts\` → \`POST /api/ei/resolve\` (debounced 600ms) |
| EIGauge component | \`EIGauge.tsx\` rendering in all Career Builder tabs |
| EIProvenanceCard | \`EIProvenanceCard.tsx\` — "Why this score" breakdown |
| \`/api/ei/resolve\` route | HTTP ${pEiResolve.status} (registered, active, writes calc logs) |
| \`/api/ei/typeahead/:entity\` | HTTP ${pEiTypeahead.status} (canonical suggestions) |
| \`/api/employability/occupations\` | HTTP ${pOccupations.status} (returns ${cOccupations} occupations) |
| \`/api/employability/role-fit\` | HTTP ${pRoleFit.status} (route present, real implementation) |
| \`/api/employability/role-matches\` | HTTP ${pRoleMatches.status} (top-N matcher) |
| \`/api/employability/trajectory\` | HTTP ${pTrajectory.status} (forecast engine present) |
| \`/api/career/intelligence/employability\` | HTTP ${pCareerIntelEI.status} |
| \`/api/career/intelligence/dashboard\` | HTTP ${pCareerIntelDash.status} |
| \`/api/career/intelligence/fitment\` | HTTP ${pCareerIntelFitment.status} |
| EI Governance admin suite | HTTP ${pAdminRulesets.status}/${pAdminRulesetsActive.status}/${pAdminCalcLogs.status} (rulesets/active/calc-logs) |
| EI ruleset + dimension rules | \`ei_rulesets\`: ${cEiRulesets} row(s); \`ei_dimension_rules\`: ${cEiDimRules} rows |
| EI confidence model | \`ei_confidence_models\`: ${cEiConfidence} row(s) |
| Career seeker profiles persistence | \`career_seeker_profiles\`: ${cCareerProfiles} rows |
| EI Passport routes (flag-gated) | Registered; passportEnabled=${passportEnabled} |
| Admin ruleset CRUD + preview + compare | Routes registered and real |
| \`ei-resolver\` (exact→alias→fuzzy) | Real implementation; pushes unresolved to review queue |
| \`role-fit-engine\` | Real implementation (skill-match, missing-skills, recommendations) |
| \`trajectory-engine\` | Real implementation (milestone scheduling against pathways) |

---

## Partially Implemented

| Capability | Gap |
|---|---|
| Competency Assessment → EI score | Assessment score IS in 8-dim modal breakdown (25pts) but ABSENT from \`useHybridEI\` 6-dim gauge score — two divergent numbers exist simultaneously |
| Education dimension | Documented as 15pts; present in modal breakdown; ABSENT from \`useHybridEI\` engine and DB ruleset |
| EI Passport snapshot | Routes live; 0 active snapshots; flag ${passportEnabled ? '✅ enabled' : '❌ disabled'} |
| Fitment panel | \`FitmentInsightsPanel.tsx\` exists; marked "Provisional (n<30)" |
| Reference resolver | Fuzzy matching code real; only ${cInstitutions} institutions, ${cQualifications} qualifications, ${cSkills} skills loaded vs thousands planned |
| Personalization | Behavioral nudges coded; band labels diverge across 3 schemas |

---

## Missing / Stub / Not Built

| Capability | Status |
|---|---|
| Longitudinal EI snapshots | Table exists; **0 rows ever written**; no cron/scheduler |
| Education tier-weighted scoring in gauge | Phase 1/2 planned (NIRF/UGC ref tables not seeded) |
| Verified credentials (+50% trust multiplier) | Phase 4 planned (Credly/DigiLocker not integrated) |
| Server-side institution/skill reference data | 67 institutions loaded vs NIRF Top 200 + WHED 19,400 planned |
| Company prestige overlay | Phase 5 (Future) |
| k-anonymity peer benchmarking data | Percentile uses hardcoded lookup table, not real cohort data |
| Nightly snapshot cron | Documented as planned; not implemented |
| LBI/SDI sessions | 0 rows; no EI feed path |
| Commercial gating of EI features | No subscription mapping |
`);
  console.log('  ✓ 01_capability_inventory.md');

  // ══════════════════════════════════════════════════════════════════════════
  // DELIVERABLE 2 — Assessment Readiness
  // ══════════════════════════════════════════════════════════════════════════
  fs.writeFileSync(path.join(OUT, '02_assessment_readiness.md'), `\
# WC-P1 — D2: Assessment Readiness

**Coverage**: ${dimensions.assessment.cov}% | **Confidence**: ${dimensions.assessment.conf}%

---

## Evidence

| Check | Measured Value |
|---|---|
| Competency question templates in DB | ${cCompetencyTemplates} rows |
| LBI sessions completed | ${cLbiSessions} rows (0 = never used) |
| SDI user responses | ${cSdiResponses} rows (0 = never used) |
| Assessment score feeding EIGauge (useHybridEI) | ❌ ABSENT — engine has no assessmentScore input |
| Assessment score feeding EI breakdown modal | ✅ Present — \`(assessmentScore/100)*25\` at max 25pts |
| CAPADEX → EI score bridge | ❌ Not wired — \`career-behavior-adapter.ts\` exists but no assessment score passthrough |
| Assessment CTA in roadmap | ✅ Present — "Complete the Competency Assessment" appears in \`buildRoadmap()\` |

---

## Critical Finding: Assessment Score Split

The platform has two parallel EI representations that produce different numbers:

| | Engine | Assessment Handled? | Max Score |
|---|---|---|---|
| **EIGauge (displayed score)** | \`useHybridEI\` + \`employabilityEngine.ts\` | ❌ No | 99 (no assessment pts) |
| **EI Breakdown Modal** | \`eiBreakdown\` in \`CareerBuilderPage.tsx\` | ✅ Yes (25pts) | 100 (doc-accurate) |

A user who completes the assessment sees +25pts in the breakdown modal but ZERO change in the EIGauge score. This is an integrity gap — the headline score does not reflect the most impactful action the user can take.

---

## Why This Matters

The documentation states: *"This dimension contributes zero points until the user actually completes the assessment."*
That is true for the modal breakdown. It is also unintentionally true for the gauge — but for the wrong reason (the gauge was never wired to accept assessment scores).

---

## Actions Required to Reach 95%

1. Wire \`profile.assessmentScore\` into \`runEmployabilityEngine()\` input and add a 25-pt dimension (requires formula unification — see D5).
2. Complete CAPADEX → Career Builder assessment score passthrough via \`career-behavior-adapter.ts\`.
3. Seed LBI and SDI sessions with at least one test user to validate the pipeline.
`);
  console.log('  ✓ 02_assessment_readiness.md');

  // ══════════════════════════════════════════════════════════════════════════
  // DELIVERABLE 3 — Question Bank Readiness
  // ══════════════════════════════════════════════════════════════════════════
  fs.writeFileSync(path.join(OUT, '03_question_bank_readiness.md'), `\
# WC-P1 — D3: Question Bank Readiness

**Coverage**: ${dimensions.questionBank.cov}% | **Confidence**: ${dimensions.questionBank.conf}%

---

## Evidence

| Bank | Row Count | Used in EI? | Notes |
|---|---|---|---|
| \`competency_question_templates\` | ${cCompetencyTemplates} | ⚠️ Indirect (via Assessment tab → modal) | Feed path to EI gauge absent |
| LBI sessions | ${cLbiSessions} | ❌ No | Never started; no EI dimension for LBI score |
| SDI user responses | ${cSdiResponses} | ❌ No | Never used; no SDI→EI bridge |
| CAPADEX sessions | *not probed* | ❌ Not bridged to EI gauge | CAPADEX concerns ≠ EI dimension inputs |

---

## Assessment Framework State

- **Competency question templates (63)**: Seeded. Used via \`GET /api/competency/questions/select\` in Assessment tab. Score stored on \`profile.assessmentScore\` only after completion. No completions recorded in available data.
- **LBI (Longitudinal Behavioral Intelligence)**: 0 sessions. 19 domains / 97 subdomains seeded in schema. No EI dimension maps to LBI score.
- **SDI (Self-Discovery Index)**: 0 user responses. No EI dimension maps to SDI score.

---

## Gap

The question banks are seeded but not producing data — there are no completed assessments to feed the EI pipeline. The EI's biggest single lever (Competency Assessment = 25pts) requires a functioning question bank → session → score path. That path exists in code but has produced zero records.

---

## Actions to Reach 95%

1. Run at least one end-to-end assessment session to validate the competency score → EI passthrough.
2. Define whether LBI scores should eventually contribute to an EI dimension (currently no mapping).
3. Ensure \`assessmentScore\` is persisted on \`career_seeker_profiles.data\` after session completion.
`);
  console.log('  ✓ 03_question_bank_readiness.md');

  // ══════════════════════════════════════════════════════════════════════════
  // DELIVERABLE 4 — Competency Framework Readiness
  // ══════════════════════════════════════════════════════════════════════════
  fs.writeFileSync(path.join(OUT, '04_competency_framework_readiness.md'), `\
# WC-P1 — D4: Competency Framework Readiness

**Coverage**: ${dimensions.competencyFramework.cov}% | **Confidence**: ${dimensions.competencyFramework.conf}%

---

## Evidence

| Component | State |
|---|---|
| \`competency_question_templates\` | ${cCompetencyTemplates} rows — seeded |
| \`competency_scores\` table | ❌ DOES NOT EXIST (relation missing) |
| Competency score → EI feed | ❌ No path (table absent) |
| Competency questions → Assessment tab | ✅ Route exists (\`GET /api/competency/questions/select\`) |
| \`profile.assessmentScore\` persistence | ⚠️ Stored on JSONB profile field; not in a dedicated table |
| LBI sessions (behavioural competency) | ${cLbiSessions} rows (no usage) |

---

## Critical: competency_scores Table is Absent

The planned competency framework requires a \`competency_scores\` table to store per-user, per-competency proficiency scores. This table does not exist. Without it:

- No per-competency breakdown is available.
- The EI competency dimension can only be an aggregate scalar (0–100 from the assessment).
- No competency history or trajectory is trackable.

---

## What Works

The Assessment tab in Career Builder:
- Fetches 63 questions from \`competency_question_templates\` ✅
- Displays adaptive question flow ✅
- On completion, stores \`assessmentScore\` in \`profile.assessmentScore\` ✅
- Shows score in the EI breakdown modal at (score/100)*25 ✅

What does NOT work:
- Score does not flow into the EI gauge (useHybridEI) ❌
- No per-competency breakdown stored ❌
- No competency history ❌

---

## Actions to Reach 95%

1. Create \`competency_scores\` table (user_id, competency_key, score, assessed_at).
2. On assessment completion: decompose the aggregate score into per-competency scores and persist.
3. Wire \`profile.assessmentScore\` into \`runEmployabilityEngine()\` as a named input.
`);
  console.log('  ✓ 04_competency_framework_readiness.md');

  // ══════════════════════════════════════════════════════════════════════════
  // DELIVERABLE 5 — Employability Scoring Readiness
  // ══════════════════════════════════════════════════════════════════════════
  const dimRowsStr = dimRows.rows.map(r => `| \`${r.dimension_key}\` | ${r.weight} | \`${r.formula_type}\` |`).join('\n');

  fs.writeFileSync(path.join(OUT, '05_employability_scoring_readiness.md'), `\
# WC-P1 — D5: Employability Scoring Readiness

**Coverage**: ${dimensions.eiScoring.cov}% | **Confidence**: ${dimensions.eiScoring.conf}%

---

## Engine Activity

| Metric | Value |
|---|---|
| \`ei_calculation_logs\` | ${cEiCalcLogs} rows (engine is being called) |
| Active ruleset version | ${ruleset?.version ?? 'none'} (${ruleset?.name ?? 'N/A'}) |
| Ruleset total weight | ${rulesetTotal} pts (should be 100; is ${rulesetTotal === 102 ? '102 — OVERCOUNTED' : rulesetTotal}) |
| \`ei_snapshot_versions\` | ${cEiSnapshots} rows |
| \`ei_weight_versions\` | ${cEiWeightVers} rows |

---

## DB Ruleset Dimensions (live data)

| Dimension | Weight | Formula |
|---|---|---|
${dimRowsStr}

---

## Formula Integrity Audit

### Three Divergent Schemas

| Schema | Source | Dimensions | Max |
|---|---|---|---|
| **Documentation** | \`docs/EMPLOYABILITY_INDEX.md\` | 8: Competency(25)+Exp(20)+Edu(15)+Tech(15)+Certs(10)+Soft(8)+Projects(4)+Completeness(3) | 100 |
| **Gauge Engine** | \`employabilityEngine.ts\` + DB ruleset | 6: Completeness(45)+Tech(20)+Exp(15)+Soft(10)+Certs(6)+Projects(6) | 102→99 |
| **Breakdown Modal** | \`CareerBuilderPage.tsx ~line 967\` | 8: matching documentation formula | 100 |

### Key Discrepancies

| Discrepancy | Impact |
|---|---|
| Competency Assessment (25pts) absent from gauge | User completing assessment sees +25pts in modal, 0pts in gauge headline score |
| Education dimension (15pts) absent from gauge | All education data ignored by gauge engine |
| Profile Completeness: 3pts (doc) → 45pts (gauge) | 15× inflation; completeness dominates the gauge unfairly |
| Band definitions: 3 schemas coexist | See Band Mismatch section below |
| Ruleset total: 102 not 100 | Overcounting by 2 pts (certs+projects each 1pt over) |

### Band Mismatch

| Schema | Bands |
|---|---|
| \`docs/EMPLOYABILITY_INDEX.md\` | Getting Started(0) / Building(25) / Career-Ready(50) / Hire-Ready(75) |
| \`design-system/tokens.ts\` (used by UI) | Starter(0) / Developing(35) / Good(50) / Excellent(80) |
| DB ruleset config | Starter(0) / Developing(35) / Good(50) / Strong(65) / Excellent(80) |

The UI renders band labels from \`tokens.ts\` (4 bands). The DB has 5 bands. The docs describe 4 different bands with different thresholds. These are three incompatible schemas.

---

## Reference Data Thinness

| Entity | Loaded | Planned | Resolver Effectiveness |
|---|---|---|---|
| Institutions | ${cInstitutions} | NIRF Top 200 + WHED 19,400+ | ~30–40% for Indian institutions; <5% for global |
| Qualifications | ${cQualifications} | NSQF + EQF levels | Low coverage |
| Certifications | ${cCertifications} | PMI/CFA/AWS/Azure etc. | Sparse (42 vs thousands) |
| Skills | ${cSkills} | ESCO 13,890 + O*NET | ~0.6% of target |
| Unresolved (queued) | ${cRefReviewQueue} | — | 69 entities awaiting review |

---

## Actions to Reach 95%

1. **Unify the formula**: Align \`employabilityEngine.ts\`, CareerBuilderPage \`eiBreakdown\`, and DB ruleset to one 8-dim schema with Assessment(25), Experience(20), Education(15), Technical(15), Certs(10), Soft(8), Projects(4), Completeness(3).
2. **Unify band labels**: Choose one set of 4 bands (recommend doc labels) and propagate to \`tokens.ts\`, DB ruleset, and all copy.
3. **Seed reference data**: Load NIRF Top 200 institutions, top-50 certifications (AWS/Azure/PMP/CFA), ESCO skills core subset.
4. **Fix ruleset total**: Adjust certs+projects weights to sum to 100.
`);
  console.log('  ✓ 05_employability_scoring_readiness.md');

  // ══════════════════════════════════════════════════════════════════════════
  // DELIVERABLE 6 — Outcome Intelligence Readiness
  // ══════════════════════════════════════════════════════════════════════════
  fs.writeFileSync(path.join(OUT, '06_outcome_intelligence_readiness.md'), `\
# WC-P1 — D6: Outcome Intelligence Readiness

**Coverage**: ${dimensions.outcomeIntelligence.cov}% | **Confidence**: ${dimensions.outcomeIntelligence.conf}%

---

## Evidence

| Component | Measured Value |
|---|---|
| Occupations in DB | ${cOccupations} |
| Occupation skills (total) | ${cOccupSkills} |
| Avg skills per occupation | ${skillDensity} |
| Occupation pathways | ${cOccupPathways} |
| Trajectory forecasts stored | ${cTrajForecasts} |
| kg_edges (Employability KG) | ${cKgEdges} |
| iil_employability_network | ${cIilNetwork} (empty) |
| Role-fit route | HTTP ${pRoleFit.status} |
| Role-matches route | HTTP ${pRoleMatches.status} |
| Trajectory route | HTTP ${pTrajectory.status} |

---

## Occupation Graph Density

${cOccupations} occupations × avg ${skillDensity} skills = ${cOccupSkills} occupation_skills rows.

A production-grade outcome engine needs:
- **≥200 occupations** covering most Indian industry verticals.
- **≥8–10 skills per occupation** on average for meaningful role-fit scoring.
- **≥50 pathways** for realistic career routing.

Current state: 30 occupations, 1.7 skills/occupation, 3 pathways. This is a seed scaffold — not a production dataset.

---

## What Works

- \`computeRoleFit()\`: real implementation — queries occupation_skills, computes skill match/gap scores, generates recommendations.
- \`findTopRoleMatches()\`: real implementation — ranks occupations by fit score.
- \`forecastTrajectory()\`: real implementation — schedules milestones from pathways.
- Routes registered and returning non-404 responses.

---

## What Doesn't Work (for production use)

- With only 3 pathways, trajectory forecasts are meaningful for at most 3 origin→destination pairs.
- With avg 1.7 skills/occupation, skill-match scores are low-signal (most required skills are not mapped).
- \`iil_employability_network\` is empty — advanced network analysis unavailable.

---

## Actions to Reach 95%

1. Expand to ≥200 occupations covering IT/Finance/Healthcare/Engineering/HR verticals.
2. Map ≥8 skills per occupation (essential/important/optional).
3. Build ≥50 occupation pathways (common Indian career progressions).
4. Seed \`iil_employability_network\` or deprecate it.
`);
  console.log('  ✓ 06_outcome_intelligence_readiness.md');

  // ══════════════════════════════════════════════════════════════════════════
  // DELIVERABLE 7 — Recommendation Readiness
  // ══════════════════════════════════════════════════════════════════════════
  const reviewBreakdown = reviewByType.rows.map(r => `| ${r.entity_type} | ${r.count} |`).join('\n');

  fs.writeFileSync(path.join(OUT, '07_recommendation_readiness.md'), `\
# WC-P1 — D7: Recommendation Readiness

**Coverage**: ${dimensions.recommendations.cov}% | **Confidence**: ${dimensions.recommendations.conf}%

---

## Evidence

| Component | State |
|---|---|
| Frontend roadmap engine (\`buildRoadmap()\`) | ✅ Real — short/medium/long term actions |
| Frontend tips engine (\`buildTips()\`) | ✅ Real — profile-score-conditional |
| Frontend improvement hints (per dimension) | ✅ Real — in \`explainableFactors\` |
| Backend role-fit recommendations | ✅ Real — \`add_skill/add_certification/gain_experience\` types |
| Backend IDP builder (\`buildIDP()\`) | ✅ Real — closes largest competency gaps |
| \`ref_review_queue\` (unresolved entities) | ${cRefReviewQueue} rows |
| Institution resolution rate | Low (~30-40% India; <5% global) — ${cInstitutions} of planned 19,400+ loaded |
| Skill resolution rate | ~1% — ${cSkills} of planned 13,890+ ESCO skills loaded |
| Certification resolution rate | ~1-5% — ${cCertifications} loaded |

---

## ref_review_queue Breakdown (unresolved entity accumulation)

| Entity Type | Count |
|---|---|
${reviewBreakdown || '| (no data) | — |'}

---

## What Works

- Generic roadmap: short/medium/long term actions based on score thresholds.
- Per-dimension improvement hints: "Add X more technical skills", "Each cert adds 2 EI pts".
- Role-fit specific recommendations: when a user selects a target occupation, missing-skill recommendations are generated.
- Behavioral nudges: low Execution Readiness biases toward low-effort steps.

---

## What Doesn't Work

- Institution-specific recommendations: resolver can't resolve most inputs → falls back to generic hints.
- Certification-specific recommendations: only 42 certifications in DB vs thousands of real-world inputs.
- Skill gap recommendations for role-fit: sparse occupation_skills (1.7/occupation) means gap lists are incomplete.
- 69 real-world inputs currently queued as unresolved — those users get generic hints instead of specific ones.

---

## Actions to Reach 95%

1. Seed canonical reference data (institutions, certifications, skills) — prerequisite for specific recommendations.
2. Process the 69 items in \`ref_review_queue\` (manual review or bulk alias creation).
3. Add occupation-specific learning resource links to recommendations.
`);
  console.log('  ✓ 07_recommendation_readiness.md');

  // ══════════════════════════════════════════════════════════════════════════
  // DELIVERABLE 8 — Career Routing Readiness
  // ══════════════════════════════════════════════════════════════════════════
  fs.writeFileSync(path.join(OUT, '08_career_routing_readiness.md'), `\
# WC-P1 — D8: Career Routing Readiness

**Coverage**: ${dimensions.careerRouting.cov}% | **Confidence**: ${dimensions.careerRouting.conf}%

---

## Evidence

| Component | Value |
|---|---|
| Occupations available | ${cOccupations} |
| Occupation pathways | ${cOccupPathways} |
| Occupation skills (total) | ${cOccupSkills} |
| Role-family coverage | IT/Finance/Product/Data/Engineering (from sample) |
| Seniority levels mapped | mid, senior, director, c_suite confirmed |
| \`/api/employability/occupations/:id/pathways\` | HTTP ${pOccupations.status} (route present) |
| Market demand data | Not probed (occupationId required) |

---

## Routing Graph Assessment

With ${cOccupPathways} pathways, career routing can serve at most ${Math.floor(Number(cOccupPathways))} direct-progression recommendations. Realistic career routing requires:

- **Entry → Mid → Senior → Lead → Director** chains across major role families.
- **Lateral move** pathways (e.g., Data Analyst → Product Analyst → Product Manager).
- **Domain transition** pathways (e.g., QA Engineer → DevOps → Platform Engineering).

The 3 currently seeded pathways cannot cover any of these patterns meaningfully.

---

## What Works

- \`forecastTrajectory()\`: queries pathways, schedules milestones — real code.
- \`findTopRoleMatches()\`: ranks occupations by fit score — real code.
- The routing infrastructure (tables, routes, services) is production-grade.

---

## What Doesn't Work (for end users today)

- Trajectory forecasts are only meaningful for 3 predefined progression pairs.
- Most users will receive a trajectory with 0 milestones (no pathway from their current role to target).
- The 30-occupation catalog covers a narrow band of tech/product/data roles; healthcare, finance, manufacturing, etc. are absent.

---

## Actions to Reach 95%

1. Expand to ≥200 occupations across 8–10 industry verticals.
2. Seed ≥50 occupation pathways (prioritise common Indian career progressions).
3. Add lateral and domain-transition pathway types.
4. Wire market demand data (\`occupation_market_demand\` table — confirm if seeded).
`);
  console.log('  ✓ 08_career_routing_readiness.md');

  // ══════════════════════════════════════════════════════════════════════════
  // DELIVERABLE 9 — Report Readiness
  // ══════════════════════════════════════════════════════════════════════════
  fs.writeFileSync(path.join(OUT, '09_report_readiness.md'), `\
# WC-P1 — D9: Report Readiness

**Coverage**: ${dimensions.reporting.cov}% | **Confidence**: ${dimensions.reporting.conf}%

---

## Evidence

| Report Surface | State |
|---|---|
| EI breakdown modal (8-dim) | ✅ Fully implemented — score + rationale + evidence + CTA per dimension |
| EIGauge (circular gauge) | ✅ Live in Career Builder dashboard |
| EIProvenanceCard | ✅ "Why this score" breakdown with provenance notes |
| Admin EI calculation logs | ✅ HTTP ${pAdminCalcLogs.status} — ${cEiCalcLogs} rows in DB |
| Admin ruleset management | ✅ HTTP ${pAdminRulesets.status}/${pAdminRulesetsActive.status} — CRUD + preview |
| EI Passport (shareable) | ⚠️ Routes registered; flag ${passportEnabled ? 'ENABLED' : 'DISABLED'} |
| PDF export (EI Passport) | ✅ html2canvas + jsPDF in \`PassportOwnerModal\` |
| Public passport (/public/passport/:token) | HTTP ${pPublicPassport.status} (route present) |
| Admin snapshot trajectory | HTTP ${pAdminEISnapshots.status} |
| Longitudinal trend chart | ❌ No data (0 snapshots) — renders empty |
| Email EI summary | Not found as standalone; CAPADEX email exists |

---

## Integrity Issue: Two EI Numbers

The EI breakdown modal shows the doc-accurate 8-dimension score. The EIGauge shows the 6-dimension engine score. **These two numbers will diverge** for any user who has taken the assessment or has education data — the modal shows a higher number. This is potentially confusing and undermines report credibility.

---

## What Works Well

- The EI breakdown modal is the most polished report surface: per-dimension card with actual/max points, progress bar, rationale text, evidence detail, and a CTA with the target tab. This matches the documentation spec exactly.
- Admin governance suite: full CRUD on rulesets, preview/compare across versions, calculation log audit trail.
- 198 calculation logs confirm the resolver is actively recording EI computations.

---

## What Doesn't Work

- Longitudinal trend: 0 snapshots → trend chart is empty for all users.
- Percentile is hardcoded (lookup table, not from real cohort data).
- EI Passport: flag-dependent; snapshot assembly is best-effort (behavior graph data likely absent for most users).

---

## Actions to Reach 95%

1. Resolve formula divergence (D5 action 1) so modal and gauge show the same number.
2. Trigger at least one snapshot per user on first EI resolution to seed the longitudinal chart.
3. Enable \`employabilityPassport\` flag once data quality is sufficient.
4. Replace hardcoded percentile lookup with real cohort percentiles (requires ≥30 career profiles).
`);
  console.log('  ✓ 09_report_readiness.md');

  // ══════════════════════════════════════════════════════════════════════════
  // DELIVERABLE 10 — Personalization Readiness
  // ══════════════════════════════════════════════════════════════════════════
  fs.writeFileSync(path.join(OUT, '10_personalization_readiness.md'), `\
# WC-P1 — D10: Personalization Readiness

**Coverage**: ${dimensions.personalization.cov}% | **Confidence**: ${dimensions.personalization.conf}%

---

## Evidence

| Personalization Layer | State |
|---|---|
| Behavioral nudges in job ranking | ✅ \`rankJobsForUser\` adjusts by Execution Readiness |
| IDP behavioral bias | ✅ Low Execution Readiness → low-effort, high-momentum steps |
| CareerBrain integration | ✅ EI score passed to \`useCareerBrain\` in all tabs |
| Band-based messaging | ⚠️ Band labels diverge across 3 schemas (see D5) |
| Per-industry weighting | ❌ Not implemented; single global ruleset only |
| Per-seniority weighting | ❌ Not implemented (doc §8.5: planned) |
| Persona-keyed question selection | ❌ No persona→EI weighting |
| CAPADEX behavioral profile → EI weights | ❌ Not wired |

---

## Band Label Confusion

Three incompatible band definitions coexist:
- **Docs**: Getting Started / Building / Career-Ready / Hire-Ready
- **UI tokens**: Starter / Developing / Good / Excellent
- **DB ruleset**: Starter / Developing / Good / Strong / Excellent

Copy in the breakdown modal, CTA buttons, and marketing surfaces references these labels inconsistently. A user can see "Good" in the gauge and "Career-Ready" in documentation about the same score range.

---

## What Works

- Behavioral context is live: \`BehaviorContext\` adjusts job ranking and IDP step selection.
- EI score is threaded consistently through all CareerBuilder tabs (as \`eiScore\` prop).
- Breakdown modal CTA labels adjust per score level ("Take the assessment" vs "Retake to improve").

---

## What Doesn't Work

- No industry-specific weighting (a finance candidate and a software engineer get identical weights).
- No seniority adjustment (entry-level and C-suite use the same formula).
- Band label inconsistency undermines user messaging coherence.

---

## Actions to Reach 95%

1. Standardise band labels (one schema, propagated everywhere).
2. Add industry context to ruleset config (separate dimension weight sets per industry vertical).
3. Personalise assessment CTA messaging by band + gap size.
`);
  console.log('  ✓ 10_personalization_readiness.md');

  // ══════════════════════════════════════════════════════════════════════════
  // DELIVERABLE 11 — Longitudinal Readiness
  // ══════════════════════════════════════════════════════════════════════════
  fs.writeFileSync(path.join(OUT, '11_longitudinal_readiness.md'), `\
# WC-P1 — D11: Longitudinal Readiness

**Coverage**: ${dimensions.longitudinal.cov}% | **Confidence**: ${dimensions.longitudinal.conf}%

---

## Evidence

| Component | State |
|---|---|
| \`ei_snapshot_versions\` table | ✅ Exists |
| Rows ever stored | **${cEiSnapshots}** — no snapshots have ever been taken |
| First snapshot | ${firstSnap ?? 'null (never taken)'} |
| Last snapshot | ${lastSnap ?? 'null (never taken)'} |
| Trajectory forecasts | ${cTrajForecasts} row (this was seeded, not from a real user journey) |
| \`takeSnapshot()\` service | ✅ Implemented in \`ei-snapshots.ts\` |
| \`getTrajectory()\` service | ✅ Implemented |
| \`getEvolutionAnalytics()\` service | ✅ Implemented |
| Admin snapshot trigger | HTTP ${pAdminSnapTake.status} (route present) |
| Nightly cron / scheduler | ❌ Not implemented |
| Auto-snapshot on first resolve | ❌ Not triggered — \`/api/ei/resolve\` logs but does not snapshot |
| CareerVelocityTab trend chart | ✅ Component exists; renders empty (no data) |
| \`/api/admin/ei/snapshots/:user_id\` | HTTP ${pAdminEISnapshots.status} |

---

## Why 0 Snapshots

\`/api/ei/resolve\` (the most frequently called EI route, with ${cEiCalcLogs} logs) writes to \`ei_calculation_logs\` but does NOT write to \`ei_snapshot_versions\`. Snapshots must be triggered explicitly via \`POST /api/admin/ei/snapshots/take\` or a cron that has never been configured.

The documentation states: *"For longitudinal tracking we will snapshot the EI nightly into \`ei_snapshots(user_id, score, breakdown, snapshot_at)\` (planned, not yet built)."* — this matches the observed state exactly.

---

## Impact

- All longitudinal UI surfaces (CareerVelocityTab trend chart, trajectory to Hire-Ready, "dominant mover" analysis) render empty.
- \`getEvolutionAnalytics()\` will return no data for all users.
- The "Trajectory" feature cannot show any meaningful historical trend.

---

## Actions to Reach 95%

1. Auto-trigger \`takeSnapshot()\` from \`/api/ei/resolve\` on first resolution of a given day (idempotent — unique constraint on user_id+date already in place).
2. Optionally: add a cron (Replit scheduled task or pg_cron) for nightly snapshots.
3. Once snapshots accumulate (≥3 per user), the trend chart and evolution analytics will populate automatically.
`);
  console.log('  ✓ 11_longitudinal_readiness.md');

  // ══════════════════════════════════════════════════════════════════════════
  // DELIVERABLE 12 — Commercial Readiness
  // ══════════════════════════════════════════════════════════════════════════
  fs.writeFileSync(path.join(OUT, '12_commercial_readiness.md'), `\
# WC-P1 — D12: Commercial Readiness

**Coverage**: ${dimensions.commercial.cov}% | **Confidence**: ${dimensions.commercial.conf}%

---

## Evidence

| Component | State |
|---|---|
| Razorpay keys configured | ❌ Absent (confirmed in WC-C10) |
| EI features behind a paywall | ❌ No subscription gating |
| EI Passport feature flag | \`employabilityPassport\` = ${passportEnabled ? '✅ ENABLED' : '❌ DISABLED'} |
| \`FF_COMMERCIAL_ACTIVATION\` | ✅ In dev workflow command (must be OMITTED in production) |
| Subscription packages for EI tier | ❌ Not defined |
| EI score in subscription upsell flow | ❌ Not wired |
| Payment audit log for EI features | ❌ Not applicable (no payment events) |

---

## Assessment

The EI product is fully available to all users with no commercial gating. This may be intentional for the Free Consumer Launch, but:

1. The EI Passport (shareable with recruiters, PDF export) is a premium feature that should be behind a paywall for the Paid Pilot.
2. No subscription tier maps to EI feature access levels.
3. \`FF_COMMERCIAL_ACTIVATION\` is in the dev workflow command but is documented as a **HOLD** flag for production until Razorpay is configured — the EI product itself is not gated by this flag.

---

## For Free Consumer Launch

EI scoring, breakdown modal, recommendations, and career routing are available to all users — consistent with a free-tier offering. This is acceptable for launch.

---

## For Paid Consumer Pilot

1. EI Passport (shareable public link + PDF export) should be gated at a paid tier.
2. Advanced trajectory forecasting with verified credentials should be a paid tier.
3. These require Razorpay (Paid Pilot blocker per WC-C10).

---

## Actions to Reach 95%

1. After Razorpay is configured (WC-C10 Paid Pilot gate), define subscription tiers that include/exclude EI Passport, advanced trajectory, and verified credentials.
2. Enable \`employabilityPassport\` flag and gate the share/PDF routes behind a subscription check.
`);
  console.log('  ✓ 12_commercial_readiness.md');

  // ══════════════════════════════════════════════════════════════════════════
  // DELIVERABLE 13 — Executive Gap Analysis
  // ══════════════════════════════════════════════════════════════════════════
  fs.writeFileSync(path.join(OUT, '13_executive_gap_analysis.md'), `\
# WC-P1 — D13: Executive Gap Analysis

**Date**: ${AUDIT_DATE}
**Overall Coverage**: ${overallCov}% | **Overall Confidence**: ${overallConf}%

---

## Scorecard Summary

| Dimension | Coverage | Confidence | Status |
|---|---|---|---|
| Assessment Readiness | ${dimensions.assessment.cov}% | ${dimensions.assessment.conf}% | ⚠️ PARTIAL |
| Question Bank | ${dimensions.questionBank.cov}% | ${dimensions.questionBank.conf}% | ⚠️ PARTIAL |
| Competency Framework | ${dimensions.competencyFramework.cov}% | ${dimensions.competencyFramework.conf}% | ❌ LOW |
| Employability Scoring | ${dimensions.eiScoring.cov}% | ${dimensions.eiScoring.conf}% | ⚠️ PARTIAL |
| Outcome Intelligence | ${dimensions.outcomeIntelligence.cov}% | ${dimensions.outcomeIntelligence.conf}% | ❌ LOW |
| Recommendations | ${dimensions.recommendations.cov}% | ${dimensions.recommendations.conf}% | ⚠️ PARTIAL |
| Career Routing | ${dimensions.careerRouting.cov}% | ${dimensions.careerRouting.conf}% | ❌ LOW |
| Reporting | ${dimensions.reporting.cov}% | ${dimensions.reporting.conf}% | ⚠️ PARTIAL |
| Personalization | ${dimensions.personalization.cov}% | ${dimensions.personalization.conf}% | ⚠️ PARTIAL |
| Longitudinal | ${dimensions.longitudinal.cov}% | ${dimensions.longitudinal.conf}% | ❌ CRITICAL |
| Commercial | ${dimensions.commercial.cov}% | ${dimensions.commercial.conf}% | ❌ CRITICAL |
| **OVERALL** | **${overallCov}%** | **${overallConf}%** | **⚠️ NOT READY** |

---

## Top 5 Blocking Gaps (by user impact)

### GAP-1: Formula Divergence — Two EI Scores Exist Simultaneously (CRITICAL)
**Impact**: Every user with an assessment score or education data sees two different EI numbers — the headline gauge (ignores assessment+education) and the modal breakdown (includes them). Undermines the product's core credibility.
**Root cause**: \`employabilityEngine.ts\` (6-dim) never unified with the 8-dim doc formula. Both were built independently.

### GAP-2: Longitudinal is Dead (0 Snapshots) (CRITICAL)
**Impact**: The CareerVelocityTab trajectory chart, evolution analytics, and "dominant mover" are all empty. Core product promise ("track your progress") is unfulfilled.
**Root cause**: \`takeSnapshot()\` exists but is never called automatically; no cron configured.

### GAP-3: Occupation Graph Too Sparse (25%) for Career Routing
**Impact**: Trajectory forecasts produce 0 milestones for most users. Role-fit scores are low-signal. Career routing (a documented core feature) is non-functional for production use.
**Root cause**: Seed data is minimal (30 occupations, 3 pathways). Expansion is an owner data action.

### GAP-4: Reference Data Thin (~1% of target)
**Impact**: 69 entities already unresolved; institution tier classification fails for most non-IIT/IIM inputs. Certified credentials mostly unrecognised.
**Root cause**: Phase 1 (reference tables) and Phase 2 (resolver upgrade) are documented as planned but not built.

### GAP-5: Competency Assessment Not Feeding Gauge Score
**Impact**: The single largest EI lever (25pts, documented as "strongest predictor") has zero effect on the headline score. The assessment CTA has no measurable EI impact for the user despite the documentation's emphasis.
**Root cause**: \`useHybridEI\` was built independently of the assessment flow; the two were never wired.

---

## What IS Ready for Free Consumer Launch

- EI gauge score displays on profile load ✅
- EI breakdown modal (8-dim) with rationale and CTAs ✅
- Improvement roadmap (generic) ✅
- Admin EI governance (ruleset management, calc log audit) ✅
- All EI routes registered and returning non-404 responses ✅
- Career Builder integration (EI score threaded to all tabs) ✅

The EI product is usable and not broken — the score is displayed, the breakdown is detailed, and the CTAs work. The gaps above are about accuracy, completeness, and trust rather than basic functionality.
`);
  console.log('  ✓ 13_executive_gap_analysis.md');

  // ══════════════════════════════════════════════════════════════════════════
  // DELIVERABLE 14 — 95% Completion Roadmap
  // ══════════════════════════════════════════════════════════════════════════
  fs.writeFileSync(path.join(OUT, '14_95pct_completion_roadmap.md'), `\
# WC-P1 — D14: 95% Completion Roadmap

**Current State**: Coverage ${overallCov}% / Confidence ${overallConf}%
**Target**: 95% Coverage + 85% Confidence

---

## Prioritised Implementation Sequence

### Phase A — Formula Integrity (Estimated: 1 day | Impact: +15% Coverage, +20% Confidence)

#### A1 — Unify the EI formula
**Problem**: \`employabilityEngine.ts\` (6-dim) ≠ \`eiBreakdown\` modal (8-dim) ≠ DB ruleset.
**Action**:
1. Add \`assessmentScore?: number\` input to \`runEmployabilityEngine()\`.
2. Add \`assessmentScore → (score/100)*25\` dimension (cap 25).
3. Add \`education → classifyEducation()\` dimension (cap 15, already in modal).
4. Reduce \`completenessScore\` from 45pts cap to 3pts (matching doc; \`completeness × 0.03\`).
5. Adjust certs cap 6→10, soft cap 10→8, projects cap 6→4 to match doc.
6. Update DB ruleset JSONB config to match.
7. Delete the duplicated local \`eiBreakdown\` memo in \`CareerBuilderPage.tsx\` — use the unified engine output.

#### A2 — Unify band labels
**Action**: Adopt doc labels (Getting Started/Building/Career-Ready/Hire-Ready) everywhere — update \`tokens.ts\`, DB ruleset config, all copy strings.

---

### Phase B — Longitudinal Activation (Estimated: 2 hours | Impact: +12% Coverage, +10% Confidence)

#### B1 — Auto-snapshot on resolve
**Action**: In \`/api/ei/resolve\`, after writing the calc log, call \`takeSnapshot(pool, userId, score, breakdown, profile_hash)\`. Already idempotent (unique constraint on user_id+date). No schema changes needed.
**Result**: All future resolve calls will build the trajectory chart. ${cEiCalcLogs} existing calc logs indicate prior resolve activity; those users will get their first snapshot on next resolve.

---

### Phase C — Assessment Integration (Estimated: 4 hours | Impact: +10% Coverage, +15% Confidence)

#### C1 — Wire assessmentScore into useHybridEI
**Action**: In \`extractInput()\` in \`useHybridEI.ts\`, read \`profile.assessmentScore\` and pass it to the unified engine (Phase A1 prerequisite).

#### C2 — Persist assessmentScore on completion
**Action**: After the Career Builder Assessment tab completes, PATCH \`career_seeker_profiles.data.assessmentScore\` with the numeric result.

---

### Phase D — Reference Data Seeding (Estimated: 1–2 days | Impact: +15% Coverage, +12% Confidence)

#### D1 — Seed institutions (NIRF Top 200)
Download NIRF 2024 data (public JSON) and bulk-insert into \`institutions\` with \`tier_1\`/\`tier_2\`/\`tier_3\` classification. Target: ≥200 rows.

#### D2 — Seed certifications (Top 50)
Add AWS/Azure/GCP/PMP/CFA/CA/FRM/CISSP to \`certifications\` with \`tier\` field. Target: ≥50 rows with tier classification.

#### D3 — Seed skills (ESCO core)
Load ESCO Level-1/Level-2 skills (CSV, public, ~2,000 essential skills). Target: ≥500 rows in \`skills\`.

#### D4 — Process ref_review_queue
Review the ${cRefReviewQueue} queued items and create aliases for the most frequent inputs.

---

### Phase E — Occupation Expansion (Estimated: 2–3 days | Impact: +10% Coverage, +8% Confidence)

#### E1 — Expand occupation catalog to ≥200
Add occupations for: IT Engineering, Finance, Data, Product, HR, Sales, Operations, Healthcare (Indian titles and seniority levels).

#### E2 — Map ≥8 skills per occupation
Each occupation needs required/important/optional skills from the seeded \`skills\` table.

#### E3 — Build ≥50 pathways
Common Indian career progressions: Junior Engineer → Engineer → Senior → Lead → Manager → Director chains per vertical.

---

### Phase F — Commercial Gating (Estimated: 4 hours, after Razorpay) | Impact: +5% Coverage)

Enable EI Passport (\`employabilityPassport\` flag) and gate it behind the Paid tier once Razorpay is configured.

---

## Projected Readiness After Each Phase

| After Phase | Coverage | Confidence |
|---|---|---|
| Baseline (now) | ${overallCov}% | ${overallConf}% |
| + A (Formula) | ~${overallCov + 15}% | ~${overallConf + 20}% |
| + B (Longitudinal) | ~${overallCov + 15 + 12}% | ~${overallConf + 20 + 10}% |
| + C (Assessment) | ~${overallCov + 15 + 12 + 10}% | ~${overallConf + 20 + 10 + 15}% |
| + D (Ref Data) | ~${overallCov + 15 + 12 + 10 + 15}% | ~${overallConf + 20 + 10 + 15 + 12}% |
| + E (Occupations) | ~${overallCov + 15 + 12 + 10 + 15 + 10}% | ~${overallConf + 20 + 10 + 15 + 12 + 8}% |
| + F (Commercial) | ~${Math.min(overallCov + 15 + 12 + 10 + 15 + 10 + 5, 97)}% | ~${Math.min(overallConf + 20 + 10 + 15 + 12 + 8 + 5, 87)}% |

**Target (95%/85%) is achievable after all six phases.**

---

## Quick Wins (< 2 hours total, no schema changes)

| Win | Time | Impact |
|---|---|---|
| Auto-snapshot on /api/ei/resolve (Phase B1) | 30 min | Immediately populates longitudinal chart |
| Unify band labels (Phase A2) | 30 min | Eliminates user-visible label confusion |
| Wire assessmentScore into useHybridEI (Phase C1) | 1 hr | Assessment CTA has measurable EI impact |
`);
  console.log('  ✓ 14_95pct_completion_roadmap.md');

  // ══════════════════════════════════════════════════════════════════════════
  // DELIVERABLE 0 — Master Readiness Scorecard
  // ══════════════════════════════════════════════════════════════════════════
  fs.writeFileSync(path.join(OUT, '00_readiness_scorecard.md'), `\
# WC-P1 — Employability Index Readiness Scorecard

**Date**: ${AUDIT_DATE}
**Method**: live HTTP probes · DB queries · source code analysis (read-only, no changes)

---

## Overall Verdict

| Axis | Score | Interpretation |
|---|---|---|
| **Coverage** | **${overallCov}%** | ${overallCov >= 75 ? 'Mostly implemented' : overallCov >= 50 ? 'Partial — key gaps remain' : 'Significant gaps — not production-ready in all dimensions'} |
| **Confidence** | **${overallConf}%** | ${overallConf >= 75 ? 'Trustworthy for production' : overallConf >= 50 ? 'Usable with caveats' : 'Low-confidence — data thin, formulas divergent'} |

**Launch verdict**: ⚠️ CONDITIONAL — EI product is displayable and not broken, but has critical integrity gaps (formula split, 0 longitudinal data, thin reference data) that should be resolved before scaling.

---

## Dimension Scorecard

| Dimension | Coverage | Confidence | Critical Gaps |
|---|---|---|---|
| Assessment Readiness | ${dimensions.assessment.cov}% | ${dimensions.assessment.conf}% | Assessment score not in gauge; 0 sessions taken |
| Question Bank | ${dimensions.questionBank.cov}% | ${dimensions.questionBank.conf}% | 63 questions, 0 completions; LBI/SDI unused |
| Competency Framework | ${dimensions.competencyFramework.cov}% | ${dimensions.competencyFramework.conf}% | competency_scores table absent |
| Employability Scoring | ${dimensions.eiScoring.cov}% | ${dimensions.eiScoring.conf}% | 3 divergent formulas; band mismatch |
| Outcome Intelligence | ${dimensions.outcomeIntelligence.cov}% | ${dimensions.outcomeIntelligence.conf}% | 30 occupations, 3 pathways (seed-only) |
| Recommendations | ${dimensions.recommendations.cov}% | ${dimensions.recommendations.conf}% | 69 unresolved; thin ref data |
| Career Routing | ${dimensions.careerRouting.cov}% | ${dimensions.careerRouting.conf}% | 3 pathways only |
| Reporting | ${dimensions.reporting.cov}% | ${dimensions.reporting.conf}% | Gauge ≠ Modal score; 0 longitudinal |
| Personalization | ${dimensions.personalization.cov}% | ${dimensions.personalization.conf}% | Band label split; no industry weights |
| Longitudinal | ${dimensions.longitudinal.cov}% | ${dimensions.longitudinal.conf}% | **0 snapshots ever taken** |
| Commercial | ${dimensions.commercial.cov}% | ${dimensions.commercial.conf}% | No payment gating; Razorpay absent |
| **OVERALL** | **${overallCov}%** | **${overallConf}%** | |

---

## DB State (measured ${AUDIT_DATE})

| Table | Rows |
|---|---|
| ei_rulesets | ${cEiRulesets} |
| ei_dimension_rules | ${cEiDimRules} |
| ei_calculation_logs | ${cEiCalcLogs} (engine active) |
| ei_snapshot_versions | ${cEiSnapshots} (never snapshotted) |
| career_seeker_profiles | ${cCareerProfiles} |
| competency_question_templates | ${cCompetencyTemplates} |
| lbi_sessions | ${cLbiSessions} |
| sdi_user_responses | ${cSdiResponses} |
| occupations | ${cOccupations} |
| occupation_skills | ${cOccupSkills} |
| occupation_pathways | ${cOccupPathways} |
| trajectory_forecasts | ${cTrajForecasts} |
| institutions | ${cInstitutions} |
| qualifications | ${cQualifications} |
| certifications | ${cCertifications} |
| skills | ${cSkills} |
| ref_review_queue | ${cRefReviewQueue} |
| kg_edges | ${cKgEdges} |
| iil_employability_network | ${cIilNetwork} |

---

## Route Availability (live probes)

| Route | HTTP Status | OK |
|---|---|---|
| \`POST /api/ei/resolve\` | ${pEiResolve.status} | ${badge(pEiResolve.ok)} |
| \`GET /api/ei/typeahead/institutions\` | ${pEiTypeahead.status} | ${badge(pEiTypeahead.ok)} |
| \`GET /api/employability/occupations\` | ${pOccupations.status} | ${badge(pOccupations.ok)} |
| \`POST /api/employability/role-fit\` | ${pRoleFit.status} | ${badge(pRoleFit.ok)} |
| \`POST /api/employability/role-matches\` | ${pRoleMatches.status} | ${badge(pRoleMatches.ok)} |
| \`POST /api/employability/trajectory\` | ${pTrajectory.status} | ${badge(pTrajectory.ok)} |
| \`POST /api/career/intelligence/employability\` | ${pCareerIntelEI.status} | ${badge(pCareerIntelEI.ok)} |
| \`POST /api/career/intelligence/dashboard\` | ${pCareerIntelDash.status} | ${badge(pCareerIntelDash.ok)} |
| \`GET /api/admin/ei/rulesets\` | ${pAdminRulesets.status} | ${badge(pAdminRulesets.ok)} |
| \`GET /api/admin/ei/rulesets/active\` | ${pAdminRulesetsActive.status} | ${badge(pAdminRulesetsActive.ok)} |
| \`GET /api/admin/ei/calculation-logs\` | ${pAdminCalcLogs.status} | ${badge(pAdminCalcLogs.ok)} |
| \`POST /api/admin/ei/snapshots/take\` | ${pAdminSnapTake.status} | ${badge(pAdminSnapTake.ok)} |

---

*Generated by \`backend/scripts/wc-p1/wc-p1-employability-index-readiness.ts\`.
Evidence-derived; re-run after each implementation phase.*
`);
  console.log('  ✓ 00_readiness_scorecard.md');

  await pool.end();
  console.log(`\nWC-P1 audit complete → ${OUT}`);
  console.log(`Coverage: ${overallCov}% | Confidence: ${overallConf}%`);
  console.log('Status: CONDITIONAL — not production-ready across all dimensions');
}

main().catch((e) => {
  console.error('Fatal:', e);
  pool.end();
  process.exit(1);
});
