import { Screen } from '../../App';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Trophy, TrendingUp, Brain, Sparkles, Home } from 'lucide-react';

interface Props {
  onNavigate: (s: Screen) => void;
}

export function SessionRecorded({ onNavigate }: Props) {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <main className="px-4 py-8 max-w-lg mx-auto">
        <div className="text-center mb-8">
          <div className="relative mx-auto h-24 w-24 mb-6">
            <div className="absolute inset-0 rounded-full bg-[#4ECDC4] animate-pulse" />
            <div className="absolute inset-2 rounded-full bg-gray-900 flex items-center justify-center">
              <CheckCircle className="h-12 w-12 text-[#4ECDC4]" />
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-amber-400 mb-4">
            <Sparkles className="h-5 w-5" />
            <Trophy className="h-6 w-6" />
            <Sparkles className="h-5 w-5" />
          </div>

          <h1 className="text-2xl font-bold mb-2">Assessment Complete!</h1>
          <p className="text-gray-400">
            Your behavioural insights have been recorded and are being analyzed.
          </p>
        </div>

        <Card className="bg-[#0B3C5D]/30/30 border-[#0B3C5D]/50 mb-6">
          <CardContent className="p-4">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <Brain className="h-5 w-5 text-[#4ECDC4]" />
              Session Summary
            </h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-white" data-testid="tasks-completed">5</p>
                <p className="text-xs text-gray-400">Tasks Completed</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-white" data-testid="time-spent">18:32</p>
                <p className="text-xs text-gray-400">Time Spent</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-[#4ECDC4]" data-testid="focus-score">87%</p>
                <p className="text-xs text-gray-400">Focus Score</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-[#0B3C5D]" data-testid="pattern-score">92%</p>
                <p className="text-xs text-gray-400">Pattern Recognition</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700 mb-6">
          <CardContent className="p-4 space-y-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[#4ECDC4]" />
              What's Next?
            </h3>
            
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3 text-gray-300">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#4ECDC4] text-xs text-white shrink-0 mt-0.5">1</span>
                <span>Your results are being analyzed by our AI system to identify your unique learning patterns</span>
              </li>
              <li className="flex items-start gap-3 text-gray-300">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0B3C5D] text-xs text-white shrink-0 mt-0.5">2</span>
                <span>Detailed insights will be available within 24-48 hours in your Learning Behaviour tab</span>
              </li>
              <li className="flex items-start gap-3 text-gray-300">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(11,60,93,0.08)] text-xs text-white shrink-0 mt-0.5">3</span>
                <span>Your parent/guardian will also receive a summary if consent was provided</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-teal-900/30 border-teal-600/50 mb-8">
          <CardContent className="p-4">
            <p className="text-sm text-teal-200">
              <strong className="text-teal-100">Did you know?</strong> Regular behavioural assessments help us understand how your learning style evolves over time, 
              leading to more personalized study recommendations.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Button 
            className="w-full h-12 bg-[#4ECDC4] hover:bg-[#4ECDC4]/90"
            onClick={() => onNavigate('student-exam-list')}
            data-testid="button-back-to-exams"
          >
            <Home className="mr-2 h-5 w-5" />
            Back to Dashboard
          </Button>
          
          <Button 
            variant="outline"
            className="w-full h-12 border-gray-600 text-gray-300 hover:bg-gray-800"
            onClick={() => onNavigate('student-consent-explainer')}
            data-testid="button-view-insights"
          >
            View My Learning Profile
          </Button>
        </div>
      </main>
    </div>
  );
}
