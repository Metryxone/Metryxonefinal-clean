import type { ExportType } from '@/components/admin/ImportExportPanel';
import type { FieldDef, ColDef } from '@/components/admin/CrudTable';

export interface FwConfig {
  name: string;
  tagline: string;
  color: string;
  accentBg: string;
  staticStats: { value: string; label: string }[];
  overviewApi: string;
  summaryApi: string;
  domainsApi: string;
  domainsAdminApi: string;
  domainCols: ColDef[];
  domainFields: FieldDef[];
  subLabel: string;
  subApi: string;
  subAdminApi: string;
  subCols: ColDef[];
  subFields: FieldDef[];
  itemsType: 'lbi' | 'sdi' | 'competency';
  itemsApi?: string;
  itemsAdminApi?: string;
  itemsCols?: ColDef[];
  itemsFields?: FieldDef[];
  itemsFilterKeys?: string[];
  itemsExportType?: string;
  itemsImportType?: string;
  itemsImportTemplateHeaders?: string[];
  clustersApi: string;
  clusterSubsApi: string;
  clusterCodeField?: string;
  clusterNameField?: string;
  clusterGroupField?: string;
  normsApi: string;
  normsStagesApi: string;
  normsStageKey: string;
  normsStageLabel: string;
  weightsApi: string;
  weightsStagesApi: string;
  weightsStageKey: string;
  weightsStageLabel: string;
  versionsApi?: string;
  generateDefaultsApi?: string;
  exportApi?: string;
  importApi?: string;
  exportTypes?: ExportType[];
  scoringRulesApi?: string;
  reportTypesApi?: string;
  anchorItemsApi?: string;
  clusterCorrelationsApi?: string;
  concernsApi?: string;
  /** Which concerns panel to render under the "Concern Areas" tab.
   *  - 'legacy' (default): persona-tagged concern_areas table (~62 rows) via ConcernAreasPanel
   *  - 'capadex-master': 2,505-row audited capadex_concerns_master catalogue via CapadexConcernsMasterPanel */
  concernsKind?: 'legacy' | 'capadex-master';
  questionsApi?: string;
  questionsCols?: ColDef[];
  questionsFields?: FieldDef[];
  shortAssessmentsPanel?: boolean;
  /** When true, framework exposes the audited capadex_clarity_questions pool
   *  (14,291-row child catalogue) under a "Clarity Questions" inner tab.
   *  CAPADEX-only — surfaces CapadexClarityQuestionsPanel inline. */
  clarityQuestionsPanel?: boolean;
  /** When true, framework exposes the 4-tier Behavioural Signal Ontology
   *  (capadex_domains | capadex_families | capadex_signals |
   *  capadex_atomic_signals — 20 / 400 / 20 / 15,972 rows) under a single
   *  "Signal Ontology" inner tab. CAPADEX-only — surfaces
   *  SignalOntologyHubPanel inline with its own 4 sub-tabs. */
  signalOntologyPanel?: boolean;
}

export const LBI_CONFIG: FwConfig = {
  name: 'LBI Behavioural Framework',
  tagline: 'Measures 19 behavioral domains across stress, learning & adjustment dimensions',
  color: '#344E86',
  accentBg: '#344E8610',
  staticStats: [
    { value: '19', label: 'Domains' },
    { value: '97', label: 'Subdomains' },
    { value: '6', label: 'Age Bands' },
    { value: 'Ages 6–22+', label: 'Assessment Range' },
  ],
  overviewApi: '/api/lbi/admin/engine-summary',
  summaryApi: '/api/lbi/admin/engine-summary',
  domainsApi: '/api/lbi/admin/domains',
  domainsAdminApi: '/api/lbi/admin/domains',
  domainCols: [
    { key: 'domain_code', label: 'Code', mono: true },
    { key: 'domain_name', label: 'Name' },
    { key: 'description', label: 'Description', truncate: true },
    { key: 'status', label: 'Status' },
  ],
  domainFields: [
    { key: 'domain_code', label: 'Domain Code', type: 'text', required: true, placeholder: 'e.g. BEH' },
    { key: 'domain_name', label: 'Domain Name', type: 'text', required: true, placeholder: 'e.g. Behavioural Engagement' },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'display_order', label: 'Display Order', type: 'number', placeholder: '99' },
    { key: 'status', label: 'Status', type: 'select', options: [{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }] },
  ],
  subLabel: 'Subdomains',
  subApi: '/api/lbi/admin/subdomain-list',
  subAdminApi: '/api/lbi/admin/subdomain-list',
  subCols: [
    { key: 'subdomain_code', label: 'Code', mono: true },
    { key: 'subdomain_name', label: 'Name' },
    { key: 'domain_code', label: 'Domain', mono: true },
    { key: 'description', label: 'Description', truncate: true },
  ],
  subFields: [
    { key: 'domain_code', label: 'Domain Code', type: 'text', required: true, placeholder: 'e.g. BEH (must exist)' },
    { key: 'subdomain_code', label: 'Subdomain Code', type: 'text', required: true, placeholder: 'e.g. BEH_01' },
    { key: 'subdomain_name', label: 'Subdomain Name', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'display_order', label: 'Display Order', type: 'number', placeholder: '99' },
  ],
  itemsType: 'lbi',
  clustersApi: '/api/lbi/admin/clusters',
  clusterSubsApi: '/api/lbi/admin/subdomain-list',
  normsApi: '/api/lbi/admin/subdomain-norms',
  normsStagesApi: '/api/lbi/admin/age-bands',
  normsStageKey: 'age_band_code',
  normsStageLabel: 'Age Band',
  weightsApi: '/api/lbi/admin/age-band-weights',
  weightsStagesApi: '/api/lbi/admin/age-bands',
  weightsStageKey: 'age_band_code',
  weightsStageLabel: 'Age Band',
  versionsApi: '/api/lbi/admin/versions',
  generateDefaultsApi: '/api/lbi/admin/generate-defaults',
  exportApi: '/api/lbi/admin/export',
  importApi: '/api/lbi/admin/import',
  scoringRulesApi: '/api/lbi/admin/scoring-rules',
  reportTypesApi: '/api/lbi/admin/report-types',
  anchorItemsApi: '/api/lbi/admin/anchor-items',
  clusterCorrelationsApi: '/api/lbi/admin/cluster-correlations',
  exportTypes: [
    {
      type: 'questions',
      label: 'Question Bank',
      icon: 'csv',
      description: 'Full item-level flat table — one row per question with domain, subdomain, age band, response options, keying, scoring & metadata',
      templateHeaders: [
        'domainCode','domainName','subdomainCode','subdomainName',
        'questionCode','ageBandCode','questionType','questionText','passageText',
        'keying','optionA','optionAScore','optionB','optionBScore',
        'optionC','optionCScore','optionD','optionDScore',
        'correctAnswer','explanation','anchor',
        'difficulty','setNumber','displayOrder','version','language','status',
      ],
    },
    {
      type: 'all',
      label: 'Domains & Subdomains',
      icon: 'csv',
      description: 'Flat table of all domains with their subdomains, content and weightages',
      templateHeaders: [
        'domain_code','domain_name','domain_description','domain_color','domain_weightage',
        'subdomain_code','subdomain_name','subdomain_description','subdomain_weightage','display_order','status',
      ],
    },
    {
      type: 'norms',
      label: 'Norms',
      icon: 'csv',
      description: 'Benchmark scores per subdomain per age band — min, median and top-10% cutoffs',
      templateHeaders: [
        'domainCode','domainName','subdomainCode','subdomainName','ageBandCode',
        'minScore','medianScore','top10Score',
      ],
    },
    {
      type: 'weights',
      label: 'Weights',
      icon: 'csv',
      description: 'Subdomain importance weights per age band — weight value and type (core / differentiator / supporting)',
      templateHeaders: [
        'domainCode','domainName','subdomainCode','subdomainName','ageBandCode',
        'weight','weightType',
      ],
    },
    { type: 'full', label: 'Full Backup (JSON)', icon: 'json', description: 'Complete LBI framework — domains, subdomains, clusters as JSON' },
  ],
};

export const COMPETENCY_CONFIG: FwConfig = {
  name: 'Professional Competency Framework',
  tagline: '10 competency domains mapped across 101 competencies and 7 industry role types',
  color: '#344E86',
  accentBg: '#344E8610',
  staticStats: [
    { value: '10', label: 'Domains' },
    { value: '101', label: 'Competencies' },
    { value: '7', label: 'Role Types' },
    { value: '50+', label: 'Industries' },
  ],
  overviewApi: '/api/competency/engine-summary',
  summaryApi: '/api/competency/engine-summary',
  domainsApi: '/api/competency/domains',
  domainsAdminApi: '/api/competency/domains',
  domainCols: [
    { key: 'code', label: 'Code', mono: true },
    { key: 'name', label: 'Name' },
    { key: 'description', label: 'Description', truncate: true },
    { key: 'is_active', label: 'Active' },
  ],
  domainFields: [
    { key: 'code', label: 'Domain Code', type: 'text', required: true, placeholder: 'e.g. COMM' },
    { key: 'name', label: 'Domain Name', type: 'text', required: true, placeholder: 'e.g. Communication' },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'color', label: 'Color Hex', type: 'text', placeholder: '#344E86' },
    { key: 'weight', label: 'Weight', type: 'number', placeholder: '1.0' },
    { key: 'display_order', label: 'Display Order', type: 'number', placeholder: '99' },
    { key: 'is_active', label: 'Active', type: 'boolean' },
  ],
  subLabel: 'Competencies',
  subApi: '/api/competency/competencies',
  subAdminApi: '/api/competency/competencies',
  subCols: [
    { key: 'code', label: 'Code', mono: true },
    { key: 'name', label: 'Name' },
    { key: 'competency_type', label: 'Type' },
    { key: 'is_active', label: 'Active' },
  ],
  subFields: [
    { key: 'code', label: 'Competency Code', type: 'text', required: true, placeholder: 'e.g. COMM_01' },
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    {
      key: 'competency_type', label: 'Type', type: 'select',
      options: [
        { value: 'core', label: 'Core' },
        { value: 'technical', label: 'Technical' },
        { value: 'leadership', label: 'Leadership' },
        { value: 'functional', label: 'Functional' },
        { value: 'behavioral', label: 'Behavioral' },
      ],
    },
    { key: 'display_order', label: 'Display Order', type: 'number', placeholder: '99' },
    { key: 'is_active', label: 'Active', type: 'boolean' },
  ],
  itemsType: 'competency',
  itemsApi: '/api/competency/items',
  itemsAdminApi: '/api/competency/items',
  itemsFilterKeys: ['item_type', 'difficulty'],
  itemsExportType: 'items',
  itemsImportType: 'items',
  itemsImportTemplateHeaders: [
    'competency_code','code','item_type','difficulty','question',
    'level','expected_time',
  ],
  itemsCols: [
    { key: 'code', label: 'Code', mono: true },
    { key: 'competency_name', label: 'Competency', truncate: true },
    { key: 'question', label: 'Question', truncate: true },
    { key: 'item_type', label: 'Type' },
    { key: 'difficulty', label: 'Diff.' },
  ],
  itemsFields: [
    { key: 'competency_id', label: 'Competency ID (UUID)', type: 'text', required: true, placeholder: 'Paste competency UUID' },
    { key: 'code', label: 'Item Code', type: 'text', required: true, placeholder: 'e.g. COMM_01_Q01' },
    { key: 'question', label: 'Question / Scenario', type: 'textarea', required: true },
    {
      key: 'item_type', label: 'Item Type', type: 'select',
      options: [
        { value: 'mcq', label: 'MCQ' },
        { value: 'likert', label: 'Likert' },
        { value: 'scenario', label: 'Scenario' },
        { value: 'ranking', label: 'Ranking' },
      ],
    },
    { key: 'difficulty', label: 'Difficulty (1–5)', type: 'number', placeholder: '3' },
    { key: 'level', label: 'Proficiency Level (1–5)', type: 'number', placeholder: '3' },
    { key: 'expected_time', label: 'Expected Time (sec)', type: 'number', placeholder: '60' },
  ],
  clustersApi: '/api/competency/clusters',
  clusterSubsApi: '/api/competency/competencies',
  clusterCodeField: 'code',
  clusterNameField: 'name',
  clusterGroupField: 'domain_id',
  normsApi: '/api/competency/admin/stage-norms',
  normsStagesApi: '/api/competency/admin/stage-norms',
  normsStageKey: 'stage_code',
  normsStageLabel: 'Career Stage',
  weightsApi: '/api/competency/admin/role-weights',
  weightsStagesApi: '/api/competency/admin/role-weights',
  weightsStageKey: 'role_code',
  weightsStageLabel: 'Role',
  generateDefaultsApi: '/api/competency/admin/generate-defaults',
  exportApi: '/api/competency/admin/export',
  importApi: '/api/competency/admin/import',
  scoringRulesApi: '/api/competency/admin/scoring-rules',
  reportTypesApi: '/api/competency/admin/report-types',
  clusterCorrelationsApi: '/api/competency/admin/cluster-correlations',
  exportTypes: [
    {
      type: 'all',
      label: 'All Data — Domains & Competencies',
      icon: 'csv',
      description: 'Single flat table: domain codes, names, content, weights + all competencies',
      templateHeaders: [
        'domain_code','domain_name','domain_description','domain_color','domain_weight',
        'competency_code','competency_name','competency_description','competency_type','display_order','is_active',
      ],
    },
    { type: 'full', label: 'Full Backup (JSON)', icon: 'json', description: 'Complete Competency framework — domains, competencies, items, clusters as JSON' },
  ],
};

export const SDI_CONFIG: FwConfig = {
  name: 'CAPADEX',
  shortAssessmentsPanel: true,
  tagline: 'Capability & Potential Development Exchange — multi-stakeholder intelligence across 4 stages: Curiosity · Insight · Growth · Mastery',
  color: '#344E86',
  accentBg: '#344E8610',
  staticStats: [
    { value: '4', label: 'Stages' },
    { value: 'Curiosity → Mastery', label: 'Journey' },
    { value: '5', label: 'Stakeholder Groups' },
    { value: '360°', label: 'Intelligence' },
  ],
  overviewApi: '/api/sdi/admin/engine-summary',
  summaryApi: '/api/sdi/admin/engine-summary',
  domainsApi: '/api/sdi/admin/domains',
  domainsAdminApi: '/api/sdi/admin/domains',
  domainCols: [
    { key: 'domain_code', label: 'Code', mono: true },
    { key: 'domain_name', label: 'Name' },
    { key: 'category', label: 'Category' },
    { key: 'is_active', label: 'Active' },
  ],
  domainFields: [
    { key: 'domain_code', label: 'Domain Code', type: 'text', required: true, placeholder: 'e.g. SOC' },
    { key: 'domain_name', label: 'Domain Name', type: 'text', required: true, placeholder: 'e.g. Social Skills' },
    { key: 'category', label: 'Category', type: 'text', placeholder: 'e.g. Emotional Intelligence' },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'color', label: 'Color Hex', type: 'text', placeholder: '#344E86' },
    { key: 'weightage', label: 'Weightage', type: 'number', placeholder: '1.0' },
    { key: 'display_order', label: 'Display Order', type: 'number', placeholder: '99' },
    { key: 'is_active', label: 'Active', type: 'boolean' },
  ],
  subLabel: 'Subdomains',
  subApi: '/api/sdi/subdomains',
  subAdminApi: '/api/sdi/admin/subdomains',
  subCols: [
    { key: 'subdomain_code', label: 'Code', mono: true },
    { key: 'subdomain_name', label: 'Name' },
    { key: 'domain_code', label: 'Domain', mono: true },
    { key: 'is_active', label: 'Active' },
  ],
  subFields: [
    { key: 'domain_code', label: 'Domain Code', type: 'text', required: true, placeholder: 'e.g. SOC (must exist)' },
    { key: 'subdomain_code', label: 'Subdomain Code', type: 'text', required: true, placeholder: 'e.g. SOC_01' },
    { key: 'subdomain_name', label: 'Subdomain Name', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'display_order', label: 'Display Order', type: 'number', placeholder: '99' },
    { key: 'is_active', label: 'Active', type: 'boolean' },
  ],
  itemsType: 'sdi',
  itemsApi: '/api/sdi/items',
  itemsAdminApi: '/api/sdi/admin/items',
  itemsFilterKeys: ['subdomain_code', 'item_type', 'difficulty'],
  itemsExportType: 'items',
  itemsImportType: 'items',
  itemsImportTemplateHeaders: [
    'subdomain_code','item_code','item_type','difficulty','question',
    'concern_name','stage_code','age_band','polarity','weight',
    'anchor','focus_area','layer_tag','expected_time','language_code','is_active',
  ],
  itemsCols: [
    { key: 'item_code', label: 'Code', mono: true },
    { key: 'subdomain_code', label: 'Subdomain', mono: true },
    { key: 'question', label: 'Question', truncate: true },
    { key: 'item_type', label: 'Type' },
    { key: 'difficulty', label: 'Diff.' },
  ],
  itemsFields: [
    { key: 'subdomain_code', label: 'Subdomain Code', type: 'text', required: true, placeholder: 'e.g. SOC_01' },
    { key: 'item_code', label: 'Item Code', type: 'text', required: true, placeholder: 'e.g. SOC_01_Q01' },
    { key: 'question', label: 'Question / Statement', type: 'textarea', required: true },
    {
      key: 'item_type', label: 'Item Type', type: 'select',
      options: [
        { value: 'likert5', label: 'Likert 5-point' },
        { value: 'likert4', label: 'Likert 4-point' },
        { value: 'mcq', label: 'MCQ' },
        { value: 'true_false', label: 'True / False' },
      ],
    },
    { key: 'difficulty', label: 'Difficulty (1–5)', type: 'number', placeholder: '3' },
    { key: 'expected_time', label: 'Expected Time (sec)', type: 'number', placeholder: '30' },
    { key: 'language_code', label: 'Language Code', type: 'text', placeholder: 'en' },
  ],
  clustersApi: '/api/sdi/admin/clusters',
  clusterSubsApi: '/api/sdi/subdomains',
  normsApi: '/api/sdi/admin/subdomain-norms',
  normsStagesApi: '/api/sdi/admin/stages',
  normsStageKey: 'stage_code',
  normsStageLabel: 'Stage',
  weightsApi: '/api/sdi/admin/stage-weights',
  weightsStagesApi: '/api/sdi/admin/stages',
  weightsStageKey: 'stage_code',
  weightsStageLabel: 'Stage',
  versionsApi: '/api/sdi/admin/versions',
  generateDefaultsApi: '/api/sdi/admin/generate-defaults',
  exportApi: '/api/sdi/admin/export',
  importApi: '/api/sdi/admin/import',
  scoringRulesApi: '/api/sdi/admin/scoring-rules',
  reportTypesApi: '/api/sdi/admin/report-types',
  clusterCorrelationsApi: '/api/sdi/admin/cluster-correlations',
  concernsApi: '/api/admin/capadex/concerns-master',
  concernsKind: 'capadex-master',
  clarityQuestionsPanel: true,
  signalOntologyPanel: true,
  // Adaptive Question Bank tab disabled (2026-05-28): redundant with the new
  // Clarity Questions tab (14,291-row curated pool). Backend route
  // `/api/admin/superadmin/capadex/questions` is still registered and used at
  // runtime by pickQuestionsFromDB() — only the SuperAdmin UI surface is hidden.
  // To restore the inline CRUD tab, re-add `questionsApi/Cols/Fields` below.
  // (questionsApi/Cols/Fields intentionally omitted — see comment above.)
  exportTypes: [
    {
      type: 'all',
      label: 'All Data — Domains & Subdomains',
      icon: 'csv',
      description: 'Single flat table: domain codes, names, content, weightages + all subdomains',
      templateHeaders: [
        'domain_code','domain_name','domain_description','category','domain_weightage',
        'subdomain_code','subdomain_name','subdomain_description','display_order','is_active',
      ],
    },
    { type: 'full', label: 'Full Backup (JSON)', icon: 'json', description: 'Complete CAPADEX framework — domains, subdomains, items, clusters as JSON' },
  ],
};
