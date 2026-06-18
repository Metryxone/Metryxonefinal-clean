import { useEffect, useState } from 'react';
import { Screen } from '../../App';
import { Sparkles, Brain } from 'lucide-react';

interface Props {
  onNavigate: (s: Screen) => void;
}

export function ContextTransition({ onNavigate }: Props) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onNavigate('focus-task');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onNavigate]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="text-center px-6 max-w-md">
        <div className="relative mx-auto h-32 w-32 mb-8">
          <div className="absolute inset-0 rounded-full bg-[#0B3C5D] animate-pulse" />
          <div className="absolute inset-4 rounded-full bg-gray-900 flex items-center justify-center">
            <Brain className="h-12 w-12 text-[#4ECDC4]" />
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-[#4ECDC4] mb-4">
          <Sparkles className="h-5 w-5" />
          <span className="text-sm font-medium uppercase tracking-wider">Great Progress!</span>
          <Sparkles className="h-5 w-5" />
        </div>

        <h2 className="text-2xl font-bold mb-4">
          Task 1 Complete
        </h2>

        <p className="text-gray-400 mb-8">
          You showed strong pattern recognition skills. Now let's explore your focus and attention.
        </p>

        <div className="space-y-2">
          <p className="text-gray-500 text-sm">Next task starting in</p>
          <div className="text-5xl font-bold text-[#4ECDC4]" data-testid="countdown">
            {countdown}
          </div>
        </div>

        <div className="mt-12 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((step) => (
            <div
              key={step}
              className={`h-2 w-8 rounded-full ${
                step <= 1 ? 'bg-[#4ECDC4]' : 'bg-gray-700'
              }`}
              data-testid={`progress-step-${step}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
