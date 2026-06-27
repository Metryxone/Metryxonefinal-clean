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

createRoot(document.getElementById("root")!).render(
  <GlobalErrorBoundary>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </GlobalErrorBoundary>
);
