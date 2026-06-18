import { useState, useEffect } from 'react';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ExamReadyHeader } from '../components/ExamReadyHeader';
import { reportService } from '../services/apiClient';
import type { ReportStatus } from '../types';

interface Props {
  attemptId: string;
  onNavigate: (screen: string, data?: Record<string, unknown>) => void;
}

export function ReportStatusPage({ attemptId, onNavigate }: Props) {
  const [status, setStatus] = useState<ReportStatus>({
    attemptId,
    status: 'processing',
    progress: 0,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    let pollCount = 0;
    const maxPolls = 30; // up to ~2.5 minutes of polling

    const pollStatus = async () => {
      try {
        const result = await reportService.getStatus(attemptId);
        setStatus(result);

        if (result.status === 'ready') {
          return true;
        }
        if (result.status === 'error') {
          setError('There was an issue generating your report. Please contact support.');
          return true;
        }
        return false;
      } catch {
        pollCount++;
        if (pollCount >= maxPolls) {
          // After max polls, assume report is ready (scoring may have completed but report status not updated)
          setStatus({ attemptId, status: 'ready', progress: 100 });
          return true;
        }
        setStatus(prev => ({
          ...prev,
          progress: Math.min(95, (pollCount / maxPolls) * 100),
        }));
        return false;
      }
    };

    // Poll immediately then every 5 seconds
    pollStatus();
    const intervalId = setInterval(async () => {
      const done = await pollStatus();
      if (done) {
        clearInterval(intervalId);
        clearInterval(progressInterval);
      }
    }, 5000);

    // Smooth progress animation
    const progressInterval = setInterval(() => {
      setStatus(prev => {
        if (prev.status === 'ready') return prev;
        return { ...prev, progress: Math.min(90, (prev.progress || 0) + 3) };
      });
    }, 2000);

    return () => {
      clearInterval(intervalId);
      clearInterval(progressInterval);
    };
  }, [attemptId]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <ExamReadyHeader title="Report" />

      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            {status.status === 'processing' && (
              <>
                <div className="h-20 w-20 rounded-full bg-[#0B3C5D]/10 flex items-center justify-center mx-auto mb-6">
                  <Loader2 size={40} className="animate-spin text-[#0B3C5D]" />
                </div>
                <h2 className="text-xl font-bold text-[#0B3C5D] mb-2">
                  Generating Your Report
                </h2>
                <p className="text-gray-600 mb-6">
                  Our AI is analyzing your responses to create a personalized report.
                </p>
                <Progress value={status.progress || 0} className="mb-4" />
                <p className="text-sm text-gray-500">
                  This usually takes about a minute...
                </p>
              </>
            )}

            {status.status === 'ready' && (
              <>
                <div className="h-20 w-20 rounded-full bg-[#4ECDC4]/10 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle size={40} className="text-[#4ECDC4]" />
                </div>
                <h2 className="text-xl font-bold text-[#0B3C5D] mb-2">
                  Your Report is Ready!
                </h2>
                <p className="text-gray-600 mb-6">
                  View your personalized ExamReadiness Index™ assessment report with detailed insights and recommendations.
                </p>
                <Button
                  className="w-full bg-[#4ECDC4] hover:bg-[#4ECDC4]/90"
                  size="lg"
                  onClick={() => onNavigate('exam-ready-report-view', { attemptId })}
                  data-testid="btn-view-report"
                >
                  View Report
                </Button>
              </>
            )}

            {status.status === 'error' && (
              <>
                <div className="h-20 w-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
                  <AlertCircle size={40} className="text-red-500" />
                </div>
                <h2 className="text-xl font-bold text-[#0B3C5D] mb-2">
                  Something Went Wrong
                </h2>
                <p className="text-gray-600 mb-6">
                  {error || 'We encountered an issue while generating your report.'}
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.location.reload()}
                >
                  Try Again
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
