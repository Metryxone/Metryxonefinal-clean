import { useEffect, useMemo, useRef, useState } from 'react';
import { buildPauseEncouragement, getPauseStats, recordPauseEvent } from '../lib/pauseStats';

const TOTAL_SECONDS = 30;
const CONFIRMATION_MS = 2200;
const PREVIEW_SPEED = 3;

const muteKey = (prefix: string) => `${prefix}-pause-muted`;
const patternKey = (prefix: string) => `${prefix}-pause-pattern`;

type PhaseName = 'Inhale' | 'Hold' | 'Exhale' | 'Hold out';
type Phase = { name: PhaseName; seconds: number };
type PatternId = 'calming' | 'box' | 'coherence';
type Pattern = {
  id: PatternId;
  label: string;
  shortLabel: string;
  description: string;
  hint: string;
  phases: Phase[];
};

const PATTERNS: Pattern[] = [
  {
    id: 'calming',
    label: 'Calming',
    shortLabel: '4-7-8',
    description: 'Follow the orb — 4-7-8 calming breath.',
    hint: 'A long exhale that melts tension away — great when you feel anxious or wound up.',
    phases: [
      { name: 'Inhale', seconds: 4 },
      { name: 'Hold', seconds: 7 },
      { name: 'Exhale', seconds: 8 },
    ],
  },
  {
    id: 'box',
    label: 'Box',
    shortLabel: '4-4-4-4',
    description: 'Follow the orb — 4-4-4-4 box breath.',
    hint: 'Every step is the same length — simple and easy to follow, perfect for beginners.',
    phases: [
      { name: 'Inhale', seconds: 4 },
      { name: 'Hold', seconds: 4 },
      { name: 'Exhale', seconds: 4 },
      { name: 'Hold out', seconds: 4 },
    ],
  },
  {
    id: 'coherence',
    label: 'Coherence',
    shortLabel: '5-5',
    description: 'Follow the orb — 5-5 coherence breath.',
    hint: 'A slow, steady rhythm that helps calm your heart rate and clear your mind.',
    phases: [
      { name: 'Inhale', seconds: 5 },
      { name: 'Exhale', seconds: 5 },
    ],
  },
];

function getPattern(id: string | null | undefined): Pattern {
  return PATTERNS.find(p => p.id === id) ?? PATTERNS[0];
}

function getPhaseAt(elapsed: number, phases: Phase[]) {
  const cycle = phases.reduce((s, p) => s + p.seconds, 0);
  const t = elapsed % cycle;
  let acc = 0;
  for (let i = 0; i < phases.length; i++) {
    const p = phases[i];
    if (t < acc + p.seconds) {
      const within = t - acc;
      return { phase: p, within, progress: within / p.seconds };
    }
    acc += p.seconds;
  }
  const last = phases[phases.length - 1];
  return { phase: last, within: last.seconds, progress: 1 };
}

function playChime(muted: boolean, kind: 'start' | 'end') {
  if (muted) return;
  try {
    const Ctor = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const now = ctx.currentTime;
    const notes = kind === 'start' ? [523.25, 659.25] : [659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = now + i * 0.18;
      const dur = 0.55;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.05);
    });
    setTimeout(() => { ctx.close().catch(() => {}); }, 1500);
  } catch { /* noop */ }
}

interface Props {
  prefix: string;
  onEnd: () => void;
}

export default function PauseOverlay({ prefix, onEnd }: Props) {
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [muted, setMuted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage?.getItem(muteKey(prefix)) === '1';
  });
  const [patternId, setPatternId] = useState<PatternId>(() => {
    if (typeof window === 'undefined') return 'calming';
    return getPattern(window.localStorage?.getItem(patternKey(prefix))).id;
  });
  const pattern = useMemo(() => getPattern(patternId), [patternId]);
  const [elapsed, setElapsed] = useState(0);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const startedAtRef = useRef<number>(Date.now());
  const endedRef = useRef(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hint cross-fade state
  const [hintVisible, setHintVisible] = useState(true);
  const [displayedHintPattern, setDisplayedHintPattern] = useState<Pattern>(() => getPattern(
    typeof window !== 'undefined' ? window.localStorage?.getItem(patternKey(prefix)) : null
  ));
  const hintFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Preview state
  const [previewPatternId, setPreviewPatternId] = useState<PatternId | null>(null);
  const [previewElapsed, setPreviewElapsed] = useState(0);
  const previewRafRef = useRef<number | null>(null);
  const previewStartRef = useRef<number | null>(null);

  // Touch two-step state: first tap previews, second tap selects
  const [touchPendingId, setTouchPendingId] = useState<PatternId | null>(null);

  const previewPattern = useMemo(
    () => (previewPatternId ? getPattern(previewPatternId) : null),
    [previewPatternId]
  );
  const previewCycleLen = useMemo(
    () => (previewPattern ? previewPattern.phases.reduce((s, p) => s + p.seconds, 0) : 0),
    [previewPattern]
  );

  useEffect(() => {
    if (!previewPatternId || prefersReducedMotion) {
      if (previewRafRef.current) cancelAnimationFrame(previewRafRef.current);
      previewStartRef.current = null;
      setPreviewElapsed(0);
      return;
    }

    previewStartRef.current = Date.now();
    setPreviewElapsed(0);

    const animate = () => {
      if (!previewStartRef.current) return;
      const e = ((Date.now() - previewStartRef.current) / 1000) * PREVIEW_SPEED;
      if (e >= previewCycleLen) {
        previewStartRef.current = Date.now();
        setPreviewElapsed(0);
      } else {
        setPreviewElapsed(e);
      }
      previewRafRef.current = requestAnimationFrame(animate);
    };

    previewRafRef.current = requestAnimationFrame(animate);

    return () => {
      if (previewRafRef.current) cancelAnimationFrame(previewRafRef.current);
    };
  }, [previewPatternId, previewCycleLen, prefersReducedMotion]);

  useEffect(() => {
    recordPauseEvent('start');
    playChime(muted, 'start');
    startedAtRef.current = Date.now();
    const tick = setInterval(() => {
      const e = (Date.now() - startedAtRef.current) / 1000;
      if (e >= TOTAL_SECONDS) {
        setElapsed(TOTAL_SECONDS);
        if (!endedRef.current) {
          endedRef.current = true;
          recordPauseEvent('complete');
          const stats = getPauseStats();
          setConfirmation(buildPauseEncouragement(stats));
          playChime(muted, 'end');
          confirmTimerRef.current = setTimeout(onEnd, CONFIRMATION_MS);
        }
        clearInterval(tick);
      } else {
        setElapsed(e);
      }
    }, prefersReducedMotion ? 250 : 50);
    return () => {
      clearInterval(tick);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cross-fade the hint text whenever the active hint pattern changes
  const activeHintPattern = previewPattern ?? pattern;
  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayedHintPattern(activeHintPattern);
      return;
    }
    if (hintFadeTimerRef.current) clearTimeout(hintFadeTimerRef.current);
    setHintVisible(false);
    hintFadeTimerRef.current = setTimeout(() => {
      setDisplayedHintPattern(activeHintPattern);
      setHintVisible(true);
    }, 120);
    return () => { if (hintFadeTimerRef.current) clearTimeout(hintFadeTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHintPattern.id, prefersReducedMotion]);

  const remaining = Math.max(0, Math.ceil(TOTAL_SECONDS - elapsed));
  const { phase, progress: phaseProgress } = getPhaseAt(elapsed, pattern.phases);

  // Orb scale follows breathing phase: Inhale grows, Exhale shrinks, holds stay
  let orbScale = 0.85;
  if (!prefersReducedMotion) {
    if (phase.name === 'Inhale') orbScale = 0.85 + 0.23 * phaseProgress;
    else if (phase.name === 'Hold') orbScale = 1.08;
    else if (phase.name === 'Exhale') orbScale = 1.08 - 0.23 * phaseProgress;
    else orbScale = 0.85; // Hold out
  }

  // Mini preview orb scale
  let previewOrbScale = 0.8;
  let previewPhaseName: PhaseName = 'Inhale';
  if (previewPattern && !prefersReducedMotion) {
    const { phase: pvPhase, progress: pvProgress } = getPhaseAt(previewElapsed, previewPattern.phases);
    previewPhaseName = pvPhase.name;
    if (pvPhase.name === 'Inhale') previewOrbScale = 0.8 + 0.2 * pvProgress;
    else if (pvPhase.name === 'Hold') previewOrbScale = 1.0;
    else if (pvPhase.name === 'Exhale') previewOrbScale = 1.0 - 0.2 * pvProgress;
    else previewOrbScale = 0.8; // Hold out
  } else if (previewPattern && prefersReducedMotion) {
    previewPhaseName = previewPattern.phases[0].name;
  }

  const ringSize = 200;
  const ringStroke = 4;
  const ringRadius = (ringSize - ringStroke) / 2;
  const ringCirc = 2 * Math.PI * ringRadius;
  const overallProgress = Math.min(1, elapsed / TOTAL_SECONDS);
  const dashOffset = ringCirc * (1 - overallProgress);

  const toggleMute = () => {
    setMuted(prev => {
      const next = !prev;
      try { window.localStorage?.setItem(muteKey(prefix), next ? '1' : '0'); } catch { /* noop */ }
      return next;
    });
  };

  const choosePattern = (id: PatternId) => {
    setPatternId(id);
    try { window.localStorage?.setItem(patternKey(prefix), id); } catch { /* noop */ }
  };

  const handleChipTouchEnd = (id: PatternId, e: React.TouchEvent) => {
    e.preventDefault();
    if (touchPendingId === id) {
      setTouchPendingId(null);
      setPreviewPatternId(null);
      choosePattern(id);
    } else {
      setTouchPendingId(id);
      setPreviewPatternId(id);
    }
  };

  const cancelTouchPending = () => {
    if (touchPendingId !== null) {
      setTouchPendingId(null);
      setPreviewPatternId(null);
    }
  };

  const label = prefersReducedMotion ? 'Take a quiet moment.' : phase.name;

  return (
    <div role="dialog" aria-label="Pause overlay" data-testid="pause-overlay" className="fixed inset-0 z-[10000]" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div aria-hidden="true" data-testid="pause-overlay-backdrop" onClick={onEnd} onTouchEnd={cancelTouchPending}
        style={{ position: 'absolute', inset: 0, background: 'rgba(15,42,40,0.78)', backdropFilter: 'blur(10px)', cursor: 'pointer' }} />
      {confirmation ? (
        <div
          onClick={e => e.stopPropagation()}
          data-testid="pause-confirmation"
          style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, maxWidth: 360, textAlign: 'center' }}
        >
          <div
            aria-hidden="true"
            style={{
              width: 88, height: 88, borderRadius: '50%',
              background: 'transparent',
              boxShadow: '0 0 50px rgba(46,196,182,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p data-testid="pause-confirmation-text" style={{ margin: 0, color: '#fff', fontSize: 17, fontWeight: 600, lineHeight: 1.4 }}>
            {confirmation}
          </p>
        </div>
      ) : (
      <div onClick={e => e.stopPropagation()} style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div
          role="status"
          aria-live="polite"
          data-testid="pause-pattern-hint"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            background: 'rgba(46,196,182,0.18)',
            border: '1px solid rgba(46,196,182,0.45)',
            borderRadius: 10,
            padding: '8px 12px',
            maxWidth: 300,
            lineHeight: 1.45,
            opacity: hintVisible ? 1 : 0,
            transition: prefersReducedMotion ? 'none' : 'opacity 120ms ease',
          }}
        >
          <span style={{ flex: 1, color: 'rgba(255,255,255,0.92)', fontSize: 12 }}>
            <strong style={{ color: '#fff' }}>{displayedHintPattern.label}:</strong>{' '}{displayedHintPattern.hint}
          </span>
        </div>
        <div role="radiogroup" aria-label="Breathing pattern" data-testid="pause-pattern-picker"
          style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          {PATTERNS.map(p => {
            const selected = p.id === pattern.id;
            const touchPending = p.id === touchPendingId;
            return (
              <button
                key={p.id}
                role="radio"
                aria-checked={selected}
                aria-describedby={`pause-pattern-hint-${p.id}`}
                data-testid={`pause-pattern-${p.id}`}
                onClick={() => choosePattern(p.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choosePattern(p.id); } }}
                onTouchEnd={(e) => handleChipTouchEnd(p.id, e)}
                onMouseEnter={() => setPreviewPatternId(p.id)}
                onMouseLeave={() => setPreviewPatternId(null)}
                onFocus={() => setPreviewPatternId(p.id)}
                onBlur={() => setPreviewPatternId(null)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: `1px solid rgba(255,255,255,${touchPending ? 0.9 : selected ? 0.7 : 0.3})`,
                  background: touchPending ? 'rgba(46,196,182,0.28)' : selected ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.3px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  lineHeight: 1.15,
                  transition: 'background 150ms ease, border-color 150ms ease',
                }}>
                <span>{p.label}</span>
                <span style={{ fontSize: 9, fontWeight: 400, opacity: 0.8 }}>{p.shortLabel}</span>
                {touchPending && (
                  <span
                    data-testid={`pause-pattern-tap-again-${p.id}`}
                    style={{ fontSize: 8, fontWeight: 500, color: 'rgba(46,196,182,0.95)', marginTop: 2, letterSpacing: '0.2px' }}
                  >
                    Tap again to use
                  </span>
                )}
                <span id={`pause-pattern-hint-${p.id}`} style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>{p.hint}</span>
              </button>
            );
          })}
        </div>

        {/* Mini preview orb — shown while hovering a pattern chip */}
        <div
          data-testid="pause-pattern-preview"
          aria-hidden="true"
          style={{
            height: 92,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            opacity: previewPattern ? 1 : 0,
            transition: prefersReducedMotion ? 'none' : 'opacity 200ms ease',
            pointerEvents: 'none',
          }}
        >
          {previewPattern && (
            <>
              <div style={{ position: 'relative', width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width={72} height={72} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }} aria-hidden="true">
                  <circle cx={36} cy={36} r={33} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={2.5} />
                  <circle
                    cx={36} cy={36} r={33}
                    fill="none" stroke="rgba(46,196,182,0.7)" strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 33}
                    strokeDashoffset={2 * Math.PI * 33 * (1 - (previewElapsed % previewCycleLen) / previewCycleLen)}
                    style={{ transition: prefersReducedMotion ? 'none' : 'stroke-dashoffset 80ms linear' }}
                  />
                </svg>
                <div
                  data-testid="pause-preview-orb"
                  style={{
                    width: 52, height: 52, borderRadius: '50%',
                    background: 'transparent',
                    boxShadow: '0 0 20px rgba(46,196,182,0.4)',
                    transform: `scale(${previewOrbScale})`,
                    transition: prefersReducedMotion ? 'none' : 'transform 120ms ease-out',
                  }}
                />
              </div>
              <span data-testid="pause-preview-phase-label" style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.3px' }}>
                {prefersReducedMotion ? previewPattern.label : previewPhaseName}
              </span>
            </>
          )}
        </div>

        <div style={{ position: 'relative', width: ringSize, height: ringSize, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width={ringSize} height={ringSize} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }} aria-hidden="true">
            <circle cx={ringSize / 2} cy={ringSize / 2} r={ringRadius} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={ringStroke} />
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={ringRadius}
              fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={ringStroke}
              strokeLinecap="round"
              strokeDasharray={ringCirc}
              strokeDashoffset={dashOffset}
              style={{ transition: prefersReducedMotion ? 'none' : 'stroke-dashoffset 200ms linear' }}
              data-testid="pause-progress-ring"
            />
          </svg>
          <div
            data-testid={`${prefix}-pause-orb`}
            style={{
              width: 140, height: 140, borderRadius: '50%',
              background: 'transparent',
              boxShadow: '0 0 60px rgba(46,196,182,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
              transform: `scale(${orbScale})`,
              transition: prefersReducedMotion ? 'none' : 'transform 200ms ease-out',
            }}>
            <span style={{ fontSize: 42, fontWeight: 300, color: '#fff', letterSpacing: '-0.5px', lineHeight: 1 }}>{remaining}</span>
          </div>
        </div>
        <p data-testid="pause-phase-label" style={{ margin: 0, color: '#fff', fontSize: 18, fontWeight: 600, letterSpacing: '0.5px', textAlign: 'center', minHeight: 24 }}>
          {label}
        </p>
        <p style={{ margin: 0, color: 'rgba(255,255,255,0.75)', fontSize: 13, textAlign: 'center', maxWidth: 320, lineHeight: 1.5 }}>
          {prefersReducedMotion ? 'Rest here for a few seconds.' : pattern.description}
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={onEnd} aria-label="End pause" data-testid="btn-end-pause"
            style={{ padding: '8px 20px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            I'm ready to continue
          </button>
          <button
            onClick={toggleMute}
            aria-label={muted ? 'Unmute pause sounds' : 'Mute pause sounds'}
            aria-pressed={muted}
            data-testid="btn-pause-mute"
            title={muted ? 'Sounds muted' : 'Sounds on'}
            style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
            {muted ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            )}
          </button>
        </div>
      </div>
      )}
    </div>
  );
}
