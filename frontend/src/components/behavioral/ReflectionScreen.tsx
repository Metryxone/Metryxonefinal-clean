import { useState } from 'react';
import { Screen } from '../../App';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, ArrowRight, ThumbsUp, ThumbsDown, Meh } from 'lucide-react';

interface Props {
  onNavigate: (s: Screen) => void;
}

export function ReflectionScreen({ onNavigate }: Props) {
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [reflection, setReflection] = useState('');
  const progress = 80;

  const moods = [
    { icon: ThumbsDown, label: 'Challenging', color: 'text-red-400 hover:bg-red-500/20' },
    { icon: Meh, label: 'Okay', color: 'text-yellow-400 hover:bg-yellow-500/20' },
    { icon: ThumbsUp, label: 'Easy', color: 'text-teal-400 hover:bg-teal-500/20' },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Task 4 of 5</span>
            <span className="text-sm text-[#4ECDC4]">{progress}% Complete</span>
          </div>
          <Progress value={progress} className="h-2 bg-gray-700" />
        </div>
      </header>

      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        <Card className="bg-blue-900/50/50 border-blue-600/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-blue-300 mb-2">
              <MessageCircle className="h-5 w-5" />
              <span className="font-medium">Self Reflection</span>
            </div>
            <p className="text-gray-300 text-sm">
              Take a moment to think about your experience so far.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-4 space-y-4">
            <h3 className="font-medium text-white">How did you find the tasks so far?</h3>
            
            <div className="grid grid-cols-3 gap-3">
              {moods.map((mood, idx) => {
                const Icon = mood.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedMood(idx)}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      selectedMood === idx
                        ? 'border-[#4ECDC4] bg-[#4ECDC4]/20'
                        : 'border-gray-600 bg-gray-700/50'
                    } ${mood.color}`}
                    data-testid={`mood-${idx}`}
                  >
                    <Icon className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm text-gray-300">{mood.label}</p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-4 space-y-4">
            <h3 className="font-medium text-white">What helped you the most?</h3>
            
            <div className="space-y-2">
              {[
                'Taking my time to think',
                'Going with my first instinct',
                'Breaking problems into steps',
                'Staying calm and focused'
              ].map((option, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  className="w-full justify-start text-left border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white h-auto py-3"
                  data-testid={`strategy-${idx}`}
                >
                  {option}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-medium text-white">Any thoughts to share? (Optional)</h3>
            <Textarea
              placeholder="How did you feel during the activities? What was interesting?"
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 min-h-[100px]"
              data-testid="textarea-reflection"
            />
          </CardContent>
        </Card>

        <div className="pt-4">
          <Button 
            className="w-full h-12 bg-[#4ECDC4] hover:bg-[#4ECDC4]/90"
            onClick={() => onNavigate('session-recorded')}
            disabled={selectedMood === null}
            data-testid="button-finish"
          >
            Complete Assessment
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </main>
    </div>
  );
}
