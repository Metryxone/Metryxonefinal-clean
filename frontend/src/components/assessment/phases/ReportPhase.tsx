import React from 'react';
import metryxLogo from '@/assets/metryx-logo-transparent.png';
import { ArrowRight, CheckCircle, Eye, Sparkles, TrendingUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BRAND, UPGRADE_TIERS, buildInsightNarrative } from '@/lib/behavioural-insights';

import { PhaseProps } from '../types';
export function ReportPhase(props: PhaseProps) {
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
    deepLinkError, onNavigate,
  } = props;

  const { domains, overallLevel } = computeResults();
  const displayName = regName || participantName || '';
  const narrative = buildInsightNarrative(selectedPersona, domains, overallLevel, displayName);
  const insightSections = [
  {
  id: 'snapshot',
  label: 'Behavioral Snapshot',
  text: narrative.snapshot,
  icon: Eye,
  },
  {
  id: 'edge',
  label: 'Natural Edge',
  text: narrative.naturalEdge,
  icon: Sparkles,
  },
  {
  id: 'growth',
  label: 'Growth Space',
  text: narrative.growthSpace,
  icon: TrendingUp,
  },
  {
  id: 'next',
  label: 'Your Next Step',
  text: narrative.whatsNext,
  icon: ArrowRight,
  },
  ];
  const activeTierData = UPGRADE_TIERS.find(t => t.key === selectedTier) ?? null;
  const handleUpgradeSubmit = () => {
  if (!activeTierData) return;
  handleClose();
  if (onNavigate) onNavigate('pricing');
  };

  return (

            <div className="max-h-[85vh] overflow-y-auto">
              {/* ── Header ── */}
              <div className="px-5 pt-5 pb-4 relative" style={{ backgroundColor: persona.color }}>
                <button onClick={handleClose}
                  className="absolute top-4 right-4 text-white/40 hover:text-white/70 transition-colors"
                  data-testid="btn-close-report">
                  <X size={16} />
                </button>

                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full mb-3 bg-white/15">
                  <span className="text-[13px] font-bold text-white uppercase tracking-widest">Insight Report</span>
                  <span className="text-white/40 text-[12px]">·</span>
                  <span className="text-[13px] text-white/60">Discovery</span>
                </div>

                <h3 className="text-[21px] font-bold text-white leading-tight mb-0.5">
                  {displayName ? `${displayName}'s` : 'Your'} {persona.reportLabel}
                </h3>
                <p className="text-[15px] text-white/50">
                  Behavioural snapshot · {questions.length} dimensions assessed
                </p>
              </div>

              {/* ── Tab bar ── */}
              <div className="flex border-b border-gray-100 bg-white sticky top-0 z-10">
                {([
                  { key: "results" as const, label: "Your Insight", icon: Eye },
                  { key: "unlock" as const, label: "Go Deeper", icon: Sparkles },
                ]).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => { setReportTab(tab.key); setSelectedTier(null); }}
                    className="flex-1 py-3 text-[15px] font-semibold flex items-center justify-center gap-1.5 transition-colors relative"
                    style={{ color: reportTab === tab.key ? BRAND.primary : '#9ca3af' }}
                    data-testid={`tab-${tab.key}`}
                  >
                    <tab.icon size={12} />
                    {tab.label}
                    {tab.key === 'unlock' && <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-red-400 ml-0.5" />}
                    {reportTab === tab.key && (
                      <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full" style={{ backgroundColor: BRAND.primary }} />
                    )}
                  </button>
                ))}
              </div>

              {/* ── Your Insight tab ── */}
              {reportTab === "results" && (
                <div className="p-5 space-y-4">
                  {insightSections.map((sec, idx) => {
                    const Icon = sec.icon;
                    return (
                      <div key={sec.id} className="rounded-2xl border border-gray-100 p-4 bg-white">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${persona.color}18` }}>
                            <Icon size={12} style={{ color: persona.color }} />
                          </div>
                          <span className="text-[14px] font-bold uppercase tracking-widest text-gray-400">
                            {String(idx + 1).padStart(2, '0')} {sec.label}
                          </span>
                        </div>
                        <p className="text-[17px] leading-relaxed text-gray-700 font-normal">
                          {sec.text}
                        </p>
                      </div>
                    );
                  })}

                  <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: `${persona.color}08`, border: `1.5px solid ${persona.color}30` }}>
                    <p className="text-[15px] font-semibold mb-1" style={{ color: persona.color }}>
                      Ready to go beyond the snapshot?
                    </p>
                    <p className="text-[14px] text-gray-500 mb-3">
                      Choose a deeper assessment to unlock your full behavioral map and a personalised action plan.
                    </p>
                    <button
                      onClick={() => setReportTab("unlock")}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-white text-[15px] font-bold transition-all hover:opacity-90"
                      style={{ backgroundColor: persona.color }}
                    >
                      Explore deeper reports <ArrowRight size={11} />
                    </button>
                  </div>

                  <p className="text-center text-[12px] text-gray-400 pb-1">
                    Insight snapshot only · Not a clinical diagnosis or professional assessment
                  </p>
                </div>
              )}

              {/* ── Go Deeper tab ── */}
              {reportTab === "unlock" && (
                <div className="p-5">
                  <div className="mb-4">
                    <p className="text-[15px] font-semibold text-gray-500 mb-0.5">
                      Your Insight report is a starting point.
                    </p>
                    <p className="text-[16px] font-bold text-gray-900">
                      Choose how far you want to go.
                    </p>
                  </div>

                  <div className="space-y-3 mb-4">
                    {UPGRADE_TIERS.map(tier => {
                      const TierIcon = tier.icon;
                      const isSelected = selectedTier === tier.key;
                      return (
                        <div
                          key={tier.key}
                          data-testid={`tier-card-${tier.key}`}
                          className="rounded-2xl border-2 p-4 cursor-pointer transition-all relative"
                          style={{
                            borderColor: isSelected ? tier.color : '#e5e7eb',
                            backgroundColor: isSelected ? `${tier.color}06` : '#fff',
                          }}
                          onClick={() => setSelectedTier(isSelected ? null : tier.key)}
                        >
                          {tier.popular && (
                            <div className="absolute -top-2.5 left-4">
                              <span className="px-2 py-0.5 rounded-full text-[13px] font-bold text-white uppercase tracking-widest"
                                style={{ backgroundColor: tier.color }}>
                                Most chosen
                              </span>
                            </div>
                          )}

                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                                style={{ backgroundColor: `${tier.color}15` }}>
                                <TierIcon size={14} style={{ color: tier.color }} />
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[18px] font-bold text-gray-900">{tier.name}</span>
                                  <span className="text-[13px] font-medium px-1.5 py-0.5 rounded-full"
                                    style={{ backgroundColor: `${tier.color}15`, color: tier.color }}>
                                    {tier.feel}
                                  </span>
                                </div>
                                <p className="text-[14px] text-gray-500 mt-0.5">{tier.tagline}</p>
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              <span className="text-[21px] font-extrabold text-gray-900">{tier.price}</span>
                              <p className="text-[12px] text-gray-400">{tier.priceNote}</p>
                            </div>
                          </div>

                          <div className="space-y-1.5 mt-3">
                            {tier.benefits.map((b, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                                  style={{ backgroundColor: `${tier.color}18` }}>
                                  <CheckCircle size={8} style={{ color: tier.color }} />
                                </div>
                                <span className="text-[15px] text-gray-600">{b}</span>
                              </div>
                            ))}
                          </div>

                          <div className="mt-3 flex items-center justify-between">
                            <div className="flex-1" />
                            <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                              style={{
                                borderColor: isSelected ? tier.color : '#d1d5db',
                                backgroundColor: isSelected ? tier.color : 'transparent',
                              }}>
                              {isSelected && <CheckCircle size={11} className="text-white" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* ── Inline profiling form when a tier is selected ── */}
                  {selectedTier && activeTierData && (
                    <div className="rounded-2xl border border-gray-100 p-4 mb-4 bg-gray-50/60 animate-in fade-in slide-in-bg-bottom-2 duration-200">
                      <p className="text-[15px] font-bold text-gray-800 mb-3">
                        Tell us a bit more to personalise your {activeTierData.name} report
                      </p>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-[14px] font-semibold text-gray-500 mb-1 uppercase tracking-wide">
                            Primary goal
                          </label>
                          <select
                            value={upgradeGoal}
                            onChange={e => setUpgradeGoal(e.target.value)}
                            className="w-full h-9 px-3 text-[16px] rounded-xl border border-gray-200 bg-white text-gray-700 outline-none focus:ring-2 transition-all"
                            style={{ '--tw-ring-color': activeTierData.color } as React.CSSProperties}
                          >
                            <option value="">Select your goal…</option>
                            <option value="academic">Improve academic performance</option>
                            <option value="career">Advance in my career</option>
                            <option value="self">Personal growth & self-awareness</option>
                            <option value="stress">Manage stress & pressure better</option>
                            <option value="other">Something else</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[14px] font-semibold text-gray-500 mb-1 uppercase tracking-wide">
                            When do you want your report?
                          </label>
                          <div className="flex gap-2">
                            {['This week', 'This month', 'Flexible'].map(u => (
                              <button
                                key={u}
                                onClick={() => setUpgradeUrgency(u)}
                                className="flex-1 py-1.5 rounded-lg text-[15px] font-medium border transition-all"
                                style={{
                                  borderColor: upgradeUrgency === u ? activeTierData.color : '#e5e7eb',
                                  backgroundColor: upgradeUrgency === u ? `${activeTierData.color}12` : '#fff',
                                  color: upgradeUrgency === u ? activeTierData.color : '#6b7280',
                                }}
                              >
                                {u}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <Button
                        className="w-full h-10 text-[16px] font-bold rounded-xl text-white mt-4 disabled:opacity-40"
                        style={{ backgroundColor: activeTierData.color }}
                        disabled={!upgradeGoal || !upgradeUrgency}
                        onClick={handleUpgradeSubmit}
                        data-testid="btn-upgrade-submit"
                      >
                        Get my {activeTierData.name} report — {activeTierData.price}
                        <ArrowRight size={13} className="ml-1.5" />
                      </Button>

                      <p className="text-center text-[13px] text-gray-400 mt-2">
                        We will reach out to complete your registration and payment
                      </p>
                    </div>
                  )}

                  <p className="text-center text-[12px] text-gray-400 pb-1">
                    All assessments include a confidential report · DPDP compliant
                  </p>
                </div>
              )}
            </div>

  );
}
