import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ── What this suite proves ──────────────────────────────────────────────────
// Task #354 proved WHICH onboarding path renders (wizard vs classic picker) by
// stubbing PersonaJourneyWizard. This suite closes the remaining gap: it drives
// the REAL PersonaJourneyWizard to completion INSIDE the REAL FreeAssessmentModal
// (flag ON) and asserts the modal's setter wiring actually populates the
// downstream IntroPhase with the persona / legacyKey / is_proxy / ageBand / goal /
// timeline the user picked in the wizard. A regression in the setter wiring
// (~FreeAssessmentModal lines 3117-3129) would hand an empty/wrong persona to
// IntroPhase even though the correct path renders — that is exactly what this
// catches.
//
// ONLY IntroPhase is stubbed — it records every prop bundle it is handed so we
// can read the final (post-handoff) values. The wizard itself is the REAL one.

type IntroSnapshot = {
  primaryPersona: unknown;
  selectedPersona: unknown;
  isProxy: unknown;
  ageBand: unknown;
  participantGoal: unknown;
  goalTimeline: unknown;
  personaResolvedUpstream: unknown;
};

const introRenders: IntroSnapshot[] = [];

vi.mock('./assessment/phases/IntroPhase', () => ({
  IntroPhase: (props: Record<string, unknown>) => {
    introRenders.push({
      primaryPersona: props.primaryPersona,
      selectedPersona: props.selectedPersona,
      isProxy: props.isProxy,
      ageBand: props.ageBand,
      participantGoal: props.participantGoal,
      goalTimeline: props.goalTimeline,
      personaResolvedUpstream: props.personaResolvedUpstream,
    });
    return <div data-testid="intro-phase" />;
  },
}));

import { FreeAssessmentModal } from './FreeAssessmentModal';

// Serve the public-config the modal fetches on open with the persona-journey
// router flag ON; stub the Step-5 /route resolver and return an empty payload for
// any other incidental fetch so nothing throws.
function mockFetch() {
  (globalThis as any).fetch = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : String((input as any)?.url ?? input);
    if (url.includes('/api/capadex/public-config')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ persona_journey_router: true }),
      } as any);
    }
    if (url.includes('/api/persona-journey/route')) {
      // The wizard tolerates a non-resolved route (finish still enables); we only
      // need routeLoading to flip false so "Start my assessment" is clickable.
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as any);
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as any);
  });
}

// Canonical, verbatim labels (must match persona-taxonomy.ts + PersonaJourneyWizard.tsx).
const AGE_LABEL = {
  '6-14': 'School (6–14)',
  '17-24': 'College / Early Adult (17–24)',
  '24-45': 'Working Professional (24–45)',
} as const;
const GOAL = {
  clarity: 'Get clarity on my strengths & direction',
  growth: 'Grow in my current role',
  support: 'Support someone in my care',
} as const;
const FOCUS = { skills: 'Skills & competencies' } as const;
const TIMELINE = { short: 'Soon (1–3 months)' } as const;

beforeEach(() => {
  introRenders.length = 0;
  localStorage.clear();
  mockFetch();
});

function renderModal() {
  return render(<FreeAssessmentModal open onOpenChange={vi.fn()} />);
}

// Wait for the async public-config to flip the flag and mount the REAL wizard.
async function waitForWizard() {
  await waitFor(() =>
    expect(screen.getByTestId('persona-journey-wizard')).toBeInTheDocument(),
  );
}

// Click "Start my assessment" once Step 5 has finished its (stubbed) /route fetch.
async function finishWizard(user: ReturnType<typeof userEvent.setup>) {
  const finish = await screen.findByTestId('wizard-start-assessment');
  await user.click(finish);
  // The wizard completing swaps in the stubbed IntroPhase.
  await screen.findByTestId('intro-phase');
}

function lastIntro(): IntroSnapshot {
  expect(introRenders.length).toBeGreaterThan(0);
  return introRenders[introRenders.length - 1];
}

describe('FreeAssessmentModal — real wizard completion populates IntroPhase', () => {
  it('hands a self-taking student (learner track) the exact persona, legacyKey and goal', async () => {
    const user = userEvent.setup();
    renderModal();
    await waitForWizard();

    // Step 1 — Who: clicking a track both selects it and advances to Refine.
    await user.click(screen.getByText('Students & learners'));
    // Step 2 — Refine: pick the sub-persona (single age band auto-selects) + confirm band.
    await user.click(screen.getByText('College or university student'));
    await user.click(screen.getByText(AGE_LABEL['17-24']));
    await user.click(screen.getByRole('button', { name: /Continue/i })); // → Goal
    // Step 3 — Goal.
    await user.click(screen.getByText(GOAL.clarity));
    await user.click(screen.getByRole('button', { name: /Continue/i })); // → Personalize
    // Step 4 — Personalize: skip focus.
    await user.click(screen.getByRole('button', { name: /Continue/i })); // → Your journey
    // Step 5 — finish.
    await finishWizard(user);

    const intro = lastIntro();
    // Sub-persona id passes through verbatim…
    expect(intro.primaryPersona).toBe('campus_student');
    // …and the legacyKey (campus ≠ the sub-persona id) is what drives every
    // downstream phase — the seam most likely to regress.
    expect(intro.selectedPersona).toBe('campus');
    // A self-taker is never a proxy.
    expect(intro.isProxy).toBe(false);
    expect(intro.ageBand).toBe('17-24');
    // No focus chosen → the goal label is bare (no " — <focus>" suffix).
    expect(intro.participantGoal).toBe(GOAL.clarity);
    expect(intro.goalTimeline).toBe('');
    // Persona was resolved upstream by the wizard.
    expect(intro.personaResolvedUpstream).toBe(true);
  });

  it('hands a self-taking professional the goal+focus composite and timeline (is_proxy=false)', async () => {
    const user = userEvent.setup();
    renderModal();
    await waitForWizard();

    await user.click(screen.getByText('Working professionals'));
    await user.click(screen.getByText('Mid career (3–10 yrs)'));
    await user.click(screen.getByText(AGE_LABEL['24-45']));
    await user.click(screen.getByRole('button', { name: /Continue/i })); // → Goal
    await user.click(screen.getByText(GOAL.growth));
    await user.click(screen.getByText(TIMELINE.short)); // optional timeline
    await user.click(screen.getByRole('button', { name: /Continue/i })); // → Personalize
    await user.click(screen.getByText(FOCUS.skills)); // optional focus
    await user.click(screen.getByRole('button', { name: /Continue/i })); // → Your journey
    await finishWizard(user);

    const intro = lastIntro();
    expect(intro.primaryPersona).toBe('mid_career_professional');
    expect(intro.selectedPersona).toBe('professional');
    expect(intro.isProxy).toBe(false);
    expect(intro.ageBand).toBe('24-45');
    // Goal label is composed with the focus suffix ("<goal> — <focus>").
    expect(intro.participantGoal).toBe(`${GOAL.growth} — ${FOCUS.skills}`);
    expect(intro.goalTimeline).toBe(TIMELINE.short);
    expect(intro.personaResolvedUpstream).toBe(true);
  });

  it('hands a proxy (parent) is_proxy=true with the child-scoped age band and goal', async () => {
    const user = userEvent.setup();
    renderModal();
    await waitForWizard();

    await user.click(screen.getByText('Parents, teachers & counsellors'));
    await user.click(screen.getByText('Parent'));
    // Parent has two allowed bands → the band MUST be chosen explicitly.
    await user.click(screen.getByText(AGE_LABEL['6-14']));
    await user.click(screen.getByRole('button', { name: /Continue/i })); // → Goal
    await user.click(screen.getByText(GOAL.support));
    await user.click(screen.getByRole('button', { name: /Continue/i })); // → Personalize
    await user.click(screen.getByRole('button', { name: /Continue/i })); // → Your journey
    await finishWizard(user);

    const intro = lastIntro();
    expect(intro.primaryPersona).toBe('parent');
    expect(intro.selectedPersona).toBe('parent');
    // The proxy flag MUST travel — the seam where a proxy could silently be
    // treated as a self-taker downstream.
    expect(intro.isProxy).toBe(true);
    expect(intro.ageBand).toBe('6-14');
    expect(intro.participantGoal).toBe(GOAL.support);
    expect(intro.goalTimeline).toBe('');
    expect(intro.personaResolvedUpstream).toBe(true);
  });
});
