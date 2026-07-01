/**
 * CAPADEX 3.0 — Program 3 · Phase 3.2A Persona Experience / Intelligent Journey Router.
 *
 * A progressive 5-step onboarding wizard that REPLACES the generic single-page persona
 * selector when the `personaJourneyRouter` flag is ON. It is a pure additive wrap over
 * FreeAssessmentModal/IntroPhase:
 *
 *   Step 1 · Who        → macro track (school / learner / professional / proxy) + B2B/admin exits
 *   Step 2 · Refine     → granular sub-persona + age band (reuses the ONE shared taxonomy)
 *   Step 3 · Goal       → primary goal + timeline (maps to existing participantGoal / goalTimeline)
 *   Step 4 · Personalize→ optional focus (maps to existing enrichment fields; nothing is required)
 *   Step 5 · AI Journey → DETERMINISTIC journey resolution from /api/persona-journey/route
 *
 * On finish it writes the resolved persona/legacyKey/is_proxy/ageBand/goal/timeline into the
 * existing modal state (via the passed setters) and calls `onComplete()`, which reveals the
 * classic IntroPhase (already collapsed to the chosen persona) so the downstream
 * analyze → clarify → questions → results flow is completely untouched.
 *
 * B2B / admin personas do NOT take the free assessment — they route to their EXISTING
 * login/registration screens via `onNavigate`.
 *
 * NO fabricated AI: Step 5's "AI Journey Router" is a deterministic composition of the
 * platform's existing customer-journey / assessment-framework / lifecycle registries,
 * served read-only by the backend resolver. Honest status notes are surfaced verbatim.
 */
import React from 'react';
import {
  ArrowRight, ArrowLeft, Check, Search, School, GraduationCap, Briefcase, Users,
  Building2, ShieldCheck, Sparkles, Target, Clock, Loader2, X, Route, ClipboardList,
  LayoutDashboard, FileText, Lightbulb, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PersonaKey } from '@/lib/behavioural-insights';
import {
  AGE_BANDS, type AgeBand, AGE_BAND_LABEL, buildTrackGroups,
  type MacroTrackData, type SubPersona, isCanonicalAgeBand,
} from '@/lib/persona-taxonomy';

const BRAND_DEEP = '#344E86';
const BRAND_TEAL = '#2A9D8F';
const STORAGE_KEY = 'capadex_persona_journey_wizard_v1';

const TRACK_ICON: Record<MacroTrackData['id'], React.ComponentType<{ size?: number; className?: string }>> = {
  school: School, learner: GraduationCap, professional: Briefcase, proxy: Users,
};

// B2B / admin destinations — these personas use existing login/registration entry points,
// NOT the free assessment. `screen` values map to the App's Screen navigation.
const B2B_DESTINATIONS: { id: string; label: string; sub: string; screen: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'employer', label: 'Employer / Recruiter', sub: 'Post jobs, screen & hire candidates', screen: 'employer-login', icon: Building2 },
  { id: 'institution', label: 'Institution / Placement cell', sub: 'Cohort intelligence & placements', screen: 'login', icon: Users },
  { id: 'admin', label: 'Platform administrator', sub: 'Super-admin console', screen: 'admin-login', icon: ShieldCheck },
];

const GOAL_OPTIONS: { id: string; label: string }[] = [
  { id: 'clarity', label: 'Get clarity on my strengths & direction' },
  { id: 'exam', label: 'Prepare for exams / academics' },
  { id: 'career', label: 'Choose or switch a career path' },
  { id: 'placement', label: 'Land a job / placement' },
  { id: 'growth', label: 'Grow in my current role' },
  { id: 'support', label: 'Support someone in my care' },
];

// Conditional goal filter — a goal only shows for the tracks it actually makes
// sense for, so a school student is never asked about landing a job / growing in
// a role, and a self-taker is never asked to "support someone in their care".
const GOAL_TRACK_MAP: Record<MacroTrackData['id'], string[]> = {
  school:       ['clarity', 'exam', 'career'],
  learner:      ['clarity', 'exam', 'career', 'placement'],
  professional: ['clarity', 'career', 'placement', 'growth'],
  proxy:        ['support', 'clarity'],
};

// Finer-grained override — some sub-personas within a track need a NARROWER goal
// set than the track default. The clearest case: a competitive-exam aspirant
// (JEE / NEET / CUET / UPSC) sits in the broad "learner" track, but their goal is
// exam prep + clarity — never "switch a career" or "land a job / placement". When
// a sub-persona is listed here, its goal set wins over GOAL_TRACK_MAP[track].
const SUB_PERSONA_GOAL_MAP: Record<string, string[]> = {
  competitive_aspirant: ['clarity', 'exam'],
  jee_aspirant:         ['clarity', 'exam'],
  neet_aspirant:        ['clarity', 'exam'],
  cuet_aspirant:        ['clarity', 'exam'],
  upsc_aspirant:        ['clarity', 'exam'],
};

// Resolve the allowed goal ids for the current (track, sub-persona) selection.
// A sub-persona override wins; otherwise fall back to the track default; with
// nothing chosen, every goal is allowed.
function allowedGoalIds(
  tId: MacroTrackData['id'] | null,
  sId: string | null,
): string[] {
  if (sId && SUB_PERSONA_GOAL_MAP[sId]) return SUB_PERSONA_GOAL_MAP[sId];
  return tId ? (GOAL_TRACK_MAP[tId] || []) : GOAL_OPTIONS.map((g) => g.id);
}

const TIMELINE_OPTIONS: { id: string; label: string }[] = [
  { id: 'immediate', label: 'Right away (0–1 month)' },
  { id: 'short', label: 'Soon (1–3 months)' },
  { id: 'medium', label: 'This year (3–12 months)' },
  { id: 'exploring', label: 'Just exploring' },
];

const FOCUS_OPTIONS: { id: string; label: string }[] = [
  { id: 'confidence', label: 'Confidence & mindset' },
  { id: 'skills', label: 'Skills & competencies' },
  { id: 'decisions', label: 'Decision-making' },
  { id: 'wellbeing', label: 'Focus & well-being' },
  { id: 'relationships', label: 'Communication & relationships' },
];

interface ResolvedRoute {
  resolved: boolean;
  reason?: string;
  journey?: { key: string; label: string; persona: string; definition: string; status: string; statusNote: string | null };
  lifecycle?: { entryStage: { code: string; label: string | null } | null; stages: { code: string; label: string | null }[] };
  assessments?: { key: string; label: string; status: string }[];
  dashboards?: string;
  reports?: string;
  recommendations?: string;
  learningJourney?: string;
  outcomes?: string;
}

export interface PersonaJourneyWizardProps {
  personaModelAlignment: boolean;
  personaModelExpansion: boolean;
  setPrimaryPersona: (v: string | null) => void;
  setSelectedPersona: (v: PersonaKey | null) => void;
  setIsProxy: (v: boolean) => void;
  setAgeBand: (v: string) => void;
  setParticipantGoal: (v: string) => void;
  setGoalTimeline: (v: string) => void;
  onComplete: () => void;
  onNavigate?: (screen: string) => void;
  onClose: () => void;
}

const STEPS = ['Who', 'Refine', 'Goal', 'Personalize', 'Your journey'];

export function PersonaJourneyWizard(props: PersonaJourneyWizardProps) {
  const {
    personaModelAlignment, personaModelExpansion,
    setPrimaryPersona, setSelectedPersona, setIsProxy, setAgeBand,
    setParticipantGoal, setGoalTimeline, onComplete, onNavigate, onClose,
  } = props;

  const tracks = React.useMemo(
    () => buildTrackGroups({ alignment: !!personaModelAlignment, expansion: !!personaModelExpansion }),
    [personaModelAlignment, personaModelExpansion],
  );

  const [step, setStep] = React.useState(0);
  const [trackId, setTrackId] = React.useState<MacroTrackData['id'] | null>(null);
  const [subId, setSubId] = React.useState<string | null>(null);
  const [band, setBand] = React.useState<AgeBand | ''>('');
  const [goal, setGoal] = React.useState('');
  const [timeline, setTimeline] = React.useState('');
  const [focus, setFocus] = React.useState('');
  const [search, setSearch] = React.useState('');

  const [route, setRoute] = React.useState<ResolvedRoute | null>(null);
  const [routeLoading, setRouteLoading] = React.useState(false);
  const [routeError, setRouteError] = React.useState(false);

  const headingRef = React.useRef<HTMLHeadingElement | null>(null);

  // ── Autosave / resume ──────────────────────────────────────────────────
  const hydrated = React.useRef(false);
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && typeof s === 'object') {
          if (typeof s.trackId === 'string') setTrackId(s.trackId);
          if (typeof s.subId === 'string') setSubId(s.subId);
          if (typeof s.band === 'string') setBand(s.band);
          if (typeof s.goal === 'string') setGoal(s.goal);
          if (typeof s.timeline === 'string') setTimeline(s.timeline);
          if (typeof s.focus === 'string') setFocus(s.focus);
          if (typeof s.step === 'number' && s.step >= 0 && s.step <= 4) setStep(s.step);
        }
      }
    } catch { /* ignore corrupt state */ }
    hydrated.current = true;
  }, []);

  React.useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ trackId, subId, band, goal, timeline, focus, step }));
    } catch { /* quota / private mode — non-fatal */ }
  }, [trackId, subId, band, goal, timeline, focus, step]);

  // Move focus to the step heading on step change (a11y).
  React.useEffect(() => { headingRef.current?.focus(); }, [step]);

  // Conditional goal filter: goals shown depend on the chosen track, and a goal
  // that no longer applies (e.g. picked "growth" then switched to a school child)
  // is cleared so a stale, irrelevant selection can't carry forward.
  const visibleGoals = React.useMemo(
    () => {
      const allowed = allowedGoalIds(trackId, subId);
      return GOAL_OPTIONS.filter((g) => allowed.includes(g.id));
    },
    [trackId, subId],
  );
  React.useEffect(() => {
    if (goal && !allowedGoalIds(trackId, subId).includes(goal)) setGoal('');
  }, [trackId, subId, goal]);

  const activeTrack = tracks.find((t) => t.id === trackId) || null;
  const activeSub: SubPersona | null =
    activeTrack?.subPersonas.find((sp) => sp.id === subId) || null;
  const allowedBands: AgeBand[] = activeSub?.ageBands ?? [];
  // For proxy personas (parent/teacher/counsellor) the age band is the age of the
  // person being assessed — NOT the proxy's own age. A bare "Age group" heading
  // reads as the parent's age, so reframe it to who the age actually refers to.
  const ageGroupHeading = !activeTrack?.isProxy
    ? 'Age group'
    : activeSub?.id === 'parent'
      ? "Your child's age group"
      : "Age group of the person you're assessing";

  // Cross-track sub-persona search (Steps 1 & 2).
  const searchResults = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const out: { track: MacroTrackData; sp: SubPersona }[] = [];
    for (const t of tracks) {
      for (const sp of t.subPersonas) {
        if (sp.label.toLowerCase().includes(q) || t.title.toLowerCase().includes(q)) {
          out.push({ track: t, sp });
        }
      }
    }
    return out.slice(0, 8);
  }, [search, tracks]);

  function pickSearchResult(t: MacroTrackData, sp: SubPersona) {
    setTrackId(t.id);
    setSubId(sp.id);
    setBand(sp.ageBands.length === 1 ? sp.ageBands[0] : '');
    setSearch('');
    setStep(2);
  }

  async function resolveJourney() {
    if (!activeSub) return;
    setRouteLoading(true);
    setRouteError(false);
    setRoute(null);
    try {
      const qs = new URLSearchParams({
        legacyKey: activeSub.legacyKey,
        persona: activeSub.id,
        ageBand: band || '',
        goal: goal || '',
        timeline: timeline || '',
      });
      const res = await fetch(`/api/persona-journey/route?${qs.toString()}`, { credentials: 'include' });
      if (!res.ok) { setRouteError(true); return; }
      const data = await res.json();
      setRoute(data as ResolvedRoute);
    } catch {
      setRouteError(true);
    } finally {
      setRouteLoading(false);
    }
  }

  // When entering the final step, resolve the deterministic journey.
  React.useEffect(() => {
    if (step === 4 && activeSub) { void resolveJourney(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function handleFinish() {
    if (!activeSub || !activeTrack) return;
    // Write resolved selection into the existing modal state (single taxonomy — legacyKey
    // keeps every downstream phase working off the PersonaKey union).
    setPrimaryPersona(activeSub.id);
    setSelectedPersona(activeSub.legacyKey);
    setIsProxy(activeTrack.isProxy);
    setAgeBand(band && isCanonicalAgeBand(band) ? band : '');
    const goalLabel = GOAL_OPTIONS.find((g) => g.id === goal)?.label || goal || '';
    setParticipantGoal(focus ? `${goalLabel}${goalLabel ? ' — ' : ''}${FOCUS_OPTIONS.find((f) => f.id === focus)?.label || ''}` : goalLabel);
    setGoalTimeline(TIMELINE_OPTIONS.find((tl) => tl.id === timeline)?.label || timeline || '');
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* non-fatal */ }
    onComplete();
  }

  function routeB2B(screen: string) {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* non-fatal */ }
    onClose();
    onNavigate?.(screen);
  }

  // ── step gating ────────────────────────────────────────────────────────
  const canNext =
    step === 0 ? !!trackId :
    step === 1 ? (!!subId && !!band && isCanonicalAgeBand(band)) :
    step === 2 ? !!goal :
    step === 3 ? true :
    true;

  function next() {
    if (step === 0 && trackId && activeTrack) {
      // auto-select if the track has a single sub-persona
      if (activeTrack.subPersonas.length === 1 && !subId) {
        const only = activeTrack.subPersonas[0];
        setSubId(only.id);
        if (only.ageBands.length === 1) setBand(only.ageBands[0]);
      }
    }
    setStep((s) => Math.min(4, s + 1));
  }
  function back() { setStep((s) => Math.max(0, s - 1)); }

  // Step 0 is a single-choice step: picking "who this is for" is the entire task,
  // so a click both selects the track AND advances to Refine — no extra Continue
  // hop. This matches the immediate behaviour of the search results and the B2B
  // cards. Back still returns here with the selection intact.
  function selectTrackAndAdvance(t: MacroTrackData) {
    setTrackId(t.id);
    // Drop a stale sub-persona/band that belonged to a different track.
    if (subId && !t.subPersonas.some((sp) => sp.id === subId)) { setSubId(null); setBand(''); }
    // Auto-pick the sub-persona (and its age band) when the track has exactly one.
    if (t.subPersonas.length === 1) {
      const only = t.subPersonas[0];
      setSubId(only.id);
      if (only.ageBands.length === 1) setBand(only.ageBands[0]);
    }
    setSearch('');
    setStep(1);
  }

  return (
    <div className="flex flex-col max-h-[95vh]" data-testid="persona-journey-wizard">
      {/* Header + progress */}
      <div className="px-6 pt-6 pb-4 border-b border-slate-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: BRAND_TEAL }}>
              <Sparkles size={14} /> Personalized onboarding
            </div>
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="mt-1 text-[20px] font-bold outline-none"
              style={{ color: BRAND_DEEP }}
            >
              {step === 0 && 'Who is taking this assessment?'}
              {step === 1 && 'Let’s refine that'}
              {step === 2 && 'What’s your main goal?'}
              {step === 3 && 'Personalize your experience'}
              {step === 4 && 'Your intelligent journey'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stepper */}
        <div className="mt-4 flex items-center gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={5} aria-valuenow={step + 1} aria-label={`Step ${step + 1} of 5: ${STEPS[step]}`}>
          {STEPS.map((label, i) => (
            <div key={label} className="flex-1 flex flex-col gap-1">
              <div
                className="h-1.5 rounded-full transition-all duration-300"
                style={{ background: i <= step ? BRAND_DEEP : '#e2e8f0' }}
              />
              <span className={`text-[10px] font-medium transition-colors ${i === step ? '' : 'text-slate-400'}`} style={{ color: i === step ? BRAND_DEEP : undefined }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-5 overflow-y-auto flex-1">
        {/* STEP 1 — WHO */}
        {step === 0 && (
          <div className="animate-in fade-in duration-200">
            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  // Enter jumps straight to the top match — no need to reach for the mouse.
                  if (e.key === 'Enter' && searchResults.length > 0) {
                    e.preventDefault();
                    const top = searchResults[0];
                    pickSearchResult(top.track, top.sp);
                  }
                }}
                placeholder="Search (e.g. college student, manager, parent)…"
                aria-label="Search personas"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-[14px] focus:outline-none focus:ring-2"
                style={{ ['--tw-ring-color' as string]: BRAND_DEEP }}
              />
              {searchResults.length > 0 && (
                <div className="absolute z-10 left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
                  {searchResults.map(({ track, sp }) => (
                    <button
                      key={`${track.id}:${sp.id}`}
                      type="button"
                      onClick={() => pickSearchResult(track, sp)}
                      className="w-full text-left px-3 py-2 text-[13px] hover:bg-slate-50 flex items-center justify-between"
                    >
                      <span className="font-medium text-slate-700">{sp.label}</span>
                      <span className="text-[11px] text-slate-400">{track.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {tracks.map((t) => {
                const Icon = TRACK_ICON[t.id];
                const selected = trackId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => selectTrackAndAdvance(t)}
                    aria-pressed={selected}
                    className="group text-left p-4 rounded-2xl border-2 transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2"
                    style={{ borderColor: selected ? BRAND_DEEP : '#e2e8f0', background: selected ? '#f5f8ff' : '#fff', ['--tw-ring-color' as string]: BRAND_DEEP }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors" style={{ background: selected ? BRAND_DEEP : '#f1f5f9', color: selected ? '#fff' : BRAND_DEEP }}>
                        <Icon size={20} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-[14px] text-slate-800">{t.title}</div>
                        <div className="text-[12px] text-slate-500">{t.subtitle}</div>
                      </div>
                      {selected
                        ? <Check size={18} className="ml-auto flex-shrink-0" style={{ color: BRAND_DEEP }} />
                        : <ArrowRight size={16} className="ml-auto flex-shrink-0 text-slate-300 transition-all group-hover:text-slate-400 group-hover:translate-x-0.5" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* B2B / admin exits */}
            <div className="mt-6 pt-5 border-t border-slate-100">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Not taking the assessment yourself?
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {B2B_DESTINATIONS.map((d) => {
                  const Icon = d.icon;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => routeB2B(d.screen)}
                      className="text-left p-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                    >
                      <Icon size={16} style={{ color: BRAND_TEAL }} />
                      <div className="mt-1.5 font-medium text-[12.5px] text-slate-700">{d.label}</div>
                      <div className="text-[11px] text-slate-400">{d.sub}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2 — REFINE */}
        {step === 1 && activeTrack && (
          <div className="animate-in fade-in duration-200 space-y-5">
            <div>
              <div className="text-[12px] font-semibold text-slate-500 mb-2">Which best describes you?</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activeTrack.subPersonas.map((sp) => {
                  const selected = subId === sp.id;
                  return (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() => { setSubId(sp.id); setBand(sp.ageBands.length === 1 ? sp.ageBands[0] : ''); }}
                      aria-pressed={selected}
                      className="text-left px-3.5 py-2.5 rounded-xl border-2 text-[13.5px] font-medium transition-all"
                      style={{ borderColor: selected ? BRAND_DEEP : '#e2e8f0', background: selected ? '#f5f8ff' : '#fff', color: selected ? BRAND_DEEP : '#334155' }}
                    >
                      <span className="flex items-center justify-between gap-2">
                        {sp.label}
                        {selected && <Check size={15} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {activeSub && (
              <div>
                <div className="text-[12px] font-semibold text-slate-500 mb-2">{ageGroupHeading}</div>
                <div className="flex flex-wrap gap-2">
                  {(allowedBands.length ? allowedBands : (AGE_BANDS as readonly AgeBand[])).map((b) => {
                    const selected = band === b;
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setBand(b)}
                        aria-pressed={selected}
                        className="px-3 py-2 rounded-lg border-2 text-[12.5px] font-medium transition-all"
                        style={{ borderColor: selected ? BRAND_TEAL : '#e2e8f0', background: selected ? '#effcf9' : '#fff', color: selected ? BRAND_TEAL : '#475569' }}
                      >
                        {AGE_BAND_LABEL[b]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3 — GOAL */}
        {step === 2 && (
          <div className="animate-in fade-in duration-200 space-y-5">
            <div>
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-500 mb-2"><Target size={13} /> My main goal</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {visibleGoals.map((g) => {
                  const selected = goal === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setGoal(g.id)}
                      aria-pressed={selected}
                      className="text-left px-3.5 py-2.5 rounded-xl border-2 text-[13.5px] font-medium transition-all"
                      style={{ borderColor: selected ? BRAND_DEEP : '#e2e8f0', background: selected ? '#f5f8ff' : '#fff', color: selected ? BRAND_DEEP : '#334155' }}
                    >
                      <span className="flex items-center justify-between gap-2">{g.label}{selected && <Check size={15} />}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-500 mb-2"><Clock size={13} /> Timeline <span className="font-normal text-slate-400">(optional)</span></div>
              <div className="flex flex-wrap gap-2">
                {TIMELINE_OPTIONS.map((tl) => {
                  const selected = timeline === tl.id;
                  return (
                    <button
                      key={tl.id}
                      type="button"
                      onClick={() => setTimeline(selected ? '' : tl.id)}
                      aria-pressed={selected}
                      className="px-3 py-2 rounded-lg border-2 text-[12.5px] font-medium transition-all"
                      style={{ borderColor: selected ? BRAND_TEAL : '#e2e8f0', background: selected ? '#effcf9' : '#fff', color: selected ? BRAND_TEAL : '#475569' }}
                    >
                      {tl.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP 4 — PERSONALIZE */}
        {step === 3 && (
          <div className="animate-in fade-in duration-200 space-y-4">
            <p className="text-[13px] text-slate-500">
              Optional — pick what matters most right now. This tailors your report’s emphasis. You can skip this.
            </p>
            <div className="flex flex-wrap gap-2">
              {FOCUS_OPTIONS.map((f) => {
                const selected = focus === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFocus(selected ? '' : f.id)}
                    aria-pressed={selected}
                    className="px-3.5 py-2.5 rounded-xl border-2 text-[13px] font-medium transition-all"
                    style={{ borderColor: selected ? BRAND_DEEP : '#e2e8f0', background: selected ? '#f5f8ff' : '#fff', color: selected ? BRAND_DEEP : '#334155' }}
                  >
                    <span className="flex items-center gap-2">{selected && <Check size={14} />}{f.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 5 — AI JOURNEY ROUTER */}
        {step === 4 && (
          <div className="animate-in fade-in duration-200">
            {routeLoading && (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-500">
                <Loader2 size={28} className="animate-spin" style={{ color: BRAND_DEEP }} />
                <p className="text-[13px]">Mapping your intelligent journey…</p>
              </div>
            )}

            {!routeLoading && (routeError || (route && !route.resolved)) && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
                <AlertCircle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-[13px] text-amber-800">
                  We couldn’t map a tailored journey for this selection, but you can still begin your
                  assessment — it adapts to your answers as you go.
                </div>
              </div>
            )}

            {!routeLoading && route && route.resolved && route.journey && (
              <div className="space-y-4">
                <div className="rounded-2xl p-4 text-white" style={{ background: `linear-gradient(135deg, ${BRAND_DEEP}, ${BRAND_TEAL})` }}>
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider opacity-90">
                    <Route size={14} /> Recommended journey
                  </div>
                  <div className="mt-1 text-[18px] font-bold">{route.journey.label}</div>
                  <div className="text-[12.5px] opacity-90 mt-0.5">{route.journey.definition}</div>
                </div>

                {/* Lifecycle spine */}
                {route.lifecycle && route.lifecycle.stages.length > 0 && (
                  <div className="rounded-xl border border-slate-200 p-3.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Your growth stages</div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {route.lifecycle.stages.map((s, i) => (
                        <React.Fragment key={s.code}>
                          <span className="px-2.5 py-1 rounded-lg text-[12px] font-medium" style={{ background: '#f1f5f9', color: BRAND_DEEP }}>
                            {s.label || s.code}
                          </span>
                          {i < route.lifecycle!.stages.length - 1 && <ArrowRight size={13} className="text-slate-300" />}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {route.assessments && route.assessments.length > 0 && (
                    <InfoCard icon={ClipboardList} title="Assessments">
                      <div className="flex flex-wrap gap-1.5">
                        {route.assessments.map((a) => (
                          <span key={a.key} className="px-2 py-0.5 rounded text-[11.5px]" style={{ background: '#eef2ff', color: BRAND_DEEP }}>{a.label}</span>
                        ))}
                      </div>
                    </InfoCard>
                  )}
                  {route.recommendations && (
                    <InfoCard icon={Lightbulb} title="Recommendations">{route.recommendations}</InfoCard>
                  )}
                  {route.dashboards && (
                    <InfoCard icon={LayoutDashboard} title="Dashboards">{route.dashboards}</InfoCard>
                  )}
                  {route.reports && (
                    <InfoCard icon={FileText} title="Reports">{route.reports}</InfoCard>
                  )}
                </div>

                {route.journey.statusNote && (
                  <p className="text-[11.5px] text-slate-400 leading-relaxed">
                    <span className="font-semibold text-slate-500">Note:</span> {route.journey.statusNote}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer nav */}
      <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={back}
          disabled={step === 0}
          className="flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-800 disabled:opacity-0 disabled:pointer-events-none transition-colors"
        >
          <ArrowLeft size={15} /> Back
        </button>

        {step < 4 ? (
          <Button
            onClick={next}
            disabled={!canNext}
            className="rounded-xl px-5 h-10 text-[14px] font-semibold text-white disabled:opacity-50"
            style={{ background: BRAND_DEEP }}
          >
            Continue <ArrowRight size={16} className="ml-1.5" />
          </Button>
        ) : (
          <Button
            onClick={handleFinish}
            disabled={routeLoading}
            className="rounded-xl px-5 h-10 text-[14px] font-semibold text-white disabled:opacity-50"
            style={{ background: BRAND_TEAL }}
            data-testid="wizard-start-assessment"
          >
            Start my assessment <ArrowRight size={16} className="ml-1.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, title, children }: { icon: React.ComponentType<{ size?: number; className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
        <Icon size={13} /> {title}
      </div>
      <div className="text-[12.5px] text-slate-600 leading-snug">{children}</div>
    </div>
  );
}
