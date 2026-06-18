import React, { useState } from 'react';
import { ArrowRight, Check, ChevronLeft, X, Crown } from 'lucide-react';
import { PhaseProps } from '../types';

const NAVY = '#1E3A8A';

// ── Context derivation ────────────────────────────────────────────────────────
type AssessContext = 'academic' | 'career' | 'general';

function deriveContext(
  persona: string | null,
  assesseeType: string,
  userAge: string,
): AssessContext {
  // Explicit student/child assesseeType always → academic
  if (assesseeType === 'a-student' || assesseeType === 'my-child') return 'academic';
  // Academic personas
  if (persona === 'student' || persona === 'teacher' || persona === 'campus') return 'academic';
  // Career personas
  if (persona === 'jobseeker' || persona === 'professional') return 'career';
  // Age heuristic: under 22 with no overriding persona → academic
  const age = parseInt(userAge, 10);
  if (!isNaN(age) && age < 22) return 'academic';
  return 'general';
}

// ── Per-context tier content ──────────────────────────────────────────────────

interface TierContent {
  tagline:  string;
  subtitle: string;
  ownPerks: string[];
}

type ContextContent = Record<AssessContext, TierContent>;

const TIER_CONTENT: Record<string, ContextContent> = {
  CAP_CUR: {
    academic: {
      tagline:  'Understand what\'s actually happening',
      subtitle: 'Surface Awareness · 10 questions',
      ownPerks: [
        'Personalised Behavioural Intelligence Report',
        'Pattern identification across learning and study domains',
        'Dimensional score breakdown with development indicators',
        'Benchmark comparison against 10,000+ student profiles',
      ],
    },
    career: {
      tagline:  'Understand what\'s actually happening',
      subtitle: 'Surface Awareness · 10 questions',
      ownPerks: [
        'Personalised Behavioural Intelligence Report',
        'Pattern identification across key professional dimensions',
        'Dimensional score breakdown with severity indicators',
        'Benchmark comparison against 10,000+ professional profiles',
      ],
    },
    general: {
      tagline:  'Understand what\'s actually happening',
      subtitle: 'Surface Awareness · 10 questions',
      ownPerks: [
        'Personalised Behavioural Intelligence Report',
        'Pattern identification across key dimensions',
        'Dimensional score breakdown with severity indicators',
        'Benchmark comparison against 10,000+ real profiles',
      ],
    },
  },

  CAP_INS: {
    academic: {
      tagline:  'Decode what\'s blocking your performance',
      subtitle: 'Pattern Analysis · 10 questions',
      ownPerks: [
        'Root-cause pattern behind academic and study performance',
        'Subject-specific cognitive gap analysis',
        'Trigger identification — what drives avoidance and procrastination',
        'Longitudinal memory linking to Curiosity patterns',
      ],
    },
    career: {
      tagline:  'Decode the root cause',
      subtitle: 'Pattern Analysis · 10 questions',
      ownPerks: [
        'Competency gap vector against your role benchmark',
        'Root-cause mechanism decoded from your profile',
        'Personalised ranked action plan',
        'Longitudinal memory linking to Curiosity patterns',
      ],
    },
    general: {
      tagline:  'Decode the root cause',
      subtitle: 'Pattern Analysis · 10 questions',
      ownPerks: [
        'Root-cause pattern decoded from your Curiosity profile',
        'Specific trigger identification for your concern',
        'Personalised ranked action plan',
        'Longitudinal memory linking to Curiosity patterns',
      ],
    },
  },

  CAP_GRW: {
    academic: {
      tagline:  'Build your academic development path',
      subtitle: 'Development Intelligence · 10 questions',
      ownPerks: [
        'Personalised 30-day academic improvement strategy',
        'Learning-style adapted study plan',
        'Exam performance and stress management roadmap',
        'Progress milestone framework for the academic year',
      ],
    },
    career: {
      tagline:  'Build your development path',
      subtitle: 'Development Intelligence · 10 questions',
      ownPerks: [
        'Personalised growth trajectory map',
        'Competency-aligned 30-day development plan',
        'Strength-leverage & blind-spot strategy',
        'Progress milestone framework',
      ],
    },
    general: {
      tagline:  'Build your development path',
      subtitle: 'Development Intelligence · 10 questions',
      ownPerks: [
        'Personalised growth trajectory map',
        'Learning-style adapted development plan',
        'Strength-leverage & blind-spot strategy',
        'Progress milestone framework',
      ],
    },
  },

  CAP_MAS: {
    academic: {
      tagline:  'Unlock your full academic potential',
      subtitle: 'Peak Performance · 10 questions',
      ownPerks: [
        'Full 19-domain academic and behavioural readiness profile',
        '1-on-1 counsellor debrief session included',
        'Parent and teacher action guide',
        'Long-term career readiness foundation map',
      ],
    },
    career: {
      tagline:  'Reach your peak performance',
      subtitle: 'Peak Performance · 10 questions',
      ownPerks: [
        'Peak performance readiness score',
        'Leadership capability profiling',
        'Cross-stage longitudinal intelligence',
        'Complete 4-stage behavioural blueprint',
      ],
    },
    general: {
      tagline:  'Reach your highest potential',
      subtitle: 'Peak Performance · 10 questions',
      ownPerks: [
        'Peak performance readiness score',
        'Cross-stage longitudinal intelligence',
        '1-on-1 analyst debrief session included',
        'Complete 4-stage behavioural blueprint',
      ],
    },
  },
};

// ── Static tier config (visual / pricing only) ────────────────────────────────

const TIER_META = [
  {
    code:      'CAP_CUR',
    name:      'Curiosity',
    label:     'CURIOSITY',
    color:     '#2563EB',
    bg:        '#EFF6FF',
    bdr:       '#BFDBFE',
    lightText: '#93C5FD',
    tag:       'Entry Stage',
    includes:  [] as string[],
  },
  {
    code:      'CAP_INS',
    name:      'Insight',
    label:     'INSIGHT',
    color:     '#059669',
    bg:        '#ECFDF5',
    bdr:       '#A7F3D0',
    lightText: '#6EE7B7',
    tag:       'Most Popular',
    includes:  ['Curiosity'],
  },
  {
    code:      'CAP_GRW',
    name:      'Growth',
    label:     'GROWTH',
    color:     '#D97706',
    bg:        '#FFFBEB',
    bdr:       '#FDE68A',
    lightText: '#FCD34D',
    tag:       'High Impact',
    includes:  ['Curiosity', 'Insight'],
  },
  {
    code:      'CAP_MAS',
    name:      'Mastery',
    label:     'MASTERY',
    color:     '#7C3AED',
    bg:        '#F5F3FF',
    bdr:       '#DDD6FE',
    lightText: '#C4B5FD',
    tag:       'Complete Journey',
    includes:  ['Curiosity', 'Insight', 'Growth'],
  },
] as const;

type TierCode = typeof TIER_META[number]['code'];

const INCLUDE_COLORS: Record<string, string> = {
  Curiosity: '#2563EB',
  Insight:   '#059669',
  Growth:    '#D97706',
};

const STAGE_TRACKER_LABELS = ['CURIOSITY', 'INSIGHT', 'GROWTH', 'MASTERY'];

// ── Pricing helpers ───────────────────────────────────────────────────────────

function parseRupees(s: string): number {
  return parseInt((s || '0').replace(/[^\d]/g, ''), 10) || 0;
}

function bundlePrice(
  tierCode: TierCode,
  pricing: Record<string, { price: string }>,
): { display: string; full: string | null; saving: string | null } {
  const tier   = TIER_META.find(t => t.code === tierCode)!;
  const codes  = [...tier.includes.map(n => TIER_META.find(t => t.name === n)!.code), tierCode] as string[];
  const prices = codes.map(c => parseRupees(pricing[c]?.price ?? '0'));
  const sum    = prices.reduce((a, b) => a + b, 0);

  if (codes.length === 1) {
    return { display: pricing[tierCode]?.price || '₹99', full: null, saving: null };
  }

  const discount   = Math.round(sum * 0.15);
  const discounted = sum - discount;
  return {
    display: `₹${discounted}`,
    full:    `₹${sum}`,
    saving:  `Save ₹${discount}`,
  };
}

// ── Context label for display ─────────────────────────────────────────────────

function contextLabel(ctx: AssessContext): string {
  switch (ctx) {
    case 'academic': return 'Student Journey';
    case 'career':   return 'Professional Journey';
    default:         return 'Your Journey';
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CapadexPackageSelectionPhase(props: PhaseProps) {
  const {
    setPhase, handleBeginAssessment, handleClose,
    capadexLoading, capadexPricing,
    setSelectedTier,
    participantName, introEmailName,
    selectedPersona, assesseeType, userAge,
  } = props;

  const [picked, setPicked] = useState<TierCode>('CAP_CUR');

  const ctx       = deriveContext(selectedPersona, assesseeType, userAge);
  const rawName   = (introEmailName || participantName || '').trim();
  const firstName = rawName.split(' ')[0] || '';

  const chosenMeta    = TIER_META.find(t => t.code === picked)!;
  const { display, full, saving } = bundlePrice(picked, capadexPricing);

  const handleSelect = () => {
    setSelectedTier(picked);
    handleBeginAssessment();
  };

  return (
    <div className="flex flex-col select-none bg-white" style={{ maxHeight: '88vh' }}>

      {/* ══ Dark gradient header ══════════════════════════════════════ */}
      <div className="sticky top-0 z-10 shrink-0"
        style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 60%, #1E40AF 100%)' }}>
        <div className="px-5 pt-3.5 pb-2.5">

          {/* Stage tracker */}
          <div className="flex items-center gap-1.5 mb-2.5">
            {STAGE_TRACKER_LABELS.map((label, i) => (
              <React.Fragment key={label}>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full"
                    style={{ background: '#94A3B8', opacity: 0.3 }} />
                  <span className="text-[9.5px] font-semibold tracking-wider"
                    style={{ color: '#94A3B8', opacity: 0.35 }}>
                    {label}
                  </span>
                </div>
                {i < 3 && (
                  <div className="flex-1 h-px mx-1"
                    style={{ background: '#94A3B8', opacity: 0.2 }} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Title row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setPhase('capadex_bridge')}
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'rgba(255,255,255,0.1)' }}>
                <ChevronLeft size={13} style={{ color: 'rgba(255,255,255,0.7)' }} />
              </button>
              <div>
                <p className="text-[10px] font-semibold tracking-widest" style={{ color: '#93C5FD' }}>
                  {contextLabel(ctx).toUpperCase()}
                </p>
                <h2 className="text-[16px] font-bold text-white leading-tight">
                  {firstName ? `${firstName}'s Assessment Package` : 'Select Your Package'}
                </h2>
              </div>
            </div>
            <button onClick={handleClose}
              className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
              style={{ background: 'rgba(255,255,255,0.1)' }}>
              <X size={13} style={{ color: 'rgba(255,255,255,0.6)' }} />
            </button>
          </div>
        </div>
        <div className="h-px w-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
      </div>

      {/* ══ Scrollable body ═══════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto pb-2" style={{ scrollbarWidth: 'none', background: '#F8FAFF' }}>

        {/* Context-aware intro */}
        <div className="px-5 pt-4 pb-3">
          <p className="text-[12px] leading-relaxed" style={{ color: '#64748B' }}>
            {ctx === 'academic'
              ? 'Each package builds on the previous, adding deeper academic and behavioural intelligence. All packages start with the Curiosity stage.'
              : ctx === 'career'
              ? 'Each package builds on the previous, going deeper into your professional behavioural profile. All packages start with the Curiosity stage.'
              : 'Each package builds on the previous — the more stages you include, the deeper the intelligence. You always start with Curiosity regardless of which package you choose.'}
          </p>
        </div>

        {/* ── Tier cards ── */}
        <div className="px-4 space-y-2.5 pb-2">
          {TIER_META.map((tier) => {
            const isSelected = picked === tier.code;
            const bp         = bundlePrice(tier.code, capadexPricing);
            const content    = TIER_CONTENT[tier.code][ctx];

            return (
              <button
                key={tier.code}
                onClick={() => setPicked(tier.code)}
                className="w-full text-left rounded-2xl overflow-hidden transition-all duration-200 active:scale-[0.99]"
                style={{
                  border:     `2px solid ${isSelected ? tier.color : '#E2E8F0'}`,
                  boxShadow:  isSelected ? `0 0 0 3px ${tier.color}20, 0 4px 16px ${tier.color}18` : 'none',
                  background: isSelected ? tier.bg : '#fff',
                }}>

                {/* Card header */}
                <div className="px-4 pt-3.5 pb-2.5 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">

                    {/* Stage label + badge */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-black tracking-widest"
                        style={{ color: tier.color }}>
                        {tier.label}
                      </span>
                      {(tier.tag === 'Most Popular' || tier.tag === 'High Impact') && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: `${tier.color}18`, color: tier.color, border: `1px solid ${tier.color}35` }}>
                          {tier.tag}
                        </span>
                      )}
                      {tier.tag === 'Complete Journey' && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                          style={{ background: `${tier.color}18`, color: tier.color, border: `1px solid ${tier.color}35` }}>
                          <Crown size={8} />
                          {tier.tag}
                        </span>
                      )}
                    </div>

                    {/* Tagline + subtitle */}
                    <p className="text-[13.5px] font-bold leading-tight mb-0.5"
                      style={{ color: isSelected ? '#0B1F3A' : '#374151' }}>
                      {content.tagline}
                    </p>
                    <p className="text-[10.5px]" style={{ color: '#94A3B8' }}>{content.subtitle}</p>
                  </div>

                  {/* Price + radio */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div>
                      {bp.full && (
                        <p className="text-[10px] line-through text-right" style={{ color: '#CBD5E1' }}>{bp.full}</p>
                      )}
                      <p className="text-[17px] font-black leading-none text-right"
                        style={{ color: tier.color }}>
                        {bp.display}
                      </p>
                      {bp.saving && (
                        <p className="text-[9px] font-bold text-right" style={{ color: '#10b981' }}>{bp.saving}</p>
                      )}
                    </div>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        border:     `2px solid ${isSelected ? tier.color : '#D1D5DB'}`,
                        background: isSelected ? tier.color : '#fff',
                      }}>
                      {isSelected && <Check size={11} color="#fff" strokeWidth={3} />}
                    </div>
                  </div>
                </div>

                {/* Perks */}
                <div className="px-4 pb-3.5">

                  {/* "Includes" chips for bundle tiers */}
                  {tier.includes.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
                      <span className="text-[9.5px] font-semibold" style={{ color: '#94A3B8' }}>Includes:</span>
                      {tier.includes.map(name => (
                        <span key={name}
                          className="text-[9.5px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: `${INCLUDE_COLORS[name]}15`,
                            color:      INCLUDE_COLORS[name],
                            border:     `1px solid ${INCLUDE_COLORS[name]}30`,
                          }}>
                          {name}
                        </span>
                      ))}
                      <span className="text-[9.5px] font-semibold" style={{ color: '#94A3B8' }}>+</span>
                    </div>
                  )}

                  {/* Own perks — expanded when selected, else first 2 faded */}
                  <div className="space-y-1.5">
                    {content.ownPerks.slice(0, isSelected ? 4 : 2).map((perk, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                          style={{ background: isSelected ? `${tier.color}18` : '#F1F5F9' }}>
                          <Check size={9}
                            style={{ color: isSelected ? tier.color : '#CBD5E1' }}
                            strokeWidth={2.5} />
                        </div>
                        <p className="text-[11.5px] leading-snug"
                          style={{ color: isSelected ? '#374151' : '#94A3B8' }}>
                          {perk}
                        </p>
                      </div>
                    ))}
                    {!isSelected && content.ownPerks.length > 2 && (
                      <p className="text-[10.5px] pl-6" style={{ color: tier.color }}>
                        +{content.ownPerks.length - 2} more included…
                      </p>
                    )}
                  </div>
                </div>

              </button>
            );
          })}
        </div>

        {/* Nested subset diagram */}
        <div className="mx-4 mt-3 mb-3 rounded-2xl overflow-hidden border" style={{ borderColor: '#E8ECF4' }}>
          <div className="px-4 py-2.5" style={{ background: '#F8FAFE', borderBottom: '1px solid #EEF0F5' }}>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#94A3B8' }}>
              How the packages nest
            </p>
          </div>
          <div className="px-4 py-3">
            <div className="rounded-xl border-2 p-3 relative" style={{ borderColor: '#DDD6FE', background: '#FAFAFF' }}>
              <span className="absolute -top-2.5 left-3 text-[9.5px] font-black px-2 py-0.5 rounded-full"
                style={{ background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE' }}>
                MASTERY
              </span>
              <div className="rounded-xl border-2 p-3 relative mt-1" style={{ borderColor: '#FDE68A', background: '#FFFEF5' }}>
                <span className="absolute -top-2.5 left-3 text-[9.5px] font-black px-2 py-0.5 rounded-full"
                  style={{ background: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A' }}>
                  GROWTH
                </span>
                <div className="rounded-xl border-2 p-3 relative mt-1" style={{ borderColor: '#A7F3D0', background: '#F0FDFB' }}>
                  <span className="absolute -top-2.5 left-3 text-[9.5px] font-black px-2 py-0.5 rounded-full"
                    style={{ background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0' }}>
                    INSIGHT
                  </span>
                  <div className="rounded-xl border-2 px-3 py-2 mt-1 flex items-center justify-center"
                    style={{ borderColor: '#BFDBFE', background: '#EFF6FF' }}>
                    <span className="text-[10px] font-black" style={{ color: '#2563EB' }}>CURIOSITY</span>
                    <span className="text-[9.5px] ml-2" style={{ color: '#93C5FD' }}>— the core of every package</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ══ Sticky CTA ════════════════════════════════════════════════ */}
      <div className="px-5 pb-5 pt-4 border-t shrink-0" style={{ borderColor: '#F1F3F6', background: '#fff' }}>

        {/* Selected summary */}
        <div className="flex items-center justify-between mb-3 px-3 py-2.5 rounded-xl"
          style={{ background: `${chosenMeta.color}0C`, border: `1px solid ${chosenMeta.color}28` }}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: chosenMeta.color }}>
              {chosenMeta.name} Package selected
            </p>
            <p className="text-[11.5px] mt-0.5" style={{ color: '#64748B' }}>
              {chosenMeta.includes.length > 0
                ? `Includes ${chosenMeta.includes.join(' + ')} + ${chosenMeta.name} stages`
                : 'Curiosity stage · 10 questions'}
            </p>
          </div>
          <div className="text-right">
            {full   && <p className="text-[10px] line-through" style={{ color: '#CBD5E1' }}>{full}</p>}
            <p className="text-[20px] font-black leading-none" style={{ color: chosenMeta.color }}>{display}</p>
            {saving && <p className="text-[9.5px] font-bold" style={{ color: '#10b981' }}>{saving}</p>}
          </div>
        </div>

        <button
          onClick={handleSelect}
          disabled={capadexLoading}
          className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-bold text-[14.5px] text-white transition-all active:scale-[0.98] disabled:opacity-60 relative overflow-hidden"
          style={{
            background: capadexLoading ? '#E5E7EB' : `linear-gradient(135deg, ${NAVY} 0%, ${chosenMeta.color} 100%)`,
            color:      capadexLoading ? '#9CA3AF' : '#fff',
            boxShadow:  capadexLoading ? 'none' : `0 4px 24px ${chosenMeta.color}45`,
          }}>
          {capadexLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Setting up your assessment…
            </>
          ) : (
            <>
              Start {firstName ? `${firstName}'s` : 'My'} {chosenMeta.name} Journey
              <ArrowRight size={16} />
            </>
          )}
        </button>

        <div className="flex items-center justify-center gap-4 mt-2.5">
          {['Secure payment', '~2 min / stage', 'Private & confidential'].map(t => (
            <span key={t} className="text-[10px] font-medium" style={{ color: '#C4C9D4' }}>{t}</span>
          ))}
        </div>
      </div>

    </div>
  );
}
