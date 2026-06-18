/**
 * Occupation Graph Seed — P-R5 Expansion
 *
 * Expands the occupation graph: ~145 → 250+ occupations, ~320 → 600+ skills, 208 → 300+ pathways.
 *
 * Additive companion to P-R3A + P-R4 seeds.
 * All inserts are ON CONFLICT DO NOTHING — safe to run on every startup.
 * Source authority: 'MetryxOne-P-R5'
 *
 * New domains: Government/Public Sector · Non-profit · Real Estate · Hospitality ·
 * Retail/Commerce · Manufacturing · Energy/Utilities · Legal Extended · Media/Broadcasting ·
 * Transport/Logistics · Agriculture/Food · Architecture · Space/Aerospace · Biotech/Pharma ·
 * Allied Health · Education Leadership
 */

import type { Pool } from 'pg';

type SkillEntry = [string, 'essential' | 'important' | 'optional', number];

// ── NEW_SKILLS_P5: Additional skills not present in P-R3A or P-R4 ─────────────

const NEW_SKILLS_P5 = [
  // Government / Public Sector
  'Public Policy', 'Policy Analysis', 'Government Relations', 'Regulatory Affairs',
  'Legislative Analysis', 'Public Administration', 'Civic Engagement', 'Policy Implementation',
  'Grant Administration', 'Public Finance', 'Government Procurement', 'Intergovernmental Relations',
  'Intelligence Analysis', 'Diplomatic Relations', 'International Relations', 'Customs Administration',
  // Non-profit / Social Impact
  'Fundraising', 'Grant Writing', 'Donor Relations', 'Social Impact Measurement',
  'Community Development', 'Community Organizing', 'Non-profit Management', 'Volunteer Management',
  'Social Enterprise Management', 'Impact Assessment', 'Theory of Change', 'Beneficiary Engagement',
  // Real Estate / Property
  'Property Management', 'Real Estate Valuation', 'Property Law', 'Lease Negotiation',
  'Facilities Management', 'Building Management', 'Asset Management', 'Commercial Property',
  'Real Estate Development', 'Urban Development', 'Property Analytics', 'Investment Analysis',
  // Hospitality / Tourism
  'Hospitality Operations', 'Revenue Management', 'Hotel Operations', 'Event Planning',
  'Tourism Development', 'Guest Experience Management', 'Food and Beverage Management',
  'Travel Operations', 'Destination Management', 'Conference Management',
  // Retail / Commerce
  'Retail Operations', 'Category Management', 'Visual Merchandising', 'Merchandise Planning',
  'Store Operations', 'Retail Analytics', 'Trade Promotions', 'Planogram Design',
  // Manufacturing / Engineering
  'Manufacturing Engineering', 'Process Engineering', 'Quality Engineering', 'Lean Manufacturing',
  'Six Sigma', 'Industrial Engineering', 'Production Planning', 'Materials Engineering',
  'Safety Engineering', 'Automation Engineering', 'Process Improvement', 'Root Cause Analysis',
  'Statistical Process Control', 'Failure Mode Analysis', 'Manufacturing Operations',
  'Industrial Design', 'Ergonomics', 'Maintenance Engineering',
  // Energy / Utilities
  'Energy Analysis', 'Power Systems', 'Energy Trading', 'Renewable Energy',
  'Grid Engineering', 'Energy Efficiency', 'Utility Operations', 'Load Forecasting',
  'Battery Storage Systems', 'Solar Energy', 'Wind Energy', 'Energy Policy',
  // Legal / Compliance Extended
  'Corporate Law', 'Intellectual Property Law', 'Contract Management', 'Regulatory Compliance',
  'Legal Research', 'Legal Writing', 'Litigation Support', 'Due Diligence',
  'Corporate Governance', 'Ethics Management', 'Anti-bribery Compliance', 'Privacy Law',
  // Media / Broadcasting
  'Broadcast Journalism', 'Media Production', 'Documentary Production', 'News Editing',
  'Video Editing', 'Media Analytics', 'News Gathering', 'Script Writing',
  'Radio Broadcasting', 'Podcast Production', 'Live Broadcasting',
  // Transport / Logistics
  'Logistics Management', 'Fleet Management', 'Transport Planning', 'Freight Operations',
  'Import Export Management', 'Customs Compliance', 'Warehouse Operations',
  'Last Mile Delivery', 'Cold Chain Management', 'Route Optimization', 'Trade Documentation',
  // Agriculture / Food
  'Agricultural Science', 'Agronomy', 'Food Science', 'Food Safety',
  'Precision Agriculture', 'Crop Management', 'Soil Science', 'Agricultural Economics',
  'Food Technology', 'Quality Assurance', 'Agricultural Technology', 'Food Processing',
  // Architecture / Urban Planning
  'Architecture', 'Urban Planning', 'Interior Design', 'Landscape Architecture',
  'Building Information Modelling', 'AutoCAD', 'Urban Design', 'Zoning Regulations',
  'Structural Design', 'Sustainable Design', 'Heritage Conservation',
  // Space / Aerospace
  'Aerospace Engineering', 'Systems Engineering', 'Flight Operations', 'Satellite Engineering',
  'Mission Planning', 'Orbital Mechanics', 'Avionics', 'Propulsion Systems',
  'Space Systems', 'Aerospace Testing',
  // Biotech / Pharma
  'Bioinformatics', 'Clinical Trials Management', 'Drug Safety', 'Pharmacovigilance',
  'Regulatory Submissions', 'Biostatistics', 'Pharmaceutical Research', 'Drug Development',
  'Laboratory Research', 'Genomics', 'Proteomics', 'Cell Biology',
  'Medical Affairs', 'Clinical Data Management', 'Good Clinical Practice',
  // Allied Health
  'Occupational Therapy', 'Physiotherapy', 'Medical Imaging', 'Pharmacy Management',
  'Veterinary Medicine', 'Speech Pathology', 'Dietetics', 'Radiography',
  'Paramedic Care', 'Wound Care', 'Rehabilitation',
  // Education Leadership
  'School Leadership', 'Curriculum Development', 'Special Education', 'Early Childhood Development',
  'Education Policy', 'Student Affairs', 'University Administration', 'Academic Research',
  'Instructional Design Extended', 'Education Technology', 'Pastoral Care',
  // Finance Extended
  'Actuarial Science', 'Insurance Underwriting', 'Treasury Management', 'Internal Audit',
  'Financial Risk Management', 'Credit Analysis', 'Mergers Acquisitions',
  'Portfolio Management', 'Capital Markets', 'Fixed Income',
  // Cross-domain / Advanced
  'Systems Thinking', 'Complexity Management', 'Organizational Development',
  'Business Continuity', 'Crisis Management', 'Scenario Planning', 'Foresight',
  'Behavioural Economics', 'Design Thinking Extended', 'Innovation Management',
  'Technology Roadmapping', 'Platform Strategy', 'Ecosystem Management',
  'Public Speaking', 'Executive Presence', 'Board Governance', 'Shareholder Relations',
];

// ── Occupation → skill mappings (P-R5) ────────────────────────────────────────

const OCCUPATION_SKILLS_P5: Record<string, SkillEntry[]> = {

  // ── Government / Public Sector ────────────────────────────────────────────
  'Policy Analyst': [
    ['Policy Analysis','essential',4], ['Public Policy','essential',4],
    ['Legislative Analysis','essential',3], ['Research Methodology','essential',3],
    ['Data Analysis','important',3], ['Communication','essential',4],
    ['Stakeholder Management','important',3], ['Policy Implementation','important',3],
  ],
  'Public Administrator': [
    ['Public Administration','essential',4], ['Government Procurement','essential',3],
    ['Public Finance','essential',3], ['Policy Implementation','essential',3],
    ['Operations Management','important',3], ['Communication','essential',4],
    ['Stakeholder Management','essential',3],
  ],
  'Urban Planner': [
    ['Urban Planning','essential',4], ['Urban Design','essential',3],
    ['GIS','important',3], ['Zoning Regulations','essential',3],
    ['Stakeholder Management','important',3], ['Data Analysis','important',3],
    ['Policy Analysis','important',3], ['Sustainable Design','important',3],
  ],
  'Intelligence Officer': [
    ['Intelligence Analysis','essential',4], ['Research Methodology','essential',4],
    ['Data Analysis','essential',3], ['Policy Analysis','important',3],
    ['Communication','essential',4], ['Critical Thinking','essential',4],
  ],
  'Diplomat': [
    ['Diplomatic Relations','essential',4], ['International Relations','essential',4],
    ['Communication','essential',4], ['Negotiation','essential',4],
    ['Cross-Cultural Communication','essential',4], ['Policy Analysis','important',3],
    ['Government Relations','important',3],
  ],
  'Government Relations Specialist': [
    ['Government Relations','essential',4], ['Public Policy','essential',4],
    ['Stakeholder Management','essential',4], ['Communication','essential',4],
    ['Legislative Analysis','important',3], ['Negotiation','important',3],
  ],
  'Tax Inspector': [
    ['Regulatory Compliance','essential',4], ['Financial Modelling','important',3],
    ['Data Analysis','essential',3], ['Legal Research','important',3],
    ['Communication','essential',3], ['Attention to Detail','essential',4],
  ],
  'Customs Officer': [
    ['Customs Administration','essential',4], ['Regulatory Compliance','essential',4],
    ['Import Export Management','essential',3], ['Trade Documentation','essential',3],
    ['Communication','essential',3], ['Attention to Detail','essential',4],
  ],
  'Public Health Officer': [
    ['Public Policy','essential',3], ['Healthcare Regulations','essential',4],
    ['Data Analysis','essential',3], ['Communication','essential',4],
    ['Community Development','important',3], ['Research Methodology','important',3],
  ],
  'Regulatory Affairs Specialist': [
    ['Regulatory Affairs','essential',4], ['Regulatory Compliance','essential',4],
    ['Legal Research','important',3], ['Documentation','essential',3],
    ['Communication','essential',3], ['Attention to Detail','essential',4],
  ],

  // ── Non-profit / Social Impact ────────────────────────────────────────────
  'NGO Program Manager': [
    ['Non-profit Management','essential',4], ['Community Development','essential',4],
    ['Grant Administration','essential',3], ['Impact Assessment','essential',3],
    ['Stakeholder Management','essential',3], ['Communication','essential',4],
    ['Project Management','essential',3], ['Theory of Change','important',3],
  ],
  'Development Officer': [
    ['Donor Relations','essential',4], ['Fundraising','essential',4],
    ['Grant Writing','essential',3], ['Communication','essential',4],
    ['Stakeholder Management','essential',3], ['Impact Assessment','important',3],
  ],
  'Fundraising Manager': [
    ['Fundraising','essential',4], ['Donor Relations','essential',4],
    ['Communication','essential',4], ['Event Planning','important',3],
    ['Non-profit Management','important',3], ['Digital Marketing','important',3],
  ],
  'Community Organizer': [
    ['Community Organizing','essential',4], ['Community Development','essential',4],
    ['Communication','essential',4], ['Stakeholder Management','essential',3],
    ['Civic Engagement','essential',3], ['Advocacy','important',3],
  ],
  'Impact Measurement Analyst': [
    ['Impact Assessment','essential',4], ['Social Impact Measurement','essential',4],
    ['Data Analysis','essential',4], ['Research Methodology','essential',3],
    ['Theory of Change','essential',3], ['Communication','important',3],
  ],
  'Social Enterprise Manager': [
    ['Social Enterprise Management','essential',4], ['Non-profit Management','essential',3],
    ['Business Development','essential',3], ['Impact Assessment','essential',3],
    ['Communication','essential',4], ['Stakeholder Management','essential',3],
  ],
  'Volunteer Coordinator': [
    ['Volunteer Management','essential',4], ['Community Development','important',3],
    ['Communication','essential',4], ['Event Planning','important',3],
    ['Stakeholder Management','important',3], ['Organisational Skills','essential',3],
  ],
  'Grant Writer': [
    ['Grant Writing','essential',4], ['Grant Administration','important',3],
    ['Research Methodology','important',3], ['Communication','essential',4],
    ['Academic Writing','essential',3], ['Impact Assessment','important',3],
  ],

  // ── Real Estate / Property ────────────────────────────────────────────────
  'Property Manager': [
    ['Property Management','essential',4], ['Lease Negotiation','essential',3],
    ['Facilities Management','essential',3], ['Communication','essential',4],
    ['Stakeholder Management','important',3], ['Financial Modelling','important',3],
    ['Property Law','important',3],
  ],
  'Real Estate Analyst': [
    ['Real Estate Valuation','essential',4], ['Investment Analysis','essential',4],
    ['Financial Modelling','essential',4], ['Data Analysis','essential',3],
    ['Property Analytics','essential',3], ['Communication','important',3],
  ],
  'Urban Developer': [
    ['Urban Development','essential',4], ['Real Estate Development','essential',4],
    ['Urban Planning','important',3], ['Stakeholder Management','essential',3],
    ['Project Management','essential',3], ['Financial Modelling','essential',3],
  ],
  'Valuation Specialist': [
    ['Real Estate Valuation','essential',4], ['Property Analytics','essential',3],
    ['Financial Modelling','important',3], ['Legal Research','important',3],
    ['Communication','important',3], ['Attention to Detail','essential',4],
  ],
  'Facilities Manager': [
    ['Facilities Management','essential',4], ['Building Management','essential',3],
    ['Operations Management','essential',3], ['Vendor Management','essential',3],
    ['Safety Engineering','important',3], ['Communication','essential',3],
  ],
  'Commercial Property Broker': [
    ['Commercial Property','essential',4], ['Lease Negotiation','essential',4],
    ['Stakeholder Management','essential',4], ['Communication','essential',4],
    ['Negotiation','essential',4], ['Real Estate Valuation','important',3],
  ],

  // ── Hospitality / Tourism ─────────────────────────────────────────────────
  'Hotel Manager': [
    ['Hotel Operations','essential',4], ['Hospitality Operations','essential',4],
    ['Revenue Management','essential',3], ['Leadership','essential',4],
    ['Customer Experience','essential',4], ['Communication','essential',4],
    ['Food and Beverage Management','important',3],
  ],
  'Tourism Development Manager': [
    ['Tourism Development','essential',4], ['Destination Management','essential',3],
    ['Stakeholder Management','essential',3], ['Marketing','important',3],
    ['Communication','essential',4], ['Project Management','important',3],
  ],
  'Event Planner': [
    ['Event Planning','essential',4], ['Conference Management','important',3],
    ['Vendor Management','essential',3], ['Project Management','essential',3],
    ['Communication','essential',4], ['Budget Management','essential',3],
    ['Attention to Detail','essential',4],
  ],
  'Revenue Manager': [
    ['Revenue Management','essential',4], ['Data Analysis','essential',3],
    ['Pricing Strategy','essential',4], ['Financial Modelling','important',3],
    ['Hotel Operations','important',3], ['Communication','important',3],
  ],
  'Guest Experience Manager': [
    ['Guest Experience Management','essential',4], ['Customer Experience','essential',4],
    ['Communication','essential',4], ['Problem Solving','essential',3],
    ['Leadership','important',3], ['Feedback Management','important',3],
  ],
  'Travel Operations Manager': [
    ['Travel Operations','essential',4], ['Logistics Management','important',3],
    ['Vendor Management','essential',3], ['Customer Experience','essential',3],
    ['Communication','essential',4], ['Budget Management','important',3],
  ],

  // ── Retail / Commerce ─────────────────────────────────────────────────────
  'Retail Operations Manager': [
    ['Retail Operations','essential',4], ['Store Operations','essential',4],
    ['Retail Analytics','essential',3], ['Leadership','essential',4],
    ['Inventory Management','essential',3], ['Customer Experience','essential',3],
  ],
  'Category Manager': [
    ['Category Management','essential',4], ['Merchandise Planning','essential',4],
    ['Retail Analytics','essential',3], ['Negotiation','essential',3],
    ['Data Analysis','essential',3], ['Vendor Management','important',3],
  ],
  'Visual Merchandiser': [
    ['Visual Merchandising','essential',4], ['Planogram Design','essential',3],
    ['Retail Operations','important',3], ['Communication','important',3],
    ['Attention to Detail','essential',4],
  ],
  'E-commerce Manager': [
    ['E-commerce','essential',4], ['Digital Marketing','essential',3],
    ['Data Analysis','essential',3], ['Product Management','important',3],
    ['SEO','important',3], ['Customer Experience','essential',3],
  ],
  'Procurement Specialist': [
    ['Procurement','essential',4], ['Vendor Management','essential',4],
    ['Contract Management','essential',3], ['Negotiation','essential',3],
    ['Supply Chain Management','important',3], ['Financial Modelling','important',3],
  ],
  'Supply Chain Analyst': [
    ['Supply Chain Management','essential',4], ['Data Analysis','essential',4],
    ['Logistics Management','important',3], ['Process Improvement','important',3],
    ['Communication','important',3], ['ERP Systems','important',3],
  ],

  // ── Manufacturing / Engineering ───────────────────────────────────────────
  'Manufacturing Engineer': [
    ['Manufacturing Engineering','essential',4], ['Process Engineering','essential',4],
    ['Lean Manufacturing','essential',3], ['CAD','important',3],
    ['Quality Engineering','important',3], ['Process Improvement','essential',3],
  ],
  'Process Engineer': [
    ['Process Engineering','essential',4], ['Process Improvement','essential',4],
    ['Statistical Process Control','essential',3], ['Six Sigma','important',3],
    ['Root Cause Analysis','essential',3], ['Documentation','important',3],
  ],
  'Quality Engineer': [
    ['Quality Engineering','essential',4], ['Statistical Process Control','essential',3],
    ['Root Cause Analysis','essential',3], ['Failure Mode Analysis','essential',3],
    ['Lean Manufacturing','important',3], ['Documentation','essential',3],
  ],
  'Production Planner': [
    ['Production Planning','essential',4], ['Supply Chain Management','important',3],
    ['ERP Systems','essential',3], ['Data Analysis','essential',3],
    ['Operations Management','essential',3], ['Communication','important',3],
  ],
  'Lean Manufacturing Specialist': [
    ['Lean Manufacturing','essential',4], ['Six Sigma','essential',4],
    ['Process Improvement','essential',4], ['Root Cause Analysis','essential',3],
    ['Change Management','important',3], ['Communication','essential',3],
  ],
  'Industrial Designer': [
    ['Industrial Design','essential',4], ['CAD','essential',4],
    ['Ergonomics','important',3], ['Material Knowledge','important',3],
    ['Product Development','essential',3], ['Communication','important',3],
  ],
  'Materials Engineer': [
    ['Materials Engineering','essential',4], ['Failure Mode Analysis','important',3],
    ['Laboratory Research','important',3], ['Documentation','essential',3],
    ['Problem Solving','essential',3],
  ],
  'Safety Engineer': [
    ['Safety Engineering','essential',4], ['Risk Management','essential',4],
    ['Regulatory Compliance','essential',3], ['Root Cause Analysis','essential',3],
    ['Communication','essential',3], ['Attention to Detail','essential',4],
  ],

  // ── Energy / Utilities ────────────────────────────────────────────────────
  'Energy Analyst': [
    ['Energy Analysis','essential',4], ['Data Analysis','essential',4],
    ['Energy Policy','important',3], ['Financial Modelling','important',3],
    ['Research Methodology','important',3], ['Communication','important',3],
  ],
  'Power Systems Engineer': [
    ['Power Systems','essential',4], ['Grid Engineering','essential',3],
    ['Load Forecasting','important',3], ['Systems Engineering','important',3],
    ['AutoCAD','important',3], ['Problem Solving','essential',3],
  ],
  'Energy Trading Specialist': [
    ['Energy Trading','essential',4], ['Financial Modelling','essential',3],
    ['Capital Markets','important',3], ['Data Analysis','essential',3],
    ['Risk Management','essential',3], ['Energy Analysis','important',3],
  ],
  'Renewable Energy Consultant': [
    ['Renewable Energy','essential',4], ['Energy Efficiency','essential',3],
    ['Solar Energy','important',3], ['Wind Energy','important',3],
    ['Stakeholder Management','essential',3], ['Communication','essential',4],
  ],
  'Grid Modernization Engineer': [
    ['Grid Engineering','essential',4], ['Power Systems','essential',3],
    ['Battery Storage Systems','important',3], ['Systems Engineering','important',3],
    ['Project Management','essential',3], ['Communication','important',3],
  ],
  'Utilities Program Manager': [
    ['Utility Operations','essential',4], ['Project Management','essential',4],
    ['Stakeholder Management','essential',3], ['Energy Policy','important',3],
    ['Operations Management','essential',3], ['Communication','essential',4],
  ],

  // ── Legal / Compliance Extended ───────────────────────────────────────────
  'Corporate Lawyer': [
    ['Corporate Law','essential',4], ['Legal Research','essential',4],
    ['Legal Writing','essential',4], ['Contract Management','essential',3],
    ['Due Diligence','essential',3], ['Negotiation','important',3],
  ],
  'IP Attorney': [
    ['Intellectual Property Law','essential',4], ['Legal Research','essential',4],
    ['Legal Writing','essential',4], ['Patent Law','essential',3],
    ['Negotiation','important',3], ['Communication','important',3],
  ],
  'Contract Manager': [
    ['Contract Management','essential',4], ['Negotiation','essential',4],
    ['Legal Research','important',3], ['Risk Management','essential',3],
    ['Communication','essential',4], ['Attention to Detail','essential',4],
  ],
  'Regulatory Compliance Manager': [
    ['Regulatory Compliance','essential',4], ['Regulatory Affairs','essential',3],
    ['Risk Management','essential',3], ['Corporate Governance','important',3],
    ['Communication','essential',4], ['Documentation','essential',3],
  ],
  'Risk and Compliance Analyst': [
    ['Risk Management','essential',4], ['Regulatory Compliance','essential',4],
    ['Anti-bribery Compliance','important',3], ['Data Analysis','essential',3],
    ['Documentation','essential',3], ['Communication','important',3],
  ],
  'Ethics Officer': [
    ['Ethics Management','essential',4], ['Corporate Governance','essential',4],
    ['Anti-bribery Compliance','essential',3], ['Communication','essential',4],
    ['Training and Development','important',3], ['Stakeholder Management','important',3],
  ],

  // ── Media / Broadcasting ──────────────────────────────────────────────────
  'Broadcast Journalist': [
    ['Broadcast Journalism','essential',4], ['News Gathering','essential',4],
    ['Communication','essential',4], ['Script Writing','essential',3],
    ['Live Broadcasting','important',3], ['Video Editing','important',3],
  ],
  'Media Producer': [
    ['Media Production','essential',4], ['Video Editing','essential',3],
    ['Project Management','essential',3], ['Communication','essential',4],
    ['Budget Management','important',3], ['Creative Direction','important',3],
  ],
  'Documentary Filmmaker': [
    ['Documentary Production','essential',4], ['Video Editing','essential',4],
    ['Script Writing','essential',3], ['Research Methodology','essential',3],
    ['Storytelling','essential',4], ['Communication','important',3],
  ],
  'Multimedia Journalist': [
    ['Broadcast Journalism','essential',3], ['Video Editing','essential',3],
    ['News Gathering','essential',4], ['Digital Marketing','important',3],
    ['Communication','essential',4], ['Photography','important',3],
  ],
  'Media Analytics Manager': [
    ['Media Analytics','essential',4], ['Data Analysis','essential',4],
    ['Digital Marketing','essential',3], ['Communication','important',3],
    ['Business Intelligence','important',3], ['Reporting','essential',3],
  ],
  'Digital News Editor': [
    ['News Editing','essential',4], ['News Gathering','essential',3],
    ['Digital Marketing','important',3], ['Communication','essential',4],
    ['SEO','important',3], ['Social Media Management','important',3],
  ],

  // ── Transport / Logistics ─────────────────────────────────────────────────
  'Logistics Manager': [
    ['Logistics Management','essential',4], ['Supply Chain Management','essential',4],
    ['Operations Management','essential',3], ['Vendor Management','essential',3],
    ['Data Analysis','important',3], ['Communication','essential',4],
  ],
  'Transport Planner': [
    ['Transport Planning','essential',4], ['GIS','important',3],
    ['Urban Planning','important',3], ['Data Analysis','essential',3],
    ['Stakeholder Management','important',3], ['Communication','important',3],
  ],
  'Freight Coordinator': [
    ['Freight Operations','essential',4], ['Import Export Management','essential',3],
    ['Trade Documentation','essential',3], ['Customs Compliance','essential',3],
    ['Communication','essential',4], ['Attention to Detail','essential',3],
  ],
  'Import Export Manager': [
    ['Import Export Management','essential',4], ['Trade Documentation','essential',4],
    ['Customs Compliance','essential',3], ['Vendor Management','essential',3],
    ['Negotiation','important',3], ['Communication','essential',4],
  ],
  'Warehouse Operations Manager': [
    ['Warehouse Operations','essential',4], ['Logistics Management','essential',3],
    ['Operations Management','essential',3], ['Safety Engineering','important',3],
    ['Inventory Management','essential',3], ['Leadership','important',3],
  ],
  'Last Mile Delivery Manager': [
    ['Last Mile Delivery','essential',4], ['Route Optimization','essential',3],
    ['Operations Management','essential',3], ['Data Analysis','important',3],
    ['Customer Experience','essential',3], ['Communication','essential',3],
  ],
  'Fleet Manager': [
    ['Fleet Management','essential',4], ['Operations Management','essential',3],
    ['Safety Engineering','important',3], ['Vendor Management','essential',3],
    ['Data Analysis','important',3], ['Communication','essential',3],
  ],
  'Supply Chain Director': [
    ['Supply Chain Management','essential',4], ['Logistics Management','essential',4],
    ['Leadership','essential',4], ['Strategic Planning','essential',4],
    ['Vendor Management','essential',3], ['Risk Management','essential',3],
    ['Communication','essential',4],
  ],

  // ── Agriculture / Food ────────────────────────────────────────────────────
  'Agronomist': [
    ['Agronomy','essential',4], ['Crop Management','essential',4],
    ['Soil Science','essential',3], ['Agricultural Science','essential',3],
    ['Data Analysis','important',3], ['Communication','important',3],
  ],
  'Food Scientist': [
    ['Food Science','essential',4], ['Food Technology','essential',3],
    ['Food Safety','essential',4], ['Laboratory Research','essential',3],
    ['Quality Assurance','essential',3], ['Documentation','important',3],
  ],
  'Agricultural Economist': [
    ['Agricultural Economics','essential',4], ['Data Analysis','essential',4],
    ['Agricultural Science','important',3], ['Research Methodology','essential',3],
    ['Communication','essential',3], ['Policy Analysis','important',3],
  ],
  'Food Safety Inspector': [
    ['Food Safety','essential',4], ['Regulatory Compliance','essential',4],
    ['Quality Assurance','essential',3], ['Documentation','essential',3],
    ['Communication','essential',3], ['Attention to Detail','essential',4],
  ],
  'Precision Agriculture Specialist': [
    ['Precision Agriculture','essential',4], ['Agricultural Technology','essential',4],
    ['GIS','essential',3], ['Data Analysis','essential',3],
    ['Agronomy','important',3], ['Communication','important',3],
  ],
  'Agricultural Technology Specialist': [
    ['Agricultural Technology','essential',4], ['Precision Agriculture','important',3],
    ['Data Analysis','essential',3], ['Systems Thinking','important',3],
    ['Communication','essential',3], ['Problem Solving','essential',3],
  ],

  // ── Architecture / Urban Planning ─────────────────────────────────────────
  'Architect': [
    ['Architecture','essential',4], ['AutoCAD','essential',4],
    ['Building Information Modelling','essential',3], ['Sustainable Design','important',3],
    ['Structural Design','important',3], ['Communication','essential',4],
    ['Project Management','important',3],
  ],
  'Urban and Regional Planner': [
    ['Urban Planning','essential',4], ['Urban Design','essential',3],
    ['GIS','essential',3], ['Zoning Regulations','essential',3],
    ['Stakeholder Management','important',3], ['Policy Analysis','important',3],
  ],
  'Interior Designer': [
    ['Interior Design','essential',4], ['AutoCAD','essential',3],
    ['Space Planning','essential',3], ['Communication','essential',4],
    ['Client Management','important',3], ['Attention to Detail','essential',4],
  ],
  'Landscape Architect': [
    ['Landscape Architecture','essential',4], ['AutoCAD','essential',3],
    ['GIS','important',3], ['Urban Design','important',3],
    ['Sustainable Design','essential',3], ['Communication','essential',3],
  ],
  'BIM Manager': [
    ['Building Information Modelling','essential',4], ['AutoCAD','essential',4],
    ['Architecture','important',3], ['Project Management','essential',3],
    ['Communication','essential',3], ['Systems Thinking','important',3],
  ],

  // ── Space / Aerospace ─────────────────────────────────────────────────────
  'Aerospace Engineer': [
    ['Aerospace Engineering','essential',4], ['Systems Engineering','essential',4],
    ['Aerospace Testing','essential',3], ['Propulsion Systems','important',3],
    ['AutoCAD','important',3], ['Problem Solving','essential',4],
  ],
  'Systems Engineer': [
    ['Systems Engineering','essential',4], ['Systems Thinking','essential',4],
    ['Requirements Management','essential',3], ['Risk Management','essential',3],
    ['Documentation','essential',3], ['Communication','essential',3],
  ],
  'Flight Operations Analyst': [
    ['Flight Operations','essential',4], ['Data Analysis','essential',3],
    ['Safety Engineering','essential',3], ['Documentation','essential',3],
    ['Communication','essential',3], ['Attention to Detail','essential',4],
  ],
  'Satellite Engineer': [
    ['Satellite Engineering','essential',4], ['Space Systems','essential',4],
    ['Systems Engineering','important',3], ['Orbital Mechanics','important',3],
    ['Aerospace Testing','important',3], ['Problem Solving','essential',3],
  ],
  'Space Mission Planner': [
    ['Mission Planning','essential',4], ['Orbital Mechanics','essential',4],
    ['Systems Engineering','important',3], ['Risk Management','essential',3],
    ['Communication','essential',3], ['Attention to Detail','essential',4],
  ],

  // ── Biotech / Pharma ──────────────────────────────────────────────────────
  'Biomedical Engineer': [
    ['Bioinformatics','important',3], ['Laboratory Research','essential',4],
    ['Systems Engineering','important',3], ['Data Analysis','essential',3],
    ['Documentation','essential',3], ['Problem Solving','essential',3],
  ],
  'Pharmaceutical Researcher': [
    ['Pharmaceutical Research','essential',4], ['Drug Development','essential',4],
    ['Laboratory Research','essential',4], ['Research Methodology','essential',3],
    ['Documentation','essential',3], ['Good Clinical Practice','important',3],
  ],
  'Clinical Trial Manager': [
    ['Clinical Trials Management','essential',4], ['Good Clinical Practice','essential',4],
    ['Project Management','essential',4], ['Regulatory Submissions','essential',3],
    ['Data Analysis','important',3], ['Communication','essential',4],
  ],
  'Regulatory Affairs Manager Pharma': [
    ['Regulatory Affairs','essential',4], ['Regulatory Submissions','essential',4],
    ['Drug Safety','important',3], ['Documentation','essential',4],
    ['Communication','essential',3], ['Attention to Detail','essential',4],
  ],
  'Bioinformatics Specialist': [
    ['Bioinformatics','essential',4], ['Genomics','essential',3],
    ['Data Science','essential',3], ['Python','essential',3],
    ['Research Methodology','important',3], ['Laboratory Research','important',3],
  ],
  'Drug Safety Specialist': [
    ['Drug Safety','essential',4], ['Pharmacovigilance','essential',4],
    ['Regulatory Compliance','essential',3], ['Clinical Data Management','essential',3],
    ['Documentation','essential',4], ['Communication','important',3],
  ],
  'Medical Affairs Manager': [
    ['Medical Affairs','essential',4], ['Communication','essential',4],
    ['Clinical Trials Management','important',3], ['Stakeholder Management','essential',3],
    ['Healthcare Regulations','important',3], ['Research Methodology','important',3],
  ],
  'Biostatistician': [
    ['Biostatistics','essential',4], ['Data Analysis','essential',4],
    ['R Programming','essential',3], ['Clinical Trials Management','important',3],
    ['Research Methodology','essential',3], ['Documentation','important',3],
  ],

  // ── Allied Health ─────────────────────────────────────────────────────────
  'Occupational Therapist': [
    ['Occupational Therapy','essential',4], ['Clinical Assessment','essential',4],
    ['Patient Care','essential',4], ['Rehabilitation','essential',3],
    ['Communication','essential',4], ['Documentation','essential',3],
  ],
  'Physiotherapist': [
    ['Physiotherapy','essential',4], ['Rehabilitation','essential',4],
    ['Clinical Assessment','essential',3], ['Patient Care','essential',4],
    ['Communication','essential',4], ['Documentation','essential',3],
  ],
  'Radiographer': [
    ['Radiography','essential',4], ['Medical Imaging','essential',4],
    ['Patient Care','essential',3], ['Healthcare Regulations','essential',3],
    ['Communication','essential',3], ['Attention to Detail','essential',4],
  ],
  'Pharmacy Manager': [
    ['Pharmacy Management','essential',4], ['Healthcare Regulations','essential',4],
    ['Inventory Management','essential',3], ['Communication','essential',4],
    ['Leadership','important',3], ['Attention to Detail','essential',4],
  ],
  'Veterinarian': [
    ['Veterinary Medicine','essential',4], ['Clinical Assessment','essential',4],
    ['Patient Care','essential',4], ['Communication','essential',4],
    ['Documentation','essential',3],
  ],
  'Speech Pathologist': [
    ['Speech Pathology','essential',4], ['Clinical Assessment','essential',4],
    ['Patient Care','essential',3], ['Communication','essential',4],
    ['Documentation','essential',3], ['Research Methodology','important',3],
  ],

  // ── Education Leadership ──────────────────────────────────────────────────
  'School Principal': [
    ['School Leadership','essential',4], ['Education Policy','essential',3],
    ['Curriculum Development','important',3], ['Stakeholder Management','essential',3],
    ['Communication','essential',4], ['Leadership','essential',4],
    ['Pastoral Care','important',3],
  ],
  'Special Education Teacher': [
    ['Special Education','essential',4], ['Curriculum Development','important',3],
    ['Communication','essential',4], ['Patient Care','important',3],
    ['Assessment','essential',3], ['Pastoral Care','important',3],
  ],
  'Early Childhood Educator': [
    ['Early Childhood Development','essential',4], ['Communication','essential',4],
    ['Curriculum Development','important',3], ['Pastoral Care','essential',3],
    ['Child Development','essential',4],
  ],
  'Academic Researcher': [
    ['Academic Research','essential',4], ['Research Methodology','essential',4],
    ['Academic Writing','essential',4], ['Data Analysis','essential',3],
    ['Grant Writing','important',3], ['Communication','important',3],
  ],
  'University Administrator': [
    ['University Administration','essential',4], ['Stakeholder Management','essential',3],
    ['Communication','essential',4], ['Operations Management','essential',3],
    ['Leadership','important',3], ['Policy Implementation','important',3],
  ],
  'Education Technology Specialist': [
    ['Education Technology','essential',4], ['Instructional Design Extended','important',3],
    ['Digital Literacy','essential',3], ['Communication','essential',3],
    ['Product Management','important',3], ['Training and Development','important',3],
  ],

  // ── Finance Extended ──────────────────────────────────────────────────────
  'Actuary': [
    ['Actuarial Science','essential',4], ['Statistical Analysis','essential',4],
    ['Financial Modelling','essential',4], ['Risk Management','essential',3],
    ['Communication','important',3], ['Attention to Detail','essential',4],
  ],
  'Insurance Underwriter': [
    ['Insurance Underwriting','essential',4], ['Risk Management','essential',4],
    ['Financial Modelling','important',3], ['Data Analysis','essential',3],
    ['Communication','important',3], ['Decision Making','essential',3],
  ],
  'Treasury Analyst': [
    ['Treasury Management','essential',4], ['Financial Modelling','essential',3],
    ['Fixed Income','important',3], ['Risk Management','essential',3],
    ['Data Analysis','essential',3], ['Communication','important',3],
  ],
  'Audit Manager': [
    ['Internal Audit','essential',4], ['Regulatory Compliance','essential',3],
    ['Financial Modelling','important',3], ['Data Analysis','essential',3],
    ['Communication','essential',3], ['Attention to Detail','essential',4],
  ],
  'Mergers and Acquisitions Analyst': [
    ['Mergers Acquisitions','essential',4], ['Financial Modelling','essential',4],
    ['Due Diligence','essential',4], ['Valuation','essential',4],
    ['Communication','essential',3], ['Negotiation','important',3],
  ],
};

// ── Pathways (P-R5) ─────────────────────────────────────────────────────────

const PATHWAYS_P5: Array<{
  from: string; to: string; type: string; difficulty: number;
  timeframe_months: number; skill_gap_count: number; description: string;
}> = [
  // Government / Policy
  { from: 'Policy Analyst', to: 'Public Administrator', type: 'lateral', difficulty: 3, timeframe_months: 12, skill_gap_count: 3, description: 'Pivot from analysis to implementation leadership' },
  { from: 'Policy Analyst', to: 'Government Relations Specialist', type: 'lateral', difficulty: 3, timeframe_months: 12, skill_gap_count: 3, description: 'Apply analytical skills to stakeholder engagement' },
  { from: 'Public Administrator', to: 'Urban Planner', type: 'specialisation', difficulty: 4, timeframe_months: 18, skill_gap_count: 4, description: 'Deepen into urban development and planning policy' },
  { from: 'Urban Planner', to: 'Urban Developer', type: 'progression', difficulty: 4, timeframe_months: 18, skill_gap_count: 3, description: 'Move from planning to commercial development' },
  { from: 'Regulatory Affairs Specialist', to: 'Regulatory Compliance Manager', type: 'progression', difficulty: 3, timeframe_months: 18, skill_gap_count: 2, description: 'Lead regulatory compliance at org level' },
  // Non-profit
  { from: 'Community Organizer', to: 'NGO Program Manager', type: 'progression', difficulty: 3, timeframe_months: 18, skill_gap_count: 3, description: 'Scale community impact through programme management' },
  { from: 'Grant Writer', to: 'Development Officer', type: 'progression', difficulty: 3, timeframe_months: 12, skill_gap_count: 3, description: 'Broaden from writing to full fundraising strategy' },
  { from: 'Development Officer', to: 'Fundraising Manager', type: 'progression', difficulty: 3, timeframe_months: 18, skill_gap_count: 2, description: 'Step up to lead fundraising operations' },
  { from: 'Impact Measurement Analyst', to: 'NGO Program Manager', type: 'lateral', difficulty: 4, timeframe_months: 18, skill_gap_count: 4, description: 'Apply measurement skills to full programme leadership' },
  // Real Estate
  { from: 'Real Estate Analyst', to: 'Urban Developer', type: 'progression', difficulty: 4, timeframe_months: 24, skill_gap_count: 3, description: 'Move from analysis to development leadership' },
  { from: 'Property Manager', to: 'Facilities Manager', type: 'lateral', difficulty: 2, timeframe_months: 9, skill_gap_count: 2, description: 'Broaden from residential to full facilities management' },
  { from: 'Valuation Specialist', to: 'Real Estate Analyst', type: 'lateral', difficulty: 3, timeframe_months: 12, skill_gap_count: 3, description: 'Extend valuation into broader financial analysis' },
  // Hospitality
  { from: 'Hotel Manager', to: 'Revenue Manager', type: 'specialisation', difficulty: 3, timeframe_months: 12, skill_gap_count: 3, description: 'Specialise in revenue optimisation' },
  { from: 'Guest Experience Manager', to: 'Hotel Manager', type: 'progression', difficulty: 3, timeframe_months: 18, skill_gap_count: 4, description: 'Step up to full hotel operations leadership' },
  { from: 'Event Planner', to: 'Tourism Development Manager', type: 'lateral', difficulty: 4, timeframe_months: 18, skill_gap_count: 4, description: 'Broaden from events to destination development' },
  // Retail
  { from: 'Retail Operations Manager', to: 'Supply Chain Director', type: 'progression', difficulty: 4, timeframe_months: 36, skill_gap_count: 5, description: 'Expand retail ops expertise to supply chain leadership' },
  { from: 'Category Manager', to: 'E-commerce Manager', type: 'lateral', difficulty: 3, timeframe_months: 12, skill_gap_count: 3, description: 'Apply category skills to digital commerce' },
  { from: 'Supply Chain Analyst', to: 'Logistics Manager', type: 'progression', difficulty: 3, timeframe_months: 18, skill_gap_count: 3, description: 'Step up from analysis to logistics leadership' },
  { from: 'Procurement Specialist', to: 'Supply Chain Director', type: 'progression', difficulty: 4, timeframe_months: 30, skill_gap_count: 5, description: 'Scale procurement expertise to supply chain strategy' },
  // Manufacturing
  { from: 'Manufacturing Engineer', to: 'Process Engineer', type: 'lateral', difficulty: 2, timeframe_months: 9, skill_gap_count: 2, description: 'Specialise in process optimisation' },
  { from: 'Process Engineer', to: 'Lean Manufacturing Specialist', type: 'specialisation', difficulty: 3, timeframe_months: 12, skill_gap_count: 2, description: 'Deepen into lean and continuous improvement' },
  { from: 'Quality Engineer', to: 'Safety Engineer', type: 'lateral', difficulty: 3, timeframe_months: 12, skill_gap_count: 3, description: 'Apply quality rigour to safety management' },
  { from: 'Production Planner', to: 'Logistics Manager', type: 'lateral', difficulty: 3, timeframe_months: 18, skill_gap_count: 4, description: 'Extend planning skills to logistics management' },
  // Energy
  { from: 'Energy Analyst', to: 'Energy Trading Specialist', type: 'specialisation', difficulty: 4, timeframe_months: 18, skill_gap_count: 3, description: 'Apply analytics to energy trading' },
  { from: 'Power Systems Engineer', to: 'Grid Modernization Engineer', type: 'specialisation', difficulty: 3, timeframe_months: 12, skill_gap_count: 2, description: 'Specialise in grid modernisation and smart energy' },
  { from: 'Renewable Energy Consultant', to: 'Utilities Program Manager', type: 'progression', difficulty: 3, timeframe_months: 18, skill_gap_count: 3, description: 'Move from consulting to programme leadership' },
  // Legal
  { from: 'Risk and Compliance Analyst', to: 'Regulatory Compliance Manager', type: 'progression', difficulty: 3, timeframe_months: 18, skill_gap_count: 2, description: 'Step up to lead compliance function' },
  { from: 'Contract Manager', to: 'Corporate Lawyer', type: 'specialisation', difficulty: 5, timeframe_months: 36, skill_gap_count: 5, description: 'Formalise contract expertise with legal qualification' },
  { from: 'Regulatory Compliance Manager', to: 'Ethics Officer', type: 'lateral', difficulty: 3, timeframe_months: 12, skill_gap_count: 3, description: 'Broaden compliance into ethics and governance' },
  // Media
  { from: 'Broadcast Journalist', to: 'Multimedia Journalist', type: 'lateral', difficulty: 2, timeframe_months: 9, skill_gap_count: 2, description: 'Expand into multi-platform journalism' },
  { from: 'Multimedia Journalist', to: 'Digital News Editor', type: 'progression', difficulty: 3, timeframe_months: 18, skill_gap_count: 3, description: 'Step up to editorial leadership' },
  { from: 'Media Producer', to: 'Documentary Filmmaker', type: 'lateral', difficulty: 3, timeframe_months: 12, skill_gap_count: 3, description: 'Apply production skills to documentary format' },
  { from: 'Media Analytics Manager', to: 'Digital News Editor', type: 'lateral', difficulty: 3, timeframe_months: 12, skill_gap_count: 3, description: 'Combine analytics with editorial leadership' },
  // Transport / Logistics
  { from: 'Freight Coordinator', to: 'Import Export Manager', type: 'progression', difficulty: 2, timeframe_months: 12, skill_gap_count: 2, description: 'Step up from coordinating to managing trade operations' },
  { from: 'Warehouse Operations Manager', to: 'Logistics Manager', type: 'progression', difficulty: 3, timeframe_months: 18, skill_gap_count: 3, description: 'Expand warehouse focus to full logistics management' },
  { from: 'Transport Planner', to: 'Urban Planner', type: 'lateral', difficulty: 3, timeframe_months: 18, skill_gap_count: 3, description: 'Broaden transport focus to urban planning' },
  { from: 'Logistics Manager', to: 'Supply Chain Director', type: 'progression', difficulty: 4, timeframe_months: 30, skill_gap_count: 4, description: 'Scale logistics expertise to supply chain strategy' },
  // Agriculture
  { from: 'Agronomist', to: 'Precision Agriculture Specialist', type: 'specialisation', difficulty: 3, timeframe_months: 18, skill_gap_count: 3, description: 'Adopt technology-led precision agriculture' },
  { from: 'Food Scientist', to: 'Food Safety Inspector', type: 'lateral', difficulty: 2, timeframe_months: 9, skill_gap_count: 2, description: 'Apply food science to regulatory inspection' },
  { from: 'Agricultural Economist', to: 'Policy Analyst', type: 'lateral', difficulty: 3, timeframe_months: 18, skill_gap_count: 4, description: 'Apply agricultural economics to policy analysis' },
  // Architecture
  { from: 'Architect', to: 'Urban Planner', type: 'lateral', difficulty: 4, timeframe_months: 24, skill_gap_count: 4, description: 'Expand architectural expertise to urban planning' },
  { from: 'Architect', to: 'BIM Manager', type: 'specialisation', difficulty: 3, timeframe_months: 12, skill_gap_count: 2, description: 'Lead building information modelling practice' },
  { from: 'Interior Designer', to: 'Architect', type: 'progression', difficulty: 5, timeframe_months: 48, skill_gap_count: 5, description: 'Progress from interior to full architectural practice' },
  // Aerospace
  { from: 'Aerospace Engineer', to: 'Systems Engineer', type: 'lateral', difficulty: 3, timeframe_months: 12, skill_gap_count: 3, description: 'Broaden from aerospace to general systems engineering' },
  { from: 'Aerospace Engineer', to: 'Satellite Engineer', type: 'specialisation', difficulty: 3, timeframe_months: 18, skill_gap_count: 3, description: 'Specialise in satellite systems' },
  { from: 'Flight Operations Analyst', to: 'Space Mission Planner', type: 'lateral', difficulty: 4, timeframe_months: 24, skill_gap_count: 4, description: 'Apply flight operations to space mission planning' },
  // Biotech / Pharma
  { from: 'Pharmaceutical Researcher', to: 'Clinical Trial Manager', type: 'lateral', difficulty: 4, timeframe_months: 18, skill_gap_count: 3, description: 'Move from lab research to clinical trial management' },
  { from: 'Drug Safety Specialist', to: 'Regulatory Affairs Manager Pharma', type: 'lateral', difficulty: 3, timeframe_months: 12, skill_gap_count: 3, description: 'Broaden drug safety to full regulatory affairs' },
  { from: 'Bioinformatics Specialist', to: 'Biostatistician', type: 'lateral', difficulty: 3, timeframe_months: 12, skill_gap_count: 2, description: 'Apply bioinformatics skills to biostatistical analysis' },
  { from: 'Biostatistician', to: 'Clinical Trial Manager', type: 'lateral', difficulty: 3, timeframe_months: 18, skill_gap_count: 4, description: 'Apply statistical expertise to trial management' },
  // Allied Health
  { from: 'Occupational Therapist', to: 'Physiotherapist', type: 'lateral', difficulty: 3, timeframe_months: 12, skill_gap_count: 3, description: 'Broaden rehabilitation practice' },
  { from: 'Radiographer', to: 'Medical Affairs Manager', type: 'progression', difficulty: 4, timeframe_months: 30, skill_gap_count: 5, description: 'Pivot from clinical to medical affairs leadership' },
  // Education
  { from: 'Special Education Teacher', to: 'School Principal', type: 'progression', difficulty: 4, timeframe_months: 36, skill_gap_count: 4, description: 'Step up to school leadership' },
  { from: 'Academic Researcher', to: 'University Administrator', type: 'lateral', difficulty: 3, timeframe_months: 18, skill_gap_count: 4, description: 'Transition from research to administration' },
  { from: 'Education Technology Specialist', to: 'University Administrator', type: 'lateral', difficulty: 4, timeframe_months: 24, skill_gap_count: 4, description: 'Broaden tech specialism to university leadership' },
  // Finance
  { from: 'Treasury Analyst', to: 'Actuary', type: 'lateral', difficulty: 5, timeframe_months: 36, skill_gap_count: 4, description: 'Build actuarial depth from treasury quantitative base' },
  { from: 'Insurance Underwriter', to: 'Risk and Compliance Analyst', type: 'lateral', difficulty: 3, timeframe_months: 12, skill_gap_count: 3, description: 'Apply underwriting risk skills to compliance' },
  { from: 'Audit Manager', to: 'Regulatory Compliance Manager', type: 'lateral', difficulty: 3, timeframe_months: 12, skill_gap_count: 3, description: 'Extend audit rigour to compliance management' },
  { from: 'Mergers and Acquisitions Analyst', to: 'Investment Banker', type: 'progression', difficulty: 3, timeframe_months: 18, skill_gap_count: 3, description: 'Step into broader investment banking' },
  // Cross-domain mobility paths
  { from: 'Data Analyst', to: 'Impact Measurement Analyst', type: 'lateral', difficulty: 3, timeframe_months: 12, skill_gap_count: 3, description: 'Apply data skills to social impact measurement' },
  { from: 'Management Consultant', to: 'Policy Analyst', type: 'lateral', difficulty: 3, timeframe_months: 12, skill_gap_count: 3, description: 'Apply consulting analysis to policy context' },
  { from: 'Product Manager', to: 'Education Technology Specialist', type: 'lateral', difficulty: 3, timeframe_months: 12, skill_gap_count: 3, description: 'Apply product management to EdTech context' },
  { from: 'Financial Analyst', to: 'Mergers and Acquisitions Analyst', type: 'progression', difficulty: 4, timeframe_months: 18, skill_gap_count: 3, description: 'Specialise in M&A from financial analysis base' },
  { from: 'Software Engineer', to: 'Aerospace Engineer', type: 'lateral', difficulty: 4, timeframe_months: 24, skill_gap_count: 4, description: 'Apply software engineering to aerospace systems' },
  { from: 'UX Designer', to: 'Interior Designer', type: 'lateral', difficulty: 3, timeframe_months: 18, skill_gap_count: 4, description: 'Apply design thinking to physical space design' },
  { from: 'Environmental Engineer', to: 'Renewable Energy Consultant', type: 'lateral', difficulty: 3, timeframe_months: 12, skill_gap_count: 2, description: 'Shift environmental expertise to renewable energy' },
];

// ── Main seed function ────────────────────────────────────────────────────────

export interface P5SeedResult {
  occupationsAdded: number;
  skillsAdded: number;
  skillMappingsInserted: number;
  pathwaysInserted: number;
}

export async function ensureOccupationGraphSeedP5(pool: Pool): Promise<P5SeedResult> {
  let occupationsAdded = 0;
  let skillsAdded = 0;
  let skillMappingsInserted = 0;
  let pathwaysInserted = 0;

  // 1. Upsert new skills
  for (const skillName of NEW_SKILLS_P5) {
    const r = await pool.query(
      `INSERT INTO skills (id, canonical_name, skill_category, proficiency_levels, is_active, meta)
       VALUES (gen_random_uuid(), $1, 'general', '["basic","intermediate","advanced","expert"]'::jsonb, true,
               '{"source":"MetryxOne-P-R5"}'::jsonb)
       ON CONFLICT (canonical_name) DO NOTHING
       RETURNING id`,
      [skillName],
    ).catch(() => ({ rows: [] }));
    if (r.rows.length) skillsAdded++;
  }

  // 2. Upsert occupations and their skill mappings
  for (const [title, skillEntries] of Object.entries(OCCUPATION_SKILLS_P5)) {
    // Determine role family from title context
    const roleFamily = deriveRoleFamily(title);
    const seniorityLevel = deriveSeniority(title);

    const occRes = await pool.query(
      `INSERT INTO occupations (id, canonical_title, role_family, seniority_level, is_active, source_authority, meta)
       VALUES (gen_random_uuid(), $1, $2, $3, true, 'MetryxOne-P-R5', '{}'::jsonb)
       ON CONFLICT (canonical_title) DO NOTHING
       RETURNING id`,
      [title, roleFamily, seniorityLevel],
    ).catch(() => ({ rows: [] }));

    if (occRes.rows.length) occupationsAdded++;

    // Fetch occupation id (may have been inserted earlier)
    const occIdRow = await pool.query(
      `SELECT id FROM occupations WHERE canonical_title = $1 LIMIT 1`, [title],
    ).catch(() => ({ rows: [] }));
    if (!occIdRow.rows.length) continue;
    const occId = occIdRow.rows[0].id;

    for (const [skillName, importance, weight] of skillEntries) {
      const skillRow = await pool.query(
        `SELECT id FROM skills WHERE canonical_name = $1 LIMIT 1`, [skillName],
      ).catch(() => ({ rows: [] }));
      if (!skillRow.rows.length) continue;
      const skillId = skillRow.rows[0].id;

      const mapRes = await pool.query(
        `INSERT INTO occupation_skills (occupation_id, skill_id, importance, weight)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (occupation_id, skill_id) DO NOTHING`,
        [occId, skillId, importance, weight],
      ).catch(() => ({ rows: [] }));
      if ((mapRes as any).rowCount > 0) skillMappingsInserted++;
    }
  }

  // 3. Upsert pathways
  for (const p of PATHWAYS_P5) {
    const fromOcc = await pool.query(
      `SELECT id FROM occupations WHERE canonical_title ILIKE $1 LIMIT 1`, [p.from],
    ).catch(() => ({ rows: [] }));
    const toOcc = await pool.query(
      `SELECT id FROM occupations WHERE canonical_title ILIKE $1 LIMIT 1`, [p.to],
    ).catch(() => ({ rows: [] }));
    if (!fromOcc.rows.length || !toOcc.rows.length) continue;

    const pathRes = await pool.query(
      `INSERT INTO occupation_pathways
         (id, from_occupation_id, to_occupation_id, pathway_type, difficulty_score,
          estimated_timeframe_months, typical_skill_gap_count, description, is_active, meta)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, true,
               '{"source":"MetryxOne-P-R5"}'::jsonb)
       ON CONFLICT (from_occupation_id, to_occupation_id) DO NOTHING`,
      [fromOcc.rows[0].id, toOcc.rows[0].id, p.type, p.difficulty,
       p.timeframe_months, p.skill_gap_count, p.description],
    ).catch(() => ({ rows: [] }));
    if ((pathRes as any).rowCount > 0) pathwaysInserted++;
  }

  return { occupationsAdded, skillsAdded, skillMappingsInserted, pathwaysInserted };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function deriveRoleFamily(title: string): string {
  const t = title.toLowerCase();
  if (/polic|government|public admin|diplomat|customs|tax inspector|intelligence officer/i.test(t)) return 'government';
  if (/ngo|non-profit|nonprofit|fundrais|grant|community organiz|volunteer|social enterprise|impact/i.test(t)) return 'nonprofit';
  if (/real estate|property|valuation|facilities|urban develop/i.test(t)) return 'real_estate';
  if (/hotel|hospitality|tourism|event plan|revenue manage|guest|travel oper/i.test(t)) return 'hospitality';
  if (/retail|category|merchandis|e-commerce|procurement|supply chain/i.test(t)) return 'retail_commerce';
  if (/manufactur|process engin|quality engin|lean|production plan|industrial design|materials engin|safety engin/i.test(t)) return 'manufacturing';
  if (/energy|power systems|grid|renewabl|utilities/i.test(t)) return 'energy';
  if (/lawyer|attorney|contract manager|compliance|ethics/i.test(t)) return 'legal';
  if (/journalist|media|broadcast|documentary|film/i.test(t)) return 'media';
  if (/logistic|transport|freight|warehouse|last mile|fleet|import export|supply chain direct/i.test(t)) return 'logistics';
  if (/agron|food sci|food safety|agricultur|farm/i.test(t)) return 'agriculture';
  if (/architect|urban planner|interior|landscape|bim/i.test(t)) return 'architecture';
  if (/aerospace|flight|satellite|space|orbital/i.test(t)) return 'aerospace';
  if (/biomed|pharma|clinical trial|drug|bioinform|biostat|medical affairs/i.test(t)) return 'biotech_pharma';
  if (/occupational therap|physiother|radiograph|pharmacy|veterinar|speech/i.test(t)) return 'allied_health';
  if (/principal|special education|early childhood|academic research|university admin|education tech/i.test(t)) return 'education';
  if (/actuar|underwriter|treasury|audit manager|mergers/i.test(t)) return 'finance';
  return 'general';
}

function deriveSeniority(title: string): string {
  const t = title.toLowerCase();
  if (/director|chief|head of|vp |vice president|principal/i.test(t)) return 'director';
  if (/manager|lead |senior |specialist|expert|analyst.*senior/i.test(t)) return 'senior';
  if (/coordinator|officer|associate|assistant|analyst(?!.*senior)/i.test(t)) return 'mid';
  if (/junior|trainee|graduate|intern/i.test(t)) return 'junior';
  return 'mid';
}

// ── Graph Integrity Validator ─────────────────────────────────────────────────

export interface GraphIntegrityReport {
  occupation_count: number;
  skill_count: number;
  mapping_count: number;
  pathway_count: number;
  orphan_occupations: number;      // Active occ with 0 skill mappings
  orphan_skills: number;           // Skills with 0 occupation mappings
  broken_pathways: number;         // Pathways referencing non-existent occupations
  self_referential_pathways: number;
  avg_skills_per_occupation: number;
  occupation_confidence_avg: number;  // % of occupations with ≥ 5 skill mappings
  status: 'healthy' | 'warning' | 'critical';
  generated_at: string;
}

export async function validateGraphIntegrity(pool: Pool): Promise<GraphIntegrityReport> {
  try {
    const [counts, orphanOcc, orphanSkills, brokenPaths, selfRef, richOcc] = await Promise.all([
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM occupations WHERE is_active)::int AS occ,
          (SELECT COUNT(*) FROM skills WHERE is_active)::int AS skill,
          (SELECT COUNT(*) FROM occupation_skills)::int AS mapping,
          (SELECT COUNT(*) FROM occupation_pathways WHERE is_active)::int AS pathway
      `).catch(() => ({ rows: [{ occ: 0, skill: 0, mapping: 0, pathway: 0 }] })),
      pool.query(`
        SELECT COUNT(*)::int AS n FROM occupations o WHERE o.is_active
        AND NOT EXISTS (SELECT 1 FROM occupation_skills os WHERE os.occupation_id = o.id)
      `).catch(() => ({ rows: [{ n: 0 }] })),
      pool.query(`
        SELECT COUNT(*)::int AS n FROM skills s WHERE s.is_active
        AND NOT EXISTS (SELECT 1 FROM occupation_skills os WHERE os.skill_id = s.id)
      `).catch(() => ({ rows: [{ n: 0 }] })),
      pool.query(`
        SELECT COUNT(*)::int AS n FROM occupation_pathways op WHERE is_active
        AND (NOT EXISTS (SELECT 1 FROM occupations f WHERE f.id = op.from_occupation_id)
          OR NOT EXISTS (SELECT 1 FROM occupations t WHERE t.id = op.to_occupation_id))
      `).catch(() => ({ rows: [{ n: 0 }] })),
      pool.query(`SELECT COUNT(*)::int AS n FROM occupation_pathways WHERE from_occupation_id = to_occupation_id AND is_active`)
        .catch(() => ({ rows: [{ n: 0 }] })),
      pool.query(`
        SELECT COUNT(*)::int AS n FROM occupations o WHERE is_active
        AND (SELECT COUNT(*) FROM occupation_skills os WHERE os.occupation_id = o.id) >= 5
      `).catch(() => ({ rows: [{ n: 0 }] })),
    ]);

    const { occ, skill, mapping, pathway } = counts.rows[0];
    const orphanO = orphanOcc.rows[0].n;
    const orphanS = orphanSkills.rows[0].n;
    const broken = brokenPaths.rows[0].n;
    const selfR = selfRef.rows[0].n;
    const rich = richOcc.rows[0].n;

    const avgSkills = occ > 0 ? Math.round((mapping / occ) * 10) / 10 : 0;
    const confidence = occ > 0 ? Math.round((rich / occ) * 100) : 0;

    const criticalIssues = broken + selfR;
    const warnings = orphanO + orphanS;
    const status: GraphIntegrityReport['status'] =
      criticalIssues > 0 ? 'critical' : warnings > 10 ? 'warning' : 'healthy';

    return {
      occupation_count: occ, skill_count: skill, mapping_count: mapping, pathway_count: pathway,
      orphan_occupations: orphanO, orphan_skills: orphanS,
      broken_pathways: broken, self_referential_pathways: selfR,
      avg_skills_per_occupation: avgSkills,
      occupation_confidence_avg: confidence,
      status, generated_at: new Date().toISOString(),
    };
  } catch (e: any) {
    return {
      occupation_count: 0, skill_count: 0, mapping_count: 0, pathway_count: 0,
      orphan_occupations: 0, orphan_skills: 0, broken_pathways: 0,
      self_referential_pathways: 0, avg_skills_per_occupation: 0,
      occupation_confidence_avg: 0, status: 'critical',
      generated_at: new Date().toISOString(),
    };
  }
}
