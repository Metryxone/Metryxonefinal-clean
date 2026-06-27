import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { GlobalErrorBoundary } from './GlobalErrorBoundary';

function Boom(): React.ReactElement {
  throw new Error('kaboom from render');
}

describe('GlobalErrorBoundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // React logs caught render errors to console.error; silence it so the
    // deliberate throw doesn't pollute test output.
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    cleanup();
  });

  it('renders children unchanged when no error is thrown', () => {
    render(
      <GlobalErrorBoundary>
        <div>healthy app content</div>
      </GlobalErrorBoundary>,
    );

    expect(screen.getByText('healthy app content')).toBeTruthy();
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });

  it('shows the crash fallback (not a blank page) when a child throws during render', () => {
    const { container } = render(
      <GlobalErrorBoundary>
        <Boom />
      </GlobalErrorBoundary>,
    );

    // The friendly fallback heading appears...
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    // ...with a working Reload affordance...
    const reloadButton = screen.getByRole('button', { name: 'Reload' });
    expect(reloadButton).toBeTruthy();
    // ...and the DOM is NOT empty (the whole point: no white-screen).
    expect(container.textContent).toContain('Something went wrong');
    expect(container.querySelector('button')).not.toBeNull();
  });

  it('Reload button triggers window.location.reload', () => {
    const reloadSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadSpy },
    });

    try {
      render(
        <GlobalErrorBoundary>
          <Boom />
        </GlobalErrorBoundary>,
      );

      const reloadButton = screen.getByRole('button', { name: 'Reload' });
      reloadButton.click();
      expect(reloadSpy).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      });
    }
  });
});
