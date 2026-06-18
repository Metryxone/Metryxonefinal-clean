/**
 * Occupation Graph Seed — P-R3A Employability Intelligence
 *
 * Idempotent seed: expands occupations (30→61), skills (90→~120),
 * occupation_skills mappings, and occupation_pathways.
 *
 * Self-contained: inserts any missing base occupations + skills
 * via ON CONFLICT DO NOTHING before linking them.
 *
 * Safe to call on every startup.
 */
import type { Pool } from 'pg';

// ── Occupation → skill mappings ───────────────────────────────────────────────
type SkillEntry = [string, 'essential' | 'important' | 'optional', number];

const OCCUPATION_SKILLS: Record<string, SkillEntry[]> = {
  // ── Engineering ─────────────────────────────────────────────────────────
  'Software Engineer': [
    ['Python',         'essential', 3], ['JavaScript',    'essential', 3],
    ['TypeScript',     'important', 3], ['Git',           'essential', 3],
    ['SQL',            'important', 3], ['Docker',        'important', 3],
    ['React',          'important', 3], ['Node.js',       'important', 3],
    ['GitHub Actions', 'optional',  2], ['Problem Solving','essential', 3],
    ['Communication',  'optional',  2],
  ],
  'Senior Software Engineer': [
    ['Python',         'essential', 4], ['JavaScript',    'essential', 4],
    ['TypeScript',     'essential', 4], ['Git',           'essential', 4],
    ['SQL',            'important', 4], ['Docker',        'essential', 4],
    ['Kubernetes',     'important', 3], ['PostgreSQL',    'important', 3],
    ['Redis',          'optional',  3], ['Terraform',     'optional',  3],
    ['GitHub Actions', 'important', 3], ['Problem Solving','essential', 4],
    ['Communication',  'important', 3],
  ],
  'Engineering Manager': [
    ['Leadership',            'essential', 4], ['Stakeholder Management','essential', 4],
    ['Decision Making',       'essential', 4], ['Agile Methodology',     'essential', 3],
    ['Jira',                  'important', 3], ['Confluence',            'important', 3],
    ['Python',                'optional',  3], ['SQL',                   'optional',  3],
    ['Problem Solving',       'essential', 4], ['Communication',         'essential', 4],
    ['Risk Management',       'important', 3],
  ],
  'Engineering Director': [
    ['Leadership',         'essential', 5], ['Stakeholder Management','essential', 5],
    ['Decision Making',    'essential', 5], ['Risk Management',       'essential', 4],
    ['Financial Modelling','important', 3], ['Agile Methodology',     'important', 3],
    ['Problem Solving',    'essential', 5], ['Communication',         'essential', 5],
    ['Jira',               'optional',  3],
  ],
  'VP Engineering': [
    ['Leadership',         'essential', 5], ['Stakeholder Management','essential', 5],
    ['Decision Making',    'essential', 5], ['Risk Management',       'essential', 5],
    ['Financial Modelling','essential', 4], ['Problem Solving',       'essential', 5],
    ['Communication',      'essential', 5], ['Python',               'optional',  3],
    ['Docker',             'optional',  3],
  ],
  'Chief Technology Officer': [
    ['Leadership',         'essential', 5], ['Stakeholder Management','essential', 5],
    ['Decision Making',    'essential', 5], ['Risk Management',       'essential', 5],
    ['Financial Modelling','essential', 5], ['Python',               'important', 4],
    ['Docker',             'optional',  3], ['Kubernetes',           'optional',  3],
    ['Communication',      'essential', 5], ['Problem Solving',      'essential', 5],
  ],
  // ── Product ──────────────────────────────────────────────────────────────
  'Product Manager': [
    ['Product Management',   'essential', 3], ['Agile Methodology',     'essential', 3],
    ['SQL',                  'important', 3], ['Jira',                  'essential', 3],
    ['Stakeholder Management','essential', 3], ['Leadership',            'important', 3],
    ['Decision Making',      'essential', 3], ['Communication',         'essential', 4],
    ['Problem Solving',      'essential', 3], ['Excel',                 'optional',  3],
    ['Data Analysis',        'important', 3],
  ],
  'Senior Product Manager': [
    ['Product Management',   'essential', 4], ['Agile Methodology',     'essential', 4],
    ['SQL',                  'important', 4], ['Jira',                  'essential', 4],
    ['Stakeholder Management','essential', 4], ['Leadership',            'essential', 4],
    ['Decision Making',      'essential', 4], ['Communication',         'essential', 4],
    ['Problem Solving',      'essential', 4], ['Excel',                 'optional',  3],
    ['Data Analysis',        'important', 4],
  ],
  'Director of Product': [
    ['Product Management',   'essential', 5], ['Leadership',            'essential', 5],
    ['Stakeholder Management','essential', 5], ['Decision Making',       'essential', 5],
    ['Risk Management',      'essential', 4], ['Financial Modelling',   'important', 4],
    ['Communication',        'essential', 5], ['Problem Solving',       'essential', 5],
    ['Data Analysis',        'important', 4],
  ],
  'Chief Product Officer': [
    ['Product Management',   'essential', 5], ['Leadership',            'essential', 5],
    ['Stakeholder Management','essential', 5], ['Decision Making',       'essential', 5],
    ['Risk Management',      'essential', 5], ['Financial Modelling',   'essential', 5],
    ['Communication',        'essential', 5], ['Problem Solving',       'essential', 5],
  ],
  // ── Data ─────────────────────────────────────────────────────────────────
  'Data Analyst': [
    ['SQL',              'essential', 3], ['Python',           'important', 3],
    ['Excel',            'essential', 3], ['Power BI',         'important', 3],
    ['Tableau',          'important', 3], ['Communication',    'important', 3],
    ['Problem Solving',  'essential', 3], ['R',                'optional',  2],
    ['Data Analysis',    'essential', 3], ['Critical Thinking','important', 3],
  ],
  'Data Scientist': [
    ['Python',                  'essential', 4], ['Machine Learning',     'essential', 4],
    ['Deep Learning',           'important', 3], ['TensorFlow',           'important', 3],
    ['PyTorch',                 'important', 3], ['SQL',                  'essential', 4],
    ['NumPy',                   'important', 3], ['Pandas',               'essential', 4],
    ['Natural Language Processing','optional',3], ['R',                   'important', 3],
    ['Data Analysis',           'essential', 4], ['Problem Solving',      'essential', 4],
  ],
  'Senior Data Scientist': [
    ['Python',                  'essential', 5], ['Machine Learning',      'essential', 5],
    ['Deep Learning',           'essential', 4], ['TensorFlow',            'important', 4],
    ['PyTorch',                 'important', 4], ['SQL',                   'essential', 4],
    ['NumPy',                   'important', 4], ['Pandas',                'essential', 4],
    ['Natural Language Processing','important',4],['Apache Spark',         'important', 3],
    ['Databricks',              'optional',  3], ['Snowflake',             'optional',  3],
    ['Generative AI',           'optional',  3], ['Data Analysis',         'essential', 5],
  ],
  'Data Engineer': [
    ['Python',           'essential', 4], ['SQL',               'essential', 4],
    ['Apache Kafka',     'important', 3], ['Apache Airflow',    'important', 3],
    ['Databricks',       'important', 3], ['Snowflake',         'important', 3],
    ['dbt',              'important', 3], ['PostgreSQL',        'important', 3],
    ['Docker',           'important', 3], ['Apache Spark',      'essential', 4],
    ['Data Analysis',    'essential', 4],
  ],
  'Analytics Manager': [
    ['SQL',                  'essential', 4], ['Python',            'important', 4],
    ['Power BI',             'important', 4], ['Tableau',           'important', 4],
    ['Looker',               'important', 3], ['Leadership',        'essential', 4],
    ['Stakeholder Management','essential',4], ['Decision Making',   'essential', 4],
    ['R',                    'optional',  3], ['Communication',     'essential', 4],
    ['Data Analysis',        'essential', 5],
  ],
  // ── Marketing ────────────────────────────────────────────────────────────
  'Marketing Manager': [
    ['Communication',        'essential', 4], ['Leadership',        'important', 3],
    ['Stakeholder Management','important', 3], ['HubSpot',           'important', 3],
    ['Excel',                'important', 3], ['Decision Making',   'important', 3],
    ['Problem Solving',      'important', 3], ['Data Analysis',     'optional',  2],
    ['Critical Thinking',    'important', 3],
  ],
  'Chief Marketing Officer': [
    ['Communication',        'essential', 5], ['Leadership',        'essential', 5],
    ['Stakeholder Management','essential', 5], ['Decision Making',   'essential', 5],
    ['Risk Management',      'important', 4], ['Financial Modelling','essential', 4],
    ['HubSpot',              'optional',  3], ['Excel',             'optional',  3],
    ['Problem Solving',      'essential', 5],
  ],
  // ── Sales ─────────────────────────────────────────────────────────────────
  'Sales Executive': [
    ['Communication',        'essential', 3], ['Stakeholder Management','important', 3],
    ['Salesforce CRM',       'important', 3], ['Negotiation',       'essential', 3],
    ['Excel',                'important', 3], ['Problem Solving',   'important', 3],
    ['Critical Thinking',    'important', 3],
  ],
  'Sales Manager': [
    ['Communication',        'essential', 4], ['Leadership',        'essential', 4],
    ['Stakeholder Management','essential', 4], ['Salesforce CRM',   'essential', 4],
    ['Negotiation',          'essential', 4], ['Excel',             'important', 3],
    ['Decision Making',      'essential', 4], ['Risk Management',   'optional',  3],
    ['Financial Modelling',  'optional',  3],
  ],
  'VP Sales': [
    ['Leadership',           'essential', 5], ['Communication',     'essential', 5],
    ['Stakeholder Management','essential', 5], ['Decision Making',   'essential', 5],
    ['Risk Management',      'important', 4], ['Salesforce CRM',    'important', 4],
    ['Negotiation',          'essential', 5], ['Financial Modelling','essential', 4],
  ],
  // ── HR ───────────────────────────────────────────────────────────────────
  'HR Business Partner': [
    ['Communication',        'essential', 4], ['Leadership',        'important', 3],
    ['Stakeholder Management','essential', 4], ['Workday',          'important', 3],
    ['SuccessFactors',       'optional',  3], ['Darwinbox',         'optional',  3],
    ['Oracle HCM Cloud',     'optional',  3], ['Keka',             'optional',  3],
    ['Decision Making',      'important', 3], ['Emotional Intelligence','essential',4],
  ],
  'Head of HR': [
    ['Leadership',           'essential', 5], ['Stakeholder Management','essential',5],
    ['Communication',        'essential', 5], ['Decision Making',   'essential', 4],
    ['Risk Management',      'important', 4], ['Workday',           'important', 4],
    ['SuccessFactors',       'optional',  3], ['Financial Modelling','optional',  3],
    ['Emotional Intelligence','essential', 5],
  ],
  'Chief Human Resources Officer': [
    ['Leadership',           'essential', 5], ['Stakeholder Management','essential',5],
    ['Decision Making',      'essential', 5], ['Risk Management',   'essential', 5],
    ['Financial Modelling',  'essential', 4], ['Communication',     'essential', 5],
    ['Workday',              'optional',  3], ['SuccessFactors',    'optional',  3],
    ['Emotional Intelligence','essential', 5],
  ],
  // ── Finance ───────────────────────────────────────────────────────────────
  'Finance Manager': [
    ['Financial Modelling',  'essential', 4], ['Excel',            'essential', 4],
    ['SQL',                  'important', 3], ['Risk Management',  'essential', 4],
    ['Decision Making',      'essential', 4], ['Communication',    'important', 3],
    ['Power BI',             'optional',  3], ['SAP',              'optional',  3],
  ],
  'Chief Financial Officer': [
    ['Financial Modelling',  'essential', 5], ['Excel',            'essential', 5],
    ['SQL',                  'optional',  3], ['Risk Management',  'essential', 5],
    ['Decision Making',      'essential', 5], ['Leadership',       'essential', 5],
    ['Stakeholder Management','essential', 5], ['Communication',   'essential', 5],
  ],
  // ── Consulting ────────────────────────────────────────────────────────────
  'Consultant': [
    ['Communication',        'essential', 3], ['Problem Solving',  'essential', 3],
    ['Risk Management',      'important', 3], ['Excel',            'essential', 3],
    ['Financial Modelling',  'important', 3], ['Stakeholder Management','important',3],
    ['Decision Making',      'important', 3], ['Critical Thinking','essential', 3],
    ['Data Analysis',        'optional',  2],
  ],
  'Senior Consultant': [
    ['Communication',        'essential', 4], ['Problem Solving',  'essential', 4],
    ['Risk Management',      'important', 4], ['Excel',            'essential', 4],
    ['Financial Modelling',  'important', 4], ['Stakeholder Management','essential',4],
    ['Decision Making',      'essential', 4], ['Leadership',       'important', 4],
    ['Critical Thinking',    'essential', 4],
  ],
  'Principal Consultant': [
    ['Communication',        'essential', 5], ['Problem Solving',  'essential', 5],
    ['Risk Management',      'essential', 4], ['Excel',            'important', 4],
    ['Financial Modelling',  'essential', 4], ['Stakeholder Management','essential',5],
    ['Decision Making',      'essential', 5], ['Leadership',       'essential', 5],
    ['Negotiation',          'important', 4], ['Critical Thinking','essential', 5],
  ],
  'Partner': [
    ['Leadership',           'essential', 5], ['Communication',    'essential', 5],
    ['Problem Solving',      'essential', 5], ['Risk Management',  'essential', 5],
    ['Excel',                'important', 4], ['Financial Modelling','essential', 5],
    ['Stakeholder Management','essential', 5], ['Decision Making', 'essential', 5],
    ['Negotiation',          'essential', 5], ['Critical Thinking','essential', 5],
  ],
  // ── General ───────────────────────────────────────────────────────────────
  'Intern': [
    ['Communication',        'essential', 1], ['Teamwork',         'essential', 1],
    ['Problem Solving',      'essential', 1], ['Adaptability',     'essential', 1],
    ['Time Management',      'essential', 1], ['Git',              'important', 1],
    ['Python',               'optional',  1], ['Excel',            'optional',  1],
    ['Critical Thinking',    'important', 1],
  ],
  // ── UX / Design ───────────────────────────────────────────────────────────
  'UX Designer': [
    ['User Research',        'essential', 3], ['User Experience Design','essential', 3],
    ['Figma',                'essential', 3], ['Prototyping',      'essential', 3],
    ['Usability Testing',    'essential', 3], ['Design Thinking',  'important', 3],
    ['Communication',        'important', 3], ['Problem Solving',  'important', 3],
    ['Adobe XD',             'optional',  2],
  ],
  'Senior UX Designer': [
    ['User Research',        'essential', 4], ['User Experience Design','essential', 4],
    ['Figma',                'essential', 4], ['Prototyping',      'essential', 4],
    ['Usability Testing',    'essential', 4], ['Design Thinking',  'essential', 4],
    ['Communication',        'essential', 4], ['Leadership',       'important', 3],
    ['Stakeholder Management','important', 3],
  ],
  'UX Lead': [
    ['User Research',        'essential', 5], ['User Experience Design','essential', 5],
    ['Figma',                'essential', 5], ['Prototyping',      'essential', 4],
    ['Usability Testing',    'essential', 4], ['Design Thinking',  'essential', 5],
    ['Communication',        'essential', 4], ['Leadership',       'essential', 4],
    ['Stakeholder Management','essential', 4], ['Decision Making', 'important', 4],
  ],
  'Head of Design': [
    ['User Experience Design','essential', 5], ['Design Thinking', 'essential', 5],
    ['Leadership',           'essential', 5], ['Stakeholder Management','essential',5],
    ['Communication',        'essential', 5], ['Decision Making',  'essential', 5],
    ['Risk Management',      'important', 4], ['Figma',            'optional',  4],
    ['Problem Solving',      'essential', 5],
  ],
  // ── DevOps / Cloud ────────────────────────────────────────────────────────
  'DevOps Engineer': [
    ['Docker',               'essential', 3], ['Kubernetes',       'essential', 3],
    ['Terraform',            'essential', 3], ['Ansible',          'important', 3],
    ['AWS',                  'important', 3], ['CI/CD',            'essential', 4],
    ['Python',               'important', 3], ['Linux',            'essential', 4],
    ['GitHub Actions',       'essential', 3], ['Grafana',          'important', 3],
    ['Prometheus',           'important', 3], ['Git',              'essential', 3],
  ],
  'Senior DevOps Engineer': [
    ['Docker',               'essential', 4], ['Kubernetes',       'essential', 4],
    ['Terraform',            'essential', 4], ['Ansible',          'essential', 4],
    ['AWS',                  'essential', 4], ['CI/CD',            'essential', 5],
    ['Python',               'essential', 4], ['Linux',            'essential', 5],
    ['GitHub Actions',       'essential', 4], ['Grafana',          'essential', 4],
    ['Prometheus',           'essential', 4], ['Helm',             'important', 3],
    ['Communication',        'important', 3], ['Problem Solving',  'essential', 4],
  ],
  'Platform Engineer': [
    ['Kubernetes',           'essential', 5], ['Terraform',        'essential', 5],
    ['AWS',                  'essential', 4], ['Python',           'essential', 4],
    ['Helm',                 'essential', 4], ['CI/CD',            'essential', 5],
    ['Linux',                'essential', 4], ['Docker',           'essential', 4],
    ['Grafana',              'essential', 3], ['Problem Solving',  'essential', 5],
    ['Communication',        'important', 3], ['Leadership',       'important', 3],
  ],
  'Cloud Architect': [
    ['AWS',                  'essential', 5], ['Microsoft Azure',  'important', 4],
    ['Google Cloud Platform','important', 4], ['Terraform',        'essential', 5],
    ['Kubernetes',           'essential', 5], ['Docker',           'important', 4],
    ['Risk Management',      'essential', 4], ['Communication',    'essential', 5],
    ['Stakeholder Management','essential', 5], ['Decision Making', 'essential', 5],
    ['Leadership',           'important', 4], ['Problem Solving',  'essential', 5],
  ],
  'Solutions Architect': [
    ['AWS',                  'essential', 5], ['Python',           'important', 3],
    ['Communication',        'essential', 5], ['Stakeholder Management','essential',5],
    ['Decision Making',      'essential', 4], ['Problem Solving',  'essential', 5],
    ['Risk Management',      'important', 4], ['Jira',             'optional',  3],
    ['Microsoft Azure',      'important', 4], ['Google Cloud Platform','optional',3],
  ],
  // ── Cybersecurity ─────────────────────────────────────────────────────────
  'Cybersecurity Analyst': [
    ['Penetration Testing',  'essential', 3], ['OWASP',            'essential', 3],
    ['Security Auditing',    'essential', 3], ['Incident Response','essential', 3],
    ['Linux',                'essential', 3], ['Python',           'important', 3],
    ['SQL',                  'important', 2], ['Communication',    'important', 3],
    ['Problem Solving',      'essential', 3], ['Critical Thinking','essential', 3],
  ],
  'Security Engineer': [
    ['Penetration Testing',  'essential', 4], ['OWASP',            'essential', 4],
    ['Security Auditing',    'essential', 4], ['Incident Response','essential', 4],
    ['Python',               'essential', 4], ['Linux',            'essential', 4],
    ['AWS',                  'important', 3], ['Docker',           'important', 3],
    ['Communication',        'essential', 4], ['Problem Solving',  'essential', 4],
    ['Risk Management',      'essential', 4],
  ],
  'Chief Information Security Officer': [
    ['Risk Management',      'essential', 5], ['Leadership',       'essential', 5],
    ['Stakeholder Management','essential', 5], ['Decision Making', 'essential', 5],
    ['Communication',        'essential', 5], ['Security Auditing','essential', 5],
    ['Incident Response',    'important', 5], ['Compliance',       'essential', 5],
    ['Financial Modelling',  'important', 3],
  ],
  // ── Agile ─────────────────────────────────────────────────────────────────
  'Scrum Master': [
    ['Scrum',                'essential', 4], ['Agile Methodology', 'essential', 4],
    ['Jira',                 'essential', 3], ['Communication',    'essential', 4],
    ['Leadership',           'important', 3], ['Stakeholder Management','important',3],
    ['Decision Making',      'important', 3], ['Coaching',         'essential', 4],
    ['Confluence',           'important', 3],
  ],
  'Agile Coach': [
    ['Agile Methodology',    'essential', 5], ['Scrum',            'essential', 5],
    ['Coaching',             'essential', 5], ['Communication',    'essential', 5],
    ['Leadership',           'essential', 5], ['Stakeholder Management','essential',4],
    ['Decision Making',      'important', 4], ['Training Design',  'important', 4],
    ['Problem Solving',      'essential', 5],
  ],
  // ── Business Analysis ─────────────────────────────────────────────────────
  'Business Analyst': [
    ['Business Analysis',    'essential', 3], ['SQL',              'important', 3],
    ['Excel',                'essential', 3], ['Communication',    'essential', 3],
    ['Stakeholder Management','essential', 3], ['Jira',            'important', 3],
    ['Confluence',           'important', 3], ['Problem Solving',  'essential', 3],
    ['Critical Thinking',    'essential', 3], ['Data Analysis',    'important', 3],
  ],
  'Senior Business Analyst': [
    ['Business Analysis',    'essential', 4], ['SQL',              'important', 4],
    ['Excel',                'essential', 4], ['Communication',    'essential', 4],
    ['Stakeholder Management','essential', 4], ['Leadership',      'important', 3],
    ['Risk Management',      'important', 3], ['Problem Solving',  'essential', 4],
    ['Critical Thinking',    'essential', 4], ['Data Analysis',    'important', 4],
    ['Power BI',             'optional',  3],
  ],
  // ── Operations ────────────────────────────────────────────────────────────
  'Operations Manager': [
    ['Operations Management','essential', 4], ['Process Improvement','essential', 4],
    ['Leadership',           'essential', 4], ['Communication',    'essential', 4],
    ['Stakeholder Management','essential', 4], ['Decision Making', 'essential', 4],
    ['Risk Management',      'important', 3], ['Excel',            'important', 3],
    ['Six Sigma',            'optional',  3], ['Problem Solving',  'essential', 4],
  ],
  'Chief Operating Officer': [
    ['Operations Management','essential', 5], ['Leadership',       'essential', 5],
    ['Financial Modelling',  'essential', 5], ['Decision Making',  'essential', 5],
    ['Risk Management',      'essential', 5], ['Stakeholder Management','essential',5],
    ['Communication',        'essential', 5], ['Process Improvement','important', 4],
    ['Problem Solving',      'essential', 5],
  ],
  // ── Digital Marketing ─────────────────────────────────────────────────────
  'Digital Marketing Manager': [
    ['SEO',                  'essential', 4], ['Google Analytics', 'essential', 4],
    ['HubSpot',              'important', 4], ['Marketing Automation','essential', 4],
    ['Communication',        'essential', 4], ['Data Analysis',    'important', 3],
    ['Content Strategy',     'important', 3], ['Excel',            'important', 3],
    ['Leadership',           'important', 3], ['Decision Making',  'important', 3],
  ],
  'Growth Manager': [
    ['SEO',                  'important', 3], ['Google Analytics', 'essential', 4],
    ['Data Analysis',        'essential', 4], ['Marketing Automation','important',3],
    ['Communication',        'essential', 4], ['Problem Solving',  'essential', 4],
    ['SQL',                  'important', 3], ['Excel',            'important', 3],
    ['Decision Making',      'important', 3], ['Critical Thinking','important', 3],
  ],
  'Content Strategist': [
    ['Content Strategy',     'essential', 4], ['Copywriting',      'essential', 4],
    ['SEO',                  'essential', 4], ['Communication',    'essential', 4],
    ['Data Analysis',        'optional',  2], ['Google Analytics', 'optional',  2],
    ['HubSpot',              'optional',  3], ['Problem Solving',  'important', 3],
    ['Critical Thinking',    'important', 3],
  ],
  // ── Finance (extended) ────────────────────────────────────────────────────
  'Financial Analyst': [
    ['Financial Modelling',  'essential', 3], ['Excel',            'essential', 4],
    ['SQL',                  'important', 3], ['Power BI',         'important', 3],
    ['Data Analysis',        'essential', 4], ['Communication',    'important', 3],
    ['Problem Solving',      'essential', 3], ['Critical Thinking','important', 3],
    ['SAP',                  'optional',  2],
  ],
  'FP&A Manager': [
    ['Financial Modelling',  'essential', 5], ['Excel',            'essential', 5],
    ['SQL',                  'important', 4], ['Power BI',         'essential', 4],
    ['Data Analysis',        'essential', 4], ['Communication',    'essential', 4],
    ['Leadership',           'important', 4], ['Stakeholder Management','essential',4],
    ['Decision Making',      'essential', 4], ['Risk Management',  'important', 3],
  ],
  // ── Legal ─────────────────────────────────────────────────────────────────
  'Legal Counsel': [
    ['Legal Research',       'essential', 4], ['Contract Management','essential', 4],
    ['Compliance',           'essential', 4], ['Communication',    'essential', 4],
    ['Critical Thinking',    'essential', 4], ['Risk Management',  'important', 3],
    ['Negotiation',          'important', 3], ['Stakeholder Management','important',3],
    ['Problem Solving',      'essential', 4],
  ],
  'General Counsel': [
    ['Legal Research',       'essential', 5], ['Contract Management','essential', 5],
    ['Compliance',           'essential', 5], ['Communication',    'essential', 5],
    ['Leadership',           'essential', 5], ['Risk Management',  'essential', 5],
    ['Negotiation',          'essential', 5], ['Stakeholder Management','essential',5],
    ['Decision Making',      'essential', 5],
  ],
  // ── Supply Chain ──────────────────────────────────────────────────────────
  'Supply Chain Manager': [
    ['Supply Chain Management','essential', 4], ['Vendor Management','essential', 4],
    ['Procurement',          'important', 3], ['Excel',            'essential', 3],
    ['Leadership',           'essential', 4], ['Communication',    'essential', 4],
    ['Risk Management',      'important', 3], ['Decision Making',  'important', 3],
    ['SAP',                  'important', 3], ['Problem Solving',  'essential', 4],
  ],
  'Procurement Manager': [
    ['Procurement',          'essential', 4], ['Vendor Management','essential', 4],
    ['Contract Management',  'important', 4], ['Negotiation',      'essential', 4],
    ['Excel',                'essential', 3], ['Communication',    'essential', 4],
    ['Risk Management',      'important', 3], ['SAP',              'important', 3],
    ['Stakeholder Management','important', 3], ['Decision Making', 'important', 3],
  ],
  // ── L&D ───────────────────────────────────────────────────────────────────
  'Learning & Development Manager': [
    ['Training Design',      'essential', 4], ['Coaching',         'essential', 4],
    ['Communication',        'essential', 5], ['Leadership',       'important', 4],
    ['Stakeholder Management','essential', 4], ['Decision Making', 'important', 3],
    ['Emotional Intelligence','essential', 4], ['Problem Solving', 'important', 3],
    ['Adaptability',         'important', 3],
  ],
  'Instructional Designer': [
    ['Training Design',      'essential', 4], ['Communication',    'essential', 4],
    ['Adaptability',         'important', 3], ['Problem Solving',  'important', 3],
    ['Time Management',      'important', 3], ['Critical Thinking','important', 3],
    ['Coaching',             'optional',  2],
  ],
  // ── Customer Success ──────────────────────────────────────────────────────
  'Customer Success Manager': [
    ['Communication',        'essential', 4], ['Salesforce CRM',   'important', 3],
    ['Stakeholder Management','essential', 4], ['Problem Solving',  'essential', 4],
    ['Emotional Intelligence','essential', 4], ['Data Analysis',   'optional',  2],
    ['Negotiation',          'important', 3], ['Critical Thinking','important', 3],
    ['HubSpot',              'optional',  3],
  ],
  'Head of Customer Success': [
    ['Communication',        'essential', 5], ['Leadership',       'essential', 5],
    ['Stakeholder Management','essential', 5], ['Decision Making', 'essential', 4],
    ['Emotional Intelligence','essential', 5], ['Salesforce CRM',  'important', 4],
    ['Risk Management',      'important', 3], ['Financial Modelling','optional', 3],
    ['Problem Solving',      'essential', 5],
  ],
};

// ── Career pathway edges ──────────────────────────────────────────────────────
interface PathwayEntry {
  from: string;
  to: string;
  type: 'progression' | 'lateral' | 'pivot' | 'specialisation';
  yearsMin: number;
  yearsMax: number;
  gaps?: string[];
}

const PATHWAYS: PathwayEntry[] = [
  // Engineering tracks
  { from: 'Intern',                   to: 'Software Engineer',          type: 'progression', yearsMin: 0, yearsMax: 1,  gaps: ['system design', 'ci/cd'] },
  { from: 'Intern',                   to: 'Data Analyst',               type: 'progression', yearsMin: 0, yearsMax: 1,  gaps: ['sql', 'data modelling'] },
  { from: 'Intern',                   to: 'UX Designer',                type: 'progression', yearsMin: 0, yearsMax: 1,  gaps: ['user research', 'figma'] },
  { from: 'Software Engineer',        to: 'Senior Software Engineer',   type: 'progression', yearsMin: 2, yearsMax: 4,  gaps: ['system design', 'architecture'] },
  { from: 'Software Engineer',        to: 'DevOps Engineer',            type: 'lateral',     yearsMin: 1, yearsMax: 3,  gaps: ['kubernetes', 'ci/cd', 'terraform'] },
  { from: 'Software Engineer',        to: 'Product Manager',            type: 'pivot',       yearsMin: 2, yearsMax: 4,  gaps: ['user research', 'product thinking'] },
  { from: 'Senior Software Engineer', to: 'Engineering Manager',        type: 'progression', yearsMin: 2, yearsMax: 4,  gaps: ['people management', 'planning'] },
  { from: 'Senior Software Engineer', to: 'Data Engineer',              type: 'lateral',     yearsMin: 1, yearsMax: 3,  gaps: ['apache kafka', 'dbt', 'airflow'] },
  { from: 'Senior Software Engineer', to: 'Solutions Architect',        type: 'progression', yearsMin: 3, yearsMax: 6,  gaps: ['cloud architecture', 'stakeholder management'] },
  { from: 'Senior Software Engineer', to: 'Security Engineer',          type: 'lateral',     yearsMin: 2, yearsMax: 4,  gaps: ['penetration testing', 'owasp', 'security auditing'] },
  { from: 'Engineering Manager',      to: 'Engineering Director',       type: 'progression', yearsMin: 3, yearsMax: 6,  gaps: ['executive presence', 'financial planning'] },
  { from: 'Engineering Manager',      to: 'Director of Product',        type: 'lateral',     yearsMin: 2, yearsMax: 5,  gaps: ['product management', 'user research'] },
  { from: 'Engineering Director',     to: 'VP Engineering',             type: 'progression', yearsMin: 2, yearsMax: 5,  gaps: ['org strategy', 'executive leadership'] },
  { from: 'VP Engineering',           to: 'Chief Technology Officer',   type: 'progression', yearsMin: 3, yearsMax: 6,  gaps: ['board communication', 'technology vision'] },
  // DevOps tracks
  { from: 'DevOps Engineer',          to: 'Senior DevOps Engineer',     type: 'progression', yearsMin: 2, yearsMax: 4,  gaps: ['helm', 'advanced kubernetes'] },
  { from: 'Senior DevOps Engineer',   to: 'Platform Engineer',          type: 'progression', yearsMin: 2, yearsMax: 4,  gaps: ['platform strategy', 'developer experience'] },
  { from: 'Senior DevOps Engineer',   to: 'Cloud Architect',            type: 'progression', yearsMin: 3, yearsMax: 6,  gaps: ['multi-cloud', 'architecture design'] },
  { from: 'Platform Engineer',        to: 'Cloud Architect',            type: 'progression', yearsMin: 2, yearsMax: 5,  gaps: ['stakeholder management', 'executive presence'] },
  { from: 'Solutions Architect',      to: 'Cloud Architect',            type: 'lateral',     yearsMin: 2, yearsMax: 4,  gaps: ['deep cloud expertise'] },
  // Security tracks
  { from: 'Cybersecurity Analyst',    to: 'Security Engineer',          type: 'progression', yearsMin: 2, yearsMax: 4,  gaps: ['python', 'cloud security'] },
  { from: 'Security Engineer',        to: 'Chief Information Security Officer', type: 'progression', yearsMin: 5, yearsMax: 10, gaps: ['executive leadership', 'compliance', 'board reporting'] },
  // UX tracks
  { from: 'UX Designer',              to: 'Senior UX Designer',         type: 'progression', yearsMin: 2, yearsMax: 4,  gaps: ['advanced user research', 'design systems'] },
  { from: 'Senior UX Designer',       to: 'UX Lead',                    type: 'progression', yearsMin: 2, yearsMax: 4,  gaps: ['team leadership', 'strategic design'] },
  { from: 'UX Lead',                  to: 'Head of Design',             type: 'progression', yearsMin: 2, yearsMax: 5,  gaps: ['c-level communication', 'business strategy'] },
  { from: 'UX Designer',              to: 'Product Manager',            type: 'pivot',       yearsMin: 2, yearsMax: 4,  gaps: ['product thinking', 'data analysis', 'agile'] },
  // Product tracks
  { from: 'Product Manager',          to: 'Senior Product Manager',     type: 'progression', yearsMin: 2, yearsMax: 4,  gaps: ['roadmapping', 'cross-functional leadership'] },
  { from: 'Senior Product Manager',   to: 'Director of Product',        type: 'progression', yearsMin: 2, yearsMax: 5,  gaps: ['portfolio management', 'executive stakeholders'] },
  { from: 'Director of Product',      to: 'Chief Product Officer',      type: 'progression', yearsMin: 3, yearsMax: 7,  gaps: ['c-level strategy', 'board reporting'] },
  // Data tracks
  { from: 'Data Analyst',             to: 'Data Scientist',             type: 'progression', yearsMin: 1, yearsMax: 3,  gaps: ['machine learning', 'statistics', 'python advanced'] },
  { from: 'Data Analyst',             to: 'Analytics Manager',          type: 'progression', yearsMin: 3, yearsMax: 6,  gaps: ['team leadership', 'stakeholder management'] },
  { from: 'Data Analyst',             to: 'Product Manager',            type: 'pivot',       yearsMin: 2, yearsMax: 4,  gaps: ['product thinking', 'user research'] },
  { from: 'Data Analyst',             to: 'Business Analyst',           type: 'lateral',     yearsMin: 1, yearsMax: 3,  gaps: ['requirements gathering', 'process modelling'] },
  { from: 'Data Scientist',           to: 'Senior Data Scientist',      type: 'progression', yearsMin: 2, yearsMax: 4,  gaps: ['production ml', 'mlops'] },
  { from: 'Data Scientist',           to: 'Data Engineer',              type: 'lateral',     yearsMin: 1, yearsMax: 3,  gaps: ['data pipelines', 'streaming'] },
  { from: 'Data Engineer',            to: 'Senior Data Scientist',      type: 'lateral',     yearsMin: 2, yearsMax: 4,  gaps: ['machine learning', 'modelling'] },
  { from: 'Senior Data Scientist',    to: 'Analytics Manager',          type: 'progression', yearsMin: 2, yearsMax: 5,  gaps: ['team leadership'] },
  { from: 'Analytics Manager',        to: 'Chief Technology Officer',   type: 'lateral',     yearsMin: 5, yearsMax: 10, gaps: ['engineering management', 'technology strategy'] },
  // BA tracks
  { from: 'Business Analyst',         to: 'Senior Business Analyst',    type: 'progression', yearsMin: 2, yearsMax: 4,  gaps: ['stakeholder management', 'advanced analysis'] },
  { from: 'Senior Business Analyst',  to: 'Product Manager',            type: 'pivot',       yearsMin: 2, yearsMax: 4,  gaps: ['product management', 'agile', 'roadmapping'] },
  { from: 'Senior Business Analyst',  to: 'Operations Manager',         type: 'pivot',       yearsMin: 2, yearsMax: 5,  gaps: ['operations management', 'process improvement'] },
  // Agile tracks
  { from: 'Scrum Master',             to: 'Agile Coach',                type: 'progression', yearsMin: 2, yearsMax: 4,  gaps: ['coaching certification', 'organizational change'] },
  { from: 'Scrum Master',             to: 'Product Manager',            type: 'pivot',       yearsMin: 2, yearsMax: 4,  gaps: ['product management', 'user research'] },
  // Marketing tracks
  { from: 'Marketing Manager',        to: 'Digital Marketing Manager',  type: 'lateral',     yearsMin: 1, yearsMax: 3,  gaps: ['seo', 'marketing automation', 'analytics'] },
  { from: 'Marketing Manager',        to: 'Chief Marketing Officer',    type: 'progression', yearsMin: 5, yearsMax: 10, gaps: ['executive leadership', 'brand strategy'] },
  { from: 'Digital Marketing Manager',to: 'Growth Manager',             type: 'lateral',     yearsMin: 1, yearsMax: 3,  gaps: ['growth hacking', 'product analytics'] },
  { from: 'Content Strategist',       to: 'Digital Marketing Manager',  type: 'progression', yearsMin: 2, yearsMax: 4,  gaps: ['team leadership', 'paid media'] },
  // Operations tracks
  { from: 'Operations Manager',       to: 'Chief Operating Officer',    type: 'progression', yearsMin: 5, yearsMax: 10, gaps: ['c-level strategy', 'p&l ownership', 'board reporting'] },
  // Finance tracks
  { from: 'Financial Analyst',        to: 'FP&A Manager',               type: 'progression', yearsMin: 3, yearsMax: 6,  gaps: ['team leadership', 'advanced modelling'] },
  { from: 'Financial Analyst',        to: 'Finance Manager',            type: 'progression', yearsMin: 3, yearsMax: 6,  gaps: ['team management', 'risk oversight'] },
  { from: 'FP&A Manager',             to: 'Finance Manager',            type: 'lateral',     yearsMin: 1, yearsMax: 3,  gaps: ['accounting', 'audit oversight'] },
  { from: 'Finance Manager',          to: 'Chief Financial Officer',    type: 'progression', yearsMin: 5, yearsMax: 10, gaps: ['executive strategy', 'board communication'] },
  // HR tracks
  { from: 'HR Business Partner',      to: 'Head of HR',                 type: 'progression', yearsMin: 3, yearsMax: 6,  gaps: ['hr strategy', 'talent management'] },
  { from: 'Head of HR',               to: 'Chief Human Resources Officer', type: 'progression', yearsMin: 3, yearsMax: 7, gaps: ['executive leadership', 'board reporting'] },
  { from: 'Learning & Development Manager', to: 'Head of HR',          type: 'lateral',     yearsMin: 3, yearsMax: 6,  gaps: ['hr generalist skills', 'talent acquisition'] },
  // Legal tracks
  { from: 'Legal Counsel',            to: 'General Counsel',            type: 'progression', yearsMin: 5, yearsMax: 10, gaps: ['executive presence', 'board reporting', 'leadership'] },
  // Supply Chain tracks
  { from: 'Procurement Manager',      to: 'Supply Chain Manager',       type: 'lateral',     yearsMin: 2, yearsMax: 5,  gaps: ['logistics', 'supply chain strategy'] },
  // Consulting tracks
  { from: 'Consultant',               to: 'Senior Consultant',          type: 'progression', yearsMin: 2, yearsMax: 4,  gaps: ['client leadership', 'engagement management'] },
  { from: 'Consultant',               to: 'Product Manager',            type: 'pivot',       yearsMin: 2, yearsMax: 4,  gaps: ['product management', 'agile', 'engineering basics'] },
  { from: 'Consultant',               to: 'Analytics Manager',          type: 'pivot',       yearsMin: 2, yearsMax: 4,  gaps: ['analytics tools', 'data storytelling'] },
  { from: 'Consultant',               to: 'Business Analyst',           type: 'lateral',     yearsMin: 1, yearsMax: 3,  gaps: ['systems thinking', 'requirements documentation'] },
  { from: 'Senior Consultant',        to: 'Principal Consultant',       type: 'progression', yearsMin: 2, yearsMax: 5,  gaps: ['business development', 'thought leadership'] },
  { from: 'Principal Consultant',     to: 'Partner',                    type: 'progression', yearsMin: 3, yearsMax: 8,  gaps: ['firm leadership', 'client origination'] },
  // Customer Success tracks
  { from: 'Sales Executive',          to: 'Customer Success Manager',   type: 'lateral',     yearsMin: 1, yearsMax: 3,  gaps: ['customer success methodology', 'retention strategy'] },
  { from: 'Customer Success Manager', to: 'Head of Customer Success',   type: 'progression', yearsMin: 3, yearsMax: 6,  gaps: ['team leadership', 'executive stakeholders'] },
  { from: 'Head of Customer Success', to: 'Chief Operating Officer',    type: 'lateral',     yearsMin: 5, yearsMax: 8,  gaps: ['operations management', 'financial strategy'] },
  // Sales tracks
  { from: 'Sales Executive',          to: 'Sales Manager',              type: 'progression', yearsMin: 2, yearsMax: 5,  gaps: ['team management', 'forecasting'] },
  { from: 'Sales Manager',            to: 'VP Sales',                   type: 'progression', yearsMin: 3, yearsMax: 6,  gaps: ['executive strategy', 'p&l management'] },
  // L&D tracks
  { from: 'Instructional Designer',   to: 'Learning & Development Manager', type: 'progression', yearsMin: 3, yearsMax: 6, gaps: ['team management', 'stakeholder management'] },
];

// ── New occupations + skills to insert (self-contained) ───────────────────────
// These are only inserted if they don't already exist.

const NEW_SKILLS: Array<{name: string; cat: string; demand: number; future: number}> = [
  // UX / Design
  { name: 'User Research',         cat: 'domain',    demand: 0.88, future: 0.90 },
  { name: 'User Experience Design',cat: 'domain',    demand: 0.90, future: 0.92 },
  { name: 'Prototyping',           cat: 'domain',    demand: 0.82, future: 0.85 },
  { name: 'Usability Testing',     cat: 'domain',    demand: 0.80, future: 0.85 },
  { name: 'Design Thinking',       cat: 'domain',    demand: 0.85, future: 0.90 },
  // DevOps
  { name: 'Ansible',               cat: 'technical', demand: 0.75, future: 0.75 },
  { name: 'CI/CD',                 cat: 'technical', demand: 0.90, future: 0.90 },
  { name: 'Grafana',               cat: 'tool',      demand: 0.78, future: 0.80 },
  { name: 'Prometheus',            cat: 'technical', demand: 0.75, future: 0.82 },
  { name: 'Helm',                  cat: 'technical', demand: 0.70, future: 0.80 },
  // Security
  { name: 'Penetration Testing',   cat: 'technical', demand: 0.85, future: 0.90 },
  { name: 'OWASP',                 cat: 'domain',    demand: 0.82, future: 0.88 },
  { name: 'Security Auditing',     cat: 'domain',    demand: 0.80, future: 0.85 },
  { name: 'Incident Response',     cat: 'domain',    demand: 0.82, future: 0.88 },
  { name: 'Compliance',            cat: 'domain',    demand: 0.80, future: 0.85 },
  // Operations
  { name: 'Operations Management', cat: 'domain',    demand: 0.80, future: 0.80 },
  { name: 'Process Improvement',   cat: 'domain',    demand: 0.78, future: 0.80 },
  { name: 'Six Sigma',             cat: 'domain',    demand: 0.65, future: 0.65 },
  // Marketing
  { name: 'SEO',                   cat: 'domain',    demand: 0.82, future: 0.80 },
  { name: 'Google Analytics',      cat: 'tool',      demand: 0.82, future: 0.80 },
  { name: 'Marketing Automation',  cat: 'domain',    demand: 0.80, future: 0.85 },
  { name: 'Content Strategy',      cat: 'domain',    demand: 0.78, future: 0.82 },
  { name: 'Copywriting',           cat: 'domain',    demand: 0.72, future: 0.70 },
  // Legal
  { name: 'Legal Research',        cat: 'domain',    demand: 0.75, future: 0.75 },
  { name: 'Contract Management',   cat: 'domain',    demand: 0.78, future: 0.78 },
  // Supply Chain
  { name: 'Supply Chain Management', cat: 'domain',  demand: 0.78, future: 0.80 },
  { name: 'Procurement',           cat: 'domain',    demand: 0.75, future: 0.78 },
  { name: 'Vendor Management',     cat: 'domain',    demand: 0.75, future: 0.78 },
  // L&D
  { name: 'Training Design',       cat: 'domain',    demand: 0.72, future: 0.78 },
  { name: 'Coaching',              cat: 'soft',      demand: 0.80, future: 0.88 },
  // Linux (already may exist, safe to double-insert)
  { name: 'Linux',                 cat: 'technical', demand: 0.85, future: 0.85 },
];

const NEW_OCCUPATIONS: Array<{title: string; family: string; level: string; weight: number}> = [
  // UX
  { title: 'UX Designer',            family: 'design',         level: 'mid',      weight: 0.55 },
  { title: 'Senior UX Designer',     family: 'design',         level: 'senior',   weight: 0.70 },
  { title: 'UX Lead',                family: 'design',         level: 'lead',     weight: 0.80 },
  { title: 'Head of Design',         family: 'design',         level: 'director', weight: 0.90 },
  // DevOps / Cloud
  { title: 'DevOps Engineer',        family: 'engineering',    level: 'mid',      weight: 0.60 },
  { title: 'Senior DevOps Engineer', family: 'engineering',    level: 'senior',   weight: 0.75 },
  { title: 'Platform Engineer',      family: 'engineering',    level: 'senior',   weight: 0.80 },
  { title: 'Cloud Architect',        family: 'engineering',    level: 'lead',     weight: 0.90 },
  { title: 'Solutions Architect',    family: 'engineering',    level: 'lead',     weight: 0.88 },
  // Security
  { title: 'Cybersecurity Analyst',  family: 'security',       level: 'mid',      weight: 0.60 },
  { title: 'Security Engineer',      family: 'security',       level: 'senior',   weight: 0.75 },
  { title: 'Chief Information Security Officer', family: 'security', level: 'c_suite', weight: 1.0 },
  // Agile
  { title: 'Scrum Master',           family: 'product',        level: 'mid',      weight: 0.60 },
  { title: 'Agile Coach',            family: 'product',        level: 'senior',   weight: 0.80 },
  // Business Analysis
  { title: 'Business Analyst',       family: 'consulting',     level: 'mid',      weight: 0.55 },
  { title: 'Senior Business Analyst',family: 'consulting',     level: 'senior',   weight: 0.70 },
  // Operations
  { title: 'Operations Manager',     family: 'operations',     level: 'manager',  weight: 0.80 },
  { title: 'Chief Operating Officer',family: 'operations',     level: 'c_suite',  weight: 1.0  },
  // Marketing (extended)
  { title: 'Digital Marketing Manager', family: 'marketing',   level: 'manager',  weight: 0.80 },
  { title: 'Growth Manager',         family: 'marketing',      level: 'manager',  weight: 0.80 },
  { title: 'Content Strategist',     family: 'marketing',      level: 'mid',      weight: 0.55 },
  // Finance (extended)
  { title: 'Financial Analyst',      family: 'finance',        level: 'mid',      weight: 0.55 },
  { title: 'FP&A Manager',           family: 'finance',        level: 'manager',  weight: 0.80 },
  // Legal
  { title: 'Legal Counsel',          family: 'legal',          level: 'senior',   weight: 0.75 },
  { title: 'General Counsel',        family: 'legal',          level: 'c_suite',  weight: 1.0  },
  // Supply Chain
  { title: 'Supply Chain Manager',   family: 'operations',     level: 'manager',  weight: 0.80 },
  { title: 'Procurement Manager',    family: 'operations',     level: 'manager',  weight: 0.80 },
  // L&D
  { title: 'Learning & Development Manager', family: 'hr',     level: 'manager',  weight: 0.75 },
  { title: 'Instructional Designer', family: 'hr',             level: 'mid',      weight: 0.55 },
  // Customer Success
  { title: 'Customer Success Manager', family: 'sales',        level: 'manager',  weight: 0.75 },
  { title: 'Head of Customer Success', family: 'sales',        level: 'director', weight: 0.90 },
];

// ── Idempotent seed function ──────────────────────────────────────────────────

export async function ensureOccupationGraphSeed(pool: Pool): Promise<{ skills: number; pathways: number; occupationsAdded: number; skillsAdded: number }> {
  let skillMappingsInserted = 0;
  let pathwaysInserted = 0;
  let occupationsAdded = 0;
  let skillsAdded = 0;

  // 0a. Insert new skills (ON CONFLICT DO NOTHING keeps it idempotent)
  for (const s of NEW_SKILLS) {
    try {
      const r = await pool.query(
        `INSERT INTO skills (canonical_name, skill_category, market_demand_score, future_relevance_score)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (canonical_name, skill_category) DO NOTHING`,
        [s.name, s.cat, s.demand, s.future],
      );
      skillsAdded += r.rowCount ?? 0;
    } catch { /* silently skip */ }
  }

  // 0b. Insert new occupations (ON CONFLICT (canonical_title) DO NOTHING)
  for (const o of NEW_OCCUPATIONS) {
    try {
      const r = await pool.query(
        `INSERT INTO occupations (canonical_title, role_family, seniority_level, seniority_weight)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (canonical_title) DO NOTHING`,
        [o.title, o.family, o.level, o.weight],
      );
      occupationsAdded += r.rowCount ?? 0;
    } catch { /* silently skip */ }
  }

  // 1. Seed occupation_skills
  for (const [occTitle, skillList] of Object.entries(OCCUPATION_SKILLS)) {
    for (const [skillName, importance, proficiency] of skillList) {
      try {
        const r = await pool.query(
          `INSERT INTO occupation_skills
             (occupation_id, skill_id, importance, proficiency_level, weight, source, source_authority,
              evidence_ref, dataset_version)
           SELECT o.id, s.id, $3, $4, $5::numeric, 'curated', 'MetryxOne-P-R3A',
                  '{"source":"occupation-graph-seed","version":"p-r3a"}'::jsonb, 'p-r3a-2026'
             FROM occupations o, skills s
            WHERE o.canonical_title = $1 AND s.canonical_name = $2
           ON CONFLICT (occupation_id, skill_id) DO NOTHING`,
          [occTitle, skillName, importance, proficiency,
           importance === 'essential' ? 1.0 : importance === 'important' ? 0.7 : 0.4],
        );
        skillMappingsInserted += r.rowCount ?? 0;
      } catch { /* silently skip */ }
    }
  }

  // 2. Seed occupation_pathways
  for (const pw of PATHWAYS) {
    try {
      const r = await pool.query(
        `INSERT INTO occupation_pathways
           (from_occupation_id, to_occupation_id, transition_type,
            typical_years_min, typical_years_max, common_gaps,
            source_authority, evidence_ref, is_active)
         SELECT f.id, t.id, $3, $4, $5, $6::jsonb, 'MetryxOne-P-R3A',
                '{"source":"occupation-graph-seed","version":"p-r3a"}'::jsonb, TRUE
           FROM occupations f, occupations t
          WHERE f.canonical_title = $1 AND t.canonical_title = $2
         ON CONFLICT DO NOTHING`,
        [pw.from, pw.to, pw.type, pw.yearsMin, pw.yearsMax, JSON.stringify(pw.gaps ?? [])],
      );
      pathwaysInserted += r.rowCount ?? 0;
    } catch { /* silently skip */ }
  }

  return {
    skills: skillMappingsInserted,
    pathways: pathwaysInserted,
    occupationsAdded,
    skillsAdded,
  };
}
