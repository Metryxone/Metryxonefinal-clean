import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import PauseOverlay from './PauseOverlay';

vi.mock('../lib/pauseStats', () => ({
  recordPauseEvent: vi.fn(),
  getPauseStats: vi.fn(() => ({ totalSessions: 1, completedSessions: 0, totalSeconds: 0 })),
  buildPauseEncouragement: vi.fn(() => 'Great job!'),
}));

function renderOverlay() {
  const onEnd = vi.fn();
  const utils = render(<PauseOverlay prefix="mx" onEnd={onEnd} />);
  return { onEnd, ...utils };
}

function touchEnd(element: HTMLElement) {
  fireEvent.touchEnd(element, { touches: [], changedTouches: [] });
}

describe('PauseOverlay — touch two-step pattern selection', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('first tap on a chip shows "Tap again to use" for that chip', () => {
    renderOverlay();

    const boxChip = screen.getByTestId('pause-pattern-box');
    touchEnd(boxChip);

    expect(screen.getByTestId('pause-pattern-tap-again-box')).toBeInTheDocument();
    expect(screen.getByTestId('pause-pattern-tap-again-box')).toHaveTextContent('Tap again to use');
  });

  it('second tap on the same chip selects the pattern and removes the affordance', () => {
    renderOverlay();

    const boxChip = screen.getByTestId('pause-pattern-box');

    touchEnd(boxChip);
    expect(screen.getByTestId('pause-pattern-tap-again-box')).toBeInTheDocument();

    touchEnd(boxChip);

    expect(screen.queryByTestId('pause-pattern-tap-again-box')).not.toBeInTheDocument();
    expect(boxChip).toHaveAttribute('aria-checked', 'true');
  });

  it('tapping the backdrop cancels a pending pattern preview without selecting a new pattern', () => {
    renderOverlay();

    const boxChip = screen.getByTestId('pause-pattern-box');
    const calmingChip = screen.getByTestId('pause-pattern-calming');

    touchEnd(boxChip);
    expect(screen.getByTestId('pause-pattern-tap-again-box')).toBeInTheDocument();

    const backdrop = screen.getByTestId('pause-overlay-backdrop');
    fireEvent.touchEnd(backdrop);

    expect(screen.queryByTestId('pause-pattern-tap-again-box')).not.toBeInTheDocument();
    expect(calmingChip).toHaveAttribute('aria-checked', 'true');
    expect(boxChip).toHaveAttribute('aria-checked', 'false');
  });

  it('second tap on a chip writes the pattern id to localStorage', () => {
    renderOverlay();

    const boxChip = screen.getByTestId('pause-pattern-box');

    touchEnd(boxChip);
    touchEnd(boxChip);

    expect(localStorage.getItem('mx-pause-pattern')).toBe('box');
  });

  it('tapping a different chip switches preview to the new chip without selecting either', () => {
    renderOverlay();

    const boxChip = screen.getByTestId('pause-pattern-box');
    const coherenceChip = screen.getByTestId('pause-pattern-coherence');
    const calmingChip = screen.getByTestId('pause-pattern-calming');

    touchEnd(boxChip);
    expect(screen.getByTestId('pause-pattern-tap-again-box')).toBeInTheDocument();

    touchEnd(coherenceChip);

    expect(screen.queryByTestId('pause-pattern-tap-again-box')).not.toBeInTheDocument();
    expect(screen.getByTestId('pause-pattern-tap-again-coherence')).toBeInTheDocument();
    expect(screen.getByTestId('pause-pattern-tap-again-coherence')).toHaveTextContent('Tap again to use');

    expect(calmingChip).toHaveAttribute('aria-checked', 'true');
    expect(boxChip).toHaveAttribute('aria-checked', 'false');
    expect(coherenceChip).toHaveAttribute('aria-checked', 'false');
  });
});

describe('PauseOverlay — mouse hover desktop pattern preview', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('mouseLeave on a hovered chip clears the preview orb and restores the active pattern hint', () => {
    renderOverlay();

    const boxChip = screen.getByTestId('pause-pattern-box');
    const calmingChip = screen.getByTestId('pause-pattern-calming');

    expect(calmingChip).toHaveAttribute('aria-checked', 'true');
    expect(boxChip).toHaveAttribute('aria-checked', 'false');

    fireEvent.mouseEnter(boxChip);

    expect(screen.getByTestId('pause-preview-orb')).toBeInTheDocument();

    fireEvent.mouseLeave(boxChip);

    expect(screen.queryByTestId('pause-preview-orb')).not.toBeInTheDocument();

    vi.advanceTimersByTime(120);

    const hint = screen.getByTestId('pause-pattern-hint');
    expect(hint).toHaveTextContent('A long exhale that melts tension away');

    expect(calmingChip).toHaveAttribute('aria-checked', 'true');
    expect(boxChip).toHaveAttribute('aria-checked', 'false');
  });
});

describe('PauseOverlay — cross-prefix state isolation', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('muting one prefix does not affect another prefix', () => {
    const onEndMx = vi.fn();
    const onEndAlt = vi.fn();

    const { unmount: unmountMx } = render(<PauseOverlay prefix="mx" onEnd={onEndMx} />);

    const muteBtn = screen.getByTestId('btn-pause-mute');
    fireEvent.click(muteBtn);

    expect(localStorage.getItem('mx-pause-muted')).toBe('1');
    expect(localStorage.getItem('alt-pause-muted')).toBeNull();

    unmountMx();

    render(<PauseOverlay prefix="alt" onEnd={onEndAlt} />);

    const altMuteBtn = screen.getByTestId('btn-pause-mute');
    expect(altMuteBtn).toHaveAttribute('aria-pressed', 'false');
    expect(localStorage.getItem('alt-pause-muted')).toBeNull();
  });

  it('selecting a pattern in one prefix does not affect another prefix', () => {
    const onEndMx = vi.fn();
    const onEndCm = vi.fn();

    const { unmount: unmountMx } = render(<PauseOverlay prefix="mx" onEnd={onEndMx} />);

    const boxChipMx = screen.getByTestId('pause-pattern-box');
    touchEnd(boxChipMx);
    touchEnd(boxChipMx);

    expect(localStorage.getItem('mx-pause-pattern')).toBe('box');
    expect(localStorage.getItem('cm-pause-pattern')).toBeNull();

    unmountMx();

    render(<PauseOverlay prefix="cm" onEnd={onEndCm} />);

    const calmingChipCm = screen.getByTestId('pause-pattern-calming');
    expect(calmingChipCm).toHaveAttribute('aria-checked', 'true');

    const boxChipCm = screen.getByTestId('pause-pattern-box');
    expect(boxChipCm).toHaveAttribute('aria-checked', 'false');

    expect(localStorage.getItem('cm-pause-pattern')).toBeNull();
  });
});

describe('PauseOverlay — keyboard focus/blur pattern preview', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('focus on a non-selected chip shows the preview orb', () => {
    renderOverlay();

    const boxChip = screen.getByTestId('pause-pattern-box');

    expect(boxChip).toHaveAttribute('aria-checked', 'false');

    fireEvent.focus(boxChip);

    expect(screen.getByTestId('pause-preview-orb')).toBeInTheDocument();
  });

  it('blur on a focused chip clears the preview orb and restores the active pattern hint', () => {
    renderOverlay();

    const boxChip = screen.getByTestId('pause-pattern-box');
    const calmingChip = screen.getByTestId('pause-pattern-calming');

    expect(calmingChip).toHaveAttribute('aria-checked', 'true');
    expect(boxChip).toHaveAttribute('aria-checked', 'false');

    fireEvent.focus(boxChip);

    expect(screen.getByTestId('pause-preview-orb')).toBeInTheDocument();

    fireEvent.blur(boxChip);

    expect(screen.queryByTestId('pause-preview-orb')).not.toBeInTheDocument();

    vi.advanceTimersByTime(120);

    const hint = screen.getByTestId('pause-pattern-hint');
    expect(hint).toHaveTextContent('A long exhale that melts tension away');

    expect(calmingChip).toHaveAttribute('aria-checked', 'true');
    expect(boxChip).toHaveAttribute('aria-checked', 'false');
  });

  it('pressing Enter on a focused non-selected chip selects it and updates localStorage', () => {
    renderOverlay();

    const boxChip = screen.getByTestId('pause-pattern-box');
    expect(boxChip).toHaveAttribute('aria-checked', 'false');

    boxChip.focus();
    fireEvent.keyDown(boxChip, { key: 'Enter', code: 'Enter' });

    expect(boxChip).toHaveAttribute('aria-checked', 'true');
    expect(localStorage.getItem('mx-pause-pattern')).toBe('box');
  });

  it('pressing Space on a focused non-selected chip selects it and updates localStorage', () => {
    renderOverlay();

    const boxChip = screen.getByTestId('pause-pattern-box');
    expect(boxChip).toHaveAttribute('aria-checked', 'false');

    boxChip.focus();
    fireEvent.keyDown(boxChip, { key: ' ', code: 'Space' });

    expect(boxChip).toHaveAttribute('aria-checked', 'true');
    expect(localStorage.getItem('mx-pause-pattern')).toBe('box');
  });
});
