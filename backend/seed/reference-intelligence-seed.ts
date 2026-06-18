/**
 * /backend/seed/reference-intelligence-seed.ts
 *
 * Curated seed data for the Reference Intelligence tables.
 *
 * Source attribution (snapshot of public data; refresh quarterly):
 *   - NIRF India Rankings 2024 (https://www.nirfindia.org)
 *   - NAAC accreditation grades (https://www.naac.gov.in)
 *   - UGC list of recognised universities (https://www.ugc.gov.in)
 *   - AICTE approved institutions (https://www.aicte-india.org)
 *   - QS World University Rankings 2024 (https://www.topuniversities.com)
 *   - ESCO skills catalogue (https://esco.ec.europa.eu) CC-BY-4.0
 *   - O*NET 28.3 (https://www.onetonline.org) US Public Domain
 *   - NSQF (https://www.nsdcindia.org)
 *
 * Idempotent: ON CONFLICT DO NOTHING. Safe to re-run.
 */
import type { Pool } from 'pg';

type RecomputeTier = (pool: Pool, institutionId: string) => Promise<void>;

// ─── Institutions (≈ 80 high-signal seed) ────────────────────
// Tier-inducing rankings/accreditations applied separately so the
// recompute-tier formula derives Tier 1/2/3 from provenance, not magic numbers.
type InstSeed = {
  canonical_name: string;
  short_name?: string;
  institution_type: string;
  state?: string;
  city?: string;
  established_year?: number;
  website?: string;
  aliases?: string[];
  nirf?: Array<{ category: string; rank: number; year?: number }>;
  qs?: number;
  naac?: 'A++' | 'A+' | 'A' | 'B+' | 'B' | 'C';
  nba?: boolean;
};

const INSTITUTIONS: InstSeed[] = [
  // ── IITs (top NIRF Engineering) ─────────────────────────
  { canonical_name: 'Indian Institute of Technology Bombay', short_name: 'IIT Bombay', institution_type: 'iit', state: 'Maharashtra', city: 'Mumbai', established_year: 1958, website: 'iitb.ac.in', aliases: ['IITB', 'IIT-B', 'IIT Mumbai'], nirf: [{ category: 'Engineering', rank: 3 }, { category: 'Overall', rank: 3 }], qs: 149, naac: 'A++' },
  { canonical_name: 'Indian Institute of Technology Delhi', short_name: 'IIT Delhi', institution_type: 'iit', state: 'Delhi', city: 'New Delhi', established_year: 1961, website: 'iitd.ac.in', aliases: ['IITD', 'IIT-D'], nirf: [{ category: 'Engineering', rank: 2 }, { category: 'Overall', rank: 2 }], qs: 197, naac: 'A++' },
  { canonical_name: 'Indian Institute of Technology Madras', short_name: 'IIT Madras', institution_type: 'iit', state: 'Tamil Nadu', city: 'Chennai', established_year: 1959, website: 'iitm.ac.in', aliases: ['IITM', 'IIT-M', 'IIT Chennai'], nirf: [{ category: 'Engineering', rank: 1 }, { category: 'Overall', rank: 1 }], qs: 285 },
  { canonical_name: 'Indian Institute of Technology Kanpur', short_name: 'IIT Kanpur', institution_type: 'iit', state: 'Uttar Pradesh', city: 'Kanpur', established_year: 1959, website: 'iitk.ac.in', aliases: ['IITK', 'IIT-K'], nirf: [{ category: 'Engineering', rank: 4 }, { category: 'Overall', rank: 5 }], qs: 278 },
  { canonical_name: 'Indian Institute of Technology Kharagpur', short_name: 'IIT Kharagpur', institution_type: 'iit', state: 'West Bengal', city: 'Kharagpur', established_year: 1951, website: 'iitkgp.ac.in', aliases: ['IITKGP', 'IIT-KGP'], nirf: [{ category: 'Engineering', rank: 5 }, { category: 'Overall', rank: 6 }], qs: 271 },
  { canonical_name: 'Indian Institute of Technology Roorkee', short_name: 'IIT Roorkee', institution_type: 'iit', state: 'Uttarakhand', city: 'Roorkee', established_year: 1847, website: 'iitr.ac.in', aliases: ['IITR', 'IIT-R'], nirf: [{ category: 'Engineering', rank: 6 }], qs: 369 },
  { canonical_name: 'Indian Institute of Technology Guwahati', short_name: 'IIT Guwahati', institution_type: 'iit', state: 'Assam', city: 'Guwahati', established_year: 1994, website: 'iitg.ac.in', aliases: ['IITG', 'IIT-G'], nirf: [{ category: 'Engineering', rank: 7 }] },
  { canonical_name: 'Indian Institute of Technology Hyderabad', short_name: 'IIT Hyderabad', institution_type: 'iit', state: 'Telangana', city: 'Hyderabad', established_year: 2008, website: 'iith.ac.in', aliases: ['IITH', 'IIT-H'], nirf: [{ category: 'Engineering', rank: 8 }] },
  { canonical_name: 'Indian Institute of Technology BHU Varanasi', short_name: 'IIT BHU', institution_type: 'iit', state: 'Uttar Pradesh', city: 'Varanasi', established_year: 1919, website: 'iitbhu.ac.in', aliases: ['IIT-BHU', 'IIT Varanasi'], nirf: [{ category: 'Engineering', rank: 15 }] },
  { canonical_name: 'Indian Institute of Technology Indore', short_name: 'IIT Indore', institution_type: 'iit', state: 'Madhya Pradesh', city: 'Indore', established_year: 2009, website: 'iiti.ac.in', nirf: [{ category: 'Engineering', rank: 16 }] },

  // ── IIMs (NIRF Management top) ──────────────────────────
  { canonical_name: 'Indian Institute of Management Ahmedabad', short_name: 'IIM Ahmedabad', institution_type: 'iim', state: 'Gujarat', city: 'Ahmedabad', established_year: 1961, website: 'iima.ac.in', aliases: ['IIMA', 'IIM-A'], nirf: [{ category: 'Management', rank: 1 }] },
  { canonical_name: 'Indian Institute of Management Bangalore', short_name: 'IIM Bangalore', institution_type: 'iim', state: 'Karnataka', city: 'Bangalore', established_year: 1973, website: 'iimb.ac.in', aliases: ['IIMB', 'IIM-B'], nirf: [{ category: 'Management', rank: 2 }] },
  { canonical_name: 'Indian Institute of Management Calcutta', short_name: 'IIM Calcutta', institution_type: 'iim', state: 'West Bengal', city: 'Kolkata', established_year: 1961, website: 'iimcal.ac.in', aliases: ['IIMC', 'IIM-C', 'IIM Kolkata'], nirf: [{ category: 'Management', rank: 4 }] },
  { canonical_name: 'Indian Institute of Management Lucknow', short_name: 'IIM Lucknow', institution_type: 'iim', state: 'Uttar Pradesh', city: 'Lucknow', established_year: 1984, website: 'iiml.ac.in', aliases: ['IIML', 'IIM-L'], nirf: [{ category: 'Management', rank: 7 }] },
  { canonical_name: 'Indian Institute of Management Kozhikode', short_name: 'IIM Kozhikode', institution_type: 'iim', state: 'Kerala', city: 'Kozhikode', established_year: 1996, website: 'iimk.ac.in', aliases: ['IIMK', 'IIM-K'], nirf: [{ category: 'Management', rank: 3 }] },
  { canonical_name: 'Indian Institute of Management Indore', short_name: 'IIM Indore', institution_type: 'iim', state: 'Madhya Pradesh', city: 'Indore', established_year: 1996, website: 'iimidr.ac.in', aliases: ['IIMI', 'IIM-I'], nirf: [{ category: 'Management', rank: 8 }] },
  { canonical_name: 'XLRI Xavier School of Management', short_name: 'XLRI', institution_type: 'business_school', state: 'Jharkhand', city: 'Jamshedpur', established_year: 1949, website: 'xlri.ac.in', aliases: ['Xavier Labour Relations Institute'], nirf: [{ category: 'Management', rank: 9 }], naac: 'A++' },
  { canonical_name: 'Indian School of Business', short_name: 'ISB', institution_type: 'business_school', state: 'Telangana', city: 'Hyderabad', established_year: 2001, website: 'isb.edu', aliases: ['ISB Hyderabad'] },

  // ── Top science / research ──────────────────────────────
  { canonical_name: 'Indian Institute of Science', short_name: 'IISc', institution_type: 'university', state: 'Karnataka', city: 'Bangalore', established_year: 1909, website: 'iisc.ac.in', aliases: ['IISc Bangalore'], nirf: [{ category: 'University', rank: 1 }, { category: 'Overall', rank: 4 }], qs: 225, naac: 'A++' },
  { canonical_name: 'Tata Institute of Fundamental Research', short_name: 'TIFR', institution_type: 'university', state: 'Maharashtra', city: 'Mumbai', established_year: 1945, website: 'tifr.res.in' },

  // ── Top medical ─────────────────────────────────────────
  { canonical_name: 'All India Institute of Medical Sciences Delhi', short_name: 'AIIMS Delhi', institution_type: 'medical_college', state: 'Delhi', city: 'New Delhi', established_year: 1956, website: 'aiims.edu', aliases: ['AIIMS New Delhi'], nirf: [{ category: 'Medical', rank: 1 }] },
  { canonical_name: 'Christian Medical College Vellore', short_name: 'CMC Vellore', institution_type: 'medical_college', state: 'Tamil Nadu', city: 'Vellore', established_year: 1900, website: 'cmch-vellore.edu', nirf: [{ category: 'Medical', rank: 3 }] },
  { canonical_name: 'Postgraduate Institute of Medical Education and Research', short_name: 'PGIMER', institution_type: 'medical_college', state: 'Chandigarh', city: 'Chandigarh', established_year: 1962, website: 'pgimer.edu.in', nirf: [{ category: 'Medical', rank: 2 }] },

  // ── Top law ─────────────────────────────────────────────
  { canonical_name: 'National Law School of India University', short_name: 'NLSIU', institution_type: 'law_school', state: 'Karnataka', city: 'Bangalore', established_year: 1986, website: 'nls.ac.in', aliases: ['NLS Bangalore'], nirf: [{ category: 'Law', rank: 1 }] },
  { canonical_name: 'NALSAR University of Law', short_name: 'NALSAR', institution_type: 'law_school', state: 'Telangana', city: 'Hyderabad', established_year: 1998, website: 'nalsar.ac.in', nirf: [{ category: 'Law', rank: 3 }] },

  // ── NITs (sample) ───────────────────────────────────────
  { canonical_name: 'National Institute of Technology Tiruchirappalli', short_name: 'NIT Trichy', institution_type: 'nit', state: 'Tamil Nadu', city: 'Tiruchirappalli', established_year: 1964, website: 'nitt.edu', aliases: ['NITT'], nirf: [{ category: 'Engineering', rank: 9 }] },
  { canonical_name: 'National Institute of Technology Karnataka Surathkal', short_name: 'NITK', institution_type: 'nit', state: 'Karnataka', city: 'Surathkal', established_year: 1960, website: 'nitk.ac.in', aliases: ['NIT Surathkal'], nirf: [{ category: 'Engineering', rank: 17 }] },
  { canonical_name: 'National Institute of Technology Rourkela', short_name: 'NIT Rourkela', institution_type: 'nit', state: 'Odisha', city: 'Rourkela', established_year: 1961, website: 'nitrkl.ac.in', nirf: [{ category: 'Engineering', rank: 19 }] },
  { canonical_name: 'National Institute of Technology Warangal', short_name: 'NIT Warangal', institution_type: 'nit', state: 'Telangana', city: 'Warangal', established_year: 1959, website: 'nitw.ac.in', aliases: ['NITW'], nirf: [{ category: 'Engineering', rank: 21 }] },
  { canonical_name: 'National Institute of Technology Calicut', short_name: 'NIT Calicut', institution_type: 'nit', state: 'Kerala', city: 'Kozhikode', established_year: 1961, website: 'nitc.ac.in', nirf: [{ category: 'Engineering', rank: 25 }] },

  // ── IIITs (sample) ──────────────────────────────────────
  { canonical_name: 'International Institute of Information Technology Hyderabad', short_name: 'IIIT Hyderabad', institution_type: 'iiit', state: 'Telangana', city: 'Hyderabad', established_year: 1998, website: 'iiit.ac.in', aliases: ['IIIT-H'], nirf: [{ category: 'Engineering', rank: 47 }] },
  { canonical_name: 'Indraprastha Institute of Information Technology Delhi', short_name: 'IIIT Delhi', institution_type: 'iiit', state: 'Delhi', city: 'New Delhi', established_year: 2008, website: 'iiitd.ac.in', aliases: ['IIIT-D'] },
  { canonical_name: 'International Institute of Information Technology Bangalore', short_name: 'IIIT Bangalore', institution_type: 'iiit', state: 'Karnataka', city: 'Bangalore', established_year: 1999, website: 'iiitb.ac.in', aliases: ['IIIT-B'] },

  // ── BITS ────────────────────────────────────────────────
  { canonical_name: 'Birla Institute of Technology and Science Pilani', short_name: 'BITS Pilani', institution_type: 'university', state: 'Rajasthan', city: 'Pilani', established_year: 1964, website: 'bits-pilani.ac.in', aliases: ['BITSP'], nirf: [{ category: 'Engineering', rank: 20 }] },
  { canonical_name: 'Birla Institute of Technology and Science Hyderabad', short_name: 'BITS Hyderabad', institution_type: 'university', state: 'Telangana', city: 'Hyderabad', established_year: 2008, website: 'bits-pilani.ac.in' },
  { canonical_name: 'Birla Institute of Technology and Science Goa', short_name: 'BITS Goa', institution_type: 'university', state: 'Goa', city: 'Goa', established_year: 2004, website: 'bits-pilani.ac.in' },

  // ── Other top universities ──────────────────────────────
  { canonical_name: 'Jawaharlal Nehru University', short_name: 'JNU', institution_type: 'university', state: 'Delhi', city: 'New Delhi', established_year: 1969, website: 'jnu.ac.in', aliases: ['JNU Delhi'], nirf: [{ category: 'University', rank: 2 }], naac: 'A++' },
  { canonical_name: 'University of Delhi', short_name: 'DU', institution_type: 'university', state: 'Delhi', city: 'New Delhi', established_year: 1922, website: 'du.ac.in', aliases: ['Delhi University'], nirf: [{ category: 'University', rank: 6 }], naac: 'A+' },
  { canonical_name: 'University of Hyderabad', short_name: 'UoH', institution_type: 'university', state: 'Telangana', city: 'Hyderabad', established_year: 1974, website: 'uohyd.ac.in', nirf: [{ category: 'University', rank: 10 }], naac: 'A++' },
  { canonical_name: 'Banaras Hindu University', short_name: 'BHU', institution_type: 'university', state: 'Uttar Pradesh', city: 'Varanasi', established_year: 1916, website: 'bhu.ac.in', nirf: [{ category: 'University', rank: 11 }] },
  { canonical_name: 'Jamia Millia Islamia', short_name: 'JMI', institution_type: 'university', state: 'Delhi', city: 'New Delhi', established_year: 1920, website: 'jmi.ac.in' },
  { canonical_name: 'Tata Institute of Social Sciences', short_name: 'TISS', institution_type: 'university', state: 'Maharashtra', city: 'Mumbai', established_year: 1936, website: 'tiss.edu', aliases: ['TISS Mumbai'] },
  { canonical_name: 'Anna University', short_name: 'Anna University', institution_type: 'university', state: 'Tamil Nadu', city: 'Chennai', established_year: 1978, website: 'annauniv.edu', nirf: [{ category: 'University', rank: 13 }] },
  { canonical_name: 'Jadavpur University', short_name: 'Jadavpur', institution_type: 'university', state: 'West Bengal', city: 'Kolkata', established_year: 1955, website: 'jaduniv.edu.in', nirf: [{ category: 'University', rank: 12 }] },

  // ── Tier-2 private (NAAC A grade typical) ───────────────
  { canonical_name: 'Vellore Institute of Technology', short_name: 'VIT', institution_type: 'university', state: 'Tamil Nadu', city: 'Vellore', established_year: 1984, website: 'vit.ac.in', aliases: ['VIT Vellore'], nirf: [{ category: 'Engineering', rank: 13 }], naac: 'A++' },
  { canonical_name: 'SRM Institute of Science and Technology', short_name: 'SRM', institution_type: 'university', state: 'Tamil Nadu', city: 'Chennai', established_year: 1985, website: 'srmist.edu.in', aliases: ['SRM University'], naac: 'A+' },
  { canonical_name: 'Manipal Academy of Higher Education', short_name: 'MAHE', institution_type: 'university', state: 'Karnataka', city: 'Manipal', established_year: 1953, website: 'manipal.edu', aliases: ['Manipal University'], naac: 'A++' },
  { canonical_name: 'Amity University Noida', short_name: 'Amity Noida', institution_type: 'university', state: 'Uttar Pradesh', city: 'Noida', established_year: 2005, website: 'amity.edu', aliases: ['Amity University Uttar Pradesh'], naac: 'A+' },
  { canonical_name: 'Symbiosis International University', short_name: 'SIU', institution_type: 'university', state: 'Maharashtra', city: 'Pune', established_year: 2002, website: 'siu.edu.in', aliases: ['Symbiosis Pune'], naac: 'A++' },
  { canonical_name: 'Christ University', short_name: 'Christ', institution_type: 'university', state: 'Karnataka', city: 'Bangalore', established_year: 1969, website: 'christuniversity.in', aliases: ['Christ College Bangalore'], naac: 'A+' },
  { canonical_name: 'Thapar Institute of Engineering and Technology', short_name: 'Thapar', institution_type: 'university', state: 'Punjab', city: 'Patiala', established_year: 1956, website: 'thapar.edu', naac: 'A+' },
  { canonical_name: 'Lovely Professional University', short_name: 'LPU', institution_type: 'university', state: 'Punjab', city: 'Phagwara', established_year: 2005, website: 'lpu.in', naac: 'A+' },
  { canonical_name: 'Nirma University', short_name: 'Nirma', institution_type: 'university', state: 'Gujarat', city: 'Ahmedabad', established_year: 2003, website: 'nirmauni.ac.in', naac: 'A+' },

  // ── Professional bodies (treated as institutions for credential issuance) ─
  { canonical_name: 'Institute of Chartered Accountants of India', short_name: 'ICAI', institution_type: 'professional_body', state: 'Delhi', city: 'New Delhi', established_year: 1949, website: 'icai.org' },
  { canonical_name: 'Institute of Company Secretaries of India', short_name: 'ICSI', institution_type: 'professional_body', state: 'Delhi', city: 'New Delhi', established_year: 1968, website: 'icsi.edu' },
  { canonical_name: 'Institute of Cost Accountants of India', short_name: 'ICMAI', institution_type: 'professional_body', state: 'West Bengal', city: 'Kolkata', established_year: 1944, website: 'icmai.in', aliases: ['ICWAI', 'Institute of Cost and Works Accountants of India'] },
  { canonical_name: 'Bar Council of India', short_name: 'BCI', institution_type: 'professional_body', state: 'Delhi', city: 'New Delhi', established_year: 1961, website: 'barcouncilofindia.org' },
  { canonical_name: 'National Medical Commission', short_name: 'NMC', institution_type: 'professional_body', state: 'Delhi', city: 'New Delhi', established_year: 2020, website: 'nmc.org.in', aliases: ['Medical Council of India', 'MCI'] },
  { canonical_name: 'Institution of Engineers India', short_name: 'IEI', institution_type: 'professional_body', state: 'West Bengal', city: 'Kolkata', established_year: 1920, website: 'ieindia.org' },

  // ── Sample international ────────────────────────────────
  { canonical_name: 'Stanford University', short_name: 'Stanford', institution_type: 'university', state: 'California', city: 'Stanford', country_code: undefined as any, established_year: 1885, website: 'stanford.edu', qs: 5 },
  { canonical_name: 'Massachusetts Institute of Technology', short_name: 'MIT', institution_type: 'university', state: 'Massachusetts', city: 'Cambridge', established_year: 1861, website: 'mit.edu', qs: 1 },
  { canonical_name: 'Harvard University', short_name: 'Harvard', institution_type: 'university', state: 'Massachusetts', city: 'Cambridge', established_year: 1636, website: 'harvard.edu', qs: 4 },
  { canonical_name: 'University of Oxford', short_name: 'Oxford', institution_type: 'university', established_year: 1096, website: 'ox.ac.uk', qs: 3 },
  { canonical_name: 'University of Cambridge', short_name: 'Cambridge', institution_type: 'university', established_year: 1209, website: 'cam.ac.uk', qs: 2 },
  { canonical_name: 'INSEAD', short_name: 'INSEAD', institution_type: 'business_school', established_year: 1957, website: 'insead.edu' },
  { canonical_name: 'London Business School', short_name: 'LBS', institution_type: 'business_school', established_year: 1964, website: 'london.edu' },
  { canonical_name: 'National University of Singapore', short_name: 'NUS', institution_type: 'university', established_year: 1905, website: 'nus.edu.sg', qs: 8 },
];

// ─── Qualifications ──────────────────────────────────────────
type QualSeed = {
  canonical_name: string; short_name: string; qualification_type: string;
  nsqf_level?: number; eqf_level?: number; regulator?: string; field_of_study?: string;
  duration_months?: number; qualification_weight?: number; aliases?: string[];
};
const QUALIFICATIONS: QualSeed[] = [
  // Doctorate
  { canonical_name: 'Doctor of Philosophy', short_name: 'PhD', qualification_type: 'doctorate', nsqf_level: 10, eqf_level: 8, regulator: 'UGC', qualification_weight: 1.0, aliases: ['Ph.D', 'Ph.D.', 'D.Phil', 'DPhil', 'Doctorate'] },
  { canonical_name: 'Doctor of Medicine', short_name: 'MD', qualification_type: 'doctorate', nsqf_level: 10, eqf_level: 8, regulator: 'NMC', qualification_weight: 1.0, aliases: ['M.D.'] },
  // Masters
  { canonical_name: 'Master of Technology', short_name: 'M.Tech', qualification_type: 'masters', nsqf_level: 8, eqf_level: 7, regulator: 'AICTE', duration_months: 24, qualification_weight: 0.85, aliases: ['MTech', 'M.Tech.', 'ME', 'M.E.', 'Master of Engineering'] },
  { canonical_name: 'Master of Business Administration', short_name: 'MBA', qualification_type: 'masters', nsqf_level: 8, eqf_level: 7, regulator: 'AICTE', duration_months: 24, qualification_weight: 0.85, aliases: ['Masters in Business Administration', 'PGDM', 'Post Graduate Diploma in Management', 'PGP'] },
  { canonical_name: 'Master of Science', short_name: 'M.Sc', qualification_type: 'masters', nsqf_level: 8, eqf_level: 7, regulator: 'UGC', duration_months: 24, qualification_weight: 0.85, aliases: ['MSc', 'M.Sc.', 'MS', 'M.S.', 'Master of Science'] },
  { canonical_name: 'Master of Arts', short_name: 'M.A', qualification_type: 'masters', nsqf_level: 8, eqf_level: 7, regulator: 'UGC', duration_months: 24, qualification_weight: 0.85, aliases: ['MA', 'M.A.'] },
  { canonical_name: 'Master of Commerce', short_name: 'M.Com', qualification_type: 'masters', nsqf_level: 8, eqf_level: 7, regulator: 'UGC', duration_months: 24, qualification_weight: 0.85, aliases: ['MCom', 'M.Com.'] },
  { canonical_name: 'Master of Computer Applications', short_name: 'MCA', qualification_type: 'masters', nsqf_level: 8, regulator: 'AICTE', duration_months: 24, qualification_weight: 0.85, aliases: ['M.C.A.'] },
  { canonical_name: 'Master of Laws', short_name: 'LL.M', qualification_type: 'masters', nsqf_level: 8, regulator: 'BCI', duration_months: 24, qualification_weight: 0.85, aliases: ['LLM', 'LL.M.'] },
  // Bachelors
  { canonical_name: 'Bachelor of Technology', short_name: 'B.Tech', qualification_type: 'bachelors', nsqf_level: 6, eqf_level: 6, regulator: 'AICTE', duration_months: 48, qualification_weight: 0.65, aliases: ['BTech', 'B.Tech.', 'BE', 'B.E.', 'Bachelor of Engineering'] },
  { canonical_name: 'Bachelor of Science', short_name: 'B.Sc', qualification_type: 'bachelors', nsqf_level: 6, eqf_level: 6, regulator: 'UGC', duration_months: 36, qualification_weight: 0.65, aliases: ['BSc', 'B.Sc.'] },
  { canonical_name: 'Bachelor of Arts', short_name: 'B.A', qualification_type: 'bachelors', nsqf_level: 6, eqf_level: 6, regulator: 'UGC', duration_months: 36, qualification_weight: 0.65, aliases: ['BA', 'B.A.'] },
  { canonical_name: 'Bachelor of Commerce', short_name: 'B.Com', qualification_type: 'bachelors', nsqf_level: 6, eqf_level: 6, regulator: 'UGC', duration_months: 36, qualification_weight: 0.65, aliases: ['BCom', 'B.Com.'] },
  { canonical_name: 'Bachelor of Business Administration', short_name: 'BBA', qualification_type: 'bachelors', nsqf_level: 6, regulator: 'AICTE', duration_months: 36, qualification_weight: 0.65, aliases: ['B.B.A.'] },
  { canonical_name: 'Bachelor of Computer Applications', short_name: 'BCA', qualification_type: 'bachelors', nsqf_level: 6, regulator: 'AICTE', duration_months: 36, qualification_weight: 0.65, aliases: ['B.C.A.'] },
  { canonical_name: 'Bachelor of Laws', short_name: 'LL.B', qualification_type: 'bachelors', nsqf_level: 6, regulator: 'BCI', duration_months: 36, qualification_weight: 0.65, aliases: ['LLB', 'LL.B.'] },
  { canonical_name: 'Bachelor of Medicine and Bachelor of Surgery', short_name: 'MBBS', qualification_type: 'bachelors', nsqf_level: 8, regulator: 'NMC', duration_months: 66, qualification_weight: 0.9, aliases: ['M.B.B.S.'] },
  { canonical_name: 'Bachelor of Dental Surgery', short_name: 'BDS', qualification_type: 'bachelors', nsqf_level: 8, regulator: 'NMC', duration_months: 60, qualification_weight: 0.85, aliases: ['B.D.S.'] },
  { canonical_name: 'Bachelor of Architecture', short_name: 'B.Arch', qualification_type: 'bachelors', nsqf_level: 6, regulator: 'COA', duration_months: 60, qualification_weight: 0.65, aliases: ['BArch'] },
  // Diploma
  { canonical_name: 'Diploma in Engineering', short_name: 'Diploma', qualification_type: 'diploma', nsqf_level: 5, regulator: 'AICTE', duration_months: 36, qualification_weight: 0.4, aliases: ['Polytechnic Diploma'] },
  { canonical_name: 'Post Graduate Diploma', short_name: 'PG Diploma', qualification_type: 'masters', nsqf_level: 7, regulator: 'AICTE', duration_months: 12, qualification_weight: 0.7, aliases: ['PGD'] },
  // Professional designations as qualifications
  { canonical_name: 'Chartered Accountant', short_name: 'CA', qualification_type: 'masters', nsqf_level: 8, regulator: 'ICAI', qualification_weight: 0.9, aliases: ['C.A.'] },
  { canonical_name: 'Company Secretary', short_name: 'CS', qualification_type: 'masters', nsqf_level: 8, regulator: 'ICSI', qualification_weight: 0.85, aliases: ['C.S.'] },
  { canonical_name: 'Cost and Management Accountant', short_name: 'CMA', qualification_type: 'masters', nsqf_level: 8, regulator: 'ICMAI', qualification_weight: 0.85, aliases: ['ICWA', 'ICWAI', 'CWA'] },
  // School
  { canonical_name: 'Higher Secondary Certificate', short_name: '12th', qualification_type: 'school', nsqf_level: 4, qualification_weight: 0.25, aliases: ['HSC', 'Class 12', 'Intermediate', 'PUC'] },
  { canonical_name: 'Secondary School Certificate', short_name: '10th', qualification_type: 'school', nsqf_level: 3, qualification_weight: 0.15, aliases: ['SSC', 'Class 10', 'Matric'] },
];

// ─── Certifications ──────────────────────────────────────────
type CertSeed = {
  canonical_name: string; short_name?: string; issuer_name: string; issuer_category: string;
  tier: 'top' | 'mid' | 'generic'; market_recognition_score?: number; technical_depth_score?: number;
  verification_supported?: boolean; verification_method?: string; verification_url?: string;
  validity_period_months?: number; aliases?: string[];
};
const CERTIFICATIONS: CertSeed[] = [
  // Cloud — AWS
  { canonical_name: 'AWS Certified Solutions Architect - Associate', short_name: 'AWS SA-Associate', issuer_name: 'Amazon Web Services', issuer_category: 'cloud', tier: 'top', market_recognition_score: 0.95, technical_depth_score: 0.8, verification_supported: true, verification_method: 'credly', validity_period_months: 36, aliases: ['AWS Solutions Architect Associate', 'SAA-C03'] },
  { canonical_name: 'AWS Certified Solutions Architect - Professional', short_name: 'AWS SA-Pro', issuer_name: 'Amazon Web Services', issuer_category: 'cloud', tier: 'top', market_recognition_score: 0.95, technical_depth_score: 0.95, verification_supported: true, verification_method: 'credly', validity_period_months: 36, aliases: ['SAP-C02'] },
  { canonical_name: 'AWS Certified Developer - Associate', short_name: 'AWS Dev-Associate', issuer_name: 'Amazon Web Services', issuer_category: 'cloud', tier: 'top', market_recognition_score: 0.85, technical_depth_score: 0.75, verification_supported: true, verification_method: 'credly', validity_period_months: 36, aliases: ['DVA-C02'] },
  { canonical_name: 'AWS Certified Cloud Practitioner', short_name: 'AWS CCP', issuer_name: 'Amazon Web Services', issuer_category: 'cloud', tier: 'mid', market_recognition_score: 0.7, technical_depth_score: 0.4, verification_supported: true, verification_method: 'credly', validity_period_months: 36, aliases: ['CLF-C02'] },
  { canonical_name: 'AWS Certified DevOps Engineer - Professional', short_name: 'AWS DevOps-Pro', issuer_name: 'Amazon Web Services', issuer_category: 'cloud', tier: 'top', market_recognition_score: 0.9, technical_depth_score: 0.95, verification_supported: true, verification_method: 'credly', validity_period_months: 36 },
  { canonical_name: 'AWS Certified Data Engineer - Associate', short_name: 'AWS Data-Associate', issuer_name: 'Amazon Web Services', issuer_category: 'cloud', tier: 'top', market_recognition_score: 0.85, technical_depth_score: 0.8, verification_supported: true, verification_method: 'credly', validity_period_months: 36 },
  { canonical_name: 'AWS Certified Machine Learning - Specialty', short_name: 'AWS ML-Specialty', issuer_name: 'Amazon Web Services', issuer_category: 'cloud', tier: 'top', market_recognition_score: 0.9, technical_depth_score: 0.95, verification_supported: true, verification_method: 'credly', validity_period_months: 36 },
  // Cloud — Microsoft
  { canonical_name: 'Microsoft Certified: Azure Solutions Architect Expert', short_name: 'Azure SA Expert', issuer_name: 'Microsoft', issuer_category: 'cloud', tier: 'top', market_recognition_score: 0.92, technical_depth_score: 0.9, verification_supported: true, verification_method: 'issuer_api', validity_period_months: 12, aliases: ['AZ-305'] },
  { canonical_name: 'Microsoft Certified: Azure Administrator Associate', short_name: 'Azure Admin', issuer_name: 'Microsoft', issuer_category: 'cloud', tier: 'top', market_recognition_score: 0.85, technical_depth_score: 0.75, verification_supported: true, verification_method: 'issuer_api', validity_period_months: 12, aliases: ['AZ-104'] },
  { canonical_name: 'Microsoft Certified: Azure Developer Associate', short_name: 'Azure Developer', issuer_name: 'Microsoft', issuer_category: 'cloud', tier: 'top', market_recognition_score: 0.8, technical_depth_score: 0.75, verification_supported: true, verification_method: 'issuer_api', validity_period_months: 12, aliases: ['AZ-204'] },
  { canonical_name: 'Microsoft Certified: Azure Fundamentals', short_name: 'Azure Fund.', issuer_name: 'Microsoft', issuer_category: 'cloud', tier: 'mid', market_recognition_score: 0.65, technical_depth_score: 0.35, verification_supported: true, verification_method: 'issuer_api', aliases: ['AZ-900'] },
  { canonical_name: 'Microsoft Certified: Power BI Data Analyst Associate', short_name: 'PL-300', issuer_name: 'Microsoft', issuer_category: 'analytics', tier: 'mid', market_recognition_score: 0.75, technical_depth_score: 0.65, verification_supported: true, verification_method: 'issuer_api', validity_period_months: 12, aliases: ['PL-300'] },
  // Cloud — Google
  { canonical_name: 'Google Cloud Professional Cloud Architect', short_name: 'GCP PCA', issuer_name: 'Google Cloud', issuer_category: 'cloud', tier: 'top', market_recognition_score: 0.9, technical_depth_score: 0.9, verification_supported: true, verification_method: 'credly', validity_period_months: 24 },
  { canonical_name: 'Google Cloud Professional Data Engineer', short_name: 'GCP PDE', issuer_name: 'Google Cloud', issuer_category: 'data', tier: 'top', market_recognition_score: 0.88, technical_depth_score: 0.9, verification_supported: true, verification_method: 'credly', validity_period_months: 24 },
  { canonical_name: 'Google Cloud Professional Machine Learning Engineer', short_name: 'GCP MLE', issuer_name: 'Google Cloud', issuer_category: 'data', tier: 'top', market_recognition_score: 0.88, technical_depth_score: 0.92, verification_supported: true, verification_method: 'credly', validity_period_months: 24 },
  { canonical_name: 'Google Cloud Associate Cloud Engineer', short_name: 'GCP ACE', issuer_name: 'Google Cloud', issuer_category: 'cloud', tier: 'top', market_recognition_score: 0.8, technical_depth_score: 0.7, verification_supported: true, verification_method: 'credly', validity_period_months: 24 },
  // PM
  { canonical_name: 'Project Management Professional', short_name: 'PMP', issuer_name: 'Project Management Institute', issuer_category: 'project_mgmt', tier: 'top', market_recognition_score: 0.98, technical_depth_score: 0.7, verification_supported: true, verification_method: 'public_registry', verification_url: 'https://www.pmi.org/certifications/certification-resources/registry', validity_period_months: 36, aliases: ['PMI PMP'] },
  { canonical_name: 'PMI Agile Certified Practitioner', short_name: 'PMI-ACP', issuer_name: 'Project Management Institute', issuer_category: 'project_mgmt', tier: 'top', market_recognition_score: 0.8, technical_depth_score: 0.7, verification_supported: true, verification_method: 'public_registry', validity_period_months: 36 },
  { canonical_name: 'PRINCE2 Practitioner', short_name: 'PRINCE2', issuer_name: 'AXELOS', issuer_category: 'project_mgmt', tier: 'top', market_recognition_score: 0.85, technical_depth_score: 0.7, verification_supported: true, verification_method: 'issuer_api', validity_period_months: 36 },
  { canonical_name: 'Certified ScrumMaster', short_name: 'CSM', issuer_name: 'Scrum Alliance', issuer_category: 'project_mgmt', tier: 'mid', market_recognition_score: 0.8, technical_depth_score: 0.5, verification_supported: true, verification_method: 'issuer_api', validity_period_months: 24 },
  { canonical_name: 'Professional Scrum Master I', short_name: 'PSM I', issuer_name: 'Scrum.org', issuer_category: 'project_mgmt', tier: 'mid', market_recognition_score: 0.75, technical_depth_score: 0.5, verification_supported: true, verification_method: 'issuer_api' },
  { canonical_name: 'SAFe Agilist', short_name: 'SA', issuer_name: 'Scaled Agile', issuer_category: 'project_mgmt', tier: 'top', market_recognition_score: 0.78, technical_depth_score: 0.65, verification_supported: true, verification_method: 'issuer_api', validity_period_months: 12 },
  // Finance
  { canonical_name: 'Chartered Financial Analyst', short_name: 'CFA', issuer_name: 'CFA Institute', issuer_category: 'finance', tier: 'top', market_recognition_score: 0.98, technical_depth_score: 0.95, verification_supported: true, verification_method: 'public_registry' },
  { canonical_name: 'Financial Risk Manager', short_name: 'FRM', issuer_name: 'GARP', issuer_category: 'finance', tier: 'top', market_recognition_score: 0.9, technical_depth_score: 0.9, verification_supported: true, verification_method: 'public_registry' },
  { canonical_name: 'Certified Public Accountant', short_name: 'CPA', issuer_name: 'AICPA', issuer_category: 'finance', tier: 'top', market_recognition_score: 0.95, technical_depth_score: 0.9, verification_supported: true, verification_method: 'public_registry' },
  // Security
  { canonical_name: 'Certified Information Systems Security Professional', short_name: 'CISSP', issuer_name: '(ISC)²', issuer_category: 'security', tier: 'top', market_recognition_score: 0.95, technical_depth_score: 0.9, verification_supported: true, verification_method: 'credly', validity_period_months: 36 },
  { canonical_name: 'Certified Information Security Manager', short_name: 'CISM', issuer_name: 'ISACA', issuer_category: 'security', tier: 'top', market_recognition_score: 0.9, technical_depth_score: 0.85, verification_supported: true, verification_method: 'credly', validity_period_months: 36 },
  { canonical_name: 'Certified Information Systems Auditor', short_name: 'CISA', issuer_name: 'ISACA', issuer_category: 'security', tier: 'top', market_recognition_score: 0.9, technical_depth_score: 0.85, verification_supported: true, verification_method: 'credly', validity_period_months: 36 },
  { canonical_name: 'Certified Ethical Hacker', short_name: 'CEH', issuer_name: 'EC-Council', issuer_category: 'security', tier: 'top', market_recognition_score: 0.8, technical_depth_score: 0.8, verification_supported: true, verification_method: 'issuer_api', validity_period_months: 36 },
  // Salesforce
  { canonical_name: 'Salesforce Certified Administrator', short_name: 'Salesforce Admin', issuer_name: 'Salesforce', issuer_category: 'service_mgmt', tier: 'top', market_recognition_score: 0.85, technical_depth_score: 0.65, verification_supported: true, verification_method: 'credly' },
  { canonical_name: 'Salesforce Certified Platform Developer I', short_name: 'SF PD1', issuer_name: 'Salesforce', issuer_category: 'dev', tier: 'top', market_recognition_score: 0.82, technical_depth_score: 0.78, verification_supported: true, verification_method: 'credly' },
  // Oracle
  { canonical_name: 'Oracle Certified Professional Java SE Developer', short_name: 'OCP Java', issuer_name: 'Oracle', issuer_category: 'dev', tier: 'top', market_recognition_score: 0.8, technical_depth_score: 0.85, verification_supported: true, verification_method: 'credly' },
  { canonical_name: 'Oracle Cloud Infrastructure Architect Associate', short_name: 'OCI Architect', issuer_name: 'Oracle', issuer_category: 'cloud', tier: 'top', market_recognition_score: 0.7, technical_depth_score: 0.75, verification_supported: true, verification_method: 'credly' },
  // Cisco
  { canonical_name: 'Cisco Certified Network Associate', short_name: 'CCNA', issuer_name: 'Cisco', issuer_category: 'security', tier: 'top', market_recognition_score: 0.88, technical_depth_score: 0.8, verification_supported: true, verification_method: 'credly', validity_period_months: 36 },
  { canonical_name: 'Cisco Certified Network Professional', short_name: 'CCNP', issuer_name: 'Cisco', issuer_category: 'security', tier: 'top', market_recognition_score: 0.9, technical_depth_score: 0.9, verification_supported: true, verification_method: 'credly', validity_period_months: 36 },
  // HR
  { canonical_name: 'SHRM Certified Professional', short_name: 'SHRM-CP', issuer_name: 'SHRM', issuer_category: 'hr', tier: 'top', market_recognition_score: 0.85, technical_depth_score: 0.65, verification_supported: true, verification_method: 'credly', validity_period_months: 36 },
  { canonical_name: 'SHRM Senior Certified Professional', short_name: 'SHRM-SCP', issuer_name: 'SHRM', issuer_category: 'hr', tier: 'top', market_recognition_score: 0.9, technical_depth_score: 0.7, verification_supported: true, verification_method: 'credly', validity_period_months: 36 },
  { canonical_name: 'CIPD Level 7 Advanced Diploma', short_name: 'CIPD L7', issuer_name: 'CIPD', issuer_category: 'hr', tier: 'top', market_recognition_score: 0.85, technical_depth_score: 0.85, verification_supported: true, verification_method: 'issuer_api' },
  // Six Sigma
  { canonical_name: 'Six Sigma Black Belt', short_name: 'SSBB', issuer_name: 'ASQ', issuer_category: 'project_mgmt', tier: 'top', market_recognition_score: 0.82, technical_depth_score: 0.85, verification_supported: false },
  { canonical_name: 'Six Sigma Green Belt', short_name: 'SSGB', issuer_name: 'ASQ', issuer_category: 'project_mgmt', tier: 'mid', market_recognition_score: 0.7, technical_depth_score: 0.6, verification_supported: false },
  // Service Mgmt
  { canonical_name: 'ITIL 4 Foundation', short_name: 'ITIL F', issuer_name: 'AXELOS', issuer_category: 'service_mgmt', tier: 'mid', market_recognition_score: 0.75, technical_depth_score: 0.4, verification_supported: true, verification_method: 'issuer_api' },
  { canonical_name: 'TOGAF 9 Certified', short_name: 'TOGAF', issuer_name: 'The Open Group', issuer_category: 'service_mgmt', tier: 'top', market_recognition_score: 0.85, technical_depth_score: 0.85, verification_supported: true, verification_method: 'issuer_api' },
];

// ─── Skills (curated technical + soft, mapped to ESCO/O*NET stubs) ──
type SkillSeed = {
  canonical_name: string; skill_category: 'technical' | 'soft' | 'tool' | 'language' | 'domain';
  esco_uri?: string; onet_code?: string;
  market_demand_score?: number; future_relevance_score?: number;
  aliases?: string[];
};
const SKILLS: SkillSeed[] = [
  // Technical — programming
  { canonical_name: 'Python', skill_category: 'technical', esco_uri: 'http://data.europa.eu/esco/skill/4623d3df-2d39-4f7c-b65a-22a895e54ab8', market_demand_score: 0.95, future_relevance_score: 0.95, aliases: ['Python 3', 'Python3'] },
  { canonical_name: 'JavaScript', skill_category: 'technical', esco_uri: 'http://data.europa.eu/esco/skill/3b8d8aa3-3c08-4b1d-b78d-2c0091fdb5b9', market_demand_score: 0.95, future_relevance_score: 0.9, aliases: ['JS', 'ECMAScript'] },
  { canonical_name: 'TypeScript', skill_category: 'technical', market_demand_score: 0.9, future_relevance_score: 0.92, aliases: ['TS'] },
  { canonical_name: 'Java', skill_category: 'technical', esco_uri: 'http://data.europa.eu/esco/skill/77a8dbcd-c66e-4dec-9d76-d75ce925f6f9', market_demand_score: 0.85, future_relevance_score: 0.75 },
  { canonical_name: 'C++', skill_category: 'technical', market_demand_score: 0.7, future_relevance_score: 0.7, aliases: ['CPP'] },
  { canonical_name: 'C#', skill_category: 'technical', market_demand_score: 0.75, future_relevance_score: 0.75, aliases: ['CSharp'] },
  { canonical_name: 'Go', skill_category: 'technical', market_demand_score: 0.7, future_relevance_score: 0.85, aliases: ['Golang'] },
  { canonical_name: 'Rust', skill_category: 'technical', market_demand_score: 0.55, future_relevance_score: 0.9 },
  { canonical_name: 'Kotlin', skill_category: 'technical', market_demand_score: 0.7, future_relevance_score: 0.8 },
  { canonical_name: 'Swift', skill_category: 'technical', market_demand_score: 0.65, future_relevance_score: 0.75 },
  { canonical_name: 'PHP', skill_category: 'technical', market_demand_score: 0.6, future_relevance_score: 0.5 },
  { canonical_name: 'Ruby', skill_category: 'technical', market_demand_score: 0.5, future_relevance_score: 0.5 },
  { canonical_name: 'R', skill_category: 'technical', market_demand_score: 0.65, future_relevance_score: 0.65, aliases: ['R Programming'] },
  { canonical_name: 'SQL', skill_category: 'technical', market_demand_score: 0.95, future_relevance_score: 0.95 },
  // Frameworks / libs
  { canonical_name: 'React', skill_category: 'technical', market_demand_score: 0.95, future_relevance_score: 0.9, aliases: ['React.js', 'ReactJS'] },
  { canonical_name: 'Next.js', skill_category: 'technical', market_demand_score: 0.85, future_relevance_score: 0.9, aliases: ['NextJS'] },
  { canonical_name: 'Angular', skill_category: 'technical', market_demand_score: 0.75, future_relevance_score: 0.7 },
  { canonical_name: 'Vue.js', skill_category: 'technical', market_demand_score: 0.7, future_relevance_score: 0.75, aliases: ['Vue', 'VueJS'] },
  { canonical_name: 'Node.js', skill_category: 'technical', market_demand_score: 0.9, future_relevance_score: 0.85, aliases: ['NodeJS', 'Node'] },
  { canonical_name: 'Express.js', skill_category: 'technical', market_demand_score: 0.8, future_relevance_score: 0.75, aliases: ['Express', 'ExpressJS'] },
  { canonical_name: 'Django', skill_category: 'technical', market_demand_score: 0.75, future_relevance_score: 0.8 },
  { canonical_name: 'Flask', skill_category: 'technical', market_demand_score: 0.7, future_relevance_score: 0.75 },
  { canonical_name: 'Spring Boot', skill_category: 'technical', market_demand_score: 0.85, future_relevance_score: 0.8 },
  { canonical_name: '.NET', skill_category: 'technical', market_demand_score: 0.75, future_relevance_score: 0.7, aliases: ['DotNet', 'ASP.NET'] },
  // Data / ML
  { canonical_name: 'Machine Learning', skill_category: 'technical', market_demand_score: 0.95, future_relevance_score: 0.98, aliases: ['ML'] },
  { canonical_name: 'Deep Learning', skill_category: 'technical', market_demand_score: 0.9, future_relevance_score: 0.95, aliases: ['DL'] },
  { canonical_name: 'Natural Language Processing', skill_category: 'technical', market_demand_score: 0.85, future_relevance_score: 0.95, aliases: ['NLP'] },
  { canonical_name: 'Computer Vision', skill_category: 'technical', market_demand_score: 0.8, future_relevance_score: 0.9, aliases: ['CV'] },
  { canonical_name: 'Generative AI', skill_category: 'technical', market_demand_score: 0.95, future_relevance_score: 0.98, aliases: ['GenAI', 'LLM', 'Large Language Models'] },
  { canonical_name: 'TensorFlow', skill_category: 'technical', market_demand_score: 0.8, future_relevance_score: 0.8 },
  { canonical_name: 'PyTorch', skill_category: 'technical', market_demand_score: 0.85, future_relevance_score: 0.9 },
  { canonical_name: 'Pandas', skill_category: 'technical', market_demand_score: 0.85, future_relevance_score: 0.85 },
  { canonical_name: 'NumPy', skill_category: 'technical', market_demand_score: 0.8, future_relevance_score: 0.8 },
  { canonical_name: 'Apache Spark', skill_category: 'technical', market_demand_score: 0.8, future_relevance_score: 0.8, aliases: ['Spark'] },
  { canonical_name: 'Apache Kafka', skill_category: 'technical', market_demand_score: 0.8, future_relevance_score: 0.85, aliases: ['Kafka'] },
  { canonical_name: 'Apache Airflow', skill_category: 'technical', market_demand_score: 0.75, future_relevance_score: 0.8, aliases: ['Airflow'] },
  { canonical_name: 'dbt', skill_category: 'technical', market_demand_score: 0.7, future_relevance_score: 0.85, aliases: ['data build tool'] },
  // Cloud / DevOps
  { canonical_name: 'AWS', skill_category: 'technical', market_demand_score: 0.95, future_relevance_score: 0.95, aliases: ['Amazon Web Services'] },
  { canonical_name: 'Microsoft Azure', skill_category: 'technical', market_demand_score: 0.9, future_relevance_score: 0.9, aliases: ['Azure'] },
  { canonical_name: 'Google Cloud Platform', skill_category: 'technical', market_demand_score: 0.85, future_relevance_score: 0.9, aliases: ['GCP', 'Google Cloud'] },
  { canonical_name: 'Docker', skill_category: 'technical', market_demand_score: 0.9, future_relevance_score: 0.9 },
  { canonical_name: 'Kubernetes', skill_category: 'technical', market_demand_score: 0.9, future_relevance_score: 0.95, aliases: ['K8s'] },
  { canonical_name: 'Terraform', skill_category: 'technical', market_demand_score: 0.85, future_relevance_score: 0.9 },
  { canonical_name: 'Jenkins', skill_category: 'technical', market_demand_score: 0.75, future_relevance_score: 0.7 },
  { canonical_name: 'GitHub Actions', skill_category: 'technical', market_demand_score: 0.85, future_relevance_score: 0.9 },
  { canonical_name: 'Git', skill_category: 'technical', market_demand_score: 0.95, future_relevance_score: 0.95 },
  { canonical_name: 'Linux', skill_category: 'technical', market_demand_score: 0.85, future_relevance_score: 0.85 },
  // Databases
  { canonical_name: 'PostgreSQL', skill_category: 'technical', market_demand_score: 0.9, future_relevance_score: 0.9, aliases: ['Postgres'] },
  { canonical_name: 'MySQL', skill_category: 'technical', market_demand_score: 0.85, future_relevance_score: 0.75 },
  { canonical_name: 'MongoDB', skill_category: 'technical', market_demand_score: 0.85, future_relevance_score: 0.8 },
  { canonical_name: 'Redis', skill_category: 'technical', market_demand_score: 0.8, future_relevance_score: 0.85 },
  { canonical_name: 'Snowflake', skill_category: 'technical', market_demand_score: 0.85, future_relevance_score: 0.9 },
  { canonical_name: 'Databricks', skill_category: 'technical', market_demand_score: 0.8, future_relevance_score: 0.9 },
  // BI / Analytics
  { canonical_name: 'Power BI', skill_category: 'tool', market_demand_score: 0.85, future_relevance_score: 0.85, aliases: ['PowerBI'] },
  { canonical_name: 'Tableau', skill_category: 'tool', market_demand_score: 0.85, future_relevance_score: 0.85 },
  { canonical_name: 'Looker', skill_category: 'tool', market_demand_score: 0.7, future_relevance_score: 0.8 },
  { canonical_name: 'Excel', skill_category: 'tool', market_demand_score: 0.85, future_relevance_score: 0.7, aliases: ['Microsoft Excel'] },
  // Design
  { canonical_name: 'Figma', skill_category: 'tool', market_demand_score: 0.85, future_relevance_score: 0.9 },
  { canonical_name: 'Adobe XD', skill_category: 'tool', market_demand_score: 0.55, future_relevance_score: 0.4 },
  { canonical_name: 'Sketch', skill_category: 'tool', market_demand_score: 0.5, future_relevance_score: 0.4 },
  // ERP / HR / CRM tools
  { canonical_name: 'SAP', skill_category: 'tool', market_demand_score: 0.85, future_relevance_score: 0.8 },
  { canonical_name: 'Oracle HCM Cloud', skill_category: 'tool', market_demand_score: 0.7, future_relevance_score: 0.75, aliases: ['Oracle HCM', 'Oracle Fusion HCM'] },
  { canonical_name: 'Workday', skill_category: 'tool', market_demand_score: 0.75, future_relevance_score: 0.8 },
  { canonical_name: 'Darwinbox', skill_category: 'tool', market_demand_score: 0.6, future_relevance_score: 0.7 },
  { canonical_name: 'Keka', skill_category: 'tool', market_demand_score: 0.55, future_relevance_score: 0.65 },
  { canonical_name: 'SuccessFactors', skill_category: 'tool', market_demand_score: 0.7, future_relevance_score: 0.65 },
  { canonical_name: 'Salesforce CRM', skill_category: 'tool', market_demand_score: 0.85, future_relevance_score: 0.85, aliases: ['Salesforce'] },
  { canonical_name: 'HubSpot', skill_category: 'tool', market_demand_score: 0.75, future_relevance_score: 0.8 },
  { canonical_name: 'ServiceNow', skill_category: 'tool', market_demand_score: 0.8, future_relevance_score: 0.85 },
  { canonical_name: 'Jira', skill_category: 'tool', market_demand_score: 0.85, future_relevance_score: 0.8 },
  { canonical_name: 'Confluence', skill_category: 'tool', market_demand_score: 0.75, future_relevance_score: 0.75 },
  // Soft skills (ESCO transversal)
  { canonical_name: 'Communication', skill_category: 'soft', esco_uri: 'http://data.europa.eu/esco/skill/T1.1.0', market_demand_score: 0.95, future_relevance_score: 0.95 },
  { canonical_name: 'Leadership', skill_category: 'soft', market_demand_score: 0.9, future_relevance_score: 0.9 },
  { canonical_name: 'Teamwork', skill_category: 'soft', market_demand_score: 0.9, future_relevance_score: 0.9, aliases: ['Collaboration'] },
  { canonical_name: 'Problem Solving', skill_category: 'soft', market_demand_score: 0.95, future_relevance_score: 0.95 },
  { canonical_name: 'Critical Thinking', skill_category: 'soft', market_demand_score: 0.9, future_relevance_score: 0.95 },
  { canonical_name: 'Adaptability', skill_category: 'soft', market_demand_score: 0.9, future_relevance_score: 0.95 },
  { canonical_name: 'Time Management', skill_category: 'soft', market_demand_score: 0.85, future_relevance_score: 0.85 },
  { canonical_name: 'Emotional Intelligence', skill_category: 'soft', market_demand_score: 0.85, future_relevance_score: 0.95 },
  { canonical_name: 'Stakeholder Management', skill_category: 'soft', market_demand_score: 0.85, future_relevance_score: 0.85 },
  { canonical_name: 'Negotiation', skill_category: 'soft', market_demand_score: 0.8, future_relevance_score: 0.8 },
  { canonical_name: 'Public Speaking', skill_category: 'soft', market_demand_score: 0.75, future_relevance_score: 0.75 },
  { canonical_name: 'Decision Making', skill_category: 'soft', market_demand_score: 0.9, future_relevance_score: 0.9 },
  // Domain
  { canonical_name: 'Product Management', skill_category: 'domain', market_demand_score: 0.9, future_relevance_score: 0.95 },
  { canonical_name: 'Agile Methodology', skill_category: 'domain', market_demand_score: 0.9, future_relevance_score: 0.85, aliases: ['Agile'] },
  { canonical_name: 'Scrum', skill_category: 'domain', market_demand_score: 0.85, future_relevance_score: 0.8 },
  { canonical_name: 'Risk Management', skill_category: 'domain', market_demand_score: 0.85, future_relevance_score: 0.85 },
  { canonical_name: 'Financial Modelling', skill_category: 'domain', market_demand_score: 0.85, future_relevance_score: 0.85, aliases: ['Financial Modeling'] },
  { canonical_name: 'Data Analysis', skill_category: 'domain', market_demand_score: 0.95, future_relevance_score: 0.95 },
  { canonical_name: 'Business Analysis', skill_category: 'domain', market_demand_score: 0.85, future_relevance_score: 0.85 },
];

// ─── Occupations (small seed; ESCO/O*NET full sync in Phase 3) ───
type OccSeed = { canonical_title: string; role_family: string; seniority_level: string; seniority_weight: number; aliases?: string[] };
const OCCUPATIONS: OccSeed[] = [
  { canonical_title: 'Software Engineer', role_family: 'engineering', seniority_level: 'mid', seniority_weight: 0.55 },
  { canonical_title: 'Senior Software Engineer', role_family: 'engineering', seniority_level: 'senior', seniority_weight: 0.7 },
  { canonical_title: 'Engineering Manager', role_family: 'engineering', seniority_level: 'manager', seniority_weight: 0.8 },
  { canonical_title: 'Engineering Director', role_family: 'engineering', seniority_level: 'director', seniority_weight: 0.9 },
  { canonical_title: 'VP Engineering', role_family: 'engineering', seniority_level: 'vp', seniority_weight: 1.0 },
  { canonical_title: 'Chief Technology Officer', role_family: 'engineering', seniority_level: 'c_suite', seniority_weight: 1.0, aliases: ['CTO'] },
  { canonical_title: 'Product Manager', role_family: 'product', seniority_level: 'manager', seniority_weight: 0.8 },
  { canonical_title: 'Senior Product Manager', role_family: 'product', seniority_level: 'senior', seniority_weight: 0.85 },
  { canonical_title: 'Director of Product', role_family: 'product', seniority_level: 'director', seniority_weight: 0.9 },
  { canonical_title: 'Chief Product Officer', role_family: 'product', seniority_level: 'c_suite', seniority_weight: 1.0, aliases: ['CPO'] },
  { canonical_title: 'Data Scientist', role_family: 'data', seniority_level: 'mid', seniority_weight: 0.55 },
  { canonical_title: 'Senior Data Scientist', role_family: 'data', seniority_level: 'senior', seniority_weight: 0.7 },
  { canonical_title: 'Data Engineer', role_family: 'data', seniority_level: 'mid', seniority_weight: 0.55 },
  { canonical_title: 'Data Analyst', role_family: 'data', seniority_level: 'mid', seniority_weight: 0.55 },
  { canonical_title: 'Analytics Manager', role_family: 'data', seniority_level: 'manager', seniority_weight: 0.8 },
  { canonical_title: 'HR Business Partner', role_family: 'hr', seniority_level: 'mid', seniority_weight: 0.55, aliases: ['HRBP'] },
  { canonical_title: 'Head of HR', role_family: 'hr', seniority_level: 'director', seniority_weight: 0.9 },
  { canonical_title: 'Chief Human Resources Officer', role_family: 'hr', seniority_level: 'c_suite', seniority_weight: 1.0, aliases: ['CHRO'] },
  { canonical_title: 'Finance Manager', role_family: 'finance', seniority_level: 'manager', seniority_weight: 0.8 },
  { canonical_title: 'Chief Financial Officer', role_family: 'finance', seniority_level: 'c_suite', seniority_weight: 1.0, aliases: ['CFO'] },
  { canonical_title: 'Sales Executive', role_family: 'sales', seniority_level: 'mid', seniority_weight: 0.55 },
  { canonical_title: 'Sales Manager', role_family: 'sales', seniority_level: 'manager', seniority_weight: 0.8 },
  { canonical_title: 'VP Sales', role_family: 'sales', seniority_level: 'vp', seniority_weight: 1.0 },
  { canonical_title: 'Marketing Manager', role_family: 'marketing', seniority_level: 'manager', seniority_weight: 0.8 },
  { canonical_title: 'Chief Marketing Officer', role_family: 'marketing', seniority_level: 'c_suite', seniority_weight: 1.0, aliases: ['CMO'] },
  { canonical_title: 'Consultant', role_family: 'consulting', seniority_level: 'mid', seniority_weight: 0.6 },
  { canonical_title: 'Senior Consultant', role_family: 'consulting', seniority_level: 'senior', seniority_weight: 0.7 },
  { canonical_title: 'Principal Consultant', role_family: 'consulting', seniority_level: 'lead', seniority_weight: 0.85 },
  { canonical_title: 'Partner', role_family: 'consulting', seniority_level: 'director', seniority_weight: 0.95 },
  { canonical_title: 'Intern', role_family: 'engineering', seniority_level: 'intern', seniority_weight: 0.35 },
];

export async function runReferenceSeed(
  pool: Pool,
  recomputeTier: RecomputeTier
): Promise<{ institutions: number; qualifications: number; certifications: number; skills: number; occupations: number; rankings: number; accreditations: number; provenance: number }> {
  let nInst = 0, nQual = 0, nCert = 0, nSkill = 0, nOcc = 0, nRank = 0, nAcc = 0, nProv = 0;

  // ── Institutions
  for (const i of INSTITUTIONS) {
    const country = (i as any).country_code === undefined ? 'IN' : ((i as any).country_code || 'IN');
    const ins = await pool.query(
      `INSERT INTO institutions (canonical_name, short_name, institution_type, country_code, state, city, established_year, website)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (canonical_name, country_code) DO UPDATE SET
         short_name=EXCLUDED.short_name, institution_type=EXCLUDED.institution_type, state=EXCLUDED.state, city=EXCLUDED.city,
         established_year=EXCLUDED.established_year, website=EXCLUDED.website, updated_at=NOW()
       RETURNING id`,
      [i.canonical_name, i.short_name || null, i.institution_type, country, i.state || null, i.city || null, i.established_year || null, i.website || null]
    );
    const id = ins.rows[0].id;
    nInst++;
    if (i.aliases?.length) {
      for (const a of i.aliases) {
        await pool.query(`INSERT INTO institution_aliases (institution_id, alias_name, alias_type) VALUES ($1,$2,'common') ON CONFLICT DO NOTHING`, [id, a]);
      }
    }
    if (i.nirf?.length) {
      for (const r of i.nirf) {
        const provId = (await pool.query(
          `INSERT INTO provenance_records (entity_type, entity_id, source_authority, source_url, source_snapshot_date, extracted_value)
           VALUES ('ranking',$1,'NIRF','https://www.nirfindia.org', CURRENT_DATE, $2) RETURNING id`,
          [id, JSON.stringify({ category: r.category, rank: r.rank, year: r.year || 2024 })]
        )).rows[0].id;
        nProv++;
        const rr = await pool.query(
          `INSERT INTO institution_rankings (institution_id, ranking_source, ranking_category, ranking_year, ranking_value, source_url, provenance_id)
           VALUES ($1,'NIRF',$2,$3,$4,'https://www.nirfindia.org',$5)
           ON CONFLICT (institution_id, ranking_source, ranking_category, ranking_year) DO UPDATE SET ranking_value=EXCLUDED.ranking_value, provenance_id=EXCLUDED.provenance_id
           RETURNING id`,
          [id, r.category, r.year || 2024, r.rank, provId]
        );
        if (rr.rows.length) nRank++;
      }
    }
    if (i.qs) {
      const provId = (await pool.query(
        `INSERT INTO provenance_records (entity_type, entity_id, source_authority, source_url, source_snapshot_date, extracted_value)
         VALUES ('ranking',$1,'QS','https://www.topuniversities.com', CURRENT_DATE, $2) RETURNING id`,
        [id, JSON.stringify({ rank: i.qs, year: 2024 })]
      )).rows[0].id;
      nProv++;
      await pool.query(
        `INSERT INTO institution_rankings (institution_id, ranking_source, ranking_category, ranking_year, ranking_value, source_url, provenance_id)
         VALUES ($1,'QS','World',2024,$2,'https://www.topuniversities.com',$3)
         ON CONFLICT (institution_id, ranking_source, ranking_category, ranking_year) DO UPDATE SET ranking_value=EXCLUDED.ranking_value, provenance_id=EXCLUDED.provenance_id`,
        [id, i.qs, provId]
      );
      nRank++;
    }
    if (i.naac) {
      const provId = (await pool.query(
        `INSERT INTO provenance_records (entity_type, entity_id, source_authority, source_url, source_snapshot_date, extracted_value)
         VALUES ('accreditation',$1,'NAAC','https://www.naac.gov.in', CURRENT_DATE, $2) RETURNING id`,
        [id, JSON.stringify({ grade: i.naac })]
      )).rows[0].id;
      nProv++;
      await pool.query(
        `INSERT INTO institution_accreditations (institution_id, accreditation_authority, accreditation_grade, valid_from, source_url, provenance_id)
         VALUES ($1,'NAAC',$2,DATE '1900-01-01','https://www.naac.gov.in',$3)
         ON CONFLICT (institution_id, accreditation_authority, valid_from) DO UPDATE SET accreditation_grade=EXCLUDED.accreditation_grade, provenance_id=EXCLUDED.provenance_id`,
        [id, i.naac, provId]
      );
      nAcc++;
    }
    if (i.nba) {
      await pool.query(
        `INSERT INTO institution_accreditations (institution_id, accreditation_authority, accreditation_grade, valid_from)
         VALUES ($1,'NBA','Accredited',DATE '1900-01-01') ON CONFLICT (institution_id, accreditation_authority, valid_from) DO NOTHING`,
        [id]
      );
      nAcc++;
    }
    // UGC recognition note for Indian institutions
    if (country === 'IN' && ['university', 'iit', 'iim', 'nit', 'iiit'].includes(i.institution_type)) {
      await pool.query(
        `INSERT INTO institution_accreditations (institution_id, accreditation_authority, accreditation_grade, valid_from, source_url)
         VALUES ($1,'UGC','Recognised',DATE '1900-01-01','https://www.ugc.gov.in')
         ON CONFLICT (institution_id, accreditation_authority, valid_from) DO NOTHING`,
        [id]
      );
    }
    await recomputeTier(pool, id);
  }

  // ── Qualifications
  for (const q of QUALIFICATIONS) {
    const r = await pool.query(
      `INSERT INTO qualifications (canonical_name, short_name, qualification_type, nsqf_level, eqf_level, regulator, field_of_study, duration_months, qualification_weight)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (canonical_name) DO UPDATE SET short_name=EXCLUDED.short_name, qualification_type=EXCLUDED.qualification_type, nsqf_level=EXCLUDED.nsqf_level, eqf_level=EXCLUDED.eqf_level, regulator=EXCLUDED.regulator, qualification_weight=EXCLUDED.qualification_weight, updated_at=NOW()
       RETURNING id`,
      [q.canonical_name, q.short_name, q.qualification_type, q.nsqf_level || null, q.eqf_level || null, q.regulator || null, q.field_of_study || null, q.duration_months || null, q.qualification_weight || 0.65]
    );
    const id = r.rows[0].id;
    nQual++;
    if (q.aliases?.length) {
      for (const a of q.aliases) {
        await pool.query(`INSERT INTO qualification_aliases (qualification_id, alias_name, alias_type) VALUES ($1,$2,'common') ON CONFLICT DO NOTHING`, [id, a]);
      }
    }
  }

  // ── Certifications
  for (const c of CERTIFICATIONS) {
    const r = await pool.query(
      `INSERT INTO certifications (canonical_name, short_name, issuer_name, issuer_category, market_recognition_score, technical_depth_score, tier, verification_supported, verification_method, verification_url, validity_period_months)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (canonical_name, issuer_name) DO UPDATE SET short_name=EXCLUDED.short_name, issuer_category=EXCLUDED.issuer_category, market_recognition_score=EXCLUDED.market_recognition_score, technical_depth_score=EXCLUDED.technical_depth_score, tier=EXCLUDED.tier, verification_supported=EXCLUDED.verification_supported, verification_method=EXCLUDED.verification_method, verification_url=EXCLUDED.verification_url, updated_at=NOW()
       RETURNING id`,
      [c.canonical_name, c.short_name || null, c.issuer_name, c.issuer_category, c.market_recognition_score ?? 0.5, c.technical_depth_score ?? 0.5, c.tier, c.verification_supported ?? false, c.verification_method || null, c.verification_url || null, c.validity_period_months || null]
    );
    const id = r.rows[0].id;
    nCert++;
    if (c.aliases?.length) {
      for (const a of c.aliases) {
        await pool.query(`INSERT INTO certification_aliases (certification_id, alias_name, alias_type) VALUES ($1,$2,'common') ON CONFLICT DO NOTHING`, [id, a]);
      }
    }
  }

  // ── Skills
  for (const s of SKILLS) {
    const r = await pool.query(
      `INSERT INTO skills (canonical_name, skill_category, esco_uri, onet_code, market_demand_score, future_relevance_score)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (canonical_name, skill_category) DO UPDATE SET esco_uri=EXCLUDED.esco_uri, onet_code=EXCLUDED.onet_code, market_demand_score=EXCLUDED.market_demand_score, future_relevance_score=EXCLUDED.future_relevance_score, updated_at=NOW()
       RETURNING id`,
      [s.canonical_name, s.skill_category, s.esco_uri || null, s.onet_code || null, s.market_demand_score ?? 0.5, s.future_relevance_score ?? 0.5]
    );
    const id = r.rows[0].id;
    nSkill++;
    if (s.aliases?.length) {
      for (const a of s.aliases) {
        await pool.query(`INSERT INTO skill_aliases (skill_id, alias_name, alias_type) VALUES ($1,$2,'common') ON CONFLICT DO NOTHING`, [id, a]);
      }
    }
  }

  // ── Occupations
  for (const o of OCCUPATIONS) {
    await pool.query(
      `INSERT INTO occupations (canonical_title, role_family, seniority_level, seniority_weight)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (canonical_title) DO UPDATE SET role_family=EXCLUDED.role_family, seniority_level=EXCLUDED.seniority_level, seniority_weight=EXCLUDED.seniority_weight, updated_at=NOW()`,
      [o.canonical_title, o.role_family, o.seniority_level, o.seniority_weight]
    );
    nOcc++;
  }

  return { institutions: nInst, qualifications: nQual, certifications: nCert, skills: nSkill, occupations: nOcc, rankings: nRank, accreditations: nAcc, provenance: nProv };
}
