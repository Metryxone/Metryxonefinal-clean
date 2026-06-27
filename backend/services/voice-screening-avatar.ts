/**
 * Voice Screening — HeyGen avatar provider seam (Option A: avatar-presented interview)
 * ----------------------------------------------------------------------------
 * The browser channel (MediaRecorder → Whisper STT → rubric scoring) is the live
 * screening path. This module is the provider seam for an AVATAR channel: a
 * pre-rendered talking-head video that speaks each authored screening question to
 * the candidate. The candidate then records a webcam video answer; the audio track
 * still flows through the existing Whisper STT + 5-dimension rubric scorer — the
 * avatar layer adds presentation + video capture, it never invents scores.
 *
 * Honesty contract (mirrors the Twilio phone-leg seam):
 *   • `isAvatarConfigured()` reports the REAL connection state — it is `false`
 *     unless genuine HeyGen credentials (key + avatar id + voice id) are present
 *     in the environment. Nothing here pretends the avatar works when it does not.
 *   • `requestAvatarVideo()` / `fetchAvatarVideoStatus()` call the real HeyGen API.
 *     When unconfigured they throw `AvatarUnavailable` (HTTP 503) so callers surface
 *     an honest "avatar not configured" error instead of fabricating a video.
 *
 * Credentials (set as secrets; no value is ever logged):
 *   HEYGEN_API_KEY      — HeyGen API key
 *   HEYGEN_AVATAR_ID    — the avatar (talking head) to render
 *   HEYGEN_VOICE_ID     — the HeyGen voice to speak the script
 *   HEYGEN_BASE_URL     — optional override (defaults to https://api.heygen.com)
 */

/** HTTP-503-mapped error: the HeyGen avatar leg is not configured. */
export class AvatarUnavailable extends Error {
  status = 503;
  constructor(message: string) {
    super(message);
    this.name = 'AvatarUnavailable';
  }
}

const BASE_URL = (): string =>
  (process.env.HEYGEN_BASE_URL || 'https://api.heygen.com').replace(/\/+$/, '');

/** True only when genuine HeyGen credentials (key + avatar + voice) are present. */
export function isAvatarConfigured(): boolean {
  return !!(
    process.env.HEYGEN_API_KEY &&
    process.env.HEYGEN_AVATAR_ID &&
    process.env.HEYGEN_VOICE_ID
  );
}

export interface AvatarStatus {
  provider: 'heygen';
  channel: 'avatar';
  connected: boolean;
  implemented: boolean;
  message: string;
}

/** Honest status for the avatar leg: connected reflects real credentials. */
export function avatarStatus(): AvatarStatus {
  const hasKey = !!process.env.HEYGEN_API_KEY;
  const hasAvatar = !!process.env.HEYGEN_AVATAR_ID;
  const hasVoice = !!process.env.HEYGEN_VOICE_ID;
  const connected = hasKey && hasAvatar && hasVoice;
  let message: string;
  if (connected) {
    message = 'Avatar presenter is configured (HeyGen).';
  } else if (!hasKey) {
    message =
      'Avatar presenter is not configured. Set HEYGEN_API_KEY, HEYGEN_AVATAR_ID and HEYGEN_VOICE_ID to enable it.';
  } else {
    const missing = [!hasAvatar ? 'HEYGEN_AVATAR_ID' : null, !hasVoice ? 'HEYGEN_VOICE_ID' : null]
      .filter(Boolean)
      .join(' and ');
    message = `HeyGen API key detected, but ${missing} ${!hasAvatar && !hasVoice ? 'are' : 'is'} not set yet.`;
  }
  return { provider: 'heygen', channel: 'avatar', connected, implemented: true, message };
}

function requireConfig(): {
  apiKey: string;
  avatarId: string;
  voiceId: string;
} {
  const apiKey = process.env.HEYGEN_API_KEY;
  const avatarId = process.env.HEYGEN_AVATAR_ID;
  const voiceId = process.env.HEYGEN_VOICE_ID;
  if (!apiKey || !avatarId || !voiceId) {
    throw new AvatarUnavailable(avatarStatus().message);
  }
  return { apiKey, avatarId, voiceId };
}

async function heygenFetch(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<any> {
  const { apiKey } = requireConfig();
  const controller = new AbortController();
  const timeoutMs = init.timeoutMs ?? 20000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE_URL()}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'X-Api-Key': apiKey,
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers || {}),
      },
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!res.ok) {
      const detail =
        json?.error?.message || json?.message || json?.error || `HeyGen HTTP ${res.status}`;
      throw new AvatarUnavailable(`HeyGen request failed: ${detail}`);
    }
    return json;
  } catch (err: any) {
    if (err instanceof AvatarUnavailable) throw err;
    if (err?.name === 'AbortError') {
      throw new AvatarUnavailable('HeyGen request timed out.');
    }
    throw new AvatarUnavailable(`HeyGen request error: ${err?.message || 'unknown error'}`);
  } finally {
    clearTimeout(timer);
  }
}

export interface AvatarVideoRequest {
  providerVideoId: string;
}

/**
 * Request a pre-rendered talking-head video for a single question script.
 * Returns the HeyGen video id; the render is asynchronous — poll with
 * `fetchAvatarVideoStatus`. Throws `AvatarUnavailable` when unconfigured.
 */
export async function requestAvatarVideo(script: string): Promise<AvatarVideoRequest> {
  const { avatarId, voiceId } = requireConfig();
  const input = (script || '').trim();
  if (!input) throw new AvatarUnavailable('Cannot render an avatar video for an empty script.');
  const body = {
    video_inputs: [
      {
        character: { type: 'avatar', avatar_id: avatarId, avatar_style: 'normal' },
        voice: { type: 'text', input_text: input, voice_id: voiceId },
      },
    ],
    dimension: { width: 1280, height: 720 },
  };
  const json = await heygenFetch('/v2/video/generate', {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: 30000,
  });
  const providerVideoId = json?.data?.video_id || json?.video_id;
  if (!providerVideoId) {
    throw new AvatarUnavailable('HeyGen did not return a video id.');
  }
  return { providerVideoId: String(providerVideoId) };
}

export type AvatarVideoState = 'pending' | 'processing' | 'completed' | 'failed';

export interface AvatarVideoStatus {
  status: AvatarVideoState;
  url: string | null;
  error: string | null;
}

function normalizeState(raw: string): AvatarVideoState {
  const s = (raw || '').toLowerCase();
  if (s === 'completed' || s === 'success' || s === 'done') return 'completed';
  if (s === 'failed' || s === 'error') return 'failed';
  if (s === 'processing') return 'processing';
  return 'pending'; // waiting | pending | queued | unknown
}

/**
 * Poll the render status for a previously requested avatar video.
 * Throws `AvatarUnavailable` when unconfigured.
 */
export async function fetchAvatarVideoStatus(providerVideoId: string): Promise<AvatarVideoStatus> {
  const id = (providerVideoId || '').trim();
  if (!id) throw new AvatarUnavailable('Missing HeyGen video id.');
  const json = await heygenFetch(
    `/v1/video_status.get?video_id=${encodeURIComponent(id)}`,
    { method: 'GET' },
  );
  const data = json?.data || {};
  const status = normalizeState(String(data.status ?? ''));
  const url = data.video_url || data.video_url_caption || null;
  const error = data.error
    ? typeof data.error === 'string'
      ? data.error
      : data.error?.message || JSON.stringify(data.error)
    : null;
  return { status, url: status === 'completed' ? url : null, error };
}

// ════════════════════════════════════════════════════════════════════════════
// LIVE / INTERACTIVE STREAMING AVATAR (Option B) — real-time two-way interview
// ----------------------------------------------------------------------------
// The same HeyGen credentials (key + avatar + voice) power the Interactive
// Streaming Avatar. To keep the API key server-side, the server mints a
// short-lived SESSION TOKEN via `/v1/streaming.create_token`; the browser then
// uses HeyGen's @heygen/streaming-avatar SDK with ONLY that token to open the
// WebRTC stream, speak (REPEAT mode), and capture the candidate's speech. No
// credential ever reaches the browser. Honesty contract is identical: when the
// avatar is unconfigured, `createLiveAvatarToken()` throws AvatarUnavailable
// (503) — nothing here fabricates a live session.
// ════════════════════════════════════════════════════════════════════════════

/** Hard cap on a single live interview — realtime avatar minutes are billable. */
export const LIVE_AVATAR_MAX_DURATION_MS = 12 * 60 * 1000; // 12 minutes

/** True only when genuine HeyGen credentials are present (same seam as Option A). */
export function isLiveAvatarConfigured(): boolean {
  return isAvatarConfigured();
}

/** Honest status for the live (interactive) avatar leg. */
export function liveAvatarStatus(): AvatarStatus & { channel: 'live_avatar' } {
  const base = avatarStatus();
  return {
    ...base,
    channel: 'live_avatar',
    message: base.connected
      ? 'Live conversational avatar is configured (HeyGen Interactive Avatar).'
      : base.message,
  };
}

export interface LiveAvatarToken {
  token: string;
  avatarId: string;
  voiceId: string;
  maxDurationMs: number;
}

/**
 * Mint a short-lived HeyGen streaming session token for the browser SDK.
 * Throws `AvatarUnavailable` (503) when HeyGen is not configured or the request
 * fails. Never returns a fabricated/placeholder token.
 */
export async function createLiveAvatarToken(): Promise<LiveAvatarToken> {
  const { avatarId, voiceId } = requireConfig();
  const json = await heygenFetch('/v1/streaming.create_token', {
    method: 'POST',
    body: JSON.stringify({}),
    timeoutMs: 20000,
  });
  const token = json?.data?.token || json?.token;
  if (!token) {
    throw new AvatarUnavailable('HeyGen did not return a streaming session token.');
  }
  return { token: String(token), avatarId, voiceId, maxDurationMs: LIVE_AVATAR_MAX_DURATION_MS };
}
