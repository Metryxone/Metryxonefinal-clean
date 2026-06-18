// LDE — Longitudinal Development Engine: Temporal Routes
// Sections 1–4, 7–8: Data Lake, Event Sourcing, Feature Store, Embedding Engine, Signal Aggregation, Timeline Engine

import { Express } from "express";
import { Pool } from "pg";

// ── Seed LDE from CAPADEX history ─────────────────────────────────────────
// Called lazily (first journey load) and from postCompletionHooks.
// Maps CAPADEX scores → LDE timeline, momentum, narrative, and identity tables.
export async function seedLDEFromCapadex(pool: Pool, userId: string): Promise<void> {
  // Guard: skip if timeline data already exists for this user
  const existing = await pool.query(`SELECT 1 FROM lde_timelines WHERE user_id=$1 LIMIT 1`, [userId]);
  if (existing.rows.length > 0) return;

  // Fetch all completed sessions for this user (by email = userId)
  const sessionsR = await pool.query(
    `SELECT cs.id, cs.concern_name, cs.stage_code, cs.created_at,
            cr.score, cr.score_level, cr.insight
     FROM capadex_sessions cs
     LEFT JOIN capadex_reports cr ON cr.session_id = cs.id
     WHERE cs.guest_email = $1 AND cs.status = 'completed' AND cr.score IS NOT NULL
     ORDER BY cs.created_at ASC`,
    [userId]
  );
  const sessions = sessionsR.rows;
  if (!sessions.length) return;

  // ── 1. Timeline checkpoints ────────────────────────────────────────────────
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    const sc: number = parseFloat(s.score) || 0;
    const beh  = parseFloat((sc * 0.82).toFixed(1));
    const emo  = parseFloat((sc * 0.88).toFixed(1));
    const res  = parseFloat((sc * 0.76).toFixed(1));
    const emp  = parseFloat((sc * 0.72).toFixed(1));
    const lead = parseFloat((sc * 0.68).toFixed(1));
    const milestones: string[] = [];
    if (i === 0)                    milestones.push('First Assessment');
    if (sc >= 75)                   milestones.push('High Performance');
    if (s.stage_code === 'CAP_MAS') milestones.push('Mastery Stage');
    // milestone_flags = jsonb → must use JSON.stringify
    await pool.query(
      `INSERT INTO lde_timelines
         (user_id, checkpoint_date, behavioural_score, emotional_score, resilience_score,
          employability_score, leadership_score, milestone_flags, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [userId, s.created_at, beh, emo, res, emp, lead,
       JSON.stringify(milestones), `${s.concern_name} · ${s.stage_code} · Score ${sc}`]
    );
  }

  // ── 2. Momentum ──────────────────────────────────────────────────────────
  const scores  = sessions.map(s => parseFloat(s.score) || 0);
  const latest  = scores[scores.length - 1];
  const avg     = scores.reduce((a, b) => a + b, 0) / scores.length;
  const trend   = scores.length > 1 ? scores[scores.length - 1] - scores[0] : 0;

  let momentumState: string;
  if (latest >= 80)      momentumState = 'breakthrough';
  else if (latest >= 65) momentumState = 'acceleration';
  else if (latest >= 50) momentumState = 'stable';
  else if (trend > 5)    momentumState = 'recovery';
  else if (latest < 30)  momentumState = 'collapse';
  else                   momentumState = 'stagnation';

  const velocity       = parseFloat(Math.min(1, Math.max(0, (latest / 100) * 0.9)).toFixed(3));
  const stability      = parseFloat(Math.min(1, Math.max(0, (avg / 100) * 0.85)).toFixed(3));
  const sustainability = parseFloat(Math.min(1, Math.max(0, (avg / 100) * 0.80)).toFixed(3));
  const forecast30d    = parseFloat(Math.min(1, Math.max(0, (latest + trend * 0.3) / 100)).toFixed(3));
  const trendDir       = trend > 5 ? 'improving' : trend < -5 ? 'declining' : 'stable';

  await pool.query(
    `INSERT INTO lde_momentum
       (user_id, momentum_state, momentum_score, growth_velocity, stability_score,
        sustainability_score, trend_direction, forecast_30d, computed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
    [userId, momentumState, parseFloat((latest / 100).toFixed(3)),
     velocity, stability, sustainability, trendDir, forecast30d]
  );

  // ── 3. Developmental narrative ────────────────────────────────────────────
  const latestSession   = sessions[sessions.length - 1];
  const latestScore     = parseFloat(latestSession.score) || 0;
  const concernNames    = [...new Set<string>(sessions.map((s: any) => s.concern_name))];
  const assessmentCount = sessions.length;
  const tone  = latestScore >= 70 ? 'celebratory' : latestScore >= 50 ? 'supportive' : 'analytical';

  const openingMap: Record<string, string> = {
    celebratory: `You have built real momentum in how you understand and navigate ${latestSession.concern_name}. A score of ${latestScore} across ${assessmentCount} checkpoint${assessmentCount > 1 ? 's' : ''} shows your self-awareness is translating into measurable behavioural strength.`,
    supportive:  `You are actively working through ${latestSession.concern_name}, and that effort is visible in your results. With a score of ${latestScore}, you are in a developmental zone — not stuck, but building. The work you are doing lays groundwork that compounds over time.`,
    analytical:  `Your assessment data on ${latestSession.concern_name} shows a score of ${latestScore}, placing you in an early developmental stage. This is not a ceiling — it is a starting point. Every checkpoint you complete adds precision to who you are becoming.`,
  };
  const multiNote = concernNames.length > 1
    ? ` Across ${concernNames.length} concern areas — ${concernNames.join(', ')} — your data reveals a multi-dimensional growth picture.` : '';
  const closingMap: Record<string, string> = {
    celebratory: ` The next 30 days are a key window to consolidate these gains and push toward the next stage.`,
    supportive:  ` Your journey is progressing. Each assessment you complete sharpens the intelligence available to guide you forward.`,
    analytical:  ` Completing more assessments will unlock deeper pattern recognition and more precise guidance.`,
  };

  const content = openingMap[tone] + multiNote + closingMap[tone];
  // key_themes and data_sources = jsonb → JSON.stringify
  await pool.query(
    `INSERT INTO lde_narratives
       (user_id, narrative_type, title, content, tone, key_themes, data_sources, generated_at)
     VALUES ($1,'developmental',$2,$3,$4,$5,$6,NOW())`,
    [userId,
     `Your ${latestSession.concern_name} Development Journey`,
     content, tone,
     JSON.stringify([latestSession.concern_name, latestSession.stage_code, trendDir, momentumState]),
     JSON.stringify({ sessions: assessmentCount, source: 'capadex' })]
  );

  // ── 4. Identity evolution checkpoint ─────────────────────────────────────
  // checkpoint_date = date type → pass as date string
  const sc0 = latestScore / 100;
  const today = new Date().toISOString().slice(0, 10);
  await pool.query(
    `INSERT INTO lde_identity_evolution
       (user_id, checkpoint_date, confidence_score, self_efficacy_score, aspiration_score,
        motivation_score, identity_coherence, breakthrough_flag, shift_detected, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [userId, today,
     parseFloat((sc0 * 0.85).toFixed(3)),
     parseFloat((sc0 * 0.80).toFixed(3)),
     parseFloat((sc0 * 0.90).toFixed(3)),
     parseFloat((sc0 * 0.83).toFixed(3)),
     parseFloat((sc0 * 0.75).toFixed(3)),
     latestScore >= 75, trend > 10,
     `Seeded from ${assessmentCount} CAPADEX session(s)`]
  );
}

function rnd(min: number, max: number, decimals = 3) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

export function registerLDETemporalRoutes(app: Express, pool: Pool) {

  // ── Section 1: Event Sourcing ─────────────────────────────────────────────
  app.post("/api/lde/events/ingest", async (req, res) => {
    try {
      const { user_id, tenant_id, event_type, event_payload = {}, source = 'system' } = req.body;
      if (!user_id || !event_type) return res.status(400).json({ error: "user_id + event_type required" });
      const validTypes = ['SIGNAL_CAPTURED','TRAJECTORY_UPDATED','INTERVENTION_COMPLETED','DRIFT_DETECTED','BREAKTHROUGH_DETECTED','IDENTITY_SHIFT','FRACTURE_DETECTED','HIDDEN_TRANSFORMATION','TRUST_CHANGE','MOMENTUM_UPDATE'];
      if (!validTypes.includes(event_type)) return res.status(400).json({ error: `Invalid event_type. Valid: ${validTypes.join(', ')}` });
      const r = await pool.query(
        `INSERT INTO lde_events (user_id, tenant_id, event_type, event_payload, source)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [user_id, tenant_id || null, event_type, JSON.stringify(event_payload), source]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/lde/events/replay", async (req, res) => {
    try {
      const { user_id, from_date } = req.body;
      if (!user_id) return res.status(400).json({ error: "user_id required" });
      const condition = from_date ? `AND created_at >= $2` : '';
      const params: any[] = from_date ? [user_id, from_date] : [user_id];
      const eventsR = await pool.query(
        `SELECT * FROM lde_events WHERE user_id=$1 ${condition} ORDER BY created_at ASC`,
        params
      );
      const events = eventsR.rows;
      // Reconstruct feature state from events
      const featureState: Record<string, any> = { user_id, replayed_events: events.length, reconstructed_at: new Date().toISOString() };
      let trajectoryUpdates = 0; let signals = 0; let interventions = 0;
      for (const ev of events) {
        if (ev.event_type === 'SIGNAL_CAPTURED') signals++;
        if (ev.event_type === 'TRAJECTORY_UPDATED') trajectoryUpdates++;
        if (ev.event_type === 'INTERVENTION_COMPLETED') interventions++;
      }
      featureState.summary = { signals, trajectory_updates: trajectoryUpdates, interventions };
      await pool.query(
        `INSERT INTO lde_events (user_id, event_type, event_payload, source)
         VALUES ($1,'TRAJECTORY_UPDATED',$2,'replay')`,
        [user_id, JSON.stringify({ replay_summary: featureState.summary, replayed: events.length })]
      );
      res.json({ replayed: events.length, feature_state: featureState, events: events.slice(0, 20) });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/lde/events/log", async (req, res) => {
    try {
      const { page = 1, limit = 50, event_type, user_id, days = 7 } = req.query as any;
      const off = (parseInt(page) - 1) * parseInt(limit);
      const conditions: string[] = [`created_at > NOW()-INTERVAL '${parseInt(days)} days'`];
      const params: any[] = [];
      if (event_type) { params.push(event_type); conditions.push(`event_type=$${params.length}`); }
      if (user_id) { params.push(`%${user_id}%`); conditions.push(`user_id ILIKE $${params.length}`); }
      const where = `WHERE ${conditions.join(' AND ')}`;
      params.push(parseInt(limit), off);
      const [listR, statsR, kpiR] = await Promise.all([
        pool.query(`SELECT * FROM lde_events ${where} ORDER BY created_at DESC LIMIT $${params.length-1} OFFSET $${params.length}`, params),
        pool.query(`SELECT event_type, COUNT(*) cnt FROM lde_events ${where} GROUP BY event_type ORDER BY cnt DESC`, params.slice(0,-2)),
        pool.query(`SELECT COUNT(*) total, COUNT(DISTINCT user_id) unique_users, SUM(CASE WHEN processed THEN 0 ELSE 1 END) unprocessed FROM lde_events ${where}`, params.slice(0,-2))
      ]);
      res.json({ events: listR.rows, by_type: statsR.rows, kpi: kpiR.rows[0] });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 2: Feature Store ───────────────────────────────────────────────
  app.post("/api/lde/features/upsert", async (req, res) => {
    try {
      const { user_id, tenant_id, behavioural_features = {}, resilience_features = {}, emotional_features = {}, developmental_features = {}, cognitive_features = {}, biomarkers = {} } = req.body;
      if (!user_id) return res.status(400).json({ error: "user_id required" });
      const entropy = rnd(0, 0.5);
      const coverage = rnd(0.5, 1.0);
      const r = await pool.query(
        `INSERT INTO lde_feature_store
          (user_id, tenant_id, behavioural_features, resilience_features, emotional_features,
           developmental_features, cognitive_features, biomarkers, entropy_score, coverage_pct, feature_version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1)
         ON CONFLICT (user_id) DO UPDATE SET
          behavioural_features=EXCLUDED.behavioural_features, resilience_features=EXCLUDED.resilience_features,
          emotional_features=EXCLUDED.emotional_features, developmental_features=EXCLUDED.developmental_features,
          cognitive_features=EXCLUDED.cognitive_features, biomarkers=EXCLUDED.biomarkers,
          entropy_score=EXCLUDED.entropy_score, coverage_pct=EXCLUDED.coverage_pct,
          feature_version=lde_feature_store.feature_version+1, computed_at=NOW()
         RETURNING *`,
        [user_id, tenant_id||null, JSON.stringify(behavioural_features), JSON.stringify(resilience_features),
         JSON.stringify(emotional_features), JSON.stringify(developmental_features),
         JSON.stringify(cognitive_features), JSON.stringify(biomarkers), entropy, coverage]
      );
      await pool.query(
        `INSERT INTO lde_events (user_id, tenant_id, event_type, event_payload, source)
         VALUES ($1,$2,'SIGNAL_CAPTURED',$3,'feature_store')`,
        [user_id, tenant_id||null, JSON.stringify({ feature_version: r.rows[0].feature_version })]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/lde/features/:userId", async (req, res) => {
    try {
      const r = await pool.query(`SELECT * FROM lde_feature_store WHERE user_id=$1`, [req.params.userId]);
      if (!r.rows.length) return res.status(404).json({ error: "Feature store not found for user" });
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/lde/features/coverage", async (req, res) => {
    try {
      const [kpiR, dimR, recentR] = await Promise.all([
        pool.query(`SELECT COUNT(*) total_users, AVG(coverage_pct) avg_coverage, AVG(entropy_score) avg_entropy,
                    SUM(CASE WHEN anomaly_flag THEN 1 ELSE 0 END) anomaly_count FROM lde_feature_store`),
        pool.query(`SELECT AVG(coverage_pct) avg_coverage,
                    AVG((behavioural_features->>'score')::float) avg_behavioural,
                    AVG((resilience_features->>'score')::float) avg_resilience
                    FROM lde_feature_store`),
        pool.query(`SELECT user_id, coverage_pct, entropy_score, feature_version, computed_at FROM lde_feature_store ORDER BY computed_at DESC LIMIT 20`)
      ]);
      res.json({ kpi: kpiR.rows[0], dimensions: dimR.rows[0], recent: recentR.rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 3: Embedding Engine ────────────────────────────────────────────
  app.post("/api/lde/embeddings/generate", async (req, res) => {
    try {
      const { user_id, tenant_id, source_scores = {} } = req.body;
      if (!user_id) return res.status(400).json({ error: "user_id required" });
      const types = ['behavioural','emotional','resilience','developmental','cognitive','composite'];
      const results: any[] = [];
      for (const t of types) {
        const baseScore = source_scores[t] || rnd(0.3, 0.9);
        const dims = 32;
        const vector = Array.from({ length: dims }, () => (baseScore + rnd(-0.2, 0.2) * Math.random()));
        const r = await pool.query(
          `INSERT INTO lde_embeddings (user_id, tenant_id, embedding_type, vector, dimension_count, source_scores)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
          [user_id, tenant_id||null, t, JSON.stringify(vector), dims, JSON.stringify(source_scores)]
        );
        results.push(r.rows[0]);
      }
      res.json({ generated: results.length, embeddings: results.map(r => ({ id: r.id, type: r.embedding_type, dims: r.dimension_count })) });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/lde/embeddings/:userId", async (req, res) => {
    try {
      const { type } = req.query as any;
      const params: any[] = [req.params.userId];
      const condition = type ? `AND embedding_type=$2` : '';
      if (type) params.push(type);
      const r = await pool.query(
        `SELECT id, embedding_type, dimension_count, source_scores, computed_at FROM lde_embeddings WHERE user_id=$1 ${condition} ORDER BY computed_at DESC`,
        params
      );
      res.json({ user_id: req.params.userId, embeddings: r.rows });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 4: Signal Aggregation ──────────────────────────────────────────
  app.post("/api/lde/signals/aggregate", async (req, res) => {
    try {
      const { user_id, tenant_id, raw_signals = [] } = req.body;
      if (!user_id) return res.status(400).json({ error: "user_id required" });
      const entropy = rnd(0, 0.6);
      const amplified = raw_signals.map((s: any) => ({ ...s, amplified_strength: Math.min(1, (s.strength || 0.5) * rnd(1.0, 3.5)) }));
      const anomalies = amplified.filter((s: any) => s.amplified_strength > 0.8);
      const r = await pool.query(
        `INSERT INTO lde_signal_aggregations
          (user_id, tenant_id, raw_signal_count, amplified_signals, entropy_score, anomaly_count, anomaly_details, weak_signal_amplification_factor)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [user_id, tenant_id||null, raw_signals.length, JSON.stringify(amplified),
         entropy, anomalies.length, JSON.stringify(anomalies), rnd(1.0, 3.5)]
      );
      await pool.query(
        `INSERT INTO lde_events (user_id, tenant_id, event_type, event_payload, source)
         VALUES ($1,$2,'SIGNAL_CAPTURED',$3,'signal_aggregation')`,
        [user_id, tenant_id||null, JSON.stringify({ raw: raw_signals.length, anomalies: anomalies.length, entropy })]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Section 7: Timeline Engine ─────────────────────────────────────────────
  app.post("/api/lde/timeline/update", async (req, res) => {
    try {
      const { user_id, tenant_id, behavioural_score, emotional_score, resilience_score, employability_score, leadership_score, intervention_count = 0, milestone_flags = [], notes, checkpoint_date } = req.body;
      if (!user_id) return res.status(400).json({ error: "user_id required" });
      const r = await pool.query(
        `INSERT INTO lde_timelines
          (user_id, tenant_id, checkpoint_date, behavioural_score, emotional_score, resilience_score,
           employability_score, leadership_score, intervention_count, milestone_flags, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [user_id, tenant_id||null, checkpoint_date || new Date().toISOString().split('T')[0],
         behavioural_score, emotional_score, resilience_score, employability_score, leadership_score,
         intervention_count, JSON.stringify(milestone_flags), notes||null]
      );
      await pool.query(
        `INSERT INTO lde_events (user_id, tenant_id, event_type, event_payload, source)
         VALUES ($1,$2,'TRAJECTORY_UPDATED',$3,'timeline')`,
        [user_id, tenant_id||null, JSON.stringify({ checkpoint: r.rows[0].checkpoint_date })]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/lde/timeline/:userId", async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT * FROM lde_timelines WHERE user_id=$1 ORDER BY checkpoint_date ASC`,
        [req.params.userId]
      );
      const latest = r.rows[r.rows.length - 1];
      res.json({ user_id: req.params.userId, timeline: r.rows, checkpoint_count: r.rows.length, latest });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── User Growth Journey (session-authenticated user-facing endpoint) ────────
  // Access is gated on a valid capadex session_id (UUID), which acts as an
  // unguessable bearer token — same pattern as GET /api/capadex/report/:session_id.
  // The user_id (email) is derived server-side from the session record; clients
  // cannot supply an arbitrary email to read another user's data.
  app.get("/api/lde/journey/session/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      if (!sessionId || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
        return res.status(400).json({ error: "Invalid session_id format" });
      }

      // Resolve the email (user_id) from the session — authoritative identity check
      const sessionR = await pool.query(
        `SELECT guest_email FROM capadex_sessions WHERE id=$1 LIMIT 1`,
        [sessionId]
      );
      if (!sessionR.rows.length || !sessionR.rows[0].guest_email) {
        return res.status(404).json({ error: "Session not found or has no registered email" });
      }
      const userId = sessionR.rows[0].guest_email.toLowerCase().trim();

      const [timelineR, momentumR, narrativesR, identityR] = await Promise.all([
        pool.query(
          `SELECT checkpoint_date, behavioural_score, emotional_score, resilience_score,
                  employability_score, leadership_score, milestone_flags, notes
           FROM lde_timelines WHERE user_id=$1 ORDER BY checkpoint_date ASC`,
          [userId]
        ),
        pool.query(
          `SELECT momentum_state, momentum_score, growth_velocity, stability_score,
                  sustainability_score, trend_direction, forecast_30d, computed_at
           FROM lde_momentum WHERE user_id=$1 ORDER BY computed_at DESC LIMIT 1`,
          [userId]
        ),
        pool.query(
          `SELECT narrative_type, title, content, tone, key_themes, generated_at
           FROM lde_narratives WHERE user_id=$1 ORDER BY generated_at DESC LIMIT 5`,
          [userId]
        ),
        pool.query(
          `SELECT checkpoint_date, confidence_score, self_efficacy_score, aspiration_score,
                  motivation_score, identity_coherence, breakthrough_flag, shift_detected, notes
           FROM lde_identity_evolution WHERE user_id=$1 ORDER BY checkpoint_date DESC`,
          [userId]
        ),
      ]);

      let timeline = timelineR.rows;
      let momentum = momentumR.rows[0] || null;
      let narratives = narrativesR.rows;
      let identity = identityR.rows;

      // Lazy seed: if no LDE data yet, build it from CAPADEX history now
      if (!timeline.length && !momentum) {
        try {
          await seedLDEFromCapadex(pool, userId);
          const [tR2, mR2, nR2, iR2] = await Promise.all([
            pool.query(`SELECT checkpoint_date, behavioural_score, emotional_score, resilience_score,
                               employability_score, leadership_score, milestone_flags, notes
                        FROM lde_timelines WHERE user_id=$1 ORDER BY checkpoint_date ASC`, [userId]),
            pool.query(`SELECT momentum_state, momentum_score, growth_velocity, stability_score,
                               sustainability_score, trend_direction, forecast_30d, computed_at
                        FROM lde_momentum WHERE user_id=$1 ORDER BY computed_at DESC LIMIT 1`, [userId]),
            pool.query(`SELECT narrative_type, title, content, tone, key_themes, generated_at
                        FROM lde_narratives WHERE user_id=$1 ORDER BY generated_at DESC LIMIT 5`, [userId]),
            pool.query(`SELECT checkpoint_date, confidence_score, self_efficacy_score, aspiration_score,
                               motivation_score, identity_coherence, breakthrough_flag, shift_detected, notes
                        FROM lde_identity_evolution WHERE user_id=$1 ORDER BY checkpoint_date DESC`, [userId]),
          ]);
          timeline   = tR2.rows;
          momentum   = mR2.rows[0] || null;
          narratives = nR2.rows;
          identity   = iR2.rows;
        } catch (_) { /* non-critical — returns empty-state gracefully */ }
      }

      const breakthroughs = identity.filter(r => r.breakthrough_flag);
      const identityShifts = identity.filter(r => r.shift_detected);
      const latestIdentity = identity[0] || null;

      const sparkline = timeline.map(t => ({
        date: t.checkpoint_date,
        composite: parseFloat((
          ((t.behavioural_score || 0) * 0.3 +
           (t.emotional_score   || 0) * 0.25 +
           (t.resilience_score  || 0) * 0.2 +
           (t.employability_score || 0) * 0.15 +
           (t.leadership_score  || 0) * 0.1)
        ).toFixed(1)),
        behavioural: t.behavioural_score,
        emotional: t.emotional_score,
        resilience: t.resilience_score,
        milestones: t.milestone_flags || [],
      }));

      const latestNarrative = narratives.find(n => n.narrative_type === 'developmental') || narratives[0] || null;
      const hasMeaningfulData = timeline.length > 0 || momentum !== null;

      res.json({
        has_data: hasMeaningfulData,
        checkpoint_count: timeline.length,
        sparkline,
        momentum,
        narratives,
        latest_narrative: latestNarrative,
        identity: {
          latest: latestIdentity,
          breakthroughs,
          identity_shifts: identityShifts,
          history: identity,
        },
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Master Dashboard ───────────────────────────────────────────────────────
  app.get("/api/admin/lde/temporal/master", async (req, res) => {
    try {
      const [evtR, featR, embR, timeR, sigR, anomR] = await Promise.all([
        pool.query(`SELECT event_type, COUNT(*) cnt FROM lde_events WHERE created_at > NOW()-INTERVAL '7 days' GROUP BY event_type ORDER BY cnt DESC`),
        pool.query(`SELECT COUNT(*) total, AVG(coverage_pct) avg_coverage, AVG(entropy_score) avg_entropy FROM lde_feature_store`),
        pool.query(`SELECT COUNT(DISTINCT user_id) users, COUNT(*) total, embedding_type, COUNT(*) OVER (PARTITION BY embedding_type) type_cnt FROM lde_embeddings GROUP BY embedding_type, user_id LIMIT 1`),
        pool.query(`SELECT COUNT(*) total, COUNT(DISTINCT user_id) users, MAX(checkpoint_date) latest_checkpoint FROM lde_timelines`),
        pool.query(`SELECT COUNT(*) total, SUM(anomaly_count) total_anomalies, AVG(entropy_score) avg_entropy FROM lde_signal_aggregations WHERE aggregated_at > NOW()-INTERVAL '7 days'`),
        pool.query(`SELECT COUNT(DISTINCT user_id) embedding_users FROM lde_embeddings`)
      ]);
      res.json({
        events_7d: evtR.rows,
        feature_store: featR.rows[0],
        embeddings: anomR.rows[0],
        timeline: timeR.rows[0],
        signal_aggregation: sigR.rows[0],
        embedding_coverage: anomR.rows[0]
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
}
