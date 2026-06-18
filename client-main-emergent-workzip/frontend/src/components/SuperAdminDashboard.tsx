import React from 'react';
import { Screen } from '../App';

import { Menu, RefreshCw, Search, Settings } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import SuperAdminLogin from './SuperAdminLogin';
import ConcernAreasPanel from './superadmin/ConcernAreasPanel';
import EmployerOnboardingPanel from './superadmin/EmployerOnboardingPanel';
import CapadexReportsPanel from './superadmin/CapadexReportsPanel';
import CapadexUsersPanel from './superadmin/CapadexUsersPanel';
import CapadexAnalyticsPanel from './superadmin/CapadexAnalyticsPanel';
import CapadexInterventionsPanel from './superadmin/CapadexInterventionsPanel';
import CapadexPricingPanel from './superadmin/CapadexPricingPanel';
import SignalIntelligencePanel from './superadmin/SignalIntelligencePanel';
import IntelligencePipelinePanel from './superadmin/IntelligencePipelinePanel';
import SimulationDashboard from './superadmin/SimulationDashboard';
import CoverageDashboardPanel from './superadmin/CoverageDashboardPanel';
import ArchetypeIntelligencePanel from './superadmin/ArchetypeIntelligencePanel';
import HumanIntelligencePanel from './superadmin/HumanIntelligencePanel';
import SearchIntentPanel from './superadmin/SearchIntentPanel';
import InterventionIntelligencePanel from './superadmin/InterventionIntelligencePanel';
import ConcernSignalMapPanel from './superadmin/ConcernSignalMapPanel';
import QuestionRegistryPanel from './superadmin/QuestionRegistryPanel';
import CSIPanel from './superadmin/CSIPanel';
import ReferenceIntelligencePanel from './superadmin/ReferenceIntelligencePanel';
import ConcernIntelligencePanel from './superadmin/ConcernIntelligencePanel';
import UnifiedReportsPanel from './superadmin/UnifiedReportsPanel';
import EnterpriseAnalyticsPanel from './superadmin/EnterpriseAnalyticsPanel';
import AiGovernancePanel from './superadmin/AiGovernancePanel';
import LBIPanel from './superadmin/LBIPanel';
import PredictiveIntelligencePanel from './superadmin/PredictiveIntelligencePanel';
import TenantsPanel from './superadmin/TenantsPanel';
import CognitiveIntelligencePanel    from './superadmin/CognitiveIntelligencePanel';
import ConversationalQualityPanel   from './superadmin/ConversationalQualityPanel';
import DigitalTwinPanel from './superadmin/DigitalTwinPanel';
import PsychometricsPanel from './superadmin/PsychometricsPanel';
import SemanticReasoningPanel from './superadmin/SemanticReasoningPanel';
import MemoryArchitecturePanel from './superadmin/MemoryArchitecturePanel';
import EthicsGovernancePanel from './superadmin/EthicsGovernancePanel';
import FairnessPanel from './superadmin/FairnessPanel';
import SPEScoringPanel from './superadmin/SPEScoringPanel';
import SPEPsychometricsPanel from './superadmin/SPEPsychometricsPanel';
import SPELongitudinalPanel from './superadmin/SPELongitudinalPanel';
import SPEGovernancePanel from './superadmin/SPEGovernancePanel';
import BIOSFrontierPanel from './superadmin/BIOSFrontierPanel';
import BIOSFusionPanel from './superadmin/BIOSFusionPanel';
import BIOSAgentsPanel from './superadmin/BIOSAgentsPanel';
import BIOSSimulationPanel from './superadmin/BIOSSimulationPanel';
import ROIERiskPanel from './superadmin/ROIERiskPanel';
import ROIEOpportunityPanel from './superadmin/ROIEOpportunityPanel';
import ROIESemanticPanel from './superadmin/ROIESemanticPanel';
import ROIEGovernancePanel from './superadmin/ROIEGovernancePanel';
import PAIEForecastingPanel from './superadmin/PAIEForecastingPanel';
import PAIEOpportunityPanel from './superadmin/PAIEOpportunityPanel';
import PAIEIntelligencePanel from './superadmin/PAIEIntelligencePanel';
import PAIEGovernancePanel from './superadmin/PAIEGovernancePanel';
import LDETemporalPanel from './superadmin/LDETemporalPanel';
import LDEEvolutionPanel from './superadmin/LDEEvolutionPanel';
import LDEIntelligencePanel from './superadmin/LDEIntelligencePanel';
import LDEGovernancePanel from './superadmin/LDEGovernancePanel';
import LDEGraphPanel from './superadmin/LDEGraphPanel';
import RIEDashboardPanel from './superadmin/RIEDashboardPanel';
import RIERecommendationsPanel from './superadmin/RIERecommendationsPanel';
import RIEInterventionsPanel from './superadmin/RIEInterventionsPanel';
import RIEEscalationsPanel from './superadmin/RIEEscalationsPanel';
import CrisisAlertInbox from './superadmin/CrisisAlertInbox';
import OntologyMatrixPanel from './superadmin/OntologyMatrixPanel';
import RIERecoveryPanel from './superadmin/RIERecoveryPanel';
import RIEOpportunityPanel from './superadmin/RIEOpportunityPanel';
import CounsellorDirectoryPanel from './superadmin/CounsellorDirectoryPanel';
import ShortAssessmentsPanel from './superadmin/ShortAssessmentsPanel';
import CompetencyQuestionsPanel from './superadmin/CompetencyQuestionsPanel';
import CompetencyAdminPage from '../pages/CompetencyAdminPage';
import ActiveAgeBandsReflection from './superadmin/ActiveAgeBandsReflection';
import AssessmentModulesManagement from './AssessmentModulesManagement';
import FrameworkPanel from '@/components/admin/FrameworkPanel';
import { LBI_CONFIG, COMPETENCY_CONFIG, SDI_CONFIG } from '@/components/admin/framework-configs';
import NotificationCenter from '@/components/NotificationCenter';

import FeatureFlagsPanel       from './superadmin/FeatureFlagsPanel';
import GovernancePanel         from './superadmin/GovernancePanel';
import OverviewPanel           from './superadmin/OverviewPanel';
import UserMgmtPanel           from './superadmin/UserMgmtPanel';
import EIHealthPanel           from './superadmin/EIHealthPanel';
import MEIDesignPanel          from './superadmin/MEIDesignPanel';
import EIOperationsPanel       from './superadmin/EIOperationsPanel';
import CareerGraphPanel        from './superadmin/CareerGraphPanel';
import LIPDesignPanel          from './superadmin/LIPDesignPanel';
import FRPDesignPanel          from './superadmin/FRPDesignPanel';
import CareerPathwayAnalyticsPanel  from './superadmin/CareerPathwayAnalyticsPanel';
import OccupationAnalyticsPanel     from './superadmin/OccupationAnalyticsPanel';
import RecommendationAnalyticsPanel from './superadmin/RecommendationAnalyticsPanel';
import ForecastAnalyticsPanel       from './superadmin/ForecastAnalyticsPanel';
import TransitionAnalyticsPanel     from './superadmin/TransitionAnalyticsPanel';
import PassportStatsPanel      from './superadmin/PassportStatsPanel';
import ReportFactoryPanel      from './superadmin/ReportFactoryPanel';
import HRPanel                 from './superadmin/HRPanel';
import MentorsPanel            from './superadmin/MentorsPanel';
import EntityCodesPanel        from './superadmin/EntityCodesPanel';
import ConsentsPanel           from './superadmin/ConsentsPanel';
import AccessControlPanel      from './superadmin/AccessControlPanel';
import LearningPlansPanel      from './superadmin/LearningPlansPanel';
import FinancialsPanel         from './superadmin/FinancialsPanel';
import ParentsPanel            from './superadmin/ParentsPanel';
import StudentsPanel           from './superadmin/StudentsPanel';
import InstitutionsPanel       from './superadmin/InstitutionsPanel';
import StudentsLegacyPanel     from './superadmin/StudentsLegacyPanel';
import DocumentsPanel          from './superadmin/DocumentsPanel';
import SecurityPanel           from './superadmin/SecurityPanel';
import QuestionBankPanel       from './superadmin/QuestionBankPanel';
import ScoringPanel            from './superadmin/ScoringPanel';
import PricingPanel            from './superadmin/PricingPanel';
import NotificationsMgmtPanel  from './superadmin/NotificationsMgmtPanel';
import SettingsPanel           from './superadmin/SettingsPanel';
import ContentManagerPanel     from './superadmin/ContentManagerPanel';
import IndustriesPanel        from './superadmin/IndustriesPanel';
import PlatformAuditLogPanel   from './superadmin/PlatformAuditLogPanel';
import ApprovalWorkflowPanel   from './superadmin/ApprovalWorkflowPanel';
import OntologyImportExportPanel from './superadmin/OntologyImportExportPanel';
import FunctionsPanel         from './superadmin/FunctionsPanel';
import DepartmentsPanel       from './superadmin/DepartmentsPanel';
import RolesPanel             from './superadmin/RolesPanel';
import RoleFamiliesPanel     from './superadmin/RoleFamiliesPanel';
import CareerTracksPanel      from './superadmin/CareerTracksPanel';
import CompetencyLevelsPanel  from './superadmin/CompetencyLevelsPanel';
import IndicatorsPanel        from './superadmin/IndicatorsPanel';
import BenchmarksPanel        from './superadmin/BenchmarksPanel';
import CareerPathsPanel       from './superadmin/CareerPathsPanel';
import LearningPathsOntologyPanel from './superadmin/LearningPathsOntologyPanel';
import FutureSkillsPanel      from './superadmin/FutureSkillsPanel';
import AIRulesPanel           from './superadmin/AIRulesPanel';
import CompetencyCorePanel    from './superadmin/CompetencyCorePanel';
import ConcernsMappingPanel   from './superadmin/ConcernsMappingPanel';
import OntologyGovernancePanel from './superadmin/OntologyGovernancePanel';
import OntologyOverviewPanel  from './superadmin/OntologyOverviewPanel';
import CAFQuestionBankPanel   from './superadmin/caf/CAFQuestionBankPanel';
import CAFScenarioPanel       from './superadmin/caf/CAFScenarioPanel';
import CAFDifficultyLevelPanel from './superadmin/caf/CAFDifficultyLevelPanel';
import CAFAssessmentBuilderPanel from './superadmin/caf/CAFAssessmentBuilderPanel';
import CAFRandomizationPanel  from './superadmin/caf/CAFRandomizationPanel';
import CAFSessionsPanel       from './superadmin/caf/CAFSessionsPanel';
import CAFScoringPanel        from './superadmin/caf/CAFScoringPanel';
import CAFAnalyticsPanel      from './superadmin/caf/CAFAnalyticsPanel';
import RoleFamilyPanel         from './superadmin/RoleFamilyPanel';
import CompetencyBlueprintPanel from './superadmin/CompetencyBlueprintPanel';
import BlueprintMappingPanel   from './superadmin/BlueprintMappingPanel';
import LevelProfilePanel       from './superadmin/LevelProfilePanel';
import TalentScoringPanel           from './superadmin/TalentScoringPanel';
import TalentGapPanel               from './superadmin/TalentGapPanel';
import TalentPipelinePanel          from './superadmin/TalentPipelinePanel';
import TalentSignalMasterPanel      from './superadmin/TalentSignalMasterPanel';
import TalentCompetencyDNAPanel     from './superadmin/TalentCompetencyDNAPanel';
import TalentReadinessEnginePanel   from './superadmin/TalentReadinessEnginePanel';
import TalentOutcomePredictionPanel from './superadmin/TalentOutcomePredictionPanel';
import TalentBenchmarkEnginePanel   from './superadmin/TalentBenchmarkEnginePanel';
import TalentDigitalTwinAdminPanel  from './superadmin/TalentDigitalTwinAdminPanel';
import TalentMeasurementSciencePanel from './superadmin/TalentMeasurementSciencePanel';
import TalentAnalyticsWarehousePanel from './superadmin/TalentAnalyticsWarehousePanel';
import TalentLearningCatalogPanel   from './superadmin/TalentLearningCatalogPanel';
import TalentFRPEnrichmentPanel          from './superadmin/TalentFRPEnrichmentPanel';
import TalentConcernIntelligencePanel   from './superadmin/TalentConcernIntelligencePanel';
import CompetencyIntelligenceAdminPanel from './superadmin/CompetencyIntelligenceAdminPanel';
import VXCapabilityArchitecturePanel    from './superadmin/VXCapabilityArchitecturePanel';
import VXLaborMarketIntelligencePanel   from './superadmin/VXLaborMarketIntelligencePanel';
import VXEvidenceIntelligencePanel      from './superadmin/VXEvidenceIntelligencePanel';
import VXTenantConfigurationPanel       from './superadmin/VXTenantConfigurationPanel';
import VXAssessmentRuntimePanel         from './superadmin/VXAssessmentRuntimePanel';
import VXCompetencyScienceCouncilPanel  from './superadmin/VXCompetencyScienceCouncilPanel';
import VXWorkforceKnowledgeGraphPanel   from './superadmin/VXWorkforceKnowledgeGraphPanel';
import VXIRTEnginePanel                 from './superadmin/VXIRTEnginePanel';
import VXReportIntelligencePanel        from './superadmin/VXReportIntelligencePanel';
import { AdminDashboardContext, type AdminDashboardContextValue } from '@/contexts/AdminDashboardContext';
import { useAdminDashboardState } from '@/hooks/useAdminDashboardState';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminDialogs } from '@/components/admin/AdminDialogs';

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
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white border-b shadow-sm">
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

        {/* Content */}
        <div className="p-6">
          {statsLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-8 w-8 animate-spin" style={{ color: BRAND.primary }} />
            </div>
          ) : (
            <DialogsErrorBoundary resetKey={activeTab}>
              {/* ─── Extracted Inline Tab Panels ─── */}
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
