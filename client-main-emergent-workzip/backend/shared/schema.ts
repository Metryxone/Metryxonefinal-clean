import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, real, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table (authentication)
// CANONICAL users definition — live-DB-matched (7 cols confirmed 2026-05-09).
// Aspirational columns (mobile, email, password_hash, is_active, is_verified,
// profile_picture, metadata, platform_id, updated_at) exist in
// frontend/server/src/db/schema.ts (pre-S5) but are NOT in the live DB.
// Phase 1 migration will add them (Task #117). Do NOT add them here until migrated.
// frontend/server/src/db/schema.ts re-exports from here; do NOT define users there.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name"),
  role: text("role").notNull().default('parent'),
  roles: text("roles").array().notNull().default(sql`ARRAY['parent']::text[]`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  email: text("email"),
  phone: text("phone"),
  accountType: text("account_type").default('job_seeker'),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  // SECURITY: account_type must NEVER be client-settable on self-registration.
  // It is provisioned server-side only (e.g. POST /api/employer/register raw UPDATE).
  accountType: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Institute table
export const institutes = pgTable("institutes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminUserId: varchar("admin_user_id").references(() => users.id, { onDelete: 'set null' }),
  instituteCode: text("institute_code").notNull().unique(),
  legalName: text("legal_name").notNull(),
  displayName: text("display_name").notNull(),
  status: text("status").notNull().default('Active'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertInstituteSchema = createInsertSchema(institutes).omit({
  id: true,
  createdAt: true,
});

export type InsertInstitute = z.infer<typeof insertInstituteSchema>;
export type Institute = typeof institutes.$inferSelect;

// Batch table
export const batches = pgTable("batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  instituteId: varchar("institute_id").notNull().references(() => institutes.id, { onDelete: 'cascade' }),
  batchCode: text("batch_code").notNull(),
  batchName: text("batch_name").notNull(),
  academicYear: text("academic_year").notNull(),
  status: text("status").notNull().default('Active'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBatchSchema = createInsertSchema(batches).omit({
  id: true,
  createdAt: true,
});

export type InsertBatch = z.infer<typeof insertBatchSchema>;
export type Batch = typeof batches.$inferSelect;

// Parent table (linked to user)
export const parents = pgTable("parents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  fullName: text("full_name").notNull(),
  mobile: text("mobile"),
  status: text("status").notNull().default('Active'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertParentSchema = createInsertSchema(parents).omit({
  id: true,
  createdAt: true,
});

export type InsertParent = z.infer<typeof insertParentSchema>;
export type Parent = typeof parents.$inferSelect;

// Student table (linked to user and institute)
export const students = pgTable("students", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'set null' }),
  instituteId: varchar("institute_id").references(() => institutes.id, { onDelete: 'set null' }),
  studentCode: text("student_code").notNull().unique(),
  fullName: text("full_name").notNull(),
  dob: date("dob"),
  status: text("status").notNull().default('Active'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertStudentSchema = createInsertSchema(students).omit({
  id: true,
  createdAt: true,
});

export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof students.$inferSelect;

// Parent-Student Link (for multi-child support)
export const parentStudentLinks = pgTable("parent_student_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  parentId: varchar("parent_id").notNull().references(() => parents.id, { onDelete: 'cascade' }),
  studentId: varchar("student_id").notNull().references(() => students.id, { onDelete: 'cascade' }),
  relationship: text("relationship").default('Parent'),
  lbiConsent: boolean("lbi_consent").notNull().default(false),
  consentDate: timestamp("consent_date"),
  consentRevokedDate: timestamp("consent_revoked_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertParentStudentLinkSchema = createInsertSchema(parentStudentLinks).omit({
  id: true,
  createdAt: true,
  consentDate: true,
  consentRevokedDate: true,
});

export type InsertParentStudentLink = z.infer<typeof insertParentStudentLinkSchema>;
export type ParentStudentLink = typeof parentStudentLinks.$inferSelect;

// Enrollment Request
export const enrollmentRequests = pgTable("enrollment_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  instituteId: varchar("institute_id").notNull().references(() => institutes.id, { onDelete: 'cascade' }),
  studentId: varchar("student_id").notNull().references(() => students.id, { onDelete: 'cascade' }),
  batchId: varchar("batch_id").notNull().references(() => batches.id, { onDelete: 'cascade' }),
  status: text("status").notNull().default('Submitted'),
  requestedOn: timestamp("requested_on").notNull().defaultNow(),
});

export const insertEnrollmentRequestSchema = createInsertSchema(enrollmentRequests).omit({
  id: true,
});

export type InsertEnrollmentRequest = z.infer<typeof insertEnrollmentRequestSchema>;
export type EnrollmentRequest = typeof enrollmentRequests.$inferSelect;

// Exam table
export const exams = pgTable("exams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  instituteId: varchar("institute_id").notNull().references(() => institutes.id, { onDelete: 'cascade' }),
  examCode: text("exam_code").notNull().unique(),
  examName: text("exam_name").notNull(),
  batchId: varchar("batch_id").notNull().references(() => batches.id, { onDelete: 'cascade' }),
  status: text("status").notNull().default('Draft'),
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertExamSchema = createInsertSchema(exams).omit({
  id: true,
  createdAt: true,
});

export type InsertExam = z.infer<typeof insertExamSchema>;
export type Exam = typeof exams.$inferSelect;

// Assessment Templates - Browsable academic assessments for parents
export const assessmentTemplates = pgTable("assessment_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  subject: text("subject").notNull(),
  grade: text("grade").notNull(), // e.g., "Grade 6", "Grade 7"
  description: text("description"),
  duration: integer("duration").notNull().default(60), // minutes
  totalMarks: integer("total_marks").notNull().default(100),
  difficulty: text("difficulty").notNull().default('Medium'), // Easy, Medium, Hard
  category: text("category").notNull().default('Academic'), // Academic, Practice, Olympiad
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAssessmentTemplateSchema = createInsertSchema(assessmentTemplates).omit({
  id: true,
  createdAt: true,
});

export type InsertAssessmentTemplate = z.infer<typeof insertAssessmentTemplateSchema>;
export type AssessmentTemplate = typeof assessmentTemplates.$inferSelect;

// Assessment Template Questions
export const assessmentTemplateQuestions = pgTable("assessment_template_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull().references(() => assessmentTemplates.id, { onDelete: 'cascade' }),
  questionText: text("question_text").notNull(),
  optionA: text("option_a").notNull(),
  optionB: text("option_b").notNull(),
  optionC: text("option_c"),
  optionD: text("option_d"),
  correctOption: text("correct_option").notNull(),
  marks: integer("marks").notNull().default(1),
  orderIndex: integer("order_index").notNull().default(0),
});

export const insertAssessmentTemplateQuestionSchema = createInsertSchema(assessmentTemplateQuestions).omit({
  id: true,
});

export type InsertAssessmentTemplateQuestion = z.infer<typeof insertAssessmentTemplateQuestionSchema>;
export type AssessmentTemplateQuestion = typeof assessmentTemplateQuestions.$inferSelect;

// Exam Questions
export const examQuestions = pgTable("exam_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  examId: varchar("exam_id").notNull().references(() => exams.id, { onDelete: 'cascade' }),
  questionText: text("question_text").notNull(),
  optionA: text("option_a").notNull(),
  optionB: text("option_b").notNull(),
  optionC: text("option_c"),
  optionD: text("option_d"),
  correctOption: text("correct_option").notNull(), // 'A', 'B', 'C', 'D'
  marks: integer("marks").notNull().default(1),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertExamQuestionSchema = createInsertSchema(examQuestions).omit({
  id: true,
  createdAt: true,
});

export type InsertExamQuestion = z.infer<typeof insertExamQuestionSchema>;
export type ExamQuestion = typeof examQuestions.$inferSelect;

// Exam Attempt
export const examAttempts = pgTable("exam_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  examId: varchar("exam_id").notNull().references(() => exams.id, { onDelete: 'cascade' }),
  studentId: varchar("student_id").notNull().references(() => students.id, { onDelete: 'cascade' }),
  status: text("status").notNull().default('In Progress'),
  scoreObtained: real("score_obtained"),
  totalMarks: real("total_marks"),
  startedAt: timestamp("started_at").defaultNow(),
  submittedAt: timestamp("submitted_at"),
});

export const insertExamAttemptSchema = createInsertSchema(examAttempts).omit({
  id: true,
});

export type InsertExamAttempt = z.infer<typeof insertExamAttemptSchema>;
export type ExamAttempt = typeof examAttempts.$inferSelect;

// Exam Responses (student answers)
export const examResponses = pgTable("exam_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  attemptId: varchar("attempt_id").notNull().references(() => examAttempts.id, { onDelete: 'cascade' }),
  questionId: varchar("question_id").notNull().references(() => examQuestions.id, { onDelete: 'cascade' }),
  selectedOption: text("selected_option"), // 'A', 'B', 'C', 'D' or null if not answered
  isCorrect: boolean("is_correct"),
  marksObtained: real("marks_obtained").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertExamResponseSchema = createInsertSchema(examResponses).omit({
  id: true,
  createdAt: true,
});

export type InsertExamResponse = z.infer<typeof insertExamResponseSchema>;
export type ExamResponse = typeof examResponses.$inferSelect;

// LBI Type
export const lbiTypes = pgTable("lbi_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  typeName: text("type_name").notNull().unique(),
  description: text("description"),
  status: text("status").notNull().default('Active'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLbiTypeSchema = createInsertSchema(lbiTypes).omit({
  id: true,
  createdAt: true,
});

export type InsertLbiType = z.infer<typeof insertLbiTypeSchema>;
export type LbiType = typeof lbiTypes.$inferSelect;

// LBI Assessment
export const lbiAssessments = pgTable("lbi_assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assessmentCode: text("assessment_code").notNull().unique(),
  assessmentName: text("assessment_name").notNull(),
  lbiTypeId: varchar("lbi_type_id").notNull().references(() => lbiTypes.id, { onDelete: 'cascade' }),
  totalQuestions: integer("total_questions").notNull(),
  status: text("status").notNull().default('Active'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLbiAssessmentSchema = createInsertSchema(lbiAssessments).omit({
  id: true,
  createdAt: true,
});

export type InsertLbiAssessment = z.infer<typeof insertLbiAssessmentSchema>;
export type LbiAssessment = typeof lbiAssessments.$inferSelect;

// @deprecated — lbi_questions_legacy: 0 rows confirmed in production (2026-05-09).
// Old psychopsis question system superseded by sdi_items / short_assessment_questions.
// COMMENTED OUT so no new code can import this table definition.
// DROP TABLE guard migration: backend/migrations/20260509_core_tables_baseline.sql (DO block).
// Uncomment ONLY if a rollback is needed. Safe to physically DROP in Phase 1.
// ─── COMMENTED OUT ───────────────────────────────────────────────────────────────
// export const lbiQuestionsLegacy = pgTable("lbi_questions_legacy", {
//   id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
//   questionCode: text("question_code").notNull(),
//   lbiTypeId: varchar("lbi_type_id").notNull().references(() => lbiTypes.id, { onDelete: 'cascade' }),
//   difficultyLevel: integer("difficulty_level").notNull(),
//   questionText: text("question_text").notNull(),
//   status: text("status").notNull().default('Draft'),
//   createdAt: timestamp("created_at").notNull().defaultNow(),
// });
// export const insertLbiQuestionLegacySchema = createInsertSchema(lbiQuestionsLegacy).omit({ id: true, createdAt: true });
// export type InsertLbiQuestionLegacy = z.infer<typeof insertLbiQuestionLegacySchema>;
// export type LbiQuestionLegacy = typeof lbiQuestionsLegacy.$inferSelect;
// ─────────────────────────────────────────────────────────────────────────────────

// NOTE: This definition MATCHES the live lbi_sessions table (assessment_id + student_id).
// The CONSUMER model (child_id × module_id) is defined in frontend/server/src/db/schema.ts
// but has NOT yet been applied to the live DB — the live table still uses these columns.
// The INSTITUTE assessment flow also uses lbi_assessment_sessions (raw SQL, backend/routes.ts
// ~line 10650), which is a SEPARATE table. Phase 1: decide whether to migrate lbi_sessions
// to the consumer model or keep both tables. See DATABASE_INVENTORY.md §lbi_sessions reconciliation.
export const lbiSessions = pgTable("lbi_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assessmentId: varchar("assessment_id").notNull().references(() => lbiAssessments.id, { onDelete: 'cascade' }),
  studentId: varchar("student_id").notNull().references(() => students.id, { onDelete: 'cascade' }),
  status: text("status").notNull().default('Not Started'),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

export const insertLbiSessionSchema = createInsertSchema(lbiSessions).omit({
  id: true,
});

export type InsertLbiSession = z.infer<typeof insertLbiSessionSchema>;
export type LbiSession = typeof lbiSessions.$inferSelect;

// Consent Log for audit trail (DPDP compliance)
export const consentLogs = pgTable("consent_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  parentStudentLinkId: varchar("parent_student_link_id").notNull().references(() => parentStudentLinks.id, { onDelete: 'cascade' }),
  parentId: varchar("parent_id").notNull().references(() => parents.id, { onDelete: 'cascade' }),
  action: text("action").notNull(),
  reason: text("reason"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertConsentLogSchema = createInsertSchema(consentLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertConsentLog = z.infer<typeof insertConsentLogSchema>;
export type ConsentLog = typeof consentLogs.$inferSelect;

// Behavioural Insights (LBI data) - for production students table
export const behaviouralInsights = pgTable("behavioural_insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull(),
  category: text("category").notNull(),
  metric: text("metric").notNull(),
  value: integer("value"),
  description: text("description"),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
});

export const insertBehaviouralInsightSchema = createInsertSchema(behaviouralInsights).omit({
  id: true,
});

export type InsertBehaviouralInsight = z.infer<typeof insertBehaviouralInsightSchema>;
export type BehaviouralInsight = typeof behaviouralInsights.$inferSelect;

// ============================================
// PSYCHOMETRIC ASSESSMENT FRAMEWORK
// ============================================

// Age Bands for psychometric assessments
export const psychometricAgeBands = pgTable("psychometric_age_bands", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bandCode: text("band_code").notNull().unique(), // A, B, C, D, E, E1
  bandName: text("band_name").notNull(), // Primary school, Upper primary, etc.
  ageRangeStart: integer("age_range_start").notNull(), // 8, 10, 12, 14, 16, 19
  ageRangeEnd: integer("age_range_end"), // 9, 11, 13, 15, 18, null for 19+
  context: text("context").notNull(), // Primary school, Corporate, etc.
  displayOrder: integer("display_order").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPsychometricAgeBandSchema = createInsertSchema(psychometricAgeBands).omit({
  id: true,
  createdAt: true,
});

export type InsertPsychometricAgeBand = z.infer<typeof insertPsychometricAgeBandSchema>;
export type PsychometricAgeBand = typeof psychometricAgeBands.$inferSelect;

// Psychometric Domains (20 domains)
export const psychometricDomains = pgTable("psychometric_domains", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  domainCode: text("domain_code").notNull().unique(),
  domainName: text("domain_name").notNull(),
  description: text("description"),
  category: text("category").default('Core'), // Core, Optional, Add-on
  displayOrder: integer("display_order").notNull().default(1),
  iconName: text("icon_name"), // For UI display
  colorCode: text("color_code"), // Hex color for UI
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPsychometricDomainSchema = createInsertSchema(psychometricDomains).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPsychometricDomain = z.infer<typeof insertPsychometricDomainSchema>;
export type PsychometricDomain = typeof psychometricDomains.$inferSelect;

// Psychometric Subdomains (linked to domains)
export const psychometricSubdomains = pgTable("psychometric_subdomains", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  domainId: varchar("domain_id").notNull().references(() => psychometricDomains.id, { onDelete: 'cascade' }),
  subdomainCode: text("subdomain_code").notNull().unique(),
  subdomainName: text("subdomain_name").notNull(),
  description: text("description"),
  measurementScale: text("measurement_scale").default('1-10'), // Rating scale
  displayOrder: integer("display_order").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPsychometricSubdomainSchema = createInsertSchema(psychometricSubdomains).omit({
  id: true,
  createdAt: true,
});

export type InsertPsychometricSubdomain = z.infer<typeof insertPsychometricSubdomainSchema>;
export type PsychometricSubdomain = typeof psychometricSubdomains.$inferSelect;

// Domain-AgeBand Configuration (which domains are active for which age bands)
export const psychometricDomainAgeBandConfig = pgTable("psychometric_domain_age_band_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  domainId: varchar("domain_id").notNull().references(() => psychometricDomains.id, { onDelete: 'cascade' }),
  ageBandId: varchar("age_band_id").notNull().references(() => psychometricAgeBands.id, { onDelete: 'cascade' }),
  isEnabled: boolean("is_enabled").notNull().default(true),
  questionsCount: integer("questions_count").default(10), // Number of questions for this domain/age combo
  weightage: real("weightage").default(1.0), // Scoring weightage
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPsychometricDomainAgeBandConfigSchema = createInsertSchema(psychometricDomainAgeBandConfig).omit({
  id: true,
  createdAt: true,
});

export type InsertPsychometricDomainAgeBandConfig = z.infer<typeof insertPsychometricDomainAgeBandConfigSchema>;
export type PsychometricDomainAgeBandConfig = typeof psychometricDomainAgeBandConfig.$inferSelect;

// Psychometric Question Bank (age-specific questions)
export const psychometricQuestionBank = pgTable("psychometric_question_bank", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  questionCode: text("question_code").notNull().unique(),
  domainId: varchar("domain_id").notNull().references(() => psychometricDomains.id, { onDelete: 'cascade' }),
  subdomainId: varchar("subdomain_id").references(() => psychometricSubdomains.id, { onDelete: 'set null' }),
  ageBandId: varchar("age_band_id").notNull().references(() => psychometricAgeBands.id, { onDelete: 'cascade' }),
  questionText: text("question_text").notNull(),
  questionType: text("question_type").notNull().default('Likert'), // Likert, MCQ, Scenario, SituationalJudgment
  responseOptions: text("response_options"), // JSON array of options
  scoringLogic: text("scoring_logic"), // JSON scoring rules
  reverseScored: boolean("reverse_scored").notNull().default(false),
  difficulty: text("difficulty").default('Medium'), // Easy, Medium, Hard
  language: text("language").notNull().default('EN'),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPsychometricQuestionBankSchema = createInsertSchema(psychometricQuestionBank).omit({
  id: true,
  createdAt: true,
});

export type InsertPsychometricQuestionBank = z.infer<typeof insertPsychometricQuestionBankSchema>;
export type PsychometricQuestionBank = typeof psychometricQuestionBank.$inferSelect;

// Psychometric Assessment Results
export const psychometricAssessmentResults = pgTable("psychometric_assessment_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull(),
  ageBandId: varchar("age_band_id").notNull().references(() => psychometricAgeBands.id, { onDelete: 'cascade' }),
  domainId: varchar("domain_id").notNull().references(() => psychometricDomains.id, { onDelete: 'cascade' }),
  subdomainId: varchar("subdomain_id").references(() => psychometricSubdomains.id, { onDelete: 'set null' }),
  rawScore: real("raw_score"),
  percentileScore: real("percentile_score"),
  scaledScore: real("scaled_score"),
  interpretation: text("interpretation"), // Low, Average, High, etc.
  recommendations: text("recommendations"),
  assessedAt: timestamp("assessed_at").notNull().defaultNow(),
});

export const insertPsychometricAssessmentResultSchema = createInsertSchema(psychometricAssessmentResults).omit({
  id: true,
  assessedAt: true,
});

export type InsertPsychometricAssessmentResult = z.infer<typeof insertPsychometricAssessmentResultSchema>;
export type PsychometricAssessmentResult = typeof psychometricAssessmentResults.$inferSelect;

// Legacy: Children table — backward compatibility only. NO NEW CODE SHOULD WRITE TO THIS TABLE.
// Kept here solely so existing backend routes that JOIN children compile without changes.
// Note: frontend/server/src/db/schema.ts also defines children with a richer column set,
// but that definition is also drifted from the live DB (see DATABASE_INVENTORY.md §Schema Drift).
// Phase 1 will reconcile both into a single migrated canonical definition.
export const children = pgTable("children", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  parentId: varchar("parent_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  studentUserId: varchar("student_user_id").references(() => users.id, { onDelete: 'set null' }),
  name: text("name").notNull(),
  age: integer("age").notNull(),
  grade: text("grade").notNull(),
  classSection: text("class_section"),
  schoolName: text("school_name"),
  rollNumber: text("roll_number"),
  gender: text("gender"),
  dateOfBirth: date("date_of_birth"),
  bloodGroup: text("blood_group"),
  primaryLanguage: text("primary_language"),
  educationBoard: text("education_board"),
  city: text("city"),
  state: text("state"),
  specialNeeds: text("special_needs"),
  // New analytics fields
  studyHours: text("study_hours"),
  favoriteSubjects: text("favorite_subjects").array(),
  weakSubjects: text("weak_subjects").array(),
  learningStyle: text("learning_style"),
  careerInterest: text("career_interest"),
  relationship: text("relationship"),
  schoolType: text("school_type"),
  mediumOfInstruction: text("medium_of_instruction"),
  extracurricular: text("extracurricular"),
  emergencyContact: text("emergency_contact"),
  medicalConditions: text("medical_conditions"),
  // Consent fields
  lbiConsent: boolean("lbi_consent").notNull().default(false),
  dataCollectionConsent: boolean("data_collection_consent").notNull().default(false),
  dpdpConsent: boolean("dpdp_consent").notNull().default(false),
  developmentAcknowledgment: boolean("development_acknowledgment").notNull().default(false),
  progressSharingConsent: boolean("progress_sharing_consent").notNull().default(false),
  consentDate: timestamp("consent_date"),
  consentRevokedDate: timestamp("consent_revoked_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertChildSchema = createInsertSchema(children).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  consentDate: true,
  consentRevokedDate: true,
});

export type InsertChild = z.infer<typeof insertChildSchema>;
export type Child = typeof children.$inferSelect;

// Child Exams (for legacy children table - dashboard display)
export const childExams = pgTable("child_exams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  childId: varchar("child_id").notNull().references(() => children.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  subject: text("subject").notNull(),
  grade: text("grade"),
  examType: text("exam_type").notNull().default('academic'),
  status: text("status").notNull().default('pending'),
  score: integer("score"),
  totalMarks: integer("total_marks").notNull().default(100),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  improvedTopics: text("improved_topics").array(),
  focusAreas: text("focus_areas").array(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertChildExamSchema = createInsertSchema(childExams).omit({
  id: true,
  createdAt: true,
});

export type InsertChildExam = z.infer<typeof insertChildExamSchema>;
export type ChildExam = typeof childExams.$inferSelect;

// Child Exam Questions (for parent-assigned assessments)
export const childExamQuestions = pgTable("child_exam_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  childExamId: varchar("child_exam_id").notNull().references(() => childExams.id, { onDelete: 'cascade' }),
  questionText: text("question_text").notNull(),
  optionA: text("option_a").notNull(),
  optionB: text("option_b").notNull(),
  optionC: text("option_c"),
  optionD: text("option_d"),
  correctOption: text("correct_option").notNull(),
  marks: integer("marks").notNull().default(1),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertChildExamQuestionSchema = createInsertSchema(childExamQuestions).omit({
  id: true,
  createdAt: true,
});

export type InsertChildExamQuestion = z.infer<typeof insertChildExamQuestionSchema>;
export type ChildExamQuestion = typeof childExamQuestions.$inferSelect;

// Legacy: LBI Categories (keeping for backward compatibility)
export const lbiCategories = pgTable("psychopsis_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default('active'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLbiCategorySchema = createInsertSchema(lbiCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLbiCategory = z.infer<typeof insertLbiCategorySchema>;
export type LbiCategory = typeof lbiCategories.$inferSelect;

// Supervised Test Sessions (for parental monitoring of minor exams)
export const supervisedTestSessions = pgTable("supervised_test_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  examId: varchar("exam_id").notNull().references(() => childExams.id, { onDelete: 'cascade' }),
  parentId: varchar("parent_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  childId: varchar("child_id").notNull().references(() => children.id, { onDelete: 'cascade' }),
  status: text("status").notNull().default('active'),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
});

export const insertSupervisedTestSessionSchema = createInsertSchema(supervisedTestSessions).omit({
  id: true,
  startedAt: true,
});

export type InsertSupervisedTestSession = z.infer<typeof insertSupervisedTestSessionSchema>;
export type SupervisedTestSession = typeof supervisedTestSessions.$inferSelect;

// NOTE: This definition MATCHES the live lbi_modules table (varchar id, no subModules/domainCodes).
// frontend/server/src/db/schema.ts has an aspirational version (serial id, subModules jsonb,
// domainCodes text[]) that has NOT been applied to the live DB yet.
// Phase 1: migrate live table to the richer consumer schema. See DATABASE_INVENTORY.md.
export const lbiModules = pgTable("lbi_modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleCode: text("module_code").notNull().unique(),
  moduleName: text("module_name").notNull(),
  description: text("description"),
  displayOrder: integer("display_order").notNull().default(0),
  status: text("status").notNull().default('Active'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLbiModuleSchema = createInsertSchema(lbiModules).omit({
  id: true,
  createdAt: true,
});

export type InsertLbiModule = z.infer<typeof insertLbiModuleSchema>;
export type LbiModule = typeof lbiModules.$inferSelect;

// LBI Sub-Modules (e.g., 1A, 1B, 1C for Module 1)
export const lbiSubModules = pgTable("lbi_sub_modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleId: varchar("module_id").notNull().references(() => lbiModules.id, { onDelete: 'cascade' }),
  subModuleCode: text("sub_module_code").notNull().unique(),
  subModuleName: text("sub_module_name").notNull(),
  questionType: text("question_type").notNull().default('likert'),
  description: text("description"),
  displayOrder: integer("display_order").notNull().default(0),
  status: text("status").notNull().default('Active'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLbiSubModuleSchema = createInsertSchema(lbiSubModules).omit({
  id: true,
  createdAt: true,
});

export type InsertLbiSubModule = z.infer<typeof insertLbiSubModuleSchema>;
export type LbiSubModule = typeof lbiSubModules.$inferSelect;

// Age Groups for difficulty selection
export const lbiAgeGroups = pgTable("lbi_age_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupCode: text("group_code").notNull().unique(),
  groupName: text("group_name").notNull(),
  minAge: integer("min_age").notNull(),
  maxAge: integer("max_age").notNull(),
  difficultyLevel: integer("difficulty_level").notNull(),
  status: text("status").notNull().default('Active'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLbiAgeGroupSchema = createInsertSchema(lbiAgeGroups).omit({
  id: true,
  createdAt: true,
});

export type InsertLbiAgeGroup = z.infer<typeof insertLbiAgeGroupSchema>;
export type LbiAgeGroup = typeof lbiAgeGroups.$inferSelect;

// Question Bank Items (enhanced for all question types)
export const lbiQuestionBank = pgTable("lbi_question_bank", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subModuleId: varchar("sub_module_id").notNull().references(() => lbiSubModules.id, { onDelete: 'cascade' }),
  questionCode: text("question_code").notNull().unique(),
  setNumber: integer("set_number"),
  difficultyLevel: integer("difficulty_level").notNull().default(1),
  questionType: text("question_type").notNull().default('likert'),
  questionText: text("question_text").notNull(),
  passageText: text("passage_text"),
  keying: text("keying").notNull().default('Positive'),
  optionA: text("option_a"),
  optionAScore: integer("option_a_score"),
  optionB: text("option_b"),
  optionBScore: integer("option_b_score"),
  optionC: text("option_c"),
  optionCScore: integer("option_c_score"),
  optionD: text("option_d"),
  optionDScore: integer("option_d_score"),
  optionE: text("option_e"),
  optionEScore: integer("option_e_score"),
  correctAnswer: text("correct_answer"),
  explanation: text("explanation"),
  subject: text("subject"),
  ageGroupId: varchar("age_group_id"),
  language: text("language").default('EN'),
  anchor: boolean("anchor").notNull().default(false),
  status: text("status").notNull().default('Active'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLbiQuestionBankSchema = createInsertSchema(lbiQuestionBank).omit({
  id: true,
  createdAt: true,
});

export type InsertLbiQuestionBank = z.infer<typeof insertLbiQuestionBankSchema>;
export type LbiQuestionBank = typeof lbiQuestionBank.$inferSelect;

// Student Assessment Sessions (tracking assessment progress)
export const studentAssessmentSessions = pgTable("student_assessment_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull(),
  moduleId: varchar("module_id").notNull().references(() => lbiModules.id, { onDelete: 'cascade' }),
  ageGroupId: varchar("age_group_id").references(() => lbiAgeGroups.id, { onDelete: 'set null' }),
  status: text("status").notNull().default('Not Started'),
  totalQuestions: integer("total_questions").notNull().default(0),
  questionsAnswered: integer("questions_answered").notNull().default(0),
  rawScore: real("raw_score"),
  percentileScore: real("percentile_score"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertStudentAssessmentSessionSchema = createInsertSchema(studentAssessmentSessions).omit({
  id: true,
  createdAt: true,
});

export type InsertStudentAssessmentSession = z.infer<typeof insertStudentAssessmentSessionSchema>;
export type StudentAssessmentSession = typeof studentAssessmentSessions.$inferSelect;

// Student Assessment Responses (individual question responses)
export const studentAssessmentResponses = pgTable("student_assessment_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => studentAssessmentSessions.id, { onDelete: 'cascade' }),
  questionId: varchar("question_id").notNull().references(() => lbiQuestionBank.id, { onDelete: 'cascade' }),
  selectedOption: text("selected_option"),
  textResponse: text("text_response"),
  score: integer("score"),
  responseTimeMs: integer("response_time_ms"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertStudentAssessmentResponseSchema = createInsertSchema(studentAssessmentResponses).omit({
  id: true,
  createdAt: true,
});

export type InsertStudentAssessmentResponse = z.infer<typeof insertStudentAssessmentResponseSchema>;
export type StudentAssessmentResponse = typeof studentAssessmentResponses.$inferSelect;

// Competency Library (300 behavioral competencies)
export const competencyLibrary = pgTable("competency_library", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  competencyNumber: integer("competency_number").notNull().unique(),
  competencyName: text("competency_name").notNull(),
  domain: text("domain"),
  subDomain: text("sub_domain"),
  description: text("description"),
  status: text("status").notNull().default('Active'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCompetencyLibrarySchema = createInsertSchema(competencyLibrary).omit({
  id: true,
  createdAt: true,
});

export type InsertCompetencyLibrary = z.infer<typeof insertCompetencyLibrarySchema>;
export type CompetencyLibrary = typeof competencyLibrary.$inferSelect;

// Student Competency Scores (mapped from assessment results)
export const studentCompetencyScores = pgTable("student_competency_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull(),
  competencyId: varchar("competency_id").notNull().references(() => competencyLibrary.id, { onDelete: 'cascade' }),
  sessionId: varchar("session_id").references(() => studentAssessmentSessions.id, { onDelete: 'set null' }),
  rawScore: real("raw_score"),
  percentileScore: real("percentile_score"),
  proficiencyLevel: text("proficiency_level"),
  assessedAt: timestamp("assessed_at").notNull().defaultNow(),
});

export const insertStudentCompetencyScoreSchema = createInsertSchema(studentCompetencyScores).omit({
  id: true,
  assessedAt: true,
});

export type InsertStudentCompetencyScore = z.infer<typeof insertStudentCompetencyScoreSchema>;
export type StudentCompetencyScore = typeof studentCompetencyScores.$inferSelect;

// ============================================
// CURRICULUM CATALOG
// ============================================

// Education Boards (CBSE, ICSE, State Boards, etc.)
export const educationBoards = pgTable("education_boards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  boardCode: text("board_code").notNull().unique(),
  boardName: text("board_name").notNull(),
  description: text("description"),
  country: text("country").notNull().default('India'),
  status: text("status").notNull().default('Active'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEducationBoardSchema = createInsertSchema(educationBoards).omit({
  id: true,
  createdAt: true,
});

export type InsertEducationBoard = z.infer<typeof insertEducationBoardSchema>;
export type EducationBoard = typeof educationBoards.$inferSelect;

// Classes/Grades (1-12, etc.)
export const academicClasses = pgTable("academic_classes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  boardId: varchar("board_id").notNull().references(() => educationBoards.id, { onDelete: 'cascade' }),
  classNumber: integer("class_number").notNull(),
  className: text("class_name").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  status: text("status").notNull().default('Active'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAcademicClassSchema = createInsertSchema(academicClasses).omit({
  id: true,
  createdAt: true,
});

export type InsertAcademicClass = z.infer<typeof insertAcademicClassSchema>;
export type AcademicClass = typeof academicClasses.$inferSelect;

// Subjects (Mathematics, Science, English, etc.)
export const academicSubjects = pgTable("academic_subjects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  boardId: varchar("board_id").notNull().references(() => educationBoards.id, { onDelete: 'cascade' }),
  classId: varchar("class_id").notNull().references(() => academicClasses.id, { onDelete: 'cascade' }),
  subjectCode: text("subject_code").notNull(),
  subjectName: text("subject_name").notNull(),
  subjectType: text("subject_type").notNull().default('Core'),
  displayOrder: integer("display_order").notNull().default(0),
  status: text("status").notNull().default('Active'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAcademicSubjectSchema = createInsertSchema(academicSubjects).omit({
  id: true,
  createdAt: true,
});

export type InsertAcademicSubject = z.infer<typeof insertAcademicSubjectSchema>;
export type AcademicSubject = typeof academicSubjects.$inferSelect;

// Chapters within Subjects
export const academicChapters = pgTable("academic_chapters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subjectId: varchar("subject_id").notNull().references(() => academicSubjects.id, { onDelete: 'cascade' }),
  chapterNumber: integer("chapter_number").notNull(),
  chapterName: text("chapter_name").notNull(),
  description: text("description"),
  estimatedHours: real("estimated_hours"),
  displayOrder: integer("display_order").notNull().default(0),
  status: text("status").notNull().default('Active'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAcademicChapterSchema = createInsertSchema(academicChapters).omit({
  id: true,
  createdAt: true,
});

export type InsertAcademicChapter = z.infer<typeof insertAcademicChapterSchema>;
export type AcademicChapter = typeof academicChapters.$inferSelect;

// Topics within Chapters
export const academicTopics = pgTable("academic_topics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chapterId: varchar("chapter_id").notNull().references(() => academicChapters.id, { onDelete: 'cascade' }),
  topicNumber: integer("topic_number").notNull(),
  topicName: text("topic_name").notNull(),
  description: text("description"),
  displayOrder: integer("display_order").notNull().default(0),
  status: text("status").notNull().default('Active'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAcademicTopicSchema = createInsertSchema(academicTopics).omit({
  id: true,
  createdAt: true,
});

export type InsertAcademicTopic = z.infer<typeof insertAcademicTopicSchema>;
export type AcademicTopic = typeof academicTopics.$inferSelect;

// ============================================
// CHILD ACADEMIC PROFILE
// ============================================

// Child's academic profile linking to curriculum
export const childAcademicProfiles = pgTable("child_academic_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  childId: varchar("child_id").notNull().references(() => children.id, { onDelete: 'cascade' }),
  boardId: varchar("board_id").references(() => educationBoards.id, { onDelete: 'set null' }),
  classId: varchar("class_id").references(() => academicClasses.id, { onDelete: 'set null' }),
  academicYear: text("academic_year").notNull(),
  section: text("section"),
  rollNumber: text("roll_number"),
  status: text("status").notNull().default('Active'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertChildAcademicProfileSchema = createInsertSchema(childAcademicProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertChildAcademicProfile = z.infer<typeof insertChildAcademicProfileSchema>;
export type ChildAcademicProfile = typeof childAcademicProfiles.$inferSelect;

// Child's enrolled subjects
export const childSubjectEnrollments = pgTable("child_subject_enrollments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").notNull().references(() => childAcademicProfiles.id, { onDelete: 'cascade' }),
  subjectId: varchar("subject_id").notNull().references(() => academicSubjects.id, { onDelete: 'cascade' }),
  status: text("status").notNull().default('Active'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertChildSubjectEnrollmentSchema = createInsertSchema(childSubjectEnrollments).omit({
  id: true,
  createdAt: true,
});

export type InsertChildSubjectEnrollment = z.infer<typeof insertChildSubjectEnrollmentSchema>;
export type ChildSubjectEnrollment = typeof childSubjectEnrollments.$inferSelect;

// ============================================
// STUDY TASKS (Parent-created)
// ============================================

export const studyTasks = pgTable("study_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  childId: varchar("child_id").notNull().references(() => children.id, { onDelete: 'cascade' }),
  createdByParentId: varchar("created_by_parent_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  description: text("description"),
  taskType: text("task_type").notNull().default('study'),
  subjectId: varchar("subject_id").references(() => academicSubjects.id, { onDelete: 'set null' }),
  chapterId: varchar("chapter_id").references(() => academicChapters.id, { onDelete: 'set null' }),
  topicId: varchar("topic_id").references(() => academicTopics.id, { onDelete: 'set null' }),
  priority: text("priority").notNull().default('Medium'),
  dueDate: timestamp("due_date"),
  estimatedMinutes: integer("estimated_minutes"),
  status: text("status").notNull().default('Pending'),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertStudyTaskSchema = createInsertSchema(studyTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertStudyTask = z.infer<typeof insertStudyTaskSchema>;
export type StudyTask = typeof studyTasks.$inferSelect;

// ============================================
// TEST MANAGEMENT SYSTEM
// ============================================

// Test Types/Blueprints
export const testBlueprints = pgTable("test_blueprints", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  blueprintCode: text("blueprint_code").notNull().unique(),
  blueprintName: text("blueprint_name").notNull(),
  testType: text("test_type").notNull(),
  description: text("description"),
  boardId: varchar("board_id").references(() => educationBoards.id, { onDelete: 'set null' }),
  classId: varchar("class_id").references(() => academicClasses.id, { onDelete: 'set null' }),
  subjectId: varchar("subject_id").references(() => academicSubjects.id, { onDelete: 'set null' }),
  chapterId: varchar("chapter_id").references(() => academicChapters.id, { onDelete: 'set null' }),
  duration: integer("duration").notNull().default(60),
  totalMarks: integer("total_marks").notNull().default(100),
  passingMarks: integer("passing_marks").notNull().default(35),
  totalQuestions: integer("total_questions").notNull().default(20),
  questionDistribution: text("question_distribution"),
  instructions: text("instructions"),
  createdBy: varchar("created_by").references(() => users.id, { onDelete: 'set null' }),
  instituteId: varchar("institute_id").references(() => institutes.id, { onDelete: 'set null' }),
  isPublic: boolean("is_public").notNull().default(false),
  status: text("status").notNull().default('Active'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTestBlueprintSchema = createInsertSchema(testBlueprints).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTestBlueprint = z.infer<typeof insertTestBlueprintSchema>;
export type TestBlueprint = typeof testBlueprints.$inferSelect;

// Test Question Bank (for manual import/entry)
export const testQuestionBank = pgTable("test_question_bank", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  questionCode: text("question_code").notNull().unique(),
  questionType: text("question_type").notNull().default('MCQ'),
  difficultyLevel: text("difficulty_level").notNull().default('Medium'),
  questionText: text("question_text").notNull(),
  optionA: text("option_a"),
  optionB: text("option_b"),
  optionC: text("option_c"),
  optionD: text("option_d"),
  optionE: text("option_e"),
  correctOption: text("correct_option"),
  answerText: text("answer_text"),
  explanation: text("explanation"),
  marks: integer("marks").notNull().default(1),
  negativeMarks: real("negative_marks").default(0),
  boardId: varchar("board_id").references(() => educationBoards.id, { onDelete: 'set null' }),
  classId: varchar("class_id").references(() => academicClasses.id, { onDelete: 'set null' }),
  subjectId: varchar("subject_id").references(() => academicSubjects.id, { onDelete: 'set null' }),
  chapterId: varchar("chapter_id").references(() => academicChapters.id, { onDelete: 'set null' }),
  topicId: varchar("topic_id").references(() => academicTopics.id, { onDelete: 'set null' }),
  assessmentType: text("assessment_type").default('Practice'),
  assessmentCode: text("assessment_code"),
  passageId: varchar("passage_id"),
  caseStudyId: varchar("case_study_id"),
  diagramUrl: text("diagram_url"),
  tags: text("tags").array(),
  language: text("language").notNull().default('EN'),
  psychopsisSubModuleId: varchar("psychopsis_sub_module_id").references(() => lbiSubModules.id, { onDelete: 'set null' }),
  createdBy: varchar("created_by").references(() => users.id, { onDelete: 'set null' }),
  instituteId: varchar("institute_id").references(() => institutes.id, { onDelete: 'set null' }),
  isVerified: boolean("is_verified").notNull().default(false),
  status: text("status").notNull().default('Active'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTestQuestionBankSchema = createInsertSchema(testQuestionBank).omit({
  id: true,
  createdAt: true,
});

export type InsertTestQuestionBank = z.infer<typeof insertTestQuestionBankSchema>;
export type TestQuestionBank = typeof testQuestionBank.$inferSelect;

// Assessment Blueprints (Templates for automatic paper generation)
export const assessmentBlueprints = pgTable("assessment_blueprints", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  blueprintCode: text("blueprint_code").notNull().unique(),
  blueprintName: text("blueprint_name").notNull(),
  boardId: varchar("board_id").references(() => educationBoards.id, { onDelete: 'set null' }),
  classId: varchar("class_id").references(() => academicClasses.id, { onDelete: 'set null' }),
  subjectId: varchar("subject_id").references(() => academicSubjects.id, { onDelete: 'set null' }),
  assessmentType: text("assessment_type").notNull().default('Practice'),
  totalMarks: integer("total_marks").notNull().default(100),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  instructions: text("instructions"),
  passingMarks: integer("passing_marks").default(35),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by").references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAssessmentBlueprintSchema = createInsertSchema(assessmentBlueprints).omit({
  id: true,
  createdAt: true,
});

export type InsertAssessmentBlueprint = z.infer<typeof insertAssessmentBlueprintSchema>;
export type AssessmentBlueprint = typeof assessmentBlueprints.$inferSelect;

// Blueprint Sections (Child table for Assessment Blueprints)
export const blueprintSections = pgTable("blueprint_sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  blueprintId: varchar("blueprint_id").notNull().references(() => assessmentBlueprints.id, { onDelete: 'cascade' }),
  sectionName: text("section_name").notNull(),
  sectionOrder: integer("section_order").notNull().default(1),
  questionType: text("question_type").notNull().default('MCQ'),
  difficultyMix: text("difficulty_mix").default('40:40:20'),
  questionsCount: integer("questions_count").notNull().default(10),
  marksPerQuestion: real("marks_per_question").notNull().default(1),
  negativeMarks: real("negative_marks").default(0),
  chapterScope: text("chapter_scope").default('Full Syllabus'),
  chapterIds: text("chapter_ids").array(),
  optionalQuestions: integer("optional_questions").default(0),
  instructions: text("instructions"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBlueprintSectionSchema = createInsertSchema(blueprintSections).omit({
  id: true,
  createdAt: true,
});

export type InsertBlueprintSection = z.infer<typeof insertBlueprintSectionSchema>;
export type BlueprintSection = typeof blueprintSections.$inferSelect;

// Tests (Instances created from blueprints or custom)
export const tests = pgTable("tests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  testCode: text("test_code").notNull().unique(),
  testName: text("test_name").notNull(),
  testType: text("test_type").notNull(),
  blueprintId: varchar("blueprint_id").references(() => testBlueprints.id, { onDelete: 'set null' }),
  boardId: varchar("board_id").references(() => educationBoards.id, { onDelete: 'set null' }),
  classId: varchar("class_id").references(() => academicClasses.id, { onDelete: 'set null' }),
  subjectId: varchar("subject_id").references(() => academicSubjects.id, { onDelete: 'set null' }),
  chapterId: varchar("chapter_id").references(() => academicChapters.id, { onDelete: 'set null' }),
  duration: integer("duration").notNull().default(60),
  totalMarks: integer("total_marks").notNull().default(100),
  passingMarks: integer("passing_marks").notNull().default(35),
  instructions: text("instructions"),
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  instituteId: varchar("institute_id").references(() => institutes.id, { onDelete: 'set null' }),
  creatorType: text("creator_type").notNull().default('parent'),
  workflowStatus: text("workflow_status").notNull().default('Draft'),
  isAutoGenerated: boolean("is_auto_generated").notNull().default(false),
  scheduledAt: timestamp("scheduled_at"),
  expiresAt: timestamp("expires_at"),
  status: text("status").notNull().default('Active'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTestSchema = createInsertSchema(tests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTest = z.infer<typeof insertTestSchema>;
export type Test = typeof tests.$inferSelect;

// Test Questions (linked to test instances)
export const testQuestions = pgTable("test_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  testId: varchar("test_id").notNull().references(() => tests.id, { onDelete: 'cascade' }),
  questionBankId: varchar("question_bank_id").references(() => testQuestionBank.id, { onDelete: 'set null' }),
  questionText: text("question_text").notNull(),
  optionA: text("option_a"),
  optionB: text("option_b"),
  optionC: text("option_c"),
  optionD: text("option_d"),
  correctOption: text("correct_option").notNull(),
  explanation: text("explanation"),
  marks: integer("marks").notNull().default(1),
  negativeMarks: real("negative_marks").default(0),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTestQuestionSchema = createInsertSchema(testQuestions).omit({
  id: true,
  createdAt: true,
});

export type InsertTestQuestion = z.infer<typeof insertTestQuestionSchema>;
export type TestQuestion = typeof testQuestions.$inferSelect;

// ============================================
// TEST WORKFLOW & APPROVALS
// ============================================

// Test Workflow History
export const testWorkflowHistory = pgTable("test_workflow_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  testId: varchar("test_id").notNull().references(() => tests.id, { onDelete: 'cascade' }),
  fromStatus: text("from_status").notNull(),
  toStatus: text("to_status").notNull(),
  actionBy: varchar("action_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  actionType: text("action_type").notNull(),
  comments: text("comments"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTestWorkflowHistorySchema = createInsertSchema(testWorkflowHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertTestWorkflowHistory = z.infer<typeof insertTestWorkflowHistorySchema>;
export type TestWorkflowHistory = typeof testWorkflowHistory.$inferSelect;

// Test Approvals
export const testApprovals = pgTable("test_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  testId: varchar("test_id").notNull().references(() => tests.id, { onDelete: 'cascade' }),
  approverUserId: varchar("approver_user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  approvalStatus: text("approval_status").notNull().default('Pending'),
  comments: text("comments"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTestApprovalSchema = createInsertSchema(testApprovals).omit({
  id: true,
  createdAt: true,
});

export type InsertTestApproval = z.infer<typeof insertTestApprovalSchema>;
export type TestApproval = typeof testApprovals.$inferSelect;

// ============================================
// TEST ASSIGNMENTS
// ============================================

// Test Assignments (to children, batches, classes, sections)
export const testAssignments = pgTable("test_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  testId: varchar("test_id").notNull().references(() => tests.id, { onDelete: 'cascade' }),
  assignmentType: text("assignment_type").notNull(),
  childId: varchar("child_id").references(() => children.id, { onDelete: 'cascade' }),
  batchId: varchar("batch_id").references(() => batches.id, { onDelete: 'cascade' }),
  instituteId: varchar("institute_id").references(() => institutes.id, { onDelete: 'cascade' }),
  section: text("section"),
  assignedBy: varchar("assigned_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: text("status").notNull().default('Active'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTestAssignmentSchema = createInsertSchema(testAssignments).omit({
  id: true,
  createdAt: true,
});

export type InsertTestAssignment = z.infer<typeof insertTestAssignmentSchema>;
export type TestAssignment = typeof testAssignments.$inferSelect;

// Test Attempts (student taking tests)
export const testAttempts = pgTable("test_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  testId: varchar("test_id").notNull().references(() => tests.id, { onDelete: 'cascade' }),
  assignmentId: varchar("assignment_id").references(() => testAssignments.id, { onDelete: 'set null' }),
  childId: varchar("child_id").notNull().references(() => children.id, { onDelete: 'cascade' }),
  status: text("status").notNull().default('Not Started'),
  scoreObtained: real("score_obtained"),
  totalMarks: real("total_marks"),
  percentageScore: real("percentage_score"),
  timeTakenSeconds: integer("time_taken_seconds"),
  startedAt: timestamp("started_at"),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTestAttemptSchema = createInsertSchema(testAttempts).omit({
  id: true,
  createdAt: true,
});

export type InsertTestAttempt = z.infer<typeof insertTestAttemptSchema>;
export type TestAttempt = typeof testAttempts.$inferSelect;

// Test Responses (answers to questions)
export const testResponses = pgTable("test_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  attemptId: varchar("attempt_id").notNull().references(() => testAttempts.id, { onDelete: 'cascade' }),
  questionId: varchar("question_id").notNull().references(() => testQuestions.id, { onDelete: 'cascade' }),
  selectedOption: text("selected_option"),
  isCorrect: boolean("is_correct"),
  marksObtained: real("marks_obtained").default(0),
  timeTakenSeconds: integer("time_taken_seconds"),
  isFlagged: boolean("is_flagged").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTestResponseSchema = createInsertSchema(testResponses).omit({
  id: true,
  createdAt: true,
});

export type InsertTestResponse = z.infer<typeof insertTestResponseSchema>;
export type TestResponse = typeof testResponses.$inferSelect;

// ============================================
// INSTITUTE STAFF & ROLES
// ============================================

// Staff Roles
export const staffRoles = pgTable("staff_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleName: text("role_name").notNull(),
  roleCode: text("role_code").notNull().unique(),
  permissions: text("permissions").array(),
  description: text("description"),
  status: text("status").notNull().default('Active'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertStaffRoleSchema = createInsertSchema(staffRoles).omit({
  id: true,
  createdAt: true,
});

export type InsertStaffRole = z.infer<typeof insertStaffRoleSchema>;
export type StaffRole = typeof staffRoles.$inferSelect;

// Institute Staff Members
export const instituteStaff = pgTable("institute_staff", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  instituteId: varchar("institute_id").notNull().references(() => institutes.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  roleId: varchar("role_id").notNull().references(() => staffRoles.id, { onDelete: 'cascade' }),
  staffCode: text("staff_code"),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  department: text("department"),
  status: text("status").notNull().default('Active'),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertInstituteStaffSchema = createInsertSchema(instituteStaff).omit({
  id: true,
  createdAt: true,
  joinedAt: true,
});

export type InsertInstituteStaff = z.infer<typeof insertInstituteStaffSchema>;
export type InstituteStaff = typeof instituteStaff.$inferSelect;

// Staff-Batch Assignments (which batches/classes teachers handle)
export const staffBatchAssignments = pgTable("staff_batch_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").notNull().references(() => instituteStaff.id, { onDelete: 'cascade' }),
  batchId: varchar("batch_id").notNull().references(() => batches.id, { onDelete: 'cascade' }),
  subjectId: varchar("subject_id").references(() => academicSubjects.id, { onDelete: 'set null' }),
  isPrimary: boolean("is_primary").notNull().default(false),
  status: text("status").notNull().default('Active'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertStaffBatchAssignmentSchema = createInsertSchema(staffBatchAssignments).omit({
  id: true,
  createdAt: true,
});

export type InsertStaffBatchAssignment = z.infer<typeof insertStaffBatchAssignmentSchema>;
export type StaffBatchAssignment = typeof staffBatchAssignments.$inferSelect;

// ============================================
// LEARNING FORUM
// ============================================

// Forum Posts
export const forumPosts = pgTable("forum_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  authorId: varchar("author_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  authorType: text("author_type").notNull().default('student'),
  childId: varchar("child_id").references(() => children.id, { onDelete: 'set null' }),
  testId: varchar("test_id").references(() => tests.id, { onDelete: 'set null' }),
  questionId: varchar("question_id").references(() => testQuestions.id, { onDelete: 'set null' }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  postType: text("post_type").notNull().default('doubt'),
  subjectId: varchar("subject_id").references(() => academicSubjects.id, { onDelete: 'set null' }),
  chapterId: varchar("chapter_id").references(() => academicChapters.id, { onDelete: 'set null' }),
  isAnonymous: boolean("is_anonymous").notNull().default(false),
  visibility: text("visibility").notNull().default('public'),
  targetAudience: text("target_audience").notNull().default('all'),
  assignedMentorId: varchar("assigned_mentor_id").references(() => users.id, { onDelete: 'set null' }),
  assignedTeacherId: varchar("assigned_teacher_id").references(() => users.id, { onDelete: 'set null' }),
  status: text("status").notNull().default('Open'),
  upvotes: integer("upvotes").notNull().default(0),
  viewCount: integer("view_count").notNull().default(0),
  isResolved: boolean("is_resolved").notNull().default(false),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertForumPostSchema = createInsertSchema(forumPosts).omit({
  id: true,
  upvotes: true,
  viewCount: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertForumPost = z.infer<typeof insertForumPostSchema>;
export type ForumPost = typeof forumPosts.$inferSelect;

// Forum Replies
export const forumReplies = pgTable("forum_replies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => forumPosts.id, { onDelete: 'cascade' }),
  authorId: varchar("author_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  authorType: text("author_type").notNull().default('student'),
  parentReplyId: varchar("parent_reply_id"),
  content: text("content").notNull(),
  isAnonymous: boolean("is_anonymous").notNull().default(false),
  isAcceptedAnswer: boolean("is_accepted_answer").notNull().default(false),
  upvotes: integer("upvotes").notNull().default(0),
  status: text("status").notNull().default('Active'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertForumReplySchema = createInsertSchema(forumReplies).omit({
  id: true,
  upvotes: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertForumReply = z.infer<typeof insertForumReplySchema>;
export type ForumReply = typeof forumReplies.$inferSelect;

// Forum Post Attachments
export const forumAttachments = pgTable("forum_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").references(() => forumPosts.id, { onDelete: 'cascade' }),
  replyId: varchar("reply_id").references(() => forumReplies.id, { onDelete: 'cascade' }),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"),
  status: text("status").notNull().default('Active'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertForumAttachmentSchema = createInsertSchema(forumAttachments).omit({
  id: true,
  createdAt: true,
});

export type InsertForumAttachment = z.infer<typeof insertForumAttachmentSchema>;
export type ForumAttachment = typeof forumAttachments.$inferSelect;

// Forum Moderation
export const forumModerationLogs = pgTable("forum_moderation_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").references(() => forumPosts.id, { onDelete: 'cascade' }),
  replyId: varchar("reply_id").references(() => forumReplies.id, { onDelete: 'cascade' }),
  reportedBy: varchar("reported_by").references(() => users.id, { onDelete: 'set null' }),
  moderatedBy: varchar("moderated_by").references(() => users.id, { onDelete: 'set null' }),
  reportReason: text("report_reason"),
  moderationAction: text("moderation_action"),
  moderationNotes: text("moderation_notes"),
  status: text("status").notNull().default('Pending'),
  reportedAt: timestamp("reported_at").notNull().defaultNow(),
  moderatedAt: timestamp("moderated_at"),
});

export const insertForumModerationLogSchema = createInsertSchema(forumModerationLogs).omit({
  id: true,
  reportedAt: true,
});

export type InsertForumModerationLog = z.infer<typeof insertForumModerationLogSchema>;
export type ForumModerationLog = typeof forumModerationLogs.$inferSelect;

// Forum User Votes
export const forumVotes = pgTable("forum_votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  postId: varchar("post_id").references(() => forumPosts.id, { onDelete: 'cascade' }),
  replyId: varchar("reply_id").references(() => forumReplies.id, { onDelete: 'cascade' }),
  voteType: text("vote_type").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertForumVoteSchema = createInsertSchema(forumVotes).omit({
  id: true,
  createdAt: true,
});

export type InsertForumVote = z.infer<typeof insertForumVoteSchema>;
export type ForumVote = typeof forumVotes.$inferSelect;

// ============================================
// ANALYTICS & LBI CORRELATION
// ============================================

// Performance Analytics (per child)
export const performanceAnalytics = pgTable("performance_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  childId: varchar("child_id").notNull().references(() => children.id, { onDelete: 'cascade' }),
  subjectId: varchar("subject_id").references(() => academicSubjects.id, { onDelete: 'set null' }),
  chapterId: varchar("chapter_id").references(() => academicChapters.id, { onDelete: 'set null' }),
  testType: text("test_type"),
  totalTests: integer("total_tests").notNull().default(0),
  completedTests: integer("completed_tests").notNull().default(0),
  averageScore: real("average_score"),
  highestScore: real("highest_score"),
  lowestScore: real("lowest_score"),
  averageTimeSeconds: integer("average_time_seconds"),
  improvementTrend: real("improvement_trend"),
  lastUpdatedAt: timestamp("last_updated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPerformanceAnalyticsSchema = createInsertSchema(performanceAnalytics).omit({
  id: true,
  createdAt: true,
});

export type InsertPerformanceAnalytics = z.infer<typeof insertPerformanceAnalyticsSchema>;
export type PerformanceAnalytics = typeof performanceAnalytics.$inferSelect;

// LBI-Performance Correlation
export const lbiPerformanceCorrelation = pgTable("lbi_performance_correlation", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  childId: varchar("child_id").notNull().references(() => children.id, { onDelete: 'cascade' }),
  lbiCategory: text("lbi_category").notNull(),
  lbiMetric: text("lbi_metric").notNull(),
  lbiScore: integer("lbi_score"),
  subjectId: varchar("subject_id").references(() => academicSubjects.id, { onDelete: 'set null' }),
  academicScore: real("academic_score"),
  correlationStrength: real("correlation_strength"),
  correlationType: text("correlation_type"),
  insight: text("insight"),
  recommendedActions: text("recommended_actions").array(),
  analysisDate: timestamp("analysis_date").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLbiPerformanceCorrelationSchema = createInsertSchema(lbiPerformanceCorrelation).omit({
  id: true,
  createdAt: true,
});

export type InsertLbiPerformanceCorrelation = z.infer<typeof insertLbiPerformanceCorrelationSchema>;
export type LbiPerformanceCorrelation = typeof lbiPerformanceCorrelation.$inferSelect;

// ============================================
// AUDIT LOGS (for DPDP compliance)
// ============================================

// Audit Logs for all sensitive operations
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'set null' }),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id"),
  action: text("action").notNull(),
  details: text("details"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// ============================================
// PARENT TESTS (created by parents for children)
// ============================================

export const parentTests = pgTable("parent_tests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  subject: text("subject").notNull(),
  description: text("description"),
  duration: integer("duration").notNull().default(30),
  totalMarks: integer("total_marks").notNull(),
  questions: text("questions").notNull(), // JSON string of questions
  status: text("status").notNull().default('draft'), // draft, published, assigned
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertParentTestSchema = createInsertSchema(parentTests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertParentTest = z.infer<typeof insertParentTestSchema>;
export type ParentTest = typeof parentTests.$inferSelect;

// Parent Test Assignments
export const parentTestAssignments = pgTable("parent_test_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  testId: varchar("test_id").notNull().references(() => parentTests.id, { onDelete: 'cascade' }),
  childId: varchar("child_id").notNull().references(() => children.id, { onDelete: 'cascade' }),
  assignedBy: varchar("assigned_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text("status").notNull().default('pending'), // pending, in_progress, completed
  dueDate: timestamp("due_date"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertParentTestAssignmentSchema = createInsertSchema(parentTestAssignments).omit({
  id: true,
  createdAt: true,
});

export type InsertParentTestAssignment = z.infer<typeof insertParentTestAssignmentSchema>;
export type ParentTestAssignment = typeof parentTestAssignments.$inferSelect;

// Parent Test Results
export const parentTestResults = pgTable("parent_test_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: varchar("assignment_id").notNull().references(() => parentTestAssignments.id, { onDelete: 'cascade' }),
  studentId: varchar("student_id").notNull(),
  answers: text("answers").notNull(), // JSON string
  marksObtained: integer("marks_obtained").notNull(),
  totalMarks: integer("total_marks").notNull(),
  score: integer("score").notNull(), // percentage
  correctAnswers: integer("correct_answers").notNull(),
  incorrectAnswers: integer("incorrect_answers").notNull(),
  questionResults: text("question_results").notNull(), // JSON string with detailed analysis
  completedAt: timestamp("completed_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertParentTestResultSchema = createInsertSchema(parentTestResults).omit({
  id: true,
  createdAt: true,
});

export type InsertParentTestResult = z.infer<typeof insertParentTestResultSchema>;
export type ParentTestResult = typeof parentTestResults.$inferSelect;

// ============================================
// HR & RECRUITMENT ORCHESTRATION SYSTEM
// ============================================

// Job Postings with approval workflow
export const jobPostings = pgTable("job_postings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  roleCategory: text("role_category").notNull(), // mentor, counselor, trainer, admin
  employmentType: text("employment_type").notNull(), // part-time, full-time, contract
  workMode: text("work_mode").notNull(), // remote, hybrid, field
  eligibility: text("eligibility").notNull(),
  qualifications: text("qualifications").notNull(),
  responsibilities: text("responsibilities").notNull(),
  kpis: text("kpis").notNull(), // performance expectations
  compensationModel: text("compensation_model").notNull(),
  legalClauses: text("legal_clauses"),
  status: text("status").notNull().default('draft'), // draft, hr_review, legal_review, leadership_approval, approved, published, closed
  hrReviewBy: varchar("hr_review_by").references(() => users.id),
  hrReviewAt: timestamp("hr_review_at"),
  hrReviewNotes: text("hr_review_notes"),
  legalReviewBy: varchar("legal_review_by").references(() => users.id),
  legalReviewAt: timestamp("legal_review_at"),
  legalReviewNotes: text("legal_review_notes"),
  leadershipApprovalBy: varchar("leadership_approval_by").references(() => users.id),
  leadershipApprovalAt: timestamp("leadership_approval_at"),
  leadershipApprovalNotes: text("leadership_approval_notes"),
  publishedAt: timestamp("published_at"),
  closedAt: timestamp("closed_at"),
  hiringQuota: integer("hiring_quota").default(0),
  hiredCount: integer("hired_count").notNull().default(0),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertJobPostingSchema = createInsertSchema(jobPostings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertJobPosting = z.infer<typeof insertJobPostingSchema>;
export type JobPosting = typeof jobPostings.$inferSelect;

// Job Distribution Channels
export const jobDistributions = pgTable("job_distributions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobPostings.id, { onDelete: 'cascade' }),
  channel: text("channel").notNull(), // linkedin, indeed, naukri, internshala, google_jobs, metryx_careers
  externalPostId: text("external_post_id"),
  postedAt: timestamp("posted_at"),
  unpostedAt: timestamp("unpublished_at"),
  reachMetrics: integer("reach_metrics").default(0),
  applicationsFromChannel: integer("applications_from_channel").default(0),
  status: text("status").notNull().default('pending'), // pending, posted, unpublished
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertJobDistributionSchema = createInsertSchema(jobDistributions).omit({
  id: true,
  createdAt: true,
});

export type InsertJobDistribution = z.infer<typeof insertJobDistributionSchema>;
export type JobDistribution = typeof jobDistributions.$inferSelect;

// Job Applications
export const jobApplications = pgTable("job_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobPostings.id, { onDelete: 'cascade' }),
  applicantUserId: varchar("applicant_user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  resumeUrl: text("resume_url"),
  coverLetter: text("cover_letter"),
  sourceChannel: text("source_channel"), // linkedin, indeed, direct, referral
  status: text("status").notNull().default('applied'), // applied, shortlisted, payment_pending, training, assessment, active, warning, suspended, deactivated, rejected
  membershipFee: real("membership_fee"),
  membershipPaidAt: timestamp("membership_paid_at"),
  consentCaptured: boolean("consent_captured").notNull().default(false),
  consentCapturedAt: timestamp("consent_captured_at"),
  rejectionReason: text("rejection_reason"),
  processedBy: varchar("processed_by").references(() => users.id),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertJobApplicationSchema = createInsertSchema(jobApplications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertJobApplication = z.infer<typeof insertJobApplicationSchema>;
export type JobApplication = typeof jobApplications.$inferSelect;

// Mentors (activated from job applications)
export const mentors = pgTable("mentors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  applicationId: varchar("application_id").references(() => jobApplications.id),
  mentorCode: text("mentor_code").notNull().unique(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  specialization: text("specialization"),
  qualifications: text("qualifications"),
  status: text("status").notNull().default('pending_training'), // pending_training, training, assessment, active, warning, suspended, deactivated
  activatedAt: timestamp("activated_at"),
  warningIssuedAt: timestamp("warning_issued_at"),
  warningReason: text("warning_reason"),
  suspendedAt: timestamp("suspended_at"),
  suspensionReason: text("suspension_reason"),
  deactivatedAt: timestamp("deactivated_at"),
  deactivationReason: text("deactivation_reason"),
  performanceHealthIndex: real("performance_health_index").default(100),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertMentorSchema = createInsertSchema(mentors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMentor = z.infer<typeof insertMentorSchema>;
export type Mentor = typeof mentors.$inferSelect;

// Training Programs
export const trainingPrograms = pgTable("training_programs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  programName: text("program_name").notNull(),
  description: text("description"),
  roleCategory: text("role_category").notNull(),
  durationDays: integer("duration_days").notNull().default(7),
  passingScore: integer("passing_score").notNull().default(70),
  modules: text("modules"), // JSON array of modules
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTrainingProgramSchema = createInsertSchema(trainingPrograms).omit({
  id: true,
  createdAt: true,
});

export type InsertTrainingProgram = z.infer<typeof insertTrainingProgramSchema>;
export type TrainingProgram = typeof trainingPrograms.$inferSelect;

// Training Enrollments
export const trainingEnrollments = pgTable("training_enrollments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mentorId: varchar("mentor_id").notNull().references(() => mentors.id, { onDelete: 'cascade' }),
  programId: varchar("program_id").notNull().references(() => trainingPrograms.id, { onDelete: 'cascade' }),
  status: text("status").notNull().default('enrolled'), // enrolled, in_progress, completed, failed, retraining
  attendancePercent: real("attendance_percent").default(0),
  assessmentScore: real("assessment_score"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  failureReason: text("failure_reason"),
  retrainingCount: integer("retraining_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTrainingEnrollmentSchema = createInsertSchema(trainingEnrollments).omit({
  id: true,
  createdAt: true,
});

export type InsertTrainingEnrollment = z.infer<typeof insertTrainingEnrollmentSchema>;
export type TrainingEnrollment = typeof trainingEnrollments.$inferSelect;

// Mentor KPIs (Performance Tracking)
export const mentorKpis = pgTable("mentor_kpis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mentorId: varchar("mentor_id").notNull().references(() => mentors.id, { onDelete: 'cascade' }),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  studentSatisfaction: real("student_satisfaction").default(0), // 0-100
  sessionCompletionRate: real("session_completion_rate").default(0), // 0-100
  outcomeImprovement: real("outcome_improvement").default(0), // 0-100
  complianceAdherence: real("compliance_adherence").default(0), // 0-100
  revenueContribution: real("revenue_contribution").default(0),
  sessionsCompleted: integer("sessions_completed").default(0),
  studentsAssigned: integer("students_assigned").default(0),
  alertLevel: text("alert_level").default('none'), // none, level_1, level_2, level_3
  alertIssuedAt: timestamp("alert_issued_at"),
  alertNotes: text("alert_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMentorKpiSchema = createInsertSchema(mentorKpis).omit({
  id: true,
  createdAt: true,
});

export type InsertMentorKpi = z.infer<typeof insertMentorKpiSchema>;
export type MentorKpi = typeof mentorKpis.$inferSelect;

// HR Consent Logs (Legal & Compliance)
export const hrConsentLogs = pgTable("hr_consent_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  mentorId: varchar("mentor_id").references(() => mentors.id, { onDelete: 'cascade' }),
  consentType: text("consent_type").notNull(), // registration, training, monitoring, confidentiality, termination
  consentText: text("consent_text").notNull(),
  consentGiven: boolean("consent_given").notNull().default(false),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  consentedAt: timestamp("consented_at"),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertHrConsentLogSchema = createInsertSchema(hrConsentLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertHrConsentLog = z.infer<typeof insertHrConsentLogSchema>;
export type HrConsentLog = typeof hrConsentLogs.$inferSelect;

// Compliance Violations
export const complianceViolations = pgTable("compliance_violations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mentorId: varchar("mentor_id").notNull().references(() => mentors.id, { onDelete: 'cascade' }),
  violationType: text("violation_type").notNull(), // ethical, policy, performance, conduct
  severity: text("severity").notNull(), // minor, moderate, major, critical
  description: text("description").notNull(),
  evidenceUrl: text("evidence_url"),
  reportedBy: varchar("reported_by").references(() => users.id),
  status: text("status").notNull().default('reported'), // reported, investigating, resolved, escalated
  resolution: text("resolution"),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  actionTaken: text("action_taken"), // warning, retraining, suspension, termination
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertComplianceViolationSchema = createInsertSchema(complianceViolations).omit({
  id: true,
  createdAt: true,
});

export type InsertComplianceViolation = z.infer<typeof insertComplianceViolationSchema>;
export type ComplianceViolation = typeof complianceViolations.$inferSelect;

// Revenue & Payouts
export const mentorPayouts = pgTable("mentor_payouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mentorId: varchar("mentor_id").notNull().references(() => mentors.id, { onDelete: 'cascade' }),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  grossRevenue: real("gross_revenue").notNull().default(0),
  commissionRate: real("commission_rate").notNull().default(0),
  commissionAmount: real("commission_amount").notNull().default(0),
  deductions: real("deductions").default(0),
  netPayout: real("net_payout").notNull().default(0),
  status: text("status").notNull().default('pending'), // pending, approved, blocked, paid
  blockedReason: text("blocked_reason"),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  paidAt: timestamp("paid_at"),
  transactionRef: text("transaction_ref"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMentorPayoutSchema = createInsertSchema(mentorPayouts).omit({
  id: true,
  createdAt: true,
});

export type InsertMentorPayout = z.infer<typeof insertMentorPayoutSchema>;
export type MentorPayout = typeof mentorPayouts.$inferSelect;

// Institutional SLA Configurations
export const institutionalSlas = pgTable("institutional_slas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  instituteId: varchar("institute_id").notNull().references(() => institutes.id, { onDelete: 'cascade' }),
  tier: text("tier").notNull().default('silver'), // silver, gold, platinum
  responseTimeHours: integer("response_time_hours").notNull().default(24),
  completionTargetPercent: real("completion_target_percent").notNull().default(90),
  satisfactionTargetPercent: real("satisfaction_target_percent").notNull().default(85),
  reportingFrequency: text("reporting_frequency").notNull().default('weekly'), // daily, weekly, monthly
  dedicatedSupport: boolean("dedicated_support").notNull().default(false),
  priorityEscalation: boolean("priority_escalation").notNull().default(false),
  customBranding: boolean("custom_branding").notNull().default(false),
  effectiveFrom: date("effective_from").notNull(),
  effectiveUntil: date("effective_until"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertInstitutionalSlaSchema = createInsertSchema(institutionalSlas).omit({
  id: true,
  createdAt: true,
});

export type InsertInstitutionalSla = z.infer<typeof insertInstitutionalSlaSchema>;
export type InstitutionalSla = typeof institutionalSlas.$inferSelect;

// White-Label Partners
export const whiteLabelPartners = pgTable("white_label_partners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerCode: text("partner_code").notNull().unique(),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  brandLogoUrl: text("brand_logo_url"),
  brandPrimaryColor: text("brand_primary_color"),
  brandAccentColor: text("brand_accent_color"),
  customDomain: text("custom_domain"),
  revenueSharePercent: real("revenue_share_percent").notNull().default(20),
  mentorPoolSize: integer("mentor_pool_size").default(0),
  status: text("status").notNull().default('pilot'), // pilot, active, suspended, terminated
  pilotStartDate: date("pilot_start_date"),
  rolloutDate: date("rollout_date"),
  terminatedAt: timestamp("terminated_at"),
  terminationReason: text("termination_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertWhiteLabelPartnerSchema = createInsertSchema(whiteLabelPartners).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWhiteLabelPartner = z.infer<typeof insertWhiteLabelPartnerSchema>;
export type WhiteLabelPartner = typeof whiteLabelPartners.$inferSelect;

// HR Audit Logs (System Governance)
export const hrAuditLogs = pgTable("hr_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actorUserId: varchar("actor_user_id").references(() => users.id),
  actionType: text("action_type").notNull(), // job_created, job_approved, application_processed, mentor_activated, etc.
  targetType: text("target_type").notNull(), // job, application, mentor, payout, violation
  targetId: varchar("target_id").notNull(),
  previousState: text("previous_state"), // JSON
  newState: text("new_state"), // JSON
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertHrAuditLogSchema = createInsertSchema(hrAuditLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertHrAuditLog = z.infer<typeof insertHrAuditLogSchema>;
export type HrAuditLog = typeof hrAuditLogs.$inferSelect;

// Job Approval Workflow Log
export const jobApprovalLogs = pgTable("job_approval_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobPostings.id, { onDelete: 'cascade' }),
  fromStatus: text("from_status").notNull(),
  toStatus: text("to_status").notNull(),
  action: text("action").notNull(), // submit, approve, reject, request_changes
  comments: text("comments"),
  actorId: varchar("actor_id").references(() => users.id),
  actorRole: text("actor_role"), // hr, legal, leadership, admin
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertJobApprovalLogSchema = createInsertSchema(jobApprovalLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertJobApprovalLog = z.infer<typeof insertJobApprovalLogSchema>;
export type JobApprovalLog = typeof jobApprovalLogs.$inferSelect;

// Mentor Profiles (Activated after training completion)
export const mentorProfiles = pgTable("mentor_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mentorId: varchar("mentor_id").references(() => mentors.id),
  userId: varchar("user_id").references(() => users.id),
  applicationId: varchar("application_id").references(() => jobApplications.id),
  mentorCode: text("mentor_code").notNull().unique(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  profilePhoto: text("profile_photo"),
  bio: text("bio"),
  specializations: text("specializations").array(), // online_coaching, tuition, counselling
  qualifications: text("qualifications").array(),
  languages: text("languages").array(),
  availability: text("availability"),
  preferredAgeGroups: text("preferred_age_groups").array(),
  status: text("status").notNull().default('pending_activation'), // pending_activation, active, suspended, deactivated
  activatedAt: timestamp("activated_at"),
  activatedBy: varchar("activated_by").references(() => users.id),
  suspendedAt: timestamp("suspended_at"),
  suspendedReason: text("suspended_reason"),
  deactivatedAt: timestamp("deactivated_at"),
  deactivationReason: text("deactivation_reason"),
  rating: real("rating"),
  totalSessions: integer("total_sessions").notNull().default(0),
  completedSessions: integer("completed_sessions").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertMentorProfileSchema = createInsertSchema(mentorProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMentorProfile = z.infer<typeof insertMentorProfileSchema>;
export type MentorProfile = typeof mentorProfiles.$inferSelect;

// Mentor Task Assignments
export const mentorTasks = pgTable("mentor_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mentorId: varchar("mentor_id").notNull().references(() => mentors.id, { onDelete: 'cascade' }),
  taskType: text("task_type").notNull(), // online_coaching, tuition, counselling, workshop, awareness_session
  title: text("title").notNull(),
  description: text("description"),
  targetAudience: text("target_audience"),
  scheduledDate: timestamp("scheduled_date"),
  duration: integer("duration"), // in minutes
  location: text("location"),
  isOnline: boolean("is_online").notNull().default(true),
  meetingLink: text("meeting_link"),
  status: text("status").notNull().default('assigned'), // assigned, accepted, in_progress, completed, cancelled
  completedAt: timestamp("completed_at"),
  feedback: text("feedback"),
  rating: integer("rating"),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertMentorTaskSchema = createInsertSchema(mentorTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMentorTask = z.infer<typeof insertMentorTaskSchema>;
export type MentorTask = typeof mentorTasks.$inferSelect;

// ============================================
// SUPER ADMIN / PLATFORM MANAGEMENT TABLES
// ============================================

// Onboarding Approvals (for Institutes, Parents, Mentors)
export const onboardingApprovals = pgTable("onboarding_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: text("entity_type").notNull(), // institute, parent, mentor
  entityId: varchar("entity_id").notNull(),
  entityName: text("entity_name").notNull(),
  entityEmail: text("entity_email"),
  entityPhone: text("entity_phone"),
  status: text("status").notNull().default('pending'), // pending, approved, rejected, suspended
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  rejectionReason: text("rejection_reason"),
  documentsVerified: boolean("documents_verified").default(false),
  kycVerified: boolean("kyc_verified").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertOnboardingApprovalSchema = createInsertSchema(onboardingApprovals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOnboardingApproval = z.infer<typeof insertOnboardingApprovalSchema>;
export type OnboardingApproval = typeof onboardingApprovals.$inferSelect;

// KYC Documents with Maker-Checker Workflow
export const kycDocuments = pgTable("kyc_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: text("entity_type").notNull(), // institute, parent, mentor, student
  entityId: varchar("entity_id").notNull(),
  entityName: text("entity_name").notNull(),
  documentType: text("document_type").notNull(), // aadhaar, pan, gst, incorporation_cert, address_proof, photo_id
  documentNumber: text("document_number"),
  documentUrl: text("document_url"),
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  // Maker-Checker workflow
  status: text("status").notNull().default('pending'), // pending, maker_verified, checker_verified, approved, rejected
  makerId: varchar("maker_id").references(() => users.id),
  makerVerifiedAt: timestamp("maker_verified_at"),
  makerNotes: text("maker_notes"),
  checkerId: varchar("checker_id").references(() => users.id),
  checkerVerifiedAt: timestamp("checker_verified_at"),
  checkerNotes: text("checker_notes"),
  rejectionReason: text("rejection_reason"),
  expiryDate: timestamp("expiry_date"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertKycDocumentSchema = createInsertSchema(kycDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertKycDocument = z.infer<typeof insertKycDocumentSchema>;
export type KycDocument = typeof kycDocuments.$inferSelect;

// Approved Students with Payment Status (for institute drilldown)
export const studentEnrollments = pgTable("student_enrollments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  instituteId: varchar("institute_id").notNull(),
  instituteName: text("institute_name").notNull(),
  studentId: varchar("student_id").notNull(),
  studentName: text("student_name").notNull(),
  parentId: varchar("parent_id"),
  parentName: text("parent_name"),
  className: text("class_name"),
  section: text("section"),
  rollNumber: text("roll_number"),
  admissionDate: timestamp("admission_date"),
  status: text("status").notNull().default('pending'), // pending, approved, payment_pending, active, inactive, suspended
  paymentStatus: text("payment_status").default('pending'), // pending, partial, completed, overdue, waived
  feeAmount: real("fee_amount"),
  paidAmount: real("paid_amount").default(0),
  dueDate: timestamp("due_date"),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  approvalNotes: text("approval_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertStudentEnrollmentSchema = createInsertSchema(studentEnrollments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertStudentEnrollment = z.infer<typeof insertStudentEnrollmentSchema>;
export type StudentEnrollment = typeof studentEnrollments.$inferSelect;

// Platform Transactions
export const platformTransactions = pgTable("platform_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transactionType: text("transaction_type").notNull(), // subscription, payout, refund, commission, penalty
  entityType: text("entity_type").notNull(), // institute, parent, mentor, partner
  entityId: varchar("entity_id").notNull(),
  entityName: text("entity_name"),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default('INR'),
  status: text("status").notNull().default('pending'), // pending, processing, completed, failed, cancelled, refunded
  paymentMethod: text("payment_method"), // upi, netbanking, card, wallet
  paymentGateway: text("payment_gateway"), // razorpay, paytm, stripe
  gatewayTransactionId: text("gateway_transaction_id"),
  gatewayOrderId: text("gateway_order_id"),
  description: text("description"),
  invoiceNumber: text("invoice_number"),
  invoiceUrl: text("invoice_url"),
  processedBy: varchar("processed_by").references(() => users.id),
  processedAt: timestamp("processed_at"),
  failureReason: text("failure_reason"),
  refundedAmount: real("refunded_amount"),
  refundedAt: timestamp("refunded_at"),
  metadata: text("metadata"), // JSON for additional info
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPlatformTransactionSchema = createInsertSchema(platformTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPlatformTransaction = z.infer<typeof insertPlatformTransactionSchema>;
export type PlatformTransaction = typeof platformTransactions.$inferSelect;

// Platform Admin Audit Logs
export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminUserId: varchar("admin_user_id").references(() => users.id),
  actionType: text("action_type").notNull(), // approve_institute, reject_parent, process_payout, etc.
  targetType: text("target_type").notNull(), // institute, parent, mentor, transaction, job
  targetId: varchar("target_id").notNull(),
  previousState: text("previous_state"), // JSON
  newState: text("new_state"), // JSON
  ipAddress: text("ip_address"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAdminAuditLogSchema = createInsertSchema(adminAuditLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertAdminAuditLog = z.infer<typeof insertAdminAuditLogSchema>;
export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;

// Platform Settings
export const platformSettings = pgTable("platform_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  settingKey: text("setting_key").notNull().unique(),
  settingValue: text("setting_value").notNull(),
  settingType: text("setting_type").notNull().default('string'), // string, number, boolean, json
  category: text("category").notNull().default('general'), // general, payment, notifications, security
  description: text("description"),
  updatedBy: varchar("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPlatformSettingSchema = createInsertSchema(platformSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPlatformSetting = z.infer<typeof insertPlatformSettingSchema>;
export type PlatformSetting = typeof platformSettings.$inferSelect;

// ============================================
// SUPER ADMIN - ENTITY CODES
// ============================================

// Entity Codes (unique codes for mentors, institutes, NGOs, parents, LEI)
export const entityCodes = pgTable("entity_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: text("entity_type").notNull(), // mentor, institute, ngo, parent, lei
  entityId: varchar("entity_id").notNull(),
  code: text("code").notNull().unique(),
  codeType: text("code_type").notNull().default('standard'), // standard, premium, promotional
  status: text("status").notNull().default('active'), // active, revoked, expired
  generatedBy: varchar("generated_by").references(() => users.id),
  validFrom: timestamp("valid_from").notNull().defaultNow(),
  validUntil: timestamp("valid_until"),
  revokedAt: timestamp("revoked_at"),
  revokedReason: text("revoked_reason"),
  usageCount: integer("usage_count").notNull().default(0),
  maxUsage: integer("max_usage"),
  metadata: text("metadata"), // JSON for additional info
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEntityCodeSchema = createInsertSchema(entityCodes).omit({
  id: true,
  createdAt: true,
});

export type InsertEntityCode = z.infer<typeof insertEntityCodeSchema>;
export type EntityCode = typeof entityCodes.$inferSelect;

// ============================================
// SUPER ADMIN - CONSENT MANAGEMENT (DPDP)
// ============================================

// Unified Consent Records (DPDP Act Compliance)
export const consentRecords = pgTable("consent_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: text("entity_type").notNull(), // parent, student, mentor, institute
  entityId: varchar("entity_id").notNull(),
  entityName: text("entity_name"),
  consentType: text("consent_type").notNull(), // data_processing, behavioral_assessment, marketing, third_party_sharing
  consentVersion: text("consent_version").notNull().default('1.0'),
  status: text("status").notNull().default('pending'), // pending, granted, revoked, expired
  grantedAt: timestamp("granted_at"),
  revokedAt: timestamp("revoked_at"),
  expiresAt: timestamp("expires_at"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  consentText: text("consent_text"), // The actual consent text shown
  dataCategories: text("data_categories").array(), // What data types are covered
  processingPurposes: text("processing_purposes").array(), // Why data is being processed
  lawfulBasis: text("lawful_basis"), // DPDP act basis
  retentionPeriod: text("retention_period"), // How long data will be kept
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertConsentRecordSchema = createInsertSchema(consentRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertConsentRecord = z.infer<typeof insertConsentRecordSchema>;
export type ConsentRecord = typeof consentRecords.$inferSelect;

// ============================================
// SUPER ADMIN - ACCESS CONTROL
// ============================================

// Role Definitions
export const roleDefinitions = pgTable("role_definitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleName: text("role_name").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  level: integer("level").notNull().default(0), // Hierarchy level (higher = more permissions)
  isSystem: boolean("is_system").notNull().default(false), // Cannot be deleted if true
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertRoleDefinitionSchema = createInsertSchema(roleDefinitions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRoleDefinition = z.infer<typeof insertRoleDefinitionSchema>;
export type RoleDefinition = typeof roleDefinitions.$inferSelect;

// Permission Definitions
export const permissionDefinitions = pgTable("permission_definitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  permissionKey: text("permission_key").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  category: text("category").notNull().default('general'), // general, admin, hr, finance, content
  resource: text("resource").notNull(), // users, jobs, payouts, consents, etc.
  action: text("action").notNull(), // read, write, delete, approve, manage
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPermissionDefinitionSchema = createInsertSchema(permissionDefinitions).omit({
  id: true,
  createdAt: true,
});

export type InsertPermissionDefinition = z.infer<typeof insertPermissionDefinitionSchema>;
export type PermissionDefinition = typeof permissionDefinitions.$inferSelect;

// Role-Permission Mapping
export const rolePermissions = pgTable("role_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleId: varchar("role_id").notNull().references(() => roleDefinitions.id, { onDelete: 'cascade' }),
  permissionId: varchar("permission_id").notNull().references(() => permissionDefinitions.id, { onDelete: 'cascade' }),
  grantedBy: varchar("granted_by").references(() => users.id),
  grantedAt: timestamp("granted_at").notNull().defaultNow(),
});

export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({
  id: true,
  grantedAt: true,
});

export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type RolePermission = typeof rolePermissions.$inferSelect;

// ============================================
// SUPER ADMIN - FINANCIAL RECONCILIATION
// ============================================

// Payment Reconciliation Records
export const paymentReconciliations = pgTable("payment_reconciliations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reconciliationPeriod: text("reconciliation_period").notNull(), // e.g., "2026-01"
  status: text("status").notNull().default('pending'), // pending, in_progress, completed, discrepancy
  totalPaymentsReceived: real("total_payments_received").notNull().default(0),
  totalPaymentsDone: real("total_payments_done").notNull().default(0),
  netBalance: real("net_balance").notNull().default(0),
  transactionCount: integer("transaction_count").notNull().default(0),
  payoutCount: integer("payout_count").notNull().default(0),
  discrepancyAmount: real("discrepancy_amount"),
  discrepancyNotes: text("discrepancy_notes"),
  reconciledBy: varchar("reconciled_by").references(() => users.id),
  reconciledAt: timestamp("reconciled_at"),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPaymentReconciliationSchema = createInsertSchema(paymentReconciliations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPaymentReconciliation = z.infer<typeof insertPaymentReconciliationSchema>;
export type PaymentReconciliation = typeof paymentReconciliations.$inferSelect;

// ============================================
// SUPER ADMIN - LEARNING PLAN OVERSIGHT
// ============================================

// Learning Plan Templates (Admin-managed)
export const learningPlanTemplates = pgTable("learning_plan_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateName: text("template_name").notNull(),
  description: text("description"),
  targetGrade: text("target_grade"), // Class/Grade level
  targetBoard: text("target_board"), // CBSE, ICSE, State boards
  subjectFocus: text("subject_focus").array(), // Main subjects covered
  durationWeeks: integer("duration_weeks").notNull().default(12),
  difficulty: text("difficulty").notNull().default('moderate'), // easy, moderate, challenging
  weeklyHours: integer("weekly_hours").notNull().default(10),
  status: text("status").notNull().default('draft'), // draft, published, archived
  milestones: text("milestones"), // JSON array of milestones
  createdBy: varchar("created_by").references(() => users.id),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLearningPlanTemplateSchema = createInsertSchema(learningPlanTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLearningPlanTemplate = z.infer<typeof insertLearningPlanTemplateSchema>;
export type LearningPlanTemplate = typeof learningPlanTemplates.$inferSelect;

// NGO Registrations
export const ngoRegistrations = pgTable("ngo_registrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  ngoCode: text("ngo_code").notNull().unique(),
  legalName: text("legal_name").notNull(),
  displayName: text("display_name").notNull(),
  registrationNumber: text("registration_number"),
  taxExemptionNumber: text("tax_exemption_number"),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  pincode: text("pincode"),
  focusAreas: text("focus_areas").array(), // education, health, environment, etc.
  beneficiaryCount: integer("beneficiary_count").default(0),
  status: text("status").notNull().default('pending'), // pending, active, suspended, terminated
  documentsVerified: boolean("documents_verified").default(false),
  kycVerified: boolean("kyc_verified").default(false),
  verifiedBy: varchar("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  onboardedAt: timestamp("onboarded_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertNgoRegistrationSchema = createInsertSchema(ngoRegistrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertNgoRegistration = z.infer<typeof insertNgoRegistrationSchema>;
export type NgoRegistration = typeof ngoRegistrations.$inferSelect;

// LEI (Legal Entity Identifier) Registrations
export const leiRegistrations = pgTable("lei_registrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  leiCode: text("lei_code").notNull().unique(), // 20-character LEI code
  entityName: text("entity_name").notNull(),
  entityType: text("entity_type").notNull(), // corporate, government, nonprofit
  registrationAuthority: text("registration_authority"),
  registrationNumber: text("registration_number"),
  jurisdiction: text("jurisdiction"),
  legalAddress: text("legal_address"),
  headquartersAddress: text("headquarters_address"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  status: text("status").notNull().default('pending'), // pending, active, lapsed, retired
  validFrom: date("valid_from"),
  validUntil: date("valid_until"),
  lastVerified: timestamp("last_verified"),
  verifiedBy: varchar("verified_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLeiRegistrationSchema = createInsertSchema(leiRegistrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLeiRegistration = z.infer<typeof insertLeiRegistrationSchema>;
export type LeiRegistration = typeof leiRegistrations.$inferSelect;

// User Sessions (for security monitoring)
export const userSessions = pgTable("user_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionToken: text("session_token").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  deviceType: text("device_type"), // desktop, mobile, tablet
  browser: text("browser"),
  os: text("os"),
  location: text("location"),
  isActive: boolean("is_active").notNull().default(true),
  lastActivity: timestamp("last_activity").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
  terminatedAt: timestamp("terminated_at"),
  terminationReason: text("termination_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSessionSchema = createInsertSchema(userSessions).omit({
  id: true,
  createdAt: true,
});

export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;
export type UserSession = typeof userSessions.$inferSelect;

// ============================================
// ENTERPRISE DOCUMENT MANAGEMENT SYSTEM
// ============================================

// Document Folders (Hierarchical structure for entity types)
export const documentFolders = pgTable("document_folders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: text("entity_type").notNull(), // institution, parent, student, ngo, mentor
  entityId: varchar("entity_id").notNull(),
  entityName: text("entity_name"),
  folderPath: text("folder_path").notNull(), // e.g., /institutions/INS001/kyc/
  folderName: text("folder_name").notNull(),
  parentFolderId: varchar("parent_folder_id"),
  accessLevel: text("access_level").notNull().default('private'), // private, restricted, public
  retentionPolicy: text("retention_policy").default('7_years'), // SOC2/ISO compliant retention
  encryptionStatus: text("encryption_status").notNull().default('encrypted'), // encrypted, unencrypted
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDocumentFolderSchema = createInsertSchema(documentFolders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDocumentFolder = z.infer<typeof insertDocumentFolderSchema>;
export type DocumentFolder = typeof documentFolders.$inferSelect;

// Documents (Central document storage with versioning)
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  folderId: varchar("folder_id").references(() => documentFolders.id, { onDelete: 'cascade' }),
  entityType: text("entity_type").notNull(), // institution, parent, student, ngo, mentor
  entityId: varchar("entity_id").notNull(),
  documentType: text("document_type").notNull(), // pan_card, aadhaar, gst_certificate, registration_certificate, consent_form, kyc_form, etc.
  documentCategory: text("document_category").notNull(), // kyc, consent, form, certificate, identity, address, financial
  documentName: text("document_name").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"), // bytes
  mimeType: text("mime_type"),
  storagePath: text("storage_path").notNull(), // File system path
  checksum: text("checksum"), // SHA-256 hash for integrity
  version: integer("version").notNull().default(1),
  isLatest: boolean("is_latest").notNull().default(true),
  previousVersionId: varchar("previous_version_id"),
  
  // Verification workflow (maker-checker)
  status: text("status").notNull().default('pending'), // pending, maker_verified, checker_approved, rejected, expired
  makerVerifiedBy: varchar("maker_verified_by").references(() => users.id),
  makerVerifiedAt: timestamp("maker_verified_at"),
  makerNotes: text("maker_notes"),
  checkerApprovedBy: varchar("checker_approved_by").references(() => users.id),
  checkerApprovedAt: timestamp("checker_approved_at"),
  checkerNotes: text("checker_notes"),
  rejectedBy: varchar("rejected_by").references(() => users.id),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  
  // Compliance fields
  expiryDate: date("expiry_date"),
  isExpired: boolean("is_expired").notNull().default(false),
  sensitivityLevel: text("sensitivity_level").notNull().default('confidential'), // public, internal, confidential, restricted
  encryptionAlgorithm: text("encryption_algorithm").default('AES-256'),
  accessCount: integer("access_count").notNull().default(0),
  lastAccessedAt: timestamp("last_accessed_at"),
  lastAccessedBy: varchar("last_accessed_by").references(() => users.id),
  
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

// Document Access Logs (SOC2 compliance - immutable audit trail)
export const documentAccessLogs = pgTable("document_access_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => documents.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id),
  accessType: text("access_type").notNull(), // view, download, upload, delete, verify, approve, reject
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  deviceType: text("device_type"),
  location: text("location"),
  accessStatus: text("access_status").notNull().default('success'), // success, denied, failed
  failureReason: text("failure_reason"),
  sessionId: varchar("session_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDocumentAccessLogSchema = createInsertSchema(documentAccessLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertDocumentAccessLog = z.infer<typeof insertDocumentAccessLogSchema>;
export type DocumentAccessLog = typeof documentAccessLogs.$inferSelect;

// ============================================
// PRE-ONBOARDING FRAMEWORK
// ============================================

// KYC Document Types (Master list for each entity type)
export const kycDocumentTypes = pgTable("kyc_document_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: text("entity_type").notNull(), // institution, parent, student, ngo, mentor
  documentType: text("document_type").notNull(),
  documentName: text("document_name").notNull(),
  description: text("description"),
  isMandatory: boolean("is_mandatory").notNull().default(true),
  validityPeriod: integer("validity_period"), // days, null means no expiry
  acceptedFormats: text("accepted_formats").array().default(sql`ARRAY['pdf', 'jpg', 'png']::text[]`),
  maxFileSizeMb: integer("max_file_size_mb").default(5),
  sampleDocUrl: text("sample_doc_url"),
  verificationInstructions: text("verification_instructions"),
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertKycDocumentTypeSchema = createInsertSchema(kycDocumentTypes).omit({
  id: true,
  createdAt: true,
});

export type InsertKycDocumentType = z.infer<typeof insertKycDocumentTypeSchema>;
export type KycDocumentType = typeof kycDocumentTypes.$inferSelect;

// Consent Types (Master list)
export const consentTypes = pgTable("consent_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: text("entity_type").notNull(), // institution, parent, student, ngo, mentor
  consentCode: text("consent_code").notNull().unique(),
  consentName: text("consent_name").notNull(),
  description: text("description"),
  consentTextTemplate: text("consent_text_template").notNull(),
  version: text("version").notNull().default('1.0'),
  isMandatory: boolean("is_mandatory").notNull().default(true),
  requiresWitness: boolean("requires_witness").notNull().default(false),
  requiresGuardian: boolean("requires_guardian").notNull().default(false), // For minors
  lawfulBasis: text("lawful_basis"), // DPDP Act basis
  dataCategories: text("data_categories").array(),
  processingPurposes: text("processing_purposes").array(),
  retentionPeriod: text("retention_period"),
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertConsentTypeSchema = createInsertSchema(consentTypes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertConsentType = z.infer<typeof insertConsentTypeSchema>;
export type ConsentType = typeof consentTypes.$inferSelect;

// Pre-Onboarding Checklists
export const preOnboardingChecklists = pgTable("pre_onboarding_checklists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: text("entity_type").notNull(), // institution, parent, student, ngo, mentor
  entityId: varchar("entity_id").notNull(),
  entityName: text("entity_name"),
  
  // Temporary onboarding status
  temporaryOnboardingStatus: text("temporary_onboarding_status").notNull().default('pending'), // pending, approved, rejected
  temporaryApprovedBy: varchar("temporary_approved_by").references(() => users.id),
  temporaryApprovedAt: timestamp("temporary_approved_at"),
  
  // KYC completion tracking
  totalKycDocuments: integer("total_kyc_documents").notNull().default(0),
  uploadedKycDocuments: integer("uploaded_kyc_documents").notNull().default(0),
  verifiedKycDocuments: integer("verified_kyc_documents").notNull().default(0),
  kycCompletionPercent: real("kyc_completion_percent").notNull().default(0),
  
  // Consent completion tracking
  totalConsents: integer("total_consents").notNull().default(0),
  grantedConsents: integer("granted_consents").notNull().default(0),
  consentCompletionPercent: real("consent_completion_percent").notNull().default(0),
  
  // Payment tracking
  totalAmount: real("total_amount").notNull().default(0),
  paidAmount: real("paid_amount").notNull().default(0),
  paymentStatus: text("payment_status").notNull().default('pending'), // pending, partial, completed, waived
  
  // Overall status
  overallStatus: text("overall_status").notNull().default('incomplete'), // incomplete, pending_review, approved, rejected
  
  // SPOC details (for institutions)
  spocName: text("spoc_name"),
  spocEmail: text("spoc_email"),
  spocPhone: text("spoc_phone"),
  spocDesignation: text("spoc_designation"),
  
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectedBy: varchar("rejected_by").references(() => users.id),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPreOnboardingChecklistSchema = createInsertSchema(preOnboardingChecklists).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPreOnboardingChecklist = z.infer<typeof insertPreOnboardingChecklistSchema>;
export type PreOnboardingChecklist = typeof preOnboardingChecklists.$inferSelect;

// Student Bulk Imports
export const studentBulkImports = pgTable("student_bulk_imports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  instituteId: varchar("institute_id").notNull().references(() => institutes.id, { onDelete: 'cascade' }),
  batchId: varchar("batch_id").references(() => batches.id),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"),
  storagePath: text("storage_path"),
  
  // Import status
  status: text("status").notNull().default('pending'), // pending, processing, completed, failed, partial
  totalRows: integer("total_rows").notNull().default(0),
  processedRows: integer("processed_rows").notNull().default(0),
  successfulRows: integer("successful_rows").notNull().default(0),
  failedRows: integer("failed_rows").notNull().default(0),
  duplicateRows: integer("duplicate_rows").notNull().default(0),
  
  // Error tracking
  errorLog: text("error_log"),
  validationErrors: text("validation_errors").array(),
  
  // Approval workflow
  requiresApproval: boolean("requires_approval").notNull().default(true),
  approvalStatus: text("approval_status").notNull().default('pending'), // pending, approved, rejected
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertStudentBulkImportSchema = createInsertSchema(studentBulkImports).omit({
  id: true,
  createdAt: true,
});

export type InsertStudentBulkImport = z.infer<typeof insertStudentBulkImportSchema>;
export type StudentBulkImport = typeof studentBulkImports.$inferSelect;

// Student Import Records (Individual records from bulk import)
export const studentImportRecords = pgTable("student_import_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  importId: varchar("import_id").notNull().references(() => studentBulkImports.id, { onDelete: 'cascade' }),
  rowNumber: integer("row_number").notNull(),
  
  // Student data from CSV
  studentName: text("student_name").notNull(),
  dob: date("dob"),
  gender: text("gender"),
  parentName: text("parent_name"),
  parentEmail: text("parent_email"),
  parentPhone: text("parent_phone"),
  classGrade: text("class_grade"),
  section: text("section"),
  rollNumber: text("roll_number"),
  admissionNumber: text("admission_number"),
  
  // Processing status
  status: text("status").notNull().default('pending'), // pending, validated, created, failed, duplicate
  validationErrors: text("validation_errors").array(),
  studentId: varchar("student_id").references(() => students.id), // Created student reference
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertStudentImportRecordSchema = createInsertSchema(studentImportRecords).omit({
  id: true,
  createdAt: true,
});

export type InsertStudentImportRecord = z.infer<typeof insertStudentImportRecordSchema>;
export type StudentImportRecord = typeof studentImportRecords.$inferSelect;

// ============================================
// ENTERPRISE SECURITY & AUDIT (SOC2/ISO)
// ============================================

// Security Configurations
export const securityConfigurations = pgTable("security_configurations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  configKey: text("config_key").notNull().unique(),
  configValue: text("config_value").notNull(),
  configType: text("config_type").notNull(), // encryption, authentication, authorization, session, audit
  description: text("description"),
  isEncrypted: boolean("is_encrypted").notNull().default(false),
  complianceFramework: text("compliance_framework").array(), // SOC2, ISO27001, DPDP
  lastModifiedBy: varchar("last_modified_by").references(() => users.id),
  lastModifiedAt: timestamp("last_modified_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSecurityConfigurationSchema = createInsertSchema(securityConfigurations).omit({
  id: true,
  createdAt: true,
});

export type InsertSecurityConfiguration = z.infer<typeof insertSecurityConfigurationSchema>;
export type SecurityConfiguration = typeof securityConfigurations.$inferSelect;

// Security Incidents
export const securityIncidents = pgTable("security_incidents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  incidentCode: text("incident_code").notNull().unique(),
  incidentType: text("incident_type").notNull(), // unauthorized_access, data_breach, policy_violation, suspicious_activity, system_compromise
  severity: text("severity").notNull(), // critical, high, medium, low
  status: text("status").notNull().default('open'), // open, investigating, contained, resolved, closed
  title: text("title").notNull(),
  description: text("description"),
  affectedSystems: text("affected_systems").array(),
  affectedUsers: text("affected_users").array(),
  detectedAt: timestamp("detected_at").notNull().defaultNow(),
  detectedBy: varchar("detected_by").references(() => users.id),
  containedAt: timestamp("contained_at"),
  resolvedAt: timestamp("resolved_at"),
  rootCause: text("root_cause"),
  remediationSteps: text("remediation_steps"),
  preventiveMeasures: text("preventive_measures"),
  assignedTo: varchar("assigned_to").references(() => users.id),
  escalatedTo: varchar("escalated_to").references(() => users.id),
  notificationsSent: boolean("notifications_sent").notNull().default(false),
  complianceImpact: text("compliance_impact"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSecurityIncidentSchema = createInsertSchema(securityIncidents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSecurityIncident = z.infer<typeof insertSecurityIncidentSchema>;
export type SecurityIncident = typeof securityIncidents.$inferSelect;

// Compliance Audit Logs (Immutable, SOC2/ISO compliant)
export const complianceAuditLogs = pgTable("compliance_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  logId: text("log_id").notNull().unique(), // Unique, sequential, immutable ID
  logType: text("log_type").notNull(), // system, user, security, data, configuration
  category: text("category").notNull(), // authentication, authorization, data_access, data_modification, configuration_change, security_event
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: varchar("resource_id"),
  resourceName: text("resource_name"),
  
  // Actor information
  actorId: varchar("actor_id"),
  actorType: text("actor_type"), // user, system, api, scheduled_job
  actorName: text("actor_name"),
  actorRole: text("actor_role"),
  
  // Request details
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  sessionId: varchar("session_id"),
  requestId: varchar("request_id"),
  
  // Change tracking
  previousValue: text("previous_value"),
  newValue: text("new_value"),
  changeReason: text("change_reason"),
  
  // Status
  status: text("status").notNull(), // success, failure, partial, denied
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  
  // Compliance metadata
  complianceFrameworks: text("compliance_frameworks").array(), // SOC2, ISO27001, DPDP, GDPR
  dataClassification: text("data_classification"), // public, internal, confidential, restricted
  retentionPeriod: text("retention_period").default('7_years'),
  
  // Integrity
  logHash: text("log_hash"), // SHA-256 hash for integrity verification
  previousLogHash: text("previous_log_hash"), // Chain link
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertComplianceAuditLogSchema = createInsertSchema(complianceAuditLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertComplianceAuditLog = z.infer<typeof insertComplianceAuditLogSchema>;
export type ComplianceAuditLog = typeof complianceAuditLogs.$inferSelect;

// Data Retention Policies
export const dataRetentionPolicies = pgTable("data_retention_policies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  policyName: text("policy_name").notNull(),
  dataCategory: text("data_category").notNull(), // user_data, audit_logs, documents, financial, communication
  retentionPeriodDays: integer("retention_period_days").notNull(),
  archivalPeriodDays: integer("archival_period_days"),
  deletionMethod: text("deletion_method").notNull().default('secure_delete'), // soft_delete, hard_delete, secure_delete, anonymize
  complianceFramework: text("compliance_framework").array(),
  legalBasis: text("legal_basis"),
  exceptions: text("exceptions"),
  lastExecuted: timestamp("last_executed"),
  nextScheduled: timestamp("next_scheduled"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDataRetentionPolicySchema = createInsertSchema(dataRetentionPolicies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDataRetentionPolicy = z.infer<typeof insertDataRetentionPolicySchema>;
export type DataRetentionPolicy = typeof dataRetentionPolicies.$inferSelect;

// Access Control Policies (RBAC with attribute-based extensions)
export const accessControlPolicies = pgTable("access_control_policies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  policyName: text("policy_name").notNull(),
  policyType: text("policy_type").notNull(), // role_based, attribute_based, resource_based
  resource: text("resource").notNull(),
  actions: text("actions").array().notNull(),
  conditions: text("conditions"), // JSON conditions for ABAC
  allowedRoles: text("allowed_roles").array(),
  deniedRoles: text("denied_roles").array(),
  priority: integer("priority").notNull().default(100),
  effect: text("effect").notNull().default('allow'), // allow, deny
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAccessControlPolicySchema = createInsertSchema(accessControlPolicies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAccessControlPolicy = z.infer<typeof insertAccessControlPolicySchema>;
export type AccessControlPolicy = typeof accessControlPolicies.$inferSelect;

// CANONICAL subscription_packages definition — live-DB-matched (14 cols confirmed 2026-05-09).
// Aspirational columns (subcategory, priceMax, offerLabel, couponCode, highlights,
// billingType, reportConfig jsonb, etc.) existed in frontend/server/src/db/schema.ts
// (pre-S5) but are NOT in the live DB. Phase 1 migration will add them (Task #119).
// Do NOT add aspirational cols here until migrated — Drizzle generates explicit SELECT
// column lists and will error if a listed column is missing from the live table.
// frontend/server/src/db/schema.ts re-exports from here; do NOT define this table there.
export const subscriptionPackages = pgTable("subscription_packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: text("category").notNull(),
  studentSegment: text("student_segment").notNull(),
  productName: text("product_name").notNull(),
  isRecommended: boolean("is_recommended").notNull().default(false),
  domainsCovered: text("domains_covered").array().notNull().default(sql`'{}'::text[]`),
  price: real("price"),
  validityDays: integer("validity_days"),
  questionCount: integer("question_count"),
  reportType: text("report_type"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSubscriptionPackageSchema = createInsertSchema(subscriptionPackages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSubscriptionPackage = z.infer<typeof insertSubscriptionPackageSchema>;
export type SubscriptionPackage = typeof subscriptionPackages.$inferSelect;

// CANONICAL student_subscriptions definition — live-DB-matched (10 cols confirmed 2026-05-09).
// Aspirational columns (institution_id, notes, start_date, target_age_band, assigned_by,
// updated_at) existed in frontend/server/src/db/schema.ts (pre-S5) but are NOT in the
// live DB. Phase 1 migration will add them (Task #119). Do NOT add aspirational cols here
// until migrated — Drizzle generates explicit SELECT column lists and will error if a
// listed column is missing from the live table.
// frontend/server/src/db/schema.ts re-exports from here; do NOT define this table there.
export const studentSubscriptions = pgTable("student_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  childId: varchar("child_id").references(() => children.id, { onDelete: 'cascade' }),
  studentId: varchar("student_id").references(() => students.id, { onDelete: 'cascade' }),
  packageId: varchar("package_id").notNull().references(() => subscriptionPackages.id, { onDelete: 'restrict' }),
  purchaseDate: timestamp("purchase_date").notNull().defaultNow(),
  expiryDate: timestamp("expiry_date"),
  status: text("status").notNull().default('active'),
  assessmentCompletedAt: timestamp("assessment_completed_at"),
  reportGeneratedAt: timestamp("report_generated_at"),
  paymentTransactionId: varchar("payment_transaction_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertStudentSubscriptionSchema = createInsertSchema(studentSubscriptions).omit({
  id: true,
  createdAt: true,
});

export type InsertStudentSubscription = z.infer<typeof insertStudentSubscriptionSchema>;
export type StudentSubscription = typeof studentSubscriptions.$inferSelect;

// ============================================
// LEARNING BEHAVIOR INTELLIGENCE (LBI) SYSTEM
// Comprehensive LBI Assessment Framework
// ============================================

// LBI Domains (e.g., ACE - Academic & Cognitive Excellence, TQP - Thinking & Problem-solving)
export const lbiDomains = pgTable("lbi_domains", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  domainCode: text("domain_code").notNull().unique(), // ACE, TQP, SEI, etc.
  domainName: text("domain_name").notNull(),
  description: text("description"),
  color: text("color"), // For UI display
  icon: text("icon"), // Icon name for UI
  weightage: real("weightage").notNull().default(1.0), // Weight in overall LBI calculation
  displayOrder: integer("display_order").notNull().default(0),
  status: text("status").notNull().default('Active'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLbiDomainSchema = createInsertSchema(lbiDomains).omit({
  id: true,
  createdAt: true,
});

export type InsertLbiDomain = z.infer<typeof insertLbiDomainSchema>;
export type LbiDomain = typeof lbiDomains.$inferSelect;

// LBI Subdomains (e.g., ACE_SD01 - Learning & Memory, ACE_SD02 - Attention & Focus)
export const lbiSubdomains = pgTable("lbi_subdomains", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  domainId: varchar("domain_id").notNull().references(() => lbiDomains.id, { onDelete: 'cascade' }),
  subdomainCode: text("subdomain_code").notNull().unique(), // ACE_SD01, TQP_SD01, etc.
  subdomainName: text("subdomain_name").notNull(),
  description: text("description"),
  weightage: real("weightage").notNull().default(1.0), // Weight within domain
  displayOrder: integer("display_order").notNull().default(0),
  status: text("status").notNull().default('Active'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLbiSubdomainSchema = createInsertSchema(lbiSubdomains).omit({
  id: true,
  createdAt: true,
});

export type InsertLbiSubdomain = z.infer<typeof insertLbiSubdomainSchema>;
export type LbiSubdomain = typeof lbiSubdomains.$inferSelect;

// LBI Age Bands (A, B, C - mapping to age ranges)
export const lbiAgeBands = pgTable("lbi_age_bands", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bandCode: text("band_code").notNull().unique(), // A, B, C
  bandName: text("band_name").notNull(), // "Primary (6-10)", "Middle (11-14)", etc.
  minAge: integer("min_age").notNull(),
  maxAge: integer("max_age").notNull(),
  gradeRange: text("grade_range"), // "Grade 1-5", "Grade 6-8", etc.
  status: text("status").notNull().default('Active'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLbiAgeBandSchema = createInsertSchema(lbiAgeBands).omit({
  id: true,
  createdAt: true,
});

export type InsertLbiAgeBand = z.infer<typeof insertLbiAgeBandSchema>;
export type LbiAgeBand = typeof lbiAgeBands.$inferSelect;

// LBI Response Scales (Likert scale definitions)
export const lbiResponseScales = pgTable("lbi_response_scales", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scaleCode: text("scale_code").notNull().unique(), // LIKERT_5, LIKERT_7, FREQUENCY_5
  scaleName: text("scale_name").notNull(),
  scaleType: text("scale_type").notNull().default('likert'), // likert, frequency, agreement, etc.
  options: text("options").notNull(), // JSON: ["Never","Rarely","Sometimes","Often","Always"]
  scoring: text("scoring").notNull(), // JSON: [1,2,3,4,5] or {"Never":1,"Rarely":2,...}
  reverseScoringMap: text("reverse_scoring_map"), // JSON: [5,4,3,2,1] for reverse items
  status: text("status").notNull().default('Active'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLbiResponseScaleSchema = createInsertSchema(lbiResponseScales).omit({
  id: true,
  createdAt: true,
});

export type InsertLbiResponseScale = z.infer<typeof insertLbiResponseScaleSchema>;
export type LbiResponseScale = typeof lbiResponseScales.$inferSelect;

// LBI Question Bank (Enhanced with all required fields from spreadsheet)
export const lbiQuestions = pgTable("lbi_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  questionCode: text("question_code").notNull().unique(), // ACE_A_001, TQP_B_015, etc.
  domainId: varchar("domain_id").notNull().references(() => lbiDomains.id, { onDelete: 'cascade' }),
  subdomainId: varchar("subdomain_id").notNull().references(() => lbiSubdomains.id, { onDelete: 'cascade' }),
  ageBandId: varchar("age_band_id").notNull().references(() => lbiAgeBands.id, { onDelete: 'restrict' }),
  responseScaleId: varchar("response_scale_id").references(() => lbiResponseScales.id, { onDelete: 'set null' }),
  questionText: text("question_text").notNull(),
  questionTextHi: text("question_text_hi"), // Hindi translation
  questionTextMr: text("question_text_mr"), // Marathi translation
  questionTextTa: text("question_text_ta"), // Tamil translation
  questionTextTe: text("question_text_te"), // Telugu translation
  questionType: text("question_type").notNull().default('likert'), // likert, mcq, true_false, scenario
  responseOptions: text("response_options"), // JSON array of options if custom
  scoring: text("scoring"), // JSON scoring pattern e.g., "1*;1,2*;2,3*;3,4*;4,5*;5"
  reverseScored: boolean("reverse_scored").notNull().default(false), // TRUE for negative keyed items
  difficulty: text("difficulty").notNull().default('MEDIUM'), // EASY, MEDIUM, HARD
  language: text("language").notNull().default('EN'), // Primary language
  setNumber: integer("set_number").default(1), // Question set for randomization
  displayOrder: integer("display_order").notNull().default(0),
  tags: text("tags").array(), // ["focus", "attention", "classroom"] for filtering
  version: integer("version").notNull().default(1),
  status: text("status").notNull().default('Active'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertLbiQuestionSchema = createInsertSchema(lbiQuestions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLbiQuestion = z.infer<typeof insertLbiQuestionSchema>;
export type LbiQuestion = typeof lbiQuestions.$inferSelect;

// LBI Scoring Rules (for calculating domain/subdomain scores)
export const lbiScoringRules = pgTable("lbi_scoring_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleCode: text("rule_code").notNull().unique(),
  ruleName: text("rule_name").notNull(),
  domainId: varchar("domain_id").references(() => lbiDomains.id, { onDelete: 'cascade' }),
  subdomainId: varchar("subdomain_id").references(() => lbiSubdomains.id, { onDelete: 'cascade' }),
  ageBandId: varchar("age_band_id").references(() => lbiAgeBands.id, { onDelete: 'set null' }),
  calculationType: text("calculation_type").notNull().default('mean'), // mean, sum, weighted_mean
  normType: text("norm_type").notNull().default('percentile'), // percentile, stanine, z_score, t_score
  normData: text("norm_data"), // JSON with normative data
  minScore: real("min_score"),
  maxScore: real("max_score"),
  cutoffs: text("cutoffs"), // JSON: {"low": 30, "medium": 60, "high": 100}
  status: text("status").notNull().default('Active'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLbiScoringRuleSchema = createInsertSchema(lbiScoringRules).omit({
  id: true,
  createdAt: true,
});

export type InsertLbiScoringRule = z.infer<typeof insertLbiScoringRuleSchema>;
export type LbiScoringRule = typeof lbiScoringRules.$inferSelect;

// LBI Assessment Sessions (student assessment tracking)
export const lbiAssessmentSessions = pgTable("lbi_assessment_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  childId: varchar("child_id").references(() => children.id, { onDelete: 'cascade' }),
  studentId: varchar("student_id").references(() => students.id, { onDelete: 'cascade' }),
  ageBandId: varchar("age_band_id").references(() => lbiAgeBands.id, { onDelete: 'set null' }),
  assessmentType: text("assessment_type").notNull().default('full'), // full, domain_specific, screening
  targetDomains: text("target_domains").array(), // Specific domains if not full
  status: text("status").notNull().default('not_started'), // not_started, in_progress, completed, abandoned
  totalQuestions: integer("total_questions").notNull().default(0),
  questionsAnswered: integer("questions_answered").notNull().default(0),
  currentQuestionIndex: integer("current_question_index").notNull().default(0),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  timeSpentSeconds: integer("time_spent_seconds").default(0),
  deviceInfo: text("device_info"), // Browser, OS info
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLbiAssessmentSessionSchema = createInsertSchema(lbiAssessmentSessions).omit({
  id: true,
  createdAt: true,
});

export type InsertLbiAssessmentSession = z.infer<typeof insertLbiAssessmentSessionSchema>;
export type LbiAssessmentSession = typeof lbiAssessmentSessions.$inferSelect;

// LBI Session Responses (individual question responses)
export const lbiSessionResponses = pgTable("lbi_session_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => lbiAssessmentSessions.id, { onDelete: 'cascade' }),
  questionId: varchar("question_id").notNull().references(() => lbiQuestions.id, { onDelete: 'restrict' }),
  responseValue: integer("response_value"), // The selected option value (1-5 for Likert)
  responseText: text("response_text"), // For open-ended questions
  rawScore: real("raw_score"), // Score before normalization
  adjustedScore: real("adjusted_score"), // After reverse scoring adjustment
  responseTimeMs: integer("response_time_ms"), // Time taken to answer in milliseconds
  questionOrder: integer("question_order"), // Order in which question was presented
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLbiSessionResponseSchema = createInsertSchema(lbiSessionResponses).omit({
  id: true,
  createdAt: true,
});

export type InsertLbiSessionResponse = z.infer<typeof insertLbiSessionResponseSchema>;
export type LbiSessionResponse = typeof lbiSessionResponses.$inferSelect;

// LBI Domain Scores (calculated scores per domain for a session)
export const lbiDomainScores = pgTable("lbi_domain_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => lbiAssessmentSessions.id, { onDelete: 'cascade' }),
  domainId: varchar("domain_id").notNull().references(() => lbiDomains.id, { onDelete: 'cascade' }),
  rawScore: real("raw_score").notNull(),
  percentileScore: real("percentile_score"),
  stanineScore: integer("stanine_score"),
  classification: text("classification"), // Low, Below Average, Average, Above Average, High
  questionsAnswered: integer("questions_answered").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLbiDomainScoreSchema = createInsertSchema(lbiDomainScores).omit({
  id: true,
  createdAt: true,
});

export type InsertLbiDomainScore = z.infer<typeof insertLbiDomainScoreSchema>;
export type LbiDomainScore = typeof lbiDomainScores.$inferSelect;

// LBI Subdomain Scores (calculated scores per subdomain)
export const lbiSubdomainScores = pgTable("lbi_subdomain_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => lbiAssessmentSessions.id, { onDelete: 'cascade' }),
  subdomainId: varchar("subdomain_id").notNull().references(() => lbiSubdomains.id, { onDelete: 'cascade' }),
  rawScore: real("raw_score").notNull(),
  percentileScore: real("percentile_score"),
  stanineScore: integer("stanine_score"),
  classification: text("classification"),
  questionsAnswered: integer("questions_answered").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLbiSubdomainScoreSchema = createInsertSchema(lbiSubdomainScores).omit({
  id: true,
  createdAt: true,
});

export type InsertLbiSubdomainScore = z.infer<typeof insertLbiSubdomainScoreSchema>;
export type LbiSubdomainScore = typeof lbiSubdomainScores.$inferSelect;

// LBI Overall Index (composite LBI score)
export const lbiOverallIndex = pgTable("lbi_overall_index", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => lbiAssessmentSessions.id, { onDelete: 'cascade' }),
  childId: varchar("child_id").references(() => children.id, { onDelete: 'cascade' }),
  studentId: varchar("student_id").references(() => students.id, { onDelete: 'cascade' }),
  lbiScore: real("lbi_score").notNull(), // Overall LBI score (0-100)
  percentileRank: real("percentile_rank"),
  stanineScore: integer("stanine_score"),
  classification: text("classification"), // Needs Attention, Developing, Proficient, Advanced
  strengthDomains: text("strength_domains").array(), // Top 2-3 domains
  developmentAreas: text("development_areas").array(), // Bottom 2-3 domains
  recommendations: text("recommendations"), // AI-generated recommendations
  reportGeneratedAt: timestamp("report_generated_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLbiOverallIndexSchema = createInsertSchema(lbiOverallIndex).omit({
  id: true,
  createdAt: true,
});

export type InsertLbiOverallIndex = z.infer<typeof insertLbiOverallIndexSchema>;
export type LbiOverallIndex = typeof lbiOverallIndex.$inferSelect;

// =================== NOTIFICATION SYSTEM ===================

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recipientId: varchar("recipient_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  senderId: varchar("sender_id").references(() => users.id, { onDelete: 'set null' }),
  type: text("type").notNull().default('fyi'), // fyi, fya (For Your Information / For Your Action)
  category: text("category").notNull().default('general'), // general, assessment, subscription, document, security, onboarding, exam, consent, system
  title: text("title").notNull(),
  message: text("message").notNull(),
  actionUrl: text("action_url"),
  actionLabel: text("action_label"),
  priority: text("priority").notNull().default('normal'), // low, normal, high, urgent
  isRead: boolean("is_read").notNull().default(false),
  isAcknowledged: boolean("is_acknowledged").notNull().default(false),
  acknowledgedAt: timestamp("acknowledged_at"),
  isEmailSent: boolean("is_email_sent").notNull().default(false),
  emailSentAt: timestamp("email_sent_at"),
  metadata: text("metadata"), // JSON string for extra data
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  isRead: true,
  isAcknowledged: true,
  acknowledgedAt: true,
  isEmailSent: true,
  emailSentAt: true,
  createdAt: true,
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

export const emailConsents = pgTable("email_consents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  consentType: text("consent_type").notNull(), // marketing, transactional, assessment_updates, security_alerts, newsletter, product_updates
  isConsented: boolean("is_consented").notNull().default(true),
  consentedAt: timestamp("consented_at"),
  revokedAt: timestamp("revoked_at"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEmailConsentSchema = createInsertSchema(emailConsents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEmailConsent = z.infer<typeof insertEmailConsentSchema>;
export type EmailConsent = typeof emailConsents.$inferSelect;

export const acknowledgements = pgTable("acknowledgements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  notificationId: varchar("notification_id").references(() => notifications.id, { onDelete: 'cascade' }),
  acknowledgementType: text("acknowledgement_type").notNull(), // notification, policy, terms, consent, document
  referenceId: text("reference_id"),
  referenceType: text("reference_type"),
  notes: text("notes"),
  acknowledgedAt: timestamp("acknowledged_at").notNull().defaultNow(),
});

export const insertAcknowledgementSchema = createInsertSchema(acknowledgements).omit({
  id: true,
  acknowledgedAt: true,
});

export type InsertAcknowledgement = z.infer<typeof insertAcknowledgementSchema>;
export type Acknowledgement = typeof acknowledgements.$inferSelect;

export const notificationBroadcasts = pgTable("notification_broadcasts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: 'set null' }),
  type: text("type").notNull().default('fyi'), // fyi, fya
  category: text("category").notNull().default('system'),
  title: text("title").notNull(),
  message: text("message").notNull(),
  targetRoles: text("target_roles").array(), // parent, student, institute, mentor, etc.
  targetUserIds: text("target_user_ids").array(),
  priority: text("priority").notNull().default('normal'),
  actionUrl: text("action_url"),
  actionLabel: text("action_label"),
  sendEmail: boolean("send_email").notNull().default(false),
  totalRecipients: integer("total_recipients").notNull().default(0),
  totalDelivered: integer("total_delivered").notNull().default(0),
  status: text("status").notNull().default('draft'), // draft, sending, sent, failed
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertNotificationBroadcastSchema = createInsertSchema(notificationBroadcasts).omit({
  id: true,
  totalRecipients: true,
  totalDelivered: true,
  status: true,
  sentAt: true,
  createdAt: true,
});

export type InsertNotificationBroadcast = z.infer<typeof insertNotificationBroadcastSchema>;
export type NotificationBroadcast = typeof notificationBroadcasts.$inferSelect;

export const mfaCodes = pgTable("mfa_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  code: varchar("code", { length: 6 }).notNull(),
  email: varchar("email").notNull(),
  attemptToken: varchar("attempt_token").notNull(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMfaCodeSchema = createInsertSchema(mfaCodes).omit({
  id: true,
  createdAt: true,
});

export type InsertMfaCode = z.infer<typeof insertMfaCodeSchema>;
export type MfaCode = typeof mfaCodes.$inferSelect;

export * from "./models/chat";
