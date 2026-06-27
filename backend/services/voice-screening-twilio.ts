/**
 * Voice Screening — Twilio phone-leg provider seam (v2 scaffold)
 * ----------------------------------------------------------------------------
 * The browser channel (MediaRecorder → Whisper STT → rubric scoring) is the live
 * screening path. This module is the provider seam for an additional PHONE channel
 * (outbound call → IVR → recorded answers) that is NOT yet implemented.
 *
 * Honesty contract:
 *   • `isTwilioConfigured()` reports the REAL connection state — it is `false`
 *     unless Twilio credentials are actually present in the environment. Nothing
 *     here pretends the phone leg works when it does not.
 *   • `initiateOutboundCall()` throws `TwilioUnavailable` (HTTP 503) so callers
 *     surface an honest "phone screening not configured / not implemented" error
 *     instead of fabricating a call or a transcript.
 */

/** HTTP-503-mapped error: the Twilio phone leg is not configured / not implemented. */
export class TwilioUnavailable extends Error {
  status = 503;
  constructor(message: string) {
    super(message);
    this.name = 'TwilioUnavailable';
  }
}

/** True only when real Twilio credentials are present in the environment. */
export function isTwilioConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );
}

export interface TwilioStatus {
  provider: 'twilio';
  channel: 'phone';
  connected: boolean;
  implemented: boolean;
  message: string;
}

/** Honest status for the phone leg: connected reflects real credentials. */
export function twilioStatus(): TwilioStatus {
  const connected = isTwilioConfigured();
  return {
    provider: 'twilio',
    channel: 'phone',
    connected,
    implemented: false, // v2 scaffold — outbound IVR screening not yet built
    message: connected
      ? 'Twilio credentials detected, but phone screening (outbound IVR) is not yet implemented.'
      : 'Phone screening is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER to enable it.',
  };
}

export interface OutboundCallInput {
  sessionId: string;
  toNumber: string;
}

/**
 * Placeholder for the v2 outbound phone-screening leg. Always throws until the
 * phone channel is built — never fabricates a call or transcript.
 */
export async function initiateOutboundCall(_input: OutboundCallInput): Promise<never> {
  if (!isTwilioConfigured()) {
    throw new TwilioUnavailable(
      'Phone screening is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER to enable it.',
    );
  }
  throw new TwilioUnavailable(
    'Phone screening (Twilio outbound IVR) is not yet implemented. Use the browser screening channel.',
  );
}
