/**
 * RIE Opportunity Amplification Engine
 * Detects: leadership emergence, resilience acceleration, hidden capability, rapid learning potential
 */
import type { Pool } from 'pg';
import type { InterventionContext } from './rie-aggregator';
import { PUBLIC_TENANT_ID } from './rie-aggregator';

export interface OpportunityFlag {
  opportunity_type: string;
  title: string;
  description: string;
  cascade_model: string[];
  confidence: number;
  amplification_actions: string[];
}

export function detectOpportunities(ctx: InterventionContext): OpportunityFlag[] {
  const flags: OpportunityFlag[] = [];

  // Access properly typed fields — no casts needed
  const adaptability = ctx.behavioural_state.adaptability;
  const persistence = ctx.behavioural_state.persistence;

  if (ctx.leadership_emergence > 65 && adaptability > 65 && persistence > 60) {
    flags.push({
      opportunity_type: 'leadership_emergence',
      title: 'Leadership Emergence Detected',
      description: `Leadership signal at ${ctx.leadership_emergence}% with strong adaptability (${adaptability}) and persistence (${persistence}). High-potential leadership trajectory confirmed.`,
      cascade_model: [
        'High CSI score → strong behavioural adaptability',
        'Persistence × adaptability → leadership readiness indicator',
        'Current stage supports leadership activation',
        'Peer mentoring → enhanced social capital → leadership positioning',
      ],
      confidence: 0.78,
      amplification_actions: [
        'Assign peer mentoring role to activate leadership identity',
        'Introduce collaborative challenge tasks',
        'Connect with leadership development programme',
        'Provide structured stretch assignments',
      ],
    });
  }

  if (ctx.trajectory === 'growth_acceleration' && ctx.csi_score > 55) {
    flags.push({
      opportunity_type: 'resilience_acceleration',
      title: 'Resilience Acceleration — Growth Trajectory Active',
      description: `Trajectory "${ctx.trajectory}" with CSI ${ctx.csi_score}/100 indicates sustained resilience acceleration. Growth momentum is building.`,
      cascade_model: [
        'Positive CSI trajectory → increasing resilience',
        'Sustained improvement → compounding growth effect',
        'Current momentum supports advanced challenge introduction',
      ],
      confidence: 0.81,
      amplification_actions: [
        'Introduce progressive stretch challenges',
        'Celebrate and reinforce growth momentum',
        'Set ambitious but achievable next-stage target',
        'Document success patterns for replication',
      ],
    });
  }

  const { lbi_score, lbi_style } = ctx;
  if (lbi_score > 65 && ctx.csi_score < 50) {
    flags.push({
      opportunity_type: 'hidden_capability',
      title: 'Hidden Capability Detected — LBI-CSI Divergence',
      description: `High LBI (${lbi_score}/100) with lower CSI (${ctx.csi_score}/100) suggests hidden capability not yet reflected in assessment scores. Untapped potential detected.`,
      cascade_model: [
        'Strong learning behaviour (LBI) not yet translating to outcome scores',
        'Possible assessment anxiety or surface barrier suppressing performance',
        'Capability exists — environmental or emotional barrier limiting expression',
      ],
      confidence: 0.72,
      amplification_actions: [
        'Investigate specific barriers preventing score expression',
        'Provide alternative assessment formats to surface capability',
        'Address anxiety or environmental factors blocking performance',
        'Use strength-based framing to unlock confidence',
      ],
    });
  }

  if (lbi_score > 55 && ctx.trajectory === 'growth_acceleration' && ctx.sessions_completed >= 3) {
    flags.push({
      opportunity_type: 'rapid_learning_potential',
      title: 'Rapid Learning Potential Identified',
      description: `LBI ${lbi_score}/100 with growth trajectory and ${ctx.sessions_completed} sessions indicates accelerated learning capacity. Fast-track development pathway available.`,
      cascade_model: [
        'High LBI velocity + consistent engagement → rapid learning signal',
        'Multiple completed sessions show sustained commitment',
        'Growth trajectory confirms positive momentum',
        'Optimal window for accelerated development programme',
      ],
      confidence: 0.75,
      amplification_actions: [
        'Enrol in accelerated development programme',
        'Introduce advanced assessment stages',
        'Pair with high-performing mentor',
        'Set ambitious 30-day growth sprint target',
      ],
    });
  }

  if (ctx.employability_readiness > 75 && ctx.csi_score > 70) {
    flags.push({
      opportunity_type: 'career_advancement_ready',
      title: 'Career Advancement Readiness Confirmed',
      description: `Employability ${ctx.employability_readiness}% + CSI ${ctx.csi_score}/100 indicate career advancement readiness. Professional positioning opportunity.`,
      cascade_model: [
        'High employability readiness → career opportunity window open',
        'Strong CSI stage indicates behavioural maturity',
        'Current profile supports senior role or career transition',
      ],
      confidence: 0.80,
      amplification_actions: [
        'Activate career advancement pathway',
        'Connect with industry mentors and networks',
        'Showcase portfolio of behavioural strengths',
        'Target stretch career opportunities',
      ],
    });
  }

  return flags;
}

export async function saveOpportunityFlags(
  pool: Pool,
  email: string,
  flags: OpportunityFlag[],
  tenantId: string = PUBLIC_TENANT_ID
): Promise<void> {
  for (const flag of flags) {
    await pool.query(`
      INSERT INTO rie_opportunity_flags
        (user_email, tenant_id, opportunity_type, title, description, cascade_model,
         confidence, amplification_actions, status, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active',NOW())
    `, [
      email, tenantId, flag.opportunity_type, flag.title, flag.description,
      JSON.stringify(flag.cascade_model),
      flag.confidence,
      JSON.stringify(flag.amplification_actions),
    ]);
  }
}
