/**
 * Career Memory Routes — Phase 3
 * Persistent transformation history, completed interventions,
 * behavioral evolution, and growth pattern detection.
 * In-memory store is the fast-read layer; DB writes are additive (PR0-F2).
 */

import type { Express } from 'express';
import type { Pool } from 'pg';

/* ── Ensure schema ───────────────────────────────────────────────── */
async function ensureCareerMemorySchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS career_memory_snapshots (
      id               SERIAL PRIMARY KEY,
      user_id          TEXT        NOT NULL,
      snapshot_id      TEXT        UNIQUE NOT NULL,
      competency_levels JSONB      DEFAULT '{}',
      ei_score         NUMERIC,
      percentile       NUMERIC,
      source           TEXT        DEFAULT 'system',
      label            TEXT,
      created_at       TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_career_memory_snapshots_user
      ON career_memory_snapshots(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS career_memory_interventions (
      id               SERIAL PRIMARY KEY,
      intervention_id  TEXT        UNIQUE NOT NULL,
      user_id          TEXT        NOT NULL,
      competency_id    TEXT,
      competency_label TEXT,
      title            TEXT,
      type             TEXT        DEFAULT 'course',
      ei_lift_actual   NUMERIC     DEFAULT 0,
      hours_spent      NUMERIC     DEFAULT 0,
      rating           NUMERIC,
      note             TEXT,
      completed_at     TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_career_memory_interventions_user
      ON career_memory_interventions(user_id, completed_at DESC);
  `);
}

/* ── In-memory store (fast reads; keyed by userId) ───────────────── */
interface Snapshot {
  snapshotId:       string;
  userId:           string;
  timestamp:        number;
  competencyLevels: Record<string, number>;
  eiScore:          number;
  percentile?:      number;
  source:           string;
  label:            string;
}

interface InterventionLog {
  id:              string;
  userId:          string;
  competencyId:    string;
  competencyLabel: string;
  title:           string;
  type:            string;
  eiLiftActual:    number;
  hoursSpent:      number;
  rating?:         number;
  note?:           string;
  completedAt:     number;
}

const snapshotStore   = new Map<string, Snapshot[]>();
const interventionStore = new Map<string, InterventionLog[]>();

function getSnapshots(userId: string): Snapshot[] { return snapshotStore.get(userId) ?? []; }
function getInterventions(userId: string): InterventionLog[] { return interventionStore.get(userId) ?? []; }
function uid(): string { return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`; }

/* ── DB persistence helpers (additive, never-throws) ─────────────── */
async function persistSnapshot(pool: Pool, snap: Snapshot): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO career_memory_snapshots
         (user_id, snapshot_id, competency_levels, ei_score, percentile, source, label, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,to_timestamp($8/1000.0))
       ON CONFLICT (snapshot_id) DO NOTHING`,
      [snap.userId, snap.snapshotId, JSON.stringify(snap.competencyLevels),
       snap.eiScore, snap.percentile ?? null, snap.source, snap.label, snap.timestamp]
    );
  } catch { }
}

async function persistIntervention(pool: Pool, entry: InterventionLog): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO career_memory_interventions
         (intervention_id, user_id, competency_id, competency_label, title, type,
          ei_lift_actual, hours_spent, rating, note, completed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,to_timestamp($11/1000.0))
       ON CONFLICT (intervention_id) DO NOTHING`,
      [entry.id, entry.userId, entry.competencyId, entry.competencyLabel,
       entry.title, entry.type, entry.eiLiftActual, entry.hoursSpent,
       entry.rating ?? null, entry.note ?? null, entry.completedAt]
    );
  } catch { }
}

/* ── Growth pattern detection ────────────────────────────────────── */
const PATTERN_DEFS: Record<string, { label:string; interp:string; rec:string }> = {
  'burst-learner':       { label:'Burst Learner',        interp:'Growth in concentrated sprints with rest periods.',    rec:'Schedule deliberate learning sprints every 6-8 weeks.' },
  'steady-grower':       { label:'Steady Grower',         interp:'Consistent, reliable progress over time.',             rec:'Leverage consistency to compound gains in adjacent areas.' },
  'domain-specialist':   { label:'Domain Specialist',     interp:'Deep in 1-2 domains; limited breadth.',                rec:'Add cross-domain modules to open multi-track options.' },
  'consistent-achiever': { label:'Consistent Achiever',   interp:'Completes what they start and hits milestones.',       rec:'Take on stretch goals — your execution rate supports it.' },
};

function detectPatterns(snaps: Snapshot[], interventions: InterventionLog[]): unknown[] {
  if (snaps.length < 2) return [];
  const patterns: unknown[] = [];
  const gains = snaps.slice(1).map((s,i) => s.eiScore - snaps[i].eiScore);
  const pos  = gains.filter(g => g > 0).length;
  const mean = gains.reduce((s,v) => s+v, 0) / Math.max(1, gains.length);
  const variance = gains.reduce((s,v) => s+(v-mean)**2, 0) / Math.max(1, gains.length);

  if (Math.sqrt(variance) > 4)
    patterns.push({ id:'burst', pattern:'burst-learner', ...PATTERN_DEFS['burst-learner'], frequency:3, strength:'strong' });
  if ((pos/gains.length) >= 0.75 && Math.sqrt(variance) < 3)
    patterns.push({ id:'steady', pattern:'steady-grower', ...PATTERN_DEFS['steady-grower'], frequency:snaps.length, strength:'strong' });
  if (interventions.length >= 3 && interventions.length / (interventions.length + 2) >= 0.7)
    patterns.push({ id:'achiever', pattern:'consistent-achiever', ...PATTERN_DEFS['consistent-achiever'], frequency:interventions.length, strength:'strong' });

  const lastSnap = snaps[snaps.length-1];
  const deepDomains = Object.values(lastSnap.competencyLevels).filter(v => v >= 3).length;
  if (deepDomains <= 4)
    patterns.push({ id:'specialist', pattern:'domain-specialist', ...PATTERN_DEFS['domain-specialist'], frequency:2, strength:deepDomains<=2?'strong':'moderate' });

  return patterns;
}

/* ── Longitudinal analysis ───────────────────────────────────────── */
function analyseLongitudinal(snaps: Snapshot[]) {
  if (snaps.length < 2) return { eiDelta:0, trend:'stable', spanDays:0, avgGainPerMonth:0, growing:[], stagnant:[] };
  const first = snaps[0], last = snaps[snaps.length-1];
  const spanDays = Math.round((last.timestamp - first.timestamp) / 86400000);
  const months   = Math.max(0.1, spanDays / 30.44);
  const eiDelta  = last.eiScore - first.eiScore;
  const growing: string[] = [], stagnant: string[] = [];
  Object.keys(last.competencyLevels).forEach(k => {
    const delta = (last.competencyLevels[k]??0) - (first.competencyLevels[k]??0);
    if (delta > 0.2) growing.push(k); else if (delta <= 0 && (last.competencyLevels[k]??0) < 3) stagnant.push(k);
  });
  return {
    eiDelta, spanDays,
    trend: eiDelta > 3 ? 'improving' : eiDelta < -3 ? 'declining' : 'stable',
    avgGainPerMonth: Math.round((eiDelta / months) * 10) / 10,
    growing, stagnant,
    projectedEI3mo: Math.round(Math.min(95, last.eiScore + (eiDelta/months)*3)),
    projectedEI12mo: Math.round(Math.min(95, last.eiScore + (eiDelta/months)*12)),
  };
}

/* ── IDOR guard: prefer session user over client-supplied id ─────── */
// If the request carries a verified session (req.user), use that identity.
// Otherwise fall back to the body/query value (backward-compat for flows
// that don't yet carry a session, e.g. public Career Builder preview).
function resolveEffectiveUserId(req: any, clientSupplied?: string): string | null {
  const sessionUser = req.user;
  if (sessionUser) {
    const id = String(sessionUser.id || sessionUser.user_id || '').trim();
    if (id) return id;
  }
  return clientSupplied || null;
}

/* ── Route registration ───────────────────────────────────────────── */
export function registerCareerMemoryRoutes(app: Express, pool?: Pool): void {

  if (pool) {
    ensureCareerMemorySchema(pool).catch(e =>
      console.error('[career-memory] ensureSchema error:', e)
    );
  }

  app.post('/api/career/memory/snapshot', (req, res) => {
    try {
      const { userId: bodyUserId, competencyLevels={}, eiScore=0, percentile, label } = req.body as {
        userId?: string; competencyLevels?: Record<string,number>; eiScore?: number; percentile?: number; label?: string;
      };
      const userId = resolveEffectiveUserId(req, bodyUserId);
      if (!userId) return res.status(400).json({ error:'userId required' });
      const snap: Snapshot = {
        snapshotId: uid(), userId, timestamp: Date.now(),
        competencyLevels, eiScore, percentile, source:'system',
        label: label ?? new Date().toLocaleDateString('en-IN', { month:'short', year:'numeric' }),
      };
      const existing = getSnapshots(userId);
      snapshotStore.set(userId, [...existing, snap]);
      if (pool) persistSnapshot(pool, snap);
      res.json({ snapshotId: snap.snapshotId, snapshot: snap });
    } catch(e) { res.status(500).json({ error:String(e) }); }
  });

  app.get('/api/career/memory/snapshots', (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) return res.status(400).json({ error:'userId required' });
      const snaps = getSnapshots(userId).sort((a,b) => a.timestamp - b.timestamp);
      res.json({ snapshots: snaps, count: snaps.length });
    } catch(e) { res.status(500).json({ error:String(e) }); }
  });

  app.delete('/api/career/memory/snapshot/:id', (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.query.userId as string;
      if (!userId) return res.status(400).json({ error:'userId required' });
      const snaps = getSnapshots(userId).filter(s => s.snapshotId !== id);
      snapshotStore.set(userId, snaps);
      res.json({ deleted: true, snapshotId: id });
    } catch(e) { res.status(500).json({ error:String(e) }); }
  });

  app.post('/api/career/memory/intervention', (req, res) => {
    try {
      const { userId: bodyUserId, competencyId='', competencyLabel='', title='', type='course', eiLiftActual=0, hoursSpent=0, rating, note } = req.body as {
        userId?: string; competencyId?: string; competencyLabel?: string; title?: string; type?: string;
        eiLiftActual?: number; hoursSpent?: number; rating?: number; note?: string;
      };
      const userId = resolveEffectiveUserId(req, bodyUserId);
      if (!userId) return res.status(400).json({ error:'userId required' });
      const entry: InterventionLog = { id:uid(), userId, competencyId, competencyLabel, title, type, eiLiftActual, hoursSpent, rating, note, completedAt:Date.now() };
      const existing = getInterventions(userId);
      interventionStore.set(userId, [...existing, entry]);
      if (pool) persistIntervention(pool, entry);
      res.json({ id: entry.id, logged: true });
    } catch(e) { res.status(500).json({ error:String(e) }); }
  });

  app.get('/api/career/memory/interventions', (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) return res.status(400).json({ error:'userId required' });
      const interventions = getInterventions(userId);
      const totalEILift = interventions.reduce((s,i) => s + i.eiLiftActual, 0);
      const totalHours  = interventions.reduce((s,i) => s + i.hoursSpent, 0);
      res.json({ interventions, totalEILift: Math.round(totalEILift*10)/10, totalHours: Math.round(totalHours*10)/10 });
    } catch(e) { res.status(500).json({ error:String(e) }); }
  });

  app.get('/api/career/memory/evolution', (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) return res.status(400).json({ error:'userId required' });
      const snaps = getSnapshots(userId).sort((a,b) => a.timestamp - b.timestamp);
      const interventions = getInterventions(userId);
      const longitudinal  = analyseLongitudinal(snaps);
      const patterns      = detectPatterns(snaps, interventions);

      const behavioralEvolution = snaps.map(s => ({
        period:    s.label,
        timestamp: s.timestamp,
        eiScore:   s.eiScore,
        dominantComp: Object.entries(s.competencyLevels).sort(([,a],[,b])=>b-a)[0]?.[0]??'N/A',
        badge: s.eiScore>=75?'High Performer':s.eiScore>=55?'Progressing':'Emerging',
      }));

      const milestones = [
        ...interventions.slice(-5).map(iv => ({ type:'intervention-completed', label:`Completed ${iv.competencyLabel}`, timestamp:iv.completedAt, eiAtTime:0 })),
        ...snaps.filter((s,i) => i>0 && s.eiScore - snaps[i-1].eiScore>=5).map(s => ({ type:'band-upgrade', label:`EI reached ${s.eiScore}`, timestamp:s.timestamp, eiAtTime:s.eiScore })),
      ].sort((a,b) => b.timestamp-a.timestamp).slice(0,10);

      res.json({ longitudinal, patterns, behavioralEvolution, milestones, snapshotCount: snaps.length, interventionCount: interventions.length });
    } catch(e) { res.status(500).json({ error:String(e) }); }
  });

  app.get('/api/career/memory/dump', (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) return res.status(400).json({ error:'userId required' });
      const snaps = getSnapshots(userId).sort((a,b) => a.timestamp-b.timestamp);
      const interventions = getInterventions(userId);
      const patterns = detectPatterns(snaps, interventions);
      const stats = {
        totalSnapshots:    snaps.length,
        totalInterventions:interventions.length,
        totalEIGain:       snaps.length>=2 ? snaps[snaps.length-1].eiScore - snaps[0].eiScore : 0,
        totalHoursLearned: Math.round(interventions.reduce((s,i) => s+i.hoursSpent, 0)*10)/10,
        topCompetencyGrown:(() => {
          if (snaps.length < 2) return 'N/A';
          const first=snaps[0], last=snaps[snaps.length-1];
          const best = Object.keys(last.competencyLevels).sort((a,b) => ((last.competencyLevels[b]??0)-(first.competencyLevels[b]??0)) - ((last.competencyLevels[a]??0)-(first.competencyLevels[a]??0)))[0];
          return best ?? 'N/A';
        })(),
      };
      res.json({ snapshots:snaps, interventions, patterns, stats, evolution: analyseLongitudinal(snaps) });
    } catch(e) { res.status(500).json({ error:String(e) }); }
  });

  app.get('/api/career/memory/summary', (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) return res.status(400).json({ error:'userId required' });
      const snaps = getSnapshots(userId).sort((a,b) => a.timestamp-b.timestamp);
      const interventions = getInterventions(userId);
      const first = snaps[0], last = snaps[snaps.length-1];
      res.json({
        userId, snapshots: snaps.length, interventions: interventions.length,
        firstSnapshot: first?.timestamp ?? null, lastSnapshot: last?.timestamp ?? null,
        eiGain:   snaps.length >= 2 ? last.eiScore - first.eiScore : 0,
        currentEI: last?.eiScore ?? null,
        topCompletedComp: interventions.slice().sort((a,b)=>b.eiLiftActual-a.eiLiftActual)[0]?.competencyLabel ?? 'N/A',
        patterns:  detectPatterns(snaps, interventions),
      });
    } catch(e) { res.status(500).json({ error:String(e) }); }
  });
}
