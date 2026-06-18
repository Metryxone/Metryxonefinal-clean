import { useState, useEffect } from 'react';
import type { AssessmentQuestion } from '../types';

type RendererProps = {
    question: AssessmentQuestion;
    selectedAnswer: string | number | null;
    onAnswer: (questionId: string, answer: string | number) => void;
    isDarkMode?: boolean;
};

// Strategy tag → display info
const STRATEGY_INFO: Record<string, { label: string; icon: string; color: string; bg: string; darkBg: string }> = {
    V: { label: 'Visual Structuring', icon: '👁️', color: 'text-[#0B3C5D]', bg: 'bg-[rgba(11,60,93,0.08)]', darkBg: 'bg-[rgba(11,60,93,0.08)]/30' },
    R: { label: 'Reading-Based Processing', icon: '📖', color: 'text-blue-600', bg: 'bg-blue-100', darkBg: 'bg-blue-900/30' },
    P: { label: 'Practice / Application', icon: '🛠️', color: 'text-amber-600', bg: 'bg-amber-100', darkBg: 'bg-amber-900/30' },
};

/**
 * LearningStrategyRenderer — Learning Strategy (1E)
 *
 * Each question has 3 options tagged [V], [R], or [P].
 * User picks one option per question (single selection).
 * Answer stored as JSON: { optionId, tag, strategy }
 */
export function LearningStrategyRenderer({ question, selectedAnswer, onAnswer, isDarkMode }: RendererProps) {
    const options = question.options || [];
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // Restore previous selection
    useEffect(() => {
        if (selectedAnswer) {
            try {
                const parsed = JSON.parse(String(selectedAnswer));
                setSelectedId(parsed.optionId || null);
            } catch {
                setSelectedId(String(selectedAnswer));
            }
        } else {
            setSelectedId(null);
        }
    }, [question.id, selectedAnswer]);

    const handleSelect = (optionId: string) => {
        setSelectedId(optionId);
        const opt = options.find(o => o.id === optionId);
        const answer = {
            optionId,
            tag: opt?.tag || '',
            strategy: opt?.strategy || '',
            text: opt?.text || '',
        };
        onAnswer(question.id, JSON.stringify(answer));
    };

    return (
        <div className="space-y-5">
            {/* Question text */}
            <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {question.text}
                </h3>
            </div>

            {/* Options */}
            <div className="space-y-3">
                {options.map((opt, idx) => {
                    const isSelected = selectedId === opt.id;
                    const info = STRATEGY_INFO[opt.tag || ''];
                    const tagBadge = info ? (
                        <span className={`
              inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold
              ${isDarkMode ? info.darkBg + ' ' + info.color.replace('600', '300') : info.bg + ' ' + info.color}
            `}>
                            {info.icon} {opt.tag}
                        </span>
                    ) : null;

                    return (
                        <button
                            key={opt.id}
                            onClick={() => handleSelect(opt.id)}
                            className={`
                w-full text-left p-4 rounded-xl border-2 transition-all duration-200
                ${isSelected
                                    ? isDarkMode
                                        ? 'border-[rgba(11,60,93,0.25)] bg-[rgba(11,60,93,0.08)]/30 shadow-lg shadow-[rgba(11,60,93,0.25)]'
                                        : 'border-[rgba(11,60,93,0.25)] bg-[rgba(11,60,93,0.08)] shadow-lg shadow-[rgba(11,60,93,0.25)]'
                                    : isDarkMode
                                        ? 'border-gray-700 bg-gray-800 hover:border-gray-600 hover:bg-gray-750'
                                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                                }
              `}
                        >
                            <div className="flex items-start gap-3">
                                {/* Radio circle */}
                                <div className={`
                  w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5
                  ${isSelected
                                        ? 'border-[rgba(11,60,93,0.25)] bg-[rgba(11,60,93,0.08)]'
                                        : isDarkMode ? 'border-gray-500' : 'border-gray-300'
                                    }
                `}>
                                    {isSelected && (
                                        <div className="w-2 h-2 rounded-full bg-white" />
                                    )}
                                </div>

                                {/* Option content */}
                                <div className="flex-1">
                                    <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                        {opt.text}
                                    </p>
                                    <div className="mt-1.5">
                                        {tagBadge}
                                    </div>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
