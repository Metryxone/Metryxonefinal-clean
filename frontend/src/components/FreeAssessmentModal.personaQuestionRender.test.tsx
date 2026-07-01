import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ── What this suite proves ──────────────────────────────────────────────────
// Task #360 (FreeAssessmentModal.personaQuestionBank.test.tsx) proves the REAL
// PersonaJourneyWizard hands off (primaryPersona, selectedPersona, alignment
// flags) that RE-DERIVE the correct bank via `resolveQuestionBank(...)`. What it
// does NOT prove is that those bank questions actually reach the SCREEN: it stubs
// IntroPhase entirely, so the real question-rendering phase (QuestionsPhase) never
// mounts. A regression in the modal's own bank IIFE (FreeAssessmentModal ~line
// 1558) or in QuestionsPhase's rendering could still paint the wrong questions
// even though `resolveQuestionBank` returns the right array in isolation.
//
// This suite closes that gap. For two distinct personas it drives the REAL wizard
// to completion INSIDE the REAL FreeAssessmentModal (flags ON), then renders the
// REAL, UNSTUBBED QuestionsPhase, and asserts the ACTUAL on-screen question
// statements (every one of the 10 items, in order) match the persona-appropriate
// bank — the campus bank for a college student, the dedicated career_explorer
// sub-persona bank for an explorer — and NOT the modal's no-persona student
// default. This exercises the modal's own `questions` selection + QuestionsPhase's
// `questions[currentQ].text` render, which the current suite skips.
//
// ── Fidelity note (honest scope) ────────────────────────────────────────────
// The modal wires QuestionsPhase at `phase === "questions"` (render ~line 3134),
// fed by the `questions` value the modal computes from the wizard-selected persona
// via `resolveQuestionBank`. In the current live product the wizard→intro flow
// routes into the CAPADEX server-question path (CapadexQPhase), so nothing in the
// runtime sets `phase = "questions"` on its own. To exercise the persona→bank→
// on-screen render chain that resolveQuestionBank feeds, IntroPhase is stubbed as
// a *transition trigger only* (it flips the modal to the "questions" phase on
// mount — the current #360 suite already fully stubs IntroPhase). Every other
// piece is REAL: the wizard, the modal's bank IIFE, and QuestionsPhase. We do NOT
// stub the questions phase itself.

vi.mock('./assessment/phases/IntroPhase', () => ({
  IntroPhase: (props: { setPhase: (p: string) => void; selectedPersona: string | null }) => {
    // Hand the modal off to the REAL QuestionsPhase — but ONLY once the wizard's
    // `setSelectedPersona` has committed. Firing before that would let the modal's
    // own `questions` IIFE hit its `!selectedPersona` → student-default branch,
    // masking the persona bank we're trying to verify.
    React.useEffect(() => {
      if (props.selectedPersona) props.setPhase('questions');
    }, [props.selectedPersona, props.setPhase]);
    return <div data-testid="intro-phase" />;
  },
}));

import { FreeAssessmentModal } from './FreeAssessmentModal';
import {
  QUESTION_BANKS,
  SUB_PERSONA_QUESTION_BANKS,
  type Question,
} from '@/lib/behavioural-insights';

// Serve public-config with the persona-journey router ON (so the REAL wizard
// mounts) AND persona-model alignment ON (so dedicated sub-persona banks are
// eligible — mirroring an aligned production deployment). Everything else is an
// inert non-ok payload so nothing throws.
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
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as any);
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as any);
  });
}

// Canonical, verbatim labels (must match persona-taxonomy.ts + PersonaJourneyWizard.tsx).
const AGE_LABEL = {
  '17-24': 'College / Early Adult (17–24)',
} as const;
const GOAL = {
  clarity: 'Get clarity on my strengths & direction',
} as const;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
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

// Walk the REAL wizard: track → sub-persona → age → goal → personalize → journey
// → "Start my assessment". The stubbed IntroPhase then flips us to the REAL
// QuestionsPhase.
async function finishWizard(user: ReturnType<typeof userEvent.setup>) {
  const finish = await screen.findByTestId('wizard-start-assessment');
  await user.click(finish);
  // The stubbed IntroPhase flips to the "questions" phase as soon as the wizard's
  // persona commits, so it may unmount before we could observe it — wait directly
  // for the REAL QuestionsPhase to paint the first on-screen question.
  await screen.findByTestId('question-text');
}

// Assert the REAL QuestionsPhase renders EVERY item of `bank`, in order, by
// navigating through the whole assessment. Proves the FULL question set (not just
// the opener) makes it onto the screen for this persona. We stop one click short
// of the final answer so we never trip the modal into the "analyzing" phase.
async function assertFullBankRenders(
  user: ReturnType<typeof userEvent.setup>,
  bank: Question[],
  notBanks: Question[][],
) {
  // Header counter reflects the served bank length ("1/10").
  expect(screen.getByText(`1/${bank.length}`)).toBeInTheDocument();

  for (let i = 0; i < bank.length; i++) {
    const q = screen.getByTestId('question-text');
    expect(q.textContent).toContain(bank[i].text);
    // The on-screen statement is NOT any of the wrong banks' item at this slot.
    for (const wrong of notBanks) {
      if (wrong[i]) expect(q.textContent).not.toContain(wrong[i].text);
    }
    if (i < bank.length - 1) {
      await user.click(screen.getByTestId('rating-3'));
      await waitFor(() =>
        expect(screen.getByTestId('question-text').textContent).toContain(bank[i + 1].text),
      );
    }
  }
}

describe('FreeAssessmentModal — wizard persona renders the full on-screen question set', () => {
  it('a self-taking college student sees the full campus bank on screen (not the student default)', async () => {
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

    // The campus bank (10 items) renders verbatim, in order, on screen …
    await assertFullBankRenders(user, QUESTION_BANKS.campus, [QUESTION_BANKS.student]);
  });

  it('a career explorer sees the DEDICATED career_explorer bank on screen (not the legacy jobseeker or student default)', async () => {
    const user = userEvent.setup();
    renderModal();
    await waitForWizard();

    // Students & learners → Exploring my next move (career_explorer / jobseeker).
    // This sub-persona has a dedicated bank in SUB_PERSONA_QUESTION_BANKS, so with
    // alignment ON the modal must swap the served questions away from the legacy
    // jobseeker bank — and those swapped questions must reach the screen.
    await user.click(screen.getByText('Students & learners'));
    await user.click(screen.getByText('Exploring my next move'));
    await user.click(screen.getByText(AGE_LABEL['17-24']));
    await user.click(screen.getByRole('button', { name: /Continue/i })); // → Goal
    await user.click(screen.getByText(GOAL.clarity));
    await user.click(screen.getByRole('button', { name: /Continue/i })); // → Personalize
    await user.click(screen.getByRole('button', { name: /Continue/i })); // → Your journey
    await finishWizard(user);

    await assertFullBankRenders(
      user,
      SUB_PERSONA_QUESTION_BANKS.career_explorer,
      [QUESTION_BANKS.jobseeker, QUESTION_BANKS.student],
    );
  });
});
