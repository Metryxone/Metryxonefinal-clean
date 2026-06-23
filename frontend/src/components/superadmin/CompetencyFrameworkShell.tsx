/**
 * CompetencyFrameworkShell — host for the Competency Framework admin area.
 *
 * Presents the same set of panels two ways and lets the user flip between them:
 *  • Wizard (default): a guided, deduplicated import→report pipeline.
 *  • All tabs (classic): the original grouped FrameworkPanel — unchanged.
 *
 * The panel NODES are owned by SuperAdminDashboard (where the lazy panels are
 * imported) and passed in via `extraTabs`, so neither view duplicates panel
 * logic. The classic view is byte-identical to the previous behaviour.
 */
import { useState } from 'react';
import {
  Upload, Boxes, Briefcase, FileCheck, Calculator, Search,
  LayoutGrid, ListTree,
} from 'lucide-react';
import FrameworkPanel, { type FrameworkExtraTab, type TabGroup } from '@/components/admin/FrameworkPanel';
import type { FwConfig } from '@/components/admin/framework-configs';
import CompetencyWizard, { type WizardStep } from '@/components/superadmin/CompetencyWizard';

// ── Wizard pipeline taxonomy ────────────────────────────────────────────────
// Every non-legacy panel id appears in EXACTLY ONE step (dedup). Ids that are
// flag-gated and absent from extraTabs are silently skipped by the wizard.
export const COMPETENCY_WIZARD_STEPS: WizardStep[] = [
  {
    id: 'import',
    title: 'Import & Reference Data',
    description: 'Bring in the O*NET reference library — industries, functions, departments and roles — and import or export source data.',
    icon: Upload,
    tabIds: [
      'ont-import-export', 'ont-overview',
      'ont-sectors', 'ont-industries', 'ont-industry-segments',
      'ont-functions', 'ont-departments', 'ont-role-families', 'ont-roles', 'ont-role-crosswalk',
    ],
  },
  {
    id: 'framework',
    title: 'Build the Framework',
    description: 'Define the competency genome — layers, clusters, competencies, micro-competencies, levels and future skills.',
    icon: Boxes,
    tabIds: [
      'cmp-master', 'cmp-micro-framework',
      'ont-layers', 'ont-clusters', 'ont-competencies', 'ont-micro-competencies',
      'ont-competency-levels', 'cmp-level-profiles', 'ont-indicators', 'ont-future-skills',
    ],
  },
  {
    id: 'roles',
    title: 'Map Roles & Pathways',
    description: 'Connect competencies to roles, blueprints and career/learning pathways.',
    icon: Briefcase,
    tabIds: [
      'cmp-role-profile', 'cmp-role-families',
      'cmp-blueprints', 'cmp-blueprint-mappings',
      'ont-career-tracks', 'ont-career-paths', 'ont-learning-paths',
    ],
  },
  {
    id: 'questions',
    title: 'Author Questions',
    description: 'Build and map assessment content — questions, question bank, custom modules and concern mappings.',
    icon: FileCheck,
    tabIds: [
      'cmp-questions', 'cmp-questionbank', 'cmp-question-map',
      'cmp-custom-modules', 'cmp-assessment-mapping',
      'ont-assessment-questions', 'ont-concerns', 'ont-ai-rules',
    ],
  },
  {
    id: 'scoring',
    title: 'Scoring & Benchmarks',
    description: 'Configure how results are measured — norms, scoring rules and benchmarks.',
    icon: Calculator,
    tabIds: ['cmp-scoring', 'ont-benchmarks'],
  },
  {
    id: 'validate',
    title: 'Validate & Report',
    description: 'Search the framework, review intelligence and surface the reporting output.',
    icon: Search,
    tabIds: ['cmp-search-discovery', 'cmp-intelligence', 'cmp-framework-intel', 'cmp-command-center'],
  },
];

export default function CompetencyFrameworkShell({
  config,
  extraTabs,
  tabGroups,
  initialTab,
  hiddenTabs,
  onNavigateToReports,
}: {
  config: FwConfig;
  extraTabs: FrameworkExtraTab[];
  tabGroups: TabGroup[];
  initialTab?: string;
  hiddenTabs?: string[];
  /** Hand-off from the wizard's final step to the Unified Reports console. */
  onNavigateToReports?: () => void;
}) {
  const [view, setView] = useState<'wizard' | 'classic'>('wizard');
  const color = config.color;

  const toggle = (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Competency Framework</h2>
        <p className="text-xs text-gray-500">
          {view === 'wizard'
            ? 'Guided setup — follow the steps from data import through to reporting.'
            : 'All panels, grouped. Switch to the guided wizard for a simpler flow.'}
        </p>
      </div>
      <div className="flex flex-shrink-0 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
        {([
          { key: 'wizard', label: 'Wizard', icon: LayoutGrid },
          { key: 'classic', label: 'All tabs', icon: ListTree },
        ] as const).map((opt) => {
          const Icon = opt.icon;
          const active = view === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => setView(opt.key)}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all"
              style={{
                backgroundColor: active ? '#fff' : 'transparent',
                color: active ? color : '#6b7280',
                boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              <Icon className="h-3.5 w-3.5" />
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div>
      {toggle}
      {view === 'wizard' ? (
        <CompetencyWizard extraTabs={extraTabs} steps={COMPETENCY_WIZARD_STEPS} color={color} onNavigateToReports={onNavigateToReports} />
      ) : (
        <FrameworkPanel
          config={config}
          hiddenTabs={hiddenTabs}
          initialTab={initialTab}
          extraTabs={extraTabs}
          tabGroups={tabGroups}
        />
      )}
    </div>
  );
}
