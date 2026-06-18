import React from 'react';
import metryxLogo from '@/assets/metryx-logo-transparent.png';
import { ArrowLeft, Sparkles, X } from 'lucide-react';
import { BRAND, RATING_OPTIONS } from '@/lib/behavioural-insights';

import { PhaseProps } from '../types';
export function QuestionsPhase(props: PhaseProps) {
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
    progress,
  } = props;

  return (
          <div className="flex flex-col">
            <div className="px-6 pt-5 pb-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-bold uppercase tracking-wider" style={{ color: persona.color }}>
                    {currentQ + 1}/{questions.length}
                  </span>
                  <span className="text-[14px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
                    style={{ backgroundColor: `${persona.color}08`, color: persona.color }}>
                    {questions[currentQ].domainLabel}
                  </span>
                </div>
                <button onClick={handleClose} className="text-gray-300 hover:text-gray-500 transition-colors" data-testid="btn-close-assessment"><X size={16} /></button>
              </div>
              <div className="w-full h-1.5 rounded-full bg-gray-100">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: persona.color }} />
              </div>
            </div>

            <div className="px-6 pt-4 pb-2">
              <p className="text-[20px] font-semibold text-gray-900 leading-relaxed" data-testid="question-text">
                {persona.respondentPrefix(participantName)} {questions[currentQ].text}
              </p>
              <p className="text-[14px] mt-2 flex items-center gap-1" style={{ color: BRAND.accent }}>
                <Sparkles size={10} />
                {questions[currentQ].tip}
              </p>
            </div>

            <div className="px-6 pt-2 pb-5">
              {/* Scale anchors */}
              <div className="flex justify-between text-[13px] font-medium text-gray-400 mb-2 px-0.5">
                <span>Never</span>
                <span>Always</span>
              </div>
              {/* Connecting track */}
              <div className="relative mb-3">
                <div className="absolute top-1/2 left-0 right-0 h-px -translate-y-1/2" style={{ backgroundColor: '#e5e7eb' }} />
                <div className="relative flex justify-between">
                  {RATING_OPTIONS.map(option => {
                    const isSelected = answers[questions[currentQ].id] === option.value;
                    return (
                      <button
                        key={option.value}
                        onClick={() => handleAnswer(option.value)}
                        className="flex flex-col items-center gap-1.5 group"
                        data-testid={`rating-${option.value}`}
                        style={{ width: 48 }}
                      >
                        {/* Circle marker */}
                        <div
                          className="w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all duration-150"
                          style={{
                            borderColor: isSelected ? persona.color : '#d1d5db',
                            backgroundColor: isSelected ? persona.color : '#fff',
                            boxShadow: isSelected ? `0 0 0 4px ${persona.color}18` : undefined,
                          }}
                        >
                          <span
                            className="text-[17px] font-bold leading-none"
                            style={{ color: isSelected ? '#fff' : '#9ca3af' }}
                          >
                            {option.value}
                          </span>
                        </div>
                        {/* Frequency label */}
                        <span
                          className="text-[12px] font-semibold uppercase tracking-wide text-center leading-tight transition-colors"
                          style={{ color: isSelected ? persona.color : '#b0b7c3' }}
                        >
                          {option.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-6 pb-4 flex items-center justify-between">
              {currentQ > 0 ? (
                <button onClick={() => setCurrentQ(currentQ - 1)} className="flex items-center gap-1 text-[15px] font-medium text-gray-400 hover:text-gray-600 transition-colors" data-testid="btn-prev-question">
                  <ArrowLeft size={13} /> Back
                </button>
              ) : <span />}
              <span className="text-[14px] text-gray-300">{Object.keys(answers).length} of {questions.length} answered</span>
            </div>
          </div>
  );
}
