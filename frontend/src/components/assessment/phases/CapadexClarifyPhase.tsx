import React, { useEffect, useState } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import { BRAND, METRYX_NAVY } from '@/lib/behavioural-insights';
import { PhaseProps } from '../types';

const TEAL = BRAND.accent;

const RANK_LABELS = ['Most relevant', 'Quite relevant', 'Somewhat relevant', 'Least relevant'];
const RANK_COLORS = [
  { bg: `${TEAL}18`, border: TEAL,          text: TEAL,        badge: TEAL          },
  { bg: `${METRYX_NAVY}0D`, border: METRYX_NAVY, text: METRYX_NAVY, badge: METRYX_NAVY  },
  { bg: '#F3F4F6', border: '#9CA3AF',        text: '#6B7280',   badge: '#9CA3AF'     },
  { bg: '#FAFAFA', border: '#E5E7EB',        text: '#9CA3AF',   badge: '#D1D5DB'     },
];

// Likert intensity / frequency / agreement vocabularies. Options drawn from
// these scales describe a SINGLE position on an ordinal continuum — ranking
// them by "importance" is semantically broken (the user cannot say "Very High"
// is MORE important than "Low" — those are mutually exclusive readings of one
// dimension, not competing priorities).
const LIKERT_TOKENS = new Set([
  // 5-point intensity
  'very low', 'low', 'moderate', 'high', 'very high',
  // frequency
  'never', 'rarely', 'sometimes', 'often', 'always',
  'not at all', 'occasionally', 'frequently',
  // agreement
  'strongly disagree', 'disagree', 'neutral', 'agree', 'strongly agree',
  // confidence / readiness
  'not at all ready', 'slightly ready', 'somewhat ready', 'mostly ready', 'fully ready',
  'not confident', 'slightly confident', 'somewhat confident', 'confident', 'very confident',
  // impact intensity ('not at all' already listed above)
  'no impact', 'mild impact', 'moderate impact', 'major impact', 'severe impact',
  // emotional intensity
  'a little bit', 'somewhat', 'quite a bit', 'very much',
]);

function looksLikeLikertScale(options: string[]): boolean {
  if (!options || options.length < 3) return false;
  const norm = options.map(o => o.trim().toLowerCase());
  // Treat as Likert when ≥60% of options sit on a known ordinal vocabulary —
  // catches "Very Low / Low / Moderate / High / Very High" cleanly while
  // tolerating one custom rung (e.g. "Moderate · transition phase").
  const hits = norm.filter(o => LIKERT_TOKENS.has(o)).length;
  return hits / norm.length >= 0.6;
}

// Questions about time/duration should never be ranked — they have a correct
// chronological order and "most relevant first" makes no sense for them.
// Likert intensity scales (Very Low → Very High, Never → Always, etc.) also
// resolve to a single selection, never an ordering.
function isSingleChoiceQuestion(
  q: { id?: string; question: string; options?: string[]; evaluation_type?: string; isSingle?: boolean; response_type?: string }
): boolean {
  // Explicit schema hints — honoured when present on a question variant,
  // ignored otherwise. Lets the backend force single-select authoritatively.
  if (q.evaluation_type === 'LIKERT') return true;
  if (q.isSingle === true) return true;
  // Authoritative backend signal (2026-05-29): every row in
  // `capadex_clarity_questions` is a scored one-dimensional ordinal/categorical
  // scale (23 distinct `response_type` vocabularies — intensity
  // "Slightly…Extremely", coping_effectiveness "Very Ineffective…Very
  // Effective", coping_style categorical picks, etc.). Token/regex heuristics
  // below cannot cover every vocabulary, so when the picker forwards a
  // `response_type` we trust it and route to single-select — none of these
  // scales are ever rank-by-importance. (Static fallback questions carry no
  // `response_type` and continue to use the heuristics below.)
  if (typeof q.response_type === 'string' && q.response_type.trim().length > 0) return true;

  if (q.id && q.id.endsWith('_duration')) return true;
  const stem = q.question.trim();
  if (/^how long\b/i.test(stem)) return true;
  if (/\bhow (often|frequently|many (times|days|weeks))\b/i.test(q.question)) return true;
  // Readiness / intensity / confidence stems are always single-select even
  // when the option vocabulary is custom-worded.
  if (/\bhow (ready|prepared|confident|comfortable|likely|emotionally|stressful|impactful|difficult|severe)\b/i.test(q.question)) return true;
  if (/\b(rate|rank your|on a scale|rate your level)\b/i.test(q.question)) return true;
  // Emotional-intensity stems that probe felt experience are pick-one, not rankable.
  if (/\bfeel to you\b/i.test(q.question)) return true;
  // Categorical "what have you (already) tried" history questions present
  // MUTUALLY EXCLUSIVE states (e.g. "Nothing yet …" vs "Almost everything …")
  // — you cannot rank contradictory states, so this must be pick-one.
  if (/^what have you (already )?tried\b/i.test(stem)) return true;
  if (q.options && looksLikeLikertScale(q.options)) return true;
  // Option-content fallback: a leading "Nothing yet …" option signals a
  // pick-one state question (you've tried nothing OR something), not a
  // prioritisation vector — route to single-select even if the stem varies.
  if (q.options && /^nothing yet\b/i.test((q.options[0] || '').trim())) return true;
  return false;
}

export function CapadexClarifyPhase(props: PhaseProps) {
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
    handleClarifyBack, handleBeginAssessment, handleCapadexAnswer, handleCompleteStage,
    handleContinueToNextStage, handleClose, handleAnswer, handleRegisterSubmit,
    handleOtpVerify, handleResendOtp, handleStageCheck, handleSkipToNextStage,
    handleCapadexRegister, handleCapadexLoginOtpSend, handleCapadexOtpVerify,
    handleCapadexOtpResend, handlePaymentProceed, persona, computeResults,
  } = props;

  if (!concernIntelligence) return null;
  const questions = concernIntelligence.clarification_questions || [];
  const prefilled  = concernIntelligence.prefilled_answers   || {};
  const visibleIndices  = questions.map((_, i) => i).filter(i => !(i in prefilled));
  const currentQuestion = questions[clarifyCurrentQ];
  if (!currentQuestion) return null;
  const visiblePosition = visibleIndices.indexOf(clarifyCurrentQ) + 1;
  const visibleTotal    = visibleIndices.length;

  const concernLabel = ((selectedConcern || '').length > 38)
    ? (selectedConcern || '').slice(0, 36) + '…'
    : (selectedConcern || '');

  // Provenance pill — surfaces backend `clarity_source` so users can see when a
  // question is curated to their specific master concern vs drawn from the
  // broader adaptive bank. Honesty > false specificity: master coverage is
  // ~17% of buckets today, so "General behavioural cluster" is the truthful
  // label when no curated rows exist for the routed concern_id.
  const claritySource = (concernIntelligence as { clarity_source?: string }).clarity_source;
  // `static_fallback` and `adaptive_bank` are both honestly "general" — only
  // `master_curated` deserves the specificity claim. Showing no pill at all
  // for `static_fallback` would let users assume tailored content.
  const provenance = claritySource === 'master_curated'
    ? { label: 'Tailored to your concern', tone: TEAL }
    : claritySource === 'adaptive_bank' || claritySource === 'static_fallback'
      ? { label: 'General behavioural cluster', tone: '#94A3B8' }
      : null;

  const isSingle = isSingleChoiceQuestion(currentQuestion);

  /* ── Local state for both modes ── */
  const [ranked,    setRanked]    = useState<string[]>([]);
  const [selected,  setSelected]  = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset state whenever the question changes — keyed on the real question id
  // so old selections never pollute the next item (falls back to the index if a
  // question ever ships without an id).
  useEffect(() => {
    setRanked([]);
    setSelected(null);
    setSubmitting(false);
  }, [currentQuestion.id ?? clarifyCurrentQ]);

  const options = currentQuestion.options;

  /* ── Ranking handler (multi-tap to toggle into / out of the order) ── */
  const handleRankTap = (option: string) => {
    if (submitting) return;
    setRanked(prev =>
      prev.includes(option)
        ? prev.filter(o => o !== option)
        : [...prev, option]
    );
  };

  /* ── Ranking confirm (explicit submit of the full ordered selection) ── */
  const handleRankConfirm = () => {
    if (submitting || ranked.length === 0) return;
    setSubmitting(true);
    handleClarifyAnswer(ranked);
  };

  /* ── Single-choice handler (one tap → instant submit) ── */
  const handleSingleTap = (option: string) => {
    if (submitting || selected) return;
    setSelected(option);
    setSubmitting(true);
    setTimeout(() => handleClarifyAnswer([option]), 350);
  };

  return (
    <div className="flex flex-col select-none bg-white min-h-0" style={{ minHeight: 420, maxHeight: '90vh' }}>

      {/* ── Top nav ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b shrink-0"
        style={{ borderColor: '#F3F4F6' }}>
        <button
          onClick={handleClarifyBack}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors active:scale-95"
        >
          <ChevronLeft size={17} style={{ color: '#6B7280' }} />
        </button>

        {/* Pill step indicator */}
        <div className="flex items-center gap-1.5">
          {visibleIndices.map((_, pos) => {
            const done   = pos < visiblePosition - 1;
            const active = pos === visiblePosition - 1;
            return (
              <div key={pos} className="rounded-full transition-all duration-300"
                style={{ height: 6, width: active ? 20 : 6,
                  backgroundColor: done ? TEAL : active ? METRYX_NAVY : '#E5E7EB' }} />
            );
          })}
        </div>

        <button
          onClick={handleClose}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors active:scale-95"
        >
          <X size={14} style={{ color: '#9CA3AF' }} />
        </button>
      </div>

      {/* ── Question header ── */}
      <div className="px-5 pt-5 pb-4 shrink-0">
        <div className="flex items-center gap-2 mb-3">
          {concernLabel && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
              style={{ backgroundColor: `${TEAL}18`, color: TEAL, border: `1px solid ${TEAL}35` }}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: TEAL }} />
              {concernLabel}
            </span>
          )}
          {provenance && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
              style={{ color: provenance.tone, backgroundColor: `${provenance.tone}10`, border: `1px solid ${provenance.tone}30` }}
              title={claritySource === 'master_curated'
                ? 'These questions are mapped directly to the master concern you selected.'
                : 'No curated questions exist for this exact concern yet — using the closest behavioural cluster.'}>
              {provenance.label}
            </span>
          )}
          <span className="text-[11px] font-medium ml-auto" style={{ color: '#C4C9D4' }}>
            {visiblePosition} / {visibleTotal}
          </span>
        </div>

        <h2 className="text-[17px] font-bold leading-snug mb-1.5"
          style={{ color: '#0B1F3A', letterSpacing: '-0.25px',
            fontFamily: "'Plus Jakarta Sans','DM Sans',sans-serif" }}>
          {currentQuestion.question}
        </h2>
        {isSingle && (
          <p className="text-[12.5px]" style={{ color: '#94A3B8' }}>
            Select the option that best describes your situation.
          </p>
        )}
      </div>

      {/* ── Options ── (scrollable region so the action footer stays pinned and
           never clips out of frame on shorter viewports) */}
      <div className="px-4 space-y-2.5 flex-1 overflow-y-auto min-h-0 pb-2">
        {options.map((option, idx) => {

          /* ── Single-choice rendering ── */
          if (isSingle) {
            const isSelected = selected === option;
            return (
              <button
                key={option}
                onClick={() => handleSingleTap(option)}
                disabled={submitting}
                className="w-full text-left rounded-xl transition-all duration-200 active:scale-[0.985] disabled:opacity-70"
                style={{
                  border: `1.5px solid ${isSelected ? TEAL : '#E9EAED'}`,
                  backgroundColor: isSelected ? `${TEAL}12` : '#FAFAFA',
                  boxShadow: isSelected ? `0 0 0 3px ${TEAL}1A` : 'none',
                  padding: '11px 14px',
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-200"
                    style={{
                      backgroundColor: isSelected ? TEAL : '#ECEEF1',
                      color: isSelected ? '#fff' : '#9CA3AF',
                      fontWeight: 700,
                      fontSize: isSelected ? 13 : 11,
                      minWidth: 28,
                    }}>
                    {isSelected
                      ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      : String.fromCharCode(65 + idx)
                    }
                  </div>
                  <span className="text-[13.5px] leading-snug block flex-1 min-w-0"
                    style={{
                      color: isSelected ? '#0B1F3A' : '#374151',
                      fontWeight: isSelected ? 600 : 400,
                    }}>
                    {option}
                  </span>
                </div>
              </button>
            );
          }

          /* ── Ranking rendering ── */
          const rankPos  = ranked.indexOf(option);
          const isRanked = rankPos >= 0;
          const colors   = isRanked ? RANK_COLORS[rankPos] : null;

          return (
            <button
              key={option}
              onClick={() => handleRankTap(option)}
              disabled={submitting}
              className="w-full text-left rounded-xl transition-all duration-200 active:scale-[0.985] disabled:opacity-70"
              style={{
                border: `1.5px solid ${isRanked ? colors!.border : '#E9EAED'}`,
                backgroundColor: isRanked ? colors!.bg : '#FAFAFA',
                boxShadow: isRanked && rankPos === 0 ? `0 0 0 3px ${TEAL}1A` : 'none',
                padding: '11px 14px',
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-200"
                  style={{
                    backgroundColor: isRanked ? colors!.badge : '#ECEEF1',
                    color: isRanked ? '#fff' : '#9CA3AF',
                    fontWeight: 700,
                    fontSize: isRanked ? 13 : 11,
                    minWidth: 28,
                  }}>
                  {isRanked ? rankPos + 1 : String.fromCharCode(65 + idx)}
                </div>

                <div className="flex-1 min-w-0">
                  <span className="text-[13.5px] leading-snug block"
                    style={{
                      color: isRanked ? '#0B1F3A' : '#374151',
                      fontWeight: isRanked ? 600 : 400,
                    }}>
                    {option}
                  </span>
                  {isRanked && (
                    <span className="text-[10.5px] mt-0.5 block" style={{ color: colors!.text, opacity: 0.8 }}>
                      {RANK_LABELS[rankPos]}
                    </span>
                  )}
                </div>

                {isRanked && !submitting && (
                  <span className="text-[10px] shrink-0" style={{ color: colors!.text, opacity: 0.5 }}>
                    tap to undo
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Pinned action area ── stays anchored to the bottom of the frame so
           the confirm button + status hint are always visible regardless of
           how many options scroll above. */}
      <div className="shrink-0 px-4 pt-3 pb-4 border-t bg-white" style={{ borderColor: '#F3F4F6' }}>
        {/* Ranking confirm — explicit submit of the ordered selection so a
            partial ranking can still be confirmed. Disabled until ≥1 ranked. */}
        {!isSingle && (
          <button
            onClick={handleRankConfirm}
            disabled={submitting || ranked.length === 0}
            className="w-full py-3 rounded-xl text-[13.5px] font-semibold text-white transition-all duration-200 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: METRYX_NAVY }}
          >
            {submitting ? 'Saving your priorities…' : 'Confirm selections'}
          </button>
        )}

        {/* Status hint — ranking-only progress text + saving feedback. In
            single-select mode the footer is fully hidden (tap auto-advances);
            it surfaces ONLY the saving spinner while a tap is in flight. The
            "N of M ranked" tracker never appears for single-select questions. */}
        {(submitting || (!isSingle && ranked.length > 0)) && (
          <div className={`${!isSingle ? 'mt-3 ' : ''}px-4 py-2.5 rounded-xl flex items-center justify-center gap-2`}
            style={{ backgroundColor: '#F8F9FB', border: '1px solid #ECEEF1' }}>
            {submitting ? (
              <>
                <div className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: `${TEAL}60`, borderTopColor: TEAL }} />
                <p className="text-[11.5px] font-medium" style={{ color: TEAL }}>
                  {isSingle ? 'Saving your answer…' : 'Saving your priorities…'}
                </p>
              </>
            ) : (
              <>
                <div className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: ranked.length === options.length ? TEAL : '#D1D5DB' }} />
                <p className="text-[11.5px]" style={{ color: '#94A3B8' }}>
                  {ranked.length < options.length
                    ? `${ranked.length} of ${options.length} ranked — confirm when ready`
                    : 'All ranked — confirm below'}
                </p>
              </>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
