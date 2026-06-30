import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Eye, GitMerge, Mail, TrendingUp, X } from 'lucide-react';
import { METRYX_NAVY, getAgeRange, stageLabel as canonicalStageLabel } from '@/lib/behavioural-insights';
import { PhaseProps } from '../types';

export function CapadexPreviewPhase(props: PhaseProps) {
  const {
    phase, setPhase, selectedPersona, setSelectedPersona, currentQ, setCurrentQ,
    answers, participantName, setParticipantName, contextField, setContextField,
    regEmail, setRegEmail, selectedConcern, setSelectedConcern, concernSearch,
    setConcernSearch, concernSuggestions, showConcernSugg, setShowConcernSugg,
    concernLoading, concernHighlight, setConcernHighlight, famTermIdx, famTermVisible,
    userAge, setUserAge, assesseeType, setAssesseeType, requesterName, setRequesterName,
    capadexSessionId, capadexStage, capadexStageIndex, capadexStageColor, capadexItems,
    capadexAnswers, capadexCurrentQ, capadexStageResult, capadexProgress, capadexLoading,
    capadexError, concernIntelligence, analyzeStep, clarifyAnswers, clarifyCurrentQ,
    capadexRegEmail, setCapadexRegEmail, capadexPassword, setCapadexPassword,
    capadexShowPass, setCapadexShowPass, capadexRegLoading, capadexRegError,
    setCapadexRegError, capadexLoginMode, setCapadexLoginMode, capadexLoginOtpSent,
    capadexLoginOtpLoading, capadexLoginOtpError, capadexExistingName,
    capadexOtpDigits, setCapadexOtpDigits, capadexOtpLoading, capadexOtpError,
    capadexOtpTimer, capadexOtpRefs, capadexReturnEmail, setCapadexReturnEmail,
    capadexStageCheck, capadexStageCheckLoading, capadexSkipIntent, setCapadexSkipIntent,
    capadexUser, capadexReport, rieRecommendations, rieHasEscalation,
    paymentStageData, selectedTier, setSelectedTier, upgradeGoal, setUpgradeGoal,
    upgradeUrgency, setUpgradeUrgency, otpRefs, otpDigits, setOtpDigits, otpLoading,
    otpError, otpResendTimer, regLoading, regName, setRegName, regPhone, setRegPhone,
    reportTab, setReportTab, emailExistsName, handleAnalyseConcern, handleClarifyAnswer,
    handleBeginAssessment, handleCapadexAnswer, handleCompleteStage, handleContinueToNextStage,
    handleClose, handleAnswer, handleRegisterSubmit, handleOtpVerify, handleResendOtp,
    handleStageCheck, handleSkipToNextStage, handleCapadexRegister,
    handleCapadexLoginOtpSend, handleCapadexOtpVerify, handleCapadexOtpResend,
    handlePaymentProceed, questions, persona, computeResults,
  } = props;

  const ci = concernIntelligence;
  const CAT_COLORS: Record<string, string> = {
    digital: '#3b82f6', academic: '#8b5cf6', emotional: '#ec4899',
    behavioural: '#f59e0b', social: '#06b6d4', career: '#10b981',
    wellness: '#22c55e', general: METRYX_NAVY,
  };
  const catColor = CAT_COLORS[ci?.category] || METRYX_NAVY;

  const getAssesseeOptions = (p: string | null) => {
    if (p === 'parent')       return [{ key: 'my-child' as const, label: 'My Child' }, { key: 'myself' as const, label: 'Myself' }, { key: 'someone-else' as const, label: 'Someone Else' }];
    if (p === 'teacher')      return [{ key: 'a-student' as const, label: 'A Student' }, { key: 'myself' as const, label: 'Myself' }, { key: 'someone-else' as const, label: 'Someone Else' }];
    if (p === 'student')      return [{ key: 'myself' as const, label: 'Myself' }, { key: 'someone-else' as const, label: 'Someone Else' }];
    if (p === 'professional') return [{ key: 'myself' as const, label: 'Myself' }, { key: 'someone-else' as const, label: 'Someone Else' }];
    if (p === 'campus')       return [{ key: 'myself' as const, label: 'Myself' }, { key: 'someone-else' as const, label: 'Someone Else' }];
    if (p === 'jobseeker')    return [{ key: 'myself' as const, label: 'Myself' }, { key: 'someone-else' as const, label: 'Someone Else' }];
    return [
      { key: 'myself' as const, label: 'Myself' },
      { key: 'my-child' as const, label: 'My Child' },
      { key: 'a-student' as const, label: 'A Student' },
      { key: 'someone-else' as const, label: 'Someone Else' },
    ];
  };

  const ASSESSEE_OPTIONS = getAssesseeOptions(selectedPersona);
  const ageRange   = getAgeRange(selectedPersona, assesseeType);
  const ageVal     = parseInt(userAge, 10);
  const ageInvalid = userAge !== '' && (isNaN(ageVal) || ageVal < ageRange.min || ageVal > ageRange.max);
  const ageOk      = userAge !== '' && !isNaN(ageVal) && ageVal >= ageRange.min && ageVal <= ageRange.max;
  const canBegin   = !!assesseeType && !!participantName.trim() && ageOk;

  const nameLabelMap: Record<string, string> = {
    'myself': 'Your name', 'my-child': "Child's name",
    'a-student': "Student's name", 'someone-else': 'Name of person',
  };
  const namePlaceholderMap: Record<string, string> = {
    'myself': 'e.g. Arjun', 'my-child': 'e.g. Kavya',
    'a-student': 'e.g. Rahul', 'someone-else': 'e.g. Priya',
  };
  const ageLabelMap: Record<string, string> = {
    'myself': 'Your age', 'my-child': "Child's age",
    'a-student': "Student's age", 'someone-else': 'Their age',
  };

  return (
    <div className="flex flex-col select-none" style={{ maxHeight: '92vh' }}>

      {/* ── Compact header bar ── */}
      <div className="relative flex items-center justify-between px-5 py-3 shrink-0"
        style={{ background: `linear-gradient(135deg, #1e2f5e 0%, ${METRYX_NAVY} 60%, #3d5fa8 100%)` }}>
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Intelligence Preview
            </span>
            <h2 className="text-base font-black text-white leading-tight" style={{ letterSpacing: '-0.3px' }}>
              {selectedConcern || 'Your Concern Profile'}
            </h2>
          </div>
        </div>
        <button onClick={handleClose}
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 ml-3"
          style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
          <X size={14} />
        </button>
      </div>

      {/* ── Landscape body: left = intelligence, right = form ── */}
      <div className="flex min-h-0" style={{ maxHeight: 'calc(92vh - 56px)' }}>

        {/* LEFT — Intelligence content (scrollable) */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-4">

            {/* ── Correlation Intelligence — shown only when multiple concerns selected ── */}
            {ci?.concern_correlation && (
              <div className="rounded-xl p-3.5" style={{ background: 'linear-gradient(135deg, #1e2f5e08, #3d5fa812)', border: '1px solid #344E8630' }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: '#344E8618' }}>
                    <GitMerge size={10} style={{ color: '#344E86' }} />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#344E8680' }}>Cross-Concern Pattern</p>
                    <p className="text-[12px] font-bold leading-tight" style={{ color: '#344E86' }}>{ci.concern_correlation.title}</p>
                  </div>
                </div>
                <p className="text-[12px] leading-relaxed text-gray-600 mb-2">{ci.concern_correlation.insight}</p>
                <div className="flex items-start gap-1.5 p-2 rounded-lg" style={{ backgroundColor: '#344E8608' }}>
                  <TrendingUp size={10} className="mt-0.5 shrink-0" style={{ color: '#344E86' }} />
                  <p className="text-[11px] text-gray-500 leading-snug"><span className="font-semibold" style={{ color: '#344E86' }}>Key driver:</span> {ci.concern_correlation.driver}</p>
                </div>
                {ci.concern_correlation.concerns?.length > 1 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {ci.concern_correlation.concerns.map((c: string, i: number) => (
                      <span key={i} className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: '#344E8612', color: '#344E86' }}>{c}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Pattern Intelligence */}
            {ci?.intelligence_preview?.length > 0 && (
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Pattern Intelligence</p>
                  {/* Provenance micro-pill — mirrors the report phase, surfaces atomic-telemetry count when the backend supplies it. */}
                  {(() => {
                    const atomicCount = Number(
                      (ci as Record<string, unknown>)?.atomic_signal_count
                      ?? (ci as Record<string, unknown>)?.atomicSignalCount
                      ?? 0
                    );
                    if (!Number.isFinite(atomicCount) || atomicCount <= 0) return null;
                    return (
                      <span
                        className="text-[9px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ backgroundColor: `${catColor}10`, color: catColor, border: `1px solid ${catColor}22` }}
                        title="Derived from atomic behavioural telemetry signals captured during your clarification responses."
                      >
                        Derived from {atomicCount} atomic telemetry signal{atomicCount === 1 ? '' : 's'}
                      </span>
                    );
                  })()}
                </div>
                <div className="space-y-1.5">
                  {ci.intelligence_preview.map((stmt, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl"
                      style={{
                        backgroundColor: i === 0 ? `${catColor}08` : '#f8fafc',
                        border: `1px solid ${i === 0 ? catColor + '22' : '#f1f5f9'}`,
                      }}>
                      <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: i === 0 ? `${catColor}15` : '#f1f5f9' }}>
                        {i === 0
                          ? <AlertTriangle size={8} style={{ color: catColor }} />
                          : <Eye size={8} style={{ color: '#94a3b8' }} />}
                      </div>
                      <p className="text-[12px] font-medium leading-snug" style={{ color: i === 0 ? catColor : '#374151' }}>{stmt}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Emotional Signals */}
            {ci?.emotional_signals?.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Emotional Signals</p>
                <div className="flex flex-wrap gap-1.5">
                  {ci.emotional_signals.map(s => (
                    <span key={s} className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${catColor}10`, color: catColor, border: `1px solid ${catColor}22` }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Behavioural Mirror */}
            {ci?.behavioural_mirror?.length > 0 && (
              <div className="rounded-xl p-3.5" style={{ backgroundColor: '#EEF2FA', border: `1.5px solid ${METRYX_NAVY}18` }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: METRYX_NAVY }}>Behavioural Mirror</p>
                <p className="text-[11px] text-gray-400 mb-1.5">People experiencing this concern often…</p>
                <div className="space-y-1.5">
                  {ci.behavioural_mirror.slice(0, 3).map((m, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: METRYX_NAVY }} />
                      <p className="text-[12px] text-gray-700 leading-snug">{m}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Growth Readiness */}
            {ci?.growth_readiness && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                <TrendingUp size={14} className="text-emerald-600 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Growth Readiness</p>
                  <p className="text-[12px] text-emerald-700 font-medium capitalize">
                    {ci.growth_readiness} — assessment will validate this profile
                  </p>
                </div>
              </div>
            )}

            {/* Subdomains */}
            {ci?.subdomains?.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Domains to Explore</p>
                <div className="flex flex-wrap gap-1.5">
                  {ci.subdomains.map(s => (
                    <span key={s} className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${METRYX_NAVY}08`, color: METRYX_NAVY, border: `1px solid ${METRYX_NAVY}18` }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* RIGHT — Intake form */}
        <div className="w-64 shrink-0 flex flex-col border-l overflow-y-auto"
          style={{ borderColor: '#e2e8f0', backgroundColor: '#f8fafc' }}>
          <div className="p-4 flex flex-col gap-3 flex-1">

            <p className="text-[12px] font-bold text-gray-700">Who is this assessment for?</p>

            {/* Assessee type */}
            <div className="grid grid-cols-2 gap-1.5">
              {ASSESSEE_OPTIONS.map(({ key, label }) => (
                <button key={key} onClick={() => setAssesseeType(key)}
                  className="py-1.5 px-2 rounded-lg border text-[11px] font-semibold transition-all"
                  style={{
                    backgroundColor: assesseeType === key ? METRYX_NAVY : '#fff',
                    color: assesseeType === key ? '#fff' : '#4B5563',
                    borderColor: assesseeType === key ? METRYX_NAVY : '#E5E7EB',
                  }}>
                  {label}
                </button>
              ))}
            </div>

            {assesseeType && (
              <>
                {/* Name */}
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1 block">
                    {nameLabelMap[assesseeType] || 'Name'} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={participantName}
                    onChange={e => setParticipantName(e.target.value)}
                    placeholder={namePlaceholderMap[assesseeType] || 'e.g. Arjun'}
                    autoFocus
                    className="w-full h-8 px-3 rounded-lg border text-[12px] text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                    style={{ borderColor: participantName.trim() ? '#6EE7B7' : '#D1D5DB' }}
                  />
                </div>

                {/* Requester name (not myself) */}
                {assesseeType !== 'myself' && (
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1 block">
                      Your name <span className="text-gray-300 font-normal normal-case">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={requesterName}
                      onChange={e => setRequesterName(e.target.value)}
                      placeholder={assesseeType === 'my-child' ? 'e.g. Sunita (Parent)' : assesseeType === 'a-student' ? 'e.g. Mr. Sharma' : 'e.g. Your name'}
                      className="w-full h-8 px-3 rounded-lg border text-[12px] text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                      style={{ borderColor: '#D1D5DB' }}
                    />
                  </div>
                )}

                {/* Age */}
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1 flex items-center gap-1.5">
                    {ageLabelMap[assesseeType] || 'Age'} <span className="text-red-400">*</span>
                    <span className="text-gray-300 font-normal normal-case tracking-normal">{ageRange.min}–{ageRange.max} yrs</span>
                  </label>
                  <input
                    type="number"
                    min={ageRange.min}
                    max={ageRange.max}
                    placeholder={`e.g. ${Math.round((ageRange.min + ageRange.max) / 2)}`}
                    value={userAge}
                    onChange={e => setUserAge(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && canBegin && handleBeginAssessment()}
                    className="w-full h-8 px-3 rounded-lg border text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                    style={{ borderColor: ageInvalid ? '#EF4444' : ageOk ? '#6EE7B7' : '#D1D5DB' }}
                  />
                  {ageInvalid && (
                    <p className="text-[10px] text-red-500 mt-0.5">⚠ {ageRange.label}</p>
                  )}
                </div>

                {/* Email — optional, used to detect returning users early */}
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1 flex items-center gap-1.5">
                    <Mail size={9} /> Email <span className="text-gray-300 font-normal normal-case tracking-normal">(returning user?)</span>
                  </label>
                  <input
                    type="email"
                    value={capadexRegEmail}
                    onChange={e => setCapadexRegEmail(e.target.value)}
                    onBlur={() => {
                      const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                      if (capadexRegEmail.trim() && emailRx.test(capadexRegEmail.trim())) {
                        handleStageCheck(capadexRegEmail.trim());
                      }
                    }}
                    placeholder="you@email.com"
                    className="w-full h-8 px-3 rounded-lg border text-[12px] text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                    style={{ borderColor: '#D1D5DB' }}
                  />
                  <p className="text-[10px] text-gray-300 mt-0.5">Skip Curiosity if you've done it before</p>
                </div>

                {/* Begin button — hidden if returning user detected */}
                {!capadexStageCheck?.has_prior_completion && (
                  <button
                    onClick={handleBeginAssessment}
                    disabled={capadexLoading || !canBegin}
                    className="w-full h-10 rounded-xl text-[13px] font-bold text-white transition-all disabled:opacity-40 mt-1"
                    style={{ backgroundColor: METRYX_NAVY }}>
                    {capadexLoading ? 'Starting…'
                      : !participantName.trim() ? 'Enter a name to continue'
                      : !userAge ? 'Enter age to continue'
                      : ageInvalid ? 'Fix age to continue'
                      : 'Begin Assessment →'}
                  </button>
                )}

                {capadexError && (
                  <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-100">
                    <AlertCircle size={12} className="text-red-400 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-red-600">{capadexError}</p>
                  </div>
                )}
              </>
            )}

            {!assesseeType && (
              <p className="text-[11px] text-gray-400 text-center py-1">Select who this is for to continue</p>
            )}

            {/* Returning-user banner */}
            {capadexStageCheck?.has_prior_completion && (() => {
              const sc = capadexStageCheck!;
              const isAllDone = sc.completed.length === 4;
              const stageLabel = (c: string) => canonicalStageLabel(c);
              return (
                <div className="rounded-xl p-3" style={{ backgroundColor: '#EEF2FA', border: '1.5px solid #344E8630' }}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <CheckCircle size={11} style={{ color: '#344E86' }} />
                    <p className="text-[11px] font-bold" style={{ color: '#344E86' }}>
                      {isAllDone ? 'Journey complete' : `${sc.completed.map(stageLabel).join(' + ')} done`}
                    </p>
                  </div>
                  <button
                    onClick={() => { setCapadexSkipIntent(true); setPhase('capadex_register'); }}
                    className="w-full h-8 rounded-lg text-[11px] font-bold text-white"
                    style={{ backgroundColor: isAllDone ? '#344E86' : (sc.next_stage_color || '#344E86') }}>
                    {isAllDone ? 'View report →' : `Continue: ${sc.next_stage_label} →`}
                  </button>
                </div>
              );
            })()}

            <button onClick={() => setPhase('intro')}
              className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors text-center mt-auto pt-2">
              ← Edit concern
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
