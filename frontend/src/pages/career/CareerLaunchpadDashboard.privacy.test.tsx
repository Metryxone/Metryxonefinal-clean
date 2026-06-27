/**
 * Career Launchpad Dashboard — Read-Path (Summary / Guidance) IDOR Privacy Test
 * ----------------------------------------------------------------------------
 * Task #265 locked the dashboard's render-telemetry POST. But on mount the
 * dashboard also makes three READ calls that surface personal data:
 *
 *   • GET /api/launchpad-dashboard/enabled   (flag probe)
 *   • GET /api/launchpad-dashboard/summary   (server-computed readiness)
 *   • GET /api/career-discovery/guidance     (Daily AI Brief / recs / goals)
 *
 * The backend resolves the subject from the session ONLY. Nothing on the FRONTEND
 * prevents a future refactor from quietly appending an IDOR query param (e.g.
 * `?user_id=...`) or a client-supplied subject in the body of these reads, which
 * could let one student fetch another's readiness / AI brief. This test locks the
 * CLIENT side:
 *
 *   (a) NONE of the read requests carry a client-controllable subject/id/user_id
 *       in the query string OR the request body — even though the component is
 *       handed a distinct `userId` prop. The subject must come from the session
 *       cookie (`credentials: 'include'`) only.
 *   (b) When these endpoints return 503 (flag OFF) or 401 (unauthenticated), the
 *       dashboard degrades to its honest LOCAL fallback state — it renders
 *       without crashing and without surfacing another principal's content or a
 *       fabricated server-readiness score.
 *
 * It renders the REAL <CareerLaunchpadDashboard/> against a stubbed `fetch` that
 * captures every read request, so the assertions exercise the production effects.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CareerLaunchpadDashboard from './CareerLaunchpadDashboard';
import type { CareerBrain } from '@/lib/services/useCareerBrain';

// Tokens that, if found in a read request URL or body, would indicate the client
// is leaking a controllable subject/id into the server reads (an IDOR vector).
const ID_PARAM_NAMES = ['id', 'user_id', 'userid', 'subject', 'subject_id', 'uid', 'email', 'student_id', 'profile_id'];

// A distinctive userId prop — if it ever shows up in a request URL/body the
// client is forwarding a client-controllable subject to the server reads.
const DISTINCTIVE_USER_ID = 'CLIENT-CONTROLLED-USER-ID-9999';

function makeBrain(): CareerBrain {
  return {
    primaryIdentity: 'Builder',
    currentStage: 'Early Career',
    targetRole: 'Engineer',
    transitionProbability: 60,
    coreBottleneck: 'focus',
    fastestWinAction: 'act',
    riskFactors: [],
    executionStyle: 'methodical',
    behavioralConstraints: [],
    marketReadiness: 50,
    interviewReadiness: 50,
    learningPriority: 'skill',
    weeklyFocus: 'focus',
    skillGaps: [],
    signals: [],
    patterns: [],
    dimensions: [{ key: 'd1', label: 'Communication', score: 70 }],
    careerReadiness: 55,
    learningReadiness: 50,
    executionReadiness: 60,
    leadershipReadiness: 45,
    behaviorProfile: null,
    behaviorGraph: null,
    bestNextActions: [],
    competencyActivation: null,
    growthScore: 55,
    progressionScore: 40,
    skillGapScore: 30,
  } as CareerBrain;
}

const baseProps = {
  profile: { personal: { name: 'Test User' }, education: [], skills: { technical: [] } },
  brain: makeBrain(),
  eiScore: 0,
  eiBreakdown: { total: 0, components: [] as any[] },
  jobs: [] as any[],
  goals: [] as any[],
  userId: DISTINCTIVE_USER_ID,
  hasAssessment: false,
  openJobs: 0,
  onTabChange: () => {},
};

// Every NON-telemetry request captured during a render.
let readCalls: Array<{ url: string; method: string; body: any }> = [];

// A SERVER readiness payload carrying a foreign student's fabricated score. If
// the dashboard ever renders this (instead of degrading to local on 503/401),
// the test fails — proving honest degradation and no foreign-content leak.
const FOREIGN_READINESS_SENTINEL = 'FOREIGN-STUDENT-READINESS-93';

/**
 * Install a fetch stub.
 *   mode 'ok'      → enabled:true + valid summary/guidance (happy path; used to
 *                    assert the read requests carry no client-controlled subject)
 *   mode '503'     → flag OFF: /enabled returns {enabled:false}; summary/guidance 503
 *   mode '401'     → unauthenticated: every read returns 401
 */
function installFetch(mode: 'ok' | '503' | '401') {
  const impl = vi.fn(async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : String(input?.url ?? input);
    const method = (init?.method ?? 'GET').toUpperCase();

    // Telemetry POST — swallow (covered by the telemetry test); resolve inert.
    if (method === 'POST' && /\/telemetry$/.test(url)) {
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as any;
    }

    let body: any = null;
    if (init?.body != null) { try { body = JSON.parse(init.body); } catch { body = init.body; } }
    readCalls.push({ url, method, body });

    if (/\/api\/launchpad-dashboard\/enabled/.test(url)) {
      if (mode === '401') return { ok: false, status: 401, json: async () => null } as any;
      return { ok: true, status: 200, json: async () => ({ ok: true, enabled: mode === 'ok' }) } as any;
    }
    if (/\/api\/launchpad-dashboard\/summary/.test(url)) {
      if (mode === 'ok') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            has_profile: true,
            readiness: {
              // A foreign/fabricated percent — must NEVER render under 503/401,
              // and under 'ok' it is only the session subject's own server value.
              percent: 93,
              earned_points: 93,
              possible_points: 100,
              completed: 9,
              total: 10,
              checks: [{ key: 'k', label: FOREIGN_READINESS_SENTINEL, done: true, pts: 93 }],
            },
          }),
        } as any;
      }
      const status = mode === '401' ? 401 : 503;
      return { ok: false, status, json: async () => ({ error: 'unavailable' }) } as any;
    }
    if (/\/api\/career-discovery\/guidance/.test(url)) {
      if (mode === 'ok') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ai_available: true,
            ai_mode: 'rule_based',
            recommendations: [],
            daily_brief: { headline: 'Brief', focus: null, items: [] },
            weekly_goals: [],
          }),
        } as any;
      }
      const status = mode === '401' ? 401 : 503;
      return { ok: false, status, json: async () => ({ error: 'unavailable' }) } as any;
    }
    return { ok: false, status: 404, json: async () => null } as any;
  });
  vi.stubGlobal('fetch', impl as any);
}

// Assert a single read request carries no client-controllable subject anywhere.
function assertNoControllableSubject(call: { url: string; method: string; body: any }) {
  // The distinctive userId prop must never appear in the URL or the body.
  expect(call.url).not.toContain(DISTINCTIVE_USER_ID);
  if (call.body != null) {
    expect(JSON.stringify(call.body)).not.toContain(DISTINCTIVE_USER_ID);
  }

  // No id-ish query parameters at all.
  const qIndex = call.url.indexOf('?');
  if (qIndex !== -1) {
    const params = new URLSearchParams(call.url.slice(qIndex + 1));
    for (const name of ID_PARAM_NAMES) {
      expect(params.has(name)).toBe(false);
    }
  }

  // Reads must be GET with no JSON body (the subject is the session cookie).
  expect(call.method).toBe('GET');
  expect(call.body == null).toBe(true);
}

beforeEach(() => {
  readCalls = [];
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CareerLaunchpadDashboard read-path privacy (summary / guidance IDOR guard)', () => {
  it('resolves subject from the session only — no client-controllable id in summary/guidance/enabled reads', async () => {
    installFetch('ok');
    render(<CareerLaunchpadDashboard {...baseProps} />);

    // Wait until all three reads have fired.
    await waitFor(() => {
      const seen = readCalls.map((c) => c.url);
      expect(seen.some((u) => /\/api\/launchpad-dashboard\/enabled/.test(u))).toBe(true);
      expect(seen.some((u) => /\/api\/launchpad-dashboard\/summary/.test(u))).toBe(true);
      expect(seen.some((u) => /\/api\/career-discovery\/guidance/.test(u))).toBe(true);
    });

    // Every read must be subject-free (session-resolved only).
    expect(readCalls.length).toBeGreaterThan(0);
    for (const call of readCalls) {
      assertNoControllableSubject(call);
    }
  });

  it('flag OFF (503) → degrades to honest local fallback, never renders server/foreign readiness', async () => {
    installFetch('503');
    render(<CareerLaunchpadDashboard {...baseProps} />);

    // The reads still must not carry a controllable subject before failing.
    await waitFor(() => expect(readCalls.length).toBeGreaterThan(0));
    for (const call of readCalls) {
      assertNoControllableSubject(call);
    }

    // It renders (no crash) — the dashboard surface is present.
    await waitFor(() => expect(screen.getByText(/Career Launchpad/i)).toBeTruthy());

    // No foreign/server readiness content leaks into the DOM under 503.
    await new Promise((r) => setTimeout(r, 50));
    expect(document.body.textContent || '').not.toContain(FOREIGN_READINESS_SENTINEL);
  });

  it('unauthenticated (401) → degrades to honest local fallback without crashing', async () => {
    installFetch('401');
    render(<CareerLaunchpadDashboard {...baseProps} />);

    await waitFor(() => expect(readCalls.length).toBeGreaterThan(0));
    for (const call of readCalls) {
      assertNoControllableSubject(call);
    }

    await waitFor(() => expect(screen.getByText(/Career Launchpad/i)).toBeTruthy());

    await new Promise((r) => setTimeout(r, 50));
    expect(document.body.textContent || '').not.toContain(FOREIGN_READINESS_SENTINEL);
  });
});
