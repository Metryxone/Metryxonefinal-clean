import {
  pgTable,
  text,
  varchar,
  boolean,
  integer,
  serial,
  numeric,
  real,
  date,
  time,
  timestamp,
  jsonb,
  index,
  unique,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ─── 000: users ─── CANONICAL: backend/shared/schema.ts
// Imported (not re-defined) so other tables in this file can reference users.id
// via FK callbacks. Single source of truth: backend/shared/schema.ts (7 live cols).
// Aspirational cols (mobile, email, password_hash, is_active, is_verified,
// profile_picture, metadata, platform_id, updated_at) are NOT in the live DB.
// Phase 1 migration will add them (Task #117). See DATABASE_INVENTORY.md §Schema Drift.
import {
  users,
  insertUserSchema,
  type InsertUser,
  type User,
} from '../../../../backend/shared/schema';
export { users, insertUserSchema };
export type { InsertUser, User };

// ─── 000b: otp_tokens ───
export const otpTokens = pgTable('otp_tokens', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  mobile: varchar('mobile', { length: 15 }),
  identifier: varchar('identifier', { length: 255 }),
  otpHash: text('otp_hash').notNull(),
  purpose: varchar('purpose', { length: 32 }).notNull().default('login'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  attempts: integer('attempts').notNull().default(0),
  isUsed: boolean('is_used').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── 001: children ─── NOTE: COLUMN NAME DRIFT
// The live children table has many columns but with DIFFERENT names than defined here.
// Live uses: school_name, primary_language, education_board, lbi_consent, etc.
// This schema uses: school, language, board, consentGiven, etc. — Drizzle queries
// using this definition may fail or return wrong data. backend/shared/schema.ts has
// the original minimal definition closest to early live state.
// Phase 1: audit and align column names with a migration. See DATABASE_INVENTORY.md.
export const children = pgTable('children', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  parentId: text('parent_id').references(() => users.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  age: integer('age'),
  grade: varchar('grade', { length: 50 }),
  school: varchar('school', { length: 255 }),
  gender: varchar('gender', { length: 20 }),
  dateOfBirth: date('date_of_birth'),
  bloodGroup: varchar('blood_group', { length: 10 }),
  language: varchar('language', { length: 50 }),
  board: varchar('board', { length: 50 }),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 100 }),
  specialNeeds: text('special_needs'),
  studyHoursPerDay: numeric('study_hours_per_day', { precision: 3, scale: 1 }),
  favoriteSubjects: text('favorite_subjects').array().default(sql`'{}'`),
  consentGiven: boolean('consent_given').notNull().default(false),
  consentGivenAt: timestamp('consent_given_at', { withTimezone: true }),
  avatarUrl: text('avatar_url'),
  weakSubjects: text('weak_subjects').array().default(sql`'{}'`),
  learningStyle: varchar('learning_style', { length: 50 }),
  careerInterest: varchar('career_interest', { length: 255 }),
  relationship: varchar('relationship', { length: 50 }),
  schoolType: varchar('school_type', { length: 50 }),
  medium: varchar('medium', { length: 50 }),
  extracurricular: text('extracurricular'),
  emergencyContact: varchar('emergency_contact', { length: 255 }),
  medicalConditions: text('medical_conditions'),
  studentUserId: text('student_user_id').references(() => users.id, { onDelete: 'set null' }),
  platformId: varchar('platform_id', { length: 20 }).unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── 002: parent_subscriptions ───
export const parentSubscriptions = pgTable('parent_subscriptions', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  parentId: text('parent_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  plan: varchar('plan', { length: 50 }).notNull().default('basic'),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  features: jsonb('features').notNull().default(sql`'[]'`),
  billingCycle: varchar('billing_cycle', { length: 20 }).default('monthly'),
  amount: integer('amount').default(999),
  currency: varchar('currency', { length: 10 }).default('INR'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── 003: parent_briefings ───
export const parentBriefings = pgTable('parent_briefings', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  parentId: text('parent_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  childId: text('child_id').references(() => children.id, { onDelete: 'cascade' }),
  weekOf: date('week_of').notNull(),
  highlights: jsonb('highlights').notNull().default(sql`'[]'`),
  actionItems: jsonb('action_items').notNull().default(sql`'[]'`),
  wellnessSummary: jsonb('wellness_summary').default(sql`'{}'`),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique().on(t.parentId, t.childId, t.weekOf),
]);

// ─── 004: career_compass_results ───
export const careerCompassResults = pgTable('career_compass_results', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  childId: text('child_id').notNull().references(() => children.id, { onDelete: 'cascade' }),
  parentId: text('parent_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  traits: jsonb('traits').notNull().default(sql`'{}'`),
  careerMatches: jsonb('career_matches').notNull().default(sql`'[]'`),
  interestProfile: jsonb('interest_profile').notNull().default(sql`'{}'`),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── 005: study_plans ───
export const studyPlans = pgTable('study_plans', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  childId: text('child_id').notNull().references(() => children.id, { onDelete: 'cascade' }),
  parentId: text('parent_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  weekStart: date('week_start').notNull(),
  plan: jsonb('plan').notNull().default(sql`'{}'`),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique().on(t.childId, t.weekStart),
]);

// ─── 006: wellness_checkins ───
export const wellnessCheckins = pgTable('wellness_checkins', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  childId: text('child_id').notNull().references(() => children.id, { onDelete: 'cascade' }),
  parentId: text('parent_id').references(() => users.id, { onDelete: 'set null' }),
  stressLevel: integer('stress_level').notNull(),
  mood: varchar('mood', { length: 30 }).notNull(),
  energy: integer('energy').notNull(),
  focus: integer('focus').notNull(),
  sleepHours: numeric('sleep_hours', { precision: 3, scale: 1 }),
  notes: text('notes'),
  flags: jsonb('flags').default(sql`'[]'`),
  checkedAt: timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── 007: scholarship_alerts ───
export const scholarshipAlerts = pgTable('scholarship_alerts', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  title: varchar('title', { length: 255 }).notNull(),
  provider: varchar('provider', { length: 255 }).notNull(),
  description: text('description').notNull(),
  amount: varchar('amount', { length: 100 }),
  deadline: date('deadline'),
  eligibilityGrades: text('eligibility_grades').array().default(sql`'{}'`),
  eligibilityBoards: text('eligibility_boards').array().default(sql`'{}'`),
  eligibilityStates: text('eligibility_states').array().default(sql`'{}'`),
  category: varchar('category', { length: 50 }).default('scholarship'),
  applyUrl: text('apply_url'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── 008: notifications ───
export const notifications = pgTable('notifications', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  templateId: integer('template_id').notNull(),
  recipientId: text('recipient_id').notNull(),
  senderId: text('sender_id'),
  category: varchar('category', { length: 32 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  type: varchar('type', { length: 4 }).notNull(),
  priority: varchar('priority', { length: 8 }).notNull(),
  isRead: boolean('is_read').notNull().default(false),
  isAcknowledged: boolean('is_acknowledged').notNull().default(false),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  isEmailSent: boolean('is_email_sent').notNull().default(false),
  emailSentAt: timestamp('email_sent_at', { withTimezone: true }),
  actionUrl: text('action_url'),
  actionLabel: varchar('action_label', { length: 128 }),
  metadata: jsonb('metadata'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── 009: notification_preferences ───
export const notificationPreferences = pgTable('notification_preferences', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  userId: text('user_id').notNull().unique(),
  channels: jsonb('channels').notNull().default(sql`'{"in_app":true,"email":true,"whatsapp":false,"sms":false}'`),
  categoryOverrides: jsonb('category_overrides').notNull().default(sql`'{}'`),
  quietHours: jsonb('quiet_hours').notNull().default(sql`'{"enabled":false}'`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── 010: notification_queue ───
export const notificationQueue = pgTable('notification_queue', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  notificationId: text('notification_id').notNull().references(() => notifications.id, { onDelete: 'cascade' }),
  channel: varchar('channel', { length: 16 }).notNull(),
  status: varchar('status', { length: 16 }).notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  errorMessage: text('error_message'),
  providerRef: varchar('provider_ref', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── 011: email_consents ───
export const emailConsents = pgTable('email_consents', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  userId: text('user_id').notNull(),
  consentType: varchar('consent_type', { length: 64 }).notNull(),
  isConsented: boolean('is_consented').notNull().default(true),
  consentedAt: timestamp('consented_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (t) => [
  unique().on(t.userId, t.consentType),
]);

// ─── 012: notification_templates ───
export const notificationTemplates = pgTable('notification_templates', {
  id: integer('id').primaryKey(),
  category: varchar('category', { length: 32 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  bodyTemplate: text('body_template').notNull(),
  type: varchar('type', { length: 4 }).notNull(),
  priority: varchar('priority', { length: 8 }).notNull(),
  roles: jsonb('roles').notNull().default(sql`'["all"]'`),
  variables: jsonb('variables').notNull().default(sql`'[]'`),
  actionUrl: text('action_url'),
  actionLabel: varchar('action_label', { length: 128 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── 013: user_devices ───
export const userDevices = pgTable('user_devices', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  deviceHash: text('device_hash').notNull(),
  userAgent: text('user_agent'),
  ipAddress: text('ip_address'),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  unique().on(t.userId, t.deviceHash),
]);

// ─── exam_ready_attempts ───
export const examReadyAttempts = pgTable('exam_ready_attempts', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  childId: text('child_id').references(() => children.id, { onDelete: 'set null' }),
  studentName: varchar('student_name', { length: 255 }),
  planId: varchar('plan_id', { length: 50 }).notNull().default('dynamic'),
  patternType: varchar('pattern_type', { length: 50 }).notNull().default('lbi'),
  domainCode: varchar('domain_code', { length: 50 }),
  subdomainCode: varchar('subdomain_code', { length: 50 }),
  ageBand: varchar('age_band', { length: 20 }),
  board: varchar('board', { length: 50 }),
  grade: varchar('grade', { length: 50 }),
  status: varchar('status', { length: 30 }).notNull().default('in_progress'),
  questionIds: text('question_ids').array().default(sql`'{}'`),
  answers: jsonb('answers').notNull().default(sql`'{}'`),
  timePerQuestion: jsonb('time_per_question').notNull().default(sql`'{}'`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── exam_ready_reports ───
export const examReadyReports = pgTable('exam_ready_reports', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  attemptId: text('attempt_id').notNull().references(() => examReadyAttempts.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  childId: text('child_id').references(() => children.id, { onDelete: 'set null' }),
  studentName: varchar('student_name', { length: 255 }),
  planId: varchar('plan_id', { length: 50 }),
  board: varchar('board', { length: 50 }),
  grade: varchar('grade', { length: 50 }),
  ageBand: varchar('age_band', { length: 20 }),
  status: varchar('status', { length: 30 }).notNull().default('pending'),
  progress: integer('progress').default(0),
  scoreData: jsonb('score_data'),
  overallScore: numeric('overall_score', { precision: 5, scale: 2 }),
  readinessLevel: varchar('readiness_level', { length: 30 }),
  summary: text('summary'),
  recommendations: jsonb('recommendations'),
  pdfPath: text('pdf_path'),
  error: text('error'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── subscription_packages ─── CANONICAL: backend/shared/schema.ts
// Imported (not re-defined) so other tables in this file can reference
// subscriptionPackages.id via FK callbacks. Single source of truth:
// backend/shared/schema.ts (14 live cols). Aspirational cols (subcategory,
// priceMax, offerLabel, couponCode, highlights, billingType, reportConfig, etc.)
// are NOT in the live DB. Phase 1 migration will add them (Task #119).
// See DATABASE_INVENTORY.md §Schema Drift.
import {
  subscriptionPackages,
  insertSubscriptionPackageSchema,
  type InsertSubscriptionPackage,
  type SubscriptionPackage,
} from '../../../../backend/shared/schema';
export { subscriptionPackages, insertSubscriptionPackageSchema };
export type { InsertSubscriptionPackage, SubscriptionPackage };

// ─── student_subscriptions ─── CANONICAL: backend/shared/schema.ts
// Imported (not re-defined). Single source of truth: backend/shared/schema.ts
// (10 live cols). Aspirational cols (institution_id, notes, start_date,
// target_age_band, assigned_by, updated_at) are NOT in the live DB.
// Phase 1 migration will add them (Task #119). See DATABASE_INVENTORY.md §Schema Drift.
import {
  studentSubscriptions,
  insertStudentSubscriptionSchema,
  type InsertStudentSubscription,
  type StudentSubscription,
} from '../../../../backend/shared/schema';
export { studentSubscriptions, insertStudentSubscriptionSchema };
export type { InsertStudentSubscription, StudentSubscription };

// ─── platform_settings ───
export const platformSettings = pgTable('platform_settings', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: text('value').notNull().default(''),
  category: varchar('category', { length: 50 }).notNull().default('general'),
  description: text('description'),
  updatedBy: text('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── lbi_modules ─── SCHEMA DRIFT WARNING
// The live lbi_modules table (confirmed 2026-05-09) has varchar id and no subModules/
// domainCodes columns — matching backend/shared/schema.ts. This definition uses serial
// integer id and adds subModules jsonb + domainCodes text[] NOT in the live DB yet.
// Phase 1: migrate live table to this richer schema. See DATABASE_INVENTORY.md.
export const lbiModules = pgTable('lbi_modules', {
  id: serial('id').primaryKey(),
  moduleCode: varchar('module_code', { length: 20 }).notNull().unique(),
  moduleName: varchar('module_name', { length: 255 }).notNull(),
  description: text('description'),
  iconKey: varchar('icon_key', { length: 50 }),
  color: varchar('color', { length: 20 }),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  subModules: jsonb('sub_modules').notNull().default(sql`'[]'`),
  domainCodes: text('domain_codes').array().default(sql`'{}'`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── lbi_sessions ─── TARGET CONSUMER MODEL (NOT YET IN LIVE DB)
// The live lbi_sessions table still has the backend schema columns (assessment_id +
// student_id — the old institute model). This consumer model (child_id × module_id)
// has NOT been applied to the live DB. Routes using this definition will fail at runtime.
// The institute flow uses lbi_assessment_sessions (SEPARATE table, raw SQL in
// backend/routes.ts ~line 10650). Phase 1: migrate lbi_sessions to this model.
// See DATABASE_INVENTORY.md §lbi_sessions reconciliation.
export const lbiSessions = pgTable('lbi_sessions', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  childId: text('child_id').notNull().references(() => children.id, { onDelete: 'cascade' }),
  moduleId: integer('module_id').notNull().references(() => lbiModules.id),
  status: varchar('status', { length: 50 }).notNull().default('In Progress'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  rawScore: integer('raw_score'),
  maxScore: integer('max_score'),
  percentileScore: numeric('percentile_score', { precision: 5, scale: 2 }),
  percentageScore: numeric('percentage_score', { precision: 5, scale: 2 }),
  totalQuestions: integer('total_questions').notNull().default(0),
  questionsAnswered: integer('questions_answered').notNull().default(0),
  responses: jsonb('responses').notNull().default(sql`'[]'`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── lbi_domains ───
export const lbiDomains = pgTable('lbi_domains', {
  id: serial('id').primaryKey(),
  domainCode: varchar('domain_code', { length: 20 }).notNull().unique(),
  domainName: varchar('domain_name', { length: 255 }).notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── assessment_domains ───
export const assessmentDomains = pgTable('assessment_domains', {
  id: integer('id').primaryKey(),
  domainCode: varchar('domain_code', { length: 10 }).notNull().unique(),
  domainName: varchar('domain_name', { length: 255 }).notNull(),
  weightPercent: real('weight_percent').default(0),
  toolsMethods: text('tools_methods'),
  rootCause: text('root_cause'),
  practicalOutcome: text('practical_outcome'),
  correlations: text('correlations'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── assessment_subdomains ───
export const assessmentSubdomains = pgTable('assessment_subdomains', {
  id: text('id').primaryKey(),
  domainId: integer('domain_id').notNull().references(() => assessmentDomains.id, { onDelete: 'cascade' }),
  subdomainName: varchar('subdomain_name', { length: 255 }).notNull(),
  weightInDomain: real('weight_in_domain').default(0),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── package_domain_mapping ───
export const packageDomainMapping = pgTable('package_domain_mapping', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  packageId: text('package_id').notNull().references(() => subscriptionPackages.id, { onDelete: 'cascade' }),
  domainId: integer('domain_id').notNull().references(() => assessmentDomains.id, { onDelete: 'cascade' }),
}, (t) => [
  unique().on(t.packageId, t.domainId),
]);

// ─── mentor_profiles ───
export const mentorProfiles = pgTable('mentor_profiles', {
  id: serial('id').primaryKey(),
  userId: text('user_id').unique().references(() => users.id, { onDelete: 'cascade' }),
  displayName: varchar('display_name', { length: 200 }),
  title: varchar('title', { length: 200 }),
  bio: text('bio'),
  mentorType: varchar('mentor_type', { length: 50 }).default('subject_tutor'),
  subjects: text('subjects').array().default(sql`'{}'`),
  psychologicalAreas: text('psychological_areas').array().default(sql`'{}'`),
  specializations: text('specializations').array().default(sql`'{}'`),
  lbiDomains: text('lbi_domains').array().default(sql`'{}'`),
  languages: text('languages').array().default(sql`'{}'`),
  experienceYears: integer('experience_years').default(0),
  hourlyRate: numeric('hourly_rate', { precision: 10, scale: 2 }).default('0'),
  currency: varchar('currency', { length: 10 }).default('INR'),
  mode: varchar('mode', { length: 20 }).default('online'),
  city: varchar('city', { length: 100 }),
  education: jsonb('education').default(sql`'[]'`),
  certifications: text('certifications').array().default(sql`'{}'`),
  ageGroups: text('age_groups').array().default(sql`'{}'`),
  availability: jsonb('availability').default(sql`'{}'`),
  profileImageUrl: text('profile_image_url'),
  linkedinUrl: text('linkedin_url'),
  isVerified: boolean('is_verified').default(false),
  isFeatured: boolean('is_featured').default(false),
  rating: numeric('rating', { precision: 3, scale: 2 }).default('0'),
  totalReviews: integer('total_reviews').default(0),
  totalSessions: integer('total_sessions').default(0),
  aiMatchTags: text('ai_match_tags').array().default(sql`'{}'`),
  status: varchar('status', { length: 20 }).default('pending'),
  performanceHealthIndex: integer('performance_health_index').default(100),
  warningReason: text('warning_reason'),
  warningIssuedAt: timestamp('warning_issued_at', { withTimezone: true }),
  suspensionReason: text('suspension_reason'),
  activatedAt: timestamp('activated_at', { withTimezone: true }),
  phone: varchar('phone', { length: 20 }),
  specialization: text('specialization'),
  qualifications: text('qualifications'),
  onboardingStage: varchar('onboarding_stage', { length: 50 }).default('application'),
  trainingStartedAt: timestamp('training_started_at', { withTimezone: true }),
  trainingCompletedAt: timestamp('training_completed_at', { withTimezone: true }),
  assessmentCompletedAt: timestamp('assessment_completed_at', { withTimezone: true }),
  tempCode: varchar('temp_code', { length: 20 }),
  tempCodeGeneratedAt: timestamp('temp_code_generated_at', { withTimezone: true }),
  kycStatus: varchar('kyc_status', { length: 20 }).default('pending'),
  kycSubmittedAt: timestamp('kyc_submitted_at', { withTimezone: true }),
  kycVerifiedAt: timestamp('kyc_verified_at', { withTimezone: true }),
  profilerStatus: varchar('profiler_status', { length: 20 }).default('pending'),
  profilerCompletedAt: timestamp('profiler_completed_at', { withTimezone: true }),
  deliveryLink: text('delivery_link'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── mentor_bookings ───
export const mentorBookings = pgTable('mentor_bookings', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  mentorId: integer('mentor_id').notNull().references(() => mentorProfiles.id, { onDelete: 'cascade' }),
  childId: text('child_id').notNull().references(() => children.id, { onDelete: 'cascade' }),
  parentId: text('parent_id').references(() => users.id),
  slotDate: date('slot_date').notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  mode: varchar('mode', { length: 20 }).default('online'),
  status: varchar('status', { length: 30 }).default('pending'),
  notes: text('notes'),
  sessionLink: text('session_link'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── booking_messages ───
export const bookingMessages = pgTable('booking_messages', {
  id: serial('id').primaryKey(),
  bookingId: text('booking_id').notNull().references(() => mentorBookings.id, { onDelete: 'cascade' }),
  senderId: text('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  senderName: varchar('sender_name', { length: 255 }),
  senderRole: varchar('sender_role', { length: 20 }).default('parent'),
  message: text('message').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── mentor_reviews ───
export const mentorReviews = pgTable('mentor_reviews', {
  id: serial('id').primaryKey(),
  mentorId: integer('mentor_id').notNull().references(() => mentorProfiles.id, { onDelete: 'cascade' }),
  reviewerId: text('reviewer_id').references(() => users.id),
  bookingId: text('booking_id').references(() => mentorBookings.id),
  rating: integer('rating').notNull(),
  comment: text('comment'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── lbi_age_bands ───
export const lbiAgeBands = pgTable('lbi_age_bands', {
  id: serial('id').primaryKey(),
  bandCode: varchar('band_code', { length: 10 }).notNull().unique(),
  label: varchar('label', { length: 100 }).notNull(),
  ageMin: integer('age_min').notNull(),
  ageMax: integer('age_max').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── lbi_questions ───
export const lbiQuestions = pgTable('lbi_questions', {
  id: serial('id').primaryKey(),
  questionCode: varchar('question_code', { length: 80 }).notNull().unique(),
  domainCode: varchar('domain_code', { length: 20 }).notNull(),
  domainName: varchar('domain_name', { length: 255 }),
  subdomainCode: varchar('subdomain_code', { length: 50 }).notNull(),
  subdomainName: varchar('subdomain_name', { length: 255 }),
  ageBandCode: varchar('age_band_code', { length: 10 }).notNull(),
  questionType: varchar('question_type', { length: 30 }).notNull().default('likert'),
  questionText: text('question_text').notNull(),
  passageText: text('passage_text'),
  keying: varchar('keying', { length: 20 }).default('Positive'),
  reverseScored: boolean('reverse_scored').notNull().default(false),
  optionA: text('option_a'),
  optionB: text('option_b'),
  optionC: text('option_c'),
  optionD: text('option_d'),
  optionAScore: integer('option_a_score'),
  optionBScore: integer('option_b_score'),
  optionCScore: integer('option_c_score'),
  optionDScore: integer('option_d_score'),
  correctAnswer: varchar('correct_answer', { length: 10 }),
  explanation: text('explanation'),
  isAnchor: boolean('is_anchor').notNull().default(false),
  difficulty: varchar('difficulty', { length: 20 }).default('MEDIUM'),
  status: varchar('status', { length: 20 }).default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── onboarding_requests ───
export const onboardingRequests = pgTable('onboarding_requests', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  entityType: varchar('entity_type', { length: 30 }).notNull(),
  entityName: varchar('entity_name', { length: 255 }).notNull(),
  entityEmail: varchar('entity_email', { length: 255 }).notNull(),
  entityPhone: varchar('entity_phone', { length: 20 }),
  entityId: varchar('entity_id', { length: 100 }),
  organizationName: varchar('organization_name', { length: 255 }),
  address: text('address'),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 100 }),
  pincode: varchar('pincode', { length: 10 }),
  website: varchar('website', { length: 255 }),
  registrationNumber: varchar('registration_number', { length: 100 }),
  panNumber: varchar('pan_number', { length: 20 }),
  gstNumber: varchar('gst_number', { length: 20 }),
  contactPerson: varchar('contact_person', { length: 255 }),
  contactDesignation: varchar('contact_designation', { length: 100 }),
  description: text('description'),
  documentsVerified: boolean('documents_verified').notNull().default(false),
  kycVerified: boolean('kyc_verified').notNull().default(false),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  reviewNotes: text('review_notes'),
  rejectionReason: text('rejection_reason'),
  reviewedBy: text('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── kyc_documents ───
export const kycDocuments = pgTable('kyc_documents', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  onboardingId: text('onboarding_id').notNull().references(() => onboardingRequests.id, { onDelete: 'cascade' }),
  entityType: varchar('entity_type', { length: 30 }).notNull(),
  entityName: varchar('entity_name', { length: 255 }).notNull(),
  documentType: varchar('document_type', { length: 50 }).notNull(),
  documentNumber: varchar('document_number', { length: 100 }),
  fileUrl: text('file_url'),
  status: varchar('status', { length: 30 }).notNull().default('pending'),
  makerVerifiedBy: text('maker_verified_by').references(() => users.id),
  makerVerifiedAt: timestamp('maker_verified_at', { withTimezone: true }),
  makerNotes: text('maker_notes'),
  checkerVerifiedBy: text('checker_verified_by').references(() => users.id),
  checkerVerifiedAt: timestamp('checker_verified_at', { withTimezone: true }),
  checkerNotes: text('checker_notes'),
  rejectedBy: text('rejected_by').references(() => users.id),
  rejectedAt: timestamp('rejected_at', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── onboarding_history ───
export const onboardingHistory = pgTable('onboarding_history', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  onboardingId: text('onboarding_id').notNull().references(() => onboardingRequests.id, { onDelete: 'cascade' }),
  action: varchar('action', { length: 50 }).notNull(),
  performedBy: text('performed_by').references(() => users.id),
  performedByName: varchar('performed_by_name', { length: 255 }),
  notes: text('notes'),
  oldStatus: varchar('old_status', { length: 20 }),
  newStatus: varchar('new_status', { length: 20 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── student_enrollments ───
export const studentEnrollments = pgTable('student_enrollments', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  studentName: varchar('student_name', { length: 255 }).notNull(),
  studentEmail: varchar('student_email', { length: 255 }),
  studentPhone: varchar('student_phone', { length: 20 }),
  parentName: varchar('parent_name', { length: 255 }),
  parentEmail: varchar('parent_email', { length: 255 }),
  instituteName: varchar('institute_name', { length: 255 }),
  grade: varchar('grade', { length: 20 }),
  board: varchar('board', { length: 50 }),
  enrollmentDate: timestamp('enrollment_date', { withTimezone: true }).notNull().defaultNow(),
  paymentStatus: varchar('payment_status', { length: 20 }).notNull().default('pending'),
  planType: varchar('plan_type', { length: 50 }),
  amount: numeric('amount', { precision: 10, scale: 2 }),
  userId: text('user_id').references(() => users.id),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── document_upload_tokens ───
export const documentUploadTokens = pgTable('document_upload_tokens', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  onboardingId: text('onboarding_id').notNull().references(() => onboardingRequests.id, { onDelete: 'cascade' }),
  token: text('token').unique().notNull(),
  requestedDocs: jsonb('requested_docs').notNull().default(sql`'[]'`),
  customMessage: text('custom_message'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull().default(sql`NOW() + INTERVAL '7 days'`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  usedAt: timestamp('used_at', { withTimezone: true }),
});

// ─── custom_assessment_modules ───
export const customAssessmentModules = pgTable('custom_assessment_modules', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  moduleName: varchar('module_name', { length: 255 }).notNull(),
  description: text('description'),
  domainCodes: text('domain_codes').array().default(sql`'{}'`),
  ageBandCodes: text('age_band_codes').array().default(sql`'{}'`),
  questionCount: integer('question_count').default(0),
  packageIds: text('package_ids').array().default(sql`'{}'`),
  createdBy: text('created_by').references(() => users.id),
  isActive: boolean('is_active').default(true),
  category: text('category').notNull().default(''),
  subcategory: text('subcategory').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── custom_module_sessions ───
export const customModuleSessions = pgTable('custom_module_sessions', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  respondentId: text('respondent_id').notNull(),
  customModuleId: integer('custom_module_id').notNull(),
  packageId: text('package_id'),
  status: text('status').notNull().default('in_progress'),
  drawnQuestions: jsonb('drawn_questions').notNull().default(sql`'[]'`),
  responses: jsonb('responses').notNull().default(sql`'{}'`),
  attemptNumber: integer('attempt_number').notNull().default(1),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  timeSpentSeconds: integer('time_spent_seconds'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── mentor_kpis ───
export const mentorKpis = pgTable('mentor_kpis', {
  id: serial('id').primaryKey(),
  mentorId: text('mentor_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  studentSatisfaction: numeric('student_satisfaction', { precision: 5, scale: 2 }).default('0'),
  sessionCompletionRate: numeric('session_completion_rate', { precision: 5, scale: 2 }).default('0'),
  outcomeImprovement: numeric('outcome_improvement', { precision: 5, scale: 2 }).default('0'),
  complianceAdherence: numeric('compliance_adherence', { precision: 5, scale: 2 }).default('0'),
  alertLevel: varchar('alert_level', { length: 20 }).default('none'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── mentor_tasks ───
export const mentorTasks = pgTable('mentor_tasks', {
  id: serial('id').primaryKey(),
  mentorId: text('mentor_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  taskType: varchar('task_type', { length: 50 }).default('general'),
  description: text('description'),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  scheduledDate: date('scheduled_date'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  assignedBy: text('assigned_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── mentor_payouts ───
export const mentorPayouts = pgTable('mentor_payouts', {
  id: serial('id').primaryKey(),
  mentorId: text('mentor_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  grossRevenue: numeric('gross_revenue', { precision: 12, scale: 2 }).default('0'),
  commissionRate: numeric('commission_rate', { precision: 4, scale: 3 }).default('0.2'),
  deductions: numeric('deductions', { precision: 12, scale: 2 }).default('0'),
  netPayout: numeric('net_payout', { precision: 12, scale: 2 }).default('0'),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── mentor_violations ───
export const mentorViolations = pgTable('mentor_violations', {
  id: serial('id').primaryKey(),
  mentorId: text('mentor_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  violationType: varchar('violation_type', { length: 100 }).notNull(),
  severity: varchar('severity', { length: 20 }).notNull().default('minor'),
  description: text('description'),
  status: varchar('status', { length: 50 }).notNull().default('open'),
  resolution: text('resolution'),
  reportedBy: text('reported_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});

// ─── mentor_kyc_documents ───
export const mentorKycDocuments = pgTable('mentor_kyc_documents', {
  id: serial('id').primaryKey(),
  mentorProfileId: integer('mentor_profile_id').notNull().references(() => mentorProfiles.id, { onDelete: 'cascade' }),
  documentType: varchar('document_type', { length: 100 }).notNull(),
  documentName: varchar('document_name', { length: 255 }).notNull(),
  fileUrl: text('file_url'),
  status: varchar('status', { length: 20 }).notNull().default('submitted'),
  verifiedBy: text('verified_by').references(() => users.id, { onDelete: 'set null' }),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── mentor_onboarding_notifications ───
export const mentorOnboardingNotifications = pgTable('mentor_onboarding_notifications', {
  id: serial('id').primaryKey(),
  mentorProfileId: integer('mentor_profile_id').notNull().references(() => mentorProfiles.id, { onDelete: 'cascade' }),
  stage: varchar('stage', { length: 50 }).notNull(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  message: text('message').notNull(),
  sentTo: varchar('sent_to', { length: 255 }),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── notification_scenarios ───
export const notificationScenarios = pgTable('notification_scenarios', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  eventTrigger: varchar('event_trigger', { length: 100 }).notNull(),
  conditionJson: jsonb('condition_json').notNull().default(sql`'{}'`),
  templateId: integer('template_id').references(() => notificationTemplates.id, { onDelete: 'set null' }),
  delayMinutes: integer('delay_minutes').notNull().default(0),
  channels: jsonb('channels').notNull().default(sql`'["in_app","email"]'`),
  targetRole: varchar('target_role', { length: 50 }),
  variablesMap: jsonb('variables_map').notNull().default(sql`'{}'`),
  isActive: boolean('is_active').notNull().default(true),
  executionCount: integer('execution_count').notNull().default(0),
  lastExecutedAt: timestamp('last_executed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── notification_scheduled_jobs ───
export const notificationScheduledJobs = pgTable('notification_scheduled_jobs', {
  id: serial('id').primaryKey(),
  scenarioId: integer('scenario_id').references(() => notificationScenarios.id, { onDelete: 'set null' }),
  templateId: integer('template_id').references(() => notificationTemplates.id, { onDelete: 'set null' }),
  recipientId: text('recipient_id').references(() => users.id, { onDelete: 'cascade' }),
  variables: jsonb('variables').notNull().default(sql`'{}'`),
  channels: jsonb('channels').notNull().default(sql`'["in_app","email"]'`),
  context: jsonb('context').notNull().default(sql`'{}'`),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── parent_kyc ───
export const parentKyc = pgTable('parent_kyc', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  parentId: text('parent_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  relationshipType: varchar('relationship_type', { length: 50 }),
  idType: varchar('id_type', { length: 50 }),
  idNumber: varchar('id_number', { length: 100 }),
  fullLegalName: varchar('full_legal_name', { length: 200 }),
  dateOfBirth: date('date_of_birth'),
  kycStatus: varchar('kyc_status', { length: 20 }).notNull().default('pending'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  verifiedBy: text('verified_by').references(() => users.id),
  rejectionReason: text('rejection_reason'),
  adminNotes: text('admin_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── hr_jobs ───
export const hrJobs = pgTable('hr_jobs', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  title: varchar('title', { length: 255 }).notNull(),
  roleCategory: varchar('role_category', { length: 100 }).notNull().default('mentor'),
  employmentType: varchar('employment_type', { length: 50 }).notNull().default('part-time'),
  workMode: varchar('work_mode', { length: 50 }).notNull().default('remote'),
  city: varchar('city', { length: 100 }),
  location: varchar('location', { length: 255 }),
  salary: varchar('salary', { length: 100 }),
  benefits: text('benefits'),
  posterImage: text('poster_image'),
  description: text('description'),
  eligibility: text('eligibility'),
  qualifications: text('qualifications'),
  responsibilities: text('responsibilities'),
  kpis: text('kpis'),
  compensationModel: text('compensation_model'),
  postToLinkedin: boolean('post_to_linkedin').default(false),
  postToIndeed: boolean('post_to_indeed').default(false),
  postToNaukri: boolean('post_to_naukri').default(false),
  postToFacebook: boolean('post_to_facebook').default(false),
  postToWhatsapp: boolean('post_to_whatsapp').default(false),
  postToInstagram: boolean('post_to_instagram').default(false),
  postToTwitter: boolean('post_to_twitter').default(false),
  postToCareers: boolean('post_to_careers').default(true),
  status: varchar('status', { length: 50 }).notNull().default('draft'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  hrReviewAt: timestamp('hr_review_at', { withTimezone: true }),
  legalReviewAt: timestamp('legal_review_at', { withTimezone: true }),
  leadershipApprovalAt: timestamp('leadership_approval_at', { withTimezone: true }),
  rejectReason: text('reject_reason'),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── hr_applications ───
export const hrApplications = pgTable('hr_applications', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  jobId: text('job_id').references(() => hrJobs.id, { onDelete: 'cascade' }),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  coverLetter: text('cover_letter'),
  resumeUrl: text('resume_url'),
  sourceChannel: varchar('source_channel', { length: 50 }).default('direct'),
  consentCaptured: boolean('consent_captured').notNull().default(true),
  status: varchar('status', { length: 50 }).notNull().default('applied'),
  rejectionReason: text('rejection_reason'),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  membershipPaidAt: timestamp('membership_paid_at', { withTimezone: true }),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── institutions ───
export const institutions = pgTable('institutions', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  userId: text('user_id').references(() => users.id),
  institutionType: varchar('institution_type', { length: 20 }).notNull().default('school'),
  institutionCode: varchar('institution_code', { length: 30 }),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 20 }),
  website: varchar('website', { length: 255 }),
  address: text('address'),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 100 }),
  pincode: varchar('pincode', { length: 10 }),
  country: varchar('country', { length: 100 }).default('India'),
  registrationNumber: varchar('registration_number', { length: 100 }),
  panNumber: varchar('pan_number', { length: 20 }),
  gstNumber: varchar('gst_number', { length: 20 }),
  affiliationBoard: varchar('affiliation_board', { length: 100 }),
  accreditation: varchar('accreditation', { length: 100 }),
  studentCount: integer('student_count').default(0),
  staffCount: integer('staff_count').default(0),
  contactPerson: varchar('contact_person', { length: 255 }),
  contactDesignation: varchar('contact_designation', { length: 100 }),
  contactEmail: varchar('contact_email', { length: 255 }),
  contactPhone: varchar('contact_phone', { length: 20 }),
  description: text('description'),
  status: varchar('status', { length: 30 }).default('pending'),
  kycStatus: varchar('kyc_status', { length: 30 }).default('pending'),
  documentsVerified: boolean('documents_verified').default(false),
  notes: text('notes'),
  onboardingRequestId: text('onboarding_request_id'),
  activatedAt: timestamp('activated_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── assessment_assignments ───
export const assessmentAssignments = pgTable('assessment_assignments', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  childId: text('child_id').notNull().references(() => children.id, { onDelete: 'cascade' }),
  templateId: varchar('template_id', { length: 50 }).notNull(),
  assignedBy: text('assigned_by').references(() => users.id),
  status: varchar('status', { length: 30 }).default('assigned'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── admin_audit_logs ───
export const adminAuditLogs = pgTable('admin_audit_logs', {
  id: serial('id').primaryKey(),
  adminId: text('admin_id').references(() => users.id),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }),
  entityId: text('entity_id'),
  details: jsonb('details').default(sql`'{}'`),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── enrollment_kyc ───
export const enrollmentKyc = pgTable('enrollment_kyc', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  enrollmentId: text('enrollment_id').notNull().references(() => studentEnrollments.id),
  documentType: varchar('document_type', { length: 60 }).notNull(),
  submittedBy: varchar('submitted_by', { length: 10 }).notNull().default('student'),
  fileUrl: text('file_url'),
  documentNumber: varchar('document_number', { length: 100 }),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  verifiedBy: text('verified_by').references(() => users.id),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  notes: text('notes'),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── institution_activity_logs ───
export const institutionActivityLogs = pgTable('institution_activity_logs', {
  id: serial('id').primaryKey(),
  institutionId: text('institution_id').references(() => institutions.id, { onDelete: 'cascade' }),
  action: varchar('action', { length: 100 }).notNull(),
  details: jsonb('details').default(sql`'{}'`),
  performedBy: text('performed_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── notification_broadcasts ───
export const notificationBroadcasts = pgTable('notification_broadcasts', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  targetRoles: text('target_roles').array().default(sql`'{}'`),
  targetIds: text('target_ids').array().default(sql`'{}'`),
  channels: text('channels').array().default(sql`'{in_app}'`),
  sentCount: integer('sent_count').default(0),
  status: varchar('status', { length: 30 }).default('draft'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdBy: text('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── psychometric_questions ───
export const psychometricQuestions = pgTable('psychometric_questions', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  questionCode: varchar('question_code', { length: 80 }).unique(),
  domainId: integer('domain_id').references(() => assessmentDomains.id),
  domainCode: varchar('domain_code', { length: 10 }).notNull(),
  subdomainId: text('subdomain_id').references(() => assessmentSubdomains.id),
  subdomainCode: varchar('subdomain_code', { length: 50 }),
  ageBandCode: varchar('age_band_code', { length: 10 }).notNull(),
  questionType: varchar('question_type', { length: 30 }).default('likert'),
  questionText: text('question_text').notNull(),
  optionA: text('option_a').default('Strongly Disagree'),
  optionB: text('option_b').default('Disagree'),
  optionC: text('option_c').default('Neutral'),
  optionD: text('option_d').default('Agree'),
  optionE: text('option_e').default('Strongly Agree'),
  optionAScore: integer('option_a_score').default(1),
  optionBScore: integer('option_b_score').default(2),
  optionCScore: integer('option_c_score').default(3),
  optionDScore: integer('option_d_score').default(4),
  optionEScore: integer('option_e_score').default(5),
  reverseScored: boolean('reverse_scored').default(false),
  difficulty: varchar('difficulty', { length: 20 }).default('medium'),
  explanation: text('explanation'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── scoring_config_versions ───
export const scoringConfigVersions = pgTable('scoring_config_versions', {
  id: serial('id').primaryKey(),
  version: varchar('version', { length: 20 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  notes: text('notes'),
  publishedBy: text('published_by').references(() => users.id),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── scoring_modules ───
export const scoringModules = pgTable('scoring_modules', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 10 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  formula: text('formula').notNull(),
  weights: text('weights').notNull(),
  bands: text('bands').notNull(),
  color: varchar('color', { length: 10 }).default('#344E86'),
  sortOrder: integer('sort_order').default(0),
  status: varchar('status', { length: 20 }).default('Active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── scoring_domain_config ───
export const scoringDomainConfig = pgTable('scoring_domain_config', {
  id: serial('id').primaryKey(),
  domain: varchar('domain', { length: 255 }).notNull(),
  subdomain: varchar('subdomain', { length: 255 }).notNull(),
  moduleCode: varchar('module_code', { length: 10 }).notNull(),
  ageBandScope: varchar('age_band_scope', { length: 20 }).default('A-E3'),
  weightPercent: integer('weight_percent').notNull().default(0),
  status: varchar('status', { length: 20 }).default('Active'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── scoring_age_band_norms ───
export const scoringAgeBandNorms = pgTable('scoring_age_band_norms', {
  id: serial('id').primaryKey(),
  band: varchar('band', { length: 10 }).notNull().unique(),
  grades: varchar('grades', { length: 50 }),
  ages: varchar('ages', { length: 30 }),
  p20: numeric('p20', { precision: 5, scale: 1 }).notNull(),
  p40: numeric('p40', { precision: 5, scale: 1 }).notNull(),
  p60: numeric('p60', { precision: 5, scale: 1 }).notNull(),
  p80: numeric('p80', { precision: 5, scale: 1 }).notNull(),
  sampleSize: integer('sample_size').default(0),
  standardError: numeric('standard_error', { precision: 4, scale: 2 }).default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── concern_areas ───
export const concernAreas = pgTable('concern_areas', {
  id: serial('id').primaryKey(),
  category: varchar('category', { length: 50 }).notNull(),
  concernArea: varchar('concern_area', { length: 255 }).notNull(),
  parentWorry: varchar('parent_worry', { length: 500 }).notNull(),
  impactOnChild: varchar('impact_on_child', { length: 500 }).notNull(),
  searchKeywords: text('search_keywords'),
  assessmentType: varchar('assessment_type', { length: 50 }).default('lbi'),
  services: jsonb('services').$type<string[]>().default([]).notNull(),
  roles: jsonb('roles').$type<string[]>().default([]).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── short_assessment_questions ───
// Questions for short assessments grouped by concern_area + stage.
// Stages: Curiosity (free), Insight (paid L1), Growth (paid L2), Mastery (paid L3)
export const shortAssessmentQuestions = pgTable('short_assessment_questions', {
  id: serial('id').primaryKey(),
  concernAreaId: integer('concern_area_id').references(() => concernAreas.id, { onDelete: 'cascade' }),
  questionCode: varchar('question_code', { length: 30 }).notNull(),
  stage: varchar('stage', { length: 20 }).notNull(),
  ageBand: varchar('age_band', { length: 20 }),
  isAnchor: boolean('is_anchor').default(false).notNull(),
  focusArea: varchar('focus_area', { length: 100 }),
  layer: varchar('layer', { length: 50 }),
  dimension: varchar('dimension', { length: 100 }),
  questionText: text('question_text').notNull(),
  responseOptions: varchar('response_options', { length: 200 }),
  polarity: varchar('polarity', { length: 10 }),
  weight: varchar('weight', { length: 10 }).default('1'),
  logic: varchar('logic', { length: 100 }),
  options: jsonb('options').$type<Array<{ key: string; text: string; score: number }>>().default([]),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── chat_preferences ───
export const chatPreferences = pgTable('chat_preferences', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  pausePref: varchar('pause_pref', { length: 16 }).notNull().default('none'),
  responseStyle: varchar('response_style', { length: 16 }).notNull().default('standard'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── scoring_formula_params ───
export const scoringFormulaParams = pgTable('scoring_formula_params', {
  id: serial('id').primaryKey(),
  moduleCode: varchar('module_code', { length: 10 }).notNull(),
  paramKey: varchar('param_key', { length: 50 }).notNull(),
  label: varchar('label', { length: 255 }).notNull(),
  value: varchar('value', { length: 50 }).notNull(),
  editable: boolean('editable').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  unique().on(t.moduleCode, t.paramKey),
]);

// ─── parent_tests ──────────────────────────────────────────────────────────────
export const parentTests = pgTable('parent_tests', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  parentId: text('parent_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }).notNull(),
  subject: varchar('subject', { length: 100 }).notNull(),
  description: text('description'),
  duration: integer('duration').default(30),
  totalMarks: integer('total_marks').default(0),
  questions: jsonb('questions').default([]),
  status: varchar('status', { length: 30 }).default('published'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const parentTestAssignments = pgTable('parent_test_assignments', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  testId: text('test_id').notNull().references(() => parentTests.id, { onDelete: 'cascade' }),
  childId: text('child_id').notNull().references(() => children.id, { onDelete: 'cascade' }),
  parentId: text('parent_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 30 }).default('pending'),
  score: integer('score'),
  totalMarks: integer('total_marks'),
  answers: jsonb('answers').default({}),
  dueDate: timestamp('due_date', { withTimezone: true }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── stakeholder_observations ── (Gap 1: Teacher/Counsellor Survey) ──────────
export const stakeholderObservations = pgTable('stakeholder_observations', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  childId: text('child_id').notNull().references(() => children.id, { onDelete: 'cascade' }),
  observerId: text('observer_id').references(() => users.id),
  observerType: varchar('observer_type', { length: 30 }).notNull(), // 'teacher' | 'counsellor' | 'school_admin'
  observerName: varchar('observer_name', { length: 255 }),
  observerOrg: varchar('observer_org', { length: 255 }),
  period: varchar('period', { length: 50 }), // e.g. 'Term 1 2025', 'Week of Apr-23'
  academicBehavior: jsonb('academic_behavior').default({}), // {attention, participation, homework, peerInteraction, ...}
  emotionalBehavior: jsonb('emotional_behavior').default({}), // {mood, stressSignals, confidence, ...}
  socialBehavior: jsonb('social_behavior').default({}), // {teamwork, leadership, communication, ...}
  concerns: text('concerns'),
  strengths: text('strengths'),
  recommendations: text('recommendations'),
  overallRating: integer('overall_rating'), // 1-5
  followUpRequired: boolean('follow_up_required').default(false),
  sharedWithParent: boolean('shared_with_parent').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── parent_observations ── (Gap 2: Parent Periodic Survey) ───────────────────
export const parentObservations = pgTable('parent_observations', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  childId: text('child_id').notNull().references(() => children.id, { onDelete: 'cascade' }),
  parentId: text('parent_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  period: varchar('period', { length: 50 }).notNull(), // e.g. 'Apr-2025'
  homeEnvironment: jsonb('home_environment').default({}), // {sleepQuality, screenTime, studyRoutine, mealPattern}
  emotionalState: jsonb('emotional_state').default({}),  // {moodStability, anxietyLevel, socialWithdrawal, confidence}
  academicEngagement: jsonb('academic_engagement').default({}), // {homeworkCompletion, interestInStudy, askingQuestions}
  physicalWellness: jsonb('physical_wellness').default({}), // {sleepHours, exerciseFreq, complaints}
  parentConcerns: text('parent_concerns'),
  notableChanges: text('notable_changes'),
  supportNeeded: text('support_needed'),
  overallMood: varchar('overall_mood', { length: 30 }), // 'excellent'|'good'|'average'|'concerning'|'critical'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── mentor_session_notes ── (Gap 5: Mentor Session Notes) ───────────────────
export const mentorSessionNotes = pgTable('mentor_session_notes', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  bookingId: text('booking_id').references(() => mentorBookings.id, { onDelete: 'cascade' }),
  mentorId: integer('mentor_id').references(() => mentorProfiles.id, { onDelete: 'cascade' }),
  childId: text('child_id').references(() => children.id, { onDelete: 'cascade' }),
  sessionDate: timestamp('session_date', { withTimezone: true }),
  sessionType: varchar('session_type', { length: 50 }), // 'preliminary'|'deep-dive'|'ongoing'
  domainsWorkedOn: jsonb('domains_worked_on').default([]), // ['Focus & Attention', 'Confidence', ...]
  sessionSummary: text('session_summary').notNull(),
  progressObserved: text('progress_observed'),
  areasForImprovement: text('areas_for_improvement'),
  homeworkAssigned: text('homework_assigned'),
  nextSessionGoals: text('next_session_goals'),
  parentVisibility: boolean('parent_visibility').default(true),
  studentVisibility: boolean('student_visibility').default(true),
  overallProgress: varchar('overall_progress', { length: 30 }).default('on-track'), // 'excellent'|'on-track'|'needs-work'|'stagnant'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── interview_question_bank ───────────────────────────────────────────────────
export const interviewQuestionBank = pgTable('interview_question_bank', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  question: text('question').notNull(),
  expectedResponse: text('expected_response'),   // ideal/tentative answer
  scoringCriteria: text('scoring_criteria'),      // what AI looks for
  category: varchar('category', { length: 80 }).notNull().default('Behavioral'),
  // 'Behavioral' | 'Technical' | 'Situational' | 'HR' | 'Culture Fit' | 'Leadership' | 'Problem Solving'
  industry: varchar('industry', { length: 100 }).notNull().default('General'),
  // 'General' | 'Technology' | 'Finance' | 'Healthcare' | 'Manufacturing' | 'Retail' | 'Education' | 'Sales & Marketing'
  role: varchar('role', { length: 200 }).notNull().default('General'),
  // e.g. 'Software Engineer', 'Data Analyst', 'Product Manager', 'Sales Executive'
  positionLevel: varchar('position_level', { length: 50 }).notNull().default('Any'),
  // 'Fresher' | 'Junior' | 'Mid-Level' | 'Senior' | 'Lead' | 'Manager' | 'Any'
  difficulty: varchar('difficulty', { length: 20 }).notNull().default('Medium'),
  // 'Easy' | 'Medium' | 'Hard'
  isActive: boolean('is_active').notNull().default(true),
  tags: text('tags').array().default(sql`'{}'`),
  createdBy: varchar('created_by', { length: 200 }).default('system'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── study_tasks ───────────────────────────────────────────────────────────────
export const studyTasks = pgTable('study_tasks', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  childId: text('child_id').notNull().references(() => children.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  taskType: varchar('task_type', { length: 50 }).default('study'),
  status: varchar('status', { length: 30 }).default('pending'),
  priority: varchar('priority', { length: 20 }).default('Medium'),
  dueDate: timestamp('due_date', { withTimezone: true }),
  estimatedMinutes: integer('estimated_minutes'),
  subject: varchar('subject', { length: 100 }),
  chapter: varchar('chapter', { length: 200 }),
  assignedBy: text('assigned_by').references(() => users.id),
  assignedByRole: varchar('assigned_by_role', { length: 30 }),
  assignedByName: varchar('assigned_by_name', { length: 200 }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
