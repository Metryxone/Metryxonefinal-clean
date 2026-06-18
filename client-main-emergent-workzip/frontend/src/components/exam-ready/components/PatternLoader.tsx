import { useState, useEffect } from 'react';
import { configService } from '../services/apiClient';
import type { AssessmentConfig } from '../types';

interface PatternLoaderProps {
    children: (props: {
        config: AssessmentConfig;
        loading: boolean;
        error: string | null;
        reload: () => void;
    }) => React.ReactNode;
}

/**
 * PatternLoader: Fetches assessment config from the API on mount.
 * Uses render-props pattern so any child can consume the config.
 * 
 * Usage:
 *   <PatternLoader>
 *     {({ config, loading, error }) => (
 *       <YourComponent domains={config.domains} />
 *     )}
 *   </PatternLoader>
 */
export function PatternLoader({ children }: PatternLoaderProps) {
    const [config, setConfig] = useState<AssessmentConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchConfig = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await configService.getConfig();
            setConfig(data);
        } catch (err: any) {
            console.error('[PatternLoader] Failed to load config:', err);
            setError(err?.message || 'Failed to load assessment configuration');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConfig();
    }, []);

    // Loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[200px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Loading assessment patterns...
                    </p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="flex items-center justify-center min-h-[200px]">
                <div className="text-center space-y-4 p-6 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 max-w-md">
                    <div className="text-red-500 text-4xl">⚠️</div>
                    <p className="text-red-700 dark:text-red-300 font-medium">
                        Failed to load configuration
                    </p>
                    <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                    <button
                        onClick={fetchConfig}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    // Empty state
    if (!config || (!config.domains.length && !config.totalQuestions)) {
        return (
            <div className="flex items-center justify-center min-h-[200px]">
                <div className="text-center space-y-3 p-6">
                    <div className="text-gray-400 text-4xl">📋</div>
                    <p className="text-gray-500 dark:text-gray-400 font-medium">
                        No assessment patterns configured yet
                    </p>
                    <p className="text-gray-400 dark:text-gray-500 text-sm">
                        Add questions to the database to see available patterns
                    </p>
                </div>
            </div>
        );
    }

    return <>{children({ config, loading, error, reload: fetchConfig })}</>;
}

// ─── Hook version for flexible use ───
export function useAssessmentConfig() {
    const [config, setConfig] = useState<AssessmentConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchConfig = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await configService.getConfig();
            setConfig(data);
        } catch (err: any) {
            console.error('[useAssessmentConfig] Failed to load config:', err);
            setError(err?.message || 'Failed to load assessment configuration');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConfig();
    }, []);

    return { config, loading, error, reload: fetchConfig };
}
