import React, { lazy, Suspense, useState, useEffect } from 'react';
import { Screen } from '../App';

import { Menu, RefreshCw, Search, Settings, Target, Brain, FileCheck, Database, Package, Calculator, Users, BookOpen, Network, Layers, Activity, Building2, Briefcase, Users2, UserCircle2, Map, BarChart2, BarChart3, GitBranch, Sparkles, PieChart, TrendingUp, AlertTriangle, MessageCircle, Bot, FileDown, CreditCard, Shield, FlaskConical, ClipboardList, Cpu, Award, Gauge, Zap, Sliders, Shuffle, Timer, LineChart, ClipboardCheck, Boxes } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import SuperAdminLogin from './SuperAdminLogin';
const MissionControlPanel = lazy(() => import('./superadmin/MissionControlPanel'));
const ExecutiveCockpitPanel = lazy(() => import('./superadmin/ExecutiveCockpitPanel'));
const ProductCommandCenter = lazy(() => import('./superadmin/ProductCommandCenter'));
const CommandPalette = lazy(() => import('./superadmin/CommandPalette'));
const ActionCenterPanel = lazy(() => import('./superadmin/ActionCenterPanel'));
const NotificationCenterPanel = lazy(() => import('./superadmin/NotificationCenterPanel'));
const ReadinessDashboardsPanel = lazy(() => import('./superadmin/ReadinessDashboardsPanel'));
const HealthDashboardsPanel = lazy(() => import('./superadmin/HealthDashboardsPanel'));
const ConcernAreasPanel = lazy(() => import('./superadmin/ConcernAreasPanel'));
const EmployerOnboardingPanel = lazy(() => import('./superadmin/EmployerOnboardingPanel'));
const CapadexReportsPanel = lazy(() => import('./superadmin/CapadexReportsPanel'));
const CapadexUsersPanel = lazy(() => import('./superadmin/CapadexUsersPanel'));
const CapadexAnalyticsPanel = lazy(() => import('./superadmin/CapadexAnalyticsPanel'));
const CapadexInterventionsPanel = lazy(() => import('./superadmin/CapadexInterventionsPanel'));
const CapadexPricingPanel = lazy(() => import('./superadmin/CapadexPricingPanel'));
const SignalIntelligencePanel = lazy(() => import('./superadmin/SignalIntelligencePanel'));
const IntelligencePipelinePanel = lazy(() => import('./superadmin/IntelligencePipelinePanel'));
const SimulationDashboard = lazy(() => import('./superadmin/SimulationDashboard'));
const CoverageDashboardPanel = lazy(() => import('./superadmin/CoverageDashboardPanel'));
const ArchetypeIntelligencePanel = lazy(() => import('./superadmin/ArchetypeIntelligencePanel'));
const GovernanceSecurityPanel = lazy(() => import('./superadmin/GovernanceSecurityPanel'));
const HumanIntelligencePanel = lazy(() => import('./superadmin/HumanIntelligencePanel'));
const SearchIntentPanel = lazy(() => import('./superadmin/SearchIntentPanel'));
const InterventionIntelligencePanel = lazy(() => import('./superadmin/InterventionIntelligencePanel'));
const ConcernSignalMapPanel = lazy(() => import('./superadmin/ConcernSignalMapPanel'));
const QuestionRegistryPanel = lazy(() => import('./superadmin/QuestionRegistryPanel'));
const CSIPanel = lazy(() => import('./superadmin/CSIPanel'));
const ReferenceIntelligencePanel = lazy(() => import('./superadmin/ReferenceIntelligencePanel'));
const ConcernIntelligencePanel = lazy(() => import('./superadmin/ConcernIntelligencePanel'));
const UnifiedReportsPanel = lazy(() => import('./superadmin/UnifiedReportsPanel'));
const EnterpriseAnalyticsPanel = lazy(() => import('./superadmin/EnterpriseAnalyticsPanel'));
const AiGovernancePanel = lazy(() => import('./superadmin/AiGovernancePanel'));
const LBIPanel = lazy(() => import('./superadmin/LBIPanel'));
const PredictiveIntelligencePanel = lazy(() => import('./superadmin/PredictiveIntelligencePanel'));
const TenantsPanel = lazy(() => import('./superadmin/TenantsPanel'));
const CognitiveIntelligencePanel = lazy(() => import('./superadmin/CognitiveIntelligencePanel'));
const ConversationalQualityPanel = lazy(() => import('./superadmin/ConversationalQualityPanel'));
const DigitalTwinPanel = lazy(() => import('./superadmin/DigitalTwinPanel'));
const PsychometricsPanel = lazy(() => import('./superadmin/PsychometricsPanel'));
const SemanticReasoningPanel = lazy(() => import('./superadmin/SemanticReasoningPanel'));
const MemoryArchitecturePanel = lazy(() => import('./superadmin/MemoryArchitecturePanel'));
const EthicsGovernancePanel = lazy(() => import('./superadmin/EthicsGovernancePanel'));
const FairnessPanel = lazy(() => import('./superadmin/FairnessPanel'));
const SPEScoringPanel = lazy(() => import('./superadmin/SPEScoringPanel'));
const SPEPsychometricsPanel = lazy(() => import('./superadmin/SPEPsychometricsPanel'));
const SPELongitudinalPanel = lazy(() => import('./superadmin/SPELongitudinalPanel'));
const SPEGovernancePanel = lazy(() => import('./superadmin/SPEGovernancePanel'));
const BIOSFrontierPanel = lazy(() => import('./superadmin/BIOSFrontierPanel'));
const BIOSFusionPanel = lazy(() => import('./superadmin/BIOSFusionPanel'));
const BIOSAgentsPanel = lazy(() => import('./superadmin/BIOSAgentsPanel'));
const BIOSSimulationPanel = lazy(() => import('./superadmin/BIOSSimulationPanel'));
const ROIERiskPanel = lazy(() => import('./superadmin/ROIERiskPanel'));
const ROIEOpportunityPanel = lazy(() => import('./superadmin/ROIEOpportunityPanel'));
const ROIESemanticPanel = lazy(() => import('./superadmin/ROIESemanticPanel'));
const ROIEGovernancePanel = lazy(() => import('./superadmin/ROIEGovernancePanel'));
const PAIEForecastingPanel = lazy(() => import('./superadmin/PAIEForecastingPanel'));
const PAIEOpportunityPanel = lazy(() => import('./superadmin/PAIEOpportunityPanel'));
const PAIEIntelligencePanel = lazy(() => import('./superadmin/PAIEIntelligencePanel'));
const PAIEGovernancePanel = lazy(() => import('./superadmin/PAIEGovernancePanel'));
const LDETemporalPanel = lazy(() => import('./superadmin/LDETemporalPanel'));
const LDEEvolutionPanel = lazy(() => import('./superadmin/LDEEvolutionPanel'));
const LDEIntelligencePanel = lazy(() => import('./superadmin/LDEIntelligencePanel'));
const LDEGovernancePanel = lazy(() => import('./superadmin/LDEGovernancePanel'));
const LDEGraphPanel = lazy(() => import('./superadmin/LDEGraphPanel'));
const RIEDashboardPanel = lazy(() => import('./superadmin/RIEDashboardPanel'));
const RIERecommendationsPanel = lazy(() => import('./superadmin/RIERecommendationsPanel'));
const RIEInterventionsPanel = lazy(() => import('./superadmin/RIEInterventionsPanel'));
const RIEEscalationsPanel = lazy(() => import('./superadmin/RIEEscalationsPanel'));
import CrisisAlertInbox from './superadmin/CrisisAlertInbox';
const OntologyMatrixPanel = lazy(() => import('./superadmin/OntologyMatrixPanel'));
const RIERecoveryPanel = lazy(() => import('./superadmin/RIERecoveryPanel'));
const RIEOpportunityPanel = lazy(() => import('./superadmin/RIEOpportunityPanel'));
const CounsellorDirectoryPanel = lazy(() => import('./superadmin/CounsellorDirectoryPanel'));
const ShortAssessmentsPanel = lazy(() => import('./superadmin/ShortAssessmentsPanel'));
const CompetencyQuestionsPanel = lazy(() => import('./superadmin/CompetencyQuestionsPanel'));
const CompetencyQuestionMapPanel = lazy(() => import('./superadmin/CompetencyQuestionMapPanel'));
import CompetencyAdminPage from '../pages/CompetencyAdminPage';
const ActiveAgeBandsReflection = lazy(() => import('./superadmin/ActiveAgeBandsReflection'));
import AssessmentModulesManagement from './AssessmentModulesManagement';
import FrameworkPanel, { OverviewTab } from '@/components/admin/FrameworkPanel';
import CompetencyFrameworkShell from '@/components/superadmin/CompetencyFrameworkShell';
import AdminTabbedShell from '@/components/admin/AdminTabbedShell';
import { LBI_CONFIG, COMPETENCY_CONFIG, SDI_CONFIG } from '@/components/admin/framework-configs';
import { useQuery } from '@tanstack/react-query';
import NotificationCenter from '@/components/NotificationCenter';

const FeatureFlagsPanel = lazy(() => import('./superadmin/FeatureFlagsPanel'));
const GovernancePanel = lazy(() => import('./superadmin/GovernancePanel'));
const OverviewPanel = lazy(() => import('./superadmin/OverviewPanel'));
const UserMgmtPanel = lazy(() => import('./superadmin/UserMgmtPanel'));
const EIHealthPanel = lazy(() => import('./superadmin/EIHealthPanel'));
const CompetencyFrameworkIntelligencePanel = lazy(() => import('./superadmin/CompetencyFrameworkIntelligencePanel'));
const CompetencyMasterPanel = lazy(() => import('./superadmin/CompetencyMasterPanel'));
const CompetencyMicroFrameworkPanel = lazy(() => import('./superadmin/CompetencyMicroFrameworkPanel'));
const RoleCompetencyProfilePanel = lazy(() => import('./superadmin/RoleCompetencyProfilePanel'));
const AssessmentFoundationMappingPanel = lazy(() => import('./superadmin/AssessmentFoundationMappingPanel'));
const CompetencySearchPanel = lazy(() => import('./superadmin/CompetencySearchPanel'));
const CareerEvidencePanel = lazy(() => import('./superadmin/CareerEvidencePanel'));
const MEIDesignPanel = lazy(() => import('./superadmin/MEIDesignPanel'));
const EIOperationsPanel = lazy(() => import('./superadmin/EIOperationsPanel'));
const CareerGraphPanel = lazy(() => import('./superadmin/CareerGraphPanel'));
const LIPDesignPanel = lazy(() => import('./superadmin/LIPDesignPanel'));
const FRPDesignPanel = lazy(() => import('./superadmin/FRPDesignPanel'));
const CareerPathwayAnalyticsPanel = lazy(() => import('./superadmin/CareerPathwayAnalyticsPanel'));
const OccupationAnalyticsPanel = lazy(() => import('./superadmin/OccupationAnalyticsPanel'));
const RecommendationAnalyticsPanel = lazy(() => import('./superadmin/RecommendationAnalyticsPanel'));
const ForecastAnalyticsPanel = lazy(() => import('./superadmin/ForecastAnalyticsPanel'));
const TransitionAnalyticsPanel = lazy(() => import('./superadmin/TransitionAnalyticsPanel'));
const PassportStatsPanel = lazy(() => import('./superadmin/PassportStatsPanel'));
const ReportFactoryPanel = lazy(() => import('./superadmin/ReportFactoryPanel'));
const HRPanel = lazy(() => import('./superadmin/HRPanel'));
const MentorsPanel = lazy(() => import('./superadmin/MentorsPanel'));
const EntityCodesPanel = lazy(() => import('./superadmin/EntityCodesPanel'));
const ConsentsPanel = lazy(() => import('./superadmin/ConsentsPanel'));
const AccessControlPanel = lazy(() => import('./superadmin/AccessControlPanel'));
const LearningPlansPanel = lazy(() => import('./superadmin/LearningPlansPanel'));
const FinancialsPanel = lazy(() => import('./superadmin/FinancialsPanel'));
const RevenueDashboardPanel = lazy(() => import('./superadmin/RevenueDashboardPanel'));
const UsageMeteringPanel = lazy(() => import('./superadmin/UsageMeteringPanel'));
const CustomerSuccessPanel = lazy(() => import('./superadmin/CustomerSuccessPanel'));
const EnterpriseGovernancePanel = lazy(() => import('./superadmin/EnterpriseGovernancePanel'));
const PlatformIntelligencePanel = lazy(() => import('./superadmin/PlatformIntelligencePanel'));
const MultiTenantArchitecturePanel = lazy(() => import('./superadmin/MultiTenantArchitecturePanel'));
const AutomationEnginePanel = lazy(() => import('./superadmin/AutomationEnginePanel'));
const CommandCenterPanel = lazy(() => import('./superadmin/CommandCenterPanel'));
const FounderControlCenterPanel = lazy(() => import('./superadmin/FounderControlCenterPanel'));
const ParentsPanel = lazy(() => import('./superadmin/ParentsPanel'));
const StudentsPanel = lazy(() => import('./superadmin/StudentsPanel'));
const InstitutionsPanel = lazy(() => import('./superadmin/InstitutionsPanel'));
const StudentsLegacyPanel = lazy(() => import('./superadmin/StudentsLegacyPanel'));
const DocumentsPanel = lazy(() => import('./superadmin/DocumentsPanel'));
const SecurityPanel = lazy(() => import('./superadmin/SecurityPanel'));
const QuestionBankPanel = lazy(() => import('./superadmin/QuestionBankPanel'));
const ScoringPanel = lazy(() => import('./superadmin/ScoringPanel'));
const PricingPanel = lazy(() => import('./superadmin/PricingPanel'));
const NotificationsMgmtPanel = lazy(() => import('./superadmin/NotificationsMgmtPanel'));
const SettingsPanel = lazy(() => import('./superadmin/SettingsPanel'));
const ContentManagerPanel = lazy(() => import('./superadmin/ContentManagerPanel'));
const IndustriesPanel = lazy(() => import('./superadmin/IndustriesPanel'));
const PlatformAuditLogPanel = lazy(() => import('./superadmin/PlatformAuditLogPanel'));
const ApprovalWorkflowPanel = lazy(() => import('./superadmin/ApprovalWorkflowPanel'));
const OntologyImportExportPanel = lazy(() => import('./superadmin/OntologyImportExportPanel'));
const FunctionsPanel = lazy(() => import('./superadmin/FunctionsPanel'));
const SectorsPanel = lazy(() => import('./superadmin/SectorsPanel'));
const IndustrySegmentsPanel = lazy(() => import('./superadmin/IndustrySegmentsPanel'));
const RoleCrosswalkPanel = lazy(() => import('./superadmin/RoleCrosswalkPanel'));
const DepartmentsPanel = lazy(() => import('./superadmin/DepartmentsPanel'));
const RolesPanel = lazy(() => import('./superadmin/RolesPanel'));
const RoleFamiliesPanel = lazy(() => import('./superadmin/RoleFamiliesPanel'));
const CareerTracksPanel = lazy(() => import('./superadmin/CareerTracksPanel'));
const CompetencyLevelsPanel = lazy(() => import('./superadmin/CompetencyLevelsPanel'));
const IndicatorsPanel = lazy(() => import('./superadmin/IndicatorsPanel'));
const BenchmarksPanel = lazy(() => import('./superadmin/BenchmarksPanel'));
const CareerPathsPanel = lazy(() => import('./superadmin/CareerPathsPanel'));
const LearningPathsOntologyPanel = lazy(() => import('./superadmin/LearningPathsOntologyPanel'));
const FutureSkillsPanel = lazy(() => import('./superadmin/FutureSkillsPanel'));
const AIRulesPanel = lazy(() => import('./superadmin/AIRulesPanel'));
const CompetencyCorePanel = lazy(() => import('./superadmin/CompetencyCorePanel'));
const ConcernsMappingPanel = lazy(() => import('./superadmin/ConcernsMappingPanel'));
const OntologyGovernancePanel = lazy(() => import('./superadmin/OntologyGovernancePanel'));
const OntologyOverviewPanel = lazy(() => import('./superadmin/OntologyOverviewPanel'));
const CAFQuestionBankPanel = lazy(() => import('./superadmin/caf/CAFQuestionBankPanel'));
const CAFScenarioPanel = lazy(() => import('./superadmin/caf/CAFScenarioPanel'));
const CAFDifficultyLevelPanel = lazy(() => import('./superadmin/caf/CAFDifficultyLevelPanel'));
const CAFAssessmentBuilderPanel = lazy(() => import('./superadmin/caf/CAFAssessmentBuilderPanel'));
const CAFRandomizationPanel = lazy(() => import('./superadmin/caf/CAFRandomizationPanel'));
const CAFSessionsPanel = lazy(() => import('./superadmin/caf/CAFSessionsPanel'));
const CAFScoringPanel = lazy(() => import('./superadmin/caf/CAFScoringPanel'));
const CAFAnalyticsPanel = lazy(() => import('./superadmin/caf/CAFAnalyticsPanel'));
const RoleFamilyPanel = lazy(() => import('./superadmin/RoleFamilyPanel'));
const CompetencyBlueprintPanel = lazy(() => import('./superadmin/CompetencyBlueprintPanel'));
const BlueprintMappingPanel = lazy(() => import('./superadmin/BlueprintMappingPanel'));
const LevelProfilePanel = lazy(() => import('./superadmin/LevelProfilePanel'));
const TalentScoringPanel = lazy(() => import('./superadmin/TalentScoringPanel'));
const TalentGapPanel = lazy(() => import('./superadmin/TalentGapPanel'));
const TalentPipelinePanel = lazy(() => import('./superadmin/TalentPipelinePanel'));
const TalentSignalMasterPanel = lazy(() => import('./superadmin/TalentSignalMasterPanel'));
const TalentCompetencyDNAPanel = lazy(() => import('./superadmin/TalentCompetencyDNAPanel'));
const TalentReadinessEnginePanel = lazy(() => import('./superadmin/TalentReadinessEnginePanel'));
const TalentOutcomePredictionPanel = lazy(() => import('./superadmin/TalentOutcomePredictionPanel'));
const TalentBenchmarkEnginePanel = lazy(() => import('./superadmin/TalentBenchmarkEnginePanel'));
const TalentDigitalTwinAdminPanel = lazy(() => import('./superadmin/TalentDigitalTwinAdminPanel'));
const TalentMeasurementSciencePanel = lazy(() => import('./superadmin/TalentMeasurementSciencePanel'));
const TalentAnalyticsWarehousePanel = lazy(() => import('./superadmin/TalentAnalyticsWarehousePanel'));
const TalentLearningCatalogPanel = lazy(() => import('./superadmin/TalentLearningCatalogPanel'));
const TalentFRPEnrichmentPanel = lazy(() => import('./superadmin/TalentFRPEnrichmentPanel'));
const TalentConcernIntelligencePanel = lazy(() => import('./superadmin/TalentConcernIntelligencePanel'));
const CompetencyIntelligenceAdminPanel = lazy(() => import('./superadmin/CompetencyIntelligenceAdminPanel'));
const VXCapabilityArchitecturePanel = lazy(() => import('./superadmin/VXCapabilityArchitecturePanel'));
const VXLaborMarketIntelligencePanel = lazy(() => import('./superadmin/VXLaborMarketIntelligencePanel'));
const VXEvidenceIntelligencePanel = lazy(() => import('./superadmin/VXEvidenceIntelligencePanel'));
const VXTenantConfigurationPanel = lazy(() => import('./superadmin/VXTenantConfigurationPanel'));
const VXAssessmentRuntimePanel = lazy(() => import('./superadmin/VXAssessmentRuntimePanel'));
const CompetencyRuntimePanel = lazy(() => import('./superadmin/CompetencyRuntimePanel'));
const CompetencyEIPanel = lazy(() => import('./superadmin/CompetencyEIPanel'));
const CareerIntelligencePanel = lazy(() => import('./superadmin/CareerIntelligencePanel'));
const EiProfileDashboardPanel = lazy(() => import('./superadmin/EiProfileDashboardPanel'));
const VXCompetencyScienceCouncilPanel = lazy(() => import('./superadmin/VXCompetencyScienceCouncilPanel'));
const VXWorkforceKnowledgeGraphPanel = lazy(() => import('./superadmin/VXWorkforceKnowledgeGraphPanel'));
const VXIRTEnginePanel = lazy(() => import('./superadmin/VXIRTEnginePanel'));
const VXReportIntelligencePanel = lazy(() => import('./superadmin/VXReportIntelligencePanel'));
import { AdminDashboardContext, type AdminDashboardContextValue } from '@/contexts/AdminDashboardContext';
import { useAdminDashboardState } from '@/hooks/useAdminDashboardState';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminDialogs } from '@/components/admin/AdminDialogs';
import { AdminShellBar } from '@/components/superadmin/AdminShellBar';

class DialogsErrorBoundary extends React.Component<{ children: React.ReactNode; resetKey?: string | number }, { hasError: boolean; lastKey?: string | number; errMsg?: string; errStack?: string }> {
  constructor(props: { children: React.ReactNode; resetKey?: string | number }) { super(props); this.state = { hasError: false, lastKey: props.resetKey }; }
  static getDerivedStateFromError(error: Error) { return { hasError: true, errMsg: error?.message ?? String(error), errStack: error?.stack }; }
  static getDerivedStateFromProps(props: { resetKey?: string | number }, state: { hasError: boolean; lastKey?: string | number }) {
    if (props.resetKey !== state.lastKey) return { hasError: false, lastKey: props.resetKey, errMsg: undefined, errStack: undefined };
    return null;
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface the real failure to the devtools console so we can diagnose
    // 'failed to render' tiles without re-running the panel.
    console.error('[SuperAdmin] render error in panel:', error, info?.componentStack);
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="p-6 text-sm">
        <div className="text-red-600 font-semibold mb-2">This section failed to render. Switch tabs or reload to retry.</div>
        {this.state.errMsg && (
          <details className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-3">
            <summary className="cursor-pointer font-mono select-all">{this.state.errMsg}</summary>
            {this.state.errStack && (
              <pre className="mt-2 whitespace-pre-wrap text-[10px] text-red-800/80 max-h-64 overflow-auto">{this.state.errStack}</pre>
            )}
          </details>
        )}
      </div>
    );
  }
}

export default function SuperAdminDashboard({ onNavigate }: { onNavigate?: (screen: Screen) => void }) {
  // All state, queries, handlers, and context value built in hook
  const ctx = useAdminDashboardState(onNavigate);

  // Destructure frequently-used values from context for JSX readability
  const {
    isAuthenticated, isCheckingAuth, activeTab, setActiveTab, sidebarCollapsed,
    setSidebarCollapsed, searchQuery, setSearchQuery, statsLoading, crisisPending,
    psyActiveSection, toast, queryClient, handleLogout,
    BRAND, formatDate, formatDateTime, formatCurrency,
    getStatusBadge, formatEntityType, getSettingValue, getSettingBool, updateSetting,
    navGroups, labsOpen, setLabsOpen, menuItems,
  } = ctx;

  // Simulation harness flag — gates the "Simulation & Validation" tab inside the
  // CAPADEX framework (mirrors the nav-level gate in useAdminDashboardState).
  // Same queryKey as the hook so react-query dedupes (no extra fetch).
  const { data: simHarnessEnabled = false } = useQuery<boolean>({
    queryKey: ['/api/admin/simulation/config', 'enabled'],
    queryFn: async () => {
      const res = await fetch('/api/admin/simulation/config', { credentials: 'include' });
      if (!res.ok) return false;
      const j = await res.json().catch(() => null);
      return !!j?.enabled;
    },
    enabled: isAuthenticated,
  });

  // ── Competency Framework Intelligence flag probe (file-registry flag).
  //    Flag OFF → gate returns 503 → tab is omitted entirely (byte-identical UI). ──
  const { data: cfiEnabled = false } = useQuery<boolean>({
    queryKey: ['/api/competency-intelligence/spine', 'cfi-enabled'],
    queryFn: async () => {
      const res = await fetch('/api/competency-intelligence/spine', { credentials: 'include' });
      return res.ok;
    },
    enabled: isAuthenticated,
  });

  // ── Ontology Hierarchy V2 flag probe (file-registry flag).
  //    Flag OFF → /sectors gate returns 503 → the 3 new tabs are omitted (byte-identical UI). ──
  const { data: ontHierEnabled = false } = useQuery<boolean>({
    queryKey: ['/api/ontology/sectors', 'ont-hier-enabled'],
    queryFn: async () => {
      const res = await fetch('/api/ontology/sectors?limit=1', { credentials: 'include' });
      return res.ok;
    },
    enabled: isAuthenticated,
  });

  // ── Global ⌘K / Ctrl+K command palette (additive jump-to-screen) ──
  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setPaletteOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Resizable + collapsible sidebar width (persisted across sessions) ──
  const SIDEBAR_MIN = 208;
  const SIDEBAR_MAX = 420;
  const SIDEBAR_DEFAULT = 256;
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return SIDEBAR_DEFAULT;
    const raw = window.localStorage.getItem('admin.sidebarWidth');
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) ? Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, n)) : SIDEBAR_DEFAULT;
  });
  const [sidebarResizing, setSidebarResizing] = useState(false);
  useEffect(() => {
    window.localStorage.setItem('admin.sidebarWidth', String(sidebarWidth));
  }, [sidebarWidth]);

  // Auth gate
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#344E86' }}>
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mx-auto mb-4" />
          <p className="text-lg font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <SuperAdminLogin onLoginSuccess={() => ctx.setIsAuthenticated(true)} />;
  }

  return (
    <AdminDashboardContext.Provider value={ctx}>
      <div className="min-h-screen flex" style={{ backgroundColor: BRAND.lightBg }}>
        {/* Sidebar */}
        <AdminSidebar
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          sidebarWidth={sidebarWidth}
          setSidebarWidth={setSidebarWidth}
          sidebarResizing={sidebarResizing}
          setSidebarResizing={setSidebarResizing}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          navGroups={navGroups}
          labsOpen={labsOpen}
          setLabsOpen={setLabsOpen}
          crisisPending={crisisPending}
          handleLogout={handleLogout}
          onNavigate={onNavigate}
        />

      {/* Main Content */}
      <main
        className={`flex-1 ${sidebarResizing ? '' : 'transition-all duration-300'}`}
        style={{ marginLeft: sidebarCollapsed ? 80 : sidebarWidth }}
      >
        {/* Sticky top region: header + additive shell bar pinned together */}
        <div className="sticky top-0 z-30">
        {/* Header */}
        <header className="bg-white border-b shadow-sm">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                data-testid="button-toggle-sidebar"
              >
                <Menu className="h-5 w-5" style={{ color: BRAND.primary }} />
              </button>
              <div>
                <h2 className="text-xl font-bold capitalize" style={{ color: BRAND.primary }}>
                  {menuItems.find(m => m.id === activeTab)?.label || 'Dashboard'}
                </h2>
                <p className="text-sm text-gray-500">Manage your platform</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setPaletteOpen(true)}
                className="flex items-center gap-2 w-64 pl-3 pr-2 py-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                data-testid="button-command-palette"
                title="Jump to any screen (⌘K)"
              >
                <Search className="h-4 w-4 text-gray-400 shrink-0" />
                <span className="flex-1 text-sm text-gray-400 truncate">Jump to any screen…</span>
                <kbd className="text-[10px] font-semibold text-gray-400 bg-white border border-gray-200 rounded px-1.5 py-0.5 shrink-0">⌘K</kbd>
              </button>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 pl-10"
                  data-testid="input-search"
                />
              </div>
              <CrisisAlertInbox onNavigateToEscalations={() => setActiveTab('rie-escalations')} />
              <NotificationCenter variant="light" />
              <Button variant="ghost" size="icon" onClick={() => setActiveTab('settings')} data-testid="button-header-settings">
                <Settings className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </header>

        {/* Additive UX shell bar: breadcrumbs + context actions (STEP 10) */}
        <AdminShellBar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          navGroups={navGroups}
          currentLabel={menuItems.find(m => m.id === activeTab)?.label || 'Dashboard'}
          brandColor={BRAND.primary}
        />
        </div>

        {/* Global command palette (⌘K) */}
        <Suspense fallback={null}>
          <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
        </Suspense>

        {/* Content */}
        <div className="p-6">
          {statsLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-8 w-8 animate-spin" style={{ color: BRAND.primary }} />
            </div>
          ) : (
            <DialogsErrorBoundary resetKey={activeTab}>
              <Suspense fallback={<div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin" style={{ color: BRAND.primary }} /></div>}>
              {/* ─── Extracted Inline Tab Panels ─── */}
              {activeTab === 'mission-control'  && <MissionControlPanel />}
              {activeTab === 'executive-intelligence' && (
                <div className="h-full overflow-auto">
                  <ExecutiveCockpitPanel />
                </div>
              )}
              {activeTab === 'cc-capadex'       && <ProductCommandCenter productKey="capadex" />}
              {activeTab === 'cc-competency'    && <ProductCommandCenter productKey="competency" />}
              {activeTab === 'cc-lbi'           && <ProductCommandCenter productKey="lbi" />}
              {activeTab === 'cc-employability' && <ProductCommandCenter productKey="employability" />}
              {activeTab === 'cc-career'        && <ProductCommandCenter productKey="career" />}
              {activeTab === 'cc-employer'      && <ProductCommandCenter productKey="employer" />}
              {activeTab === 'overview'         && <OverviewPanel />}
              {activeTab === 'usermgmt'         && <UserMgmtPanel />}
              {activeTab === 'hr'               && <HRPanel />}
              {activeTab === 'mentors'          && <MentorsPanel />}
              {activeTab === 'codes'            && <EntityCodesPanel />}
              {activeTab === 'consents'         && <ConsentsPanel />}
              {activeTab === 'access'           && <AccessControlPanel />}
              {activeTab === 'learning'         && <LearningPlansPanel />}
              {activeTab === 'financials'       && <FinancialsPanel />}
              {activeTab === 'revenue'          && <RevenueDashboardPanel />}
              {activeTab === 'usage-credits'    && <UsageMeteringPanel />}
              {activeTab === 'customer-success' && <CustomerSuccessPanel />}
              {activeTab === 'enterprise-governance' && <EnterpriseGovernancePanel />}
              {activeTab === 'platform-intelligence' && <PlatformIntelligencePanel />}
              {activeTab === 'multi-tenant-architecture' && <MultiTenantArchitecturePanel />}
              {activeTab === 'automation-engine' && <AutomationEnginePanel />}
              {activeTab === 'command-center' && <CommandCenterPanel />}
              {activeTab === 'founder-control-center' && <FounderControlCenterPanel />}
              {activeTab === 'parents'          && <ParentsPanel />}
              {activeTab === 'students'         && <StudentsPanel />}
              {activeTab === 'institutions'     && <InstitutionsPanel />}
              {activeTab === 'students_legacy'  && <StudentsLegacyPanel />}
              {activeTab === 'documents'        && <DocumentsPanel />}
              {activeTab === 'security'         && <SecurityPanel />}
              {activeTab === 'questionbank'     && <QuestionBankPanel />}
              {activeTab === 'scoring'          && <ScoringPanel />}
              {activeTab === 'pricing'          && <PricingPanel />}
              {activeTab === 'notifications_mgmt' && <NotificationsMgmtPanel />}
              {activeTab === 'reference-intelligence' && <ReferenceIntelligencePanel />}
              {activeTab === 'settings'         && <SettingsPanel />}
              {activeTab === 'content'          && <ContentManagerPanel />}
              {activeTab === 'behavior'         && <AssessmentModulesManagement onNavigate={onNavigate} />}
              {activeTab === 'employer-onboarding' && <EmployerOnboardingPanel />}
              {activeTab === 'action-center'    && <ActionCenterPanel />}
              {activeTab === 'notification-center' && <NotificationCenterPanel />}
              {activeTab === 'readiness-dashboards' && <ReadinessDashboardsPanel />}
              {activeTab === 'health-dashboards' && <HealthDashboardsPanel />}
              {(activeTab === 'concern-areas' || activeTab === 'concern_areas') && <ConcernAreasPanel />}
              {(activeTab === 'short-assessments' || activeTab === 'short_assessments') && <ShortAssessmentsPanel />}
              {activeTab === 'competency-questions' && <CompetencyQuestionsPanel />}
              {/* CAPADEX Concerns Master + Clarity Questions are now inner tabs of the CAPADEX
                  Framework panel (`activeTab='capadex-fw'` → FrameworkPanel → Concern Areas /
                  Clarity Questions). The standalone sidebar entries were removed to avoid
                  duplication — these legacy tab IDs redirect users to the framework view. */}
              {(activeTab === 'capadex-concerns-master' || activeTab === 'capadex_concerns_master' ||
                activeTab === 'capadex-clarity-questions' || activeTab === 'capadex_clarity_questions') && (
                <div className="p-6 h-full overflow-y-auto">
                  <FrameworkPanel
                    config={SDI_CONFIG}
                    initialTab={activeTab.includes('clarity') ? 'clarity' : 'concerns'}
                  />
                </div>
              )}
              {activeTab === 'capadex-reports'  && <div className="h-full overflow-hidden flex flex-col"><CapadexReportsPanel /></div>}
              {activeTab === 'custom-modules' && (
                <AssessmentModulesManagement onNavigate={onNavigate} modulesOnly />
              )}

              {/* Intelligence Framework Tabs — each framework direct from sidebar */}
              {activeTab === 'lbi-fw' && (
                <div className="p-6">
                  <FrameworkPanel
                    config={LBI_CONFIG}
                    extraTabs={[
                      { id: 'cc-lbi',           label: 'Command Center', icon: Brain, node: <ProductCommandCenter productKey="lbi" /> },
                      { id: 'lbi-intelligence', label: 'LBI Engine',     icon: Brain, node: <div className="h-full overflow-hidden flex flex-col"><LBIPanel /></div> },
                    ]}
                  />
                </div>
              )}
              {activeTab === 'capadex-fw' && (
                <div className="p-6 h-full overflow-y-auto">
                  <FrameworkPanel
                    config={SDI_CONFIG}
                    extraTabs={[
                      { id: 'cc-capadex',                label: 'Command Center',         icon: Sparkles,      node: <ProductCommandCenter productKey="capadex" /> },
                      { id: 'signal-intelligence',       label: 'Signal Intelligence',    icon: Activity,      node: <div className="h-full overflow-hidden flex flex-col"><SignalIntelligencePanel /></div> },
                      { id: 'intelligence-pipeline',     label: 'Intelligence Pipeline',  icon: Layers,        node: <div className="h-full overflow-y-auto"><IntelligencePipelinePanel /></div> },
                      { id: 'runtime-intelligence',      label: 'Runtime Intelligence',   icon: Layers,        node: <div className="h-full overflow-auto p-6"><GovernancePanel /></div> },
                      { id: 'concern-intelligence',      label: 'Concern Engine',         icon: Sparkles,      node: <div className="h-full overflow-auto"><ConcernIntelligencePanel /></div> },
                      { id: 'csi-intelligence',          label: 'CSI Profiles',           icon: TrendingUp,    node: <div className="h-full overflow-hidden flex flex-col"><CSIPanel /></div> },
                      { id: 'capadex-analytics',         label: 'CAPADEX Analytics',      icon: BarChart3,     node: <div className="h-full overflow-y-auto"><CapadexAnalyticsPanel /></div> },
                      { id: 'capadex-reports',           label: 'CAPADEX Reports',        icon: BarChart2,     node: <div className="h-full overflow-hidden flex flex-col"><CapadexReportsPanel /></div> },
                      { id: 'capadex-users',             label: 'Users & Journeys',       icon: Users,         node: <div className="h-full overflow-y-auto"><CapadexUsersPanel /></div> },
                      { id: 'capadex-interventions',     label: 'Risk & Interventions',   icon: Shield,        node: <div className="h-full overflow-y-auto"><CapadexInterventionsPanel /></div> },
                      { id: 'capadex-pricing',           label: 'Upgrade Pricing',        icon: CreditCard,    node: <div className="h-full overflow-y-auto"><CapadexPricingPanel /></div> },
                      { id: 'concern-signal-map',        label: 'Concern → Signal Map',   icon: Network,       node: <div className="h-full overflow-hidden flex flex-col"><ConcernSignalMapPanel /></div> },
                      { id: 'ontology-matrix',           label: 'Ontology Matrix',        icon: GitBranch,     node: <OntologyMatrixPanel /> },
                      { id: 'coverage-dashboard',        label: 'Bridge-Tag Coverage',    icon: Map,           node: <div className="h-full overflow-hidden flex flex-col"><CoverageDashboardPanel /></div> },
                      { id: 'question-registry',         label: 'Question Registry',      icon: ClipboardList, node: <div className="h-full overflow-hidden flex flex-col"><QuestionRegistryPanel /></div> },
                      { id: 'archetype-intelligence',    label: 'Archetype Intelligence', icon: Layers,        node: <div className="h-full overflow-hidden flex flex-col"><ArchetypeIntelligencePanel /></div> },
                      { id: 'human-intelligence',        label: 'Human Intelligence',     icon: MessageCircle, node: <div className="h-full overflow-hidden flex flex-col"><HumanIntelligencePanel /></div> },
                      { id: 'intervention-intelligence', label: 'Intervention Intel',     icon: Target,        node: <div className="h-full overflow-hidden flex flex-col"><InterventionIntelligencePanel /></div> },
                      { id: 'search-intent',             label: 'Search Intent',          icon: Search,        node: <div className="h-full overflow-hidden flex flex-col"><SearchIntentPanel /></div> },
                      { id: 'conv-quality',              label: 'Conversational Quality', icon: Layers,        node: <div className="h-full overflow-hidden flex flex-col"><ConversationalQualityPanel /></div> },
                      ...(simHarnessEnabled ? [{ id: 'simulation-validation', label: 'Simulation & Validation', icon: FlaskConical, node: <div className="h-full overflow-hidden flex flex-col"><SimulationDashboard /></div> }] : []),
                    ]}
                  />
                </div>
              )}
              {activeTab === 'capadex-users' && (
                <div className="h-full overflow-y-auto">
                  <CapadexUsersPanel />
                </div>
              )}
              {activeTab === 'ontology-matrix' && (
                <OntologyMatrixPanel />
              )}
              {activeTab === 'capadex-analytics' && (
                <div className="h-full overflow-y-auto">
                  <CapadexAnalyticsPanel />
                </div>
              )}
              {activeTab === 'capadex-interventions' && (
                <div className="h-full overflow-y-auto">
                  <CapadexInterventionsPanel />
                </div>
              )}
              {activeTab === 'capadex-pricing' && (
                <div className="h-full overflow-y-auto">
                  <CapadexPricingPanel />
                </div>
              )}
              {activeTab === 'signal-intelligence' && (
                <div className="h-full overflow-hidden flex flex-col">
                  <SignalIntelligencePanel />
                </div>
              )}
              {activeTab === 'intelligence-pipeline' && (
                <div className="h-full overflow-y-auto">
                  <IntelligencePipelinePanel />
                </div>
              )}
              {activeTab === 'csi-intelligence' && (
                <div className="h-full overflow-hidden flex flex-col">
                  <CSIPanel />
                </div>
              )}
              {activeTab === 'concern-intelligence' && (
                <div className="h-full overflow-auto">
                  <ConcernIntelligencePanel />
                </div>
              )}
              {activeTab === 'simulation-validation' && (
                <div className="h-full overflow-hidden flex flex-col">
                  <SimulationDashboard />
                </div>
              )}
              {activeTab === 'coverage-dashboard' && (
                <div className="h-full overflow-hidden flex flex-col">
                  <CoverageDashboardPanel />
                </div>
              )}
              {activeTab === 'archetype-intelligence' && (
                <div className="h-full overflow-hidden flex flex-col">
                  <ArchetypeIntelligencePanel />
                </div>
              )}
              {activeTab === 'human-intelligence' && (
                <div className="h-full overflow-hidden flex flex-col">
                  <HumanIntelligencePanel />
                </div>
              )}
              {activeTab === 'search-intent' && (
                <div className="h-full overflow-hidden flex flex-col">
                  <SearchIntentPanel />
                </div>
              )}
              {activeTab === 'intervention-intelligence' && (
                <div className="h-full overflow-hidden flex flex-col">
                  <InterventionIntelligencePanel />
                </div>
              )}
              {activeTab === 'concern-signal-map' && (
                <div className="h-full overflow-hidden flex flex-col">
                  <ConcernSignalMapPanel />
                </div>
              )}
              {activeTab === 'question-registry' && (
                <div className="h-full overflow-hidden flex flex-col">
                  <QuestionRegistryPanel />
                </div>
              )}
              {activeTab === 'lbi-intelligence' && (
                <div className="h-full overflow-hidden flex flex-col">
                  <LBIPanel />
                </div>
              )}
              {activeTab === 'predictive-intelligence' && (
                <div className="h-full overflow-hidden flex flex-col">
                  <PredictiveIntelligencePanel />
                </div>
              )}
              {activeTab === 'conv-quality' && (
                <div className="h-full overflow-hidden flex flex-col">
                  <ConversationalQualityPanel />
                </div>
              )}
              {activeTab === 'tenants' && (
                <div className="h-full overflow-hidden flex flex-col">
                  <TenantsPanel />
                </div>
              )}
              {activeTab === 'feature-flags' && (
                <div className="h-full overflow-auto p-6">
                  <FeatureFlagsPanel />
                </div>
              )}
              {activeTab === 'cognitive-intelligence' && (
                <div className="h-full overflow-auto">
                  <CognitiveIntelligencePanel />
                </div>
              )}
              {activeTab === 'digital-twin' && (
                <div className="h-full overflow-auto">
                  <DigitalTwinPanel />
                </div>
              )}
              {activeTab === 'psychometrics' && (
                <div className="h-full overflow-auto">
                  <PsychometricsPanel />
                </div>
              )}
              {activeTab === 'semantic-reasoning' && (
                <div className="h-full overflow-auto">
                  <SemanticReasoningPanel />
                </div>
              )}
              {activeTab === 'memory-architecture' && (
                <div className="h-full overflow-auto">
                  <MemoryArchitecturePanel />
                </div>
              )}
              {activeTab === 'ethics-governance' && (
                <div className="h-full overflow-auto">
                  <EthicsGovernancePanel />
                </div>
              )}
              {activeTab === 'fairness-engine' && (
                <div className="h-full overflow-auto">
                  <FairnessPanel />
                </div>
              )}
              {activeTab === 'spe-scoring' && (
                <div className="h-full overflow-auto">
                  <SPEScoringPanel />
                </div>
              )}
              {activeTab === 'spe-psychometrics' && (
                <div className="h-full overflow-auto">
                  <SPEPsychometricsPanel />
                </div>
              )}
              {activeTab === 'spe-longitudinal' && (
                <div className="h-full overflow-auto">
                  <SPELongitudinalPanel />
                </div>
              )}
              {activeTab === 'spe-governance' && (
                <div className="h-full overflow-auto">
                  <SPEGovernancePanel />
                </div>
              )}
              {activeTab === 'bios-frontier' && (
                <div className="h-full overflow-auto p-6">
                  <BIOSFrontierPanel />
                </div>
              )}
              {activeTab === 'bios-fusion' && (
                <div className="h-full overflow-auto p-6">
                  <BIOSFusionPanel />
                </div>
              )}
              {activeTab === 'bios-agents' && (
                <div className="h-full overflow-auto p-6">
                  <BIOSAgentsPanel />
                </div>
              )}
              {activeTab === 'bios-simulation' && (
                <div className="h-full overflow-auto p-6">
                  <BIOSSimulationPanel />
                </div>
              )}
              {activeTab === 'roie-risk' && (
                <div className="h-full overflow-auto p-6">
                  <ROIERiskPanel />
                </div>
              )}
              {activeTab === 'roie-opportunity' && (
                <div className="h-full overflow-auto p-6">
                  <ROIEOpportunityPanel />
                </div>
              )}
              {activeTab === 'roie-semantic' && (
                <div className="h-full overflow-auto p-6">
                  <ROIESemanticPanel />
                </div>
              )}
              {activeTab === 'roie-governance' && (
                <div className="h-full overflow-auto p-6">
                  <ROIEGovernancePanel />
                </div>
              )}
              {activeTab === 'paie-forecasting' && (
                <div className="h-full overflow-auto p-6">
                  <PAIEForecastingPanel />
                </div>
              )}
              {activeTab === 'paie-opportunity' && (
                <div className="h-full overflow-auto p-6">
                  <PAIEOpportunityPanel />
                </div>
              )}
              {activeTab === 'paie-intelligence' && (
                <div className="h-full overflow-auto p-6">
                  <PAIEIntelligencePanel />
                </div>
              )}
              {activeTab === 'paie-governance' && (
                <div className="h-full overflow-auto p-6">
                  <PAIEGovernancePanel />
                </div>
              )}
              {activeTab === 'lde-graph' && (
                <div className="h-full overflow-auto p-6 flex flex-col">
                  <LDEGraphPanel />
                </div>
              )}
              {activeTab === 'lde-temporal' && (
                <div className="h-full overflow-auto p-6">
                  <LDETemporalPanel />
                </div>
              )}
              {activeTab === 'lde-evolution' && (
                <div className="h-full overflow-auto p-6">
                  <LDEEvolutionPanel />
                </div>
              )}
              {activeTab === 'lde-intelligence' && (
                <div className="h-full overflow-auto p-6">
                  <LDEIntelligencePanel />
                </div>
              )}
              {activeTab === 'lde-governance' && (
                <div className="h-full overflow-auto p-6">
                  <LDEGovernancePanel />
                </div>
              )}
              {activeTab === 'rie-dashboard' && (
                <div className="h-full overflow-auto p-6">
                  <RIEDashboardPanel />
                </div>
              )}
              {activeTab === 'rie-recommendations' && (
                <div className="h-full overflow-auto p-6">
                  <RIERecommendationsPanel />
                </div>
              )}
              {activeTab === 'rie-interventions' && (
                <div className="h-full overflow-auto p-6">
                  <RIEInterventionsPanel />
                </div>
              )}
              {activeTab === 'rie-escalations' && (
                <div className="h-full overflow-auto p-6">
                  <RIEEscalationsPanel />
                </div>
              )}
              {activeTab === 'rie-recovery' && (
                <div className="h-full overflow-auto p-6">
                  <RIERecoveryPanel />
                </div>
              )}
              {activeTab === 'rie-opportunity' && (
                <div className="h-full overflow-auto p-6">
                  <RIEOpportunityPanel />
                </div>
              )}
              {activeTab === 'rie-counsellors' && (
                <div className="h-full overflow-auto p-6">
                  <CounsellorDirectoryPanel />
                </div>
              )}
              {activeTab === 'runtime-intelligence' && (
                <div className="h-full overflow-auto p-6">
                  <GovernancePanel />
                </div>
              )}
              {activeTab === 'reports' && (
                <div className="flex flex-col h-full overflow-hidden">
                  <UnifiedReportsPanel />
                </div>
              )}
              {activeTab === 'competency-fw' && (
                <div className="p-6">
                  <CompetencyFrameworkShell
                    config={COMPETENCY_CONFIG}
                    hiddenTabs={['overview']}
                    initialTab="cmp-command-center"
                    onNavigateToReports={() => setActiveTab('reports')}
                    extraTabs={[
                      { id: 'cmp-command-center',     label: 'Command Center',     icon: Target,     node: (
                        <div className="space-y-4">
                          <OverviewTab config={COMPETENCY_CONFIG} />
                          <ProductCommandCenter productKey="competency" />
                        </div>
                      ) },
                      { id: 'cmp-intelligence',       label: 'Intelligence',       icon: Brain,      node: <CompetencyIntelligenceAdminPanel /> },
                      ...(cfiEnabled ? [{ id: 'cmp-framework-intel', label: 'Framework Intelligence', icon: Network, node: <CompetencyFrameworkIntelligencePanel onNavigateToImportExport={() => setActiveTab('ont-import-export')} /> }] : []),
                      ...(cfiEnabled ? [{ id: 'cmp-master', label: 'Competency Master', icon: Boxes, node: <CompetencyMasterPanel /> }] : []),
                      ...(cfiEnabled ? [{ id: 'cmp-micro-framework', label: 'Micro Framework', icon: Network, node: <CompetencyMicroFrameworkPanel /> }] : []),
                      ...(cfiEnabled ? [{ id: 'cmp-role-profile', label: 'Role Competency Profile', icon: Briefcase, node: <RoleCompetencyProfilePanel /> }] : []),
                      ...(cfiEnabled ? [{ id: 'cmp-assessment-mapping', label: 'Assessment Foundation Mapping', icon: ClipboardList, node: <AssessmentFoundationMappingPanel /> }] : []),
                      ...(cfiEnabled ? [{ id: 'cmp-search-discovery', label: 'Search & Discovery', icon: Search, node: <CompetencySearchPanel /> }] : []),
                      { id: 'cmp-questions',          label: 'Questions',          icon: FileCheck,  node: <CompetencyQuestionsPanel /> },
                      { id: 'cmp-question-map',       label: 'Question Mapping',   icon: Network,    node: <CompetencyQuestionMapPanel /> },
                      { id: 'cmp-questionbank',       label: 'Question Bank',      icon: Database,   node: <QuestionBankPanel /> },
                      { id: 'cmp-custom-modules',     label: 'Custom Modules',     icon: Package,    node: <AssessmentModulesManagement onNavigate={onNavigate} modulesOnly /> },
                      { id: 'cmp-scoring',            label: 'Norms & Scoring',    icon: Calculator, node: <ScoringPanel /> },
                      { id: 'cmp-role-families',      label: 'Role Families',      icon: Users,      node: <RoleFamilyPanel /> },
                      { id: 'cmp-blueprints',         label: 'Blueprints',         icon: BookOpen,   node: <CompetencyBlueprintPanel /> },
                      { id: 'cmp-blueprint-mappings', label: 'Blueprint Mappings', icon: Network,    node: <BlueprintMappingPanel /> },
                      { id: 'cmp-level-profiles',     label: 'Level Profiles',     icon: Layers,     node: <LevelProfilePanel /> },
                      { id: 'ont-overview',             label: 'Ontology Overview',        icon: Activity,      node: <OntologyOverviewPanel /> },
                      ...(ontHierEnabled ? [{ id: 'ont-sectors', label: 'Sectors', icon: Layers, node: <SectorsPanel /> }] : []),
                      { id: 'ont-industries',           label: 'Industries',               icon: Building2,     node: <IndustriesPanel /> },
                      ...(ontHierEnabled ? [{ id: 'ont-industry-segments', label: 'Industry Segments', icon: Network, node: <IndustrySegmentsPanel /> }] : []),
                      { id: 'ont-functions',            label: 'Functions',                icon: Briefcase,     node: <FunctionsPanel /> },
                      { id: 'ont-departments',          label: 'Departments',              icon: Layers,        node: <DepartmentsPanel /> },
                      { id: 'ont-role-families',        label: 'Role Families (Ontology)', icon: Users2,        node: <RoleFamiliesPanel /> },
                      { id: 'ont-roles',                label: 'Roles',                    icon: UserCircle2,   node: <RolesPanel /> },
                      ...(ontHierEnabled ? [{ id: 'ont-role-crosswalk', label: 'Role Crosswalk', icon: GitBranch, node: <RoleCrosswalkPanel /> }] : []),
                      { id: 'ont-career-tracks',        label: 'Career Tracks',            icon: Map,           node: <CareerTracksPanel /> },
                      { id: 'ont-competency-levels',    label: 'Competency Levels',        icon: BarChart2,     node: <CompetencyLevelsPanel /> },
                      { id: 'ont-indicators',           label: 'Indicators',               icon: Target,        node: <IndicatorsPanel /> },
                      { id: 'ont-benchmarks',           label: 'Benchmarks',               icon: BarChart3,     node: <BenchmarksPanel /> },
                      { id: 'ont-career-paths',         label: 'Career Paths',             icon: GitBranch,     node: <CareerPathsPanel /> },
                      { id: 'ont-learning-paths',       label: 'Learning Paths',           icon: BookOpen,      node: <LearningPathsOntologyPanel /> },
                      { id: 'ont-future-skills',        label: 'Future Skills',            icon: Sparkles,      node: <FutureSkillsPanel /> },
                      { id: 'ont-layers',               label: 'Layers',                   icon: Network,       node: <CompetencyCorePanel initialTab="ont-layers" /> },
                      { id: 'ont-clusters',             label: 'Competency Clusters',      icon: PieChart,      node: <CompetencyCorePanel initialTab="ont-clusters" /> },
                      { id: 'ont-competencies',         label: 'Competencies',             icon: TrendingUp,    node: <CompetencyCorePanel initialTab="ont-competencies" /> },
                      { id: 'ont-micro-competencies',   label: 'Micro Competencies',       icon: Brain,         node: <CompetencyCorePanel initialTab="ont-micro-competencies" /> },
                      { id: 'ont-concerns',             label: 'Ontology Concerns',        icon: AlertTriangle, node: <ConcernsMappingPanel initialTab="ont-concerns" /> },
                      { id: 'ont-assessment-questions', label: 'Assessment Questions',     icon: MessageCircle, node: <ConcernsMappingPanel initialTab="ont-assessment-questions" /> },
                      { id: 'ont-ai-rules',             label: 'AI Rules',                 icon: Bot,           node: <AIRulesPanel /> },
                      { id: 'ont-import-export',        label: 'Import / Export',          icon: FileDown,      node: <OntologyImportExportPanel /> },
                    ]}
                    tabGroups={[
                      {
                        label: 'Core Assessment',
                        ids: ['cmp-command-center', 'cmp-intelligence', 'cmp-framework-intel', 'cmp-search-discovery', 'cmp-questions', 'cmp-question-map', 'cmp-questionbank', 'cmp-custom-modules', 'cmp-assessment-mapping', 'cmp-scoring'],
                      },
                      {
                        label: 'Framework Structure',
                        ids: ['cmp-master', 'cmp-micro-framework', 'cmp-role-profile', 'cmp-role-families', 'cmp-blueprints', 'cmp-blueprint-mappings', 'cmp-level-profiles'],
                      },
                      {
                        label: 'Reference Library (O*NET)',
                        ids: ['ont-overview', 'ont-sectors', 'ont-industries', 'ont-industry-segments', 'ont-functions', 'ont-departments', 'ont-role-families', 'ont-roles', 'ont-role-crosswalk', 'ont-career-tracks', 'ont-competency-levels', 'ont-indicators', 'ont-benchmarks', 'ont-career-paths', 'ont-learning-paths', 'ont-future-skills', 'ont-layers', 'ont-clusters', 'ont-competencies', 'ont-micro-competencies', 'ont-concerns', 'ont-assessment-questions', 'ont-ai-rules', 'ont-import-export'],
                        collapsed: true,
                      },
                      {
                        label: 'Legacy Framework (empty — being retired)',
                        ids: ['domains', 'sub', 'content', 'clusters', 'norms', 'weights', 'scoring', 'reports'],
                        collapsed: true,
                      },
                    ]}
                  />
                </div>
              )}

              {/* ─── Collapsed domain-framework hosts (tabbed shells) ───────────── */}
              {activeTab === 'career-builder-fw' && (
                <div className="p-6">
                  <AdminTabbedShell color={BRAND.primary} tabs={[
                    { id: 'cc-career',                label: 'Command Center',                icon: Network,    node: <ProductCommandCenter productKey="career" /> },
                    { id: 'career-graph-admin',       label: 'Career Graph Intelligence',     icon: Network,    node: <div className="h-full overflow-hidden flex flex-col"><CareerGraphPanel /></div> },
                    { id: 'career-pathway-analytics', label: 'Pathway Analytics',             icon: Map,        node: <div className="h-full overflow-auto"><CareerPathwayAnalyticsPanel /></div> },
                    { id: 'occupation-analytics',     label: 'Occupation Analytics',          icon: Briefcase,  node: <div className="h-full overflow-auto"><OccupationAnalyticsPanel /></div> },
                    { id: 'recommendation-analytics', label: 'Recommendation Analytics',      icon: Sparkles,   node: <div className="h-full overflow-auto"><RecommendationAnalyticsPanel /></div> },
                    { id: 'forecast-analytics',       label: 'Forecast Analytics',            icon: TrendingUp, node: <div className="h-full overflow-auto"><ForecastAnalyticsPanel /></div> },
                    { id: 'transition-analytics',     label: 'Transition Analytics',          icon: GitBranch,  node: <div className="h-full overflow-auto"><TransitionAnalyticsPanel /></div> },
                    { id: 'lip-admin',                label: 'Learning Intelligence Platform',icon: BookOpen,   node: <div className="h-full overflow-auto"><LIPDesignPanel /></div> },
                    { id: 'learning',                 label: 'Learning Plans',                icon: BookOpen,   node: <LearningPlansPanel /> },
                  ]} />
                </div>
              )}
              {activeTab === 'employer-fw' && (
                <div className="p-6">
                  <AdminTabbedShell color={BRAND.primary} tabs={[
                    { id: 'cc-employer',                 label: 'Command Center',          icon: Building2,     node: <ProductCommandCenter productKey="employer" /> },
                    { id: 'talent-signal-master',        label: 'Talent Signal Master',    icon: Activity,      node: <div className="h-full overflow-auto"><TalentSignalMasterPanel /></div> },
                    { id: 'talent-scoring',              label: 'Talent Scoring',          icon: BarChart2,     node: <div className="h-full overflow-auto p-4"><TalentScoringPanel /></div> },
                    { id: 'talent-gaps',                 label: 'Gap Intelligence',        icon: AlertTriangle, node: <div className="h-full overflow-auto p-4"><TalentGapPanel /></div> },
                    { id: 'talent-pipeline',             label: 'Pipeline Analytics',      icon: TrendingUp,    node: <div className="h-full overflow-auto p-4"><TalentPipelinePanel /></div> },
                    { id: 'talent-concern-intelligence', label: 'Concern Intelligence (D4)', icon: AlertTriangle, node: <div className="h-full overflow-auto"><TalentConcernIntelligencePanel /></div> },
                    { id: 'talent-competency-dna',       label: 'Competency DNA (D5)',     icon: Database,      node: <div className="h-full overflow-auto"><TalentCompetencyDNAPanel /></div> },
                    { id: 'talent-readiness-engine',     label: 'Readiness Engine (D9)',   icon: TrendingUp,    node: <div className="h-full overflow-auto"><TalentReadinessEnginePanel /></div> },
                    { id: 'talent-digital-twin-admin',   label: 'Digital Twin (D14)',      icon: Cpu,           node: <div className="h-full overflow-auto"><TalentDigitalTwinAdminPanel /></div> },
                    { id: 'talent-outcome-prediction',   label: 'Outcome Prediction (D15)',icon: Sparkles,      node: <div className="h-full overflow-auto"><TalentOutcomePredictionPanel /></div> },
                    { id: 'talent-benchmark-engine',     label: 'Benchmark Engine (D17)',  icon: BarChart3,     node: <div className="h-full overflow-auto"><TalentBenchmarkEnginePanel /></div> },
                    { id: 'talent-measurement-science',  label: 'Scoring Formulas (D8)',   icon: Calculator,    node: <div className="h-full overflow-auto"><TalentMeasurementSciencePanel /></div> },
                    { id: 'talent-analytics-warehouse',  label: 'Analytics Warehouse (D20)', icon: BarChart2,   node: <div className="h-full overflow-auto"><TalentAnalyticsWarehousePanel /></div> },
                    { id: 'talent-learning-catalog',     label: 'Learning Catalog (D12)',  icon: Award,         node: <div className="h-full overflow-auto"><TalentLearningCatalogPanel /></div> },
                    { id: 'passport-stats-admin',        label: 'Passport Stats & Governance', icon: Award,     node: <div className="h-full overflow-auto"><PassportStatsPanel /></div> },
                    { id: 'predictive-intelligence',     label: 'Predictive Intelligence', icon: TrendingUp,    node: <div className="h-full overflow-hidden flex flex-col"><PredictiveIntelligencePanel /></div> },
                  ]} />
                </div>
              )}
              {activeTab === 'employability-fw' && (
                <div className="p-6">
                  <AdminTabbedShell color={BRAND.primary} tabs={[
                    { id: 'cc-employability',     label: 'Command Center',       icon: TrendingUp, node: <ProductCommandCenter productKey="employability" /> },
                    { id: 'ei-health',            label: 'EI Health & Analytics',icon: TrendingUp, node: <div className="h-full overflow-auto p-6 space-y-10"><EIOperationsPanel /><div className="border-t pt-8"><EIHealthPanel /></div></div> },
                    { id: 'career-evidence',      label: 'Outcome Evidence Loop',icon: Award,      node: <div className="h-full overflow-auto p-6"><CareerEvidencePanel /></div> },
                    { id: 'readiness-dashboards', label: 'Readiness Dashboards', icon: Gauge,      node: <ReadinessDashboardsPanel /> },
                    { id: 'mei-v2-design',        label: 'MEI v2 Design',        icon: BarChart3,  node: <div className="h-full overflow-auto"><MEIDesignPanel /></div> },
                  ]} />
                </div>
              )}
              {activeTab === 'future-readiness-fw' && (
                <div className="p-6">
                  <AdminTabbedShell color={BRAND.primary} tabs={[
                    { id: 'frp-admin',             label: 'Future Readiness Platform', icon: Zap,    node: <div className="h-full overflow-auto"><FRPDesignPanel /></div> },
                    { id: 'talent-frp-enrichment', label: 'FRP Enrichment (D13)',      icon: Target, node: <div className="h-full overflow-auto"><TalentFRPEnrichmentPanel /></div> },
                  ]} />
                </div>
              )}
              {activeTab === 'assessment-factory-fw' && (
                <div className="p-6">
                  <AdminTabbedShell color={BRAND.primary} tabs={[
                    { id: 'caf-question-bank',      label: 'CAF Question Bank',   icon: Database,       node: <div className="h-full overflow-auto"><CAFQuestionBankPanel /></div> },
                    { id: 'caf-scenarios',          label: 'Scenario Framework',  icon: ClipboardList,  node: <div className="h-full overflow-auto"><CAFScenarioPanel /></div> },
                    { id: 'caf-difficulty-level',   label: 'Difficulty & Levels', icon: Sliders,        node: <div className="h-full overflow-auto"><CAFDifficultyLevelPanel /></div> },
                    { id: 'caf-assessment-builder', label: 'Assessment Builder',  icon: Cpu,            node: <div className="h-full overflow-auto"><CAFAssessmentBuilderPanel /></div> },
                    { id: 'caf-randomization',      label: 'Randomization Engine',icon: Shuffle,        node: <div className="h-full overflow-auto"><CAFRandomizationPanel /></div> },
                    { id: 'caf-sessions',           label: 'CAF Sessions',        icon: Timer,          node: <div className="h-full overflow-auto"><CAFSessionsPanel /></div> },
                    { id: 'caf-scoring',            label: 'CAF Scoring Engine',  icon: ClipboardCheck, node: <div className="h-full overflow-auto"><CAFScoringPanel /></div> },
                    { id: 'caf-analytics',          label: 'CAF Analytics',       icon: LineChart,      node: <div className="h-full overflow-auto"><CAFAnalyticsPanel /></div> },
                  ]} />
                </div>
              )}
              {activeTab === 'career-graph-admin' && (
                <div className="h-full overflow-hidden flex flex-col">
                  <CareerGraphPanel />
                </div>
              )}
              {activeTab === 'career-pathway-analytics' && (
                <div className="h-full overflow-auto">
                  <CareerPathwayAnalyticsPanel />
                </div>
              )}
              {activeTab === 'role-families' && (
                <div className="h-full overflow-auto p-4">
                  <RoleFamilyPanel />
                </div>
              )}
              {activeTab === 'competency-blueprints' && (
                <div className="h-full overflow-auto p-4">
                  <CompetencyBlueprintPanel />
                </div>
              )}
              {activeTab === 'blueprint-mappings' && (
                <div className="h-full overflow-auto p-4">
                  <BlueprintMappingPanel />
                </div>
              )}
              {activeTab === 'level-profiles' && (
                <div className="h-full overflow-auto p-4">
                  <LevelProfilePanel />
                </div>
              )}
              {activeTab === 'talent-scoring' && (
                <div className="h-full overflow-auto p-4">
                  <TalentScoringPanel />
                </div>
              )}
              {activeTab === 'talent-gaps' && (
                <div className="h-full overflow-auto p-4">
                  <TalentGapPanel />
                </div>
              )}
              {activeTab === 'talent-pipeline' && (
                <div className="h-full overflow-auto p-4">
                  <TalentPipelinePanel />
                </div>
              )}
              {activeTab === 'talent-signal-master' && (
                <div className="h-full overflow-auto">
                  <TalentSignalMasterPanel />
                </div>
              )}
              {activeTab === 'talent-competency-dna' && (
                <div className="h-full overflow-auto">
                  <TalentCompetencyDNAPanel />
                </div>
              )}
              {activeTab === 'talent-readiness-engine' && (
                <div className="h-full overflow-auto">
                  <TalentReadinessEnginePanel />
                </div>
              )}
              {activeTab === 'talent-outcome-prediction' && (
                <div className="h-full overflow-auto">
                  <TalentOutcomePredictionPanel />
                </div>
              )}
              {activeTab === 'talent-benchmark-engine' && (
                <div className="h-full overflow-auto">
                  <TalentBenchmarkEnginePanel />
                </div>
              )}
              {activeTab === 'talent-digital-twin-admin' && (
                <div className="h-full overflow-auto">
                  <TalentDigitalTwinAdminPanel />
                </div>
              )}
              {activeTab === 'talent-measurement-science' && (
                <div className="h-full overflow-auto">
                  <TalentMeasurementSciencePanel />
                </div>
              )}
              {activeTab === 'talent-analytics-warehouse' && (
                <div className="h-full overflow-auto">
                  <TalentAnalyticsWarehousePanel />
                </div>
              )}
              {activeTab === 'talent-learning-catalog' && (
                <div className="h-full overflow-auto">
                  <TalentLearningCatalogPanel />
                </div>
              )}
              {activeTab === 'talent-frp-enrichment' && (
                <div className="h-full overflow-auto">
                  <TalentFRPEnrichmentPanel />
                </div>
              )}
              {activeTab === 'talent-concern-intelligence' && (
                <div className="h-full overflow-auto">
                  <TalentConcernIntelligencePanel />
                </div>
              )}
              {activeTab === 'competency-intelligence-admin' && (
                <div className="h-full overflow-auto">
                  <CompetencyIntelligenceAdminPanel />
                </div>
              )}
              {activeTab === 'vx-capability-architecture' && (
                <div className="h-full overflow-auto">
                  <VXCapabilityArchitecturePanel />
                </div>
              )}
              {activeTab === 'vx-labor-market-intelligence' && (
                <div className="h-full overflow-auto">
                  <VXLaborMarketIntelligencePanel />
                </div>
              )}
              {activeTab === 'vx-evidence-intelligence' && (
                <div className="h-full overflow-auto">
                  <VXEvidenceIntelligencePanel />
                </div>
              )}
              {activeTab === 'vx-tenant-configuration' && (
                <div className="h-full overflow-auto">
                  <VXTenantConfigurationPanel />
                </div>
              )}
              {activeTab === 'vx-assessment-runtime' && (
                <div className="h-full overflow-auto">
                  <VXAssessmentRuntimePanel />
                </div>
              )}
              {activeTab === 'competency-runtime' && (
                <div className="h-full overflow-auto">
                  <CompetencyRuntimePanel />
                </div>
              )}
              {activeTab === 'competency-ei' && (
                <div className="h-full overflow-auto">
                  <CompetencyEIPanel />
                </div>
              )}
              {activeTab === 'career-intelligence' && (
                <div className="h-full overflow-auto">
                  <CareerIntelligencePanel />
                </div>
              )}
              {activeTab === 'ei-profile' && (
                <div className="h-full overflow-auto">
                  <EiProfileDashboardPanel />
                </div>
              )}
              {activeTab === 'vx-competency-science-council' && (
                <div className="h-full overflow-auto">
                  <VXCompetencyScienceCouncilPanel />
                </div>
              )}
              {activeTab === 'vx-workforce-knowledge-graph' && (
                <div className="h-full overflow-auto">
                  <VXWorkforceKnowledgeGraphPanel />
                </div>
              )}
              {activeTab === 'vx-irt-engine' && (
                <div className="h-full overflow-auto">
                  <VXIRTEnginePanel />
                </div>
              )}
              {activeTab === 'vx-report-intelligence' && (
                <div className="h-full overflow-auto">
                  <VXReportIntelligencePanel />
                </div>
              )}
              {activeTab === 'occupation-analytics' && (
                <div className="h-full overflow-auto">
                  <OccupationAnalyticsPanel />
                </div>
              )}
              {activeTab === 'recommendation-analytics' && (
                <div className="h-full overflow-auto">
                  <RecommendationAnalyticsPanel />
                </div>
              )}
              {activeTab === 'forecast-analytics' && (
                <div className="h-full overflow-auto">
                  <ForecastAnalyticsPanel />
                </div>
              )}
              {activeTab === 'transition-analytics' && (
                <div className="h-full overflow-auto">
                  <TransitionAnalyticsPanel />
                </div>
              )}
              {activeTab === 'lip-admin' && (
                <div className="h-full overflow-auto">
                  <LIPDesignPanel />
                </div>
              )}
              {activeTab === 'frp-admin' && (
                <div className="h-full overflow-auto">
                  <FRPDesignPanel />
                </div>
              )}
              {activeTab === 'career-evidence' && (
                <div className="h-full overflow-auto p-6">
                  <CareerEvidencePanel />
                </div>
              )}
              {activeTab === 'passport-stats-admin' && (
                <div className="h-full overflow-auto">
                  <PassportStatsPanel />
                </div>
              )}
              {activeTab === 'report-factory-admin' && (
                <div className="h-full overflow-hidden flex flex-col">
                  <ReportFactoryPanel />
                </div>
              )}
              {activeTab === 'enterprise-analytics' && (
                <div className="h-full overflow-auto">
                  <EnterpriseAnalyticsPanel />
                </div>
              )}
              {activeTab === 'ai-governance' && (
                <div className="h-full overflow-auto">
                  <AiGovernancePanel />
                </div>
              )}
              {activeTab === 'ei-health' && (
                <div className="h-full overflow-auto p-6 space-y-10">
                  <EIOperationsPanel />
                  <div className="border-t pt-8">
                    <EIHealthPanel />
                  </div>
                </div>
              )}
              {activeTab === 'mei-v2-design' && (
                <div className="h-full overflow-auto">
                  <MEIDesignPanel />
                </div>
              )}

              {/* ── Competency Ontology panels ─────────────────────────────── */}
              {activeTab === 'ont-overview'         && <div className="h-full overflow-auto"><OntologyOverviewPanel /></div>}
              {activeTab === 'ont-sectors'          && <div className="h-full overflow-auto"><SectorsPanel /></div>}
              {activeTab === 'ont-industries'       && <div className="h-full overflow-auto"><IndustriesPanel /></div>}
              {activeTab === 'ont-industry-segments'&& <div className="h-full overflow-auto"><IndustrySegmentsPanel /></div>}
              {activeTab === 'ont-role-crosswalk'   && <div className="h-full overflow-auto"><RoleCrosswalkPanel /></div>}
              {activeTab === 'ont-functions'        && <div className="h-full overflow-auto"><FunctionsPanel /></div>}
              {activeTab === 'ont-departments'      && <div className="h-full overflow-auto"><DepartmentsPanel /></div>}
              {activeTab === 'ont-roles'            && <div className="h-full overflow-auto"><RolesPanel /></div>}
              {activeTab === 'ont-career-tracks'    && <div className="h-full overflow-auto"><CareerTracksPanel /></div>}
              {activeTab === 'ont-competency-levels'&& <div className="h-full overflow-auto"><CompetencyLevelsPanel /></div>}
              {activeTab === 'ont-indicators'       && <div className="h-full overflow-auto"><IndicatorsPanel /></div>}
              {activeTab === 'ont-benchmarks'       && <div className="h-full overflow-auto"><BenchmarksPanel /></div>}
              {activeTab === 'ont-role-families'    && <div className="h-full overflow-auto"><RoleFamiliesPanel /></div>}
              {activeTab === 'ont-career-paths'     && <div className="h-full overflow-auto"><CareerPathsPanel /></div>}
              {activeTab === 'ont-learning-paths'   && <div className="h-full overflow-auto"><LearningPathsOntologyPanel /></div>}
              {activeTab === 'ont-future-skills'    && <div className="h-full overflow-auto"><FutureSkillsPanel /></div>}
              {activeTab === 'ont-ai-rules'         && <div className="h-full overflow-auto"><AIRulesPanel /></div>}
              {activeTab === 'ont-import-export'    && <div className="h-full overflow-auto p-6"><OntologyImportExportPanel /></div>}

              {/* ── Competency Framework panels ──────────────────────────────── */}
              {(activeTab === 'ont-layers' || activeTab === 'ont-clusters' || activeTab === 'ont-competencies' || activeTab === 'ont-micro-competencies') &&
                <div className="h-full overflow-auto"><CompetencyCorePanel initialTab={activeTab} /></div>}

              {/* ── Behavioural Mapping panels ───────────────────────────────── */}
              {(activeTab === 'ont-concerns' || activeTab === 'ont-assessment-questions') &&
                <div className="h-full overflow-auto"><ConcernsMappingPanel initialTab={activeTab} /></div>}

              {/* ── Platform Operations panels ──────────────────────────────── */}
              {activeTab === 'platform-audit'       && <div className="h-full overflow-auto p-6"><PlatformAuditLogPanel /></div>}
              {activeTab === 'approvals'            && <div className="h-full overflow-auto p-6"><ApprovalWorkflowPanel /></div>}
              {activeTab === 'governance-security'  && <div className="h-full overflow-auto"><GovernanceSecurityPanel /></div>}
              {activeTab === 'ont-governance'       && <div className="h-full overflow-auto"><OntologyGovernancePanel /></div>}

              {/* ── Competency Assessment Factory panels ───────────────────── */}
              {activeTab === 'caf-question-bank'      && <div className="h-full overflow-auto"><CAFQuestionBankPanel /></div>}
              {activeTab === 'caf-scenarios'          && <div className="h-full overflow-auto"><CAFScenarioPanel /></div>}
              {activeTab === 'caf-difficulty-level'   && <div className="h-full overflow-auto"><CAFDifficultyLevelPanel /></div>}
              {activeTab === 'caf-assessment-builder' && <div className="h-full overflow-auto"><CAFAssessmentBuilderPanel /></div>}
              {activeTab === 'caf-randomization'      && <div className="h-full overflow-auto"><CAFRandomizationPanel /></div>}
              {activeTab === 'caf-sessions'           && <div className="h-full overflow-auto"><CAFSessionsPanel /></div>}
              {activeTab === 'caf-scoring'            && <div className="h-full overflow-auto"><CAFScoringPanel /></div>}
              {activeTab === 'caf-analytics'          && <div className="h-full overflow-auto"><CAFAnalyticsPanel /></div>}

              {/* ═══════════════════════════════════════════════════════════════
                  CALCULATION & NORMS ENGINE  (compact + functional)
              ═══════════════════════════════════════════════════════════════ */}
              </Suspense>
            </DialogsErrorBoundary>
          )}
        </div>

      </main>
      {/* AdminDialogs mount removed: pre-existing component has dozens of bare
          (non-destructured) ctx references that throw on every render. Legacy
          dialog flows are accessible via their owning panels. */}

    </div>
    </AdminDashboardContext.Provider>
  );
}
