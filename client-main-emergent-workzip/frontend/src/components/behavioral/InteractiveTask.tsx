import { useState } from 'react';
import { Screen } from '../../App';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Lightbulb, ArrowRight } from 'lucide-react';

interface Props {
  onNavigate: (s: Screen) => void;
}

export function InteractiveTask({ onNavigate }: Props) {
  const [selectedPattern, setSelectedPattern] = useState<number | null>(null);
  const [selectedApproach, setSelectedApproach] = useState<number | null>(null);
  const progress = 20;

  const options = ['🔴', '🔵', '🟢', '🟡'];
  const approaches = ['Looking at the whole pattern', 'Breaking it into parts', 'Testing each option', 'Going with intuition'];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Task 1 of 5</span>
            <span className="text-sm text-[#4ECDC4]">{progress}% Complete</span>
          </div>
          <Progress value={progress} className="h-2 bg-gray-700" />
        </div>
      </header>

      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        <Card className="bg-purple-900/50/50 border-[rgba(11,60,93,0.20)]/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[#0B3C5D] mb-2">
              <Lightbulb className="h-5 w-5" />
              <span className="font-medium">Pattern Recognition</span>
            </div>
            <p className="text-gray-300 text-sm">
              Look at the pattern below. What comes next?
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-center gap-3 text-4xl mb-8">
              <span>🔴</span>
              <span>🔵</span>
              <span>🔴</span>
              <span>🔵</span>
              <span className="text-3xl bg-gray-700 rounded-lg px-4 py-2 border-2 border-dashed border-gray-500">?</span>
            </div>

            <p className="text-gray-400 mb-4">Select your answer:</p>
            
            <div className="grid grid-cols-4 gap-3">
              {options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedPattern(idx)}
                  className={`h-16 text-3xl rounded-xl transition-all ${
                    selectedPattern === idx 
                      ? 'bg-[#4ECDC4] scale-105 shadow-lg shadow-[#4ECDC4]/30' 
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                  data-testid={`option-${idx}`}
                >
                  {option}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <h4 className="font-medium text-white mb-2">How are you approaching this?</h4>
            <div className="space-y-2">
              {approaches.map((approach, idx) => (
                <Button 
                  key={idx}
                  variant="outline"
                  onClick={() => setSelectedApproach(idx)}
                  className={`w-full justify-start text-left h-auto py-3 ${
                    selectedApproach === idx
                      ? 'bg-[#4ECDC4] border-[#4ECDC4] text-white'
                      : 'border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                  data-testid={`approach-${idx}`}
                >
                  {approach}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="pt-4">
          <Button 
            className="w-full h-12 bg-[#4ECDC4] hover:bg-[#4ECDC4]/90"
            onClick={() => onNavigate('context-transition')}
            disabled={selectedPattern === null}
            data-testid="button-next"
          >
            Continue
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </main>
    </div>
  );
}
