import React, { useState } from 'react';
import { PhaseProps } from '../types';

const NAVY  = '#1E3A8A';
const ACC   = '#D97706';        // Growth amber
const AACC  = '#92400E';        // darker for text
const BGL   = '#FFFBEB';
const BDR   = '#FDE68A';
const LIGHT = '#FEFCE8';

const STAGE_LABELS = ['CURIOSITY', 'INSIGHT', 'GROWTH', 'MASTERY'];
const ACTIVE_IDX   = 2;

// ── Data ─────────────────────────────────────────────────────────────────────
const STRENGTHS = [
  'Analytical thinking', 'Empathy & listening', 'Clear communication',
  'Structured planning', 'Creativity & ideation', 'Resilience under pressure',
  'Building relationships', 'Attention to detail', 'Strategic thinking',
  'Technical depth', 'Adaptability', 'Coaching & mentoring',
];

const DEVELOPMENT_AREAS = [
  'Executive presence', 'Conflict resolution', 'Strategic decision-making',
  'Public speaking / influence', 'Delegation & trust', 'Emotional regulation',
  'Networking & visibility', 'Data-driven thinking', 'Leadership transition',
  'Prioritisation under pressure', 'Building cross-functional alignment', 'Feedback delivery',
];

const LEARNING_STYLES = [
  'Self-directed reading & research', 'Structured online courses',
  'Mentorship / 1-on-1 coaching', 'Practice & real-world experiments',
  'Peer learning & community', 'Workshops & cohort learning',
];

const TIME_SLOTS = [
  'Less than 1 hr / week', '1–3 hrs / week', '3–5 hrs / week', '5+ hrs / week',
];

const SUPPORT_TYPES = [
  'My manager actively supports me', 'I have a mentor I can access',
  'I learn with a peer group', 'I have a professional coach',
  'I work on this entirely solo', 'I have no support structure yet',
];

const MILESTONES = [
  'Get promoted to the next level', 'Switch into a new domain',
  'Lead a high-visibility project', 'Develop one key missing skill',
  'Build a stronger professional network', 'Start leading a team',
  'Recover from a career setback', 'Increase my performance rating',
  'Complete a certification / credential', 'Build executive-level relationships',
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function StageHeader() {
  return (
    <div className="sticky top-0 z-10"
      style={{ background: `linear-gradient(135deg, #0F172A 0%, ${NAVY} 60%, #1E40AF 100%)` }}>
      <div className="px-5 pt-3.5 pb-2">
        <div className="flex items-center gap-1.5 mb-2.5">
          {STAGE_LABELS.map((label, i) => {
            const active = i === ACTIVE_IDX;
            const done   = i < ACTIVE_IDX;
            return (
              <React.Fragment key={label}>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full"
                    style={{ background: done ? '#34D399' : active ? '#FCD34D' : '#94A3B8', opacity: done || active ? 1 : 0.3 }} />
                  <span className="text-[9.5px] font-semibold tracking-wider"
                    style={{ color: done ? '#34D399' : active ? '#FCD34D' : '#94A3B8', opacity: done || active ? 1 : 0.35 }}>
                    {label}
                  </span>
                </div>
                {i < STAGE_LABELS.length - 1 && (
                  <div className="flex-1 h-px mx-1"
                    style={{ background: done ? '#34D399' : '#94A3B8', opacity: done ? 1 : 0.2 }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-widest mb-0.5" style={{ color: '#FCD34D' }}>STEP 0 OF 2 — PROFILING</p>
            <h2 className="text-[17px] font-bold text-white leading-tight">Growth Blueprint Setup</h2>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[9.5px] font-bold tracking-wide"
              style={{ background: 'rgba(217,119,6,0.25)', color: '#FCD34D', border: '1px solid rgba(252,211,77,0.35)' }}>
              GROWTH STAGE
            </span>
            <p className="text-[9px] mt-0.5" style={{ color: '#64748B' }}>STRATEGY & HABIT FORMATION</p>
          </div>
        </div>
      </div>
      <div className="h-0.5 w-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
    </div>
  );
}

function SectionLabel({ step, label, sub }: { step: number; label: string; sub: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-[12px] font-bold text-white"
        style={{ background: `linear-gradient(135deg, ${NAVY}, ${ACC})` }}>{step}</div>
      <div>
        <p className="text-[12.5px] font-bold" style={{ color: '#111827' }}>{label}</p>
        <p className="text-[11px] leading-snug mt-0.5" style={{ color: '#6B7280' }}>{sub}</p>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] font-semibold mb-1.5 tracking-wide" style={{ color: '#374151' }}>{children}</label>;
}

function ChipGrid({ options, value, onChange, cols = 2 }: { options: string[]; value: string; onChange: (v: string) => void; cols?: number }) {
  return (
    <div className="grid gap-2 mt-1" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {options.map(opt => (
        <button key={opt} type="button" onClick={() => onChange(value === opt ? '' : opt)}
          className="px-3 py-2 rounded-xl text-[11px] font-medium text-left transition-all leading-snug"
          style={{ background: value === opt ? ACC : BGL, color: value === opt ? '#fff' : '#374151', border: `1.5px solid ${value === opt ? ACC : BDR}` }}>
          {opt}
        </button>
      ))}
    </div>
  );
}

function MultiChipWrap({ options, values, onChange, max = 2 }: { options: string[]; values: string[]; onChange: (v: string[]) => void; max?: number }) {
  const toggle = (opt: string) => {
    if (values.includes(opt)) onChange(values.filter(v => v !== opt));
    else if (values.length < max) onChange([...values, opt]);
  };
  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {options.map(opt => (
        <button key={opt} type="button" onClick={() => toggle(opt)}
          className="px-3 py-1.5 rounded-full text-[11px] font-medium transition-all"
          style={{ background: values.includes(opt) ? ACC : BGL, color: values.includes(opt) ? '#fff' : '#374151', border: `1.5px solid ${values.includes(opt) ? ACC : BDR}` }}>
          {opt}
        </button>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function CapadexGrwProfilePhase({ setPhase, participantName, capadexRegEmail, selectedConcern, capadexReport }: PhaseProps) {
  const [strengths,      setStrengths]      = useState<string[]>([]);
  const [devAreas,       setDevAreas]       = useState<string[]>([]);
  const [learningStyle,  setLearningStyle]  = useState('');
  const [timeSlot,       setTimeSlot]       = useState('');
  const [support,        setSupport]        = useState('');
  const [milestone,      setMilestone]      = useState('');
  const [errors,         setErrors]         = useState<Record<string, string>>({});
  const [submitting,     setSubmitting]     = useState(false);

  const displayName = participantName || capadexRegEmail?.split('@')[0] || 'there';
  const concernName = capadexReport?.concernName || selectedConcern || 'your concern';

  const validate = () => {
    const e: Record<string, string> = {};
    if (strengths.length === 0) e.strengths   = 'Select at least one strength';
    if (devAreas.length === 0)  e.devAreas    = 'Select at least one development area';
    if (!learningStyle)         e.learning    = 'Required';
    if (!timeSlot)              e.timeSlot    = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleBegin = () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      sessionStorage.setItem('metryx_grw_profile', JSON.stringify({
        strengths, devAreas, learningStyle, timeSlot, support, milestone,
      }));
    } catch { /**/ }
    setPhase('capadex_q');
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: '#FFFDF5' }}>
      <StageHeader />

      {/* Intro banner */}
      <div className="mx-4 mt-4 mb-3 rounded-xl px-4 py-3.5"
        style={{ background: `linear-gradient(135deg, #92400E 0%, ${ACC} 100%)` }}>
        <p className="text-[13px] font-bold text-white leading-snug">Hi {displayName}, you've mapped your patterns —</p>
        <p className="text-[11.5px] mt-1.5 leading-relaxed" style={{ color: '#FDE68A' }}>
          Now it's time to build a targeted growth plan for <em>"{concernName}"</em>. This profile tells us exactly where to focus your development energy.
        </p>
      </div>

      {/* Section 1: Growth Focus */}
      <div className="mx-4 mb-3 rounded-xl p-4" style={{ background: '#fff', border: `1.5px solid ${BDR}` }}>
        <SectionLabel step={1} label="Your Growth Focus" sub="Where you have leverage and where you need to build — the two anchors of growth." />
        <div className="space-y-4">

          <div>
            <FieldLabel>Top strengths to build on <span style={{ color: ACC }}>*</span> <span className="font-normal text-[10.5px]" style={{ color: '#9CA3AF' }}>(pick up to 2)</span></FieldLabel>
            <MultiChipWrap options={STRENGTHS} values={strengths} onChange={setStrengths} max={2} />
            {errors.strengths && <p className="text-[10.5px] mt-1" style={{ color: '#EF4444' }}>{errors.strengths}</p>}
          </div>

          <div>
            <FieldLabel>Capability gaps to close <span style={{ color: ACC }}>*</span> <span className="font-normal text-[10.5px]" style={{ color: '#9CA3AF' }}>(pick up to 2)</span></FieldLabel>
            <MultiChipWrap options={DEVELOPMENT_AREAS} values={devAreas} onChange={setDevAreas} max={2} />
            {errors.devAreas && <p className="text-[10.5px] mt-1" style={{ color: '#EF4444' }}>{errors.devAreas}</p>}
          </div>

          <div>
            <FieldLabel>How do you learn best? <span style={{ color: ACC }}>*</span></FieldLabel>
            <ChipGrid options={LEARNING_STYLES} value={learningStyle} onChange={setLearningStyle} cols={1} />
            {errors.learning && <p className="text-[10.5px] mt-1" style={{ color: '#EF4444' }}>{errors.learning}</p>}
          </div>
        </div>
      </div>

      {/* Section 2: Commitment */}
      <div className="mx-4 mb-3 rounded-xl p-4" style={{ background: '#fff', border: `1.5px solid ${BDR}` }}>
        <SectionLabel step={2} label="Your Commitment" sub="Realistic inputs help us set a growth tempo that actually works for your life." />
        <div className="space-y-4">

          <div>
            <FieldLabel>Time available for development per week <span style={{ color: ACC }}>*</span></FieldLabel>
            <ChipGrid options={TIME_SLOTS} value={timeSlot} onChange={setTimeSlot} cols={2} />
            {errors.timeSlot && <p className="text-[10.5px] mt-1" style={{ color: '#EF4444' }}>{errors.timeSlot}</p>}
          </div>

          <div>
            <FieldLabel>Who supports your growth? <span className="font-normal text-[10.5px]" style={{ color: '#9CA3AF' }}>(optional)</span></FieldLabel>
            <ChipGrid options={SUPPORT_TYPES} value={support} onChange={setSupport} cols={1} />
          </div>

          <div>
            <FieldLabel>3–6 month milestone <span className="font-normal text-[10.5px]" style={{ color: '#9CA3AF' }}>(optional)</span></FieldLabel>
            <div className="flex flex-wrap gap-2 mt-1">
              {MILESTONES.map(m => (
                <button key={m} type="button" onClick={() => setMilestone(prev => prev === m ? '' : m)}
                  className="px-3 py-1.5 rounded-full text-[11px] font-medium transition-all"
                  style={{ background: milestone === m ? ACC : BGL, color: milestone === m ? '#fff' : '#374151', border: `1.5px solid ${milestone === m ? ACC : BDR}` }}>
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* What happens next */}
      <div className="mx-4 mb-3 rounded-xl px-4 py-3" style={{ background: BGL, border: `1px solid ${BDR}` }}>
        <p className="text-[11px] font-semibold mb-2" style={{ color: AACC }}>What happens next</p>
        {['10 growth-stage questions mapping your habit formation and strategy depth', 'Behavioural readiness score computed against your growth focus', 'Personalised growth pathway with prioritised development actions'].map((item, i) => (
          <div key={i} className="flex items-start gap-2 mb-1.5">
            <span className="text-[9px] font-bold mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0"
              style={{ background: ACC, color: '#fff' }}>{i + 1}</span>
            <p className="text-[11px] leading-snug" style={{ color: '#374151' }}>{item}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="mx-4 mb-4 mt-2">
        <button onClick={handleBegin} disabled={submitting}
          className="w-full h-12 rounded-xl flex items-center justify-center gap-2.5 text-[15px] font-bold text-white transition-all"
          style={{ background: submitting ? '#FCD34D' : `linear-gradient(135deg, ${NAVY} 0%, ${ACC} 100%)`, cursor: submitting ? 'default' : 'pointer' }}>
          {submitting ? (
            <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />Setting up your analysis…</>
          ) : (
            <>Begin Growth Assessment <svg viewBox="0 0 14 14" style={{ width: 13, height: 13 }} fill="none"><path d="M2 7h10M8 3l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></>
          )}
        </button>
        <p className="text-center text-[10.5px] mt-2" style={{ color: '#9CA3AF' }}>Your answers are confidential and used solely for your assessment.</p>
      </div>
    </div>
  );
}
