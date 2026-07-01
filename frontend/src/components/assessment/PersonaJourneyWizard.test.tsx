import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { PersonaJourneyWizard, type PersonaJourneyWizardProps } from './PersonaJourneyWizard';

// The Step-5 "AI Journey Router" fetches /api/persona-journey/route. None of the
// Goal-step tests reach Step 5, but jsdom has no fetch — stub it so an accidental
// resolve can never blow up the render.
beforeEach(() => {
  localStorage.clear();
  (globalThis as any).fetch = vi.fn(() =>
    Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as any),
  );
});

const STORAGE_KEY = 'capadex_persona_journey_wizard_v1';

// The wizard auto-hydrates step/track/sub/band/goal from localStorage on mount.
// Seeding it is the cleanest way to land directly on a chosen step without
// re-driving the whole click flow for every assertion.
function seed(state: Record<string, unknown>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function makeProps(overrides: Partial<PersonaJourneyWizardProps> = {}): PersonaJourneyWizardProps {
  const noop = vi.fn();
  return {
    personaModelAlignment: false,
    personaModelExpansion: false,
    setPrimaryPersona: noop,
    setSelectedPersona: noop,
    setIsProxy: noop,
    setAgeBand: noop,
    setParticipantGoal: noop,
    setGoalTimeline: noop,
    onComplete: noop,
    onNavigate: noop,
    onClose: noop,
    ...overrides,
  };
}

// The six canonical goal labels (verbatim from GOAL_OPTIONS).
const GOAL = {
  clarity: 'Get clarity on my strengths & direction',
  exam: 'Prepare for exams / academics',
  career: 'Choose or switch a career path',
  placement: 'Land a job / placement',
  growth: 'Grow in my current role',
  support: 'Support someone in my care',
} as const;

describe('PersonaJourneyWizard — Goal step is filtered by track', () => {
  it('never offers a school student "Land a job" or "Grow in my current role"', () => {
    // Land directly on the Goal step (step index 2) as a high-school student.
    seed({ trackId: 'school', subId: 'school_high', band: '14-17', step: 2 });
    render(<PersonaJourneyWizard {...makeProps()} />);

    // school → ['clarity', 'exam', 'career']
    expect(screen.getByText(GOAL.clarity)).toBeInTheDocument();
    expect(screen.getByText(GOAL.exam)).toBeInTheDocument();
    expect(screen.getByText(GOAL.career)).toBeInTheDocument();

    // The two work-life goals + the proxy goal must NOT surface for a student.
    expect(screen.queryByText(GOAL.placement)).not.toBeInTheDocument();
    expect(screen.queryByText(GOAL.growth)).not.toBeInTheDocument();
    expect(screen.queryByText(GOAL.support)).not.toBeInTheDocument();
  });

  it('never offers a proxy (parent/counsellor) the self-only goals', () => {
    seed({ trackId: 'proxy', subId: 'parent', band: '6-14', step: 2 });
    render(<PersonaJourneyWizard {...makeProps()} />);

    // proxy → ['support', 'clarity']
    expect(screen.getByText(GOAL.support)).toBeInTheDocument();
    expect(screen.getByText(GOAL.clarity)).toBeInTheDocument();

    // A parent assessing their child is never asked about exams/careers/jobs for
    // themselves — those are the assessee's, not the proxy's, goals.
    expect(screen.queryByText(GOAL.exam)).not.toBeInTheDocument();
    expect(screen.queryByText(GOAL.career)).not.toBeInTheDocument();
    expect(screen.queryByText(GOAL.placement)).not.toBeInTheDocument();
    expect(screen.queryByText(GOAL.growth)).not.toBeInTheDocument();
  });

  it('offers a professional the "Grow in my current role" goal (positive control)', () => {
    // Proves the filter is a real allow-list, not a blanket suppression of the
    // work-life goals for everyone.
    seed({ trackId: 'professional', subId: 'mid_career_professional', band: '24-45', step: 2 });
    render(<PersonaJourneyWizard {...makeProps()} />);

    // professional → ['clarity', 'career', 'placement', 'growth']
    expect(screen.getByText(GOAL.growth)).toBeInTheDocument();
    expect(screen.getByText(GOAL.placement)).toBeInTheDocument();
    // …but a professional is never asked to "support someone in their care".
    expect(screen.queryByText(GOAL.support)).not.toBeInTheDocument();
  });

  it('clears a stale goal when the track changes to one where it no longer applies', async () => {
    const user = userEvent.setup();
    // Start on the Goal step as a mid-career professional who has already picked
    // "Grow in my current role" — valid for the professional track.
    seed({ trackId: 'professional', subId: 'mid_career_professional', band: '24-45', goal: 'growth', step: 2 });
    render(<PersonaJourneyWizard {...makeProps()} />);

    // Confirm the goal starts selected (aria-pressed) for the professional track.
    const growthBtn = screen.getByRole('button', { name: new RegExp(GOAL.growth, 'i') });
    expect(growthBtn).toHaveAttribute('aria-pressed', 'true');

    // Walk back to the "Who" step and switch to School children.
    await user.click(screen.getByRole('button', { name: /Back/i })); // → Refine
    await user.click(screen.getByRole('button', { name: /Back/i })); // → Who
    await user.click(screen.getByText('School children'));

    // Switching the track fires the stale-goal guard: "growth" is not valid for a
    // school student, so it must be cleared. Persist it out to localStorage.
    // Advance back to the Goal step (select a school sub-persona + age band first).
    await user.click(screen.getByRole('button', { name: /Continue/i })); // → Refine
    await user.click(screen.getByText('High school (Class 9–12)'));
    await user.click(screen.getByText('Senior School (14–17)'));
    await user.click(screen.getByRole('button', { name: /Continue/i })); // → Goal

    // "Grow in my current role" is no longer even offered, and nothing is pre-selected.
    expect(screen.queryByText(GOAL.growth)).not.toBeInTheDocument();
    const pressed = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(pressed).toHaveLength(0);
  });
});

describe('PersonaJourneyWizard — Finish step hands off the exact persona & goal', () => {
  // The four canonical focus labels we exercise (verbatim from FOCUS_OPTIONS).
  const FOCUS = {
    skills: 'Skills & competencies',
  } as const;
  // Timeline labels (verbatim from TIMELINE_OPTIONS).
  const TIMELINE = {
    short: 'Soon (1–3 months)',
  } as const;

  // Land the wizard directly on the final step (index 4) with a fully-chosen
  // selection, so "Start my assessment" is the only action left to drive.
  async function renderAtFinish(
    state: Record<string, unknown>,
    setters: Partial<PersonaJourneyWizardProps>,
  ) {
    seed({ ...state, step: 4 });
    render(<PersonaJourneyWizard {...makeProps(setters)} />);
    // Step 5 fires a (stubbed) /route fetch on mount; wait for the finish button
    // to leave its loading-disabled state before clicking.
    const finish = await screen.findByTestId('wizard-start-assessment');
    return finish;
  }

  it('writes a self-taker\'s exact persona, legacyKey, goal+focus and timeline (is_proxy=false)', async () => {
    const user = userEvent.setup();
    const setPrimaryPersona = vi.fn();
    const setSelectedPersona = vi.fn();
    const setIsProxy = vi.fn();
    const setAgeBand = vi.fn();
    const setParticipantGoal = vi.fn();
    const setGoalTimeline = vi.fn();
    const onComplete = vi.fn();

    // A mid-career professional (self-taker) who picked "Grow in my current role",
    // added a "Skills & competencies" focus, and a "Soon (1–3 months)" timeline.
    const finish = await renderAtFinish(
      {
        trackId: 'professional',
        subId: 'mid_career_professional',
        band: '24-45',
        goal: 'growth',
        focus: 'skills',
        timeline: 'short',
      },
      {
        setPrimaryPersona, setSelectedPersona, setIsProxy, setAgeBand,
        setParticipantGoal, setGoalTimeline, onComplete,
      },
    );

    await user.click(finish);

    // Canonical sub-persona id (primary_persona) is handed off verbatim…
    expect(setPrimaryPersona).toHaveBeenCalledWith('mid_career_professional');
    // …and the legacyKey (NOT the sub-persona id) drives every downstream phase.
    expect(setSelectedPersona).toHaveBeenCalledWith('professional');
    // A self-taker is never a proxy.
    expect(setIsProxy).toHaveBeenCalledWith(false);
    // Canonical age band passes through unchanged.
    expect(setAgeBand).toHaveBeenCalledWith('24-45');
    // Goal label is composed with the focus suffix ("<goal> — <focus>").
    expect(setParticipantGoal).toHaveBeenCalledWith(`${GOAL.growth} — ${FOCUS.skills}`);
    // Timeline is written as its human label, not the raw id.
    expect(setGoalTimeline).toHaveBeenCalledWith(TIMELINE.short);
    // …and only then is the classic IntroPhase revealed.
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('writes a proxy (parent) with is_proxy=true and a bare goal label (no focus suffix)', async () => {
    const user = userEvent.setup();
    const setPrimaryPersona = vi.fn();
    const setSelectedPersona = vi.fn();
    const setIsProxy = vi.fn();
    const setAgeBand = vi.fn();
    const setParticipantGoal = vi.fn();
    const setGoalTimeline = vi.fn();

    // A parent assessing their child, no focus and no timeline chosen.
    const finish = await renderAtFinish(
      {
        trackId: 'proxy',
        subId: 'parent',
        band: '6-14',
        goal: 'support',
      },
      {
        setPrimaryPersona, setSelectedPersona, setIsProxy, setAgeBand,
        setParticipantGoal, setGoalTimeline,
      },
    );

    await user.click(finish);

    expect(setPrimaryPersona).toHaveBeenCalledWith('parent');
    expect(setSelectedPersona).toHaveBeenCalledWith('parent');
    // The proxy flag MUST travel — this is the seam where a proxy could silently
    // lose its is_proxy=true and be treated as a self-taker downstream.
    expect(setIsProxy).toHaveBeenCalledWith(true);
    expect(setAgeBand).toHaveBeenCalledWith('6-14');
    // No focus → the goal label is written bare, with no " — <focus>" suffix.
    expect(setParticipantGoal).toHaveBeenCalledWith(GOAL.support);
    // No timeline chosen → empty string, never a stale/other value.
    expect(setGoalTimeline).toHaveBeenCalledWith('');
  });

  it('drops a non-canonical age band on handoff (canonical age band only)', async () => {
    const user = userEvent.setup();
    const setAgeBand = vi.fn();

    // A corrupt/legacy band that is NOT on the canonical whitelist must never be
    // handed off — the setter receives '' instead of the bogus value.
    const finish = await renderAtFinish(
      {
        trackId: 'professional',
        subId: 'mid_career_professional',
        band: 'not-a-band',
        goal: 'growth',
      },
      { setAgeBand },
    );

    await user.click(finish);

    expect(setAgeBand).toHaveBeenCalledWith('');
    expect(setAgeBand).not.toHaveBeenCalledWith('not-a-band');
  });

  // ── Flag-ON sub-persona handoffs ───────────────────────────────────────
  // The taxonomy grows extra sub-personas only when the persona-model flags are
  // ON: expansion adds enterprise roles + higher-ed faculty, alignment splits
  // the competitive aspirant into JEE/NEET/CUET/UPSC. A wrong legacyKey or
  // is_proxy on any of these would silently mis-route every downstream phase,
  // so pin the handoff mapping for each with its gating flag turned ON.

  it('maps an enterprise sub-persona (people_manager) to legacyKey professional, is_proxy=false (expansion ON)', async () => {
    const user = userEvent.setup();
    const setPrimaryPersona = vi.fn();
    const setSelectedPersona = vi.fn();
    const setIsProxy = vi.fn();

    // people_manager exists ONLY under personaModelExpansion; it sits in the
    // self-taker "professional" track and must borrow legacyKey 'professional'.
    const finish = await renderAtFinish(
      { trackId: 'professional', subId: 'people_manager', band: '24-45', goal: 'growth' },
      { personaModelExpansion: true, setPrimaryPersona, setSelectedPersona, setIsProxy },
    );

    await user.click(finish);

    expect(setPrimaryPersona).toHaveBeenCalledWith('people_manager');
    // legacyKey is the enterprise → 'professional' borrow, NOT the sub-persona id.
    expect(setSelectedPersona).toHaveBeenCalledWith('professional');
    // An enterprise leader takes the assessment themselves — never a proxy.
    expect(setIsProxy).toHaveBeenCalledWith(false);
  });

  it('maps higher_ed_faculty to legacyKey teacher, is_proxy=true (expansion ON)', async () => {
    const user = userEvent.setup();
    const setPrimaryPersona = vi.fn();
    const setSelectedPersona = vi.fn();
    const setIsProxy = vi.fn();

    // higher_ed_faculty exists ONLY under personaModelExpansion and lives in the
    // proxy track (a faculty member assessing students), so it MUST hand off
    // legacyKey 'teacher' AND is_proxy=true — the exact seam a wrong mapping hides.
    const finish = await renderAtFinish(
      { trackId: 'proxy', subId: 'higher_ed_faculty', band: '24-45', goal: 'clarity' },
      { personaModelExpansion: true, setPrimaryPersona, setSelectedPersona, setIsProxy },
    );

    await user.click(finish);

    expect(setPrimaryPersona).toHaveBeenCalledWith('higher_ed_faculty');
    expect(setSelectedPersona).toHaveBeenCalledWith('teacher');
    expect(setIsProxy).toHaveBeenCalledWith(true);
  });

  // Alignment splits the single "competitive_aspirant" into JEE/NEET/CUET/UPSC.
  // Each split keeps legacyKey 'student' (self-taking learner), so the finer id
  // must never leak a different legacyKey/is_proxy downstream. Task #355 pinned
  // only JEE; a copy-paste slip on NEET/CUET/UPSC (wrong legacyKey or age band)
  // would otherwise go unnoticed — so drive all four through the same handoff.
  //
  // Note the age-band difference: JEE/NEET/CUET allow ['14-17','17-24'] but UPSC
  // allows ['17-24','24-45']. Each row seeds a band that is valid for its own
  // sub-persona (a non-canonical / out-of-range band would be dropped on handoff).
  const ALIGNMENT_ASPIRANTS: Array<{ subId: string; band: string }> = [
    { subId: 'jee_aspirant', band: '17-24' },
    { subId: 'neet_aspirant', band: '17-24' },
    { subId: 'cuet_aspirant', band: '17-24' },
    { subId: 'upsc_aspirant', band: '24-45' },
  ];

  it.each(ALIGNMENT_ASPIRANTS)(
    'hands off a split exam-aspirant ($subId) as legacyKey student, is_proxy=false (alignment ON)',
    async ({ subId, band }) => {
      const user = userEvent.setup();
      const setPrimaryPersona = vi.fn();
      const setSelectedPersona = vi.fn();
      const setIsProxy = vi.fn();
      const setAgeBand = vi.fn();

      const finish = await renderAtFinish(
        { trackId: 'learner', subId, band, goal: 'exam' },
        { personaModelAlignment: true, setPrimaryPersona, setSelectedPersona, setIsProxy, setAgeBand },
      );

      await user.click(finish);

      // The finer split id is handed off verbatim as the primary persona…
      expect(setPrimaryPersona).toHaveBeenCalledWith(subId);
      // …but every split still borrows legacyKey 'student' downstream.
      expect(setSelectedPersona).toHaveBeenCalledWith('student');
      // A self-taking aspirant is never a proxy.
      expect(setIsProxy).toHaveBeenCalledWith(false);
      // The seeded band is valid for this sub-persona, so it survives the handoff
      // (proves the row didn't silently drop to '' on a wrong/out-of-range band).
      expect(setAgeBand).toHaveBeenCalledWith(band);
    },
  );

  it('does NOT resolve a flag-gated sub-persona when its flag is OFF (proves the flag gates the mapping)', async () => {
    const user = userEvent.setup();
    const setPrimaryPersona = vi.fn();
    const setSelectedPersona = vi.fn();
    const onComplete = vi.fn();

    // With expansion OFF, people_manager is absent from the taxonomy, so activeSub
    // never resolves and handleFinish is a no-op — nothing is handed off. This is
    // the contrast that makes the flag-ON tests above meaningful.
    const finish = await renderAtFinish(
      { trackId: 'professional', subId: 'people_manager', band: '24-45', goal: 'growth' },
      { personaModelExpansion: false, setPrimaryPersona, setSelectedPersona, onComplete },
    );

    await user.click(finish);

    expect(setPrimaryPersona).not.toHaveBeenCalled();
    expect(setSelectedPersona).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });
});
