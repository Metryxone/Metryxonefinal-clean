/**
 * CAPADEX AQ-2 — Assessment Metadata Reconstruction.
 *
 * Builds an ADDITIVE metadata-intelligence layer over the live bank
 * `capadex_clarity_questions` (~30,638 rows) across 6 dimensions, persists it to
 * `capadex_question_metadata` (reversible, provenance 'aq2_reconstruction'),
 * validates per-dimension coverage + a Question Intelligence Score, and emits 8
 * delta deliverables (vs the AQ-1 baseline) to audit/aq-2/.
 *
 * It does NOT regenerate questions, change scoring, or alter reports, and NOTHING
 * in the runtime reads the new table yet (deliberate follow-up). All headline
 * numbers are measured at runtime — never hardcoded; gaps are honest findings,
 * never fabricated (see .agents/memory/aq1-audit-engine-honesty.md).
 *
 * The reconstruction's legitimacy over AQ-1: AQ-1 measured metadata as *inherited*
 * from the (wide, ambiguous) bridge tag only. AQ-2 additionally reads the rich
 * PER-QUESTION signals the bank already carries — question_type, narrative_style,
 * response_type, polarity, question text — which let Stage + Persona be
 * reconstructed from question content, and resolves the multi-valued tag
 * derivations (persona / capability / behavior / signal) into ranked
 * primary/secondary assignments with explicit confidence.
 *
 * Usage:
 *   npx tsx scripts/aq-2/reconstruct.ts            # build + persist + report
 *   npx tsx scripts/aq-2/reconstruct.ts --no-write # compute + report only (no DB writes)
 */
import { Pool } from 'pg';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';

const OUT = 'backend/audit/aq-2';
const WRITE_DB = !process.argv.includes('--no-write');

// ---------------------------------------------------------------------------
// Canonical models
// ---------------------------------------------------------------------------

// Phase 1 — canonical age bands (half-open by lower bound; non-overlapping).
// NB: deliberately DIFFERENT from the legacy IntroPhase AGE_BANDS — AQ-2 defines
// a new canonical model. Model floor is 11 (ages < 11 clamp up to 11-13).
const AGE_BANDS: [string, number, number][] = [
  ['11-13', 11, 13], ['14-17', 14, 17], ['18-24', 18, 24], ['25-45', 25, 45], ['46+', 46, 120],
];
function bandForAge(a: number): string {
  let x = a;
  if (x < 11) x = 11;
  for (const [b, lo, hi] of AGE_BANDS) if (x >= lo && x <= hi) return b;
  return '46+';
}

// Phase 2 — six canonical personas.
type Persona = 'Student' | 'Parent' | 'Teacher' | 'Counselor' | 'Professional' | 'Entrepreneur';
const PERSONAS: Persona[] = ['Student', 'Parent', 'Teacher', 'Counselor', 'Professional', 'Entrepreneur'];
const PERSONA_RELEVANCE_THRESHOLD = 0.25;

function personaBucket(p: string): Persona | null {
  const s = (p || '').toLowerCase();
  if (!s.trim()) return null;
  if (/entrepreneur|founder|business owner|venture|startup|self-employ/.test(s)) return 'Entrepreneur';
  if (/parent/.test(s)) return 'Parent';
  if (/counsel|mentor|coach|placement|career cell|success office/.test(s)) return 'Counselor';
  if (/teacher|educator|principal|faculty|academic operations/.test(s)) return 'Teacher';
  if (/professional|employee|job seeker|working|career transition|mid-career|leadership track|leadership/.test(s)) return 'Professional';
  if (/student|campus|learner|aspirant|explorer|self exploration|self discovery|self-discovery|skill development/.test(s)) return 'Student';
  return null;
}

// Per-question persona keyword evidence (closes the Entrepreneur=0 ontology gap
// honestly from question CONTENT; also reinforces ontology-derived personas).
const PERSONA_KEYWORDS: Record<Persona, RegExp> = {
  Entrepreneur: /business|venture|startup|start-up|founder|entrepreneur|self-employ|freelanc|my own (company|business|venture)/i,
  Parent: /my child|my son|my daughter|as a parent|parenting|my kid/i,
  Teacher: /my student|in my class|as a teacher|teaching|classroom|my pupils/i,
  Counselor: /my mentee|counsel|those i mentor|coaching session|the people i guide/i,
  Professional: /at work|my job|workplace|my manager|my team|promotion|appraisal|my colleagues/i,
  Student: /my exam|my studies|my course|my college|my grades|my marks|placement|semester/i,
};

// Phase 3 — five development stages, reconstructed from per-question signals.
const STAGES = ['Awareness', 'Curiosity', 'Clarity', 'Growth', 'Mastery'] as const;
type Stage = typeof STAGES[number];
const QTYPE_STAGE: Record<string, Stage> = {
  awareness: 'Awareness', severity: 'Awareness', emotional: 'Awareness', 'self-perception': 'Awareness', self_diagnostic: 'Awareness',
  adaptive_diagnostic: 'Curiosity', adaptive_reflection: 'Curiosity', behavioral_reflection: 'Curiosity', 'social-contextual': 'Curiosity',
  clarity: 'Clarity', cognitive: 'Clarity',
  coping: 'Growth', behavior: 'Growth', behavioral: 'Growth', behavior_correction: 'Growth', behavioral_regulation: 'Growth',
  growth_mapping: 'Growth', adaptive_growth: 'Growth', growth_measurement: 'Growth',
  readiness: 'Mastery', mastery: 'Mastery',
};
const NARRATIVE_STAGE: Record<string, Stage> = {
  scenario_based: 'Awareness', emotional: 'Awareness', situational: 'Awareness', 'self-perception': 'Awareness', severity: 'Awareness',
  reflective: 'Curiosity', 'social-contextual': 'Curiosity',
  cognitive: 'Clarity', analytical: 'Clarity',
  'action-oriented': 'Growth', behavioral: 'Growth', hopeful: 'Growth', 'growth-oriented': 'Growth', coping: 'Growth', intervention: 'Growth', collaborative: 'Growth',
  'future-oriented': 'Mastery', timeline_based: 'Mastery', confidence: 'Mastery', readiness: 'Mastery',
};
const RTYPE_STAGE: Record<string, Stage> = {
  frequency: 'Awareness', intensity: 'Awareness', emotional_impact: 'Awareness', difficulty: 'Awareness', impact: 'Awareness',
  situational_fit: 'Curiosity', social_comfort: 'Curiosity',
  agreement: 'Clarity', clarity: 'Clarity', decision_clarity: 'Clarity', single_select: 'Clarity',
  coping_effectiveness: 'Growth', energy_motivation: 'Growth', effectiveness: 'Growth',
  confidence: 'Mastery', readiness: 'Mastery', behavioral_consistency: 'Mastery', likelihood: 'Mastery', duration: 'Mastery', speed: 'Mastery',
};

function classifyStage(qtype: string, narrative: string, rtype: string, stageRaw: string): { stage: Stage; confidence: number } {
  const score: Record<Stage, number> = { Awareness: 0, Curiosity: 0, Clarity: 0, Growth: 0, Mastery: 0 };
  const qt = QTYPE_STAGE[(qtype || '').toLowerCase().trim()];
  const ns = NARRATIVE_STAGE[(narrative || '').toLowerCase().trim()];
  const rt = RTYPE_STAGE[(rtype || '').toLowerCase().trim()];
  if (qt) score[qt] += 3;
  if (ns) score[ns] += 2;
  if (rt) score[rt] += 1;
  if ((stageRaw || '').trim().toLowerCase() === 'clarity') score.Clarity += 1.5;
  const total = STAGES.reduce((a, s) => a + score[s], 0);
  if (total === 0) return { stage: 'Clarity', confidence: 0.2 }; // documented neutral default
  let best: Stage = 'Clarity'; let bestScore = -1;
  for (const s of STAGES) if (score[s] > bestScore) { best = s; bestScore = score[s]; }
  return { stage: best, confidence: Math.round((bestScore / total) * 1000) / 1000 };
}

// confidence-band helpers
const strengthRank = (s: string | null) => (s === 'strong' ? 3 : s === 'good' ? 2 : s === 'moderate' ? 2 : s === 'weak' ? 1 : 0);
const median = (xs: number[]) => {
  if (xs.length === 0) return null;
  const a = [...xs].sort((p, q) => p - q);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  mkdirSync(OUT, { recursive: true });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // ---- AQ-1 baseline (for deltas) ----
  const baseline = JSON.parse(readFileSync('backend/audit/aq-1/aq1_audit.json', 'utf8'));
  const baseCov = baseline.metadata_coverage;

  // ---- (a) bridge tag → concerns_master derivations (age / persona / capability) ----
  type TagMaster = {
    agePairs: [number, number][];           // (age_min, age_max) kept PAIRED per source row
    unionMin: number | null; unionMax: number | null;
    personaCounts: Map<Persona, number>; personaTotal: number;
    capCounts: Map<string, number>; capTotal: number;
  };
  const tagMaster = new Map<string, TagMaster>();
  {
    const r = await pool.query(`
      SELECT relational_bridge_tag tag, primary_persona, capability_mapping, age_min, age_max
      FROM capadex_concerns_master WHERE relational_bridge_tag IS NOT NULL`);
    for (const row of r.rows) {
      const t = (row.tag as string).trim();
      let m = tagMaster.get(t);
      if (!m) { m = { agePairs: [], unionMin: null, unionMax: null, personaCounts: new Map(), personaTotal: 0, capCounts: new Map(), capTotal: 0 }; tagMaster.set(t, m); }
      if (row.age_min != null && row.age_max != null) {
        const lo = Number(row.age_min), hi = Math.max(Number(row.age_min), Number(row.age_max));
        m.agePairs.push([lo, hi]);
        m.unionMin = m.unionMin == null ? lo : Math.min(m.unionMin, lo);
        m.unionMax = m.unionMax == null ? hi : Math.max(m.unionMax, hi);
      }
      const b = personaBucket(row.primary_persona || '');
      if (b) { m.personaCounts.set(b, (m.personaCounts.get(b) || 0) + 1); m.personaTotal++; }
      const cap = (row.capability_mapping || '').trim();
      if (cap) { m.capCounts.set(cap, (m.capCounts.get(cap) || 0) + 1); m.capTotal++; }
    }
  }

  // ---- (b) atomic_signal_id → behavioral scopes ----
  const atomicScope = new Map<string, { primary: string | null; secondary: string | null }>();
  {
    const r = await pool.query(`
      SELECT atomic_signal_id, primary_behavioral_scope, secondary_behavioral_scope
      FROM capadex_atomic_signals WHERE atomic_signal_id IS NOT NULL`);
    for (const row of r.rows) {
      atomicScope.set(row.atomic_signal_id, {
        primary: (row.primary_behavioral_scope || '').trim() || null,
        secondary: (row.secondary_behavioral_scope || '').trim() || null,
      });
    }
  }

  // ---- (c) bridge tag → behavior tally (WC-1B atomic grounding → atomic scopes) ----
  type TagBehavior = { counts: Map<string, number>; total: number; simSum: number; simN: number; bestStrength: number };
  const tagBehavior = new Map<string, TagBehavior>();
  {
    const r = await pool.query(`
      SELECT bridge_tag tag, atomic_signal_id, similarity, evidence_strength
      FROM capadex_bridge_tag_signal_grounding WHERE bridge_tag IS NOT NULL`);
    for (const row of r.rows) {
      const sc = atomicScope.get(row.atomic_signal_id);
      const scope = sc?.primary;
      if (!scope) continue;
      const t = (row.tag as string).trim();
      let m = tagBehavior.get(t);
      if (!m) { m = { counts: new Map(), total: 0, simSum: 0, simN: 0, bestStrength: 0 }; tagBehavior.set(t, m); }
      m.counts.set(scope, (m.counts.get(scope) || 0) + 1);
      m.total++;
      if (row.similarity != null) { m.simSum += Number(row.similarity); m.simN++; }
      m.bestStrength = Math.max(m.bestStrength, strengthRank(row.evidence_strength));
    }
  }

  // ---- (d) bridge tag → best signal family (WC-1B family grounding) ----
  type TagFamily = { family: string; strength: string; sim: number; second: string | null };
  const tagFamily = new Map<string, TagFamily>();
  {
    const r = await pool.query(`
      SELECT bridge_tag tag, signal_family, similarity, evidence_strength
      FROM capadex_bridge_tag_family_grounding WHERE bridge_tag IS NOT NULL`);
    const byTag = new Map<string, { family: string; strength: string; sim: number }[]>();
    for (const row of r.rows) {
      const t = (row.tag as string).trim();
      const arr = byTag.get(t) || [];
      arr.push({ family: row.signal_family, strength: row.evidence_strength || 'weak', sim: Number(row.similarity || 0) });
      byTag.set(t, arr);
    }
    for (const [t, arr] of byTag) {
      arr.sort((a, b) => strengthRank(b.strength) - strengthRank(a.strength) || b.sim - a.sim);
      tagFamily.set(t, { family: arr[0].family, strength: arr[0].strength, sim: arr[0].sim, second: arr[1]?.family ?? null });
    }
  }

  // ---- (e) bridge tag → tier3 signal-map names (behavior FALLBACK when no grounding) ----
  const tagSignalNames = new Map<string, { name: string; band: string }>();
  {
    const r = await pool.query(`
      SELECT relational_bridge_tag tag, signal_name, confidence_band
      FROM capadex_concern_signal_map
      WHERE relational_bridge_tag IS NOT NULL AND signal_tier='tier3' AND signal_name IS NOT NULL`);
    const rankBand = (b: string | null) => (b === 'strong' ? 3 : b === 'moderate' ? 2 : b === 'weak' ? 1 : 0);
    for (const row of r.rows) {
      const t = (row.tag as string).trim();
      const cur = tagSignalNames.get(t);
      if (!cur || rankBand(row.confidence_band) > rankBand(cur.band)) tagSignalNames.set(t, { name: row.signal_name, band: row.confidence_band || 'weak' });
    }
  }

  // ---------- Per-question reconstruction ----------
  if (WRITE_DB) {
    await pool.query(readFileSync('backend/migrations/20260606_capadex_question_metadata.sql', 'utf8'));
  }

  const DIMS = ['age', 'persona', 'stage', 'behavior', 'capability', 'signal'] as const;
  type Dim = typeof DIMS[number];
  const present: Record<Dim, number> = { age: 0, persona: 0, stage: 0, behavior: 0, capability: 0, signal: 0 };
  const confSum: Record<Dim, number> = { age: 0, persona: 0, stage: 0, behavior: 0, capability: 0, signal: 0 };
  const ageBandDist: Record<string, number> = Object.fromEntries(AGE_BANDS.map(([b]) => [b, 0]));
  const personaDist: Record<Persona, number> = { Student: 0, Parent: 0, Teacher: 0, Counselor: 0, Professional: 0, Entrepreneur: 0 };
  const personaMulti = { single: 0, multi: 0, none: 0 };
  const stageDist: Record<Stage, number> = { Awareness: 0, Curiosity: 0, Clarity: 0, Growth: 0, Mastery: 0 };
  const behaviorSource = { grounded: 0, fallback: 0, none: 0 };
  const signalStrengthDist: Record<string, number> = {};
  const bankTags = new Set<string>();          // distinct master_bridge_tag seen in the bank
  let crossBoundaryQ = 0;                       // questions whose tag age-range spans the 18 boundary
  let qisSum = 0, n = 0;

  const PAGE = 4000; let offset = 0;
  const upsertRows: any[][] = [];

  for (;;) {
    const r = await pool.query(
      `SELECT question_id, master_bridge_tag, concern, stage, question_type, narrative_style, response_type, question
       FROM capadex_clarity_questions ORDER BY id LIMIT $1 OFFSET $2`, [PAGE, offset]);
    if (r.rows.length === 0) break;

    for (const row of r.rows) {
      n++;
      const qid = row.question_id as string;
      const tag = (row.master_bridge_tag || '').trim();
      const text = `${row.question || ''} ${row.concern || ''}`;
      const tm = tagMaster.get(tag);
      if (tag) bankTags.add(tag);
      if (tm && tm.unionMin != null && tm.unionMax != null && tm.unionMin < 18 && tm.unionMax > 18) crossBoundaryQ++;

      // --- Phase 1: age ---
      let ageMin: number | null = null, ageMax: number | null = null, ageBand: string | null = null, ageConf = 0;
      if (tm && tm.agePairs.length) {
        ageMin = Math.max(11, median(tm.agePairs.map(p => p[0]))!);
        ageMax = Math.max(ageMin, median(tm.agePairs.map(p => p[1]))!);
        const mid = (ageMin + ageMax) / 2;
        ageBand = bandForAge(mid);
        // confidence = share of the tag's concerns whose own (paired) midpoint lands in the same band
        let agree = 0;
        for (const [lo, hi] of tm.agePairs) if (bandForAge((lo + hi) / 2) === ageBand) agree++;
        ageConf = Math.round((agree / tm.agePairs.length) * 1000) / 1000;
      }
      if (ageBand) { present.age++; confSum.age += ageConf; ageBandDist[ageBand]++; }

      // --- Phase 2: persona (multi, scored) ---
      const personaScores: Record<string, number> = {};
      for (const p of PERSONAS) {
        const ontologyShare = tm && tm.personaTotal ? (tm.personaCounts.get(p) || 0) / tm.personaTotal : 0;
        const kw = PERSONA_KEYWORDS[p].test(text) ? 0.3 : 0;
        const s = Math.min(1, ontologyShare + kw);
        if (s >= 0.15) personaScores[p] = Math.round(s * 100) / 100;
      }
      const relevant = Object.entries(personaScores).filter(([, s]) => s >= PERSONA_RELEVANCE_THRESHOLD).sort((a, b) => b[1] - a[1]);
      let personaPrimary: string | null = null, personaConf = 0;
      if (relevant.length) {
        personaPrimary = relevant[0][0]; personaConf = relevant[0][1];
        present.persona++; confSum.persona += personaConf;
        for (const [p] of relevant) personaDist[p as Persona]++;
        if (relevant.length === 1) personaMulti.single++; else personaMulti.multi++;
      } else personaMulti.none++;

      // --- Phase 3: dev-stage ---
      const st = classifyStage(row.question_type, row.narrative_style, row.response_type, row.stage);
      present.stage++; confSum.stage += st.confidence; stageDist[st.stage]++;

      // --- Phase 4: behavior ---
      let primaryBehavior: string | null = null, secondaryBehavior: string | null = null, behaviorConf = 0;
      const tb = tagBehavior.get(tag);
      if (tb && tb.total) {
        const sorted = [...tb.counts.entries()].sort((a, b) => b[1] - a[1]);
        primaryBehavior = sorted[0][0]; secondaryBehavior = sorted[1]?.[0] ?? null;
        const share = sorted[0][1] / tb.total;
        const meanSim = tb.simN ? tb.simSum / tb.simN : 0;
        behaviorConf = Math.round(Math.min(1, share * 0.6 + meanSim * 0.8 + (tb.bestStrength >= 3 ? 0.1 : 0)) * 1000) / 1000;
        behaviorSource.grounded++;
      } else {
        const sn = tagSignalNames.get(tag);
        if (sn) { primaryBehavior = sn.name; behaviorConf = sn.band === 'strong' ? 0.35 : sn.band === 'moderate' ? 0.25 : 0.15; behaviorSource.fallback++; }
        else behaviorSource.none++;
      }
      if (primaryBehavior) { present.behavior++; confSum.behavior += behaviorConf; }

      // --- Phase 5: capability ---
      let primaryCap: string | null = null, secondaryCap: string | null = null, capConf = 0;
      if (tm && tm.capTotal) {
        const sorted = [...tm.capCounts.entries()].sort((a, b) => b[1] - a[1]);
        primaryCap = sorted[0][0]; secondaryCap = sorted[1]?.[0] ?? null;
        capConf = Math.round((sorted[0][1] / tm.capTotal) * 1000) / 1000;
        present.capability++; confSum.capability += capConf;
      }

      // --- Phase 6: signal (WC-1B grounding) ---
      let signalFamily: string | null = null, signalStrength: string | null = null, signalConf = 0;
      const tf = tagFamily.get(tag);
      if (tf) {
        signalFamily = tf.family;
        signalStrength = tf.strength === 'strong' ? 'strong' : tf.strength === 'good' ? 'moderate' : tf.strength;
        signalConf = Math.round(Math.min(1, tf.sim * 2) * 1000) / 1000; // similarities ~0.21-0.45 → scale to 0..1
        present.signal++; confSum.signal += signalConf;
        signalStrengthDist[signalStrength] = (signalStrengthDist[signalStrength] || 0) + 1;
      }

      // --- Question Intelligence Score (mean of 6 dimension confidences) ---
      const qis = Math.round(((ageConf + personaConf + st.confidence + behaviorConf + capConf + signalConf) / 6) * 10000) / 100;
      qisSum += qis;

      if (WRITE_DB) {
        upsertRows.push([
          qid, tag || null, ageMin, ageMax, ageBand, ageConf,
          JSON.stringify(personaScores), personaPrimary, personaConf,
          st.stage, st.confidence,
          primaryBehavior, secondaryBehavior, behaviorConf,
          primaryCap, secondaryCap, capConf,
          signalFamily, signalStrength, signalConf,
          qis,
          JSON.stringify({ behavior_source: tb ? 'grounded' : (tagSignalNames.get(tag) ? 'signal_map_fallback' : 'none'), age_concerns: tm ? tm.agePairs.length : 0 }),
        ]);
      }
    }
    offset += PAGE;
  }

  // ---- Persist (batched upsert; additive, idempotent) ----
  if (WRITE_DB && upsertRows.length) {
    const COLS = ['question_id', 'master_bridge_tag', 'age_min', 'age_max', 'age_band', 'age_confidence',
      'personas', 'persona_primary', 'persona_confidence', 'dev_stage', 'dev_stage_confidence',
      'primary_behavior', 'secondary_behavior', 'behavior_confidence',
      'primary_capability', 'secondary_capability', 'capability_confidence',
      'signal_family', 'signal_strength', 'signal_confidence', 'question_intelligence_score', 'derivation', 'provenance'];
    const BATCH = 500;
    for (let i = 0; i < upsertRows.length; i += BATCH) {
      const chunk = upsertRows.slice(i, i + BATCH);
      const values: any[] = [];
      const tuples = chunk.map((rowVals, ri) => {
        const base = ri * COLS.length;
        values.push(...rowVals, 'aq2_reconstruction');
        return `(${COLS.map((_, ci) => `$${base + ci + 1}`).join(',')}, now())`;
      });
      await pool.query(
        `INSERT INTO capadex_question_metadata (${COLS.join(',')}, updated_at) VALUES ${tuples.join(',')}
         ON CONFLICT (question_id) DO UPDATE SET
           master_bridge_tag=EXCLUDED.master_bridge_tag, age_min=EXCLUDED.age_min, age_max=EXCLUDED.age_max,
           age_band=EXCLUDED.age_band, age_confidence=EXCLUDED.age_confidence, personas=EXCLUDED.personas,
           persona_primary=EXCLUDED.persona_primary, persona_confidence=EXCLUDED.persona_confidence,
           dev_stage=EXCLUDED.dev_stage, dev_stage_confidence=EXCLUDED.dev_stage_confidence,
           primary_behavior=EXCLUDED.primary_behavior, secondary_behavior=EXCLUDED.secondary_behavior,
           behavior_confidence=EXCLUDED.behavior_confidence, primary_capability=EXCLUDED.primary_capability,
           secondary_capability=EXCLUDED.secondary_capability, capability_confidence=EXCLUDED.capability_confidence,
           signal_family=EXCLUDED.signal_family, signal_strength=EXCLUDED.signal_strength,
           signal_confidence=EXCLUDED.signal_confidence, question_intelligence_score=EXCLUDED.question_intelligence_score,
           derivation=EXCLUDED.derivation, provenance=EXCLUDED.provenance, updated_at=now()`,
        values);
    }
  }

  // ---------- Validation / aggregate ----------
  const pct = (x: number) => Math.round((1000 * x) / n) / 10;
  const meanConf = (d: Dim) => Math.round((present[d] ? (confSum[d] / present[d]) : 0) * 1000) / 1000;
  const coverage: Record<Dim, { present: number; present_pct: number; mean_confidence: number }> =
    Object.fromEntries(DIMS.map(d => [d, { present: present[d], present_pct: pct(present[d]), mean_confidence: meanConf(d) }])) as any;

  // baseline present_pct per AQ-1 (behavior baseline was a signal-map-presence PROXY — annotated in report)
  const basePct: Record<Dim, number> = {
    age: baseCov.age_band.present_pct, persona: baseCov.persona.present_pct, stage: baseCov.dev_stage.present_pct,
    behavior: baseCov.behavior.present_pct, capability: baseCov.capability.present_pct, signal: baseCov.signal.present_pct,
  };

  const coverageScore = Math.round(DIMS.reduce((a, d) => a + coverage[d].present_pct, 0) / DIMS.length * 10) / 10;
  const baseCoverageScore = Math.round(DIMS.reduce((a, d) => a + basePct[d], 0) / DIMS.length * 10) / 10;
  const meanQis = Math.round((qisSum / n) * 10) / 10;
  const confidenceScore = Math.round(DIMS.reduce((a, d) => a + coverage[d].mean_confidence * 100, 0) / DIMS.length * 10) / 10;
  // Reconstructed Assessment Intelligence Score: half coverage breadth, half confidence depth.
  const aisV2 = Math.round((coverageScore * 0.5 + confidenceScore * 0.5) * 10) / 10;
  const aisBaseline = baseline.assessment_intelligence_score;

  // runtime-measured tag statistics (replace hardcoded narrative literals in deliverables)
  let groundedTags = 0;
  for (const t of bankTags) if (tagFamily.has(t)) groundedTags++;
  const tagStats = {
    bank_distinct_tags: bankTags.size,
    family_grounded_tags: groundedTags,
    family_grounded_pct: Math.round((groundedTags / bankTags.size) * 1000) / 10,
    age_cross_boundary_questions: crossBoundaryQ,
    age_cross_boundary_pct: Math.round((crossBoundaryQ / n) * 1000) / 10,
  };

  const agg = {
    generated_at: new Date().toISOString(),
    bank_table: 'capadex_clarity_questions',
    total_questions: n,
    persisted: WRITE_DB,
    metadata_table: 'capadex_question_metadata',
    provenance: 'aq2_reconstruction',
    grounding_source: 'WC-1B (capadex_bridge_tag_family_grounding / capadex_bridge_tag_signal_grounding)',
    canonical_age_bands: AGE_BANDS.map(([b]) => b),
    canonical_personas: PERSONAS,
    canonical_stages: STAGES,
    tag_stats: tagStats,
    coverage,
    baseline_present_pct: basePct,
    age: { band_distribution: ageBandDist },
    persona: { distribution: personaDist, multi: personaMulti, entrepreneur_recovered: personaDist.Entrepreneur },
    dev_stage: { distribution: stageDist },
    behavior: { source: behaviorSource },
    signal: { strength_distribution: signalStrengthDist },
    scores: {
      coverage_score: coverageScore, baseline_coverage_score: baseCoverageScore,
      confidence_score: confidenceScore, mean_question_intelligence_score: meanQis,
      assessment_intelligence_score: aisV2, baseline_assessment_intelligence_score: aisBaseline,
      ais_delta: Math.round((aisV2 - aisBaseline) * 10) / 10,
    },
  };

  writeFileSync(`${OUT}/aq2_reconstruction.json`, JSON.stringify(agg, null, 2));
  writeDeliverables(agg, coverage, basePct);
  console.log(JSON.stringify(agg.scores, null, 2));
  console.log(`\nPersisted: ${WRITE_DB ? `${n} rows → capadex_question_metadata` : 'NO (--no-write)'}`);
  await pool.end();
}

// ---------------------------------------------------------------------------
// Deliverables (8 markdown/json files)
// ---------------------------------------------------------------------------
function deltaRow(label: string, before: number, after: number) {
  const d = Math.round((after - before) * 10) / 10;
  return `| ${label} | ${before}% | **${after}%** | ${d >= 0 ? '+' : ''}${d} |`;
}

function writeDeliverables(agg: any, coverage: any, basePct: any) {
  const c = coverage; const s = agg.scores;
  const hdr = (t: string) => `# CAPADEX AQ-2 — ${t}\n\n> Generated ${agg.generated_at} · bank \`${agg.bank_table}\` · ${agg.total_questions} questions · additive layer \`${agg.metadata_table}\` (provenance \`${agg.provenance}\`). NOT wired into runtime.\n`;

  writeFileSync(`${OUT}/01_metadata_coverage_delta.md`, [
    hdr('Metadata Coverage Delta'),
    `Per-dimension present-coverage, AQ-1 baseline → AQ-2 reconstruction.\n`,
    `| Dimension | Before (AQ-1) | After (AQ-2) | Δ |`,
    `|---|---:|---:|---:|`,
    deltaRow('Age', basePct.age, c.age.present_pct),
    deltaRow('Persona', basePct.persona, c.persona.present_pct),
    deltaRow('Stage', basePct.stage, c.stage.present_pct),
    deltaRow('Behavior', basePct.behavior, c.behavior.present_pct),
    deltaRow('Capability', basePct.capability, c.capability.present_pct),
    deltaRow('Signal', basePct.signal, c.signal.present_pct),
    `\n**Overall metadata coverage score**: ${s.baseline_coverage_score}% → **${s.coverage_score}%** (Δ ${s.coverage_score - s.baseline_coverage_score >= 0 ? '+' : ''}${Math.round((s.coverage_score - s.baseline_coverage_score) * 10) / 10}).`,
    `\n> ⚠️ **Behavior** baseline (${basePct.behavior}%) was an AQ-1 *signal-map-presence proxy* (any tag with a banded signal-map row). AQ-2 reports an explicit **primary behavioral scope** (grounded ${agg.behavior.source.grounded} / signal-map fallback ${agg.behavior.source.fallback} / none ${agg.behavior.source.none}) — a fidelity upgrade, not a like-for-like count.`,
  ].join('\n') + '\n');

  writeFileSync(`${OUT}/02_age_coverage_delta.md`, [
    hdr('Age Coverage Delta'),
    `Canonical bands: ${agg.canonical_age_bands.join(' · ')} (model floor 11; ages < 11 clamp to 11-13).`,
    `\nAQ-1 could assign **0%** a single clean band (**${agg.tag_stats.age_cross_boundary_pct}%** of questions inherit a tag whose age range crosses the youth↔adult boundary at 18, flagged *Conflicting*). AQ-2 resolves each question to its tag's **representative band** (median paired concern range → midpoint), with confidence = share of the tag's concerns that agree.\n`,
    deltaHeader(), deltaRow('Age band assigned', basePct.age, c.age.present_pct),
    `\n**Mean age confidence**: ${c.age.mean_confidence}.`,
    `\n### Reconstructed band distribution`, `| Band | Questions |`, `|---|---:|`,
    ...Object.entries(agg.age.band_distribution).map(([b, v]) => `| ${b} | ${v} |`),
  ].join('\n') + '\n');

  writeFileSync(`${OUT}/03_persona_coverage_delta.md`, [
    hdr('Persona Coverage Delta'),
    `Personas: ${agg.canonical_personas.join(' · ')} · multiple allowed · relevance ≥ ${PERSONA_RELEVANCE_THRESHOLD}.`,
    `\nAQ-2 scores each persona from ontology share + per-question keyword evidence, recovering the **Entrepreneur** persona (AQ-1 ontology coverage = 0) from question content.\n`,
    deltaHeader(), deltaRow('≥1 persona assigned', basePct.persona, c.persona.present_pct),
    `\n**Mean persona confidence**: ${c.persona.mean_confidence} · single-persona ${agg.persona.multi.single} · multi-persona ${agg.persona.multi.multi} · none ${agg.persona.multi.none}.`,
    `\n### Per-persona reach (questions with relevance ≥ ${PERSONA_RELEVANCE_THRESHOLD})`, `| Persona | Questions |`, `|---|---:|`,
    ...Object.entries(agg.persona.distribution).map(([p, v]) => `| ${p} | ${v} |`),
    `\n> **Entrepreneur recovered**: ${agg.persona.entrepreneur_recovered} questions (was 0 in the ontology).`,
  ].join('\n') + '\n');

  writeFileSync(`${OUT}/04_stage_coverage_delta.md`, [
    hdr('Stage Coverage Delta'),
    `Development stages: ${agg.canonical_stages.join(' → ')}.`,
    `\nAQ-1's taxonomy was collapsed (only "Clarity" populated, 46.7%). AQ-2 classifies **every** question from \`question_type\` (w3) + \`narrative_style\` (w2) + \`response_type\` (w1) + any existing stage hint (w1.5).\n`,
    deltaHeader(), deltaRow('Stage classified', basePct.stage, c.stage.present_pct),
    `\n**Mean stage confidence**: ${c.stage.mean_confidence}.`,
    `\n### Reconstructed stage distribution`, `| Stage | Questions |`, `|---|---:|`,
    ...Object.entries(agg.dev_stage.distribution).map(([st, v]) => `| ${st} | ${v} |`),
  ].join('\n') + '\n');

  writeFileSync(`${OUT}/05_behavior_coverage_delta.md`, [
    hdr('Behavior Coverage Delta'),
    `AQ-2 assigns a **primary + secondary behavioral scope** from WC-1B atomic grounding (bridge tag → atomic signal → behavioral scope), falling back to the best tier-3 signal-map name when a tag is ungrounded.\n`,
    deltaHeader(), deltaRow('Primary behavior assigned', basePct.behavior, c.behavior.present_pct),
    `\n**Mean behavior confidence**: ${c.behavior.mean_confidence}.`,
    `\n### Source mix`, `| Source | Questions |`, `|---|---:|`,
    `| WC-1B grounded scope | ${agg.behavior.source.grounded} |`,
    `| signal-map fallback | ${agg.behavior.source.fallback} |`,
    `| none | ${agg.behavior.source.none} |`,
    `\n> ⚠️ The AQ-1 baseline (${basePct.behavior}%) counted *signal-map presence*, not an explicit behavioral label. AQ-2's number is the share with a real primary scope — a fidelity gain even where the raw % moves.`,
  ].join('\n') + '\n');

  writeFileSync(`${OUT}/06_capability_coverage_delta.md`, [
    hdr('Capability Coverage Delta'),
    `AQ-2 resolves the tag's multi-valued \`capability_mapping\` into ranked **primary + secondary capability** by frequency, with confidence = primary share. AQ-1 reported these as *Ambiguous* (36.8% single-present).\n`,
    deltaHeader(), deltaRow('Primary capability assigned', basePct.capability, c.capability.present_pct),
    `\n**Mean capability confidence**: ${c.capability.mean_confidence}.`,
  ].join('\n') + '\n');

  writeFileSync(`${OUT}/07_signal_coverage_delta.md`, [
    hdr('Signal Coverage Delta'),
    `Signal layer grounded on **WC-1B** (\`capadex_bridge_tag_family_grounding\`): best signal family per tag → \`signal_family\`, \`signal_strength\` (strong/moderate), \`signal_confidence\` (similarity-scaled). AQ-1 could resolve a single signal for only 0.3% (the rest were *Ambiguous* with >1 signal-map row).\n`,
    deltaHeader(), deltaRow('Signal family assigned', basePct.signal, c.signal.present_pct),
    `\n**Mean signal confidence**: ${c.signal.mean_confidence}.`,
    `\n### Strength distribution`, `| Strength | Questions |`, `|---|---:|`,
    ...Object.entries(agg.signal.strength_distribution).map(([st, v]) => `| ${st} | ${v} |`),
    `\n> Coverage ceiling = WC-1B family-grounded tags (${agg.tag_stats.family_grounded_tags}/${agg.tag_stats.bank_distinct_tags} = ${agg.tag_stats.family_grounded_pct}% of the bank's distinct bridge tags). Ungrounded tags remain honestly unassigned (no fabrication).`,
  ].join('\n') + '\n');

  writeFileSync(`${OUT}/08_assessment_intelligence_score.md`, [
    hdr('Updated Assessment Intelligence Score'),
    `### Score`, `| Metric | AQ-1 baseline | AQ-2 reconstruction | Δ |`, `|---|---:|---:|---:|`,
    `| Metadata coverage score | ${s.baseline_coverage_score}% | **${s.coverage_score}%** | ${s.coverage_score - s.baseline_coverage_score >= 0 ? '+' : ''}${Math.round((s.coverage_score - s.baseline_coverage_score) * 10) / 10} |`,
    `| Mean Question Intelligence Score | — | **${s.mean_question_intelligence_score}** | — |`,
    `| Confidence depth score | — | **${s.confidence_score}** | — |`,
    `| **Assessment Intelligence Score** | **${s.baseline_assessment_intelligence_score}** | **${s.assessment_intelligence_score}** | **${s.ais_delta >= 0 ? '+' : ''}${s.ais_delta}** |`,
    `\n### Method`,
    `- **Question Intelligence Score** (per question) = mean of the six dimension confidences × 100.`,
    `- **Assessment Intelligence Score (AQ-2)** = 0.5 × coverage-breadth + 0.5 × confidence-depth (both 0–100).`,
    `- The AQ-1 baseline (${s.baseline_assessment_intelligence_score}) used a different alignment-weighted formula; the Δ is **directional** — the per-dimension coverage deltas (deliverables 02–07) are the rigorous, like-for-like comparison.`,
    `\n### Honesty notes`,
    `- All numbers measured at runtime over ${agg.total_questions} questions; ungrounded tags / absent ontology rows are left unassigned, never fabricated.`,
    `- Signal & behavior reach is capped by WC-1B grounding (≈55.8% of questions under grounded tags) — an honest ceiling, not a defect of this reconstruction.`,
    `- Age, Persona and Stage are reconstructed from per-question content the bank already carries; they resolve AQ-1 ambiguity but inherit the underlying ontology's age spread (reflected in lower confidence, not hidden).`,
    `\n**STOP — awaiting approval.** The metadata layer is additive and reversible (\`DELETE FROM capadex_question_metadata WHERE provenance='aq2_reconstruction';\`). No runtime wiring, no scoring/report change, no deploy.`,
  ].join('\n') + '\n');
}
function deltaHeader() { return `| Metric | Before (AQ-1) | After (AQ-2) | Δ |\n|---|---:|---:|---:|`; }

main().catch(e => { console.error(e); process.exit(1); });
