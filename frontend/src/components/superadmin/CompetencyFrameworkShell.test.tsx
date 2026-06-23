/**
 * CompetencyFrameworkShell / CompetencyWizard guard tests.
 *
 * Two protections:
 *  1. Coverage check — every `competency-fw` extraTab id declared in
 *     SuperAdminDashboard.tsx must be assigned to EXACTLY ONE wizard step in
 *     COMPETENCY_WIZARD_STEPS. If someone adds a panel and forgets to place it
 *     in a step it silently disappears from the wizard view (only a DEV console
 *     warning fires today). This test fails the build instead.
 *  2. Smoke render — the wizard mounts, the Wizard<->All-tabs toggle flips the
 *     view, and key panels (ont-import-export, cmp-command-center) are
 *     reachable through the stepper / sub-nav.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CompetencyFrameworkShell, { COMPETENCY_WIZARD_STEPS } from './CompetencyFrameworkShell';
import type { FrameworkExtraTab } from '@/components/admin/FrameworkPanel';
import { COMPETENCY_CONFIG } from '@/components/admin/framework-configs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Extract the `competency-fw` extraTab ids straight from SuperAdminDashboard.tsx
 * source. We scope to the `extraTabs={[ ... ]}` block that lives inside the
 * `activeTab === 'competency-fw'` branch (ends where the sibling `tabGroups={[`
 * prop begins) so unrelated ids elsewhere in the file are never picked up.
 *
 * Flag-gated panels (rendered via `...(flag ? [{ id: ... }] : [])`) are still
 * matched, because the wizard taxonomy must place them too — when their flag is
 * off they are simply absent from extraTabs at runtime and skipped.
 *
 * The intentionally-omitted empty legacy built-in tabs (`domains`, `sub`,
 * `content`, `clusters`, `norms`, `weights`, `scoring`, `reports`) live in the
 * `tabGroups` prop, NOT in extraTabs, so they are naturally excluded here.
 */
function declaredExtraTabIds(): string[] {
  const src = readFileSync(path.resolve(__dirname, '../SuperAdminDashboard.tsx'), 'utf8');
  const branchIdx = src.indexOf("activeTab === 'competency-fw'");
  expect(branchIdx, "could not find the competency-fw branch in SuperAdminDashboard.tsx").toBeGreaterThan(-1);

  const extraStart = src.indexOf('extraTabs={[', branchIdx);
  expect(extraStart, "could not find extraTabs={[ for competency-fw").toBeGreaterThan(-1);

  const extraEnd = src.indexOf('tabGroups={[', extraStart);
  expect(extraEnd, "could not find the end (tabGroups={[) of the extraTabs block").toBeGreaterThan(extraStart);

  const block = src.slice(extraStart, extraEnd);
  const ids: string[] = [];
  const re = /\{\s*id:\s*'([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) ids.push(m[1]);
  return ids;
}

describe('COMPETENCY_WIZARD_STEPS coverage', () => {
  const extraTabIds = declaredExtraTabIds();
  const stepTabIds = COMPETENCY_WIZARD_STEPS.flatMap((s) => s.tabIds);

  it('parses a non-trivial set of extraTab ids from the dashboard source', () => {
    // Guards against the regex/scoping silently matching nothing and the
    // coverage assertions becoming vacuously true.
    expect(extraTabIds.length).toBeGreaterThan(20);
    expect(new Set(extraTabIds).size).toBe(extraTabIds.length); // no dupes in source
  });

  it('assigns every extraTab id to exactly one wizard step', () => {
    const counts = new Map<string, number>();
    stepTabIds.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));

    const missing = extraTabIds.filter((id) => !counts.has(id));
    expect(missing, `panel(s) missing from every wizard step (would vanish from the wizard view): ${missing.join(', ')}`).toEqual([]);

    const duplicated = extraTabIds.filter((id) => (counts.get(id) ?? 0) > 1);
    expect(duplicated, `panel(s) assigned to more than one wizard step: ${duplicated.join(', ')}`).toEqual([]);
  });

  it('does not reference unknown panel ids in any wizard step', () => {
    const declared = new Set(extraTabIds);
    const unknown = stepTabIds.filter((id) => !declared.has(id));
    expect(unknown, `wizard step(s) reference panel ids not declared in extraTabs: ${unknown.join(', ')}`).toEqual([]);
  });

  it('has no duplicate ids across wizard steps', () => {
    expect(new Set(stepTabIds).size).toBe(stepTabIds.length);
  });
});

// ── Smoke render ────────────────────────────────────────────────────────────
const Dot = () => <span data-testid="icon" />;

/** Build synthetic panels for every id referenced by the wizard taxonomy. */
function syntheticExtraTabs(): FrameworkExtraTab[] {
  const ids = Array.from(new Set(COMPETENCY_WIZARD_STEPS.flatMap((s) => s.tabIds)));
  return ids.map((id) => ({
    id,
    label: id,
    icon: Dot as any,
    node: <div data-testid={`panel-${id}`}>PANEL:{id}</div>,
  }));
}

function renderShell() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CompetencyFrameworkShell
        config={COMPETENCY_CONFIG}
        extraTabs={syntheticExtraTabs()}
        tabGroups={[]}
        hiddenTabs={['overview']}
        initialTab="cmp-command-center"
      />
    </QueryClientProvider>,
  );
}

describe('CompetencyFrameworkShell smoke', () => {
  it('mounts in the wizard view and shows the first step panel', () => {
    renderShell();
    // Default view = wizard; default step = first (Import), default panel =
    // ont-import-export.
    expect(screen.getByText('Build the Framework')).toBeInTheDocument();
    expect(screen.getByTestId('panel-ont-import-export')).toBeInTheDocument();
  });

  it('reaches cmp-command-center via the stepper and sub-nav', () => {
    renderShell();
    // Jump to the "Validate & Report" step.
    fireEvent.click(screen.getByText('Validate & Report'));
    // Within-step sub-nav exposes a Command Center button (label === id).
    fireEvent.click(screen.getByRole('button', { name: 'cmp-command-center' }));
    expect(screen.getByTestId('panel-cmp-command-center')).toBeInTheDocument();
  });

  it('toggles between the Wizard and All-tabs views', () => {
    renderShell();
    expect(screen.getByTestId('panel-ont-import-export')).toBeInTheDocument();

    // Switch to the classic all-tabs view.
    fireEvent.click(screen.getByRole('button', { name: /All tabs/i }));
    // initialTab=cmp-command-center → that panel renders in the classic view.
    expect(screen.getByTestId('panel-cmp-command-center')).toBeInTheDocument();

    // Switch back to the wizard.
    fireEvent.click(screen.getByRole('button', { name: /Wizard/i }));
    expect(screen.getByTestId('panel-ont-import-export')).toBeInTheDocument();
  });
});
