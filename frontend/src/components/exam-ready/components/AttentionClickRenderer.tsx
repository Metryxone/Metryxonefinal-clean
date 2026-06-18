import { useState, useEffect, useCallback, useRef } from 'react';
import type { AssessmentQuestion } from '../types';

type RendererProps = {
    question: AssessmentQuestion;
    selectedAnswer: string | number | null;
    onAnswer: (questionId: string, answer: string | number) => void;
    isDarkMode?: boolean;
};

// ═══════════════════════════════════════════
// Pools
// ═══════════════════════════════════════════
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const DIGITS = '0123456789'.split('');
const SYMBOLS = ['★', '▲', '■', '○', '◆', '✚'];

function shuffleArray<T>(arr: T[]): T[] {
    const s = [...arr];
    for (let i = s.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [s[i], s[j]] = [s[j], s[i]];
    }
    return s;
}

// ═══════════════════════════════════════════
// DISPATCHER — routes to correct mode
// ═══════════════════════════════════════════
export function AttentionClickRenderer(props: RendererProps) {
    const logicType = props.question.logicType || 'single_target';

    switch (logicType) {
        case 'vigilance':
        case 'sequence':
        case 'conditional':
            return <StreamMode {...props} />;

        case 'single_target':
        case 'dual_target':
        case 'ignore_distractor':
        default:
            return <GridMode {...props} />;
    }
}

// ═══════════════════════════════════════════
// GRID MODE — single_target, dual_target, ignore_distractor
// ═══════════════════════════════════════════
function buildGridPool(targets: string[], stimulusType: string, logicType: string, instruction: string): string[] {
    const instrLower = instruction.toLowerCase();

    // ignore_distractor with mixed pools
    if (logicType === 'ignore_distractor') {
        if (instrLower.includes('ignore digits') || instrLower.includes('ignore numbers')) {
            const pool = [...LETTERS.slice(0, 12), ...DIGITS.slice(0, 4)];
            targets.forEach(t => { if (!pool.includes(t)) pool.push(t); });
            return shuffleArray(pool);
        }
        if (instrLower.includes('ignore letters')) {
            const pool = [...DIGITS, ...LETTERS.slice(0, 6)];
            targets.forEach(t => { if (!pool.includes(t)) pool.push(t); });
            return shuffleArray(pool);
        }
        // Symbol-based ignore_distractor (e.g. "Click ◆, ignore ★")
        if (stimulusType === 'symbol') {
            const distractors = SYMBOLS.filter(s => !targets.includes(s));
            const pool = [...targets, ...targets, ...shuffleArray(distractors).slice(0, 12)];
            return shuffleArray(pool);
        }
        // Mixed symbol + letter grid
        const pool = [...LETTERS.slice(0, 10), ...SYMBOLS.slice(0, 4)];
        targets.forEach(t => { if (!pool.includes(t)) pool.push(t); });
        return shuffleArray(pool);
    }

    if (stimulusType === 'symbol') {
        // Ensure targets are in the pool and pad with distractors
        const distractors = SYMBOLS.filter(s => !targets.includes(s));
        const pool = [...targets, ...targets, ...shuffleArray(distractors).slice(0, 10)];
        return shuffleArray(pool);
    }

    if (stimulusType === 'digit') {
        const nonTargets = DIGITS.filter(d => !targets.includes(d));
        const pool = [...targets, ...shuffleArray(nonTargets).slice(0, 12)];
        return shuffleArray(pool);
    }

    // Letters — 4×4 grid
    const nonTargets = LETTERS.filter(l => !targets.includes(l));
    const gridSize = Math.max(16, targets.length + 12);
    const pool = [...targets, ...shuffleArray(nonTargets).slice(0, gridSize - targets.length)];
    return shuffleArray(pool);
}

function GridMode({ question, selectedAnswer, onAnswer, isDarkMode }: RendererProps) {
    const targets = question.parsedTargets || [];
    const stimulusType = question.stimulusType || 'letter';
    const logicType = question.logicType || 'single_target';
    const instruction = question.text || '';

    const [pool] = useState(() => buildGridPool(targets, stimulusType, logicType, instruction));
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        setSelected(new Set());
        setSubmitted(false);
    }, [question.id]);

    const handleSelect = useCallback((item: string) => {
        if (submitted) return;
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(item)) next.delete(item);
            else next.add(item);
            return next;
        });
    }, [submitted]);

    const handleSubmit = useCallback(() => {
        if (submitted || selected.size === 0) return;
        setSubmitted(true);

        const selectedArr = [...selected];
        const hits = selectedArr.filter(s => targets.includes(s)).length;
        const falseAlarms = selectedArr.filter(s => !targets.includes(s)).length;
        const misses = targets.filter(t => !selected.has(t)).length;
        const correct = hits === targets.length && falseAlarms === 0;

        onAnswer(question.id, JSON.stringify({
            mode: 'grid',
            logicType,
            stimulusType,
            selected: selectedArr,
            targets,
            hits,
            misses,
            falseAlarms,
            correct,
        }));
    }, [submitted, selected, targets, question.id, onAnswer, logicType, stimulusType]);

    const getGridCols = (len: number) => {
        if (len <= 5) return 'grid-cols-5';
        if (len <= 6) return 'grid-cols-3 sm:grid-cols-6';
        if (len <= 10) return 'grid-cols-5';
        if (len <= 16) return 'grid-cols-4';
        return 'grid-cols-4 sm:grid-cols-5';
    };

    // Context info for ignore_distractor
    const warningLabel = logicType === 'ignore_distractor'
        ? '⚠️ Distractors present — click only the target!'
        : logicType === 'dual_target'
            ? '🎯 Find BOTH targets in the grid'
            : null;

    return (
        <div className="space-y-5">
            {/* Instruction */}
            <div className={`text-center p-5 rounded-2xl ${isDarkMode ? 'bg-[rgba(11,60,93,0.08)]/30' : 'bg-[rgba(11,60,93,0.08)]'}`}>
                <div className="text-3xl mb-2">🎯</div>
                <h3 className={`text-xl font-bold mb-1 ${isDarkMode ? 'text-[#0B3C5D]' : 'text-[#0B3C5D]'}`}>
                    {instruction}
                </h3>
                {question.selectivity && (
                    <span className={`inline-flex px-3 py-0.5 rounded-full text-xs font-medium mt-1 ${isDarkMode ? 'bg-[rgba(11,60,93,0.08)]/50 text-[#0B3C5D]' : 'bg-[rgba(11,60,93,0.08)] text-[#0B3C5D]'}`}>
                        {question.selectivity}
                    </span>
                )}
            </div>

            {/* Target hint */}
            <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                    <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Find:</span>
                    {targets.map((t, i) => (
                        <span key={i} className="w-10 h-10 rounded-lg bg-[rgba(11,60,93,0.08)] text-white flex items-center justify-center text-lg font-bold shadow-md shadow-[rgba(11,60,93,0.25)]">
                            {t}
                        </span>
                    ))}
                </div>
                {warningLabel && (
                    <p className={`text-xs font-medium ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>
                        {warningLabel}
                    </p>
                )}
            </div>

            {/* Grid */}
            <div className={`grid ${getGridCols(pool.length)} gap-2`}>
                {pool.map((item, i) => {
                    const isSelected = selected.has(item);
                    const isTarget = targets.includes(item);

                    let style = '';
                    if (submitted) {
                        if (isTarget && isSelected) style = 'border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 scale-105';
                        else if (isTarget && !isSelected) style = 'border-amber-500 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 ring-2 ring-amber-400';
                        else if (!isTarget && isSelected) style = 'border-red-500 bg-red-500 text-white shadow-lg shadow-red-500/30';
                        else style = isDarkMode ? 'border-gray-700 bg-gray-800/50 text-gray-500' : 'border-gray-200 bg-gray-100 text-gray-400';
                    } else if (isSelected) {
                        style = 'border-[rgba(11,60,93,0.25)] bg-[rgba(11,60,93,0.08)] text-white shadow-lg shadow-[rgba(11,60,93,0.25)] scale-105';
                    } else {
                        style = isDarkMode
                            ? 'border-gray-600 bg-gray-800 text-gray-200 hover:border-[rgba(11,60,93,0.25)] hover:bg-gray-700'
                            : 'border-gray-300 bg-white text-gray-800 hover:border-[rgba(11,60,93,0.25)] hover:bg-[rgba(11,60,93,0.08)]';
                    }

                    return (
                        <button
                            key={`${item}-${i}`}
                            onClick={() => handleSelect(item)}
                            disabled={submitted}
                            className={`h-14 rounded-xl border-2 text-xl font-bold transition-all duration-150 ${submitted ? 'cursor-default' : 'cursor-pointer active:scale-95'} ${style}`}
                        >
                            {item}
                        </button>
                    );
                })}
            </div>

            {/* Submit / Result */}
            {!submitted ? (
                <button
                    onClick={handleSubmit}
                    disabled={selected.size === 0}
                    className={`w-full py-3.5 rounded-xl font-semibold text-base transition-all ${selected.size > 0
                        ? 'bg-[rgba(11,60,93,0.08)] text-white hover:bg-[rgba(11,60,93,0.08)] active:scale-[0.98] shadow-lg shadow-[rgba(11,60,93,0.25)]'
                        : isDarkMode ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-400'
                        }`}
                >
                    ✓ Confirm Selection ({selected.size} selected)
                </button>
            ) : (
                <GridFeedback targets={targets} selected={[...selected]} isDarkMode={isDarkMode} />
            )}
        </div>
    );
}

function GridFeedback({ targets, selected, isDarkMode }: { targets: string[]; selected: string[]; isDarkMode?: boolean }) {
    const hits = selected.filter(s => targets.includes(s)).length;
    const falseAlarms = selected.filter(s => !targets.includes(s)).length;
    const misses = targets.filter(t => !selected.includes(t)).length;
    const correct = hits === targets.length && falseAlarms === 0;

    return (
        <div className={`p-4 rounded-xl border-2 ${correct ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-red-400 bg-red-50 dark:bg-red-900/20'}`}>
            <div className="flex items-center gap-3">
                <span className="text-3xl">{correct ? '✅' : '❌'}</span>
                <div>
                    <p className={`font-bold ${correct ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                        {correct ? 'Correct!' : 'Not quite right'}
                    </p>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {hits}/{targets.length} targets found
                        {falseAlarms > 0 && ` · ${falseAlarms} wrong pick${falseAlarms > 1 ? 's' : ''}`}
                        {misses > 0 && ` · ${misses} missed`}
                    </p>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════
// STREAM MODE — vigilance, sequence, conditional
// ═══════════════════════════════════════════

const STREAM_LENGTH = 20;        // total items in the stream
const TARGET_RATE = 0.30;        // ~30% chance of target
const ITEM_DURATION_MS = 1500;   // 1.5 seconds per item
const CONDITIONAL_DURATION_MS = 2000; // 2s for conditional (needs thinking time)

interface StreamEvent {
    item: string;
    isTarget: boolean;        // should user tap here?
    showTime: number;         // ms timestamp when shown
}

function generateStream(
    targets: string[],
    predecessor: string | undefined,
    stimulusType: string,
    logicType: string,
): StreamEvent[] {
    const target = targets[0];
    const pool = stimulusType === 'symbol' ? SYMBOLS
        : stimulusType === 'digit' ? DIGITS
            : LETTERS.slice(0, 16);

    const nonTargets = pool.filter(x => x !== target && x !== predecessor);
    const events: StreamEvent[] = [];
    const numTargets = Math.round(STREAM_LENGTH * TARGET_RATE);

    // For sequence: we need predecessor → target pairs
    // For conditional: we need target → follower pairs
    // For vigilance: just sprinkle targets

    if (logicType === 'sequence' && predecessor) {
        // Insert ~numTargets valid sequences: predecessor → target
        const targetPositions = new Set<number>();
        while (targetPositions.size < numTargets) {
            // predecessor goes at pos, target at pos+1
            const pos = 1 + Math.floor(Math.random() * (STREAM_LENGTH - 2));
            if (!targetPositions.has(pos) && !targetPositions.has(pos - 1) && !targetPositions.has(pos + 1)) {
                targetPositions.add(pos);
            }
        }

        for (let i = 0; i < STREAM_LENGTH; i++) {
            if (targetPositions.has(i)) {
                // This position is where the target goes; previous slot must be predecessor
                events.push({ item: target, isTarget: true, showTime: 0 });
            } else {
                // Check if next position needs this to be predecessor
                const nextIsTarget = targetPositions.has(i + 1);
                if (nextIsTarget) {
                    events.push({ item: predecessor!, isTarget: false, showTime: 0 });
                } else {
                    // Random non-target (may include target but it's NOT after predecessor)
                    const randomItem = Math.random() < 0.15 && !targetPositions.has(i + 1)
                        ? target  // target appears but not after predecessor — should NOT be tapped
                        : nonTargets[Math.floor(Math.random() * nonTargets.length)];
                    events.push({ item: randomItem, isTarget: false, showTime: 0 });
                }
            }
        }
    } else if (logicType === 'conditional' && predecessor) {
        // predecessor here is actually the "follower" — target → follower
        const follower = predecessor;
        const validPositions = new Set<number>();
        while (validPositions.size < numTargets) {
            const pos = Math.floor(Math.random() * (STREAM_LENGTH - 1));
            if (!validPositions.has(pos) && !validPositions.has(pos - 1) && !validPositions.has(pos + 1)) {
                validPositions.add(pos);
            }
        }

        for (let i = 0; i < STREAM_LENGTH; i++) {
            if (validPositions.has(i)) {
                events.push({ item: target, isTarget: true, showTime: 0 });
            } else if (i > 0 && validPositions.has(i - 1)) {
                // This slot follows a valid target — place the follower
                events.push({ item: follower, isTarget: false, showTime: 0 });
            } else {
                // Also sprinkle some invalid targets (target NOT followed by follower)
                const randomItem = Math.random() < 0.1
                    ? target  // trap: target but next is NOT follower — should NOT tap
                    : nonTargets[Math.floor(Math.random() * nonTargets.length)];
                events.push({ item: randomItem, isTarget: false, showTime: 0 });
            }
        }
    } else {
        // Vigilance — simple: target appears randomly
        const targetPositions = new Set<number>();
        while (targetPositions.size < numTargets) {
            targetPositions.add(Math.floor(Math.random() * STREAM_LENGTH));
        }

        for (let i = 0; i < STREAM_LENGTH; i++) {
            if (targetPositions.has(i)) {
                events.push({ item: target, isTarget: true, showTime: 0 });
            } else {
                const randomItem = nonTargets[Math.floor(Math.random() * nonTargets.length)];
                events.push({ item: randomItem, isTarget: false, showTime: 0 });
            }
        }
    }

    return events;
}

type StreamPhase = 'ready' | 'running' | 'done';

function StreamMode({ question, selectedAnswer, onAnswer, isDarkMode }: RendererProps) {
    const targets = question.parsedTargets || [];
    const predecessor = question.predecessor;
    const stimulusType = question.stimulusType || 'letter';
    const logicType = question.logicType || 'vigilance';
    const instruction = question.text || '';

    const duration = logicType === 'conditional' ? CONDITIONAL_DURATION_MS : ITEM_DURATION_MS;

    const [phase, setPhase] = useState<StreamPhase>('ready');
    const [stream] = useState(() => generateStream(targets, predecessor, stimulusType, logicType));
    const [currentIdx, setCurrentIdx] = useState(0);
    const [taps, setTaps] = useState<Map<number, number>>(new Map()); // idx → reaction time ms
    const [tapFlash, setTapFlash] = useState(false);
    const startTimeRef = useRef(0);
    const itemStartRef = useRef(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

    // Reset on question change
    useEffect(() => {
        setPhase('ready');
        setCurrentIdx(0);
        setTaps(new Map());
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [question.id]);

    const startStream = useCallback(() => {
        setPhase('running');
        setCurrentIdx(0);
        setTaps(new Map());
        startTimeRef.current = Date.now();
        itemStartRef.current = Date.now();

        timerRef.current = setInterval(() => {
            setCurrentIdx(prev => {
                const next = prev + 1;
                if (next >= STREAM_LENGTH) {
                    clearInterval(timerRef.current);
                    // Delay to let last item be seen
                    setTimeout(() => setPhase('done'), 600);
                    return prev;
                }
                itemStartRef.current = Date.now();
                return next;
            });
        }, duration);
    }, [duration]);

    const handleTap = useCallback(() => {
        if (phase !== 'running') return;
        const reactionTime = Date.now() - itemStartRef.current;
        setTaps(prev => {
            const next = new Map(prev);
            next.set(currentIdx, reactionTime);
            return next;
        });
        // Flash effect
        setTapFlash(true);
        setTimeout(() => setTapFlash(false), 200);
    }, [phase, currentIdx]);

    // Submit results when done
    useEffect(() => {
        if (phase !== 'done') return;

        let hits = 0, misses = 0, falseAlarms = 0;
        const reactionTimes: number[] = [];

        stream.forEach((evt, idx) => {
            const tapped = taps.has(idx);
            if (evt.isTarget && tapped) {
                hits++;
                reactionTimes.push(taps.get(idx)!);
            } else if (evt.isTarget && !tapped) {
                misses++;
            } else if (!evt.isTarget && tapped) {
                falseAlarms++;
            }
        });

        const avgReactionTime = reactionTimes.length > 0
            ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
            : 0;

        onAnswer(question.id, JSON.stringify({
            mode: 'stream',
            logicType,
            stimulusType,
            targets,
            predecessor,
            hits,
            misses,
            falseAlarms,
            avgReactionTimeMs: avgReactionTime,
            totalTargets: stream.filter(e => e.isTarget).length,
            totalItems: STREAM_LENGTH,
            correct: hits > 0 && falseAlarms === 0 && misses === 0,
        }));
    }, [phase, stream, taps, question.id, onAnswer, logicType, stimulusType, targets, predecessor]);

    const currentEvent = stream[currentIdx];
    const totalTargets = stream.filter(e => e.isTarget).length;

    // ─── Context label for sequence/conditional ───
    let contextLabel = '';
    if (logicType === 'sequence' && predecessor) {
        contextLabel = `Only tap when "${targets[0]}" appears right after "${predecessor}"`;
    } else if (logicType === 'conditional' && predecessor) {
        contextLabel = `Only tap "${targets[0]}" if followed by "${predecessor}"`;
    }

    // ─── READY PHASE ───
    if (phase === 'ready') {
        return (
            <div className="space-y-6">
                <div className={`text-center p-6 rounded-2xl ${isDarkMode ? 'bg-[rgba(11,60,93,0.08)]/30' : 'bg-[rgba(11,60,93,0.08)]'}`}>
                    <div className="text-4xl mb-3">⚡</div>
                    <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-[#0B3C5D]' : 'text-[#0B3C5D]'}`}>
                        {instruction}
                    </h3>
                    {question.selectivity && (
                        <span className={`inline-flex px-3 py-0.5 rounded-full text-xs font-medium ${isDarkMode ? 'bg-[rgba(11,60,93,0.08)]/50 text-[#0B3C5D]' : 'bg-[rgba(11,60,93,0.08)] text-[#0B3C5D]'}`}>
                            {question.selectivity}
                        </span>
                    )}
                </div>

                {/* Target display */}
                <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Target:</span>
                        <span className="w-14 h-14 rounded-xl bg-[rgba(11,60,93,0.08)] text-white flex items-center justify-center text-2xl font-bold shadow-lg shadow-[rgba(11,60,93,0.25)]">
                            {targets[0]}
                        </span>
                    </div>
                    {contextLabel && (
                        <p className={`text-sm text-center px-4 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>
                            ⚠️ {contextLabel}
                        </p>
                    )}
                </div>

                {/* Instructions box */}
                <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        Items will appear <strong>one at a time</strong>. Tap the button below when you see the target.
                        {logicType === 'sequence' && ` But only when it appears right after "${predecessor}".`}
                        {logicType === 'conditional' && ` But only when it's followed by "${predecessor}".`}
                    </p>
                    <p className={`text-xs mt-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        {STREAM_LENGTH} items · ~{Math.round(STREAM_LENGTH * duration / 1000)}s total
                    </p>
                </div>

                <button
                    onClick={startStream}
                    className="w-full py-4 rounded-xl font-bold text-lg bg-indigo-500 text-white shadow-xl shadow-[rgba(11,60,93,0.25)] hover:bg-indigo-600 hover: active:scale-[0.98] transition-all"
                >
                    ▶ Start
                </button>
            </div>
        );
    }

    // ─── RUNNING PHASE ───
    if (phase === 'running') {
        const progress = ((currentIdx + 1) / STREAM_LENGTH) * 100;
        const prevItem = currentIdx > 0 ? stream[currentIdx - 1].item : null;
        const wasTapped = taps.has(currentIdx);

        return (
            <div className="space-y-6">
                {/* Progress bar */}
                <div className="relative">
                    <div className={`h-2 rounded-full ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                        <div
                            className="h-2 rounded-full bg-indigo-500 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className={`text-xs mt-1 text-center ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        {currentIdx + 1} / {STREAM_LENGTH}
                    </p>
                </div>

                {/* Previous item (for sequence) */}
                {logicType === 'sequence' && prevItem && (
                    <div className="flex items-center justify-center gap-2">
                        <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Previous:</span>
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'}`}>
                            {prevItem}
                        </span>
                    </div>
                )}

                {/* Current item — BIG center display */}
                <div className="flex items-center justify-center">
                    <div className={`
            w-32 h-32 rounded-3xl flex items-center justify-center text-6xl font-black
            transition-all duration-200 shadow-2xl
            ${tapFlash
                            ? 'bg-[rgba(11,60,93,0.08)] text-white scale-110 shadow-[rgba(11,60,93,0.25)]'
                            : isDarkMode
                                ? 'bg-gray-800 text-white border-2 border-gray-600'
                                : 'bg-white text-gray-900 border-2 border-gray-300'
                        }
          `}>
                        {currentEvent?.item}
                    </div>
                </div>

                {/* TAP button */}
                <button
                    onClick={handleTap}
                    disabled={wasTapped}
                    className={`
            w-full py-6 rounded-2xl text-2xl font-black tracking-wider
            transition-all duration-100 active:scale-95
            ${wasTapped
                            ? isDarkMode ? 'bg-[rgba(11,60,93,0.08)]/50 text-[#0B3C5D]' : 'bg-[rgba(11,60,93,0.08)] text-[#0B3C5D]'
                            : 'bg-rose-500 text-white shadow-2xl shadow-rose-500/30 hover:bg-rose-600 hover:'
                        }
          `}
                >
                    {wasTapped ? '✓ TAPPED' : '⚡ TAP'}
                </button>
            </div>
        );
    }

    // ─── DONE PHASE ───
    let hits = 0, misses = 0, falseAlarms = 0;
    const reactionTimes: number[] = [];

    stream.forEach((evt, idx) => {
        const tapped = taps.has(idx);
        if (evt.isTarget && tapped) { hits++; reactionTimes.push(taps.get(idx)!); }
        else if (evt.isTarget && !tapped) misses++;
        else if (!evt.isTarget && tapped) falseAlarms++;
    });

    const avgRT = reactionTimes.length > 0
        ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
        : 0;
    const allCorrect = hits === totalTargets && falseAlarms === 0;

    return (
        <div className="space-y-5">
            {/* Result header */}
            <div className={`p-5 rounded-2xl border-2 ${allCorrect
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                : 'border-amber-400 bg-amber-50 dark:bg-amber-900/20'
                }`}>
                <div className="flex items-center gap-3 mb-3">
                    <span className="text-4xl">{allCorrect ? '🎉' : '📊'}</span>
                    <div>
                        <p className={`text-lg font-bold ${allCorrect ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                            {allCorrect ? 'Perfect!' : 'Results'}
                        </p>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            {instruction}
                        </p>
                    </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard label="Hits" value={`${hits}/${totalTargets}`} color="emerald" isDarkMode={isDarkMode} />
                    <StatCard label="Misses" value={String(misses)} color={misses > 0 ? 'red' : 'emerald'} isDarkMode={isDarkMode} />
                    <StatCard label="False Alarms" value={String(falseAlarms)} color={falseAlarms > 0 ? 'red' : 'emerald'} isDarkMode={isDarkMode} />
                    <StatCard label="Avg Reaction" value={avgRT > 0 ? `${avgRT}ms` : '—'} color="blue" isDarkMode={isDarkMode} />
                </div>
            </div>

            {/* Stream replay */}
            <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
                <p className={`text-xs font-medium mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Stream replay:</p>
                <div className="flex flex-wrap gap-1.5">
                    {stream.map((evt, idx) => {
                        const tapped = taps.has(idx);
                        let bg = '';
                        if (evt.isTarget && tapped) bg = 'bg-emerald-500 text-white';
                        else if (evt.isTarget && !tapped) bg = 'bg-amber-500 text-white';
                        else if (!evt.isTarget && tapped) bg = 'bg-red-500 text-white';
                        else bg = isDarkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500';

                        return (
                            <span key={idx} className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${bg}`} title={
                                evt.isTarget && tapped ? 'Hit ✓' :
                                    evt.isTarget && !tapped ? 'Missed' :
                                        !evt.isTarget && tapped ? 'False alarm' : ''
                            }>
                                {evt.item}
                            </span>
                        );
                    })}
                </div>
                <div className="flex gap-4 mt-2">
                    <span className="flex items-center gap-1 text-xs"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Hit</span>
                    <span className="flex items-center gap-1 text-xs"><span className="w-3 h-3 rounded bg-amber-500 inline-block" /> Missed</span>
                    <span className="flex items-center gap-1 text-xs"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> False alarm</span>
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, color, isDarkMode }: { label: string; value: string; color: string; isDarkMode?: boolean }) {
    const colorMap: Record<string, string> = {
        emerald: isDarkMode ? 'bg-emerald-900/30 text-emerald-300 border-emerald-800' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
        red: isDarkMode ? 'bg-red-900/30 text-red-300 border-red-800' : 'bg-red-50 text-red-700 border-red-200',
        amber: isDarkMode ? 'bg-amber-900/30 text-amber-300 border-amber-800' : 'bg-amber-50 text-amber-700 border-amber-200',
        blue: isDarkMode ? 'bg-blue-900/30 text-blue-300 border-blue-800' : 'bg-blue-50 text-blue-700 border-blue-200',
    };

    return (
        <div className={`p-3 rounded-xl border text-center ${colorMap[color] || colorMap.blue}`}>
            <p className="text-lg font-bold">{value}</p>
            <p className="text-xs opacity-70">{label}</p>
        </div>
    );
}
