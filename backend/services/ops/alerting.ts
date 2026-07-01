/**
 * CAPADEX 3.0 — Program 2 · Phase 2.5 Operational Readiness.
 *
 * Additive, flag-gated (`operationalReadiness`) ALERT-RULE STORE + notification routing.
 * Closes GAP-OPS-3 (no durable alert-rule store + no push notification routing).
 *
 * Alert rules evaluate REAL signals (the in-process metrics registry + a live DB probe),
 * fire durable `ops_alert_events`, and route notifications via email (reused Zoho sender),
 * a webhook, or the log. Byte-identical OFF: no table exists until the flag-ON write path.
 */
import type { Pool } from 'pg';
import { isOperationalReadinessEnabled } from '../../config/feature-flags';
import { snapshotMetrics, snapshotLatencyPercentiles } from './metrics-registry';
import { sendOperationalAlertEmail } from '../../email';

const RULES = 'ops_alert_rules';
const EVENTS = 'ops_alert_events';

type Comparator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
type Channel = 'log' | 'email' | 'webhook';

let schemaReady = false;
async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS ${RULES} (
    id bigserial PRIMARY KEY,
    name text NOT NULL,
    signal text NOT NULL,            -- key from collectSignals()
    comparator text NOT NULL,        -- gt|gte|lt|lte|eq
    threshold double precision NOT NULL,
    severity text NOT NULL DEFAULT 'warning',
    channel text NOT NULL DEFAULT 'log',
    target text,                     -- email addr / webhook url (channel-dependent)
    enabled boolean NOT NULL DEFAULT true,
    cooldown_seconds integer NOT NULL DEFAULT 900,  -- re-notify suppression window (0 = notify every cycle)
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  // Additive column for stores created before the cooldown feature existed.
  await pool.query(`ALTER TABLE ${RULES} ADD COLUMN IF NOT EXISTS cooldown_seconds integer NOT NULL DEFAULT 900`);
  await pool.query(`CREATE TABLE IF NOT EXISTS ${EVENTS} (
    id bigserial PRIMARY KEY,
    rule_id bigint,
    rule_name text NOT NULL,
    signal text NOT NULL,
    observed double precision,
    threshold double precision NOT NULL,
    severity text NOT NULL,
    channel text NOT NULL,
    routed boolean NOT NULL DEFAULT false,
    suppressed boolean NOT NULL DEFAULT false,  -- rule still firing but re-notification held (cooldown)
    detail text,
    fired_at timestamptz NOT NULL DEFAULT now()
  )`);
  // Additive column for stores created before the cooldown feature existed.
  await pool.query(`ALTER TABLE ${EVENTS} ADD COLUMN IF NOT EXISTS suppressed boolean NOT NULL DEFAULT false`);
  // Seed sane defaults ONLY when the store is empty (never duplicates on restart).
  const cnt = await pool.query(`SELECT count(*)::int AS n FROM ${RULES}`);
  if ((cnt.rows[0]?.n ?? 0) === 0) {
    await pool.query(
      `INSERT INTO ${RULES} (name, signal, comparator, threshold, severity, channel) VALUES
        ('HTTP error ratio high', 'http_error_ratio', 'gt', 0.05, 'critical', 'log'),
        ('Heap usage high (bytes)', 'process_heap_used_bytes', 'gt', 1500000000, 'warning', 'log'),
        ('Database unreachable', 'db_reachable', 'lt', 1, 'critical', 'log'),
        ('Request latency p95 high (ms)', 'http_request_latency_p95_ms', 'gt', 1000, 'warning', 'log'),
        ('Request latency p99 high (ms)', 'http_request_latency_p99_ms', 'gt', 2500, 'critical', 'log')`,
    );
  }
  schemaReady = true;
}

async function tableReady(pool: Pool, table: string): Promise<boolean> {
  try {
    const r = await pool.query(`SELECT to_regclass($1) AS t`, [`public.${table}`]);
    return !!(r.rows[0] && r.rows[0].t);
  } catch {
    return false;
  }
}

/** Live measurable signals alert rules can reference (null ≠ 0 where unmeasured). */
async function collectSignals(pool: Pool): Promise<Record<string, number | null>> {
  const m = snapshotMetrics();
  // Latency percentiles from the EXISTING request-duration histogram (task #324 substrate).
  // Each is null until enough samples exist (p50≥2, p95≥20, p99≥100) — the evaluator skips
  // null signals, so a latency rule simply does not fire on insufficient data (null ≠ 0).
  const lat = snapshotLatencyPercentiles().overall;
  let dbReachable = 0;
  try {
    await pool.query('SELECT 1');
    dbReachable = 1;
  } catch {
    dbReachable = 0;
  }
  return {
    http_requests_total: m.http_requests_total,
    http_request_errors_total: m.http_request_errors_total,
    http_error_ratio: m.http_error_ratio, // null when no traffic — a rule on it simply won't fire
    process_heap_used_bytes: m.process_heap_used_bytes,
    process_rss_bytes: m.process_rss_bytes,
    uptime_seconds: m.uptime_seconds,
    db_reachable: dbReachable,
    // Request-latency signals — a slow-request regression can page an operator, not just failures.
    http_request_latency_p50_ms: lat.p50_ms, // null until ≥2 samples
    http_request_latency_p95_ms: lat.p95_ms, // null until ≥20 samples
    http_request_latency_p99_ms: lat.p99_ms, // null until ≥100 samples
  };
}

/**
 * SSRF egress guard for webhook alert targets. Super-admin sets the URL, but we still
 * fail CLOSED against internal/metadata/private destinations. Literal-host check only
 * (no DNS resolution): blocks non-http(s) schemes, credentials in URL, localhost,
 * link-local/cloud-metadata (169.254.*), and RFC1918 / loopback / unique-local IP literals.
 */
function isSafeWebhookUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  if (u.username || u.password) return false;
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) return false;
  // IPv6 loopback / unique-local / link-local
  if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) return false;
  // IPv4 literal → block loopback / private / link-local ranges
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 127 || a === 10 || a === 0) return false;
    if (a === 169 && b === 254) return false; // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
  }
  return true;
}

function compare(observed: number, cmp: Comparator, threshold: number): boolean {
  switch (cmp) {
    case 'gt': return observed > threshold;
    case 'gte': return observed >= threshold;
    case 'lt': return observed < threshold;
    case 'lte': return observed <= threshold;
    case 'eq': return observed === threshold;
    default: return false;
  }
}

async function route(channel: Channel, target: string | null, subject: string, body: string): Promise<boolean> {
  try {
    if (channel === 'email' && target) return await sendOperationalAlertEmail(target, subject, body);
    if (channel === 'webhook' && target) {
      if (!isSafeWebhookUrl(target)) {
        console.error('[ops-alert] webhook target rejected (SSRF egress guard):', target);
        return false;
      }
      const r = await fetch(target, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subject, body, ts: new Date().toISOString() }),
        signal: AbortSignal.timeout(5000),
        redirect: 'error',
      });
      return r.ok;
    }
    // 'log' (default): always reachable.
    console.warn(`[ops-alert] ${subject} — ${body}`);
    return true;
  } catch (e: any) {
    console.error('[ops-alert] routing failed:', e?.message || e);
    return false;
  }
}

/** Evaluate all enabled rules against live signals; fire + route durable events. */
export async function evaluateAlertRules(pool: Pool) {
  if (!isOperationalReadinessEnabled()) return { skipped: true, reason: 'flag_off' };
  await ensureSchema(pool);
  const signals = await collectSignals(pool);
  const rules = await pool.query(`SELECT * FROM ${RULES} WHERE enabled = true`);
  const fired: any[] = [];
  let suppressed_count = 0;
  for (const rule of rules.rows) {
    const observed = signals[rule.signal];
    if (observed == null) continue; // null signal → cannot evaluate (honest, no fabricated fire)
    if (!compare(observed, rule.comparator as Comparator, Number(rule.threshold))) continue;
    const subject = `[${String(rule.severity).toUpperCase()}] ${rule.name}`;
    const body = `signal=${rule.signal} observed=${observed} ${rule.comparator} threshold=${rule.threshold}`;

    // Per-rule cooldown: a sustained regression pages ONCE, not on every evaluation cycle.
    // The window is measured from the last event that actually NOTIFIED (routed=true); a failed
    // route does not start a cooldown, so it is retried next cycle. cooldown_seconds=0 disables it.
    const cooldownSec = Number(rule.cooldown_seconds ?? 900);
    let suppressed = false;
    if (cooldownSec > 0) {
      const last = await pool.query(
        `SELECT fired_at FROM ${EVENTS} WHERE rule_id = $1 AND routed = true ORDER BY fired_at DESC LIMIT 1`,
        [rule.id],
      );
      if (last.rows[0]) {
        const elapsedSec = (Date.now() - new Date(last.rows[0].fired_at).getTime()) / 1000;
        if (elapsedSec < cooldownSec) suppressed = true;
      }
    }

    // Suppressed: still fire a durable event (recorded honestly), but hold the notification.
    const routed = suppressed ? false : await route(rule.channel as Channel, rule.target, subject, body);
    const detail = suppressed
      ? `${body} [suppressed: re-notification held for cooldown_seconds=${cooldownSec} after last notification]`
      : body;
    const ins = await pool.query(
      `INSERT INTO ${EVENTS} (rule_id, rule_name, signal, observed, threshold, severity, channel, routed, suppressed, detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id, fired_at`,
      [rule.id, rule.name, rule.signal, observed, rule.threshold, rule.severity, rule.channel, routed, suppressed, detail],
    );
    if (suppressed) suppressed_count += 1;
    fired.push({ rule_id: rule.id, rule_name: rule.name, observed, routed, suppressed, event_id: ins.rows[0].id });
  }
  return { evaluated: rules.rows.length, fired_count: fired.length, suppressed_count, fired, signals };
}

export async function listAlertRules(pool: Pool) {
  if (!(await tableReady(pool, RULES))) return { ready: false, rules: [], note: 'Alert-rule store absent until flag-ON.' };
  const r = await pool.query(`SELECT * FROM ${RULES} ORDER BY id`);
  return { ready: true, rules: r.rows };
}

export async function createAlertRule(
  pool: Pool,
  input: { name: string; signal: string; comparator: Comparator; threshold: number; severity?: string; channel?: Channel; target?: string | null; cooldown_seconds?: number },
) {
  if (!isOperationalReadinessEnabled()) return { ok: false, skipped: true };
  await ensureSchema(pool);
  // Cooldown: default 900s; clamp negatives to 0 (0 = notify every cycle, legacy behaviour).
  const cooldown = input.cooldown_seconds == null || !Number.isFinite(input.cooldown_seconds)
    ? 900
    : Math.max(0, Math.floor(input.cooldown_seconds));
  const r = await pool.query(
    `INSERT INTO ${RULES} (name, signal, comparator, threshold, severity, channel, target, cooldown_seconds)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [input.name, input.signal, input.comparator, input.threshold, input.severity ?? 'warning', input.channel ?? 'log', input.target ?? null, cooldown],
  );
  return { ok: true, rule: r.rows[0] };
}

export async function setAlertRuleEnabled(pool: Pool, id: number, enabled: boolean) {
  if (!isOperationalReadinessEnabled()) return { ok: false, skipped: true };
  await ensureSchema(pool);
  const r = await pool.query(`UPDATE ${RULES} SET enabled=$2 WHERE id=$1 RETURNING *`, [id, enabled]);
  return { ok: !!r.rows[0], rule: r.rows[0] ?? null };
}

export async function listAlertEvents(pool: Pool, limit = 50) {
  if (!(await tableReady(pool, EVENTS))) return { ready: false, events: [], note: 'No alert events yet (null ≠ 0).' };
  const lim = Math.min(Math.max(limit, 1), 200);
  const r = await pool.query(`SELECT * FROM ${EVENTS} ORDER BY fired_at DESC LIMIT $1`, [lim]);
  return { ready: true, events: r.rows };
}
