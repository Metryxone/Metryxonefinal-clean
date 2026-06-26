// Production environment preflight.
//
// Converts the "invisible, unverifiable, fails-silently-at-runtime" secrets
// problem into a single, explicit boot-time report:
//   • FATAL vars abort the boot (production only) — the app cannot run correctly
//     or securely without them.
//   • RECOMMENDED vars print a loud, clearly-labelled warning but never take the
//     whole platform down, because they only degrade an admin-only / fail-soft
//     feature (taking end-user traffic offline for that would be a worse failure).
//
// In non-production this is a no-op, so the development boot is byte-identical to
// the legacy behaviour.

const DEV_UPLOAD_TOKEN = "dev-only-upload-token-do-not-use-in-production";

// Known placeholder / dev SESSION_SECRET values. A var that is "set" to one of
// these is NOT really configured — treat it as missing (present-but-broken).
const SESSION_SECRET_PLACEHOLDERS = new Set([
  "edupsych-secret-key-change-in-production",
  "change-me",
  "changeme",
  "changemeinproduction",
  "secret",
  "dev",
  "development",
  "your-session-secret",
]);

type Severity = "fatal" | "warn";

interface EnvCheck {
  name: string;
  severity: Severity;
  ok: boolean;
  note: string;
}

export function assertEnvPreflight(env: NodeJS.ProcessEnv = process.env): void {
  // Dev / test: no preflight (byte-identical to legacy boot).
  if (env.NODE_ENV !== "production") return;

  const checks: EnvCheck[] = [
    {
      name: "SESSION_SECRET",
      severity: "fatal",
      ok: (() => {
        const ss = (env.SESSION_SECRET ?? "").trim();
        return ss.length > 0 && !SESSION_SECRET_PLACEHOLDERS.has(ss.toLowerCase());
      })(),
      note: "express-session signing key. Missing, whitespace-only, or a known placeholder => insecure/broken sessions. Refusing to start.",
    },
    {
      name: "DATABASE_URL",
      severity: "fatal",
      ok: !!env.DATABASE_URL,
      note: "Postgres connection string. Missing => the app cannot function. Refusing to start.",
    },
    {
      name: "MONGODB_URI",
      severity: "warn",
      ok: !!env.MONGODB_URI,
      note:
        "Mongo connection string. The app continues without it (MONGO_REQUIRED " +
        "defaults false), but Mongo-backed features degrade. Set in production " +
        "unless the deployment is intentionally Mongo-less.",
    },
    {
      name: "ZOHO_EMAIL + ZOHO_APP_PASSWORD",
      severity: "warn",
      ok: !!env.ZOHO_EMAIL && !!env.ZOHO_APP_PASSWORD,
      note:
        "Super-admin 2FA codes are emailed via Zoho; in production the code is " +
        "never logged or returned. Missing => SUPER-ADMIN LOGIN IS IMPOSSIBLE " +
        "(launch blocker for admin access). End-user traffic is unaffected, so " +
        "this warns rather than aborts the boot.",
    },
    {
      name: "FASTAPI_URL",
      severity: "warn",
      ok: !!env.FASTAPI_URL && !/localhost|127\.0\.0\.1/i.test(env.FASTAPI_URL),
      note:
        "URL of the externally-published FastAPI bulk-upload service. " +
        "Missing/localhost => admin bulk uploads fail.",
    },
    {
      name: "UPLOAD_SERVICE_TOKEN",
      severity: "warn",
      ok: !!env.UPLOAD_SERVICE_TOKEN && env.UPLOAD_SERVICE_TOKEN !== DEV_UPLOAD_TOKEN,
      note:
        "Shared secret between the Node API and the FastAPI bulk-upload service. " +
        "Missing/placeholder => uploads are rejected (fail-closed). Must be " +
        "identical on BOTH services.",
    },
    {
      name: "OPENAI_API_KEY",
      severity: "warn",
      ok: !!env.OPENAI_API_KEY,
      note: "AI features are fail-soft. Missing => AI paths stay dormant (acceptable).",
    },
  ];

  const fatals = checks.filter((c) => c.severity === "fatal" && !c.ok);
  const warns = checks.filter((c) => c.severity === "warn" && !c.ok);

  console.log("──────── PRODUCTION ENV PREFLIGHT ────────");
  for (const c of checks) {
    if (c.ok) {
      console.log(`  [ OK ] ${c.name}`);
    } else if (c.severity === "fatal") {
      console.error(`  [FAIL] ${c.name}\n         ↳ ${c.note}`);
    } else {
      console.warn(`  [WARN] ${c.name}\n         ↳ ${c.note}`);
    }
  }
  console.log("──────────────────────────────────────────");

  if (warns.length) {
    console.warn(
      `ENV PREFLIGHT: ${warns.length} recommended production var(s) missing — see notes above (non-blocking).`,
    );
  }
  if (fatals.length) {
    console.error(
      `FATAL: ${fatals.length} required production env var(s) missing: ${fatals
        .map((c) => c.name)
        .join(", ")}. Refusing to start. Set them in the deployment secrets.`,
    );
    process.exit(1);
  }
}
