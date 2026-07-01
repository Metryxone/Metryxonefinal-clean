import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ── What this suite proves ──────────────────────────────────────────────────
// Task #363: the wizard's Step 5 must show the REAL resolved journey end-to-end
// (label + lifecycle stages the backend /api/persona-journey/route returns), not
// just enable the finish button. The handoff suite deliberately stubs /route with
// a NON-resolved payload and only checks that "Start my assessment" becomes
// clickable — it never asserts the resolved journey renders. This suite closes
// that gap by driving the REAL PersonaJourneyWizard (flag ON) to Step 5 and
// asserting:
//   • resolved:true  → the journey label + "Your growth stages" spine + each
//                       lifecycle stage label + assessment chips actually render.
//   • resolved:false → the honest amber fallback renders instead (unchanged).
//
// Only IntroPhase is stubbed (so completing the wizard doesn't pull in the whole
// downstream flow); the wizard itself is the REAL component.

vi.mock('./assessment/phases/IntroPhase', () => ({
  IntroPhase: () => <div data-testid="intro-phase" />,
}));

import { FreeAssessmentModal } from './FreeAssessmentModal';

// A realistic resolved payload matching the backend resolver's response shape
// (backend/routes/persona-journey.ts). Labels here mirror what the live resolver
// returns for a campus_student (verified in-process).
const RESOLVED_STUDENT = {
  ok: true,
  resolved: true,
  journey: {
    key: 'student_career',
    label: 'Student → Career',
    persona: 'student',
    definition: 'Discover strengths, explore careers, build a plan.',
    status: 'PARTIAL',
    statusNote: 'Adoption is still ramping for this journey.',
  },
  lifecycle: {
    entryStage: { code: 'CAP_INS', label: 'Curiosity' },
    stages: [
      { code: 'CAP_INS', label: 'Curiosity' },
      { code: 'CAP_GRW', label: 'Insight' },
      { code: 'CAP_MAS', label: 'Growth' },
    ],
  },
  assessments: [
    { key: 'entry', label: 'Entry Assessment', status: 'IMPLEMENTED' },
    { key: 'behaviour', label: 'Behaviour Assessment', status: 'IMPLEMENTED' },
  ],
  dashboards: 'Student dashboard',
  reports: 'CAPADEX behavioural report',
  recommendations: 'Personalized growth recommendations',
  learningJourney: 'Discover strengths, explore careers, build a plan.',
  outcomes: 'Career clarity + measurable growth',
};

// Serve the public-config with the persona-journey router flag ON, and let the
// caller decide what /route returns (resolved vs non-resolved).
function mockFetch(routePayload: { ok: boolean; body: unknown }) {
  (globalThis as any).fetch = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : String((input as any)?.url ?? input);
    if (url.includes('/api/capadex/public-config')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ persona_journey_router: true }),
      } as any);
    }
    if (url.includes('/api/persona-journey/route')) {
      return Promise.resolve({ ok: routePayload.ok, json: () => Promise.resolve(routePayload.body) } as any);
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as any);
  });
}

const AGE_LABEL_17_24 = 'College / Early Adult (17–24)';
const GOAL_CLARITY = 'Get clarity on my strengths & direction';

beforeEach(() => {
  localStorage.clear();
});

function renderModal() {
  return render(<FreeAssessmentModal open onOpenChange={vi.fn()} />);
}

async function waitForWizard() {
  await waitFor(() =>
    expect(screen.getByTestId('persona-journey-wizard')).toBeInTheDocument(),
  );
}

// Drive the REAL wizard (learner → campus student) up to and including Step 5.
async function driveToStep5(user: ReturnType<typeof userEvent.setup>) {
  renderModal();
  await waitForWizard();
  await user.click(screen.getByText('Students & learners')); // Step 1 → Refine
  await user.click(screen.getByText('College or university student'));
  await user.click(screen.getByText(AGE_LABEL_17_24));
  await user.click(screen.getByRole('button', { name: /Continue/i })); // → Goal
  await user.click(screen.getByText(GOAL_CLARITY));
  await user.click(screen.getByRole('button', { name: /Continue/i })); // → Personalize
  await user.click(screen.getByRole('button', { name: /Continue/i })); // → Your journey
}

describe('PersonaJourneyWizard Step 5 — renders the real resolved journey', () => {
  it('renders the journey label, growth-stage spine and assessments on resolved:true', async () => {
    const user = userEvent.setup();
    mockFetch({ ok: true, body: RESOLVED_STUDENT });
    await driveToStep5(user);

    // The real resolved journey — not just the finish button — must be on screen.
    await screen.findByText('Recommended journey');
    expect(screen.getByText('Student → Career')).toBeInTheDocument();
    expect(screen.getByText('Discover strengths, explore careers, build a plan.')).toBeInTheDocument();

    // The lifecycle spine renders every stage the resolver returned.
    expect(screen.getByText('Your growth stages')).toBeInTheDocument();
    expect(screen.getByText('Curiosity')).toBeInTheDocument();
    expect(screen.getByText('Insight')).toBeInTheDocument();
    expect(screen.getByText('Growth')).toBeInTheDocument();

    // Assessment chips + honest status note render too.
    expect(screen.getByText('Entry Assessment')).toBeInTheDocument();
    expect(screen.getByText('Behaviour Assessment')).toBeInTheDocument();
    expect(screen.getByText(/Adoption is still ramping/)).toBeInTheDocument();

    // The finish button is still available.
    expect(screen.getByTestId('wizard-start-assessment')).toBeInTheDocument();
  });

  it('renders the honest amber fallback on resolved:false (no fabricated journey)', async () => {
    const user = userEvent.setup();
    mockFetch({ ok: true, body: { ok: true, resolved: false, reason: 'no_assessment_journey' } });
    await driveToStep5(user);

    await screen.findByText(/couldn.t map a tailored journey/i);
    // The real journey chrome must NOT appear when nothing resolved.
    expect(screen.queryByText('Recommended journey')).not.toBeInTheDocument();
    expect(screen.queryByText('Your growth stages')).not.toBeInTheDocument();
    // Finish still enables so the user can proceed.
    expect(screen.getByTestId('wizard-start-assessment')).toBeInTheDocument();
  });
});
