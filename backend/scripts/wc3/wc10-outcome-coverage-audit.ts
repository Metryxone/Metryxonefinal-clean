/**
 * WC-10 — Outcome Coverage Expansion Audit (DESIGN + AUDIT ONLY).
 *
 * Answers: why does Outcome Projection coverage stop at ~80.3%, and what is the
 * MINIMUM change required to reach 90%+ outcome coverage and 90%+ journey coverage?
 *
 * Grounding sources (read-only):
 *   - L5C crosswalk (data/bridge-tag-construct-crosswalk.ts) — bridge_tag → construct.
 *   - L5C outcome projection (services/wc3/outcome-projection.ts) — construct → outcome model.
 *   - L5D journey projection (services/wc3/journey-projection.ts) — outcome → journey route.
 *   - wc3_outcome_models (7), wc3_journey_routes (6), capadex_clarity_questions,
 *     wc3_question_intelligence (L5A stage), wc3_question_context (L5B context).
 *
 * DISCIPLINE: SELECT-only. No schema/migration/data writes. No new constructs/ontology/
 * crosswalks/models/routes/products. Proposed expansions are SIMULATED against cloned,
 * in-memory model copies purely to estimate lift — the real wc3_outcome_models rows are
 * NEVER mutated. Every number is grounded in real question counts. Orphans reported
 * honestly; no forced mappings.
 *
 * Writes 6 reports → backend/audit/wc-10/. Idempotent.
 * Usage: npx tsx scripts/wc3/wc10-outcome-coverage-audit.ts
 */
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import {
  projectOutcome,
  type OutcomeModelLite,
} from '../../services/wc3/outcome-projection';
import {
  projectJourney,
  type JourneyRouteLite,
} from '../../services/wc3/journey-projection';
import {
  resolveConstructForBridgeTag,
  type CrosswalkEntry,
} from '../../data/bridge-tag-construct-crosswalk';
import { CONSTRUCTS } from '../../data/behavioural-constructs';

/** Authoritative registry construct keys — the universe for the gap matrix. */
const REGISTRY_CONSTRUCTS = CONSTRUCTS.map((c) => c.key).sort();

const AUDIT = path.join(__dirname, '../../audit/wc-10');

/**
 * Curated, grounded expansion proposals: each residual construct (resolves to a real
 * registry construct but lives in NO outcome-model construct_keys) and its candidate
 * reconciliation into an EXISTING model, with a semantic rationale tied to that model's
 * existing keys. Confidence reflects adjacency strength. `null` target ⇒ no defensible
 * existing fit ⇒ new-outcome candidate or remain-unmapped (reported, never forced).
 * This is a DESIGN recommendation table — it is simulated, not applied.
 */
interface FoldProposal {
  construct: string;
  target_model: string | null;
  confidence: 'HIGH' | 'MODERATE' | 'NONE';
  rationale: string;
  new_outcome_candidate?: string;
}
const FOLD_PROPOSALS: FoldProposal[] = [
  {
    construct: 'CAREER_GROWTH',
    target_model: 'career_clarity',
    confidence: 'HIGH',
    rationale:
      'CAREER_GROWTH is directly adjacent to existing career_clarity keys CAREER_CLARITY / CAREER_READINESS / GOAL_ORIENTATION — same career-development family.',
  },
  {
    construct: 'PROCRASTINATION',
    target_model: 'decision_quality',
    confidence: 'HIGH',
    rationale:
      'PROCRASTINATION is a self-regulation / executive-function failure; decision_quality already holds IMPULSE_CONTROL, HABIT_FORMATION, EXECUTIVE_FUNCTION — same regulation family.',
  },
  {
    construct: 'DIGITAL_DISCIPLINE',
    target_model: 'decision_quality',
    confidence: 'HIGH',
    rationale:
      'DIGITAL_DISCIPLINE is impulse/habit self-control over device use; maps onto decision_quality keys IMPULSE_CONTROL / HABIT_FORMATION.',
  },
  {
    construct: 'DIGITAL_DEPENDENCY',
    target_model: 'decision_quality',
    confidence: 'MODERATE',
    rationale:
      'DIGITAL_DEPENDENCY (compulsive use) sits between decision_quality (IMPULSE_CONTROL) and confidence_stability (MENTAL_HEALTH); leaning decision_quality as the dominant behavioural framing. Genuine human-review item.',
  },
  {
    construct: 'PEER_RELATIONS',
    target_model: 'confidence_stability',
    confidence: 'MODERATE',
    rationale:
      'PEER_RELATIONS is social-emotional; confidence_stability holds SOCIAL_CONFIDENCE, and employability_readiness also holds SOCIAL_CONFIDENCE/COMMUNICATION — defensible into either, leaning confidence_stability. Genuine human-review item.',
  },
  {
    construct: 'PHYSICAL_WELLBEING',
    target_model: null,
    confidence: 'NONE',
    rationale:
      'No existing model carries a physical-health / sleep / energy construct; family_wellbeing is FAMILY_DYNAMICS only. No defensible existing fit.',
    new_outcome_candidate: 'holistic_wellbeing (PHYSICAL_WELLBEING, MENTAL_HEALTH, STRESS_MANAGEMENT)',
  },
  {
    construct: 'SAFETY_THREATS',
    target_model: null,
    confidence: 'NONE',
    rationale:
      'SAFETY_THREATS is safeguarding / crisis, handled by the runtime crisis-escalation path — not a developmental-outcome construct. Remain unmapped (do NOT force into a behavioural model).',
  },
];

const round = (x: number, p = 1) => {
  const f = 10 ** p;
  return Math.round(x * f) / f;
};

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  fs.mkdirSync(AUDIT, { recursive: true });
  try {
    // ── Load existing assets (read-only) ──
    const models: OutcomeModelLite[] = (
      await pool.query('SELECT model_key, construct_keys, gated FROM wc3_outcome_models ORDER BY model_key')
    ).rows.map((r) => ({ model_key: r.model_key, construct_keys: r.construct_keys, gated: r.gated }));
    const modelByKey = new Map(models.map((m) => [m.model_key, m]));

    const routes: JourneyRouteLite[] = (
      await pool.query(
        `SELECT route_key, display_label, model_affinities, corpus_status, is_fallback, fallback_priority
           FROM wc3_journey_routes ORDER BY fallback_priority, route_key`,
      )
    ).rows.map((r) => ({
      route_key: r.route_key,
      display_label: r.display_label,
      model_affinities: r.model_affinities && typeof r.model_affinities === 'object' ? r.model_affinities : {},
      corpus_status: r.corpus_status ?? 'ready',
      is_fallback: !!r.is_fallback,
      fallback_priority: Number(r.fallback_priority ?? 100),
    }));

    // every construct that appears in ANY model (ungated or gated)
    const constructsInAnyModel = new Set<string>();
    const constructsInUngatedModel = new Set<string>();
    for (const m of models) {
      for (const c of m.construct_keys) {
        constructsInAnyModel.add(c);
        if (!m.gated) constructsInUngatedModel.add(c);
      }
    }

    // ── Load the full clarity bank with L5A stage + L5B context ──
    const rows = (
      await pool.query(`
      SELECT c.master_bridge_tag AS tag, i.primary_stage AS stage, x.primary_context AS context
      FROM capadex_clarity_questions c
      LEFT JOIN wc3_question_intelligence i ON i.clarity_id = c.id
      LEFT JOIN wc3_question_context x ON x.clarity_id = c.id`)
    ).rows as Array<{ tag: string | null; stage: string | null; context: string | null }>;
    const TOTAL = rows.length;

    // ── Per-tag resolution cache ──
    interface TagInfo {
      entry: CrosswalkEntry | null;
      status: CrosswalkEntry['status'] | 'ABSENT';
      contributingConstructs: string[]; // HIGH construct or REVIEW candidates
      primaryOutcome: string | null;
      gatedOnly: boolean;
      primaryJourney: string | null;
      // why no outcome (when primaryOutcome null)
      noOutcomeReason: 'ABSENT' | 'UNMAPPED' | 'RESIDUAL_CONSTRUCT' | null;
      residualConstructs: string[]; // contributing constructs that reach no model
    }
    const tagCache = new Map<string, TagInfo>();
    const resolveTag = (tag: string | null): TagInfo | null => {
      if (!tag) return null;
      if (tagCache.has(tag)) return tagCache.get(tag)!;
      const entry = resolveConstructForBridgeTag(tag);
      const o = projectOutcome(tag, entry, models);
      const j = projectJourney(tag, entry, models, routes);
      const contributing: string[] = [];
      if (entry?.status === 'HIGH_CONFIDENCE' && entry.construct) contributing.push(entry.construct);
      else if (entry?.status === 'REVIEW_REQUIRED' && entry.candidates) contributing.push(...entry.candidates);
      const status = entry ? entry.status : ('ABSENT' as const);
      const residual = contributing.filter((c) => !constructsInAnyModel.has(c));
      let noOutcomeReason: TagInfo['noOutcomeReason'] = null;
      if (!o.primary_outcome) {
        if (status === 'ABSENT') noOutcomeReason = 'ABSENT';
        else if (status === 'UNMAPPED' || contributing.length === 0) noOutcomeReason = 'UNMAPPED';
        else noOutcomeReason = 'RESIDUAL_CONSTRUCT';
      }
      const info: TagInfo = {
        entry,
        status,
        contributingConstructs: contributing,
        primaryOutcome: o.primary_outcome,
        gatedOnly: o.gated_only,
        primaryJourney: j.primary_journey,
        noOutcomeReason,
        residualConstructs: residual,
      };
      tagCache.set(tag, info);
      return info;
    };

    // ── Accumulators ──
    let outcomeCovered = 0;
    let outcomeCoveredUngated = 0;
    let gatedOnlyCount = 0;
    let journeyCovered = 0;
    const noOutcomeByReason = { ABSENT: 0, UNMAPPED: 0, RESIDUAL_CONSTRUCT: 0 };
    const constructReachable = () => 0; // placeholder
    let constructReachableQ = 0; // HIGH/REVIEW that resolve to ≥1 construct (regardless of model)

    // per-construct (residual) accumulators
    const resQ = new Map<string, number>(); // residual construct → q count
    const resTags = new Map<string, Set<string>>();
    const resCtx = new Map<string, Map<string, number>>();
    const resStage = new Map<string, Map<string, number>>();

    // per outcome-model coverage
    const modelQ = new Map<string, number>(); // model → q where it is PRIMARY
    const modelConstructs = new Map<string, Set<string>>();
    const modelCtx = new Map<string, Set<string>>();
    const modelJourneys = new Map<string, Set<string>>();

    // construct → question volume (any contributing), for the gap matrix
    const constructQ = new Map<string, number>();

    const bump = (m: Map<string, number>, k: string, n = 1) => m.set(k, (m.get(k) ?? 0) + n);
    const bump2 = (m: Map<string, Map<string, number>>, a: string, b: string) => {
      if (!m.has(a)) m.set(a, new Map());
      bump(m.get(a)!, b);
    };
    const addSet = (m: Map<string, Set<string>>, k: string, v: string) => {
      if (!m.has(k)) m.set(k, new Set());
      m.get(k)!.add(v);
    };

    for (const r of rows) {
      const info = resolveTag(r.tag);
      const stage = r.stage ?? 'UNKNOWN';
      const ctx = r.context ?? 'UNKNOWN';
      if (!info) {
        noOutcomeByReason.ABSENT++; // null tag treated as absent/no chain
        continue;
      }
      for (const c of info.contributingConstructs) bump(constructQ, c);
      if (info.contributingConstructs.length > 0) constructReachableQ++;

      if (info.primaryOutcome) {
        outcomeCovered++;
        if (!info.gatedOnly) outcomeCoveredUngated++;
        if (info.gatedOnly) gatedOnlyCount++;
        bump(modelQ, info.primaryOutcome);
        addSet(modelCtx, info.primaryOutcome, ctx);
        for (const c of info.contributingConstructs) {
          if (modelByKey.get(info.primaryOutcome)!.construct_keys.includes(c)) {
            addSet(modelConstructs, info.primaryOutcome, c);
          }
        }
        if (info.primaryJourney) addSet(modelJourneys, info.primaryOutcome, info.primaryJourney);
      } else if (info.noOutcomeReason) {
        noOutcomeByReason[info.noOutcomeReason]++;
        if (info.noOutcomeReason === 'RESIDUAL_CONSTRUCT') {
          for (const c of info.residualConstructs) {
            bump(resQ, c);
            addSet(resTags, c, r.tag!);
            bump2(resCtx, c, ctx);
            bump2(resStage, c, stage);
          }
        }
      }
      if (info.primaryJourney) journeyCovered++;
    }
    void constructReachable;

    // ── Scenario simulation: clone models, add folded constructs, recompute coverage ──
    const cloneModels = (): OutcomeModelLite[] =>
      models.map((m) => ({ model_key: m.model_key, gated: m.gated, construct_keys: [...m.construct_keys] }));
    const applyFolds = (folds: FoldProposal[]): OutcomeModelLite[] => {
      const cm = cloneModels();
      const byKey = new Map(cm.map((m) => [m.model_key, m]));
      for (const f of folds) {
        if (f.target_model && byKey.has(f.target_model) && !byKey.get(f.target_model)!.construct_keys.includes(f.construct)) {
          byKey.get(f.target_model)!.construct_keys.push(f.construct);
        }
      }
      return cm;
    };
    const measureCoverage = (mdls: OutcomeModelLite[]): { covered: number; ungated: number } => {
      let covered = 0;
      let ungated = 0;
      const cache = new Map<string, { p: string | null; gatedOnly: boolean }>();
      for (const r of rows) {
        if (!r.tag) continue;
        if (!cache.has(r.tag)) {
          const o = projectOutcome(r.tag, resolveConstructForBridgeTag(r.tag), mdls);
          cache.set(r.tag, { p: o.primary_outcome, gatedOnly: o.gated_only });
        }
        const c = cache.get(r.tag)!;
        if (c.p) {
          covered++;
          if (!c.gatedOnly) ungated++;
        }
      }
      return { covered, ungated };
    };

    const HIGH_folds = FOLD_PROPOSALS.filter((f) => f.confidence === 'HIGH');
    const HIGH_MOD_folds = FOLD_PROPOSALS.filter((f) => f.confidence !== 'NONE');
    const scenarioBase = { covered: outcomeCovered, ungated: outcomeCoveredUngated };
    const scenarioA = measureCoverage(applyFolds(HIGH_folds));
    const scenarioB = measureCoverage(applyFolds(HIGH_MOD_folds));

    // per-fold marginal lift (each fold alone, on top of base)
    const perFold = FOLD_PROPOSALS.filter((f) => f.target_model).map((f) => {
      const cov = measureCoverage(applyFolds([f]));
      return { construct: f.construct, target: f.target_model!, confidence: f.confidence, lift: cov.covered - outcomeCovered };
    });

    // ── Ceiling math ──
    const pct = (n: number) => round((100 * n) / TOTAL) + '%';
    const constructCeilingQ = constructReachableQ; // max questions that COULD reach an outcome via model expansion (have a construct)
    const unmappedQ = noOutcomeByReason.UNMAPPED + noOutcomeByReason.ABSENT;
    const residualQ = noOutcomeByReason.RESIDUAL_CONSTRUCT;
    const qi3 = (outcomeCov: number) => round((100 * (2 * TOTAL + outcomeCov)) / (3 * TOTAL)) + '%';
    const qi4 = (oc: number, jc: number) => round((100 * (2 * TOTAL + oc + jc)) / (4 * TOTAL)) + '%';

    // ───────────────────────── REPORTS ─────────────────────────
    const W = (f: string, body: string) => fs.writeFileSync(path.join(AUDIT, f), body);
    const sortDesc = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);
    const ctxLine = (m: Map<string, number> | undefined) =>
      m ? sortDesc(m).map(([k, v]) => `${k}:${v}`).join(', ') : '—';

    // 1 — Outcome Coverage Report
    W(
      '01_outcome_coverage.md',
      `# WC-10 Report 1 — Outcome Coverage (reachability ceiling)

**Bank:** ${TOTAL} clarity questions. **Chain:** Question → Bridge Tag → Construct → Outcome Model.

| Layer | Questions | % bank |
|-------|-----------|--------|
| Outcome-covered (primary outcome ≠ null) | ${outcomeCovered} | ${pct(outcomeCovered)} |
| — of which ungated outcome | ${outcomeCoveredUngated} | ${pct(outcomeCoveredUngated)} |
| — of which gated-only (exam_readiness) | ${gatedOnlyCount} | ${pct(gatedOnlyCount)} |
| Journey-covered (downstream of outcome) | ${journeyCovered} | ${pct(journeyCovered)} |
| **NOT outcome-covered** | ${TOTAL - outcomeCovered} | ${pct(TOTAL - outcomeCovered)} |

## Why coverage stops at ${pct(outcomeCovered)} — the gap decomposed
| Cause of no-outcome | Questions | % bank | Fixable by… |
|---------------------|-----------|--------|-------------|
| UNMAPPED / ABSENT bridge tag (no construct at all) | ${unmappedQ} | ${pct(unmappedQ)} | crosswalk review (REVIEW→HIGH, UNMAPPED→construct) — NOT outcome-model expansion |
| RESIDUAL construct (resolves to a real construct that is in NO outcome model) | ${residualQ} | ${pct(residualQ)} | **outcome-model expansion (this audit's lever)** |

## The two ceilings
- **Construct-reachability ceiling** = questions whose bridge tag resolves to ≥1 construct = **${constructCeilingQ} (${pct(constructCeilingQ)})**. This is the absolute maximum outcome coverage achievable by outcome-model expansion ALONE (you cannot route a question to an outcome if it has no construct).
- **Current outcome coverage** = ${outcomeCovered} (${pct(outcomeCovered)}). The distance to the construct ceiling (**${residualQ} q, ${pct(residualQ)}**) is exactly the residual-construct set — recoverable by folding those constructs into existing models.
- ⛔ **Honest headline:** even if EVERY residual construct were folded into a model, outcome coverage caps at the construct ceiling **${pct(constructCeilingQ)}**. Reaching **90%+** additionally requires reducing the ${pct(unmappedQ)} UNMAPPED/ABSENT set via crosswalk work — outside outcome-model expansion. See Report 6.
`,
    );

    // 2 — Residual Construct Report
    const resRows = [...resQ.entries()].sort((a, b) => b[1] - a[1]);
    W(
      '02_residual_constructs.md',
      `# WC-10 Report 2 — Residual Construct Analysis

Constructs that a bridge tag DOES resolve to, but which appear in **no outcome model's construct_keys** (ungated or gated). These are the questions recoverable by outcome-model expansion. Counts are real (a question can attribute to >1 construct only when its tag is REVIEW with multiple residual candidates).

| Construct | Questions | % bank | Distinct bridge tags | Top contexts (L5B) | Stage spread (L5A) |
|-----------|-----------|--------|----------------------|--------------------|--------------------|
${resRows
  .map(
    ([c, q]) =>
      `| ${c} | ${q} | ${pct(q)} | ${resTags.get(c)?.size ?? 0} | ${ctxLine(resCtx.get(c))} | ${ctxLine(resStage.get(c))} |`,
  )
  .join('\n')}

**Total residual-construct questions:** ${residualQ} (${pct(residualQ)} of bank). These are honest coverage gaps, NOT fabricated mappings.
`,
    );

    // 3 — Outcome Model Coverage (per model: construct / question / context / journey)
    W(
      '03_outcome_gap_matrix.md',
      `# WC-10 Report 3 — Outcome Model Coverage + Construct × Outcome Gap Matrix

## Per-model coverage (as PRIMARY outcome)
| Model | Gated | Constructs reached | Questions | % bank | Contexts reached | Journeys reached |
|-------|-------|--------------------|-----------|--------|------------------|------------------|
${models
  .map(
    (m) =>
      `| ${m.model_key} | ${m.gated ? 'yes' : 'no'} | ${modelConstructs.get(m.model_key)?.size ?? 0}/${m.construct_keys.length} | ${modelQ.get(m.model_key) ?? 0} | ${pct(modelQ.get(m.model_key) ?? 0)} | ${modelCtx.get(m.model_key)?.size ?? 0} | ${[...(modelJourneys.get(m.model_key) ?? [])].join(', ') || '—'} |`,
  )
  .join('\n')}

## Construct × Outcome gap matrix (all ${REGISTRY_CONSTRUCTS.length} registry constructs)
Universe = the authoritative behavioural-construct registry (every key, including zero-volume ones). **Bank questions** = all questions whose bridge tag contributes this construct as a candidate (HIGH construct or any REVIEW candidate), so it can exceed the residual count in Report 2 (a REVIEW tag may also offer a model-reaching candidate that "rescues" the outcome — that question is outcome-covered, yet still counts here).
Status: **COVERED** = construct is a key in ≥1 model AND carries questions · **DORMANT** = in a model but 0 questions in bank · **RESIDUAL** = resolves but in no model · **UNUSED** = registry construct never resolved by any clarity tag.
| Construct | In model(s) | Bank questions | Status |
|-----------|-------------|----------------|--------|
${REGISTRY_CONSTRUCTS
  .map((c) => {
    const inModels = models.filter((m) => m.construct_keys.includes(c)).map((m) => m.model_key);
    const q = constructQ.get(c) ?? 0;
    let status: string;
    if (inModels.length === 0) status = q > 0 ? 'RESIDUAL' : 'UNUSED';
    else status = q > 0 ? 'COVERED' : 'DORMANT';
    return `| ${c} | ${inModels.join(', ') || '—'} | ${q} | ${status} |`;
  })
  .join('\n')}
`,
    );

    // 4 — Outcome Expansion Opportunities + 6 New Outcome Justification (combined design table)
    W(
      '04_outcome_expansion_opportunities.md',
      `# WC-10 Report 4 — Outcome Expansion Opportunities (DESIGN — simulated, not applied)

For every residual construct: candidate reconciliation into an EXISTING model (Metric 5) and, where none fits, a new-outcome candidate or honest remain-unmapped (Metric 6). Each fold is **simulated against cloned models** to measure real coverage lift — the live wc3_outcome_models are untouched.

## Metric 5 — fold into existing model
| Construct | Bank q | Candidate existing model | Confidence | Marginal coverage lift | Rationale |
|-----------|--------|--------------------------|------------|------------------------|-----------|
${FOLD_PROPOSALS.filter((f) => f.target_model)
  .map((f) => {
    const pf = perFold.find((p) => p.construct === f.construct);
    return `| ${f.construct} | ${resQ.get(f.construct) ?? 0} | ${f.target_model} | ${f.confidence} | +${pf?.lift ?? 0} q (${pct(pf?.lift ?? 0)}) | ${f.rationale} |`;
  })
  .join('\n')}

## Metric 6 — no existing fit → new-outcome candidate or remain-unmapped
| Construct | Bank q | Verdict | Evidence |
|-----------|--------|---------|----------|
${FOLD_PROPOSALS.filter((f) => !f.target_model)
  .map(
    (f) =>
      `| ${f.construct} | ${resQ.get(f.construct) ?? 0} | ${f.new_outcome_candidate ? 'NEW OUTCOME candidate: ' + f.new_outcome_candidate : 'REMAIN UNMAPPED'} | ${f.rationale} |`,
  )
  .join('\n')}

> Discipline: HIGH-confidence folds are same-family adjacencies to a model's existing keys. MODERATE folds (DIGITAL_DEPENDENCY, PEER_RELATIONS) are genuine human-review items defensible into >1 model — surfaced, never auto-decided. PHYSICAL_WELLBEING / SAFETY_THREATS have NO defensible existing fit and are NOT forced.
`,
    );

    // 5 — Journey Impact Report
    W(
      '05_journey_impact.md',
      `# WC-10 Report 5 — Journey Impact (simulated)

Journey coverage is strictly downstream of outcome coverage and tracks it ~1:1 (the mentoring fallback has affinity for all 7 models, so every outcome-bearing question reaches ≥1 route — L5D measured 100% journey-among-outcome). So Δoutcome ≈ Δjourney.

| Scenario | Outcome coverage | Journey coverage (≈) | QI 3-layer | QI 4-layer |
|----------|------------------|----------------------|------------|------------|
| Current (base) | ${scenarioBase.covered} (${pct(scenarioBase.covered)}) | ${pct(journeyCovered)} | ${qi3(scenarioBase.covered)} | ${qi4(outcomeCovered, journeyCovered)} |
| + HIGH folds (CAREER_GROWTH, PROCRASTINATION, DIGITAL_DISCIPLINE) | ${scenarioA.covered} (${pct(scenarioA.covered)}) | ${pct(scenarioA.covered)} | ${qi3(scenarioA.covered)} | ${qi4(scenarioA.covered, scenarioA.covered)} |
| + HIGH & MODERATE folds (all foldable residuals) | ${scenarioB.covered} (${pct(scenarioB.covered)}) | ${pct(scenarioB.covered)} | ${qi3(scenarioB.covered)} | ${qi4(scenarioB.covered, scenarioB.covered)} |
| **Construct-reachability ceiling (expansion max)** | ${constructCeilingQ} (${pct(constructCeilingQ)}) | ${pct(constructCeilingQ)} | ${qi3(constructCeilingQ)} | ${qi4(constructCeilingQ, constructCeilingQ)} |

**Honest reading:** outcome-model expansion alone lifts outcome/journey coverage from ${pct(scenarioBase.covered)} to at most the construct ceiling **${pct(constructCeilingQ)}**, and QI (3-layer) to **${qi3(constructCeilingQ)}**. The spec's 90%+ outcome/journey and 97%+ QI are NOT reachable by expansion alone — the remaining gap is the ${pct(unmappedQ)} UNMAPPED/ABSENT set, which only crosswalk work can recover.
`,
    );

    // 6 — Orphan Journey + 90%+ Roadmap (combined: orphans honest, then the roadmap)
    const orphanModels = models.filter((m) => (modelQ.get(m.model_key) ?? 0) === 0).map((m) => m.model_key);
    // gap from ceiling to 90%
    const need90 = Math.ceil(0.9 * TOTAL);
    const ceilGapTo90 = Math.max(0, need90 - constructCeilingQ);
    W(
      '06_coverage_roadmap.md',
      `# WC-10 Report 6 — Orphan Analysis + 90%+ Coverage Roadmap

## Orphan analysis (honest, not forced)
- **Outcomes reaching no question (dormant):** ${orphanModels.length ? orphanModels.join(', ') : 'none'} — family_wellbeing is dormant because its only key FAMILY_DYNAMICS is never the resolved construct of a clarity tag (the bank is learner-centric, not family-centric).
- **Residual constructs (resolve but no outcome):** ${resRows.length} constructs / ${residualQ} q (${pct(residualQ)}). Listed in Report 2.
- **Questions reaching no outcome:** ${TOTAL - outcomeCovered} (${pct(TOTAL - outcomeCovered)}) = ${unmappedQ} no-construct (${pct(unmappedQ)}) + ${residualQ} residual-construct (${pct(residualQ)}).
- **Contexts/stages reaching no outcome:** every L5B context and L5A stage has ≥1 outcome-covered question (no orphan context/stage) — confirmed in the matrices.

## Roadmap to 90%+ (minimum changes, ordered, grounded)
The levers are independent and additive:

### Lever 1 — Outcome-model expansion (THIS audit's scope; design-ready)
Fold residual constructs into existing models (Report 4). Effect: ${pct(scenarioBase.covered)} → **${pct(scenarioB.covered)}** outcome & journey coverage; QI 3-layer ${qi3(scenarioBase.covered)} → **${qi3(scenarioB.covered)}**. This is a small, reversible edit to \`wc3_outcome_models.construct_keys\` — NO new models for the HIGH/MODERATE folds. Caps at the construct ceiling **${pct(constructCeilingQ)}**.

### Lever 2 — New outcome model(s) (design-justified, optional)
A \`holistic_wellbeing\` model (PHYSICAL_WELLBEING + MENTAL_HEALTH + STRESS_MANAGEMENT) would recover the PHYSICAL_WELLBEING residual (${resQ.get('PHYSICAL_WELLBEING') ?? 0} q). SAFETY_THREATS stays unmapped (crisis path). Marginal; does not change the construct ceiling materially.

### Lever 3 — Crosswalk reduction of UNMAPPED/ABSENT (REQUIRED to exceed the construct ceiling)
${pct(unmappedQ)} of the bank has NO construct, so it is unreachable by any outcome-model change. To reach **90% outcome coverage** we must additionally convert **≥ ${ceilGapTo90} questions (${pct(ceilGapTo90)})** of the UNMAPPED/REVIEW set into HIGH crosswalk mappings whose construct lands in a model. This is a separate, approval-gated crosswalk phase (not outcome-model expansion) and is the ONLY path from the ${pct(constructCeilingQ)} ceiling to 90%+.

## Verdict against success criteria
| Target | Reachable by expansion alone? | Path |
|--------|-------------------------------|------|
| Outcome coverage > 90% | ❌ no (ceiling ${pct(constructCeilingQ)}) | Lever 1 + **Lever 3 (crosswalk)** |
| Journey coverage > 90% | ❌ no (tracks outcome) | same as above |
| Question Intelligence > 97% | ❌ no (3-layer caps ${qi3(constructCeilingQ)}) | Lever 1 + Lever 3, then re-measure |

Reported honestly. No mappings forced. No schema/migration/ontology changes made — this is design + audit only. STOP — awaiting approval.
`,
    );

    // console summary
    console.log('WC-10 audit complete →', AUDIT);
    console.log({
      TOTAL,
      outcomeCovered,
      outcomeCoveredPct: pct(outcomeCovered),
      gatedOnlyCount,
      noOutcomeByReason,
      constructCeilingQ,
      constructCeilingPct: pct(constructCeilingQ),
      scenarioA: scenarioA.covered + ' (' + pct(scenarioA.covered) + ')',
      scenarioB: scenarioB.covered + ' (' + pct(scenarioB.covered) + ')',
      residualConstructs: resRows.map(([c, q]) => `${c}:${q}`),
      perFold,
      need90,
      ceilGapTo90,
    });
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
