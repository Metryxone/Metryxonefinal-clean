/**
 * RIE Intervention Orchestration Engine
 * Determines next-best-action sequences, creates interventions and escalations.
 * Implements constitutional AI guardrails against harmful escalation.
 */
import type { Pool } from 'pg';
import type { InterventionContext } from './rie-aggregator';

export interface InterventionRecord {
  domain: string;
  intervention_mode: string;
  title: string;
  description: string;
  escalation_level: string;
  priority: string;
}

// ── Constitutional AI Guardrails ─────────────────────────────────────────────
function checkConstitutionalGuardrails(ctx: InterventionContext): { safe: boolean; reason: string } {
  if (ctx.crisis_detected) {
    return { safe: false, reason: `Crisis signal detected: ${ctx.crisis_type}. Mandatory human review required before any automated intervention.` };
  }
  if (ctx.emotional_load > 90) {
    return { safe: false, reason: 'Extreme emotional load — automated challenge or intensive intervention would be harmful. Human counsellor must assess first.' };
  }
  return { safe: true, reason: '' };
}

// ── Next-Best-Action Sequence Builder ────────────────────────────────────────
function buildNextBestActionSequence(ctx: InterventionContext): Array<{ action_type: string; action_label: string; rationale: string }> {
  const steps: Array<{ action_type: string; action_label: string; rationale: string }> = [];

  if (ctx.cognitive_load > 65 || ctx.emotional_load > 60) {
    steps.push({
      action_type: 'overload_reduction',
      action_label: 'Reduce cognitive and emotional overload',
      rationale: 'High combined load detected — overload reduction is the critical first step',
    });
  }

  if (ctx.early_warnings.length > 0 || ctx.emotional_load > 40) {
    steps.push({
      action_type: 'emotional_stabilisation',
      action_label: 'Stabilise emotional state',
      rationale: `${ctx.early_warnings.length} early warning signals — emotional stabilisation before any challenge`,
    });
  }

  if (ctx.csi_score < 50 && ctx.sessions_completed > 1) {
    steps.push({
      action_type: 'resilience_rebuilding',
      action_label: 'Rebuild resilience foundation',
      rationale: `CSI ${ctx.csi_score}/100 — resilience scaffolding through small consistent wins`,
    });
  }

  if (ctx.dropout_risk > 50) {
    steps.push({
      action_type: 'retention_intervention',
      action_label: 'Proactive retention outreach',
      rationale: `Dropout risk ${ctx.dropout_risk}% — counsellor outreach and re-engagement needed`,
    });
  }

  if (ctx.csi_score >= 50 && ctx.emotional_load < 50) {
    steps.push({
      action_type: 'challenge_reintroduction',
      action_label: 'Reintroduce progressive challenges',
      rationale: 'Stabilised state — progressive challenge reintroduction to drive growth',
    });
  }

  if (ctx.leadership_emergence > 60 || ctx.employability_readiness > 70) {
    steps.push({
      action_type: 'amplification',
      action_label: 'Amplify strength signals and opportunities',
      rationale: 'Strong opportunity signals — activate amplification pathway',
    });
  }

  return steps;
}

// ── Escalation Routing ────────────────────────────────────────────────────────
function routeEscalation(ctx: InterventionContext): {
  needed: boolean;
  type: string;
  severity: string;
  requires_counsellor: boolean;
  requires_mentor: boolean;
  requires_peer_support: boolean;
  mandatory_human_review: boolean;
  trigger_reason: string;
  trigger_signals: string[];
} {
  if (ctx.crisis_detected) {
    return {
      needed: true,
      type: 'crisis_escalation',
      severity: 'critical',
      requires_counsellor: true,
      requires_mentor: false,
      requires_peer_support: false,
      mandatory_human_review: true,
      trigger_reason: `Crisis signal: ${ctx.crisis_type}. Constitutional AI guardrail triggered.`,
      trigger_signals: ctx.early_warnings,
    };
  }

  if (ctx.dropout_risk > 75) {
    return {
      needed: true,
      type: 'dropout_risk_escalation',
      severity: 'high',
      requires_counsellor: true,
      requires_mentor: true,
      requires_peer_support: false,
      mandatory_human_review: false,
      trigger_reason: `Dropout risk ${ctx.dropout_risk}% exceeds critical threshold`,
      trigger_signals: ['dropout_risk', 'engagement_score'],
    };
  }

  if (ctx.burnout_probability > 70) {
    return {
      needed: true,
      type: 'burnout_escalation',
      severity: 'high',
      requires_counsellor: true,
      requires_mentor: false,
      requires_peer_support: true,
      mandatory_human_review: false,
      trigger_reason: `Burnout probability ${ctx.burnout_probability}% — immediate support needed`,
      trigger_signals: ['burnout_probability', 'emotional_load', 'cognitive_load'],
    };
  }

  if (ctx.emotional_load > 70) {
    return {
      needed: true,
      type: 'emotional_support_escalation',
      severity: 'medium',
      requires_counsellor: false,
      requires_mentor: true,
      requires_peer_support: true,
      mandatory_human_review: false,
      trigger_reason: `Emotional load ${ctx.emotional_load}/100 — mentor support recommended`,
      trigger_signals: ['emotional_load', ...ctx.early_warnings.slice(0, 2)],
    };
  }

  return {
    needed: false,
    type: '',
    severity: 'low',
    requires_counsellor: false,
    requires_mentor: false,
    requires_peer_support: false,
    mandatory_human_review: false,
    trigger_reason: '',
    trigger_signals: [],
  };
}

export async function orchestrateInterventions(
  pool: Pool,
  ctx: InterventionContext
): Promise<void> {
  const guardrail = checkConstitutionalGuardrails(ctx);
  const escalationDecision = routeEscalation(ctx);

  const tenantId = ctx.tenant_id;

  if (escalationDecision.needed) {
    const { rows: [esc] } = await pool.query(`
      INSERT INTO rie_escalations
        (user_email, tenant_id, session_id, escalation_type, severity, trigger_reason, trigger_signals,
         requires_counsellor, requires_mentor, requires_peer_support, mandatory_human_review,
         status, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending',NOW(),NOW())
      RETURNING id, user_email, escalation_type, severity, trigger_reason, requires_counsellor, mandatory_human_review
    `, [
      ctx.user_email, tenantId, ctx.session_id || null,
      escalationDecision.type, escalationDecision.severity,
      escalationDecision.trigger_reason,
      JSON.stringify(escalationDecision.trigger_signals),
      escalationDecision.requires_counsellor,
      escalationDecision.requires_mentor,
      escalationDecision.requires_peer_support,
      escalationDecision.mandatory_human_review,
    ]);

    // Non-blocking email alert for mandatory human review escalations
    if (esc?.mandatory_human_review) {
      import('../email').then(({ sendCrisisEscalationAlert }) =>
        sendCrisisEscalationAlert(esc).then(sent => {
          if (sent && esc?.id) {
            pool.query(
              `UPDATE rie_escalations SET admin_notified_at = NOW() WHERE id = $1`,
              [esc.id]
            ).catch(e => console.error('[rie] admin_notified_at update error:', e));
          }
        }).catch(e => console.error('[rie] crisis email error:', e))
      ).catch(console.error);
    }
  }

  if (!guardrail.safe) {
    return;
  }

  const sequence = buildNextBestActionSequence(ctx);

  for (const [i, step] of sequence.entries()) {
    const escLevel = escalationDecision.needed && i === 0 ? escalationDecision.severity : 'none';
    const priority = i === 0 ? 'high' : i === 1 ? 'medium' : 'low';

    const { rows: [intervention] } = await pool.query(`
      INSERT INTO rie_interventions
        (user_email, tenant_id, session_id, domain, intervention_mode, title, description,
         escalation_level, status, priority, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9,NOW(),NOW())
      RETURNING id
    `, [
      ctx.user_email, tenantId, ctx.session_id || null,
      step.action_type, 'structured_support',
      step.action_label, step.rationale,
      escLevel, priority,
    ]);

    await pool.query(`
      INSERT INTO rie_intervention_sequences
        (user_email, tenant_id, sequence_step, intervention_id, action_type, action_label, rationale, status, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',NOW())
    `, [
      ctx.user_email, tenantId, i + 1, intervention?.id || null,
      step.action_type, step.action_label, step.rationale,
    ]);
  }
}
