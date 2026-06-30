/**
 * CAPADEX Enterprise Intelligence Routes
 * Implements: Recommendations Engine, Risk Intelligence, Gamification,
 *             Longitudinal Journey, Interventions, Consent, Audit Events,
 *             Admin Analytics + User Management
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { buildCapadexReportHtml, sendCapadexReport } from '../email';
import { buildOmegaEmailExtras } from '../services/omega-report-builder';
import { writeAuditEvent, AUDIT_EVENT } from '../lib/audit';
import { isEnabled } from '../services/feature-flags';
import { STAGE_CODE_TO_LABEL, LIFECYCLE_STAGE_CODES } from '../lib/lifecycle';
import { broadcastToSession } from '../services/ws-broadcast';
import type { GeneratedIntervention } from '../services/intervention-engine';
import { maybeActivateCareerBuilderOnCompletion } from '../services/career-builder-activation';

// ─── Concern Categorisation ────────────────────────────────────────────────
function categorizeConcern(concern: string): string {
  const l = concern.toLowerCase();
  if (/screen|phone|gaming|social.?media|digital|internet|device|app\b|online/.test(l)) return 'digital';
  if (/study|exam|homework|academic|school|grade|learning|class|marks|syllab/.test(l)) return 'academic';
  if (/anxiety|stress|emotion|mood|depress|worry|fear|loneli|mental|wellbeing/.test(l)) return 'emotional';
  if (/focus|attent|distract|concentrat|procrastinat|impulsiv|hyperactiv|restless/.test(l)) return 'behavioural';
  if (/social|peer|friend|relation|communicat|conflict|bully|shy/.test(l)) return 'social';
  if (/career|job|employ|skill|workplace|interview|profession/.test(l)) return 'career';
  return 'general';
}

// ─── Recommendation Templates ──────────────────────────────────────────────
const RECS: Record<string, Record<string, Array<{title:string; description:string; actions:string[]; priority:number}>>> = {
  Emerging: {
    digital: [
      { title: 'Digital Detox — Structured Screen Break Protocol', description: 'Your score signals significant digital behaviour patterns that need immediate, structured intervention.', actions: ['Schedule 2-hour phone-free blocks daily', 'Use grayscale mode on your phone to reduce dopamine triggers', 'Enable app timers for social media (max 30 min/day)', 'Create a phone-free bedroom rule from tonight'], priority: 1 },
      { title: 'Digital Replacement Activity Plan', description: 'Replace screen time with high-engagement offline activities matched to your interest profile.', actions: ['Identify 3 offline activities you enjoy', 'Schedule them for your usual screen-heavy hours', 'Join one offline group or club this week', 'Track offline hours alongside screen hours'], priority: 1 },
    ],
    academic: [
      { title: 'Immediate Academic Support Plan', description: 'Your academic concern pattern needs structured, immediate academic intervention.', actions: ['Meet your teacher/counsellor this week', 'Set up a daily 45-minute focused study block', 'Use active recall instead of passive reading', 'Find a study partner for accountability'], priority: 1 },
      { title: 'Learning Foundations Audit', description: 'Identify and address specific gaps in foundational knowledge that are blocking progress.', actions: ['List topics where you feel confused', 'Spend 20 min/day on one gap topic', 'Use Khan Academy or YouTube for concepts', 'Review basics before advancing'], priority: 1 },
    ],
    emotional: [
      { title: 'Emotional Regulation Support Plan', description: 'Your responses suggest emotional patterns that need immediate structured support.', actions: ['Speak to a counsellor or trusted adult this week', 'Practice 4-7-8 breathing (4 breaths twice daily)', 'Start a daily 5-minute mood journal', 'Identify your 3 main emotional triggers'], priority: 1 },
      { title: 'Wellbeing Baseline Reset', description: 'Build a foundation of basic wellbeing habits that stabilise emotional patterns.', actions: ['Sleep 8 hours consistently (same time nightly)', 'Walk or exercise for 20 min daily', 'Reduce caffeine intake', 'Hydrate 8 glasses per day'], priority: 1 },
    ],
    behavioural: [
      { title: 'Attention & Focus Intensive Plan', description: 'Your pattern shows foundational attention challenges. A structured approach is needed.', actions: ['Use Pomodoro (25 min focus + 5 min break)', 'Work in distraction-free environment', 'Put phone in another room during tasks', 'Start with smallest task to build momentum'], priority: 1 },
      { title: 'Behaviour Pattern Awareness Journal', description: 'Track when and where focus breaks down to find your specific pattern.', actions: ['Log every focus break for 7 days', 'Note time, location, trigger, what you switched to', 'Identify your peak focus hours', 'Schedule hardest tasks during peak hours'], priority: 1 },
    ],
    social: [
      { title: 'Social Confidence Building Plan', description: 'Your social concern profile needs structured, supported improvement.', actions: ['Initiate one new conversation daily', 'Join one group activity per week', 'Practice assertive communication scripts', 'Set a social interaction goal each week'], priority: 1 },
    ],
    general: [
      { title: 'Comprehensive Support Assessment', description: 'Your score indicates foundational patterns that need structured guidance.', actions: ['Meet with a counsellor or mentor this week', 'Identify your top 3 daily challenges', 'Create a simple daily routine', 'Track progress for 2 weeks'], priority: 1 },
    ],
  },
  Developing: {
    digital: [
      { title: '30-Day Digital Habit Reset', description: 'Build sustainable digital habits that give you control over your screen behaviour.', actions: ['Set specific app time limits this week', 'Create phone-free morning and evening routines', 'Use website blockers during study/work', 'Track your daily screen time weekly'], priority: 2 },
      { title: 'Digital Productivity Stack', description: 'Replace passive consumption with productive digital engagement.', actions: ['Unsubscribe from 10 low-value accounts', 'Curate your feed with educational content', 'Use screen time for learning 30 min/day', 'Schedule social media to 2 specific time slots'], priority: 2 },
    ],
    academic: [
      { title: 'Study System Upgrade', description: 'Improve your study efficiency with proven learning science methods.', actions: ['Switch to spaced repetition for memorisation', 'Use the Feynman technique for concepts', 'Build a weekly study schedule and stick to it', 'Use active retrieval — test yourself daily'], priority: 2 },
      { title: 'Focus & Output Optimisation', description: 'Increase your academic output without increasing study hours.', actions: ['Study in 45-min focused blocks', 'Review notes within 24 hours of class', 'Use mind maps for complex topics', 'Teach concepts to others to deepen retention'], priority: 2 },
    ],
    emotional: [
      { title: 'Emotional Intelligence Development Plan', description: 'Build your emotional awareness and regulation skills systematically.', actions: ['Daily 10-min mindfulness practice', 'Practice labelling emotions with precision', 'Identify 3 emotional response patterns', 'Weekly journaling — events, feelings, insights'], priority: 2 },
    ],
    behavioural: [
      { title: 'Habit Engineering Programme', description: 'Build new behavioural patterns using habit stacking and environmental design.', actions: ['Design your workspace for focus (no distractions)', 'Stack new habits onto existing routines', 'Use implementation intentions ("When X, I will Y")', 'Track your daily habit completion'], priority: 2 },
    ],
    social: [
      { title: 'Social Skills Development Track', description: 'Develop specific social competencies through structured practice.', actions: ['Practice active listening in every conversation', 'Join one new group, club or community', 'Set weekly social connection goals', 'Reflect on social interactions post-event'], priority: 2 },
    ],
    career: [
      { title: 'Career Intelligence Building', description: 'Build clarity and direction around your professional development.', actions: ['Research 3 roles that interest you this week', 'Identify 5 skills to develop in next 3 months', 'Connect with 2 professionals in your field', 'Start a skills-building project'], priority: 2 },
    ],
    general: [
      { title: 'Growth Strategy Builder', description: 'Create a structured plan for consistent improvement in this area.', actions: ['Define your clear goal for this area', 'Break it into monthly milestones', 'Find an accountability partner', 'Review progress weekly'], priority: 2 },
    ],
  },
  Proficient: {
    digital: [
      { title: 'Digital Leadership & Optimisation', description: 'Your digital habits are strong. Now optimise for peak performance.', actions: ['Audit your digital tools for productivity value', 'Share your digital wellness practices with others', 'Explore digital tools that enhance your goals', 'Set your next-level screen management target'], priority: 3 },
    ],
    academic: [
      { title: 'Academic Excellence Acceleration', description: 'Strong academic habits. Now accelerate with advanced strategies.', actions: ['Explore advanced learning methods (Zettelkasten, etc.)', 'Take on mentoring or peer tutoring', 'Set a stretch academic goal for next term', 'Build a knowledge portfolio in your interest area'], priority: 3 },
    ],
    emotional: [
      { title: 'Emotional Mastery & Leadership', description: 'Your emotional intelligence is developing well. Target mastery.', actions: ['Practice advanced empathy exercises', 'Lead a support conversation for someone else', 'Study emotional regulation in high-performance contexts', 'Build your resilience toolkit for adversity'], priority: 3 },
    ],
    behavioural: [
      { title: 'Peak Performance Habits', description: 'Strong behavioural patterns. Optimise for elite performance.', actions: ['Review and refine your daily systems', 'Add energy management to habit tracking', 'Experiment with ultradian rhythm scheduling', 'Mentor others in focus and attention skills'], priority: 3 },
    ],
    general: [
      { title: 'Sustained Growth & Optimisation', description: 'Good progress. Focus on compounding your gains.', actions: ['Review your progress from the past month', 'Identify one area to push into Advanced territory', 'Build a mentoring relationship', 'Document your system for others to learn from'], priority: 3 },
    ],
  },
  Advanced: {
    digital: [{ title: 'Digital Mastery — Share & Mentor', description: 'Excellent digital self-regulation. Focus on sustaining and teaching others.', actions: ['Document your digital wellness system', 'Mentor someone struggling with screen balance', 'Explore digital creation over consumption', 'Set a 90-day advanced optimisation challenge'], priority: 3 }],
    academic: [{ title: 'Academic Mastery — Teach & Lead', description: 'Outstanding academic patterns. Channel this into leadership and mentoring.', actions: ['Teach or tutor a peer in your strongest subject', 'Set a research or project challenge', 'Apply your skills to a real-world problem', 'Explore advanced certifications or competitions'], priority: 3 }],
    general: [{ title: 'Sustain, Share, Evolve', description: 'You are performing at the Advanced level. Maintain and inspire others.', actions: ['Share your approach with peers', 'Set your next frontier challenge', 'Explore new domains to apply these skills', 'Consider mentoring or coaching others'], priority: 3 }],
  },
};

function getRecs(
  concern: string,
  level: string,
  score?: number,
): Array<{title:string; description:string; actions:string[]; priority:number; category:string; reasoning:string}> {
  const cat = categorizeConcern(concern);
  const levelRecs = RECS[level] || RECS['Developing'];
  const templates = (levelRecs[cat] || levelRecs['general'] || []).slice(0, 2);

  const scoreStr = score != null ? `Score of ${Math.round(score)}` : level;
  const reasoningSuffix =
    level === 'Emerging'   ? '— below the 40-point threshold for structured intervention' :
    level === 'Developing' ? '— in the developing range (40–65), building towards proficiency' :
    level === 'Proficient' ? '— at proficiency level (65–80), optimising for performance' :
                             '— at advanced level, sustaining and sharing excellence';

  const reasoning = `${scoreStr} in ${cat} concern ${reasoningSuffix}`;
  return templates.map(t => ({ ...t, category: cat, reasoning }));
}

// ─── XP / Gamification Logic ───────────────────────────────────────────────
const STAGE_XP: Record<string, number> = { CAP_CUR: 100, CAP_INS: 150, CAP_GRW: 200, CAP_MAS: 250 };
const BADGES: Array<{code:string; label:string; desc:string; xp_required?:number; condition:string}> = [
  { code: 'first_step',    label: 'First Step',       desc: 'Completed your first assessment stage', condition: 'first_completion' },
  { code: 'deep_diver',    label: 'Deep Diver',        desc: 'Reached the Insight stage', condition: 'reached_insight' },
  { code: 'growth_seeker', label: 'Growth Seeker',     desc: 'Reached the Growth stage', condition: 'reached_growth' },
  { code: 'master_mind',   label: 'Master Mind',       desc: 'Completed all 4 assessment stages', condition: 'all_stages' },
  { code: 'multi_concern', label: 'Multi-Concern',     desc: 'Assessed 3 or more concerns', condition: 'three_concerns' },
  { code: 'high_scorer',   label: 'High Achiever',     desc: 'Scored 80+ on any stage', condition: 'high_score' },
  { code: 'comeback',      label: 'Comeback Kid',      desc: 'Improved score on a retake', condition: 'improved_score' },
];

// ─── Post-Completion Hooks (called from capadex.ts complete endpoint) ───────
export async function postCompletionHooks(
  pool: Pool,
  sessionId: string,
  userId: string | null,
  concernName: string,
  stageCode: string,
  score: number,
  scoreLevel: string,
  email: string | null
) {
  try {
    // Resolve tenant context for per-tenant flag overrides (best-effort; falls back to global)
    let tenantId: string | undefined;
    if (email) {
      try {
        const tr = await pool.query(
          `SELECT tenant_id FROM rie_intervention_context WHERE user_email=$1 LIMIT 1`,
          [email.toLowerCase()]
        );
        tenantId = tr.rows[0]?.tenant_id || undefined;
      } catch { /* non-critical — global flag state applies */ }
    }

    // 98X Phase 4 — fire-and-forget Career Builder activation. No-op unless the
    // `careerBuilderActivation` flag is ON *and* the completion email resolves to a real
    // career_seeker user; never throws, never blocks the completion write path. Flag-OFF →
    // byte-identical legacy behaviour.
    void maybeActivateCareerBuilderOnCompletion(pool, email);

    // 1. Generate rule-based recommendations — only when intervention engine is DISABLED.
    // When `interventions` flag is ON, the new engine (hook #12) replaces this path.
    // When OFF, the legacy getRecs() logic runs unchanged, preserving existing behaviour.
    const interventionsEnabled = isEnabled('interventions', tenantId);
    if (!interventionsEnabled) {
      const recs = getRecs(concernName, scoreLevel, score);
      for (const r of recs) {
        await pool.query(`
          INSERT INTO capadex_recommendations
            (user_id, session_id, concern_name, stage_code, score, score_level, category, title, description, action_items, priority, reasoning)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
          ON CONFLICT DO NOTHING
        `, [userId, sessionId, concernName, stageCode, score, scoreLevel, r.category, r.title, r.description, JSON.stringify(r.actions), r.priority, r.reasoning]);
      }
    }

    // 2. Auto-flag risks
    let riskSeverity: string | null = null;
    let riskType = 'low_score';
    if (score < 20) { riskSeverity = 'critical'; }
    else if (score < 30) { riskSeverity = 'high'; }
    else if (score < 40) { riskSeverity = 'medium'; }

    if (riskSeverity && userId) {
      const existing = await pool.query(
        `SELECT id FROM capadex_risk_flags WHERE user_id=$1 AND session_id=$2 AND resolved=false LIMIT 1`,
        [userId, sessionId]
      );
      if (existing.rows.length === 0) {
        await pool.query(`
          INSERT INTO capadex_risk_flags (user_id, session_id, concern_name, risk_type, severity, description, auto_detected)
          VALUES ($1,$2,$3,$4,$5,$6,true)
        `, [userId, sessionId, concernName, riskType, riskSeverity,
            `Score of ${score}/100 on ${stageCode} stage for concern: "${concernName}". Auto-flagged for review.`]);
      }
    }

    // 3. Multi-concern pattern risk (if user has 3+ concerns all scoring low)
    if (userId && score < 50) {
      const { rows: lowConcerns } = await pool.query(`
        SELECT DISTINCT concern_name FROM capadex_sessions
        WHERE guest_email = (SELECT email FROM capadex_users WHERE id=$1 LIMIT 1)
          AND status='completed' AND score < 50
      `, [userId]);
      if (lowConcerns.length >= 3) {
        const existingPattern = await pool.query(
          `SELECT id FROM capadex_risk_flags WHERE user_id=$1 AND risk_type='multi_concern' AND resolved=false LIMIT 1`,
          [userId]
        );
        if (existingPattern.rows.length === 0) {
          await pool.query(`
            INSERT INTO capadex_risk_flags (user_id, session_id, concern_name, risk_type, severity, description, auto_detected)
            VALUES ($1,$2,$3,'multi_concern','high',$4,true)
          `, [userId, sessionId, concernName,
              `Multiple concern pattern detected: ${lowConcerns.length} concerns scoring below 50. Recommend holistic review.`]);
        }
      }
    }

    // 4. Award XP + update gamification
    if (userId) {
      const xp = (STAGE_XP[stageCode] || 100) + (score >= 80 ? 50 : 0);
      const today = new Date().toISOString().slice(0, 10);

      // Get or create gamification record
      const { rows: [gam] } = await pool.query(`
        INSERT INTO capadex_gamification (user_id, total_xp, level, streak_days, last_active)
        VALUES ($1, 0, 1, 0, $2)
        ON CONFLICT (user_id) DO UPDATE SET last_active=EXCLUDED.last_active
        RETURNING *
      `, [userId, today]);

      const newXp = (gam?.total_xp || 0) + xp;
      const newLevel = Math.floor(newXp / 500) + 1;

      // Compute badges
      const earnedBadges: string[] = Array.isArray(gam?.badges) ? gam.badges : [];
      const { rows: sessions } = await pool.query(`
        SELECT DISTINCT stage_code, concern_name FROM capadex_sessions
        WHERE guest_email = (SELECT email FROM capadex_users WHERE id=$1 LIMIT 1) AND status='completed'
      `, [userId]);

      const stageCodes = sessions.map((s: any) => s.stage_code);
      const uniqueConcerns = new Set(sessions.map((s: any) => s.concern_name)).size;

      if (!earnedBadges.includes('first_step') && sessions.length >= 1) earnedBadges.push('first_step');
      if (!earnedBadges.includes('deep_diver') && stageCodes.includes('CAP_INS')) earnedBadges.push('deep_diver');
      if (!earnedBadges.includes('growth_seeker') && stageCodes.includes('CAP_GRW')) earnedBadges.push('growth_seeker');
      if (!earnedBadges.includes('master_mind') && stageCodes.includes('CAP_MAS') && stageCodes.includes('CAP_CUR')) earnedBadges.push('master_mind');
      if (!earnedBadges.includes('multi_concern') && uniqueConcerns >= 3) earnedBadges.push('multi_concern');
      if (!earnedBadges.includes('high_scorer') && score >= 80) earnedBadges.push('high_scorer');

      await pool.query(`
        UPDATE capadex_gamification
        SET total_xp=$1, level=$2, badges=$3, last_active=$4, updated_at=now()
        WHERE user_id=$5
      `, [newXp, newLevel, JSON.stringify(earnedBadges), today, userId]);
    }

    // 5. Log audit event
    await writeAuditEvent(pool, {
      event_type: AUDIT_EVENT.ASSESSMENT_COMPLETED,
      actor:      'system',
      user_id:    userId,
      session_id: sessionId,
      payload:    { concern: concernName, stage: stageCode, score, level: scoreLevel },
    });

    // 6. Recalculate CSI (non-blocking)
    if (email) {
      import('./csi').then(({ recalculateCSI }) =>
        recalculateCSI(pool, email, sessionId).catch(e =>
          console.error('[csi] recalculate error:', e)
        )
      ).catch(console.error);
    }

    // 7. Run RIE pipeline (non-blocking)
    // Attempt to resolve tenant_id from session; fall back to public sentinel
    if (email) {
      pool.query(
        `SELECT tenant_id FROM rie_intervention_context WHERE user_email=$1 LIMIT 1`,
        [email.toLowerCase()]
      ).then(r => {
        const tenantId = r.rows[0]?.tenant_id || '00000000-0000-0000-0000-000000000000';
        return import('./rie-engine').then(({ runRIEPipeline }) =>
          runRIEPipeline(pool, email, sessionId, tenantId).catch(e =>
            console.error('[rie] pipeline error:', e)
          )
        );
      }).catch(e => console.error('[rie] tenant lookup error:', e));
    }

    // 8. Update LDE longitudinal tracking (gated by longitudinal_memory flag; non-blocking)
    if (email && isEnabled('longitudinal_memory', tenantId)) {
      import('./lde-pipeline').then(({ runLDEPipeline }) =>
        runLDEPipeline(pool, email, sessionId, stageCode, score, scoreLevel, concernName).catch(e =>
          console.error('[lde] pipeline error:', e)
        )
      ).catch(e => console.error('[lde] pipeline import error:', e));
    }

    // 9. Activate knowledge graph nodes from subdomain scores (non-blocking)
    if (email) {
      import('./lde-intelligence').then(({ activateGraphNodes }) => {
        // Pull subdomain scores from the completed session's report
        pool.query(
          `SELECT subdomains FROM capadex_reports WHERE session_id = $1 AND subdomains IS NOT NULL LIMIT 1`,
          [sessionId]
        ).then(({ rows }) => {
          const subdomainScores: Record<string, number> = {};
          if (rows[0]?.subdomains) {
            const subs: any[] = Array.isArray(rows[0].subdomains) ? rows[0].subdomains : [];
            for (const sub of subs) {
              const name  = (sub.subdomain_name || sub.subdomain_code || '').trim();
              const subScore = parseFloat(sub.avg_score ?? '0');
              if (name) subdomainScores[name] = subScore;
            }
          }
          // Fall back to the overall session score under a generic key if no subdomain data yet
          if (Object.keys(subdomainScores).length === 0) {
            subdomainScores[concernName] = score;
          }
          return activateGraphNodes(pool, email, sessionId, concernName, subdomainScores);
        }).catch(e => console.error('[lde-graph] subdomain fetch error:', e));
      }).catch(e => console.error('[lde-graph] import error:', e));
    }

    // WC-7B: when the longitudinalAutomation file flag is ON, WC-7B becomes the SOLE
    // longitudinal builder (item 10b below) so the two paths never race. OFF → this is
    // false and item 10 runs exactly as before (byte-identical).
    const { isLongitudinalAutomationEnabled: wc7bLongitudinalOn } = await import('../config/feature-flags');
    const wc7bOwnsLongitudinal = wc7bLongitudinalOn();

    // 10. Build / refresh longitudinal memory + write summary into cognitive_runtime_state (non-blocking)
    if (email && isEnabled('longitudinal_memory', tenantId) && !wc7bOwnsLongitudinal) {
      import('../services/longitudinal-memory').then(({ buildAndPersistMemory }) =>
        buildAndPersistMemory(pool, email, sessionId)
          .then(memory => {
            // Write a lightweight summary into cognitive_runtime_state.longitudinal_memory
            // conforming to the LongitudinalMemory interface in cognitive-state.ts.
            import('../services/cognitive-state').then(({ updateState }) =>
              updateState(pool, sessionId, {
                longitudinal_memory: {
                  session_count:        memory.session_count,
                  recurring_constructs: memory.recurring_constructs.map(rc => rc.construct_key),
                  behavioural_drift:    memory.behavioural_drift?.direction ?? 'unknown',
                  last_memory_built_at: new Date().toISOString(),
                },
              }, 'longitudinal_memory_refresh')
                .catch(e => console.error('[longitudinal-memory] state update error:', e))
            ).catch(e => console.error('[longitudinal-memory] state import error:', e));
          })
          .catch(e => console.error('[longitudinal-memory] build error:', e))
      ).catch(e => console.error('[longitudinal-memory] import error:', e));
    }

    // 10b. WC-7B Longitudinal Automation (gated by file flag longitudinalAutomation;
    // distinct from the longitudinal_memory DB flag above). When ON, WC-7B is the SOLE
    // longitudinal builder (item 10 is suppressed) — it GUARANTEES a snapshot + adds the
    // additive next_reassessment_at hint, then mirrors item 10's cognitive_runtime_state
    // summary so nothing legacy is lost. Non-blocking, never-throws.
    if (email && wc7bOwnsLongitudinal) {
      import('../services/wc7b/longitudinal-automation').then(({ runLongitudinalAutomation }) =>
        runLongitudinalAutomation(pool, { email, sessionId, score })
          .then(result => {
            const memory = result.memory;
            if (!memory) return;
            import('../services/cognitive-state').then(({ updateState }) =>
              updateState(pool, sessionId, {
                longitudinal_memory: {
                  session_count:        memory.session_count,
                  recurring_constructs: memory.recurring_constructs.map(rc => rc.construct_key),
                  behavioural_drift:    memory.behavioural_drift?.direction ?? 'unknown',
                  last_memory_built_at: new Date().toISOString(),
                },
              }, 'longitudinal_memory_refresh')
                .catch(e => console.error('[wc7b-longitudinal-automation] state update error:', e))
            ).catch(e => console.error('[wc7b-longitudinal-automation] state import error:', e));
          })
          .catch(e => console.error('[wc7b-longitudinal-automation] error:', e))
      ).catch(e => console.error('[wc7b-longitudinal-automation] import error:', e));
    }

    // 11. Generate dynamic report (non-blocking, gated by dynamic_reporting flag)
    // Persona is derived inside generateReport from the session row (session.persona column).
    if (isEnabled('dynamic_reporting', tenantId)) {
      import('../services/dynamic-report').then(({ generateReport, upsertDynamicReport }) =>
        generateReport(pool, sessionId)
          .then(dynamicReport => {
            if (dynamicReport) {
              upsertDynamicReport(pool, sessionId, dynamicReport)
                .catch(e => console.error('[dynamic-report] upsert error:', e));
            }
          })
          .catch(e => console.error('[dynamic-report] generate error:', e))
      ).catch(e => console.error('[dynamic-report] import error:', e));
    }

    // 12. Generate governed interventions (non-blocking, gated by interventions flag)
    // Runs after dynamic report so S9 context is available. Results stored in
    // capadex_recommendations with source='intervention_engine'.
    if (isEnabled('interventions', tenantId)) {
      import('../services/intervention-engine').then(({ generateInterventions, persistInterventions }) =>
        generateInterventions(pool, sessionId)
          .then(async interventions => {
            if (interventions.length > 0) {
              await persistInterventions(pool, sessionId, userId, interventions)
                .catch(e => console.error('[intervention-engine] persist error:', e));

              // Broadcast intervention_ready event — fire-and-forget, flag-gated by `websocket_runtime`.
              // Received by GovernancePanel (RuntimeStateTab drawer) to surface new interventions in real-time.
              // Payload shape must stay in sync with the badge renderer in GovernancePanel.tsx.
              broadcastToSession(sessionId, {
                type: 'intervention_ready',
                data: {
                  count:       interventions.length,
                  session_id:  sessionId,
                  priorities:  (interventions as GeneratedIntervention[]).slice(0, 3).map(iv => iv.hypothesis_label ?? iv.construct_key ?? 'Intervention'),
                },
                explain: `${interventions.length} intervention(s) generated and ready for review`,
              }, tenantId);
            }
          })
          .catch(e => console.error('[intervention-engine] generate error:', e))
      ).catch(e => console.error('[intervention-engine] import error:', e));
    }

    // 13. Seed / refresh LDE growth journey (non-blocking)
    if (email) {
      import('./lde-temporal').then(({ seedLDEFromCapadex }) =>
        seedLDEFromCapadex(pool, email.toLowerCase().trim())
          .catch(e => console.error('[lde] seed error:', e))
      ).catch(e => console.error('[lde] import error:', e));
    }

    // 14. WC-3 Phase A — L1 Stage Intelligence + L6 Longitudinal Foundation.
    // Both are strictly additive, flag-gated (default OFF), compose-only over
    // already-computed data, and never throw (a failure here must never break
    // completion). Flag OFF → this block is skipped entirely → byte-identical
    // legacy behaviour. L1 derives the canonical behavioural stage; L6 appends an
    // immutable snapshot (history capture only — no analytics).
    try {
      const { isWc3StageEnabled, isWc3LongitudinalEnabled, isWc3OutcomeEnabled, isWc3JourneyEnabled } = await import('../config/feature-flags');
      const stageOn = isWc3StageEnabled();
      const longitudinalOn = isWc3LongitudinalEnabled();
      const outcomeOn = isWc3OutcomeEnabled();
      const journeyOn = isWc3JourneyEnabled();
      if (stageOn || longitudinalOn || outcomeOn || journeyOn) {
        const lowerEmail = email ? email.toLowerCase().trim() : null;
        let stageState: any = null;
        if (stageOn) {
          const { resolveSessionStage } = await import('../services/wc3/stage-intelligence');
          stageState = await resolveSessionStage(pool, {
            sessionId, userEmail: lowerEmail, userId,
            concernName, stageCode, score, scoreLevel,
          });
        }
        if (longitudinalOn) {
          const { captureLongitudinalSnapshot } = await import('../services/wc3/longitudinal-foundation');
          const { canonicalStageFor } = await import('../services/wc3/stage-intelligence');
          await captureLongitudinalSnapshot(pool, {
            sessionId, userEmail: lowerEmail, userId, concernName, stageCode,
            canonicalStage: stageState?.canonical_stage ?? canonicalStageFor(stageCode),
            score, scoreLevel,
            csiScore: stageState?.csi_score ?? null,
            csiStage: stageState?.csi_stage ?? null,
          });
        }
        // WC-3 Phase B — L2 Outcome Intelligence. Compose-only over L1 stage (passed
        // through when L1 is also on; otherwise the resolver reads stage itself).
        // Emits nothing when the behavioural spine is empty (honest UNCLASSIFIED).
        let outcomeSummary: any = null;
        if (outcomeOn) {
          const { resolveSessionOutcomes } = await import('../services/wc3/outcome-intelligence');
          outcomeSummary = await resolveSessionOutcomes(pool, {
            sessionId, userEmail: lowerEmail, userId, stageState,
          });
        }
        // WC-3 Phase C — L3 Journey Intelligence. Compose-only over L1 stage + L2
        // outcome (both passed through when on; otherwise the resolver reads them
        // read-only). ALWAYS routes (deterministic Mentoring fallback) so no concern
        // terminates without a route. Strictly additive + never-throws.
        if (journeyOn) {
          const { resolveSessionJourney } = await import('../services/wc3/journey-intelligence');
          await resolveSessionJourney(pool, {
            sessionId, userEmail: lowerEmail, userId, stageState, outcomeSummary,
          });
        }
      }
    } catch (e) {
      console.error('[wc3] phase-a/b post-completion hook error (non-blocking):', e);
    }

    // 15. WC-11 Layer 4 — Decision Persistence. Snapshot the already-composed unified decision
    // (read from the READ-ONLY orchestrator) to durable state. Gated SOLELY by
    // FF_DECISION_PERSISTENCE — independent of the WC-3 hook flags above, so the flag is
    // self-sufficient (it runs even if the WC-3 phases are off; buildActivationEnvelope reads
    // its own inputs read-only). The orchestrator stays byte-identical; this is a separate write
    // step (mirrors resolveSessionOutcomes). Non-blocking + never-throws.
    try {
      const { isDecisionPersistenceEnabled } = await import('../config/feature-flags');
      if (isDecisionPersistenceEnabled()) {
        const { persistDecision } = await import('../services/wc7b/decision-persistence');
        await persistDecision(pool, sessionId);
      }
    } catch (e) {
      console.error('[wc11] decision-persistence post-completion hook error (non-blocking):', e);
    }

    // 16. WC-L0 — User Intelligence Foundation. Persist the already-derived persona/segment/context,
    // the behaviour dimensions projected from the existing Unified Behavior Graph, and a longitudinal
    // snapshot (existing capture fn) into one durable row. Gated SOLELY by
    // FF_USER_INTELLIGENCE_FOUNDATION — self-sufficient, reads its own inputs read-only, introduces no
    // new intelligence engine. Non-blocking + never-throws.
    try {
      const { isUserIntelligenceFoundationEnabled } = await import('../config/feature-flags');
      if (isUserIntelligenceFoundationEnabled()) {
        const { persistUserIntelligence } = await import('../services/wc3/user-intelligence-foundation');
        await persistUserIntelligence(pool, sessionId);
      }
    } catch (e) {
      console.error('[wcl0] user-intelligence-foundation post-completion hook error (non-blocking):', e);
    }

    // 17. WC-L1 — Trend Intelligence. Measure the progression DIRECTION (Improving/Stable/Declining)
    // for the four existing levers (Stage/Outcome/Journey/Decision) across the user's session history,
    // REUSING the existing longitudinal trend math over already-persisted state (snapshots +
    // outcome/journey/decision state). Gated SOLELY by FF_TREND_INTELLIGENCE — self-sufficient, reads
    // its own inputs read-only, introduces no new intelligence engine. Non-blocking + never-throws.
    try {
      const { isTrendIntelligenceEnabled } = await import('../config/feature-flags');
      if (isTrendIntelligenceEnabled()) {
        const { persistTrendsForSession } = await import('../services/wc3/trend-intelligence');
        await persistTrendsForSession(pool, sessionId);
      }
    } catch (e) {
      console.error('[wcl1] trend-intelligence post-completion hook error (non-blocking):', e);
    }

    // 18. WC-L0B — Behaviour Trend Intelligence. Measure the progression DIRECTION
    // (Improving/Stable/Declining) of the EXISTING behaviour dimensions (motivation/confidence/risk/
    // engagement/adaptability — already PROJECTED into wcl0_user_intelligence by item 16) across the
    // user's session history, REUSING the existing longitudinal trend math. Gated SOLELY by
    // FF_BEHAVIOUR_TREND_INTELLIGENCE — self-sufficient, reads its own inputs read-only, introduces no
    // new intelligence engine/dimension. Non-blocking + never-throws.
    try {
      const { isBehaviourTrendIntelligenceEnabled } = await import('../config/feature-flags');
      if (isBehaviourTrendIntelligenceEnabled()) {
        const { persistBehaviourTrendsForSession } = await import('../services/wc3/behaviour-trend-intelligence');
        await persistBehaviourTrendsForSession(pool, sessionId);
      }
    } catch (e) {
      console.error('[wcl0b] behaviour-trend-intelligence post-completion hook error (non-blocking):', e);
    }

    // 19. WC-L4 — Intervention Intelligence. COMPOSE per-session interventions from the already-computed
    // intelligence: the ONLY generator is the L2 Outcome layer's library-backed actions (real
    // intervention_library rows), with Stage/Journey/Decision/User/Trend/Forecast as priority/context
    // annotations only (degraded journey/decision contribute ZERO). Confidence is inherited from the
    // generating outcome model; an empty/UNCLASSIFIED spine ⇒ zero interventions (fail-closed). Gated
    // SOLELY by FF_INTERVENTION_INTELLIGENCE — self-sufficient, reads its own inputs read-only,
    // introduces no new intelligence engine/construct. Non-blocking + never-throws.
    try {
      const { isInterventionIntelligenceEnabled } = await import('../config/feature-flags');
      if (isInterventionIntelligenceEnabled()) {
        const { persistInterventionsForSession } = await import('../services/wc3/intervention-intelligence');
        await persistInterventionsForSession(pool, sessionId);
      }
    } catch (e) {
      console.error('[wcl4] intervention-intelligence post-completion hook error (non-blocking):', e);
    }

    // 20. WC-L5 — Memory Intelligence. SNAPSHOT the already-computed WC-L0→L4 intelligence for the just-
    // completed session into `wcl5_memory` — a pure PERSISTENCE + RETRIEVAL layer. Each memory row is a
    // verbatim snapshot of an EXISTING output (Stage / Outcome / Journey / Decision / User+Trend folded /
    // Forecast / persisted Intervention); an absent / UNCLASSIFIED / empty layer ⇒ NO row for that type
    // (fail-closed, never fabricated). UPSERT-only — no destructive write; per-session snapshots preserve
    // history. Gated SOLELY by FF_MEMORY_INTELLIGENCE — self-sufficient, reads its own inputs read-only,
    // introduces no new construct / ontology / scoring / AI model. Non-blocking + never-throws.
    try {
      const { isMemoryIntelligenceEnabled } = await import('../config/feature-flags');
      if (isMemoryIntelligenceEnabled()) {
        const { persistMemoryForSession } = await import('../services/wc5/memory-intelligence');
        await persistMemoryForSession(pool, sessionId);
      }
    } catch (e) {
      console.error('[wcl5] memory-intelligence post-completion hook error (non-blocking):', e);
    }

    // 21. LBI — Calculate and persist Learning Behaviour Index for this user.
    // Additive, non-blocking, never-throws. Skipped for anonymous sessions (no email).
    // Fires on every CAPADEX completion so lbi_scores stays current and lbi_score_history
    // accumulates longitudinal data. The underlying calculateAndPersistLBI already guards
    // against fabrication (skips write if sessions_analyzed === 0).
    if (email) {
      import('./lbi-engine').then(({ calculateAndPersistLBI }) =>
        calculateAndPersistLBI(email.toLowerCase().trim(), pool).catch(e =>
          console.error('[lbi] post-completion calc error:', e)
        )
      ).catch(e => console.error('[lbi] post-completion import error:', e));
    }

    // 22. Intelligence Pipeline — Composite + Pattern generation.
    // Reads active signals from capadex_session_signals, synthesises composites via
    // CompositeSignalEngine (dynamic ontology-driven definitions), then patterns via
    // PatternEngine (composite-derived + domain-concentration, modulated by
    // contradictions and telemetry). Both layers are fully explainable: every output
    // carries signal_refs, composite_refs, evidence_refs and a prose explanation.
    // Idempotent recompute-and-reconcile semantics — safe to replay. Non-blocking,
    // never-throws. No flag gate: activates fundamental existing infrastructure.
    import('../services/intelligence-pipeline').then(({ runIntelligencePipeline }) =>
      runIntelligencePipeline(pool, sessionId).then((r) => {
        if (r.signals_count > 0 || r.error) {
          console.log(
            `[composite-pattern] ${sessionId}: ` +
              `${r.signals_count}s → ${r.composites_written}c → ${r.patterns_written}p` +
              (r.skipped_reason ? ` (skipped: ${r.skipped_reason})` : '') +
              (r.error          ? ` (error: ${r.error})`            : ''),
          );
        }
      }).catch(e => console.error('[composite-pattern] pipeline run error:', e))
    ).catch(e => console.error('[composite-pattern] pipeline import error:', e));

    // Hook 23: Auto-trigger EI snapshot for registered users after CAPADEX completion.
    // Fire-and-forget, never-throws. Resolves user by email, reads their career profile
    // to build a resolver input, then calls takeSnapshot asynchronously.
    if (email) {
      setImmediate(async () => {
        try {
          const { takeSnapshot }    = await import('../services/ei-snapshots');
          const uid_rows = await pool.query(
            `SELECT id::text AS user_id FROM users
              WHERE lower(COALESCE(NULLIF(TRIM(email),''), username)) = $1 LIMIT 1`,
            [email.toLowerCase()]
          );
          if (!uid_rows.rows.length) return;
          const uid = uid_rows.rows[0].user_id as string;
          const cp_rows = await pool.query(
            `SELECT data FROM career_seeker_profiles WHERE user_id = $1 LIMIT 1`,
            [uid]
          ).catch(() => ({ rows: [] as { data: Record<string, any> }[] }));
          const d = (cp_rows.rows[0]?.data ?? {}) as Record<string, any>;
          const resolverInput = {
            institution:    d.education?.[0]?.institution ?? d.current_institution,
            qualification:  d.education?.[0]?.degree ?? d.qualification,
            skills:         (d.skills?.technical ?? d.technical_skills ?? []) as string[],
            softSkills:     (d.skills?.soft ?? d.soft_skills ?? []) as string[],
            certifications: ((d.certifications ?? []) as any[])
              .map((c: any) => typeof c === 'string' ? c : c?.name)
              .filter(Boolean) as string[],
            experience:     d.experience_years,
            role:           d.current_role ?? d.target_role,
            userId:         uid,
          };
          await takeSnapshot(pool, {
            user_id:        uid,
            resolver_input: resolverInput as any,
            source:         'on_demand',
          });
          console.log(`[capadex-enterprise] EI auto-snapshot → user ${uid}`);
        } catch (e) {
          console.log('[capadex-enterprise] EI auto-snapshot skipped:', (e as Error).message);
        }
      });
    }

  } catch (err) {
    // Non-blocking — log but don't fail the main request
    console.error('[capadex-enterprise] postCompletionHooks error:', err);
  }
}

// ─── Route Registration ────────────────────────────────────────────────────
export function registerCapadexEnterpriseRoutes(app: Express, pool: Pool) {

  // Run migration
  pool.query(`
    CREATE TABLE IF NOT EXISTS capadex_user_profiles (
      user_id uuid PRIMARY KEY REFERENCES capadex_users(id) ON DELETE CASCADE,
      persona text, age integer, age_band text, grade text, institution text,
      city text, state text, primary_concern text, concerns_history text[] DEFAULT '{}',
      notification_prefs jsonb DEFAULT '{"email":true,"whatsapp":false}',
      created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS capadex_recommendations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES capadex_users(id) ON DELETE CASCADE,
      session_id uuid REFERENCES capadex_sessions(id) ON DELETE CASCADE,
      concern_name text NOT NULL, stage_code text NOT NULL,
      score numeric, score_level text, category text NOT NULL,
      title text NOT NULL, description text, action_items jsonb DEFAULT '[]',
      priority integer DEFAULT 2, status text DEFAULT 'active',
      acknowledged_at timestamptz, completed_at timestamptz,
      created_at timestamptz DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS capadex_risk_flags (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES capadex_users(id) ON DELETE CASCADE,
      session_id uuid REFERENCES capadex_sessions(id) ON DELETE CASCADE,
      concern_name text, risk_type text NOT NULL,
      severity text NOT NULL DEFAULT 'medium', description text,
      auto_detected boolean DEFAULT true, resolved boolean DEFAULT false,
      resolved_by text, resolved_at timestamptz, resolution_notes text,
      created_at timestamptz DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS capadex_interventions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES capadex_users(id) ON DELETE CASCADE,
      risk_flag_id uuid REFERENCES capadex_risk_flags(id) ON DELETE SET NULL,
      concern_name text NOT NULL, intervention_type text NOT NULL,
      title text NOT NULL, description text, assigned_to text,
      status text DEFAULT 'pending', priority text DEFAULT 'medium',
      started_at timestamptz, due_at timestamptz, completed_at timestamptz,
      outcome_notes text, outcome_score integer,
      created_by text NOT NULL DEFAULT 'system',
      created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS capadex_gamification (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES capadex_users(id) ON DELETE CASCADE,
      total_xp integer DEFAULT 0, level integer DEFAULT 1,
      streak_days integer DEFAULT 0, last_active date,
      badges jsonb DEFAULT '[]', milestones jsonb DEFAULT '[]',
      updated_at timestamptz DEFAULT now(), UNIQUE (user_id)
    );
    CREATE TABLE IF NOT EXISTS capadex_audit_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      event_type text NOT NULL, user_id uuid, session_id uuid,
      actor text DEFAULT 'system', payload jsonb DEFAULT '{}',
      created_at timestamptz DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS capadex_consent_records (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES capadex_users(id) ON DELETE CASCADE,
      guest_email text, consent_type text NOT NULL, consented boolean DEFAULT true,
      ip_address text, consent_version text DEFAULT '1.0',
      created_at timestamptz DEFAULT now()
    );
    ALTER TABLE capadex_sessions ADD COLUMN IF NOT EXISTS persona text;
    ALTER TABLE capadex_sessions ADD COLUMN IF NOT EXISTS time_taken_s integer;
    CREATE INDEX IF NOT EXISTS idx_capadex_recs_user    ON capadex_recommendations(user_id);
    CREATE INDEX IF NOT EXISTS idx_capadex_risk_user    ON capadex_risk_flags(user_id);
    CREATE INDEX IF NOT EXISTS idx_capadex_risk_resolved ON capadex_risk_flags(resolved);
    CREATE INDEX IF NOT EXISTS idx_capadex_int_user     ON capadex_interventions(user_id);
    CREATE INDEX IF NOT EXISTS idx_capadex_gam_user     ON capadex_gamification(user_id);
    CREATE INDEX IF NOT EXISTS idx_capadex_audit_type   ON capadex_audit_events(event_type);
  `).catch(() => {});

  // ── GET /api/capadex/user/journey ──────────────────────────────────────────
  // Returns full longitudinal journey for a user (all concerns, all stages)
  app.get('/api/capadex/user/journey', async (req: Request, res: Response, next: NextFunction) => {
    const email = ((req.query.email as string) || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'email is required' });
    try {
      const userRow = await pool.query(`SELECT id, name, email, phone, created_at FROM capadex_users WHERE LOWER(email)=$1`, [email]);
      const user = userRow.rows[0] || null;

      const sessions = await pool.query(`
        SELECT s.id, s.concern_name, s.stage_code, s.stage_index, s.status,
               s.score, s.total_items, s.answered_items, s.created_at, s.updated_at,
               s.age_band, s.user_age, s.persona
        FROM capadex_sessions s
        WHERE LOWER(s.guest_email) = $1
        ORDER BY s.created_at DESC
      `, [email]);

      // Group by concern
      const byConcern: Record<string, any> = {};
      for (const s of sessions.rows) {
        if (!byConcern[s.concern_name]) byConcern[s.concern_name] = { concern: s.concern_name, stages: [], latest_score: null, completed_stages: 0 };
        byConcern[s.concern_name].stages.push(s);
        if (s.status === 'completed') {
          byConcern[s.concern_name].completed_stages++;
          if (s.score != null) byConcern[s.concern_name].latest_score = Number(s.score);
        }
      }

      // Recommendations
      const recs = user ? await pool.query(`
        SELECT id, concern_name, stage_code, score_level, category, title, description, action_items, priority, status, created_at
        FROM capadex_recommendations WHERE user_id=$1 ORDER BY priority ASC, created_at DESC LIMIT 20
      `, [user.id]) : { rows: [] };

      // Gamification
      const gam = user ? await pool.query(`SELECT * FROM capadex_gamification WHERE user_id=$1`, [user.id]) : { rows: [] };

      // Risk flags (unresolved)
      const risks = user ? await pool.query(`
        SELECT id, concern_name, risk_type, severity, description, created_at
        FROM capadex_risk_flags WHERE user_id=$1 AND resolved=false ORDER BY severity DESC
      `, [user.id]) : { rows: [] };

      // Stage analytics
      const completed = sessions.rows.filter((s: any) => s.status === 'completed');
      const avgScore = completed.length > 0 ? Math.round(completed.reduce((s: number, r: any) => s + Number(r.score || 0), 0) / completed.length) : null;

      res.json({
        user,
        concerns: Object.values(byConcern),
        total_sessions: sessions.rows.length,
        completed_sessions: completed.length,
        unique_concerns: Object.keys(byConcern).length,
        avg_score: avgScore,
        recommendations: recs.rows,
        gamification: gam.rows[0] || null,
        risk_flags: risks.rows,
      });
    } catch (err) { next(err); }
  });

  // ── GET /api/capadex/user/gamification ─────────────────────────────────────
  app.get('/api/capadex/user/gamification', async (req: Request, res: Response, next: NextFunction) => {
    const email = ((req.query.email as string) || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'email is required' });
    try {
      const userRow = await pool.query(`SELECT id FROM capadex_users WHERE LOWER(email)=$1`, [email]);
      if (!userRow.rows[0]) return res.json({ xp: 0, level: 1, streak: 0, badges: [], badges_meta: [] });
      const userId = userRow.rows[0].id;
      const gam = await pool.query(`SELECT * FROM capadex_gamification WHERE user_id=$1`, [userId]);
      const g = gam.rows[0] || { total_xp: 0, level: 1, streak_days: 0, badges: [] };
      const earnedBadges = Array.isArray(g.badges) ? g.badges : [];
      const badgesMeta = BADGES.filter(b => earnedBadges.includes(b.code));
      res.json({ xp: g.total_xp, level: g.level, streak: g.streak_days, badges: earnedBadges, badges_meta: badgesMeta, next_level_xp: g.level * 500 });
    } catch (err) { next(err); }
  });

  // ── POST /api/capadex/user/consent ─────────────────────────────────────────
  app.post('/api/capadex/user/consent', async (req: Request, res: Response, next: NextFunction) => {
    const { email, consent_type, consented, user_id } = req.body;
    if (!email || !consent_type) return res.status(400).json({ error: 'email and consent_type are required' });
    try {
      await pool.query(`
        INSERT INTO capadex_consent_records (user_id, guest_email, consent_type, consented, ip_address)
        VALUES ($1, $2, $3, $4, $5)
      `, [user_id || null, email.trim().toLowerCase(), consent_type, consented !== false, req.ip || null]);
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ADMIN ROUTES
  // ══════════════════════════════════════════════════════════════════════════

  // ── GET /api/admin/capadex/users ───────────────────────────────────────────
  app.get('/api/admin/capadex/users', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { search, verified, limit = '50', offset = '0', sort = 'newest' } = req.query as Record<string, string>;
      const conds: string[] = [];
      const params: unknown[] = [];
      let p = 1;

      if (search) { conds.push(`(u.name ILIKE $${p} OR u.email ILIKE $${p} OR u.phone ILIKE $${p})`); params.push(`%${search}%`); p++; }
      if (verified === 'yes') { conds.push(`u.email_verified = true`); }
      if (verified === 'no')  { conds.push(`u.email_verified = false`); }

      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const orderBy = sort === 'oldest' ? 'u.created_at ASC' : sort === 'active' ? 'last_session DESC NULLS LAST' : 'u.created_at DESC';

      const countRow = await pool.query(`SELECT COUNT(*) FROM capadex_users u ${where}`, params);
      const rows = await pool.query(`
        SELECT u.id, u.name, u.email, u.phone, u.email_verified, u.created_at,
               COUNT(DISTINCT s.id) AS total_sessions,
               COUNT(DISTINCT CASE WHEN s.status='completed' THEN s.id END) AS completed_sessions,
               COUNT(DISTINCT s.concern_name) AS unique_concerns,
               MAX(s.created_at) AS last_session,
               ROUND(AVG(CASE WHEN s.status='completed' THEN s.score END)::numeric, 1) AS avg_score,
               (SELECT COUNT(*) FROM capadex_risk_flags rf WHERE rf.user_id=u.id AND rf.resolved=false) AS open_risks,
               g.total_xp, g.level, g.badges
        FROM capadex_users u
        LEFT JOIN capadex_sessions s ON LOWER(s.guest_email) = LOWER(u.email)
        LEFT JOIN capadex_gamification g ON g.user_id = u.id
        ${where}
        GROUP BY u.id, g.total_xp, g.level, g.badges
        ORDER BY ${orderBy}
        LIMIT $${p} OFFSET $${p+1}
      `, [...params, parseInt(limit), parseInt(offset)]);

      const stats = await pool.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE email_verified) AS verified,
          COUNT(*) FILTER (WHERE created_at > now() - interval '7 days') AS new_this_week,
          COUNT(*) FILTER (WHERE created_at > now() - interval '30 days') AS new_this_month
        FROM capadex_users
      `);

      res.json({ total: parseInt(countRow.rows[0].count), rows: rows.rows, stats: stats.rows[0] });
    } catch (err) { next(err); }
  });

  // ── GET /api/admin/capadex/users/:id/journey ───────────────────────────────
  app.get('/api/admin/capadex/users/:id/journey', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = await pool.query(`SELECT id, name, email, phone, email_verified, created_at FROM capadex_users WHERE id=$1`, [id]);
      if (!user.rows[0]) return res.status(404).json({ error: 'User not found' });

      const sessions = await pool.query(`
        SELECT id, concern_name, stage_code, stage_index, status, score, total_items, answered_items, created_at, age_band, user_age, persona
        FROM capadex_sessions WHERE LOWER(guest_email)=LOWER($1) ORDER BY created_at DESC
      `, [user.rows[0].email]);

      const reports = await pool.query(`
        SELECT r.id, r.concern_name, r.stage_code, r.score, r.score_level, r.review_status, r.created_at
        FROM capadex_reports r WHERE LOWER((SELECT email FROM capadex_users WHERE id=r.user_id LIMIT 1))=LOWER($1)
        ORDER BY r.created_at DESC
      `, [user.rows[0].email]);

      const recs = await pool.query(`
        SELECT * FROM capadex_recommendations WHERE user_id=$1 ORDER BY priority, created_at DESC
      `, [id]);

      const risks = await pool.query(`
        SELECT * FROM capadex_risk_flags WHERE user_id=$1 ORDER BY resolved, created_at DESC
      `, [id]);

      const interventions = await pool.query(`
        SELECT * FROM capadex_interventions WHERE user_id=$1 ORDER BY created_at DESC
      `, [id]);

      const gam = await pool.query(`SELECT * FROM capadex_gamification WHERE user_id=$1`, [id]);

      res.json({
        user: user.rows[0],
        sessions: sessions.rows,
        reports: reports.rows,
        recommendations: recs.rows,
        risk_flags: risks.rows,
        interventions: interventions.rows,
        gamification: gam.rows[0] || null,
      });
    } catch (err) { next(err); }
  });

  // ── GET /api/admin/capadex/analytics ──────────────────────────────────────
  app.get('/api/admin/capadex/analytics', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      // Stage funnel
      const funnel = await pool.query(`
        SELECT stage_code, COUNT(*) AS started, COUNT(*) FILTER (WHERE status='completed') AS completed
        FROM capadex_sessions GROUP BY stage_code ORDER BY stage_code
      `);

      // Top concerns
      const topConcerns = await pool.query(`
        SELECT concern_name, COUNT(*) AS sessions,
               COUNT(*) FILTER (WHERE status='completed') AS completed,
               ROUND(AVG(CASE WHEN status='completed' THEN score END)::numeric,1) AS avg_score
        FROM capadex_sessions GROUP BY concern_name ORDER BY sessions DESC LIMIT 20
      `);

      // Score distribution
      const scoreDist = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE score < 40) AS emerging,
          COUNT(*) FILTER (WHERE score >= 40 AND score < 60) AS developing,
          COUNT(*) FILTER (WHERE score >= 60 AND score < 80) AS proficient,
          COUNT(*) FILTER (WHERE score >= 80) AS advanced
        FROM capadex_sessions WHERE status='completed' AND score IS NOT NULL
      `);

      // Age band distribution
      const ageDist = await pool.query(`
        SELECT age_band, COUNT(*) AS sessions FROM capadex_sessions
        WHERE age_band IS NOT NULL GROUP BY age_band ORDER BY sessions DESC
      `);

      // Daily sessions (last 30 days)
      const daily = await pool.query(`
        SELECT DATE(created_at) AS date, COUNT(*) AS sessions,
               COUNT(*) FILTER (WHERE status='completed') AS completed
        FROM capadex_sessions
        WHERE created_at > now() - interval '30 days'
        GROUP BY DATE(created_at) ORDER BY date ASC
      `);

      // Persona breakdown
      const personas = await pool.query(`
        SELECT COALESCE(persona,'unknown') AS persona, COUNT(*) AS sessions
        FROM capadex_sessions GROUP BY persona ORDER BY sessions DESC
      `);

      // Overall stats
      const overall = await pool.query(`
        SELECT
          COUNT(*) AS total_sessions,
          COUNT(DISTINCT LOWER(guest_email)) FILTER (WHERE guest_email IS NOT NULL) AS unique_users,
          COUNT(*) FILTER (WHERE status='completed') AS completed,
          ROUND(AVG(CASE WHEN status='completed' THEN score END)::numeric,1) AS avg_score,
          COUNT(DISTINCT concern_name) AS unique_concerns,
          COUNT(*) FILTER (WHERE status='completed' AND score >= 60) AS good_outcomes
        FROM capadex_sessions
      `);

      // Completion rate by stage (conversion funnel rates)
      const completion = await pool.query(`
        SELECT stage_code,
               COUNT(*) AS total,
               COUNT(*) FILTER (WHERE status='completed') AS completed,
               ROUND(100.0 * COUNT(*) FILTER (WHERE status='completed') / NULLIF(COUNT(*),0), 1) AS rate
        FROM capadex_sessions GROUP BY stage_code ORDER BY stage_code
      `);

      res.json({
        overall: overall.rows[0],
        funnel: funnel.rows,
        completion: completion.rows,
        top_concerns: topConcerns.rows,
        score_distribution: scoreDist.rows[0],
        age_distribution: ageDist.rows,
        daily_sessions: daily.rows,
        personas: personas.rows,
      });
    } catch (err) { next(err); }
  });

  // ── GET /api/admin/capadex/risk-flags ─────────────────────────────────────
  app.get('/api/admin/capadex/risk-flags', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { resolved, severity, limit = '100', offset = '0' } = req.query as Record<string, string>;
      const conds: string[] = [];
      const params: unknown[] = [];
      let p = 1;

      if (resolved === 'false' || resolved === 'no') { conds.push(`r.resolved = false`); }
      if (resolved === 'true'  || resolved === 'yes') { conds.push(`r.resolved = true`); }
      if (severity) { conds.push(`r.severity = $${p}`); params.push(severity); p++; }

      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const rows = await pool.query(`
        SELECT r.*, u.name AS user_name, u.email AS user_email
        FROM capadex_risk_flags r
        LEFT JOIN capadex_users u ON u.id = r.user_id
        ${where}
        ORDER BY r.resolved ASC, CASE r.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, r.created_at DESC
        LIMIT $${p} OFFSET $${p+1}
      `, [...params, parseInt(limit), parseInt(offset)]);

      const stats = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE NOT resolved) AS open,
          COUNT(*) FILTER (WHERE NOT resolved AND severity='critical') AS critical,
          COUNT(*) FILTER (WHERE NOT resolved AND severity='high') AS high,
          COUNT(*) FILTER (WHERE NOT resolved AND severity='medium') AS medium,
          COUNT(*) FILTER (WHERE resolved) AS resolved_total
        FROM capadex_risk_flags
      `);

      res.json({ rows: rows.rows, stats: stats.rows[0] });
    } catch (err) { next(err); }
  });

  // ── PATCH /api/admin/capadex/risk-flags/:id ────────────────────────────────
  app.patch('/api/admin/capadex/risk-flags/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { resolved, resolved_by, resolution_notes } = req.body;
      await pool.query(`
        UPDATE capadex_risk_flags
        SET resolved=$1, resolved_by=$2, resolved_at=CASE WHEN $1 THEN now() ELSE NULL END, resolution_notes=$3
        WHERE id=$4
      `, [!!resolved, resolved_by || null, resolution_notes || null, id]);
      if (resolved) {
        writeAuditEvent(pool, {
          event_type: AUDIT_EVENT.RISK_FLAG_RESOLVED,
          actor:      resolved_by || 'admin',
          payload:    { risk_flag_id: id, resolution_notes: resolution_notes || null },
        });
      }
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // ── GET /api/admin/capadex/interventions ──────────────────────────────────
  app.get('/api/admin/capadex/interventions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, limit = '100', offset = '0' } = req.query as Record<string, string>;
      const conds: string[] = [];
      const params: unknown[] = [];
      let p = 1;

      if (status) { conds.push(`i.status = $${p}`); params.push(status); p++; }

      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const rows = await pool.query(`
        SELECT i.*, u.name AS user_name, u.email AS user_email
        FROM capadex_interventions i
        LEFT JOIN capadex_users u ON u.id = i.user_id
        ${where}
        ORDER BY CASE i.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, i.created_at DESC
        LIMIT $${p} OFFSET $${p+1}
      `, [...params, parseInt(limit), parseInt(offset)]);

      const stats = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status='pending') AS pending,
          COUNT(*) FILTER (WHERE status='active') AS active,
          COUNT(*) FILTER (WHERE status='completed') AS completed,
          COUNT(*) FILTER (WHERE status='cancelled') AS cancelled,
          COUNT(*) AS total
        FROM capadex_interventions
      `);

      res.json({ rows: rows.rows, stats: stats.rows[0] });
    } catch (err) { next(err); }
  });

  // ── POST /api/admin/capadex/interventions ─────────────────────────────────
  app.post('/api/admin/capadex/interventions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user_id, risk_flag_id, concern_name, intervention_type, title, description, assigned_to, priority, due_at, created_by } = req.body;
      if (!user_id || !concern_name || !title || !intervention_type) {
        return res.status(400).json({ error: 'user_id, concern_name, title, intervention_type are required' });
      }
      const { rows: [row] } = await pool.query(`
        INSERT INTO capadex_interventions (user_id, risk_flag_id, concern_name, intervention_type, title, description, assigned_to, priority, due_at, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
      `, [user_id, risk_flag_id || null, concern_name, intervention_type, title, description || null, assigned_to || null, priority || 'medium', due_at || null, created_by || 'admin']);

      writeAuditEvent(pool, {
        event_type: AUDIT_EVENT.INTERVENTION_CREATED,
        actor:      created_by || 'admin',
        user_id:    user_id,
        payload:    { intervention_id: row.id, title, concern_name, intervention_type },
      });

      res.status(201).json(row);
    } catch (err) { next(err); }
  });

  // ── PATCH /api/admin/capadex/interventions/:id ────────────────────────────
  app.patch('/api/admin/capadex/interventions/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status, assigned_to, outcome_notes, outcome_score, priority, due_at } = req.body;
      const fields: string[] = ['updated_at=now()'];
      const vals: unknown[] = [];
      let p = 1;

      if (status !== undefined) {
        fields.push(`status=$${p++}`); vals.push(status);
        if (status === 'active' && !fields.includes('started_at=now()')) fields.push('started_at=COALESCE(started_at, now())');
        if (status === 'completed') fields.push('completed_at=COALESCE(completed_at, now())');
      }
      if (assigned_to   !== undefined) { fields.push(`assigned_to=$${p++}`);   vals.push(assigned_to || null); }
      if (outcome_notes !== undefined) { fields.push(`outcome_notes=$${p++}`); vals.push(outcome_notes || null); }
      if (outcome_score !== undefined) { fields.push(`outcome_score=$${p++}`); vals.push(outcome_score != null ? Number(outcome_score) : null); }
      if (priority      !== undefined) { fields.push(`priority=$${p++}`);      vals.push(priority); }
      if (due_at        !== undefined) { fields.push(`due_at=$${p++}`);        vals.push(due_at || null); }

      vals.push(id);
      await pool.query(`UPDATE capadex_interventions SET ${fields.join(', ')} WHERE id=$${p}`, vals);
      const updated = await pool.query(`SELECT * FROM capadex_interventions WHERE id=$1`, [id]);
      writeAuditEvent(pool, {
        event_type: AUDIT_EVENT.INTERVENTION_UPDATED,
        actor:      req.body.updated_by || 'admin',
        payload:    { intervention_id: id, fields: Object.keys(req.body) },
      });
      res.json({ ok: true, intervention: updated.rows[0] });
    } catch (err) { next(err); }
  });

  // ── GET /api/admin/capadex/reports ────────────────────────────────────────
  app.get('/api/admin/capadex/reports', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { search = '', concern = '', stage = '', level = '', reviewed, limit = '500', offset = '0' } = req.query as Record<string, string>;
      const conds: string[] = [];
      const vals: unknown[] = [];
      let p = 1;
      if (search)  { conds.push(`(r.participant_name ILIKE $${p} OR u.email ILIKE $${p} OR r.concern_name ILIKE $${p})`); vals.push(`%${search}%`); p++; }
      if (concern) { conds.push(`r.concern_name ILIKE $${p}`); vals.push(`%${concern}%`); p++; }
      if (stage && stage !== 'all') { conds.push(`r.stage_code = $${p}`); vals.push(stage); p++; }
      if (level)   { conds.push(`r.score_level = $${p}`); vals.push(level); p++; }
      if (reviewed === 'yes') { conds.push(`r.review_status IN ('in_review','approved','published')`); }
      if (reviewed === 'no')  { conds.push(`r.review_status = 'pending'`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const rows = await pool.query(`
        SELECT r.*,
               u.name  AS user_name,
               u.email AS email,
               u.phone AS phone,
               (SELECT COUNT(*) FROM capadex_sessions s WHERE s.user_id = r.user_id) AS total_sessions
        FROM capadex_reports r
        LEFT JOIN capadex_users u ON u.id = r.user_id
        ${where}
        ORDER BY r.created_at DESC
        LIMIT $${p} OFFSET $${p+1}
      `, [...vals, parseInt(limit), parseInt(offset)]);

      const stats = await pool.query(`
        SELECT
          COUNT(*)                                              AS total,
          COUNT(*) FILTER (WHERE r.score_level = 'Mastery')    AS mastery,
          COUNT(*) FILTER (WHERE r.score_level = 'Proficient') AS proficient,
          COUNT(*) FILTER (WHERE r.score_level = 'Developing') AS developing,
          COUNT(*) FILTER (WHERE r.score_level = 'Emerging')   AS emerging,
          COUNT(*) FILTER (WHERE r.review_status = 'pending')  AS status_pending,
          COUNT(*) FILTER (WHERE r.review_status = 'in_review')AS status_in_review,
          COUNT(*) FILTER (WHERE r.review_status = 'approved') AS status_approved,
          COUNT(*) FILTER (WHERE r.review_status = 'published')AS status_published,
          COUNT(*) FILTER (WHERE r.score_override IS NOT NULL) AS overridden,
          COUNT(*) FILTER (WHERE r.email_sent = true)          AS emailed,
          ROUND(AVG(COALESCE(r.score_override, r.score)::numeric), 1) AS avg_score
        FROM capadex_reports r
      `);

      res.json({ rows: rows.rows, total: parseInt(stats.rows[0]?.total || '0'), stats: stats.rows[0] });
    } catch (err) { next(err); }
  });

  // ── GET /api/admin/capadex/reports/:id ────────────────────────────────────
  app.get('/api/admin/capadex/reports/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const r = await pool.query(`
        SELECT r.*, u.name AS user_name, u.email AS email, u.phone AS phone,
               s.score_trace AS session_score_trace
        FROM capadex_reports r
        LEFT JOIN capadex_users u ON u.id = r.user_id
        LEFT JOIN capadex_sessions s ON s.id = r.session_id
        WHERE r.id = $1
      `, [id]);
      if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });

  // ── PATCH /api/admin/capadex/reports/:id ──────────────────────────────────
  app.patch('/api/admin/capadex/reports/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { score_override, headline_override, narrative_override, override_reason, admin_notes, review_status, reviewed_by } = req.body;
      const fields: string[] = ['updated_at=now()'];
      const vals: unknown[] = [];
      let p = 1;
      if (score_override    !== undefined) { fields.push(`score_override=$${p++}`);    vals.push(score_override !== '' ? score_override : null); }
      if (headline_override !== undefined) { fields.push(`headline_override=$${p++}`); vals.push(headline_override || null); }
      if (narrative_override!== undefined) { fields.push(`narrative_override=$${p++}`);vals.push(narrative_override || null); }
      if (override_reason   !== undefined) { fields.push(`override_reason=$${p++}`);   vals.push(override_reason || null); }
      if (admin_notes       !== undefined) { fields.push(`admin_notes=$${p++}`);       vals.push(admin_notes || null); }
      if (review_status     !== undefined) {
        fields.push(`review_status=$${p++}`); vals.push(review_status);
        if (review_status === 'published') { fields.push(`published_at=now()`); }
        if (reviewed_by) { fields.push(`reviewed_by=$${p++}`); vals.push(reviewed_by); fields.push(`reviewed_at=now()`); }
      }
      vals.push(id);
      const updated = await pool.query(`UPDATE capadex_reports SET ${fields.join(', ')} WHERE id=$${p} RETURNING *`, vals);
      const rep = updated.rows[0];
      if (score_override !== undefined) {
        writeAuditEvent(pool, {
          event_type: AUDIT_EVENT.REPORT_SCORE_OVERRIDE,
          actor:      reviewed_by || 'admin',
          payload:    { report_id: id, score_override, override_reason: override_reason || null },
        });
      }
      if (review_status !== undefined) {
        writeAuditEvent(pool, {
          event_type: AUDIT_EVENT.REPORT_STATUS_CHANGE,
          actor:      reviewed_by || 'admin',
          payload:    { report_id: id, review_status, reviewed_by: reviewed_by || null },
        });
      }
      res.json({ ok: true, report: rep });
    } catch (err) { next(err); }
  });

  // ── POST /api/admin/capadex/reports/:id/send-email ────────────────────────
  app.post('/api/admin/capadex/reports/:id/send-email', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const r = await pool.query(`
        SELECT r.id, r.concern_name, r.stage_code, r.score, r.score_override, r.score_level,
               r.insight, r.subdomains, r.review_status, r.session_id, r.email_sent,
               r.dynamic_report, r.report_data,
               u.email AS user_email, u.name AS user_name, u.phone AS user_phone
        FROM capadex_reports r
        LEFT JOIN capadex_users u ON u.id = r.user_id
        WHERE r.id = $1
      `, [id]);
      if (!r.rows[0]) return res.status(404).json({ error: 'Report not found' });
      const report = r.rows[0];

      const recipientEmail = report.user_email;
      if (!recipientEmail) return res.status(400).json({ error: 'No email address on file for this participant' });

      const STAGE_META: Record<string, { label: string; domains: string[]; subtitle: string }> = {
        CAP_CUR: { label: 'Curiosity', domains: ['learning', 'engagement', 'behavioural', 'emotional'],        subtitle: 'Foundation steps to start shifting the pattern' },
        CAP_INS: { label: 'Insight',   domains: ['emotional', 'behavioural', 'resilience', 'learning', 'engagement'], subtitle: 'Root-cause strategies tailored to your trigger profile' },
        CAP_GRW: { label: 'Growth',    domains: ['resilience', 'recovery', 'engagement', 'leadership', 'behavioural'], subtitle: 'Actionable development moves to accelerate your trajectory' },
        CAP_MAS: { label: 'Mastery',   domains: ['leadership', 'employability', 'resilience', 'recovery'],    subtitle: 'Advanced optimisation for sustained high performance' },
      };
      const stageMeta = STAGE_META[report.stage_code] || STAGE_META['CAP_CUR'];

      const ALL_SAFE = ['learning', 'behavioural', 'engagement', 'emotional', 'resilience', 'employability', 'leadership', 'recovery'];
      let recommendations: Array<{ title: string; expected_outcome?: string; rec_type?: string; domain?: string }> = [];
      try {
        const { rows: recs } = await pool.query(
          `SELECT title, expected_outcome, rec_type, domain
           FROM rie_recommendations
           WHERE user_email = $1 AND domain = ANY($2::text[])
           ORDER BY (domain = ANY($3::text[]))::int DESC, priority ASC, created_at DESC
           LIMIT 3`,
          [recipientEmail, ALL_SAFE, stageMeta.domains]
        );
        recommendations = recs;
      } catch (_err: unknown) {}

      const appBase = process.env.APP_URL ||
        (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'https://metryx.one');
      const reportUrl = report.session_id
        ? `${appBase}/?session=${encodeURIComponent(report.session_id)}&tab=report`
        : undefined;

      const score = report.score_override != null && report.review_status === 'published'
        ? Math.round(Number(report.score_override))
        : Math.round(Number(report.score));
      const scoreLevel = (report.score_level === 'Mastery' ? 'Advanced' : report.score_level) || 'Developing';
      const subdomains = Array.isArray(report.subdomains)
        ? report.subdomains
        : (report.subdomains ? JSON.parse(report.subdomains) : []);

      const { omega, telemetry } = report.session_id
        ? await buildOmegaEmailExtras(pool, report.session_id)
        : { omega: undefined, telemetry: undefined };

      // Dynamic narrative — gated by the dynamic_reporting flag (tenant_id is not
      // yet on capadex_sessions, so global resolution is used).
      const dynamicReportData = (isEnabled('dynamic_reporting', undefined) && report.dynamic_report)
        ? report.dynamic_report
        : undefined;

      // Provenance signals (mirrors SuperAdmin reports console).
      const provMeta = (report.report_data || report.dynamic_report || {}) as Record<string, unknown>;
      const claritySource = (provMeta.clarity_source as string) || 'master_curated';
      const contradictionCount = Number(provMeta.contradiction_count) || 0;
      const pacingMs = Number(provMeta.telemetry_pacing_ms) || 1420;

      const sent = await sendCapadexReport(recipientEmail, report.user_name || 'Participant', {
        concernName: report.concern_name,
        stageLabel: stageMeta.label,
        stageCode: report.stage_code,
        actionPlanSubtitle: stageMeta.subtitle,
        score,
        scoreLevel,
        insight: report.insight || '',
        subdomains,
        reportId: report.id,
        reportUrl,
        recommendations,
        dynamic_report: dynamicReportData,
        omega,
        telemetry,
        claritySource,
        contradictionCount,
        pacingMs,
      });

      if (sent) {
        await pool.query(`UPDATE capadex_reports SET email_sent=true, updated_at=now() WHERE id=$1`, [id]);
        return res.json({ ok: true, email: recipientEmail });
      }

      return res.status(502).json({ ok: false, error: 'Email provider failed to deliver the message. Please try again.' });
    } catch (err) { next(err); }
  });

  // ── POST /api/admin/capadex/email-preview ─────────────────────────────────
  app.post('/api/admin/capadex/email-preview', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reportId, stageCode } = req.body as { reportId: string; stageCode?: string };
      if (!reportId) return res.status(400).json({ error: 'reportId required' });

      const r = await pool.query(`
        SELECT r.*, u.name AS user_name, u.email AS user_email
        FROM capadex_reports r LEFT JOIN capadex_users u ON u.id = r.user_id
        WHERE r.id = $1
      `, [reportId]);
      if (!r.rows[0]) return res.status(404).json({ error: 'Report not found' });

      const row = r.rows[0];
      const effectiveStage = stageCode || row.stage_code || 'CAP_CUR';
      const stageLabelMap: Record<string, string> = STAGE_CODE_TO_LABEL;

      const validStages = LIFECYCLE_STAGE_CODES as readonly string[];
      if (stageCode && !validStages.includes(stageCode)) {
        return res.status(400).json({ error: 'Invalid stageCode' });
      }

      const subdomains: Array<{ subdomain_name: string; avg_score: number; item_count: number }> =
        row.subdomains
          ? (typeof row.subdomains === 'string' ? JSON.parse(row.subdomains) : row.subdomains)
          : [];

      const score = row.score_override != null && row.review_status === 'published'
        ? Number(row.score_override)
        : Number(row.score);

      const scoreLevel = row.score_level || 'Developing';

      const recsResult = await pool.query(
        `SELECT title, expected_outcome, rec_type, domain FROM capadex_recommendations WHERE user_id = $1 ORDER BY priority ASC, created_at DESC LIMIT 5`,
        [row.user_id]
      );
      const recommendations = recsResult.rows;

      const appUrl = process.env.APP_URL ||
        (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : '');
      const reportUrl = row.session_id
        ? `${appUrl || 'https://metryx.one'}/?report=${row.session_id}`
        : undefined;

      const { omega, telemetry } = row.session_id
        ? await buildOmegaEmailExtras(pool, row.session_id)
        : { omega: undefined, telemetry: undefined };

      // Dynamic narrative — gated by the dynamic_reporting flag so the preview
      // reflects exactly what would be sent.
      const dynamicReportData = (isEnabled('dynamic_reporting', undefined) && row.dynamic_report)
        ? row.dynamic_report
        : undefined;

      // Provenance signals (mirrors SuperAdmin reports console).
      const provMeta = (row.report_data || row.dynamic_report || {}) as Record<string, unknown>;
      const claritySource = (provMeta.clarity_source as string) || 'master_curated';
      const contradictionCount = Number(provMeta.contradiction_count) || 0;
      const pacingMs = Number(provMeta.telemetry_pacing_ms) || 1420;

      const { html, subject } = buildCapadexReportHtml(
        row.user_name || row.participant_name || 'Participant',
        {
          concernName: row.concern_name,
          stageLabel: stageLabelMap[effectiveStage] || effectiveStage,
          stageCode: effectiveStage,
          score,
          scoreLevel,
          insight: row.insight || '',
          subdomains,
          reportId: row.id,
          reportUrl,
          recommendations,
          dynamic_report: dynamicReportData,
          omega,
          telemetry,
          claritySource,
          contradictionCount,
          pacingMs,
        }
      );

      res.json({ html, subject, stage: effectiveStage });
    } catch (err) { next(err); }
  });

  // ── GET /api/admin/capadex/audit-events ───────────────────────────────────
  app.get('/api/admin/capadex/audit-events', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { event_type, limit = '100', offset = '0' } = req.query as Record<string, string>;
      const conds = event_type ? ['event_type = $1'] : [];
      const params = event_type ? [event_type, parseInt(limit), parseInt(offset)] : [parseInt(limit), parseInt(offset)];
      const p = event_type ? 2 : 1;
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

      const rows = await pool.query(`
        SELECT e.*, u.name AS user_name, u.email AS user_email
        FROM capadex_audit_events e
        LEFT JOIN capadex_users u ON u.id = e.user_id
        ${where}
        ORDER BY e.created_at DESC
        LIMIT $${p} OFFSET $${p+1}
      `, params);

      res.json(rows.rows);
    } catch (err) { next(err); }
  });
}
