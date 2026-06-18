import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import React from 'react';
import PauseOverlay from './PauseOverlay';

vi.mock('../lib/pauseStats', () => ({
  recordPauseEvent: vi.fn(),
  getPauseStats: vi.fn(() => ({ totalSessions: 1, completedSessions: 0, lastSessionDate: null })),
  buildPauseEncouragement: vi.fn(() => 'Well done!'),
}));

// prefers-reduced-motion must be FALSE so the preview animation loop actually runs.
// If it were true the component shows the pattern label instead of the phase name
// and skips requestAnimationFrame entirely.
const setupMatchMedia = () => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

describe('PauseOverlay — preview cycles at accelerated speed', () => {
  let rafCallbacks: FrameRequestCallback[];

  beforeEach(() => {
    localStorage.clear();
    setupMatchMedia();
    vi.useFakeTimers();

    rafCallbacks = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('phase label changes within 2 real seconds, proving the 3× speed-up', () => {
    const onEnd = vi.fn();
    render(<PauseOverlay prefix="mx" onEnd={onEnd} />);

    // Hover over the Coherence chip (5 s Inhale + 5 s Exhale = 10 s cycle).
    // At 3× speed, 2 real seconds → 6 virtual seconds, which lands in the
    // Exhale phase (starts at 5 s). Without the speed-up the 5 s Inhale
    // would still be running, so a label change proves faster-than-real cycling.
    const chip = screen.getByTestId('pause-pattern-coherence');

    act(() => {
      fireEvent.mouseEnter(chip);
    });

    // previewElapsed starts at 0 → first phase is Inhale for every pattern.
    const labelEl = () => screen.getByTestId('pause-preview-phase-label');
    expect(labelEl().textContent).toBe('Inhale');

    // Advance the fake clock by 2 real seconds.
    // Inside the animation loop: e = (2000 ms / 1000) * 3 = 6 virtual seconds.
    vi.setSystemTime(Date.now() + 2000);

    // Fire the most-recently registered RAF callback so the loop reads the new time.
    act(() => {
      const cb = rafCallbacks[rafCallbacks.length - 1];
      cb(Date.now());
    });

    // The Coherence cycle is 5 s Inhale + 5 s Exhale.  At 6 virtual seconds
    // we are past the Inhale boundary, so the label must now read "Exhale".
    expect(labelEl().textContent).not.toBe('Inhale');
    expect(labelEl().textContent).toBe('Exhale');
  });
});
