/**
 * CAPADEX 3.0 — Program 3 · Phase 3.4 Enterprise Assessment Delivery Engine CERTIFICATION
 * Read-only repo + DB scan. SSoT for every number cited in the deliverables.
 *
 * Measures (NO writes, NO DDL):
 *   - canonical delivery model size (7 dimensions, 11 candidate-experience steps, 6 delivery modes,
 *     7 question-delivery modes, 6 launch modes, 9 session caps, 6 timing caps, 6 response caps,
 *     7 accessibility caps, 6 security controls, 6 notification types, 10 mapping steps),
 *   - SEVEN INDEPENDENT certification dimensions, each verified vs the live filesystem + DB:
 *       delivery_engine · candidate_experience · session_management · accessibility · security · apis · frontend,
 *   - a SEPARATE adoption axis (real delivered-session volume) + classified gaps
 *     (OPEN Future/Low deferrals + RESOLVED via reuse) + verdict + Phase-3.5 readiness.
 *
 * The SEVEN dimensions are measured SEPARATELY and NEVER composited. null (unknown) ≠ 0 (absent).
 * Scope is CANDIDATE EXPERIENCE ONLY (launch→submission) — NOT scoring/psychometrics/norms/AI/reports.
 *
 * Emits `backend/audit/capadex-3.4-assessment-delivery/scan.json`.
 * Run from backend/:  npx tsx scripts/capadex-3.4-assessment-delivery-scan.ts
 */
import { Pool } from 'pg';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import {
  AD_AXES, AD_DIMENSIONS, CANDIDATE_EXPERIENCE_STEPS, DELIVERY_MODES, QUESTION_DELIVERY_MODES,
  LAUNCH_MODES, SESSION_CAPABILITIES, TIMING_CAPS, RESPONSE_CAPS, ACCESSIBILITY_CAPS,
  SECURITY_CONTROLS, NOTIFICATION_TYPES, MAPPING_MODEL, AD_DECISIONS,
} from '../config/assessment-delivery';
import {
  composeDimensions, composeCandidateExperience, composeDeliveryModes, composeQuestionDelivery,
  composeLaunchModes, composeSessionCaps, composeTimingCaps, composeResponseCaps,
  composeAccessibilityCaps, composeSecurityControls, composeNotificationTypes,
  composeMapping, composeRepositoryAlignment, composeAdoption, classifiedGaps, composeSummary,
} from '../services/assessment-delivery-engine';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const dimensions = await composeDimensions(pool);
    const candidate_experience = composeCandidateExperience();
    const delivery_modes = composeDeliveryModes();
    const question_delivery = composeQuestionDelivery();
    const launch = await composeLaunchModes(pool);
    const session = await composeSessionCaps(pool);
    const timing = await composeTimingCaps(pool);
    const response = await composeResponseCaps(pool);
    const accessibility = await composeAccessibilityCaps(pool);
    const security = await composeSecurityControls(pool);
    const notification = await composeNotificationTypes(pool);
    const mapping = await composeMapping(pool);
    const repository_alignment = await composeRepositoryAlignment(pool);
    const adoption = await composeAdoption(pool);
    const summary = await composeSummary(pool);
    const { gaps, gap_counts, resolved_gaps, resolved_gap_counts, resolved_gap_count } = classifiedGaps();

    const out = {
      generated_at: new Date().toISOString(),
      read_only: true,
      platform_frozen: true,
      scope: 'CANDIDATE EXPERIENCE ONLY — launch/session/candidate-experience/question-delivery/timing/response/' +
        'accessibility/delivery-modes/security/notifications/frontend/APIs from launch until final submission; ' +
        'NOT scoring/psychometrics/norms/AI-interpretation/reports/analytics (= Phase 3.5+)',
      axes: AD_AXES,
      dimension_count: AD_DIMENSIONS.length,
      // Full registry embedded so the generator reads ONLY scan.json (docs can never drift).
      registry: {
        dimensions: AD_DIMENSIONS,
        candidate_experience_steps: CANDIDATE_EXPERIENCE_STEPS,
        delivery_modes: DELIVERY_MODES,
        question_delivery_modes: QUESTION_DELIVERY_MODES,
        launch_modes: LAUNCH_MODES,
        session_capabilities: SESSION_CAPABILITIES,
        timing_caps: TIMING_CAPS,
        response_caps: RESPONSE_CAPS,
        accessibility_caps: ACCESSIBILITY_CAPS,
        security_controls: SECURITY_CONTROLS,
        notification_types: NOTIFICATION_TYPES,
        mapping_model: MAPPING_MODEL,
        decisions: AD_DECISIONS,
      },
      // The SEVEN INDEPENDENT certification dimensions (never composited).
      axis_dimensions: dimensions,
      axis_candidate_experience: candidate_experience,
      axis_delivery_modes: delivery_modes,
      axis_question_delivery: question_delivery,
      axis_launch: launch,
      axis_session: session,
      axis_timing: timing,
      axis_response: response,
      axis_accessibility: accessibility,
      axis_security: security,
      axis_notification: notification,
      axis_mapping: mapping,
      axis_repository_alignment: repository_alignment,
      // Adoption — a SEPARATE usage axis (never a gap).
      adoption,
      // Classified gaps: OPEN Future/Low deferrals + RESOLVED via reuse.
      gaps, gap_counts, gap_total: gaps.length,
      resolved_gaps, resolved_gap_counts, resolved_gap_count,
      summary,
    };

    const dir = path.join(process.cwd(), 'audit', 'capadex-3.4-assessment-delivery');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'scan.json'), JSON.stringify(out, null, 2));

    const sc = (o: any) => `${o.SUPPORTED} SUP · ${o.PARTIAL} PART · ${o.DEAD_END} DEAD · ${o.MISSING} MISS`;
    console.log('── CAPADEX 3.4 Enterprise Assessment Delivery Engine certification scan ──');
    console.log(`dimensions: ${out.dimension_count}`);
    console.log('DIM dimensions:', sc(dimensions.status_counts));
    console.log('DIM candidate-experience:', sc(candidate_experience.status_counts), `steps=${candidate_experience.count}`);
    console.log('DIM delivery-modes:', sc(delivery_modes.status_counts), `modes=${delivery_modes.count}`);
    console.log('DIM question-delivery:', sc(question_delivery.status_counts), `modes=${question_delivery.count}`);
    console.log('DIM launch:', sc(launch.status_counts), `modes=${launch.count}`);
    console.log('DIM session:', sc(session.status_counts), `caps=${session.count}`);
    console.log('DIM timing:', sc(timing.status_counts), `caps=${timing.count}`);
    console.log('DIM response:', sc(response.status_counts), `caps=${response.count}`);
    console.log('DIM accessibility:', sc(accessibility.status_counts), `caps=${accessibility.count}`);
    console.log('DIM security:', sc(security.status_counts), `controls=${security.count}`);
    console.log('DIM notification:', sc(notification.status_counts), `types=${notification.count}`);
    console.log('repository-alignment:', JSON.stringify({
      services: repository_alignment.services, routes: repository_alignment.routes,
      frontend: repository_alignment.frontend, tables: repository_alignment.tables,
    }));
    console.log('gap counts:', JSON.stringify(gap_counts), `total=${out.gap_total} resolved=${resolved_gap_count}`);
    console.log('verdict:', summary.enterprise_ready.verdict, '| ready_for_3.5:', summary.ready_for_phase_3_5.verdict);
    for (const d of dimensions.dimensions) {
      const e = d.evidence;
      console.log(
        `  ${d.key.padEnd(20)} ${d.status.padEnd(10)} ` +
        `svc ${e.services.present}/${e.services.total} rt ${e.routes.present}/${e.routes.total} ` +
        `fe ${e.frontend.present}/${e.frontend.total} tbl ${e.tables.present}/${e.tables.total}` +
        (e.tables.unknown ? ` (unknown ${e.tables.unknown})` : ''),
      );
    }
    console.log('wrote', path.join(dir, 'scan.json'));
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
