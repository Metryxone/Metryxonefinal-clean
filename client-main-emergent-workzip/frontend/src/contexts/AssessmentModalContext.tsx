import React, { createContext, useContext, useState, useRef, useEffect, useCallback, MutableRefObject } from 'react';
import { notificationService } from '@/lib/notifications/service';
import { CONCERN_OPTIONS, CONCERN_QUESTIONS } from '@/components/assessmentConcerns';
import {
  PERSONAS, QUESTION_BANKS, type PersonaKey, type CapadexQuestion, type CapadexProgress,
  type CapadexStageResult, type DomainResult, getLevel,
} from '@/lib/behavioural-insights';

interface ConcernIntelligenceResult {
  category: string;
  severity: string;
  severity_label: string;
  risk_level: string;
  growth_readiness: string;
  emotional_signals: string[];
  detected_patterns: string[];
  subdomains: string[];
  clarification_questions: Array<{ id: string; question: string; options: string[]; response_type?: string }>;
  behavioural_mirror: string[];
  intelligence_preview: string[];
  persona_detected: string;
  prefilled_answers?: Record<number, string>;
}

interface ConcernSuggestion {
  id: string;
  category: string;
  concern_area: string;
  parent_worry: string;
  has_assessment: boolean;
  construct_key: string | null;
  construct_label: string | null;
  construct_cluster: string | null;
}

interface CapadexReportData {
  reportId: string;
  concernName: string;
  stageCode: string;
  stageLabel: string;
  score: number;
  rawScore: number;
  scoreLevel: string;
  insight: string;
  scoreOverride: number | null;
  headlineOverride: string | null;
  narrativeOverride: string | null;
  overrideReason: string | null;
  reviewStatus: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  participantName: string;
  participantAge: number | null;
  subdomains: Array<{ subdomain_name: string; avg_score: number; item_count: number }>;
  generatedAt: string;
}

interface RieRecommendation {
  title: string;
  expected_outcome: string;
  rec_type: string;
  domain: string;
  timing: string;
  intensity: string;
  confidence: number;
}

interface StageCheckData {
  completed: string[];
  has_prior_completion: boolean;
  next_stage_code: string | null;
  next_stage_label: string | null;
  next_stage_index: number;
  next_stage_color: string;
}

interface PaymentStageData {
  stage_code: string;
  stage_label: string;
  price: string;
  price_note: string;
}

export interface AssessmentModalContextValue {
  phase: string;
  setPhase: React.Dispatch<React.SetStateAction<string>>;
  selectedPersona: PersonaKey | null;
  setSelectedPersona: React.Dispatch<React.SetStateAction<PersonaKey | null>>;
  currentQ: number;
  setCurrentQ: React.Dispatch<React.SetStateAction<number>>;
  answers: Record<number, number>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  participantName: string;
  setParticipantName: React.Dispatch<React.SetStateAction<string>>;
  contextField: string;
  setContextField: React.Dispatch<React.SetStateAction<string>>;
  reportTab: 'results' | 'unlock';
  setReportTab: React.Dispatch<React.SetStateAction<'results' | 'unlock'>>;
  regName: string;
  setRegName: React.Dispatch<React.SetStateAction<string>>;
  regEmail: string;
  setRegEmail: React.Dispatch<React.SetStateAction<string>>;
  regPhone: string;
  setRegPhone: React.Dispatch<React.SetStateAction<string>>;
  regLoading: boolean;
  otpDigits: string[];
  setOtpDigits: React.Dispatch<React.SetStateAction<string[]>>;
  otpLoading: boolean;
  otpError: string | null;
  otpResendTimer: number;
  otpRefs: MutableRefObject<(HTMLInputElement | null)[]>;
  selectedTier: string | null;
  setSelectedTier: React.Dispatch<React.SetStateAction<string | null>>;
  upgradeGoal: string;
  setUpgradeGoal: React.Dispatch<React.SetStateAction<string>>;
  upgradeUrgency: string;
  setUpgradeUrgency: React.Dispatch<React.SetStateAction<string>>;
  emailExistsName: string | null;
  selectedConcern: string | null;
  setSelectedConcern: React.Dispatch<React.SetStateAction<string | null>>;
  concernSearch: string;
  setConcernSearch: React.Dispatch<React.SetStateAction<string>>;
  concernSuggestions: ConcernSuggestion[];
  showConcernSugg: boolean;
  setShowConcernSugg: React.Dispatch<React.SetStateAction<boolean>>;
  concernLoading: boolean;
  concernHighlight: number;
  setConcernHighlight: React.Dispatch<React.SetStateAction<number>>;
  famTermIdx: number;
  famTermVisible: boolean;
  userAge: string;
  setUserAge: React.Dispatch<React.SetStateAction<string>>;
  assesseeType: 'myself' | 'my-child' | 'a-student' | 'someone-else' | '';
  setAssesseeType: React.Dispatch<React.SetStateAction<'myself' | 'my-child' | 'a-student' | 'someone-else' | ''>>;
  requesterName: string;
  setRequesterName: React.Dispatch<React.SetStateAction<string>>;
  capadexSessionId: string | null;
  capadexStage: string;
  capadexStageIndex: number;
  capadexStageColor: string;
  capadexItems: CapadexQuestion[];
  capadexAnswers: Record<string, number>;
  capadexCurrentQ: number;
  capadexStageResult: CapadexStageResult | null;
  capadexProgress: CapadexProgress[];
  capadexLoading: boolean;
  capadexError: string | null;
  concernIntelligence: ConcernIntelligenceResult | null;
  analyzeStep: number;
  clarifyAnswers: Record<number, string>;
  clarifyCurrentQ: number;
  capadexRegEmail: string;
  setCapadexRegEmail: React.Dispatch<React.SetStateAction<string>>;
  capadexPassword: string;
  setCapadexPassword: React.Dispatch<React.SetStateAction<string>>;
  capadexShowPass: boolean;
  setCapadexShowPass: React.Dispatch<React.SetStateAction<boolean>>;
  capadexRegLoading: boolean;
  capadexRegError: string | null;
  setCapadexRegError: React.Dispatch<React.SetStateAction<string | null>>;
  capadexLoginMode: boolean;
  setCapadexLoginMode: React.Dispatch<React.SetStateAction<boolean>>;
  capadexLoginOtpSent: boolean;
  capadexLoginOtpLoading: boolean;
  capadexLoginOtpError: string | null;
  capadexExistingName: string;
  capadexOtpDigits: string[];
  setCapadexOtpDigits: React.Dispatch<React.SetStateAction<string[]>>;
  capadexOtpLoading: boolean;
  capadexOtpError: string | null;
  capadexOtpTimer: number;
  capadexOtpRefs: MutableRefObject<(HTMLInputElement | null)[]>;
  capadexReturnEmail: string;
  setCapadexReturnEmail: React.Dispatch<React.SetStateAction<string>>;
  capadexStageCheck: StageCheckData | null;
  capadexStageCheckLoading: boolean;
  capadexSkipIntent: boolean;
  setCapadexSkipIntent: React.Dispatch<React.SetStateAction<boolean>>;
  capadexUser: { id: string; name: string; email: string } | null;
  capadexReport: CapadexReportData | null;
  rieRecommendations: RieRecommendation[];
  rieHasEscalation: boolean;
  rieActionPlanCopied: boolean;
  setRieActionPlanCopied: React.Dispatch<React.SetStateAction<boolean>>;
  rieActionPlanPdfLoading: boolean;
  setRieActionPlanPdfLoading: React.Dispatch<React.SetStateAction<boolean>>;
  rieActionPlanSharing: boolean;
  setRieActionPlanSharing: React.Dispatch<React.SetStateAction<boolean>>;
  rieActionPlanShared: boolean;
  setRieActionPlanShared: React.Dispatch<React.SetStateAction<boolean>>;
  paymentStageData: PaymentStageData | null;
  showGrowthJourney: boolean;
  setShowGrowthJourney: React.Dispatch<React.SetStateAction<boolean>>;
  deepLinkLoading: boolean;
  deepLinkError: string | null;
  questions: typeof QUESTION_BANKS.student;
  persona: typeof PERSONAS[0];
  computeResults: () => { domains: DomainResult[]; overallPct: number; overallLevel: string };
  handleAnalyseConcern: (concernTextOverride?: string) => Promise<void>;
  handleClarifyAnswer: (optionText: string) => void;
  handleBeginAssessment: () => Promise<void>;
  handleCapadexAnswer: (itemId: string, value: number) => void;
  handleCompleteStage: () => Promise<void>;
  handleContinueToNextStage: () => Promise<void>;
  handleClose: () => void;
  handleAnswer: (value: number) => void;
  handleRegisterSubmit: () => void;
  handleOtpVerify: () => Promise<void>;
  handleResendOtp: () => Promise<void>;
  handleStageCheck: (emailInput: string) => Promise<void>;
  handleSkipToNextStage: (user: { email: string }) => Promise<void>;
  handleCapadexRegister: () => Promise<void>;
  handleCapadexLoginOtpSend: () => Promise<void>;
  handleCapadexOtpVerify: () => Promise<void>;
  handleCapadexOtpResend: () => Promise<void>;
  handlePaymentProceed: () => void;
  onNavigate?: (screen: string) => void;
  onOpenChange: (open: boolean) => void;
  metryxLogo: string;
}

const AssessmentModalContext = createContext<AssessmentModalContextValue | null>(null);

export function useAssessmentModal(): AssessmentModalContextValue {
  const ctx = useContext(AssessmentModalContext);
  if (!ctx) throw new Error('useAssessmentModal must be used within AssessmentModalProvider');
  return ctx;
}

export { AssessmentModalContext };
