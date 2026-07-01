import { createRoot } from "react-dom/client";
import { ThemeProvider } from "./contexts/ThemeContext";
import { GlobalErrorBoundary } from "./components/GlobalErrorBoundary";
import App from "./App.tsx";
import "./styles/tailwind-built.css";
import "./lib/i18n";
import { installCsrfFetch, ensureCsrfToken } from "./lib/csrf";

// Install the global CSRF fetch wrapper BEFORE the app renders so every
// same-origin mutating /api request carries the x-csrf-token header, then
// pre-warm the token cookie so the first user action already has it.
installCsrfFetch();
void ensureCsrfToken();

// Assessment Architecture (Phase 3.1) foundations — AP-2 offline delivery + AP-3
// accessibility — are INERT by default and only activate when the
// `assessment_architecture_completion` flag is ON, keeping the OFF path
// byte-identical. Failure to read the flag leaves both foundations disabled.
void (async () => {
  try {
    const res = await fetch('/api/capadex/public-config');
    if (!res.ok) return;
    const cfg = await res.json();
    if (cfg?.assessment_architecture_completion === true) {
      const [{ initAccessibility }, { initOfflineDelivery }] = await Promise.all([
        import('./lib/accessibility'),
        import('./lib/offline'),
      ]);
      initAccessibility();
      initOfflineDelivery();
    }
  } catch { /* foundations optional; app renders normally */ }
})();

createRoot(document.getElementById("root")!).render(
  <GlobalErrorBoundary>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </GlobalErrorBoundary>
);
