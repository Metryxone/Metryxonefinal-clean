import React, { useState } from 'react';
import { PhaseProps } from '../types';

const NAVY  = '#1E3A8A';
const ACC   = '#7C3AED';        // Mastery purple
const AACC  = '#5B21B6';
const BGL   = '#F5F3FF';
const BDR   = '#DDD6FE';
const LIGHT = '#EDE9FE';

const STAGE_LABELS = ['CURIOSITY', 'INSIGHT', 'GROWTH', 'MASTERY'];
const ACTIVE_IDX   = 3;

// ── Data ─────────────────────────────────────────────────────────────────────
const SCOPE_LEVELS = [
  { val: 'ic',       label: 'Individual Contributor',  sub: 'Deep specialist, no direct reports' },
  { val: 'tl',       label: 'Team Lead (2–5)',          sub: 'Leading a small close-knit team' },
  { val: 'mgr',      label: 'Manager (6–15)',           sub: 'Managing a functional team' },
  { val: 'sr-mgr',   label: 'Senior Manager (16–50)',   sub: 'Leading managers or larger teams' },
  { val: 'dir',      label: 'Director / VP (50+)',      sub: 'Organisational scope & strategy' },
  { val: 'c-suite',  label: 'C-Suite / Founder / MD',  sub: 'Enterprise or company-wide leadership' },
];

const DOMAINS = [
  'Technical & Engineering', 'People, Culture & HR', 'Strategy & Corporate Planning',
  'Operations & Execution', 'Commercial, Sales & Revenue', 'Product & Innovation',
  'Finance & Risk', 'Cross-functional & Enterprise', 'External Partnerships & Policy',
];

const ORG_SIZES = ['Just me', '2–10', '11–50', '51–200', '201–1000', '1000+'];

const MASTERY_MEANINGS = [
  'Depth of expertise — the deepest expert in my domain',
  'Breadth of influence — shaping decisions across the org',
  'System change — redesigning how things are done',
  'Legacy & impact — leaving something that outlasts my tenure',
  'Coaching others — elevating the people around me',
  'Building institutions — creating enduring teams or processes',
];

const CHALLENGES = [
  'Influencing without formal authority', 'Executive presence & gravitas',
  'Managing ambiguity at scale', 'Strategic thinking beyond my domain',
  'Succession planning & talent development', 'Organisational politics & alignment',
  'Burnout & sustainable high performance', 'Cross-cultural or global leadership',
  'Board / investor / external stakeholder management', 'Transformational change leadership',
];

const HORIZONS = ['6 months', '1 year', '2 years', '3–5 years', '5+ years'];

const ASSESSMENT_FOCUS = [
  'Measure my peak performance readiness', 'Benchmark against mastery-level leaders',
  'Identify remaining capability blind spots', 'Validate my leadership effectiveness',
  'Prepare for a significant leadership transition',
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
                    style={{ background: done ? '#34D399' : active ? '#C4B5FD' : '#94A3B8', opacity: done || active ? 1 : 0.3 }} />
                  <span className="text-[9.5px] font-semibold tracking-wider"
                    style={{ color: done ? '#34D399' : active ? '#DDD6FE' : '#94A3B8', opacity: done || active ? 1 : 0.35 }}>
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
            <p className="text-[10px] font-semibold tracking-widest mb-0.5" style={{ color: '#C4B5FD' }}>STEP 0 OF 2 — PROFILING</p>
            <h2 className="text-[17px] font-bold text-white leading-tight">Mastery Mandate Setup</h2>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[9.5px] font-bold tracking-wide"
              style={{ background: 'rgba(124,58,237,0.25)', color: '#DDD6FE', border: '1px solid rgba(196,181,253,0.35)' }}>
              MASTERY STAGE
            </span>
            <p className="text-[9px] mt-0.5" style={{ color: '#64748B' }}>CONTROL & PEAK PERFORMANCE</p>
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
export function CapadexMasProfilePhase({ setPhase, participantName, capadexRegEmail, selectedConcern, capadexReport }: PhaseProps) {
  const [scope,       setScope]       = useState('');
  const [domain,      setDomain]      = useState('');
  const [orgSize,     setOrgSize]     = useState('');
  const [masteryMeaning, setMasteryMeaning] = useState<string[]>([]);
  const [challenges,  setChallenges]  = useState<string[]>([]);
  const [horizon,     setHorizon]     = useState('');
  const [assessFocus, setAssessFocus] = useState('');
  const [errors,      setErrors]      = useState<Record<string, string>>({});
  const [submitting,  setSubmitting]  = useState(false);

  const displayName = participantName || capadexRegEmail?.split('@')[0] || 'there';
  const concernName = capadexReport?.concernName || selectedConcern || 'your concern';

  const validate = () => {
    const e: Record<string, string> = {};
    if (!scope)                    e.scope    = 'Leadership scope is required';
    if (!domain)                   e.domain   = 'Domain of influence is required';
    if (masteryMeaning.length < 1) e.mastery  = 'Select at least one';
    if (challenges.length < 1)     e.challenge = 'Select at least one challenge';
    if (!horizon)                  e.horizon  = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleBegin = () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      sessionStorage.setItem('metryx_mas_profile', JSON.stringify({
        scope, domain, orgSize, masteryMeaning, challenges, horizon, assessFocus,
      }));
    } catch { /**/ }
    setPhase('capadex_q');
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: '#FAFAFD' }}>
      <StageHeader />

      {/* Intro banner */}
      <div className="mx-4 mt-4 mb-3 rounded-xl px-4 py-3.5"
        style={{ background: `linear-gradient(135deg, #4C1D95 0%, ${ACC} 100%)` }}>
        <p className="text-[13px] font-bold text-white leading-snug">Hi {displayName}, you've earned the final stage —</p>
        <p className="text-[11.5px] mt-1.5 leading-relaxed" style={{ color: '#DDD6FE' }}>
          Your Mastery Assessment for <em>"{concernName}"</em> measures control, peak performance, and impact at the highest level. This profile ensures your benchmark is set correctly.
        </p>
      </div>

      {/* Section 1: Leadership Context */}
      <div className="mx-4 mb-3 rounded-xl p-4" style={{ background: '#fff', border: `1.5px solid ${BDR}` }}>
        <SectionLabel step={1} label="Your Leadership Context" sub="Who you lead, what you own, and the scale you operate at." />
        <div className="space-y-4">

          <div>
            <FieldLabel>Current leadership scope <span style={{ color: ACC }}>*</span></FieldLabel>
            <div className="space-y-2 mt-1">
              {SCOPE_LEVELS.map(sl => (
                <button key={sl.val} type="button" onClick={() => setScope(sl.val)}
                  className="w-full flex items-start gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all"
                  style={{ background: scope === sl.val ? BGL : '#FAFBFF', border: `1.5px solid ${scope === sl.val ? ACC : BDR}` }}>
                  <div className="w-4 h-4 rounded-full mt-0.5 flex items-center justify-center shrink-0"
                    style={{ border: `1.5px solid ${scope === sl.val ? ACC : '#D1D5DB'}`, background: scope === sl.val ? ACC : '#fff' }}>
                    {scope === sl.val && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <p className="text-[12.5px] font-semibold" style={{ color: '#111827' }}>{sl.label}</p>
                    <p className="text-[11px]" style={{ color: '#6B7280' }}>{sl.sub}</p>
                  </div>
                </button>
              ))}
            </div>
            {errors.scope && <p className="text-[10.5px] mt-1" style={{ color: '#EF4444' }}>{errors.scope}</p>}
          </div>

          <div>
            <FieldLabel>Primary domain of influence <span style={{ color: ACC }}>*</span></FieldLabel>
            <select value={domain} onChange={e => setDomain(e.target.value)}
              className="w-full rounded-xl px-3.5 py-2.5 text-[13px] outline-none transition-all"
              style={{ border: `1.5px solid ${BDR}`, background: '#fff', color: '#111827', appearance: 'none' as const }}>
              <option value="">Select your primary domain…</option>
              {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            {errors.domain && <p className="text-[10.5px] mt-1" style={{ color: '#EF4444' }}>{errors.domain}</p>}
          </div>

          <div>
            <FieldLabel>Team / organisation size <span className="font-normal text-[10.5px]" style={{ color: '#9CA3AF' }}>(optional)</span></FieldLabel>
            <ChipGrid options={ORG_SIZES} value={orgSize} onChange={setOrgSize} cols={3} />
          </div>
        </div>
      </div>

      {/* Section 2: Mastery Intent */}
      <div className="mx-4 mb-3 rounded-xl p-4" style={{ background: '#fff', border: `1.5px solid ${BDR}` }}>
        <SectionLabel step={2} label="Your Mastery Intent" sub="What you're optimising for and what stands between you and peak performance." />
        <div className="space-y-4">

          <div>
            <FieldLabel>What does mastery mean to you? <span style={{ color: ACC }}>*</span> <span className="font-normal text-[10.5px]" style={{ color: '#9CA3AF' }}>(pick up to 2)</span></FieldLabel>
            <MultiChipWrap options={MASTERY_MEANINGS} values={masteryMeaning} onChange={setMasteryMeaning} max={2} />
            {errors.mastery && <p className="text-[10.5px] mt-1" style={{ color: '#EF4444' }}>{errors.mastery}</p>}
          </div>

          <div>
            <FieldLabel>Biggest leadership challenge right now <span style={{ color: ACC }}>*</span> <span className="font-normal text-[10.5px]" style={{ color: '#9CA3AF' }}>(pick up to 2)</span></FieldLabel>
            <MultiChipWrap options={CHALLENGES} values={challenges} onChange={setChallenges} max={2} />
            {errors.challenge && <p className="text-[10.5px] mt-1" style={{ color: '#EF4444' }}>{errors.challenge}</p>}
          </div>

          <div>
            <FieldLabel>Your mastery horizon <span style={{ color: ACC }}>*</span></FieldLabel>
            <ChipGrid options={HORIZONS} value={horizon} onChange={setHorizon} cols={3} />
            {errors.horizon && <p className="text-[10.5px] mt-1" style={{ color: '#EF4444' }}>{errors.horizon}</p>}
          </div>

          <div>
            <FieldLabel>Primary reason for this assessment <span className="font-normal text-[10.5px]" style={{ color: '#9CA3AF' }}>(optional)</span></FieldLabel>
            <ChipGrid options={ASSESSMENT_FOCUS} value={assessFocus} onChange={setAssessFocus} cols={1} />
          </div>
        </div>
      </div>

      {/* What happens next */}
      <div className="mx-4 mb-3 rounded-xl px-4 py-3" style={{ background: BGL, border: `1px solid ${BDR}` }}>
        <p className="text-[11px] font-semibold mb-2" style={{ color: AACC }}>What happens next</p>
        {['10 mastery-stage questions probing leadership depth, control, and peak performance', 'Mastery score benchmarked against executive-level leaders in your domain', 'Personalised mastery report with strategic interventions and legacy pathways'].map((item, i) => (
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
          style={{ background: submitting ? '#C4B5FD' : `linear-gradient(135deg, ${NAVY} 0%, ${ACC} 100%)`, cursor: submitting ? 'default' : 'pointer' }}>
          {submitting ? (
            <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />Setting up your assessment…</>
          ) : (
            <>Begin Mastery Assessment <svg viewBox="0 0 14 14" style={{ width: 13, height: 13 }} fill="none"><path d="M2 7h10M8 3l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></>
          )}
        </button>
        <p className="text-center text-[10.5px] mt-2" style={{ color: '#9CA3AF' }}>Your answers are confidential and used solely for your mastery assessment.</p>
      </div>
    </div>
  );
}
