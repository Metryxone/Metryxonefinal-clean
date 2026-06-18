import { ArrowLeft, Home } from 'lucide-react';
import { Button } from "@/components/ui/button";
import logoLight from '@/assets/logo-light.jpg';

const brand = {
  primary: '#1F3C88',
  accent: '#2EC4B6',
};

interface Props {
  showBack?: boolean;
  onBack?: () => void;
  title?: string;
  showDashboardLink?: boolean;
  onDashboard?: () => void;
}

export function ExamReadyHeader({ showBack, onBack, title, showDashboardLink, onDashboard }: Props) {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100 px-4 py-2 font-['Inter',sans-serif]">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          {showBack && onBack && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onBack}
              className="text-gray-500 hover:text-gray-900 h-7 w-7"
              data-testid="btn-back"
            >
              <ArrowLeft size={16} />
            </Button>
          )}
          <img src={logoLight} alt="MetryxOne" className="h-7 w-auto" data-testid="header-logo" />
          {title && (
            <>
              <span className="text-gray-200 mx-1.5 text-sm">/</span>
              <span className="font-medium text-xs" style={{ color: brand.primary }}>{title}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showDashboardLink && onDashboard && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onDashboard}
              className="text-[11px] h-7 px-2 text-gray-500 hover:text-gray-900"
              data-testid="btn-dashboard"
            >
              <Home size={12} className="mr-1" />
              Dashboard
            </Button>
          )}
          <span className="text-[10px] px-2 py-1 rounded font-semibold tracking-wide" style={{ backgroundColor: `${brand.accent}15`, color: brand.accent }}>
            ExamReadiness Index™
          </span>
        </div>
      </div>
    </header>
  );
}
