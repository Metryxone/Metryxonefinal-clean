/**
 * P-X1 — Shared Product Foundation Audit & Implementation Plan
 *
 * READ-ONLY · AUDIT + PLANNING ONLY · NO SCHEMA CHANGES · NO WRITES
 * STOP FOR APPROVAL before any implementation.
 *
 * Reviews WC-P1/P2/P3, WC-L0E, WC-L1B, WC-C1–C10 to identify shared platform
 * capabilities blocking multiple products simultaneously.
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const OUT = path.join(__dirname, '../../audit/px-1');
fs.mkdirSync(OUT, { recursive: true });

function maskEmail(email: string): string {
  return 'user_' + crypto.createHash('sha256').update(email).digest('hex').slice(0, 8);
}

function write(filename: string, content: string) {
  const p = path.join(OUT, filename);
  fs.writeFileSync(p, content, 'utf8');
  console.log(`  ✓ ${filename}`);
}

async function tableExists(name: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1 LIMIT 1`,
    [name]
  );
  return r.rowCount > 0;
}

async function countTable(name: string): Promise<number> {
  try {
    const r = await pool.query(`SELECT COUNT(*)::text AS n FROM "${name}"`);
    return Number(r.rows[0]?.n ?? 0);
  } catch {
    return -1;
  }
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2 LIMIT 1`,
    [table, column]
  );
  return r.rowCount > 0;
}

// ─── Baseline scores (grounded in published audit deliverables) ───────────────
const BASELINE = {
  EI:  { coverage: 32, confidence: 23 },  // WC-P1/00_readiness_scorecard.md
  LBI: { coverage: 25, confidence:  0 },  // WC-P2/00_readiness_scorecard.md
  CB:  { coverage: 37, confidence: 17 },  // WC-P3/00_readiness_scorecard.md
};

// EI dimension scores (WC-P1 scorecard)
const EI_DIMS: Record<string, [number,number]> = {
  'Assessment Readiness':    [35, 20],
  'Question Bank':           [30, 25],
  'Competency Framework':    [20, 15],
  'Employability Scoring':   [65, 40],
  'Outcome Intelligence':    [25, 20],
  'Recommendations':         [40, 25],
  'Career Routing':          [20, 15],
  'Reporting':               [65, 55],
  'Personalization':         [30, 25],
  'Longitudinal':            [15, 10],
  'Commercial':              [10,  5],
};

// LBI dimension scores (WC-P2 scorecard)
const LBI_DIMS: Record<string, [number,number]> = {
  'Framework (Domain/Questions)': [ 5,  0],
  'Assessment Flow':              [70,  0],
  'Scoring Engine':               [80,  0],
  'Report Generation':            [20,  0],
  'Recommendations':              [15,  0],
  'Personalization':              [30,  0],
  'Longitudinal':                 [ 0,  0],
  'Commercial':                   [60,  0],
  'Security':                     [40,  0],
  'Product UX':                   [10,  5],
};

// CB dimension scores (WC-P3 scorecard)
const CB_DIMS: Record<string, [number,number]> = {
  'Career Discovery':       [45, 20],
  'Career Mapping':         [45, 25],
  'Recommendations':        [35, 15],
  'Growth Planning':        [30, 10],
  'Career Pathway':         [25, 15],
  'Outcome Intelligence':   [25, 15],
  'Longitudinal':           [15,  5],
  'Report Intelligence':    [35, 20],
  'Personalization':        [55, 25],
  'Commercial':             [20, 10],
};

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  P-X1  Shared Product Foundation Audit & Implementation Plan');
  console.log('  READ-ONLY · AUDIT ONLY · STOP FOR APPROVAL');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const ts = new Date().toISOString();

  // ─── LIVE DB PROBES ─────────────────────────────────────────────────────────
  console.log('Probing live database …');

  const probeResults: Record<string, number | boolean | string> = {};

  // Identity hub
  probeResults.career_seeker_profiles = await countTable('career_seeker_profiles');
  probeResults.capadex_sessions = await countTable('capadex_sessions');
  probeResults.capadex_sessions_completed = await (async () => {
    try {
      const r = await pool.query(`SELECT COUNT(*)::text AS n FROM capadex_sessions WHERE status='completed'`);
      return Number(r.rows[0]?.n ?? 0);
    } catch { return -1; }
  })();

  // Snapshot tables
  probeResults.ei_snapshot_versions = await countTable('ei_snapshot_versions');
  probeResults.career_memory_snapshots = await (async () => {
    const exists = await tableExists('career_memory_snapshots');
    if (!exists) return -1;
    return countTable('career_memory_snapshots');
  })();
  probeResults.wcl5_memory = await countTable('wcl5_memory');
  probeResults.wcl0_user_intelligence = await countTable('wcl0_user_intelligence');

  // Longitudinal tables
  probeResults.wc3_outcome_state = await countTable('wc3_outcome_state');
  probeResults.wc3_journey_state = await countTable('wc3_journey_state');
  probeResults.wc3_stage_state = await countTable('wc3_stage_state');
  probeResults.wc3_decision_state = await countTable('wc3_decision_state');
  probeResults.wc7b_decision_state = await countTable('wc7b_decision_state');
  probeResults.lbi_scores = await countTable('lbi_scores');
  probeResults.lbi_score_history_exists = await tableExists('lbi_score_history');
  probeResults.ei_calculation_logs = await countTable('ei_calculation_logs');

  // Recommendation tables
  probeResults.career_recommendations = await countTable('career_recommendations');
  probeResults.career_recommendations_has_user_id = await columnExists('career_recommendations', 'user_id');
  probeResults.capadex_intervention_recommendations = await countTable('capadex_intervention_recommendations');
  probeResults.intervention_library = await countTable('intervention_library');
  probeResults.ref_review_queue = await countTable('ref_review_queue');

  // Memory tables
  probeResults.wcl5_memory_types = await (async () => {
    try {
      const r = await pool.query(`SELECT COUNT(DISTINCT memory_type)::text AS n FROM wcl5_memory`);
      return Number(r.rows[0]?.n ?? 0);
    } catch { return -1; }
  })();
  probeResults.career_behavioural_memory = await countTable('career_behavioural_memory');

  // Report integrity
  probeResults.capadex_reports = await countTable('capadex_reports');
  probeResults.lbi_report_types_exists = await tableExists('lbi_report_types');
  probeResults.lbi_subdomain_report_map_exists = await tableExists('lbi_subdomain_report_map');

  // Security / commercial
  probeResults.student_subscriptions = await countTable('student_subscriptions');
  probeResults.subscription_packages = await countTable('subscription_packages');
  probeResults.capadex_payments = await countTable('capadex_payments');

  // Behaviour graph
  probeResults.behavioural_hypotheses = await countTable('behavioural_hypotheses');
  probeResults.capadex_session_patterns = await countTable('capadex_session_patterns');
  probeResults.wcl0_behaviour_graph = await (async () => {
    const exists = await tableExists('wcl0_behaviour_graph');
    if (!exists) return -1;
    return countTable('wcl0_behaviour_graph');
  })();

  // Cross-product identity linkage
  probeResults.csp_with_user_id = await (async () => {
    try {
      const r = await pool.query(`SELECT COUNT(*)::text AS n FROM career_seeker_profiles WHERE user_id IS NOT NULL`);
      return Number(r.rows[0]?.n ?? 0);
    } catch { return -1; }
  })();

  // Check wc7c tables (commercial activation)
  probeResults.wc7c_tables_exist = await (async () => {
    try {
      const r = await pool.query(`SELECT COUNT(*)::text AS n FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'wc7c_%'`);
      return Number(r.rows[0]?.n ?? 0);
    } catch { return -1; }
  })();

  console.log('  DB probes complete.\n');

  // ─── DELIVERABLE 1: Shared Foundation Gap Matrix ──────────────────────────
  console.log('Generating Deliverable 1 — Shared Foundation Gap Matrix …');

  const d1 = `# P-X1 · Deliverable 1 — Shared Foundation Gap Matrix
_Generated ${ts}_
_READ-ONLY · AUDIT ONLY · STOP FOR APPROVAL_

## Method
Each cell reports whether the gap exists in that product on two axes:
- **Structural**: does the code / schema / route exist?
- **Activation**: is it producing real data outputs?

Gaps are grounded in measured audit scores (WC-P1/P2/P3) and live DB probes.

---

## DB State (live probe ${ts})

| Table | Rows / Exists |
|---|---|
| \`career_seeker_profiles\` | ${probeResults.career_seeker_profiles} rows |
| \`capadex_sessions\` (total / completed) | ${probeResults.capadex_sessions} / ${probeResults.capadex_sessions_completed} |
| \`ei_snapshot_versions\` | ${probeResults.ei_snapshot_versions} rows |
| \`career_memory_snapshots\` | ${probeResults.career_memory_snapshots === -1 ? '⚠️ TABLE ABSENT' : probeResults.career_memory_snapshots + ' rows'} |
| \`wcl5_memory\` | ${probeResults.wcl5_memory} rows (${probeResults.wcl5_memory_types} distinct types) |
| \`wcl0_user_intelligence\` | ${probeResults.wcl0_user_intelligence} rows |
| \`wc3_outcome_state\` | ${probeResults.wc3_outcome_state} rows |
| \`wc3_journey_state\` | ${probeResults.wc3_journey_state} rows |
| \`wc3_stage_state\` | ${probeResults.wc3_stage_state} rows |
| \`wc7b_decision_state\` | ${probeResults.wc7b_decision_state} rows |
| \`lbi_scores\` | ${probeResults.lbi_scores} rows |
| \`lbi_score_history\` | ${probeResults.lbi_score_history_exists ? '⚠️ EXISTS (check rows)' : '❌ TABLE ABSENT'} |
| \`lbi_report_types\` | ${probeResults.lbi_report_types_exists ? '⚠️ EXISTS (check rows)' : '❌ TABLE ABSENT'} |
| \`lbi_subdomain_report_map\` | ${probeResults.lbi_subdomain_report_map_exists ? '⚠️ EXISTS (check rows)' : '❌ TABLE ABSENT'} |
| \`career_recommendations\` | ${probeResults.career_recommendations} rows (user_id col: ${probeResults.career_recommendations_has_user_id ? '✅' : '❌'}) |
| \`capadex_intervention_recommendations\` | ${probeResults.capadex_intervention_recommendations} rows |
| \`intervention_library\` | ${probeResults.intervention_library} rows |
| \`career_behavioural_memory\` | ${probeResults.career_behavioural_memory} rows |
| \`capadex_reports\` | ${probeResults.capadex_reports} rows |
| \`subscription_packages\` | ${probeResults.subscription_packages} rows |
| \`student_subscriptions\` | ${probeResults.student_subscriptions} rows |
| \`capadex_payments\` | ${probeResults.capadex_payments} rows |
| \`wc7c_*\` tables | ${probeResults.wc7c_tables_exist} tables exist |
| \`behavioural_hypotheses\` | ${probeResults.behavioural_hypotheses} rows |
| \`capadex_session_patterns\` | ${probeResults.capadex_session_patterns} rows |

---

## Capability 1 — Snapshot Framework

> Does a product have an AUTOMATED snapshot written to a DB table at the end of each session/computation cycle?

| Product | Structural | Activation | Evidence |
|---|---|---|---|
| **EI** (Employability Index) | ⚠️ PARTIAL | ❌ ZERO | \`takeSnapshot()\` fn exists in \`ei-engine.ts\`; \`ei_snapshot_versions\`=${probeResults.ei_snapshot_versions} rows. No cron, no hook trigger. |
| **LBI** | ❌ ABSENT | ❌ ZERO | No snapshot concept in \`lbi-engine.ts\`. \`lbi_scores\` is a single-row UPSERT (overwrites prior score). |
| **Career Builder** | ⚠️ PARTIAL | ❌ ZERO | \`career_memory_snapshots\` = ${probeResults.career_memory_snapshots === -1 ? 'TABLE ABSENT' : probeResults.career_memory_snapshots + ' rows'}. \`career-memory.ts\` uses in-memory Map (not DB). |
| **CAPADEX** (reference) | ✅ REAL | ✅ ACTIVE | \`wcl5_memory\`=${probeResults.wcl5_memory} rows (WC-L5 post-completion hook). Pattern is the reuse model. |

**Products blocked**: EI, LBI, Career Builder  
**Shared root cause**: No post-computation snapshot trigger. CAPADEX (WC-L5) already implements the pattern.

---

## Capability 2 — Longitudinal Persistence

> Does the product write historical records (not overwrites) so trends can be computed later?

| Product | Structural | Activation | Evidence |
|---|---|---|---|
| **EI** | ⚠️ PARTIAL | ❌ ZERO | \`ei_snapshot_versions\`=${probeResults.ei_snapshot_versions}. WC-P1 D10 Longitudinal: **15% / 10%** (CRITICAL). No history table. |
| **LBI** | ❌ ABSENT | ❌ ZERO | \`lbi_score_history\` = ${probeResults.lbi_score_history_exists ? 'exists (check population)' : '**TABLE ABSENT**'}. \`lbi_scores\` UPSERT overwrites. WC-P2 D08 Longitudinal: **0% / 0%**. |
| **Career Builder** | ❌ ABSENT | ❌ ZERO | \`career_memory_snapshots\`=${probeResults.career_memory_snapshots === -1 ? 'table absent' : probeResults.career_memory_snapshots + ' rows (empty)'}. WC-P3 D07 Longitudinal: **15% / 5%**. |
| **CAPADEX** (reference) | ✅ REAL | ✅ ACTIVE | \`wc3_stage_state\`=${probeResults.wc3_stage_state}, \`wc3_outcome_state\`=${probeResults.wc3_outcome_state}, \`wc7b_decision_state\`=${probeResults.wc7b_decision_state}. History-per-session model. |

**Products blocked**: EI, LBI, Career Builder  
**Impact**: Without history, no trend is possible regardless of trend-engine quality.

---

## Capability 3 — Trend Engine

> Can the platform compute a per-user trend line from longitudinal data?

| Product | Structural | Activation | Evidence |
|---|---|---|---|
| **EI** | ❌ ABSENT | ❌ ZERO | No EI-specific trend engine. No input data (0 snapshots). |
| **LBI** | ❌ ABSENT | ❌ ZERO | No LBI trend engine. No history table. |
| **Career Builder** | ⚠️ PARTIAL | ❌ ZERO | \`progressLedger\` pure fn in useCareerBrain; returns null on 0 snapshots. |
| **CAPADEX** (reference) | ✅ REAL | ⚠️ DATA-STARVED | WC-L1 trend engine real. \`trendIntelligence\` flag OFF in workflow. 2/9 users trend-eligible. |

**Products blocked**: EI, LBI, Career Builder  
**Shared root cause**: Trend computation blocked by Capabilities 1+2 (no snapshots). CAPADEX WC-L1 engine can be adapted as the shared trend primitive.

---

## Capability 4 — Recommendation Persistence

> Are product recommendations written to a DB table keyed by user_id (not session)?

| Product | Structural | Activation | Evidence |
|---|---|---|---|
| **EI** | ⚠️ PARTIAL | ❌ INACTIVE | \`ref_review_queue\`=${probeResults.ref_review_queue} rows (69 unresolved). Not user-keyed. |
| **LBI** | ❌ ABSENT | ❌ ZERO | \`generateInsights()\` returns hardcoded 4-band text. No persistence. WC-P2 D06 Recs: **15% / 0%**. |
| **Career Builder** | ⚠️ PARTIAL | ❌ INACTIVE | \`career_recommendations\`=${probeResults.career_recommendations} rows; user_id column: ${probeResults.career_recommendations_has_user_id ? '✅ present' : '❌ absent (session-keyed only)'}. Bridge exists but inactive. |
| **CAPADEX** (reference) | ✅ REAL | ✅ ACTIVE | \`capadex_intervention_recommendations\`=${probeResults.capadex_intervention_recommendations} rows. \`intervention_library\`=${probeResults.intervention_library} rows. Career-behavior-adapter bridge available. |

**Products blocked**: EI, LBI, Career Builder  
**Shared root cause**: No unified user-keyed recommendation write path. CAPADEX recommendation engine already supports user-level persistence.

---

## Capability 5 — Personalization Consumption Layer

> Does the product read from the platform's user intelligence store (\`wcl0_user_intelligence\`) to personalise content?

| Product | Structural | Activation | Evidence |
|---|---|---|---|
| **EI** | ❌ ABSENT | ❌ ZERO | No connection to \`wcl0_user_intelligence\`. Band label split (6-dim vs 8-dim). WC-P1 D09 Personalization: **30% / 25%**. |
| **LBI** | ❌ ABSENT | ❌ ZERO | All inputs missing. WC-P2 D07 Personalization: **30% / 0%**. |
| **Career Builder** | ⚠️ PARTIAL | ⚠️ DATA-STARVED | \`useCareerBrain\` calls \`/api/career/behavior-profile/:userId\`. \`wcl0_user_intelligence\`=${probeResults.wcl0_user_intelligence} rows (CAPADEX-sourced). Degrades gracefully. WC-P3 D09 Personalization: **55% / 25%**. |
| **CAPADEX** (reference) | ✅ REAL | ⚠️ CEILING | WC-L0E: Personalization readiness 77.8%. \`wcl0_user_intelligence\` built. Ceiling = 2/9 zero-response sessions. |

**Products blocked**: EI (absent), LBI (absent), CB (partial, data-starved)  
**Shared root cause**: \`wcl0_user_intelligence\` built but not consumed by EI or LBI product layers.

---

## Capability 6 — User Intelligence Store

> Is there a persistent, queryable user intelligence store that aggregates persona + behaviour + segment across products?

| Product | Structural | Activation | Evidence |
|---|---|---|---|
| **EI** | ❌ NO LINK | ❌ ZERO | No read path from EI engine to \`wcl0_user_intelligence\`. |
| **LBI** | ❌ NO LINK | ❌ ZERO | No read path from LBI engine to \`wcl0_user_intelligence\`. |
| **Career Builder** | ⚠️ PARTIAL | ⚠️ DATA-STARVED | \`career-behavior-adapter\` bridges via \`user_id\`. |
| **Platform (CAPADEX)** | ✅ REAL | ✅ ACTIVE | \`wcl0_user_intelligence\`=${probeResults.wcl0_user_intelligence} rows. Persona 100% coverage, behaviour 22.2%, snapshot 100%. |

**Products blocked**: EI (completely disconnected), LBI (completely disconnected)  
**Shared root cause**: The store is built for CAPADEX users. EI and LBI have no API consumer endpoint pointing to it.

---

## Capability 7 — Memory Consumption Layer

> Is there a cross-session memory layer that persists intelligence between sessions and surfaces it in the product?

| Product | Structural | Activation | Evidence |
|---|---|---|---|
| **EI** | ❌ ABSENT | ❌ ZERO | No memory concept in EI product. |
| **LBI** | ❌ ABSENT | ❌ ZERO | No memory concept in LBI product. |
| **Career Builder** | ⚠️ PARTIAL | ❌ INACTIVE | \`career-memory.ts\` in-memory Map. \`career_behavioural_memory\`=${probeResults.career_behavioural_memory} rows. DB tables exist but not driving product. |
| **CAPADEX** (reference) | ✅ REAL | ✅ ACTIVE | \`wcl5_memory\`=${probeResults.wcl5_memory} rows, ${probeResults.wcl5_memory_types}/7 types. 100% of completed sessions. Retrieval engine ready. |

**Products blocked**: EI, LBI, Career Builder (inactive)  
**Shared root cause**: WC-L5 memory layer is fully operational for CAPADEX. No adapter surfaces it to EI or CB product layers.

---

## Capability 8 — Product-to-User Identity Resolution

> Is there a reliable mapping that connects a CAPADEX session to an EI computation to a Career Builder profile for the same user?

| Bridge | Exists | Rows | Gap |
|---|---|---|---|
| CAPADEX session → user_id | ✅ | ${probeResults.capadex_sessions} sessions | user_id NULL for anonymous (4/9) |
| user_id → career_seeker_profiles | ✅ | ${probeResults.csp_with_user_id} profiles with user_id | Only 2 profiles total |
| career_seeker_profiles → EI score | ❌ ABSENT | — | EI computed at query time, not stored per-user |
| career_seeker_profiles → LBI score | ⚠️ PARTIAL | ${probeResults.lbi_scores} lbi_scores | 0 rows — engine never called |
| CAPADEX → Career Builder bridge | ⚠️ PARTIAL | — | \`career-behavior-adapter\` exists; data-starved |
| CAPADEX → LBI bridge | ❌ ABSENT | — | G2 gap: calculateLBI() never called after completion |

**Products blocked**: LBI (G2, zero scores), CB (bridge inactive), EI (no stored per-user score)  
**Shared root cause**: No post-completion hook that (a) resolves cross-product identity, (b) triggers EI/LBI/CB score writes.

---

## Capability 9 — Report Data Integrity

> Do product reports derive scores from a single source of truth with no formula divergence?

| Product | Gap | Severity | Evidence |
|---|---|---|---|
| **EI** | **3 divergent formulas** (6-dim live vs 8-dim documented vs hybrid). Gauge ≠ Modal score. | **CRITICAL** | WC-P1 GAP-1. \`ei_calculation_logs\`=${probeResults.ei_calculation_logs} — all using 6-dim formula. |
| **LBI** | 2 tables missing (\`lbi_report_types\`, \`lbi_subdomain_report_map\`). AI report fabricates 60–95 hardcoded range. | **CRITICAL** | WC-P2 G3. Tables: lbi_report_types=${probeResults.lbi_report_types_exists ? 'exists' : '**ABSENT**'}, lbi_subdomain_report_map=${probeResults.lbi_subdomain_report_map_exists ? 'exists' : '**ABSENT**'}. |
| **Career Builder** | No dedicated career report surface. Intelligence threads to tabs but no per-user career report. | MEDIUM | WC-P3 D08 Report: 35% / 20%. |
| **CAPADEX** (reference) | ✅ CLEAN | — | \`capadex_reports\`=${probeResults.capadex_reports}. Single source, 39 reports. |

**Products blocked**: EI (credibility), LBI (data integrity), CB (product completeness)

---

## Capability 10 — Product Auth & Security Hardening

| Gap | Products affected | WC-C8A status |
|---|---|---|
| SESSION_SECRET unset in production | ALL | ⚠️ Config fix pending (owner action) |
| FF_* flags OFF in production | ALL | ⚠️ Config fix pending (owner action) |
| LBI admin routes unauthenticated (5 routes) | LBI | ❌ Unresolved (WC-P2 G5) |
| CB routes missing requireAuth (12/15 with user data) | Career Builder | ❌ Unresolved |
| EI commercial guard absent | EI | ❌ Not implemented |
| OTPs stored plaintext | CAPADEX | ⚠️ Documented, not fixed |

**Products blocked**: All products for production launch. LBI and CB have code-level gaps.  
**Note**: WC-C8A resolved security headers, OTP attempt cap, seed-demo guard, MFA handlers. The remaining items above are **code-level** (LBI/CB routes) or **config-level** (owner actions).

---

## Summary Matrix

| Capability | EI Gap | LBI Gap | CB Gap | Products blocked | Shared fix exists? |
|---|---|---|---|---|---|
| 1. Snapshot Framework | 0 rows | No concept | Table absent | 3 | ✅ WC-L5 pattern |
| 2. Longitudinal Persistence | 0 rows | No history table | 0 rows | 3 | ✅ Post-hook pattern |
| 3. Trend Engine | No engine | No engine | Pure fn, 0 data | 3 | ✅ WC-L1 adaptable |
| 4. Recommendation Persistence | Not user-keyed | Static text | Session-keyed | 3 | ✅ Career-behavior-adapter |
| 5. Personalization Layer | Disconnected | Disconnected | Partial | 3 | ✅ wcl0_user_intelligence |
| 6. User Intelligence Store | No link | No link | Partial | 2 full + 1 partial | ✅ Built (WC-L0) |
| 7. Memory Layer | Absent | Absent | Inactive | 3 | ✅ WC-L5 retrieval engine |
| 8. Identity Resolution | No stored score | Never called | Data-starved | 3 | ⚠️ Bridge exists, needs trigger |
| 9. Report Data Integrity | Formula split | Tables missing | No report surface | 3 | ❌ Product-specific fixes |
| 10. Auth & Security | Commercial guard | 5 unauth routes | 12 unauth routes | 3 | ⚠️ Pattern exists (requireAuth) |
`;

  write('01_shared_foundation_gap_matrix.md', d1);

  // ─── DELIVERABLE 2: Product Dependency Map ────────────────────────────────
  console.log('Generating Deliverable 2 — Product Dependency Map …');

  const d2 = `# P-X1 · Deliverable 2 — Product Dependency Map
_Generated ${ts}_

## How to Read This Map
- **→** = "must be resolved before": the capability named on the left MUST exist before the target on the right can fire.
- **[CAPADEX-only]** = capability exists for CAPADEX but is not consumed by the named product.
- Readiness percentages are from published audit scorecards (WC-P1/P2/P3).

---

## Dependency Chain — Full Platform View

\`\`\`
PLATFORM FOUNDATION
│
├── S10: Auth & Security Hardening  ← PREREQUISITE for all products
│    Must pass before: LBI admin recalculate-all (G2 depends on G5)
│    Must pass before: CB protected routes (IDOR risk)
│    Config gate: SESSION_SECRET + FF flags (all products)
│
├── S8: Product-to-User Identity Resolution
│    Must pass before: S4 (recs need user_id), S5 (personalization needs user_id),
│                      S6 (intelligence store link needs user_id)
│    Key bridge: capadex_session.user_id → career_seeker_profiles.user_id
│
├── S9: Report Data Integrity   (product-specific but blocks confidence entirely)
│    EI: formula reconciliation → blocks D04/D08 confidence (currently 40%/55%)
│    LBI: missing tables + AI guard → blocks D05 confidence (currently 0%)
│    CB: report surface → improves D08 (currently 20%)
│
├── S1: Snapshot Framework
│    Must pass before: S2, S3, S5 (personalization quality), S7 (memory)
│    CAPADEX reference: WC-L5 post-completion hook → wcl5_memory (${probeResults.wcl5_memory} rows, READY)
│    EI gap: takeSnapshot() fn exists, no trigger → ei_snapshot_versions = ${probeResults.ei_snapshot_versions}
│    LBI gap: no concept → lbi_scores UPSERT (overwrites, no history)
│    CB gap: career_memory_snapshots = ${probeResults.career_memory_snapshots === -1 ? 'TABLE ABSENT' : probeResults.career_memory_snapshots + ' rows'}
│
├── S2: Longitudinal Persistence
│    Depends on: S1 (snapshot schema)
│    Must pass before: S3 (trend engine needs ≥2 history points)
│    EI gap: no cron / post-computation trigger
│    LBI gap: lbi_score_history ${probeResults.lbi_score_history_exists ? 'exists' : '= TABLE ABSENT'}
│    CB gap: career-memory.ts uses in-memory Map (not DB)
│
├── S3: Trend Engine
│    Depends on: S1 + S2 (need ≥2 history snapshots per user)
│    CAPADEX reference: WC-L1 trend engine real; trendIntelligence flag OFF (data-starved)
│    Honest ceiling: 2 users have ≥2 sessions (WC-L1B). Any trend today is low-confidence.
│
├── S6: User Intelligence Store (consumer APIs)
│    Pre-built: wcl0_user_intelligence = ${probeResults.wcl0_user_intelligence} rows (CAPADEX users only)
│    EI gap: no API consumer endpoint linking EI computation to wcl0_user_intelligence
│    LBI gap: no API consumer endpoint; blocks S8 (LBI scoring trigger needs user context)
│
├── S5: Personalization Consumption Layer
│    Depends on: S6 (intelligence store must be queryable per product)
│    Depends on: S8 (user_id must resolve across products)
│    EI gap: band label split + no store link → D09 30%/25%
│    LBI gap: all inputs missing → D07 30%/0%
│    CB gap: partially wired → D09 55%/25% (degrades gracefully)
│
├── S4: Recommendation Persistence
│    Depends on: S8 (user_id key for persistence)
│    EI: ref_review_queue = ${probeResults.ref_review_queue} (not user-keyed)
│    LBI: no persistence engine
│    CB: career_recommendations user_id col = ${probeResults.career_recommendations_has_user_id ? 'PRESENT' : 'ABSENT'}; bridge inactive
│    CAPADEX reference: capadex_intervention_recommendations = ${probeResults.capadex_intervention_recommendations} rows (READY)
│
└── S7: Memory Consumption Layer
     Depends on: S1 + S2 (needs historical snapshots as memory source)
     CAPADEX reference: wcl5_memory = ${probeResults.wcl5_memory} rows, ${probeResults.wcl5_memory_types}/7 types (READY)
     EI gap: no memory concept (absent entirely)
     LBI gap: no memory concept (absent entirely)
     CB gap: career_behavioural_memory = ${probeResults.career_behavioural_memory} rows; not driving product UI
\`\`\`

---

## Per-Product Dependency Map

### EI (Employability Index) — Coverage 32% / Confidence 23%

Critical path to unblock:
\`\`\`
S10 Auth (commercial guard)
  → S8 Identity (stored per-user EI score)
    → S9 Report Integrity (formula unification: GAP-1 CRITICAL)
      → S1 Snapshot (takeSnapshot trigger / cron)
        → S2 Longitudinal (history table)
          → S3 Trend (EI velocity)
            → S5 Personalization (from wcl0_user_intelligence)
\`\`\`

Parallel (no dependencies on above):
- S6 (connect EI computation to wcl0_user_intelligence read API)
- S4 (user-keyed EI improvement recommendations)

### LBI (Learning Behavior Index) — Coverage 25% / Confidence 0%

Critical path to unblock:
\`\`\`
S10 Auth (MUST FIRST — G5: 5 unauth routes expose all users)
  → S8 Identity (trigger calculateLBI() after CAPADEX completion — G2 QUICK WIN)
    → S9 Report Integrity (create lbi_report_types + lbi_subdomain_report_map — G3)
      → S6 User Intelligence (connect CAPADEX behaviour to LBI framework)
        → S1+S2 Snapshot (lbi_score_history table — G4)
          → S3 Trend (LBI learning trajectory)
            → S5 Personalization (age-band + behaviour from wcl0)
\`\`\`

Parallel (no dependencies on above):
- LBI framework seeding (19 domains, age bands — G1 PRODUCT-SPECIFIC, not shared)

### Career Builder — Coverage 37% / Confidence 17%

Critical path to unblock:
\`\`\`
S10 Auth (requireAuth on 12 unauth routes — CB-specific)
  → S8 Identity (career-behavior-adapter trigger on session completion)
    → S4 Recommendation Persistence (user_id column + bridge activation)
      → S1+S2 Snapshot (DB-backed career-memory snapshots)
        → S7 Memory (career_behavioural_memory → progressLedger feed)
          → S3 Trend (career progress trajectory)
            → S5 Personalization (from wcl0_user_intelligence)
\`\`\`

Parallel (no dependencies on above):
- S9 Report (dedicated career report surface)
- S6 (career-behavior-adapter already partial — wire wcl0 read fully)

---

## Cross-Product Critical Path (shortest path to simultaneous lift)

The three capabilities that unblock the most product dimensions simultaneously, in order:

1. **S10 Auth** — must precede G2 (LBI) and CB route fixes. Config-only: SESSION_SECRET + FF flags. Code: requireAuth additions.
2. **S8 Identity + post-completion hook** — feeds LBI scoring (G2), career-behavior-adapter, EI stored score. Single hook, three products benefit.
3. **S1+S2 Snapshot + Persistence** — same pattern (CAPADEX WC-L5) adapted for EI (cron trigger), LBI (history table), CB (DB-backed career-memory). Unblocks the entire longitudinal chain for all three.
`;

  write('02_product_dependency_map.md', d2);

  // ─── DELIVERABLE 3: Capability Reuse Analysis ─────────────────────────────
  console.log('Generating Deliverable 3 — Capability Reuse Analysis …');

  // Count blocked dimensions per capability
  const capabilityImpact = [
    { id:'S1', name:'Snapshot Framework',              productsBlocked:3, dimsBlocked:3, effortDays:3, reusableAsset:'WC-L5 post-completion hook pattern' },
    { id:'S2', name:'Longitudinal Persistence',        productsBlocked:3, dimsBlocked:3, effortDays:3, reusableAsset:'append-only INSERT (not UPSERT) pattern; cron trigger' },
    { id:'S3', name:'Trend Engine',                    productsBlocked:3, dimsBlocked:3, effortDays:2, reusableAsset:'WC-L1 trend math (already real)' },
    { id:'S4', name:'Recommendation Persistence',      productsBlocked:3, dimsBlocked:3, effortDays:4, reusableAsset:'career-behavior-adapter; capadex_intervention_recommendations' },
    { id:'S5', name:'Personalization Consumption',     productsBlocked:3, dimsBlocked:3, effortDays:3, reusableAsset:'wcl0_user_intelligence consumer API' },
    { id:'S6', name:'User Intelligence Store',         productsBlocked:2, dimsBlocked:4, effortDays:2, reusableAsset:'wcl0_user_intelligence (built, needs consumer endpoints)' },
    { id:'S7', name:'Memory Consumption Layer',        productsBlocked:3, dimsBlocked:3, effortDays:3, reusableAsset:'WC-L5 retrieval engine (read-only, ready)' },
    { id:'S8', name:'Identity Resolution',             productsBlocked:3, dimsBlocked:6, effortDays:3, reusableAsset:'career-behavior-adapter; post-completion hook trigger' },
    { id:'S9', name:'Report Data Integrity',           productsBlocked:3, dimsBlocked:3, effortDays:6, reusableAsset:'None — product-specific formula reconciliation required' },
    { id:'S10',name:'Auth & Security Hardening',       productsBlocked:3, dimsBlocked:4, effortDays:2, reusableAsset:'requireAuth + requireSuperAdmin middleware (exists)' },
  ];

  const capRows = capabilityImpact
    .sort((a,b) => (b.dimsBlocked / b.effortDays) - (a.dimsBlocked / a.effortDays))
    .map(c => `| ${c.id} | ${c.name} | ${c.productsBlocked}/3 | ${c.dimsBlocked} | ${c.effortDays}d | ${(c.dimsBlocked/c.effortDays).toFixed(2)} | ${c.reusableAsset} |`)
    .join('\n');

  const d3 = `# P-X1 · Deliverable 3 — Capability Reuse Analysis
_Generated ${ts}_

## Ranking: Dimensions Unlocked Per Engineering Day

Sorted by **impact/effort ratio** (dimensions unblocked ÷ estimated engineering days).

| ID | Capability | Products blocked | Dims unblocked | Est. effort | Dims/day | Reusable asset |
|---|---|---|---|---|---|---|
${capRows}

---

## What "Reuse" Means for Each Capability

### S10 — Auth & Security Hardening (ratio: 2.0)
**What exists**: \`requireAuth\` and \`requireSuperAdmin\` middleware are already in use across CAPADEX routes.  
**Reuse**: Copy the same guard pattern to 5 LBI routes and 12 CB routes.  
**New build**: Zero — pure pattern reuse. Config actions (SESSION_SECRET, FF flags) are owner-only.

### S8 — Identity Resolution (ratio: 2.0)
**What exists**: \`career-behavior-adapter.ts\` (pure, tested) bridges CAPADEX session → career profile. \`post_completion_hooks.ts\` pattern is proven.  
**Reuse**: Add a hook item that fires \`calculateLBI(userId)\` + \`updateCareerBehaviorProfile(userId)\` + persists EI score per user after each CAPADEX completion.  
**New build**: The hook trigger; EI per-user score persist (currently only logged in \`ei_calculation_logs\`).

### S3 — Trend Engine (ratio: 1.5)
**What exists**: WC-L1 trend engine (\`wc3_stage_state\` series). Logic for mean/slope per session series.  
**Reuse**: Extract the per-user trend math as a shared utility; adapt for EI score series (once S1+S2 provide history) and LBI score series.  
**New build**: Product-specific trend surfaces (EI velocity tab, LBI trend dashboard).

### S6 — User Intelligence Store (ratio: 2.0 — tied with S10/S8)
**What exists**: \`wcl0_user_intelligence\` = ${probeResults.wcl0_user_intelligence} rows. Persona + behaviour + segment. REST endpoint at \`GET /api/career/behavior-profile/:userId\`.  
**Reuse**: EI and LBI add a read call to the same endpoint; personalization inputs become populated without building new intelligence.  
**New build**: EI consumer (personalise scoring bands by segment); LBI consumer (personalise age-band weighting by behaviour profile).

### S1 — Snapshot Framework (ratio: 1.0)
**What exists**: WC-L5 \`post_completion_hooks.ts\` (item 20) snapshots all intelligence layers after each CAPADEX session.  
**Reuse**: The hook-invoke pattern. For EI: add a hook to \`takeSnapshot()\` after each EI compute (or cron daily). For LBI: change the UPSERT to INSERT (append-only). For CB: wire \`career_memory_snapshots\` table to profile-save events.  
**New build**: EI cron job; LBI history migration; CB snapshot trigger.

### S2 — Longitudinal Persistence (ratio: 1.0)
**What exists**: CAPADEX append-only session records. WC-L5 UPSERT-per-session (per-session memory, not per-update).  
**Reuse**: The "never overwrite, always INSERT" discipline. Apply to EI scores, LBI scores, CB snapshots.  
**New build**: \`lbi_score_history\` table migration; EI snapshot cron trigger; CB snapshot write on profile mutation.

### S5 — Personalization Consumption (ratio: 1.0)
**What exists**: \`wcl0_user_intelligence\` has persona/segment/behaviour. CB \`useCareerBrain\` already consumes it (partially).  
**Reuse**: The \`career-behavior-adapter\` consumption pattern. EI and LBI add the same read call.  
**New build**: EI personalisation layer (band weighting by behaviour profile); LBI age-band selection by wcl0 segment.

### S4 — Recommendation Persistence (ratio: 0.75)
**What exists**: \`capadex_intervention_recommendations\` (${probeResults.capadex_intervention_recommendations} rows); \`career-behavior-adapter\` bridges concern scores to career context.  
**Reuse**: The career-behavior-adapter bridge already maps CAPADEX recommendations → career profile. Activate the bridge consumer in CB.  
**New build**: EI user-keyed recommendation writes (resolve \`ref_review_queue\` backlog); LBI recommendation engine (data needed first); CB bridge consumer activation + user_id column ${probeResults.career_recommendations_has_user_id ? '(already present)' : '(needs migration)'}.

### S7 — Memory Consumption Layer (ratio: 1.0)
**What exists**: WC-L5 retrieval engine (read-only, zero writes). Memory already persisted: ${probeResults.wcl5_memory} rows, ${probeResults.wcl5_memory_types}/7 types.  
**Reuse**: \`GET /api/capadex/memory/:sessionId\` endpoint (read-only). Surface in CB \`progressLedger\`; EI timeline; LBI behaviour history.  
**New build**: Product UI consumers of the memory retrieval endpoint.

### S9 — Report Data Integrity (ratio: 0.5 — lowest leverage)
**What exists**: CAPADEX report pipeline (clean single source). \`requireAuth\` pattern.  
**Reuse**: CAPADEX report architecture as target pattern.  
**New build**: Product-specific. EI: formula reconciliation + gauge/modal unification (cannot be reused from elsewhere). LBI: create 2 missing tables + AI fabrication guard. CB: dedicated career report surface.  
**Note**: S9 has the lowest reuse leverage because the gaps are product-specific. It is CRITICAL for EI and LBI confidence scores but cannot be accelerated by platform work.

---

## Asset Inventory: What CAPADEX Has Built That Can Be Shared

| Asset | Location | Available for | Status |
|---|---|---|---|
| WC-L5 Memory Layer | \`wcl5_memory\` + retrieval endpoint | EI (timeline), CB (progressLedger), LBI (behaviour history) | ✅ READY |
| WC-L0 User Intelligence Store | \`wcl0_user_intelligence\` + \`/api/career/behavior-profile/:userId\` | EI (personalisation), LBI (segment weighting) | ✅ READY |
| WC-L1 Trend Engine | \`wc3_stage_state\` series math | EI (velocity), LBI (learning trajectory), CB (progress trend) | ✅ READY (data-starved) |
| Post-Completion Hook Pattern | \`post_completion_hooks.ts\` | EI (takeSnapshot trigger), LBI (calculateLBI trigger), CB (career bridge trigger) | ✅ READY |
| Career-Behavior Adapter | \`career-behavior-adapter.ts\` | LBI (CAPADEX → LBI bridge), CB (already partial) | ✅ READY |
| Intervention Library | \`intervention_library\` (${probeResults.intervention_library} rows) + \`capadex_intervention_recommendations\` | LBI (recs), CB (growth plan recs) | ✅ READY |
| requireAuth Middleware | \`backend/routes.ts\` middleware | LBI (5 routes), CB (12 routes) | ✅ READY |
| Subscription Packages | \`subscription_packages\` (${probeResults.subscription_packages} rows) | LBI, EI (commercial layer) | ✅ SEEDED |
`;

  write('03_capability_reuse_analysis.md', d3);

  // ─── DELIVERABLE 4: Implementation Roadmap ────────────────────────────────
  console.log('Generating Deliverable 4 — Implementation Roadmap …');

  const d4 = `# P-X1 · Deliverable 4 — Implementation Roadmap
_Generated ${ts}_
_PLANNING ONLY · STOP FOR APPROVAL BEFORE ANY IMPLEMENTATION_

---

## Roadmap Structure

Four phases of approximately 5–8 engineering days each (~25 engineering days total).
Each phase is **additive and flag-gated** (flag-off = byte-identical prior behaviour).
Phases 1+2 can begin in parallel; Phase 3 depends on Phase 2; Phase 4 is mostly parallel.

---

## Phase F1 — Security & Identity Foundation (~6 days)

**Goal**: Close security blockers and establish the identity resolution layer.  
**Products impacted**: ALL  
**Capabilities addressed**: S10, S8

### F1.1 — Auth Hardening (S10) [2 days, LOW risk]
Grounded in: WC-P2 G5 (5 unauth LBI routes), WC-P3 CB auth gaps.

1. **LBI admin route guards** — Add \`requireAuth + requireSuperAdmin\` to all 5 lbi-engine routes:
   \`POST /api/admin/lbi/calculate\`, \`POST /api/admin/lbi/recalculate-all\`,
   \`GET /api/admin/lbi/scores\`, \`GET /api/admin/lbi/score/:userId\`,
   \`DELETE /api/admin/lbi/scores/:userId\`.
   MUST complete before F1.2 (G5 pre-req for G2).

2. **CB route auth backfill** — Add \`requireAuth\` to career routes that handle user-specific data
   (career-memory read/write, career recommendations, career profile mutations).
   IDOR guard: Verify \`resolveEffectiveUserId\` pattern is applied to all career-memory endpoints.

3. **EI commercial guard** — Add entitlement enforcement to EI result endpoints that should be
   behind a subscription tier (per WC-P1 D11 Commercial gap).

4. **Config actions (owner, not code)** — Set \`SESSION_SECRET\` in deployment secrets +
   add \`FF_WC3_STAGE\`, \`FF_WC3_OUTCOME\`, \`FF_DECISION_PERSISTENCE\` to production env vars.
   OTP plaintext storage: documented risk; fix in separate security sprint (bcrypt OTP migration).

### F1.2 — Cross-Product Identity Hook (S8) [3 days, MEDIUM risk]
Grounded in: WC-P2 G2 (CAPADEX → LBI), WC-P3 CB bridge, WC-P1 EI stored score.

1. **calculateLBI post-completion trigger** — Add hook item to \`post_completion_hooks.ts\` that
   calls \`calculateLBI(userId)\` after each CAPADEX session completion (user must be identified,
   skip anonymous). Reads CAPADEX behaviour spine → writes \`lbi_scores\` row for the user.
   **Pre-req**: F1.1.1 (auth guard on routes).

2. **EI per-user score persistence** — Add hook item to persist the computed EI score to a
   \`user_ei_scores\` table (or \`career_seeker_profiles.data.ei_snapshot\` JSONB).
   Currently computed at query time only — no per-user history exists.

3. **Career-behavior-adapter trigger** — Ensure the CAPADEX→Career bridge fires on every
   completion (verify the existing hook item is active; confirm it is not silently skipped for
   non-career users). Grounded in: WC-P3 D03 bridge inactive finding.

### F1.3 — LBI Report Tables (S9 partial) [1 day, LOW risk]
Grounded in: WC-P2 G3.

1. **Create \`lbi_report_types\` and \`lbi_subdomain_report_map\`** tables (migrations already
   documented in WC-P2 G3 analysis). No seed data required to unblock the admin routes.

2. **AI fabrication guard** — Add a guard to the LBI AI report generator that REJECTS generation
   when \`lbi_scores\` = 0 for the requested user, returning a degraded
   "assessment required" state instead of hallucinated content.

---

## Phase F2 — Snapshot & Persistence Layer (~7 days)

**Goal**: Wire per-product snapshot and history persistence.  
**Products impacted**: EI, LBI, Career Builder  
**Capabilities addressed**: S1, S2, S4 partial

### F2.1 — EI Snapshot Framework (S1 + S2) [2 days]
Grounded in: WC-P1 GAP-2 (Longitudinal dead, 0 snapshots).

1. **Cron trigger** — Add a daily cron job (or post-EI-compute hook) that calls
   \`takeSnapshot(userId)\` for every active user after their EI score is computed.
   This writes to \`ei_snapshot_versions\` (table exists, 0 rows).

2. **EI per-user score table** — Verify the stored score from F1.2.2 creates the input needed.
   The cron trigger should read the latest score and write a dated snapshot.

3. **Smoke-test**: After F2.1, re-run the EI scorecard script. Target:
   \`ei_snapshot_versions\` ≥ 1 row; D10 Longitudinal coverage >15%.

### F2.2 — LBI History Table (S1 + S2) [2 days]
Grounded in: WC-P2 G4 (no longitudinal layer).

1. **Create \`lbi_score_history\` table** — INSERT-not-UPSERT model. Each calculateLBI call
   writes a dated history row (user_id, calculated_at, domain_scores JSONB, composite_score).
   Existing \`lbi_scores\` continues as the "latest" row.

2. **Update calculateLBI** to INSERT into \`lbi_score_history\` before or alongside the UPSERT
   to \`lbi_scores\`.

3. **Smoke-test**: After F1.2.1 fires (LBI post-completion trigger), verify
   \`lbi_score_history\` receives rows.

### F2.3 — Career Builder DB-Backed Memory (S1 + S2) [3 days]
Grounded in: WC-P3 D07 Longitudinal (career-memory.ts in-memory Map).

1. **career_memory_snapshots write path** — Wire \`career-memory.ts\` to write snapshots to
   \`career_memory_snapshots\` (table ${probeResults.career_memory_snapshots === -1 ? 'needs creation' : 'exists, 0 rows'})
   on each significant career-profile mutation (profile save, assessment complete, resume upload).
   DB-write is additive; in-memory Map remains for fast reads.

2. **progressLedger feed** — Connect \`useCareerBrain.ts\` \`progressLedger\` calculation to read
   from \`career_memory_snapshots\` series instead of only from the in-memory state.

3. **career_recommendations user_id bridge** — ${probeResults.career_recommendations_has_user_id
     ? 'user_id column present; activate the bridge consumer in career-behavior-adapter to write user-keyed recs.'
     : 'Add user_id column to career_recommendations; activate bridge consumer in career-behavior-adapter.'
   }

---

## Phase F3 — Intelligence Activation (~7 days)

**Goal**: Connect products to the shared intelligence store; activate trend computation.  
**Products impacted**: EI, LBI, Career Builder  
**Capabilities addressed**: S5, S6, S7, S3, S4 (completion)

### F3.1 — User Intelligence Store Consumer APIs (S6) [2 days]
Grounded in: WC-L0 store built (${probeResults.wcl0_user_intelligence} rows), EI/LBI disconnected.

1. **EI intelligence consumer** — Add a call in the EI scoring path to read
   \`wcl0_user_intelligence\` for the user; use the segment/behaviour data to:
   (a) personalise the EI band weighting by persona group,
   (b) surface the user's behavioural context alongside the EI score.

2. **LBI intelligence consumer** — Add a read call from LBI domain scoring to
   \`wcl0_user_intelligence\`; use behaviour dimensions to weight age-band selection.

### F3.2 — Personalization Layer Wire-Up (S5) [2 days, depends on F3.1]
Grounded in: WC-P1 D09 (30%/25%), WC-P2 D07 (30%/0%), WC-P3 D09 (55%/25%).

1. **EI personalisation** — Unify band label split (6-dim formula bands vs 8-dim modal bands)
   by deriving BOTH from the single reconciled formula (S9 dependency — can stub until S9 resolves).
   Add wcl0 segment → band-weight personalisation (e.g. competitive segment → career-velocity weighting).

2. **LBI personalisation** — Read user segment from wcl0_user_intelligence; select age-band
   questionnaire accordingly. Fall back to demographic inference if wcl0 absent.

3. **CB personalisation depth** — Deepen the existing partial implementation: ensure ALL career tabs
   receive the full behaviour context (not just the top-level CareerBrain aggregator).

### F3.3 — Memory Layer Surface (S7) [2 days, depends on F2]
Grounded in: WC-L5 retrieval engine ready (${probeResults.wcl5_memory} rows).

1. **EI memory surface** — Add a "your history" panel to the EI gauge UI reading from
   the WC-L5 memory retrieval endpoint (\`GET /api/capadex/intelligence/memory\`).
   Show prior scores and trend direction.

2. **CB memory surface** — Feed \`career_behavioural_memory\` + WC-L5 memory to \`progressLedger\`.
   Surface in Career Builder's Journey tab as a longitudinal progress card.

### F3.4 — Trend Engine Activation (S3) [1 day, depends on F2]
Grounded in: WC-L1 trend engine real but trendIntelligence flag OFF.

1. **Enable \`trendIntelligence\` and \`longitudinalAutomation\` flags in the workflow command**.
   Per WC-L1B, only 2 users will produce trends (data ceiling, not a bug).

2. **EI trend computation** — Once EI snapshots exist (F2.1), add trend computation to the EI
   dashboard using the same slope/mean math as WC-L1.

---

## Phase F4 — Report Integrity & Commercial (6–8 days, mostly parallel to F2/F3)

**Goal**: Fix product-specific report integrity; close commercial wiring gaps.  
**Products impacted**: EI (critical), LBI (critical), CB  
**Capabilities addressed**: S9, Commercial hardening

### F4.1 — EI Formula Reconciliation (S9 EI) [3 days, CRITICAL]
Grounded in: WC-P1 GAP-1 (3 divergent formulas — CRITICAL, undermines product credibility).

1. **Decision required**: Choose ONE authoritative EI formula (recommend: 8-dimension as documented,
   since it is the product-facing model). Archive the 6-dim formula as a legacy calculation.

2. **Reconcile \`employabilityEngine.ts\`** to implement the 8-dim formula with all inputs
   (assessment score, education score, skills, experience, trajectory, competency, social, certifications).

3. **Wire competency assessment → EI gauge** — Currently \`useHybridEI\` and the assessment flow
   are independent. The competency score (25pt weight documented) must feed the gauge score.
   This is WC-P1 GAP-5 (second most critical gap).

4. **Test**: verify gauge score == modal breakdown total after fix. Log divergence to 0 in smoke test.

### F4.2 — LBI Report Infrastructure (S9 LBI) [2 days]
Grounded in: WC-P2 G3 (report infrastructure broken / fabricated).

1. **F1.3 complete** (tables created).
2. **Seed report types** for System A (CAPADEX-derived) and System B (framework-based).
3. **Remove hardcoded AI prompt scores** (currently 60–95 range). Guard: if \`lbi_scores\`
   exist for user → pass real scores to prompt. Else → return "assessment required" state.

### F4.3 — CB Career Report Surface (S9 CB) [3 days]
Grounded in: WC-P3 D08 Report Intelligence (35%/20%).

1. **Dedicated career intelligence report** — A per-user PDF/HTML career report that composes:
   EI score + competency bands + CAPADEX stage + career pathway + recommended actions.
   Routes into the existing Career Builder "Reports" panel.

---

## Phase Sequencing Summary

| Phase | Days | Depends on | Products impacted | Shared capabilities |
|---|---|---|---|---|
| F1 — Security & Identity | 6 | — (prerequisite) | ALL | S10, S8 |
| F2 — Snapshot & Persistence | 7 | F1 | EI, LBI, CB | S1, S2, S4 |
| F3 — Intelligence Activation | 7 | F2 | EI, LBI, CB | S5, S6, S7, S3 |
| F4 — Report Integrity | 7 | F1 (F4.1 parallel to F2) | EI (CRITICAL), LBI (CRITICAL), CB | S9 |
| **TOTAL** | **~25** | | | |
`;

  write('04_implementation_roadmap.md', d4);

  // ─── DELIVERABLE 5: Readiness Uplift Forecast ─────────────────────────────
  console.log('Generating Deliverable 5 — Readiness Uplift Forecast …');

  // Per-product dimension uplift estimates (conservative, evidence-grounded)
  // EI dimensions: 11 total
  const eiUplift = {
    'Assessment Readiness':  { base:[35,20], afterF1:[38,22], afterF2:[40,25], afterF3:[45,30], afterF4:[60,45], note:'F4.1 competency→gauge wire is the key lever' },
    'Question Bank':         { base:[30,25], afterF1:[30,25], afterF2:[30,25], afterF3:[35,30], afterF4:[35,30], note:'Bounded by real user completions (data, not code)' },
    'Competency Framework':  { base:[20,15], afterF1:[20,15], afterF2:[20,15], afterF3:[20,15], afterF4:[45,30], note:'F4.1 wires framework → gauge (major uplift)' },
    'Employability Scoring': { base:[65,40], afterF1:[65,40], afterF2:[65,40], afterF3:[65,40], afterF4:[80,60], note:'F4.1 formula unification (removes divergence)' },
    'Outcome Intelligence':  { base:[25,20], afterF1:[25,20], afterF2:[28,22], afterF3:[30,25], afterF4:[30,25], note:'Bounded by occupation data (owner action)' },
    'Recommendations':       { base:[40,25], afterF1:[42,27], afterF2:[45,30], afterF3:[55,35], afterF4:[55,35], note:'S4 user-keyed recs (F2/F3)' },
    'Career Routing':        { base:[20,15], afterF1:[20,15], afterF2:[20,15], afterF3:[22,18], afterF4:[22,18], note:'Bounded by occupation data (owner action)' },
    'Reporting':             { base:[65,55], afterF1:[65,55], afterF2:[67,57], afterF3:[70,60], afterF4:[80,70], note:'F4.1 gauge unification; F3 longitudinal panel' },
    'Personalization':       { base:[30,25], afterF1:[32,27], afterF2:[35,28], afterF3:[55,40], afterF4:[55,40], note:'F3.1+F3.2 wcl0 consumption (largest EI lever in F3)' },
    'Longitudinal':          { base:[15,10], afterF1:[15,10], afterF2:[35,20], afterF3:[55,35], afterF4:[55,35], note:'F2.1 snapshot trigger; F3.4 trend activation' },
    'Commercial':            { base:[10, 5], afterF1:[20,10], afterF2:[20,10], afterF3:[20,10], afterF4:[25,12], note:'F1.3 entitlement guard; bounded by Razorpay config (owner)' },
  };

  function avg(dims: Record<string, {base:[number,number], afterF1:[number,number], afterF2:[number,number], afterF3:[number,number], afterF4:[number,number]}>, phase: 'base'|'afterF1'|'afterF2'|'afterF3'|'afterF4'): [number,number] {
    const vals = Object.values(dims).map(d => d[phase]);
    const covAvg = Math.round(vals.reduce((s,v) => s+v[0], 0) / vals.length);
    const confAvg = Math.round(vals.reduce((s,v) => s+v[1], 0) / vals.length);
    return [covAvg, confAvg];
  }

  const eiProgression = ['base','afterF1','afterF2','afterF3','afterF4'].map(p => avg(eiUplift, p as any));

  // LBI dimensions: 10 total
  const lbiUplift = {
    'Framework (Domain/Qs)': { base:[5,0],  afterF1:[5,0],  afterF2:[5,0],  afterF3:[5,0],  afterF4:[5,0],  note:'Owner action: domain seeding (not shared cap)' },
    'Assessment Flow':        { base:[70,0], afterF1:[70,0], afterF2:[70,0], afterF3:[70,5], afterF4:[70,5], note:'Structurally ready; bounded by 0 sessions' },
    'Scoring Engine':         { base:[80,0], afterF1:[80,5], afterF2:[80,20], afterF3:[80,25], afterF4:[80,25], note:'F1.2.1 trigger fires calculateLBI (G2 quick win)' },
    'Report Generation':      { base:[20,0], afterF1:[40,5], afterF2:[40,5], afterF3:[45,10], afterF4:[55,20], note:'F1.3 tables + F4.2 AI guard' },
    'Recommendations':        { base:[15,0], afterF1:[15,0], afterF2:[20,0], afterF3:[35,5],  afterF4:[40,10], note:'S4 activation via F2/F3; bounded by data' },
    'Personalization':        { base:[30,0], afterF1:[30,0], afterF2:[32,0], afterF3:[48,5],  afterF4:[48,5],  note:'F3.1+F3.2 wcl0 consumption' },
    'Longitudinal':           { base:[0,0],  afterF1:[0,0],  afterF2:[20,0], afterF3:[35,5],  afterF4:[35,5],  note:'F2.2 history table; F3.4 trend' },
    'Commercial':             { base:[60,0], afterF1:[60,0], afterF2:[60,0], afterF3:[60,0],  afterF4:[60,0],  note:'Infrastructure ready; cold-start (data)' },
    'Security':               { base:[40,0], afterF1:[85,0], afterF2:[85,0], afterF3:[85,0],  afterF4:[85,0],  note:'F1.1 auth hardening (5 unauth routes)' },
    'Product UX':             { base:[10,5], afterF1:[12,5], afterF2:[15,5], afterF3:[18,8],  afterF4:[18,8],  note:'Incremental UI improvements' },
  };

  const lbiProgression = ['base','afterF1','afterF2','afterF3','afterF4'].map(p => avg(lbiUplift, p as any));

  // CB dimensions: 10 total
  const cbUplift = {
    'Career Discovery':     { base:[45,20], afterF1:[47,22], afterF2:[50,25], afterF3:[55,30], afterF4:[60,35], note:'S5/S6 personalisation depth' },
    'Career Mapping':       { base:[45,25], afterF1:[47,27], afterF2:[50,28], afterF3:[55,32], afterF4:[60,38], note:'S6 intelligence store enrichment' },
    'Recommendations':      { base:[35,15], afterF1:[37,18], afterF2:[50,25], afterF3:[60,35], afterF4:[65,40], note:'F2.3 user-keyed recs; F3 bridge activation' },
    'Growth Planning':      { base:[30,10], afterF1:[32,12], afterF2:[35,15], afterF3:[40,20], afterF4:[45,25], note:'S4 recs feed growth plan' },
    'Career Pathway':       { base:[25,15], afterF1:[27,17], afterF2:[30,18], afterF3:[35,22], afterF4:[35,22], note:'Bounded by occupation data' },
    'Outcome Intelligence': { base:[25,15], afterF1:[27,17], afterF2:[30,18], afterF3:[35,22], afterF4:[38,25], note:'S8 CAPADEX→CB bridge activation' },
    'Longitudinal':         { base:[15, 5], afterF1:[17, 7], afterF2:[40,15], afterF3:[60,30], afterF4:[65,35], note:'F2.3 DB-backed memory; F3.3+F3.4 trend' },
    'Report Intelligence':  { base:[35,20], afterF1:[37,22], afterF2:[40,25], afterF3:[45,28], afterF4:[60,40], note:'F4.3 dedicated report surface' },
    'Personalization':      { base:[55,25], afterF1:[57,27], afterF2:[60,30], afterF3:[70,40], afterF4:[72,42], note:'F3.2 wcl0 full depth; already partially real' },
    'Commercial':           { base:[20,10], afterF1:[22,12], afterF2:[22,12], afterF3:[25,15], afterF4:[30,18], note:'Bounded by Razorpay config + real users (owner)' },
  };

  const cbProgression = ['base','afterF1','afterF2','afterF3','afterF4'].map(p => avg(cbUplift, p as any));

  function phaseRow(phase: string, cov: number, conf: number) {
    return `| ${phase} | ${cov}% | ${conf}% |`;
  }

  const eiRows = ['Baseline','After F1','After F2','After F3','After F4'].map((l,i) => phaseRow(l, eiProgression[i][0], eiProgression[i][1])).join('\n');
  const lbiRows = ['Baseline','After F1','After F2','After F3','After F4'].map((l,i) => phaseRow(l, lbiProgression[i][0], lbiProgression[i][1])).join('\n');
  const cbRows = ['Baseline','After F1','After F2','After F3','After F4'].map((l,i) => phaseRow(l, cbProgression[i][0], cbProgression[i][1])).join('\n');

  const d5 = `# P-X1 · Deliverable 5 — Readiness Uplift Forecast
_Generated ${ts}_

## Methodology
- Baseline scores are from published audit scorecards (WC-P1/P2/P3), grounded in code + DB.
- Phase uplift is estimated per-dimension based on the capability each phase implements.
- Two axes reported separately: **Coverage** (structural) and **Confidence** (activation/data).
- Estimates are conservative: no dimension is upgraded without an identified mechanical cause.
- Bounded items (occupation data, domain seeding, real user volume) are NOT inflated.

---

## EI — Employability Index

| Phase | Coverage | Confidence |
|---|---|---|
${eiRows}

**EI uplift by phase:**
| Dimension | Baseline | After F4 | Lever |
|---|---|---|---|
${Object.entries(eiUplift).map(([d, v]) => `| ${d} | ${v.base[0]}%/${v.base[1]}% | ${v.afterF4[0]}%/${v.afterF4[1]}% | ${v.note} |`).join('\n')}

### EI honest ceiling analysis
- **70% coverage target**: Reachable only if occupation data is expanded (GAP-3, owner data action),
  and if real users complete assessments (GAP-Q, demand-side).
  After F4: ~${eiProgression[4][0]}% — still below 70%. **Product-specific gap (GAP-3 occupation expansion)
  is the binding constraint after shared capabilities are applied.**
- **70% confidence target**: Contingent on formula unification (F4.1). After F4: ~${eiProgression[4][1]}% — below 70%.
  Confidence rises primarily from real user volume and formula integrity.

---

## LBI — Learning Behavior Index

| Phase | Coverage | Confidence |
|---|---|---|
${lbiRows}

**LBI uplift by phase:**
| Dimension | Baseline | After F4 | Lever |
|---|---|---|---|
${Object.entries(lbiUplift).map(([d, v]) => `| ${d} | ${v.base[0]}%/${v.base[1]}% | ${v.afterF4[0]}%/${v.afterF4[1]}% | ${v.note} |`).join('\n')}

### LBI honest ceiling analysis
- **70% coverage target**: Reachable only after framework seeding (19 domains, G1 — OWNER/PRODUCT action).
  After F4: ~${lbiProgression[4][0]}% — Framework at 5% is a structural product gap, not a shared capability.
  **G1 framework seeding is the single largest LBI blocker and has no shared-platform equivalent.**
- **70% confidence target**: Requires real LBI sessions (data volume). After F4: ~${lbiProgression[4][1]}%.
  The scoring engine is ready (80% structural) but 0 sessions produce 0 confidence.

---

## Career Builder

| Phase | Coverage | Confidence |
|---|---|---|
${cbRows}

**CB uplift by phase:**
| Dimension | Baseline | After F4 | Lever |
|---|---|---|---|
${Object.entries(cbUplift).map(([d, v]) => `| ${d} | ${v.base[0]}%/${v.base[1]}% | ${v.afterF4[0]}%/${v.afterF4[1]}% | ${v.note} |`).join('\n')}

### CB honest ceiling analysis
- **70% coverage target**: After F4: ~${cbProgression[4][0]}% — approaching 70%.
  **CB has the most to gain from shared capabilities** because its existing infrastructure is the most complete.
  The binding constraint after F4 is job supply (0 postings) and mentor supply (0 mentors) — both data/market.
- **70% confidence target**: After F4: ~${cbProgression[4][1]}% — below 70%.
  Confidence is data-starved across all three products.

---

## Cross-Product Readiness Forecast Summary

| Product | Baseline Coverage | After F1 | After F2 | After F3 | After F4 | 70% reachable? |
|---|---|---|---|---|---|---|
| **EI** | 32% | ${eiProgression[1][0]}% | ${eiProgression[2][0]}% | ${eiProgression[3][0]}% | **${eiProgression[4][0]}%** | ⚠️ Need occupation data + real users |
| **LBI** | 25% | ${lbiProgression[1][0]}% | ${lbiProgression[2][0]}% | ${lbiProgression[3][0]}% | **${lbiProgression[4][0]}%** | ⚠️ Need framework seeding + real users |
| **CB** | 37% | ${cbProgression[1][0]}% | ${cbProgression[2][0]}% | ${cbProgression[3][0]}% | **${cbProgression[4][0]}%** | ⚠️ Need job/mentor supply (market) |

| Product | Baseline Confidence | After F4 | 70% confidence reachable? |
|---|---|---|---|
| **EI** | 23% | **${eiProgression[4][1]}%** | ❌ Requires formula fix (F4.1) + real user volume |
| **LBI** | 0% | **${lbiProgression[4][1]}%** | ❌ Requires framework seeding + sessions |
| **CB** | 17% | **${cbProgression[4][1]}%** | ❌ Requires job/mentor supply + user volume |

**Honest conclusion**: 70% Coverage/Confidence is NOT reachable through shared-capability engineering alone.
Each product has a critical **data/market gap** that engineering cannot substitute:
- EI: occupation graph expansion (30 → 300+ occupations)
- LBI: framework seeding (19 domains, 3 age bands) + real assessment sessions
- CB: job postings supply + mentor profiles

Shared capabilities are necessary but not sufficient. The forecast above shows the realistic
ceiling from engineering alone, reported honestly without inflation.
`;

  write('05_readiness_uplift_forecast.md', d5);

  // ─── DELIVERABLE 6: Priority Sequencing ──────────────────────────────────
  console.log('Generating Deliverable 6 — Priority Sequencing …');

  const d6 = `# P-X1 · Deliverable 6 — Priority Sequencing
_Generated ${ts}_

## Ranking Methodology
Capabilities are ranked by: **Impact** (coverage uplift × products affected) ÷ **Effort** (engineering days),
with three additional flags:
- 🔐 **Security blocker** — must complete before anything else
- 🔗 **Dependency enabler** — other capabilities depend on this
- ⚡ **Quick win** — ≤1 day, immediate measurable effect

---

## Tier 1: Immediate (Week 1) — Security + Foundation

| # | Capability | Products | Effort | Impact | Flags |
|---|---|---|---|---|---|
| 1 | **S10.1: LBI auth hardening** (5 unauth routes → requireAuth + requireSuperAdmin) | LBI | 0.5 days | Security blocker removed | 🔐 ⚡ |
| 2 | **S10.2: CB route auth backfill** (requireAuth on user-data routes + IDOR guard) | CB | 0.5 days | Security blocker removed | 🔐 ⚡ |
| 3 | **S10.3: Config actions** (SESSION_SECRET, FF flags in production) | ALL | Owner, <1h | P0 launch blocker removed | 🔐 ⚡ |
| 4 | **S9.LBI.partial: LBI report tables** (create 2 missing tables + AI guard) | LBI | 1 day | D05 Report 20%→40% | ⚡ |
| 5 | **S8.LBI: calculateLBI trigger** (post-completion hook item) | LBI | 1 day | D03 Scoring 0%→15% confidence | ⚡ 🔗 |

**Tier 1 output**: Security blockers resolved. LBI can safely recalculate scores. CAPADEX sessions now generate LBI scores automatically. ~2 days total.

---

## Tier 2: High Priority (Week 2–3) — Snapshot + Persistence

| # | Capability | Products | Effort | Impact | Flags |
|---|---|---|---|---|---|
| 6 | **S1.EI: EI snapshot cron trigger** (call takeSnapshot daily / post-compute) | EI | 1 day | D10 Longitudinal 15%→35% | 🔗 |
| 7 | **S2.LBI: lbi_score_history table** (INSERT model) | LBI | 1 day | D08 Longitudinal 0%→20% | 🔗 |
| 8 | **S1+S2.CB: DB-backed career-memory** (wire to career_memory_snapshots) | CB | 2 days | D07 Longitudinal 15%→40% | 🔗 |
| 9 | **S4.CB: career_recommendations bridge** (user_id keying + adapter activation) | CB | 2 days | D03 Recommendations 35%→50% | |
| 10 | **S8.EI: per-user EI score persistence** (store score post-compute) | EI | 1 day | Enables S5, S6, S7 for EI | 🔗 |

**Tier 2 output**: All three products have a snapshot/history layer. Cross-product identity resolved. ~7 days total.

---

## Tier 3: Intelligence Activation (Week 3–4)

| # | Capability | Products | Effort | Impact | Flags |
|---|---|---|---|---|---|
| 11 | **S6.EI+LBI: wcl0 consumer APIs** (read wcl0_user_intelligence in EI + LBI scoring paths) | EI, LBI | 2 days | D09 Pers. EI 30%→55%; LBI D07 30%→48% | |
| 12 | **S5: Personalization wire-up** (EI band-by-segment; LBI age-band from wcl0) | EI, LBI | 2 days | Confidence uplift in D09 | |
| 13 | **S5.CB: Personalization depth** (all tabs receive full behaviour context) | CB | 1 day | D09 Personalization 55%→70% | |
| 14 | **S3: Enable trend flags** (trendIntelligence + longitudinalAutomation in workflow) | ALL | 0.5 days | Trend computations activate | ⚡ |
| 15 | **S7.EI: EI memory surface** (WC-L5 retrieval → EI history panel) | EI | 1 day | D08 Reporting improvement | |
| 16 | **S7.CB: CB memory surface** (career_behavioural_memory + WC-L5 → progressLedger) | CB | 1.5 days | D07 Longitudinal 40%→65% | |

**Tier 3 output**: Personalization is live. Trend flags on. Memory surfaces visible. ~8 days total.

---

## Tier 4: Report Integrity (Week 4–5) — Can run partly parallel to Tier 2/3

| # | Capability | Products | Effort | Impact | Flags |
|---|---|---|---|---|---|
| 17 | **S9.EI: Formula reconciliation** (unify 6-dim + 8-dim; competency→gauge wire) | EI | 3 days | D04 65%→80%, D03 20%→45%, GAP-1 closed | 🔐 CRITICAL |
| 18 | **S9.LBI: Report seed + AI guard** (seed report types; guard AI fabrication) | LBI | 2 days | D05 20%→55% | |
| 19 | **S9.CB: Career report surface** (dedicated per-user career report) | CB | 3 days | D08 35%→60% | |

**Tier 4 output**: Report integrity closed for EI (CRITICAL) and LBI. CB has a report product. ~8 days total.

---

## Product-Specific Actions NOT in Shared Capabilities

These gaps are blocking but have no shared-platform equivalent — they require product-specific investment:

| Product | Gap | Effort | Impact |
|---|---|---|---|
| EI | Occupation graph expansion (30 → 300+) | Owner data action | D05/D07 Career Routing |
| LBI | Framework seeding (19 domains, 3 age bands, questions) | 3–5 days content + eng | D01 Framework 5%→75% |
| LBI | System B domain seeding (conceptual alignment decision first) | 5–7 days | D04 Learning Pattern |
| CB | Job postings supply (0 postings → employer pipeline) | Market/BD action | Jobs tab activation |
| CB | Mentor profiles supply (0 mentors → mentor recruitment) | Market/BD action | Mentors tab activation |

---

## Shortest Path to 70% Readiness

The 70% threshold requires shared capabilities (Tiers 1–4) PLUS the product-specific actions above.
Engineering work alone reaches: EI ~${eiProgression[4][0]}%, LBI ~${lbiProgression[4][0]}%, CB ~${cbProgression[4][0]}%.

### To push EI to 70%: (after Tier 1–4 completes)
1. Occupation data expansion → D05 25%→60%, D07 20%→60%
2. Real assessment completions (user volume)
3. Estimated: **3–4 additional product sprints** after Tier 4

### To push LBI to 70%: (after Tier 1–4 completes)
1. **Framework seeding — G1** (single largest gap): 19 domains, age bands, questionnaires
2. Real LBI sessions flowing
3. Estimated: **1–2 additional product sprints** after Tier 4 (LBI has the clearest path)

### To push CB to 70%: (after Tier 1–4 completes)
1. Job postings supply (market action)
2. Mentor profiles supply (market action)
3. Estimated: **Depends on market execution, not engineering**

---

## Cross-Product Impact Score (by capability, evidence-grounded)

| Rank | Capability | Products impacted | Dims unblocked | Eng days | Score |
|---|---|---|---|---|---|
| 1 | S10 Auth Hardening | 3 | 4 | 2 | **2.0** |
| 2 | S8 Identity Resolution | 3 | 6 | 3 | **2.0** |
| 3 | S6 User Intelligence Store | 2+1partial | 4 | 2 | **2.0** |
| 4 | S3 Trend Engine | 3 | 3 | 1 | **3.0** (low effort) |
| 5 | S5 Personalization Consumption | 3 | 3 | 3 | **1.0** |
| 6 | S1 Snapshot Framework | 3 | 3 | 3 | **1.0** |
| 7 | S2 Longitudinal Persistence | 3 | 3 | 3 | **1.0** |
| 8 | S7 Memory Layer | 3 | 3 | 3 | **1.0** |
| 9 | S4 Recommendation Persistence | 3 | 3 | 4 | **0.75** |
| 10 | S9 Report Integrity | 3 | 3 | 6+ | **0.5** |

**Top single action by score**: Enable trend flags in workflow (~30 minutes, S3 step 14 above).  
**Top multi-product unlock**: S8 Identity Hook (LBI scoring fires, EI stores per-user score, CB bridge activates) — 1 day of work.  
**Highest-ROI product-specific action**: LBI G1 framework seeding (~3 days, D01 from 5% to 75%).
`;

  write('06_priority_sequencing.md', d6);

  // ─── DELIVERABLE 7: STOP FOR APPROVAL ────────────────────────────────────
  console.log('Generating Deliverable 7 — STOP FOR APPROVAL …');

  const d7 = `# P-X1 · Deliverable 7 — STOP FOR APPROVAL
_Generated ${ts}_
_READ-ONLY AUDIT. NO IMPLEMENTATION HAS BEEN PERFORMED. NO SCHEMA CHANGES. NO WRITES._

---

## Executive Summary

### What was audited
All published product audits were synthesized:
- **WC-P1** (EI — 32% coverage / 23% confidence)
- **WC-P2** (LBI — 25% coverage / 0% confidence)
- **WC-P3** (Career Builder — 37% coverage / 17% confidence)
- **WC-L0/L0B/L0E** (behaviour graph, user intelligence store, personalization layer)
- **WC-L1B** (longitudinal capture — 0% trend feasibility)
- **WC-L5** (memory intelligence — 5/5 structural, 5/5 activation for CAPADEX)
- **WC-C1–C10** (commercial, security, launch readiness)
- **Launch-Readiness** (platform composite 26/100)

Live DB probes at ${ts} confirmed:
- \`ei_snapshot_versions\` = ${probeResults.ei_snapshot_versions} (EI snapshots never taken)
- \`lbi_scores\` = ${probeResults.lbi_scores} (LBI never scored)
- \`lbi_score_history\` = ${probeResults.lbi_score_history_exists ? 'table exists' : 'TABLE ABSENT'}
- \`wcl5_memory\` = ${probeResults.wcl5_memory} rows (CAPADEX memory: complete)
- \`wcl0_user_intelligence\` = ${probeResults.wcl0_user_intelligence} rows (store built, unconsumed by EI/LBI)
- \`career_recommendations\` user_id col = ${probeResults.career_recommendations_has_user_id ? 'present' : 'ABSENT'}
- \`career_memory_snapshots\` = ${probeResults.career_memory_snapshots === -1 ? 'TABLE ABSENT' : probeResults.career_memory_snapshots + ' rows (empty)'}

---

## The Central Finding

CAPADEX has built the infrastructure that all three products need.
**EI and LBI are not consuming it. CB is partially consuming it.**

| Infrastructure layer | Built for CAPADEX? | EI consumes? | LBI consumes? | CB consumes? |
|---|---|---|---|---|
| Snapshot + History (WC-L5) | ✅ 5/5 | ❌ 0 rows | ❌ no table | ❌ table absent |
| User Intelligence Store (WC-L0) | ✅ ${probeResults.wcl0_user_intelligence} rows | ❌ disconnected | ❌ disconnected | ⚠️ partial |
| Trend Engine (WC-L1) | ✅ real, flag OFF | ❌ no EI input | ❌ no LBI input | ⚠️ pure fn, no data |
| Recommendation Engine (WC-L5) | ✅ ${probeResults.capadex_intervention_recommendations} rows | ❌ not user-keyed | ❌ static text | ⚠️ bridge inactive |
| Memory Layer (WC-L5) | ✅ ${probeResults.wcl5_memory} rows | ❌ absent | ❌ absent | ⚠️ inactive |
| Post-Completion Hook | ✅ 22 items | ❌ no EI hook | ❌ no LBI hook | ⚠️ bridge stub |

**What this means**: A focused ~25 engineering-day effort to wire EI and LBI to CAPADEX's
existing foundation — and to fix CB's inactive bridges — would provide more value than
building three separate product stacks. The data is there. The engines are there.
The connections are missing.

---

## The Three Product-Specific Blockers (NOT shared capabilities)

The following gaps block each product independently and have no shared-platform solution:

1. **EI**: Formula divergence (GAP-1 CRITICAL) — 3 formulas in simultaneous use.
   No shared infrastructure fixes this. Requires a formula-reconciliation decision and code rewrite.

2. **LBI**: Framework not seeded (G1 CRITICAL) — 0 domain rows, 0 questions, 0 age bands.
   No shared infrastructure fixes this. Requires domain data authoring and a seeding sprint.

3. **CB**: Job supply + Mentor supply — 0 postings, 0 mentors.
   No engineering work fixes this. Requires market/BD execution.

---

## What Approval Is Needed For

Before any implementation begins, the following decisions require owner sign-off:

### Decision 1: Roadmap Phase Sequencing
Approve the four-phase roadmap (F1 → F2 → F3 → F4) as specified in Deliverable 4,
OR redirect phases or re-scope.

### Decision 2: EI Formula Reconciliation
F4.1 requires choosing ONE authoritative EI formula (recommend: 8-dimension documented model).
This is a **product definition decision** — the formula determines the product's core value claim.
Approve the formula choice before implementation begins.

### Decision 3: LBI Architecture
WC-P2 identified three disconnected LBI systems with no data bridge.
A consolidation decision is required before implementing S2 (history table) or S6 (user intelligence consumer).
**Recommended**: Option 2 (System A CAPADEX-derived feeds System B framework) per WC-P2 scorecard.

### Decision 4: Production Config Actions (owner, not engineering)
- Set \`SESSION_SECRET\` in deployment secrets
- Add \`FF_WC3_STAGE\`, \`FF_WC3_OUTCOME\`, \`FF_DECISION_PERSISTENCE\` to production env
- Rotate \`admin123\` default credential
- Confirm MFA admin mailbox

---

## Deliverables Produced

| # | Deliverable | File |
|---|---|---|
| 1 | Shared Foundation Gap Matrix | \`01_shared_foundation_gap_matrix.md\` |
| 2 | Product Dependency Map | \`02_product_dependency_map.md\` |
| 3 | Capability Reuse Analysis | \`03_capability_reuse_analysis.md\` |
| 4 | Implementation Roadmap | \`04_implementation_roadmap.md\` |
| 5 | Readiness Uplift Forecast | \`05_readiness_uplift_forecast.md\` |
| 6 | Priority Sequencing | \`06_priority_sequencing.md\` |
| 7 | STOP FOR APPROVAL (this file) | \`07_stop_for_approval.md\` |

---

**NO IMPLEMENTATION, SCHEMA CHANGES, DATA WRITES, OR DEPLOYMENT ACTIONS HAVE BEEN TAKEN.**
This audit is complete. All findings are grounded in published audit deliverables and live DB probes.
`;

  write('07_stop_for_approval.md', d7);

  // ─── README ───────────────────────────────────────────────────────────────
  const readme = `# P-X1 — Shared Product Foundation Audit & Implementation Plan
_Generated ${ts}. READ-ONLY · AUDIT ONLY · STOP FOR APPROVAL._

## The Question
Which shared platform capabilities are blocking EI, LBI, and Career Builder simultaneously?

## The Answer (3 lines)
1. CAPADEX has already built the snapshot, memory, trend, recommendation, and intelligence layers.
2. EI and LBI do not consume any of it. Career Builder partially does.
3. Wiring the three products to the shared foundation (~25 engineering days) is the fastest path to simultaneous uplift.

## Deliverables
| # | File | Contents |
|---|---|---|
| 1 | \`01_shared_foundation_gap_matrix.md\` | 10 capabilities × 3 products gap matrix with live DB evidence |
| 2 | \`02_product_dependency_map.md\` | Directed dependency graph per product + cross-product critical path |
| 3 | \`03_capability_reuse_analysis.md\` | Impact/effort ranking + reusable asset inventory |
| 4 | \`04_implementation_roadmap.md\` | 4-phase roadmap (F1–F4, ~25 eng days) |
| 5 | \`05_readiness_uplift_forecast.md\` | Per-product coverage/confidence before→after each phase |
| 6 | \`06_priority_sequencing.md\` | Ranked capability list with quick wins + 70% path |
| 7 | \`07_stop_for_approval.md\` | Executive summary + decisions required + STOP FOR APPROVAL |

## Baseline Scores (audit evidence)
| Product | Coverage | Confidence |
|---|---|---|
| EI (Employability Index) | 32% | 23% |
| LBI (Learning Behavior Index) | 25% | 0% |
| Career Builder | 37% | 17% |

## Post-F4 Forecast (engineering only, no data actions)
| Product | Coverage | Confidence |
|---|---|---|
| EI | ~${eiProgression[4][0]}% | ~${eiProgression[4][1]}% |
| LBI | ~${lbiProgression[4][0]}% | ~${lbiProgression[4][1]}% |
| Career Builder | ~${cbProgression[4][0]}% | ~${cbProgression[4][1]}% |

_70% requires product-specific data actions beyond engineering (occupation data, LBI framework seeding, job/mentor supply)._
`;

  write('00_README.md', readme);

  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log('  P-X1 AUDIT COMPLETE');
  console.log('  All deliverables written to backend/audit/px-1/');
  console.log('  NO IMPLEMENTATION · NO SCHEMA CHANGES · NO WRITES');
  console.log('  STOP FOR APPROVAL — See 07_stop_for_approval.md');
  console.log('─────────────────────────────────────────────────────────────────\n');

  console.log('Deliverables:');
  fs.readdirSync(OUT).sort().forEach(f => {
    const stat = fs.statSync(path.join(OUT, f));
    console.log(`  ${f.padEnd(50)} ${(stat.size/1024).toFixed(1)}kB`);
  });
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
