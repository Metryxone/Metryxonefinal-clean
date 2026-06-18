import { query } from './client.js';

interface ScenarioRow {
  name: string;
  description: string;
  event_trigger: string;
  condition_json: Record<string, unknown>;
  template_id: number;
  delay_minutes: number;
  channels: string[];
  target_role: string | null;
  variables_map: Record<string, string>;
}

const SCENARIOS: ScenarioRow[] = [
  // ──────────────────────────────────────────────────────────────
  // MENTOR ONBOARDING — 7 pipeline stages
  // ──────────────────────────────────────────────────────────────
  {
    name: 'Mentor Application Received',
    description: 'Notify super-admin when a mentor application is submitted',
    event_trigger: 'mentor.stage_advanced',
    condition_json: { stage: 'application' },
    template_id: 7,   // Welcome to MetryxOne
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: 'superadmin',
    variables_map: { name: 'displayName' },
  },
  {
    name: 'Mentor Training Started',
    description: 'Notify mentor when they advance to the training stage',
    event_trigger: 'mentor.stage_advanced',
    condition_json: { stage: 'training' },
    template_id: 8,   // Complete Your Profile
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { percent: 'trainingPercent' },
  },
  {
    name: 'Mentor Assessment Assigned',
    description: 'Alert mentor when their onboarding assessment is ready',
    event_trigger: 'mentor.stage_advanced',
    condition_json: { stage: 'assessment' },
    template_id: 22,  // Test Assigned
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { testName: 'assessmentName', assignedBy: 'adminName' },
  },
  {
    name: 'Mentor Temp Code Issued',
    description: 'Notify mentor that a temporary platform access code has been generated',
    event_trigger: 'mentor.stage_advanced',
    condition_json: { stage: 'temp_code' },
    template_id: 17,  // Discount Code Issued (re-purposed for temp code delivery)
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { code: 'tempCode', discount: 'temporary', plan: 'Mentor Access' },
  },
  {
    name: 'Mentor KYC Documents Required',
    description: 'Remind mentor to upload KYC verification documents',
    event_trigger: 'mentor.stage_advanced',
    condition_json: { stage: 'kyc' },
    template_id: 11,  // Guardian Consent Required (consent/document flow)
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { childName: 'displayName' },
  },
  {
    name: 'Mentor Profiler Setup Required',
    description: 'Prompt mentor to complete their Behavioral Profiler',
    event_trigger: 'mentor.stage_advanced',
    condition_json: { stage: 'profiler' },
    template_id: 40,  // Adaptive Test Ready (profiler is an adaptive assessment)
    delay_minutes: 0,
    channels: ['in_app'],
    target_role: null,
    variables_map: { subject: 'Behavioral Profiler' },
  },
  {
    name: 'Mentor Fully Activated',
    description: 'Notify admin and send congratulations when a mentor is fully activated',
    event_trigger: 'mentor.stage_advanced',
    condition_json: { stage: 'activated' },
    template_id: 9,   // Mentor Assigned
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: 'superadmin',
    variables_map: { mentorName: 'displayName' },
  },
  {
    name: 'KYC Document Submitted — Admin Alert',
    description: 'Notify admin when mentor submits KYC documents for review',
    event_trigger: 'mentor.kyc_submitted',
    condition_json: {},
    template_id: 11,  // Guardian Consent Required — re-used for doc review flow
    delay_minutes: 0,
    channels: ['in_app'],
    target_role: 'superadmin',
    variables_map: { childName: 'displayName' },
  },
  {
    name: 'Mentor Assigned to Student',
    description: 'Notify student when a mentor is assigned to them',
    event_trigger: 'mentor.assigned',
    condition_json: {},
    template_id: 9,   // Mentor Assigned
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { mentorName: 'mentorName' },
  },

  // ──────────────────────────────────────────────────────────────
  // USER LIFECYCLE
  // ──────────────────────────────────────────────────────────────
  {
    name: 'New User Welcome',
    description: 'Send welcome notification immediately after registration',
    event_trigger: 'user.registered',
    condition_json: {},
    template_id: 7,   // Welcome to MetryxOne
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { name: 'fullName' },
  },
  {
    name: 'Profile Completion Nudge',
    description: 'Remind user to complete their profile 1 hour after registration',
    event_trigger: 'user.registered',
    condition_json: {},
    template_id: 8,   // Complete Your Profile
    delay_minutes: 60,
    channels: ['in_app'],
    target_role: null,
    variables_map: { percent: 'profilePercent' },
  },
  {
    name: 'Parent Consent Required',
    description: 'Prompt parent to provide consent after child enrolment',
    event_trigger: 'user.registered',
    condition_json: { role: 'parent' },
    template_id: 11,  // Guardian Consent Required
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { childName: 'childName' },
  },
  {
    name: 'User Role Changed',
    description: 'Notify user immediately when their platform role is changed',
    event_trigger: 'user.role_changed',
    condition_json: {},
    template_id: 6,   // Role Changed
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { newRole: 'newRole', admin: 'adminName' },
  },
  {
    name: 'New Device Login Alert',
    description: 'Security alert when account is accessed from a new/unrecognised device',
    event_trigger: 'user.new_device_login',
    condition_json: {},
    template_id: 3,   // New Device Login
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { time: 'loginTime' },
  },
  {
    name: 'Suspicious Login Detected',
    description: 'Immediate security alert for suspicious login attempt',
    event_trigger: 'user.suspicious_login',
    condition_json: {},
    template_id: 4,   // Suspicious Login Detected
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { location: 'location' },
  },
  {
    name: 'Multiple Failed Login Attempts',
    description: 'Alert user after 5+ consecutive failed login attempts',
    event_trigger: 'user.failed_logins',
    condition_json: { count: 5 },
    template_id: 5,   // Multiple Failed Logins
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { count: 'attemptCount' },
  },

  // ──────────────────────────────────────────────────────────────
  // BILLING & SUBSCRIPTION
  // ──────────────────────────────────────────────────────────────
  {
    name: 'Trial Ending — 7 Days Notice',
    description: 'Warn user 7 days before trial expiry to encourage upgrade',
    event_trigger: 'subscription.trial_ending',
    condition_json: { daysLeft: 7 },
    template_id: 12,  // Trial Ending Soon
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { endDate: 'endDate' },
  },
  {
    name: 'Trial Ending — Final Day',
    description: 'Urgent reminder on the last day of trial',
    event_trigger: 'subscription.trial_ending',
    condition_json: { daysLeft: 1 },
    template_id: 12,  // Trial Ending Soon
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { endDate: 'endDate' },
  },
  {
    name: 'Subscription Expired',
    description: 'Notify user when their subscription has expired',
    event_trigger: 'subscription.expired',
    condition_json: {},
    template_id: 13,  // Subscription Expired
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: {},
  },
  {
    name: 'Payment Successful Confirmation',
    description: 'Confirm payment processed — sent immediately',
    event_trigger: 'payment.success',
    condition_json: {},
    template_id: 14,  // Payment Successful
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { amount: 'amount', plan: 'planName' },
  },
  {
    name: 'Payment Failed Alert',
    description: 'Alert user that their payment could not be processed',
    event_trigger: 'payment.failed',
    condition_json: {},
    template_id: 15,  // Payment Failed
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { amount: 'amount' },
  },
  {
    name: 'Invoice Generated',
    description: 'Notify user when a new invoice is available to view',
    event_trigger: 'invoice.generated',
    condition_json: {},
    template_id: 16,  // Invoice Generated
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { invoiceNumber: 'invoiceNumber', amount: 'amount' },
  },
  {
    name: 'Discount Code Issued',
    description: 'Deliver discount/promo code to user',
    event_trigger: 'commerce.discount_issued',
    condition_json: {},
    template_id: 17,  // Discount Code Issued
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { code: 'code', discount: 'discount', plan: 'plan' },
  },
  {
    name: 'Discount Code Expiring Soon',
    description: 'Remind user their discount code expires in 2 days',
    event_trigger: 'commerce.discount_expiring',
    condition_json: { daysLeft: 2 },
    template_id: 18,  // Discount Expiring Soon
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { code: 'code', expiry: 'expiry' },
  },

  // ──────────────────────────────────────────────────────────────
  // EXAMS & ASSESSMENTS
  // ──────────────────────────────────────────────────────────────
  {
    name: 'Test Assigned to Student',
    description: 'Notify student immediately when a test is assigned',
    event_trigger: 'exam.assigned',
    condition_json: {},
    template_id: 22,  // Test Assigned
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { testName: 'testName', assignedBy: 'assignedBy' },
  },
  {
    name: 'Test Window Now Open',
    description: 'Alert student the moment their test window becomes active',
    event_trigger: 'exam.window_open',
    condition_json: {},
    template_id: 25,  // Test Window Open
    delay_minutes: 0,
    channels: ['in_app'],
    target_role: null,
    variables_map: { testName: 'testName', deadline: 'deadline' },
  },
  {
    name: 'Exam Reminder — 24 Hours',
    description: 'Remind student 24 hours before the exam deadline',
    event_trigger: 'exam.reminder_24h',
    condition_json: {},
    template_id: 26,  // Test Reminder
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { testName: 'testName', timeLeft: '24 hours' },
  },
  {
    name: 'Exam Reminder — 1 Hour',
    description: 'Final in-app reminder 1 hour before exam deadline',
    event_trigger: 'exam.reminder_1h',
    condition_json: {},
    template_id: 26,  // Test Reminder
    delay_minutes: 0,
    channels: ['in_app'],
    target_role: null,
    variables_map: { testName: 'testName', timeLeft: '1 hour' },
  },
  {
    name: 'Test Submitted — Confirmation',
    description: 'Confirm to student that their submission was received',
    event_trigger: 'exam.submitted',
    condition_json: {},
    template_id: 28,  // Test Submitted
    delay_minutes: 0,
    channels: ['in_app'],
    target_role: null,
    variables_map: { testName: 'testName' },
  },
  {
    name: 'Retest Now Available',
    description: 'Notify student when a retest opportunity is unlocked',
    event_trigger: 'exam.retest_available',
    condition_json: {},
    template_id: 31,  // Retest Available
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { testName: 'testName' },
  },

  // ──────────────────────────────────────────────────────────────
  // REPORTS & INSIGHTS
  // ──────────────────────────────────────────────────────────────
  {
    name: 'Report Published — Student & Parent',
    description: 'Notify student and parent when a test report is ready',
    event_trigger: 'report.published',
    condition_json: {},
    template_id: 32,  // Report Published
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { reportType: 'reportType', testName: 'testName' },
  },
  {
    name: 'AI Insights Generated',
    description: 'Notify when the AI produces new personalised learning insights',
    event_trigger: 'report.insight_generated',
    condition_json: {},
    template_id: 33,  // AI Insight Generated
    delay_minutes: 0,
    channels: ['in_app'],
    target_role: null,
    variables_map: { studentName: 'studentName' },
  },
  {
    name: 'Weak Area Identified — Delayed Alert',
    description: 'Send weak area notification 30 minutes after results analysis',
    event_trigger: 'report.weak_area_identified',
    condition_json: {},
    template_id: 37,  // Weak Area Identified
    delay_minutes: 30,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { subject: 'subject' },
  },
  {
    name: 'Competency Mastered',
    description: 'Celebrate when a student masters a key competency',
    event_trigger: 'report.competency_mastered',
    condition_json: {},
    template_id: 38,  // Competency Mastered
    delay_minutes: 0,
    channels: ['in_app'],
    target_role: null,
    variables_map: { studentName: 'studentName', competency: 'competency' },
  },
  {
    name: 'Refresher Module Unlocked',
    description: 'Notify student when a remedial module unlocks based on results',
    event_trigger: 'report.refresher_unlocked',
    condition_json: {},
    template_id: 36,  // Refresher Module Unlocked
    delay_minutes: 0,
    channels: ['in_app'],
    target_role: null,
    variables_map: { subject: 'subject' },
  },
  {
    name: 'Benchmark Report Available',
    description: 'Notify teacher when comparative benchmark report is ready',
    event_trigger: 'report.benchmark_ready',
    condition_json: {},
    template_id: 34,  // Benchmark Report Available
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { testName: 'testName' },
  },

  // ──────────────────────────────────────────────────────────────
  // BOOKINGS / SESSIONS
  // ──────────────────────────────────────────────────────────────
  {
    name: 'Session Booked — Student Confirmation',
    description: 'Confirm booking details to the student',
    event_trigger: 'booking.created',
    condition_json: {},
    template_id: 45,  // Session Booked
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { mentorName: 'mentorName', date: 'date', time: 'time' },
  },
  {
    name: 'Session Reminder — 24 Hours',
    description: 'Remind both student and mentor 24 hours before session',
    event_trigger: 'booking.reminder_24h',
    condition_json: {},
    template_id: 47,  // Session Reminder
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { timeLeft: '24 hours' },
  },
  {
    name: 'Session Reminder — 1 Hour',
    description: 'Final in-app reminder 1 hour before session',
    event_trigger: 'booking.reminder_1h',
    condition_json: {},
    template_id: 47,  // Session Reminder
    delay_minutes: 0,
    channels: ['in_app'],
    target_role: null,
    variables_map: { timeLeft: '1 hour' },
  },
  {
    name: 'Session Cancelled — Immediate Alert',
    description: 'Immediately notify student and mentor of cancellation',
    event_trigger: 'booking.cancelled',
    condition_json: {},
    template_id: 49,  // Session Cancelled
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { date: 'date' },
  },
  {
    name: 'No-Show Alert — Mentor & Admin',
    description: 'Alert mentor and admin when a student does not show up',
    event_trigger: 'booking.no_show',
    condition_json: {},
    template_id: 50,  // No-Show Alert
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { studentName: 'studentName' },
  },
  {
    name: 'Feedback Requested After Session',
    description: 'Ask student for session rating 30 minutes after completion',
    event_trigger: 'booking.completed',
    condition_json: {},
    template_id: 52,  // Feedback Requested
    delay_minutes: 30,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { mentorName: 'mentorName' },
  },

  // ──────────────────────────────────────────────────────────────
  // CLASSES
  // ──────────────────────────────────────────────────────────────
  {
    name: 'Class Scheduled — Student Alert',
    description: 'Notify enrolled students when a new class is scheduled',
    event_trigger: 'class.scheduled',
    condition_json: {},
    template_id: 54,  // Class Scheduled
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { className: 'className', date: 'date', time: 'time' },
  },
  {
    name: 'Class Reminder — 1 Hour',
    description: 'In-app reminder 1 hour before class starts',
    event_trigger: 'class.reminder_1h',
    condition_json: {},
    template_id: 55,  // Class Reminder
    delay_minutes: 0,
    channels: ['in_app'],
    target_role: null,
    variables_map: { className: 'className', timeLeft: '1 hour' },
  },
  {
    name: 'Class Cancelled — Immediate Alert',
    description: 'Immediately notify all enrolled students when a class is cancelled',
    event_trigger: 'class.cancelled',
    condition_json: {},
    template_id: 57,  // Class Cancelled
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { className: 'className', date: 'date' },
  },
  {
    name: 'Virtual Class Link Ready',
    description: 'Send join link to students and teacher when class goes live',
    event_trigger: 'class.link_ready',
    condition_json: {},
    template_id: 56,  // Class Link Shared
    delay_minutes: 0,
    channels: ['in_app'],
    target_role: null,
    variables_map: { className: 'className' },
  },
  {
    name: 'Substitute Mentor Assigned',
    description: 'Notify students when a substitute mentor takes over a class',
    event_trigger: 'class.substitute_assigned',
    condition_json: {},
    template_id: 58,  // Substitute Mentor Assigned
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { newMentorName: 'substituteName', originalMentor: 'originalMentor' },
  },

  // ──────────────────────────────────────────────────────────────
  // AI TOOLS
  // ──────────────────────────────────────────────────────────────
  {
    name: 'AI Test Ready for Review',
    description: 'Alert teacher/admin when an AI-generated test is ready to review',
    event_trigger: 'ai.test_generated',
    condition_json: {},
    template_id: 39,  // AI Test Ready for Review
    delay_minutes: 0,
    channels: ['in_app'],
    target_role: null,
    variables_map: { testName: 'testName', subject: 'subject' },
  },
  {
    name: 'AI Study Recommendations Ready',
    description: 'Notify student when personalised AI study recommendations are ready',
    event_trigger: 'ai.study_recommendations',
    condition_json: {},
    template_id: 42,  // AI Study Recommendations
    delay_minutes: 0,
    channels: ['in_app'],
    target_role: null,
    variables_map: {},
  },
  {
    name: 'AI Usage Limit Reached',
    description: 'Warn user when they hit their plan AI feature limit',
    event_trigger: 'ai.usage_limit',
    condition_json: {},
    template_id: 43,  // AI Usage Limit Reached
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: {},
  },
  {
    name: 'AI Adaptive Test Available',
    description: 'Notify student when an AI-adaptive test is generated for them',
    event_trigger: 'ai.adaptive_test_ready',
    condition_json: {},
    template_id: 40,  // Adaptive Test Ready
    delay_minutes: 0,
    channels: ['in_app'],
    target_role: null,
    variables_map: { subject: 'subject' },
  },

  // ──────────────────────────────────────────────────────────────
  // COMPLIANCE
  // ──────────────────────────────────────────────────────────────
  {
    name: 'Privacy Policy Updated',
    description: 'Notify all users when the privacy policy is updated',
    event_trigger: 'compliance.policy_updated',
    condition_json: {},
    template_id: 10,  // Privacy Policy Updated
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { date: 'effectiveDate' },
  },

  // ──────────────────────────────────────────────────────────────
  // COMMERCE — remaining templates
  // ──────────────────────────────────────────────────────────────
  {
    name: 'Discount Successfully Applied',
    description: 'Confirm to user that a discount code was applied at checkout',
    event_trigger: 'commerce.discount_applied',
    condition_json: {},
    template_id: 19,  // Discount Applied
    delay_minutes: 0,
    channels: ['in_app'],
    target_role: null,
    variables_map: { code: 'code', savings: 'savings' },
  },
  {
    name: 'Limited Time Offer Launched',
    description: 'Notify eligible users when a promotional offer goes live',
    event_trigger: 'commerce.offer_launched',
    condition_json: {},
    template_id: 21,  // Limited Time Offer
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { offerTitle: 'offerTitle', discount: 'discount', hours: 'hours' },
  },

  // ──────────────────────────────────────────────────────────────
  // EXAMS — remaining templates
  // ──────────────────────────────────────────────────────────────
  {
    name: 'Test Rescheduled — All Parties',
    description: 'Notify student and teacher when a test is rescheduled',
    event_trigger: 'exam.rescheduled',
    condition_json: {},
    template_id: 23,  // Test Rescheduled
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { testName: 'testName', oldDate: 'oldDate', newDate: 'newDate' },
  },
  {
    name: 'Test Cancelled — Immediate Alert',
    description: 'Notify student and teacher immediately when a test is cancelled',
    event_trigger: 'exam.cancelled',
    condition_json: {},
    template_id: 24,  // Test Cancelled
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { testName: 'testName', date: 'date' },
  },
  {
    name: 'Student Started Test — Admin Alert',
    description: 'Notify teacher/admin the moment a student begins their test',
    event_trigger: 'exam.started',
    condition_json: {},
    template_id: 27,  // Test Started
    delay_minutes: 0,
    channels: ['in_app'],
    target_role: null,
    variables_map: { studentName: 'studentName', testName: 'testName' },
  },
  {
    name: 'Test Auto-Submitted on Timeout',
    description: 'Notify student when their test was submitted automatically as time expired',
    event_trigger: 'exam.auto_submitted',
    condition_json: {},
    template_id: 29,  // Test Auto-Submitted
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { testName: 'testName' },
  },
  {
    name: 'Test Not Attempted — Admin Alert',
    description: 'Alert teacher/admin when a student misses the exam deadline',
    event_trigger: 'exam.not_attempted',
    condition_json: {},
    template_id: 30,  // Test Not Attempted
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { studentName: 'studentName', testName: 'testName' },
  },

  // ──────────────────────────────────────────────────────────────
  // REPORTS — remaining templates
  // ──────────────────────────────────────────────────────────────
  {
    name: 'Report Viewed — Audit Notification',
    description: 'Notify admin/teacher when a report is viewed by a parent or external party',
    event_trigger: 'report.viewed',
    condition_json: {},
    template_id: 35,  // Report Viewed
    delay_minutes: 0,
    channels: ['in_app'],
    target_role: null,
    variables_map: { viewerName: 'viewerName', studentName: 'studentName' },
  },

  // ──────────────────────────────────────────────────────────────
  // AI TOOLS — remaining templates
  // ──────────────────────────────────────────────────────────────
  {
    name: 'Question Bank Updated',
    description: 'Notify teacher/admin when new AI-generated questions are added',
    event_trigger: 'ai.question_bank_updated',
    condition_json: {},
    template_id: 41,  // Question Bank Updated
    delay_minutes: 0,
    channels: ['in_app'],
    target_role: null,
    variables_map: { count: 'count' },
  },
  {
    name: 'AI Generator Error — Admin Alert',
    description: 'Alert admin/teacher when the AI test generator fails',
    event_trigger: 'ai.generator_error',
    condition_json: {},
    template_id: 44,  // AI Generator Error
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: {},
  },

  // ──────────────────────────────────────────────────────────────
  // BOOKINGS — remaining templates
  // ──────────────────────────────────────────────────────────────
  {
    name: 'Booking Confirmed — Second Notice',
    description: 'Send a formal booking confirmation shortly after a session is booked',
    event_trigger: 'booking.confirmed',
    condition_json: {},
    template_id: 46,  // Booking Confirmed
    delay_minutes: 5,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { date: 'date', time: 'time' },
  },
  {
    name: 'Session Rescheduled — All Parties',
    description: 'Notify student and mentor when a session is rescheduled',
    event_trigger: 'booking.rescheduled',
    condition_json: {},
    template_id: 48,  // Session Rescheduled
    delay_minutes: 0,
    channels: ['in_app', 'email'],
    target_role: null,
    variables_map: { oldDate: 'oldDate', newDate: 'newDate' },
  },
  {
    name: 'Session Completed — Student Prompt',
    description: 'Notify student immediately when session is marked complete, before feedback request',
    event_trigger: 'booking.completed',
    condition_json: {},
    template_id: 51,  // Session Completed
    delay_minutes: 0,
    channels: ['in_app'],
    target_role: null,
    variables_map: {},
  },
  {
    name: 'Rating Received — Mentor & Admin',
    description: 'Notify mentor and admin when a student submits a session rating',
    event_trigger: 'booking.rating_submitted',
    condition_json: {},
    template_id: 53,  // Rating Received
    delay_minutes: 0,
    channels: ['in_app'],
    target_role: null,
    variables_map: { studentName: 'studentName', rating: 'rating' },
  },

  // ──────────────────────────────────────────────────────────────
  // CLASSES — remaining templates
  // ──────────────────────────────────────────────────────────────
  {
    name: 'Attendance Marked — Student Record',
    description: 'Notify student (and teacher log) when attendance is recorded for a class',
    event_trigger: 'class.attendance_marked',
    condition_json: {},
    template_id: 59,  // Attendance Marked
    delay_minutes: 0,
    channels: ['in_app'],
    target_role: null,
    variables_map: { studentName: 'studentName', className: 'className', status: 'attendanceStatus' },
  },
];

async function run(): Promise<void> {
  console.log('[SeedScenarios] Clearing existing scenarios…');
  await query(`DELETE FROM notification_scheduled_jobs`);
  await query(`DELETE FROM notification_scenarios`);
  await query(`ALTER SEQUENCE notification_scenarios_id_seq RESTART WITH 1`);

  console.log(`[SeedScenarios] Inserting ${SCENARIOS.length} scenarios…`);

  for (const s of SCENARIOS) {
    await query(
      `INSERT INTO notification_scenarios
         (name, description, event_trigger, condition_json, template_id, delay_minutes, channels, target_role, variables_map, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE)`,
      [
        s.name,
        s.description,
        s.event_trigger,
        JSON.stringify(s.condition_json),
        s.template_id,
        s.delay_minutes,
        JSON.stringify(s.channels),
        s.target_role,
        JSON.stringify(s.variables_map),
      ]
    );
  }

  console.log('[SeedScenarios] Done.');
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
