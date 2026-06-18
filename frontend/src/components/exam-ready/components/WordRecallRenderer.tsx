import { useState, useEffect, useCallback, useRef } from 'react';
import type { AssessmentQuestion } from '../types';

type RendererProps = {
    question: AssessmentQuestion;
    selectedAnswer: string | number | null;
    onAnswer: (questionId: string, answer: string | number) => void;
    isDarkMode?: boolean;
};

type Phase = 'memorize' | 'recall' | 'recognition';

const MEMORIZE_DURATION = 25; // seconds

/**
 * WordRecallRenderer — Memory Efficiency (1C)
 *
 * Module A: ALL words shown at once for 25 seconds → student types recalled words
 * Module B: Word set shows for 25 seconds → primary + distractors mixed → student picks originals
 *
 * Answer format: JSON { "recalled": [...], "recognized": [...], "moduleAScore": N, "moduleBScore": N }
 */
export function WordRecallRenderer({ question, selectedAnswer, onAnswer, isDarkMode }: RendererProps) {
    const words = question.wordSet || [];       // Module A: words for free recall
    const bWords = question.moduleBWords || []; // Module B: primary words for recognition
    const distractors = question.distractorPool || [];
    const hasModuleB = bWords.length > 0 && distractors.length > 0;

    // ─── State ───
    const [phase, setPhase] = useState<Phase>('memorize');
    const [timer, setTimer] = useState(MEMORIZE_DURATION);

    // Module A: typed recall
    const [recallInput, setRecallInput] = useState('');
    const [recalledWords, setRecalledWords] = useState<string[]>([]);

    // Module B: recognition picks
    const [mixedWords, setMixedWords] = useState<string[]>([]);
    const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
    const [moduleBTimer, setModuleBTimer] = useState(MEMORIZE_DURATION);
    const [moduleBPhase, setModuleBPhase] = useState<'show' | 'pick'>('show');

    const inputRef = useRef<HTMLInputElement>(null);

    // ─── Reset on question change ───
    useEffect(() => {
        setPhase('memorize');
        setTimer(MEMORIZE_DURATION);
        setRecallInput('');
        setRecalledWords([]);
        setSelectedWords(new Set());
        setModuleBTimer(MEMORIZE_DURATION);
        setModuleBPhase('show');
    }, [question.id]);

    // ─── Module A: Show all words for 25 seconds ───
    useEffect(() => {
        if (phase !== 'memorize') return;

        const interval = setInterval(() => {
            setTimer(prev => {
                if (prev <= 0.1) {
                    clearInterval(interval);
                    setPhase('recall');
                    setTimeout(() => inputRef.current?.focus(), 100);
                    return 0;
                }
                return Math.round((prev - 0.1) * 10) / 10;
            });
        }, 100);

        return () => clearInterval(interval);
    }, [phase, question.id]);

    // ─── Module B: Timer for showing words ───
    useEffect(() => {
        if (phase !== 'recognition' || moduleBPhase !== 'show') return;

        const interval = setInterval(() => {
            setModuleBTimer(prev => {
                if (prev <= 0.1) {
                    clearInterval(interval);
                    setModuleBPhase('pick');
                    // Shuffle Module B primary + distractors
                    const mixed = [...bWords, ...distractors].sort(() => Math.random() - 0.5);
                    setMixedWords(mixed);
                    return 0;
                }
                return Math.round((prev - 0.1) * 10) / 10;
            });
        }, 100);

        return () => clearInterval(interval);
    }, [phase, moduleBPhase, question.id]);

    // ─── Module A: Add recalled word ───
    const handleAddWord = useCallback(() => {
        const word = recallInput.trim();
        if (!word) return;
        if (!recalledWords.includes(word)) {
            setRecalledWords(prev => [...prev, word]);
        }
        setRecallInput('');
        inputRef.current?.focus();
    }, [recallInput, recalledWords]);

    const handleRemoveWord = useCallback((word: string) => {
        setRecalledWords(prev => prev.filter(w => w !== word));
    }, []);

    // ─── Module A → Module B transition ───
    const handleFinishRecall = useCallback(() => {
        if (hasModuleB) {
            setPhase('recognition');
            setModuleBTimer(MEMORIZE_DURATION);
            setModuleBPhase('show');
        } else {
            // No Module B — submit recall only
            const result = {
                recalled: recalledWords,
                moduleAScore: recalledWords.filter(w =>
                    words.some(original => original.toLowerCase() === w.toLowerCase())
                ).length,
            };
            onAnswer(question.id, JSON.stringify(result));
        }
    }, [hasModuleB, recalledWords, words, question.id, onAnswer]);

    // ─── Module B: Toggle word selection ───
    const handleToggleWord = useCallback((word: string) => {
        setSelectedWords(prev => {
            const next = new Set(prev);
            if (next.has(word)) next.delete(word);
            else next.add(word);
            return next;
        });
    }, []);

    // ─── Module B: Submit final answer ───
    const handleSubmitRecognition = useCallback(() => {
        const moduleAScore = recalledWords.filter(w =>
            words.some(original => original.toLowerCase() === w.toLowerCase())
        ).length;

        const moduleBCorrect = [...selectedWords].filter(w => bWords.includes(w));
        const moduleBFalsePositives = [...selectedWords].filter(w => !bWords.includes(w));

        const result = {
            recalled: recalledWords,
            recognized: [...selectedWords],
            moduleAScore,
            moduleBScore: moduleBCorrect.length,
            moduleBFalsePositives: moduleBFalsePositives.length,
            totalWordsA: words.length,
            totalWordsB: bWords.length,
        };
        onAnswer(question.id, JSON.stringify(result));
    }, [recalledWords, selectedWords, words, question.id, onAnswer]);

    // ─── Timer circle component ───
    const TimerCircle = ({ time, total }: { time: number; total: number }) => {
        const pct = (time / total) * 100;
        const isLow = time <= 5;
        return (
            <div className="flex items-center gap-3">
                <div className="relative w-16 h-16">
                    <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                        <circle cx="32" cy="32" r="28" fill="none" stroke={isDarkMode ? '#374151' : '#e5e7eb'} strokeWidth="4" />
                        <circle cx="32" cy="32" r="28" fill="none"
                            stroke={isLow ? '#ef4444' : '#0B3C5D'}
                            strokeWidth="4" strokeLinecap="round"
                            strokeDasharray={`${pct * 1.76} 176`}
                            className="transition-all duration-100"
                        />
                    </svg>
                    <span className={`absolute inset-0 flex items-center justify-center text-lg font-bold
            ${isLow ? 'text-red-500' : isDarkMode ? 'text-white' : 'text-gray-800'}
          `}>
                        {Math.ceil(time)}
                    </span>
                </div>
                <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>seconds left</span>
            </div>
        );
    };

    // ═══════════════════════════════════════════
    // PHASE: MEMORIZE (Module A — all words at once)
    // ═══════════════════════════════════════════
    if (phase === 'memorize') {
        return (
            <div className="space-y-6">
                {/* Header */}
                <div className={`text-center p-4 rounded-xl ${isDarkMode ? 'bg-blue-900/30' : 'bg-blue-50'}`}>
                    <h3 className={`text-lg font-bold mb-1 ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                        🧠 Module A — Memorize These Words
                    </h3>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Study all the words below. You have {MEMORIZE_DURATION} seconds to memorize them!
                    </p>
                </div>

                {/* Timer */}
                <div className="flex justify-center">
                    <TimerCircle time={timer} total={MEMORIZE_DURATION} />
                </div>

                {/* All words displayed at once */}
                <div className={`
          p-6 rounded-2xl border-2 grid grid-cols-2 sm:grid-cols-3 gap-3
          ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
        `}>
                    {words.map((word, i) => (
                        <div key={i} className={`
              px-4 py-3 rounded-xl text-center text-lg font-semibold
              ${isDarkMode ? 'bg-blue-900/40 text-blue-200' : 'bg-blue-100 text-blue-800'}
            `}
                            style={{ animation: `fadeIn 0.3s ease-out ${i * 0.08}s both` }}
                        >
                            {word}
                        </div>
                    ))}
                </div>

                {/* Word count */}
                <p className={`text-center text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    {words.length} words to memorize
                </p>
            </div>
        );
    }

    // ═══════════════════════════════════════════
    // PHASE: RECALL (Module A — type words)
    // ═══════════════════════════════════════════
    if (phase === 'recall') {
        return (
            <div className="space-y-6">
                {/* Header */}
                <div className={`text-center p-4 rounded-xl ${isDarkMode ? 'bg-emerald-900/30' : 'bg-emerald-50'}`}>
                    <h3 className={`text-lg font-bold mb-1 ${isDarkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>
                        ✍️ Module A — Type the Words You Remember
                    </h3>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Type each word and press Enter. Don't worry about spelling — close matches count!
                    </p>
                </div>

                {/* Input */}
                <div className="flex gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={recallInput}
                        onChange={e => setRecallInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddWord()}
                        placeholder="Type a word and press Enter..."
                        className={`
              flex-1 px-4 py-3 rounded-xl border-2 text-lg
              ${isDarkMode
                                ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:border-emerald-500'
                                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-emerald-500'
                            }
              focus:outline-none focus:ring-2 focus:ring-emerald-500/20
            `}
                    />
                    <button
                        onClick={handleAddWord}
                        disabled={!recallInput.trim()}
                        className={`
              px-6 py-3 rounded-xl font-semibold transition-all
              ${recallInput.trim()
                                ? 'bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95'
                                : isDarkMode ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-400'
                            }
            `}
                    >
                        Add
                    </button>
                </div>

                {/* Recalled words */}
                <div className={`p-4 rounded-xl border-2 min-h-[120px]
          ${isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'}
        `}>
                    <div className="flex items-center justify-between mb-3">
                        <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            Recalled: {recalledWords.length} words
                        </span>
                        <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                            (out of {words.length})
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {recalledWords.map((word, i) => (
                            <span key={i} className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
                ${isDarkMode ? 'bg-emerald-900/40 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}
              `}>
                                {word}
                                <button
                                    onClick={() => handleRemoveWord(word)}
                                    className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors text-xs"
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                        {recalledWords.length === 0 && (
                            <p className={`text-sm italic ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                                Start typing words you remember...
                            </p>
                        )}
                    </div>
                </div>

                {/* Continue button */}
                <button
                    onClick={handleFinishRecall}
                    className="w-full py-3 rounded-xl font-semibold bg-blue-500 text-white hover:bg-blue-600 active:scale-[0.98] transition-all"
                >
                    {hasModuleB ? '→ Continue to Module B (Recognition)' : '✓ Submit Answer'}
                </button>
            </div>
        );
    }

    // ═══════════════════════════════════════════
    // PHASE: RECOGNITION (Module B)
    // ═══════════════════════════════════════════
    if (phase === 'recognition') {
        if (moduleBPhase === 'show') {
            // Showing the primary words for 25 seconds
            return (
                <div className="space-y-6">
                    <div className={`text-center p-4 rounded-xl ${isDarkMode ? 'bg-[rgba(11,60,93,0.08)]/30' : 'bg-[rgba(11,60,93,0.08)]'}`}>
                        <h3 className={`text-lg font-bold mb-1 ${isDarkMode ? 'text-[#0B3C5D]' : 'text-[#0B3C5D]'}`}>
                            👁️ Module B — Study These Words
                        </h3>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            Memorize these words. You'll need to pick them out from a mixed list next!
                        </p>
                    </div>

                    <div className="flex justify-center">
                        <TimerCircle time={moduleBTimer} total={MEMORIZE_DURATION} />
                    </div>

                    <div className={`
            p-6 rounded-2xl border-2 grid grid-cols-2 sm:grid-cols-3 gap-3
            ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
          `}>
                        {bWords.map((word, i) => (
                            <div key={i} className={`
                px-4 py-3 rounded-xl text-center text-lg font-semibold
                ${isDarkMode ? 'bg-[rgba(11,60,93,0.08)]/40 text-[#0B3C5D]' : 'bg-[rgba(11,60,93,0.08)] text-[#0B3C5D]'}
              `}
                                style={{ animation: `fadeIn 0.3s ease-out ${i * 0.1}s both` }}
                            >
                                {word}
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        // Module B: Pick from mixed list
        return (
            <div className="space-y-6">
                <div className={`text-center p-4 rounded-xl ${isDarkMode ? 'bg-[rgba(11,60,93,0.08)]/30' : 'bg-[rgba(11,60,93,0.08)]'}`}>
                    <h3 className={`text-lg font-bold mb-1 ${isDarkMode ? 'text-[#0B3C5D]' : 'text-[#0B3C5D]'}`}>
                        🎯 Module B — Pick the Words You Saw
                    </h3>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Tap the words you remember seeing. Careful — some are decoys!
                    </p>
                </div>

                {/* Selection count */}
                <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Selected: {selectedWords.size} of {bWords.length} words
                    </span>
                    <div className="flex-1 mx-4 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-[rgba(11,60,93,0.08)] rounded-full transition-all duration-300"
                            style={{ width: `${(selectedWords.size / bWords.length) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Mixed word grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {mixedWords.map((word, i) => {
                        const isSelected = selectedWords.has(word);
                        return (
                            <button
                                key={`${word}-${i}`}
                                onClick={() => handleToggleWord(word)}
                                className={`
                  px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-200
                  ${isSelected
                                        ? 'bg-[rgba(11,60,93,0.08)] text-white shadow-lg shadow-[rgba(11,60,93,0.20)] scale-105'
                                        : isDarkMode
                                            ? 'bg-gray-800 text-gray-300 border border-gray-700 hover:border-[rgba(11,60,93,0.20)] hover:bg-gray-700'
                                            : 'bg-white text-gray-700 border border-gray-300 hover:border-[rgba(11,60,93,0.20)] hover:bg-[rgba(11,60,93,0.08)]'
                                    }
                `}
                            >
                                {word}
                            </button>
                        );
                    })}
                </div>

                {/* Submit */}
                <button
                    onClick={handleSubmitRecognition}
                    disabled={selectedWords.size === 0}
                    className={`
            w-full py-3 rounded-xl font-semibold transition-all
            ${selectedWords.size > 0
                            ? 'bg-[rgba(11,60,93,0.08)] text-white hover:bg-[rgba(11,60,93,0.08)] active:scale-[0.98]'
                            : isDarkMode ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-400'
                        }
          `}
                >
                    ✓ Submit Answer ({selectedWords.size} selected)
                </button>
            </div>
        );
    }

    return null;
}
