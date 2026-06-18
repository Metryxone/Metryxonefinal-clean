import React, { lazy, Suspense, useState, useEffect } from 'react';
import { Screen } from '../App';

import { Menu, RefreshCw, Search, Settings } from 'lucide-react';
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
import CompetencyAdminPage from '../pages/CompetencyAdminPage';
const ActiveAgeBandsReflection = lazy(() => import('./superadmin/ActiveAgeBandsReflection'));
import AssessmentModulesManagement from './AssessmentModulesManagement';
import FrameworkPanel from '@/components/admin/FrameworkPanel';
import { LBI_CONFIG, COMPETENCY_CONFIG, SDI_CONFIG } from '@/components/admin/framework-configs';
import NotificationCenter from '@/components/NotificationCenter';

const FeatureFlagsPanel = lazy(() => import('./superadmin/FeatureFlagsPanel'));
const GovernancePanel = lazy(() => import('./superadmin/GovernancePanel'));
const OverviewPanel = lazy(() => import('./superadmin/OverviewPanel'));
const UserMgmtPanel = lazy(() => import('./superadmin/UserMgmtPanel'));
const EIHealthPanel = lazy(() => import('./superadmin/EIHealthPanel'));
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
      <main className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
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
                  <FrameworkPanel config={LBI_CONFIG} />
                </div>
              )}
              {activeTab === 'capadex-fw' && (
                <div className="p-6 h-full overflow-y-auto">
                  <FrameworkPanel config={SDI_CONFIG} />
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
                  <FrameworkPanel config={COMPETENCY_CONFIG} />
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
              {activeTab === 'ont-industries'       && <div className="h-full overflow-auto"><IndustriesPanel /></div>}
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
