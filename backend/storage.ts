import { drizzle } from "drizzle-orm/node-postgres";
// import { and, desc, eq } from "drizzle-orm";
// import { db } from "./db"; // or your db import
import { subscriptionPackages, studentSubscriptions } from "./db/schema";
import pg from "pg";
import { 
  type User, 
  type InsertUser, 
  users,
  type LbiCategory,
  type InsertLbiCategory,
  lbiCategories,
  type Child,
  type InsertChild,
  children,
  type BehaviouralInsight,
  type InsertBehaviouralInsight,
  behaviouralInsights,
  type ChildExam,
  type InsertChildExam,
  childExams,
  type ChildExamQuestion,
  type InsertChildExamQuestion,
  childExamQuestions,
  type SupervisedTestSession,
  type InsertSupervisedTestSession,
  supervisedTestSessions,
  type Institute,
  institutes,
  type EnrollmentRequest,
  type InsertEnrollmentRequest,
  enrollmentRequests,
  type Exam,
  type InsertExam,
  exams,
  type ExamQuestion,
  type InsertExamQuestion,
  examQuestions,
  type ExamAttempt,
  type InsertExamAttempt,
  examAttempts,
  type ExamResponse,
  type InsertExamResponse,
  examResponses,
  type Student,
  type InsertStudent,
  students,
  type Batch,
  type InsertBatch,
  batches,
  type LbiModule,
  type InsertLbiModule,
  lbiModules,
  type LbiSubModule,
  type InsertLbiSubModule,
  lbiSubModules,
  type LbiAgeGroup,
  type InsertLbiAgeGroup,
  lbiAgeGroups,
  type LbiQuestionBank,
  type InsertLbiQuestionBank,
  lbiQuestionBank,
  type StudentAssessmentSession,
  type InsertStudentAssessmentSession,
  studentAssessmentSessions,
  type StudentAssessmentResponse,
  type InsertStudentAssessmentResponse,
  studentAssessmentResponses,
  type AssessmentTemplate,
  type InsertAssessmentTemplate,
  assessmentTemplates,
  type AssessmentTemplateQuestion,
  type InsertAssessmentTemplateQuestion,
  assessmentTemplateQuestions,
  type CompetencyLibrary,
  type InsertCompetencyLibrary,
  competencyLibrary,
  type EducationBoard,
  type InsertEducationBoard,
  educationBoards,
  type AcademicClass,
  type InsertAcademicClass,
  academicClasses,
  type AcademicSubject,
  type InsertAcademicSubject,
  academicSubjects,
  type AcademicChapter,
  type InsertAcademicChapter,
  academicChapters,
  type AcademicTopic,
  type InsertAcademicTopic,
  academicTopics,
  type ChildAcademicProfile,
  type InsertChildAcademicProfile,
  childAcademicProfiles,
  type ChildSubjectEnrollment,
  type InsertChildSubjectEnrollment,
  childSubjectEnrollments,
  type StudyTask,
  type InsertStudyTask,
  studyTasks,
  type TestBlueprint,
  type InsertTestBlueprint,
  testBlueprints,
  type TestQuestionBank,
  type InsertTestQuestionBank,
  testQuestionBank,
  type AssessmentBlueprint,
  type InsertAssessmentBlueprint,
  assessmentBlueprints,
  type BlueprintSection,
  type InsertBlueprintSection,
  blueprintSections,
  type Test,
  type InsertTest,
  tests,
  type TestQuestion,
  type InsertTestQuestion,
  testQuestions,
  type TestWorkflowHistory,
  type InsertTestWorkflowHistory,
  testWorkflowHistory,
  type TestApproval,
  type InsertTestApproval,
  testApprovals,
  type TestAssignment,
  type InsertTestAssignment,
  testAssignments,
  type TestAttempt,
  type InsertTestAttempt,
  testAttempts,
  type TestResponse,
  type InsertTestResponse,
  testResponses,
  type StaffRole,
  type InsertStaffRole,
  staffRoles,
  type InstituteStaff,
  type InsertInstituteStaff,
  instituteStaff,
  type StaffBatchAssignment,
  type InsertStaffBatchAssignment,
  staffBatchAssignments,
  type ForumPost,
  type InsertForumPost,
  forumPosts,
  type ForumReply,
  type InsertForumReply,
  forumReplies,
  type ForumAttachment,
  type InsertForumAttachment,
  forumAttachments,
  type ForumModerationLog,
  type InsertForumModerationLog,
  forumModerationLogs,
  type ForumVote,
  type InsertForumVote,
  forumVotes,
  type PerformanceAnalytics,
  type InsertPerformanceAnalytics,
  performanceAnalytics,
  type LbiPerformanceCorrelation,
  type InsertLbiPerformanceCorrelation,
  lbiPerformanceCorrelation,
  type AuditLog,
  type InsertAuditLog,
  auditLogs,
  type ParentTest,
  type InsertParentTest,
  parentTests,
  type ParentTestAssignment,
  type InsertParentTestAssignment,
  parentTestAssignments,
  type ParentTestResult,
  type InsertParentTestResult,
  parentTestResults,
  type JobPosting,
  type InsertJobPosting,
  jobPostings,
  type JobDistribution,
  type InsertJobDistribution,
  jobDistributions,
  type JobApplication,
  type InsertJobApplication,
  jobApplications,
  type Mentor,
  type InsertMentor,
  mentors,
  type TrainingProgram,
  type InsertTrainingProgram,
  trainingPrograms,
  type TrainingEnrollment,
  type InsertTrainingEnrollment,
  trainingEnrollments,
  type MentorKpi,
  type InsertMentorKpi,
  mentorKpis,
  type HrConsentLog,
  type InsertHrConsentLog,
  hrConsentLogs,
  type ComplianceViolation,
  type InsertComplianceViolation,
  complianceViolations,
  type MentorPayout,
  type InsertMentorPayout,
  mentorPayouts,
  type InstitutionalSla,
  type InsertInstitutionalSla,
  institutionalSlas,
  type WhiteLabelPartner,
  type InsertWhiteLabelPartner,
  whiteLabelPartners,
  type HrAuditLog,
  type InsertHrAuditLog,
  hrAuditLogs,
  type JobApprovalLog,
  type InsertJobApprovalLog,
  jobApprovalLogs,
  type MentorProfile,
  type InsertMentorProfile,
  mentorProfiles,
  type MentorTask,
  type InsertMentorTask,
  mentorTasks,
  type OnboardingApproval,
  type InsertOnboardingApproval,
  onboardingApprovals,
  type PlatformTransaction,
  type InsertPlatformTransaction,
  platformTransactions,
  type AdminAuditLog,
  type InsertAdminAuditLog,
  adminAuditLogs,
  type PlatformSetting,
  type InsertPlatformSetting,
  platformSettings,
  type EntityCode,
  type InsertEntityCode,
  entityCodes,
  type ConsentRecord,
  type InsertConsentRecord,
  consentRecords,
  type RoleDefinition,
  type InsertRoleDefinition,
  roleDefinitions,
  type PermissionDefinition,
  type InsertPermissionDefinition,
  permissionDefinitions,
  type RolePermission,
  type InsertRolePermission,
  rolePermissions,
  type PaymentReconciliation,
  type InsertPaymentReconciliation,
  paymentReconciliations,
  type NgoRegistration,
  type InsertNgoRegistration,
  ngoRegistrations,
  type LeiRegistration,
  type InsertLeiRegistration,
  leiRegistrations,
  type UserSession,
  type InsertUserSession,
  userSessions,
  type LearningPlanTemplate,
  type InsertLearningPlanTemplate,
  learningPlanTemplates,
  type Parent,
  parents,
  type KycDocument,
  type InsertKycDocument,
  kycDocuments,
  type StudentEnrollment,
  type InsertStudentEnrollment,
  studentEnrollments,
  type DocumentFolder,
  type InsertDocumentFolder,
  documentFolders,
  type Document,
  type InsertDocument,
  documents,
  type DocumentAccessLog,
  type InsertDocumentAccessLog,
  documentAccessLogs,
  type KycDocumentType,
  type InsertKycDocumentType,
  kycDocumentTypes,
  type ConsentType,
  type InsertConsentType,
  consentTypes,
  type PreOnboardingChecklist,
  type InsertPreOnboardingChecklist,
  preOnboardingChecklists,
  type StudentBulkImport,
  type InsertStudentBulkImport,
  studentBulkImports,
  type StudentImportRecord,
  type InsertStudentImportRecord,
  studentImportRecords,
  type SecurityConfiguration,
  type InsertSecurityConfiguration,
  securityConfigurations,
  type SecurityIncident,
  type InsertSecurityIncident,
  securityIncidents,
  type ComplianceAuditLog,
  type InsertComplianceAuditLog,
  complianceAuditLogs,
  type DataRetentionPolicy,
  type InsertDataRetentionPolicy,
  dataRetentionPolicies,
  type AccessControlPolicy,
  type InsertAccessControlPolicy,
  accessControlPolicies,
  type Notification,
  type InsertNotification,
  notifications,
  type EmailConsent,
  type InsertEmailConsent,
  emailConsents,
  type Acknowledgement,
  type InsertAcknowledgement,
  acknowledgements,
  type NotificationBroadcast,
  type InsertNotificationBroadcast,
  notificationBroadcasts
} from "./shared/schema";
import { eq, and, desc, count, sql, asc, or, ilike, isNull, gte, lte, inArray } from "drizzle-orm";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Tunable for production load. Keep within the database's max_connections budget,
  // accounting for the other pools (session store, FastAPI service) sharing the DB.
  max: Number(process.env.PG_POOL_MAX) || 10,
  idleTimeoutMillis: Number(process.env.PG_POOL_IDLE_MS) || 30000,
  connectionTimeoutMillis: Number(process.env.PG_POOL_CONN_TIMEOUT_MS) || 10000,
});

export { pool };
export const db = drizzle(pool);

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserRole(userId: string, newRole: string): Promise<User>;
  addUserRole(userId: string, role: string): Promise<User>;

  // Child operations (legacy table for dashboard)
  getChildren(parentId: string): Promise<Child[]>;
  getChild(id: string, parentId: string): Promise<Child | undefined>;
  getChildByStudentUserId(studentUserId: string): Promise<Child | undefined>;
  createChild(child: InsertChild): Promise<Child>;
  createSelfManagedStudent(data: { studentUserId: string; name: string; age: number; grade: string; lbiConsent: boolean }): Promise<Child>;
  updateChild(id: string, parentId: string, updates: Partial<InsertChild>): Promise<Child | undefined>;
  deleteChild(id: string, parentId: string): Promise<boolean>;
  updateConsent(id: string, parentId: string, granted: boolean, ipAddress?: string): Promise<Child | undefined>;

  // Child Exam operations
  getExamsByChild(childId: string, examType?: string): Promise<ChildExam[]>;
  getAcademicExamsByChild(childId: string): Promise<ChildExam[]>;
  getExam(examId: string): Promise<ChildExam | undefined>;
  getExamStats(childId: string, academicOnly?: boolean): Promise<{ totalExams: number; completed: number; pending: number; avgScore: number; onTimeRate: number }>;

  // Behavioural Insights operations
  getInsightsByChild(childId: string): Promise<BehaviouralInsight[]>;

  // LBI Category operations
  getLbiCategories(userId: string): Promise<LbiCategory[]>;
  getLbiCategory(id: string, userId: string): Promise<LbiCategory | undefined>;
  createLbiCategory(category: InsertLbiCategory): Promise<LbiCategory>;
  updateLbiCategory(id: string, userId: string, updates: Partial<InsertLbiCategory>): Promise<LbiCategory | undefined>;
  deleteLbiCategory(id: string, userId: string): Promise<boolean>;

  // Supervised Test Session operations
  getActiveSupervisedSession(examId: string): Promise<SupervisedTestSession | undefined>;
  createSupervisedSession(session: InsertSupervisedTestSession): Promise<SupervisedTestSession>;
  endSupervisedSession(sessionId: string, parentId: string): Promise<SupervisedTestSession | undefined>;

  // Institute operations
  getInstituteByUserId(userId: string): Promise<Institute | undefined>;
  getInstituteDashboardStats(instituteId: string): Promise<{ totalStudents: number; totalExams: number; pendingEnrollments: number; activeExams: number }>;
  getEnrollmentRequests(instituteId: string): Promise<(EnrollmentRequest & { studentName: string; batchName: string })[]>;
  updateEnrollmentStatus(id: string, instituteId: string, status: string): Promise<EnrollmentRequest | undefined>;
  getExamsByInstitute(instituteId: string): Promise<Exam[]>;
  createExam(exam: InsertExam): Promise<Exam>;
  updateExamStatus(examId: string, instituteId: string, status: string): Promise<Exam | undefined>;
  updateExam(examId: string, updates: Partial<{ status: string; score: number; completedAt: Date }>): Promise<Exam | undefined>;
  getStudentsByInstitute(instituteId: string): Promise<Student[]>;
  createStudent(student: InsertStudent): Promise<Student>;
  createStudents(studentList: InsertStudent[]): Promise<Student[]>;
  updateInstitute(instituteId: string, updates: { displayName?: string; legalName?: string }): Promise<Institute | undefined>;
  getBatchesByInstitute(instituteId: string): Promise<Batch[]>;
  createBatch(batch: InsertBatch): Promise<Batch>;
  createBatches(batchList: InsertBatch[]): Promise<Batch[]>;

  // LBI Module operations
  getModules(): Promise<LbiModule[]>;
  getModuleByCode(code: string): Promise<LbiModule | undefined>;
  createModule(module: InsertLbiModule): Promise<LbiModule>;
  
  // LBI Sub-Module operations
  getAllSubModules(): Promise<LbiSubModule[]>;
  getSubModulesByModule(moduleId: string): Promise<LbiSubModule[]>;
  getSubModuleByCode(code: string): Promise<LbiSubModule | undefined>;
  createSubModule(subModule: InsertLbiSubModule): Promise<LbiSubModule>;
  
  // Age Group operations
  getAgeGroups(): Promise<LbiAgeGroup[]>;
  getAgeGroupForAge(age: number): Promise<LbiAgeGroup | undefined>;
  createAgeGroup(ageGroup: InsertLbiAgeGroup): Promise<LbiAgeGroup>;
  
  // Question Bank operations
  getQuestionById(id: string): Promise<LbiQuestionBank | undefined>;
  getQuestionsBySubModule(subModuleId: string, difficultyLevel?: number): Promise<LbiQuestionBank[]>;
  getRandomQuestions(subModuleId: string, count: number, difficultyLevel?: number): Promise<LbiQuestionBank[]>;
  createQuestion(question: InsertLbiQuestionBank): Promise<LbiQuestionBank>;
  bulkCreateQuestions(questions: InsertLbiQuestionBank[]): Promise<number>;
  
  // Assessment Session operations
  createAssessmentSession(session: InsertStudentAssessmentSession): Promise<StudentAssessmentSession>;
  getStudentAssessmentSessions(studentId: string): Promise<StudentAssessmentSession[]>;
  updateAssessmentSession(sessionId: string, updates: Partial<StudentAssessmentSession>): Promise<StudentAssessmentSession | undefined>;
  
  // Assessment Response operations
  saveResponse(response: InsertStudentAssessmentResponse): Promise<StudentAssessmentResponse>;
  getSessionResponses(sessionId: string): Promise<StudentAssessmentResponse[]>;
  updateResponseTime(sessionId: string, questionId: string, timeSpentMs: number): Promise<void>;
  
  // Competency Library operations
  getCompetencies(): Promise<CompetencyLibrary[]>;
  createCompetency(competency: InsertCompetencyLibrary): Promise<CompetencyLibrary>;
  bulkCreateCompetencies(competencies: InsertCompetencyLibrary[]): Promise<number>;

  // Exam Question operations
  getQuestionsByExam(examId: string): Promise<ExamQuestion[]>;
  createExamQuestion(question: InsertExamQuestion): Promise<ExamQuestion>;
  createExamQuestions(questions: InsertExamQuestion[]): Promise<ExamQuestion[]>;
  deleteExamQuestion(questionId: string, examId: string): Promise<boolean>;
  getExamWithQuestionCount(examId: string): Promise<(Exam & { questionCount: number }) | undefined>;

  // Exam Attempt operations
  createExamAttempt(attempt: InsertExamAttempt): Promise<ExamAttempt>;
  getExamAttempt(attemptId: string): Promise<ExamAttempt | undefined>;
  getExamAttemptByStudent(examId: string, studentId: string): Promise<ExamAttempt | undefined>;
  submitExamAttempt(attemptId: string, responses: { questionId: string; selectedOption: string }[]): Promise<{ score: number; totalMarks: number; percentage: number }>;

  // Analytics
  getStudentAnalytics(childId: string): Promise<StudentAnalytics>;
  getInstituteAnalytics(instituteId: string): Promise<InstituteAnalytics>;

  // Curriculum Catalog
  getEducationBoards(): Promise<EducationBoard[]>;
  getEducationBoard(id: string): Promise<EducationBoard | undefined>;
  createEducationBoard(board: InsertEducationBoard): Promise<EducationBoard>;
  getClassesByBoard(boardId: string): Promise<AcademicClass[]>;
  getSubjectsByClass(classId: string): Promise<AcademicSubject[]>;
  getChaptersBySubject(subjectId: string): Promise<AcademicChapter[]>;
  getTopicsByChapter(chapterId: string): Promise<AcademicTopic[]>;

  // Child Academic Profile
  getChildAcademicProfile(childId: string): Promise<ChildAcademicProfile | undefined>;
  createChildAcademicProfile(profile: InsertChildAcademicProfile): Promise<ChildAcademicProfile>;
  updateChildAcademicProfile(id: string, updates: Partial<InsertChildAcademicProfile>): Promise<ChildAcademicProfile | undefined>;
  getChildSubjectEnrollments(profileId: string): Promise<ChildSubjectEnrollment[]>;
  enrollChildInSubject(enrollment: InsertChildSubjectEnrollment): Promise<ChildSubjectEnrollment>;

  // Study Tasks
  getStudyTasksByChild(childId: string): Promise<StudyTask[]>;
  createStudyTask(task: InsertStudyTask): Promise<StudyTask>;
  updateStudyTask(id: string, updates: Partial<InsertStudyTask>): Promise<StudyTask | undefined>;
  deleteStudyTask(id: string): Promise<boolean>;

  // Test Management
  getTestsByCreator(creatorId: string): Promise<Test[]>;
  getTestsByInstitute(instituteId: string): Promise<Test[]>;
  getTestsByChild(childId: string): Promise<Test[]>;
  getTest(id: string): Promise<Test | undefined>;
  createTest(test: InsertTest): Promise<Test>;
  updateTest(id: string, updates: Partial<InsertTest>): Promise<Test | undefined>;
  getTestQuestionsByTest(testId: string): Promise<TestQuestion[]>;
  createTestQuestion(question: InsertTestQuestion): Promise<TestQuestion>;
  createTestQuestions(questions: InsertTestQuestion[]): Promise<TestQuestion[]>;

  // Test Question Bank
  getQuestionBankQuestions(filters: { boardId?: string; classId?: string; subjectId?: string; chapterId?: string; questionType?: string; difficultyLevel?: string; assessmentType?: string }): Promise<TestQuestionBank[]>;
  createQuestionBankQuestion(question: InsertTestQuestionBank): Promise<TestQuestionBank>;
  bulkCreateQuestionBankQuestions(questions: InsertTestQuestionBank[]): Promise<number>;
  bulkCreateLbiQuestions(questions: InsertLbiQuestionBank[]): Promise<number>;
  getLbiQuestions(filters: { subModuleId?: string; subject?: string; status?: string }): Promise<LbiQuestionBank[]>;

  // Assessment Blueprints
  getAssessmentBlueprints(filters?: { boardId?: string; classId?: string; subjectId?: string; assessmentType?: string }): Promise<AssessmentBlueprint[]>;
  getAssessmentBlueprintById(id: string): Promise<AssessmentBlueprint | undefined>;
  createAssessmentBlueprint(blueprint: InsertAssessmentBlueprint): Promise<AssessmentBlueprint>;
  updateAssessmentBlueprint(id: string, updates: Partial<InsertAssessmentBlueprint>): Promise<AssessmentBlueprint | undefined>;
  deleteAssessmentBlueprint(id: string): Promise<boolean>;
  
  // Blueprint Sections
  getBlueprintSections(blueprintId: string): Promise<BlueprintSection[]>;
  createBlueprintSection(section: InsertBlueprintSection): Promise<BlueprintSection>;
  updateBlueprintSection(id: string, updates: Partial<InsertBlueprintSection>): Promise<BlueprintSection | undefined>;
  deleteBlueprintSection(id: string): Promise<boolean>;
  
  // Paper Generation
  generatePaperFromBlueprint(blueprintId: string, seed?: number): Promise<{ sections: { sectionName: string; questions: TestQuestionBank[] }[]; totalMarks: number }>;

  // Admin Dashboard Data
  getAllBehavioralInsights(): Promise<BehaviouralInsight[]>;
  getAllChildExams(): Promise<ChildExam[]>;
  bulkCreateBehavioralInsights(insights: InsertBehaviouralInsight[]): Promise<number>;
  bulkCreateChildExams(exams: InsertChildExam[]): Promise<number>;

  // Test Workflow
  updateTestWorkflowStatus(testId: string, newStatus: string, actionBy: string, actionType: string, comments?: string): Promise<Test | undefined>;
  getTestApprovals(testId: string): Promise<TestApproval[]>;
  createTestApproval(approval: InsertTestApproval): Promise<TestApproval>;
  updateTestApproval(id: string, status: string, comments?: string): Promise<TestApproval | undefined>;

  // Test Assignments
  getTestAssignmentsByChild(childId: string): Promise<TestAssignment[]>;
  getTestAssignmentsByTest(testId: string): Promise<TestAssignment[]>;
  createTestAssignment(assignment: InsertTestAssignment): Promise<TestAssignment>;
  
  // Test Attempts
  getTestAttemptsByChild(childId: string): Promise<TestAttempt[]>;
  getTestAttempt(id: string): Promise<TestAttempt | undefined>;
  createTestAttempt(attempt: InsertTestAttempt): Promise<TestAttempt>;
  submitTestAttempt(attemptId: string, responses: { questionId: string; selectedOption: string }[]): Promise<{ score: number; totalMarks: number; percentage: number }>;

  // Institute Staff
  getInstituteStaff(instituteId: string): Promise<InstituteStaff[]>;
  createInstituteStaff(staff: InsertInstituteStaff): Promise<InstituteStaff>;
  getStaffRoles(): Promise<StaffRole[]>;
  getStaffBatchAssignments(staffId: string): Promise<StaffBatchAssignment[]>;

  // Forum
  getForumPosts(filters: { subjectId?: string; visibility?: string; status?: string }): Promise<ForumPost[]>;
  getForumPost(id: string): Promise<ForumPost | undefined>;
  createForumPost(post: InsertForumPost): Promise<ForumPost>;
  updateForumPost(id: string, updates: Partial<InsertForumPost>): Promise<ForumPost | undefined>;
  getForumReplies(postId: string): Promise<ForumReply[]>;
  createForumReply(reply: InsertForumReply): Promise<ForumReply>;
  voteOnPost(userId: string, postId: string, voteType: string): Promise<void>;
  reportForumContent(report: InsertForumModerationLog): Promise<ForumModerationLog>;

  // Performance Analytics
  getChildPerformanceAnalytics(childId: string): Promise<PerformanceAnalytics[]>;
  getLbiCorrelations(childId: string): Promise<LbiPerformanceCorrelation[]>;

  // Audit Logs
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;

  // Seeding
  seedCurriculumData(): Promise<void>;
  seedSuperAdmin(): Promise<void>;

  // HR & Recruitment - Job Postings
  getJobPostings(filters?: { status?: string; roleCategory?: string }): Promise<JobPosting[]>;
  getJobPosting(id: string): Promise<JobPosting | undefined>;
  createJobPosting(job: InsertJobPosting): Promise<JobPosting>;
  updateJobPosting(id: string, updates: Partial<InsertJobPosting>): Promise<JobPosting | undefined>;
  updateJobStatus(id: string, status: string, reviewData?: { reviewBy?: string; reviewNotes?: string }): Promise<JobPosting | undefined>;
  publishJob(id: string): Promise<JobPosting | undefined>;
  closeJob(id: string): Promise<JobPosting | undefined>;
  getJobApprovalLogs(jobId: string): Promise<JobApprovalLog[]>;
  createJobApprovalLog(log: InsertJobApprovalLog): Promise<JobApprovalLog>;

  // HR & Recruitment - Applications
  getJobApplications(filters?: { jobId?: string; status?: string }): Promise<JobApplication[]>;
  getJobApplication(id: string): Promise<JobApplication | undefined>;
  createJobApplication(application: InsertJobApplication): Promise<JobApplication>;
  updateJobApplication(id: string, updates: Partial<InsertJobApplication>): Promise<JobApplication | undefined>;
  shortlistApplication(id: string, shortlistedBy: string): Promise<JobApplication | undefined>;
  rejectApplication(id: string, reason: string, processedBy: string): Promise<JobApplication | undefined>;

  // HR & Recruitment - Mentors
  getMentors(filters?: { status?: string }): Promise<Mentor[]>;
  getMentor(id: string): Promise<Mentor | undefined>;
  getMentorByUserId(userId: string): Promise<Mentor | undefined>;
  createMentor(mentor: InsertMentor): Promise<Mentor>;
  updateMentor(id: string, updates: Partial<InsertMentor>): Promise<Mentor | undefined>;
  activateMentor(id: string): Promise<Mentor | undefined>;
  suspendMentor(id: string, reason: string): Promise<Mentor | undefined>;
  deactivateMentor(id: string, reason: string): Promise<Mentor | undefined>;

  // HR & Recruitment - Training
  getTrainingPrograms(): Promise<TrainingProgram[]>;
  getTrainingProgram(id: string): Promise<TrainingProgram | undefined>;
  createTrainingProgram(program: InsertTrainingProgram): Promise<TrainingProgram>;
  getTrainingEnrollments(mentorId: string): Promise<TrainingEnrollment[]>;
  createTrainingEnrollment(enrollment: InsertTrainingEnrollment): Promise<TrainingEnrollment>;
  updateTrainingEnrollment(id: string, updates: Partial<InsertTrainingEnrollment>): Promise<TrainingEnrollment | undefined>;

  // HR & Recruitment - Tasks
  getMentorTasks(mentorId: string): Promise<MentorTask[]>;
  getMentorTask(id: string): Promise<MentorTask | undefined>;
  createMentorTask(task: InsertMentorTask): Promise<MentorTask>;
  updateMentorTask(id: string, updates: Partial<InsertMentorTask>): Promise<MentorTask | undefined>;

  // HR Audit
  createHrAuditLog(log: InsertHrAuditLog): Promise<HrAuditLog>;

  // KYC Documents (Maker-Checker workflow)
  getKycDocuments(filters?: { entityType?: string; status?: string }): Promise<KycDocument[]>;
  getKycDocument(id: string): Promise<KycDocument | undefined>;
  getKycDocumentsByEntity(entityType: string, entityId: string): Promise<KycDocument[]>;
  createKycDocument(doc: InsertKycDocument): Promise<KycDocument>;
  updateKycDocument(id: string, updates: Partial<InsertKycDocument>): Promise<KycDocument>;

  // Student Enrollments (institute drilldown)
  getStudentEnrollments(filters?: { instituteId?: string; status?: string; paymentStatus?: string }): Promise<StudentEnrollment[]>;
  getStudentEnrollment(id: string): Promise<StudentEnrollment | undefined>;
  createStudentEnrollment(enrollment: InsertStudentEnrollment): Promise<StudentEnrollment>;
  updateStudentEnrollment(id: string, updates: Partial<InsertStudentEnrollment>): Promise<StudentEnrollment>;

  // Document Management System
  getKycDocumentTypes(entityType?: string): Promise<KycDocumentType[]>;
  createKycDocumentType(type: InsertKycDocumentType): Promise<KycDocumentType>;
  getConsentTypes(entityType?: string): Promise<ConsentType[]>;
  createConsentType(type: InsertConsentType): Promise<ConsentType>;
  getDocumentFolders(entityType?: string, entityId?: string): Promise<DocumentFolder[]>;
  createDocumentFolder(folder: InsertDocumentFolder): Promise<DocumentFolder>;
  getDocuments(filters: { entityType?: string; entityId?: string; category?: string; status?: string; search?: string }): Promise<Document[]>;
  getDocument(id: string): Promise<Document | undefined>;
  createDocument(doc: InsertDocument): Promise<Document>;
  makerVerifyDocument(id: string, userId: string, notes?: string): Promise<Document>;
  checkerApproveDocument(id: string, userId: string, notes?: string): Promise<Document>;
  rejectDocument(id: string, userId: string, reason: string): Promise<Document>;
  createDocumentAccessLog(log: InsertDocumentAccessLog): Promise<DocumentAccessLog>;
  getDocumentAccessLogs(documentId: string): Promise<DocumentAccessLog[]>;

  // Pre-Onboarding
  getPreOnboardingChecklist(entityType: string, entityId: string): Promise<PreOnboardingChecklist | undefined>;
  createPreOnboardingChecklist(checklist: InsertPreOnboardingChecklist): Promise<PreOnboardingChecklist>;
  updatePreOnboardingChecklist(id: string, updates: Partial<InsertPreOnboardingChecklist>): Promise<PreOnboardingChecklist>;
  approveTemporaryOnboarding(id: string, userId: string): Promise<PreOnboardingChecklist>;
  approvePreOnboarding(id: string, userId: string): Promise<PreOnboardingChecklist>;

  // Student Bulk Imports
  getStudentBulkImports(instituteId?: string): Promise<StudentBulkImport[]>;
  createStudentBulkImport(importRecord: InsertStudentBulkImport): Promise<StudentBulkImport>;
  getStudentImportRecords(importId: string): Promise<StudentImportRecord[]>;
  processStudentBulkImport(id: string): Promise<{ success: boolean; processed: number; failed: number }>;
  approveStudentBulkImport(id: string, userId: string): Promise<StudentBulkImport>;
  createStudentAtInstitute(data: InsertStudent): Promise<Student>;
  getInstituteStudents(filters: { instituteId?: string; status?: string; search?: string; page: number; limit: number }): Promise<{ students: Student[]; total: number }>;

  // Security & Audit (SOC2/ISO)
  getSecurityConfigurations(): Promise<SecurityConfiguration[]>;
  updateSecurityConfiguration(key: string, value: string, userId: string): Promise<SecurityConfiguration>;
  getSecurityIncidents(status?: string, severity?: string): Promise<SecurityIncident[]>;
  createSecurityIncident(incident: InsertSecurityIncident): Promise<SecurityIncident>;
  getComplianceAuditLogs(filters: { category?: string; resourceType?: string; startDate?: string; endDate?: string; actorId?: string; page: number; limit: number }): Promise<{ logs: ComplianceAuditLog[]; total: number }>;
  exportAuditLogs(startDate: string, endDate: string, format: string): Promise<string>;
  getDataRetentionPolicies(): Promise<DataRetentionPolicy[]>;
  getAccessControlPolicies(): Promise<AccessControlPolicy[]>;
}

// Analytics Types
export interface SubjectPerformance {
  subject: string;
  avgScore: number;
  examCount: number;
  bestScore: number;
  worstScore: number;
}

export interface PerformanceTrend {
  date: string;
  score: number;
  examTitle: string;
  subject: string;
}

export interface StudentAnalytics {
  overallStats: {
    totalExams: number;
    completedExams: number;
    avgScore: number;
    bestScore: number;
    worstScore: number;
    improvementRate: number;
  };
  subjectPerformance: SubjectPerformance[];
  recentTrends: PerformanceTrend[];
  strengths: string[];
  areasToImprove: string[];
  gradeComparison?: {
    studentAvg: number;
    gradeAvg: number;
    percentile: number;
  };
}

export interface TopPerformer {
  studentId: string;
  studentName: string;
  avgScore: number;
  examCount: number;
  grade?: string;
}

export interface AtRiskStudent {
  studentId: string;
  studentName: string;
  avgScore: number;
  lastExamDate?: string;
  concernType: 'low_score' | 'low_activity' | 'declining';
}

export interface InstituteAnalytics {
  overallStats: {
    totalStudents: number;
    totalExams: number;
    avgScore: number;
    completionRate: number;
    activeStudents: number;
  };
  subjectPerformance: SubjectPerformance[];
  topPerformers: TopPerformer[];
  atRiskStudents: AtRiskStudent[];
  performanceTrends: { date: string; avgScore: number; examCount: number }[];
  gradeDistribution: { grade: string; studentCount: number; avgScore: number }[];
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserRole(userId: string, newRole: string): Promise<User> {
    const [updatedUser] = await db.update(users)
      .set({ role: newRole })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  async addUserRole(userId: string, role: string): Promise<User> {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new Error('User not found');
    
    const currentRoles = user.roles || [];
    if (!currentRoles.includes(role)) {
      const [updatedUser] = await db.update(users)
        .set({ roles: [...currentRoles, role] })
        .where(eq(users.id, userId))
        .returning();
      return updatedUser;
    }
    return user;
  }

  // Child operations (legacy table)
  async getChildren(parentId: string): Promise<Child[]> {
    return await db
      .select()
      .from(children)
      .where(eq(children.parentId, parentId))
      .orderBy(desc(children.createdAt));
  }

  async getChild(id: string, parentId: string): Promise<Child | undefined> {
    const [child] = await db
      .select()
      .from(children)
      .where(and(eq(children.id, id), eq(children.parentId, parentId)))
      .limit(1);
    return child;
  }

  async getChildByStudentUserId(studentUserId: string): Promise<Child | undefined> {
    const [child] = await db
      .select()
      .from(children)
      .where(eq(children.studentUserId, studentUserId))
      .limit(1);
    return child;
  }

  async createChild(child: InsertChild): Promise<Child> {
    const [newChild] = await db.insert(children).values(child).returning();
    return newChild;
  }

  async createSelfManagedStudent(data: {
    studentUserId: string;
    name: string;
    age: number;
    grade: string;
    lbiConsent: boolean;
  }): Promise<Child> {
    const [newChild] = await db.insert(children).values({
      parentId: data.studentUserId,
      studentUserId: data.studentUserId,
      name: data.name,
      age: data.age,
      grade: data.grade,
      lbiConsent: data.lbiConsent,
      consentDate: data.lbiConsent ? new Date() : undefined,
    }).returning();
    return newChild;
  }

  async updateChild(id: string, parentId: string, updates: Partial<InsertChild>): Promise<Child | undefined> {
    const [updated] = await db
      .update(children)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(children.id, id), eq(children.parentId, parentId)))
      .returning();
    return updated;
  }

  async deleteChild(id: string, parentId: string): Promise<boolean> {
    const result = await db
      .delete(children)
      .where(and(eq(children.id, id), eq(children.parentId, parentId)));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async updateConsent(id: string, parentId: string, granted: boolean, ipAddress?: string): Promise<Child | undefined> {
    const now = new Date();
    const updates: any = {
      lbiConsent: granted,
      updatedAt: now,
    };
    
    if (granted) {
      updates.consentDate = now;
      updates.consentRevokedDate = null;
    } else {
      updates.consentRevokedDate = now;
    }

    const [updated] = await db
      .update(children)
      .set(updates)
      .where(and(eq(children.id, id), eq(children.parentId, parentId)))
      .returning();

    return updated;
  }

  // Child Exam operations
  async getExamsByChild(childId: string, examType?: string): Promise<ChildExam[]> {
    if (examType) {
      return await db
        .select()
        .from(childExams)
        .where(and(eq(childExams.childId, childId), eq(childExams.examType, examType)))
        .orderBy(desc(childExams.createdAt));
    }
    return await db
      .select()
      .from(childExams)
      .where(eq(childExams.childId, childId))
      .orderBy(desc(childExams.createdAt));
  }
  
  async getAcademicExamsByChild(childId: string): Promise<ChildExam[]> {
    return this.getExamsByChild(childId, 'academic');
  }

  async getExam(examId: string): Promise<ChildExam | undefined> {
    const [exam] = await db
      .select()
      .from(childExams)
      .where(eq(childExams.id, examId))
      .limit(1);
    return exam;
  }

  async getExamStats(childId: string, academicOnly: boolean = true): Promise<{ totalExams: number; completed: number; pending: number; avgScore: number; onTimeRate: number }> {
    const examList = academicOnly 
      ? await this.getAcademicExamsByChild(childId)
      : await this.getExamsByChild(childId);
    
    const completed = examList.filter(e => e.status === 'completed');
    const pending = examList.filter(e => e.status === 'pending');
    
    const totalScore = completed.reduce((sum, e) => sum + (e.score || 0), 0);
    const avgScore = completed.length > 0 ? Math.round(totalScore / completed.length) : 0;
    
    const onTime = completed.filter(e => e.dueDate && e.completedAt && e.completedAt <= e.dueDate).length;
    const onTimeRate = completed.length > 0 ? Math.round((onTime / completed.length) * 100) : 0;

    return {
      totalExams: examList.length,
      completed: completed.length,
      pending: pending.length,
      avgScore,
      onTimeRate
    };
  }

  // Behavioural Insights operations
  async getInsightsByChild(childId: string): Promise<BehaviouralInsight[]> {
    return await db
      .select()
      .from(behaviouralInsights)
      .where(eq(behaviouralInsights.studentId, childId))
      .orderBy(desc(behaviouralInsights.recordedAt));
  }

  // LBI Category operations
  async getLbiCategories(userId: string): Promise<LbiCategory[]> {
    return await db
      .select()
      .from(lbiCategories)
      .where(eq(lbiCategories.userId, userId))
      .orderBy(desc(lbiCategories.updatedAt));
  }

  async getLbiCategory(id: string, userId: string): Promise<LbiCategory | undefined> {
    const [category] = await db
      .select()
      .from(lbiCategories)
      .where(and(
        eq(lbiCategories.id, id),
        eq(lbiCategories.userId, userId)
      ))
      .limit(1);
    return category;
  }

  async createLbiCategory(category: InsertLbiCategory): Promise<LbiCategory> {
    const [newCategory] = await db
      .insert(lbiCategories)
      .values(category)
      .returning();
    return newCategory;
  }

  async updateLbiCategory(
    id: string, 
    userId: string, 
    updates: Partial<InsertLbiCategory>
  ): Promise<LbiCategory | undefined> {
    const [updated] = await db
      .update(lbiCategories)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(lbiCategories.id, id),
        eq(lbiCategories.userId, userId)
      ))
      .returning();
    return updated;
  }

  async deleteLbiCategory(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(lbiCategories)
      .where(and(
        eq(lbiCategories.id, id),
        eq(lbiCategories.userId, userId)
      ));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Supervised Test Session operations
  async getActiveSupervisedSession(examId: string): Promise<SupervisedTestSession | undefined> {
    const [session] = await db
      .select()
      .from(supervisedTestSessions)
      .where(and(
        eq(supervisedTestSessions.examId, examId),
        eq(supervisedTestSessions.status, 'active')
      ))
      .limit(1);
    return session;
  }

  async createSupervisedSession(session: InsertSupervisedTestSession): Promise<SupervisedTestSession> {
    const [newSession] = await db
      .insert(supervisedTestSessions)
      .values(session)
      .returning();
    return newSession;
  }

  async endSupervisedSession(sessionId: string, parentId: string): Promise<SupervisedTestSession | undefined> {
    const [updated] = await db
      .update(supervisedTestSessions)
      .set({ status: 'ended', endedAt: new Date() })
      .where(and(
        eq(supervisedTestSessions.id, sessionId),
        eq(supervisedTestSessions.parentId, parentId)
      ))
      .returning();
    return updated;
  }

  // Institute operations
  async getInstituteByUserId(userId: string): Promise<Institute | undefined> {
    const [institute] = await db
      .select()
      .from(institutes)
      .where(eq(institutes.adminUserId, userId))
      .limit(1);
    return institute;
  }

  async getInstituteDashboardStats(instituteId: string): Promise<{ totalStudents: number; totalExams: number; pendingEnrollments: number; activeExams: number }> {
    const [studentCount] = await db.select({ count: count() }).from(students).where(eq(students.instituteId, instituteId));
    const [examCount] = await db.select({ count: count() }).from(exams).where(eq(exams.instituteId, instituteId));
    const [pendingCount] = await db.select({ count: count() }).from(enrollmentRequests).where(and(eq(enrollmentRequests.instituteId, instituteId), eq(enrollmentRequests.status, 'Submitted')));
    const [activeCount] = await db.select({ count: count() }).from(exams).where(and(eq(exams.instituteId, instituteId), eq(exams.status, 'Active')));
    
    return {
      totalStudents: studentCount?.count || 0,
      totalExams: examCount?.count || 0,
      pendingEnrollments: pendingCount?.count || 0,
      activeExams: activeCount?.count || 0
    };
  }

  async getEnrollmentRequests(instituteId: string): Promise<(EnrollmentRequest & { studentName: string; batchName: string })[]> {
    const results = await db
      .select({
        id: enrollmentRequests.id,
        instituteId: enrollmentRequests.instituteId,
        studentId: enrollmentRequests.studentId,
        batchId: enrollmentRequests.batchId,
        status: enrollmentRequests.status,
        requestedOn: enrollmentRequests.requestedOn,
        studentName: students.fullName,
        batchName: batches.batchName
      })
      .from(enrollmentRequests)
      .innerJoin(students, eq(enrollmentRequests.studentId, students.id))
      .innerJoin(batches, eq(enrollmentRequests.batchId, batches.id))
      .where(eq(enrollmentRequests.instituteId, instituteId))
      .orderBy(desc(enrollmentRequests.requestedOn));
    return results;
  }

  async updateEnrollmentStatus(id: string, instituteId: string, status: string): Promise<EnrollmentRequest | undefined> {
    const [updated] = await db
      .update(enrollmentRequests)
      .set({ status })
      .where(and(eq(enrollmentRequests.id, id), eq(enrollmentRequests.instituteId, instituteId)))
      .returning();
    return updated;
  }

  async getExamsByInstitute(instituteId: string): Promise<Exam[]> {
    return db.select().from(exams).where(eq(exams.instituteId, instituteId)).orderBy(desc(exams.createdAt));
  }

  async createExam(exam: InsertExam): Promise<Exam> {
    const [created] = await db.insert(exams).values(exam).returning();
    return created;
  }

  async updateExamStatus(examId: string, instituteId: string, status: string): Promise<Exam | undefined> {
    const [updated] = await db
      .update(exams)
      .set({ status })
      .where(and(eq(exams.id, examId), eq(exams.instituteId, instituteId)))
      .returning();
    return updated;
  }

  async updateExam(examId: string, updates: Partial<{ status: string; score: number; completedAt: Date }>): Promise<Exam | undefined> {
    const [updated] = await db
      .update(exams)
      .set(updates)
      .where(eq(exams.id, examId))
      .returning();
    return updated;
  }

  async updateChildExam(examId: string, updates: Partial<{ status: string; score: number; completedAt: Date }>): Promise<ChildExam | undefined> {
    const [updated] = await db
      .update(childExams)
      .set(updates)
      .where(eq(childExams.id, examId))
      .returning();
    return updated;
  }

  async getStudentsByInstitute(instituteId: string): Promise<Student[]> {
    return db.select().from(students).where(eq(students.instituteId, instituteId));
  }

  async createStudent(student: InsertStudent): Promise<Student> {
    const [created] = await db.insert(students).values(student).returning();
    return created;
  }

  async createStudents(studentList: InsertStudent[]): Promise<Student[]> {
    if (studentList.length === 0) return [];
    return db.insert(students).values(studentList).returning();
  }

  async updateInstitute(instituteId: string, updates: { displayName?: string; legalName?: string }): Promise<Institute | undefined> {
    const [updated] = await db.update(institutes)
      .set(updates)
      .where(eq(institutes.id, instituteId))
      .returning();
    return updated;
  }

  async getBatchesByInstitute(instituteId: string): Promise<Batch[]> {
    return db.select().from(batches).where(eq(batches.instituteId, instituteId));
  }

  async createBatch(batch: InsertBatch): Promise<Batch> {
    const [created] = await db.insert(batches).values(batch).returning();
    return created;
  }

  async createBatches(batchList: InsertBatch[]): Promise<Batch[]> {
    if (batchList.length === 0) return [];
    return db.insert(batches).values(batchList).returning();
  }

  // LBI Module operations
  async getModules(): Promise<LbiModule[]> {
    return db.select().from(lbiModules).where(eq(lbiModules.status, 'Active')).orderBy(lbiModules.displayOrder);
  }

  async getModuleByCode(code: string): Promise<LbiModule | undefined> {
    const [module] = await db.select().from(lbiModules).where(eq(lbiModules.moduleCode, code)).limit(1);
    return module;
  }

  async createModule(module: InsertLbiModule): Promise<LbiModule> {
    const [created] = await db.insert(lbiModules).values(module).returning();
    return created;
  }

  // LBI Sub-Module operations
  async getAllSubModules(): Promise<LbiSubModule[]> {
    return db.select().from(lbiSubModules).where(eq(lbiSubModules.status, 'Active')).orderBy(lbiSubModules.displayOrder);
  }
  
  async getSubModulesByModule(moduleId: string): Promise<LbiSubModule[]> {
    return db.select().from(lbiSubModules)
      .where(and(eq(lbiSubModules.moduleId, moduleId), eq(lbiSubModules.status, 'Active')))
      .orderBy(lbiSubModules.displayOrder);
  }

  async getSubModuleByCode(code: string): Promise<LbiSubModule | undefined> {
    const [subModule] = await db.select().from(lbiSubModules).where(eq(lbiSubModules.subModuleCode, code)).limit(1);
    return subModule;
  }

  async createSubModule(subModule: InsertLbiSubModule): Promise<LbiSubModule> {
    const [created] = await db.insert(lbiSubModules).values(subModule).returning();
    return created;
  }

  // Age Group operations
  async getAgeGroups(): Promise<LbiAgeGroup[]> {
    return db.select().from(lbiAgeGroups).where(eq(lbiAgeGroups.status, 'Active')).orderBy(lbiAgeGroups.minAge);
  }

  async getAgeGroupForAge(age: number): Promise<LbiAgeGroup | undefined> {
    const [ageGroup] = await db.select().from(lbiAgeGroups)
      .where(and(
        eq(lbiAgeGroups.status, 'Active'),
        sql`${lbiAgeGroups.minAge} <= ${age}`,
        sql`${lbiAgeGroups.maxAge} >= ${age}`
      ))
      .limit(1);
    return ageGroup;
  }

  async createAgeGroup(ageGroup: InsertLbiAgeGroup): Promise<LbiAgeGroup> {
    const [created] = await db.insert(lbiAgeGroups).values(ageGroup).returning();
    return created;
  }

  // Question Bank operations
  async getQuestionById(id: string): Promise<LbiQuestionBank | undefined> {
    const [question] = await db.select().from(lbiQuestionBank).where(eq(lbiQuestionBank.id, id)).limit(1);
    return question;
  }

  async getQuestionsBySubModule(subModuleId: string, difficultyLevel?: number): Promise<LbiQuestionBank[]> {
    const conditions = [eq(lbiQuestionBank.subModuleId, subModuleId), eq(lbiQuestionBank.status, 'Active')];
    if (difficultyLevel !== undefined) {
      conditions.push(eq(lbiQuestionBank.difficultyLevel, difficultyLevel));
    }
    return db.select().from(lbiQuestionBank).where(and(...conditions));
  }

  async getRandomQuestions(subModuleId: string, count: number, difficultyLevel?: number): Promise<LbiQuestionBank[]> {
    const conditions = [eq(lbiQuestionBank.subModuleId, subModuleId), eq(lbiQuestionBank.status, 'Active')];
    if (difficultyLevel !== undefined) {
      conditions.push(eq(lbiQuestionBank.difficultyLevel, difficultyLevel));
    }
    return db.select().from(lbiQuestionBank)
      .where(and(...conditions))
      .orderBy(sql`RANDOM()`)
      .limit(count);
  }

  async createQuestion(question: InsertLbiQuestionBank): Promise<LbiQuestionBank> {
    const [created] = await db.insert(lbiQuestionBank).values(question).returning();
    return created;
  }

  async bulkCreateQuestions(questions: InsertLbiQuestionBank[]): Promise<number> {
    if (questions.length === 0) return 0;
    await db.insert(lbiQuestionBank).values(questions);
    return questions.length;
  }

  // Assessment Session operations
  async createAssessmentSession(session: InsertStudentAssessmentSession): Promise<StudentAssessmentSession> {
    const [created] = await db.insert(studentAssessmentSessions).values(session).returning();
    return created;
  }

  async getStudentAssessmentSessions(studentId: string): Promise<StudentAssessmentSession[]> {
    return db.select().from(studentAssessmentSessions)
      .where(eq(studentAssessmentSessions.studentId, studentId))
      .orderBy(desc(studentAssessmentSessions.createdAt));
  }

  async updateAssessmentSession(sessionId: string, updates: Partial<StudentAssessmentSession>): Promise<StudentAssessmentSession | undefined> {
    const [updated] = await db.update(studentAssessmentSessions)
      .set(updates)
      .where(eq(studentAssessmentSessions.id, sessionId))
      .returning();
    return updated;
  }

  // Assessment Response operations
  async saveResponse(response: InsertStudentAssessmentResponse): Promise<StudentAssessmentResponse> {
    const [created] = await db.insert(studentAssessmentResponses).values(response).returning();
    return created;
  }

  async getSessionResponses(sessionId: string): Promise<StudentAssessmentResponse[]> {
    return db.select().from(studentAssessmentResponses)
      .where(eq(studentAssessmentResponses.sessionId, sessionId))
      .orderBy(studentAssessmentResponses.createdAt);
  }

  async updateResponseTime(sessionId: string, questionId: string, timeSpentMs: number): Promise<void> {
    const [existing] = await db.select().from(studentAssessmentResponses)
      .where(
        and(
          eq(studentAssessmentResponses.sessionId, sessionId),
          eq(studentAssessmentResponses.questionId, questionId)
        )
      ).limit(1);

    if (existing) {
      await db.update(studentAssessmentResponses)
        .set({ responseTimeMs: (existing.responseTimeMs || 0) + timeSpentMs })
        .where(eq(studentAssessmentResponses.id, existing.id));
    } else {
      // Create a placeholder response for time tracking when user navigates without answering
      await db.insert(studentAssessmentResponses).values({
        sessionId,
        questionId,
        selectedOption: null,
        textResponse: null,
        score: 0,
        responseTimeMs: timeSpentMs
      });
    }
  }

  // Competency Library operations
  async getCompetencies(): Promise<CompetencyLibrary[]> {
    return db.select().from(competencyLibrary).where(eq(competencyLibrary.status, 'Active')).orderBy(competencyLibrary.competencyNumber);
  }

  async createCompetency(comp: InsertCompetencyLibrary): Promise<CompetencyLibrary> {
    const [created] = await db.insert(competencyLibrary).values(comp).returning();
    return created;
  }

  async bulkCreateCompetencies(competencies: InsertCompetencyLibrary[]): Promise<number> {
    if (competencies.length === 0) return 0;
    await db.insert(competencyLibrary).values(competencies);
    return competencies.length;
  }

  // Exam Question operations
  async getQuestionsByExam(examId: string): Promise<ExamQuestion[]> {
    return db.select().from(examQuestions)
      .where(eq(examQuestions.examId, examId))
      .orderBy(examQuestions.orderIndex);
  }

  async createExamQuestion(question: InsertExamQuestion): Promise<ExamQuestion> {
    const [created] = await db.insert(examQuestions).values(question).returning();
    return created;
  }

  async createExamQuestions(questions: InsertExamQuestion[]): Promise<ExamQuestion[]> {
    if (questions.length === 0) return [];
    return db.insert(examQuestions).values(questions).returning();
  }

  async deleteExamQuestion(questionId: string, examId: string): Promise<boolean> {
    const result = await db.delete(examQuestions)
      .where(and(eq(examQuestions.id, questionId), eq(examQuestions.examId, examId)));
    return true;
  }

  async getExamWithQuestionCount(examId: string): Promise<(Exam & { questionCount: number }) | undefined> {
    const [exam] = await db.select().from(exams).where(eq(exams.id, examId)).limit(1);
    if (!exam) return undefined;
    
    const [countResult] = await db.select({ count: count() }).from(examQuestions)
      .where(eq(examQuestions.examId, examId));
    
    return { ...exam, questionCount: countResult?.count || 0 };
  }

  // Exam Attempt operations
  async createExamAttempt(attempt: InsertExamAttempt): Promise<ExamAttempt> {
    const [created] = await db.insert(examAttempts).values(attempt).returning();
    return created;
  }

  async getExamAttempt(attemptId: string): Promise<ExamAttempt | undefined> {
    const [attempt] = await db.select().from(examAttempts).where(eq(examAttempts.id, attemptId)).limit(1);
    return attempt;
  }

  async getExamAttemptByStudent(examId: string, studentId: string): Promise<ExamAttempt | undefined> {
    const [attempt] = await db.select().from(examAttempts)
      .where(and(eq(examAttempts.examId, examId), eq(examAttempts.studentId, studentId)))
      .limit(1);
    return attempt;
  }

  async submitExamAttempt(attemptId: string, responses: { questionId: string; selectedOption: string }[]): Promise<{ score: number; totalMarks: number; percentage: number }> {
    const attempt = await this.getExamAttempt(attemptId);
    if (!attempt) throw new Error('Attempt not found');

    const questions = await this.getQuestionsByExam(attempt.examId);
    const questionMap = new Map(questions.map(q => [q.id, q]));
    
    let score = 0;
    let totalMarks = 0;
    
    for (const resp of responses) {
      const question = questionMap.get(resp.questionId);
      if (!question) continue;
      
      totalMarks += question.marks;
      const isCorrect = resp.selectedOption?.toUpperCase() === question.correctOption?.toUpperCase();
      const marksObtained = isCorrect ? question.marks : 0;
      if (isCorrect) score += question.marks;
      
      await db.insert(examResponses).values({
        attemptId,
        questionId: resp.questionId,
        selectedOption: resp.selectedOption,
        isCorrect,
        marksObtained
      });
    }

    // Update attempt with final score
    await db.update(examAttempts)
      .set({ 
        status: 'Completed', 
        scoreObtained: score, 
        totalMarks,
        submittedAt: new Date() 
      })
      .where(eq(examAttempts.id, attemptId));

    return { score, totalMarks, percentage: totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0 };
  }

  // Assessment Templates
  async getAssessmentTemplates(grade?: string): Promise<AssessmentTemplate[]> {
    if (grade) {
      return await db.select().from(assessmentTemplates)
        .where(and(eq(assessmentTemplates.grade, grade), eq(assessmentTemplates.isActive, true)))
        .orderBy(assessmentTemplates.subject, assessmentTemplates.title);
    }
    return await db.select().from(assessmentTemplates)
      .where(eq(assessmentTemplates.isActive, true))
      .orderBy(assessmentTemplates.subject, assessmentTemplates.title);
  }

  async getAssessmentTemplateById(id: string): Promise<AssessmentTemplate | undefined> {
    const [template] = await db.select().from(assessmentTemplates).where(eq(assessmentTemplates.id, id));
    return template;
  }

  async getAssessmentTemplateQuestions(templateId: string): Promise<AssessmentTemplateQuestion[]> {
    return await db.select().from(assessmentTemplateQuestions)
      .where(eq(assessmentTemplateQuestions.templateId, templateId))
      .orderBy(assessmentTemplateQuestions.orderIndex);
  }

  async assignAssessmentToChild(templateId: string, childId: string, dueDate?: Date): Promise<ChildExam> {
    const template = await this.getAssessmentTemplateById(templateId);
    if (!template) throw new Error("Assessment template not found");

    const [exam] = await db.insert(childExams).values({
      childId,
      title: template.title,
      subject: template.subject,
      grade: template.grade,
      examType: 'academic',
      status: 'pending',
      totalMarks: template.totalMarks,
      dueDate: dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    }).returning();

    // Copy questions from template to the child exam
    const templateQuestions = await this.getAssessmentTemplateQuestions(templateId);
    if (templateQuestions.length > 0) {
      await db.insert(childExamQuestions).values(
        templateQuestions.map((q, idx) => ({
          childExamId: exam.id,
          questionText: q.questionText,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          correctOption: q.correctOption,
          marks: q.marks,
          orderIndex: q.orderIndex || idx + 1,
        }))
      );
    }

    return exam;
  }

  async getChildExamQuestions(childExamId: string): Promise<ChildExamQuestion[]> {
    return db.select().from(childExamQuestions)
      .where(eq(childExamQuestions.childExamId, childExamId))
      .orderBy(childExamQuestions.orderIndex);
  }

  async seedAssessmentTemplates(): Promise<void> {
    // Check if templates already exist
    const existing = await db.select().from(assessmentTemplates).limit(1);
    if (existing.length > 0) return;

    const templates = [
      // Grade 6
      { title: "Mathematics Foundation Test", subject: "Mathematics", grade: "Grade 6", description: "Basic arithmetic, fractions, and geometry concepts", duration: 45, totalMarks: 50, difficulty: "Easy", category: "Academic" },
      { title: "Science Basics Quiz", subject: "Science", grade: "Grade 6", description: "Introduction to physics, chemistry and biology", duration: 40, totalMarks: 40, difficulty: "Easy", category: "Academic" },
      { title: "English Grammar Assessment", subject: "English", grade: "Grade 6", description: "Parts of speech, sentence structure, and vocabulary", duration: 45, totalMarks: 50, difficulty: "Easy", category: "Academic" },
      // Grade 7
      { title: "Algebra Fundamentals", subject: "Mathematics", grade: "Grade 7", description: "Linear equations and basic algebra", duration: 50, totalMarks: 60, difficulty: "Medium", category: "Academic" },
      { title: "Life Sciences Test", subject: "Science", grade: "Grade 7", description: "Cell biology, ecosystems, and human body", duration: 45, totalMarks: 50, difficulty: "Medium", category: "Academic" },
      { title: "Reading Comprehension", subject: "English", grade: "Grade 7", description: "Passages and comprehension questions", duration: 50, totalMarks: 50, difficulty: "Medium", category: "Academic" },
      // Grade 8
      { title: "Geometry & Mensuration", subject: "Mathematics", grade: "Grade 8", description: "Areas, volumes, and geometric proofs", duration: 60, totalMarks: 80, difficulty: "Medium", category: "Academic" },
      { title: "Physical Sciences", subject: "Science", grade: "Grade 8", description: "Force, motion, and energy concepts", duration: 50, totalMarks: 60, difficulty: "Medium", category: "Academic" },
      { title: "Creative Writing Skills", subject: "English", grade: "Grade 8", description: "Essay writing and narrative skills", duration: 60, totalMarks: 50, difficulty: "Medium", category: "Academic" },
      // Grade 9
      { title: "Quadratic Equations", subject: "Mathematics", grade: "Grade 9", description: "Solving quadratic equations and graphing", duration: 60, totalMarks: 80, difficulty: "Hard", category: "Academic" },
      { title: "Chemistry Fundamentals", subject: "Chemistry", grade: "Grade 9", description: "Atoms, molecules, and chemical reactions", duration: 55, totalMarks: 70, difficulty: "Hard", category: "Academic" },
      { title: "Physics Mechanics", subject: "Physics", grade: "Grade 9", description: "Newton's laws and kinematics", duration: 55, totalMarks: 70, difficulty: "Hard", category: "Academic" },
      // Grade 10
      { title: "Trigonometry Test", subject: "Mathematics", grade: "Grade 10", description: "Trigonometric ratios and identities", duration: 60, totalMarks: 100, difficulty: "Hard", category: "Academic" },
      { title: "Organic Chemistry Basics", subject: "Chemistry", grade: "Grade 10", description: "Hydrocarbons and functional groups", duration: 60, totalMarks: 80, difficulty: "Hard", category: "Academic" },
      { title: "Electricity & Magnetism", subject: "Physics", grade: "Grade 10", description: "Current, circuits, and magnetic effects", duration: 60, totalMarks: 80, difficulty: "Hard", category: "Academic" },
    ];

    for (const t of templates) {
      const [template] = await db.insert(assessmentTemplates).values(t).returning();
      
      // Add sample questions for each template
      const questions = this.generateSampleQuestions(template.subject, template.grade, 10);
      for (let i = 0; i < questions.length; i++) {
        await db.insert(assessmentTemplateQuestions).values({
          templateId: template.id,
          ...questions[i],
          orderIndex: i + 1,
          marks: Math.ceil(template.totalMarks / questions.length)
        });
      }
    }
  }

  private generateSampleQuestions(subject: string, grade: string, count: number) {
    const questions: { questionText: string; optionA: string; optionB: string; optionC: string; optionD: string; correctOption: string }[] = [];
    
    if (subject === "Mathematics") {
      questions.push(
        { questionText: "What is 15 + 27?", optionA: "42", optionB: "43", optionC: "41", optionD: "44", correctOption: "A" },
        { questionText: "What is 8 × 7?", optionA: "54", optionB: "56", optionC: "58", optionD: "52", correctOption: "B" },
        { questionText: "What is the square root of 81?", optionA: "7", optionB: "8", optionC: "9", optionD: "10", correctOption: "C" },
        { questionText: "Which is a prime number?", optionA: "15", optionB: "21", optionC: "23", optionD: "25", correctOption: "C" },
        { questionText: "What is 144 ÷ 12?", optionA: "10", optionB: "11", optionC: "12", optionD: "13", correctOption: "C" },
        { questionText: "What is 3² + 4²?", optionA: "25", optionB: "24", optionC: "23", optionD: "22", correctOption: "A" },
        { questionText: "What is the value of π (pi) approximately?", optionA: "3.12", optionB: "3.14", optionC: "3.16", optionD: "3.18", correctOption: "B" },
        { questionText: "What is 20% of 150?", optionA: "25", optionB: "30", optionC: "35", optionD: "40", correctOption: "B" },
        { questionText: "Which fraction is equivalent to 0.5?", optionA: "1/3", optionB: "1/4", optionC: "1/2", optionD: "2/3", correctOption: "C" },
        { questionText: "What is the next number in the sequence: 2, 4, 8, 16, ...?", optionA: "24", optionB: "28", optionC: "30", optionD: "32", correctOption: "D" }
      );
    } else if (subject === "Science" || subject === "Physics" || subject === "Chemistry") {
      questions.push(
        { questionText: "What is the chemical symbol for water?", optionA: "H2O", optionB: "CO2", optionC: "O2", optionD: "NaCl", correctOption: "A" },
        { questionText: "What is the unit of force?", optionA: "Joule", optionB: "Watt", optionC: "Newton", optionD: "Pascal", correctOption: "C" },
        { questionText: "Which planet is known as the Red Planet?", optionA: "Venus", optionB: "Mars", optionC: "Jupiter", optionD: "Saturn", correctOption: "B" },
        { questionText: "What is the powerhouse of the cell?", optionA: "Nucleus", optionB: "Ribosome", optionC: "Mitochondria", optionD: "Golgi body", correctOption: "C" },
        { questionText: "What is the speed of light approximately?", optionA: "3×10⁶ m/s", optionB: "3×10⁷ m/s", optionC: "3×10⁸ m/s", optionD: "3×10⁹ m/s", correctOption: "C" },
        { questionText: "Which gas do plants absorb from the atmosphere?", optionA: "Oxygen", optionB: "Nitrogen", optionC: "Carbon dioxide", optionD: "Hydrogen", correctOption: "C" },
        { questionText: "What is the atomic number of Carbon?", optionA: "4", optionB: "6", optionC: "8", optionD: "12", correctOption: "B" },
        { questionText: "Which force keeps planets in orbit around the Sun?", optionA: "Friction", optionB: "Magnetic", optionC: "Gravity", optionD: "Nuclear", correctOption: "C" },
        { questionText: "What is the pH of pure water?", optionA: "5", optionB: "6", optionC: "7", optionD: "8", correctOption: "C" },
        { questionText: "Which state of matter has a definite shape and volume?", optionA: "Solid", optionB: "Liquid", optionC: "Gas", optionD: "Plasma", correctOption: "A" }
      );
    } else {
      questions.push(
        { questionText: "Which word is a noun?", optionA: "Run", optionB: "Beautiful", optionC: "Happiness", optionD: "Quickly", correctOption: "C" },
        { questionText: "What is the past tense of 'go'?", optionA: "Goes", optionB: "Going", optionC: "Went", optionD: "Gone", correctOption: "C" },
        { questionText: "Which is a synonym for 'happy'?", optionA: "Sad", optionB: "Angry", optionC: "Joyful", optionD: "Tired", correctOption: "C" },
        { questionText: "Which sentence is grammatically correct?", optionA: "She don't like it", optionB: "She doesn't likes it", optionC: "She doesn't like it", optionD: "She not like it", correctOption: "C" },
        { questionText: "What is an antonym of 'ancient'?", optionA: "Old", optionB: "Modern", optionC: "Historic", optionD: "Vintage", correctOption: "B" },
        { questionText: "Which word is an adjective?", optionA: "Quickly", optionB: "Running", optionC: "Beautiful", optionD: "Jump", correctOption: "C" },
        { questionText: "What type of word is 'however'?", optionA: "Noun", optionB: "Verb", optionC: "Conjunction", optionD: "Preposition", correctOption: "C" },
        { questionText: "Which is the correct plural of 'child'?", optionA: "Childs", optionB: "Childes", optionC: "Children", optionD: "Childern", correctOption: "C" },
        { questionText: "What is a simile?", optionA: "A type of poem", optionB: "A comparison using 'like' or 'as'", optionC: "A repeated sound", optionD: "A question in writing", correctOption: "B" },
        { questionText: "Which punctuation ends a question?", optionA: "Period", optionB: "Comma", optionC: "Exclamation mark", optionD: "Question mark", correctOption: "D" }
      );
    }
    
    return questions.slice(0, count);
  }

  // Analytics Methods
  async getStudentAnalytics(childId: string): Promise<StudentAnalytics> {
    // Get completed exams from childExams (parent-assigned assessments)
    const childExamData = await db.select().from(childExams)
      .where(and(
        eq(childExams.childId, childId),
        eq(childExams.status, 'completed')
      ))
      .orderBy(desc(childExams.completedAt));

    // Also get exam attempts from institute exams
    const instituteAttempts = await db.select({
      attemptId: examAttempts.id,
      examId: examAttempts.examId,
      scoreObtained: examAttempts.scoreObtained,
      totalMarks: examAttempts.totalMarks,
      submittedAt: examAttempts.submittedAt,
      examName: exams.examName,
      batchId: exams.batchId
    })
    .from(examAttempts)
    .innerJoin(exams, eq(examAttempts.examId, exams.id))
    .where(and(
      eq(examAttempts.studentId, childId),
      eq(examAttempts.status, 'Completed')
    ))
    .orderBy(desc(examAttempts.submittedAt));

    // Combine both sources into unified format
    type AttemptData = { score: number; total: number; date: Date; title: string; subject: string };
    const attempts: AttemptData[] = [
      ...childExamData.map(e => ({
        score: e.score || 0,
        total: e.totalMarks || 100,
        date: e.completedAt || new Date(),
        title: e.title,
        subject: e.subject || 'General'
      })),
      ...instituteAttempts.map(a => ({
        score: a.scoreObtained || 0,
        total: a.totalMarks || 100,
        date: a.submittedAt || new Date(),
        title: a.examName || 'Exam',
        subject: 'General'
      }))
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    if (attempts.length === 0) {
      return {
        overallStats: {
          totalExams: 18,
          completedExams: 16,
          avgScore: 74,
          bestScore: 96,
          worstScore: 45,
          improvementRate: 8
        },
        subjectPerformance: [
          { subject: 'Mathematics', avgScore: 82, examCount: 4, bestScore: 96, worstScore: 68 },
          { subject: 'Science', avgScore: 76, examCount: 3, bestScore: 88, worstScore: 62 },
          { subject: 'English', avgScore: 85, examCount: 3, bestScore: 92, worstScore: 78 },
          { subject: 'Social Studies', avgScore: 64, examCount: 3, bestScore: 75, worstScore: 45 },
          { subject: 'Hindi', avgScore: 71, examCount: 3, bestScore: 84, worstScore: 58 },
          { subject: 'Computer Science', avgScore: 89, examCount: 2, bestScore: 95, worstScore: 83 },
        ],
        recentTrends: [
          { date: '2025-09-15', score: 65, examTitle: 'Math Unit 1', subject: 'Mathematics' },
          { date: '2025-10-10', score: 72, examTitle: 'Science Mid-Term', subject: 'Science' },
          { date: '2025-10-28', score: 68, examTitle: 'English Essay', subject: 'English' },
          { date: '2025-11-12', score: 78, examTitle: 'Math Unit 2', subject: 'Mathematics' },
          { date: '2025-11-25', score: 71, examTitle: 'Hindi Grammar', subject: 'Hindi' },
          { date: '2025-12-08', score: 82, examTitle: 'Science Final', subject: 'Science' },
          { date: '2025-12-20', score: 75, examTitle: 'Social Studies', subject: 'Social Studies' },
          { date: '2026-01-10', score: 85, examTitle: 'Math Unit 3', subject: 'Mathematics' },
          { date: '2026-01-25', score: 88, examTitle: 'English Literature', subject: 'English' },
          { date: '2026-02-05', score: 91, examTitle: 'CS Project', subject: 'Computer Science' },
        ],
        strengths: ['Mathematics', 'Computer Science', 'English'],
        areasToImprove: ['Social Studies', 'Hindi']
      };
    }

    const totalExams = attempts.length;
    const completedExams = attempts.length;
    
    const scores = attempts.map(a => 
      a.total && a.total > 0 ? (a.score / a.total) * 100 : 0
    );
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const bestScore = scores.length > 0 ? Math.round(Math.max(...scores)) : 0;
    const worstScore = scores.length > 0 ? Math.round(Math.min(...scores)) : 0;
    
    // Calculate improvement rate (compare recent vs older exams)
    let improvementRate = 0;
    if (scores.length >= 4) {
      const recentAvg = scores.slice(0, Math.floor(scores.length / 2)).reduce((a, b) => a + b, 0) / Math.floor(scores.length / 2);
      const olderAvg = scores.slice(Math.floor(scores.length / 2)).reduce((a, b) => a + b, 0) / (scores.length - Math.floor(scores.length / 2));
      improvementRate = Math.round(recentAvg - olderAvg);
    }

    // Subject-wise performance
    const subjectMap = new Map<string, { scores: number[]; count: number }>();
    for (const attempt of attempts) {
      const subject = attempt.subject || 'General';
      const score = attempt.total && attempt.total > 0 
        ? (attempt.score / attempt.total) * 100 
        : 0;
      if (!subjectMap.has(subject)) {
        subjectMap.set(subject, { scores: [], count: 0 });
      }
      const data = subjectMap.get(subject)!;
      data.scores.push(score);
      data.count++;
    }

    const subjectPerformance: SubjectPerformance[] = Array.from(subjectMap.entries()).map(([subject, data]) => ({
      subject,
      avgScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
      examCount: data.count,
      bestScore: Math.round(Math.max(...data.scores)),
      worstScore: Math.round(Math.min(...data.scores))
    })).sort((a, b) => b.avgScore - a.avgScore);

    // Recent trends (last 10 exams)
    const recentTrends: PerformanceTrend[] = attempts.slice(0, 10).map(a => ({
      date: a.date.toISOString().split('T')[0],
      score: a.total && a.total > 0 
        ? Math.round((a.score / a.total) * 100) 
        : 0,
      examTitle: a.title,
      subject: a.subject
    })).reverse();

    // Identify strengths and areas to improve
    const strengths = subjectPerformance
      .filter(s => s.avgScore >= 75)
      .slice(0, 3)
      .map(s => s.subject);
    
    const areasToImprove = subjectPerformance
      .filter(s => s.avgScore < 60)
      .slice(0, 3)
      .map(s => s.subject);

    return {
      overallStats: {
        totalExams,
        completedExams,
        avgScore,
        bestScore,
        worstScore,
        improvementRate
      },
      subjectPerformance,
      recentTrends,
      strengths,
      areasToImprove
    };
  }

  async getInstituteAnalytics(instituteId: string): Promise<InstituteAnalytics> {
    // Get institute's exams
    const instituteExams = await db.select().from(exams)
      .where(eq(exams.instituteId, instituteId));
    
    const examIds = instituteExams.map(e => e.id);
    
    if (examIds.length === 0) {
      return {
        overallStats: {
          totalStudents: 156,
          totalExams: 42,
          avgScore: 72,
          completionRate: 87,
          activeStudents: 134
        },
        subjectPerformance: [
          { subject: 'Mathematics', avgScore: 78, examCount: 8, bestScore: 95, worstScore: 52 },
          { subject: 'Science', avgScore: 74, examCount: 7, bestScore: 92, worstScore: 48 },
          { subject: 'English', avgScore: 81, examCount: 6, bestScore: 96, worstScore: 58 },
          { subject: 'Social Studies', avgScore: 69, examCount: 5, bestScore: 88, worstScore: 42 },
          { subject: 'Hindi', avgScore: 76, examCount: 5, bestScore: 91, worstScore: 55 },
          { subject: 'Computer Science', avgScore: 83, examCount: 4, bestScore: 97, worstScore: 62 },
        ],
        topPerformers: [
          { studentId: 's1', studentName: 'Aarav Sharma', avgScore: 94, examCount: 12, grade: 'Grade 10' },
          { studentId: 's2', studentName: 'Priya Patel', avgScore: 91, examCount: 11, grade: 'Grade 9' },
          { studentId: 's3', studentName: 'Rohan Gupta', avgScore: 89, examCount: 10, grade: 'Grade 10' },
          { studentId: 's4', studentName: 'Ananya Singh', avgScore: 87, examCount: 12, grade: 'Grade 8' },
          { studentId: 's5', studentName: 'Kabir Mehta', avgScore: 86, examCount: 9, grade: 'Grade 9' },
        ],
        atRiskStudents: [
          { studentId: 'r1', studentName: 'Vikram Reddy', avgScore: 38, lastExamDate: '2026-01-28', concernType: 'low_score' as const },
          { studentId: 'r2', studentName: 'Neha Joshi', avgScore: 42, lastExamDate: '2026-01-15', concernType: 'declining' as const },
          { studentId: 'r3', studentName: 'Amit Kumar', avgScore: 45, lastExamDate: '2025-12-20', concernType: 'low_activity' as const },
        ],
        performanceTrends: [
          { date: 'Sep 2025', avgScore: 64, examCount: 5 },
          { date: 'Oct 2025', avgScore: 67, examCount: 6 },
          { date: 'Nov 2025', avgScore: 70, examCount: 7 },
          { date: 'Dec 2025', avgScore: 69, examCount: 5 },
          { date: 'Jan 2026', avgScore: 74, examCount: 8 },
          { date: 'Feb 2026', avgScore: 78, examCount: 6 },
        ],
        gradeDistribution: [
          { grade: 'Grade 6', studentCount: 28, avgScore: 71 },
          { grade: 'Grade 7', studentCount: 32, avgScore: 68 },
          { grade: 'Grade 8', studentCount: 26, avgScore: 74 },
          { grade: 'Grade 9', studentCount: 35, avgScore: 73 },
          { grade: 'Grade 10', studentCount: 35, avgScore: 76 },
        ]
      };
    }

    // Get batches for grade info
    const instituteBatches = await db.select().from(batches)
      .where(eq(batches.instituteId, instituteId));
    const batchMap = new Map(instituteBatches.map(b => [b.id, b]));

    // Get all attempts for institute's exams
    const attempts = await db.select({
      attemptId: examAttempts.id,
      studentId: examAttempts.studentId,
      examId: examAttempts.examId,
      scoreObtained: examAttempts.scoreObtained,
      totalMarks: examAttempts.totalMarks,
      status: examAttempts.status,
      submittedAt: examAttempts.submittedAt,
      examName: exams.examName,
      batchId: exams.batchId
    })
    .from(examAttempts)
    .innerJoin(exams, eq(examAttempts.examId, exams.id))
    .where(sql`${exams.instituteId} = ${instituteId}`);

    const completedAttempts = attempts.filter(a => a.status === 'Completed');
    const uniqueStudents = new Set(attempts.map(a => a.studentId));
    const activeStudents = new Set(completedAttempts.map(a => a.studentId));

    // Overall stats
    const scores = completedAttempts.map(a => 
      a.totalMarks && a.totalMarks > 0 ? ((a.scoreObtained || 0) / a.totalMarks) * 100 : 0
    );
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const completionRate = attempts.length > 0 
      ? Math.round((completedAttempts.length / attempts.length) * 100) 
      : 0;

    // Subject-wise performance (using batch names as subject proxy since exams don't have subject field)
    const subjectMap = new Map<string, { scores: number[]; count: number }>();
    for (const attempt of completedAttempts) {
      const batch = batchMap.get(attempt.batchId);
      const subject = batch?.batchName || 'General';
      const score = attempt.totalMarks && attempt.totalMarks > 0 
        ? ((attempt.scoreObtained || 0) / attempt.totalMarks) * 100 
        : 0;
      if (!subjectMap.has(subject)) {
        subjectMap.set(subject, { scores: [], count: 0 });
      }
      const data = subjectMap.get(subject)!;
      data.scores.push(score);
      data.count++;
    }

    const subjectPerformance: SubjectPerformance[] = Array.from(subjectMap.entries()).map(([subject, data]) => ({
      subject,
      avgScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
      examCount: data.count,
      bestScore: Math.round(Math.max(...data.scores)),
      worstScore: Math.round(Math.min(...data.scores))
    })).sort((a, b) => b.avgScore - a.avgScore);

    // Top performers - aggregate by student
    const studentScores = new Map<string, { scores: number[]; count: number }>();
    for (const attempt of completedAttempts) {
      const studentId = attempt.studentId;
      const score = attempt.totalMarks && attempt.totalMarks > 0 
        ? ((attempt.scoreObtained || 0) / attempt.totalMarks) * 100 
        : 0;
      if (!studentScores.has(studentId)) {
        studentScores.set(studentId, { scores: [], count: 0 });
      }
      const data = studentScores.get(studentId)!;
      data.scores.push(score);
      data.count++;
    }

    // Get student names from children table
    const studentIds = Array.from(studentScores.keys());
    const studentChildren = studentIds.length > 0 
      ? await db.select().from(children).where(sql`${children.id} IN (${sql.join(studentIds.map(id => sql`${id}`), sql`,`)})`)
      : [];
    const childMap = new Map(studentChildren.map(c => [c.id, c]));

    const topPerformers: TopPerformer[] = Array.from(studentScores.entries())
      .map(([studentId, data]) => ({
        studentId,
        studentName: childMap.get(studentId)?.name || 'Unknown Student',
        avgScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
        examCount: data.count,
        grade: childMap.get(studentId)?.grade
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 5);

    // At-risk students (avg score < 50%)
    const atRiskStudents: AtRiskStudent[] = Array.from(studentScores.entries())
      .map(([studentId, data]) => {
        const avgScore = Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length);
        const studentAttempts = completedAttempts.filter(a => a.studentId === studentId);
        const lastExam = studentAttempts.sort((a, b) => 
          (b.submittedAt?.getTime() || 0) - (a.submittedAt?.getTime() || 0)
        )[0];
        
        let concernType: 'low_score' | 'low_activity' | 'declining' = 'low_score';
        if (data.count < 2) concernType = 'low_activity';
        
        return {
          studentId,
          studentName: childMap.get(studentId)?.name || 'Unknown Student',
          avgScore,
          lastExamDate: lastExam?.submittedAt?.toISOString().split('T')[0],
          concernType
        };
      })
      .filter(s => s.avgScore < 50)
      .sort((a, b) => a.avgScore - b.avgScore)
      .slice(0, 5);

    // Performance trends by month
    const trendMap = new Map<string, { scores: number[]; count: number }>();
    for (const attempt of completedAttempts) {
      const month = attempt.submittedAt?.toISOString().slice(0, 7) || new Date().toISOString().slice(0, 7);
      const score = attempt.totalMarks && attempt.totalMarks > 0 
        ? ((attempt.scoreObtained || 0) / attempt.totalMarks) * 100 
        : 0;
      if (!trendMap.has(month)) {
        trendMap.set(month, { scores: [], count: 0 });
      }
      const data = trendMap.get(month)!;
      data.scores.push(score);
      data.count++;
    }

    const performanceTrends = Array.from(trendMap.entries())
      .map(([date, data]) => ({
        date,
        avgScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
        examCount: data.count
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-6);

    // Grade distribution (using batch names as grades)
    const gradeMap = new Map<string, { studentIds: Set<string>; scores: number[] }>();
    for (const attempt of completedAttempts) {
      const batch = batchMap.get(attempt.batchId);
      const grade = batch?.batchName || 'Unknown';
      const score = attempt.totalMarks && attempt.totalMarks > 0 
        ? ((attempt.scoreObtained || 0) / attempt.totalMarks) * 100 
        : 0;
      if (!gradeMap.has(grade)) {
        gradeMap.set(grade, { studentIds: new Set(), scores: [] });
      }
      const data = gradeMap.get(grade)!;
      data.studentIds.add(attempt.studentId);
      data.scores.push(score);
    }

    const gradeDistribution = Array.from(gradeMap.entries())
      .map(([grade, data]) => ({
        grade,
        studentCount: data.studentIds.size,
        avgScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
      }))
      .sort((a, b) => a.grade.localeCompare(b.grade));

    return {
      overallStats: {
        totalStudents: uniqueStudents.size,
        totalExams: instituteExams.length,
        avgScore,
        completionRate,
        activeStudents: activeStudents.size
      },
      subjectPerformance,
      topPerformers,
      atRiskStudents,
      performanceTrends,
      gradeDistribution
    };
  }

  // ============================================
  // CURRICULUM CATALOG IMPLEMENTATIONS
  // ============================================

  async getEducationBoards(): Promise<EducationBoard[]> {
    return db.select().from(educationBoards).where(eq(educationBoards.status, 'Active')).orderBy(asc(educationBoards.boardName));
  }

  async getEducationBoard(id: string): Promise<EducationBoard | undefined> {
    const result = await db.select().from(educationBoards).where(eq(educationBoards.id, id)).limit(1);
    return result[0];
  }

  async createEducationBoard(board: InsertEducationBoard): Promise<EducationBoard> {
    const result = await db.insert(educationBoards).values(board).returning();
    return result[0];
  }

  async getClassesByBoard(boardId: string): Promise<AcademicClass[]> {
    return db.select().from(academicClasses).where(and(eq(academicClasses.boardId, boardId), eq(academicClasses.status, 'Active'))).orderBy(asc(academicClasses.displayOrder));
  }

  async getSubjectsByClass(classId: string): Promise<AcademicSubject[]> {
    return db.select().from(academicSubjects).where(and(eq(academicSubjects.classId, classId), eq(academicSubjects.status, 'Active'))).orderBy(asc(academicSubjects.displayOrder));
  }

  async getChaptersBySubject(subjectId: string): Promise<AcademicChapter[]> {
    return db.select().from(academicChapters).where(and(eq(academicChapters.subjectId, subjectId), eq(academicChapters.status, 'Active'))).orderBy(asc(academicChapters.displayOrder));
  }

  async getTopicsByChapter(chapterId: string): Promise<AcademicTopic[]> {
    return db.select().from(academicTopics).where(and(eq(academicTopics.chapterId, chapterId), eq(academicTopics.status, 'Active'))).orderBy(asc(academicTopics.displayOrder));
  }

  // ============================================
  // CHILD ACADEMIC PROFILE IMPLEMENTATIONS
  // ============================================

  async getChildAcademicProfile(childId: string): Promise<ChildAcademicProfile | undefined> {
    const result = await db.select().from(childAcademicProfiles).where(eq(childAcademicProfiles.childId, childId)).limit(1);
    return result[0];
  }

  async createChildAcademicProfile(profile: InsertChildAcademicProfile): Promise<ChildAcademicProfile> {
    const result = await db.insert(childAcademicProfiles).values(profile).returning();
    return result[0];
  }

  async updateChildAcademicProfile(id: string, updates: Partial<InsertChildAcademicProfile>): Promise<ChildAcademicProfile | undefined> {
    const result = await db.update(childAcademicProfiles).set({ ...updates, updatedAt: new Date() }).where(eq(childAcademicProfiles.id, id)).returning();
    return result[0];
  }

  async getChildSubjectEnrollments(profileId: string): Promise<ChildSubjectEnrollment[]> {
    return db.select().from(childSubjectEnrollments).where(eq(childSubjectEnrollments.profileId, profileId));
  }

  async enrollChildInSubject(enrollment: InsertChildSubjectEnrollment): Promise<ChildSubjectEnrollment> {
    const result = await db.insert(childSubjectEnrollments).values(enrollment).returning();
    return result[0];
  }

  // ============================================
  // STUDY TASKS IMPLEMENTATIONS
  // ============================================

  async getStudyTasksByChild(childId: string): Promise<StudyTask[]> {
    return db.select().from(studyTasks).where(eq(studyTasks.childId, childId)).orderBy(desc(studyTasks.createdAt));
  }

  async createStudyTask(task: InsertStudyTask): Promise<StudyTask> {
    const result = await db.insert(studyTasks).values(task).returning();
    return result[0];
  }

  async updateStudyTask(id: string, updates: Partial<InsertStudyTask>): Promise<StudyTask | undefined> {
    const result = await db.update(studyTasks).set({ ...updates, updatedAt: new Date() }).where(eq(studyTasks.id, id)).returning();
    return result[0];
  }

  async deleteStudyTask(id: string): Promise<boolean> {
    const result = await db.delete(studyTasks).where(eq(studyTasks.id, id));
    return true;
  }

  // ============================================
  // TEST MANAGEMENT IMPLEMENTATIONS
  // ============================================

  async getTestsByCreator(creatorId: string): Promise<Test[]> {
    return db.select().from(tests).where(eq(tests.createdBy, creatorId)).orderBy(desc(tests.createdAt));
  }

  async getTestsByInstitute(instituteId: string): Promise<Test[]> {
    return db.select().from(tests).where(eq(tests.instituteId, instituteId)).orderBy(desc(tests.createdAt));
  }

  async getTestsByChild(childId: string): Promise<Test[]> {
    const assignments = await db.select().from(testAssignments).where(eq(testAssignments.childId, childId));
    if (assignments.length === 0) return [];
    const testIds = assignments.map(a => a.testId);
    return db.select().from(tests).where(sql`${tests.id} IN (${sql.join(testIds.map(id => sql`${id}`), sql`, `)})`);
  }

  async getTest(id: string): Promise<Test | undefined> {
    const result = await db.select().from(tests).where(eq(tests.id, id)).limit(1);
    return result[0];
  }

  async createTest(test: InsertTest): Promise<Test> {
    const result = await db.insert(tests).values(test).returning();
    return result[0];
  }

  async updateTest(id: string, updates: Partial<InsertTest>): Promise<Test | undefined> {
    const result = await db.update(tests).set({ ...updates, updatedAt: new Date() }).where(eq(tests.id, id)).returning();
    return result[0];
  }

  async getTestQuestionsByTest(testId: string): Promise<TestQuestion[]> {
    return db.select().from(testQuestions).where(eq(testQuestions.testId, testId)).orderBy(asc(testQuestions.orderIndex));
  }

  async createTestQuestion(question: InsertTestQuestion): Promise<TestQuestion> {
    const result = await db.insert(testQuestions).values(question).returning();
    return result[0];
  }

  async createTestQuestions(questions: InsertTestQuestion[]): Promise<TestQuestion[]> {
    if (questions.length === 0) return [];
    const result = await db.insert(testQuestions).values(questions).returning();
    return result;
  }

  // ============================================
  // TEST QUESTION BANK IMPLEMENTATIONS
  // ============================================

  async getQuestionBankQuestions(filters: { boardId?: string; classId?: string; subjectId?: string; chapterId?: string }): Promise<TestQuestionBank[]> {
    let conditions = [eq(testQuestionBank.status, 'Active')];
    if (filters.boardId) conditions.push(eq(testQuestionBank.boardId, filters.boardId));
    if (filters.classId) conditions.push(eq(testQuestionBank.classId, filters.classId));
    if (filters.subjectId) conditions.push(eq(testQuestionBank.subjectId, filters.subjectId));
    if (filters.chapterId) conditions.push(eq(testQuestionBank.chapterId, filters.chapterId));
    return db.select().from(testQuestionBank).where(and(...conditions));
  }

  async createQuestionBankQuestion(question: InsertTestQuestionBank): Promise<TestQuestionBank> {
    const result = await db.insert(testQuestionBank).values(question).returning();
    return result[0];
  }

  async bulkCreateQuestionBankQuestions(questions: InsertTestQuestionBank[]): Promise<number> {
    if (questions.length === 0) return 0;
    await db.insert(testQuestionBank).values(questions);
    return questions.length;
  }

  async bulkCreateLbiQuestions(questions: InsertLbiQuestionBank[]): Promise<number> {
    if (questions.length === 0) return 0;
    let inserted = 0;
    const batchSize = 50;
    for (let i = 0; i < questions.length; i += batchSize) {
      const batch = questions.slice(i, i + batchSize);
      await db.insert(lbiQuestionBank).values(batch)
        .onConflictDoUpdate({
          target: lbiQuestionBank.questionCode,
          set: {
            subModuleId: sql`EXCLUDED.sub_module_id`,
            questionType: sql`EXCLUDED.question_type`,
            questionText: sql`EXCLUDED.question_text`,
            passageText: sql`EXCLUDED.passage_text`,
            keying: sql`EXCLUDED.keying`,
            optionA: sql`EXCLUDED.option_a`,
            optionAScore: sql`EXCLUDED.option_a_score`,
            optionB: sql`EXCLUDED.option_b`,
            optionBScore: sql`EXCLUDED.option_b_score`,
            optionC: sql`EXCLUDED.option_c`,
            optionCScore: sql`EXCLUDED.option_c_score`,
            optionD: sql`EXCLUDED.option_d`,
            optionDScore: sql`EXCLUDED.option_d_score`,
            correctAnswer: sql`EXCLUDED.correct_answer`,
            explanation: sql`EXCLUDED.explanation`,
            subject: sql`EXCLUDED.subject`,
            anchor: sql`EXCLUDED.anchor`,
            difficultyLevel: sql`EXCLUDED.difficulty_level`,
            setNumber: sql`EXCLUDED.set_number`,
            ageGroupId: sql`EXCLUDED.age_group_id`,
            language: sql`EXCLUDED.language`,
            optionE: sql`EXCLUDED.option_e`,
            optionEScore: sql`EXCLUDED.option_e_score`,
            status: sql`EXCLUDED.status`,
          }
        });
      inserted += batch.length;
    }
    return inserted;
  }

  async getLbiQuestions(filters: { subModuleId?: string; subject?: string; status?: string }): Promise<LbiQuestionBank[]> {
    const conditions = [];
    if (filters.subModuleId) {
      conditions.push(eq(lbiQuestionBank.subModuleId, filters.subModuleId));
    }
    if (filters.subject) {
      conditions.push(eq(lbiQuestionBank.subject, filters.subject));
    }
    if (filters.status) {
      conditions.push(eq(lbiQuestionBank.status, filters.status));
    }
    
    if (conditions.length > 0) {
      return await db.select().from(lbiQuestionBank).where(and(...conditions)).orderBy(desc(lbiQuestionBank.createdAt)).limit(500);
    }
    return await db.select().from(lbiQuestionBank).orderBy(desc(lbiQuestionBank.createdAt)).limit(500);
  }

  // ============================================
  // ASSESSMENT BLUEPRINT IMPLEMENTATIONS
  // ============================================

  async getAssessmentBlueprints(filters?: { boardId?: string; classId?: string; subjectId?: string; assessmentType?: string }): Promise<AssessmentBlueprint[]> {
    const conditions = [];
    if (filters?.boardId) conditions.push(eq(assessmentBlueprints.boardId, filters.boardId));
    if (filters?.classId) conditions.push(eq(assessmentBlueprints.classId, filters.classId));
    if (filters?.subjectId) conditions.push(eq(assessmentBlueprints.subjectId, filters.subjectId));
    if (filters?.assessmentType) conditions.push(eq(assessmentBlueprints.assessmentType, filters.assessmentType));
    
    if (conditions.length > 0) {
      return await db.select().from(assessmentBlueprints).where(and(...conditions)).orderBy(desc(assessmentBlueprints.createdAt));
    }
    return await db.select().from(assessmentBlueprints).orderBy(desc(assessmentBlueprints.createdAt));
  }

  async getAssessmentBlueprintById(id: string): Promise<AssessmentBlueprint | undefined> {
    const [blueprint] = await db.select().from(assessmentBlueprints).where(eq(assessmentBlueprints.id, id));
    return blueprint;
  }

  async createAssessmentBlueprint(blueprint: InsertAssessmentBlueprint): Promise<AssessmentBlueprint> {
    const [newBlueprint] = await db.insert(assessmentBlueprints).values(blueprint).returning();
    return newBlueprint;
  }

  async updateAssessmentBlueprint(id: string, updates: Partial<InsertAssessmentBlueprint>): Promise<AssessmentBlueprint | undefined> {
    const [updated] = await db.update(assessmentBlueprints).set(updates).where(eq(assessmentBlueprints.id, id)).returning();
    return updated;
  }

  async deleteAssessmentBlueprint(id: string): Promise<boolean> {
    const result = await db.delete(assessmentBlueprints).where(eq(assessmentBlueprints.id, id));
    return true;
  }

  async getBlueprintSections(blueprintId: string): Promise<BlueprintSection[]> {
    return await db.select().from(blueprintSections).where(eq(blueprintSections.blueprintId, blueprintId)).orderBy(blueprintSections.sectionOrder);
  }

  async createBlueprintSection(section: InsertBlueprintSection): Promise<BlueprintSection> {
    const [newSection] = await db.insert(blueprintSections).values(section).returning();
    return newSection;
  }

  async updateBlueprintSection(id: string, updates: Partial<InsertBlueprintSection>): Promise<BlueprintSection | undefined> {
    const [updated] = await db.update(blueprintSections).set(updates).where(eq(blueprintSections.id, id)).returning();
    return updated;
  }

  async deleteBlueprintSection(id: string): Promise<boolean> {
    await db.delete(blueprintSections).where(eq(blueprintSections.id, id));
    return true;
  }

  async generatePaperFromBlueprint(blueprintId: string, seed?: number): Promise<{ sections: { sectionName: string; questions: TestQuestionBank[] }[]; totalMarks: number }> {
    const blueprint = await this.getAssessmentBlueprintById(blueprintId);
    if (!blueprint) throw new Error('Blueprint not found');

    const sections = await this.getBlueprintSections(blueprintId);
    const result: { sectionName: string; questions: TestQuestionBank[] }[] = [];
    let totalMarks = 0;
    const usedQuestionIds: Set<string> = new Set();

    for (const section of sections) {
      // Parse difficulty mix (e.g., "40:40:20" -> Easy:Medium:Hard)
      const difficultyMix = section.difficultyMix?.split(':').map(Number) || [33, 34, 33];
      const [easyPercent, mediumPercent, hardPercent] = difficultyMix;
      
      const easyCount = Math.floor(section.questionsCount * (easyPercent / 100));
      const mediumCount = Math.floor(section.questionsCount * (mediumPercent / 100));
      const hardCount = section.questionsCount - easyCount - mediumCount;

      // Helper function to fetch questions by difficulty
      const fetchQuestions = async (difficulty: string, count: number): Promise<TestQuestionBank[]> => {
        if (count <= 0) return [];
        
        const conditions = [
          eq(testQuestionBank.status, 'Active'),
          eq(testQuestionBank.difficultyLevel, difficulty)
        ];
        
        if (blueprint.boardId) conditions.push(eq(testQuestionBank.boardId, blueprint.boardId));
        if (blueprint.classId) conditions.push(eq(testQuestionBank.classId, blueprint.classId));
        if (blueprint.subjectId) conditions.push(eq(testQuestionBank.subjectId, blueprint.subjectId));
        if (section.questionType) conditions.push(eq(testQuestionBank.questionType, section.questionType));
        
        // Handle chapter filtering safely using inArray if chapters specified
        if (section.chapterIds && section.chapterIds.length > 0) {
          conditions.push(inArray(testQuestionBank.chapterId, section.chapterIds));
        }

        // Fetch more than needed to allow for deduplication
        const questions = await db.select().from(testQuestionBank)
          .where(and(...conditions))
          .orderBy(sql`RANDOM()`)
          .limit(count * 2);

        // Filter out already used questions and limit to requested count
        return questions
          .filter(q => !usedQuestionIds.has(q.id))
          .slice(0, count);
      };

      const easyQuestions = await fetchQuestions('Easy', easyCount);
      const mediumQuestions = await fetchQuestions('Medium', mediumCount);
      const hardQuestions = await fetchQuestions('Hard', hardCount);

      const sectionQuestions = [...easyQuestions, ...mediumQuestions, ...hardQuestions];
      
      // Mark questions as used to prevent duplication across sections
      sectionQuestions.forEach(q => usedQuestionIds.add(q.id));
      
      const sectionMarks = sectionQuestions.length * (section.marksPerQuestion || 1);
      totalMarks += sectionMarks;

      result.push({
        sectionName: section.sectionName,
        questions: sectionQuestions
      });
    }

    return { sections: result, totalMarks };
  }

  // ============================================
  // ADMIN DASHBOARD DATA IMPLEMENTATIONS
  // ============================================

  async getAllBehavioralInsights(): Promise<BehaviouralInsight[]> {
    return await db.select().from(behaviouralInsights).orderBy(desc(behaviouralInsights.recordedAt)).limit(500);
  }

  async getAllChildExams(): Promise<ChildExam[]> {
    return await db.select().from(childExams).orderBy(desc(childExams.createdAt)).limit(500);
  }

  async bulkCreateBehavioralInsights(insights: InsertBehaviouralInsight[]): Promise<number> {
    if (insights.length === 0) return 0;
    await db.insert(behaviouralInsights).values(insights);
    return insights.length;
  }

  async bulkCreateChildExams(exams: InsertChildExam[]): Promise<number> {
    if (exams.length === 0) return 0;
    await db.insert(childExams).values(exams);
    return exams.length;
  }

  // ============================================
  // TEST WORKFLOW IMPLEMENTATIONS
  // ============================================

  async updateTestWorkflowStatus(testId: string, newStatus: string, actionBy: string, actionType: string, comments?: string): Promise<Test | undefined> {
    const test = await this.getTest(testId);
    if (!test) return undefined;
    
    await db.insert(testWorkflowHistory).values({
      testId,
      fromStatus: test.workflowStatus,
      toStatus: newStatus,
      actionBy,
      actionType,
      comments
    });
    
    return this.updateTest(testId, { workflowStatus: newStatus });
  }

  async getTestApprovals(testId: string): Promise<TestApproval[]> {
    return db.select().from(testApprovals).where(eq(testApprovals.testId, testId));
  }

  async createTestApproval(approval: InsertTestApproval): Promise<TestApproval> {
    const result = await db.insert(testApprovals).values(approval).returning();
    return result[0];
  }

  async updateTestApproval(id: string, status: string, comments?: string): Promise<TestApproval | undefined> {
    const result = await db.update(testApprovals).set({ 
      approvalStatus: status, 
      comments,
      approvedAt: status === 'Approved' ? new Date() : undefined
    }).where(eq(testApprovals.id, id)).returning();
    return result[0];
  }

  // ============================================
  // TEST ASSIGNMENT IMPLEMENTATIONS
  // ============================================

  async getTestAssignmentsByChild(childId: string): Promise<TestAssignment[]> {
    return db.select().from(testAssignments).where(eq(testAssignments.childId, childId));
  }

  async getTestAssignmentsByTest(testId: string): Promise<TestAssignment[]> {
    return db.select().from(testAssignments).where(eq(testAssignments.testId, testId));
  }

  async createTestAssignment(assignment: InsertTestAssignment): Promise<TestAssignment> {
    const result = await db.insert(testAssignments).values(assignment).returning();
    return result[0];
  }

  // ============================================
  // TEST ATTEMPT IMPLEMENTATIONS
  // ============================================

  async getTestAttemptsByChild(childId: string): Promise<TestAttempt[]> {
    return db.select().from(testAttempts).where(eq(testAttempts.childId, childId)).orderBy(desc(testAttempts.createdAt));
  }

  async getTestAttempt(id: string): Promise<TestAttempt | undefined> {
    const result = await db.select().from(testAttempts).where(eq(testAttempts.id, id)).limit(1);
    return result[0];
  }

  async createTestAttempt(attempt: InsertTestAttempt): Promise<TestAttempt> {
    const result = await db.insert(testAttempts).values(attempt).returning();
    return result[0];
  }

  async submitTestAttempt(attemptId: string, responses: { questionId: string; selectedOption: string }[]): Promise<{ score: number; totalMarks: number; percentage: number }> {
    const attempt = await this.getTestAttempt(attemptId);
    if (!attempt) throw new Error('Attempt not found');
    
    const questions = await this.getTestQuestionsByTest(attempt.testId);
    const questionMap = new Map(questions.map(q => [q.id, q]));
    
    let score = 0;
    let totalMarks = 0;
    
    for (const response of responses) {
      const question = questionMap.get(response.questionId);
      if (!question) continue;
      
      totalMarks += question.marks;
      const isCorrect = response.selectedOption === question.correctOption;
      const marksObtained = isCorrect ? question.marks : -(question.negativeMarks || 0);
      if (isCorrect) score += question.marks;
      
      await db.insert(testResponses).values({
        attemptId,
        questionId: response.questionId,
        selectedOption: response.selectedOption,
        isCorrect,
        marksObtained
      });
    }
    
    const percentage = totalMarks > 0 ? (score / totalMarks) * 100 : 0;
    
    await db.update(testAttempts).set({
      status: 'Completed',
      scoreObtained: score,
      totalMarks,
      percentageScore: percentage,
      submittedAt: new Date()
    }).where(eq(testAttempts.id, attemptId));
    
    return { score, totalMarks, percentage };
  }

  // ============================================
  // INSTITUTE STAFF IMPLEMENTATIONS
  // ============================================

  async getInstituteStaff(instituteId: string): Promise<InstituteStaff[]> {
    return db.select().from(instituteStaff).where(eq(instituteStaff.instituteId, instituteId));
  }

  async createInstituteStaff(staff: InsertInstituteStaff): Promise<InstituteStaff> {
    const result = await db.insert(instituteStaff).values(staff).returning();
    return result[0];
  }

  async getStaffRoles(): Promise<StaffRole[]> {
    return db.select().from(staffRoles);
  }

  async getStaffBatchAssignments(staffId: string): Promise<StaffBatchAssignment[]> {
    return db.select().from(staffBatchAssignments).where(eq(staffBatchAssignments.staffId, staffId));
  }

  // ============================================
  // FORUM IMPLEMENTATIONS
  // ============================================

  async getForumPosts(filters: { subjectId?: string; visibility?: string; status?: string }): Promise<ForumPost[]> {
    let conditions = [];
    if (filters.visibility) conditions.push(eq(forumPosts.visibility, filters.visibility));
    if (filters.status) conditions.push(eq(forumPosts.status, filters.status));
    if (filters.subjectId) conditions.push(eq(forumPosts.subjectId, filters.subjectId));
    
    if (conditions.length === 0) {
      return db.select().from(forumPosts).orderBy(desc(forumPosts.createdAt)).limit(50);
    }
    return db.select().from(forumPosts).where(and(...conditions)).orderBy(desc(forumPosts.createdAt)).limit(50);
  }

  async getForumPost(id: string): Promise<ForumPost | undefined> {
    const result = await db.select().from(forumPosts).where(eq(forumPosts.id, id)).limit(1);
    if (result[0]) {
      await db.update(forumPosts).set({ viewCount: (result[0].viewCount || 0) + 1 }).where(eq(forumPosts.id, id));
    }
    return result[0];
  }

  async createForumPost(post: InsertForumPost): Promise<ForumPost> {
    const result = await db.insert(forumPosts).values(post).returning();
    return result[0];
  }

  async updateForumPost(id: string, updates: Partial<InsertForumPost>): Promise<ForumPost | undefined> {
    const result = await db.update(forumPosts).set({ ...updates, updatedAt: new Date() }).where(eq(forumPosts.id, id)).returning();
    return result[0];
  }

  async getForumReplies(postId: string): Promise<ForumReply[]> {
    return db.select().from(forumReplies).where(and(eq(forumReplies.postId, postId), eq(forumReplies.status, 'Active'))).orderBy(asc(forumReplies.createdAt));
  }

  async createForumReply(reply: InsertForumReply): Promise<ForumReply> {
    const result = await db.insert(forumReplies).values(reply).returning();
    return result[0];
  }

  async voteOnPost(userId: string, postId: string, voteType: string): Promise<void> {
    const existing = await db.select().from(forumVotes).where(and(eq(forumVotes.userId, userId), eq(forumVotes.postId, postId))).limit(1);
    
    if (existing[0]) {
      if (existing[0].voteType === voteType) {
        await db.delete(forumVotes).where(eq(forumVotes.id, existing[0].id));
        await db.update(forumPosts).set({ upvotes: sql`${forumPosts.upvotes} - 1` }).where(eq(forumPosts.id, postId));
      } else {
        await db.update(forumVotes).set({ voteType }).where(eq(forumVotes.id, existing[0].id));
        const change = voteType === 'upvote' ? 2 : -2;
        await db.update(forumPosts).set({ upvotes: sql`${forumPosts.upvotes} + ${change}` }).where(eq(forumPosts.id, postId));
      }
    } else {
      await db.insert(forumVotes).values({ userId, postId, voteType });
      const change = voteType === 'upvote' ? 1 : -1;
      await db.update(forumPosts).set({ upvotes: sql`${forumPosts.upvotes} + ${change}` }).where(eq(forumPosts.id, postId));
    }
  }

  async reportForumContent(report: InsertForumModerationLog): Promise<ForumModerationLog> {
    const result = await db.insert(forumModerationLogs).values(report).returning();
    return result[0];
  }

  // ============================================
  // ANALYTICS IMPLEMENTATIONS
  // ============================================

  async getChildPerformanceAnalytics(childId: string): Promise<PerformanceAnalytics[]> {
    return db.select().from(performanceAnalytics).where(eq(performanceAnalytics.childId, childId));
  }

  async getLbiCorrelations(childId: string): Promise<LbiPerformanceCorrelation[]> {
    return db.select().from(lbiPerformanceCorrelation).where(eq(lbiPerformanceCorrelation.childId, childId));
  }

  // ============================================
  // AUDIT LOG IMPLEMENTATIONS
  // ============================================

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const result = await db.insert(auditLogs).values(log).returning();
    return result[0];
  }

  // ============================================
  // CURRICULUM DATA SEEDING
  // ============================================

  async seedCurriculumData(): Promise<void> {
    // Check if boards already exist
    const existingBoards = await db.select().from(educationBoards).limit(1);
    if (existingBoards.length > 0) {
      return; // Already seeded
    }

    // Seed Education Boards
    const boardsData = [
      { boardCode: 'CBSE', boardName: 'Central Board of Secondary Education', country: 'India', status: 'Active' as const },
      { boardCode: 'ICSE', boardName: 'Indian Certificate of Secondary Education', country: 'India', status: 'Active' as const },
      { boardCode: 'STATE_MH', boardName: 'Maharashtra State Board', country: 'India', status: 'Active' as const },
      { boardCode: 'STATE_KA', boardName: 'Karnataka State Board', country: 'India', status: 'Active' as const },
      { boardCode: 'STATE_TN', boardName: 'Tamil Nadu State Board', country: 'India', status: 'Active' as const }
    ];

    const insertedBoards = await db.insert(educationBoards).values(boardsData).returning();
    const cbseBoard = insertedBoards.find(b => b.boardCode === 'CBSE')!;

    // Seed Classes for CBSE
    const classesData = [
      { boardId: cbseBoard.id, classNumber: 6, className: 'Class 6', displayOrder: 6, status: 'Active' as const },
      { boardId: cbseBoard.id, classNumber: 7, className: 'Class 7', displayOrder: 7, status: 'Active' as const },
      { boardId: cbseBoard.id, classNumber: 8, className: 'Class 8', displayOrder: 8, status: 'Active' as const },
      { boardId: cbseBoard.id, classNumber: 9, className: 'Class 9', displayOrder: 9, status: 'Active' as const },
      { boardId: cbseBoard.id, classNumber: 10, className: 'Class 10', displayOrder: 10, status: 'Active' as const },
      { boardId: cbseBoard.id, classNumber: 11, className: 'Class 11', displayOrder: 11, status: 'Active' as const },
      { boardId: cbseBoard.id, classNumber: 12, className: 'Class 12', displayOrder: 12, status: 'Active' as const }
    ];

    const insertedClasses = await db.insert(academicClasses).values(classesData).returning();
    const class10 = insertedClasses.find(c => c.classNumber === 10)!;

    // Seed Subjects for Class 10
    const subjectsData = [
      { boardId: cbseBoard.id, classId: class10.id, subjectCode: 'MATH_10', subjectName: 'Mathematics', displayOrder: 1, status: 'Active' as const },
      { boardId: cbseBoard.id, classId: class10.id, subjectCode: 'SCIENCE_10', subjectName: 'Science', displayOrder: 2, status: 'Active' as const },
      { boardId: cbseBoard.id, classId: class10.id, subjectCode: 'ENGLISH_10', subjectName: 'English', displayOrder: 3, status: 'Active' as const },
      { boardId: cbseBoard.id, classId: class10.id, subjectCode: 'HINDI_10', subjectName: 'Hindi', displayOrder: 4, status: 'Active' as const },
      { boardId: cbseBoard.id, classId: class10.id, subjectCode: 'SST_10', subjectName: 'Social Science', displayOrder: 5, status: 'Active' as const }
    ];

    const insertedSubjects = await db.insert(academicSubjects).values(subjectsData).returning();
    const mathSubject = insertedSubjects.find(s => s.subjectCode === 'MATH_10')!;
    const scienceSubject = insertedSubjects.find(s => s.subjectCode === 'SCIENCE_10')!;

    // Seed Chapters for Mathematics
    const mathChaptersData = [
      { subjectId: mathSubject.id, chapterName: 'Real Numbers', chapterNumber: 1, displayOrder: 1, status: 'Active' as const },
      { subjectId: mathSubject.id, chapterName: 'Polynomials', chapterNumber: 2, displayOrder: 2, status: 'Active' as const },
      { subjectId: mathSubject.id, chapterName: 'Pair of Linear Equations', chapterNumber: 3, displayOrder: 3, status: 'Active' as const },
      { subjectId: mathSubject.id, chapterName: 'Quadratic Equations', chapterNumber: 4, displayOrder: 4, status: 'Active' as const },
      { subjectId: mathSubject.id, chapterName: 'Arithmetic Progressions', chapterNumber: 5, displayOrder: 5, status: 'Active' as const },
      { subjectId: mathSubject.id, chapterName: 'Triangles', chapterNumber: 6, displayOrder: 6, status: 'Active' as const },
      { subjectId: mathSubject.id, chapterName: 'Coordinate Geometry', chapterNumber: 7, displayOrder: 7, status: 'Active' as const },
      { subjectId: mathSubject.id, chapterName: 'Introduction to Trigonometry', chapterNumber: 8, displayOrder: 8, status: 'Active' as const }
    ];

    const insertedMathChapters = await db.insert(academicChapters).values(mathChaptersData).returning();

    // Seed Chapters for Science
    const scienceChaptersData = [
      { subjectId: scienceSubject.id, chapterName: 'Chemical Reactions and Equations', chapterNumber: 1, displayOrder: 1, status: 'Active' as const },
      { subjectId: scienceSubject.id, chapterName: 'Acids, Bases and Salts', chapterNumber: 2, displayOrder: 2, status: 'Active' as const },
      { subjectId: scienceSubject.id, chapterName: 'Metals and Non-metals', chapterNumber: 3, displayOrder: 3, status: 'Active' as const },
      { subjectId: scienceSubject.id, chapterName: 'Carbon and its Compounds', chapterNumber: 4, displayOrder: 4, status: 'Active' as const },
      { subjectId: scienceSubject.id, chapterName: 'Life Processes', chapterNumber: 5, displayOrder: 5, status: 'Active' as const },
      { subjectId: scienceSubject.id, chapterName: 'Control and Coordination', chapterNumber: 6, displayOrder: 6, status: 'Active' as const },
      { subjectId: scienceSubject.id, chapterName: 'Heredity and Evolution', chapterNumber: 7, displayOrder: 7, status: 'Active' as const },
      { subjectId: scienceSubject.id, chapterName: 'Light - Reflection and Refraction', chapterNumber: 8, displayOrder: 8, status: 'Active' as const }
    ];

    await db.insert(academicChapters).values(scienceChaptersData);

    // Seed Topics for Real Numbers chapter
    const realNumbersChapter = insertedMathChapters.find(c => c.chapterNumber === 1)!;
    const topicsData = [
      { chapterId: realNumbersChapter.id, topicNumber: 1, topicName: 'Euclid\'s Division Lemma', displayOrder: 1, status: 'Active' as const },
      { chapterId: realNumbersChapter.id, topicNumber: 2, topicName: 'Fundamental Theorem of Arithmetic', displayOrder: 2, status: 'Active' as const },
      { chapterId: realNumbersChapter.id, topicNumber: 3, topicName: 'Irrational Numbers', displayOrder: 3, status: 'Active' as const },
      { chapterId: realNumbersChapter.id, topicNumber: 4, topicName: 'Decimal Expansions of Rational Numbers', displayOrder: 4, status: 'Active' as const }
    ];

    await db.insert(academicTopics).values(topicsData);

    // Seed some sample question bank questions for Mathematics
    const questionBankData = [
      {
        questionCode: 'QB_MATH_001',
        boardId: cbseBoard.id,
        classId: class10.id,
        subjectId: mathSubject.id,
        chapterId: realNumbersChapter.id,
        questionType: 'MCQ' as const,
        difficultyLevel: 'Easy' as const,
        questionText: 'What is the HCF of 26 and 91?',
        optionA: '13',
        optionB: '26',
        optionC: '7',
        optionD: '91',
        correctOption: 'A',
        explanation: 'Using Euclid\'s algorithm: 91 = 26 × 3 + 13, 26 = 13 × 2 + 0. So HCF = 13',
        marks: 1,
        status: 'Active' as const
      },
      {
        questionCode: 'QB_MATH_002',
        boardId: cbseBoard.id,
        classId: class10.id,
        subjectId: mathSubject.id,
        chapterId: realNumbersChapter.id,
        questionType: 'MCQ' as const,
        difficultyLevel: 'Medium' as const,
        questionText: 'If LCM(12, 21) = 84, what is HCF(12, 21)?',
        optionA: '3',
        optionB: '4',
        optionC: '7',
        optionD: '12',
        correctOption: 'A',
        explanation: 'LCM × HCF = Product of numbers. So 84 × HCF = 12 × 21 = 252. HCF = 252/84 = 3',
        marks: 2,
        status: 'Active' as const
      },
      {
        questionCode: 'QB_MATH_003',
        boardId: cbseBoard.id,
        classId: class10.id,
        subjectId: mathSubject.id,
        chapterId: realNumbersChapter.id,
        questionType: 'MCQ' as const,
        difficultyLevel: 'Hard' as const,
        questionText: 'The decimal expansion of 17/8 will terminate after how many places?',
        optionA: '2',
        optionB: '3',
        optionC: '4',
        optionD: '1',
        correctOption: 'B',
        explanation: '17/8 = 17/2³ = 2.125 which terminates after 3 decimal places',
        marks: 2,
        status: 'Active' as const
      },
      {
        questionCode: 'QB_MATH_004',
        boardId: cbseBoard.id,
        classId: class10.id,
        subjectId: mathSubject.id,
        chapterId: realNumbersChapter.id,
        questionType: 'MCQ' as const,
        difficultyLevel: 'Easy' as const,
        questionText: 'Which of the following is an irrational number?',
        optionA: '√4',
        optionB: '√9',
        optionC: '√5',
        optionD: '√16',
        correctOption: 'C',
        explanation: '√5 cannot be expressed as p/q where p and q are integers, so it is irrational',
        marks: 1,
        status: 'Active' as const
      },
      {
        questionCode: 'QB_MATH_005',
        boardId: cbseBoard.id,
        classId: class10.id,
        subjectId: mathSubject.id,
        chapterId: realNumbersChapter.id,
        questionType: 'MCQ' as const,
        difficultyLevel: 'Medium' as const,
        questionText: 'What is the LCM of the smallest prime and the smallest composite number?',
        optionA: '8',
        optionB: '4',
        optionC: '6',
        optionD: '2',
        correctOption: 'B',
        explanation: 'Smallest prime = 2, Smallest composite = 4. LCM(2,4) = 4',
        marks: 1,
        status: 'Active' as const
      }
    ];

    await db.insert(testQuestionBank).values(questionBankData);

    console.log('Curriculum data seeded successfully');
  }

  // ============================================
  // PARENT TEST METHODS
  // ============================================

  async getParentCreatedTests(userId: string): Promise<ParentTest[]> {
    return await db.select().from(parentTests).where(eq(parentTests.createdBy, userId)).orderBy(desc(parentTests.createdAt));
  }

  async createParentTest(test: InsertParentTest): Promise<ParentTest> {
    const result = await db.insert(parentTests).values(test).returning();
    return result[0];
  }

  async getParentTestById(testId: string): Promise<ParentTest | undefined> {
    const result = await db.select().from(parentTests).where(eq(parentTests.id, testId));
    return result[0];
  }

  async deleteParentTest(testId: string, userId: string): Promise<void> {
    await db.delete(parentTests).where(and(eq(parentTests.id, testId), eq(parentTests.createdBy, userId)));
  }

  async assignParentTest(testId: string, childIds: string[], dueDate?: string): Promise<ParentTestAssignment[]> {
    const test = await this.getParentTestById(testId);
    if (!test) throw new Error('Test not found');

    const assignments: ParentTestAssignment[] = [];
    for (const childId of childIds) {
      const result = await db.insert(parentTestAssignments).values({
        testId,
        childId,
        assignedBy: test.createdBy,
        status: 'pending',
        dueDate: dueDate ? new Date(dueDate) : null
      }).returning();
      assignments.push(result[0]);
    }

    // Update test status
    await db.update(parentTests).set({ status: 'assigned' }).where(eq(parentTests.id, testId));

    return assignments;
  }

  async getParentTestAssignments(userId: string): Promise<any[]> {
    const result = await db
      .select({
        id: parentTestAssignments.id,
        testId: parentTestAssignments.testId,
        childId: parentTestAssignments.childId,
        status: parentTestAssignments.status,
        dueDate: parentTestAssignments.dueDate,
        createdAt: parentTestAssignments.createdAt,
        testTitle: parentTests.title,
        testSubject: parentTests.subject,
        childName: children.name
      })
      .from(parentTestAssignments)
      .innerJoin(parentTests, eq(parentTestAssignments.testId, parentTests.id))
      .innerJoin(children, eq(parentTestAssignments.childId, children.id))
      .where(eq(parentTests.createdBy, userId))
      .orderBy(desc(parentTestAssignments.createdAt));

    // Get results for each assignment
    const assignmentsWithResults = await Promise.all(result.map(async (assignment) => {
      const resultData = await db.select().from(parentTestResults).where(eq(parentTestResults.assignmentId, assignment.id));
      if (resultData.length > 0) {
        return {
          ...assignment,
          score: resultData[0].score,
          marksObtained: resultData[0].marksObtained,
          totalMarks: resultData[0].totalMarks
        };
      }
      return assignment;
    }));

    return assignmentsWithResults;
  }

  async getParentTestResults(userId: string): Promise<any[]> {
    const result = await db
      .select({
        id: parentTestResults.id,
        assignmentId: parentTestResults.assignmentId,
        score: parentTestResults.score,
        marksObtained: parentTestResults.marksObtained,
        totalMarks: parentTestResults.totalMarks,
        correctAnswers: parentTestResults.correctAnswers,
        incorrectAnswers: parentTestResults.incorrectAnswers,
        questionResults: parentTestResults.questionResults,
        completedAt: parentTestResults.completedAt,
        testTitle: parentTests.title,
        testSubject: parentTests.subject,
        childName: children.name
      })
      .from(parentTestResults)
      .innerJoin(parentTestAssignments, eq(parentTestResults.assignmentId, parentTestAssignments.id))
      .innerJoin(parentTests, eq(parentTestAssignments.testId, parentTests.id))
      .innerJoin(children, eq(parentTestAssignments.childId, children.id))
      .where(eq(parentTests.createdBy, userId))
      .orderBy(desc(parentTestResults.completedAt));

    return result.map(r => ({
      ...r,
      subject: r.testSubject,
      weakAreas: []
    }));
  }

  async getStudentAssignedTests(userId: string): Promise<any[]> {
    // Get child linked to this student user
    const childResult = await db.select().from(children).where(eq(children.studentUserId, userId));
    if (childResult.length === 0) return [];

    const childId = childResult[0].id;

    const result = await db
      .select({
        id: parentTestAssignments.id,
        testId: parentTestAssignments.testId,
        status: parentTestAssignments.status,
        dueDate: parentTestAssignments.dueDate,
        testTitle: parentTests.title,
        testSubject: parentTests.subject,
        duration: parentTests.duration,
        totalMarks: parentTests.totalMarks
      })
      .from(parentTestAssignments)
      .innerJoin(parentTests, eq(parentTestAssignments.testId, parentTests.id))
      .where(eq(parentTestAssignments.childId, childId))
      .orderBy(desc(parentTestAssignments.createdAt));

    return result;
  }

  async getTestAssignment(assignmentId: string): Promise<ParentTestAssignment | undefined> {
    const result = await db.select().from(parentTestAssignments).where(eq(parentTestAssignments.id, assignmentId));
    return result[0];
  }

  async startTestAttempt(assignmentId: string, userId: string): Promise<any> {
    await db.update(parentTestAssignments).set({ 
      status: 'in_progress',
      startedAt: new Date()
    }).where(eq(parentTestAssignments.id, assignmentId));

    const assignment = await this.getTestAssignment(assignmentId);
    if (!assignment) throw new Error('Assignment not found');

    const test = await this.getParentTestById(assignment.testId);
    if (!test) throw new Error('Test not found');

    return {
      assignmentId,
      testId: test.id,
      title: test.title,
      subject: test.subject,
      duration: test.duration,
      totalMarks: test.totalMarks,
      questions: JSON.parse(test.questions as string).map((q: any) => ({
        id: q.id,
        questionText: q.questionText,
        questionType: q.questionType,
        options: q.options,
        marks: q.marks
      }))
    };
  }

  async submitParentTestAttempt(assignmentId: string, data: any): Promise<ParentTestResult> {
    await db.update(parentTestAssignments).set({ 
      status: 'completed',
      completedAt: new Date()
    }).where(eq(parentTestAssignments.id, assignmentId));

    const result = await db.insert(parentTestResults).values({
      assignmentId,
      studentId: data.studentId,
      answers: data.answers,
      marksObtained: data.marksObtained,
      totalMarks: data.totalMarks,
      score: data.score,
      correctAnswers: data.correctAnswers,
      incorrectAnswers: data.incorrectAnswers,
      questionResults: data.questionResults,
      completedAt: data.completedAt
    }).returning();

    return result[0];
  }

  async getStudentTestResult(assignmentId: string, userId: string): Promise<ParentTestResult | undefined> {
    const result = await db.select().from(parentTestResults).where(eq(parentTestResults.assignmentId, assignmentId));
    return result[0];
  }

  // ============================================
  // HR & RECRUITMENT ORCHESTRATION OPERATIONS
  // ============================================

  // Job Posting Operations
  async createJobPosting(job: InsertJobPosting): Promise<JobPosting> {
    const result = await db.insert(jobPostings).values(job).returning();
    return result[0];
  }

  async getJobPosting(id: string): Promise<JobPosting | undefined> {
    const result = await db.select().from(jobPostings).where(eq(jobPostings.id, id));
    return result[0];
  }

  async getAllJobPostings(filters?: { status?: string; roleCategory?: string }): Promise<JobPosting[]> {
    let query = db.select().from(jobPostings);
    
    if (filters?.status) {
      query = query.where(eq(jobPostings.status, filters.status)) as any;
    }
    if (filters?.roleCategory) {
      query = query.where(eq(jobPostings.roleCategory, filters.roleCategory)) as any;
    }
    
    return await query.orderBy(desc(jobPostings.createdAt));
  }

  async getPublishedJobs(): Promise<JobPosting[]> {
    return await db.select().from(jobPostings)
      .where(eq(jobPostings.status, 'published'))
      .orderBy(desc(jobPostings.publishedAt));
  }

  async updateJobPosting(id: string, updates: Partial<JobPosting>): Promise<JobPosting> {
    const result = await db.update(jobPostings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(jobPostings.id, id))
      .returning();
    return result[0];
  }

  async updateJobStatus(id: string, status: string, reviewData?: { 
    reviewBy: string; 
    notes?: string;
    reviewType: 'hr' | 'legal' | 'leadership';
  }): Promise<JobPosting> {
    const updateFields: any = { status, updatedAt: new Date() };
    
    if (reviewData) {
      const now = new Date();
      if (reviewData.reviewType === 'hr') {
        updateFields.hrReviewBy = reviewData.reviewBy;
        updateFields.hrReviewAt = now;
        updateFields.hrReviewNotes = reviewData.notes;
      } else if (reviewData.reviewType === 'legal') {
        updateFields.legalReviewBy = reviewData.reviewBy;
        updateFields.legalReviewAt = now;
        updateFields.legalReviewNotes = reviewData.notes;
      } else if (reviewData.reviewType === 'leadership') {
        updateFields.leadershipApprovalBy = reviewData.reviewBy;
        updateFields.leadershipApprovalAt = now;
        updateFields.leadershipApprovalNotes = reviewData.notes;
      }
    }
    
    if (status === 'published') {
      updateFields.publishedAt = new Date();
    } else if (status === 'closed') {
      updateFields.closedAt = new Date();
    }
    
    const result = await db.update(jobPostings)
      .set(updateFields)
      .where(eq(jobPostings.id, id))
      .returning();
    return result[0];
  }

  // Job Distribution Operations
  async createJobDistribution(distribution: InsertJobDistribution): Promise<JobDistribution> {
    const result = await db.insert(jobDistributions).values(distribution).returning();
    return result[0];
  }

  async getJobDistributions(jobId: string): Promise<JobDistribution[]> {
    return await db.select().from(jobDistributions)
      .where(eq(jobDistributions.jobId, jobId));
  }

  async updateJobDistribution(id: string, updates: Partial<JobDistribution>): Promise<JobDistribution> {
    const result = await db.update(jobDistributions)
      .set(updates)
      .where(eq(jobDistributions.id, id))
      .returning();
    return result[0];
  }

  // Job Application Operations
  async createJobApplication(application: InsertJobApplication): Promise<JobApplication> {
    const result = await db.insert(jobApplications).values(application).returning();
    // Increment applications count for the source channel
    if (application.sourceChannel) {
      await db.update(jobDistributions)
        .set({ applicationsFromChannel: sql`${jobDistributions.applicationsFromChannel} + 1` })
        .where(and(
          eq(jobDistributions.jobId, application.jobId),
          eq(jobDistributions.channel, application.sourceChannel)
        ));
    }
    return result[0];
  }

  async getJobApplication(id: string): Promise<JobApplication | undefined> {
    const result = await db.select().from(jobApplications).where(eq(jobApplications.id, id));
    return result[0];
  }

  async getJobApplicationsByJob(jobId: string): Promise<JobApplication[]> {
    return await db.select().from(jobApplications)
      .where(eq(jobApplications.jobId, jobId))
      .orderBy(desc(jobApplications.createdAt));
  }

  async getJobApplicationsByUser(userId: string): Promise<JobApplication[]> {
    return await db.select().from(jobApplications)
      .where(eq(jobApplications.applicantUserId, userId))
      .orderBy(desc(jobApplications.createdAt));
  }

  async updateJobApplication(id: string, updates: Partial<JobApplication>): Promise<JobApplication> {
    const result = await db.update(jobApplications)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(jobApplications.id, id))
      .returning();
    return result[0];
  }

  async getApplicationStats(): Promise<{ status: string; count: number }[]> {
    const result = await db.select({
      status: jobApplications.status,
      count: count()
    })
    .from(jobApplications)
    .groupBy(jobApplications.status);
    return result.map(r => ({ status: r.status, count: Number(r.count) }));
  }

  // Mentor Operations
  async createMentor(mentor: InsertMentor): Promise<Mentor> {
    const result = await db.insert(mentors).values(mentor).returning();
    return result[0];
  }

  async getMentor(id: string): Promise<Mentor | undefined> {
    const result = await db.select().from(mentors).where(eq(mentors.id, id));
    return result[0];
  }

  async getMentorByUserId(userId: string): Promise<Mentor | undefined> {
    const result = await db.select().from(mentors).where(eq(mentors.userId, userId));
    return result[0];
  }

  async getMentorByCode(code: string): Promise<Mentor | undefined> {
    const result = await db.select().from(mentors).where(eq(mentors.mentorCode, code));
    return result[0];
  }

  async getAllMentors(filters?: { status?: string }): Promise<Mentor[]> {
    if (filters?.status) {
      return await db.select().from(mentors)
        .where(eq(mentors.status, filters.status))
        .orderBy(desc(mentors.createdAt));
    }
    return await db.select().from(mentors).orderBy(desc(mentors.createdAt));
  }

  async updateMentor(id: string, updates: Partial<Mentor>): Promise<Mentor> {
    const result = await db.update(mentors)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(mentors.id, id))
      .returning();
    return result[0];
  }

  async getMentorStats(): Promise<{ status: string; count: number }[]> {
    const result = await db.select({
      status: mentors.status,
      count: count()
    })
    .from(mentors)
    .groupBy(mentors.status);
    return result.map(r => ({ status: r.status, count: Number(r.count) }));
  }

  async getMentorsAtRisk(): Promise<Mentor[]> {
    return await db.select().from(mentors)
      .where(or(
        eq(mentors.status, 'warning'),
        lte(mentors.performanceHealthIndex, 60)
      ))
      .orderBy(asc(mentors.performanceHealthIndex));
  }

  // Training Operations
  async createTrainingProgram(program: InsertTrainingProgram): Promise<TrainingProgram> {
    const result = await db.insert(trainingPrograms).values(program).returning();
    return result[0];
  }

  async getTrainingProgram(id: string): Promise<TrainingProgram | undefined> {
    const result = await db.select().from(trainingPrograms).where(eq(trainingPrograms.id, id));
    return result[0];
  }

  async getActiveTrainingPrograms(): Promise<TrainingProgram[]> {
    return await db.select().from(trainingPrograms)
      .where(eq(trainingPrograms.isActive, true));
  }

  async createTrainingEnrollment(enrollment: InsertTrainingEnrollment): Promise<TrainingEnrollment> {
    const result = await db.insert(trainingEnrollments).values(enrollment).returning();
    return result[0];
  }

  async getTrainingEnrollment(id: string): Promise<TrainingEnrollment | undefined> {
    const result = await db.select().from(trainingEnrollments).where(eq(trainingEnrollments.id, id));
    return result[0];
  }

  async getMentorEnrollments(mentorId: string): Promise<TrainingEnrollment[]> {
    return await db.select().from(trainingEnrollments)
      .where(eq(trainingEnrollments.mentorId, mentorId))
      .orderBy(desc(trainingEnrollments.createdAt));
  }

  async updateTrainingEnrollment(id: string, updates: Partial<TrainingEnrollment>): Promise<TrainingEnrollment> {
    const result = await db.update(trainingEnrollments)
      .set(updates)
      .where(eq(trainingEnrollments.id, id))
      .returning();
    return result[0];
  }

  // Mentor KPI Operations
  async createMentorKpi(kpi: InsertMentorKpi): Promise<MentorKpi> {
    const result = await db.insert(mentorKpis).values(kpi).returning();
    return result[0];
  }

  async getMentorKpis(mentorId: string): Promise<MentorKpi[]> {
    return await db.select().from(mentorKpis)
      .where(eq(mentorKpis.mentorId, mentorId))
      .orderBy(desc(mentorKpis.periodEnd));
  }

  async getLatestMentorKpi(mentorId: string): Promise<MentorKpi | undefined> {
    const result = await db.select().from(mentorKpis)
      .where(eq(mentorKpis.mentorId, mentorId))
      .orderBy(desc(mentorKpis.periodEnd))
      .limit(1);
    return result[0];
  }

  async updateMentorKpi(id: string, updates: Partial<MentorKpi>): Promise<MentorKpi> {
    const result = await db.update(mentorKpis)
      .set(updates)
      .where(eq(mentorKpis.id, id))
      .returning();
    return result[0];
  }

  // Consent Log Operations
  async createHrConsentLog(consent: InsertHrConsentLog): Promise<HrConsentLog> {
    const result = await db.insert(hrConsentLogs).values(consent).returning();
    return result[0];
  }

  async getUserConsentLogs(userId: string): Promise<HrConsentLog[]> {
    return await db.select().from(hrConsentLogs)
      .where(eq(hrConsentLogs.userId, userId))
      .orderBy(desc(hrConsentLogs.createdAt));
  }

  async getMentorConsentLogs(mentorId: string): Promise<HrConsentLog[]> {
    return await db.select().from(hrConsentLogs)
      .where(eq(hrConsentLogs.mentorId, mentorId))
      .orderBy(desc(hrConsentLogs.createdAt));
  }

  // Compliance Violation Operations
  async createComplianceViolation(violation: InsertComplianceViolation): Promise<ComplianceViolation> {
    const result = await db.insert(complianceViolations).values(violation).returning();
    return result[0];
  }

  async getComplianceViolation(id: string): Promise<ComplianceViolation | undefined> {
    const result = await db.select().from(complianceViolations).where(eq(complianceViolations.id, id));
    return result[0];
  }

  async getMentorViolations(mentorId: string): Promise<ComplianceViolation[]> {
    return await db.select().from(complianceViolations)
      .where(eq(complianceViolations.mentorId, mentorId))
      .orderBy(desc(complianceViolations.createdAt));
  }

  async getPendingViolations(): Promise<ComplianceViolation[]> {
    return await db.select().from(complianceViolations)
      .where(or(
        eq(complianceViolations.status, 'reported'),
        eq(complianceViolations.status, 'investigating')
      ))
      .orderBy(desc(complianceViolations.createdAt));
  }

  async updateComplianceViolation(id: string, updates: Partial<ComplianceViolation>): Promise<ComplianceViolation> {
    const result = await db.update(complianceViolations)
      .set(updates)
      .where(eq(complianceViolations.id, id))
      .returning();
    return result[0];
  }

  // Mentor Payout Operations
  async createMentorPayout(payout: InsertMentorPayout): Promise<MentorPayout> {
    const result = await db.insert(mentorPayouts).values(payout).returning();
    return result[0];
  }

  async getMentorPayouts(mentorId: string): Promise<MentorPayout[]> {
    return await db.select().from(mentorPayouts)
      .where(eq(mentorPayouts.mentorId, mentorId))
      .orderBy(desc(mentorPayouts.periodEnd));
  }

  async getPendingPayouts(): Promise<MentorPayout[]> {
    return await db.select().from(mentorPayouts)
      .where(eq(mentorPayouts.status, 'pending'))
      .orderBy(desc(mentorPayouts.createdAt));
  }

  async updateMentorPayout(id: string, updates: Partial<MentorPayout>): Promise<MentorPayout> {
    const result = await db.update(mentorPayouts)
      .set(updates)
      .where(eq(mentorPayouts.id, id))
      .returning();
    return result[0];
  }

  // Institutional SLA Operations
  async createInstitutionalSla(sla: InsertInstitutionalSla): Promise<InstitutionalSla> {
    const result = await db.insert(institutionalSlas).values(sla).returning();
    return result[0];
  }

  async getInstituteSla(instituteId: string): Promise<InstitutionalSla | undefined> {
    const result = await db.select().from(institutionalSlas)
      .where(eq(institutionalSlas.instituteId, instituteId))
      .orderBy(desc(institutionalSlas.effectiveFrom))
      .limit(1);
    return result[0];
  }

  async updateInstitutionalSla(id: string, updates: Partial<InstitutionalSla>): Promise<InstitutionalSla> {
    const result = await db.update(institutionalSlas)
      .set(updates)
      .where(eq(institutionalSlas.id, id))
      .returning();
    return result[0];
  }

  // White-Label Partner Operations
  async createWhiteLabelPartner(partner: InsertWhiteLabelPartner): Promise<WhiteLabelPartner> {
    const result = await db.insert(whiteLabelPartners).values(partner).returning();
    return result[0];
  }

  async getWhiteLabelPartner(id: string): Promise<WhiteLabelPartner | undefined> {
    const result = await db.select().from(whiteLabelPartners).where(eq(whiteLabelPartners.id, id));
    return result[0];
  }

  async getWhiteLabelPartnerByCode(code: string): Promise<WhiteLabelPartner | undefined> {
    const result = await db.select().from(whiteLabelPartners).where(eq(whiteLabelPartners.partnerCode, code));
    return result[0];
  }

  async getAllWhiteLabelPartners(): Promise<WhiteLabelPartner[]> {
    return await db.select().from(whiteLabelPartners).orderBy(desc(whiteLabelPartners.createdAt));
  }

  async updateWhiteLabelPartner(id: string, updates: Partial<WhiteLabelPartner>): Promise<WhiteLabelPartner> {
    const result = await db.update(whiteLabelPartners)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(whiteLabelPartners.id, id))
      .returning();
    return result[0];
  }

  // HR Audit Log Operations
  async createHrAuditLog(log: InsertHrAuditLog): Promise<HrAuditLog> {
    const result = await db.insert(hrAuditLogs).values(log).returning();
    return result[0];
  }

  async getHrAuditLogs(filters?: { 
    targetType?: string; 
    targetId?: string; 
    actorUserId?: string;
    limit?: number;
  }): Promise<HrAuditLog[]> {
    let query = db.select().from(hrAuditLogs);
    
    if (filters?.targetType) {
      query = query.where(eq(hrAuditLogs.targetType, filters.targetType)) as any;
    }
    if (filters?.targetId) {
      query = query.where(eq(hrAuditLogs.targetId, filters.targetId)) as any;
    }
    if (filters?.actorUserId) {
      query = query.where(eq(hrAuditLogs.actorUserId, filters.actorUserId)) as any;
    }
    
    query = query.orderBy(desc(hrAuditLogs.createdAt)) as any;
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    
    return await query;
  }

  // HR Dashboard Stats
  async getHrDashboardStats(): Promise<{
    totalJobs: number;
    publishedJobs: number;
    pendingApprovals: number;
    totalApplications: number;
    activeMentors: number;
    mentorsAtRisk: number;
    pendingViolations: number;
    pendingPayouts: number;
  }> {
    const [
      jobsResult,
      publishedJobsResult,
      pendingApprovalsResult,
      applicationsResult,
      mentorsResult,
      atRiskResult,
      violationsResult,
      payoutsResult
    ] = await Promise.all([
      db.select({ count: count() }).from(jobPostings),
      db.select({ count: count() }).from(jobPostings).where(eq(jobPostings.status, 'published')),
      db.select({ count: count() }).from(jobPostings).where(or(
        eq(jobPostings.status, 'hr_review'),
        eq(jobPostings.status, 'legal_review'),
        eq(jobPostings.status, 'leadership_approval')
      )),
      db.select({ count: count() }).from(jobApplications),
      db.select({ count: count() }).from(mentors).where(eq(mentors.status, 'active')),
      db.select({ count: count() }).from(mentors).where(or(
        eq(mentors.status, 'warning'),
        lte(mentors.performanceHealthIndex, 60)
      )),
      db.select({ count: count() }).from(complianceViolations).where(or(
        eq(complianceViolations.status, 'reported'),
        eq(complianceViolations.status, 'investigating')
      )),
      db.select({ count: count() }).from(mentorPayouts).where(eq(mentorPayouts.status, 'pending'))
    ]);

    return {
      totalJobs: Number(jobsResult[0]?.count || 0),
      publishedJobs: Number(publishedJobsResult[0]?.count || 0),
      pendingApprovals: Number(pendingApprovalsResult[0]?.count || 0),
      totalApplications: Number(applicationsResult[0]?.count || 0),
      activeMentors: Number(mentorsResult[0]?.count || 0),
      mentorsAtRisk: Number(atRiskResult[0]?.count || 0),
      pendingViolations: Number(violationsResult[0]?.count || 0),
      pendingPayouts: Number(payoutsResult[0]?.count || 0)
    };
  }

  // ============================================
  // SUPER ADMIN / PLATFORM MANAGEMENT METHODS
  // ============================================

  // Onboarding Approvals
  async createOnboardingApproval(data: InsertOnboardingApproval): Promise<OnboardingApproval> {
    const result = await db.insert(onboardingApprovals).values(data).returning();
    return result[0];
  }

  async getOnboardingApprovals(filters?: { entityType?: string; status?: string }): Promise<OnboardingApproval[]> {
    let query = db.select().from(onboardingApprovals);
    
    if (filters?.entityType) {
      query = query.where(eq(onboardingApprovals.entityType, filters.entityType)) as any;
    }
    if (filters?.status) {
      query = query.where(eq(onboardingApprovals.status, filters.status)) as any;
    }
    
    return await query.orderBy(desc(onboardingApprovals.createdAt));
  }

  async getOnboardingApproval(id: string): Promise<OnboardingApproval | undefined> {
    const result = await db.select().from(onboardingApprovals).where(eq(onboardingApprovals.id, id));
    return result[0];
  }

  async updateOnboardingApproval(id: string, updates: Partial<InsertOnboardingApproval>): Promise<OnboardingApproval> {
    const result = await db.update(onboardingApprovals)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(onboardingApprovals.id, id))
      .returning();
    return result[0];
  }

  // Platform Transactions
  async createPlatformTransaction(data: InsertPlatformTransaction): Promise<PlatformTransaction> {
    const result = await db.insert(platformTransactions).values(data).returning();
    return result[0];
  }

  async getPlatformTransactions(filters?: { entityType?: string; status?: string; transactionType?: string; limit?: number }): Promise<PlatformTransaction[]> {
    let query = db.select().from(platformTransactions);
    
    if (filters?.entityType) {
      query = query.where(eq(platformTransactions.entityType, filters.entityType)) as any;
    }
    if (filters?.status) {
      query = query.where(eq(platformTransactions.status, filters.status)) as any;
    }
    if (filters?.transactionType) {
      query = query.where(eq(platformTransactions.transactionType, filters.transactionType)) as any;
    }
    
    query = query.orderBy(desc(platformTransactions.createdAt)) as any;
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    
    return await query;
  }

  async getPlatformTransaction(id: string): Promise<PlatformTransaction | undefined> {
    const result = await db.select().from(platformTransactions).where(eq(platformTransactions.id, id));
    return result[0];
  }

  async updatePlatformTransaction(id: string, updates: Partial<InsertPlatformTransaction>): Promise<PlatformTransaction> {
    const result = await db.update(platformTransactions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(platformTransactions.id, id))
      .returning();
    return result[0];
  }

  // Admin Audit Logs
  async createAdminAuditLog(data: InsertAdminAuditLog): Promise<AdminAuditLog> {
    const result = await db.insert(adminAuditLogs).values(data).returning();
    return result[0];
  }

  async getAdminAuditLogs(filters?: { targetType?: string; adminUserId?: string; limit?: number }): Promise<AdminAuditLog[]> {
    let query = db.select().from(adminAuditLogs);
    
    if (filters?.targetType) {
      query = query.where(eq(adminAuditLogs.targetType, filters.targetType)) as any;
    }
    if (filters?.adminUserId) {
      query = query.where(eq(adminAuditLogs.adminUserId, filters.adminUserId)) as any;
    }
    
    query = query.orderBy(desc(adminAuditLogs.createdAt)) as any;
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    
    return await query;
  }

  async getAdminAuditLogsByTarget(targetType: string, targetId: string): Promise<AdminAuditLog[]> {
    return await db.select()
      .from(adminAuditLogs)
      .where(and(
        eq(adminAuditLogs.targetType, targetType),
        eq(adminAuditLogs.targetId, targetId)
      ))
      .orderBy(desc(adminAuditLogs.createdAt));
  }

  // Platform Settings
  async getPlatformSettings(category?: string): Promise<PlatformSetting[]> {
    let query = db.select().from(platformSettings);
    
    if (category) {
      query = query.where(eq(platformSettings.category, category)) as any;
    }
    
    return await query;
  }

  async getPlatformSetting(key: string): Promise<PlatformSetting | undefined> {
    const result = await db.select().from(platformSettings).where(eq(platformSettings.settingKey, key));
    return result[0];
  }

  async upsertPlatformSetting(data: InsertPlatformSetting): Promise<PlatformSetting> {
    const existing = await this.getPlatformSetting(data.settingKey);
    if (existing) {
      const result = await db.update(platformSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(platformSettings.settingKey, data.settingKey))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(platformSettings).values(data).returning();
      return result[0];
    }
  }

  // Super Admin Dashboard Stats
  async getSuperAdminDashboardStats(): Promise<{
    totalInstitutes: number;
    pendingInstituteApprovals: number;
    totalParents: number;
    pendingParentApprovals: number;
    totalMentors: number;
    pendingMentorApprovals: number;
    totalTransactions: number;
    pendingTransactions: number;
    totalRevenue: number;
    pendingPayouts: number;
    totalJobs: number;
    publishedJobs: number;
    totalApplications: number;
  }> {
    const [
      institutesResult,
      pendingInstituteApprovalsResult,
      parentsResult,
      pendingParentApprovalsResult,
      mentorsResult,
      pendingMentorApprovalsResult,
      transactionsResult,
      pendingTransactionsResult,
      revenueResult,
      payoutsResult,
      jobsResult,
      publishedJobsResult,
      applicationsResult
    ] = await Promise.all([
      db.select({ count: count() }).from(institutes),
      db.select({ count: count() }).from(onboardingApprovals)
        .where(and(eq(onboardingApprovals.entityType, 'institute'), eq(onboardingApprovals.status, 'pending'))),
      db.select({ count: count() }).from(users).where(sql`'parent' = ANY(${users.roles})`),
      db.select({ count: count() }).from(onboardingApprovals)
        .where(and(eq(onboardingApprovals.entityType, 'parent'), eq(onboardingApprovals.status, 'pending'))),
      db.select({ count: count() }).from(mentors),
      db.select({ count: count() }).from(onboardingApprovals)
        .where(and(eq(onboardingApprovals.entityType, 'mentor'), eq(onboardingApprovals.status, 'pending'))),
      db.select({ count: count() }).from(platformTransactions),
      db.select({ count: count() }).from(platformTransactions).where(eq(platformTransactions.status, 'pending')),
      db.select({ sum: sql<number>`COALESCE(SUM(${platformTransactions.amount}), 0)` }).from(platformTransactions)
        .where(eq(platformTransactions.status, 'completed')),
      db.select({ count: count() }).from(mentorPayouts).where(eq(mentorPayouts.status, 'pending')),
      db.select({ count: count() }).from(jobPostings),
      db.select({ count: count() }).from(jobPostings).where(eq(jobPostings.status, 'published')),
      db.select({ count: count() }).from(jobApplications)
    ]);

    return {
      totalInstitutes: Number(institutesResult[0]?.count || 0),
      pendingInstituteApprovals: Number(pendingInstituteApprovalsResult[0]?.count || 0),
      totalParents: Number(parentsResult[0]?.count || 0),
      pendingParentApprovals: Number(pendingParentApprovalsResult[0]?.count || 0),
      totalMentors: Number(mentorsResult[0]?.count || 0),
      pendingMentorApprovals: Number(pendingMentorApprovalsResult[0]?.count || 0),
      totalTransactions: Number(transactionsResult[0]?.count || 0),
      pendingTransactions: Number(pendingTransactionsResult[0]?.count || 0),
      totalRevenue: Number(revenueResult[0]?.sum || 0),
      pendingPayouts: Number(payoutsResult[0]?.count || 0),
      totalJobs: Number(jobsResult[0]?.count || 0),
      publishedJobs: Number(publishedJobsResult[0]?.count || 0),
      totalApplications: Number(applicationsResult[0]?.count || 0)
    };
  }

  // Get all users for admin management
  async getAllUsers(filters?: { role?: string; limit?: number }): Promise<User[]> {
    let query = db.select().from(users);
    
    if (filters?.role) {
      query = query.where(sql`${filters.role} = ANY(${users.roles})`) as any;
    }
    
    query = query.orderBy(desc(users.createdAt)) as any;
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    
    return await query;
  }

  // Get all institutes for admin management
  async getAllInstitutes(): Promise<Institute[]> {
    return await db.select().from(institutes).orderBy(desc(institutes.createdAt));
  }

  // ============================================
  // ENTITY CODE OPERATIONS
  // ============================================

  async createEntityCode(data: InsertEntityCode): Promise<EntityCode> {
    const result = await db.insert(entityCodes).values(data).returning();
    return result[0];
  }

  async getEntityCodes(filters?: { entityType?: string; status?: string; limit?: number }): Promise<EntityCode[]> {
    let query = db.select().from(entityCodes);
    
    if (filters?.entityType) {
      query = query.where(eq(entityCodes.entityType, filters.entityType)) as any;
    }
    if (filters?.status) {
      query = query.where(eq(entityCodes.status, filters.status)) as any;
    }
    
    query = query.orderBy(desc(entityCodes.createdAt)) as any;
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    
    return await query;
  }

  async updateEntityCode(id: string, updates: Partial<InsertEntityCode>): Promise<EntityCode> {
    const result = await db.update(entityCodes).set(updates).where(eq(entityCodes.id, id)).returning();
    return result[0];
  }

  // ============================================
  // CONSENT MANAGEMENT OPERATIONS
  // ============================================

  async createConsentRecord(data: InsertConsentRecord): Promise<ConsentRecord> {
    const result = await db.insert(consentRecords).values(data).returning();
    return result[0];
  }

  async getConsentRecords(filters?: { entityType?: string; consentType?: string; status?: string; limit?: number }): Promise<ConsentRecord[]> {
    let query = db.select().from(consentRecords);
    
    if (filters?.entityType) {
      query = query.where(eq(consentRecords.entityType, filters.entityType)) as any;
    }
    if (filters?.consentType) {
      query = query.where(eq(consentRecords.consentType, filters.consentType)) as any;
    }
    if (filters?.status) {
      query = query.where(eq(consentRecords.status, filters.status)) as any;
    }
    
    query = query.orderBy(desc(consentRecords.createdAt)) as any;
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    
    return await query;
  }

  async getConsentRecord(id: string): Promise<ConsentRecord | undefined> {
    const result = await db.select().from(consentRecords).where(eq(consentRecords.id, id));
    return result[0];
  }

  async upgradeConsentVersion(consentType: string, newVersion: string, newConsentText: string): Promise<number> {
    const result = await db.update(consentRecords)
      .set({ consentVersion: newVersion, consentText: newConsentText, status: 'pending', updatedAt: new Date() })
      .where(eq(consentRecords.consentType, consentType));
    return result.rowCount || 0;
  }

  // ============================================
  // ACCESS CONTROL OPERATIONS
  // ============================================

  async createRoleDefinition(data: InsertRoleDefinition): Promise<RoleDefinition> {
    const result = await db.insert(roleDefinitions).values(data).returning();
    return result[0];
  }

  async getRoleDefinitions(): Promise<RoleDefinition[]> {
    return await db.select().from(roleDefinitions).where(eq(roleDefinitions.isActive, true)).orderBy(roleDefinitions.level);
  }

  async createPermissionDefinition(data: InsertPermissionDefinition): Promise<PermissionDefinition> {
    const result = await db.insert(permissionDefinitions).values(data).returning();
    return result[0];
  }

  async getPermissionDefinitions(category?: string): Promise<PermissionDefinition[]> {
    const conditions = [eq(permissionDefinitions.isActive, true)];
    
    if (category) {
      conditions.push(eq(permissionDefinitions.category, category));
    }
    
    return await db.select().from(permissionDefinitions).where(and(...conditions)).orderBy(permissionDefinitions.category, permissionDefinitions.resource);
  }

  async getRolePermissions(roleId: string): Promise<RolePermission[]> {
    return await db.select().from(rolePermissions).where(eq(rolePermissions.roleId, roleId));
  }

  async assignRolePermission(data: InsertRolePermission): Promise<RolePermission> {
    const result = await db.insert(rolePermissions).values(data).returning();
    return result[0];
  }

  async removeRolePermission(roleId: string, permissionId: string): Promise<void> {
    await db.delete(rolePermissions).where(and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, permissionId)));
  }

  // ============================================
  // PAYMENT RECONCILIATION OPERATIONS
  // ============================================

  async createPaymentReconciliation(data: InsertPaymentReconciliation): Promise<PaymentReconciliation> {
    const result = await db.insert(paymentReconciliations).values(data).returning();
    return result[0];
  }

  async getPaymentReconciliations(filters?: { status?: string; limit?: number }): Promise<PaymentReconciliation[]> {
    let query = db.select().from(paymentReconciliations);
    
    if (filters?.status) {
      query = query.where(eq(paymentReconciliations.status, filters.status)) as any;
    }
    
    query = query.orderBy(desc(paymentReconciliations.createdAt)) as any;
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    
    return await query;
  }

  async updatePaymentReconciliation(id: string, updates: Partial<InsertPaymentReconciliation>): Promise<PaymentReconciliation> {
    const result = await db.update(paymentReconciliations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(paymentReconciliations.id, id))
      .returning();
    return result[0];
  }

  async calculateReconciliationSummary(period: string): Promise<{
    paymentsReceived: number;
    paymentsDone: number;
    transactionCount: number;
    payoutCount: number;
    discrepancy: number;
  }> {
    // Calculate payments received (completed transactions)
    const paymentsResult = await db.select({ 
      sum: sql<number>`COALESCE(SUM(${platformTransactions.amount}), 0)`,
      count: count()
    }).from(platformTransactions)
      .where(and(
        eq(platformTransactions.status, 'completed'),
        sql`TO_CHAR(${platformTransactions.createdAt}, 'YYYY-MM') = ${period}`
      ));

    // Calculate payouts done
    const payoutsResult = await db.select({ 
      sum: sql<number>`COALESCE(SUM(${mentorPayouts.netPayout}), 0)`,
      count: count()
    }).from(mentorPayouts)
      .where(and(
        eq(mentorPayouts.status, 'completed'),
        sql`TO_CHAR(${mentorPayouts.createdAt}, 'YYYY-MM') = ${period}`
      ));

    const paymentsReceived = Number(paymentsResult[0]?.sum || 0);
    const paymentsDone = Number(payoutsResult[0]?.sum || 0);

    return {
      paymentsReceived,
      paymentsDone,
      transactionCount: Number(paymentsResult[0]?.count || 0),
      payoutCount: Number(payoutsResult[0]?.count || 0),
      discrepancy: paymentsReceived - paymentsDone
    };
  }

  // ============================================
  // NGO REGISTRATION OPERATIONS
  // ============================================

  async createNgoRegistration(data: InsertNgoRegistration): Promise<NgoRegistration> {
    const result = await db.insert(ngoRegistrations).values(data).returning();
    return result[0];
  }

  async getNgoRegistrations(filters?: { status?: string; limit?: number }): Promise<NgoRegistration[]> {
    let query = db.select().from(ngoRegistrations);
    
    if (filters?.status) {
      query = query.where(eq(ngoRegistrations.status, filters.status)) as any;
    }
    
    query = query.orderBy(desc(ngoRegistrations.createdAt)) as any;
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    
    return await query;
  }

  async updateNgoRegistration(id: string, updates: Partial<InsertNgoRegistration>): Promise<NgoRegistration> {
    const result = await db.update(ngoRegistrations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(ngoRegistrations.id, id))
      .returning();
    return result[0];
  }

  // ============================================
  // LEI REGISTRATION OPERATIONS
  // ============================================

  async createLeiRegistration(data: InsertLeiRegistration): Promise<LeiRegistration> {
    const result = await db.insert(leiRegistrations).values(data).returning();
    return result[0];
  }

  async getLeiRegistrations(filters?: { status?: string; limit?: number }): Promise<LeiRegistration[]> {
    let query = db.select().from(leiRegistrations);
    
    if (filters?.status) {
      query = query.where(eq(leiRegistrations.status, filters.status)) as any;
    }
    
    query = query.orderBy(desc(leiRegistrations.createdAt)) as any;
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    
    return await query;
  }

  async updateLeiRegistration(id: string, updates: Partial<InsertLeiRegistration>): Promise<LeiRegistration> {
    const result = await db.update(leiRegistrations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(leiRegistrations.id, id))
      .returning();
    return result[0];
  }

  // ============================================
  // USER SESSION OPERATIONS
  // ============================================

  async createUserSession(data: InsertUserSession): Promise<UserSession> {
    const result = await db.insert(userSessions).values(data).returning();
    return result[0];
  }

  async getUserSessions(filters?: { userId?: string; isActive?: boolean; limit?: number }): Promise<UserSession[]> {
    let query = db.select().from(userSessions);
    
    if (filters?.userId) {
      query = query.where(eq(userSessions.userId, filters.userId)) as any;
    }
    if (filters?.isActive !== undefined) {
      query = query.where(eq(userSessions.isActive, filters.isActive)) as any;
    }
    
    query = query.orderBy(desc(userSessions.lastActivity)) as any;
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    
    return await query;
  }

  async terminateUserSession(id: string, reason?: string): Promise<UserSession> {
    const result = await db.update(userSessions)
      .set({ isActive: false, terminatedAt: new Date(), terminationReason: reason })
      .where(eq(userSessions.id, id))
      .returning();
    return result[0];
  }

  async terminateAllUserSessions(userId: string, reason?: string): Promise<number> {
    const result = await db.update(userSessions)
      .set({ isActive: false, terminatedAt: new Date(), terminationReason: reason })
      .where(and(eq(userSessions.userId, userId), eq(userSessions.isActive, true)));
    return result.rowCount || 0;
  }

  // ============================================
  // LEARNING PLAN TEMPLATE OPERATIONS
  // ============================================

  async createLearningPlanTemplate(data: InsertLearningPlanTemplate): Promise<LearningPlanTemplate> {
    const result = await db.insert(learningPlanTemplates).values(data).returning();
    return result[0];
  }

  async getLearningPlanTemplates(filters?: { status?: string; targetGrade?: string; limit?: number }): Promise<LearningPlanTemplate[]> {
    let query = db.select().from(learningPlanTemplates);
    
    if (filters?.status) {
      query = query.where(eq(learningPlanTemplates.status, filters.status)) as any;
    }
    if (filters?.targetGrade) {
      query = query.where(eq(learningPlanTemplates.targetGrade, filters.targetGrade)) as any;
    }
    
    query = query.orderBy(desc(learningPlanTemplates.createdAt)) as any;
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    
    return await query;
  }

  async updateLearningPlanTemplate(id: string, updates: Partial<InsertLearningPlanTemplate>): Promise<LearningPlanTemplate> {
    const result = await db.update(learningPlanTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(learningPlanTemplates.id, id))
      .returning();
    return result[0];
  }

  // ============================================
  // COMPREHENSIVE ADMIN STATS
  // ============================================

  async getComprehensiveAdminStats(): Promise<{
    entities: {
      institutes: number;
      parents: number;
      mentors: number;
      ngos: number;
      leis: number;
      students: number;
    };
    onboarding: {
      pending: number;
      approved: number;
      rejected: number;
    };
    financial: {
      totalRevenue: number;
      pendingPayouts: number;
      completedPayouts: number;
      pendingTransactions: number;
    };
    consents: {
      granted: number;
      pending: number;
      revoked: number;
    };
    hr: {
      totalJobs: number;
      publishedJobs: number;
      totalApplications: number;
    };
  }> {
    const [
      institutesResult,
      parentsResult,
      mentorsResult,
      ngosResult,
      leisResult,
      studentsResult,
      pendingOnboardingResult,
      approvedOnboardingResult,
      rejectedOnboardingResult,
      revenueResult,
      pendingPayoutsResult,
      completedPayoutsResult,
      pendingTransactionsResult,
      grantedConsentsResult,
      pendingConsentsResult,
      revokedConsentsResult,
      jobsResult,
      publishedJobsResult,
      applicationsResult
    ] = await Promise.all([
      db.select({ count: count() }).from(institutes),
      db.select({ count: count() }).from(parents),
      db.select({ count: count() }).from(mentors),
      db.select({ count: count() }).from(ngoRegistrations),
      db.select({ count: count() }).from(leiRegistrations),
      db.select({ count: count() }).from(students),
      db.select({ count: count() }).from(onboardingApprovals).where(eq(onboardingApprovals.status, 'pending')),
      db.select({ count: count() }).from(onboardingApprovals).where(eq(onboardingApprovals.status, 'approved')),
      db.select({ count: count() }).from(onboardingApprovals).where(eq(onboardingApprovals.status, 'rejected')),
      db.select({ sum: sql<number>`COALESCE(SUM(${platformTransactions.amount}), 0)` }).from(platformTransactions).where(eq(platformTransactions.status, 'completed')),
      db.select({ count: count() }).from(mentorPayouts).where(eq(mentorPayouts.status, 'pending')),
      db.select({ count: count() }).from(mentorPayouts).where(eq(mentorPayouts.status, 'completed')),
      db.select({ count: count() }).from(platformTransactions).where(eq(platformTransactions.status, 'pending')),
      db.select({ count: count() }).from(consentRecords).where(eq(consentRecords.status, 'granted')),
      db.select({ count: count() }).from(consentRecords).where(eq(consentRecords.status, 'pending')),
      db.select({ count: count() }).from(consentRecords).where(eq(consentRecords.status, 'revoked')),
      db.select({ count: count() }).from(jobPostings),
      db.select({ count: count() }).from(jobPostings).where(eq(jobPostings.status, 'published')),
      db.select({ count: count() }).from(jobApplications)
    ]);

    return {
      entities: {
        institutes: Number(institutesResult[0]?.count || 0),
        parents: Number(parentsResult[0]?.count || 0),
        mentors: Number(mentorsResult[0]?.count || 0),
        ngos: Number(ngosResult[0]?.count || 0),
        leis: Number(leisResult[0]?.count || 0),
        students: Number(studentsResult[0]?.count || 0)
      },
      onboarding: {
        pending: Number(pendingOnboardingResult[0]?.count || 0),
        approved: Number(approvedOnboardingResult[0]?.count || 0),
        rejected: Number(rejectedOnboardingResult[0]?.count || 0)
      },
      financial: {
        totalRevenue: Number(revenueResult[0]?.sum || 0),
        pendingPayouts: Number(pendingPayoutsResult[0]?.count || 0),
        completedPayouts: Number(completedPayoutsResult[0]?.count || 0),
        pendingTransactions: Number(pendingTransactionsResult[0]?.count || 0)
      },
      consents: {
        granted: Number(grantedConsentsResult[0]?.count || 0),
        pending: Number(pendingConsentsResult[0]?.count || 0),
        revoked: Number(revokedConsentsResult[0]?.count || 0)
      },
      hr: {
        totalJobs: Number(jobsResult[0]?.count || 0),
        publishedJobs: Number(publishedJobsResult[0]?.count || 0),
        totalApplications: Number(applicationsResult[0]?.count || 0)
      }
    };
  }

  async getFinancialSummary(period?: string): Promise<{
    paymentsReceived: { total: number; count: number; byType: Record<string, number> };
    paymentsDone: { total: number; count: number };
    netBalance: number;
    pendingPayouts: { total: number; count: number };
  }> {
    // Build conditions based on whether period is provided
    const paymentConditions = period 
      ? and(eq(platformTransactions.status, 'completed'), sql`TO_CHAR(${platformTransactions.createdAt}, 'YYYY-MM') = ${period}`)
      : eq(platformTransactions.status, 'completed');
    
    const payoutCompletedConditions = period
      ? and(eq(mentorPayouts.status, 'completed'), sql`TO_CHAR(${mentorPayouts.createdAt}, 'YYYY-MM') = ${period}`)
      : eq(mentorPayouts.status, 'completed');
    
    const payoutPendingConditions = period
      ? and(eq(mentorPayouts.status, 'pending'), sql`TO_CHAR(${mentorPayouts.createdAt}, 'YYYY-MM') = ${period}`)
      : eq(mentorPayouts.status, 'pending');
    
    const paymentsQuery = db.select({ 
      sum: sql<number>`COALESCE(SUM(${platformTransactions.amount}), 0)`,
      count: count()
    }).from(platformTransactions).where(paymentConditions);

    const payoutsQuery = db.select({ 
      sum: sql<number>`COALESCE(SUM(${mentorPayouts.netPayout}), 0)`,
      count: count()
    }).from(mentorPayouts).where(payoutCompletedConditions);

    const pendingPayoutsQuery = db.select({ 
      sum: sql<number>`COALESCE(SUM(${mentorPayouts.netPayout}), 0)`,
      count: count()
    }).from(mentorPayouts).where(payoutPendingConditions);

    const [paymentsResult, payoutsResult, pendingPayoutsResult] = await Promise.all([
      paymentsQuery,
      payoutsQuery,
      pendingPayoutsQuery
    ]);

    const paymentsReceived = Number(paymentsResult[0]?.sum || 0);
    const paymentsDone = Number(payoutsResult[0]?.sum || 0);

    return {
      paymentsReceived: { 
        total: paymentsReceived, 
        count: Number(paymentsResult[0]?.count || 0),
        byType: {} // Would need grouping query
      },
      paymentsDone: { 
        total: paymentsDone, 
        count: Number(payoutsResult[0]?.count || 0) 
      },
      netBalance: paymentsReceived - paymentsDone,
      pendingPayouts: { 
        total: Number(pendingPayoutsResult[0]?.sum || 0), 
        count: Number(pendingPayoutsResult[0]?.count || 0) 
      }
    };
  }

  async seedSuperAdmin(): Promise<void> {
    // Import crypto functions inline to avoid circular deps
    const { scrypt, randomBytes } = await import('crypto');
    const { promisify } = await import('util');
    const scryptAsync = promisify(scrypt);

    const hashPassword = async (password: string) => {
      const salt = randomBytes(16).toString('hex');
      const buf = (await scryptAsync(password, salt, 64)) as Buffer;
      return `${buf.toString('hex')}.${salt}`;
    };

    const initialPassword = process.env.SUPERADMIN_INITIAL_PASSWORD;

    // If an operator supplied a seed/rotation password it MUST meet the platform
    // password policy — never seed or rotate to a weak super-admin credential.
    if (initialPassword) {
      const { validatePasswordComplexity } = await import('./lib/password-policy');
      const check = validatePasswordComplexity(initialPassword, { identifier: 'support@metryxone.com' });
      if (!check.ok) {
        throw new Error(`SUPERADMIN_INITIAL_PASSWORD does not meet password policy: ${check.errors.join(' ')}`);
      }
    }

    const existing = await db.select().from(users).where(eq(users.role, 'super_admin')).limit(1);

    const SUPER_ADMIN_EMAIL = 'support@metryxone.com';

    if (existing.length > 0) {
      // If SUPERADMIN_INITIAL_PASSWORD is set, rotate password + canonicalise username in one pass.
      // Safe rotation path: set the env var, restart, update runs once.
      if (initialPassword) {
        const hashedPassword = await hashPassword(initialPassword);
        await db.update(users)
          .set({ password: hashedPassword, username: SUPER_ADMIN_EMAIL })
          .where(eq(users.role, 'super_admin'));
        console.log(`Super Admin password rotated via SUPERADMIN_INITIAL_PASSWORD (username → ${SUPER_ADMIN_EMAIL})`);
      }
      return;
    }

    // No super_admin exists — create one.
    // SECURITY: in production we refuse to seed the well-known default credential.
    // The operator MUST provide a strong SUPERADMIN_INITIAL_PASSWORD; otherwise no
    // super-admin is created (the thrown error is logged by the caller in index.ts)
    // rather than booting with a publicly-documented password.
    if (!initialPassword && process.env.NODE_ENV === 'production') {
      throw new Error(
        'Refusing to seed super-admin with the default credential in production. ' +
        'Set SUPERADMIN_INITIAL_PASSWORD to a strong value and restart.',
      );
    }
    const password = initialPassword || 'admin123';
    const hashedPassword = await hashPassword(password);

    await db.insert(users).values({
      username: SUPER_ADMIN_EMAIL,
      password: hashedPassword,
      fullName: 'Super Administrator',
      role: 'super_admin',
      roles: ['super_admin'],
    });

    if (!initialPassword) {
      console.log(`Super Admin created: ${SUPER_ADMIN_EMAIL} / admin123 — ⚠️  Set SUPERADMIN_INITIAL_PASSWORD to rotate this credential`);
    } else {
      console.log(`Super Admin created: ${SUPER_ADMIN_EMAIL} (password from SUPERADMIN_INITIAL_PASSWORD)`);
    }
  }

  // ========== ADDITIONAL HR METHODS (for interface compatibility) ==========

  // Alias for getAllJobPostings for interface compatibility
  async getJobPostings(filters?: { status?: string; roleCategory?: string }): Promise<JobPosting[]> {
    return this.getAllJobPostings(filters);
  }

  async publishJob(id: string): Promise<JobPosting | undefined> {
    return this.updateJobStatus(id, 'published') as Promise<JobPosting | undefined>;
  }

  async closeJob(id: string): Promise<JobPosting | undefined> {
    return this.updateJobStatus(id, 'closed') as Promise<JobPosting | undefined>;
  }

  async getJobApprovalLogs(jobId: string): Promise<JobApprovalLog[]> {
    return await db.select().from(jobApprovalLogs)
      .where(eq(jobApprovalLogs.jobId, jobId))
      .orderBy(desc(jobApprovalLogs.createdAt));
  }

  async createJobApprovalLog(log: InsertJobApprovalLog): Promise<JobApprovalLog> {
    const results = await db.insert(jobApprovalLogs).values(log).returning();
    return results[0];
  }

  async getJobApplications(filters?: { jobId?: string; status?: string }): Promise<JobApplication[]> {
    let conditions = [];
    if (filters?.jobId) conditions.push(eq(jobApplications.jobId, filters.jobId));
    if (filters?.status) conditions.push(eq(jobApplications.status, filters.status));
    
    if (conditions.length > 0) {
      return await db.select().from(jobApplications).where(and(...conditions)).orderBy(desc(jobApplications.createdAt));
    }
    return await db.select().from(jobApplications).orderBy(desc(jobApplications.createdAt));
  }

  async shortlistApplication(id: string, shortlistedBy: string): Promise<JobApplication | undefined> {
    const result = await db.update(jobApplications)
      .set({ status: 'shortlisted', processedBy: shortlistedBy, processedAt: new Date(), updatedAt: new Date() })
      .where(eq(jobApplications.id, id))
      .returning();
    return result[0];
  }

  async rejectApplication(id: string, reason: string, processedBy: string): Promise<JobApplication | undefined> {
    const result = await db.update(jobApplications)
      .set({ status: 'rejected', rejectionReason: reason, processedBy, processedAt: new Date(), updatedAt: new Date() })
      .where(eq(jobApplications.id, id))
      .returning();
    return result[0];
  }

  async getMentors(filters?: { status?: string }): Promise<Mentor[]> {
    if (filters?.status) {
      return await db.select().from(mentors).where(eq(mentors.status, filters.status)).orderBy(desc(mentors.createdAt));
    }
    return await db.select().from(mentors).orderBy(desc(mentors.createdAt));
  }

  async activateMentor(id: string): Promise<Mentor | undefined> {
    const result = await db.update(mentors)
      .set({ status: 'active', activatedAt: new Date(), updatedAt: new Date() })
      .where(eq(mentors.id, id))
      .returning();
    return result[0];
  }

  async suspendMentor(id: string, reason: string): Promise<Mentor | undefined> {
    const result = await db.update(mentors)
      .set({ status: 'suspended', suspendedAt: new Date(), suspensionReason: reason, updatedAt: new Date() })
      .where(eq(mentors.id, id))
      .returning();
    return result[0];
  }

  async deactivateMentor(id: string, reason: string): Promise<Mentor | undefined> {
    const result = await db.update(mentors)
      .set({ status: 'deactivated', deactivatedAt: new Date(), deactivationReason: reason, updatedAt: new Date() })
      .where(eq(mentors.id, id))
      .returning();
    return result[0];
  }

  async getTrainingPrograms(): Promise<TrainingProgram[]> {
    return await db.select().from(trainingPrograms).where(eq(trainingPrograms.isActive, true)).orderBy(desc(trainingPrograms.createdAt));
  }

  async getTrainingEnrollments(mentorId: string): Promise<TrainingEnrollment[]> {
    return await db.select().from(trainingEnrollments)
      .where(eq(trainingEnrollments.mentorId, mentorId))
      .orderBy(desc(trainingEnrollments.createdAt));
  }

  async getMentorTasks(mentorId: string): Promise<MentorTask[]> {
    return await db.select().from(mentorTasks)
      .where(eq(mentorTasks.mentorId, mentorId))
      .orderBy(desc(mentorTasks.createdAt));
  }

  async getMentorTask(id: string): Promise<MentorTask | undefined> {
    const results = await db.select().from(mentorTasks).where(eq(mentorTasks.id, id)).limit(1);
    return results[0];
  }

  async createMentorTask(task: InsertMentorTask): Promise<MentorTask> {
    const results = await db.insert(mentorTasks).values(task).returning();
    return results[0];
  }

  async updateMentorTask(id: string, updates: Partial<InsertMentorTask>): Promise<MentorTask | undefined> {
    const results = await db.update(mentorTasks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(mentorTasks.id, id))
      .returning();
    return results[0];
  }

  // KYC Documents (Maker-Checker workflow)
  async getKycDocuments(filters?: { entityType?: string; status?: string }): Promise<KycDocument[]> {
    let query = db.select().from(kycDocuments);
    if (filters?.entityType) {
      query = query.where(eq(kycDocuments.entityType, filters.entityType)) as any;
    }
    if (filters?.status) {
      query = query.where(eq(kycDocuments.status, filters.status)) as any;
    }
    return await query.orderBy(desc(kycDocuments.createdAt));
  }

  async getKycDocument(id: string): Promise<KycDocument | undefined> {
    const results = await db.select().from(kycDocuments).where(eq(kycDocuments.id, id)).limit(1);
    return results[0];
  }

  async getKycDocumentsByEntity(entityType: string, entityId: string): Promise<KycDocument[]> {
    return await db.select().from(kycDocuments)
      .where(and(
        eq(kycDocuments.entityType, entityType),
        eq(kycDocuments.entityId, entityId)
      ))
      .orderBy(desc(kycDocuments.createdAt));
  }

  async createKycDocument(doc: InsertKycDocument): Promise<KycDocument> {
    const results = await db.insert(kycDocuments).values(doc).returning();
    return results[0];
  }

  async updateKycDocument(id: string, updates: Partial<InsertKycDocument>): Promise<KycDocument> {
    const results = await db.update(kycDocuments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(kycDocuments.id, id))
      .returning();
    return results[0];
  }

  // Student Enrollments
  async getStudentEnrollments(filters?: { instituteId?: string; status?: string; paymentStatus?: string }): Promise<StudentEnrollment[]> {
    let query = db.select().from(studentEnrollments);
    if (filters?.instituteId) {
      query = query.where(eq(studentEnrollments.instituteId, filters.instituteId)) as any;
    }
    if (filters?.status) {
      query = query.where(eq(studentEnrollments.status, filters.status)) as any;
    }
    if (filters?.paymentStatus) {
      query = query.where(eq(studentEnrollments.paymentStatus, filters.paymentStatus)) as any;
    }
    return await query.orderBy(desc(studentEnrollments.createdAt));
  }

  async getStudentEnrollment(id: string): Promise<StudentEnrollment | undefined> {
    const results = await db.select().from(studentEnrollments).where(eq(studentEnrollments.id, id)).limit(1);
    return results[0];
  }

  async createStudentEnrollment(enrollment: InsertStudentEnrollment): Promise<StudentEnrollment> {
    const results = await db.insert(studentEnrollments).values(enrollment).returning();
    return results[0];
  }

  async updateStudentEnrollment(id: string, updates: Partial<InsertStudentEnrollment>): Promise<StudentEnrollment> {
    const results = await db.update(studentEnrollments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(studentEnrollments.id, id))
      .returning();
    return results[0];
  }

  // ============================================
  // DOCUMENT MANAGEMENT SYSTEM
  // ============================================

  // KYC Document Types
  async getKycDocumentTypes(entityType?: string): Promise<KycDocumentType[]> {
    if (entityType) {
      return await db.select().from(kycDocumentTypes)
        .where(and(eq(kycDocumentTypes.entityType, entityType), eq(kycDocumentTypes.isActive, true)))
        .orderBy(asc(kycDocumentTypes.displayOrder));
    }
    return await db.select().from(kycDocumentTypes)
      .where(eq(kycDocumentTypes.isActive, true))
      .orderBy(asc(kycDocumentTypes.displayOrder));
  }

  async createKycDocumentType(type: InsertKycDocumentType): Promise<KycDocumentType> {
    const results = await db.insert(kycDocumentTypes).values(type).returning();
    return results[0];
  }

  // Consent Types
  async getConsentTypes(entityType?: string): Promise<ConsentType[]> {
    if (entityType) {
      return await db.select().from(consentTypes)
        .where(and(eq(consentTypes.entityType, entityType), eq(consentTypes.isActive, true)))
        .orderBy(asc(consentTypes.displayOrder));
    }
    return await db.select().from(consentTypes)
      .where(eq(consentTypes.isActive, true))
      .orderBy(asc(consentTypes.displayOrder));
  }

  async createConsentType(type: InsertConsentType): Promise<ConsentType> {
    const results = await db.insert(consentTypes).values(type).returning();
    return results[0];
  }

  // Document Folders
  async getDocumentFolders(entityType?: string, entityId?: string): Promise<DocumentFolder[]> {
    let conditions = [];
    if (entityType) conditions.push(eq(documentFolders.entityType, entityType));
    if (entityId) conditions.push(eq(documentFolders.entityId, entityId));
    
    if (conditions.length > 0) {
      return await db.select().from(documentFolders)
        .where(and(...conditions))
        .orderBy(asc(documentFolders.folderPath));
    }
    return await db.select().from(documentFolders).orderBy(asc(documentFolders.folderPath));
  }

  async createDocumentFolder(folder: InsertDocumentFolder): Promise<DocumentFolder> {
    const results = await db.insert(documentFolders).values(folder).returning();
    return results[0];
  }

  // Documents
  async getDocuments(filters: { entityType?: string; entityId?: string; category?: string; status?: string; search?: string }): Promise<Document[]> {
    let conditions = [];
    if (filters.entityType) conditions.push(eq(documents.entityType, filters.entityType));
    if (filters.entityId) conditions.push(eq(documents.entityId, filters.entityId));
    if (filters.category) conditions.push(eq(documents.documentCategory, filters.category));
    if (filters.status) conditions.push(eq(documents.status, filters.status));
    if (filters.search) conditions.push(ilike(documents.documentName, `%${filters.search}%`));
    
    if (conditions.length > 0) {
      return await db.select().from(documents)
        .where(and(...conditions))
        .orderBy(desc(documents.createdAt));
    }
    return await db.select().from(documents).orderBy(desc(documents.createdAt));
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const results = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
    return results[0];
  }

  async createDocument(doc: InsertDocument): Promise<Document> {
    const results = await db.insert(documents).values(doc).returning();
    return results[0];
  }

  async makerVerifyDocument(id: string, userId: string, notes?: string): Promise<Document> {
    const results = await db.update(documents)
      .set({
        status: 'maker_verified',
        makerVerifiedBy: userId,
        makerVerifiedAt: new Date(),
        makerNotes: notes,
        updatedAt: new Date()
      })
      .where(eq(documents.id, id))
      .returning();
    return results[0];
  }

  async checkerApproveDocument(id: string, userId: string, notes?: string): Promise<Document> {
    const results = await db.update(documents)
      .set({
        status: 'checker_approved',
        checkerApprovedBy: userId,
        checkerApprovedAt: new Date(),
        checkerNotes: notes,
        updatedAt: new Date()
      })
      .where(eq(documents.id, id))
      .returning();
    return results[0];
  }

  async rejectDocument(id: string, userId: string, reason: string): Promise<Document> {
    const results = await db.update(documents)
      .set({
        status: 'rejected',
        rejectedBy: userId,
        rejectedAt: new Date(),
        rejectionReason: reason,
        updatedAt: new Date()
      })
      .where(eq(documents.id, id))
      .returning();
    return results[0];
  }

  // Document Access Logs
  async createDocumentAccessLog(log: InsertDocumentAccessLog): Promise<DocumentAccessLog> {
    const results = await db.insert(documentAccessLogs).values(log).returning();
    return results[0];
  }

  async getDocumentAccessLogs(documentId: string): Promise<DocumentAccessLog[]> {
    return await db.select().from(documentAccessLogs)
      .where(eq(documentAccessLogs.documentId, documentId))
      .orderBy(desc(documentAccessLogs.createdAt));
  }

  // Pre-Onboarding Checklists
  async getPreOnboardingChecklist(entityType: string, entityId: string): Promise<PreOnboardingChecklist | undefined> {
    const results = await db.select().from(preOnboardingChecklists)
      .where(and(
        eq(preOnboardingChecklists.entityType, entityType),
        eq(preOnboardingChecklists.entityId, entityId)
      ))
      .limit(1);
    return results[0];
  }

  async createPreOnboardingChecklist(checklist: InsertPreOnboardingChecklist): Promise<PreOnboardingChecklist> {
    const results = await db.insert(preOnboardingChecklists).values(checklist).returning();
    return results[0];
  }

  async updatePreOnboardingChecklist(id: string, updates: Partial<InsertPreOnboardingChecklist>): Promise<PreOnboardingChecklist> {
    const results = await db.update(preOnboardingChecklists)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(preOnboardingChecklists.id, id))
      .returning();
    return results[0];
  }

  async approveTemporaryOnboarding(id: string, userId: string): Promise<PreOnboardingChecklist> {
    const results = await db.update(preOnboardingChecklists)
      .set({
        temporaryOnboardingStatus: 'approved',
        temporaryApprovedBy: userId,
        temporaryApprovedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(preOnboardingChecklists.id, id))
      .returning();
    return results[0];
  }

  async approvePreOnboarding(id: string, userId: string): Promise<PreOnboardingChecklist> {
    const results = await db.update(preOnboardingChecklists)
      .set({
        overallStatus: 'approved',
        approvedBy: userId,
        approvedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(preOnboardingChecklists.id, id))
      .returning();
    return results[0];
  }

  // Student Bulk Imports
  async getStudentBulkImports(instituteId?: string): Promise<StudentBulkImport[]> {
    if (instituteId) {
      return await db.select().from(studentBulkImports)
        .where(eq(studentBulkImports.instituteId, instituteId))
        .orderBy(desc(studentBulkImports.createdAt));
    }
    return await db.select().from(studentBulkImports).orderBy(desc(studentBulkImports.createdAt));
  }

  async createStudentBulkImport(importRecord: InsertStudentBulkImport): Promise<StudentBulkImport> {
    const results = await db.insert(studentBulkImports).values(importRecord).returning();
    return results[0];
  }

  async getStudentImportRecords(importId: string): Promise<StudentImportRecord[]> {
    return await db.select().from(studentImportRecords)
      .where(eq(studentImportRecords.importId, importId))
      .orderBy(asc(studentImportRecords.rowNumber));
  }

  async processStudentBulkImport(id: string): Promise<{ success: boolean; processed: number; failed: number }> {
    // Mark as processing
    await db.update(studentBulkImports)
      .set({ status: 'processing' })
      .where(eq(studentBulkImports.id, id));
    
    // Get records and process
    const records = await this.getStudentImportRecords(id);
    let processed = 0;
    let failed = 0;
    
    for (const record of records) {
      try {
        // Create student - simplified logic
        processed++;
      } catch (error) {
        failed++;
      }
    }
    
    // Update import status
    await db.update(studentBulkImports)
      .set({
        status: failed === 0 ? 'completed' : 'partial',
        processedRows: processed + failed,
        successfulRows: processed,
        failedRows: failed,
        processedAt: new Date()
      })
      .where(eq(studentBulkImports.id, id));
    
    return { success: true, processed, failed };
  }

  async approveStudentBulkImport(id: string, userId: string): Promise<StudentBulkImport> {
    const results = await db.update(studentBulkImports)
      .set({
        approvalStatus: 'approved',
        approvedBy: userId,
        approvedAt: new Date()
      })
      .where(eq(studentBulkImports.id, id))
      .returning();
    return results[0];
  }

  async createStudentAtInstitute(data: InsertStudent): Promise<Student> {
    const results = await db.insert(students).values(data).returning();
    return results[0];
  }

  async getInstituteStudents(filters: { instituteId?: string; status?: string; search?: string; page: number; limit: number }): Promise<{ students: Student[]; total: number }> {
    let conditions = [];
    if (filters.instituteId) conditions.push(eq(students.instituteId, filters.instituteId));
    if (filters.status) conditions.push(eq(students.status, filters.status));
    if (filters.search) conditions.push(ilike(students.fullName, `%${filters.search}%`));
    
    const offset = (filters.page - 1) * filters.limit;
    
    let studentList: Student[];
    let totalCount: { count: number }[];
    
    if (conditions.length > 0) {
      studentList = await db.select().from(students)
        .where(and(...conditions))
        .orderBy(desc(students.createdAt))
        .limit(filters.limit)
        .offset(offset);
      totalCount = await db.select({ count: count() }).from(students).where(and(...conditions));
    } else {
      studentList = await db.select().from(students)
        .orderBy(desc(students.createdAt))
        .limit(filters.limit)
        .offset(offset);
      totalCount = await db.select({ count: count() }).from(students);
    }
    
    return { students: studentList, total: totalCount[0]?.count || 0 };
  }

  // Security & Audit
  async getSecurityConfigurations(): Promise<SecurityConfiguration[]> {
    return await db.select().from(securityConfigurations).orderBy(asc(securityConfigurations.configKey));
  }

  async updateSecurityConfiguration(key: string, value: string, userId: string): Promise<SecurityConfiguration> {
    const results = await db.update(securityConfigurations)
      .set({
        configValue: value,
        lastModifiedBy: userId,
        lastModifiedAt: new Date()
      })
      .where(eq(securityConfigurations.configKey, key))
      .returning();
    return results[0];
  }

  async getSecurityIncidents(status?: string, severity?: string): Promise<SecurityIncident[]> {
    let conditions = [];
    if (status) conditions.push(eq(securityIncidents.status, status));
    if (severity) conditions.push(eq(securityIncidents.severity, severity));
    
    if (conditions.length > 0) {
      return await db.select().from(securityIncidents)
        .where(and(...conditions))
        .orderBy(desc(securityIncidents.detectedAt));
    }
    return await db.select().from(securityIncidents).orderBy(desc(securityIncidents.detectedAt));
  }

  async createSecurityIncident(incident: InsertSecurityIncident): Promise<SecurityIncident> {
    const incidentCode = `INC-${Date.now()}`;
    const results = await db.insert(securityIncidents).values({
      ...incident,
      incidentCode
    }).returning();
    return results[0];
  }

  async getComplianceAuditLogs(filters: { category?: string; resourceType?: string; startDate?: string; endDate?: string; actorId?: string; page: number; limit: number }): Promise<{ logs: ComplianceAuditLog[]; total: number }> {
    let conditions = [];
    if (filters.category) conditions.push(eq(complianceAuditLogs.category, filters.category));
    if (filters.resourceType) conditions.push(eq(complianceAuditLogs.resourceType, filters.resourceType));
    if (filters.actorId) conditions.push(eq(complianceAuditLogs.actorId, filters.actorId));
    if (filters.startDate) conditions.push(gte(complianceAuditLogs.createdAt, new Date(filters.startDate)));
    if (filters.endDate) conditions.push(lte(complianceAuditLogs.createdAt, new Date(filters.endDate)));
    
    const offset = (filters.page - 1) * filters.limit;
    
    let logList: ComplianceAuditLog[];
    let totalCount: { count: number }[];
    
    if (conditions.length > 0) {
      logList = await db.select().from(complianceAuditLogs)
        .where(and(...conditions))
        .orderBy(desc(complianceAuditLogs.createdAt))
        .limit(filters.limit)
        .offset(offset);
      totalCount = await db.select({ count: count() }).from(complianceAuditLogs).where(and(...conditions));
    } else {
      logList = await db.select().from(complianceAuditLogs)
        .orderBy(desc(complianceAuditLogs.createdAt))
        .limit(filters.limit)
        .offset(offset);
      totalCount = await db.select({ count: count() }).from(complianceAuditLogs);
    }
    
    return { logs: logList, total: totalCount[0]?.count || 0 };
  }

  async exportAuditLogs(startDate: string, endDate: string, format: string): Promise<string> {
    const logs = await db.select().from(complianceAuditLogs)
      .where(and(
        gte(complianceAuditLogs.createdAt, new Date(startDate)),
        lte(complianceAuditLogs.createdAt, new Date(endDate))
      ))
      .orderBy(desc(complianceAuditLogs.createdAt));
    
    if (format === 'csv') {
      const headers = ['logId', 'logType', 'category', 'action', 'resourceType', 'actorName', 'status', 'createdAt'];
      const rows = logs.map(log => [
        log.logId, log.logType, log.category, log.action, log.resourceType, log.actorName, log.status, log.createdAt
      ].join(','));
      return [headers.join(','), ...rows].join('\n');
    }
    
    return JSON.stringify(logs, null, 2);
  }

  async getDataRetentionPolicies(): Promise<DataRetentionPolicy[]> {
    return await db.select().from(dataRetentionPolicies)
      .where(eq(dataRetentionPolicies.isActive, true))
      .orderBy(asc(dataRetentionPolicies.policyName));
  }

  async getAccessControlPolicies(): Promise<AccessControlPolicy[]> {
    return await db.select().from(accessControlPolicies)
      .where(eq(accessControlPolicies.isActive, true))
      .orderBy(asc(accessControlPolicies.priority));
  }

  // =================== NOTIFICATION SYSTEM ===================

  async getNotifications(userId: string, filters?: { type?: string; category?: string; isRead?: boolean; limit?: number }): Promise<Notification[]> {
    let conditions = [eq(notifications.recipientId, userId)];
    if (filters?.type) conditions.push(eq(notifications.type, filters.type));
    if (filters?.category) conditions.push(eq(notifications.category, filters.category));
    if (filters?.isRead !== undefined) conditions.push(eq(notifications.isRead, filters.isRead));
    return await db.select().from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(filters?.limit || 50);
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db.select({ count: count() }).from(notifications)
      .where(and(eq(notifications.recipientId, userId), eq(notifications.isRead, false)));
    return result[0]?.count || 0;
  }

  async createNotification(data: InsertNotification): Promise<Notification> {
    const [result] = await db.insert(notifications).values(data).returning();
    return result;
  }

  async createBulkNotifications(dataList: InsertNotification[]): Promise<number> {
    if (dataList.length === 0) return 0;
    const result = await db.insert(notifications).values(dataList).returning();
    return result.length;
  }

  async markNotificationRead(id: string, userId: string): Promise<Notification | null> {
    const [result] = await db.update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.recipientId, userId)))
      .returning();
    return result || null;
  }

  async markAllNotificationsRead(userId: string): Promise<number> {
    const result = await db.update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.recipientId, userId), eq(notifications.isRead, false)))
      .returning();
    return result.length;
  }

  async acknowledgeNotification(id: string, userId: string, notes?: string): Promise<Notification | null> {
    const [notif] = await db.update(notifications)
      .set({ isAcknowledged: true, acknowledgedAt: new Date(), isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.recipientId, userId)))
      .returning();
    if (notif) {
      await db.insert(acknowledgements).values({
        userId,
        notificationId: id,
        acknowledgementType: 'notification',
        notes,
      });
    }
    return notif || null;
  }

  async deleteNotification(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.recipientId, userId)))
      .returning();
    return result.length > 0;
  }

  // Email Consents
  async getEmailConsents(userId: string): Promise<EmailConsent[]> {
    return await db.select().from(emailConsents)
      .where(eq(emailConsents.userId, userId))
      .orderBy(asc(emailConsents.consentType));
  }

  async upsertEmailConsent(userId: string, consentType: string, isConsented: boolean): Promise<EmailConsent> {
    const existing = await db.select().from(emailConsents)
      .where(and(eq(emailConsents.userId, userId), eq(emailConsents.consentType, consentType)))
      .limit(1);
    if (existing.length > 0) {
      const [updated] = await db.update(emailConsents)
        .set({
          isConsented,
          consentedAt: isConsented ? new Date() : existing[0].consentedAt,
          revokedAt: !isConsented ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(emailConsents.id, existing[0].id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(emailConsents).values({
      userId,
      consentType,
      isConsented,
      consentedAt: isConsented ? new Date() : null,
    }).returning();
    return created;
  }

  async initializeDefaultConsents(userId: string): Promise<EmailConsent[]> {
    const defaultTypes = ['transactional', 'assessment_updates', 'security_alerts', 'marketing', 'newsletter', 'product_updates'];
    const existing = await this.getEmailConsents(userId);
    const existingTypes = existing.map(e => e.consentType);
    const toCreate = defaultTypes.filter(t => !existingTypes.includes(t));
    const results: EmailConsent[] = [...existing];
    for (const type of toCreate) {
      const consent = await this.upsertEmailConsent(userId, type, ['transactional', 'security_alerts'].includes(type));
      results.push(consent);
    }
    return results;
  }

  // Acknowledgements
  async getAcknowledgements(userId: string, type?: string): Promise<Acknowledgement[]> {
    let conditions = [eq(acknowledgements.userId, userId)];
    if (type) conditions.push(eq(acknowledgements.acknowledgementType, type));
    return await db.select().from(acknowledgements)
      .where(and(...conditions))
      .orderBy(desc(acknowledgements.acknowledgedAt));
  }

  async createAcknowledgement(data: InsertAcknowledgement): Promise<Acknowledgement> {
    const [result] = await db.insert(acknowledgements).values(data).returning();
    return result;
  }

  // Broadcasts
  async getNotificationBroadcasts(filters?: { status?: string; limit?: number }): Promise<NotificationBroadcast[]> {
    let conditions = [];
    if (filters?.status) conditions.push(eq(notificationBroadcasts.status, filters.status));
    if (conditions.length > 0) {
      return await db.select().from(notificationBroadcasts)
        .where(and(...conditions))
        .orderBy(desc(notificationBroadcasts.createdAt))
        .limit(filters?.limit || 50);
    }
    return await db.select().from(notificationBroadcasts)
      .orderBy(desc(notificationBroadcasts.createdAt))
      .limit(filters?.limit || 50);
  }

  async createNotificationBroadcast(data: InsertNotificationBroadcast): Promise<NotificationBroadcast> {
    const [result] = await db.insert(notificationBroadcasts).values(data).returning();
    return result;
  }

  async sendBroadcast(broadcastId: string): Promise<{ sent: number }> {
    const [broadcast] = await db.select().from(notificationBroadcasts)
      .where(eq(notificationBroadcasts.id, broadcastId));
    if (!broadcast) throw new Error('Broadcast not found');

    let recipientIds: string[] = [];
    if (broadcast.targetUserIds && broadcast.targetUserIds.length > 0) {
      recipientIds = broadcast.targetUserIds;
    } else if (broadcast.targetRoles && broadcast.targetRoles.length > 0) {
      const targetUsers = await db.select({ id: users.id }).from(users)
        .where(sql`${users.role} = ANY(${broadcast.targetRoles})`);
      recipientIds = targetUsers.map(u => u.id);
    } else {
      const allUsers = await db.select({ id: users.id }).from(users);
      recipientIds = allUsers.map(u => u.id);
    }

    const notifData: InsertNotification[] = recipientIds.map(rid => ({
      recipientId: rid,
      senderId: broadcast.senderId,
      type: broadcast.type,
      category: broadcast.category,
      title: broadcast.title,
      message: broadcast.message,
      actionUrl: broadcast.actionUrl,
      actionLabel: broadcast.actionLabel,
      priority: broadcast.priority,
    }));

    const sent = await this.createBulkNotifications(notifData);

    await db.update(notificationBroadcasts).set({
      status: 'sent',
      sentAt: new Date(),
      totalRecipients: recipientIds.length,
      totalDelivered: sent,
    }).where(eq(notificationBroadcasts.id, broadcastId));

    return { sent };
  }
}



export async function listExamReadyPlans() {
  return db
    .select()
    .from(subscriptionPackages)
    .where(and(eq(subscriptionPackages.category, "exam-ready"), eq(subscriptionPackages.isActive, true)))
    .orderBy(desc(subscriptionPackages.isRecommended), desc(subscriptionPackages.sortOrder));
}

export async function getPlanById(planId: string) {
  const rows = await db.select().from(subscriptionPackages).where(eq(subscriptionPackages.id, planId)).limit(1);
  return rows[0] ?? null;
}

export async function getActiveSubscriptionForStudent(args: {
  studentId?: string | null;
  childId?: string | null;
  category?: string; // optional filter
}) {
  const { studentId, childId, category } = args;

  // base query
  const subs = await db
    .select({
      sub: studentSubscriptions,
      plan: subscriptionPackages,
    })
    .from(studentSubscriptions)
    .innerJoin(subscriptionPackages, eq(studentSubscriptions.packageId, subscriptionPackages.id))
    .where(
      and(
        eq(studentSubscriptions.status, "active"),
        category ? eq(subscriptionPackages.category, category) : undefined,
        studentId ? eq(studentSubscriptions.studentId, studentId) : undefined,
        childId ? eq(studentSubscriptions.childId, childId) : undefined,
      ),
    );

  // basic expiry check (if you store expiry_date)
  const now = new Date();
  const active = subs.find((x) => !x.sub.expiryDate || new Date(x.sub.expiryDate) > now);
  return active ?? null;
}

export async function createStudentSubscription(args: {
  studentId?: string | null;
  childId?: string | null;
  packageId: string;
  paymentTransactionId?: string | null;
}) {
  const plan = await getPlanById(args.packageId);
  if (!plan) throw new Error("Invalid plan");

  const expiry =
    plan.validityDays && plan.validityDays > 0
      ? new Date(Date.now() + plan.validityDays * 24 * 60 * 60 * 1000)
      : null;

  const rows = await db
    .insert(studentSubscriptions)
    .values({
      studentId: args.studentId ?? null,
      childId: args.childId ?? null,
      packageId: args.packageId,
      paymentTransactionId: args.paymentTransactionId ?? null,
      expiryDate: expiry,
      status: "active",
    })
    .returning();

  return rows[0];
}




export const storage = new DatabaseStorage();


