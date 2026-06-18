import { pool } from './client.js';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

/**
 * APPEND-ONLY migration list.
 *
 * Each entry is identified by a SHA-256 hash of its SQL content and recorded
 * in the `schema_migrations` table after it runs. Editing an existing entry
 * changes its hash and causes it to be treated as a new, unapplied statement.
 *
 * Rules:
 *  - Always ADD new statements at the bottom of this array.
 *  - NEVER edit or remove a statement that has already been applied in any
 *    environment — doing so will cause it to run again.
 *  - If you need to undo or alter a previous statement, append a new corrective
 *    statement (e.g. ALTER TABLE … DROP COLUMN, or another UPDATE).
 */
const migrations = [
  // 000 — users
  `CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    mobile          VARCHAR(15) UNIQUE,
    email           VARCHAR(255) UNIQUE,
    username        VARCHAR(100) UNIQUE,
    password_hash   TEXT,
    full_name       VARCHAR(255),
    role            VARCHAR(50) NOT NULL DEFAULT 'parent',
    roles           JSONB NOT NULL DEFAULT '["parent"]',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    profile_picture TEXT,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(mobile) WHERE mobile IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_users_email  ON users(email)  WHERE email  IS NOT NULL`,

  // 000b — otp_tokens
  `CREATE TABLE IF NOT EXISTS otp_tokens (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    mobile      VARCHAR(15),
    otp_hash    TEXT NOT NULL,
    purpose     VARCHAR(32) NOT NULL DEFAULT 'login',
    expires_at  TIMESTAMPTZ NOT NULL,
    attempts    INTEGER NOT NULL DEFAULT 0,
    is_used     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_otp_mobile ON otp_tokens(mobile, is_used, expires_at)`,

  `ALTER TABLE otp_tokens ADD COLUMN IF NOT EXISTS identifier VARCHAR(255)`,
  `ALTER TABLE otp_tokens ALTER COLUMN mobile DROP NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_otp_identifier ON otp_tokens(identifier, is_used, expires_at)`,

  // 001 — children
  `CREATE TABLE IF NOT EXISTS children (
    id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    parent_id           TEXT REFERENCES users(id) ON DELETE SET NULL,
    name                VARCHAR(255) NOT NULL,
    age                 INTEGER,
    grade               VARCHAR(50),
    school              VARCHAR(255),
    gender              VARCHAR(20),
    date_of_birth       DATE,
    blood_group         VARCHAR(10),
    language            VARCHAR(50),
    board               VARCHAR(50),
    city                VARCHAR(100),
    state               VARCHAR(100),
    special_needs       TEXT,
    study_hours_per_day NUMERIC(3,1),
    favorite_subjects   TEXT[] DEFAULT '{}',
    consent_given       BOOLEAN NOT NULL DEFAULT FALSE,
    consent_given_at    TIMESTAMPTZ,
    avatar_url          TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_children_parent_id ON children(parent_id)`,

  // 001b — children extended fields
  `ALTER TABLE children ADD COLUMN IF NOT EXISTS weak_subjects       TEXT[]       DEFAULT '{}'`,
  `ALTER TABLE children ADD COLUMN IF NOT EXISTS learning_style      VARCHAR(50)`,
  `ALTER TABLE children ADD COLUMN IF NOT EXISTS career_interest     VARCHAR(255)`,
  `ALTER TABLE children ADD COLUMN IF NOT EXISTS relationship        VARCHAR(50)`,
  `ALTER TABLE children ADD COLUMN IF NOT EXISTS school_type         VARCHAR(50)`,
  `ALTER TABLE children ADD COLUMN IF NOT EXISTS medium              VARCHAR(50)`,
  `ALTER TABLE children ADD COLUMN IF NOT EXISTS extracurricular     TEXT`,
  `ALTER TABLE children ADD COLUMN IF NOT EXISTS emergency_contact   VARCHAR(255)`,
  `ALTER TABLE children ADD COLUMN IF NOT EXISTS medical_conditions  TEXT`,
  `ALTER TABLE children ADD COLUMN IF NOT EXISTS student_user_id     TEXT REFERENCES users(id) ON DELETE SET NULL`,

  // 002 — parent_subscriptions
  `CREATE TABLE IF NOT EXISTS parent_subscriptions (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    parent_id     TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    plan          VARCHAR(50) NOT NULL DEFAULT 'basic',
    status        VARCHAR(20) NOT NULL DEFAULT 'active',
    features      JSONB NOT NULL DEFAULT '[]',
    billing_cycle VARCHAR(20) DEFAULT 'monthly',
    amount        INTEGER DEFAULT 999,
    currency      VARCHAR(10) DEFAULT 'INR',
    started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at    TIMESTAMPTZ,
    cancelled_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // 003 — parent_briefings
  `CREATE TABLE IF NOT EXISTS parent_briefings (
    id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    parent_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    child_id         TEXT REFERENCES children(id) ON DELETE CASCADE,
    week_of          DATE NOT NULL,
    highlights       JSONB NOT NULL DEFAULT '[]',
    action_items     JSONB NOT NULL DEFAULT '[]',
    wellness_summary JSONB DEFAULT '{}',
    generated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (parent_id, child_id, week_of)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_briefing_parent ON parent_briefings(parent_id, generated_at DESC)`,

  // 004 — career_compass_results
  `CREATE TABLE IF NOT EXISTS career_compass_results (
    id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    child_id         TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    parent_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    traits           JSONB NOT NULL DEFAULT '{}',
    career_matches   JSONB NOT NULL DEFAULT '[]',
    interest_profile JSONB NOT NULL DEFAULT '{}',
    generated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_career_child ON career_compass_results(child_id, generated_at DESC)`,

  // 005 — study_plans
  `CREATE TABLE IF NOT EXISTS study_plans (
    id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    child_id     TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    parent_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start   DATE NOT NULL,
    plan         JSONB NOT NULL DEFAULT '{}',
    status       VARCHAR(20) NOT NULL DEFAULT 'active',
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (child_id, week_start)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_studyplan_child ON study_plans(child_id)`,

  // 006 — wellness_checkins
  `CREATE TABLE IF NOT EXISTS wellness_checkins (
    id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    child_id     TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    parent_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
    stress_level INTEGER NOT NULL CHECK (stress_level >= 1 AND stress_level <= 10),
    mood         VARCHAR(30) NOT NULL,
    energy       INTEGER NOT NULL CHECK (energy >= 1 AND energy <= 10),
    focus        INTEGER NOT NULL CHECK (focus >= 1 AND focus <= 10),
    sleep_hours  NUMERIC(3,1),
    notes        TEXT,
    flags        JSONB DEFAULT '[]',
    checked_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_wellness_child  ON wellness_checkins(child_id, checked_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_wellness_parent ON wellness_checkins(parent_id)`,

  // 007 — scholarship_alerts
  `CREATE TABLE IF NOT EXISTS scholarship_alerts (
    id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title               VARCHAR(255) NOT NULL,
    provider            VARCHAR(255) NOT NULL,
    description         TEXT NOT NULL,
    amount              VARCHAR(100),
    deadline            DATE,
    eligibility_grades  TEXT[] DEFAULT '{}',
    eligibility_boards  TEXT[] DEFAULT '{}',
    eligibility_states  TEXT[] DEFAULT '{}',
    category            VARCHAR(50) DEFAULT 'scholarship',
    apply_url           TEXT,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // 008 — notifications
  `CREATE TABLE IF NOT EXISTS notifications (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    template_id     INTEGER NOT NULL,
    recipient_id    TEXT NOT NULL,
    sender_id       TEXT,
    category        VARCHAR(32) NOT NULL,
    title           VARCHAR(255) NOT NULL,
    message         TEXT NOT NULL,
    type            VARCHAR(4) NOT NULL CHECK (type IN ('fyi', 'fya')),
    priority        VARCHAR(8) NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    is_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ,
    is_email_sent   BOOLEAN NOT NULL DEFAULT FALSE,
    email_sent_at   TIMESTAMPTZ,
    action_url      TEXT,
    action_label    VARCHAR(128),
    metadata        JSONB,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_notif_recipient
    ON notifications(recipient_id, created_at DESC)`,

  `CREATE INDEX IF NOT EXISTS idx_notif_unread
    ON notifications(recipient_id, is_read) WHERE is_read = FALSE`,

  // 009 — notification_preferences
  `CREATE TABLE IF NOT EXISTS notification_preferences (
    id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id            TEXT NOT NULL UNIQUE,
    channels           JSONB NOT NULL DEFAULT '{"in_app":true,"email":true,"whatsapp":false,"sms":false}',
    category_overrides JSONB NOT NULL DEFAULT '{}',
    quiet_hours        JSONB NOT NULL DEFAULT '{"enabled":false}',
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // 010 — notification_queue
  `CREATE TABLE IF NOT EXISTS notification_queue (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    channel         VARCHAR(16) NOT NULL CHECK (channel IN ('email','whatsapp','sms','push')),
    status          VARCHAR(16) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','processing','sent','failed','skipped')),
    attempts        INTEGER NOT NULL DEFAULT 0,
    max_attempts    INTEGER NOT NULL DEFAULT 3,
    scheduled_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at         TIMESTAMPTZ,
    error_message   TEXT,
    provider_ref    VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_queue_pending
    ON notification_queue(status, scheduled_at)
    WHERE status IN ('pending', 'failed')`,

  // 011 — email_consents
  `CREATE TABLE IF NOT EXISTS email_consents (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id       TEXT NOT NULL,
    consent_type  VARCHAR(64) NOT NULL,
    is_consented  BOOLEAN NOT NULL DEFAULT TRUE,
    consented_at  TIMESTAMPTZ,
    revoked_at    TIMESTAMPTZ,
    UNIQUE (user_id, consent_type)
  )`,

  // 012 — notification_templates
  `CREATE TABLE IF NOT EXISTS notification_templates (
    id             INTEGER PRIMARY KEY,
    category       VARCHAR(32) NOT NULL,
    title          VARCHAR(255) NOT NULL,
    body_template  TEXT NOT NULL,
    type           VARCHAR(4) NOT NULL CHECK (type IN ('fyi', 'fya')),
    priority       VARCHAR(8) NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    roles          JSONB NOT NULL DEFAULT '["all"]',
    variables      JSONB NOT NULL DEFAULT '[]',
    action_url     TEXT,
    action_label   VARCHAR(128),
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_notif_tpl_category ON notification_templates(category)`,

  // Seed all 59 notification templates
  `INSERT INTO notification_templates (id, category, title, body_template, type, priority, roles, variables, action_url, action_label) VALUES
    (1,  'security',   'Login OTP',                   'Your one-time login code is [code]. Valid for [expiry] minutes.',                         'fya', 'urgent', '["all"]',                              '["code","expiry"]',                                    NULL, NULL),
    (2,  'security',   'Password Reset OTP',          'Your password reset code is [code]. Valid for [expiry] minutes.',                        'fya', 'urgent', '["all"]',                              '["code","expiry"]',                                    NULL, NULL),
    (3,  'security',   'New Device Login',            'Your account was accessed from a new device at [time].',                                 'fyi', 'high',   '["all"]',                              '["time"]',                                             NULL, NULL),
    (4,  'security',   'Suspicious Login Detected',   'A suspicious login attempt from [location] was detected.',                               'fya', 'urgent', '["all"]',                              '["location"]',                                         NULL, NULL),
    (5,  'security',   'Multiple Failed Logins',      '[count] failed login attempts were detected on your account.',                           'fya', 'high',   '["all"]',                              '["count"]',                                            NULL, NULL),
    (6,  'security',   'Role Changed',                'Your role has been changed to [newRole] by [admin].',                                    'fyi', 'high',   '["all"]',                              '["newRole","admin"]',                                  NULL, NULL),
    (7,  'onboarding', 'Welcome to MetryxOne',        'Hello [name]! Your account is now active.',                                              'fyi', 'normal', '["all"]',                              '["name"]',                                             NULL, NULL),
    (8,  'onboarding', 'Complete Your Profile',       'Your profile is [percent]% complete. Add the missing details to unlock all features.',   'fyi', 'low',    '["all"]',                              '["percent"]',                                          NULL, 'Complete Profile'),
    (9,  'onboarding', 'Mentor Assigned',             '[mentorName] has been assigned as your mentor.',                                         'fyi', 'normal', '["student"]',                          '["mentorName"]',                                       NULL, NULL),
    (10, 'compliance', 'Privacy Policy Updated',      'Our privacy policy has been updated effective [date].',                                  'fyi', 'normal', '["all"]',                              '["date"]',                                             NULL, NULL),
    (11, 'compliance', 'Guardian Consent Required',   'Your child [childName] has been registered. Your consent is required.',                  'fya', 'high',   '["parent"]',                           '["childName"]',                                        NULL, 'Give Consent'),
    (12, 'billing',    'Trial Ending Soon',           'Your free trial ends on [endDate]. Upgrade now to keep access.',                        'fya', 'high',   '["all"]',                              '["endDate"]',                                          NULL, 'Upgrade Now'),
    (13, 'billing',    'Subscription Expired',        'Your subscription has expired. Renew now to continue using MetryxOne.',                  'fya', 'urgent', '["all"]',                              '[]',                                                   NULL, 'Renew Now'),
    (14, 'billing',    'Payment Successful',          'Your payment of [amount] for [plan] has been processed.',                               'fyi', 'normal', '["all"]',                              '["amount","plan"]',                                    NULL, NULL),
    (15, 'billing',    'Payment Failed',              'Your payment of [amount] could not be processed. Please update your payment method.',   'fya', 'urgent', '["all"]',                              '["amount"]',                                           NULL, 'Update Payment'),
    (16, 'billing',    'Invoice Generated',           'Your invoice #[invoiceNumber] for [amount] has been generated.',                        'fyi', 'normal', '["all"]',                              '["invoiceNumber","amount"]',                           NULL, 'View Invoice'),
    (17, 'commerce',   'Discount Code Issued',        'Use code [code] to get [discount] off on [plan].',                                      'fyi', 'normal', '["all"]',                              '["code","discount","plan"]',                           NULL, NULL),
    (18, 'commerce',   'Discount Expiring Soon',      'Your discount code [code] expires on [expiry].',                                        'fyi', 'normal', '["all"]',                              '["code","expiry"]',                                    NULL, NULL),
    (19, 'commerce',   'Discount Applied',            'Discount code [code] applied. You saved [savings].',                                    'fyi', 'low',    '["all"]',                              '["code","savings"]',                                   NULL, NULL),
    (20, 'commerce',   'Coupon Invalid',              'The coupon code [code] is not valid or has expired.',                                   'fyi', 'low',    '["all"]',                              '["code"]',                                             NULL, NULL),
    (21, 'commerce',   'Limited Time Offer',          '[offerTitle] — [discount] off for the next [hours] hours.',                             'fyi', 'normal', '["all"]',                              '["offerTitle","discount","hours"]',                    NULL, NULL),
    (22, 'exam',       'Test Assigned',               '[testName] has been assigned to you by [assignedBy].',                                  'fya', 'high',   '["student"]',                          '["testName","assignedBy"]',                            NULL, 'Start Test'),
    (23, 'exam',       'Test Rescheduled',            '[testName] rescheduled from [oldDate] to [newDate].',                                   'fyi', 'normal', '["student","teacher"]',                '["testName","oldDate","newDate"]',                     NULL, NULL),
    (24, 'exam',       'Test Cancelled',              '[testName] scheduled for [date] has been cancelled.',                                   'fyi', 'normal', '["student","teacher"]',                '["testName","date"]',                                  NULL, NULL),
    (25, 'exam',       'Test Window Open',            '[testName] is now available until [deadline].',                                          'fya', 'high',   '["student"]',                          '["testName","deadline"]',                              NULL, 'Take Test'),
    (26, 'exam',       'Test Reminder',               'Reminder: [testName] starts in [timeLeft].',                                            'fyi', 'normal', '["student"]',                          '["testName","timeLeft"]',                              NULL, NULL),
    (27, 'exam',       'Test Started',                '[studentName] has started [testName].',                                                  'fyi', 'normal', '["teacher","admin"]',                  '["studentName","testName"]',                           NULL, NULL),
    (28, 'exam',       'Test Submitted',              '[testName] has been submitted. Results coming shortly.',                                 'fyi', 'normal', '["student"]',                          '["testName"]',                                         NULL, NULL),
    (29, 'exam',       'Test Auto-Submitted',         '[testName] was auto-submitted as time expired.',                                        'fyi', 'normal', '["student"]',                          '["testName"]',                                         NULL, NULL),
    (30, 'exam',       'Test Not Attempted',          '[studentName] did not attempt [testName] before the deadline.',                         'fyi', 'high',   '["teacher","admin"]',                  '["studentName","testName"]',                           NULL, NULL),
    (31, 'exam',       'Retest Available',            'You can now retake [testName].',                                                        'fya', 'normal', '["student"]',                          '["testName"]',                                         NULL, 'Retake Test'),
    (32, 'reports',    'Report Published',            'Your [reportType] report for [testName] is now available.',                              'fyi', 'normal', '["student","parent"]',                 '["reportType","testName"]',                            NULL, 'View Report'),
    (33, 'reports',    'AI Insight Generated',        'New AI-powered insights are available for [studentName].',                               'fyi', 'normal', '["student","parent","teacher"]',       '["studentName"]',                                      NULL, 'View Insights'),
    (34, 'reports',    'Benchmark Report Available',  'A comparative benchmark report for [testName] is available.',                            'fyi', 'normal', '["student","teacher"]',                '["testName"]',                                         NULL, 'View Benchmark'),
    (35, 'reports',    'Report Viewed',               '[viewerName] viewed the report for [studentName].',                                     'fyi', 'low',    '["admin","teacher"]',                  '["viewerName","studentName"]',                         NULL, NULL),
    (36, 'reports',    'Refresher Module Unlocked',   'Based on your results, a refresher module for [subject] has been unlocked.',             'fyi', 'normal', '["student"]',                          '["subject"]',                                          NULL, 'Start Module'),
    (37, 'reports',    'Weak Area Identified',        'AI has identified [subject] as an area needing improvement.',                            'fyi', 'normal', '["student","parent","teacher"]',       '["subject"]',                                          NULL, NULL),
    (38, 'reports',    'Competency Mastered',         'Congratulations! [studentName] has mastered [competency].',                              'fyi', 'normal', '["student","parent","teacher"]',       '["studentName","competency"]',                         NULL, NULL),
    (39, 'ai_tools',   'AI Test Ready for Review',    'An AI-generated test [testName] for [subject] is ready for review.',                    'fya', 'normal', '["teacher","admin"]',                  '["testName","subject"]',                               NULL, 'Review Test'),
    (40, 'ai_tools',   'Adaptive Test Ready',         'An AI-adaptive test in [subject] is ready.',                                            'fyi', 'normal', '["student"]',                          '["subject"]',                                          NULL, 'Take Test'),
    (41, 'ai_tools',   'Question Bank Updated',       '[count] new AI-generated questions have been added.',                                   'fyi', 'low',    '["teacher","admin"]',                  '["count"]',                                            NULL, NULL),
    (42, 'ai_tools',   'AI Study Recommendations',    'AI has generated personalized study recommendations.',                                  'fyi', 'normal', '["student"]',                          '[]',                                                   NULL, 'View Recommendations'),
    (43, 'ai_tools',   'AI Usage Limit Reached',      'Your AI feature usage has reached the plan limit.',                                     'fyi', 'high',   '["all"]',                              '[]',                                                   NULL, 'Upgrade Plan'),
    (44, 'ai_tools',   'AI Generator Error',          'The AI test generator encountered an error. Please try again.',                         'fyi', 'normal', '["teacher","admin"]',                  '[]',                                                   NULL, NULL),
    (45, 'booking',    'Session Booked',              'Session with [mentorName] booked for [date] at [time].',                                'fyi', 'normal', '["student"]',                          '["mentorName","date","time"]',                         NULL, 'View Booking'),
    (46, 'booking',    'Booking Confirmed',           'Your session on [date] at [time] is confirmed.',                                        'fyi', 'normal', '["student"]',                          '["date","time"]',                                      NULL, NULL),
    (47, 'booking',    'Session Reminder',            'Reminder: Your session starts in [timeLeft].',                                          'fyi', 'normal', '["student","mentor"]',                 '["timeLeft"]',                                         NULL, NULL),
    (48, 'booking',    'Session Rescheduled',         'Session rescheduled from [oldDate] to [newDate].',                                      'fyi', 'normal', '["student","mentor"]',                 '["oldDate","newDate"]',                                NULL, NULL),
    (49, 'booking',    'Session Cancelled',           'Your session on [date] has been cancelled.',                                            'fyi', 'high',   '["student","mentor"]',                 '["date"]',                                             NULL, NULL),
    (50, 'booking',    'No-Show Alert',               '[studentName] did not attend the session.',                                             'fyi', 'normal', '["mentor","admin"]',                   '["studentName"]',                                      NULL, NULL),
    (51, 'booking',    'Session Completed',           'Your session has been marked as completed. Share your feedback.',                        'fya', 'normal', '["student"]',                          '[]',                                                   NULL, 'Leave Feedback'),
    (52, 'feedback',   'Feedback Requested',          'How was your session with [mentorName]?',                                               'fya', 'normal', '["student"]',                          '["mentorName"]',                                       NULL, 'Rate Session'),
    (53, 'feedback',   'Rating Received',             '[studentName] rated their session [rating]/5.',                                         'fyi', 'low',    '["mentor","admin"]',                   '["studentName","rating"]',                             NULL, NULL),
    (54, 'classes',    'Class Scheduled',             '[className] has been scheduled for [date] at [time].',                                  'fyi', 'normal', '["student","teacher"]',                '["className","date","time"]',                          NULL, 'View Class'),
    (55, 'classes',    'Class Reminder',              'Reminder: [className] starts in [timeLeft].',                                           'fyi', 'normal', '["student","teacher"]',                '["className","timeLeft"]',                             NULL, NULL),
    (56, 'classes',    'Class Link Shared',           'The virtual class link for [className] is now available.',                               'fyi', 'normal', '["student","teacher"]',                '["className"]',                                        NULL, 'Join Class'),
    (57, 'classes',    'Class Cancelled',             '[className] scheduled for [date] has been cancelled.',                                  'fyi', 'high',   '["student","teacher"]',                '["className","date"]',                                 NULL, NULL),
    (58, 'classes',    'Substitute Mentor Assigned',  '[newMentorName] will be substituting for [originalMentor].',                            'fyi', 'normal', '["student"]',                          '["newMentorName","originalMentor"]',                   NULL, NULL),
    (59, 'classes',    'Attendance Marked',           '[studentName] attendance for [className]: [status].',                                   'fyi', 'low',    '["student","teacher"]',                '["studentName","className","status"]',                 NULL, NULL)
  ON CONFLICT (id) DO NOTHING`,

  // 013 — user_devices (new-device login detection)
  `CREATE TABLE IF NOT EXISTS user_devices (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_hash TEXT NOT NULL,
    user_agent TEXT,
    ip_address TEXT,
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, device_hash)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_user_devices_user ON user_devices(user_id)`,

  // ─── Exam Ready: Attempts ───
  `CREATE TABLE IF NOT EXISTS exam_ready_attempts (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id         TEXT REFERENCES users(id) ON DELETE SET NULL,
    child_id        TEXT REFERENCES children(id) ON DELETE SET NULL,
    student_name    VARCHAR(255),
    plan_id         VARCHAR(50) NOT NULL DEFAULT 'dynamic',
    pattern_type    VARCHAR(50) NOT NULL DEFAULT 'lbi',
    domain_code     VARCHAR(50),
    subdomain_code  VARCHAR(50),
    age_band        VARCHAR(20),
    board           VARCHAR(50),
    grade           VARCHAR(50),
    status          VARCHAR(30) NOT NULL DEFAULT 'in_progress',
    question_ids    TEXT[] DEFAULT '{}',
    answers         JSONB NOT NULL DEFAULT '{}',
    time_per_question JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_era_user ON exam_ready_attempts(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_era_child ON exam_ready_attempts(child_id)`,
  `CREATE INDEX IF NOT EXISTS idx_era_status ON exam_ready_attempts(status)`,

  // ─── Exam Ready: Reports ───
  `CREATE TABLE IF NOT EXISTS exam_ready_reports (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    attempt_id      TEXT NOT NULL REFERENCES exam_ready_attempts(id) ON DELETE CASCADE,
    user_id         TEXT REFERENCES users(id) ON DELETE SET NULL,
    child_id        TEXT REFERENCES children(id) ON DELETE SET NULL,
    student_name    VARCHAR(255),
    plan_id         VARCHAR(50),
    board           VARCHAR(50),
    grade           VARCHAR(50),
    age_band        VARCHAR(20),
    status          VARCHAR(30) NOT NULL DEFAULT 'pending',
    progress        INTEGER DEFAULT 0,
    score_data      JSONB,
    overall_score   NUMERIC(5,2),
    readiness_level VARCHAR(30),
    summary         TEXT,
    recommendations JSONB,
    pdf_path        TEXT,
    error           TEXT,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_err_attempt ON exam_ready_reports(attempt_id)`,
  `CREATE INDEX IF NOT EXISTS idx_err_user ON exam_ready_reports(user_id)`,
  // Add missing columns if table already exists from earlier migration
  `ALTER TABLE exam_ready_reports ADD COLUMN IF NOT EXISTS board VARCHAR(50)`,
  `ALTER TABLE exam_ready_reports ADD COLUMN IF NOT EXISTS grade VARCHAR(50)`,
  `ALTER TABLE exam_ready_reports ADD COLUMN IF NOT EXISTS age_band VARCHAR(20)`,
  `ALTER TABLE exam_ready_reports ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0`,
  `ALTER TABLE exam_ready_reports ADD COLUMN IF NOT EXISTS readiness_level VARCHAR(30)`,
  `ALTER TABLE exam_ready_reports ADD COLUMN IF NOT EXISTS summary TEXT`,
  `ALTER TABLE exam_ready_reports ADD COLUMN IF NOT EXISTS recommendations JSONB`,
  `ALTER TABLE exam_ready_reports ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ`,

  // ─── Subscription Packages (Exam Ready) ───
  `CREATE TABLE IF NOT EXISTS subscription_packages (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    category        TEXT NOT NULL,
    student_segment TEXT NOT NULL,
    product_name    TEXT NOT NULL,
    is_recommended  BOOLEAN NOT NULL DEFAULT FALSE,
    domains_covered TEXT[] NOT NULL DEFAULT '{}',
    price           REAL,
    price_max       REAL,
    validity_days   INTEGER,
    question_count  INTEGER,
    module_count    INTEGER DEFAULT 1,
    modules_covered TEXT[] DEFAULT '{}',
    duration_text   TEXT,
    duration_minutes INTEGER,
    billing_type    TEXT DEFAULT 'one-time',
    availability_window TEXT,
    class_range     TEXT,
    report_type     TEXT,
    description     TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  // Add new columns to existing tables
  `ALTER TABLE subscription_packages ADD COLUMN IF NOT EXISTS price_max REAL`,
  `ALTER TABLE subscription_packages ADD COLUMN IF NOT EXISTS module_count INTEGER DEFAULT 1`,
  `ALTER TABLE subscription_packages ADD COLUMN IF NOT EXISTS modules_covered TEXT[] DEFAULT '{}'`,
  // Coerce modules_covered from TEXT to TEXT[] on environments where it was created as plain TEXT
  `DO $$ BEGIN
     IF EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_name = 'subscription_packages'
         AND column_name = 'modules_covered'
         AND data_type = 'text'
         AND udt_name <> '_text'
     ) THEN
       ALTER TABLE subscription_packages
         ALTER COLUMN modules_covered TYPE TEXT[]
         USING CASE WHEN modules_covered IS NULL OR modules_covered = ''
                    THEN '{}'::text[]
                    ELSE string_to_array(modules_covered, ',')
               END;
     END IF;
   END $$`,
  `ALTER TABLE subscription_packages ADD COLUMN IF NOT EXISTS duration_text TEXT`,
  `ALTER TABLE subscription_packages ADD COLUMN IF NOT EXISTS duration_minutes INTEGER`,
  `ALTER TABLE subscription_packages ADD COLUMN IF NOT EXISTS billing_type TEXT DEFAULT 'one-time'`,
  `ALTER TABLE subscription_packages ADD COLUMN IF NOT EXISTS availability_window TEXT`,
  `ALTER TABLE subscription_packages ADD COLUMN IF NOT EXISTS class_range TEXT`,
  `ALTER TABLE subscription_packages ADD COLUMN IF NOT EXISTS description TEXT`,

  // ─── Seed 12 packages ───
  // Entry (Micro Check) — 5 packages
  `INSERT INTO subscription_packages (id, category, student_segment, product_name, class_range, modules_covered, module_count, question_count, description, duration_text, duration_minutes, price, billing_type, availability_window, report_type, domains_covered, sort_order)
   SELECT 'entry-learning', 'entry', 'Any Class', 'Mini Learning Check', 'Any Class', '{1}', 1, 12, 'Learning style, focus & memory snapshot', '10–12 min', 12, 69, 'one-time', 'Always-on',
          'Learning style snapshot', ARRAY['Learning style analysis','Focus assessment','Memory snapshot'], 1
   WHERE NOT EXISTS (SELECT 1 FROM subscription_packages WHERE id = 'entry-learning')`,

  `INSERT INTO subscription_packages (id, category, student_segment, product_name, class_range, modules_covered, module_count, question_count, description, duration_text, duration_minutes, price, billing_type, availability_window, report_type, domains_covered, sort_order)
   SELECT 'entry-stress', 'entry', 'Any Class', 'Stress Check', 'Any Class', '{3}', 1, 12, 'Exam stress & fear impact', '10–12 min', 12, 69, 'one-time', 'Always-on',
          'Stress impact report', ARRAY['Exam stress analysis','Fear impact assessment','Coping mechanism check'], 2
   WHERE NOT EXISTS (SELECT 1 FROM subscription_packages WHERE id = 'entry-stress')`,

  `INSERT INTO subscription_packages (id, category, student_segment, product_name, class_range, modules_covered, module_count, question_count, description, duration_text, duration_minutes, price, billing_type, availability_window, report_type, domains_covered, sort_order)
   SELECT 'entry-snapshot', 'entry', 'Any Class', 'Snapshot Lite', 'Any Class', '{1,3}', 2, 18, 'Learning + stress clarity', '15–18 min', 18, 99, 'one-time', 'Always-on',
          'Combined learning + stress report', ARRAY['Learning style analysis','Stress & fear assessment','Combined clarity score'], 3
   WHERE NOT EXISTS (SELECT 1 FROM subscription_packages WHERE id = 'entry-snapshot')`,

  `INSERT INTO subscription_packages (id, category, student_segment, product_name, class_range, modules_covered, module_count, question_count, description, duration_text, duration_minutes, price, billing_type, availability_window, report_type, domains_covered, sort_order)
   SELECT 'entry-confidence', 'entry', 'Class 8+', 'Confidence Check', 'Class 8+', '{4}', 1, 15, 'Confidence & comparison impact', '12–15 min', 15, 99, 'one-time', 'Jan 22 – Feb 15',
          'Confidence analysis report', ARRAY['Self-confidence assessment','Social comparison impact','Peer pressure analysis'], 4
   WHERE NOT EXISTS (SELECT 1 FROM subscription_packages WHERE id = 'entry-confidence')`,

  `INSERT INTO subscription_packages (id, category, student_segment, product_name, class_range, modules_covered, module_count, question_count, description, duration_text, duration_minutes, price, billing_type, availability_window, report_type, domains_covered, sort_order)
   SELECT 'entry-habit', 'entry', 'Class 6+', 'Habit Check', 'Class 6+', '{7}', 1, 15, 'Discipline & consistency snapshot', '12–15 min', 15, 99, 'one-time', 'June – July',
          'Habit & discipline report', ARRAY['Discipline assessment','Consistency tracking','Study habit analysis'], 5
   WHERE NOT EXISTS (SELECT 1 FROM subscription_packages WHERE id = 'entry-habit')`,

  // Exam-Season Special — 3 packages
  `INSERT INTO subscription_packages (id, category, student_segment, product_name, is_recommended, class_range, modules_covered, module_count, question_count, description, duration_text, duration_minutes, price, billing_type, availability_window, report_type, domains_covered, sort_order)
   SELECT 'exam-ready-10', 'exam-season', 'Class 10 Boards', 'EXAM READY™', TRUE, 'Class 10', '{1,2,3,4,7,9,10,11,12,13,14}', 11, 40, 'What can still improve before boards', '30–40 min', 40, 299, 'one-time', 'Jan 25 – Feb 20',
          'Full psychometric report', ARRAY['Complete psychological readiness','Stress & anxiety management','Focus & concentration','Emotional regulation','Personalized coping strategies','Time management analysis','Exam strategy optimization'], 6
   WHERE NOT EXISTS (SELECT 1 FROM subscription_packages WHERE id = 'exam-ready-10')`,

  `INSERT INTO subscription_packages (id, category, student_segment, product_name, is_recommended, class_range, modules_covered, module_count, question_count, description, duration_text, duration_minutes, price, billing_type, availability_window, report_type, domains_covered, sort_order)
   SELECT 'exam-ready-12', 'exam-season', 'Class 12 + Entrance', 'EXAM READY™', TRUE, 'Class 12', '{1,2,3,4,7,9,10,11,12,13,14}', 11, 40, 'Fix execution & stress (30–60 days)', '30–40 min', 40, 399, 'one-time', 'Jan 25 – Feb 25',
          'Full psychometric report', ARRAY['Complete psychological readiness','Execution strategy repair','Stress management for boards','Entrance exam preparation','Focus & concentration','Burnout prevention','Recovery planning'], 7
   WHERE NOT EXISTS (SELECT 1 FROM subscription_packages WHERE id = 'exam-ready-12')`,

  `INSERT INTO subscription_packages (id, category, student_segment, product_name, class_range, modules_covered, module_count, question_count, description, duration_text, duration_minutes, price, billing_type, availability_window, report_type, domains_covered, sort_order)
   SELECT 'exam-ready-comp', 'exam-season', 'Competitive Exams', 'EXAM READY™', 'Competitive', '{1,2,3,4,7,9,10,11,12,13,14}', 11, 40, 'Strategy reset & pressure control', '30–40 min', 40, 499, 'one-time', 'Jan 30 – March 10',
          'Full psychometric report', ARRAY['Strategy reset framework','Pressure control techniques','Competition mindset analysis','Focus under pressure','Recovery & resilience','Performance optimization','Personalized action plan'], 8
   WHERE NOT EXISTS (SELECT 1 FROM subscription_packages WHERE id = 'exam-ready-comp')`,

  // Annual Core — 3 packages
  `INSERT INTO subscription_packages (id, category, student_segment, product_name, class_range, modules_covered, module_count, question_count, description, duration_text, price, price_max, billing_type, availability_window, report_type, domains_covered, sort_order)
   SELECT 'annual-foundation', 'annual', 'Class 6–8', 'FOUNDATION', 'Class 6–8', '{1,3,5,6,7,8,10,18}', 8, 60, 'Build focus, habits & emotional base', 'Year-long', 999, 1499, 'annual', 'June – July',
          'Year-long behavioral tracking', ARRAY['Focus & attention building','Study habit formation','Emotional regulation base','Stress awareness','Discipline development','Memory & learning optimization','Confidence building','Annual progress report'], 9
   WHERE NOT EXISTS (SELECT 1 FROM subscription_packages WHERE id = 'annual-foundation')`,

  `INSERT INTO subscription_packages (id, category, student_segment, product_name, is_recommended, class_range, modules_covered, module_count, question_count, description, duration_text, price, price_max, billing_type, availability_window, report_type, domains_covered, sort_order)
   SELECT 'annual-performance', 'annual', 'Class 9–10', 'PERFORMANCE', TRUE, 'Class 9–10', '{1,2,3,4,5,7,8,9,10,14,18}', 11, 80, 'Stabilise marks & exam confidence', 'Year-long', 1999, 2999, 'annual', 'June – August',
          'Comprehensive performance report', ARRAY['Marks stabilization strategy','Exam confidence building','Stress & anxiety management','Focus optimization','Study pattern analysis','Time management','Peer benchmarking','Board exam preparation','Quarterly progress tracking'], 10
   WHERE NOT EXISTS (SELECT 1 FROM subscription_packages WHERE id = 'annual-performance')`,

  `INSERT INTO subscription_packages (id, category, student_segment, product_name, class_range, modules_covered, module_count, question_count, description, duration_text, price, price_max, billing_type, availability_window, report_type, domains_covered, sort_order)
   SELECT 'annual-readiness', 'annual', 'Class 11–12', 'READINESS', 'Class 11–12', '{1,2,3,4,5,7,9,10,11,12,13,14,15,16,19}', 15, 100, 'Protect preparation & prevent burnout', 'Year-long', 3499, 4999, 'annual', 'July – September',
          'Advanced readiness report', ARRAY['Preparation protection','Burnout prevention','High-stakes exam strategy','Deep stress analysis','Focus under pressure','Emotional resilience','Career alignment','Mentor matching','Monthly progress reports','Parent coaching insights'], 11
   WHERE NOT EXISTS (SELECT 1 FROM subscription_packages WHERE id = 'annual-readiness')`,

  // Premium — 1 package
  `INSERT INTO subscription_packages (id, category, student_segment, product_name, class_range, modules_covered, module_count, question_count, description, duration_text, price, price_max, billing_type, availability_window, report_type, domains_covered, sort_order)
   SELECT 'premium-edge', 'premium', 'Competitive Aspirants', 'EDGE', 'Competitive', '{"All 19 modules"}', 19, 150, 'Performance insurance & recovery', 'Attempt-based', 6999, 9999, 'per-attempt', 'April – June',
          'Complete performance insurance report', ARRAY['All 19 psychometric modules','Performance insurance','Recovery framework','Attempt-level analysis','Deep pressure profiling','Competition mindset mastery','Personalized recovery plan','Priority mentor access','Unlimited re-assessments','Parent & coach dashboard'], 12
   WHERE NOT EXISTS (SELECT 1 FROM subscription_packages WHERE id = 'premium-edge')`,

  // ─── Student Subscriptions ───
  `CREATE TABLE IF NOT EXISTS student_subscriptions (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    child_id        TEXT REFERENCES children(id) ON DELETE CASCADE,
    package_id      TEXT NOT NULL REFERENCES subscription_packages(id) ON DELETE RESTRICT,
    purchase_date   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expiry_date     TIMESTAMPTZ,
    status          TEXT NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ss_child ON student_subscriptions(child_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ss_status ON student_subscriptions(status)`,

  // platform_settings — key/value store for app configuration
  `CREATE TABLE IF NOT EXISTS platform_settings (
    key             VARCHAR(100) PRIMARY KEY,
    value           TEXT NOT NULL DEFAULT '',
    category        VARCHAR(50) NOT NULL DEFAULT 'general',
    description     TEXT,
    updated_by      TEXT REFERENCES users(id),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  // ─── LBI Modules ───
  `CREATE TABLE IF NOT EXISTS lbi_modules (
    id          SERIAL PRIMARY KEY,
    module_code VARCHAR(20) NOT NULL UNIQUE,
    module_name VARCHAR(255) NOT NULL,
    description TEXT,
    icon_key    VARCHAR(50),
    color       VARCHAR(20),
    sort_order  INT NOT NULL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    sub_modules JSONB NOT NULL DEFAULT '[]',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_lbi_modules_active ON lbi_modules(is_active, sort_order)`,

  // ─── LBI Sessions ───
  `CREATE TABLE IF NOT EXISTS lbi_sessions (
    id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    child_id           TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    module_id          INT NOT NULL REFERENCES lbi_modules(id),
    status             VARCHAR(50) NOT NULL DEFAULT 'In Progress',
    started_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at       TIMESTAMPTZ,
    raw_score          INT,
    max_score          INT,
    percentile_score   DECIMAL(5,2),
    percentage_score   DECIMAL(5,2),
    total_questions    INT NOT NULL DEFAULT 0,
    questions_answered INT NOT NULL DEFAULT 0,
    responses          JSONB NOT NULL DEFAULT '[]',
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_lbi_sessions_child ON lbi_sessions(child_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_lbi_sessions_module ON lbi_sessions(module_id)`,

  // ─── LBI Domains (19 validated LBI domain codes) ───
  `CREATE TABLE IF NOT EXISTS lbi_domains (
    id            SERIAL PRIMARY KEY,
    domain_code   VARCHAR(20) NOT NULL UNIQUE,
    domain_name   VARCHAR(255) NOT NULL,
    description   TEXT,
    sort_order    INT NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_lbi_domains_code ON lbi_domains(domain_code)`,

  // ─── Assessment Domains & Subdomains ───
  `CREATE TABLE IF NOT EXISTS assessment_domains (
    id              INT PRIMARY KEY,
    domain_code     VARCHAR(10) NOT NULL UNIQUE,
    domain_name     VARCHAR(255) NOT NULL,
    weight_percent  REAL DEFAULT 0,
    tools_methods   TEXT,
    root_cause      TEXT,
    practical_outcome TEXT,
    correlations    TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS assessment_subdomains (
    id              TEXT PRIMARY KEY,
    domain_id       INT NOT NULL REFERENCES assessment_domains(id) ON DELETE CASCADE,
    subdomain_name  VARCHAR(255) NOT NULL,
    weight_in_domain REAL DEFAULT 0,
    sort_order      INT DEFAULT 0,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_subdomains_domain ON assessment_subdomains(domain_id)`,

  `CREATE TABLE IF NOT EXISTS package_domain_mapping (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    package_id  TEXT NOT NULL REFERENCES subscription_packages(id) ON DELETE CASCADE,
    domain_id   INT NOT NULL REFERENCES assessment_domains(id) ON DELETE CASCADE,
    UNIQUE(package_id, domain_id)
  )`,

  // ── Seed 19 Assessment Domains ──
  `INSERT INTO assessment_domains (id, domain_code, domain_name, weight_percent, tools_methods, root_cause, practical_outcome) VALUES
    (1, 'D01', 'Academic & Cognitive Effectiveness', 12, 'Digit Span/Recall Tasks, Learning Style Inventory (VARK/MI), Study Strategy Effectiveness Scale', 'Effort–result mismatch, memory overload, wrong study method', 'Personalized study strategy, better retention'),
    (2, 'D02', 'Thinking Quality Under Pressure', 10, 'Exam-like Scenario Judgment Tests (SJT), Time-bound reasoning tasks, Choice–Reason–Outcome reflection', 'Panic-driven thinking, speed–accuracy imbalance', 'Improved exam decision-making'),
    (3, 'D03', 'Examination Stress & Emotional Regulation', 10, 'Exam Stress Coping Scale, Emotional Regulation Checklist', 'Freeze/avoidance response, emotional overload', 'Stress control techniques'),
    (4, 'D04', 'Confidence, Self-Concept & Comparison', 8, 'Self-Esteem Scale (Rosenberg), Self-Concept Questionnaire, Strength Awareness Inventory', 'Confidence erosion, peer comparison damage', 'Confidence rebuilding plan'),
    (5, 'D05', 'Adjustment & Coping Capacity', 7, 'Adolescent Adjustment Inventory, Coping Style Inventory, Home–School Pressure Mapping', 'Skill vs coping problem, burnout risk', 'Healthy coping & adaptation'),
    (6, 'D06', 'Social & Emotional Intelligence', 5, 'EQ Competency Mapping, Social Skills Inventory, Peer Interaction Reflection', 'Social stress, emotional immaturity', 'Better peer & teacher interaction'),
    (7, 'D07', 'Discipline, Habits & Consistency', 8, 'Time Management Questionnaire, Study Routine Audit, Accountability Tracker', 'Inconsistent routines, poor follow-through', 'Stable daily performance habits'),
    (8, 'D08', 'Communication & Expression', 5, 'Listening & Expression Scale, Role-play Scenarios, Conflict Style Questionnaire', 'Hesitation, fear of speaking, avoidance', 'Clear expression & assertiveness'),
    (9, 'D09', 'Motivation, Values & Responsibility', 6, 'Drive & Commitment Scale, Values Clarification Tool, Responsibility Index', 'Low intrinsic motivation, blame patterns', 'Purpose-driven effort'),
    (10, 'D10', 'Lifestyle & Pressure Environment', 5, 'Digital Use Tracker, Sleep Quality Questionnaire, Expectation Pressure Map', 'Hidden performance drains', 'Energy & focus recovery'),
    (11, 'D11', 'Competitive Exam Readiness', 5, 'Competitive Exam Simulation Tasks, Uncertainty Handling Scale', 'Drop in performance under high stakes', 'Consistent competitive results'),
    (12, 'D12', 'Integrated Root Cause Mapping', 0, 'Weighted Scoring & Heat Map (AI Layer)', 'True root cause vs symptoms', 'Targeted intervention roadmap'),
    (13, 'D13', 'Academic Planning & Recovery Intelligence', 7, 'Plan–action gap research, Goal-setting theory, Stress cognition under time pressure', 'Poor planning realism, recovery failure', 'Realistic recovery plans'),
    (14, 'D14', 'Metacognition & Self-Regulation', 6, 'Metacognitive awareness studies, Self-control research', 'Low error awareness, poor strategy switching', 'Self-correction & strategy switching'),
    (15, 'D15', 'Help-Seeking & Support Utilization', 4, 'Help-seeking behavior assessment', 'Silent failure, trust issues', 'Proactive help-seeking'),
    (16, 'D16', 'Academic Identity & Meaning', 3, 'Identity alignment assessment', 'Disengagement, no subject relevance', 'Purpose & agency in learning'),
    (17, 'D17', 'Transition & Change Adaptability', 3, 'Flexibility & uncertainty tolerance assessment', 'Sudden drops, adaptation failure', 'Smooth transitions'),
    (18, 'D18', 'Teacher–Student Interaction Sensitivity', 2, 'Authority sensitivity assessment', 'Poor feedback responsiveness', 'Better school interventions'),
    (19, 'D19', 'Over-Compliance Risk', 2, 'Obedience under pressure assessment', 'Hidden distress masking', 'Healthy boundary setting')
   ON CONFLICT (id) DO NOTHING`,

  // ── Seed Subdomains (D01-D04 detailed, rest abbreviated) ──
  `INSERT INTO assessment_subdomains (id, domain_id, subdomain_name, weight_in_domain, sort_order) VALUES
    ('D01.S01', 1, 'Learning efficiency', 18, 1),
    ('D01.S02', 1, 'Conceptual understanding depth', 22, 2),
    ('D01.S03', 1, 'Working memory capacity', 18, 3),
    ('D01.S04', 1, 'Retrieval memory strength', 0, 4),
    ('D01.S05', 1, 'Sustained attention span', 15, 5),
    ('D01.S06', 1, 'Cognitive processing speed', 0, 6),
    ('D01.S07', 1, 'Learning style preference', 12, 7),
    ('D01.S08', 1, 'Processing stability', 15, 8),
    ('D01.S09', 1, 'Cognitive flexibility', 0, 9),
    ('D01.S10', 1, 'Knowledge integration ability', 0, 10),
    ('D02.S01', 2, 'Analytical thinking', 18, 1),
    ('D02.S02', 2, 'Critical thinking', 0, 2),
    ('D02.S03', 2, 'Decision quality & judgment', 15, 3),
    ('D02.S04', 2, 'Managing complexity', 15, 4),
    ('D02.S05', 2, 'Exam strategy formulation', 20, 5),
    ('D02.S06', 2, 'Strategy execution accuracy', 0, 6),
    ('D02.S07', 2, 'Complexity tolerance', 0, 7),
    ('D02.S08', 2, 'Error handling & adaptive execution', 17, 8),
    ('D02.S09', 2, 'Time-pressure reasoning', 0, 9),
    ('D02.S10', 2, 'Situational judgment check', 15, 10),
    ('D02.S11', 2, 'Prioritization under constraints', 0, 11),
    ('D03.S01', 3, 'Stress reactivity', 15, 1),
    ('D03.S02', 3, 'Emotional regulation ability', 15, 2),
    ('D03.S03', 3, 'Cognitive control under stress', 15, 3),
    ('D03.S04', 3, 'Execution stability under pressure', 15, 4),
    ('D03.S05', 3, 'Recovery and reset speed', 10, 5),
    ('D03.S06', 3, 'Stress spillover control', 10, 6),
    ('D03.S07', 3, 'Anticipatory stress management', 10, 7),
    ('D03.S08', 3, 'Emotional insight and awareness', 5, 8),
    ('D03.S09', 3, 'Regulation strategy flexibility', 5, 9),
    ('D03.S10', 3, 'Performance anxiety sensitivity', 0, 10),
    ('D04.S01', 4, 'Academic self-confidence', 18, 1),
    ('D04.S02', 4, 'Confidence stability', 15, 2),
    ('D04.S03', 4, 'Self-concept clarity', 12, 3),
    ('D04.S04', 4, 'Social comparison sensitivity', 12, 4),
    ('D04.S05', 4, 'Fear of negative evaluation', 12, 5),
    ('D04.S06', 4, 'Competence attribution style', 15, 6),
    ('D04.S07', 4, 'External validation dependence', 8, 7),
    ('D04.S08', 4, 'Self-doubt intrusion', 4, 8),
    ('D04.S09', 4, 'Confidence–performance alignment', 4, 9),
    ('D04.S10', 4, 'Self-efficacy beliefs', 0, 10),
    ('D05.S01', 5, 'Academic adjustment', 25, 1),
    ('D05.S02', 5, 'Emotional adjustment', 25, 2),
    ('D05.S03', 5, 'Social adjustment', 25, 3),
    ('D05.S04', 5, 'Family adjustment', 25, 4),
    ('D06.S01', 6, 'Emotional regulation', 35, 1),
    ('D06.S02', 6, 'Relationship handling', 35, 2),
    ('D06.S03', 6, 'Trust & inclusion', 30, 3),
    ('D07.S01', 7, 'Time & priority management', 20, 1),
    ('D07.S02', 7, 'Accountability & ownership', 20, 2),
    ('D07.S03', 7, 'Plan–execution alignment', 25, 3),
    ('D07.S04', 7, 'Consistency under difficulty', 35, 4),
    ('D08.S01', 8, 'Listening', 30, 1),
    ('D08.S02', 8, 'Expression', 30, 2),
    ('D08.S03', 8, 'Conflict handling', 20, 3),
    ('D08.S04', 8, 'Instruction comprehension', 20, 4),
    ('D09.S01', 9, 'Drive', 20, 1),
    ('D09.S02', 9, 'Commitment stability', 20, 2),
    ('D09.S03', 9, 'Integrity', 15, 3),
    ('D09.S04', 9, 'Ownership pattern', 20, 4),
    ('D09.S05', 9, 'Effort persistence', 25, 5),
    ('D10.S01', 10, 'Digital distraction', 35, 1),
    ('D10.S02', 10, 'Sleep quality', 30, 2),
    ('D10.S03', 10, 'Expectation pressure', 35, 3),
    ('D11.S01', 11, 'Performance stability', 30, 1),
    ('D11.S02', 11, 'Pressure tolerance', 25, 2),
    ('D11.S03', 11, 'Consistency', 20, 3),
    ('D11.S04', 11, 'Performance variance', 15, 4),
    ('D11.S05', 11, 'Recovery speed', 10, 5),
    ('D13.S01', 13, 'Planning realism', 20, 1),
    ('D13.S02', 13, 'Academic prioritisation', 15, 2),
    ('D13.S03', 13, 'Recovery capacity after setbacks', 20, 3),
    ('D13.S04', 13, 'Strategy correction ability', 15, 4),
    ('D13.S05', 13, 'Execution feasibility', 15, 5),
    ('D13.S06', 13, '30–60 day recovery window', 15, 6),
    ('D14.S01', 14, 'Error awareness', 35, 1),
    ('D14.S02', 14, 'Strategy switching', 35, 2),
    ('D14.S03', 14, 'Self-correction timing', 30, 3),
    ('D15.S01', 15, 'Help-seeking hesitation', 40, 1),
    ('D15.S02', 15, 'Trust in authority', 30, 2),
    ('D15.S03', 15, 'Response to guidance', 30, 3),
    ('D16.S01', 16, 'Subject relevance perception', 35, 1),
    ('D16.S02', 16, 'Sense of agency', 35, 2),
    ('D16.S03', 16, 'Identity alignment', 30, 3),
    ('D17.S01', 17, 'Flexibility', 25, 1),
    ('D17.S02', 17, 'Uncertainty tolerance', 25, 2),
    ('D17.S03', 17, 'Adaptation speed', 25, 3),
    ('D17.S04', 17, 'Recovery delay', 25, 4),
    ('D18.S01', 18, 'Authority sensitivity', 50, 1),
    ('D18.S02', 18, 'Feedback responsiveness', 50, 2),
    ('D19.S01', 19, 'Obedience under pressure', 50, 1),
    ('D19.S02', 19, 'Hidden distress masking', 50, 2)
   ON CONFLICT (id) DO NOTHING`,

  // ── Seed Package-Domain Mappings ──
  // Entry: Mini Learning Check = Module 1
  `INSERT INTO package_domain_mapping (package_id, domain_id) VALUES ('entry-learning', 1) ON CONFLICT DO NOTHING`,
  // Entry: Stress Check = Module 3
  `INSERT INTO package_domain_mapping (package_id, domain_id) VALUES ('entry-stress', 3) ON CONFLICT DO NOTHING`,
  // Entry: Snapshot Lite = Modules 1, 3
  `INSERT INTO package_domain_mapping (package_id, domain_id) VALUES ('entry-snapshot', 1), ('entry-snapshot', 3) ON CONFLICT DO NOTHING`,
  // Entry: Confidence Check = Module 4
  `INSERT INTO package_domain_mapping (package_id, domain_id) VALUES ('entry-confidence', 4) ON CONFLICT DO NOTHING`,
  // Entry: Habit Check = Module 7
  `INSERT INTO package_domain_mapping (package_id, domain_id) VALUES ('entry-habit', 7) ON CONFLICT DO NOTHING`,
  // Exam-Season: EXAM READY (all 3) = Modules 1,2,3,4,7,9,10,11,12,13,14
  `INSERT INTO package_domain_mapping (package_id, domain_id) VALUES
    ('exam-ready-10',1),('exam-ready-10',2),('exam-ready-10',3),('exam-ready-10',4),('exam-ready-10',7),('exam-ready-10',9),('exam-ready-10',10),('exam-ready-10',11),('exam-ready-10',12),('exam-ready-10',13),('exam-ready-10',14),
    ('exam-ready-12',1),('exam-ready-12',2),('exam-ready-12',3),('exam-ready-12',4),('exam-ready-12',7),('exam-ready-12',9),('exam-ready-12',10),('exam-ready-12',11),('exam-ready-12',12),('exam-ready-12',13),('exam-ready-12',14),
    ('exam-ready-comp',1),('exam-ready-comp',2),('exam-ready-comp',3),('exam-ready-comp',4),('exam-ready-comp',7),('exam-ready-comp',9),('exam-ready-comp',10),('exam-ready-comp',11),('exam-ready-comp',12),('exam-ready-comp',13),('exam-ready-comp',14)
   ON CONFLICT DO NOTHING`,
  // Annual: FOUNDATION = 1,3,5,6,7,8,10,18
  `INSERT INTO package_domain_mapping (package_id, domain_id) VALUES
    ('annual-foundation',1),('annual-foundation',3),('annual-foundation',5),('annual-foundation',6),('annual-foundation',7),('annual-foundation',8),('annual-foundation',10),('annual-foundation',18)
   ON CONFLICT DO NOTHING`,
  // Annual: PERFORMANCE = 1,2,3,4,5,7,8,9,10,14,18
  `INSERT INTO package_domain_mapping (package_id, domain_id) VALUES
    ('annual-performance',1),('annual-performance',2),('annual-performance',3),('annual-performance',4),('annual-performance',5),('annual-performance',7),('annual-performance',8),('annual-performance',9),('annual-performance',10),('annual-performance',14),('annual-performance',18)
   ON CONFLICT DO NOTHING`,
  // Annual: READINESS = 1,2,3,4,5,7,9,10,11,12,13,14,15,16,19
  `INSERT INTO package_domain_mapping (package_id, domain_id) VALUES
    ('annual-readiness',1),('annual-readiness',2),('annual-readiness',3),('annual-readiness',4),('annual-readiness',5),('annual-readiness',7),('annual-readiness',9),('annual-readiness',10),('annual-readiness',11),('annual-readiness',12),('annual-readiness',13),('annual-readiness',14),('annual-readiness',15),('annual-readiness',16),('annual-readiness',19)
   ON CONFLICT DO NOTHING`,
  // Premium: EDGE = All 19 modules
  `INSERT INTO package_domain_mapping (package_id, domain_id) VALUES
    ('premium-edge',1),('premium-edge',2),('premium-edge',3),('premium-edge',4),('premium-edge',5),('premium-edge',6),('premium-edge',7),('premium-edge',8),('premium-edge',9),('premium-edge',10),('premium-edge',11),('premium-edge',12),('premium-edge',13),('premium-edge',14),('premium-edge',15),('premium-edge',16),('premium-edge',17),('premium-edge',18),('premium-edge',19)
   ON CONFLICT DO NOTHING`,

  // ─── Mentor Profiles ───
  `CREATE TABLE IF NOT EXISTS mentor_profiles (
    id                SERIAL PRIMARY KEY,
    user_id           TEXT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    display_name      VARCHAR(200),
    title             VARCHAR(200),
    bio               TEXT,
    mentor_type       VARCHAR(50) DEFAULT 'subject_tutor',
    subjects          TEXT[] DEFAULT '{}',
    psychological_areas TEXT[] DEFAULT '{}',
    specializations   TEXT[] DEFAULT '{}',
    lbi_domains       TEXT[] DEFAULT '{}',
    languages         TEXT[] DEFAULT '{}',
    experience_years  INTEGER DEFAULT 0,
    hourly_rate       DECIMAL(10,2) DEFAULT 0,
    currency          VARCHAR(10) DEFAULT 'INR',
    mode              VARCHAR(20) DEFAULT 'online',
    city              VARCHAR(100),
    education         JSONB DEFAULT '[]',
    certifications    TEXT[] DEFAULT '{}',
    age_groups        TEXT[] DEFAULT '{}',
    availability      JSONB DEFAULT '{}',
    profile_image_url TEXT,
    linkedin_url      TEXT,
    is_verified       BOOLEAN DEFAULT FALSE,
    is_featured       BOOLEAN DEFAULT FALSE,
    rating            DECIMAL(3,2) DEFAULT 0,
    total_reviews     INTEGER DEFAULT 0,
    total_sessions    INTEGER DEFAULT 0,
    ai_match_tags     TEXT[] DEFAULT '{}',
    status            VARCHAR(20) DEFAULT 'pending',
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_mentor_profiles_user ON mentor_profiles(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_mentor_profiles_type ON mentor_profiles(mentor_type, status)`,
  `CREATE INDEX IF NOT EXISTS idx_mentor_profiles_rating ON mentor_profiles(rating DESC)`,

  // ─── Mentor Bookings ───
  `CREATE TABLE IF NOT EXISTS mentor_bookings (
    id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    mentor_id    INTEGER NOT NULL REFERENCES mentor_profiles(id) ON DELETE CASCADE,
    child_id     TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    parent_id    TEXT REFERENCES users(id),
    slot_date    DATE NOT NULL,
    start_time   TIME NOT NULL,
    end_time     TIME NOT NULL,
    mode         VARCHAR(20) DEFAULT 'online',
    status       VARCHAR(30) DEFAULT 'pending',
    notes        TEXT,
    session_link TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_mentor_bookings_mentor ON mentor_bookings(mentor_id, slot_date)`,
  `CREATE INDEX IF NOT EXISTS idx_mentor_bookings_child  ON mentor_bookings(child_id)`,

  // ─── Mentor Reviews ───
  `CREATE TABLE IF NOT EXISTS mentor_reviews (
    id           SERIAL PRIMARY KEY,
    mentor_id    INTEGER NOT NULL REFERENCES mentor_profiles(id) ON DELETE CASCADE,
    reviewer_id  TEXT REFERENCES users(id),
    booking_id   TEXT REFERENCES mentor_bookings(id),
    rating       INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment      TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_mentor_reviews_mentor ON mentor_reviews(mentor_id)`,

  // ─── LBI Age Bands ───
  `CREATE TABLE IF NOT EXISTS lbi_age_bands (
    id          SERIAL PRIMARY KEY,
    band_code   VARCHAR(10) NOT NULL UNIQUE,
    label       VARCHAR(100) NOT NULL,
    age_min     INT NOT NULL,
    age_max     INT NOT NULL,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // ─── LBI Questions (imported via CSV upload) ───
  `CREATE TABLE IF NOT EXISTS lbi_questions (
    id             SERIAL PRIMARY KEY,
    question_code  VARCHAR(80) NOT NULL UNIQUE,
    domain_code    VARCHAR(20) NOT NULL,
    domain_name    VARCHAR(255),
    subdomain_code VARCHAR(50) NOT NULL,
    subdomain_name VARCHAR(255),
    age_band_code  VARCHAR(10) NOT NULL,
    question_type  VARCHAR(30) NOT NULL DEFAULT 'likert',
    question_text  TEXT NOT NULL,
    passage_text   TEXT,
    keying         VARCHAR(20) DEFAULT 'Positive',
    reverse_scored BOOLEAN NOT NULL DEFAULT FALSE,
    option_a       TEXT,
    option_b       TEXT,
    option_c       TEXT,
    option_d       TEXT,
    option_a_score INT,
    option_b_score INT,
    option_c_score INT,
    option_d_score INT,
    correct_answer VARCHAR(10),
    explanation    TEXT,
    is_anchor      BOOLEAN NOT NULL DEFAULT FALSE,
    difficulty     VARCHAR(20) DEFAULT 'MEDIUM',
    status         VARCHAR(20) DEFAULT 'active',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_lbi_questions_domain ON lbi_questions(domain_code)`,
  `CREATE INDEX IF NOT EXISTS idx_lbi_questions_subdomain ON lbi_questions(subdomain_code)`,
  `CREATE INDEX IF NOT EXISTS idx_lbi_questions_band ON lbi_questions(age_band_code)`,

  // ─── Add domain_codes mapping column to lbi_modules ───
  `ALTER TABLE lbi_modules ADD COLUMN IF NOT EXISTS domain_codes TEXT[] DEFAULT '{}'`,

  // ─── Seed LBI Domains ───
  `INSERT INTO lbi_domains (domain_code, domain_name, description, sort_order) VALUES
    ('ACE',  'Academic & Cognitive Efficiency',              'Measures learning efficiency, cognitive performance, and academic output',           1),
    ('TQP',  'Thinking Quality Profiling',                  'Evaluates quality of reasoning, analytical depth, and cognitive style',              2),
    ('ESER', 'Emotional Self-Expression & Regulation',      'Measures emotional awareness, expression, and self-regulation ability',              3),
    ('CSCC', 'Communicating, Socializing & Conflict Coping','Assesses communication quality, social skills, and conflict resolution capability',  4),
    ('ACC',  'Academic & Cognitive Challenge',              'Identifies academic challenge areas and cognitive difficulty patterns',               5),
    ('SEI',  'Social & Emotional Intelligence',             'Comprehensive social and emotional intelligence measurement',                         6),
    ('DHC',  'Discipline, Habits & Commitment',             'Evaluates self-discipline, daily habits, and commitment to goals',                   7),
    ('CE',   'Communication Effectiveness',                 'Measures clarity, confidence, and effectiveness of communication',                   8),
    ('MVR',  'Motivation, Values & Resilience',             'Assesses intrinsic motivation, personal values, and resilience capacity',            9),
    ('LPE',  'Lifestyle, Pressures & Environment',          'Identifies lifestyle factors, environmental stressors, and pressure sources',        10),
    ('CER',  'Cognitive Efficiency & Readiness',            'Measures cognitive readiness, processing speed, and mental efficiency',              11),
    ('IRCM', 'Interpersonal Relations & Conflict Management','Assesses quality of interpersonal relationships and conflict management skills',    12),
    ('APRI', 'Academic Performance & Readiness Index',      'Comprehensive index of academic performance and exam readiness',                     13),
    ('MSR',  'Mindset & Self-Regulation',                   'Evaluates growth mindset, self-regulation, and goal-directed behavior',              14),
    ('HSSU', 'Health, Sleep, Stress & Utility',             'Assesses health habits, sleep quality, stress levels, and coping utility',           15),
    ('AIM',  'Adaptability & Integrity Management',         'Measures adaptability to change and integrity in personal conduct',                  16),
    ('TCA',  'Time & Commitment Administration',             'Evaluates time management, planning, and commitment follow-through',                 17),
    ('TSIS', 'Trust, Security & Identity Stability',        'Assesses sense of trust, psychological security, and identity stability',            18),
    ('OCR',  'Optimism, Courage & Resilience',              'Measures positive outlook, courageous action, and resilience under adversity',       19)
   ON CONFLICT (domain_code) DO NOTHING`,

  // ─── Seed LBI Age Bands ───
  `INSERT INTO lbi_age_bands (band_code, label, age_min, age_max, sort_order) VALUES
    ('A',  'Primary (6-10)',      6,  10, 1),
    ('B',  'Middle (11-14)',     11,  14, 2),
    ('C',  'Secondary (15-18)', 15,  18, 3),
    ('D',  'Senior (18-21)',     18,  21, 4),
    ('E',  'Young Adult (21-25)',21,  25, 5),
    ('E1', 'Adult (22-30)',      22,  30, 6)
   ON CONFLICT (band_code) DO NOTHING`,

  // ─── Mentor profile extended columns ───
  `ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS performance_health_index INTEGER DEFAULT 100`,
  `ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS warning_reason       TEXT`,
  `ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS warning_issued_at    TIMESTAMPTZ`,
  `ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS suspension_reason    TEXT`,
  `ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS activated_at         TIMESTAMPTZ`,
  `ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS phone                VARCHAR(20)`,
  `ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS specialization       TEXT`,
  `ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS qualifications       TEXT`,

  // ─── HR Jobs ───
  `CREATE TABLE IF NOT EXISTS hr_jobs (
    id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title                 VARCHAR(255) NOT NULL,
    role_category         VARCHAR(100) NOT NULL DEFAULT 'mentor',
    employment_type       VARCHAR(50)  NOT NULL DEFAULT 'part-time',
    work_mode             VARCHAR(50)  NOT NULL DEFAULT 'remote',
    city                  VARCHAR(100),
    location              VARCHAR(255),
    salary                VARCHAR(100),
    benefits              TEXT,
    poster_image          TEXT,
    description           TEXT,
    eligibility           TEXT,
    qualifications        TEXT,
    responsibilities      TEXT,
    kpis                  TEXT,
    compensation_model    TEXT,
    post_to_linkedin      BOOLEAN DEFAULT FALSE,
    post_to_indeed        BOOLEAN DEFAULT FALSE,
    post_to_naukri        BOOLEAN DEFAULT FALSE,
    post_to_facebook      BOOLEAN DEFAULT FALSE,
    post_to_whatsapp      BOOLEAN DEFAULT FALSE,
    post_to_instagram     BOOLEAN DEFAULT FALSE,
    post_to_twitter       BOOLEAN DEFAULT FALSE,
    post_to_careers       BOOLEAN DEFAULT TRUE,
    status                VARCHAR(50)  NOT NULL DEFAULT 'draft',
    published_at          TIMESTAMPTZ,
    closed_at             TIMESTAMPTZ,
    hr_review_at          TIMESTAMPTZ,
    legal_review_at       TIMESTAMPTZ,
    leadership_approval_at TIMESTAMPTZ,
    reject_reason         TEXT,
    created_by            TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_hr_jobs_status ON hr_jobs(status)`,
  // Add columns to existing hr_jobs tables
  `ALTER TABLE hr_jobs ADD COLUMN IF NOT EXISTS location          VARCHAR(255)`,
  `ALTER TABLE hr_jobs ADD COLUMN IF NOT EXISTS salary            VARCHAR(100)`,
  `ALTER TABLE hr_jobs ADD COLUMN IF NOT EXISTS benefits          TEXT`,
  `ALTER TABLE hr_jobs ADD COLUMN IF NOT EXISTS poster_image      TEXT`,
  `ALTER TABLE hr_jobs ADD COLUMN IF NOT EXISTS post_to_linkedin  BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE hr_jobs ADD COLUMN IF NOT EXISTS post_to_indeed    BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE hr_jobs ADD COLUMN IF NOT EXISTS post_to_naukri    BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE hr_jobs ADD COLUMN IF NOT EXISTS post_to_facebook  BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE hr_jobs ADD COLUMN IF NOT EXISTS post_to_whatsapp  BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE hr_jobs ADD COLUMN IF NOT EXISTS post_to_instagram BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE hr_jobs ADD COLUMN IF NOT EXISTS post_to_twitter   BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE hr_jobs ADD COLUMN IF NOT EXISTS post_to_careers   BOOLEAN DEFAULT TRUE`,

  // ─── HR Applications ───
  `CREATE TABLE IF NOT EXISTS hr_applications (
    id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    job_id               TEXT REFERENCES hr_jobs(id) ON DELETE CASCADE,
    full_name            VARCHAR(255) NOT NULL,
    email                VARCHAR(255) NOT NULL,
    phone                VARCHAR(20),
    cover_letter         TEXT,
    resume_url           TEXT,
    source_channel       VARCHAR(50)  DEFAULT 'direct',
    consent_captured     BOOLEAN      NOT NULL DEFAULT TRUE,
    status               VARCHAR(50)  NOT NULL DEFAULT 'applied',
    rejection_reason     TEXT,
    processed_at         TIMESTAMPTZ,
    membership_paid_at   TIMESTAMPTZ,
    user_id              TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_hr_applications_job    ON hr_applications(job_id)`,
  `CREATE INDEX IF NOT EXISTS idx_hr_applications_status ON hr_applications(status)`,

  // ─── Mentor KPIs ───
  `CREATE TABLE IF NOT EXISTS mentor_kpis (
    id                       SERIAL PRIMARY KEY,
    mentor_id                TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_start             DATE NOT NULL,
    period_end               DATE NOT NULL,
    student_satisfaction     NUMERIC(5,2) DEFAULT 0,
    session_completion_rate  NUMERIC(5,2) DEFAULT 0,
    outcome_improvement      NUMERIC(5,2) DEFAULT 0,
    compliance_adherence     NUMERIC(5,2) DEFAULT 0,
    alert_level              VARCHAR(20)  DEFAULT 'none',
    created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_mentor_kpis_mentor ON mentor_kpis(mentor_id)`,

  // ─── Mentor Tasks ───
  `CREATE TABLE IF NOT EXISTS mentor_tasks (
    id             SERIAL PRIMARY KEY,
    mentor_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title          VARCHAR(255) NOT NULL,
    task_type      VARCHAR(50)  DEFAULT 'general',
    description    TEXT,
    status         VARCHAR(50)  NOT NULL DEFAULT 'pending',
    scheduled_date DATE,
    completed_at   TIMESTAMPTZ,
    assigned_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_mentor_tasks_mentor ON mentor_tasks(mentor_id)`,

  // ─── Mentor Payouts ───
  `CREATE TABLE IF NOT EXISTS mentor_payouts (
    id               SERIAL PRIMARY KEY,
    mentor_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_start     DATE NOT NULL,
    period_end       DATE NOT NULL,
    gross_revenue    NUMERIC(12,2) DEFAULT 0,
    commission_rate  NUMERIC(4,3)  DEFAULT 0.2,
    deductions       NUMERIC(12,2) DEFAULT 0,
    net_payout       NUMERIC(12,2) DEFAULT 0,
    status           VARCHAR(50)   NOT NULL DEFAULT 'pending',
    processed_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_mentor_payouts_mentor ON mentor_payouts(mentor_id)`,

  // ─── Mentor Violations ───
  `CREATE TABLE IF NOT EXISTS mentor_violations (
    id              SERIAL PRIMARY KEY,
    mentor_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    violation_type  VARCHAR(100) NOT NULL,
    severity        VARCHAR(20)  NOT NULL DEFAULT 'minor',
    description     TEXT,
    status          VARCHAR(50)  NOT NULL DEFAULT 'open',
    resolution      TEXT,
    reported_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ
  )`,
  `CREATE INDEX IF NOT EXISTS idx_mentor_violations_mentor ON mentor_violations(mentor_id)`,

  // ─── Update lbi_modules with domain_codes mapping ───
  `UPDATE lbi_modules SET domain_codes = '{ACE,CER,APRI,ACC}' WHERE module_code = 'ACE' AND (domain_codes IS NULL OR domain_codes = '{}')`,
  `UPDATE lbi_modules SET domain_codes = '{TQP,MSR}'          WHERE module_code = 'ANT' AND (domain_codes IS NULL OR domain_codes = '{}')`,
  `UPDATE lbi_modules SET domain_codes = '{SEI,ESER,IRCM,TSIS}' WHERE module_code = 'SEI' AND (domain_codes IS NULL OR domain_codes = '{}')`,
  `UPDATE lbi_modules SET domain_codes = '{CSCC,AIM}'         WHERE module_code = 'ADJ' AND (domain_codes IS NULL OR domain_codes = '{}')`,
  `UPDATE lbi_modules SET domain_codes = '{DHC,TCA}'          WHERE module_code = 'DIS' AND (domain_codes IS NULL OR domain_codes = '{}')`,
  `UPDATE lbi_modules SET domain_codes = '{CE}'               WHERE module_code = 'COM' AND (domain_codes IS NULL OR domain_codes = '{}')`,
  `UPDATE lbi_modules SET domain_codes = '{MVR,OCR}'          WHERE module_code = 'DRI' AND (domain_codes IS NULL OR domain_codes = '{}')`,
  `UPDATE lbi_modules SET domain_codes = '{LPE,HSSU}'         WHERE module_code = 'STP' AND (domain_codes IS NULL OR domain_codes = '{}')`,

  // ─── Seed LBI Modules ───
  `INSERT INTO lbi_modules (module_code, module_name, description, icon_key, color, sort_order, sub_modules) VALUES
    ('ACE', 'Academic & Cognitive', 'Measures learning efficiency, memory, and attention', 'Lightbulb', '#f59e0b', 1,
     '[{"code":"ACE_SD01","name":"Learning Efficiency","questionType":"likert","questions":[{"id":"ACE_SD01_Q1","text":"I understand new concepts quickly when they are explained to me."},{"id":"ACE_SD01_Q2","text":"I can apply what I learn in class to real-life problems."},{"id":"ACE_SD01_Q3","text":"I review my notes regularly to reinforce what I have learned."}]},{"code":"ACE_SD02","name":"Memory Retention","questionType":"likert","questions":[{"id":"ACE_SD02_Q1","text":"I can recall important details from lessons I studied a week ago."},{"id":"ACE_SD02_Q2","text":"I use memory techniques like mnemonics or visualization to remember information."},{"id":"ACE_SD02_Q3","text":"I tend to forget things under pressure or during exams."}]},{"code":"ACE_SD03","name":"Attention & Focus","questionType":"likert","questions":[{"id":"ACE_SD03_Q1","text":"I can concentrate on a task for an extended period without getting distracted."},{"id":"ACE_SD03_Q2","text":"I struggle to stay focused when studying in a noisy environment."},{"id":"ACE_SD03_Q3","text":"I notice when my mind wanders and bring myself back to the task."}]}]'::jsonb),
    ('ANT', 'Analytical Thinking', 'Evaluates critical thinking and decision-making abilities', 'Target', '#3b82f6', 2,
     '[{"code":"ANT_SD01","name":"Critical Thinking","questionType":"likert","questions":[{"id":"ANT_SD01_Q1","text":"I question assumptions before accepting information as true."},{"id":"ANT_SD01_Q2","text":"I can identify logical flaws in arguments presented to me."},{"id":"ANT_SD01_Q3","text":"I look at a problem from multiple angles before drawing a conclusion."}]},{"code":"ANT_SD02","name":"Decision Making","questionType":"likert","questions":[{"id":"ANT_SD02_Q1","text":"I weigh the pros and cons carefully before making important decisions."},{"id":"ANT_SD02_Q2","text":"I feel confident in the decisions I make under pressure."},{"id":"ANT_SD02_Q3","text":"I learn from past decisions to improve future ones."}]}]'::jsonb),
    ('SEI', 'Social & Emotional', 'Assesses emotional intelligence, relationships, and trust', 'Heart', '#ec4899', 3,
     '[{"code":"SEI_SD01","name":"Emotional Intelligence","questionType":"likert","questions":[{"id":"SEI_SD01_Q1","text":"I can identify my emotions and understand why I feel a certain way."},{"id":"SEI_SD01_Q2","text":"I manage my emotions well even in stressful situations."},{"id":"SEI_SD01_Q3","text":"I empathize with others when they are going through difficulties."}]},{"code":"SEI_SD02","name":"Relationships","questionType":"likert","questions":[{"id":"SEI_SD02_Q1","text":"I maintain healthy and positive relationships with my peers."},{"id":"SEI_SD02_Q2","text":"I resolve conflicts with others calmly and constructively."},{"id":"SEI_SD02_Q3","text":"I feel supported by the people around me."}]},{"code":"SEI_SD03","name":"Trust","questionType":"likert","questions":[{"id":"SEI_SD03_Q1","text":"I trust the people who are close to me."},{"id":"SEI_SD03_Q2","text":"I find it easy to open up to others about my feelings."},{"id":"SEI_SD03_Q3","text":"I believe others trust and rely on me."}]}]'::jsonb),
    ('ADJ', 'Adjustment', 'Examines academic, social, and family adjustment patterns', 'Users', '#10b981', 4,
     '[{"code":"ADJ_SD01","name":"Academic Adjustment","questionType":"likert","questions":[{"id":"ADJ_SD01_Q1","text":"I adapt well to new teachers, subjects, or academic changes."},{"id":"ADJ_SD01_Q2","text":"I manage the academic pressure at school effectively."},{"id":"ADJ_SD01_Q3","text":"I feel comfortable asking for help when I do not understand something."}]},{"code":"ADJ_SD02","name":"Social Adjustment","questionType":"likert","questions":[{"id":"ADJ_SD02_Q1","text":"I fit in well with different groups of people."},{"id":"ADJ_SD02_Q2","text":"I handle peer pressure without compromising my values."},{"id":"ADJ_SD02_Q3","text":"I feel socially included in my school or community."}]},{"code":"ADJ_SD03","name":"Family Adjustment","questionType":"likert","questions":[{"id":"ADJ_SD03_Q1","text":"I feel emotionally supported by my family."},{"id":"ADJ_SD03_Q2","text":"Family conflicts do not significantly affect my academic performance."},{"id":"ADJ_SD03_Q3","text":"I communicate openly with my family about my challenges."}]}]'::jsonb),
    ('DIS', 'Discipline', 'Measures time management and accountability', 'Clock', '#06b6d4', 5,
     '[{"code":"DIS_SD01","name":"Time Management","questionType":"likert","questions":[{"id":"DIS_SD01_Q1","text":"I complete my assignments before the deadline."},{"id":"DIS_SD01_Q2","text":"I plan my study schedule and follow it consistently."},{"id":"DIS_SD01_Q3","text":"I prioritize tasks based on their importance and urgency."}]},{"code":"DIS_SD02","name":"Accountability","questionType":"likert","questions":[{"id":"DIS_SD02_Q1","text":"I take responsibility for my mistakes and learn from them."},{"id":"DIS_SD02_Q2","text":"I follow through on my commitments to others."},{"id":"DIS_SD02_Q3","text":"I hold myself to a high standard of conduct even when no one is watching."}]}]'::jsonb),
    ('COM', 'Communication', 'Evaluates listening and expression skills', 'MessageSquare', '#f97316', 6,
     '[{"code":"COM_SD01","name":"Listening Skills","questionType":"likert","questions":[{"id":"COM_SD01_Q1","text":"I listen attentively without interrupting when others are speaking."},{"id":"COM_SD01_Q2","text":"I ask clarifying questions to make sure I understand correctly."},{"id":"COM_SD01_Q3","text":"I remember important details from conversations."}]},{"code":"COM_SD02","name":"Expression Skills","questionType":"likert","questions":[{"id":"COM_SD02_Q1","text":"I express my thoughts clearly and confidently in group settings."},{"id":"COM_SD02_Q2","text":"I adapt my communication style based on who I am speaking with."},{"id":"COM_SD02_Q3","text":"I find it easy to put my feelings and ideas into words."}]}]'::jsonb),
    ('DRI', 'Drive & Integrity', 'Assesses commitment, persistence, and integrity', 'Flame', '#ef4444', 7,
     '[{"code":"DRI_SD01","name":"Commitment","questionType":"likert","questions":[{"id":"DRI_SD01_Q1","text":"I set ambitious goals and work consistently toward achieving them."},{"id":"DRI_SD01_Q2","text":"I remain dedicated to my studies even when I feel unmotivated."},{"id":"DRI_SD01_Q3","text":"I follow through on long-term projects without giving up."}]},{"code":"DRI_SD02","name":"Persistence","questionType":"likert","questions":[{"id":"DRI_SD02_Q1","text":"I bounce back quickly after experiencing failure or setback."},{"id":"DRI_SD02_Q2","text":"I keep trying different approaches until I solve a problem."},{"id":"DRI_SD02_Q3","text":"Challenges motivate me to work harder rather than give up."}]}]'::jsonb),
    ('STP', 'Stress & Pressures', 'Identifies digital, sleep, and external stress factors', 'AlertTriangle', '#eab308', 8,
     '[{"code":"STP_SD01","name":"Digital Stress","questionType":"likert","questions":[{"id":"STP_SD01_Q1","text":"I feel anxious when I cannot access my phone or social media."},{"id":"STP_SD01_Q2","text":"Digital distractions make it difficult for me to concentrate on studies."},{"id":"STP_SD01_Q3","text":"I can manage my screen time and set healthy digital boundaries."}]},{"code":"STP_SD02","name":"Sleep Quality","questionType":"likert","questions":[{"id":"STP_SD02_Q1","text":"I get enough sleep most nights and wake up feeling rested."},{"id":"STP_SD02_Q2","text":"I have a consistent bedtime routine that helps me sleep well."},{"id":"STP_SD02_Q3","text":"Poor sleep affects my mood and performance the next day."}]},{"code":"STP_SD03","name":"External Pressure","questionType":"likert","questions":[{"id":"STP_SD03_Q1","text":"I feel overwhelmed by the expectations others have of me."},{"id":"STP_SD03_Q2","text":"I handle pressure from parents, teachers, or peers in a healthy way."},{"id":"STP_SD03_Q3","text":"External stress from home or school affects my ability to perform."}]}]'::jsonb)
   ON CONFLICT (module_code) DO NOTHING`,

  // ─── Onboarding Requests ───
  `CREATE TABLE IF NOT EXISTS onboarding_requests (
    id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    entity_type         VARCHAR(30) NOT NULL CHECK (entity_type IN ('institute','parent','mentor','ngo','lei')),
    entity_name         VARCHAR(255) NOT NULL,
    entity_email        VARCHAR(255) NOT NULL,
    entity_phone        VARCHAR(20),
    entity_id           VARCHAR(100),
    organization_name   VARCHAR(255),
    address             TEXT,
    city                VARCHAR(100),
    state               VARCHAR(100),
    pincode             VARCHAR(10),
    website             VARCHAR(255),
    registration_number VARCHAR(100),
    pan_number          VARCHAR(20),
    gst_number          VARCHAR(20),
    contact_person      VARCHAR(255),
    contact_designation VARCHAR(100),
    description         TEXT,
    documents_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    kyc_verified        BOOLEAN NOT NULL DEFAULT FALSE,
    status              VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','under_review','approved','rejected','suspended')),
    review_notes        TEXT,
    rejection_reason    TEXT,
    reviewed_by         TEXT REFERENCES users(id),
    reviewed_at         TIMESTAMPTZ,
    approved_at         TIMESTAMPTZ,
    submitted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_onboarding_status ON onboarding_requests(status)`,
  `CREATE INDEX IF NOT EXISTS idx_onboarding_type   ON onboarding_requests(entity_type)`,
  `CREATE INDEX IF NOT EXISTS idx_onboarding_email  ON onboarding_requests(entity_email)`,

  // ─── KYC Documents ───
  `CREATE TABLE IF NOT EXISTS kyc_documents (
    id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    onboarding_id        TEXT NOT NULL REFERENCES onboarding_requests(id) ON DELETE CASCADE,
    entity_type          VARCHAR(30) NOT NULL,
    entity_name          VARCHAR(255) NOT NULL,
    document_type        VARCHAR(50) NOT NULL,
    document_number      VARCHAR(100),
    file_url             TEXT,
    status               VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','maker_verified','approved','rejected')),
    maker_verified_by    TEXT REFERENCES users(id),
    maker_verified_at    TIMESTAMPTZ,
    maker_notes          TEXT,
    checker_verified_by  TEXT REFERENCES users(id),
    checker_verified_at  TIMESTAMPTZ,
    checker_notes        TEXT,
    rejected_by          TEXT REFERENCES users(id),
    rejected_at          TIMESTAMPTZ,
    rejection_reason     TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_kyc_onboarding ON kyc_documents(onboarding_id)`,
  `CREATE INDEX IF NOT EXISTS idx_kyc_status     ON kyc_documents(status)`,

  // ─── Onboarding History (audit trail) ───
  `CREATE TABLE IF NOT EXISTS onboarding_history (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    onboarding_id   TEXT NOT NULL REFERENCES onboarding_requests(id) ON DELETE CASCADE,
    action          VARCHAR(50) NOT NULL,
    performed_by    TEXT REFERENCES users(id),
    performed_by_name VARCHAR(255),
    notes           TEXT,
    old_status      VARCHAR(20),
    new_status      VARCHAR(20),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_onboarding_history ON onboarding_history(onboarding_id)`,

  // ─── Student Enrollments ───
  `CREATE TABLE IF NOT EXISTS student_enrollments (
    id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    student_name     VARCHAR(255) NOT NULL,
    student_email    VARCHAR(255),
    student_phone    VARCHAR(20),
    parent_name      VARCHAR(255),
    parent_email     VARCHAR(255),
    institute_name   VARCHAR(255),
    grade            VARCHAR(20),
    board            VARCHAR(50),
    enrollment_date  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payment_status   VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','refunded')),
    plan_type        VARCHAR(50),
    amount           NUMERIC(10,2),
    user_id          TEXT REFERENCES users(id),
    notes            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_enrollments_user    ON student_enrollments(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_enrollments_payment ON student_enrollments(payment_status)`,

  // ─── Document Upload Tokens ───
  `CREATE TABLE IF NOT EXISTS document_upload_tokens (
    id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    onboarding_id  TEXT NOT NULL REFERENCES onboarding_requests(id) ON DELETE CASCADE,
    token          TEXT UNIQUE NOT NULL,
    requested_docs JSONB NOT NULL DEFAULT '[]',
    custom_message TEXT,
    expires_at     TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    used_at        TIMESTAMPTZ
  )`,
  `CREATE INDEX IF NOT EXISTS idx_upload_tokens_onboarding ON document_upload_tokens(onboarding_id)`,
  `CREATE INDEX IF NOT EXISTS idx_upload_tokens_token      ON document_upload_tokens(token)`,

  // ─── Student Subscriptions extra columns ───
  `ALTER TABLE student_subscriptions ADD COLUMN IF NOT EXISTS institution_id TEXT`,
  `ALTER TABLE student_subscriptions ADD COLUMN IF NOT EXISTS notes TEXT`,
  `ALTER TABLE student_subscriptions ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ`,
  `ALTER TABLE student_subscriptions ADD COLUMN IF NOT EXISTS target_age_band TEXT`,
  `ALTER TABLE student_subscriptions ADD COLUMN IF NOT EXISTS assigned_by TEXT`,
  `ALTER TABLE student_subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ`,

  // ─── Subscription packages — status, sections, report config ───
  `ALTER TABLE subscription_packages ADD COLUMN IF NOT EXISTS pkg_status TEXT NOT NULL DEFAULT 'draft'`,
  `ALTER TABLE subscription_packages ADD COLUMN IF NOT EXISTS frontend_sections TEXT[] DEFAULT '{}'`,
  `ALTER TABLE subscription_packages ADD COLUMN IF NOT EXISTS report_config JSONB DEFAULT '{}'`,
  `UPDATE subscription_packages SET category = '' WHERE category IS NOT NULL`,

  // ─── Subscription packages — pricing & module linking extensions ───
  `ALTER TABLE subscription_packages ADD COLUMN IF NOT EXISTS custom_module_id TEXT`,
  `ALTER TABLE subscription_packages ADD COLUMN IF NOT EXISTS original_price REAL`,
  `ALTER TABLE subscription_packages ADD COLUMN IF NOT EXISTS discount_pct REAL`,
  `ALTER TABLE subscription_packages ADD COLUMN IF NOT EXISTS offer_label TEXT`,
  `ALTER TABLE subscription_packages ADD COLUMN IF NOT EXISTS coupon_code TEXT`,
  `ALTER TABLE subscription_packages ADD COLUMN IF NOT EXISTS coupon_discount_pct REAL`,
  `ALTER TABLE subscription_packages ADD COLUMN IF NOT EXISTS trial_days INTEGER`,
  `ALTER TABLE subscription_packages ADD COLUMN IF NOT EXISTS highlights TEXT[] DEFAULT '{}'`,

  // ─── Subscription packages — subcategory ───
  `ALTER TABLE subscription_packages ADD COLUMN IF NOT EXISTS subcategory TEXT NOT NULL DEFAULT ''`,

  // ─── Custom Assessment Modules (must be before ALTER) ───
  `CREATE TABLE IF NOT EXISTS custom_assessment_modules (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    module_name     VARCHAR(255) NOT NULL,
    description     TEXT,
    domain_codes    TEXT[] DEFAULT '{}',
    age_band_codes  TEXT[] DEFAULT '{}',
    question_count  INTEGER DEFAULT 0,
    package_ids     TEXT[] DEFAULT '{}',
    created_by      TEXT REFERENCES users(id),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_custom_modules_active ON custom_assessment_modules(is_active)`,

  // ─── Custom assessment modules — category & subcategory ───
  `ALTER TABLE custom_assessment_modules ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE custom_assessment_modules ADD COLUMN IF NOT EXISTS subcategory TEXT NOT NULL DEFAULT ''`,

  // ─── Custom Module Sessions ───
  `CREATE TABLE IF NOT EXISTS custom_module_sessions (
    id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    respondent_id    TEXT NOT NULL,
    custom_module_id INTEGER NOT NULL,
    package_id       TEXT,
    status           TEXT NOT NULL DEFAULT 'in_progress',
    drawn_questions  JSONB NOT NULL DEFAULT '[]',
    responses        JSONB NOT NULL DEFAULT '{}',
    attempt_number   INTEGER NOT NULL DEFAULT 1,
    started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at     TIMESTAMPTZ,
    time_spent_seconds INTEGER,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_cms_respondent ON custom_module_sessions(respondent_id)`,
  `CREATE INDEX IF NOT EXISTS idx_cms_module     ON custom_module_sessions(custom_module_id)`,

  // ─── Mentor Onboarding Pipeline Columns ───────────────────────────────────
  `ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS onboarding_stage       VARCHAR(50)  DEFAULT 'application'`,
  `ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS training_started_at    TIMESTAMPTZ`,
  `ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS training_completed_at  TIMESTAMPTZ`,
  `ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS assessment_completed_at TIMESTAMPTZ`,
  `ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS temp_code              VARCHAR(20)`,
  `ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS temp_code_generated_at TIMESTAMPTZ`,
  `ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS kyc_status             VARCHAR(20)  DEFAULT 'pending'`,
  `ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS kyc_submitted_at       TIMESTAMPTZ`,
  `ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS kyc_verified_at        TIMESTAMPTZ`,
  `ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS profiler_status        VARCHAR(20)  DEFAULT 'pending'`,
  `ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS profiler_completed_at  TIMESTAMPTZ`,
  `ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS delivery_link          TEXT`,

  // ─── Mentor KYC Documents Table ───────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS mentor_kyc_documents (
    id               SERIAL PRIMARY KEY,
    mentor_profile_id INTEGER NOT NULL REFERENCES mentor_profiles(id) ON DELETE CASCADE,
    document_type    VARCHAR(100) NOT NULL,
    document_name    VARCHAR(255) NOT NULL,
    file_url         TEXT,
    status           VARCHAR(20) NOT NULL DEFAULT 'submitted',
    verified_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
    verified_at      TIMESTAMPTZ,
    notes            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_mentor_kyc_profile ON mentor_kyc_documents(mentor_profile_id)`,
  `CREATE INDEX IF NOT EXISTS idx_mentor_kyc_status  ON mentor_kyc_documents(status)`,

  // ─── Mentor Onboarding Notifications Log ─────────────────────────────────
  `CREATE TABLE IF NOT EXISTS mentor_onboarding_notifications (
    id               SERIAL PRIMARY KEY,
    mentor_profile_id INTEGER NOT NULL REFERENCES mentor_profiles(id) ON DELETE CASCADE,
    stage            VARCHAR(50) NOT NULL,
    event_type       VARCHAR(100) NOT NULL,
    message          TEXT NOT NULL,
    sent_to          VARCHAR(255),
    sent_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_mentor_notif_profile ON mentor_onboarding_notifications(mentor_profile_id)`,

  // ─── Notification Scenarios (automation rules) ────────────────────────────
  `CREATE TABLE IF NOT EXISTS notification_scenarios (
    id               SERIAL PRIMARY KEY,
    name             VARCHAR(255) NOT NULL,
    description      TEXT,
    event_trigger    VARCHAR(100) NOT NULL,
    condition_json   JSONB        NOT NULL DEFAULT '{}',
    template_id      INTEGER REFERENCES notification_templates(id) ON DELETE SET NULL,
    delay_minutes    INTEGER      NOT NULL DEFAULT 0,
    channels         JSONB        NOT NULL DEFAULT '["in_app","email"]',
    target_role      VARCHAR(50),
    variables_map    JSONB        NOT NULL DEFAULT '{}',
    is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
    execution_count  INTEGER      NOT NULL DEFAULT 0,
    last_executed_at TIMESTAMPTZ,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_notif_scenario_trigger ON notification_scenarios(event_trigger, is_active)`,

  // ─── Scheduled notification jobs ─────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS notification_scheduled_jobs (
    id           SERIAL PRIMARY KEY,
    scenario_id  INTEGER REFERENCES notification_scenarios(id) ON DELETE SET NULL,
    template_id  INTEGER REFERENCES notification_templates(id) ON DELETE SET NULL,
    recipient_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    variables    JSONB       NOT NULL DEFAULT '{}',
    channels     JSONB       NOT NULL DEFAULT '["in_app","email"]',
    context      JSONB       NOT NULL DEFAULT '{}',
    status       VARCHAR(20) NOT NULL DEFAULT 'pending',
    scheduled_at TIMESTAMPTZ NOT NULL,
    sent_at      TIMESTAMPTZ,
    error_message TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sched_job_status ON notification_scheduled_jobs(status, scheduled_at)`,
  `CREATE INDEX IF NOT EXISTS idx_sched_job_recipient ON notification_scheduled_jobs(recipient_id)`,

  // ─── Seed default scenarios ───────────────────────────────────────────────
  `INSERT INTO notification_scenarios
     (name, description, event_trigger, condition_json, template_id, delay_minutes, channels, target_role, variables_map, is_active)
   VALUES
     ('Mentor Training Started',       'Notify mentor when training programme begins',       'mentor.stage_advanced', '{"stage":"training"}',           9,  0,   '["in_app","email"]', 'mentor',  '{"mentorName":"displayName"}',            TRUE),
     ('Mentor Temp Code Issued',       'Notify mentor when temp code is generated',          'mentor.stage_advanced', '{"stage":"temp_code_generated"}',9,  0,   '["in_app","email"]', 'mentor',  '{"mentorName":"displayName"}',            TRUE),
     ('Mentor KYC Upload Requested',   'Prompt mentor to upload KYC documents',              'mentor.stage_advanced', '{"stage":"kyc_upload"}',         8,  0,   '["in_app","email"]', 'mentor',  '{"percent":"0"}',                         TRUE),
     ('Mentor Profiler Stage',         'Prompt mentor to complete detailed profiler',        'mentor.stage_advanced', '{"stage":"profiler"}',           8,  0,   '["in_app","email"]', 'mentor',  '{"percent":"50"}',                        TRUE),
     ('Mentor Fully Activated',        'Welcome notification when mentor is fully active',   'mentor.stage_advanced', '{"stage":"activated"}',          7,  0,   '["in_app","email"]', 'mentor',  '{"name":"displayName"}',                  TRUE),
     ('Session Booked — Student',      'Notify student when session is booked',              'booking.created',       '{}',                             46, 0,   '["in_app","email"]', 'student', '{"mentorName":"mentorName","date":"date","time":"time"}', TRUE),
     ('Session Booked — Mentor',       'Notify mentor when a session is booked',             'booking.created',       '{}',                             46, 0,   '["in_app","email"]', 'mentor',  '{"mentorName":"studentName","date":"date","time":"time"}', TRUE),
     ('Session Reminder 24h',          'Remind student 24h before session',                  'booking.reminder',      '{"hoursUntil":24}',              47, 0,   '["in_app","email"]', 'student', '{"mentorName":"mentorName","timeLeft":"24 hours"}',       TRUE),
     ('Session Reminder 1h',           'Remind student 1h before session',                   'booking.reminder',      '{"hoursUntil":1}',               47, 0,   '["in_app"]',         'student', '{"mentorName":"mentorName","timeLeft":"1 hour"}',         TRUE),
     ('New User Welcome',              'Welcome on-screen notification for all new users',   'user.registered',       '{}',                             7,  0,   '["in_app"]',         NULL,      '{"name":"fullName"}',                     TRUE),
     ('Subscription Expiry — 7 Days',  'Alert user 7 days before subscription expires',      'subscription.expiring', '{"daysLeft":7}',                 12, 0,   '["in_app","email"]', NULL,      '{"endDate":"expiresAt"}',                 TRUE),
     ('KYC Document Submitted',        'Notify admin when mentor submits KYC docs',          'mentor.kyc_submitted',  '{}',                             8,  0,   '["in_app"]',         'admin',   '{"percent":"80"}',                        TRUE)
   ON CONFLICT DO NOTHING`,

  // ── Platform UIDs ─────────────────────────────────────────
  `CREATE SEQUENCE IF NOT EXISTS parent_uid_seq START 1 INCREMENT 1`,
  `CREATE SEQUENCE IF NOT EXISTS student_uid_seq START 1 INCREMENT 1`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS platform_id VARCHAR(20) UNIQUE`,
  `ALTER TABLE children ADD COLUMN IF NOT EXISTS platform_id VARCHAR(20) UNIQUE`,

  // ── Parent KYC ────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS parent_kyc (
    id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    parent_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50),
    id_type           VARCHAR(50),
    id_number         VARCHAR(100),
    full_legal_name   VARCHAR(200),
    date_of_birth     DATE,
    kyc_status        VARCHAR(20) NOT NULL DEFAULT 'pending',
    submitted_at      TIMESTAMPTZ,
    verified_at       TIMESTAMPTZ,
    verified_by       TEXT REFERENCES users(id),
    rejection_reason  TEXT,
    admin_notes       TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(parent_id)
  )`,

  // ── Parent KYC notification templates ─────────────────────
  `INSERT INTO notification_templates (id, category, title, body_template, type, priority, roles, variables, is_active)
   VALUES
     (60, 'verification', 'Complete Your KYC Verification',
      'Hi {{name}}, to protect your child''s data under DPDP Act 2023, please complete your KYC verification by submitting a valid government ID and confirming your relationship to the child.',
      'fya', 'high', '["parent"]', '{"name":"fullName"}', TRUE),
     (61, 'verification', 'KYC Verified — Account Unlocked',
      'Hi {{name}}, your identity has been verified. Your account now has full access to all MetryxOne features.',
      'fyi', 'normal', '["parent"]', '{"name":"fullName"}', TRUE),
     (62, 'verification', 'KYC Rejected — Action Required',
      'Hi {{name}}, your KYC submission could not be verified. Reason: {{reason}}. Please re-submit with the correct documents.',
      'fya', 'urgent', '["parent"]', '{"name":"fullName","reason":"rejectionReason"}', TRUE),
     (63, 'registration', 'New Parent Registered',
      'A new parent/guardian has registered: {{parentName}} ({{parentEmail}}). KYC verification is pending.',
      'fyi', 'normal', '["super_admin","admin"]', '{"parentName":"fullName","parentEmail":"email"}', TRUE)
   ON CONFLICT (id) DO NOTHING`,

  // Adult learner support — make parent_id nullable (standalone learners have no parent)
  `ALTER TABLE children ALTER COLUMN parent_id DROP NOT NULL`,
  `ALTER TABLE wellness_checkins ALTER COLUMN parent_id DROP NOT NULL`,

  // ─── Institutions ───
  `CREATE TABLE IF NOT EXISTS institutions (
    id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id             TEXT REFERENCES users(id),
    institution_type    VARCHAR(20) NOT NULL DEFAULT 'school',
    institution_code    VARCHAR(30),
    name                VARCHAR(255) NOT NULL,
    email               VARCHAR(255),
    phone               VARCHAR(20),
    website             VARCHAR(255),
    address             TEXT,
    city                VARCHAR(100),
    state               VARCHAR(100),
    pincode             VARCHAR(10),
    country             VARCHAR(100) DEFAULT 'India',
    registration_number VARCHAR(100),
    pan_number          VARCHAR(20),
    gst_number          VARCHAR(20),
    affiliation_board   VARCHAR(100),
    accreditation       VARCHAR(100),
    student_count       INTEGER DEFAULT 0,
    staff_count         INTEGER DEFAULT 0,
    contact_person      VARCHAR(255),
    contact_designation VARCHAR(100),
    contact_email       VARCHAR(255),
    contact_phone       VARCHAR(20),
    description         TEXT,
    status              VARCHAR(30) DEFAULT 'pending',
    kyc_status          VARCHAR(30) DEFAULT 'pending',
    documents_verified  BOOLEAN DEFAULT FALSE,
    notes               TEXT,
    onboarding_request_id TEXT,
    activated_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_institutions_status ON institutions(status)`,
  `CREATE INDEX IF NOT EXISTS idx_institutions_code ON institutions(institution_code)`,

  // ─── Assessment Assignments ───
  `CREATE TABLE IF NOT EXISTS assessment_assignments (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    child_id        TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    template_id     VARCHAR(50) NOT NULL,
    assigned_by     TEXT REFERENCES users(id),
    status          VARCHAR(30) DEFAULT 'assigned',
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_assessment_assignments_child ON assessment_assignments(child_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_assessment_assignments_unique ON assessment_assignments(child_id, template_id)`,

  // (custom_assessment_modules already created above, before ALTER statements)

  // ─── Admin Audit Logs ───
  `CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id              SERIAL PRIMARY KEY,
    admin_id        TEXT REFERENCES users(id),
    action          VARCHAR(100) NOT NULL,
    entity_type     VARCHAR(50),
    entity_id       TEXT,
    details         JSONB DEFAULT '{}',
    ip_address      VARCHAR(45),
    created_at      TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON admin_audit_logs(admin_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON admin_audit_logs(entity_type, entity_id)`,

  // ─── Enrollment KYC ───
  `CREATE TABLE IF NOT EXISTS enrollment_kyc (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    enrollment_id   TEXT NOT NULL REFERENCES student_enrollments(id),
    document_type   VARCHAR(60) NOT NULL,
    submitted_by    VARCHAR(10) NOT NULL DEFAULT 'student',
    file_url        TEXT,
    document_number VARCHAR(100),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    verified_by     TEXT REFERENCES users(id),
    verified_at     TIMESTAMPTZ,
    notes           TEXT,
    rejection_reason TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_enrollment_kyc_child ON enrollment_kyc(enrollment_id)`,

  // ─── Institution Activity Logs ───
  `CREATE TABLE IF NOT EXISTS institution_activity_logs (
    id              SERIAL PRIMARY KEY,
    institution_id  TEXT REFERENCES institutions(id) ON DELETE CASCADE,
    action          VARCHAR(100) NOT NULL,
    details         JSONB DEFAULT '{}',
    performed_by    TEXT REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_inst_activity_inst ON institution_activity_logs(institution_id)`,

  // ─── Notification Broadcasts ───
  `CREATE TABLE IF NOT EXISTS notification_broadcasts (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title           VARCHAR(255) NOT NULL,
    message         TEXT NOT NULL,
    target_roles    TEXT[] DEFAULT '{}',
    target_ids      TEXT[] DEFAULT '{}',
    channels        TEXT[] DEFAULT '{in_app}',
    sent_count      INTEGER DEFAULT 0,
    status          VARCHAR(30) DEFAULT 'draft',
    scheduled_at    TIMESTAMPTZ,
    sent_at         TIMESTAMPTZ,
    created_by      TEXT REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_broadcasts_status ON notification_broadcasts(status)`,

  // ─── Psychometric Questions (assessment_domains-linked) ───
  `CREATE TABLE IF NOT EXISTS psychometric_questions (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    question_code   VARCHAR(80) UNIQUE,
    domain_id       INTEGER REFERENCES assessment_domains(id),
    domain_code     VARCHAR(10) NOT NULL,
    subdomain_id    TEXT REFERENCES assessment_subdomains(id),
    subdomain_code  VARCHAR(50),
    age_band_code   VARCHAR(10) NOT NULL,
    question_type   VARCHAR(30) DEFAULT 'likert',
    question_text   TEXT NOT NULL,
    option_a        TEXT DEFAULT 'Strongly Disagree',
    option_b        TEXT DEFAULT 'Disagree',
    option_c        TEXT DEFAULT 'Neutral',
    option_d        TEXT DEFAULT 'Agree',
    option_e        TEXT DEFAULT 'Strongly Agree',
    option_a_score  INTEGER DEFAULT 1,
    option_b_score  INTEGER DEFAULT 2,
    option_c_score  INTEGER DEFAULT 3,
    option_d_score  INTEGER DEFAULT 4,
    option_e_score  INTEGER DEFAULT 5,
    reverse_scored  BOOLEAN DEFAULT FALSE,
    difficulty      VARCHAR(20) DEFAULT 'medium',
    explanation     TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_psycho_q_domain ON psychometric_questions(domain_code)`,
  `CREATE INDEX IF NOT EXISTS idx_psycho_q_subdomain ON psychometric_questions(subdomain_code)`,
  `CREATE INDEX IF NOT EXISTS idx_psycho_q_ageband ON psychometric_questions(age_band_code)`,

  // ═══════════════════════════════════════════════════════════════
  // ── DYNAMIC SCORING CONFIG SYSTEM ──────────────────────────────
  // ═══════════════════════════════════════════════════════════════

  // Config versions — track publish history
  `CREATE TABLE IF NOT EXISTS scoring_config_versions (
    id              SERIAL PRIMARY KEY,
    version         VARCHAR(20) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'draft',
    notes           TEXT,
    published_by    TEXT REFERENCES users(id),
    published_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Scoring modules — LES, ATT, MEM, CU, STR, EXAM
  `CREATE TABLE IF NOT EXISTS scoring_modules (
    id              SERIAL PRIMARY KEY,
    code            VARCHAR(10) NOT NULL UNIQUE,
    name            VARCHAR(255) NOT NULL,
    formula         TEXT NOT NULL,
    weights         TEXT NOT NULL,
    bands           TEXT NOT NULL,
    color           VARCHAR(10) DEFAULT '#344E86',
    sort_order      INTEGER DEFAULT 0,
    status          VARCHAR(20) DEFAULT 'Active',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Domain-subdomain → module mapping with weights
  `CREATE TABLE IF NOT EXISTS scoring_domain_config (
    id              SERIAL PRIMARY KEY,
    domain          VARCHAR(255) NOT NULL,
    subdomain       VARCHAR(255) NOT NULL,
    module_code     VARCHAR(10) NOT NULL,
    age_band_scope  VARCHAR(20) DEFAULT 'A-E3',
    weight_percent  INTEGER NOT NULL DEFAULT 0,
    status          VARCHAR(20) DEFAULT 'Active',
    sort_order      INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Age band norms — P20/P40/P60/P80 percentile cutoffs
  `CREATE TABLE IF NOT EXISTS scoring_age_band_norms (
    id              SERIAL PRIMARY KEY,
    band            VARCHAR(10) NOT NULL UNIQUE,
    grades          VARCHAR(50),
    ages            VARCHAR(30),
    p20             NUMERIC(5,1) NOT NULL,
    p40             NUMERIC(5,1) NOT NULL,
    p60             NUMERIC(5,1) NOT NULL,
    p80             NUMERIC(5,1) NOT NULL,
    sample_size     INTEGER DEFAULT 0,
    standard_error  NUMERIC(4,2) DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Formula parameters — editable per module
  `CREATE TABLE IF NOT EXISTS scoring_formula_params (
    id              SERIAL PRIMARY KEY,
    module_code     VARCHAR(10) NOT NULL,
    param_key       VARCHAR(50) NOT NULL,
    label           VARCHAR(255) NOT NULL,
    value           VARCHAR(50) NOT NULL,
    editable        BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(module_code, param_key)
  )`,

  // ── Seed default scoring modules ──
  `INSERT INTO scoring_modules (code, name, formula, weights, bands, color, sort_order, status) VALUES
    ('LES',  'Learning Efficiency Score',  '((Raw-7)/28)*100; MMI=avg(LE1,LE2r,LE3,LE5,LE7); MCI=avg(LE4,LE6)', 'MMI 5 items / MCI 2 items',  'Age-band: Low/Emerging/Effective cutoffs per band',  '#344E86', 1, 'Active'),
    ('ATT',  'Task Attention Index',       'ASS=(Hit*60)+(Precision*30)+(RTbonus 0-10)-ImpulsivityPenalty; ATI=(ASS*0.6)+(SR_avg*8)', 'ASS 60% / Self-Report 40%', 'Level×Band norms: High/Adequate cutoffs',  '#4ECDC4', 2, 'Active'),
    ('MEM',  'Memory Effectiveness',       'MEM=(IRS*0.4)+(DRS*0.4)+(DR*0.2); DR=(1-FA_rate)*100', 'Enc 40% / Rec 40% / DR 20%', 'Age-band: Low/Emerging/Effective cutoffs per band',  '#7C3AED', 3, 'Active'),
    ('CU',   'Conceptual Understanding',   'CU%=((CU1+CU2+CU3)/3)*100; each CU=1(correct) or 0', 'CU1 33% / CU2 33% / CU3 34%', 'Age-band: Surface/Adequate cutoffs per band',  '#D97706', 4, 'Active'),
    ('STR',  'Learning Strategy',          'Count V/R/P tags; CI=max(V,R,P); Dominant=argmax; Adaptability=Q5 vs primary', 'Tag counts / CI / Adaptability', 'Absent/Low/Moderate/High/VeryHigh preference bands',  '#059669', 5, 'Active'),
    ('EXAM', 'Exam Readiness',             'Overall=weighted avg of module scores using domain config weights', 'Domain config weights from DB', 'Norms-based: P20/P40/P60/P80 age-band classification',  '#BE185D', 6, 'Active')
   ON CONFLICT (code) DO UPDATE SET
    formula = EXCLUDED.formula, weights = EXCLUDED.weights, bands = EXCLUDED.bands`,

  // ── Seed default domain config ──
  `INSERT INTO scoring_domain_config (domain, subdomain, module_code, age_band_scope, weight_percent, status, sort_order) VALUES
    ('Language & Literacy',  'Reading Comprehension', 'LES',  'A-D',   30, 'Active', 1),
    ('Language & Literacy',  'Vocabulary Range',      'CU',   'A-E3',  25, 'Active', 2),
    ('Cognitive Abilities',  'Working Memory',        'MEM',  'B-E2',  35, 'Active', 3),
    ('Cognitive Abilities',  'Sustained Attention',   'ATT',  'C-E3',  30, 'Active', 4),
    ('Learning & Strategy',  'Study Strategy Profile','STR',  'D-E3',  20, 'Draft',  5),
    ('Academic Readiness',   'Exam Preparedness',     'EXAM', 'C-E3',  40, 'Active', 6)
   ON CONFLICT DO NOTHING`,

  // ── Seed default age band norms ──
  `INSERT INTO scoring_age_band_norms (band, grades, ages, p20, p40, p60, p80, sample_size, standard_error) VALUES
    ('A',  'Gr 6-7',      '11-13', 28, 42, 58, 74, 1842, 1.4),
    ('B',  'Gr 8-9',      '13-15', 32, 46, 62, 77, 2210, 1.2),
    ('C',  'Gr 10',       '15-16', 35, 50, 65, 80, 1975, 1.3),
    ('D',  'Gr 11-12',    '16-18', 38, 53, 68, 82, 2440, 1.1),
    ('E1', 'UG Yr 1-2',   '18-20', 40, 55, 70, 84, 1320, 1.6),
    ('E2', 'UG Yr 3+/PG', '20-23', 42, 57, 72, 86,  980, 1.8),
    ('E3', 'Adult',        '23+',   44, 59, 74, 88,  640, 2.1)
   ON CONFLICT (band) DO NOTHING`,

  // ── Seed default formula parameters (values match actual scoring engine code) ──
  `INSERT INTO scoring_formula_params (module_code, param_key, label, value, editable) VALUES
    -- LES (Learning Efficiency Score)
    ('LES', 'total_items',        'Total Likert items',        '7',    FALSE),
    ('LES', 'mmi_items',          'MMI item count (LE1,LE2r,LE3,LE5,LE7)', '5', FALSE),
    ('LES', 'mci_items',          'MCI item count (LE4,LE6)',  '2',    FALSE),
    ('LES', 'scale_min',          'Scale minimum (items × 1)', '7',    FALSE),
    ('LES', 'scale_max',          'Scale maximum (items × 5)', '35',   FALSE),
    ('LES', 'mmi_threshold_low',  'MMI Low threshold',         '3.0',  TRUE),
    ('LES', 'mmi_threshold_med',  'MMI Medium threshold',      '4.0',  TRUE),
    ('LES', 'item_flag_threshold','Item flag if score <=',     '2',    TRUE),
    -- ATT (Attention Index)
    ('ATT', 'hit_weight',         'Hit component weight (%)',  '60',   TRUE),
    ('ATT', 'precision_weight',   'Precision component weight (%)','30',TRUE),
    ('ATT', 'rt_bonus_max',       'RT bonus max points',       '10',   TRUE),
    ('ATT', 'stability_weight',   'Stability weight in final index','0.60',TRUE),
    ('ATT', 'sr_scale',           'SR scale factor',           '8',    TRUE),
    ('ATT', 'impulsivity_max',    'Max impulsivity penalty',   '15',   TRUE),
    ('ATT', 'fatigue_threshold',  'Fatigue decline % threshold','15',  TRUE),
    ('ATT', 'high_task_threshold','High task ASS threshold',   '65',   TRUE),
    ('ATT', 'low_task_threshold', 'Low task ASS threshold',    '45',   TRUE),
    ('ATT', 'high_fa_threshold',  'High false alarm rate threshold','0.25',TRUE),
    ('ATT', 'high_miss_threshold','High miss rate threshold',  '0.4',  TRUE),
    -- MEM (Memory Effectiveness)
    ('MEM', 'enc_weight',         'Encoding weight',           '0.40', TRUE),
    ('MEM', 'rec_weight',         'Recognition weight',        '0.40', TRUE),
    ('MEM', 'dr_weight',          'Distortion resist. weight', '0.20', TRUE),
    -- CU (Conceptual Understanding)
    ('CU',  'total_items',        'Total CU items',            '3',    FALSE),
    ('CU',  'item_max_score',     'Max score per item (binary)','1',   FALSE),
    -- STR (Learning Strategy) — tags are counted, no numeric thresholds used in code
    ('STR', 'ci_max',             'Max consistency index',     '5',    FALSE),
    ('STR', 'adaptability_max',   'Max adaptability score',    '2',    FALSE)
   ON CONFLICT (module_code, param_key) DO NOTHING`,
  // Fix any previously seeded wrong values
  `UPDATE scoring_formula_params SET value = '5' WHERE module_code = 'LES' AND param_key = 'mmi_items'`,
  `UPDATE scoring_formula_params SET value = '2' WHERE module_code = 'LES' AND param_key = 'mci_items'`,
  `DELETE FROM scoring_formula_params WHERE module_code = 'CU' AND param_key IN ('cu1_max','cu2_max','cu3_max','total_weight')`,
  `DELETE FROM scoring_formula_params WHERE module_code = 'STR' AND param_key IN ('dominant_threshold','adaptability_min')`,
  // chat_preferences — persisted chat settings per user
  `CREATE TABLE IF NOT EXISTS chat_preferences (
    user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    pause_pref  VARCHAR(16) NOT NULL DEFAULT 'none' CHECK (pause_pref IN ('none', 'session', 'always')),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  // Add response_style preference to chat_preferences
  `ALTER TABLE chat_preferences ADD COLUMN IF NOT EXISTS response_style VARCHAR(16) NOT NULL DEFAULT 'standard' CHECK (response_style IN ('standard', 'concise'))`,
  // Add preferred_language preference to chat_preferences
  `ALTER TABLE chat_preferences ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(32) NOT NULL DEFAULT 'english' CHECK (preferred_language IN ('english', 'hindi', 'tamil', 'telugu', 'marathi'))`,
  // pause_events — server-side analytics for guided pause start/complete
  `CREATE TABLE IF NOT EXISTS pause_events (
    id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    event_type VARCHAR(16) NOT NULL CHECK (event_type IN ('start', 'complete')),
    client_ts  BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_pause_events_type ON pause_events(event_type, created_at DESC)`,

  // ── Gamification Engine ──────────────────────────────────────────────────

  // student_gamification — XP, coins, level, streak per user
  `CREATE TABLE IF NOT EXISTS student_gamification (
    user_id          TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    xp               INTEGER NOT NULL DEFAULT 0,
    coins            INTEGER NOT NULL DEFAULT 0,
    level            INTEGER NOT NULL DEFAULT 1,
    streak_days      INTEGER NOT NULL DEFAULT 0,
    last_login_date  DATE,
    last_mission_reset DATE,
    missions_completed INTEGER NOT NULL DEFAULT 0,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // missions — catalog of mission templates
  `CREATE TABLE IF NOT EXISTS missions (
    id           SERIAL PRIMARY KEY,
    title        TEXT NOT NULL,
    description  TEXT,
    type         VARCHAR(20) NOT NULL CHECK (type IN ('quiz','video','assignment','reading')),
    difficulty   VARCHAR(10) NOT NULL CHECK (difficulty IN ('easy','medium','hard')),
    xp_reward    INTEGER NOT NULL DEFAULT 10,
    coin_reward  INTEGER NOT NULL DEFAULT 5,
    skill_tag    TEXT,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // student_missions — daily mission assignments per student
  `CREATE TABLE IF NOT EXISTS student_missions (
    id            SERIAL PRIMARY KEY,
    student_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mission_id    INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
    completed_at  TIMESTAMPTZ,
    status        VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','skipped')),
    UNIQUE (student_id, mission_id, assigned_date)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_student_missions_student_date ON student_missions(student_id, assigned_date)`,

  // xp_transactions — XP earn history
  `CREATE TABLE IF NOT EXISTS xp_transactions (
    id           SERIAL PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount       INTEGER NOT NULL,
    source       VARCHAR(40) NOT NULL,
    reference_id TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_xp_transactions_user ON xp_transactions(user_id, created_at DESC)`,

  // coin_transactions — coin earn/spend history
  `CREATE TABLE IF NOT EXISTS coin_transactions (
    id           SERIAL PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount       INTEGER NOT NULL,
    type         VARCHAR(10) NOT NULL CHECK (type IN ('earn','spend')),
    source       VARCHAR(40) NOT NULL,
    balance_after INTEGER NOT NULL,
    expires_at   TIMESTAMPTZ,
    reference_id TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_coin_transactions_user ON coin_transactions(user_id, created_at DESC)`,

  // skills — skill catalog
  `CREATE TABLE IF NOT EXISTS skills (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    category    TEXT NOT NULL,
    description TEXT,
    icon        TEXT DEFAULT 'Zap',
    is_active   BOOLEAN NOT NULL DEFAULT TRUE
  )`,

  // student_skills — mastery tracking (0–100) per student per skill
  `CREATE TABLE IF NOT EXISTS student_skills (
    student_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_id      INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    mastery_level INTEGER NOT NULL DEFAULT 0 CHECK (mastery_level BETWEEN 0 AND 100),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (student_id, skill_id)
  )`,

  // rewards — reward store catalog
  `CREATE TABLE IF NOT EXISTS rewards (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    type        VARCHAR(20) NOT NULL CHECK (type IN ('digital','academic','career','physical')),
    coin_cost   INTEGER NOT NULL,
    stock       INTEGER DEFAULT NULL,
    image_url   TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // redemptions — reward redemption orders
  `CREATE TABLE IF NOT EXISTS redemptions (
    id           SERIAL PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_id    INTEGER NOT NULL REFERENCES rewards(id),
    coins_spent  INTEGER NOT NULL,
    status       VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','shipped','completed','cancelled')),
    address      JSONB,
    notes        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_redemptions_user ON redemptions(user_id, created_at DESC)`,

  // Seed missions catalog
  `INSERT INTO missions (title, description, type, difficulty, xp_reward, coin_reward, skill_tag) VALUES
    ('Complete a Practice Quiz',    'Answer 10 questions in any subject',      'quiz',       'easy',   15, 5,  'Academic'),
    ('Watch a Learning Video',      'Watch a full educational video',          'video',      'easy',   10, 5,  'Learning'),
    ('Submit an Assignment',        'Complete and submit any assignment',      'assignment', 'medium', 30, 12, 'Academic'),
    ('Challenge Quiz',              'Answer 20 advanced questions',            'quiz',       'hard',   40, 15, 'Academic'),
    ('Career Exploration Read',     'Read a career path article',             'reading',    'easy',   10, 4,  'Career'),
    ('Assessment Module',           'Complete one LBI assessment module',     'assignment', 'hard',   50, 20, 'Intelligence'),
    ('Peer Collaboration',          'Participate in a group discussion',      'assignment', 'medium', 25, 10, 'Social'),
    ('Daily Reflection',            'Write a short reflection on your day',   'reading',    'easy',   12, 5,  'Wellness'),
    ('Skill Practice Session',      'Practice a skill for 15 minutes',        'video',      'medium', 20, 8,  'Skills'),
    ('Mock Interview Prep',         'Review interview Q&A for your stream',   'reading',    'medium', 25, 10, 'Career')
  ON CONFLICT DO NOTHING`,

  // Seed skills catalog
  `INSERT INTO skills (name, category, description, icon) VALUES
    ('Critical Thinking',    'Cognitive',    'Ability to analyse and evaluate information',    'Brain'),
    ('Communication',        'Social',       'Verbal and written expression skills',            'MessageSquare'),
    ('Problem Solving',      'Cognitive',    'Finding solutions to complex challenges',         'Lightbulb'),
    ('Emotional Intelligence','Soft Skills', 'Understanding and managing emotions',             'Heart'),
    ('Time Management',      'Productivity', 'Planning and prioritising tasks effectively',    'Clock'),
    ('Leadership',           'Social',       'Inspiring and guiding others toward a goal',     'Users'),
    ('Digital Literacy',     'Technology',   'Effective use of digital tools and platforms',   'Monitor'),
    ('Creativity',           'Cognitive',    'Generating original ideas and solutions',         'Sparkles'),
    ('Resilience',           'Soft Skills',  'Bouncing back from setbacks',                    'Shield'),
    ('Collaboration',        'Social',       'Working effectively as part of a team',           'Handshake')
  ON CONFLICT (name) DO NOTHING`,

  // Seed reward store
  `INSERT INTO rewards (name, description, type, coin_cost, stock) VALUES
    ('XP Booster (2x for 24h)',      'Double your XP earnings for 24 hours',                     'digital',  50,   NULL),
    ('Practice Test Pack',           'Access to 5 full-length practice tests',                   'academic', 300,  NULL),
    ('Resume Review Session',        'Expert review of your CV/resume',                          'career',   800,  50),
    ('Mentor Session (30 min)',       'One-on-one session with a career mentor',                  'career',   1200, 20),
    ('₹200 Amazon Voucher',          'Digital gift voucher redeemable on Amazon India',          'physical', 1500, 100),
    ('Study Planner Notebook',       'Premium physical study planner shipped to your door',      'physical', 600,  200),
    ('Career Stream Report',         'Detailed AI-generated career alignment report',            'career',   400,  NULL),
    ('Scholarship Alert Priority',   'Get priority alerts for scholarships matching your profile','digital', 150,  NULL)
  ON CONFLICT DO NOTHING`,

  // ─── Collaboration & Networking ─────────────────────────────────────────────

  // student_connections — peer connection requests (pending / accepted / declined)
  `CREATE TABLE IF NOT EXISTS student_connections (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending',
    message     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (requester_id, addressee_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sc_requester ON student_connections(requester_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sc_addressee ON student_connections(addressee_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sc_status    ON student_connections(status)`,

  // study_groups — moderated study groups
  `CREATE TABLE IF NOT EXISTS study_groups (
    id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name         VARCHAR(120) NOT NULL,
    description  TEXT,
    subject      VARCHAR(60),
    tags         TEXT[] DEFAULT '{}',
    visibility   VARCHAR(20) NOT NULL DEFAULT 'public',
    max_members  INTEGER NOT NULL DEFAULT 30,
    creator_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_moderated BOOLEAN NOT NULL DEFAULT TRUE,
    avatar_color VARCHAR(20) DEFAULT '#344E86',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sg_creator  ON study_groups(creator_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sg_subject  ON study_groups(subject)`,

  // group_members — membership + roles (member / moderator / owner)
  `CREATE TABLE IF NOT EXISTS group_members (
    id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    group_id   TEXT NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role       VARCHAR(20) NOT NULL DEFAULT 'member',
    joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (group_id, user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_gm_group ON group_members(group_id)`,
  `CREATE INDEX IF NOT EXISTS idx_gm_user  ON group_members(user_id)`,

  // direct_messages — 1:1 DMs between connected students
  `CREATE TABLE IF NOT EXISTS direct_messages (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    sender_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    is_read     BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_by_sender   BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_by_receiver BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_dm_sender   ON direct_messages(sender_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_dm_receiver ON direct_messages(receiver_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_dm_thread   ON direct_messages(LEAST(sender_id,receiver_id), GREATEST(sender_id,receiver_id), created_at)`,

  // group_messages — messages inside study groups
  `CREATE TABLE IF NOT EXISTS group_messages (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    group_id    TEXT NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
    sender_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    is_deleted  BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_by  TEXT,
    reply_to_id TEXT REFERENCES group_messages(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_gm_msg_group ON group_messages(group_id, created_at)`,

  // ── interview_question_bank — AI Voice Screening question library ──────────
  `CREATE TABLE IF NOT EXISTS interview_question_bank (
    id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    question         TEXT NOT NULL,
    expected_response TEXT,
    scoring_criteria TEXT,
    category         VARCHAR(80)  NOT NULL DEFAULT 'Behavioral',
    industry         VARCHAR(100) NOT NULL DEFAULT 'General',
    role             VARCHAR(200) NOT NULL DEFAULT 'General',
    position_level   VARCHAR(50)  NOT NULL DEFAULT 'Any',
    difficulty       VARCHAR(20)  NOT NULL DEFAULT 'Medium',
    is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
    tags             TEXT[]       NOT NULL DEFAULT '{}',
    created_by       VARCHAR(200)          DEFAULT 'system',
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_iqb_category  ON interview_question_bank(category)`,
  `CREATE INDEX IF NOT EXISTS idx_iqb_industry  ON interview_question_bank(industry)`,
  `CREATE INDEX IF NOT EXISTS idx_iqb_role      ON interview_question_bank(role)`,
  `CREATE INDEX IF NOT EXISTS idx_iqb_level     ON interview_question_bank(position_level)`,
  `CREATE INDEX IF NOT EXISTS idx_iqb_active    ON interview_question_bank(is_active)`,

  // ── Competitive Exam Portal ────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS competitive_exam_profiles (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exam_type       VARCHAR(30)  NOT NULL,
    target_year     INTEGER      NOT NULL DEFAULT 2025,
    exam_date       DATE,
    current_class   VARCHAR(20)  DEFAULT '12',
    target_colleges JSONB        NOT NULL DEFAULT '[]',
    daily_study_hours NUMERIC(3,1) DEFAULT 6,
    coaching_institute VARCHAR(200),
    city            VARCHAR(100),
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_cep_user    ON competitive_exam_profiles(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_cep_exam    ON competitive_exam_profiles(exam_type)`,

  `CREATE TABLE IF NOT EXISTS exam_mock_scores (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    profile_id      TEXT NOT NULL REFERENCES competitive_exam_profiles(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exam_type       VARCHAR(30)  NOT NULL,
    test_name       VARCHAR(200) NOT NULL,
    test_date       DATE         NOT NULL DEFAULT CURRENT_DATE,
    total_marks     INTEGER      NOT NULL DEFAULT 300,
    scored_marks    INTEGER      NOT NULL DEFAULT 0,
    subject_scores  JSONB        NOT NULL DEFAULT '{}',
    percentile      NUMERIC(5,2),
    predicted_rank  INTEGER,
    platform        VARCHAR(100) DEFAULT 'Self',
    notes           TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ems_profile ON exam_mock_scores(profile_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ems_user    ON exam_mock_scores(user_id)`,

  `CREATE TABLE IF NOT EXISTS exam_chapter_progress (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    profile_id      TEXT NOT NULL REFERENCES competitive_exam_profiles(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exam_type       VARCHAR(30)  NOT NULL,
    subject         VARCHAR(100) NOT NULL,
    chapter_name    VARCHAR(200) NOT NULL,
    status          VARCHAR(30)  NOT NULL DEFAULT 'not_started',
    confidence      INTEGER      NOT NULL DEFAULT 0,
    weightage       INTEGER      NOT NULL DEFAULT 5,
    notes           TEXT,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_ecp_unique ON exam_chapter_progress(profile_id, subject, chapter_name)`,
  `CREATE INDEX IF NOT EXISTS idx_ecp_user   ON exam_chapter_progress(user_id)`,

  `CREATE TABLE IF NOT EXISTS exam_study_groups (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name            VARCHAR(200) NOT NULL,
    exam_type       VARCHAR(30)  NOT NULL,
    description     TEXT,
    created_by      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    max_members     INTEGER      NOT NULL DEFAULT 20,
    is_public       BOOLEAN      NOT NULL DEFAULT TRUE,
    access_code     VARCHAR(10),
    member_count    INTEGER      NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_esg_exam ON exam_study_groups(exam_type)`,

  `CREATE TABLE IF NOT EXISTS exam_group_members (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    group_id        TEXT NOT NULL REFERENCES exam_study_groups(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(20)  NOT NULL DEFAULT 'member',
    joined_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_egm_unique ON exam_group_members(group_id, user_id)`,

  `CREATE TABLE IF NOT EXISTS exam_interventions (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    profile_id      TEXT REFERENCES competitive_exam_profiles(id) ON DELETE CASCADE,
    trigger_type    VARCHAR(50)  NOT NULL,
    severity        VARCHAR(20)  NOT NULL DEFAULT 'info',
    title           VARCHAR(200) NOT NULL,
    message         TEXT         NOT NULL,
    action_label    VARCHAR(100),
    action_url      VARCHAR(200),
    is_acknowledged BOOLEAN      NOT NULL DEFAULT FALSE,
    triggered_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ei_user ON exam_interventions(user_id)`,
];

function hashStatement(sql: string): string {
  return createHash('sha256').update(sql.trim()).digest('hex');
}

/**
 * Run all pending migrations against the shared connection pool.
 * Safe to call during server startup — does NOT close the pool.
 * Throws on failure so the caller can decide how to handle it.
 */
export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log('[Migrate] Running migrations...');

    // Ensure the tracking table exists first (always safe to run)
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id           SERIAL PRIMARY KEY,
        statement_hash TEXT NOT NULL UNIQUE,
        applied_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Load all already-applied hashes into a Set for O(1) lookup
    const { rows } = await client.query<{ statement_hash: string }>(
      'SELECT statement_hash FROM schema_migrations'
    );
    const applied = new Set(rows.map((r) => r.statement_hash));

    let skipped = 0;
    let ran = 0;

    for (let i = 0; i < migrations.length; i++) {
      const sql = migrations[i];
      const hash = hashStatement(sql);

      if (applied.has(hash)) {
        skipped++;
        continue;
      }

      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (statement_hash) VALUES ($1) ON CONFLICT DO NOTHING',
          [hash]
        );
        ran++;
      } catch (err) {
        console.error(`[Migrate] Failed at statement index ${i}:`);
        console.error(`[Migrate] Statement (first 200 chars): ${sql.substring(0, 200)}`);
        throw err;
      }
    }

    console.log(
      `[Migrate] Done — ${ran} statement(s) applied, ${skipped} skipped (already applied).`
    );
  } finally {
    client.release();
  }
}

async function migrate() {
  try {
    await runMigrations();
  } catch (err) {
    console.error('[Migrate] Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Only run when executed directly as a script (not when imported as a module)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrate();
}
