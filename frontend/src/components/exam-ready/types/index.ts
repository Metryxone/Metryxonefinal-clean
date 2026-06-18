export interface ExamReadyPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  features: string[];
  recommended?: boolean;
  duration: string;
  description: string;
}

export interface ExamReadyUser {
  id: string;
  email: string;
  name?: string;
  isAuthenticated: boolean;
}

export interface AssessmentAttempt {
  id: string;
  planId: string;
  board: string;
  grade: string;
  status: 'not_started' | 'in_progress' | 'paused' | 'completed' | 'submitted';
  currentQuestionIndex: number;
  totalQuestions: number;
  timeRemaining: number;
  startedAt?: string;
  completedAt?: string;
}

export interface AssessmentQuestion {
  id: string;
  text: string;
  type: 'mcq' | 'likert' | 'text' | 'word_recall' | 'attention_click' | 'passage_mcq' | 'learning_strategy';
  options?: { id: string; text: string; score?: number; tag?: string; strategy?: string; label?: string }[];
  category: string;
  subcategory?: string;
  domainCode?: string;
  subdomainCode?: string;
  ageBand?: string;
  passageText?: string;
  questionCode?: string;
  meta?: {
    reverseScored?: boolean;
    weight?: number;
    anchor?: string;
    correctAnswer?: string | null;
    tags?: string[];
  };
  subQuestions?: {
    label: string;
    text: string;
    options: { id: string; text: string; score?: number }[];
    correctAnswer?: string;
  }[];
  logicType?: string;
  stimulusType?: string;
  parsedTargets?: string[];
  predecessor?: string;
  distractorsDescription?: string;
  words?: string[];
}

export interface QuestionOption {
  id: string;
  text: string;
  score?: number;
  tag?: string;
  strategy?: string;
  label?: string;
}

export interface AssessmentAnswer {
  questionId: string;
  answer: string | number;
  answeredAt: string;
}

export interface ReportStatus {
  attemptId: string;
  status: 'processing' | 'ready' | 'error';
  progress?: number;
  estimatedTime?: number;
}

export interface ExamReadyReport {
  attemptId: string;
  studentName: string;
  grade: string;
  board: string;
  completedAt: string;
  overallScore: number;
  readinessLevel: 'High' | 'Moderate' | 'Needs Attention';
  summary: string;
  sections: ReportSection[];
  recommendations: string[];
}

export interface DomainInfo {
  code: string;
  name: string;
  subdomains: { code: string; name: string }[];
}

export interface ReportSection {
  name: string;
  score: number;
  maxScore: number;
  description: string;
  strengths: string[];
  areasToImprove: string[];
}

export interface BotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ExamTrend {
  subject: string;
  examDate: string;
  score: number;
  totalMarks: number;
  trend: 'up' | 'down' | 'stable';
  percentChange?: number;
}
