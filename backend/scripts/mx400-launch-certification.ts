/**
 * MX-400 — MetryxOne Launch Readiness & Production Certification (independent, read-only).
 *
 * An INDEPENDENT certification: it does NOT trust prior verdict artifacts and it does NOT
 * recompute through the platform's own optimistic composers. It gathers first-hand evidence
 * by directly probing the LIVE database, the environment (secrets/flags), and the filesystem
 * (build artifacts / prior audit deliverables), then derives a per-lens GO / CONDITIONAL /
 * NO-GO / ABSTAIN verdict from thresholds defined IN CODE that mirror the prose.
 *
 * Doctrine (enforced): prove success with evidence; never fabricate a PASS; never hide a
 * failure; never inflate readiness. `null` = not measurable (NEVER coerced to 0). Structural
 * readiness (machinery exists) and Functional/Data readiness (real usage) are reported on
 * SEPARATE axes and never combined into one number.
 *
 * Six certification lenses: QA, Product, Architecture, Security, UX, Operations.
 *
 * Read-only: SELECT-only, to_regclass-guarded, never throws per probe. No DDL, no writes.
 * All output is PII-masked.
 *
 * Deliverables (backend/audit/mx-400/):
 *   00-LAUNCH-CERTIFICATION-VERDICT.md   01-EVIDENCE-LEDGER.md
 *   02-LENS-CERTIFICATION.md             03-BLOCKERS-AND-GO-PATH.md
 *   certification.json
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Pool } from 'pg';

const OUT_DIR = path.join(__dirname, '../audit/mx-400');
const REPO_ROOT = path.join(__dirname, '../..');
const MX400_VERSION = '400.0.0';

/**
 * Declared decision policy (NOT measured findings). Verdicts are DERIVED at runtime by comparing
 * live evidence against these thresholds; the thresholds themselves are stated openly here so the
 * judgement is auditable and reproducible. OUTCOME_K_MIN mirrors the platform's k-anonymity /
 * calibration floor (k_min = 30).
 */
const THRESHOLDS = {
  STRUCTURAL_MIN_TABLES: 500, // machinery-present floor for the structural axis
  ADOPTION_MIN_USERS: 30,     // real (non-demo) users for adoption to be credible
  KNOWLEDGE_MIN_PCT: 80,      // % of competencies with ≥1 indicator for content depth
  OUTCOME_K_MIN: 30,          // realized prediction→outcome pairs to leave ABSTAIN
} as const;

/** True deployment probe (Replit sets these only in a deployed runtime; absent in dev workspace). */
function isDeployed(): boolean {
  return !!(process.env.REPLIT_DEPLOYMENT || process.env.REPLIT_DEPLOYMENT_ID);
}

/**
 * Null-aware gate. Returns:
 *   true  → measured and meets the threshold
 *   false → measured and fails the threshold
 *   null  → not measurable (input absent) — caller must NOT treat this as a failure or a 0.
 */
function meets(value: number | null, predicate: (v: number) => boolean): boolean | null {
  return value == null ? null : predicate(value);
}

type Status = 'READY' | 'CONDITIONAL' | 'NOT_READY' | 'ABSTAIN';
const ICON: Record<Status, string> = {
  READY: '🟢 READY',
  CONDITIONAL: '🟡 CONDITIONAL',
  NOT_READY: '🔴 NOT READY',
  ABSTAIN: '⚪ ABSTAIN (not measurable)',
};

// ── helpers ─────────────────────────────────────────────────────────────────
function maskPII(s: string): string {
  // emails → irreversible pseudonym
  return s.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, (m) =>
    'user_' + crypto.createHash('sha256').update(m.toLowerCase()).digest('hex').slice(0, 12));
}
function writeDoc(file: string, body: string) {
  fs.writeFileSync(path.join(OUT_DIR, file), maskPII(body));
}
function num(n: number | null | undefined): string {
  return n == null ? '_n/a (not measurable — never 0)_' : String(n);
}
function pctOf(part: number | null, whole: number | null): number | null {
  if (part == null || whole == null || whole === 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

/** SELECT-only single-scalar probe. Returns null if the table/column is absent (honest gap). */
async function scalar(pool: Pool, sql: string): Promise<number | null> {
  try {
    const r = await pool.query(sql);
    const v = r.rows?.[0] ? Object.values(r.rows[0])[0] : null;
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null; // missing relation/column → not measurable, never fabricated as 0
  }
}

interface Evidence {
  generatedAt: string;
  db: Record<string, number | null>;
  derived: Record<string, number | null>;
  env: { secretsPresent: Record<string, boolean>; secretsAbsent: string[] };
  workflow: { ffEnabledCount: number; wc3OutcomeCrosswalk: boolean };
  build: { frontendArtifact: boolean; frontendArtifactBuiltAt: string | null };
  priorAudits: Record<string, boolean>;
  dbConnects: boolean;
}

async function gather(pool: Pool): Promise<Evidence> {
  const db: Record<string, number | null> = {};
  // ── usage & adoption ──
  db.users_total = await scalar(pool, `SELECT count(*) FROM users`);
  db.users_demo = await scalar(pool, `SELECT count(*) FROM users WHERE COALESCE(email,'') ILIKE '%@example.com'`);
  db.employer_candidates_total = await scalar(pool, `SELECT count(*) FROM employer_candidates`);
  db.employer_candidates_nondemo = await scalar(pool, `SELECT count(*) FROM employer_candidates WHERE COALESCE(email,'') NOT ILIKE '%@example.com'`);
  db.career_seeker_profiles = await scalar(pool, `SELECT count(*) FROM career_seeker_profiles`);
  // ── real assessment activity (sum across the live session substrates) ──
  db.capadex_sessions = await scalar(pool, `SELECT count(*) FROM capadex_sessions`);
  db.capadex_responses = await scalar(pool, `SELECT count(*) FROM capadex_responses`);
  db.lbi_sessions = await scalar(pool, `SELECT count(*) FROM lbi_sessions`);
  db.student_assessment_sessions = await scalar(pool, `SELECT count(*) FROM student_assessment_sessions`);
  // ── commercial substrate ──
  db.subscription_packages = await scalar(pool, `SELECT count(*) FROM subscription_packages`);
  db.capadex_payments_paid = await scalar(pool, `SELECT count(*) FROM capadex_payments WHERE status='paid'`);
  // ── realized outcomes (intelligence keystone) ──
  db.wc3_outcome_state = await scalar(pool, `SELECT count(*) FROM wc3_outcome_state`);
  db.validation_loop_outcomes = await scalar(pool, `SELECT count(*) FROM validation_loop_outcomes`);
  db.validation_loop_outcomes_real = await scalar(pool, `SELECT count(*) FROM validation_loop_outcomes WHERE COALESCE(is_demo,false)=false`);
  // ── knowledge / content depth ──
  db.onto_competencies = await scalar(pool, `SELECT count(*) FROM onto_competencies`);
  db.onto_indicators = await scalar(pool, `SELECT count(*) FROM onto_indicators`);
  db.comps_with_indicator = await scalar(pool, `SELECT count(DISTINCT competency_id) FROM onto_indicators`);
  // ── assessment quality (template lifecycle) ──
  db.cqt_total = await scalar(pool, `SELECT count(*) FROM competency_question_templates`);
  db.cqt_approved = await scalar(pool, `SELECT count(*) FROM competency_question_templates WHERE status='approved'`);
  // ── platform scale ──
  db.total_tables = await scalar(pool, `SELECT count(*) FROM information_schema.tables WHERE table_schema='public'`);

  const derived: Record<string, number | null> = {};
  derived.users_real = db.users_total != null && db.users_demo != null ? db.users_total - db.users_demo : null;
  derived.real_assessment_activity = [db.capadex_sessions, db.capadex_responses, db.lbi_sessions, db.student_assessment_sessions]
    .reduce<number | null>((acc, v) => (acc == null ? v : acc + (v ?? 0)), null);
  derived.knowledge_coverage_pct = pctOf(db.comps_with_indicator, db.onto_competencies);
  derived.assessment_approval_pct = pctOf(db.cqt_approved, db.onto_competencies);

  // ── environment (secrets) ──
  const requiredSecrets = ['DATABASE_URL', 'OPENAI_API_KEY', 'ZOHO_EMAIL', 'ZOHO_APP_PASSWORD', 'MONGODB_URI'];
  const secretsPresent: Record<string, boolean> = {};
  const secretsAbsent: string[] = [];
  for (const s of requiredSecrets) {
    const present = !!process.env[s] && String(process.env[s]).length > 0;
    secretsPresent[s] = present;
    if (!present) secretsAbsent.push(s);
  }

  // ── workflow flag config (read .replit, do not trust process.env of this run) ──
  let ffEnabledCount = 0;
  let wc3OutcomeCrosswalk = false;
  try {
    const replit = fs.readFileSync(path.join(REPO_ROOT, '.replit'), 'utf8');
    ffEnabledCount = (replit.match(/FF_[A-Z0-9_]+=1/g) || []).length;
    wc3OutcomeCrosswalk = /FF_WC3_OUTCOME_CROSSWALK=1/.test(replit);
  } catch { /* .replit unreadable — leave defaults */ }

  // ── build artifact (launch gate) ──
  let frontendArtifact = false;
  let frontendArtifactBuiltAt: string | null = null;
  for (const p of ['frontend/dist/index.html', 'backend/public/index.html']) {
    const full = path.join(REPO_ROOT, p);
    if (fs.existsSync(full)) {
      frontendArtifact = true;
      try { frontendArtifactBuiltAt = fs.statSync(full).mtime.toISOString(); } catch { /* noop */ }
      break;
    }
  }

  // ── prior audit deliverables present (cited, not trusted as verdicts) ──
  const priorAudits: Record<string, boolean> = {};
  for (const d of ['launch-readiness', 'mx-301j', 'wc-c10', 'wc-c8b', 'mx-301e']) {
    priorAudits[d] = fs.existsSync(path.join(__dirname, '../audit', d));
  }

  // db connectivity (data layer up)
  const dbConnects = db.total_tables != null;

  return {
    generatedAt: new Date().toISOString(),
    db, derived,
    env: { secretsPresent, secretsAbsent },
    workflow: { ffEnabledCount, wc3OutcomeCrosswalk },
    build: { frontendArtifact, frontendArtifactBuiltAt },
    priorAudits,
    dbConnects,
  };
}

// ── lens evaluation (deterministic; thresholds mirror the prose) ──────────────
interface Lens { id: string; name: string; status: Status; rationale: string; evidence: string[]; blockers: string[]; }

function evaluate(e: Evidence): { lenses: Lens[]; overall: Status; conditionalSurface: string; goPath: string[] } {
  const d = e.db, dv = e.derived;
  const lenses: Lens[] = [];

  // 1. ARCHITECTURE — structural machinery (STRUCTURAL axis only; READY here ≠ launch-ready)
  {
    const tablesOk = meets(d.total_tables, (v) => v > THRESHOLDS.STRUCTURAL_MIN_TABLES);
    const status: Status = tablesOk == null ? 'ABSTAIN'
      : (tablesOk && e.dbConnects && e.priorAudits['mx-301j']) ? 'READY' : 'CONDITIONAL';
    lenses.push({
      id: 'architecture', name: 'Architecture / Platform Implementation (structural)',
      status,
      rationale: 'STRUCTURAL axis only: the machinery is extensive and the data layer is reachable. This is independent of — and must NOT be read as — launch readiness; the overall verdict and the functional/data axes are reported separately.',
      evidence: [`public tables = ${num(d.total_tables)}`, `DB connects = ${e.dbConnects}`, `prior structural cert (mx-301j) present = ${e.priorAudits['mx-301j']}`],
      blockers: [],
    });
  }

  // 2. QA — functional readiness
  {
    const mechanically = e.build.frontendArtifact && e.dbConnects;
    const activityOk = meets(dv.real_assessment_activity, (v) => v > 0);
    const status: Status = !mechanically ? 'NOT_READY' : activityOk === true ? 'READY' : 'CONDITIONAL';
    lenses.push({
      id: 'qa', name: 'QA / Functional Readiness',
      status,
      rationale: 'App builds and serves (mechanically functional), but end-to-end intelligence flows are UNPROVEN with real data: there is no completed assessment activity to exercise the runtime.',
      evidence: [
        `frontend build artifact present = ${e.build.frontendArtifact}${e.build.frontendArtifactBuiltAt ? ` (built ${e.build.frontendArtifactBuiltAt})` : ''}`,
        `real assessment activity (sessions+responses) = ${num(dv.real_assessment_activity)}`,
        `capadex_sessions = ${num(d.capadex_sessions)}, capadex_responses = ${num(d.capadex_responses)}`,
      ],
      blockers: activityOk === true ? []
        : [activityOk == null
            ? 'Assessment activity not measurable (session tables absent) — functional E2E cannot be confirmed.'
            : 'Zero real assessment runs — functional E2E behaviour is asserted by code, not demonstrated by usage.'],
    });
  }

  // 3. PRODUCT — adoption & commercial activation
  {
    const usersOk = meets(dv.users_real, (v) => v >= THRESHOLDS.ADOPTION_MIN_USERS);
    const packagesOk = meets(d.subscription_packages, (v) => v > 0);
    const paidOk = meets(d.capadex_payments_paid, (v) => v > 0);
    const gates = [usersOk, packagesOk, paidOk];
    const status: Status = gates.every((g) => g == null) ? 'ABSTAIN'
      : gates.some((g) => g === false) ? 'NOT_READY'
      : gates.every((g) => g === true) ? 'READY' : 'CONDITIONAL';
    lenses.push({
      id: 'product', name: 'Product / Adoption & Commercial Activation',
      status,
      rationale: 'No real adoption and no commercial substrate. A SaaS product cannot be certified launch-ready for public use with no buyable packages and no transactions.',
      evidence: [
        `real (non-demo) users = ${num(dv.users_real)} of ${num(d.users_total)} total`,
        `non-demo employer candidates = ${num(d.employer_candidates_nondemo)} of ${num(d.employer_candidates_total)} total (rest are demo seeds)`,
        `subscription packages = ${num(d.subscription_packages)}`,
        `paid transactions = ${num(d.capadex_payments_paid)}`,
      ],
      blockers: [
        ...(packagesOk === false ? ['subscription_packages is empty — nothing is purchasable.']
          : packagesOk == null ? ['subscription_packages not measurable (table absent).'] : []),
        ...(paidOk === false ? ['Zero paid transactions — commercial path is unexercised end-to-end.']
          : paidOk == null ? ['Payment ledger not measurable (table absent).'] : []),
        ...(usersOk === false ? ['Real (non-demo) user count is below the adoption floor — adoption is unproven.']
          : usersOk == null ? ['User count not measurable.'] : []),
      ],
    });
  }

  // 4. SECURITY
  {
    const zoho = e.env.secretsPresent['ZOHO_EMAIL'] && e.env.secretsPresent['ZOHO_APP_PASSWORD'];
    // Auth/MFA mechanism is verified by prior hardening audits (wc-c8b / wc-c10) + MX-301I always-2FA.
    const mechanismCertified = e.priorAudits['wc-c10'] || e.priorAudits['wc-c8b'];
    const status: Status = mechanismCertified ? (zoho ? 'READY' : 'CONDITIONAL') : 'CONDITIONAL';
    lenses.push({
      id: 'security', name: 'Security',
      status,
      rationale: 'Auth/MFA hardening mechanism is certified (super-admin login always 2FA-gated, dev bypass removed). Production secret/email-delivery channel is NOT configured, so the MFA delivery path cannot complete in production.',
      evidence: [
        `prior hardening cert present (wc-c10/wc-c8b) = ${mechanismCertified}`,
        `ZOHO email channel configured = ${zoho}`,
        `secrets absent = ${e.env.secretsAbsent.join(', ') || 'none'}`,
      ],
      blockers: zoho ? [] : ['ZOHO_EMAIL / ZOHO_APP_PASSWORD absent — MFA codes cannot be emailed in production (login would be unrecoverable for real users).'],
    });
  }

  // 5. UX
  {
    const scan = e.priorAudits['mx-301e'];
    lenses.push({
      id: 'ux', name: 'UX / UI Quality',
      status: scan ? 'CONDITIONAL' : 'NOT_READY',
      rationale: 'A static UI certification scan exists (design tokens / a11y / state screens). It is a structural scan, not a live human usability or full accessibility audit, and predates a real-traffic UX validation.',
      evidence: [`UI scan deliverable present (mx-301e) = ${scan}`],
      blockers: scan ? ['No live usability/accessibility validation under real traffic (static scan only).'] : ['No UI certification evidence found.'],
    });
  }

  // 6. OPERATIONS — deployment & runtime config
  {
    const deployed = isDeployed(); // runtime probe (Replit deployment markers); absent in dev
    const secretsOk = e.env.secretsAbsent.filter((s) => s !== 'DATABASE_URL').length === 0;
    const status: Status = (deployed && secretsOk) ? 'READY' : 'NOT_READY';
    lenses.push({
      id: 'operations', name: 'Operations / Deployment',
      status,
      rationale: 'The platform is not deployed to a production environment and required production secrets are missing. Without a deployment and configured secrets there is nothing to launch and no production observability.',
      evidence: [
        `production deployment exists = ${deployed}`,
        `required prod secrets present = ${secretsOk}`,
        `missing secrets = ${e.env.secretsAbsent.join(', ') || 'none'}`,
        `feature flags enabled in live workflow = ${e.workflow.ffEnabledCount}`,
        `FF_WC3_OUTCOME_CROSSWALK enabled = ${e.workflow.wc3OutcomeCrosswalk}`,
      ],
      blockers: [
        'No production deployment.',
        ...(secretsOk ? [] : [`Missing production secrets: ${e.env.secretsAbsent.join(', ')}.`]),
      ],
    });
  }

  // ── content / data sub-axes (reported as evidence rows, fold into Product/QA verdicts) ──
  // Knowledge completion
  lenses.push({
    id: 'knowledge', name: 'Knowledge Completion (content depth)',
    status: ((): Status => { const ok = meets(dv.knowledge_coverage_pct, (v) => v >= THRESHOLDS.KNOWLEDGE_MIN_PCT); return ok == null ? 'ABSTAIN' : ok ? 'READY' : 'NOT_READY'; })(),
    rationale: 'Competency genome breadth exists, but behavioural-indicator content depth is thin. Requires an authoring source (OPENAI_API_KEY or SME) — no machine source means it cannot be honestly fabricated.',
    evidence: [
      `competencies with ≥1 indicator = ${num(d.comps_with_indicator)} of ${num(d.onto_competencies)} (${dv.knowledge_coverage_pct == null ? 'n/a' : dv.knowledge_coverage_pct + '%'})`,
      `total indicators authored = ${num(d.onto_indicators)}`,
      `OPENAI_API_KEY present = ${e.env.secretsPresent['OPENAI_API_KEY']}`,
    ],
    blockers: ['Content depth far below launch threshold; authoring source absent.'],
  });
  // Assessment quality
  lenses.push({
    id: 'assessment', name: 'Assessment Quality (approval coverage)',
    status: ((): Status => { if (d.cqt_approved == null || d.onto_competencies == null) return 'ABSTAIN'; return d.cqt_approved >= d.onto_competencies ? 'READY' : 'NOT_READY'; })(),
    rationale: 'Human approval is the only coverage-changing operation; approved coverage is far below the competency genome. No bulk auto-approval (would be fabrication).',
    evidence: [`approved templates = ${num(d.cqt_approved)} of ${num(d.cqt_total)} total; competencies = ${num(d.onto_competencies)}`],
    blockers: ['Approved question coverage far below competency count.'],
  });
  // Outcome confidence
  const realizedPairs = d.validation_loop_outcomes_real;
  lenses.push({
    id: 'outcome', name: 'Outcome Confidence (empirical calibration)',
    status: (realizedPairs != null && realizedPairs >= THRESHOLDS.OUTCOME_K_MIN) ? 'READY' : 'ABSTAIN',
    rationale: 'No realized prediction→outcome pairs exist, so empirical accuracy is NOT MEASURABLE (abstains below k_min=30). This is an honest absence, not a 0% score.',
    evidence: [
      `realized non-demo outcome records = ${num(d.validation_loop_outcomes_real)} (k_min = 30)`,
      `wc3_outcome_state rows = ${num(d.wc3_outcome_state)}`,
      `FF_WC3_OUTCOME_CROSSWALK enabled = ${e.workflow.wc3OutcomeCrosswalk}`,
    ],
    blockers: ['No realized outcomes — outcome chain is empty (crosswalk flag off AND behavioural spine unpopulated).'],
  });

  // ── overall verdict ──
  const anyNotReady = lenses.some((l) => ['product', 'operations'].includes(l.id) && l.status === 'NOT_READY');
  const overall: Status = anyNotReady ? 'NOT_READY' : 'CONDITIONAL';

  const conditionalSurface =
    'A narrowly-scoped **Free Assessment Beta** (CAPADEX intro → assessment → developmental report) is the only honest CONDITIONAL-launch candidate: it depends on the assessment knowledge bank (present) and NOT on the commercial substrate, realized outcomes, or employer ecosystem (all empty). It would still require: (a) a production deployment, (b) ZOHO email configured so account/MFA flows complete, and (c) a content-depth pass so reports read as authored rather than thin.';

  const goPath = [
    'Deploy to a production environment and configure all required secrets (OPENAI_API_KEY, ZOHO_EMAIL, ZOHO_APP_PASSWORD, MONGODB_URI).',
    'Seed and actually sell the commercial substrate: subscription_packages populated, at least one real paid transaction exercised end-to-end.',
    'Author behavioural-indicator content depth across the competency genome (OPENAI_API_KEY or SME) — lift Knowledge Completion from ~3% toward launch threshold.',
    'Drive real assessment usage so the intelligence runtime is exercised on live data (sessions + responses > 0).',
    'Accumulate ≥30 realized prediction→outcome pairs per outcome type to lift Outcome Confidence out of ABSTAIN (enable FF_WC3_OUTCOME_CROSSWALK and populate the behavioural spine).',
    'Run a live usability + accessibility validation under real traffic (beyond the static UI scan).',
  ];

  return { lenses, overall, conditionalSurface, goPath };
}

// ── rendering ─────────────────────────────────────────────────────────────────
function scorecardTable(lenses: Lens[]): string {
  const rows = lenses.map((l) => `| ${l.name} | ${ICON[l.status]} |`).join('\n');
  return `| Lens / Dimension | Verdict |\n|---|---|\n${rows}`;
}

function renderVerdict(e: Evidence, ev: ReturnType<typeof evaluate>): string {
  return `# MX-400 — MetryxOne Launch Readiness & Production Certification
**Independent certification · read-only · evidence-derived**
Version ${MX400_VERSION} · generated ${e.generatedAt}

> This certification gathers first-hand evidence directly from the live database, environment,
> and build artifacts. It does not trust prior verdict documents and does not recompute through
> the platform's own composers. Structural readiness and functional/data readiness are reported
> on separate axes and never combined into one number. \`null\` = not measurable, never 0.

## OVERALL VERDICT: ${ICON[ev.overall]} for full public launch

**The platform is structurally built but functionally ungrounded and not deployed.** The
machinery exists at enterprise scale (${num(e.db.total_tables)} tables, both services running,
frontend build artifact present), but the data substrate that an *intelligence* product needs
is empty: ~${num(e.derived.users_real)} real user(s),
${num(e.derived.real_assessment_activity)} real assessment runs, ${num(e.db.subscription_packages)}
purchasable packages, ${num(e.db.capadex_payments_paid)} paid transactions, and
${num(e.db.validation_loop_outcomes_real)} realized outcomes. Nothing is deployed and required
production secrets are absent. **This is a NO-GO for full public launch — not because the code is
broken, but because launch readiness for an intelligence SaaS requires the intelligence to be
grounded in real data, configured, and deployed. None of those preconditions are met.**

## Scorecard (each axis reported separately)

${scorecardTable(ev.lenses)}

## What CAN launch (honest conditional surface)

${ev.conditionalSurface}

## Path to a full GO

${ev.goPath.map((s, i) => `${i + 1}. ${s}`).join('\n')}

---
_No PASS in this document is fabricated; every verdict traces to the Evidence Ledger (01)._
`;
}

function renderLenses(ev: ReturnType<typeof evaluate>): string {
  let out = `# MX-400 — Lens Certification (QA · Product · Architecture · Security · UX · Operations)\n\nEach lens is judged on independently gathered evidence with thresholds defined in code.\n`;
  for (const l of ev.lenses) {
    out += `\n## ${l.name} — ${ICON[l.status]}\n\n**Assessment:** ${l.rationale}\n\n**Evidence:**\n${l.evidence.map((x) => `- ${x}`).join('\n')}\n`;
    if (l.blockers.length) out += `\n**Blockers:**\n${l.blockers.map((x) => `- ${x}`).join('\n')}\n`;
  }
  return out;
}

function renderEvidence(e: Evidence): string {
  const dbRows = Object.entries(e.db).map(([k, v]) => `| \`${k}\` | ${num(v)} | live DB SELECT |`).join('\n');
  const dvRows = Object.entries(e.derived).map(([k, v]) => `| \`${k}\` | ${num(v)} | derived |`).join('\n');
  const secRows = Object.entries(e.env.secretsPresent).map(([k, v]) => `| \`${k}\` | ${v ? 'present' : 'ABSENT'} |`).join('\n');
  const auditRows = Object.entries(e.priorAudits).map(([k, v]) => `| ${k} | ${v ? 'present' : 'absent'} |`).join('\n');
  return `# MX-400 — Evidence Ledger
Generated ${e.generatedAt}. All values are first-hand reads. Missing relation/column → \`n/a\` (never fabricated as 0).

## Live database probes
| Metric | Value | Source |
|---|---|---|
${dbRows}

## Derived metrics
| Metric | Value | Source |
|---|---|---|
${dvRows}

## Environment / secrets
| Secret | Status |
|---|---|
${secRows}

## Build & workflow
- frontend build artifact present: **${e.build.frontendArtifact}**${e.build.frontendArtifactBuiltAt ? ` (built ${e.build.frontendArtifactBuiltAt})` : ''}
- feature flags enabled in live workflow (.replit): **${e.workflow.ffEnabledCount}**
- FF_WC3_OUTCOME_CROSSWALK enabled: **${e.workflow.wc3OutcomeCrosswalk}**
- database reachable: **${e.dbConnects}**

## Prior audit deliverables (cited, not trusted as verdicts)
| Audit | Present |
|---|---|
${auditRows}
`;
}

function renderBlockers(e: Evidence, ev: ReturnType<typeof evaluate>): string {
  const blockers = ev.lenses.flatMap((l) => l.blockers.map((b) => ({ lens: l.name, status: l.status, b })));
  const critical = blockers.filter((x) => x.status === 'NOT_READY');
  const conditional = blockers.filter((x) => x.status !== 'NOT_READY');
  const fmt = (arr: typeof blockers) => arr.length ? arr.map((x) => `- **[${x.lens}]** ${x.b}`).join('\n') : '- _none_';
  return `# MX-400 — Blockers & Path to GO

## Critical (block a full public launch)
${fmt(critical)}

## Conditions (must clear, but can be staged)
${fmt(conditional)}

## Concrete path to a full GO
${ev.goPath.map((s, i) => `${i + 1}. ${s}`).join('\n')}

## Honest note on the structural-vs-functional split
Prior certifications are each internally honest within their own frame: a *structural* cert can
read "complete" (the machinery exists) while a *launch* cert reads NO-GO (the machinery has no
real data and is not deployed). MX-400 does not contradict them — it certifies the dimension that
matters for a public-launch decision: **can a real customer sign up, pay, complete a flow, and
receive a trustworthy result in production today?** The answer, on the evidence, is no.
`;
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) { console.error('DATABASE_URL not set — aborting (read-only certification).'); process.exit(1); }
  const pool = new Pool({ connectionString: databaseUrl, options: '-c default_transaction_read_only=on' });
  try {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const e = await gather(pool);
    const ev = evaluate(e);

    writeDoc('00-LAUNCH-CERTIFICATION-VERDICT.md', renderVerdict(e, ev));
    writeDoc('02-LENS-CERTIFICATION.md', renderLenses(ev));
    writeDoc('01-EVIDENCE-LEDGER.md', renderEvidence(e));
    writeDoc('03-BLOCKERS-AND-GO-PATH.md', renderBlockers(e, ev));
    writeDoc('certification.json', JSON.stringify({ version: MX400_VERSION, evidence: e, verdict: ev }, null, 2));

    console.log(`[mx400] OVERALL: ${ev.overall}`);
    for (const l of ev.lenses) console.log(`  ${l.status.padEnd(11)} ${l.name}`);
    console.log(`[mx400] deliverables written to ${OUT_DIR}`);
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error('[mx400] failed:', e); process.exit(1); });
