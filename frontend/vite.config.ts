import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const replitDomain = process.env.REPLIT_DEV_DOMAIN;

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@assets": path.resolve(__dirname, "src/assets"),
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },

  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
          if (id.includes("framer-motion")) return "vendor-motion";
          if (id.includes("jspdf") || id.includes("html2canvas") || id.includes("canvg")) return "vendor-pdf";
          if (id.includes("lucide-react")) return "vendor-icons";
          if (id.includes("@radix-ui")) return "vendor-radix";
          if (id.includes("@tanstack")) return "vendor-query";
          if (
            id.includes("react-dom") ||
            id.includes("react-router") ||
            id.includes("scheduler") ||
            /node_modules\/react\//.test(id)
          )
            return "vendor-react";
          return undefined;
        },
      },
    },
  },

  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "@tanstack/react-query",
      "zustand",
      "framer-motion",
      "recharts",
      "lucide-react",
      "cmdk",
      "date-fns",
      "react-hook-form",
      "sonner",
      "class-variance-authority",
      "tailwind-merge",
      "i18next",
      "react-i18next",
      "i18next-browser-languagedetector",
      "embla-carousel-react",
      "@radix-ui/react-accordion",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-avatar",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-collapsible",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-label",
      "@radix-ui/react-popover",
      "@radix-ui/react-progress",
      "@radix-ui/react-radio-group",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slider",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
      "@radix-ui/react-toast",
      "@radix-ui/react-tooltip",
    ],
  },

  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,

    // Ignore the pre-built CSS file so Vite doesn't reload the page
    // every time build-css.mjs writes it at startup.
    watch: {
      ignored: [
        "**/tailwind-built.css",
        "**/.git/**",
        "**/node_modules/**",
      ],
    },

    // HMR must target the port the browser actually loads the app on.
    // The app (localPort 5000) is mapped to externalPort 80 in `.replit`, i.e.
    // it is served at https://<domain> over the default port 443. There is NO
    // externalPort 5000, so a wss handshake to :5000 never connects and the
    // preview flaps ("server connection lost" → endless reload). Target 443,
    // which routes to externalPort 80 → the app's own Vite on localPort 5000.
    hmr: replitDomain
      ? {
          protocol: "wss",
          host: replitDomain,
          clientPort: 443,
          timeout: 120000,
          overlay: false,
        }
      : { overlay: false },

    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
      },
      "/api/v1": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
      },
      "/ws": {
        target: "ws://localhost:8080",
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
});
