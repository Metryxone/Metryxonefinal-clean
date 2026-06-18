import { Clock, AlertTriangle } from 'lucide-react';

interface Props {
  timeRemaining: number;
  maxTime: number;
}

export function Timer({ timeRemaining, maxTime }: Props) {
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const progress = (timeRemaining / maxTime) * 100;
  const isLow = timeRemaining < 300;
  const isCritical = timeRemaining < 120;

  const formatTime = (num: number) => num.toString().padStart(2, '0');

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
      isCritical 
        ? 'bg-red-100 text-red-600' 
        : isLow 
          ? 'bg-amber-100 text-amber-600' 
          : 'bg-gray-100 text-gray-700'
    }`}>
      {isCritical ? (
        <AlertTriangle size={16} className="animate-pulse" />
      ) : (
        <Clock size={16} />
      )}
      <span className="font-mono font-medium">
        {formatTime(minutes)}:{formatTime(seconds)}
      </span>
      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all ${
            isCritical 
              ? 'bg-red-500' 
              : isLow 
                ? 'bg-amber-500' 
                : 'bg-[#4ECDC4]'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
