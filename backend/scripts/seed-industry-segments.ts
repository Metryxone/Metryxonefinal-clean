/**
 * Industry Segments Starter Seed — runner.
 * Populates ont_industry_segments (sub-industry, child of ont_industries) with a
 * curated set of GENUINE real-world sub-segments for ~30 major industries — the
 * same kind of curated reference taxonomy the team's genome seed authors.
 *
 * Not fabricated analytics: these are well-established industry sub-segments
 * (e.g. Banking → Retail / Corporate / Investment / Private). It is a pilot
 * subset, NOT an exhaustive segmentation of all 206 industries.
 *
 * Idempotent: every INSERT is ON CONFLICT (code) DO NOTHING.
 * Reversible: DELETE FROM ont_industry_segments WHERE code LIKE 'SEG\_%' ESCAPE '\';
 *
 * Usage: cd backend && npx tsx scripts/seed-industry-segments.ts
 */
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

type Seg = { code: string; name: string; description: string };
type Group = { industryCode: string; segments: Seg[] };

const GROUPS: Group[] = [
  // ── Technology ──────────────────────────────────────────────────────────
  { industryCode: 'IND_TECH_SAAS', segments: [
    { code: 'SEG_SAAS_HORIZ', name: 'Horizontal SaaS', description: 'Cross-industry software addressing a common function (CRM, HR, finance).' },
    { code: 'SEG_SAAS_VERT',  name: 'Vertical SaaS', description: 'Software purpose-built for a single industry vertical.' },
    { code: 'SEG_SAAS_B2B',   name: 'B2B SaaS', description: 'Subscription software sold to businesses and enterprises.' },
    { code: 'SEG_SAAS_PLG',   name: 'Product-Led SaaS', description: 'Self-serve, product-led-growth SaaS with bottom-up adoption.' },
  ]},
  { industryCode: 'IND_TECH_CYBER', segments: [
    { code: 'SEG_CYBER_NET',   name: 'Network Security', description: 'Firewalls, intrusion detection, and network perimeter defence.' },
    { code: 'SEG_CYBER_APP',   name: 'Application Security', description: 'Securing software through the SDLC and runtime protection.' },
    { code: 'SEG_CYBER_CLOUD', name: 'Cloud Security', description: 'Posture management and workload protection for cloud platforms.' },
    { code: 'SEG_CYBER_IAM',   name: 'Identity & Access Management', description: 'Authentication, authorization, and privileged-access control.' },
    { code: 'SEG_CYBER_ENDPT', name: 'Endpoint Security', description: 'Protection and detection across user and device endpoints.' },
  ]},
  { industryCode: 'IND_TECH_AI', segments: [
    { code: 'SEG_AI_ML',     name: 'Machine Learning', description: 'Supervised and unsupervised predictive modelling.' },
    { code: 'SEG_AI_GENAI',  name: 'Generative AI', description: 'Large language and diffusion models for content generation.' },
    { code: 'SEG_AI_CV',     name: 'Computer Vision', description: 'Image and video understanding and recognition.' },
    { code: 'SEG_AI_NLP',    name: 'Natural Language Processing', description: 'Language understanding, translation, and conversational AI.' },
    { code: 'SEG_AI_MLOPS',  name: 'MLOps & AI Infrastructure', description: 'Tooling for deploying, serving, and monitoring AI models.' },
  ]},
  { industryCode: 'IND_TECH_CLOUD', segments: [
    { code: 'SEG_CLOUD_IAAS',   name: 'Infrastructure as a Service', description: 'On-demand compute, storage, and networking.' },
    { code: 'SEG_CLOUD_PAAS',   name: 'Platform as a Service', description: 'Managed application platforms and developer services.' },
    { code: 'SEG_CLOUD_HYBRID', name: 'Hybrid & Multi-Cloud', description: 'Workloads spanning private and multiple public clouds.' },
    { code: 'SEG_CLOUD_EDGE',   name: 'Edge & CDN', description: 'Compute and delivery at the network edge.' },
  ]},
  { industryCode: 'IND_TECH_DATA', segments: [
    { code: 'SEG_DATA_BI',   name: 'Business Intelligence', description: 'Dashboards, reporting, and self-service analytics.' },
    { code: 'SEG_DATA_ENG',  name: 'Data Engineering', description: 'Pipelines, warehouses, and large-scale data processing.' },
    { code: 'SEG_DATA_SCI',  name: 'Data Science', description: 'Statistical modelling and advanced analytics.' },
    { code: 'SEG_DATA_GOV',  name: 'Data Governance', description: 'Cataloguing, lineage, quality, and compliance of data.' },
  ]},
  { industryCode: 'IND_TECH_ITS', segments: [
    { code: 'SEG_ITS_APPDEV', name: 'Application Development', description: 'Custom software design and build services.' },
    { code: 'SEG_ITS_CONSULT',name: 'IT Consulting', description: 'Technology strategy and advisory services.' },
    { code: 'SEG_ITS_MANAGED',name: 'Managed Services', description: 'Outsourced operation and support of IT systems.' },
    { code: 'SEG_ITS_SI',     name: 'System Integration', description: 'Integrating disparate systems and platforms.' },
  ]},
  // ── Financial Services ──────────────────────────────────────────────────
  { industryCode: 'IND_FIN_BANK', segments: [
    { code: 'SEG_BANK_RETAIL', name: 'Retail Banking', description: 'Deposits, loans, and services for individual consumers.' },
    { code: 'SEG_BANK_CORP',   name: 'Corporate Banking', description: 'Banking and credit for businesses and corporations.' },
    { code: 'SEG_BANK_INVEST', name: 'Investment Banking', description: 'Capital raising, M&A, and advisory services.' },
    { code: 'SEG_BANK_PRIVATE',name: 'Private Banking', description: 'Wealth and banking services for high-net-worth clients.' },
  ]},
  { industryCode: 'IND_FIN_INS', segments: [
    { code: 'SEG_INS_LIFE',   name: 'Life Insurance', description: 'Life, term, and endowment insurance products.' },
    { code: 'SEG_INS_GEN',    name: 'General Insurance', description: 'Property, motor, and casualty insurance.' },
    { code: 'SEG_INS_HEALTH', name: 'Health Insurance', description: 'Medical and health-cover insurance products.' },
    { code: 'SEG_INS_REINS',  name: 'Reinsurance', description: 'Risk transfer between insurers.' },
  ]},
  { industryCode: 'IND_FIN_FINTECH', segments: [
    { code: 'SEG_FINTECH_PAY',  name: 'Payments', description: 'Digital payment processing and infrastructure.' },
    { code: 'SEG_FINTECH_LEND', name: 'Lending Technology', description: 'Digital lending and credit underwriting platforms.' },
    { code: 'SEG_FINTECH_WEALTH',name: 'WealthTech', description: 'Digital investing, robo-advisory, and wealth platforms.' },
    { code: 'SEG_FINTECH_REG',  name: 'RegTech', description: 'Technology for regulatory compliance and reporting.' },
  ]},
  { industryCode: 'IND_FIN_PAY', segments: [
    { code: 'SEG_PAY_UPI',    name: 'UPI & Mobile Payments', description: 'Real-time mobile and UPI-based payment rails.' },
    { code: 'SEG_PAY_CARD',   name: 'Card Networks', description: 'Credit, debit, and prepaid card processing.' },
    { code: 'SEG_PAY_GATEWAY',name: 'Payment Gateways', description: 'Online merchant payment acceptance.' },
    { code: 'SEG_PAY_XBORDER',name: 'Cross-Border Payments', description: 'International remittance and settlement.' },
  ]},
  // ── Healthcare ──────────────────────────────────────────────────────────
  { industryCode: 'IND_HEALTH_HOSP', segments: [
    { code: 'SEG_HOSP_MULTI',  name: 'Multi-Specialty Hospitals', description: 'Hospitals offering a broad range of specialties.' },
    { code: 'SEG_HOSP_SINGLE', name: 'Single-Specialty Hospitals', description: 'Focused hospitals (cardiac, ortho, eye, etc.).' },
    { code: 'SEG_HOSP_TERT',   name: 'Tertiary & Quaternary Care', description: 'Advanced specialised and referral care.' },
    { code: 'SEG_HOSP_PRIM',   name: 'Primary & Community Care', description: 'First-contact and community health facilities.' },
  ]},
  { industryCode: 'IND_HEALTH_PHARMA', segments: [
    { code: 'SEG_PHARMA_GEN',  name: 'Generics', description: 'Off-patent equivalent drug manufacturing.' },
    { code: 'SEG_PHARMA_FORM', name: 'Formulations', description: 'Finished-dosage drug products.' },
    { code: 'SEG_PHARMA_API',  name: 'APIs & Bulk Drugs', description: 'Active pharmaceutical ingredient manufacturing.' },
    { code: 'SEG_PHARMA_BIO',  name: 'Biosimilars & Biologics', description: 'Biologic and biosimilar therapeutics.' },
  ]},
  { industryCode: 'IND_HEALTH_DIAG', segments: [
    { code: 'SEG_DIAG_PATH',  name: 'Pathology & Laboratory', description: 'Clinical laboratory and pathology testing.' },
    { code: 'SEG_DIAG_RAD',   name: 'Radiology & Imaging', description: 'Diagnostic imaging and radiology services.' },
    { code: 'SEG_DIAG_MOL',   name: 'Molecular Diagnostics', description: 'Genomic and molecular-level testing.' },
    { code: 'SEG_DIAG_POC',   name: 'Point-of-Care', description: 'Decentralised, near-patient diagnostics.' },
  ]},
  { industryCode: 'IND_HEALTH_MED', segments: [
    { code: 'SEG_MED_DIAGDEV', name: 'Diagnostic Devices', description: 'Devices used for clinical diagnosis.' },
    { code: 'SEG_MED_SURG',    name: 'Surgical Devices', description: 'Instruments and devices used in surgery.' },
    { code: 'SEG_MED_IMPLANT', name: 'Implants & Prosthetics', description: 'Implantable and prosthetic devices.' },
    { code: 'SEG_MED_WEAR',    name: 'Wearable Medical', description: 'Connected and wearable health devices.' },
  ]},
  { industryCode: 'IND_HEALTH_MH', segments: [
    { code: 'SEG_MH_CLINPSY', name: 'Clinical Psychology', description: 'Assessment and psychological therapy.' },
    { code: 'SEG_MH_PSYCH',   name: 'Psychiatry', description: 'Medical diagnosis and treatment of mental illness.' },
    { code: 'SEG_MH_COUNSEL', name: 'Counseling & Therapy', description: 'Counselling, coaching, and talk therapy.' },
    { code: 'SEG_MH_DIGITAL', name: 'Digital Mental Health', description: 'App-based and tele-mental-health services.' },
  ]},
  // ── Manufacturing & Industrial ──────────────────────────────────────────
  { industryCode: 'IND_MFG_AUTO', segments: [
    { code: 'SEG_AUTO_PV',    name: 'Passenger Vehicles', description: 'Cars and personal passenger vehicles.' },
    { code: 'SEG_AUTO_CV',    name: 'Commercial Vehicles', description: 'Trucks, buses, and commercial transport.' },
    { code: 'SEG_AUTO_2W',    name: 'Two & Three Wheelers', description: 'Motorcycles, scooters, and three-wheelers.' },
    { code: 'SEG_AUTO_COMP',  name: 'Auto Components', description: 'Parts and components supply for OEMs.' },
  ]},
  { industryCode: 'IND_MFG_ELEC', segments: [
    { code: 'SEG_ELEC_CONS', name: 'Consumer Electronics', description: 'Devices and appliances for end consumers.' },
    { code: 'SEG_ELEC_IND',  name: 'Industrial Electronics', description: 'Electronics for industrial equipment.' },
    { code: 'SEG_ELEC_EMS',  name: 'Electronics Manufacturing Services', description: 'Contract electronics assembly (EMS/ODM).' },
    { code: 'SEG_ELEC_PCB',  name: 'PCB & Components', description: 'Printed circuit boards and components.' },
  ]},
  { industryCode: 'IND_MFG_TEXTILE', segments: [
    { code: 'SEG_TEX_APPAREL', name: 'Apparel & Garments', description: 'Clothing design and manufacturing.' },
    { code: 'SEG_TEX_TECH',    name: 'Technical Textiles', description: 'Functional textiles for industrial use.' },
    { code: 'SEG_TEX_HOME',    name: 'Home Textiles', description: 'Furnishings, linens, and home fabrics.' },
    { code: 'SEG_TEX_YARN',    name: 'Yarn & Fabric', description: 'Spinning, weaving, and fabric production.' },
  ]},
  { industryCode: 'IND_MFG_STEEL', segments: [
    { code: 'SEG_STEEL_FLAT', name: 'Flat Steel', description: 'Sheets, coils, and plates.' },
    { code: 'SEG_STEEL_LONG', name: 'Long Steel', description: 'Bars, rods, and structural sections.' },
    { code: 'SEG_STEEL_ALLOY',name: 'Alloy & Specialty Steel', description: 'High-grade and specialty alloys.' },
    { code: 'SEG_STEEL_NONF', name: 'Non-Ferrous Metals', description: 'Aluminium, copper, and other non-ferrous metals.' },
  ]},
  { industryCode: 'IND_MFG_AERO', segments: [
    { code: 'SEG_AERO_COMM', name: 'Commercial Aviation', description: 'Civil aircraft and commercial aerospace.' },
    { code: 'SEG_AERO_DEF',  name: 'Defence Aerospace', description: 'Military aircraft and defence systems.' },
    { code: 'SEG_AERO_MRO',  name: 'MRO', description: 'Maintenance, repair, and overhaul services.' },
    { code: 'SEG_AERO_AVION',name: 'Avionics', description: 'Aircraft electronic systems.' },
  ]},
  // ── Commerce ────────────────────────────────────────────────────────────
  { industryCode: 'IND_RETAIL', segments: [
    { code: 'SEG_RETAIL_MKT',  name: 'Marketplace', description: 'Multi-seller online marketplaces.' },
    { code: 'SEG_RETAIL_D2C',  name: 'Direct-to-Consumer', description: 'Brands selling directly to consumers.' },
    { code: 'SEG_RETAIL_OMNI', name: 'Omnichannel Retail', description: 'Integrated online and offline retail.' },
    { code: 'SEG_RETAIL_GROC', name: 'Grocery & Quick Commerce', description: 'Grocery and rapid-delivery retail.' },
  ]},
  { industryCode: 'IND_FMCG', segments: [
    { code: 'SEG_FMCG_FNB',   name: 'Food & Beverages', description: 'Packaged food and beverage products.' },
    { code: 'SEG_FMCG_PERS',  name: 'Personal Care', description: 'Beauty, hygiene, and personal-care products.' },
    { code: 'SEG_FMCG_HOME',  name: 'Home Care', description: 'Cleaning and household products.' },
    { code: 'SEG_FMCG_PACK',  name: 'Packaged Staples', description: 'Branded staples and packaged commodities.' },
  ]},
  // ── Infrastructure ──────────────────────────────────────────────────────
  { industryCode: 'IND_ENERGY', segments: [
    { code: 'SEG_ENERGY_GEN',  name: 'Power Generation', description: 'Electricity generation across sources.' },
    { code: 'SEG_ENERGY_DIST', name: 'Power Distribution', description: 'Distribution and supply to consumers.' },
    { code: 'SEG_ENERGY_REN',  name: 'Renewable Energy', description: 'Solar, wind, and other renewables.' },
    { code: 'SEG_ENERGY_OG',   name: 'Oil & Gas', description: 'Hydrocarbon exploration, refining, and supply.' },
  ]},
  { industryCode: 'IND_SOLAR', segments: [
    { code: 'SEG_SOLAR_UTIL', name: 'Utility-Scale Solar', description: 'Large grid-connected solar farms.' },
    { code: 'SEG_SOLAR_ROOF', name: 'Rooftop Solar', description: 'Distributed rooftop solar installations.' },
    { code: 'SEG_SOLAR_MFG',  name: 'Solar Manufacturing', description: 'Cells, modules, and equipment manufacturing.' },
    { code: 'SEG_SOLAR_EPC',  name: 'Solar EPC', description: 'Engineering, procurement, and construction.' },
  ]},
  { industryCode: 'IND_TRANS', segments: [
    { code: 'SEG_TRANS_FREIGHT', name: 'Freight & Logistics', description: 'Goods movement and freight forwarding.' },
    { code: 'SEG_TRANS_WARE',    name: 'Warehousing', description: 'Storage, fulfilment, and warehousing.' },
    { code: 'SEG_TRANS_LASTMILE',name: 'Last-Mile Delivery', description: 'Final-leg delivery to end customers.' },
    { code: 'SEG_TRANS_SCTECH',  name: 'Supply Chain Technology', description: 'Software and visibility for supply chains.' },
  ]},
  // ── Education ───────────────────────────────────────────────────────────
  { industryCode: 'IND_EDU', segments: [
    { code: 'SEG_EDU_K12',    name: 'K-12 Education', description: 'School-level learning and curricula.' },
    { code: 'SEG_EDU_HIGHER', name: 'Higher Education', description: 'Colleges, universities, and degrees.' },
    { code: 'SEG_EDU_TEST',   name: 'Test Preparation', description: 'Competitive and entrance exam prep.' },
    { code: 'SEG_EDU_UPSKILL',name: 'Professional Upskilling', description: 'Working-professional skilling and certification.' },
  ]},
  { industryCode: 'IND_SKILLTECH', segments: [
    { code: 'SEG_SKILL_VOC',   name: 'Vocational Training', description: 'Trade and vocational skill development.' },
    { code: 'SEG_SKILL_DIG',   name: 'Digital Skilling', description: 'Technology and digital-skills training.' },
    { code: 'SEG_SKILL_CERT',  name: 'Certification Programs', description: 'Industry-recognised certifications.' },
    { code: 'SEG_SKILL_APP',   name: 'Apprenticeships', description: 'Work-integrated apprenticeship programs.' },
  ]},
  // ── Government ──────────────────────────────────────────────────────────
  { industryCode: 'IND_GOV', segments: [
    { code: 'SEG_GOV_CENTRAL', name: 'Central Government', description: 'Union/federal government departments.' },
    { code: 'SEG_GOV_STATE',   name: 'State Government', description: 'State-level departments and agencies.' },
    { code: 'SEG_GOV_ULB',     name: 'Urban Local Bodies', description: 'Municipalities and urban governance.' },
    { code: 'SEG_GOV_PSU',     name: 'Public Sector Undertakings', description: 'Government-owned enterprises.' },
  ]},
  { industryCode: 'IND_EGOV', segments: [
    { code: 'SEG_EGOV_CITIZEN', name: 'Citizen Services', description: 'Digital delivery of citizen services.' },
    { code: 'SEG_EGOV_ID',      name: 'Digital Identity', description: 'Identity and authentication infrastructure.' },
    { code: 'SEG_EGOV_PLATFORM',name: 'GovTech Platforms', description: 'Platforms powering public-sector workflows.' },
    { code: 'SEG_EGOV_DATA',    name: 'Public Data Systems', description: 'Open data and public information systems.' },
  ]},
  // ── Professional Services ───────────────────────────────────────────────
  { industryCode: 'IND_PROF', segments: [
    { code: 'SEG_PROF_MGMT',  name: 'Management Consulting', description: 'Strategy and operations advisory.' },
    { code: 'SEG_PROF_LEGAL', name: 'Legal Services', description: 'Legal advisory and litigation services.' },
    { code: 'SEG_PROF_AUDIT', name: 'Accounting & Audit', description: 'Audit, assurance, and accounting services.' },
    { code: 'SEG_PROF_HR',    name: 'HR & Talent Consulting', description: 'Talent, HR, and organisation advisory.' },
  ]},
  // ── Creative ────────────────────────────────────────────────────────────
  { industryCode: 'IND_MEDIA', segments: [
    { code: 'SEG_MEDIA_FILM', name: 'Film & Television', description: 'Film and broadcast content production.' },
    { code: 'SEG_MEDIA_OTT',  name: 'OTT & Streaming', description: 'Over-the-top and streaming platforms.' },
    { code: 'SEG_MEDIA_GAME', name: 'Gaming & Esports', description: 'Game development and competitive gaming.' },
    { code: 'SEG_MEDIA_PUB',  name: 'Publishing', description: 'Print and digital publishing.' },
  ]},
];

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });
  let created = 0, skippedExisting = 0, missingIndustry = 0;
  const missing: string[] = [];
  try {
    let sort = 0;
    for (const g of GROUPS) {
      const { rows: [ind] } = await pool.query<{ id: number }>(
        'SELECT id FROM ont_industries WHERE code = $1', [g.industryCode]);
      if (!ind) { missingIndustry++; missing.push(g.industryCode); continue; }
      for (const s of g.segments) {
        const ins = await pool.query(
          `INSERT INTO ont_industry_segments (code, name, description, industry_id, status, is_active, sort_order)
           VALUES ($1,$2,$3,$4,'published',true,$5)
           ON CONFLICT (code) DO NOTHING RETURNING id`,
          [s.code, s.name, s.description, ind.id, sort++]);
        if (ins.rowCount) created++; else skippedExisting++;
      }
    }
    const { rows: [{ total }] } = await pool.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM ont_industry_segments WHERE code LIKE 'SEG\\_%' ESCAPE '\\'`);
    console.log(`Industry segments seed complete.`);
    console.log(`  created (new):       ${created}`);
    console.log(`  skipped (existing):  ${skippedExisting}`);
    console.log(`  missing industries:  ${missingIndustry}${missing.length ? ` (${missing.join(', ')})` : ''}`);
    console.log(`  total SEG_* rows:    ${total}`);
    if (missingIndustry > 0) {
      console.error(`\nFAIL: ${missingIndustry} parent industr${missingIndustry === 1 ? 'y was' : 'ies were'} not found — partial seed. Fix the industry codes and re-run.`);
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
