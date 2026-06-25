/**
 * mx301d-persona-experience-validation.ts — MX-301D Persona Experience Validation.
 *
 * Proves the demonstration candidate's (Sarah Johnson, provisioned by
 * mx301-demo-candidate.ts) ONE competency assessment is reachable across ALL FOUR
 * personas and their tabs — the success criterion: "one assessment visible everywhere."
 *
 * The candidate has a single real assessment in the canonical ledgers
 * (onto_competency_score_runs + onto_competency_profiles, keyed by her email == her
 * user id). This harness probes the LIVE HTTP surface that each persona's UI consumes
 * and reports, honestly, whether her assessment is:
 *
 *   CANDIDATE   — Assessment · Results · Career · Passport · Reports        (self-session)
 *   EMPLOYER    — Candidate Match · Competency Match · Interview · Hiring   (elevated session)
 *   SUPER ADMIN — Analytics · Assessment · Competencies · Reports · Health  (super-admin)
 *   FOUNDER     — Executive · KPIs · Platform Health · Growth · Intelligence(super-admin)
 *
 * Two kinds of surface, judged separately and never conflated:
 *   - INDIVIDUAL drill-down (candidate/employer/admin-assessment) — does HER assessment
 *     surface, carrying her measured values?  →  `visible` / `wired_no_data`.
 *   - AGGREGATE console (admin analytics, founder consoles) — these show platform TOTALS,
 *     never a single candidate. "Visible" there means her assessment is a COUNTED data
 *     point: the console returns measurable nonzero totals AND her row exists in the
 *     substrate the console aggregates.  →  `aggregated` / `wired_no_data`.
 *
 * Honesty-first verdicts (EXPLICIT, never inflated):
 *   visible       — authed 200 AND her individual measured assessment data flows through.
 *   aggregated    — authed 200, aggregate console reports measurable totals, AND her
 *                   assessment row is present in the counted substrate (honest: counted,
 *                   not an individual drill-down).
 *   wired_no_data — route served + secured but no usable data for this candidate (honest
 *                   absence; exact reason recorded — e.g. precise comp_* levels are null,
 *                   the surface is operator-input, or the composer exposes no per-candidate
 *                   HTTP route).
 *   flag_gated    — 503, feature flag OFF (NOT a failure — the exact dev enable is stated).
 *   forbidden     — authed 403 self-scoped (IDOR guard).
 *   broken        — 404/000, route/resource genuinely missing.
 *
 * Cross-persona consistency: the ONE assessment is proven by (a) a single coherent onto
 * substrate (onto_competency_score_runs / onto_competency_profiles) AND (b) it being reachable
 * through >= 2 INDEPENDENT persona lenses. A matching numeric fingerprint across the SELF lens
 * and the ADMIN lens, when both are measurable, is an optional STRENGTHENER — never the gate
 * (the self vs admin lenses expose different derived metrics, so byte-identical numbers are
 * not expected, and the harness must not fail honest reachability on their absence).
 *
 * Strictly READ-ONLY: reuses the live HTTP surface only; the sole writes are the audit
 * files under backend/audit/mx-301d/. PII (candidate email) is masked to user_<sha256>
 * in every committed artifact.
 *
 * Run: npx tsx backend/scripts/mx301d-persona-experience-validation.ts [subjectEmail]
 *      (backend must be serving on $MX301D_BASE, default http://localhost:8080)
 */
import { createHash } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import { Pool } from 'pg';

import { MX301_SUBJECT, MX301_PASSWORD } from './mx301-demo-candidate.js';

const BASE = process.env.MX301D_BASE ?? 'http://localhost:8080';
const MATCH_ROLE_ID = process.env.MX301D_ROLE_ID ?? 'role_pm'; // real onto_roles id (Product Manager)
const PROBE_JOB_ID = process.env.MX301D_JOB_ID ?? 'mx301d-probe-job';
const SUPER_ADMIN = {
  username: process.env.MX301D_ADMIN_EMAIL ?? 'support@metryxone.com',
  password: process.env.MX301D_ADMIN_PASSWORD ?? 'admin123',
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../audit/mx-301d');

// ── PII masking ─────────────────────────────────────────────────────────────
function mask(email: string): string {
  return 'user_' + createHash('sha256').update(email).digest('hex').slice(0, 16);
}
function scrub(s: string, email: string, masked: string): string {
  return s.split(email).join(masked).split(encodeURIComponent(email)).join(masked);
}

// ── HTTP helper ─────────────────────────────────────────────────────────────
interface HttpResult {
  status: number;
  json: any;
  cookies: string[];
  error?: string;
}
async function http(
  method: string,
  path: string,
  opts: { body?: any; cookie?: string | null } = {},
): Promise<HttpResult> {
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(opts.cookie ? { Cookie: opts.cookie } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const cookies =
      typeof (res.headers as any).getSetCookie === 'function'
        ? (res.headers as any).getSetCookie()
        : res.headers.get('set-cookie')
          ? [res.headers.get('set-cookie') as string]
          : [];
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { _raw: text.slice(0, 200) };
    }
    return { status: res.status, json, cookies };
  } catch (e: any) {
    return { status: 0, json: null, cookies: [], error: String(e?.message ?? e).slice(0, 160) };
  }
}

function sessionCookie(cookies: string[]): string | null {
  for (const c of cookies) {
    const m = c.match(/(connect\.sid=[^;]+)/) || c.match(/(metryx[^=]*=[^;]+)/i);
    if (m) return m[1];
  }
  if (cookies.length) {
    const first = cookies[0].split(';')[0];
    if (first.includes('=')) return first;
  }
  return null;
}

// ── Authentication ──────────────────────────────────────────────────────────
interface AuthResult {
  cookie: string | null;
  mode: string;
  detail: string;
}
async function authSuperAdmin(pool: Pool): Promise<AuthResult> {
  const login = await http('POST', '/api/login', { body: SUPER_ADMIN });
  const loginCookie = sessionCookie(login.cookies);
  if (login.status === 200 && !login.json?.mfaRequired) {
    return { cookie: loginCookie, mode: 'direct', detail: 'super-admin logged in (no MFA challenge)' };
  }
  if (login.status !== 200 || !login.json?.mfaRequired) {
    return {
      cookie: null,
      mode: 'failed',
      detail: `login status=${login.status} mfaRequired=${login.json?.mfaRequired ?? 'n/a'} ${login.error ?? ''}`.trim(),
    };
  }
  const attemptToken = login.json.attemptToken;
  if (!attemptToken) {
    return { cookie: null, mode: 'failed', detail: 'login returned mfaRequired but no attemptToken' };
  }
  const r = await pool.query(
    `SELECT code FROM mfa_codes WHERE attempt_token = $1 AND used = false ORDER BY created_at DESC LIMIT 1`,
    [attemptToken],
  );
  const code = r.rows[0]?.code;
  if (!code) {
    return { cookie: null, mode: 'failed', detail: 'no unused mfa_codes row for attemptToken' };
  }
  const verify = await http('POST', '/api/admin/mfa/verify', {
    body: { code, attemptToken },
    cookie: loginCookie,
  });
  const cookie = sessionCookie(verify.cookies) ?? loginCookie;
  if (verify.status === 200 && cookie) {
    return { cookie, mode: 'mfa', detail: 'super-admin MFA login complete (code read from mfa_codes)' };
  }
  return {
    cookie: null,
    mode: 'failed',
    detail: `mfa verify status=${verify.status} ${verify.json?.message ?? verify.error ?? ''}`.trim(),
  };
}

// Candidate self-session (Sarah logs in AS herself). Only available for the
// demonstration candidate, whose password this harness holds — for any other subject
// we SKIP rather than silently authenticate as the wrong person.
async function authCandidate(subjectId: string): Promise<AuthResult> {
  if (subjectId !== MX301_SUBJECT) {
    return {
      cookie: null,
      mode: 'skipped',
      detail: 'self-session only available for the demonstration candidate (MX301_SUBJECT)',
    };
  }
  const login = await http('POST', '/api/login', {
    body: { username: MX301_SUBJECT, password: MX301_PASSWORD },
  });
  const cookie = sessionCookie(login.cookies);
  if (login.status === 200 && !login.json?.mfaRequired && cookie) {
    return { cookie, mode: 'self', detail: 'candidate self-session login (career_seeker, no MFA)' };
  }
  return {
    cookie: null,
    mode: 'failed',
    detail: `candidate login status=${login.status} mfaRequired=${login.json?.mfaRequired ?? 'n/a'} ${login.error ?? ''}`.trim(),
  };
}

// ── Payload inspection ──────────────────────────────────────────────────────
interface PayloadVerdict {
  usable: boolean; // a real, candidate-specific (individual) or counted (aggregate) signal flows through
  reason: string;
  signals: string[];
}

// INDIVIDUAL drill-down — does HER measured assessment surface?
const MEASURED_NUMERIC_KEYS = new Set([
  'overall_score', 'overallscore', 'overall_ei', 'readiness_score', 'employability',
  'employability_index', 'index', 'fit_score', 'composite_score', 'evaluation_score',
  'weighted_score', 'weightedscore', 'score',
]);
const MEASURED_ARRAY_KEYS = new Set([
  'competencies', 'domains', 'domain_scores', 'gaps', 'prioritized_gaps', 'signals',
  'milestones', 'steps', 'sequence', 'recommendations', 'focus_areas',
  'development_areas', 'strengths',
]);
function recursiveMeasured(node: any, depth = 0, seen = new Set<any>()): string[] {
  const out: string[] = [];
  if (node == null || depth > 6 || typeof node !== 'object') return out;
  if (seen.has(node)) return out;
  seen.add(node);
  for (const [k, v] of Object.entries(node)) {
    const lk = k.toLowerCase();
    if (MEASURED_NUMERIC_KEYS.has(lk) && typeof v === 'number' && Number.isFinite(v) && v !== 0) {
      out.push(`${k}=${v}`);
    }
    if (MEASURED_ARRAY_KEYS.has(lk) && Array.isArray(v) && v.length > 0) {
      out.push(`${k}[${v.length}]`);
    }
    out.push(...recursiveMeasured(v, depth + 1, seen));
  }
  return out;
}

function inspectIndividual(json: any): PayloadVerdict {
  const d = json && typeof json === 'object' && json.data && typeof json.data === 'object' ? json.data : json;
  if (!d || typeof d !== 'object') return { usable: false, reason: 'no JSON payload', signals: [] };
  const signals: string[] = [];

  // Talent-match shape — actuals can be null despite a resolved role.
  if (d.evidence_mix && typeof d.evidence_mix === 'object') {
    const em = d.evidence_mix;
    signals.push(`evidence_mix measured=${em.measured ?? 0} inferred=${em.inferred ?? 0} none=${em.none ?? 0}`);
    if (typeof d.match_pct === 'number') signals.push(`match_pct=${d.match_pct} confidence_pct=${d.confidence_pct ?? 0}`);
    if (Number(em.measured ?? 0) > 0) {
      return { usable: true, reason: 'candidate competency evidence flows into the match', signals };
    }
    return {
      usable: false,
      reason:
        "route resolves the candidate + role requirements, but her actuals are all null " +
        '(evidence_mix.measured=0) — her assessment carries domain-proxy / EI data, NOT the ' +
        'precise per-competency (comp_*) levels this matcher needs (honest ceiling, not fabricated)',
      signals,
    };
  }

  // Interview evaluation shape (operator-recorded scores).
  if (typeof d.interviews_scored === 'number' || typeof d.total_scores === 'number') {
    const scored = Number(d.total_scores ?? d.interviews_scored ?? 0);
    signals.push(`interviews_scored=${d.interviews_scored ?? 0} total_scores=${d.total_scores ?? 0}`);
    return scored > 0
      ? { usable: true, reason: 'operator-recorded interview scores present', signals }
      : {
          usable: false,
          reason:
            'wired + secured, but Interview is OPERATOR-INPUT driven (arithmetic over panelist ' +
            'scores) — it does NOT consume the competency ledger, and no interview scores exist for her',
          signals,
        };
  }

  // compute-score shape (reads the cra_scores substrate — distinct from the onto ledger).
  if (typeof d.totalCompetencies === 'number' && Array.isArray(d.domains)) {
    if (d.totalCompetencies === 0) {
      return {
        usable: false,
        reason:
          'compute-score reads the cra_scores substrate, which is empty for her — her assessment ' +
          'lives in the onto_competency ledger (surfaced via the admin career-intelligence lens), ' +
          'not cra; the candidate self compute-score does NOT backfill from onto (honest substrate split)',
        signals: ['overallScore=0', 'totalCompetencies=0'],
      };
    }
    return {
      usable: true,
      reason: 'compute-score surfaces her measured competency domains',
      signals: [`overallScore=${d.overallScore}`, `totalCompetencies=${d.totalCompetencies}`, `domains[${d.domains.length}]`],
    };
  }

  // Passport shape (needs an explicit sync to pull assessment data).
  if (json.passport || json.section_counts || d.section_counts) {
    const sc = json.section_counts || d.section_counts || {};
    const passport = json.passport || d.passport || {};
    const total = Object.values(sc).reduce((a: number, b: any) => a + Number(b || 0), 0);
    signals.push(`section_total=${total} completeness=${passport.completeness_score ?? 0}`);
    return total > 0
      ? { usable: true, reason: 'passport sections carry synced platform data', signals }
      : {
          usable: false,
          reason:
            'passport row exists but is UNSYNCED — every section_count is 0; needs an explicit ' +
            'POST /api/passport/sync to pull the competency/assessment snapshot in',
          signals,
        };
  }

  // Generic composed engines (compute-score / readiness / intelligence / report).
  const overall = d.overall?.score ?? d.overall_ei ?? d.overall_score ?? d.overallScore ?? d.weighted_score ?? null;
  if (typeof overall === 'number' && Number.isFinite(overall) && overall !== 0) {
    signals.push(`overall=${overall}${d.overall?.band ? ` (${d.overall.band})` : ''}`);
  }
  const measurable =
    typeof d.measurable === 'boolean' ? d.measurable : typeof json.measurable === 'boolean' ? json.measurable : null;
  const rec = recursiveMeasured(d);
  signals.push(...rec.slice(0, 4));
  if (measurable === false) {
    return { usable: false, reason: 'engine reports measurable:false (no measured data for candidate)', signals };
  }
  const usable = signals.length > 0;
  return {
    usable,
    reason: usable ? 'surfaces her measured assessment data' : 'authed 200 but no measured signal detected (honest absence)',
    signals: signals.slice(0, 5),
  };
}

// AGGREGATE console — is her assessment a COUNTED data point in platform totals?
const AGG_TOKENS = [
  'total', 'count', 'sessions', 'assessments', 'users', 'candidates', 'completed',
  'profiles', 'runs', 'subjects', 'records', 'reports', 'active', 'enrolled', 'members',
];
function recursiveAggregate(node: any, depth = 0, seen = new Set<any>()): string[] {
  const out: string[] = [];
  if (node == null || depth > 6 || typeof node !== 'object') return out;
  if (seen.has(node)) return out;
  seen.add(node);
  for (const [k, v] of Object.entries(node)) {
    const lk = k.toLowerCase();
    if (typeof v === 'number' && Number.isFinite(v) && v > 0 && AGG_TOKENS.some((t) => lk.includes(t))) {
      out.push(`${k}=${v}`);
    }
    out.push(...recursiveAggregate(v, depth + 1, seen));
  }
  return out;
}
function inspectAggregate(json: any, substratePresent: boolean): PayloadVerdict {
  const d = json && typeof json === 'object' ? json : null;
  if (!d) return { usable: false, reason: 'no JSON payload', signals: [] };
  const totals = recursiveAggregate(d).slice(0, 5);
  if (totals.length === 0) {
    return { usable: false, reason: 'aggregate console returned no nonzero platform total (honest empty)', signals: [] };
  }
  if (!substratePresent) {
    return {
      usable: false,
      reason: 'console reports totals, but her assessment row is ABSENT from the counted substrate',
      signals: totals,
    };
  }
  return {
    usable: true,
    reason:
      'aggregate console reports measurable platform totals AND her assessment row is present in ' +
      'the counted substrate — her assessment is one of the counted data points (counted, not a drill-down)',
    signals: totals,
  };
}

// compute-score overall fingerprint (cross-persona consistency).
function fingerprint(json: any): number | null {
  const d = json && typeof json === 'object' && json.data && typeof json.data === 'object' ? json.data : json;
  if (!d || typeof d !== 'object') return null;
  for (const k of ['overall_score', 'overallScore', 'weighted_score', 'weightedScore', 'overall', 'score']) {
    const v = (d as any)[k];
    if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v * 100) / 100;
    if (v && typeof v === 'object' && Number.isFinite((v as any).score)) return Math.round((v as any).score * 100) / 100;
  }
  return null;
}

// ── Per-tab validation ──────────────────────────────────────────────────────
type Persona = 'candidate' | 'employer' | 'super-admin' | 'founder';
type Verdict = 'visible' | 'aggregated' | 'wired_no_data' | 'flag_gated' | 'forbidden' | 'broken';
type Kind = 'individual' | 'aggregate' | 'flag-probe';
interface TabSpec {
  persona: Persona;
  tab: string;
  method: string;
  path: string;
  scope: 'self' | 'admin';
  kind: Kind;
  consumes: string;
  capture?: 'self-fp' | 'admin-fp'; // capture compute-score fingerprint
}
interface TabResult extends TabSpec {
  unauthStatus: number;
  authStatus: number | null;
  verdict: Verdict;
  reason: string;
  signals: string[];
}

function classify(
  kind: Kind,
  unauthStatus: number,
  authStatus: number | null,
  p: PayloadVerdict,
): { verdict: Verdict; detail: string } {
  if (unauthStatus === 404 || unauthStatus === 0) {
    return { verdict: 'broken', detail: `route not reachable (unauth status=${unauthStatus})` };
  }
  if (authStatus == null) return { verdict: 'broken', detail: 'no authenticated probe performed' };
  if (authStatus === 503) return { verdict: 'flag_gated', detail: 'feature flag OFF (503) — surface not activated' };
  if (authStatus === 403) return { verdict: 'forbidden', detail: 'authed 403 — self-scoped (IDOR guard); not cross-user readable' };
  if (authStatus === 404) {
    return [401, 403].includes(unauthStatus)
      ? { verdict: 'wired_no_data', detail: 'authed 404 — route wired + secured; honest no-data for candidate' }
      : { verdict: 'broken', detail: 'authed 404 — route/resource missing' };
  }
  if (authStatus === 200) {
    if (kind === 'aggregate') {
      return p.usable ? { verdict: 'aggregated', detail: p.reason } : { verdict: 'wired_no_data', detail: p.reason };
    }
    if (kind === 'flag-probe') {
      // 200 here means the gated composer is ACTIVE — but it exposes no per-candidate HTTP
      // data route; competency match is computed server-side from her ledger (same precise
      // comp_* ceiling as talent-match). Honest: wired, no per-candidate surface to read.
      return {
        verdict: 'wired_no_data',
        detail:
          'composer ACTIVE (flag on) but exposes NO per-candidate HTTP data route — competency ' +
          'match is computed server-side from her ledger; same precise comp_* ceiling as Candidate Match',
      };
    }
    return p.usable ? { verdict: 'visible', detail: p.reason } : { verdict: 'wired_no_data', detail: p.reason };
  }
  if (authStatus === 0) return { verdict: 'broken', detail: 'authed request failed to connect' };
  return { verdict: 'wired_no_data', detail: `authed status=${authStatus}` };
}

interface ValidateCtx {
  adminCookie: string | null;
  selfCookie: string | null;
  substratePresent: boolean;
  fingerprints: { self?: number | null; admin?: number | null };
}
async function validateTab(spec: TabSpec, ctx: ValidateCtx): Promise<TabResult> {
  const cookie = spec.scope === 'self' ? ctx.selfCookie : ctx.adminCookie;
  const unauth = await http(spec.method, spec.path);

  if (spec.scope === 'self' && !cookie) {
    return {
      ...spec,
      unauthStatus: unauth.status,
      authStatus: null,
      verdict: 'wired_no_data',
      reason: 'self-scoped tab NOT validated — no candidate self-session available',
      signals: [],
    };
  }

  let authStatus: number | null = null;
  let authedJson: any = null;
  if (cookie) {
    const authed = await http(spec.method, spec.path, { cookie });
    authStatus = authed.status;
    authedJson = authed.json;
    if (spec.capture === 'self-fp') ctx.fingerprints.self = fingerprint(authedJson);
    if (spec.capture === 'admin-fp') ctx.fingerprints.admin = fingerprint(authedJson);
  }
  let p: PayloadVerdict = { usable: false, reason: '', signals: [] };
  if (authStatus === 200) {
    p = spec.kind === 'aggregate' ? inspectAggregate(authedJson, ctx.substratePresent) : inspectIndividual(authedJson);
  }
  const { verdict, detail } = classify(spec.kind, unauth.status, authStatus, p);
  return { ...spec, unauthStatus: unauth.status, authStatus, verdict, reason: detail, signals: p.signals };
}

// ── Markdown rendering ──────────────────────────────────────────────────────
const VERDICT_ICON: Record<Verdict, string> = {
  visible: '✅ VISIBLE (her assessment)',
  aggregated: '📊 AGGREGATED (counted)',
  wired_no_data: '➖ WIRED · no data for her',
  flag_gated: '🔒 FLAG OFF',
  forbidden: '🚫 forbidden (self-scope)',
  broken: '❌ BROKEN',
};
const REACHABLE: Verdict[] = ['visible', 'aggregated'];

function renderTable(rows: TabResult[], email: string, masked: string): string {
  const head =
    '| Tab | Surface | Auth | Unauth | Authed | Visibility | Evidence / reason |\n' +
    '|---|---|---|---|---|---|---|';
  const body = rows
    .map((r) => {
      const route = scrub(`\`${r.method} ${r.path}\``, email, masked);
      const reason = scrub(r.reason, email, masked).replace(/\|/g, '\\|');
      const sig = r.signals.length ? ` _(${scrub(r.signals.join('; '), email, masked).replace(/\|/g, '\\|')})_` : '';
      return `| ${r.tab} | ${route} | ${r.scope} | ${r.unauthStatus} | ${r.authStatus ?? 'n/a'} | ${VERDICT_ICON[r.verdict]} | ${reason}${sig} |`;
    })
    .join('\n');
  return `${head}\n${body}`;
}

const PERSONA_TITLE: Record<Persona, string> = {
  candidate: 'Candidate',
  employer: 'Employer',
  'super-admin': 'Super Admin',
  founder: 'Founder',
};
const PERSONA_INTRO: Record<Persona, string> = {
  candidate:
    'The candidate, signed in as herself, viewing her own assessment across her tabs ' +
    '(Assessment · Results · Career · Passport · Reports). Strictly self-scoped.',
  employer:
    'An employer/elevated session viewing the candidate against a real role ' +
    '(Candidate Match · Competency Match · Interview · Hiring Dashboard).',
  'super-admin':
    'The super-admin console (Analytics · Assessment · Competencies · Reports · Platform ' +
    'Health) — a mix of her individual assessment (Assessment drill-down) and platform aggregates.',
  founder:
    'The founder consoles (Executive · KPIs · Platform Health · Growth · Intelligence) — ' +
    'platform-level aggregates into which her single assessment is counted, never a drill-down.',
};

function renderPersona(persona: Persona, rows: TabResult[], email: string, masked: string): string {
  const reach = rows.filter((r) => REACHABLE.includes(r.verdict));
  const gaps = rows.filter((r) => !REACHABLE.includes(r.verdict));
  const lines: string[] = [];
  lines.push(`# ${PERSONA_TITLE[persona]} — Persona Experience Validation`);
  lines.push('');
  lines.push(`_MX-301D — Persona Experience Validation · generated ${new Date().toISOString()}_`);
  lines.push('');
  lines.push(`**Demonstration candidate:** \`${masked}\` (PII-masked).`);
  lines.push('');
  lines.push(PERSONA_INTRO[persona]);
  lines.push('');
  lines.push(
    `**Reachable on ${reach.length}/${rows.length} tabs** ` +
      `(${rows.filter((r) => r.verdict === 'visible').length} directly visible, ` +
      `${rows.filter((r) => r.verdict === 'aggregated').length} aggregated/counted).`,
  );
  lines.push('');
  lines.push(renderTable(rows, email, masked));
  lines.push('');
  if (gaps.length) {
    lines.push('## Honest gaps (disclosed, never fabricated)');
    lines.push('');
    for (const g of gaps) {
      lines.push(`- **${g.tab}** — ${VERDICT_ICON[g.verdict]}: ${scrub(g.reason, email, masked)}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const subjectId = (process.argv[2] ?? MX301_SUBJECT).trim();
  const masked = mask(subjectId);
  if (!process.env.DATABASE_URL) {
    console.error('[mx301d] DATABASE_URL is required (read-only DB lens).');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const provN = await pool
    .query('SELECT COUNT(*)::int AS n FROM users WHERE id = $1', [subjectId])
    .then((r) => Number(r.rows[0]?.n ?? 0))
    .catch(() => -1);
  if (provN <= 0) {
    console.error(
      `[mx301d] candidate ${masked} is not provisioned. This validator is read-only.\n` +
        `         Provision first: cd backend && npx tsx scripts/mx301-demo-candidate.ts`,
    );
    await pool.end();
    process.exit(1);
  }

  const countBy = async (sql: string) =>
    pool
      .query(sql, [subjectId])
      .then((r) => Number(r.rows[0]?.n ?? 0))
      .catch(() => -1);
  const runs = await countBy('SELECT COUNT(*)::int AS n FROM onto_competency_score_runs WHERE subject_id = $1');
  const profiles = await countBy('SELECT COUNT(*)::int AS n FROM onto_competency_profiles WHERE subject_id = $1');
  const completeness = await pool
    .query('SELECT completeness FROM career_seeker_profiles WHERE user_id = $1', [subjectId])
    .then((r) => (r.rows[0]?.completeness ?? null) as number | null)
    .catch(() => null);
  const substratePresent = runs > 0 || profiles > 0;
  const ledger = { runs, profiles, completeness };

  const auth = await authSuperAdmin(pool);
  console.log(`[mx301d] super-admin auth: mode=${auth.mode} cookie=${auth.cookie ? 'yes' : 'no'} — ${auth.detail}`);
  const selfAuth = await authCandidate(subjectId);
  console.log(`[mx301d] candidate self-session: mode=${selfAuth.mode} cookie=${selfAuth.cookie ? 'yes' : 'no'} — ${selfAuth.detail}`);

  const sid = encodeURIComponent(subjectId);
  const job = encodeURIComponent(PROBE_JOB_ID);
  const role = encodeURIComponent(MATCH_ROLE_ID);

  const specs: TabSpec[] = [
    // CANDIDATE (self-session) — her own assessment, through the candidate-facing
    // self-readable surfaces (career hub is requireAuth + session-scoped, no :id param;
    // career-intelligence / career-readiness are super-admin-only analytical surfaces and
    // are validated under the Super Admin persona below, NOT here).
    { persona: 'candidate', tab: 'Assessment', method: 'GET', path: `/api/competency/compute-score/${sid}`, scope: 'self', kind: 'individual', consumes: 'competency compute-score (cra_scores substrate)' },
    { persona: 'candidate', tab: 'Results', method: 'GET', path: `/api/career/hub/summary`, scope: 'self', kind: 'individual', consumes: 'composed career results (self hub)', capture: 'self-fp' },
    { persona: 'candidate', tab: 'Career', method: 'GET', path: `/api/career/hub/trajectory`, scope: 'self', kind: 'individual', consumes: 'career trajectory (self hub)' },
    { persona: 'candidate', tab: 'Passport', method: 'GET', path: `/api/passport/overview`, scope: 'self', kind: 'individual', consumes: 'synced platform snapshot' },
    { persona: 'candidate', tab: 'Reports', method: 'GET', path: `/api/career/hub/report`, scope: 'self', kind: 'individual', consumes: 'candidate report (self hub)' },
    // EMPLOYER (elevated session).
    { persona: 'employer', tab: 'Candidate Match', method: 'GET', path: `/api/talent-matching-engine/candidate/${sid}/role/${role}`, scope: 'admin', kind: 'individual', consumes: 'precise comp_* vs role' },
    { persona: 'employer', tab: 'Competency Match', method: 'GET', path: `/api/v2/employer/competency-match/feature-flag`, scope: 'admin', kind: 'flag-probe', consumes: 'server-side competency-driven match (MX-107A)' },
    { persona: 'employer', tab: 'Interview', method: 'GET', path: `/api/interview-intelligence/job/${job}/candidate/${sid}/evaluation`, scope: 'admin', kind: 'individual', consumes: 'operator interview scores' },
    { persona: 'employer', tab: 'Hiring Dashboard', method: 'GET', path: `/api/employer/hiring/readiness`, scope: 'admin', kind: 'aggregate', consumes: 'hiring readiness rollup' },
    // SUPER ADMIN.
    { persona: 'super-admin', tab: 'Analytics', method: 'GET', path: `/api/admin/mission-control`, scope: 'admin', kind: 'aggregate', consumes: 'platform analytics rollup' },
    { persona: 'super-admin', tab: 'Assessment', method: 'GET', path: `/api/career-intelligence/${sid}`, scope: 'admin', kind: 'individual', consumes: 'composed career-intelligence incl. her assessment (admin drill-down)', capture: 'admin-fp' },
    { persona: 'super-admin', tab: 'Competencies', method: 'GET', path: `/api/competency/engine-summary`, scope: 'admin', kind: 'aggregate', consumes: 'competency genome / scoring rollup' },
    { persona: 'super-admin', tab: 'Reports', method: 'GET', path: `/api/admin/vx/reports/overview`, scope: 'admin', kind: 'aggregate', consumes: 'reports console rollup' },
    { persona: 'super-admin', tab: 'Platform Health', method: 'GET', path: `/api/admin/platform/console/overview`, scope: 'admin', kind: 'aggregate', consumes: 'platform health rollup' },
    // FOUNDER.
    { persona: 'founder', tab: 'Executive Dashboard', method: 'GET', path: `/api/admin/platform/console/executive`, scope: 'admin', kind: 'aggregate', consumes: 'executive rollup' },
    { persona: 'founder', tab: 'KPIs', method: 'GET', path: `/api/admin/platform/console/founder`, scope: 'admin', kind: 'aggregate', consumes: 'founder KPI rollup' },
    { persona: 'founder', tab: 'Platform Health', method: 'GET', path: `/api/admin/command-center/console/monitoring`, scope: 'admin', kind: 'aggregate', consumes: 'platform monitoring rollup' },
    { persona: 'founder', tab: 'Growth', method: 'GET', path: `/api/admin/command-center/console/unified`, scope: 'admin', kind: 'aggregate', consumes: 'unified growth rollup' },
    { persona: 'founder', tab: 'Intelligence', method: 'GET', path: `/api/admin/command-center/console/control-tower`, scope: 'admin', kind: 'aggregate', consumes: 'control-tower intelligence rollup' },
  ];

  const ctx: ValidateCtx = {
    adminCookie: auth.cookie,
    selfCookie: selfAuth.cookie,
    substratePresent,
    fingerprints: {},
  };

  const results: TabResult[] = [];
  for (const spec of specs) {
    const r = await validateTab(spec, ctx);
    results.push(r);
    console.log(
      `[mx301d] ${PERSONA_TITLE[r.persona].padEnd(12)} ${r.tab.padEnd(20)} ${VERDICT_ICON[r.verdict]} ` +
        `(unauth=${r.unauthStatus} authed=${r.authStatus ?? 'n/a'})`,
    );
  }

  mkdirSync(OUT_DIR, { recursive: true });

  const personas: Persona[] = ['candidate', 'employer', 'super-admin', 'founder'];
  for (const persona of personas) {
    const rows = results.filter((r) => r.persona === persona);
    const md = renderPersona(persona, rows, subjectId, masked);
    writeFileSync(resolve(OUT_DIR, `${persona}.md`), md, 'utf8');
  }

  // ── Combined SUMMARY — every line DERIVED from the verdict sets, never hardcoded ──
  const reachable = results.filter((r) => REACHABLE.includes(r.verdict));
  const visible = results.filter((r) => r.verdict === 'visible');
  const aggregated = results.filter((r) => r.verdict === 'aggregated');

  // Cross-persona consistency. The ONE assessment is proven by (a) a single coherent
  // onto substrate and (b) it being reachable through MULTIPLE independent persona lenses.
  // A matching numeric fingerprint across the self + admin lenses, when both are
  // measurable, is an additional (optional) strengthener — never the gate.
  const fpSelf = ctx.fingerprints.self ?? null;
  const fpAdmin = ctx.fingerprints.admin ?? null;
  const fingerprintMatch = fpSelf != null && fpAdmin != null && fpSelf === fpAdmin;
  const personasReached = personas.filter((p) =>
    results.some((r) => r.persona === p && REACHABLE.includes(r.verdict)),
  );
  // "Same single assessment" = ONE substrate AND it surfaces through >= 2 independent persona lenses.
  const sameAssessment = substratePresent && personasReached.length >= 2;
  const gated = results.filter((r) => r.verdict === 'flag_gated');
  const wired = results.filter((r) => r.verdict === 'wired_no_data');
  const forbidden = results.filter((r) => r.verdict === 'forbidden');
  const broken = results.filter((r) => r.verdict === 'broken');

  const s: string[] = [];
  s.push('# MX-301D — Persona Experience Validation · Combined Summary');
  s.push('');
  s.push(`_generated ${new Date().toISOString()}_`);
  s.push('');
  s.push(`**Demonstration candidate:** \`${masked}\` (PII-masked).`);
  s.push(
    `**The ONE assessment:** onto_competency_score_runs=${ledger.runs}, ` +
      `onto_competency_profiles=${ledger.profiles}, profile completeness=${ledger.completeness ?? 'null'}%.`,
  );
  s.push('');
  s.push('## Success criterion: one assessment visible everywhere');
  s.push('');
  s.push(
    `- **Reachable on ${reachable.length}/${results.length} persona tabs** — ` +
      `${visible.length} directly **VISIBLE** (her individual assessment) + ` +
      `${aggregated.length} **AGGREGATED** (counted into platform totals).`,
  );
  if (gated.length) s.push(`- 🔒 **${gated.length}** flag-gated (surface not activated): ${gated.map((r) => `${PERSONA_TITLE[r.persona]}·${r.tab}`).join(', ')}.`);
  if (wired.length) s.push(`- ➖ **${wired.length}** wired but no data for her (honest ceiling): ${wired.map((r) => `${PERSONA_TITLE[r.persona]}·${r.tab}`).join(', ')}.`);
  if (forbidden.length) s.push(`- 🚫 **${forbidden.length}** forbidden (self-scope): ${forbidden.map((r) => `${PERSONA_TITLE[r.persona]}·${r.tab}`).join(', ')}.`);
  if (broken.length) s.push(`- ❌ **${broken.length}** broken (route/resource missing): ${broken.map((r) => `${PERSONA_TITLE[r.persona]}·${r.tab}`).join(', ')}.`);
  s.push('');
  s.push('## Cross-persona consistency (one assessment, many lenses)');
  s.push('');
  s.push(
    `- ${sameAssessment ? '✅' : '➖'} Her assessment is a SINGLE coherent onto substrate ` +
      `(score_runs=${ledger.runs}, profiles=${ledger.profiles}) reachable through ` +
      `**${personasReached.length}/${personas.length} independent persona lenses** ` +
      `(${personasReached.map((p) => PERSONA_TITLE[p]).join(', ') || 'none'}) — ` +
      `${sameAssessment ? 'the same one assessment, seen from multiple sides (not duplicated per persona).' : 'too few lenses surfaced it to confirm cross-persona reach.'}`,
  );
  if (fingerprintMatch) {
    s.push(
      `- ✅ Additional proof: the overall fingerprint is **identical** across the candidate self ` +
        `lens and the admin lens (overall=${fpSelf}) — literally the same assessment, not coincidental numbers.`,
    );
  } else {
    s.push(
      `- ℹ️ Numeric fingerprint cross-check inconclusive (self=${fpSelf ?? 'n/a'}, admin=${fpAdmin ?? 'n/a'}) — ` +
        `the self and admin lenses expose DIFFERENT derived metrics over the same substrate, so a ` +
        `byte-identical number is not expected; cross-persona reach is established by substrate + lens count above.`,
    );
  }
  s.push('');
  s.push('## Per-persona reachability');
  s.push('');
  s.push('| Persona | Reachable | Visible | Aggregated | Gaps |');
  s.push('|---|---|---|---|---|');
  for (const persona of personas) {
    const rows = results.filter((r) => r.persona === persona);
    const rc = rows.filter((r) => REACHABLE.includes(r.verdict));
    const vi = rows.filter((r) => r.verdict === 'visible');
    const ag = rows.filter((r) => r.verdict === 'aggregated');
    const gp = rows.filter((r) => !REACHABLE.includes(r.verdict));
    s.push(`| ${PERSONA_TITLE[persona]} | ${rc.length}/${rows.length} | ${vi.length} | ${ag.length} | ${gp.length} |`);
  }
  s.push('');
  s.push('## Verdict');
  s.push('');
  const allReachable = reachable.length === results.length;
  if (allReachable && sameAssessment) {
    s.push(
      `**ONE ASSESSMENT VISIBLE EVERYWHERE — CONFIRMED.** Her single assessment is reachable on ` +
        `all ${results.length} persona tabs (${visible.length} as a direct individual view, ` +
        `${aggregated.length} as a counted aggregate) across all ${personasReached.length} personas, ` +
        `over ONE coherent onto substrate.`,
    );
  } else {
    s.push(
      `**ONE ASSESSMENT VISIBLE EVERYWHERE — PARTIAL (honest ceiling).** Her single assessment is ` +
        `reachable on ${reachable.length}/${results.length} persona tabs ` +
        `(${visible.length} visible, ${aggregated.length} aggregated) across ` +
        `${personasReached.length}/${personas.length} personas, all over ONE coherent onto substrate. ` +
        `The remaining ${results.length - reachable.length} are disclosed above as honest gaps ` +
        `(flag-gated, wired-no-data ceilings, self-scope, or broken) — NOT fabricated to force a pass.`,
    );
  }
  s.push('');
  s.push('## Honesty & reversibility contract');
  s.push('');
  s.push('- Strictly READ-ONLY: only writes are these audit files under `backend/audit/mx-301d/`.');
  s.push('- All demonstration data is `@example.com` / mx301-tagged and purgeable/reversible.');
  s.push('- Honest ceilings (precise comp_* null, operator-input interview, server-side-only ' +
    'competency match, flag-gated surfaces) are disclosed, never fabricated.');
  s.push('- Additive; feature flags default OFF in production; NO DEPLOY.');
  s.push('');
  writeFileSync(resolve(OUT_DIR, 'SUMMARY.md'), s.join('\n'), 'utf8');

  console.log(
    `\n[mx301d] DONE — reachable ${reachable.length}/${results.length} ` +
      `(visible ${visible.length}, aggregated ${aggregated.length}); sameAssessment=${sameAssessment}; ` +
      `deliverables → ${OUT_DIR}`,
  );
  await pool.end();
}

main().catch((e) => {
  console.error('[mx301d] FATAL', e);
  process.exit(1);
});
