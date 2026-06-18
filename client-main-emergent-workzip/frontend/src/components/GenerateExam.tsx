import { Screen } from '../App';
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export function GenerateExam({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      <Navbar onNavigate={onNavigate} currentScreen="generate-exam" />
      <div className="flex-1 pt-20 p-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }} data-testid="text-generate-exam">Generate Exam</h1>
        <Button className="mt-4" onClick={() => onNavigate('unified-parent-dashboard')} data-testid="btn-back">Back</Button>
      </div>
      <Footer onNavigate={onNavigate} />
    </div>
  );
}
