/**
 * Offline assessment delivery (CAPADEX 3.0 · Program 3 · Phase 3.1 · AP-2)
 * ===========================================================================
 * Additive PWA + offline-response-queue layer. INERT until `initOfflineDelivery()`
 * is called (only when the `assessment_architecture_completion` flag is ON) — the
 * default app never registers a service worker, so it is byte-identical when OFF.
 *
 *   - registers `/sw.js` (app-shell cache-first) so the assessment loads offline,
 *   - queues assessment responses in localStorage while offline and flushes them
 *     (in order, idempotent by client key) when connectivity returns.
 *
 * NOTE ON VERIFICATION: true offline behaviour (SW install, cache hits, background
 * sync) requires a real browser online/offline test (the `offline_sessions`
 * ADOPTION axis). This module is the engineering scaffold; behaviour is verified
 * separately, never claimed here.
 */

const QUEUE_KEY = 'capadex_offline_response_queue_v1';

export interface QueuedResponse {
  client_key: string;   // idempotency key generated at capture time
  endpoint: string;     // API endpoint to POST to on flush
  payload: unknown;
  queued_at: number;
}

function readQueue(): QueuedResponse[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') as QueuedResponse[]; }
  catch { return []; }
}

function writeQueue(q: QueuedResponse[]): void {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch { /* quota — best effort */ }
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}

/** Queue a response for later delivery (dedup by client_key). */
export function queueResponse(entry: Omit<QueuedResponse, 'queued_at'>): void {
  const q = readQueue();
  if (q.some((e) => e.client_key === entry.client_key)) return;
  q.push({ ...entry, queued_at: Date.now() });
  writeQueue(q);
}

export function pendingCount(): number {
  return readQueue().length;
}

/**
 * Flush the queue in order. Each POST carries the client_key so the server can be
 * idempotent. Successfully delivered entries are removed; failures are retained.
 */
export async function flushQueue(): Promise<{ delivered: number; remaining: number }> {
  if (!isOnline()) return { delivered: 0, remaining: pendingCount() };
  let q = readQueue();
  let delivered = 0;
  for (const entry of [...q]) {
    try {
      const res = await fetch(entry.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(entry.payload as object), client_key: entry.client_key }),
      });
      if (res.ok) { q = q.filter((e) => e.client_key !== entry.client_key); delivered++; writeQueue(q); }
      else break; // stop on first failure; preserve order
    } catch { break; }
  }
  return { delivered, remaining: q.length };
}

/** Inject the PWA manifest + theme-color (only under the flag → OFF index.html byte-identical). */
function injectManifest(): void {
  if (typeof document === 'undefined') return;
  if (!document.querySelector('link[rel="manifest"]')) {
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = '/manifest.webmanifest';
    document.head.appendChild(link);
  }
  if (!document.querySelector('meta[name="theme-color"]')) {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#0f172a';
    document.head.appendChild(meta);
  }
}

/** Idempotently register the service worker + connectivity listeners. */
export function initOfflineDelivery(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  injectManifest();
  navigator.serviceWorker.register('/sw.js').catch(() => { /* SW optional; app still works */ });
  window.addEventListener('online', () => { void flushQueue(); });
  // Opportunistic flush on load if already online.
  if (isOnline()) void flushQueue();
}
