import React from 'react';
import metryxLogo from '@/assets/metryx-logo-transparent.png';
import { ArrowLeft, Check, ChevronRight, Mail, Shield, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BRAND } from '@/lib/behavioural-insights';

import { PhaseProps } from '../types';
export function OtpPhase(props: PhaseProps) {
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
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <button onClick={() => { setPhase('register'); setOtpError(null); }}
                className="flex items-center gap-1 text-[15px] font-medium text-gray-400 hover:text-gray-600 transition-colors">
                <ArrowLeft size={13} /> Back
              </button>
              <button onClick={handleClose} className="text-gray-300 hover:text-gray-500 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Icon + title */}
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{ backgroundColor: `${BRAND.accent}15` }}>
                <Mail size={24} style={{ color: BRAND.accent }} />
              </div>
              <h3 className="text-[22px] font-bold text-gray-900 mb-1">Check your email</h3>
              <p className="text-[16px] text-gray-500 leading-relaxed">
                We sent a 6-digit code to<br />
                <span className="font-semibold text-gray-700">{regEmail}</span>
              </p>
            </div>

            {/* 6-box OTP input */}
            <div className="flex gap-2.5 justify-center mb-5" data-testid="otp-input-group">
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={el => { otpRefs.current[idx] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  data-testid={`otp-digit-${idx}`}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(-1);
                    const next = [...otpDigits];
                    next[idx] = val;
                    setOtpDigits(next);
                    setOtpError(null);
                    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !otpDigits[idx] && idx > 0) {
                      otpRefs.current[idx - 1]?.focus();
                    }
                    if (e.key === 'Enter' && otpDigits.join('').length === 6) handleOtpVerify();
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                    if (!pasted) return;
                    const next = [...otpDigits];
                    pasted.split('').forEach((ch, i) => { if (i < 6) next[i] = ch; });
                    setOtpDigits(next);
                    setOtpError(null);
                    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
                  }}
                  className="w-11 h-12 text-center text-[23px] font-bold rounded-xl border-2 outline-none transition-all"
                  style={{
                    borderColor: otpError ? '#ef4444' : digit ? BRAND.accent : '#e5e7eb',
                    backgroundColor: digit ? `${BRAND.accent}08` : '#f9fafb',
                    color: BRAND.primary,
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = BRAND.accent; e.currentTarget.style.boxShadow = `0 0 0 3px ${BRAND.accent}20`; }}
                  onBlur={e => { e.currentTarget.style.borderColor = otpError ? '#ef4444' : otpDigits[idx] ? BRAND.accent : '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              ))}
            </div>

            {/* Error */}
            {otpError && (
              <p className="text-[15px] text-red-500 text-center mb-3">{otpError}</p>
            )}

            {/* Verify button */}
            <Button
              className="w-full h-11 text-sm font-semibold rounded-xl text-white disabled:opacity-40 mb-4"
              style={{ backgroundColor: BRAND.accent }}
              onClick={handleOtpVerify}
              disabled={otpDigits.join('').length < 6 || otpLoading}
              data-testid="btn-verify-otp"
            >
              {otpLoading ? 'Verifying…' : 'Verify & see my report'}
              {!otpLoading && <ChevronRight size={15} className="ml-1.5" />}
            </Button>

            {/* Resend */}
            <p className="text-[15px] text-center text-gray-400">
              Didn't receive it?{' '}
              {otpResendTimer > 0 ? (
                <span className="font-medium" style={{ color: BRAND.accent }}>Resend in {otpResendTimer}s</span>
              ) : (
                <button onClick={handleResendOtp}
                  className="font-semibold underline underline-offset-2 transition-colors"
                  style={{ color: BRAND.accent }}>
                  Resend code
                </button>
              )}
            </p>

            <div className="mt-4 flex items-center gap-2 justify-center">
              <Shield size={11} className="text-gray-300" />
              <p className="text-[13px] text-gray-400">Code expires in 10 minutes · DPDP compliant</p>
            </div>
          </div>

  );
}
