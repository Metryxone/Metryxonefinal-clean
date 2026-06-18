import { pool } from './client.js';

export const REQUIRED_TABLES: string[] = [
  'schema_migrations',
  'users',
  'otp_tokens',
  'user_devices',
  'children',
  'parent_subscriptions',
  'parent_briefings',
  'student_subscriptions',
  'career_compass_results',
  'study_plans',
  'wellness_checkins',
  'lbi_modules',
  'lbi_sessions',
  'lbi_domains',
  'lbi_age_bands',
  'lbi_questions',
  'assessment_domains',
  'assessment_subdomains',
  'exam_ready_attempts',
  'exam_ready_reports',
  'psychometric_questions',
  'custom_assessment_modules',
  'custom_module_sessions',
  'assessment_assignments',
  'scoring_config_versions',
  'scoring_modules',
  'scoring_domain_config',
  'scoring_age_band_norms',
  'scoring_formula_params',
  'competency_domains',
  'competencies',
  'career_profiles',
  'competency_scores',
  'role_weights',
  'competency_benchmarks',
  'competency_interventions',
  'job_requirements',
  'chat_preferences',
  'pause_events',
  'notifications',
  'notification_preferences',
  'notification_queue',
  'notification_templates',
  'notification_broadcasts',
  'notification_scenarios',
  'notification_scheduled_jobs',
  'email_consents',
  'scholarship_alerts',
  'platform_settings',
  'subscription_packages',
  'package_domain_mapping',
  'mentor_profiles',
  'mentor_bookings',
  'mentor_reviews',
  'mentor_kpis',
  'mentor_tasks',
  'mentor_payouts',
  'mentor_violations',
  'mentor_kyc_documents',
  'mentor_onboarding_notifications',
  'hr_jobs',
  'hr_applications',
  'onboarding_requests',
  'onboarding_history',
  'kyc_documents',
  'document_upload_tokens',
  'parent_kyc',
  'enrollment_kyc',
  'institutions',
  'student_enrollments',
  'institution_activity_logs',
  'admin_audit_logs',
];

/**
 * Checks that every table in REQUIRED_TABLES exists in the public schema.
 *
 * If any required table is missing the function logs a fatal error and exits
 * the process with code 1. This is intentional: the server must never start
 * in a degraded state where critical tables are absent, because doing so would
 * silently serve broken traffic and make regressions hard to detect in CI and
 * production deploys. Fail fast here so the problem is immediately visible.
 *
 * Returns the list of present table names (i.e. all of REQUIRED_TABLES) on
 * success; the process never returns from this function when tables are missing.
 */
export async function runDbSmokeCheck(): Promise<string[]> {
  const result = await pool.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type = 'BASE TABLE'`,
  );

  const existing = new Set(result.rows.map((r) => r.table_name));
  const missing = REQUIRED_TABLES.filter((t) => !existing.has(t));

  if (missing.length > 0) {
    const message =
      `[DB Smoke Check] FATAL: ${missing.length} of ${REQUIRED_TABLES.length} required table(s) ` +
      `missing after migrations:\n` +
      missing.map((t) => `  - ${t}`).join('\n');

    console.error(message);
    process.exit(1);
  }

  console.log(`[DB Smoke Check] All ${REQUIRED_TABLES.length} required tables present.`);
  return REQUIRED_TABLES;
}
