/**
 * MX-302C — Career Launchpad Dashboard
 * ----------------------------------------------------------------------------
 * An enterprise-grade, fully responsive decision surface that answers three
 * questions at a glance: *where am I, what should I do next, and how employable
 * am I?* It COMPOSES 15 widgets from metrics/engines that ALREADY exist — this
 * is a dashboard + responsive-UX build, NOT new metric engineering.
 *
 * Gated by the SAME `careerLaunchpad` flag introduced in MX-302A. The render
 * swap lives in CareerBuilderPage: flag-OFF renders <FresherHubTab/> exactly as
 * before (byte-identical); flag-ON renders this dashboard. The full Fresher
 * toolkit (Campus Drives, Projects, Aptitude, First-Job Guide) is preserved and
 * reachable here via the "Toolkit" tab, which renders the unchanged FresherHubTab.
 *
 * Honesty: every widget renders an honest empty state when it has no underlying
 * data (null ≠ 0); no fabricated scores. The Daily AI Brief degrades honestly to
 * a deterministic rule-based brief (inherited from MX-302B), always labelled.
 *
 * Device-independence (MX-302C): the Campus-Drive / Project tracker is persisted
 * to the student's account (GET /api/launchpad-dashboard/tracker) when the flag
 * is ON, so the Career Timeline / Placement / Internship widgets follow them
 * across devices. Flag-OFF or no account data → honest fall-back to the
 * device-local localStorage copy (byte-identical legacy). The readiness
 * checklist ITEM list is sourced from the server `/summary` `readiness.checks`
 * when synced, with a local fall-back otherwise.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Compass, Gauge, Award, Brain, BookOpen, CalendarClock, IdCard, FileText,
  MessageSquare, Sparkles, ListChecks, Target, CheckCircle2, Circle, Briefcase,
  GraduationCap, TrendingUp, ArrowRight, Rocket, Wrench, MapPin, Info,
} from 'lucide-react';
import { BRAND } from '@/design-system/tokens';
import {
  SectionCard, MetricCard, EmptyState, LoadingState, TabLayout, SkillBar, EIGauge,
} from '@/components/career';
import { generateWeeklyActions } from '@/lib/engines/weeklyActionEngine';
import { eiBand } from '@/lib/passport/passportClient';
import type { CareerBrain } from '@/lib/services/useCareerBrain';
import { FresherHubTab } from './FresherHubTab';

// ── localStorage keys (shared with FresherHubTab — device-local carry-over) ──
const LS_DRIVES = 'mx-fresher-drives';
const LS_PROJECTS = 'mx-fresher-projects';

function ls<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}

// Minimal local mirrors of the FresherHubTab shapes (read-only here).
interface Drive { id: string; company: string; role: string; ctc: string; driveDate: string; currentStage: string; status: string; }
interface Project { id: string; title: string; type: string; featured?: boolean; techStack?: string; }

const DRIVE_STAGES = ['Registration', 'Aptitude Test', 'Technical Round', 'Group Discussion', 'HR Interview', 'Offer'];

// ── MX-302B guidance shape (subset we consume) ──
interface Guidance {
  ai_available: boolean;
  ai_mode: 'llm' | 'rule_based';
  recommendations: any[];
  daily_brief: { headline: string; focus: string | null; items: string[] };
  weekly_goals: string[];
}

// ── MX-302C backend summary shape (server-computed readiness — device-independent).
//    Read from `career_seeker_profiles.data`; absent profile → has_profile=false,
//    readiness=null (null ≠ 0; never fabricated). See routes/launchpad-dashboard.ts. ──
interface ReadinessCheck { key: string; label: string; done: boolean; pts: number; }
interface DashboardSummary {
  ok: boolean;
  has_profile: boolean | null;
  degraded?: boolean;
  readiness: {
    percent: number | null;
    earned_points: number;
    possible_points: number;
    completed: number;
    total: number;
    checks: ReadinessCheck[];
  } | null;
}

interface Props {
  profile: any;
  brain: CareerBrain;
  eiScore: number;
  eiBreakdown?: { total: number; components: any[] };
  jobs: any[];
  goals: any[];
  userId: string;
  hasAssessment: boolean;
  openJobs: number;
  onTabChange: (tab: string) => void;
}

// ── Readiness checklist — mirrors FresherHubTab.ReadinessScore inputs so the
//    dashboard's Placement-Readiness widget + Upcoming-Tasks read the SAME
//    signals as the toolkit (which remains the source of truth). ──
function readinessChecks(profile: any, drives: Drive[], projects: Project[]) {
  return [
    { label: 'Add a profile photo',          done: !!profile?.photo,                                pts: 5,  tab: 'profile' },
    { label: 'Fill your education section',   done: (profile?.education || []).length > 0,           pts: 15, tab: 'profile' },
    { label: 'Add at least 2 skills',         done: (profile?.skills?.technical || []).length >= 2,  pts: 10, tab: 'skills' },
    { label: 'Build your resume',             done: !!profile?.resumeBuilt,                          pts: 10, tab: 'resume' },
    { label: 'Take the competency assessment',done: !!profile?.competencyProfile?.assessmentDone,    pts: 15, tab: 'assessment' },
    { label: 'Track 1+ campus drive',         done: drives.length >= 1,                              pts: 10, tab: 'fresher-hub' },
    { label: 'Add 1+ project',                done: projects.length >= 1,                            pts: 15, tab: 'fresher-hub' },
    { label: 'Set a career goal',             done: !!profile?.targetRole,                           pts: 10, tab: 'profile' },
    { label: 'Add your LinkedIn URL',         done: !!profile?.linkedin,                             pts: 5,  tab: 'profile' },
    { label: 'Add your GitHub URL',           done: !!profile?.github,                               pts: 5,  tab: 'profile' },
  ];
}

// Maps the server readiness-check `key` (routes/launchpad-dashboard.ts
// readinessChecks) back to the deep-link tab so server-sourced items navigate
// the same way the local checklist does.
const CHECK_TAB: Record<string, string> = {
  photo: 'profile', education: 'profile', skills: 'skills', resume: 'resume',
  assessment: 'assessment', drives: 'fresher-hub', projects: 'fresher-hub',
  goal: 'profile', linkedin: 'profile', github: 'profile',
};

// Honest, transparent resume-readiness from concrete profile fields (no ATS
// score is computed client-side — this is a deterministic completeness derived
// from real CV fields, never a fabricated number).
function resumeChecks(profile: any) {
  const p = profile || {};
  return [
    { label: 'Resume built in Resume Studio', done: !!p.resumeBuilt },
    { label: 'Professional summary added',    done: !!(p.summary && String(p.summary).trim()) },
    { label: 'Work / internship experience',  done: Array.isArray(p.experience) && p.experience.length > 0 },
    { label: 'Education added',               done: Array.isArray(p.education) && p.education.length > 0 },
    { label: '3+ technical skills',           done: (p.skills?.technical || []).length >= 3 },
    { label: '1+ project listed',             done: Array.isArray(p.projects) && p.projects.length > 0 },
  ];
}

function bandColor(score: number): string {
  if (score >= 75) return BRAND.green;
  if (score >= 50) return BRAND.accent;
  if (score >= 35) return BRAND.orange;
  return BRAND.red;
}

function WidgetGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{children}</div>;
}

function SectionHeading({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <div className="flex items-center gap-2 mt-2 mb-3">
      <span style={{ color: BRAND.primary }}>{icon}</span>
      <h2 className="text-sm font-bold text-gray-800">{title}</h2>
      <span className="text-[11px] text-gray-400 hidden sm:inline">— {hint}</span>
    </div>
  );
}

const CtaLink = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button onClick={onClick} className="inline-flex items-center gap-1 text-[11px] font-semibold mt-2" style={{ color: BRAND.primary }}>
    {label} <ArrowRight size={12} />
  </button>
);

export default function CareerLaunchpadDashboard({
  profile, brain, eiScore, jobs, goals, userId, hasAssessment, openJobs, onTabChange,
}: Props) {
  const [view, setView] = useState<'dashboard' | 'where' | 'next' | 'employable' | 'toolkit'>('dashboard');
  const [guidance, setGuidance] = useState<Guidance | null>(null);
  const [guidanceState, setGuidanceState] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  // ── MX-302C: server-computed readiness (device-independent). `summaryState`
  //    drives which readiness source the Placement-Readiness bar trusts:
  //      'loading' → flag/profile not resolved yet (render local meanwhile)
  //      'server'  → flag ON + profile present → use server readiness (synced)
  //      'local'   → flag OFF (byte-identical, NO summary fetch) OR no profile OR
  //                  degraded → fall back to the device-local computation.
  //    Flag-OFF stays byte-identical: the /enabled probe short-circuits and the
  //    summary endpoint is never called. ──
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryState, setSummaryState] = useState<'loading' | 'server' | 'local'>('loading');
  // MX-302C phase-flag state (launchpadDashboard / FF_LAUNCHPAD_DASHBOARD). null
  // until the /enabled probe resolves. When true, the render telemetry is posted
  // to THIS phase's own surface (/api/launchpad-dashboard/telemetry); when false
  // it stays byte-identical to legacy (posts to /api/career-launchpad/telemetry).
  const [phaseEnabled, setPhaseEnabled] = useState<boolean | null>(null);

  // Campus-drive / project tracker. Seeded from the device-local cache, then
  // reconciled with the student's account copy when the flag is ON (below) so the
  // Career Timeline / Placement / Internship widgets follow them across devices.
  const [drives, setDrives] = useState<Drive[]>(() => ls<Drive[]>(LS_DRIVES, []));
  const [projects, setProjects] = useState<Project[]>(() => ls<Project[]>(LS_PROJECTS, []));
  // True once the tracker has been adopted from the account (drives/projects are
  // device-independent); drives the "synced" vs "on this device" widget notes.
  const [trackerSynced, setTrackerSynced] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Cheap flag probe (ungated, 200 {enabled:false} when OFF). When OFF we
        // never touch the summary endpoint → flag-OFF is byte-identical.
        const probe = await fetch('/api/launchpad-dashboard/enabled', { credentials: 'include' });
        if (!alive) return;
        const probeJson = probe.ok ? await probe.json().catch(() => null) : null;
        setPhaseEnabled(!!probeJson?.enabled);
        if (!probeJson?.enabled) { setSummaryState('local'); return; }

        // Load the account-level tracker so the drive/project widgets are
        // device-independent. Account data → adopt it; empty/absent → keep the
        // local cache (null ≠ 0; never fabricate).
        try {
          const tr = await fetch('/api/launchpad-dashboard/tracker', { credentials: 'include' });
          if (alive && tr.ok) {
            const td = await tr.json().catch(() => null);
            if (td?.ok && td.has_profile === true) {
              const sDrives = Array.isArray(td.drives) ? td.drives as Drive[] : [];
              const sProjects = Array.isArray(td.projects) ? td.projects as Project[] : [];
              setDrives(sDrives);
              setProjects(sProjects);
              setTrackerSynced(true);
            }
          }
        } catch { /* keep local cache */ }

        const r = await fetch('/api/launchpad-dashboard/summary', { credentials: 'include' });
        if (!alive) return;
        if (!r.ok) { setSummaryState('local'); return; }
        const data: DashboardSummary = await r.json();
        // Only trust the server readiness when a real profile yielded a percent.
        // No profile / degraded → honest fall-back to local (null ≠ 0).
        if (data?.ok && data.has_profile === true && data.readiness && data.readiness.percent != null) {
          setSummary(data);
          setSummaryState('server');
        } else {
          setSummaryState('local');
        }
      } catch {
        if (alive) { setPhaseEnabled(false); setSummaryState('local'); }
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  // ── Effective readiness checklist — server `readiness.checks` (device-
  //    independent) when the summary synced, else the device-local computation.
  //    The server check `key` is mapped back to a deep-link tab for navigation. ──
  const effectiveChecks = useMemo(() => {
    if (summaryState === 'server' && summary?.readiness?.checks?.length) {
      return summary.readiness.checks.map((c) => ({
        label: c.label, done: c.done, pts: c.pts, tab: CHECK_TAB[c.key] ?? 'profile',
      }));
    }
    return readinessChecks(profile, drives, projects);
  }, [summaryState, summary, profile, drives, projects]);

  // ── Daily AI Brief / Recommendations / Weekly Goals from MX-302B (best-effort).
  // If the careerDiscovery flag is OFF (503) or unauthenticated, we degrade to the
  // deterministic local engines below — always labelled honestly. ──
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/api/career-discovery/guidance', { credentials: 'include' });
        if (!alive) return;
        if (!r.ok) { setGuidanceState('unavailable'); return; }
        const data = await r.json();
        setGuidance(data);
        setGuidanceState('ready');
      } catch {
        if (alive) setGuidanceState('unavailable');
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  // Normalised recommendation cards — MX-302B guidance PRIMARY, brain best-next-actions FALLBACK.
  // Guidance recommendations are an array of GROUPS ({ measurable, items[] }); flatten the
  // measurable groups' items into uniform {title, sub} cards before falling back.
  const { recommendationCards, recommendationSource } = useMemo(() => {
    const fromGuidance: Array<{ title: string; sub?: string }> = [];
    const groups = Array.isArray(guidance?.recommendations) ? guidance!.recommendations : [];
    for (const g of groups) {
      if (g?.measurable === false) continue;
      const items = Array.isArray(g?.items) ? g.items : [];
      for (const it of items) {
        const title = it?.title || it?.target;
        if (!title) continue;
        fromGuidance.push({ title: String(title), sub: it?.description || it?.action || undefined });
        if (fromGuidance.length >= 4) break;
      }
      if (fromGuidance.length >= 4) break;
    }
    if (fromGuidance.length > 0) {
      return { recommendationCards: fromGuidance, recommendationSource: 'guidance' as const };
    }
    const fallback = brain.bestNextActions.slice(0, 4).map((a) => ({
      title: a.intervention || a.description, sub: a.reason || a.description || undefined,
    })).filter((c) => !!c.title);
    return { recommendationCards: fallback, recommendationSource: 'brain' as const };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guidance, brain]);

  // Weekly goals availability mirrors the WeeklyGoals widget (AI goals → engine fallback).
  const hasWeeklyGoals = useMemo(() => {
    const aiGoals = guidanceState === 'ready' ? (guidance?.weekly_goals || []) : [];
    if (aiGoals.length > 0) return true;
    try { return generateWeeklyActions(brain, { openJobs, hasAssessment }).length > 0; } catch { return false; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guidance, guidanceState, brain, openJobs, hasAssessment]);

  // ── Step 6: audit dashboard render + per-widget data availability (metadata
  //    only) through the existing audit trail. Flag-OFF → 503 (no-op). ──
  const widgetAvailability = useMemo(() => {
    const checks = readinessChecks(profile, drives, projects);
    const resume = resumeChecks(profile);
    // Daily AI Brief renders content via rule-based fallback too — available once guidance
    // has RESOLVED (ready OR error→offline brief), not only when the network call succeeds.
    const briefRenders = guidanceState !== 'loading';
    return {
      career_readiness: brain.careerReadiness > 0 || hasAssessment,
      employability_index: eiScore > 0,
      placement_readiness: checks.length > 0,
      competency_progress: !!brain.competencyActivation?.measurable || brain.dimensions.length > 0,
      learning_progress: brain.learningReadiness > 0,
      career_timeline: drives.length > 0 || projects.length > 0,
      career_passport: eiScore > 0 || !!profile?.competencyProfile?.completeness,
      resume_score: resume.some((c) => c.done),
      interview_readiness: brain.interviewReadiness > 0,
      daily_ai_brief: briefRenders,
      recommendations: recommendationCards.length > 0,
      weekly_goals: hasWeeklyGoals,
      upcoming_tasks: checks.some((c) => !c.done) || openJobs > 0,
      internship_progress: projects.some((p) => p.type === 'Internship'),
      placement_progress: drives.length > 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, brain, eiScore, hasAssessment, openJobs, guidance, guidanceState, recommendationCards, hasWeeklyGoals]);

  // Fire the render telemetry exactly once, after BOTH the guidance snapshot has
  // resolved (so the availability map is complete) AND the MX-302C phase-flag
  // probe has resolved (so we know which surface to post to). When the
  // launchpadDashboard flag is ON the telemetry goes to this phase's OWN surface
  // (/api/launchpad-dashboard/telemetry); when OFF it stays byte-identical to the
  // legacy MX-302A/B path (/api/career-launchpad/telemetry). Both are gated +
  // metadata-only (counts + boolean availability map; never user content).
  const telemetrySent = React.useRef(false);
  useEffect(() => {
    if (telemetrySent.current) return;
    if (guidanceState === 'loading' || phaseEnabled === null) return;
    telemetrySent.current = true;
    const available = Object.values(widgetAvailability).filter(Boolean).length;
    const endpoint = phaseEnabled
      ? '/api/launchpad-dashboard/telemetry'
      : '/api/career-launchpad/telemetry';
    fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'dashboard_render',
        widgets_total: Object.keys(widgetAvailability).length,
        widgets_with_data: available,
        ai_mode: guidance?.ai_mode ?? null,
        widget_availability: widgetAvailability,
      }),
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guidanceState, phaseEnabled]);

  // ════════════════════════════════════════════════════════════════════════
  // WIDGETS
  // ════════════════════════════════════════════════════════════════════════

  // 1 — Career Readiness (behavioural, EI/competency fallback) — useCareerBrain.
  const CareerReadiness = () => {
    const measured = brain.careerReadiness > 0 || hasAssessment;
    return (
      <SectionCard title="Career Readiness" icon={<Gauge size={16} />}>
        {!measured ? (
          <EmptyState icon={<Gauge size={28} />} title="Not measured yet"
            description="Take the competency assessment to unlock your behavioural career-readiness score."
            action={<CtaLink label="Take assessment" onClick={() => onTabChange('assessment')} />} />
        ) : (
          <div>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-extrabold" style={{ color: bandColor(brain.careerReadiness) }}>{brain.careerReadiness}</span>
              <span className="text-xs text-gray-400 mb-1.5">/ 100 · {brain.currentStage}</span>
            </div>
            <p className="text-[11px] text-gray-500 mt-1">Target: {brain.targetRole || 'set a goal'} · transition odds {brain.transitionProbability}%</p>
            <CtaLink label="See development plan" onClick={() => onTabChange('development')} />
          </div>
        )}
      </SectionCard>
    );
  };

  // 2 — Employability Index — useHybridEI / employabilityEngine, render EIGauge.
  const EmployabilityIndex = () => (
    <SectionCard title="Employability Index" icon={<Award size={16} />}>
      {eiScore <= 0 ? (
        <EmptyState icon={<Award size={28} />} title="No score yet"
          description="Complete your profile and assessment to compute your Employability Index."
          action={<CtaLink label="Take assessment" onClick={() => onTabChange('assessment')} />} />
      ) : (
        <div className="flex flex-col items-center">
          <EIGauge score={eiScore} size={130} />
          <p className="text-[11px] text-gray-500 mt-2 text-center">You're in the <strong>{eiBand(eiScore)}</strong> band.</p>
        </div>
      )}
    </SectionCard>
  );

  // 3 — Placement Readiness — server-computed checklist when the MX-302C surface
  //     is ON (device-independent, read from the persisted profile); otherwise the
  //     existing device-local Fresher 10-item checklist (byte-identical fall-back).
  const PlacementReadiness = () => {
    const useServer = summaryState === 'server' && summary?.readiness?.percent != null;
    const localChecks = readinessChecks(profile, drives, projects);

    const earned = useServer ? summary!.readiness!.earned_points
      : localChecks.filter((c) => c.done).reduce((s, c) => s + c.pts, 0);
    const total = useServer ? summary!.readiness!.possible_points
      : localChecks.reduce((s, c) => s + c.pts, 0);
    const score = useServer ? summary!.readiness!.percent!
      : Math.round((earned / total) * 100);
    const remaining = useServer ? (summary!.readiness!.total - summary!.readiness!.completed)
      : localChecks.filter((c) => !c.done).length;

    return (
      <SectionCard title="Placement Readiness" icon={<Target size={16} />}
        action={<span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${bandColor(score)}1a`, color: bandColor(score) }}>{score}%</span>}>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: bandColor(score) }} />
        </div>
        <p className="text-[11px] text-gray-500 mt-2">{earned} of {total} points · {remaining} item{remaining !== 1 ? 's' : ''} left</p>
        {useServer && (
          <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
            <Info size={10} /> Synced from your saved profile — consistent across every device.{trackerSynced ? ' Campus-drive & project tracking is saved to your account too.' : ' Campus-drive & project tracking still lives on this device.'}
          </p>
        )}
        <CtaLink label="Open readiness checklist" onClick={() => setView('toolkit')} />
      </SectionCard>
    );
  };

  // 4 — Competency Progress — longitudinal / competency runtime (via brain).
  const CompetencyProgress = () => {
    const act = brain.competencyActivation;
    const dims = brain.dimensions;
    const hasAct = !!act?.measurable;
    if (!hasAct && dims.length === 0) {
      return (
        <SectionCard title="Competency Progress" icon={<Brain size={16} />}>
          <EmptyState icon={<Brain size={28} />} title="No measured competencies"
            description="Complete the competency assessment to see your measured competency profile."
            action={<CtaLink label="Take assessment" onClick={() => onTabChange('assessment')} />} />
        </SectionCard>
      );
    }
    const rows = hasAct
      ? [act!.scores.career_readiness, act!.scores.career_growth, act!.scores.role_progression]
          .filter((s) => s.measurable && s.value != null)
          .map((s) => ({ label: s.label, pct: Math.round(s.value as number) }))
      : dims.slice(0, 5).map((d) => ({ label: d.label, pct: Math.round(d.score) }));
    return (
      <SectionCard title="Competency Progress" icon={<Brain size={16} />}>
        {rows.length === 0 ? (
          <EmptyState icon={<Brain size={28} />} title="No measured competencies"
            action={<CtaLink label="Take assessment" onClick={() => onTabChange('assessment')} />} />
        ) : (
          <div className="space-y-2.5">
            {rows.map((r, i) => <SkillBar key={i} label={r.label} pct={r.pct} />)}
            <CtaLink label="Open competency dashboard" onClick={() => onTabChange('assessment')} />
          </div>
        )}
      </SectionCard>
    );
  };

  // 5 — Learning Progress — useCareerBrain (learning readiness + priority).
  const LearningProgress = () => (
    <SectionCard title="Learning Progress" icon={<BookOpen size={16} />}>
      {brain.learningReadiness <= 0 ? (
        <EmptyState icon={<BookOpen size={28} />} title="No learning signal yet"
          description="Your learning readiness appears once you've completed an assessment."
          action={<CtaLink label="Take assessment" onClick={() => onTabChange('assessment')} />} />
      ) : (
        <div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-extrabold" style={{ color: bandColor(brain.learningReadiness) }}>{brain.learningReadiness}</span>
            <span className="text-xs text-gray-400 mb-1">/ 100</span>
          </div>
          {brain.learningPriority && <p className="text-[11px] text-gray-500 mt-1">Priority: {brain.learningPriority}</p>}
          <CtaLink label="Plan learning" onClick={() => onTabChange('development')} />
        </div>
      )}
    </SectionCard>
  );

  // 6 — Career Timeline — Campus-Drive chronology + project milestones.
  const CareerTimeline = () => {
    const events = [
      ...drives.filter((d) => d.driveDate).map((d) => ({ date: d.driveDate, label: `${d.company} — ${d.currentStage}`, kind: 'drive' as const })),
    ].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);
    return (
      <SectionCard title="Career Timeline" icon={<CalendarClock size={16} />}>
        {events.length === 0 ? (
          <EmptyState icon={<CalendarClock size={28} />} title="No milestones yet"
            description={trackerSynced ? "Tracked campus drives appear here as a chronology. Saved to your account — available on every device." : "Tracked campus drives appear here as a chronology. This data is stored on this device."}
            action={<CtaLink label="Track a drive" onClick={() => setView('toolkit')} />} />
        ) : (
          <ul className="space-y-2.5">
            {events.map((e, i) => (
              <li key={i} className="flex items-start gap-2">
                <MapPin size={13} className="mt-0.5 shrink-0" style={{ color: BRAND.primary }} />
                <div>
                  <p className="text-[11px] font-medium text-gray-700">{e.label}</p>
                  <p className="text-[10px] text-gray-400">{e.date}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    );
  };

  // 7 — Career Passport — passportClient snapshot (EI band + completeness).
  const CareerPassport = () => {
    const completeness = Math.round(Number(profile?.competencyProfile?.completeness || 0));
    const hasData = eiScore > 0 || completeness > 0;
    return (
      <SectionCard title="Career Passport" icon={<IdCard size={16} />}>
        {!hasData ? (
          <EmptyState icon={<IdCard size={28} />} title="Passport not ready"
            description="Build your profile and take the assessment to assemble a shareable passport."
            action={<CtaLink label="Build profile" onClick={() => onTabChange('profile')} />} />
        ) : (
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${BRAND.primary}12`, color: BRAND.primary }}>
                <IdCard size={22} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">{eiBand(eiScore)} profile</p>
                <p className="text-[11px] text-gray-500">EI {eiScore} · {completeness}% complete</p>
              </div>
            </div>
            <CtaLink label="Open passport" onClick={() => onTabChange('visibility')} />
          </div>
        )}
      </SectionCard>
    );
  };

  // 8 — Resume Score — ATS / Resume Studio (transparent field completeness).
  const ResumeScore = () => {
    const checks = resumeChecks(profile);
    const done = checks.filter((c) => c.done).length;
    const pct = Math.round((done / checks.length) * 100);
    const anyData = done > 0;
    return (
      <SectionCard title="Resume Score" icon={<FileText size={16} />}
        action={anyData ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${bandColor(pct)}1a`, color: bandColor(pct) }}>{pct}%</span> : undefined}>
        {!anyData ? (
          <EmptyState icon={<FileText size={28} />} title="No resume yet"
            description="Build your resume in Resume Studio to get a readiness score."
            action={<CtaLink label="Open Resume Studio" onClick={() => onTabChange('resume')} />} />
        ) : (
          <div className="space-y-1.5">
            {checks.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                {c.done ? <CheckCircle2 size={14} style={{ color: BRAND.green }} /> : <Circle size={14} className="text-gray-300" />}
                <span className={`text-[11px] ${c.done ? 'text-gray-600' : 'text-gray-400'}`}>{c.label}</span>
              </div>
            ))}
            <CtaLink label="Improve resume" onClick={() => onTabChange('resume')} />
          </div>
        )}
      </SectionCard>
    );
  };

  // 9 — Interview Readiness — useCareerBrain.
  const InterviewReadiness = () => (
    <SectionCard title="Interview Readiness" icon={<MessageSquare size={16} />}>
      {brain.interviewReadiness <= 0 ? (
        <EmptyState icon={<MessageSquare size={28} />} title="Not assessed yet"
          description="Practise a mock interview to generate your interview-readiness score."
          action={<CtaLink label="Start mock interview" onClick={() => onTabChange('interview')} />} />
      ) : (
        <div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-extrabold" style={{ color: bandColor(brain.interviewReadiness) }}>{brain.interviewReadiness}</span>
            <span className="text-xs text-gray-400 mb-1">/ 100</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Sharpen weak areas with a focused mock.</p>
          <CtaLink label="Practise interview" onClick={() => onTabChange('interview')} />
        </div>
      )}
    </SectionCard>
  );

  // 10 — Daily AI Brief — MX-302B guidance (honest LLM → rule-based degradation).
  const DailyAIBrief = () => {
    const aiReady = guidanceState === 'ready' && guidance;
    // Rule-based fallback derived from the Career Brain (deterministic, labelled).
    const fallbackItems = [
      brain.fastestWinAction,
      brain.weeklyFocus,
      brain.coreBottleneck ? `Address: ${brain.coreBottleneck}` : '',
    ].filter(Boolean) as string[];
    const headline = aiReady ? guidance!.daily_brief.headline : (brain.weeklyFocus || 'Your focus for today');
    const items = aiReady ? guidance!.daily_brief.items : fallbackItems;
    const mode = aiReady ? guidance!.ai_mode : 'rule_based';
    return (
      <SectionCard title="Daily AI Brief" icon={<Sparkles size={16} />}
        action={<span className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ background: mode === 'llm' ? `${BRAND.purple}1a` : `${BRAND.slate}1a`, color: mode === 'llm' ? BRAND.purple : BRAND.muted }}>{mode === 'llm' ? 'AI' : 'Rule-based'}</span>}>
        {guidanceState === 'loading' ? (
          <LoadingState compact message="Preparing your brief…" />
        ) : items.length === 0 ? (
          <EmptyState icon={<Sparkles size={28} />} title="No brief yet"
            description="Complete a little more of your profile to generate today's brief."
            action={<CtaLink label="Build profile" onClick={() => onTabChange('profile')} />} />
        ) : (
          <div>
            <p className="text-xs font-semibold text-gray-700">{headline}</p>
            <ul className="mt-2 space-y-1.5">
              {items.slice(0, 4).map((it, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px] text-gray-600">
                  <span style={{ color: BRAND.primary }}>•</span>{it}
                </li>
              ))}
            </ul>
            {mode === 'rule_based' && <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1"><Info size={10} /> Generated offline (no AI key) — deterministic guidance.</p>}
          </div>
        )}
      </SectionCard>
    );
  };

  // 11 — Recommendations — MX-302B guidance recs PRIMARY, brain best-next-actions FALLBACK.
  const Recommendations = () => {
    const cards = recommendationCards;
    if (cards.length === 0) {
      return (
        <SectionCard title="Recommendations" icon={<TrendingUp size={16} />}>
          <EmptyState icon={<TrendingUp size={28} />} title="No recommendations yet"
            description="Recommendations appear once we have signals from your assessment and activity."
            action={<CtaLink label="Take assessment" onClick={() => onTabChange('assessment')} />} />
        </SectionCard>
      );
    }
    return (
      <SectionCard title="Recommendations" icon={<TrendingUp size={16} />}>
        <ul className="space-y-2">
          {cards.map((c, i) => (
            <li key={i} className="rounded-xl border border-gray-100 p-2.5">
              <p className="text-[11px] font-semibold text-gray-700">{c.title}</p>
              {c.sub && <p className="text-[10px] text-gray-500 mt-0.5">{c.sub}</p>}
            </li>
          ))}
        </ul>
        <p className="text-[9px] text-gray-400 mt-1.5">{recommendationSource === 'guidance' ? 'From your AI guidance' : 'From your behavioural signals'}</p>
        <CtaLink label="See all next-best actions" onClick={() => onTabChange('next-actions')} />
      </SectionCard>
    );
  };

  // 12 — Weekly Goals — MX-302B weekly_goals → weeklyActionEngine fallback.
  const WeeklyGoals = () => {
    const aiGoals = guidanceState === 'ready' ? (guidance?.weekly_goals || []) : [];
    const engineGoals = generateWeeklyActions(brain, { openJobs, hasAssessment }).slice(0, 5);
    const useAi = aiGoals.length > 0;
    const items = useAi ? aiGoals.map((g) => ({ title: g, tab: 'weekly-plan' })) : engineGoals.map((g) => ({ title: g.title, tab: g.deepLinkTab }));
    return (
      <SectionCard title="Weekly Goals" icon={<ListChecks size={16} />}>
        {items.length === 0 ? (
          <EmptyState icon={<ListChecks size={28} />} title="No goals yet"
            description="Your weekly plan builds from your readiness levers as you add data."
            action={<CtaLink label="Take assessment" onClick={() => onTabChange('assessment')} />} />
        ) : (
          <ul className="space-y-2">
            {items.map((g, i) => (
              <li key={i}>
                <button onClick={() => onTabChange(g.tab)} className="w-full text-left flex items-start gap-2 rounded-lg p-1.5 hover:bg-gray-50">
                  <Circle size={13} className="mt-0.5 shrink-0 text-gray-300" />
                  <span className="text-[11px] text-gray-600">{g.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    );
  };

  // 13 — Upcoming Tasks — readiness checklist gaps + job-tracker pipeline.
  const UpcomingTasks = () => {
    const pending = effectiveChecks.filter((c) => !c.done).slice(0, 5);
    const tasks: { label: string; tab: string }[] = [...pending.map((c) => ({ label: c.label, tab: c.tab }))];
    if (openJobs > 0) tasks.unshift({ label: `Follow up on ${openJobs} active application${openJobs !== 1 ? 's' : ''}`, tab: 'jobs' });
    return (
      <SectionCard title="Upcoming Tasks" icon={<CheckCircle2 size={16} />}>
        {tasks.length === 0 ? (
          <EmptyState icon={<CheckCircle2 size={28} />} title="All caught up"
            description="You've completed your readiness checklist. Keep your pipeline active." />
        ) : (
          <ul className="space-y-1.5">
            {tasks.slice(0, 5).map((t, i) => (
              <li key={i}>
                <button onClick={() => onTabChange(t.tab)} className="w-full text-left flex items-start gap-2 rounded-lg p-1.5 hover:bg-gray-50">
                  <Circle size={13} className="mt-0.5 shrink-0 text-gray-300" />
                  <span className="text-[11px] text-gray-600">{t.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    );
  };

  // 14 — Internship Progress — Project Portfolio (Internship items) + drives.
  const InternshipProgress = () => {
    const internships = projects.filter((p) => p.type === 'Internship');
    return (
      <SectionCard title="Internship Progress" icon={<GraduationCap size={16} />}>
        {internships.length === 0 ? (
          <EmptyState icon={<GraduationCap size={28} />} title="No internships logged"
            description={trackerSynced ? "Add internship projects to your portfolio to track them here. Saved to your account — available on every device." : "Add internship projects to your portfolio to track them here. Stored on this device."}
            action={<CtaLink label="Add internship" onClick={() => setView('toolkit')} />} />
        ) : (
          <div>
            <MetricCard label="Internships" value={internships.length} sub={`${internships.filter((p) => p.featured).length} featured`} icon={<GraduationCap size={18} />} color={BRAND.green} />
            <ul className="mt-2 space-y-1">
              {internships.slice(0, 3).map((p) => (
                <li key={p.id} className="text-[11px] text-gray-600 truncate">• {p.title}</li>
              ))}
            </ul>
            <CtaLink label="Manage portfolio" onClick={() => setView('toolkit')} />
          </div>
        )}
      </SectionCard>
    );
  };

  // 15 — Placement Progress — Campus-Drive Tracker stages.
  const PlacementProgress = () => {
    const active = drives.filter((d) => d.status === 'Active').length;
    const offers = drives.filter((d) => d.status === 'Selected' || d.currentStage === 'Offer').length;
    const furthestIdx = drives.reduce((mx, d) => Math.max(mx, DRIVE_STAGES.indexOf(d.currentStage)), -1);
    const furthest = furthestIdx >= 0 ? DRIVE_STAGES[furthestIdx] : '—';
    return (
      <SectionCard title="Placement Progress" icon={<Briefcase size={16} />}>
        {drives.length === 0 ? (
          <EmptyState icon={<Briefcase size={28} />} title="No drives tracked"
            description={trackerSynced ? "Track your campus drives to see your placement pipeline. Saved to your account — available on every device." : "Track your campus drives to see your placement pipeline. Stored on this device."}
            action={<CtaLink label="Track a drive" onClick={() => setView('toolkit')} />} />
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center"><p className="text-2xl font-bold" style={{ color: BRAND.primary }}>{drives.length}</p><p className="text-[10px] text-gray-400">Total</p></div>
            <div className="text-center"><p className="text-2xl font-bold" style={{ color: BRAND.orange }}>{active}</p><p className="text-[10px] text-gray-400">Active</p></div>
            <div className="text-center"><p className="text-2xl font-bold" style={{ color: BRAND.green }}>{offers}</p><p className="text-[10px] text-gray-400">Offers</p></div>
            <div className="col-span-3 text-[11px] text-gray-500 text-center mt-1">Furthest stage: <strong>{furthest}</strong></div>
          </div>
        )}
      </SectionCard>
    );
  };

  // ── Section groupings ──
  const whereWidgets = (
    <WidgetGrid>
      <CareerReadiness /><EmployabilityIndex /><PlacementReadiness />
      <CompetencyProgress /><LearningProgress /><CareerTimeline /><CareerPassport />
    </WidgetGrid>
  );
  const employableWidgets = (
    <WidgetGrid><EmployabilityIndex /><ResumeScore /><InterviewReadiness /></WidgetGrid>
  );
  const nextWidgets = (
    <WidgetGrid>
      <DailyAIBrief /><Recommendations /><WeeklyGoals />
      <UpcomingTasks /><InternshipProgress /><PlacementProgress />
    </WidgetGrid>
  );

  // ── Hero snapshot strip (the three core questions, at a glance) ──
  const hero = (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
      <MetricCard label="Career Readiness" value={brain.careerReadiness > 0 || hasAssessment ? brain.careerReadiness : '—'} sub={brain.currentStage} icon={<Gauge size={18} />} color={bandColor(brain.careerReadiness)} />
      <MetricCard label="Employability Index" value={eiScore > 0 ? eiScore : '—'} sub={eiScore > 0 ? eiBand(eiScore) : 'Not measured'} icon={<Award size={18} />} color={bandColor(eiScore)} />
      <MetricCard label="Active Applications" value={openJobs} sub="in your pipeline" icon={<Briefcase size={18} />} color={BRAND.primary} />
    </div>
  );

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: <Rocket size={14} /> },
    { id: 'where', label: 'Where am I', icon: <Compass size={14} /> },
    { id: 'next', label: 'What to do next', icon: <ListChecks size={14} /> },
    { id: 'employable', label: 'How employable', icon: <Award size={14} /> },
    { id: 'toolkit', label: 'Toolkit', icon: <Wrench size={14} /> },
  ];

  return (
    <div className="max-w-7xl mx-auto px-1 sm:px-0">
      <div className="flex items-center gap-2 mb-1">
        <Rocket size={20} style={{ color: BRAND.primary }} />
        <h1 className="text-lg sm:text-xl font-bold text-gray-900">Career Launchpad</h1>
      </div>
      <p className="text-xs text-gray-400 mb-4">Where you are, what to do next, and how employable you are — in one place.</p>

      <TabLayout tabs={tabs} active={view} onChange={(id) => setView(id as any)}>
        {view === 'dashboard' && (
          <div>
            {hero}
            <SectionHeading icon={<Compass size={15} />} title="Where am I" hint="your current standing" />
            {whereWidgets}
            <SectionHeading icon={<ListChecks size={15} />} title="What to do next" hint="your action plan" />
            {nextWidgets}
            <SectionHeading icon={<Award size={15} />} title="How employable am I" hint="market readiness" />
            {employableWidgets}
          </div>
        )}
        {view === 'where' && <div>{hero}{whereWidgets}</div>}
        {view === 'next' && <div>{nextWidgets}</div>}
        {view === 'employable' && <div>{employableWidgets}</div>}
        {view === 'toolkit' && (
          <div className="-mt-1">
            <FresherHubTab profile={profile} title="Career Launchpad" />
          </div>
        )}
      </TabLayout>
    </div>
  );
}
