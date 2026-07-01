import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// FreeAssessmentModal reads SIX flags from /api/capadex/public-config on open,
// all behind the SAME `.catch(() => {})`:
//
//     counsellor_whatsapp_number → counsellorNumber   (falls back to a default)
//     websocket_runtime          → wsRuntimeEnabled   (OFF)
//     cognitive_load_engine      → cogLoadEnabled      (OFF)
//     persona_model_alignment    → personaAlignment…   (OFF)
//     persona_model_expansion    → personaExpansion…   (OFF)
//     assessment_architecture…   → archCompletion…     (OFF)
//
// The persona-journey-router edge already has negative-path coverage
// (FreeAssessmentModal.personaJourneyRouter.test.tsx). These flags share the
// exact same failure path but had none — a regression that breaks only ONE of
// them when the config fetch fails would ship undetected. This suite proves each
// keeps its safe default across every failure shape (reject / non-ok json throw /
// malformed payload), with a positive control per flag so no assertion is a
// tautology.
// ─────────────────────────────────────────────────────────────────────────────

// ── Observability capture buffers (populated by the child/hook stubs below) ──
const introAlignmentCalls: unknown[] = [];
const introExpansionCalls: unknown[] = [];
const runtimeSyncEnabledCalls: boolean[] = [];
const announceCalls: string[] = [];
let mockRuntimeLatestEvent: unknown = null;

// IntroPhase (the byte-identical legacy path, rendered whenever the persona
// journey router is OFF) receives personaModelAlignment / personaModelExpansion
// via allPhaseProps and setPhase for navigation. We record the flag props and
// expose a button to jump straight to the CAPADEX questions phase (where the
// websocket / cognitive-load gates actually take effect).
vi.mock('./assessment/phases/IntroPhase', () => ({
  IntroPhase: (props: {
    personaModelAlignment?: boolean;
    personaModelExpansion?: boolean;
    setPhase?: (p: string) => void;
  }) => {
    introAlignmentCalls.push(props.personaModelAlignment);
    introExpansionCalls.push(props.personaModelExpansion);
    return (
      <div
        data-testid="intro-phase"
        data-persona-alignment={String(props.personaModelAlignment)}
        data-persona-expansion={String(props.personaModelExpansion)}
      >
        <button data-testid="goto-capadex-q" onClick={() => props.setPhase?.('capadex_q')}>
          go to questions
        </button>
      </div>
    );
  },
}));

// Keep the wizard inert — these tests never turn the router on, but stubbing it
// guards against an accidental heavy render.
vi.mock('./assessment/PersonaJourneyWizard', () => ({
  PersonaJourneyWizard: () => <div data-testid="persona-journey-wizard" />,
}));

// The real questions phase does network + heavy work; a stub is enough since the
// websocket gate lives in the modal's useRuntimeSync call and the pacing cue is
// rendered by the modal itself.
vi.mock('./assessment/phases/CapadexQPhase', () => ({
  CapadexQPhase: () => <div data-testid="capadex-q-phase" />,
}));

// The counsellor number is handed to CapadexReportPhase (reached via the email
// deep-link path). Surface it so we can assert the fallback.
vi.mock('./assessment/phases/CapadexReportPhase', () => ({
  CapadexReportPhase: (props: { counsellorNumber?: string }) => (
    <div data-testid="capadex-report-phase" data-counsellor={props.counsellorNumber} />
  ),
}));

// useRuntimeSync is invoked on every render with
//   (sessionId, wsRuntimeEnabled && phase === 'capadex_q', opts)
// Capturing the second arg lets us prove wsRuntimeEnabled's value at capadex_q.
// The returned latestEvent drives the cognitive-load pacing cue effect.
vi.mock('@/hooks/useRuntimeSync', () => ({
  useRuntimeSync: (_sessionId: string, enabled: boolean) => {
    runtimeSyncEnabledCalls.push(enabled);
    return {
      runtimeEvents: [],
      latestEvent: mockRuntimeLatestEvent,
      connectionState: 'closed',
      clearEvents: () => {},
    };
  },
}));

// announce() is the observable side-effect of the arch-completion flag: the modal
// dynamically imports it and calls it on every phase change ONLY when the flag is
// on. Capture the calls to prove the flag stayed off on failure.
vi.mock('../lib/accessibility', () => ({
  announce: (msg: string) => {
    announceCalls.push(msg);
  },
  prefersReducedMotion: () => false,
  trapFocus: () => () => {},
  initAccessibility: () => {},
}));

import { FreeAssessmentModal } from './FreeAssessmentModal';

// ── fetch installer ─────────────────────────────────────────────────────────
type ConfigMode = 'reject' | 'json' | 'malformed';

function configResponse(config: ConfigMode | Record<string, unknown>) {
  if (config === 'reject') {
    // fetch() itself rejects (network error / offline).
    return Promise.reject(new Error('network down'));
  }
  if (config === 'json') {
    // Response resolves non-ok and .json() throws (malformed body / HTML error page).
    return Promise.resolve({
      ok: false,
      json: () => Promise.reject(new SyntaxError('Unexpected token < in JSON')),
    } as any);
  }
  if (config === 'malformed') {
    // Payload resolves but is not the expected object shape.
    return Promise.resolve({ ok: true, json: () => Promise.resolve(null) } as any);
  }
  // Success: serve the provided config object.
  return Promise.resolve({ ok: true, json: () => Promise.resolve(config) } as any);
}

function setFetch(opts: { config: ConfigMode | Record<string, unknown>; withReport?: boolean }) {
  (globalThis as any).fetch = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : String((input as any)?.url ?? input);
    if (url.includes('/api/capadex/public-config')) {
      return configResponse(opts.config);
    }
    // Deep-link report load (drives the modal to the capadex_report phase where
    // the counsellor number is consumed). Exclude the /omega sibling call.
    if (opts.withReport && url.includes('/api/capadex/report/') && !url.includes('/omega')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ stage_result: {}, report: 'x' }),
      } as any);
    }
    // Everything else (pricing, omega, recs, …) → benign empty non-ok.
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as any);
  });
}

const FAILURE_MODES: ConfigMode[] = ['reject', 'json', 'malformed'];

beforeEach(() => {
  introAlignmentCalls.length = 0;
  introExpansionCalls.length = 0;
  runtimeSyncEnabledCalls.length = 0;
  announceCalls.length = 0;
  mockRuntimeLatestEvent = null;
  localStorage.clear();
});

function renderModal(props: Record<string, unknown> = {}) {
  return render(<FreeAssessmentModal open onOpenChange={vi.fn()} {...props} />);
}

// ── persona_model_alignment / persona_model_expansion ────────────────────────
describe('FreeAssessmentModal — persona alignment/expansion survive a config failure', () => {
  it.each(FAILURE_MODES)(
    'keeps persona alignment + expansion OFF when the config fetch fails (%s)',
    async (mode) => {
      setFetch({ config: mode });
      renderModal();

      const intro = await screen.findByTestId('intro-phase');
      expect(intro).toHaveAttribute('data-persona-alignment', 'false');
      expect(intro).toHaveAttribute('data-persona-expansion', 'false');
      // Every render the modal produced handed IntroPhase the safe default.
      expect(introAlignmentCalls.every((v) => v === false)).toBe(true);
      expect(introExpansionCalls.every((v) => v === false)).toBe(true);
    },
  );

  it('positive control: turns alignment + expansion ON when the config succeeds', async () => {
    setFetch({ config: { persona_model_alignment: true, persona_model_expansion: true } });
    renderModal();

    await waitFor(() =>
      expect(screen.getByTestId('intro-phase')).toHaveAttribute('data-persona-alignment', 'true'),
    );
    expect(screen.getByTestId('intro-phase')).toHaveAttribute('data-persona-expansion', 'true');
  });
});

// ── assessment_architecture_completion ───────────────────────────────────────
describe('FreeAssessmentModal — arch-completion survives a config failure', () => {
  it.each(FAILURE_MODES)(
    'never announces phase changes (flag stays OFF) when the config fetch fails (%s)',
    async (mode) => {
      setFetch({ config: mode });
      renderModal();

      await screen.findByTestId('intro-phase');
      // Let any pending microtasks (the swallowed config promise) settle.
      await Promise.resolve();
      await Promise.resolve();
      expect(announceCalls).toHaveLength(0);
    },
  );

  it('positive control: announces the phase when the config succeeds', async () => {
    setFetch({ config: { assessment_architecture_completion: true } });
    renderModal();

    await screen.findByTestId('intro-phase');
    await waitFor(() => expect(announceCalls.length).toBeGreaterThan(0));
  });
});

// ── websocket_runtime ────────────────────────────────────────────────────────
describe('FreeAssessmentModal — websocket_runtime survives a config failure', () => {
  it.each(FAILURE_MODES)(
    'keeps the runtime sync disabled at the questions phase when the config fetch fails (%s)',
    async (mode) => {
      const user = userEvent.setup();
      setFetch({ config: mode });
      renderModal();

      await screen.findByTestId('intro-phase');
      await user.click(screen.getByTestId('goto-capadex-q'));
      await screen.findByTestId('capadex-q-phase');

      // At capadex_q the enabled arg is `wsRuntimeEnabled && true`. If the flag
      // stayed OFF (safe default) the final call is false.
      expect(runtimeSyncEnabledCalls[runtimeSyncEnabledCalls.length - 1]).toBe(false);
      expect(runtimeSyncEnabledCalls.every((v) => v === false)).toBe(true);
    },
  );

  it('positive control: enables the runtime sync at the questions phase when the config succeeds', async () => {
    const user = userEvent.setup();
    setFetch({ config: { websocket_runtime: true } });
    renderModal();

    await screen.findByTestId('intro-phase');
    // Wait for the config to flip wsRuntimeEnabled before navigating.
    await waitFor(() => expect(runtimeSyncEnabledCalls.length).toBeGreaterThan(0));
    await user.click(screen.getByTestId('goto-capadex-q'));
    await screen.findByTestId('capadex-q-phase');

    await waitFor(() =>
      expect(runtimeSyncEnabledCalls[runtimeSyncEnabledCalls.length - 1]).toBe(true),
    );
  });
});

// ── cognitive_load_engine ────────────────────────────────────────────────────
describe('FreeAssessmentModal — cognitive_load_engine survives a config failure', () => {
  it.each(FAILURE_MODES)(
    'shows no pacing cue even on a cognitive-load alert when the config fetch fails (%s)',
    async (mode) => {
      const user = userEvent.setup();
      // A cognitive-load alert is live, so ONLY the flag gates the pacing cue.
      mockRuntimeLatestEvent = {
        type: 'cognitive_load_alert',
        session_id: 's',
        timestamp: 't',
        data: { recommended_action: 'offer_break' },
        explain: '',
      };
      setFetch({ config: mode });
      renderModal();

      await screen.findByTestId('intro-phase');
      await user.click(screen.getByTestId('goto-capadex-q'));
      await screen.findByTestId('capadex-q-phase');
      await Promise.resolve();

      expect(screen.queryByLabelText('Dismiss pacing cue')).not.toBeInTheDocument();
    },
  );

  it('positive control: shows the pacing cue on a cognitive-load alert when the config succeeds', async () => {
    const user = userEvent.setup();
    // Mirror real ordering: the flag resolves first, THEN the alert arrives over
    // the runtime channel. (The pacing-cue effect keys off the event identity, so
    // an alert already present before the flag flips would never re-fire.)
    mockRuntimeLatestEvent = null;
    setFetch({ config: { cognitive_load_engine: true } });
    renderModal();

    await screen.findByTestId('intro-phase');
    // Flush the public-config promise chain so cogLoadEnabled is true.
    await new Promise((r) => setTimeout(r, 0));

    // Now the alert arrives; navigating re-renders and surfaces it to the effect.
    mockRuntimeLatestEvent = {
      type: 'cognitive_load_alert',
      session_id: 's',
      timestamp: 't',
      data: { recommended_action: 'offer_break' },
      explain: '',
    };
    await user.click(screen.getByTestId('goto-capadex-q'));
    await screen.findByTestId('capadex-q-phase');

    await waitFor(() =>
      expect(screen.getByLabelText('Dismiss pacing cue')).toBeInTheDocument(),
    );
  });
});

// ── counsellor_whatsapp_number ───────────────────────────────────────────────
describe('FreeAssessmentModal — counsellor number survives a config failure', () => {
  it.each(FAILURE_MODES)(
    'falls back to the default counsellor number when the config fetch fails (%s)',
    async (mode) => {
      setFetch({ config: mode, withReport: true });
      renderModal({ initialSessionId: 'sess-123' });

      const report = await screen.findByTestId('capadex-report-phase');
      expect(report).toHaveAttribute('data-counsellor', '919999999999');
    },
  );

  it('positive control: uses the configured counsellor number when the config succeeds', async () => {
    setFetch({ config: { counsellor_whatsapp_number: '918888888888' }, withReport: true });
    renderModal({ initialSessionId: 'sess-123' });

    const report = await screen.findByTestId('capadex-report-phase');
    await waitFor(() => expect(report).toHaveAttribute('data-counsellor', '918888888888'));
  });
});
