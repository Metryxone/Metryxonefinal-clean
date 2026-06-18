import React from 'react';
import metryxLogo from '@/assets/metryx-logo-transparent.png';
import { Brain, CheckCircle } from 'lucide-react';
import { BRAND } from '@/lib/behavioural-insights';

import { PhaseProps } from '../types';
export function AnalyzingPhase(props: PhaseProps) {
  const {
    phase, setPhase, selectedPersona, setSelectedPersona, currentQ, setCurrentQ,
    answers, setAnswers, participantName, setParticipantName, contextField, setContextField,
    regEmail, setRegEmail, selectedConcern, setSelectedConcern, concernSearch,
    setConcernSearch, concernSuggestions, showConcernSugg, setShowConcernSugg,
    concernLoading, concernHighlight, setConcernHighlight, famTermIdx, famTermVisible,
    userAge, setUserAge, assesseeType, setAssesseeType, requesterName, setRequesterName,
    capadexItems, capadexProgress, capadexLoading, capadexError, capadexStage,
    capadexStageIndex, capadexStageColor, concernIntelligence, analyzeStep,
    clarifyAnswers, clarifyCurrentQ, capadexRegEmail, setCapadexRegEmail,
    capadexPassword, setCapadexPassword, capadexShowPass, setCapadexShowPass,
    capadexRegLoading, capadexRegError, setCapadexRegError, capadexLoginMode,
    setCapadexLoginMode, capadexLoginOtpSent, capadexLoginOtpLoading,
    capadexLoginOtpError, capadexExistingName, capadexOtpDigits, setCapadexOtpDigits,
    capadexOtpLoading, capadexOtpError, capadexOtpTimer, capadexOtpRefs,
    capadexReturnEmail, setCapadexReturnEmail, capadexStageCheck, capadexStageCheckLoading,
    capadexSkipIntent, setCapadexSkipIntent, capadexUser, capadexSessionId,
    selectedTier, setSelectedTier, upgradeGoal, setUpgradeGoal, upgradeUrgency, setUpgradeUrgency,
    otpRefs, otpDigits, setOtpDigits, otpLoading, otpError, otpResendTimer,
    regLoading, regName, setRegName, regPhone, setRegPhone, emailExistsName,
    handleAnalyseConcern, handleClarifyAnswer, handleBeginAssessment, handleCapadexAnswer,
    handleCompleteStage, handleContinueToNextStage, handleClose, handleAnswer,
    handleRegisterSubmit, handleOtpVerify, handleResendOtp, handleStageCheck,
    handleSkipToNextStage, handleCapadexRegister, handleCapadexLoginOtpSend,
    handleCapadexOtpVerify, handleCapadexOtpResend, questions, persona, computeResults,
  } = props;

  return (
          <div className="p-10 text-center">
            <div className="w-20 h-20 rounded-full mx-auto mb-5 flex items-center justify-center relative">
              <div className="absolute inset-0 rounded-full animate-ping opacity-15" style={{ backgroundColor: persona.color }} />
              <div className="w-full h-full rounded-full flex items-center justify-center" style={{ backgroundColor: `${persona.color}12` }}>
                <Brain size={30} style={{ color: persona.color }} className="animate-pulse" />
              </div>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">{persona.analyzeLabel}</h3>
            <p className="text-sm text-gray-400 mb-1">Mapping across {questions.length} behavioral domains...</p>
            <div className="mt-5 space-y-2 max-w-xs mx-auto text-left">
              {["Scoring behavioral indicators", "Computing domain profile", "Generating personalised insights"].map((step, i) => (
                <div key={i} className="flex items-center gap-2 text-[15px] text-gray-500 animate-pulse" style={{ animationDelay: `${i * 0.4}s` }}>
                  <CheckCircle size={12} style={{ color: BRAND.accent }} />
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
  );
}
