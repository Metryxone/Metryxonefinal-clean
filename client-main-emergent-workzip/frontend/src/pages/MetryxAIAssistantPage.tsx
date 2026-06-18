import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { MetryxAIAssistantPage as MetryxAIContent } from "@/components/MetryxAIAssistantPage";
import { Screen } from "../App";

interface Props {
  onNavigate: (screen: Screen) => void;
}

export function MetryxAIAssistantPage({ onNavigate }: Props) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary, #ffffff)' }}>
      <Navbar onNavigate={onNavigate} currentScreen="metryxai-assistant" />
      <main className="flex-1 pt-20" data-testid="metryxai-screen">
        <MetryxAIContent role="parent" onNavigate={(s) => onNavigate(s as Screen)} />
      </main>
      <Footer onNavigate={onNavigate} />
    </div>
  );
}
