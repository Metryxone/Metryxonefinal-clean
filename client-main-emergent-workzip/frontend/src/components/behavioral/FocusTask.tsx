import { useState, useEffect } from 'react';
import { Screen } from '../../App';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target, ArrowRight, Timer } from 'lucide-react';

interface Props {
  onNavigate: (s: Screen) => void;
}

export function FocusTask({ onNavigate }: Props) {
  const [clickCount, setClickCount] = useState(0);
  const [targets, setTargets] = useState<{id: number; x: number; y: number; active: boolean}[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);
  const progress = 40;
  const targetGoal = 10;

  const generateTarget = () => {
    const newTarget = {
      id: Date.now(),
      x: Math.random() * 70 + 10,
      y: Math.random() * 70 + 10,
      active: true,
    };
    setTargets(prev => [...prev.filter(t => t.active), newTarget]);
  };

  useEffect(() => {
    if (!gameStarted) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const targetInterval = setInterval(generateTarget, 1200);

    return () => {
      clearInterval(timer);
      clearInterval(targetInterval);
    };
  }, [gameStarted]);

  const handleTargetClick = (id: number) => {
    setTargets(prev => prev.map(t => t.id === id ? {...t, active: false} : t));
    setClickCount(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Task 2 of 5</span>
            <span className="text-sm text-[#4ECDC4]">{progress}% Complete</span>
          </div>
          <Progress value={progress} className="h-2 bg-gray-700" />
        </div>
      </header>

      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        <Card className="bg-orange-900/50/50 border-orange-600/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-orange-300 mb-2">
              <Target className="h-5 w-5" />
              <span className="font-medium">Focus & Attention</span>
            </div>
            <p className="text-gray-300 text-sm">
              Tap the green circles as quickly as possible when they appear!
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-3 text-center">
              <Timer className="h-5 w-5 mx-auto mb-1 text-blue-400" />
              <p className="text-2xl font-bold text-white" data-testid="time-left">{timeLeft}s</p>
              <p className="text-xs text-gray-400">Time Left</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-3 text-center">
              <Target className="h-5 w-5 mx-auto mb-1 text-[#4ECDC4]" />
              <p className="text-2xl font-bold text-white" data-testid="score">{clickCount}/{targetGoal}</p>
              <p className="text-xs text-gray-400">Targets Hit</p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-0">
            <div 
              className="relative h-64 bg-gray-900 rounded-lg overflow-hidden"
              data-testid="game-area"
            >
              {!gameStarted ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Button
                    onClick={() => {
                      setGameStarted(true);
                      generateTarget();
                    }}
                    className="bg-[#4ECDC4] hover:bg-[#4ECDC4]/90 h-12 px-8"
                    data-testid="button-start-game"
                  >
                    Start Game
                  </Button>
                </div>
              ) : timeLeft === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-xl font-bold text-[#4ECDC4] mb-2">Time's Up!</p>
                  <p className="text-gray-400">You hit {clickCount} targets</p>
                </div>
              ) : (
                targets.filter(t => t.active).map((target) => (
                  <button
                    key={target.id}
                    onClick={() => handleTargetClick(target.id)}
                    className="absolute w-12 h-12 rounded-full bg-[#4ECDC4] hover:bg-[#4ECDC4]/80 transition-all animate-pulse shadow-lg shadow-[#4ECDC4]/30"
                    style={{ 
                      left: `${target.x}%`, 
                      top: `${target.y}%`,
                      transform: 'translate(-50%, -50%)'
                    }}
                    data-testid={`target-${target.id}`}
                  />
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {(timeLeft === 0 || clickCount >= targetGoal) && (
          <div className="pt-4">
            <Button 
              className="w-full h-12 bg-[#4ECDC4] hover:bg-[#4ECDC4]/90"
              onClick={() => onNavigate('reflection-screen')}
              data-testid="button-next"
            >
              Continue
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
