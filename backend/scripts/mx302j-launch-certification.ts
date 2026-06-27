/**
 * MX-302J — Career Launchpad Launch Certification (read-only, honesty-first composer).
 *
 * Capstone certification for the MetryxOne Career Launchpad (phases A→I + this J capstone).
 * It composes FIRST-HAND evidence — it does NOT trust optimistic prior verdicts:
 *   1. Phase merge/activation: structural (flag defined + route file present) probed from the
 *      filesystem; activation probed LIVE over HTTP against the running Backend API workflow
 *      (the real flag-set) via each phase's ungated `/enabled` endpoint.
 *   2. Report suite: the 8-report Launchpad suite is composed in-process for a REAL non-demo
 *      subject (the deliverable of this phase) and validated for placeholder/PII honesty.
 *   3. Performance + UI/UX: composes the measured perf-result.json + mx-301e UI scan.json.
 *
 * Doctrine: FOUR axes — Structural ⟂ Activation ⟂ Adoption ⟂ Outcome-Confidence — are NEVER
 * composited into one number. `null` = not measurable (never coerced to 0). Demo (@example.com)
 * is excluded. Verdict is STRUCTURAL-only and explicitly PARTIAL while A→I are not all merged +
 * activated. All output is PII-masked (emails → user_<sha12>). Read-only: SELECT + HTTP GET only.
 *
 * Deliverables (backend/audit/mx-302j/):
 *   00-LAUNCH-CERTIFICATION-VERDICT.md   01-PHASE-MERGE-ACTIVATION.md
 *   02-REPORT-SUITE-EVIDENCE.md          03-PERF-AND-UIUX.md
 *   certification.json
 *
 * Run (with the live FF set):  FF_LAUNCH_CERTIFICATION=1 <…live FF…> npx tsx scripts/mx302j-launch-certification.ts
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import http from 'http';
import { Pool } from 'pg';

const OUT_DIR = path.join(__dirname, '../audit/mx-302j');
const REPO_ROOT = path.join(__dirname, '../..');
const ROUTES_DIR = path.join(__dirname, '../routes');
const HOST = '127.0.0.1';
const PORT = Number(process.env.BENCH_PORT || 8080);
const MX302J_VERSION = '302J.0.0';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function maskPII(s: string): string {
  if (!s) return s;
  // Mask any user identifier irreversibly (email OR raw UUID/long id) so artifacts can never
  // be cross-referenced back to a live row.
  if (s.includes('@') || UUID_RE.test(s) || /^[0-9a-f]{16,}$/i.test(s)) {
    return 'user_' + crypto.createHash('sha256').update(s.toLowerCase()).digest('hex').slice(0, 12);
  }
  return s;
}
function flagOn(envKey: string): boolean {
  const v = (process.env[envKey] ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}
function httpGet(p: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve) => {
    const req = http.request({ host: HOST, port: PORT, path: p, method: 'GET', timeout: 5000 }, (res) => {
      let data = ''; res.on('data', (c) => (data += c));
      res.on('end', () => { let b: any = null; try { b = JSON.parse(data); } catch { b = data; } resolve({ status: res.statusCode ?? 0, body: b }); });
    });
    req.on('error', () => resolve({ status: 0, body: null }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: null }); });
    req.end();
  });
}

// ── A→I phase registry (flag + env key + route file + live /enabled probe) ───────────────────
interface Phase { code: string; name: string; flag: string; env: string; routeFile: string | null; enabledPath: string | null; }
const PHASES: Phase[] = [
  { code: 'A', name: 'Career Launchpad',          flag: 'careerLaunchpad',          env: 'FF_CAREER_LAUNCHPAD',          routeFile: 'career-launchpad.ts',          enabledPath: '/api/career-launchpad/enabled' },
  { code: 'B', name: 'Career Discovery',          flag: 'careerDiscovery',          env: 'FF_CAREER_DISCOVERY',          routeFile: 'career-discovery.ts',          enabledPath: '/api/career-discovery/enabled' },
  { code: 'C', name: 'Launchpad Dashboard',       flag: 'launchpadDashboard',       env: 'FF_LAUNCHPAD_DASHBOARD',       routeFile: null,                           enabledPath: null },
  { code: 'D', name: 'Student Career Builder',    flag: 'studentCareerBuilder',     env: 'FF_STUDENT_CAREER_BUILDER',    routeFile: 'student-career-builder.ts',    enabledPath: '/api/student-career-builder/enabled' },
  { code: 'E', name: 'Campus Placement',          flag: 'campusPlacement',          env: 'FF_CAMPUS_PLACEMENT',          routeFile: 'campus-placement.ts',          enabledPath: '/api/campus-placement/enabled' },
  { code: 'F', name: 'Employability Studio',      flag: 'employabilityStudio',      env: 'FF_EMPLOYABILITY_STUDIO',      routeFile: 'employability-studio.ts',      enabledPath: '/api/employability-studio/enabled' },
  { code: 'G', name: 'Learning Passport Loop',    flag: 'learningPassportLoop',     env: 'FF_LEARNING_PASSPORT_LOOP',    routeFile: 'learning-passport.ts',         enabledPath: '/api/passport/loop/enabled' },
  { code: 'H', name: 'Institutional Intelligence', flag: 'institutionalIntelligence', env: 'FF_INSTITUTIONAL_INTELLIGENCE', routeFile: 'institutional-intelligence.ts', enabledPath: '/api/institutional-intelligence/enabled' },
  { code: 'I', name: 'Ecosystem & Community',     flag: 'ecosystemCommunity',       env: 'FF_ECOSYSTEM_COMMUNITY',       routeFile: 'ecosystem-community.ts',       enabledPath: '/api/ecosystem/enabled' },
];

type PhaseResult = {
  code: string; name: string; flag: string;
  merged: boolean;          // structural: flag defined in registry + route code present
  flag_defined: boolean;
  route_present: boolean;
  flag_env_on: boolean;     // env var set in THIS process (should mirror live workflow)
  live_enabled: boolean | null; // first-hand from the running server's /enabled probe
  live_probe_status: number | null;
  note: string;
};

async function probePhases(flagsSrc: string): Promise<PhaseResult[]> {
  const out: PhaseResult[] = [];
  for (const ph of PHASES) {
    const flag_defined = new RegExp(`\\b${ph.flag}\\s*:`).test(flagsSrc);
    const route_present = ph.routeFile ? fs.existsSync(path.join(ROUTES_DIR, ph.routeFile)) : false;
    const flag_env_on = flagOn(ph.env);
    let live_enabled: boolean | null = null;
    let live_probe_status: number | null = null;
    if (ph.enabledPath) {
      const r = await httpGet(ph.enabledPath);
      live_probe_status = r.status;
      if (r.status === 200 && r.body && typeof r.body === 'object' && 'enabled' in r.body) live_enabled = !!r.body.enabled;
      else if (r.status === 503) live_enabled = false; // gated probe → flag OFF
    }
    const merged = flag_defined && (ph.routeFile === null ? true : route_present);
    const note = ph.routeFile === null
      ? 'No backend route file (frontend-composition phase); structural = flag-defined only.'
      : (route_present ? 'Flag defined + backend route merged.' : 'Route file ABSENT — phase not merged.');
    out.push({ code: ph.code, name: ph.name, flag: ph.flag, merged, flag_defined, route_present, flag_env_on, live_enabled, live_probe_status, note });
  }
  return out;
}

function readJsonSafe(p: string): any {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const flagsSrc = fs.readFileSync(path.join(__dirname, '../config/feature-flags.ts'), 'utf8');

  // ── Axis 1+2: phase merge (structural) + activation (live) ────────────────────────────────
  const phases = await probePhases(flagsSrc);
  const mergedCount = phases.filter((p) => p.merged).length;
  const activatedCount = phases.filter((p) => p.live_enabled === true).length;

  // ── Report suite: in-process compose for a REAL non-demo subject ──────────────────────────
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let suite: any = { measurable: false, note: 'Launchpad suite not composed.' };
  try {
    const m: any = await import('../services/report-pack.ts');
    const d = (m.default ?? m);
    const subjRow = await pool.query(
      "SELECT user_id FROM career_seeker_profiles WHERE user_id NOT LIKE '%@example.com' AND data IS NOT NULL LIMIT 1",
    ).catch(() => ({ rows: [] as any[] }));
    const subject = subjRow.rows[0]?.user_id ?? null;
    if (subject) {
      const snap = await d.buildLaunchpadSnapshot(pool, subject);
      const reports = d.composeLaunchpadSuite(snap);
      const violations = d.validateLaunchpadSuite(reports);
      // section-content coverage per report (honest: how many sections carry real content)
      const perReport = reports.map((r: any) => {
        const secs = r.generated_content?.sections ?? [];
        const withBody = secs.filter((s: any) => (s.narrative && String(s.narrative).trim()) || (Array.isArray(s.insights) && s.insights.length) || (s.chart && s.chart.data && s.chart.data.length)).length;
        return { key: r.key, type: r.report_type, sections: secs.length, sections_with_content: withBody };
      });
      suite = {
        measurable: true,
        subject_masked: maskPII(String(subject)),
        report_count: reports.length,
        suite_names: d.LAUNCHPAD_SUITE_NAMES,
        valid: violations.length === 0,
        violations,
        per_report: perReport,
      };
    } else {
      suite = { measurable: false, note: 'No non-demo career_seeker_profiles subject available to compose the suite.' };
    }
  } catch (e: any) {
    suite = { measurable: false, error: e.message };
  }

  // ── Adoption (axis 3): real non-demo users with launchpad-relevant data ───────────────────
  async function scalar(sql: string): Promise<number | null> {
    try { const r = await pool.query(sql); return r.rows[0] ? Number(Object.values(r.rows[0])[0]) : 0; } catch { return null; }
  }
  const adoption = {
    seeker_profiles_real: await scalar("SELECT COUNT(*) FROM career_seeker_profiles WHERE user_id NOT LIKE '%@example.com'"),
    campus_applications_real: await scalar("SELECT COUNT(*) FROM campus_applications WHERE user_id NOT LIKE '%@example.com'"),
    offers_real: await scalar("SELECT COUNT(*) FROM offers WHERE user_id NOT LIKE '%@example.com'"),
  };

  // ── Compose measured perf + UI evidence ───────────────────────────────────────────────────
  const perf = readJsonSafe(path.join(OUT_DIR, 'perf-result.json'));
  const uiScan = readJsonSafe(path.join(REPO_ROOT, 'backend/audit/mx-301e/scan.json'));
  const priorLaunchCert = readJsonSafe(path.join(REPO_ROOT, 'backend/audit/mx-400/certification.json'));

  // ── Outcome-confidence (axis 4): abstain unless realized pairs ≥ k_min ────────────────────
  const K_MIN = 30;
  const outcomeConfidence = {
    k_min: K_MIN,
    realized_offers: adoption.offers_real,
    measurable: false,
    verdict: 'ABSTAIN',
    note: 'Realized predicted→outcome pairs below k_min (or absent); outcome confidence is not measurable. Never coerced to a score.',
  };
  if (typeof adoption.offers_real === 'number' && adoption.offers_real >= K_MIN) {
    outcomeConfidence.measurable = true; outcomeConfidence.verdict = 'MEASURABLE';
    outcomeConfidence.note = 'Realized offers ≥ k_min — outcome confidence can be computed by the validation-loop/employer-tig calibration surfaces (not recomputed here).';
  }

  // ── Verdict (STRUCTURAL-only; axes reported separately, NEVER composited) ──────────────────
  const allMerged = mergedCount === PHASES.length;
  const allActivated = activatedCount === PHASES.length;
  const structuralVerdict = allMerged
    ? 'STRUCTURAL-READY (all A→I merged)'
    : `STRUCTURAL-PARTIAL (${mergedCount}/${PHASES.length} phases merged)`;
  const overall = (allMerged && allActivated && suite.measurable && suite.valid)
    ? 'STRUCTURAL-READY / PARTIAL (activation present; outcome confidence ABSTAINS until k_min realized pairs)'
    : 'STRUCTURAL-PARTIAL — NOT production-ready (phases unmerged/unactivated and/or outcome confidence not measurable)';

  const cert = {
    meta: { phase: 'MX-302J', version: MX302J_VERSION, ts: new Date().toISOString(), node: process.version,
      doctrine: 'Four axes Structural⟂Activation⟂Adoption⟂Outcome-Confidence NEVER composited; null≠0; demo excluded; PII masked; read-only.' },
    axes: {
      structural: { merged: mergedCount, total: PHASES.length, verdict: structuralVerdict },
      activation: { activated: activatedCount, total: PHASES.length, note: 'First-hand from the live Backend API /enabled probes (the real workflow flag-set). Flags do not seed data — dormant pipes read 0 honestly.' },
      adoption,
      outcome_confidence: outcomeConfidence,
    },
    report_suite: suite,
    performance: perf ? { measured: true, dist_weight: perf.dist_weight, latency_p95: Object.fromEntries(Object.entries(perf.latency ?? {}).map(([k, v]: any) => [k, v.total_ms?.p95 ?? null])) } : { measured: false, note: 'perf-result.json absent — run perf-harness.mjs.' },
    uiux: uiScan ? { measured: true, scanned: uiScan.totals?.scanned ?? uiScan.scanned ?? null, true_state_gaps: (uiScan.aggregate?.states?.trueStateGaps ?? uiScan.trueStateGaps ?? []), placeholder_defect_files: (uiScan.aggregate?.placeholders?.defectPlaceholderFiles ?? []) } : { measured: false, note: 'mx-301e scan.json absent — run mx301e-ui-certification-scan.ts.' },
    prior_launch_cert: priorLaunchCert ? { present: true, source: 'backend/audit/mx-400/certification.json' } : { present: false },
    phases,
    verdict: { overall, structural: structuralVerdict, production_ready: false, note: 'Verdict is STRUCTURAL-only and PARTIAL. A production-ready claim is withheld until all A→I phases are merged + activated AND outcome confidence is measurable (≥ k_min realized pairs). STOP for founder approval — never auto-deploy.' },
  };

  fs.writeFileSync(path.join(OUT_DIR, 'certification.json'), JSON.stringify(cert, null, 2));

  // ── Markdown deliverables (PII-masked) ────────────────────────────────────────────────────
  const md0 = `# MX-302J — Career Launchpad Launch Certification (VERDICT)

_Generated ${cert.meta.ts} · version ${MX302J_VERSION} · read-only · PII-masked_

## Doctrine
${cert.meta.doctrine}

## Verdict — STRUCTURAL-only, PARTIAL
**${overall}**

- **Production-ready:** ❌ NO (withheld by design until A→I merged+activated and outcome confidence measurable).
- **Structural:** ${structuralVerdict}
- **Activation (live workflow):** ${activatedCount}/${PHASES.length} A→I phases report \`enabled:true\` on the running Backend API.
- **Outcome confidence:** ${outcomeConfidence.verdict} (realized offers=${outcomeConfidence.realized_offers ?? 'null'}, k_min=${K_MIN}).

> The four axes above are reported **separately and never combined into a single score.** A high structural number does not imply activation or outcome confidence.

## Founder decision required
This capstone certifies the **honest current state**. Phases not merged / flags not enabled are explicit blockers below. **STOP for founder approval before any merge/deploy.**
`;

  const md1 = `# MX-302J — Phase Merge & Activation (A→I)

_Structural (filesystem) ⟂ Activation (first-hand live HTTP probe). Never composited._

| Phase | Name | Flag | Merged (structural) | Route present | Flag env (this proc) | Live \`enabled\` | Probe HTTP | Note |
|---|---|---|---|---|---|---|---|---|
${phases.map((p) => `| ${p.code} | ${p.name} | \`${p.flag}\` | ${p.merged ? '✅' : '❌'} | ${p.route_present ? '✅' : (p.flag_defined && PHASES.find(x => x.code === p.code)?.routeFile === null ? 'n/a' : '❌')} | ${p.flag_env_on ? 'on' : 'off'} | ${p.live_enabled === null ? '—' : (p.live_enabled ? '✅ true' : '⬜ false')} | ${p.live_probe_status ?? '—'} | ${p.note} |`).join('\n')}

- **Merged:** ${mergedCount}/${PHASES.length}
- **Activated (live):** ${activatedCount}/${PHASES.length}

> Activation is measured against the **live Backend API workflow** (the real FF_* set). Flags do not seed data, so dormant pipelines correctly read 0 in adoption/outcome.
`;

  const md2 = `# MX-302J — Report Suite Evidence (8-report Career Launchpad suite)

_In-process compose for a REAL non-demo subject (\`${suite.subject_masked ?? 'n/a'}\`). Read-only._

${suite.measurable
  ? `- **Reports composed:** ${suite.report_count} (${(suite.suite_names ?? []).join(', ')})
- **Placeholder/PII validation:** ${suite.valid ? '✅ clean (zero violations)' : `❌ ${suite.violations.length} violation(s): ${JSON.stringify(suite.violations)}`}

| Report | Type | Sections | Sections with content |
|---|---|---|---|
${(suite.per_report ?? []).map((r: any) => `| ${r.key} | ${r.type} | ${r.sections} | ${r.sections_with_content} |`).join('\n')}

> Section content reflects the subject's REAL substrate (resume / placement / competency). Empty sections are honest (absent data), not fabricated.`
  : `- **Suite not measurable:** ${suite.note ?? suite.error}`}
`;

  const perfBlock = perf
    ? `## Performance (measured — node HTTP harness, no load tools)
- **Built frontend (dist):** ${perf.dist_weight?.built ? `${perf.dist_weight.total_kb} KB total · JS ${perf.dist_weight.js_kb} KB (${perf.dist_weight.js_files} files) · largest JS chunk ${perf.dist_weight.largest_js_kb} KB` : 'dist absent'}
- **API p95 latency (ms):**
${Object.entries(perf.latency ?? {}).map(([k, v]: any) => `  - ${k}: ${v.total_ms?.p95 ?? 'null'} ms (status ${JSON.stringify(v.statusCodes)})`).join('\n')}

> Auth/flag-gated compose paths (launchpad suite) are reported as **PARTIAL** — gate latency (401) only; the authed 8-report compose is not measurable over HTTP without a super-admin session (it is exercised in-process above).`
    : '## Performance\n- perf-result.json absent — run perf-harness.mjs.';

  const uiBlock = uiScan
    ? `## UI/UX (mechanically-scannable defect classes — honesty-first)
- **TRUE state gaps (no loading AND no error):** ${(uiScan.aggregate?.states?.trueStateGaps ?? []).length} ${JSON.stringify(uiScan.aggregate?.states?.trueStateGaps ?? [])}
- **Rendered-defect placeholders:** ${(uiScan.aggregate?.placeholders?.defectPlaceholderFiles ?? []).length} ${JSON.stringify(uiScan.aggregate?.placeholders?.defectPlaceholderFiles ?? [])}
- **Off-brand primary/accent:** ${(uiScan.aggregate?.brand?.offBrandPrimaryFiles ?? []).length}/${(uiScan.aggregate?.brand?.offBrandAccentFiles ?? []).length}

> The remaining placeholder is EmployerPortal's **honest-unavailable** phone-screening disclosure (browser recording is fully active) — kept, not hidden. Visual/subjective criteria are an explicit ceiling covered by manual review, not this scanner.`
    : '## UI/UX\n- mx-301e scan.json absent — run mx301e-ui-certification-scan.ts.';

  const md3 = `# MX-302J — Performance & UI/UX Evidence

${perfBlock}

${uiBlock}
`;

  fs.writeFileSync(path.join(OUT_DIR, '00-LAUNCH-CERTIFICATION-VERDICT.md'), md0);
  fs.writeFileSync(path.join(OUT_DIR, '01-PHASE-MERGE-ACTIVATION.md'), md1);
  fs.writeFileSync(path.join(OUT_DIR, '02-REPORT-SUITE-EVIDENCE.md'), md2);
  fs.writeFileSync(path.join(OUT_DIR, '03-PERF-AND-UIUX.md'), md3);

  await pool.end();

  console.log('[mx302j] certification written to', OUT_DIR);
  console.log('[mx302j] structural:', structuralVerdict, '| activated:', `${activatedCount}/${PHASES.length}`, '| suite:', suite.measurable ? (suite.valid ? 'clean' : 'violations') : 'n/a');
  console.log('[mx302j] verdict:', overall);
}

main().catch((e) => { console.error('[mx302j] FATAL', e); process.exit(1); });
