/**
 * GlobalRegionContentPanel — destructive-action confirmation guard tests.
 *
 * The panel gates every overlay-row deletion behind an AlertDialog. These tests
 * prove the guard cannot be bypassed: NO call to the rollback API fires until the
 * user presses "Confirm", and pressing "Cancel" issues no network call at all.
 *
 * Coverage for all three removal paths:
 *   1. per-item untag        (button-untag-<surface>-<ref>)   → targeted POST {entity_refs:[one]}
 *   2. multi-ref "Untag all" (button-untag-all-<surface>)     → targeted POST {entity_refs:[many]}
 *   3. danger-zone bulk wipe (button-bulk-rollback)           → empty-body POST {}
 *
 * The rollback endpoint is the single destructive surface for all three (the UI
 * routes targeted untags and the bulk wipe through POST /rollback), so a regression
 * that lets any path fire without confirmation shows up as an unexpected /rollback call.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GlobalRegionContentPanel from './GlobalRegionContentPanel';

const BASE = '/api/global-competency';

function makeOkResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

// A non-default region (EU) is required for the untag controls to render — the
// default region (IN) inherits base content and is read-only. EU has one surface
// ("Roles") carrying TWO items so both the per-item and the "Untag all (2)"
// controls appear.
const REGISTRY = {
  ok: true,
  default_region: 'IN',
  regions: [
    { code: 'IN', name: 'India', is_default: true },
    { code: 'EU', name: 'Europe', is_default: false },
  ],
  surfaces: [{ key: 'roles', label: 'Roles' }],
};

const COVERAGE = {
  ok: true,
  overlay_table_present: true,
  default_region: 'IN',
  regions: [
    {
      code: 'IN',
      name: 'India',
      is_default: true,
      surfaces: [{ surface: 'roles', label: 'Roles', backing_table: 'onto_roles', effective_content: 10, has_content: true }],
      surfaces_with_content: 1,
      total_effective_content: 10,
    },
    {
      code: 'EU',
      name: 'Europe',
      is_default: false,
      surfaces: [{ surface: 'roles', label: 'Roles', backing_table: 'onto_roles', effective_content: 2, has_content: true }],
      surfaces_with_content: 1,
      total_effective_content: 2,
    },
  ],
};

const EU_CONTENT = {
  ok: true,
  region: 'EU',
  name: 'Europe',
  is_default: false,
  surfaces: [
    {
      surface: 'roles',
      label: 'Roles',
      backing_table: 'onto_roles',
      source: 'overlay',
      localized: true,
      count: 2,
      items: [
        { entity_ref: 'role_a', label: 'Role A' },
        { entity_ref: 'role_b', label: 'Role B' },
      ],
    },
  ],
};

const AUDIT = { ok: true, present: true, entries: [], limit: 50 };

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <GlobalRegionContentPanel />
    </QueryClientProvider>,
  );
}

describe('GlobalRegionContentPanel — destructive-action confirmation', () => {
  let fetchMock: ReturnType<typeof vi.spyOn>;

  // Count only calls to the destructive endpoint (POST /rollback).
  const rollbackCalls = () =>
    fetchMock.mock.calls.filter(
      ([url, init]) =>
        url.toString().includes(`${BASE}/rollback`) &&
        (init as RequestInit | undefined)?.method === 'POST',
    );

  beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      const u = url.toString();
      if (u.includes(`${BASE}/regions`)) return Promise.resolve(makeOkResponse(REGISTRY));
      if (u.includes(`${BASE}/coverage`)) return Promise.resolve(makeOkResponse(COVERAGE));
      if (u.includes(`${BASE}/content/EU`)) return Promise.resolve(makeOkResponse(EU_CONTENT));
      if (u.includes(`${BASE}/content/IN`)) return Promise.resolve(makeOkResponse({ ok: true, region: 'IN', name: 'India', is_default: true, surfaces: [] }));
      if (u.includes(`${BASE}/audit`)) return Promise.resolve(makeOkResponse(AUDIT));
      if (u.includes(`${BASE}/rollback`)) return Promise.resolve(makeOkResponse({ ok: true, written: 1 }));
      return Promise.resolve(makeOkResponse({ ok: true }));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Switch to the non-default EU region and wait for its content (with the two
  // role items) to render so the untag controls are present.
  async function selectEuRegion(user: ReturnType<typeof userEvent.setup>) {
    const euBtn = await screen.findByTestId('button-region-EU', {}, { timeout: 3000 });
    await user.click(euBtn);
    await screen.findByTestId('item-roles-role_a', {}, { timeout: 3000 });
  }

  it('per-item untag: opens the confirm dialog and does NOT call the rollback API until Confirm', async () => {
    const user = userEvent.setup();
    renderPanel();
    await selectEuRegion(user);

    // Clicking the trash control opens the dialog but must not fire the API.
    await user.click(screen.getByTestId('button-untag-roles-role_a'));
    expect(await screen.findByTestId('dialog-confirm-removal')).toBeInTheDocument();
    expect(rollbackCalls()).toHaveLength(0);

    // Only after Confirm does the targeted rollback POST fire with the single ref.
    await user.click(screen.getByTestId('button-confirm-removal'));
    await waitFor(() => expect(rollbackCalls()).toHaveLength(1), { timeout: 3000 });

    const body = JSON.parse((rollbackCalls()[0][1] as RequestInit).body as string);
    expect(body).toMatchObject({ surface: 'roles', region: 'EU', entity_refs: ['role_a'] });

    // Dialog closes after a successful confirm.
    await waitFor(() => expect(screen.queryByTestId('dialog-confirm-removal')).not.toBeInTheDocument(), { timeout: 3000 });
  }, 15000);

  it('multi-ref "Untag all (N)": opens the dialog and only fires on Confirm with all refs', async () => {
    const user = userEvent.setup();
    renderPanel();
    await selectEuRegion(user);

    await user.click(screen.getByTestId('button-untag-all-roles'));
    expect(await screen.findByTestId('dialog-confirm-removal')).toBeInTheDocument();
    expect(rollbackCalls()).toHaveLength(0);

    await user.click(screen.getByTestId('button-confirm-removal'));
    await waitFor(() => expect(rollbackCalls()).toHaveLength(1), { timeout: 3000 });

    const body = JSON.parse((rollbackCalls()[0][1] as RequestInit).body as string);
    expect(body).toMatchObject({ surface: 'roles', region: 'EU' });
    expect(body.entity_refs).toEqual(['role_a', 'role_b']);
  }, 15000);

  it('danger-zone bulk rollback: opens the dialog and only fires an empty-body POST on Confirm', async () => {
    const user = userEvent.setup();
    renderPanel();
    await selectEuRegion(user);

    await user.click(screen.getByTestId('button-bulk-rollback'));
    expect(await screen.findByTestId('dialog-confirm-removal')).toBeInTheDocument();
    expect(rollbackCalls()).toHaveLength(0);

    await user.click(screen.getByTestId('button-confirm-removal'));
    await waitFor(() => expect(rollbackCalls()).toHaveLength(1), { timeout: 3000 });

    // Bulk wipe sends an empty body (no surface / region / entity_refs).
    const body = JSON.parse((rollbackCalls()[0][1] as RequestInit).body as string);
    expect(body).toEqual({});
  }, 15000);

  it('Cancel closes the dialog and issues NO rollback call (per-item path)', async () => {
    const user = userEvent.setup();
    renderPanel();
    await selectEuRegion(user);

    await user.click(screen.getByTestId('button-untag-roles-role_a'));
    expect(await screen.findByTestId('dialog-confirm-removal')).toBeInTheDocument();

    await user.click(screen.getByTestId('button-cancel-removal'));
    await waitFor(() => expect(screen.queryByTestId('dialog-confirm-removal')).not.toBeInTheDocument(), { timeout: 3000 });

    // No destructive call was ever made.
    expect(rollbackCalls()).toHaveLength(0);
  }, 15000);

  it('Cancel on the bulk danger-zone path also issues NO rollback call', async () => {
    const user = userEvent.setup();
    renderPanel();
    await selectEuRegion(user);

    await user.click(screen.getByTestId('button-bulk-rollback'));
    expect(await screen.findByTestId('dialog-confirm-removal')).toBeInTheDocument();

    await user.click(screen.getByTestId('button-cancel-removal'));
    await waitFor(() => expect(screen.queryByTestId('dialog-confirm-removal')).not.toBeInTheDocument(), { timeout: 3000 });

    expect(rollbackCalls()).toHaveLength(0);
  }, 15000);
});
