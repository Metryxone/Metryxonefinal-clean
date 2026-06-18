import { Screen } from '../App';
import { Button } from "@/components/ui/button";

interface ScreenNavigatorProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
}

export function ScreenNavigator({ currentScreen, onNavigate }: ScreenNavigatorProps) {
  if (process.env.NODE_ENV === 'production') return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-black/80 text-white p-2 rounded-md text-xs backdrop-blur-md">
        <p className="mb-2 font-bold px-2">Dev Navigation: {currentScreen}</p>
        <div className="grid grid-cols-2 gap-1 max-h-[200px] overflow-y-auto p-1">
          <Button variant="ghost" size="sm" className="h-6 text-xs justify-start text-white hover:text-white hover:bg-white/20" onClick={() => onNavigate('login')}>Login</Button>
          <Button variant="ghost" size="sm" className="h-6 text-xs justify-start text-white hover:text-white hover:bg-white/20" onClick={() => onNavigate('unified-parent-dashboard')}>Parent Dash</Button>
          <Button variant="ghost" size="sm" className="h-6 text-xs justify-start text-white hover:text-white hover:bg-white/20" onClick={() => onNavigate('unified-institute-dashboard')}>Institute Dash</Button>
          <Button variant="ghost" size="sm" className="h-6 text-xs justify-start text-white hover:text-white hover:bg-white/20" onClick={() => onNavigate('student-dashboard')}>Student Dash</Button>
          <Button variant="ghost" size="sm" className="h-6 text-xs justify-start text-white hover:text-white hover:bg-white/20" onClick={() => onNavigate('ngo-dashboard')}>NGO Dash</Button>
          <Button variant="ghost" size="sm" className="h-6 text-xs justify-start text-white hover:text-white hover:bg-white/20" onClick={() => onNavigate('role-selection')}>Roles</Button>
        </div>
      </div>
    </div>
  );
}
