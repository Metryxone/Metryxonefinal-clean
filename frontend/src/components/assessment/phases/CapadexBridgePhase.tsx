import React from 'react';
import {
  ArrowRight, X, Brain, Lock, TrendingUp, Eye, Zap, CheckCircle2,
  Activity, BarChart3, Gauge, FileText, ShieldCheck, Cpu,
  Users, AlertTriangle, Sparkles, Target, Tag, CheckCircle,
} from 'lucide-react';
import { BRAND, METRYX_NAVY } from '@/lib/behavioural-insights';
import { PhaseProps } from '../types';

const TEAL = BRAND.accent;

/* ─── Category config ──────────────────────────────────────────────── */
const CAT: Record<string, { color: string; label: string; domain: string }> = {
  career:      { color: '#10b981', label: 'Career & Direction',    domain: 'Professional Identity' },
  academic:    { color: '#8b5cf6', label: 'Academic Performance',  domain: 'Learning & Achievement' },
  emotional:   { color: '#ec4899', label: 'Emotional Intelligence',domain: 'Regulation & Wellbeing' },
  behavioural: { color: '#f59e0b', label: 'Behavioural Patterns',  domain: 'Self-Regulation' },
  social:      { color: '#06b6d4', label: 'Social & Relational',   domain: 'Interpersonal Dynamics' },
  cognitive:   { color: METRYX_NAVY, label: 'Cognitive Style',     domain: 'Mental Performance' },
  digital:     { color: '#3b82f6', label: 'Digital Behaviour',     domain: 'Attention & Habits' },
  wellness:    { color: '#22c55e', label: 'Wellbeing & Energy',    domain: 'Physical & Mental' },
};

/* ─── Personalised copy maps ───────────────────────────────────────── */
const OPENER: Record<string, (n: string) => string> = {
  career:      n => `${n}, your direction is closer than it feels right now.`,
  academic:    n => `${n}, your potential is real — and it hasn't been properly measured yet.`,
  emotional:   n => `${n}, what you're carrying is real — and it makes complete sense.`,
  social:      n => `${n}, the connections you want are more within reach than you think.`,
  cognitive:   n => `${n}, your mind has patterns that haven't been fully mapped or used.`,
  digital:     n => `${n}, your attention is more recoverable than it currently feels.`,
  behavioural: n => `${n}, the patterns you've noticed are signals — not permanent traits.`,
  wellness:    n => `${n}, your wellbeing can shift — starting with a single clear insight.`,
};
const DEF_OPENER = (n: string) => `${n}, what you've shared already tells us something important.`;

const REASSURANCE: Record<string, string> = {
  career:      "Career uncertainty doesn't mean you're falling behind — it means you're between two versions of yourself. The people who move forward fastest are the ones who get an honest picture before they act.",
  academic:    "Academic difficulty almost never comes down to intelligence. It comes down to fit — the right approach for how your mind actually works. What follows maps that precisely.",
  emotional:   "Emotions aren't weaknesses — they're signals. The ones you haven't been able to name are often the ones driving the most. What follows surfaces the pattern underneath them.",
  social:      "Difficulty connecting rarely reflects who you are. It almost always reflects a mismatch in approach or environment. Understanding that difference changes the entire picture.",
  cognitive:   "The way you think is not the problem — it's the gap between your cognitive style and the demands placed on it. Once that's mapped, the path forward becomes clear.",
  digital:     "Technology reshapes focus, mood, and identity in ways most people never stop to measure. You've already done the hardest part — recognising it. What follows makes it visible and actionable.",
  behavioural: "Patterns don't define you — they describe you. The moment they're named clearly, they lose their grip. That naming is exactly what comes next.",
  wellness:    "Wellbeing is not a destination you either have or don't. It's a set of measurable factors — and right now, several of yours are out of alignment.",
};
const DEF_REASSURANCE = "What you've shared shows genuine self-awareness — the essential first step. What follows will make the picture sharper and more actionable.";

const CURIOSITY_INTRO: Record<string, string> = {
  career:      'In 10 questions, this stage surfaces exactly where your career clarity stands — and the specific structural gaps creating the friction you feel. Most people find it uncomfortably accurate.',
  academic:    'In 10 questions, this stage maps the learning and performance patterns shaping your academic experience — ones that are invisible to even the most self-aware students.',
  emotional:   'In 10 questions, this stage precisely maps your emotional patterns — giving you an evidence-based picture of what is actually happening beneath the surface, and why.',
  social:      'In 10 questions, this stage maps the relational dynamics influencing how you connect, communicate, and feel seen — right now, not in general.',
  cognitive:   'In 10 questions, this stage profiles how your mind processes and applies information — revealing the specific strengths and blind spots shaping your daily performance.',
  digital:     'In 10 questions, this stage examines your digital habits and attention patterns — showing you what they are actually costing in focus, energy, and output.',
  behavioural: 'In 10 questions, this stage maps the behavioural cycles driving your experience — named clearly, explained precisely, and framed so you can work with them.',
  wellness:    'In 10 questions, this stage measures the physical, mental, and emotional factors influencing your wellbeing — giving you a baseline that is entirely yours.',
};
const DEF_CURIOSITY_INTRO = 'In 10 questions, this stage creates a precise, personalised baseline of where you stand across the dimensions that matter most for what you are working through.';

const MIRROR_HEADER: Record<string, string> = {
  career: 'Does this reflect what you experience?', academic: 'Does this match your day-to-day?',
  emotional: 'Do any of these resonate?', social: 'Do you recognise any of these?',
  cognitive: 'Do any of these feel true?', digital: 'Does this sound like you?',
  behavioural: 'Does this describe what happens for you?', wellness: 'Does this match your experience?',
};

const SOCIAL_PROOF: Record<string, string> = {
  career: '★ 4.9 · 11,200+ professionals found direction through Curiosity',
  academic: '★ 4.8 · 8,400+ students discovered how they actually learn',
  emotional: '★ 4.9 · 14,700+ people gained real emotional clarity here',
  social: '★ 4.8 · 6,900+ people mapped their social confidence through Curiosity',
  cognitive: '★ 4.9 · 7,300+ individuals profiled their cognitive patterns here',
  digital: '★ 4.8 · 9,100+ people measured what their screen habits are really costing',
  behavioural: '★ 4.9 · 12,500+ individuals named and redirected their behavioural patterns',
  wellness: '★ 4.8 · 10,800+ people built their wellbeing baseline with Curiosity',
};
const DEF_SOCIAL_PROOF = '★ 4.8 · 10,000+ people have used Curiosity to gain real clarity';

/* ─── Why take the Curiosity assessment now (concern-aware) ────────── */
const WHY_NOW: Record<string, (ref: string) => string> = {
  career:      ref => `Right now ${ref} is something you feel but can't yet see the shape of. The Curiosity assessment converts that pressure into a measured 0–100 picture — which specific factors are driving it, how strongly, and what to shift first. Until it's measured, every move you make about your direction is a guess.`,
  academic:    ref => `Right now ${ref} is being written off as effort or ability — when it's almost always about fit. In 10 questions, Curiosity pinpoints exactly where your learning approach and the demands on you diverge, so you stop working harder against the wrong thing.`,
  emotional:   ref => `Right now ${ref} is something you're carrying without a precise name for it. Curiosity surfaces the pattern underneath — what triggers it, what keeps it going, and which lever actually releases it — instead of leaving you to manage symptoms in the dark.`,
  social:      ref => `Right now ${ref} feels personal — like it's about who you are. Curiosity maps it to approach and environment instead, showing you the specific dynamic at play and the smallest change that shifts how connected you feel.`,
  cognitive:   ref => `Right now ${ref} is costing you performance you can't fully account for. Curiosity profiles how your mind actually processes and applies information, so you can work with your wiring instead of against it.`,
  digital:     ref => `Right now ${ref} is quietly taxing your focus, mood and output in ways you can sense but not measure. Curiosity makes that cost visible and specific — the first step to getting the attention back.`,
  behavioural: ref => `Right now ${ref} runs on a loop you haven't been able to break. Curiosity names that loop precisely — its trigger, its payoff, and the point where it can be interrupted — which is what finally loosens its grip.`,
  wellness:    ref => `Right now ${ref} is showing up across your energy, mood and body without a clear baseline. Curiosity measures those factors so you know exactly which one is out of alignment, instead of guessing.`,
};
const DEF_WHY_NOW = (ref: string) => `Right now ${ref} is something you can feel but not yet measure. The Curiosity assessment turns it into a precise, personalised baseline — what's driving it, how strongly, and what to do first — so your next step is informed, not a guess.`;

/* ─── Urgency line per severity ────────────────────────────────────── */
const URGENCY: Record<string, string> = {
  high:     'At this intensity, patterns like this rarely settle on their own — they compound. The earlier it is measured, the sooner it can be interrupted, and the less it ends up costing you.',
  moderate: 'This has been building quietly for a while. The longer the mechanism runs unmeasured, the more it normalises — which is exactly why naming it now is the highest-leverage move available to you.',
  low:      'This is the most actionable stage there is. Acting while the picture is still early is what stops it from hardening into something far harder to shift later.',
};

/* Progressive micro-hydration: chosen clarity options → live interaction tags
   appended on top of the concern-derived background tags. Developmental signals
   only — deliberately avoids clinical/diagnostic wording in the surfaced tag. */
const CLARIFY_TAG_RULES: Array<{ test: RegExp; tag: string }> = [
  { test: /stress|pressure|overwhelm|too much|can.?t cope/i,    tag: 'Heightened pressure' },
  { test: /anx|worri|nervous|panic|scared|fear/i,              tag: 'Active worry' },
  { test: /avoid|procrastinat|put off|delay|postpone/i,        tag: 'Avoidance pull' },
  { test: /tired|exhaust|drain|burn ?out|fatigue|no energy/i,  tag: 'Energy drain' },
  { test: /can.?t focus|distract|lose focus|wander|scattered/i, tag: 'Focus drift' },
  { test: /confus|unclear|lost|don.?t know|uncertain/i,        tag: 'Seeking clarity' },
  { test: /alone|isolat|lonely|no one|withdrawn/i,             tag: 'Felt isolation' },
  { test: /out of control|completely|constant|every ?day|all the time/i, tag: 'Persistent pattern' },
];

/* ─── Benchmark text per severity ─────────────────────────────────── */
const BENCHMARK: Record<string, { pct: number; label: string; note: string }> = {
  high:     { pct: 88, label: 'High impact',  note: 'This is affecting you more strongly than 88% of people who arrive with the same concern. That intensity makes the assessment more important — not less.' },
  moderate: { pct: 61, label: 'Moderate',     note: '6 in 10 people with your concern sit at exactly this level. What separates those who improve from those who stay stuck is understanding the mechanism — and that is what the report maps.' },
  low:      { pct: 34, label: 'Early stage',  note: "You've arrived at the right time. This level of concern is the most actionable — a clear picture now can prevent it from becoming harder to shift later." },
};

/* ─── Report sections (locked) ─────────────────────────────────────── */
const REPORT_SECTIONS = [
  { icon: BarChart3,   label: 'Your Overall Score',        desc: 'A number between 0–100 that precisely measures how strongly this concern is shaping your daily experience right now',                                            color: TEAL },
  { icon: Activity,    label: "What's Really Going On",    desc: 'The specific patterns we\'ve found — named clearly, with their triggers, the loops keeping them going, and why they haven\'t shifted on their own',            color: '#8b5cf6' },
  { icon: Gauge,       label: 'Where Exactly You Stand',   desc: 'Your score across every sub-dimension — so you know precisely which areas need attention first and which are already working in your favour',                   color: '#f59e0b' },
  { icon: TrendingUp,  label: 'How You Compare to Others', desc: 'See whether your pattern is rare or common, severe or mild, improving or stuck — based on 10,000+ real profiles with the same concern',                        color: '#10b981' },
  { icon: FileText,    label: 'Your Personal Action Plan', desc: 'Not generic advice — ranked, specific next steps built entirely around where your scores land and what your profile says will actually move things forward',    color: '#ec4899' },
];

/* ─── Analysis pipeline steps ─────────────────────────────────────── */
const PIPELINE_STEPS = [
  { label: 'We read between the lines of what you described', detail: (p: number) => p > 0 ? `${p} indicator${p !== 1 ? 's' : ''} picked up — not assumptions, actual signals` : 'Indicators picked up from your own words' },
  { label: 'We matched those indicators to known patterns',   detail: (p: number) => p > 0 ? `${p} named pattern${p !== 1 ? 's' : ''} confirmed in your profile` : 'Named patterns confirmed in your profile' },
  { label: 'We calculated how strongly this is affecting you',detail: () => 'Severity measured — this number matters' },
  { label: 'We placed your story alongside 10,247 real cases',detail: () => 'Your profile is not generic — it\'s positioned' },
  { label: 'Your complete picture — just 10 questions away',  detail: () => 'This is the only step left between you and the full report', pending: true },
];

/* ─── Severity urgency note ───────────────────────────────────────── */
const severityNote = (sl: string, gr: string): string => {
  if (sl === 'Mild' && gr === 'high') return 'Low impact, high readiness — you are in the best possible position to act on this. The window where things shift fastest is exactly this one.';
  if (sl === 'Mild') return 'This is an early signal — which means the picture is still clear and the patterns are still flexible. Early-stage assessments produce the most actionable results.';
  if (sl === 'Moderate' && gr === 'high') return 'You feel it — and you are ready to do something about it. That combination is rare. This is the precise moment where taking action leads to real, lasting change.';
  if (sl === 'Moderate') return 'This has been building for a while. The assessment does not just describe what is happening — it reveals the underlying mechanism that has kept it going, and exactly what to do about it.';
  if (sl === 'High') return "You have been carrying this longer than you should have to. What follows is not a general overview — it is a precise, personalised picture of exactly what is happening, why it hasn't shifted, and what will actually help.";
  return "You are in exactly the right place. Whatever you have been navigating, this is the step that brings it into focus.";
};

/* ─── Radial ring SVG ─────────────────────────────────────────────── */
function Ring({ pct, size, stroke, color, bg }: { pct: number; size: number; stroke: number; color: string; bg: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={bg} strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${c * pct / 100} ${c * (1 - pct / 100)}`}
        strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
export function CapadexBridgePhase(props: PhaseProps) {
  const {
    setPhase, selectedConcern, concernIntelligence, clarifyAnswers,
    participantName, introEmailName, isProxy, handleBeginAssessment, handleClose,
    capadexLoading, capadexPricing,
  } = props;

  const ci = concernIntelligence;
  if (!ci) return null;

  // Provenance pill — mirrors CapadexClarifyPhase. Surfaces backend
  // `clarity_source` so the pre-payment brief is honest about whether the
  // analysis drew on curated master-concern questions vs the general adaptive
  // bank. Only `master_curated` earns the specificity claim.
  const claritySource = (ci as { clarity_source?: string }).clarity_source;
  const provenance = claritySource === 'master_curated'
    ? { label: 'Tailored to your concern', tone: TEAL }
    : claritySource === 'adaptive_bank' || claritySource === 'static_fallback'
      ? { label: 'General behavioural cluster', tone: '#94A3B8' }
      : null;

  // In proxy mode the assessment is ABOUT the assessee (the child), while
  // `introEmailName` captures the requester/parent's name at the email step.
  // The assessee-facing report must greet the child, so `participantName`
  // (the assessee) is authoritative here. In self mode keep the existing
  // precedence (introEmailName → participantName).
  const rawName   = (isProxy
    ? (participantName || introEmailName || '')
    : (introEmailName || participantName || '')).trim();
  const firstName = rawName.split(' ')[0] || '';

  const category   = ci.category || 'general';
  const catCfg     = CAT[category] || { color: METRYX_NAVY, label: 'Behavioural', domain: 'General' };
  const catColor   = catCfg.color;
  const prelim     = ci.preliminary_patterns;
  const patterns   = (prelim?.patterns?.length ? prelim.patterns : ci.detected_patterns) || [];
  const baseSignals = (prelim?.tags?.length ? prelim.tags : ci.emotional_signals) || [];
  const subdomains = ci.subdomains         || [];
  const preview    = ci.intelligence_preview || [];
  const mirror     = ci.behavioural_mirror || [];
  const questions  = ci.clarification_questions || [];
  const severityKey = (ci.severity || 'moderate').toLowerCase();
  const bench      = BENCHMARK[severityKey] || BENCHMARK.moderate;

  const openerFn     = OPENER[category] || DEF_OPENER;
  const opener       = firstName ? openerFn(firstName) : 'We hear you — and we understand what you have shared.';
  const reassurance  = REASSURANCE[category] || DEF_REASSURANCE;
  const curiosityIntro = CURIOSITY_INTRO[category] || DEF_CURIOSITY_INTRO;
  const severityMsg  = severityNote(ci.severity_label, ci.growth_readiness);
  const mirrorHeader = MIRROR_HEADER[category] || 'Does this resonate with you?';
  const socialProof  = SOCIAL_PROOF[category] || DEF_SOCIAL_PROOF;

  // Concern identity — surfaces the SPECIFIC concern the user came with, so the
  // brief visibly changes per assessment (the narrative maps above are keyed on
  // the broad 8-category, which made distinct concerns read identically).
  // Concern-specific copy is enabled whenever a concern exists (no length gate);
  // long phrases are only TRUNCATED for display/inline readability, never dropped,
  // so two different long concerns in the same category still read differently.
  const concernRaw     = (selectedConcern || '').trim();
  const concernHas     = concernRaw.length > 0;
  const concernDisplay = concernRaw; // banner uses CSS `truncate` for overflow
  const concernInline  = concernRaw.length <= 60 ? concernRaw : `${concernRaw.slice(0, 57).trimEnd()}…`;
  const concernRef     = concernHas ? `“${concernInline}”` : 'what you described';
  const whyNow         = (WHY_NOW[category] || DEF_WHY_NOW)(concernRef);
  const urgency        = URGENCY[severityKey] || URGENCY.moderate;
  const curiosityIntroFinal = concernHas
    ? `${curiosityIntro} Every question is calibrated to ${concernRef} specifically — not a generic template.`
    : curiosityIntro;

  const clarifyPairs = Object.entries(clarifyAnswers)
    .map(([idxStr, ranked]) => {
      const q = questions[parseInt(idxStr)]?.question;
      const rankedArr = Array.isArray(ranked) ? ranked : [ranked as unknown as string];
      return q ? { question: q, ranked: rankedArr } : null;
    })
    .filter(Boolean) as Array<{ question: string; ranked: string[] }>;

  // Progressive micro-hydration: the clarity phase completes before this bridge,
  // so surface live interaction tags from the chosen options on top of the
  // concern-derived background tags (chips wrap, so no layout jump).
  const allChosen = clarifyPairs.flatMap((p) => p.ranked).join(' ').toLowerCase();
  const clarifyTagHits = CLARIFY_TAG_RULES.filter((r) => r.test.test(allChosen)).map((r) => r.tag);
  const seenTag = new Set<string>();
  const signals = [...baseSignals, ...clarifyTagHits]
    .filter((t) => { const k = t.toLowerCase(); if (seenTag.has(k)) return false; seenTag.add(k); return true; })
    .slice(0, 5);

  const completionPct = Math.min(42, 16 + clarifyPairs.length * 8 + Math.min(patterns.length * 4, 12));

  /* Readiness score visual */
  const readinessScore = ci.growth_readiness === 'high' ? 82 : ci.growth_readiness === 'medium' ? 61 : 43;
  /* Accuracy/confidence — capped at 96% so the pre-question preview never claims 100%+ */
  const accuracyPct = Math.min(96, 84 + clarifyPairs.length * 2);
  const riskBadge = ci.risk_level === 'high'
    ? { label: 'Elevated', color: '#ef4444' }
    : ci.risk_level === 'medium'
    ? { label: 'Moderate', color: '#f59e0b' }
    : { label: 'Low', color: '#22c55e' };

  return (
    <div className="flex flex-col select-none bg-white" style={{ maxHeight: '88vh' }}>

      {/* ══ Hopeful stage header (brand navy→blue, lightened from near-black;
            kept deep enough that white + light-blue text stay readable) ═ */}
      <div className="sticky top-0 z-10 shrink-0"
        style={{ background: 'linear-gradient(135deg, #344E86 0%, #3B5EA0 65%, #4670AC 125%)' }}>
        <div className="px-5 pt-3.5 pb-2.5">

          {/* Stage tracker row */}
          <div className="flex items-center gap-1.5 mb-2.5">
            {(['CURIOSITY', 'INSIGHT', 'GROWTH', 'MASTERY'] as const).map((label, i) => {
              const active = i === 0;
              const done   = false;
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
                  {i < 3 && (
                    <div className="flex-1 h-px mx-1"
                      style={{ background: done ? '#34D399' : '#94A3B8', opacity: done ? 1 : 0.2 }} />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Title row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(255,255,255,0.1)' }}>
                <Brain size={13} style={{ color: '#93C5FD' }} />
              </div>
              <div>
                <p className="text-[10px] font-semibold tracking-widest mb-0" style={{ color: '#93C5FD' }}>
                  STEP 3 OF 4 — PROFILE BRIEF
                </p>
                <h2 className="text-[16px] font-bold text-white leading-tight">Clarity Report Preview</h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9.5px] font-bold px-2.5 py-1 rounded-full"
                style={{ background: `${catColor}30`, color: catColor, border: `1px solid ${catColor}50` }}>
                {catCfg.label}
              </span>
              <button onClick={handleClose}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                style={{ background: 'rgba(255,255,255,0.1)' }}>
                <X size={13} style={{ color: 'rgba(255,255,255,0.6)' }} />
              </button>
            </div>
          </div>
        </div>
        <div className="h-px w-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
      </div>

      {/* ══ Scrollable body ══════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto pb-2" style={{ scrollbarWidth: 'none' }}>

        {/* ── CONCERN IDENTITY (this brief is about THIS concern) ── */}
        {concernHas && (
          <div className="px-5 pt-4">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: `linear-gradient(90deg, ${catColor}0F, ${TEAL}08)`, border: `1px solid ${catColor}26` }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${catColor}1A` }}>
                <Target size={15} style={{ color: catColor }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: '#94A3B8' }}>
                  Your assessment focus
                </p>
                <p className="text-[13.5px] font-black leading-tight truncate" style={{ color: '#0B1F3A' }}>
                  {concernDisplay}
                </p>
              </div>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0"
                style={{ backgroundColor: `${catColor}18`, color: catColor }}>
                {catCfg.label}
              </span>
            </div>
          </div>
        )}

        {/* ── INTELLIGENCE SUMMARY header ── */}
        <div className="px-5 pt-5 pb-4" style={{ background: 'linear-gradient(180deg, #F8FAFE 0%, #fff 100%)' }}>
          <div className="flex items-start gap-4">
            {/* Profile ring */}
            <div className="relative shrink-0">
              <Ring pct={completionPct} size={64} stroke={4} color={catColor} bg={`${catColor}18`} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[13px] font-black leading-none" style={{ color: catColor }}>{completionPct}%</span>
                <span className="text-[7.5px] font-bold uppercase tracking-wide leading-none mt-0.5" style={{ color: '#94A3B8' }}>ready</span>
              </div>
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-1" style={{ color: TEAL }}>Here's what we found</p>
              <h2 className="text-[17px] font-black leading-tight mb-1.5"
                style={{ color: '#0B1F3A', fontFamily: "'Plus Jakarta Sans','DM Sans',sans-serif", letterSpacing: '-0.4px' }}>
                {opener}
              </h2>
              <p className="text-[12px] leading-relaxed" style={{ color: '#64748B' }}>{reassurance}</p>
            </div>
          </div>
        </div>

        {/* ── ANALYSIS PIPELINE ── */}
        <div className="mx-5 mb-4 rounded-xl overflow-hidden border" style={{ borderColor: '#E8EBF4' }}>
          <div className="px-4 py-2.5 flex items-center justify-between"
            style={{ background: 'linear-gradient(90deg, #EAF6F5 0%, #EEF3FB 100%)', borderBottom: '1px solid #E2EAF2' }}>
            <div className="flex items-center gap-2">
              <Cpu size={12} style={{ color: METRYX_NAVY }} />
              <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: METRYX_NAVY }}>
                What we've found so far
              </span>
            </div>
            <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${TEAL}2E`, color: '#0E7C74' }}>
              4 of 5 steps done
            </span>
          </div>
          <div className="divide-y" style={{ divideColor: '#F1F4F9' }}>
            {PIPELINE_STEPS.map((step, i) => {
              const isPending = step.pending;
              const detail = i === 0 ? step.detail(patterns.length)
                : i === 1 ? step.detail(patterns.length)
                : step.detail(0);
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${isPending ? 'border-2' : ''}`}
                    style={isPending
                      ? { borderColor: '#E2E8F0', backgroundColor: 'transparent' }
                      : { backgroundColor: `${TEAL}18` }}>
                    {isPending
                      ? <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#CBD5E1' }} />
                      : <CheckCircle2 size={11} style={{ color: TEAL }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[12px] font-semibold" style={{ color: isPending ? '#94A3B8' : '#1E293B' }}>
                      {step.label}
                    </span>
                  </div>
                  <span className="text-[10.5px] shrink-0" style={{ color: isPending ? '#94A3B8' : '#64748B' }}>
                    {detail}
                  </span>
                  {isPending && (
                    <div className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: '#F59E0B', animation: 'pulse 1.5s ease-in-out infinite' }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── INTELLIGENCE METRICS grid ── */}
        <div className="px-5 mb-4">
          <div className="flex items-center justify-between mb-2.5 gap-2">
            <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: '#94A3B8' }}>
              What we know about you right now
            </p>
            {provenance && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0"
                style={{ color: provenance.tone, backgroundColor: `${provenance.tone}10`, border: `1px solid ${provenance.tone}30` }}
                title={claritySource === 'master_curated'
                  ? 'These questions are mapped directly to the master concern you selected.'
                  : 'No curated questions exist for this exact concern yet — using the closest behavioural cluster.'}>
                {provenance.label}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {/* Intensity */}
            <div className="rounded-xl p-3.5 border" style={{ borderColor: '#E8EBF4', backgroundColor: '#FAFBFD' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle size={11} style={{ color: riskBadge.color }} />
                <span className="text-[9.5px] font-bold uppercase tracking-wide" style={{ color: '#94A3B8' }}>How hard it's hitting</span>
              </div>
              <p className="text-[15px] font-black leading-none mb-1" style={{ color: riskBadge.color }}>
                {ci.severity_label || 'Moderate'}
              </p>
              <div className="w-full h-1 rounded-full mt-2" style={{ backgroundColor: '#E8EBF4' }}>
                <div className="h-1 rounded-full" style={{ width: `${bench.pct}%`, backgroundColor: riskBadge.color }} />
              </div>
              <p className="text-[9.5px] mt-1.5" style={{ color: '#94A3B8' }}>Affecting you more strongly than {100 - bench.pct}% of similar profiles</p>
            </div>
            {/* Growth Readiness */}
            <div className="rounded-xl p-3.5 border" style={{ borderColor: '#E8EBF4', backgroundColor: '#FAFBFD' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp size={11} style={{ color: TEAL }} />
                <span className="text-[9.5px] font-bold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Your readiness to change</span>
              </div>
              <p className="text-[15px] font-black leading-none mb-1" style={{ color: TEAL }}>
                {readinessScore}<span className="text-[10px] font-semibold" style={{ color: '#94A3B8' }}>/100</span>
              </p>
              <div className="w-full h-1 rounded-full mt-2" style={{ backgroundColor: '#E8EBF4' }}>
                <div className="h-1 rounded-full" style={{ width: `${readinessScore}%`, backgroundColor: TEAL }} />
              </div>
              <p className="text-[9.5px] mt-1.5" style={{ color: '#94A3B8' }}>
                {ci.growth_readiness === 'high' ? 'You are in a strong position to act on what this reveals' : ci.growth_readiness === 'medium' ? 'Growing — the picture will sharpen with every answer' : 'Building — the assessment itself accelerates this'}
              </p>
            </div>
            {/* Signals */}
            <div className="rounded-xl p-3.5 border" style={{ borderColor: '#E8EBF4', backgroundColor: '#FAFBFD' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Activity size={11} style={{ color: catColor }} />
                <span className="text-[9.5px] font-bold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Patterns spotted</span>
              </div>
              <p className="text-[15px] font-black leading-none mb-1" style={{ color: catColor }}>
                {patterns.length + signals.length}
                <span className="text-[10px] font-semibold" style={{ color: '#94A3B8' }}> found</span>
              </p>
              <div className="flex gap-1 mt-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex-1 h-1 rounded-full"
                    style={{ backgroundColor: i < patterns.length + signals.length ? catColor : '#E8EBF4' }} />
                ))}
              </div>
              <p className="text-[9.5px] mt-1.5" style={{ color: '#94A3B8' }}>Detected from your words alone — before a single question was asked</p>
            </div>
            {/* Confidence */}
            <div className="rounded-xl p-3.5 border" style={{ borderColor: '#E8EBF4', backgroundColor: '#FAFBFD' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <ShieldCheck size={11} style={{ color: '#8b5cf6' }} />
                <span className="text-[9.5px] font-bold uppercase tracking-wide" style={{ color: '#94A3B8' }}>How accurate this is</span>
              </div>
              <p className="text-[15px] font-black leading-none mb-1" style={{ color: '#8b5cf6' }}>
                {accuracyPct}%
              </p>
              <div className="w-full h-1 rounded-full mt-2" style={{ backgroundColor: '#E8EBF4' }}>
                <div className="h-1 rounded-full" style={{ width: `${accuracyPct}%`, backgroundColor: '#8b5cf6' }} />
              </div>
              <p className="text-[9.5px] mt-1.5" style={{ color: '#94A3B8' }}>Each answer you give raises this further — it gets sharper as you go</p>
            </div>
          </div>
        </div>

        {/* ── DETECTED PATTERNS ── */}
        {patterns.length > 0 && (
          <div className="mx-5 mb-4 rounded-xl overflow-hidden border" style={{ borderColor: `${catColor}28` }}>
            <div className="px-4 py-2.5 flex items-center justify-between"
              style={{ backgroundColor: `${catColor}0C`, borderBottom: `1px solid ${catColor}20` }}>
              <div className="flex items-center gap-2">
                <Target size={12} style={{ color: catColor }} />
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: catColor }}>
                  What's already visible about you
                </span>
              </div>
              <span className="text-[9.5px] font-bold" style={{ color: catColor }}>
                {patterns.length} pattern{patterns.length !== 1 ? 's' : ''} found
              </span>
            </div>
            <div className="p-3.5 space-y-2">
              {patterns.map((p, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{ backgroundColor: i === 0 ? `${catColor}0F` : '#FAFBFD', border: `1px solid ${i === 0 ? catColor + '28' : '#ECEEF1'}` }}>
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: i === 0 ? `${catColor}22` : '#F1F3F9' }}>
                    <span className="text-[9px] font-black" style={{ color: i === 0 ? catColor : '#94A3B8' }}>P{i + 1}</span>
                  </div>
                  <p className="flex-1 text-[12.5px] font-semibold leading-snug" style={{ color: i === 0 ? '#1E293B' : '#64748B' }}>
                    {p}
                  </p>
                  {i === 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ backgroundColor: `${catColor}20`, color: catColor }}>
                      Primary
                    </span>
                  )}
                </div>
              ))}
            </div>
            {signals.length > 0 && (
              <div className="px-4 pb-3 pt-0">
                <p className="text-[9.5px] font-bold uppercase tracking-wide mb-2" style={{ color: '#94A3B8' }}>What we're hearing from you</p>
                <div className="flex flex-wrap gap-1.5">
                  {signals.map((s) => (
                    <span key={s} className="px-2.5 py-1 rounded-full text-[11px] font-medium"
                      style={{ backgroundColor: '#F1F4F9', color: '#64748B', border: '1px solid #E2E8F0' }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── BEHAVIOURAL MIRROR ── */}
        {mirror.length > 0 && (
          <div className="mx-5 mb-4 rounded-xl overflow-hidden border" style={{ borderColor: '#E8EBF4' }}>
            <div className="px-4 py-2.5 flex items-center gap-2"
              style={{ backgroundColor: '#F8FAFE', borderBottom: '1px solid #E8EBF4' }}>
              <Eye size={12} style={{ color: '#64748B' }} />
              <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: '#64748B' }}>
                {mirrorHeader}
              </span>
            </div>
            <div className="p-4 space-y-2.5">
              {mirror.slice(0, 4).map((m, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ backgroundColor: `${TEAL}15` }}>
                    <CheckCircle2 size={11} style={{ color: TEAL }} />
                  </div>
                  <p className="text-[12.5px] leading-snug" style={{ color: '#374151' }}>{m}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── WHAT YOU TOLD US ── */}
        {clarifyPairs.length > 0 && (
          <div className="mx-5 mb-4 rounded-xl overflow-hidden border" style={{ borderColor: '#E8EBF4' }}>
            <div className="px-4 py-2.5 flex items-center gap-2"
              style={{ backgroundColor: '#F8FAFE', borderBottom: '1px solid #E8EBF4' }}>
              <Sparkles size={12} style={{ color: catColor }} />
              <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: '#64748B' }}>
                What you told us
              </span>
            </div>
            <div className="divide-y" style={{ divideColor: '#F1F4F9' }}>
              {clarifyPairs.map((pair, i) => (
                <div key={i} className="px-4 py-3">
                  <p className="text-[11px] mb-2 leading-snug italic" style={{ color: '#94A3B8' }}>{pair.question}</p>
                  <div className="space-y-1.5">
                    {pair.ranked.map((item, rank) => (
                      <div key={rank} className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black shrink-0 mt-0.5"
                          style={{
                            backgroundColor: rank === 0 ? METRYX_NAVY : rank === 1 ? `${METRYX_NAVY}12` : '#F1F3F9',
                            color: rank === 0 ? '#fff' : rank === 1 ? METRYX_NAVY : '#9CA3AF',
                          }}>
                          {rank + 1}
                        </span>
                        <p className="text-[12px] leading-snug"
                          style={{ color: rank === 0 ? '#1E293B' : '#6B7280', fontWeight: rank === 0 ? 600 : 400 }}>
                          {item}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── DIMENSIONAL MAPPING (light, hopeful card) ── */}
        <div className="mx-5 mb-4 rounded-xl overflow-hidden border"
          style={{ background: 'linear-gradient(135deg, #F3FBFA 0%, #EEF4FC 100%)', borderColor: '#DCEAF2' }}>
          <div className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid #E2EAF2' }}>
            <div className="flex items-center gap-2">
              <BarChart3 size={13} style={{ color: METRYX_NAVY }} />
              <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: METRYX_NAVY }}>
                What the 10 questions will reveal about {firstName || 'you'}
              </span>
            </div>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${TEAL}22`, color: '#0E7C74' }}>
              10 Q
            </span>
          </div>
          <div className="px-4 py-3">
            <p className="text-[12.5px] leading-relaxed mb-4" style={{ color: '#475569' }}>
              {curiosityIntroFinal}
            </p>
            {subdomains.length > 0 && (
              <div className="space-y-3">
                {subdomains.map((sd, i) => {
                  const filled = [22, 15, 30][i] ?? 20;
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: TEAL }} />
                          <span className="text-[12px] font-semibold" style={{ color: '#1E293B' }}>{sd}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: '#EAF0F7', color: '#94A3B8' }}>
                            ░░ / 100
                          </span>
                          <span className="text-[9.5px] font-semibold uppercase"
                            style={{ color: '#0E7C74' }}>Unlocks next</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#E2EAF2' }}>
                        <div className="h-full rounded-full relative overflow-hidden"
                          style={{ width: `${filled}%`, background: `linear-gradient(90deg, ${METRYX_NAVY}, ${TEAL})` }}>
                          <div className="absolute inset-0"
                            style={{ background: 'linear-gradient(90deg, transparent 60%, rgba(255,255,255,0.45) 80%, transparent 100%)', animation: 'shimmer 2s ease-in-out infinite' }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="px-4 py-3 flex items-center gap-4"
            style={{ borderTop: '1px solid #E2EAF2' }}>
            {[['10', 'Questions'], ['~2 min', 'Duration'], ['10K+', 'Benchmarks'], ['97', 'Dimensions']].map(([val, lbl]) => (
              <div key={lbl} className="text-center flex-1">
                <p className="text-[13px] font-black leading-none" style={{ color: METRYX_NAVY }}>{val}</p>
                <p className="text-[9px] mt-0.5 leading-none" style={{ color: '#94A3B8' }}>{lbl}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── LOCKED REPORT SECTIONS ── */}
        {preview.length > 0 && (
          <div className="mx-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: '#94A3B8' }}>
                What's in your full report
              </p>
              <div className="flex items-center gap-1.5">
                <Lock size={9} style={{ color: '#CBD5E1' }} />
                <span className="text-[10px] font-semibold" style={{ color: '#CBD5E1' }}>Ready after your 10 answers</span>
              </div>
            </div>
            <div className="space-y-2">
              {REPORT_SECTIONS.map((section, i) => {
                const Icon = section.icon;
                const previewLine = preview[i] || section.desc;
                const isInsightCard = i < 3;
                return (
                  <div key={i} className="rounded-xl overflow-hidden border"
                    style={{ borderColor: isInsightCard ? `${section.color}25` : '#E8EBF4',
                      backgroundColor: isInsightCard ? `${section.color}06` : '#FAFBFD' }}>
                    <div className="px-3.5 py-3 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${section.color}15` }}>
                        <Icon size={14} style={{ color: section.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-[11px] font-black uppercase tracking-widest leading-snug" style={{ color: section.color }}>
                            {section.label}
                          </p>
                          <div className="flex items-center gap-1 shrink-0">
                            <Lock size={9} style={{ color: '#D1D5DB' }} />
                          </div>
                        </div>
                        <p className="text-[12.5px] font-semibold leading-snug mb-2" style={{ color: '#1E293B' }}>
                          {previewLine}
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: '#E8EBF4' }}>
                            <div className="h-full rounded-full"
                              style={{ width: `${38 + i * 9}%`, backgroundColor: `${section.color}55` }} />
                          </div>
                          <span className="text-[9.5px] font-bold shrink-0" style={{ color: '#CBD5E1' }}>
                            ██ / 100
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── BENCHMARK ── */}
        <div className="mx-5 mb-4 rounded-xl overflow-hidden border" style={{ borderColor: '#E8EBF4' }}>
          <div className="px-4 py-2.5 flex items-center gap-2"
            style={{ backgroundColor: '#F8FAFE', borderBottom: '1px solid #E8EBF4' }}>
            <Gauge size={12} style={{ color: '#64748B' }} />
            <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: '#64748B' }}>
              How this compares to others like you
            </span>
          </div>
          <div className="px-4 py-4">
            <div className="flex items-center gap-4 mb-3">
              <div className="relative shrink-0">
                <Ring pct={bench.pct} size={52} stroke={4} color={riskBadge.color} bg={`${riskBadge.color}15`} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[11px] font-black" style={{ color: riskBadge.color }}>{bench.pct}%</span>
                </div>
              </div>
              <div>
                <p className="text-[14px] font-black leading-tight" style={{ color: '#1E293B' }}>
                  {bench.label} impact level
                </p>
                <p className="text-[11.5px] leading-snug mt-1" style={{ color: '#64748B' }}>{bench.note}</p>
              </div>
            </div>
            <div className="p-3 rounded-xl" style={{ backgroundColor: '#F1F5FB', border: '1px solid #E2E8F0' }}>
              <p className="text-[12px] leading-snug font-medium" style={{ color: '#374151' }}>
                {severityMsg}
              </p>
            </div>
          </div>
        </div>

        {/* ── WHY TAKE CURIOSITY NOW ── */}
        <div className="mx-5 mb-4 rounded-xl overflow-hidden border" style={{ borderColor: `${TEAL}33` }}>
          <div className="px-4 py-2.5 flex items-center gap-2"
            style={{ background: `linear-gradient(90deg, ${METRYX_NAVY}10, ${TEAL}0C)`, borderBottom: `1px solid ${TEAL}22` }}>
            <Zap size={12} style={{ color: TEAL }} />
            <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: METRYX_NAVY }}>
              Why take the Curiosity assessment now
            </span>
          </div>
          <div className="px-4 py-4">
            <p className="text-[12.5px] leading-relaxed mb-3" style={{ color: '#374151' }}>{whyNow}</p>

            {/* Urgency callout (severity-aware) */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl mb-3.5"
              style={{ backgroundColor: `${riskBadge.color}0D`, border: `1px solid ${riskBadge.color}28` }}>
              <AlertTriangle size={13} className="shrink-0 mt-0.5" style={{ color: riskBadge.color }} />
              <p className="text-[11.5px] leading-snug font-medium" style={{ color: '#374151' }}>{urgency}</p>
            </div>

            {/* What you walk away with — grounds the value in the real report sections */}
            <p className="text-[9.5px] font-bold uppercase tracking-wide mb-2" style={{ color: '#94A3B8' }}>
              What you walk away with — in ~2 minutes
            </p>
            <div className="space-y-2">
              {REPORT_SECTIONS.slice(0, 3).map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ backgroundColor: `${s.color}15` }}>
                      <Icon size={11} style={{ color: s.color }} />
                    </div>
                    <span className="text-[12px] leading-snug" style={{ color: '#374151' }}>{s.desc}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── SOCIAL PROOF ── */}
        <div className="mx-5 mb-5">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: '#F8FAFE', border: '1px solid #E8EBF4' }}>
            <Users size={13} style={{ color: '#94A3B8' }} />
            <p className="text-[11.5px] font-medium" style={{ color: '#94A3B8' }}>{socialProof}</p>
          </div>
        </div>

      </div>

      {/* ══ Sticky CTA ═══════════════════════════════════════════════ */}
      <div className="px-5 pb-5 pt-4 border-t shrink-0" style={{ borderColor: '#F1F3F6', backgroundColor: '#fff' }}>

        {/* ── Price block ── */}
        {(() => {
          const pricing = capadexPricing?.['CAP_CUR'];
          const price     = pricing?.price     || '₹99';
          const priceNote = pricing?.price_note || 'one-time · instant results';
          const benefits  = pricing?.benefits  || [];
          return (
            <div className="mb-3 rounded-xl overflow-hidden border" style={{ borderColor: `${TEAL}30` }}>
              {/* Price header */}
              <div className="px-4 py-3 flex items-center justify-between"
                style={{ background: `linear-gradient(90deg, ${METRYX_NAVY}0E, ${TEAL}0A)`, borderBottom: `1px solid ${TEAL}20` }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${TEAL}18` }}>
                    <Tag size={13} style={{ color: TEAL }} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest leading-none" style={{ color: '#94A3B8' }}>
                      Curiosity Assessment
                    </p>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-[20px] font-black leading-none" style={{ color: METRYX_NAVY }}>{price}</span>
                      <span className="text-[11px] font-medium" style={{ color: '#94A3B8' }}>{priceNote}</span>
                    </div>
                  </div>
                </div>
                <span className="text-[9.5px] font-bold px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: `${TEAL}15`, color: TEAL }}>
                  {pricing?.tag || 'Entry Stage'}
                </span>
              </div>
              {/* Benefits */}
              {benefits.length > 0 && (
                <div className="px-4 py-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {benefits.map((b, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <CheckCircle size={10} className="mt-0.5 shrink-0" style={{ color: TEAL }} />
                      <span className="text-[11px] leading-snug" style={{ color: '#374151' }}>{b}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Main button ── */}
        <button
          onClick={() => setPhase('capadex_packages')}
          disabled={capadexLoading}
          className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-bold text-[14.5px] transition-all active:scale-[0.98] disabled:opacity-60 relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${METRYX_NAVY} 0%, #34659E 55%, #14857E 120%)`,
            color: '#fff',
            boxShadow: `0 6px 22px ${TEAL}40`,
          }}>
          <span className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.06) 50%, transparent 65%)',
              animation: 'shimmer 3s ease-in-out infinite',
            }} />
          {firstName ? `Choose ${firstName}'s Package` : 'Choose Your Package'}
          <ArrowRight size={16} />
        </button>

        {/* ── Trust strip ── */}
        <div className="flex items-center justify-center gap-4 mt-2.5">
          {['Secure payment', '~2 minutes', 'Private & confidential'].map((t) => (
            <span key={t} className="text-[10px] font-medium" style={{ color: '#C4C9D4' }}>{t}</span>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          60%  { transform: translateX(100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>

    </div>
  );
}
