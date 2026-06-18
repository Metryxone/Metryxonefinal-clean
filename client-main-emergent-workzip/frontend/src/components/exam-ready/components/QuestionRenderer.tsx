import { useState } from 'react';
import type { AssessmentQuestion, QuestionOption } from '../types';
import { PassageMCQRenderer } from './PassageMCQRenderer';
import { WordRecallRenderer } from './WordRecallRenderer';
import { AttentionClickRenderer } from './AttentionClickRenderer';
import { LearningStrategyRenderer } from './LearningStrategyRenderer';

// ─── Renderer Registry ───
// Maps question_type → renderer component.
// Add new types here — no changes needed elsewhere.
type RendererProps = {
    question: AssessmentQuestion;
    selectedAnswer: string | number | null;
    onAnswer: (questionId: string, answer: string | number) => void;
    isDarkMode?: boolean;
};

// ─── Likert Scale Renderer ───
function LikertRenderer({ question, selectedAnswer, onAnswer, isDarkMode }: RendererProps) {
    return (
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
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-md'
                                : isDarkMode
                                    ? 'border-gray-700 bg-gray-800/50 hover:border-gray-500 hover:bg-gray-700/50'
                                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                            }
            `}
                        data-testid={`option-${option.id}`}
                    >
                        <div className="flex items-center gap-4">
                            <div className={`
                flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center
                text-sm font-bold transition-all
                ${isSelected
                                    ? 'border-blue-500 bg-blue-500 text-white'
                                    : isDarkMode
                                        ? 'border-gray-600 text-gray-400'
                                        : 'border-gray-300 text-gray-500'
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
    );
}

// ─── MCQ Renderer ───
function MCQRenderer({ question, selectedAnswer, onAnswer, isDarkMode }: RendererProps) {
    return (
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
                                    ? 'border-gray-700 bg-gray-800/50 hover:border-gray-500 hover:bg-gray-700/50'
                                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                            }
            `}
                        data-testid={`option-${option.id}`}
                    >
                        <div className="flex items-center gap-4">
                            <div className={`
                flex-shrink-0 w-10 h-10 rounded-lg border-2 flex items-center justify-center
                text-sm font-bold transition-all
                ${isSelected
                                    ? 'border-emerald-500 bg-emerald-500 text-white'
                                    : isDarkMode
                                        ? 'border-gray-600 text-gray-400'
                                        : 'border-gray-300 text-gray-500'
                                }
              `}>
                                {option.id.toUpperCase()}
                            </div>
                            <span className={`text-base ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                                {option.text}
                            </span>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

// ─── Text Input Renderer (for future use) ───
function TextRenderer({ question, selectedAnswer, onAnswer, isDarkMode }: RendererProps) {
    const [value, setValue] = useState((selectedAnswer as string) || '');

    return (
        <div className="space-y-3">
            <textarea
                value={value}
                onChange={(e) => {
                    setValue(e.target.value);
                    onAnswer(question.id, e.target.value);
                }}
                placeholder="Type your answer here..."
                rows={5}
                className={`
          w-full p-4 rounded-xl border-2 transition-all duration-200 resize-none
          ${isDarkMode
                        ? 'border-gray-700 bg-gray-800/50 text-gray-200 placeholder-gray-500 focus:border-blue-500'
                        : 'border-gray-200 bg-white text-gray-700 placeholder-gray-400 focus:border-blue-500'
                    }
          focus:outline-none focus:ring-2 focus:ring-blue-500/20
        `}
                data-testid="text-answer"
            />
            <p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                {value.length} characters
            </p>
        </div>
    );
}

// ─── Renderer Registry ───
const RENDERERS: Record<string, React.FC<RendererProps>> = {
    likert: LikertRenderer,
    mcq: MCQRenderer,
    text: TextRenderer,
    passage_mcq: PassageMCQRenderer,
    word_recall: WordRecallRenderer,
    attention_click: AttentionClickRenderer,
    learning_strategy: LearningStrategyRenderer,
    // Add future types here:
};

// ─── Main QuestionRenderer Component ───
interface QuestionRendererProps {
    question: AssessmentQuestion;
    questionNumber: number;
    totalQuestions: number;
    selectedAnswer: string | number | null;
    onAnswer: (questionId: string, answer: string | number) => void;
    isDarkMode?: boolean;
}

export function QuestionRenderer({
    question,
    questionNumber,
    totalQuestions,
    selectedAnswer,
    onAnswer,
    isDarkMode = false,
}: QuestionRendererProps) {
    const Renderer = RENDERERS[question.type] || LikertRenderer;
    const isPassageMCQ = question.type === 'passage_mcq';
    const isSelfContained = question.type === 'passage_mcq' || question.type === 'word_recall' || question.type === 'attention_click' || question.type === 'learning_strategy';

    // Friendly label for question type badge
    const typeLabel: Record<string, string> = {
        passage_mcq: 'Reading Comprehension',
        word_recall: 'Memory Test',
        attention_click: 'Attention Test',
        learning_strategy: 'Learning Strategy',
        likert: 'Self Assessment',
        mcq: 'Multiple Choice',
        text: 'Written Response',
    };

    return (
        <div className="space-y-6" data-testid="question-renderer">
            {/* Question header */}
            <div className="space-y-2">
                <div className="flex items-center gap-3">
                    <span className={`
            inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider
            ${isDarkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700'}
          `}>
                        {typeLabel[question.type] || question.type}
                    </span>
                    <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {isPassageMCQ ? `Passage ${questionNumber} of ${totalQuestions}` : `Question ${questionNumber} of ${totalQuestions}`}
                    </span>
                </div>

                {/* Category / Subcategory label */}
                {(question.category || question.subcategory) && (
                    <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {question.category}
                        {question.subcategory && ` › ${question.subcategory}`}
                    </p>
                )}
            </div>

            {/* Passage text (if any, but skip for self-contained renderers) */}
            {question.passageText && !isSelfContained && (
                <div className={`
          p-4 rounded-xl border-l-4 border-amber-400
          ${isDarkMode ? 'bg-amber-900/20 text-gray-300' : 'bg-amber-50 text-gray-700'}
        `}>
                    <p className="text-sm italic">{question.passageText}</p>
                </div>
            )}

            {/* Question text — skip for self-contained renderers */}
            {!isSelfContained && (
                <h2 className={`text-xl font-semibold leading-relaxed ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {question.text}
                </h2>
            )}

            {/* Dynamic renderer based on question type */}
            <Renderer
                question={question}
                selectedAnswer={selectedAnswer}
                onAnswer={onAnswer}
                isDarkMode={isDarkMode}
            />
        </div>
    );
}
