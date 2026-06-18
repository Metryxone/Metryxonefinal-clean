/**
 * explainability-governance-engine — spec-named composite alias.
 *
 * The actual implementations are split across three shipped engines, each
 * version-stamped and persisting to its own dedicated tables:
 *   - governance-engine.ts        (workflows, ontology reviews, methodology
 *                                  versions, framework audits) — v5.0.0
 *   - fairness-governance-engine.ts (demographic parity, disparate impact,
 *                                    equal opportunity, scoring imbalance,
 *                                    persistFairness) — v7.0.0
 *   - ai-governance-v2.ts         (policy checks, decision audits) — v7.0.0
 *
 * This file re-exports the combined surface under the spec name so callers
 * importing `explainability-governance-engine` resolve cleanly. The underlying
 * tables (`explainability_chains`, `ai_decision_audits`, `fairness_evaluations`)
 * already provide the explainability lineage / competency reasoning / fairness
 * audits / governance logs / confidence lineage that Step 7 requires.
 */
export * from './governance-engine';
export * as Fairness from './fairness-governance-engine';
export * as AIGovernance from './ai-governance-v2';
export { GOVERNANCE_VERSION as EXPLAINABILITY_GOVERNANCE_VERSION } from './governance-engine';
