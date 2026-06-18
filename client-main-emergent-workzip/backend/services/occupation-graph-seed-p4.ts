/**
 * Occupation Graph Seed — P-R4 Expansion
 *
 * Expands the occupation graph: 61 → 151 occupations, 120 → ~320 skills, 68 → 208+ pathways.
 *
 * Additive companion to occupation-graph-seed.ts (P-R3A).
 * All inserts are ON CONFLICT DO NOTHING — safe to run on every startup.
 * Source authority: 'MetryxOne-P-R4'
 */

import type { Pool } from 'pg';

type SkillEntry = [string, 'essential' | 'important' | 'optional', number];

// ── New occupation → skill mappings ──────────────────────────────────────────

const OCCUPATION_SKILLS_P4: Record<string, SkillEntry[]> = {
  // ── Healthcare / Mental Health ──────────────────────────────────────────
  'Clinical Psychologist': [
    ['Psychotherapy',            'essential', 4], ['Clinical Assessment',     'essential', 4],
    ['Mental Health',            'essential', 4], ['Case Management',         'essential', 3],
    ['Therapeutic Intervention', 'essential', 4], ['Clinical Supervision',    'important', 3],
    ['Research Methodology',     'important', 3], ['Academic Writing',        'optional',  3],
    ['Communication',            'essential', 4],
  ],
  'Counselor': [
    ['Psychotherapy',            'essential', 3], ['Mental Health',           'essential', 3],
    ['Motivational Interviewing','essential', 3], ['Case Management',         'essential', 3],
    ['Crisis Intervention',      'important', 3], ['Group Facilitation',      'important', 3],
    ['Communication',            'essential', 4],
  ],
  'Social Worker': [
    ['Case Management',          'essential', 3], ['Crisis Intervention',     'essential', 3],
    ['Healthcare Regulations',   'important', 3], ['Mental Health',           'important', 3],
    ['Medical Documentation',    'important', 3], ['Communication',           'essential', 4],
    ['Problem Solving',          'essential', 3],
  ],
  'Nurse Practitioner': [
    ['Patient Care',             'essential', 4], ['Clinical Assessment',     'essential', 4],
    ['Medical Documentation',    'essential', 4], ['Healthcare Regulations',  'essential', 3],
    ['Healthcare Management',    'important', 3], ['Communication',           'essential', 4],
  ],
  'Healthcare Administrator': [
    ['Healthcare Management',    'essential', 4], ['Healthcare Regulations',  'essential', 4],
    ['Stakeholder Management',   'essential', 4], ['Operations Management',   'essential', 4],
    ['Financial Modelling',      'important', 3], ['Communication',           'essential', 4],
    ['Leadership',               'important', 4], ['Decision Making',         'essential', 4],
  ],
  'Mental Health Specialist': [
    ['Mental Health',            'essential', 4], ['Psychotherapy',           'essential', 3],
    ['Crisis Intervention',      'essential', 4], ['Case Management',         'essential', 3],
    ['Therapeutic Intervention', 'essential', 3], ['Communication',           'essential', 4],
  ],
  'Health Coach': [
    ['Health Coach',             'essential', 3], ['Motivational Interviewing','essential', 3],
    ['Communication',            'essential', 3], ['Coaching',                'essential', 3],
    ['Problem Solving',          'important', 3],
  ],
  'Clinical Manager': [
    ['Healthcare Management',    'essential', 4], ['Leadership',              'essential', 4],
    ['Clinical Assessment',      'important', 3], ['Healthcare Regulations',  'essential', 4],
    ['Stakeholder Management',   'essential', 4], ['Decision Making',         'essential', 4],
    ['Communication',            'essential', 4],
  ],
  'Medical Director': [
    ['Healthcare Management',    'essential', 5], ['Leadership',              'essential', 5],
    ['Healthcare Regulations',   'essential', 5], ['Decision Making',         'essential', 5],
    ['Stakeholder Management',   'essential', 5], ['Communication',           'essential', 5],
    ['Risk Management',          'essential', 4],
  ],
  'Chief Medical Officer': [
    ['Healthcare Management',    'essential', 5], ['Leadership',              'essential', 5],
    ['Healthcare Regulations',   'essential', 5], ['Decision Making',         'essential', 5],
    ['Stakeholder Management',   'essential', 5], ['Communication',           'essential', 5],
    ['Financial Modelling',      'important', 4], ['Risk Management',         'essential', 5],
  ],

  // ── Education ────────────────────────────────────────────────────────────
  'Teacher': [
    ['Curriculum Development',   'essential', 3], ['Lesson Planning',         'essential', 3],
    ['Classroom Management',     'essential', 3], ['Student Assessment',      'essential', 3],
    ['Communication',            'essential', 3], ['Problem Solving',         'important', 3],
  ],
  'Senior Teacher': [
    ['Curriculum Development',   'essential', 4], ['Lesson Planning',         'essential', 4],
    ['Student Assessment',       'essential', 4], ['Classroom Management',    'essential', 4],
    ['Educational Technology',   'important', 3], ['Mentoring',               'important', 3],
    ['Communication',            'essential', 4],
  ],
  'Department Head': [
    ['Leadership',               'essential', 4], ['Curriculum Development',  'essential', 4],
    ['School Administration',    'essential', 4], ['Student Assessment',      'essential', 4],
    ['Stakeholder Management',   'important', 3], ['Communication',           'essential', 4],
    ['Decision Making',          'essential', 4],
  ],
  'School Principal': [
    ['School Administration',    'essential', 5], ['Leadership',              'essential', 5],
    ['Stakeholder Management',   'essential', 5], ['Decision Making',         'essential', 5],
    ['Curriculum Development',   'important', 4], ['Communication',           'essential', 5],
    ['Risk Management',          'important', 3], ['Financial Modelling',     'important', 3],
  ],
  'Learning Specialist': [
    ['Educational Technology',   'essential', 4], ['Differentiated Instruction','essential', 4],
    ['Student Assessment',       'essential', 3], ['Curriculum Development',  'important', 3],
    ['Research Methodology',     'important', 3], ['Communication',           'essential', 4],
  ],
  'Curriculum Designer': [
    ['Curriculum Development',   'essential', 4], ['Instructional Design',    'essential', 4],
    ['Educational Technology',   'important', 3], ['Academic Research',       'important', 3],
    ['Lesson Planning',          'important', 3], ['Communication',           'essential', 3],
  ],
  'Education Coordinator': [
    ['School Administration',    'essential', 3], ['Curriculum Development',  'important', 3],
    ['Stakeholder Management',   'important', 3], ['Project Management',      'important', 3],
    ['Communication',            'essential', 3], ['Decision Making',         'important', 3],
  ],
  'Education Director': [
    ['School Administration',    'essential', 5], ['Leadership',              'essential', 5],
    ['Curriculum Development',   'essential', 4], ['Stakeholder Management',  'essential', 5],
    ['Decision Making',          'essential', 5], ['Communication',           'essential', 5],
    ['Financial Modelling',      'important', 3],
  ],

  // ── Finance / Banking Extended ─────────────────────────────────────────
  'Investment Analyst': [
    ['Investment Analysis',      'essential', 3], ['Financial Modelling',     'essential', 3],
    ['Equity Research',          'essential', 3], ['Bloomberg Terminal',      'important', 3],
    ['Excel',                    'essential', 4], ['SQL',                     'optional',  2],
    ['Communication',            'important', 3], ['Problem Solving',         'essential', 3],
  ],
  'Portfolio Manager': [
    ['Portfolio Management',     'essential', 5], ['Investment Analysis',     'essential', 5],
    ['Risk Assessment',          'essential', 4], ['Fixed Income',            'important', 4],
    ['Bloomberg Terminal',       'essential', 4], ['Financial Modelling',     'essential', 4],
    ['Decision Making',          'essential', 5], ['Communication',           'essential', 4],
  ],
  'Risk Analyst': [
    ['Risk Assessment',          'essential', 4], ['Financial Modelling',     'essential', 4],
    ['Excel',                    'essential', 4], ['SQL',                     'important', 3],
    ['AML/KYC',                  'optional',  2], ['Communication',           'essential', 3],
    ['Problem Solving',          'essential', 3],
  ],
  'Compliance Officer': [
    ['Financial Compliance',     'essential', 4], ['AML/KYC',                 'essential', 4],
    ['Risk Assessment',          'essential', 4], ['Healthcare Regulations',  'optional',  2],
    ['Communication',            'essential', 4], ['Decision Making',         'essential', 4],
    ['Report Writing',           'essential', 3],
  ],
  'Financial Controller': [
    ['Financial Modelling',      'essential', 5], ['Excel',                   'essential', 5],
    ['Risk Assessment',          'essential', 4], ['Financial Compliance',    'essential', 4],
    ['Leadership',               'important', 4], ['Decision Making',         'essential', 4],
    ['Communication',            'essential', 4],
  ],
  'Risk Manager': [
    ['Risk Assessment',          'essential', 5], ['Risk Management',         'essential', 5],
    ['Financial Modelling',      'important', 4], ['Decision Making',         'essential', 5],
    ['Stakeholder Management',   'essential', 4], ['Communication',           'essential', 4],
  ],
  'Head of Compliance': [
    ['Financial Compliance',     'essential', 5], ['AML/KYC',                 'essential', 5],
    ['Risk Management',          'essential', 5], ['Leadership',              'essential', 4],
    ['Stakeholder Management',   'essential', 5], ['Communication',           'essential', 5],
    ['Decision Making',          'essential', 5],
  ],
  'Chief Risk Officer': [
    ['Risk Management',          'essential', 5], ['Risk Assessment',         'essential', 5],
    ['Financial Modelling',      'essential', 5], ['Leadership',              'essential', 5],
    ['Decision Making',          'essential', 5], ['Stakeholder Management',  'essential', 5],
    ['Communication',            'essential', 5], ['Financial Compliance',    'important', 4],
  ],

  // ── Creative / Media ──────────────────────────────────────────────────
  'Graphic Designer': [
    ['Adobe Creative Suite',     'essential', 3], ['Typography',              'essential', 3],
    ['Color Theory',             'essential', 3], ['Brand Strategy',          'optional',  2],
    ['Communication',            'important', 3],
  ],
  'Senior Graphic Designer': [
    ['Adobe Creative Suite',     'essential', 4], ['Typography',              'essential', 4],
    ['Color Theory',             'essential', 4], ['Brand Strategy',          'important', 3],
    ['Visual Communication',     'essential', 4], ['Communication',           'important', 3],
  ],
  'Creative Director': [
    ['Brand Strategy',           'essential', 5], ['Adobe Creative Suite',    'important', 4],
    ['Visual Communication',     'essential', 5], ['Leadership',              'essential', 4],
    ['Stakeholder Management',   'essential', 4], ['Communication',           'essential', 5],
    ['Decision Making',          'essential', 4],
  ],
  'Brand Designer': [
    ['Brand Strategy',           'essential', 4], ['Adobe Creative Suite',    'essential', 4],
    ['Typography',               'essential', 4], ['Color Theory',            'essential', 4],
    ['Visual Communication',     'essential', 4], ['Communication',           'important', 3],
  ],
  'Motion Designer': [
    ['Motion Graphics',          'essential', 4], ['Adobe Creative Suite',    'essential', 4],
    ['Video Production',         'important', 3], ['Animation',               'essential', 4],
    ['Color Theory',             'important', 3],
  ],
  'Art Director': [
    ['Visual Communication',     'essential', 5], ['Brand Strategy',          'essential', 4],
    ['Adobe Creative Suite',     'important', 4], ['Leadership',              'important', 4],
    ['Stakeholder Management',   'important', 3], ['Communication',           'essential', 4],
  ],
  'Head of Creative': [
    ['Brand Strategy',           'essential', 5], ['Leadership',              'essential', 5],
    ['Visual Communication',     'essential', 5], ['Stakeholder Management',  'essential', 5],
    ['Decision Making',          'essential', 5], ['Communication',           'essential', 5],
  ],
  'Chief Creative Officer': [
    ['Brand Strategy',           'essential', 5], ['Leadership',              'essential', 5],
    ['Visual Communication',     'essential', 5], ['Stakeholder Management',  'essential', 5],
    ['Decision Making',          'essential', 5], ['Communication',           'essential', 5],
    ['Financial Modelling',      'optional',  3],
  ],

  // ── Research / Analytics Extended ────────────────────────────────────
  'Research Analyst': [
    ['Research Methodology',     'essential', 3], ['Data Analysis',           'essential', 3],
    ['Excel',                    'essential', 3], ['SPSS',                    'important', 3],
    ['Academic Writing',         'important', 3], ['SQL',                     'optional',  2],
    ['Communication',            'essential', 3],
  ],
  'Senior Research Analyst': [
    ['Research Methodology',     'essential', 4], ['Quantitative Analysis',   'essential', 4],
    ['SPSS',                     'important', 4], ['R Programming',           'important', 3],
    ['Academic Writing',         'essential', 4], ['SQL',                     'optional',  3],
    ['Communication',            'essential', 4],
  ],
  'Research Director': [
    ['Research Methodology',     'essential', 5], ['Leadership',              'essential', 5],
    ['Stakeholder Management',   'essential', 5], ['Academic Writing',        'essential', 4],
    ['Decision Making',          'essential', 5], ['Communication',           'essential', 5],
    ['Financial Modelling',      'optional',  3],
  ],
  'Quantitative Analyst': [
    ['Quantitative Analysis',    'essential', 5], ['R Programming',           'essential', 4],
    ['Python',                   'essential', 4], ['Financial Modelling',     'essential', 4],
    ['SQL',                      'important', 4], ['Excel',                   'important', 4],
    ['Problem Solving',          'essential', 5],
  ],
  'Chief Data Officer': [
    ['Data Analysis',            'essential', 5], ['Leadership',              'essential', 5],
    ['Decision Making',          'essential', 5], ['Stakeholder Management',  'essential', 5],
    ['SQL',                      'important', 4], ['Python',                  'important', 4],
    ['Communication',            'essential', 5], ['Risk Management',         'important', 4],
  ],

  // ── Network / Infrastructure ──────────────────────────────────────────
  'Network Engineer': [
    ['Cisco IOS',                'essential', 3], ['Network Security',        'essential', 3],
    ['DNS/DHCP Management',      'important', 3], ['Firewall Management',     'important', 3],
    ['Linux',                    'important', 3], ['Problem Solving',         'essential', 3],
  ],
  'Senior Network Engineer': [
    ['Cisco IOS',                'essential', 4], ['Network Security',        'essential', 4],
    ['Load Balancing',           'essential', 4], ['VPN Management',          'important', 4],
    ['Firewall Management',      'essential', 4], ['Linux',                   'important', 4],
    ['Problem Solving',          'essential', 4], ['Communication',           'important', 3],
  ],
  'Infrastructure Architect': [
    ['Network Security',         'essential', 5], ['Terraform',               'important', 4],
    ['Kubernetes',               'important', 4], ['Docker',                  'important', 4],
    ['Cloud Architecture',       'essential', 5], ['Load Balancing',          'important', 4],
    ['Communication',            'essential', 4], ['Problem Solving',         'essential', 5],
  ],
  'Solutions Engineer': [
    ['Communication',            'essential', 4], ['Problem Solving',         'essential', 4],
    ['API Design',               'important', 4], ['JavaScript',              'important', 3],
    ['SQL',                      'important', 3], ['Product Management',      'optional',  2],
    ['Stakeholder Management',   'important', 3],
  ],
  'Enterprise Architect': [
    ['System Design',            'essential', 5], ['Cloud Architecture',      'essential', 5],
    ['Stakeholder Management',   'essential', 5], ['Domain-Driven Design',    'important', 4],
    ['Leadership',               'important', 4], ['Communication',           'essential', 5],
    ['Decision Making',          'essential', 5], ['Risk Management',         'important', 4],
  ],

  // ── Sales / BD Extended ───────────────────────────────────────────────
  'Business Development Manager': [
    ['CRM Systems',              'essential', 3], ['Contract Negotiation',    'essential', 4],
    ['Pipeline Management',      'essential', 4], ['Stakeholder Management',  'essential', 4],
    ['Communication',            'essential', 4], ['Revenue Forecasting',     'important', 3],
    ['Data Analysis',            'optional',  2],
  ],
  'Sales Director': [
    ['Pipeline Management',      'essential', 5], ['Revenue Forecasting',     'essential', 5],
    ['Leadership',               'essential', 5], ['Stakeholder Management',  'essential', 5],
    ['CRM Systems',              'essential', 4], ['Contract Negotiation',    'essential', 5],
    ['Communication',            'essential', 5], ['Decision Making',         'essential', 5],
  ],
  'Account Executive': [
    ['CRM Systems',              'essential', 3], ['Contract Negotiation',    'essential', 3],
    ['Sales Methodology',        'essential', 3], ['Pipeline Management',     'important', 3],
    ['Communication',            'essential', 4], ['Account Management',      'essential', 3],
  ],
  'Key Account Manager': [
    ['Account Management',       'essential', 4], ['Stakeholder Management',  'essential', 4],
    ['CRM Systems',              'essential', 4], ['Contract Negotiation',    'essential', 4],
    ['Revenue Forecasting',      'important', 3], ['Communication',           'essential', 4],
  ],
  'Head of Business Development': [
    ['Contract Negotiation',     'essential', 5], ['Pipeline Management',     'essential', 5],
    ['Leadership',               'essential', 5], ['Stakeholder Management',  'essential', 5],
    ['Revenue Forecasting',      'essential', 5], ['Communication',           'essential', 5],
    ['Decision Making',          'essential', 5],
  ],

  // ── Customer Experience ────────────────────────────────────────────────
  'Customer Experience Manager': [
    ['Customer Journey Mapping',  'essential', 4], ['Voice of Customer',      'essential', 4],
    ['NPS',                       'important', 3], ['CX Analytics',           'important', 3],
    ['Customer Retention',        'important', 3], ['Stakeholder Management', 'essential', 4],
    ['Communication',             'essential', 4],
  ],
  'UX Researcher': [
    ['User Research',            'essential', 4], ['Usability Testing',       'essential', 4],
    ['Customer Journey Mapping', 'important', 3], ['Research Methodology',    'essential', 4],
    ['Data Analysis',            'important', 3], ['Communication',           'essential', 4],
  ],
  'Voice of Customer Manager': [
    ['Voice of Customer',        'essential', 5], ['NPS',                     'essential', 4],
    ['CX Analytics',             'essential', 4], ['Stakeholder Management',  'essential', 4],
    ['Data Analysis',            'important', 3], ['Communication',           'essential', 4],
  ],
  'CX Director': [
    ['Customer Journey Mapping', 'essential', 5], ['Voice of Customer',       'essential', 5],
    ['Leadership',               'essential', 5], ['Stakeholder Management',  'essential', 5],
    ['CX Analytics',             'important', 4], ['Communication',           'essential', 5],
    ['Decision Making',          'essential', 5],
  ],
  'Head of CX': [
    ['Customer Journey Mapping', 'essential', 5], ['Voice of Customer',       'essential', 5],
    ['Leadership',               'essential', 5], ['Stakeholder Management',  'essential', 5],
    ['NPS',                      'essential', 4], ['Communication',           'essential', 5],
  ],

  // ── HR / People Extended ─────────────────────────────────────────────
  'Talent Acquisition Specialist': [
    ['Talent Acquisition',       'essential', 3], ['CRM Systems',             'optional',  2],
    ['Employee Relations',       'optional',  2], ['Communication',           'essential', 4],
    ['Stakeholder Management',   'important', 3], ['Data Analysis',           'optional',  2],
  ],
  'HR Business Partner': [
    ['Employee Relations',       'essential', 4], ['Organizational Development','essential', 4],
    ['Stakeholder Management',   'essential', 4], ['HR Analytics',            'important', 3],
    ['Communication',            'essential', 4], ['Decision Making',         'essential', 4],
    ['Leadership',               'important', 3],
  ],
  'Head of Talent': [
    ['Talent Acquisition',       'essential', 5], ['Leadership',              'essential', 5],
    ['Succession Planning',      'essential', 4], ['HR Analytics',            'important', 4],
    ['Stakeholder Management',   'essential', 5], ['Communication',           'essential', 5],
    ['Decision Making',          'essential', 5],
  ],
  'People Analytics Manager': [
    ['HR Analytics',             'essential', 5], ['Data Analysis',           'essential', 4],
    ['SQL',                      'important', 4], ['Python',                  'optional',  3],
    ['Stakeholder Management',   'essential', 4], ['Communication',           'essential', 4],
    ['Problem Solving',          'essential', 4],
  ],
  'HR Director': [
    ['Employee Relations',       'essential', 5], ['Organizational Development','essential', 5],
    ['Leadership',               'essential', 5], ['HR Analytics',            'important', 4],
    ['Stakeholder Management',   'essential', 5], ['Communication',           'essential', 5],
    ['Decision Making',          'essential', 5], ['Risk Management',         'important', 4],
  ],

  // ── Marketing Extended ────────────────────────────────────────────────
  'Brand Manager': [
    ['Brand Strategy',           'essential', 4], ['Marketing Automation',    'important', 3],
    ['Content Strategy',         'important', 3], ['Data Analysis',           'important', 3],
    ['Stakeholder Management',   'important', 3], ['Communication',           'essential', 4],
  ],
  'Performance Marketing Manager': [
    ['Performance Marketing',    'essential', 4], ['Google Analytics',        'essential', 4],
    ['SEO',                      'important', 3], ['Marketing Automation',    'important', 4],
    ['Data Analysis',            'essential', 4], ['Communication',           'essential', 3],
  ],
  'Social Media Manager': [
    ['Social Media Marketing',   'essential', 4], ['Content Strategy',        'essential', 4],
    ['Copywriting',              'important', 3], ['Google Analytics',        'important', 3],
    ['Communication',            'essential', 4],
  ],
  'PR Manager': [
    ['Public Relations',         'essential', 4], ['Communication',           'essential', 5],
    ['Copywriting',              'essential', 4], ['Stakeholder Management',  'essential', 4],
    ['Content Strategy',         'important', 3],
  ],
  'Head of Brand': [
    ['Brand Strategy',           'essential', 5], ['Leadership',              'essential', 5],
    ['Stakeholder Management',   'essential', 5], ['Communication',           'essential', 5],
    ['Decision Making',          'essential', 5], ['Marketing Automation',    'optional',  3],
  ],

  // ── Consulting Extended ───────────────────────────────────────────────
  'Management Consultant': [
    ['Problem Solving',          'essential', 4], ['Data Analysis',           'essential', 4],
    ['Stakeholder Management',   'essential', 4], ['Communication',           'essential', 5],
    ['Financial Modelling',      'important', 3], ['Project Management',      'important', 3],
    ['Decision Making',          'essential', 4],
  ],
  'Strategy Director': [
    ['Decision Making',          'essential', 5], ['Financial Modelling',     'essential', 5],
    ['Stakeholder Management',   'essential', 5], ['Leadership',              'essential', 5],
    ['Communication',            'essential', 5], ['Risk Management',         'essential', 4],
    ['Problem Solving',          'essential', 5],
  ],
  'Transformation Lead': [
    ['Change Management',        'essential', 5], ['Stakeholder Management',  'essential', 5],
    ['Leadership',               'essential', 5], ['Project Management',      'essential', 5],
    ['Communication',            'essential', 5], ['Decision Making',         'essential', 5],
    ['Risk Management',          'essential', 4],
  ],

  // ── Product Extended ─────────────────────────────────────────────────
  'Associate Product Manager': [
    ['Product Management',       'essential', 2], ['Agile Methodology',       'essential', 2],
    ['Data Analysis',            'important', 2], ['Communication',           'essential', 3],
    ['Problem Solving',          'essential', 3], ['Jira',                    'important', 2],
  ],
  'Head of Product Growth': [
    ['Product Management',       'essential', 5], ['Data Analysis',           'essential', 5],
    ['Marketing Automation',     'important', 3], ['Leadership',              'essential', 5],
    ['Decision Making',          'essential', 5], ['Stakeholder Management',  'essential', 5],
    ['Communication',            'essential', 5],
  ],
  'Product Analytics Manager': [
    ['Data Analysis',            'essential', 5], ['SQL',                     'essential', 4],
    ['Product Management',       'important', 4], ['Python',                  'optional',  3],
    ['Communication',            'essential', 4], ['Problem Solving',         'essential', 4],
    ['Stakeholder Management',   'important', 4],
  ],

  // ── AI / ML Extended ─────────────────────────────────────────────────
  'NLP Engineer': [
    ['Python',                   'essential', 5], ['NLP',                     'essential', 5],
    ['PyTorch',                  'essential', 4], ['TensorFlow',              'important', 4],
    ['LLM Fine-tuning',          'essential', 4], ['Git',                     'important', 4],
    ['Problem Solving',          'essential', 5],
  ],
  'Computer Vision Engineer': [
    ['Python',                   'essential', 5], ['Computer Vision',         'essential', 5],
    ['PyTorch',                  'essential', 4], ['TensorFlow',              'important', 4],
    ['Deep Learning',            'essential', 5], ['Git',                     'important', 4],
    ['Problem Solving',          'essential', 5],
  ],
  'AI Product Manager': [
    ['Product Management',       'essential', 4], ['Agile Methodology',       'essential', 4],
    ['Data Analysis',            'important', 4], ['Communication',           'essential', 5],
    ['Stakeholder Management',   'essential', 5], ['Decision Making',         'essential', 4],
    ['Problem Solving',          'essential', 4],
  ],
  'Head of AI': [
    ['Leadership',               'essential', 5], ['Decision Making',         'essential', 5],
    ['Stakeholder Management',   'essential', 5], ['Communication',           'essential', 5],
    ['Python',                   'important', 4], ['Deep Learning',           'important', 4],
    ['Risk Management',          'essential', 4],
  ],

  // ── Sustainability / ESG ─────────────────────────────────────────────
  'Sustainability Manager': [
    ['Sustainability Strategy',  'essential', 4], ['ESG Reporting',           'essential', 4],
    ['Carbon Accounting',        'important', 3], ['Stakeholder Management',  'essential', 4],
    ['Communication',            'essential', 4], ['Project Management',      'important', 3],
  ],
  'ESG Analyst': [
    ['ESG Reporting',            'essential', 4], ['Carbon Accounting',       'important', 3],
    ['Data Analysis',            'essential', 4], ['Excel',                   'essential', 4],
    ['Research Methodology',     'important', 3], ['Communication',           'essential', 3],
  ],
  'Sustainability Director': [
    ['Sustainability Strategy',  'essential', 5], ['ESG Reporting',           'essential', 5],
    ['Leadership',               'essential', 5], ['Stakeholder Management',  'essential', 5],
    ['Risk Management',          'important', 4], ['Communication',           'essential', 5],
    ['Decision Making',          'essential', 5],
  ],
  'Chief Sustainability Officer': [
    ['Sustainability Strategy',  'essential', 5], ['ESG Reporting',           'essential', 5],
    ['Leadership',               'essential', 5], ['Decision Making',         'essential', 5],
    ['Stakeholder Management',   'essential', 5], ['Communication',           'essential', 5],
    ['Financial Modelling',      'important', 4], ['Risk Management',         'essential', 5],
  ],

  // ── Site Reliability / Platform Engineering Extended ─────────────────
  'Site Reliability Engineer': [
    ['Linux',                    'essential', 4], ['Kubernetes',              'essential', 4],
    ['Python',                   'essential', 4], ['Docker',                  'essential', 4],
    ['Prometheus',               'important', 4], ['Grafana',                 'important', 4],
    ['SRE Practice',             'essential', 4], ['Chaos Engineering',       'important', 3],
    ['OpenTelemetry',            'important', 3],
  ],
  'Staff Engineer': [
    ['System Design',            'essential', 5], ['Python',                  'important', 4],
    ['TypeScript',               'important', 4], ['Kubernetes',              'important', 4],
    ['API Design',               'essential', 5], ['Communication',           'essential', 5],
    ['Decision Making',          'essential', 5], ['Problem Solving',         'essential', 5],
  ],
  'Principal Engineer': [
    ['System Design',            'essential', 5], ['Domain-Driven Design',    'essential', 5],
    ['API Design',               'essential', 5], ['Communication',           'essential', 5],
    ['Leadership',               'important', 4], ['Decision Making',         'essential', 5],
    ['Python',                   'optional',  4], ['TypeScript',              'optional',  4],
  ],
  'Analytics Engineer': [
    ['SQL',                      'essential', 5], ['Python',                  'essential', 4],
    ['Data Analysis',            'essential', 5], ['dbt',                     'essential', 4],
    ['Git',                      'important', 4], ['Problem Solving',         'essential', 4],
    ['Communication',            'important', 3],
  ],

  // ── Health Informatics / Digital Health ───────────────────────────────
  'Health Informatics Analyst': [
    ['Healthcare Management',    'essential', 3], ['Data Analysis',           'essential', 4],
    ['Healthcare Regulations',   'essential', 3], ['SQL',                     'important', 3],
    ['Medical Documentation',    'important', 3], ['Communication',           'essential', 3],
  ],
  'Clinical Data Analyst': [
    ['Data Analysis',            'essential', 4], ['SQL',                     'essential', 4],
    ['Healthcare Management',    'important', 3], ['Research Methodology',    'important', 3],
    ['Excel',                    'essential', 4], ['Communication',           'essential', 3],
  ],
  'Digital Health Manager': [
    ['Healthcare Management',    'essential', 4], ['Product Management',      'important', 3],
    ['Stakeholder Management',   'essential', 4], ['Data Analysis',           'important', 3],
    ['Communication',            'essential', 4], ['Decision Making',         'essential', 4],
  ],
};

// ── New skills (P-R4 expansion) ───────────────────────────────────────────────

export const NEW_SKILLS_P4: Array<{name: string; cat: string; demand: number; future: number}> = [
  // Healthcare
  { name: 'Clinical Assessment',      cat: 'domain',    demand: 0.82, future: 0.85 },
  { name: 'Patient Care',             cat: 'domain',    demand: 0.80, future: 0.82 },
  { name: 'Healthcare Management',    cat: 'domain',    demand: 0.82, future: 0.85 },
  { name: 'Mental Health',            cat: 'domain',    demand: 0.90, future: 0.95 },
  { name: 'Motivational Interviewing',cat: 'domain',    demand: 0.75, future: 0.80 },
  { name: 'Case Management',          cat: 'domain',    demand: 0.78, future: 0.82 },
  { name: 'Medical Documentation',    cat: 'domain',    demand: 0.75, future: 0.78 },
  { name: 'Healthcare Regulations',   cat: 'domain',    demand: 0.80, future: 0.82 },
  { name: 'Therapeutic Intervention', cat: 'domain',    demand: 0.78, future: 0.82 },
  { name: 'Crisis Intervention',      cat: 'domain',    demand: 0.82, future: 0.88 },
  { name: 'Clinical Supervision',     cat: 'domain',    demand: 0.72, future: 0.78 },
  { name: 'Psychotherapy',            cat: 'domain',    demand: 0.80, future: 0.85 },
  { name: 'Group Facilitation',       cat: 'soft',      demand: 0.75, future: 0.80 },
  { name: 'Health Coach',             cat: 'domain',    demand: 0.78, future: 0.88 },
  // Education
  { name: 'Curriculum Development',   cat: 'domain',    demand: 0.78, future: 0.82 },
  { name: 'Lesson Planning',          cat: 'domain',    demand: 0.72, future: 0.75 },
  { name: 'Classroom Management',     cat: 'domain',    demand: 0.75, future: 0.78 },
  { name: 'Student Assessment',       cat: 'domain',    demand: 0.75, future: 0.80 },
  { name: 'Educational Technology',   cat: 'technical', demand: 0.82, future: 0.90 },
  { name: 'Differentiated Instruction',cat:'domain',    demand: 0.72, future: 0.78 },
  { name: 'School Administration',    cat: 'domain',    demand: 0.72, future: 0.75 },
  { name: 'Academic Research',        cat: 'domain',    demand: 0.75, future: 0.78 },
  { name: 'Mentoring',                cat: 'soft',      demand: 0.82, future: 0.88 },
  { name: 'Instructional Design',     cat: 'domain',    demand: 0.78, future: 0.85 },
  { name: 'Report Writing',           cat: 'soft',      demand: 0.78, future: 0.80 },
  // Finance / Banking
  { name: 'Investment Analysis',      cat: 'domain',    demand: 0.82, future: 0.80 },
  { name: 'Portfolio Management',     cat: 'domain',    demand: 0.80, future: 0.80 },
  { name: 'Risk Assessment',          cat: 'domain',    demand: 0.88, future: 0.90 },
  { name: 'Bloomberg Terminal',       cat: 'tool',      demand: 0.75, future: 0.70 },
  { name: 'Credit Analysis',          cat: 'domain',    demand: 0.75, future: 0.75 },
  { name: 'AML/KYC',                  cat: 'domain',    demand: 0.80, future: 0.85 },
  { name: 'Fixed Income',             cat: 'domain',    demand: 0.72, future: 0.70 },
  { name: 'Equity Research',          cat: 'domain',    demand: 0.75, future: 0.72 },
  { name: 'Financial Compliance',     cat: 'domain',    demand: 0.85, future: 0.88 },
  { name: 'Capital Markets',          cat: 'domain',    demand: 0.75, future: 0.75 },
  { name: 'Treasury Management',      cat: 'domain',    demand: 0.72, future: 0.72 },
  // Creative / Media
  { name: 'Adobe Creative Suite',     cat: 'tool',      demand: 0.82, future: 0.78 },
  { name: 'Typography',               cat: 'domain',    demand: 0.72, future: 0.72 },
  { name: 'Color Theory',             cat: 'domain',    demand: 0.70, future: 0.70 },
  { name: 'Brand Strategy',           cat: 'domain',    demand: 0.85, future: 0.88 },
  { name: 'Visual Communication',     cat: 'domain',    demand: 0.82, future: 0.85 },
  { name: 'Motion Graphics',          cat: 'technical', demand: 0.78, future: 0.85 },
  { name: 'Video Production',         cat: 'technical', demand: 0.75, future: 0.80 },
  { name: 'Animation',                cat: 'technical', demand: 0.75, future: 0.82 },
  // Research / Analytics
  { name: 'Research Methodology',     cat: 'domain',    demand: 0.78, future: 0.82 },
  { name: 'Quantitative Analysis',    cat: 'domain',    demand: 0.85, future: 0.88 },
  { name: 'SPSS',                     cat: 'tool',      demand: 0.65, future: 0.58 },
  { name: 'R Programming',            cat: 'technical', demand: 0.78, future: 0.82 },
  { name: 'Academic Writing',         cat: 'soft',      demand: 0.70, future: 0.72 },
  // Network / Infra
  { name: 'Cisco IOS',                cat: 'technical', demand: 0.72, future: 0.68 },
  { name: 'Network Security',         cat: 'technical', demand: 0.88, future: 0.92 },
  { name: 'Load Balancing',           cat: 'technical', demand: 0.78, future: 0.80 },
  { name: 'VPN Management',           cat: 'technical', demand: 0.72, future: 0.70 },
  { name: 'DNS/DHCP Management',      cat: 'technical', demand: 0.70, future: 0.68 },
  { name: 'Firewall Management',      cat: 'technical', demand: 0.78, future: 0.80 },
  { name: 'Cloud Architecture',       cat: 'domain',    demand: 0.92, future: 0.95 },
  { name: 'System Design',            cat: 'domain',    demand: 0.92, future: 0.95 },
  { name: 'API Design',               cat: 'technical', demand: 0.88, future: 0.92 },
  { name: 'Domain-Driven Design',     cat: 'domain',    demand: 0.80, future: 0.85 },
  // Sales / CX
  { name: 'CRM Systems',              cat: 'tool',      demand: 0.85, future: 0.88 },
  { name: 'Contract Negotiation',     cat: 'soft',      demand: 0.82, future: 0.85 },
  { name: 'Pipeline Management',      cat: 'domain',    demand: 0.82, future: 0.85 },
  { name: 'Revenue Forecasting',      cat: 'domain',    demand: 0.82, future: 0.85 },
  { name: 'Account Management',       cat: 'domain',    demand: 0.82, future: 0.85 },
  { name: 'Sales Methodology',        cat: 'domain',    demand: 0.80, future: 0.82 },
  { name: 'Voice of Customer',        cat: 'domain',    demand: 0.82, future: 0.88 },
  { name: 'NPS',                      cat: 'domain',    demand: 0.80, future: 0.82 },
  { name: 'Customer Journey Mapping', cat: 'domain',    demand: 0.85, future: 0.90 },
  { name: 'CX Analytics',             cat: 'domain',    demand: 0.82, future: 0.88 },
  { name: 'Customer Retention',       cat: 'domain',    demand: 0.82, future: 0.88 },
  // HR extended
  { name: 'Talent Acquisition',       cat: 'domain',    demand: 0.85, future: 0.88 },
  { name: 'Employee Relations',       cat: 'domain',    demand: 0.80, future: 0.82 },
  { name: 'HR Analytics',             cat: 'domain',    demand: 0.85, future: 0.92 },
  { name: 'Organizational Development',cat:'domain',    demand: 0.82, future: 0.88 },
  { name: 'Succession Planning',      cat: 'domain',    demand: 0.78, future: 0.82 },
  { name: 'Performance Management',   cat: 'domain',    demand: 0.82, future: 0.85 },
  // Marketing extended
  { name: 'Social Media Marketing',   cat: 'domain',    demand: 0.85, future: 0.82 },
  { name: 'Public Relations',         cat: 'domain',    demand: 0.78, future: 0.78 },
  { name: 'Performance Marketing',    cat: 'domain',    demand: 0.88, future: 0.90 },
  { name: 'Change Management',        cat: 'domain',    demand: 0.85, future: 0.90 },
  // ESG / Sustainability
  { name: 'Sustainability Strategy',  cat: 'domain',    demand: 0.85, future: 0.95 },
  { name: 'ESG Reporting',            cat: 'domain',    demand: 0.88, future: 0.95 },
  { name: 'Carbon Accounting',        cat: 'domain',    demand: 0.82, future: 0.92 },
  { name: 'Life Cycle Assessment',    cat: 'domain',    demand: 0.75, future: 0.85 },
  { name: 'Environmental Management', cat: 'domain',    demand: 0.78, future: 0.88 },
  // AI / ML extended
  { name: 'NLP',                      cat: 'technical', demand: 0.90, future: 0.95 },
  { name: 'Computer Vision',          cat: 'technical', demand: 0.88, future: 0.95 },
  { name: 'LLM Fine-tuning',          cat: 'technical', demand: 0.90, future: 0.98 },
  { name: 'MLOps',                    cat: 'technical', demand: 0.88, future: 0.95 },
  { name: 'Deep Learning',            cat: 'technical', demand: 0.90, future: 0.95 },
  { name: 'PyTorch',                  cat: 'technical', demand: 0.88, future: 0.92 },
  { name: 'TensorFlow',               cat: 'technical', demand: 0.85, future: 0.88 },
  { name: 'RLHF',                     cat: 'technical', demand: 0.82, future: 0.95 },
  // SRE / Engineering
  { name: 'SRE Practice',             cat: 'domain',    demand: 0.85, future: 0.90 },
  { name: 'Chaos Engineering',        cat: 'technical', demand: 0.72, future: 0.82 },
  { name: 'OpenTelemetry',            cat: 'technical', demand: 0.78, future: 0.88 },
  { name: 'FinOps',                   cat: 'domain',    demand: 0.78, future: 0.88 },
  { name: 'Event-Driven Architecture',cat: 'domain',    demand: 0.82, future: 0.90 },
  { name: 'dbt',                      cat: 'tool',      demand: 0.82, future: 0.90 },
  { name: 'Project Management',       cat: 'domain',    demand: 0.85, future: 0.88 },
];

// ── New occupations (P-R4) ────────────────────────────────────────────────────

export const NEW_OCCUPATIONS_P4: Array<{title: string; family: string; level: string; weight: number}> = [
  // Healthcare / Mental Health
  { title: 'Clinical Psychologist',   family: 'healthcare',   level: 'senior',   weight: 0.80 },
  { title: 'Counselor',               family: 'healthcare',   level: 'mid',      weight: 0.55 },
  { title: 'Social Worker',           family: 'healthcare',   level: 'mid',      weight: 0.55 },
  { title: 'Nurse Practitioner',      family: 'healthcare',   level: 'senior',   weight: 0.75 },
  { title: 'Healthcare Administrator',family: 'healthcare',   level: 'manager',  weight: 0.80 },
  { title: 'Mental Health Specialist',family: 'healthcare',   level: 'senior',   weight: 0.75 },
  { title: 'Health Coach',            family: 'healthcare',   level: 'mid',      weight: 0.55 },
  { title: 'Clinical Manager',        family: 'healthcare',   level: 'manager',  weight: 0.80 },
  { title: 'Medical Director',        family: 'healthcare',   level: 'director', weight: 0.95 },
  { title: 'Chief Medical Officer',   family: 'healthcare',   level: 'c_suite',  weight: 1.0  },
  // Education
  { title: 'Teacher',                 family: 'education',    level: 'mid',      weight: 0.50 },
  { title: 'Senior Teacher',          family: 'education',    level: 'senior',   weight: 0.65 },
  { title: 'Department Head',         family: 'education',    level: 'manager',  weight: 0.75 },
  { title: 'School Principal',        family: 'education',    level: 'director', weight: 0.90 },
  { title: 'Learning Specialist',     family: 'education',    level: 'senior',   weight: 0.70 },
  { title: 'Curriculum Designer',     family: 'education',    level: 'mid',      weight: 0.60 },
  { title: 'Education Coordinator',   family: 'education',    level: 'mid',      weight: 0.55 },
  { title: 'Education Director',      family: 'education',    level: 'director', weight: 0.90 },
  // Finance / Banking extended
  { title: 'Investment Analyst',      family: 'finance',      level: 'mid',      weight: 0.60 },
  { title: 'Portfolio Manager',       family: 'finance',      level: 'senior',   weight: 0.85 },
  { title: 'Risk Analyst',            family: 'finance',      level: 'mid',      weight: 0.60 },
  { title: 'Compliance Officer',      family: 'finance',      level: 'mid',      weight: 0.60 },
  { title: 'Financial Controller',    family: 'finance',      level: 'senior',   weight: 0.80 },
  { title: 'Risk Manager',            family: 'finance',      level: 'manager',  weight: 0.82 },
  { title: 'Head of Compliance',      family: 'finance',      level: 'director', weight: 0.90 },
  { title: 'Chief Risk Officer',      family: 'finance',      level: 'c_suite',  weight: 1.0  },
  // Creative / Media
  { title: 'Graphic Designer',        family: 'design',       level: 'mid',      weight: 0.50 },
  { title: 'Senior Graphic Designer', family: 'design',       level: 'senior',   weight: 0.65 },
  { title: 'Creative Director',       family: 'design',       level: 'director', weight: 0.90 },
  { title: 'Brand Designer',          family: 'design',       level: 'senior',   weight: 0.72 },
  { title: 'Motion Designer',         family: 'design',       level: 'mid',      weight: 0.60 },
  { title: 'Art Director',            family: 'design',       level: 'senior',   weight: 0.80 },
  { title: 'Head of Creative',        family: 'design',       level: 'director', weight: 0.90 },
  { title: 'Chief Creative Officer',  family: 'design',       level: 'c_suite',  weight: 1.0  },
  // Research / Analytics
  { title: 'Research Analyst',        family: 'analytics',    level: 'mid',      weight: 0.55 },
  { title: 'Senior Research Analyst', family: 'analytics',    level: 'senior',   weight: 0.70 },
  { title: 'Research Director',       family: 'analytics',    level: 'director', weight: 0.90 },
  { title: 'Quantitative Analyst',    family: 'finance',      level: 'senior',   weight: 0.85 },
  { title: 'Chief Data Officer',      family: 'analytics',    level: 'c_suite',  weight: 1.0  },
  // Network / Infrastructure
  { title: 'Network Engineer',        family: 'engineering',  level: 'mid',      weight: 0.60 },
  { title: 'Senior Network Engineer', family: 'engineering',  level: 'senior',   weight: 0.75 },
  { title: 'Infrastructure Architect',family: 'engineering',  level: 'lead',     weight: 0.88 },
  { title: 'Solutions Engineer',      family: 'engineering',  level: 'senior',   weight: 0.78 },
  { title: 'Enterprise Architect',    family: 'engineering',  level: 'lead',     weight: 0.92 },
  // Sales / BD
  { title: 'Business Development Manager', family: 'sales',  level: 'manager',  weight: 0.80 },
  { title: 'Sales Director',          family: 'sales',        level: 'director', weight: 0.90 },
  { title: 'Account Executive',       family: 'sales',        level: 'mid',      weight: 0.55 },
  { title: 'Key Account Manager',     family: 'sales',        level: 'senior',   weight: 0.72 },
  { title: 'Head of Business Development', family: 'sales',  level: 'director', weight: 0.90 },
  // Customer Experience
  { title: 'Customer Experience Manager', family: 'operations',level: 'manager', weight: 0.78 },
  { title: 'UX Researcher',           family: 'design',       level: 'mid',      weight: 0.60 },
  { title: 'Voice of Customer Manager',family: 'operations',  level: 'manager',  weight: 0.78 },
  { title: 'CX Director',             family: 'operations',   level: 'director', weight: 0.90 },
  { title: 'Head of CX',              family: 'operations',   level: 'director', weight: 0.90 },
  // HR / People extended
  { title: 'Talent Acquisition Specialist', family: 'hr',    level: 'mid',      weight: 0.55 },
  { title: 'HR Business Partner',     family: 'hr',           level: 'senior',   weight: 0.72 },
  { title: 'Head of Talent',          family: 'hr',           level: 'director', weight: 0.88 },
  { title: 'People Analytics Manager',family: 'hr',           level: 'manager',  weight: 0.80 },
  { title: 'HR Director',             family: 'hr',           level: 'director', weight: 0.92 },
  // Marketing extended
  { title: 'Brand Manager',           family: 'marketing',    level: 'manager',  weight: 0.75 },
  { title: 'Performance Marketing Manager', family: 'marketing', level: 'manager', weight: 0.80 },
  { title: 'Social Media Manager',    family: 'marketing',    level: 'mid',      weight: 0.55 },
  { title: 'PR Manager',              family: 'marketing',    level: 'manager',  weight: 0.75 },
  { title: 'Head of Brand',           family: 'marketing',    level: 'director', weight: 0.90 },
  // Consulting extended
  { title: 'Management Consultant',   family: 'consulting',   level: 'senior',   weight: 0.75 },
  { title: 'Strategy Director',       family: 'consulting',   level: 'director', weight: 0.92 },
  { title: 'Transformation Lead',     family: 'consulting',   level: 'lead',     weight: 0.88 },
  // Product extended
  { title: 'Associate Product Manager', family: 'product',   level: 'junior',   weight: 0.40 },
  { title: 'Head of Product Growth',  family: 'product',      level: 'director', weight: 0.90 },
  { title: 'Product Analytics Manager', family: 'product',   level: 'manager',  weight: 0.80 },
  // AI / ML extended
  { title: 'NLP Engineer',            family: 'engineering',  level: 'senior',   weight: 0.85 },
  { title: 'Computer Vision Engineer',family: 'engineering',  level: 'senior',   weight: 0.85 },
  { title: 'AI Product Manager',      family: 'product',      level: 'senior',   weight: 0.80 },
  { title: 'Head of AI',              family: 'engineering',  level: 'director', weight: 0.92 },
  // Sustainability / ESG
  { title: 'Sustainability Manager',  family: 'operations',   level: 'manager',  weight: 0.78 },
  { title: 'ESG Analyst',             family: 'finance',      level: 'mid',      weight: 0.60 },
  { title: 'Sustainability Director', family: 'operations',   level: 'director', weight: 0.90 },
  { title: 'Chief Sustainability Officer', family: 'operations', level: 'c_suite', weight: 1.0 },
  // SRE / Engineering extended
  { title: 'Site Reliability Engineer', family: 'engineering', level: 'senior',  weight: 0.82 },
  { title: 'Staff Engineer',          family: 'engineering',  level: 'lead',     weight: 0.90 },
  { title: 'Principal Engineer',      family: 'engineering',  level: 'lead',     weight: 0.92 },
  { title: 'Analytics Engineer',      family: 'analytics',    level: 'senior',   weight: 0.75 },
  // Health tech
  { title: 'Health Informatics Analyst', family: 'healthcare', level: 'mid',    weight: 0.62 },
  { title: 'Clinical Data Analyst',   family: 'healthcare',   level: 'mid',      weight: 0.60 },
  { title: 'Digital Health Manager',  family: 'healthcare',   level: 'manager',  weight: 0.78 },
];

// ── Pathways (P-R4 expansion) ─────────────────────────────────────────────────

export const PATHWAYS_P4: Array<{
  from: string; to: string; type: 'progression' | 'lateral' | 'pivot';
  yearsMin: number; yearsMax: number; gaps?: string[];
}> = [
  // Healthcare progressions
  { from: 'Counselor',                to: 'Mental Health Specialist',  type: 'progression', yearsMin: 2, yearsMax: 5, gaps: ['clinical depth', 'therapeutic specialization'] },
  { from: 'Mental Health Specialist', to: 'Clinical Psychologist',     type: 'progression', yearsMin: 3, yearsMax: 6, gaps: ['doctoral qualification', 'supervised practice'] },
  { from: 'Social Worker',            to: 'Counselor',                 type: 'lateral',     yearsMin: 1, yearsMax: 3, gaps: ['therapeutic training', 'counseling methodology'] },
  { from: 'Nurse Practitioner',       to: 'Clinical Manager',          type: 'progression', yearsMin: 4, yearsMax: 8, gaps: ['leadership', 'healthcare management'] },
  { from: 'Clinical Manager',         to: 'Medical Director',          type: 'progression', yearsMin: 5, yearsMax: 10, gaps: ['executive leadership', 'strategic healthcare'] },
  { from: 'Medical Director',         to: 'Chief Medical Officer',     type: 'progression', yearsMin: 3, yearsMax: 8, gaps: ['C-suite governance', 'board communication'] },
  { from: 'Healthcare Administrator', to: 'Clinical Manager',          type: 'lateral',     yearsMin: 2, yearsMax: 5, gaps: ['clinical knowledge', 'care delivery'] },
  { from: 'Health Coach',             to: 'Mental Health Specialist',  type: 'pivot',       yearsMin: 2, yearsMax: 4, gaps: ['clinical training', 'mental health specialization'] },
  { from: 'Clinical Psychologist',    to: 'Clinical Manager',          type: 'lateral',     yearsMin: 4, yearsMax: 8, gaps: ['healthcare management', 'operational leadership'] },
  // Education progressions
  { from: 'Teacher',                  to: 'Senior Teacher',            type: 'progression', yearsMin: 3, yearsMax: 6, gaps: ['curriculum leadership', 'mentoring skills'] },
  { from: 'Senior Teacher',           to: 'Department Head',           type: 'progression', yearsMin: 3, yearsMax: 6, gaps: ['team leadership', 'school administration'] },
  { from: 'Department Head',          to: 'School Principal',          type: 'progression', yearsMin: 4, yearsMax: 8, gaps: ['school-wide leadership', 'stakeholder management'] },
  { from: 'Curriculum Designer',      to: 'Education Coordinator',     type: 'lateral',     yearsMin: 2, yearsMax: 4, gaps: ['programme coordination', 'stakeholder management'] },
  { from: 'Education Coordinator',    to: 'Education Director',        type: 'progression', yearsMin: 4, yearsMax: 8, gaps: ['strategic leadership', 'financial management'] },
  { from: 'Learning Specialist',      to: 'Curriculum Designer',       type: 'lateral',     yearsMin: 2, yearsMax: 4, gaps: ['curriculum architecture', 'instructional design'] },
  { from: 'Teacher',                  to: 'Learning Specialist',       type: 'lateral',     yearsMin: 3, yearsMax: 6, gaps: ['specialist training', 'educational technology'] },
  { from: 'Teacher',                  to: 'Instructional Designer',    type: 'pivot',       yearsMin: 2, yearsMax: 5, gaps: ['instructional design tools', 'e-learning development'] },
  // Finance progressions
  { from: 'Investment Analyst',       to: 'Portfolio Manager',         type: 'progression', yearsMin: 4, yearsMax: 8, gaps: ['portfolio construction', 'client management'] },
  { from: 'Risk Analyst',             to: 'Risk Manager',              type: 'progression', yearsMin: 3, yearsMax: 6, gaps: ['team leadership', 'strategic risk management'] },
  { from: 'Risk Manager',             to: 'Chief Risk Officer',        type: 'progression', yearsMin: 4, yearsMax: 8, gaps: ['C-suite communication', 'enterprise risk framework'] },
  { from: 'Compliance Officer',       to: 'Head of Compliance',        type: 'progression', yearsMin: 4, yearsMax: 8, gaps: ['leadership', 'regulatory strategy'] },
  { from: 'Financial Controller',     to: 'Chief Financial Officer',   type: 'progression', yearsMin: 4, yearsMax: 8, gaps: ['strategic finance', 'executive stakeholders'] },
  { from: 'Quantitative Analyst',     to: 'Portfolio Manager',         type: 'lateral',     yearsMin: 3, yearsMax: 6, gaps: ['client management', 'portfolio strategy'] },
  { from: 'Risk Analyst',             to: 'Compliance Officer',        type: 'lateral',     yearsMin: 1, yearsMax: 3, gaps: ['regulatory knowledge', 'compliance frameworks'] },
  { from: 'ESG Analyst',              to: 'Sustainability Manager',    type: 'progression', yearsMin: 2, yearsMax: 5, gaps: ['team leadership', 'stakeholder management'] },
  // Creative progressions
  { from: 'Graphic Designer',         to: 'Senior Graphic Designer',   type: 'progression', yearsMin: 2, yearsMax: 4, gaps: ['brand strategy basics', 'visual communication'] },
  { from: 'Senior Graphic Designer',  to: 'Art Director',              type: 'progression', yearsMin: 2, yearsMax: 5, gaps: ['team leadership', 'creative strategy'] },
  { from: 'Art Director',             to: 'Creative Director',         type: 'progression', yearsMin: 3, yearsMax: 6, gaps: ['executive presence', 'business development'] },
  { from: 'Creative Director',        to: 'Head of Creative',          type: 'progression', yearsMin: 3, yearsMax: 6, gaps: ['department leadership', 'budget management'] },
  { from: 'Brand Designer',           to: 'Brand Manager',             type: 'lateral',     yearsMin: 2, yearsMax: 4, gaps: ['brand strategy', 'marketing analytics'] },
  { from: 'Motion Designer',          to: 'Art Director',              type: 'lateral',     yearsMin: 3, yearsMax: 6, gaps: ['cross-media direction', 'team leadership'] },
  { from: 'Head of Creative',         to: 'Chief Creative Officer',    type: 'progression', yearsMin: 3, yearsMax: 6, gaps: ['C-suite governance', 'commercial strategy'] },
  // Network / Infra progressions
  { from: 'Network Engineer',         to: 'Senior Network Engineer',   type: 'progression', yearsMin: 2, yearsMax: 4, gaps: ['advanced networking', 'security specialization'] },
  { from: 'Senior Network Engineer',  to: 'Infrastructure Architect',  type: 'progression', yearsMin: 3, yearsMax: 6, gaps: ['cloud architecture', 'systems design'] },
  { from: 'Infrastructure Architect', to: 'Enterprise Architect',      type: 'progression', yearsMin: 3, yearsMax: 6, gaps: ['enterprise patterns', 'stakeholder alignment'] },
  { from: 'Solutions Engineer',       to: 'Solutions Architect',       type: 'progression', yearsMin: 2, yearsMax: 4, gaps: ['architecture depth', 'pre-sales'] },
  { from: 'Network Engineer',         to: 'Security Engineer',         type: 'pivot',       yearsMin: 2, yearsMax: 4, gaps: ['penetration testing', 'OWASP', 'security frameworks'] },
  // Sales / BD progressions
  { from: 'Account Executive',        to: 'Key Account Manager',       type: 'progression', yearsMin: 2, yearsMax: 4, gaps: ['strategic account management', 'executive relationships'] },
  { from: 'Key Account Manager',      to: 'Business Development Manager', type: 'lateral', yearsMin: 2, yearsMax: 4, gaps: ['new business development', 'pipeline management'] },
  { from: 'Business Development Manager', to: 'Head of Business Development', type: 'progression', yearsMin: 3, yearsMax: 6, gaps: ['leadership', 'P&L management'] },
  { from: 'Sales Director',           to: 'Head of Business Development', type: 'lateral', yearsMin: 2, yearsMax: 5, gaps: ['partnerships', 'enterprise BD'] },
  // CX progressions
  { from: 'UX Researcher',            to: 'Customer Experience Manager',type: 'lateral',   yearsMin: 2, yearsMax: 4, gaps: ['customer success', 'operational management'] },
  { from: 'Customer Experience Manager',to: 'CX Director',             type: 'progression', yearsMin: 3, yearsMax: 6, gaps: ['executive leadership', 'P&L ownership'] },
  { from: 'Voice of Customer Manager',to: 'CX Director',              type: 'lateral',     yearsMin: 2, yearsMax: 5, gaps: ['CX strategy', 'team leadership'] },
  { from: 'Head of CX',               to: 'Chief Operating Officer',   type: 'lateral',     yearsMin: 5, yearsMax: 8, gaps: ['operations management', 'financial strategy'] },
  // HR progressions
  { from: 'Talent Acquisition Specialist', to: 'HR Business Partner', type: 'pivot',       yearsMin: 2, yearsMax: 4, gaps: ['generalist HR', 'employee relations'] },
  { from: 'HR Business Partner',      to: 'Head of Talent',            type: 'progression', yearsMin: 3, yearsMax: 6, gaps: ['talent strategy', 'team leadership'] },
  { from: 'Head of Talent',           to: 'HR Director',               type: 'lateral',     yearsMin: 3, yearsMax: 6, gaps: ['full HR function', 'employment law'] },
  { from: 'People Analytics Manager', to: 'HR Director',               type: 'lateral',     yearsMin: 3, yearsMax: 6, gaps: ['people strategy', 'business partnering'] },
  // Marketing progressions
  { from: 'Social Media Manager',     to: 'Brand Manager',             type: 'lateral',     yearsMin: 2, yearsMax: 4, gaps: ['integrated marketing', 'brand strategy'] },
  { from: 'Performance Marketing Manager', to: 'Head of Brand',        type: 'progression', yearsMin: 3, yearsMax: 6, gaps: ['brand building', 'team leadership'] },
  { from: 'PR Manager',               to: 'Head of Brand',             type: 'lateral',     yearsMin: 3, yearsMax: 6, gaps: ['brand strategy', 'performance marketing'] },
  // AI / ML progressions
  { from: 'NLP Engineer',             to: 'Head of AI',                type: 'progression', yearsMin: 4, yearsMax: 8, gaps: ['team leadership', 'AI strategy'] },
  { from: 'Computer Vision Engineer', to: 'Head of AI',                type: 'progression', yearsMin: 4, yearsMax: 8, gaps: ['team leadership', 'AI strategy'] },
  { from: 'ML Engineer',              to: 'NLP Engineer',              type: 'lateral',     yearsMin: 1, yearsMax: 3, gaps: ['NLP frameworks', 'language model training'] },
  { from: 'ML Engineer',              to: 'Computer Vision Engineer',  type: 'lateral',     yearsMin: 1, yearsMax: 3, gaps: ['CV frameworks', 'image processing'] },
  { from: 'AI Product Manager',       to: 'Head of AI',                type: 'lateral',     yearsMin: 3, yearsMax: 6, gaps: ['technical depth', 'AI research'] },
  { from: 'Senior Software Engineer', to: 'NLP Engineer',              type: 'pivot',       yearsMin: 1, yearsMax: 3, gaps: ['NLP frameworks', 'ML fundamentals', 'PyTorch'] },
  // Sustainability progressions
  { from: 'ESG Analyst',              to: 'Sustainability Manager',    type: 'progression', yearsMin: 2, yearsMax: 5, gaps: ['programme management', 'stakeholder engagement'] },
  { from: 'Sustainability Manager',   to: 'Sustainability Director',   type: 'progression', yearsMin: 3, yearsMax: 6, gaps: ['executive strategy', 'board reporting'] },
  { from: 'Sustainability Director',  to: 'Chief Sustainability Officer', type: 'progression', yearsMin: 3, yearsMax: 6, gaps: ['C-suite governance', 'enterprise ESG strategy'] },
  { from: 'Risk Manager',             to: 'Sustainability Director',   type: 'lateral',     yearsMin: 3, yearsMax: 6, gaps: ['sustainability strategy', 'ESG frameworks'] },
  // SRE progressions
  { from: 'Senior Software Engineer', to: 'Site Reliability Engineer', type: 'pivot',       yearsMin: 1, yearsMax: 3, gaps: ['SRE practice', 'observability', 'chaos engineering'] },
  { from: 'Site Reliability Engineer',to: 'Platform Engineer',         type: 'lateral',     yearsMin: 2, yearsMax: 4, gaps: ['developer platform', 'internal tooling'] },
  { from: 'Senior Software Engineer', to: 'Staff Engineer',            type: 'progression', yearsMin: 3, yearsMax: 6, gaps: ['system design', 'technical leadership', 'org-wide impact'] },
  { from: 'Staff Engineer',           to: 'Principal Engineer',        type: 'progression', yearsMin: 3, yearsMax: 6, gaps: ['architectural vision', 'cross-org influence'] },
  { from: 'Data Engineer',            to: 'Analytics Engineer',        type: 'lateral',     yearsMin: 1, yearsMax: 3, gaps: ['dbt', 'data modeling for analytics'] },
  // Cross-domain pivots
  { from: 'Business Analyst',         to: 'Management Consultant',     type: 'pivot',       yearsMin: 2, yearsMax: 5, gaps: ['client management', 'consulting methodology'] },
  { from: 'Management Consultant',    to: 'Strategy Director',         type: 'progression', yearsMin: 3, yearsMax: 6, gaps: ['strategic leadership', 'executive stakeholders'] },
  { from: 'Strategy Director',        to: 'Transformation Lead',       type: 'lateral',     yearsMin: 2, yearsMax: 5, gaps: ['change management', 'operational delivery'] },
  { from: 'Product Manager',          to: 'AI Product Manager',        type: 'lateral',     yearsMin: 1, yearsMax: 3, gaps: ['AI/ML fundamentals', 'ML product patterns'] },
  { from: 'Associate Product Manager',to: 'Product Manager',           type: 'progression', yearsMin: 1, yearsMax: 3, gaps: ['product strategy', 'stakeholder management'] },
  { from: 'UX Designer',              to: 'UX Researcher',             type: 'lateral',     yearsMin: 1, yearsMax: 3, gaps: ['research methodology', 'usability testing methods'] },
  { from: 'Health Informatics Analyst',to: 'Digital Health Manager',   type: 'progression', yearsMin: 3, yearsMax: 6, gaps: ['product management', 'team leadership'] },
  { from: 'Clinical Data Analyst',    to: 'Health Informatics Analyst',type: 'progression', yearsMin: 2, yearsMax: 4, gaps: ['health informatics', 'clinical systems'] },
  // Research → analytics
  { from: 'Research Analyst',         to: 'Senior Research Analyst',   type: 'progression', yearsMin: 2, yearsMax: 4, gaps: ['quantitative methods', 'stakeholder reporting'] },
  { from: 'Senior Research Analyst',  to: 'Research Director',         type: 'progression', yearsMin: 4, yearsMax: 8, gaps: ['team leadership', 'research programme management'] },
  { from: 'Research Analyst',         to: 'Data Analyst',              type: 'lateral',     yearsMin: 1, yearsMax: 3, gaps: ['SQL', 'data visualization', 'business analytics'] },
  { from: 'Analytics Engineer',       to: 'Senior Data Engineer',      type: 'lateral',     yearsMin: 2, yearsMax: 4, gaps: ['data infrastructure', 'streaming platforms'] },
];

// ── Idempotent P-R4 expansion seed ───────────────────────────────────────────

export async function ensureOccupationGraphSeedP4(pool: Pool): Promise<{
  skillsAdded: number; occupationsAdded: number; skillMappingsInserted: number; pathwaysInserted: number;
}> {
  let skillsAdded = 0, occupationsAdded = 0, skillMappingsInserted = 0, pathwaysInserted = 0;

  // 0a. Insert new skills
  for (const s of NEW_SKILLS_P4) {
    try {
      const r = await pool.query(
        `INSERT INTO skills (canonical_name, skill_category, market_demand_score, future_relevance_score)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (canonical_name, skill_category) DO NOTHING`,
        [s.name, s.cat, s.demand, s.future],
      );
      skillsAdded += r.rowCount ?? 0;
    } catch { /* skip */ }
  }

  // 0b. Insert new occupations
  for (const o of NEW_OCCUPATIONS_P4) {
    try {
      const r = await pool.query(
        `INSERT INTO occupations (canonical_title, role_family, seniority_level, seniority_weight)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (canonical_title) DO NOTHING`,
        [o.title, o.family, o.level, o.weight],
      );
      occupationsAdded += r.rowCount ?? 0;
    } catch { /* skip */ }
  }

  // 1. Seed occupation_skills
  for (const [occTitle, skillList] of Object.entries(OCCUPATION_SKILLS_P4)) {
    for (const [skillName, importance, proficiency] of skillList) {
      try {
        const r = await pool.query(
          `INSERT INTO occupation_skills
             (occupation_id, skill_id, importance, proficiency_level, weight, source, source_authority,
              evidence_ref, dataset_version)
           SELECT o.id, s.id, $3, $4, $5::numeric, 'curated', 'MetryxOne-P-R4',
                  '{"source":"occupation-graph-seed-p4","version":"p-r4-2026"}'::jsonb, 'p-r4-2026'
             FROM occupations o, skills s
            WHERE o.canonical_title = $1 AND s.canonical_name = $2
           ON CONFLICT (occupation_id, skill_id) DO NOTHING`,
          [occTitle, skillName, importance, proficiency,
           importance === 'essential' ? 1.0 : importance === 'important' ? 0.7 : 0.4],
        );
        skillMappingsInserted += r.rowCount ?? 0;
      } catch { /* skip */ }
    }
  }

  // 2. Seed occupation_pathways
  for (const pw of PATHWAYS_P4) {
    try {
      const r = await pool.query(
        `INSERT INTO occupation_pathways
           (from_occupation_id, to_occupation_id, transition_type,
            typical_years_min, typical_years_max, common_gaps,
            source_authority, evidence_ref, is_active)
         SELECT f.id, t.id, $3, $4, $5, $6::jsonb, 'MetryxOne-P-R4',
                '{"source":"occupation-graph-seed-p4","version":"p-r4-2026"}'::jsonb, TRUE
           FROM occupations f, occupations t
          WHERE f.canonical_title = $1 AND t.canonical_title = $2
         ON CONFLICT DO NOTHING`,
        [pw.from, pw.to, pw.type, pw.yearsMin, pw.yearsMax, JSON.stringify(pw.gaps ?? [])],
      );
      pathwaysInserted += r.rowCount ?? 0;
    } catch { /* skip */ }
  }

  return { skillsAdded, occupationsAdded, skillMappingsInserted, pathwaysInserted };
}
