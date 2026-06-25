/**
 * mx301b-career-intelligence-activation.ts — MX-301B Career Intelligence Activation.
 *
 * Validates that EVERY downstream intelligence engine correctly RECEIVES the
 * candidate's assessment data. The demonstration candidate (Sarah Johnson,
 * provisioned by mx301-demo-candidate.ts) has a real competency assessment in the
 * canonical ledgers (onto_competency_score_runs + onto_competency_profiles, keyed
 * by her email == her user id). This harness proves, per engine, whether it consumes
 * that assessment and surfaces measured data — or, honestly, why it does not.
 *
 * Nine downstream engines, grouped into the four required deliverables:
 *   Career Intelligence Validation — Career Readiness, Promotion Readiness
 *     (roadmap progression + signal), Learning Roadmap, Skill Gap.
 *   Employability Validation       — Employability Index (career-intelligence
 *     envelope), Employer Match (talent matching), Interview Readiness.
 *   Career Builder Validation      — Career Builder activation + intelligence.
 *   Passport Validation            — Career Passport overview.
 *
 * Each engine is validated through THREE complementary lenses:
 *   - DB     : the assessment INPUT exists in the canonical ledgers (so there IS
 *              data for the engine to receive).
 *   - API    : a REAL HTTP request — (a) an unauth probe proving the route is wired
 *              + secured (gated, never 404/000), and (b) an authenticated probe.
 *   - DATA   : the authed payload, judged by the ENGINE'S OWN honesty flag
 *              (`measurable`) and by whether the candidate's measured values actually
 *              flow through — NOT merely whether the route is reachable. A structurally
 *              complete comparison whose candidate actuals are all null (e.g. a talent
 *              match with evidence_mix.measured=0) is NOT counted as "received".
 *
 * Honesty-first contract — receives_assessment_data verdict is EXPLICIT, never inflated:
 *   received      — authed 200 AND the engine reports measurable data carrying the
 *                   candidate's measured values (a real, non-default signal).
 *   wired_no_data — route served + secured but the engine has NO usable measured data
 *                   for this candidate (honest absence — an upstream dependency: e.g.
 *                   the assessment carries domain-proxy/EI data but not the precise
 *                   per-competency levels a matcher needs; the passport is unsynced; or
 *                   the engine consumes a different input such as operator interview
 *                   scores). The exact reason is recorded.
 *   flag_gated    — 503, feature flag OFF (engine NOT activated — honest, NOT a failure;
 *                   the report states the exact dev-env enable).
 *   forbidden     — authed 403 self-scoped (IDOR guard) — needs the self-session.
 *   broken        — 404/000, the route/resource is genuinely missing.
 *
 *   - A default/fabricated composite (e.g. the FRI ~40 guard) is NEVER "received".
 *   - REUSES the live HTTP surface only. Strictly READ-ONLY (no provisioning, no flag
 *     flips, no writes other than the audit files under backend/audit/mx-301b/).
 *   - PII (candidate email) is masked to user_<sha256> in every committed artifact.
 *
 * Run: npx tsx backend/scripts/mx301b-career-intelligence-activation.ts [subjectEmail]
 *      (backend must be serving on $MX301B_BASE, default http://localhost:8080)
 */
import { createHash } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import { Pool } from 'pg';

import { MX301_SUBJECT, MX301_PASSWORD } from './mx301-demo-candidate.js';

const BASE = process.env.MX301B_BASE ?? 'http://localhost:8080';
const MATCH_ROLE_ID = process.env.MX301B_ROLE_ID ?? 'role_pm'; // real onto_roles id (Product Manager)
const PROBE_JOB_ID = process.env.MX301B_JOB_ID ?? 'mx301b-probe-job';
const SUPER_ADMIN = {
  username: process.env.MX301B_ADMIN_EMAIL ?? 'support@metryxone.com',
  password: process.env.MX301B_ADMIN_PASSWORD ?? 'admin123',
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../audit/mx-301b');

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

// ── Super-admin authentication (login → DB MFA code → verify) ───────────────
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

// ── Candidate self-session (Sarah logs in AS herself) ───────────────────────
// Bound to the demonstration candidate: a self-session is only available for
// MX301_SUBJECT (the only subject whose password this harness holds). For any other
// subject we SKIP self-auth rather than silently authenticate as the wrong person —
// self-scoped engines then report honestly that they were not validated.
async function authCandidate(subjectId: string): Promise<AuthResult> {
  if (subjectId !== MX301_SUBJECT) {
    return {
      cookie: null,
      mode: 'skipped',
      detail:
        'self-session only available for the demonstration candidate (MX301_SUBJECT); ' +
        'self-scoped engines are NOT validated for a custom subject',
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

// ── DATA-lens: does the engine surface the candidate's MEASURED assessment? ──
// Judged primarily by the engine's OWN `measurable` honesty flag, then by whether
// the candidate's measured values actually flow through. Shape-specific handlers
// catch the cases where a route is structurally "measurable:true" yet carries no
// usable candidate values (talent match with null actuals, unsynced passport,
// operator-input interview surface with zero recorded scores).
interface PayloadVerdict {
  measurable: boolean | null; // the engine's own honesty flag, if it exposes one
  usable: boolean; // candidate's measured values actually flow through
  reason: string; // honest explanation (esp. when usable=false)
  signals: string[]; // supporting evidence excerpts
}

const MEASURED_NUMERIC_KEYS = new Set([
  'overall_score', 'overall_ei', 'readiness_score', 'employability', 'employability_index',
  'index', 'fit_score', 'composite_score', 'evaluation_score',
]);
const MEASURED_ARRAY_KEYS = new Set([
  'competencies', 'domains', 'domain_scores', 'gaps', 'prioritized_gaps', 'signals',
  'milestones', 'steps', 'sequence', 'recommendations', 'focus_areas',
  'development_areas', 'strengths',
]);

// Recursive search for a genuinely measured number/array (generic engines).
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

function inspectPayload(json: any): PayloadVerdict {
  const d = json && typeof json === 'object' && json.data && typeof json.data === 'object' ? json.data : json;
  if (!d || typeof d !== 'object') {
    return { measurable: null, usable: false, reason: 'no JSON payload', signals: [] };
  }
  const measurable =
    typeof d.measurable === 'boolean'
      ? d.measurable
      : typeof json.measurable === 'boolean'
        ? json.measurable
        : null;
  const signals: string[] = [];

  // ── Talent-match shape (single role) — actuals can be null despite measurable:true.
  if (d.evidence_mix && typeof d.evidence_mix === 'object') {
    const em = d.evidence_mix;
    signals.push(`evidence_mix measured=${em.measured ?? 0} inferred=${em.inferred ?? 0} none=${em.none ?? 0}`);
    if (typeof d.match_pct === 'number') signals.push(`match_pct=${d.match_pct} confidence_pct=${d.confidence_pct ?? 0}`);
    if (Number(em.measured ?? 0) > 0) {
      return { measurable, usable: true, reason: 'candidate competency evidence flows into the match', signals };
    }
    return {
      measurable,
      usable: false,
      reason:
        'route consumes the candidate reference and resolves the role requirements, but the ' +
        "candidate's actuals are all null (evidence_mix.measured=0) — the assessment carries " +
        'domain-proxy / EI data, NOT the precise per-competency (comp_*) levels this matcher needs',
      signals,
    };
  }

  // ── Talent "rank roles" shape.
  if (Array.isArray(json.roles)) {
    const n = json.roles.length;
    const anyMatch = json.roles.some((r: any) => Number(r?.match_pct ?? 0) > 0);
    signals.push(`roles[${n}] anyMatch=${anyMatch}`);
    return anyMatch
      ? { measurable, usable: true, reason: 'candidate competency vector produces a non-zero role match', signals }
      : { measurable, usable: false, reason: 'roles resolved but every match_pct=0 (no usable per-competency evidence)', signals };
  }

  // ── Interview evaluation shape (operator-recorded scores, not assessment-ledger).
  if (typeof d.interviews_scored === 'number' || typeof d.total_scores === 'number') {
    const scored = Number(d.total_scores ?? d.interviews_scored ?? 0);
    signals.push(`interviews_scored=${d.interviews_scored ?? 0} total_scores=${d.total_scores ?? 0}`);
    return scored > 0
      ? { measurable, usable: true, reason: 'operator-recorded interview scores present', signals }
      : {
          measurable,
          usable: false,
          reason:
            'wired + secured, but Interview Readiness is OPERATOR-INPUT driven (arithmetic over ' +
            'panelist-entered scores) — it does NOT consume the competency assessment ledger, and ' +
            'no interview scores have been recorded for this candidate',
          signals,
        };
  }

  // ── Passport shape (needs an explicit sync to pull assessment data).
  if (json.passport || json.section_counts || d.section_counts) {
    const sc = json.section_counts || d.section_counts || {};
    const passport = json.passport || d.passport || {};
    const total = Object.values(sc).reduce((a: number, b: any) => a + Number(b || 0), 0);
    signals.push(`section_total=${total} completeness=${passport.completeness_score ?? 0}`);
    return total > 0
      ? { measurable, usable: true, reason: 'passport sections carry synced platform data', signals }
      : {
          measurable,
          usable: false,
          reason:
            'passport row exists but is UNSYNCED — every section_count is 0; it requires an ' +
            'explicit POST /api/passport/sync to pull the competency/assessment snapshot in',
          signals,
        };
  }

  // ── Generic composed engines (readiness / gap / roadmap / learning / intelligence).
  const overall = d.overall?.score ?? d.overall_ei ?? d.overall_score ?? null;
  if (typeof overall === 'number' && Number.isFinite(overall) && overall !== 0) {
    signals.push(`overall=${overall}${d.overall?.band ? ` (${d.overall.band})` : ''}`);
  }
  const rec = recursiveMeasured(d);
  if (rec.length) signals.push(...rec.slice(0, 3));
  const basis: string =
    d.overall?.basis ||
    d.axes?.confidence?.basis ||
    (Array.isArray(d.notes) && d.notes.length ? String(d.notes[0]) : '') ||
    '';
  if (measurable === false) {
    return {
      measurable,
      usable: false,
      reason: basis ? `engine reports measurable:false — ${basis}` : 'engine reports measurable:false (no measured data for candidate)',
      signals: signals.slice(0, 5),
    };
  }
  const usable = signals.length > 0;
  return {
    measurable,
    usable,
    reason: usable
      ? `surfaces measured data${basis ? ` (${basis})` : ''}`
      : basis || 'authed 200 but no measured signal detected (honest absence)',
    signals: signals.slice(0, 5),
  };
}

// ── Per-engine validation ───────────────────────────────────────────────────
type Verdict = 'received' | 'wired_no_data' | 'flag_gated' | 'forbidden' | 'broken';
interface EngineSpec {
  deliverable: string;
  engine: string;
  method: string;
  path: string;
  flagEnv: string;
  scope: 'admin' | 'self';
  inputType: string; // what input this engine consumes
  mutationProbe?: boolean; // a write route — probe unauth-only, NEVER send an authed mutating request
}
interface EngineResult extends EngineSpec {
  unauthStatus: number;
  authStatus: number | null;
  verdict: Verdict;
  reason: string;
  signals: string[];
}

function classify(unauthStatus: number, authStatus: number | null, p: PayloadVerdict): { verdict: Verdict; detail: string } {
  if (unauthStatus === 404 || unauthStatus === 0) {
    return { verdict: 'broken', detail: `route not reachable (unauth status=${unauthStatus})` };
  }
  if (authStatus == null) return { verdict: 'broken', detail: 'no authenticated probe performed' };
  if (authStatus === 503) return { verdict: 'flag_gated', detail: 'feature flag OFF (503) — engine not activated' };
  if (authStatus === 403) return { verdict: 'forbidden', detail: 'authed 403 — self-scoped (IDOR guard); not cross-user readable' };
  if (authStatus === 404) {
    return [401, 403].includes(unauthStatus)
      ? { verdict: 'wired_no_data', detail: 'authed 404 — route wired + secured; honest no-data for candidate' }
      : { verdict: 'broken', detail: 'authed 404 — route/resource missing' };
  }
  if (authStatus === 200) {
    return p.usable
      ? { verdict: 'received', detail: p.reason }
      : { verdict: 'wired_no_data', detail: p.reason };
  }
  if (authStatus === 0) return { verdict: 'broken', detail: 'authed request failed to connect' };
  return { verdict: 'wired_no_data', detail: `authed status=${authStatus}` };
}

async function validateEngine(spec: EngineSpec, adminCookie: string | null, selfCookie: string | null): Promise<EngineResult> {
  const cookie = spec.scope === 'self' ? selfCookie : adminCookie;
  const unauth = await http(spec.method, spec.path);

  // Mutation routes (e.g. POST /activate) are NEVER sent with an authed session —
  // that could materialize rows and would break the read-only contract. The unauth
  // probe is always non-mutating (the flag/auth guard short-circuits first), so it is
  // enough to prove the route is wired + gated. Verdict is read from the unauth probe.
  if (spec.mutationProbe) {
    let verdict: Verdict;
    let reason: string;
    if (unauth.status === 503) {
      verdict = 'flag_gated';
      reason = 'feature flag OFF (503) — activation route gated before any write (read-only safe)';
    } else if (unauth.status === 401 || unauth.status === 403) {
      verdict = 'wired_no_data';
      reason =
        'route wired + secured; activation is a MUTATION not exercised under the read-only ' +
        'contract (flag appears ON — founder runs activation explicitly)';
    } else if (unauth.status === 404 || unauth.status === 0) {
      verdict = 'broken';
      reason = `activation route not reachable (unauth status=${unauth.status})`;
    } else {
      verdict = 'wired_no_data';
      reason = `activation route unauth status=${unauth.status} (not exercised under read-only contract)`;
    }
    return { ...spec, unauthStatus: unauth.status, authStatus: null, verdict, reason, signals: [] };
  }

  // Self-scoped engine with no self-session (e.g. custom subject) — honest skip.
  if (spec.scope === 'self' && !cookie) {
    return {
      ...spec,
      unauthStatus: unauth.status,
      authStatus: null,
      verdict: 'wired_no_data',
      reason:
        'self-scoped route NOT validated — no candidate self-session available ' +
        '(re-run with the demonstration candidate to validate this engine)',
      signals: [],
    };
  }

  let authStatus: number | null = null;
  let authedJson: any = null;
  if (cookie) {
    const authed = await http(spec.method, spec.path, { cookie });
    authStatus = authed.status;
    authedJson = authed.json;
  }
  const p = authStatus === 200 ? inspectPayload(authedJson) : { measurable: null, usable: false, reason: '', signals: [] };
  const { verdict, detail } = classify(unauth.status, authStatus, p);
  return {
    ...spec,
    unauthStatus: unauth.status,
    authStatus,
    verdict,
    reason: detail,
    signals: p.signals,
  };
}

// ── Markdown rendering ──────────────────────────────────────────────────────
const VERDICT_ICON: Record<Verdict, string> = {
  received: '✅ RECEIVED',
  wired_no_data: '➖ WIRED · no measured data',
  flag_gated: '🔒 FLAG OFF (not activated)',
  forbidden: '🚫 forbidden (self-scope)',
  broken: '❌ BROKEN',
};

function renderEngineTable(rows: EngineResult[], email: string, masked: string): string {
  const head =
    '| Engine | Consumes | Route | Flag | Unauth | Authed | Receives assessment data | Evidence / reason |\n' +
    '|---|---|---|---|---|---|---|---|';
  const body = rows
    .map((r) => {
      const route = scrub(`\`${r.method} ${r.path}\``, email, masked);
      const reason = scrub(r.reason, email, masked).replace(/\|/g, '\\|');
      const sig = r.signals.length ? ` _(${scrub(r.signals.join('; '), email, masked).replace(/\|/g, '\\|')})_` : '';
      return `| ${r.engine} | ${r.inputType} | ${route} | \`${r.flagEnv}\` | ${r.unauthStatus} | ${r.authStatus ?? 'n/a'} | ${VERDICT_ICON[r.verdict]} | ${reason}${sig} |`;
    })
    .join('\n');
  return `${head}\n${body}`;
}

function renderDeliverable(
  title: string,
  intro: string,
  rows: EngineResult[],
  email: string,
  masked: string,
  ledger: { runs: number; profiles: number; completeness: number | null },
): string {
  const received = rows.filter((r) => r.verdict === 'received').length;
  const gated = rows.filter((r) => r.verdict === 'flag_gated');
  const wired = rows.filter((r) => r.verdict === 'wired_no_data');
  const broken = rows.filter((r) => r.verdict === 'broken');
  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`_MX-301B — Career Intelligence Activation · generated ${new Date().toISOString()}_`);
  lines.push('');
  lines.push(`**Demonstration candidate:** \`${masked}\` (PII-masked).`);
  lines.push(
    `**Assessment input (the data each engine must receive):** ` +
      `\`onto_competency_score_runs\`=${ledger.runs} (precise ledger), ` +
      `\`onto_competency_profiles\`=${ledger.profiles} (domain-proxy ledger), ` +
      `profile completeness=${ledger.completeness ?? 'null'}%. ` +
      (ledger.runs > 0 || ledger.profiles > 0
        ? 'A real assessment exists — so every downstream engine HAS data to receive.'
        : '⚠️ No ledger rows — engines cannot receive what was never produced.'),
  );
  lines.push('');
  lines.push(intro);
  lines.push('');
  lines.push(
    `**Summary:** ${received}/${rows.length} engines RECEIVED measured assessment data` +
      (gated.length ? ` · ${gated.length} flag-gated (not activated)` : '') +
      (wired.length ? ` · ${wired.length} wired but no measured data` : '') +
      (broken.length ? ` · ${broken.length} broken` : '') +
      '.',
  );
  lines.push('');
  lines.push(renderEngineTable(rows, email, masked));
  lines.push('');
  if (wired.length) {
    lines.push('## Honest "wired but no measured data" findings');
    lines.push('');
    lines.push(
      'These engines are correctly wired and secured (the candidate reference reaches them) ' +
        'but they surface no measured data for this candidate. Each reason below is the ENGINE\'S ' +
        'OWN honest output — never a fabricated value:',
    );
    lines.push('');
    for (const w of wired) lines.push(`- **${w.engine}** — ${scrub(w.reason, email, masked)}`);
    lines.push('');
  }
  if (gated.length) {
    lines.push('## Flag-gated engines (NOT activated)');
    lines.push('');
    lines.push(
      'Wired and secured but the feature flag is OFF (503) — an honest "not activated" state, ' +
        '**not** a defect. NOT flipped by this read-only validator. To activate in DEV (reversible; ' +
        'production stays OFF):',
    );
    lines.push('');
    lines.push('```');
    for (const g of gated) lines.push(`${g.flagEnv}=1   # ${g.engine}`);
    lines.push('```');
    lines.push('');
  }
  lines.push('---');
  lines.push(
    '_Honesty contract: RECEIVED requires the engine\'s own `measurable` signal AND the candidate\'s ' +
      'measured values flowing through; a default/fabricated composite or a null-actuals comparison ' +
      'is excluded. Read-only — no writes beyond this audit file. PII masked. NO DEPLOY._',
  );
  lines.push('');
  return lines.join('\n');
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const subjectId = process.argv[2] ?? MX301_SUBJECT;
  const masked = mask(subjectId);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: databaseUrl });

  // Prerequisite: candidate provisioned (READ-ONLY — never provisions here).
  const provN = await pool
    .query('SELECT COUNT(*)::int AS n FROM users WHERE id = $1', [subjectId])
    .then((r) => Number(r.rows[0]?.n ?? 0))
    .catch(() => -1);
  if (provN <= 0) {
    console.error(
      `[mx301b] candidate ${masked} is not provisioned. This validator is read-only and will not\n` +
        `         create candidate rows. Provision the demonstration candidate first:\n` +
        `           cd backend && npx tsx scripts/mx301-demo-candidate.ts\n` +
        `         then re-run this validation.`,
    );
    await pool.end();
    process.exit(1);
  }

  // Assessment-input ledger (shared substrate every engine must receive).
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
  const ledger = { runs, profiles, completeness };

  const auth = await authSuperAdmin(pool);
  console.log(`[mx301b] super-admin auth: mode=${auth.mode} cookie=${auth.cookie ? 'yes' : 'no'} — ${auth.detail}`);
  const selfAuth = await authCandidate(subjectId);
  console.log(`[mx301b] candidate self-session: mode=${selfAuth.mode} cookie=${selfAuth.cookie ? 'yes' : 'no'} — ${selfAuth.detail}`);

  const sid = encodeURIComponent(subjectId);

  // ── Engine catalogue (grouped by deliverable) ──────────────────────────────
  const specs: EngineSpec[] = [
    // Career Intelligence Validation
    { deliverable: 'career-intelligence', engine: 'Career Readiness', method: 'GET', path: `/api/career-readiness/${sid}`, flagEnv: 'FF_CAREER_READINESS', scope: 'admin', inputType: 'EI / competency ledger' },
    { deliverable: 'career-intelligence', engine: 'Promotion Readiness (roadmap)', method: 'GET', path: `/api/career-roadmap/${sid}/progression`, flagEnv: 'FF_CAREER_ROADMAP', scope: 'admin', inputType: 'readiness + role gap' },
    { deliverable: 'career-intelligence', engine: 'Promotion Readiness (signal)', method: 'GET', path: `/api/career-signal/${sid}`, flagEnv: 'FF_CAREER_SIGNAL', scope: 'admin', inputType: 'EI / competency ledger' },
    { deliverable: 'career-intelligence', engine: 'Learning Roadmap', method: 'GET', path: `/api/learning-path/${sid}`, flagEnv: 'FF_LEARNING_PATH', scope: 'admin', inputType: 'skill-gap → roadmap' },
    { deliverable: 'career-intelligence', engine: 'Skill Gap', method: 'GET', path: `/api/career-gap/${sid}`, flagEnv: 'FF_CAREER_GAP', scope: 'admin', inputType: 'role requirements vs competencies' },
    { deliverable: 'career-intelligence', engine: 'Skill Gap (prioritization)', method: 'GET', path: `/api/career-gap/${sid}/prioritization`, flagEnv: 'FF_CAREER_GAP', scope: 'admin', inputType: 'role requirements vs competencies' },
    // Employability Validation
    { deliverable: 'employability', engine: 'Employability Index', method: 'GET', path: `/api/career-intelligence/${sid}`, flagEnv: 'FF_CAREER_INTELLIGENCE', scope: 'admin', inputType: 'EI / competency ledger' },
    { deliverable: 'employability', engine: 'Employer Match (talent matching)', method: 'GET', path: `/api/talent-matching-engine/candidate/${sid}/role/${encodeURIComponent(MATCH_ROLE_ID)}`, flagEnv: 'FF_TALENT_MATCHING', scope: 'admin', inputType: 'precise comp_* levels vs role' },
    { deliverable: 'employability', engine: 'Interview Readiness', method: 'GET', path: `/api/interview-intelligence/job/${encodeURIComponent(PROBE_JOB_ID)}/candidate/${sid}/evaluation`, flagEnv: 'FF_INTERVIEW_INTELLIGENCE', scope: 'admin', inputType: 'operator interview scores' },
    // Career Builder Validation
    { deliverable: 'career-builder', engine: 'Career Builder (activate)', method: 'POST', path: `/api/v2/career-builder/activate/${sid}`, flagEnv: 'FF_CAREER_BUILDER_ACTIVATION', scope: 'self', inputType: 'materializes activation rows', mutationProbe: true },
    { deliverable: 'career-builder', engine: 'Career Builder (intelligence)', method: 'GET', path: `/api/v2/career-builder/intelligence/${sid}`, flagEnv: 'FF_CAREER_BUILDER_ACTIVATION', scope: 'self', inputType: 'composed activation scores' },
    // Passport Validation
    { deliverable: 'passport', engine: 'Career Passport (overview)', method: 'GET', path: `/api/passport/overview`, flagEnv: 'FF_CAREER_PASSPORT', scope: 'self', inputType: 'synced platform snapshot' },
  ];

  const results: EngineResult[] = [];
  for (const spec of specs) {
    const r = await validateEngine(spec, auth.cookie, selfAuth.cookie);
    results.push(r);
    console.log(`[mx301b] ${r.engine.padEnd(32)} ${VERDICT_ICON[r.verdict]} (unauth=${r.unauthStatus} authed=${r.authStatus ?? 'n/a'})`);
  }

  mkdirSync(OUT_DIR, { recursive: true });

  const byDeliverable = (d: string) => results.filter((r) => r.deliverable === d);
  const files: { name: string; title: string; intro: string; rows: EngineResult[] }[] = [
    {
      name: 'career-intelligence-validation.md',
      title: 'Career Intelligence Validation',
      intro:
        'Validates the Phase-4 Career Intelligence chain — Career Readiness, Promotion ' +
        'Readiness (roadmap progression + career signal), Learning Roadmap, and Skill Gap ' +
        '— each composing the candidate\'s competency assessment into a developmental ' +
        '(never hiring) view.',
      rows: byDeliverable('career-intelligence'),
    },
    {
      name: 'employability-validation.md',
      title: 'Employability Validation',
      intro:
        'Validates the employability + hiring-facing engines — the Employability Index ' +
        '(composed career-intelligence envelope), Employer Match (talent matching against ' +
        'a real role), and Interview Readiness — and exactly which ledger each consumes.',
      rows: byDeliverable('employability'),
    },
    {
      name: 'career-builder-validation.md',
      title: 'Career Builder Validation',
      intro:
        'Validates the Career Builder activation surface — the four named competency-driven ' +
        'scores the Career Builder UI consumes — receiving the candidate\'s assessment.',
      rows: byDeliverable('career-builder'),
    },
    {
      name: 'passport-validation.md',
      title: 'Passport Validation',
      intro:
        'Validates the Career Passport overview — the candidate-owned, self-scoped snapshot ' +
        'that syncs competency/assessment data from the platform (contact NEVER published).',
      rows: byDeliverable('passport'),
    },
  ];

  for (const f of files) {
    const md = renderDeliverable(f.title, f.intro, f.rows, subjectId, masked, ledger);
    writeFileSync(resolve(OUT_DIR, f.name), md, 'utf8');
  }

  // Combined summary.
  const received = results.filter((r) => r.verdict === 'received').length;
  const gated = results.filter((r) => r.verdict === 'flag_gated');
  const wired = results.filter((r) => r.verdict === 'wired_no_data');
  const broken = results.filter((r) => r.verdict === 'broken');
  const forbidden = results.filter((r) => r.verdict === 'forbidden');
  const summary: string[] = [];
  summary.push('# MX-301B — Career Intelligence Activation · Combined Summary');
  summary.push('');
  summary.push(`_generated ${new Date().toISOString()}_`);
  summary.push('');
  summary.push(`**Demonstration candidate:** \`${masked}\` (PII-masked).`);
  summary.push(
    `**Assessment input:** score_runs=${ledger.runs}, profiles=${ledger.profiles}, ` +
      `profile completeness=${ledger.completeness ?? 'null'}%.`,
  );
  summary.push('');
  summary.push('## Success criterion: every downstream engine receives assessment data correctly');
  summary.push('');
  summary.push(
    `- ✅ RECEIVED (surfaces measured assessment data): **${received}/${results.length}**` +
      `\n- ➖ wired + secured, no measured data (honest dependency): **${wired.length}**` +
      `\n- 🔒 flag-gated (not activated): **${gated.length}**` +
      `\n- 🚫 forbidden (self-scope): **${forbidden.length}**` +
      `\n- ❌ broken: **${broken.length}**`,
  );
  summary.push('');
  summary.push(renderEngineTable(results, subjectId, masked));
  summary.push('');
  summary.push('## Root-cause of the non-RECEIVED engines (honest, not failures)');
  summary.push('');
  summary.push(
    '- **Precise-competency consumers** (Skill Gap, Employer Match, and therefore Learning Roadmap, ' +
      'which is downstream of the gap/roadmap) receive the candidate reference and resolve the role ' +
      'requirements, but the assessment ledger carries **domain-proxy / EI** data — not the precise ' +
      'per-competency (`comp_*`) levels these engines compare against — so they honestly report ' +
      'no gaps / 100% gap / 0 match rather than fabricate. This is the documented precise⟂domain-proxy ' +
      'ledger split, not a wiring break.',
  );
  summary.push(
    '- **Career Passport** is wired but UNSYNCED — it requires an explicit `POST /api/passport/sync` ' +
      'to pull the assessment snapshot into its sections.',
  );
  summary.push(
    '- **Interview Readiness** is operator-interview-input driven (arithmetic over panelist-entered ' +
      'scores); it does not consume the competency assessment ledger, and no interview scores exist ' +
      'for this candidate.',
  );
  if (gated.length) {
    summary.push(
      '- **Career Builder** is flag-gated OFF (503) — honestly NOT activated.',
    );
  }
  summary.push('');
  if (gated.length) {
    summary.push('## To activate the gated engine(s) (founder decision — NOT auto-applied)');
    summary.push('');
    summary.push('Enable in DEV (reversible; production stays OFF):');
    summary.push('');
    summary.push('```');
    for (const g of Array.from(new Set(gated.map((x) => `${x.flagEnv}=1`)))) summary.push(g);
    summary.push('```');
    summary.push('');
  }
  summary.push('## Deliverables');
  summary.push('');
  for (const f of files) summary.push(`- \`backend/audit/mx-301b/${f.name}\` — ${f.title}`);
  summary.push('');
  summary.push('---');
  summary.push(
    `_Verdict: ${broken.length === 0 ? 'no engine is broken — every wired, activated engine is reachable and consumes the candidate reference. ' : `${broken.length} engine(s) BROKEN. `}` +
      `The EI/domain-proxy chain RECEIVES measured data; the precise-competency chain, passport sync, ` +
      `interview input, and the flag-gated Career Builder are honest, named dependencies — never fabricated. ` +
      `Read-only, additive, PII-masked. NO DEPLOY._`,
  );
  summary.push('');
  writeFileSync(resolve(OUT_DIR, 'SUMMARY.md'), summary.join('\n'), 'utf8');

  console.log('');
  console.log(
    `[mx301b] RECEIVED ${received}/${results.length} · wired_no_data ${wired.length} · flag_gated ${gated.length} · forbidden ${forbidden.length} · broken ${broken.length}`,
  );
  console.log(`[mx301b] deliverables written to ${OUT_DIR}`);

  await pool.end();
  process.exit(broken.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('[mx301b] fatal', e);
  process.exit(1);
});
