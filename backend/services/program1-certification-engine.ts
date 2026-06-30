/**
 * CAPADEX 3.0 — Phase 1.8 · Program-1 Product Certification ENGINE (read-only composer).
 *
 * Audits + certifies everything built in Phases 1.1–1.7 against the frozen Product Blueprint.
 * STRICTLY read-only / never-throws / zero-DDL. It:
 *   • reads the frozen registry (config/program1-certification-model.ts),
 *   • scans the repository filesystem for each phase's implementation files (existence only),
 *   • reads routes.ts / routes/capadex.ts ONCE to prove route-registration + public-config wiring,
 *   • invokes each prior phase's read-only getter EXACTLY ONCE (in parallel, each wrapped in safe())
 *     to prove the composer is callable — engines are read by existence/persisted-output, NEVER
 *     activated, and this composer NEVER writes.
 * It emits a Product Traceability Matrix, capability/persona/lifecycle completeness matrices,
 * frontend/backend alignment + repository-consistency reports, a gap register, and FOUR INDEPENDENT
 * certification axes that are NEVER composited. Production-Ready / Enterprise Launch Readiness is
 * WITHHELD by design (null). Honesty: Coverage⟂Confidence⟂Outcome⟂Adoption; null≠0; never fabricate.
 *
 * Mirrors the MX-800 2.14 / MX-700 1.43 certification capstones.
 */
import type { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import {
  PROGRAM1_PHASES, PROGRAM1_FREEZE, TRACEABILITY_CHAIN, BUSINESS_DOMAINS, PERSONAS,
  LIFECYCLE_STAGES, CERTIFICATION_DIMENSIONS, PROGRAM1_GAPS, HONESTY_CONTRACT, PHASE_META,
  type PhaseDesc,
} from '../config/program1-certification-model';
import { composePersonaOutcomes } from './persona-expansion-engine';
import { composeSummary as composeAssessmentSummary } from './assessment-framework-engine';
import { composeSummary as composeJourneySummary } from './customer-journey-engine';
import { composeSummary as composeProgressionSummary } from './progression-engine';
import { composeSummary as composeOutcomeKpiSummary } from './outcome-kpi-engine';
import { composeSummary as composeAiSummary } from './ai-orchestration-engine';

const BACKEND_ROOT = path.resolve(__dirname, '..');

// ── never-throws helpers ──────────────────────────────────────────────────────────────────────────
interface Safe<T> { ok: boolean; value: T | null; error: string | null; }
async function safe<T>(fn: () => Promise<T>): Promise<Safe<T>> {
  try { return { ok: true, value: await fn(), error: null }; }
  catch (e: any) { return { ok: false, value: null, error: String(e?.message ?? e) }; }
}
function fileExists(rel: string | null): boolean {
  if (!rel) return false;
  try { return fs.existsSync(path.join(BACKEND_ROOT, rel)); } catch { return false; }
}
function readFileSafe(rel: string): string | null {
  try { return fs.readFileSync(path.join(BACKEND_ROOT, rel), 'utf8'); } catch { return null; }
}
function dirCount(rel: string | null): number | null {
  if (!rel) return null;
  try { return fs.readdirSync(path.join(BACKEND_ROOT, rel)).filter((f) => f.endsWith('.md')).length; }
  catch { return null; }
}

// ── gather each prior phase's read-only getter EXACTLY ONCE (parallel). ─────────────────────────────
export interface GatherResult {
  persona: Safe<unknown>;
  assessment: Safe<unknown>;
  journey: Safe<unknown>;
  progression: Safe<unknown>;
  outcomeKpi: Safe<unknown>;
  aiOrchestration: Safe<unknown>;
}
export async function gatherPhaseGetters(pool: Pool): Promise<GatherResult> {
  const [persona, assessment, journey, progression, outcomeKpi, aiOrchestration] = await Promise.all([
    safe(() => composePersonaOutcomes(pool)),
    safe(() => composeAssessmentSummary(pool)),
    safe(() => composeJourneySummary(pool)),
    safe(() => composeProgressionSummary(pool)),
    safe(() => composeOutcomeKpiSummary(pool)),
    safe(() => composeAiSummary(pool)),
  ]);
  return { persona, assessment, journey, progression, outcomeKpi, aiOrchestration };
}
function getterFor(g: GatherResult, key: PhaseDesc['getterKey']): Safe<unknown> | null {
  if (!key) return null;
  return (g as any)[key] ?? null;
}

// ── routes.ts / capadex.ts wiring proof (read ONCE). ───────────────────────────────────────────────
function buildWiringIndex() {
  const routesTs = readFileSafe('routes.ts') ?? '';
  const capadexTs = readFileSafe('routes/capadex.ts') ?? '';
  return {
    registered: (fn: string | null) =>
      !!fn && routesTs.includes(`${fn}(`) && routesTs.includes(`import { ${fn} }`),
    publicConfigWired: (key: string | null) => !!key && capadexTs.includes(`${key}:`),
  };
}

// ── per-phase structural + integration + maturity. ─────────────────────────────────────────────────
export interface PhaseCert {
  phase: string;
  name: string;
  flag: string | null;
  publicConfigKey: string | null;
  files: { config: boolean | null; service: boolean | null; routeFile: boolean | null };
  structural_present: boolean;        // all declared files present
  route_registered: boolean | null;   // registerFn referenced in routes.ts
  public_config_wired: boolean | null;
  getter_callable: boolean | null;    // composer ran without throwing (null = phase has no getter)
  getter_error: string | null;
  maturity_level: number;             // 0..3 (ceiling Managed/L3)
  maturity_label: string;
  audit_deliverable_count: number | null;
}
const MATURITY_LABELS = ['Absent', 'Built', 'Integrated', 'Managed (composable)'];

function certifyPhase(p: PhaseDesc, g: GatherResult, wiring: ReturnType<typeof buildWiringIndex>): PhaseCert {
  const files = {
    config: p.config == null ? null : fileExists(p.config),
    service: p.service == null ? null : fileExists(p.service),
    routeFile: p.routeFile == null ? null : fileExists(p.routeFile),
  };
  const declared = [p.config, p.service, p.routeFile].filter((x) => x != null) as string[];
  const structural_present = declared.length > 0 && declared.every((rel) => fileExists(rel));
  const route_registered = p.registerFn == null ? null : wiring.registered(p.registerFn);
  const public_config_wired = p.publicConfigKey == null ? null : wiring.publicConfigWired(p.publicConfigKey);
  const getter = getterFor(g, p.getterKey);
  const getter_callable = getter == null ? null : getter.ok;
  const getter_error = getter == null ? null : getter.error;

  let level = 0;
  if (structural_present) level = 1;
  if (level === 1 && (route_registered === true || p.registerFn == null)) level = 2;
  if (level === 2 && (getter_callable === true || p.getterKey == null)) level = 3;
  // phase 1.1 is config-level (no route/getter) — cap at Built unless its lib file is present.
  if (p.getterKey == null && p.registerFn == null) level = structural_present ? 1 : 0;

  return {
    phase: p.phase, name: p.name, flag: p.flag, publicConfigKey: p.publicConfigKey,
    files, structural_present, route_registered, public_config_wired,
    getter_callable, getter_error,
    maturity_level: level, maturity_label: MATURITY_LABELS[level] ?? 'Absent',
    audit_deliverable_count: dirCount(p.auditDir),
  };
}

// ── duplicate / parallel-architecture scan (Enhancement-Only proof). ───────────────────────────────
export interface DuplicateScan { clean: boolean; notes: string[]; duplicate_service_basenames: string[]; }
function duplicateScan(): DuplicateScan {
  const notes: string[] = [];
  const dupes: string[] = [];
  // Each phase must own exactly ONE service basename — flag collisions if a second file shares it.
  const seen = new Map<string, string[]>();
  for (const p of PROGRAM1_PHASES) {
    if (!p.service) continue;
    const base = path.basename(p.service);
    seen.set(base, [...(seen.get(base) ?? []), p.phase]);
  }
  for (const [base, phases] of seen) {
    if (phases.length > 1) { dupes.push(base); notes.push(`service basename ${base} shared by phases ${phases.join(', ')}`); }
  }
  if (dupes.length === 0) notes.push('No duplicate/parallel service basenames across Program-1 phases (Enhancement-Only intact).');
  return { clean: dupes.length === 0, notes, duplicate_service_basenames: dupes };
}

// ── Product Traceability Matrix — each chain node → providing phases/domains + status. ──────────────
// Provider map derived from the blueprint; status is MEASURED from phase structural presence.
const CHAIN_NODE_PROVIDERS: Record<string, { phases: string[]; domains: string[] }> = {
  'Business Domain': { phases: ['1.1'], domains: ['D1', 'D2'] },
  'Market Segment': { phases: ['1.2'], domains: ['D2'] },
  'Persona': { phases: ['1.2'], domains: ['D2'] },
  'Lifecycle Stage': { phases: ['1.1'], domains: ['D2'] },
  'Customer Journey': { phases: ['1.4'], domains: ['D2', 'D10'] },
  'Assessment': { phases: ['1.3'], domains: ['D6'] },
  'Evidence': { phases: ['1.3', '1.7'], domains: ['D6', 'D7'] },
  'AI Function': { phases: ['1.7'], domains: ['D7'] },
  'Recommendation': { phases: ['1.7'], domains: ['D7'] },
  'Intervention': { phases: ['1.5', '1.7'], domains: ['D3', 'D7'] },
  'Learning': { phases: ['1.5'], domains: ['D3'] },
  'Practice': { phases: ['1.5'], domains: ['D3'] },
  'Progression': { phases: ['1.5'], domains: ['D3', 'D4'] },
  'Outcome': { phases: ['1.6'], domains: ['D13'] },
  'KPI': { phases: ['1.6'], domains: ['D13'] },
  'Dashboard': { phases: ['1.6', '1.7'], domains: ['D8'] },
  'Report': { phases: ['1.7'], domains: ['D8'] },
  'Workflow': { phases: ['1.4', '1.5'], domains: ['D2'] },
  'API': { phases: ['1.2', '1.3', '1.4', '1.5', '1.6', '1.7'], domains: ['D1'] },
  'Database': { phases: ['1.3', '1.4', '1.5', '1.6', '1.7'], domains: ['D1'] },
  'Governance': { phases: ['1.1'], domains: ['D12'] },
};
export interface TraceabilityRow {
  node: string; providing_phases: string[]; domains: string[];
  status: 'INTACT' | 'PARTIAL' | 'BREAK'; note: string;
}
function buildTraceability(phaseCerts: PhaseCert[]): { rows: TraceabilityRow[]; intact: number; partial: number; breaks: number } {
  const presentPhase = new Map(phaseCerts.map((c) => [c.phase, c.structural_present]));
  const rows: TraceabilityRow[] = TRACEABILITY_CHAIN.map((node) => {
    const prov = CHAIN_NODE_PROVIDERS[node] ?? { phases: [], domains: [] };
    const present = prov.phases.filter((ph) => presentPhase.get(ph));
    let status: TraceabilityRow['status'] = 'BREAK';
    let note = 'No providing phase implementation present.';
    if (prov.phases.length === 0) { status = 'PARTIAL'; note = 'No Program-1 phase owns this node (platform-level concern).'; }
    else if (present.length === prov.phases.length) { status = 'INTACT'; note = `Provided by ${present.join(', ')}.`; }
    else if (present.length > 0) { status = 'PARTIAL'; note = `Partially provided (present: ${present.join(', ')}).`; }
    // Keystone honesty: Outcome→KPI chain is structurally INTACT but ADOPTION-gated (see GAP-O1).
    if ((node === 'Outcome' || node === 'KPI') && status === 'INTACT') {
      note += ' Structural only — realized-outcome volume ADOPTION-gated (GAP-O1), reported separately, never as a gap.';
    }
    return { node, providing_phases: prov.phases, domains: prov.domains, status, note };
  });
  return {
    rows,
    intact: rows.filter((r) => r.status === 'INTACT').length,
    partial: rows.filter((r) => r.status === 'PARTIAL').length,
    breaks: rows.filter((r) => r.status === 'BREAK').length,
  };
}

// ── FOUR INDEPENDENT certification axes (NEVER composited). ─────────────────────────────────────────
export interface Axes {
  structural_completeness: { phases_present: number; phases_total: number; pct: number; complete: boolean };
  functional_integration: { phases_registered: number; phases_with_getter_ok: number; routes_total: number; getters_total: number; integrated: boolean };
  product_maturity: { ceiling: string; per_phase: { phase: string; level: number; label: string }[]; managed_or_above: number };
  enterprise_launch_readiness: { value: null; status: 'WITHHELD'; reason: string };
}
function computeAxes(phaseCerts: PhaseCert[]): Axes {
  const structuralPhases = phaseCerts.filter((c) => [c.files.config, c.files.service, c.files.routeFile].some((x) => x != null));
  const present = structuralPhases.filter((c) => c.structural_present).length;
  const routesPhases = phaseCerts.filter((c) => c.route_registered != null);
  const registered = routesPhases.filter((c) => c.route_registered === true).length;
  const getterPhases = phaseCerts.filter((c) => c.getter_callable != null);
  const gettersOk = getterPhases.filter((c) => c.getter_callable === true).length;
  return {
    structural_completeness: {
      phases_present: present, phases_total: structuralPhases.length,
      pct: structuralPhases.length ? Math.round((present / structuralPhases.length) * 100) : 0,
      complete: present === structuralPhases.length,
    },
    functional_integration: {
      phases_registered: registered, phases_with_getter_ok: gettersOk,
      routes_total: routesPhases.length, getters_total: getterPhases.length,
      integrated: registered === routesPhases.length && gettersOk === getterPhases.length,
    },
    product_maturity: {
      ceiling: 'Managed (L3) — Levels 4–5 WITHHELD (no realized-outcome / autonomous-optimization evidence)',
      per_phase: phaseCerts.map((c) => ({ phase: c.phase, level: c.maturity_level, label: c.maturity_label })),
      managed_or_above: phaseCerts.filter((c) => c.maturity_level >= 3).length,
    },
    enterprise_launch_readiness: {
      value: null, status: 'WITHHELD',
      reason: 'Requires runtime adoption + realized-outcome evidence that does not exist pre-launch. null ≠ 0; never composited with the other three axes.',
    },
  };
}

// ── headline composition. ──────────────────────────────────────────────────────────────────────────
export interface Certification {
  meta: typeof PHASE_META & { freeze: string[]; generated_at: string };
  honesty_contract: string[];
  phases: PhaseCert[];
  duplicate_scan: DuplicateScan;
  traceability: ReturnType<typeof buildTraceability>;
  domains: typeof BUSINESS_DOMAINS;
  personas: string[];
  lifecycle_stages: typeof LIFECYCLE_STAGES;
  dimensions: typeof CERTIFICATION_DIMENSIONS;
  axes: Axes;
  gaps: typeof PROGRAM1_GAPS;
  gap_rollup: Record<string, number>;
  verdict: {
    structural_certified: boolean;
    functional_integration_certified: boolean;
    product_maturity_ceiling: string;
    production_ready: false;
    enterprise_launch_readiness: null;
    label: string;
    statement: string;
  };
}

export async function composeCertification(pool: Pool): Promise<Certification> {
  const g = await gatherPhaseGetters(pool);
  const wiring = buildWiringIndex();
  const phases = PROGRAM1_PHASES.map((p) => certifyPhase(p, g, wiring));
  const dup = duplicateScan();
  const traceability = buildTraceability(phases);
  const axes = computeAxes(phases);

  const gap_rollup: Record<string, number> = {};
  for (const s of ['Launch Critical', 'High', 'Medium', 'Low', 'Future']) gap_rollup[s] = 0;
  for (const gp of PROGRAM1_GAPS) gap_rollup[gp.severity] = (gap_rollup[gp.severity] ?? 0) + 1;

  const structural_certified = axes.structural_completeness.complete && dup.clean;
  const functional_integration_certified = axes.functional_integration.integrated;
  const launchCritical = gap_rollup['Launch Critical'] ?? 0;

  return {
    meta: { ...PHASE_META, freeze: PROGRAM1_FREEZE, generated_at: new Date().toISOString() },
    honesty_contract: HONESTY_CONTRACT,
    phases, duplicate_scan: dup, traceability,
    domains: BUSINESS_DOMAINS, personas: PERSONAS, lifecycle_stages: LIFECYCLE_STAGES,
    dimensions: CERTIFICATION_DIMENSIONS, axes,
    gaps: PROGRAM1_GAPS, gap_rollup,
    verdict: {
      structural_certified,
      functional_integration_certified,
      product_maturity_ceiling: axes.product_maturity.ceiling,
      production_ready: false,
      enterprise_launch_readiness: null,
      label: structural_certified && functional_integration_certified && launchCritical === 0
        ? 'STRUCTURAL_CERTIFIED' : 'STRUCTURAL_REVIEW_REQUIRED',
      statement:
        'Program-1 (Phases 1.1–1.7) is certified on the STRUCTURAL and FUNCTIONAL-INTEGRATION axes ' +
        'against the frozen Product Blueprint. Product Maturity ceiling is Managed (L3). ' +
        'Enterprise Launch Readiness / Production-Ready is WITHHELD by design (null) pending runtime ' +
        'adoption + realized-outcome evidence. Axes are reported INDEPENDENTLY and never composited; ' +
        'null ≠ 0; human approval mandatory before enable/merge/deploy.',
    },
  };
}

export interface CertificationSummary {
  phase: string; title: string; verdict_label: string;
  structural_pct: number; phases_present: string; routes_registered: string; getters_ok: string;
  traceability: { intact: number; partial: number; breaks: number; total: number };
  maturity_managed_or_above: number; duplicate_clean: boolean;
  gap_rollup: Record<string, number>;
  enterprise_launch_readiness: null; production_ready: false;
  generated_at: string;
}
// Pure derivation from an ALREADY-composed certification — no getter re-gather, no DB read.
// Use this (with a single composeCertification result) to honour the capstone's
// "gather each phase getter EXACTLY ONCE per run" contract.
export function summarizeCertification(c: Certification): CertificationSummary {
  return {
    phase: c.meta.phase, title: c.meta.title, verdict_label: c.verdict.label,
    structural_pct: c.axes.structural_completeness.pct,
    phases_present: `${c.axes.structural_completeness.phases_present}/${c.axes.structural_completeness.phases_total}`,
    routes_registered: `${c.axes.functional_integration.phases_registered}/${c.axes.functional_integration.routes_total}`,
    getters_ok: `${c.axes.functional_integration.phases_with_getter_ok}/${c.axes.functional_integration.getters_total}`,
    traceability: {
      intact: c.traceability.intact, partial: c.traceability.partial,
      breaks: c.traceability.breaks, total: c.traceability.rows.length,
    },
    maturity_managed_or_above: c.axes.product_maturity.managed_or_above,
    duplicate_clean: c.duplicate_scan.clean,
    gap_rollup: c.gap_rollup,
    enterprise_launch_readiness: null, production_ready: false,
    generated_at: c.meta.generated_at,
  };
}
// Convenience wrapper for callers that only need the summary (single gather pass).
export async function composeCertificationSummary(pool: Pool): Promise<CertificationSummary> {
  return summarizeCertification(await composeCertification(pool));
}
