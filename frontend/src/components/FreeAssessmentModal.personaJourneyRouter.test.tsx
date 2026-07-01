import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ── Child stubs ─────────────────────────────────────────────────────────────
// FreeAssessmentModal alone decides which onboarding path renders. We stub the
// two candidate children so the test asserts *the modal's gating wiring* — not
// the internals of the wizard or the classic persona picker (those have their
// own suites).
//
//   • PersonaJourneyWizard → exposes `persona-journey-wizard` + a button that
//     fires `onComplete` (the real "wizard finished" signal).
//   • IntroPhase → records the `personaResolvedUpstream` prop it was handed on
//     every render so we can prove the exact hand-off value.

const introPersonaResolvedCalls: unknown[] = [];

vi.mock('./assessment/PersonaJourneyWizard', () => ({
  PersonaJourneyWizard: (props: { onComplete: () => void }) => (
    <div data-testid="persona-journey-wizard">
      <button data-testid="wizard-finish" onClick={() => props.onComplete()}>
        finish wizard
      </button>
    </div>
  ),
}));

vi.mock('./assessment/phases/IntroPhase', () => ({
  IntroPhase: (props: { personaResolvedUpstream?: boolean }) => {
    introPersonaResolvedCalls.push(props.personaResolvedUpstream);
    return (
      <div
        data-testid="intro-phase"
        data-persona-resolved={String(props.personaResolvedUpstream)}
      />
    );
  },
}));

import { FreeAssessmentModal } from './FreeAssessmentModal';

// Serve the flag config the modal fetches on open, and return an empty object
// for any other incidental fetch so nothing throws.
function mockPublicConfig(personaJourneyRouter: boolean) {
  (globalThis as any).fetch = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : String((input as any)?.url ?? input);
    if (url.includes('/api/capadex/public-config')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ persona_journey_router: personaJourneyRouter }),
      } as any);
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as any);
  });
}

// Serve a *broken* public-config response for the modal's on-open fetch so we can
// prove the failure path stays byte-identical. `mode` picks the failure shape:
//   • 'reject'   → fetch() itself rejects (network error / offline).
//   • 'json'     → response resolves but .json() rejects (malformed body).
//   • 'malformed'→ response .json() resolves to a non-object (null) payload.
function mockPublicConfigFailure(mode: 'reject' | 'json' | 'malformed') {
  (globalThis as any).fetch = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : String((input as any)?.url ?? input);
    if (url.includes('/api/capadex/public-config')) {
      if (mode === 'reject') {
        return Promise.reject(new Error('network down'));
      }
      if (mode === 'json') {
        return Promise.resolve({
          ok: false,
          json: () => Promise.reject(new SyntaxError('Unexpected token < in JSON')),
        } as any);
      }
      // 'malformed' → payload is not the expected object shape.
      return Promise.resolve({ ok: true, json: () => Promise.resolve(null) } as any);
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as any);
  });
}

beforeEach(() => {
  introPersonaResolvedCalls.length = 0;
  localStorage.clear();
});

function renderModal() {
  return render(<FreeAssessmentModal open onOpenChange={vi.fn()} />);
}

describe('FreeAssessmentModal — personaJourneyRouter path gating', () => {
  it('renders the classic IntroPhase (no wizard) when the flag is OFF', async () => {
    mockPublicConfig(false);
    renderModal();

    // The classic persona picker is the path; the wizard must never mount.
    await waitFor(() => expect(screen.getByTestId('intro-phase')).toBeInTheDocument());
    expect(screen.queryByTestId('persona-journey-wizard')).not.toBeInTheDocument();
  });

  it('renders the PersonaJourneyWizard (not IntroPhase) when the flag is ON and the wizard is unfinished', async () => {
    mockPublicConfig(true);
    renderModal();

    // Flag ON + wizard not yet done → the progressive wizard replaces the
    // classic picker entirely.
    await waitFor(() =>
      expect(screen.getByTestId('persona-journey-wizard')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('intro-phase')).not.toBeInTheDocument();
  });
});

describe('FreeAssessmentModal — personaResolvedUpstream hand-off value', () => {
  it('passes personaResolvedUpstream=false to IntroPhase when the flag is OFF', async () => {
    mockPublicConfig(false);
    renderModal();

    const intro = await screen.findByTestId('intro-phase');
    // Never claim the persona was resolved upstream when the router is off.
    expect(intro).toHaveAttribute('data-persona-resolved', 'false');
    expect(introPersonaResolvedCalls.every((v) => v === false)).toBe(true);
  });

  it('passes personaResolvedUpstream=true to IntroPhase only AFTER the wizard completes', async () => {
    const user = userEvent.setup();
    mockPublicConfig(true);
    renderModal();

    // Once the flag config loads, the wizard replaces the classic picker and
    // IntroPhase is unmounted. (Before the async config resolves, IntroPhase
    // renders once with personaResolvedUpstream=false — the correct
    // byte-identical default — so we drop those pre-flag renders before proving
    // the post-completion hand-off value.)
    await waitFor(() =>
      expect(screen.getByTestId('persona-journey-wizard')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('intro-phase')).not.toBeInTheDocument();
    expect(introPersonaResolvedCalls.every((v) => v === false)).toBe(true);
    introPersonaResolvedCalls.length = 0;

    // Finish the wizard → journeyWizardDone flips → IntroPhase takes over with
    // the persona already resolved upstream.
    await user.click(screen.getByTestId('wizard-finish'));

    const intro = await screen.findByTestId('intro-phase');
    expect(screen.queryByTestId('persona-journey-wizard')).not.toBeInTheDocument();
    expect(intro).toHaveAttribute('data-persona-resolved', 'true');
    // Every IntroPhase render after the hand-off carries the resolved flag.
    expect(introPersonaResolvedCalls.length).toBeGreaterThan(0);
    expect(introPersonaResolvedCalls.every((v) => v === true)).toBe(true);
  });
});

describe('FreeAssessmentModal — public-config fetch failure stays byte-identical', () => {
  // The on-open flag fetch has a `.catch(() => {})`. If it rejects, returns a
  // non-ok body whose .json() throws, or resolves a malformed payload, the modal
  // must keep the byte-identical legacy default: classic IntroPhase, no wizard,
  // personaResolvedUpstream=false. These are the risky edges Task #354 skipped.
  it('renders the classic IntroPhase (no wizard, personaResolvedUpstream=false) when fetch rejects', async () => {
    mockPublicConfigFailure('reject');
    renderModal();

    const intro = await screen.findByTestId('intro-phase');
    expect(screen.queryByTestId('persona-journey-wizard')).not.toBeInTheDocument();
    expect(intro).toHaveAttribute('data-persona-resolved', 'false');
    expect(introPersonaResolvedCalls.every((v) => v === false)).toBe(true);
  });

  it('renders the classic IntroPhase (no wizard, personaResolvedUpstream=false) when .json() throws', async () => {
    mockPublicConfigFailure('json');
    renderModal();

    const intro = await screen.findByTestId('intro-phase');
    expect(screen.queryByTestId('persona-journey-wizard')).not.toBeInTheDocument();
    expect(intro).toHaveAttribute('data-persona-resolved', 'false');
    expect(introPersonaResolvedCalls.every((v) => v === false)).toBe(true);
  });

  it('renders the classic IntroPhase (no wizard, personaResolvedUpstream=false) when the payload is malformed', async () => {
    mockPublicConfigFailure('malformed');
    renderModal();

    const intro = await screen.findByTestId('intro-phase');
    expect(screen.queryByTestId('persona-journey-wizard')).not.toBeInTheDocument();
    expect(intro).toHaveAttribute('data-persona-resolved', 'false');
    expect(introPersonaResolvedCalls.every((v) => v === false)).toBe(true);
  });
});
