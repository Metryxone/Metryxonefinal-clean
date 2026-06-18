/**
 * WC-1B-R targeted probe. For a fixed set of master concerns (grounded bridge
 * tags, varying curated-seed coverage), drives the REAL public endpoints on
 * `process.env.PORT` and records the grounding-relevant evidence for each phase:
 *   - Phase 3 resolver  : analyze.signal_grounding + resolution_confidence(_grounded)
 *   - Phase 4 ranking   : clarification_questions id-order
 *   - Phase 2 activation: capadex_session_signals count + grounded-token consumption
 *   - Phase 5 explain   : GET /session/:id/grounding lineage + activated_signal_count
 *
 * Sessions use sim+ emails and are deleted after each probe. Never mutates assets.
 * Usage: PORT=8080 npx tsx scripts/wc1b-r/probe.ts <label>
 * Writes audit/wc1b-r/probe_<label>.json
 */
import { Pool } from 'pg';
import { writeFileSync, mkdirSync } from 'node:fs';
import { groundingCoreToken } from '../../services/signal-grounding-runtime';

const PORT = process.env.PORT || '8080';
const BASE = `http://127.0.0.1:${PORT}`;

const CONCERN_IDS = [
  'CONCERN_COM_1718', // ANALYTICAL_DEVELOPMENT  — 0 curated tier3 (gap-fill should fire)
  'CONCERN_SEL_1618', // GROWTH_TRACKING         — 0 curated
  'CONCERN_ACA_1086', // LEADERSHIP_OWNERSHIP    — 1 curated
  'CONCERN_EMP_17',   // EXAMINATION_STRESS      — 4 curated (gap-fill should NOT fire)
  'CONCERN_CAR_6',    // EMPLOYABILITY           — 4 curated
];

async function http<T = any>(method: 'GET' | 'POST', path: string, body?: any): Promise<{ status: number; json: T | null }> {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body == null ? undefined : JSON.stringify(body),
  });
  let json: any = null;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json };
}

async function main() {
  const label = process.argv[2] || 'run';
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const out: any = { label, port: PORT, generated_at: new Date().toISOString(), concerns: [] };
  const createdSessions: string[] = [];
  try {
    for (const cid of CONCERN_IDS) {
      const metaRes = await pool.query<{ display_label: string; relational_bridge_tag: string }>(
        `SELECT display_label, relational_bridge_tag
           FROM capadex_concerns_master WHERE concern_id = $1 LIMIT 1`,
        [cid],
      );
      const meta = metaRes.rows[0];
      if (!meta) { out.concerns.push({ concern_id: cid, error: 'meta_not_found' }); continue; }
      const concernName = meta.display_label;

      const rec: any = {
        concern_id: cid,
        concern_name: concernName,
        display_label: meta.display_label,
        bridge_tag: meta.relational_bridge_tag,
      };

      // ── Phase 3 — analyze envelope ──────────────────────────────────────────
      const an = await http('POST', '/api/capadex/concern/analyze', {
        raw_concern_text: meta.display_label,
        concern_id: cid,
        primary_persona: 'professional',
        is_proxy: false,
        assessee_name: 'Probe',
      });
      const a: any = an.json || {};
      rec.analyze = {
        status: an.status,
        resolved_concern_id: a.resolved_concern_id ?? null,
        resolution_confidence: a.resolution_confidence ?? null,
        // Key PRESENCE proves the byte-identical contract: flag-off must omit both.
        has_signal_grounding_key: Object.prototype.hasOwnProperty.call(a, 'signal_grounding'),
        has_resolution_confidence_grounded_key: Object.prototype.hasOwnProperty.call(a, 'resolution_confidence_grounded'),
        resolution_confidence_grounded: a.resolution_confidence_grounded ?? null,
        signal_grounding: a.signal_grounding ?? null,
        clarify_question_ids: Array.isArray(a.clarification_questions)
          ? a.clarification_questions.map((q: any) => String(q.id)) : [],
      };

      // ── Phase 4 — clarity ordering (from /start question set) ────────────────
      const email = `sim+probe-${cid}-${Date.now()}@simulation.metryx`;
      const st = await http('POST', '/api/capadex/session/start', {
        concern_name: concernName,
        user_age: 30,
        guest_email: email,
        guest_name: 'Probe',
        persona: '',
      });
      const s: any = st.json || {};
      const sessionId = String(s.session_id || s.id || '');
      const questions: any[] = Array.isArray(s.questions) ? s.questions : [];
      rec.start = { status: st.status, session_id: sessionId, question_ids: questions.map((q) => String(q.id)) };
      if (sessionId) createdSessions.push(sessionId);

      // ── Phase 2 — drive responses → activation ──────────────────────────────
      if (sessionId && questions.length > 0) {
        const responses = questions.filter((q) => q?.id != null).map((q) => ({ item_id: q.id, response_value: 4 }));
        await http('POST', `/api/capadex/session/${sessionId}/respond`, { responses });
        await new Promise((r) => setTimeout(r, 1200));
        await http('POST', `/api/capadex/session/${sessionId}/complete`, {});
        await new Promise((r) => setTimeout(r, 800));

        const sigCountRes = await pool.query<{ n: string }>(
          'SELECT COUNT(*)::text AS n FROM capadex_session_signals WHERE session_id = $1', [sessionId],
        );
        rec.activation = { session_signal_count: Number(sigCountRes.rows[0]?.n || 0) };

        // How many activated signals share a core token with this tag's grounded set.
        const groundedTokRes = await pool.query<{ atomic_signal_name: string | null }>(
          'SELECT atomic_signal_name FROM capadex_bridge_tag_signal_grounding WHERE bridge_tag = $1', [meta.relational_bridge_tag],
        );
        const groundedTokens = new Set(groundedTokRes.rows.map((r) => groundingCoreToken(r.atomic_signal_name)).filter(Boolean));
        const sessSigRes = await pool.query<{ signal_key: string }>(
          'SELECT signal_key FROM capadex_session_signals WHERE session_id = $1', [sessionId],
        );
        rec.activation.grounded_token_overlap = sessSigRes.rows
          .filter((r) => groundedTokens.has(groundingCoreToken(r.signal_key))).length;
      }

      // ── Phase 5 — explainability /grounding ─────────────────────────────────
      if (sessionId) {
        const gr = await http('GET', `/api/capadex/session/${sessionId}/grounding`);
        const g: any = gr.json || {};
        rec.grounding = {
          status: gr.status,
          enabled: g.enabled ?? null,
          grounded: g.grounded ?? null,
          family_count: Array.isArray(g.families) ? g.families.length : null,
          signal_count: Array.isArray(g.signals) ? g.signals.length : null,
          activated_signal_count: g.activated_signal_count ?? null,
        };
      }

      out.concerns.push(rec);
    }
  } finally {
    // Clean up probe sessions across session-scoped tables.
    if (createdSessions.length > 0) {
      const tables = [
        'capadex_responses', 'capadex_evidence', 'capadex_session_signals',
        'capadex_session_composites', 'capadex_session_patterns', 'capadex_session_interventions',
        'capadex_session_telemetry', 'capadex_signal_profiles', 'capadex_linguistic_signals',
        'contradiction_events', 'capadex_reports', 'capadex_behavior_graph',
        'capadex_recommendations', 'capadex_risk_flags', 'capadex_runtime_sessions',
      ];
      for (const t of tables) {
        try { await pool.query(`DELETE FROM ${t} WHERE session_id::text = ANY($1::text[])`, [createdSessions]); } catch { /* absent */ }
      }
      try { await pool.query('DELETE FROM capadex_sessions WHERE id::text = ANY($1::text[])', [createdSessions]); } catch { /* */ }
    }
    mkdirSync('audit/wc1b-r', { recursive: true });
    const file = `audit/wc1b-r/probe_${label}.json`;
    writeFileSync(file, JSON.stringify(out, null, 2));
    console.log(`[probe:${label}] port=${PORT} concerns=${out.concerns.length} -> ${file}`);
    for (const c of out.concerns) {
      console.log(`  ${c.concern_id} tag=${c.bridge_tag} grounded=${c.analyze?.signal_grounding?.grounded ?? '-'} ` +
        `gsig=${c.analyze?.signal_grounding?.grounded_signal_count ?? '-'} ` +
        `resConf=${c.analyze?.resolution_confidence ?? '-'}/grnd=${c.analyze?.resolution_confidence_grounded ?? '-'} ` +
        `sessSig=${c.activation?.session_signal_count ?? '-'} overlap=${c.activation?.grounded_token_overlap ?? '-'} ` +
        `grRoute=${c.grounding?.enabled}/${c.grounding?.activated_signal_count ?? '-'}`);
    }
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
