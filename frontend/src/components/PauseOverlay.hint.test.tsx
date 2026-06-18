import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within, act, cleanup } from '@testing-library/react';
import React from 'react';
import PauseOverlay from './PauseOverlay';

vi.mock('../lib/pauseStats', () => ({
  recordPauseEvent: vi.fn(),
  getPauseStats: vi.fn(() => ({ totalSessions: 1, completedSessions: 0, lastSessionDate: null })),
  buildPauseEncouragement: vi.fn(() => 'Well done!'),
}));

const PATTERNS = [
  {
    id: 'calming' as const,
    label: 'Calming',
    hintFragment: 'A long exhale',
  },
  {
    id: 'box' as const,
    label: 'Box',
    hintFragment: 'Every step is the same length',
  },
  {
    id: 'coherence' as const,
    label: 'Coherence',
    hintFragment: 'A slow, steady rhythm',
  },
];

const setupMatchMedia = () => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      // Report prefers-reduced-motion: true to skip the 120 ms cross-fade
      // setTimeout and make hint updates synchronous.
      matches: query.includes('prefers-reduced-motion'),
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

describe('PauseOverlay — pattern remembered from localStorage on next visit', () => {
  beforeEach(() => {
    localStorage.clear();
    setupMatchMedia();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  for (const pattern of PATTERNS) {
    it(`restores "${pattern.label}" chip as selected and shows its hint when localStorage has that pattern`, () => {
      localStorage.setItem('mx-pause-pattern', pattern.id);

      const onEnd = vi.fn();
      render(<PauseOverlay prefix="mx" onEnd={onEnd} />);

      // The stored pattern's chip must be marked selected.
      const chip = screen.getByTestId(`pause-pattern-${pattern.id}`);
      expect(chip).toHaveAttribute('aria-checked', 'true');

      // All other chips must not be selected.
      for (const other of PATTERNS) {
        if (other.id === pattern.id) continue;
        const otherChip = screen.getByTestId(`pause-pattern-${other.id}`);
        expect(otherChip).toHaveAttribute('aria-checked', 'false');
      }

      // The hint box must show the stored pattern's label and hint text.
      const hintBox = screen.getByTestId('pause-pattern-hint');
      expect(hintBox).toBeVisible();
      expect(within(hintBox).getByText(new RegExp(pattern.label, 'i'))).toBeVisible();
      expect(within(hintBox).getByText(new RegExp(pattern.hintFragment, 'i'))).toBeVisible();
    });
  }
});

describe('PauseOverlay — pattern selection writes to localStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    setupMatchMedia();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  for (const pattern of PATTERNS) {
    it(`clicking the "${pattern.label}" chip writes "${pattern.id}" to localStorage`, () => {
      const onEnd = vi.fn();
      render(<PauseOverlay prefix="mx" onEnd={onEnd} />);

      const chip = screen.getByTestId(`pause-pattern-${pattern.id}`);
      act(() => { chip.click(); });

      expect(localStorage.getItem('mx-pause-pattern')).toBe(pattern.id);
    });
  }

  it('uses the prefix-scoped key so overlays with different prefixes do not share storage', () => {
    const onEnd = vi.fn();
    render(<PauseOverlay prefix="cm" onEnd={onEnd} />);

    const chip = screen.getByTestId('pause-pattern-box');
    act(() => { chip.click(); });

    expect(localStorage.getItem('cm-pause-pattern')).toBe('box');
    expect(localStorage.getItem('mx-pause-pattern')).toBeNull();
  });
});

describe('PauseOverlay — mute button saves setting to localStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    setupMatchMedia();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('clicking the mute button writes "1" to localStorage when toggling mute on', () => {
    const onEnd = vi.fn();
    render(<PauseOverlay prefix="mx" onEnd={onEnd} />);

    const muteBtn = screen.getByTestId('btn-pause-mute');
    act(() => { muteBtn.click(); });

    expect(localStorage.getItem('mx-pause-muted')).toBe('1');
  });

  it('clicking the mute button a second time writes "0" back to localStorage', () => {
    const onEnd = vi.fn();
    render(<PauseOverlay prefix="mx" onEnd={onEnd} />);

    const muteBtn = screen.getByTestId('btn-pause-mute');
    act(() => { muteBtn.click(); }); // mute on → '1'
    act(() => { muteBtn.click(); }); // mute off → '0'

    expect(localStorage.getItem('mx-pause-muted')).toBe('0');
  });

  it('uses the prefix-scoped key so overlays with different prefixes do not share mute storage', () => {
    const onEnd = vi.fn();
    render(<PauseOverlay prefix="cm" onEnd={onEnd} />);

    const muteBtn = screen.getByTestId('btn-pause-mute');
    act(() => { muteBtn.click(); });

    expect(localStorage.getItem('cm-pause-muted')).toBe('1');
    expect(localStorage.getItem('mx-pause-muted')).toBeNull();
  });
});

describe('PauseOverlay — mute preference is remembered when overlay is reopened', () => {
  beforeEach(() => {
    localStorage.clear();
    setupMatchMedia();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('opens already muted when localStorage has mx-pause-muted = "1"', () => {
    localStorage.setItem('mx-pause-muted', '1');

    render(<PauseOverlay prefix="mx" onEnd={vi.fn()} />);

    const muteBtn = screen.getByTestId('btn-pause-mute');
    expect(muteBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('opens unmuted when localStorage has mx-pause-muted = "0"', () => {
    localStorage.setItem('mx-pause-muted', '0');

    render(<PauseOverlay prefix="mx" onEnd={vi.fn()} />);

    const muteBtn = screen.getByTestId('btn-pause-mute');
    expect(muteBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('opens unmuted when mx-pause-muted is absent from localStorage', () => {
    render(<PauseOverlay prefix="mx" onEnd={vi.fn()} />);

    const muteBtn = screen.getByTestId('btn-pause-mute');
    expect(muteBtn).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('PauseOverlay — mx and cm overlay types cannot overwrite each other\'s saved settings', () => {
  beforeEach(() => {
    localStorage.clear();
    setupMatchMedia();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
    cleanup();
  });

  it('each prefix reads its own pattern key independently', () => {
    localStorage.setItem('mx-pause-pattern', 'box');
    localStorage.setItem('cm-pause-pattern', 'coherence');

    // Mount mx overlay — should show 'box' selected.
    const { unmount: unmountMx } = render(<PauseOverlay prefix="mx" onEnd={vi.fn()} />);
    expect(screen.getByTestId('pause-pattern-box')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('pause-pattern-coherence')).toHaveAttribute('aria-checked', 'false');
    unmountMx();

    // Mount cm overlay — should show 'coherence' selected.
    render(<PauseOverlay prefix="cm" onEnd={vi.fn()} />);
    expect(screen.getByTestId('pause-pattern-coherence')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('pause-pattern-box')).toHaveAttribute('aria-checked', 'false');
  });

  it('clicking a chip in the cm overlay does not change mx-pause-pattern', () => {
    localStorage.setItem('mx-pause-pattern', 'box');

    render(<PauseOverlay prefix="cm" onEnd={vi.fn()} />);

    // Click 'calming' in the cm overlay.
    act(() => { screen.getByTestId('pause-pattern-calming').click(); });

    // cm key updated, mx key must be unchanged.
    expect(localStorage.getItem('cm-pause-pattern')).toBe('calming');
    expect(localStorage.getItem('mx-pause-pattern')).toBe('box');
  });

  it('each prefix reads its own mute key independently', () => {
    localStorage.setItem('mx-pause-muted', '1');
    localStorage.setItem('cm-pause-muted', '0');

    // Mount mx overlay — mute button should reflect muted state (aria-pressed="true").
    const { unmount: unmountMx } = render(<PauseOverlay prefix="mx" onEnd={vi.fn()} />);
    expect(screen.getByTestId('btn-pause-mute')).toHaveAttribute('aria-pressed', 'true');
    unmountMx();

    // Mount cm overlay — mute button should reflect unmuted state (aria-pressed="false").
    render(<PauseOverlay prefix="cm" onEnd={vi.fn()} />);
    expect(screen.getByTestId('btn-pause-mute')).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggling mute in the cm overlay does not change mx-pause-muted', () => {
    localStorage.setItem('mx-pause-muted', '1');

    render(<PauseOverlay prefix="cm" onEnd={vi.fn()} />);

    // Toggle mute on in the cm overlay.
    act(() => { screen.getByTestId('btn-pause-mute').click(); });

    // cm key updated, mx key must be unchanged.
    expect(localStorage.getItem('cm-pause-muted')).toBe('1');
    expect(localStorage.getItem('mx-pause-muted')).toBe('1');
  });
});

describe('PauseOverlay — two overlays mounted simultaneously stay visually independent', () => {
  beforeEach(() => {
    localStorage.clear();
    setupMatchMedia();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
    cleanup();
  });

  it('each overlay shows only its own selected chip and hint when both are mounted at the same time', () => {
    localStorage.setItem('mx-pause-pattern', 'box');
    localStorage.setItem('cm-pause-pattern', 'coherence');

    render(
      <>
        <PauseOverlay prefix="mx" onEnd={vi.fn()} />
        <PauseOverlay prefix="cm" onEnd={vi.fn()} />
      </>
    );

    const mxOverlay = screen.getByTestId('mx-pause-orb').closest('[data-testid="pause-overlay"]') as HTMLElement;
    const cmOverlay = screen.getByTestId('cm-pause-orb').closest('[data-testid="pause-overlay"]') as HTMLElement;

    expect(within(mxOverlay).getByTestId('pause-pattern-box')).toHaveAttribute('aria-checked', 'true');
    expect(within(mxOverlay).getByTestId('pause-pattern-coherence')).toHaveAttribute('aria-checked', 'false');
    const mxHint = within(mxOverlay).getByTestId('pause-pattern-hint');
    expect(within(mxHint).getByText(/Box/i)).toBeVisible();
    expect(within(mxHint).getByText(/Every step is the same length/i)).toBeVisible();

    expect(within(cmOverlay).getByTestId('pause-pattern-coherence')).toHaveAttribute('aria-checked', 'true');
    expect(within(cmOverlay).getByTestId('pause-pattern-box')).toHaveAttribute('aria-checked', 'false');
    const cmHint = within(cmOverlay).getByTestId('pause-pattern-hint');
    expect(within(cmHint).getByText(/Coherence/i)).toBeVisible();
    expect(within(cmHint).getByText(/A slow, steady rhythm/i)).toBeVisible();
  });

  it('clicking a chip in the mx overlay does not change the selected chip or hint in the cm overlay', () => {
    render(
      <>
        <PauseOverlay prefix="mx" onEnd={vi.fn()} />
        <PauseOverlay prefix="cm" onEnd={vi.fn()} />
      </>
    );

    const mxOverlay = screen.getByTestId('mx-pause-orb').closest('[data-testid="pause-overlay"]') as HTMLElement;
    const cmOverlay = screen.getByTestId('cm-pause-orb').closest('[data-testid="pause-overlay"]') as HTMLElement;

    act(() => { within(mxOverlay).getByTestId('pause-pattern-box').click(); });

    expect(within(mxOverlay).getByTestId('pause-pattern-box')).toHaveAttribute('aria-checked', 'true');
    expect(within(mxOverlay).getByTestId('pause-pattern-calming')).toHaveAttribute('aria-checked', 'false');
    const mxHint = within(mxOverlay).getByTestId('pause-pattern-hint');
    expect(within(mxHint).getByText(/Box/i)).toBeVisible();

    expect(within(cmOverlay).getByTestId('pause-pattern-calming')).toHaveAttribute('aria-checked', 'true');
    expect(within(cmOverlay).getByTestId('pause-pattern-box')).toHaveAttribute('aria-checked', 'false');
    const cmHint = within(cmOverlay).getByTestId('pause-pattern-hint');
    expect(within(cmHint).getByText(/Calming/i)).toBeVisible();
    expect(within(cmHint).getByText(/A long exhale/i)).toBeVisible();
  });

  it('clicking a chip in the cm overlay does not change the selected chip or hint in the mx overlay', () => {
    render(
      <>
        <PauseOverlay prefix="mx" onEnd={vi.fn()} />
        <PauseOverlay prefix="cm" onEnd={vi.fn()} />
      </>
    );

    const mxOverlay = screen.getByTestId('mx-pause-orb').closest('[data-testid="pause-overlay"]') as HTMLElement;
    const cmOverlay = screen.getByTestId('cm-pause-orb').closest('[data-testid="pause-overlay"]') as HTMLElement;

    act(() => { within(cmOverlay).getByTestId('pause-pattern-coherence').click(); });

    expect(within(cmOverlay).getByTestId('pause-pattern-coherence')).toHaveAttribute('aria-checked', 'true');
    expect(within(cmOverlay).getByTestId('pause-pattern-calming')).toHaveAttribute('aria-checked', 'false');
    const cmHint = within(cmOverlay).getByTestId('pause-pattern-hint');
    expect(within(cmHint).getByText(/Coherence/i)).toBeVisible();
    expect(within(cmHint).getByText(/A slow, steady rhythm/i)).toBeVisible();

    expect(within(mxOverlay).getByTestId('pause-pattern-calming')).toHaveAttribute('aria-checked', 'true');
    expect(within(mxOverlay).getByTestId('pause-pattern-coherence')).toHaveAttribute('aria-checked', 'false');
    const mxHint = within(mxOverlay).getByTestId('pause-pattern-hint');
    expect(within(mxHint).getByText(/Calming/i)).toBeVisible();
    expect(within(mxHint).getByText(/A long exhale/i)).toBeVisible();
  });
});

describe('PauseOverlay — breathing hint visibility after pattern selection', () => {
  beforeEach(() => {
    localStorage.clear();
    setupMatchMedia();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  for (const pattern of PATTERNS) {
    it(`hint box stays visible with correct text after selecting "${pattern.label}"`, () => {
      const onEnd = vi.fn();
      render(<PauseOverlay prefix="mx" onEnd={onEnd} />);

      const chip = screen.getByTestId(`pause-pattern-${pattern.id}`);
      act(() => { chip.click(); });

      const hintBox = screen.getByTestId('pause-pattern-hint');

      // Hint must be visible (not merely present).
      expect(hintBox).toBeVisible();

      // Hint must contain the selected pattern label and the expected hint text.
      expect(within(hintBox).getByText(new RegExp(pattern.label, 'i'))).toBeVisible();
      expect(within(hintBox).getByText(new RegExp(pattern.hintFragment, 'i'))).toBeVisible();

      // There must be no dismiss button inside the hint box.
      const dismissBtn = hintBox.querySelector('[data-testid="pause-pattern-hint-dismiss"]');
      expect(dismissBtn).toBeNull();
    });
  }

  it('hint box is present and visible before any selection and has no dismiss button', () => {
    const onEnd = vi.fn();
    render(<PauseOverlay prefix="mx" onEnd={onEnd} />);

    const hintBox = screen.getByTestId('pause-pattern-hint');
    expect(hintBox).toBeVisible();

    const dismissBtn = hintBox.querySelector('[data-testid="pause-pattern-hint-dismiss"]');
    expect(dismissBtn).toBeNull();
  });

  it('hint stays visible when switching Calming → Box → Coherence in the same session', () => {
    const onEnd = vi.fn();
    render(<PauseOverlay prefix="mx" onEnd={onEnd} />);

    for (const pattern of PATTERNS) {
      const chip = screen.getByTestId(`pause-pattern-${pattern.id}`);
      act(() => { chip.click(); });

      const hintBox = screen.getByTestId('pause-pattern-hint');
      expect(hintBox).toBeVisible();
      expect(within(hintBox).getByText(new RegExp(pattern.label, 'i'))).toBeVisible();
      expect(within(hintBox).getByText(new RegExp(pattern.hintFragment, 'i'))).toBeVisible();

      const dismissBtn = hintBox.querySelector('[data-testid="pause-pattern-hint-dismiss"]');
      expect(dismissBtn).toBeNull();
    }
  });
});
