import { Check } from 'lucide-react';

interface Step {
  id: string;
  label: string;
}

interface Props {
  steps: Step[];
  currentStep: number;
}

export function Stepper({ steps, currentStep }: Props) {
  return (
    <div className="flex items-center justify-center w-full">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div className="flex flex-col items-center">
            <div 
              className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                index < currentStep
                  ? 'bg-[#4ECDC4] text-white'
                  : index === currentStep
                    ? 'bg-[#0B3C5D] text-white'
                    : 'bg-gray-200 text-gray-500'
              }`}
            >
              {index < currentStep ? (
                <Check size={16} />
              ) : (
                index + 1
              )}
            </div>
            <span className={`text-xs mt-1 ${
              index <= currentStep ? 'text-[#0B3C5D] font-medium' : 'text-gray-400'
            }`}>
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div 
              className={`w-12 md:w-24 h-0.5 mx-2 ${
                index < currentStep ? 'bg-[#4ECDC4]' : 'bg-gray-200'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
