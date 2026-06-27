/**
 * DashboardTab new-user welcome gate.
 *
 * The Command Center (DashboardTab) branches between:
 *   1. A brand-new-user welcome / onboarding screen ("Build my profile") when
 *      the profile has NO real signal, and
 *   2. The full data-driven dashboard once ANY real signal exists
 *      (skills / experience / education / certifications / projects / summary /
 *      completeness / EI score / goals).
 *
 * These tests lock that gate (`hasProfileSignal`) so a regression can't either
 * re-expose the old empty-profile error fallback (by rendering the data widgets
 * for an empty profile) or hide the real dashboard from active users (by
 * showing the welcome screen when signal exists).
 *
 * The network-backed hook `useHybridEI` is mocked to a stable, inert shape so
 * the test never depends on a backend; the other in-component fetches
 * (peer-benchmark, LBI card) early-return without versions / email and are
 * additionally guarded by a no-op global fetch stub.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Inert hybrid-EI hook: no network, stable client preview only.
vi.mock('@/lib/hooks/useHybridEI', () => ({
  useHybridEI: () => ({
    preview: { score: 0, components: [] },
    official: null,
    trusted: null,
    trust: null,
    resolution: null,
    confidence: 0,
    confidenceDetail: null,
    versions: null,
    isLoading: false,
    isOfficial: false,
    fallbackUsed: false,
    lastSyncedAt: null,
    refresh: () => {},
  }),
}));

import { DashboardTab } from './CareerBuilderPage';

const baseProps = {
  loading: false,
  eiScore: 0,
  eiBreakdown: { total: 0, components: [] as any[] },
  jobs: [] as any[],
  goals: [] as any[],
  onTabChange: () => {},
  onNavigate: () => {},
  onOpenWizard: () => {},
  userId: 'test-user',
};

beforeEach(() => {
  // peer-benchmark / LBI fetches are guarded, but stub fetch so nothing in the
  // jsdom env throws on an unexpected call.
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve(null) })) as any);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderDashboard(profile: any) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DashboardTab {...baseProps} profile={profile} />
    </QueryClientProvider>,
  );
}

describe('DashboardTab new-user welcome gate', () => {
  it('shows the welcome / onboarding screen for an empty profile', () => {
    const emptyProfile = {
      personal: { name: 'Ada Lovelace' },
      skills: { technical: [] },
      experience: [],
      education: [],
      certifications: [],
      projects: [],
    };

    renderDashboard(emptyProfile);

    // Welcome hero + primary onboarding CTA.
    expect(screen.getByText('Build my profile')).toBeInTheDocument();
    expect(screen.getByText('Three quick steps to get started')).toBeInTheDocument();

    // The full dashboard's Command Center header must NOT render.
    expect(screen.queryByText('Career Command Center')).not.toBeInTheDocument();
  });

  it('renders the full dashboard once any real signal exists (one technical skill)', () => {
    const profileWithSignal = {
      personal: { name: 'Ada Lovelace' },
      skills: { technical: ['TypeScript'] },
      experience: [],
      education: [],
      certifications: [],
      projects: [],
    };

    renderDashboard(profileWithSignal);

    // Welcome screen must be gone...
    expect(screen.queryByText('Build my profile')).not.toBeInTheDocument();
    expect(screen.queryByText('Three quick steps to get started')).not.toBeInTheDocument();

    // ...and the full dashboard's Command Center header must render.
    expect(screen.getByText('Career Command Center')).toBeInTheDocument();
  });
});
