import { createRoot } from "react-dom/client";
import { ThemeProvider } from "./contexts/ThemeContext";
import App from "./App.tsx";
import "./styles/tailwind-built.css";
import "./lib/i18n";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
