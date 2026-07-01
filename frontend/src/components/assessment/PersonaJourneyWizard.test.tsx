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
