import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AIPoweredReports } from "@/components/AIPoweredReports";
import { Screen } from "../App";

interface Props {
  onNavigate: (screen: Screen) => void;
}

export function AIPoweredReportsPage({ onNavigate }: Props) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary, #ffffff)' }}>
      <Navbar onNavigate={onNavigate} currentScreen="ai-powered-reports" />
      <main className="flex-1 pt-20" data-testid="ai-reports-screen">
        <AIPoweredReports role="parent" onNavigate={(s) => onNavigate(s as Screen)} />
      </main>
      <Footer onNavigate={onNavigate} />
    </div>
  );
}
