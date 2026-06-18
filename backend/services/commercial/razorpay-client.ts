/**
 * Task #5 — Commercial Runtime Spine · hardened Razorpay TEST client.
 *
 * Thin wrapper over the Razorpay REST API for the NEW commercial surfaces (plans, recurring
 * subscriptions, payment links) with:
 *   • DEMO fallback — when keys are absent (`RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`) every call
 *     returns a deterministic `DEMO_*` stub so the spine works without live keys (mirrors the
 *     existing capadex-payments demo behaviour). `configured:false` flags the stub to callers.
 *   • retry/backoff — transient failures (network, 429, 5xx) are retried with exponential backoff.
 *   • HMAC verify — reuses the same signature scheme as routes/capadex-payments.ts; do not regress.
 *
 * TEST KEYS ONLY. Never enable production keys here.
 */
import { createHmac } from 'crypto';

export interface RazorpayCreds {
  keyId: string;
  keySecret: string;
}

export function getRazorpayCreds(): RazorpayCreds | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret };
}

export function isRazorpayConfigured(): boolean {
  return getRazorpayCreds() !== null;
}

/** Order/payment signature — identical scheme to routes/capadex-payments.ts verifySignature. */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string, secret: string): boolean {
  const digest = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  return digest === signature;
}

/** Razorpay subscription signature scheme: HMAC(`${paymentId}|${subscriptionId}`). */
export function verifySubscriptionSignature(
  paymentId: string,
  subscriptionId: string,
  signature: string,
  secret: string,
): boolean {
  const digest = createHmac('sha256', secret).update(`${paymentId}|${subscriptionId}`).digest('hex');
  return digest === signature;
}

/** Webhook signature scheme: HMAC over the raw JSON body. */
export function verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
  const digest = createHmac('sha256', secret).update(rawBody).digest('hex');
  return digest === signature;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isTransient(status: number | null, err: unknown): boolean {
  if (status != null) return status === 429 || (status >= 500 && status <= 599);
  // No HTTP status → network / fetch error → transient.
  return err != null;
}

export interface RetryOpts {
  retries?: number;
  baseDelayMs?: number;
}

/**
 * Authenticated Razorpay REST call with exponential backoff on transient failures.
 * Throws on a non-transient error or after exhausting retries.
 */
export async function razorpayFetch<T = any>(
  creds: RazorpayCreds,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  opts: RetryOpts = {},
): Promise<T> {
  const retries = opts.retries ?? 3;
  const baseDelay = opts.baseDelayMs ?? 300;
  const auth = 'Basic ' + Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString('base64');
  const url = `https://api.razorpay.com/v1${path}`;

  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let status: number | null = null;
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: body != null ? JSON.stringify(body) : undefined,
      });
      status = res.status;
      const json = (await res.json().catch(() => ({}))) as any;
      if (res.ok) return json as T;

      lastErr = new Error(json?.error?.description || `Razorpay ${method} ${path} → ${res.status}`);
      if (!isTransient(status, null) || attempt === retries) throw lastErr;
    } catch (err) {
      lastErr = err;
      if (!isTransient(status, err) || attempt === retries) throw lastErr;
    }
    await sleep(baseDelay * 2 ** attempt); // 300, 600, 1200, ...
  }
  throw lastErr ?? new Error('razorpay_fetch_failed');
}

// ── High-level helpers (each returns a `configured` flag + a DEMO stub when keyless) ──────────

export interface DemoableResult<T> {
  configured: boolean;
  demo: boolean;
  data: T;
}

/** Create (or look up) a Razorpay plan for recurring billing. */
export async function createRazorpayPlan(args: {
  period: 'monthly' | 'quarterly' | 'yearly';
  interval: number;
  amountPaise: number;
  currency?: string;
  name: string;
}): Promise<DemoableResult<{ id: string }>> {
  const creds = getRazorpayCreds();
  if (!creds) {
    return { configured: false, demo: true, data: { id: `DEMO_PLAN_${Date.now()}` } };
  }
  const data = await razorpayFetch<{ id: string }>(creds, 'POST', '/plans', {
    period: args.period,
    interval: args.interval,
    item: { name: args.name, amount: args.amountPaise, currency: args.currency ?? 'INR' },
  });
  return { configured: true, demo: false, data };
}

/** Create a recurring subscription against a plan. */
export async function createRazorpaySubscription(args: {
  planId: string;
  totalCount: number;
  customerNotify?: boolean;
  notes?: Record<string, string>;
}): Promise<DemoableResult<{ id: string; short_url?: string; status?: string }>> {
  const creds = getRazorpayCreds();
  if (!creds) {
    return { configured: false, demo: true, data: { id: `DEMO_SUB_${Date.now()}`, status: 'created' } };
  }
  const data = await razorpayFetch<{ id: string; short_url?: string; status?: string }>(
    creds,
    'POST',
    '/subscriptions',
    {
      plan_id: args.planId,
      total_count: args.totalCount,
      customer_notify: args.customerNotify ? 1 : 0,
      notes: args.notes ?? {},
    },
  );
  return { configured: true, demo: false, data };
}

/** Create a hosted payment link (one-time). */
export async function createRazorpayPaymentLink(args: {
  amountPaise: number;
  currency?: string;
  description?: string;
  referenceId?: string;
  customer?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
}): Promise<DemoableResult<{ id: string; short_url: string; status?: string }>> {
  const creds = getRazorpayCreds();
  if (!creds) {
    const id = `DEMO_PLINK_${Date.now()}`;
    return { configured: false, demo: true, data: { id, short_url: `https://demo.local/pay/${id}`, status: 'created' } };
  }
  const data = await razorpayFetch<{ id: string; short_url: string; status?: string }>(
    creds,
    'POST',
    '/payment_links',
    {
      amount: args.amountPaise,
      currency: args.currency ?? 'INR',
      description: args.description,
      reference_id: args.referenceId,
      customer: args.customer,
      notify: { email: !!args.customer?.email, sms: !!args.customer?.contact },
      notes: args.notes ?? {},
    },
  );
  return { configured: true, demo: false, data };
}

/** Issue a refund for a captured payment. */
export async function createRazorpayRefund(args: {
  paymentId: string;
  amountPaise: number;
  notes?: Record<string, string>;
}): Promise<DemoableResult<{ id: string; status?: string }>> {
  const creds = getRazorpayCreds();
  if (!creds) {
    return { configured: false, demo: true, data: { id: `DEMO_RFND_${Date.now()}`, status: 'processed' } };
  }
  const data = await razorpayFetch<{ id: string; status?: string }>(
    creds,
    'POST',
    `/payments/${args.paymentId}/refund`,
    { amount: args.amountPaise, speed: 'normal', notes: args.notes ?? {} },
  );
  return { configured: true, demo: false, data };
}
