import type { 
  ExamReadyPlan, 
  ExamReadyUser, 
  AssessmentAttempt, 
  AssessmentQuestion,
  ReportStatus,
  ExamReadyReport,
  BotMessage
} from '../types';

const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/v1`;

async function apiRequest<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export const authService = {
  requestOtp: (email: string) => 
    apiRequest<{ success: boolean; message: string }>('/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  verifyOtp: (email: string, otp: string) =>
    apiRequest<{ success: boolean; user: ExamReadyUser }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    }),

  getCurrentUser: () =>
    apiRequest<ExamReadyUser>('/auth/me'),

  logout: () =>
    apiRequest<{ success: boolean }>('/auth/logout', { method: 'POST' }),

  getGoogleLoginUrl: () => `${API_BASE_URL}/auth/google/login`,
};

export const catalogService = {
  getPlans: () =>
    apiRequest<ExamReadyPlan[]>('/catalog/exam-ready/plans'),
};

export const paymentService = {
  createOrder: (planId: string) =>
    apiRequest<{ orderId: string; amount: number; currency: string }>('/payments/create-order', {
      method: 'POST',
      body: JSON.stringify({ plan_id: planId }),
    }),

  verifyPayment: (orderId: string, paymentId: string, signature: string) =>
    apiRequest<{ success: boolean; attemptId?: string }>('/payments/verify', {
      method: 'POST',
      body: JSON.stringify({ order_id: orderId, payment_id: paymentId, signature }),
    }),
};

export const configService = {
  getConfig: () =>
    apiRequest<{ domains: any[]; ageBands: string[]; subdomainAgeBands: Record<string, string[]>; questionTypes: string[]; patternTypes: string[]; totalQuestions: number }>('/assessment/config'),

  getQuestionsCount: (filters: Record<string, string>) => {
    const params = new URLSearchParams(filters).toString();
    return apiRequest<{ count: number; filters: Record<string, any> }>(`/assessment/config/questions-count?${params}`);
  },
};

export const assessmentService = {
  start: (planId: string, board: string, grade: string, childId?: string, studentName?: string) =>
    apiRequest<AssessmentAttempt>('/assessment/start', {
      method: 'POST',
      body: JSON.stringify({ plan_id: planId, board, grade, child_id: childId, student_name: studentName }),
    }),

  startAll: (params: { domain_code?: string; per_subdomain?: number; plan_id?: string; board?: string; grade?: string; age_band?: string; child_id?: string; student_name?: string }) =>
    apiRequest<AssessmentAttempt & { breakdown: Record<string, number> }>('/assessment/start-all', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  getAttempt: (attemptId: string) =>
    apiRequest<{ attempt: AssessmentAttempt; questions: AssessmentQuestion[]; answers: Record<string, string | number> }>(`/assessment/${attemptId}`),

  getInProgress: () =>
    apiRequest<{ attempt: AssessmentAttempt | null; questions?: AssessmentQuestion[]; answers?: Record<string, string | number> }>('/assessment/in-progress'),

  submitAnswer: (attemptId: string, questionId: string, answer: string | number, timeSpent?: number) =>
    apiRequest<{ success: boolean }>(`/assessment/${attemptId}/answer`, {
      method: 'POST',
      body: JSON.stringify({ question_id: questionId, answer, time_spent: timeSpent }),
    }),

  swapQuestion: (attemptId: string, questionId: string) =>
    apiRequest<{ success: boolean; newQuestion: AssessmentQuestion; oldQuestionId: string; newQuestionIds: string[] }>(`/assessment/${attemptId}/swap-question`, {
      method: 'POST',
      body: JSON.stringify({ question_id: questionId }),
    }),

  saveProgress: (attemptId: string, data: { answers: Record<string, string | number>; currentQuestionIndex: number; timeRemaining: number; flaggedQuestions: string[] }) =>
    apiRequest<{ success: boolean; savedAt: string }>(`/assessment/${attemptId}/save`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  pause: (attemptId: string) =>
    apiRequest<{ success: boolean }>(`/assessment/${attemptId}/pause`, { method: 'POST' }),

  resume: (attemptId: string) =>
    apiRequest<{ attempt: AssessmentAttempt; questions: AssessmentQuestion[]; answers: Record<string, string | number> }>(`/assessment/${attemptId}/resume`, { method: 'POST' }),

  submit: (attemptId: string, force = false) =>
    apiRequest<{ success: boolean }>(`/assessment/${attemptId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ force }),
    }),

  score: (attemptId: string) =>
    apiRequest<{ success: boolean; scores: Record<string, any>; overallScore: number; readinessLevel: string }>(`/assessment/${attemptId}/score`, { method: 'POST' }),

  getScores: (attemptId: string) =>
    apiRequest<{ success: boolean; scores: Record<string, any>; overallScore: number; readinessLevel: string }>(`/assessment/${attemptId}/score`, { method: 'POST' }),
};

export const reportService = {
  getStatus: (attemptId: string) =>
    apiRequest<ReportStatus>(`/report/${attemptId}/status`),

  getReport: (attemptId: string) =>
    apiRequest<ExamReadyReport>(`/report/${attemptId}/view`),

  downloadPdf: (attemptId: string) => {
    window.open(`${API_BASE_URL}/report/${attemptId}/download`, '_blank');
  },
};

export const botService = {
  sendPrePurchaseMessage: (message: string, context?: string) =>
    apiRequest<{ response: string }>('/bot/prepurchase', {
      method: 'POST',
      body: JSON.stringify({ message, context }),
    }),

  sendPostPurchaseMessage: (message: string, attemptId: string) =>
    apiRequest<{ response: string }>('/bot/postpurchase', {
      method: 'POST',
      body: JSON.stringify({ message, attemptId }),
    }),
};

export const analyticsService = {
  trackEvent: (eventName: string, attemptId?: string, metadata?: Record<string, unknown>) =>
    apiRequest<{ success: boolean }>('/analytics/event', {
      method: 'POST',
      body: JSON.stringify({ event_name: eventName, attemptId, metadata }),
    }).catch(() => {}),
};

export const mockPlans: ExamReadyPlan[] = [
  {
    id: 'mini',
    name: 'Mini Assessment',
    price: 299,
    currency: 'INR',
    duration: '15 minutes',
    description: 'Quick behavioral readiness check',
    features: [
      'Overall readiness score',
      '15-minute assessment',
      'Basic behavioral insights',
    ],
  },
  {
    id: 'exam-ready',
    name: 'EXAM READY™',
    price: 999,
    currency: 'INR',
    duration: '30-40 minutes',
    description: 'Deep Psychopsis behavioral assessment',
    recommended: true,
    features: [
      'Complete psychological readiness analysis',
      '30-40 minute behavioral assessment',
      'Stress & anxiety management insights',
      'Focus & concentration evaluation',
      'Emotional regulation analysis',
      'Personalized coping strategies',
      'Guidance bot support',
    ],
  },
];

export const mockQuestions: AssessmentQuestion[] = [
  {
    id: 'q1',
    text: 'When I think about an upcoming exam, I feel...',
    type: 'likert',
    options: [
      { id: '1', text: 'Very anxious and overwhelmed' },
      { id: '2', text: 'Somewhat nervous' },
      { id: '3', text: 'Neutral' },
      { id: '4', text: 'Fairly calm' },
      { id: '5', text: 'Completely relaxed and prepared' },
    ],
    category: 'Stress & Anxiety',
  },
  {
    id: 'q2',
    text: 'When I get stuck on a difficult problem during an exam, I usually...',
    type: 'mcq',
    options: [
      { id: 'a', text: 'Panic and struggle to move on' },
      { id: 'b', text: 'Get frustrated but try to calm down' },
      { id: 'c', text: 'Skip it and come back later with a clear mind' },
      { id: 'd', text: 'Stay calm and systematically try different approaches' },
    ],
    category: 'Emotional Regulation',
  },
  {
    id: 'q3',
    text: 'How easily can you maintain focus while studying for long periods?',
    type: 'likert',
    options: [
      { id: '1', text: 'Very difficult - I get distracted constantly' },
      { id: '2', text: 'Somewhat difficult' },
      { id: '3', text: 'Moderate - I can focus for short periods' },
      { id: '4', text: 'Fairly easy' },
      { id: '5', text: 'Very easy - I can focus for hours' },
    ],
    category: 'Focus & Concentration',
  },
  {
    id: 'q4',
    text: 'The night before an important exam, I typically...',
    type: 'mcq',
    options: [
      { id: 'a', text: 'Struggle to sleep due to worry' },
      { id: 'b', text: 'Feel restless but eventually sleep' },
      { id: 'c', text: 'Follow my normal sleep routine' },
      { id: 'd', text: 'Feel confident and sleep well' },
    ],
    category: 'Stress & Anxiety',
  },
  {
    id: 'q5',
    text: 'When I do poorly on a test, I usually...',
    type: 'mcq',
    options: [
      { id: 'a', text: 'Feel like giving up' },
      { id: 'b', text: 'Get upset for a while but move on' },
      { id: 'c', text: 'Analyze what went wrong and plan improvements' },
      { id: 'd', text: 'Stay positive and see it as a learning opportunity' },
    ],
    category: 'Resilience',
  },
  {
    id: 'q6',
    text: 'How consistent is your study routine?',
    type: 'likert',
    options: [
      { id: '1', text: 'No routine - study only before exams' },
      { id: '2', text: 'Inconsistent - depends on mood' },
      { id: '3', text: 'Somewhat consistent' },
      { id: '4', text: 'Regular routine with occasional breaks' },
      { id: '5', text: 'Very consistent daily schedule' },
    ],
    category: 'Study Habits',
  },
  {
    id: 'q7',
    text: 'When running out of time in an exam, I...',
    type: 'mcq',
    options: [
      { id: 'a', text: 'Panic and make careless mistakes' },
      { id: 'b', text: 'Rush through remaining questions' },
      { id: 'c', text: 'Prioritize questions I can answer quickly' },
      { id: 'd', text: 'Stay calm and work efficiently' },
    ],
    category: 'Time Pressure Management',
  },
  {
    id: 'q8',
    text: 'I believe I can perform well in exams if I prepare properly.',
    type: 'likert',
    options: [
      { id: '1', text: 'Strongly disagree' },
      { id: '2', text: 'Disagree' },
      { id: '3', text: 'Neutral' },
      { id: '4', text: 'Agree' },
      { id: '5', text: 'Strongly agree' },
    ],
    category: 'Confidence & Self-Efficacy',
  },
];
