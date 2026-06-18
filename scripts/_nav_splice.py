import re, io

path = "frontend/src/hooks/useAdminDashboardState.tsx"
with io.open(path, encoding="utf-8") as f:
    src = f.read()

start_marker = "  const navGroups: NavGroup[] = [\n"
end_marker = "  ]\n    .map(group =>"

si = src.index(start_marker)
ei = src.index(end_marker)
assert si != -1 and ei != -1 and ei > si, "markers not found"

new_array = r'''  const navGroups: NavGroup[] = [
    // ── Mission Control (always visible, no header) ─────────────────────────
    {
      label: null,
      items: [
        { id: 'mission-control', icon: LayoutDashboard, label: 'Mission Control' },
        { id: 'overview',        icon: PieChart,        label: 'Overview' },
      ]
    },
    // ── Products — executive command centers ────────────────────────────────
    {
      label: 'Products',
      items: [
        { id: 'cc-capadex',       icon: Sparkles,   label: 'CAPADEX Command Center' },
        { id: 'cc-competency',    icon: Target,     label: 'Competency Command Center' },
        { id: 'cc-lbi',           icon: Brain,      label: 'LBI Command Center' },
        { id: 'cc-employability', icon: TrendingUp, label: 'Employability Intelligence' },
        { id: 'cc-career',        icon: Network,    label: 'Career Builder Command Center' },
        { id: 'cc-employer',      icon: Building2,  label: 'Employer Intelligence OS' },
      ]
    },
    // ── Intelligence ────────────────────────────────────────────────────────
    {
      label: 'Intelligence',
      items: [
        { id: 'capadex-analytics',             icon: BarChart3,  label: 'CAPADEX Analytics' },
        { id: 'signal-intelligence',           icon: Activity,   label: 'Signal Intelligence' },
        { id: 'intelligence-pipeline',         icon: Layers,     label: 'Intelligence Pipeline' },
        { id: 'concern-intelligence',          icon: Sparkles,   label: 'Concern Engine' },
        { id: 'csi-intelligence',              icon: TrendingUp, label: 'CSI Profiles' },
        { id: 'runtime-intelligence',          icon: Layers,     label: 'Runtime Intelligence' },
        { id: 'career-graph-admin',            icon: Network,    label: 'Career Graph Intelligence' },
        { id: 'competency-intelligence-admin', icon: Brain,      label: 'Competency Intelligence' },
        { id: 'talent-signal-master',          icon: Activity,   label: 'Talent Signal Master' },
        { id: 'predictive-intelligence',       icon: TrendingUp, label: 'Predictive Intelligence' },
        { id: 'ei-health',                     icon: TrendingUp, label: 'EI Health & Analytics' },
        { id: 'frp-admin',                     icon: Zap,        label: 'Future Readiness Platform' },
        { id: 'lip-admin',                     icon: BookOpen,   label: 'Learning Intelligence Platform' },
      ]
    },
    // ── Organizations ───────────────────────────────────────────────────────
    {
      label: 'Organizations',
      items: [
        { id: 'usermgmt',            icon: Users,         label: 'User Management' },
        { id: 'parents',             icon: UserCircle2,   label: 'Parents' },
        { id: 'students',            icon: GraduationCap, label: 'Students (18+)' },
        { id: 'institutions',        icon: School,        label: 'Institutions' },
        { id: 'hr',                  icon: Briefcase,     label: 'HR & Jobs' },
        { id: 'mentors',             icon: UserCheck,     label: 'Mentors' },
        { id: 'employer-onboarding', icon: Building2,     label: 'Employer Onboarding' },
        { id: 'tenants',             icon: Building2,     label: 'Multi-Tenant' },
      ]
    },
    // ── Operations ──────────────────────────────────────────────────────────
    {
      label: 'Operations',
      items: [
        { id: 'approvals',              icon: ClipboardCheck, label: 'Approval Workflow' },
        { id: 'platform-audit',         icon: ScrollText,     label: 'Platform Audit Log' },
        { id: 'capadex-users',          icon: Users,          label: 'CAPADEX Users & Journeys' },
        { id: 'capadex-interventions',  icon: Shield,         label: 'Risk & Interventions' },
        { id: 'rie-escalations',        icon: AlertTriangle,  label: 'Crisis Escalations', badge: crisisPending, badgeColor: '#DC2626' },
      ]
    },
    // ── Reports ─────────────────────────────────────────────────────────────
    {
      label: 'Reports',
      items: [
        { id: 'reports',              icon: BarChart2, label: 'Reports' },
        { id: 'capadex-reports',      icon: BarChart2, label: 'CAPADEX Reports' },
        { id: 'report-factory-admin', icon: FileText,  label: 'Report Factory' },
        { id: 'enterprise-analytics', icon: BarChart3, label: 'Enterprise Analytics' },
      ]
    },
    // ── Commercial ──────────────────────────────────────────────────────────
    {
      label: 'Commercial',
      items: [
        { id: 'pricing',         icon: CreditCard, label: 'Pricing & Packages' },
        { id: 'capadex-pricing', icon: CreditCard, label: 'CAPADEX Upgrade Pricing' },
        { id: 'financials',      icon: Wallet,     label: 'Financials' },
        { id: 'learning',        icon: BookOpen,   label: 'Learning Plans' },
      ]
    },
    // ── Governance ──────────────────────────────────────────────────────────
    {
      label: 'Governance',
      items: [
        { id: 'ai-governance',  icon: Shield,      label: 'AI Governance Platform' },
        { id: 'security',       icon: ShieldCheck, label: 'Security & Audit' },
        { id: 'access',         icon: Lock,        label: 'Access Control' },
        { id: 'consents',       icon: ScrollText,  label: 'Consents' },
        { id: 'ont-governance', icon: ShieldCheck, label: 'Ontology Governance' },
        { id: 'feature-flags',  icon: ToggleLeft,  label: 'Feature Flags' },
      ]
    },
    // ── Platform ────────────────────────────────────────────────────────────
    {
      label: 'Platform',
      items: [
        { id: 'content',                icon: Play,      label: 'Content Manager' },
        { id: 'documents',              icon: FileCheck, label: 'Documents' },
        { id: 'codes',                  icon: Hash,      label: 'Entity Codes' },
        { id: 'notifications_mgmt',     icon: Bell,      label: 'Notifications' },
        { id: 'reference-intelligence', icon: Database,  label: 'Reference Intelligence' },
        { id: 'settings',               icon: Settings,  label: 'Settings' },
      ]
    },
    // ── Advanced Mode — full config & deep analytics (collapsed by default) ──
    {
      label: 'Advanced Mode',
      isLabs: true,
      items: [
        // Frameworks
        { id: 'lbi-fw',        icon: Brain,    label: 'LBI Framework' },
        { id: 'competency-fw', icon: Target,   label: 'Competency Framework' },
        { id: 'capadex-fw',    icon: Sparkles, label: 'CAPADEX Framework' },
        // CAPADEX intelligence ops
        { id: 'concern-signal-map',       icon: Network,        label: 'Concern → Signal Map' },
        { id: 'ontology-matrix',          icon: GitBranch,      label: 'Ontology Matrix' },
        { id: 'coverage-dashboard',       icon: Map,            label: 'Bridge-Tag Coverage' },
        { id: 'question-registry',        icon: ClipboardList,  label: 'Question Registry' },
        { id: 'archetype-intelligence',   icon: Layers,         label: 'Archetype Intelligence' },
        { id: 'human-intelligence',       icon: MessageCircle,  label: 'Human Intelligence' },
        { id: 'intervention-intelligence',icon: Target,         label: 'Intervention Intelligence' },
        { id: 'search-intent',            icon: Search,         label: 'Search Intent' },
        { id: 'simulation-validation',    icon: FlaskConical,   label: 'Simulation & Validation' },
        { id: 'conv-quality',             icon: Layers,         label: 'Conversational Quality' },
        { id: 'lbi-intelligence',         icon: Brain,          label: 'LBI Engine' },
        // Career analytics
        { id: 'career-pathway-analytics', icon: Map,        label: 'Pathway Analytics' },
        { id: 'occupation-analytics',     icon: Briefcase,  label: 'Occupation Analytics' },
        { id: 'recommendation-analytics', icon: Sparkles,   label: 'Recommendation Analytics' },
        { id: 'forecast-analytics',       icon: TrendingUp, label: 'Forecast Analytics' },
        { id: 'transition-analytics',     icon: GitBranch,  label: 'Transition Analytics' },
        // Talent Foundation
        { id: 'role-families',         icon: Users,         label: 'Role Families' },
        { id: 'competency-blueprints', icon: BookOpen,      label: 'Competency Blueprints' },
        { id: 'blueprint-mappings',    icon: Network,       label: 'Blueprint Mappings' },
        { id: 'level-profiles',        icon: Layers,        label: 'Level Profiles' },
        { id: 'talent-scoring',        icon: BarChart2,     label: 'Talent Scoring' },
        { id: 'talent-gaps',           icon: AlertTriangle, label: 'Gap Intelligence' },
        { id: 'talent-pipeline',       icon: TrendingUp,    label: 'Pipeline Analytics' },
        // Talent Intelligence (D-series)
        { id: 'talent-concern-intelligence', icon: AlertTriangle, label: 'Concern Intelligence (D4)' },
        { id: 'talent-competency-dna',       icon: Database,      label: 'Competency DNA (D5)' },
        { id: 'talent-readiness-engine',     icon: TrendingUp,    label: 'Readiness Engine (D9)' },
        { id: 'talent-digital-twin-admin',   icon: Cpu,           label: 'Digital Twin (D14)' },
        { id: 'talent-outcome-prediction',   icon: Sparkles,      label: 'Outcome Prediction (D15)' },
        { id: 'talent-benchmark-engine',     icon: BarChart3,     label: 'Benchmark Engine (D17)' },
        { id: 'talent-measurement-science',  icon: Calculator,    label: 'Scoring Formulas (D8)' },
        { id: 'talent-analytics-warehouse',  icon: BarChart2,     label: 'Analytics Warehouse (D20)' },
        // Employability extras
        { id: 'mei-v2-design',         icon: BarChart3, label: 'MEI v2 Design' },
        { id: 'talent-frp-enrichment', icon: Target,    label: 'FRP Enrichment (D13)' },
        // Learning & Passport
        { id: 'talent-learning-catalog', icon: Award, label: 'Learning Catalog (D12)' },
        { id: 'passport-stats-admin',    icon: Award, label: 'Passport Stats & Governance' },
        // Competency Ontology
        { id: 'ont-overview',           icon: Activity,      label: 'Ontology Overview' },
        { id: 'ont-industries',         icon: Building2,     label: 'Industries' },
        { id: 'ont-functions',          icon: Briefcase,     label: 'Functions' },
        { id: 'ont-departments',        icon: Layers,        label: 'Departments' },
        { id: 'ont-role-families',      icon: Users2,        label: 'Role Families (Ontology)' },
        { id: 'ont-roles',              icon: UserCircle2,   label: 'Roles' },
        { id: 'ont-career-tracks',      icon: Map,           label: 'Career Tracks' },
        { id: 'ont-competency-levels',  icon: BarChart2,     label: 'Competency Levels' },
        { id: 'ont-indicators',         icon: Target,        label: 'Indicators' },
        { id: 'ont-benchmarks',         icon: BarChart3,     label: 'Benchmarks' },
        { id: 'ont-career-paths',       icon: GitBranch,     label: 'Career Paths' },
        { id: 'ont-learning-paths',     icon: BookOpen,      label: 'Learning Paths' },
        { id: 'ont-future-skills',      icon: Sparkles,      label: 'Future Skills' },
        { id: 'ont-layers',             icon: Network,       label: 'Layers' },
        { id: 'ont-clusters',           icon: PieChart,      label: 'Competency Clusters' },
        { id: 'ont-competencies',       icon: TrendingUp,    label: 'Competencies' },
        { id: 'ont-micro-competencies', icon: Brain,         label: 'Micro Competencies' },
        { id: 'ont-concerns',           icon: AlertTriangle, label: 'Ontology Concerns' },
        { id: 'ont-assessment-questions', icon: MessageCircle, label: 'Assessment Questions' },
        { id: 'ont-ai-rules',           icon: Bot,           label: 'AI Rules' },
        { id: 'ont-import-export',      icon: FileDown,      label: 'Import / Export' },
        // Assessment Factory
        { id: 'caf-question-bank',      icon: Database,       label: 'CAF Question Bank' },
        { id: 'caf-scenarios',          icon: ClipboardList,  label: 'Scenario Framework' },
        { id: 'caf-difficulty-level',   icon: Sliders,        label: 'Difficulty & Levels' },
        { id: 'caf-assessment-builder', icon: Cpu,            label: 'Assessment Builder' },
        { id: 'caf-randomization',      icon: Shuffle,        label: 'Randomization Engine' },
        { id: 'caf-sessions',           icon: Timer,          label: 'CAF Sessions' },
        { id: 'caf-scoring',            icon: ClipboardCheck, label: 'CAF Scoring Engine' },
        { id: 'caf-analytics',          icon: LineChart,      label: 'CAF Analytics' },
        // Assessment Config
        { id: 'questionbank',         icon: Database,   label: 'Question Bank' },
        { id: 'competency-questions', icon: FileCheck,  label: 'Competency Questions' },
        { id: 'custom-modules',       icon: Package,    label: 'Custom Modules' },
        { id: 'scoring',              icon: Calculator, label: 'Norms & Scoring' },
      ]
    },
    // ── Developer Mode — experimental engines & labs (collapsed by default) ──
    {
      label: 'Developer Mode',
      isLabs: true,
      items: [
        // Vision-X
        { id: 'vx-capability-architecture',     icon: Brain,      label: 'VX: Capability Architecture (D2)' },
        { id: 'vx-labor-market-intelligence',   icon: TrendingUp, label: 'VX: Labor Market (D6)' },
        { id: 'vx-evidence-intelligence',       icon: Shield,     label: 'VX: Evidence (D7)' },
        { id: 'vx-tenant-configuration',        icon: Building2,  label: 'VX: Tenant Config (D11)' },
        { id: 'vx-assessment-runtime',          icon: Cpu,        label: 'VX: Assessment Runtime (D18)' },
        { id: 'vx-competency-science-council',  icon: Users2,     label: 'VX: Science Council (D19)' },
        { id: 'vx-workforce-knowledge-graph',   icon: GitBranch,  label: 'VX: Workforce Graph (D1)' },
        { id: 'vx-irt-engine',                  icon: Scale,      label: 'VX: IRT & Adaptive (D9)' },
        { id: 'vx-report-intelligence',         icon: FileText,   label: 'VX: Report Intelligence (D21)' },
        // BIOS Ultimate
        { id: 'cognitive-intelligence', icon: Brain,        label: 'Cognitive Intelligence' },
        { id: 'digital-twin',           icon: Cpu,          label: 'Human Digital Twin' },
        { id: 'psychometrics',          icon: FlaskConical, label: 'Psychometrics Engine' },
        { id: 'semantic-reasoning',     icon: GitBranch,    label: 'Semantic Reasoning' },
        { id: 'memory-architecture',    icon: Archive,      label: 'Memory Architecture' },
        { id: 'ethics-governance',      icon: ShieldCheck,  label: 'Ethics & Governance' },
        { id: 'fairness-engine',        icon: Scale,        label: 'Fairness & Bias' },
        // SPE — Psychometric Engine
        { id: 'spe-scoring',            icon: Calculator,   label: 'SPE: Scoring Engine' },
        { id: 'spe-psychometrics',      icon: FlaskConical, label: 'SPE: IRT & Calibration' },
        { id: 'spe-longitudinal',       icon: TrendingUp,   label: 'SPE: Longitudinal' },
        { id: 'spe-governance',         icon: ShieldCheck,  label: 'SPE: Governance' },
        // BIOS Frontier
        { id: 'bios-frontier',          icon: Brain,        label: 'BIOS: Neuro-Symbolic' },
        { id: 'bios-fusion',            icon: Layers,       label: 'BIOS: Fusion & Meta-Learning' },
        { id: 'bios-agents',            icon: Bot,          label: 'BIOS: Agents & Population' },
        { id: 'bios-simulation',        icon: FlaskConical, label: 'BIOS: Simulation' },
        // ROIE
        { id: 'roie-risk',              icon: AlertTriangle, label: 'ROIE: Risk Engine' },
        { id: 'roie-opportunity',       icon: TrendingUp,    label: 'ROIE: Opportunities' },
        { id: 'roie-semantic',          icon: Network,       label: 'ROIE: Semantic & Population' },
        { id: 'roie-governance',        icon: Shield,        label: 'ROIE: Governance' },
        // PAIE
        { id: 'paie-forecasting',       icon: TrendingUp,   label: 'PAIE: Forecasting' },
        { id: 'paie-opportunity',       icon: Sparkles,     label: 'PAIE: Opportunities' },
        { id: 'paie-intelligence',      icon: Network,      label: 'PAIE: Intelligence' },
        { id: 'paie-governance',        icon: ShieldCheck,  label: 'PAIE: Governance' },
        // LDE
        { id: 'lde-graph',              icon: Network,      label: 'LDE: Knowledge Graph' },
        { id: 'lde-temporal',          icon: TrendingUp,   label: 'LDE: Temporal' },
        { id: 'lde-evolution',         icon: Sparkles,     label: 'LDE: Evolution' },
        { id: 'lde-intelligence',      icon: Network,      label: 'LDE: Intelligence' },
        { id: 'lde-governance',        icon: ShieldCheck,  label: 'LDE: Governance' },
        // RIE
        { id: 'rie-dashboard',         icon: Activity,      label: 'RIE: Dashboard' },
        { id: 'rie-recommendations',   icon: Brain,         label: 'RIE: Recommendations' },
        { id: 'rie-interventions',     icon: Target,        label: 'RIE: Interventions' },
        { id: 'rie-recovery',          icon: TrendingUp,    label: 'RIE: Recovery Profiles' },
        { id: 'rie-opportunity',       icon: Sparkles,      label: 'RIE: Opportunities' },
        { id: 'rie-counsellors',       icon: Users,         label: 'RIE: Counsellor Directory' },
      ]
    },
'''

result = src[:si] + new_array + src[ei:]
with io.open(path, "w", encoding="utf-8") as f:
    f.write(result)
print("spliced OK; new length", len(result))
