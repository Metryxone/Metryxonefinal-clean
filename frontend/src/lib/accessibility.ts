/**
 * Accessibility foundation (CAPADEX 3.0 · Program 3 · Phase 3.1 · AP-3)
 * ===========================================================================
 * Additive WCAG-support utilities. Everything here is INERT until `initAccessibility()`
 * is called (only when the `assessment_architecture_completion` flag is ON) — so the
 * default app is byte-identical. i18next is already mature (src/lib/i18n.ts); this
 * layer adds the interaction/ARIA affordances WCAG needs:
 *   - a skip-to-content link,
 *   - a polite ARIA live region + `announce()` for dynamic assessment state,
 *   - a global `:focus-visible` outline + `.sr-only` helper,
 *   - `prefersReducedMotion()` and a keyboard focus-trap helper for modals.
 *
 * NOTE ON VERIFICATION: full WCAG conformance requires a screen-reader / axe audit
 * in a real browser (the `audited_screens` ADOPTION axis). This module is the
 * engineering foundation; conformance is measured separately, never claimed here.
 */

const STYLE_ID = 'a11y-foundation-styles';
const SKIP_ID = 'a11y-skip-link';
const LIVE_ID = 'a11y-live-region';

let initialised = false;

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .sr-only { position:absolute !important; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
    #${SKIP_ID} { position:absolute; left:-999px; top:0; z-index:10000; background:#0f172a; color:#fff; padding:10px 16px; border-radius:0 0 8px 0; text-decoration:none; font-weight:600; }
    #${SKIP_ID}:focus { left:0; }
    :focus-visible { outline:3px solid #2563eb; outline-offset:2px; border-radius:4px; }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration:0.001ms !important; animation-iteration-count:1 !important; transition-duration:0.001ms !important; scroll-behavior:auto !important; }
    }
  `;
  document.head.appendChild(style);
}

function injectSkipLink(): void {
  if (document.getElementById(SKIP_ID)) return;
  const a = document.createElement('a');
  a.id = SKIP_ID;
  a.href = '#main-content';
  a.textContent = 'Skip to main content';
  document.body.insertBefore(a, document.body.firstChild);
  // Ensure a focusable landmark target exists.
  const root = document.getElementById('root');
  if (root && !document.getElementById('main-content')) {
    root.setAttribute('id', 'root');
    root.setAttribute('role', 'main');
    root.setAttribute('tabindex', '-1');
    const anchor = document.createElement('span');
    anchor.id = 'main-content';
    anchor.tabIndex = -1;
    root.parentElement?.insertBefore(anchor, root);
  }
}

function injectLiveRegion(): void {
  if (document.getElementById(LIVE_ID)) return;
  const div = document.createElement('div');
  div.id = LIVE_ID;
  div.className = 'sr-only';
  div.setAttribute('aria-live', 'polite');
  div.setAttribute('aria-atomic', 'true');
  document.body.appendChild(div);
}

/** Announce a message to assistive technology via the polite live region. */
export function announce(message: string): void {
  const region = document.getElementById(LIVE_ID);
  if (!region) return;
  // Clear then set so repeated identical messages are re-announced.
  region.textContent = '';
  window.setTimeout(() => { region.textContent = message; }, 50);
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/** Trap keyboard focus within `container` (for assessment modals). Returns a cleanup fn. */
export function trapFocus(container: HTMLElement): () => void {
  const selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  function onKey(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;
    const focusable = Array.from(container.querySelectorAll<HTMLElement>(selector)).filter((el) => el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  container.addEventListener('keydown', onKey);
  return () => container.removeEventListener('keydown', onKey);
}

/** Idempotently install the accessibility foundation. Safe to call multiple times. */
export function initAccessibility(): void {
  if (initialised || typeof document === 'undefined') return;
  injectStyles();
  injectSkipLink();
  injectLiveRegion();
  initialised = true;
}
