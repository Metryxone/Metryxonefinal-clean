import { useState, useEffect } from 'react';
import type { AssessmentQuestion, SubQuestion, QuestionOption } from '../types';

type RendererProps = {
    question: AssessmentQuestion;
    selectedAnswer: string | number | null;
    onAnswer: (questionId: string, answer: string | number) => void;
    isDarkMode?: boolean;
};

/**
 * PassageMCQRenderer — renders a reading passage with 3 linked MCQ sub-questions.
 * Used for 1B. Conceptual Understanding (passage_mcq type).
 *
 * Answer format: JSON string of { "0": "B", "1": "A", "2": "C" }
 * where keys are sub-question indices and values are selected option IDs.
 */
export function PassageMCQRenderer({ question, selectedAnswer, onAnswer, isDarkMode }: RendererProps) {
    // Parse stored answer (JSON string of sub-question answers)
    const parseAnswers = (ans: string | number | null): Record<number, string> => {
        if (!ans) return {};
        try {
            if (typeof ans === 'string') return JSON.parse(ans);
        } catch { /* ignore */ }
        return {};
    };

    const [subAnswers, setSubAnswers] = useState<Record<number, string>>(() => parseAnswers(selectedAnswer));

    // Reset state when question changes (navigating to next/prev passage)
    useEffect(() => {
        setSubAnswers(parseAnswers(selectedAnswer));
    }, [question.id]);

    const subQuestions = question.subQuestions || [];

    const handleSubAnswer = (subIndex: number, optionId: string) => {
        const updated = { ...subAnswers, [subIndex]: optionId };
        setSubAnswers(updated);
        // Send combined answer as JSON string
        onAnswer(question.id, JSON.stringify(updated));
    };

    const answeredCount = Object.keys(subAnswers).length;
    const totalSubs = subQuestions.length;

    return (
        <div className="space-y-6">
            {/* Reading Passage */}
            <div className={`
        relative p-6 rounded-2xl border-l-4 border-amber-400
        ${isDarkMode ? 'bg-amber-900/20' : 'bg-amber-50'}
      `}>
                <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <span className={`text-sm font-semibold uppercase tracking-wider ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>
                        Reading Passage
                    </span>
                </div>
                <p className={`text-base leading-relaxed ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                    {question.passageText}
                </p>
            </div>

            {/* Progress indicator */}
            <div className="flex items-center gap-2">
                <div className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Answered {answeredCount} of {totalSubs} questions
                </div>
                <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${totalSubs > 0 ? (answeredCount / totalSubs) * 100 : 0}%` }}
                    />
                </div>
            </div>

            {/* Sub-questions */}
            {subQuestions.map((sq: SubQuestion, idx: number) => (
                <SubQuestionCard
                    key={idx}
                    subQuestion={sq}
                    index={idx}
                    selectedOption={subAnswers[idx] || null}
                    onSelect={(optId) => handleSubAnswer(idx, optId)}
                    isDarkMode={isDarkMode}
                />
            ))}

            {/* If no sub_questions, fall back to showing the main options */}
            {subQuestions.length === 0 && question.options.length > 0 && (
                <div className="space-y-3">
                    {question.options.map((option) => {
                        const isSelected = selectedAnswer === option.id;
                        return (
                            <button
                                key={option.id}
                                onClick={() => onAnswer(question.id, option.id)}
                                className={`
                  w-full text-left p-4 rounded-xl border-2 transition-all duration-200
                  ${isSelected
                                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 shadow-md'
                                        : isDarkMode
                                            ? 'border-gray-700 bg-gray-800/50 hover:border-gray-500'
                                            : 'border-gray-200 bg-white hover:border-gray-300'
                                    }
                `}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`
                    flex-shrink-0 w-10 h-10 rounded-lg border-2 flex items-center justify-center
                    text-sm font-bold transition-all
                    ${isSelected
                                            ? 'border-emerald-500 bg-emerald-500 text-white'
                                            : isDarkMode ? 'border-gray-600 text-gray-400' : 'border-gray-300 text-gray-500'
                                        }
                  `}>
                                        {option.id}
                                    </div>
                                    <span className={`text-base ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                                        {option.text}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ─── SubQuestion Card ───
function SubQuestionCard({
    subQuestion,
    index,
    selectedOption,
    onSelect,
    isDarkMode,
}: {
    subQuestion: SubQuestion;
    index: number;
    selectedOption: string | null;
    onSelect: (optionId: string) => void;
    isDarkMode?: boolean;
}) {
    // Label colors for the 3 MCQ types
    const labelColors = [
        { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-500' },
        { bg: 'bg-[rgba(11,60,93,0.08)] dark:bg-[rgba(11,60,93,0.08)]/40', text: 'text-[#0B3C5D] dark:text-[#0B3C5D]', border: 'border-[rgba(11,60,93,0.20)]' },
        { bg: 'bg-[rgba(78,205,196,0.10)] dark:bg-[rgba(78,205,196,0.10)]/40', text: 'text-[#4ECDC4] dark:text-[#4ECDC4]', border: 'border-[rgba(78,205,196,0.25)]' },
    ];
    const colors = labelColors[index] || labelColors[0];

    // Extract just the question part (before options)
    const questionText = subQuestion.text.split(/\s*[A-D]\)/).at(0)?.trim() || subQuestion.text;

    return (
        <div className={`
      rounded-xl border-2 overflow-hidden transition-all
      ${selectedOption
                ? `${colors.border} shadow-sm`
                : isDarkMode ? 'border-gray-700' : 'border-gray-200'
            }
    `}>
            {/* Sub-question header */}
            <div className={`px-4 py-2 flex items-center gap-2 ${colors.bg}`}>
                <span className={`text-xs font-bold uppercase tracking-wider ${colors.text}`}>
                    Q{index + 1}. {subQuestion.label}
                </span>
                {selectedOption && (
                    <svg className="w-4 h-4 text-emerald-500 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                )}
            </div>

            {/* Question text */}
            <div className={`px-4 pt-3 pb-2 ${isDarkMode ? 'bg-gray-800/50' : 'bg-white'}`}>
                <p className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                    {questionText}
                </p>

                {/* Options */}
                <div className="space-y-2 pb-3">
                    {subQuestion.options.map((opt: QuestionOption) => {
                        const isSelected = selectedOption === opt.id;
                        return (
                            <button
                                key={opt.id}
                                onClick={() => onSelect(opt.id)}
                                className={`
                  w-full text-left px-3 py-2.5 rounded-lg border transition-all duration-150 text-sm
                  ${isSelected
                                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 font-medium'
                                        : isDarkMode
                                            ? 'border-gray-700 bg-gray-800/30 hover:border-gray-500 hover:bg-gray-700/30'
                                            : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100'
                                    }
                `}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`
                    flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center
                    text-xs font-bold transition-all
                    ${isSelected
                                            ? 'border-emerald-500 bg-emerald-500 text-white'
                                            : isDarkMode ? 'border-gray-600 text-gray-400' : 'border-gray-300 text-gray-500'
                                        }
                  `}>
                                        {opt.id}
                                    </div>
                                    <span className={isDarkMode ? 'text-gray-200' : 'text-gray-700'}>
                                        {opt.text}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
