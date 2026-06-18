/**
 * OMEGA-X Behavioural Ontology Engine
 *
 * Graph-based causation and intervention relationships.
 * Provides ontology-driven inference for CAPADEX reports:
 *   - Traverses the concern → domain → competency → signal graph
 *   - Returns causal chains, trigger nodes, protective factors
 *   - Seeds the canonical ontology on first boot
 */

import type { Pool } from 'pg';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NodeType =
  | 'concern' | 'domain' | 'competency' | 'signal' | 'trigger'
  | 'reinforcement' | 'vulnerability' | 'protective_factor' | 'behaviour'
  | 'severity_marker' | 'stability_marker' | 'intervention'
  | 'recovery_indicator' | 'relapse_marker';

export type EdgeType =
  | 'causes' | 'reinforces' | 'triggers' | 'protects_against'
  | 'enables_intervention' | 'predicts_relapse' | 'indicates_recovery'
  | 'worsens' | 'ameliorates' | 'co_occurs_with' | 'prerequisite_for';

export interface OntologyNode {
  node_key: string;
  node_type: NodeType;
  label: string;
  description: string;
  concern_category?: string;
  severity_weight: number;
  emotional_valence: 'positive' | 'negative' | 'neutral';
  metadata: Record<string, unknown>;
}

export interface OntologyEdge {
  from_node_key: string;
  to_node_key: string;
  edge_type: EdgeType;
  weight: number;
  confidence: number;
  evidence_base?: string;
}

export interface SessionOntology {
  session_id: string;
  active_node_keys: string[];
  causal_chain: CausalStep[];
  trigger_nodes: OntologyNode[];
  protective_nodes: OntologyNode[];
  intervention_sequence: InterventionStep[];
  confidence_map: Record<string, number>;
  safety_status: 'informational' | 'supportive' | 'referral';
  safety_flags: string[];
  calibration: Record<string, unknown>;
}

export interface CausalStep {
  from: string;
  from_label: string;
  edge_type: EdgeType;
  to: string;
  to_label: string;
  weight: number;
  explanation: string;
}

export interface InterventionStep {
  phase: 'stabilisation' | 'growth' | 'optimisation';
  intervention_key: string;
  label: string;
  description: string;
  timing: string;
  intensity: 'low' | 'moderate' | 'high';
  priority: number;
}

// ─── Canonical Ontology Seed Data ─────────────────────────────────────────────

const SEED_NODES: OntologyNode[] = [
  // ── Digital / Screen concerns ─────────────────────────────────────────────
  { node_key: 'digital_concern', node_type: 'concern', label: 'Digital & Screen Behaviour', description: 'Patterns of technology use that interfere with daily functioning, attention, and wellbeing.', concern_category: 'digital', severity_weight: 1.0, emotional_valence: 'neutral', metadata: {} },
  { node_key: 'digital_attention_domain', node_type: 'domain', label: 'Attention Regulation', description: 'Capacity to direct and sustain focus in the presence of digital stimuli.', concern_category: 'digital', severity_weight: 1.1, emotional_valence: 'neutral', metadata: {} },
  { node_key: 'digital_impulse_domain', node_type: 'domain', label: 'Digital Impulse Control', description: 'Ability to resist the urge to check devices, notifications, or feeds.', concern_category: 'digital', severity_weight: 1.2, emotional_valence: 'negative', metadata: {} },
  { node_key: 'notification_trigger', node_type: 'trigger', label: 'Notification Pull', description: 'External notification cues that interrupt cognitive flow.', concern_category: 'digital', severity_weight: 1.3, emotional_valence: 'negative', metadata: { trigger_type: 'external' } },
  { node_key: 'dopamine_loop_reinforcement', node_type: 'reinforcement', label: 'Dopamine Feedback Loop', description: 'Variable reward mechanism from social media and feed scrolling reinforces compulsive checking.', concern_category: 'digital', severity_weight: 1.4, emotional_valence: 'negative', metadata: { mechanism: 'variable_reward' } },
  { node_key: 'environment_design_intervention', node_type: 'intervention', label: 'Environment Design', description: 'Restructure physical and digital environment to reduce trigger density.', concern_category: 'digital', severity_weight: 0.8, emotional_valence: 'positive', metadata: { phase: 'stabilisation', timing: '1-2 weeks' } },
  { node_key: 'digital_time_blocking', node_type: 'intervention', label: 'Structured Time Blocking', description: 'Assign specific protected blocks for deep work with device removal.', concern_category: 'digital', severity_weight: 0.9, emotional_valence: 'positive', metadata: { phase: 'growth', timing: '2-4 weeks' } },
  { node_key: 'attention_fragmentation_signal', node_type: 'signal', label: 'Attention Fragmentation', description: 'Frequent task-switching detected through rapid answer patterns and short dwell times.', concern_category: 'digital', severity_weight: 1.2, emotional_valence: 'negative', metadata: { signal_type: 'cognitive' } },
  { node_key: 'flow_state_recovery', node_type: 'recovery_indicator', label: 'Flow State Recovery', description: 'Sustained concentration periods of 25+ minutes without device interaction.', concern_category: 'digital', severity_weight: 0.7, emotional_valence: 'positive', metadata: {} },

  // ── Academic / Learning concerns ──────────────────────────────────────────
  { node_key: 'academic_concern', node_type: 'concern', label: 'Academic & Learning Challenges', description: 'Difficulties with academic performance, motivation, study consistency, or exam management.', concern_category: 'academic', severity_weight: 1.0, emotional_valence: 'neutral', metadata: {} },
  { node_key: 'academic_motivation_domain', node_type: 'domain', label: 'Academic Motivation', description: 'Intrinsic and extrinsic drivers sustaining study effort and goal pursuit.', concern_category: 'academic', severity_weight: 1.1, emotional_valence: 'neutral', metadata: {} },
  { node_key: 'exam_anxiety_domain', node_type: 'domain', label: 'Exam Anxiety', description: 'Arousal response before and during evaluative situations that impairs performance.', concern_category: 'academic', severity_weight: 1.3, emotional_valence: 'negative', metadata: {} },
  { node_key: 'performance_pressure_trigger', node_type: 'trigger', label: 'Performance Pressure', description: 'High-stakes evaluative contexts that activate anxiety and avoidance responses.', concern_category: 'academic', severity_weight: 1.2, emotional_valence: 'negative', metadata: { trigger_type: 'contextual' } },
  { node_key: 'fear_of_failure_reinforcement', node_type: 'reinforcement', label: 'Fear of Failure Loop', description: 'Avoidance of study reduces short-term anxiety but worsens long-term performance fear.', concern_category: 'academic', severity_weight: 1.3, emotional_valence: 'negative', metadata: { mechanism: 'avoidance_loop' } },
  { node_key: 'procrastination_signal', node_type: 'signal', label: 'Procrastination Signal', description: 'Patterns of task deferral especially under high cognitive or emotional load.', concern_category: 'academic', severity_weight: 1.1, emotional_valence: 'negative', metadata: { signal_type: 'behavioural' } },
  { node_key: 'study_structure_intervention', node_type: 'intervention', label: 'Structured Study Protocol', description: 'Implement Pomodoro or time-boxed study sessions with scheduled review.', concern_category: 'academic', severity_weight: 0.9, emotional_valence: 'positive', metadata: { phase: 'stabilisation', timing: '1 week' } },
  { node_key: 'anxiety_defusion_intervention', node_type: 'intervention', label: 'Anxiety Defusion Technique', description: 'Pre-exam grounding and cognitive reframing exercises.', concern_category: 'academic', severity_weight: 0.9, emotional_valence: 'positive', metadata: { phase: 'stabilisation', timing: '1-2 weeks' } },
  { node_key: 'academic_self_efficacy', node_type: 'protective_factor', label: 'Academic Self-Efficacy', description: 'Belief in one\'s ability to perform academically — the strongest predictor of academic resilience.', concern_category: 'academic', severity_weight: 0.6, emotional_valence: 'positive', metadata: {} },

  // ── Emotional concerns ────────────────────────────────────────────────────
  { node_key: 'emotional_concern', node_type: 'concern', label: 'Emotional Regulation', description: 'Difficulties managing emotional states, impulses, and interpersonal emotional responses.', concern_category: 'emotional', severity_weight: 1.0, emotional_valence: 'neutral', metadata: {} },
  { node_key: 'emotional_regulation_domain', node_type: 'domain', label: 'Emotional Regulation', description: 'Capacity to modulate emotional intensity and duration in response to stressors.', concern_category: 'emotional', severity_weight: 1.2, emotional_valence: 'neutral', metadata: {} },
  { node_key: 'stress_resilience_domain', node_type: 'domain', label: 'Stress Resilience', description: 'Ability to recover behavioural and emotional baseline after adversity.', concern_category: 'emotional', severity_weight: 1.1, emotional_valence: 'neutral', metadata: {} },
  { node_key: 'emotional_overwhelm_trigger', node_type: 'trigger', label: 'Emotional Overwhelm', description: 'Situations of simultaneous high emotional demand that exceed current regulatory capacity.', concern_category: 'emotional', severity_weight: 1.4, emotional_valence: 'negative', metadata: { trigger_type: 'internal' } },
  { node_key: 'rumination_reinforcement', node_type: 'reinforcement', label: 'Rumination Loop', description: 'Repetitive negative thought patterns that amplify emotional distress without resolution.', concern_category: 'emotional', severity_weight: 1.4, emotional_valence: 'negative', metadata: { mechanism: 'cognitive_loop' } },
  { node_key: 'emotional_volatility_signal', node_type: 'signal', label: 'Emotional Volatility', description: 'High variance in emotional state scores across items — indicates instability.', concern_category: 'emotional', severity_weight: 1.3, emotional_valence: 'negative', metadata: { signal_type: 'emotional' } },
  { node_key: 'grounding_intervention', node_type: 'intervention', label: 'Grounding & Regulation Practice', description: 'Daily 5-minute grounding exercise (5-4-3-2-1 sensory or breathing protocol).', concern_category: 'emotional', severity_weight: 0.8, emotional_valence: 'positive', metadata: { phase: 'stabilisation', timing: 'daily' } },
  { node_key: 'social_support_protective', node_type: 'protective_factor', label: 'Social Support Network', description: 'Active relationships that provide emotional validation and co-regulation.', concern_category: 'emotional', severity_weight: 0.6, emotional_valence: 'positive', metadata: {} },
  { node_key: 'emotional_burnout_marker', node_type: 'severity_marker', label: 'Emotional Burnout Marker', description: 'Three or more consecutive sessions with emotional scores below 35 — indicates burnout trajectory.', concern_category: 'emotional', severity_weight: 1.5, emotional_valence: 'negative', metadata: { escalation: 'referral' } },

  // ── Behavioural concerns ──────────────────────────────────────────────────
  { node_key: 'behavioural_concern', node_type: 'concern', label: 'Behavioural Patterns', description: 'Repetitive behavioural patterns that cause functional impairment despite awareness.', concern_category: 'behavioural', severity_weight: 1.0, emotional_valence: 'neutral', metadata: {} },
  { node_key: 'habit_formation_domain', node_type: 'domain', label: 'Habit Formation', description: 'Capacity to build and sustain behavioural routines aligned with goals.', concern_category: 'behavioural', severity_weight: 1.1, emotional_valence: 'neutral', metadata: {} },
  { node_key: 'executive_function_domain', node_type: 'domain', label: 'Executive Function', description: 'Higher-order cognitive control including planning, inhibition, and working memory.', concern_category: 'behavioural', severity_weight: 1.2, emotional_valence: 'neutral', metadata: {} },
  { node_key: 'context_cue_trigger', node_type: 'trigger', label: 'Context Cue', description: 'Environmental or situational cues that automatically initiate habitual behaviour.', concern_category: 'behavioural', severity_weight: 1.1, emotional_valence: 'negative', metadata: { trigger_type: 'environmental' } },
  { node_key: 'identity_conflict_vulnerability', node_type: 'vulnerability', label: 'Identity Conflict', description: 'Discrepancy between desired self-image and observed behaviour — increases resistance to change.', concern_category: 'behavioural', severity_weight: 1.3, emotional_valence: 'negative', metadata: {} },
  { node_key: 'implementation_intention', node_type: 'intervention', label: 'Implementation Intention', description: 'If-then planning: "If [trigger], then I will [new behaviour]."', concern_category: 'behavioural', severity_weight: 0.9, emotional_valence: 'positive', metadata: { phase: 'growth', timing: '1 week' } },
  { node_key: 'identity_reframe_intervention', node_type: 'intervention', label: 'Identity Reframe', description: 'Shift from "I am trying to stop X" to "I am becoming someone who does Y."', concern_category: 'behavioural', severity_weight: 0.8, emotional_valence: 'positive', metadata: { phase: 'optimisation', timing: '4-6 weeks' } },
  { node_key: 'behavioural_consistency', node_type: 'protective_factor', label: 'Behavioural Consistency', description: 'Track record of sustained behavioural effort — strongly predicts future change success.', concern_category: 'behavioural', severity_weight: 0.6, emotional_valence: 'positive', metadata: {} },

  // ── Social / Career concerns ──────────────────────────────────────────────
  { node_key: 'social_concern', node_type: 'concern', label: 'Social & Interpersonal Challenges', description: 'Difficulties with social confidence, relationship dynamics, or interpersonal communication.', concern_category: 'social', severity_weight: 1.0, emotional_valence: 'neutral', metadata: {} },
  { node_key: 'social_confidence_domain', node_type: 'domain', label: 'Social Confidence', description: 'Sense of ease and competence in social interactions and group settings.', concern_category: 'social', severity_weight: 1.1, emotional_valence: 'neutral', metadata: {} },
  { node_key: 'social_anxiety_trigger', node_type: 'trigger', label: 'Social Evaluative Threat', description: 'Anticipation of negative judgment or social rejection.', concern_category: 'social', severity_weight: 1.3, emotional_valence: 'negative', metadata: { trigger_type: 'interpersonal' } },
  { node_key: 'social_avoidance_reinforcement', node_type: 'reinforcement', label: 'Social Avoidance Loop', description: 'Avoiding social situations reduces immediate anxiety but strengthens social fear over time.', concern_category: 'social', severity_weight: 1.4, emotional_valence: 'negative', metadata: { mechanism: 'avoidance_loop' } },
  { node_key: 'graduated_exposure_intervention', node_type: 'intervention', label: 'Graduated Social Exposure', description: 'Progressively approach mildly uncomfortable social situations to build confidence incrementally.', concern_category: 'social', severity_weight: 0.9, emotional_valence: 'positive', metadata: { phase: 'growth', timing: '2-4 weeks' } },
];

const SEED_EDGES: OntologyEdge[] = [
  // Digital causal chain
  { from_node_key: 'notification_trigger', to_node_key: 'attention_fragmentation_signal', edge_type: 'causes', weight: 0.9, confidence: 0.92, evidence_base: 'Attention fragmentation correlates with notification density (r=0.74)' },
  { from_node_key: 'attention_fragmentation_signal', to_node_key: 'digital_impulse_domain', edge_type: 'worsens', weight: 0.8, confidence: 0.85, evidence_base: 'Cognitive depletion reduces impulse control capacity' },
  { from_node_key: 'dopamine_loop_reinforcement', to_node_key: 'notification_trigger', edge_type: 'reinforces', weight: 0.9, confidence: 0.90, evidence_base: 'Variable reward schedules reinforce checking behaviour' },
  { from_node_key: 'dopamine_loop_reinforcement', to_node_key: 'digital_attention_domain', edge_type: 'worsens', weight: 0.85, confidence: 0.88, evidence_base: 'Reward system sensitisation reduces sustained attention capacity' },
  { from_node_key: 'environment_design_intervention', to_node_key: 'notification_trigger', edge_type: 'ameliorates', weight: 0.8, confidence: 0.87, evidence_base: 'Notification removal reduces interruption by 63%' },
  { from_node_key: 'environment_design_intervention', to_node_key: 'flow_state_recovery', edge_type: 'enables_intervention', weight: 0.85, confidence: 0.85, evidence_base: 'Structured environment enables sustained focus periods' },
  { from_node_key: 'digital_time_blocking', to_node_key: 'attention_fragmentation_signal', edge_type: 'ameliorates', weight: 0.75, confidence: 0.82, evidence_base: 'Time blocking reduces task switching by 40%' },

  // Academic causal chain
  { from_node_key: 'performance_pressure_trigger', to_node_key: 'exam_anxiety_domain', edge_type: 'triggers', weight: 0.9, confidence: 0.91, evidence_base: 'High-stakes evaluation reliably activates threat appraisal' },
  { from_node_key: 'fear_of_failure_reinforcement', to_node_key: 'procrastination_signal', edge_type: 'causes', weight: 0.85, confidence: 0.88, evidence_base: 'Task aversion drives procrastination (Sirois & Pychyl, 2013)' },
  { from_node_key: 'procrastination_signal', to_node_key: 'performance_pressure_trigger', edge_type: 'worsens', weight: 0.8, confidence: 0.86, evidence_base: 'Delayed study increases pre-exam anxiety' },
  { from_node_key: 'academic_self_efficacy', to_node_key: 'fear_of_failure_reinforcement', edge_type: 'protects_against', weight: 0.8, confidence: 0.84, evidence_base: 'Self-efficacy is the strongest predictor of academic resilience (Bandura)' },
  { from_node_key: 'study_structure_intervention', to_node_key: 'procrastination_signal', edge_type: 'ameliorates', weight: 0.85, confidence: 0.86, evidence_base: 'Implementation intentions reduce procrastination by 35%' },
  { from_node_key: 'anxiety_defusion_intervention', to_node_key: 'exam_anxiety_domain', edge_type: 'ameliorates', weight: 0.80, confidence: 0.83, evidence_base: 'Pre-exam anxiety techniques reduce arousal by 28%' },

  // Emotional causal chain
  { from_node_key: 'emotional_overwhelm_trigger', to_node_key: 'rumination_reinforcement', edge_type: 'triggers', weight: 0.85, confidence: 0.88, evidence_base: 'Overwhelm activates ruminative processing (Nolen-Hoeksema)' },
  { from_node_key: 'rumination_reinforcement', to_node_key: 'emotional_volatility_signal', edge_type: 'causes', weight: 0.80, confidence: 0.85, evidence_base: 'Rumination sustains and amplifies negative affect' },
  { from_node_key: 'emotional_volatility_signal', to_node_key: 'emotional_burnout_marker', edge_type: 'predicts_relapse', weight: 0.75, confidence: 0.82, evidence_base: 'High emotional volatility is predictive of burnout progression' },
  { from_node_key: 'social_support_protective', to_node_key: 'emotional_overwhelm_trigger', edge_type: 'protects_against', weight: 0.75, confidence: 0.82, evidence_base: 'Social co-regulation reduces overwhelm frequency' },
  { from_node_key: 'grounding_intervention', to_node_key: 'rumination_reinforcement', edge_type: 'ameliorates', weight: 0.80, confidence: 0.84, evidence_base: 'Grounding interrupts ruminative loops (Hayes et al.)' },

  // Behavioural causal chain
  { from_node_key: 'context_cue_trigger', to_node_key: 'habit_formation_domain', edge_type: 'causes', weight: 0.85, confidence: 0.88, evidence_base: 'Context cues initiate habitual sequences (Wood & Rünger, 2016)' },
  { from_node_key: 'identity_conflict_vulnerability', to_node_key: 'executive_function_domain', edge_type: 'worsens', weight: 0.75, confidence: 0.80, evidence_base: 'Identity-behaviour mismatch depletes self-regulatory resources' },
  { from_node_key: 'implementation_intention', to_node_key: 'context_cue_trigger', edge_type: 'ameliorates', weight: 0.85, confidence: 0.87, evidence_base: 'If-then planning reduces cue-response gap (Gollwitzer, 1999)' },
  { from_node_key: 'identity_reframe_intervention', to_node_key: 'identity_conflict_vulnerability', edge_type: 'ameliorates', weight: 0.80, confidence: 0.83, evidence_base: 'Identity-based habit formation is 2.5x more durable than outcome-based' },
  { from_node_key: 'behavioural_consistency', to_node_key: 'identity_conflict_vulnerability', edge_type: 'protects_against', weight: 0.75, confidence: 0.81, evidence_base: 'Track record of consistency resolves identity-behaviour conflict' },

  // Social causal chain
  { from_node_key: 'social_anxiety_trigger', to_node_key: 'social_avoidance_reinforcement', edge_type: 'triggers', weight: 0.90, confidence: 0.90, evidence_base: 'Evaluative threat is the primary driver of social avoidance' },
  { from_node_key: 'social_avoidance_reinforcement', to_node_key: 'social_confidence_domain', edge_type: 'worsens', weight: 0.85, confidence: 0.87, evidence_base: 'Avoidance prevents exposure learning, maintaining fear' },
  { from_node_key: 'graduated_exposure_intervention', to_node_key: 'social_avoidance_reinforcement', edge_type: 'ameliorates', weight: 0.85, confidence: 0.86, evidence_base: 'Graduated exposure is the gold-standard intervention for social avoidance' },
];

// ─── Engine Class ─────────────────────────────────────────────────────────────

export class OntologyEngine {
  constructor(private pool: Pool) {}

  /** Seed canonical ontology nodes and edges (idempotent). */
  async seedOntology(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const node of SEED_NODES) {
        await client.query(
          `INSERT INTO omega_ontology_nodes
            (node_key, node_type, label, description, concern_category, severity_weight, emotional_valence, metadata)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (node_key) DO UPDATE SET
             label = EXCLUDED.label,
             description = EXCLUDED.description,
             severity_weight = EXCLUDED.severity_weight,
             metadata = EXCLUDED.metadata`,
          [node.node_key, node.node_type, node.label, node.description,
           node.concern_category ?? null, node.severity_weight,
           node.emotional_valence, JSON.stringify(node.metadata)],
        );
      }
      for (const edge of SEED_EDGES) {
        await client.query(
          `INSERT INTO omega_ontology_edges
            (from_node_key, to_node_key, edge_type, weight, confidence, evidence_base)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (from_node_key, to_node_key, edge_type) DO UPDATE SET
             weight = EXCLUDED.weight, confidence = EXCLUDED.confidence`,
          [edge.from_node_key, edge.to_node_key, edge.edge_type,
           edge.weight, edge.confidence, edge.evidence_base ?? null],
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  /** Map a concern category string → canonical category key. */
  resolveConcernCategory(concernName: string): string {
    const lc = concernName.toLowerCase();
    if (/screen|digital|phone|social media|gaming|scroll|tiktok|instagram/.test(lc)) return 'digital';
    if (/exam|study|academic|focus|concentration|procrastinat|school|college|learn/.test(lc)) return 'academic';
    if (/anxi|stress|emotion|mood|anger|depress|burnout|overwhelm|panic/.test(lc)) return 'emotional';
    if (/habit|behaviour|routine|impuls|executive|planning|organis/.test(lc)) return 'behavioural';
    if (/social|friend|relationship|communicat|confidence|shy|awkward/.test(lc)) return 'social';
    return 'behavioural';
  }

  /** Load all nodes for a given concern category. */
  async getNodesForCategory(category: string): Promise<OntologyNode[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM omega_ontology_nodes WHERE concern_category = $1 ORDER BY severity_weight DESC`,
      [category],
    );
    return rows;
  }

  /** Traverse causal edges from trigger nodes — returns ordered causal chain. */
  async buildCausalChain(category: string, scoreLevel: string): Promise<CausalStep[]> {
    const { rows } = await this.pool.query(
      `SELECT e.*, fn.label AS from_label, tn.label AS to_label,
              fn.node_type AS from_type, tn.node_type AS to_type
       FROM omega_ontology_edges e
       JOIN omega_ontology_nodes fn ON e.from_node_key = fn.node_key
       JOIN omega_ontology_nodes tn ON e.to_node_key = tn.node_key
       WHERE fn.concern_category = $1
         AND e.edge_type IN ('causes','reinforces','triggers','worsens')
       ORDER BY e.weight DESC
       LIMIT 6`,
      [category],
    );

    return rows.map((r: Record<string, unknown>) => ({
      from: r.from_node_key as string,
      from_label: r.from_label as string,
      edge_type: r.edge_type as EdgeType,
      to: r.to_node_key as string,
      to_label: r.to_label as string,
      weight: parseFloat(r.weight as string),
      explanation: this.explainEdge(r.edge_type as EdgeType, r.from_label as string, r.to_label as string),
    }));
  }

  /** Get trigger nodes for a concern category. */
  async getTriggerNodes(category: string): Promise<OntologyNode[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM omega_ontology_nodes
       WHERE concern_category = $1 AND node_type = 'trigger'
       ORDER BY severity_weight DESC`,
      [category],
    );
    return rows;
  }

  /** Get protective factors for a concern category. */
  async getProtectiveNodes(category: string): Promise<OntologyNode[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM omega_ontology_nodes
       WHERE concern_category = $1 AND node_type = 'protective_factor'
       ORDER BY severity_weight ASC`,
      [category],
    );
    return rows;
  }

  /** Get intervention nodes ordered by phase, filtered by score level. */
  async getInterventionSequence(category: string, scoreLevel: string): Promise<InterventionStep[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM omega_ontology_nodes
       WHERE concern_category = $1 AND node_type = 'intervention'
       ORDER BY severity_weight`,
      [category],
    );

    const phaseOrder = { stabilisation: 0, growth: 1, optimisation: 2 };

    return rows
      .map((r: Record<string, unknown>, i: number) => {
        const meta = (r.metadata as Record<string, unknown>) ?? {};
        const phase = (meta.phase as string) ?? 'stabilisation';
        return {
          phase: phase as InterventionStep['phase'],
          intervention_key: r.node_key as string,
          label: r.label as string,
          description: r.description as string,
          timing: (meta.timing as string) ?? '1-2 weeks',
          intensity: scoreLevel === 'Emerging' ? 'low' : scoreLevel === 'Developing' ? 'moderate' : 'moderate' as InterventionStep['intensity'],
          priority: i + 1,
        };
      })
      .sort((a: InterventionStep, b: InterventionStep) =>
        (phaseOrder[a.phase] ?? 0) - (phaseOrder[b.phase] ?? 0),
      )
      .slice(0, 3);
  }

  /** Build and persist a full session ontology. */
  async buildSessionOntology(
    sessionId: string,
    concernName: string,
    scoreLevel: string,
    subdomainScores: Record<string, number>,
  ): Promise<SessionOntology> {
    const category = this.resolveConcernCategory(concernName);

    const [nodes, causalChain, triggers, protective, interventions] = await Promise.all([
      this.getNodesForCategory(category),
      this.buildCausalChain(category, scoreLevel),
      this.getTriggerNodes(category),
      this.getProtectiveNodes(category),
      this.getInterventionSequence(category, scoreLevel),
    ]);

    const activeNodeKeys = nodes.map((n: OntologyNode) => n.node_key);

    const confidenceMap: Record<string, number> = {};
    for (const n of nodes) {
      const baseConf = n.severity_weight > 1.2 ? 0.80 : n.severity_weight > 1.0 ? 0.70 : 0.60;
      confidenceMap[n.node_key] = Math.min(0.95, baseConf);
    }

    const ontology: SessionOntology = {
      session_id: sessionId,
      active_node_keys: activeNodeKeys,
      causal_chain: causalChain,
      trigger_nodes: triggers,
      protective_nodes: protective,
      intervention_sequence: interventions,
      confidence_map: confidenceMap,
      safety_status: 'informational',
      safety_flags: [],
      calibration: {},
    };

    await this.pool.query(
      `INSERT INTO omega_session_ontology
        (session_id, active_node_keys, causal_chain, trigger_nodes, protective_nodes,
         intervention_sequence, confidence_map, safety_status, safety_flags, calibration)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (session_id) DO UPDATE SET
         active_node_keys = EXCLUDED.active_node_keys,
         causal_chain = EXCLUDED.causal_chain,
         trigger_nodes = EXCLUDED.trigger_nodes,
         protective_nodes = EXCLUDED.protective_nodes,
         intervention_sequence = EXCLUDED.intervention_sequence,
         confidence_map = EXCLUDED.confidence_map,
         safety_status = EXCLUDED.safety_status,
         safety_flags = EXCLUDED.safety_flags,
         calibration = EXCLUDED.calibration,
         generated_at = NOW()`,
      [
        sessionId,
        JSON.stringify(activeNodeKeys),
        JSON.stringify(causalChain),
        JSON.stringify(triggers),
        JSON.stringify(protective),
        JSON.stringify(interventions),
        JSON.stringify(confidenceMap),
        ontology.safety_status,
        JSON.stringify(ontology.safety_flags),
        JSON.stringify(ontology.calibration),
      ],
    );

    return ontology;
  }

  /** Load persisted session ontology (or generate on demand). */
  async getSessionOntology(sessionId: string): Promise<SessionOntology | null> {
    const { rows } = await this.pool.query(
      `SELECT * FROM omega_session_ontology WHERE session_id = $1`,
      [sessionId],
    );
    if (!rows.length) return null;
    const r = rows[0];
    return {
      session_id: r.session_id,
      active_node_keys: r.active_node_keys ?? [],
      causal_chain: r.causal_chain ?? [],
      trigger_nodes: r.trigger_nodes ?? [],
      protective_nodes: r.protective_nodes ?? [],
      intervention_sequence: r.intervention_sequence ?? [],
      confidence_map: r.confidence_map ?? {},
      safety_status: r.safety_status ?? 'informational',
      safety_flags: r.safety_flags ?? [],
      calibration: r.calibration ?? {},
    };
  }

  private explainEdge(edgeType: EdgeType, from: string, to: string): string {
    const map: Record<string, string> = {
      causes: `${from} directly causes ${to} — addressing this breaks the chain.`,
      reinforces: `${from} strengthens and sustains ${to} over time.`,
      triggers: `${from} is what sets off ${to} — identifying it is the first step.`,
      worsens: `${from} makes ${to} more severe without direct causation.`,
      protects_against: `${from} acts as a protective buffer against ${to}.`,
      enables_intervention: `${from} makes ${to} significantly more achievable.`,
      ameliorates: `${from} directly reduces the intensity of ${to}.`,
      predicts_relapse: `${from} is an early warning sign that ${to} may return.`,
    };
    return map[edgeType] ?? `${from} → ${to}`;
  }
}
