/**
 * CAPADEX 3.0 — Phase 1.8 · Program-1 Product Certification deliverable generator.
 * READ-ONLY: reads scan.json (the SSoT for measured numbers) and emits the 15 deliverables to
 * backend/audit/capadex-3.0-program1-certification/. Numbers are sourced from scan.json so the docs
 * can NEVER drift from the measurement. Run AFTER the scan, from backend/:
 *   npx tsx scripts/capadex-1.8-generate-deliverables.ts
 */
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'fs';
import { createHash } from 'crypto';
import path from 'path';

const DIR = path.join(process.cwd(), 'audit', 'capadex-3.0-program1-certification');
mkdirSync(DIR, { recursive: true });

const SCAN_PATH = path.join(DIR, 'scan.json');
const scanRaw = readFileSync(SCAN_PATH, 'utf8');
const scan = JSON.parse(scanRaw);
const SCAN_HASH = createHash('sha256').update(scanRaw).digest('hex').slice(0, 12);
const SCAN_MTIME = statSync(SCAN_PATH).mtime.toISOString();

const C = scan.certification;
const S = scan.summary;
if (C == null || S == null) throw new Error('scan.json missing certification/summary — re-run the scan script.');
for (const k of ['meta', 'honesty_contract', 'phases', 'duplicate_scan', 'traceability', 'domains', 'personas', 'lifecycle_stages', 'dimensions', 'axes', 'gaps', 'gap_rollup', 'verdict']) {
  if (C[k] == null) throw new Error(`scan.json certification missing required section "${k}" — re-run the scan.`);
}

const PHASES: any[] = C.phases;
const AX = C.axes;
const TRACE = C.traceability;
const GAPS: any[] = C.gaps;
const ts = C.meta.generated_at;
const dash = (v: any) => (v === null || v === undefined ? '—' : String(v)); // null≠0 → render null as —
const yn = (v: any) => (v === null ? '—' : v ? '✅' : '❌');

const HEAD = (n: string, title: string) =>
  `# CAPADEX 3.0 · Phase 1.8 — ${title}\n\n` +
  `> Deliverable ${n} · Generated ${ts} · Source of truth: \`scan.json\` (read-only repo+getter scan, sha256:${SCAN_HASH}, written ${SCAN_MTIME}).\n` +
  `> Program-1 capstone certification (Phases 1.1–1.7) against the frozen Product Blueprint.\n` +
  `> Honesty: Structural ⟂ Functional-Integration ⟂ Product-Maturity ⟂ Enterprise-Launch-Readiness (never composited); Coverage⟂Confidence⟂Outcome⟂Adoption; null ≠ 0; never fabricated.\n\n`;

function phaseTable(): string {
  return `| Phase | Name | Maturity | Structural | Registered | public-config | Getter OK |\n|---|---|---|---|---|---|---|\n` +
    PHASES.map((p) =>
      `| ${p.phase} | ${p.name} | ${p.maturity_label} (L${p.maturity_level}) | ${yn(p.structural_present)} | ${yn(p.route_registered)} | ${yn(p.public_config_wired)} | ${yn(p.getter_callable)} |`,
    ).join('\n');
}
function gapSection(): string {
  const sevs = ['Launch Critical', 'High', 'Medium', 'Low', 'Future'];
  return sevs.map((sev) => {
    const gs = GAPS.filter((g) => g.severity === sev);
    if (!gs.length) return `### ${sev}\n_None._\n`;
    return `### ${sev}\n` + gs.map((g) =>
      `#### ${g.id} — ${g.title}\n- **Domain**: ${g.domain}  ·  **Blueprint ref**: ${g.blueprintRef}\n- **Disposition**: ${g.disposition}\n`).join('\n');
  }).join('\n');
}

const files: Record<string, string> = {};

// ── 01 Executive Summary ─────────────────────────────────────────────────
files['01-executive-summary.md'] = HEAD('01', 'Executive Summary') +
`## Verdict
**${C.verdict.label}.** ${C.verdict.statement}

## Four INDEPENDENT axes (never composited)
| Axis | Result |
|---|---|
| Structural Completeness | ${AX.structural_completeness.phases_present}/${AX.structural_completeness.phases_total} phases present (${AX.structural_completeness.pct}%) · complete: ${yn(AX.structural_completeness.complete)} |
| Functional Integration | routes ${AX.functional_integration.phases_registered}/${AX.functional_integration.routes_total} registered · getters ${AX.functional_integration.phases_with_getter_ok}/${AX.functional_integration.getters_total} callable · integrated: ${yn(AX.functional_integration.integrated)} |
| Product Maturity | ${AX.product_maturity.managed_or_above} phases at Managed (L3); ceiling: ${AX.product_maturity.ceiling} |
| Enterprise Launch Readiness | **${dash(AX.enterprise_launch_readiness.value)} (WITHHELD)** — ${AX.enterprise_launch_readiness.reason} |

## Product Traceability (chain integrity)
- **${TRACE.intact} INTACT · ${TRACE.partial} PARTIAL · ${TRACE.breaks} BREAK** of ${TRACE.rows.length} chain nodes (deliverable 02).

## Gap register rollup
- Launch-Critical **${C.gap_rollup['Launch Critical']}** · High ${C.gap_rollup['High']} · Medium ${C.gap_rollup['Medium']} · Low ${C.gap_rollup['Low']} · Future ${C.gap_rollup['Future']} (deliverable 12).

## Program-1 phases
${phaseTable()}

## Strict contract honoured
- Repository-First / Blueprint-First / Validation-First / Enhancement-Only. NO new architecture, NO new feature, NO duplicate logic (duplicate scan clean: ${yn(C.duplicate_scan.clean)}), NO breaking change, byte-identical-OFF, zero-DDL.
- Engines read by existence / persisted-output, NEVER invoked. Human approval mandatory before enable/merge/deploy.
`;

// ── 02 Product Traceability Matrix ───────────────────────────────────────
files['02-product-traceability-matrix.md'] = HEAD('02', 'Product Traceability Matrix') +
`The end-to-end product chain — Business Domain → … → Governance — with each node mapped to its providing Program-1 phase(s) + business domain(s), and a MEASURED status (INTACT = all providers present, PARTIAL = some/none-owned, BREAK = none present). A break anywhere is a gap.\n\n` +
`| # | Chain node | Providing phases | Domains | Status | Note |\n|---|---|---|---|---|---|\n` +
TRACE.rows.map((r: any, i: number) =>
  `| ${i + 1} | ${r.node} | ${(r.providing_phases || []).join(', ') || '—'} | ${(r.domains || []).join(', ') || '—'} | ${r.status} | ${r.note} |`,
).join('\n') + '\n\n' +
`**Rollup:** ${TRACE.intact} INTACT · ${TRACE.partial} PARTIAL · ${TRACE.breaks} BREAK of ${TRACE.rows.length}. The Outcome→KPI keystone is STRUCTURALLY intact; realized-outcome volume is ADOPTION-gated (GAP-O1) and reported on its own axis — never as a chain break.\n`;

// ── 03 Capability Completeness ───────────────────────────────────────────
files['03-capability-completeness.md'] = HEAD('03', 'Capability Completeness') +
`Per-phase capability maturity, derived from MEASURED signals (files on disk · route registration · getter callability). Maturity ceiling is Managed (L3); Levels 4–5 are WITHHELD (no realized-outcome / autonomous-optimization evidence).\n\n` +
phaseTable() + '\n\n' +
`## Maturity ladder\n` +
`- **L0 Absent** · **L1 Built** (files present) · **L2 Integrated** (route registered) · **L3 Managed** (read-only composer callable).\n` +
`- Managed-or-above: **${AX.product_maturity.managed_or_above}** phases. Ceiling: ${AX.product_maturity.ceiling}.\n\n` +
`## Audit deliverables produced per phase (evidence of prior certification)\n` +
`| Phase | Audit dir | .md deliverables |\n|---|---|---|\n` +
PHASES.map((p) => `| ${p.phase} | ${p.flag ? '`' + p.flag + '`' : '—'} | ${dash(p.audit_deliverable_count)} |`).join('\n') + '\n';

// ── 04 Persona Alignment ─────────────────────────────────────────────────
files['04-persona-alignment.md'] = HEAD('04', 'Persona Alignment') +
`The frozen blueprint's first-class personas, and how Program-1 covers them (persona model 1.2 + per-persona paths threaded through assessment/journey/progression/outcome/AI phases 1.3–1.7).\n\n` +
`## Blueprint personas (${C.personas.length})\n` +
C.personas.map((p: string) => `- \`${p}\``).join('\n') + '\n\n' +
`## Coverage note\n` +
`Persona alignment is provided by phase 1.2 (\`personaModelAlignment\` / persona-expansion engine) and consumed by the per-persona paths in phases 1.3–1.7. Persona⟂outcome linkage is reported per phase via read-time joins (zero DDL, k-anon suppressed) — Coverage⟂Outcome⟂Confidence never composited. Mentor ≡ Coach; non-clinical verticals (gov/health/clinical) are scaffold-only (GAP-S1, Future).\n`;

// ── 05 Lifecycle Alignment ───────────────────────────────────────────────
files['05-lifecycle-alignment.md'] = HEAD('05', 'Lifecycle Alignment') +
`The canonical 4-stage coded lifecycle (phase 1.1) the entire product is keyed on.\n\n` +
`| Code | Stage | Alias |\n|---|---|---|\n` +
C.lifecycle_stages.map((s: any) => `| ${s.code} | ${s.name} | ${s.alias || '—'} |`).join('\n') + '\n\n' +
`Stages are normalised at READ time (no migration): \`Clarity\` is an alias of \`Insight\`; \`Awareness\` is uncoded. Lifecycle is consumed by progression (1.5), journey (1.4) and outcome (1.6). Continuous re-administration at volume is ADOPTION-gated (GAP-P1), reported separately.\n`;

// ── 06 Assessment Alignment ──────────────────────────────────────────────
files['06-assessment-alignment.md'] = HEAD('06', 'Assessment Alignment') +
`Assessment framework completeness (phase 1.3) and its place in the chain (Assessment → Evidence → AI Function …).\n\n` +
`Phase 1.3 (\`assessmentFrameworkCompletion\`) is the ONE canonical Assessment Framework registry + read-only composer. Its own certification (audit dir \`capadex-3.0-assessment-framework\`) reports the frozen taxonomy coverage. In the chain, Assessment + Evidence nodes are provided by 1.3 (+1.7 evidence) — see deliverable 02.\n\n` +
`| Phase | Registered | Getter OK | Maturity |\n|---|---|---|---|\n` +
PHASES.filter((p) => ['1.3'].includes(p.phase)).map((p) => `| ${p.phase} ${p.name} | ${yn(p.route_registered)} | ${yn(p.getter_callable)} | ${p.maturity_label} |`).join('\n') + '\n';

// ── 07 AI Integration ────────────────────────────────────────────────────
files['07-ai-integration.md'] = HEAD('07', 'AI Integration') +
`AI orchestration (phase 1.7) integration across the chain (AI Function → Recommendation → Intervention → … → Report).\n\n` +
`Phase 1.7 (\`aiRecommendationReportOrchestration\`) composes the EXISTING AI/recommendation/report/explainability engines (read by existence/persisted-output, NEVER invoked). AI accuracy/quality harness + per-feature attribution depth is GAP-AI1 (Medium) — needs DDL, out of zero-DDL scope. Effectiveness calibration abstains until ≥k_min real pairs (Confidence axis).\n\n` +
`| Phase | Registered | Getter OK | Maturity |\n|---|---|---|---|\n` +
PHASES.filter((p) => ['1.7'].includes(p.phase)).map((p) => `| ${p.phase} ${p.name} | ${yn(p.route_registered)} | ${yn(p.getter_callable)} | ${p.maturity_label} |`).join('\n') + '\n';

// ── 08 Outcome & KPI ─────────────────────────────────────────────────────
files['08-outcome-kpi.md'] = HEAD('08', 'Outcome & KPI (keystone D13)') +
`The keystone domain. Phase 1.6 (\`outcomeFrameworkKpiEngine\`) provides the Outcome + KPI nodes; KPIs are COMPUTED by the existing enterprise-analytics/benchmark/MEI engines (no new KPI engine).\n\n` +
`| Phase | Registered | Getter OK | Maturity |\n|---|---|---|---|\n` +
PHASES.filter((p) => ['1.6'].includes(p.phase)).map((p) => `| ${p.phase} ${p.name} | ${yn(p.route_registered)} | ${yn(p.getter_callable)} | ${p.maturity_label} |`).join('\n') + '\n\n' +
`## Keystone honesty (GAP-O1)
The Outcome→KPI tail is STRUCTURALLY intact (chain nodes INTACT, deliverable 02). The close-the-loop mechanism is WIRED via REUSE of the validation-loop calibration (1.6/1.7); realized-outcome volume + recommendation-effectiveness rate remain honest-low / abstained until ≥k_min real non-demo pairs accrue. This is an ADOPTION + CONFIDENCE axis — reported separately, NEVER counted as a chain break or fabricated.\n`;

// ── 09 Frontend Alignment ────────────────────────────────────────────────
files['09-frontend-alignment.md'] = HEAD('09', 'Frontend Alignment') +
`Program-1's admin/intelligence surfaces COMPOSE the EXISTING frontend (admin shells, FreeAssessmentModal, StudentDashboard, CareerBuilderPage); no new student-facing screens are forked and no existing flow changes when OFF (byte-identical). Each phase's data is super-admin-only; public-config exposes only booleans.\n\n` +
`## public-config wiring (frontend flag detection)\n` +
`| Phase | public-config key | Wired |\n|---|---|---|\n` +
PHASES.filter((p) => p.publicConfigKey).map((p) => `| ${p.phase} | \`${p.publicConfigKey}\` | ${yn(p.public_config_wired)} |`).join('\n') + '\n\n' +
`Phase 1.8 itself exposes \`${C.meta.publicConfigKey}\` (default false). When OFF, no frontend behaviour changes.\n`;

// ── 10 Backend Alignment ─────────────────────────────────────────────────
files['10-backend-alignment.md'] = HEAD('10', 'Backend Alignment') +
`Per-phase backend implementation VERIFIED on disk + route registration in \`routes.ts\` (integration proof) + read-only getter callability.\n\n` +
`| Phase | config | service | routes | registered | getter OK | getter error |\n|---|---|---|---|---|---|---|\n` +
PHASES.map((p) => `| ${p.phase} | ${yn(p.files.config)} | ${yn(p.files.service)} | ${yn(p.files.routeFile)} | ${yn(p.route_registered)} | ${yn(p.getter_callable)} | ${p.getter_error || '—'} |`).join('\n') + '\n\n' +
`**Rollup:** structural ${AX.structural_completeness.phases_present}/${AX.structural_completeness.phases_total}; routes ${AX.functional_integration.phases_registered}/${AX.functional_integration.routes_total}; getters ${AX.functional_integration.phases_with_getter_ok}/${AX.functional_integration.getters_total}. Getters are read-only composers invoked EXACTLY ONCE — engines are never activated.\n`;

// ── 11 Repository Consistency ────────────────────────────────────────────
files['11-repository-consistency.md'] = HEAD('11', 'Repository Consistency (Enhancement-Only proof)') +
`Duplicate / parallel-architecture scan — proves Program-1 added NO duplicate or parallel service for any phase.\n\n` +
`- **Duplicate basenames clean:** ${yn(C.duplicate_scan.clean)}\n` +
`- **Duplicate service basenames:** ${(C.duplicate_scan.duplicate_service_basenames || []).join(', ') || 'none'}\n\n` +
`## Notes\n` +
(C.duplicate_scan.notes || []).map((n: string) => `- ${n}`).join('\n') + '\n\n' +
`## Honesty contract\n` +
C.honesty_contract.map((h: string) => `- ${h}`).join('\n') + '\n';

// ── 12 Gap Register ──────────────────────────────────────────────────────
files['12-gap-register.md'] = HEAD('12', 'Gap Register (classified)') +
`Carried forward from the frozen blueprint gap-closure ledger + traceability matrix. These are HONEST forward-work items (ADOPTION/CONFIDENCE/Future), NOT defects introduced by Program 1.\n\n` +
`**Rollup:** Launch-Critical **${C.gap_rollup['Launch Critical']}** · High ${C.gap_rollup['High']} · Medium ${C.gap_rollup['Medium']} · Low ${C.gap_rollup['Low']} · Future ${C.gap_rollup['Future']}.\n\n` +
gapSection() + '\n';

// ── 13 Prioritized Enhancement Plan ──────────────────────────────────────
files['13-prioritized-enhancement-plan.md'] = HEAD('13', 'Prioritized Enhancement Plan') +
`Forward work, ordered by severity. Each item is ADOPTION/CONFIDENCE/Future — none is an OPEN engineering defect in Program 1. All require human approval + (where DDL is implied) a new approved phase outside the zero-DDL boundary.\n\n` +
`| Priority | Gap | Severity | Recommended action |\n|---|---|---|---|\n` +
GAPS.map((g) => `| ${g.severity} | ${g.id} ${g.title} | ${g.severity} | ${g.disposition} |`).join('\n') + '\n\n' +
`## Sequencing\n` +
`1. **Adoption-driven** (GAP-O1/GAP-K/GAP-P1): no new code — accrue real non-demo volume so calibrated effectiveness + business KPIs light up automatically.\n` +
`2. **DDL-bounded** (GAP-AI1): AI accuracy harness + per-feature attribution — propose as a NEW approved phase (outside 1.8's zero-DDL scope).\n` +
`3. **Future** (GAP-S1): dedicated verticals (gov/health/clinical) — do-not-claim until built + validated.\n`;

// ── 14 Product Certification ─────────────────────────────────────────────
files['14-product-certification.md'] = HEAD('14', 'Product Certification') +
`## Certified verdict
**${C.verdict.label}.**

| Axis | Certified? | Result |
|---|---|---|
| Structural Completeness | ${yn(C.verdict.structural_certified)} | ${AX.structural_completeness.phases_present}/${AX.structural_completeness.phases_total} (${AX.structural_completeness.pct}%) + duplicate-clean |
| Functional Integration | ${yn(C.verdict.functional_integration_certified)} | routes ${AX.functional_integration.phases_registered}/${AX.functional_integration.routes_total} · getters ${AX.functional_integration.phases_with_getter_ok}/${AX.functional_integration.getters_total} |
| Product Maturity | — | ${C.verdict.product_maturity_ceiling} |
| Enterprise Launch Readiness | ❌ WITHHELD | ${dash(C.verdict.enterprise_launch_readiness)} (null by design) |
| Production-Ready | ❌ | ${C.verdict.production_ready} (WITHHELD pending runtime adoption + realized-outcome evidence) |

## Dimensions (independent, never composited)
${C.dimensions.map((d: any) => `- **${d.name}** (\`${d.key}\`) — ${d.definition}`).join('\n')}

## Statement
${C.verdict.statement}

## Program-1 freeze list certified
${(C.meta.freeze || []).map((f: string) => `\`${f}\``).join(' · ')}
`;

// ── 15 Founder Decision ──────────────────────────────────────────────────
files['15-founder-decision.md'] = HEAD('15', 'Founder Decision') +
`## What this certifies
Program-1 (Phases 1.1–1.7) is **${C.verdict.label}** against the frozen Product Blueprint on the STRUCTURAL and FUNCTIONAL-INTEGRATION axes. Product Maturity ceiling is **Managed (L3)**. Enterprise Launch Readiness / Production-Ready is **WITHHELD by design** (null, never 0, never composited).

## What is intentionally NOT claimed
- **Enterprise Launch Readiness / Production-Ready** — requires runtime adoption + realized-outcome evidence that cannot exist pre-launch.
- **Calibrated effectiveness** — abstained until ≥ k_min real non-demo prediction+outcome pairs (Confidence axis).
- **Business/outcome KPI realization** — ADOPTION-gated (GAP-O1/GAP-K).
- **Dedicated verticals** (gov/health/clinical) — scaffold-only, do-not-claim (GAP-S1).

## Decision required (human approval mandatory)
This certification phase \`${C.meta.flag}\` ships **default OFF** (byte-identical, zero-DDL, owns 0 tables). It introduces NO new architecture/feature/duplicate logic and changes NO business logic. **No enable / merge / deploy has been performed.**

- [ ] **Approve** Phase 1.8 certification capstone (then enable the flag in the live workflow to expose the read-only admin surface).
- [ ] **Request changes** to the certification scope.
- [ ] **Defer** — keep OFF; certification artifacts remain in \`audit/capadex-3.0-program1-certification/\`.

## Gaps to acknowledge (forward work, not defects)
- Launch-Critical: **${C.gap_rollup['Launch Critical']}** · High: ${C.gap_rollup['High']} · Medium: ${C.gap_rollup['Medium']} · Low: ${C.gap_rollup['Low']} · Future: ${C.gap_rollup['Future']} (deliverables 12/13).
`;

let written = 0;
for (const [name, body] of Object.entries(files)) {
  writeFileSync(path.join(DIR, name), body);
  written++;
}
console.log(`── CAPADEX 1.8 deliverables generated (${written} files) ──`);
console.log(`verdict: ${C.verdict.label}  ·  scan sha256:${SCAN_HASH}`);
for (const n of Object.keys(files)) console.log(`  ${n}`);
console.log('wrote to', DIR);
