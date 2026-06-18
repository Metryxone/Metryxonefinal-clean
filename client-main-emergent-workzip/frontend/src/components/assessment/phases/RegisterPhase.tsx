import React from 'react';
import metryxLogo from '@/assets/metryx-logo-transparent.png';
import { ArrowRight, CheckCircle, Mail, Phone, Shield, User, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BRAND } from '@/lib/behavioural-insights';

import { PhaseProps } from '../types';
export function RegisterPhase(props: PhaseProps) {
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
          <div className="p-7">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}15` }}>
                  <CheckCircle size={18} style={{ color: BRAND.accent }} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Assessment Complete!</h2>
                  <p className="text-[14px] text-gray-400">Your report is ready — create a free account to view it</p>
                </div>
              </div>
              <button onClick={handleClose} className="text-gray-300 hover:text-gray-500 transition-colors"><X size={18} /></button>
            </div>

            <div className="p-4 rounded-xl mb-5 flex items-center gap-3" style={{ backgroundColor: `${persona.color}06`, border: `1.5px solid ${persona.color}20` }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${persona.color}15` }}>
                {React.createElement(persona.icon, { size: 22, style: { color: persona.color } })}
              </div>
              <div>
                <p className="text-[15px] font-bold" style={{ color: persona.color }}>{persona.reportLabel}</p>
                <p className="text-[14px] text-gray-500">10 domains measured · Instant personalised insights</p>
                <p className="text-[14px] font-semibold text-gray-700 mt-0.5">{participantName ? `Ready for ${participantName}` : 'Ready for you'} — unlock in 30 seconds</p>
              </div>
            </div>

            <div className="space-y-3 mb-5">
              <div>
                <label className="text-[15px] font-semibold text-gray-600 mb-1.5 flex items-center gap-1 block">
                  <User size={11} /> Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-200 transition-all"
                  data-testid="input-reg-name"
                />
              </div>
              <div>
                <label className="text-[15px] font-semibold text-gray-600 mb-1.5 flex items-center gap-1 block">
                  <Mail size={11} /> Email <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => { setRegEmail(e.target.value); setEmailExistsName(null); }}
                  placeholder="you@email.com"
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-200 transition-all"
                  style={emailExistsName !== null ? { borderColor: BRAND.accent } : {}}
                  data-testid="input-reg-email"
                />

                {/* ── Returning user card ── */}
                {emailExistsName !== null && (
                  <div className="mt-2 rounded-xl border p-3.5 animate-in fade-in slide-in-bg-top-1 duration-200"
                    style={{ borderColor: `${BRAND.accent}50`, backgroundColor: `${BRAND.accent}07` }}
                    data-testid="email-exists-card">
                    <p className="text-[16px] font-semibold text-gray-800 mb-0.5">
                      {emailExistsName ? `Welcome back, ${emailExistsName}!` : 'This email is already registered.'}
                    </p>
                    <p className="text-[15px] text-gray-500 mb-3 leading-relaxed">
                      This email already has a MetryxOne account. Log in to access your previous reports, or continue to verify and see this new assessment.
                    </p>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => { handleClose(); window.location.href = '/login'; }}
                        className="w-full h-9 rounded-lg text-white text-[16px] font-bold flex items-center justify-center gap-1.5 hover:opacity-90 transition-all"
                        style={{ backgroundColor: BRAND.accent }}
                        data-testid="btn-login-existing"
                      >
                        Log in to see my previous reports <ArrowRight size={13} />
                      </button>
                      <button
                        onClick={() => sendOtpToEmail(true)}
                        disabled={regLoading}
                        className="w-full h-9 rounded-lg text-[16px] font-semibold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-40"
                        data-testid="btn-continue-anyway"
                      >
                        {regLoading ? 'Sending…' : 'Continue with this email anyway'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="text-[15px] font-semibold text-gray-600 mb-1.5 flex items-center gap-1 block">
                  <Phone size={11} /> Mobile <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  type="tel"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-200 transition-all"
                  data-testid="input-reg-phone"
                />
              </div>
            </div>

            {otpError && phase === 'register' && (
              <p className="text-[15px] text-red-500 mb-3 text-center">{otpError}</p>
            )}

            <Button
              className="w-full h-12 text-sm font-semibold rounded-xl text-white disabled:opacity-40"
              style={{ backgroundColor: BRAND.accent }}
              onClick={handleRegisterSubmit}
              disabled={!regName.trim() || !regEmail.trim() || regLoading}
              data-testid="btn-view-report"
            >
              {regLoading ? 'Sending verification code…' : 'Create free account & see my report'}
              {!regLoading && <ArrowRight size={16} className="ml-2" />}
            </Button>

            <div className="mt-3 flex items-center gap-2 justify-center">
              <Shield size={11} className="text-gray-400" />
              <p className="text-[13px] text-gray-400">DPDP compliant · No spam · Unsubscribe anytime</p>
            </div>
          </div>
  );
}
