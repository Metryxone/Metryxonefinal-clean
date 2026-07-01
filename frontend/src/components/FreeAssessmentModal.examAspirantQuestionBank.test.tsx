import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ── What this suite proves ──────────────────────────────────────────────────
// FreeAssessmentModal.personaQuestionBank.test.tsx already proves that a BASE
// taxonomy sub-persona (career_explorer, always present) drives the correct
// dedicated bank. It does NOT cover the sub-personas that only APPEAR when the
// persona-depth flags are ON:
//   • personaModelAlignment → jee/neet/cuet/upsc_aspirant (the exam split)
//   • personaModelExpansion → people_manager / senior_leadership /
//     learning_development (enterprise) and higher_ed_faculty (faculty).
//
// These are the personas most at risk of a silent regression, because TWO things
// must move in tandem for them to work: (1) the wizard's taxonomy split must
// render the flag-gated sub-persona (buildTrackGroups), AND (2) the modal's bank
// resolution must pass the SAME flag into resolveQuestionBank. If the wizard
// shows the split but the modal resolves the bank off a stale flag, the user
// picks "JEE aspirant" yet silently gets the generic student bank.
//
// This suite drives the REAL PersonaJourneyWizard to completion INSIDE the REAL
// FreeAssessmentModal, once per persona-depth flag IN ISOLATION (alignment ON /
// expansion OFF for the exam case; expansion ON / alignment OFF for the
// enterprise + faculty cases), captures the EXACT (primaryPersona, selectedPersona,
// flag state) the modal fed to IntroPhase, replays the modal's own bank selection,
// and asserts the DEDICATED sub-persona bank is served — never the legacy default.
//
// Only IntroPhase is stubbed (to record the post-handoff prop bundle). The wizard
// and resolveQuestionBank are the REAL implementations.

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

// public-config with the persona-journey router ON (so the REAL wizard mounts)
// plus whichever persona-depth flag(s) the individual test needs. Every other
// fetch resolves to an inert non-ok payload so nothing throws.
type DepthFlags = { alignment?: boolean; expansion?: boolean };
function mockFetch(flags: DepthFlags) {
  (globalThis as any).fetch = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : String((input as any)?.url ?? input);
    if (url.includes('/api/capadex/public-config')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          persona_journey_router: true,
          persona_model_alignment: !!flags.alignment,
          persona_model_expansion: !!flags.expansion,
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
  '14-17': 'Senior School (14–17)',
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

describe('FreeAssessmentModal — flag-gated exam / enterprise / faculty personas drive their dedicated banks', () => {
  it('alignment ON: driving the wizard to a JEE aspirant serves SUB_PERSONA_QUESTION_BANKS.jee_aspirant (not the student default)', async () => {
    // Alignment ON, expansion OFF — the exam split appears via personaModelAlignment ALONE.
    mockFetch({ alignment: true, expansion: false });
    const user = userEvent.setup();
    renderModal();
    await waitForWizard();

    // Students & learners → JEE aspirant (Engineering). This sub-persona ONLY
    // exists when alignment is ON; with it OFF the track shows the merged
    // "JEE / NEET / UPSC aspirant" instead (asserted separately below).
    await user.click(screen.getByText('Students & learners'));
    await user.click(screen.getByText('JEE aspirant (Engineering)'));
    await user.click(screen.getByText(AGE_LABEL['17-24']));
    await user.click(screen.getByRole('button', { name: /Continue/i })); // → Goal
    await user.click(screen.getByText(GOAL.clarity));
    await user.click(screen.getByRole('button', { name: /Continue/i })); // → Personalize
    await user.click(screen.getByRole('button', { name: /Continue/i })); // → Your journey
    await finishWizard(user);

    const intro = lastIntro();
    expect(intro.primaryPersona).toBe('jee_aspirant');
    // jee_aspirant carries legacyKey 'student' → selectedPersona is the legacy key.
    expect(intro.selectedPersona).toBe('student');
    // The modal actually resolved alignment ON (and expansion OFF) from public-config.
    expect(intro.personaModelAlignment).toBe(true);
    expect(intro.personaModelExpansion).toBe(false);

    const bank = bankForIntro(intro);
    // The dedicated exam-aspirant bank is served …
    expect(bank).toBe(SUB_PERSONA_QUESTION_BANKS.jee_aspirant);
    // … NOT the legacy 'student' bank the OR-flag would otherwise fall back to.
    expect(bank).not.toBe(QUESTION_BANKS.student);
  });

  it('expansion ON: driving the wizard to a People manager serves SUB_PERSONA_QUESTION_BANKS.people_manager (not the professional default)', async () => {
    // Expansion ON, alignment OFF — enterprise sub-personas appear via
    // personaModelExpansion ALONE. This proves the OR-flag in the modal picks up
    // the expansion flag (not just alignment) for bank resolution.
    mockFetch({ alignment: false, expansion: true });
    const user = userEvent.setup();
    renderModal();
    await waitForWizard();

    // Working professionals → People manager (leads a team).
    await user.click(screen.getByText('Working professionals'));
    await user.click(screen.getByText('People manager (leads a team)'));
    await user.click(screen.getByText(AGE_LABEL['24-45']));
    await user.click(screen.getByRole('button', { name: /Continue/i })); // → Goal
    await user.click(screen.getByText(GOAL.growth));
    await user.click(screen.getByRole('button', { name: /Continue/i })); // → Personalize
    await user.click(screen.getByRole('button', { name: /Continue/i })); // → Your journey
    await finishWizard(user);

    const intro = lastIntro();
    expect(intro.primaryPersona).toBe('people_manager');
    // people_manager carries legacyKey 'professional'.
    expect(intro.selectedPersona).toBe('professional');
    expect(intro.personaModelExpansion).toBe(true);
    expect(intro.personaModelAlignment).toBe(false);

    const bank = bankForIntro(intro);
    expect(bank).toBe(SUB_PERSONA_QUESTION_BANKS.people_manager);
    expect(bank).not.toBe(QUESTION_BANKS.professional);
  });

  it('expansion ON: driving the wizard to Higher-education faculty (proxy track) serves SUB_PERSONA_QUESTION_BANKS.higher_ed_faculty (not the teacher default)', async () => {
    mockFetch({ alignment: false, expansion: true });
    const user = userEvent.setup();
    renderModal();
    await waitForWizard();

    // Parents, teachers & counsellors → Higher-education faculty (proxy sub-persona,
    // only present when expansion is ON).
    await user.click(screen.getByText('Parents, teachers & counsellors'));
    await user.click(screen.getByText('Higher-education faculty'));
    await user.click(screen.getByText(AGE_LABEL['17-24']));
    await user.click(screen.getByRole('button', { name: /Continue/i })); // → Goal
    await user.click(screen.getByText(GOAL.clarity));
    await user.click(screen.getByRole('button', { name: /Continue/i })); // → Personalize
    await user.click(screen.getByRole('button', { name: /Continue/i })); // → Your journey
    await finishWizard(user);

    const intro = lastIntro();
    expect(intro.primaryPersona).toBe('higher_ed_faculty');
    // higher_ed_faculty carries legacyKey 'teacher'.
    expect(intro.selectedPersona).toBe('teacher');
    expect(intro.personaModelExpansion).toBe(true);

    const bank = bankForIntro(intro);
    expect(bank).toBe(SUB_PERSONA_QUESTION_BANKS.higher_ed_faculty);
    expect(bank).not.toBe(QUESTION_BANKS.teacher);
  });

  it('flag OFF gates the split BOTH in the wizard AND in the resolver (no silent generic-bank fallback)', async () => {
    // With BOTH persona-depth flags OFF the wizard must NOT render the exam split
    // or the enterprise/faculty sub-personas — it shows the merged legacy chips —
    // and the resolver must fall back to the legacy PersonaKey bank. This is the
    // "in tandem" proof: the wizard split and the bank resolution are gated by the
    // SAME flag, so flag-OFF stays byte-identical to legacy.
    mockFetch({ alignment: false, expansion: false });
    const user = userEvent.setup();
    renderModal();
    await waitForWizard();

    // Picking a track advances to Refine (step 2), which shows only that track's
    // sub-personas — so we Back out to the track list between checks.
    const backToTracks = async () => {
      await user.click(screen.getByRole('button', { name: /Back/i }));
    };

    // Exam split is collapsed to the single merged chip.
    await user.click(screen.getByText('Students & learners'));
    expect(screen.getByText('JEE / NEET / UPSC aspirant')).toBeInTheDocument();
    expect(screen.queryByText('JEE aspirant (Engineering)')).not.toBeInTheDocument();
    await backToTracks();

    // Enterprise sub-personas are absent while expansion is OFF.
    await user.click(screen.getByText('Working professionals'));
    expect(screen.queryByText('People manager (leads a team)')).not.toBeInTheDocument();
    await backToTracks();

    // Faculty sub-persona is absent while expansion is OFF.
    await user.click(screen.getByText('Parents, teachers & counsellors'));
    expect(screen.queryByText('Higher-education faculty')).not.toBeInTheDocument();

    // Resolver contract: flag OFF → legacy PersonaKey bank for every gated sub-persona,
    // even if a stale sub-persona id were somehow passed through.
    expect(resolveQuestionBank('jee_aspirant', 'student', false)).toBe(QUESTION_BANKS.student);
    expect(resolveQuestionBank('people_manager', 'professional', false)).toBe(QUESTION_BANKS.professional);
    expect(resolveQuestionBank('higher_ed_faculty', 'teacher', false)).toBe(QUESTION_BANKS.teacher);

    // …and flag ON flips each to its dedicated bank (the two states genuinely differ).
    expect(resolveQuestionBank('jee_aspirant', 'student', true)).toBe(SUB_PERSONA_QUESTION_BANKS.jee_aspirant);
    expect(resolveQuestionBank('people_manager', 'professional', true)).toBe(SUB_PERSONA_QUESTION_BANKS.people_manager);
    expect(resolveQuestionBank('higher_ed_faculty', 'teacher', true)).toBe(SUB_PERSONA_QUESTION_BANKS.higher_ed_faculty);
  });
});
