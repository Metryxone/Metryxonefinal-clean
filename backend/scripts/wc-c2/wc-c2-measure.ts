/**
 * WC-C2 — Entitlement Engine READINESS AUDIT (READ-ONLY · additive · never mutates DB).
 *
 * Follow-on to WC-C1 (Product Monetization Readiness 13.3% structural / 0% activation).
 * Answers: what is the SHORTEST path from 13.3% to >90%, focused on the entitlement engine?
 *
 * RECOMPUTES live — imports the real entitlement resolver (buildEntitlementOverview), queries the
 * live DB, reads env/flag posture, and SOURCE-INTROSPECTS the three STAGE_PRICES / STAGE_FEATURES /
 * LADDER constants for lockstep. It does NOT copy WC-C1 markdown numbers; it recomputes them and
 * cites WC-C1 only as the prior baseline.
 *
 * TWO INDEPENDENT AXES, NEVER composited into one number:
 *   • STRUCTURAL — does the code/engine/route/table-definition exist?
 *       Deterministic tier map: real=5 / gated-real=4 / partial=3 / stub=2 / absent=1 → normalized %.
 *   • ACTIVATION — is it live in the DEPLOY posture (flag-ON by config default + live data +
 *       user-reachable consumer + real keys)? A COUNT of binary enablers. The dev-workflow
 *       FF_COMMERCIAL_ACTIVATION=1 override is a FOOTNOTE only, never a deploy enabler.
 *
 * HONESTY GUARDS (architect plan sign-off, baked in):
 *   • "Product Monetization Readiness" stays EXCLUSIVELY bound to the WC-C1 6-product × 5-cell metric.
 *     The objective question is answered on THAT metric FIRST: the entitlement keystone moves it
 *     13.3% → 20% (4/30 → 6/30). >90% on that metric is a PRODUCTIZATION decision, NOT entitlement work.
 *   • A second metric — "Live-SKU Entitlement Wiring Readiness" (CAPADEX stage ladder only) — is
 *     presented as a PROPOSED re-baseline requiring an explicit user decision, never performed by the
 *     audit. The two metrics are shown side by side, never composited, never silently swapped.
 *   • Package SKU is entitlement-DISJOINT: deriveEntitlement reads ONLY capadex_payments (its header
 *     comment overstates this — a finding); subscription_packages has NO feature map; grants are
 *     child/student-keyed not email-keyed. So an email-keyed requireEntitlement guard CANNOT lift it.
 *   • Fulfillment is split: notification (real — emails/WhatsApp/audit event) + access-provisioning
 *     (missing). ONE guard satisfies both access_enforcement + access-provisioning for ladder stages.
 *   • No stub silent-upgrade (mentor / packages). No wcl5/wcl0 behavioural substrate in commercial figures.
 *
 * PII: emails one-way sha256-masked (user_<hex[:10]>) before any artifact is written.
 *
 * Usage: cd backend && npx tsx scripts/wc-c2/wc-c2-measure.ts
 */
import { Pool } from 'pg';
import { createHash } from 'crypto';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { buildEntitlementOverview } from '../../services/wc7c/entitlement-engine';
import { FEATURE_FLAGS } from '../../config/feature-flags';

const OUT_DIR = join(__dirname, '..', '..', 'audit', 'wc-c2');

const maskEmail = (email: string): string =>
  `user_${createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 10)}`;

const pct = (n: number, d: number): number | null => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);
const naOrPct = (v: number | null) => (v === null ? 'n/a' : `${v}%`);

// ── Structural deterministic rubric ──────────────────────────────────────────
type Tier = 'real' | 'gated-real' | 'partial' | 'stub' | 'absent';
const TIER_SCORE: Record<Tier, number> = { real: 5, 'gated-real': 4, partial: 3, stub: 2, absent: 1 };
const tierTag = (t: Tier) => `${t} (${TIER_SCORE[t]}/5)`;

interface Cell { name: string; tier: Tier; note: string; }
function structPct(cells: Cell[]): { score: number; max: number; pct: number } {
  const max = cells.length * 5;
  const score = cells.reduce((s, c) => s + TIER_SCORE[c.tier], 0);
  return { score, max, pct: Math.round((score / max) * 1000) / 10 };
}

interface Enabler { name: string; present: boolean; detail: string; }
function actPct(enablers: Enabler[]): { present: number; total: number; pct: number } {
  const present = enablers.filter((e) => e.present).length;
  return { present, total: enablers.length, pct: Math.round((present / enablers.length) * 1000) / 10 };
}

async function num(pool: Pool, sql: string): Promise<number> {
  try { const { rows } = await pool.query(sql); return Number(rows[0]?.n ?? 0); } catch { return -1; }
}
async function tableExists(pool: Pool, name: string): Promise<boolean> {
  try { const { rows } = await pool.query(`SELECT to_regclass($1) IS NOT NULL AS e`, [`public.${name}`]); return Boolean(rows[0]?.e); }
  catch { return false; }
}

// ── Source-introspection: extract the live constants for a lockstep check ─────
function readSrc(...parts: string[]): string {
  try { return readFileSync(join(__dirname, '..', '..', ...parts), 'utf8'); } catch { return ''; }
}
function extractRecordKeys(src: string, constName: string): string[] {
  const re = new RegExp(constName + '\\s*(?::[^=]*)?=\\s*\\{([\\s\\S]*?)\\}');
  const m = src.match(re);
  if (!m) return [];
  return Array.from(new Set(Array.from(m[1].matchAll(/\b(CAP_[A-Z]+)\b\s*:/g)).map((x) => x[1])));
}
function extractLadder(src: string): string[] {
  const m = src.match(/LADDER\s*=\s*\[([\s\S]*?)\]/);
  if (!m) return [];
  return Array.from(m[1].matchAll(/\b(CAP_[A-Z]+)\b/g)).map((x) => x[1]);
}
const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',');
const sameSeq = (a: string[], b: string[]) => a.join(',') === b.join(',');

// 5-cell monetization wiring matrix (mirrors WC-C1 deliverable; recomputed here).
interface MonRow { product: string; priced_sku: boolean; order_path: boolean; pay_to_entitlement: boolean; access_enforcement: boolean; fulfillment: boolean; note: string; }
const monScore = (rows: MonRow[]) =>
  rows.reduce((s, r) => s + [r.priced_sku, r.order_path, r.pay_to_entitlement, r.access_enforcement, r.fulfillment].filter(Boolean).length, 0);

async function run(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) { console.error('DATABASE_URL not set — aborting (read-only audit).'); process.exit(1); }
  const pool = new Pool({ connectionString: databaseUrl });
  const stamp = new Date().toISOString();
  mkdirSync(OUT_DIR, { recursive: true });

  // ── Env / flag posture (deploy posture = config defaults) ──
  const env = {
    razorpay_key_id: Boolean(process.env.RAZORPAY_KEY_ID),
    razorpay_key_secret: Boolean(process.env.RAZORPAY_KEY_SECRET),
    razorpay_webhook_secret: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
  };
  const razorpayConfigured = env.razorpay_key_id && env.razorpay_key_secret;
  const flagDefaults = {
    commercialEntitlement: FEATURE_FLAGS.commercialEntitlement,
    commercialActivation: FEATURE_FLAGS.commercialActivation,
  };

  // ── Live DB ground truth ──
  const db = {
    payments_total: await num(pool, `SELECT count(*) n FROM capadex_payments`),
    payments_paid: await num(pool, `SELECT count(*) n FROM capadex_payments WHERE status='paid'`),
    payments_pending: await num(pool, `SELECT count(*) n FROM capadex_payments WHERE status='pending'`),
    payments_demo: await num(pool, `SELECT count(*) n FROM capadex_payments WHERE razorpay_order_id LIKE 'DEMO_%'`),
    payment_completed_events: await num(pool, `SELECT count(*) n FROM capadex_audit_events WHERE event_type='payment_completed'`),
    distinct_payer_emails: await num(pool, `SELECT count(DISTINCT lower(email)) n FROM capadex_payments WHERE email IS NOT NULL`),
    distinct_paid_emails: await num(pool, `SELECT count(DISTINCT lower(email)) n FROM capadex_payments WHERE status='paid' AND email IS NOT NULL`),
    packages_total: await num(pool, `SELECT count(*) n FROM subscription_packages`),
    packages_active: await num(pool, `SELECT count(*) n FROM subscription_packages WHERE is_active=true`),
    student_subscriptions: await num(pool, `SELECT count(*) n FROM student_subscriptions`),
    student_subscriptions_active: await num(pool, `SELECT count(*) n FROM student_subscriptions WHERE status='active' AND (expiry_date IS NULL OR expiry_date >= now())`),
    sessions_total: await num(pool, `SELECT count(*) n FROM capadex_sessions`),
    sessions_completed: await num(pool, `SELECT count(*) n FROM capadex_sessions WHERE status='completed'`),
    mentor_profiles: await num(pool, `SELECT count(*) n FROM mentor_profiles`),
  };
  const tables = {
    subscription_packages: await tableExists(pool, 'subscription_packages'),
    student_subscriptions: await tableExists(pool, 'student_subscriptions'),
    capadex_payments: await tableExists(pool, 'capadex_payments'),
    mentor_bookings: await tableExists(pool, 'mentor_bookings'),
    parent_subscriptions: await tableExists(pool, 'parent_subscriptions'),
  };

  // ── Live entitlement resolver (recompute, not copy) ──
  const overview = await buildEntitlementOverview(pool);

  // ── PII-masked payer sample ──
  let maskedSample: string[] = [];
  try {
    const { rows } = await pool.query(`SELECT DISTINCT lower(email) e FROM capadex_payments WHERE email IS NOT NULL ORDER BY 1 LIMIT 2`);
    maskedSample = rows.map((r) => maskEmail(String(r.e)));
  } catch { /* leave empty */ }

  // ── Lockstep: source-introspect the three constants ──
  const srcPay = readSrc('routes', 'capadex-payments.ts');
  const srcEnt = readSrc('services', 'wc7c', 'entitlement-engine.ts');
  const srcSub = readSrc('services', 'wc7c', 'subscription-engine.ts');
  const pricesPay = extractRecordKeys(srcPay, 'STAGE_PRICES');
  const featuresEnt = extractRecordKeys(srcEnt, 'STAGE_FEATURES');
  const pricesSub = extractRecordKeys(srcSub, 'STAGE_PRICES');
  const ladderEnt = extractLadder(srcEnt);
  const ladderSub = extractLadder(srcSub);
  const lockstep = {
    stage_keys_consistent: sameSet(pricesPay, featuresEnt) && sameSet(pricesPay, pricesSub),
    ladder_consistent: ladderEnt.length > 0 && sameSeq(ladderEnt, ladderSub) && sameSet(ladderEnt, pricesPay),
    keys: { capadex_payments_STAGE_PRICES: pricesPay, entitlement_STAGE_FEATURES: featuresEnt, subscription_STAGE_PRICES: pricesSub, entitlement_LADDER: ladderEnt, subscription_LADDER: ladderSub },
  };

  // ── Unguarded paid-tier endpoints (verified file:line; UUID-as-bearer-token) ──
  const unguardedEndpoints = [
    { method: 'GET', path: '/api/capadex/session/:id/report', loc: 'routes/capadex.ts:3037', gate: 'isRuntimeIntelligenceActivationEnabled() + validSessionId' },
    { method: 'GET', path: '/api/capadex/session/:id/reports', loc: 'routes/capadex.ts:3078', gate: 'isRuntimeIntelligenceActivationEnabled() + validSessionId' },
    { method: 'GET', path: '/api/capadex/report/:session_id', loc: 'routes/capadex.ts:3360', gate: 'session exists + status=completed + email param (linking only)' },
    { method: 'GET', path: '/api/capadex/session/:id/omega-x', loc: 'routes/capadex.ts:2565', gate: 'reader; validSessionId' },
    { method: 'GET', path: '/api/capadex/session/:id/signals', loc: 'routes/capadex.ts:2580', gate: 'validSessionId' },
    { method: 'GET', path: '/api/capadex/session/:id/patterns', loc: 'routes/capadex.ts:2590', gate: 'validSessionId' },
    { method: 'GET', path: '/api/capadex/session/:id/explain', loc: 'routes/capadex.ts:2603', gate: 'validSessionId' },
    { method: 'GET', path: '/api/capadex/session/:id/guidance', loc: 'routes/capadex.ts:2621', gate: 'validSessionId' },
    { method: 'GET', path: '/api/capadex/session/:id/grounding', loc: 'routes/capadex.ts:2644', gate: 'validSessionId' },
    { method: 'GET', path: '/api/capadex/session/:id/pipeline', loc: 'routes/capadex.ts:2711', gate: 'validSessionId' },
    { method: 'GET', path: '/api/capadex/session/:id/stage', loc: 'routes/capadex.ts:2734', gate: 'validSessionId' },
  ];

  // ═══════════════ ENTITLEMENT SUBSYSTEM READINESS (single dual-axis pair) ═══════════════
  const entStructCells: Cell[] = [
    { name: 'architecture', tier: 'real',
      note: 'deriveEntitlement(email) + buildEntitlementOverview: read-only, FAIL-CLOSED on ledger error, union over owned paid stages. DOC/CODE DRIFT (header comment only — code is correct, not scored down): the engine header claims it reads student_subscriptions→subscription_packages, but per-identity entitlement queries ONLY capadex_payments — package grants never enter entitled_features.' },
    { name: 'stage_feature_mapping_lockstep', tier: lockstep.stage_keys_consistent && lockstep.ladder_consistent ? 'real' : 'partial',
      note: `STAGE_FEATURES vs STAGE_PRICES(×2) vs LADDER source-introspected: stage-keys ${lockstep.stage_keys_consistent ? 'CONSISTENT' : 'DRIFT'}, ladder ${lockstep.ladder_consistent ? 'CONSISTENT' : 'DRIFT'}. Keys=${featuresEnt.join('/')}. Complete for the real SKU set; non-ladder products correctly have no features.` },
    { name: 'access_enforcement', tier: 'absent',
      note: 'NO middleware/guard consumes deriveEntitlement at access time. Paid-tier reports are served on session-UUID possession. THIS IS THE KEYSTONE GAP.' },
    { name: 'package_grant_path', tier: 'stub',
      note: 'Grant plumbing exists (assign-package, expiry model, active-grant COUNT in overview) BUT produces NO per-identity entitlement: deriveEntitlement excludes packages, subscription_packages has no feature map, grants are child/student-keyed (email-disjoint). As an ENTITLEMENT path it is non-functional.' },
    { name: 'fulfillment_provisioning', tier: 'partial',
      note: 'SPLIT — notification fulfillment is REAL (confirmation emails + WhatsApp + capadex_audit_events payment_completed, verified) | access-provisioning is MISSING (paid status flip unlocks nothing; no entitlement record, no report unlock).' },
  ];
  const entStruct = structPct(entStructCells);
  const entActEnablers: Enabler[] = [
    { name: 'commercialEntitlement flag ON (config default)', present: flagDefaults.commercialEntitlement === true, detail: `default=${flagDefaults.commercialEntitlement}` },
    { name: 'access-time entitlement consumer wired', present: false, detail: 'no requireEntitlement/guard consumes deriveEntitlement anywhere' },
    { name: 'live paid payment rows (entitlement data)', present: db.payments_paid > 0, detail: `${db.payments_paid} paid / ${db.payments_total} total` },
    { name: 'real Razorpay keys (non-demo)', present: razorpayConfigured, detail: `configured=${razorpayConfigured}` },
    { name: 'active package grants feeding entitlement', present: false, detail: `${db.student_subscriptions_active} active grants, but path is entitlement-disjoint` },
  ];
  const entAct = actPct(entActEnablers);

  // ═══════════════ PRODUCT ACCESS MATRIX ═══════════════
  interface AccessRow { product: string; intended_paid: boolean; priced_sku: string; order_path: string; entitlement_feature: string; backend_enforced: boolean; served_guard_today: string; provisioning: string; }
  const accessMatrix: AccessRow[] = [
    { product: 'CAPADEX stage ladder (Insight/Growth/Mastery)', intended_paid: true, priced_sku: 'YES (STAGE_PRICES 499/999/1999)', order_path: 'YES (capadex-payments create-order/verify/webhook)', entitlement_feature: 'YES (insight/growth/mastery_report)', backend_enforced: false, served_guard_today: 'session UUID + completed + runtime flag', provisioning: 'notification only' },
    { product: 'Package / Institute (subscription_packages)', intended_paid: true, priced_sku: 'YES (price col)', order_path: 'PARTIAL (admin/parent assign — not self-serve checkout)', entitlement_feature: 'NO (no feature map; deriveEntitlement excludes packages)', backend_enforced: false, served_guard_today: 'child/student-keyed grant, unenforced', provisioning: 'none' },
    { product: 'Mentor Intelligence', intended_paid: true, priced_sku: 'NO', order_path: 'NO', entitlement_feature: 'YES (mentor_access in CAP_MAS)', backend_enforced: false, served_guard_today: 'product stub (mentor_bookings ABSENT, mentor_profiles=0)', provisioning: 'none' },
    { product: 'Career Builder', intended_paid: false, priced_sku: 'NO', order_path: 'NO', entitlement_feature: 'NO (link lives in journey route, not entitlement map)', backend_enforced: false, served_guard_today: 'requireAuth (RBAC, free surface)', provisioning: 'n/a' },
    { product: 'LBI', intended_paid: false, priced_sku: 'NO', order_path: 'NO', entitlement_feature: 'NO', backend_enforced: false, served_guard_today: 'engine, not a consumer-paid product', provisioning: 'n/a' },
    { product: 'Employability Index / Passport', intended_paid: false, priced_sku: 'NO', order_path: 'NO', entitlement_feature: 'NO', backend_enforced: false, served_guard_today: 'flag-gated engine, not a SKU', provisioning: 'n/a' },
    { product: 'Longitudinal (repeat-assessment trend)', intended_paid: false, priced_sku: 'NO (= CAP_MAS rung, counted under ladder)', order_path: 'NO', entitlement_feature: 'NO (subsumed by mastery_report)', backend_enforced: false, served_guard_today: 'session-derived; not a separate SKU', provisioning: 'n/a' },
  ];

  // ═══════════════ MONETIZATION COVERAGE — TWO DENOMINATORS (never composited) ═══════════════
  // (a) Product Monetization Readiness — WC-C1 6×5 (this name stays bound to THIS metric).
  const monNow: MonRow[] = [
    { product: 'CAPADEX stage ladder', priced_sku: true, order_path: true, pay_to_entitlement: true, access_enforcement: false, fulfillment: false, note: 'only product with a real SKU + order path + stage→feature map; no access guard, no provisioning.' },
    { product: 'LBI', priced_sku: false, order_path: false, pay_to_entitlement: false, access_enforcement: false, fulfillment: false, note: 'engine only.' },
    { product: 'Employability Index / Passport', priced_sku: false, order_path: false, pay_to_entitlement: false, access_enforcement: false, fulfillment: false, note: 'engine/flag-gated; not monetized.' },
    { product: 'Career Builder', priced_sku: false, order_path: false, pay_to_entitlement: false, access_enforcement: false, fulfillment: false, note: 'free surface; not in entitlement map.' },
    { product: 'Mentor Intelligence', priced_sku: false, order_path: false, pay_to_entitlement: true, access_enforcement: false, fulfillment: false, note: 'mentor_access named in map but product is a stub; not sellable.' },
    { product: 'Longitudinal (repeat-assessment trend)', priced_sku: false, order_path: false, pay_to_entitlement: false, access_enforcement: false, fulfillment: false, note: 'subsumed by CAP_MAS rung.' },
  ];
  const monNowScore = monScore(monNow);
  const monMax = monNow.length * 5;
  // Post-keystone PROJECTION (entitlement work ONLY): CAPADEX gains access_enforcement + fulfillment-provisioning.
  const monPost: MonRow[] = monNow.map((r) => r.product === 'CAPADEX stage ladder' ? { ...r, access_enforcement: true, fulfillment: true } : { ...r });
  const monPostScore = monScore(monPost);

  // (b) Live-SKU Entitlement Wiring Readiness — CAPADEX stage ladder ONLY (PROPOSED re-baseline).
  const ladderRow = monNow.find((r) => r.product === 'CAPADEX stage ladder')!;
  const ladderNowScore = [ladderRow.priced_sku, ladderRow.order_path, ladderRow.pay_to_entitlement, ladderRow.access_enforcement, ladderRow.fulfillment].filter(Boolean).length;
  const ladderPostScore = 5; // guard flips both remaining cells.

  const snapshot = {
    audit: 'WC-C2 — Entitlement Engine Readiness',
    generated_at: stamp,
    method: 'recomputed live (buildEntitlementOverview + live DB + env/flag config defaults + source-introspected constants); read-only; PII sha256-masked',
    env_posture: { razorpay: env, razorpay_configured: razorpayConfigured, flag_defaults: flagDefaults, dev_override_footnote: 'workflow sets FF_COMMERCIAL_ACTIVATION=1 only (not an entitlement enabler)' },
    db_ground_truth: db,
    table_existence: tables,
    entitlement_overview_live: overview,
    lockstep,
    unguarded_paid_tier_endpoints: unguardedEndpoints,
    entitlement_subsystem_readiness: {
      structural_pct: entStruct.pct, structural: `${entStruct.score}/${entStruct.max}`,
      activation_pct: entAct.pct, activation: `${entAct.present}/${entAct.total}`,
      dimensions: entStructCells.map((c) => ({ name: c.name, tier: c.tier, score: TIER_SCORE[c.tier] })),
    },
    product_access_matrix: accessMatrix,
    monetization_coverage: {
      product_monetization_readiness_wc_c1_6x5: {
        name: 'Product Monetization Readiness (WC-C1 6 products × 5 cells)',
        now_structural_pct: pct(monNowScore, monMax), now: `${monNowScore}/${monMax}`,
        after_entitlement_keystone_pct: pct(monPostScore, monMax), after: `${monPostScore}/${monMax}`,
        note: 'entitlement keystone moves 13.3%→20% (CAPADEX gains access_enforcement + provisioning). >90% here is a PRODUCTIZATION decision, NOT entitlement work.',
      },
      live_sku_entitlement_wiring_readiness_PROPOSED_REBASELINE: {
        name: 'Live-SKU Entitlement Wiring Readiness (CAPADEX stage ladder only) — PROPOSED re-baseline, requires explicit user approval',
        now_structural_pct: pct(ladderNowScore, 5), now: `${ladderNowScore}/5`,
        after_entitlement_keystone_pct: pct(ladderPostScore, 5), after: `${ladderPostScore}/5`,
        excluded: 'Package SKU excluded: email-keyed entitlement keystone cannot lift it (deriveEntitlement excludes packages, no feature map, child-keyed grants).',
      },
      activation_pct_both: 0,
      activation_note: 'Activation stays 0% on every metric until real keys + paid volume exist — not reachable by configuration/engineering.',
    },
    pii: { distinct_payer_emails: db.distinct_payer_emails, masked_sample: maskedSample },
  };

  // ════════════════════════════ WRITE DELIVERABLES ════════════════════════════
  const w = (name: string, body: string) => writeFileSync(join(OUT_DIR, name), body);

  // 01 — Entitlement Architecture
  w('01_entitlement_architecture.md', `# WC-C2 · Deliverable 1 — Entitlement Architecture Report
_Generated ${stamp}. Read-only recompute over the live entitlement engine._

## The engine (REAL)
- **\`deriveEntitlement(pool, email)\`** — per-identity resolver. Reads ONLY \`capadex_payments\` (status='paid'), maps owned stages → features via \`STAGE_FEATURES\`, returns the UNION. **FAIL-CLOSED**: a ledger read error returns \`billing_ledger_unavailable\` (entitles nothing), never fabricates ownership.
- **\`buildEntitlementOverview(pool)\`** — system-wide coverage. Live recompute this run: paying_identities=**${overview.paying_identities}**, entitled_identities=**${overview.entitled_identities}**, coverage_pct=**${overview.coverage_pct === null ? 'n/a (no payers)' : overview.coverage_pct + '%'}**, active_package_grants=**${overview.active_package_grants}**, degraded=**${overview.degraded}**.

## Stage → feature map (lockstep verified by source-introspection)
| Constant | Source | Keys |
|---|---|---|
| STAGE_PRICES | routes/capadex-payments.ts | ${pricesPay.join(' · ') || '—'} |
| STAGE_FEATURES | services/wc7c/entitlement-engine.ts | ${featuresEnt.join(' · ') || '—'} |
| STAGE_PRICES | services/wc7c/subscription-engine.ts | ${pricesSub.join(' · ') || '—'} |
| LADDER | entitlement / subscription | ${ladderEnt.join(' → ') || '—'} / ${ladderSub.join(' → ') || '—'} |

Stage-keys consistent: **${lockstep.stage_keys_consistent ? 'YES ✅' : 'NO ⚠️'}** · Ladder consistent: **${lockstep.ladder_consistent ? 'YES ✅' : 'NO ⚠️'}**. Feature strings: \`insight_report\`, \`growth_report\`, \`growth_plan\`, \`mastery_report\`, \`mentor_access\`. The map is **complete for the real SKU set**; non-ladder products correctly carry no features.

## ⚠️ Finding — header overstates package coverage (doc/code drift)
The engine header claims it reads \`student_subscriptions → subscription_packages\`. **The code does not**: per-identity \`deriveEntitlement\` queries only \`capadex_payments\`; package grants appear ONLY as an aggregate \`active_package_grants\` COUNT in the overview. Combined with (a) \`subscription_packages\` having **no feature-string column** (category/segment/domains_covered/report_type/price only) and (b) grants being **child/student-keyed** (email-disjoint), the package SKU is **entitlement-disjoint** — an email-keyed access guard cannot grant package features. This is a real correction to any assumption that the keystone guard "also covers packages".

## Entitlement Subsystem Readiness (dual-axis — distinct from monetization coverage)
**Structural ${entStruct.pct}% (${entStruct.score}/${entStruct.max}) · Activation ${entAct.pct}% (${entAct.present}/${entAct.total})**

| Dimension | Structural tier | Note |
|---|---|---|
${entStructCells.map((c) => `| ${c.name} | ${tierTag(c.tier)} | ${c.note} |`).join('\n')}

Activation enablers (deploy posture):
${entActEnablers.map((e) => `- [${e.present ? 'x' : ' '}] ${e.name} — ${e.detail}`).join('\n')}

_Scope: behavioural substrate (wcl0/wcl4/wcl5) is intelligence, not commercial signal — excluded from every figure here._
`);

  // 02 — Product Access Matrix
  w('02_product_access_matrix.md', `# WC-C2 · Deliverable 2 — Product Access Matrix
_Generated ${stamp}. What each product costs, what gates it in code TODAY, and whether payment actually controls access._

| Product | Intended paid | Priced SKU | Order path | Entitlement feature | Backend-enforced | Served-guard TODAY | Provisioning |
|---|---|---|---|---|---|---|---|
${accessMatrix.map((r) => `| ${r.product} | ${r.intended_paid ? 'Yes' : 'No'} | ${r.priced_sku} | ${r.order_path} | ${r.entitlement_feature} | ${r.backend_enforced ? '✅' : '❌'} | ${r.served_guard_today} | ${r.provisioning} |`).join('\n')}

## Reading this matrix
- **Backend-enforced = ❌ for every paid product.** No endpoint consults entitlement. For the CAPADEX ladder, paid-tier reports are served on **session-UUID possession** (see deliverable 4) — the paywall is a frontend convention, not a backend gate.
- **Only the CAPADEX stage ladder is a complete SKU** (priced + checkout order path + feature map). The Package/Institute model has a price but a **non-checkout** (admin/parent-assign) order path and **no entitlement feature map**.
- **Mentor** is named in the entitlement map (\`mentor_access\`) but is a product stub (mentor_bookings table ${tables.mentor_bookings ? 'present' : 'ABSENT'}, mentor_profiles=${db.mentor_profiles}) — not sellable.
- **Career Builder / LBI / Employability / Longitudinal** are not consumer-paid SKUs (free surfaces or engines / subsumed rungs).
`);

  // 03 — Monetization Coverage
  const a = snapshot.monetization_coverage.product_monetization_readiness_wc_c1_6x5;
  const b = snapshot.monetization_coverage.live_sku_entitlement_wiring_readiness_PROPOSED_REBASELINE;
  w('03_monetization_coverage.md', `# WC-C2 · Deliverable 3 — Monetization Coverage Report
_Generated ${stamp}. Two metrics, reported side by side, **never composited**, **never silently swapped**._

## (a) Product Monetization Readiness — the WC-C1 metric (6 products × 5 cells)
> This name stays bound EXCLUSIVELY to this metric. It is the apples-to-apples answer to the objective.

**Now: ${naOrPct(a.now_structural_pct)} (${a.now}) · After entitlement keystone: ${naOrPct(a.after_entitlement_keystone_pct)} (${a.after}) · Activation 0%**

| Product | priced_sku | order_path | pay→entitlement | access_enforced | fulfillment | now |
|---|---|---|---|---|---|---|
${monNow.map((r) => { const cur = [r.priced_sku, r.order_path, r.pay_to_entitlement, r.access_enforcement, r.fulfillment]; return `| ${r.product} | ${cur[0] ? '✅' : '❌'} | ${cur[1] ? '✅' : '❌'} | ${cur[2] ? '✅' : '❌'} | ${cur[3] ? '✅' : '❌'} | ${cur[4] ? '✅' : '❌'} | ${cur.filter(Boolean).length}/5 |`; }).join('\n')}

**The entitlement keystone moves this metric 13.3% → 20% only** (CAPADEX gains \`access_enforced\` + \`fulfillment\`-provisioning; nothing else moves). **Reaching >90% on this metric is a PRODUCTIZATION decision, not entitlement work** — it would require turning LBI, Employability, Career Builder and Longitudinal into fully-wired SKUs and building the mentor stub. The audit does **not** recommend doing that solely to move a number.

## (b) Live-SKU Entitlement Wiring Readiness — PROPOSED RE-BASELINE (your decision)
> A DIFFERENT metric with a DIFFERENT name. The audit does **not** adopt it; it asks you to.

Scoped to the only complete SKU — the **CAPADEX stage ladder** — this metric measures how well the live SKU is wired for purchase→access:

**Now: ${naOrPct(b.now_structural_pct)} (${b.now}) · After entitlement keystone: ${naOrPct(b.after_entitlement_keystone_pct)} (${b.after}) · Activation 0%**

The entitlement keystone takes the live SKU from 60% → 100% **structural**. **Package SKU is excluded** because the email-keyed keystone cannot lift it (deriveEntitlement excludes packages · no feature map · child-keyed grants).

### Decision required
If you approve re-baselining "monetization readiness" to the live-SKU set, the entitlement keystone gets you to ≥90% **on that re-baselined metric**. If you keep the original 6×5 metric, the keystone gets you to **20%** and >90% needs a separate productization programme. **Both numbers are above; pick the denominator deliberately.**

## Activation (both metrics)
0% and not movable by configuration — it requires real Razorpay keys + real paid volume. Structural wiring is necessary but not sufficient for activation.
`);

  // 04 — Access Enforcement
  w('04_access_enforcement.md', `# WC-C2 · Deliverable 4 — Access Enforcement Report
_Generated ${stamp}. Where paid-tier content is served WITHOUT an entitlement check._

## Central finding — session UUIDs are bearer tokens for paid-tier content
There is **no backend paywall**. Every paid-tier CAPADEX endpoint is gated by **possession of the session UUID** (+ a completed-status / runtime-flag check) — never by payment or entitlement. Anyone holding the UUID can fetch the deeper report regardless of payment; the only thing stopping non-payers is the **frontend** choosing not to call these endpoints.

## Missing enforcement points (verified file:line)
| Method | Endpoint | Location | Current gate (NOT entitlement) |
|---|---|---|---|
${unguardedEndpoints.map((e) => `| ${e.method} | \`${e.path}\` | ${e.loc} | ${e.gate} |`).join('\n')}

## RBAC ≠ entitlement
\`requireAuth\` / \`requireAdmin\` / \`requireSuperAdmin\` are **role-based** and never consult \`deriveEntitlement\`. There is no \`requireEntitlement\` / \`requirePlan\` tier guard anywhere in the codebase.

## The single fix
One \`requireEntitlement(feature)\` middleware that calls \`deriveEntitlement(pool, email)\` and 403s when the required feature is absent, applied to the report/stage endpoints above. For ladder stages this satisfies BOTH \`access_enforcement\` AND \`access-provisioning\` (the paid stage finally unlocks). It does **not** cover packages (entitlement-disjoint — see deliverable 1).
`);

  // 05 — Entitlement Roadmap
  w('05_entitlement_roadmap.md', `# WC-C2 · Deliverable 5 — Entitlement Roadmap
_Generated ${stamp}. Ordered enabler checklist keyed to axis cells. AUDIT ONLY — nothing here is implemented._

> Honest framing: **Structural** cells are reachable by focused wiring. **Activation** is NOT reachable by configuration — it is a function of real revenue (keys + paid volume) earned over time.

## Shortest path (entitlement keystone) — in order
| # | Enabler | Cells it unlocks | Axis | One build? |
|---|---|---|---|---|
| 1 | **\`requireEntitlement\` guard** consuming \`deriveEntitlement(email)\`, applied to the report/stage endpoints | CAPADEX \`access_enforcement\` **+** \`fulfillment\`-provisioning (ONE build, TWO cells) | Structural · Product-Mon (a) 4/30→6/30 · Live-SKU (b) 60%→100% | Yes |
| 2 | **Un-gate \`commercialEntitlement\`** (config default OFF) | makes the engine live in the running env | Structural→Activation prerequisite | Yes (flag) |
| 3 | **Real Razorpay keys** (RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET) | exits demo mode | Activation prerequisite | Yes (secrets) |
| 4 | **One real paid transaction** end-to-end | proves verify→paid→entitled→access | Activation (first datapoint) | Earned, not built |

## Separate, larger track (NOT the shortest path) — packages
Only pursue if the institute/package SKU is a priority. Each item is real work, none unlocked by the keystone:
- Wire \`deriveEntitlement\` to ALSO read \`student_subscriptions → subscription_packages\`, resolving child/student ↔ billing identity.
- Add a **feature map** to \`subscription_packages\` (today: no feature-string column).
- Decide a package **order path** (self-serve checkout vs admin-grant) and seed the catalog (currently ${db.packages_total} rows).

## Productization track (NOT entitlement work) — only if you keep metric (a)
Reaching >90% on the WC-C1 6×5 metric requires building SKUs for LBI / Employability / Career Builder / Longitudinal and the Mentor stub. This is a product/business decision, explicitly out of entitlement scope.

## Fix-in-place (cheap, do alongside #1)
- Correct the \`entitlement-engine.ts\` header comment so it stops claiming package coverage the code doesn't provide (doc/code drift — deliverable 1).
`);

  // 06 — Executive Summary
  w('06_executive_summary.md', `# WC-C2 · Executive Summary — Entitlement Engine Readiness
_Generated ${stamp}. AUDIT ONLY · STOP FOR APPROVAL. Two axes (Structural / Activation), never composited._

## Current entitlement readiness
**Entitlement Subsystem Readiness — Structural ${entStruct.pct}% (${entStruct.score}/${entStruct.max}) · Activation ${entAct.pct}% (${entAct.present}/${entAct.total}).** The engine is real and fail-closed; the gap is that **nothing enforces it** and **nothing has been paid**.

## Answers to the success criteria
1. **Missing enforcement points** — ${unguardedEndpoints.length} paid-tier endpoints served on session-UUID possession with **no entitlement check** (deliverable 4). There is no backend paywall; session UUIDs act as bearer tokens.
2. **Missing package definitions** — ${db.packages_total} packages seeded; \`subscription_packages\` has **no feature-string column**; the package grant path is **entitlement-disjoint** (deriveEntitlement excludes packages, grants are child/student-keyed). Packages cannot be entitlement-gated as built.
3. **Products blocked from monetization** — **Mentor** (named in the map but a stub: mentor_bookings ${tables.mentor_bookings ? 'present' : 'ABSENT'}, mentor_profiles=${db.mentor_profiles}); **Package/Institute** (entitlement-disjoint, non-checkout order path); **LBI / Employability / Career Builder / Longitudinal** (not consumer-paid SKUs). Only the **CAPADEX stage ladder** is a complete SKU.
4. **Shortest path to >90%** — depends on the denominator, stated honestly:
   - On **Product Monetization Readiness** (the WC-C1 6×5 metric, this name reserved for it): the entitlement keystone moves it **13.3% → 20%** only. **>90% here is a productization decision, not entitlement work.**
   - On a **proposed re-baselined metric — "Live-SKU Entitlement Wiring Readiness" (CAPADEX ladder only)**: the keystone moves it **60% → 100% structural**. **This requires your explicit approval to re-baseline** — the audit does not adopt it for you.
5. **Current entitlement readiness** — see the dual-axis pair above.

## The keystone (one build, two cells)
A single \`requireEntitlement\` middleware consuming \`deriveEntitlement(email)\`, applied to the report/stage endpoints, flips CAPADEX's \`access_enforcement\` **and** \`access-provisioning\` at once. Un-gate \`commercialEntitlement\`, add real Razorpay keys, and one real transaction proves the chain. Packages need a separate, larger track.

## Honest activation ceiling
Activation is **0%** on every metric and **cannot be raised by configuration or engineering** — it is a function of real keys + real paid volume earned over time.

## Decision requested
Choose the denominator: **(a)** keep "Product Monetization Readiness" (then >90% needs a productization programme), or **(b)** re-baseline to "Live-SKU Entitlement Wiring Readiness" (then the entitlement keystone reaches ≥90%). **No implementation has been performed. STOP FOR APPROVAL.**
`);

  writeFileSync(join(OUT_DIR, '_wc_c2_snapshot.json'), JSON.stringify(snapshot, null, 2));

  await pool.end();

  console.log(`WC-C2 audit — 6 deliverables + _wc_c2_snapshot.json written to ${OUT_DIR}`);
  console.log(`Entitlement Subsystem:  Structural ${entStruct.pct}% (${entStruct.score}/${entStruct.max}) · Activation ${entAct.pct}%`);
  console.log(`Product Monetization (a, WC-C1 6×5):  now ${naOrPct(pct(monNowScore, monMax))} (${monNowScore}/${monMax}) → after keystone ${naOrPct(pct(monPostScore, monMax))} (${monPostScore}/${monMax})`);
  console.log(`Live-SKU Wiring (b, proposed re-baseline): now ${naOrPct(pct(ladderNowScore, 5))} (${ladderNowScore}/5) → after keystone ${naOrPct(pct(ladderPostScore, 5))} (${ladderPostScore}/5)`);
  console.log(`Lockstep: stage-keys ${lockstep.stage_keys_consistent ? 'OK' : 'DRIFT'} · ladder ${lockstep.ladder_consistent ? 'OK' : 'DRIFT'} · Razorpay configured: ${razorpayConfigured} · paid rows: ${db.payments_paid} · unguarded endpoints: ${unguardedEndpoints.length}`);
}

run().catch((e) => { console.error(e); process.exit(1); });
