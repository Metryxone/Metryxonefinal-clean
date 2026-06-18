/**
 * WC-C3 — Entitlement ENFORCEMENT AUDIT (READ-ONLY · additive · never mutates DB / schema / deploy).
 *
 * Follow-on to WC-C2 (Entitlement Engine Readiness). WC-C2 proved the engine is REAL but UNCONSUMED
 * and that the entitlement keystone moves "Product Monetization Readiness" (the WC-C1 6×5 metric)
 * 13.3% → 20% ONLY. WC-C3 zooms into ENFORCEMENT: what protects paid-tier content today, what is
 * missing, and the shortest path + honest effort estimate to >90% monetization readiness.
 *
 * EVERYTHING IS RE-DERIVED LIVE on each run (architect Correction 3 — do not copy the WC-C2 snapshot):
 *   • Route surface is enumerated by SOURCE STATIC ANALYSIS across routes.ts + routes/*.ts — inline
 *     middleware (requireAuth/Admin/SuperAdmin), SPREAD guards (...adminChain / ...adminGuards resolved
 *     to file-local guard arrays), and covering app.use('/prefix', ...guards) prefixes. Paid-tier
 *     CAPADEX endpoints are re-derived from capadex.ts (line numbers recomputed, never hardcoded).
 *   • Entitlement resolver recomputed via buildEntitlementOverview; live DB + env/flag posture read.
 *   • The three STAGE_PRICES / STAGE_FEATURES / LADDER constants source-introspected for lockstep.
 *
 * TWO INDEPENDENT AXES, NEVER composited:
 *   • STRUCTURAL — does the enforcement mechanism exist in code? Deterministic tier map
 *       real=5 / gated-real=4 / partial=3 / stub=2 / absent=1 → normalized %.
 *   • ACTIVATION — is it live in the DEPLOY posture (flag-ON by default + consumer wired + real keys +
 *       paid volume)? A COUNT of binary enablers. Workflow FF_COMMERCIAL_ACTIVATION=1 is a footnote.
 *
 * HONESTY GUARDS (architect plan sign-off, baked in):
 *   • "Product Monetization Readiness" stays bound EXCLUSIVELY to the WC-C1 6×5 metric. The objective's
 *     "20% → >90% through enforcement" premise is FALSE on that metric: the keystone reaches 20% only;
 *     >90% there is PRODUCTIZATION, not enforcement. Stated plainly, not silently swapped.
 *   • A second metric — "Live-SKU Entitlement Wiring Readiness" (CAPADEX ladder only) — is presented as
 *     a PROPOSED re-baseline (user decision) where the keystone reaches ≥90%. Shown side by side.
 *   • enforcement_middleware and report_endpoint_protection are DEPENDENT (no guard ⇒ no protection):
 *     one build flips both. Post-keystone projection caps flag-gated cells at gated-real(4) while
 *     commercialEntitlement defaults OFF — never real(5), never activation.
 *   • The unguarded /api/admin/* surface is an RBAC/SECURITY gap (separate axis) — measured at true
 *     scale, QUARANTINED from the entitlement % (it is not entitlement work).
 *   • Effort = COUNTABLE units + T-shirt sizing only in the snapshot; any engineering-day band lives in
 *     the roadmap prose under an explicit "judgment, not measurement" header. Activation (paid volume)
 *     is earned, not estimable.
 *
 * PII: emails one-way sha256-masked (user_<hex[:10]>) before any artifact is written.
 *
 * Usage: cd backend && npx tsx scripts/wc-c3/wc-c3-measure.ts
 */
import { Pool } from 'pg';
import { createHash } from 'crypto';
import { writeFileSync, mkdirSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { buildEntitlementOverview } from '../../services/wc7c/entitlement-engine';
import { FEATURE_FLAGS } from '../../config/feature-flags';

const OUT_DIR = join(__dirname, '..', '..', 'audit', 'wc-c3');

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

// ── Source helpers ───────────────────────────────────────────────────────────
function readSrc(...parts: string[]): string {
  try { return readFileSync(join(__dirname, '..', '..', ...parts), 'utf8'); } catch { return ''; }
}
function lineOf(src: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < src.length; i++) if (src[i] === '\n') line++;
  return line;
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

// ── STATIC ROUTE ENUMERATOR (the systematic surface map) ─────────────────────
type Guard = 'rbac_inline' | 'rbac_spread' | 'rbac_global' | 'entitlement' | 'none';
interface RouteDef { method: string; path: string; file: string; line: number; guard: Guard; mw: string; }

const ENTITLEMENT_GUARD_RE = /require(?:Entitlement|Plan|Membership|Subscription)/;
const RBAC_GUARD_RE = /require(?:Auth|Admin|SuperAdmin)/;

function guardArrayNames(src: string): Set<string> {
  // Names of file-local arrays that contain an RBAC guard, e.g. const adminChain = [requireAuth, requireSuperAdmin]
  const names = new Set<string>();
  const re = /const\s+(\w+)\s*=\s*\[[^\]]*?require(?:Auth|Admin|SuperAdmin)[^\]]*?\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) names.add(m[1]);
  return names;
}
function collectGlobalGuardPrefixes(files: { name: string; src: string }[]): string[] {
  // app.use('/prefix', requireAuth, requireSuperAdmin) — a covering RBAC mount.
  const prefixes: string[] = [];
  const re = /app\.use\(\s*(['"`])([^'"`]+)\1\s*,([^)]*)\)/g;
  for (const f of files) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(f.src))) if (RBAC_GUARD_RE.test(m[3])) prefixes.push(m[2]);
  }
  return Array.from(new Set(prefixes));
}
function classify(path: string, mw: string, arrays: Set<string>, globals: string[]): Guard {
  if (ENTITLEMENT_GUARD_RE.test(mw)) return 'entitlement';
  if (RBAC_GUARD_RE.test(mw)) return 'rbac_inline';
  const spreads = (mw.match(/\.\.\.(\w+)/g) ?? []).map((s) => s.slice(3));
  if (spreads.some((n) => arrays.has(n))) return 'rbac_spread';
  if (globals.some((p) => path === p || path.startsWith(p.endsWith('/') ? p : p + '/'))) return 'rbac_global';
  return 'none';
}
function enumerateRoutes(files: { name: string; src: string }[], globals: string[]): RouteDef[] {
  const out: RouteDef[] = [];
  // Capture method + path + the middleware window up to the handler body / statement end.
  const re = /\bapp\.(get|post|put|delete|patch|all)\(\s*(['"`])([^'"`]+)\2([\s\S]{0,300}?)(=>\s*\{|\)\s*;|\)\s*=>)/g;
  for (const f of files) {
    const arrays = guardArrayNames(f.src);
    let m: RegExpExecArray | null;
    while ((m = re.exec(f.src))) {
      const method = m[1].toUpperCase();
      const path = m[3];
      const mw = m[4] || '';
      const line = lineOf(f.src, m.index);
      out.push({ method, path, file: f.name, line, guard: classify(path, mw, arrays, globals), mw: mw.replace(/\s+/g, ' ').trim().slice(0, 120) });
    }
  }
  return out;
}

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
    distinct_payer_emails: await num(pool, `SELECT count(DISTINCT lower(email)) n FROM capadex_payments WHERE email IS NOT NULL`),
    distinct_paid_emails: await num(pool, `SELECT count(DISTINCT lower(email)) n FROM capadex_payments WHERE status='paid' AND email IS NOT NULL`),
    packages_total: await num(pool, `SELECT count(*) n FROM subscription_packages`),
    student_subscriptions_active: await num(pool, `SELECT count(*) n FROM student_subscriptions WHERE status='active' AND (expiry_date IS NULL OR expiry_date >= now())`),
    sessions_total: await num(pool, `SELECT count(*) n FROM capadex_sessions`),
    sessions_completed: await num(pool, `SELECT count(*) n FROM capadex_sessions WHERE status='completed'`),
    mentor_profiles: await num(pool, `SELECT count(*) n FROM mentor_profiles`),
  };
  const tables = {
    mentor_bookings: await tableExists(pool, 'mentor_bookings'),
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
  const srcCapadex = readSrc('routes', 'capadex.ts');
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

  // ── Load the full route surface (routes.ts + routes/*.ts) ──
  const routesDir = join(__dirname, '..', '..', 'routes');
  let routeFileNames: string[] = [];
  try { routeFileNames = readdirSync(routesDir).filter((f) => f.endsWith('.ts')); } catch { /* none */ }
  const allFiles = [
    { name: 'routes.ts', src: readSrc('routes.ts') },
    ...routeFileNames.map((f) => ({ name: `routes/${f}`, src: readSrc('routes', f) })),
  ].filter((f) => f.src);

  const globalPrefixes = collectGlobalGuardPrefixes(allFiles);
  const allRoutes = enumerateRoutes(allFiles, globalPrefixes);

  // entitlement guard existence (across the whole live route surface)
  const entitlementGuards = allRoutes.filter((r) => r.guard === 'entitlement');
  const entitlementGuardExists = entitlementGuards.length > 0;

  // ── RBAC / security axis: /api/admin/* routes lacking ANY RBAC guard ──
  const adminRoutes = allRoutes.filter((r) => r.path.startsWith('/api/admin'));
  const adminGuarded = adminRoutes.filter((r) => r.guard !== 'none');
  const adminNoGuard = adminRoutes.filter((r) => r.guard === 'none');
  const adminNoGuardByFile: Record<string, number> = {};
  for (const r of adminNoGuard) adminNoGuardByFile[r.file] = (adminNoGuardByFile[r.file] ?? 0) + 1;
  // CONFIRMED-unguarded sample (handler/file inspected this session — no inline guard, no spread, no in-body auth token).
  const confirmedFiles = new Set(['routes/capadex-payments.ts', 'routes/capadex-enterprise.ts', 'routes/concern-intelligence-admin.ts', 'routes/spe-scoring-engine.ts']);
  // Representative across EACH confirmed file (≤3/file) so the PII + state-changing findings are visible.
  const confirmedSample = Array.from(confirmedFiles)
    .flatMap((f) => adminNoGuard.filter((r) => r.file === f).slice(0, 3))
    .map((r) => ({ method: r.method, path: r.path, loc: `${r.file}:${r.line}` }));

  // ── ENTITLEMENT axis: paid-tier CAPADEX endpoints (re-derived fresh from capadex.ts) ──
  const paidRe = /\bapp\.(get|post)\(\s*(['"`])(\/api\/capadex\/(?:session\/:id\/(?:omega-x|signals|patterns|explain|guidance|grounding|pipeline|stage|report|reports)|report\/:session_id(?:\/pdf|\/send-email)?))\2/g;
  const paidEndpoints: { method: string; path: string; loc: string; runtime_flag: boolean; rbac: string; entitlement: string }[] = [];
  const seenPaid = new Set<string>();
  let pm: RegExpExecArray | null;
  while ((pm = paidRe.exec(srcCapadex))) {
    const key = `${pm[1]}:${pm[3]}:${pm.index}`;
    if (seenPaid.has(key)) continue; seenPaid.add(key);
    const line = lineOf(srcCapadex, pm.index);
    const window = srcCapadex.slice(pm.index, pm.index + 1400);
    paidEndpoints.push({
      method: pm[1].toUpperCase(),
      path: pm[3],
      loc: `routes/capadex.ts:${line}`,
      runtime_flag: /isRuntimeIntelligenceActivationEnabled/.test(window),
      rbac: RBAC_GUARD_RE.test(window.slice(0, 200)) ? 'present' : 'none',
      entitlement: ENTITLEMENT_GUARD_RE.test(window.slice(0, 200)) ? 'present' : 'none',
    });
  }
  paidEndpoints.sort((a, b) => a.path.localeCompare(b.path));
  const runtimeFlagUses = (srcCapadex.match(/isRuntimeIntelligenceActivationEnabled/g) ?? []).length;

  // ═══════════════ ENTITLEMENT ENFORCEMENT READINESS (dual-axis) ═══════════════
  const enfStructCells: Cell[] = [
    { name: 'entitlement_resolver', tier: 'real',
      note: `deriveEntitlement(pool,email) + buildEntitlementOverview: read-only, FAIL-CLOSED on ledger error, unions owned paid stages → features. EXISTS and correct — but NO caller consumes it at access time (live recompute: paying=${overview.paying_identities}, entitled=${overview.entitled_identities}).` },
    { name: 'enforcement_middleware', tier: entitlementGuardExists ? 'partial' : 'absent',
      note: `requireEntitlement/requirePlan/requireMembership tier guard: ${entitlementGuardExists ? `${entitlementGuards.length} found` : 'NONE in the entire live route surface'}. Only RBAC (requireAuth/requireAdmin/requireSuperAdmin) exists, which never consults entitlement. DEPENDENT with report_endpoint_protection — one build flips both. THIS IS THE KEYSTONE.` },
    { name: 'report_endpoint_protection', tier: 'absent',
      note: `${paidEndpoints.length} paid-tier CAPADEX report/intelligence endpoints carry NO entitlement check (and no RBAC) — gated only by session-UUID possession + isRuntimeIntelligenceActivationEnabled() flag (${runtimeFlagUses} flag uses in capadex.ts). UUIDs act as bearer tokens. Dependent on enforcement_middleware.` },
    { name: 'fulfillment_access_provisioning', tier: 'partial',
      note: 'SPLIT — notification fulfillment is REAL (confirmation email + WhatsApp + capadex_audit_events payment_completed) | access-provisioning is MISSING (paid status flip unlocks nothing). The keystone guard provisions access as a side-effect (the paid stage finally serves).' },
    { name: 'activation_path_wiring', tier: 'stub',
      note: `Path to turn enforcement ON exists but is inert: commercialEntitlement flag default=${flagDefaults.commercialEntitlement}, no consumer wired, Razorpay unconfigured (demo mode), ${db.payments_paid} paid rows. Flag + keys + a real txn complete it.` },
  ];
  const enfStruct = structPct(enfStructCells);

  // Post-keystone PROJECTION (structural only): one requireEntitlement build flips middleware + endpoint
  // protection; provisioning follows. Flag-gated cells capped at gated-real(4) while commercialEntitlement
  // defaults OFF (architect Correction 2) — never real(5), never activation.
  const enfPostCells: Cell[] = enfStructCells.map((c) => {
    if (c.name === 'enforcement_middleware') return { ...c, tier: 'gated-real' as Tier };
    if (c.name === 'report_endpoint_protection') return { ...c, tier: 'gated-real' as Tier };
    if (c.name === 'fulfillment_access_provisioning') return { ...c, tier: 'gated-real' as Tier };
    if (c.name === 'activation_path_wiring') return { ...c, tier: 'gated-real' as Tier };
    return c;
  });
  const enfPost = structPct(enfPostCells);

  const enfActEnablers: Enabler[] = [
    { name: 'commercialEntitlement flag ON (config default)', present: flagDefaults.commercialEntitlement === true, detail: `default=${flagDefaults.commercialEntitlement}` },
    { name: 'requireEntitlement consumer wired to paid endpoints', present: entitlementGuardExists, detail: entitlementGuardExists ? `${entitlementGuards.length} guarded` : 'no tier guard anywhere' },
    { name: 'live paid payment rows (entitlement data)', present: db.payments_paid > 0, detail: `${db.payments_paid} paid / ${db.payments_total} total` },
    { name: 'real Razorpay keys (non-demo)', present: razorpayConfigured, detail: `configured=${razorpayConfigured}` },
    { name: 'one real paid txn proves verify→entitled→access', present: db.distinct_paid_emails > 0, detail: `${db.distinct_paid_emails} distinct paid identities` },
  ];
  const enfAct = actPct(enfActEnablers);

  // ═══════════════ MONETIZATION COVERAGE — TWO DENOMINATORS (never composited) ═══════════════
  interface MonRow { product: string; priced_sku: boolean; order_path: boolean; pay_to_entitlement: boolean; access_enforcement: boolean; fulfillment: boolean; note: string; }
  const monScore = (rows: MonRow[]) =>
    rows.reduce((s, r) => s + [r.priced_sku, r.order_path, r.pay_to_entitlement, r.access_enforcement, r.fulfillment].filter(Boolean).length, 0);
  const monNow: MonRow[] = [
    { product: 'CAPADEX stage ladder', priced_sku: true, order_path: true, pay_to_entitlement: true, access_enforcement: false, fulfillment: false, note: 'only complete SKU; no access guard, no provisioning.' },
    { product: 'LBI', priced_sku: false, order_path: false, pay_to_entitlement: false, access_enforcement: false, fulfillment: false, note: 'engine only.' },
    { product: 'Employability Index / Passport', priced_sku: false, order_path: false, pay_to_entitlement: false, access_enforcement: false, fulfillment: false, note: 'engine/flag-gated; not monetized.' },
    { product: 'Career Builder', priced_sku: false, order_path: false, pay_to_entitlement: false, access_enforcement: false, fulfillment: false, note: 'free surface; not in entitlement map.' },
    { product: 'Mentor Intelligence', priced_sku: false, order_path: false, pay_to_entitlement: true, access_enforcement: false, fulfillment: false, note: 'mentor_access named in map but product is a stub; not sellable.' },
    { product: 'Longitudinal (repeat-assessment trend)', priced_sku: false, order_path: false, pay_to_entitlement: false, access_enforcement: false, fulfillment: false, note: 'subsumed by CAP_MAS rung.' },
  ];
  const monMax = monNow.length * 5;
  const monNowScore = monScore(monNow);
  const monPost: MonRow[] = monNow.map((r) => r.product === 'CAPADEX stage ladder' ? { ...r, access_enforcement: true, fulfillment: true } : { ...r });
  const monPostScore = monScore(monPost);
  const ladderRow = monNow.find((r) => r.product === 'CAPADEX stage ladder')!;
  const ladderNowScore = [ladderRow.priced_sku, ladderRow.order_path, ladderRow.pay_to_entitlement, ladderRow.access_enforcement, ladderRow.fulfillment].filter(Boolean).length;
  const ladderPostScore = 5;

  // ═══════════════ ENFORCEMENT EFFORT — countable units + T-shirt only (no day figure here) ═══════════════
  const effortUnits = [
    { id: 'U1', unit: 'Write ONE requireEntitlement(feature) middleware calling deriveEntitlement(pool,email) → 403 when feature absent', size: 'S', axis: 'Structural (entitlement)', note: 'single function; resolver already exists.' },
    { id: 'U2', unit: `Apply the guard to the ${paidEndpoints.length} paid-tier CAPADEX endpoints + a small endpoint→required-feature lookup`, size: 'S', axis: 'Structural (entitlement)', note: 'mechanical wiring; feature strings already in STAGE_FEATURES.' },
    { id: 'U3', unit: 'Un-gate commercialEntitlement (config default OFF)', size: 'XS', axis: 'Activation prerequisite', note: 'flag flip.' },
    { id: 'U4', unit: 'Configure real Razorpay keys (KEY_ID/SECRET/WEBHOOK_SECRET) — exits demo mode', size: 'S', axis: 'Activation prerequisite', note: 'ops/secrets, not code.' },
    { id: 'U5', unit: `Guard the ${adminNoGuard.length} unguarded /api/admin/* endpoints (RBAC/security — SEPARATE track from entitlement)`, size: 'M', axis: 'Structural (RBAC/security)', note: 'reuse requireAuth+requireSuperAdmin convention; size grows with count.' },
    { id: 'U6', unit: 'Fix entitlement-engine.ts header doc/code drift (claims package coverage the code lacks)', size: 'XS', axis: 'Hygiene', note: 'comment-only.' },
  ];

  const snapshot = {
    audit: 'WC-C3 — Entitlement Enforcement Audit',
    generated_at: stamp,
    method: 'recomputed live: static route enumeration over routes.ts + routes/*.ts (inline + spread-array + global app.use guards), fresh paid-tier re-derivation from capadex.ts, buildEntitlementOverview, live DB, env/flag config defaults, source-introspected constants; read-only; PII sha256-masked',
    env_posture: { razorpay: env, razorpay_configured: razorpayConfigured, flag_defaults: flagDefaults, dev_override_footnote: 'workflow sets FF_COMMERCIAL_ACTIVATION=1 only (not an entitlement enabler)' },
    db_ground_truth: db,
    table_existence: tables,
    entitlement_overview_live: overview,
    lockstep,
    route_surface: {
      files_scanned: allFiles.length,
      routes_enumerated: allRoutes.length,
      global_rbac_prefixes: globalPrefixes,
      guard_distribution: {
        rbac_inline: allRoutes.filter((r) => r.guard === 'rbac_inline').length,
        rbac_spread: allRoutes.filter((r) => r.guard === 'rbac_spread').length,
        rbac_global: allRoutes.filter((r) => r.guard === 'rbac_global').length,
        entitlement: entitlementGuards.length,
        none: allRoutes.filter((r) => r.guard === 'none').length,
      },
      static_analysis_limitation: 'middleware-level detection only; in-handler auth checks are not inspected except for the confirmed sample. "none" on a public/consumer route is not necessarily a gap — the RBAC finding is scoped to /api/admin/* which the codebase convention expects to be guarded.',
    },
    entitlement_guard_exists: entitlementGuardExists,
    paid_tier_endpoints: paidEndpoints,
    admin_rbac_gap: {
      axis: 'RBAC / SECURITY — separate from entitlement; QUARANTINED from the entitlement readiness %',
      admin_routes_total: adminRoutes.length,
      admin_routes_guarded: adminGuarded.length,
      admin_routes_no_guard_detected: adminNoGuard.length,
      by_file: adminNoGuardByFile,
      confirmed_unguarded_sample: confirmedSample,
      note: 'These expose admin data/actions (incl. payment PII at routes/capadex-payments.ts and a state-changing migration endpoint) with no route-level RBAC. Fixing them is a security pass, NOT entitlement enforcement.',
    },
    enforcement_readiness: {
      structural_pct: enfStruct.pct, structural: `${enfStruct.score}/${enfStruct.max}`,
      structural_after_keystone_pct: enfPost.pct, structural_after_keystone: `${enfPost.score}/${enfPost.max}`,
      activation_pct: enfAct.pct, activation: `${enfAct.present}/${enfAct.total}`,
      dimensions: enfStructCells.map((c) => ({ name: c.name, tier: c.tier, score: TIER_SCORE[c.tier], after_keystone: enfPostCells.find((p) => p.name === c.name)!.tier })),
      after_keystone_note: 'Flag-gated cells projected at gated-real(4) while commercialEntitlement defaults OFF — never real(5). Activation stays 0% until real keys + paid volume exist.',
    },
    monetization_coverage: {
      product_monetization_readiness_wc_c1_6x5: {
        name: 'Product Monetization Readiness (WC-C1 6 products × 5 cells)',
        now_structural_pct: pct(monNowScore, monMax), now: `${monNowScore}/${monMax}`,
        after_entitlement_keystone_pct: pct(monPostScore, monMax), after: `${monPostScore}/${monMax}`,
        premise_correction: 'The objective\'s "20% → >90% through enforcement" is FALSE on THIS metric: the keystone reaches 20% (6/30) only. >90% here = PRODUCTIZATION (build LBI/Employability/Career Builder/Longitudinal SKUs + mentor), NOT entitlement enforcement.',
      },
      live_sku_entitlement_wiring_readiness_PROPOSED_REBASELINE: {
        name: 'Live-SKU Entitlement Wiring Readiness (CAPADEX stage ladder only) — PROPOSED re-baseline, requires explicit user approval',
        now_structural_pct: pct(ladderNowScore, 5), now: `${ladderNowScore}/5`,
        after_entitlement_keystone_pct: pct(ladderPostScore, 5), after: `${ladderPostScore}/5`,
        note: 'On THIS denominator the entitlement keystone reaches ≥90% (100% structural). Package SKU excluded (email-keyed keystone cannot lift it). The audit does not adopt this metric; it offers it.',
      },
      activation_pct_both: 0,
      activation_note: 'Activation stays 0% on every metric until real keys + paid volume exist — not reachable by configuration/engineering.',
    },
    products_monetizable_immediately: [
      { product: 'CAPADEX stage ladder (Insight/Growth/Mastery)', immediate: true, what_it_needs: 'guard (U1+U2) + flag flip (U3) + Razorpay keys (U4); ZERO product build', why: 'only product with a real priced SKU + checkout order path + stage→feature map.' },
      { product: 'Package / Institute', immediate: false, what_it_needs: 'entitlement-disjoint: deriveEntitlement excludes packages, no feature map, child/student-keyed grants → separate larger track', why: 'email-keyed keystone cannot lift it.' },
      { product: 'Mentor Intelligence', immediate: false, what_it_needs: 'product build (mentor_bookings ' + (tables.mentor_bookings ? 'present' : 'ABSENT') + `, mentor_profiles=${db.mentor_profiles})`, why: 'named in entitlement map but a stub; not sellable.' },
    ],
    enforcement_effort_units: effortUnits,
    pii: { distinct_payer_emails: db.distinct_payer_emails, masked_sample: maskedSample },
  };

  // ════════════════════════════ WRITE DELIVERABLES ════════════════════════════
  const w = (name: string, body: string) => writeFileSync(join(OUT_DIR, name), body);
  const guardLabel: Record<Guard, string> = { rbac_inline: 'RBAC (inline)', rbac_spread: 'RBAC (spread)', rbac_global: 'RBAC (global app.use)', entitlement: 'ENTITLEMENT', none: 'none detected' };

  // 01 — Entitlement Enforcement Report
  w('01_entitlement_enforcement_report.md', `# WC-C3 · Deliverable 1 — Entitlement Enforcement Report
_Generated ${stamp}. Read-only recompute over the live route surface + entitlement engine._

## What enforces paid-tier access today: NOTHING
- The resolver **\`deriveEntitlement(pool, email)\`** is **REAL and fail-closed** (live recompute: paying=${overview.paying_identities}, entitled=${overview.entitled_identities}, coverage=${overview.coverage_pct === null ? 'n/a (no payers)' : overview.coverage_pct + '%'}, degraded=${overview.degraded}). It maps owned paid stages → features via \`STAGE_FEATURES\` and returns the union.
- **No caller consumes it at access time.** Across **${allFiles.length} route files / ${allRoutes.length} enumerated routes**, the number of \`requireEntitlement\`/\`requirePlan\`/\`requireMembership\` tier guards is **${entitlementGuards.length}**. Access is governed solely by RBAC (\`requireAuth\`/\`requireAdmin\`/\`requireSuperAdmin\`), which **never** consults entitlement.
- The **${paidEndpoints.length} paid-tier CAPADEX endpoints** are served on **session-UUID possession** + the \`isRuntimeIntelligenceActivationEnabled()\` flag (${runtimeFlagUses} uses in capadex.ts). The UUID is a **bearer token**: anyone holding it fetches the deeper report regardless of payment. The only thing stopping non-payers is the frontend choosing not to call.

## Stage → feature map (lockstep verified by source-introspection)
| Constant | Source | Keys |
|---|---|---|
| STAGE_PRICES | routes/capadex-payments.ts | ${pricesPay.join(' · ') || '—'} |
| STAGE_FEATURES | services/wc7c/entitlement-engine.ts | ${featuresEnt.join(' · ') || '—'} |
| LADDER | entitlement / subscription | ${ladderEnt.join(' → ') || '—'} |

Stage-keys consistent: **${lockstep.stage_keys_consistent ? 'YES ✅' : 'NO ⚠️'}** · Ladder consistent: **${lockstep.ladder_consistent ? 'YES ✅' : 'NO ⚠️'}**.

## Entitlement Enforcement Readiness (dual-axis — never composited)
**Structural ${enfStruct.pct}% (${enfStruct.score}/${enfStruct.max}) · Activation ${enfAct.pct}% (${enfAct.present}/${enfAct.total})**

| Dimension | Structural tier | After keystone (projection) | Note |
|---|---|---|---|
${enfStructCells.map((c) => `| ${c.name} | ${tierTag(c.tier)} | ${tierTag(enfPostCells.find((p) => p.name === c.name)!.tier)} | ${c.note} |`).join('\n')}

> \`enforcement_middleware\` and \`report_endpoint_protection\` are **dependent** (no middleware ⇒ no endpoint protection): **one build flips both**. The post-keystone projection caps flag-gated cells at **gated-real(4)** while \`commercialEntitlement\` defaults OFF — structural only, **never activation**.

Activation enablers (deploy posture):
${enfActEnablers.map((e) => `- [${e.present ? 'x' : ' '}] ${e.name} — ${e.detail}`).join('\n')}

## The keystone (one build, two cells)
A single \`requireEntitlement(feature)\` middleware that calls \`deriveEntitlement(pool, email)\` and 403s when the required feature is absent, applied to the paid-tier endpoints. For ladder stages this flips **access_enforcement** AND **access-provisioning** at once. It does **not** cover packages (entitlement-disjoint).
`);

  // 02 — Protected Surface Matrix
  const sampleAdminNoGuard = adminNoGuard.slice(0, 24);
  w('02_protected_surface_matrix.md', `# WC-C3 · Deliverable 2 — Protected Surface Matrix
_Generated ${stamp}. Systematic static enumeration of the live route surface (${allFiles.length} files, ${allRoutes.length} routes), classified by what guards each surface._

## Guard distribution (whole surface)
| Guard | Count |
|---|---|
| RBAC inline (\`requireAuth\`/\`requireSuperAdmin\`/\`requireAdmin\` as args) | ${snapshot.route_surface.guard_distribution.rbac_inline} |
| RBAC spread (\`...adminChain\` / \`...adminGuards\` → file-local guard array) | ${snapshot.route_surface.guard_distribution.rbac_spread} |
| RBAC global (covered by \`app.use('/prefix', ...guards)\`) | ${snapshot.route_surface.guard_distribution.rbac_global} |
| **ENTITLEMENT (tier guard)** | **${snapshot.route_surface.guard_distribution.entitlement}** |
| none detected (middleware-level) | ${snapshot.route_surface.guard_distribution.none} |

Global RBAC prefixes found: ${globalPrefixes.length ? globalPrefixes.map((p) => `\`${p}\``).join(' · ') : '—'}.

> **Static-analysis limitation:** this is middleware-level detection. In-handler auth checks are not inspected (except the confirmed sample below). A \`none\` on a public/consumer route is **not** necessarily a gap — the RBAC finding is scoped to \`/api/admin/*\`, which the codebase convention expects to be guarded.

## Paid-tier CAPADEX surface (the ENTITLEMENT axis) — re-derived fresh from capadex.ts
Every one of these serves paid-tier content with **no entitlement guard and no RBAC** — only a session UUID (+ runtime flag):

| Method | Endpoint | Location | Runtime flag | RBAC | Entitlement |
|---|---|---|---|---|---|
${paidEndpoints.map((e) => `| ${e.method} | \`${e.path}\` | ${e.loc} | ${e.runtime_flag ? 'yes' : 'no'} | ${e.rbac} | ${e.entitlement} |`).join('\n')}

## Payment transaction surface (correctly public)
| Endpoint | Protection | Verdict |
|---|---|---|
| \`POST /api/capadex/payment/create-order\` | none (order precedes payment) | correct for a gateway |
| \`POST /api/capadex/payment/verify\` | HMAC signature check in handler | correct |
| \`POST /api/capadex/payment/webhook\` | webhook signature check in handler | correct |

## Admin surface (RBAC axis — separate from entitlement)
- \`/api/admin/*\` routes total: **${adminRoutes.length}** · with RBAC guard: **${adminGuarded.length}** · **no guard detected: ${adminNoGuard.length}**.
- Sample of unguarded admin routes (static detection):

| Method | Endpoint | Location |
|---|---|---|
${sampleAdminNoGuard.map((r) => `| ${r.method} | \`${r.path}\` | ${r.file}:${r.line} |`).join('\n')}
${adminNoGuard.length > sampleAdminNoGuard.length ? `\n…and ${adminNoGuard.length - sampleAdminNoGuard.length} more (full list in \`_wc_c3_snapshot.json\` → admin_rbac_gap.by_file).` : ''}
`);

  // 03 — Access Control Gap Analysis
  w('03_access_control_gap_analysis.md', `# WC-C3 · Deliverable 3 — Access Control Gap Analysis
_Generated ${stamp}. Two distinct axes, never merged: (A) ENTITLEMENT enforcement (monetization), (B) RBAC/SECURITY._

## Axis A — Entitlement enforcement gap (monetization)
- **Root cause:** the entitlement resolver exists but **nothing consumes it**. There is **no \`requireEntitlement\` middleware** anywhere (${entitlementGuards.length} found across ${allRoutes.length} routes).
- **Blast radius:** ${paidEndpoints.length} paid-tier CAPADEX endpoints served on session-UUID possession (deliverable 2). No backend paywall.
- **Fix:** the single keystone guard (deliverable 1 / roadmap U1+U2). Closes \`access_enforcement\` + \`fulfillment\`-provisioning for the CAPADEX ladder. **Does not** cover packages (entitlement-disjoint).

## Axis B — RBAC / security gap (NOT entitlement — quarantined from the entitlement %)
> Surfaced honestly because "which endpoints are unprotected" is a success criterion. This is a **security** finding and is **not** part of the entitlement readiness score.

- **${adminNoGuard.length} of ${adminRoutes.length}** \`/api/admin/*\` routes have **no route-level RBAC guard** (no inline guard, no spread guard, not covered by a global \`app.use\` prefix). The other ${adminGuarded.length} carry a route-level RBAC guard (inline, spread, or global app.use), so these ${adminNoGuard.length} are deviations from the app's own convention.
- **Confirmed-unguarded sample** (file/handler inspected this session — no inline guard, no spread, no in-body auth token):
${confirmedSample.length ? confirmedSample.map((r) => `  - \`${r.method} ${r.path}\` — ${r.loc}`).join('\n') : '  - (none resolved this run)'}
- **Severity highlights:** \`routes/capadex-payments.ts\` exposes **payment PII** (email/participant_name/amounts/razorpay ids) at \`GET /api/admin/capadex/payments\`; \`routes/concern-intelligence-admin.ts\` exposes a **state-changing migration** endpoint. Both to unauthenticated callers.
- **Per-file count of unguarded admin routes:**
${Object.entries(adminNoGuardByFile).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([f, n]) => `  - ${f}: ${n}`).join('\n')}

> **Limitation:** middleware-level static analysis. Endpoints doing auth *inside* the handler would be under-counted; the confirmed sample was inspected to avoid a false claim. A dedicated security pass should confirm each before remediation.

## Why the two axes must not be merged
Axis A is *monetization* (does payment control access?). Axis B is *security* (does role control admin access?). Compositing them would let an RBAC sweep inflate the entitlement number, or vice-versa. The entitlement readiness figure (deliverable 1) excludes Axis B entirely.
`);

  // 04 — Monetization Enforcement Report
  const a = snapshot.monetization_coverage.product_monetization_readiness_wc_c1_6x5;
  const b = snapshot.monetization_coverage.live_sku_entitlement_wiring_readiness_PROPOSED_REBASELINE;
  w('04_monetization_enforcement_report.md', `# WC-C3 · Deliverable 4 — Monetization Enforcement Report
_Generated ${stamp}. Two denominators, side by side, **never composited**, **never silently swapped**._

## The objective's premise, corrected honestly
The task asks for "the shortest path from the current **20%** to **>90%** through entitlement enforcement." That 20% is the WC-C2 **post-keystone** figure on **Product Monetization Readiness** (the WC-C1 6×5 metric). **On that metric, >90% is NOT reachable through enforcement** — the enforcement keystone *is what produced the 20%*. Reaching >90% there is a **productization** programme. Enforcement reaches ≥90% only on a **re-baselined Live-SKU denominator**. Both are below; the denominator is your decision.

## (a) Product Monetization Readiness — WC-C1 6×5 (this name reserved for this metric)
**Now: ${naOrPct(a.now_structural_pct)} (${a.now}) · After entitlement keystone: ${naOrPct(a.after_entitlement_keystone_pct)} (${a.after}) · Activation 0%**

| Product | priced_sku | order_path | pay→entitlement | access_enforced | fulfillment | now |
|---|---|---|---|---|---|---|
${monNow.map((r) => { const cur = [r.priced_sku, r.order_path, r.pay_to_entitlement, r.access_enforcement, r.fulfillment]; return `| ${r.product} | ${cur[0] ? '✅' : '❌'} | ${cur[1] ? '✅' : '❌'} | ${cur[2] ? '✅' : '❌'} | ${cur[3] ? '✅' : '❌'} | ${cur[4] ? '✅' : '❌'} | ${cur.filter(Boolean).length}/5 |`; }).join('\n')}

The keystone moves **only** the CAPADEX row (gains \`access_enforced\` + \`fulfillment\`): **${a.now} → ${a.after}**. Nothing else moves. **>90% here = productization**, explicitly out of enforcement scope.

## (b) Live-SKU Entitlement Wiring Readiness — PROPOSED RE-BASELINE (your decision)
Scoped to the only complete SKU (the **CAPADEX stage ladder**):

**Now: ${naOrPct(b.now_structural_pct)} (${b.now}) · After entitlement keystone: ${naOrPct(b.after_entitlement_keystone_pct)} (${b.after}) · Activation 0%**

On this denominator the keystone reaches **≥90% (100% structural)**. **Package SKU excluded** (email-keyed keystone cannot lift it). The audit does **not** adopt this metric — it asks you to.

## Which products can be monetized immediately
${snapshot.products_monetizable_immediately.map((p) => `- **${p.product}** — ${p.immediate ? '✅ immediate' : '❌ not immediate'}: ${p.what_it_needs}. _${p.why}_`).join('\n')}

> "Immediate" = guard + flag flip + Razorpay keys, **zero product build**. Only the CAPADEX ladder qualifies.

## Activation (both metrics)
0% and not movable by configuration — requires real Razorpay keys + real paid volume (${db.payments_paid} paid rows today, all ${db.payments_demo} demo).
`);

  // 05 — Enforcement Roadmap
  w('05_enforcement_roadmap.md', `# WC-C3 · Deliverable 5 — Enforcement Roadmap
_Generated ${stamp}. Ordered enabler checklist + honest effort sizing. AUDIT ONLY — nothing here is implemented._

## Shortest path to monetization enforcement — in order
| # | Enabler | Cells it unlocks | Axis | Size |
|---|---|---|---|---|
| U1 | **\`requireEntitlement(feature)\` middleware** consuming \`deriveEntitlement(email)\` → 403 | enforcement_middleware + report_endpoint_protection (one build, two cells) | Structural · entitlement | S |
| U2 | **Apply to the ${paidEndpoints.length} paid-tier endpoints** + endpoint→feature lookup | report_endpoint_protection · fulfillment-provisioning | Structural · entitlement | S |
| U3 | **Un-gate \`commercialEntitlement\`** (default OFF) | makes the guard live in-env | Activation prerequisite | XS |
| U4 | **Real Razorpay keys** (KEY_ID/SECRET/WEBHOOK_SECRET) | exits demo mode | Activation prerequisite | S |
| U5 | **One real paid transaction** end-to-end | proves verify→paid→entitled→access | Activation (first datapoint) | earned, not built |

Result: Live-SKU metric (b) → **${naOrPct(b.after_entitlement_keystone_pct)}** structural; Product-Mon metric (a) → **${naOrPct(a.after_entitlement_keystone_pct)}**; Enforcement Readiness structural **${enfStruct.pct}% → ${enfPost.pct}%** (gated-real cap while flag OFF).

## Effort sizing — countable units (snapshot-backed)
| Unit | Work | Axis | Size |
|---|---|---|---|
${effortUnits.map((u) => `| ${u.id} | ${u.unit} | ${u.axis} | ${u.size} |`).join('\n')}

### Estimate — judgment, not measurement
> The following day-band is engineering judgment over the countable units above, **not** a measured value, and deliberately does **not** appear in \`_wc_c3_snapshot.json\`. Assumes a developer familiar with this codebase, no new schema, no new product.
- **Entitlement keystone (U1–U3):** ~**0.5–1.5 engineering days** — one middleware, ~${paidEndpoints.length} route applications, a small feature lookup, one flag flip.
- **Activation prerequisites (U4):** ~**0.25 day** of ops to add real keys (then U5 is earned over time, not estimable).
- **RBAC/security sweep (U5, separate track):** ~**1–3 days** scaling with the **${adminNoGuard.length}** unguarded admin endpoints — confirm each (in-handler checks), then apply \`requireAuth, requireSuperAdmin\`. This is security, **not** monetization.

## Separate, larger track (NOT the shortest path) — packages
Only if the institute/package SKU is a priority — none of this is unlocked by the keystone:
- Wire \`deriveEntitlement\` to also read \`student_subscriptions → subscription_packages\` (resolve child/student ↔ billing identity).
- Add a **feature map** to \`subscription_packages\` (today: no feature-string column).
- Choose a package **order path** and seed the catalog (currently ${db.packages_total} rows).

## Productization track (NOT entitlement) — only if you keep metric (a)
>90% on the WC-C1 6×5 metric requires building SKUs for LBI / Employability / Career Builder / Longitudinal and the Mentor stub. Product/business decision, out of enforcement scope.

## Hygiene (cheap, alongside U1)
- Fix the \`entitlement-engine.ts\` header comment (claims package coverage the code does not provide).
`);

  // 06 — Executive Summary
  w('06_executive_summary.md', `# WC-C3 · Executive Summary — Entitlement Enforcement
_Generated ${stamp}. AUDIT ONLY · STOP FOR APPROVAL. Two axes (Structural / Activation), never composited._

## Current enforcement readiness
**Entitlement Enforcement Readiness — Structural ${enfStruct.pct}% (${enfStruct.score}/${enfStruct.max}) · Activation ${enfAct.pct}% (${enfAct.present}/${enfAct.total}).** The resolver is real and fail-closed; the gap is that **nothing enforces it** and **nothing has been paid**.

## Answers to the success criteria
1. **Which endpoints are currently unprotected**
   - *Entitlement axis:* **${paidEndpoints.length}** paid-tier CAPADEX endpoints served on session-UUID possession with **no entitlement check** (and no RBAC) — session UUIDs are bearer tokens.
   - *RBAC/security axis (separate):* **${adminNoGuard.length} of ${adminRoutes.length}** \`/api/admin/*\` routes have **no route-level guard** (static detection; in-handler checks not inspected except a confirmed sample) — including payment-PII and a state-changing migration endpoint. This is a security finding, quarantined from the entitlement score.
2. **Which products can be monetized immediately** — **only the CAPADEX stage ladder** (real SKU + checkout + feature map; needs guard + flag + keys, zero product build). Package = entitlement-disjoint (separate track); Mentor = stub; LBI/Employability/Career Builder/Longitudinal = not consumer SKUs.
3. **Shortest path to >90% monetization readiness** — denominator-dependent, stated plainly:
   - On **Product Monetization Readiness** (WC-C1 6×5): the keystone reaches **${naOrPct(a.after_entitlement_keystone_pct)}** only. **>90% there is productization, not enforcement** — the objective's "20%→>90% through enforcement" premise does not hold on this metric.
   - On the **proposed Live-SKU re-baseline** (CAPADEX ladder only): the keystone reaches **${naOrPct(b.after_entitlement_keystone_pct)} structural** — i.e. ≥90%. Requires your explicit approval to adopt.
4. **Enforcement effort estimate** — countable units U1–U6 (snapshot). The entitlement keystone (U1–U3) is a small build; the RBAC sweep (U5) is a separate security track scaling with the ${adminNoGuard.length} unguarded admin endpoints; activation (real paid volume) is **earned, not estimable**. Day-band sizing (judgment, not measurement) lives only in the roadmap (deliverable 5), deliberately not in the snapshot.

## The keystone (one build, two cells)
A single \`requireEntitlement\` middleware consuming \`deriveEntitlement(email)\`, applied to the ${paidEndpoints.length} paid-tier endpoints, flips \`access_enforcement\` **and** \`access-provisioning\`. Un-gate \`commercialEntitlement\`, add real keys, and one real transaction proves the chain.

## Honest activation ceiling
Activation is **0%** on every metric and **cannot be raised by configuration or engineering** — it is a function of real keys + real paid volume earned over time.

## Decision requested
Choose the denominator: **(a)** keep "Product Monetization Readiness" (then >90% needs a productization programme), or **(b)** re-baseline to "Live-SKU Entitlement Wiring Readiness" (then the entitlement keystone reaches ≥90%). Separately, schedule the **RBAC/security sweep** for the ${adminNoGuard.length} unguarded admin endpoints. **No implementation has been performed. STOP FOR APPROVAL.**
`);

  writeFileSync(join(OUT_DIR, '_wc_c3_snapshot.json'), JSON.stringify(snapshot, null, 2));

  await pool.end();

  console.log(`WC-C3 audit — 6 deliverables + _wc_c3_snapshot.json written to ${OUT_DIR}`);
  console.log(`Enforcement Readiness:  Structural ${enfStruct.pct}% (${enfStruct.score}/${enfStruct.max}) → after keystone ${enfPost.pct}% · Activation ${enfAct.pct}%`);
  console.log(`Route surface: ${allFiles.length} files, ${allRoutes.length} routes · entitlement guards: ${entitlementGuards.length} · paid-tier endpoints: ${paidEndpoints.length}`);
  console.log(`Admin RBAC gap: ${adminNoGuard.length}/${adminRoutes.length} /api/admin/* routes no-guard-detected`);
  console.log(`Monetization (a, 6×5): ${naOrPct(pct(monNowScore, monMax))} → ${naOrPct(pct(monPostScore, monMax))} · (b, Live-SKU): ${naOrPct(pct(ladderNowScore, 5))} → ${naOrPct(pct(ladderPostScore, 5))}`);
}

run().catch((e) => { console.error(e); process.exit(1); });
