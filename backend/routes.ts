import type { Express } from "express";
import { createServer, type Server } from "http";
import { CONCERN_TO_CONSTRUCT, CONSTRUCT_MAP, normalizeConcernKey } from './data/behavioural-constructs';
import { storage } from "./storage";
import { buildCapadexReportHtml, sendLoginOtp, sendMfaCode } from "./email";
import { buildOmegaEmailExtras } from "./services/omega-report-builder";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import { registerSdiRoutes } from "./routes/sdi";
import { registerEngineRoutes } from "./routes/engines";
import { registerFrameworkParityRoutes } from "./routes/framework-parity";
import { registerImportExportRoutes } from "./routes/import-export";
import { registerAuditRoutes } from "./routes/audit";
import { registerCapadexRoutes, registerCapadexRecommendationsRoute } from "./routes/capadex";
import { registerFirebaseAuthRoutes } from "./routes/firebase-auth";
import { registerCvParserRoutes } from "./routes/cv-parser";
import { registerCareerSeekerRoutes } from "./routes/career-seeker";
import { registerRecruiterPostingsRoutes } from "./routes/recruiter-postings";
import { registerBehaviouralMemoryRoutes } from "./routes/behavioural-memory";
import { registerEmployabilityPassportRoutes } from "./routes/employability-passport";
import { registerCompetencyQuestionRoutes } from "./routes/competency-questions";
import { registerQuestionFactoryRoutes } from "./routes/question-factory";
import { registerPlatformLifecycleRoutes } from "./routes/platform-lifecycle";
import { registerPlatformLifecycleManagementRoutes } from "./routes/platform-lifecycle-management";
import { registerPlatformLifecycleIntelligenceRoutes } from "./routes/platform-lifecycle-intelligence";
import { registerPlatformEvolutionIntelligenceRoutes } from "./routes/platform-evolution-intelligence";
import { registerPlatformLifecycleAutomationRoutes } from "./routes/platform-lifecycle-automation";
import { registerPlatformLifecycleOperationsRoutes } from "./routes/platform-lifecycle-operations";
import { registerPlatformLifecycleCertificationRoutes } from "./routes/platform-lifecycle-certification";
import { registerPlatformIntelligenceRegistryRoutes } from "./routes/platform-intelligence-registry";
import { registerEngineeringIntelligenceRoutes } from "./routes/engineering-intelligence";
import { registerRuntimeIntelligenceRoutes } from "./routes/runtime-intelligence";
import { registerKnowledgeIntelligenceRoutes } from "./routes/knowledge-intelligence";
import { registerDecisionIntelligenceRoutes } from "./routes/decision-intelligence";
import { registerPredictiveIntelligenceEngineRoutes } from "./routes/predictive-intelligence-engine";
import { registerRecommendationIntelligenceEngineRoutes } from "./routes/recommendation-intelligence-engine";
import { registerContinuousLearningIntelligenceEngineRoutes } from "./routes/continuous-learning-intelligence-engine";
import { registerAssessmentReadinessRoutes } from "./routes/assessment-readiness";
import { registerMx203KnowledgeRoutes } from "./routes/mx203-knowledge";
import { registerCapadexEnterpriseRoutes } from "./routes/capadex-enterprise";
import { registerMissionControlRoutes } from "./routes/mission-control";
import { registerProductCommandCenterRoutes } from "./routes/product-command-center";
import { registerGlobalSearchRoutes } from "./routes/global-search";
import { registerActionCenterRoutes } from "./routes/action-center";
import { registerNotificationCenterRoutes } from "./routes/notification-center";
import { registerReadinessEngineRoutes } from "./routes/readiness-engine";
import { registerHealthAggregatorRoutes } from "./routes/health-aggregator";
import { registerCapadexPaymentRoutes } from "./routes/capadex-payments";
import { registerConcernIntelligenceRoutes } from "./routes/capadex-concern-intelligence";
import { registerCapadexQuestionsRoutes } from "./routes/capadex-questions";
import { registerCapadexOntologyRoutes } from "./routes/capadex-ontology";
import { registerConcernIntelligenceAdminRoutes } from "./routes/concern-intelligence-admin";
import { registerCapadexConcernsMasterRoutes } from "./routes/capadex-concerns-master";
import { registerCapadexClarityQuestionsRoutes } from "./routes/capadex-clarity-questions";
import { registerCapadexOntologyHubRoutes } from "./routes/capadex-ontology-hub";
import { registerCapadexCoverageRoutes } from "./routes/capadex-coverage";
import { registerPilArchetypeRoutes } from "./routes/pil-archetypes";
import { registerPilHumanIntelligenceRoutes } from "./routes/pil-human-intelligence";
import { registerPilSearchIntentRoutes } from "./routes/pil-search-intent";
import { registerPilInterventionRoutes } from "./routes/pil-intervention-intelligence";
import { registerCapadexConcernSignalMapRoutes } from "./routes/capadex-concern-signal-map";
import { registerCapadexQuestionRegistryRoutes } from "./routes/capadex-question-registry";
import { registerSimulationRoutes } from "./routes/capadex-simulation";
import { registerPilGraphTraversalRoutes } from "./routes/capadex-pil-graph";
import { registerWc7bActivationRoutes } from "./routes/wc7b-activation";
import { registerWc7cCommercialRoutes } from "./routes/wc7c-commercial";
import { registerCommercialSpineRoutes } from "./routes/commercial-spine";
import { registerInvoiceRoutes } from "./routes/invoice-engine";
import { registerCapadexPredictionRoutes } from "./routes/capadex-prediction";
import { registerSignalCaptureRoutes } from "./routes/signal-capture";
import { registerIntelligenceDiagnosticsRoutes } from "./routes/intelligence-diagnostics";
import { registerCSIRoutes } from "./routes/csi";
import { registerReferenceIntelligenceRoutes } from "./routes/reference-intelligence";
import { registerEIResolutionRoutes } from "./routes/ei-resolution";
import { registerVerificationRoutes } from "./routes/verification";
import { registerEIGovernanceRoutes } from "./routes/ei-governance";
import { registerEmployabilityGraphRoutes } from "./routes/employability-graph";
import { registerEIAdminRoutes } from "./routes/ei-admin";
import { registerEIIntelligenceRoute } from "./routes/ei-intelligence";
import { registerEIDemoSeedRoute } from "./routes/ei-demo-seed";
import { registerPeerBenchmarkRoutes } from "./routes/peer-benchmark";
import { registerCompetencyOntologyRoutes } from "./routes/competency-ontology";
import { registerCompetencyFrameworkIntelligenceRoutes } from "./routes/competency-intelligence";
import { registerCompetencyRuntimeRoutes } from "./routes/competency-runtime";
import { registerCompetencyEiRoutes } from "./routes/competency-ei";
import { registerCareerIntelligenceRoutes } from "./routes/career-intelligence";
import { registerCareerReadinessRoutes } from "./routes/career-readiness";
import { registerCareerCompetencyActivationRoutes } from "./routes/career-competency-activation";
import { registerCareerGapRoutes } from "./routes/career-gap";
import { registerCareerMatchRoutes } from "./routes/career-match";
import { registerCareerRoadmapRoutes } from "./routes/career-roadmap";
import { registerCareerDevelopmentRoutes } from "./routes/career-development";
import { registerCareerRecommendationRoutes } from "./routes/career-recommendation";
import { registerCareerSimulationEngineRoutes } from "./routes/career-simulation";
import { registerCareerPassportFoundationRoutes } from "./routes/career-passport-foundation";
import { registerCareerSignalRoutes } from "./routes/career-signal";
import { registerCareerPathRoutes } from "./routes/career-path";
import { registerLearningPathRoutes } from "./routes/learning-path";
import { registerCareerProgressionRoutes } from "./routes/career-progression";
import { registerCareerValidationRoutes } from "./routes/career-validation";
import { registerEmployerValidationRoutes } from "./routes/employer-validation";
import { registerCommercialValidationRoutes } from "./routes/commercial-validation";
import { registerCommercialArchitectureRoutes } from "./routes/commercial-architecture";
import { registerAdaptiveBenchmarkRoutes } from "./routes/adaptive-benchmark";
import { registerMobilityRoutes } from "./routes/mobility";
import { registerCareerStageGuidanceRoutes } from "./routes/career-stage-guidance";
import { registerCareerDiscoveryRoutes } from "./routes/career-discovery";
import { registerCareerLaunchpadRoutes } from "./routes/career-launchpad";
import { registerLaunchpadDashboardRoutes } from "./routes/launchpad-dashboard";
import { registerStudentCareerBuilderRoutes } from "./routes/student-career-builder";
import { registerLongitudinalRoutes } from "./routes/longitudinal";
import { registerWorkforceAnalyticsRoutes } from "./routes/workforce-analytics";
import { registerGovernanceWorkflowRoutes } from "./routes/governance-workflow";
import { registerEnterpriseIntelligenceRoutes } from "./routes/enterprise-intelligence";
import { registerGlobalOntologyRoutes } from "./routes/global-ontology";
import { registerScientificCompetencyRoutes } from "./routes/scientific-competency";
import { registerMarketIntelligencePhase3Routes } from "./routes/m3-market-intelligence";
import { registerCompetencyAssessmentRuntime } from "./routes/competency-assessment-runtime";
import { registerM4Routes } from "./routes/m4-ai-governance";
import { registerM5Routes } from "./routes/m5-enterprise-workforce";
import { registerAssessmentWriterRoutes } from "./routes/assessment-writer";
import { registerCompetencyRuntimeV2 } from "./routes/competency-runtime-v2";
import { registerAdaptiveAssessmentV2 } from "./routes/adaptive-assessment-v2";
import { registerContextualBenchmarkV2 } from "./routes/contextual-benchmark-v2";
import { registerWorkforceOsV2Routes } from "./routes/workforce-os-v2";
import { registerAdaptiveOrchestrationV2 } from "./routes/adaptive-orchestration-v2";
import { registerUnifiedCompetencyProfileRoutes } from "./routes/unified-competency-profile";
import { registerRoleDNARuntimeRoutes } from "./routes/role-dna-runtime";
import { registerRoleDnaExpansionRoutes } from "./routes/role-dna-expansion";
import { registerRoleDnaGovernanceRoutes } from "./routes/role-dna-governance";
import { registerCompetencySpineRoutes } from "./routes/competency-spine";
import { registerEmployerCompetencyMatchRoutes } from "./routes/employer-competency-match";
import { registerCandidateCompetencyReadinessRoutes } from "./routes/candidate-competency-readiness";
import { registerEmployerGovernanceRoutes } from "./routes/employer-governance";
import { registerCareerBuilderActivationRoutes } from "./routes/career-builder-activation";
import { registerCompetencySkillIntelligenceRoutes } from "./routes/competency-skill-intelligence";
import { registerOnetActivationRoutes } from "./routes/onet-activation";
import { registerOnetCrosswalkGovernanceRoutes } from "./routes/onet-crosswalk-governance";
import { registerCompetencyCoverageMatricesRoutes } from "./routes/competency-coverage-matrices";
import { registerCompetencyGraphRuntimeRoutes } from "./routes/competency-graph-runtime";
import { registerDynamicAssessmentRuntimeRoutes } from "./routes/dynamic-assessment-runtime";
import { registerAdaptiveRuntimeAuthorityRoutes } from "./routes/adaptive-runtime-authority";
import { registerCAFQuestionFrameworkRoutes } from "./routes/caf-question-framework";
import { registerCAFAssessmentBuilderRoutes } from "./routes/caf-assessment-builder";
import { registerCAFRuntimeRoutes } from "./routes/caf-runtime";
import { registerCAFAnalyticsRoutes } from "./routes/caf-analytics";
import { registerOntologyTaxonomyRoutes } from "./routes/ontology-taxonomy";
import { registerOntologyCareerRoutes } from "./routes/ontology-career-tracks";
import { registerOntologySupplementaryRoutes } from "./routes/ontology-supplementary";
import { registerOntologyLearningPathRoutes } from "./routes/ontology-learning-paths";
import { registerOntologyFutureSkillsRoutes } from "./routes/ontology-future-skills";
import { registerOntologyAIRulesRoutes } from "./routes/ontology-ai-rules";
import { registerOntologyImportExportRoutes } from "./routes/ontology-import-export";
import { registerPlatformApprovalRoutes } from "./routes/platform-approval";
import { registerPlatformAuditRoutes } from "./routes/platform-audit-routes";
import { registerOntologyCompetencyCoreRoutes } from "./routes/ontology-competency-core";
import { registerOntologyConcernsMappingRoutes } from "./routes/ontology-concerns-mapping";
import { registerOntologyGovernanceRoutes } from "./routes/ontology-governance";
import { registerOntologyOverviewRoutes } from "./routes/ontology-overview";
import { registerAiAssessmentV2 } from "./routes/ai-assessment-v2";
import { registerPredictiveIntelligenceV2 } from "./routes/predictive-intelligence-v2";
import { registerGovernanceV2 } from "./routes/governance-v2";
import { registerEnterpriseWorkforceOS } from "./routes/enterprise-workforce-os";
import { registerLBIEngineRoutes } from "./routes/lbi-engine";
import { registerLbiIntelligenceRoutes } from "./routes/lbi-intelligence";
import { registerBehaviouralSignalsRoutes } from "./routes/behavioural-signals";
import { registerBehaviouralIntelligenceRoutes } from "./routes/behavioural-intelligence";
import { registerPsychometricsRigorRoutes } from "./routes/psychometrics";
import { registerAdaptiveCausalRoutes } from "./routes/adaptive-causal";
import { registerWorkforceOsRoutes } from "./routes/workforce-os";
import { registerPredictiveIntelligenceRoutes } from "./routes/predictive-intelligence";
import { registerTenantsRoutes } from "./routes/tenants";
import { registerCognitiveIntelligenceRoutes } from "./routes/cognitive-intelligence";
import { registerSPEScoringRoutes } from "./routes/spe-scoring-engine";
import { registerSPEPsychometricsRoutes } from "./routes/spe-psychometrics";
import { registerSPELongitudinalRoutes } from "./routes/spe-longitudinal";
import { registerSPEGovernanceRoutes } from "./routes/spe-governance";
import { registerDigitalTwinRoutes } from "./routes/digital-twin";
import { registerPsychometricsRoutes } from "./routes/psychometrics-engine";
import { registerSemanticReasoningRoutes } from "./routes/semantic-reasoning";
import { registerMemoryArchitectureRoutes } from "./routes/memory-architecture";
import { registerEthicsGovernanceRoutes } from "./routes/ethics-governance";
import { registerFairnessEngineRoutes } from "./routes/fairness-engine";
import { registerBIOSFrontierRoutes } from "./routes/bios-frontier";
import { registerBIOSFusionRoutes } from "./routes/bios-fusion";
import { registerBIOSAgentsRoutes } from "./routes/bios-agents";
import { registerBIOSSimulationRoutes } from "./routes/bios-simulation";
import { registerROIERiskRoutes } from "./routes/roie-risk";
import { registerROIEOpportunityRoutes } from "./routes/roie-opportunity";
import { registerROIESemanticRoutes } from "./routes/roie-semantic";
import { registerROIEGovernanceRoutes } from "./routes/roie-governance";
import { registerPAIEForecastingRoutes } from "./routes/paie-forecasting";
import { registerPAIEOpportunityRoutes } from "./routes/paie-opportunity";
import { registerPAIEIntelligenceRoutes } from "./routes/paie-intelligence";
import { registerPAIEGovernanceRoutes } from "./routes/paie-governance";
import { registerLDETemporalRoutes } from "./routes/lde-temporal";
import { registerLDEEvolutionRoutes } from "./routes/lde-evolution";
import { registerLDEIntelligenceRoutes } from "./routes/lde-intelligence";
import { registerLDEGovernanceRoutes } from "./routes/lde-governance";
import { registerRIERoutes } from "./routes/rie-engine";
import { registerRIEAdminRoutes } from "./routes/rie-admin";
import { registerSecurityCenterRoutes, createAdminAuditMiddleware, readActiveSessions } from "./routes/security-center";
import { isFrameworkAdminPath } from "./lib/admin-path-gate";
import { registerGovernanceRoutes } from "./routes/governance";
import { seedRbac } from "./services/governance/rbac-seed";
import { recordGovernanceAudit, recordFailedLogin } from "./services/governance/audit-engine";
import { assertPasswordAcceptable } from "./lib/password-policy";
import { isGovernanceRbacEnabled, isCareerLaunchpadEnabled } from "./config/feature-flags";
import { logAudit as logPlatformAudit } from "./services/platform-audit";
import {
  isCareerStage as isCareerStageMx302a,
  resolveExperience as resolveExperienceMx302a,
  persistCareerStage as persistCareerStageMx302a,
} from "./services/experience-routing";
import { registerCognitiveRuntimeRoutes } from "./routes/cognitive-runtime";
import { registerIILCoreRoutes } from "./routes/iil-core";
import { registerIILEvolutionRoutes } from "./routes/iil-evolution";
import { registerIILIntelligenceRoutes } from "./routes/iil-intelligence";
import { registerIILGovernanceRoutes } from "./routes/iil-governance";
import { registerNHDACoreRoutes } from "./routes/nhda-core";
import { registerNHDAIntelligenceRoutes } from "./routes/nhda-intelligence";
import { registerNHDAGovernanceRoutes } from "./routes/nhda-governance";
import { registerMEIV2Routes } from "./routes/mei-v2";
import { registerCareerGraphRoutes } from "./routes/career-graph";
import { registerCareerPathwaysIntelligenceRoutes } from "./routes/career-pathways-intelligence";
import { registerCareerEvidenceRoutes } from "./routes/career-evidence";
import { registerTalentFoundationRoutes } from "./routes/talent-foundation";
import { registerTalentLevelProfileRoutes } from "./routes/talent-level-profiles";
import { registerTalentScoringRoutes } from "./routes/talent-scoring";
import { registerTalentSignalMasterRoutes } from "./routes/talent-signal-master";
import { registerCompetencyDNARoutes } from "./routes/talent-competency-dna";
import { registerTalentReadinessEngineRoutes } from "./routes/talent-readiness-engine";
import { registerTalentOutcomePredictionRoutes } from "./routes/talent-outcome-prediction";
import { registerValidationLoopRoutes } from "./routes/validation-loop";
import { registerOutcomeIntelligenceRoutes } from "./routes/outcome-intelligence";
import { registerEcosystemCommunityRoutes } from "./routes/ecosystem-community";
import { registerEmployerEcosystemRoutes } from "./routes/employer-ecosystem";
import { registerGlobalCompetencyRoutes } from "./routes/global-competency";
import { registerGlobalIntelligenceRoutes } from "./routes/global-intelligence";
import { registerTalentBenchmarkEngineRoutes } from "./routes/talent-benchmark-engine";
import { registerTalentDigitalTwinRoutes } from "./routes/talent-digital-twin";
import { registerTalentMeasurementScienceRoutes } from "./routes/talent-measurement-science";
import { registerTalentAnalyticsWarehouseRoutes } from "./routes/talent-analytics-warehouse";
import { registerTalentLearningCatalogRoutes } from "./routes/talent-learning-catalog";
import { registerTalentFRPEnrichmentRoutes } from "./routes/talent-frp-enrichment";
import { registerTalentConcernIntelligenceRoutes } from "./routes/talent-concern-intelligence";
import { registerTalentIntelligenceRoutes } from "./routes/talent-intelligence";
import { registerTalentFoundationV52Routes } from "./routes/talent-foundation-v52";
import { registerJobPostingEngineRoutes } from "./routes/job-posting-engine";
import { registerRoleResolutionRoutes } from "./routes/role-resolution";
import { registerEmployerProductionHealthRoutes } from "./routes/employer-production-health";
import { registerTalentDiscoveryEngineRoutes } from "./routes/talent-discovery-engine";
import { registerTalentMatchingEngineRoutes } from "./routes/talent-matching-engine";
import { registerEmployabilityMatchingEngineRoutes } from "./routes/employability-matching-engine";
import { registerHiringAssessmentEngineRoutes } from "./routes/hiring-assessment-engine";
import { registerCandidateComparisonEngineRoutes } from "./routes/candidate-comparison-engine";
import { registerShortlistingEngineRoutes } from "./routes/shortlisting-engine";
import { registerInterviewIntelligenceRoutes } from "./routes/interview-intelligence";
import { registerInterviewQuestionsRoutes } from "./routes/interview-questions";
import { registerHiringIntelligenceEngineRoutes } from "./routes/hiring-intelligence";
import { registerWorkforceIntelligenceEngineRoutes } from "./routes/workforce-intelligence";
import { registerEnterpriseWorkforceConsoleRoutes } from "./routes/enterprise-workforce-console";
import { registerEcosystemActivationRoutes } from "./routes/ecosystem-activation";
import { registerEnterpriseCertificationRoutes } from "./routes/enterprise-certification";
import { registerGoLiveCertificationRoutes } from "./routes/go-live-certification";
import { registerPlatformCompletionRoutes } from "./routes/platform-completion";
import { registerCompetencyMatchIntelligenceRoutes } from "./routes/competency-match-intelligence";
import { registerEnterpriseWorkforcePersonaRoutes } from "./routes/enterprise-workforce-persona";
import { registerEmployerDashboardsRoutes } from "./routes/employer-dashboards";
import { registerNotificationRoutes } from "./routes/notifications";
import { registerVXCapabilityArchitectureRoutes } from "./routes/vx-capability-architecture";
import { registerVXLaborMarketIntelligenceRoutes } from "./routes/vx-labor-market-intelligence";
import { registerVXEvidenceIntelligenceRoutes } from "./routes/vx-evidence-intelligence";
import { registerVXTenantConfigurationRoutes } from "./routes/vx-tenant-configuration";
import { registerVXAssessmentRuntimeExtendedRoutes } from "./routes/vx-assessment-runtime-extended";
import { registerVXCompetencyScienceCouncilRoutes } from "./routes/vx-competency-science-council";
import { registerVXWorkforceKnowledgeGraphRoutes } from "./routes/vx-workforce-knowledge-graph";
import { registerVXIRTEngineRoutes } from "./routes/vx-irt-engine";
import { registerVXReportIntelligenceRoutes } from "./routes/vx-report-intelligence";
import { registerReportIntelligenceAssembler } from "./routes/report-intelligence-assembler";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { insertUserSchema, insertChildSchema, insertLbiCategorySchema, educationBoards, academicClasses, academicSubjects, academicChapters, academicTopics, psychometricAgeBands, psychometricDomains, psychometricSubdomains, psychometricDomainAgeBandConfig, psychometricQuestionBank, insertPsychometricQuestionBankSchema, psychometricAssessmentResults, children, subscriptionPackages, studentSubscriptions, lbiModules, lbiSubModules, lbiAgeGroups, lbiQuestionBank, mfaCodes } from "../shared/schema";
import { db } from "./storage";
import { eq, and, asc, desc, sql, ilike } from "drizzle-orm";
import { z } from "zod";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { generateAITest, scoreTest, generatePersonalizedRecommendations, type LBIInsight } from "./services/aiTestGenerator";
import { METRYXONE_KNOWLEDGE_BASE } from "./knowledge-base";
import { registerShortAssessmentRoutes } from "./routes/short-assessments";
import { registerCompetencyCohortRoutes } from "./routes/competency-cohorts";
import { registerCompetencyIntelligenceRoutes } from "./routes/competency-intelligence-engine";
import { registerFeatureFlagRoutes } from "./routes/feature-flags";
import { initFeatureFlags } from "./services/feature-flags";
import { registerHypothesisEngineRoutes } from "./routes/hypothesis-engine";
import { registerConfidenceEngineRoutes } from "./routes/confidence-engine";
import { registerContradictionEngineRoutes } from "./routes/contradiction-engine";
import { registerCognitiveLoadRoutes }           from "./routes/cognitive-load";
import { registerConversationalQualityRoutes }  from "./routes/conversational-quality";
import { registerAdaptiveAssessmentRoutes }      from "./routes/adaptive-assessment";
import { registerLongitudinalMemoryRoutes }  from "./routes/longitudinal-memory";
import { registerDynamicReportRoutes }       from "./routes/dynamic-report";
import { registerInterventionEngineRoutes }  from "./routes/intervention-engine";
import { registerOmegaReportRoutes }         from "./routes/omega-report";
import { registerPragatiRoutes }             from "./routes/pragati";
import { registerCareerProfileRoutes }      from "./routes/career-profile";
import { registerCareerBenchmarkRoutes }    from "./routes/career-benchmark";
import { registerCareerWorkforceRoutes }    from "./routes/career-workforce";
import { registerCareerGenomeRoutes }       from "./routes/career-genome";
import { registerCareerSuccessRoutes }      from "./routes/career-success";
import { registerCareerTrajectoryRoutes }   from "./routes/career-trajectory";
import { registerCareerVelocityRoutes }     from "./routes/career-velocity";
import { registerCareerMemoryRoutes }       from "./routes/career-memory";
import { registerCareerSimulationRoutes }  from "./routes/career-simulations";
import { registerCareerIntelligenceHubRoutes } from "./routes/career-intelligence-hub";
import { registerEmployerPortalRoutes }        from "./routes/employer-portal";
import { registerVoiceScreeningRoutes }        from "./routes/voice-screening";
import { registerCampusPlacementRoutes }       from "./routes/campus-placement";
import { registerEmployabilityStudioRoutes }   from "./routes/employability-studio";
import { requireModuleAccess } from "./services/wc7c/require-module-access";
import { rateLimit } from "./services/security-middleware";
import { createProxyMiddleware } from "http-proxy-middleware";

declare global {
  namespace Express {
    interface User {
      id: string;
      username: string;
      fullName: string | null;
      role: string;
      roles: string[];
    }
  }
}

const startSupervisedTestSchema = z.object({
  examId: z.string().min(1, "examId is required"),
  childId: z.string().min(1, "childId is required"),
});

const scryptAsync = promisify(scrypt);
const crypto = {
  hash: async (password: string) => {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
  },
  compare: async (suppliedPassword: string, storedPassword: string) => {
    const [hashedPassword, salt] = storedPassword.split(".");
    const hashedPasswordBuf = Buffer.from(hashedPassword, "hex");
    const suppliedPasswordBuf = (await scryptAsync(
      suppliedPassword,
      salt,
      64
    )) as Buffer;
    return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
  },
};


export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const MemoryStore = createMemoryStore(session);

  // Use Postgres-backed session store so logins survive backend restarts (hot-reload, deploys).
  // Falls back to in-memory store if DATABASE_URL isn't set.
  let sessionStore: session.Store;
  if (process.env.DATABASE_URL) {
    const PgStore = connectPgSimple(session);
    const pgPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    sessionStore = new PgStore({
      pool: pgPool,
      tableName: 'express_sessions',
      createTableIfMissing: true,
    });
    console.log('[session] Using Postgres-backed session store (table: express_sessions)');
  } else {
    sessionStore = new MemoryStore({ checkPeriod: 86400000 });
    console.log('[session] WARNING: Using in-memory session store — logins will NOT survive backend restarts');
  }

  // Behind Emergent's HTTPS ingress — tell Express to trust X-Forwarded-* headers
  // so req.secure is true and secure cookies work correctly.
  app.set('trust proxy', 1);

  // Resolve the session secret. Production is fail-fast-guarded at boot (index.ts),
  // so SESSION_SECRET is always present in prod. In non-production we generate a
  // random ephemeral secret instead of shipping a hard-coded public fallback (a
  // public default would let anyone forge a session cookie). Ephemeral => dev
  // sessions reset on restart, which is acceptable for non-production.
  const SESSION_SECRET = process.env.SESSION_SECRET
    || (process.env.NODE_ENV === 'production'
      ? (() => { throw new Error('SESSION_SECRET is required in production'); })()
      : randomBytes(48).toString('hex'));

  app.use(
    session({
      name: 'mx.sid',
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store: sessionStore,
      proxy: true,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' ? true : 'auto',
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 7,
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  // ── Server-side timing for the auth/session-gated dimensions ──────────────
  // The performance benchmarks could not measure assessment-completion and
  // report-generation end-to-end (they require an authenticated session), so we
  // emit a server-side processing-time line for exactly those paths to capture
  // them in production. Purely additive: a single `res.on('finish')` log line,
  // no behaviour change. Kill-switch: PERF_TIMING_DISABLED=1.
  if (process.env.PERF_TIMING_DISABLED !== '1') {
    const TIMED = [
      /^\/api\/capadex\/session\/[^/]+\/complete$/, // assessment completion
      /^\/api\/capadex\/session\/[^/]+\/reports?$/,  // report generation (json)
      /^\/api\/capadex\/report\/[^/]+(\/pdf)?$/,     // report generation (incl. pdf)
    ];
    app.use((req, res, next) => {
      const path = req.path;
      if (TIMED.some((re) => re.test(path))) {
        const start = process.hrtime.bigint();
        res.on('finish', () => {
          const ms = Number(process.hrtime.bigint() - start) / 1e6;
          console.log(`[perf] ${req.method} ${path} ${ms.toFixed(1)}ms status=${res.statusCode}`);
        });
      }
      next();
    });
  }

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false, { message: "Incorrect username." });
        }
        const isMatch = await crypto.compare(password, user.password);
        if (!isMatch) {
          return done(null, false, { message: "Incorrect password." });
        }
        return done(null, {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          roles: user.roles || [user.role],
        });
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Shared pg.Pool used by custom routes that bypass drizzle.
  // Declared early so endpoints registered later in this function can reuse it.
  const concernsPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  // Brute-force protection for auth endpoints (per client IP + route, sliding window).
  // trust proxy=1 (set above) makes req.ip the real client IP behind the Replit proxy.
  // Requests under the limit are unchanged (just add X-RateLimit-* headers); over-limit → 429.
  const authLoginLimiter = rateLimit({ max: 10, windowMs: 60_000, pool: concernsPool });
  const authRegisterLimiter = rateLimit({ max: 5, windowMs: 60_000, pool: concernsPool });
  const authMfaVerifyLimiter = rateLimit({ max: 10, windowMs: 60_000, pool: concernsPool });
  const authMfaResendLimiter = rateLimit({ max: 5, windowMs: 60_000, pool: concernsPool });
  await initFeatureFlags(concernsPool);

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      done(null, {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        roles: user.roles || [user.role],
        account_type: (user as any).accountType ?? 'job_seeker',
      });
    } catch (err) {
      done(err);
    }
  });

  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };

  // Auth Routes
  app.post("/api/register", authRegisterLimiter, async (req, res, next) => {
    try {
      console.log("Registration request body:", req.body);
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid request data", errors: result.error.issues });
      }

      // Enforce password policy (complexity + known-breach check) on the user-chosen password.
      const pwCheck = await assertPasswordAcceptable(result.data.password, {
        identifier: result.data.username || (result.data as any).email || null,
      });
      if (!pwCheck.ok) {
        return res.status(400).json({ message: pwCheck.errors[0], errors: pwCheck.errors });
      }

      const existingUser = await storage.getUserByUsername(result.data.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // For student registration, validate age >= 18
      const { age, grade } = req.body;
      if (result.data.role === 'student') {
        if (!age || age < 18) {
          return res.status(400).json({ message: "Students must be 18 or older to register directly" });
        }
        if (!grade) {
          return res.status(400).json({ message: "Grade is required for student registration" });
        }
      }

      const hashedPassword = await crypto.hash(result.data.password);
      // SECURITY: never trust client-supplied roles on self-registration.
      // Allowlist of roles a user is permitted to self-register as. Privileged
      // roles (super_admin/admin/hr_recruiter/etc.) must be provisioned by an admin.
      const SELF_REGISTER_ROLES = new Set([
        'parent', 'student', 'mentor', 'job_seeker', 'career_seeker',
        'institute', 'school', 'college', 'ngo', 'metryx_applicant',
      ]);
      const requested = (result.data.role || 'parent').toString().toLowerCase().trim();
      const canonicalRole = SELF_REGISTER_ROLES.has(requested) ? requested : 'parent';
      const user = await storage.createUser({
        ...result.data,
        password: hashedPassword,
        role: canonicalRole,
        roles: [canonicalRole],
      } as any);

      // For adult students (18+), create a self-managed child record linked to their user account
      if (result.data.role === 'student' && age >= 18) {
        await storage.createSelfManagedStudent({
          studentUserId: user.id,
          name: result.data.fullName || user.username,
          age: age,
          grade: grade,
          lbiConsent: true, // Adults can consent for themselves
        });
      }

      // ── MX-302A — Career Launchpad: capture Career Stage + route the new user
      // to the experience matching their stage. Flag-gated: with `careerLaunchpad`
      // OFF none of this runs (no extra DB write, no ensure-schema, no
      // dashboardTarget) so registration is byte-identical-OFF. Only applies to
      // career seekers; failures are swallowed so they never break sign-up.
      let mx302aDashboardTarget: string | null = null;
      let mx302aCareerStage: string | null = null;
      if (isCareerLaunchpadEnabled() && (canonicalRole === 'career_seeker' || canonicalRole === 'job_seeker')) {
        try {
          const meta = (req.body?.metadata ?? {}) as { careerStage?: string; careerProfile?: Record<string, unknown> };
          if (isCareerStageMx302a(meta.careerStage)) {
            mx302aCareerStage = meta.careerStage;
            const careerProfile = (meta.careerProfile && typeof meta.careerProfile === 'object') ? meta.careerProfile : null;
            await persistCareerStageMx302a(concernsPool, user.id, meta.careerStage, careerProfile);
            const experience = resolveExperienceMx302a(meta.careerStage);
            mx302aDashboardTarget = `career-builder?tab=${experience.targetTab}`;
            void logPlatformAudit(concernsPool, req, {
              action: 'create',
              entityType: 'career_stage',
              entityId: user.id,
              entityLabel: meta.careerStage,
              after: { stage: meta.careerStage, experience: experience.id, targetTab: experience.targetTab },
              metadata: { source: 'registration' },
            }).catch(() => {});
          }
        } catch (e) {
          console.error('[MX-302A] register stage persist error:', e);
        }
      }

      req.login({ id: user.id, username: user.username, fullName: user.fullName, role: user.role, roles: user.roles || [user.role] }, (err) => {
        if (err) {
          return next(err);
        }
        return res.json({
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          roles: user.roles || [user.role],
          // Additive (flag-ON only): the frontend already routes on dashboardTarget.
          ...(mx302aDashboardTarget ? { dashboardTarget: mx302aDashboardTarget, careerStage: mx302aCareerStage } : {}),
        });
      });
    } catch (error) {
      next(error);
    }
  });

  // ── Account lockout (defense-in-depth) ──────────────────────────────────────
  // Enforces the documented security settings (max_login_attempts=5,
  // lockout_duration_minutes=30) that previously existed only as admin DATA.
  // Always-on and independent of the governance RBAC flag. Every DB op is
  // best-effort: a database hiccup must never lock real users out of logging in
  // (fail-open on availability — the anti-enumeration delay + governance audit
  // remain as additional layers).
  const LOGIN_MAX_ATTEMPTS = 5;
  const LOGIN_LOCKOUT_MINUTES = 30;
  let loginAttemptTableReady = false;
  const ensureLoginAttemptTable = async () => {
    if (loginAttemptTableReady) return;
    await concernsPool.query(`
      CREATE TABLE IF NOT EXISTS auth_login_attempts (
        id BIGSERIAL PRIMARY KEY,
        identifier TEXT NOT NULL,
        ip TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    await concernsPool.query(
      `CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_id_time
         ON auth_login_attempts (identifier, created_at)`);
    loginAttemptTableReady = true;
  };
  const isLockedOut = async (identifier: string): Promise<{ locked: boolean; retryAfterSec: number }> => {
    try {
      await ensureLoginAttemptTable();
      const r = await concernsPool.query(
        `SELECT COUNT(*)::int AS n, MIN(created_at) AS first_at
           FROM auth_login_attempts
          WHERE identifier = $1 AND created_at > now() - ($2 || ' minutes')::interval`,
        [identifier, String(LOGIN_LOCKOUT_MINUTES)],
      );
      const n: number = r.rows[0]?.n ?? 0;
      if (n >= LOGIN_MAX_ATTEMPTS) {
        const firstAt = r.rows[0]?.first_at ? new Date(r.rows[0].first_at).getTime() : Date.now();
        const unlockAt = firstAt + LOGIN_LOCKOUT_MINUTES * 60 * 1000;
        const retryAfterSec = Math.max(1, Math.ceil((unlockAt - Date.now()) / 1000));
        return { locked: true, retryAfterSec };
      }
      return { locked: false, retryAfterSec: 0 };
    } catch {
      return { locked: false, retryAfterSec: 0 };
    }
  };
  const recordLoginFailure = async (identifier: string, ip: string | null) => {
    try {
      await ensureLoginAttemptTable();
      await concernsPool.query(
        `INSERT INTO auth_login_attempts (identifier, ip) VALUES ($1, $2)`, [identifier, ip]);
    } catch { /* best-effort */ }
  };
  const clearLoginFailures = async (identifier: string) => {
    try {
      await ensureLoginAttemptTable();
      await concernsPool.query(`DELETE FROM auth_login_attempts WHERE identifier = $1`, [identifier]);
    } catch { /* best-effort */ }
  };

  // ── Public partner onboarding (institute / mentor / NGO / parent / LEI) ──
  // Writes to onboarding_approvals — the SAME table the Super Admin Onboarding
  // panel reads + approves from — so public submissions actually reach review.
  // Extended partner fields (org/address/registration/etc.) are preserved in a
  // metadata JSONB column so no submitted data is lost.
  let _onbMetaEnsured = false;
  const ensureOnboardingMetaColumn = async () => {
    if (_onbMetaEnsured) return;
    try {
      await concernsPool.query(
        `ALTER TABLE onboarding_approvals ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb`
      );
    } catch { /* best-effort; column may already exist */ }
    _onbMetaEnsured = true;
  };
  const ONBOARDING_ENTITY_TYPES = ['institute', 'mentor', 'ngo', 'parent', 'lei'];

  app.post("/api/onboarding/register", authRegisterLimiter, async (req, res) => {
    try {
      await ensureOnboardingMetaColumn();
      const b = req.body || {};
      const entityType = String(b.entityType || '').trim().toLowerCase();
      const entityName = String(b.entityName || b.organizationName || '').trim();
      const entityEmail = String(b.entityEmail || '').trim().toLowerCase();
      const entityPhone = String(b.entityPhone || '').trim();
      if (!ONBOARDING_ENTITY_TYPES.includes(entityType)) {
        return res.status(400).json({ error: `entityType must be one of ${ONBOARDING_ENTITY_TYPES.join(', ')}` });
      }
      if (!entityName) return res.status(400).json({ error: 'entityName is required' });
      if (!entityEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(entityEmail)) {
        return res.status(400).json({ error: 'A valid entityEmail is required' });
      }
      // Duplicate-pending guard so a partner can't flood review with the same app.
      const dup = await concernsPool.query(
        `SELECT id FROM onboarding_approvals WHERE lower(entity_email) = $1 AND status = 'pending' LIMIT 1`,
        [entityEmail]
      );
      if (dup.rows.length) {
        return res.status(409).json({ error: 'A pending application already exists for this email.' });
      }
      // Preserve every extra partner field (no dedicated column → metadata).
      const known = new Set(['entityType', 'entityName', 'entityEmail', 'entityPhone', 'trackingToken']);
      const metadata: Record<string, any> = {};
      for (const [k, v] of Object.entries(b)) {
        if (!known.has(k) && v !== undefined && v !== null && v !== '') metadata[k] = v;
      }
      // Unguessable tracking token — the ONLY way to read status back. Set after
      // the field-copy loop so a client-supplied `trackingToken` can never forge it.
      const trackingToken = randomBytes(32).toString('hex');
      metadata.trackingToken = trackingToken;
      const entityId = `onb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const ins = await concernsPool.query(
        `INSERT INTO onboarding_approvals (entity_type, entity_id, entity_name, entity_email, entity_phone, status, metadata)
         VALUES ($1,$2,$3,$4,$5,'pending',$6::jsonb)
         RETURNING id, entity_type, entity_name, entity_email, status, submitted_at`,
        [entityType, entityId, entityName, entityEmail, entityPhone || null, JSON.stringify(metadata)]
      );
      const request = ins.rows[0];
      // Best-effort notifications — never block (or fail) the submission.
      const contactName = String(b.contactPerson || entityName);
      void (async () => {
        try {
          const email = await import('./email.js');
          await email.sendOnboardingConfirmation(entityEmail, contactName, entityType, trackingToken);
          const admins = await concernsPool.query(
            `SELECT email, full_name FROM users WHERE role IN ('super_admin','superadmin','admin') AND email IS NOT NULL`
          );
          for (const a of admins.rows) {
            await email.sendOnboardingAdminAlert(a.email, a.full_name || 'Admin', entityName, entityType, entityEmail);
          }
        } catch { /* best-effort */ }
      })();
      // trackingToken is returned ONCE so the applicant can check status later.
      return res.status(201).json({ ok: true, request, trackingToken });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'Onboarding registration failed' });
    }
  });

  // Status lookup is gated by the unguessable tracking token (proof of control),
  // NOT by email alone — otherwise it is an email-enumeration / disclosure surface.
  // Every miss returns an identical 404 so existence is never revealed.
  app.get("/api/onboarding/status/:email", authRegisterLimiter, async (req, res) => {
    const notFound = () => res.status(404).json({ error: 'No application found for this email and tracking code.' });
    try {
      const email = String(req.params.email || '').trim().toLowerCase();
      const token = String(req.query.token || '');
      if (!email || !token) return notFound();
      const r = await concernsPool.query(
        `SELECT id, entity_type, entity_name, status, submitted_at, reviewed_at, rejection_reason, metadata
         FROM onboarding_approvals WHERE lower(entity_email) = $1 ORDER BY submitted_at DESC LIMIT 1`,
        [email]
      );
      if (!r.rows.length) return notFound();
      const stored = String(r.rows[0].metadata?.trackingToken || '');
      const a = Buffer.from(token);
      const b = Buffer.from(stored);
      if (!stored || a.length !== b.length || !timingSafeEqual(a, b)) return notFound();
      const { metadata, ...safe } = r.rows[0];
      return res.json({ ok: true, request: safe });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'Lookup failed' });
    }
  });

  app.post("/api/login", authLoginLimiter, async (req, res, next) => {
    const loginIp = (req.headers["x-forwarded-for"]?.toString().split(",")[0].trim()) || req.ip || null;
    const loginIdentifier = String(req.body?.username || req.body?.email || "").trim().toLowerCase();
    if (loginIdentifier) {
      const lock = await isLockedOut(loginIdentifier);
      if (lock.locked) {
        res.setHeader("Retry-After", String(lock.retryAfterSec));
        return res.status(429).json({
          message: `Too many failed login attempts. Please try again in about ${Math.ceil(lock.retryAfterSec / 60)} minute(s).`,
        });
      }
    }
    passport.authenticate("local", async (err: any, user: Express.User | false, info: any) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        if (loginIdentifier) void recordLoginFailure(loginIdentifier, loginIp);
        if (isGovernanceRbacEnabled()) {
          void recordFailedLogin(concernsPool, {
            email: req.body?.username || req.body?.email || null,
            ip: loginIp,
            reason: info?.message || "invalid_credentials",
            userAgent: req.headers["user-agent"]?.toString() || null,
          });
        }
        return res.status(401).json({ message: info?.message || "Login failed" });
      }
      
      if (loginIdentifier) void clearLoginFailures(loginIdentifier);

      const fullUser = await storage.getUser(user.id);
      const userRoles = fullUser?.roles || [fullUser?.role || ''];
      const isSuperAdmin = userRoles.includes('super_admin') || fullUser?.role === 'super_admin';
      
      if (isSuperAdmin) {
        // SECURITY (MX-301I G4): MFA is ALWAYS enforced for super-admin logins.
        // The previous dev bypass (password-only session when ZOHO_EMAIL was unset)
        // is removed so a password alone is never sufficient — important because dev
        // and prod currently share one database (G5). When no email channel is
        // configured (typically dev) the code is still issued + persisted; in
        // non-production it is also written to the server console so an operator can
        // complete login WITHOUT exposing the code over the network (it is never put
        // in the HTTP response). Set ZOHO_EMAIL/ZOHO_APP_PASSWORD to deliver by email.
        try {
          const code = String(100000 + (randomBytes(4).readUInt32BE(0) % 900000));
          const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
          const mfaEmail = user.username || 'support@metryxone.com';
          const attemptToken = randomBytes(32).toString('hex');
          await db.update(mfaCodes).set({ used: true }).where(and(eq(mfaCodes.userId, user.id), eq(mfaCodes.used, false)));
          await db.insert(mfaCodes).values({ userId: user.id, code, email: mfaEmail, attemptToken, expiresAt });
          const emailSent = await sendMfaCode(mfaEmail, code, user.username || '');
          if (!emailSent && process.env.NODE_ENV !== 'production') {
            const safeEmail = mfaEmail.replace(/[\r\n\t]/g, '');
            console.warn(`[DEV MFA] No email channel configured — super-admin MFA code for ${safeEmail}: ${code} (valid 5 min). Enter it in the login screen.`);
          }
          return res.json({ mfaRequired: true, attemptToken, mfaEmail: mfaEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3'), emailSent, role: 'super_admin', roles: userRoles });
        } catch (mfaError: any) {
          console.error('MFA generation error:', mfaError);
          return res.status(500).json({ message: 'Failed to generate MFA code' });
        }
      }
      
      req.login(user, (err) => {
        if (err) {
          return next(err);
        }
        if (isGovernanceRbacEnabled()) {
          const ip = (req.headers["x-forwarded-for"]?.toString().split(",")[0].trim()) || req.ip || null;
          void recordGovernanceAudit(concernsPool, {
            category: "login", adminUserId: (user as any).id ?? null,
            targetType: "auth", targetId: String((user as any).id ?? "user"),
            notes: `login: ${(user as any).username || (user as any).email || ""}`, ip,
          });
        }
        return res.json(user);
      });
    })(req, res, next);
  });

  // ── POST /api/admin/mfa/verify ────────────────────────────────────────────
  app.post("/api/admin/mfa/verify", authMfaVerifyLimiter, async (req, res, next) => {
    try {
      const { code, attemptToken } = req.body || {};
      if (!code || !attemptToken) {
        return res.status(400).json({ message: "code and attemptToken are required" });
      }

      const [mfaRecord] = await db.select().from(mfaCodes)
        .where(and(eq(mfaCodes.attemptToken, attemptToken), eq(mfaCodes.used, false)))
        .limit(1);

      if (!mfaRecord) {
        return res.status(400).json({ message: "Invalid or expired MFA session. Please log in again." });
      }
      if (new Date() > new Date(mfaRecord.expiresAt)) {
        return res.status(400).json({ message: "MFA code has expired. Please log in again." });
      }
      if ((mfaRecord.attempts ?? 0) >= 5) {
        return res.status(429).json({ message: "Too many incorrect MFA attempts. Please log in again." });
      }
      if (mfaRecord.code !== String(code).trim()) {
        await db.update(mfaCodes)
          .set({ attempts: (mfaRecord.attempts ?? 0) + 1 })
          .where(eq(mfaCodes.id, mfaRecord.id));
        return res.status(400).json({ message: "Incorrect code. Please check your email." });
      }

      // Mark used
      await db.update(mfaCodes).set({ used: true }).where(eq(mfaCodes.id, mfaRecord.id));

      // Log in the user — return same sanitized shape as /api/login (no password hash)
      const user = await storage.getUser(mfaRecord.userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      req.login(user, (err) => {
        if (err) return next(err);
        if (isGovernanceRbacEnabled()) {
          const ip = (req.headers["x-forwarded-for"]?.toString().split(",")[0].trim()) || req.ip || null;
          void recordGovernanceAudit(concernsPool, {
            category: "login", adminUserId: (user as any).id ?? null,
            targetType: "auth", targetId: String((user as any).id ?? "user"),
            notes: `super_admin MFA login: ${(user as any).username || (user as any).email || ""}`, ip,
          });
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _pwd, ...safeUser } = user as any;
        return res.json(safeUser);
      });
    } catch (err) { next(err); }
  });

  // ── POST /api/admin/mfa/resend ─────────────────────────────────────────────
  app.post("/api/admin/mfa/resend", authMfaResendLimiter, async (req, res, next) => {
    try {
      const { attemptToken } = req.body || {};
      if (!attemptToken) {
        return res.status(400).json({ message: "attemptToken is required" });
      }

      const [mfaRecord] = await db.select().from(mfaCodes)
        .where(and(eq(mfaCodes.attemptToken, attemptToken), eq(mfaCodes.used, false)))
        .limit(1);

      if (!mfaRecord) {
        return res.status(400).json({ message: "Invalid MFA session. Please log in again." });
      }

      const user = await storage.getUser(mfaRecord.userId);
      if (!user || user.role !== 'super_admin') {
        return res.status(403).json({ message: "Not authorized" });
      }

      const newCode = String(100000 + (randomBytes(4).readUInt32BE(0) % 900000));
      const newExpiry = new Date(Date.now() + 5 * 60 * 1000);
      const newAttemptToken = randomBytes(32).toString('hex');

      await db.update(mfaCodes).set({ used: true })
        .where(and(eq(mfaCodes.userId, mfaRecord.userId), eq(mfaCodes.used, false)));
      await db.insert(mfaCodes).values({
        userId: mfaRecord.userId,
        code: newCode,
        email: mfaRecord.email,
        attemptToken: newAttemptToken,
        expiresAt: newExpiry,
      });

      const mfaEmail = user.username || 'support@metryxone.com';
      const emailSent = await sendMfaCode(mfaEmail, newCode, user.username || '');

      return res.json({
        mfaRequired: true,
        attemptToken: newAttemptToken,
        mfaEmail: mfaEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
        emailSent,
      });
    } catch (err) { next(err); }
  });

  app.post("/api/logout", (req, res) => {
    const u = req.user as any;
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      if (isGovernanceRbacEnabled() && u) {
        const ip = (req.headers["x-forwarded-for"]?.toString().split(",")[0].trim()) || req.ip || null;
        void recordGovernanceAudit(concernsPool, {
          category: "logout", adminUserId: u.id ?? null,
          targetType: "auth", targetId: String(u.id ?? "user"),
          notes: `logout: ${u.username || u.email || ""}`, ip,
        });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.post("/api/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      // In a real implementation, this would send an email with a reset link
      // For now, we simulate the behavior
      console.log(`Password reset requested for: ${email}`);
      res.json({ message: "If an account exists with this email, a password reset link has been sent" });
    } catch (error) {
      res.status(500).json({ message: "Failed to process password reset request" });
    }
  });

  // ── Password-reset OTP flow (used by ForgotPassword.tsx) ──────────────
  // The live `users` table has no email/mobile column — `username` holds an
  // email-like value, so we look up by username and send the OTP to it.
  const RESET_OTP_TTL_MIN = 10;
  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const maskEmail = (e: string): string => {
    const [local, domain] = e.split("@");
    if (!domain) return e;
    const head = local.slice(0, 2);
    return `${head}${"*".repeat(Math.max(local.length - 2, 1))}@${domain}`;
  };
  const ensureResetOtpTable = async () => {
    await concernsPool.query(`
      CREATE TABLE IF NOT EXISTS auth_password_reset_otps (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        identifier text NOT NULL,
        code       text NOT NULL,
        expires_at timestamptz NOT NULL,
        used       boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS auth_password_reset_otps_idx ON auth_password_reset_otps(LOWER(identifier));
    `);
  };

  app.post("/api/auth/forgot-password", async (req, res, next) => {
    try {
      const identifier = String(req.body?.identifier || "").trim();
      if (!identifier) return res.status(400).json({ message: "Email or mobile number is required." });
      const norm = identifier.toLowerCase();

      const userRow = await concernsPool.query(
        `SELECT id, username, full_name FROM users WHERE LOWER(username)=$1 LIMIT 1`,
        [norm]
      );
      // No account, or the account's username isn't an email we can send to:
      // respond 200 without an email so the UI shows "no account found"
      // without leaking which step failed.
      if (userRow.rows.length === 0 || !emailRx.test(userRow.rows[0].username)) {
        return res.json({ email: null });
      }
      const user = userRow.rows[0];
      const sendTo = String(user.username).toLowerCase();

      await ensureResetOtpTable();
      await concernsPool.query(
        `UPDATE auth_password_reset_otps SET used=true WHERE LOWER(identifier)=$1 AND used=false`,
        [sendTo]
      );
      const code = String(100000 + (randomBytes(4).readUInt32BE(0) % 900000));
      await concernsPool.query(
        `INSERT INTO auth_password_reset_otps (identifier, code, expires_at)
         VALUES ($1,$2, now() + interval '${RESET_OTP_TTL_MIN} minutes')`,
        [sendTo, code]
      );
      sendLoginOtp(sendTo, user.full_name || "", code, RESET_OTP_TTL_MIN).catch(console.error);

      res.json({ email: sendTo, maskedEmail: maskEmail(sendTo) });
    } catch (err) { next(err); }
  });

  // Validate the OTP without consuming it — reset-password does the final consume.
  app.post("/api/auth/otp/check", async (req, res, next) => {
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      const otp = String(req.body?.otp || "").trim();
      if (!email || !otp) return res.status(400).json({ message: "Email and OTP are required." });
      await ensureResetOtpTable();
      const row = await concernsPool.query(
        `SELECT id FROM auth_password_reset_otps
         WHERE LOWER(identifier)=$1 AND code=$2 AND used=false AND expires_at > now()
         ORDER BY created_at DESC LIMIT 1`,
        [email, otp]
      );
      if (row.rows.length === 0) {
        return res.status(400).json({ message: "Incorrect or expired OTP. Please try again." });
      }
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  app.post("/api/auth/reset-password", async (req, res, next) => {
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      const otp = String(req.body?.otp || "").trim();
      const newPassword = String(req.body?.newPassword || "");
      if (!email || !otp) return res.status(400).json({ error: "OTP_INVALID", message: "Email and OTP are required." });
      // Enforce the same password policy as registration (complexity + known-breach check).
      const pwReset = await assertPasswordAcceptable(newPassword, { identifier: email });
      if (!pwReset.ok) {
        return res.status(400).json({ error: "PASSWORD_WEAK", message: pwReset.errors[0], errors: pwReset.errors });
      }

      await ensureResetOtpTable();
      // Atomic consume: the `used=false` guard inside the UPDATE prevents a
      // replay race — only one concurrent request can flip the row and proceed.
      const consume = await concernsPool.query(
        `UPDATE auth_password_reset_otps SET used=true
         WHERE id = (
           SELECT id FROM auth_password_reset_otps
           WHERE LOWER(identifier)=$1 AND code=$2 AND used=false AND expires_at > now()
           ORDER BY created_at DESC LIMIT 1
         )
         RETURNING id`,
        [email, otp]
      );
      if (consume.rows.length === 0) {
        return res.status(400).json({ error: "OTP_INVALID", message: "OTP expired or incorrect." });
      }

      const hashed = await crypto.hash(newPassword);
      const upd = await concernsPool.query(
        `UPDATE users SET password=$1 WHERE LOWER(username)=$2 RETURNING id`,
        [hashed, email]
      );
      if (upd.rows.length === 0) {
        return res.status(404).json({ message: "Account not found." });
      }
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  app.get("/api/user", (req: any, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    res.json(req.user);
  });

  app.get("/api/user/theme", (req: any, res) => {
    if (!req.user) return res.json({ theme: "light" });
    res.json({ theme: "light" });
  });

  // Switch active role
  app.post("/api/user/switch-role", requireAuth, async (req, res, next) => {
    try {
      const { role } = req.body;
      
      // Validate role is a string
      if (!role || typeof role !== 'string') {
        return res.status(400).json({ message: "Role is required" });
      }
      
      // Fetch fresh user data from database to get current roles
      const freshUser = await storage.getUser(req.user!.id);
      if (!freshUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Validate the role is in user's available roles
      const userRoles = freshUser.roles || [freshUser.role];
      if (!userRoles.includes(role)) {
        return res.status(400).json({ message: "You don't have access to this role" });
      }
      
      // Update the active role
      const updatedUser = await storage.updateUserRole(freshUser.id, role);
      
      // Update the session with new role and roles
      const sessionUser = {
        id: updatedUser.id,
        username: updatedUser.username,
        fullName: updatedUser.fullName,
        role: updatedUser.role,
        roles: updatedUser.roles || [updatedUser.role]
      };
      
      req.login(sessionUser, (err) => {
        if (err) {
          return next(err);
        }
        res.json(sessionUser);
      });
    } catch (error) {
      next(error);
    }
  });

  // Add role to user (admin-only for security)
  app.post("/api/user/add-role", requireAuth, async (req, res, next) => {
    try {
      const { role, targetUserId } = req.body;
      const currentUser = req.user!;
      
      // Only admins can add roles to users
      if (currentUser.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can add roles to users" });
      }
      
      // Validate role
      const validRoles = ['parent', 'student', 'institute', 'teacher', 'ngo', 'admin'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      
      // Use targetUserId if provided (admin adding role to another user), otherwise self
      const userId = targetUserId || currentUser.id;
      
      const updatedUser = await storage.addUserRole(userId, role);
      import('./lib/audit').then(({ writeAuditEvent, AUDIT_EVENT }) => {
        writeAuditEvent(concernsPool, {
          event_type: AUDIT_EVENT.USER_ROLE_CHANGED,
          actor:      currentUser.username || String(currentUser.id),
          payload:    { target_user_id: userId, role_added: role },
        });
      }).catch(() => {});
      res.json(updatedUser);
    } catch (error) {
      next(error);
    }
  });

  // Children Routes
  app.get("/api/children", requireAuth, async (req, res, next) => {
    try {
      const children = await storage.getChildren(req.user!.id);
      res.json(children);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/children/:id", requireAuth, async (req, res, next) => {
    try {
      const child = await storage.getChild(req.params.id, req.user!.id);
      if (!child) {
        return res.status(404).json({ message: "Child not found" });
      }
      res.json(child);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/children", requireAuth, async (req, res, next) => {
    try {
      const result = insertChildSchema.safeParse({
        ...req.body,
        parentId: req.user!.id,
      });
      
      if (!result.success) {
        return res.status(400).json({ message: "Invalid request data", errors: result.error.issues });
      }

      const child = await storage.createChild(result.data);
      
      // Auto-create student login for the child
      const childName = result.data.name;
      const nameParts = childName.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
      let baseUsername = nameParts.join('_');
      if (baseUsername.length < 4) baseUsername = baseUsername + '_student';
      
      // Generate unique username
      let username = baseUsername;
      let counter = 1;
      while (await storage.getUserByUsername(username)) {
        username = `${baseUsername}_${counter}`;
        counter++;
      }
      
      // Generate a simple password (first name + last 4 chars of child ID)
      const firstName = nameParts[0] || 'student';
      const password = `${firstName.charAt(0).toUpperCase()}${firstName.slice(1)}@${child.id.slice(-4)}`;
      const hashedPassword = await crypto.hash(password);
      
      // Create student user account
      const studentUser = await storage.createUser({
        username,
        password: hashedPassword,
        fullName: childName,
        role: 'student',
      });
      
      // Link student user to child record
      await storage.updateChild(child.id, req.user!.id, { studentUserId: studentUser.id });

      res.status(201).json({
        ...child,
        studentCredentials: {
          username,
          password,
          message: 'Student login created automatically'
        }
      });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/children/:id", requireAuth, async (req, res, next) => {
    try {
      const { id } = req.params;
      const updated = await storage.updateChild(id, req.user!.id, req.body);
      
      if (!updated) {
        return res.status(404).json({ message: "Child not found" });
      }

      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/children/:id", requireAuth, async (req, res, next) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteChild(id, req.user!.id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Child not found" });
      }

      res.json({ message: "Child removed successfully" });
    } catch (error) {
      next(error);
    }
  });

  // Consent Management
  app.post("/api/children/:id/consent", requireAuth, async (req, res, next) => {
    try {
      const { id } = req.params;
      const { action } = req.body;
      
      if (!['grant', 'revoke'].includes(action)) {
        return res.status(400).json({ message: "Action must be 'grant' or 'revoke'" });
      }

      const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
      const updated = await storage.updateConsent(id, req.user!.id, action === 'grant', ipAddress);
      
      if (!updated) {
        return res.status(404).json({ message: "Child not found" });
      }

      res.json({
        message: `Consent ${action === 'grant' ? 'granted' : 'revoked'} successfully`,
        child: updated,
      });
    } catch (error) {
      next(error);
    }
  });

  // Behavioural Insights Routes
  app.get("/api/children/:id/insights", requireAuth, async (req, res, next) => {
    try {
      const { id } = req.params;
      const child = await storage.getChild(id, req.user!.id);
      
      if (!child) {
        return res.status(404).json({ message: "Child not found" });
      }

      if (!child.lbiConsent && child.age < 18) {
        return res.status(403).json({ message: "LBI consent required for minors" });
      }

      const insights = await storage.getInsightsByChild(id);
      res.json(insights);
    } catch (error) {
      next(error);
    }
  });

  // Dashboard Data (combined endpoint) - matches BRD API spec
  app.get("/api/dashboard", requireAuth, async (req, res, next) => {
    try {
      const childrenList = await storage.getChildren(req.user!.id);
      
      if (childrenList.length === 0) {
        return res.json({
          children: [],
          selectedChild: null,
          stats: null,
          exams: [],
          insights: [],
        });
      }

      const childId = (req.query.childId as string) || childrenList[0].id;
      const selectedChild = childrenList.find(c => c.id === childId) || childrenList[0];
      
      // Get exam stats and exam list (academic exams only for Education tab)
      const stats = await storage.getExamStats(selectedChild.id, true);
      const exams = await storage.getAcademicExamsByChild(selectedChild.id);
      
      // Get behavioral insights (only if consent granted or 18+)
      let insights: any[] = [];
      if (selectedChild.lbiConsent || selectedChild.age >= 18) {
        // Get traditional behavioral insights
        insights = await storage.getInsightsByChild(selectedChild.id);
        
        // Get all LBI assessment sessions with trend data
        const sessions = await storage.getStudentAssessmentSessions(selectedChild.id);
        const completedSessions = sessions.filter(s => s.status === 'Completed');
        const modules = await storage.getModules();
        
        // Group all sessions by module for historical tracking
        const sessionsByModule = new Map<string, typeof completedSessions>();
        for (const session of completedSessions) {
          const existing = sessionsByModule.get(session.moduleId) || [];
          existing.push(session);
          sessionsByModule.set(session.moduleId, existing);
        }
        
        for (const [moduleId, moduleSessions] of Array.from(sessionsByModule.entries())) {
          const module = modules.find(m => m.id === moduleId);
          if (!module) continue;
          
          // Sort by completion date (newest first)
          const sortedSessions = moduleSessions.sort((a, b) => 
            new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime()
          );
          
          const latestSession = sortedSessions[0];
          const previousSession = sortedSessions[1];
          const bestSession = sortedSessions.reduce((best, curr) => 
            (curr.percentileScore || 0) > (best.percentileScore || 0) ? curr : best
          );
          
          if (latestSession && latestSession.percentileScore !== null) {
            // Calculate trend (improvement/decline)
            let trend: 'up' | 'down' | 'stable' | null = null;
            let trendValue: number | null = null;
            if (previousSession && previousSession.percentileScore !== null) {
              const diff = latestSession.percentileScore - previousSession.percentileScore;
              trendValue = Math.round(diff * 10) / 10;
              trend = diff > 2 ? 'up' : diff < -2 ? 'down' : 'stable';
            }
            
            // Build historical data for charting
            const history = sortedSessions
              .slice(0, 5) // Last 5 attempts
              .reverse() // Oldest first for chart
              .map((s, idx) => ({
                attempt: idx + 1,
                score: s.percentileScore || 0,
                date: s.completedAt
              }));
            
            // Calculate 6-month lockout status
            const completedDate = new Date(latestSession.completedAt || 0);
            const unlockDate = new Date(completedDate);
            unlockDate.setMonth(unlockDate.getMonth() + 6);
            const isLocked = unlockDate > new Date();
            
            insights.push({
              id: `lbi-${latestSession.id}`,
              childId: selectedChild.id,
              category: module.moduleName,
              title: `${module.moduleName} Assessment`,
              value: latestSession.percentileScore,
              description: latestSession.percentileScore >= 80 ? 'Excellent performance' :
                          latestSession.percentileScore >= 60 ? 'Good performance' :
                          latestSession.percentileScore >= 40 ? 'Average performance' : 'Needs improvement',
              source: 'LBI',
              completedAt: latestSession.completedAt,
              rawScore: latestSession.rawScore,
              questionsAnswered: latestSession.questionsAnswered,
              totalQuestions: latestSession.totalQuestions,
              // Enhanced analytics fields
              trend,
              trendValue,
              attemptCount: moduleSessions.length,
              bestScore: bestSession.percentileScore,
              history,
              // 6-month lockout info
              isLocked,
              lockedUntil: isLocked ? unlockDate.toISOString() : null
            });
          }
        }
      }

      res.json({
        children: childrenList,
        selectedChild,
        stats,
        exams,
        insights,
      });
    } catch (error) {
      next(error);
    }
  });

  // LBI Category Routes
  app.get("/api/lbi-categories", requireAuth, async (req, res, next) => {
    try {
      const categories = await storage.getLbiCategories(req.user!.id);
      res.json(categories);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/lbi-categories", requireAuth, async (req, res, next) => {
    try {
      const result = insertLbiCategorySchema.safeParse({
        ...req.body,
        userId: req.user!.id,
      });
      
      if (!result.success) {
        return res.status(400).json({ message: "Invalid request data", errors: result.error.issues });
      }

      const category = await storage.createLbiCategory(result.data);
      res.status(201).json(category);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/lbi-categories/:id", requireAuth, async (req, res, next) => {
    try {
      const { id } = req.params;
      const updated = await storage.updateLbiCategory(id, req.user!.id, req.body);
      
      if (!updated) {
        return res.status(404).json({ message: "Category not found" });
      }

      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/lbi-categories/:id", requireAuth, async (req, res, next) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteLbiCategory(id, req.user!.id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Category not found" });
      }

      res.json({ message: "Category deleted successfully" });
    } catch (error) {
      next(error);
    }
  });

  // Supervised Test Session - Start (BRD: POST /api/method/.../start_supervised_test)
  app.post("/api/supervised-test/start", requireAuth, async (req, res, next) => {
    try {
      const parsed = startSupervisedTestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: parsed.error.flatten().fieldErrors 
        });
      }
      
      const { examId, childId } = parsed.data;

      // Verify child belongs to parent
      const child = await storage.getChild(childId, req.user!.id);
      if (!child) {
        return res.status(404).json({ message: "Child not found or does not belong to you" });
      }

      // Verify child is a minor
      if (child.age >= 18) {
        return res.status(400).json({ 
          message: "Supervised test mode is only available for minors (age < 18)" 
        });
      }

      // Verify exam exists and belongs to the child
      const exam = await storage.getExam(examId);
      if (!exam) {
        return res.status(404).json({ message: "Exam not found" });
      }
      if (exam.childId !== childId) {
        return res.status(403).json({ message: "Exam does not belong to this child" });
      }

      // Verify exam is pending
      if (exam.status !== 'pending') {
        return res.status(400).json({ 
          message: "Supervised test mode is only available for pending exams" 
        });
      }

      // Check if there's already an active session for this exam
      const existingSession = await storage.getActiveSupervisedSession(examId);
      if (existingSession) {
        return res.status(409).json({ 
          message: "A supervised test session is already active for this exam",
          session: existingSession
        });
      }

      // Create new supervised session
      const session = await storage.createSupervisedSession({
        examId,
        parentId: req.user!.id,
        childId,
        status: 'active',
      });

      res.json({
        message: "Supervised test session started",
        session,
      });
    } catch (error) {
      next(error);
    }
  });

  // Supervised Test Session - End
  app.post("/api/supervised-test/:sessionId/end", requireAuth, async (req, res, next) => {
    try {
      const { sessionId } = req.params;
      
      const ended = await storage.endSupervisedSession(sessionId, req.user!.id);
      if (!ended) {
        return res.status(404).json({ message: "Session not found" });
      }

      res.json({
        message: "Supervised test session ended",
        session: ended,
      });
    } catch (error) {
      next(error);
    }
  });

  // Parent - Get exam questions for supervised monitoring
  app.get("/api/parent/exams/:examId/questions", requireAuth, async (req, res, next) => {
    try {
      if (req.user!.role !== 'parent') {
        return res.status(403).json({ message: "Parent access required" });
      }
      
      const { examId } = req.params;
      
      // Verify exam exists and belongs to one of parent's children
      const exam = await storage.getExam(examId);
      if (!exam) {
        return res.status(404).json({ message: "Exam not found" });
      }
      
      const children = await storage.getChildren(req.user!.id);
      const childIds = children.map(c => c.id);
      if (!childIds.includes(exam.childId)) {
        return res.status(403).json({ message: "Exam does not belong to your child" });
      }
      
      // Get questions from child exam questions table
      const questions = await storage.getChildExamQuestions(examId);
      
      res.json({
        exam,
        questions: questions.map((q, idx) => ({
          id: q.id,
          orderIndex: idx + 1,
          questionText: q.questionText,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          correctOption: q.correctOption,
          marks: q.marks
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  // Parent - Submit supervised exam answers
  app.post("/api/parent/exams/:examId/submit", requireAuth, async (req, res, next) => {
    try {
      if (req.user!.role !== 'parent') {
        return res.status(403).json({ message: "Parent access required" });
      }
      
      const { examId } = req.params;
      const { childId, responses } = req.body;
      
      if (!childId || !Array.isArray(responses)) {
        return res.status(400).json({ message: "childId and responses array required" });
      }
      
      // Verify child belongs to parent
      const child = await storage.getChild(childId, req.user!.id);
      if (!child) {
        return res.status(403).json({ message: "Child not found or not authorized" });
      }
      
      // Verify exam exists and belongs to the child
      const exam = await storage.getExam(examId);
      if (!exam) {
        return res.status(404).json({ message: "Exam not found" });
      }
      if (exam.childId !== childId) {
        return res.status(403).json({ message: "Exam does not belong to this child" });
      }
      
      // Get questions from child exam to calculate score
      const questions = await storage.getChildExamQuestions(examId);
      
      let score = 0;
      let totalMarks = 0;
      
      for (const q of questions) {
        const marks = q.marks || 1;
        totalMarks += marks;
        const response = responses.find((r: any) => r.questionId === q.id);
        if (response && response.selectedOption === q.correctOption) {
          score += marks;
        }
      }
      
      const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
      
      // Update child exam status to completed
      await storage.updateChildExam(examId, {
        status: 'completed',
        score,
        completedAt: new Date()
      });
      
      // End the supervised session if active
      const activeSession = await storage.getActiveSupervisedSession(examId);
      if (activeSession) {
        await storage.endSupervisedSession(activeSession.id, req.user!.id);
      }
      
      res.json({
        success: true,
        score,
        totalMarks,
        percentage
      });
    } catch (error) {
      next(error);
    }
  });

  // Assessment Templates - For parents to browse and assign
  app.get("/api/assessment-templates", requireAuth, async (req, res, next) => {
    try {
      const grade = req.query.grade as string | undefined;
      const templates = await storage.getAssessmentTemplates(grade);
      res.json(templates);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/assessment-templates/:id", requireAuth, async (req, res, next) => {
    try {
      const template = await storage.getAssessmentTemplateById(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      const questions = await storage.getAssessmentTemplateQuestions(req.params.id);
      res.json({ ...template, questionCount: questions.length });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/assessment-templates/:id/assign", requireAuth, async (req, res, next) => {
    try {
      if (req.user!.role !== 'parent') {
        return res.status(403).json({ message: "Parent access required" });
      }
      
      const { childId, dueDate } = req.body;
      if (!childId) {
        return res.status(400).json({ message: "childId is required" });
      }

      // Verify parent owns this child
      const children = await storage.getChildren(req.user!.id);
      const child = children.find(c => c.id === childId);
      if (!child) {
        return res.status(403).json({ message: "Child not found or not authorized" });
      }

      const exam = await storage.assignAssessmentToChild(
        req.params.id, 
        childId, 
        dueDate ? new Date(dueDate) : undefined
      );
      
      res.json({ message: "Assessment assigned successfully", exam });
    } catch (error) {
      next(error);
    }
  });

  // Seed assessment templates on startup
  app.post("/api/assessment-templates/seed", async (req, res, next) => {
    try {
      await storage.seedAssessmentTemplates();
      res.json({ message: "Assessment templates seeded" });
    } catch (error) {
      next(error);
    }
  });

  // Seed demo users for testing — super_admin only (WC-C8A: route was unauthenticated)
  app.post("/api/seed-demo-users", requireAuth, async (req, res, next) => {
    try {
      // Inline super_admin guard (requireSuperAdmin defined later in this function)
      const callerRoles: string[] = (req.user as any)?.roles || [];
      const callerRole: string = (req.user as any)?.role || '';
      if (!callerRoles.includes('super_admin') && callerRole !== 'super_admin') {
        return res.status(403).json({ message: 'Super admin access required' });
      }

      // super_admin intentionally excluded — seed never mints privileged credentials
      const demoUsers = [
        { username: 'demo_institute', password: 'Demo@123', fullName: 'Demo Institute Admin', role: 'institute' as const },
        { username: 'demo_parent', password: 'Demo@123', fullName: 'Demo Parent', role: 'parent' as const },
        { username: 'demo_student', password: 'Demo@123', fullName: 'Demo Student', role: 'student' as const },
      ];

      const createdUsers = [];
      for (const user of demoUsers) {
        const existing = await storage.getUserByUsername(user.username);
        if (!existing) {
          const salt = randomBytes(16).toString('hex');
          const buf = (await new Promise<Buffer>((resolve, reject) =>
            scrypt(user.password, salt, 64, (err, key) => err ? reject(err) : resolve(key as Buffer))
          ));
          const hashedPassword = `${buf.toString('hex')}.${salt}`;
          const newUser = await storage.createUser({
            username: user.username,
            password: hashedPassword,
            fullName: user.fullName,
            role: user.role,
          });
          createdUsers.push({ username: newUser.username, role: newUser.role });
        } else {
          createdUsers.push({ username: existing.username, role: existing.role, status: 'already exists' });
        }
      }

      res.json({
        message: "Demo users seeded successfully",
        users: createdUsers,
      });
    } catch (error) {
      next(error);
    }
  });

  // Institute Dashboard Routes
  app.get("/api/institute/dashboard", requireAuth, async (req, res, next) => {
    try {
      if (req.user!.role !== 'institute') {
        return res.status(403).json({ message: "Institute access required" });
      }

      const institute = await storage.getInstituteByUserId(req.user!.id);
      if (!institute) {
        return res.json({ 
          institute: null,
          stats: { totalStudents: 0, totalExams: 0, pendingEnrollments: 0, activeExams: 0 },
          enrollments: [],
          exams: [],
          batches: []
        });
      }

      const [stats, enrollments, examsList, batchesList] = await Promise.all([
        storage.getInstituteDashboardStats(institute.id),
        storage.getEnrollmentRequests(institute.id),
        storage.getExamsByInstitute(institute.id),
        storage.getBatchesByInstitute(institute.id)
      ]);

      res.json({
        institute,
        stats,
        enrollments,
        exams: examsList,
        batches: batchesList
      });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/institute/enrollments/:id", requireAuth, async (req, res, next) => {
    try {
      if (req.user!.role !== 'institute') {
        return res.status(403).json({ message: "Institute access required" });
      }

      const institute = await storage.getInstituteByUserId(req.user!.id);
      if (!institute) {
        return res.status(404).json({ message: "Institute not found" });
      }

      const { status } = req.body;
      if (!['Approved', 'Rejected'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const updated = await storage.updateEnrollmentStatus(req.params.id, institute.id, status);
      if (!updated) {
        return res.status(404).json({ message: "Enrollment request not found" });
      }

      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/institute/exams/:id/status", requireAuth, async (req, res, next) => {
    try {
      if (req.user!.role !== 'institute') {
        return res.status(403).json({ message: "Institute access required" });
      }

      const institute = await storage.getInstituteByUserId(req.user!.id);
      if (!institute) {
        return res.status(404).json({ message: "Institute not found" });
      }

      const { status } = req.body;
      const updated = await storage.updateExamStatus(req.params.id, institute.id, status);
      if (!updated) {
        return res.status(404).json({ message: "Exam not found" });
      }

      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  // Batch management routes
  app.post("/api/institute/batches", requireAuth, async (req, res, next) => {
    try {
      if (req.user!.role !== 'institute') {
        return res.status(403).json({ message: "Institute access required" });
      }

      const institute = await storage.getInstituteByUserId(req.user!.id);
      if (!institute) {
        return res.status(404).json({ message: "Institute not found" });
      }

      const { batchCode, batchName, academicYear, status } = req.body;
      if (!batchCode || !batchName || !academicYear) {
        return res.status(400).json({ message: "Batch code, name, and academic year are required" });
      }

      const batch = await storage.createBatch({
        instituteId: institute.id,
        batchCode,
        batchName,
        academicYear,
        status: status || 'Active'
      });

      res.status(201).json(batch);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/institute/batches/bulk", requireAuth, async (req, res, next) => {
    try {
      if (req.user!.role !== 'institute') {
        return res.status(403).json({ message: "Institute access required" });
      }

      const institute = await storage.getInstituteByUserId(req.user!.id);
      if (!institute) {
        return res.status(404).json({ message: "Institute not found" });
      }

      const { batches: batchList } = req.body;
      if (!Array.isArray(batchList) || batchList.length === 0) {
        return res.status(400).json({ message: "Batches array is required" });
      }

      const validBatches = batchList.filter(b => b.batchCode && b.batchName && b.academicYear);
      if (validBatches.length === 0) {
        return res.status(400).json({ message: "No valid batches found. Each batch requires batchCode, batchName, and academicYear" });
      }

      const batchesToCreate = validBatches.map(b => ({
        instituteId: institute.id,
        batchCode: b.batchCode,
        batchName: b.batchName,
        academicYear: b.academicYear,
        status: b.status || 'Active'
      }));

      const created = await storage.createBatches(batchesToCreate);
      res.status(201).json({ 
        message: `Successfully created ${created.length} batches`,
        batches: created,
        skipped: batchList.length - validBatches.length
      });
    } catch (error) {
      next(error);
    }
  });

  // Institute profile update
  app.patch("/api/institute/profile", requireAuth, async (req, res, next) => {
    try {
      if (req.user!.role !== 'institute') {
        return res.status(403).json({ message: "Institute access required" });
      }

      const institute = await storage.getInstituteByUserId(req.user!.id);
      if (!institute) {
        return res.status(404).json({ message: "Institute not found" });
      }

      const { displayName, legalName } = req.body;
      const updated = await storage.updateInstitute(institute.id, { displayName, legalName });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  // Student management routes
  app.post("/api/institute/students", requireAuth, async (req, res, next) => {
    try {
      if (req.user!.role !== 'institute') {
        return res.status(403).json({ message: "Institute access required" });
      }

      const institute = await storage.getInstituteByUserId(req.user!.id);
      if (!institute) {
        return res.status(404).json({ message: "Institute not found" });
      }

      const { studentCode, fullName, dob, status } = req.body;
      if (!studentCode || !fullName) {
        return res.status(400).json({ message: "Student code and full name are required" });
      }

      const student = await storage.createStudent({
        instituteId: institute.id,
        studentCode,
        fullName,
        dob: dob || null,
        status: status || 'Active'
      });

      res.status(201).json(student);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/institute/students/bulk", requireAuth, async (req, res, next) => {
    try {
      if (req.user!.role !== 'institute') {
        return res.status(403).json({ message: "Institute access required" });
      }

      const institute = await storage.getInstituteByUserId(req.user!.id);
      if (!institute) {
        return res.status(404).json({ message: "Institute not found" });
      }

      const { students: studentList } = req.body;
      if (!Array.isArray(studentList) || studentList.length === 0) {
        return res.status(400).json({ message: "Students array is required" });
      }

      const validStudents = studentList.filter(s => s.studentCode && s.fullName);
      if (validStudents.length === 0) {
        return res.status(400).json({ message: "No valid students found. Each student requires studentCode and fullName" });
      }

      const studentsToCreate = validStudents.map(s => ({
        instituteId: institute.id,
        studentCode: s.studentCode,
        fullName: s.fullName,
        dob: s.dob || null,
        status: s.status || 'Active'
      }));

      const created = await storage.createStudents(studentsToCreate);
      res.status(201).json({ 
        message: `Successfully created ${created.length} students`,
        students: created,
        skipped: studentList.length - validStudents.length
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/institute/students", requireAuth, async (req, res, next) => {
    try {
      if (req.user!.role !== 'institute') {
        return res.status(403).json({ message: "Institute access required" });
      }

      const institute = await storage.getInstituteByUserId(req.user!.id);
      if (!institute) {
        return res.status(404).json({ message: "Institute not found" });
      }

      const studentsList = await storage.getStudentsByInstitute(institute.id);
      res.json(studentsList);
    } catch (error) {
      next(error);
    }
  });

  // Exam creation route
  app.post("/api/institute/exams", requireAuth, async (req, res, next) => {
    try {
      if (req.user!.role !== 'institute') {
        return res.status(403).json({ message: "Institute access required" });
      }

      const institute = await storage.getInstituteByUserId(req.user!.id);
      if (!institute) {
        return res.status(404).json({ message: "Institute not found" });
      }

      const { examCode, examName, batchId, startAt, endAt, status } = req.body;
      if (!examCode || !examName) {
        return res.status(400).json({ message: "Exam code and name are required" });
      }

      const exam = await storage.createExam({
        instituteId: institute.id,
        examCode,
        examName,
        batchId: batchId || null,
        startAt: startAt ? new Date(startAt) : new Date(),
        endAt: endAt ? new Date(endAt) : new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: status || 'Draft'
      });

      res.status(201).json(exam);
    } catch (error) {
      next(error);
    }
  });

  // Institute - Get exam questions
  app.get("/api/institute/exams/:examId/questions", requireAuth, async (req, res, next) => {
    try {
      if (req.user!.role !== 'institute') {
        return res.status(403).json({ message: "Institute access required" });
      }
      const { examId } = req.params;
      const questions = await storage.getQuestionsByExam(examId);
      res.json(questions);
    } catch (error) {
      next(error);
    }
  });

  // Institute - Add question to exam
  app.post("/api/institute/exams/:examId/questions", requireAuth, async (req, res, next) => {
    try {
      if (req.user!.role !== 'institute') {
        return res.status(403).json({ message: "Institute access required" });
      }
      const { examId } = req.params;
      const { questionText, optionA, optionB, optionC, optionD, correctOption, marks, orderIndex } = req.body;
      
      if (!questionText || !optionA || !optionB || !correctOption) {
        return res.status(400).json({ message: "Question text, options A/B, and correct option are required" });
      }

      const question = await storage.createExamQuestion({
        examId,
        questionText,
        optionA,
        optionB,
        optionC: optionC || null,
        optionD: optionD || null,
        correctOption: correctOption.toUpperCase(),
        marks: marks || 1,
        orderIndex: orderIndex || 0
      });

      res.status(201).json(question);
    } catch (error) {
      next(error);
    }
  });

  // Institute - Bulk add questions to exam
  app.post("/api/institute/exams/:examId/questions/bulk", requireAuth, async (req, res, next) => {
    try {
      if (req.user!.role !== 'institute') {
        return res.status(403).json({ message: "Institute access required" });
      }
      const { examId } = req.params;
      const { questions: questionsList } = req.body;
      
      if (!Array.isArray(questionsList) || questionsList.length === 0) {
        return res.status(400).json({ message: "Questions array is required" });
      }

      const formattedQuestions = questionsList.map((q: any, idx: number) => ({
        examId,
        questionText: q.questionText,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC || null,
        optionD: q.optionD || null,
        correctOption: (q.correctOption || 'A').toUpperCase(),
        marks: q.marks || 1,
        orderIndex: q.orderIndex ?? idx
      }));

      const created = await storage.createExamQuestions(formattedQuestions);
      res.status(201).json({ created: created.length, questions: created });
    } catch (error) {
      next(error);
    }
  });

  // Institute - Delete question from exam
  app.delete("/api/institute/exams/:examId/questions/:questionId", requireAuth, async (req, res, next) => {
    try {
      if (req.user!.role !== 'institute') {
        return res.status(403).json({ message: "Institute access required" });
      }
      const { examId, questionId } = req.params;
      await storage.deleteExamQuestion(questionId, examId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Student - Start exam (creates attempt, returns questions without answers)
  app.post("/api/student/exams/:examId/start", requireAuth, async (req, res, next) => {
    try {
      if (req.user?.role !== 'student') {
        return res.status(403).json({ message: "Student access required" });
      }

      const child = await storage.getChildByStudentUserId(req.user.id);
      if (!child) {
        return res.status(404).json({ message: "No student profile linked" });
      }

      const { examId } = req.params;
      
      // Check for existing attempt
      const existingAttempt = await storage.getExamAttemptByStudent(examId, child.id);
      if (existingAttempt) {
        if (existingAttempt.status === 'Completed') {
          return res.status(400).json({ message: "Exam already completed" });
        }
        // Resume existing attempt
        const questions = await storage.getQuestionsByExam(examId);
        return res.json({
          attemptId: existingAttempt.id,
          questions: questions.map(q => ({
            id: q.id,
            text: q.questionText,
            options: [
              { id: 'A', text: q.optionA },
              { id: 'B', text: q.optionB },
              ...(q.optionC ? [{ id: 'C', text: q.optionC }] : []),
              ...(q.optionD ? [{ id: 'D', text: q.optionD }] : [])
            ],
            marks: q.marks
          })),
          startedAt: existingAttempt.startedAt
        });
      }

      // Create new attempt
      const attempt = await storage.createExamAttempt({
        examId,
        studentId: child.id,
        status: 'In Progress'
      });

      const questions = await storage.getQuestionsByExam(examId);
      
      res.json({
        attemptId: attempt.id,
        questions: questions.map(q => ({
          id: q.id,
          text: q.questionText,
          options: [
            { id: 'A', text: q.optionA },
            { id: 'B', text: q.optionB },
            ...(q.optionC ? [{ id: 'C', text: q.optionC }] : []),
            ...(q.optionD ? [{ id: 'D', text: q.optionD }] : [])
          ],
          marks: q.marks
        })),
        startedAt: attempt.startedAt
      });
    } catch (error) {
      next(error);
    }
  });

  // Student - Submit exam
  app.post("/api/student/exams/:examId/submit", requireAuth, async (req, res, next) => {
    try {
      if (req.user?.role !== 'student') {
        return res.status(403).json({ message: "Student access required" });
      }

      const child = await storage.getChildByStudentUserId(req.user.id);
      if (!child) {
        return res.status(404).json({ message: "No student profile linked" });
      }

      const { examId } = req.params;
      const { attemptId, responses } = req.body;

      if (!attemptId || !Array.isArray(responses)) {
        return res.status(400).json({ message: "attemptId and responses array required" });
      }

      const result = await storage.submitExamAttempt(attemptId, responses);
      
      res.json({
        success: true,
        score: result.score,
        totalMarks: result.totalMarks,
        percentage: result.percentage
      });
    } catch (error) {
      next(error);
    }
  });

  // Student Analytics
  app.get("/api/student/analytics", requireAuth, async (req, res, next) => {
    try {
      if (req.user?.role !== 'student') {
        return res.status(403).json({ message: "Student access required" });
      }

      const child = await storage.getChildByStudentUserId(req.user.id);
      if (!child) {
        return res.status(404).json({ message: "No student profile linked" });
      }

      const analytics = await storage.getStudentAnalytics(child.id);
      res.json(analytics);
    } catch (error) {
      next(error);
    }
  });

  // Institute Analytics
  app.get("/api/institute/analytics", requireAuth, async (req, res, next) => {
    try {
      if (req.user?.role !== 'institute') {
        return res.status(403).json({ message: "Institute access required" });
      }

      const institute = await storage.getInstituteByUserId(req.user.id);
      if (!institute) {
        return res.status(404).json({ message: "Institute not found" });
      }

      const analytics = await storage.getInstituteAnalytics(institute.id);
      res.json(analytics);
    } catch (error) {
      next(error);
    }
  });

  // Student exam routes
  app.get("/api/student/exams", requireAuth, async (req, res, next) => {
    try {
      if (req.user?.role !== 'student') {
        return res.status(403).json({ message: "Access denied. Student role required." });
      }

      const child = await storage.getChildByStudentUserId(req.user.id);
      if (!child) {
        return res.status(404).json({ message: "No student profile linked to this account" });
      }

      const exams = await storage.getAcademicExamsByChild(child.id);
      const formattedExams = exams.map(exam => ({
        id: exam.id,
        title: exam.title,
        subject: exam.subject,
        grade: exam.grade,
        examType: exam.examType,
        status: exam.status === 'completed' ? 'Completed' : 'Pending',
        score: exam.score,
        totalMarks: exam.totalMarks,
        scheduledDate: exam.dueDate?.toISOString(),
        duration: 60,
        questionsCount: 25
      }));

      res.json(formattedExams);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/student/profile", requireAuth, async (req, res, next) => {
    try {
      if (req.user?.role !== 'student') {
        return res.status(403).json({ message: "Access denied. Student role required." });
      }

      const child = await storage.getChildByStudentUserId(req.user.id);
      if (!child) {
        return res.status(404).json({ message: "No student profile linked to this account" });
      }

      res.json({
        id: child.id,
        name: child.name,
        age: child.age,
        grade: child.grade,
        schoolName: child.schoolName,
        lbiConsent: child.lbiConsent
      });
    } catch (error) {
      next(error);
    }
  });

  // Get student behavioral insights (for student dashboard)
  app.get("/api/student/behavioral-insights", requireAuth, async (req, res, next) => {
    try {
      if (req.user?.role !== 'student') {
        return res.status(403).json({ message: "Access denied. Student role required." });
      }

      const child = await storage.getChildByStudentUserId(req.user.id);
      if (!child) {
        return res.status(404).json({ message: "No student profile linked to this account" });
      }

      // Check consent for minors
      if (child.age < 18 && !child.lbiConsent) {
        return res.json({ insights: [], consentRequired: true });
      }

      // Get completed assessment sessions
      const sessions = await storage.getStudentAssessmentSessions(child.id);
      const completedSessions = sessions.filter(s => s.status === 'Completed');

      // Get modules for names
      const modules = await storage.getModules();
      const moduleMap = new Map(modules.map(m => [m.id, m]));

      // Get latest session per module
      const latestByModule = new Map<string, typeof completedSessions[0]>();
      for (const session of completedSessions) {
        const existing = latestByModule.get(session.moduleId);
        if (!existing || (session.completedAt && (!existing.completedAt || new Date(session.completedAt) > new Date(existing.completedAt)))) {
          latestByModule.set(session.moduleId, session);
        }
      }

      // Format as insights
      const insights = Array.from(latestByModule.values()).map(session => {
        const module = moduleMap.get(session.moduleId);
        return {
          id: session.id,
          category: module?.moduleName || 'Unknown Module',
          value: session.percentileScore || 0,
          description: module?.description || 'Behavioral assessment score',
          completedAt: session.completedAt?.toISOString() || null
        };
      });

      res.json({ insights });
    } catch (error) {
      next(error);
    }
  });

  // ========== PSYCHOPSIS ASSESSMENT API ==========

  // Get all assessment modules
  app.get("/api/lbi/modules", requireAuth, async (req, res, next) => {
    try {
      const modules = await storage.getModules();
      let childId = req.query.childId as string | undefined;
      
      // For students, automatically use their own profile ID for lockout calculation
      if (!childId && req.user?.role === 'student') {
        const studentProfile = await storage.getChildByStudentUserId(req.user.id);
        if (studentProfile) {
          childId = studentProfile.id;
        }
      }
      
      // Get existing sessions for lockout calculation if childId provided
      let sessionsByModule = new Map<string, { completedAt: Date | null; percentileScore: number | null }>();
      if (childId) {
        const sessions = await storage.getStudentAssessmentSessions(childId);
        const completedSessions = sessions.filter(s => s.status === 'Completed');
        
        // Get latest completed session per module
        for (const session of completedSessions) {
          const existing = sessionsByModule.get(session.moduleId);
          if (!existing || (session.completedAt && (!existing.completedAt || new Date(session.completedAt) > new Date(existing.completedAt)))) {
            sessionsByModule.set(session.moduleId, {
              completedAt: session.completedAt ? new Date(session.completedAt) : null,
              percentileScore: session.percentileScore
            });
          }
        }
      }
      
      const modulesWithSubModules = await Promise.all(
        modules.map(async (module) => {
          const subModules = await storage.getSubModulesByModule(module.id);
          
          // Calculate lockout status
          const latestSession = sessionsByModule.get(module.id);
          let isLocked = false;
          let lockedUntil: string | null = null;
          let lastScore: number | null = null;
          let lastCompletedAt: string | null = null;
          
          if (latestSession && latestSession.completedAt) {
            const unlockDate = new Date(latestSession.completedAt);
            unlockDate.setMonth(unlockDate.getMonth() + 6);
            isLocked = unlockDate > new Date();
            lockedUntil = isLocked ? unlockDate.toISOString() : null;
            lastScore = latestSession.percentileScore;
            lastCompletedAt = latestSession.completedAt.toISOString();
          }
          
          return {
            ...module,
            subModules,
            isLocked,
            lockedUntil,
            lastScore,
            lastCompletedAt
          };
        })
      );

      res.json(modulesWithSubModules);
    } catch (error) {
      next(error);
    }
  });

  // Get age groups
  app.get("/api/lbi/age-groups", requireAuth, async (req, res, next) => {
    try {
      const ageGroups = await storage.getAgeGroups();
      res.json(ageGroups);
    } catch (error) {
      next(error);
    }
  });

  // Get student's assessment sessions
  app.get("/api/lbi/sessions", requireAuth, async (req, res, next) => {
    try {
      let allSessions: any[] = [];
      const childIdParam = req.query.childId as string | undefined;
      
      if (req.user?.role === 'parent') {
        const children = await storage.getChildren(req.user.id);
        // If childId is specified, only get sessions for that child
        if (childIdParam) {
          const child = children.find((c: any) => c.id === childIdParam);
          if (child) {
            allSessions = await storage.getStudentAssessmentSessions(child.id);
          }
        } else {
          // Get sessions for all children
          for (const child of children as any[]) {
            const sessions = await storage.getStudentAssessmentSessions(child.id);
            allSessions.push(...sessions);
          }
        }
      } else if (req.user?.role === 'student') {
        const child = await storage.getChildByStudentUserId(req.user.id);
        if (child) {
          allSessions = await storage.getStudentAssessmentSessions(child.id);
        }
      } else {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const sessionsWithModules = await Promise.all(
        allSessions.map(async (session) => {
          const modules = await storage.getModules();
          const module = modules.find(m => m.id === session.moduleId);
          return {
            ...session,
            moduleName: module?.moduleName || 'Unknown Module',
            moduleCode: module?.moduleCode || ''
          };
        })
      );

      res.json(sessionsWithModules);
    } catch (error) {
      next(error);
    }
  });

  // Start a new assessment session
  app.post("/api/lbi/sessions", requireAuth, async (req, res, next) => {
    try {
      const { moduleId, childId } = req.body;
      if (!moduleId) {
        return res.status(400).json({ message: "moduleId is required" });
      }

      let child;
      
      if (req.user?.role === 'parent') {
        // Parent creating session for their child
        if (!childId) {
          return res.status(400).json({ message: "childId is required for parent" });
        }
        const children = await storage.getChildren(req.user.id);
        child = children.find((c: any) => c.id === childId);
        if (!child) {
          return res.status(404).json({ message: "Child not found" });
        }
      } else if (req.user?.role === 'student') {
        child = await storage.getChildByStudentUserId(req.user.id);
        if (!child) {
          return res.status(404).json({ message: "No student profile linked to this account" });
        }
      } else {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!child.lbiConsent) {
        return res.status(403).json({ message: "LBI consent required to start assessment" });
      }

      // Check 6-month lockout - each module can only be taken once every 6 months
      const existingSessions = await storage.getStudentAssessmentSessions(child.id);
      const completedModuleSessions = existingSessions.filter(
        s => s.moduleId === moduleId && s.status === 'Completed' && s.completedAt
      );
      
      if (completedModuleSessions.length > 0) {
        // Get the latest completed session for this module
        const latestSession = completedModuleSessions.sort((a, b) => 
          new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime()
        )[0];
        
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        const completedDate = new Date(latestSession.completedAt!);
        if (completedDate > sixMonthsAgo) {
          const unlockDate = new Date(completedDate);
          unlockDate.setMonth(unlockDate.getMonth() + 6);
          return res.status(403).json({ 
            message: "This assessment can only be taken once every 6 months",
            lockedUntil: unlockDate.toISOString(),
            lastCompletedAt: latestSession.completedAt
          });
        }
      }

      // Get age group based on student's age
      const ageGroup = await storage.getAgeGroupForAge(child.age);
      
      // Create session
      const session = await storage.createAssessmentSession({
        studentId: child.id,
        moduleId,
        ageGroupId: ageGroup?.id || null,
        status: 'In Progress',
        startedAt: new Date(),
      });

      res.status(201).json(session);
    } catch (error) {
      next(error);
    }
  });

  // Get random questions for an assessment session
  app.get("/api/lbi/sessions/:sessionId/questions", requireAuth, async (req, res, next) => {
    try {
      const { sessionId } = req.params;
      let child;
      let session;

      if (req.user?.role === 'parent') {
        // Parent accessing child's session
        const children = await storage.getChildren(req.user.id);
        // Find session across all children
        for (const c of children as any[]) {
          const sessions = await storage.getStudentAssessmentSessions(c.id);
          session = sessions.find(s => s.id === sessionId);
          if (session) {
            child = c;
            break;
          }
        }
      } else if (req.user?.role === 'student') {
        child = await storage.getChildByStudentUserId(req.user.id);
        if (child) {
          const sessions = await storage.getStudentAssessmentSessions(child.id);
          session = sessions.find(s => s.id === sessionId);
        }
      } else {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!child) {
        return res.status(404).json({ message: "No profile found" });
      }

      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      // Get the module's sub-modules
      const subModules = await storage.getSubModulesByModule(session.moduleId);
      
      // Get age group for difficulty selection
      const ageGroup = session.ageGroupId ? 
        (await storage.getAgeGroups()).find(ag => ag.id === session.ageGroupId) : 
        await storage.getAgeGroupForAge(child.age);

      const difficultyLevel = ageGroup?.difficultyLevel || 2;

      // Get random questions from each sub-module (5 per sub-module for variety)
      const allQuestions: any[] = [];
      const questionsPerSubModule = 5;

      for (const subModule of subModules) {
        const questions = await storage.getRandomQuestions(
          subModule.id, 
          questionsPerSubModule, 
          difficultyLevel
        );
        
        // If not enough questions at current difficulty, try all difficulties
        if (questions.length < questionsPerSubModule) {
          const moreQuestions = await storage.getRandomQuestions(
            subModule.id, 
            questionsPerSubModule - questions.length
          );
          questions.push(...moreQuestions);
        }

        allQuestions.push(...questions.map(q => ({
          ...q,
          subModuleName: subModule.subModuleName,
          subModuleCode: subModule.subModuleCode
        })));
      }

      // Update session with total questions
      await storage.updateAssessmentSession(sessionId, {
        totalQuestions: allQuestions.length
      });

      res.json({
        sessionId,
        difficultyLevel,
        ageGroup: ageGroup?.groupName || 'Default',
        totalQuestions: allQuestions.length,
        questions: allQuestions.map(q => ({
          id: q.id,
          questionCode: q.questionCode,
          questionType: q.questionType,
          questionText: q.questionText,
          passageText: q.passageText,
          subModuleName: q.subModuleName,
          subModuleCode: q.subModuleCode,
          options: [
            { key: 'A', text: q.optionA },
            { key: 'B', text: q.optionB },
            { key: 'C', text: q.optionC },
            { key: 'D', text: q.optionD },
          ].filter(opt => opt.text)
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  // Submit response for a question
  app.post("/api/lbi/sessions/:sessionId/responses", requireAuth, async (req, res, next) => {
    try {
      const { sessionId } = req.params;
      const { questionId, selectedOption, textResponse, responseTimeMs } = req.body;
      
      // Validate access for both parent and student roles
      let hasAccess = false;
      if (req.user?.role === 'parent') {
        const children = await storage.getChildren(req.user.id);
        for (const c of children as any[]) {
          const sessions = await storage.getStudentAssessmentSessions(c.id);
          if (sessions.find(s => s.id === sessionId)) {
            hasAccess = true;
            break;
          }
        }
      } else if (req.user?.role === 'student') {
        const child = await storage.getChildByStudentUserId(req.user.id);
        if (child) {
          const sessions = await storage.getStudentAssessmentSessions(child.id);
          hasAccess = sessions.some(s => s.id === sessionId);
        }
      }

      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!questionId) {
        return res.status(400).json({ message: "questionId is required" });
      }

      // Check if a response already exists for this question in this session
      const existingResponses = await storage.getSessionResponses(sessionId);
      const existingResponse = existingResponses.find(r => r.questionId === questionId);
      if (existingResponse) {
        // Return existing response instead of creating duplicate
        return res.status(200).json(existingResponse);
      }

      // Fetch the specific question by ID
      const question = await storage.getQuestionById(questionId);
      if (!question) {
        return res.status(404).json({ message: "Question not found" });
      }

      // Calculate score based on stored option scores
      let score = 0;
      if (selectedOption) {
        switch (selectedOption.toUpperCase()) {
          case 'A': score = question.optionAScore || 0; break;
          case 'B': score = question.optionBScore || 0; break;
          case 'C': score = question.optionCScore || 0; break;
          case 'D': score = question.optionDScore || 0; break;
        }
      }

      const response = await storage.saveResponse({
        sessionId,
        questionId,
        selectedOption,
        textResponse,
        score,
        responseTimeMs
      });

      // Update session progress - we already validated access above
      const allResponses = await storage.getSessionResponses(sessionId);
      await storage.updateAssessmentSession(sessionId, {
        questionsAnswered: allResponses.length
      });

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  });

  // Record time spent on a question (for navigation without answering)
  app.post("/api/lbi/sessions/:sessionId/time", requireAuth, async (req, res, next) => {
    try {
      const { sessionId } = req.params;
      const { questionId, timeSpentMs } = req.body;

      if (!questionId || timeSpentMs === undefined) {
        return res.status(400).json({ message: "questionId and timeSpentMs are required" });
      }

      // Validate access for both parent and student roles
      let hasAccess = false;
      if (req.user?.role === 'parent') {
        const children = await storage.getChildren(req.user.id);
        for (const c of children as any[]) {
          const sessions = await storage.getStudentAssessmentSessions(c.id);
          if (sessions.find(s => s.id === sessionId)) {
            hasAccess = true;
            break;
          }
        }
      } else if (req.user?.role === 'student') {
        const child = await storage.getChildByStudentUserId(req.user.id);
        if (child) {
          const sessions = await storage.getStudentAssessmentSessions(child.id);
          hasAccess = sessions.some(s => s.id === sessionId);
        }
      }

      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Update response time for existing response, or create a placeholder
      await storage.updateResponseTime(sessionId, questionId, timeSpentMs);

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Complete assessment and calculate scores
  app.post("/api/lbi/sessions/:sessionId/complete", requireAuth, async (req, res, next) => {
    try {
      const { sessionId } = req.params;
      let session;
      let studentId: string | null = null;

      // Validate access for both parent and student roles
      if (req.user?.role === 'parent') {
        const children = await storage.getChildren(req.user.id);
        for (const c of children as any[]) {
          const sessions = await storage.getStudentAssessmentSessions(c.id);
          session = sessions.find(s => s.id === sessionId);
          if (session) {
            studentId = c.id;
            break;
          }
        }
      } else if (req.user?.role === 'student') {
        const child = await storage.getChildByStudentUserId(req.user.id);
        if (child) {
          const sessions = await storage.getStudentAssessmentSessions(child.id);
          session = sessions.find(s => s.id === sessionId);
          studentId = child.id;
        }
      }

      if (!session || !studentId) {
        return res.status(404).json({ message: "Session not found or access denied" });
      }

      // Get all responses and calculate total score
      const responses = await storage.getSessionResponses(sessionId);
      const totalScore = responses.reduce((sum, r) => sum + (r.score || 0), 0);
      
      // Calculate max possible score based on each question's actual max option score
      let maxScore = 0;
      for (const response of responses) {
        const question = await storage.getQuestionById(response.questionId);
        if (question) {
          const optionScores = [
            question.optionAScore || 0,
            question.optionBScore || 0,
            question.optionCScore || 0,
            question.optionDScore || 0
          ];
          maxScore += Math.max(...optionScores);
        }
      }
      
      const percentileScore = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

      // Update session as completed
      await storage.updateAssessmentSession(sessionId, {
        status: 'Completed',
        completedAt: new Date(),
        rawScore: totalScore,
        percentileScore: Math.round(percentileScore * 10) / 10,
        questionsAnswered: responses.length
      });

      const updatedSessions = await storage.getStudentAssessmentSessions(studentId);
      const completedSession = updatedSessions.find(s => s.id === sessionId);

      res.json({
        session: completedSession,
        summary: {
          totalQuestions: responses.length,
          rawScore: totalScore,
          maxPossibleScore: maxScore,
          percentileScore: Math.round(percentileScore * 10) / 10,
          grade: percentileScore >= 80 ? 'Excellent' : 
                 percentileScore >= 60 ? 'Good' : 
                 percentileScore >= 40 ? 'Average' : 'Needs Improvement'
        }
      });
    } catch (error) {
      next(error);
    }
  });

  // Get detailed results for a completed session
  app.get("/api/lbi/sessions/:sessionId/results", requireAuth, async (req, res, next) => {
    try {
      const { sessionId } = req.params;
      let session;

      // Validate access for both parent and student roles
      if (req.user?.role === 'parent') {
        const children = await storage.getChildren(req.user.id);
        for (const c of children as any[]) {
          const sessions = await storage.getStudentAssessmentSessions(c.id);
          session = sessions.find(s => s.id === sessionId);
          if (session) break;
        }
      } else if (req.user?.role === 'student') {
        const child = await storage.getChildByStudentUserId(req.user.id);
        if (child) {
          const sessions = await storage.getStudentAssessmentSessions(child.id);
          session = sessions.find(s => s.id === sessionId);
        }
      }

      if (!session) {
        return res.status(404).json({ message: "Session not found or access denied" });
      }

      const responses = await storage.getSessionResponses(sessionId);
      const modules = await storage.getModules();
      const module = modules.find(m => m.id === session.moduleId);

      const totalScore = responses.reduce((sum, r) => sum + (r.score || 0), 0);
      
      // Calculate max possible score based on each question's actual max option score
      let maxScore = 0;
      for (const response of responses) {
        const question = await storage.getQuestionById(response.questionId);
        if (question) {
          const optionScores = [
            question.optionAScore || 0,
            question.optionBScore || 0,
            question.optionCScore || 0,
            question.optionDScore || 0
          ];
          maxScore += Math.max(...optionScores);
        }
      }
      
      const percentileScore = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

      res.json({
        sessionId,
        moduleName: module?.moduleName || 'Unknown Module',
        moduleCode: module?.moduleCode || '',
        status: session.status,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        summary: {
          totalQuestions: responses.length,
          rawScore: totalScore,
          maxPossibleScore: maxScore,
          percentileScore: Math.round(percentileScore * 10) / 10,
          grade: percentileScore >= 80 ? 'Excellent' : 
                 percentileScore >= 60 ? 'Good' : 
                 percentileScore >= 40 ? 'Average' : 'Needs Improvement',
          insights: generateInsights(percentileScore, module?.moduleCode || '')
        }
      });
    } catch (error) {
      next(error);
    }
  });

  // Chat Support API - LLM-powered conversational assistant
  const chatSessionHistory: Record<string, Array<{ role: string; content: string }>> = {};
  
  app.post("/api/chat/message", async (req, res, next) => {
    try {
      const { message, sessionId, language, context } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required' });
      }

      if (!chatSessionHistory[sessionId]) {
        chatSessionHistory[sessionId] = [];
      }

      chatSessionHistory[sessionId].push({ role: 'user', content: message });
      if (chatSessionHistory[sessionId].length > 20) {
        chatSessionHistory[sessionId] = chatSessionHistory[sessionId].slice(-16);
      }

      // Pull LIVE pricing from DB so the bot always quotes current packages
      let pricingBlock = "\n## 17. LIVE PRICING (managed via Super Admin → Pricing page)\n";
      try {
        const activePkgs = await db
          .select()
          .from(subscriptionPackages)
          .where(eq(subscriptionPackages.isActive, true))
          .orderBy(asc(subscriptionPackages.sortOrder));
        const withPrices = activePkgs.filter((p: any) => p.price !== null && p.price !== undefined);
        if (withPrices.length === 0) {
          pricingBlock += "Pricing has not been published yet. If asked about price, say prices are being finalized and invite the visitor to book a demo.\n";
        } else {
          pricingBlock += "Only quote from this list. If the visitor asks for something not listed, say it's not published yet.\n\n";
          for (const p of withPrices) {
            const rec = p.isRecommended ? " ⭐ Recommended" : "";
            const report = p.reportType ? ` · ${p.reportType} report` : "";
            const validity = p.validityDays ? ` · ${p.validityDays}-day validity` : "";
            const qs = p.questionCount ? ` · ${p.questionCount} questions` : "";
            pricingBlock += `- **${p.productName}** — ${p.category} · ${p.studentSegment} — ₹${p.price}${validity}${qs}${report}${rec}\n`;
          }
        }
      } catch (e) {
        pricingBlock += "(Pricing temporarily unavailable. Invite visitor to book a demo.)\n";
      }

      const LANGUAGE_NAMES: Record<string, string> = {
        en: "English",
        hi: "Hindi (हिन्दी)",
        te: "Telugu (తెలుగు)",
        ta: "Tamil (தமிழ்)",
        kn: "Kannada (ಕನ್ನಡ)",
        mr: "Marathi (मराठी)",
        bn: "Bengali (বাংলা)",
        gu: "Gujarati (ગુજરાતી)",
        ml: "Malayalam (മലയാളം)",
        pa: "Punjabi (ਪੰਜਾਬੀ)",
        ur: "Urdu (اردو)",
      };
      const langName = LANGUAGE_NAMES[language as string] || (language ? String(language) : "English");

      const systemPrompt = `You are **MetryxAI Coach** — the friendly, knowledgeable assistant for the MetryxOne platform. Use the full knowledge base below to answer every question accurately.

${METRYXONE_KNOWLEDGE_BASE}
${pricingBlock}

## Response Language
Respond in **${langName}**. If the user writes in a different language, reply in that language instead. Never mix languages unnecessarily — match the user's language.

## Context
${context?.userRole ? `- User role: ${context.userRole}` : "- User role: anonymous visitor on the public landing page"}
${context?.userName ? `- User name: ${context.userName}` : ""}

## Hard Rules
- ONLY state facts present in the knowledge base above. If something is not covered (e.g., exact pricing), say so and recommend booking a demo or visiting the Pricing page.
- Keep replies concise: 2–4 sentences for simple queries, a short bulleted list for feature comparisons, longer only when asked for depth.
- If the user expresses intent to try MetryxOne, nudge them gently toward "Start Free Assessment" or "Book Demo".
- Do not output markdown headings or code fences unless the user explicitly asks.`;

      const openai = new (await import('openai')).default({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const completion = await openai.chat.completions.create({
        model: 'gpt-5-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...chatSessionHistory[sessionId].map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
        ],
        max_completion_tokens: 512,
      });

      const response = completion.choices[0]?.message?.content || 'I apologize, but I encountered an issue. Please try again.';
      
      chatSessionHistory[sessionId].push({ role: 'assistant', content: response });

      res.json({
        response,
        sessionId,
        timestamp: new Date().toISOString(),
        language
      });
    } catch (error) {
      console.error('Chat LLM error:', error);
      res.json({
        response: "I'm having a moment! Please try again shortly.",
        sessionId: req.body.sessionId,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ============================================
  // CURRICULUM CATALOG API ROUTES
  // ============================================

  // Get all education boards
  app.get("/api/curriculum/boards", async (req, res, next) => {
    try {
      const boards = await storage.getEducationBoards();
      res.json(boards);
    } catch (error) {
      next(error);
    }
  });

  // Get classes by board
  app.get("/api/curriculum/boards/:boardId/classes", async (req, res, next) => {
    try {
      const classes = await storage.getClassesByBoard(req.params.boardId);
      res.json(classes);
    } catch (error) {
      next(error);
    }
  });

  // Get subjects by class
  app.get("/api/curriculum/classes/:classId/subjects", async (req, res, next) => {
    try {
      const subjects = await storage.getSubjectsByClass(req.params.classId);
      res.json(subjects);
    } catch (error) {
      next(error);
    }
  });

  // Get chapters by subject
  app.get("/api/curriculum/subjects/:subjectId/chapters", async (req, res, next) => {
    try {
      const chapters = await storage.getChaptersBySubject(req.params.subjectId);
      res.json(chapters);
    } catch (error) {
      next(error);
    }
  });

  // Get topics by chapter
  app.get("/api/curriculum/chapters/:chapterId/topics", async (req, res, next) => {
    try {
      const topics = await storage.getTopicsByChapter(req.params.chapterId);
      res.json(topics);
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // CHILD ACADEMIC PROFILE API ROUTES
  // ============================================

  // Get child academic profile
  app.get("/api/children/:childId/academic-profile", requireAuth, async (req, res, next) => {
    try {
      const profile = await storage.getChildAcademicProfile(req.params.childId);
      if (!profile) {
        return res.status(404).json({ message: "Academic profile not found" });
      }
      res.json(profile);
    } catch (error) {
      next(error);
    }
  });

  // Create or update child academic profile
  app.post("/api/children/:childId/academic-profile", requireAuth, async (req, res, next) => {
    try {
      const { boardId, classId, academicYear, section, rollNumber } = req.body;
      const existing = await storage.getChildAcademicProfile(req.params.childId);
      
      if (existing) {
        const updated = await storage.updateChildAcademicProfile(existing.id, {
          boardId,
          classId,
          academicYear,
          section,
          rollNumber
        });
        res.json(updated);
      } else {
        const profile = await storage.createChildAcademicProfile({
          childId: req.params.childId,
          boardId,
          classId,
          academicYear: academicYear || new Date().getFullYear().toString(),
          section,
          rollNumber
        });
        res.status(201).json(profile);
      }
    } catch (error) {
      next(error);
    }
  });

  // Get child subject enrollments
  app.get("/api/children/:childId/subjects", requireAuth, async (req, res, next) => {
    try {
      const profile = await storage.getChildAcademicProfile(req.params.childId);
      if (!profile) {
        return res.json([]);
      }
      const enrollments = await storage.getChildSubjectEnrollments(profile.id);
      res.json(enrollments);
    } catch (error) {
      next(error);
    }
  });

  // Enroll child in subject
  app.post("/api/children/:childId/subjects", requireAuth, async (req, res, next) => {
    try {
      const { subjectId } = req.body;
      const profile = await storage.getChildAcademicProfile(req.params.childId);
      if (!profile) {
        return res.status(400).json({ message: "Academic profile required first" });
      }
      const enrollment = await storage.enrollChildInSubject({
        profileId: profile.id,
        subjectId
      });
      res.status(201).json(enrollment);
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // STUDY TASKS API ROUTES
  // ============================================

  // Get study tasks for a child
  app.get("/api/children/:childId/study-tasks", requireAuth, async (req, res, next) => {
    try {
      const tasks = await storage.getStudyTasksByChild(req.params.childId);
      res.json(tasks);
    } catch (error) {
      next(error);
    }
  });

  // Create study task
  app.post("/api/children/:childId/study-tasks", requireAuth, async (req, res, next) => {
    try {
      const { title, description, taskType, subjectId, chapterId, topicId, priority, dueDate, estimatedMinutes, notes } = req.body;
      const task = await storage.createStudyTask({
        childId: req.params.childId,
        createdByParentId: req.user!.id,
        title,
        description,
        taskType: taskType || 'study',
        subjectId,
        chapterId,
        topicId,
        priority: priority || 'Medium',
        dueDate: dueDate ? new Date(dueDate) : undefined,
        estimatedMinutes,
        notes
      });
      res.status(201).json(task);
    } catch (error) {
      next(error);
    }
  });

  // Update study task
  app.patch("/api/study-tasks/:taskId", requireAuth, async (req, res, next) => {
    try {
      const { status, notes, completedAt } = req.body;
      const updated = await storage.updateStudyTask(req.params.taskId, {
        status,
        notes,
        completedAt: completedAt ? new Date(completedAt) : undefined
      });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  // Delete study task
  app.delete("/api/study-tasks/:taskId", requireAuth, async (req, res, next) => {
    try {
      await storage.deleteStudyTask(req.params.taskId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // TEST MANAGEMENT API ROUTES
  // ============================================

  // Get tests created by user (parent)
  app.get("/api/tests/my-tests", requireAuth, async (req, res, next) => {
    try {
      const tests = await storage.getTestsByCreator(req.user!.id);
      res.json(tests);
    } catch (error) {
      next(error);
    }
  });

  // Get tests for a child
  app.get("/api/children/:childId/tests", requireAuth, async (req, res, next) => {
    try {
      const tests = await storage.getTestsByChild(req.params.childId);
      res.json(tests);
    } catch (error) {
      next(error);
    }
  });

  // Get single test with questions
  app.get("/api/tests/:testId", requireAuth, async (req, res, next) => {
    try {
      const test = await storage.getTest(req.params.testId);
      if (!test) {
        return res.status(404).json({ message: "Test not found" });
      }
      const questions = await storage.getTestQuestionsByTest(req.params.testId);
      res.json({ ...test, questions });
    } catch (error) {
      next(error);
    }
  });

  // Create test
  app.post("/api/tests", requireAuth, async (req, res, next) => {
    try {
      const { testName, testType, boardId, classId, subjectId, chapterId, duration, totalMarks, passingMarks, instructions, isAutoGenerated } = req.body;
      
      // Generate test code
      const testCode = `TST-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      
      const test = await storage.createTest({
        testCode,
        testName,
        testType: testType || 'MCQ',
        boardId,
        classId,
        subjectId,
        chapterId,
        duration: duration || 60,
        totalMarks: totalMarks || 100,
        passingMarks: passingMarks || 35,
        instructions,
        createdBy: req.user!.id,
        creatorType: req.user!.role === 'institute' ? 'institute' : 'parent',
        isAutoGenerated: isAutoGenerated || false,
        workflowStatus: 'Draft'
      });
      
      res.status(201).json(test);
    } catch (error) {
      next(error);
    }
  });

  // Add questions to test
  app.post("/api/tests/:testId/questions", requireAuth, async (req, res, next) => {
    try {
      const { questions } = req.body;
      const questionsWithTestId = questions.map((q: any, index: number) => ({
        testId: req.params.testId,
        questionText: q.questionText,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctOption: q.correctOption,
        explanation: q.explanation,
        marks: q.marks || 1,
        negativeMarks: q.negativeMarks || 0,
        orderIndex: index
      }));
      
      const created = await storage.createTestQuestions(questionsWithTestId);
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  // Auto-generate test questions from question bank
  app.post("/api/tests/:testId/auto-generate", requireAuth, async (req, res, next) => {
    try {
      const { count, boardId, classId, subjectId, chapterId } = req.body;
      
      // First try with chapter filter
      let bankQuestions = await storage.getQuestionBankQuestions({
        boardId,
        classId,
        subjectId,
        chapterId
      });
      
      // If no chapter-level questions, fall back to subject level
      if (bankQuestions.length === 0 && chapterId) {
        bankQuestions = await storage.getQuestionBankQuestions({
          boardId,
          classId,
          subjectId
        });
      }
      
      // If still no questions at subject level, try class level
      if (bankQuestions.length === 0 && subjectId) {
        bankQuestions = await storage.getQuestionBankQuestions({
          boardId,
          classId
        });
      }
      
      // Return error if no questions found at any level
      if (bankQuestions.length === 0) {
        return res.status(400).json({ 
          message: "No questions available in the question bank for the selected curriculum. Please add questions to the question bank first or select a different subject/chapter." 
        });
      }
      
      // Randomly select questions
      const shuffled = bankQuestions.sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, Math.min(count || 20, bankQuestions.length));
      
      // Create test questions from bank questions
      const testQuestions = selected.map((q, index) => ({
        testId: req.params.testId,
        questionBankId: q.id,
        questionText: q.questionText,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctOption: q.correctOption || 'A',
        explanation: q.explanation,
        marks: q.marks,
        negativeMarks: q.negativeMarks || 0,
        orderIndex: index
      }));
      
      const created = await storage.createTestQuestions(testQuestions);
      
      // Update test as auto-generated
      await storage.updateTest(req.params.testId, {
        isAutoGenerated: true,
        totalMarks: created.reduce((sum, q) => sum + q.marks, 0)
      });
      
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // TEST WORKFLOW API ROUTES
  // ============================================

  // Submit test for review
  app.post("/api/tests/:testId/submit-for-review", requireAuth, async (req, res, next) => {
    try {
      const test = await storage.updateTestWorkflowStatus(
        req.params.testId,
        'Pending Review',
        req.user!.id,
        'submit_for_review',
        req.body.comments
      );
      res.json(test);
    } catch (error) {
      next(error);
    }
  });

  // Approve test (superadmin/head only)
  app.post("/api/tests/:testId/approve", requireAuth, async (req, res, next) => {
    try {
      // Create approval record
      await storage.createTestApproval({
        testId: req.params.testId,
        approverUserId: req.user!.id,
        approvalStatus: 'Approved',
        comments: req.body.comments
      });
      
      const test = await storage.updateTestWorkflowStatus(
        req.params.testId,
        'Approved',
        req.user!.id,
        'approve',
        req.body.comments
      );
      res.json(test);
    } catch (error) {
      next(error);
    }
  });

  // Reject test
  app.post("/api/tests/:testId/reject", requireAuth, async (req, res, next) => {
    try {
      await storage.createTestApproval({
        testId: req.params.testId,
        approverUserId: req.user!.id,
        approvalStatus: 'Rejected',
        comments: req.body.comments
      });
      
      const test = await storage.updateTestWorkflowStatus(
        req.params.testId,
        'Rejected',
        req.user!.id,
        'reject',
        req.body.comments
      );
      res.json(test);
    } catch (error) {
      next(error);
    }
  });

  // Assign test to child
  app.post("/api/tests/:testId/assign", requireAuth, async (req, res, next) => {
    try {
      const { childId, batchId, startDate, endDate } = req.body;
      
      const assignment = await storage.createTestAssignment({
        testId: req.params.testId,
        assignmentType: childId ? 'child' : 'batch',
        childId,
        batchId,
        assignedBy: req.user!.id,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined
      });
      
      // Update test workflow status
      await storage.updateTestWorkflowStatus(
        req.params.testId,
        'Assigned',
        req.user!.id,
        'assign'
      );
      
      res.status(201).json(assignment);
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // TEST ATTEMPTS API ROUTES
  // ============================================

  // Get test attempts for a child
  app.get("/api/children/:childId/test-attempts", requireAuth, async (req, res, next) => {
    try {
      const attempts = await storage.getTestAttemptsByChild(req.params.childId);
      res.json(attempts);
    } catch (error) {
      next(error);
    }
  });

  // Start test attempt
  app.post("/api/tests/:testId/start", requireAuth, async (req, res, next) => {
    try {
      const { childId, assignmentId } = req.body;
      
      const attempt = await storage.createTestAttempt({
        testId: req.params.testId,
        assignmentId,
        childId,
        status: 'In Progress',
        startedAt: new Date()
      });
      
      // Get test questions
      const questions = await storage.getTestQuestionsByTest(req.params.testId);
      
      res.status(201).json({ attempt, questions });
    } catch (error) {
      next(error);
    }
  });

  // Submit test attempt
  app.post("/api/test-attempts/:attemptId/submit", requireAuth, async (req, res, next) => {
    try {
      const { responses } = req.body;
      const result = await storage.submitTestAttempt(req.params.attemptId, responses);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // QUESTION BANK API ROUTES
  // ============================================

  // Get questions from question bank
  app.get("/api/question-bank", requireAuth, async (req, res, next) => {
    try {
      const { boardId, classId, subjectId, chapterId } = req.query;
      const questions = await storage.getQuestionBankQuestions({
        boardId: boardId as string,
        classId: classId as string,
        subjectId: subjectId as string,
        chapterId: chapterId as string
      });
      res.json(questions);
    } catch (error) {
      next(error);
    }
  });

  // Add question to question bank
  app.post("/api/question-bank", requireAuth, async (req, res, next) => {
    try {
      const questionCode = `QB-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      
      const question = await storage.createQuestionBankQuestion({
        questionCode,
        ...req.body,
        createdBy: req.user!.id
      });
      res.status(201).json(question);
    } catch (error) {
      next(error);
    }
  });

  // Bulk import questions
  app.post("/api/question-bank/bulk-import", requireAuth, async (req, res, next) => {
    try {
      const { questions } = req.body;
      const questionsWithCodes = questions.map((q: any, index: number) => ({
        questionCode: `QB-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
        ...q,
        createdBy: req.user!.id
      }));
      
      const count = await storage.bulkCreateQuestionBankQuestions(questionsWithCodes);
      res.status(201).json({ imported: count });
    } catch (error) {
      next(error);
    }
  });

  // Generate questions for auto-test
  app.get("/api/question-bank/generate", requireAuth, async (req, res, next) => {
    try {
      const { subject, count, difficulty, board, class: classLevel, chapter } = req.query;
      const questionCount = parseInt(count as string) || 10;
      
      // Fetch questions from question bank with filters
      const filters: any = {};
      if (subject) filters.subject = subject;
      if (difficulty && difficulty !== 'mixed') filters.difficulty = difficulty;
      if (board) filters.board = board;
      if (classLevel) filters.class = classLevel;
      if (chapter) filters.chapter = chapter;
      
      const allQuestions = await storage.getQuestionBankQuestions(filters);
      
      // Shuffle and pick random questions
      const shuffled = allQuestions.sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, questionCount);
      
      // Transform to test question format
      const questions = selected.map(q => ({
        questionText: q.questionText,
        questionType: q.questionType || 'mcq',
        options: [q.optionA, q.optionB, q.optionC, q.optionD].filter(Boolean) as string[],
        correctAnswer: q.correctOption || q.optionA || '',
        marks: q.marks || 1,
        explanation: q.explanation
      }));
      
      // If no questions found, generate sample questions
      if (questions.length === 0) {
        const sampleQuestions = Array.from({ length: questionCount }, (_, i) => ({
          questionText: `Sample ${subject || 'General'} question ${i + 1}`,
          questionType: 'mcq',
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctAnswer: 'Option A',
          marks: 1,
          explanation: 'This is a sample question generated automatically.'
        }));
        return res.json({ questions: sampleQuestions, source: 'generated' });
      }
      
      res.json({ questions, source: 'question_bank' });
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // FORUM API ROUTES
  // ============================================

  // Get forum posts
  app.get("/api/forum/posts", async (req, res, next) => {
    try {
      const { subjectId, visibility, status } = req.query;
      const posts = await storage.getForumPosts({
        subjectId: subjectId as string,
        visibility: (visibility as string) || 'public',
        status: (status as string) || 'Open'
      });
      
      // Mask author names for anonymous posts
      const maskedPosts = posts.map(post => ({
        ...post,
        authorName: post.isAnonymous ? 'Anonymous Student' : undefined
      }));
      
      res.json(maskedPosts);
    } catch (error) {
      next(error);
    }
  });

  // Get single forum post with replies
  app.get("/api/forum/posts/:postId", async (req, res, next) => {
    try {
      const post = await storage.getForumPost(req.params.postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }
      
      const replies = await storage.getForumReplies(req.params.postId);
      
      // Mask author names for anonymous posts/replies
      const maskedPost = {
        ...post,
        authorName: post.isAnonymous ? 'Anonymous Student' : undefined
      };
      
      const maskedReplies = replies.map(reply => ({
        ...reply,
        authorName: reply.isAnonymous ? 'Anonymous Student' : undefined
      }));
      
      res.json({ post: maskedPost, replies: maskedReplies });
    } catch (error) {
      next(error);
    }
  });

  // Create forum post (student posts doubt after test)
  app.post("/api/forum/posts", requireAuth, async (req, res, next) => {
    try {
      const { title, content, postType, subjectId, chapterId, testId, questionId, isAnonymous, visibility, targetAudience, childId } = req.body;
      
      const post = await storage.createForumPost({
        authorId: req.user!.id,
        authorType: req.user!.role === 'student' ? 'student' : 'parent',
        childId,
        testId,
        questionId,
        title,
        content,
        postType: postType || 'doubt',
        subjectId,
        chapterId,
        isAnonymous: isAnonymous || false,
        visibility: visibility || 'public',
        targetAudience: targetAudience || 'all'
      });
      
      // Create audit log for DPDP compliance
      await storage.createAuditLog({
        userId: req.user!.id,
        entityType: 'forum_post',
        entityId: post.id,
        action: 'create',
        details: isAnonymous ? 'Anonymous post created' : 'Post created'
      });
      
      res.status(201).json(post);
    } catch (error) {
      next(error);
    }
  });

  // Reply to forum post
  app.post("/api/forum/posts/:postId/replies", requireAuth, async (req, res, next) => {
    try {
      const { content, isAnonymous, parentReplyId } = req.body;
      
      const reply = await storage.createForumReply({
        postId: req.params.postId,
        authorId: req.user!.id,
        authorType: req.user!.role,
        parentReplyId,
        content,
        isAnonymous: isAnonymous || false
      });
      
      res.status(201).json(reply);
    } catch (error) {
      next(error);
    }
  });

  // Vote on post
  app.post("/api/forum/posts/:postId/vote", requireAuth, async (req, res, next) => {
    try {
      const { voteType } = req.body;
      await storage.voteOnPost(req.user!.id, req.params.postId, voteType);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Report content (moderation)
  app.post("/api/forum/report", requireAuth, async (req, res, next) => {
    try {
      const { postId, replyId, reason } = req.body;
      
      const report = await storage.reportForumContent({
        postId,
        replyId,
        reportedBy: req.user!.id,
        reportReason: reason,
        status: 'Pending'
      });
      
      // Create audit log
      await storage.createAuditLog({
        userId: req.user!.id,
        entityType: 'content_report',
        entityId: report.id,
        action: 'report',
        details: `Content reported: ${reason}`
      });
      
      res.status(201).json(report);
    } catch (error) {
      next(error);
    }
  });

  // Mark answer as accepted
  app.post("/api/forum/posts/:postId/accept-answer", requireAuth, async (req, res, next) => {
    try {
      const { replyId } = req.body;
      
      // Update the post as resolved
      await storage.updateForumPost(req.params.postId, {
        isResolved: true,
        resolvedAt: new Date()
      });
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // ANALYTICS & LBI CORRELATION API ROUTES
  // ============================================

  // Get child performance analytics
  app.get("/api/children/:childId/performance-analytics", requireAuth, async (req, res, next) => {
    try {
      const analytics = await storage.getChildPerformanceAnalytics(req.params.childId);
      res.json(analytics);
    } catch (error) {
      next(error);
    }
  });

  // Get LBI correlations for child
  app.get("/api/children/:childId/lbi-correlations", requireAuth, async (req, res, next) => {
    try {
      const correlations = await storage.getLbiCorrelations(req.params.childId);
      res.json(correlations);
    } catch (error) {
      next(error);
    }
  });

  // Get comprehensive progress report
  app.get("/api/children/:childId/progress-report", requireAuth, async (req, res, next) => {
    try {
      // Get academic analytics
      const academicAnalytics = await storage.getStudentAnalytics(req.params.childId);
      
      // Get LBI insights
      const insights = await storage.getInsightsByChild(req.params.childId);
      
      // Get LBI correlations
      const correlations = await storage.getLbiCorrelations(req.params.childId);
      
      // Get recent test attempts
      const testAttempts = await storage.getTestAttemptsByChild(req.params.childId);
      
      res.json({
        academic: academicAnalytics,
        behavioral: insights,
        correlations,
        recentTests: testAttempts.slice(0, 10)
      });
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // INSTITUTE STAFF API ROUTES
  // ============================================

  // Get institute staff
  app.get("/api/institute/:instituteId/staff", requireAuth, async (req, res, next) => {
    try {
      const staff = await storage.getInstituteStaff(req.params.instituteId);
      res.json(staff);
    } catch (error) {
      next(error);
    }
  });

  // Get staff roles
  app.get("/api/staff-roles", requireAuth, async (req, res, next) => {
    try {
      const roles = await storage.getStaffRoles();
      res.json(roles);
    } catch (error) {
      next(error);
    }
  });

  // Get tests pending approval (for superadmin)
  app.get("/api/institute/:instituteId/tests/pending-approval", requireAuth, async (req, res, next) => {
    try {
      const allTests = await storage.getTestsByInstitute(req.params.instituteId);
      const pendingTests = allTests.filter(t => t.workflowStatus === 'Pending Review');
      res.json(pendingTests);
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // PARENT TEST CREATION & ASSIGNMENT API ROUTES
  // ============================================

  // Get all tests created by parent
  app.get("/api/parent-tests", requireAuth, async (req, res, next) => {
    try {
      const tests = await storage.getParentCreatedTests(req.user!.id);
      res.json(tests);
    } catch (error) {
      next(error);
    }
  });

  // Create a new parent test
  app.post("/api/parent-tests", requireAuth, async (req, res, next) => {
    try {
      const { title, subject, description, duration, totalMarks, questions } = req.body;
      
      if (!title || !subject || !questions || questions.length === 0) {
        return res.status(400).json({ error: 'Title, subject, and at least one question are required' });
      }
      
      const test = await storage.createParentTest({
        createdBy: req.user!.id,
        title,
        subject,
        description,
        duration: duration || 30,
        totalMarks: totalMarks || questions.reduce((sum: number, q: any) => sum + (q.marks || 1), 0),
        questions: JSON.stringify(questions),
        status: 'draft'
      });
      
      res.status(201).json(test);
    } catch (error) {
      next(error);
    }
  });

  // Delete a parent test
  app.delete("/api/parent-tests/:testId", requireAuth, async (req, res, next) => {
    try {
      await storage.deleteParentTest(req.params.testId, req.user!.id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Assign test to children
  app.post("/api/parent-tests/:testId/assign", requireAuth, async (req, res, next) => {
    try {
      const { childIds, dueDate } = req.body;
      
      if (!childIds || childIds.length === 0) {
        return res.status(400).json({ error: 'At least one child must be selected' });
      }
      
      const assignments = await storage.assignParentTest(req.params.testId, childIds, dueDate);
      res.status(201).json(assignments);
    } catch (error) {
      next(error);
    }
  });

  // Get all test assignments for parent
  app.get("/api/parent-tests/assignments", requireAuth, async (req, res, next) => {
    try {
      const assignments = await storage.getParentTestAssignments(req.user!.id);
      res.json(assignments);
    } catch (error) {
      next(error);
    }
  });

  // Get test results for parent
  app.get("/api/parent-tests/results", requireAuth, async (req, res, next) => {
    try {
      const results = await storage.getParentTestResults(req.user!.id);
      res.json(results);
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // AI-POWERED TEST GENERATION ROUTES
  // ============================================

  // Zod schemas for AI test routes
  const aiTestGenerateSchema = z.object({
    childId: z.string().min(1, "Child ID is required"),
    subject: z.string().min(1, "Subject is required"),
    chapter: z.string().optional(),
    topic: z.string().optional(),
    questionCount: z.number().int().min(5).max(30).default(10),
    difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']).default('medium'),
    bloomsLevel: z.enum(['remember', 'understand', 'apply', 'analyze', 'mixed']).default('mixed'),
    includeExplanations: z.boolean().default(true),
    focusOnWeakAreas: z.boolean().default(true),
    timeLimit: z.number().int().min(5).max(120).optional(),
  });

  const aiTestSaveSchema = z.object({
    title: z.string().min(1, "Title is required"),
    subject: z.string().min(1, "Subject is required"),
    description: z.string().optional(),
    questions: z.array(z.object({
      questionText: z.string(),
      optionA: z.string(),
      optionB: z.string(),
      optionC: z.string(),
      optionD: z.string(),
      correctOption: z.enum(['A', 'B', 'C', 'D']),
      explanation: z.string().optional(),
      difficulty: z.string().optional(),
      bloomsLevel: z.string().optional(),
      topic: z.string().optional(),
    })).min(1, "At least one question is required"),
    duration: z.number().int().positive().optional(),
    totalMarks: z.number().int().positive().optional(),
    passingMarks: z.number().int().positive().optional(),
    childId: z.string().optional(),
  });

  const aiTestScoreSchema = z.object({
    questions: z.array(z.object({
      questionText: z.string(),
      optionA: z.string(),
      optionB: z.string(),
      optionC: z.string(),
      optionD: z.string(),
      correctOption: z.string(),
      explanation: z.string().optional(),
      topic: z.string().optional(),
    })).min(1),
    answers: z.record(z.string()),
    childId: z.string().optional(),
    subject: z.string().optional(),
  });

  // Generate AI test based on child profile and LBI insights
  app.post("/api/ai-tests/generate", requireAuth, async (req, res, next) => {
    try {
      // Validate request body
      const parseResult = aiTestGenerateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: (parseResult.error.issues?.[0]?.message ?? parseResult.error.errors?.[0]?.message ?? "Validation failed") });
      }
      
      const { childId, subject, chapter, topic, questionCount, difficulty, bloomsLevel, includeExplanations, focusOnWeakAreas, timeLimit } = parseResult.data;

      // Verify parent owns this child (authorization check)
      const child = await storage.getChild(childId, req.user!.id);
      if (!child) {
        return res.status(404).json({ error: 'Child not found or access denied' });
      }

      // Get LBI insights for personalization (from behavioural_insights table)
      const insightsResult = await db.execute(sql`
        SELECT category, value, description FROM behavioural_insights 
        WHERE student_id = ${childId}
        ORDER BY recorded_at DESC
      `);
      const insights = (insightsResult.rows as any[]) || [];
      const lbiInsights: LBIInsight[] = insights.map((i: any) => ({
        category: i.category,
        score: i.value || 5,
        interpretation: i.description || 'Average',
      }));

      // Generate AI test
      const aiTest = await generateAITest({
        childName: child.name,
        childAge: child.age,
        childGrade: child.grade,
        subject,
        chapter,
        topic,
        questionCount: Math.min(questionCount, 30),
        difficulty,
        bloomsLevel,
        includeExplanations,
        focusOnWeakAreas,
        timeLimit,
        lbiInsights,
        weakAreas: child.weakSubjects || [],
        focusAreas: child.favoriteSubjects || [],
      });

      res.json(aiTest);
    } catch (error) {
      console.error('AI Test Generation Error:', error);
      next(error);
    }
  });

  // Save AI-generated test as a parent test
  app.post("/api/ai-tests/save", requireAuth, async (req, res, next) => {
    try {
      // Validate request body
      const parseResult = aiTestSaveSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: (parseResult.error.issues?.[0]?.message ?? parseResult.error.errors?.[0]?.message ?? "Validation failed") });
      }
      
      const { title, subject, description, questions, duration, totalMarks, passingMarks, childId } = parseResult.data;

      // If childId provided, verify parent owns this child
      if (childId) {
        const child = await storage.getChild(childId, req.user!.id);
        if (!child) {
          return res.status(404).json({ error: 'Child not found or access denied' });
        }
      }

      // Format questions for storage
      const formattedQuestions = questions.map((q: any, index: number) => ({
        id: `q${index + 1}`,
        questionText: q.questionText,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctAnswer: q.correctOption,
        explanation: q.explanation,
        marks: 1,
        difficulty: q.difficulty,
        topic: q.topic,
        isAIGenerated: true,
      }));

      // Create the test
      const test = await storage.createParentTest({
        createdBy: req.user!.id,
        title,
        subject,
        description: description || `AI-generated ${subject} practice test`,
        duration: duration || 30,
        totalMarks: totalMarks || questions.length,
        questions: JSON.stringify(formattedQuestions),
        status: 'draft',
      });

      // If childId provided, auto-assign the test
      if (childId) {
        await storage.assignParentTest(test.id, [childId]);
      }

      res.json({ 
        success: true, 
        testId: test.id,
        message: childId ? 'Test created and assigned' : 'Test created successfully'
      });
    } catch (error) {
      console.error('Save AI Test Error:', error);
      next(error);
    }
  });

  // Score an AI-generated test and get recommendations
  app.post("/api/ai-tests/score", requireAuth, async (req, res, next) => {
    try {
      // Validate request body
      const parseResult = aiTestScoreSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: (parseResult.error.issues?.[0]?.message ?? parseResult.error.errors?.[0]?.message ?? "Validation failed") });
      }
      
      const { questions, answers, childId, subject } = parseResult.data;

      // Convert string answers to number keys for scoreTest
      const numericAnswers: Record<number, string> = {};
      Object.entries(answers).forEach(([key, value]) => {
        numericAnswers[parseInt(key)] = value;
      });

      // Score the test
      const scoreResult = await scoreTest({ questions: questions as any, answers: numericAnswers });

      // Get personalized recommendations if childId provided
      let personalizedRecommendations = scoreResult.recommendations;
      if (childId) {
        // Verify parent owns this child FIRST before any queries
        const child = await storage.getChild(childId, req.user!.id);
        
        // Only proceed if child exists and is owned by this parent
        if (child) {
          // Get LBI insights only after ownership is verified
          const insightsResult = await db.execute(sql`
            SELECT category, value, description FROM behavioural_insights 
            WHERE student_id = ${childId}
            ORDER BY recorded_at DESC
          `);
          const insights = (insightsResult.rows as any[]) || [];
          const lbiInsights: LBIInsight[] = insights.map((i: any) => ({
            category: i.category,
            score: i.value || 5,
            interpretation: i.description || 'Average',
          }));

          personalizedRecommendations = await generatePersonalizedRecommendations(
            child.name,
            subject || 'General',
            scoreResult,
            lbiInsights
          );
        }
        // If child not owned, we just skip personalization - no error needed since scoring still works
      }

      res.json({
        ...scoreResult,
        recommendations: personalizedRecommendations,
      });
    } catch (error) {
      console.error('Score Test Error:', error);
      next(error);
    }
  });

  // Get AI test generation history for a child
  app.get("/api/ai-tests/history/:childId", requireAuth, async (req, res, next) => {
    try {
      const { childId } = req.params;
      
      // Verify parent owns this child (authorization check)
      const child = await storage.getChild(childId, req.user!.id);
      if (!child) {
        return res.status(404).json({ error: 'Child not found or access denied' });
      }
      
      // Get test assignments for this child with test details (with parent ownership verification)
      const assignmentsResult = await db.execute(sql`
        SELECT pta.*, pt.title, pt.subject, pt.questions, pt.total_marks
        FROM parent_test_assignments pta
        JOIN parent_tests pt ON pta.test_id = pt.id
        JOIN children c ON pta.child_id = c.id
        WHERE pta.child_id = ${childId} AND c.parent_id = ${req.user!.id}
        ORDER BY pta.created_at DESC
      `);
      
      // Filter for AI-generated tests
      const aiTests = ((assignmentsResult.rows as any[]) || []).filter((a: any) => {
        try {
          const questions = JSON.parse(a.questions || '[]');
          return questions.some((q: any) => q.isAIGenerated);
        } catch {
          return false;
        }
      });

      res.json(aiTests);
    } catch (error) {
      next(error);
    }
  });

  // Student: Get assigned tests
  app.get("/api/student/assigned-tests", requireAuth, async (req, res, next) => {
    try {
      const tests = await storage.getStudentAssignedTests(req.user!.id);
      res.json(tests);
    } catch (error) {
      next(error);
    }
  });

  // Student: Start test attempt
  app.post("/api/student/tests/:assignmentId/start", requireAuth, async (req, res, next) => {
    try {
      const attempt = await storage.startTestAttempt(req.params.assignmentId, req.user!.id);
      res.json(attempt);
    } catch (error) {
      next(error);
    }
  });

  // Student: Submit test answers
  app.post("/api/student/tests/:assignmentId/submit", requireAuth, async (req, res, next) => {
    try {
      const { answers } = req.body;
      
      // Get the test and its questions
      const assignment = await storage.getTestAssignment(req.params.assignmentId);
      if (!assignment) {
        return res.status(404).json({ error: 'Assignment not found' });
      }
      
      const test = await storage.getParentTestById(assignment.testId);
      if (!test) {
        return res.status(404).json({ error: 'Test not found' });
      }
      
      const questions = JSON.parse(test.questions as string);
      
      // Auto-grade the test
      let marksObtained = 0;
      let correctAnswers = 0;
      let incorrectAnswers = 0;
      const questionResults: any[] = [];
      
      questions.forEach((q: any, index: number) => {
        const studentAnswer = answers[q.id] || answers[index] || '';
        const isCorrect = studentAnswer.toLowerCase().trim() === q.correctAnswer.toLowerCase().trim();
        
        if (isCorrect) {
          marksObtained += q.marks || 1;
          correctAnswers++;
        } else {
          incorrectAnswers++;
        }
        
        questionResults.push({
          questionId: q.id,
          studentAnswer,
          correctAnswer: q.correctAnswer,
          isCorrect,
          marks: isCorrect ? (q.marks || 1) : 0,
          maxMarks: q.marks || 1
        });
      });
      
      const score = Math.round((marksObtained / test.totalMarks) * 100);
      
      // Save the attempt result
      const result = await storage.submitParentTestAttempt(req.params.assignmentId, {
        studentId: req.user!.id,
        answers: JSON.stringify(answers),
        marksObtained,
        totalMarks: test.totalMarks,
        score,
        correctAnswers,
        incorrectAnswers,
        questionResults: JSON.stringify(questionResults),
        completedAt: new Date()
      });
      
      // Return only marks to student (not detailed analysis)
      res.json({
        score,
        marksObtained,
        totalMarks: test.totalMarks,
        message: score >= 70 ? 'Great job!' : score >= 50 ? 'Good effort!' : 'Keep practicing!'
      });
    } catch (error) {
      next(error);
    }
  });

  // Student: Get test result (marks only, no detailed analytics)
  app.get("/api/student/tests/:assignmentId/result", requireAuth, async (req, res, next) => {
    try {
      const result = await storage.getStudentTestResult(req.params.assignmentId, req.user!.id);
      if (!result) {
        return res.status(404).json({ error: 'Result not found' });
      }
      
      // Return only marks and summary to student (no question-wise breakdown)
      res.json({
        score: result.score,
        marksObtained: result.marksObtained,
        totalMarks: result.totalMarks,
        correctAnswers: result.correctAnswers,
        incorrectAnswers: result.incorrectAnswers,
        completedAt: result.completedAt
      });
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // HR & RECRUITMENT ORCHESTRATION API
  // ============================================

  // HR Dashboard Stats
  app.get("/api/hr/dashboard/stats", requireAuth, async (req, res, next) => {
    try {
      const stats = await storage.getHrDashboardStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  // Job Posting Routes
  app.get("/api/hr/jobs", requireAuth, async (req, res, next) => {
    try {
      const { status, roleCategory } = req.query;
      const jobs = await storage.getAllJobPostings({
        status: status as string,
        roleCategory: roleCategory as string
      });
      res.json(jobs);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/hr/jobs/published", async (req, res, next) => {
    try {
      const jobs = await storage.getPublishedJobs();
      res.json(jobs);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/hr/jobs/:id", async (req, res, next) => {
    try {
      const job = await storage.getJobPosting(req.params.id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/hr/jobs", requireAuth, async (req, res, next) => {
    try {
      const job = await storage.createJobPosting({
        ...req.body,
        createdBy: req.user!.id,
        status: 'draft'
      });
      
      await storage.createHrAuditLog({
        actorUserId: req.user!.id,
        actionType: 'job_created',
        targetType: 'job',
        targetId: job.id,
        newState: JSON.stringify(job)
      });
      
      res.status(201).json(job);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/hr/jobs/:id", requireAuth, async (req, res, next) => {
    try {
      const existingJob = await storage.getJobPosting(req.params.id);
      if (!existingJob) {
        return res.status(404).json({ message: "Job not found" });
      }

      const job = await storage.updateJobPosting(req.params.id, req.body);
      
      await storage.createHrAuditLog({
        actorUserId: req.user!.id,
        actionType: 'job_updated',
        targetType: 'job',
        targetId: job.id,
        previousState: JSON.stringify(existingJob),
        newState: JSON.stringify(job)
      });
      
      res.json(job);
    } catch (error) {
      next(error);
    }
  });

  // Job Approval Workflow
  app.post("/api/hr/jobs/:id/submit-for-review", requireAuth, async (req, res, next) => {
    try {
      const job = await storage.updateJobStatus(req.params.id, 'hr_review');
      
      await storage.createHrAuditLog({
        actorUserId: req.user!.id,
        actionType: 'job_submitted_for_review',
        targetType: 'job',
        targetId: job.id,
        notes: 'Job submitted for HR review'
      });
      
      res.json(job);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/hr/jobs/:id/hr-review", requireAuth, async (req, res, next) => {
    try {
      const { approved, notes } = req.body;
      const newStatus = approved ? 'legal_review' : 'draft';
      
      const job = await storage.updateJobStatus(req.params.id, newStatus, {
        reviewBy: req.user!.id,
        notes,
        reviewType: 'hr'
      });
      
      await storage.createHrAuditLog({
        actorUserId: req.user!.id,
        actionType: approved ? 'hr_review_approved' : 'hr_review_rejected',
        targetType: 'job',
        targetId: job.id,
        notes
      });
      
      res.json(job);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/hr/jobs/:id/legal-review", requireAuth, async (req, res, next) => {
    try {
      const { approved, notes } = req.body;
      const newStatus = approved ? 'leadership_approval' : 'hr_review';
      
      const job = await storage.updateJobStatus(req.params.id, newStatus, {
        reviewBy: req.user!.id,
        notes,
        reviewType: 'legal'
      });
      
      await storage.createHrAuditLog({
        actorUserId: req.user!.id,
        actionType: approved ? 'legal_review_approved' : 'legal_review_rejected',
        targetType: 'job',
        targetId: job.id,
        notes
      });
      
      res.json(job);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/hr/jobs/:id/leadership-approval", requireAuth, async (req, res, next) => {
    try {
      const { approved, notes } = req.body;
      const newStatus = approved ? 'approved' : 'legal_review';
      
      const job = await storage.updateJobStatus(req.params.id, newStatus, {
        reviewBy: req.user!.id,
        notes,
        reviewType: 'leadership'
      });
      
      await storage.createHrAuditLog({
        actorUserId: req.user!.id,
        actionType: approved ? 'leadership_approved' : 'leadership_rejected',
        targetType: 'job',
        targetId: job.id,
        notes
      });
      
      res.json(job);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/hr/jobs/:id/publish", requireAuth, async (req, res, next) => {
    try {
      const existingJob = await storage.getJobPosting(req.params.id);
      if (!existingJob || existingJob.status !== 'approved') {
        return res.status(400).json({ message: "Job must be approved before publishing" });
      }

      const job = await storage.updateJobStatus(req.params.id, 'published');
      
      // Create distribution entries for all channels
      const channels = ['metryx_careers', 'linkedin', 'indeed', 'naukri', 'internshala', 'google_jobs'];
      for (const channel of channels) {
        await storage.createJobDistribution({
          jobId: job.id,
          channel,
          status: 'pending'
        });
      }
      
      await storage.createHrAuditLog({
        actorUserId: req.user!.id,
        actionType: 'job_published',
        targetType: 'job',
        targetId: job.id
      });
      
      res.json(job);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/hr/jobs/:id/close", requireAuth, async (req, res, next) => {
    try {
      const job = await storage.updateJobStatus(req.params.id, 'closed');
      
      await storage.createHrAuditLog({
        actorUserId: req.user!.id,
        actionType: 'job_closed',
        targetType: 'job',
        targetId: job.id
      });
      
      res.json(job);
    } catch (error) {
      next(error);
    }
  });

  // Job Application Routes
  app.get("/api/hr/applications", requireAuth, async (req, res, next) => {
    try {
      const { jobId } = req.query;
      if (jobId) {
        const applications = await storage.getJobApplicationsByJob(jobId as string);
        return res.json(applications);
      }
      const stats = await storage.getApplicationStats();
      res.json({ stats });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/hr/applications/my", requireAuth, async (req, res, next) => {
    try {
      const applications = await storage.getJobApplicationsByUser(req.user!.id);
      res.json(applications);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/hr/applications/:id", requireAuth, async (req, res, next) => {
    try {
      const application = await storage.getJobApplication(req.params.id);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }
      res.json(application);
    } catch (error) {
      next(error);
    }
  });

  // Public job application endpoint (no auth required for public careers page)
  app.post("/api/hr/applications/public", async (req, res, next) => {
    try {
      const { jobId, fullName, email, phone, coverLetter, consentCaptured, sourceChannel } = req.body;
      
      if (!jobId || !fullName || !email || !phone) {
        return res.status(400).json({ message: "Missing required fields: jobId, fullName, email, phone" });
      }
      
      if (!consentCaptured) {
        return res.status(400).json({ message: "Consent is required to submit an application" });
      }

      // Create a temporary user for the applicant or use anonymous
      const application = await storage.createJobApplication({
        jobId,
        applicantUserId: 'anonymous',
        fullName,
        email,
        phone,
        coverLetter,
        sourceChannel: sourceChannel || 'metryx_careers',
        consentCaptured: true,
        consentCapturedAt: new Date(),
        status: 'applied'
      });

      // Log consent
      await storage.createHrConsentLog({
        userId: 'anonymous',
        consentType: 'registration',
        consentText: 'I consent to MetryxOne processing my application data and agree to the terms of engagement.',
        consentGiven: true,
        consentedAt: new Date(),
        ipAddress: req.ip
      });

      await storage.createHrAuditLog({
        actorUserId: null,
        actionType: 'application_submitted_public',
        targetType: 'application',
        targetId: application.id,
        notes: `Public application from ${email}`
      });
      
      res.status(201).json({ id: application.id, status: 'applied', message: 'Application submitted successfully' });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/hr/applications", requireAuth, async (req, res, next) => {
    try {
      const application = await storage.createJobApplication({
        ...req.body,
        applicantUserId: req.user!.id,
        status: 'applied'
      });
      
      await storage.createHrAuditLog({
        actorUserId: req.user!.id,
        actionType: 'application_submitted',
        targetType: 'application',
        targetId: application.id
      });
      
      res.status(201).json(application);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/hr/applications/:id/status", requireAuth, async (req, res, next) => {
    try {
      const { status, rejectionReason } = req.body;
      
      const application = await storage.updateJobApplication(req.params.id, {
        status,
        rejectionReason,
        processedBy: req.user!.id,
        processedAt: new Date()
      });
      
      await storage.createHrAuditLog({
        actorUserId: req.user!.id,
        actionType: `application_${status}`,
        targetType: 'application',
        targetId: application.id,
        notes: rejectionReason
      });
      
      res.json(application);
    } catch (error) {
      next(error);
    }
  });

  // Mentor Routes
  app.get("/api/hr/mentors", requireAuth, async (req, res, next) => {
    try {
      const { status } = req.query;
      const mentorsList = await storage.getAllMentors({ status: status as string });
      res.json(mentorsList);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/hr/mentors/at-risk", requireAuth, async (req, res, next) => {
    try {
      const mentorsList = await storage.getMentorsAtRisk();
      res.json(mentorsList);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/hr/mentors/stats", requireAuth, async (req, res, next) => {
    try {
      const stats = await storage.getMentorStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/hr/mentors/:id", requireAuth, async (req, res, next) => {
    try {
      const mentor = await storage.getMentor(req.params.id);
      if (!mentor) {
        return res.status(404).json({ message: "Mentor not found" });
      }
      res.json(mentor);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/hr/mentors/:id/kpis", requireAuth, async (req, res, next) => {
    try {
      const kpis = await storage.getMentorKpis(req.params.id);
      res.json(kpis);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/hr/mentors/:id/payouts", requireAuth, async (req, res, next) => {
    try {
      const payouts = await storage.getMentorPayouts(req.params.id);
      res.json(payouts);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/hr/mentors/:id/status", requireAuth, async (req, res, next) => {
    try {
      const { status, reason } = req.body;
      const updateData: any = { status };
      
      if (status === 'warning') {
        updateData.warningIssuedAt = new Date();
        updateData.warningReason = reason;
      } else if (status === 'suspended') {
        updateData.suspendedAt = new Date();
        updateData.suspensionReason = reason;
      } else if (status === 'deactivated') {
        updateData.deactivatedAt = new Date();
        updateData.deactivationReason = reason;
      } else if (status === 'active') {
        updateData.activatedAt = new Date();
      }
      
      const mentor = await storage.updateMentor(req.params.id, updateData);
      
      await storage.createHrAuditLog({
        actorUserId: req.user!.id,
        actionType: `mentor_${status}`,
        targetType: 'mentor',
        targetId: mentor.id,
        notes: reason
      });
      
      res.json(mentor);
    } catch (error) {
      next(error);
    }
  });

  // Training Routes
  app.get("/api/hr/training/programs", requireAuth, async (req, res, next) => {
    try {
      const programs = await storage.getActiveTrainingPrograms();
      res.json(programs);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/hr/training/enroll", requireAuth, async (req, res, next) => {
    try {
      const { mentorId, programId } = req.body;
      
      const enrollment = await storage.createTrainingEnrollment({
        mentorId,
        programId,
        status: 'enrolled'
      });
      
      // Update mentor status to training
      await storage.updateMentor(mentorId, { status: 'training' });
      
      await storage.createHrAuditLog({
        actorUserId: req.user!.id,
        actionType: 'training_enrolled',
        targetType: 'training',
        targetId: enrollment.id,
        notes: `Mentor enrolled in training program`
      });
      
      res.status(201).json(enrollment);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/hr/training/enrollments/:id", requireAuth, async (req, res, next) => {
    try {
      const enrollment = await storage.updateTrainingEnrollment(req.params.id, req.body);
      
      // If training completed successfully, update mentor status
      if (enrollment.status === 'completed' && enrollment.assessmentScore && enrollment.assessmentScore >= 70) {
        const existingEnrollment = await storage.getTrainingEnrollment(req.params.id);
        if (existingEnrollment) {
          await storage.updateMentor(existingEnrollment.mentorId, { 
            status: 'active',
            activatedAt: new Date()
          });
        }
      }
      
      res.json(enrollment);
    } catch (error) {
      next(error);
    }
  });

  // Compliance Routes
  app.get("/api/hr/compliance/violations", requireAuth, async (req, res, next) => {
    try {
      const violations = await storage.getPendingViolations();
      res.json(violations);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/hr/compliance/violations", requireAuth, async (req, res, next) => {
    try {
      const violation = await storage.createComplianceViolation({
        ...req.body,
        reportedBy: req.user!.id,
        status: 'reported'
      });
      
      await storage.createHrAuditLog({
        actorUserId: req.user!.id,
        actionType: 'violation_reported',
        targetType: 'violation',
        targetId: violation.id
      });
      
      res.status(201).json(violation);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/hr/compliance/violations/:id", requireAuth, async (req, res, next) => {
    try {
      const { status, resolution, actionTaken } = req.body;
      
      const violation = await storage.updateComplianceViolation(req.params.id, {
        status,
        resolution,
        actionTaken,
        resolvedBy: status === 'resolved' ? req.user!.id : undefined,
        resolvedAt: status === 'resolved' ? new Date() : undefined
      });
      
      await storage.createHrAuditLog({
        actorUserId: req.user!.id,
        actionType: `violation_${status}`,
        targetType: 'violation',
        targetId: violation.id,
        notes: resolution
      });
      
      res.json(violation);
    } catch (error) {
      next(error);
    }
  });

  // Payout Routes
  app.get("/api/hr/payouts/pending", requireAuth, async (req, res, next) => {
    try {
      const payouts = await storage.getPendingPayouts();
      res.json(payouts);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/hr/payouts/:id/approve", requireAuth, async (req, res, next) => {
    try {
      const payout = await storage.updateMentorPayout(req.params.id, {
        status: 'approved',
        approvedBy: req.user!.id,
        approvedAt: new Date()
      });
      
      await storage.createHrAuditLog({
        actorUserId: req.user!.id,
        actionType: 'payout_approved',
        targetType: 'payout',
        targetId: payout.id
      });
      
      res.json(payout);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/hr/payouts/:id/block", requireAuth, async (req, res, next) => {
    try {
      const { reason } = req.body;
      
      const payout = await storage.updateMentorPayout(req.params.id, {
        status: 'blocked',
        blockedReason: reason
      });
      
      await storage.createHrAuditLog({
        actorUserId: req.user!.id,
        actionType: 'payout_blocked',
        targetType: 'payout',
        targetId: payout.id,
        notes: reason
      });
      
      res.json(payout);
    } catch (error) {
      next(error);
    }
  });

  // White-Label Partner Routes
  app.get("/api/hr/partners", requireAuth, async (req, res, next) => {
    try {
      const partners = await storage.getAllWhiteLabelPartners();
      res.json(partners);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/hr/partners", requireAuth, async (req, res, next) => {
    try {
      const partner = await storage.createWhiteLabelPartner(req.body);
      
      await storage.createHrAuditLog({
        actorUserId: req.user!.id,
        actionType: 'partner_created',
        targetType: 'partner',
        targetId: partner.id
      });
      
      res.status(201).json(partner);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/hr/partners/:id", requireAuth, async (req, res, next) => {
    try {
      const partner = await storage.updateWhiteLabelPartner(req.params.id, req.body);
      
      await storage.createHrAuditLog({
        actorUserId: req.user!.id,
        actionType: 'partner_updated',
        targetType: 'partner',
        targetId: partner.id
      });
      
      res.json(partner);
    } catch (error) {
      next(error);
    }
  });

  // HR Consent Routes
  app.post("/api/hr/consent", requireAuth, async (req, res, next) => {
    try {
      const consent = await storage.createHrConsentLog({
        ...req.body,
        userId: req.user!.id,
        consentGiven: true,
        consentedAt: new Date()
      });
      res.status(201).json(consent);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/hr/consent/my", requireAuth, async (req, res, next) => {
    try {
      const consents = await storage.getUserConsentLogs(req.user!.id);
      res.json(consents);
    } catch (error) {
      next(error);
    }
  });

  // HR Audit Logs
  app.get("/api/hr/audit-logs", requireAuth, async (req, res, next) => {
    try {
      const { targetType, targetId, limit } = req.query;
      const logs = await storage.getHrAuditLogs({
        targetType: targetType as string,
        targetId: targetId as string,
        limit: limit ? parseInt(limit as string) : 100
      });
      res.json(logs);
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // SUPER ADMIN / PLATFORM MANAGEMENT ROUTES
  // ============================================

  // Middleware to check if user is super_admin
  const requireSuperAdmin = (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const roles = req.user.roles || [];
    if (!roles.includes('super_admin') && req.user.role !== 'super_admin') {
      return res.status(403).json({ message: "Super admin access required" });
    }
    next();
  };

  // ── Secure reverse-proxy: /api/v1/upload/* → FastAPI bulk-upload service ──────
  // The FastAPI service (backend-main, port 8000) is published externally per
  // .replit, so its /admin/* bulk-upload endpoints are reachable directly on the
  // public internet. That service now requires a shared secret
  // (X-Upload-Service-Token) and this proxy is the ONLY caller that holds it.
  // We therefore gate the proxy with requireAuth → requireSuperAdmin FIRST and
  // only THEN inject the secret, so Express never authenticates an
  // unauthenticated caller into the upload service. CSRF (mounted in index.ts)
  // still applies ahead of this. Mounted here, after requireSuperAdmin exists.
  const FASTAPI_UPLOAD_URL = process.env.FASTAPI_URL || "http://localhost:8000";
  const UPLOAD_SERVICE_TOKEN =
    process.env.UPLOAD_SERVICE_TOKEN ||
    (process.env.NODE_ENV === "production"
      ? "" // prod: no well-known default — operator must set the secret on both services
      : "dev-only-upload-token-do-not-use-in-production"); // must match backend-main/app/security.py
  app.use(
    "/api/v1/upload",
    requireAuth,
    requireSuperAdmin,
    createProxyMiddleware({
      target: FASTAPI_UPLOAD_URL,
      changeOrigin: true,
      pathRewrite: (path: string) => path.replace(/^\/api\/v1\/upload/, "") || "/",
      headers: UPLOAD_SERVICE_TOKEN ? { "x-upload-service-token": UPLOAD_SERVICE_TOKEN } : {},
      logLevel: "warn",
    } as any),
  );

  // ============================================================
  // F3 — Authoritative admin authorization gate (defence-in-depth)
  // ------------------------------------------------------------
  // Every /api/admin/* route is super-admin only. Historically this was
  // enforced per-route, so any handler that forgot its inline guard (e.g. the
  // PAIE engine admin routes, F1) was left open. This single mount guards the
  // ENTIRE admin surface registered below it, so a missing inline guard can no
  // longer expose a route.
  //
  // Ordering: mounted here (after requireSuperAdmin is defined) so it sits in
  // the middleware stack BEFORE the bulk of admin routes (registered later).
  // The pre-login MFA routes (/api/admin/mfa/verify, /api/admin/mfa/resend) are
  // registered EARLIER in the stack and so are intentionally unaffected.
  //
  // Exemption: /api/admin/lbi-catalog intentionally allows any authenticated
  // user (not only super_admin); its own requireAuth still applies.
  app.use('/api/admin', (req: any, res: any, next: any) => {
    if (req.path === '/lbi-catalog' || req.path === '/lbi-catalog/') return next();
    requireAuth(req, res, () => requireSuperAdmin(req, res, next));
  });

  // STEP 11b — Structural per-framework admin gate.
  //
  // The /api/admin gate above only covers the literal /api/admin/* prefix.
  // Admin endpoints living under per-framework prefixes (/api/lbi/admin,
  // /api/sdi/admin, /api/competency/admin, /api/commercial/admin,
  // /api/concerns/admin, /api/invoice/admin, /api/short-assessments/admin) and
  // a few admin-only reads outside an /admin segment previously relied SOLELY on
  // per-route inline guards — so a new sub-route that forgot its guard would
  // ship public (the recurring "per-framework admin gap").
  //
  // This mount sits in the middleware stack BEFORE every framework route module
  // (all registered far below) and so closes that whole class of bug
  // structurally: any classified admin path must pass
  // requireAuth → requireSuperAdmin regardless of whether its handler remembered
  // its inline guards. The classification (incl. intentionally-public exempt
  // reads) is the SINGLE shared source of truth in lib/admin-path-gate.ts, also
  // consumed by tests/admin-auth-guard.test.ts so the two can never drift.
  // req.path here is mount-relative to /api (e.g. '/lbi/admin/foo').
  app.use('/api', (req: any, res: any, next: any) => {
    if (!isFrameworkAdminPath(req.path)) return next();
    requireAuth(req, res, () => requireSuperAdmin(req, res, next));
  });

  // STEP 12 — Global admin audit middleware (visibility-only). Records mutating
  // admin actions into audit_logs on response 'finish' (fire-and-forget,
  // never-throws, never alters the response or its latency). Mounted AFTER the
  // gate so req.user is populated; reads of /api/admin/security/* are GETs and
  // are therefore never recorded.
  app.use('/api/admin', createAdminAuditMiddleware(concernsPool));

  // Seed Education Data - Major Indian Boards, Classes, Subjects
  app.post("/api/admin/seed-education-data", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      // Major Indian Education Boards
      const boardsData = [
        { boardCode: 'CBSE', boardName: 'Central Board of Secondary Education', description: 'National board for secondary and senior secondary education', country: 'India', status: 'Active' },
        { boardCode: 'ICSE', boardName: 'Indian Certificate of Secondary Education', description: 'Private board of school education in India', country: 'India', status: 'Active' },
        { boardCode: 'ISC', boardName: 'Indian School Certificate', description: 'Class 11-12 under CISCE', country: 'India', status: 'Active' },
        { boardCode: 'MAHA', boardName: 'Maharashtra State Board', description: 'Maharashtra SSC/HSC Board', country: 'India', status: 'Active' },
        { boardCode: 'KARN', boardName: 'Karnataka State Board', description: 'Karnataka SSLC/PUC Board', country: 'India', status: 'Active' },
        { boardCode: 'TN', boardName: 'Tamil Nadu State Board', description: 'Tamil Nadu SSLC/HSC Board', country: 'India', status: 'Active' },
        { boardCode: 'UP', boardName: 'Uttar Pradesh Board', description: 'UP Board of High School and Intermediate Education', country: 'India', status: 'Active' },
        { boardCode: 'WB', boardName: 'West Bengal Board', description: 'West Bengal Board of Secondary Education', country: 'India', status: 'Active' },
        { boardCode: 'RAJ', boardName: 'Rajasthan Board', description: 'Board of Secondary Education, Rajasthan', country: 'India', status: 'Active' },
        { boardCode: 'AP', boardName: 'Andhra Pradesh Board', description: 'AP Board of Intermediate Education', country: 'India', status: 'Active' },
        { boardCode: 'TEL', boardName: 'Telangana Board', description: 'Telangana State Board of Intermediate Education', country: 'India', status: 'Active' },
        { boardCode: 'GUJ', boardName: 'Gujarat Board', description: 'Gujarat Secondary and Higher Secondary Education Board', country: 'India', status: 'Active' },
        { boardCode: 'MP', boardName: 'Madhya Pradesh Board', description: 'MP Board of Secondary Education', country: 'India', status: 'Active' },
        { boardCode: 'KER', boardName: 'Kerala Board', description: 'Kerala Board of Public Examinations', country: 'India', status: 'Active' },
        { boardCode: 'BIH', boardName: 'Bihar Board', description: 'Bihar School Examination Board', country: 'India', status: 'Active' },
        { boardCode: 'NIOS', boardName: 'National Institute of Open Schooling', description: 'Open schooling for flexible education', country: 'India', status: 'Active' },
        { boardCode: 'IB', boardName: 'International Baccalaureate', description: 'International education foundation', country: 'International', status: 'Active' },
        { boardCode: 'IGCSE', boardName: 'Cambridge IGCSE', description: 'Cambridge Assessment International Education', country: 'International', status: 'Active' },
      ];

      const createdBoards: any[] = [];
      for (const board of boardsData) {
        try {
          const existing = await db.select().from(educationBoards).where(eq(educationBoards.boardCode, board.boardCode)).limit(1);
          if (existing.length === 0) {
            const [created] = await db.insert(educationBoards).values(board).returning();
            createdBoards.push(created);
          } else {
            createdBoards.push(existing[0]);
          }
        } catch (e) { /* skip duplicates */ }
      }

      // Classes 1-12 for major boards
      const classNames = [
        { num: 1, name: 'Class 1 (I)' }, { num: 2, name: 'Class 2 (II)' }, { num: 3, name: 'Class 3 (III)' },
        { num: 4, name: 'Class 4 (IV)' }, { num: 5, name: 'Class 5 (V)' }, { num: 6, name: 'Class 6 (VI)' },
        { num: 7, name: 'Class 7 (VII)' }, { num: 8, name: 'Class 8 (VIII)' }, { num: 9, name: 'Class 9 (IX)' },
        { num: 10, name: 'Class 10 (X)' }, { num: 11, name: 'Class 11 (XI)' }, { num: 12, name: 'Class 12 (XII)' }
      ];

      const createdClasses: any[] = [];
      for (const board of createdBoards) {
        for (const cls of classNames) {
          try {
            const existing = await db.select().from(academicClasses)
              .where(and(eq(academicClasses.boardId, board.id), eq(academicClasses.classNumber, cls.num)))
              .limit(1);
            if (existing.length === 0) {
              const [created] = await db.insert(academicClasses).values({
                boardId: board.id,
                classNumber: cls.num,
                className: cls.name,
                displayOrder: cls.num,
                status: 'Active'
              }).returning();
              createdClasses.push(created);
            } else {
              createdClasses.push(existing[0]);
            }
          } catch (e) { /* skip */ }
        }
      }

      // Core subjects for primary (1-5), middle (6-8), secondary (9-10), senior secondary (11-12)
      const subjectsByLevel = {
        primary: ['English', 'Hindi', 'Mathematics', 'Environmental Studies', 'General Knowledge'],
        middle: ['English', 'Hindi', 'Mathematics', 'Science', 'Social Science', 'Sanskrit', 'Computer Science'],
        secondary: ['English', 'Hindi', 'Mathematics', 'Science', 'Social Science', 'Sanskrit', 'Information Technology', 'Physical Education'],
        seniorScience: ['English', 'Physics', 'Chemistry', 'Mathematics', 'Biology', 'Computer Science', 'Physical Education', 'Economics'],
        seniorCommerce: ['English', 'Accountancy', 'Business Studies', 'Economics', 'Mathematics', 'Informatics Practices', 'Physical Education'],
        seniorArts: ['English', 'Hindi', 'History', 'Political Science', 'Geography', 'Economics', 'Psychology', 'Sociology', 'Physical Education']
      };

      let subjectCount = 0;
      for (const classObj of createdClasses) {
        let subjects: string[] = [];
        if (classObj.classNumber <= 5) subjects = subjectsByLevel.primary;
        else if (classObj.classNumber <= 8) subjects = subjectsByLevel.middle;
        else if (classObj.classNumber <= 10) subjects = subjectsByLevel.secondary;
        else subjects = [...subjectsByLevel.seniorScience, ...subjectsByLevel.seniorCommerce.filter(s => !subjectsByLevel.seniorScience.includes(s))];

        const board = createdBoards.find(b => b.id === classObj.boardId);
        for (let i = 0; i < subjects.length; i++) {
          const subjectCode = `${board?.boardCode || 'GEN'}-${classObj.classNumber}-${subjects[i].replace(/\s+/g, '').toUpperCase().slice(0, 4)}`;
          try {
            const existing = await db.select().from(academicSubjects)
              .where(and(eq(academicSubjects.classId, classObj.id), eq(academicSubjects.subjectName, subjects[i])))
              .limit(1);
            if (existing.length === 0) {
              await db.insert(academicSubjects).values({
                boardId: classObj.boardId,
                classId: classObj.id,
                subjectCode,
                subjectName: subjects[i],
                subjectType: ['English', 'Hindi', 'Mathematics', 'Science', 'Physics', 'Chemistry', 'Biology'].includes(subjects[i]) ? 'Core' : 'Elective',
                displayOrder: i + 1,
                status: 'Active'
              });
              subjectCount++;
            }
          } catch (e) { /* skip */ }
        }
      }

      res.json({ 
        message: 'Education data seeded successfully',
        boards: createdBoards.length,
        classes: createdClasses.length,
        subjects: subjectCount
      });
    } catch (error) {
      next(error);
    }
  });

  // Download Curriculum CSV Template
  app.get("/api/admin/curriculum/template", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const headers = [
        'boardCode', 'boardName', 'classNumber', 'className', 'subjectCode', 'subjectName',
        'subjectType', 'chapterNumber', 'chapterName', 'topicNumber', 'topicName'
      ];
      
      const sampleRows = [
        ['CBSE', 'Central Board of Secondary Education', '10', 'Class 10 (X)', 'CBSE-10-MATH', 'Mathematics', 'Core', '1', 'Real Numbers', '1', 'Euclid Division Lemma'],
        ['CBSE', 'Central Board of Secondary Education', '10', 'Class 10 (X)', 'CBSE-10-MATH', 'Mathematics', 'Core', '1', 'Real Numbers', '2', 'Fundamental Theorem of Arithmetic'],
        ['CBSE', 'Central Board of Secondary Education', '10', 'Class 10 (X)', 'CBSE-10-SCI', 'Science', 'Core', '1', 'Chemical Reactions', '1', 'Types of Chemical Reactions'],
        ['ICSE', 'Indian Certificate of Secondary Education', '9', 'Class 9 (IX)', 'ICSE-9-PHY', 'Physics', 'Core', '1', 'Measurements', '1', 'Units and Dimensions'],
      ];
      
      const csvContent = [
        headers.join(','),
        ...sampleRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');
      
      const instructions = `
# Curriculum Import Template
# 
# Instructions:
# 1. Fill in curriculum data starting from row 2
# 2. boardCode - Unique code for the board (e.g., CBSE, ICSE, MAHA)
# 3. boardName - Full name of the board
# 4. classNumber - Class number (1-12)
# 5. className - Display name (e.g., "Class 10 (X)")
# 6. subjectCode - Unique subject code (e.g., CBSE-10-MATH)
# 7. subjectName - Subject name (e.g., Mathematics)
# 8. subjectType - Core or Elective
# 9. chapterNumber - Chapter number within subject
# 10. chapterName - Chapter title
# 11. topicNumber - Topic number within chapter
# 12. topicName - Topic title
#
# Notes:
# - Boards will be auto-created if they don't exist
# - Classes will be created under the specified board
# - Chapters and topics are optional (leave blank to skip)
# - Duplicate rows will be skipped
`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="curriculum_template.csv"');
      res.send(csvContent + '\n' + instructions);
    } catch (error) {
      next(error);
    }
  });

  // Import Curriculum from CSV
  app.post("/api/admin/curriculum/import", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { rows } = req.body; // Array of curriculum row objects
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ message: 'No curriculum data provided' });
      }

      const results = { boards: 0, classes: 0, subjects: 0, chapters: 0, topics: 0, errors: [] as { row: number; error: string }[] };
      const boardCache = new Map<string, string>();
      const classCache = new Map<string, string>();
      const subjectCache = new Map<string, string>();
      const chapterCache = new Map<string, string>();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          // 1. Get or create board
          let boardId = boardCache.get(row.boardCode);
          if (!boardId) {
            const existing = await db.select().from(educationBoards).where(eq(educationBoards.boardCode, row.boardCode)).limit(1);
            if (existing.length > 0) {
              boardId = existing[0].id;
            } else {
              const [created] = await db.insert(educationBoards).values({
                boardCode: row.boardCode,
                boardName: row.boardName || row.boardCode,
                status: 'Active'
              }).returning();
              boardId = created.id;
              results.boards++;
            }
            boardCache.set(row.boardCode, boardId);
          }

          // 2. Get or create class
          const classKey = `${row.boardCode}-${row.classNumber}`;
          let classId = classCache.get(classKey);
          if (!classId && row.classNumber) {
            const classNum = parseInt(row.classNumber);
            const existing = await db.select().from(academicClasses)
              .where(and(eq(academicClasses.boardId, boardId), eq(academicClasses.classNumber, classNum)))
              .limit(1);
            if (existing.length > 0) {
              classId = existing[0].id;
            } else {
              const [created] = await db.insert(academicClasses).values({
                boardId,
                classNumber: classNum,
                className: row.className || `Class ${classNum}`,
                displayOrder: classNum,
                status: 'Active'
              }).returning();
              classId = created.id;
              results.classes++;
            }
            classCache.set(classKey, classId);
          }

          // 3. Get or create subject
          const subjectKey = `${classKey}-${row.subjectCode}`;
          let subjectId = subjectCache.get(subjectKey);
          if (!subjectId && classId && row.subjectCode) {
            const existing = await db.select().from(academicSubjects)
              .where(and(eq(academicSubjects.classId, classId), eq(academicSubjects.subjectCode, row.subjectCode)))
              .limit(1);
            if (existing.length > 0) {
              subjectId = existing[0].id;
            } else {
              const [created] = await db.insert(academicSubjects).values({
                boardId,
                classId,
                subjectCode: row.subjectCode,
                subjectName: row.subjectName || 'Unknown Subject',
                subjectType: row.subjectType || 'Core',
                displayOrder: 1,
                status: 'Active'
              }).returning();
              subjectId = created.id;
              results.subjects++;
            }
            subjectCache.set(subjectKey, subjectId);
          }

          // 4. Get or create chapter
          const chapterKey = `${subjectKey}-${row.chapterNumber}`;
          let chapterId = chapterCache.get(chapterKey);
          if (!chapterId && subjectId && row.chapterNumber && row.chapterName) {
            const chapterNum = parseInt(row.chapterNumber);
            const existing = await db.select().from(academicChapters)
              .where(and(eq(academicChapters.subjectId, subjectId), eq(academicChapters.chapterNumber, chapterNum)))
              .limit(1);
            if (existing.length > 0) {
              chapterId = existing[0].id;
            } else {
              const [created] = await db.insert(academicChapters).values({
                subjectId,
                chapterNumber: chapterNum,
                chapterName: row.chapterName,
                displayOrder: chapterNum,
                status: 'Active'
              }).returning();
              chapterId = created.id;
              results.chapters++;
            }
            chapterCache.set(chapterKey, chapterId);
          }

          // 5. Create topic
          if (chapterId && row.topicNumber && row.topicName) {
            const topicNum = parseInt(row.topicNumber);
            const existing = await db.select().from(academicTopics)
              .where(and(eq(academicTopics.chapterId, chapterId), eq(academicTopics.topicNumber, topicNum)))
              .limit(1);
            if (existing.length === 0) {
              await db.insert(academicTopics).values({
                chapterId,
                topicNumber: topicNum,
                topicName: row.topicName,
                displayOrder: topicNum,
                status: 'Active'
              });
              results.topics++;
            }
          }
        } catch (error: any) {
          results.errors.push({ row: i + 1, error: error.message || 'Import failed' });
        }
      }

      res.json({
        message: 'Curriculum import completed',
        ...results
      });
    } catch (error) {
      next(error);
    }
  });

  // AI-Generate Curriculum (Chapters & Topics)
  app.post("/api/admin/curriculum/ai-generate", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { boardCode, classNumber, subjectName, generateChapters, generateTopics } = req.body;
      
      if (!boardCode || !classNumber || !subjectName) {
        return res.status(400).json({ message: 'Board, class, and subject are required' });
      }

      // Check OpenAI configuration
      if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY || !process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
        return res.status(503).json({ message: 'AI service not configured' });
      }

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      // Get or create board
      let board = await db.select().from(educationBoards).where(eq(educationBoards.boardCode, boardCode)).limit(1);
      if (board.length === 0) {
        return res.status(404).json({ message: `Board ${boardCode} not found. Please seed boards first.` });
      }
      const boardId = board[0].id;

      // Get or create class
      let classObj = await db.select().from(academicClasses)
        .where(and(eq(academicClasses.boardId, boardId), eq(academicClasses.classNumber, parseInt(classNumber))))
        .limit(1);
      if (classObj.length === 0) {
        return res.status(404).json({ message: `Class ${classNumber} not found for board ${boardCode}. Please seed classes first.` });
      }
      const classId = classObj[0].id;

      // Get or create subject
      let subject = await db.select().from(academicSubjects)
        .where(and(eq(academicSubjects.classId, classId), eq(academicSubjects.subjectName, subjectName)))
        .limit(1);
      let subjectId: string;
      if (subject.length === 0) {
        const subjectCode = `${boardCode}-${classNumber}-${subjectName.replace(/\s+/g, '').toUpperCase().slice(0, 4)}`;
        const [created] = await db.insert(academicSubjects).values({
          boardId, classId, subjectCode, subjectName, subjectType: 'Core', displayOrder: 1, status: 'Active'
        }).returning();
        subjectId = created.id;
      } else {
        subjectId = subject[0].id;
      }

      // Generate chapters using AI
      const prompt = `Generate a structured curriculum for ${boardCode} ${subjectName} Class ${classNumber} in India.
Return a JSON object with this exact structure:
{
  "chapters": [
    {
      "number": 1,
      "name": "Chapter Title",
      "topics": [
        { "number": 1, "name": "Topic Title" },
        { "number": 2, "name": "Topic Title" }
      ]
    }
  ]
}

Requirements:
- Include all standard chapters for this subject and class level
- Each chapter should have 3-8 relevant topics
- Use accurate chapter and topic names as per ${boardCode} syllabus
- Return ONLY valid JSON, no markdown or explanations`;

      const response = await openai.chat.completions.create({
        model: 'gpt-5-mini',
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 4096,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content || '{}';
      let curriculum: { chapters: Array<{ number: number; name: string; topics?: Array<{ number: number; name: string }> }> };
      try {
        curriculum = JSON.parse(content);
      } catch {
        return res.status(500).json({ message: 'Failed to parse AI response' });
      }

      const results = { chapters: 0, topics: 0 };

      for (const chapter of curriculum.chapters || []) {
        // Check if chapter exists
        const existingChapter = await db.select().from(academicChapters)
          .where(and(eq(academicChapters.subjectId, subjectId), eq(academicChapters.chapterNumber, chapter.number)))
          .limit(1);
        
        let chapterId: string;
        if (existingChapter.length === 0 && generateChapters !== false) {
          const [created] = await db.insert(academicChapters).values({
            subjectId,
            chapterNumber: chapter.number,
            chapterName: chapter.name,
            displayOrder: chapter.number,
            status: 'Active'
          }).returning();
          chapterId = created.id;
          results.chapters++;
        } else {
          chapterId = existingChapter[0]?.id;
        }

        // Create topics if chapter exists and topics requested
        if (chapterId && generateTopics !== false && chapter.topics) {
          for (const topic of chapter.topics) {
            const existingTopic = await db.select().from(academicTopics)
              .where(and(eq(academicTopics.chapterId, chapterId), eq(academicTopics.topicNumber, topic.number)))
              .limit(1);
            if (existingTopic.length === 0) {
              await db.insert(academicTopics).values({
                chapterId,
                topicNumber: topic.number,
                topicName: topic.name,
                displayOrder: topic.number,
                status: 'Active'
              });
              results.topics++;
            }
          }
        }
      }

      res.json({
        message: `AI curriculum generation completed for ${boardCode} Class ${classNumber} ${subjectName}`,
        ...results,
        rawResponse: curriculum
      });
    } catch (error: any) {
      console.error('AI curriculum generation error:', error);
      next(error);
    }
  });

  // Seed Psychometric Assessment Framework - Domains, Subdomains, Age Bands
  app.post("/api/admin/seed-psychometric-data", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      // Age Bands
      const ageBandsData = [
        { bandCode: 'A', bandName: 'Primary School', ageRangeStart: 8, ageRangeEnd: 9, context: 'Primary school', displayOrder: 1 },
        { bandCode: 'B', bandName: 'Upper Primary', ageRangeStart: 10, ageRangeEnd: 11, context: 'Upper primary', displayOrder: 2 },
        { bandCode: 'C', bandName: 'Middle School', ageRangeStart: 12, ageRangeEnd: 13, context: 'Middle school', displayOrder: 3 },
        { bandCode: 'D', bandName: 'Secondary School', ageRangeStart: 14, ageRangeEnd: 15, context: 'Secondary school', displayOrder: 4 },
        { bandCode: 'E', bandName: 'Senior School', ageRangeStart: 16, ageRangeEnd: 18, context: 'Senior school', displayOrder: 5 },
        { bandCode: 'E1', bandName: 'Corporate/Professionals', ageRangeStart: 19, ageRangeEnd: null, context: 'Corporate / professionals', displayOrder: 6 },
      ];

      // Domains with their subdomains
      const domainsData = [
        { 
          domainCode: 'ACE', domainName: 'Academic & Cognitive Effectiveness', category: 'Core', displayOrder: 1,
          subdomains: ['Learning efficiency', 'Conceptual Understanding', 'Working & retrieval memory', 'Sustained attention', 'Learning style', 'Processing stability']
        },
        { 
          domainCode: 'TQP', domainName: 'Thinking Quality Under Pressure', category: 'Core', displayOrder: 2,
          subdomains: ['Analytical & Critical Thinking', 'Decision Quality & Judgment', 'Managing Complexity', 'Exam Strategy & Execution Skills', 'Strategy execution', 'Complexity tolerance', 'Error Handling & Adaptive Execution', 'Situational Judgment Check']
        },
        { 
          domainCode: 'ESER', domainName: 'Examination Stress & Emotional Regulation', category: 'Core', displayOrder: 3,
          subdomains: ['Stress Reactivity', 'Emotional Regulation Ability', 'Cognitive Control Under Stress', 'Execution Stability', 'Recovery & Reset Speed', 'Stress Spillover Control', 'Anticipatory Stress Management', 'Emotional Insight & Awareness', 'Regulation Strategy Flexibility']
        },
        { 
          domainCode: 'CSCC', domainName: 'Confidence, Self-Concept & Comparison', category: 'Core', displayOrder: 4,
          subdomains: ['Academic Self-Confidence', 'Confidence Stability', 'Self-Concept Clarity', 'Social Comparison Sensitivity', 'Fear of Negative Evaluation', 'Competence Attribution Style', 'External Validation Dependence', 'Self-Doubt Intrusion', 'Confidence–Performance Alignment']
        },
        { 
          domainCode: 'ACC', domainName: 'Adjustment & Coping Capacity', category: 'Core', displayOrder: 5,
          subdomains: ['Academic adjustment', 'Emotional adjustment', 'Social adjustment', 'Family adjustment']
        },
        { 
          domainCode: 'SEI', domainName: 'Social & Emotional Intelligence (SQ & EQ)', category: 'Core', displayOrder: 6,
          subdomains: ['Emotional regulation', 'Relationships', 'Trust', 'Inclusion']
        },
        { 
          domainCode: 'DHC', domainName: 'Discipline, Habits & Consistency', category: 'Core', displayOrder: 7,
          subdomains: ['Time management', 'Priority management', 'Accountability', 'Execution', 'Plan-execution alignment', 'Consistency']
        },
        { 
          domainCode: 'CE', domainName: 'Communication & Expression', category: 'Core', displayOrder: 8,
          subdomains: ['Listening', 'Expression', 'Influence', 'Conflict handling', 'Instruction comprehension']
        },
        { 
          domainCode: 'MVR', domainName: 'Motivation, Values & Responsibility', category: 'Core', displayOrder: 9,
          subdomains: ['Drive', 'Commitment stability', 'Integrity', 'Ownership patterns', 'Effort persistence']
        },
        { 
          domainCode: 'LPE', domainName: 'Lifestyle & Pressure Environment', category: 'Core', displayOrder: 10,
          subdomains: ['Digital distraction', 'Sleep quality', 'Parental pressure', 'Institutional pressure']
        },
        { 
          domainCode: 'CER', domainName: 'Competitive Exam Readiness', category: 'Optional', displayOrder: 11,
          subdomains: ['Performance stability', 'Pressure tolerance', 'Consistency', 'Performance variance', 'Recovery speed']
        },
        { 
          domainCode: 'IRCM', domainName: 'Integrated Root Cause Mapping', category: 'Optional', displayOrder: 12,
          subdomains: ['Cross-domain synthesis', 'Cross-module clustering', 'Temporal weighting', 'Human confirmation required']
        },
        { 
          domainCode: 'APRI', domainName: 'Academic Planning & Recovery Intelligence', category: 'Core', displayOrder: 13,
          subdomains: ['Planning Realism', 'Academic Prioritisation Intelligence', 'Recovery Capacity After Setbacks', 'Strategy Correction Ability', 'Execution Feasibility', 'Short-Term Recovery Window']
        },
        { 
          domainCode: 'MSR', domainName: 'Metacognition & Self-Regulation', category: 'Core', displayOrder: 14,
          subdomains: ['Error awareness', 'Strategy switching', 'Self-correction timing']
        },
        { 
          domainCode: 'HSSU', domainName: 'Help-Seeking & Support Utilization', category: 'Core', displayOrder: 15,
          subdomains: ['Help-seeking hesitation', 'Trust in authority', 'Response to guidance']
        },
        { 
          domainCode: 'AIM', domainName: 'Academic Identity & Meaning', category: 'Core', displayOrder: 16,
          subdomains: ['Subject relevance perception', 'Sense of agency', 'Identity alignment']
        },
        { 
          domainCode: 'TCA', domainName: 'Transition & Change Adaptability', category: 'Core', displayOrder: 17,
          subdomains: ['Flexibility', 'Uncertainty tolerance', 'Adaptation speed', 'Multi-domain instability', 'Persistence of disengagement', 'Recovery delay']
        },
        { 
          domainCode: 'TSIS', domainName: 'Teacher–Student Interaction Sensitivity', category: 'Core', displayOrder: 18,
          subdomains: ['Teacher relationship quality', 'Response to feedback', 'Classroom comfort']
        },
        { 
          domainCode: 'OCR', domainName: 'Over-Compliance Risk', category: 'Optional', displayOrder: 19,
          subdomains: ['Excessive compliance', 'Self-neglect patterns', 'Burnout indicators']
        },
      ];

      // Create age bands
      const createdAgeBands = [];
      for (const band of ageBandsData) {
        const existing = await db.select().from(psychometricAgeBands).where(eq(psychometricAgeBands.bandCode, band.bandCode)).limit(1);
        if (existing.length === 0) {
          const [created] = await db.insert(psychometricAgeBands).values(band).returning();
          createdAgeBands.push(created);
        }
      }

      // Create domains and subdomains
      let domainCount = 0;
      let subdomainCount = 0;
      for (const domain of domainsData) {
        const existing = await db.select().from(psychometricDomains).where(eq(psychometricDomains.domainCode, domain.domainCode)).limit(1);
        let domainId: string;
        if (existing.length === 0) {
          const [created] = await db.insert(psychometricDomains).values({
            domainCode: domain.domainCode,
            domainName: domain.domainName,
            category: domain.category,
            displayOrder: domain.displayOrder,
          }).returning();
          domainId = created.id;
          domainCount++;
        } else {
          domainId = existing[0].id;
        }

        // Create subdomains
        for (let i = 0; i < domain.subdomains.length; i++) {
          const subdomainName = domain.subdomains[i];
          const subdomainCode = `${domain.domainCode}_SD${(i + 1).toString().padStart(2, '0')}`;
          const existingSub = await db.select().from(psychometricSubdomains).where(eq(psychometricSubdomains.subdomainCode, subdomainCode)).limit(1);
          if (existingSub.length === 0) {
            await db.insert(psychometricSubdomains).values({
              domainId,
              subdomainCode,
              subdomainName,
              displayOrder: i + 1,
            });
            subdomainCount++;
          }
        }

        // Create domain-age band configs for all age bands
        const allAgeBands = await db.select().from(psychometricAgeBands);
        for (const ageBand of allAgeBands) {
          const existingConfig = await db.select().from(psychometricDomainAgeBandConfig)
            .where(and(
              eq(psychometricDomainAgeBandConfig.domainId, domainId),
              eq(psychometricDomainAgeBandConfig.ageBandId, ageBand.id)
            )).limit(1);
          if (existingConfig.length === 0) {
            await db.insert(psychometricDomainAgeBandConfig).values({
              domainId,
              ageBandId: ageBand.id,
              isEnabled: true,
              questionsCount: 10,
              weightage: 1.0,
            });
          }
        }
      }

      res.json({
        message: 'Psychometric assessment data seeded successfully',
        ageBands: createdAgeBands.length,
        domains: domainCount,
        subdomains: subdomainCount
      });
    } catch (error) {
      next(error);
    }
  });

  // Get psychometric age bands
  app.get("/api/admin/psychometric/age-bands", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const bands = await db.select().from(psychometricAgeBands).orderBy(asc(psychometricAgeBands.displayOrder));
      res.json(bands);
    } catch (error) {
      next(error);
    }
  });

  // Get psychometric domains with subdomains
  app.get("/api/admin/psychometric/domains", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const domains = await db.select().from(psychometricDomains).orderBy(asc(psychometricDomains.displayOrder));
      const subdomains = await db.select().from(psychometricSubdomains).orderBy(asc(psychometricSubdomains.displayOrder));
      
      const domainsWithSubs = domains.map(d => ({
        ...d,
        subdomains: subdomains.filter(s => s.domainId === d.id)
      }));
      
      res.json(domainsWithSubs);
    } catch (error) {
      next(error);
    }
  });

  // Toggle domain active status
  app.patch("/api/admin/psychometric/domains/:id/toggle", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const domain = await db.select().from(psychometricDomains).where(eq(psychometricDomains.id, req.params.id)).limit(1);
      if (domain.length === 0) {
        return res.status(404).json({ message: 'Domain not found' });
      }
      const [updated] = await db.update(psychometricDomains)
        .set({ isActive: !domain[0].isActive, updatedAt: new Date() })
        .where(eq(psychometricDomains.id, req.params.id))
        .returning();
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  // Update domain-age band configuration
  app.patch("/api/admin/psychometric/config/:domainId/:ageBandId", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { isEnabled, questionsCount, weightage } = req.body;
      const [updated] = await db.update(psychometricDomainAgeBandConfig)
        .set({ 
          isEnabled: isEnabled !== undefined ? isEnabled : undefined,
          questionsCount: questionsCount !== undefined ? questionsCount : undefined,
          weightage: weightage !== undefined ? weightage : undefined,
        })
        .where(and(
          eq(psychometricDomainAgeBandConfig.domainId, req.params.domainId),
          eq(psychometricDomainAgeBandConfig.ageBandId, req.params.ageBandId)
        ))
        .returning();
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  // Get domain-age band configurations
  app.get("/api/admin/psychometric/config", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const configs = await db.select().from(psychometricDomainAgeBandConfig);
      res.json(configs);
    } catch (error) {
      next(error);
    }
  });

  // ========== PSYCHOMETRIC QUESTION BANK MANAGEMENT ==========
  
  // Get questions with filters
  app.get("/api/admin/psychometric/questions", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { domainId, ageBandId, subdomainId, isActive } = req.query;
      let query = db.select().from(psychometricQuestionBank);
      
      const conditions = [];
      if (domainId) conditions.push(eq(psychometricQuestionBank.domainId, domainId as string));
      if (ageBandId) conditions.push(eq(psychometricQuestionBank.ageBandId, ageBandId as string));
      if (subdomainId) conditions.push(eq(psychometricQuestionBank.subdomainId, subdomainId as string));
      if (isActive !== undefined) conditions.push(eq(psychometricQuestionBank.isActive, isActive === 'true'));
      
      const questions = conditions.length > 0 
        ? await db.select().from(psychometricQuestionBank).where(and(...conditions))
        : await db.select().from(psychometricQuestionBank);
      
      res.json(questions);
    } catch (error) {
      next(error);
    }
  });

  // Add single question
  app.post("/api/admin/psychometric/questions", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const validated = insertPsychometricQuestionBankSchema.parse(req.body);
      const [question] = await db.insert(psychometricQuestionBank).values(validated).returning();
      res.status(201).json(question);
    } catch (error) {
      next(error);
    }
  });

  // Update question
  app.patch("/api/admin/psychometric/questions/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const [updated] = await db.update(psychometricQuestionBank)
        .set(req.body)
        .where(eq(psychometricQuestionBank.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: 'Question not found' });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  // Delete question
  app.delete("/api/admin/psychometric/questions/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      await db.delete(psychometricQuestionBank).where(eq(psychometricQuestionBank.id, req.params.id));
      res.json({ message: 'Question deleted' });
    } catch (error) {
      next(error);
    }
  });

  // Download question template CSV
  app.get("/api/admin/psychometric/questions/template", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const domains = await db.select().from(psychometricDomains);
      const ageBands = await db.select().from(psychometricAgeBands);
      const subdomains = await db.select().from(psychometricSubdomains);
      
      const headers = [
        'questionCode', 'domainCode', 'subdomainCode', 'ageBandCode', 'questionText',
        'questionType', 'responseOptions', 'scoringLogic', 'reverseScored', 'difficulty', 'language'
      ];
      
      // Sample rows with actual domain/age band codes
      const sampleRows = [
        [
          'ACE_A_001', 'ACE', 'ACE_SD01', 'A', 'How often do you complete your homework on time?',
          'Likert', '["Never","Rarely","Sometimes","Often","Always"]', '{"1":1,"2":2,"3":3,"4":4,"5":5}', 'false', 'Easy', 'EN'
        ],
        [
          'TQP_B_001', 'TQP', 'TQP_SD01', 'B', 'When facing a difficult problem, I try different approaches',
          'Likert', '["Strongly Disagree","Disagree","Neutral","Agree","Strongly Agree"]', '{"1":1,"2":2,"3":3,"4":4,"5":5}', 'false', 'Medium', 'EN'
        ],
      ];
      
      const csvContent = [
        headers.join(','),
        ...sampleRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');
      
      // Add reference sheets info
      const domainRef = '\n\n# Domain Reference:\n# ' + domains.map(d => `${d.domainCode} = ${d.domainName}`).join('\n# ');
      
      // Group subdomains by domain
      const subdomainsByDomain = new Map<string, typeof subdomains>();
      for (const sd of subdomains) {
        const domain = domains.find(d => d.id === sd.domainId);
        if (domain) {
          if (!subdomainsByDomain.has(domain.domainCode)) {
            subdomainsByDomain.set(domain.domainCode, []);
          }
          subdomainsByDomain.get(domain.domainCode)!.push(sd);
        }
      }
      
      let subdomainRef = '\n\n# Subdomain Reference (by Domain):';
      Array.from(subdomainsByDomain.entries()).forEach(([domainCode, sds]) => {
        subdomainRef += `\n# ${domainCode}:`;
        sds.forEach(sd => {
          subdomainRef += `\n#   ${sd.subdomainCode} = ${sd.subdomainName}`;
        });
      });
      
      const ageBandRef = '\n\n# Age Band Reference:\n# ' + ageBands.map(b => `${b.bandCode} = ${b.bandName} (Ages ${b.ageRangeStart}-${b.ageRangeEnd || '+'})`).join('\n# ');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="psychometric_questions_template.csv"');
      res.send(csvContent + domainRef + subdomainRef + ageBandRef);
    } catch (error) {
      next(error);
    }
  });

  // Bulk upload questions via CSV
  app.post("/api/admin/psychometric/questions/bulk", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { questions, failOnError = false } = req.body;
      
      // Validate input - throw exceptions for invalid data
      if (!questions) {
        throw new Error('VALIDATION_ERROR: Missing required field "questions"');
      }
      if (!Array.isArray(questions)) {
        throw new Error('VALIDATION_ERROR: "questions" must be an array');
      }
      if (questions.length === 0) {
        throw new Error('VALIDATION_ERROR: No questions provided. Please upload a CSV with at least one question.');
      }

      // Get lookup maps
      const domains = await db.select().from(psychometricDomains);
      const ageBands = await db.select().from(psychometricAgeBands);
      const subdomains = await db.select().from(psychometricSubdomains);
      
      if (domains.length === 0) {
        throw new Error('CONFIG_ERROR: No psychometric domains configured. Please seed the domain data first.');
      }
      if (ageBands.length === 0) {
        throw new Error('CONFIG_ERROR: No age bands configured. Please seed the age band data first.');
      }

      const domainMap = new Map(domains.map(d => [d.domainCode, d.id]));
      const ageBandMap = new Map(ageBands.map(b => [b.bandCode, b.id]));
      const subdomainMap = new Map(subdomains.map(s => [s.subdomainCode, s.id]));

      const results = { 
        inserted: 0, 
        skipped: 0,
        total: questions.length,
        errors: [] as { row: number; field?: string; error: string; value?: string }[],
        validDomainCodes: Array.from(domainMap.keys()),
        validAgeBandCodes: Array.from(ageBandMap.keys())
      };

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const rowNum = i + 2; // CSV row number (header is row 1)
        
        try {
          // Validate required fields - throw if failOnError is true
          if (!q.questionCode || !String(q.questionCode).trim()) {
            const err = { row: rowNum, field: 'questionCode', error: 'Question code is required', value: q.questionCode };
            results.errors.push(err);
            if (failOnError) throw new Error(`ROW_ERROR: Row ${rowNum} - Question code is required`);
            results.skipped++;
            continue;
          }
          if (!q.questionText || !String(q.questionText).trim()) {
            const err = { row: rowNum, field: 'questionText', error: 'Question text is required', value: q.questionText };
            results.errors.push(err);
            if (failOnError) throw new Error(`ROW_ERROR: Row ${rowNum} - Question text is required`);
            results.skipped++;
            continue;
          }
          if (!q.domainCode) {
            const err = { row: rowNum, field: 'domainCode', error: 'Domain code is required', value: q.domainCode };
            results.errors.push(err);
            if (failOnError) throw new Error(`ROW_ERROR: Row ${rowNum} - Domain code is required`);
            results.skipped++;
            continue;
          }
          if (!q.ageBandCode) {
            const err = { row: rowNum, field: 'ageBandCode', error: 'Age band code is required', value: q.ageBandCode };
            results.errors.push(err);
            if (failOnError) throw new Error(`ROW_ERROR: Row ${rowNum} - Age band code is required`);
            results.skipped++;
            continue;
          }

          const domainCode = String(q.domainCode).trim().toUpperCase();
          const ageBandCode = String(q.ageBandCode).trim().toUpperCase();
          const domainId = domainMap.get(domainCode);
          const ageBandId = ageBandMap.get(ageBandCode);
          const subdomainId = q.subdomainCode ? subdomainMap.get(String(q.subdomainCode).trim()) : null;

          if (!domainId) {
            const err = { 
              row: rowNum, 
              field: 'domainCode', 
              error: `Invalid domain code "${domainCode}". Valid: ${results.validDomainCodes.join(', ')}`,
              value: domainCode 
            };
            results.errors.push(err);
            if (failOnError) throw new Error(`ROW_ERROR: Row ${rowNum} - ${err.error}`);
            results.skipped++;
            continue;
          }
          if (!ageBandId) {
            const err = { 
              row: rowNum, 
              field: 'ageBandCode', 
              error: `Invalid age band code "${ageBandCode}". Valid: ${results.validAgeBandCodes.join(', ')}`,
              value: ageBandCode 
            };
            results.errors.push(err);
            if (failOnError) throw new Error(`ROW_ERROR: Row ${rowNum} - ${err.error}`);
            results.skipped++;
            continue;
          }

          // Validate question type - make it optional, default to Likert if invalid
          const validTypes = ['Likert', 'MultipleChoice', 'TrueFalse', 'Rating', 'OpenEnded'];
          let questionType = 'Likert'; // Default
          if (q.questionType && validTypes.includes(q.questionType)) {
            questionType = q.questionType;
          }
          // Don't error on invalid questionType - just use default

          // Validate difficulty - make it optional, default to Medium if invalid or missing
          const validDifficulties = ['Easy', 'Medium', 'Hard'];
          let difficulty = 'Medium'; // Default
          if (q.difficulty && validDifficulties.includes(q.difficulty)) {
            difficulty = q.difficulty;
          }
          // Don't error on invalid difficulty - just use default

          await db.insert(psychometricQuestionBank).values({
            questionCode: String(q.questionCode).trim(),
            domainId,
            subdomainId,
            ageBandId,
            questionText: String(q.questionText).trim(),
            questionType,
            responseOptions: q.responseOptions || null,
            scoringLogic: q.scoringLogic || null,
            reverseScored: q.reverseScored === 'true' || q.reverseScored === true || q.reverseScored === '1',
            difficulty,
            language: q.language || 'EN',
          });
          results.inserted++;
        } catch (err: any) {
          // Check for duplicate key error
          if (err.code === '23505' || err.message?.includes('duplicate')) {
            const dupErr = { 
              row: rowNum, 
              field: 'questionCode', 
              error: `Duplicate question code "${q.questionCode}" already exists`,
              value: q.questionCode 
            };
            results.errors.push(dupErr);
            if (failOnError) throw new Error(`DUPLICATE_ERROR: Row ${rowNum} - ${dupErr.error}`);
            results.skipped++;
          } else if (err.message?.startsWith('ROW_ERROR:') || err.message?.startsWith('DUPLICATE_ERROR:')) {
            throw err; // Re-throw validation errors in failOnError mode
          } else {
            results.errors.push({ row: rowNum, error: err.message || 'Unknown database error', value: JSON.stringify(q) });
            if (failOnError) throw new Error(`DATABASE_ERROR: Row ${rowNum} - ${err.message}`);
            results.skipped++;
          }
        }
      }

      // If all rows failed, throw an exception
      if (results.inserted === 0 && results.errors.length > 0) {
        const errorSummary = results.errors.slice(0, 5).map(e => `Row ${e.row}: ${e.error}`).join('; ');
        throw new Error(`UPLOAD_FAILED: All ${questions.length} questions had errors. First errors: ${errorSummary}`);
      }

      // Return success with detailed results
      res.json({
        success: true,
        message: results.errors.length > 0 
          ? `Partial success: ${results.inserted} inserted, ${results.skipped} skipped`
          : `Success: ${results.inserted} questions uploaded`,
        ...results
      });
    } catch (error: any) {
      // Determine error type and status code
      const errorMessage = error.message || 'Upload failed';
      let statusCode = 500;
      let errorType = 'UNKNOWN_ERROR';
      
      if (errorMessage.startsWith('VALIDATION_ERROR:')) {
        statusCode = 400;
        errorType = 'VALIDATION_ERROR';
      } else if (errorMessage.startsWith('CONFIG_ERROR:')) {
        statusCode = 503;
        errorType = 'CONFIG_ERROR';
      } else if (errorMessage.startsWith('ROW_ERROR:')) {
        statusCode = 400;
        errorType = 'ROW_ERROR';
      } else if (errorMessage.startsWith('DUPLICATE_ERROR:')) {
        statusCode = 409;
        errorType = 'DUPLICATE_ERROR';
      } else if (errorMessage.startsWith('UPLOAD_FAILED:')) {
        statusCode = 400;
        errorType = 'UPLOAD_FAILED';
      } else if (errorMessage.startsWith('DATABASE_ERROR:')) {
        statusCode = 500;
        errorType = 'DATABASE_ERROR';
      }
      
      res.status(statusCode).json({ 
        success: false,
        errorType,
        message: errorMessage.replace(/^[A-Z_]+:\s*/, ''), // Remove error prefix for cleaner display
        error: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // ========== PSYCHOMETRIC SCORING ENGINE ==========
  
  // Get assessment questions for a student (based on age band)
  app.get("/api/psychometric/assessment/:studentId", requireAuth, async (req, res, next) => {
    try {
      const { studentId } = req.params;
      
      // Get student's age band (from children table or students table)
      const child = await db.select().from(children).where(eq(children.id, studentId)).limit(1);
      if (child.length === 0) {
        return res.status(404).json({ message: 'Student not found' });
      }
      
      const age = child[0].age;
      
      // Determine age band
      const ageBands = await db.select().from(psychometricAgeBands).where(eq(psychometricAgeBands.isActive, true));
      let matchedBand = ageBands.find(b => 
        age >= b.ageRangeStart && (b.ageRangeEnd === null || age <= b.ageRangeEnd)
      );
      
      if (!matchedBand) {
        return res.status(400).json({ message: 'No matching age band for student age' });
      }

      // Get enabled domains and their question counts for this age band
      const configs = await db.select()
        .from(psychometricDomainAgeBandConfig)
        .where(and(
          eq(psychometricDomainAgeBandConfig.ageBandId, matchedBand.id),
          eq(psychometricDomainAgeBandConfig.isEnabled, true)
        ));

      // Get questions for each domain, respecting question counts
      const assessmentQuestions = [];
      for (const config of configs) {
        const questions = await db.select()
          .from(psychometricQuestionBank)
          .where(and(
            eq(psychometricQuestionBank.domainId, config.domainId),
            eq(psychometricQuestionBank.ageBandId, matchedBand.id),
            eq(psychometricQuestionBank.isActive, true)
          ));
        
        // Shuffle and take required count
        const shuffled = questions.sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, config.questionsCount || 10);
        assessmentQuestions.push(...selected.map(q => ({
          ...q,
          weightage: config.weightage
        })));
      }

      res.json({
        studentId,
        ageBand: matchedBand,
        questions: assessmentQuestions,
        totalQuestions: assessmentQuestions.length
      });
    } catch (error) {
      next(error);
    }
  });

  // Submit assessment responses and calculate scores
  app.post("/api/psychometric/assessment/:studentId/submit", requireAuth, async (req, res, next) => {
    try {
      const { studentId } = req.params;
      const { responses, ageBandId } = req.body; // responses: { questionId: responseValue }
      
      if (!responses || Object.keys(responses).length === 0) {
        return res.status(400).json({ message: 'No responses provided' });
      }

      // Get questions for the responses
      const questionIds = Object.keys(responses);
      const questions = await db.select()
        .from(psychometricQuestionBank)
        .where(sql`${psychometricQuestionBank.id} = ANY(${questionIds})`);

      // Group by domain for scoring
      const domainScores: Record<string, { 
        raw: number; 
        max: number; 
        count: number;
        subdomainScores: Record<string, { raw: number; max: number; count: number }>;
      }> = {};

      for (const question of questions) {
        const response = responses[question.id];
        if (response === undefined) continue;

        // Parse scoring logic
        let scoringLogic: Record<string, number> = {};
        try {
          scoringLogic = question.scoringLogic ? JSON.parse(question.scoringLogic) : {};
        } catch {}

        // Calculate score for this question
        let rawScore = 0;
        const maxScore = Math.max(...Object.values(scoringLogic), 5); // Default max 5 for Likert
        
        if (typeof response === 'number') {
          rawScore = scoringLogic[String(response)] ?? response;
        } else if (typeof response === 'string') {
          rawScore = scoringLogic[response] ?? 0;
        }
        
        // Apply reverse scoring if needed
        if (question.reverseScored) {
          rawScore = maxScore - rawScore + 1;
        }

        // Initialize domain if needed
        if (!domainScores[question.domainId]) {
          domainScores[question.domainId] = { raw: 0, max: 0, count: 0, subdomainScores: {} };
        }
        domainScores[question.domainId].raw += rawScore;
        domainScores[question.domainId].max += maxScore;
        domainScores[question.domainId].count++;

        // Track subdomain scores
        if (question.subdomainId) {
          if (!domainScores[question.domainId].subdomainScores[question.subdomainId]) {
            domainScores[question.domainId].subdomainScores[question.subdomainId] = { raw: 0, max: 0, count: 0 };
          }
          domainScores[question.domainId].subdomainScores[question.subdomainId].raw += rawScore;
          domainScores[question.domainId].subdomainScores[question.subdomainId].max += maxScore;
          domainScores[question.domainId].subdomainScores[question.subdomainId].count++;
        }
      }

      // Calculate percentile and scaled scores, store results
      const results = [];
      for (const [domainId, scores] of Object.entries(domainScores)) {
        const percentile = scores.max > 0 ? (scores.raw / scores.max) * 100 : 0;
        const scaled = percentile; // Could apply normalization here
        
        // Interpretation
        let interpretation = 'Average';
        if (percentile >= 80) interpretation = 'High';
        else if (percentile >= 60) interpretation = 'Above Average';
        else if (percentile >= 40) interpretation = 'Average';
        else if (percentile >= 20) interpretation = 'Below Average';
        else interpretation = 'Low';

        // Generate recommendations based on score
        let recommendations = '';
        if (percentile < 40) {
          recommendations = 'Focus on developing skills in this area through targeted activities and support.';
        } else if (percentile < 60) {
          recommendations = 'Continue building on current skills with regular practice and feedback.';
        } else {
          recommendations = 'Maintain current strengths and explore advanced challenges.';
        }

        // Store domain result
        const [result] = await db.insert(psychometricAssessmentResults).values({
          studentId,
          ageBandId: ageBandId || questions[0]?.ageBandId,
          domainId,
          rawScore: scores.raw,
          percentileScore: percentile,
          scaledScore: scaled,
          interpretation,
          recommendations,
        }).returning();
        
        results.push(result);

        // Store subdomain results
        for (const [subdomainId, subScores] of Object.entries(scores.subdomainScores)) {
          const subPercentile = subScores.max > 0 ? (subScores.raw / subScores.max) * 100 : 0;
          await db.insert(psychometricAssessmentResults).values({
            studentId,
            ageBandId: ageBandId || questions[0]?.ageBandId,
            domainId,
            subdomainId,
            rawScore: subScores.raw,
            percentileScore: subPercentile,
            scaledScore: subPercentile,
            interpretation: subPercentile >= 60 ? 'Good' : subPercentile >= 40 ? 'Average' : 'Needs Attention',
          });
        }
      }

      // Calculate overall score
      const overallRaw = Object.values(domainScores).reduce((sum, d) => sum + d.raw, 0);
      const overallMax = Object.values(domainScores).reduce((sum, d) => sum + d.max, 0);
      const overallPercentile = overallMax > 0 ? (overallRaw / overallMax) * 100 : 0;

      res.json({
        studentId,
        overallScore: Math.round(overallPercentile),
        domainResults: results,
        message: 'Assessment completed successfully'
      });
    } catch (error) {
      next(error);
    }
  });

  // Get student's assessment history
  app.get("/api/psychometric/results/:studentId", requireAuth, async (req, res, next) => {
    try {
      const { studentId } = req.params;
      const results = await db.select()
        .from(psychometricAssessmentResults)
        .where(eq(psychometricAssessmentResults.studentId, studentId))
        .orderBy(desc(psychometricAssessmentResults.assessedAt));
      
      // Enrich with domain names
      const domains = await db.select().from(psychometricDomains);
      const subdomains = await db.select().from(psychometricSubdomains);
      const domainMap = new Map(domains.map(d => [d.id, d]));
      const subdomainMap = new Map(subdomains.map(s => [s.id, s]));

      const enrichedResults = results.map(r => ({
        ...r,
        domain: domainMap.get(r.domainId),
        subdomain: r.subdomainId ? subdomainMap.get(r.subdomainId) : null,
      }));

      res.json(enrichedResults);
    } catch (error) {
      next(error);
    }
  });

  // ========== END PSYCHOMETRIC ENDPOINTS ==========

  // Get all education boards (public)
  app.get("/api/education/boards", async (req, res, next) => {
    try {
      const boards = await storage.getEducationBoards();
      res.json(boards);
    } catch (error) {
      next(error);
    }
  });

  // Get classes by board
  app.get("/api/education/classes/:boardId", async (req, res, next) => {
    try {
      const classes = await storage.getClassesByBoard(req.params.boardId);
      res.json(classes);
    } catch (error) {
      next(error);
    }
  });

  // Get subjects by class
  app.get("/api/education/subjects/:classId", async (req, res, next) => {
    try {
      const subjects = await storage.getSubjectsByClass(req.params.classId);
      res.json(subjects);
    } catch (error) {
      next(error);
    }
  });

  // Super Admin Dashboard Stats
  app.get("/api/admin/dashboard/stats", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const stats = await storage.getSuperAdminDashboardStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  // Onboarding Approvals
  app.get("/api/admin/onboarding", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { entityType, status } = req.query;
      const approvals = await storage.getOnboardingApprovals({
        entityType: entityType as string,
        status: status as string
      });
      res.json(approvals);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/onboarding/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const approval = await storage.getOnboardingApproval(req.params.id);
      if (!approval) {
        return res.status(404).json({ message: "Onboarding approval not found" });
      }
      res.json(approval);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/onboarding/:id/approve", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { reviewNotes } = req.body;
      const approval = await storage.updateOnboardingApproval(req.params.id, {
        status: 'approved',
        reviewedBy: req.user!.id,
        reviewedAt: new Date(),
        reviewNotes
      });

      // If this is a mentor approval, create a mentor record
      if (approval.entityType === 'mentor') {
        // Generate a mentor code
        const mentorCode = `MNT${Date.now().toString(36).toUpperCase()}`;
        const username = (approval.entityEmail || approval.entityName).toLowerCase().replace(/[^a-z0-9]/g, '_');
        
        // Create a user account for the mentor if they don't exist
        let mentorUser = await storage.getUserByUsername(username);
        if (!mentorUser) {
          // Generate and hash a temporary password
          const tempPassword = randomBytes(16).toString('hex');
          const hashedPassword = await crypto.hash(tempPassword);
          
          mentorUser = await storage.createUser({
            username,
            password: hashedPassword,
            fullName: approval.entityName,
            role: 'mentor'
          });
          
          // TODO: Send password reset email to mentor with their temporary credentials
        }
        
        if (mentorUser) {
          await storage.createMentor({
            userId: mentorUser.id,
            fullName: approval.entityName,
            email: approval.entityEmail || '',
            phone: approval.entityPhone || '',
            mentorCode,
            status: 'active',
            performanceHealthIndex: 100,
            specialization: 'General',
            activatedAt: new Date()
          });
        }
      }

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: `approve_${approval.entityType}`,
        targetType: 'onboarding',
        targetId: approval.id,
        newState: JSON.stringify({ status: 'approved' }),
        notes: reviewNotes
      });

      res.json(approval);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/onboarding/:id/reject", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { rejectionReason, reviewNotes } = req.body;
      const approval = await storage.updateOnboardingApproval(req.params.id, {
        status: 'rejected',
        reviewedBy: req.user!.id,
        reviewedAt: new Date(),
        rejectionReason,
        reviewNotes
      });

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: `reject_${approval.entityType}`,
        targetType: 'onboarding',
        targetId: approval.id,
        newState: JSON.stringify({ status: 'rejected', reason: rejectionReason }),
        notes: reviewNotes
      });

      res.json(approval);
    } catch (error) {
      next(error);
    }
  });

  // Verify documents
  app.patch("/api/admin/onboarding/:id/verify-documents", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { verified, notes } = req.body;
      const approval = await storage.updateOnboardingApproval(req.params.id, {
        documentsVerified: verified
      });

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: verified ? 'verify_documents' : 'unverify_documents',
        targetType: 'onboarding',
        targetId: approval.id,
        newState: JSON.stringify({ documentsVerified: verified }),
        notes
      });

      res.json(approval);
    } catch (error) {
      next(error);
    }
  });

  // Verify KYC
  app.patch("/api/admin/onboarding/:id/verify-kyc", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { verified, notes } = req.body;
      const approval = await storage.updateOnboardingApproval(req.params.id, {
        kycVerified: verified
      });

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: verified ? 'verify_kyc' : 'unverify_kyc',
        targetType: 'onboarding',
        targetId: approval.id,
        newState: JSON.stringify({ kycVerified: verified }),
        notes
      });

      res.json(approval);
    } catch (error) {
      next(error);
    }
  });

  // Suspend approved entity
  app.post("/api/admin/onboarding/:id/suspend", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { reason, notes } = req.body;
      const approval = await storage.updateOnboardingApproval(req.params.id, {
        status: 'suspended',
        reviewedBy: req.user!.id,
        reviewedAt: new Date(),
        reviewNotes: notes
      });

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: `suspend_${approval.entityType}`,
        targetType: 'onboarding',
        targetId: approval.id,
        newState: JSON.stringify({ status: 'suspended', reason }),
        notes
      });

      res.json(approval);
    } catch (error) {
      next(error);
    }
  });

  // Reinstate suspended entity
  app.post("/api/admin/onboarding/:id/reinstate", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { notes } = req.body;
      const approval = await storage.updateOnboardingApproval(req.params.id, {
        status: 'approved',
        reviewedBy: req.user!.id,
        reviewedAt: new Date(),
        reviewNotes: notes
      });

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: `reinstate_${approval.entityType}`,
        targetType: 'onboarding',
        targetId: approval.id,
        newState: JSON.stringify({ status: 'approved' }),
        notes
      });

      res.json(approval);
    } catch (error) {
      next(error);
    }
  });

  // Get onboarding stats
  app.get("/api/admin/onboarding-stats", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const approvals = await storage.getOnboardingApprovals({});
      const stats = {
        total: approvals.length,
        pending: approvals.filter((a: any) => a.status === 'pending').length,
        approved: approvals.filter((a: any) => a.status === 'approved').length,
        rejected: approvals.filter((a: any) => a.status === 'rejected').length,
        suspended: approvals.filter((a: any) => a.status === 'suspended').length,
        byType: {
          institute: approvals.filter((a: any) => a.entityType === 'institute').length,
          parent: approvals.filter((a: any) => a.entityType === 'parent').length,
          mentor: approvals.filter((a: any) => a.entityType === 'mentor').length,
          ngo: approvals.filter((a: any) => a.entityType === 'ngo').length,
          lei: approvals.filter((a: any) => a.entityType === 'lei').length
        },
        pendingByType: {
          institute: approvals.filter((a: any) => a.entityType === 'institute' && a.status === 'pending').length,
          parent: approvals.filter((a: any) => a.entityType === 'parent' && a.status === 'pending').length,
          mentor: approvals.filter((a: any) => a.entityType === 'mentor' && a.status === 'pending').length,
          ngo: approvals.filter((a: any) => a.entityType === 'ngo' && a.status === 'pending').length,
          lei: approvals.filter((a: any) => a.entityType === 'lei' && a.status === 'pending').length
        },
        documentsVerified: approvals.filter((a: any) => a.documentsVerified).length,
        kycVerified: approvals.filter((a: any) => a.kycVerified).length
      };
      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  // Get audit history for an onboarding request
  app.get("/api/admin/onboarding/:id/history", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const logs = await storage.getAdminAuditLogsByTarget('onboarding', req.params.id);
      res.json(logs);
    } catch (error) {
      next(error);
    }
  });

  // KYC Documents with Maker-Checker workflow
  app.get("/api/admin/kyc", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { entityType, status } = req.query;
      const docs = await storage.getKycDocuments({
        entityType: entityType as string,
        status: status as string
      });
      res.json(docs);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/kyc/:entityType/:entityId", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const docs = await storage.getKycDocumentsByEntity(req.params.entityType, req.params.entityId);
      res.json(docs);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/kyc", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const doc = await storage.createKycDocument(req.body);
      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'create_kyc',
        targetType: 'kyc',
        targetId: doc.id,
        newState: JSON.stringify(doc)
      });
      res.json(doc);
    } catch (error) {
      next(error);
    }
  });

  // Maker verification (first level)
  app.post("/api/admin/kyc/:id/maker-verify", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { notes } = req.body;
      const doc = await storage.updateKycDocument(req.params.id, {
        status: 'maker_verified',
        makerId: req.user!.id,
        makerVerifiedAt: new Date(),
        makerNotes: notes
      });
      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'maker_verify_kyc',
        targetType: 'kyc',
        targetId: doc.id,
        newState: JSON.stringify({ status: 'maker_verified' }),
        notes
      });
      res.json({ kyc: doc });
    } catch (error) {
      next(error);
    }
  });

  // Checker verification (second level - final approval)
  app.post("/api/admin/kyc/:id/checker-verify", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { notes } = req.body;
      const existing = await storage.getKycDocument(req.params.id);
      if (existing?.makerId === req.user!.id) {
        return res.status(400).json({ message: "Checker must be different from maker" });
      }
      const doc = await storage.updateKycDocument(req.params.id, {
        status: 'approved',
        checkerId: req.user!.id,
        checkerVerifiedAt: new Date(),
        checkerNotes: notes
      });
      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'checker_approve_kyc',
        targetType: 'kyc',
        targetId: doc.id,
        newState: JSON.stringify({ status: 'approved' }),
        notes
      });
      res.json({ kyc: doc });
    } catch (error) {
      next(error);
    }
  });

  // Reject KYC document
  app.post("/api/admin/kyc/:id/reject", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { reason } = req.body;
      const doc = await storage.updateKycDocument(req.params.id, {
        status: 'rejected',
        rejectionReason: reason,
        checkerId: req.user!.id,
        checkerVerifiedAt: new Date()
      });
      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'reject_kyc',
        targetType: 'kyc',
        targetId: doc.id,
        newState: JSON.stringify({ status: 'rejected' }),
        notes: reason
      });
      res.json({ kyc: doc });
    } catch (error) {
      next(error);
    }
  });

  // Student Enrollments (drilldown from institutes)
  app.get("/api/admin/student-enrollments", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { instituteId, status, paymentStatus } = req.query;
      const enrollments = await storage.getStudentEnrollments({
        instituteId: instituteId as string,
        status: status as string,
        paymentStatus: paymentStatus as string
      });
      res.json(enrollments);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/student-enrollments/:instituteId", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { status, paymentStatus } = req.query;
      const enrollments = await storage.getStudentEnrollments({
        instituteId: req.params.instituteId,
        status: status as string,
        paymentStatus: paymentStatus as string
      });
      res.json(enrollments);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/student-enrollments/:id/approve", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { notes } = req.body;
      const enrollment = await storage.updateStudentEnrollment(req.params.id, {
        status: 'approved',
        approvedBy: req.user!.id,
        approvedAt: new Date(),
        approvalNotes: notes
      });
      res.json({ enrollment });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/student-enrollments/:id/payment", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { paymentStatus, paidAmount } = req.body;
      const enrollment = await storage.updateStudentEnrollment(req.params.id, {
        paymentStatus,
        paidAmount,
        status: paymentStatus === 'completed' ? 'active' : undefined
      });
      res.json({ enrollment });
    } catch (error) {
      next(error);
    }
  });

  // Platform Transactions
  app.get("/api/admin/transactions", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { entityType, status, transactionType, limit } = req.query;
      const transactions = await storage.getPlatformTransactions({
        entityType: entityType as string,
        status: status as string,
        transactionType: transactionType as string,
        limit: limit ? parseInt(limit as string) : 100
      });
      res.json(transactions);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/transactions/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const transaction = await storage.getPlatformTransaction(req.params.id);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      res.json(transaction);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/transactions/:id/process", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const transaction = await storage.updatePlatformTransaction(req.params.id, {
        status: 'completed',
        processedBy: req.user!.id,
        processedAt: new Date()
      });

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'process_transaction',
        targetType: 'transaction',
        targetId: transaction.id,
        newState: JSON.stringify({ status: 'completed' })
      });

      res.json(transaction);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/transactions/:id/refund", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { refundAmount, reason } = req.body;
      const existingTransaction = await storage.getPlatformTransaction(req.params.id);
      
      const transaction = await storage.updatePlatformTransaction(req.params.id, {
        status: 'refunded',
        refundedAmount: refundAmount || existingTransaction?.amount,
        refundedAt: new Date()
      });

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'refund_transaction',
        targetType: 'transaction',
        targetId: transaction.id,
        newState: JSON.stringify({ status: 'refunded', refundAmount }),
        notes: reason
      });

      res.json(transaction);
    } catch (error) {
      next(error);
    }
  });

  // User Management
  app.get("/api/admin/users", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { role, limit } = req.query;
      const users = await storage.getAllUsers({
        role: role as string,
        limit: limit ? parseInt(limit as string) : 100
      });
      // Remove passwords from response
      const safeUsers = users.map(({ password, ...user }) => user);
      res.json(safeUsers);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/users/:id/roles", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { role } = req.body;
      const user = await storage.addUserRole(req.params.id, role);

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'add_user_role',
        targetType: 'user',
        targetId: user.id,
        newState: JSON.stringify({ roles: user.roles })
      });

      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      next(error);
    }
  });

  // Institute Management
  app.get("/api/admin/institutes", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const institutes = await storage.getAllInstitutes();
      res.json(institutes);
    } catch (error) {
      next(error);
    }
  });

  // Mentor Management (Admin view)
  app.get("/api/admin/mentors", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const mentors = await storage.getAllMentors();
      res.json(mentors);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/mentors/:id/activate", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const mentor = await storage.updateMentor(req.params.id, {
        status: 'active',
        activatedAt: new Date()
      });

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'activate_mentor',
        targetType: 'mentor',
        targetId: mentor.id,
        newState: JSON.stringify({ status: 'active' })
      });

      res.json(mentor);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/mentors/:id/suspend", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { reason } = req.body;
      const mentor = await storage.updateMentor(req.params.id, {
        status: 'suspended',
        deactivatedAt: new Date(),
        deactivationReason: reason
      });

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'suspend_mentor',
        targetType: 'mentor',
        targetId: mentor.id,
        newState: JSON.stringify({ status: 'suspended' }),
        notes: reason
      });

      res.json(mentor);
    } catch (error) {
      next(error);
    }
  });

  // Get single mentor details
  app.get("/api/admin/mentors/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const mentor = await storage.getMentor(req.params.id);
      if (!mentor) {
        return res.status(404).json({ message: 'Mentor not found' });
      }
      res.json(mentor);
    } catch (error) {
      next(error);
    }
  });

  // Get mentor KPIs
  app.get("/api/admin/mentors/:id/kpis", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const kpis = await storage.getMentorKpis(req.params.id);
      res.json(kpis);
    } catch (error) {
      next(error);
    }
  });

  // Get mentor payouts
  app.get("/api/admin/mentors/:id/payouts", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const payouts = await storage.getMentorPayouts(req.params.id);
      res.json(payouts);
    } catch (error) {
      next(error);
    }
  });

  // Get mentor violations
  app.get("/api/admin/mentors/:id/violations", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const violations = await storage.getMentorViolations(req.params.id);
      res.json(violations);
    } catch (error) {
      next(error);
    }
  });

  // Get mentor tasks
  app.get("/api/admin/mentors/:id/tasks", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const tasks = await storage.getMentorTasks(req.params.id);
      res.json(tasks);
    } catch (error) {
      next(error);
    }
  });

  // Get mentor training enrollments
  app.get("/api/admin/mentors/:id/training", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const enrollments = await storage.getTrainingEnrollments(req.params.id);
      res.json(enrollments);
    } catch (error) {
      next(error);
    }
  });

  // Issue warning to mentor
  app.post("/api/admin/mentors/:id/warn", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { reason } = req.body;
      const mentor = await storage.updateMentor(req.params.id, {
        status: 'warning',
        warningIssuedAt: new Date(),
        warningReason: reason
      });

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'warn_mentor',
        targetType: 'mentor',
        targetId: mentor.id,
        newState: JSON.stringify({ status: 'warning', reason }),
        notes: reason
      });

      res.json(mentor);
    } catch (error) {
      next(error);
    }
  });

  // Reactivate suspended mentor
  app.post("/api/admin/mentors/:id/reactivate", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { notes } = req.body;
      const mentor = await storage.updateMentor(req.params.id, {
        status: 'active',
        activatedAt: new Date(),
        suspendedAt: null,
        suspensionReason: null,
        warningIssuedAt: null,
        warningReason: null
      });

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'reactivate_mentor',
        targetType: 'mentor',
        targetId: mentor.id,
        newState: JSON.stringify({ status: 'active' }),
        notes: notes || 'Reactivated after suspension'
      });

      res.json(mentor);
    } catch (error) {
      next(error);
    }
  });

  // Create task assignment for mentor
  app.post("/api/admin/mentors/:id/tasks", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { taskType, title, description, scheduledDate, duration, location, isOnline, meetingLink } = req.body;
      const task = await storage.createMentorTask({
        mentorId: req.params.id,
        taskType,
        title,
        description,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
        duration,
        location,
        isOnline: isOnline ?? true,
        meetingLink,
        status: 'assigned',
        createdBy: req.user!.id
      });

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'assign_task',
        targetType: 'mentor',
        targetId: req.params.id,
        newState: JSON.stringify({ taskId: task.id, title }),
        notes: `Assigned task: ${title}`
      });

      res.json(task);
    } catch (error) {
      next(error);
    }
  });

  // Update mentor task status
  app.patch("/api/admin/mentors/tasks/:taskId", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { status, notes, feedback, rating } = req.body;
      const task = await storage.updateMentorTask(req.params.taskId, {
        status,
        notes,
        feedback,
        rating,
        completedAt: status === 'completed' ? new Date() : undefined
      });

      res.json(task);
    } catch (error) {
      next(error);
    }
  });

  // Report violation against mentor
  app.post("/api/admin/mentors/:id/violations", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { violationType, severity, description, evidenceUrl } = req.body;
      const violation = await storage.createComplianceViolation({
        mentorId: req.params.id,
        violationType,
        severity,
        description,
        evidenceUrl,
        reportedBy: req.user!.id,
        status: 'reported'
      });

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'report_violation',
        targetType: 'mentor',
        targetId: req.params.id,
        newState: JSON.stringify({ violationId: violation.id, type: violationType, severity }),
        notes: description
      });

      res.json(violation);
    } catch (error) {
      next(error);
    }
  });

  // Resolve violation
  app.patch("/api/admin/violations/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { resolution, actionTaken, status } = req.body;
      const violation = await storage.updateComplianceViolation(req.params.id, {
        resolution,
        actionTaken,
        status,
        resolvedBy: req.user!.id,
        resolvedAt: status === 'resolved' ? new Date() : undefined
      });

      res.json(violation);
    } catch (error) {
      next(error);
    }
  });

  // Update mentor PHI (Performance Health Index)
  app.patch("/api/admin/mentors/:id/phi", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { performanceHealthIndex, notes } = req.body;
      const mentor = await storage.updateMentor(req.params.id, {
        performanceHealthIndex
      });

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'update_phi',
        targetType: 'mentor',
        targetId: req.params.id,
        newState: JSON.stringify({ performanceHealthIndex }),
        notes: notes || `PHI updated to ${performanceHealthIndex}`
      });

      res.json(mentor);
    } catch (error) {
      next(error);
    }
  });

  // Payout Management (Admin)
  app.get("/api/admin/payouts", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const payouts = await storage.getPendingPayouts();
      res.json(payouts);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/payouts/:id/approve", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const payout = await storage.updateMentorPayout(req.params.id, {
        status: 'approved',
        approvedBy: req.user!.id,
        approvedAt: new Date()
      });

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'approve_payout',
        targetType: 'payout',
        targetId: payout.id,
        newState: JSON.stringify({ status: 'approved' })
      });

      res.json(payout);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/payouts/:id/process", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { transactionRef } = req.body;
      const payout = await storage.updateMentorPayout(req.params.id, {
        status: 'completed',
        paidAt: new Date(),
        transactionRef
      });

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'process_payout',
        targetType: 'payout',
        targetId: payout.id,
        newState: JSON.stringify({ status: 'completed', transactionRef })
      });

      res.json(payout);
    } catch (error) {
      next(error);
    }
  });

  // Job Management (Admin view of all jobs)
  app.get("/api/admin/jobs", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const jobs = await storage.getAllJobPostings();
      res.json(jobs);
    } catch (error) {
      next(error);
    }
  });

  // Applications Management (Admin view of all applications)
  app.get("/api/admin/applications", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const stats = await storage.getApplicationStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  // Admin Audit Logs
  app.get("/api/admin/audit-logs", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { targetType, limit, startDate, endDate } = req.query;
      let logs = await storage.getAdminAuditLogs({
        targetType: targetType as string,
        limit: limit ? parseInt(limit as string) : 100
      });
      if (startDate) {
        const start = new Date(startDate as string);
        logs = logs.filter(l => l.createdAt && new Date(l.createdAt) >= start);
      }
      if (endDate) {
        const end = new Date((endDate as string) + 'T23:59:59');
        logs = logs.filter(l => l.createdAt && new Date(l.createdAt) <= end);
      }
      res.json(logs);
    } catch (error) {
      next(error);
    }
  });

  // Platform Settings
  app.get("/api/admin/settings", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { category } = req.query;
      const settings = await storage.getPlatformSettings(category as string);
      res.json(settings);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/admin/settings/:key", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { value, settingType, category, description } = req.body;
      const setting = await storage.upsertPlatformSetting({
        settingKey: req.params.key,
        settingValue: value,
        settingType: settingType || 'string',
        category: category || 'general',
        description,
        updatedBy: req.user!.id
      });

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'update_setting',
        targetType: 'setting',
        targetId: setting.id,
        newState: JSON.stringify({ key: req.params.key, value })
      });

      res.json(setting);
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // ENTITY CODE MANAGEMENT
  // ============================================

  // Generate entity code
  app.post("/api/admin/entity-codes/generate", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { entityType, entityId, codeType, maxUsage, validUntil } = req.body;
      
      // Generate unique code based on entity type
      const prefix = entityType.substring(0, 3).toUpperCase();
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();
      const code = `${prefix}-${random}-${Date.now().toString(36).toUpperCase().substring(-4)}`;
      
      const entityCode = await storage.createEntityCode({
        entityType,
        entityId,
        code,
        codeType: codeType || 'standard',
        status: 'active',
        generatedBy: req.user!.id,
        validFrom: new Date(),
        validUntil: validUntil ? new Date(validUntil) : null,
        maxUsage: maxUsage || null,
        usageCount: 0
      });

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'generate_entity_code',
        targetType: 'entity_code',
        targetId: entityCode.id,
        newState: JSON.stringify({ code, entityType, entityId })
      });

      res.json(entityCode);
    } catch (error) {
      next(error);
    }
  });

  // Get all entity codes
  app.get("/api/admin/entity-codes", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { entityType, status, limit } = req.query;
      const codes = await storage.getEntityCodes({
        entityType: entityType as string,
        status: status as string,
        limit: limit ? parseInt(limit as string) : 100
      });
      res.json(codes);
    } catch (error) {
      next(error);
    }
  });

  // Revoke entity code
  app.post("/api/admin/entity-codes/:id/revoke", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { reason } = req.body;
      const entityCode = await storage.updateEntityCode(req.params.id, {
        status: 'revoked',
        revokedAt: new Date(),
        revokedReason: reason
      });

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'revoke_entity_code',
        targetType: 'entity_code',
        targetId: entityCode.id,
        newState: JSON.stringify({ status: 'revoked' }),
        notes: reason
      });

      res.json(entityCode);
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // PLATFORM SETTINGS
  // ============================================

  app.get("/api/admin/platform-settings", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const category = req.query.category as string | undefined;
      const settings = await storage.getPlatformSettings(category);
      res.json(settings);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/platform-settings/:key", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const setting = await storage.getPlatformSetting(req.params.key);
      if (!setting) return res.status(404).json({ message: "Setting not found" });
      res.json(setting);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/admin/platform-settings", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { settingKey, settingValue, settingType, category, description } = req.body;
      if (!settingKey || settingValue === undefined) {
        return res.status(400).json({ message: "settingKey and settingValue are required" });
      }

      const oldSetting = await storage.getPlatformSetting(settingKey);
      const result = await storage.upsertPlatformSetting({
        settingKey,
        settingValue: String(settingValue),
        settingType: settingType || 'string',
        category: category || 'general',
        description: description || null,
        updatedBy: req.user!.id,
      });

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'update_setting',
        targetType: 'platform_setting',
        targetId: result.id,
        previousState: oldSetting ? JSON.stringify({ value: oldSetting.settingValue }) : null,
        newState: JSON.stringify({ value: settingValue }),
        notes: `Updated setting: ${settingKey}`,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/admin/platform-settings/bulk", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { settings } = req.body;
      if (!Array.isArray(settings)) {
        return res.status(400).json({ message: "settings array is required" });
      }

      const results = [];
      for (const s of settings) {
        const result = await storage.upsertPlatformSetting({
          settingKey: s.settingKey,
          settingValue: String(s.settingValue),
          settingType: s.settingType || 'string',
          category: s.category || 'general',
          description: s.description || null,
          updatedBy: req.user!.id,
        });
        results.push(result);
      }

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'bulk_update_settings',
        targetType: 'platform_setting',
        targetId: 'bulk',
        newState: JSON.stringify({ count: results.length }),
        notes: `Bulk updated ${results.length} settings`,
      });

      res.json(results);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/platform-settings/seed-defaults", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const defaults = [
        { settingKey: 'maintenance_mode', settingValue: 'false', settingType: 'boolean', category: 'general', description: 'Enable maintenance mode to restrict access' },
        { settingKey: 'registration_enabled', settingValue: 'true', settingType: 'boolean', category: 'general', description: 'Allow new user registrations' },
        { settingKey: 'email_notifications', settingValue: 'true', settingType: 'boolean', category: 'notifications', description: 'Enable email notifications for users' },
        { settingKey: 'sms_notifications', settingValue: 'false', settingType: 'boolean', category: 'notifications', description: 'Enable SMS notifications for users' },
        { settingKey: 'push_notifications', settingValue: 'false', settingType: 'boolean', category: 'notifications', description: 'Enable push notifications for users' },
        { settingKey: 'two_factor_required', settingValue: 'false', settingType: 'boolean', category: 'security', description: 'Require two-factor authentication for all users' },
        { settingKey: 'session_timeout_minutes', settingValue: '60', settingType: 'number', category: 'security', description: 'Session timeout in minutes' },
        { settingKey: 'max_login_attempts', settingValue: '5', settingType: 'number', category: 'security', description: 'Maximum login attempts before lockout' },
        { settingKey: 'lockout_duration_minutes', settingValue: '30', settingType: 'number', category: 'security', description: 'Account lockout duration in minutes' },
        { settingKey: 'password_min_length', settingValue: '8', settingType: 'number', category: 'security', description: 'Minimum password length' },
        { settingKey: 'password_require_uppercase', settingValue: 'true', settingType: 'boolean', category: 'security', description: 'Require uppercase letters in passwords' },
        { settingKey: 'password_require_numbers', settingValue: 'true', settingType: 'boolean', category: 'security', description: 'Require numbers in passwords' },
        { settingKey: 'password_require_special', settingValue: 'true', settingType: 'boolean', category: 'security', description: 'Require special characters in passwords' },
        { settingKey: 'payment_gateway', settingValue: 'none', settingType: 'string', category: 'integrations', description: 'Active payment gateway provider' },
        { settingKey: 'payment_gateway_test_mode', settingValue: 'true', settingType: 'boolean', category: 'integrations', description: 'Use test/sandbox mode for payment gateway' },
        { settingKey: 'email_service', settingValue: 'none', settingType: 'string', category: 'integrations', description: 'Active email service provider' },
        { settingKey: 'sms_service', settingValue: 'none', settingType: 'string', category: 'integrations', description: 'Active SMS service provider' },
        { settingKey: 'analytics_enabled', settingValue: 'false', settingType: 'boolean', category: 'integrations', description: 'Enable analytics tracking' },
        { settingKey: 'platform_name', settingValue: 'MetryxOne', settingType: 'string', category: 'general', description: 'Platform display name' },
        { settingKey: 'support_email', settingValue: 'support@metryxone.com', settingType: 'string', category: 'general', description: 'Support email address' },
        { settingKey: 'max_file_upload_mb', settingValue: '10', settingType: 'number', category: 'general', description: 'Maximum file upload size in MB' },
        { settingKey: 'default_language', settingValue: 'en', settingType: 'string', category: 'general', description: 'Default platform language' },
        { settingKey: 'data_retention_days', settingValue: '365', settingType: 'number', category: 'compliance', description: 'Data retention period in days' },
        { settingKey: 'audit_log_retention_days', settingValue: '730', settingType: 'number', category: 'compliance', description: 'Audit log retention period in days' },
        { settingKey: 'dpdp_consent_required', settingValue: 'true', settingType: 'boolean', category: 'compliance', description: 'Require DPDP consent for data processing' },
        { settingKey: 'auto_delete_inactive_accounts', settingValue: 'false', settingType: 'boolean', category: 'compliance', description: 'Auto-delete inactive user accounts' },
        { settingKey: 'inactive_account_days', settingValue: '365', settingType: 'number', category: 'compliance', description: 'Days of inactivity before auto-deletion' },
        { settingKey: 'counsellor_whatsapp_number', settingValue: '919999999999', settingType: 'string', category: 'general', description: 'Global WhatsApp number for the counsellor escalation CTA shown to users who need human support' },
      ];

      const results = [];
      for (const d of defaults) {
        const existing = await storage.getPlatformSetting(d.settingKey);
        if (!existing) {
          const result = await storage.upsertPlatformSetting({
            ...d,
            updatedBy: req.user!.id,
          });
          results.push(result);
        }
      }

      res.json({ seeded: results.length, total: defaults.length, message: `${results.length} new settings created, ${defaults.length - results.length} already existed` });
    } catch (error) {
      next(error);
    }
  });

  // ── Email Template Preview ────────────────────────────────────────────────
  // Returns rendered HTML directly so it can be opened in a browser tab.
  // Uses synthetic sample data — no DB access required.
  app.get("/api/admin/email-preview/capadex-report", requireAuth, requireSuperAdmin, async (req, res) => {
    /** Escape user-supplied text so it is safe to embed inside HTML. */
    const escapeHtml = (s: string): string =>
      s.replace(/&/g, '&amp;')
       .replace(/</g, '&lt;')
       .replace(/>/g, '&gt;')
       .replace(/"/g, '&quot;')
       .replace(/'/g, '&#x27;');

    try {
      const VALID_STAGES = ['CAP_CUR', 'CAP_INS', 'CAP_GRW', 'CAP_MAS'] as const;
      type StageCode = typeof VALID_STAGES[number];
      const stageLabelMap: Record<StageCode, string> = {
        CAP_CUR: 'Curiosity', CAP_INS: 'Insight', CAP_GRW: 'Growth', CAP_MAS: 'Mastery',
      };

      // Stage — strict allowlist, never taken verbatim from user input
      const rawStage = (req.query.stage as string | undefined) || 'CAP_CUR';
      const stage: StageCode = (VALID_STAGES as readonly string[]).includes(rawStage)
        ? (rawStage as StageCode)
        : 'CAP_CUR';

      // Score — parse then clamp; NaN falls back to 62
      const rawScore = parseInt((req.query.score as string | undefined) || '62', 10);
      const score = Math.max(0, Math.min(100, Number.isFinite(rawScore) ? rawScore : 62));

      // Concern — strip tags, limit length, then HTML-escape
      const rawConcern = (req.query.concern as string | undefined) || 'Screen Addiction';
      const strippedConcern = rawConcern.replace(/<[^>]*>/g, '').trim().slice(0, 120);
      const concern = escapeHtml(strippedConcern) || 'Screen Addiction';

      const scoreLevel = score >= 80 ? 'Advanced' : score >= 65 ? 'Proficient' : score >= 40 ? 'Developing' : 'Emerging';

      const sampleSubdomains = [
        { subdomain_name: 'Self-Regulation',    avg_score: Math.min(100, score + 8),  item_count: 4 },
        { subdomain_name: 'Impulse Control',    avg_score: Math.max(0, score - 10),   item_count: 4 },
        { subdomain_name: 'Focus Endurance',    avg_score: score,                      item_count: 3 },
        { subdomain_name: 'Time Management',    avg_score: Math.min(100, score + 4),  item_count: 3 },
        { subdomain_name: 'Emotional Awareness',avg_score: Math.max(0, score - 5),    item_count: 3 },
      ];

      // Optional: render a real report (with its dynamic narrative / OMEGA-X /
      // telemetry / provenance) when `reportId` is supplied. Falls back to the
      // synthetic sample below on any miss/error so the preview always renders.
      const rawReportId = (req.query.reportId as string | undefined)?.trim();
      let realInput: Parameters<typeof buildCapadexReportHtml>[1] | null = null;
      let realName = 'Sample Participant';
      if (rawReportId) {
        try {
          const rr = await concernsPool.query(
            `SELECT r.*, u.name AS user_name, u.email AS user_email
             FROM capadex_reports r LEFT JOIN capadex_users u ON u.id = r.user_id
             WHERE r.id = $1`,
            [rawReportId],
          );
          const row = rr.rows[0];
          if (row) {
            const realScore = row.score_override != null && row.review_status === 'published'
              ? Number(row.score_override) : Number(row.score);
            const realSubs = Array.isArray(row.subdomains)
              ? row.subdomains
              : (row.subdomains ? JSON.parse(row.subdomains) : []);
            const { omega, telemetry } = row.session_id
              ? await buildOmegaEmailExtras(concernsPool, row.session_id)
              : { omega: undefined, telemetry: undefined };
            const provMeta = (row.report_data || row.dynamic_report || {}) as Record<string, unknown>;
            realName = row.user_name || 'Participant';
            realInput = {
              concernName: row.concern_name,
              stageLabel: stageLabelMap[(row.stage_code as StageCode)] || row.stage_code || stage,
              stageCode: row.stage_code || stage,
              score: Math.round(realScore),
              scoreLevel: row.score_level || scoreLevel,
              insight: row.insight || '',
              subdomains: realSubs,
              reportId: row.id,
              reportUrl: undefined,
              recommendations: [],
              dynamic_report: row.dynamic_report || undefined,
              omega,
              telemetry,
              claritySource: (provMeta.clarity_source as string) || 'master_curated',
              contradictionCount: Number(provMeta.contradiction_count) || 0,
              pacingMs: Number(provMeta.telemetry_pacing_ms) || 1420,
            };
          }
        } catch (_e) { realInput = null; }
      }

      const { html, subject } = realInput
        ? buildCapadexReportHtml(realName, realInput)
        : buildCapadexReportHtml('Sample Participant', {
            concernName:  concern,
            stageLabel:   stageLabelMap[stage],
            stageCode:    stage,
            score,
            scoreLevel,
            insight:      `This is a preview render using stage ${stage} and a score of ${score}. No real user data is shown.`,
            subdomains:   sampleSubdomains,
            reportId:     'preview-sample-id',
            reportUrl:    undefined,
            recommendations: [],
          });

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data: https:; font-src https:;");
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Preview-Subject', encodeURIComponent(subject));
      res.send(html);
    } catch (err) {
      res.status(500).send(`<pre>Error building preview: ${escapeHtml(err instanceof Error ? err.message : String(err))}</pre>`);
    }
  });

  // ============================================
  // CONSENT MANAGEMENT (DPDP Compliance)
  // ============================================

  // Get all consent records
  app.get("/api/admin/consents", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { entityType, consentType, status, limit } = req.query;
      const consents = await storage.getConsentRecords({
        entityType: entityType as string,
        consentType: consentType as string,
        status: status as string,
        limit: limit ? parseInt(limit as string) : 100
      });
      res.json(consents);
    } catch (error) {
      next(error);
    }
  });

  // Get consent record by ID
  app.get("/api/admin/consents/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const consent = await storage.getConsentRecord(req.params.id);
      if (!consent) {
        return res.status(404).json({ message: "Consent record not found" });
      }
      res.json(consent);
    } catch (error) {
      next(error);
    }
  });

  // Create consent record
  app.post("/api/admin/consents", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const consent = await storage.createConsentRecord(req.body);
      
      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'create_consent',
        targetType: 'consent',
        targetId: consent.id,
        newState: JSON.stringify({ consentType: consent.consentType, status: consent.status })
      });

      res.json(consent);
    } catch (error) {
      next(error);
    }
  });

  // Update consent version across entities
  app.post("/api/admin/consents/upgrade-version", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { consentType, newVersion, newConsentText } = req.body;
      const updatedCount = await storage.upgradeConsentVersion(consentType, newVersion, newConsentText);
      
      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'upgrade_consent_version',
        targetType: 'consent',
        targetId: 'bulk',
        newState: JSON.stringify({ consentType, newVersion, affectedRecords: updatedCount })
      });

      res.json({ message: 'Consent version upgraded', affectedRecords: updatedCount });
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // ACCESS CONTROL MANAGEMENT
  // ============================================

  // Get role definitions
  app.get("/api/admin/roles", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const roles = await storage.getRoleDefinitions();
      res.json(roles);
    } catch (error) {
      next(error);
    }
  });

  // Create role definition
  app.post("/api/admin/roles", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const role = await storage.createRoleDefinition(req.body);
      
      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'create_role',
        targetType: 'role',
        targetId: role.id,
        newState: JSON.stringify({ roleName: role.roleName, displayName: role.displayName })
      });

      res.json(role);
    } catch (error) {
      next(error);
    }
  });

  // Get permission definitions
  app.get("/api/admin/permissions", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { category } = req.query;
      const permissions = await storage.getPermissionDefinitions(category as string);
      res.json(permissions);
    } catch (error) {
      next(error);
    }
  });

  // Create permission definition
  app.post("/api/admin/permissions", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const permission = await storage.createPermissionDefinition(req.body);
      res.json(permission);
    } catch (error) {
      next(error);
    }
  });

  // Get role permissions
  app.get("/api/admin/roles/:id/permissions", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const permissions = await storage.getRolePermissions(req.params.id);
      res.json(permissions);
    } catch (error) {
      next(error);
    }
  });

  // Assign permission to role
  app.post("/api/admin/roles/:roleId/permissions/:permissionId", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const rolePermission = await storage.assignRolePermission({
        roleId: req.params.roleId,
        permissionId: req.params.permissionId,
        grantedBy: req.user!.id
      });
      
      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'assign_permission',
        targetType: 'role_permission',
        targetId: rolePermission.id,
        newState: JSON.stringify({ roleId: req.params.roleId, permissionId: req.params.permissionId })
      });

      res.json(rolePermission);
    } catch (error) {
      next(error);
    }
  });

  // Remove permission from role
  app.delete("/api/admin/roles/:roleId/permissions/:permissionId", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      await storage.removeRolePermission(req.params.roleId, req.params.permissionId);
      
      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'remove_permission',
        targetType: 'role_permission',
        targetId: `${req.params.roleId}-${req.params.permissionId}`,
        notes: 'Permission removed from role'
      });

      res.json({ message: 'Permission removed from role' });
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // FILE UPLOAD CONFIGURATION
  // ============================================
  
  // Multer setup for file uploads
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
  });

  // ============================================
  // LEARNING BEHAVIOR (LBI/PSYCHOPSIS) ADMIN ROUTES
  // ============================================

  // Get behavioral insights for admin dashboard
  app.get("/api/admin/behavior-insights", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      // Get all behavioral insights
      const insights = await storage.getAllBehavioralInsights();
      
      // Calculate stats
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const thisMonthInsights = insights.filter((i: any) => new Date(i.recordedAt) >= startOfMonth);
      const avgScore = insights.length > 0 
        ? insights.reduce((sum: number, i: any) => sum + (i.value || 0), 0) / insights.length 
        : 0;
      
      // Group by category
      const categoryMap = new Map<string, { count: number; totalScore: number }>();
      for (const insight of insights) {
        const cat = insight.category || 'General';
        const existing = categoryMap.get(cat) || { count: 0, totalScore: 0 };
        categoryMap.set(cat, { 
          count: existing.count + 1, 
          totalScore: existing.totalScore + (insight.value || 0) 
        });
      }
      
      const categories = Array.from(categoryMap.entries()).map(([name, data]) => ({
        name,
        count: data.count,
        avgScore: data.count > 0 ? Math.round(data.totalScore / data.count) : 0
      }));
      
      // Transform insights for frontend with expected field names
      const transformedInsights = insights.map((i: any) => ({
        ...i,
        overallScore: i.value || 0,
        assessmentDate: i.recordedAt,
        assessmentType: 'LBI'
      }));
      
      res.json({
        insights: transformedInsights.slice(0, 100), // Return latest 100
        stats: {
          total: insights.length,
          thisMonth: thisMonthInsights.length,
          avgScore,
          categories
        }
      });
    } catch (error) {
      next(error);
    }
  });

  // Download behavioral insights template
  app.get("/api/admin/behavior-insights/template", requireAuth, requireSuperAdmin, (req, res) => {
    // Full schema: studentId, category, metric, value, description, recordedAt
    const csvContent = `studentId,category,metric,value,description,recordedAt
"student-001","Focus & Attention","Attention Span",75,"Good sustained attention during tasks","2026-01-15T10:30:00Z"
"student-001","Emotional Regulation","Stress Management",68,"Shows resilience under pressure","2026-01-15T10:30:00Z"
"student-002","Social Skills","Collaboration",82,"Works well in group settings","2026-01-16T09:00:00Z"
"student-002","Learning Motivation","Self-Directed Learning",71,"Shows initiative in learning","2026-01-16T09:00:00Z"
"student-003","Resilience","Problem Solving",79,"Persistent when facing challenges","2026-01-17T14:00:00Z"`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="behavior_insights_template.csv"');
    res.send(csvContent);
  });

  // Upload behavioral insights from CSV
  app.post("/api/admin/behavior-insights/upload", requireAuth, requireSuperAdmin, upload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const allowedMimeTypes = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
      if (!allowedMimeTypes.includes(req.file.mimetype) && !req.file.originalname.endsWith('.csv')) {
        return res.status(400).json({ message: 'Invalid file type. Please upload a CSV file.' });
      }

      const fileContent = req.file.buffer.toString('utf-8');
      
      let records;
      try {
        records = parse(fileContent, { columns: true, skip_empty_lines: true, trim: true });
      } catch (parseError) {
        return res.status(400).json({ message: 'Invalid CSV format.' });
      }

      if (records.length === 0) {
        return res.status(400).json({ message: 'No records found in the file' });
      }

      const requiredFields = ['studentId', 'category', 'metric', 'value'];
      const firstRecord = records[0] as Record<string, string>;
      const missingFields = requiredFields.filter(field => !(field in firstRecord));
      if (missingFields.length > 0) {
        return res.status(400).json({ message: `Missing required columns: ${missingFields.join(', ')}` });
      }

      const insights: any[] = [];
      const errors: { row: number; message: string }[] = [];

      for (let i = 0; i < (records as Record<string, string>[]).length; i++) {
        const record = (records as Record<string, string>[])[i];
        
        const value = parseFloat(record.value);
        if (isNaN(value) || value < 0 || value > 100) {
          errors.push({ row: i + 2, message: 'Value must be a number between 0 and 100' });
          continue;
        }

        insights.push({
          studentId: record.studentId,
          category: record.category,
          metric: record.metric,
          value,
          description: record.description || null,
          recordedAt: record.recordedAt ? new Date(record.recordedAt) : new Date()
        });
      }

      if (insights.length === 0) {
        return res.status(400).json({ message: 'No valid records found', errors });
      }

      const count = await storage.bulkCreateBehavioralInsights(insights);

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'bulk_upload_behavior_insights',
        targetType: 'behavioral_insights',
        targetId: 'bulk',
        notes: `Uploaded ${count} behavioral insights`
      });

      res.json({ 
        message: errors.length > 0 
          ? `Uploaded ${count} records with ${errors.length} rows skipped`
          : 'Records uploaded successfully',
        count,
        totalRows: (records as any[]).length,
        skippedRows: errors.length,
        errors: errors.slice(0, 10)
      });
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // ExamReadiness Index ADMIN ROUTES
  // ============================================

  // Get exam readiness data for admin dashboard
  app.get("/api/admin/exam-ready", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      // Get all child exams
      const exams = await storage.getAllChildExams();
      
      // Transform exams with calculated percentage
      const transformedExams = exams.map((e: any) => ({
        ...e,
        percentage: e.totalMarks > 0 ? ((e.score || 0) / e.totalMarks) * 100 : 0,
        subjectName: e.subject,
        examDate: e.createdAt
      }));
      
      // Calculate stats
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const thisMonthExams = transformedExams.filter((e: any) => new Date(e.examDate) >= startOfMonth);
      const avgScore = transformedExams.length > 0 
        ? transformedExams.reduce((sum: number, e: any) => sum + (e.percentage || 0), 0) / transformedExams.length 
        : 0;
      
      // Calculate pass rate (>=40% is passing)
      const passedExams = transformedExams.filter((e: any) => (e.percentage || 0) >= 40);
      const passRate = transformedExams.length > 0 ? (passedExams.length / transformedExams.length) * 100 : 0;
      
      // Group by subject
      const subjectMap = new Map<string, { count: number; totalScore: number }>();
      for (const exam of transformedExams) {
        const sub = exam.subjectName || 'Unknown';
        const existing = subjectMap.get(sub) || { count: 0, totalScore: 0 };
        subjectMap.set(sub, { 
          count: existing.count + 1, 
          totalScore: existing.totalScore + (exam.percentage || 0) 
        });
      }
      
      const subjects = Array.from(subjectMap.entries()).map(([name, data]) => ({
        name,
        count: data.count,
        avgScore: data.count > 0 ? Math.round(data.totalScore / data.count) : 0
      }));
      
      res.json({
        exams: transformedExams.slice(0, 100), // Return latest 100
        stats: {
          total: transformedExams.length,
          thisMonth: thisMonthExams.length,
          avgScore,
          passRate,
          subjects
        }
      });
    } catch (error) {
      next(error);
    }
  });

  // Download exam results template
  app.get("/api/admin/exam-ready/template", requireAuth, requireSuperAdmin, (req, res) => {
    // Full schema: childId, title, subject, grade, examType, status, score, totalMarks, dueDate, completedAt, improvedTopics, focusAreas
    const csvContent = `childId,title,subject,grade,examType,status,score,totalMarks,dueDate,completedAt,improvedTopics,focusAreas
"child-001","Math Unit Test 1","Mathematics","Class 8","Unit Test","completed",85,100,"2026-01-20T00:00:00Z","2026-01-18T14:30:00Z","Algebra;Geometry","Trigonometry"
"child-001","Science Quiz","Science","Class 8","Quiz","completed",18,20,"2026-01-22T00:00:00Z","2026-01-21T10:00:00Z","Physics","Chemistry"
"child-002","English Essay","English","Class 7","Assignment","completed",72,100,"2026-01-25T00:00:00Z","2026-01-24T16:00:00Z","Grammar","Vocabulary"
"child-002","Social Studies Test","Social Studies","Class 7","Test","pending",0,80,"2026-02-01T00:00:00Z","","History","Geography;Civics"
"child-003","Math Final","Mathematics","Class 9","Final Exam","completed",78,100,"2026-01-30T00:00:00Z","2026-01-29T11:00:00Z","Calculus;Statistics","Probability"`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="exam_results_template.csv"');
    res.send(csvContent);
  });

  // Upload exam results from CSV
  app.post("/api/admin/exam-ready/upload", requireAuth, requireSuperAdmin, upload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const allowedMimeTypes = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
      if (!allowedMimeTypes.includes(req.file.mimetype) && !req.file.originalname.endsWith('.csv')) {
        return res.status(400).json({ message: 'Invalid file type. Please upload a CSV file.' });
      }

      const fileContent = req.file.buffer.toString('utf-8');
      
      let records;
      try {
        records = parse(fileContent, { columns: true, skip_empty_lines: true, trim: true });
      } catch (parseError) {
        return res.status(400).json({ message: 'Invalid CSV format.' });
      }

      if (records.length === 0) {
        return res.status(400).json({ message: 'No records found in the file' });
      }

      const requiredFields = ['childId', 'title', 'subject', 'score', 'totalMarks'];
      const firstRecord = records[0] as Record<string, string>;
      const missingFields = requiredFields.filter(field => !(field in firstRecord));
      if (missingFields.length > 0) {
        return res.status(400).json({ message: `Missing required columns: ${missingFields.join(', ')}` });
      }

      const exams: any[] = [];
      const errors: { row: number; message: string }[] = [];

      for (let i = 0; i < (records as Record<string, string>[]).length; i++) {
        const record = (records as Record<string, string>[])[i];
        
        const score = parseFloat(record.score);
        const totalMarks = parseFloat(record.totalMarks);
        
        if (isNaN(score) || isNaN(totalMarks) || totalMarks <= 0) {
          errors.push({ row: i + 2, message: 'Invalid score or totalMarks' });
          continue;
        }

        exams.push({
          childId: record.childId,
          title: record.title,
          subject: record.subject,
          grade: record.grade || null,
          examType: record.examType || 'Test',
          status: record.status || 'completed',
          score,
          totalMarks,
          dueDate: record.dueDate ? new Date(record.dueDate) : null,
          completedAt: record.completedAt ? new Date(record.completedAt) : null,
          improvedTopics: record.improvedTopics ? record.improvedTopics.split(';').map((t: string) => t.trim()) : null,
          focusAreas: record.focusAreas ? record.focusAreas.split(';').map((t: string) => t.trim()) : null
        });
      }

      if (exams.length === 0) {
        return res.status(400).json({ message: 'No valid records found', errors });
      }

      const count = await storage.bulkCreateChildExams(exams);

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'bulk_upload_exam_results',
        targetType: 'child_exams',
        targetId: 'bulk',
        notes: `Uploaded ${count} exam results`
      });

      res.json({ 
        message: errors.length > 0 
          ? `Uploaded ${count} records with ${errors.length} rows skipped`
          : 'Records uploaded successfully',
        count,
        totalRows: (records as any[]).length,
        skippedRows: errors.length,
        errors: errors.slice(0, 10)
      });
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // QUESTION BANK ADMIN ROUTES
  // ============================================

  // Get question bank questions for admin
  app.get("/api/admin/question-bank", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { boardId, classId, subjectId, chapterId } = req.query;
      const questions = await storage.getQuestionBankQuestions({
        boardId: boardId as string,
        classId: classId as string,
        subjectId: subjectId as string,
        chapterId: chapterId as string
      });
      res.json(questions);
    } catch (error) {
      next(error);
    }
  });

  // Download question bank template - comprehensive with all blueprint fields
  app.get("/api/admin/question-bank/template", requireAuth, requireSuperAdmin, (req, res) => {
    // Complete schema covering question bank + ALL assessment blueprint fields
    // Question Core: questionCode, questionType, difficultyLevel, questionText
    // MCQ Options: optionA-E, correctOption
    // Scoring: marks, negativeMarks
    // Explanation: explanation, answerText (for descriptive)
    // Curriculum (human-readable): boardCode, classNumber, subjectName, chapterName, topicName
    // Blueprint Core: blueprintCode, blueprintName, assessmentType, totalMarks, durationMinutes, passingMarks, instructions
    // Blueprint Section: sectionName, sectionOrder, difficultyMix (Easy:Medium:Hard ratio), questionsCount, marksPerQuestion, sectionNegativeMarks, chapterScope, optionalQuestions
    // Advanced: passageId, caseStudyId, diagramUrl, tags, language
    // Status: isVerified, status
    const csvContent = `questionCode,questionType,difficultyLevel,questionText,optionA,optionB,optionC,optionD,optionE,correctOption,answerText,explanation,marks,negativeMarks,boardCode,classNumber,subjectName,chapterName,topicName,blueprintCode,blueprintName,assessmentType,totalMarks,durationMinutes,passingMarks,blueprintInstructions,sectionName,sectionOrder,difficultyMix,questionsCount,marksPerQuestion,sectionNegativeMarks,chapterScope,optionalQuestions,passageId,caseStudyId,diagramUrl,tags,language,isVerified,status
"QB-2026-001","MCQ","Easy","What is 2 + 2?","3","4","5","6","","B","","The sum of 2 and 2 is 4",1,0,"CBSE","10","Mathematics","Arithmetic","Basic Operations","BP-MATH-10","Class 10 Math Practice","Practice",50,60,20,"Attempt all questions.","Section A - Objective","1","40:40:20",10,1,0,"Full Syllabus",0,"","","","arithmetic;basic math","EN","false","Active"
"QB-2026-002","MCQ","Easy","What is the capital of India?","Mumbai","Delhi","Chennai","Kolkata","","B","","New Delhi is the capital of India",1,0,"CBSE","10","Social Studies","Geography","Indian States","BP-SST-10-UT","Unit Test Geography","Unit Test",25,30,10,"Section A is compulsory.","Section A - MCQ","1","50:30:20",5,1,0.25,"Chapter 1-3",0,"","","","geography;capitals","EN","false","Active"
"QB-2026-003","MCQ","Medium","Which planet is known as the Red Planet?","Venus","Mars","Jupiter","Saturn","","B","","Mars is called the Red Planet due to iron oxide",2,0.5,"CBSE","10","Science","Astronomy","Solar System","BP-SCI-10","Science Practice","Practice",100,90,35,"Use only blue/black pen.","Section A - Objective","1","30:50:20",20,2,0.5,"Full Syllabus",2,"","","","astronomy;planets","EN","false","Active"
"QB-2026-004","True/False","Easy","The Earth is flat.","True","False","","","","B","","The Earth is an oblate spheroid",1,0,"CBSE","8","Science","Geography","Earth Science","BP-SCI-8","Class 8 Science","Practice",50,45,20,"Mark T or F.","Section B - True/False","2","60:30:10",10,1,0,"Chapter 1-5",0,"","","","geography;earth","EN","false","Active"
"QB-2026-005","MCQ","Hard","What is the derivative of x²?","x","2x","x²","2x²","","B","","Using power rule: d/dx(x^n) = n*x^(n-1)",3,1,"CBSE","12","Mathematics","Calculus","Derivatives","BP-MATH-12-FE","Final Exam Mathematics","Final Exam",100,180,35,"Calculator not allowed.","Section C - Application","3","20:50:30",10,3,1,"Unit 4-6",0,"","","","calculus;derivatives","EN","true","Active"
"QB-2026-006","Descriptive","Medium","Explain the process of photosynthesis.","","","","","","","Photosynthesis is the process by which green plants convert sunlight, water and carbon dioxide into glucose and oxygen. The process occurs in chloroplasts using chlorophyll.","Light energy is converted to chemical energy stored in glucose",5,0,"CBSE","10","Biology","Botany","Plant Physiology","BP-BIO-10-FE","Biology Final Exam","Final Exam",80,120,28,"Answer in complete sentences.","Section D - Long Answer","4","30:40:30",5,5,0,"Full Syllabus",1,"","","","biology;photosynthesis","EN","false","Active"
"QB-2026-007","Fill-in-the-Blank","Easy","The chemical symbol for water is ___.","","","","","","H2O","","Water molecule contains 2 hydrogen and 1 oxygen atom",1,0,"CBSE","9","Chemistry","Basics","Chemical Formulas","BP-CHEM-9","Chemistry Practice","Practice",40,45,16,"Fill with correct answer.","Section A - Fill in Blanks","1","50:40:10",8,1,0,"Chapter 1-4",0,"","","","chemistry;formulas","EN","false","Active"
"QB-2026-008","Case Study","Hard","Based on the passage about climate change, what are the primary causes of global warming?","Deforestation","Industrial emissions","Both A and B","None of the above","","C","","The case study explains multiple factors contributing to global warming",4,1,"CBSE","12","Environmental Science","Climate","Global Warming","BP-EVS-12-BE","Board Exam EVS","Board Exam",100,180,35,"Read case study carefully.","Section E - Case Study","5","20:40:40",5,4,1,"Full Syllabus",1,"PASSAGE-001","CASE-001","","environment;climate","EN","true","Active"`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="question_bank_template.csv"');
    res.send(csvContent);
  });

  // Upload questions from CSV
  app.post("/api/admin/question-bank/upload", requireAuth, requireSuperAdmin, upload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      // Validate file type
      const allowedMimeTypes = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
      if (!allowedMimeTypes.includes(req.file.mimetype) && !req.file.originalname.endsWith('.csv')) {
        return res.status(400).json({ message: 'Invalid file type. Please upload a CSV file.' });
      }

      const { boardId, classId, subjectId } = req.body;
      const fileContent = req.file.buffer.toString('utf-8');
      
      // Parse CSV
      let records;
      try {
        records = parse(fileContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true
        });
      } catch (parseError) {
        return res.status(400).json({ message: 'Invalid CSV format. Please check the file and try again.' });
      }

      if (records.length === 0) {
        return res.status(400).json({ message: 'No questions found in the file' });
      }

      // Validate required fields
      const requiredFields = ['questionText', 'optionA', 'optionB', 'optionC', 'optionD', 'correctOption'];
      const firstRecord = records[0] as Record<string, string>;
      const missingFields = requiredFields.filter(field => !(field in firstRecord));
      if (missingFields.length > 0) {
        return res.status(400).json({ message: `Missing required columns: ${missingFields.join(', ')}` });
      }

      // Get curriculum mappings if codes are provided
      const boards = await storage.getEducationBoards();
      const boardMap = new Map(boards.map((b: any) => [b.boardCode, b.id]));

      const questions: any[] = [];
      const errors: { row: number; message: string }[] = [];
      
      for (let i = 0; i < (records as Record<string, string>[]).length; i++) {
        const record = (records as Record<string, string>[])[i];
        
        // Validate row data
        if (!record.questionText || record.questionText.trim().length < 5) {
          errors.push({ row: i + 2, message: 'Question text is too short (minimum 5 characters)' });
          continue;
        }
        
        const validOptions = ['A', 'B', 'C', 'D'];
        const correctOption = record.correctOption?.toUpperCase();
        if (!validOptions.includes(correctOption)) {
          errors.push({ row: i + 2, message: `Invalid correct option "${record.correctOption}". Must be A, B, C, or D` });
          continue;
        }

        // Determine IDs
        let qBoardId = boardId;
        let qClassId = classId;
        let qSubjectId = subjectId;

        // If board code is provided in the record, try to map it
        if (record.boardCode && !qBoardId) {
          qBoardId = boardMap.get(record.boardCode);
        }

        // Generate question code if not provided
        const questionCode = record.questionCode?.trim() || `QB-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

        // Parse tags if provided (semicolon-separated)
        const tags = record.tags ? record.tags.split(';').map((t: string) => t.trim()).filter((t: string) => t) : null;

        // Create question object with all schema columns
        questions.push({
          questionCode,
          questionType: record.questionType?.trim() || 'MCQ',
          difficultyLevel: ['Easy', 'Medium', 'Hard'].includes(record.difficultyLevel) ? record.difficultyLevel : 'Medium',
          questionText: record.questionText.trim(),
          optionA: record.optionA?.trim() || '',
          optionB: record.optionB?.trim() || '',
          optionC: record.optionC?.trim() || '',
          optionD: record.optionD?.trim() || '',
          correctOption,
          explanation: record.explanation?.trim() || null,
          marks: parseInt(record.marks) || 1,
          negativeMarks: parseFloat(record.negativeMarks) || 0,
          tags,
          boardId: record.boardId?.trim() || qBoardId || null,
          classId: record.classId?.trim() || qClassId || null,
          subjectId: record.subjectId?.trim() || qSubjectId || null,
          chapterId: record.chapterId?.trim() || null,
          topicId: record.topicId?.trim() || null,
          isVerified: record.isVerified?.toLowerCase() === 'true',
          status: record.status?.trim() || 'Active'
        });
      }

      if (questions.length === 0) {
        return res.status(400).json({ 
          message: 'No valid questions found in the file',
          errors 
        });
      }

      // Bulk insert
      const count = await storage.bulkCreateQuestionBankQuestions(questions);

      // Audit log
      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'bulk_upload_questions',
        targetType: 'question_bank',
        targetId: 'bulk',
        notes: `Uploaded ${count} questions`
      });

      const response: any = { 
        message: errors.length > 0 
          ? `Uploaded ${count} questions with ${errors.length} rows skipped due to validation errors`
          : 'Questions uploaded successfully', 
        count,
        totalRows: (records as any[]).length,
        validRows: count,
        skippedRows: errors.length
      };
      
      if (errors.length > 0) {
        response.errors = errors.slice(0, 10); // Return first 10 errors
      }

      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // PSYCHOPSIS QUESTION BANK ADMIN ROUTES
  // ============================================

  // Download LBI question bank template
  app.get("/api/admin/lbi-questions/template", requireAuth, requireSuperAdmin, (req, res) => {
    // Comprehensive LBI template with domain/subdomain reference, sample codes, and anchor column
    // Line 1: Header row
    // Lines 2+: Reference sheet showing all 19 domains, their subdomains, codes, and sample questions
    const header = 'domainCode,domainName,subdomainCode,subdomainName,questionCode,ageBandCode,questionType,questionText,passageText,keying,optionA,optionAScore,optionB,optionBScore,optionC,optionCScore,optionD,optionDScore,correctAnswer,explanation,anchor,status';
    
    const sampleRows = [
      // D01 - ACE: Academic & Cognitive Effectiveness (6 subdomains)
      '"ACE","Academic & Cognitive Effectiveness","ACE_SD01","Learning Efficiency","ACE_A_001","A","likert","I can quickly understand new concepts when they are explained to me.","","Positive","Strongly Disagree",1,"Disagree",2,"Agree",3,"Strongly Agree",4,"","Measures learning efficiency","Yes","Active"',
      '"ACE","Academic & Cognitive Effectiveness","ACE_SD02","Conceptual Understanding","ACE_B_001","B","likert","I can explain what I have learned in my own words.","","Positive","Strongly Disagree",1,"Disagree",2,"Agree",3,"Strongly Agree",4,"","Measures conceptual understanding","No","Active"',
      '"ACE","Academic & Cognitive Effectiveness","ACE_SD03","Working & Retrieval Memory","ACE_A_002","A","likert","I often forget what I studied the day before.","","Negative","Strongly Disagree",4,"Disagree",3,"Agree",2,"Strongly Agree",1,"","Reverse scored - measures memory retention","No","Active"',
      '"ACE","Academic & Cognitive Effectiveness","ACE_SD04","Sustained Attention","ACE_C_001","C","likert","I can concentrate on a task for extended periods without getting distracted.","","Positive","Strongly Disagree",1,"Disagree",2,"Agree",3,"Strongly Agree",4,"","Measures sustained attention","No","Active"',
      '"ACE","Academic & Cognitive Effectiveness","ACE_SD05","Learning Style","ACE_A_003","A","likert","I learn better when I can see pictures or diagrams.","","Positive","Strongly Disagree",1,"Disagree",2,"Agree",3,"Strongly Agree",4,"","Identifies learning style preference","No","Active"',
      '"ACE","Academic & Cognitive Effectiveness","ACE_SD06","Processing Stability","ACE_B_002","B","likert","My ability to understand things stays consistent throughout the day.","","Positive","Strongly Disagree",1,"Disagree",2,"Agree",3,"Strongly Agree",4,"","Measures processing stability","No","Active"',
      // D02 - TQP: Thinking Quality Under Pressure (8 subdomains)
      '"TQP","Thinking Quality Under Pressure","TQP_SD01","Analytical & Critical Thinking","TQP_B_001","B","likert","When facing a difficult problem I try different approaches.","","Positive","Strongly Disagree",1,"Disagree",2,"Agree",3,"Strongly Agree",4,"","Measures analytical thinking","Yes","Active"',
      '"TQP","Thinking Quality Under Pressure","TQP_SD02","Decision Quality & Judgment","TQP_C_001","C","likert","I can make good decisions even when I am under pressure.","","Positive","Strongly Disagree",1,"Disagree",2,"Agree",3,"Strongly Agree",4,"","Measures decision quality","No","Active"',
      '"TQP","Thinking Quality Under Pressure","TQP_SD03","Managing Complexity","TQP_A_001","A","likert","I feel overwhelmed when I have to think about many things at once.","","Negative","Strongly Disagree",4,"Disagree",3,"Agree",2,"Strongly Agree",1,"","Reverse scored - complexity tolerance","No","Active"',
      // D03 - ESER: Examination Stress & Emotional Regulation (9 subdomains)
      '"ESER","Examination Stress & Emotional Regulation","ESER_SD01","Stress Reactivity","ESER_B_001","B","likert","I feel very nervous before exams.","","Negative","Strongly Disagree",4,"Disagree",3,"Agree",2,"Strongly Agree",1,"","Reverse scored - lower stress is better","Yes","Active"',
      '"ESER","Examination Stress & Emotional Regulation","ESER_SD02","Emotional Regulation Ability","ESER_C_001","C","likert","I can calm myself down when I feel upset or stressed.","","Positive","Never",1,"Sometimes",2,"Often",3,"Always",4,"","Measures emotional regulation","No","Active"',
      // D04 - CSCC: Confidence, Self-Concept & Comparison (9 subdomains)
      '"CSCC","Confidence Self-Concept & Comparison","CSCC_SD01","Academic Self-Confidence","CSCC_A_001","A","likert","I feel confident about my abilities as a student.","","Positive","Strongly Disagree",1,"Disagree",2,"Agree",3,"Strongly Agree",4,"","Measures self-confidence","Yes","Active"',
      '"CSCC","Confidence Self-Concept & Comparison","CSCC_SD04","Social Comparison Sensitivity","CSCC_B_001","B","likert","I frequently compare my grades with other students.","","Negative","Strongly Disagree",4,"Disagree",3,"Agree",2,"Strongly Agree",1,"","Measures social comparison","No","Active"',
      // D05 - ACC: Adjustment & Coping Capacity (4 subdomains)
      '"ACC","Adjustment & Coping Capacity","ACC_SD01","Academic Adjustment","ACC_C_001","C","likert","I have adapted well to the academic demands of my current level.","","Positive","Strongly Disagree",1,"Disagree",2,"Agree",3,"Strongly Agree",4,"","Measures academic adjustment","Yes","Active"',
      // D06 - SEI: Social & Emotional Intelligence (4 subdomains)
      '"SEI","Social & Emotional Intelligence (SQ & EQ)","SEI_SD01","Emotional Regulation","SEI_A_001","A","likert","I can tell when my friends are feeling sad or upset.","","Positive","Strongly Disagree",1,"Disagree",2,"Agree",3,"Strongly Agree",4,"","Measures emotional awareness","Yes","Active"',
      // D07 - DHC: Discipline, Habits & Consistency (6 subdomains)
      '"DHC","Discipline Habits & Consistency","DHC_SD01","Time Management","DHC_B_001","B","likert","I plan my study time and stick to my schedule.","","Positive","Strongly Disagree",1,"Disagree",2,"Agree",3,"Strongly Agree",4,"","Measures time management","Yes","Active"',
      // D08 - CE: Communication & Expression (5 subdomains)
      '"CE","Communication & Expression","CE_SD01","Listening","CE_A_001","A","likert","I pay close attention when my teacher is explaining something.","","Positive","Strongly Disagree",1,"Disagree",2,"Agree",3,"Strongly Agree",4,"","Measures listening skills","Yes","Active"',
      // D09 - MVR: Motivation, Values & Responsibility (5 subdomains)
      '"MVR","Motivation Values & Responsibility","MVR_SD01","Drive","MVR_C_001","C","likert","I am motivated to do well in my studies even when it is difficult.","","Positive","Strongly Disagree",1,"Disagree",2,"Agree",3,"Strongly Agree",4,"","Measures intrinsic drive","Yes","Active"',
      // D10 - LPE: Lifestyle & Pressure Environment (4 subdomains)
      '"LPE","Lifestyle & Pressure Environment","LPE_SD01","Digital Distraction","LPE_B_001","B","likert","I spend too much time on my phone or social media instead of studying.","","Negative","Strongly Disagree",4,"Disagree",3,"Agree",2,"Strongly Agree",1,"","Reverse scored - digital distraction","Yes","Active"',
      // D11 - CER: Competitive Exam Readiness (5 subdomains)
      '"CER","Competitive Exam Readiness","CER_SD01","Performance Stability","CER_C_001","C","likert","My test scores are consistent across different exams.","","Positive","Strongly Disagree",1,"Disagree",2,"Agree",3,"Strongly Agree",4,"","Measures performance stability","Yes","Active"',
      // D12 - IRCM: Integrated Root Cause Mapping (4 subdomains)
      '"IRCM","Integrated Root Cause Mapping","IRCM_SD01","Cross-Domain Synthesis","IRCM_D_001","D","likert","I can see connections between problems in different areas of my life.","","Positive","Strongly Disagree",1,"Disagree",2,"Agree",3,"Strongly Agree",4,"","Measures cross-domain synthesis","Yes","Active"',
      // D13 - APRI: Academic Planning & Recovery Intelligence (6 subdomains)
      '"APRI","Academic Planning & Recovery Intelligence","APRI_SD01","Planning Realism","APRI_B_001","B","likert","I set study goals that I can actually achieve.","","Positive","Strongly Disagree",1,"Disagree",2,"Agree",3,"Strongly Agree",4,"","Measures planning realism","Yes","Active"',
      // D14 - MSR: Metacognition & Self-Regulation (3 subdomains)
      '"MSR","Metacognition & Self-Regulation","MSR_SD01","Error Awareness","MSR_C_001","C","likert","I can usually tell when I have made a mistake on a test.","","Positive","Strongly Disagree",1,"Disagree",2,"Agree",3,"Strongly Agree",4,"","Measures error awareness","Yes","Active"',
      // D15 - HSSU: Help-Seeking & Support Utilization (3 subdomains)
      '"HSSU","Help-Seeking & Support Utilization","HSSU_SD01","Help-Seeking Hesitation","HSSU_A_001","A","likert","I feel shy about asking my teacher for help.","","Negative","Strongly Disagree",4,"Disagree",3,"Agree",2,"Strongly Agree",1,"","Reverse scored - help seeking","Yes","Active"',
      // D16 - AIM: Academic Identity & Meaning (3 subdomains)
      '"AIM","Academic Identity & Meaning","AIM_SD01","Subject Relevance Perception","AIM_B_001","B","likert","I understand why the subjects I study are important for my future.","","Positive","Strongly Disagree",1,"Disagree",2,"Agree",3,"Strongly Agree",4,"","Measures subject relevance","Yes","Active"',
      // D17 - TCA: Transition & Change Adaptability (6 subdomains)
      '"TCA","Transition & Change Adaptability","TCA_SD01","Flexibility","TCA_C_001","C","likert","I can adjust easily when my class schedule or routine changes.","","Positive","Strongly Disagree",1,"Disagree",2,"Agree",3,"Strongly Agree",4,"","Measures flexibility","Yes","Active"',
      // D18 - TSIS: Teacher-Student Interaction Sensitivity (3 subdomains)
      '"TSIS","Teacher-Student Interaction Sensitivity","TSIS_SD01","Teacher Relationship Quality","TSIS_A_001","A","likert","I feel comfortable talking to my teachers.","","Positive","Strongly Disagree",1,"Disagree",2,"Agree",3,"Strongly Agree",4,"","Measures teacher relationship","Yes","Active"',
      // D19 - OCR: Over-Compliance Risk (3 subdomains)
      '"OCR","Over-Compliance Risk","OCR_SD01","Excessive Compliance","OCR_B_001","B","likert","I always do what others tell me even when I disagree.","","Negative","Strongly Disagree",4,"Disagree",3,"Agree",2,"Strongly Agree",1,"","Measures over-compliance","Yes","Active"',
    ];

    // Add reference sheet as comment rows at the bottom
    const referenceHeader = '\n\n# DOMAIN & SUBDOMAIN REFERENCE (19 Domains - 97 Subdomains)';
    const referenceRows = [
      '# ──────────────────────────────────────────────────────────────────',
      '# D01 | ACE | Academic & Cognitive Effectiveness | Subdomains: ACE_SD01 (Learning Efficiency) | ACE_SD02 (Conceptual Understanding) | ACE_SD03 (Working & Retrieval Memory) | ACE_SD04 (Sustained Attention) | ACE_SD05 (Learning Style) | ACE_SD06 (Processing Stability)',
      '# D02 | TQP | Thinking Quality Under Pressure | Subdomains: TQP_SD01 (Analytical & Critical Thinking) | TQP_SD02 (Decision Quality & Judgment) | TQP_SD03 (Managing Complexity) | TQP_SD04 (Exam Strategy & Execution Skills) | TQP_SD05 (Strategy Execution) | TQP_SD06 (Complexity Tolerance) | TQP_SD07 (Error Handling & Adaptive Execution) | TQP_SD08 (Situational Judgment Check)',
      '# D03 | ESER | Examination Stress & Emotional Regulation | Subdomains: ESER_SD01 (Stress Reactivity) | ESER_SD02 (Emotional Regulation Ability) | ESER_SD03 (Cognitive Control Under Stress) | ESER_SD04 (Execution Stability) | ESER_SD05 (Recovery & Reset Speed) | ESER_SD06 (Stress Spillover Control) | ESER_SD07 (Anticipatory Stress Management) | ESER_SD08 (Emotional Insight & Awareness) | ESER_SD09 (Regulation Strategy Flexibility)',
      '# D04 | CSCC | Confidence Self-Concept & Comparison | Subdomains: CSCC_SD01 (Academic Self-Confidence) | CSCC_SD02 (Confidence Stability) | CSCC_SD03 (Self-Concept Clarity) | CSCC_SD04 (Social Comparison Sensitivity) | CSCC_SD05 (Fear of Negative Evaluation) | CSCC_SD06 (Competence Attribution Style) | CSCC_SD07 (External Validation Dependence) | CSCC_SD08 (Self-Doubt Intrusion) | CSCC_SD09 (Confidence-Performance Alignment)',
      '# D05 | ACC | Adjustment & Coping Capacity | Subdomains: ACC_SD01 (Academic Adjustment) | ACC_SD02 (Emotional Adjustment) | ACC_SD03 (Social Adjustment) | ACC_SD04 (Family Adjustment)',
      '# D06 | SEI | Social & Emotional Intelligence (SQ & EQ) | Subdomains: SEI_SD01 (Emotional Regulation) | SEI_SD02 (Relationships) | SEI_SD03 (Trust) | SEI_SD04 (Inclusion)',
      '# D07 | DHC | Discipline Habits & Consistency | Subdomains: DHC_SD01 (Time Management) | DHC_SD02 (Priority Management) | DHC_SD03 (Accountability) | DHC_SD04 (Execution) | DHC_SD05 (Plan-Execution Alignment) | DHC_SD06 (Consistency)',
      '# D08 | CE | Communication & Expression | Subdomains: CE_SD01 (Listening) | CE_SD02 (Expression) | CE_SD03 (Influence) | CE_SD04 (Conflict Handling) | CE_SD05 (Instruction Comprehension)',
      '# D09 | MVR | Motivation Values & Responsibility | Subdomains: MVR_SD01 (Drive) | MVR_SD02 (Commitment Stability) | MVR_SD03 (Integrity) | MVR_SD04 (Ownership Patterns) | MVR_SD05 (Effort Persistence)',
      '# D10 | LPE | Lifestyle & Pressure Environment | Subdomains: LPE_SD01 (Digital Distraction) | LPE_SD02 (Sleep Quality) | LPE_SD03 (Parental Pressure) | LPE_SD04 (Institutional Pressure)',
      '# D11 | CER | Competitive Exam Readiness | Subdomains: CER_SD01 (Performance Stability) | CER_SD02 (Pressure Tolerance) | CER_SD03 (Consistency) | CER_SD04 (Performance Variance) | CER_SD05 (Recovery Speed)',
      '# D12 | IRCM | Integrated Root Cause Mapping | Subdomains: IRCM_SD01 (Cross-Domain Synthesis) | IRCM_SD02 (Cross-Module Clustering) | IRCM_SD03 (Temporal Weighting) | IRCM_SD04 (Human Confirmation Required)',
      '# D13 | APRI | Academic Planning & Recovery Intelligence | Subdomains: APRI_SD01 (Planning Realism) | APRI_SD02 (Academic Prioritisation Intelligence) | APRI_SD03 (Recovery Capacity After Setbacks) | APRI_SD04 (Strategy Correction Ability) | APRI_SD05 (Execution Feasibility) | APRI_SD06 (Short-Term Recovery Window)',
      '# D14 | MSR | Metacognition & Self-Regulation | Subdomains: MSR_SD01 (Error Awareness) | MSR_SD02 (Strategy Switching) | MSR_SD03 (Self-Correction Timing)',
      '# D15 | HSSU | Help-Seeking & Support Utilization | Subdomains: HSSU_SD01 (Help-Seeking Hesitation) | HSSU_SD02 (Trust in Authority) | HSSU_SD03 (Response to Guidance)',
      '# D16 | AIM | Academic Identity & Meaning | Subdomains: AIM_SD01 (Subject Relevance Perception) | AIM_SD02 (Sense of Agency) | AIM_SD03 (Identity Alignment)',
      '# D17 | TCA | Transition & Change Adaptability | Subdomains: TCA_SD01 (Flexibility) | TCA_SD02 (Uncertainty Tolerance) | TCA_SD03 (Adaptation Speed) | TCA_SD04 (Multi-Domain Instability) | TCA_SD05 (Persistence of Disengagement) | TCA_SD06 (Recovery Delay)',
      '# D18 | TSIS | Teacher-Student Interaction Sensitivity | Subdomains: TSIS_SD01 (Teacher Relationship Quality) | TSIS_SD02 (Response to Feedback) | TSIS_SD03 (Classroom Comfort)',
      '# D19 | OCR | Over-Compliance Risk | Subdomains: OCR_SD01 (Excessive Compliance) | OCR_SD02 (Self-Neglect Patterns) | OCR_SD03 (Burnout Indicators)',
      '# ──────────────────────────────────────────────────────────────────',
      '# AGE BANDS: A (6-10) | B (11-14) | C (15-18) | D (18-21) | E (21-25) | E1 (22-30)',
      '# QUESTION TYPES: likert | multipleChoice | trueFalse',
      '# KEYING: Positive (higher = better) | Negative (reverse scored - lower = better)',
      '# ANCHOR: Yes (anchor/calibration item) | No (regular item)',
      '# QUESTION CODE FORMAT: {DomainCode}_{AgeBand}_{SeqNumber} e.g. ACE_A_001 | TQP_B_003 | ESER_C_012',
    ];
    
    const csvContent = header + '\n' + sampleRows.join('\n') + referenceHeader + '\n' + referenceRows.join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="lbi_questions_template.csv"');
    res.send(csvContent);
  });

  // Upload LBI questions from CSV
  app.post("/api/admin/lbi-questions/upload", requireAuth, requireSuperAdmin, upload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const allowedMimeTypes = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
      if (!allowedMimeTypes.includes(req.file.mimetype) && !req.file.originalname.endsWith('.csv')) {
        return res.status(400).json({ message: 'Invalid file type. Please upload a CSV file.' });
      }

      const fileContent = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
      
      let records;
      try {
        records = parse(fileContent, { columns: true, skip_empty_lines: true, trim: true, comment: '#', relax_column_count: true, bom: true });
      } catch (parseError) {
        return res.status(400).json({ message: 'Invalid CSV format.' });
      }

      if (records.length === 0) {
        return res.status(400).json({ message: 'No records found in the file' });
      }

      const firstRecord = records[0] as Record<string, string>;
      const keys = Object.keys(firstRecord).map(k => k.trim());
      const normalizedRecord: Record<string, string> = {};
      for (const key of Object.keys(firstRecord)) {
        normalizedRecord[key.trim()] = firstRecord[key];
      }

      const hasNewFormat = keys.includes('subdomainCode') || keys.includes('domainCode');
      const isNewFormat = hasNewFormat;
      
      if (isNewFormat) {
        const requiredFields = ['questionCode', 'subdomainCode', 'questionType', 'questionText'];
        const missingFields = requiredFields.filter(field => !keys.includes(field));
        if (missingFields.length > 0) {
          return res.status(400).json({ message: `Missing required columns: ${missingFields.join(', ')}` });
        }
      } else {
        const requiredFields = ['questionCode', 'questionType', 'questionText'];
        const hasSubModule = keys.includes('subModuleId');
        const hasSubdomain = keys.includes('subdomainCode');
        if (!hasSubModule && !hasSubdomain) {
          return res.status(400).json({ message: `Missing required columns: subdomainCode (use the template for correct format)` });
        }
        const missingFields = requiredFields.filter(field => !keys.includes(field));
        if (missingFields.length > 0) {
          return res.status(400).json({ message: `Missing required columns: ${missingFields.join(', ')}` });
        }
      }

      const questions: any[] = [];
      const errors: { row: number; message: string }[] = [];
      
      // Get all sub-modules and age groups to map codes to IDs
      const allSubModules = await storage.getAllSubModules();
      const ageGroups = await storage.getAgeGroups();
      
      const allModules = await storage.getModules();
      
      const subModuleCodeToId = new Map<string, string>();
      
      const domainAbbrToModuleCode = new Map<string, string>();
      const domainAbbrMap: Record<string, string> = {
        'ACE': 'D01', 'TQP': 'D02', 'ESER': 'D03', 'CSCC': 'D04', 'ACC': 'D05',
        'SEI': 'D06', 'DHC': 'D07', 'CE': 'D08', 'MVR': 'D09', 'LPE': 'D10',
        'CER': 'D11', 'IRCM': 'D12', 'APRI': 'D13', 'MSR': 'D14', 'HSSU': 'D15',
        'AIM': 'D16', 'TCA': 'D17', 'TSIS': 'D18', 'OCR': 'D19'
      };
      for (const [abbr, code] of Object.entries(domainAbbrMap)) {
        domainAbbrToModuleCode.set(abbr.toUpperCase(), code);
        domainAbbrToModuleCode.set(abbr.toLowerCase(), code);
      }
      
      const moduleCodeToSubModules = new Map<string, typeof allSubModules>();
      for (const sm of allSubModules) {
        subModuleCodeToId.set(sm.subModuleCode.toLowerCase(), sm.id);
        subModuleCodeToId.set(sm.subModuleCode.toUpperCase(), sm.id);
        subModuleCodeToId.set(sm.id.toLowerCase(), sm.id);
        subModuleCodeToId.set(sm.id, sm.id);
        
        const moduleCode = sm.moduleId;
        if (!moduleCodeToSubModules.has(moduleCode)) {
          moduleCodeToSubModules.set(moduleCode, []);
        }
        moduleCodeToSubModules.get(moduleCode)!.push(sm);
      }
      
      for (const [abbr, moduleCode] of Object.entries(domainAbbrMap)) {
        const subs = moduleCodeToSubModules.get(moduleCode) || [];
        subs.sort((a, b) => a.subModuleCode.localeCompare(b.subModuleCode));
        subs.forEach((sm, idx) => {
          const templateCode = `${abbr}_SD${String(idx + 1).padStart(2, '0')}`;
          subModuleCodeToId.set(templateCode.toUpperCase(), sm.id);
          subModuleCodeToId.set(templateCode.toLowerCase(), sm.id);
        });
      }
      
      const bareGroupToFirstSubdomain = new Map<string, string>();
      for (const sm of allSubModules) {
        const match = sm.subModuleCode.match(/^(SD\d+)_\d+$/i);
        if (match) {
          const bareCode = match[1].toUpperCase();
          if (!bareGroupToFirstSubdomain.has(bareCode)) {
            bareGroupToFirstSubdomain.set(bareCode, sm.id);
            bareGroupToFirstSubdomain.set(bareCode.toLowerCase(), sm.id);
          }
        }
      }
      
      const ageBandToId = new Map<string, string>();
      for (const ag of ageGroups) {
        ageBandToId.set(ag.groupCode.toLowerCase(), ag.id);
        ageBandToId.set(ag.groupCode.toUpperCase(), ag.id);
      }

      for (let i = 0; i < (records as Record<string, string>[]).length; i++) {
        const record = (records as Record<string, string>[])[i];
        
        let resolvedSubModuleId: string | undefined;
        let resolvedAgeBandId: string | undefined;
        
        if (isNewFormat) {
          // New format: subdomainCode like SD01_01, ageBandCode like A/B/C
          const subdomainCode = record.subdomainCode?.trim();
          const ageBandCode = record.ageBandCode?.trim();
          
          if (!subdomainCode) {
            errors.push({ row: i + 2, message: 'subdomainCode is required (e.g., SD01_01)' });
            continue;
          }
          
          resolvedSubModuleId = subModuleCodeToId.get(subdomainCode.toUpperCase()) || 
                               subModuleCodeToId.get(subdomainCode.toLowerCase()) ||
                               subModuleCodeToId.get(subdomainCode) ||
                               bareGroupToFirstSubdomain.get(subdomainCode.toUpperCase()) ||
                               bareGroupToFirstSubdomain.get(subdomainCode.toLowerCase());
          
          // Resolve age band code (A, B, C)
          if (ageBandCode) {
            resolvedAgeBandId = ageBandToId.get(ageBandCode.toUpperCase()) || ageBandToId.get(ageBandCode.toLowerCase());
          }
        } else {
          // Legacy format: subModuleId can be SD01_01, direct ID, etc.
          const subModuleInput = record.subModuleId?.trim();
          if (!subModuleInput) {
            errors.push({ row: i + 2, message: 'subModuleId is required' });
            continue;
          }
          
          resolvedSubModuleId = subModuleCodeToId.get(subModuleInput.toUpperCase()) || 
                               subModuleCodeToId.get(subModuleInput.toLowerCase()) ||
                               subModuleCodeToId.get(subModuleInput) ||
                               bareGroupToFirstSubdomain.get(subModuleInput.toUpperCase()) ||
                               bareGroupToFirstSubdomain.get(subModuleInput.toLowerCase());
        }
        
        if (!resolvedSubModuleId) {
          const codeUsed = isNewFormat ? record.subdomainCode?.trim() : record.subModuleId?.trim();
          errors.push({ row: i + 2, message: `Invalid subdomain code "${codeUsed}". Use format like ACE_SD01 or SD01_01` });
          continue;
        }
        
        if (!record.questionCode || !record.questionCode.trim()) {
          errors.push({ row: i + 2, message: 'questionCode is required' });
          continue;
        }
        if (!record.questionText || record.questionText.trim().length < 5) {
          errors.push({ row: i + 2, message: 'Question text is too short (min 5 characters)' });
          continue;
        }
        
        // Parse response options if provided as JSON
        let options: any = null;
        if (record.responseOptions) {
          try {
            options = JSON.parse(record.responseOptions);
          } catch (e) {
            // Try to parse as simple format
            options = record.responseOptions;
          }
        }
        
        // Determine keying - use direct keying column if present, else fall back to reverseSc
        let keying = 'Positive';
        if (record.keying?.trim()) {
          keying = record.keying.trim();
        } else {
          const isReverseScored = record.reverseSc?.toLowerCase() === 'true' || record.reverseSc === '1';
          keying = isReverseScored ? 'Negative' : 'Positive';
        }
        
        // Parse anchor column (Yes/No or true/false)
        const anchorVal = record.anchor?.trim()?.toLowerCase();
        const anchor = anchorVal === 'yes' || anchorVal === 'true' || anchorVal === '1';
        
        // Map difficulty
        const difficultyMap: Record<string, number> = { 'easy': 1, 'medium': 2, 'hard': 3 };
        const difficultyLevel = difficultyMap[record.difficulty?.toLowerCase()] || 
                                difficultyMap[record.difficultyLevel?.toLowerCase()] ||
                                parseInt(record.difficulty || record.difficultyLevel) || 1;

        questions.push({
          subModuleId: resolvedSubModuleId,
          ageGroupId: resolvedAgeBandId || null,
          questionCode: record.questionCode.trim(),
          setNumber: parseInt(record.setNumber) || 1,
          difficultyLevel,
          questionType: record.questionType?.trim() || 'likert',
          questionText: record.questionText.trim(),
          passageText: record.passageText?.trim() || null,
          keying,
          optionA: record.optionA?.trim() || null,
          optionAScore: parseInt(record.optionAScore) || 0,
          optionB: record.optionB?.trim() || null,
          optionBScore: parseInt(record.optionBScore) || 0,
          optionC: record.optionC?.trim() || null,
          optionCScore: parseInt(record.optionCScore) || 0,
          optionD: record.optionD?.trim() || null,
          optionDScore: parseInt(record.optionDScore) || 0,
          correctAnswer: record.correctAnswer?.trim() || null,
          explanation: record.explanation?.trim() || record.scoringLogic?.trim() || null,
          subject: record.subject?.trim() || record.domainCode?.trim() || record.domainName?.trim() || null,
          anchor,
          language: record.language?.trim() || 'EN',
          status: record.status?.trim() || 'Active'
        });
      }

      if (questions.length === 0) {
        return res.status(400).json({ message: 'No valid records found', errors });
      }

      const count = await storage.bulkCreateLbiQuestions(questions);

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'bulk_upload_lbi_questions',
        targetType: 'lbi_question_bank',
        targetId: 'bulk',
        notes: `Uploaded ${count} LBI questions`
      });

      res.json({ 
        message: errors.length > 0 
          ? `Uploaded ${count} questions with ${errors.length} rows skipped`
          : 'LBI questions uploaded successfully',
        count,
        totalRows: (records as any[]).length,
        skippedRows: errors.length,
        errors: errors.slice(0, 10)
      });
    } catch (error) {
      next(error);
    }
  });

  // Get LBI questions for admin
  app.get("/api/admin/lbi-questions", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { subModuleId, subject, status } = req.query;
      const questions = await storage.getLbiQuestions({
        subModuleId: subModuleId as string,
        subject: subject as string,
        status: status as string
      });
      res.json(questions);
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // ExamReadiness Index QUESTION BANK ADMIN ROUTES
  // ============================================

  // Download ExamReadiness Index question bank template
  app.get("/api/admin/exam-questions/template", requireAuth, requireSuperAdmin, (req, res) => {
    // Full universal CSV template for test_question_bank - supports ALL boards and question types
    const csvContent = `questionCode,questionType,difficultyLevel,questionText,optionA,optionB,optionC,optionD,optionE,correctOption,answerText,explanation,marks,negativeMarks,boardId,classId,subjectId,chapterId,topicId,assessmentType,assessmentCode,passageId,caseStudyId,diagramUrl,tags,language,isVerified,status
"EX-MCQ-001","MCQ","Easy","What is 15 + 27?","32","42","52","62","","B","","Basic addition: 15 + 27 = 42",1,0,"CBSE","Class5","Mathematics","CH01-Numbers","Topic01-Addition","Practice","","","","","arithmetic;addition","EN","false","Active"
"EX-MCQ-002","MCQ","Medium","Solve: 3x + 5 = 20. What is x?","3","5","7","15","","B","","3x + 5 = 20, 3x = 15, x = 5",2,0.5,"CBSE","Class8","Mathematics","CH02-Algebra","Topic01-LinearEq","ChapterTest","CT-ALG-001","","","","algebra;equations","EN","false","Active"
"EX-TF-001","TrueFalse","Easy","The Earth is flat.","True","False","","","","B","","The Earth is an oblate spheroid",1,0,"CBSE","Class6","Science","CH01-Universe","","Practice","","","","","geography;earth","EN","true","Active"
"EX-FILL-001","FillBlank","Medium","The capital of India is _____.","","","","","","","New Delhi","New Delhi is the capital city of India",1,0,"CBSE","Class5","SocialStudies","CH01-India","","Practice","","","","","geography;capitals","EN","false","Active"
"EX-SHORT-001","ShortAnswer","Medium","Define photosynthesis in 2-3 sentences.","","","","","","","Photosynthesis is the process by which plants convert sunlight into energy.","Plants use chlorophyll to capture light energy",2,0,"CBSE","Class7","Science","CH02-Plants","","Practice","","","","","biology;plants","EN","false","Active"
"EX-LONG-001","LongAnswer","Hard","Explain the causes and effects of World War I.","","","","","","","Detailed answer about WWI causes and effects","Include political, economic, and social factors",5,0,"CBSE","Class10","History","CH05-WorldWars","","SamplePaper","SP-HIST-2026","","","","history;wwi","EN","true","Active"
"EX-NUM-001","Numerical","Hard","Calculate the speed if distance is 100m and time is 20s.","","","","","","","5","Speed = Distance/Time = 100/20 = 5 m/s",3,0.5,"CBSE","Class9","Physics","CH03-Motion","","MockTest","MT-PHY-001","","","","physics;speed;motion","EN","false","Active"
"EX-AR-001","AssertionReason","Hard","Assertion: Plants need sunlight. Reason: Photosynthesis requires light.","Both A and R are true, R explains A","Both A and R are true, R does not explain A","A is true, R is false","A is false, R is true","","A","","Both statements are true and reason explains assertion",2,0.5,"CBSE","Class9","Biology","CH02-Plants","","SamplePaper","","","","","biology;photosynthesis","EN","true","Active"
"EX-PASS-001","PassageBased","Medium","Based on the passage, what is the main theme?","Adventure","Friendship","Courage","All of the above","","D","","The passage covers multiple themes",2,0,"CBSE","Class8","English","CH04-Prose","","Practice","","PASS-ENG-001","","","reading;comprehension","EN","false","Active"
"EX-CASE-001","CaseStudy","Hard","Based on the case study, calculate the profit margin.","10%","15%","20%","25%","","C","","Profit margin = (Revenue - Cost) / Revenue x 100",4,1,"CBSE","Class12","Business","CH08-Finance","","MockTest","MT-BUS-001","","CASE-FIN-001","","business;finance","EN","false","Active"`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="exam_questions_template.csv"');
    res.send(csvContent);
  });

  // Upload ExamReadiness Index questions from CSV (uses testQuestionBank)
  app.post("/api/admin/exam-questions/upload", requireAuth, requireSuperAdmin, upload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const allowedMimeTypes = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
      if (!allowedMimeTypes.includes(req.file.mimetype) && !req.file.originalname.endsWith('.csv')) {
        return res.status(400).json({ message: 'Invalid file type. Please upload a CSV file.' });
      }

      const fileContent = req.file.buffer.toString('utf-8');
      
      let records;
      try {
        records = parse(fileContent, { columns: true, skip_empty_lines: true, trim: true });
      } catch (parseError) {
        return res.status(400).json({ message: 'Invalid CSV format.' });
      }

      if (records.length === 0) {
        return res.status(400).json({ message: 'No records found in the file' });
      }

      // Only require core fields - others are optional based on question type
      const coreRequiredFields = ['questionCode', 'questionType', 'difficultyLevel', 'questionText'];
      const firstRecord = records[0] as Record<string, string>;
      const missingFields = coreRequiredFields.filter(field => !(field in firstRecord));
      if (missingFields.length > 0) {
        return res.status(400).json({ message: `Missing required columns: ${missingFields.join(', ')}` });
      }

      const questions: any[] = [];
      const errors: { row: number; message: string }[] = [];
      const validQuestionTypes = ['MCQ', 'TrueFalse', 'FillBlank', 'ShortAnswer', 'LongAnswer', 'Numerical', 'CaseStudy', 'PassageBased', 'AssertionReason', 'MatchFollowing'];

      for (let i = 0; i < (records as Record<string, string>[]).length; i++) {
        const record = (records as Record<string, string>[])[i];
        
        if (!record.questionCode || !record.questionCode.trim()) {
          errors.push({ row: i + 2, message: 'questionCode is required' });
          continue;
        }
        if (!record.questionText || record.questionText.trim().length < 5) {
          errors.push({ row: i + 2, message: 'Question text is too short (min 5 characters)' });
          continue;
        }

        const questionType = record.questionType?.trim() || 'MCQ';
        if (!validQuestionTypes.includes(questionType)) {
          errors.push({ row: i + 2, message: `Invalid question type "${questionType}"` });
          continue;
        }

        const requiresOptions = ['MCQ', 'TrueFalse', 'AssertionReason', 'MatchFollowing', 'PassageBased', 'CaseStudy'].includes(questionType);
        const requiresAnswer = ['FillBlank', 'ShortAnswer', 'LongAnswer', 'Numerical'].includes(questionType);

        let correctOption = record.correctOption?.toUpperCase()?.trim() || null;
        if (requiresOptions && correctOption) {
          const validSingleOptions = ['A', 'B', 'C', 'D', 'E'];
          const optionParts = correctOption.split(',').map(s => s.trim());
          const allValid = optionParts.every(opt => validSingleOptions.includes(opt));
          if (!allValid) {
            errors.push({ row: i + 2, message: `Invalid correct option "${record.correctOption}". Use A, B, C, D, E or comma-separated.` });
            continue;
          }
        }

        const tags = record.tags ? record.tags.split(';').map((t: string) => t.trim()).filter((t: string) => t) : null;

        questions.push({
          questionCode: record.questionCode.trim(),
          questionType,
          difficultyLevel: ['Easy', 'Medium', 'Hard'].includes(record.difficultyLevel) ? record.difficultyLevel : 'Medium',
          questionText: record.questionText.trim(),
          optionA: record.optionA?.trim() || null,
          optionB: record.optionB?.trim() || null,
          optionC: record.optionC?.trim() || null,
          optionD: record.optionD?.trim() || null,
          optionE: record.optionE?.trim() || null,
          correctOption,
          answerText: record.answerText?.trim() || null,
          explanation: record.explanation?.trim() || null,
          marks: parseInt(record.marks) || 1,
          negativeMarks: parseFloat(record.negativeMarks) || 0,
          boardId: record.boardId?.trim() || null,
          classId: record.classId?.trim() || null,
          subjectId: record.subjectId?.trim() || null,
          chapterId: record.chapterId?.trim() || null,
          topicId: record.topicId?.trim() || null,
          assessmentType: record.assessmentType?.trim() || 'Practice',
          assessmentCode: record.assessmentCode?.trim() || null,
          passageId: record.passageId?.trim() || null,
          caseStudyId: record.caseStudyId?.trim() || null,
          diagramUrl: record.diagramUrl?.trim() || null,
          tags,
          language: record.language?.trim() || 'EN',
          isVerified: record.isVerified?.toLowerCase() === 'true',
          status: record.status?.trim() || 'Active'
        });
      }

      if (questions.length === 0) {
        return res.status(400).json({ message: 'No valid records found', errors });
      }

      const count = await storage.bulkCreateQuestionBankQuestions(questions);

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'bulk_upload_exam_questions',
        targetType: 'test_question_bank',
        targetId: 'bulk',
        notes: `Uploaded ${count} ExamReadiness Index questions`
      });

      res.json({ 
        message: errors.length > 0 
          ? `Uploaded ${count} questions with ${errors.length} rows skipped`
          : 'Exam questions uploaded successfully',
        count,
        totalRows: (records as any[]).length,
        skippedRows: errors.length,
        errors: errors.slice(0, 10)
      });
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // ASSESSMENT BLUEPRINTS API
  // ============================================

  // Get all assessment blueprints
  app.get("/api/admin/assessment-blueprints", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { boardId, classId, subjectId, assessmentType } = req.query;
      const blueprints = await storage.getAssessmentBlueprints({
        boardId: boardId as string,
        classId: classId as string,
        subjectId: subjectId as string,
        assessmentType: assessmentType as string
      });
      res.json(blueprints);
    } catch (error) {
      next(error);
    }
  });

  // Get blueprint by ID with sections
  app.get("/api/admin/assessment-blueprints/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const blueprint = await storage.getAssessmentBlueprintById(req.params.id);
      if (!blueprint) {
        return res.status(404).json({ message: 'Blueprint not found' });
      }
      const sections = await storage.getBlueprintSections(req.params.id);
      res.json({ ...blueprint, sections });
    } catch (error) {
      next(error);
    }
  });

  // Create assessment blueprint
  app.post("/api/admin/assessment-blueprints", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { sections, ...blueprintData } = req.body;
      const blueprint = await storage.createAssessmentBlueprint({
        ...blueprintData,
        createdBy: req.user!.id
      });
      
      if (sections && Array.isArray(sections)) {
        for (const section of sections) {
          await storage.createBlueprintSection({
            ...section,
            blueprintId: blueprint.id
          });
        }
      }
      
      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'create_blueprint',
        targetType: 'assessment_blueprint',
        targetId: blueprint.id,
        notes: `Created blueprint: ${blueprint.blueprintName}`
      });
      
      res.status(201).json(blueprint);
    } catch (error) {
      next(error);
    }
  });

  // Update assessment blueprint
  app.patch("/api/admin/assessment-blueprints/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const updated = await storage.updateAssessmentBlueprint(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ message: 'Blueprint not found' });
      }
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  // Delete assessment blueprint
  app.delete("/api/admin/assessment-blueprints/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      await storage.deleteAssessmentBlueprint(req.params.id);
      res.json({ message: 'Blueprint deleted' });
    } catch (error) {
      next(error);
    }
  });

  // Blueprint sections CRUD
  app.post("/api/admin/blueprint-sections", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const section = await storage.createBlueprintSection(req.body);
      res.status(201).json(section);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/blueprint-sections/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const updated = await storage.updateBlueprintSection(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ message: 'Section not found' });
      }
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/blueprint-sections/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      await storage.deleteBlueprintSection(req.params.id);
      res.json({ message: 'Section deleted' });
    } catch (error) {
      next(error);
    }
  });

  // Generate paper from blueprint
  app.post("/api/admin/generate-paper/:blueprintId", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { seed } = req.body;
      const result = await storage.generatePaperFromBlueprint(req.params.blueprintId, seed);
      
      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'generate_paper',
        targetType: 'assessment_blueprint',
        targetId: req.params.blueprintId,
        notes: `Generated paper with ${result.totalMarks} marks`
      });
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // FINANCIAL RECONCILIATION
  // ============================================

  // Get reconciliation records
  app.get("/api/admin/reconciliations", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { status, limit } = req.query;
      const reconciliations = await storage.getPaymentReconciliations({
        status: status as string,
        limit: limit ? parseInt(limit as string) : 50
      });
      res.json(reconciliations);
    } catch (error) {
      next(error);
    }
  });

  // Create reconciliation for period
  app.post("/api/admin/reconciliations", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { reconciliationPeriod } = req.body;
      
      // Calculate totals for the period
      const summary = await storage.calculateReconciliationSummary(reconciliationPeriod);
      
      const reconciliation = await storage.createPaymentReconciliation({
        reconciliationPeriod,
        status: 'pending',
        totalPaymentsReceived: summary.paymentsReceived,
        totalPaymentsDone: summary.paymentsDone,
        netBalance: summary.paymentsReceived - summary.paymentsDone,
        transactionCount: summary.transactionCount,
        payoutCount: summary.payoutCount,
        discrepancyAmount: summary.discrepancy
      });

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'create_reconciliation',
        targetType: 'reconciliation',
        targetId: reconciliation.id,
        newState: JSON.stringify({ period: reconciliationPeriod })
      });

      res.json(reconciliation);
    } catch (error) {
      next(error);
    }
  });

  // Complete reconciliation
  app.post("/api/admin/reconciliations/:id/complete", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { notes } = req.body;
      const reconciliation = await storage.updatePaymentReconciliation(req.params.id, {
        status: 'completed',
        reconciledBy: req.user!.id,
        reconciledAt: new Date(),
        discrepancyNotes: notes
      });

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'complete_reconciliation',
        targetType: 'reconciliation',
        targetId: reconciliation.id,
        newState: JSON.stringify({ status: 'completed' }),
        notes
      });

      res.json(reconciliation);
    } catch (error) {
      next(error);
    }
  });

  // Approve reconciliation
  app.post("/api/admin/reconciliations/:id/approve", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const reconciliation = await storage.updatePaymentReconciliation(req.params.id, {
        approvedBy: req.user!.id,
        approvedAt: new Date()
      });

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'approve_reconciliation',
        targetType: 'reconciliation',
        targetId: reconciliation.id
      });

      res.json(reconciliation);
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // NGO MANAGEMENT
  // ============================================

  // Get all NGO registrations
  app.get("/api/admin/ngos", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { status, limit } = req.query;
      const ngos = await storage.getNgoRegistrations({
        status: status as string,
        limit: limit ? parseInt(limit as string) : 100
      });
      res.json(ngos);
    } catch (error) {
      next(error);
    }
  });

  // Approve NGO
  app.post("/api/admin/ngos/:id/approve", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const ngo = await storage.updateNgoRegistration(req.params.id, {
        status: 'active',
        verifiedBy: req.user!.id,
        verifiedAt: new Date(),
        onboardedAt: new Date()
      });

      // Generate NGO code
      const prefix = 'NGO';
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();
      const code = `${prefix}-${random}`;
      
      await storage.createEntityCode({
        entityType: 'ngo',
        entityId: ngo.id,
        code,
        codeType: 'standard',
        status: 'active',
        generatedBy: req.user!.id,
        validFrom: new Date(),
        usageCount: 0
      });

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'approve_ngo',
        targetType: 'ngo',
        targetId: ngo.id,
        newState: JSON.stringify({ status: 'active' })
      });

      res.json(ngo);
    } catch (error) {
      next(error);
    }
  });

  // Reject NGO
  app.post("/api/admin/ngos/:id/reject", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { reason } = req.body;
      const ngo = await storage.updateNgoRegistration(req.params.id, {
        status: 'terminated'
      });

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'reject_ngo',
        targetType: 'ngo',
        targetId: ngo.id,
        newState: JSON.stringify({ status: 'terminated' }),
        notes: reason
      });

      res.json(ngo);
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // LEI MANAGEMENT
  // ============================================

  // Get all LEI registrations
  app.get("/api/admin/lei", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { status, limit } = req.query;
      const leis = await storage.getLeiRegistrations({
        status: status as string,
        limit: limit ? parseInt(limit as string) : 100
      });
      res.json(leis);
    } catch (error) {
      next(error);
    }
  });

  // Verify LEI
  app.post("/api/admin/lei/:id/verify", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const lei = await storage.updateLeiRegistration(req.params.id, {
        status: 'active',
        lastVerified: new Date(),
        verifiedBy: req.user!.id
      });

      // Generate LEI entity code
      const prefix = 'LEI';
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();
      const code = `${prefix}-${random}`;
      
      await storage.createEntityCode({
        entityType: 'lei',
        entityId: lei.id,
        code,
        codeType: 'standard',
        status: 'active',
        generatedBy: req.user!.id,
        validFrom: new Date(),
        usageCount: 0
      });

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'verify_lei',
        targetType: 'lei',
        targetId: lei.id,
        newState: JSON.stringify({ status: 'active' })
      });

      res.json(lei);
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // USER SESSION MANAGEMENT
  // ============================================

  // Get active sessions
  app.get("/api/admin/sessions", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      // Read the live express-session store (connect-pg-simple). The legacy
      // user_sessions table was never provisioned in this DB, so this reads the
      // real session store instead — an honest active-sessions snapshot.
      const snapshot = await readActiveSessions(concernsPool);
      const userId = (req.query.userId as string | undefined)?.trim();
      const sessions = userId
        ? snapshot.sessions.filter((s: any) => String(s.userId) === userId)
        : snapshot.sessions;
      res.json({ ...snapshot, sessions, total: sessions.length });
    } catch (error) {
      next(error);
    }
  });

  // Terminate session
  app.post("/api/admin/sessions/:id/terminate", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { reason } = req.body;
      const session = await storage.terminateUserSession(req.params.id, reason);

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'terminate_session',
        targetType: 'session',
        targetId: req.params.id,
        notes: reason
      });

      res.json(session);
    } catch (error) {
      next(error);
    }
  });

  // Terminate all sessions for a user
  app.post("/api/admin/users/:userId/terminate-sessions", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { reason } = req.body;
      const count = await storage.terminateAllUserSessions(req.params.userId, reason);

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'terminate_all_sessions',
        targetType: 'user',
        targetId: req.params.userId,
        notes: reason
      });

      res.json({ message: 'All sessions terminated', count });
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // LEARNING PLAN TEMPLATES
  // ============================================

  // Get all learning plan templates
  app.get("/api/admin/learning-plans", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { status, targetGrade, limit } = req.query;
      const templates = await storage.getLearningPlanTemplates({
        status: status as string,
        targetGrade: targetGrade as string,
        limit: limit ? parseInt(limit as string) : 100
      });
      res.json(templates);
    } catch (error) {
      next(error);
    }
  });

  // Create learning plan template
  app.post("/api/admin/learning-plans", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const template = await storage.createLearningPlanTemplate({
        ...req.body,
        createdBy: req.user!.id
      });

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'create_learning_plan',
        targetType: 'learning_plan',
        targetId: template.id,
        newState: JSON.stringify({ templateName: template.templateName })
      });

      res.json(template);
    } catch (error) {
      next(error);
    }
  });

  // Update learning plan template
  app.put("/api/admin/learning-plans/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const template = await storage.updateLearningPlanTemplate(req.params.id, req.body);

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'update_learning_plan',
        targetType: 'learning_plan',
        targetId: template.id
      });

      res.json(template);
    } catch (error) {
      next(error);
    }
  });

  // Approve and publish learning plan template
  app.post("/api/admin/learning-plans/:id/publish", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const template = await storage.updateLearningPlanTemplate(req.params.id, {
        status: 'published',
        approvedBy: req.user!.id,
        approvedAt: new Date(),
        publishedAt: new Date()
      });

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'publish_learning_plan',
        targetType: 'learning_plan',
        targetId: template.id,
        newState: JSON.stringify({ status: 'published' })
      });

      res.json(template);
    } catch (error) {
      next(error);
    }
  });

  // Archive learning plan template
  app.post("/api/admin/learning-plans/:id/archive", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const template = await storage.updateLearningPlanTemplate(req.params.id, {
        status: 'archived'
      });

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'archive_learning_plan',
        targetType: 'learning_plan',
        targetId: template.id
      });

      res.json(template);
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // EXTENDED DASHBOARD STATS
  // ============================================

  // Get comprehensive admin stats
  app.get("/api/admin/stats/comprehensive", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const stats = await storage.getComprehensiveAdminStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  // Get financial summary
  app.get("/api/admin/stats/financial", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { period } = req.query;
      const summary = await storage.getFinancialSummary(period as string);
      res.json(summary);
    } catch (error) {
      next(error);
    }
  });

  // ==================== HR & RECRUITMENT ROUTES ====================

  // Job Postings
  app.get("/api/hr/jobs", requireAuth, async (req, res, next) => {
    try {
      const { status, roleCategory } = req.query;
      const jobs = await storage.getJobPostings({
        status: status as string | undefined,
        roleCategory: roleCategory as string | undefined
      });
      res.json(jobs);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/hr/jobs/:id", requireAuth, async (req, res, next) => {
    try {
      const job = await storage.getJobPosting(req.params.id);
      if (!job) return res.status(404).json({ error: "Job posting not found" });
      res.json(job);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/hr/jobs", requireAuth, async (req, res, next) => {
    try {
      const job = await storage.createJobPosting({
        ...req.body,
        createdBy: req.user!.id,
        status: 'draft'
      });
      res.status(201).json(job);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/hr/jobs/:id", requireAuth, async (req, res, next) => {
    try {
      const job = await storage.updateJobPosting(req.params.id, req.body);
      if (!job) return res.status(404).json({ error: "Job posting not found" });
      res.json(job);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/hr/jobs/:id/submit", requireAuth, async (req, res, next) => {
    try {
      const job = await storage.updateJobStatus(req.params.id, 'hr_review');
      if (!job) return res.status(404).json({ error: "Job posting not found" });
      await storage.createJobApprovalLog({
        jobId: req.params.id,
        fromStatus: 'draft',
        toStatus: 'hr_review',
        action: 'submit',
        actorId: req.user!.id,
        actorRole: req.user!.role
      });
      res.json(job);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/hr/jobs/:id/approve", requireAuth, async (req, res, next) => {
    try {
      const currentJob = await storage.getJobPosting(req.params.id);
      if (!currentJob) return res.status(404).json({ error: "Job posting not found" });
      
      const { notes } = req.body;
      let newStatus = '';
      
      if (currentJob.status === 'hr_review') {
        newStatus = 'legal_review';
      } else if (currentJob.status === 'legal_review') {
        newStatus = 'leadership_approval';
      } else if (currentJob.status === 'leadership_approval') {
        newStatus = 'approved';
      } else {
        return res.status(400).json({ error: "Job is not in an approvable state" });
      }
      
      let reviewType: 'hr' | 'legal' | 'leadership' = 'hr';
      if (currentJob.status === 'legal_review') reviewType = 'legal';
      else if (currentJob.status === 'leadership_approval') reviewType = 'leadership';
      
      const job = await storage.updateJobStatus(req.params.id, newStatus, {
        reviewBy: req.user!.id,
        notes: notes,
        reviewType
      });
      
      await storage.createJobApprovalLog({
        jobId: req.params.id,
        fromStatus: currentJob.status,
        toStatus: newStatus,
        action: 'approve',
        comments: notes,
        actorId: req.user!.id,
        actorRole: req.user!.role
      });
      
      res.json(job);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/hr/jobs/:id/reject", requireAuth, async (req, res, next) => {
    try {
      const currentJob = await storage.getJobPosting(req.params.id);
      if (!currentJob) return res.status(404).json({ error: "Job posting not found" });
      
      const { notes } = req.body;
      const job = await storage.updateJobStatus(req.params.id, 'draft');
      
      await storage.createJobApprovalLog({
        jobId: req.params.id,
        fromStatus: currentJob.status,
        toStatus: 'draft',
        action: 'reject',
        comments: notes,
        actorId: req.user!.id,
        actorRole: req.user!.role
      });
      
      res.json(job);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/hr/jobs/:id/publish", requireAuth, async (req, res, next) => {
    try {
      const currentJob = await storage.getJobPosting(req.params.id);
      if (!currentJob) return res.status(404).json({ error: "Job posting not found" });
      if (currentJob.status !== 'approved') {
        return res.status(400).json({ error: "Job must be approved before publishing" });
      }
      
      const job = await storage.publishJob(req.params.id);
      
      await storage.createJobApprovalLog({
        jobId: req.params.id,
        fromStatus: currentJob.status,
        toStatus: 'published',
        action: 'publish',
        actorId: req.user!.id,
        actorRole: req.user!.role
      });
      
      res.json(job);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/hr/jobs/:id/close", requireAuth, async (req, res, next) => {
    try {
      const currentJob = await storage.getJobPosting(req.params.id);
      if (!currentJob) return res.status(404).json({ error: "Job posting not found" });
      
      const job = await storage.closeJob(req.params.id);
      
      await storage.createJobApprovalLog({
        jobId: req.params.id,
        fromStatus: currentJob.status,
        toStatus: 'closed',
        action: 'close',
        actorId: req.user!.id,
        actorRole: req.user!.role
      });
      
      res.json(job);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/hr/jobs/:id/logs", requireAuth, async (req, res, next) => {
    try {
      const logs = await storage.getJobApprovalLogs(req.params.id);
      res.json(logs);
    } catch (error) {
      next(error);
    }
  });

  // Public Careers Page - Job Listings
  app.get("/api/careers/jobs", async (req, res, next) => {
    try {
      const jobs = await storage.getJobPostings({ status: 'published' });
      res.json(jobs);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/careers/jobs/:id", async (req, res, next) => {
    try {
      const job = await storage.getJobPosting(req.params.id);
      if (!job || job.status !== 'published') {
        return res.status(404).json({ error: "Job posting not found" });
      }
      res.json(job);
    } catch (error) {
      next(error);
    }
  });

  // Job Applications
  app.get("/api/hr/applications", requireAuth, async (req, res, next) => {
    try {
      const { jobId, status } = req.query;
      const applications = await storage.getJobApplications({
        jobId: jobId as string | undefined,
        status: status as string | undefined
      });
      res.json(applications);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/hr/applications/:id", requireAuth, async (req, res, next) => {
    try {
      const application = await storage.getJobApplication(req.params.id);
      if (!application) return res.status(404).json({ error: "Application not found" });
      res.json(application);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/careers/apply", async (req, res, next) => {
    try {
      const { jobId, fullName, email, phone, resumeUrl, coverLetter, sourceChannel, consentCaptured } = req.body;
      
      if (!consentCaptured) {
        return res.status(400).json({ error: "DPDP consent is required" });
      }
      
      const application = await storage.createJobApplication({
        jobId,
        applicantUserId: req.user?.id || 'anonymous',
        fullName,
        email,
        phone,
        resumeUrl,
        coverLetter,
        sourceChannel: sourceChannel || 'direct',
        consentCaptured: true,
        consentCapturedAt: new Date()
      });
      
      res.status(201).json(application);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/hr/applications/:id/shortlist", requireAuth, async (req, res, next) => {
    try {
      const application = await storage.shortlistApplication(req.params.id, req.user!.id);
      if (!application) return res.status(404).json({ error: "Application not found" });
      res.json(application);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/hr/applications/:id/reject", requireAuth, async (req, res, next) => {
    try {
      const { reason } = req.body;
      const application = await storage.rejectApplication(req.params.id, reason, req.user!.id);
      if (!application) return res.status(404).json({ error: "Application not found" });
      res.json(application);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/hr/applications/:id", requireAuth, async (req, res, next) => {
    try {
      const application = await storage.updateJobApplication(req.params.id, req.body);
      if (!application) return res.status(404).json({ error: "Application not found" });
      res.json(application);
    } catch (error) {
      next(error);
    }
  });

  // Mentors
  app.get("/api/hr/mentors", requireAuth, async (req, res, next) => {
    try {
      const { status } = req.query;
      const mentorsList = await storage.getMentors({ status: status as string | undefined });
      res.json(mentorsList);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/hr/mentors/:id", requireAuth, async (req, res, next) => {
    try {
      const mentor = await storage.getMentor(req.params.id);
      if (!mentor) return res.status(404).json({ error: "Mentor not found" });
      res.json(mentor);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/hr/mentors", requireAuth, async (req, res, next) => {
    try {
      const mentor = await storage.createMentor(req.body);
      res.status(201).json(mentor);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/hr/mentors/:id/activate", requireAuth, async (req, res, next) => {
    try {
      const mentor = await storage.activateMentor(req.params.id);
      if (!mentor) return res.status(404).json({ error: "Mentor not found" });
      res.json(mentor);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/hr/mentors/:id/suspend", requireAuth, async (req, res, next) => {
    try {
      const { reason } = req.body;
      const mentor = await storage.suspendMentor(req.params.id, reason);
      if (!mentor) return res.status(404).json({ error: "Mentor not found" });
      res.json(mentor);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/hr/mentors/:id/deactivate", requireAuth, async (req, res, next) => {
    try {
      const { reason } = req.body;
      const mentor = await storage.deactivateMentor(req.params.id, reason);
      if (!mentor) return res.status(404).json({ error: "Mentor not found" });
      res.json(mentor);
    } catch (error) {
      next(error);
    }
  });

  // Mentor Tasks
  app.get("/api/hr/mentors/:mentorId/tasks", requireAuth, async (req, res, next) => {
    try {
      const tasks = await storage.getMentorTasks(req.params.mentorId);
      res.json(tasks);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/hr/mentors/:mentorId/tasks", requireAuth, async (req, res, next) => {
    try {
      const task = await storage.createMentorTask({
        ...req.body,
        mentorId: req.params.mentorId,
        createdBy: req.user!.id
      });
      res.status(201).json(task);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/hr/tasks/:id", requireAuth, async (req, res, next) => {
    try {
      const task = await storage.updateMentorTask(req.params.id, req.body);
      if (!task) return res.status(404).json({ error: "Task not found" });
      res.json(task);
    } catch (error) {
      next(error);
    }
  });

  // Training Programs
  app.get("/api/hr/training-programs", requireAuth, async (req, res, next) => {
    try {
      const programs = await storage.getTrainingPrograms();
      res.json(programs);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/hr/training-programs/:id", requireAuth, async (req, res, next) => {
    try {
      const program = await storage.getTrainingProgram(req.params.id);
      if (!program) return res.status(404).json({ error: "Training program not found" });
      res.json(program);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/hr/training-programs", requireAuth, async (req, res, next) => {
    try {
      const program = await storage.createTrainingProgram(req.body);
      res.status(201).json(program);
    } catch (error) {
      next(error);
    }
  });

  // Training Enrollments
  app.get("/api/hr/mentors/:mentorId/enrollments", requireAuth, async (req, res, next) => {
    try {
      const enrollments = await storage.getTrainingEnrollments(req.params.mentorId);
      res.json(enrollments);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/hr/enrollments", requireAuth, async (req, res, next) => {
    try {
      const enrollment = await storage.createTrainingEnrollment(req.body);
      res.status(201).json(enrollment);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/hr/enrollments/:id", requireAuth, async (req, res, next) => {
    try {
      const enrollment = await storage.updateTrainingEnrollment(req.params.id, req.body);
      if (!enrollment) return res.status(404).json({ error: "Enrollment not found" });
      res.json(enrollment);
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // ENTERPRISE DOCUMENT MANAGEMENT API
  // ============================================

  // Get KYC document types
  app.get("/api/admin/kyc-types", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { entityType } = req.query;
      const types = await storage.getKycDocumentTypes(entityType as string);
      res.json(types);
    } catch (error) {
      next(error);
    }
  });

  // Create KYC document type
  app.post("/api/admin/kyc-types", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const type = await storage.createKycDocumentType(req.body);
      res.json(type);
    } catch (error) {
      next(error);
    }
  });

  // Get consent types
  app.get("/api/admin/consent-types", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { entityType } = req.query;
      const types = await storage.getConsentTypes(entityType as string);
      res.json(types);
    } catch (error) {
      next(error);
    }
  });

  // Create consent type
  app.post("/api/admin/consent-types", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const type = await storage.createConsentType(req.body);
      res.json(type);
    } catch (error) {
      next(error);
    }
  });

  // Get documents with filters
  app.get("/api/admin/documents", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { entityType, entityId, category, status, search } = req.query;
      const documents = await storage.getDocuments({
        entityType: entityType as string,
        entityId: entityId as string,
        category: category as string,
        status: status as string,
        search: search as string
      });
      res.json(documents);
    } catch (error) {
      next(error);
    }
  });

  // Get document folders
  app.get("/api/admin/document-folders", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { entityType, entityId } = req.query;
      const folders = await storage.getDocumentFolders(entityType as string, entityId as string);
      res.json(folders);
    } catch (error) {
      next(error);
    }
  });

  // Create document folder
  app.post("/api/admin/document-folders", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const folder = await storage.createDocumentFolder({
        ...req.body,
        createdBy: req.user?.id
      });
      res.json(folder);
    } catch (error) {
      next(error);
    }
  });

  // Upload document
  app.post("/api/admin/documents", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const document = await storage.createDocument({
        ...req.body,
        uploadedBy: req.user?.id
      });
      res.json(document);
    } catch (error) {
      next(error);
    }
  });

  // Document maker verification
  app.post("/api/admin/documents/:id/maker-verify", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { notes } = req.body;
      const document = await storage.makerVerifyDocument(req.params.id, req.user?.id || '', notes);
      
      // Log access
      await storage.createDocumentAccessLog({
        documentId: req.params.id,
        userId: req.user?.id || '',
        accessType: 'verify',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        accessStatus: 'success'
      });
      
      res.json({ success: true, document });
    } catch (error) {
      next(error);
    }
  });

  // Document checker approval
  app.post("/api/admin/documents/:id/checker-approve", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { notes } = req.body;
      const document = await storage.checkerApproveDocument(req.params.id, req.user?.id || '', notes);
      
      await storage.createDocumentAccessLog({
        documentId: req.params.id,
        userId: req.user?.id || '',
        accessType: 'approve',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        accessStatus: 'success'
      });
      
      res.json({ success: true, document });
    } catch (error) {
      next(error);
    }
  });

  // Document rejection
  app.post("/api/admin/documents/:id/reject", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { reason } = req.body;
      if (!reason) return res.status(400).json({ error: "Rejection reason required" });
      
      const document = await storage.rejectDocument(req.params.id, req.user?.id || '', reason);
      
      await storage.createDocumentAccessLog({
        documentId: req.params.id,
        userId: req.user?.id || '',
        accessType: 'reject',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        accessStatus: 'success'
      });
      
      res.json({ success: true, document });
    } catch (error) {
      next(error);
    }
  });

  // Get pre-onboarding checklist
  app.get("/api/admin/pre-onboarding/:entityType/:entityId", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const checklist = await storage.getPreOnboardingChecklist(req.params.entityType, req.params.entityId);
      res.json(checklist);
    } catch (error) {
      next(error);
    }
  });

  // Update pre-onboarding checklist
  app.patch("/api/admin/pre-onboarding/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const checklist = await storage.updatePreOnboardingChecklist(req.params.id, req.body);
      res.json(checklist);
    } catch (error) {
      next(error);
    }
  });

  // Approve temporary onboarding
  app.post("/api/admin/pre-onboarding/:id/temporary-approve", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const checklist = await storage.approveTemporaryOnboarding(req.params.id, req.user?.id || '');
      res.json({ success: true, checklist });
    } catch (error) {
      next(error);
    }
  });

  // Final approval
  app.post("/api/admin/pre-onboarding/:id/approve", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const checklist = await storage.approvePreOnboarding(req.params.id, req.user?.id || '');
      res.json({ success: true, checklist });
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // STUDENT BULK IMPORT API
  // ============================================

  // Get bulk imports for institute
  app.get("/api/institute/student-imports", requireAuth, async (req, res, next) => {
    try {
      const { instituteId } = req.query;
      const imports = await storage.getStudentBulkImports(instituteId as string);
      res.json(imports);
    } catch (error) {
      next(error);
    }
  });

  // Create bulk import
  app.post("/api/institute/student-imports", requireAuth, async (req, res, next) => {
    try {
      const importRecord = await storage.createStudentBulkImport({
        ...req.body,
        uploadedBy: req.user?.id
      });
      res.json(importRecord);
    } catch (error) {
      next(error);
    }
  });

  // Get import records
  app.get("/api/institute/student-imports/:id/records", requireAuth, async (req, res, next) => {
    try {
      const records = await storage.getStudentImportRecords(req.params.id);
      res.json(records);
    } catch (error) {
      next(error);
    }
  });

  // Process import
  app.post("/api/institute/student-imports/:id/process", requireAuth, async (req, res, next) => {
    try {
      const result = await storage.processStudentBulkImport(req.params.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // Approve import (admin)
  app.post("/api/admin/student-imports/:id/approve", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const result = await storage.approveStudentBulkImport(req.params.id, req.user?.id || '');
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // Add individual student at institute
  app.post("/api/institute/students", requireAuth, async (req, res, next) => {
    try {
      const student = await storage.createStudentAtInstitute(req.body);
      res.json(student);
    } catch (error) {
      next(error);
    }
  });

  // Get students for institute
  app.get("/api/institute/students", requireAuth, async (req, res, next) => {
    try {
      const { instituteId, status, search, page, limit } = req.query;
      const students = await storage.getInstituteStudents({
        instituteId: instituteId as string,
        status: status as string,
        search: search as string,
        page: parseInt(page as string) || 1,
        limit: parseInt(limit as string) || 50
      });
      res.json(students);
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // SOC2/ISO SECURITY & AUDIT API
  // ============================================

  // Get security configurations
  app.get("/api/admin/security/config", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const configs = await storage.getSecurityConfigurations();
      res.json(configs);
    } catch (error) {
      next(error);
    }
  });

  // Update security configuration
  app.patch("/api/admin/security/config/:key", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const config = await storage.updateSecurityConfiguration(req.params.key, req.body.value, req.user?.id || '');
      res.json(config);
    } catch (error) {
      next(error);
    }
  });

  // Get security incidents
  app.get("/api/admin/security/incidents", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { status, severity } = req.query;
      const incidents = await storage.getSecurityIncidents(status as string, severity as string);
      res.json(incidents);
    } catch (error) {
      next(error);
    }
  });

  // Create security incident
  app.post("/api/admin/security/incidents", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const incident = await storage.createSecurityIncident({
        ...req.body,
        detectedBy: req.user?.id
      });
      res.json(incident);
    } catch (error) {
      next(error);
    }
  });

  // Get compliance audit logs
  app.get("/api/admin/audit/compliance", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { category, resourceType, startDate, endDate, actorId, page, limit } = req.query;
      const logs = await storage.getComplianceAuditLogs({
        category: category as string,
        resourceType: resourceType as string,
        startDate: startDate as string,
        endDate: endDate as string,
        actorId: actorId as string,
        page: parseInt(page as string) || 1,
        limit: parseInt(limit as string) || 100
      });
      res.json(logs);
    } catch (error) {
      next(error);
    }
  });

  // Export audit logs
  app.get("/api/admin/audit/export", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { format, startDate, endDate } = req.query;
      const data = await storage.exportAuditLogs(startDate as string, endDate as string, format as string || 'json');
      res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${new Date().toISOString().split('T')[0]}.${format || 'json'}`);
      res.send(data);
    } catch (error) {
      next(error);
    }
  });

  // Get data retention policies
  app.get("/api/admin/security/retention-policies", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const policies = await storage.getDataRetentionPolicies();
      res.json(policies);
    } catch (error) {
      next(error);
    }
  });

  // Get access control policies
  app.get("/api/admin/security/access-policies", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const policies = await storage.getAccessControlPolicies();
      res.json(policies);
    } catch (error) {
      next(error);
    }
  });

  // Document access log
  app.get("/api/admin/documents/:id/access-logs", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const logs = await storage.getDocumentAccessLogs(req.params.id);
      res.json(logs);
    } catch (error) {
      next(error);
    }
  });

  // ========== SUBSCRIPTION PACKAGES API ==========

  // Public endpoint - Get active subscription packages for checkout
  app.get("/api/subscription-packages", async (req, res, next) => {
    try {
      const packages = await db.select().from(subscriptionPackages)
        .where(eq(subscriptionPackages.isActive, true))
        .orderBy(subscriptionPackages.sortOrder);
      res.json(packages);
    } catch (error) {
      next(error);
    }
  });

  // Get all subscription packages (admin)
  app.get("/api/admin/subscription-packages", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const packages = await db.select().from(subscriptionPackages).orderBy(subscriptionPackages.sortOrder);
      res.json(packages);
    } catch (error) {
      next(error);
    }
  });

  // Create/update subscription package
  app.post("/api/admin/subscription-packages", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const pkg = req.body;
      const result = await db.insert(subscriptionPackages).values({
        category: pkg.category,
        studentSegment: pkg.studentSegment,
        productName: pkg.productName,
        isRecommended: pkg.isRecommended || false,
        domainsCovered: pkg.domainsCovered || [],
        price: pkg.price,
        validityDays: pkg.validityDays,
        questionCount: pkg.questionCount,
        reportType: pkg.reportType,
        sortOrder: pkg.sortOrder || 0,
        isActive: pkg.isActive !== false,
      }).returning();
      res.json(result[0]);
    } catch (error) {
      next(error);
    }
  });

  // Update subscription package
  app.patch("/api/admin/subscription-packages/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      await db.update(subscriptionPackages)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(subscriptionPackages.id, id));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Delete subscription package
  app.delete("/api/admin/subscription-packages/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { id } = req.params;
      await db.delete(subscriptionPackages).where(eq(subscriptionPackages.id, id));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Seed subscription packages with default data.
  // PRICING NOTE (WC-C6B): prices/validity/questionCount are PROPOSED DRAFT values confirmed at
  // STOP-FOR-APPROVAL. They are consistent with the B2C ladder anchor (CAP_INS ₹499 / GRW ₹999 /
  // MAS ₹1999) and the renewal engine (validityDays → expiry_date IS NOT NULL).
  // Idempotent: inserts if absent; fills price/validityDays/questionCount if row exists but NULL.
  app.post("/api/admin/subscription-packages/seed", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const defaultPackages = [
        // Entry (Micro Check) — ₹299 / 30 days
        { category: 'Entry (Micro Check)', studentSegment: 'Any Class', productName: 'Mini Learning Check', isRecommended: false, domainsCovered: ['Academic & Cognitive Effectiveness'], reportType: 'Basic', sortOrder: 1, price: 299, validityDays: 30, questionCount: 20 },
        { category: 'Entry (Micro Check)', studentSegment: 'Any Class', productName: 'Stress Check', isRecommended: false, domainsCovered: ['Examination Stress & Emotional Regulation'], reportType: 'Basic', sortOrder: 2, price: 299, validityDays: 30, questionCount: 20 },
        { category: 'Entry (Micro Check)', studentSegment: 'Any Class', productName: 'Snapshot Lite', isRecommended: true, domainsCovered: ['Academic & Cognitive Effectiveness', 'Examination Stress & Emotional Regulation'], reportType: 'Basic', sortOrder: 3, price: 299, validityDays: 30, questionCount: 30 },
        { category: 'Entry (Micro Check)', studentSegment: 'Class 8+', productName: 'Confidence Check', isRecommended: false, domainsCovered: ['Confidence, Self-Concept & Comparison'], reportType: 'Basic', sortOrder: 4, price: 299, validityDays: 30, questionCount: 20 },
        { category: 'Entry (Micro Check)', studentSegment: 'Class 6+', productName: 'Habit Check', isRecommended: false, domainsCovered: ['Discipline, Habits & Consistency'], reportType: 'Basic', sortOrder: 5, price: 299, validityDays: 30, questionCount: 20 },
        // Exam-Season Special — ₹499 / 90 days
        { category: 'Exam-Season Special', studentSegment: 'Class 10 Boards', productName: 'ExamReadiness Index™', isRecommended: false, domainsCovered: ['Academic & Cognitive Effectiveness', 'Thinking Quality Under Pressure', 'Examination Stress & Emotional Regulation', 'Confidence, Self-Concept & Comparison', 'Discipline, Habits & Consistency', 'Motivation, Values & Responsibility', 'Lifestyle & Pressure Environment', 'Competitive Exam Readiness', 'Integrated Root Cause Mapping', 'Academic Planning & Recovery Intelligence', 'Metacognition & Self-Regulation'], reportType: 'Comprehensive', sortOrder: 10, price: 499, validityDays: 90, questionCount: 60 },
        { category: 'Exam-Season Special', studentSegment: 'Class 12 Boards + Entrance', productName: 'ExamReadiness Index™', isRecommended: false, domainsCovered: ['Academic & Cognitive Effectiveness', 'Thinking Quality Under Pressure', 'Examination Stress & Emotional Regulation', 'Confidence, Self-Concept & Comparison', 'Discipline, Habits & Consistency', 'Motivation, Values & Responsibility', 'Lifestyle & Pressure Environment', 'Competitive Exam Readiness', 'Integrated Root Cause Mapping', 'Academic Planning & Recovery Intelligence', 'Metacognition & Self-Regulation'], reportType: 'Comprehensive', sortOrder: 11, price: 499, validityDays: 90, questionCount: 60 },
        { category: 'Exam-Season Special', studentSegment: 'Competitive Exams', productName: 'ExamReadiness Index™', isRecommended: false, domainsCovered: ['Academic & Cognitive Effectiveness', 'Thinking Quality Under Pressure', 'Examination Stress & Emotional Regulation', 'Confidence, Self-Concept & Comparison', 'Discipline, Habits & Consistency', 'Motivation, Values & Responsibility', 'Lifestyle & Pressure Environment', 'Competitive Exam Readiness', 'Integrated Root Cause Mapping', 'Academic Planning & Recovery Intelligence', 'Metacognition & Self-Regulation'], reportType: 'Comprehensive', sortOrder: 12, price: 499, validityDays: 90, questionCount: 60 },
        // Annual Core — ₹999 / 365 days
        { category: 'Annual Core', studentSegment: 'Class 6–8', productName: 'FOUNDATION', isRecommended: false, domainsCovered: ['Academic & Cognitive Effectiveness', 'Examination Stress & Emotional Regulation', 'Adjustment & Coping Capacity', 'Social & Emotional Intelligence', 'Discipline, Habits & Consistency', 'Communication & Expression', 'Lifestyle & Pressure Environment', 'Teacher–Student Interaction Sensitivity'], reportType: 'Detailed', sortOrder: 20, price: 999, validityDays: 365, questionCount: 80 },
        { category: 'Annual Core', studentSegment: 'Class 9–10', productName: 'PERFORMANCE', isRecommended: false, domainsCovered: ['Academic & Cognitive Effectiveness', 'Thinking Quality Under Pressure', 'Examination Stress & Emotional Regulation', 'Confidence, Self-Concept & Comparison', 'Adjustment & Coping Capacity', 'Discipline, Habits & Consistency', 'Communication & Expression', 'Motivation, Values & Responsibility', 'Lifestyle & Pressure Environment', 'Metacognition & Self-Regulation', 'Teacher–Student Interaction Sensitivity'], reportType: 'Detailed', sortOrder: 21, price: 999, validityDays: 365, questionCount: 100 },
        { category: 'Annual Core', studentSegment: 'Class 11–12', productName: 'READINESS', isRecommended: false, domainsCovered: ['Academic & Cognitive Effectiveness', 'Thinking Quality Under Pressure', 'Examination Stress & Emotional Regulation', 'Confidence, Self-Concept & Comparison', 'Adjustment & Coping Capacity', 'Discipline, Habits & Consistency', 'Motivation, Values & Responsibility', 'Lifestyle & Pressure Environment', 'Competitive Exam Readiness', 'Integrated Root Cause Mapping', 'Academic Planning & Recovery Intelligence', 'Metacognition & Self-Regulation'], reportType: 'Detailed', sortOrder: 22, price: 999, validityDays: 365, questionCount: 120 },
        // Premium / High-Pressure — ₹1499 / 365 days
        { category: 'Premium / High-Pressure', studentSegment: 'Competitive Aspirants', productName: 'EDGE', isRecommended: false, domainsCovered: ['All Performance, Stress, Identity, Strategy & Risk Domains (Full Coverage)'], reportType: 'Comprehensive', sortOrder: 30, price: 1499, validityDays: 365, questionCount: 150 },
        // Post-Exam / Transition — ₹399 / 90 days
        { category: 'Post-Exam / Transition', studentSegment: 'Class 10→11 / 12→College', productName: 'Transition Check', isRecommended: false, domainsCovered: ['Adjustment & Coping Capacity', 'Motivation, Values & Responsibility', 'Academic Identity & Meaning', 'Transition & Change Adaptability'], reportType: 'Detailed', sortOrder: 40, price: 399, validityDays: 90, questionCount: 40 },
      ];

      let inserted = 0, updated = 0;
      for (const pkg of defaultPackages) {
        const existing = await db.select().from(subscriptionPackages)
          .where(and(
            eq(subscriptionPackages.productName, pkg.productName),
            eq(subscriptionPackages.studentSegment, pkg.studentSegment)
          ))
          .limit(1);

        if (existing.length === 0) {
          await db.insert(subscriptionPackages).values(pkg);
          inserted++;
        } else if (existing[0].price === null || existing[0].validityDays === null || existing[0].questionCount === null) {
          // Fill-if-null: existing rows seeded before WC-C6B get commercial fields added (idempotent).
          await db.update(subscriptionPackages)
            .set({ price: pkg.price, validityDays: pkg.validityDays, questionCount: pkg.questionCount, updatedAt: new Date() })
            .where(and(
              eq(subscriptionPackages.productName, pkg.productName),
              eq(subscriptionPackages.studentSegment, pkg.studentSegment)
            ));
          updated++;
        }
      }

      res.json({ success: true, inserted, updated, total: defaultPackages.length });
    } catch (error) {
      next(error);
    }
  });

  // Get subscription statistics
  // Get assigned packages for a parent's children
  app.get("/api/parent/assigned-packages", requireAuth, async (req, res, next) => {
    try {
      const parentChildren = await db.select().from(children).where(eq(children.parentId, req.user!.id));
      const childIds = parentChildren.map(c => c.id);
      
      if (childIds.length === 0) {
        return res.json([]);
      }
      
      const assignedPackages = await db.select({
        subscription: studentSubscriptions,
        package: subscriptionPackages,
        child: children,
      })
        .from(studentSubscriptions)
        .innerJoin(subscriptionPackages, eq(studentSubscriptions.packageId, subscriptionPackages.id))
        .innerJoin(children, eq(studentSubscriptions.childId, children.id))
        .where(sql`${studentSubscriptions.childId} IN ${childIds}`);
      
      res.json(assignedPackages);
    } catch (error) {
      next(error);
    }
  });

  // Assign package to child
  app.post("/api/parent/assign-package", requireAuth, async (req, res, next) => {
    try {
      const { childId, packageId, paymentTransactionId } = req.body;
      
      // Verify child belongs to parent
      const child = await db.select().from(children).where(eq(children.id, childId)).limit(1);
      if (child.length === 0 || child[0].parentId !== req.user!.id) {
        return res.status(403).json({ message: 'Unauthorized: Child does not belong to you' });
      }
      
      // Verify package exists and is active
      const pkg = await db.select().from(subscriptionPackages).where(eq(subscriptionPackages.id, packageId)).limit(1);
      if (pkg.length === 0 || !pkg[0].isActive) {
        return res.status(404).json({ message: 'Package not found or not active' });
      }
      
      // Calculate expiry date
      const expiryDate = pkg[0].validityDays 
        ? new Date(Date.now() + pkg[0].validityDays * 24 * 60 * 60 * 1000) 
        : null;
      
      // Create subscription
      const [subscription] = await db.insert(studentSubscriptions).values({
        childId,
        packageId,
        expiryDate,
        paymentTransactionId: paymentTransactionId || null,
        status: 'active',
      }).returning();
      
      res.json({ message: 'Package assigned successfully', subscription });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/subscription-packages/stats", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const packages = await db.select().from(subscriptionPackages);
      const subscriptions = await db.select().from(studentSubscriptions);
      
      const stats = {
        totalPackages: packages.length,
        activePackages: packages.filter(p => p.isActive).length,
        totalSubscriptions: subscriptions.length,
        activeSubscriptions: subscriptions.filter(s => s.status === 'active').length,
        byCategory: {} as Record<string, number>,
      };
      
      for (const pkg of packages) {
        stats.byCategory[pkg.category] = (stats.byCategory[pkg.category] || 0) + 1;
      }
      
      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  // ─── Pricing CSV export ─────────────────────────────────────────────
  app.get("/api/admin/subscription-packages/export.csv", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const packages = await db.select().from(subscriptionPackages).orderBy(asc(subscriptionPackages.sortOrder));
      const headers = ["id","productName","category","studentSegment","price","validityDays","questionCount","reportType","domainsCovered","isRecommended","isActive","sortOrder"];
      const escape = (v: any) => {
        if (v === null || v === undefined) return "";
        const s = Array.isArray(v) ? v.join("|") : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const rows = packages.map(p => headers.map(h => escape((p as any)[h])).join(","));
      const csv = [headers.join(","), ...rows].join("\n");
      const stamp = new Date().toISOString().slice(0,10);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="metryxone-pricing-${stamp}.csv"`);
      res.send(csv);
    } catch (error) {
      next(error);
    }
  });

  // ─── Pricing CSV import (upsert by id, otherwise insert) ─────────────
  app.post("/api/admin/subscription-packages/import", requireAuth, requireSuperAdmin, multer().single("file"), async (req: any, res, next) => {
    try {
      let csvText: string | undefined;
      if (req.file?.buffer) csvText = req.file.buffer.toString("utf8");
      else if (typeof req.body?.csv === "string") csvText = req.body.csv;
      if (!csvText) return res.status(400).json({ error: "Send CSV as 'file' (multipart) or 'csv' (json string)" });

      const records = parse(csvText, { columns: true, skip_empty_lines: true, trim: true }) as any[];
      let inserted = 0, updated = 0, errors: any[] = [];

      for (const r of records) {
        try {
          const data = {
            productName: r.productName?.trim(),
            category: r.category?.trim() || "Custom",
            studentSegment: r.studentSegment?.trim() || "Any Class",
            price: r.price === "" || r.price == null ? null : Number(r.price),
            validityDays: r.validityDays === "" || r.validityDays == null ? null : Number(r.validityDays),
            questionCount: r.questionCount === "" || r.questionCount == null ? null : Number(r.questionCount),
            reportType: r.reportType?.trim() || null,
            domainsCovered: typeof r.domainsCovered === "string"
              ? r.domainsCovered.split("|").map((s: string) => s.trim()).filter(Boolean)
              : Array.isArray(r.domainsCovered) ? r.domainsCovered : [],
            isRecommended: r.isRecommended === "true" || r.isRecommended === true,
            isActive: r.isActive === undefined || r.isActive === "" ? true : (r.isActive === "true" || r.isActive === true),
            sortOrder: Number(r.sortOrder) || 0,
            updatedAt: new Date(),
          };
          if (!data.productName) { errors.push({ row: r, error: "missing productName" }); continue; }

          if (r.id && r.id.trim()) {
            const exists = await db.select().from(subscriptionPackages).where(eq(subscriptionPackages.id, r.id.trim())).limit(1);
            if (exists.length > 0) {
              await db.update(subscriptionPackages).set(data).where(eq(subscriptionPackages.id, r.id.trim()));
              updated++;
              continue;
            }
          }
          await db.insert(subscriptionPackages).values(data as any);
          inserted++;
        } catch (e: any) {
          errors.push({ row: r, error: e.message });
        }
      }

      res.json({ success: true, inserted, updated, errorCount: errors.length, errors: errors.slice(0, 10) });
    } catch (error) {
      next(error);
    }
  });

  // ─── Revenue analytics ──────────────────────────────────────────────
  app.get("/api/admin/subscription-packages/revenue", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const rows = await db.select({
        sub: studentSubscriptions,
        pkg: subscriptionPackages,
      })
      .from(studentSubscriptions)
      .innerJoin(subscriptionPackages, eq(studentSubscriptions.packageId, subscriptionPackages.id));

      let totalRevenue = 0, activeRevenue = 0, totalCount = rows.length, activeCount = 0;
      const byPackage: Record<string, { packageId: string; productName: string; count: number; revenue: number }> = {};
      const byMonth: Record<string, { month: string; count: number; revenue: number }> = {};
      const byCategory: Record<string, { category: string; count: number; revenue: number }> = {};

      for (const r of rows) {
        const price = r.pkg.price ?? 0;
        totalRevenue += price;
        if (r.sub.status === "active") { activeRevenue += price; activeCount++; }

        const key = r.pkg.id;
        if (!byPackage[key]) byPackage[key] = { packageId: key, productName: r.pkg.productName, count: 0, revenue: 0 };
        byPackage[key].count++;
        byPackage[key].revenue += price;

        const cat = r.pkg.category;
        if (!byCategory[cat]) byCategory[cat] = { category: cat, count: 0, revenue: 0 };
        byCategory[cat].count++;
        byCategory[cat].revenue += price;

        const dt = r.sub.purchaseDate ? new Date(r.sub.purchaseDate) : new Date(r.sub.createdAt);
        const monthKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
        if (!byMonth[monthKey]) byMonth[monthKey] = { month: monthKey, count: 0, revenue: 0 };
        byMonth[monthKey].count++;
        byMonth[monthKey].revenue += price;
      }

      const topPackages = Object.values(byPackage).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
      const monthly = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
      const categories = Object.values(byCategory).sort((a, b) => b.revenue - a.revenue);

      const arpu = activeCount > 0 ? Math.round(activeRevenue / activeCount) : 0;
      const arr = Math.round(monthly.reduce((s, m) => s + m.revenue, 0) * (12 / Math.max(monthly.length, 1)));

      res.json({
        summary: { totalRevenue, activeRevenue, totalCount, activeCount, arpu, arr },
        topPackages,
        monthly,
        categories,
      });
    } catch (error) {
      next(error);
    }
  });

  // =================== ADMIN SUBSCRIPTION / BOOKING MANAGEMENT ===================

  app.get("/api/admin/student-subscriptions", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { status, packageId, search } = req.query;
      let conditions = [];
      if (status && status !== 'all') conditions.push(eq(studentSubscriptions.status, status as string));
      if (packageId) conditions.push(eq(studentSubscriptions.packageId, packageId as string));

      const subs = await db.select({
        subscription: studentSubscriptions,
        package: subscriptionPackages,
        child: children,
      })
        .from(studentSubscriptions)
        .innerJoin(subscriptionPackages, eq(studentSubscriptions.packageId, subscriptionPackages.id))
        .leftJoin(children, eq(studentSubscriptions.childId, children.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(studentSubscriptions.createdAt));

      const results = subs.map(s => ({
        ...s.subscription,
        packageName: s.package?.productName,
        packageCategory: s.package?.category,
        childName: s.child?.fullName || 'Unknown',
        childAge: s.child?.dateOfBirth ? Math.floor((Date.now() - new Date(s.child.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null,
      }));

      if (search) {
        const q = (search as string).toLowerCase();
        res.json(results.filter(r => r.childName.toLowerCase().includes(q) || r.packageName?.toLowerCase().includes(q)));
      } else {
        res.json(results);
      }
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/student-subscriptions", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { childId, studentId, packageId, status: subStatus } = req.body;
      if (!packageId) return res.status(400).json({ message: 'packageId is required' });
      if (!childId && !studentId) return res.status(400).json({ message: 'childId or studentId is required' });

      const pkg = await db.select().from(subscriptionPackages).where(eq(subscriptionPackages.id, packageId)).limit(1);
      if (pkg.length === 0) return res.status(404).json({ message: 'Package not found' });

      const expiryDate = pkg[0].validityDays
        ? new Date(Date.now() + pkg[0].validityDays * 24 * 60 * 60 * 1000)
        : null;

      const [subscription] = await db.insert(studentSubscriptions).values({
        childId: childId || null,
        studentId: studentId || null,
        packageId,
        expiryDate,
        status: subStatus || 'active',
      }).returning();

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'create_subscription',
        targetType: 'student_subscription',
        targetId: subscription.id,
        newState: JSON.stringify({ packageId, childId, studentId }),
        notes: `Assigned package ${pkg[0].productName} to ${childId ? 'child' : 'student'}`,
      });

      res.json({ message: 'Subscription created', subscription });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/student-subscriptions/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { status: newStatus, expiryDate } = req.body;
      const validStatuses = ['active', 'suspended', 'expired', 'cancelled'];
      if (newStatus && !validStatuses.includes(newStatus)) {
        return res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      }
      const updates: any = {};
      if (newStatus) updates.status = newStatus;
      if (expiryDate) updates.expiryDate = new Date(expiryDate);

      const [updated] = await db.update(studentSubscriptions)
        .set(updates)
        .where(eq(studentSubscriptions.id, req.params.id))
        .returning();

      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'update_subscription',
        targetType: 'student_subscription',
        targetId: req.params.id,
        newState: JSON.stringify(updates),
        notes: `Updated subscription status to ${newStatus || 'unchanged'}`,
      });

      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/student-subscriptions/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      await db.delete(studentSubscriptions).where(eq(studentSubscriptions.id, req.params.id));
      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'delete_subscription',
        targetType: 'student_subscription',
        targetId: req.params.id,
        notes: 'Deleted student subscription',
      });
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/children-list", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { search } = req.query;
      let childList;
      if (search) {
        childList = await db.select().from(children)
          .where(ilike(children.name, `%${search}%`))
          .orderBy(desc(children.createdAt))
          .limit(50);
      } else {
        childList = await db.select().from(children)
          .orderBy(desc(children.createdAt))
          .limit(100);
      }
      res.json(childList);
    } catch (error) {
      next(error);
    }
  });

  // =================== NOTIFICATION SYSTEM ===================

  // ── Notification Preferences ─────────────────────────────────────────────
  const ALL_NOTIF_CATEGORIES = [
    'security','onboarding','compliance','billing','commerce',
    'exam','reports','ai_tools','booking','feedback','classes','system',
  ];

  const DEFAULT_PREFS = (userId: string) =>
    ALL_NOTIF_CATEGORIES.map(category => ({
      id: null,
      userId,
      category,
      appEnabled:   true,
      emailEnabled: category !== 'system',
      smsEnabled:   false,
      pushEnabled:  false,
    }));

  app.get("/api/notification-preferences", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const rows = await db.execute(
        sql`SELECT id, user_id as "userId", category,
               app_enabled as "appEnabled",
               email_enabled as "emailEnabled",
               sms_enabled as "smsEnabled",
               push_enabled as "pushEnabled"
            FROM notification_preferences
            WHERE user_id = ${userId}`
      );
      const saved: any[] = rows.rows;
      // Merge saved rows with defaults for categories not yet saved
      const merged = ALL_NOTIF_CATEGORIES.map(cat => {
        const found = saved.find((r: any) => r.category === cat);
        return found ?? {
          id: null, userId, category: cat,
          appEnabled: true,
          emailEnabled: cat !== 'system',
          smsEnabled: false,
          pushEnabled: false,
        };
      });
      res.json(merged);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/notification-preferences/:category", requireAuth, async (req, res, next) => {
    try {
      const userId   = req.user!.id;
      const category = req.params.category;
      if (!ALL_NOTIF_CATEGORIES.includes(category)) {
        return res.status(400).json({ message: 'Invalid category' });
      }
      // Security notifications cannot be disabled
      if (category === 'security') {
        return res.status(400).json({ message: 'Security notifications cannot be disabled' });
      }
      const { appEnabled, emailEnabled, smsEnabled, pushEnabled } = req.body;

      await db.execute(sql`
        INSERT INTO notification_preferences
          (user_id, category, app_enabled, email_enabled, sms_enabled, push_enabled, updated_at)
        VALUES (
          ${userId}, ${category},
          ${appEnabled  ?? true},
          ${emailEnabled ?? true},
          ${smsEnabled  ?? false},
          ${pushEnabled ?? false},
          now()
        )
        ON CONFLICT (user_id, category)
        DO UPDATE SET
          app_enabled   = EXCLUDED.app_enabled,
          email_enabled = EXCLUDED.email_enabled,
          sms_enabled   = EXCLUDED.sms_enabled,
          push_enabled  = EXCLUDED.push_enabled,
          updated_at    = now()
      `);

      const updated = await db.execute(sql`
        SELECT id, user_id as "userId", category,
               app_enabled as "appEnabled",
               email_enabled as "emailEnabled",
               sms_enabled as "smsEnabled",
               push_enabled as "pushEnabled"
        FROM notification_preferences
        WHERE user_id = ${userId} AND category = ${category}
      `);
      res.json(updated.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  // ── Notification Templates ────────────────────────────────────────────────
  const BACKEND_NOTIF_TEMPLATES = [
    { id: 1,  category: 'security',    notificationType: 'Login OTP',              triggerEvent: 'User login',              type: 'fya', priority: 'urgent', channels: ['app','email'] },
    { id: 2,  category: 'security',    notificationType: 'Password Reset OTP',     triggerEvent: 'Password reset',          type: 'fya', priority: 'urgent', channels: ['app','email'] },
    { id: 3,  category: 'security',    notificationType: 'New Device Login',        triggerEvent: 'New device detected',     type: 'fyi', priority: 'high',   channels: ['app','email'] },
    { id: 4,  category: 'security',    notificationType: 'Suspicious Login',        triggerEvent: 'Suspicious activity',     type: 'fya', priority: 'urgent', channels: ['app','email'] },
    { id: 5,  category: 'security',    notificationType: 'Multiple Failed Logins',  triggerEvent: 'Failed login threshold',  type: 'fya', priority: 'high',   channels: ['app','email'] },
    { id: 6,  category: 'security',    notificationType: 'Role Changed',            triggerEvent: 'Admin changes user role', type: 'fyi', priority: 'high',   channels: ['app','email'] },
    { id: 7,  category: 'onboarding',  notificationType: 'Welcome',                 triggerEvent: 'Account created',         type: 'fyi', priority: 'normal', channels: ['app','email'] },
    { id: 8,  category: 'onboarding',  notificationType: 'Complete Your Profile',   triggerEvent: 'Profile incomplete',      type: 'fyi', priority: 'low',    channels: ['app'] },
    { id: 9,  category: 'onboarding',  notificationType: 'Mentor Assigned',         triggerEvent: 'Mentor assignment',       type: 'fyi', priority: 'normal', channels: ['app','email'] },
    { id: 10, category: 'compliance',  notificationType: 'Privacy Policy Updated',  triggerEvent: 'Policy update',           type: 'fyi', priority: 'normal', channels: ['app','email'] },
    { id: 11, category: 'compliance',  notificationType: 'Guardian Consent',        triggerEvent: 'Minor registration',      type: 'fya', priority: 'high',   channels: ['app','email'] },
    { id: 12, category: 'billing',     notificationType: 'Trial Ending Soon',       triggerEvent: 'Trial < 3 days',          type: 'fya', priority: 'high',   channels: ['app','email'] },
    { id: 13, category: 'billing',     notificationType: 'Subscription Expired',    triggerEvent: 'Subscription lapse',      type: 'fya', priority: 'urgent', channels: ['app','email'] },
    { id: 14, category: 'billing',     notificationType: 'Payment Successful',      triggerEvent: 'Payment processed',       type: 'fyi', priority: 'normal', channels: ['app','email'] },
    { id: 15, category: 'billing',     notificationType: 'Payment Failed',          triggerEvent: 'Payment declined',        type: 'fya', priority: 'urgent', channels: ['app','email'] },
    { id: 16, category: 'billing',     notificationType: 'Invoice Generated',       triggerEvent: 'Invoice created',         type: 'fyi', priority: 'normal', channels: ['app','email'] },
    { id: 17, category: 'commerce',    notificationType: 'Discount Code Issued',    triggerEvent: 'Code generated',          type: 'fyi', priority: 'normal', channels: ['app','email'] },
    { id: 18, category: 'commerce',    notificationType: 'Discount Expiring',       triggerEvent: 'Code expires in 2 days',  type: 'fyi', priority: 'normal', channels: ['app'] },
    { id: 19, category: 'commerce',    notificationType: 'Discount Applied',        triggerEvent: 'Code redeemed',           type: 'fyi', priority: 'low',    channels: ['app'] },
    { id: 20, category: 'commerce',    notificationType: 'Coupon Invalid',          triggerEvent: 'Invalid code attempt',    type: 'fyi', priority: 'low',    channels: ['app'] },
    { id: 21, category: 'commerce',    notificationType: 'Limited Time Offer',      triggerEvent: 'Campaign scheduled',      type: 'fyi', priority: 'normal', channels: ['app','email'] },
    { id: 22, category: 'exam',        notificationType: 'Test Assigned',           triggerEvent: 'Teacher assigns test',    type: 'fya', priority: 'high',   channels: ['app','email'] },
    { id: 23, category: 'exam',        notificationType: 'Test Rescheduled',        triggerEvent: 'Test date changed',       type: 'fyi', priority: 'normal', channels: ['app','email'] },
    { id: 24, category: 'exam',        notificationType: 'Test Cancelled',          triggerEvent: 'Test cancelled',          type: 'fyi', priority: 'normal', channels: ['app','email'] },
    { id: 25, category: 'exam',        notificationType: 'Test Window Open',        triggerEvent: 'Test window starts',      type: 'fya', priority: 'high',   channels: ['app','email'] },
    { id: 26, category: 'exam',        notificationType: 'Test Reminder',           triggerEvent: '30 min before test',      type: 'fyi', priority: 'normal', channels: ['app'] },
    { id: 27, category: 'exam',        notificationType: 'Test Started',            triggerEvent: 'Student begins test',     type: 'fyi', priority: 'normal', channels: ['app'] },
    { id: 28, category: 'exam',        notificationType: 'Test Submitted',          triggerEvent: 'Test submission',         type: 'fyi', priority: 'normal', channels: ['app','email'] },
    { id: 29, category: 'exam',        notificationType: 'Test Auto-Submitted',     triggerEvent: 'Time expired',            type: 'fyi', priority: 'normal', channels: ['app'] },
    { id: 30, category: 'exam',        notificationType: 'Test Not Attempted',      triggerEvent: 'Deadline passed',         type: 'fyi', priority: 'high',   channels: ['app','email'] },
    { id: 31, category: 'exam',        notificationType: 'Retest Available',        triggerEvent: 'Retake enabled',          type: 'fya', priority: 'normal', channels: ['app','email'] },
    { id: 32, category: 'reports',     notificationType: 'Report Published',        triggerEvent: 'Report generated',        type: 'fyi', priority: 'normal', channels: ['app','email'] },
    { id: 33, category: 'reports',     notificationType: 'AI Insight Generated',    triggerEvent: 'AI analysis complete',    type: 'fyi', priority: 'normal', channels: ['app'] },
    { id: 34, category: 'reports',     notificationType: 'Benchmark Available',     triggerEvent: 'Benchmark computed',      type: 'fyi', priority: 'normal', channels: ['app','email'] },
    { id: 35, category: 'reports',     notificationType: 'Report Viewed',           triggerEvent: 'Report opened',           type: 'fyi', priority: 'low',    channels: ['app'] },
    { id: 36, category: 'reports',     notificationType: 'Refresher Unlocked',      triggerEvent: 'Low score threshold',     type: 'fyi', priority: 'normal', channels: ['app','email'] },
    { id: 37, category: 'reports',     notificationType: 'Weak Area Identified',    triggerEvent: 'AI analysis',             type: 'fyi', priority: 'normal', channels: ['app','email'] },
    { id: 38, category: 'reports',     notificationType: 'Competency Mastered',     triggerEvent: 'High score threshold',    type: 'fyi', priority: 'normal', channels: ['app','email'] },
    { id: 39, category: 'ai_tools',   notificationType: 'AI Test Ready for Review', triggerEvent: 'AI generation complete', type: 'fya', priority: 'normal', channels: ['app','email'] },
    { id: 40, category: 'ai_tools',   notificationType: 'Adaptive Test Ready',      triggerEvent: 'Adaptive test created',  type: 'fyi', priority: 'normal', channels: ['app'] },
    { id: 41, category: 'ai_tools',   notificationType: 'Question Bank Updated',    triggerEvent: 'Bulk AI generation',     type: 'fyi', priority: 'low',    channels: ['app'] },
    { id: 42, category: 'ai_tools',   notificationType: 'AI Study Recommendations', triggerEvent: 'Weekly AI run',          type: 'fyi', priority: 'normal', channels: ['app','email'] },
    { id: 43, category: 'ai_tools',   notificationType: 'AI Usage Limit Reached',   triggerEvent: 'Quota exceeded',         type: 'fyi', priority: 'high',   channels: ['app','email'] },
    { id: 44, category: 'ai_tools',   notificationType: 'AI Generator Error',       triggerEvent: 'AI failure',             type: 'fyi', priority: 'normal', channels: ['app'] },
    { id: 45, category: 'booking',    notificationType: 'Session Booked',            triggerEvent: 'Booking confirmed',      type: 'fyi', priority: 'normal', channels: ['app','email'] },
    { id: 46, category: 'booking',    notificationType: 'Booking Confirmed',         triggerEvent: 'Mentor accepts',         type: 'fyi', priority: 'normal', channels: ['app','email'] },
    { id: 47, category: 'booking',    notificationType: 'Session Reminder',          triggerEvent: '30 min before session',  type: 'fyi', priority: 'normal', channels: ['app'] },
    { id: 48, category: 'booking',    notificationType: 'Session Rescheduled',       triggerEvent: 'Reschedule request',     type: 'fyi', priority: 'normal', channels: ['app','email'] },
    { id: 49, category: 'booking',    notificationType: 'Session Cancelled',         triggerEvent: 'Cancellation',           type: 'fyi', priority: 'high',   channels: ['app','email'] },
    { id: 50, category: 'booking',    notificationType: 'No-Show Alert',             triggerEvent: 'Student absent',         type: 'fyi', priority: 'normal', channels: ['app'] },
    { id: 51, category: 'booking',    notificationType: 'Session Completed',         triggerEvent: 'Session ends',           type: 'fya', priority: 'normal', channels: ['app','email'] },
    { id: 52, category: 'feedback',   notificationType: 'Feedback Requested',        triggerEvent: 'Post-session',           type: 'fya', priority: 'normal', channels: ['app','email'] },
    { id: 53, category: 'feedback',   notificationType: 'Rating Received',           triggerEvent: 'Student submits rating', type: 'fyi', priority: 'low',    channels: ['app'] },
    { id: 54, category: 'classes',    notificationType: 'Class Scheduled',           triggerEvent: 'Class created',          type: 'fyi', priority: 'normal', channels: ['app','email'] },
    { id: 55, category: 'classes',    notificationType: 'Class Reminder',            triggerEvent: '1 hr before class',      type: 'fyi', priority: 'normal', channels: ['app'] },
    { id: 56, category: 'classes',    notificationType: 'Class Link Shared',         triggerEvent: 'Link posted',            type: 'fyi', priority: 'normal', channels: ['app','email'] },
    { id: 57, category: 'classes',    notificationType: 'Class Cancelled',           triggerEvent: 'Class cancelled',        type: 'fyi', priority: 'high',   channels: ['app','email'] },
    { id: 58, category: 'classes',    notificationType: 'Substitute Assigned',       triggerEvent: 'Mentor substituted',     type: 'fyi', priority: 'normal', channels: ['app','email'] },
    { id: 59, category: 'classes',    notificationType: 'Attendance Marked',         triggerEvent: 'Attendance recorded',    type: 'fyi', priority: 'low',    channels: ['app'] },
  ];

  app.get("/api/notification-templates", requireAuth, async (req, res, next) => {
    try {
      const { category } = req.query;
      const templates = category
        ? BACKEND_NOTIF_TEMPLATES.filter(t => t.category === category)
        : BACKEND_NOTIF_TEMPLATES;
      res.json(templates);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/notifications", requireAuth, async (req, res, next) => {
    try {
      const { type, category, isRead, limit } = req.query;
      const filters: any = {};
      if (type) filters.type = type;
      if (category) filters.category = category;
      if (isRead !== undefined) filters.isRead = isRead === 'true';
      if (limit) filters.limit = parseInt(limit as string);
      const notifs = await storage.getNotifications(req.user!.id, filters);
      res.json(notifs);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/notifications/unread-count", requireAuth, async (req, res, next) => {
    try {
      const count = await storage.getUnreadNotificationCount(req.user!.id);
      res.json({ count });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/notifications/:id/read", requireAuth, async (req, res, next) => {
    try {
      const result = await storage.markNotificationRead(req.params.id, req.user!.id);
      if (!result) return res.status(404).json({ message: 'Notification not found' });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/notifications/mark-all-read", requireAuth, async (req, res, next) => {
    try {
      const count = await storage.markAllNotificationsRead(req.user!.id);
      res.json({ message: `Marked ${count} notifications as read`, count });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/notifications/:id/acknowledge", requireAuth, async (req, res, next) => {
    try {
      const { notes } = req.body || {};
      const result = await storage.acknowledgeNotification(req.params.id, req.user!.id, notes);
      if (!result) return res.status(404).json({ message: 'Notification not found' });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/notifications/:id", requireAuth, async (req, res, next) => {
    try {
      const deleted = await storage.deleteNotification(req.params.id, req.user!.id);
      if (!deleted) return res.status(404).json({ message: 'Notification not found' });
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Email Consents
  app.get("/api/email-consents", requireAuth, async (req, res, next) => {
    try {
      const consents = await storage.initializeDefaultConsents(req.user!.id);
      res.json(consents);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/email-consents/:consentType", requireAuth, async (req, res, next) => {
    try {
      const { isConsented } = req.body;
      if (typeof isConsented !== 'boolean') {
        return res.status(400).json({ message: 'isConsented must be a boolean' });
      }
      const result = await storage.upsertEmailConsent(req.user!.id, req.params.consentType, isConsented);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // Acknowledgements
  app.get("/api/acknowledgements", requireAuth, async (req, res, next) => {
    try {
      const { type } = req.query;
      const acks = await storage.getAcknowledgements(req.user!.id, type as string);
      res.json(acks);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/acknowledgements", requireAuth, async (req, res, next) => {
    try {
      const { acknowledgementType, referenceId, referenceType, notes } = req.body;
      if (!acknowledgementType) return res.status(400).json({ message: 'acknowledgementType is required' });
      const result = await storage.createAcknowledgement({
        userId: req.user!.id,
        acknowledgementType,
        referenceId,
        referenceType,
        notes,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // Admin - Notification Broadcasts
  app.get("/api/admin/notification-broadcasts", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { status } = req.query;
      const broadcasts = await storage.getNotificationBroadcasts({ status: status as string });
      res.json(broadcasts);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/notification-broadcasts", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { type, category, title, message, targetRoles, targetUserIds, priority, actionUrl, actionLabel, sendEmail } = req.body;
      if (!title || !message) return res.status(400).json({ message: 'title and message are required' });
      const broadcast = await storage.createNotificationBroadcast({
        senderId: req.user!.id,
        type: type || 'fyi',
        category: category || 'system',
        title,
        message,
        targetRoles: targetRoles || [],
        targetUserIds: targetUserIds || [],
        priority: priority || 'normal',
        actionUrl,
        actionLabel,
        sendEmail: sendEmail || false,
      });
      res.json(broadcast);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/notification-broadcasts/:id/send", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const result = await storage.sendBroadcast(req.params.id);
      await storage.createAdminAuditLog({
        adminUserId: req.user!.id,
        actionType: 'send_broadcast',
        targetType: 'notification_broadcast',
        targetId: req.params.id,
        notes: `Sent broadcast to ${result.sent} recipients`,
      });
      res.json({ message: `Broadcast sent to ${result.sent} recipients`, ...result });
    } catch (error) {
      next(error);
    }
  });

  // Admin - Send direct notification to a user
  app.post("/api/admin/send-notification", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { recipientId, type, category, title, message, priority, actionUrl, actionLabel } = req.body;
      if (!recipientId || !title || !message) {
        return res.status(400).json({ message: 'recipientId, title, and message are required' });
      }
      const notif = await storage.createNotification({
        recipientId,
        senderId: req.user!.id,
        type: type || 'fyi',
        category: category || 'general',
        title,
        message,
        priority: priority || 'normal',
        actionUrl,
        actionLabel,
      });
      res.json(notif);
    } catch (error) {
      next(error);
    }
  });

  // =================== LBI API Routes ===================
  
  // Get all LBI domains with subdomains
  app.get("/api/lbi/domains", async (req, res, next) => {
    try {
      const domains = await db.execute(sql`
        SELECT d.*, 
          json_agg(
            json_build_object(
              'id', s.id,
              'subdomain_code', s.subdomain_code,
              'subdomain_name', s.subdomain_name,
              'description', s.description,
              'display_order', s.display_order
            ) ORDER BY s.display_order
          ) FILTER (WHERE s.id IS NOT NULL) as subdomains
        FROM lbi_domains d
        LEFT JOIN lbi_subdomains s ON s.domain_id = d.id
        WHERE LOWER(d.status) = 'active'
        GROUP BY d.id
        ORDER BY d.display_order
      `);
      res.json(domains.rows);
    } catch (error) {
      next(error);
    }
  });

  // Get LBI age bands
  app.get("/api/lbi/age-bands", async (req, res, next) => {
    try {
      const ageBands = await db.execute(sql`
        SELECT * FROM lbi_age_bands WHERE LOWER(status) = 'active' ORDER BY min_age
      `);
      res.json(ageBands.rows);
    } catch (error) {
      next(error);
    }
  });

  // Get LBI questions by domain and age band
  app.get("/api/lbi/questions", async (req, res, next) => {
    try {
      const { domainId, ageBandId, difficulty } = req.query;
      
      let query = sql`
        SELECT q.*, 
          d.domain_code, d.domain_name,
          s.subdomain_code, s.subdomain_name,
          ab.band_code, ab.band_name,
          rs.scale_code, rs.options, rs.scoring, rs.reverse_scoring_map
        FROM lbi_questions q
        JOIN lbi_domains d ON d.id = q.domain_id
        LEFT JOIN lbi_subdomains s ON s.id = q.subdomain_id
        JOIN lbi_age_bands ab ON ab.id = q.age_band_id
        JOIN lbi_response_scales rs ON rs.id = q.response_scale_id
        WHERE LOWER(q.status) = 'active'
      `;
      
      if (domainId) {
        query = sql`${query} AND q.domain_id = ${domainId}`;
      }
      if (ageBandId) {
        query = sql`${query} AND q.age_band_id = ${ageBandId}`;
      }
      if (difficulty) {
        query = sql`${query} AND q.difficulty = ${difficulty}`;
      }
      
      query = sql`${query} ORDER BY d.display_order, s.display_order, q.display_order`;
      
      const questions = await db.execute(query);
      res.json(questions.rows);
    } catch (error) {
      next(error);
    }
  });

  // Calculate LBI score from responses
  const lbiResponseSchema = z.object({
    ageBandCode: z.string().optional(),
    responses: z.array(z.object({
      questionId: z.string(),
      rawScore: z.number().min(1).max(5),
    }))
  });

  app.post("/api/lbi/calculate-score", requireAuth, async (req, res, next) => {
    try {
      const validation = lbiResponseSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid request", errors: validation.error.issues });
      }
      
      const { responses, ageBandCode } = validation.data;
      
      const domainScores: Record<string, { total: number; count: number; items: any[] }> = {};
      const subdomainScores: Record<string, { total: number; count: number; domainId: string }> = {};
      
      for (const response of responses) {
        const { questionId, rawScore } = response;
        
        const questionData = await db.execute(sql`
          SELECT q.*, rs.scoring, rs.reverse_scoring_map
          FROM lbi_questions q
          JOIN lbi_response_scales rs ON rs.id = q.response_scale_id
          WHERE q.id = ${questionId}
        `);
        
        if (questionData.rows.length === 0) continue;
        
        const question = questionData.rows[0];
        let scoring: number[] = [];
        let reverseMap: number[] = [];
        
        try {
          scoring = typeof question.scoring === 'string' ? JSON.parse(question.scoring) : (question.scoring || []);
          reverseMap = typeof question.reverse_scoring_map === 'string' ? JSON.parse(question.reverse_scoring_map) : (question.reverse_scoring_map || []);
        } catch {
          scoring = [1, 2, 3, 4, 5];
          reverseMap = [5, 4, 3, 2, 1];
        }
        
        let finalScore = rawScore;
        if (question.reverse_scored && reverseMap.length > 0) {
          const idx = scoring.indexOf(rawScore);
          if (idx >= 0 && idx < reverseMap.length) {
            finalScore = reverseMap[idx];
          }
        }
        
        const domainId = String(question.domain_id);
        if (!domainScores[domainId]) {
          domainScores[domainId] = { total: 0, count: 0, items: [] };
        }
        domainScores[domainId].total += finalScore;
        domainScores[domainId].count += 1;
        domainScores[domainId].items.push({ questionId, rawScore, finalScore, reversed: question.reverse_scored });
        
        const subdomainId = question.subdomain_id ? String(question.subdomain_id) : null;
        if (subdomainId) {
          if (!subdomainScores[subdomainId]) {
            subdomainScores[subdomainId] = { total: 0, count: 0, domainId };
          }
          subdomainScores[subdomainId].total += finalScore;
          subdomainScores[subdomainId].count += 1;
        }
      }
      
      const domainResults: any[] = [];
      let overallTotal = 0;
      let overallCount = 0;
      
      for (const [domainId, data] of Object.entries(domainScores)) {
        const domainInfo = await db.execute(sql`SELECT * FROM lbi_domains WHERE id = ${domainId}`);
        const domain = domainInfo.rows[0];
        const rawScore = data.total / data.count;
        // scorePct is the raw scale percentage (rawScore/5*100). It is NOT a
        // percentile (rank vs a population) — percentiles require norms below.
        const scorePct = Math.round((rawScore / 5) * 100);
        
        domainResults.push({
          domainId,
          domainCode: domain?.domain_code,
          domainName: domain?.domain_name,
          rawScore: Math.round(rawScore * 100) / 100,
          scorePct,
          percentile: null,
          percentileBasis: 'subdomain_norms_only',
          weightage: domain?.weightage || 1,
          itemCount: data.count,
        });
        
        const weightage = Number(domain?.weightage) || 1;
        overallTotal += rawScore * weightage;
        overallCount += weightage;
      }
      
      // Norm-referenced subdomain percentiles (only when an age band is supplied
      // AND real computed norms exist for that band/subdomain). Otherwise null.
      const subdomainResults: any[] = [];
      let normsAvailable = false;
      try {
        const { percentileFromNorms } = await import('./services/lbi-norms-engine');
        const subIds = Object.keys(subdomainScores);
        for (const subId of subIds) {
          const sd = subdomainScores[subId];
          const sdRaw = sd.total / sd.count;
          const sdPct = Math.round((sdRaw / 5) * 100);
          const sdInfo = await db.execute(sql`SELECT subdomain_code, subdomain_name FROM lbi_subdomains WHERE id = ${subId}`);
          const subdomainCode = sdInfo.rows[0]?.subdomain_code as string | undefined;
          let norm: any = { percentile: null, basis: 'no_norms', is_provisional: false, sample_size: null };
          if (ageBandCode && subdomainCode) {
            norm = await percentileFromNorms(concernsPool, ageBandCode, subdomainCode, sdPct);
            if (norm.percentile != null) normsAvailable = true;
          }
          subdomainResults.push({
            subdomainId: subId,
            subdomainCode,
            subdomainName: sdInfo.rows[0]?.subdomain_name,
            rawScore: Math.round(sdRaw * 100) / 100,
            scorePct: sdPct,
            percentile: norm.percentile,
            percentileBasis: norm.basis,
            percentileProvisional: norm.is_provisional,
            normSampleSize: norm.sample_size,
            itemCount: sd.count,
          });
        }
      } catch (e) {
        console.error('[lbi] subdomain percentile error:', e);
      }
      
      // Overall raw aggregate (0..100 scale). Labelled scorePct, not a percentile.
      const overallScorePct = Math.round((overallTotal / overallCount / 5) * 100);
      
      res.json({
        domainScores: domainResults,
        subdomainScores: subdomainResults,
        overallLBI: overallScorePct,
        overallScorePct,
        overallPercentile: null,
        normReferenced: normsAvailable,
        percentileNote: normsAvailable
          ? 'Subdomain percentiles are norm-referenced from real assessment data.'
          : 'No norms available for this age band yet — scores are raw scale percentages, not percentiles.',
        interpretation: getLBIInterpretation(overallScorePct),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  });

  // Create LBI assessment session
  app.post("/api/lbi/sessions", requireAuth, async (req, res, next) => {
    try {
      const sessionSchema = z.object({
        ageBandId: z.string(),
        domainId: z.string().optional(),
        assessmentType: z.string().default('full'),
      });
      const validation = sessionSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid request", errors: validation.error.issues });
      }
      const { ageBandId, domainId, assessmentType } = validation.data;
      const user = req.user as any;

      const questionCount = await db.execute(sql`
        SELECT COUNT(*) as total FROM lbi_questions 
        WHERE age_band_id = ${ageBandId} 
        AND LOWER(status) = 'active'
        ${domainId ? sql`AND domain_id = ${domainId}` : sql``}
      `);

      const total = Number(questionCount.rows[0]?.total) || 0;

      const sessionId = `lbi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await db.execute(sql`
        INSERT INTO lbi_assessment_sessions (id, child_id, student_id, age_band_id, assessment_type, total_questions, status)
        VALUES (${sessionId}, ${user.id}, ${user.id}, ${ageBandId}, ${assessmentType}, ${total}, 'in_progress')
      `);

      res.json({ sessionId, totalQuestions: total });
    } catch (error) {
      next(error);
    }
  });

  // Save LBI session responses and complete session
  app.post("/api/lbi/sessions/:sessionId/complete", requireAuth, async (req, res, next) => {
    try {
      const { sessionId } = req.params;
      const responseSchema = z.object({
        responses: z.array(z.object({
          questionId: z.string(),
          rawScore: z.number().min(1).max(5),
          responseTimeMs: z.number().optional(),
          questionOrder: z.number().optional(),
        })),
      });
      const validation = responseSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid request", errors: validation.error.issues });
      }

      const { responses } = validation.data;

      for (const resp of responses) {
        const respId = `lsr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await db.execute(sql`
          INSERT INTO lbi_session_responses (id, session_id, question_id, response_value, raw_score, response_time_ms, question_order)
          VALUES (${respId}, ${sessionId}, ${resp.questionId}, ${resp.rawScore}, ${resp.rawScore}, ${resp.responseTimeMs || 0}, ${resp.questionOrder || 0})
          ON CONFLICT DO NOTHING
        `);
      }

      await db.execute(sql`
        UPDATE lbi_assessment_sessions 
        SET status = 'completed', 
            questions_answered = ${responses.length},
            completed_at = NOW()
        WHERE id = ${sessionId}
      `);

      res.json({ message: "Session completed", sessionId });
    } catch (error) {
      next(error);
    }
  });

  // Get LBI session history for current user
  app.get("/api/lbi/sessions", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const sessions = await db.execute(sql`
        SELECT s.*, ab.band_code, ab.band_name 
        FROM lbi_assessment_sessions s
        LEFT JOIN lbi_age_bands ab ON ab.id = s.age_band_id
        WHERE s.child_id = ${user.id} OR s.student_id = ${user.id}
        ORDER BY s.created_at DESC
        LIMIT 20
      `);
      res.json(sessions.rows);
    } catch (error) {
      next(error);
    }
  });

  // Resolve REAL (non-demo) LBI scores from the auditable engine history for a single
  // AUTHORIZED subject email. The caller MUST pre-verify that the principal is allowed
  // to see this subject (see /api/ai-reports/generate). Demo / @example.com rows are
  // excluded so fabricated seed data can never surface as real.
  async function resolveRealLbiScore(
    p: pg.Pool,
    email: string | null
  ): Promise<any | null> {
    if (!email) return null;
    try {
      const r = await p.query(
        `SELECT overall_lbi, consistency_score, persistence_score, attention_score,
                adaptability_score, velocity_score, learning_style, sessions_analyzed, calculated_at
         FROM lbi_score_history
         WHERE LOWER(user_email) = LOWER($1)
           AND COALESCE(source,'') <> 'demo'
           AND user_email NOT ILIKE '%@example.com'
         ORDER BY calculated_at DESC LIMIT 1`,
        [email]
      );
      return r.rows[0] || null;
    } catch { /* history table may be absent in some envs */ }
    return null;
  }

  // Resolve the subject email a principal is AUTHORIZED to pull real scores for.
  // Rules: super_admin → any childId (resolved via users/children); a parent → only a
  // child they OWN (storage.getChild enforces ownership) returns 403 otherwise; no
  // childId → the authenticated principal's own email. Never trusts a client email.
  async function resolveAuthorizedSubjectEmail(
    p: pg.Pool,
    principal: any,
    childId: string | null
  ): Promise<{ email: string | null } | { forbidden: true }> {
    const isSuper = principal?.role === 'super_admin';
    if (!childId) {
      return { email: principal?.email || null };
    }
    if (isSuper) {
      try {
        const u = await p.query('SELECT email FROM users WHERE id = $1 LIMIT 1', [childId]);
        if (u.rows[0]?.email) return { email: u.rows[0].email };
      } catch { /* best-effort */ }
      try {
        const c = await p.query('SELECT student_user_id FROM children WHERE id = $1 LIMIT 1', [childId]);
        const sid = c.rows[0]?.student_user_id;
        if (sid) {
          const su = await p.query('SELECT email FROM users WHERE id = $1 LIMIT 1', [sid]);
          if (su.rows[0]?.email) return { email: su.rows[0].email };
        }
      } catch { /* best-effort */ }
      return { email: null };
    }
    // Non-superadmin: childId must be a child OWNED by this principal.
    let child: any = null;
    try { child = await storage.getChild(childId, principal.id); } catch { /* absent table → undefined */ }
    if (!child) return { forbidden: true };
    if (child.studentUserId) {
      try {
        const su = await p.query('SELECT email FROM users WHERE id = $1 LIMIT 1', [child.studentUserId]);
        if (su.rows[0]?.email) return { email: su.rows[0].email };
      } catch { /* best-effort */ }
    }
    return { email: null };
  }

  // AI-Powered Reports Generation Endpoint — AUTH REQUIRED (returns real LBI data).
  app.post('/api/ai-reports/generate', requireAuth, async (req, res, next) => {
    try {
      const reportSchema = z.object({
        reportType: z.enum(['learning-analysis', 'behavioral-insights', 'performance-prediction', 'exam-readiness', 'lbi-comprehensive']),
        childName: z.string().optional(),
        childAge: z.number().optional(),
        childGrade: z.string().optional(),
        childId: z.string().optional(),
      });

      const parsed = reportSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request', details: parsed.error.format() });
      }

      const { reportType, childName, childAge, childGrade, childId } = parsed.data;

      if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY || !process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
        return res.status(500).json({ error: 'AI integration not configured' });
      }

      const openaiClient = new (await import('openai')).default({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      // ── Resolve REAL LBI scores from the deterministic engine (never the LLM) ──
      // Scores come ONLY from the auditable engine (lbi_score_history / lbi_scores),
      // excluding fabricated demo rows. The subject is resolved from the AUTHENTICATED
      // principal's authorization (own self / owned child / superadmin) — a client-
      // supplied email is NEVER trusted. If none resolve, the report is returned as a
      // clearly-marked PREVIEW with no numbers — the LLM only ever writes narrative.
      const subject = await resolveAuthorizedSubjectEmail(concernsPool, req.user as any, childId || null);
      if ('forbidden' in subject) {
        return res.status(403).json({ error: 'Not authorized to generate a report for this subject' });
      }
      const realScore = await resolveRealLbiScore(concernsPool, subject.email);

      const sectionDefs: Record<string, string[]> = {
        'learning-analysis': ['Cognitive Strengths', 'Learning Style Profile', 'Knowledge Retention', 'Critical Thinking'],
        'behavioral-insights': ['Emotional Regulation', 'Social Interaction', 'Motivation & Drive', 'Discipline & Habits'],
        'performance-prediction': ['Academic Trajectory', 'Subject-Wise Forecast', 'Risk Indicators', 'Growth Opportunities'],
        'exam-readiness': ['Content Mastery', 'Test-Taking Skills', 'Stress Management', 'Time Management'],
        'lbi-comprehensive': [
          'Academic & Cognitive Effectiveness (D01)', 'Thinking Quality Under Pressure (D02)',
          'Exam Stress & Emotional Regulation (D03)', 'Confidence & Self-Concept (D04)',
          'Adjustment & Coping (D05)', 'Social & Emotional Intelligence (D06)',
        ],
      };
      const titles: Record<string, string> = {
        'learning-analysis': 'Learning Analysis Report',
        'behavioral-insights': 'Behavioral Insights Report',
        'performance-prediction': 'Performance Prediction Report',
        'exam-readiness': 'Exam Readiness Report',
        'lbi-comprehensive': 'LBI Comprehensive Report',
      };
      const sections = sectionDefs[reportType] || sectionDefs['learning-analysis'];

      // Prompts request ONLY qualitative narrative. No scores, ratings, or percentages.
      const dataContext = realScore
        ? `This student has REAL Learning Behaviour Index results from completed assessments. Overall LBI: ${realScore.overall_lbi}/100. Behavioural dimensions (0-100): consistency ${realScore.consistency_score}, persistence ${realScore.persistence_score}, attention ${realScore.attention_score}, adaptability ${realScore.adaptability_score}, velocity ${realScore.velocity_score}. Dominant learning style: ${realScore.learning_style || 'unspecified'}. Base your narrative on these measured results.`
        : `No measured assessment data is available for this student yet. Write GENERAL developmental guidance appropriate to the age/grade and frame it as preliminary. Do NOT invent specific results or pretend an assessment was taken.`;

      const prompt = `You are an expert educational psychologist generating the qualitative narrative for a "${titles[reportType]}".
Student: ${childName || 'Student'}, Age: ${childAge || 'N/A'}, Grade: ${childGrade || 'N/A'}.
${dataContext}

CRITICAL: Do NOT output any numeric scores, ratings, percentages, grades, or made-up measurements anywhere. Numbers are supplied separately by an auditable scoring engine — your job is qualitative analysis ONLY.

Respond with valid JSON only (no markdown), using EXACTLY these section names in order: ${JSON.stringify(sections)}.
{
  "title": "${titles[reportType]}",
  "summary": "2-3 sentence executive summary (no numbers)",
  "sections": [
    { "name": "<one of the section names above>", "findings": ["finding1", "finding2", "finding3"], "recommendation": "text" }
  ],
  "keyInsights": ["insight1", "insight2", "insight3"],
  "actionPlan": ["action1", "action2", "action3"]
}`;

      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are an expert educational analyst. Respond with valid JSON only, no markdown. Never include numeric scores, ratings, or percentages — qualitative narrative only.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 2000,
      });

      const reportContent = JSON.parse(response.choices[0]?.message?.content || '{}');

      // Strip any stray numeric fields the model may have produced — scores are
      // authoritative ONLY from the engine.
      if (reportContent && typeof reportContent === 'object') {
        delete (reportContent as any).overallScore;
        if (Array.isArray((reportContent as any).sections)) {
          (reportContent as any).sections = (reportContent as any).sections.map((s: any) => {
            if (s && typeof s === 'object') { const { score, ...rest } = s; return rest; }
            return s;
          });
        }
      }

      const dimensions = realScore ? [
        { key: 'consistency', label: 'Consistency', score: realScore.consistency_score },
        { key: 'persistence', label: 'Persistence', score: realScore.persistence_score },
        { key: 'attention', label: 'Attention', score: realScore.attention_score },
        { key: 'adaptability', label: 'Adaptability', score: realScore.adaptability_score },
        { key: 'velocity', label: 'Velocity', score: realScore.velocity_score },
      ] : null;

      res.json({
        ...reportContent,
        reportType,
        overallScore: realScore ? realScore.overall_lbi : null,
        dimensions,
        learningStyle: realScore?.learning_style ?? null,
        sessionsAnalyzed: realScore?.sessions_analyzed ?? null,
        dataAvailable: !!realScore,
        preview: !realScore,
        scoreSource: realScore ? 'lbi_engine' : null,
        disclaimer: realScore
          ? null
          : 'Preview — this report contains qualitative guidance only. Numeric LBI scores appear once the student completes a measured Learning Behaviour Index assessment.',
        generatedAt: new Date().toISOString(),
        childId: childId || null,
        childName: childName || null,
      });
    } catch (error: any) {
      console.error('AI Report generation error:', error);
      res.status(500).json({ error: 'Failed to generate AI report', details: error.message });
    }
  });

  // Get available AI report types
  app.get('/api/ai-reports/types', (_req, res) => {
    res.json([
      { id: 'learning-analysis', name: 'Learning Analysis', description: 'Comprehensive analysis of learning patterns, cognitive strengths, and knowledge retention', icon: 'brain', color: '#344E86' },
      { id: 'behavioral-insights', name: 'Behavioral Insights', description: 'Deep dive into emotional regulation, social interaction, motivation, and discipline patterns', icon: 'heart', color: '#4ECDC4' },
      { id: 'performance-prediction', name: 'Performance Prediction', description: 'AI-powered forecast of academic trajectory, risk indicators, and growth opportunities', icon: 'trending-up', color: '#344E86' },
      { id: 'exam-readiness', name: 'Exam Readiness', description: 'Assessment of content mastery, test-taking skills, stress and time management readiness', icon: 'target', color: '#4ECDC4' },
      { id: 'lbi-comprehensive', name: 'LBI Comprehensive', description: 'Full Learning Behavior Index report covering all 19 domains (D01-D19) with detailed insights', icon: 'sparkles', color: '#4ECDC4' },
    ]);
  });

  // ============================================
  // LBI ADMIN ALIAS ROUTES (frontend uses /api/lbi/admin/*)
  // ============================================

  // Helper: bootstrap lbi_modules / lbi_sub_modules / lbi_age_groups from psychometric_* if empty
  app.post("/api/admin/seed-lbi-framework", requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try {
      const domainAbbrToCode: Record<string, string> = {
        ACE: 'D01', TQP: 'D02', ESER: 'D03', CSCC: 'D04', ACC: 'D05',
        SEI: 'D06', DHC: 'D07', CE: 'D08', MVR: 'D09', LPE: 'D10',
        CER: 'D11', IRCM: 'D12', APRI: 'D13', MSR: 'D14', HSSU: 'D15',
        AIM: 'D16', TCA: 'D17', TSIS: 'D18', OCR: 'D19',
      };

      const psyDomains = await db.select().from(psychometricDomains).orderBy(asc(psychometricDomains.displayOrder));
      const psySubdomains = await db.select().from(psychometricSubdomains);
      const psyBands = await db.select().from(psychometricAgeBands).orderBy(asc(psychometricAgeBands.ageRangeStart));

      let modulesCreated = 0, subModulesCreated = 0, ageGroupsCreated = 0;

      // 1) lbi_modules — one row per psychometric_domain
      const psyDomainIdToModuleCode = new Map<string, string>();
      for (const pd of psyDomains) {
        const moduleCode = domainAbbrToCode[pd.domainCode] || pd.domainCode;
        psyDomainIdToModuleCode.set(pd.id, moduleCode);
        const existing = await db.select().from(lbiModules).where(eq(lbiModules.moduleCode, moduleCode)).limit(1);
        if (existing.length === 0) {
          await db.insert(lbiModules).values({
            moduleCode,
            moduleName: pd.domainName,
            description: pd.description || null,
            displayOrder: pd.displayOrder ?? 0,
            status: pd.isActive ? 'Active' : 'Inactive',
          });
          modulesCreated++;
        }
      }

      // 2) lbi_sub_modules — one row per psychometric_subdomain (codes like ACE_SD01)
      const newModules = await db.select().from(lbiModules);
      const moduleCodeToId = new Map(newModules.map(m => [m.moduleCode, m.id]));
      const subModuleCodesByModule = new Map<string, number>();
      for (const sd of psySubdomains.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))) {
        const psyDomain = psyDomains.find(d => d.id === sd.domainId);
        if (!psyDomain) continue;
        const moduleCode = domainAbbrToCode[psyDomain.domainCode] || psyDomain.domainCode;
        const moduleId = moduleCodeToId.get(moduleCode);
        if (!moduleId) continue;
        // canonical code: ACE_SD01, ACE_SD02 ...
        const ord = (subModuleCodesByModule.get(moduleCode) || 0) + 1;
        subModuleCodesByModule.set(moduleCode, ord);
        const subModuleCode = `${psyDomain.domainCode}_SD${String(ord).padStart(2, '0')}`;
        const existing = await db.select().from(lbiSubModules).where(eq(lbiSubModules.subModuleCode, subModuleCode)).limit(1);
        if (existing.length === 0) {
          await db.insert(lbiSubModules).values({
            moduleId,
            subModuleCode,
            subModuleName: sd.subdomainName,
            questionType: 'likert',
            description: sd.description || null,
            displayOrder: ord,
            status: sd.isActive ? 'Active' : 'Inactive',
          });
          subModulesCreated++;
        }
      }

      // 3) lbi_age_groups — derived from psychometric_age_bands
      for (const b of psyBands) {
        const existing = await db.select().from(lbiAgeGroups).where(eq(lbiAgeGroups.groupCode, b.bandCode)).limit(1);
        if (existing.length === 0) {
          await db.insert(lbiAgeGroups).values({
            groupCode: b.bandCode,
            groupName: b.bandName,
            minAge: b.ageRangeStart ?? 0,
            maxAge: b.ageRangeEnd ?? 99,
            difficultyLevel: psyBands.indexOf(b) + 1,
            status: b.isActive ? 'Active' : 'Inactive',
          });
          ageGroupsCreated++;
        }
      }

      res.json({
        success: true,
        modulesCreated,
        subModulesCreated,
        ageGroupsCreated,
        totals: {
          modules: (await db.select().from(lbiModules)).length,
          subModules: (await db.select().from(lbiSubModules)).length,
          ageGroups: (await db.select().from(lbiAgeGroups)).length,
        },
      });
    } catch (err) { next(err); }
  });

  // GET /api/lbi/admin/modules — list with isActive boolean
  app.get("/api/lbi/admin/modules", requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try {
      const rows = await db.select().from(lbiModules).orderBy(asc(lbiModules.displayOrder));
      res.json(rows.map(m => ({ ...m, isActive: m.status === 'Active' })));
    } catch (err) { next(err); }
  });

  // PATCH /api/lbi/admin/modules/:id — toggle/update isActive
  app.patch("/api/lbi/admin/modules/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { id } = req.params;
      const { isActive, moduleName, description } = req.body || {};
      const update: any = {};
      if (typeof isActive === 'boolean') update.status = isActive ? 'Active' : 'Inactive';
      if (typeof moduleName === 'string') update.moduleName = moduleName;
      if (typeof description === 'string') update.description = description;
      if (Object.keys(update).length === 0) return res.status(400).json({ message: 'No fields to update' });
      await db.update(lbiModules).set(update).where(eq(lbiModules.id, id));
      const [row] = await db.select().from(lbiModules).where(eq(lbiModules.id, id)).limit(1);
      res.json({ ...row, isActive: row?.status === 'Active' });
    } catch (err) { next(err); }
  });

  // GET /api/lbi/admin/subdomains?domain_code=XXX — list sub-modules, optional filter by parent module code
  app.get("/api/lbi/admin/subdomains", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { domain_code } = req.query;
      let mods = await db.select().from(lbiModules);
      if (domain_code && typeof domain_code === 'string') {
        mods = mods.filter(m => m.moduleCode === domain_code);
      }
      const moduleIds = mods.map(m => m.id);
      const moduleIdToCode = new Map(mods.map(m => [m.id, m.moduleCode]));
      const subs = (await db.select().from(lbiSubModules)).filter(s => moduleIds.includes(s.moduleId));
      res.json(subs.map(s => ({
        id: s.id,
        subdomain_code: s.subModuleCode,
        subdomain_name: s.subModuleName,
        domain_code: moduleIdToCode.get(s.moduleId) || '',
        description: s.description,
        display_order: s.displayOrder,
        is_active: s.status === 'Active',
      })));
    } catch (err) { next(err); }
  });

  // GET /api/lbi/admin/stats — dashboard counts
  app.get("/api/lbi/admin/stats", requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try {
      const [mods, subs, qs, bands] = await Promise.all([
        db.select().from(lbiModules),
        db.select().from(lbiSubModules),
        db.select().from(lbiQuestionBank),
        db.select().from(lbiAgeGroups),
      ]);
      res.json({
        domains: { total: mods.length, active: mods.filter(m => m.status === 'Active').length },
        subdomains: { total: subs.length, active: subs.filter(s => s.status === 'Active').length },
        questions: { total: qs.length, active: qs.filter(q => q.status === 'Active').length },
        ageBands: { total: bands.length, active: bands.filter(b => b.status === 'Active').length },
      });
    } catch (err) { next(err); }
  });

  // GET /api/lbi/admin/custom-modules — list custom assessment modules (e.g. SDI framework)
  app.get("/api/lbi/admin/custom-modules", requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try {
      const r = await concernsPool.query(
        `SELECT id, module_code, module_name, description, framework, icon_key, color,
                category, subcategory, total_questions, package_ids, status, is_active,
                display_order, created_at, updated_at
         FROM custom_assessment_modules
         ORDER BY display_order ASC, id ASC`
      );
      res.json(r.rows);
    } catch (err) {
      // Table may not exist yet → return empty array (graceful)
      if ((err as any)?.code === '42P01') return res.json([]);
      next(err);
    }
  });

  // POST /api/lbi/admin/custom-modules — create a custom assessment module
  app.post("/api/lbi/admin/custom-modules", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { module_code, module_name, description, framework, icon_key, color, category, subcategory,
              total_questions, package_ids, status, is_active, display_order, domain_codes,
              subdomain_codes, age_band_codes, min_age, max_age, duration_minutes, difficulty, tags } = req.body;
      if (!module_name) return res.status(400).json({ message: 'module_name is required' });
      const code = module_code || `MOD_${Date.now()}`;
      const r = await concernsPool.query(
        `INSERT INTO custom_assessment_modules
          (module_code, module_name, description, framework, icon_key, color, category, subcategory,
           total_questions, package_ids, status, is_active, display_order, domain_codes,
           subdomain_codes, age_band_codes, min_age, max_age, duration_minutes, difficulty, tags)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         RETURNING *`,
        [code, module_name, description || null, framework || 'lbi', icon_key || null, color || null,
         category || null, subcategory || null, total_questions || 0,
         JSON.stringify(package_ids || []), status || 'draft', is_active !== false,
         display_order || 0, JSON.stringify(domain_codes || []), JSON.stringify(subdomain_codes || []),
         JSON.stringify(age_band_codes || []), min_age || null, max_age || null,
         duration_minutes || 30, difficulty || 'medium', JSON.stringify(tags || [])]
      );
      res.status(201).json(r.rows[0]);
    } catch (err: any) {
      if (err?.code === '23505') return res.status(409).json({ message: 'Module code already exists' });
      next(err);
    }
  });

  // PATCH /api/lbi/admin/custom-modules/:id — update a custom assessment module
  app.patch("/api/lbi/admin/custom-modules/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { id } = req.params;
      const fields: string[] = [];
      const vals: any[] = [];
      let i = 1;
      const allowed = ['module_name','description','framework','icon_key','color','category','subcategory',
                       'total_questions','package_ids','status','is_active','display_order','domain_codes',
                       'subdomain_codes','age_band_codes','min_age','max_age','duration_minutes','difficulty','tags'];
      for (const key of allowed) {
        if (key in req.body) {
          const val = req.body[key];
          fields.push(`${key} = $${i++}`);
          vals.push(Array.isArray(val) || (typeof val === 'object' && val !== null) ? JSON.stringify(val) : val);
        }
      }
      if (fields.length === 0) return res.status(400).json({ message: 'No fields to update' });
      fields.push(`updated_at = NOW()`);
      vals.push(id);
      const r = await concernsPool.query(
        `UPDATE custom_assessment_modules SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, vals
      );
      if (r.rows.length === 0) return res.status(404).json({ message: 'Module not found' });
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });

  // DELETE /api/lbi/admin/custom-modules/:id — delete a custom assessment module
  app.delete("/api/lbi/admin/custom-modules/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const r = await concernsPool.query(
        `DELETE FROM custom_assessment_modules WHERE id = $1 RETURNING id`, [req.params.id]
      );
      if (r.rows.length === 0) return res.status(404).json({ message: 'Module not found' });
      res.json({ message: 'Module deleted', id: req.params.id });
    } catch (err) { next(err); }
  });

  // GET /api/lbi/admin/questions-all — paginated items with filters (queries lbi_questions)
  app.get("/api/lbi/admin/questions-all", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || '1')) || 1);
      const limit = Math.min(200, Math.max(10, parseInt(String(req.query.limit || '50')) || 50));
      const search = String(req.query.search || '').trim();
      const domain = String(req.query.domain || 'all');
      const subdomain = String(req.query.subdomain || 'all');
      const ageBand = String(req.query.ageBand || 'all');
      const difficulty = String(req.query.difficulty || 'all');
      const statusFilter = String(req.query.status || 'all');
      const qType = String(req.query.type || 'all');

      const conds: ReturnType<typeof sql>[] = [sql`1=1`];
      if (search)             conds.push(sql`(LOWER(q.question_code) LIKE ${`%${search.toLowerCase()}%`} OR LOWER(q.question_text) LIKE ${`%${search.toLowerCase()}%`})`);
      if (domain !== 'all')   conds.push(sql`d.domain_code = ${domain}`);
      if (subdomain !== 'all') conds.push(sql`s.subdomain_code = ${subdomain}`);
      if (ageBand !== 'all')  conds.push(sql`b.band_code = ${ageBand}`);
      if (difficulty !== 'all') conds.push(sql`q.difficulty = ${difficulty}`);
      if (statusFilter !== 'all') conds.push(sql`q.status = ${statusFilter}`);
      if (qType !== 'all')    conds.push(sql`q.question_type = ${qType}`);

      const where = sql.join(conds, sql` AND `);
      const offset = (page - 1) * limit;

      const countResult = await db.execute(sql`
        SELECT COUNT(*) AS total
        FROM lbi_questions q
        JOIN lbi_domains d ON d.id = q.domain_id
        JOIN lbi_subdomains s ON s.id = q.subdomain_id
        JOIN lbi_age_bands b ON b.id = q.age_band_id
        WHERE ${where}
      `);
      const total = parseInt(String((countResult.rows[0] as any)?.total || 0));
      const totalPages = Math.max(1, Math.ceil(total / limit));

      const dataResult = await db.execute(sql`
        SELECT q.id,
               q.question_code   AS "questionCode",
               q.question_text   AS "questionText",
               q.question_type   AS "questionType",
               q.difficulty,
               q.status,
               q.set_number      AS "setNumber",
               q.display_order   AS "displayOrder",
               q.reverse_scored  AS "reverseScored",
               d.domain_code     AS "domainCode",
               d.domain_name     AS "domainName",
               s.subdomain_code  AS "subdomainCode",
               s.subdomain_name  AS "subdomainName",
               b.band_code       AS "ageBandCode",
               b.band_name       AS "ageBandLabel"
        FROM lbi_questions q
        JOIN lbi_domains d ON d.id = q.domain_id
        JOIN lbi_subdomains s ON s.id = q.subdomain_id
        JOIN lbi_age_bands b ON b.id = q.age_band_id
        WHERE ${where}
        ORDER BY d.display_order, s.display_order, q.display_order
        LIMIT ${limit} OFFSET ${offset}
      `);

      res.json({ questions: dataResult.rows, total, page, totalPages, limit });
    } catch (err) { next(err); }
  });

  // GET /api/lbi/admin/questions/template → forward to existing template route
  app.get("/api/lbi/admin/questions/template", requireAuth, requireSuperAdmin, (req, res, next) => {
    req.url = "/api/admin/lbi-questions/template";
    const router = (app as any).router || (app as any)._router;
    if (router?.handle) router.handle(req, res, next); else next();
  });

  // POST /api/lbi/admin/questions/import → forward to existing upload route
  app.post("/api/lbi/admin/questions/import", requireAuth, requireSuperAdmin, (req, res, next) => {
    req.url = "/api/admin/lbi-questions/upload";
    const router = (app as any).router || (app as any)._router;
    if (router?.handle) router.handle(req, res, next); else next();
  });

  // ─────────────────────────────────────────────────────────────────────
  // LBI SCORING RULES
  // ─────────────────────────────────────────────────────────────────────

  // GET /api/lbi/admin/scoring-rules — all subdomain scoring rules
  app.get("/api/lbi/admin/scoring-rules", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const rows = await db.execute(sql`
        SELECT
          sr.id,
          sr.rule_code,
          sr.rule_name,
          sr.calculation_type,
          sr.norm_type,
          sr.min_score,
          sr.max_score,
          sr.cutoffs,
          sr.status,
          sd.subdomain_code,
          sd.subdomain_name,
          d.domain_code,
          d.domain_name,
          rm.report_type_code,
          rm.is_anchor_subdomain
        FROM lbi_scoring_rules sr
        JOIN lbi_subdomains sd ON sd.id = sr.subdomain_id
        JOIN lbi_domains d ON d.id = sd.domain_id
        LEFT JOIN lbi_subdomain_report_map rm ON rm.subdomain_code = sd.subdomain_code
        ORDER BY sd.subdomain_code
      `);
      res.json(rows.rows);
    } catch (err) { next(err); }
  });

  // ─────────────────────────────────────────────────────────────────────
  // LBI REPORT TYPES
  // ─────────────────────────────────────────────────────────────────────

  // GET /api/lbi/admin/report-types — list all 4 report types with subdomain counts
  app.get("/api/lbi/admin/report-types", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const types = await db.execute(sql`
        SELECT
          rt.id,
          rt.type_code,
          rt.type_name,
          rt.description,
          rt.color,
          rt.icon,
          rt.display_order,
          COUNT(rm.subdomain_code)::int AS subdomain_count,
          SUM(CASE WHEN rm.is_anchor_subdomain THEN 1 ELSE 0 END)::int AS anchor_subdomain_count
        FROM lbi_report_types rt
        LEFT JOIN lbi_subdomain_report_map rm ON rm.report_type_code = rt.type_code
        GROUP BY rt.id, rt.type_code, rt.type_name, rt.description, rt.color, rt.icon, rt.display_order
        ORDER BY rt.display_order
      `);
      res.json(types.rows);
    } catch (err) { next(err); }
  });

  // GET /api/lbi/admin/report-types/:code/subdomains — subdomains for one report type
  app.get("/api/lbi/admin/report-types/:code/subdomains", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const code = req.params.code.toUpperCase();
      const rows = await db.execute(sql`
        SELECT
          rm.subdomain_code,
          rm.is_anchor_subdomain,
          rm.weight,
          sd.subdomain_name,
          d.domain_code,
          d.domain_name,
          COUNT(q.id)::int AS question_count,
          SUM(CASE WHEN q.is_anchor_item THEN 1 ELSE 0 END)::int AS anchor_item_count
        FROM lbi_subdomain_report_map rm
        JOIN lbi_subdomains sd ON sd.subdomain_code = rm.subdomain_code
        JOIN lbi_domains d ON d.id = sd.domain_id
        LEFT JOIN lbi_questions q ON q.subdomain_id = sd.id AND q.status = 'active'
        WHERE rm.report_type_code = ${code}
        GROUP BY rm.subdomain_code, rm.is_anchor_subdomain, rm.weight, sd.subdomain_name, d.domain_code, d.domain_name
        ORDER BY d.domain_code, rm.subdomain_code
      `);
      res.json(rows.rows);
    } catch (err) { next(err); }
  });

  // GET /api/lbi/admin/anchor-items — anchor questions grouped by report type
  app.get("/api/lbi/admin/anchor-items", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const reportType = req.query.report_type as string | undefined;
      const rows = await db.execute(sql`
        SELECT
          q.id,
          q.question_code,
          q.question_text,
          q.anchor_report_type,
          q.reverse_scored,
          q.difficulty,
          q.status,
          sd.subdomain_code,
          sd.subdomain_name,
          d.domain_code,
          d.domain_name,
          ab.band_name AS age_band
        FROM lbi_questions q
        JOIN lbi_subdomains sd ON sd.id = q.subdomain_id
        JOIN lbi_domains d ON d.id = sd.domain_id
        LEFT JOIN lbi_age_bands ab ON ab.id = q.age_band_id
        WHERE q.is_anchor_item = true
          AND (${reportType ? sql`q.anchor_report_type = ${reportType}` : sql`TRUE`})
        ORDER BY q.anchor_report_type, sd.subdomain_code, q.question_code
      `);
      res.json(rows.rows);
    } catch (err) { next(err); }
  });

  // GET /api/lbi/admin/cluster-correlations — subdomain correlation data per cluster
  app.get("/api/lbi/admin/cluster-correlations", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const rows = await db.execute(sql`
        SELECT
          c.code AS cluster_code,
          c.name AS cluster_name,
          c.description AS cluster_description,
          cm.subdomain_code,
          sd.subdomain_name,
          d.domain_code,
          d.domain_name,
          rm.report_type_code,
          rm.is_anchor_subdomain,
          COALESCE(abw.weight, 1.0) AS weight,
          COALESCE(abw.weight_type, 'standard') AS weight_type
        FROM lbi_clusters c
        JOIN lbi_cluster_map cm ON cm.cluster_id = c.id
        JOIN lbi_subdomains sd ON sd.subdomain_code = cm.subdomain_code
        JOIN lbi_domains d ON d.id = sd.domain_id
        LEFT JOIN lbi_subdomain_report_map rm ON rm.subdomain_code = cm.subdomain_code
        LEFT JOIN lbi_age_band_weights abw ON abw.subdomain_code = cm.subdomain_code
        WHERE c.is_active = true
        ORDER BY c.code, cm.subdomain_code
      `);

      const byCluster: Record<string, any> = {};
      for (const row of rows.rows as any[]) {
        if (!byCluster[row.cluster_code]) {
          byCluster[row.cluster_code] = {
            cluster_code: row.cluster_code,
            cluster_name: row.cluster_name,
            cluster_description: row.cluster_description,
            subdomains: [],
          };
        }
        byCluster[row.cluster_code].subdomains.push({
          subdomain_code: row.subdomain_code,
          subdomain_name: row.subdomain_name,
          domain_code: row.domain_code,
          domain_name: row.domain_name,
          report_type_code: row.report_type_code,
          is_anchor: row.is_anchor_subdomain,
          weight: row.weight,
          weight_type: row.weight_type,
        });
      }
      res.json(Object.values(byCluster));
    } catch (err) { next(err); }
  });

  // ============================================
  // PROFESSIONAL COMPETENCY FRAMEWORK
  // ============================================

  // GET /api/competency/domains — list with optional include=subdomains
  app.get("/api/competency/domains", async (req, res, next) => {
    try {
      const include = String(req.query.include || '');
      // Gate on GLOBAL legacy-table emptiness so once competency_domains is seeded
      // this stays byte-identical to legacy (the filtered result is never the gate).
      const legacyCount = await db.execute(sql`SELECT count(*)::int AS n FROM competency_domains`);
      const useLegacy = ((legacyCount.rows[0] as any).n) > 0;
      if (include.includes('subdomains')) {
        if (useLegacy) {
          const result = await db.execute(sql`
            SELECT d.id, d.code, d.name, d.description, d.color, d.weight, d.display_order, d.is_active,
              COALESCE(json_agg(
                json_build_object(
                  'id', c.id, 'code', c.code, 'name', c.name, 'description', c.description,
                  'competency_type', c.competency_type, 'proficiency_levels', c.proficiency_levels,
                  'is_active', c.is_active, 'display_order', c.display_order
                ) ORDER BY c.display_order
              ) FILTER (WHERE c.id IS NOT NULL), '[]') AS subdomains
            FROM competency_domains d
            LEFT JOIN competencies c ON c.domain_id = d.id AND c.is_active = true
            WHERE d.is_active = true
            GROUP BY d.id
            ORDER BY d.display_order
          `);
          return res.json(result.rows);
        }
        // Convergence fallback: legacy competency_* is globally empty → read the canonical
        // onto_* genome mapped to the legacy shape. Additive & reversible: once the
        // legacy tables are seeded this branch never runs (byte-identical to before).
        const onto = await db.execute(sql`
          SELECT d.id, d.id AS code, d.name, d.description, NULL::text AS color, 1 AS weight,
            d.display_order, (NOT d.deprecated) AS is_active,
            COALESCE(json_agg(
              json_build_object(
                'id', c.id, 'code', c.slug, 'name', c.canonical_name, 'description', c.definition,
                'competency_type', c.scientific_type, 'proficiency_levels', '{}'::jsonb,
                'is_active', (NOT c.deprecated), 'display_order', c.complexity_level
              ) ORDER BY c.canonical_name
            ) FILTER (WHERE c.id IS NOT NULL), '[]') AS subdomains
          FROM onto_domains d
          LEFT JOIN onto_competencies c ON c.domain_id = d.id AND NOT c.deprecated
          WHERE NOT d.deprecated
          GROUP BY d.id
          ORDER BY d.display_order
        `);
        return res.json(onto.rows);
      }
      if (useLegacy) {
        const result = await db.execute(sql`SELECT * FROM competency_domains WHERE is_active=true ORDER BY display_order`);
        return res.json(result.rows);
      }
      // Convergence fallback (see note above): legacy competency_domains globally empty.
      const onto = await db.execute(sql`
        SELECT id, id AS code, name, description, NULL::text AS color, 1 AS weight,
          display_order, (NOT deprecated) AS is_active
        FROM onto_domains WHERE NOT deprecated ORDER BY display_order
      `);
      res.json(onto.rows);
    } catch (err) { next(err); }
  });

  // POST /api/competency/domains — create (super admin)
  app.post("/api/competency/domains", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { code, name, description, color, weight, display_order } = req.body || {};
      if (!code || !name) return res.status(400).json({ message: 'code and name are required' });
      const r = await db.execute(sql`
        INSERT INTO competency_domains (code, name, description, color, weight, display_order)
        VALUES (${code}, ${name}, ${description || null}, ${color || null}, ${weight ?? 1}, ${display_order ?? 0})
        RETURNING *
      `);
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });

  app.patch("/api/competency/domains/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { name, description, color, weight, display_order, is_active } = req.body || {};
      await db.execute(sql`
        UPDATE competency_domains SET
          name = COALESCE(${name ?? null}, name),
          description = COALESCE(${description ?? null}, description),
          color = COALESCE(${color ?? null}, color),
          weight = COALESCE(${weight ?? null}, weight),
          display_order = COALESCE(${display_order ?? null}, display_order),
          is_active = COALESCE(${is_active ?? null}, is_active),
          updated_at = now()
        WHERE id = ${req.params.id}
      `);
      const r = await db.execute(sql`SELECT * FROM competency_domains WHERE id = ${req.params.id}`);
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });

  app.delete("/api/competency/domains/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      await db.execute(sql`DELETE FROM competency_domains WHERE id = ${req.params.id}`);
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  // ---- Competencies ----
  app.get("/api/competency/competencies", async (req, res, next) => {
    try {
      const domainId = req.query.domain_id ? String(req.query.domain_id) : null;
      // Gate on GLOBAL legacy-table emptiness (not the filtered result).
      const legacyCount = await db.execute(sql`SELECT count(*)::int AS n FROM competencies`);
      if (((legacyCount.rows[0] as any).n) > 0) {
        const r = domainId
          ? await db.execute(sql`SELECT * FROM competencies WHERE domain_id = ${domainId} ORDER BY display_order`)
          : await db.execute(sql`SELECT * FROM competencies ORDER BY display_order`);
        return res.json(r.rows);
      }
      // Convergence fallback: legacy `competencies` globally empty → canonical onto_competencies
      // mapped to legacy shape. Additive & reversible (no-op once legacy is seeded).
      const onto = domainId
        ? await db.execute(sql`
            SELECT id, domain_id, slug AS code, canonical_name AS name, definition AS description,
              scientific_type AS competency_type, '{}'::jsonb AS proficiency_levels,
              complexity_level AS display_order, (NOT deprecated) AS is_active
            FROM onto_competencies WHERE NOT deprecated AND domain_id = ${domainId} ORDER BY canonical_name`)
        : await db.execute(sql`
            SELECT id, domain_id, slug AS code, canonical_name AS name, definition AS description,
              scientific_type AS competency_type, '{}'::jsonb AS proficiency_levels,
              complexity_level AS display_order, (NOT deprecated) AS is_active
            FROM onto_competencies WHERE NOT deprecated ORDER BY canonical_name`);
      res.json(onto.rows);
    } catch (err) { next(err); }
  });

  app.post("/api/competency/competencies", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { domain_id, code, name, description, competency_type, proficiency_levels, display_order } = req.body || {};
      if (!domain_id || !code || !name) return res.status(400).json({ message: 'domain_id, code and name are required' });
      const levels = proficiency_levels || {
        '1': 'Basic awareness', '2': 'Guided execution', '3': 'Independent execution',
        '4': 'Advanced application', '5': 'Strategic mastery',
      };
      const r = await db.execute(sql`
        INSERT INTO competencies (domain_id, code, name, description, competency_type, proficiency_levels, display_order)
        VALUES (${domain_id}, ${code}, ${name}, ${description || null}, ${competency_type || 'behavioral'},
                ${JSON.stringify(levels)}::jsonb, ${display_order ?? 0})
        RETURNING *
      `);
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });

  app.patch("/api/competency/competencies/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { name, description, competency_type, proficiency_levels, is_active, display_order, domain_id } = req.body || {};
      await db.execute(sql`
        UPDATE competencies SET
          name = COALESCE(${name ?? null}, name),
          description = COALESCE(${description ?? null}, description),
          competency_type = COALESCE(${competency_type ?? null}, competency_type),
          proficiency_levels = COALESCE(${proficiency_levels ? JSON.stringify(proficiency_levels) : null}::jsonb, proficiency_levels),
          is_active = COALESCE(${is_active ?? null}, is_active),
          display_order = COALESCE(${display_order ?? null}, display_order),
          domain_id = COALESCE(${domain_id ?? null}, domain_id),
          updated_at = now()
        WHERE id = ${req.params.id}
      `);
      const r = await db.execute(sql`SELECT * FROM competencies WHERE id = ${req.params.id}`);
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });

  app.delete("/api/competency/competencies/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      await db.execute(sql`DELETE FROM competencies WHERE id = ${req.params.id}`);
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  // ---- Clusters ----
  app.get("/api/competency/clusters", async (_req, res, next) => {
    try {
      const r = await db.execute(sql`
        SELECT cl.*,
          COALESCE(json_agg(json_build_object('id', c.id, 'code', c.code, 'name', c.name))
            FILTER (WHERE c.id IS NOT NULL), '[]') AS competencies
        FROM competency_clusters cl
        LEFT JOIN competency_cluster_map m ON m.cluster_id = cl.id
        LEFT JOIN competencies c ON c.id = m.competency_id
        WHERE cl.is_active = true
        GROUP BY cl.id
        ORDER BY cl.name
      `);
      res.json(r.rows);
    } catch (err) { next(err); }
  });

  app.post("/api/competency/clusters", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { code, name, description, competency_ids } = req.body || {};
      if (!code || !name) return res.status(400).json({ message: 'code and name are required' });
      const r = await db.execute(sql`
        INSERT INTO competency_clusters (code, name, description) VALUES (${code}, ${name}, ${description || null}) RETURNING *
      `);
      const cluster = r.rows[0] as any;
      if (Array.isArray(competency_ids) && competency_ids.length) {
        for (const cid of competency_ids) {
          await db.execute(sql`INSERT INTO competency_cluster_map (cluster_id, competency_id) VALUES (${cluster.id}, ${cid}) ON CONFLICT DO NOTHING`);
        }
      }
      res.json(cluster);
    } catch (err) { next(err); }
  });

  app.patch("/api/competency/clusters/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { name, description, competency_ids } = req.body || {};
      // Update meta
      if (name !== undefined || description !== undefined) {
        await db.execute(sql`
          UPDATE competency_clusters
          SET name = COALESCE(${name ?? null}, name),
              description = COALESCE(${description ?? null}, description)
          WHERE id = ${req.params.id}
        `);
      }
      // Replace mapping if competency_ids supplied
      if (Array.isArray(competency_ids)) {
        await db.execute(sql`DELETE FROM competency_cluster_map WHERE cluster_id = ${req.params.id}`);
        for (const cid of competency_ids) {
          await db.execute(sql`INSERT INTO competency_cluster_map (cluster_id, competency_id) VALUES (${req.params.id}, ${cid}) ON CONFLICT DO NOTHING`);
        }
      }
      const r = await db.execute(sql`SELECT * FROM competency_clusters WHERE id = ${req.params.id}`);
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });

  app.delete("/api/competency/clusters/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const r = await db.execute(sql`DELETE FROM competency_clusters WHERE id = ${req.params.id}`);
      res.json({ ok: true, removed: (r as any).rowCount ?? 0 });
    } catch (err) { next(err); }
  });

  // Competency cluster → competency mapping (mirrors LBI/SDI /:id/subdomains pattern)
  app.get("/api/competency/clusters/:id/subdomains", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const r = await db.execute(sql`
        SELECT c.code FROM competency_cluster_map m
        JOIN competencies c ON c.id = m.competency_id
        WHERE m.cluster_id = ${req.params.id}
      `);
      res.json((r.rows as any[]).map(row => row.code));
    } catch (err) { next(err); }
  });

  app.post("/api/competency/clusters/:id/subdomains", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const codes: string[] = Array.isArray(req.body?.subdomain_codes) ? req.body.subdomain_codes : [];
      await db.execute(sql`DELETE FROM competency_cluster_map WHERE cluster_id = ${req.params.id}`);
      for (const code of codes) {
        await db.execute(sql`
          INSERT INTO competency_cluster_map (cluster_id, competency_id)
          SELECT ${req.params.id}, id FROM competencies WHERE code = ${code}
          ON CONFLICT DO NOTHING
        `);
      }
      res.json({ ok: true, mapped: codes.length });
    } catch (err) { next(err); }
  });

  // ---- Stage Norms ----
  app.get("/api/competency/stage-norms", async (req, res, next) => {
    try {
      const stage = req.query.stage_code ? String(req.query.stage_code) : null;
      const r = stage
        ? await db.execute(sql`SELECT n.*, c.code AS competency_code, c.name AS competency_name FROM stage_competency_norms n JOIN competencies c ON c.id = n.competency_id WHERE n.stage_code = ${stage} ORDER BY c.display_order`)
        : await db.execute(sql`SELECT n.*, c.code AS competency_code, c.name AS competency_name FROM stage_competency_norms n JOIN competencies c ON c.id = n.competency_id ORDER BY n.stage_code, c.display_order`);
      res.json(r.rows);
    } catch (err) { next(err); }
  });

  app.patch("/api/competency/stage-norms/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { min_score, median_score, top10_score } = req.body || {};
      await db.execute(sql`
        UPDATE stage_competency_norms SET
          min_score = COALESCE(${min_score ?? null}, min_score),
          median_score = COALESCE(${median_score ?? null}, median_score),
          top10_score = COALESCE(${top10_score ?? null}, top10_score)
        WHERE id = ${req.params.id}
      `);
      const r = await db.execute(sql`SELECT * FROM stage_competency_norms WHERE id = ${req.params.id}`);
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });

  // ---- Scoring Config ----
  app.get("/api/competency/scoring-config", async (_req, res, next) => {
    try {
      const r = await db.execute(sql`SELECT * FROM scoring_configs ORDER BY name`);
      res.json(r.rows);
    } catch (err) { next(err); }
  });

  app.patch("/api/competency/scoring-config/:name", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { value } = req.body || {};
      if (typeof value !== 'number') return res.status(400).json({ message: 'value (number) required' });
      await db.execute(sql`UPDATE scoring_configs SET value = ${value}, updated_at = now() WHERE name = ${req.params.name}`);
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  // ---- Stats for Super Admin overview card ----
  app.get("/api/competency/stats", async (_req, res, next) => {
    try {
      // Convergence: domains/competencies/items counts fall back to the canonical
      // onto_* genome when the legacy competency_* tables are empty (no-op once seeded).
      const r = await db.execute(sql`
        SELECT
          (SELECT CASE WHEN (SELECT count(*) FROM competency_domains)=0
             THEN (SELECT count(*) FROM onto_domains WHERE NOT deprecated)
             ELSE (SELECT count(*) FROM competency_domains WHERE is_active=true) END)::int AS domains,
          (SELECT CASE WHEN (SELECT count(*) FROM competencies)=0
             THEN (SELECT count(*) FROM onto_competencies WHERE NOT deprecated)
             ELSE (SELECT count(*) FROM competencies WHERE is_active=true) END)::int AS competencies,
          (SELECT count(*) FROM competency_clusters WHERE is_active=true)::int AS clusters,
          (SELECT count(*) FROM stage_competency_norms)::int AS stage_norms,
          (SELECT count(*) FROM scoring_configs)::int AS scoring_configs,
          (SELECT CASE WHEN (SELECT count(*) FROM competency_assessment_items)=0
             THEN (SELECT count(*) FROM competency_question_templates)
             ELSE (SELECT count(*) FROM competency_assessment_items WHERE is_active=true) END)::int AS assessment_items,
          (SELECT count(*) FROM role_competency_weights)::int AS role_weights,
          (SELECT count(distinct role_code) FROM role_competency_weights)::int AS roles
      `);
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  });

  // GET /api/competency/learning-recommendations/:competency_id?level=3
  app.get("/api/competency/learning-recommendations/:competencyId", async (req, res, next) => {
    try {
      const level = parseInt(String(req.query.level || '3')) || 3;
      const r = await db.execute(sql`
        SELECT id, level, action_type, title, resource_link
        FROM learning_mappings
        WHERE competency_id = ${req.params.competencyId} AND level <= ${level + 1}
        ORDER BY level
      `);
      res.json(r.rows);
    } catch (err) { next(err); }
  });

  // GET /api/competency/assessment/start?role_code=&limit=&language=
  // Returns a starter set of items for the user to attempt (for now: all items, capped)
  app.get("/api/competency/assessment/start", requireAuth, async (req, res, next) => {
    try {
      const limit = Math.min(50, parseInt(String(req.query.limit || '20')) || 20);
      const language = String(req.query.language || 'en').toLowerCase();
      const r = await db.execute(sql`
        SELECT i.id, i.code, i.competency_id, i.item_type, i.difficulty, i.level, i.question, i.expected_time, i.language_code,
          c.code AS competency_code, c.name AS competency_name,
          d.code AS domain_code, d.name AS domain_name, d.color AS domain_color,
          COALESCE(json_agg(json_build_object('id', o.id, 'text', o.text) ORDER BY o.display_order)
            FILTER (WHERE o.id IS NOT NULL), '[]') AS options
        FROM competency_assessment_items i
        JOIN competencies c ON c.id = i.competency_id
        JOIN competency_domains d ON d.id = c.domain_id
        LEFT JOIN competency_assessment_options o ON o.item_id = i.id
        WHERE i.is_active = true AND i.language_code = ${language}
        GROUP BY i.id, c.code, c.name, d.code, d.name, d.color
        ORDER BY random()
        LIMIT ${limit}
      `);
      res.json({ items: r.rows, language });
    } catch (err) { next(err); }
  });

  // POST /api/competency/assessment/submit  body: { user_id, responses: [{ item_id, option_id, time_taken? }] }
  app.post("/api/competency/assessment/submit", requireAuth, async (req, res, next) => {
    try {
      const { user_id, responses } = req.body || {};
      if (!user_id || !Array.isArray(responses)) return res.status(400).json({ message: 'user_id and responses[] required' });
      let saved = 0;
      for (const resp of responses) {
        if (!resp.item_id || !resp.option_id) continue;
        // Lookup score from option
        const opt = await db.execute(sql`SELECT score_value FROM competency_assessment_options WHERE id = ${resp.option_id} LIMIT 1`);
        const score = (opt.rows[0] as any)?.score_value ?? 0;
        await db.execute(sql`
          INSERT INTO competency_user_responses (user_id, item_id, option_id, score_obtained, time_taken)
          VALUES (${user_id}, ${resp.item_id}, ${resp.option_id}, ${score}, ${resp.time_taken || null})
        `);
        saved++;
      }
      res.json({ success: true, saved });
    } catch (err) { next(err); }
  });

  // GET /api/competency/idp/:userId — top-5 gaps with learning recommendations
  app.get("/api/competency/idp/:userId", requireAuth, async (req, res, next) => {
    try {
      const stage = String(req.query.stage_code || 'EXEC');
      const role = req.query.role_code ? String(req.query.role_code) : null;
      // Pull score breakdown by reusing logic
      const breakdown = await db.execute(sql`
        WITH per_comp AS (
          SELECT c.id, c.code, c.name, c.domain_id,
            COALESCE(AVG(r.score_obtained), 0) AS raw_score,
            COUNT(r.id) AS attempts
          FROM competencies c
          LEFT JOIN competency_assessment_items i ON i.competency_id = c.id
          LEFT JOIN competency_user_responses r ON r.item_id = i.id AND r.user_id = ${req.params.userId}
          GROUP BY c.id
        ),
        norms AS (
          SELECT competency_id, top10_score FROM stage_competency_norms WHERE stage_code = ${stage}
        ),
        weights AS (
          SELECT competency_id, weight FROM role_competency_weights WHERE role_code = ${role}
        )
        SELECT pc.code, pc.name, pc.id AS competency_id,
          pc.raw_score::real, pc.attempts::int,
          n.top10_score::real,
          GREATEST(0, n.top10_score - pc.raw_score)::real AS gap,
          COALESCE(w.weight, 1) AS weight,
          (GREATEST(0, n.top10_score - pc.raw_score) * COALESCE(w.weight, 1))::real AS priority
        FROM per_comp pc
        LEFT JOIN norms n ON n.competency_id = pc.id
        LEFT JOIN weights w ON w.competency_id = pc.id
        ORDER BY priority DESC NULLS LAST
        LIMIT 10
      `);

      const idp: any[] = [];
      for (const row of breakdown.rows as any[]) {
        const recs = await db.execute(sql`
          SELECT level, action_type, title, resource_link FROM learning_mappings
          WHERE competency_id = ${row.competency_id} ORDER BY level
        `);
        idp.push({ ...row, recommendations: recs.rows });
      }
      res.json({ user_id: req.params.userId, stage_code: stage, role_code: role, top_gaps: idp.slice(0, 5), all_priority: idp });
    } catch (err) { next(err); }
  });

  // ---- CSV: download template for bulk import of competencies ----
  app.get("/api/competency/competencies/template", requireAuth, requireSuperAdmin, (_req, res) => {
    const csv = [
      'domainCode,code,name,description,competencyType,displayOrder',
      'COG,COG_C11,Pattern Recognition,Spotting recurring patterns in data and behavior,cognitive,11',
      'BEH,BEH_C11,Curiosity,Asking questions and exploring beyond the brief,behavioral,11',
      'LEAD,LEAD_C11,Crisis Leadership,Leading effectively in high-pressure situations,leadership,11',
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="competencies_template.csv"');
    res.send(csv);
  });

  // ---- CSV: bulk import competencies ----
  app.post("/api/competency/competencies/import", requireAuth, requireSuperAdmin, upload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
      const content = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
      let rows: any[];
      try { rows = parse(content, { columns: true, skip_empty_lines: true, trim: true, bom: true }); }
      catch { return res.status(400).json({ message: 'Invalid CSV format' }); }

      const domainsRes = await db.execute(sql`SELECT id, code FROM competency_domains`);
      const codeToDomainId = new Map<string, string>();
      for (const d of domainsRes.rows as any[]) codeToDomainId.set(d.code.toUpperCase(), d.id);

      const defaultLevels = {
        '1': 'Basic awareness', '2': 'Guided execution', '3': 'Independent execution',
        '4': 'Advanced application', '5': 'Strategic mastery',
      };

      let created = 0, updated = 0;
      const errors: { row: number; message: string }[] = [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const domainCode = String(r.domainCode || r.domain_code || '').toUpperCase().trim();
        const code = String(r.code || '').trim();
        const name = String(r.name || '').trim();
        if (!domainCode || !code || !name) { errors.push({ row: i + 2, message: 'domainCode, code and name are required' }); continue; }
        const domainId = codeToDomainId.get(domainCode);
        if (!domainId) { errors.push({ row: i + 2, message: `Unknown domain code: ${domainCode}` }); continue; }

        const existing = await db.execute(sql`SELECT id FROM competencies WHERE code = ${code} LIMIT 1`);
        const competency_type = (r.competencyType || r.competency_type || 'behavioral').toString();
        const description = (r.description || '').toString() || null;
        const display_order = parseInt(r.displayOrder || r.display_order || '0') || 0;
        let levels: any = defaultLevels;
        if (r.proficiencyLevels || r.proficiency_levels) {
          try { levels = JSON.parse(r.proficiencyLevels || r.proficiency_levels); } catch { /* keep default */ }
        }
        if ((existing.rows as any[]).length > 0) {
          await db.execute(sql`
            UPDATE competencies SET
              domain_id=${domainId}, name=${name}, description=${description},
              competency_type=${competency_type}, proficiency_levels=${JSON.stringify(levels)}::jsonb,
              display_order=${display_order}, updated_at=now()
            WHERE code=${code}
          `);
          updated++;
        } else {
          await db.execute(sql`
            INSERT INTO competencies (domain_id, code, name, description, competency_type, proficiency_levels, display_order)
            VALUES (${domainId}, ${code}, ${name}, ${description}, ${competency_type}, ${JSON.stringify(levels)}::jsonb, ${display_order})
          `);
          created++;
        }
      }
      res.json({ success: true, created, updated, total: rows.length, errors: errors.slice(0, 50) });
    } catch (err) { next(err); }
  });

  // ============================================
  // ASSESSMENT ITEMS (Competency Items)
  // ============================================
  app.get("/api/competency/items", async (req, res, next) => {
    try {
      const competencyId = req.query.competency_id ? String(req.query.competency_id) : null;
      const language = req.query.language ? String(req.query.language).toLowerCase() : null;
      // Gate on GLOBAL legacy-table emptiness (not the filtered result), so once
      // competency_assessment_items is seeded this stays byte-identical to legacy.
      const legacyCount = await db.execute(sql`SELECT count(*)::int AS n FROM competency_assessment_items`);
      if (((legacyCount.rows[0] as any).n) > 0) {
        const r = competencyId
          ? await db.execute(sql`
              SELECT i.*, COALESCE(json_agg(json_build_object('id', o.id, 'text', o.text, 'score_value', o.score_value, 'display_order', o.display_order) ORDER BY o.display_order) FILTER (WHERE o.id IS NOT NULL), '[]') AS options
              FROM competency_assessment_items i
              LEFT JOIN competency_assessment_options o ON o.item_id = i.id
              WHERE i.competency_id = ${competencyId}
                ${language ? sql`AND i.language_code = ${language}` : sql``}
              GROUP BY i.id
              ORDER BY i.code
            `)
          : await db.execute(sql`
              SELECT i.*, c.code AS competency_code, c.name AS competency_name,
                COALESCE(json_agg(json_build_object('id', o.id, 'text', o.text, 'score_value', o.score_value, 'display_order', o.display_order) ORDER BY o.display_order) FILTER (WHERE o.id IS NOT NULL), '[]') AS options
              FROM competency_assessment_items i
              JOIN competencies c ON c.id = i.competency_id
              LEFT JOIN competency_assessment_options o ON o.item_id = i.id
              ${language ? sql`WHERE i.language_code = ${language}` : sql``}
              GROUP BY i.id, c.code, c.name
              ORDER BY i.code
            `);
        return res.json(r.rows);
      }
      // Convergence fallback: legacy competency_assessment_items globally empty → canonical V1
      // question bank (competency_question_templates) mapped to the legacy item shape.
      // Additive & reversible (no-op once the legacy items table is seeded).
      const onto = competencyId
        ? await db.execute(sql`
            SELECT t.id, t.template_key AS code, t.competency_code AS competency_id,
              t.question_type AS item_type, t.difficulty_band AS difficulty,
              (t.template_body->>'stem') AS question, t.status, t.source,
              COALESCE((SELECT json_agg(json_build_object('text', value, 'display_order', (ord-1)) ORDER BY ord)
                FROM jsonb_array_elements_text(t.template_body->'options') WITH ORDINALITY AS arr(value, ord)), '[]') AS options
            FROM competency_question_templates t
            WHERE t.competency_code = ${competencyId}
            ORDER BY t.template_key`)
        : await db.execute(sql`
            SELECT t.id, t.template_key AS code, t.competency_code AS competency_id,
              t.question_type AS item_type, t.difficulty_band AS difficulty,
              (t.template_body->>'stem') AS question, t.status, t.source,
              COALESCE(c.canonical_name, t.competency_code) AS competency_name, c.slug AS competency_code,
              COALESCE((SELECT json_agg(json_build_object('text', value, 'display_order', (ord-1)) ORDER BY ord)
                FROM jsonb_array_elements_text(t.template_body->'options') WITH ORDINALITY AS arr(value, ord)), '[]') AS options
            FROM competency_question_templates t
            LEFT JOIN onto_competencies c ON c.id = t.competency_code
            ORDER BY t.competency_code, t.template_key`);
      res.json(onto.rows);
    } catch (err) { next(err); }
  });

  app.post("/api/competency/items", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { competency_id, code, item_type, difficulty, level, question, expected_time, scoring_type, industry, role_tag, options } = req.body || {};
      if (!competency_id || !code || !question) return res.status(400).json({ message: 'competency_id, code and question are required' });
      const r = await db.execute(sql`
        INSERT INTO competency_assessment_items (competency_id, code, item_type, difficulty, level, question, expected_time, scoring_type, industry, role_tag)
        VALUES (${competency_id}, ${code}, ${item_type || 'mcq'}, ${difficulty || 3}, ${level || 3}, ${question}, ${expected_time || 60}, ${scoring_type || 'auto'}, ${industry || null}, ${role_tag || null})
        RETURNING *
      `);
      const item = r.rows[0] as any;
      if (Array.isArray(options) && options.length) {
        for (let i = 0; i < options.length; i++) {
          const o = options[i];
          await db.execute(sql`
            INSERT INTO competency_assessment_options (item_id, text, score_value, display_order)
            VALUES (${item.id}, ${o.text}, ${Number(o.score_value || 0)}, ${i})
          `);
        }
      }
      res.json(item);
    } catch (err) { next(err); }
  });

  app.delete("/api/competency/items/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      await db.execute(sql`DELETE FROM competency_assessment_items WHERE id = ${req.params.id}`);
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  // CSV template + import for competency items
  app.get("/api/competency/items/template", requireAuth, requireSuperAdmin, (_req, res) => {
    const csv = [
      'competencyCode,itemCode,itemType,difficulty,level,question,expectedTime,optionA,scoreA,optionB,scoreB,optionC,scoreC,optionD,scoreD',
      '"COG_C02","COG_C02_I01","mcq",3,3,"Faced with a complex problem you don\'t understand, what do you do first?",60,"Ask someone for the answer",20,"Break it down into smaller parts",90,"Skip it and move on",10,"Guess and try anyway",40',
      '"INT_C01","INT_C01_I01","mcq",3,3,"In a team meeting, you disagree with the proposed plan. You:",45,"Stay silent",10,"Voice your concern with reasoning",95,"Argue forcefully until others agree",30,"Wait for someone else to disagree first",25',
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="competency_items_template.csv"');
    res.send(csv);
  });

  app.post("/api/competency/items/import", requireAuth, requireSuperAdmin, upload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
      const content = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
      let rows: any[];
      try { rows = parse(content, { columns: true, skip_empty_lines: true, trim: true, bom: true, relax_column_count: true }); }
      catch { return res.status(400).json({ message: 'Invalid CSV format' }); }

      const compRes = await db.execute(sql`SELECT id, code FROM competencies`);
      const codeToCompetencyId = new Map<string, string>();
      for (const c of compRes.rows as any[]) codeToCompetencyId.set(c.code.toUpperCase(), c.id);

      let created = 0, skipped = 0;
      const errors: { row: number; message: string }[] = [];

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const compCode = String(r.competencyCode || '').toUpperCase().trim();
        const itemCode = String(r.itemCode || '').trim();
        const question = String(r.question || '').trim();
        if (!compCode || !itemCode || !question) { errors.push({ row: i + 2, message: 'competencyCode, itemCode and question are required' }); continue; }
        const compId = codeToCompetencyId.get(compCode);
        if (!compId) { errors.push({ row: i + 2, message: `Unknown competency code: ${compCode}` }); continue; }
        const exists = await db.execute(sql`SELECT id FROM competency_assessment_items WHERE code = ${itemCode} LIMIT 1`);
        if ((exists.rows as any[]).length) { skipped++; continue; }

        const itemRes = await db.execute(sql`
          INSERT INTO competency_assessment_items (competency_id, code, item_type, difficulty, level, question, expected_time)
          VALUES (${compId}, ${itemCode}, ${r.itemType || 'mcq'}, ${parseInt(r.difficulty || '3') || 3},
                  ${parseInt(r.level || '3') || 3}, ${question}, ${parseInt(r.expectedTime || '60') || 60})
          RETURNING id
        `);
        const itemId = (itemRes.rows[0] as any).id;
        const opts = [
          { text: r.optionA, score: r.scoreA }, { text: r.optionB, score: r.scoreB },
          { text: r.optionC, score: r.scoreC }, { text: r.optionD, score: r.scoreD },
          { text: r.optionE, score: r.scoreE },
        ];
        let oIdx = 0;
        for (const o of opts) {
          if (!o.text || !String(o.text).trim()) continue;
          await db.execute(sql`
            INSERT INTO competency_assessment_options (item_id, text, score_value, display_order)
            VALUES (${itemId}, ${String(o.text).trim()}, ${Number(o.score || 0)}, ${oIdx})
          `);
          oIdx++;
        }
        created++;
      }
      res.json({ success: true, created, skipped, total: rows.length, errors: errors.slice(0, 50) });
    } catch (err) { next(err); }
  });

  // ============================================
  // ROLE WEIGHTS
  // ============================================
  app.get("/api/competency/role-weights", async (req, res, next) => {
    try {
      const role = req.query.role_code ? String(req.query.role_code) : null;
      const r = role
        ? await db.execute(sql`
            SELECT w.*, c.code AS competency_code, c.name AS competency_name, d.code AS domain_code
            FROM role_competency_weights w
            JOIN competencies c ON c.id = w.competency_id
            JOIN competency_domains d ON d.id = c.domain_id
            WHERE w.role_code = ${role} ORDER BY d.display_order, c.display_order
          `)
        : await db.execute(sql`
            SELECT role_code, role_name, count(*)::int AS competency_count
            FROM role_competency_weights GROUP BY role_code, role_name ORDER BY role_code
          `);
      res.json(r.rows);
    } catch (err) { next(err); }
  });

  app.post("/api/competency/role-weights", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { role_code, role_name, weights } = req.body || {};
      if (!role_code || !role_name || !Array.isArray(weights)) {
        return res.status(400).json({ message: 'role_code, role_name and weights[] are required' });
      }
      let saved = 0;
      for (const w of weights) {
        await db.execute(sql`
          INSERT INTO role_competency_weights (role_code, role_name, competency_id, weight, weight_type)
          VALUES (${role_code}, ${role_name}, ${w.competency_id}, ${Number(w.weight || 1)}, ${w.weight_type || 'core'})
          ON CONFLICT (role_code, competency_id) DO UPDATE
            SET weight = EXCLUDED.weight, weight_type = EXCLUDED.weight_type, role_name = EXCLUDED.role_name
        `);
        saved++;
      }
      res.json({ success: true, saved });
    } catch (err) { next(err); }
  });

  // ============================================
  // SCORING ENGINE — compute EI / Gap / Benchmark for a user
  // ============================================
  app.get("/api/competency/score/:userId", requireAuth, async (req, res, next) => {
    try {
      const userId = req.params.userId;
      const stageCode = String(req.query.stage_code || 'EXEC');
      const roleCode = req.query.role_code ? String(req.query.role_code) : null;

      // Honest degrade: this legacy scoring path reads competency_* tables, which
      // may not exist (canonical scoring lives in onto_*). Return a zeroed, empty
      // coverage envelope (200) instead of 500 when the response table is absent.
      const respProbe = await db.execute(sql`SELECT to_regclass('public.competency_user_responses') AS t`);
      if ((respProbe.rows as any[])[0]?.t == null) {
        return res.json({
          user_id: userId, stage_code: stageCode, role_code: roleCode,
          employability_index: 0, confidence: 0,
          coverage: { competencies_total: 0, competencies_attempted: 0, total_attempts: 0 },
          explainability: { top_strengths: [], top_gaps: [] },
          breakdown: [],
          note: 'No competency response data available yet.',
        });
      }

      // 1) Per-competency raw score = avg of user responses
      const compScores = await db.execute(sql`
        SELECT c.id, c.code, c.name, c.domain_id,
               AVG(r.score_obtained)::real AS raw_score,
               COUNT(r.id)::int AS attempts
        FROM competencies c
        LEFT JOIN competency_assessment_items i ON i.competency_id = c.id
        LEFT JOIN competency_user_responses r ON r.item_id = i.id AND r.user_id = ${userId}
        GROUP BY c.id
      `);

      // 2) Stage norms
      const norms = await db.execute(sql`
        SELECT competency_id, min_score, median_score, top10_score
        FROM stage_competency_norms WHERE stage_code = ${stageCode}
      `);
      const normMap = new Map<string, any>();
      for (const n of norms.rows as any[]) normMap.set(n.competency_id, n);

      // 3) Role weights (optional)
      const weightMap = new Map<string, { weight: number; weight_type: string }>();
      if (roleCode) {
        const wRes = await db.execute(sql`
          SELECT competency_id, weight, weight_type FROM role_competency_weights WHERE role_code = ${roleCode}
        `);
        for (const w of wRes.rows as any[]) weightMap.set(w.competency_id, { weight: Number(w.weight), weight_type: w.weight_type });
      }

      // 4) Compute normalized + weighted
      let weightedSum = 0, weightTotal = 0;
      const breakdown = (compScores.rows as any[]).map(c => {
        const raw = Number(c.raw_score) || 0;
        const norm = normMap.get(c.id);
        const top10 = norm?.top10_score || 100;
        const median = norm?.median_score || 50;
        const minS = norm?.min_score || 0;
        const normalized = top10 > 0 ? Math.min(1, raw / top10) : 0;
        const w = weightMap.get(c.id)?.weight ?? 1;
        const weighted = normalized * w;
        weightedSum += weighted;
        weightTotal += w;
        const gap = Math.max(0, top10 - raw);
        const priority = gap * w;
        return {
          competency_id: c.id, code: c.code, name: c.name,
          raw_score: Number(raw.toFixed(2)),
          attempts: c.attempts,
          stage_norm: { min: minS, median, top10 },
          normalized: Number(normalized.toFixed(3)),
          weight: w,
          weight_type: weightMap.get(c.id)?.weight_type || null,
          weighted: Number(weighted.toFixed(3)),
          gap: Number(gap.toFixed(2)),
          priority: Number(priority.toFixed(2)),
        };
      });

      // 5) Employability Index = weighted average × 100
      const ei = weightTotal > 0 ? Number(((weightedSum / weightTotal) * 100).toFixed(2)) : 0;

      // 6) Top strengths / gaps for explainability
      const strengths = [...breakdown].sort((a, b) => b.normalized - a.normalized).slice(0, 5).map(b => ({ code: b.code, name: b.name, score: b.raw_score }));
      const topGaps   = [...breakdown].sort((a, b) => b.priority - a.priority).slice(0, 5).map(b => ({ code: b.code, name: b.name, gap: b.gap, priority: b.priority }));

      // 7) Confidence — based on attempts (more attempts = more confidence, capped at 1.0)
      const totalAttempts = (compScores.rows as any[]).reduce((s, c) => s + (c.attempts || 0), 0);
      const competenciesAttempted = (compScores.rows as any[]).filter(c => c.attempts > 0).length;
      const confidence = Math.min(1, (totalAttempts / Math.max(1, breakdown.length * 3)));

      res.json({
        user_id: userId,
        stage_code: stageCode,
        role_code: roleCode,
        employability_index: ei,
        confidence: Number(confidence.toFixed(2)),
        coverage: {
          competencies_total: breakdown.length,
          competencies_attempted: competenciesAttempted,
          total_attempts: totalAttempts,
        },
        explainability: {
          top_strengths: strengths,
          top_gaps: topGaps,
        },
        breakdown,
      });
    } catch (err) { next(err); }
  });

  // ============================================
  // STUDENT — percentile rank vs cohort (social proof badge)
  // ============================================
  app.get("/api/competency/score/:userId/percentile", requireAuth, async (req, res, next) => {
    try {
      const userId = req.params.userId;
      const stage = String(req.query.stage_code || 'EXEC');
      const role = req.query.role_code ? String(req.query.role_code) : null;

      // Honest degrade when the legacy competency_user_responses table is absent.
      const respProbe = await db.execute(sql`SELECT to_regclass('public.competency_user_responses') AS t`);
      if ((respProbe.rows as any[])[0]?.t == null) {
        return res.json({
          user_id: userId, stage_code: stage, role_code: role,
          cohort_size: 0, my_ei: 0, percentile: null, top_percent: null,
        });
      }

      const r = await db.execute(sql`
        WITH per_user_comp AS (
          SELECT r.user_id, i.competency_id, AVG(r.score_obtained)::real AS raw_score
          FROM competency_user_responses r
          JOIN competency_assessment_items i ON i.id = r.item_id
          GROUP BY r.user_id, i.competency_id
        ),
        norms AS (SELECT competency_id, top10_score FROM stage_competency_norms WHERE stage_code = ${stage}),
        weights AS (SELECT competency_id, weight FROM role_competency_weights WHERE role_code = ${role}),
        per_user_ei AS (
          SELECT p.user_id,
            (AVG(LEAST(1, p.raw_score / NULLIF(n.top10_score, 0)) * COALESCE(w.weight, 1)) * 100)::real AS ei
          FROM per_user_comp p
          LEFT JOIN norms n ON n.competency_id = p.competency_id
          LEFT JOIN weights w ON w.competency_id = p.competency_id
          GROUP BY p.user_id
        ),
        with_rank AS (
          SELECT user_id, ei,
            PERCENT_RANK() OVER (ORDER BY ei)::real AS rank_frac
          FROM per_user_ei
        )
        SELECT (SELECT COUNT(*) FROM per_user_ei)::int AS cohort_size,
               (SELECT ei FROM with_rank WHERE user_id = ${userId})::real AS my_ei,
               (SELECT rank_frac FROM with_rank WHERE user_id = ${userId})::real AS rank_frac
      `);
      const row: any = r.rows[0] || {};
      const cohortSize = Number(row.cohort_size) || 0;
      const rankFrac = Number(row.rank_frac);
      const myEi = Number(row.my_ei) || 0;

      let percentile: number | null = null;
      let topPercent: number | null = null;
      if (cohortSize >= 2 && !Number.isNaN(rankFrac)) {
        // rank_frac: 0 = lowest, 1 = highest
        percentile = Math.round(rankFrac * 100);   // e.g., 88 means "you're at the 88th percentile"
        topPercent = Math.max(1, 100 - percentile); // "Top 12%"
      }
      res.json({
        user_id: userId,
        stage_code: stage,
        role_code: role,
        cohort_size: cohortSize,
        my_ei: Number(myEi.toFixed(1)),
        percentile,           // e.g., 88
        top_percent: topPercent, // e.g., 12  → "You're in the top 12%"
      });
    } catch (err) { next(err); }
  });

  // ============================================
  // STUDENT — Compare two assessment sessions (delta card)
  // ============================================
  app.get("/api/competency/score/:userId/diff", requireAuth, async (req, res, next) => {
    try {
      const userId = req.params.userId;
      const stage = String(req.query.stage_code || 'EXEC');
      const role = req.query.role_code ? String(req.query.role_code) : null;

      // Honest degrade when the legacy competency_user_responses table is absent.
      const respProbe = await db.execute(sql`SELECT to_regclass('public.competency_user_responses') AS t`);
      if ((respProbe.rows as any[])[0]?.t == null) {
        return res.json({ has_diff: false, message: 'No competency response data available yet.' });
      }

      // Get distinct sessions: group responses by minute (a "session" is responses within a 30-minute window)
      const sessions = await db.execute(sql`
        WITH bucketed AS (
          SELECT
            r.*,
            date_trunc('minute', r.created_at) AS minute_bucket
          FROM competency_user_responses r
          WHERE r.user_id = ${userId}
        ),
        sessions_grouped AS (
          SELECT
            r.id,
            i.competency_id,
            r.score_obtained,
            r.created_at,
            -- Bucket by 30-min sessions
            DATE_TRUNC('hour', r.created_at) + (FLOOR(EXTRACT(MINUTE FROM r.created_at) / 30) * INTERVAL '30 minute') AS session_bucket
          FROM competency_user_responses r
          JOIN competency_assessment_items i ON i.id = r.item_id
          WHERE r.user_id = ${userId}
        ),
        norms AS (SELECT competency_id, top10_score FROM stage_competency_norms WHERE stage_code = ${stage}),
        weights AS (SELECT competency_id, weight FROM role_competency_weights WHERE role_code = ${role}),
        per_session AS (
          SELECT
            s.session_bucket,
            s.competency_id,
            AVG(s.score_obtained)::real AS raw_score
          FROM sessions_grouped s
          GROUP BY s.session_bucket, s.competency_id
        ),
        ei_per_session AS (
          SELECT
            ps.session_bucket,
            (AVG(LEAST(1, ps.raw_score / NULLIF(n.top10_score, 0)) * COALESCE(w.weight, 1)) * 100)::real AS ei
          FROM per_session ps
          LEFT JOIN norms n ON n.competency_id = ps.competency_id
          LEFT JOIN weights w ON w.competency_id = ps.competency_id
          GROUP BY ps.session_bucket
        )
        SELECT * FROM ei_per_session ORDER BY session_bucket DESC LIMIT 2
      `);
      const rows = sessions.rows as any[];
      if (rows.length < 2) return res.json({ has_diff: false, message: 'Need at least 2 assessment sessions for comparison' });

      const latest = rows[0];
      const previous = rows[1];

      // Per-competency deltas across the two sessions
      const compDeltas = await db.execute(sql`
        WITH sessions_grouped AS (
          SELECT
            i.competency_id, c.code, c.name,
            r.score_obtained,
            DATE_TRUNC('hour', r.created_at) + (FLOOR(EXTRACT(MINUTE FROM r.created_at) / 30) * INTERVAL '30 minute') AS session_bucket
          FROM competency_user_responses r
          JOIN competency_assessment_items i ON i.id = r.item_id
          JOIN competencies c ON c.id = i.competency_id
          WHERE r.user_id = ${userId}
        ),
        per_session_comp AS (
          SELECT session_bucket, competency_id, code, name, AVG(score_obtained)::real AS raw_score
          FROM sessions_grouped GROUP BY session_bucket, competency_id, code, name
        ),
        latest AS (SELECT * FROM per_session_comp WHERE session_bucket = ${latest.session_bucket}),
        previous AS (SELECT * FROM per_session_comp WHERE session_bucket = ${previous.session_bucket})
        SELECT
          COALESCE(l.code, p.code) AS code,
          COALESCE(l.name, p.name) AS name,
          l.raw_score AS latest_score,
          p.raw_score AS previous_score,
          (COALESCE(l.raw_score, 0) - COALESCE(p.raw_score, 0))::real AS delta
        FROM latest l
        FULL OUTER JOIN previous p ON p.competency_id = l.competency_id
        WHERE COALESCE(l.raw_score, 0) <> COALESCE(p.raw_score, 0)
        ORDER BY ABS(COALESCE(l.raw_score, 0) - COALESCE(p.raw_score, 0)) DESC
        LIMIT 8
      `);

      res.json({
        has_diff: true,
        latest:   { ei: Number(latest.ei).toFixed(1), at: latest.session_bucket },
        previous: { ei: Number(previous.ei).toFixed(1), at: previous.session_bucket },
        delta_ei: Number((Number(latest.ei) - Number(previous.ei)).toFixed(1)),
        top_changes: compDeltas.rows,
      });
    } catch (err) { next(err); }
  });

  // ============================================
  // SUPER ADMIN — AI-draft a single competency item via FastAPI proxy
  // ============================================
  app.post("/api/competency/items/ai-draft", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { competency_id, language } = req.body || {};
      if (!competency_id) return res.status(400).json({ message: 'competency_id required' });
      const langCode = String(language || 'en').toLowerCase();
      const langNames: Record<string, string> = {
        en: 'English', hi: 'Hindi', es: 'Spanish', fr: 'French', de: 'German',
        pt: 'Portuguese', ar: 'Arabic', zh: 'Chinese (Simplified)', ja: 'Japanese',
        ko: 'Korean', ta: 'Tamil', te: 'Telugu', kn: 'Kannada', mr: 'Marathi', bn: 'Bengali',
      };
      const langFullName = langNames[langCode] || 'English';

      const compRes = await db.execute(sql`
        SELECT c.id, c.code, c.name, c.description, c.competency_type, c.proficiency_levels,
               d.name AS domain_name
        FROM competencies c JOIN competency_domains d ON d.id = c.domain_id
        WHERE c.id = ${competency_id} LIMIT 1
      `);
      if ((compRes.rows as any[]).length === 0) return res.status(404).json({ message: 'Competency not found' });
      const c: any = compRes.rows[0];

      const llmBase = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
      const llmKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
      if (!llmBase || !llmKey) return res.status(503).json({ message: 'AI service not configured' });

      const prompt = `You are an expert assessment author. Draft ONE high-quality multiple-choice item for the competency below in ${langFullName}. Return strict JSON only.

Competency: ${c.code} — ${c.name}
Domain: ${c.domain_name}
Type: ${c.competency_type}
Description: ${c.description || 'N/A'}
Output language: ${langFullName} (${langCode})

Output schema:
{
  "question": "<a realistic workplace scenario in ${langFullName}, 1-3 sentences, ending with a question>",
  "options": [
    { "text": "<weakest answer in ${langFullName}>",   "score": 10 },
    { "text": "<weak answer in ${langFullName}>",      "score": 35 },
    { "text": "<strong answer in ${langFullName}>",    "score": 70 },
    { "text": "<best answer in ${langFullName}>",      "score": 95 }
  ]
}

Rules:
- Question and ALL options MUST be written in ${langFullName}.
- Scenario must be realistic and rooted in real work.
- Options must be plausible — avoid obvious "wrong" answers.
- Score gradient must reflect demonstrated competency (10/35/70/95).
- Return JSON only, no commentary.`;

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: llmKey, baseURL: llmBase });
      const completion = await openai.chat.completions.create({
        model: process.env.AI_INTEGRATIONS_OPENAI_MODEL || 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: `You are an expert assessment author. Output valid JSON only. The question and options must be in ${langFullName}.` },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 700,
      });
      const text = completion.choices?.[0]?.message?.content || '';
      let parsed: any;
      try {
        const m = text.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(m ? m[0] : text);
      } catch {
        return res.status(500).json({ message: 'Failed to parse AI response', raw: text });
      }
      if (!parsed.question || !Array.isArray(parsed.options) || parsed.options.length < 2) {
        return res.status(500).json({ message: 'AI returned invalid item shape', parsed });
      }

      const itemCode = `${c.code}_I_AI${langCode.toUpperCase()}${Date.now().toString().slice(-5)}`;
      const itemRes = await db.execute(sql`
        INSERT INTO competency_assessment_items (competency_id, code, item_type, difficulty, level, question, expected_time, scoring_type, language_code)
        VALUES (${c.id}, ${itemCode}, 'mcq', 3, 3, ${parsed.question}, 75, 'auto', ${langCode})
        RETURNING *
      `);
      const item = itemRes.rows[0] as any;
      for (let i = 0; i < parsed.options.length; i++) {
        const o = parsed.options[i];
        await db.execute(sql`
          INSERT INTO competency_assessment_options (item_id, text, score_value, display_order)
          VALUES (${item.id}, ${String(o.text || '').trim()}, ${Number(o.score) || 0}, ${i})
        `);
      }
      res.json({ success: true, language: langCode, item: { ...item, code: itemCode, options: parsed.options } });
    } catch (err: any) {
      console.error('AI draft failed:', err.message);
      next(err);
    }
  });

  // ============================================
  // ANALYTICS — EI over time, cohort benchmarks, response export
  // ============================================

  // GET /api/competency/analytics/ei-trend/:userId — historical EI snapshots based on response history
  app.get("/api/competency/analytics/ei-trend/:userId", requireAuth, async (req, res, next) => {
    try {
      const stage = String(req.query.stage_code || 'EXEC');
      const role = req.query.role_code ? String(req.query.role_code) : null;

      // Get all responses, group by date
      const r = await db.execute(sql`
        WITH daily AS (
          SELECT
            date_trunc('day', r.created_at)::date AS day,
            i.competency_id,
            AVG(r.score_obtained)::real AS avg_score
          FROM competency_user_responses r
          JOIN competency_assessment_items i ON i.id = r.item_id
          WHERE r.user_id = ${req.params.userId}
          GROUP BY 1, 2
          ORDER BY 1
        ),
        norms AS (SELECT competency_id, top10_score FROM stage_competency_norms WHERE stage_code = ${stage}),
        weights AS (SELECT competency_id, weight FROM role_competency_weights WHERE role_code = ${role})
        SELECT d.day, (AVG(LEAST(1, d.avg_score / NULLIF(n.top10_score, 0)) * COALESCE(w.weight, 1)) * 100)::real AS ei
        FROM daily d
        LEFT JOIN norms n ON n.competency_id = d.competency_id
        LEFT JOIN weights w ON w.competency_id = d.competency_id
        GROUP BY d.day
        ORDER BY d.day
      `);
      res.json({ user_id: req.params.userId, stage_code: stage, role_code: role, trend: r.rows });
    } catch (err) { next(err); }
  });

  // GET /api/competency/analytics/cohort-benchmark — aggregate benchmarks across all users
  app.get("/api/competency/analytics/cohort-benchmark", requireAuth, async (req, res, next) => {
    try {
      const stage = String(req.query.stage_code || 'EXEC');
      const role = req.query.role_code ? String(req.query.role_code) : null;
      const r = await db.execute(sql`
        WITH per_user_comp AS (
          SELECT r.user_id, i.competency_id, AVG(r.score_obtained)::real AS raw_score
          FROM competency_user_responses r
          JOIN competency_assessment_items i ON i.id = r.item_id
          GROUP BY r.user_id, i.competency_id
        ),
        norms AS (SELECT competency_id, top10_score FROM stage_competency_norms WHERE stage_code = ${stage}),
        weights AS (SELECT competency_id, weight FROM role_competency_weights WHERE role_code = ${role}),
        per_user_ei AS (
          SELECT p.user_id,
            AVG(LEAST(1, p.raw_score / NULLIF(n.top10_score, 0)) * COALESCE(w.weight, 1)) * 100 AS ei
          FROM per_user_comp p
          LEFT JOIN norms n ON n.competency_id = p.competency_id
          LEFT JOIN weights w ON w.competency_id = p.competency_id
          GROUP BY p.user_id
        )
        SELECT
          COUNT(*)::int AS total_users,
          AVG(ei)::real AS mean_ei,
          (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ei))::real AS median_ei,
          (PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY ei))::real AS p90_ei,
          (PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ei))::real AS p25_ei,
          MIN(ei)::real AS min_ei,
          MAX(ei)::real AS max_ei
        FROM per_user_ei
      `);
      res.json({ stage_code: stage, role_code: role, ...r.rows[0] });
    } catch (err) { next(err); }
  });

  // GET /api/competency/responses/export — bulk CSV of all responses (super admin only)
  app.get("/api/competency/responses/export", requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try {
      const r = await db.execute(sql`
        SELECT
          r.user_id,
          r.created_at,
          c.code AS competency_code,
          c.name AS competency_name,
          d.code AS domain_code,
          i.code AS item_code,
          i.question,
          o.text AS chosen_option,
          r.score_obtained,
          r.time_taken
        FROM competency_user_responses r
        JOIN competency_assessment_items i ON i.id = r.item_id
        LEFT JOIN competency_assessment_options o ON o.id = r.option_id
        JOIN competencies c ON c.id = i.competency_id
        JOIN competency_domains d ON d.id = c.domain_id
        ORDER BY r.created_at DESC
      `);
      const headers = ['user_id','timestamp','domain_code','competency_code','competency_name','item_code','question','chosen_option','score','time_taken'];
      const escape = (v: any) => {
        if (v === null || v === undefined) return '';
        const s = String(v);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
        return s;
      };
      const lines = [headers.join(',')];
      for (const row of r.rows as any[]) {
        lines.push([row.user_id, row.created_at, row.domain_code, row.competency_code, row.competency_name, row.item_code, row.question, row.chosen_option, row.score_obtained, row.time_taken].map(escape).join(','));
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="competency_responses_${new Date().toISOString().slice(0,10)}.csv"`);
      res.send(lines.join('\n'));
    } catch (err) { next(err); }
  });

  // ============================================
  // CSV TEMPLATES + BULK IMPORT — Stage Norms & Role Weights
  // ============================================

  app.get("/api/competency/stage-norms/template", requireAuth, requireSuperAdmin, async (_req, res) => {
    const csv = [
      'stageCode,stageName,competencyCode,minScore,medianScore,top10Score',
      'EXEC,Execution (2-5y),COG_C02,45,65,85',
      'LEAD,Lead (5-9y),COG_C02,55,75,90',
      'STRAT,Strategic (9-15y),LEAD_C03,65,82,93',
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="stage_norms_template.csv"');
    res.send(csv);
  });

  app.post("/api/competency/stage-norms/import", requireAuth, requireSuperAdmin, upload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
      const content = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
      let rows: any[];
      try { rows = parse(content, { columns: true, skip_empty_lines: true, trim: true, bom: true }); }
      catch { return res.status(400).json({ message: 'Invalid CSV format' }); }

      const compRes = await db.execute(sql`SELECT id, code FROM competencies`);
      const codeToId = new Map<string, string>();
      for (const c of compRes.rows as any[]) codeToId.set(c.code.toUpperCase(), c.id);

      let created = 0, updated = 0;
      const errors: { row: number; message: string }[] = [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const stageCode = String(r.stageCode || r.stage_code || '').trim();
        const stageName = String(r.stageName || r.stage_name || stageCode).trim();
        const compCode = String(r.competencyCode || r.competency_code || '').toUpperCase().trim();
        const min = parseFloat(r.minScore || r.min_score || '0');
        const med = parseFloat(r.medianScore || r.median_score || '0');
        const top = parseFloat(r.top10Score || r.top10_score || '0');
        if (!stageCode || !compCode || isNaN(min) || isNaN(med) || isNaN(top)) {
          errors.push({ row: i + 2, message: 'stageCode, competencyCode, minScore, medianScore, top10Score required' }); continue;
        }
        const compId = codeToId.get(compCode);
        if (!compId) { errors.push({ row: i + 2, message: `Unknown competency code: ${compCode}` }); continue; }

        const existing = await db.execute(sql`SELECT id FROM stage_competency_norms WHERE stage_code=${stageCode} AND competency_id=${compId} LIMIT 1`);
        if ((existing.rows as any[]).length) {
          await db.execute(sql`UPDATE stage_competency_norms SET min_score=${min}, median_score=${med}, top10_score=${top}, stage_name=${stageName} WHERE stage_code=${stageCode} AND competency_id=${compId}`);
          updated++;
        } else {
          await db.execute(sql`INSERT INTO stage_competency_norms (stage_code, stage_name, competency_id, min_score, median_score, top10_score) VALUES (${stageCode}, ${stageName}, ${compId}, ${min}, ${med}, ${top})`);
          created++;
        }
      }
      res.json({ success: true, created, updated, total: rows.length, errors: errors.slice(0, 50) });
    } catch (err) { next(err); }
  });

  app.get("/api/competency/role-weights/template", requireAuth, requireSuperAdmin, async (_req, res) => {
    const csv = [
      'roleCode,roleName,competencyCode,weight,weightType',
      'PM_L4,Senior Product Manager,COG_C02,1.8,core',
      'PM_L4,Senior Product Manager,FUNC_C25,1.8,core',
      'PM_L4,Senior Product Manager,LEAD_C03,1.4,differentiator',
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="role_weights_template.csv"');
    res.send(csv);
  });

  app.post("/api/competency/role-weights/import", requireAuth, requireSuperAdmin, upload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
      const content = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
      let rows: any[];
      try { rows = parse(content, { columns: true, skip_empty_lines: true, trim: true, bom: true }); }
      catch { return res.status(400).json({ message: 'Invalid CSV format' }); }

      const compRes = await db.execute(sql`SELECT id, code FROM competencies`);
      const codeToId = new Map<string, string>();
      for (const c of compRes.rows as any[]) codeToId.set(c.code.toUpperCase(), c.id);

      let upserted = 0;
      const errors: { row: number; message: string }[] = [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const roleCode = String(r.roleCode || r.role_code || '').toUpperCase().trim();
        const roleName = String(r.roleName || r.role_name || roleCode).trim();
        const compCode = String(r.competencyCode || r.competency_code || '').toUpperCase().trim();
        const weight = parseFloat(r.weight || '1');
        const weightType = String(r.weightType || r.weight_type || 'core').toLowerCase().trim();
        if (!roleCode || !compCode || isNaN(weight)) {
          errors.push({ row: i + 2, message: 'roleCode, competencyCode and numeric weight required' }); continue;
        }
        const compId = codeToId.get(compCode);
        if (!compId) { errors.push({ row: i + 2, message: `Unknown competency code: ${compCode}` }); continue; }
        if (!['core', 'differentiator', 'supporting'].includes(weightType)) {
          errors.push({ row: i + 2, message: `Invalid weightType: ${weightType}` }); continue;
        }
        await db.execute(sql`
          INSERT INTO role_competency_weights (role_code, role_name, competency_id, weight, weight_type)
          VALUES (${roleCode}, ${roleName}, ${compId}, ${weight}, ${weightType})
          ON CONFLICT (role_code, competency_id) DO UPDATE
            SET weight = EXCLUDED.weight, weight_type = EXCLUDED.weight_type, role_name = EXCLUDED.role_name
        `);
        upserted++;
      }
      res.json({ success: true, upserted, total: rows.length, errors: errors.slice(0, 50) });
    } catch (err) { next(err); }
  });

  // ============================================
  // SCORING ENGINE — META endpoints (for SuperAdminDashboard)
  // ============================================

  // GET /api/admin/scoring/engine-stats — aggregate counts for dashboard tiles
  app.get("/api/admin/scoring/engine-stats", requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try {
      const r = await db.execute(sql`
        SELECT
          (SELECT count(*) FROM lbi_modules WHERE status='Active')::int       AS modules,
          (SELECT count(*) FROM lbi_age_groups WHERE status='Active')::int    AS age_bands,
          (SELECT count(*) FROM lbi_domains WHERE status='Active')::int       AS domains,
          (SELECT count(*) FROM lbi_subdomains WHERE status='Active')::int    AS subdomains,
          0::int                                                              AS correlations,
          (SELECT count(*) FROM subscription_packages WHERE is_active=true)::int AS products,
          (SELECT count(*) FROM subscription_packages WHERE is_active=true AND price > 0)::int AS products_configured,
          5::int                                                              AS percentile_tiers
      `);
      const row: any = r.rows[0];
      // Frontend expects camelCase keys
      res.json({
        modules: row.modules, ageBands: row.age_bands,
        domains: row.domains, subdomains: row.subdomains,
        correlations: row.correlations,
        products: row.products, productsConfigured: row.products_configured,
        percentileTiers: row.percentile_tiers,
      });
    } catch (err) { next(err); }
  });

  // GET /api/admin/scoring/modules-catalog — full LBI structure for the scoring engine config panel
  app.get("/api/admin/scoring/modules-catalog", requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try {
      const [mods, sub, bands] = await Promise.all([
        db.execute(sql`
          SELECT m.id, m.module_code AS code, m.module_name AS name, m.description, m.display_order,
            (SELECT count(*) FROM lbi_sub_modules s WHERE s.module_id = m.id)::int AS submodule_count
          FROM lbi_modules m WHERE m.status='Active' ORDER BY m.display_order
        `),
        db.execute(sql`
          SELECT s.id, s.sub_module_code AS code, s.sub_module_name AS name, s.module_id, s.display_order, s.question_type
          FROM lbi_sub_modules s ORDER BY s.display_order
        `),
        db.execute(sql`
          SELECT id, group_code AS code, group_name AS name, min_age, max_age, difficulty_level
          FROM lbi_age_groups WHERE status='Active' ORDER BY difficulty_level
        `),
      ]);
      res.json({
        modules: mods.rows,
        correlations: [],   // placeholder — to be populated when correlation engine is built
        ageBands: bands.rows,
        subModules: sub.rows,
      });
    } catch (err) { next(err); }
  });

  // GET /api/admin/lbi-catalog — flat catalog for read-only browsing
  app.get("/api/admin/lbi-catalog", requireAuth, async (_req, res, next) => {
    try {
      const r = await db.execute(sql`
        SELECT m.module_code AS code, m.module_name AS name,
          COALESCE(json_agg(json_build_object('code', s.sub_module_code, 'name', s.sub_module_name) ORDER BY s.display_order)
            FILTER (WHERE s.id IS NOT NULL), '[]') AS sub_modules
        FROM lbi_modules m LEFT JOIN lbi_sub_modules s ON s.module_id = m.id
        WHERE m.status='Active'
        GROUP BY m.id ORDER BY m.display_order
      `);
      res.json(r.rows);
    } catch (err) { next(err); }
  });

  // GET /api/admin/scoring/assessment-products — list packages as scoring "products"
  app.get("/api/admin/scoring/assessment-products", requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try {
      const r = await db.execute(sql`
        SELECT id, product_name AS name, category, price, validity_days, question_count, is_active
        FROM subscription_packages WHERE is_active=true ORDER BY sort_order, product_name
      `);
      res.json({ products: r.rows });
    } catch (err) { next(err); }
  });

  // PATCH /api/lbi/admin/domains/:id/toggle — toggle a module (=domain) active flag
  app.patch("/api/lbi/admin/domains/:id/toggle", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { id } = req.params;
      const [row] = await db.select().from(lbiModules).where(eq(lbiModules.id, id)).limit(1);
      if (!row) return res.status(404).json({ message: 'Module not found' });
      const next = row.status === 'Active' ? 'Inactive' : 'Active';
      await db.update(lbiModules).set({ status: next }).where(eq(lbiModules.id, id));
      res.json({ id, status: next, isActive: next === 'Active' });
    } catch (err) { next(err); }
  });

  // ─────────────────────────────────────────────────────────────────────
  // Concern Areas (parent-facing concerns + admin CRUD)
  // Ported from /app/frontend/server/src/routes/concerns.ts so it lives on
  // the running backend (port 8001).
  // Concerns + short-assessments routes → backend/routes/short-assessments.ts
  registerShortAssessmentRoutes(app, concernsPool, requireAuth, requireSuperAdmin);

  // Engines (§11 Confidence, §13 Explainability, §14 Events)
  // ─────────────────────────────────────────────────────────────────────
  registerSdiRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerEngineRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerFrameworkParityRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerImportExportRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerAuditRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerCapadexRoutes(app, concernsPool);
  registerFirebaseAuthRoutes(app);
  registerCvParserRoutes(app);
  registerCareerSeekerRoutes(app);
  registerRecruiterPostingsRoutes(app, concernsPool, requireAuth);
  registerBehaviouralMemoryRoutes(app, concernsPool, requireAuth);
  registerEmployabilityPassportRoutes(app, requireAuth);
  registerCompetencyQuestionRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerQuestionFactoryRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerPlatformLifecycleRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerPlatformLifecycleManagementRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerPlatformLifecycleIntelligenceRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerPlatformEvolutionIntelligenceRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerPlatformLifecycleAutomationRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerPlatformLifecycleOperationsRoutes(app, requireAuth, requireSuperAdmin);
  registerPlatformLifecycleCertificationRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerPlatformIntelligenceRegistryRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerEngineeringIntelligenceRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerRuntimeIntelligenceRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerKnowledgeIntelligenceRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerDecisionIntelligenceRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerPredictiveIntelligenceEngineRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerRecommendationIntelligenceEngineRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerContinuousLearningIntelligenceEngineRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerAssessmentReadinessRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerMx203KnowledgeRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerCapadexRecommendationsRoute(app, concernsPool);
  registerCapadexEnterpriseRoutes(app, concernsPool);
  registerCapadexPaymentRoutes(app, concernsPool);
  registerConcernIntelligenceRoutes(app, concernsPool);
  registerCapadexQuestionsRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerCapadexOntologyRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerConcernIntelligenceAdminRoutes(app, concernsPool);
  registerSecurityCenterRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerGovernanceRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // Idempotent canonical RBAC seed at boot when the governance flag is ON
  // (flag-OFF → no seed, no schema → byte-identical legacy). Fire-and-forget.
  if (isGovernanceRbacEnabled()) {
    seedRbac(concernsPool)
      .then((r) => console.log("[governance] RBAC seed ready:", JSON.stringify(r)))
      .catch((e) => console.error("[governance] RBAC seed failed:", e?.message || e));
  }
  registerCapadexConcernsMasterRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerCapadexClarityQuestionsRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerCapadexOntologyHubRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerCapadexCoverageRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerPilArchetypeRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerPilHumanIntelligenceRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerPilSearchIntentRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerPilInterventionRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerCapadexConcernSignalMapRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerCapadexQuestionRegistryRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerSimulationRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerPilGraphTraversalRoutes(app, concernsPool, requireAuth);
  registerWc7bActivationRoutes(app, concernsPool);
  registerWc7cCommercialRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerCommercialSpineRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerInvoiceRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerCapadexPredictionRoutes(app, concernsPool);
  registerSignalCaptureRoutes(app, concernsPool);
  registerIntelligenceDiagnosticsRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerCSIRoutes(app, concernsPool);
  registerReferenceIntelligenceRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerEIResolutionRoutes(app, concernsPool);
  registerVerificationRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerEIGovernanceRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerMissionControlRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerProductCommandCenterRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerGlobalSearchRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerActionCenterRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerNotificationCenterRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerReadinessEngineRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerHealthAggregatorRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerEmployabilityGraphRoutes({ app, pool: concernsPool, requireAuth, requireSuperAdmin });
  registerEIAdminRoutes({ app, pool: concernsPool, requireAuth, requireSuperAdmin });
  registerEIIntelligenceRoute({ app, pool: concernsPool, requireAuth });
  registerEIDemoSeedRoute({ app, pool: concernsPool, requireAuth, requireSuperAdmin });
  registerMEIV2Routes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerPeerBenchmarkRoutes({ app, pool: concernsPool });
  registerCompetencyOntologyRoutes({ app, pool: concernsPool });
  registerCompetencyFrameworkIntelligenceRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── Phase 6.4 Entitlement Engine — per-module access gates (flag moduleAccessControl, default OFF) ──
  // FLAG-OFF: each gate is a SYNCHRONOUS pass-through (next() before any await) → byte-identical legacy.
  // Mounted BEFORE the 7 protected surface registrations below so flag-ON enforcement covers them.
  // Identity is the SERVER-side authenticated principal; super-admins bypass; declared publicPaths stay open.
  app.use('/api/competency', requireModuleAccess(concernsPool, { module: 'competency_assessments', publicPaths: ['/questions/select'] }));
  app.use('/api/competency-ei', requireModuleAccess(concernsPool, { module: 'employability_index' }));
  app.use('/api/career/intelligence', requireModuleAccess(concernsPool, { module: 'career_builder' }));
  app.use('/api/passport', requireModuleAccess(concernsPool, { module: 'career_passport', publicPaths: ['/shared/'] }));
  app.use('/api/employer', requireModuleAccess(concernsPool, { module: 'employer_portal', publicPaths: ['/public/', '/register'] }));
  app.use('/api/analytics', requireModuleAccess(concernsPool, { module: 'analytics' }));
  app.use('/api/workforce-intelligence', requireModuleAccess(concernsPool, { module: 'workforce_intelligence' }));

  registerCompetencyRuntimeRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerCompetencyEiRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerCareerIntelligenceRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerCareerReadinessRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerCareerCompetencyActivationRoutes(app, concernsPool, requireAuth);
  registerCareerGapRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerCareerMatchRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerCareerRoadmapRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerCareerDevelopmentRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerCareerRecommendationRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerCareerSimulationEngineRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerCareerPassportFoundationRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerCareerSignalRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerCareerPathRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerLearningPathRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerTalentIntelligenceRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerTalentFoundationV52Routes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerJobPostingEngineRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerRoleResolutionRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerEmployerProductionHealthRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerTalentDiscoveryEngineRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerTalentMatchingEngineRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerEmployabilityMatchingEngineRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerHiringAssessmentEngineRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerCandidateComparisonEngineRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerShortlistingEngineRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerInterviewIntelligenceRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerInterviewQuestionsRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerHiringIntelligenceEngineRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerWorkforceIntelligenceEngineRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerEmployerDashboardsRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerNotificationRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerCareerProgressionRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerCareerValidationRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerEmployerValidationRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerCommercialValidationRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerCommercialArchitectureRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerAdaptiveBenchmarkRoutes({ app, pool: concernsPool });
  registerMobilityRoutes({ app, pool: concernsPool });
  registerCompetencyAssessmentRuntime({ app, pool: concernsPool, requireAuth });
  registerCareerStageGuidanceRoutes({ app, pool: concernsPool });
  registerCareerDiscoveryRoutes(app, concernsPool, requireAuth);
  registerCareerLaunchpadRoutes(app, concernsPool, requireAuth);
  registerLaunchpadDashboardRoutes(app, concernsPool, requireAuth);
  registerStudentCareerBuilderRoutes(app);
  registerLongitudinalRoutes({ app, pool: concernsPool });
  registerWorkforceAnalyticsRoutes({ app, pool: concernsPool });
  registerGovernanceWorkflowRoutes({ app, pool: concernsPool });
  registerEnterpriseIntelligenceRoutes({ app, pool: concernsPool });
  registerGlobalOntologyRoutes({ app, pool: concernsPool });
  registerScientificCompetencyRoutes({ app, pool: concernsPool });
  registerMarketIntelligencePhase3Routes({ app, pool: concernsPool });
  registerM4Routes({ app, pool: concernsPool });
  app.use('/api/m5', requireAuth);
  registerM5Routes({ app, pool: concernsPool });
  registerAssessmentWriterRoutes({ app, pool: concernsPool });
  registerCompetencyRuntimeV2({ app, pool: concernsPool, requireAuth });
  registerAdaptiveAssessmentV2({ app, pool: concernsPool, requireAuth });
  registerContextualBenchmarkV2({ app, pool: concernsPool, requireAuth });
  registerWorkforceOsV2Routes({ app, pool: concernsPool, requireAuth });
  registerAdaptiveOrchestrationV2({ app, pool: concernsPool, requireAuth });
  registerUnifiedCompetencyProfileRoutes({ app, pool: concernsPool, requireAuth });
  registerRoleDNARuntimeRoutes({ app, pool: concernsPool, requireAuth });
  registerRoleDnaExpansionRoutes({ app, pool: concernsPool, requireAuth });
  registerRoleDnaGovernanceRoutes({ app, pool: concernsPool, requireAuth });
  registerCompetencySpineRoutes({ app, pool: concernsPool, requireAuth });
  registerEmployerCompetencyMatchRoutes({ app, pool: concernsPool, requireAuth });
  registerCandidateCompetencyReadinessRoutes(app, concernsPool, requireAuth);
  registerEmployerGovernanceRoutes(app, concernsPool, requireAuth);
  registerCareerBuilderActivationRoutes({ app, pool: concernsPool, requireAuth });
  registerCompetencySkillIntelligenceRoutes({ app, pool: concernsPool, requireAuth });
  registerOnetActivationRoutes({ app, pool: concernsPool, requireAuth });
  registerOnetCrosswalkGovernanceRoutes({ app, pool: concernsPool, requireAuth });
  registerCompetencyCoverageMatricesRoutes({ app, pool: concernsPool, requireAuth });
  registerCompetencyGraphRuntimeRoutes({ app, pool: concernsPool, requireAuth });
  registerDynamicAssessmentRuntimeRoutes({ app, pool: concernsPool, requireAuth });
  registerAdaptiveRuntimeAuthorityRoutes({ app, pool: concernsPool, requireAuth });
  registerAiAssessmentV2({ app, pool: concernsPool, requireAuth });
  registerPredictiveIntelligenceV2({ app, pool: concernsPool, requireAuth });
  registerGovernanceV2({ app, pool: concernsPool, requireAuth });
  registerEnterpriseWorkforceOS({ app, pool: concernsPool, requireAuth });
  registerLBIEngineRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerLbiIntelligenceRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerBehaviouralSignalsRoutes(app, concernsPool);
  registerBehaviouralIntelligenceRoutes({ app, pool: concernsPool });
  registerPsychometricsRigorRoutes({ app, pool: concernsPool });
  registerAdaptiveCausalRoutes({ app, pool: concernsPool });
  registerWorkforceOsRoutes({ app, pool: concernsPool });
  registerPredictiveIntelligenceRoutes(app, concernsPool);
  registerTenantsRoutes(app, concernsPool);
  registerCognitiveIntelligenceRoutes(app, concernsPool);
  registerDigitalTwinRoutes(app, concernsPool);
  registerPsychometricsRoutes(app, concernsPool);
  registerSemanticReasoningRoutes(app, concernsPool);
  registerMemoryArchitectureRoutes(app, concernsPool);
  registerEthicsGovernanceRoutes(app, concernsPool);
  // ── Competency Assessment Factory (CAF) ──────────────────────────────────────
  registerCAFQuestionFrameworkRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerCAFAssessmentBuilderRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerCAFRuntimeRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerCAFAnalyticsRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── Competency Ontology ───────────────────────────────────────────────────────
  registerOntologyTaxonomyRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerOntologyCareerRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerOntologySupplementaryRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerOntologyLearningPathRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerOntologyFutureSkillsRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerOntologyAIRulesRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // Per-module import/export must be registered BEFORE generic catch-all routes
  registerOntologyImportExportRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // Platform approval workflow
  registerPlatformApprovalRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // Platform audit log read API
  registerPlatformAuditRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // Competency ontology core (Layers, Clusters, Competencies, Micro Competencies)
  registerOntologyCompetencyCoreRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // Concerns & Assessment Questions mapping
  registerOntologyConcernsMappingRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // Governance (ref tables, versioning, lifecycle, review schedules, quality gates)
  registerOntologyGovernanceRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerOntologyOverviewRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerFairnessEngineRoutes(app, concernsPool);
  registerSPEScoringRoutes(app, concernsPool);
  registerSPEPsychometricsRoutes(app, concernsPool);
  registerSPELongitudinalRoutes(app, concernsPool);
  registerSPEGovernanceRoutes(app, concernsPool);
  registerBIOSFrontierRoutes(app, concernsPool);
  registerBIOSFusionRoutes(app, concernsPool);
  registerBIOSAgentsRoutes(app, concernsPool);
  registerBIOSSimulationRoutes(app, concernsPool);
  registerROIERiskRoutes(app, concernsPool);
  registerROIEOpportunityRoutes(app, concernsPool);
  registerROIESemanticRoutes(app, concernsPool);
  registerROIEGovernanceRoutes(app, concernsPool);
  // F1 — PAIE compute/governance routes use a non-/admin prefix (/api/paie/*)
  // for their POST compute ops, so the global /api/admin gate above does not
  // cover them. These are super-admin Advanced-Labs operations (the only
  // callers are the PAIE super-admin panels), so guard the whole prefix here.
  // (The /api/admin/paie/* dashboards are already covered by the global gate.)
  app.use('/api/paie', requireAuth, requireSuperAdmin);
  registerPAIEForecastingRoutes(app, concernsPool);
  registerPAIEOpportunityRoutes(app, concernsPool);
  registerPAIEIntelligenceRoutes(app, concernsPool);
  registerPAIEGovernanceRoutes(app, concernsPool);
  registerLDETemporalRoutes(app, concernsPool);
  registerLDEEvolutionRoutes(app, concernsPool);
  registerLDEIntelligenceRoutes(app, concernsPool);
  registerLDEGovernanceRoutes(app, concernsPool);
  registerRIERoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerRIEAdminRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  app.use('/api/admin/bios/runtime-state', requireAuth, requireSuperAdmin);
  registerCognitiveRuntimeRoutes(app, concernsPool);
  app.use('/api/admin/iil', requireAuth, requireSuperAdmin);
  app.use('/api/admin/nhda', requireAuth, requireSuperAdmin);
  registerIILCoreRoutes(app, concernsPool);
  registerIILEvolutionRoutes(app, concernsPool);
  registerIILIntelligenceRoutes(app, concernsPool);
  registerIILGovernanceRoutes(app, concernsPool);
  registerNHDACoreRoutes(app, concernsPool);
  registerNHDAIntelligenceRoutes(app, concernsPool);
  registerNHDAGovernanceRoutes(app, concernsPool);

  // Backward-compat: keep the original /api/sdi/admin/domains GET (modular handler also exposes it)
  // /api/sdi/admin/domains-legacy → deprecated; redirect to canonical endpoint
  app.get('/api/sdi/admin/domains-legacy', (_req, res) => {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Link', '/api/sdi/admin/domains; rel="successor-version"');
    res.redirect(301, '/api/sdi/admin/domains');
  });
  registerCompetencyCohortRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerFeatureFlagRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerHypothesisEngineRoutes(app, concernsPool);
  registerConfidenceEngineRoutes(app, concernsPool);
  registerContradictionEngineRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerCognitiveLoadRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerConversationalQualityRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerAdaptiveAssessmentRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerLongitudinalMemoryRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerDynamicReportRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerInterventionEngineRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerOmegaReportRoutes(app, concernsPool);
  registerPragatiRoutes(app);
  registerCareerProfileRoutes(app);
  registerCareerBenchmarkRoutes(app);
  registerCareerWorkforceRoutes(app);
  registerCareerGenomeRoutes(app);
  registerCareerSuccessRoutes(app);
  registerCareerTrajectoryRoutes(app);
  registerCareerVelocityRoutes(app);
  registerCareerMemoryRoutes(app, concernsPool);
  registerCareerSimulationRoutes(app);
  // ── Career Intelligence Hub (composition API — additive) ─────────────────────
  registerCareerIntelligenceHubRoutes(app, concernsPool, requireAuth);
  // ── Career Graph Intelligence (CGI) ──────────────────────────────────────────
  registerCareerGraphRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── Career Pathways Intelligence (CPI) — pathway forecast, growth plans, transitions ─
  registerCareerPathwaysIntelligenceRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── Career Builder — First Outcome Evidence Loop (score -> real outcome -> validated claim) ─
  registerCareerEvidenceRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── Talent Foundation — Role Families, Competency Blueprints, Mappings ───────
  registerTalentFoundationRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── Talent Foundation Phase 2: Role Level Profiles ───────────────────────────
  registerTalentLevelProfileRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── Talent Foundation Phase 3+4: Scoring Engine + Gap Intelligence ───────────
  registerTalentScoringRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── Talent Signal Master (D3+D4): 300+ behavioural talent signals ─────────────
  registerTalentSignalMasterRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── Competency DNA Profiles (D5): signal fingerprints per competency × level ──
  registerCompetencyDNARoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── Competency Intelligence Engine (CI-1.0.0): Trend+Forecast+Outcome+Intervention ──
  registerCompetencyIntelligenceRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── Talent Readiness Engine (D9): role readiness + succession pipeline ─────────
  registerTalentReadinessEngineRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── Outcome Prediction Engine (D15): probabilistic talent outcome predictions ──
  registerTalentOutcomePredictionRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerValidationLoopRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerOutcomeIntelligenceRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── Employer, Community & Ecosystem (MX-302I): flag-gated additive ecosystem surface ──
  registerEcosystemCommunityRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── Live Employer Ecosystem (MX-103X): read-only audit + certification over the employer hiring funnel ──
  registerEmployerEcosystemRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── Global Competency (Phase 8): additive region dimension + per-region coverage ──
  registerGlobalCompetencyRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── Global Intelligence (MX-76X): read-only composer over global/region/country assets ──
  registerGlobalIntelligenceRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // Self-running, idempotent region-native market/benchmark seed (Task 81). A task merge carries
  // CODE + migration DDL only, NOT rows, and the agent cannot write to prod — so the only way
  // region data reaches the live app is a guarded startup seeder (matches this codebase's
  // occupation/ontology self-seeder pattern). Fire-and-forget; no-op once present; never blocks boot.
  import('./services/region-native-market-seed')
    .then((m) => m.ensureRegionNativeMarketSeed(concernsPool))
    .then((r) => {
      if (r.market !== 'already_present' || r.globalContent !== 'already_present') {
        console.log('[region-native-seed] startup:', JSON.stringify(r));
      }
    })
    .catch((err) => console.warn('[region-native-seed] startup init skipped:', err?.message ?? err));

  // Self-running, idempotent Task #138 competency-expansion seed (applied by Task #146). A task
  // merge carries CODE + migration DDL only, NOT rows, and the agent cannot write to prod — so the
  // only way the role-DNA weights / per-competency questions / blueprint wiring reach the live app
  // is a guarded startup seeder (matches this codebase's region-native/occupation self-seeders).
  // Fire-and-forget; each lever no-ops once its own provenance is present; never blocks boot.
  // Downstream consumption stays flag-gated (employerCompetencyHiring / competencyRuntime).
  import('./services/task138-competency-seed')
    .then((m) => m.ensureTask138CompetencySeed(concernsPool))
    .then((r) => {
      if (r.roleWeights !== 'already_present' || r.questions !== 'already_present' || r.blueprints !== 'already_present') {
        console.log('[task138-seed] startup:', JSON.stringify(r));
      }
    })
    .catch((err) => console.warn('[task138-seed] startup init skipped:', err?.message ?? err));

  // Self-running, idempotent Task #161 genome seed — authors the 3 competencies that
  // had no genuine same-construct genome match (Verbal Communication, Change Leadership,
  // Digital Fluency) so all 20 CRA competencies can be scored precisely. Same live-reach
  // rationale as task138: a merge carries CODE only, not rows, so the only way these
  // genome rows reach the live app is a guarded startup seeder. No-ops once present.
  import('./services/task161-genome-competency-seed')
    .then((m) => m.ensureTask161GenomeCompetencies(concernsPool))
    .then((r) => {
      if (r.competencies !== 'already_present') {
        console.log('[task161-seed] startup:', JSON.stringify(r));
      }
    })
    .catch((err) => console.warn('[task161-seed] startup init skipped:', err?.message ?? err));

  // MX-100X Phase 9 — Enterprise Workforce Intelligence Console (read-only, flag-gated, OFF by default).
  registerEnterpriseWorkforceConsoleRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerEcosystemActivationRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // MX-105X — Enterprise Certification & Platform Activation (read-only top-level composer, flag-gated OFF).
  registerEnterpriseCertificationRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerCompetencyMatchIntelligenceRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // MX-106X — Production Readiness & Go-Live Certification (read-only top-level composer, superset of MX-105X, flag-gated OFF).
  registerGoLiveCertificationRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  registerPlatformCompletionRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // MX-77X — Persona-scoped workforce surfaces (employer aggregate + employee self), same flag.
  registerEnterpriseWorkforcePersonaRoutes(app, concernsPool, requireAuth);
  // ── Benchmark Engine (D17): industry · role · competency percentile benchmarks ─
  registerTalentBenchmarkEngineRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── Talent Digital Twin (D14): 6-state synthesis ─────────────────────────────
  registerTalentDigitalTwinRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── Measurement Science (D8): formulas · weights · bands · norm groups ─────────
  registerTalentMeasurementScienceRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── Analytics Warehouse (D20): executive dashboard · KPIs · fact tables ────────
  registerTalentAnalyticsWarehouseRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── Learning Intelligence Catalog (D12): courses · certs · projects · mentors ──
  registerTalentLearningCatalogRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── FRP Enrichment (D13): automation risk · AI readiness · future competency ───
  registerTalentFRPEnrichmentRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── Concern Intelligence Framework (D4): Competency→Concern→Signal, feeds D9/D14/D15 ──
  registerTalentConcernIntelligenceRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── VX-D3  Capability Architecture ───────────────────────────────────────
  registerVXCapabilityArchitectureRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── VX-D15 Labor Market Intelligence ─────────────────────────────────────
  registerVXLaborMarketIntelligenceRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── VX-D16 Evidence Intelligence Platform ────────────────────────────────
  registerVXEvidenceIntelligenceRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── VX-D0  Multi-Tenant Configuration ────────────────────────────────────
  registerVXTenantConfigurationRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── VX-D7A Assessment Runtime Extended (proctoring + audit) ──────────────
  registerVXAssessmentRuntimeExtendedRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── VX-D25 Competency Science Council ────────────────────────────────────
  registerVXCompetencyScienceCouncilRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── VX-D1  Workforce Knowledge Graph ─────────────────────────────────────
  registerVXWorkforceKnowledgeGraphRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── VX-D9  IRT & Adaptive Assessment Engine ───────────────────────────────
  registerVXIRTEngineRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── VX-D21 Report Intelligence Platform ──────────────────────────────────
  registerVXReportIntelligenceRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── Learning Intelligence Platform (LIP) ─────────────────────────────────────
  const { registerLIPRoutes } = await import('./routes/lip');
  registerLIPRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── Future Readiness Platform (FRP) ──────────────────────────────────────────
  const { registerFRPRoutes } = await import('./routes/frp');
  registerFRPRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── Career Passport ───────────────────────────────────────────────────────────
  const { registerCareerPassportRoutes } = await import('./routes/career-passport');
  registerCareerPassportRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── MX-302G — Learning Intelligence ↔ Career Passport loop ──────────────────────
  const { registerLearningPassportRoutes } = await import('./routes/learning-passport');
  registerLearningPassportRoutes(app, concernsPool, requireAuth);
  // ── Design Report Factory ─────────────────────────────────────────────────────
  const { registerReportFactoryRoutes } = await import('./routes/report-factory');
  registerReportFactoryRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── Enterprise Analytics Warehouse ────────────────────────────────────────────
  const { registerEnterpriseAnalyticsRoutes } = await import('./routes/enterprise-analytics');
  registerEnterpriseAnalyticsRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── AI Governance Platform ────────────────────────────────────────────────────
  const { registerAiGovernanceRoutes } = await import('./routes/ai-governance');
  registerAiGovernanceRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── Entitlement Bridge ────────────────────────────────────────────────────────
  const { registerEntitlementRoutes } = await import('./routes/entitlement');
  registerEntitlementRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── Phase 6.4 Entitlement Engine — module access control (flag moduleAccessControl, default OFF) ─
  const { registerEntitlementEngineRoutes } = await import('./routes/entitlement-engine');
  registerEntitlementEngineRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── Task #7 Usage Metering (flag commercialUsageMetering, default OFF) ───────────
  const { registerCommercialMeteringRoutes } = await import('./routes/commercial-metering');
  registerCommercialMeteringRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── Phase 6.6 Revenue Intelligence (flag commercialRevenueIntelligence, default OFF) ─────────────
  const { registerCommercialAnalyticsRoutes } = await import('./routes/commercial-analytics');
  registerCommercialAnalyticsRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── Phase 6.8 Customer Success Intelligence (flag commercialCustomerSuccess, default OFF) ─────────
  const { registerCustomerSuccessRoutes } = await import('./routes/customer-success');
  registerCustomerSuccessRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── Phase 6.9 Enterprise Governance console (flag enterpriseGovernanceConsole, default OFF) ───────
  const { registerEnterpriseGovernanceRoutes } = await import('./routes/enterprise-governance');
  registerEnterpriseGovernanceRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── Phase 6.10 Platform Intelligence console (flag platformIntelligenceConsole, default OFF) ──────
  const { registerPlatformIntelligenceRoutes } = await import('./routes/platform-intelligence');
  registerPlatformIntelligenceRoutes(app, concernsPool, requireAuth, requireSuperAdmin);

  const { registerMultiTenantArchitectureRoutes } = await import('./routes/multi-tenant-architecture');
  registerMultiTenantArchitectureRoutes(app, concernsPool, requireAuth, requireSuperAdmin);

  // ── Phase 6.13 Automation Engine console (flag automationEngine, default OFF) ─
  const { registerAutomationEngineRoutes } = await import('./routes/automation-engine');
  registerAutomationEngineRoutes(app, concernsPool, requireAuth, requireSuperAdmin);

  // Phase 6.14 — Super Admin Command Center (flag `commandCenter`, default OFF → routes 503).
  const { registerCommandCenterRoutes } = await import('./routes/superadmin-command-center');
  registerCommandCenterRoutes(app, concernsPool, requireAuth, requireSuperAdmin);

  // Phase 6.15 — Founder Control Center (flag `founderControlCenter`, default OFF → routes 503).
  const { registerFounderControlCenterRoutes } = await import('./routes/founder-control-center');
  registerFounderControlCenterRoutes(app, concernsPool, requireAuth, requireSuperAdmin);
  // ── Employer Intelligence Operating System (EP-98) ───────────────────────────
  registerEmployerPortalRoutes(app, concernsPool, requireAuth);
  // ── Voice Screening (flag voiceScreening, OFF byte-identical incl. schema) ────
  registerVoiceScreeningRoutes(app, concernsPool, requireAuth);
  registerCampusPlacementRoutes(app, concernsPool, requireAuth);
  // ── MX-302F Resume, Portfolio & Interview Studio (flag employabilityStudio) ──
  registerEmployabilityStudioRoutes(app, concernsPool, requireAuth);
  // ── MX-302H University/Faculty/Placement/Parent Intelligence (flag institutionalIntelligence) ──
  const { registerInstitutionalIntelligenceRoutes } = await import('./routes/institutional-intelligence');
  registerInstitutionalIntelligenceRoutes(app, concernsPool, requireAuth);
  // ── Super-Admin Employer Onboarding (create org + admin login) ───────────────
  const { registerEmployerAdminRoutes } = await import('./routes/employer-admin');
  registerEmployerAdminRoutes(app, concernsPool, requireAuth, requireSuperAdmin, crypto.hash);
  // ── Employer Security Layer (EP-98-W1) ────────────────────────────────────────
  const { registerEmployerSecurityRoutes } = await import('./routes/employer-security');
  registerEmployerSecurityRoutes(app, concernsPool, requireAuth);
  // ── Talent Intelligence Graph (EP-98-W2) ──────────────────────────────────────
  const { registerEmployerTIGRoutes } = await import('./routes/employer-tig');
  registerEmployerTIGRoutes(app, concernsPool, requireAuth);
  // ── Hiring Intelligence System (EP-98-W3) ─────────────────────────────────────
  const { registerHiringIntelligenceRoutes } = await import('./routes/employer-hiring-intelligence');
  registerHiringIntelligenceRoutes(app, concernsPool, requireAuth);
  // ── EIOS: Employer Intelligence Operating System (EP-EIOS-98X) ───────────────
  const { registerEIOSCoreRoutes }         = await import('./routes/eios-core');
  const { registerEIOSIntelligenceRoutes } = await import('./routes/eios-intelligence');
  const { registerEIOSWorkforceRoutes }    = await import('./routes/eios-workforce');
  registerEIOSCoreRoutes(app, concernsPool, requireAuth);
  registerEIOSIntelligenceRoutes(app, concernsPool, requireAuth);
  registerEIOSWorkforceRoutes(app, concernsPool, requireAuth);
  // ── Report Intelligence Assembler ─────────────────────────────────────────────
  registerReportIntelligenceAssembler(app, concernsPool, requireAuth);
  return httpServer;
}

function generateInsights(score: number, moduleCode: string): string[] {
  const insights: string[] = [];
  
  if (score >= 80) {
    insights.push('Excellent performance in this assessment area');
    insights.push('Continue developing these strong traits');
  } else if (score >= 60) {
    insights.push('Good foundational skills demonstrated');
    insights.push('Focus on consistent practice to strengthen further');
  } else if (score >= 40) {
    insights.push('Average performance with room for improvement');
    insights.push('Consider targeted exercises in weaker areas');
  } else {
    insights.push('This area needs focused attention and practice');
    insights.push('Break down learning into smaller, manageable goals');
  }

  switch (moduleCode) {
    case 'M5':
      insights.push('Developing consistent study habits improves discipline');
      break;
    case 'M6':
      insights.push('Emotional awareness helps manage academic stress');
      break;
    case 'M4':
      insights.push('Building confidence through small achievements works best');
      break;
  }

  return insights;
}

function getLBIInterpretation(lbiScore: number): { level: string; description: string; recommendations: string[] } {
  if (lbiScore >= 85) {
    return {
      level: 'Exceptional',
      description: 'Demonstrates outstanding learning behavior patterns across all domains. Highly self-motivated with excellent cognitive and emotional balance.',
      recommendations: [
        'Continue nurturing leadership qualities',
        'Consider peer mentoring opportunities',
        'Explore advanced learning challenges'
      ]
    };
  } else if (lbiScore >= 70) {
    return {
      level: 'Strong',
      description: 'Shows strong learning behaviors with good balance across domains. Well-equipped for academic challenges.',
      recommendations: [
        'Focus on maintaining consistency',
        'Develop areas showing moderate scores',
        'Set stretch goals for personal growth'
      ]
    };
  } else if (lbiScore >= 55) {
    return {
      level: 'Developing',
      description: 'Learning behaviors are developing well with some areas needing attention. Good foundation for improvement.',
      recommendations: [
        'Identify 2-3 focus areas for improvement',
        'Create structured routines',
        'Seek support in challenging domains'
      ]
    };
  } else if (lbiScore >= 40) {
    return {
      level: 'Emerging',
      description: 'Learning behaviors are emerging with several areas requiring focused intervention and support.',
      recommendations: [
        'Work closely with mentors/counselors',
        'Break goals into smaller achievable steps',
        'Build confidence through small wins'
      ]
    };
  } else {
    return {
      level: 'Needs Support',
      description: 'Requires comprehensive support across multiple domains. Early intervention recommended.',
      recommendations: [
        'Consult with educational psychologist',
        'Implement structured support plan',
        'Focus on foundational skills first'
      ]
    };
  }
}
