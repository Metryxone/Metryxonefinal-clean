import React from 'react';
import metryxLogo from '@/assets/metryx-logo-transparent.png';
import { AlertCircle, ArrowRight, Brain, Briefcase, Check, CheckCircle, ChevronDown, ChevronUp, Clock, EyeOff, FileText, GraduationCap, KeyRound, Lock, Mail, MessageCircle, Phone, School, Search, Shield, Target, TrendingUp, Users, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BRAND, CAPADEX_STAGES, FAM_TERMS, PERSONAS, getAgeRange } from '@/lib/behavioural-insights';

import { PhaseProps } from '../types';
import { searchLocations } from '@/data/catalogs/locations';
import { readPragatiHandoff, clearPragatiHandoff } from '@/lib/pragatiBridge';
// ── Canonical persona taxonomy (SINGLE SOURCE) ───────────────────────────
// AGE_BANDS / AgeBand / AGE_BAND_LABEL / SubPersona / MacroTrackData /
// buildTrackGroups + dash-normalisation helpers now live in the shared
// persona-taxonomy module so IntroPhase and the Phase 3.2A onboarding wizard
// consume ONE taxonomy (no fork). Icons stay a per-consumer UI concern.
import {
  AGE_BANDS, type AgeBand, AGE_BAND_LABEL, buildTrackGroups,
  type SubPersona, type MacroTrackData, normaliseDash, isCanonicalAgeBand,
} from '@/lib/persona-taxonomy';

// Parse any age-range string into a numeric [min, max] interval. Handles the
// canonical bands (`17-24`), the open-ended `45+`, and the arbitrary numeric
// ranges the server derives for master rows (`MIN(age_min)-MAX(age_max)`, e.g.
// `18-24`, `10-17`). Returns null when no digits can be recovered so callers
// degrade to "show the row" rather than mis-filtering.
const parseAgeRange = (s: string): [number, number] | null => {
  const nums = (normaliseDash(String(s || '')).match(/\d+/g) || []).map(Number);
  if (nums.length === 0) return null;
  if (/\+/.test(s)) return [nums[0], 200];
  return nums.length === 1 ? [nums[0], nums[0]] : [nums[0], nums[nums.length - 1]];
};

export function IntroPhase(props: PhaseProps) {
  const {
    phase, setPhase, selectedPersona, setSelectedPersona, currentQ, setCurrentQ,
    answers, setAnswers, participantName, setParticipantName, contextField, setContextField,
    regEmail, setRegEmail, selectedConcern, setSelectedConcern, selectedConcerns, setSelectedConcerns, concernSearch,
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
    handleCapadexOtpVerify, handleCapadexOtpResend, questions, persona: _legacyPersona, computeResults,
    deepLinkError, concernWrapRef, setConcernLoading, setConcernSuggestions,
    introEmailStatus, introEmailName, introEmailVerified, introOtpSent,
    introOtpDigits, setIntroOtpDigits, introOtpLoading, introOtpError,
    introOtpTimer, introOtpRefs,
    handleIntroEmailCheck, handleIntroSendOtp, handleIntroOtpVerify, handleIntroOtpResend,
    returningIntent, setReturningIntent,
    savedSession, handleResumeSession, handleDismissResume,
    incompleteSession, continueLoading, handleContinueIncomplete, handleStartFresh,
    recentSessions, recentSessionsLoading, handleLoadPreviousReport,
    capadexPricing, handleUnlockRequest,
  } = props;

  const [emailInvalid, setEmailInvalid] = React.useState(false);
  // Flips to true the first time the user attempts to submit while the form
  // has any missing required field. Drives red-border + inline-hint feedback
  // on persona / name / age / concern so the user knows WHY the CTA is dim
  // instead of just seeing a greyed-out button with no explanation.
  const [triedSubmit, setTriedSubmit] = React.useState(false);
  // ── School-children consent / anonymity gate ───────────────────────────────
  // anonymousChild → child's name is hidden from the report (email/OTP still
  // required). Otherwise a full guardian sign-off is mandatory before start.
  const [anonymousChild, setAnonymousChild] = React.useState(false);
  const [guardianName, setGuardianName] = React.useState('');
  const [guardianRelationship, setGuardianRelationship] = React.useState('');
  const [consentAccepted, setConsentAccepted] = React.useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Pragati → assessment handoff: inline toast shown after pre-hydration.
  const [handoffToast, setHandoffToast] = React.useState<string | null>(null);
  const hydratedRef = React.useRef(false);
  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // ── PERSONA ARCHITECTURE (2026-05-28 overhaul) ──────────────────────
  // 3 macro-tracks × 11 granular sub-personas, modeled after CAPADEX
  // concerns.xlsx relational matrix. Each leaf carries `legacyKey` so
  // downstream phases (analyze → clarify → questions → result) keep
  // working off the existing PersonaKey union (student/teacher/campus/
  // jobseeker/parent/professional). New `is_proxy` flag flows directly
  // into the /analyze payload envelope.
  // AgeBand / AGE_BANDS / AGE_BAND_LABEL / SubPersona / MacroTrackData /
  // buildTrackGroups now live in the shared persona-taxonomy module (single
  // source). We map each track id → its lucide icon here (UI concern) and
  // build the flag-gated groups exactly as before, so OFF is byte-identical.
  const TRACK_ICON: Record<MacroTrackData['id'], React.ComponentType<{ size?: number; className?: string }>> = {
    school: School, learner: GraduationCap, professional: Briefcase, proxy: Users,
  };
  type MacroTrack = MacroTrackData & { icon: React.ComponentType<{ size?: number; className?: string }> };
  const TRACK_GROUPS: MacroTrack[] = buildTrackGroups({
    alignment: !!props.personaModelAlignment,
    expansion: !!props.personaModelExpansion,
  }).map((t) => ({ ...t, icon: TRACK_ICON[t.id] }));
  const ALL_SUB_PERSONAS = TRACK_GROUPS.flatMap(t => t.subPersonas.map(sp => ({ ...sp, trackId: t.id, isProxy: t.isProxy })));

  // ── Granular state (sub-persona + age band) ─────────────────────────
  // Lifted to FreeAssessmentModal so the /analyze payload envelope can ship
  // the canonical spec fields. selectedPersona (legacy PersonaKey) is kept
  // derived for downstream phase back-compat.
  const {
    primaryPersona, setPrimaryPersona, setIsProxy, ageBand, setAgeBand, concernMetaMap, setConcernMetaMap, concernPersonaFallback,
    participantGender, setParticipantGender, participantCity, setParticipantCity,
    participantGoal, setParticipantGoal, goalTimeline, setGoalTimeline,
  } = props;
  const activeSub = primaryPersona ? ALL_SUB_PERSONAS.find(s => s.id === primaryPersona) ?? null : null;
  const isProxy: boolean = !!activeSub?.isProxy;
  const isSchoolChild: boolean = (activeSub as { trackId?: string } | null)?.trackId === 'school';
  const consentRequired: boolean = isSchoolChild && !anonymousChild;
  React.useEffect(() => { setIsProxy(isProxy); }, [isProxy, setIsProxy]);

  // ── Progressive-disclosure accordion: only one track open at a time.
  //    Default collapsed for a clean first impression; auto-opens the
  //    track containing the current selection on mount / persona change.
  // Surface options upfront: open the first track by default when nothing is
  // selected yet (auto-jumps to the selection's track on persona change).
  const [expandedTrack, setExpandedTrack] = React.useState<MacroTrack['id'] | null>(
    activeSub?.trackId ?? 'learner'
  );
  React.useEffect(() => {
    if (activeSub?.trackId) setExpandedTrack(activeSub.trackId);
  }, [activeSub?.trackId]);

  // ── Focus mode: once a persona is locked in, collapse the OTHER tracks out
  //    of sight so an irrelevant cohort (e.g. "Working professionals" for a
  //    school student) never crowds the core form. "Change" re-opens the full
  //    list. Works identically for every track — pick one, the rest vanish.
  const [changingPersona, setChangingPersona] = React.useState(false);
  const hasPersonaSelection = !!activeSub;
  const showAllTracks = !hasPersonaSelection || changingPersona;
  const visibleTracks = showAllTracks
    ? TRACK_GROUPS
    : TRACK_GROUPS.filter(t => t.id === activeSub?.trackId);

  // ── Per-sub-persona field copy ──────────────────────────────────────
  // f2 (institution/context field) adapts to each sub-persona so a JEE
  // aspirant doesn't see "field, role or industry" and a parent doesn't
  // see "your workplace". Falls back to a friendly default if no override.
  type PersonaCfg = {
    f1Label: string; f1Placeholder: string;
    f2Label: string; f2Placeholder: string;
    concernHeader: string; concernPlaceholder: string;
    goalPlaceholder: string;
  };
  // Per-sub-persona example copy so the goal + friction placeholders speak to
  // the exact cohort (a JEE aspirant doesn't see "crack campus placements",
  // a parent sees behaviours they'd notice in their child, etc.).
  const SUB_PERSONA_EXAMPLES: Record<string, { goal: string; concern: string }> = {
    // Learner track
    campus_student:            { goal: 'e.g. crack campus placements',           concern: 'e.g. exam stress, procrastination, scrolling instead of studying, placement nerves' },
    competitive_aspirant:      { goal: 'e.g. clear JEE Advanced or NEET',        concern: 'e.g. exam anxiety, falling mock scores, burnout, phone distraction' },
    career_explorer:           { goal: 'e.g. find the right career direction',   concern: 'e.g. career confusion, lack of direction, low motivation, self-doubt' },
    skill_development_learner: { goal: 'e.g. become job-ready in data analytics', concern: 'e.g. inconsistent practice, losing focus, no feedback, slow progress' },
    // Professional track
    early_career_professional:      { goal: 'e.g. earn my next promotion',          concern: 'e.g. imposter syndrome, work overload, unclear feedback, low confidence' },
    mid_career_professional:        { goal: 'e.g. step into a leadership role',     concern: 'e.g. career stagnation, work-life balance, team friction, burnout' },
    career_transition_professional: { goal: 'e.g. switch into product management', concern: 'e.g. transition anxiety, skill gaps, fear of starting over, uncertainty' },
    // Proxy track
    parent:                { goal: 'e.g. help them focus on studies',         concern: 'e.g. exam anxiety, screen-time / scrolling, low motivation, mood swings' },
    teacher_educator:      { goal: 'e.g. lift their classroom engagement',     concern: 'e.g. inattention, low participation, exam stress, peer pressure' },
    academic_counsellor:   { goal: 'e.g. guide them to the right stream',      concern: 'e.g. career confusion, exam anxiety, indecision, low confidence' },
    placement_career_cell: { goal: 'e.g. improve their placement readiness',   concern: 'e.g. interview anxiety, low confidence, aptitude gaps, communication blocks' },
  };
  const exampleOverride = activeSub ? SUB_PERSONA_EXAMPLES[activeSub.id] : undefined;
  const SUB_PERSONA_F2: Record<string, { label: string; placeholder: string }> = {
    // Learner track
    campus_student:            { label: 'Your college & course',           placeholder: 'e.g. Delhi University · B.A. Economics' },
    competitive_aspirant:      { label: 'Exam & coaching (if any)',        placeholder: 'e.g. JEE Advanced · Allen, Kota' },
    career_explorer:           { label: 'What you\u2019re studying or last did', placeholder: 'e.g. B.Tech CSE · final year, or recent grad' },
    skill_development_learner: { label: 'Skill you\u2019re building',          placeholder: 'e.g. Data Analytics, UI/UX, Spoken English' },
    // Professional track
    early_career_professional:     { label: 'Your role & industry',  placeholder: 'e.g. SDE-1 · IT Services' },
    mid_career_professional:       { label: 'Your role & industry',  placeholder: 'e.g. Product Manager · FinTech' },
    career_transition_professional:{ label: 'Where you\u2019re moving from \u2192 to', placeholder: 'e.g. Banking \u2192 Product Management' },
    // Proxy track
    parent:               { label: 'Their school & class',             placeholder: 'e.g. DPS Noida · Class 8' },
    teacher_educator:     { label: 'Your school or institution',       placeholder: 'e.g. KV Bengaluru · Senior School' },
    academic_counsellor:  { label: 'Your school, college or practice', placeholder: 'e.g. Sri Chaitanya · counselling cell' },
    placement_career_cell:{ label: 'Your college / TPO cell',          placeholder: 'e.g. NIT Trichy · TPO' },
  };
  const f2Override = activeSub ? SUB_PERSONA_F2[activeSub.id] : undefined;
  const personaCfg: PersonaCfg = isProxy
    ? {
        f1Label: 'Their name (or initials)',
        f1Placeholder: 'e.g. Aarav, Neha, or just A.K.',
        f2Label: f2Override?.label ?? 'Their school, college or workplace',
        f2Placeholder: f2Override?.placeholder ?? 'e.g. DPS Noida · Class 8, IIT Bombay, Infosys',
        concernHeader: 'What behaviour or performance patterns are you noticing in them?',
        concernPlaceholder: exampleOverride?.concern ?? 'e.g. exam anxiety, digital distraction / scrolling, low motivation, mood swings',
        goalPlaceholder: exampleOverride?.goal ?? 'e.g. help them stay focused and confident',
      }
    : {
        f1Label: 'Your name',
        f1Placeholder: 'e.g. Vikram, Neha',
        f2Label: f2Override?.label ?? 'Your context (school, role or industry)',
        f2Placeholder: f2Override?.placeholder ?? 'e.g. IIT Bombay · final year, or Product Manager · FinTech',
        concernHeader: 'What\u2019s the friction, focus block or stress you\u2019re facing right now?',
        concernPlaceholder: exampleOverride?.concern ?? 'e.g. exam anxiety, digital distraction / scrolling, workplace career friction, placement readiness stress',
        goalPlaceholder: exampleOverride?.goal ?? 'e.g. reach my next career milestone',
      };

  // ── Real-time ontology mapping preview (300ms debounce) ─────────────
  // 2026-05-28 overhaul: new "[ 🔍 Core Domain: ... ]" chip format mirroring
  // the CAPADEX backend bridge-tag classifier, plus a secondary "Context
  // Alert" line for sociocultural performance amplifiers (Indian coaching/
  // placement/JEE/NEET vocabulary). Server-side `resolveCapadexConcern`
  // still runs on submit — this is UX preview only.
  // ── Headline "Mapped to" chip ──────────────────────────────────────────
  // BEFORE: hardcoded regex → fixed labels like "Career Readiness & Transition
  // Stress" that did NOT exist in the 2,488-row master taxonomy, so tapping the
  // chip routed analyze() into the keyword-fallback path and the user received
  // generic clarity-bank questions instead of concern-specific ones.
  // NOW: derive the chip from the TOP master-search result so its label, click
  // target, and `concern_id` all come from the same canonical source. When the
  // backend returns no master rows we fall back to a neutral "general matrix"
  // hint (no fake routing). Sociocultural amplifier flag (Indian coaching /
  // placement vocabulary) remains regex-driven — it's a UX cue, not a router.
  // `key` is the canonical concern_area/domain used for routing + dedupe.
  // `label` is the user-facing display text (curated `display_label` →
  // concern_cluster → key fallback). The split prevents display copy from
  // leaking into the selected-concerns identifier set.
  const [ontologyPreview, setOntologyPreview] = React.useState<
    { key: string; label: string; tone: 'violet' | 'amber' | 'slate'; meta?: { concern_id?: string; domain?: string; concern_cluster?: string; typical_age_band?: string; growth_trend?: string; severity?: string } } | null
  >(null);
  const [socioAlert, setSocioAlert] = React.useState<boolean>(false);
  React.useEffect(() => {
    const text = concernSearch.trim();
    if (!text) { setOntologyPreview(null); setSocioAlert(false); return; }
    const lower = text.toLowerCase();
    // Top suggestion drives the headline chip when backend has resolved a match
    const top: any = concernSuggestions[0];
    if (top && top.concern_area) {
      const isMaster = top.source === 'master';
      const tone: 'violet' | 'amber' | 'slate' = isMaster
        ? (/(scroll|screen|game|phone|tablet|tiktok|instagram|youtube|gadget|distract|regulat)/i.test(top.concern_area + ' ' + (top.concern_cluster || '')) ? 'violet' : 'amber')
        : 'slate';
      // 2026-05-28 — prefer curated `display_label` for the user-facing pill;
      // fall back to concern_cluster → concern_area so we never show NULL.
      // The internal `domain` (e.g. "Placement Risk Intelligence") stays in
      // `meta` so analyze() routes against the canonical taxonomy.
      const userLabel = top.display_label || top.concern_cluster || top.concern_area;
      // Canonical routing key — always the master taxonomy `concern_area`
      // (= domain). Display copy never leaks into this identifier so dedupe
      // (`selectedConcerns.includes(key)`) stays consistent with the
      // dropdown-add path which also keys on `concern_area`.
      const routingKey = top.concern_area || top.domain || userLabel;
      setOntologyPreview({
        key: routingKey,
        label: userLabel,
        tone,
        meta: isMaster ? {
          concern_id: top.concern_id,
          domain: top.domain ?? top.concern_area,
          concern_cluster: top.concern_cluster ?? top.impact_on_child,
          typical_age_band: top.typical_age_band,
          growth_trend: top.growth_trend,
          severity: top.severity,
        } : undefined,
      });
    } else if (concernLoading) {
      // Hide the chip while the request is in flight so we never flash a stale
      // value from a previous query.
      setOntologyPreview(null);
    } else {
      // Backend returned 0 master/legacy hits — neutral hint, no fake routing.
      // Key matches label since there's no canonical taxonomy row to route to;
      // this branch is purely informational and the pill won't add cleanly.
      setOntologyPreview({ key: text, label: 'General Behavioural Alignment Matrix', tone: 'slate' });
    }
    // Sociocultural amplifier — Indian-context performance pressure cues
    setSocioAlert(/(coach|coaching|tuition|jee|neet|upsc|gate|cat|iit|iim|kota|drishti|byjus|allen|fiitjee|aakash|placement|scaling|tracking|rank|cutoff|expectation)/.test(lower));
  }, [concernSearch, concernSuggestions, concernLoading]);

  // Stage Journey panel moved to CapadexResultPhase (renders after free Clarity assessment).
  const isEmailValid = emailRx.test(capadexRegEmail?.trim() ?? '');

  // ── Context-field (role / industry) prediction ────────────────────────
  const [contextSugg, setContextSugg] = React.useState<string[]>([]);
  const [showContextSugg, setShowContextSugg] = React.useState(false);
  const contextWrapRef = React.useRef<HTMLDivElement>(null);
  const [citySugg, setCitySugg] = React.useState<string[]>([]);
  const [showCitySugg, setShowCitySugg] = React.useState(false);
  const cityWrapRef = React.useRef<HTMLDivElement>(null);

  const ROLE_OPTIONS = [
    'Software Engineer', 'Senior Software Engineer', 'Full Stack Developer', 'Frontend Developer',
    'Backend Developer', 'Data Scientist', 'Data Analyst', 'ML Engineer', 'AI Researcher',
    'Product Manager', 'Senior Product Manager', 'Product Lead', 'Product Director',
    'UX Designer', 'UI Designer', 'UX Researcher', 'Graphic Designer', 'Visual Designer',
    'Business Analyst', 'Systems Analyst', 'Management Consultant', 'Strategy Consultant',
    'Marketing Manager', 'Digital Marketing Lead', 'Content Strategist', 'Brand Manager',
    'Sales Manager', 'Account Manager', 'Business Development Manager', 'Key Account Lead',
    'HR Manager', 'HR Business Partner', 'Talent Acquisition Lead', 'L&D Manager', 'CHRO',
    'Finance Manager', 'Financial Analyst', 'CFO', 'Chartered Accountant', 'Investment Analyst',
    'Operations Manager', 'Supply Chain Manager', 'Logistics Manager', 'Project Manager',
    'Team Lead', 'Engineering Manager', 'VP Engineering', 'CTO', 'CEO', 'COO', 'Director',
    'Senior Manager', 'General Manager', 'Delivery Manager', 'Program Manager',
    'Customer Success Manager', 'Customer Support Lead', 'Community Manager',
    'Scrum Master', 'Agile Coach', 'DevOps Engineer', 'Cloud Architect', 'Security Analyst',
    'Researcher', 'Academic', 'Professor', 'Lecturer', 'Trainer', 'L&D Specialist',
    'Career Coach', 'Career Counsellor', 'Career Trainer', 'Career Transition Coach',
    'Entrepreneur', 'Founder', 'Co-founder', 'Startup Founder', 'Freelancer', 'Consultant',
    'Journalist', 'Content Writer', 'Copywriter', 'Technical Writer', 'Editor',
    'Doctor', 'Nurse', 'Physiotherapist', 'Psychologist', 'Social Worker',
    'Teacher', 'School Principal', 'Academic Coordinator', 'Curriculum Designer',
    'Chartered Engineer', 'Civil Engineer', 'Mechanical Engineer', 'Electrical Engineer',
    'IT / Tech', 'FMCG', 'Finance / Banking', 'Healthcare', 'Pharma', 'Education / EdTech',
    'Manufacturing', 'Consulting', 'Media / Entertainment', 'Retail / E-commerce',
    'Real Estate', 'Legal', 'Government / PSU', 'Non-profit / NGO', 'Automotive',
    'Logistics / Supply Chain', 'Energy', 'Telecom', 'Insurance', 'FinTech', 'SaaS / Product',
    'Hospitality', 'Agriculture', 'Construction', 'Aerospace', 'Defence',
  ];
  const SCHOOL_OPTIONS = [
    'IIT Delhi', 'IIT Bombay', 'IIT Madras', 'IIT Kharagpur', 'IIT Kanpur', 'IIT Roorkee',
    'IIM Ahmedabad', 'IIM Bangalore', 'IIM Calcutta', 'IIM Lucknow', 'IIM Kozhikode',
    'BITS Pilani', 'BITS Goa', 'BITS Hyderabad', 'NIT Trichy', 'NIT Warangal', 'NIT Surathkal',
    'Delhi University', 'Mumbai University', 'Pune University', 'Bangalore University',
    'Jadavpur University', 'Anna University', 'Osmania University', 'Calcutta University',
    'DPS RK Puram', 'DPS Noida', 'DPS Mathura Road', 'Kendriya Vidyalaya', 'Navodaya Vidyalaya',
    'St. Xavier\'s', 'La Martiniere', 'Doon School', 'Modern School', 'Ryan International',
    'Cambridge School', 'Amity International', 'Delhi Public School', 'Seth Anandram Jaipuria',
    'Christ University', 'Symbiosis', 'Manipal University', 'VIT', 'SRM University',
    'Ashoka University', 'Jindal Global', 'Flame University', 'Azim Premji University',
    'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12',
    '1st Year', '2nd Year', '3rd Year', '4th Year', 'Final Year',
  ];

  const getContextOptions = () => {
    if (!activeSub) return [];
    // Proxy track (parent/teacher/counsellor/placement) → schools
    if (activeSub.isProxy) return SCHOOL_OPTIONS;
    // Learner track → schools + roles
    if (activeSub.trackId === 'learner') return [...SCHOOL_OPTIONS, ...ROLE_OPTIONS];
    // Professional track → roles
    return ROLE_OPTIONS;
  };

  // Single-string institution field (replaces the dual-state f3+f3b apparatus
  // dropped in the 2026-05-28 macro-track overhaul — the new spec is just
  // ONE "Target Institution" / "Your Domain" text input per is_proxy).
  const handleContextChange = (val: string) => {
    setContextField(val);
    if (val.trim().length >= 2) {
      const lower = val.toLowerCase();
      const opts = getContextOptions();
      const filtered = opts.filter(o => o.toLowerCase().includes(lower)).slice(0, 8);
      setContextSugg(filtered);
      setShowContextSugg(filtered.length > 0);
    } else {
      setContextSugg([]);
      setShowContextSugg(false);
    }
  };

  const handleCityChange = (val: string) => {
    setParticipantCity(val);
    const filtered = searchLocations(val, 8);
    setCitySugg(filtered);
    setShowCitySugg(filtered.length > 0);
  };

  // Reset institution + age band when sub-persona switches (a parent's
  // Class 7 context shouldn't survive a flip to Mid-Career Professional).
  React.useEffect(() => {
    setContextField('');
    setAgeBand('');
    setUserAge('');
    setParticipantGender('');
    setParticipantCity('');
    setCitySugg([]);
    setShowCitySugg(false);
    setParticipantGoal('');
    setGoalTimeline('');
    setAnonymousChild(false);
    setGuardianName('');
    setGuardianRelationship('');
    setConsentAccepted(false);
    // Clear the anonymity sentinel so it can never carry over as a "real"
    // name into a non-anonymous flow on another persona.
    setParticipantName((p) => (p === 'Anonymous' ? '' : p));
  }, [primaryPersona]);

  // Sync legacy selectedPersona from the new primaryPersona leaf so
  // downstream phases (analyze → clarify → questions → result) that
  // still key off PersonaKey keep working.
  React.useEffect(() => {
    if (activeSub && selectedPersona !== activeSub.legacyKey) {
      setSelectedPersona(activeSub.legacyKey);
    }
  }, [primaryPersona]);

  // Sync userAge from ageBand (downstream phases & getAgeRange still
  // expect a numeric age). Pick the band midpoint as the canonical value.
  React.useEffect(() => {
    if (!ageBand) return;
    const mid: Record<AgeBand, number> = { '6-14': 10, '14-17': 16, '17-24': 20, '24-45': 32, '45+': 50 };
    setUserAge(String(mid[ageBand]));
  }, [ageBand]);

  // ── Pragati → assessment handoff hydration (mount-once) ───────────────────
  // If the user explored in Pragati and exited mid-way, pre-fill the concern
  // they raised so they resume instead of restarting from a blank form.
  // (Pragati only surfaces a concern — no persona/age-band — so that is all we
  // carry over.) Cache is cleared after reading.
  React.useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const h = readPragatiHandoff();
    if (!h?.concern) return;
    setConcernSearch(h.concern);
    setHandoffToast('We have carried over what you shared with Pragati — just pick up where you left off.');
    clearPragatiHandoff();
    const t = setTimeout(() => setHandoffToast(null), 8000);
    return () => clearTimeout(t);
  }, []);

  // Close context dropdown on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contextWrapRef.current && !contextWrapRef.current.contains(e.target as Node)) {
        setShowContextSugg(false);
      }
      if (cityWrapRef.current && !cityWrapRef.current.contains(e.target as Node)) {
        setShowCitySugg(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Visual shim: legacy JSX downstream references `persona.color` and
  // `persona.hint`. Map those onto the new track palette so we don't need
  // to refactor every styled element in this 1200-line file.
  const TRACK_COLOR: Record<MacroTrack['id'], string> = {
    school: '#EA580C', learner: '#3D7BFF', professional: '#0EA5A4', proxy: '#7C3AED',
  };
  const persona = {
    color: activeSub ? TRACK_COLOR[activeSub.trackId as MacroTrack['id']] : '#64748b',
    hint: activeSub ? `${activeSub.label} — clarity report mapped to your CAPADEX behavioural matrix` : '',
    label: activeSub?.label ?? '',
  };

  // ── Typeahead filter (spec-aligned 2026-05-28) ─────────────────────────
  // Aligns with the 2,488-row `capadex_concerns_master` schema. For master
  // rows (`source === 'master'`) the haystack is the spec-mandated pair
  // (`concern_cluster`, `common_indian_context`) — both lowercased, joined,
  // and required to contain EVERY whitespace-split token from the query.
  // Legacy short-assessment rows have neither column, so they fall through
  // to `concern_area + parent_worry` so they still appear in the dropdown.
  //
  // Age-band gate normalises BOTH sides via `normaliseDash` (en-dash /
  // em-dash → ASCII hyphen) and only enforces when the master row carries
  // a `typical_age_band` value AND the user has chosen a canonical band
  // from AGE_BANDS — anything else degrades gracefully to "show the row".
  const filteredSuggestions = React.useMemo(() => {
    const q = concernSearch.trim().toLowerCase();
    if (q.length < 2) return [] as typeof concernSuggestions;
    // 2026-05-29 — natural-language input ("I am planning to restart my career
    // after a job gap") carries filler words ("i"/"am"/"my"/"planning"/"after")
    // that appear in NO concern row. The previous rule required EVERY raw token
    // to be present in the concern haystack, so it wiped out every server
    // suggestion and rendered "No close matches" even when the backend had
    // resolved precise rows. We now keep only meaningful tokens (len≥3 minus a
    // small stop set) and retain a row when it matches AT LEAST ONE of them,
    // trusting the server's relevance ranking for order. Rows with zero overlap
    // are still dropped so unrelated concerns never leak in.
    const STOP = new Set(['the','and','for','are','was','has','had','you','our','but','not','why','how','who','can','did','get','your','this','that','with','from','want','need','just','really','after','about','will','would','have','been','than','then','they','them','their']);
    const rawTokens = q.split(/\s+/).filter(Boolean);
    const meaningful = rawTokens.filter(t => t.length >= 3 && !STOP.has(t));
    const matchTokens = meaningful.length > 0 ? meaningful : rawTokens;
    const userBandRaw = ageBand || '';
    const userBand = isCanonicalAgeBand(userBandRaw) ? normaliseDash(userBandRaw) : '';
    return concernSuggestions.filter((c: any) => {
      const isMaster = c.source === 'master' || c.concern_cluster || c.common_indian_context;
      const haystack = (isMaster
        ? [c.concern_cluster, c.common_indian_context]
        : [c.concern_area, c.parent_worry]
      ).filter(Boolean).join(' ').toLowerCase();
      if (!haystack) return false;
      const anyTokenMatch = matchTokens.length === 0
        ? true
        : matchTokens.some(t => haystack.includes(t));
      if (!anyTokenMatch) return false;
      // Age-band gate (master rows only; legacy rows skip). The server derives
      // a master row's `typical_age_band` from raw `MIN(age_min)-MAX(age_max)`
      // (e.g. `18-24`, `10-17`) which almost never equals a canonical band like
      // `17-24`. An exact-string match therefore wiped out every master row
      // whenever an age band was set — which is why learner-specific terms
      // (placement / study / exam) returned an empty dropdown. We instead keep
      // the row when the user's band numerically OVERLAPS the concern range.
      if (userBand && c.typical_age_band) {
        const u = parseAgeRange(userBand);
        const r = parseAgeRange(String(c.typical_age_band));
        if (u && r && !(u[0] <= r[1] && r[0] <= u[1])) return false;
      }
      return true;
    });
  }, [concernSearch, concernSuggestions, ageBand]);

  // Dropdown visibility is stateful so Escape / outside-click can suppress it
  // while the query text remains in the field. We auto-(re)open on every
  // user keystroke (handled in the input onChange) and close on select /
  // Escape / outside pointer.
  const [typeaheadOpen, setTypeaheadOpen] = React.useState(true);
  const dropdownOpen = typeaheadOpen
    && concernSearch.trim().length >= 2
    && filteredSuggestions.length > 0;
  // Outside-click handler — closes the dropdown when the user taps anywhere
  // outside the existing `concernWrapRef` (the relative wrapper around the
  // search input + dropdown portal). Re-opens on the next keystroke or
  // focus event handled on the input.
  React.useEffect(() => {
    if (!dropdownOpen) return;
    const onPointer = (e: PointerEvent) => {
      const root = concernWrapRef.current;
      if (root && !root.contains(e.target as Node)) setTypeaheadOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [dropdownOpen]);

  // Multi-select helpers — strict 3-concern correlation cap
  const MAX_CONCERNS = 3;
  // Surfaces a visible inline note when the user tries to add a 4th. Cleared
  // automatically after 2.5s or on the next successful add / remove so the
  // UI never stays stuck in an error state.
  const [capWarning, setCapWarning] = React.useState(false);
  React.useEffect(() => {
    if (!capWarning) return;
    const t = setTimeout(() => setCapWarning(false), 2500);
    return () => clearTimeout(t);
  }, [capWarning]);
  const addConcern = (
    area: string,
    meta?: { concern_id?: string; domain?: string; concern_cluster?: string; typical_age_band?: string; growth_trend?: string; severity?: string }
  ) => {
    if (selectedConcerns.includes(area)) return;
    if (selectedConcerns.length >= MAX_CONCERNS) {
      // Strict cap: do not append, surface explicit feedback so the user
      // knows the click was intentionally rejected (not a UI glitch).
      setCapWarning(true);
      return;
    }
    setSelectedConcerns(prev => [...prev, area]);
    // Primary concern = first selected
    if (selectedConcerns.length === 0) setSelectedConcern(area);
    // Persist canonical master-table identifiers for the /analyze payload.
    // `typical_age_band` is included so the runtime-context envelope can
    // double-check the user's selected band against the bucket the master
    // row was authored for, without re-querying the master table.
    if (meta && (meta.concern_id || meta.domain || meta.concern_cluster || meta.typical_age_band || meta.growth_trend || meta.severity)) {
      setConcernMetaMap(prev => ({ ...prev, [area]: meta }));
    }
    setCapWarning(false);
    setConcernSearch('');
    setConcernSuggestions([]);
    setShowConcernSugg(false);
    setConcernHighlight(-1);
  };
  const removeConcern = (area: string) => {
    const next = selectedConcerns.filter(c => c !== area);
    setSelectedConcerns(next);
    setSelectedConcern(next[0] ?? null);
  };
  const concernReady2 = selectedConcerns.length > 0 || (selectedConcern !== null) || concernSearch.trim().length >= 3;


  const concernReady = concernReady2;
  // OTP panel is active when OTP has been sent but not yet verified
  const isOtpActive = introOtpSent && !introEmailVerified;
  // Show "Send OTP" button when email is valid + known status + not yet sent + not verified + not at limit
  const showSendOtpBtn = isEmailValid && !emailInvalid
    && (introEmailStatus === 'new' || introEmailStatus === 'returning')
    && !introOtpSent && !introEmailVerified;
  // Legacy alias kept for CTA logic below
  const isReturningWithOtp = false; // replaced by isOtpActive

  // ── Auto-validation 1: send the OTP automatically once the email is valid
  //    and its status resolves (no "Send Verification Code" button needed).
  //    Ref-guarded per-email so we never double-send or loop on re-render.
  const autoSendRef = React.useRef<string>('');
  React.useEffect(() => {
    const email = capadexRegEmail.trim();
    if (showSendOtpBtn && !introOtpLoading && autoSendRef.current !== email) {
      autoSendRef.current = email;
      handleIntroSendOtp();
    }
    // Reset the guard when the email changes so a corrected address can re-send.
    if (!email) autoSendRef.current = '';
  }, [showSendOtpBtn, introOtpLoading, capadexRegEmail, handleIntroSendOtp]);

  // ── Auto-validation 2: verify the OTP automatically once all 6 digits are
  //    entered (no "Verify Email" button needed). Ref-guarded per-code so a
  //    failed attempt doesn't loop — editing a digit re-arms it.
  const autoVerifyRef = React.useRef<string>('');
  React.useEffect(() => {
    const code = introOtpDigits.join('');
    if (code.length === 6 && isOtpActive && !introOtpLoading && !introEmailVerified && autoVerifyRef.current !== code) {
      autoVerifyRef.current = code;
      handleIntroOtpVerify();
    }
    if (code.length < 6) autoVerifyRef.current = '';
  }, [introOtpDigits, isOtpActive, introOtpLoading, introEmailVerified, handleIntroOtpVerify]);

  // Shared input/label styles — component-scoped so every form block (identity
  // card AND the later guardian-consent card) can use them. Previously these were
  // declared inside the identity-card IIFE, which left the consent card (rendered
  // outside that scope) referencing an undefined `labelBase`/`fieldBase`.
  const fieldBase = "w-full h-10 px-3 rounded-lg border bg-white text-[15px] text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-300 transition-all";
  const labelBase = "text-[13px] font-medium text-gray-600 mb-1 block";

  return (
          <div className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 pb-3 overflow-y-auto flex-1">

            {/* Deep-link error banner */}
            {deepLinkError && (
              <div className="mb-4 rounded-xl px-4 py-3 flex items-start gap-2.5" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                <AlertCircle size={16} className="mt-0.5 shrink-0" style={{ color: '#DC2626' }} />
                <p className="text-[13px] leading-snug" style={{ color: '#DC2626' }}>{deepLinkError}</p>
              </div>
            )}

            {/* Pragati → assessment handoff toast */}
            {handoffToast && (
              <div className="mb-4 rounded-xl px-4 py-3 flex items-start gap-2.5" style={{ background: '#F0FDFA', border: '1px solid #99F6E4' }}>
                <CheckCircle size={16} className="mt-0.5 shrink-0" style={{ color: '#0D9488' }} />
                <p className="text-[13px] leading-snug flex-1" style={{ color: '#0F766E' }}>{handoffToast}</p>
                <button onClick={() => setHandoffToast(null)} className="shrink-0" aria-label="Dismiss">
                  <X size={14} style={{ color: '#0D9488' }} />
                </button>
              </div>
            )}

            {/* ── Header ── */}
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.accent}14`, boxShadow: `inset 0 0 0 1px ${BRAND.accent}24` }}>
                  <Brain size={19} style={{ color: BRAND.accent }} />
                </div>
                <div>
                  <h2 data-testid="assessment-title" style={{ fontFamily: "'Plus Jakarta Sans','DM Sans',sans-serif", fontWeight: 500, color: '#0B3C5D', fontSize: '16px', lineHeight: 1.3, margin: 0 }}>
                    Know your{' '}
                    <span style={{ color: '#2EC4B6', display: 'inline-block', transition: 'opacity 0.35s ease, transform 0.35s ease', opacity: famTermVisible ? 1 : 0, transform: famTermVisible ? 'translateY(0)' : 'translateY(-5px)' }}>
                      {FAM_TERMS[famTermIdx]}
                    </span>
                  </h2>
                  {/* Engineering-informed trust strip — replaces the legacy
                      "10 q · 2 min · ★ 4.8 · 12,400+ taken" line per spec.
                      Config-driven so token additions don't require markup edits. */}
                  {(() => {
                    const TRUST_TOKENS: { label: string; emphasis?: boolean }[] = [
                      { label: '14,000+ audited data matrices' },
                      { label: '20+ Core Cognitive Domains' },
                      { label: 'Free & Confidential', emphasis: true },
                    ];
                    return (
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5">
                        {TRUST_TOKENS.map((t, i) => (
                          <React.Fragment key={t.label}>
                            {i > 0 && <span className="text-gray-300 text-[11px]">·</span>}
                            <span
                              className="text-[12px] font-medium"
                              style={{ color: t.emphasis ? '#0B3C5D' : '#64748b' }}
                            >
                              {t.label}
                            </span>
                          </React.Fragment>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
              <button onClick={handleClose} className="text-gray-300 hover:text-gray-500 transition-colors mt-0.5"><X size={17} /></button>
            </div>

            {/* ── Returning user shortcuts ── */}
            {!returningIntent && (
              <div className="flex items-center gap-1.5 mb-4 text-[12px]" style={{ color: '#94a3b8' }}>
                <span>Returning?</span>
                <button
                  onClick={() => { setReturningIntent('resume'); }}
                  className="font-semibold underline underline-offset-2 transition-colors hover:opacity-75"
                  style={{ color: '#344E86' }}
                >
                  Continue Stage Analysis
                </button>
                <span style={{ color: '#CBD5E1' }}>·</span>
                <button
                  onClick={() => { setReturningIntent('report'); }}
                  className="font-semibold underline underline-offset-2 transition-colors hover:opacity-75"
                  style={{ color: '#344E86' }}
                >
                  View my report
                </button>
              </div>
            )}

            {/* ── Returning user mini-form ── */}
            {returningIntent && (
              <div className="mb-2">
                <button
                  onClick={() => { setReturningIntent(null); }}
                  className="flex items-center gap-1 text-[12px] mb-4 transition-colors hover:opacity-75"
                  style={{ color: '#64748b' }}
                >
                  <ArrowRight size={11} className="rotate-180" />
                  Back
                </button>

                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #C7D2FE', backgroundColor: '#F5F7FF' }}>
                  <div className="px-4 py-3 flex items-center gap-2.5" style={{ backgroundColor: '#EEF2FF', borderBottom: '1px solid #C7D2FE' }}>
                    {returningIntent === 'resume'
                      ? <Clock size={13} style={{ color: '#344E86' }} />
                      : <FileText size={13} style={{ color: '#344E86' }} />
                    }
                    <p className="text-[13px] font-semibold" style={{ color: '#1E3A5F' }}>
                      {returningIntent === 'resume' ? 'Continue Stage Analysis' : 'Access your report'}
                    </p>
                  </div>
                  <div className="px-4 py-4">
                    <p className="text-[12px] mb-3" style={{ color: '#64748b' }}>
                      {returningIntent === 'resume'
                        ? "Enter the email you used to start your assessment. We'll verify it and pick up exactly where you left off."
                        : 'Enter your email to verify your identity and access your completed assessment report.'}
                    </p>

                    {/* Email input */}
                    <div className="relative mb-2">
                      <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#9ca3af' }} />
                      <input
                        type="email"
                        value={capadexRegEmail}
                        onChange={e => setCapadexRegEmail(e.target.value)}
                        onBlur={e => {
                          const val = e.target.value.trim();
                          if (val && emailRx.test(val)) handleIntroEmailCheck(val, 'returning');
                        }}
                        placeholder="you@email.com"
                        className="w-full h-9 pl-8 pr-3 rounded-lg border text-[14px] text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 transition-all"
                        style={{ borderColor: '#E5E7EB' }}
                        data-testid="input-returning-email"
                      />
                    </div>

                    {/* Auto-sending the verification code (no button) */}
                    {!introOtpSent && !introEmailVerified && emailRx.test(capadexRegEmail.trim()) && introOtpLoading && (
                      <div className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: '#344E86' }}>
                        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Sending verification code…
                      </div>
                    )}

                    {/* Send failed: surface error + manual retry */}
                    {!introOtpSent && !introEmailVerified && emailRx.test(capadexRegEmail.trim()) && !introOtpLoading && introOtpError && (
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12px] flex items-center gap-1" style={{ color: '#EF4444' }}>
                          <AlertCircle size={11} className="shrink-0" />
                          {introOtpError}
                        </p>
                        <button onClick={handleIntroSendOtp} className="text-[12px] font-semibold shrink-0" style={{ color: '#344E86' }}>
                          Try again
                        </button>
                      </div>
                    )}

                    {/* OTP entry */}
                    {introOtpSent && !introEmailVerified && (
                      <div>
                        <p className="text-[12px] mb-2 flex items-center gap-1.5" style={{ color: '#344E86' }}>
                          <KeyRound size={11} />
                          Enter the 6-digit code sent to your inbox
                        </p>
                        <div className="flex gap-2 mb-2">
                          {introOtpDigits.map((d, i) => (
                            <input
                              key={i}
                              ref={el => { introOtpRefs.current[i] = el; }}
                              type="text"
                              inputMode="numeric"
                              maxLength={1}
                              value={d}
                              onChange={e => {
                                const val = e.target.value.replace(/\D/g, '');
                                const next = [...introOtpDigits];
                                next[i] = val.slice(-1);
                                setIntroOtpDigits(next);
                                if (val && i < 5) introOtpRefs.current[i + 1]?.focus();
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Backspace' && !introOtpDigits[i] && i > 0) introOtpRefs.current[i - 1]?.focus();
                              }}
                              onPaste={e => {
                                e.preventDefault();
                                const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                                const next = ['', '', '', '', '', ''];
                                for (let j = 0; j < paste.length; j++) next[j] = paste[j];
                                setIntroOtpDigits(next);
                                introOtpRefs.current[Math.min(paste.length, 5)]?.focus();
                              }}
                              className="w-10 h-10 text-center rounded-lg border-2 text-[18px] font-bold focus:outline-none transition-all"
                              style={{ borderColor: introOtpError ? '#EF4444' : d ? '#344E86' : '#E5E7EB', backgroundColor: d ? '#EEF2FF' : '#FAFAFA', color: '#1E3A5F' }}
                            />
                          ))}
                        </div>
                        {introOtpError && (
                          <p className="text-[12px] text-red-500 mb-2 flex items-center gap-1">
                            <AlertCircle size={11} className="shrink-0" />{introOtpError}
                          </p>
                        )}
                        <div className="flex items-center justify-between">
                          <button onClick={handleIntroOtpResend} disabled={introOtpTimer > 0} className="text-[12px] font-medium" style={{ color: introOtpTimer > 0 ? '#9CA3AF' : '#344E86' }}>
                            {introOtpTimer > 0 ? `Resend in ${introOtpTimer}s` : 'Resend code'}
                          </button>
                          {introOtpLoading ? (
                            <span className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: '#344E86' }}>
                              <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              Verifying…
                            </span>
                          ) : (
                            <span className="text-[12px]" style={{ color: '#9CA3AF' }}>Auto-verifies when complete</span>
                          )}
                        </div>
                      </div>
                    )}

                    {introEmailVerified && introOtpLoading && (
                      <div className="flex items-center justify-center gap-2 py-2">
                        <div className="w-4 h-4 border-2 border-[#344E86] border-t-transparent rounded-full animate-spin" />
                        <p className="text-[13px]" style={{ color: '#344E86' }}>
                          {returningIntent === 'resume' ? 'Loading your assessment…' : 'Loading your report…'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Main form — hidden when a returning-user shortcut is active ── */}
            {!returningIntent && (<>
            <div className="mb-3">
              <p className="text-[14.5px] font-semibold text-slate-800 leading-tight">
                Who's this clarity journey for? <span className="text-red-400">*</span>
              </p>
              <p className="text-[12.5px] text-slate-400 mt-0.5">Pick the closest fit — you can refine the details next.</p>
            </div>
            {triedSubmit && !selectedPersona && (
              <p className="text-[11px] text-red-500 mb-1.5 flex items-center gap-1">
                <AlertCircle size={11} className="shrink-0" />
                Pick a sub-persona to continue.
              </p>
            )}
            {/* Progressive disclosure: 3 collapsed track cards. Tap a header
                to reveal its sub-personas (accordion — one open at a time).
                When `triedSubmit && !primaryPersona`, the outer ring goes red
                so the missing-selection state is unmissable. */}
            <div
              className="space-y-2.5 mb-3.5 rounded-xl"
              style={triedSubmit && !selectedPersona ? { boxShadow: '0 0 0 2px #ef4444', padding: 2 } : undefined}
            >
              {visibleTracks.map((track) => {
                const trackColor = TRACK_COLOR[track.id];
                const anySelectedInTrack = activeSub?.trackId === track.id;
                const isOpen = expandedTrack === track.id;
                const selectedLabel = anySelectedInTrack ? activeSub?.label : null;
                const active = anySelectedInTrack || isOpen;
                return (
                  <div
                    key={track.id}
                    className="rounded-2xl border bg-white transition-all overflow-hidden"
                    style={{
                      borderColor: anySelectedInTrack ? trackColor : (isOpen ? '#cbd5e1' : '#e5e7eb'),
                      boxShadow: anySelectedInTrack
                        ? `0 0 0 1px ${trackColor}, 0 8px 24px -14px ${trackColor}80`
                        : (isOpen ? '0 4px 16px -12px rgba(16,24,40,0.18)' : '0 1px 2px rgba(16,24,40,0.04)'),
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedTrack(isOpen ? null : track.id)}
                      data-testid={`track-header-${track.id}`}
                      aria-expanded={isOpen}
                      aria-controls={`track-panel-${track.id}`}
                      id={`track-trigger-${track.id}`}
                      className="w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-slate-50/70 active:scale-[0.998]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="inline-flex items-center justify-center rounded-xl flex-shrink-0 transition-all"
                          style={{
                            width: 40, height: 40,
                            backgroundColor: anySelectedInTrack ? trackColor : `${trackColor}14`,
                            color: anySelectedInTrack ? '#fff' : trackColor,
                            boxShadow: anySelectedInTrack ? `0 2px 8px -3px ${trackColor}66` : 'none',
                          }}
                        >
                          {anySelectedInTrack
                            ? <CheckCircle size={19} />
                            : <track.icon size={19} />}
                        </span>
                        <div className="min-w-0">
                          <div className="text-[15px] font-semibold leading-tight" style={{ color: active ? trackColor : '#0f172a' }}>
                            {track.title}
                          </div>
                          <div className="text-[12.5px] leading-snug mt-0.5 truncate" style={{ color: anySelectedInTrack ? `${trackColor}` : '#64748b' }}>
                            {selectedLabel
                              ? <><span className="opacity-70 font-medium">Selected · </span>{selectedLabel}</>
                              : track.subtitle}
                          </div>
                        </div>
                      </div>
                      <span
                        className="inline-flex items-center justify-center rounded-full flex-shrink-0 ml-2 transition-all"
                        style={{
                          width: 24, height: 24,
                          backgroundColor: isOpen ? `${trackColor}14` : '#f1f5f9',
                          color: isOpen ? trackColor : '#94a3b8',
                        }}
                      >
                        {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </span>
                    </button>
                    {isOpen && (
                      <div
                        className="px-3 pb-3 pt-1 border-t border-slate-100 space-y-1.5"
                        data-testid={`track-body-${track.id}`}
                        id={`track-panel-${track.id}`}
                        role="radiogroup"
                        aria-labelledby={`track-trigger-${track.id}`}
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-400 px-1 pt-2 pb-0.5">
                          Which best describes {track.isProxy ? 'them' : 'you'}? — pick one
                        </p>
                        {track.subPersonas.map((sp) => {
                          const isSelected = primaryPersona === sp.id;
                          return (
                            <button
                              key={sp.id}
                              type="button"
                              onClick={() => { setPrimaryPersona(sp.id); setChangingPersona(false); }}
                              data-testid={`persona-${sp.id}`}
                              role="radio"
                              aria-checked={isSelected}
                              className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border text-left text-[14px] font-medium transition-all active:scale-[0.995]"
                              style={{
                                borderColor: isSelected ? trackColor : '#e5e7eb',
                                backgroundColor: isSelected ? `${trackColor}14` : '#fff',
                                color: isSelected ? trackColor : '#334155',
                                boxShadow: isSelected ? `0 0 0 1px ${trackColor}` : 'none',
                              }}
                            >
                              <span className="flex-1">{sp.label}</span>
                              {isSelected && <Check size={15} strokeWidth={3} style={{ color: trackColor }} className="flex-shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Focus-mode escape hatch: only rendered once a persona is locked
                  in and the other tracks are hidden. Re-opens the full list. */}
              {hasPersonaSelection && !changingPersona && (
                <button
                  type="button"
                  onClick={() => setChangingPersona(true)}
                  data-testid="change-persona"
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-[12.5px] font-medium text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <Users size={13} className="opacity-70" />
                  Not you? Change who this is for
                </button>
              )}
            </div>

            {/* ── Dynamic info bar: hint + what-you-get (adapts on selection) ── */}
            <div className="rounded-xl mb-4 transition-all duration-200" style={{ border: selectedPersona ? `1px solid ${persona?.color}28` : '1px solid #f1f5f9', backgroundColor: selectedPersona ? `${persona?.color}07` : '#f8fafc' }}>
              {selectedPersona ? (
                <div className="px-3.5 py-3">
                  {selectedConcern && (
                    <p className="text-[13px] font-semibold uppercase tracking-[0.08em] mb-1" style={{ color: persona.color }}>
                      {selectedConcern}
                    </p>
                  )}
                  <p className="text-[15px] text-gray-600 leading-snug mb-2.5">{persona.hint}</p>
                  <div className="flex items-center gap-4">
                    {[
                      { icon: Target, text: 'Readiness Score' },
                      { icon: Zap, text: 'Top Strengths' },
                      { icon: TrendingUp, text: 'Action Plan' },
                    ].map(({ icon: Icon, text }) => (
                      <div key={text} className="flex items-center gap-1">
                        <Icon size={10} style={{ color: persona.color }} />
                        <span className="text-[13px] font-medium" style={{ color: persona.color }}>{text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="px-3.5 py-2.5 flex items-center justify-between">
                  <span className="text-[13px] text-gray-400">Your report includes:</span>
                  <div className="flex items-center gap-3">
                    {[
                      { icon: Target, text: 'Score' },
                      { icon: Zap, text: 'Strengths' },
                      { icon: TrendingUp, text: 'Action Plan' },
                    ].map(({ icon: Icon, text }) => (
                      <div key={text} className="flex items-center gap-1">
                        <Icon size={10} style={{ color: '#2EC4B6' }} />
                        <span className="text-[13px] text-gray-500">{text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Identity fields — once sub-persona selected ── */}
            {activeSub && (() => {
              return (
              <div
                className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.12)] p-4 mb-4 space-y-3"
                data-testid="identity-card"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="h-5 w-1 rounded-full" style={{ backgroundColor: persona?.color || '#2EC4B6' }} />
                  <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-slate-500">
                    About {isSchoolChild ? 'the child' : isProxy ? 'them' : 'you'}
                  </span>
                </div>

                {/* ── School-children: anonymity toggle ───────────────────────────
                     ON  → child's name is hidden from the report (email/OTP still
                           required). OFF → parental consent is mandatory below. */}
                {isSchoolChild && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = !anonymousChild;
                      setAnonymousChild(next);
                      if (next) {
                        setParticipantName('Anonymous');
                        setGuardianName('');
                        setGuardianRelationship('');
                        setConsentAccepted(false);
                      } else {
                        setParticipantName('');
                      }
                    }}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border text-left transition-all active:scale-[0.995]"
                    style={{
                      borderColor: anonymousChild ? '#EA580C' : '#e5e7eb',
                      backgroundColor: anonymousChild ? '#EA580C0D' : '#fff',
                    }}
                    data-testid="toggle-anonymous-child"
                    role="switch"
                    aria-checked={anonymousChild}
                  >
                    <span className="flex items-start gap-2.5 min-w-0">
                      <EyeOff size={16} className="shrink-0 mt-0.5" style={{ color: anonymousChild ? '#EA580C' : '#94a3b8' }} />
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-semibold" style={{ color: anonymousChild ? '#C2410C' : '#334155' }}>
                          Take this assessment anonymously
                        </span>
                        <span className="block text-[11.5px] leading-snug text-slate-500 mt-0.5">
                          {anonymousChild
                            ? "The child's name is hidden from the report — no parental consent needed."
                            : 'Turn on to skip the name. Otherwise a parent/guardian must consent below.'}
                        </span>
                      </span>
                    </span>
                    <span
                      className="relative shrink-0 rounded-full transition-colors"
                      style={{ width: 38, height: 22, backgroundColor: anonymousChild ? '#EA580C' : '#cbd5e1' }}
                    >
                      <span
                        className="absolute top-0.5 rounded-full bg-white transition-all"
                        style={{ width: 18, height: 18, left: anonymousChild ? 18 : 2 }}
                      />
                    </span>
                  </button>
                )}

                {/* Row 1 — Name (required) + Age band (required) */}
                <div className="grid grid-cols-[1.2fr_1fr] gap-2.5">
                  {/* Field 1 — Target Name / Identifier OR Your Full Name */}
                  <div>
                    <label className={labelBase}>
                      {isSchoolChild ? "Child's name" : personaCfg.f1Label}{' '}
                      {isSchoolChild && anonymousChild
                        ? <span className="text-gray-300 font-normal">(hidden)</span>
                        : <span className="text-red-400">*</span>}
                    </label>
                    {isSchoolChild && anonymousChild ? (
                      <div
                        className="w-full h-10 px-3 rounded-lg border bg-slate-50 flex items-center gap-2 text-gray-400"
                        style={{ borderColor: '#e5e7eb' }}
                        data-testid="name-anonymous-state"
                      >
                        <EyeOff size={13} className="shrink-0" />
                        <span className="text-[13px]">Hidden from report</span>
                      </div>
                    ) : (() => {
                      const nameTrim = participantName.trim();
                      const nameInvalid = nameTrim.length > 0 && nameTrim.length < 2;
                      return (
                        <>
                          <input
                            type="text"
                            value={participantName}
                            onChange={(e) => setParticipantName(e.target.value)}
                            placeholder={isSchoolChild ? "Child's full name" : personaCfg.f1Placeholder}
                            className={fieldBase}
                            style={{ borderColor: (nameInvalid || (triedSubmit && nameTrim.length < 2)) ? '#ef4444' : '#e5e7eb' }}
                            data-testid="input-participant-name"
                          />
                          {nameInvalid && (
                            <p className="text-[11px] text-red-500 mt-0.5">Please enter at least 2 characters</p>
                          )}
                          {!nameInvalid && triedSubmit && nameTrim.length < 2 && (
                            <p className="text-[11px] text-red-500 mt-0.5 flex items-center gap-1">
                              <AlertCircle size={10} className="shrink-0" />
                              {isSchoolChild ? "Child's name" : personaCfg.f1Label} is required.
                            </p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  {/* Field 3 — Age Band Dropdown (bound to sub-persona's allowed brackets) */}
                  <div>
                    <label className={labelBase}>
                      {isProxy ? 'Their age group' : 'Your age group'} <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={ageBand}
                      onChange={(e) => setAgeBand(e.target.value as AgeBand | '')}
                      className={fieldBase}
                      style={{ borderColor: (triedSubmit && (!ageBand || !isCanonicalAgeBand(ageBand))) ? '#ef4444' : '#e5e7eb' }}
                      data-testid="select-age-band"
                    >
                      <option value="">— select age band —</option>
                      {activeSub.ageBands
                        .filter((b) => (AGE_BANDS as readonly string[]).includes(b))
                        .map((b) => (
                          <option key={b} value={b}>{AGE_BAND_LABEL[b]}</option>
                        ))}
                    </select>
                    {triedSubmit && !ageBand && (
                      <p className="text-[11px] text-red-500 mt-0.5 flex items-center gap-1">
                        <AlertCircle size={10} className="shrink-0" />
                        Select an age group to continue.
                      </p>
                    )}
                    {ageBand && !activeSub.ageBands.includes(ageBand) && (
                      <p className="text-[11px] text-amber-600 mt-0.5">
                        ⚠ Out-of-band selection — affinity matching may degrade
                      </p>
                    )}
                  </div>
                </div>

                {/* Row 2 — Exact age + Gender (both optional) */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className={labelBase}>
                      Exact age <span className="text-gray-300">(opt.)</span>
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={120}
                      value={userAge}
                      onChange={(e) => setUserAge(e.target.value)}
                      placeholder={isProxy ? 'Their age' : 'Your age'}
                      className={fieldBase}
                      style={{ borderColor: '#e5e7eb' }}
                      data-testid="input-exact-age"
                    />
                  </div>
                  <div>
                    <label className={labelBase}>
                      Gender <span className="text-gray-300">(opt.)</span>
                    </label>
                    <select
                      value={participantGender}
                      onChange={(e) => setParticipantGender(e.target.value)}
                      className={fieldBase}
                      style={{ borderColor: '#e5e7eb' }}
                      data-testid="select-gender"
                    >
                      <option value="">— prefer not to say —</option>
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                      <option value="non_binary">Non-binary</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                {/* Row 3 — City / location (optional, with autocomplete) */}
                <div>
                  <label className={labelBase}>
                    City / location <span className="text-gray-300">(opt.)</span>
                  </label>
                  <div className="relative" ref={cityWrapRef}>
                    <input
                      type="text"
                      value={participantCity}
                      onChange={(e) => handleCityChange(e.target.value)}
                      onFocus={() => participantCity.trim().length >= 2 && citySugg.length > 0 && setShowCitySugg(true)}
                      placeholder="e.g. Bengaluru, India"
                      className={fieldBase}
                      style={{ borderColor: '#e5e7eb' }}
                      data-testid="input-city"
                      autoComplete="off"
                    />
                    {showCitySugg && citySugg.length > 0 && (
                      <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                        {citySugg.map((opt) => (
                          <li
                            key={opt}
                            onPointerDown={(e) => {
                              e.preventDefault();
                              setParticipantCity(opt);
                              setShowCitySugg(false);
                              setCitySugg([]);
                            }}
                            className="px-3 py-2 text-[14px] text-gray-700 hover:bg-cyan-50 hover:text-cyan-700 cursor-pointer transition-colors"
                          >
                            {opt}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Field 2 — Institution / Domain (full width, with autocomplete) */}
                <div>
                  <label className={labelBase}>
                    {personaCfg.f2Label} <span className="text-gray-300">(opt.)</span>
                  </label>
                  <div className="relative" ref={contextWrapRef}>
                    <input
                      type="text"
                      value={contextField}
                      onChange={(e) => handleContextChange(e.target.value)}
                      onFocus={() => contextField.trim().length >= 2 && contextSugg.length > 0 && setShowContextSugg(true)}
                      placeholder={personaCfg.f2Placeholder}
                      className={fieldBase}
                      style={{ borderColor: '#e5e7eb' }}
                      data-testid="input-context"
                      autoComplete="off"
                    />
                    {showContextSugg && contextSugg.length > 0 && (
                      <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                        {contextSugg.map((opt) => (
                          <li
                            key={opt}
                            onPointerDown={(e) => {
                              e.preventDefault();
                              setContextField(opt);
                              setShowContextSugg(false);
                              setContextSugg([]);
                            }}
                            className="px-3 py-2 text-[14px] text-gray-700 hover:bg-cyan-50 hover:text-cyan-700 cursor-pointer transition-colors"
                          >
                            {opt}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Row 5 — Goal + timeline (both optional) */}
                <div className="grid grid-cols-[1.4fr_1fr] gap-2.5">
                  <div>
                    <label className={labelBase}>
                      {isProxy ? 'Goal for them' : 'What are you hoping to achieve?'} <span className="text-gray-300">(opt.)</span>
                    </label>
                    <input
                      type="text"
                      value={participantGoal}
                      onChange={(e) => setParticipantGoal(e.target.value)}
                      placeholder={personaCfg.goalPlaceholder}
                      className={fieldBase}
                      style={{ borderColor: '#e5e7eb' }}
                      data-testid="input-goal"
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label className={labelBase}>
                      Timeline <span className="text-gray-300">(opt.)</span>
                    </label>
                    <select
                      value={goalTimeline}
                      onChange={(e) => setGoalTimeline(e.target.value)}
                      className={fieldBase}
                      style={{ borderColor: '#e5e7eb' }}
                      data-testid="select-timeline"
                    >
                      <option value="">— select —</option>
                      <option value="right_away">Right away</option>
                      <option value="within_3_months">Within 3 months</option>
                      <option value="3_6_months">3–6 months</option>
                      <option value="6_12_months">6–12 months</option>
                      <option value="exploring">Just exploring</option>
                    </select>
                  </div>
                </div>
              </div>
              );
            })()}

            {/* ── Concern live search — below name/age so age context is available ── */}
            {selectedPersona && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[14px] font-semibold text-slate-700 leading-snug">
                    {personaCfg.concernHeader}
                  </label>
                  {selectedConcerns.length === 0 && (
                    <span className="text-[11px] text-gray-300 font-normal">up to 3 for correlation</span>
                  )}
                  {selectedConcerns.length > 0 && selectedConcerns.length < MAX_CONCERNS && (
                    <span className="text-[11px] font-medium" style={{ color: persona.color }}>
                      {selectedConcerns.length}/3 — add more for deeper insight
                    </span>
                  )}
                  {selectedConcerns.length >= MAX_CONCERNS && (
                    <span className="text-[11px] text-gray-400">3 concerns selected</span>
                  )}
                </div>

                {/* Strict-cap feedback — surfaced for 2.5s when the user tries
                    to add a 4th concern via the typeahead or ontology chip. */}
                {capWarning && (
                  <p className="mb-2 -mt-0.5 text-[11px] flex items-center gap-1" style={{ color: '#B45309' }}>
                    <AlertCircle size={11} className="shrink-0" />
                    Maximum 3 concerns for correlation — remove one to add another.
                  </p>
                )}

                {/* ── Selected concerns chips ── */}
                {selectedConcerns.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedConcerns.map((area, i) => (
                      <div
                        key={area}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[13px] font-medium"
                        style={{ backgroundColor: `${persona.color}12`, border: `1px solid ${persona.color}40`, color: persona.color }}
                      >
                        {i === 0 && <span className="text-[9px] font-bold uppercase tracking-widest opacity-60">Primary</span>}
                        {i > 0 && <span className="text-[9px] font-bold uppercase tracking-widest opacity-60">+</span>}
                        <span>{area}</span>
                        <button
                          onPointerDown={e => { e.preventDefault(); removeConcern(area); }}
                          className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {/* 2026-06-01 — Growth trend + severity for the primary concern,
                    surfaced once a concern (with master metadata) is selected. */}
                {(() => {
                  const primary = selectedConcerns[0];
                  const meta = primary ? concernMetaMap[primary] : undefined;
                  if (!meta || (!meta.growth_trend && !meta.severity)) return null;
                  const sev = (meta.severity || '').toLowerCase();
                  const sevColor = sev.includes('high') || sev.includes('critical')
                    ? { fg: '#B91C1C', bg: '#FEF2F2', bd: '#FECACA' }
                    : sev.includes('medium') || sev.includes('moderate')
                    ? { fg: '#B45309', bg: '#FFFBEB', bd: '#FDE68A' }
                    : { fg: '#15803D', bg: '#F0FDF4', bd: '#BBF7D0' };
                  return (
                    <div className="flex flex-wrap items-center gap-2 mb-2.5" data-testid="concern-meta">
                      {meta.growth_trend && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium bg-slate-50 border border-slate-200 text-slate-600">
                          <TrendingUp size={12} className="opacity-70" />
                          Growth trend:&nbsp;<strong className="font-semibold text-slate-800">{meta.growth_trend}</strong>
                        </span>
                      )}
                      {meta.severity && (
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium border"
                          style={{ color: sevColor.fg, backgroundColor: sevColor.bg, borderColor: sevColor.bd }}
                        >
                          <AlertCircle size={12} />
                          Severity:&nbsp;<strong className="font-semibold">{meta.severity}</strong>
                        </span>
                      )}
                    </div>
                  );
                })()}
                <div className="relative" ref={concernWrapRef}>
                  <Search
                    size={12}
                    className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: selectedConcern ? persona.color : '#9ca3af' }}
                  />
                  <input
                    type="text"
                    role="combobox"
                    aria-expanded={dropdownOpen}
                    aria-controls="concern-typeahead-listbox"
                    aria-autocomplete="list"
                    value={concernSearch}
                    onChange={e => {
                      const val = e.target.value;
                      setConcernSearch(val);
                      // Re-open the typeahead on every keystroke so users
                      // who Escaped or clicked-outside can resume browsing
                      // by simply typing more.
                      setTypeaheadOpen(true);
                      if (selectedConcern && selectedConcerns.length === 0) setSelectedConcern(null);
                    }}
                    onFocus={() => setTypeaheadOpen(true)}
                    onKeyDown={e => {
                      // Enter — if the dropdown has matches, take the top
                      // suggestion (with its canonical metadata); otherwise
                      // fall back to free-text add when query is long enough.
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const top: any = filteredSuggestions[0];
                        if (top) {
                          const area = top.concern_area || top.domain;
                          if (area) {
                            addConcern(area, {
                              concern_id: top.concern_id,
                              domain: top.domain ?? area,
                              concern_cluster: top.concern_cluster ?? top.impact_on_child,
                              typical_age_band: top.typical_age_band,
                              growth_trend: top.growth_trend,
                              severity: top.severity,
                            });
                          }
                        } else if (concernSearch.trim().length >= 3) {
                          addConcern(concernSearch.trim());
                        }
                      } else if (e.key === 'Escape' && dropdownOpen) {
                        e.preventDefault();
                        setTypeaheadOpen(false);
                        setShowConcernSugg(false);
                      }
                    }}
                    placeholder={personaCfg.concernPlaceholder}
                    className="w-full h-9 pl-8 pr-8 rounded-lg border-2 text-[16px] bg-white focus:outline-none transition-all"
                    style={{
                      borderColor:
                        triedSubmit && selectedConcerns.length === 0 && !selectedConcern && concernSearch.trim().length < 3
                          ? '#ef4444'
                          : selectedConcerns.length > 0 ? persona.color : '#e5e7eb',
                      color: '#1f2937',
                      backgroundColor: '#fff',
                    }}
                    data-testid="concern-search"
                  />
                  {triedSubmit && selectedConcerns.length === 0 && !selectedConcern && concernSearch.trim().length < 3 && (
                    <p className="absolute -bottom-5 left-0 text-[11px] text-red-500 flex items-center gap-1">
                      <AlertCircle size={10} className="shrink-0" />
                      Describe at least one concern (or pick from the suggestions).
                    </p>
                  )}
                  {concernSearch && (
                    <button
                      onClick={() => { setConcernSearch(''); setConcernSuggestions([]); setShowConcernSugg(false); }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  )}
                  {concernLoading && !selectedConcern && (
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 border border-gray-300 border-t-transparent rounded-full animate-spin" />
                  )}

                  {/* ── Phase 1 Typeahead Dropdown Portal ────────────────────
                       Absolute-positioned overlay (z-50) anchored to the
                       relative input wrapper. Shows up to 5 tokenized
                       matches with `concern_cluster` as title and `domain`
                       as secondary label. Selecting an item invokes
                       addConcern with full canonical metadata, then clears
                       the query and closes the portal.                   */}
                  {dropdownOpen && (
                    <div
                      role="listbox"
                      id="concern-typeahead-listbox"
                      className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
                      data-testid="concern-typeahead-dropdown"
                    >
                      {filteredSuggestions.slice(0, 5).map((c: any) => {
                        // Prefer curated `display_label` (user-facing copy);
                        // fall back to concern_cluster → concern_area → domain
                        // so we never render a blank row. Subtitle exposes
                        // the next-most-specific signal (cluster when label
                        // is curated, domain when cluster is the headline).
                        const title = c.display_label || c.concern_cluster || c.concern_area || c.domain || '';
                        const subtitle = (c.display_label && c.concern_cluster) ? c.concern_cluster : (c.domain || c.concern_area || '');
                        const alreadyAdded = selectedConcerns.includes(c.concern_area || c.domain);
                        return (
                          <button
                            key={`tah_${String(c.id)}`}
                            role="option"
                            aria-selected={false}
                            type="button"
                            disabled={alreadyAdded}
                            onPointerDown={e => {
                              e.preventDefault();
                              const area = c.concern_area || c.domain;
                              if (!area) return;
                              addConcern(area, {
                                concern_id: c.concern_id,
                                domain: c.domain ?? area,
                                concern_cluster: c.concern_cluster ?? c.impact_on_child,
                                typical_age_band: c.typical_age_band,
                                growth_trend: c.growth_trend,
                                severity: c.severity,
                              });
                              // Selection cleanup callback per spec: clear
                              // the input text and close the portal. These
                              // also fire inside addConcern() but we repeat
                              // them defensively in case addConcern is
                              // refactored.
                              setConcernSearch('');
                              setShowConcernSugg(false);
                            }}
                            className="w-full text-left px-3 py-2 flex flex-col gap-0.5 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed border-b border-slate-100 last:border-b-0 transition-colors"
                          >
                            <span className="text-[13px] font-semibold text-slate-800 truncate">
                              {title}
                            </span>
                            {subtitle && subtitle !== title && (
                              <span className="text-[11px] text-slate-500 truncate">
                                {subtitle}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ── Real-time ontology mapping preview (300ms debounce) ── */}
                {/*    2026-05-28 spec: new "[ 🔍 Core Domain: ... ]" chip
                       + secondary sociocultural amplifier alert line.       */}
                {ontologyPreview && (
                  <div className="mt-2 space-y-1.5" data-testid="ontology-preview">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(() => {
                        // Dedupe by canonical routing key (matches dropdown
                        // add path which keys on concern_area), NOT by the
                        // user-facing display label.
                        const alreadyAdded = selectedConcerns.includes(ontologyPreview.key);
                        const canAdd = !alreadyAdded && selectedConcerns.length < MAX_CONCERNS;
                        const tone = ontologyPreview.tone;
                        const fg  = tone === 'violet' ? '#6D28D9' : tone === 'amber' ? '#B45309' : '#475569';
                        const bg  = tone === 'violet' ? '#FAF5FF' : tone === 'amber' ? '#FFFBEB' : '#F8FAFC';
                        const bd  = tone === 'violet' ? '#DDD6FE' : tone === 'amber' ? '#FDE68A' : '#E2E8F0';
                        const ico = tone === 'violet' ? '#EDE9FE' : tone === 'amber' ? '#FEF3C7' : '#F1F5F9';
                        return (
                          <button
                            type="button"
                            onPointerDown={e => {
                              e.preventDefault();
                              // Pass canonical master metadata (concern_id /
                              // domain / cluster) so analyze() routes via
                              // master_bridge_tag → concern-specific clarity
                              // questions instead of the generic fallback.
                              // Add by canonical key so the selected-concerns
                              // set stays in lockstep with the dropdown path
                              // (both route on concern_area / master domain).
                              if (canAdd) addConcern(ontologyPreview.key, ontologyPreview.meta);
                            }}
                            disabled={!canAdd}
                            title={alreadyAdded ? 'Already added' : canAdd ? 'Tap to add this as your concern' : 'Max 3 concerns selected'}
                            className="inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full text-[12px] font-medium border transition-all hover:shadow-sm active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:active:scale-100"
                            style={{ borderColor: bd, backgroundColor: bg, color: fg }}
                          >
                            <span
                              className="inline-flex items-center justify-center rounded-full"
                              style={{ width: 18, height: 18, backgroundColor: ico }}
                            >
                              {alreadyAdded ? <CheckCircle size={11} /> : <Target size={10} />}
                            </span>
                            <span className="text-[11px] opacity-70 font-normal">
                              {alreadyAdded ? 'Added ·' : 'Mapped to'}
                            </span>
                            <span className="font-semibold">{ontologyPreview.label}</span>
                            {canAdd && <span className="text-[11px] opacity-60 ml-0.5">+ tap to add</span>}
                          </button>
                        );
                      })()}
                    </div>
                    {socioAlert && (
                      <p className="text-[11.5px] font-medium text-rose-600 flex items-center gap-1.5" data-testid="socio-alert">
                        <AlertCircle size={12} className="flex-shrink-0" />
                        <span>Indian academic-pressure cues detected — we'll factor coaching / placement stress into your report.</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Smart match chips block removed (2026-05-28 Phase 1 typeahead
                 recovery) — superseded by the absolute z-50 floating dropdown
                 anchored to the search input above. Both surfaced the same
                 data; keeping two parallel UIs caused user confusion. The "no
                 close matches — your text will be used directly" affordance
                 is preserved via the inline hint below when applicable. */}
            {selectedPersona && concernSearch.trim().length >= 3 && !concernLoading && filteredSuggestions.length === 0 && (
              <p className="mb-3 -mt-1 text-[12px] text-gray-400 italic">
                No close matches — your text will be used directly.
              </p>
            )}

            {/* 2026-05-28 — persona-fallback notice. Backend's hybrid filter
                 drops the persona constraint when no exact-persona rows match,
                 so users still see related concerns. We tell them honestly
                 that the visible results are adjacent (e.g. a student-track
                 user typing a niche term gets rows tagged for a wider cohort). */}
            {selectedPersona && concernPersonaFallback && filteredSuggestions.length > 0 && (
              <p className="mb-3 -mt-1 text-[12px] flex items-start gap-1.5" style={{ color: '#92400e' }}>
                <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                <span>
                  No exact match for your persona — showing related concerns from adjacent cohorts.
                </span>
              </p>
            )}

            {/* ── School-children consent: full guardian sign-off (when not anonymous) ── */}
            {consentRequired && selectedPersona && concernReady && (
              <div className="mb-3 rounded-2xl border p-3.5 space-y-2.5" style={{ borderColor: '#FED7AA', backgroundColor: '#FFF7ED' }}>
                <div className="flex items-center gap-2">
                  <Shield size={15} style={{ color: '#EA580C' }} className="shrink-0" />
                  <span className="text-[12px] font-bold uppercase tracking-[0.1em]" style={{ color: '#C2410C' }}>
                    Parent / guardian consent
                  </span>
                </div>
                <p className="text-[12px] leading-snug text-amber-800/80">
                  This child is a minor. A parent or legal guardian must complete this before the assessment can start.
                </p>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className={labelBase}>
                      Guardian's name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={guardianName}
                      onChange={(e) => setGuardianName(e.target.value)}
                      placeholder="Full name"
                      className={fieldBase}
                      style={{ borderColor: (triedSubmit && guardianName.trim().length < 2) ? '#ef4444' : '#e5e7eb' }}
                      data-testid="input-guardian-name"
                    />
                  </div>
                  <div>
                    <label className={labelBase}>
                      Relationship <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={guardianRelationship}
                      onChange={(e) => setGuardianRelationship(e.target.value)}
                      className={fieldBase}
                      style={{ borderColor: (triedSubmit && !guardianRelationship) ? '#ef4444' : '#e5e7eb' }}
                      data-testid="select-guardian-relationship"
                    >
                      <option value="">— select —</option>
                      <option value="mother">Mother</option>
                      <option value="father">Father</option>
                      <option value="legal_guardian">Legal guardian</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <label className="flex items-start gap-2.5 cursor-pointer pt-0.5" data-testid="checkbox-guardian-consent">
                  <input
                    type="checkbox"
                    checked={consentAccepted}
                    onChange={(e) => setConsentAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-orange-600"
                  />
                  <span className="text-[12px] leading-snug" style={{ color: (triedSubmit && !consentAccepted) ? '#dc2626' : '#9a3412' }}>
                    I confirm I am the parent / legal guardian of this child and I consent to them taking
                    this behavioural assessment. I understand the results are used to provide developmental guidance.
                  </span>
                </label>
                <p className="text-[11px] leading-snug text-amber-700/70 pl-6.5">
                  Verify the guardian's email below to record this consent.
                </p>
              </div>
            )}

            {/* ── Email field — early returning-user detection ───────────────────── */}
            {selectedPersona && concernReady && (
              <div className="mb-3">
                <label className="text-[14px] font-medium text-gray-500 mb-1 block">
                  {consentRequired ? "Parent / guardian email" : 'Email'}{' '}
                  <span className="text-gray-300 font-normal text-[12px]">
                    {consentRequired ? '(consent is recorded here)' : '(to access or save your report)'}
                  </span>
                </label>
                <div className="relative">
                  <Mail
                    size={13}
                    className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{
                      color: emailInvalid ? '#EF4444'
                        : introEmailStatus === 'returning' ? '#D97706'
                        : introEmailStatus === 'limited' ? '#EF4444'
                        : '#9ca3af'
                    }}
                  />
                  <input
                    type="email"
                    value={capadexRegEmail}
                    onChange={e => {
                      setCapadexRegEmail(e.target.value);
                      // Clear invalid flag as user types
                      if (emailInvalid) setEmailInvalid(false);
                    }}
                    onBlur={e => {
                      const val = e.target.value.trim();
                      if (!val) return;
                      if (!emailRx.test(val)) {
                        setEmailInvalid(true);
                        return;
                      }
                      setEmailInvalid(false);
                      const concern = selectedConcern || concernSearch.trim();
                      if (concern) handleIntroEmailCheck(val, concern);
                    }}
                    placeholder="you@email.com"
                    className="w-full h-9 pl-8 pr-8 rounded-lg border text-[15px] text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 transition-all"
                    style={{
                      borderColor: emailInvalid ? '#EF4444'
                        : introEmailStatus === 'returning' ? '#FCD34D'
                        : introEmailStatus === 'new' ? '#6EE7B7'
                        : introEmailStatus === 'limited' ? '#FECACA'
                        : '#E5E7EB',
                      boxShadow: emailInvalid ? '0 0 0 2px rgba(239,68,68,0.1)' : undefined,
                    }}
                    data-testid="input-intro-email"
                  />
                  {introEmailStatus === 'checking' && (
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  )}
                  {introEmailStatus === 'new' && !emailInvalid && (
                    <CheckCircle size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: '#10B981' }} />
                  )}
                  {introEmailStatus === 'returning' && !emailInvalid && (
                    <KeyRound size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: '#D97706' }} />
                  )}
                  {(emailInvalid || introEmailStatus === 'limited') && (
                    <AlertCircle size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: '#EF4444' }} />
                  )}
                </div>

                {/* Invalid email format error */}
                {emailInvalid && (
                  <p className="text-[12px] mt-1 flex items-center gap-1" style={{ color: '#EF4444' }}>
                    <AlertCircle size={11} className="shrink-0" />
                    Please enter a valid email address (e.g. you@example.com).
                  </p>
                )}

                {/* ── Verified: email confirmed ── */}
                {introEmailVerified && (
                  <p className="text-[12px] mt-1.5 flex items-center gap-1.5" style={{ color: '#059669' }}>
                    <CheckCircle size={12} className="shrink-0" />
                    Email verified — you're all set. Click Analyse below to begin.
                  </p>
                )}

                {/* ── Resume banner — re-shown inline after OTP verification ── */}
                {introEmailVerified && savedSession && !incompleteSession && (
                  <div className="mt-3 rounded-xl overflow-hidden" style={{ border: '1px solid #C7D2FE', backgroundColor: '#EEF2FF' }}>
                    <div className="px-3.5 py-3">
                      <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: '#344E8618' }}>
                          <Clock size={13} style={{ color: '#344E86' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold leading-snug" style={{ color: '#3730A3' }}>
                            You left an assessment in progress
                          </p>
                          <p className="text-[12px] leading-relaxed mt-0.5" style={{ color: '#4338CA' }}>
                            <span className="font-medium">{savedSession.concern}</span>
                            {savedSession.email ? ` · ${savedSession.email}` : ''}
                          </p>
                        </div>
                        <button onClick={handleDismissResume} className="text-indigo-300 hover:text-indigo-500 transition-colors mt-0.5">
                          <X size={14} />
                        </button>
                      </div>
                      <div className="flex gap-2 mt-2.5">
                        <button
                          onClick={handleResumeSession}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-all active:scale-[0.98]"
                          style={{ backgroundColor: '#344E86' }}
                        >
                          <ArrowRight size={11} />
                          Continue where I left off
                        </button>
                        <button onClick={handleDismissResume} className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors" style={{ color: '#6366F1' }}>
                          Start fresh
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── New user: prompt to verify ── */}
                {introEmailStatus === 'new' && !emailInvalid && !introOtpSent && !introEmailVerified && (
                  <p className="text-[12px] mt-1 flex items-center gap-1" style={{ color: '#6B7280' }}>
                    <Mail size={11} className="shrink-0" />
                    Verify your email to unlock the assessment (one-time).
                  </p>
                )}

                {/* ── Returning user: welcome back prompt ── */}
                {introEmailStatus === 'returning' && !introOtpSent && !introEmailVerified && (
                  <p className="text-[12px] mt-1 flex items-center gap-1" style={{ color: '#D97706' }}>
                    <KeyRound size={11} className="shrink-0" />
                    Welcome back{introEmailName ? `, ${introEmailName.split(' ')[0]}` : ''}! Verify to start a new assessment.
                  </p>
                )}

                {/* ── Auto-sending the verification code (no button) ── */}
                {showSendOtpBtn && introOtpLoading && (
                  <div className="text-[12px] mt-2 flex items-center gap-1.5" style={{ color: '#344E86' }}>
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Sending verification code…
                  </div>
                )}

                {/* ── Send failed: surface error + manual retry (auto-send is guard-locked) ── */}
                {showSendOtpBtn && !introOtpLoading && introOtpError && (
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-[12px] flex items-center gap-1" style={{ color: '#EF4444' }}>
                      <AlertCircle size={11} className="shrink-0" />
                      {introOtpError}
                    </p>
                    <button
                      onClick={handleIntroSendOtp}
                      className="text-[12px] font-semibold shrink-0 transition-colors"
                      style={{ color: '#344E86' }}
                    >
                      Try again
                    </button>
                  </div>
                )}

                {/* ── Limit reached: all 3 free assessments used ── */}
                {introEmailStatus === 'limited' && (
                  <div className="mt-2.5 rounded-xl px-3.5 py-3" style={{ border: '1px solid #FECACA', backgroundColor: '#FEF2F2' }}>
                    <div className="flex items-start gap-2.5">
                      <AlertCircle size={15} className="shrink-0 mt-0.5" style={{ color: '#DC2626' }} />
                      <div>
                        <p className="text-[13px] font-semibold leading-snug" style={{ color: '#991B1B' }}>
                          Assessment limit reached{introEmailName ? ` for ${introEmailName.split(' ')[0]}` : ''}
                        </p>
                        <p className="text-[12px] mt-1 leading-relaxed" style={{ color: '#B91C1C' }}>
                          This email has used all <strong>3 free assessments</strong>. Please use a different email or contact us to unlock more.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Unified OTP panel — shown after Send is clicked ── */}
                {isOtpActive && (
                  <div className="mt-2.5 rounded-xl overflow-hidden" style={{ border: '1px solid #A5B4FC', backgroundColor: '#EEF2FF' }}>
                    <div className="px-3.5 py-3">
                      <div className="flex items-center gap-2 mb-2.5">
                        <KeyRound size={13} style={{ color: '#4338CA' }} />
                        <p className="text-[13px] font-semibold leading-snug" style={{ color: '#312E81' }}>
                          Enter the 6-digit code sent to your inbox
                        </p>
                      </div>

                      <div className="flex gap-2 mb-2.5">
                        {introOtpDigits.map((d, i) => (
                          <input
                            key={i}
                            ref={el => { introOtpRefs.current[i] = el; }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={d}
                            onChange={e => {
                              const val = e.target.value.replace(/\D/g, '');
                              const next = [...introOtpDigits];
                              next[i] = val.slice(-1);
                              setIntroOtpDigits(next);
                              if (val && i < 5) introOtpRefs.current[i + 1]?.focus();
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Backspace' && !introOtpDigits[i] && i > 0) {
                                introOtpRefs.current[i - 1]?.focus();
                              }
                            }}
                            onPaste={e => {
                              e.preventDefault();
                              const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                              const next = ['', '', '', '', '', ''];
                              for (let j = 0; j < paste.length; j++) next[j] = paste[j];
                              setIntroOtpDigits(next);
                              introOtpRefs.current[Math.min(paste.length, 5)]?.focus();
                            }}
                            className="w-10 h-10 text-center rounded-lg border-2 text-[18px] font-bold focus:outline-none transition-all"
                            style={{
                              borderColor: introOtpError ? '#EF4444' : d ? '#4338CA' : '#E5E7EB',
                              backgroundColor: d ? '#E0E7FF' : '#FAFAFA',
                              color: '#312E81',
                            }}
                          />
                        ))}
                      </div>

                      {introOtpError && (
                        <p className="text-[12px] text-red-500 mb-2 flex items-center gap-1">
                          <AlertCircle size={11} className="shrink-0" />
                          {introOtpError}
                        </p>
                      )}

                      <div className="flex items-center justify-between">
                        <button
                          onClick={handleIntroOtpResend}
                          disabled={introOtpTimer > 0}
                          className="text-[12px] font-medium transition-colors"
                          style={{ color: introOtpTimer > 0 ? '#9CA3AF' : '#4338CA' }}
                        >
                          {introOtpTimer > 0 ? `Resend in ${introOtpTimer}s` : 'Resend code'}
                        </button>
                        {introOtpLoading ? (
                          <span className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: '#4338CA' }}>
                            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            Verifying…
                          </span>
                        ) : (
                          <span className="text-[12px]" style={{ color: '#9CA3AF' }}>Auto-verifies when complete</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            </>)}

          </div>{/* end scrollable area */}

          {/* ── Sticky bottom: privacy note + error + CTA ── */}
          <div className="px-6 pb-6 pt-3 bg-white border-t border-gray-50">
            {/* ── Privacy note ── */}
            <div className="flex items-center gap-2 mb-3">
              <Shield size={11} className="text-gray-300 shrink-0" />
              <p className="text-[13px] text-gray-400">Private · never shared · used only to generate your report</p>
            </div>

            {/* ── Incomplete session resume prompt ── */}
            {!returningIntent && introEmailVerified && incompleteSession && (
              <div className="mb-3 rounded-2xl overflow-hidden border" style={{ borderColor: '#D1FAE5', backgroundColor: '#F0FDF4' }}>
                {/* Header */}
                <div className="flex items-center gap-2 px-4 py-2.5" style={{ backgroundColor: '#DCFCE7', borderBottom: '1px solid #D1FAE5' }}>
                  <Clock size={13} style={{ color: '#059669' }} />
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#059669' }}>
                    Unfinished Assessment Found
                  </span>
                </div>
                {/* Body */}
                <div className="px-4 py-3">
                  <p className="text-[13.5px] font-semibold mb-0.5" style={{ color: '#065F46' }}>
                    {incompleteSession.concern_name}
                  </p>
                  <p className="text-[12px] mb-3" style={{ color: '#6B7280' }}>
                    You answered {incompleteSession.answered_items} of {incompleteSession.total_items} questions —
                    pick up exactly where you left off, or start fresh.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleContinueIncomplete}
                      disabled={continueLoading}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12.5px] font-semibold transition-all active:scale-[0.98] disabled:opacity-60"
                      style={{ backgroundColor: '#059669', color: '#fff' }}
                    >
                      {continueLoading ? (
                        <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Loading…</>
                      ) : (
                        <><ArrowRight size={13} /> Continue Assessment</>
                      )}
                    </button>
                    <button
                      onClick={handleStartFresh}
                      className="flex-1 py-2 rounded-xl text-[12.5px] font-semibold transition-all active:scale-[0.98]"
                      style={{ backgroundColor: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB' }}
                    >
                      Start Fresh Instead
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Error banner ── */}
            {capadexError && (
              <div className="flex items-start gap-2 mb-3 px-3 py-2.5 rounded-xl bg-red-50 border border-red-100">
                <AlertCircle size={13} className="text-red-400 mt-0.5 shrink-0" />
                <p className="text-[15px] text-red-600 leading-snug">{capadexError}</p>
              </div>
            )}

            {!returningIntent && (() => {
              // ── Field-level validity ────────────────────────────────────
              // Computed inline so the CTA's own click handler can decide
              // whether to invoke /analyze OR flip `triedSubmit` to paint
              // red borders + inline hints across the form. Age-band check
              // uses the canonical AGE_BANDS whitelist (dash-normalised)
              // rather than the numeric `userAge` range so a stale legacy
              // numeric value can't silently mask a missing band selection.
              const missingPersona = !selectedPersona;
              // Anonymous school child → name is hidden, so it never blocks.
              const missingName    = (isSchoolChild && anonymousChild) ? false : participantName.trim().length < 2;
              // Non-anonymous school child → full guardian sign-off is mandatory.
              const missingConsent = consentRequired && (
                guardianName.trim().length < 2 || !guardianRelationship || !consentAccepted
              );
              const missingBand    = !ageBand || !isCanonicalAgeBand(ageBand);
              // Exact age is an OPTIONAL enrichment input — an empty value never
              // blocks. Only a present, out-of-range value is invalid; the
              // required age gate is the canonical band selection (missingBand).
              const numericInvalid = (() => {
                if (!selectedPersona || !userAge) return false;
                const r = getAgeRange(selectedPersona, selectedPersona === 'parent' ? 'my-child' : selectedPersona === 'teacher' ? 'a-student' : 'myself');
                const n = parseInt(userAge, 10);
                return isNaN(n) || n < r.min || n > r.max;
              })();
              const missingAge     = missingBand || numericInvalid;
              const missingConcern = selectedConcerns.length === 0 && !selectedConcern && concernSearch.trim().length < 3;
              const missingEmail   = !isEmailValid || emailInvalid || !introEmailVerified;
              const formInvalid    = missingPersona || missingName || missingConsent || missingAge || missingConcern || missingEmail || introEmailStatus === 'limited';
              return (
            <Button
              className="w-full h-11 text-sm font-semibold rounded-xl text-white transition-opacity"
              style={{
                backgroundColor: introEmailVerified ? '#344E86' : '#94a3b8',
                opacity: formInvalid ? 0.4 : 1,
                cursor: formInvalid ? 'not-allowed' : 'pointer',
              }}
              onClick={() => {
                // First click while invalid → reveal red borders + inline
                // hints across the form. Subsequent invalid clicks are a
                // no-op (the visual feedback is already showing).
                if (formInvalid) { setTriedSubmit(true); return; }
                const concern = selectedConcerns[0] || selectedConcern || concernSearch.trim();
                if (concern) handleAnalyseConcern(concern);
              }}
              aria-disabled={formInvalid}
              data-testid="btn-begin-assessment"
            >
              {!selectedPersona
                ? 'Select your profile to begin'
                : missingName
                ? (isSchoolChild ? "Enter the child's name to continue" : `Enter ${personaCfg.f1Label.toLowerCase()} to continue`)
                : (!ageBand || !isCanonicalAgeBand(ageBand))
                ? 'Select an age group to continue'
                : selectedConcerns.length === 0 && !selectedConcern && concernSearch.trim().length < 3
                ? 'Describe your concern to begin'
                : missingConsent
                ? 'Complete parent / guardian consent to continue'
                : introEmailStatus === 'limited'
                ? 'Assessment limit reached — use a different email'
                : emailInvalid || !isEmailValid
                ? 'Enter a valid email to continue'
                : !introEmailVerified
                ? 'Verify your email above to continue'
                : selectedConcerns.length > 1
                ? `Launch Clarity Journey · ${selectedConcerns.length} Concerns`
                : 'Launch Clarity Journey'}
              {introEmailVerified && selectedPersona && concernReady && introEmailStatus !== 'limited' && <ArrowRight size={15} className="ml-1.5" />}
            </Button>
              );
            })()}
          </div>
          </div>
  );
}
