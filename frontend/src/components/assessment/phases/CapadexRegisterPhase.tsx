import React, { useState, useCallback, useEffect } from 'react';
import metryxLogo from '@/assets/metryx-logo-transparent.png';
import { AlertCircle, ArrowLeft, ArrowRight, BarChart3, Clock, Download, FileText, Info, LogIn, Mail, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { stageLabel as canonicalStageLabel } from '@/lib/behavioural-insights';

import { PhaseProps } from '../types';
export function CapadexRegisterPhase(props: PhaseProps) {
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
    retrieveReportMode, setRetrieveReportMode,
    recentSessions, recentSessionsLoading, handleLoadPreviousReport,
  } = props;

  // Local state for proactive email-blur check
  const [emailCheckStatus, setEmailCheckStatus] = useState<null | 'checking' | 'exists' | 'limit'>(null);
  const [emailCheckName, setEmailCheckName]     = useState('');

  // Auto-trigger registration when email is already pre-filled from intro and
  // user lands in register mode (not login mode, not retrieve mode).
  useEffect(() => {
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!capadexLoginMode && !retrieveReportMode && emailRx.test(capadexRegEmail)) {
      handleCapadexRegister();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEmailBlurCheck = useCallback(async () => {
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!capadexRegEmail || !emailRx.test(capadexRegEmail)) return;
    setEmailCheckStatus('checking');
    try {
      const r = await fetch(`/api/capadex/auth/check-email?email=${encodeURIComponent(capadexRegEmail.trim())}`);
      const d = await r.json().catch(() => ({}));
      if (d.has_free_assessment) {
        // This email already completed Curiosity — switch straight to login mode so they
        // can verify their identity and pick up from their next stage (or view their report).
        setEmailCheckStatus('limit');
        setEmailCheckName(d.name || '');
        setCapadexLoginMode(true);
        setCapadexRegError(null);
      } else if (d.exists && d.verified) {
        setEmailCheckStatus('exists');
        setEmailCheckName(d.name || '');
      } else {
        setEmailCheckStatus(null);
        setEmailCheckName('');
      }
    } catch {
      setEmailCheckStatus(null);
    }
  }, [capadexRegEmail, setCapadexLoginMode, setCapadexRegError]);

  return (
          <div className="p-6 max-h-[85vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <button onClick={() => { setPhase('capadex_result'); setCapadexLoginMode(false); setCapadexRegError(null); }}
                className="flex items-center gap-1 text-[15px] font-medium text-gray-400 hover:text-gray-600 transition-colors">
                <ArrowLeft size={13} /> Back
              </button>
              <button onClick={handleClose} className="text-gray-300 hover:text-gray-500 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Hero banner — changes based on mode and skip-intent */}
            <div className="rounded-2xl p-5 mb-5 text-center" style={{ background: capadexSkipIntent ? `linear-gradient(135deg, #1e2f5e 0%, #344E86 100%)` : retrieveReportMode ? 'linear-gradient(135deg, #0f766e 0%, #0891b2 100%)' : 'linear-gradient(135deg, #344E86 0%, #3B82F6 100%)' }}>
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
                {capadexSkipIntent ? <ArrowRight size={22} className="text-white" /> : retrieveReportMode ? <Clock size={22} className="text-white" /> : capadexLoginMode ? <LogIn size={22} className="text-white" /> : <BarChart3 size={22} className="text-white" />}
              </div>
              <p className="text-[14px] font-bold text-white/60 uppercase tracking-widest mb-1">
                {capadexSkipIntent ? `Resuming · ${capadexStageCheck?.next_stage_label || 'Next'} Stage` : retrieveReportMode ? 'Find your recent report' : capadexLoginMode ? 'Welcome back' : 'Curiosity Assessment · Free'}
              </p>
              <p className="text-[21px] font-bold text-white mb-1">
                {capadexSkipIntent ? 'Continue your journey' : retrieveReportMode ? (recentSessions.length > 0 ? 'Choose a report to open' : `Hello, ${capadexExistingName || 'there'}!`) : capadexLoginMode ? `Hello, ${capadexExistingName || 'there'}!` : 'Your report is ready!'}
              </p>
              <p className="text-[15px] text-white/70">
                {capadexSkipIntent
                  ? `Curiosity completed for "${selectedConcern}" — log in to jump straight to ${capadexStageCheck?.next_stage_label || 'the next stage'}`
                  : retrieveReportMode
                  ? (recentSessions.length > 0 ? 'Your previous reports are shown below' : 'Enter your email to find your previous assessments')
                  : capadexLoginMode
                  ? 'Log in to access your report and previous assessments'
                  : `${participantName ? `Prepared for ${participantName}` : 'Personalised insights await'} — register to unlock it instantly`}
              </p>
            </div>

            {/* ── PERSONA MISMATCH WARNING ── */}
            {capadexStageCheck?.persona_mismatch && capadexStageCheck.existing_persona && (
              (() => {
                const PERSONA_LABELS: Record<string, string> = {
                  professional: 'Working Professional',
                  campus:       'Campus / College Student',
                  student:      'Student',
                  parent:       'Parent / Guardian',
                  teacher:      'Teacher / Educator',
                  job_seeker:   'Job Seeker',
                  jobseeker:    'Job Seeker',
                  individual:   'Individual',
                };
                const existingLabel = PERSONA_LABELS[capadexStageCheck.existing_persona!] || capadexStageCheck.existing_persona!;
                const currentLabel  = PERSONA_LABELS[selectedPersona || ''] || selectedPersona || 'current profile';
                return (
                  <div className="mb-4 rounded-xl px-4 py-3.5 flex items-start gap-3"
                    style={{ background: '#FFFBEB', border: '1.5px solid #FDE68A' }}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: '#FEF3C7', border: '1.5px solid #FCD34D' }}>
                      <svg viewBox="0 0 16 16" style={{ width: 14, height: 14 }} fill="none">
                        <path d="M8 2L14.5 13.5H1.5L8 2Z" stroke="#D97706" strokeWidth="1.4" strokeLinejoin="round"/>
                        <path d="M8 6v3.5M8 11v.5" stroke="#D97706" strokeWidth="1.4" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold mb-1" style={{ color: '#92400E' }}>
                        Different profile detected for this email
                      </p>
                      <p className="text-[11.5px] leading-relaxed" style={{ color: '#78350F' }}>
                        This email was previously used for a <strong>{existingLabel}</strong> assessment.
                        Your current <strong>{currentLabel}</strong> assessment will be tracked completely separately — both are saved under your account.
                      </p>
                      <p className="text-[11px] mt-1.5" style={{ color: '#B45309' }}>
                        If this is not your email, enter a different one below.
                      </p>
                    </div>
                  </div>
                );
              })()
            )}

            {/* ── RETRIEVE MODE: sessions list ── */}
            {retrieveReportMode && recentSessions.length > 0 && (
              <div className="space-y-2 mb-4">
                {recentSessionsLoading ? (
                  <div className="py-6 text-center text-[15px] text-gray-400">Loading your reports…</div>
                ) : (
                  recentSessions.map(s => {
                    const stageLabel = canonicalStageLabel(s.stage_code);
                    const stageColor = s.stage_code === 'CAP_CUR' ? '#344E86' : s.stage_code === 'CAP_INS' ? '#6366F1' : s.stage_code === 'CAP_GRW' ? '#10B981' : '#F59E0B';
                    const when = new Date(s.created_at);
                    const timeAgo = (() => {
                      const mins = Math.round((Date.now() - when.getTime()) / 60000);
                      if (mins < 60) return `${mins}m ago`;
                      return `${Math.round(mins / 60)}h ago`;
                    })();
                    return (
                      <div key={s.session_id} className="rounded-xl border border-gray-100 bg-white p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[12px] font-bold uppercase tracking-widest" style={{ color: stageColor }}>{stageLabel}</span>
                            <span className="text-[12px] text-gray-300">·</span>
                            <span className="text-[12px] text-gray-400">{timeAgo}</span>
                          </div>
                          <p className="text-[15px] font-semibold text-gray-800 truncate">{s.concern_name}</p>
                          {s.score != null && (
                            <p className="text-[13px] text-gray-400 mt-0.5">Score: <span className="font-semibold text-gray-600">{Math.round(s.score)}%</span> · {s.score_level || '—'}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleLoadPreviousReport(s.session_id)}
                          className="shrink-0 h-9 px-4 rounded-xl text-[13px] font-bold text-white flex items-center gap-1.5"
                          style={{ backgroundColor: stageColor }}
                        >
                          Open <ArrowRight size={11} />
                        </button>
                      </div>
                    );
                  })
                )}
                <button
                  onClick={() => { setRetrieveReportMode(false); setCapadexLoginMode(false); }}
                  className="w-full text-center text-[14px] text-gray-400 hover:text-gray-600 transition-colors py-1"
                >
                  ← Back to register
                </button>
              </div>
            )}

            {/* What you'll get — only in register mode */}
            {!capadexLoginMode && !retrieveReportMode && (
              <div className="grid grid-cols-3 gap-2 mb-5">
                {[
                  { icon: BarChart3, label: 'Domain Scores', sub: 'Across all assessed areas' },
                  { icon: Sparkles,  label: 'AI Insight',   sub: 'Personalised to your answers' },
                  { icon: Download,  label: 'PDF Report',   sub: 'Download & keep forever' },
                ].map(({ icon: Icon, label, sub }) => (
                  <div key={label} className="rounded-xl p-3 text-center border border-gray-100 bg-gray-50">
                    <Icon size={16} className="mx-auto mb-1.5" style={{ color: '#344E86' }} />
                    <p className="text-[14px] font-bold text-gray-800">{label}</p>
                    <p className="text-[13px] text-gray-400 mt-0.5 leading-tight">{sub}</p>
                  </div>
                ))}
              </div>
            )}

            {/* ── LOGIN MODE (hidden once sessions are retrieved) ── */}
            {capadexLoginMode && !(retrieveReportMode && recentSessions.length > 0) ? (
              capadexLoginOtpSent ? (
                /* Login OTP entry */
                <div>
                  <p className="text-center text-[15px] text-gray-500 mb-4">
                    We sent a 6-digit code to <span className="font-semibold text-gray-700">{capadexRegEmail}</span>
                  </p>

                  {/* 6-digit boxes — reuse same refs/state */}
                  <div className="flex justify-center gap-2 mb-4">
                    {capadexOtpDigits.map((d, i) => (
                      <input
                        key={i}
                        ref={el => { capadexOtpRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={d}
                        onChange={e => {
                          const val = e.target.value.replace(/\D/, '');
                          const next = [...capadexOtpDigits];
                          next[i] = val;
                          setCapadexOtpDigits(next);
                          if (val && i < 5) capadexOtpRefs.current[i + 1]?.focus();
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Backspace' && !capadexOtpDigits[i] && i > 0) capadexOtpRefs.current[i - 1]?.focus();
                          if (e.key === 'Enter' && capadexOtpDigits.join('').length === 6) handleCapadexOtpVerify();
                        }}
                        onPaste={e => {
                          const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                          if (text.length) {
                            setCapadexOtpDigits(Array.from({ length: 6 }, (_, k) => text[k] || ''));
                            capadexOtpRefs.current[Math.min(text.length, 5)]?.focus();
                          }
                        }}
                        className="w-10 h-12 text-center text-[23px] font-bold rounded-xl border-2 border-gray-200 focus:outline-none focus:border-[#344E86] transition-all"
                        style={{ color: '#344E86' }}
                      />
                    ))}
                  </div>

                  {capadexOtpError && (
                    <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-100 flex items-start gap-2">
                      <AlertCircle size={13} className="text-red-400 mt-0.5 shrink-0" />
                      <p className="text-[15px] text-red-600">{capadexOtpError}</p>
                    </div>
                  )}

                  <Button
                    className="w-full h-11 text-[17px] font-bold rounded-xl text-white mb-3 disabled:opacity-50"
                    style={{ backgroundColor: '#344E86' }}
                    onClick={handleCapadexOtpVerify}
                    disabled={capadexOtpLoading || capadexOtpDigits.join('').length < 6}
                  >
                    {capadexOtpLoading ? 'Verifying…' : 'Verify & view report →'}
                  </Button>

                  <p className="text-center text-[14px] text-gray-400 mb-1">
                    {capadexOtpTimer > 0
                      ? <>Resend code in <span className="font-semibold">{capadexOtpTimer}s</span></>
                      : <>Didn't get the code?{' '}
                          <button className="text-[#344E86] font-semibold hover:underline" onClick={handleCapadexOtpResend}>
                            Resend
                          </button>
                        </>
                    }
                  </p>
                  <p className="text-center text-[14px] text-gray-400">
                    <button className="hover:underline" onClick={() => { setCapadexLoginOtpSent(false); setCapadexOtpDigits(['','','','','','']); setCapadexOtpError(null); }}>
                      ← Change email
                    </button>
                  </p>
                </div>
              ) : (
                /* Login email + Send OTP */
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="text-[15px] font-semibold text-gray-600 mb-1.5 flex items-center gap-1 block">
                      <Mail size={11} /> Email Address <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      value={capadexRegEmail}
                      onChange={(e) => { setCapadexRegEmail(e.target.value); setCapadexLoginOtpError(null); }}
                      placeholder="you@email.com"
                      className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 transition-all"
                      style={{ '--tw-ring-color': '#344E8640' } as React.CSSProperties}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleCapadexLoginOtpSend(); }}
                    />
                  </div>

                  {capadexLoginOtpError && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-100 flex items-start gap-2">
                      <AlertCircle size={13} className="text-red-400 mt-0.5 shrink-0" />
                      <p className="text-[15px] text-red-600">{capadexLoginOtpError}</p>
                    </div>
                  )}

                  <Button
                    className="w-full h-11 text-[17px] font-bold rounded-xl text-white disabled:opacity-50"
                    style={{ backgroundColor: retrieveReportMode ? '#0f766e' : '#344E86' }}
                    onClick={handleCapadexLoginOtpSend}
                    disabled={capadexLoginOtpLoading || !capadexRegEmail}
                  >
                    {capadexLoginOtpLoading ? 'Sending code…' : retrieveReportMode ? 'Find my reports →' : 'Send OTP →'}
                  </Button>

                  <p className="text-center text-[14px] text-gray-400">
                    {retrieveReportMode ? (
                      <button
                        className="text-gray-400 hover:underline"
                        onClick={() => { setRetrieveReportMode(false); setCapadexLoginMode(false); setCapadexRegEmail(''); }}
                      >
                        ← Back to register
                      </button>
                    ) : (
                      <>Not your account?{' '}
                        <button
                          className="text-[#344E86] font-semibold hover:underline"
                          onClick={() => { setCapadexLoginMode(false); setCapadexLoginOtpError(null); setCapadexRegEmail(''); }}
                        >
                          Register with a different email
                        </button>
                      </>
                    )}
                  </p>
                </div>
              )
            ) : (
              /* ── REGISTER MODE ── */
              <>
                <div className="space-y-3 mb-4">
                  {/* Email */}
                  <div>
                    <label className="text-[15px] font-semibold text-gray-600 mb-1.5 flex items-center gap-1 block">
                      <Mail size={11} /> Email Address <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      value={capadexRegEmail}
                      onChange={(e) => { setCapadexRegEmail(e.target.value); setCapadexRegError(null); setEmailCheckStatus(null); }}
                      placeholder="you@email.com"
                      className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 transition-all"
                      style={{ '--tw-ring-color': '#344E8640' } as React.CSSProperties}
                      onBlur={() => {
                        const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                        if (capadexRegEmail && !emailRx.test(capadexRegEmail)) {
                          setCapadexRegError('Please enter a valid email address.');
                        } else {
                          handleEmailBlurCheck();
                        }
                      }}
                    />

                    {/* Proactive email-check banners */}
                    {emailCheckStatus === 'checking' && (
                      <p className="mt-1.5 text-[13px] text-gray-400 flex items-center gap-1">
                        <span className="inline-block w-3 h-3 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
                        Checking…
                      </p>
                    )}
                    {emailCheckStatus === 'limit' && (
                      <div className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
                        <Info size={13} className="text-amber-500 mt-0.5 shrink-0" />
                        <p className="text-[13px] text-amber-800 leading-snug">
                          <span className="font-semibold">{emailCheckName ? `${emailCheckName}, you've` : "You've"} already completed a free CAPADEX assessment</span> with this email.
                          {' '}Log in below to view your existing report or unlock deeper stages.
                        </p>
                      </div>
                    )}
                    {emailCheckStatus === 'exists' && (
                      <div className="mt-2 p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-2">
                        <Info size={13} className="text-blue-400 mt-0.5 shrink-0" />
                        <p className="text-[13px] text-blue-800 leading-snug">
                          This email already has a CAPADEX account.{' '}
                          <button
                            className="font-semibold underline"
                            onClick={() => { setCapadexLoginMode(true); setCapadexRegError(null); setEmailCheckStatus(null); }}
                          >
                            Log in instead
                          </button>
                        </p>
                      </div>
                    )}
                  </div>

                </div>

                {capadexRegError && (
                  <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-100 flex items-start gap-2">
                    <AlertCircle size={13} className="text-red-400 mt-0.5 shrink-0" />
                    <p className="text-[15px] text-red-600 leading-relaxed">{capadexRegError}</p>
                  </div>
                )}

                <Button
                  className="w-full h-11 text-[17px] font-bold rounded-xl text-white mb-3 disabled:opacity-50"
                  style={{ backgroundColor: '#344E86' }}
                  onClick={handleCapadexRegister}
                  disabled={capadexRegLoading || !capadexRegEmail}
                >
                  {capadexRegLoading ? 'Sending verification code…' : 'Send Verification Code →'}
                </Button>

                <p className="text-center text-[14px] text-gray-400 mb-2">
                  Already have an account?{' '}
                  <button
                    className="text-[#344E86] font-semibold hover:underline"
                    onClick={() => { setCapadexLoginMode(true); setCapadexLoginOtpSent(false); setCapadexRegError(null); }}
                  >
                    Log in
                  </button>
                </p>

                {/* Find a previous report */}
                <div className="mt-1 pt-3 border-t border-gray-100 text-center">
                  <button
                    className="inline-flex items-center gap-1.5 text-[14px] text-gray-400 hover:text-teal-600 transition-colors"
                    onClick={() => {
                      setRetrieveReportMode(true);
                      setCapadexLoginMode(true);
                      setCapadexLoginOtpSent(false);
                      setCapadexRegError(null);
                    }}
                  >
                    <Clock size={12} />
                    Find a previous report
                  </button>
                </div>
              </>
            )}

            <p className="text-center text-[13px] text-gray-400">
              Your data is confidential · DPDP compliant · No spam, ever
            </p>
          </div>

  );
}
