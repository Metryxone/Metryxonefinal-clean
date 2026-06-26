// ─────────────────────────────────────────────────────────────────────────────
// CSRF token plumbing (frontend half of the signed double-submit scheme).
//
// The backend issues a non-httpOnly `mx.csrf` cookie; every state-changing
// same-origin /api request must echo that cookie value in the `x-csrf-token`
// header. Rather than touch the dozens of ad-hoc `fetch()` call sites across the
// app, we install ONE global `window.fetch` wrapper so coverage is 100% with no
// gaps — every helper (apiRequest, authFetch, React-Query, direct fetch) routes
// through it.
// ─────────────────────────────────────────────────────────────────────────────
const CSRF_COOKIE = "mx.csrf";
const CSRF_HEADER = "x-csrf-token";
const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL ?? "";

function readCookie(name: string): string | null {
  const match = document.cookie.match(
    new RegExp("(?:^|;)\\s*" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*=\\s*([^;]+)"),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

let inflight: Promise<void> | null = null;

/** Return the current CSRF token, fetching the bootstrap endpoint once if absent. */
export async function ensureCsrfToken(): Promise<string | null> {
  const existing = readCookie(CSRF_COOKIE);
  if (existing) return existing;
  if (!inflight) {
    inflight = originalFetch(`${API_BASE_URL}/api/csrf-token`, { credentials: "include" })
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => {
        inflight = null;
      });
  }
  await inflight;
  return readCookie(CSRF_COOKIE);
}

const MUTATING = /^(POST|PUT|PATCH|DELETE)$/i;

let originalFetch: typeof fetch =
  typeof window !== "undefined" ? window.fetch.bind(window) : (globalThis.fetch as typeof fetch);

function isSameOriginApi(url: string): boolean {
  try {
    const u = new URL(url, window.location.origin);
    return u.origin === window.location.origin && u.pathname.startsWith("/api");
  } catch {
    return false;
  }
}

function headerAlreadySet(headers: Headers, name: string): boolean {
  return headers.has(name);
}

/**
 * Install the global fetch wrapper exactly once. Safe to call repeatedly.
 * Only same-origin mutating /api requests are augmented; everything else is
 * passed through untouched so behaviour stays byte-identical.
 */
export function installCsrfFetch(): void {
  if (typeof window === "undefined") return;
  if ((window as any).__mxCsrfPatched) return;
  (window as any).__mxCsrfPatched = true;
  originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    try {
      const isRequest = typeof Request !== "undefined" && input instanceof Request;
      const method = (init?.method ?? (isRequest ? (input as Request).method : "GET")).toUpperCase();

      if (!MUTATING.test(method)) return originalFetch(input as any, init);

      const url = isRequest ? (input as Request).url : String(input);
      if (!isSameOriginApi(url)) return originalFetch(input as any, init);

      const token = await ensureCsrfToken();
      if (!token) return originalFetch(input as any, init);

      // Case 1: fetch(Request) with no init — rebuild the Request with the header.
      if (isRequest && !init) {
        const req = input as Request;
        const headers = new Headers(req.headers);
        if (!headerAlreadySet(headers, CSRF_HEADER)) headers.set(CSRF_HEADER, token);
        return originalFetch(new Request(req, { headers }));
      }

      // Case 2: fetch(url|Request, init) — merge into init.headers.
      const headers = new Headers(
        init?.headers ?? (isRequest ? (input as Request).headers : undefined),
      );
      if (!headerAlreadySet(headers, CSRF_HEADER)) headers.set(CSRF_HEADER, token);
      return originalFetch(input as any, { ...init, headers });
    } catch {
      // On any unexpected wrapper error, fall back to the untouched request.
      return originalFetch(input as any, init);
    }
  };
}
