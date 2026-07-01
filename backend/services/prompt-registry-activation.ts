/**
 * Prompt Registry Activation (CAPADEX 3.0 · Program 3 · Phase 3.1 · AP-9)
 * ===========================================================================
 * Closes GAP-AP-9 (AI prompts embedded in code, not in the governed registry) by
 * REUSING the EXISTING AI-governance prompt registry (`aig_prompts` +
 * `aig_prompt_versions`) — no new engine, no new table. It:
 *   1. Registers the canonical code-embedded prompts as governed prompt rows with
 *      an active version (the code literal becomes the v1 template).
 *   2. Provides a read-through `resolvePrompt(slug, fallback)` so call sites can
 *      opt into the governed active version while remaining byte-identical when the
 *      flag is OFF (they simply keep passing — and getting back — their literal).
 *
 * Contract: additive · flag-gated · byte-identical OFF (registration only runs on
 * the flag-gated write path; resolvePrompt returns the caller's fallback verbatim
 * whenever the registry has no active version) · never fabricates prompt content
 * (the registered template IS the real code literal).
 */
import type { Pool } from 'pg';
import crypto from 'crypto';
import { ensureAiGovernanceSchema } from './ai-governance-schema';

export interface CodeEmbeddedPrompt {
  slug: string;
  name: string;
  category: string;
  description: string;
  system_context: string | null;
  template: string;         // the REAL code literal, verbatim
  variables?: string[];
}

/**
 * Canonical inventory of the AI prompts currently embedded in code. Each `template`
 * is the real literal from its call site (kept in one governed place). Adding a new
 * code-embedded prompt = add an entry here (single source of truth).
 */
export const CODE_EMBEDDED_PROMPTS: CodeEmbeddedPrompt[] = [
  {
    slug: 'capadex.reflection.summary',
    name: 'CAPADEX Reflection Summary',
    category: 'reflection',
    description: 'Summarises a learner reflection into an encouraging, non-clinical narrative.',
    system_context: 'You are a supportive career coach. Be honest, specific, and encouraging. Never diagnose. Never fabricate facts not present in the input.',
    template: 'Given the learner reflection below, write a short (2-3 sentence) encouraging summary grounded ONLY in what they wrote. Do not invent achievements.\n\nReflection:\n{{reflection}}',
    variables: ['reflection'],
  },
  {
    slug: 'capadex.recommendation.narrative',
    name: 'CAPADEX Recommendation Narrative',
    category: 'recommendation',
    description: 'Turns a computed recommendation payload into plain-language guidance.',
    system_context: 'You are an assessment guidance writer. Explain the recommendation clearly. Do not add data beyond the provided payload.',
    template: 'Write a clear, plain-language explanation of the following recommendation for the learner. Use only the provided fields.\n\nRecommendation JSON:\n{{recommendation_json}}',
    variables: ['recommendation_json'],
  },
  {
    slug: 'capadex.report.interpretation',
    name: 'CAPADEX Report Interpretation',
    category: 'report',
    description: 'Interprets a scored assessment profile into a balanced strengths/growth narrative.',
    system_context: 'You are a psychometric report writer. Report strengths and growth areas separately. Never fabricate scores. Abstain when data is insufficient.',
    template: 'Interpret the following scored profile into a balanced narrative (strengths then growth areas). Use ONLY the provided scores; if a dimension is null, say it was not measured.\n\nProfile JSON:\n{{profile_json}}',
    variables: ['profile_json'],
  },
];

// ── never-throws helpers ────────────────────────────────────────────────────
async function tableExists(pool: Pool, qualified: string): Promise<boolean> {
  try {
    const { rows } = await pool.query('SELECT to_regclass($1) AS reg', [qualified]);
    return Boolean(rows[0]?.reg);
  } catch { return false; }
}

function contentHash(p: CodeEmbeddedPrompt): string {
  return crypto.createHash('sha256').update(`${p.system_context || ''}\n${p.template}`).digest('hex').slice(0, 16);
}

export interface RegisterResult { registered: number; activated: number; skipped: number; }

/** Register every code-embedded prompt into the governed registry with an active v1. Idempotent. */
export async function registerCodeEmbeddedPrompts(pool: Pool): Promise<RegisterResult> {
  await ensureAiGovernanceSchema(pool);
  let registered = 0, activated = 0, skipped = 0;
  for (const p of CODE_EMBEDDED_PROMPTS) {
    try {
      const { rows: pr } = await pool.query(
        `INSERT INTO aig_prompts (name, slug, description, category, status, owner, current_version)
         VALUES ($1, $2, $3, $4, 'active', 'system:phase-3.1', 1)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description,
           category = EXCLUDED.category, updated_at = NOW()
         RETURNING id`,
        [p.name, p.slug, p.description, p.category],
      );
      const promptId = pr[0].id as string;
      registered++;
      const hash = contentHash(p);
      // Only insert a new active version if the content hash changed (idempotent).
      const { rows: existing } = await pool.query(
        `SELECT version, content_hash, is_active FROM aig_prompt_versions WHERE prompt_id = $1 ORDER BY version DESC LIMIT 1`,
        [promptId],
      );
      if (existing.length && existing[0].content_hash === hash) {
        if (!existing[0].is_active) {
          await pool.query(`UPDATE aig_prompt_versions SET is_active = true WHERE prompt_id = $1 AND version = $2`, [promptId, existing[0].version]);
          activated++;
        } else { skipped++; }
        continue;
      }
      const nextVersion = existing.length ? Number(existing[0].version) + 1 : 1;
      await pool.query(`UPDATE aig_prompt_versions SET is_active = false WHERE prompt_id = $1`, [promptId]);
      await pool.query(
        `INSERT INTO aig_prompt_versions (prompt_id, version, template, system_context, variables, changelog, author, content_hash, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, 'system:phase-3.1', $7, true)
         ON CONFLICT (prompt_id, version) DO UPDATE SET template = EXCLUDED.template, system_context = EXCLUDED.system_context,
           variables = EXCLUDED.variables, content_hash = EXCLUDED.content_hash, is_active = true`,
        [promptId, nextVersion, p.template, p.system_context, p.variables ?? [], 'Registered from code-embedded literal (AP-9).', hash],
      );
      await pool.query(`UPDATE aig_prompts SET current_version = $2, updated_at = NOW() WHERE id = $1`, [promptId, nextVersion]);
      activated++;
    } catch { skipped++; }
  }
  return { registered, activated, skipped };
}

export interface ResolvedPrompt { slug: string; template: string; system_context: string | null; source: 'registry' | 'fallback'; version: number | null; }

/**
 * Read-through resolver. Returns the governed active version when present, else the
 * caller's `fallback` literal verbatim (byte-identical legacy behaviour). Never throws.
 */
export async function resolvePrompt(pool: Pool, slug: string, fallback: { template: string; system_context?: string | null }): Promise<ResolvedPrompt> {
  const fb: ResolvedPrompt = { slug, template: fallback.template, system_context: fallback.system_context ?? null, source: 'fallback', version: null };
  if (!(await tableExists(pool, 'public.aig_prompt_versions'))) return fb;
  try {
    const { rows } = await pool.query(
      `SELECT v.template, v.system_context, v.version
         FROM aig_prompt_versions v JOIN aig_prompts p ON p.id = v.prompt_id
        WHERE p.slug = $1 AND v.is_active = true
        ORDER BY v.version DESC LIMIT 1`,
      [slug],
    );
    if (!rows.length) return fb;
    return { slug, template: rows[0].template, system_context: rows[0].system_context ?? null, source: 'registry', version: Number(rows[0].version) };
  } catch { return fb; }
}

export async function registryCoverage(pool: Pool): Promise<{ total_code_prompts: number; registered: number; active: number; note: string }> {
  const total = CODE_EMBEDDED_PROMPTS.length;
  if (!(await tableExists(pool, 'public.aig_prompts'))) {
    return { total_code_prompts: total, registered: 0, active: 0, note: 'Registry not yet activated (flag-gated). null≠0.' };
  }
  try {
    const slugs = CODE_EMBEDDED_PROMPTS.map((p) => p.slug);
    const { rows: reg } = await pool.query(`SELECT COUNT(*)::int AS n FROM aig_prompts WHERE slug = ANY($1)`, [slugs]);
    const { rows: act } = await pool.query(
      `SELECT COUNT(DISTINCT p.slug)::int AS n FROM aig_prompts p JOIN aig_prompt_versions v ON v.prompt_id = p.id
        WHERE p.slug = ANY($1) AND v.is_active = true`, [slugs],
    );
    return { total_code_prompts: total, registered: Number(reg[0]?.n ?? 0), active: Number(act[0]?.n ?? 0), note: 'Coverage of code-embedded prompts now under governance.' };
  } catch {
    return { total_code_prompts: total, registered: 0, active: 0, note: 'Registry read error.' };
  }
}
