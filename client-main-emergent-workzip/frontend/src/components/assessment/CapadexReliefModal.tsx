/**
 * CapadexReliefModal — soft-landing overlay for Module 2 safety-circuit-breaker trips.
 *
 * Renders when the CAPADEX backend returns `safety_intercept: true` on
 * `/respond` (Channel A text-based crisis-language match OR Channel B
 * telemetry-derived crisis_risk / emotional_breakdown_risk ≥ 0.80). Replaces
 * the prior rose/amber alert with a grounding sage / muted-teal palette and
 * a two-track action profile so the user is never cold-redirected:
 *
 *   · Primary action   — direct counsellor routing (high-priority emerald CTA)
 *   · Secondary action — inline breathing exercise (no navigation away)
 *   · Tertiary actions — helpline phone link + "close for now"
 *
 * The breathing exercise unfolds in-place rather than opening a new surface;
 * the box-breathing animation runs entirely client-side (CSS keyframes, no
 * audio). Every microcopy line is non-clinical, non-diagnostic, and framed
 * as care rather than alarm. Default-initialised props match the
 * factory-default empty-state pattern used elsewhere (missing message ⇒
 * grounded fallback copy, never blank).
 */

import { useState } from 'react';

export interface CapadexReliefModalProps {
  message?: string;
  onClose: () => void;
}

// Sage / muted-teal grounding palette (relief-first design standard)
const SAGE_50   = '#F0FAF4';
const SAGE_100  = '#DCF0E3';
const SAGE_200  = '#BBE0C9';
const SAGE_700  = '#256B45';
const SAGE_900  = '#0F3B25';
const TEAL_50   = '#EFF7F7';
const TEAL_200  = '#B8DDDD';
const TEAL_700  = '#1B6F70';
const EMERALD   = '#059669';
const EMERALD_H = '#047857';
const SLATE_500 = '#64748B';

const FALLBACK_MSG =
  "Let's pause together. Your well-being matters more than completing this assessment. " +
  "Take a moment — support is one tap away.";

export function CapadexReliefModal({ message, onClose }: CapadexReliefModalProps) {
  const [breathing, setBreathing] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="capadex-relief-title"
      aria-describedby="capadex-relief-body"
      data-testid="capadex-relief"
      style={{
        background: 'rgba(15, 59, 37, 0.35)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        animation: 'capadexReliefFadeIn 0.35s ease-out',
      }}
    >
      {/* Inline keyframes — scoped to this component, no global stylesheet churn */}
      <style>{`
        @keyframes capadexReliefFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes capadexReliefRise   { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes capadexBoxBreath {
          0%, 100% { transform: scale(1);    background-color: ${SAGE_100}; }
          25%      { transform: scale(1.15); background-color: ${TEAL_200}; }
          50%      { transform: scale(1.15); background-color: ${TEAL_200}; }
          75%      { transform: scale(1);    background-color: ${SAGE_100}; }
        }
      `}</style>

      <div
        className="w-full max-w-md rounded-3xl shadow-2xl"
        style={{
          background: `linear-gradient(160deg, ${SAGE_50} 0%, ${TEAL_50} 100%)`,
          border: `1px solid ${SAGE_200}`,
          animation: 'capadexReliefRise 0.4s ease-out 0.05s both',
        }}
      >
        <div className="p-7 sm:p-8">
          <div className="flex items-start gap-4 mb-5">
            <div
              className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-2xl"
              aria-hidden="true"
              style={{ background: SAGE_100, border: `1.5px solid ${SAGE_200}`, color: SAGE_700 }}
            >
              ❋
            </div>
            <div className="flex-1 pt-0.5">
              <h2
                id="capadex-relief-title"
                className="text-[19px] font-semibold leading-snug mb-1"
                style={{ color: SAGE_900 }}
              >
                Let's take a breath together
              </h2>
              <p className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: TEAL_700 }}>
                A moment of care — not a diagnosis
              </p>
            </div>
          </div>

          <p
            id="capadex-relief-body"
            className="text-[14px] leading-relaxed mb-6"
            style={{ color: SAGE_900, opacity: 0.85 }}
          >
            {message ?? FALLBACK_MSG}
          </p>

          {/* ── Primary: counsellor routing ── */}
          <a
            href="https://wa.me/919999999999"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center px-6 py-4 rounded-2xl font-semibold text-white shadow-sm"
            data-testid="capadex-relief-counsellor-cta"
            style={{
              background: EMERALD,
              fontSize: 14.5,
              transition: 'background-color 0.25s ease-in-out, transform 0.25s ease-in-out',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = EMERALD_H; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = EMERALD; }}
          >
            Talk to a counsellor now
          </a>

          {/* ── Secondary: in-place breathing exercise ── */}
          <button
            type="button"
            onClick={() => setBreathing((b) => !b)}
            className="block w-full text-center px-6 py-4 rounded-2xl font-medium mt-3"
            data-testid="capadex-relief-breathe-cta"
            aria-expanded={breathing}
            aria-controls="capadex-relief-breath-panel"
            style={{
              background: '#FFFFFF',
              color: TEAL_700,
              border: `1.5px solid ${TEAL_200}`,
              fontSize: 13.5,
              transition: 'background-color 0.25s ease-in-out, border-color 0.25s ease-in-out',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = TEAL_50; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#FFFFFF'; }}
          >
            {breathing ? '✓ Following along — tap to hide' : 'Try a 30-second breathing exercise'}
          </button>

          {/* ── Inline breathing panel — unfolds without navigation ── */}
          {breathing && (
            <div
              id="capadex-relief-breath-panel"
              className="mt-4 p-5 rounded-2xl text-center"
              style={{
                background: '#FFFFFF',
                border: `1px solid ${TEAL_200}`,
                animation: 'capadexReliefRise 0.35s ease-out both',
              }}
            >
              <div className="flex justify-center mb-3">
                <div
                  className="rounded-full"
                  style={{
                    width: 64, height: 64,
                    background: SAGE_100,
                    animation: 'capadexBoxBreath 8s ease-in-out infinite',
                  }}
                  aria-hidden="true"
                />
              </div>
              <p className="text-[12.5px] font-semibold mb-1" style={{ color: TEAL_700 }}>
                Box breathing · 4 in · 4 hold · 4 out · 4 hold
              </p>
              <p className="text-[11px] leading-relaxed" style={{ color: SLATE_500 }}>
                Follow the circle as it expands and contracts. There is nothing to do but breathe.
              </p>
            </div>
          )}

          {/* ── Tertiary: helpline + close ── */}
          <div className="mt-5 pt-4 flex items-center justify-between gap-3" style={{ borderTop: `1px solid ${SAGE_100}` }}>
            <a
              href="tel:9152987821"
              className="text-[12px] font-medium"
              data-testid="capadex-relief-helpline-cta"
              style={{ color: TEAL_700, transition: 'color 0.25s ease-in-out' }}
            >
              iCall helpline · 9152987821
            </a>
            <button
              type="button"
              onClick={onClose}
              className="text-[12px] font-medium px-3 py-1.5 rounded-lg"
              data-testid="capadex-relief-close"
              style={{
                color: SLATE_500,
                background: 'transparent',
                transition: 'background-color 0.25s ease-in-out, color 0.25s ease-in-out',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = SAGE_50; e.currentTarget.style.color = SAGE_700; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = SLATE_500; }}
            >
              Close for now
            </button>
          </div>

          <p className="text-[10.5px] mt-4 leading-relaxed text-center" style={{ color: SLATE_500 }}>
            The assessment will be here whenever you're ready. There is no pressure to return.
          </p>
        </div>
      </div>
    </div>
  );
}

export default CapadexReliefModal;
