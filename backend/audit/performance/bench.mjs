// Performance benchmark harness — HTTP latency, concurrency, and backend CPU/RSS sampling.
// Read-only: hits GET endpoints only (no writes). Run: node backend/audit/performance/bench.mjs
import http from 'node:http';
import fs from 'node:fs';

const HOST = '127.0.0.1';
const PORT = Number(process.env.BENCH_PORT || 8080);
const BACKEND_PID = process.env.BACKEND_PID ? Number(process.env.BACKEND_PID) : null;
const CLK_TCK = 100; // sysconf(_SC_CLK_TCK) on Linux

const agent = new http.Agent({ keepAlive: true, maxSockets: 128, maxFreeSockets: 128 });

function once(path) {
  return new Promise((resolve) => {
    const t0 = process.hrtime.bigint();
    let ttfb = null;
    const req = http.request({ host: HOST, port: PORT, path, method: 'GET', agent }, (res) => {
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
  // Guard against null/undefined (e.g. transport failures where ttfb is null) and empty input.
  const s = arr.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return { n: 0, min: null, mean: null, p50: null, p90: null, p95: null, p99: null, max: null };
  const sum = s.reduce((a, b) => a + b, 0);
  return {
    n: s.length,
    min: +(s[0]?.toFixed(3)), mean: +((sum / s.length).toFixed(3)),
    p50: +(pctl(s, 50)?.toFixed(3)), p90: +(pctl(s, 90)?.toFixed(3)),
    p95: +(pctl(s, 95)?.toFixed(3)), p99: +(pctl(s, 99)?.toFixed(3)),
    max: +(s[s.length - 1]?.toFixed(3)),
  };
}

function readProc(pid) {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    // utime=14, stime=15 (after the comm field in parens)
    const after = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    const utime = Number(after[11]); // index 13 overall -> 11 here (0-based after comm)
    const stime = Number(after[12]);
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
    out[t.label] = { path: t.path, samples, errors, statusCodes: codes, total_ms: stats(totals), ttfb_ms: stats(ttfbs) };
  }
  return out;
}

async function concurrencySuite(path, levels, totalPerLevel = 600) {
  const out = [];
  for (const c of levels) {
    const lat = []; let errors = 0; const codes = {};
    const before = BACKEND_PID ? readProc(BACKEND_PID) : null;
    const wall0 = process.hrtime.bigint();
    let launched = 0;
    async function worker() {
      while (launched < totalPerLevel) {
        launched++;
        const r = await once(path);
        lat.push(r.total); codes[r.status] = (codes[r.status] || 0) + 1;
        if (!r.ok) errors++;
      }
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

(async () => {
  const targets = [
    { label: 'health (trivial)', path: '/api/health' },
    { label: 'capadex_concerns (read)', path: '/api/capadex/concerns' },
    { label: 'outcome_intel_enabled (flag probe)', path: '/api/outcome-intelligence/enabled' },
    { label: 'lbi_interventions (heavier read)', path: '/api/lbi/interventions' },
    { label: 'competency_summary (AUTH-gated 401)', path: '/api/competency/intelligence/summary' },
  ];
  const result = { meta: { ts: new Date().toISOString(), host: HOST, port: PORT, backendPid: BACKEND_PID, node: process.version } };
  console.error('[bench] latency suite...');
  result.latency = await latencySuite(targets, 200, 20);
  console.error('[bench] concurrency suite (health)...');
  result.concurrency_health = await concurrencySuite('/api/health', [1, 10, 25, 50, 100], 800);
  console.error('[bench] concurrency suite (capadex_concerns read)...');
  result.concurrency_read = await concurrencySuite('/api/capadex/concerns', [1, 10, 25, 50], 400);
  const path = 'backend/audit/performance/bench-result.json';
  fs.writeFileSync(path, JSON.stringify(result, null, 2));
  console.error('[bench] wrote ' + path);
  console.log(JSON.stringify(result, null, 2));
})();
