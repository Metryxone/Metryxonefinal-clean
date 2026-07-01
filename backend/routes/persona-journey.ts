/**
 * CAPADEX 3.0 — Program 3 · Phase 3.2A Persona Experience / Intelligent Journey Router.
 *
 * A read-only, GET-only, PURE resolver that maps an assessment-taker persona selection
 * ({legacyKey, sub-persona, ageBand, goal, timeline}) to the concrete journey the platform
 * already runs for that persona: lifecycle stages, assessment set, dashboard(s), report(s),
 * recommendations, and learning journey. It COMPOSES the existing canonical registries —
 * `config/customer-journey.ts` + `config/assessment-framework.ts` + `lib/lifecycle.ts` — and
 * NEVER fabricates: unmapped personas resolve to `resolved:false` with an honest reason, and
 * per-journey status notes (PARTIAL / adoption-gated) are surfaced verbatim, never inflated.
 *
 * This is the DETERMINISTIC "AI Journey Router" — no LLM, no scoring, no DB, no user data. The
 * only inputs are the persona taxonomy tokens the frontend wizard already collects. It reads no
 * tables, so there is nothing to gate at the DB layer (zero DDL).
 *
 * ROUTES (public — the free assessment flow is anonymous; flag-gated only):
 *   - GET /api/persona-journey/enabled                       flag probe (503 when OFF)
 *   - GET /api/persona-journey/route?legacyKey=&persona=&ageBand=&goal=&timeline=
 *                                                            deterministic journey resolution
 *
 * Strictly additive + reversible + flag-gated (`personaJourneyRouter`, FF_PERSONA_JOURNEY_ROUTER,
 * default OFF): OFF → every route 503 (503-before-work) → byte-identical legacy incl. schema.
 * Never throws: unexpected errors degrade to a 200 honest-degraded JSON.
 */
import type { Express, Request, Response, NextFunction } from 'express';
import { isFlagEnabled } from '../config/feature-flags';
import { CUSTOMER_JOURNEY_MODEL, type CanonicalJourney } from '../config/customer-journey';
import { ASSESSMENT_FRAMEWORK } from '../config/assessment-framework';
import { LIFECYCLE_STAGES, stageLabel, type LifecycleStageCode } from '../lib/lifecycle';

/** The six assessment-taker persona keys the wizard emits (mirrors PersonaKey in behavioural-insights). */
type LegacyPersonaKey = 'student' | 'teacher' | 'campus' | 'jobseeker' | 'parent' | 'professional';

/**
 * DETERMINISTIC persona → canonical-journey routing table. Keys are (sub-persona id) first, then
 * (legacyKey) as fallback. Values are `CanonicalJourney.key` values from CUSTOMER_JOURNEY_MODEL.
 * Only assessment-taker personas are mapped here — B2B/admin personas are routed client-side to
 * their existing login/registration screens and never reach this resolver.
 */
const SUB_PERSONA_TO_JOURNEY: Readonly<Record<string, string>> = {
  // learner track
  campus_student: 'student_career',
  career_explorer: 'fresher_placement',
  skill_development_learner: 'student_career',
  // professional track
  early_career_professional: 'professional_progression',
  mid_career_professional: 'professional_progression',
  people_manager: 'professional_progression',
  senior_leadership: 'professional_progression',
  learning_development: 'professional_progression',
  career_transition_professional: 'professional_progression',
  // proxy track
  parent: 'parent_support',
  teacher_educator: 'faculty_students',
  higher_ed_faculty: 'faculty_students',
  academic_counsellor: 'faculty_students',
  placement_career_cell: 'faculty_students',
};

const LEGACY_KEY_TO_JOURNEY: Readonly<Record<LegacyPersonaKey, string>> = {
  student: 'student_career',
  campus: 'student_career',
  jobseeker: 'fresher_placement',
  professional: 'professional_progression',
  parent: 'parent_support',
  teacher: 'faculty_students',
};

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isFlagEnabled('personaJourneyRouter')) {
    return res.status(503).json({ ok: false, error: 'persona_journey_router_disabled' });
  }
  next();
}

function findJourney(subPersonaId: string | undefined, legacyKey: string | undefined): CanonicalJourney | null {
  if (subPersonaId && SUB_PERSONA_TO_JOURNEY[subPersonaId]) {
    const key = SUB_PERSONA_TO_JOURNEY[subPersonaId];
    return CUSTOMER_JOURNEY_MODEL.find((j) => j.key === key) ?? null;
  }
  if (legacyKey && (LEGACY_KEY_TO_JOURNEY as Record<string, string>)[legacyKey]) {
    const key = (LEGACY_KEY_TO_JOURNEY as Record<string, string>)[legacyKey];
    return CUSTOMER_JOURNEY_MODEL.find((j) => j.key === key) ?? null;
  }
  return null;
}

/** Resolve the lifecycle spine (codes → labels) the journey traverses, with the entry stage first. */
function resolveLifecycle(stages: LifecycleStageCode[]) {
  const traversed = stages
    .map((code) => {
      const s = LIFECYCLE_STAGES.find((x) => x.code === code);
      return s ? { code: s.code, label: stageLabel(s.code), order: s.order, displayAlias: s.displayAlias ?? null } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.order - b.order);
  return {
    entryStage: traversed[0] ?? null,
    stages: traversed,
    fullSpine: LIFECYCLE_STAGES.map((s) => ({ code: s.code, label: s.label, order: s.order })),
  };
}

/** Resolve the journey's assessment keys against the canonical assessment framework registry. */
function resolveAssessments(keys: string[]) {
  return keys.map((k) => {
    const t = ASSESSMENT_FRAMEWORK.find((a) => a.key === k);
    return t
      ? { key: t.key, label: t.label, status: t.status, definition: t.definition }
      : { key: k, label: k, status: 'MISSING' as const, definition: null, unmapped: true };
  });
}

export function registerPersonaJourneyRoutes(app: Express): void {
  // Flag probe (flag STATE is not sensitive). 503 when OFF; res.ok=true only when ON.
  app.get('/api/persona-journey/enabled', flagGate, (_req: Request, res: Response) => {
    res.json({ ok: true, enabled: true });
  });

  // Deterministic journey resolution. Pure over static registries — no DB, no user data.
  app.get('/api/persona-journey/route', flagGate, (req: Request, res: Response) => {
    try {
      const legacyKey = typeof req.query.legacyKey === 'string' ? req.query.legacyKey.trim() : undefined;
      const persona = typeof req.query.persona === 'string' ? req.query.persona.trim() : undefined;
      const ageBand = typeof req.query.ageBand === 'string' ? req.query.ageBand.trim() : undefined;
      const goal = typeof req.query.goal === 'string' ? req.query.goal.trim() : undefined;
      const timeline = typeof req.query.timeline === 'string' ? req.query.timeline.trim() : undefined;

      const journey = findJourney(persona, legacyKey);

      if (!journey) {
        // Honest: this persona has no assessment-taker journey (e.g. a B2B/admin token that
        // slipped through, or an unknown key). Never fabricate a route.
        return res.json({
          ok: true,
          resolved: false,
          reason: 'no_assessment_journey',
          input: { legacyKey: legacyKey ?? null, persona: persona ?? null, ageBand: ageBand ?? null },
          note: 'No assessment-taker journey is defined for this persona. B2B/admin personas use their existing login/registration entry points.',
        });
      }

      const lifecycle = resolveLifecycle(journey.lifecycleStages);
      const assessments = resolveAssessments(journey.assessments);

      // Coverage⟂Confidence⟂Adoption: surface the journey's honest status note verbatim; never inflate.
      return res.json({
        ok: true,
        resolved: true,
        input: {
          legacyKey: legacyKey ?? null,
          persona: persona ?? null,
          ageBand: ageBand ?? null,
          goal: goal ?? null,
          timeline: timeline ?? null,
        },
        journey: {
          key: journey.key,
          label: journey.label,
          persona: journey.persona,
          template: journey.template,
          definition: journey.definition,
          status: journey.status,
          statusNote: journey.statusNote ?? null,
        },
        lifecycle,
        assessments,
        dashboards: journey.dashboards,
        reports: journey.reports,
        recommendations: journey.recommendationRules,
        aiInterpretation: journey.aiInterpretation,
        learningJourney: journey.definition,
        outcomes: journey.outcomes,
        kpis: journey.kpis,
        deterministic: true,
      });
    } catch (err) {
      console.error('[persona-journey] route error:', err);
      return res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });
}
