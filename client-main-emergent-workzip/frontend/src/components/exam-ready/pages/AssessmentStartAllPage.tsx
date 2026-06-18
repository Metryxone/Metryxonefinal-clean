import { useState, useCallback } from 'react';
import { Loader2, Zap, ArrowRight } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExamReadyHeader } from '../components/ExamReadyHeader';

const API_BASE = '/api/v1';

interface Props {
    planId?: string;
    board?: string;
    grade?: string;
    childId?: string;
    childName?: string;
    totalQuestions?: number;
    onNavigate: (screen: string, data?: Record<string, unknown>) => void;
}

const SUBDOMAIN_INFO: Record<string, { icon: string; label: string; color: string }> = {
    ACE_SD02: { icon: '📊', label: 'Learning Efficiency', color: 'bg-blue-500' },
    ACE_SD03: { icon: '📖', label: 'Conceptual Understanding', color: 'bg-emerald-500' },
    ACE_SD04: { icon: '🧠', label: 'Memory Efficiency', color: 'bg-[rgba(11,60,93,0.08)]' },
    ACE_SD05: { icon: '🎯', label: 'Task Attention', color: 'bg-amber-500' },
    ACE_SD06: { icon: '📝', label: 'Learning Strategy', color: 'bg-rose-500' },
};

const NUM_SUBDOMAINS = Object.keys(SUBDOMAIN_INFO).length; // 5

export function AssessmentStartAllPage({ planId, board, grade, childId, childName, totalQuestions: totalQuestionsProp, onNavigate }: Props) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Derive per-subdomain count from total questions (default 80 for ₹999 plan)
    const targetTotal = totalQuestionsProp && totalQuestionsProp > 0 ? totalQuestionsProp : 80;
    const perSubdomain = Math.ceil(targetTotal / NUM_SUBDOMAINS);

    const handleStart = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const resp = await fetch(`${API_BASE}/assessment/start-all`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    domain_code: 'ACE',
                    per_subdomain: perSubdomain,
                    plan_id: planId,
                    board,
                    grade,
                    child_id: childId,
                    student_name: childName,
                }),
            });
            if (!resp.ok) {
                const data = await resp.json().catch(() => ({}));
                throw new Error(data.message || `Failed (${resp.status})`);
            }
            const data = await resp.json();
            const attemptId = data.id || data.attemptId;
            if (!attemptId) throw new Error('Attempt ID missing from response');
            onNavigate('exam-ready-assessment', { attemptId });
        } catch (err: any) {
            setError(err.message || 'Failed to start assessment');
        } finally {
            setLoading(false);
        }
    }, [perSubdomain, planId, board, grade, childId, childName, onNavigate]);

    return (
        <div className="min-h-screen bg-[#0B1D2E] text-white">
            <ExamReadyHeader onNavigate={onNavigate} />

            <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
                {/* Title */}
                <div className="text-center">
                    <div className="text-4xl mb-3">🔬</div>
                    <h1 className="text-2xl font-bold text-white">Complete Assessment</h1>
                    <p className="text-gray-400 mt-2">
                        Test all cognitive areas in one combined session
                    </p>
                </div>

                {/* Subdomain cards */}
                <Card className="bg-[#0f2641]/80 border-[#1a3a5c]">
                    <CardContent className="p-5 space-y-4">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Zap size={18} className="text-amber-400" />
                            Includes {perSubdomain} questions from each:
                        </h2>

                        <div className="space-y-2">
                            {Object.entries(SUBDOMAIN_INFO).map(([code, info]) => (
                                <div key={code} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                                    <span className="text-2xl">{info.icon}</span>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-white">{info.label}</p>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold text-white ${info.color}`}>
                                        {perSubdomain}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Total questions info */}

                        <div className="pt-1 flex items-center gap-2 text-xs text-gray-500">
                            <span>Total:</span>
                            <span className="font-bold text-white text-sm">
                                {Object.keys(SUBDOMAIN_INFO).length * perSubdomain} questions
                            </span>
                            <span>· ~{Math.round(Object.keys(SUBDOMAIN_INFO).length * perSubdomain * 0.5)} min</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Error */}
                {error && (
                    <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-300 text-sm">
                        {error}
                    </div>
                )}

                {/* Start button */}
                <Button
                    onClick={handleStart}
                    disabled={loading}
                    className="w-full py-6 text-lg bg-indigo-500 hover:bg-indigo-600 hover: text-white font-bold rounded-xl shadow-xl shadow-[rgba(11,60,93,0.25)] transition-all active:scale-[0.98]"
                >
                    {loading ? (
                        <span className="flex items-center gap-2">
                            <Loader2 size={20} className="animate-spin" />
                            Preparing assessment...
                        </span>
                    ) : (
                        <span className="flex items-center gap-2">
                            Begin Mixed Assessment
                            <ArrowRight size={20} />
                        </span>
                    )}
                </Button>

                {/* Back link */}
                <button
                    onClick={() => onNavigate('exam-ready-assessment-start')}
                    className="block mx-auto text-sm text-gray-500 hover:text-gray-300 transition-colors"
                >
                    ← Back to filtered assessment
                </button>
            </div>
        </div>
    );
}
