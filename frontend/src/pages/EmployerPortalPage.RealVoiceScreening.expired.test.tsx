// Regression test for Task #225 — the live avatar interview must end CLEANLY when
// the server cuts off an over-cap (billing-expired) session.
//
// Server-side (proven in Task #223) once a live session passes the duration/billing
// cap the `/next` and `/turns` endpoints reject with `409 { expired: true }`. The
// frontend (RealVoiceScreeningTab live flow) is supposed to treat that 409-expired
// response as a clean "done": stop the conversation, upload the partial recording,
// and call `/finalize` so the candidate's partial result is still scored — with NO
// error toast and NO retry loop.
//
// This test drives the real component through that flow with the external runtime
// (HeyGen SDK, getUserMedia, MediaRecorder, <video>.play) stubbed, and asserts the
// clean-end contract holds.

import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Shared registry so the test can reach into the mocked HeyGen avatar instance and
// fire the "candidate finished speaking" event the same way the real SDK would.
const heygen = vi.hoisted(() => ({
  handlers: {} as Record<string, (ev: any) => void>,
  instance: null as any,
}));

vi.mock('https://esm.sh/@heygen/streaming-avatar@2.0.16', () => {
  const StreamingEvents = {
    STREAM_READY: 'stream_ready',
    STREAM_DISCONNECTED: 'stream_disconnected',
    USER_END_MESSAGE: 'user_end_message',
  };
  class FakeStreamingAvatar {
    constructor() { heygen.instance = this; }
    on(event: string, cb: (ev: any) => void) { heygen.handlers[event] = cb; }
    async createStartAvatar() { /* opens the WebRTC stream — no-op in test */ }
    async startVoiceChat() { /* ASR — no-op in test */ }
    async speak() { /* avatar TTS — no-op in test */ }
    async closeVoiceChat() { /* no-op */ }
    stopAvatar() { /* no-op */ }
  }
  return {
    default: FakeStreamingAvatar,
    StreamingAvatar: FakeStreamingAvatar,
    StreamingEvents,
    TaskType: { REPEAT: 'repeat' },
    AvatarQuality: { Low: 'low' },
  };
});

import { RealVoiceScreeningTab } from './EmployerPortalPage';

// ── Minimal candidate that qualifies for screening (assessmentScore >= 60) ──────
function makeCandidate(): any {
  return {
    _id: 'cand-1', jobId: 'job-1', jobTitle: 'Engineer', name: 'Asha Rao',
    email: 'asha@example.com', phone: '', location: '', currentRole: '',
    experience: '', skills: [], education: '', eiScore: 0, matchScore: 0,
    source: '', stage: 'Applied', notes: '', rating: 0, linkedinUrl: '',
    appliedDate: '', interviewDate: '', offerAmount: '', tags: [],
    assessmentSent: true, assessmentScore: 82, pooled: false, createdAt: '',
  };
}

// ── A fetch router that mimics the live-screening backend, including the
//    409 { expired: true } over-cap cut-off on BOTH /next and /turns ────────────
function buildFetch() {
  const calls: { url: string; method: string }[] = [];
  let nextCount = 0;
  const json = (status: number, body: any) =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
      blob: () => Promise.resolve(new Blob()),
    } as any);

  const fetchMock = vi.fn((input: any, init?: any) => {
    const url = String(input);
    const method = (init?.method || 'GET').toUpperCase();
    calls.push({ url, method });

    // Probes fired on mount.
    if (url.endsWith('/voice-screening/enabled')) return json(200, { enabled: true, aiReady: true });
    if (url.endsWith('/voice-screening/avatar/enabled')) return json(200, { enabled: false, configured: false });
    if (url.endsWith('/voice-screening/live/enabled'))
      return json(200, { enabled: true, configured: true, aiReady: true, ready: true, maxDurationMs: 12 * 60 * 1000 });

    // Create the live session (mints the avatar token server-side).
    if (url.endsWith('/live/sessions') && method === 'POST')
      return json(200, { success: true, session: { _id: 'live-sid-1' }, live: { token: 'tok', avatarId: 'av-1', voiceId: 'v-1', maxDurationMs: 12 * 60 * 1000 } });

    // Avatar's next utterance: first call (kickoff) succeeds; the next call — after
    // the candidate has spoken — is the server cutting the over-cap session off.
    if (url.includes('/live/sessions/') && url.endsWith('/next') && method === 'POST') {
      nextCount += 1;
      if (nextCount === 1)
        return json(200, { success: true, utterance: 'Tell me about yourself.', questionId: 'q1', done: false, isFollowUp: false });
      return json(409, { expired: true });
    }

    // The candidate turn is ALSO rejected once over cap (409 expired).
    if (url.includes('/live/sessions/') && url.endsWith('/turns') && method === 'POST')
      return json(409, { expired: true });

    // Partial recording upload — best-effort, succeeds.
    if (url.includes('/live/sessions/') && url.endsWith('/video') && method === 'POST')
      return json(200, { success: true });

    // Finalize: score whatever partial conversation exists.
    if (url.includes('/live/sessions/') && url.endsWith('/finalize') && method === 'POST')
      return json(200, {
        success: true,
        session: {
          overallScore: 71, recommendation: 'Hold', summary: 'Partial interview scored.',
          dimensions: [], abstained: false, answeredCount: 1, questionCount: 3,
          provenance: 'partial', channel: 'live_avatar', questions: [],
        },
      });

    // Transcript reload after finalize.
    if (url.includes('/live/sessions/') && url.endsWith('/turns') && method === 'GET')
      return json(200, { success: true, turns: [] });

    return json(200, {});
  });

  return { fetchMock, calls, getNextCount: () => nextCount };
}

describe('RealVoiceScreeningTab — live interview ends cleanly on 409 over-cap cut-off', () => {
  let fetchHarness: ReturnType<typeof buildFetch>;

  beforeEach(() => {
    heygen.handlers = {};
    heygen.instance = null;
    fetchHarness = buildFetch();
    vi.stubGlobal('fetch', fetchHarness.fetchMock);

    // jsdom has no media stack — stub just enough for the live flow.
    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop() {} }] }) },
    });
    class FakeMediaRecorder {
      static isTypeSupported() { return true; }
      state = 'inactive';
      ondataavailable: ((e: any) => void) | null = null;
      onstop: (() => void) | null = null;
      start() { this.state = 'recording'; this.ondataavailable?.({ data: new Blob(['chunk'], { type: 'video/webm' }) }); }
      stop() { this.state = 'inactive'; this.onstop?.(); }
    }
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder as any);
    // <video>.play() is "Not implemented" in jsdom and would reject the webcam-capture
    // try-block (falsely flagging a camera error) — make it a resolved no-op.
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined) as any;
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('stops the conversation, uploads the recording, and finalizes — no error, no retry', async () => {
    render(
      <RealVoiceScreeningTab
        candidates={[makeCandidate()]}
        setCandidates={() => {}}
        jobs={[]}
        onTabChange={() => {}}
      />,
    );

    // Select the Live interview mode, then start the live interview. The per-candidate
    // start button is identified by its title (the mode card also reads "Live Interview").
    fireEvent.click(await screen.findByText('Live Interview'));
    const startBtn = await screen.findByTitle(/A live avatar speaks and listens in real time/i);
    fireEvent.click(startBtn);

    // The avatar asks its first question — the interview is now live.
    await screen.findByText('Tell me about yourself.');
    expect(heygen.handlers['user_end_message']).toBeTypeOf('function');

    // The candidate answers — this triggers the candidate turn (/turns) and the
    // avatar's next turn (/next), both of which the server now rejects 409-expired.
    // We re-fire until it lands (the kickoff turn may still be settling), then assert
    // the session finalizes cleanly: the partial recording is uploaded and /finalize
    // is called, leaving the candidate marked Completed. The re-entrancy guards in the
    // component keep this from causing extra /next calls (asserted below).
    await waitFor(async () => {
      await act(async () => {
        heygen.handlers['user_end_message']({ detail: { message: 'I have five years of experience.' } });
        await Promise.resolve();
      });
      expect(fetchHarness.calls.some(c => c.url.endsWith('/finalize') && c.method === 'POST')).toBe(true);
    }, { timeout: 4000 });
    expect(fetchHarness.calls.some(c => c.url.endsWith('/video') && c.method === 'POST')).toBe(true);
    await screen.findByText('Completed');

    // No error toast was ever surfaced to the recruiter…
    expect(screen.queryByText(/Could not get the next question/i)).toBeNull();
    expect(screen.queryByText(/expired/i)).toBeNull();

    // …and there was NO retry loop: /next was hit exactly twice (kickoff + the one
    // expiry response that ended the interview), never repeatedly.
    expect(fetchHarness.getNextCount()).toBe(2);
    expect(fetchHarness.calls.filter(c => c.url.endsWith('/finalize') && c.method === 'POST')).toHaveLength(1);
  });
});
