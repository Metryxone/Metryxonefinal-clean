/**
 * FrameworkPanel — unified admin panel used by all 3 frameworks
 * (LBI, Professional Competency, SDI). Config-driven so the tab
 * structure, labels and API paths differ but the layout is identical.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Sparkles, Layers, Target, FileSpreadsheet, GitBranch,
  BarChart3, Sliders, History, Search, AlertCircle,
  Calculator, FileText, HeartHandshake, ClipboardList, HelpCircle,
  Network,
} from 'lucide-react';
import {
  ClustersTab, NormsTab, WeightsTab, VersionsTab,
  ScoringTab, ReportsTab,
} from '@/components/admin/parity-tabs';
import { CrudTable } from '@/components/admin/CrudTable';
import { ImportExportButton } from '@/components/admin/ImportExportPanel';
import ConcernAreasPanel from '@/components/superadmin/ConcernAreasPanel';
import CapadexConcernsMasterPanel from '@/components/superadmin/CapadexConcernsMasterPanel';
import CapadexClarityQuestionsPanel from '@/components/superadmin/CapadexClarityQuestionsPanel';
import SignalOntologyHubPanel from '@/components/superadmin/SignalOntologyHubPanel';
import ShortAssessmentsPanel from '@/components/superadmin/ShortAssessmentsPanel';
import type { FwConfig } from '@/components/admin/framework-configs';

export type { FwConfig };

// ─── Safe fetch ────────────────────────────────────────────────────────────
async function safeFetch<T>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

// ─── Tab types ─────────────────────────────────────────────────────────────
type PanelTab = 'overview' | 'domains' | 'sub' | 'content' | 'clusters' | 'norms' | 'weights' | 'scoring' | 'reports' | 'concerns' | 'clarity' | 'signalontology' | 'questions' | 'shortassessments' | 'versions';

const ALL_PANEL_TABS: { id: PanelTab; label: string; icon: any; requiresConfig?: keyof FwConfig }[] = [
  { id: 'overview',        label: 'Overview',          icon: Sparkles                                                    },
  { id: 'domains',         label: 'Domains',           icon: Layers                                                      },
  { id: 'sub',             label: 'Sub',               icon: Target                                                      },
  { id: 'content',         label: 'Content',           icon: FileSpreadsheet                                             },
  { id: 'clusters',        label: 'Clusters',          icon: GitBranch                                                   },
  { id: 'norms',           label: 'Norms',             icon: BarChart3                                                   },
  { id: 'weights',         label: 'Weights',           icon: Sliders                                                     },
  { id: 'scoring',         label: 'Scoring',           icon: Calculator,     requiresConfig: 'scoringRulesApi'           },
  { id: 'reports',         label: 'Reports',           icon: FileText,       requiresConfig: 'reportTypesApi'            },
  { id: 'concerns',        label: 'Concern Areas',     icon: HeartHandshake, requiresConfig: 'concernsApi'              },
  { id: 'clarity',         label: 'Clarity Questions', icon: HelpCircle,     requiresConfig: 'clarityQuestionsPanel'    },
  { id: 'signalontology',  label: 'Signal Ontology',   icon: Network,        requiresConfig: 'signalOntologyPanel'      },
  { id: 'questions',       label: 'Question Bank',     icon: HelpCircle,     requiresConfig: 'questionsApi'              },
  { id: 'shortassessments',label: 'Short Assessments', icon: ClipboardList,  requiresConfig: 'shortAssessmentsPanel'    },
  { id: 'versions',        label: 'Versions',          icon: History,        requiresConfig: 'versionsApi'               },
];

// ─── Main Panel ────────────────────────────────────────────────────────────
export default function FrameworkPanel({ config, initialTab }: { config: FwConfig; initialTab?: PanelTab }) {
  const [tab, setTab] = useState<PanelTab>(initialTab ?? 'overview');

  const tabs = ALL_PANEL_TABS
    .filter(t => !t.requiresConfig || !!config[t.requiresConfig])
    .map(t => ({
      ...t,
      label: t.id === 'sub' ? config.subLabel : t.label,
    }));

  return (
    <div className="space-y-4">
      {/* Inner tab bar */}
      <div className="flex flex-wrap gap-1 border-b pb-0">
        {tabs.map(t => {
          const active = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border-b-2 -mb-px transition-all"
              style={{
                borderBottomColor: active ? config.color : 'transparent',
                color: active ? config.color : '#6b7280',
              }}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div>
        {tab === 'overview' && <OverviewTab config={config} />}

        {tab === 'domains' && (
          <CrudTable
            apiPath={config.domainsApi}
            adminApiPath={config.domainsAdminApi}
            cols={config.domainCols}
            fields={config.domainFields}
            title="Domain"
            color={config.color}
            invalidateKeys={[config.overviewApi, config.summaryApi]}
          />
        )}

        {tab === 'sub' && (
          <CrudTable
            apiPath={config.subApi}
            adminApiPath={config.subAdminApi}
            cols={config.subCols}
            fields={config.subFields}
            title={config.subLabel.replace(/s$/, '')}
            color={config.color}
            invalidateKeys={[config.overviewApi, config.summaryApi]}
          />
        )}

        {tab === 'content' && <ContentTab config={config} />}

        {tab === 'clusters' && (
          <ClustersTab
            basePath={config.clustersApi}
            subdomainsPath={config.clusterSubsApi}
            codeField={config.clusterCodeField}
            nameField={config.clusterNameField}
            groupField={config.clusterGroupField}
          />
        )}

        {tab === 'norms' && (
          <NormsTab
            basePath={config.normsApi}
            stagesPath={config.normsStagesApi}
            stageKey={config.normsStageKey}
            stageLabel={config.normsStageLabel}
            generatePath={config.generateDefaultsApi}
          />
        )}

        {tab === 'weights' && (
          <WeightsTab
            basePath={config.weightsApi}
            stagesPath={config.weightsStagesApi}
            stageKey={config.weightsStageKey}
            stageLabel={config.weightsStageLabel}
            generatePath={config.generateDefaultsApi}
          />
        )}

        {tab === 'scoring' && config.scoringRulesApi && (
          <ScoringTab
            scoringApi={config.scoringRulesApi}
            anchorItemsApi={config.anchorItemsApi}
            color={config.color}
            frameworkName={config.name}
          />
        )}

        {tab === 'reports' && config.reportTypesApi && (
          <ReportsTab
            reportTypesApi={config.reportTypesApi}
            clusterCorrelationsApi={config.clusterCorrelationsApi}
            color={config.color}
            frameworkName={config.name}
          />
        )}

        {tab === 'concerns' && config.concernsApi && (
          config.concernsKind === 'capadex-master'
            ? <CapadexConcernsMasterPanel />
            : <ConcernAreasPanel />
        )}

        {tab === 'clarity' && config.clarityQuestionsPanel && (
          <CapadexClarityQuestionsPanel />
        )}

        {tab === 'signalontology' && config.signalOntologyPanel && (
          <SignalOntologyHubPanel />
        )}

        {tab === 'questions' && config.questionsApi && config.questionsCols && config.questionsFields && (
          <CrudTable
            apiPath={config.questionsApi}
            adminApiPath={config.questionsApi}
            cols={config.questionsCols}
            fields={config.questionsFields}
            title="Adaptive Question"
            color={config.color}
            invalidateKeys={[config.questionsApi]}
          />
        )}

        {tab === 'shortassessments' && config.shortAssessmentsPanel && (
          <ShortAssessmentsPanel />
        )}

        {tab === 'versions' && config.versionsApi && (
          <VersionsTab
            basePath={config.versionsApi}
            summaryPath={config.summaryApi}
          />
        )}
      </div>
    </div>
  );
}

// ─── Overview Tab ──────────────────────────────────────────────────────────
function OverviewTab({ config }: { config: FwConfig }) {
  const live = useQuery<Record<string, number | null>>({
    queryKey: [config.overviewApi],
    queryFn: () => safeFetch(config.overviewApi),
    retry: 1,
    staleTime: 30_000,
  });

  const liveOk = live.isSuccess && live.data && !live.isError;

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm" style={{ borderLeft: `4px solid ${config.color}` }}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-1">{config.name}</h3>
              <p className="text-sm text-gray-500">{config.tagline}</p>
            </div>
            {config.exportApi && config.importApi && config.exportTypes && (
              <ImportExportButton
                exportApi={config.exportApi}
                importApi={config.importApi}
                exportTypes={config.exportTypes}
                color={config.color}
                frameworkName={config.name}
              />
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {config.staticStats.map(s => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold" style={{ color: config.color }}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4" style={{ color: config.color }} />
            Live Database Counts
            {live.isLoading && (
              <span className="text-xs text-gray-400 font-normal animate-pulse">loading…</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {liveOk && live.data ? (
            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {Object.entries(live.data)
                .filter(([, v]) => v !== null && v !== undefined)
                .map(([k, v]) => (
                  <div
                    key={k}
                    className="rounded-lg p-3 text-center"
                    style={{ backgroundColor: config.accentBg }}
                  >
                    <div className="text-xl font-bold text-gray-900">{v as number}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5 capitalize">
                      {k.replace(/_/g, ' ')}
                    </div>
                  </div>
                ))}
            </div>
          ) : live.isLoading ? (
            <div className="grid grid-cols-4 gap-3">
              {[1,2,3,4].map(i => (
                <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 text-sm rounded-lg px-4 py-3 border
              border-amber-100 bg-amber-50 text-amber-700">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>
                  {live.error && String(live.error).includes('401')
                    ? 'Not authenticated — session may have expired. Log out and log back in as super admin.'
                    : 'Live counts unavailable — database tables may not be migrated yet for this framework.'}
                </span>
              </div>
              <button
                onClick={() => live.refetch()}
                className="shrink-0 text-xs font-semibold px-3 py-1 rounded-md border border-amber-400 hover:bg-amber-100 transition-colors"
              >
                Retry
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Content / Items Tab ───────────────────────────────────────────────────
function ContentTab({ config }: { config: FwConfig }) {
  if (config.itemsType === 'lbi') return <LbiItems config={config} />;

  // SDI and Competency — use CrudTable if itemsApi/itemsAdminApi are set
  if (config.itemsApi && config.itemsAdminApi && config.itemsCols && config.itemsFields) {
    return (
      <CrudTable
        apiPath={config.itemsApi}
        adminApiPath={config.itemsAdminApi}
        cols={config.itemsCols}
        fields={config.itemsFields}
        title="Item"
        color={config.color}
        invalidateKeys={[config.overviewApi, config.summaryApi]}
        filterKeys={config.itemsFilterKeys}
        exportApi={config.exportApi}
        exportType={config.itemsExportType}
        importApi={config.importApi}
        importType={config.itemsImportType}
        importTemplateHeaders={config.itemsImportTemplateHeaders}
      />
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-lg px-4 py-3">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span>No items API configured for this framework.</span>
    </div>
  );
}

// ─── LBI paginated question bank (read-only + Add) ─────────────────────────
function LbiItems({ config }: { config: FwConfig }) {
  const [search, setSearch] = useState('');
  const [domain, setDomain] = useState('all');
  const [page, setPage] = useState(1);
  const limit = 50;

  const domains = useQuery<any[] | null>({
    queryKey: ['/api/lbi/admin/domains'],
    queryFn: () => safeFetch('/api/lbi/admin/domains'),
  });
  const url = `/api/lbi/admin/questions-all?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&domain=${domain}`;
  const items = useQuery<{ questions: any[]; total: number; totalPages: number; page: number } | null>({
    queryKey: [url],
    queryFn: () => safeFetch(url),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" style={{ color: config.color }} />
            Question Bank
            <Badge variant="outline" className="ml-1 text-xs">{items.data?.total ?? 0}</Badge>
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2 top-2.5 text-gray-400" />
              <Input
                placeholder="Search code or text…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="pl-7 h-8 text-xs w-48"
              />
            </div>
            <select
              className="border rounded-md px-2 h-8 text-xs"
              value={domain}
              onChange={e => { setDomain(e.target.value); setPage(1); }}
            >
              <option value="all">All domains</option>
              {Array.isArray(domains.data) && domains.data.map((d: any) => (
                <option key={d.domain_code || d.id} value={d.domain_code}>
                  {d.domain_code} — {d.domain_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2">Code</th>
                <th className="text-left px-3 py-2">Domain</th>
                <th className="text-left px-3 py-2">Subdomain</th>
                <th className="text-left px-3 py-2">Question</th>
                <th className="text-left px-3 py-2">Age band</th>
                <th className="text-left px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.data?.questions?.map((q: any) => (
                <tr key={q.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-[10px] text-gray-500">{q.questionCode || `Q${q.id}`}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{q.domainCode || '—'}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{q.subdomainCode || '—'}</td>
                  <td className="px-3 py-2 max-w-xs">
                    {(q.questionText || '').slice(0, 90)}
                    {(q.questionText || '').length > 90 ? '…' : ''}
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px]">{q.ageBandCode || '—'}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="text-[10px]">{q.status || 'active'}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(items.data?.questions?.length ?? 0) === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">No items match the filters</div>
          )}
        </div>
        {items.data && items.data.totalPages > 1 && (
          <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
            <span>Page {items.data.page} of {items.data.totalPages} · {items.data.total} total</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <Button variant="outline" size="sm" disabled={page >= items.data.totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
