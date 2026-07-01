import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ── What this suite proves ──────────────────────────────────────────────────
// Sibling suite `FreeAssessmentModal.personaWizardHandoff.test.tsx` proves the
// PersonaJourneyWizard (flag personaJourneyRouter ON) hands IntroPhase the exact
// persona / legacyKey / is_proxy / ageBand / goal / timeline the user picked.
//
// This suite closes the OTHER half of the contract: when the flag is OFF the
// modal renders the classic single-page IntroPhase selector, and driving THAT
// selector to completion must populate the SAME six modal setters with values
// consistent with the wizard's contract — the sub-persona id (primaryPersona),
// the legacyKey (selectedPersona), is_proxy, the canonical age band, the goal,
// and the timeline. If the two onboarding paths ever diverge on any of these
// seams, one path would ship a wrong/empty persona downstream even though the
// correct picker renders — exactly what this catches.
//
// The REAL IntroPhase is rendered (flag OFF). It is wrapped only to RECORD every
// prop bundle it is handed (IntroPhase is a controlled component, so its props
// mirror the live modal state after each of its own setter calls). We then read
// the final (post-selection) snapshot and assert it against the wizard contract.

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

// Wrap the REAL IntroPhase so its setter-driven modal state is observable while
// the genuine selection UI + effects (legacyKey sync, is_proxy sync, per-persona
// reset) all run for real.
vi.mock('./assessment/phases/IntroPhase', async () => {
  const actual = await vi.importActual<typeof import('./assessment/phases/IntroPhase')>(
    './assessment/phases/IntroPhase',
  );
  return {
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
      return React.createElement(actual.IntroPhase, props);
    },
  };
});

import { FreeAssessmentModal } from './FreeAssessmentModal';

// Serve the public-config the modal fetches on open with EVERY flag OFF (in
// particular persona_journey_router: false) so the classic IntroPhase renders;
// return an empty payload for any other incidental fetch so nothing throws.
function mockFetch() {
  (globalThis as any).fetch = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : String((input as any)?.url ?? input);
    if (url.includes('/api/capadex/public-config')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ persona_journey_router: false }),
      } as any);
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as any);
  });
}

beforeEach(() => {
  introRenders.length = 0;
  localStorage.clear();
  mockFetch();
});

function renderModal() {
  return render(<FreeAssessmentModal open onOpenChange={vi.fn()} />);
}

// The classic IntroPhase renders immediately (phase starts at 'intro', flag OFF).
// Wait for its persona accordion to be present before driving it.
async function waitForClassicIntro() {
  await waitFor(() =>
    expect(screen.getByTestId('track-header-learner')).toBeInTheDocument(),
  );
}

// Expand the given macro-track (accordion — the 'learner' track is open by
// default, others are collapsed) then pick the sub-persona.
async function selectPersona(
  user: ReturnType<typeof userEvent.setup>,
  trackId: string,
  personaId: string,
) {
  if (!screen.queryByTestId(`persona-${personaId}`)) {
    await user.click(screen.getByTestId(`track-header-${trackId}`));
  }
  await user.click(await screen.findByTestId(`persona-${personaId}`));
}

function lastIntro(): IntroSnapshot {
  expect(introRenders.length).toBeGreaterThan(0);
  return introRenders[introRenders.length - 1];
}

describe('FreeAssessmentModal — classic IntroPhase selection matches the wizard handoff', () => {
  it('drives a self-taking student (learner track) to the same persona, legacyKey, band & goal', async () => {
    const user = userEvent.setup();
    renderModal();
    await waitForClassicIntro();

    // Pick the sub-persona — this fires setPrimaryPersona and (via IntroPhase's
    // own effects) setSelectedPersona(legacyKey) + setIsProxy(false), and resets
    // the enrichment fields, so age band / goal / timeline are chosen AFTER.
    await selectPersona(user, 'learner', 'campus_student');

    // Age band — campus_student allows exactly one canonical band ('17-24').
    await user.selectOptions(await screen.findByTestId('select-age-band'), '17-24');

    // Reveal the optional enrichment fields (goal + timeline).
    await user.click(screen.getByTestId('toggle-more-detail'));
    await user.type(await screen.findByTestId('input-goal'), 'Get clarity on my direction');
    await user.selectOptions(screen.getByTestId('select-timeline'), 'within_3_months');

    const intro = lastIntro();
    // Sub-persona id passes through verbatim…
    expect(intro.primaryPersona).toBe('campus_student');
    // …and the legacyKey (campus ≠ the sub-persona id) is what drives every
    // downstream phase — the seam most likely to regress.
    expect(intro.selectedPersona).toBe('campus');
    // A self-taker is never a proxy.
    expect(intro.isProxy).toBe(false);
    // Canonical age band.
    expect(intro.ageBand).toBe('17-24');
    // Goal + timeline flow through the setters the wizard also drives.
    expect(intro.participantGoal).toBe('Get clarity on my direction');
    expect(intro.goalTimeline).toBe('within_3_months');
    // Classic path resolves the persona in-place — never "upstream".
    expect(intro.personaResolvedUpstream).toBe(false);
  });

  it('drives a self-taking professional to legacyKey=professional, is_proxy=false', async () => {
    const user = userEvent.setup();
    renderModal();
    await waitForClassicIntro();

    await selectPersona(user, 'professional', 'mid_career_professional');
    await user.selectOptions(await screen.findByTestId('select-age-band'), '24-45');
    await user.click(screen.getByTestId('toggle-more-detail'));
    await user.type(await screen.findByTestId('input-goal'), 'Grow in my current role');
    await user.selectOptions(screen.getByTestId('select-timeline'), 'right_away');

    const intro = lastIntro();
    expect(intro.primaryPersona).toBe('mid_career_professional');
    expect(intro.selectedPersona).toBe('professional');
    expect(intro.isProxy).toBe(false);
    expect(intro.ageBand).toBe('24-45');
    expect(intro.participantGoal).toBe('Grow in my current role');
    expect(intro.goalTimeline).toBe('right_away');
    expect(intro.personaResolvedUpstream).toBe(false);
  });

  it('drives a proxy (parent) to is_proxy=true with the child-scoped age band & goal', async () => {
    const user = userEvent.setup();
    renderModal();
    await waitForClassicIntro();

    // Proxy track is collapsed by default → selectPersona expands it first.
    await selectPersona(user, 'proxy', 'parent');
    // Parent allows two bands → the child-scoped band MUST be chosen explicitly.
    await user.selectOptions(await screen.findByTestId('select-age-band'), '6-14');
    await user.click(screen.getByTestId('toggle-more-detail'));
    await user.type(await screen.findByTestId('input-goal'), 'Support my child');
    await user.selectOptions(screen.getByTestId('select-timeline'), 'exploring');

    const intro = lastIntro();
    expect(intro.primaryPersona).toBe('parent');
    expect(intro.selectedPersona).toBe('parent');
    // The proxy flag MUST travel — the seam where a proxy could silently be
    // treated as a self-taker downstream.
    expect(intro.isProxy).toBe(true);
    expect(intro.ageBand).toBe('6-14');
    expect(intro.participantGoal).toBe('Support my child');
    expect(intro.goalTimeline).toBe('exploring');
    expect(intro.personaResolvedUpstream).toBe(false);
  });
});
