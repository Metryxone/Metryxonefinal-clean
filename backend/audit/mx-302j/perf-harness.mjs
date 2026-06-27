// MX-302J performance harness — HTTP latency + built-frontend weight analysis.
// Read-only: hits GET endpoints only (no writes). Numbers are MEASURED, never fabricated;
// not-measurable surfaces are reported as null (NEVER coerced to 0). Auth/flag-gated routes
// (e.g. the launchpad suite) can only be measured at the gate (401/503) without a session —
// those are reported HONESTLY as PARTIAL (gate latency only, not the authed compose).
//
// Run: BACKEND_PID=<pid> node backend/audit/mx-302j/perf-harness.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const HOST = '127.0.0.1';
const PORT = Number(process.env.BENCH_PORT || 8080);
const BACKEND_PID = process.env.BACKEND_PID ? Number(process.env.BACKEND_PID) : null;
const CLK_TCK = 100;
const ROOT = path.resolve(import.meta.dirname, '../../..');
const DIST = path.join(ROOT, 'frontend', 'dist');
const OUT = path.join(import.meta.dirname, 'perf-result.json');

const agent = new http.Agent({ keepAlive: true, maxSockets: 128, maxFreeSockets: 128 });

function once(p) {
  return new Promise((resolve) => {
    const t0 = process.hrtime.bigint();
    let ttfb = null;
    const req = http.request({ host: HOST, port: PORT, path: p, method: 'GET', agent }, (res) => {
      res.once('data', () => { if (ttfb === null) ttfb = Number(process.hrtime.bigint() - t0) / 1e6; });
      res.on('data', () => {});
      res.on('end', () => {
        const total = Number(process.hrtime.bigint() - t0) / 1e6;
        resolve({ ok: res.statusCode < 500, status: res.statusCode, ttfb: ttfb ?? total, total });
      });
    });
    req.on('error', () => resolve({ ok: false, status: 0, ttfb: null, total: Number(process.hrtime.bigint() - t0) / 1e6 }));
    req.end();
  });
}

function pctl(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}
function stats(arr) {
  const s = arr.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return { n: 0, min: null, mean: null, p50: null, p90: null, p95: null, p99: null, max: null };
  const sum = s.reduce((a, b) => a + b, 0);
  return {
    n: s.length,
    min: +(s[0].toFixed(3)), mean: +((sum / s.length).toFixed(3)),
    p50: +(pctl(s, 50).toFixed(3)), p90: +(pctl(s, 90).toFixed(3)),
    p95: +(pctl(s, 95).toFixed(3)), p99: +(pctl(s, 99).toFixed(3)),
    max: +(s[s.length - 1].toFixed(3)),
  };
}
function readProc(pid) {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    const after = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    const utime = Number(after[11]); const stime = Number(after[12]);
    const status = fs.readFileSync(`/proc/${pid}/status`, 'utf8');
    const m = status.match(/VmRSS:\s+(\d+)\s+kB/);
    return { ticks: utime + stime, rssKb: m ? Number(m[1]) : null };
  } catch { return null; }
}

async function latencySuite(targets, samples = 200, warmup = 20) {
  const out = {};
  for (const t of targets) {
    for (let i = 0; i < warmup; i++) await once(t.path);
    const totals = [], ttfbs = []; let errors = 0; const codes = {};
    for (let i = 0; i < samples; i++) {
      const r = await once(t.path);
      totals.push(r.total); ttfbs.push(r.ttfb);
      codes[r.status] = (codes[r.status] || 0) + 1;
      if (!r.ok) errors++;
    }
    out[t.label] = { path: t.path, note: t.note ?? null, samples, errors, statusCodes: codes, total_ms: stats(totals), ttfb_ms: stats(ttfbs) };
  }
  return out;
}

async function concurrencySuite(p, levels, totalPerLevel = 600) {
  const out = [];
  for (const c of levels) {
    const lat = []; let errors = 0; const codes = {};
    const before = BACKEND_PID ? readProc(BACKEND_PID) : null;
    const wall0 = process.hrtime.bigint();
    let launched = 0;
    async function worker() {
      while (launched < totalPerLevel) { launched++; const r = await once(p); lat.push(r.total); codes[r.status] = (codes[r.status] || 0) + 1; if (!r.ok) errors++; }
    }
    await Promise.all(Array.from({ length: c }, worker));
    const wallSec = Number(process.hrtime.bigint() - wall0) / 1e9;
    const after = BACKEND_PID ? readProc(BACKEND_PID) : null;
    let cpu = null;
    if (before && after) {
      const cpuSec = (after.ticks - before.ticks) / CLK_TCK;
      cpu = { cpu_seconds: +cpuSec.toFixed(3), cores_used: +(cpuSec / wallSec).toFixed(3), cpu_pct: +((cpuSec / wallSec) * 100).toFixed(1), rss_kb_after: after.rssKb };
    }
    out.push({ concurrency: c, requests: totalPerLevel, wall_s: +wallSec.toFixed(3), throughput_rps: +(totalPerLevel / wallSec).toFixed(1), errors, statusCodes: codes, latency_ms: stats(lat), backend: cpu });
  }
  return out;
}

function walkSizes(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walkSizes(full, acc);
    else acc.push({ file: path.relative(DIST, full), bytes: st.size });
  }
  return acc;
}

function distWeight() {
  if (!fs.existsSync(DIST)) return { built: false, note: 'frontend/dist absent — run vite build first' };
  const files = walkSizes(DIST);
  const total = files.reduce((a, f) => a + f.bytes, 0);
  const js = files.filter((f) => f.file.endsWith('.js'));
  const css = files.filter((f) => f.file.endsWith('.css'));
  const jsBytes = js.reduce((a, f) => a + f.bytes, 0);
  const cssBytes = css.reduce((a, f) => a + f.bytes, 0);
  const top = [...files].sort((a, b) => b.bytes - a.bytes).slice(0, 15)
    .map((f) => ({ file: f.file, kb: +(f.bytes / 1024).toFixed(1) }));
  return {
    built: true,
    total_kb: +(total / 1024).toFixed(1),
    js_kb: +(jsBytes / 1024).toFixed(1), js_files: js.length,
    css_kb: +(cssBytes / 1024).toFixed(1), css_files: css.length,
    file_count: files.length,
    largest_js_kb: js.length ? +(Math.max(...js.map((f) => f.bytes)) / 1024).toFixed(1) : null,
    top15: top,
    note: 'Bundle is not gzipped on disk; transfer size over HTTP will be smaller. Largest single JS chunk indicates code-split opportunity.',
  };
}

(async () => {
  const targets = [
    { label: 'health (trivial)', path: '/api/health' },
    { label: 'capadex_concerns (read)', path: '/api/capadex/concerns' },
    { label: 'report_factory_templates (AUTH-gated)', path: '/api/rf/templates', note: 'PARTIAL: 401 gate latency only' },
    { label: 'launchpad_suite (AUTH-gated)', path: '/api/rf/launchpad-suite/test%40example.com', note: 'PARTIAL: 401 gate latency only — authed compose (8-report suite) NOT measured without a super-admin session' },
    { label: 'outcome_intel_enabled (flag probe)', path: '/api/outcome-intelligence/enabled' },
  ];
  const result = { meta: { ts: new Date().toISOString(), host: HOST, port: PORT, backendPid: BACKEND_PID, node: process.version, partial_note: 'Authed/flag-gated compose paths reported as PARTIAL (gate latency only).' } };
  console.error('[perf] dist weight...');
  result.dist_weight = distWeight();
  console.error('[perf] latency suite...');
  result.latency = await latencySuite(targets, 150, 15);
  console.error('[perf] concurrency suite (health)...');
  result.concurrency_health = await concurrencySuite('/api/health', [1, 10, 25, 50], 600);
  console.error('[perf] concurrency suite (capadex_concerns read)...');
  result.concurrency_read = await concurrencySuite('/api/capadex/concerns', [1, 10, 25], 300);
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.error('[perf] wrote ' + OUT);
  console.log(JSON.stringify({ dist_weight: result.dist_weight, latency_summary: Object.fromEntries(Object.entries(result.latency).map(([k, v]) => [k, { status: v.statusCodes, p95_ms: v.total_ms.p95 }])) }, null, 2));
})();
