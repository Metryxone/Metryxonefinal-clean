/**
 * LBI Stakeholder Report Engine  (E8)
 *
 * Generates 4-audience narrative summaries from LBI intelligence data:
 *   learner   — personal insights + growth action plan
 *   parent    — home support guidance + conversation starters
 *   counselor — risk triage + priority interventions for sessions
 *   employer  — team readiness + productivity risk indicators
 *
 * Composes from existing LBI tables — never recomputes scores.
 * Structured sections match rf_generated_reports shape for archiving.
 */
import type { Pool } from 'pg';

export type StakeholderType = 'learner' | 'parent' | 'counselor' | 'employer';

export interface ReportSection {
  section_type: 'header' | 'narrative' | 'insight' | 'table' | 'action_list';
  title:  string;
  body:   string | null;
  items?: string[];
  data?:  Record<string, unknown>;
}

export interface LbiStakeholderReport {
  stakeholder:    StakeholderType;
  email:          string;
  generated_at:   string;
  overall_lbi:    number | null;
  learning_style: string | null;
  lbi_band:       string | null;
  sections:       ReportSection[];
  meta: {
    has_risk_data:  boolean;
    has_rec_data:   boolean;
    has_trend_data: boolean;
    confidence:     'high' | 'moderate' | 'low';
  };
}

const BAND_LABEL: Record<string, string> = {
  exceptional: 'Exceptional Learner',
  growth:      'Growth Learner',
  developing:  'Developing Learner',
  emerging:    'Emerging Learner',
  no_data:     'No Assessment Data Yet',
};

const STYLE_DESC: Record<string, { label: string; strength: string; challenge: string }> = {
  reflective:  {
    label:     'Reflective Learner',
    strength:  'deep analytical thinking and careful, deliberate consideration before acting',
    challenge: 'pace — reflective learners benefit from structured time windows to avoid analysis paralysis',
  },
  persistent: {
    label:     'Persistent Learner',
    strength:  'sustained effort and strong follow-through on difficult material',
    challenge: 'flexibility — persistent learners sometimes need support adapting their strategy when stuck',
  },
  exploratory: {
    label:     'Exploratory Learner',
    strength:  'breadth of engagement, curiosity-led discovery, and making unexpected connections',
    challenge: 'depth — exploratory learners benefit from anchoring on fewer topics at a time to build mastery',
  },
  impulsive: {
    label:     'Impulsive Learner',
    strength:  'quick initiation, high initial energy, and willingness to try new approaches immediately',
    challenge: 'sustained focus — short, high-frequency tasks work best; long sessions lead to drop-off',
  },
  disengaged: {
    label:     'Disengaged Learner',
    strength:  'selective, focused engagement when the topic connects to lived experience or personal goals',
    challenge: 'activation — low-friction entry points, visible progress, and personal relevance matter most',
  },
};

export async function generateLbiStakeholderReport(
  email: string,
  stakeholder: StakeholderType,
  pool: Pool,
): Promise<LbiStakeholderReport | null> {
  try {
    const [scoreRes, riskRes, recRes, trendRes] = await Promise.all([
      pool.query<{
        overall_lbi: number; learning_style: string; lbi_band: string;
        attention_score: number; consistency_score: number; persistence_score: number;
        velocity_score: number; adaptability_score: number;
      }>(
        `SELECT overall_lbi, learning_style, lbi_band,
                attention_score, consistency_score, persistence_score,
                velocity_score, adaptability_score
         FROM lbi_scores WHERE user_email = $1 LIMIT 1`,
        [email],
      ).catch(() => ({ rows: [] as any[] })),

      pool.query<{ risk_type: string; risk_label: string; severity: string; rationale: string }>(
        `SELECT risk_type, risk_label, severity, rationale
         FROM lbi_risk_indicators
         WHERE user_email = $1 AND is_active = TRUE
         ORDER BY severity DESC`,
        [email],
      ).catch(() => ({ rows: [] as any[] })),

      pool.query<{ title: string; description: string; effort_level: string; action_type: string }>(
        `SELECT m.title, m.description, m.effort_level, m.action_type
         FROM lbi_user_recommendations ur
         JOIN lbi_recommendation_master m ON m.id = ur.recommendation_id
         WHERE ur.user_email = $1 AND m.is_active = TRUE
         ORDER BY ur.priority_score DESC LIMIT 6`,
        [email],
      ).catch(() => ({ rows: [] as any[] })),

      pool.query<{ dimension: string; dimension_label: string; direction: string }>(
        `SELECT DISTINCT ON (dimension) dimension, dimension_label, direction
         FROM lbi_behavior_trends
         WHERE user_email = $1
         ORDER BY dimension, snapshot_date DESC`,
        [email],
      ).catch(() => ({ rows: [] as any[] })),
    ]);

    const score  = scoreRes.rows[0] ?? null;
    const risks  = riskRes.rows;
    const recs   = recRes.rows;
    const trends = trendRes.rows;

    if (!score) return null;

    const styleInfo  = STYLE_DESC[score.learning_style ?? ''] ?? null;
    const bandLabel  = BAND_LABEL[score.lbi_band ?? 'no_data'] ?? 'Unknown';
    const lbiRounded = Math.round(score.overall_lbi ?? 0);
    const highRisks  = risks.filter(r => r.severity === 'high');
    const improvingDims = trends.filter(t => t.direction === 'improving').map(t => t.dimension_label);
    const decliningDims = trends.filter(t => t.direction === 'declining').map(t => t.dimension_label);

    const confidence: 'high' | 'moderate' | 'low' =
      recs.length > 0 && trends.length > 0 ? 'high' : recs.length > 0 ? 'moderate' : 'low';

    const sections = buildSections(stakeholder, {
      score, styleInfo, bandLabel, lbiRounded,
      risks, highRisks, recs, trends, improvingDims, decliningDims,
    });

    const report: LbiStakeholderReport = {
      stakeholder,
      email,
      generated_at:   new Date().toISOString(),
      overall_lbi:    score.overall_lbi,
      learning_style: score.learning_style,
      lbi_band:       score.lbi_band,
      sections,
      meta: {
        has_risk_data:  risks.length > 0,
        has_rec_data:   recs.length > 0,
        has_trend_data: trends.length > 0,
        confidence,
      },
    };

    // Archive to rf_generated_reports (fire-and-forget, non-blocking)
    setImmediate(() => {
      pool.query(
        `INSERT INTO rf_generated_reports
           (report_type, subject_email, stakeholder_type, content, generated_at)
         VALUES ($1,$2,$3,$4,NOW())
         ON CONFLICT DO NOTHING`,
        ['lbi_stakeholder', email, stakeholder, JSON.stringify(report)],
      ).catch(() => null);
    });

    return report;
  } catch (err) {
    console.error('[lbi-stakeholder-report] error:', err);
    return null;
  }
}

interface Ctx {
  score: any; styleInfo: any; bandLabel: string; lbiRounded: number;
  risks: any[]; highRisks: any[]; recs: any[]; trends: any[];
  improvingDims: string[]; decliningDims: string[];
}

function buildSections(stakeholder: StakeholderType, ctx: Ctx): ReportSection[] {
  const { score, styleInfo, bandLabel, lbiRounded, risks, highRisks, recs, improvingDims, decliningDims } = ctx;

  switch (stakeholder) {
    case 'learner': return [
      {
        section_type: 'header',
        title: 'Your Learning Profile',
        body: `You are a ${bandLabel} with an LBI score of ${lbiRounded}/100.${styleInfo ? ` Your learning style is ${styleInfo.label}.` : ''}`,
      },
      {
        section_type: 'narrative',
        title: 'Your Strengths',
        body: styleInfo
          ? `Your greatest strength is ${styleInfo.strength}.`
          : 'Your profile shows consistent engagement across key learning dimensions.',
      },
      ...(styleInfo ? [{
        section_type: 'insight' as const,
        title: 'Your Growth Edge',
        body: `Key focus area: ${styleInfo.challenge}.`,
      }] : []),
      ...(improvingDims.length > 0 ? [{
        section_type: 'insight' as const,
        title: 'Dimensions Improving',
        body: null,
        items: improvingDims,
      }] : []),
      ...(decliningDims.length > 0 ? [{
        section_type: 'insight' as const,
        title: 'Dimensions Needing Attention',
        body: null,
        items: decliningDims,
      }] : []),
      {
        section_type: 'action_list',
        title: 'Your Top Growth Actions',
        body: null,
        items: recs.length > 0
          ? recs.slice(0, 4).map(r => `${r.title} — ${r.description}`)
          : ['Complete additional CAPADEX sessions to unlock personalised recommendations.'],
      },
    ];

    case 'parent': return [
      {
        section_type: 'header',
        title: "Your Child's Learning Profile",
        body: `Your child is a ${bandLabel} (LBI score: ${lbiRounded}/100).${styleInfo ? ` They learn best as a ${styleInfo.label}.` : ''}`,
      },
      {
        section_type: 'narrative',
        title: 'What This Means at Home',
        body: styleInfo
          ? `Your child's strength is ${styleInfo.strength}. To support them best, focus on: ${styleInfo.challenge}.`
          : 'Your child shows a developing learning profile. More sessions will increase insight quality.',
      },
      ...(highRisks.length > 0 ? [{
        section_type: 'insight' as const,
        title: 'Areas to Watch',
        body: null,
        items: highRisks.map(r => `${r.risk_label}: ${r.rationale}`),
      }] : []),
      {
        section_type: 'action_list',
        title: 'Home Support Actions',
        body: null,
        items: [
          'Create a consistent, low-distraction study environment.',
          'Celebrate small wins — visible progress is a strong motivator.',
          'Ask "What made you curious today?" rather than "How long did you study?"',
          ...(recs.slice(0, 2).map(r => r.title)),
        ],
      },
      {
        section_type: 'narrative',
        title: 'Conversation Starters',
        body: 'Try asking: "Is there a topic you found hard that you\'d like help with?" or "What\'s one thing you learned this week that surprised you?"',
      },
    ];

    case 'counselor': return [
      {
        section_type: 'header',
        title: 'LBI Counselor Briefing',
        body: `Client LBI: ${lbiRounded}/100 (${bandLabel}).${styleInfo ? ` Learning style: ${styleInfo.label}.` : ''}`,
      },
      {
        section_type: 'table',
        title: 'Dimension Scores',
        body: null,
        data: {
          attention:    Math.round(score.attention_score    ?? 0),
          consistency:  Math.round(score.consistency_score  ?? 0),
          persistence:  Math.round(score.persistence_score  ?? 0),
          velocity:     Math.round(score.velocity_score     ?? 0),
          adaptability: Math.round(score.adaptability_score ?? 0),
        },
      },
      risks.length > 0
        ? { section_type: 'insight' as const, title: 'Active Risk Indicators', body: null,
            items: risks.map(r => `[${r.severity?.toUpperCase()}] ${r.risk_label}: ${r.rationale}`) }
        : { section_type: 'narrative' as const, title: 'Risk Status', body: 'No active risk indicators detected at this time.' },
      {
        section_type: 'action_list',
        title: 'Priority Interventions',
        body: null,
        items: recs.length > 0
          ? recs.slice(0, 5).map(r => `[${r.effort_level}] ${r.title}: ${r.description}`)
          : ['Encourage completion of additional assessments to generate personalised interventions.'],
      },
      ...(ctx.trends.length > 0 ? [{
        section_type: 'insight' as const,
        title: 'Trend Monitoring',
        body: null,
        items: ctx.trends.map(t => `${t.dimension_label}: ${t.direction?.replace('_', ' ')}`),
      }] : []),
    ];

    case 'employer': return [
      {
        section_type: 'header',
        title: 'LBI Employer Intelligence Summary',
        body: `Team member LBI score: ${lbiRounded}/100 (${bandLabel}).`,
      },
      {
        section_type: 'narrative',
        title: 'Learning Profile',
        body: styleInfo
          ? `This team member demonstrates ${styleInfo.strength}. Key development consideration: ${styleInfo.challenge}.`
          : 'Learning profile is in development — additional sessions will increase signal quality.',
      },
      {
        section_type: 'table',
        title: 'Readiness Indicators',
        body: null,
        data: {
          learning_velocity: Math.round(score.velocity_score     ?? 0),
          adaptability:      Math.round(score.adaptability_score ?? 0),
          consistency:       Math.round(score.consistency_score  ?? 0),
          risk_indicators:   risks.length,
          high_risk_flags:   highRisks.length,
        },
      },
      ...(highRisks.length > 0 ? [{
        section_type: 'insight' as const,
        title: 'Productivity Risk Flags',
        body: null,
        items: highRisks.map(r => r.risk_label),
      }] : []),
      {
        section_type: 'action_list',
        title: 'Development Recommendations',
        body: null,
        items: recs.length > 0
          ? recs.slice(0, 4).map(r => r.title)
          : ['Encourage team member to complete their CAPADEX assessment for personalised recommendations.'],
      },
    ];
  }
}
