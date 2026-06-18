import React from 'react';
import metryxLogo from '@/assets/metryx-logo-transparent.png';
import { ArrowLeft, Check, Mail, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { PhaseProps } from '../types';
export function CapadexOtpPhase(props: PhaseProps) {
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
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <button onClick={() => { setPhase('capadex_register'); setCapadexOtpError(null); }}
                className="flex items-center gap-1 text-[15px] font-medium text-gray-400 hover:text-gray-600 transition-colors">
                <ArrowLeft size={13} /> Back
              </button>
              <button onClick={handleClose} className="text-gray-300 hover:text-gray-500 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: '#344E8615' }}>
                <Mail size={24} style={{ color: '#344E86' }} />
              </div>
              <h3 className="text-[22px] font-bold text-gray-900 mb-1">Check your email</h3>
              <p className="text-[16px] text-gray-500 leading-relaxed">
                We sent a 6-digit code to<br />
                <span className="font-semibold text-gray-700">{capadexRegEmail}</span>
              </p>
            </div>

            {/* 6-box OTP */}
            <div className="flex gap-2.5 justify-center mb-5">
              {capadexOtpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={el => { capadexOtpRefs.current[idx] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(-1);
                    const next = [...capadexOtpDigits]; next[idx] = val;
                    setCapadexOtpDigits(next); setCapadexOtpError(null);
                    if (val && idx < 5) capadexOtpRefs.current[idx + 1]?.focus();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !capadexOtpDigits[idx] && idx > 0) capadexOtpRefs.current[idx - 1]?.focus();
                    if (e.key === 'Enter' && capadexOtpDigits.join('').length === 6) handleCapadexOtpVerify();
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                    if (!pasted) return;
                    const next = [...capadexOtpDigits];
                    pasted.split('').forEach((ch, i) => { if (i < 6) next[i] = ch; });
                    setCapadexOtpDigits(next); setCapadexOtpError(null);
                    capadexOtpRefs.current[Math.min(pasted.length, 5)]?.focus();
                  }}
                  className="w-11 h-12 text-center text-[23px] font-bold rounded-xl border-2 outline-none transition-all"
                  style={{
                    borderColor: capadexOtpError ? '#ef4444' : digit ? '#344E86' : '#e5e7eb',
                    backgroundColor: digit ? '#344E8608' : '#f9fafb',
                    color: '#344E86',
                  }}
                />
              ))}
            </div>

            {capadexOtpError && (
              <p className="text-[15px] text-red-500 text-center mb-3">{capadexOtpError}</p>
            )}

            <Button
              className="w-full h-11 text-[17px] font-bold rounded-xl text-white mb-4 disabled:opacity-50"
              style={{ backgroundColor: '#344E86' }}
              onClick={handleCapadexOtpVerify}
              disabled={capadexOtpLoading || capadexOtpDigits.join('').length < 6}
            >
              {capadexOtpLoading ? 'Verifying…' : 'Verify & View Report'}
            </Button>

            <p className="text-center text-[15px] text-gray-400">
              {capadexOtpTimer > 0
                ? `Resend code in ${capadexOtpTimer}s`
                : <button onClick={handleCapadexOtpResend} className="text-[#344E86] font-semibold underline underline-offset-2">Resend code</button>
              }
            </p>
          </div>
  );
}
