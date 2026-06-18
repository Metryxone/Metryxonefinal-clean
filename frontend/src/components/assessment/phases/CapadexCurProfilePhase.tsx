import React, { useState } from 'react';
import { PhaseProps } from '../types';

const NAVY = '#1E3A8A';
const ACC  = '#2563EB';        // Curiosity blue
const BGL  = '#EFF6FF';
const BDR  = '#BFDBFE';
const LIGHT = '#F0F9FF';

const STAGE_LABELS = ['CURIOSITY', 'INSIGHT', 'GROWTH', 'MASTERY'];
const ACTIVE_IDX   = 0;

// ── Data ─────────────────────────────────────────────────────────────────────
const ASSESSEE_TYPES = [
  { val: 'myself',        label: 'Myself',               sub: 'I want to understand my own patterns' },
  { val: 'my-child',      label: 'My child',             sub: 'I want to understand my child' },
  { val: 'a-student',     label: 'A student I support',  sub: "I'm a teacher / counsellor" },
  { val: 'someone-else',  label: 'Someone I care for',   sub: 'Colleague, partner, friend…' },
];

const AGE_GROUPS = ['Below 15', '15–18', '19–24', '25–34', '35–44', '45–54', '55 and above'];

const STATUSES = [
  'School student', 'College / University student', 'Working professional',
  'Freelancer / Consultant', 'Job seeker', 'Business owner',
  'Homemaker', 'Retired', 'Other',
];

const DURATIONS = [
  'Just noticed it recently', 'A few weeks now',
  'A few months', 'More than a year', 'For as long as I can remember',
];

const IMPACTS = [
  'My day-to-day performance', 'My self-confidence',
  'The decisions I make', 'My relationships with others',
  'My physical health or sleep', 'My sense of purpose',
  'My academic results', 'My professional reputation',
];

const TRIED = [
  'Nothing yet — this is my first step',
  'Talked to a friend or family member',
  'Read articles or watched videos',
  'Journaled or reflected alone',
  'Spoke to a professional (coach / counsellor)',
  'Tried to ignore it and push through',
];

// ── Intro carry-over maps ──────────────────────────────────────────────────────
// The intro phase already captures who the assessment is for, the age band and
// the persona. These maps translate that into the fields this form used to
// re-ask, so we can pre-fill them instead of asking again.
const normDash = (s: string) => s.replace(/[–—]/g, '-');

const AGE_FROM_BAND: Record<string, string> = {
  '6-14':  'Below 15',
  '14-17': '15–18',
  '17-24': '19–24',
  '24-45': '25–34',
  '45+':   '45–54',
};

const STATUS_FROM_PERSONA: Record<string, string> = {
  campus_student:               'College / University student',
  competitive_aspirant:         'School student',
  career_explorer:              'Job seeker',
  skill_development_learner:    'Working professional',
  early_career_professional:    'Working professional',
  mid_career_professional:      'Working professional',
  career_transition_professional:'Job seeker',
  parent:                       'School student',
  teacher_educator:             'School student',
  academic_counsellor:          'College / University student',
  placement_career_cell:        'College / University student',
};

const STATUS_FROM_LEGACY: Record<string, string> = {
  campus:       'College / University student',
  student:      'School student',
  professional: 'Working professional',
  jobseeker:    'Job seeker',
  // Proxy personas describe the person being assessed (a student), so keep this
  // aligned with the primary-persona teacher/counsellor mappings above.
  teacher:      'School student',
  parent:       'School student',
};

// ── Header ────────────────────────────────────────────────────────────────────
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
                    style={{ background: done ? '#34D399' : active ? '#60A5FA' : '#94A3B8', opacity: done || active ? 1 : 0.3 }} />
                  <span className="text-[9.5px] font-semibold tracking-wider"
                    style={{ color: done ? '#34D399' : active ? '#93C5FD' : '#94A3B8', opacity: done || active ? 1 : 0.35 }}>
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
            <p className="text-[10px] font-semibold tracking-widest mb-0.5" style={{ color: '#93C5FD' }}>STEP 0 OF 2 — PROFILING</p>
            <h2 className="text-[17px] font-bold text-white leading-tight">Clarity Profile Setup</h2>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[9.5px] font-bold tracking-wide"
              style={{ background: 'rgba(37,99,235,0.25)', color: '#93C5FD', border: '1px solid rgba(96,165,250,0.4)' }}>
              CURIOSITY STAGE
            </span>
            <p className="text-[9px] mt-0.5" style={{ color: '#64748B' }}>SURFACE AWARENESS</p>
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

function ChipGrid({ options, value, onChange, cols = 2 }: { options: string[]; value: string; onChange: (v: string) => void; cols?: number }) {
  return (
    <div className={`grid gap-2 mt-1`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {options.map(opt => (
        <button key={opt} type="button" onClick={() => onChange(value === opt ? '' : opt)}
          className="px-3 py-2 rounded-xl text-[11px] font-medium text-left transition-all leading-snug"
          style={{
            background: value === opt ? ACC : BGL,
            color: value === opt ? '#fff' : '#374151',
            border: `1.5px solid ${value === opt ? ACC : BDR}`,
          }}>
          {opt}
        </button>
      ))}
    </div>
  );
}

function MultiChipGrid({ options, values, onChange }: { options: string[]; values: string[]; onChange: (v: string[]) => void }) {
  const toggle = (opt: string) => {
    if (values.includes(opt)) onChange(values.filter(v => v !== opt));
    else if (values.length < 3) onChange([...values, opt]);
  };
  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {options.map(opt => (
        <button key={opt} type="button" onClick={() => toggle(opt)}
          className="px-3 py-1.5 rounded-full text-[11px] font-medium transition-all"
          style={{
            background: values.includes(opt) ? ACC : BGL,
            color: values.includes(opt) ? '#fff' : '#374151',
            border: `1.5px solid ${values.includes(opt) ? ACC : BDR}`,
          }}>
          {opt}
        </button>
      ))}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] font-semibold mb-1.5 tracking-wide" style={{ color: '#374151' }}>{children}</label>;
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function CapadexCurProfilePhase({ setPhase, participantName, capadexRegEmail, selectedConcern, capadexReport, assesseeType: introAssesseeType, ageBand, primaryPersona, selectedPersona }: PhaseProps) {
  // Pre-fill from the intro phase so we never ask the same questions twice.
  const prefillAssessee = introAssesseeType || '';
  const prefillAge      = AGE_FROM_BAND[normDash(ageBand || '')] || '';
  const prefillStatus   = STATUS_FROM_PERSONA[primaryPersona || ''] || STATUS_FROM_LEGACY[String(selectedPersona || '')] || '';
  const introContextComplete = !!prefillAssessee && !!prefillAge && !!prefillStatus;

  const [assesseeType,  setAssesseeType]  = useState(prefillAssessee);
  const [ageGroup,      setAgeGroup]      = useState(prefillAge);
  const [status,        setStatus]        = useState(prefillStatus);
  const [duration,      setDuration]      = useState('');
  const [impacts,       setImpacts]       = useState<string[]>([]);
  const [tried,         setTried]         = useState('');
  const [errors,        setErrors]        = useState<Record<string, string>>({});
  const [submitting,    setSubmitting]    = useState(false);
  const [showAboutEdit, setShowAboutEdit] = useState(false);

  const displayName = participantName || capadexRegEmail?.split('@')[0] || 'there';
  const concernName = capadexReport?.concernName || selectedConcern || 'your concern';
  const assesseeLabel = ASSESSEE_TYPES.find(a => a.val === assesseeType)?.label || '—';
  // Show the exact age band the user picked in the intro (no bucket conversion).
  const ageBandDisplay = normDash(ageBand || '').replace(/-/g, '–') || ageGroup;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!assesseeType) e.assesseeType = 'Please tell us who this is for';
    if (!ageGroup)     e.ageGroup     = 'Age group is required';
    if (!status)       e.status       = 'Current situation is required';
    if (!duration)     e.duration     = 'Please select how long this has been affecting you';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleBegin = () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      sessionStorage.setItem('metryx_cur_profile', JSON.stringify({
        assesseeType, ageGroup, status, duration, impacts, tried,
      }));
    } catch { /**/ }
    setPhase('capadex_q');
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: '#F8FAFF' }}>
      <StageHeader />

      {/* Intro banner */}
      <div className="mx-4 mt-4 mb-3 rounded-xl px-4 py-3.5"
        style={{ background: `linear-gradient(135deg, #1E3A8A 0%, ${ACC} 100%)` }}>
        <p className="text-[13px] font-bold text-white leading-snug">Hi {displayName}, let's set the context —</p>
        <p className="text-[11.5px] mt-1.5 leading-relaxed" style={{ color: '#BFDBFE' }}>
          A few quick questions before your Curiosity Assessment for <em>"{concernName}"</em> begins. This helps us tailor your first-level behavioural signals accurately.
        </p>
      </div>

      {/* Section 1: About You */}
      <div className="mx-4 mb-3 rounded-xl p-4" style={{ background: '#fff', border: `1.5px solid ${BDR}` }}>
        <SectionLabel step={1} label="About You" sub="Who is this assessment for, and where are you right now?" />

        {introContextComplete && !showAboutEdit ? (
          <div className="rounded-xl p-3.5" style={{ background: BGL, border: `1px solid ${BDR}` }}>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[11px] font-semibold" style={{ color: NAVY }}>Carried over from your intro</p>
              <button type="button" onClick={() => setShowAboutEdit(true)}
                className="text-[11px] font-semibold" style={{ color: ACC }}>Edit</button>
            </div>
            <div className="space-y-2">
              {[['For', assesseeLabel], ['Age group', ageBandDisplay], ['Current situation', status]].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3">
                  <span className="text-[11px]" style={{ color: '#6B7280' }}>{k}</span>
                  <span className="text-[12px] font-semibold text-right" style={{ color: '#111827' }}>{v}</span>
                </div>
              ))}
            </div>
            <p className="text-[10.5px] mt-2.5 leading-snug" style={{ color: '#9CA3AF' }}>
              We've used what you shared earlier. Tap edit if anything has changed.
            </p>
          </div>
        ) : (
        <div className="space-y-4">

          <div>
            <FieldLabel>Who is this assessment for? <span style={{ color: ACC }}>*</span></FieldLabel>
            <div className="space-y-2 mt-1">
              {ASSESSEE_TYPES.map(at => (
                <button key={at.val} type="button" onClick={() => setAssesseeType(at.val)}
                  className="w-full flex items-start gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all"
                  style={{
                    background: assesseeType === at.val ? BGL : '#FAFBFF',
                    border: `1.5px solid ${assesseeType === at.val ? ACC : BDR}`,
                  }}>
                  <div className="w-4 h-4 rounded-full mt-0.5 flex items-center justify-center shrink-0"
                    style={{ border: `1.5px solid ${assesseeType === at.val ? ACC : '#D1D5DB'}`, background: assesseeType === at.val ? ACC : '#fff' }}>
                    {assesseeType === at.val && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <p className="text-[12.5px] font-semibold" style={{ color: '#111827' }}>{at.label}</p>
                    <p className="text-[11px]" style={{ color: '#6B7280' }}>{at.sub}</p>
                  </div>
                </button>
              ))}
            </div>
            {errors.assesseeType && <p className="text-[10.5px] mt-1" style={{ color: '#EF4444' }}>{errors.assesseeType}</p>}
          </div>

          <div>
            <FieldLabel>Age group <span style={{ color: ACC }}>*</span></FieldLabel>
            <ChipGrid options={AGE_GROUPS} value={ageGroup} onChange={setAgeGroup} cols={3} />
            {errors.ageGroup && <p className="text-[10.5px] mt-1" style={{ color: '#EF4444' }}>{errors.ageGroup}</p>}
          </div>

          <div>
            <FieldLabel>Current situation <span style={{ color: ACC }}>*</span></FieldLabel>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="w-full rounded-xl px-3.5 py-2.5 text-[13px] outline-none transition-all"
              style={{ border: `1.5px solid ${BDR}`, background: '#fff', color: '#111827', appearance: 'none' as const }}>
              <option value="">Select your current situation…</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {errors.status && <p className="text-[10.5px] mt-1" style={{ color: '#EF4444' }}>{errors.status}</p>}
          </div>
        </div>
        )}
      </div>

      {/* Section 2: Your Concern */}
      <div className="mx-4 mb-3 rounded-xl p-4" style={{ background: '#fff', border: `1.5px solid ${BDR}` }}>
        <SectionLabel step={2} label="Your Concern" sub="Help us understand the weight and nature of what you are experiencing." />
        <div className="space-y-4">

          <div>
            <FieldLabel>How long has this been affecting you? <span style={{ color: ACC }}>*</span></FieldLabel>
            <ChipGrid options={DURATIONS} value={duration} onChange={setDuration} cols={1} />
            {errors.duration && <p className="text-[10.5px] mt-1" style={{ color: '#EF4444' }}>{errors.duration}</p>}
          </div>

          <div>
            <FieldLabel>How is it impacting you? <span className="font-normal text-[10.5px]" style={{ color: '#9CA3AF' }}>(pick up to 3)</span></FieldLabel>
            <MultiChipGrid options={IMPACTS} values={impacts} onChange={setImpacts} />
          </div>

          <div>
            <FieldLabel>What have you tried so far? <span className="font-normal text-[10.5px]" style={{ color: '#9CA3AF' }}>(optional)</span></FieldLabel>
            <ChipGrid options={TRIED} value={tried} onChange={setTried} cols={1} />
          </div>
        </div>
      </div>

      {/* What happens next */}
      <div className="mx-4 mb-3 rounded-xl px-4 py-3" style={{ background: BGL, border: `1px solid ${BDR}` }}>
        <p className="text-[11px] font-semibold mb-2" style={{ color: NAVY }}>What happens next</p>
        {["Surface-level signal mapping across 10 behavioural dimensions", "Pattern recognition to identify your core concern signature", "First-stage report with clarity on what's actually happening"].map((item, i) => (
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
          style={{ background: submitting ? '#93C5FD' : `linear-gradient(135deg, ${NAVY} 0%, ${ACC} 100%)`, cursor: submitting ? 'default' : 'pointer' }}>
          {submitting ? (
            <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />Setting up your assessment…</>
          ) : (
            <>Begin Curiosity Assessment <svg viewBox="0 0 14 14" style={{ width: 13, height: 13 }} fill="none"><path d="M2 7h10M8 3l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></>
          )}
        </button>
        <p className="text-center text-[10.5px] mt-2" style={{ color: '#9CA3AF' }}>Your answers are confidential and used only for your assessment.</p>
      </div>
    </div>
  );
}
