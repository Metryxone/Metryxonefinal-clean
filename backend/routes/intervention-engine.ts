/**
 * Intervention Engine — Phase 1 S10
 * Route registration: generate + library admin CRUD.
 */

import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { generateInterventions, persistInterventions } from '../services/intervention-engine';
import { isEnabled } from '../services/feature-flags';

type AuthMiddleware = (req: Request, res: Response, next: NextFunction) => void;

// ─── Typed library row ───────────────────────────────────────────────────────

interface LibraryTemplateRow {
  id:                  string;
  construct_key:       string;
  confidence_band:     string;
  emotional_load_band: string;
  persona:             string;
  intervention_text:   string;
  rationale:           string;
  safety_level:        string;
  is_active:           boolean;
  created_at:          string;
}

// ─── Content governance ───────────────────────────────────────────────────────
// These patterns are prohibited in template content to enforce the non-clinical
// safety policy: no diagnoses, no clinical screening instruments, no treatment
// directives, no specific disorder references.

const PROHIBITED_PATTERNS = [
  /\bPHQ-\d+\b/i,
  /\bGAD-\d+\b/i,
  /\bdiagnos(e|is|ed|ing|tic)\b/i,
  /\bclinical (assessment|diagnosis|priority|risk)\b/i,
  /\btreatment (plan|directive|recommendation)\b/i,
  /\bgeneralised anxiety disorder\b/i,
  /\bdepression screening\b/i,
  /\bself-harm (risk|screening)\b/i,
  /\bsuicid(e|al|ality)\b/i,
  /\bpsychiatric\b/i,
];

function checkGovernance(text: string): string | null {
  for (const pattern of PROHIBITED_PATTERNS) {
    if (pattern.test(text)) {
      return `Template contains prohibited clinical language matching: ${pattern.source}`;
    }
  }
  return null;
}

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerInterventionEngineRoutes(
  app:               Express,
  pool:              Pool,
  _requireAuth:      AuthMiddleware,
  requireSuperAdmin: AuthMiddleware,
) {

  // ── POST /api/bios/interventions/generate ─────────────────────────────────
  // Triggers intervention generation for a session, stores results in
  // capadex_recommendations (source='intervention_engine').
  // Feature-flag gated (`interventions`).
  app.post(
    '/api/bios/interventions/generate',
    requireSuperAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { session_id } = req.body as { session_id?: string };

        if (!session_id || typeof session_id !== 'string') {
          return res.status(400).json({ error: 'session_id is required.' });
        }

        // Resolve session: derive user_id server-side (never trust client-supplied value)
        const { rows: sessionMeta } = await pool.query<{ tenant_id: string | null; user_id: string | null }>(
          `SELECT tenant_id, user_id FROM capadex_sessions WHERE id = $1 LIMIT 1`,
          [session_id]
        );
        if (!sessionMeta[0]) {
          return res.status(404).json({ error: 'Session not found.' });
        }
        const tenantId: string | undefined = sessionMeta[0].tenant_id ?? undefined;
        const serverUserId: string | null   = sessionMeta[0].user_id  ?? null;

        if (!isEnabled('interventions', tenantId)) {
          return res.status(403).json({ error: 'Intervention engine feature is not enabled.' });
        }

        const interventions = await generateInterventions(pool, session_id);

        if (interventions.length === 0) {
          return res.json({ ok: true, interventions: [], message: 'No active hypotheses found for session.' });
        }

        await persistInterventions(pool, session_id, serverUserId, interventions);

        // Safety summary: list any referral-level items for caller awareness
        const referralItems = interventions.filter(i => i.pending_human_review);

        return res.json({
          ok: true,
          interventions,
          referral_count:    referralItems.length,
          referral_warning:  referralItems.length > 0
            ? 'One or more interventions are referral-level and require human counsellor approval before delivery.'
            : null,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // ── GET /api/admin/bios/interventions/library ────────────────────────────
  // Lists all governed intervention templates with optional filters.
  app.get(
    '/api/admin/bios/interventions/library',
    requireSuperAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const rawConstruct    = req.query.construct;
        const rawPersona      = req.query.persona;
        const rawSafety       = req.query.safety_level;
        const rawBand         = req.query.confidence_band;
        const rawActiveOnly   = req.query.active_only;

        const construct    = typeof rawConstruct  === 'string' ? rawConstruct  : undefined;
        const persona      = typeof rawPersona    === 'string' ? rawPersona    : undefined;
        const safetyLevel  = typeof rawSafety     === 'string' ? rawSafety     : undefined;
        const band         = typeof rawBand       === 'string' ? rawBand       : undefined;
        const activeOnly   = rawActiveOnly !== 'false'; // default: true

        const conditions: string[] = [];
        const params: (string | boolean)[] = [];

        if (activeOnly)   { conditions.push(`is_active = $${params.length + 1}`); params.push(true); }
        if (construct)    { conditions.push(`construct_key = $${params.length + 1}`); params.push(construct); }
        if (persona)      { conditions.push(`persona = $${params.length + 1}`); params.push(persona); }
        if (safetyLevel)  { conditions.push(`safety_level = $${params.length + 1}`); params.push(safetyLevel); }
        if (band)         { conditions.push(`confidence_band = $${params.length + 1}`); params.push(band); }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const { rows } = await pool.query<LibraryTemplateRow>(
          `SELECT id, construct_key, confidence_band, emotional_load_band, persona,
                  intervention_text, rationale, safety_level, is_active, created_at
           FROM intervention_library
           ${where}
           ORDER BY construct_key, confidence_band, emotional_load_band, persona`,
          params
        );

        // Aggregate counts for governance overview
        const { rows: stats } = await pool.query<{
          safety_level: string;
          count: string;
        }>(
          `SELECT safety_level, COUNT(*)::text AS count
           FROM intervention_library
           WHERE is_active = true
           GROUP BY safety_level`
        );

        return res.json({ templates: rows, total: rows.length, stats });
      } catch (err) {
        next(err);
      }
    }
  );

  // ── POST /api/admin/bios/interventions/library ───────────────────────────
  // Adds a new governed intervention template.
  app.post(
    '/api/admin/bios/interventions/library',
    requireSuperAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const {
          construct_key,
          confidence_band,
          emotional_load_band,
          persona,
          intervention_text,
          rationale,
          safety_level,
        } = req.body as {
          construct_key?:       string;
          confidence_band?:     string;
          emotional_load_band?: string;
          persona?:             string;
          intervention_text?:   string;
          rationale?:           string;
          safety_level?:        string;
        };

        // Validate required fields
        const required = { construct_key, confidence_band, emotional_load_band, persona, intervention_text, rationale, safety_level };
        const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
        if (missing.length > 0) {
          return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
        }

        const VALID_BANDS    = ['high', 'moderate', 'low'];
        const VALID_PERSONAS = ['student', 'parent', 'teacher', 'counsellor'];
        const VALID_SAFETY   = ['informational', 'supportive', 'referral'];

        if (!VALID_BANDS.includes(confidence_band!))    return res.status(400).json({ error: 'confidence_band must be high|moderate|low' });
        if (!VALID_BANDS.includes(emotional_load_band!)) return res.status(400).json({ error: 'emotional_load_band must be high|moderate|low' });
        if (!VALID_PERSONAS.includes(persona!))         return res.status(400).json({ error: 'persona must be student|parent|teacher|counsellor' });
        if (!VALID_SAFETY.includes(safety_level!))      return res.status(400).json({ error: 'safety_level must be informational|supportive|referral' });

        // Content governance: reject prohibited clinical language
        const govViolation = checkGovernance(intervention_text!) || checkGovernance(rationale!);
        if (govViolation) return res.status(422).json({ error: govViolation });

        const { rows } = await pool.query<LibraryTemplateRow>(
          `INSERT INTO intervention_library
             (construct_key, confidence_band, emotional_load_band, persona,
              intervention_text, rationale, safety_level)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           RETURNING *`,
          [construct_key, confidence_band, emotional_load_band, persona,
           intervention_text, rationale, safety_level]
        );

        return res.status(201).json({ ok: true, template: rows[0] });
      } catch (err) {
        next(err);
      }
    }
  );

  // ── PATCH /api/admin/bios/interventions/library/:id ─────────────────────
  // Edits or soft-deletes a governed intervention template.
  app.patch(
    '/api/admin/bios/interventions/library/:id',
    requireSuperAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const id = String(req.params.id);

        const {
          construct_key,
          confidence_band,
          emotional_load_band,
          persona,
          intervention_text,
          rationale,
          safety_level,
          is_active,
        } = req.body as {
          construct_key?:       string;
          confidence_band?:     string;
          emotional_load_band?: string;
          persona?:             string;
          intervention_text?:   string;
          rationale?:           string;
          safety_level?:        string;
          is_active?:           boolean;
        };

        // Pre-validate enum fields before building SET clauses (explicit 400 > DB constraint error)
        const VALID_BANDS    = ['high', 'moderate', 'low'];
        const VALID_PERSONAS = ['student', 'parent', 'teacher', 'counsellor'];
        const VALID_SAFETY   = ['informational', 'supportive', 'referral'];

        if (confidence_band     !== undefined && !VALID_BANDS.includes(confidence_band))
          return res.status(400).json({ error: 'confidence_band must be high|moderate|low' });
        if (emotional_load_band !== undefined && !VALID_BANDS.includes(emotional_load_band))
          return res.status(400).json({ error: 'emotional_load_band must be high|moderate|low' });
        if (persona             !== undefined && !VALID_PERSONAS.includes(persona))
          return res.status(400).json({ error: 'persona must be student|parent|teacher|counsellor' });
        if (safety_level        !== undefined && !VALID_SAFETY.includes(safety_level))
          return res.status(400).json({ error: 'safety_level must be informational|supportive|referral' });

        const setClauses: string[] = [];
        const params: unknown[]    = [];

        if (construct_key       !== undefined) { setClauses.push(`construct_key = $${params.length + 1}`);       params.push(construct_key); }
        if (confidence_band     !== undefined) { setClauses.push(`confidence_band = $${params.length + 1}`);     params.push(confidence_band); }
        if (emotional_load_band !== undefined) { setClauses.push(`emotional_load_band = $${params.length + 1}`); params.push(emotional_load_band); }
        if (persona             !== undefined) { setClauses.push(`persona = $${params.length + 1}`);             params.push(persona); }
        if (intervention_text   !== undefined) { setClauses.push(`intervention_text = $${params.length + 1}`);   params.push(intervention_text); }
        if (rationale           !== undefined) { setClauses.push(`rationale = $${params.length + 1}`);           params.push(rationale); }
        if (safety_level        !== undefined) { setClauses.push(`safety_level = $${params.length + 1}`);        params.push(safety_level); }
        if (is_active           !== undefined) { setClauses.push(`is_active = $${params.length + 1}`);           params.push(is_active); }

        if (setClauses.length === 0) {
          return res.status(400).json({ error: 'No fields provided to update.' });
        }

        // Content governance: reject prohibited clinical language in new content
        if (intervention_text !== undefined) {
          const govViolation = checkGovernance(intervention_text);
          if (govViolation) return res.status(422).json({ error: govViolation });
        }
        if (rationale !== undefined) {
          const govViolation = checkGovernance(rationale);
          if (govViolation) return res.status(422).json({ error: govViolation });
        }

        params.push(id);
        const { rows } = await pool.query<LibraryTemplateRow>(
          `UPDATE intervention_library SET ${setClauses.join(', ')}
           WHERE id = $${params.length}
           RETURNING *`,
          params
        );

        if (rows.length === 0) {
          return res.status(404).json({ error: 'Template not found.' });
        }

        return res.json({ ok: true, template: rows[0] });
      } catch (err) {
        next(err);
      }
    }
  );
}
