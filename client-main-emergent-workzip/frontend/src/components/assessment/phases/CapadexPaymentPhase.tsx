import React, { useState } from 'react';
import metryxLogo from '@/assets/metryx-logo-transparent.png';
import { PhaseProps } from '../types';

const CAREER_REGEX = /career|job|role|profession|transition|stuck|workplace|employ|purpose|direction|leadership|promotion|burnout|meaning|identity/i;

/* ── Inline SVG icon components — theme-matched, no emojis ── */
function IconCV({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 20 20" style={{ width: 16, height: 16 }} fill="none">
      <rect x="4" y="2" width="12" height="16" rx="2" stroke={color} strokeWidth="1.5"/>
      <path d="M7 7h6M7 10h6M7 13h4" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}
function IconBenchmark({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 20 20" style={{ width: 16, height: 16 }} fill="none">
      <rect x="3" y="13" width="3" height="5" rx="0.8" fill={color} opacity="0.3"/>
      <rect x="3" y="13" width="3" height="5" rx="0.8" stroke={color} strokeWidth="1.2"/>
      <rect x="8.5" y="9" width="3" height="9" rx="0.8" fill={color} opacity="0.3"/>
      <rect x="8.5" y="9" width="3" height="9" rx="0.8" stroke={color} strokeWidth="1.2"/>
      <rect x="14" y="5" width="3" height="13" rx="0.8" fill={color} opacity="0.3"/>
      <rect x="14" y="5" width="3" height="13" rx="0.8" stroke={color} strokeWidth="1.2"/>
      <path d="M4.5 13L10 9l5.5-4" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconGapAnalysis({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 20 20" style={{ width: 16, height: 16 }} fill="none">
      <circle cx="10" cy="10" r="7" stroke={color} strokeWidth="1.5"/>
      <circle cx="10" cy="10" r="3.5" stroke={color} strokeWidth="1.3" strokeDasharray="2.5 2"/>
      <circle cx="10" cy="10" r="1" fill={color}/>
      <path d="M10 3v2M10 15v2M3 10h2M15 10h2" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}
function IconJobFit({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 20 20" style={{ width: 16, height: 16 }} fill="none">
      <rect x="2" y="7" width="16" height="11" rx="2" stroke={color} strokeWidth="1.5"/>
      <path d="M7 7V5.5a3 3 0 016 0V7" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M2 11h16" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="10" cy="11" r="1.5" fill={color} opacity="0.3"/>
      <circle cx="10" cy="11" r="1.5" stroke={color} strokeWidth="1.1"/>
    </svg>
  );
}
function IconSearch({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 16 16" style={{ width: 13, height: 13 }} fill="none">
      <circle cx="6.5" cy="6.5" r="4.5" stroke={color} strokeWidth="1.4"/>
      <path d="M10 10l3 3" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}
function IconCompass({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 16 16" style={{ width: 13, height: 13 }} fill="none">
      <circle cx="8" cy="8" r="6.5" stroke={color} strokeWidth="1.3"/>
      <path d="M8 3v1M8 12v1M3 8h1M12 8h1" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="8" cy="8" r="1.2" fill={color}/>
    </svg>
  );
}
function IconRuler({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 16 16" style={{ width: 13, height: 13 }} fill="none">
      <rect x="2" y="5" width="12" height="6" rx="1.2" stroke={color} strokeWidth="1.3"/>
      <path d="M5 5v2M8 5v3M11 5v2" stroke={color} strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
  );
}

const CAREER_SERVICES = [
  { Icon: IconCV,          name: 'CV Positioning Intelligence', desc: 'Reframe your CV around actual behavioural strengths — not generic job duties.' },
  { Icon: IconBenchmark,   name: 'Competency Benchmarking',     desc: 'Compare your profile against verified standards for your target role and seniority.' },
  { Icon: IconGapAnalysis, name: 'Competency Gap Analysis',     desc: 'Identify precisely which capabilities are creating friction in your career transition.' },
  { Icon: IconJobFit,      name: 'Job Market Fit Prediction',   desc: 'Discover which roles and sectors are the strongest match for your behavioural profile.' },
];

export function CapadexPaymentPhase(props: PhaseProps) {
  const {
    setPhase, participantName, selectedConcern,
    capadexReport, capadexStageResult,
    capadexRegEmail,
    paymentStageData, paymentConfirmLoading,
    handlePaymentConfirm,
  } = props;

  const [acknowledged, setAcknowledged] = useState(false);

  const ps = paymentStageData;
  if (!ps) return null;

  const cl = (capadexReport?.concernName || selectedConcern || '').toLowerCase();
  const isCareer  = CAREER_REGEX.test(cl);
  const isInsight = ps.code === 'CAP_INS';

  const stageNum   = ps.code === 'CAP_INS' ? 2 : ps.code === 'CAP_GRW' ? 3 : 4;
  const hasEmail   = !!(capadexRegEmail.trim());
  const score      = capadexStageResult?.score;
  const scoreLevel = capadexStageResult?.score_level || '';
  const firstName  = participantName ? participantName.split(' ')[0] : null;
  const concernName = capadexReport?.concernName || selectedConcern || 'your concern';

  const ACC  = '#2563EB';
  const ABGL = '#EFF6FF';
  const ABDR = '#BFDBFE';
  const NAVY = '#344E86';

  const teasers = isCareer ? [
    { Ic: IconSearch,  label: 'Specific competency gaps identified in your Curiosity profile' },
    { Ic: IconRuler,   label: 'Exact gap between your profile and your target role standard' },
    { Ic: IconCompass, label: 'Internal blocks vs external circumstances — decoded' },
  ] : [
    { Ic: IconSearch,  label: 'Root-cause pattern hidden beneath surface behaviours' },
    { Ic: IconRuler,   label: 'The exact trigger sequence driving your concern' },
    { Ic: IconCompass, label: 'Behavioural benchmark vs 10,000+ real profiles' },
  ];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: '#F8FAFF' }}>

      {/* ── HEADER ── */}
      <div className="px-5 pt-4 pb-3.5 flex items-center gap-3 sticky top-0 z-10"
        style={{ background: '#fff', borderBottom: `1px solid ${ABDR}` }}>
        <button
          onClick={() => setPhase('capadex_report')}
          className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-gray-100 shrink-0"
          aria-label="Back">
          <svg viewBox="0 0 16 16" style={{ width: 14, height: 14 }} fill="none">
            <path d="M10 3L5 8l5 5" stroke="#374151" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <img src={metryxLogo} alt="MetryxOne" style={{ height: 20, objectFit: 'contain', flexShrink: 0 }} />
        <div className="ml-1 flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: ACC }}>Unlock Stage {stageNum}</p>
          <p className="text-[14px] font-bold text-gray-900 leading-tight truncate">{ps.name} Assessment</p>
        </div>
        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0"
          style={{ background: ABGL, color: ACC, border: `1px solid ${ABDR}` }}>
          {ps.tag || 'Most Impactful'}
        </span>
      </div>

      {/* ── PERSONALIZED FOMO HOOK ── */}
      {isInsight && score != null && (
        <div className="mx-5 mt-4 rounded-2xl overflow-hidden"
          style={{ background: `linear-gradient(135deg, #1E3A8A 0%, ${ACC} 100%)` }}>
          <div className="px-4 pt-4 pb-3.5">
            <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: '#93C5FD', letterSpacing: '0.1em' }}>
              {isCareer ? 'Competency Intelligence — Unlocks at Stage 2' : 'Pattern Intelligence — Unlocks at Stage 2'}
            </p>
            <p className="text-[15px] font-bold leading-snug text-white mb-3">
              {firstName
                ? isCareer
                  ? `${firstName}, your Curiosity profile reveals ${score < 50 ? '4' : score < 65 ? '3' : '2'} competency gaps affecting your career transition.`
                  : `${firstName}, your Curiosity score of ${score}% has surfaced ${score < 50 ? '4' : score < 65 ? '3' : '2'} hidden patterns worth decoding.`
                : isCareer
                  ? 'Your Curiosity profile reveals measurable competency gaps affecting your career transition.'
                  : 'Your Curiosity score has surfaced hidden patterns that require deeper analysis.'}
            </p>
            <div className="space-y-2">
              {teasers.map(({ Ic, label }, i) => (
                <div key={i} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
                  style={{ background: 'rgba(255,255,255,0.10)' }}>
                  <div className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.12)' }}>
                    <Ic color="#93C5FD" />
                  </div>
                  <p className="text-[12.5px] font-medium flex-1 leading-snug" style={{ color: '#BFDBFE' }}>
                    {label}
                  </p>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {[...Array(4)].map((_, j) => (
                      <div key={j} className="h-2 rounded-sm"
                        style={{ width: 8, background: j < 3 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.07)' }} />
                    ))}
                    <svg viewBox="0 0 14 14" style={{ width: 11, height: 11, marginLeft: 4 }} fill="none">
                      <rect x="2" y="5" width="10" height="7" rx="1.2" stroke="#93C5FD" strokeWidth="1.3"/>
                      <path d="M4.5 5V3.8a2.5 2.5 0 015 0V5" stroke="#93C5FD" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] mt-3 text-center" style={{ color: '#60A5FA' }}>
              Full analysis unlocks instantly after payment
            </p>
          </div>
        </div>
      )}

      {/* ── CAREER BUILDER SERVICES ── */}
      {isCareer && isInsight && (
        <div className="mx-5 mt-4 rounded-2xl overflow-hidden"
          style={{ background: '#fff', border: `1.5px solid ${ABDR}` }}>

          {/* Section header */}
          <div className="px-4 pt-3 pb-2.5 flex items-center justify-between"
            style={{ background: ABGL, borderBottom: `1px solid ${ABDR}` }}>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                style={{ background: ACC }}>
                <svg viewBox="0 0 12 12" style={{ width: 10, height: 10 }} fill="none">
                  <path d="M1 10l2.5-3 2 2 2.5-4L11 2" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: ACC }}>
                Career Builder — Services Included
              </p>
            </div>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0"
              style={{ background: ACC, color: '#fff' }}>4 Services</span>
          </div>

          {/* Service rows */}
          <div className="divide-y" style={{ borderColor: ABDR }}>
            {CAREER_SERVICES.map(({ Icon, name, desc }, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: ABGL, border: `1px solid ${ABDR}` }}>
                  <Icon color={ACC} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="text-[12.5px] font-semibold" style={{ color: '#111827' }}>{name}</p>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ background: '#D1FAE5', color: '#065F46', border: '1px solid #A7F3D0' }}>
                      Included
                    </span>
                  </div>
                  <p className="text-[11.5px] leading-snug" style={{ color: '#6B7280' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="px-4 pb-3.5 pt-2">
            <div className="rounded-xl px-3 py-2.5 flex items-start gap-2"
              style={{ background: '#EFF6FF', border: `1px solid ${ABDR}` }}>
              <svg viewBox="0 0 14 14" style={{ width: 13, height: 13, flexShrink: 0, marginTop: 1 }} fill="none">
                <circle cx="7" cy="7" r="6" stroke={ACC} strokeWidth="1.3"/>
                <path d="M7 5v3M7 9.5v.5" stroke={ACC} strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <p className="text-[11px] leading-snug" style={{ color: '#1D4ED8' }}>
                All 4 services are powered by your Insight stage results — delivered within 24 hours of completing the assessment.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── STAGE PRICING CARD ── */}
      <div className="mx-5 mt-4 rounded-2xl overflow-hidden"
        style={{ background: '#fff', border: `1.5px solid ${ABDR}` }}>
        <div className="px-4 pt-3.5 pb-3 flex items-center justify-between"
          style={{ borderBottom: `1px solid ${ABDR}` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[12px] font-bold shrink-0"
              style={{ backgroundColor: ACC }}>
              {stageNum}
            </div>
            <span className="text-[15px] font-bold" style={{ color: ACC }}>{ps.name}</span>
          </div>
          <div className="text-right">
            <p className="text-[22px] font-bold leading-none" style={{ color: ACC }}>{ps.price}</p>
            <p className="text-[11px] mt-0.5" style={{ color: ACC + '99' }}>{ps.note}</p>
          </div>
        </div>
        <div className="px-4 pt-3 pb-4">
          <p className="text-[10px] font-black uppercase tracking-widest mb-2.5"
            style={{ color: ACC + '99', letterSpacing: '0.1em' }}>What you get</p>
          <div className="space-y-2.5">
            {ps.benefits.map((b, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="shrink-0 mt-0.5">
                  <svg viewBox="0 0 14 14" style={{ width: 14, height: 14 }} fill="none">
                    <circle cx="7" cy="7" r="7" fill={ACC} opacity="0.12"/>
                    <path d="M4 7l2.2 2.2 3.8-3.8" stroke={ACC} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="text-[13px] leading-snug" style={{ color: '#374151' }}>{b}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SCORE CONTEXT ── */}
      {score != null && (
        <div className="mx-5 mt-3 rounded-xl px-4 py-2.5 flex items-center gap-2.5"
          style={{ background: ABGL, border: `1px solid ${ABDR}` }}>
          <svg viewBox="0 0 14 14" style={{ width: 13, height: 13, flexShrink: 0 }} fill="none">
            <circle cx="7" cy="7" r="6" stroke={ACC} strokeWidth="1.3"/>
            <path d="M7 4.5v3M7 9v.5" stroke={ACC} strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <p className="text-[12px]" style={{ color: ACC }}>
            Your Curiosity score: <strong>{score}% ({scoreLevel})</strong> on &ldquo;{concernName}&rdquo;
            {isInsight && score < 70 && <span style={{ color: '#1D4ED8' }}> — Insight reveals what's driving this.</span>}
          </p>
        </div>
      )}

      {/* ── SOCIAL PROOF ── */}
      <div className="mx-5 mt-3 rounded-xl px-4 py-3 flex items-start gap-3"
        style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold text-white"
          style={{ background: NAVY }}>R</div>
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] leading-snug italic" style={{ color: '#374151' }}>
            {isCareer
              ? `"The competency gap analysis was surgical. I finally understood exactly what was stopping my transition — not vague 'self-awareness' advice."`
              : `"I thought I knew my patterns. The Insight report showed me things I never would have figured out on my own."`}
          </p>
          <p className="text-[10.5px] mt-1.5 font-medium" style={{ color: '#9CA3AF' }}>
            {isCareer ? 'Rahul S. — Career transition completed, MetryxOne user' : 'MetryxOne user, after completing Insight'}
          </p>
        </div>
      </div>

      {/* ── PAYMENT SECURITY ── */}
      <div className="mx-5 mt-3 rounded-xl px-4 py-3 flex items-start gap-3"
        style={{ background: '#F0F9FF', border: '1px solid #BAE6FD' }}>
        <svg viewBox="0 0 16 16" style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} fill="none">
          <path d="M8 2L3 4.5V9c0 3 2 5 5 5s5-2 5-5V4.5L8 2z" stroke="#0284C7" strokeWidth="1.4" strokeLinejoin="round"/>
          <path d="M5.5 8.5l2 2 3-3" stroke="#0284C7" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <p className="text-[12px] leading-relaxed" style={{ color: '#0369A1' }}>
          Secure payment via <strong>Razorpay</strong>. Pay with UPI, card, net banking, or wallet.
          Your stage unlocks <strong>instantly</strong> after payment.
          {!hasEmail && " You'll be asked for your email before checkout."}
        </p>
      </div>

      {/* ── DISCLAIMER ── */}
      <div className="mx-5 mt-3 rounded-xl px-4 py-3"
        style={{ background: '#FAFAFA', border: '1px solid #E5E7EB' }}>
        <p className="text-[9.5px] font-black uppercase tracking-widest mb-1.5"
          style={{ color: '#9CA3AF', letterSpacing: '0.1em' }}>Important Notice</p>
        <p className="text-[11.5px] leading-relaxed" style={{ color: '#6B7280' }}>
          {isCareer
            ? 'MetryxOne assessments are designed for professional development and career planning purposes. Results reflect self-reported behavioural patterns and should be considered alongside professional career guidance. This is not a recruitment or HR evaluation tool.'
            : 'MetryxOne assessments are designed for personal development purposes and are not intended for clinical diagnosis, medical advice, or mental health treatment. Results reflect self-reported behavioural patterns and should be interpreted with appropriate professional guidance.'}
        </p>
        <p className="text-[10.5px] mt-1.5 leading-relaxed" style={{ color: '#9CA3AF' }}>
          Results are confidential and processed in accordance with the Digital Personal Data Protection Act (DPDP), 2023. Your data will not be shared with employers, institutions, or third parties without explicit consent.
        </p>
      </div>

      {/* ── ACKNOWLEDGMENT ── */}
      <div className="mx-5 mt-3 rounded-xl px-4 py-3"
        style={{ background: '#fff', border: `1.5px solid ${acknowledged ? ABDR : '#E5E7EB'}` }}>
        <label className="flex items-start gap-3 cursor-pointer">
          <button
            type="button"
            onClick={() => setAcknowledged(a => !a)}
            className="shrink-0 mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all"
            style={{
              borderColor: acknowledged ? ACC : '#D1D5DB',
              background:  acknowledged ? ACC : '#fff',
            }}>
            {acknowledged && (
              <svg viewBox="0 0 10 10" style={{ width: 10, height: 10 }} fill="none">
                <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
          <p
            onClick={() => setAcknowledged(a => !a)}
            className="text-[12px] leading-relaxed select-none flex-1"
            style={{ color: '#374151' }}>
            I understand that this assessment is for{' '}
            <strong>{isCareer ? 'professional development' : 'personal development'}</strong>{' '}
            purposes and does not constitute a{' '}
            <strong>{isCareer ? 'recruitment evaluation' : 'clinical diagnosis'}</strong>.
            I consent to my data being processed for delivering my assessment results.
          </p>
        </label>
        {!acknowledged && (
          <p className="text-[10.5px] mt-1.5 ml-8" style={{ color: '#9CA3AF' }}>
            Please acknowledge the notice above to proceed with payment.
          </p>
        )}
      </div>

      {/* ── AI COACH SUPPORT LINK ── */}
      <div className="mx-5 mt-3 rounded-xl overflow-hidden"
        style={{ background: '#fff', border: `1.5px solid ${ABDR}` }}>
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `linear-gradient(135deg, #1E3A8A 0%, ${ACC} 100%)` }}>
            <svg viewBox="0 0 18 18" style={{ width: 14, height: 14 }} fill="none">
              <circle cx="9" cy="6" r="3" stroke="white" strokeWidth="1.4"/>
              <path d="M3 15c0-3 2.7-5 6-5s6 2 6 5" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
              <path d="M13 8l2 1-2 1" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] font-semibold" style={{ color: '#111827' }}>
              Not sure yet? Talk to our AI Coach.
            </p>
            <p className="text-[11px] leading-snug mt-0.5" style={{ color: '#6B7280' }}>
              Get personalised guidance on which stage is right for you — before you commit.
            </p>
          </div>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('metryx:open-coach'))}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11.5px] font-semibold transition-opacity hover:opacity-80"
            style={{ background: ABGL, color: ACC, border: `1px solid ${ABDR}` }}>
            Open
            <svg viewBox="0 0 12 12" style={{ width: 10, height: 10 }} fill="none">
              <path d="M2 10L10 2M5 2h5v5" stroke={ACC} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        <div className="px-4 pb-3 flex items-center gap-3">
          <div className="w-9 h-9 shrink-0" />
          <div className="flex items-center gap-2 flex-wrap">
            {['Available 24/7', 'Free to use', 'Understands your concern'].map((tag, i) => (
              <span key={i} className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{ background: ABGL, color: ACC, border: `1px solid ${ABDR}` }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="mx-5 mt-4 mb-2 space-y-3">
        <button
          onClick={handlePaymentConfirm}
          disabled={paymentConfirmLoading || !acknowledged}
          className="flex items-center justify-center gap-2.5 w-full h-12 rounded-xl text-[15px] font-bold text-white transition-all"
          style={{
            background: acknowledged ? ACC : '#9CA3AF',
            cursor: !acknowledged ? 'not-allowed' : 'pointer',
            opacity: paymentConfirmLoading ? 0.7 : 1,
          }}>
          {paymentConfirmLoading ? (
            <>
              <svg className="animate-spin" viewBox="0 0 16 16" style={{ width: 16, height: 16 }} fill="none">
                <circle cx="8" cy="8" r="6" stroke="white" strokeWidth="2" strokeDasharray="20 10" strokeLinecap="round"/>
              </svg>
              Processing…
            </>
          ) : (
            <>
              <svg viewBox="0 0 16 16" style={{ width: 14, height: 14 }} fill="none">
                <rect x="2" y="6" width="12" height="9" rx="1.5" stroke="white" strokeWidth="1.4"/>
                <path d="M5 6V4.5a3 3 0 016 0V6" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
                <circle cx="8" cy="11" r="1.2" fill="white"/>
              </svg>
              Pay {ps.price} &amp; Unlock {ps.name} →
            </>
          )}
        </button>

        <a
          href={`https://wa.me/${ps.waNum}?text=${encodeURIComponent(
            `Hi! ${participantName ? `My name is ${participantName}. ` : ''}` +
            (score != null ? `I scored ${score}% (${scoreLevel}) on ` : 'I want to unlock the ') +
            `"${concernName}" — ${ps.name} stage on MetryxOne.\n\nI'd like to pay ${ps.price} to unlock the ${ps.name} stage. Can you help me?`
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full h-11 rounded-xl text-[14px] font-semibold transition-opacity hover:opacity-80"
          style={{ color: '#15803D', background: '#F0FDF4', border: '1.5px solid #BBF7D0' }}>
          <svg viewBox="0 0 20 20" style={{ width: 17, height: 17, flexShrink: 0 }} fill="#15803D">
            <path d="M10 0C4.477 0 0 4.477 0 10c0 1.763.46 3.418 1.265 4.857L0 20l5.293-1.243A9.953 9.953 0 0010 20c5.523 0 10-4.477 10-10S15.523 0 10 0zm5.09 13.857c-.214.6-1.246 1.143-1.714 1.2-.443.053-.996.075-1.607-.1-.37-.11-.845-.257-1.454-.504-2.557-1.1-4.226-3.671-4.354-3.843-.129-.171-1.043-1.386-1.043-2.643 0-1.257.657-1.875.9-2.128.214-.229.471-.286.629-.286.157 0 .314 0 .457.007.143.007.343-.057.536.414.2.486.686 1.686.743 1.8.057.114.1.25.014.4-.086.143-.129.229-.257.371-.129.143-.271.32-.386.43-.129.121-.262.25-.114.49.15.243.657 1.079 1.407 1.75.971.864 1.793 1.136 2.043 1.264.243.129.386.107.529-.064.143-.172.614-.714.779-.957.164-.243.329-.2.557-.121.229.079 1.457.686 1.7.814.243.129.4.193.457.3.057.107.057.614-.157 1.214z"/>
          </svg>
          Need help? Chat on WhatsApp
        </a>

        <button
          onClick={() => setPhase('capadex_report')}
          className="w-full text-center text-[13px] text-gray-400 hover:text-gray-600 transition-colors py-1">
          ← Back to report
        </button>
      </div>

      {/* ── TRUST BAR ── */}
      <div className="flex items-center justify-center flex-wrap gap-x-5 gap-y-2 mx-5 mt-3 mb-6">
        {['Secure & Encrypted', 'DPDP Compliant', 'Instant Unlock', 'Expert-reviewed'].map((t, i) => (
          <span key={i} className="text-[11px] flex items-center gap-1.5" style={{ color: '#9CA3AF' }}>
            <svg viewBox="0 0 10 10" style={{ width: 9, height: 9, flexShrink: 0 }} fill="none">
              <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t}
          </span>
        ))}
      </div>

    </div>
  );
}
