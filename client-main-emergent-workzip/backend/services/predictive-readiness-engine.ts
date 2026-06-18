/**
 * predictive-readiness-engine — spec-named alias.
 *
 * The actual implementation lives in `predictive-competency-engine.ts` (version
 * 6.0.0) which already exposes the full Phase 3 predictive surface:
 *   - predictReadiness        (future readiness band + probability)
 *   - predictBurnoutRisk      (burnout risk score)
 *   - predictLeadershipEmergence
 *   - predictPromotionProximity
 *   - predictSkillDecay       (capability decay)
 * plus persistReadiness / persistBurnout / persistLeadership / persistPromotion.
 *
 * This file re-exports under the spec name so any caller importing
 * `predictive-readiness-engine` resolves cleanly without duplicating logic.
 */
export * from './predictive-competency-engine';
export { PREDICTIVE_ENGINE_VERSION as PREDICTIVE_READINESS_VERSION } from './predictive-competency-engine';
