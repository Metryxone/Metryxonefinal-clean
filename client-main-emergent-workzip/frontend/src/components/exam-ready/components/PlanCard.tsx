import { Check, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ExamReadyPlan } from '../types';

interface Props {
  plan: ExamReadyPlan;
  selected?: boolean;
  onSelect: (planId: string) => void;
}

export function PlanCard({ plan, selected, onSelect }: Props) {
  return (
    <Card 
      className={`relative cursor-pointer transition-all ${
        selected 
          ? 'border-[#4ECDC4] ring-2 ring-[#4ECDC4]/20' 
          : plan.recommended 
            ? 'border-[#0B3C5D]' 
            : 'border-gray-200 hover:border-gray-300'
      }`}
      onClick={() => onSelect(plan.id)}
      data-testid={`plan-card-${plan.id}`}
    >
      {plan.recommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-[#4ECDC4] text-white">
            <Star size={12} className="mr-1" />
            Recommended
          </Badge>
        </div>
      )}
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span className="text-lg font-bold text-[#0B3C5D]">{plan.name}</span>
          {selected && (
            <div className="h-6 w-6 rounded-full bg-[#4ECDC4] flex items-center justify-center">
              <Check size={14} className="text-white" />
            </div>
          )}
        </CardTitle>
        <p className="text-sm text-gray-500">{plan.description}</p>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <span className="text-3xl font-bold text-[#0B3C5D]">₹{plan.price}</span>
          <span className="text-gray-500 text-sm ml-1">/ {plan.duration}</span>
        </div>
        <ul className="space-y-2">
          {plan.features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm">
              <Check size={16} className="text-[#4ECDC4] shrink-0 mt-0.5" />
              <span className="text-gray-700">{feature}</span>
            </li>
          ))}
        </ul>
        <Button 
          className={`w-full mt-4 ${
            selected 
              ? 'bg-[#4ECDC4] hover:bg-[#4ECDC4]/90' 
              : 'bg-[#0B3C5D] hover:bg-[#0B3C5D]/90'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(plan.id);
          }}
        >
          {selected ? 'Selected' : 'Select Plan'}
        </Button>
      </CardContent>
    </Card>
  );
}
