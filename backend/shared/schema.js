"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertPsychometricAssessmentResultSchema = exports.psychometricAssessmentResults = exports.insertPsychometricQuestionBankSchema = exports.psychometricQuestionBank = exports.insertPsychometricDomainAgeBandConfigSchema = exports.psychometricDomainAgeBandConfig = exports.insertPsychometricSubdomainSchema = exports.psychometricSubdomains = exports.insertPsychometricDomainSchema = exports.psychometricDomains = exports.insertPsychometricAgeBandSchema = exports.psychometricAgeBands = exports.insertBehaviouralInsightSchema = exports.behaviouralInsights = exports.insertConsentLogSchema = exports.consentLogs = exports.insertLbiSessionSchema = exports.lbiSessions = exports.insertLbiQuestionLegacySchema = exports.lbiQuestionsLegacy = exports.insertLbiAssessmentSchema = exports.lbiAssessments = exports.insertLbiTypeSchema = exports.lbiTypes = exports.insertExamResponseSchema = exports.examResponses = exports.insertExamAttemptSchema = exports.examAttempts = exports.insertExamQuestionSchema = exports.examQuestions = exports.insertAssessmentTemplateQuestionSchema = exports.assessmentTemplateQuestions = exports.insertAssessmentTemplateSchema = exports.assessmentTemplates = exports.insertExamSchema = exports.exams = exports.insertEnrollmentRequestSchema = exports.enrollmentRequests = exports.insertParentStudentLinkSchema = exports.parentStudentLinks = exports.insertStudentSchema = exports.students = exports.insertParentSchema = exports.parents = exports.insertBatchSchema = exports.batches = exports.insertInstituteSchema = exports.institutes = exports.insertUserSchema = exports.users = void 0;
exports.insertBlueprintSectionSchema = exports.blueprintSections = exports.insertAssessmentBlueprintSchema = exports.assessmentBlueprints = exports.insertTestQuestionBankSchema = exports.testQuestionBank = exports.insertTestBlueprintSchema = exports.testBlueprints = exports.insertStudyTaskSchema = exports.studyTasks = exports.insertChildSubjectEnrollmentSchema = exports.childSubjectEnrollments = exports.insertChildAcademicProfileSchema = exports.childAcademicProfiles = exports.insertAcademicTopicSchema = exports.academicTopics = exports.insertAcademicChapterSchema = exports.academicChapters = exports.insertAcademicSubjectSchema = exports.academicSubjects = exports.insertAcademicClassSchema = exports.academicClasses = exports.insertEducationBoardSchema = exports.educationBoards = exports.insertStudentCompetencyScoreSchema = exports.studentCompetencyScores = exports.insertCompetencyLibrarySchema = exports.competencyLibrary = exports.insertStudentAssessmentResponseSchema = exports.studentAssessmentResponses = exports.insertStudentAssessmentSessionSchema = exports.studentAssessmentSessions = exports.insertLbiQuestionBankSchema = exports.lbiQuestionBank = exports.insertLbiAgeGroupSchema = exports.lbiAgeGroups = exports.insertLbiSubModuleSchema = exports.lbiSubModules = exports.insertLbiModuleSchema = exports.lbiModules = exports.insertSupervisedTestSessionSchema = exports.supervisedTestSessions = exports.insertLbiCategorySchema = exports.lbiCategories = exports.insertChildExamQuestionSchema = exports.childExamQuestions = exports.insertChildExamSchema = exports.childExams = exports.insertChildSchema = exports.children = void 0;
exports.insertMentorSchema = exports.mentors = exports.insertJobApplicationSchema = exports.jobApplications = exports.insertJobDistributionSchema = exports.jobDistributions = exports.insertJobPostingSchema = exports.jobPostings = exports.insertParentTestResultSchema = exports.parentTestResults = exports.insertParentTestAssignmentSchema = exports.parentTestAssignments = exports.insertParentTestSchema = exports.parentTests = exports.insertAuditLogSchema = exports.auditLogs = exports.insertLbiPerformanceCorrelationSchema = exports.lbiPerformanceCorrelation = exports.insertPerformanceAnalyticsSchema = exports.performanceAnalytics = exports.insertForumVoteSchema = exports.forumVotes = exports.insertForumModerationLogSchema = exports.forumModerationLogs = exports.insertForumAttachmentSchema = exports.forumAttachments = exports.insertForumReplySchema = exports.forumReplies = exports.insertForumPostSchema = exports.forumPosts = exports.insertStaffBatchAssignmentSchema = exports.staffBatchAssignments = exports.insertInstituteStaffSchema = exports.instituteStaff = exports.insertStaffRoleSchema = exports.staffRoles = exports.insertTestResponseSchema = exports.testResponses = exports.insertTestAttemptSchema = exports.testAttempts = exports.insertTestAssignmentSchema = exports.testAssignments = exports.insertTestApprovalSchema = exports.testApprovals = exports.insertTestWorkflowHistorySchema = exports.testWorkflowHistory = exports.insertTestQuestionSchema = exports.testQuestions = exports.insertTestSchema = exports.tests = void 0;
exports.insertLearningPlanTemplateSchema = exports.learningPlanTemplates = exports.insertPaymentReconciliationSchema = exports.paymentReconciliations = exports.insertRolePermissionSchema = exports.rolePermissions = exports.insertPermissionDefinitionSchema = exports.permissionDefinitions = exports.insertRoleDefinitionSchema = exports.roleDefinitions = exports.insertConsentRecordSchema = exports.consentRecords = exports.insertEntityCodeSchema = exports.entityCodes = exports.insertPlatformSettingSchema = exports.platformSettings = exports.insertAdminAuditLogSchema = exports.adminAuditLogs = exports.insertPlatformTransactionSchema = exports.platformTransactions = exports.insertStudentEnrollmentSchema = exports.studentEnrollments = exports.insertKycDocumentSchema = exports.kycDocuments = exports.insertOnboardingApprovalSchema = exports.onboardingApprovals = exports.insertMentorTaskSchema = exports.mentorTasks = exports.insertMentorProfileSchema = exports.mentorProfiles = exports.insertJobApprovalLogSchema = exports.jobApprovalLogs = exports.insertHrAuditLogSchema = exports.hrAuditLogs = exports.insertWhiteLabelPartnerSchema = exports.whiteLabelPartners = exports.insertInstitutionalSlaSchema = exports.institutionalSlas = exports.insertMentorPayoutSchema = exports.mentorPayouts = exports.insertComplianceViolationSchema = exports.complianceViolations = exports.insertHrConsentLogSchema = exports.hrConsentLogs = exports.insertMentorKpiSchema = exports.mentorKpis = exports.insertTrainingEnrollmentSchema = exports.trainingEnrollments = exports.insertTrainingProgramSchema = exports.trainingPrograms = void 0;
exports.insertLbiAssessmentSessionSchema = exports.lbiAssessmentSessions = exports.insertLbiScoringRuleSchema = exports.lbiScoringRules = exports.insertLbiQuestionSchema = exports.lbiQuestions = exports.insertLbiResponseScaleSchema = exports.lbiResponseScales = exports.insertLbiAgeBandSchema = exports.lbiAgeBands = exports.insertLbiSubdomainSchema = exports.lbiSubdomains = exports.insertLbiDomainSchema = exports.lbiDomains = exports.insertStudentSubscriptionSchema = exports.studentSubscriptions = exports.insertSubscriptionPackageSchema = exports.subscriptionPackages = exports.insertAccessControlPolicySchema = exports.accessControlPolicies = exports.insertDataRetentionPolicySchema = exports.dataRetentionPolicies = exports.insertComplianceAuditLogSchema = exports.complianceAuditLogs = exports.insertSecurityIncidentSchema = exports.securityIncidents = exports.insertSecurityConfigurationSchema = exports.securityConfigurations = exports.insertStudentImportRecordSchema = exports.studentImportRecords = exports.insertStudentBulkImportSchema = exports.studentBulkImports = exports.insertPreOnboardingChecklistSchema = exports.preOnboardingChecklists = exports.insertConsentTypeSchema = exports.consentTypes = exports.insertKycDocumentTypeSchema = exports.kycDocumentTypes = exports.insertDocumentAccessLogSchema = exports.documentAccessLogs = exports.insertDocumentSchema = exports.documents = exports.insertDocumentFolderSchema = exports.documentFolders = exports.insertUserSessionSchema = exports.userSessions = exports.insertLeiRegistrationSchema = exports.leiRegistrations = exports.insertNgoRegistrationSchema = exports.ngoRegistrations = void 0;
exports.insertMfaCodeSchema = exports.mfaCodes = exports.insertNotificationBroadcastSchema = exports.notificationBroadcasts = exports.insertAcknowledgementSchema = exports.acknowledgements = exports.insertEmailConsentSchema = exports.emailConsents = exports.insertNotificationSchema = exports.notifications = exports.insertLbiOverallIndexSchema = exports.lbiOverallIndex = exports.insertLbiSubdomainScoreSchema = exports.lbiSubdomainScores = exports.insertLbiDomainScoreSchema = exports.lbiDomainScores = exports.insertLbiSessionResponseSchema = exports.lbiSessionResponses = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_zod_1 = require("drizzle-zod");
// Users table (authentication)
exports.users = (0, pg_core_1.pgTable)("users", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    username: (0, pg_core_1.text)("username").notNull().unique(),
    password: (0, pg_core_1.text)("password").notNull(),
    fullName: (0, pg_core_1.text)("full_name"),
    role: (0, pg_core_1.text)("role").notNull().default('parent'), // Active/current role
    roles: (0, pg_core_1.text)("roles").array().notNull().default((0, drizzle_orm_1.sql) `ARRAY['parent']::text[]`), // All roles user has access to
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertUserSchema = (0, drizzle_zod_1.createInsertSchema)(exports.users).omit({
    id: true,
    createdAt: true,
});
// Institute table
exports.institutes = (0, pg_core_1.pgTable)("institutes", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    adminUserId: (0, pg_core_1.varchar)("admin_user_id").references(() => exports.users.id, { onDelete: 'set null' }),
    instituteCode: (0, pg_core_1.text)("institute_code").notNull().unique(),
    legalName: (0, pg_core_1.text)("legal_name").notNull(),
    displayName: (0, pg_core_1.text)("display_name").notNull(),
    status: (0, pg_core_1.text)("status").notNull().default('Active'),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertInstituteSchema = (0, drizzle_zod_1.createInsertSchema)(exports.institutes).omit({
    id: true,
    createdAt: true,
});
// Batch table
exports.batches = (0, pg_core_1.pgTable)("batches", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    instituteId: (0, pg_core_1.varchar)("institute_id").notNull().references(() => exports.institutes.id, { onDelete: 'cascade' }),
    batchCode: (0, pg_core_1.text)("batch_code").notNull(),
    batchName: (0, pg_core_1.text)("batch_name").notNull(),
    academicYear: (0, pg_core_1.text)("academic_year").notNull(),
    status: (0, pg_core_1.text)("status").notNull().default('Active'),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertBatchSchema = (0, drizzle_zod_1.createInsertSchema)(exports.batches).omit({
    id: true,
    createdAt: true,
});
// Parent table (linked to user)
exports.parents = (0, pg_core_1.pgTable)("parents", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    fullName: (0, pg_core_1.text)("full_name").notNull(),
    mobile: (0, pg_core_1.text)("mobile"),
    status: (0, pg_core_1.text)("status").notNull().default('Active'),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertParentSchema = (0, drizzle_zod_1.createInsertSchema)(exports.parents).omit({
    id: true,
    createdAt: true,
});
// Student table (linked to user and institute)
exports.students = (0, pg_core_1.pgTable)("students", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    userId: (0, pg_core_1.varchar)("user_id").references(() => exports.users.id, { onDelete: 'set null' }),
    instituteId: (0, pg_core_1.varchar)("institute_id").references(() => exports.institutes.id, { onDelete: 'set null' }),
    studentCode: (0, pg_core_1.text)("student_code").notNull().unique(),
    fullName: (0, pg_core_1.text)("full_name").notNull(),
    dob: (0, pg_core_1.date)("dob"),
    status: (0, pg_core_1.text)("status").notNull().default('Active'),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertStudentSchema = (0, drizzle_zod_1.createInsertSchema)(exports.students).omit({
    id: true,
    createdAt: true,
});
// Parent-Student Link (for multi-child support)
exports.parentStudentLinks = (0, pg_core_1.pgTable)("parent_student_links", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    parentId: (0, pg_core_1.varchar)("parent_id").notNull().references(() => exports.parents.id, { onDelete: 'cascade' }),
    studentId: (0, pg_core_1.varchar)("student_id").notNull().references(() => exports.students.id, { onDelete: 'cascade' }),
    relationship: (0, pg_core_1.text)("relationship").default('Parent'),
    lbiConsent: (0, pg_core_1.boolean)("lbi_consent").notNull().default(false),
    consentDate: (0, pg_core_1.timestamp)("consent_date"),
    consentRevokedDate: (0, pg_core_1.timestamp)("consent_revoked_date"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertParentStudentLinkSchema = (0, drizzle_zod_1.createInsertSchema)(exports.parentStudentLinks).omit({
    id: true,
    createdAt: true,
    consentDate: true,
    consentRevokedDate: true,
});
// Enrollment Request
exports.enrollmentRequests = (0, pg_core_1.pgTable)("enrollment_requests", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    instituteId: (0, pg_core_1.varchar)("institute_id").notNull().references(() => exports.institutes.id, { onDelete: 'cascade' }),
    studentId: (0, pg_core_1.varchar)("student_id").notNull().references(() => exports.students.id, { onDelete: 'cascade' }),
    batchId: (0, pg_core_1.varchar)("batch_id").notNull().references(() => exports.batches.id, { onDelete: 'cascade' }),
    status: (0, pg_core_1.text)("status").notNull().default('Submitted'),
    requestedOn: (0, pg_core_1.timestamp)("requested_on").notNull().defaultNow(),
});
exports.insertEnrollmentRequestSchema = (0, drizzle_zod_1.createInsertSchema)(exports.enrollmentRequests).omit({
    id: true,
});
// Exam table
exports.exams = (0, pg_core_1.pgTable)("exams", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    instituteId: (0, pg_core_1.varchar)("institute_id").notNull().references(() => exports.institutes.id, { onDelete: 'cascade' }),
    examCode: (0, pg_core_1.text)("exam_code").notNull().unique(),
    examName: (0, pg_core_1.text)("exam_name").notNull(),
    batchId: (0, pg_core_1.varchar)("batch_id").notNull().references(() => exports.batches.id, { onDelete: 'cascade' }),
    status: (0, pg_core_1.text)("status").notNull().default('Draft'),
    startAt: (0, pg_core_1.timestamp)("start_at").notNull(),
    endAt: (0, pg_core_1.timestamp)("end_at").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertExamSchema = (0, drizzle_zod_1.createInsertSchema)(exports.exams).omit({
    id: true,
    createdAt: true,
});
// Assessment Templates - Browsable academic assessments for parents
exports.assessmentTemplates = (0, pg_core_1.pgTable)("assessment_templates", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    title: (0, pg_core_1.text)("title").notNull(),
    subject: (0, pg_core_1.text)("subject").notNull(),
    grade: (0, pg_core_1.text)("grade").notNull(), // e.g., "Grade 6", "Grade 7"
    description: (0, pg_core_1.text)("description"),
    duration: (0, pg_core_1.integer)("duration").notNull().default(60), // minutes
    totalMarks: (0, pg_core_1.integer)("total_marks").notNull().default(100),
    difficulty: (0, pg_core_1.text)("difficulty").notNull().default('Medium'), // Easy, Medium, Hard
    category: (0, pg_core_1.text)("category").notNull().default('Academic'), // Academic, Practice, Olympiad
    isActive: (0, pg_core_1.boolean)("is_active").notNull().default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertAssessmentTemplateSchema = (0, drizzle_zod_1.createInsertSchema)(exports.assessmentTemplates).omit({
    id: true,
    createdAt: true,
});
// Assessment Template Questions
exports.assessmentTemplateQuestions = (0, pg_core_1.pgTable)("assessment_template_questions", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    templateId: (0, pg_core_1.varchar)("template_id").notNull().references(() => exports.assessmentTemplates.id, { onDelete: 'cascade' }),
    questionText: (0, pg_core_1.text)("question_text").notNull(),
    optionA: (0, pg_core_1.text)("option_a").notNull(),
    optionB: (0, pg_core_1.text)("option_b").notNull(),
    optionC: (0, pg_core_1.text)("option_c"),
    optionD: (0, pg_core_1.text)("option_d"),
    correctOption: (0, pg_core_1.text)("correct_option").notNull(),
    marks: (0, pg_core_1.integer)("marks").notNull().default(1),
    orderIndex: (0, pg_core_1.integer)("order_index").notNull().default(0),
});
exports.insertAssessmentTemplateQuestionSchema = (0, drizzle_zod_1.createInsertSchema)(exports.assessmentTemplateQuestions).omit({
    id: true,
});
// Exam Questions
exports.examQuestions = (0, pg_core_1.pgTable)("exam_questions", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    examId: (0, pg_core_1.varchar)("exam_id").notNull().references(() => exports.exams.id, { onDelete: 'cascade' }),
    questionText: (0, pg_core_1.text)("question_text").notNull(),
    optionA: (0, pg_core_1.text)("option_a").notNull(),
    optionB: (0, pg_core_1.text)("option_b").notNull(),
    optionC: (0, pg_core_1.text)("option_c"),
    optionD: (0, pg_core_1.text)("option_d"),
    correctOption: (0, pg_core_1.text)("correct_option").notNull(), // 'A', 'B', 'C', 'D'
    marks: (0, pg_core_1.integer)("marks").notNull().default(1),
    orderIndex: (0, pg_core_1.integer)("order_index").notNull().default(0),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertExamQuestionSchema = (0, drizzle_zod_1.createInsertSchema)(exports.examQuestions).omit({
    id: true,
    createdAt: true,
});
// Exam Attempt
exports.examAttempts = (0, pg_core_1.pgTable)("exam_attempts", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    examId: (0, pg_core_1.varchar)("exam_id").notNull().references(() => exports.exams.id, { onDelete: 'cascade' }),
    studentId: (0, pg_core_1.varchar)("student_id").notNull().references(() => exports.students.id, { onDelete: 'cascade' }),
    status: (0, pg_core_1.text)("status").notNull().default('In Progress'),
    scoreObtained: (0, pg_core_1.real)("score_obtained"),
    totalMarks: (0, pg_core_1.real)("total_marks"),
    startedAt: (0, pg_core_1.timestamp)("started_at").defaultNow(),
    submittedAt: (0, pg_core_1.timestamp)("submitted_at"),
});
exports.insertExamAttemptSchema = (0, drizzle_zod_1.createInsertSchema)(exports.examAttempts).omit({
    id: true,
});
// Exam Responses (student answers)
exports.examResponses = (0, pg_core_1.pgTable)("exam_responses", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    attemptId: (0, pg_core_1.varchar)("attempt_id").notNull().references(() => exports.examAttempts.id, { onDelete: 'cascade' }),
    questionId: (0, pg_core_1.varchar)("question_id").notNull().references(() => exports.examQuestions.id, { onDelete: 'cascade' }),
    selectedOption: (0, pg_core_1.text)("selected_option"), // 'A', 'B', 'C', 'D' or null if not answered
    isCorrect: (0, pg_core_1.boolean)("is_correct"),
    marksObtained: (0, pg_core_1.real)("marks_obtained").default(0),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertExamResponseSchema = (0, drizzle_zod_1.createInsertSchema)(exports.examResponses).omit({
    id: true,
    createdAt: true,
});
// LBI Type
exports.lbiTypes = (0, pg_core_1.pgTable)("lbi_types", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    typeName: (0, pg_core_1.text)("type_name").notNull().unique(),
    description: (0, pg_core_1.text)("description"),
    status: (0, pg_core_1.text)("status").notNull().default('Active'),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertLbiTypeSchema = (0, drizzle_zod_1.createInsertSchema)(exports.lbiTypes).omit({
    id: true,
    createdAt: true,
});
// LBI Assessment
exports.lbiAssessments = (0, pg_core_1.pgTable)("lbi_assessments", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    assessmentCode: (0, pg_core_1.text)("assessment_code").notNull().unique(),
    assessmentName: (0, pg_core_1.text)("assessment_name").notNull(),
    lbiTypeId: (0, pg_core_1.varchar)("lbi_type_id").notNull().references(() => exports.lbiTypes.id, { onDelete: 'cascade' }),
    totalQuestions: (0, pg_core_1.integer)("total_questions").notNull(),
    status: (0, pg_core_1.text)("status").notNull().default('Active'),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertLbiAssessmentSchema = (0, drizzle_zod_1.createInsertSchema)(exports.lbiAssessments).omit({
    id: true,
    createdAt: true,
});
// Legacy LBI Question Bank (psychopsis system)
exports.lbiQuestionsLegacy = (0, pg_core_1.pgTable)("lbi_questions_legacy", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    questionCode: (0, pg_core_1.text)("question_code").notNull(),
    lbiTypeId: (0, pg_core_1.varchar)("lbi_type_id").notNull().references(() => exports.lbiTypes.id, { onDelete: 'cascade' }),
    difficultyLevel: (0, pg_core_1.integer)("difficulty_level").notNull(),
    questionText: (0, pg_core_1.text)("question_text").notNull(),
    status: (0, pg_core_1.text)("status").notNull().default('Draft'),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertLbiQuestionLegacySchema = (0, drizzle_zod_1.createInsertSchema)(exports.lbiQuestionsLegacy).omit({
    id: true,
    createdAt: true,
});
// LBI Session
exports.lbiSessions = (0, pg_core_1.pgTable)("lbi_sessions", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    assessmentId: (0, pg_core_1.varchar)("assessment_id").notNull().references(() => exports.lbiAssessments.id, { onDelete: 'cascade' }),
    studentId: (0, pg_core_1.varchar)("student_id").notNull().references(() => exports.students.id, { onDelete: 'cascade' }),
    status: (0, pg_core_1.text)("status").notNull().default('Not Started'),
    startedAt: (0, pg_core_1.timestamp)("started_at"),
    completedAt: (0, pg_core_1.timestamp)("completed_at"),
});
exports.insertLbiSessionSchema = (0, drizzle_zod_1.createInsertSchema)(exports.lbiSessions).omit({
    id: true,
});
// Consent Log for audit trail (DPDP compliance)
exports.consentLogs = (0, pg_core_1.pgTable)("consent_logs", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    parentStudentLinkId: (0, pg_core_1.varchar)("parent_student_link_id").notNull().references(() => exports.parentStudentLinks.id, { onDelete: 'cascade' }),
    parentId: (0, pg_core_1.varchar)("parent_id").notNull().references(() => exports.parents.id, { onDelete: 'cascade' }),
    action: (0, pg_core_1.text)("action").notNull(),
    reason: (0, pg_core_1.text)("reason"),
    ipAddress: (0, pg_core_1.text)("ip_address"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertConsentLogSchema = (0, drizzle_zod_1.createInsertSchema)(exports.consentLogs).omit({
    id: true,
    createdAt: true,
});
// Behavioural Insights (LBI data) - for production students table
exports.behaviouralInsights = (0, pg_core_1.pgTable)("behavioural_insights", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    studentId: (0, pg_core_1.varchar)("student_id").notNull(),
    category: (0, pg_core_1.text)("category").notNull(),
    metric: (0, pg_core_1.text)("metric").notNull(),
    value: (0, pg_core_1.integer)("value"),
    description: (0, pg_core_1.text)("description"),
    recordedAt: (0, pg_core_1.timestamp)("recorded_at").notNull().defaultNow(),
});
exports.insertBehaviouralInsightSchema = (0, drizzle_zod_1.createInsertSchema)(exports.behaviouralInsights).omit({
    id: true,
});
// ============================================
// PSYCHOMETRIC ASSESSMENT FRAMEWORK
// ============================================
// Age Bands for psychometric assessments
exports.psychometricAgeBands = (0, pg_core_1.pgTable)("psychometric_age_bands", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    bandCode: (0, pg_core_1.text)("band_code").notNull().unique(), // A, B, C, D, E, E1
    bandName: (0, pg_core_1.text)("band_name").notNull(), // Primary school, Upper primary, etc.
    ageRangeStart: (0, pg_core_1.integer)("age_range_start").notNull(), // 8, 10, 12, 14, 16, 19
    ageRangeEnd: (0, pg_core_1.integer)("age_range_end"), // 9, 11, 13, 15, 18, null for 19+
    context: (0, pg_core_1.text)("context").notNull(), // Primary school, Corporate, etc.
    displayOrder: (0, pg_core_1.integer)("display_order").notNull().default(1),
    isActive: (0, pg_core_1.boolean)("is_active").notNull().default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertPsychometricAgeBandSchema = (0, drizzle_zod_1.createInsertSchema)(exports.psychometricAgeBands).omit({
    id: true,
    createdAt: true,
});
// Psychometric Domains (20 domains)
exports.psychometricDomains = (0, pg_core_1.pgTable)("psychometric_domains", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    domainCode: (0, pg_core_1.text)("domain_code").notNull().unique(),
    domainName: (0, pg_core_1.text)("domain_name").notNull(),
    description: (0, pg_core_1.text)("description"),
    category: (0, pg_core_1.text)("category").default('Core'), // Core, Optional, Add-on
    displayOrder: (0, pg_core_1.integer)("display_order").notNull().default(1),
    iconName: (0, pg_core_1.text)("icon_name"), // For UI display
    colorCode: (0, pg_core_1.text)("color_code"), // Hex color for UI
    isActive: (0, pg_core_1.boolean)("is_active").notNull().default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.insertPsychometricDomainSchema = (0, drizzle_zod_1.createInsertSchema)(exports.psychometricDomains).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// Psychometric Subdomains (linked to domains)
exports.psychometricSubdomains = (0, pg_core_1.pgTable)("psychometric_subdomains", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    domainId: (0, pg_core_1.varchar)("domain_id").notNull().references(() => exports.psychometricDomains.id, { onDelete: 'cascade' }),
    subdomainCode: (0, pg_core_1.text)("subdomain_code").notNull().unique(),
    subdomainName: (0, pg_core_1.text)("subdomain_name").notNull(),
    description: (0, pg_core_1.text)("description"),
    measurementScale: (0, pg_core_1.text)("measurement_scale").default('1-10'), // Rating scale
    displayOrder: (0, pg_core_1.integer)("display_order").notNull().default(1),
    isActive: (0, pg_core_1.boolean)("is_active").notNull().default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertPsychometricSubdomainSchema = (0, drizzle_zod_1.createInsertSchema)(exports.psychometricSubdomains).omit({
    id: true,
    createdAt: true,
});
// Domain-AgeBand Configuration (which domains are active for which age bands)
exports.psychometricDomainAgeBandConfig = (0, pg_core_1.pgTable)("psychometric_domain_age_band_config", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    domainId: (0, pg_core_1.varchar)("domain_id").notNull().references(() => exports.psychometricDomains.id, { onDelete: 'cascade' }),
    ageBandId: (0, pg_core_1.varchar)("age_band_id").notNull().references(() => exports.psychometricAgeBands.id, { onDelete: 'cascade' }),
    isEnabled: (0, pg_core_1.boolean)("is_enabled").notNull().default(true),
    questionsCount: (0, pg_core_1.integer)("questions_count").default(10), // Number of questions for this domain/age combo
    weightage: (0, pg_core_1.real)("weightage").default(1.0), // Scoring weightage
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertPsychometricDomainAgeBandConfigSchema = (0, drizzle_zod_1.createInsertSchema)(exports.psychometricDomainAgeBandConfig).omit({
    id: true,
    createdAt: true,
});
// Psychometric Question Bank (age-specific questions)
exports.psychometricQuestionBank = (0, pg_core_1.pgTable)("psychometric_question_bank", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    questionCode: (0, pg_core_1.text)("question_code").notNull().unique(),
    domainId: (0, pg_core_1.varchar)("domain_id").notNull().references(() => exports.psychometricDomains.id, { onDelete: 'cascade' }),
    subdomainId: (0, pg_core_1.varchar)("subdomain_id").references(() => exports.psychometricSubdomains.id, { onDelete: 'set null' }),
    ageBandId: (0, pg_core_1.varchar)("age_band_id").notNull().references(() => exports.psychometricAgeBands.id, { onDelete: 'cascade' }),
    questionText: (0, pg_core_1.text)("question_text").notNull(),
    questionType: (0, pg_core_1.text)("question_type").notNull().default('Likert'), // Likert, MCQ, Scenario, SituationalJudgment
    responseOptions: (0, pg_core_1.text)("response_options"), // JSON array of options
    scoringLogic: (0, pg_core_1.text)("scoring_logic"), // JSON scoring rules
    reverseScored: (0, pg_core_1.boolean)("reverse_scored").notNull().default(false),
    difficulty: (0, pg_core_1.text)("difficulty").default('Medium'), // Easy, Medium, Hard
    language: (0, pg_core_1.text)("language").notNull().default('EN'),
    isActive: (0, pg_core_1.boolean)("is_active").notNull().default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertPsychometricQuestionBankSchema = (0, drizzle_zod_1.createInsertSchema)(exports.psychometricQuestionBank).omit({
    id: true,
    createdAt: true,
});
// Psychometric Assessment Results
exports.psychometricAssessmentResults = (0, pg_core_1.pgTable)("psychometric_assessment_results", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    studentId: (0, pg_core_1.varchar)("student_id").notNull(),
    ageBandId: (0, pg_core_1.varchar)("age_band_id").notNull().references(() => exports.psychometricAgeBands.id, { onDelete: 'cascade' }),
    domainId: (0, pg_core_1.varchar)("domain_id").notNull().references(() => exports.psychometricDomains.id, { onDelete: 'cascade' }),
    subdomainId: (0, pg_core_1.varchar)("subdomain_id").references(() => exports.psychometricSubdomains.id, { onDelete: 'set null' }),
    rawScore: (0, pg_core_1.real)("raw_score"),
    percentileScore: (0, pg_core_1.real)("percentile_score"),
    scaledScore: (0, pg_core_1.real)("scaled_score"),
    interpretation: (0, pg_core_1.text)("interpretation"), // Low, Average, High, etc.
    recommendations: (0, pg_core_1.text)("recommendations"),
    assessedAt: (0, pg_core_1.timestamp)("assessed_at").notNull().defaultNow(),
});
exports.insertPsychometricAssessmentResultSchema = (0, drizzle_zod_1.createInsertSchema)(exports.psychometricAssessmentResults).omit({
    id: true,
    assessedAt: true,
});
// Legacy: Children table (keeping for backward compatibility with existing dashboard)
exports.children = (0, pg_core_1.pgTable)("children", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    parentId: (0, pg_core_1.varchar)("parent_id").notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    studentUserId: (0, pg_core_1.varchar)("student_user_id").references(() => exports.users.id, { onDelete: 'set null' }),
    name: (0, pg_core_1.text)("name").notNull(),
    age: (0, pg_core_1.integer)("age").notNull(),
    grade: (0, pg_core_1.text)("grade").notNull(),
    classSection: (0, pg_core_1.text)("class_section"),
    schoolName: (0, pg_core_1.text)("school_name"),
    rollNumber: (0, pg_core_1.text)("roll_number"),
    gender: (0, pg_core_1.text)("gender"),
    dateOfBirth: (0, pg_core_1.date)("date_of_birth"),
    bloodGroup: (0, pg_core_1.text)("blood_group"),
    primaryLanguage: (0, pg_core_1.text)("primary_language"),
    educationBoard: (0, pg_core_1.text)("education_board"),
    city: (0, pg_core_1.text)("city"),
    state: (0, pg_core_1.text)("state"),
    specialNeeds: (0, pg_core_1.text)("special_needs"),
    // New analytics fields
    studyHours: (0, pg_core_1.text)("study_hours"),
    favoriteSubjects: (0, pg_core_1.text)("favorite_subjects").array(),
    weakSubjects: (0, pg_core_1.text)("weak_subjects").array(),
    learningStyle: (0, pg_core_1.text)("learning_style"),
    careerInterest: (0, pg_core_1.text)("career_interest"),
    relationship: (0, pg_core_1.text)("relationship"),
    schoolType: (0, pg_core_1.text)("school_type"),
    mediumOfInstruction: (0, pg_core_1.text)("medium_of_instruction"),
    extracurricular: (0, pg_core_1.text)("extracurricular"),
    emergencyContact: (0, pg_core_1.text)("emergency_contact"),
    medicalConditions: (0, pg_core_1.text)("medical_conditions"),
    // Consent fields
    lbiConsent: (0, pg_core_1.boolean)("lbi_consent").notNull().default(false),
    dataCollectionConsent: (0, pg_core_1.boolean)("data_collection_consent").notNull().default(false),
    dpdpConsent: (0, pg_core_1.boolean)("dpdp_consent").notNull().default(false),
    developmentAcknowledgment: (0, pg_core_1.boolean)("development_acknowledgment").notNull().default(false),
    progressSharingConsent: (0, pg_core_1.boolean)("progress_sharing_consent").notNull().default(false),
    consentDate: (0, pg_core_1.timestamp)("consent_date"),
    consentRevokedDate: (0, pg_core_1.timestamp)("consent_revoked_date"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.insertChildSchema = (0, drizzle_zod_1.createInsertSchema)(exports.children).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    consentDate: true,
    consentRevokedDate: true,
});
// Child Exams (for legacy children table - dashboard display)
exports.childExams = (0, pg_core_1.pgTable)("child_exams", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    childId: (0, pg_core_1.varchar)("child_id").notNull().references(() => exports.children.id, { onDelete: 'cascade' }),
    title: (0, pg_core_1.text)("title").notNull(),
    subject: (0, pg_core_1.text)("subject").notNull(),
    grade: (0, pg_core_1.text)("grade"),
    examType: (0, pg_core_1.text)("exam_type").notNull().default('academic'),
    status: (0, pg_core_1.text)("status").notNull().default('pending'),
    score: (0, pg_core_1.integer)("score"),
    totalMarks: (0, pg_core_1.integer)("total_marks").notNull().default(100),
    dueDate: (0, pg_core_1.timestamp)("due_date"),
    completedAt: (0, pg_core_1.timestamp)("completed_at"),
    improvedTopics: (0, pg_core_1.text)("improved_topics").array(),
    focusAreas: (0, pg_core_1.text)("focus_areas").array(),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertChildExamSchema = (0, drizzle_zod_1.createInsertSchema)(exports.childExams).omit({
    id: true,
    createdAt: true,
});
// Child Exam Questions (for parent-assigned assessments)
exports.childExamQuestions = (0, pg_core_1.pgTable)("child_exam_questions", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    childExamId: (0, pg_core_1.varchar)("child_exam_id").notNull().references(() => exports.childExams.id, { onDelete: 'cascade' }),
    questionText: (0, pg_core_1.text)("question_text").notNull(),
    optionA: (0, pg_core_1.text)("option_a").notNull(),
    optionB: (0, pg_core_1.text)("option_b").notNull(),
    optionC: (0, pg_core_1.text)("option_c"),
    optionD: (0, pg_core_1.text)("option_d"),
    correctOption: (0, pg_core_1.text)("correct_option").notNull(),
    marks: (0, pg_core_1.integer)("marks").notNull().default(1),
    orderIndex: (0, pg_core_1.integer)("order_index").notNull().default(0),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertChildExamQuestionSchema = (0, drizzle_zod_1.createInsertSchema)(exports.childExamQuestions).omit({
    id: true,
    createdAt: true,
});
// Legacy: LBI Categories (keeping for backward compatibility)
exports.lbiCategories = (0, pg_core_1.pgTable)("psychopsis_categories", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    title: (0, pg_core_1.text)("title").notNull(),
    description: (0, pg_core_1.text)("description"),
    status: (0, pg_core_1.text)("status").notNull().default('active'),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.insertLbiCategorySchema = (0, drizzle_zod_1.createInsertSchema)(exports.lbiCategories).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// Supervised Test Sessions (for parental monitoring of minor exams)
exports.supervisedTestSessions = (0, pg_core_1.pgTable)("supervised_test_sessions", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    examId: (0, pg_core_1.varchar)("exam_id").notNull().references(() => exports.childExams.id, { onDelete: 'cascade' }),
    parentId: (0, pg_core_1.varchar)("parent_id").notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    childId: (0, pg_core_1.varchar)("child_id").notNull().references(() => exports.children.id, { onDelete: 'cascade' }),
    status: (0, pg_core_1.text)("status").notNull().default('active'),
    startedAt: (0, pg_core_1.timestamp)("started_at").notNull().defaultNow(),
    endedAt: (0, pg_core_1.timestamp)("ended_at"),
});
exports.insertSupervisedTestSessionSchema = (0, drizzle_zod_1.createInsertSchema)(exports.supervisedTestSessions).omit({
    id: true,
    startedAt: true,
});
// LBI Assessment Modules (7 major modules)
exports.lbiModules = (0, pg_core_1.pgTable)("lbi_modules", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    moduleCode: (0, pg_core_1.text)("module_code").notNull().unique(),
    moduleName: (0, pg_core_1.text)("module_name").notNull(),
    description: (0, pg_core_1.text)("description"),
    displayOrder: (0, pg_core_1.integer)("display_order").notNull().default(0),
    status: (0, pg_core_1.text)("status").notNull().default('Active'),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertLbiModuleSchema = (0, drizzle_zod_1.createInsertSchema)(exports.lbiModules).omit({
    id: true,
    createdAt: true,
});
// LBI Sub-Modules (e.g., 1A, 1B, 1C for Module 1)
exports.lbiSubModules = (0, pg_core_1.pgTable)("lbi_sub_modules", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    moduleId: (0, pg_core_1.varchar)("module_id").notNull().references(() => exports.lbiModules.id, { onDelete: 'cascade' }),
    subModuleCode: (0, pg_core_1.text)("sub_module_code").notNull().unique(),
    subModuleName: (0, pg_core_1.text)("sub_module_name").notNull(),
    questionType: (0, pg_core_1.text)("question_type").notNull().default('likert'),
    description: (0, pg_core_1.text)("description"),
    displayOrder: (0, pg_core_1.integer)("display_order").notNull().default(0),
    status: (0, pg_core_1.text)("status").notNull().default('Active'),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertLbiSubModuleSchema = (0, drizzle_zod_1.createInsertSchema)(exports.lbiSubModules).omit({
    id: true,
    createdAt: true,
});
// Age Groups for difficulty selection
exports.lbiAgeGroups = (0, pg_core_1.pgTable)("lbi_age_groups", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    groupCode: (0, pg_core_1.text)("group_code").notNull().unique(),
    groupName: (0, pg_core_1.text)("group_name").notNull(),
    minAge: (0, pg_core_1.integer)("min_age").notNull(),
    maxAge: (0, pg_core_1.integer)("max_age").notNull(),
    difficultyLevel: (0, pg_core_1.integer)("difficulty_level").notNull(),
    status: (0, pg_core_1.text)("status").notNull().default('Active'),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertLbiAgeGroupSchema = (0, drizzle_zod_1.createInsertSchema)(exports.lbiAgeGroups).omit({
    id: true,
    createdAt: true,
});
// Question Bank Items (enhanced for all question types)
exports.lbiQuestionBank = (0, pg_core_1.pgTable)("lbi_question_bank", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    subModuleId: (0, pg_core_1.varchar)("sub_module_id").notNull().references(() => exports.lbiSubModules.id, { onDelete: 'cascade' }),
    questionCode: (0, pg_core_1.text)("question_code").notNull().unique(),
    setNumber: (0, pg_core_1.integer)("set_number"),
    difficultyLevel: (0, pg_core_1.integer)("difficulty_level").notNull().default(1),
    questionType: (0, pg_core_1.text)("question_type").notNull().default('likert'),
    questionText: (0, pg_core_1.text)("question_text").notNull(),
    passageText: (0, pg_core_1.text)("passage_text"),
    keying: (0, pg_core_1.text)("keying").notNull().default('Positive'),
    optionA: (0, pg_core_1.text)("option_a"),
    optionAScore: (0, pg_core_1.integer)("option_a_score"),
    optionB: (0, pg_core_1.text)("option_b"),
    optionBScore: (0, pg_core_1.integer)("option_b_score"),
    optionC: (0, pg_core_1.text)("option_c"),
    optionCScore: (0, pg_core_1.integer)("option_c_score"),
    optionD: (0, pg_core_1.text)("option_d"),
    optionDScore: (0, pg_core_1.integer)("option_d_score"),
    optionE: (0, pg_core_1.text)("option_e"),
    optionEScore: (0, pg_core_1.integer)("option_e_score"),
    correctAnswer: (0, pg_core_1.text)("correct_answer"),
    explanation: (0, pg_core_1.text)("explanation"),
    subject: (0, pg_core_1.text)("subject"),
    ageGroupId: (0, pg_core_1.varchar)("age_group_id"),
    language: (0, pg_core_1.text)("language").default('EN'),
    anchor: (0, pg_core_1.boolean)("anchor").notNull().default(false),
    status: (0, pg_core_1.text)("status").notNull().default('Active'),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertLbiQuestionBankSchema = (0, drizzle_zod_1.createInsertSchema)(exports.lbiQuestionBank).omit({
    id: true,
    createdAt: true,
});
// Student Assessment Sessions (tracking assessment progress)
exports.studentAssessmentSessions = (0, pg_core_1.pgTable)("student_assessment_sessions", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    studentId: (0, pg_core_1.varchar)("student_id").notNull(),
    moduleId: (0, pg_core_1.varchar)("module_id").notNull().references(() => exports.lbiModules.id, { onDelete: 'cascade' }),
    ageGroupId: (0, pg_core_1.varchar)("age_group_id").references(() => exports.lbiAgeGroups.id, { onDelete: 'set null' }),
    status: (0, pg_core_1.text)("status").notNull().default('Not Started'),
    totalQuestions: (0, pg_core_1.integer)("total_questions").notNull().default(0),
    questionsAnswered: (0, pg_core_1.integer)("questions_answered").notNull().default(0),
    rawScore: (0, pg_core_1.real)("raw_score"),
    percentileScore: (0, pg_core_1.real)("percentile_score"),
    startedAt: (0, pg_core_1.timestamp)("started_at"),
    completedAt: (0, pg_core_1.timestamp)("completed_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertStudentAssessmentSessionSchema = (0, drizzle_zod_1.createInsertSchema)(exports.studentAssessmentSessions).omit({
    id: true,
    createdAt: true,
});
// Student Assessment Responses (individual question responses)
exports.studentAssessmentResponses = (0, pg_core_1.pgTable)("student_assessment_responses", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    sessionId: (0, pg_core_1.varchar)("session_id").notNull().references(() => exports.studentAssessmentSessions.id, { onDelete: 'cascade' }),
    questionId: (0, pg_core_1.varchar)("question_id").notNull().references(() => exports.lbiQuestionBank.id, { onDelete: 'cascade' }),
    selectedOption: (0, pg_core_1.text)("selected_option"),
    textResponse: (0, pg_core_1.text)("text_response"),
    score: (0, pg_core_1.integer)("score"),
    responseTimeMs: (0, pg_core_1.integer)("response_time_ms"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertStudentAssessmentResponseSchema = (0, drizzle_zod_1.createInsertSchema)(exports.studentAssessmentResponses).omit({
    id: true,
    createdAt: true,
});
// Competency Library (300 behavioral competencies)
exports.competencyLibrary = (0, pg_core_1.pgTable)("competency_library", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    competencyNumber: (0, pg_core_1.integer)("competency_number").notNull().unique(),
    competencyName: (0, pg_core_1.text)("competency_name").notNull(),
    domain: (0, pg_core_1.text)("domain"),
    subDomain: (0, pg_core_1.text)("sub_domain"),
    description: (0, pg_core_1.text)("description"),
    status: (0, pg_core_1.text)("status").notNull().default('Active'),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertCompetencyLibrarySchema = (0, drizzle_zod_1.createInsertSchema)(exports.competencyLibrary).omit({
    id: true,
    createdAt: true,
});
// Student Competency Scores (mapped from assessment results)
exports.studentCompetencyScores = (0, pg_core_1.pgTable)("student_competency_scores", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    studentId: (0, pg_core_1.varchar)("student_id").notNull(),
    competencyId: (0, pg_core_1.varchar)("competency_id").notNull().references(() => exports.competencyLibrary.id, { onDelete: 'cascade' }),
    sessionId: (0, pg_core_1.varchar)("session_id").references(() => exports.studentAssessmentSessions.id, { onDelete: 'set null' }),
    rawScore: (0, pg_core_1.real)("raw_score"),
    percentileScore: (0, pg_core_1.real)("percentile_score"),
    proficiencyLevel: (0, pg_core_1.text)("proficiency_level"),
    assessedAt: (0, pg_core_1.timestamp)("assessed_at").notNull().defaultNow(),
});
exports.insertStudentCompetencyScoreSchema = (0, drizzle_zod_1.createInsertSchema)(exports.studentCompetencyScores).omit({
    id: true,
    assessedAt: true,
});
// ============================================
// CURRICULUM CATALOG
// ============================================
// Education Boards (CBSE, ICSE, State Boards, etc.)
exports.educationBoards = (0, pg_core_1.pgTable)("education_boards", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    boardCode: (0, pg_core_1.text)("board_code").notNull().unique(),
    boardName: (0, pg_core_1.text)("board_name").notNull(),
    description: (0, pg_core_1.text)("description"),
    country: (0, pg_core_1.text)("country").notNull().default('India'),
    status: (0, pg_core_1.text)("status").notNull().default('Active'),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertEducationBoardSchema = (0, drizzle_zod_1.createInsertSchema)(exports.educationBoards).omit({
    id: true,
    createdAt: true,
});
// Classes/Grades (1-12, etc.)
exports.academicClasses = (0, pg_core_1.pgTable)("academic_classes", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    boardId: (0, pg_core_1.varchar)("board_id").notNull().references(() => exports.educationBoards.id, { onDelete: 'cascade' }),
    classNumber: (0, pg_core_1.integer)("class_number").notNull(),
    className: (0, pg_core_1.text)("class_name").notNull(),
    displayOrder: (0, pg_core_1.integer)("display_order").notNull().default(0),
    status: (0, pg_core_1.text)("status").notNull().default('Active'),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertAcademicClassSchema = (0, drizzle_zod_1.createInsertSchema)(exports.academicClasses).omit({
    id: true,
    createdAt: true,
});
// Subjects (Mathematics, Science, English, etc.)
exports.academicSubjects = (0, pg_core_1.pgTable)("academic_subjects", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    boardId: (0, pg_core_1.varchar)("board_id").notNull().references(() => exports.educationBoards.id, { onDelete: 'cascade' }),
    classId: (0, pg_core_1.varchar)("class_id").notNull().references(() => exports.academicClasses.id, { onDelete: 'cascade' }),
    subjectCode: (0, pg_core_1.text)("subject_code").notNull(),
    subjectName: (0, pg_core_1.text)("subject_name").notNull(),
    subjectType: (0, pg_core_1.text)("subject_type").notNull().default('Core'),
    displayOrder: (0, pg_core_1.integer)("display_order").notNull().default(0),
    status: (0, pg_core_1.text)("status").notNull().default('Active'),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertAcademicSubjectSchema = (0, drizzle_zod_1.createInsertSchema)(exports.academicSubjects).omit({
    id: true,
    createdAt: true,
});
// Chapters within Subjects
exports.academicChapters = (0, pg_core_1.pgTable)("academic_chapters", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    subjectId: (0, pg_core_1.varchar)("subject_id").notNull().references(() => exports.academicSubjects.id, { onDelete: 'cascade' }),
    chapterNumber: (0, pg_core_1.integer)("chapter_number").notNull(),
    chapterName: (0, pg_core_1.text)("chapter_name").notNull(),
    description: (0, pg_core_1.text)("description"),
    estimatedHours: (0, pg_core_1.real)("estimated_hours"),
    displayOrder: (0, pg_core_1.integer)("display_order").notNull().default(0),
    status: (0, pg_core_1.text)("status").notNull().default('Active'),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertAcademicChapterSchema = (0, drizzle_zod_1.createInsertSchema)(exports.academicChapters).omit({
    id: true,
    createdAt: true,
});
// Topics within Chapters
exports.academicTopics = (0, pg_core_1.pgTable)("academic_topics", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    chapterId: (0, pg_core_1.varchar)("chapter_id").notNull().references(() => exports.academicChapters.id, { onDelete: 'cascade' }),
    topicNumber: (0, pg_core_1.integer)("topic_number").notNull(),
    topicName: (0, pg_core_1.text)("topic_name").notNull(),
    description: (0, pg_core_1.text)("description"),
    displayOrder: (0, pg_core_1.integer)("display_order").notNull().default(0),
    status: (0, pg_core_1.text)("status").notNull().default('Active'),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertAcademicTopicSchema = (0, drizzle_zod_1.createInsertSchema)(exports.academicTopics).omit({
    id: true,
    createdAt: true,
});
// ============================================
// CHILD ACADEMIC PROFILE
// ============================================
// Child's academic profile linking to curriculum
exports.childAcademicProfiles = (0, pg_core_1.pgTable)("child_academic_profiles", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    childId: (0, pg_core_1.varchar)("child_id").notNull().references(() => exports.children.id, { onDelete: 'cascade' }),
    boardId: (0, pg_core_1.varchar)("board_id").references(() => exports.educationBoards.id, { onDelete: 'set null' }),
    classId: (0, pg_core_1.varchar)("class_id").references(() => exports.academicClasses.id, { onDelete: 'set null' }),
    academicYear: (0, pg_core_1.text)("academic_year").notNull(),
    section: (0, pg_core_1.text)("section"),
    rollNumber: (0, pg_core_1.text)("roll_number"),
    status: (0, pg_core_1.text)("status").notNull().default('Active'),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.insertChildAcademicProfileSchema = (0, drizzle_zod_1.createInsertSchema)(exports.childAcademicProfiles).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// Child's enrolled subjects
exports.childSubjectEnrollments = (0, pg_core_1.pgTable)("child_subject_enrollments", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    profileId: (0, pg_core_1.varchar)("profile_id").notNull().references(() => exports.childAcademicProfiles.id, { onDelete: 'cascade' }),
    subjectId: (0, pg_core_1.varchar)("subject_id").notNull().references(() => exports.academicSubjects.id, { onDelete: 'cascade' }),
    status: (0, pg_core_1.text)("status").notNull().default('Active'),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertChildSubjectEnrollmentSchema = (0, drizzle_zod_1.createInsertSchema)(exports.childSubjectEnrollments).omit({
    id: true,
    createdAt: true,
});
// ============================================
// STUDY TASKS (Parent-created)
// ============================================
exports.studyTasks = (0, pg_core_1.pgTable)("study_tasks", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    childId: (0, pg_core_1.varchar)("child_id").notNull().references(() => exports.children.id, { onDelete: 'cascade' }),
    createdByParentId: (0, pg_core_1.varchar)("created_by_parent_id").notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    title: (0, pg_core_1.text)("title").notNull(),
    description: (0, pg_core_1.text)("description"),
    taskType: (0, pg_core_1.text)("task_type").notNull().default('study'),
    subjectId: (0, pg_core_1.varchar)("subject_id").references(() => exports.academicSubjects.id, { onDelete: 'set null' }),
    chapterId: (0, pg_core_1.varchar)("chapter_id").references(() => exports.academicChapters.id, { onDelete: 'set null' }),
    topicId: (0, pg_core_1.varchar)("topic_id").references(() => exports.academicTopics.id, { onDelete: 'set null' }),
    priority: (0, pg_core_1.text)("priority").notNull().default('Medium'),
    dueDate: (0, pg_core_1.timestamp)("due_date"),
    estimatedMinutes: (0, pg_core_1.integer)("estimated_minutes"),
    status: (0, pg_core_1.text)("status").notNull().default('Pending'),
    completedAt: (0, pg_core_1.timestamp)("completed_at"),
    notes: (0, pg_core_1.text)("notes"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.insertStudyTaskSchema = (0, drizzle_zod_1.createInsertSchema)(exports.studyTasks).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// ============================================
// TEST MANAGEMENT SYSTEM
// ============================================
// Test Types/Blueprints
exports.testBlueprints = (0, pg_core_1.pgTable)("test_blueprints", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    blueprintCode: (0, pg_core_1.text)("blueprint_code").notNull().unique(),
    blueprintName: (0, pg_core_1.text)("blueprint_name").notNull(),
    testType: (0, pg_core_1.text)("test_type").notNull(),
    description: (0, pg_core_1.text)("description"),
    boardId: (0, pg_core_1.varchar)("board_id").references(() => exports.educationBoards.id, { onDelete: 'set null' }),
    classId: (0, pg_core_1.varchar)("class_id").references(() => exports.academicClasses.id, { onDelete: 'set null' }),
    subjectId: (0, pg_core_1.varchar)("subject_id").references(() => exports.academicSubjects.id, { onDelete: 'set null' }),
    chapterId: (0, pg_core_1.varchar)("chapter_id").references(() => exports.academicChapters.id, { onDelete: 'set null' }),
    duration: (0, pg_core_1.integer)("duration").notNull().default(60),
    totalMarks: (0, pg_core_1.integer)("total_marks").notNull().default(100),
    passingMarks: (0, pg_core_1.integer)("passing_marks").notNull().default(35),
    totalQuestions: (0, pg_core_1.integer)("total_questions").notNull().default(20),
    questionDistribution: (0, pg_core_1.text)("question_distribution"),
    instructions: (0, pg_core_1.text)("instructions"),
    createdBy: (0, pg_core_1.varchar)("created_by").references(() => exports.users.id, { onDelete: 'set null' }),
    instituteId: (0, pg_core_1.varchar)("institute_id").references(() => exports.institutes.id, { onDelete: 'set null' }),
    isPublic: (0, pg_core_1.boolean)("is_public").notNull().default(false),
    status: (0, pg_core_1.text)("status").notNull().default('Active'),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.insertTestBlueprintSchema = (0, drizzle_zod_1.createInsertSchema)(exports.testBlueprints).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// Test Question Bank (for manual import/entry)
exports.testQuestionBank = (0, pg_core_1.pgTable)("test_question_bank", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    questionCode: (0, pg_core_1.text)("question_code").notNull().unique(),
    questionType: (0, pg_core_1.text)("question_type").notNull().default('MCQ'),
    difficultyLevel: (0, pg_core_1.text)("difficulty_level").notNull().default('Medium'),
    questionText: (0, pg_core_1.text)("question_text").notNull(),
    optionA: (0, pg_core_1.text)("option_a"),
    optionB: (0, pg_core_1.text)("option_b"),
    optionC: (0, pg_core_1.text)("option_c"),
    optionD: (0, pg_core_1.text)("option_d"),
    optionE: (0, pg_core_1.text)("option_e"),
    correctOption: (0, pg_core_1.text)("correct_option"),
    answerText: (0, pg_core_1.text)("answer_text"),
    explanation: (0, pg_core_1.text)("explanation"),
    marks: (0, pg_core_1.integer)("marks").notNull().default(1),
    negativeMarks: (0, pg_core_1.real)("negative_marks").default(0),
    boardId: (0, pg_core_1.varchar)("board_id").references(() => exports.educationBoards.id, { onDelete: 'set null' }),
    classId: (0, pg_core_1.varchar)("class_id").references(() => exports.academicClasses.id, { onDelete: 'set null' }),
    subjectId: (0, pg_core_1.varchar)("subject_id").references(() => exports.academicSubjects.id, { onDelete: 'set null' }),
    chapterId: (0, pg_core_1.varchar)("chapter_id").references(() => exports.academicChapters.id, { onDelete: 'set null' }),
    topicId: (0, pg_core_1.varchar)("topic_id").references(() => exports.academicTopics.id, { onDelete: 'set null' }),
    assessmentType: (0, pg_core_1.text)("assessment_type").default('Practice'),
    assessmentCode: (0, pg_core_1.text)("assessment_code"),
    passageId: (0, pg_core_1.varchar)("passage_id"),
    caseStudyId: (0, pg_core_1.varchar)("case_study_id"),
    diagramUrl: (0, pg_core_1.text)("diagram_url"),
    tags: (0, pg_core_1.text)("tags").array(),
    language: (0, pg_core_1.text)("language").notNull().default('EN'),
    psychopsisSubModuleId: (0, pg_core_1.varchar)("psychopsis_sub_module_id").references(() => exports.lbiSubModules.id, { onDelete: 'set null' }),
    createdBy: (0, pg_core_1.varchar)("created_by").references(() => exports.users.id, { onDelete: 'set null' }),
    instituteId: (0, pg_core_1.varchar)("institute_id").references(() => exports.institutes.id, { onDelete: 'set null' }),
    isVerified: (0, pg_core_1.boolean)("is_verified").notNull().default(false),
    status: (0, pg_core_1.text)("status").notNull().default('Active'),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertTestQuestionBankSchema = (0, drizzle_zod_1.createInsertSchema)(exports.testQuestionBank).omit({
    id: true,
    createdAt: true,
});
// Assessment Blueprints (Templates for automatic paper generation)
exports.assessmentBlueprints = (0, pg_core_1.pgTable)("assessment_blueprints", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    blueprintCode: (0, pg_core_1.text)("blueprint_code").notNull().unique(),
    blueprintName: (0, pg_core_1.text)("blueprint_name").notNull(),
    boardId: (0, pg_core_1.varchar)("board_id").references(() => exports.educationBoards.id, { onDelete: 'set null' }),
    classId: (0, pg_core_1.varchar)("class_id").references(() => exports.academicClasses.id, { onDelete: 'set null' }),
    subjectId: (0, pg_core_1.varchar)("subject_id").references(() => exports.academicSubjects.id, { onDelete: 'set null' }),
    assessmentType: (0, pg_core_1.text)("assessment_type").notNull().default('Practice'),
    totalMarks: (0, pg_core_1.integer)("total_marks").notNull().default(100),
    durationMinutes: (0, pg_core_1.integer)("duration_minutes").notNull().default(60),
    instructions: (0, pg_core_1.text)("instructions"),
    passingMarks: (0, pg_core_1.integer)("passing_marks").default(35),
    isActive: (0, pg_core_1.boolean)("is_active").notNull().default(true),
    createdBy: (0, pg_core_1.varchar)("created_by").references(() => exports.users.id, { onDelete: 'set null' }),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertAssessmentBlueprintSchema = (0, drizzle_zod_1.createInsertSchema)(exports.assessmentBlueprints).omit({
    id: true,
    createdAt: true,
});
// Blueprint Sections (Child table for Assessment Blueprints)
exports.blueprintSections = (0, pg_core_1.pgTable)("blueprint_sections", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    blueprintId: (0, pg_core_1.varchar)("blueprint_id").notNull().references(() => exports.assessmentBlueprints.id, { onDelete: 'cascade' }),
    sectionName: (0, pg_core_1.text)("section_name").notNull(),
    sectionOrder: (0, pg_core_1.integer)("section_order").notNull().default(1),
    questionType: (0, pg_core_1.text)("question_type").notNull().default('MCQ'),
    difficultyMix: (0, pg_core_1.text)("difficulty_mix").default('40:40:20'),
    questionsCount: (0, pg_core_1.integer)("questions_count").notNull().default(10),
    marksPerQuestion: (0, pg_core_1.real)("marks_per_question").notNull().default(1),
    negativeMarks: (0, pg_core_1.real)("negative_marks").default(0),
    chapterScope: (0, pg_core_1.text)("chapter_scope").default('Full Syllabus'),
    chapterIds: (0, pg_core_1.text)("chapter_ids").array(),
    optionalQuestions: (0, pg_core_1.integer)("optional_questions").default(0),
    instructions: (0, pg_core_1.text)("instructions"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertBlueprintSectionSchema = (0, drizzle_zod_1.createInsertSchema)(exports.blueprintSections).omit({
    id: true,
    createdAt: true,
});
// Tests (Instances created from blueprints or custom)
exports.tests = (0, pg_core_1.pgTable)("tests", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    testCode: (0, pg_core_1.text)("test_code").notNull().unique(),
    testName: (0, pg_core_1.text)("test_name").notNull(),
    testType: (0, pg_core_1.text)("test_type").notNull(),
    blueprintId: (0, pg_core_1.varchar)("blueprint_id").references(() => exports.testBlueprints.id, { onDelete: 'set null' }),
    boardId: (0, pg_core_1.varchar)("board_id").references(() => exports.educationBoards.id, { onDelete: 'set null' }),
    classId: (0, pg_core_1.varchar)("class_id").references(() => exports.academicClasses.id, { onDelete: 'set null' }),
    subjectId: (0, pg_core_1.varchar)("subject_id").references(() => exports.academicSubjects.id, { onDelete: 'set null' }),
    chapterId: (0, pg_core_1.varchar)("chapter_id").references(() => exports.academicChapters.id, { onDelete: 'set null' }),
    duration: (0, pg_core_1.integer)("duration").notNull().default(60),
    totalMarks: (0, pg_core_1.integer)("total_marks").notNull().default(100),
    passingMarks: (0, pg_core_1.integer)("passing_marks").notNull().default(35),
    instructions: (0, pg_core_1.text)("instructions"),
    createdBy: (0, pg_core_1.varchar)("created_by").notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    instituteId: (0, pg_core_1.varchar)("institute_id").references(() => exports.institutes.id, { onDelete: 'set null' }),
    creatorType: (0, pg_core_1.text)("creator_type").notNull().default('parent'),
    workflowStatus: (0, pg_core_1.text)("workflow_status").notNull().default('Draft'),
    isAutoGenerated: (0, pg_core_1.boolean)("is_auto_generated").notNull().default(false),
    scheduledAt: (0, pg_core_1.timestamp)("scheduled_at"),
    expiresAt: (0, pg_core_1.timestamp)("expires_at"),
    status: (0, pg_core_1.text)("status").notNull().default('Active'),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.insertTestSchema = (0, drizzle_zod_1.createInsertSchema)(exports.tests).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// Test Questions (linked to test instances)
exports.testQuestions = (0, pg_core_1.pgTable)("test_questions", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    testId: (0, pg_core_1.varchar)("test_id").notNull().references(() => exports.tests.id, { onDelete: 'cascade' }),
    questionBankId: (0, pg_core_1.varchar)("question_bank_id").references(() => exports.testQuestionBank.id, { onDelete: 'set null' }),
    questionText: (0, pg_core_1.text)("question_text").notNull(),
    optionA: (0, pg_core_1.text)("option_a"),
    optionB: (0, pg_core_1.text)("option_b"),
    optionC: (0, pg_core_1.text)("option_c"),
    optionD: (0, pg_core_1.text)("option_d"),
    correctOption: (0, pg_core_1.text)("correct_option").notNull(),
    explanation: (0, pg_core_1.text)("explanation"),
    marks: (0, pg_core_1.integer)("marks").notNull().default(1),
    negativeMarks: (0, pg_core_1.real)("negative_marks").default(0),
    orderIndex: (0, pg_core_1.integer)("order_index").notNull().default(0),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertTestQuestionSchema = (0, drizzle_zod_1.createInsertSchema)(exports.testQuestions).omit({
    id: true,
    createdAt: true,
});
// ============================================
// TEST WORKFLOW & APPROVALS
// ============================================
// Test Workflow History
exports.testWorkflowHistory = (0, pg_core_1.pgTable)("test_workflow_history", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    testId: (0, pg_core_1.varchar)("test_id").notNull().references(() => exports.tests.id, { onDelete: 'cascade' }),
    fromStatus: (0, pg_core_1.text)("from_status").notNull(),
    toStatus: (0, pg_core_1.text)("to_status").notNull(),
    actionBy: (0, pg_core_1.varchar)("action_by").notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    actionType: (0, pg_core_1.text)("action_type").notNull(),
    comments: (0, pg_core_1.text)("comments"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertTestWorkflowHistorySchema = (0, drizzle_zod_1.createInsertSchema)(exports.testWorkflowHistory).omit({
    id: true,
    createdAt: true,
});
// Test Approvals
exports.testApprovals = (0, pg_core_1.pgTable)("test_approvals", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    testId: (0, pg_core_1.varchar)("test_id").notNull().references(() => exports.tests.id, { onDelete: 'cascade' }),
    approverUserId: (0, pg_core_1.varchar)("approver_user_id").notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    approvalStatus: (0, pg_core_1.text)("approval_status").notNull().default('Pending'),
    comments: (0, pg_core_1.text)("comments"),
    approvedAt: (0, pg_core_1.timestamp)("approved_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertTestApprovalSchema = (0, drizzle_zod_1.createInsertSchema)(exports.testApprovals).omit({
    id: true,
    createdAt: true,
});
// ============================================
// TEST ASSIGNMENTS
// ============================================
// Test Assignments (to children, batches, classes, sections)
exports.testAssignments = (0, pg_core_1.pgTable)("test_assignments", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    testId: (0, pg_core_1.varchar)("test_id").notNull().references(() => exports.tests.id, { onDelete: 'cascade' }),
    assignmentType: (0, pg_core_1.text)("assignment_type").notNull(),
    childId: (0, pg_core_1.varchar)("child_id").references(() => exports.children.id, { onDelete: 'cascade' }),
    batchId: (0, pg_core_1.varchar)("batch_id").references(() => exports.batches.id, { onDelete: 'cascade' }),
    instituteId: (0, pg_core_1.varchar)("institute_id").references(() => exports.institutes.id, { onDelete: 'cascade' }),
    section: (0, pg_core_1.text)("section"),
    assignedBy: (0, pg_core_1.varchar)("assigned_by").notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    startDate: (0, pg_core_1.timestamp)("start_date"),
    endDate: (0, pg_core_1.timestamp)("end_date"),
    status: (0, pg_core_1.text)("status").notNull().default('Active'),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertTestAssignmentSchema = (0, drizzle_zod_1.createInsertSchema)(exports.testAssignments).omit({
    id: true,
    createdAt: true,
});
// Test Attempts (student taking tests)
exports.testAttempts = (0, pg_core_1.pgTable)("test_attempts", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    testId: (0, pg_core_1.varchar)("test_id").notNull().references(() => exports.tests.id, { onDelete: 'cascade' }),
    assignmentId: (0, pg_core_1.varchar)("assignment_id").references(() => exports.testAssignments.id, { onDelete: 'set null' }),
    childId: (0, pg_core_1.varchar)("child_id").notNull().references(() => exports.children.id, { onDelete: 'cascade' }),
    status: (0, pg_core_1.text)("status").notNull().default('Not Started'),
    scoreObtained: (0, pg_core_1.real)("score_obtained"),
    totalMarks: (0, pg_core_1.real)("total_marks"),
    percentageScore: (0, pg_core_1.real)("percentage_score"),
    timeTakenSeconds: (0, pg_core_1.integer)("time_taken_seconds"),
    startedAt: (0, pg_core_1.timestamp)("started_at"),
    submittedAt: (0, pg_core_1.timestamp)("submitted_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertTestAttemptSchema = (0, drizzle_zod_1.createInsertSchema)(exports.testAttempts).omit({
    id: true,
    createdAt: true,
});
// Test Responses (answers to questions)
exports.testResponses = (0, pg_core_1.pgTable)("test_responses", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    attemptId: (0, pg_core_1.varchar)("attempt_id").notNull().references(() => exports.testAttempts.id, { onDelete: 'cascade' }),
    questionId: (0, pg_core_1.varchar)("question_id").notNull().references(() => exports.testQuestions.id, { onDelete: 'cascade' }),
    selectedOption: (0, pg_core_1.text)("selected_option"),
    isCorrect: (0, pg_core_1.boolean)("is_correct"),
    marksObtained: (0, pg_core_1.real)("marks_obtained").default(0),
    timeTakenSeconds: (0, pg_core_1.integer)("time_taken_seconds"),
    isFlagged: (0, pg_core_1.boolean)("is_flagged").notNull().default(false),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertTestResponseSchema = (0, drizzle_zod_1.createInsertSchema)(exports.testResponses).omit({
    id: true,
    createdAt: true,
});
// ============================================
// INSTITUTE STAFF & ROLES
// ============================================
// Staff Roles
exports.staffRoles = (0, pg_core_1.pgTable)("staff_roles", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    roleName: (0, pg_core_1.text)("role_name").notNull(),
    roleCode: (0, pg_core_1.text)("role_code").notNull().unique(),
    permissions: (0, pg_core_1.text)("permissions").array(),
    description: (0, pg_core_1.text)("description"),
    status: (0, pg_core_1.text)("status").notNull().default('Active'),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertStaffRoleSchema = (0, drizzle_zod_1.createInsertSchema)(exports.staffRoles).omit({
    id: true,
    createdAt: true,
});
// Institute Staff Members
exports.instituteStaff = (0, pg_core_1.pgTable)("institute_staff", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    instituteId: (0, pg_core_1.varchar)("institute_id").notNull().references(() => exports.institutes.id, { onDelete: 'cascade' }),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    roleId: (0, pg_core_1.varchar)("role_id").notNull().references(() => exports.staffRoles.id, { onDelete: 'cascade' }),
    staffCode: (0, pg_core_1.text)("staff_code"),
    fullName: (0, pg_core_1.text)("full_name").notNull(),
    email: (0, pg_core_1.text)("email"),
    phone: (0, pg_core_1.text)("phone"),
    department: (0, pg_core_1.text)("department"),
    status: (0, pg_core_1.text)("status").notNull().default('Active'),
    joinedAt: (0, pg_core_1.timestamp)("joined_at").notNull().defaultNow(),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertInstituteStaffSchema = (0, drizzle_zod_1.createInsertSchema)(exports.instituteStaff).omit({
    id: true,
    createdAt: true,
    joinedAt: true,
});
// Staff-Batch Assignments (which batches/classes teachers handle)
exports.staffBatchAssignments = (0, pg_core_1.pgTable)("staff_batch_assignments", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    staffId: (0, pg_core_1.varchar)("staff_id").notNull().references(() => exports.instituteStaff.id, { onDelete: 'cascade' }),
    batchId: (0, pg_core_1.varchar)("batch_id").notNull().references(() => exports.batches.id, { onDelete: 'cascade' }),
    subjectId: (0, pg_core_1.varchar)("subject_id").references(() => exports.academicSubjects.id, { onDelete: 'set null' }),
    isPrimary: (0, pg_core_1.boolean)("is_primary").notNull().default(false),
    status: (0, pg_core_1.text)("status").notNull().default('Active'),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertStaffBatchAssignmentSchema = (0, drizzle_zod_1.createInsertSchema)(exports.staffBatchAssignments).omit({
    id: true,
    createdAt: true,
});
// ============================================
// LEARNING FORUM
// ============================================
// Forum Posts
exports.forumPosts = (0, pg_core_1.pgTable)("forum_posts", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    authorId: (0, pg_core_1.varchar)("author_id").notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    authorType: (0, pg_core_1.text)("author_type").notNull().default('student'),
    childId: (0, pg_core_1.varchar)("child_id").references(() => exports.children.id, { onDelete: 'set null' }),
    testId: (0, pg_core_1.varchar)("test_id").references(() => exports.tests.id, { onDelete: 'set null' }),
    questionId: (0, pg_core_1.varchar)("question_id").references(() => exports.testQuestions.id, { onDelete: 'set null' }),
    title: (0, pg_core_1.text)("title").notNull(),
    content: (0, pg_core_1.text)("content").notNull(),
    postType: (0, pg_core_1.text)("post_type").notNull().default('doubt'),
    subjectId: (0, pg_core_1.varchar)("subject_id").references(() => exports.academicSubjects.id, { onDelete: 'set null' }),
    chapterId: (0, pg_core_1.varchar)("chapter_id").references(() => exports.academicChapters.id, { onDelete: 'set null' }),
    isAnonymous: (0, pg_core_1.boolean)("is_anonymous").notNull().default(false),
    visibility: (0, pg_core_1.text)("visibility").notNull().default('public'),
    targetAudience: (0, pg_core_1.text)("target_audience").notNull().default('all'),
    assignedMentorId: (0, pg_core_1.varchar)("assigned_mentor_id").references(() => exports.users.id, { onDelete: 'set null' }),
    assignedTeacherId: (0, pg_core_1.varchar)("assigned_teacher_id").references(() => exports.users.id, { onDelete: 'set null' }),
    status: (0, pg_core_1.text)("status").notNull().default('Open'),
    upvotes: (0, pg_core_1.integer)("upvotes").notNull().default(0),
    viewCount: (0, pg_core_1.integer)("view_count").notNull().default(0),
    isResolved: (0, pg_core_1.boolean)("is_resolved").notNull().default(false),
    resolvedAt: (0, pg_core_1.timestamp)("resolved_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.insertForumPostSchema = (0, drizzle_zod_1.createInsertSchema)(exports.forumPosts).omit({
    id: true,
    upvotes: true,
    viewCount: true,
    createdAt: true,
    updatedAt: true,
});
// Forum Replies
exports.forumReplies = (0, pg_core_1.pgTable)("forum_replies", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    postId: (0, pg_core_1.varchar)("post_id").notNull().references(() => exports.forumPosts.id, { onDelete: 'cascade' }),
    authorId: (0, pg_core_1.varchar)("author_id").notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    authorType: (0, pg_core_1.text)("author_type").notNull().default('student'),
    parentReplyId: (0, pg_core_1.varchar)("parent_reply_id"),
    content: (0, pg_core_1.text)("content").notNull(),
    isAnonymous: (0, pg_core_1.boolean)("is_anonymous").notNull().default(false),
    isAcceptedAnswer: (0, pg_core_1.boolean)("is_accepted_answer").notNull().default(false),
    upvotes: (0, pg_core_1.integer)("upvotes").notNull().default(0),
    status: (0, pg_core_1.text)("status").notNull().default('Active'),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.insertForumReplySchema = (0, drizzle_zod_1.createInsertSchema)(exports.forumReplies).omit({
    id: true,
    upvotes: true,
    createdAt: true,
    updatedAt: true,
});
// Forum Post Attachments
exports.forumAttachments = (0, pg_core_1.pgTable)("forum_attachments", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    postId: (0, pg_core_1.varchar)("post_id").references(() => exports.forumPosts.id, { onDelete: 'cascade' }),
    replyId: (0, pg_core_1.varchar)("reply_id").references(() => exports.forumReplies.id, { onDelete: 'cascade' }),
    fileName: (0, pg_core_1.text)("file_name").notNull(),
    fileType: (0, pg_core_1.text)("file_type").notNull(),
    fileUrl: (0, pg_core_1.text)("file_url").notNull(),
    fileSize: (0, pg_core_1.integer)("file_size"),
    status: (0, pg_core_1.text)("status").notNull().default('Active'),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertForumAttachmentSchema = (0, drizzle_zod_1.createInsertSchema)(exports.forumAttachments).omit({
    id: true,
    createdAt: true,
});
// Forum Moderation
exports.forumModerationLogs = (0, pg_core_1.pgTable)("forum_moderation_logs", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    postId: (0, pg_core_1.varchar)("post_id").references(() => exports.forumPosts.id, { onDelete: 'cascade' }),
    replyId: (0, pg_core_1.varchar)("reply_id").references(() => exports.forumReplies.id, { onDelete: 'cascade' }),
    reportedBy: (0, pg_core_1.varchar)("reported_by").references(() => exports.users.id, { onDelete: 'set null' }),
    moderatedBy: (0, pg_core_1.varchar)("moderated_by").references(() => exports.users.id, { onDelete: 'set null' }),
    reportReason: (0, pg_core_1.text)("report_reason"),
    moderationAction: (0, pg_core_1.text)("moderation_action"),
    moderationNotes: (0, pg_core_1.text)("moderation_notes"),
    status: (0, pg_core_1.text)("status").notNull().default('Pending'),
    reportedAt: (0, pg_core_1.timestamp)("reported_at").notNull().defaultNow(),
    moderatedAt: (0, pg_core_1.timestamp)("moderated_at"),
});
exports.insertForumModerationLogSchema = (0, drizzle_zod_1.createInsertSchema)(exports.forumModerationLogs).omit({
    id: true,
    reportedAt: true,
});
// Forum User Votes
exports.forumVotes = (0, pg_core_1.pgTable)("forum_votes", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    postId: (0, pg_core_1.varchar)("post_id").references(() => exports.forumPosts.id, { onDelete: 'cascade' }),
    replyId: (0, pg_core_1.varchar)("reply_id").references(() => exports.forumReplies.id, { onDelete: 'cascade' }),
    voteType: (0, pg_core_1.text)("vote_type").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertForumVoteSchema = (0, drizzle_zod_1.createInsertSchema)(exports.forumVotes).omit({
    id: true,
    createdAt: true,
});
// ============================================
// ANALYTICS & LBI CORRELATION
// ============================================
// Performance Analytics (per child)
exports.performanceAnalytics = (0, pg_core_1.pgTable)("performance_analytics", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    childId: (0, pg_core_1.varchar)("child_id").notNull().references(() => exports.children.id, { onDelete: 'cascade' }),
    subjectId: (0, pg_core_1.varchar)("subject_id").references(() => exports.academicSubjects.id, { onDelete: 'set null' }),
    chapterId: (0, pg_core_1.varchar)("chapter_id").references(() => exports.academicChapters.id, { onDelete: 'set null' }),
    testType: (0, pg_core_1.text)("test_type"),
    totalTests: (0, pg_core_1.integer)("total_tests").notNull().default(0),
    completedTests: (0, pg_core_1.integer)("completed_tests").notNull().default(0),
    averageScore: (0, pg_core_1.real)("average_score"),
    highestScore: (0, pg_core_1.real)("highest_score"),
    lowestScore: (0, pg_core_1.real)("lowest_score"),
    averageTimeSeconds: (0, pg_core_1.integer)("average_time_seconds"),
    improvementTrend: (0, pg_core_1.real)("improvement_trend"),
    lastUpdatedAt: (0, pg_core_1.timestamp)("last_updated_at").notNull().defaultNow(),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertPerformanceAnalyticsSchema = (0, drizzle_zod_1.createInsertSchema)(exports.performanceAnalytics).omit({
    id: true,
    createdAt: true,
});
// LBI-Performance Correlation
exports.lbiPerformanceCorrelation = (0, pg_core_1.pgTable)("lbi_performance_correlation", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    childId: (0, pg_core_1.varchar)("child_id").notNull().references(() => exports.children.id, { onDelete: 'cascade' }),
    lbiCategory: (0, pg_core_1.text)("lbi_category").notNull(),
    lbiMetric: (0, pg_core_1.text)("lbi_metric").notNull(),
    lbiScore: (0, pg_core_1.integer)("lbi_score"),
    subjectId: (0, pg_core_1.varchar)("subject_id").references(() => exports.academicSubjects.id, { onDelete: 'set null' }),
    academicScore: (0, pg_core_1.real)("academic_score"),
    correlationStrength: (0, pg_core_1.real)("correlation_strength"),
    correlationType: (0, pg_core_1.text)("correlation_type"),
    insight: (0, pg_core_1.text)("insight"),
    recommendedActions: (0, pg_core_1.text)("recommended_actions").array(),
    analysisDate: (0, pg_core_1.timestamp)("analysis_date").notNull().defaultNow(),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertLbiPerformanceCorrelationSchema = (0, drizzle_zod_1.createInsertSchema)(exports.lbiPerformanceCorrelation).omit({
    id: true,
    createdAt: true,
});
// ============================================
// AUDIT LOGS (for DPDP compliance)
// ============================================
// Audit Logs for all sensitive operations
exports.auditLogs = (0, pg_core_1.pgTable)("audit_logs", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    userId: (0, pg_core_1.varchar)("user_id").references(() => exports.users.id, { onDelete: 'set null' }),
    entityType: (0, pg_core_1.text)("entity_type").notNull(),
    entityId: (0, pg_core_1.varchar)("entity_id"),
    action: (0, pg_core_1.text)("action").notNull(),
    details: (0, pg_core_1.text)("details"),
    ipAddress: (0, pg_core_1.text)("ip_address"),
    userAgent: (0, pg_core_1.text)("user_agent"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertAuditLogSchema = (0, drizzle_zod_1.createInsertSchema)(exports.auditLogs).omit({
    id: true,
    createdAt: true,
});
// ============================================
// PARENT TESTS (created by parents for children)
// ============================================
exports.parentTests = (0, pg_core_1.pgTable)("parent_tests", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    createdBy: (0, pg_core_1.varchar)("created_by").notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    title: (0, pg_core_1.text)("title").notNull(),
    subject: (0, pg_core_1.text)("subject").notNull(),
    description: (0, pg_core_1.text)("description"),
    duration: (0, pg_core_1.integer)("duration").notNull().default(30),
    totalMarks: (0, pg_core_1.integer)("total_marks").notNull(),
    questions: (0, pg_core_1.text)("questions").notNull(), // JSON string of questions
    status: (0, pg_core_1.text)("status").notNull().default('draft'), // draft, published, assigned
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.insertParentTestSchema = (0, drizzle_zod_1.createInsertSchema)(exports.parentTests).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// Parent Test Assignments
exports.parentTestAssignments = (0, pg_core_1.pgTable)("parent_test_assignments", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    testId: (0, pg_core_1.varchar)("test_id").notNull().references(() => exports.parentTests.id, { onDelete: 'cascade' }),
    childId: (0, pg_core_1.varchar)("child_id").notNull().references(() => exports.children.id, { onDelete: 'cascade' }),
    assignedBy: (0, pg_core_1.varchar)("assigned_by").notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    status: (0, pg_core_1.text)("status").notNull().default('pending'), // pending, in_progress, completed
    dueDate: (0, pg_core_1.timestamp)("due_date"),
    startedAt: (0, pg_core_1.timestamp)("started_at"),
    completedAt: (0, pg_core_1.timestamp)("completed_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertParentTestAssignmentSchema = (0, drizzle_zod_1.createInsertSchema)(exports.parentTestAssignments).omit({
    id: true,
    createdAt: true,
});
// Parent Test Results
exports.parentTestResults = (0, pg_core_1.pgTable)("parent_test_results", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    assignmentId: (0, pg_core_1.varchar)("assignment_id").notNull().references(() => exports.parentTestAssignments.id, { onDelete: 'cascade' }),
    studentId: (0, pg_core_1.varchar)("student_id").notNull(),
    answers: (0, pg_core_1.text)("answers").notNull(), // JSON string
    marksObtained: (0, pg_core_1.integer)("marks_obtained").notNull(),
    totalMarks: (0, pg_core_1.integer)("total_marks").notNull(),
    score: (0, pg_core_1.integer)("score").notNull(), // percentage
    correctAnswers: (0, pg_core_1.integer)("correct_answers").notNull(),
    incorrectAnswers: (0, pg_core_1.integer)("incorrect_answers").notNull(),
    questionResults: (0, pg_core_1.text)("question_results").notNull(), // JSON string with detailed analysis
    completedAt: (0, pg_core_1.timestamp)("completed_at").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertParentTestResultSchema = (0, drizzle_zod_1.createInsertSchema)(exports.parentTestResults).omit({
    id: true,
    createdAt: true,
});
// ============================================
// HR & RECRUITMENT ORCHESTRATION SYSTEM
// ============================================
// Job Postings with approval workflow
exports.jobPostings = (0, pg_core_1.pgTable)("job_postings", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    title: (0, pg_core_1.text)("title").notNull(),
    roleCategory: (0, pg_core_1.text)("role_category").notNull(), // mentor, counselor, trainer, admin
    employmentType: (0, pg_core_1.text)("employment_type").notNull(), // part-time, full-time, contract
    workMode: (0, pg_core_1.text)("work_mode").notNull(), // remote, hybrid, field
    eligibility: (0, pg_core_1.text)("eligibility").notNull(),
    qualifications: (0, pg_core_1.text)("qualifications").notNull(),
    responsibilities: (0, pg_core_1.text)("responsibilities").notNull(),
    kpis: (0, pg_core_1.text)("kpis").notNull(), // performance expectations
    compensationModel: (0, pg_core_1.text)("compensation_model").notNull(),
    legalClauses: (0, pg_core_1.text)("legal_clauses"),
    status: (0, pg_core_1.text)("status").notNull().default('draft'), // draft, hr_review, legal_review, leadership_approval, approved, published, closed
    hrReviewBy: (0, pg_core_1.varchar)("hr_review_by").references(() => exports.users.id),
    hrReviewAt: (0, pg_core_1.timestamp)("hr_review_at"),
    hrReviewNotes: (0, pg_core_1.text)("hr_review_notes"),
    legalReviewBy: (0, pg_core_1.varchar)("legal_review_by").references(() => exports.users.id),
    legalReviewAt: (0, pg_core_1.timestamp)("legal_review_at"),
    legalReviewNotes: (0, pg_core_1.text)("legal_review_notes"),
    leadershipApprovalBy: (0, pg_core_1.varchar)("leadership_approval_by").references(() => exports.users.id),
    leadershipApprovalAt: (0, pg_core_1.timestamp)("leadership_approval_at"),
    leadershipApprovalNotes: (0, pg_core_1.text)("leadership_approval_notes"),
    publishedAt: (0, pg_core_1.timestamp)("published_at"),
    closedAt: (0, pg_core_1.timestamp)("closed_at"),
    hiringQuota: (0, pg_core_1.integer)("hiring_quota").default(0),
    hiredCount: (0, pg_core_1.integer)("hired_count").notNull().default(0),
    createdBy: (0, pg_core_1.varchar)("created_by").notNull().references(() => exports.users.id),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.insertJobPostingSchema = (0, drizzle_zod_1.createInsertSchema)(exports.jobPostings).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// Job Distribution Channels
exports.jobDistributions = (0, pg_core_1.pgTable)("job_distributions", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    jobId: (0, pg_core_1.varchar)("job_id").notNull().references(() => exports.jobPostings.id, { onDelete: 'cascade' }),
    channel: (0, pg_core_1.text)("channel").notNull(), // linkedin, indeed, naukri, internshala, google_jobs, metryx_careers
    externalPostId: (0, pg_core_1.text)("external_post_id"),
    postedAt: (0, pg_core_1.timestamp)("posted_at"),
    unpostedAt: (0, pg_core_1.timestamp)("unpublished_at"),
    reachMetrics: (0, pg_core_1.integer)("reach_metrics").default(0),
    applicationsFromChannel: (0, pg_core_1.integer)("applications_from_channel").default(0),
    status: (0, pg_core_1.text)("status").notNull().default('pending'), // pending, posted, unpublished
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertJobDistributionSchema = (0, drizzle_zod_1.createInsertSchema)(exports.jobDistributions).omit({
    id: true,
    createdAt: true,
});
// Job Applications
exports.jobApplications = (0, pg_core_1.pgTable)("job_applications", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    jobId: (0, pg_core_1.varchar)("job_id").notNull().references(() => exports.jobPostings.id, { onDelete: 'cascade' }),
    applicantUserId: (0, pg_core_1.varchar)("applicant_user_id").notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    fullName: (0, pg_core_1.text)("full_name").notNull(),
    email: (0, pg_core_1.text)("email").notNull(),
    phone: (0, pg_core_1.text)("phone").notNull(),
    resumeUrl: (0, pg_core_1.text)("resume_url"),
    coverLetter: (0, pg_core_1.text)("cover_letter"),
    sourceChannel: (0, pg_core_1.text)("source_channel"), // linkedin, indeed, direct, referral
    status: (0, pg_core_1.text)("status").notNull().default('applied'), // applied, shortlisted, payment_pending, training, assessment, active, warning, suspended, deactivated, rejected
    membershipFee: (0, pg_core_1.real)("membership_fee"),
    membershipPaidAt: (0, pg_core_1.timestamp)("membership_paid_at"),
    consentCaptured: (0, pg_core_1.boolean)("consent_captured").notNull().default(false),
    consentCapturedAt: (0, pg_core_1.timestamp)("consent_captured_at"),
    rejectionReason: (0, pg_core_1.text)("rejection_reason"),
    processedBy: (0, pg_core_1.varchar)("processed_by").references(() => exports.users.id),
    processedAt: (0, pg_core_1.timestamp)("processed_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.insertJobApplicationSchema = (0, drizzle_zod_1.createInsertSchema)(exports.jobApplications).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// Mentors (activated from job applications)
exports.mentors = (0, pg_core_1.pgTable)("mentors", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    applicationId: (0, pg_core_1.varchar)("application_id").references(() => exports.jobApplications.id),
    mentorCode: (0, pg_core_1.text)("mentor_code").notNull().unique(),
    fullName: (0, pg_core_1.text)("full_name").notNull(),
    email: (0, pg_core_1.text)("email").notNull(),
    phone: (0, pg_core_1.text)("phone").notNull(),
    specialization: (0, pg_core_1.text)("specialization"),
    qualifications: (0, pg_core_1.text)("qualifications"),
    status: (0, pg_core_1.text)("status").notNull().default('pending_training'), // pending_training, training, assessment, active, warning, suspended, deactivated
    activatedAt: (0, pg_core_1.timestamp)("activated_at"),
    warningIssuedAt: (0, pg_core_1.timestamp)("warning_issued_at"),
    warningReason: (0, pg_core_1.text)("warning_reason"),
    suspendedAt: (0, pg_core_1.timestamp)("suspended_at"),
    suspensionReason: (0, pg_core_1.text)("suspension_reason"),
    deactivatedAt: (0, pg_core_1.timestamp)("deactivated_at"),
    deactivationReason: (0, pg_core_1.text)("deactivation_reason"),
    performanceHealthIndex: (0, pg_core_1.real)("performance_health_index").default(100),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.insertMentorSchema = (0, drizzle_zod_1.createInsertSchema)(exports.mentors).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// Training Programs
exports.trainingPrograms = (0, pg_core_1.pgTable)("training_programs", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    programName: (0, pg_core_1.text)("program_name").notNull(),
    description: (0, pg_core_1.text)("description"),
    roleCategory: (0, pg_core_1.text)("role_category").notNull(),
    durationDays: (0, pg_core_1.integer)("duration_days").notNull().default(7),
    passingScore: (0, pg_core_1.integer)("passing_score").notNull().default(70),
    modules: (0, pg_core_1.text)("modules"), // JSON array of modules
    isActive: (0, pg_core_1.boolean)("is_active").notNull().default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertTrainingProgramSchema = (0, drizzle_zod_1.createInsertSchema)(exports.trainingPrograms).omit({
    id: true,
    createdAt: true,
});
// Training Enrollments
exports.trainingEnrollments = (0, pg_core_1.pgTable)("training_enrollments", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    mentorId: (0, pg_core_1.varchar)("mentor_id").notNull().references(() => exports.mentors.id, { onDelete: 'cascade' }),
    programId: (0, pg_core_1.varchar)("program_id").notNull().references(() => exports.trainingPrograms.id, { onDelete: 'cascade' }),
    status: (0, pg_core_1.text)("status").notNull().default('enrolled'), // enrolled, in_progress, completed, failed, retraining
    attendancePercent: (0, pg_core_1.real)("attendance_percent").default(0),
    assessmentScore: (0, pg_core_1.real)("assessment_score"),
    startedAt: (0, pg_core_1.timestamp)("started_at"),
    completedAt: (0, pg_core_1.timestamp)("completed_at"),
    failureReason: (0, pg_core_1.text)("failure_reason"),
    retrainingCount: (0, pg_core_1.integer)("retraining_count").notNull().default(0),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertTrainingEnrollmentSchema = (0, drizzle_zod_1.createInsertSchema)(exports.trainingEnrollments).omit({
    id: true,
    createdAt: true,
});
// Mentor KPIs (Performance Tracking)
exports.mentorKpis = (0, pg_core_1.pgTable)("mentor_kpis", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    mentorId: (0, pg_core_1.varchar)("mentor_id").notNull().references(() => exports.mentors.id, { onDelete: 'cascade' }),
    periodStart: (0, pg_core_1.date)("period_start").notNull(),
    periodEnd: (0, pg_core_1.date)("period_end").notNull(),
    studentSatisfaction: (0, pg_core_1.real)("student_satisfaction").default(0), // 0-100
    sessionCompletionRate: (0, pg_core_1.real)("session_completion_rate").default(0), // 0-100
    outcomeImprovement: (0, pg_core_1.real)("outcome_improvement").default(0), // 0-100
    complianceAdherence: (0, pg_core_1.real)("compliance_adherence").default(0), // 0-100
    revenueContribution: (0, pg_core_1.real)("revenue_contribution").default(0),
    sessionsCompleted: (0, pg_core_1.integer)("sessions_completed").default(0),
    studentsAssigned: (0, pg_core_1.integer)("students_assigned").default(0),
    alertLevel: (0, pg_core_1.text)("alert_level").default('none'), // none, level_1, level_2, level_3
    alertIssuedAt: (0, pg_core_1.timestamp)("alert_issued_at"),
    alertNotes: (0, pg_core_1.text)("alert_notes"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertMentorKpiSchema = (0, drizzle_zod_1.createInsertSchema)(exports.mentorKpis).omit({
    id: true,
    createdAt: true,
});
// HR Consent Logs (Legal & Compliance)
exports.hrConsentLogs = (0, pg_core_1.pgTable)("hr_consent_logs", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    mentorId: (0, pg_core_1.varchar)("mentor_id").references(() => exports.mentors.id, { onDelete: 'cascade' }),
    consentType: (0, pg_core_1.text)("consent_type").notNull(), // registration, training, monitoring, confidentiality, termination
    consentText: (0, pg_core_1.text)("consent_text").notNull(),
    consentGiven: (0, pg_core_1.boolean)("consent_given").notNull().default(false),
    ipAddress: (0, pg_core_1.text)("ip_address"),
    userAgent: (0, pg_core_1.text)("user_agent"),
    consentedAt: (0, pg_core_1.timestamp)("consented_at"),
    revokedAt: (0, pg_core_1.timestamp)("revoked_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertHrConsentLogSchema = (0, drizzle_zod_1.createInsertSchema)(exports.hrConsentLogs).omit({
    id: true,
    createdAt: true,
});
// Compliance Violations
exports.complianceViolations = (0, pg_core_1.pgTable)("compliance_violations", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    mentorId: (0, pg_core_1.varchar)("mentor_id").notNull().references(() => exports.mentors.id, { onDelete: 'cascade' }),
    violationType: (0, pg_core_1.text)("violation_type").notNull(), // ethical, policy, performance, conduct
    severity: (0, pg_core_1.text)("severity").notNull(), // minor, moderate, major, critical
    description: (0, pg_core_1.text)("description").notNull(),
    evidenceUrl: (0, pg_core_1.text)("evidence_url"),
    reportedBy: (0, pg_core_1.varchar)("reported_by").references(() => exports.users.id),
    status: (0, pg_core_1.text)("status").notNull().default('reported'), // reported, investigating, resolved, escalated
    resolution: (0, pg_core_1.text)("resolution"),
    resolvedBy: (0, pg_core_1.varchar)("resolved_by").references(() => exports.users.id),
    resolvedAt: (0, pg_core_1.timestamp)("resolved_at"),
    actionTaken: (0, pg_core_1.text)("action_taken"), // warning, retraining, suspension, termination
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertComplianceViolationSchema = (0, drizzle_zod_1.createInsertSchema)(exports.complianceViolations).omit({
    id: true,
    createdAt: true,
});
// Revenue & Payouts
exports.mentorPayouts = (0, pg_core_1.pgTable)("mentor_payouts", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    mentorId: (0, pg_core_1.varchar)("mentor_id").notNull().references(() => exports.mentors.id, { onDelete: 'cascade' }),
    periodStart: (0, pg_core_1.date)("period_start").notNull(),
    periodEnd: (0, pg_core_1.date)("period_end").notNull(),
    grossRevenue: (0, pg_core_1.real)("gross_revenue").notNull().default(0),
    commissionRate: (0, pg_core_1.real)("commission_rate").notNull().default(0),
    commissionAmount: (0, pg_core_1.real)("commission_amount").notNull().default(0),
    deductions: (0, pg_core_1.real)("deductions").default(0),
    netPayout: (0, pg_core_1.real)("net_payout").notNull().default(0),
    status: (0, pg_core_1.text)("status").notNull().default('pending'), // pending, approved, blocked, paid
    blockedReason: (0, pg_core_1.text)("blocked_reason"),
    approvedBy: (0, pg_core_1.varchar)("approved_by").references(() => exports.users.id),
    approvedAt: (0, pg_core_1.timestamp)("approved_at"),
    paidAt: (0, pg_core_1.timestamp)("paid_at"),
    transactionRef: (0, pg_core_1.text)("transaction_ref"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertMentorPayoutSchema = (0, drizzle_zod_1.createInsertSchema)(exports.mentorPayouts).omit({
    id: true,
    createdAt: true,
});
// Institutional SLA Configurations
exports.institutionalSlas = (0, pg_core_1.pgTable)("institutional_slas", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    instituteId: (0, pg_core_1.varchar)("institute_id").notNull().references(() => exports.institutes.id, { onDelete: 'cascade' }),
    tier: (0, pg_core_1.text)("tier").notNull().default('silver'), // silver, gold, platinum
    responseTimeHours: (0, pg_core_1.integer)("response_time_hours").notNull().default(24),
    completionTargetPercent: (0, pg_core_1.real)("completion_target_percent").notNull().default(90),
    satisfactionTargetPercent: (0, pg_core_1.real)("satisfaction_target_percent").notNull().default(85),
    reportingFrequency: (0, pg_core_1.text)("reporting_frequency").notNull().default('weekly'), // daily, weekly, monthly
    dedicatedSupport: (0, pg_core_1.boolean)("dedicated_support").notNull().default(false),
    priorityEscalation: (0, pg_core_1.boolean)("priority_escalation").notNull().default(false),
    customBranding: (0, pg_core_1.boolean)("custom_branding").notNull().default(false),
    effectiveFrom: (0, pg_core_1.date)("effective_from").notNull(),
    effectiveUntil: (0, pg_core_1.date)("effective_until"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertInstitutionalSlaSchema = (0, drizzle_zod_1.createInsertSchema)(exports.institutionalSlas).omit({
    id: true,
    createdAt: true,
});
// White-Label Partners
exports.whiteLabelPartners = (0, pg_core_1.pgTable)("white_label_partners", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    partnerCode: (0, pg_core_1.text)("partner_code").notNull().unique(),
    companyName: (0, pg_core_1.text)("company_name").notNull(),
    contactName: (0, pg_core_1.text)("contact_name").notNull(),
    contactEmail: (0, pg_core_1.text)("contact_email").notNull(),
    contactPhone: (0, pg_core_1.text)("contact_phone"),
    brandLogoUrl: (0, pg_core_1.text)("brand_logo_url"),
    brandPrimaryColor: (0, pg_core_1.text)("brand_primary_color"),
    brandAccentColor: (0, pg_core_1.text)("brand_accent_color"),
    customDomain: (0, pg_core_1.text)("custom_domain"),
    revenueSharePercent: (0, pg_core_1.real)("revenue_share_percent").notNull().default(20),
    mentorPoolSize: (0, pg_core_1.integer)("mentor_pool_size").default(0),
    status: (0, pg_core_1.text)("status").notNull().default('pilot'), // pilot, active, suspended, terminated
    pilotStartDate: (0, pg_core_1.date)("pilot_start_date"),
    rolloutDate: (0, pg_core_1.date)("rollout_date"),
    terminatedAt: (0, pg_core_1.timestamp)("terminated_at"),
    terminationReason: (0, pg_core_1.text)("termination_reason"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.insertWhiteLabelPartnerSchema = (0, drizzle_zod_1.createInsertSchema)(exports.whiteLabelPartners).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// HR Audit Logs (System Governance)
exports.hrAuditLogs = (0, pg_core_1.pgTable)("hr_audit_logs", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    actorUserId: (0, pg_core_1.varchar)("actor_user_id").references(() => exports.users.id),
    actionType: (0, pg_core_1.text)("action_type").notNull(), // job_created, job_approved, application_processed, mentor_activated, etc.
    targetType: (0, pg_core_1.text)("target_type").notNull(), // job, application, mentor, payout, violation
    targetId: (0, pg_core_1.varchar)("target_id").notNull(),
    previousState: (0, pg_core_1.text)("previous_state"), // JSON
    newState: (0, pg_core_1.text)("new_state"), // JSON
    ipAddress: (0, pg_core_1.text)("ip_address"),
    userAgent: (0, pg_core_1.text)("user_agent"),
    notes: (0, pg_core_1.text)("notes"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertHrAuditLogSchema = (0, drizzle_zod_1.createInsertSchema)(exports.hrAuditLogs).omit({
    id: true,
    createdAt: true,
});
// Job Approval Workflow Log
exports.jobApprovalLogs = (0, pg_core_1.pgTable)("job_approval_logs", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    jobId: (0, pg_core_1.varchar)("job_id").notNull().references(() => exports.jobPostings.id, { onDelete: 'cascade' }),
    fromStatus: (0, pg_core_1.text)("from_status").notNull(),
    toStatus: (0, pg_core_1.text)("to_status").notNull(),
    action: (0, pg_core_1.text)("action").notNull(), // submit, approve, reject, request_changes
    comments: (0, pg_core_1.text)("comments"),
    actorId: (0, pg_core_1.varchar)("actor_id").references(() => exports.users.id),
    actorRole: (0, pg_core_1.text)("actor_role"), // hr, legal, leadership, admin
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertJobApprovalLogSchema = (0, drizzle_zod_1.createInsertSchema)(exports.jobApprovalLogs).omit({
    id: true,
    createdAt: true,
});
// Mentor Profiles (Activated after training completion)
exports.mentorProfiles = (0, pg_core_1.pgTable)("mentor_profiles", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    mentorId: (0, pg_core_1.varchar)("mentor_id").references(() => exports.mentors.id),
    userId: (0, pg_core_1.varchar)("user_id").references(() => exports.users.id),
    applicationId: (0, pg_core_1.varchar)("application_id").references(() => exports.jobApplications.id),
    mentorCode: (0, pg_core_1.text)("mentor_code").notNull().unique(),
    fullName: (0, pg_core_1.text)("full_name").notNull(),
    email: (0, pg_core_1.text)("email").notNull(),
    phone: (0, pg_core_1.text)("phone"),
    profilePhoto: (0, pg_core_1.text)("profile_photo"),
    bio: (0, pg_core_1.text)("bio"),
    specializations: (0, pg_core_1.text)("specializations").array(), // online_coaching, tuition, counselling
    qualifications: (0, pg_core_1.text)("qualifications").array(),
    languages: (0, pg_core_1.text)("languages").array(),
    availability: (0, pg_core_1.text)("availability"),
    preferredAgeGroups: (0, pg_core_1.text)("preferred_age_groups").array(),
    status: (0, pg_core_1.text)("status").notNull().default('pending_activation'), // pending_activation, active, suspended, deactivated
    activatedAt: (0, pg_core_1.timestamp)("activated_at"),
    activatedBy: (0, pg_core_1.varchar)("activated_by").references(() => exports.users.id),
    suspendedAt: (0, pg_core_1.timestamp)("suspended_at"),
    suspendedReason: (0, pg_core_1.text)("suspended_reason"),
    deactivatedAt: (0, pg_core_1.timestamp)("deactivated_at"),
    deactivationReason: (0, pg_core_1.text)("deactivation_reason"),
    rating: (0, pg_core_1.real)("rating"),
    totalSessions: (0, pg_core_1.integer)("total_sessions").notNull().default(0),
    completedSessions: (0, pg_core_1.integer)("completed_sessions").notNull().default(0),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.insertMentorProfileSchema = (0, drizzle_zod_1.createInsertSchema)(exports.mentorProfiles).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// Mentor Task Assignments
exports.mentorTasks = (0, pg_core_1.pgTable)("mentor_tasks", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    mentorId: (0, pg_core_1.varchar)("mentor_id").notNull().references(() => exports.mentors.id, { onDelete: 'cascade' }),
    taskType: (0, pg_core_1.text)("task_type").notNull(), // online_coaching, tuition, counselling, workshop, awareness_session
    title: (0, pg_core_1.text)("title").notNull(),
    description: (0, pg_core_1.text)("description"),
    targetAudience: (0, pg_core_1.text)("target_audience"),
    scheduledDate: (0, pg_core_1.timestamp)("scheduled_date"),
    duration: (0, pg_core_1.integer)("duration"), // in minutes
    location: (0, pg_core_1.text)("location"),
    isOnline: (0, pg_core_1.boolean)("is_online").notNull().default(true),
    meetingLink: (0, pg_core_1.text)("meeting_link"),
    status: (0, pg_core_1.text)("status").notNull().default('assigned'), // assigned, accepted, in_progress, completed, cancelled
    completedAt: (0, pg_core_1.timestamp)("completed_at"),
    feedback: (0, pg_core_1.text)("feedback"),
    rating: (0, pg_core_1.integer)("rating"),
    notes: (0, pg_core_1.text)("notes"),
    createdBy: (0, pg_core_1.varchar)("created_by").references(() => exports.users.id),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.insertMentorTaskSchema = (0, drizzle_zod_1.createInsertSchema)(exports.mentorTasks).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// ============================================
// SUPER ADMIN / PLATFORM MANAGEMENT TABLES
// ============================================
// Onboarding Approvals (for Institutes, Parents, Mentors)
exports.onboardingApprovals = (0, pg_core_1.pgTable)("onboarding_approvals", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    entityType: (0, pg_core_1.text)("entity_type").notNull(), // institute, parent, mentor
    entityId: (0, pg_core_1.varchar)("entity_id").notNull(),
    entityName: (0, pg_core_1.text)("entity_name").notNull(),
    entityEmail: (0, pg_core_1.text)("entity_email"),
    entityPhone: (0, pg_core_1.text)("entity_phone"),
    status: (0, pg_core_1.text)("status").notNull().default('pending'), // pending, approved, rejected, suspended
    submittedAt: (0, pg_core_1.timestamp)("submitted_at").notNull().defaultNow(),
    reviewedBy: (0, pg_core_1.varchar)("reviewed_by").references(() => exports.users.id),
    reviewedAt: (0, pg_core_1.timestamp)("reviewed_at"),
    reviewNotes: (0, pg_core_1.text)("review_notes"),
    rejectionReason: (0, pg_core_1.text)("rejection_reason"),
    documentsVerified: (0, pg_core_1.boolean)("documents_verified").default(false),
    kycVerified: (0, pg_core_1.boolean)("kyc_verified").default(false),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.insertOnboardingApprovalSchema = (0, drizzle_zod_1.createInsertSchema)(exports.onboardingApprovals).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// KYC Documents with Maker-Checker Workflow
exports.kycDocuments = (0, pg_core_1.pgTable)("kyc_documents", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    entityType: (0, pg_core_1.text)("entity_type").notNull(), // institute, parent, mentor, student
    entityId: (0, pg_core_1.varchar)("entity_id").notNull(),
    entityName: (0, pg_core_1.text)("entity_name").notNull(),
    documentType: (0, pg_core_1.text)("document_type").notNull(), // aadhaar, pan, gst, incorporation_cert, address_proof, photo_id
    documentNumber: (0, pg_core_1.text)("document_number"),
    documentUrl: (0, pg_core_1.text)("document_url"),
    fileName: (0, pg_core_1.text)("file_name"),
    fileSize: (0, pg_core_1.integer)("file_size"),
    mimeType: (0, pg_core_1.text)("mime_type"),
    // Maker-Checker workflow
    status: (0, pg_core_1.text)("status").notNull().default('pending'), // pending, maker_verified, checker_verified, approved, rejected
    makerId: (0, pg_core_1.varchar)("maker_id").references(() => exports.users.id),
    makerVerifiedAt: (0, pg_core_1.timestamp)("maker_verified_at"),
    makerNotes: (0, pg_core_1.text)("maker_notes"),
    checkerId: (0, pg_core_1.varchar)("checker_id").references(() => exports.users.id),
    checkerVerifiedAt: (0, pg_core_1.timestamp)("checker_verified_at"),
    checkerNotes: (0, pg_core_1.text)("checker_notes"),
    rejectionReason: (0, pg_core_1.text)("rejection_reason"),
    expiryDate: (0, pg_core_1.timestamp)("expiry_date"),
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.insertKycDocumentSchema = (0, drizzle_zod_1.createInsertSchema)(exports.kycDocuments).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// Approved Students with Payment Status (for institute drilldown)
exports.studentEnrollments = (0, pg_core_1.pgTable)("student_enrollments", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    instituteId: (0, pg_core_1.varchar)("institute_id").notNull(),
    instituteName: (0, pg_core_1.text)("institute_name").notNull(),
    studentId: (0, pg_core_1.varchar)("student_id").notNull(),
    studentName: (0, pg_core_1.text)("student_name").notNull(),
    parentId: (0, pg_core_1.varchar)("parent_id"),
    parentName: (0, pg_core_1.text)("parent_name"),
    className: (0, pg_core_1.text)("class_name"),
    section: (0, pg_core_1.text)("section"),
    rollNumber: (0, pg_core_1.text)("roll_number"),
    admissionDate: (0, pg_core_1.timestamp)("admission_date"),
    status: (0, pg_core_1.text)("status").notNull().default('pending'), // pending, approved, payment_pending, active, inactive, suspended
    paymentStatus: (0, pg_core_1.text)("payment_status").default('pending'), // pending, partial, completed, overdue, waived
    feeAmount: (0, pg_core_1.real)("fee_amount"),
    paidAmount: (0, pg_core_1.real)("paid_amount").default(0),
    dueDate: (0, pg_core_1.timestamp)("due_date"),
    approvedBy: (0, pg_core_1.varchar)("approved_by").references(() => exports.users.id),
    approvedAt: (0, pg_core_1.timestamp)("approved_at"),
    approvalNotes: (0, pg_core_1.text)("approval_notes"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.insertStudentEnrollmentSchema = (0, drizzle_zod_1.createInsertSchema)(exports.studentEnrollments).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// Platform Transactions
exports.platformTransactions = (0, pg_core_1.pgTable)("platform_transactions", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    transactionType: (0, pg_core_1.text)("transaction_type").notNull(), // subscription, payout, refund, commission, penalty
    entityType: (0, pg_core_1.text)("entity_type").notNull(), // institute, parent, mentor, partner
    entityId: (0, pg_core_1.varchar)("entity_id").notNull(),
    entityName: (0, pg_core_1.text)("entity_name"),
    amount: (0, pg_core_1.real)("amount").notNull(),
    currency: (0, pg_core_1.text)("currency").notNull().default('INR'),
    status: (0, pg_core_1.text)("status").notNull().default('pending'), // pending, processing, completed, failed, cancelled, refunded
    paymentMethod: (0, pg_core_1.text)("payment_method"), // upi, netbanking, card, wallet
    paymentGateway: (0, pg_core_1.text)("payment_gateway"), // razorpay, paytm, stripe
    gatewayTransactionId: (0, pg_core_1.text)("gateway_transaction_id"),
    gatewayOrderId: (0, pg_core_1.text)("gateway_order_id"),
    description: (0, pg_core_1.text)("description"),
    invoiceNumber: (0, pg_core_1.text)("invoice_number"),
    invoiceUrl: (0, pg_core_1.text)("invoice_url"),
    processedBy: (0, pg_core_1.varchar)("processed_by").references(() => exports.users.id),
    processedAt: (0, pg_core_1.timestamp)("processed_at"),
    failureReason: (0, pg_core_1.text)("failure_reason"),
    refundedAmount: (0, pg_core_1.real)("refunded_amount"),
    refundedAt: (0, pg_core_1.timestamp)("refunded_at"),
    metadata: (0, pg_core_1.text)("metadata"), // JSON for additional info
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.insertPlatformTransactionSchema = (0, drizzle_zod_1.createInsertSchema)(exports.platformTransactions).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// Platform Admin Audit Logs
exports.adminAuditLogs = (0, pg_core_1.pgTable)("admin_audit_logs", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    adminUserId: (0, pg_core_1.varchar)("admin_user_id").references(() => exports.users.id),
    actionType: (0, pg_core_1.text)("action_type").notNull(), // approve_institute, reject_parent, process_payout, etc.
    targetType: (0, pg_core_1.text)("target_type").notNull(), // institute, parent, mentor, transaction, job
    targetId: (0, pg_core_1.varchar)("target_id").notNull(),
    previousState: (0, pg_core_1.text)("previous_state"), // JSON
    newState: (0, pg_core_1.text)("new_state"), // JSON
    ipAddress: (0, pg_core_1.text)("ip_address"),
    notes: (0, pg_core_1.text)("notes"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertAdminAuditLogSchema = (0, drizzle_zod_1.createInsertSchema)(exports.adminAuditLogs).omit({
    id: true,
    createdAt: true,
});
// Platform Settings
exports.platformSettings = (0, pg_core_1.pgTable)("platform_settings", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    settingKey: (0, pg_core_1.text)("setting_key").notNull().unique(),
    settingValue: (0, pg_core_1.text)("setting_value").notNull(),
    settingType: (0, pg_core_1.text)("setting_type").notNull().default('string'), // string, number, boolean, json
    category: (0, pg_core_1.text)("category").notNull().default('general'), // general, payment, notifications, security
    description: (0, pg_core_1.text)("description"),
    updatedBy: (0, pg_core_1.varchar)("updated_by").references(() => exports.users.id),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.insertPlatformSettingSchema = (0, drizzle_zod_1.createInsertSchema)(exports.platformSettings).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// ============================================
// SUPER ADMIN - ENTITY CODES
// ============================================
// Entity Codes (unique codes for mentors, institutes, NGOs, parents, LEI)
exports.entityCodes = (0, pg_core_1.pgTable)("entity_codes", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    entityType: (0, pg_core_1.text)("entity_type").notNull(), // mentor, institute, ngo, parent, lei
    entityId: (0, pg_core_1.varchar)("entity_id").notNull(),
    code: (0, pg_core_1.text)("code").notNull().unique(),
    codeType: (0, pg_core_1.text)("code_type").notNull().default('standard'), // standard, premium, promotional
    status: (0, pg_core_1.text)("status").notNull().default('active'), // active, revoked, expired
    generatedBy: (0, pg_core_1.varchar)("generated_by").references(() => exports.users.id),
    validFrom: (0, pg_core_1.timestamp)("valid_from").notNull().defaultNow(),
    validUntil: (0, pg_core_1.timestamp)("valid_until"),
    revokedAt: (0, pg_core_1.timestamp)("revoked_at"),
    revokedReason: (0, pg_core_1.text)("revoked_reason"),
    usageCount: (0, pg_core_1.integer)("usage_count").notNull().default(0),
    maxUsage: (0, pg_core_1.integer)("max_usage"),
    metadata: (0, pg_core_1.text)("metadata"), // JSON for additional info
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertEntityCodeSchema = (0, drizzle_zod_1.createInsertSchema)(exports.entityCodes).omit({
    id: true,
    createdAt: true,
});
// ============================================
// SUPER ADMIN - CONSENT MANAGEMENT (DPDP)
// ============================================
// Unified Consent Records (DPDP Act Compliance)
exports.consentRecords = (0, pg_core_1.pgTable)("consent_records", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    entityType: (0, pg_core_1.text)("entity_type").notNull(), // parent, student, mentor, institute
    entityId: (0, pg_core_1.varchar)("entity_id").notNull(),
    entityName: (0, pg_core_1.text)("entity_name"),
    consentType: (0, pg_core_1.text)("consent_type").notNull(), // data_processing, behavioral_assessment, marketing, third_party_sharing
    consentVersion: (0, pg_core_1.text)("consent_version").notNull().default('1.0'),
    status: (0, pg_core_1.text)("status").notNull().default('pending'), // pending, granted, revoked, expired
    grantedAt: (0, pg_core_1.timestamp)("granted_at"),
    revokedAt: (0, pg_core_1.timestamp)("revoked_at"),
    expiresAt: (0, pg_core_1.timestamp)("expires_at"),
    ipAddress: (0, pg_core_1.text)("ip_address"),
    userAgent: (0, pg_core_1.text)("user_agent"),
    consentText: (0, pg_core_1.text)("consent_text"), // The actual consent text shown
    dataCategories: (0, pg_core_1.text)("data_categories").array(), // What data types are covered
    processingPurposes: (0, pg_core_1.text)("processing_purposes").array(), // Why data is being processed
    lawfulBasis: (0, pg_core_1.text)("lawful_basis"), // DPDP act basis
    retentionPeriod: (0, pg_core_1.text)("retention_period"), // How long data will be kept
    notes: (0, pg_core_1.text)("notes"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.insertConsentRecordSchema = (0, drizzle_zod_1.createInsertSchema)(exports.consentRecords).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// ============================================
// SUPER ADMIN - ACCESS CONTROL
// ============================================
// Role Definitions
exports.roleDefinitions = (0, pg_core_1.pgTable)("role_definitions", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    roleName: (0, pg_core_1.text)("role_name").notNull().unique(),
    displayName: (0, pg_core_1.text)("display_name").notNull(),
    description: (0, pg_core_1.text)("description"),
    level: (0, pg_core_1.integer)("level").notNull().default(0), // Hierarchy level (higher = more permissions)
    isSystem: (0, pg_core_1.boolean)("is_system").notNull().default(false), // Cannot be deleted if true
    isActive: (0, pg_core_1.boolean)("is_active").notNull().default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.insertRoleDefinitionSchema = (0, drizzle_zod_1.createInsertSchema)(exports.roleDefinitions).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// Permission Definitions
exports.permissionDefinitions = (0, pg_core_1.pgTable)("permission_definitions", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    permissionKey: (0, pg_core_1.text)("permission_key").notNull().unique(),
    displayName: (0, pg_core_1.text)("display_name").notNull(),
    description: (0, pg_core_1.text)("description"),
    category: (0, pg_core_1.text)("category").notNull().default('general'), // general, admin, hr, finance, content
    resource: (0, pg_core_1.text)("resource").notNull(), // users, jobs, payouts, consents, etc.
    action: (0, pg_core_1.text)("action").notNull(), // read, write, delete, approve, manage
    isActive: (0, pg_core_1.boolean)("is_active").notNull().default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertPermissionDefinitionSchema = (0, drizzle_zod_1.createInsertSchema)(exports.permissionDefinitions).omit({
    id: true,
    createdAt: true,
});
// Role-Permission Mapping
exports.rolePermissions = (0, pg_core_1.pgTable)("role_permissions", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    roleId: (0, pg_core_1.varchar)("role_id").notNull().references(() => exports.roleDefinitions.id, { onDelete: 'cascade' }),
    permissionId: (0, pg_core_1.varchar)("permission_id").notNull().references(() => exports.permissionDefinitions.id, { onDelete: 'cascade' }),
    grantedBy: (0, pg_core_1.varchar)("granted_by").references(() => exports.users.id),
    grantedAt: (0, pg_core_1.timestamp)("granted_at").notNull().defaultNow(),
});
exports.insertRolePermissionSchema = (0, drizzle_zod_1.createInsertSchema)(exports.rolePermissions).omit({
    id: true,
    grantedAt: true,
});
// ============================================
// SUPER ADMIN - FINANCIAL RECONCILIATION
// ============================================
// Payment Reconciliation Records
exports.paymentReconciliations = (0, pg_core_1.pgTable)("payment_reconciliations", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    reconciliationPeriod: (0, pg_core_1.text)("reconciliation_period").notNull(), // e.g., "2026-01"
    status: (0, pg_core_1.text)("status").notNull().default('pending'), // pending, in_progress, completed, discrepancy
    totalPaymentsReceived: (0, pg_core_1.real)("total_payments_received").notNull().default(0),
    totalPaymentsDone: (0, pg_core_1.real)("total_payments_done").notNull().default(0),
    netBalance: (0, pg_core_1.real)("net_balance").notNull().default(0),
    transactionCount: (0, pg_core_1.integer)("transaction_count").notNull().default(0),
    payoutCount: (0, pg_core_1.integer)("payout_count").notNull().default(0),
    discrepancyAmount: (0, pg_core_1.real)("discrepancy_amount"),
    discrepancyNotes: (0, pg_core_1.text)("discrepancy_notes"),
    reconciledBy: (0, pg_core_1.varchar)("reconciled_by").references(() => exports.users.id),
    reconciledAt: (0, pg_core_1.timestamp)("reconciled_at"),
    approvedBy: (0, pg_core_1.varchar)("approved_by").references(() => exports.users.id),
    approvedAt: (0, pg_core_1.timestamp)("approved_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.insertPaymentReconciliationSchema = (0, drizzle_zod_1.createInsertSchema)(exports.paymentReconciliations).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// ============================================
// SUPER ADMIN - LEARNING PLAN OVERSIGHT
// ============================================
// Learning Plan Templates (Admin-managed)
exports.learningPlanTemplates = (0, pg_core_1.pgTable)("learning_plan_templates", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    templateName: (0, pg_core_1.text)("template_name").notNull(),
    description: (0, pg_core_1.text)("description"),
    targetGrade: (0, pg_core_1.text)("target_grade"), // Class/Grade level
    targetBoard: (0, pg_core_1.text)("target_board"), // CBSE, ICSE, State boards
    subjectFocus: (0, pg_core_1.text)("subject_focus").array(), // Main subjects covered
    durationWeeks: (0, pg_core_1.integer)("duration_weeks").notNull().default(12),
    difficulty: (0, pg_core_1.text)("difficulty").notNull().default('moderate'), // easy, moderate, challenging
    weeklyHours: (0, pg_core_1.integer)("weekly_hours").notNull().default(10),
    status: (0, pg_core_1.text)("status").notNull().default('draft'), // draft, published, archived
    milestones: (0, pg_core_1.text)("milestones"), // JSON array of milestones
    createdBy: (0, pg_core_1.varchar)("created_by").references(() => exports.users.id),
    approvedBy: (0, pg_core_1.varchar)("approved_by").references(() => exports.users.id),
    approvedAt: (0, pg_core_1.timestamp)("approved_at"),
    publishedAt: (0, pg_core_1.timestamp)("published_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.insertLearningPlanTemplateSchema = (0, drizzle_zod_1.createInsertSchema)(exports.learningPlanTemplates).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// NGO Registrations
exports.ngoRegistrations = (0, pg_core_1.pgTable)("ngo_registrations", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    userId: (0, pg_core_1.varchar)("user_id").references(() => exports.users.id),
    ngoCode: (0, pg_core_1.text)("ngo_code").notNull().unique(),
    legalName: (0, pg_core_1.text)("legal_name").notNull(),
    displayName: (0, pg_core_1.text)("display_name").notNull(),
    registrationNumber: (0, pg_core_1.text)("registration_number"),
    taxExemptionNumber: (0, pg_core_1.text)("tax_exemption_number"),
    contactName: (0, pg_core_1.text)("contact_name").notNull(),
    contactEmail: (0, pg_core_1.text)("contact_email").notNull(),
    contactPhone: (0, pg_core_1.text)("contact_phone"),
    address: (0, pg_core_1.text)("address"),
    city: (0, pg_core_1.text)("city"),
    state: (0, pg_core_1.text)("state"),
    pincode: (0, pg_core_1.text)("pincode"),
    focusAreas: (0, pg_core_1.text)("focus_areas").array(), // education, health, environment, etc.
    beneficiaryCount: (0, pg_core_1.integer)("beneficiary_count").default(0),
    status: (0, pg_core_1.text)("status").notNull().default('pending'), // pending, active, suspended, terminated
    documentsVerified: (0, pg_core_1.boolean)("documents_verified").default(false),
    kycVerified: (0, pg_core_1.boolean)("kyc_verified").default(false),
    verifiedBy: (0, pg_core_1.varchar)("verified_by").references(() => exports.users.id),
    verifiedAt: (0, pg_core_1.timestamp)("verified_at"),
    onboardedAt: (0, pg_core_1.timestamp)("onboarded_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.insertNgoRegistrationSchema = (0, drizzle_zod_1.createInsertSchema)(exports.ngoRegistrations).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// LEI (Legal Entity Identifier) Registrations
exports.leiRegistrations = (0, pg_core_1.pgTable)("lei_registrations", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    userId: (0, pg_core_1.varchar)("user_id").references(() => exports.users.id),
    leiCode: (0, pg_core_1.text)("lei_code").notNull().unique(), // 20-character LEI code
    entityName: (0, pg_core_1.text)("entity_name").notNull(),
    entityType: (0, pg_core_1.text)("entity_type").notNull(), // corporate, government, nonprofit
    registrationAuthority: (0, pg_core_1.text)("registration_authority"),
    registrationNumber: (0, pg_core_1.text)("registration_number"),
    jurisdiction: (0, pg_core_1.text)("jurisdiction"),
    legalAddress: (0, pg_core_1.text)("legal_address"),
    headquartersAddress: (0, pg_core_1.text)("headquarters_address"),
    contactName: (0, pg_core_1.text)("contact_name"),
    contactEmail: (0, pg_core_1.text)("contact_email"),
    contactPhone: (0, pg_core_1.text)("contact_phone"),
    status: (0, pg_core_1.text)("status").notNull().default('pending'), // pending, active, lapsed, retired
    validFrom: (0, pg_core_1.date)("valid_from"),
    validUntil: (0, pg_core_1.date)("valid_until"),
    lastVerified: (0, pg_core_1.timestamp)("last_verified"),
    verifiedBy: (0, pg_core_1.varchar)("verified_by").references(() => exports.users.id),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.insertLeiRegistrationSchema = (0, drizzle_zod_1.createInsertSchema)(exports.leiRegistrations).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// User Sessions (for security monitoring)
exports.userSessions = (0, pg_core_1.pgTable)("user_sessions", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    sessionToken: (0, pg_core_1.text)("session_token").notNull(),
    ipAddress: (0, pg_core_1.text)("ip_address"),
    userAgent: (0, pg_core_1.text)("user_agent"),
    deviceType: (0, pg_core_1.text)("device_type"), // desktop, mobile, tablet
    browser: (0, pg_core_1.text)("browser"),
    os: (0, pg_core_1.text)("os"),
    location: (0, pg_core_1.text)("location"),
    isActive: (0, pg_core_1.boolean)("is_active").notNull().default(true),
    lastActivity: (0, pg_core_1.timestamp)("last_activity").notNull().defaultNow(),
    expiresAt: (0, pg_core_1.timestamp)("expires_at"),
    terminatedAt: (0, pg_core_1.timestamp)("terminated_at"),
    terminationReason: (0, pg_core_1.text)("termination_reason"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertUserSessionSchema = (0, drizzle_zod_1.createInsertSchema)(exports.userSessions).omit({
    id: true,
    createdAt: true,
});
// ============================================
// ENTERPRISE DOCUMENT MANAGEMENT SYSTEM
// ============================================
// Document Folders (Hierarchical structure for entity types)
exports.documentFolders = (0, pg_core_1.pgTable)("document_folders", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    entityType: (0, pg_core_1.text)("entity_type").notNull(), // institution, parent, student, ngo, mentor
    entityId: (0, pg_core_1.varchar)("entity_id").notNull(),
    entityName: (0, pg_core_1.text)("entity_name"),
    folderPath: (0, pg_core_1.text)("folder_path").notNull(), // e.g., /institutions/INS001/kyc/
    folderName: (0, pg_core_1.text)("folder_name").notNull(),
    parentFolderId: (0, pg_core_1.varchar)("parent_folder_id"),
    accessLevel: (0, pg_core_1.text)("access_level").notNull().default('private'), // private, restricted, public
    retentionPolicy: (0, pg_core_1.text)("retention_policy").default('7_years'), // SOC2/ISO compliant retention
    encryptionStatus: (0, pg_core_1.text)("encryption_status").notNull().default('encrypted'), // encrypted, unencrypted
    createdBy: (0, pg_core_1.varchar)("created_by").references(() => exports.users.id),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.insertDocumentFolderSchema = (0, drizzle_zod_1.createInsertSchema)(exports.documentFolders).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// Documents (Central document storage with versioning)
exports.documents = (0, pg_core_1.pgTable)("documents", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    folderId: (0, pg_core_1.varchar)("folder_id").references(() => exports.documentFolders.id, { onDelete: 'cascade' }),
    entityType: (0, pg_core_1.text)("entity_type").notNull(), // institution, parent, student, ngo, mentor
    entityId: (0, pg_core_1.varchar)("entity_id").notNull(),
    documentType: (0, pg_core_1.text)("document_type").notNull(), // pan_card, aadhaar, gst_certificate, registration_certificate, consent_form, kyc_form, etc.
    documentCategory: (0, pg_core_1.text)("document_category").notNull(), // kyc, consent, form, certificate, identity, address, financial
    documentName: (0, pg_core_1.text)("document_name").notNull(),
    fileName: (0, pg_core_1.text)("file_name").notNull(),
    fileSize: (0, pg_core_1.integer)("file_size"), // bytes
    mimeType: (0, pg_core_1.text)("mime_type"),
    storagePath: (0, pg_core_1.text)("storage_path").notNull(), // File system path
    checksum: (0, pg_core_1.text)("checksum"), // SHA-256 hash for integrity
    version: (0, pg_core_1.integer)("version").notNull().default(1),
    isLatest: (0, pg_core_1.boolean)("is_latest").notNull().default(true),
    previousVersionId: (0, pg_core_1.varchar)("previous_version_id"),
    // Verification workflow (maker-checker)
    status: (0, pg_core_1.text)("status").notNull().default('pending'), // pending, maker_verified, checker_approved, rejected, expired
    makerVerifiedBy: (0, pg_core_1.varchar)("maker_verified_by").references(() => exports.users.id),
    makerVerifiedAt: (0, pg_core_1.timestamp)("maker_verified_at"),
    makerNotes: (0, pg_core_1.text)("maker_notes"),
    checkerApprovedBy: (0, pg_core_1.varchar)("checker_approved_by").references(() => exports.users.id),
    checkerApprovedAt: (0, pg_core_1.timestamp)("checker_approved_at"),
    checkerNotes: (0, pg_core_1.text)("checker_notes"),
    rejectedBy: (0, pg_core_1.varchar)("rejected_by").references(() => exports.users.id),
    rejectedAt: (0, pg_core_1.timestamp)("rejected_at"),
    rejectionReason: (0, pg_core_1.text)("rejection_reason"),
    // Compliance fields
    expiryDate: (0, pg_core_1.date)("expiry_date"),
    isExpired: (0, pg_core_1.boolean)("is_expired").notNull().default(false),
    sensitivityLevel: (0, pg_core_1.text)("sensitivity_level").notNull().default('confidential'), // public, internal, confidential, restricted
    encryptionAlgorithm: (0, pg_core_1.text)("encryption_algorithm").default('AES-256'),
    accessCount: (0, pg_core_1.integer)("access_count").notNull().default(0),
    lastAccessedAt: (0, pg_core_1.timestamp)("last_accessed_at"),
    lastAccessedBy: (0, pg_core_1.varchar)("last_accessed_by").references(() => exports.users.id),
    uploadedBy: (0, pg_core_1.varchar)("uploaded_by").references(() => exports.users.id),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.insertDocumentSchema = (0, drizzle_zod_1.createInsertSchema)(exports.documents).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// Document Access Logs (SOC2 compliance - immutable audit trail)
exports.documentAccessLogs = (0, pg_core_1.pgTable)("document_access_logs", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    documentId: (0, pg_core_1.varchar)("document_id").notNull().references(() => exports.documents.id, { onDelete: 'cascade' }),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id),
    accessType: (0, pg_core_1.text)("access_type").notNull(), // view, download, upload, delete, verify, approve, reject
    ipAddress: (0, pg_core_1.text)("ip_address"),
    userAgent: (0, pg_core_1.text)("user_agent"),
    deviceType: (0, pg_core_1.text)("device_type"),
    location: (0, pg_core_1.text)("location"),
    accessStatus: (0, pg_core_1.text)("access_status").notNull().default('success'), // success, denied, failed
    failureReason: (0, pg_core_1.text)("failure_reason"),
    sessionId: (0, pg_core_1.varchar)("session_id"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertDocumentAccessLogSchema = (0, drizzle_zod_1.createInsertSchema)(exports.documentAccessLogs).omit({
    id: true,
    createdAt: true,
});
// ============================================
// PRE-ONBOARDING FRAMEWORK
// ============================================
// KYC Document Types (Master list for each entity type)
exports.kycDocumentTypes = (0, pg_core_1.pgTable)("kyc_document_types", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    entityType: (0, pg_core_1.text)("entity_type").notNull(), // institution, parent, student, ngo, mentor
    documentType: (0, pg_core_1.text)("document_type").notNull(),
    documentName: (0, pg_core_1.text)("document_name").notNull(),
    description: (0, pg_core_1.text)("description"),
    isMandatory: (0, pg_core_1.boolean)("is_mandatory").notNull().default(true),
    validityPeriod: (0, pg_core_1.integer)("validity_period"), // days, null means no expiry
    acceptedFormats: (0, pg_core_1.text)("accepted_formats").array().default((0, drizzle_orm_1.sql) `ARRAY['pdf', 'jpg', 'png']::text[]`),
    maxFileSizeMb: (0, pg_core_1.integer)("max_file_size_mb").default(5),
    sampleDocUrl: (0, pg_core_1.text)("sample_doc_url"),
    verificationInstructions: (0, pg_core_1.text)("verification_instructions"),
    displayOrder: (0, pg_core_1.integer)("display_order").default(0),
    isActive: (0, pg_core_1.boolean)("is_active").notNull().default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertKycDocumentTypeSchema = (0, drizzle_zod_1.createInsertSchema)(exports.kycDocumentTypes).omit({
    id: true,
    createdAt: true,
});
// Consent Types (Master list)
exports.consentTypes = (0, pg_core_1.pgTable)("consent_types", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    entityType: (0, pg_core_1.text)("entity_type").notNull(), // institution, parent, student, ngo, mentor
    consentCode: (0, pg_core_1.text)("consent_code").notNull().unique(),
    consentName: (0, pg_core_1.text)("consent_name").notNull(),
    description: (0, pg_core_1.text)("description"),
    consentTextTemplate: (0, pg_core_1.text)("consent_text_template").notNull(),
    version: (0, pg_core_1.text)("version").notNull().default('1.0'),
    isMandatory: (0, pg_core_1.boolean)("is_mandatory").notNull().default(true),
    requiresWitness: (0, pg_core_1.boolean)("requires_witness").notNull().default(false),
    requiresGuardian: (0, pg_core_1.boolean)("requires_guardian").notNull().default(false), // For minors
    lawfulBasis: (0, pg_core_1.text)("lawful_basis"), // DPDP Act basis
    dataCategories: (0, pg_core_1.text)("data_categories").array(),
    processingPurposes: (0, pg_core_1.text)("processing_purposes").array(),
    retentionPeriod: (0, pg_core_1.text)("retention_period"),
    displayOrder: (0, pg_core_1.integer)("display_order").default(0),
    isActive: (0, pg_core_1.boolean)("is_active").notNull().default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.insertConsentTypeSchema = (0, drizzle_zod_1.createInsertSchema)(exports.consentTypes).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// Pre-Onboarding Checklists
exports.preOnboardingChecklists = (0, pg_core_1.pgTable)("pre_onboarding_checklists", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    entityType: (0, pg_core_1.text)("entity_type").notNull(), // institution, parent, student, ngo, mentor
    entityId: (0, pg_core_1.varchar)("entity_id").notNull(),
    entityName: (0, pg_core_1.text)("entity_name"),
    // Temporary onboarding status
    temporaryOnboardingStatus: (0, pg_core_1.text)("temporary_onboarding_status").notNull().default('pending'), // pending, approved, rejected
    temporaryApprovedBy: (0, pg_core_1.varchar)("temporary_approved_by").references(() => exports.users.id),
    temporaryApprovedAt: (0, pg_core_1.timestamp)("temporary_approved_at"),
    // KYC completion tracking
    totalKycDocuments: (0, pg_core_1.integer)("total_kyc_documents").notNull().default(0),
    uploadedKycDocuments: (0, pg_core_1.integer)("uploaded_kyc_documents").notNull().default(0),
    verifiedKycDocuments: (0, pg_core_1.integer)("verified_kyc_documents").notNull().default(0),
    kycCompletionPercent: (0, pg_core_1.real)("kyc_completion_percent").notNull().default(0),
    // Consent completion tracking
    totalConsents: (0, pg_core_1.integer)("total_consents").notNull().default(0),
    grantedConsents: (0, pg_core_1.integer)("granted_consents").notNull().default(0),
    consentCompletionPercent: (0, pg_core_1.real)("consent_completion_percent").notNull().default(0),
    // Payment tracking
    totalAmount: (0, pg_core_1.real)("total_amount").notNull().default(0),
    paidAmount: (0, pg_core_1.real)("paid_amount").notNull().default(0),
    paymentStatus: (0, pg_core_1.text)("payment_status").notNull().default('pending'), // pending, partial, completed, waived
    // Overall status
    overallStatus: (0, pg_core_1.text)("overall_status").notNull().default('incomplete'), // incomplete, pending_review, approved, rejected
    // SPOC details (for institutions)
    spocName: (0, pg_core_1.text)("spoc_name"),
    spocEmail: (0, pg_core_1.text)("spoc_email"),
    spocPhone: (0, pg_core_1.text)("spoc_phone"),
    spocDesignation: (0, pg_core_1.text)("spoc_designation"),
    approvedBy: (0, pg_core_1.varchar)("approved_by").references(() => exports.users.id),
    approvedAt: (0, pg_core_1.timestamp)("approved_at"),
    rejectedBy: (0, pg_core_1.varchar)("rejected_by").references(() => exports.users.id),
    rejectedAt: (0, pg_core_1.timestamp)("rejected_at"),
    rejectionReason: (0, pg_core_1.text)("rejection_reason"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.insertPreOnboardingChecklistSchema = (0, drizzle_zod_1.createInsertSchema)(exports.preOnboardingChecklists).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// Student Bulk Imports
exports.studentBulkImports = (0, pg_core_1.pgTable)("student_bulk_imports", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    instituteId: (0, pg_core_1.varchar)("institute_id").notNull().references(() => exports.institutes.id, { onDelete: 'cascade' }),
    batchId: (0, pg_core_1.varchar)("batch_id").references(() => exports.batches.id),
    fileName: (0, pg_core_1.text)("file_name").notNull(),
    fileSize: (0, pg_core_1.integer)("file_size"),
    storagePath: (0, pg_core_1.text)("storage_path"),
    // Import status
    status: (0, pg_core_1.text)("status").notNull().default('pending'), // pending, processing, completed, failed, partial
    totalRows: (0, pg_core_1.integer)("total_rows").notNull().default(0),
    processedRows: (0, pg_core_1.integer)("processed_rows").notNull().default(0),
    successfulRows: (0, pg_core_1.integer)("successful_rows").notNull().default(0),
    failedRows: (0, pg_core_1.integer)("failed_rows").notNull().default(0),
    duplicateRows: (0, pg_core_1.integer)("duplicate_rows").notNull().default(0),
    // Error tracking
    errorLog: (0, pg_core_1.text)("error_log"),
    validationErrors: (0, pg_core_1.text)("validation_errors").array(),
    // Approval workflow
    requiresApproval: (0, pg_core_1.boolean)("requires_approval").notNull().default(true),
    approvalStatus: (0, pg_core_1.text)("approval_status").notNull().default('pending'), // pending, approved, rejected
    approvedBy: (0, pg_core_1.varchar)("approved_by").references(() => exports.users.id),
    approvedAt: (0, pg_core_1.timestamp)("approved_at"),
    rejectionReason: (0, pg_core_1.text)("rejection_reason"),
    uploadedBy: (0, pg_core_1.varchar)("uploaded_by").references(() => exports.users.id),
    processedAt: (0, pg_core_1.timestamp)("processed_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertStudentBulkImportSchema = (0, drizzle_zod_1.createInsertSchema)(exports.studentBulkImports).omit({
    id: true,
    createdAt: true,
});
// Student Import Records (Individual records from bulk import)
exports.studentImportRecords = (0, pg_core_1.pgTable)("student_import_records", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    importId: (0, pg_core_1.varchar)("import_id").notNull().references(() => exports.studentBulkImports.id, { onDelete: 'cascade' }),
    rowNumber: (0, pg_core_1.integer)("row_number").notNull(),
    // Student data from CSV
    studentName: (0, pg_core_1.text)("student_name").notNull(),
    dob: (0, pg_core_1.date)("dob"),
    gender: (0, pg_core_1.text)("gender"),
    parentName: (0, pg_core_1.text)("parent_name"),
    parentEmail: (0, pg_core_1.text)("parent_email"),
    parentPhone: (0, pg_core_1.text)("parent_phone"),
    classGrade: (0, pg_core_1.text)("class_grade"),
    section: (0, pg_core_1.text)("section"),
    rollNumber: (0, pg_core_1.text)("roll_number"),
    admissionNumber: (0, pg_core_1.text)("admission_number"),
    // Processing status
    status: (0, pg_core_1.text)("status").notNull().default('pending'), // pending, validated, created, failed, duplicate
    validationErrors: (0, pg_core_1.text)("validation_errors").array(),
    studentId: (0, pg_core_1.varchar)("student_id").references(() => exports.students.id), // Created student reference
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertStudentImportRecordSchema = (0, drizzle_zod_1.createInsertSchema)(exports.studentImportRecords).omit({
    id: true,
    createdAt: true,
});
// ============================================
// ENTERPRISE SECURITY & AUDIT (SOC2/ISO)
// ============================================
// Security Configurations
exports.securityConfigurations = (0, pg_core_1.pgTable)("security_configurations", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    configKey: (0, pg_core_1.text)("config_key").notNull().unique(),
    configValue: (0, pg_core_1.text)("config_value").notNull(),
    configType: (0, pg_core_1.text)("config_type").notNull(), // encryption, authentication, authorization, session, audit
    description: (0, pg_core_1.text)("description"),
    isEncrypted: (0, pg_core_1.boolean)("is_encrypted").notNull().default(false),
    complianceFramework: (0, pg_core_1.text)("compliance_framework").array(), // SOC2, ISO27001, DPDP
    lastModifiedBy: (0, pg_core_1.varchar)("last_modified_by").references(() => exports.users.id),
    lastModifiedAt: (0, pg_core_1.timestamp)("last_modified_at").notNull().defaultNow(),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertSecurityConfigurationSchema = (0, drizzle_zod_1.createInsertSchema)(exports.securityConfigurations).omit({
    id: true,
    createdAt: true,
});
// Security Incidents
exports.securityIncidents = (0, pg_core_1.pgTable)("security_incidents", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    incidentCode: (0, pg_core_1.text)("incident_code").notNull().unique(),
    incidentType: (0, pg_core_1.text)("incident_type").notNull(), // unauthorized_access, data_breach, policy_violation, suspicious_activity, system_compromise
    severity: (0, pg_core_1.text)("severity").notNull(), // critical, high, medium, low
    status: (0, pg_core_1.text)("status").notNull().default('open'), // open, investigating, contained, resolved, closed
    title: (0, pg_core_1.text)("title").notNull(),
    description: (0, pg_core_1.text)("description"),
    affectedSystems: (0, pg_core_1.text)("affected_systems").array(),
    affectedUsers: (0, pg_core_1.text)("affected_users").array(),
    detectedAt: (0, pg_core_1.timestamp)("detected_at").notNull().defaultNow(),
    detectedBy: (0, pg_core_1.varchar)("detected_by").references(() => exports.users.id),
    containedAt: (0, pg_core_1.timestamp)("contained_at"),
    resolvedAt: (0, pg_core_1.timestamp)("resolved_at"),
    rootCause: (0, pg_core_1.text)("root_cause"),
    remediationSteps: (0, pg_core_1.text)("remediation_steps"),
    preventiveMeasures: (0, pg_core_1.text)("preventive_measures"),
    assignedTo: (0, pg_core_1.varchar)("assigned_to").references(() => exports.users.id),
    escalatedTo: (0, pg_core_1.varchar)("escalated_to").references(() => exports.users.id),
    notificationsSent: (0, pg_core_1.boolean)("notifications_sent").notNull().default(false),
    complianceImpact: (0, pg_core_1.text)("compliance_impact"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.insertSecurityIncidentSchema = (0, drizzle_zod_1.createInsertSchema)(exports.securityIncidents).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// Compliance Audit Logs (Immutable, SOC2/ISO compliant)
exports.complianceAuditLogs = (0, pg_core_1.pgTable)("compliance_audit_logs", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    logId: (0, pg_core_1.text)("log_id").notNull().unique(), // Unique, sequential, immutable ID
    logType: (0, pg_core_1.text)("log_type").notNull(), // system, user, security, data, configuration
    category: (0, pg_core_1.text)("category").notNull(), // authentication, authorization, data_access, data_modification, configuration_change, security_event
    action: (0, pg_core_1.text)("action").notNull(),
    resourceType: (0, pg_core_1.text)("resource_type").notNull(),
    resourceId: (0, pg_core_1.varchar)("resource_id"),
    resourceName: (0, pg_core_1.text)("resource_name"),
    // Actor information
    actorId: (0, pg_core_1.varchar)("actor_id"),
    actorType: (0, pg_core_1.text)("actor_type"), // user, system, api, scheduled_job
    actorName: (0, pg_core_1.text)("actor_name"),
    actorRole: (0, pg_core_1.text)("actor_role"),
    // Request details
    ipAddress: (0, pg_core_1.text)("ip_address"),
    userAgent: (0, pg_core_1.text)("user_agent"),
    sessionId: (0, pg_core_1.varchar)("session_id"),
    requestId: (0, pg_core_1.varchar)("request_id"),
    // Change tracking
    previousValue: (0, pg_core_1.text)("previous_value"),
    newValue: (0, pg_core_1.text)("new_value"),
    changeReason: (0, pg_core_1.text)("change_reason"),
    // Status
    status: (0, pg_core_1.text)("status").notNull(), // success, failure, partial, denied
    errorCode: (0, pg_core_1.text)("error_code"),
    errorMessage: (0, pg_core_1.text)("error_message"),
    // Compliance metadata
    complianceFrameworks: (0, pg_core_1.text)("compliance_frameworks").array(), // SOC2, ISO27001, DPDP, GDPR
    dataClassification: (0, pg_core_1.text)("data_classification"), // public, internal, confidential, restricted
    retentionPeriod: (0, pg_core_1.text)("retention_period").default('7_years'),
    // Integrity
    logHash: (0, pg_core_1.text)("log_hash"), // SHA-256 hash for integrity verification
    previousLogHash: (0, pg_core_1.text)("previous_log_hash"), // Chain link
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertComplianceAuditLogSchema = (0, drizzle_zod_1.createInsertSchema)(exports.complianceAuditLogs).omit({
    id: true,
    createdAt: true,
});
// Data Retention Policies
exports.dataRetentionPolicies = (0, pg_core_1.pgTable)("data_retention_policies", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    policyName: (0, pg_core_1.text)("policy_name").notNull(),
    dataCategory: (0, pg_core_1.text)("data_category").notNull(), // user_data, audit_logs, documents, financial, communication
    retentionPeriodDays: (0, pg_core_1.integer)("retention_period_days").notNull(),
    archivalPeriodDays: (0, pg_core_1.integer)("archival_period_days"),
    deletionMethod: (0, pg_core_1.text)("deletion_method").notNull().default('secure_delete'), // soft_delete, hard_delete, secure_delete, anonymize
    complianceFramework: (0, pg_core_1.text)("compliance_framework").array(),
    legalBasis: (0, pg_core_1.text)("legal_basis"),
    exceptions: (0, pg_core_1.text)("exceptions"),
    lastExecuted: (0, pg_core_1.timestamp)("last_executed"),
    nextScheduled: (0, pg_core_1.timestamp)("next_scheduled"),
    isActive: (0, pg_core_1.boolean)("is_active").notNull().default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.insertDataRetentionPolicySchema = (0, drizzle_zod_1.createInsertSchema)(exports.dataRetentionPolicies).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// Access Control Policies (RBAC with attribute-based extensions)
exports.accessControlPolicies = (0, pg_core_1.pgTable)("access_control_policies", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    policyName: (0, pg_core_1.text)("policy_name").notNull(),
    policyType: (0, pg_core_1.text)("policy_type").notNull(), // role_based, attribute_based, resource_based
    resource: (0, pg_core_1.text)("resource").notNull(),
    actions: (0, pg_core_1.text)("actions").array().notNull(),
    conditions: (0, pg_core_1.text)("conditions"), // JSON conditions for ABAC
    allowedRoles: (0, pg_core_1.text)("allowed_roles").array(),
    deniedRoles: (0, pg_core_1.text)("denied_roles").array(),
    priority: (0, pg_core_1.integer)("priority").notNull().default(100),
    effect: (0, pg_core_1.text)("effect").notNull().default('allow'), // allow, deny
    isActive: (0, pg_core_1.boolean)("is_active").notNull().default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.insertAccessControlPolicySchema = (0, drizzle_zod_1.createInsertSchema)(exports.accessControlPolicies).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// Subscription Packages table (LBI Assessment Packages)
exports.subscriptionPackages = (0, pg_core_1.pgTable)("subscription_packages", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    category: (0, pg_core_1.text)("category").notNull(), // Entry (Micro Check), Exam-Season Special, Annual Core, Premium, Post-Exam
    studentSegment: (0, pg_core_1.text)("student_segment").notNull(), // Any Class, Class 6+, Class 8+, Class 10, etc.
    productName: (0, pg_core_1.text)("product_name").notNull(), // Mini Learning Check, Stress Check, ExamReadiness Index, etc.
    isRecommended: (0, pg_core_1.boolean)("is_recommended").notNull().default(false),
    domainsCovered: (0, pg_core_1.text)("domains_covered").array().notNull(), // Array of domain names
    price: (0, pg_core_1.real)("price"), // Price in INR
    validityDays: (0, pg_core_1.integer)("validity_days"), // Package validity
    questionCount: (0, pg_core_1.integer)("question_count"), // Number of questions in assessment
    reportType: (0, pg_core_1.text)("report_type"), // Basic, Detailed, Comprehensive
    sortOrder: (0, pg_core_1.integer)("sort_order").notNull().default(0),
    isActive: (0, pg_core_1.boolean)("is_active").notNull().default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.insertSubscriptionPackageSchema = (0, drizzle_zod_1.createInsertSchema)(exports.subscriptionPackages).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// Student Subscriptions table (tracks which packages students have purchased)
exports.studentSubscriptions = (0, pg_core_1.pgTable)("student_subscriptions", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    childId: (0, pg_core_1.varchar)("child_id").references(() => exports.children.id, { onDelete: 'cascade' }),
    studentId: (0, pg_core_1.varchar)("student_id").references(() => exports.students.id, { onDelete: 'cascade' }),
    packageId: (0, pg_core_1.varchar)("package_id").notNull().references(() => exports.subscriptionPackages.id, { onDelete: 'restrict' }),
    purchaseDate: (0, pg_core_1.timestamp)("purchase_date").notNull().defaultNow(),
    expiryDate: (0, pg_core_1.timestamp)("expiry_date"),
    status: (0, pg_core_1.text)("status").notNull().default('active'), // active, expired, cancelled
    assessmentCompletedAt: (0, pg_core_1.timestamp)("assessment_completed_at"),
    reportGeneratedAt: (0, pg_core_1.timestamp)("report_generated_at"),
    paymentTransactionId: (0, pg_core_1.varchar)("payment_transaction_id"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertStudentSubscriptionSchema = (0, drizzle_zod_1.createInsertSchema)(exports.studentSubscriptions).omit({
    id: true,
    createdAt: true,
});
// ============================================
// LEARNING BEHAVIOR INTELLIGENCE (LBI) SYSTEM
// Comprehensive LBI Assessment Framework
// ============================================
// LBI Domains (e.g., ACE - Academic & Cognitive Excellence, TQP - Thinking & Problem-solving)
exports.lbiDomains = (0, pg_core_1.pgTable)("lbi_domains", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    domainCode: (0, pg_core_1.text)("domain_code").notNull().unique(), // ACE, TQP, SEI, etc.
    domainName: (0, pg_core_1.text)("domain_name").notNull(),
    description: (0, pg_core_1.text)("description"),
    color: (0, pg_core_1.text)("color"), // For UI display
    icon: (0, pg_core_1.text)("icon"), // Icon name for UI
    weightage: (0, pg_core_1.real)("weightage").notNull().default(1.0), // Weight in overall LBI calculation
    displayOrder: (0, pg_core_1.integer)("display_order").notNull().default(0),
    status: (0, pg_core_1.text)("status").notNull().default('Active'),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertLbiDomainSchema = (0, drizzle_zod_1.createInsertSchema)(exports.lbiDomains).omit({
    id: true,
    createdAt: true,
});
// LBI Subdomains (e.g., ACE_SD01 - Learning & Memory, ACE_SD02 - Attention & Focus)
exports.lbiSubdomains = (0, pg_core_1.pgTable)("lbi_subdomains", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    domainId: (0, pg_core_1.varchar)("domain_id").notNull().references(() => exports.lbiDomains.id, { onDelete: 'cascade' }),
    subdomainCode: (0, pg_core_1.text)("subdomain_code").notNull().unique(), // ACE_SD01, TQP_SD01, etc.
    subdomainName: (0, pg_core_1.text)("subdomain_name").notNull(),
    description: (0, pg_core_1.text)("description"),
    weightage: (0, pg_core_1.real)("weightage").notNull().default(1.0), // Weight within domain
    displayOrder: (0, pg_core_1.integer)("display_order").notNull().default(0),
    status: (0, pg_core_1.text)("status").notNull().default('Active'),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertLbiSubdomainSchema = (0, drizzle_zod_1.createInsertSchema)(exports.lbiSubdomains).omit({
    id: true,
    createdAt: true,
});
// LBI Age Bands (A, B, C - mapping to age ranges)
exports.lbiAgeBands = (0, pg_core_1.pgTable)("lbi_age_bands", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    bandCode: (0, pg_core_1.text)("band_code").notNull().unique(), // A, B, C
    bandName: (0, pg_core_1.text)("band_name").notNull(), // "Primary (6-10)", "Middle (11-14)", etc.
    minAge: (0, pg_core_1.integer)("min_age").notNull(),
    maxAge: (0, pg_core_1.integer)("max_age").notNull(),
    gradeRange: (0, pg_core_1.text)("grade_range"), // "Grade 1-5", "Grade 6-8", etc.
    status: (0, pg_core_1.text)("status").notNull().default('Active'),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertLbiAgeBandSchema = (0, drizzle_zod_1.createInsertSchema)(exports.lbiAgeBands).omit({
    id: true,
    createdAt: true,
});
// LBI Response Scales (Likert scale definitions)
exports.lbiResponseScales = (0, pg_core_1.pgTable)("lbi_response_scales", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    scaleCode: (0, pg_core_1.text)("scale_code").notNull().unique(), // LIKERT_5, LIKERT_7, FREQUENCY_5
    scaleName: (0, pg_core_1.text)("scale_name").notNull(),
    scaleType: (0, pg_core_1.text)("scale_type").notNull().default('likert'), // likert, frequency, agreement, etc.
    options: (0, pg_core_1.text)("options").notNull(), // JSON: ["Never","Rarely","Sometimes","Often","Always"]
    scoring: (0, pg_core_1.text)("scoring").notNull(), // JSON: [1,2,3,4,5] or {"Never":1,"Rarely":2,...}
    reverseScoringMap: (0, pg_core_1.text)("reverse_scoring_map"), // JSON: [5,4,3,2,1] for reverse items
    status: (0, pg_core_1.text)("status").notNull().default('Active'),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertLbiResponseScaleSchema = (0, drizzle_zod_1.createInsertSchema)(exports.lbiResponseScales).omit({
    id: true,
    createdAt: true,
});
// LBI Question Bank (Enhanced with all required fields from spreadsheet)
exports.lbiQuestions = (0, pg_core_1.pgTable)("lbi_questions", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    questionCode: (0, pg_core_1.text)("question_code").notNull().unique(), // ACE_A_001, TQP_B_015, etc.
    domainId: (0, pg_core_1.varchar)("domain_id").notNull().references(() => exports.lbiDomains.id, { onDelete: 'cascade' }),
    subdomainId: (0, pg_core_1.varchar)("subdomain_id").notNull().references(() => exports.lbiSubdomains.id, { onDelete: 'cascade' }),
    ageBandId: (0, pg_core_1.varchar)("age_band_id").notNull().references(() => exports.lbiAgeBands.id, { onDelete: 'restrict' }),
    responseScaleId: (0, pg_core_1.varchar)("response_scale_id").references(() => exports.lbiResponseScales.id, { onDelete: 'set null' }),
    questionText: (0, pg_core_1.text)("question_text").notNull(),
    questionTextHi: (0, pg_core_1.text)("question_text_hi"), // Hindi translation
    questionTextMr: (0, pg_core_1.text)("question_text_mr"), // Marathi translation
    questionTextTa: (0, pg_core_1.text)("question_text_ta"), // Tamil translation
    questionTextTe: (0, pg_core_1.text)("question_text_te"), // Telugu translation
    questionType: (0, pg_core_1.text)("question_type").notNull().default('likert'), // likert, mcq, true_false, scenario
    responseOptions: (0, pg_core_1.text)("response_options"), // JSON array of options if custom
    scoring: (0, pg_core_1.text)("scoring"), // JSON scoring pattern e.g., "1*;1,2*;2,3*;3,4*;4,5*;5"
    reverseScored: (0, pg_core_1.boolean)("reverse_scored").notNull().default(false), // TRUE for negative keyed items
    difficulty: (0, pg_core_1.text)("difficulty").notNull().default('MEDIUM'), // EASY, MEDIUM, HARD
    language: (0, pg_core_1.text)("language").notNull().default('EN'), // Primary language
    setNumber: (0, pg_core_1.integer)("set_number").default(1), // Question set for randomization
    displayOrder: (0, pg_core_1.integer)("display_order").notNull().default(0),
    tags: (0, pg_core_1.text)("tags").array(), // ["focus", "attention", "classroom"] for filtering
    version: (0, pg_core_1.integer)("version").notNull().default(1),
    status: (0, pg_core_1.text)("status").notNull().default('Active'),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at"),
});
exports.insertLbiQuestionSchema = (0, drizzle_zod_1.createInsertSchema)(exports.lbiQuestions).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// LBI Scoring Rules (for calculating domain/subdomain scores)
exports.lbiScoringRules = (0, pg_core_1.pgTable)("lbi_scoring_rules", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    ruleCode: (0, pg_core_1.text)("rule_code").notNull().unique(),
    ruleName: (0, pg_core_1.text)("rule_name").notNull(),
    domainId: (0, pg_core_1.varchar)("domain_id").references(() => exports.lbiDomains.id, { onDelete: 'cascade' }),
    subdomainId: (0, pg_core_1.varchar)("subdomain_id").references(() => exports.lbiSubdomains.id, { onDelete: 'cascade' }),
    ageBandId: (0, pg_core_1.varchar)("age_band_id").references(() => exports.lbiAgeBands.id, { onDelete: 'set null' }),
    calculationType: (0, pg_core_1.text)("calculation_type").notNull().default('mean'), // mean, sum, weighted_mean
    normType: (0, pg_core_1.text)("norm_type").notNull().default('percentile'), // percentile, stanine, z_score, t_score
    normData: (0, pg_core_1.text)("norm_data"), // JSON with normative data
    minScore: (0, pg_core_1.real)("min_score"),
    maxScore: (0, pg_core_1.real)("max_score"),
    cutoffs: (0, pg_core_1.text)("cutoffs"), // JSON: {"low": 30, "medium": 60, "high": 100}
    status: (0, pg_core_1.text)("status").notNull().default('Active'),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertLbiScoringRuleSchema = (0, drizzle_zod_1.createInsertSchema)(exports.lbiScoringRules).omit({
    id: true,
    createdAt: true,
});
// LBI Assessment Sessions (student assessment tracking)
exports.lbiAssessmentSessions = (0, pg_core_1.pgTable)("lbi_assessment_sessions", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    childId: (0, pg_core_1.varchar)("child_id").references(() => exports.children.id, { onDelete: 'cascade' }),
    studentId: (0, pg_core_1.varchar)("student_id").references(() => exports.students.id, { onDelete: 'cascade' }),
    ageBandId: (0, pg_core_1.varchar)("age_band_id").references(() => exports.lbiAgeBands.id, { onDelete: 'set null' }),
    assessmentType: (0, pg_core_1.text)("assessment_type").notNull().default('full'), // full, domain_specific, screening
    targetDomains: (0, pg_core_1.text)("target_domains").array(), // Specific domains if not full
    status: (0, pg_core_1.text)("status").notNull().default('not_started'), // not_started, in_progress, completed, abandoned
    totalQuestions: (0, pg_core_1.integer)("total_questions").notNull().default(0),
    questionsAnswered: (0, pg_core_1.integer)("questions_answered").notNull().default(0),
    currentQuestionIndex: (0, pg_core_1.integer)("current_question_index").notNull().default(0),
    startedAt: (0, pg_core_1.timestamp)("started_at"),
    completedAt: (0, pg_core_1.timestamp)("completed_at"),
    timeSpentSeconds: (0, pg_core_1.integer)("time_spent_seconds").default(0),
    deviceInfo: (0, pg_core_1.text)("device_info"), // Browser, OS info
    ipAddress: (0, pg_core_1.text)("ip_address"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertLbiAssessmentSessionSchema = (0, drizzle_zod_1.createInsertSchema)(exports.lbiAssessmentSessions).omit({
    id: true,
    createdAt: true,
});
// LBI Session Responses (individual question responses)
exports.lbiSessionResponses = (0, pg_core_1.pgTable)("lbi_session_responses", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    sessionId: (0, pg_core_1.varchar)("session_id").notNull().references(() => exports.lbiAssessmentSessions.id, { onDelete: 'cascade' }),
    questionId: (0, pg_core_1.varchar)("question_id").notNull().references(() => exports.lbiQuestions.id, { onDelete: 'restrict' }),
    responseValue: (0, pg_core_1.integer)("response_value"), // The selected option value (1-5 for Likert)
    responseText: (0, pg_core_1.text)("response_text"), // For open-ended questions
    rawScore: (0, pg_core_1.real)("raw_score"), // Score before normalization
    adjustedScore: (0, pg_core_1.real)("adjusted_score"), // After reverse scoring adjustment
    responseTimeMs: (0, pg_core_1.integer)("response_time_ms"), // Time taken to answer in milliseconds
    questionOrder: (0, pg_core_1.integer)("question_order"), // Order in which question was presented
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertLbiSessionResponseSchema = (0, drizzle_zod_1.createInsertSchema)(exports.lbiSessionResponses).omit({
    id: true,
    createdAt: true,
});
// LBI Domain Scores (calculated scores per domain for a session)
exports.lbiDomainScores = (0, pg_core_1.pgTable)("lbi_domain_scores", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    sessionId: (0, pg_core_1.varchar)("session_id").notNull().references(() => exports.lbiAssessmentSessions.id, { onDelete: 'cascade' }),
    domainId: (0, pg_core_1.varchar)("domain_id").notNull().references(() => exports.lbiDomains.id, { onDelete: 'cascade' }),
    rawScore: (0, pg_core_1.real)("raw_score").notNull(),
    percentileScore: (0, pg_core_1.real)("percentile_score"),
    stanineScore: (0, pg_core_1.integer)("stanine_score"),
    classification: (0, pg_core_1.text)("classification"), // Low, Below Average, Average, Above Average, High
    questionsAnswered: (0, pg_core_1.integer)("questions_answered").notNull(),
    totalQuestions: (0, pg_core_1.integer)("total_questions").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertLbiDomainScoreSchema = (0, drizzle_zod_1.createInsertSchema)(exports.lbiDomainScores).omit({
    id: true,
    createdAt: true,
});
// LBI Subdomain Scores (calculated scores per subdomain)
exports.lbiSubdomainScores = (0, pg_core_1.pgTable)("lbi_subdomain_scores", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    sessionId: (0, pg_core_1.varchar)("session_id").notNull().references(() => exports.lbiAssessmentSessions.id, { onDelete: 'cascade' }),
    subdomainId: (0, pg_core_1.varchar)("subdomain_id").notNull().references(() => exports.lbiSubdomains.id, { onDelete: 'cascade' }),
    rawScore: (0, pg_core_1.real)("raw_score").notNull(),
    percentileScore: (0, pg_core_1.real)("percentile_score"),
    stanineScore: (0, pg_core_1.integer)("stanine_score"),
    classification: (0, pg_core_1.text)("classification"),
    questionsAnswered: (0, pg_core_1.integer)("questions_answered").notNull(),
    totalQuestions: (0, pg_core_1.integer)("total_questions").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertLbiSubdomainScoreSchema = (0, drizzle_zod_1.createInsertSchema)(exports.lbiSubdomainScores).omit({
    id: true,
    createdAt: true,
});
// LBI Overall Index (composite LBI score)
exports.lbiOverallIndex = (0, pg_core_1.pgTable)("lbi_overall_index", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    sessionId: (0, pg_core_1.varchar)("session_id").notNull().references(() => exports.lbiAssessmentSessions.id, { onDelete: 'cascade' }),
    childId: (0, pg_core_1.varchar)("child_id").references(() => exports.children.id, { onDelete: 'cascade' }),
    studentId: (0, pg_core_1.varchar)("student_id").references(() => exports.students.id, { onDelete: 'cascade' }),
    lbiScore: (0, pg_core_1.real)("lbi_score").notNull(), // Overall LBI score (0-100)
    percentileRank: (0, pg_core_1.real)("percentile_rank"),
    stanineScore: (0, pg_core_1.integer)("stanine_score"),
    classification: (0, pg_core_1.text)("classification"), // Needs Attention, Developing, Proficient, Advanced
    strengthDomains: (0, pg_core_1.text)("strength_domains").array(), // Top 2-3 domains
    developmentAreas: (0, pg_core_1.text)("development_areas").array(), // Bottom 2-3 domains
    recommendations: (0, pg_core_1.text)("recommendations"), // AI-generated recommendations
    reportGeneratedAt: (0, pg_core_1.timestamp)("report_generated_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertLbiOverallIndexSchema = (0, drizzle_zod_1.createInsertSchema)(exports.lbiOverallIndex).omit({
    id: true,
    createdAt: true,
});
// =================== NOTIFICATION SYSTEM ===================
exports.notifications = (0, pg_core_1.pgTable)("notifications", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    recipientId: (0, pg_core_1.varchar)("recipient_id").notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    senderId: (0, pg_core_1.varchar)("sender_id").references(() => exports.users.id, { onDelete: 'set null' }),
    type: (0, pg_core_1.text)("type").notNull().default('fyi'), // fyi, fya (For Your Information / For Your Action)
    category: (0, pg_core_1.text)("category").notNull().default('general'), // general, assessment, subscription, document, security, onboarding, exam, consent, system
    title: (0, pg_core_1.text)("title").notNull(),
    message: (0, pg_core_1.text)("message").notNull(),
    actionUrl: (0, pg_core_1.text)("action_url"),
    actionLabel: (0, pg_core_1.text)("action_label"),
    priority: (0, pg_core_1.text)("priority").notNull().default('normal'), // low, normal, high, urgent
    isRead: (0, pg_core_1.boolean)("is_read").notNull().default(false),
    isAcknowledged: (0, pg_core_1.boolean)("is_acknowledged").notNull().default(false),
    acknowledgedAt: (0, pg_core_1.timestamp)("acknowledged_at"),
    isEmailSent: (0, pg_core_1.boolean)("is_email_sent").notNull().default(false),
    emailSentAt: (0, pg_core_1.timestamp)("email_sent_at"),
    metadata: (0, pg_core_1.text)("metadata"), // JSON string for extra data
    expiresAt: (0, pg_core_1.timestamp)("expires_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertNotificationSchema = (0, drizzle_zod_1.createInsertSchema)(exports.notifications).omit({
    id: true,
    isRead: true,
    isAcknowledged: true,
    acknowledgedAt: true,
    isEmailSent: true,
    emailSentAt: true,
    createdAt: true,
});
exports.emailConsents = (0, pg_core_1.pgTable)("email_consents", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    consentType: (0, pg_core_1.text)("consent_type").notNull(), // marketing, transactional, assessment_updates, security_alerts, newsletter, product_updates
    isConsented: (0, pg_core_1.boolean)("is_consented").notNull().default(true),
    consentedAt: (0, pg_core_1.timestamp)("consented_at"),
    revokedAt: (0, pg_core_1.timestamp)("revoked_at"),
    ipAddress: (0, pg_core_1.text)("ip_address"),
    userAgent: (0, pg_core_1.text)("user_agent"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull().defaultNow(),
});
exports.insertEmailConsentSchema = (0, drizzle_zod_1.createInsertSchema)(exports.emailConsents).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
exports.acknowledgements = (0, pg_core_1.pgTable)("acknowledgements", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    notificationId: (0, pg_core_1.varchar)("notification_id").references(() => exports.notifications.id, { onDelete: 'cascade' }),
    acknowledgementType: (0, pg_core_1.text)("acknowledgement_type").notNull(), // notification, policy, terms, consent, document
    referenceId: (0, pg_core_1.text)("reference_id"),
    referenceType: (0, pg_core_1.text)("reference_type"),
    notes: (0, pg_core_1.text)("notes"),
    acknowledgedAt: (0, pg_core_1.timestamp)("acknowledged_at").notNull().defaultNow(),
});
exports.insertAcknowledgementSchema = (0, drizzle_zod_1.createInsertSchema)(exports.acknowledgements).omit({
    id: true,
    acknowledgedAt: true,
});
exports.notificationBroadcasts = (0, pg_core_1.pgTable)("notification_broadcasts", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    senderId: (0, pg_core_1.varchar)("sender_id").notNull().references(() => exports.users.id, { onDelete: 'set null' }),
    type: (0, pg_core_1.text)("type").notNull().default('fyi'), // fyi, fya
    category: (0, pg_core_1.text)("category").notNull().default('system'),
    title: (0, pg_core_1.text)("title").notNull(),
    message: (0, pg_core_1.text)("message").notNull(),
    targetRoles: (0, pg_core_1.text)("target_roles").array(), // parent, student, institute, mentor, etc.
    targetUserIds: (0, pg_core_1.text)("target_user_ids").array(),
    priority: (0, pg_core_1.text)("priority").notNull().default('normal'),
    actionUrl: (0, pg_core_1.text)("action_url"),
    actionLabel: (0, pg_core_1.text)("action_label"),
    sendEmail: (0, pg_core_1.boolean)("send_email").notNull().default(false),
    totalRecipients: (0, pg_core_1.integer)("total_recipients").notNull().default(0),
    totalDelivered: (0, pg_core_1.integer)("total_delivered").notNull().default(0),
    status: (0, pg_core_1.text)("status").notNull().default('draft'), // draft, sending, sent, failed
    scheduledAt: (0, pg_core_1.timestamp)("scheduled_at"),
    sentAt: (0, pg_core_1.timestamp)("sent_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.insertNotificationBroadcastSchema = (0, drizzle_zod_1.createInsertSchema)(exports.notificationBroadcasts).omit({
    id: true,
    totalRecipients: true,
    totalDelivered: true,
    status: true,
    sentAt: true,
    createdAt: true,
});
exports.mfaCodes = (0, pg_core_1.pgTable)("mfa_codes", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    code: (0, pg_core_1.varchar)("code", { length: 6 }).notNull(),
    email: (0, pg_core_1.varchar)("email").notNull(),
    attemptToken: (0, pg_core_1.varchar)("attempt_token").notNull(),
    attempts: (0, pg_core_1.integer)("attempts").notNull().default(0),
    expiresAt: (0, pg_core_1.timestamp)("expires_at").notNull(),
    used: (0, pg_core_1.boolean)("used").notNull().default(false),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
});
exports.insertMfaCodeSchema = (0, drizzle_zod_1.createInsertSchema)(exports.mfaCodes).omit({
    id: true,
    createdAt: true,
});
__exportStar(require("./models/chat"), exports);
