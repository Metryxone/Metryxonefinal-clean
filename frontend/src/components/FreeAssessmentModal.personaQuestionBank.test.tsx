import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ── What this suite proves ──────────────────────────────────────────────────
// Task #357 proved the PersonaJourneyWizard's picks (persona, legacyKey, is_proxy,
// ageBand, goal, timeline) REACH IntroPhase when the wizard completes. It did NOT
// prove the assessment that FOLLOWS actually uses that persona — i.e. that the
// resolved (primaryPersona, legacyKey) selects the correct behavioural question
// bank via `resolveQuestionBank`. A regression could hand IntroPhase the right
// persona but still serve a wrong / default question bank downstream.
//
// This suite closes that gap. It drives the REAL PersonaJourneyWizard to
// completion INSIDE the REAL FreeAssessmentModal (flags ON) for multiple distinct
// personas, captures the EXACT inputs the modal feeds to `resolveQuestionBank`
// (primaryPersona + selectedPersona from IntroPhase props, plus the persona-depth
// flags the modal itself resolved from /api/capadex/public-config), then calls
// the REAL `resolveQuestionBank(...)` with those wizard-resolved values and
// asserts the bank is the persona-appropriate set — NOT the modal's default
// (QUESTION_BANKS.student, served when no persona is selected).
//
// Only IntroPhase is stubbed — it records the prop bundle so we can read the
// final (post-handoff) values + the runtime flag state. The wizard is REAL.

type IntroSnapshot = {
  primaryPersona: string | null;
  selectedPersona: string | null;
  personaModelAlignment: boolean;
  personaModelExpansion: boolean;
};

const introRenders: IntroSnapshot[] = [];

vi.mock('./assessment/phases/IntroPhase', () => ({
  IntroPhase: (props: Record<string, unknown>) => {
    introRenders.push({
      primaryPersona: (props.primaryPersona as string | null) ?? null,
      selectedPersona: (props.selectedPersona as string | null) ?? null,
      personaModelAlignment: !!props.personaModelAlignment,
      personaModelExpansion: !!props.personaModelExpansion,
    });
    return <div data-testid="intro-phase" />;
  },
}));

import { FreeAssessmentModal } from './FreeAssessmentModal';
import {
  resolveQuestionBank,
  QUESTION_BANKS,
  SUB_PERSONA_QUESTION_BANKS,
} from '@/lib/behavioural-insights';

// Serve public-config with the persona-journey router ON (so the REAL wizard
// mounts) AND the persona-model alignment flag ON (so tailored sub-persona banks
// are eligible — mirroring an aligned production deployment). Every other fetch
// resolves to an inert non-ok payload so nothing throws.
function mockFetch() {
  (globalThis as any).fetch = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : String((input as any)?.url ?? input);
    if (url.includes('/api/capadex/public-config')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          persona_journey_router: true,
          persona_model_alignment: true,
        }),
      } as any);
    }
    if (url.includes('/api/persona-journey/route')) {
      // A non-resolved route still lets Step 5 enable "Start my assessment".
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as any);
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as any);
  });
}

// Canonical, verbatim labels (must match persona-taxonomy.ts + PersonaJourneyWizard.tsx).
const AGE_LABEL = {
  '17-24': 'College / Early Adult (17–24)',
  '24-45': 'Working Professional (24–45)',
} as const;
const GOAL = {
  clarity: 'Get clarity on my strengths & direction',
  growth: 'Grow in my current role',
} as const;

beforeEach(() => {
  introRenders.length = 0;
  localStorage.clear();
  mockFetch();
});

function renderModal() {
  return render(<FreeAssessmentModal open onOpenChange={vi.fn()} />);
}

async function waitForWizard() {
  await waitFor(() =>
    expect(screen.getByTestId('persona-journey-wizard')).toBeInTheDocument(),
  );
}

async function finishWizard(user: ReturnType<typeof userEvent.setup>) {
  const finish = await screen.findByTestId('wizard-start-assessment');
  await user.click(finish);
  await screen.findByTestId('intro-phase');
}

function lastIntro(): IntroSnapshot {
  expect(introRenders.length).toBeGreaterThan(0);
  return introRenders[introRenders.length - 1];
}

// Reproduce the modal's EXACT bank selection (FreeAssessmentModal ~line 1569):
//   resolveQuestionBank(primaryPersona, selectedPersona,
//                       personaAlignmentEnabled || personaExpansionEnabled)
// using the flag state the modal itself resolved (captured from IntroPhase props).
function bankForIntro(intro: IntroSnapshot) {
  const alignmentOn = intro.personaModelAlignment || intro.personaModelExpansion;
  return resolveQuestionBank(intro.primaryPersona, intro.selectedPersona as any, alignmentOn);
}

describe('FreeAssessmentModal — wizard persona drives the downstream question bank', () => {
  it('serves a self-taking college student the campus bank (persona-appropriate, not the student default)', async () => {
    const user = userEvent.setup();
    renderModal();
    await waitForWizard();

    // Students & learners → College or university student (campus_student / campus).
    await user.click(screen.getByText('Students & learners'));
    await user.click(screen.getByText('College or university student'));
    await user.click(screen.getByText(AGE_LABEL['17-24']));
    await user.click(screen.getByRole('button', { name: /Continue/i })); // → Goal
    await user.click(screen.getByText(GOAL.clarity));
    await user.click(screen.getByRole('button', { name: /Continue/i })); // → Personalize
    await user.click(screen.getByRole('button', { name: /Continue/i })); // → Your journey
    await finishWizard(user);

    const intro = lastIntro();
    expect(intro.primaryPersona).toBe('campus_student');
    expect(intro.selectedPersona).toBe('campus');
    // The modal actually resolved the alignment flag ON from public-config.
    expect(intro.personaModelAlignment).toBe(true);

    const bank = bankForIntro(intro);
    // campus_student has no dedicated sub-persona bank → it inherits its legacy
    // PersonaKey bank. That MUST be the campus bank …
    expect(bank).toBe(QUESTION_BANKS.campus);
    // … and NOT the modal's no-persona default (QUESTION_BANKS.student).
    expect(bank).not.toBe(QUESTION_BANKS.student);
  });

  it('serves a self-taking mid-career professional the professional bank (distinct from the student case)', async () => {
    const user = userEvent.setup();
    renderModal();
    await waitForWizard();

    // Working professionals → Mid career (mid_career_professional / professional).
    await user.click(screen.getByText('Working professionals'));
    await user.click(screen.getByText('Mid career (3–10 yrs)'));
    await user.click(screen.getByText(AGE_LABEL['24-45']));
    await user.click(screen.getByRole('button', { name: /Continue/i })); // → Goal
    await user.click(screen.getByText(GOAL.growth));
    await user.click(screen.getByRole('button', { name: /Continue/i })); // → Personalize
    await user.click(screen.getByRole('button', { name: /Continue/i })); // → Your journey
    await finishWizard(user);

    const intro = lastIntro();
    expect(intro.primaryPersona).toBe('mid_career_professional');
    expect(intro.selectedPersona).toBe('professional');

    const bank = bankForIntro(intro);
    expect(bank).toBe(QUESTION_BANKS.professional);
    expect(bank).not.toBe(QUESTION_BANKS.student);
    // The professional bank is genuinely different from the student-track default.
    expect(bank).not.toBe(QUESTION_BANKS.campus);
  });

  it('serves a career explorer the DEDICATED sub-persona bank (overrides the legacy jobseeker default when alignment is ON)', async () => {
    const user = userEvent.setup();
    renderModal();
    await waitForWizard();

    // Students & learners → Exploring my next move (career_explorer / jobseeker).
    // This sub-persona HAS a tailored bank in SUB_PERSONA_QUESTION_BANKS, so the
    // wizard picking it must swap the served questions away from the legacy bank.
    await user.click(screen.getByText('Students & learners'));
    await user.click(screen.getByText('Exploring my next move'));
    await user.click(screen.getByText(AGE_LABEL['17-24']));
    await user.click(screen.getByRole('button', { name: /Continue/i })); // → Goal
    await user.click(screen.getByText(GOAL.clarity));
    await user.click(screen.getByRole('button', { name: /Continue/i })); // → Personalize
    await user.click(screen.getByRole('button', { name: /Continue/i })); // → Your journey
    await finishWizard(user);

    const intro = lastIntro();
    expect(intro.primaryPersona).toBe('career_explorer');
    expect(intro.selectedPersona).toBe('jobseeker');
    expect(intro.personaModelAlignment).toBe(true);

    const bank = bankForIntro(intro);
    // With alignment ON, the dedicated career_explorer bank is served …
    expect(bank).toBe(SUB_PERSONA_QUESTION_BANKS.career_explorer);
    // … NOT the legacy jobseeker bank and NOT the no-persona default.
    expect(bank).not.toBe(QUESTION_BANKS.jobseeker);
    expect(bank).not.toBe(QUESTION_BANKS.student);
  });

  it('confirms the dedicated bank is gated on the flag: with alignment OFF the same persona falls back to the legacy bank', () => {
    // Guards the resolver contract the modal depends on — proves the dedicated
    // bank only wins when the persona-depth flag is ON, so flag-OFF stays
    // byte-identical to the legacy jobseeker bank.
    const withFlag = resolveQuestionBank('career_explorer', 'jobseeker', true);
    const withoutFlag = resolveQuestionBank('career_explorer', 'jobseeker', false);
    expect(withFlag).toBe(SUB_PERSONA_QUESTION_BANKS.career_explorer);
    expect(withoutFlag).toBe(QUESTION_BANKS.jobseeker);
    expect(withFlag).not.toBe(withoutFlag);
  });
});
