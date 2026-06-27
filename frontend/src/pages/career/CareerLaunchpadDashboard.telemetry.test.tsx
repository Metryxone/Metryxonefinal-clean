/**
 * Career Launchpad Dashboard — Telemetry Privacy / Flag-Routing Regression Test
 * ----------------------------------------------------------------------------
 * MX-302C — the dashboard fires a single render-telemetry POST per mount. The
 * backend test (`backend/tests/launchpad-dashboard-privacy.test.ts`) locks the
 * server's flag-gate + IDOR guarantees, but nothing on the FRONTEND prevents a
 * future refactor from accidentally putting profile content (names, emails,
 * scores, free text) into the telemetry body. This test locks the CLIENT side:
 *
 *   (a) the POST body is metadata-only — it contains EXACTLY `event`,
 *       `widgets_total`, `widgets_with_data`, `ai_mode`, and a
 *       boolean-valued `widget_availability` map, and never any
 *       profile / resume / competency content (no names, emails, scores,
 *       free text, skills) even when those fields are richly populated.
 *   (b) the endpoint is chosen by the flag state — `/api/launchpad-dashboard/
 *       telemetry` when the launchpadDashboard flag is ON, and the legacy
 *       `/api/career-launchpad/telemetry` when OFF — and it fires EXACTLY ONCE
 *       per render (the `telemetrySent` ref guards against re-fire on re-render).
 *
 * It renders the REAL <CareerLaunchpadDashboard/> against a stubbed `fetch` that
 * resolves the `/enabled` probe + `/guidance` snapshot and captures every
 * telemetry POST — so the assertions exercise the actual production effect.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import CareerLaunchpadDashboard from './CareerLaunchpadDashboard';
import type { CareerBrain } from '@/lib/services/useCareerBrain';

// ── Distinctive PII / content sentinels seeded into the profile + brain. If ANY
//    of these strings appears in the telemetry body, profile content leaked. ──
const SENTINELS = [
  'Ada Lovelace',
  'ada.secret@example.com',
  'SECRET_SUMMARY_NARRATIVE',
  'CONFIDENTIAL_SKILL',
  'TopSecretTargetRole',
  '+1-555-PRIVATE',
];

const ALLOWED_KEYS = ['event', 'widgets_total', 'widgets_with_data', 'ai_mode', 'widget_availability'];

// A fully-populated profile carrying every PII sentinel across the fields the
// dashboard widgets read (personal / summary / skills / experience / target).
const RICH_PROFILE = {
  personal: { name: 'Ada Lovelace', email: 'ada.secret@example.com', phone: '+1-555-PRIVATE' },
  email: 'ada.secret@example.com',
  summary: 'SECRET_SUMMARY_NARRATIVE',
  targetRole: 'TopSecretTargetRole',
  resumeBuilt: true,
  linkedin: 'https://linkedin.com/in/ada',
  github: 'https://github.com/ada',
  photo: 'data:image/png;base64,xxx',
  skills: { technical: ['CONFIDENTIAL_SKILL', 'CONFIDENTIAL_SKILL_2', 'CONFIDENTIAL_SKILL_3'] },
  experience: [{ company: 'SecretCorp', role: 'TopSecretTargetRole' }],
  education: [{ degree: 'BSc', school: 'Secret University' }],
  certifications: [{ name: 'Secret Cert' }],
  projects: [{ title: 'Secret Project', type: 'Internship' }],
  competencyProfile: { completeness: 88, assessmentDone: true },
};

// A fully-populated brain so the availability map is mostly `true` — proving the
// map is BOOLEAN-valued, never the underlying (sensitive) numbers / labels.
function makeBrain(): CareerBrain {
  return {
    primaryIdentity: 'Builder',
    currentStage: 'Early Career',
    targetRole: 'TopSecretTargetRole',
    transitionProbability: 72,
    coreBottleneck: 'SECRET_SUMMARY_NARRATIVE',
    fastestWinAction: 'do the secret thing',
    riskFactors: ['CONFIDENTIAL_SKILL gap'],
    executionStyle: 'methodical',
    behavioralConstraints: [],
    marketReadiness: 60,
    interviewReadiness: 55,
    learningPriority: 'CONFIDENTIAL_SKILL',
    weeklyFocus: 'focus',
    skillGaps: [],
    signals: [],
    patterns: [],
    dimensions: [{ key: 'd1', label: 'Communication', score: 70 }],
    careerReadiness: 65,
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
  profile: RICH_PROFILE,
  brain: makeBrain(),
  eiScore: 77,
  eiBreakdown: { total: 77, components: [] as any[] },
  jobs: [] as any[],
  goals: [] as any[],
  userId: 'self-user-001',
  hasAssessment: true,
  openJobs: 3,
  onTabChange: () => {},
};

// Telemetry POSTs captured during a render.
let telemetryCalls: Array<{ url: string; body: any }> = [];

// Build a fetch stub that resolves the /enabled probe to `enabled`, returns an
// honest (no-server-readiness) summary, a populated guidance snapshot, and
// records every telemetry POST. Any other call resolves to an inert 404.
function installFetch(enabled: boolean) {
  const impl = vi.fn(async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : String(input?.url ?? input);
    const method = (init?.method ?? 'GET').toUpperCase();

    if (method === 'POST' && /\/telemetry$/.test(url)) {
      let body: any = null;
      try { body = JSON.parse(init?.body ?? '{}'); } catch { body = init?.body; }
      telemetryCalls.push({ url, body });
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as any;
    }
    if (/\/api\/launchpad-dashboard\/enabled/.test(url)) {
      return { ok: true, status: 200, json: async () => ({ ok: true, enabled }) } as any;
    }
    if (/\/api\/launchpad-dashboard\/summary/.test(url)) {
      // Honest: no server readiness → component falls back to local (still renders).
      return { ok: true, status: 200, json: async () => ({ ok: true, has_profile: false, readiness: null }) } as any;
    }
    if (/\/api\/career-discovery\/guidance/.test(url)) {
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
    return { ok: false, status: 404, json: async () => null } as any;
  });
  vi.stubGlobal('fetch', impl as any);
}

beforeEach(() => {
  telemetryCalls = [];
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CareerLaunchpadDashboard render telemetry', () => {
  it('flag ON → posts metadata-only body to the MX-302C surface (no profile content)', async () => {
    installFetch(true);
    render(<CareerLaunchpadDashboard {...baseProps} />);

    await waitFor(() => expect(telemetryCalls.length).toBe(1));

    const { url, body } = telemetryCalls[0];
    expect(url).toContain('/api/launchpad-dashboard/telemetry');

    // (a) body shape: EXACTLY the five allowed keys, nothing more.
    expect(Object.keys(body).sort()).toEqual([...ALLOWED_KEYS].sort());
    expect(body.event).toBe('dashboard_render');
    expect(typeof body.widgets_total).toBe('number');
    expect(typeof body.widgets_with_data).toBe('number');
    expect(body.widgets_with_data).toBeLessThanOrEqual(body.widgets_total);

    // widget_availability is a map of boolean values ONLY.
    expect(body.widget_availability && typeof body.widget_availability).toBe('object');
    const vals = Object.values(body.widget_availability);
    expect(vals.length).toBe(body.widgets_total);
    expect(vals.every((v) => typeof v === 'boolean')).toBe(true);
    // widgets_with_data must equal the count of `true` entries (derived, honest).
    expect(body.widgets_with_data).toBe(vals.filter(Boolean).length);

    // ai_mode is a short enum string (or null) — never free-text content.
    expect(body.ai_mode === null || ['llm', 'rule_based'].includes(body.ai_mode)).toBe(true);

    // (a) NO profile / resume / competency content anywhere in the serialized body.
    const serialized = JSON.stringify(body);
    for (const s of SENTINELS) {
      expect(serialized).not.toContain(s);
    }
  });

  it('flag OFF → posts to the legacy surface, still metadata-only', async () => {
    installFetch(false);
    render(<CareerLaunchpadDashboard {...baseProps} />);

    await waitFor(() => expect(telemetryCalls.length).toBe(1));

    const { url, body } = telemetryCalls[0];
    expect(url).toContain('/api/career-launchpad/telemetry');
    expect(url).not.toContain('/api/launchpad-dashboard/telemetry');

    expect(Object.keys(body).sort()).toEqual([...ALLOWED_KEYS].sort());
    const serialized = JSON.stringify(body);
    for (const s of SENTINELS) {
      expect(serialized).not.toContain(s);
    }
  });

  it('fires EXACTLY once per render (re-render does not re-fire)', async () => {
    installFetch(true);
    const { rerender } = render(<CareerLaunchpadDashboard {...baseProps} />);

    await waitFor(() => expect(telemetryCalls.length).toBe(1));

    // Re-render the SAME instance with new props → the telemetrySent ref guards.
    rerender(<CareerLaunchpadDashboard {...baseProps} eiScore={80} openJobs={5} />);
    await new Promise((r) => setTimeout(r, 50));
    expect(telemetryCalls.length).toBe(1);
  });
});
