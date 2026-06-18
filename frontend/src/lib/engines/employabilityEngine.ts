import type { CareerProfile } from '@/lib/careerIntelligence';
import { getEIBand } from '@/design-system';

// ─── Institution / degree / cert classifiers ──────────────────────────────────
// Single source of truth — also imported by CareerBuilderPage for the inline
// eiBreakdown component breakdown. Keep keyword lists case-insensitive.

export const TIER1_INSTITUTIONS = [
  'iit ','iit-','iitb','iitd','iitm','iitk','iitkgp','iith','iitr','iitg',
  'iim ','iim-','iimb','iima','iimc','iiml','iimk','iimi',
  'iisc','indian institute of science','aiims','isb','indian school of business',
  'nlsiu','nujs','nalsar','national law school',
  'nit ','nit-','national institute of technology',
  'bits pilani','bits hyderabad','bits goa','birla institute of technology and science',
  'xlri','tiss','jnu','jawaharlal nehru university','delhi university',
  'iiit hyderabad','iiit delhi','iiit bangalore',
  'stanford','harvard','mit ','massachusetts institute of technology',
  'oxford','cambridge','yale','princeton','columbia','cornell','upenn','wharton',
  'berkeley','uc berkeley','ucla','caltech','chicago booth','northwestern','kellogg',
  'insead','london business school','lse','imperial college',
  'ucl','university college london','eth zurich',
  'nus','national university of singapore','ntu singapore',
  'tsinghua','peking university','university of toronto',
];

export const TIER2_INSTITUTIONS = [
  'vit','vellore institute','srm','manipal','amity','symbiosis',
  'christ university','loyola','bms','rvce','pes','msrit','bms college',
  'college of engineering pune','jadavpur','anna university','osmania',
  'jamia millia','jamia hamdard','aligarh muslim','banaras hindu','bhu',
  'university of mumbai','university of pune','savitribai phule',
  'panjab university','punjab university','mit pune','dypatil','d.y. patil',
  'lovely professional','lpu','thapar','nirma','pdpu',
  'great lakes','spjimr','mdi','imt ghaziabad','iift','fms delhi','jbims','welingkar',
  'state university','university of california','university of texas',
  'university of michigan','university of washington',
  'university of melbourne','university of sydney','monash',
  'york university','mcgill','university of british columbia','ubc',
  'university of edinburgh','manchester','warwick','kings college',
];

export function classifyInstitutionTier(name: string): { tier: 1 | 2 | 3; mult: number } {
  const n = (name || '').toLowerCase();
  if (!n) return { tier: 3, mult: 0.5 };
  if (TIER1_INSTITUTIONS.some(k => n.includes(k))) return { tier: 1, mult: 1.0 };
  if (TIER2_INSTITUTIONS.some(k => n.includes(k))) return { tier: 2, mult: 0.75 };
  return { tier: 3, mult: 0.5 };
}

export function classifyDegreeLevel(degree: string): { level: 'phd'|'masters'|'bachelors'|'diploma'|'other'; mult: number } {
  const d = (degree || '').toLowerCase();
  if (!d) return { level: 'other', mult: 0.3 };
  if (/\b(phd|ph\.d|doctorate|d\.phil|dphil|md\b)/.test(d))                                                   return { level: 'phd',       mult: 1.0  };
  if (/\b(m\.tech|mtech|m\.e\b|m\.s\b|ms\b|m\.a\b|ma\b|m\.com|mcom|m\.sc|msc|mba|pgdm|pg diploma|master)/.test(d)) return { level: 'masters',   mult: 0.85 };
  if (/\b(b\.tech|btech|b\.e\b|be\b|b\.sc|bsc|b\.a\b|ba\b|b\.com|bcom|bba|bca|llb|mbbs|bachelor)/.test(d))  return { level: 'bachelors', mult: 0.65 };
  if (/\b(diploma|polytechnic)/.test(d))                                                                       return { level: 'diploma',   mult: 0.4  };
  return { level: 'other', mult: 0.3 };
}

export function classifyEducation(
  education: Array<{ institution?: string; degree?: string }>,
): { points: number; summary: string } {
  if (!education || education.length === 0) return { points: 0, summary: 'No education entries yet.' };
  let best = { score: 0, label: '', tier: 3 as 1|2|3, level: 'other' as string };
  for (const e of education) {
    const t = classifyInstitutionTier(e.institution || '');
    const d = classifyDegreeLevel(e.degree || '');
    const score = 15 * d.mult * t.mult;
    if (score > best.score) {
      best = { score, label: `${e.degree || 'Degree'} · ${e.institution || 'Institution'}`, tier: t.tier, level: d.level };
    }
  }
  return { points: best.score, summary: `Best credential: ${best.label} (Tier ${best.tier}, ${best.level}).` };
}

export function classifyRoleSeniority(role: string): { level: string; mult: number } {
  const r = (role || '').toLowerCase();
  if (!r) return { level: 'unknown', mult: 0.5 };
  if (/\b(ceo|cfo|coo|cto|cmo|cpo|chro|chief|founder|co-founder|president|vice president|vp\b|svp\b|evp\b)/.test(r)) return { level: 'C-suite/VP',    mult: 1.0  };
  if (/\b(director|head of|head,|principal|partner|gm\b|general manager)/.test(r))                                   return { level: 'Director/Head', mult: 0.9  };
  if (/\b(manager|lead\b|leader|team lead|tech lead|engineering manager|product manager)/.test(r))                   return { level: 'Manager/Lead',  mult: 0.8  };
  if (/\b(senior|sr\.|sr\s|specialist|architect|consultant)/.test(r))                                                return { level: 'Senior',        mult: 0.7  };
  if (/\b(associate|analyst|executive|coordinator|officer|engineer|developer|designer)/.test(r))                     return { level: 'Associate/Mid', mult: 0.55 };
  if (/\b(junior|jr\.|trainee|intern|fresher|apprentice|graduate)/.test(r))                                          return { level: 'Junior/Intern', mult: 0.35 };
  return { level: 'Mid', mult: 0.55 };
}

export function classifyExperience(
  experience: Array<{ role?: string; startDate?: string; endDate?: string; isCurrent?: boolean }>,
): { points: number; summary: string } {
  if (!experience || experience.length === 0) return { points: 0, summary: 'No experience entries yet.' };
  let totalMonths = 0;
  let topMult = 0;
  let topLabel = '';
  const now = new Date();
  for (const e of experience) {
    const s  = e.startDate ? new Date(e.startDate) : null;
    const en = e.isCurrent || !e.endDate ? now : new Date(e.endDate);
    if (s && !isNaN(s.getTime()) && !isNaN(en.getTime())) {
      totalMonths += Math.max(0, (en.getFullYear() - s.getFullYear()) * 12 + (en.getMonth() - s.getMonth()));
    }
    const sen = classifyRoleSeniority(e.role || '');
    if (sen.mult > topMult) { topMult = sen.mult; topLabel = sen.level; }
  }
  const years      = totalMonths / 12;
  const yearsScore = Math.min(years / 10, 1);
  const points     = 20 * (yearsScore * 0.6 + topMult * 0.4);
  const yearsTxt   = years >= 0.1 ? `${years.toFixed(1)} yrs` : 'tenure not detected';
  return { points, summary: [yearsTxt, topLabel ? `peak role: ${topLabel}` : ''].filter(Boolean).join(' · ') };
}

export const CERT_TOP_TIER = [
  'pmp','prince2','cfa','cpa','ca\\b','cs\\b','cma','frm','cisa','cism','cissp','ccsp','ceh',
  'aws certified','azure certified','google cloud','gcp certified',
  'salesforce certified','servicenow certified',
  'six sigma black belt','six sigma master','shrm-cp','shrm-scp','sphr','phr','cipd level 7',
  'cscp','cpim','itil expert','itil master','togaf','pmi-acp',
  'safe agilist','safe program consultant','oracle certified master','sap certified',
];

export const CERT_MID_TIER = [
  'google certified','microsoft certified','azure fundamentals','aws cloud practitioner',
  'coursera specialization','edx micromasters','nasscom','nptel','ibm certified',
  'six sigma green belt','csm\\b','psm\\b','scrum master','product owner',
  'cipd level 5','linkedin learning',
];

export function classifyCertTier(name: string): { tier: 'top'|'mid'|'generic'; pts: number } {
  const n = (name || '').toLowerCase();
  if (!n) return { tier: 'generic', pts: 1 };
  if (CERT_TOP_TIER.some(k => new RegExp(k).test(n))) return { tier: 'top',     pts: 4   };
  if (CERT_MID_TIER.some(k => new RegExp(k).test(n))) return { tier: 'mid',     pts: 2.5 };
  return { tier: 'generic', pts: 1 };
}

export function classifyCertifications(
  certs: Array<{ name?: string; title?: string; issuer?: string }>,
): { points: number; summary: string } {
  if (!certs || certs.length === 0) return { points: 0, summary: 'No certifications yet — even one top-tier cert adds measurable signal.' };
  let total = 0;
  const byTier = { top: 0, mid: 0, generic: 0 };
  for (const c of certs) {
    const label = `${c.name || c.title || ''} ${c.issuer || ''}`.trim();
    const t = classifyCertTier(label);
    total += t.pts;
    byTier[t.tier]++;
  }
  const capped = Math.min(total, 10);
  const parts: string[] = [];
  if (byTier.top)     parts.push(`${byTier.top} top-tier`);
  if (byTier.mid)     parts.push(`${byTier.mid} mid-tier`);
  if (byTier.generic) parts.push(`${byTier.generic} generic`);
  return { points: capped, summary: parts.length ? `${parts.join(' · ')} → ${capped.toFixed(1)} / 10 pts` : '0 / 10 pts' };
}

// ─── 8-dimension Employability Index formula ──────────────────────────────────
// Dimensions and weights (must sum to 100):
//   Assessment       25 pts — validated competency score; 0 when not taken
//   Experience       20 pts — tenure × peak seniority (quality-weighted)
//   Education        15 pts — degree level × institution tier
//   Technical Skills 15 pts — 1.875 pts each up to 8 skills
//   Certifications   10 pts — issuer-tier-weighted, capped at 10
//   Soft Skills       8 pts — 1.6 pts each up to 5 skills
//   Projects          4 pts — 1 pt each up to 4
//   Profile           3 pts — completeness % × 0.03

export interface EIBreakdown {
  assessmentScore:   number;
  experienceScore:   number;
  educationScore:    number;
  technicalScore:    number;
  certScore:         number;
  softScore:         number;
  projectScore:      number;
  completenessScore: number;
}

export interface ExplainabilityFactor {
  id:     string;
  label:  string;
  earned: number;
  max:    number;
  pct:    number;
  status: 'strong'|'good'|'needs-work'|'missing';
  action: string;
}

export interface ImprovementRoadmap {
  shortTerm:  string[];
  mediumTerm: string[];
  longTerm:   string[];
}

export interface EIOutput {
  score:              number;
  band:               string;
  color:              string;
  breakdown:          EIBreakdown;
  tips:               string[];
  explainability:     ExplainabilityFactor[];
  improvementRoadmap: ImprovementRoadmap;
  percentileEstimate: number;
}

export interface EIInput {
  profile: CareerProfile | null | undefined;
}

function factorStatus(earned: number, max: number): ExplainabilityFactor['status'] {
  const r = earned / Math.max(1, max);
  if (r >= 0.85) return 'strong';
  if (r >= 0.55) return 'good';
  if (r >  0)    return 'needs-work';
  return 'missing';
}

function buildExplainability(p: CareerProfile | null | undefined, b: EIBreakdown): ExplainabilityFactor[] {
  const assessmentTaken = typeof (p as any)?.assessmentScore === 'number';
  const tech   = (p?.skills?.technical ?? []).length;
  const soft   = (p?.skills?.soft ?? []).length;
  const certs  = (p?.certifications ?? []).length;
  const projs  = (p?.projects ?? []).length;
  const base   = p?.competencyProfile?.completeness ?? 0;

  return [
    {
      id: 'assessment', label: 'Competency Assessment',
      earned: Math.round(b.assessmentScore), max: 25,
      pct: Math.round((b.assessmentScore / 25) * 100),
      status: factorStatus(b.assessmentScore, 25),
      action: assessmentTaken
        ? (b.assessmentScore >= 22 ? 'Assessment score is strong' : 'Retake the assessment to improve your score')
        : 'Take the competency assessment — worth up to 25 EI pts',
    },
    {
      id: 'experience', label: 'Work Experience (Quality)',
      earned: Math.round(b.experienceScore), max: 20,
      pct: Math.round((b.experienceScore / 20) * 100),
      status: factorStatus(b.experienceScore, 20),
      action: b.experienceScore < 20
        ? 'Add accurate role titles and dates — seniority and tenure both increase your score'
        : 'Experience signal is strong',
    },
    {
      id: 'education', label: 'Education (Tier-weighted)',
      earned: Math.round(b.educationScore), max: 15,
      pct: Math.round((b.educationScore / 15) * 100),
      status: factorStatus(b.educationScore, 15),
      action: b.educationScore < 15
        ? 'Ensure your degree and institution are accurately listed'
        : 'Education signal is strong',
    },
    {
      id: 'technical', label: 'Technical Skills Depth',
      earned: Math.round(b.technicalScore), max: 15,
      pct: Math.round((b.technicalScore / 15) * 100),
      status: factorStatus(b.technicalScore, 15),
      action: tech < 8
        ? `Add ${8 - tech} more technical skill${8 - tech > 1 ? 's' : ''} — each adds 1.875 pts`
        : 'Technical breadth is maxed',
    },
    {
      id: 'certifications', label: 'Certifications',
      earned: Math.round(b.certScore), max: 10,
      pct: Math.round((b.certScore / 10) * 100),
      status: factorStatus(b.certScore, 10),
      action: certs === 0
        ? 'Earn one certification (AWS, PMP, CFA) — top-tier certs contribute up to 4 pts each'
        : b.certScore < 10 ? 'Add a top-tier certification to boost this dimension' : 'Certifications maxed',
    },
    {
      id: 'soft', label: 'Soft Skills Signal',
      earned: Math.round(b.softScore), max: 8,
      pct: Math.round((b.softScore / 8) * 100),
      status: factorStatus(b.softScore, 8),
      action: soft < 5
        ? `Add ${5 - soft} more soft skill${5 - soft > 1 ? 's' : ''} (Leadership, Communication, Problem Solving)`
        : 'Soft skills signal is solid',
    },
    {
      id: 'projects', label: 'Portfolio & Projects',
      earned: Math.round(b.projectScore), max: 4,
      pct: Math.round((b.projectScore / 4) * 100),
      status: factorStatus(b.projectScore, 4),
      action: projs === 0
        ? 'Add a personal or open-source project — signals initiative'
        : projs < 4 ? 'Document 1–2 more projects with outcomes and tech stack' : 'Portfolio is maxed',
    },
    {
      id: 'profile', label: 'Profile Completeness',
      earned: Math.round(b.completenessScore), max: 3,
      pct: Math.round((b.completenessScore / 3) * 100),
      status: factorStatus(b.completenessScore, 3),
      action: base < 80
        ? `Complete profile basics — bio, location, LinkedIn (currently ${base}%)`
        : 'Profile completeness is excellent',
    },
  ];
}

function buildRoadmap(p: CareerProfile | null | undefined, score: number): ImprovementRoadmap {
  const base   = p?.competencyProfile?.completeness ?? 0;
  const tech   = (p?.skills?.technical ?? []).length;
  const certs  = (p?.certifications ?? []).length;
  const projs  = (p?.projects ?? []).length;
  const hasLI  = !!(p?.personal as any)?.linkedin;
  const hasSumm= !!(p as any)?.summary;
  const assessmentTaken = typeof (p as any)?.assessmentScore === 'number';

  const s: string[] = [], m: string[] = [], l: string[] = [];

  if (!assessmentTaken) s.push('Take the competency assessment — worth up to 25 EI pts');
  if (!hasSumm)         s.push('Write a 2-sentence professional summary');
  if (!hasLI)           s.push('Link your LinkedIn profile');
  if (tech < 5)         s.push(`Add ${5 - tech} more technical skills`);

  if (projs === 0)  m.push('Build and document a portfolio project');
  if (certs === 0)  m.push('Earn one relevant industry certification');
  if (base < 80)    m.push('Complete all remaining profile sections');
  if (score < 55)   m.push('Improve your assessment score to close role-fit gaps');

  if (score < 70) l.push('Target 2 certifications and 3+ portfolio projects');
  l.push('Build an online presence — GitHub, Behance, or personal portfolio site');
  l.push('Gain substantive experience (freelance, contract, or FTE roles)');

  return { shortTerm: s.slice(0, 3), mediumTerm: m.slice(0, 3), longTerm: l.slice(0, 3) };
}

function buildTips(p: CareerProfile | null | undefined, score: number): string[] {
  const tips: string[] = [];
  const base   = p?.competencyProfile?.completeness ?? 0;
  const tech   = (p?.skills?.technical ?? []).length;
  const certs  = (p?.certifications ?? []).length;
  const projs  = (p?.projects ?? []).length;
  const hasLI  = !!(p?.personal as any)?.linkedin;
  const hasSumm= !!(p as any)?.summary;
  const assessmentTaken = typeof (p as any)?.assessmentScore === 'number';

  if (!assessmentTaken) tips.push('Take the competency assessment — it unlocks up to 25 EI points.');
  if (base < 60)        tips.push('Complete your profile to above 60% to unlock a higher EI ceiling.');
  if (tech < 5)         tips.push('Add more technical skills — each one directly improves your score.');
  if (certs === 0)      tips.push('A relevant certification adds up to 4 EI points per top-tier cert.');
  if (projs === 0)      tips.push('Add a personal or professional project to signal initiative.');
  if (!hasSumm)         tips.push('Write a 2-line professional summary — it also boosts recruiter visibility.');
  if (!hasLI)           tips.push('Link your LinkedIn profile to unlock recruiter visibility signals.');
  if (score < 35)       tips.push('Run the Competency Assessment to generate a detailed development plan.');

  return tips.slice(0, 4);
}

function estimatePercentile(score: number): number {
  if (score >= 90) return 97;
  if (score >= 80) return 90;
  if (score >= 70) return 80;
  if (score >= 60) return 65;
  if (score >= 50) return 50;
  if (score >= 40) return 35;
  if (score >= 30) return 20;
  return 10;
}

export function runEmployabilityEngine(input: EIInput): EIOutput {
  const p = input.profile;

  const techSkills   = (p?.skills?.technical ?? []).length;
  const softSkills   = (p?.skills?.soft ?? []).length;
  const projCount    = (p?.projects ?? []).length;
  const completeness = p?.competencyProfile?.completeness ?? 0;

  const assessmentRaw   = (p as any)?.assessmentScore;
  const assessmentTaken = typeof assessmentRaw === 'number';
  const assessmentScore = assessmentTaken ? Math.max(0, Math.min(100, assessmentRaw)) : 0;

  const eduResult  = classifyEducation(p?.education ?? []);
  const expResult  = classifyExperience(p?.experience ?? []);
  const certResult = classifyCertifications(p?.certifications ?? []);

  const assessmentDim   = assessmentTaken ? (assessmentScore / 100) * 25 : 0;
  const experienceDim   = expResult.points;
  const educationDim    = eduResult.points;
  const technicalDim    = Math.min(techSkills * 1.875, 15);
  const certDim         = certResult.points;
  const softDim         = Math.min(softSkills * 1.6, 8);
  const projectDim      = Math.min(projCount * 1, 4);
  const completenessDim = (completeness / 100) * 3;

  const raw   = assessmentDim + experienceDim + educationDim + technicalDim + certDim + softDim + projectDim + completenessDim;
  const score = Math.min(Math.round(raw), 99);
  const band  = getEIBand(score);

  const breakdown: EIBreakdown = {
    assessmentScore:   +assessmentDim.toFixed(1),
    experienceScore:   +experienceDim.toFixed(1),
    educationScore:    +educationDim.toFixed(1),
    technicalScore:    +technicalDim.toFixed(1),
    certScore:         +certDim.toFixed(1),
    softScore:         +softDim.toFixed(1),
    projectScore:      +projectDim.toFixed(1),
    completenessScore: +completenessDim.toFixed(1),
  };

  return {
    score,
    band:               band.label,
    color:              band.color,
    breakdown,
    tips:               buildTips(p, score),
    explainability:     buildExplainability(p, breakdown),
    improvementRoadmap: buildRoadmap(p, score),
    percentileEstimate: estimatePercentile(score),
  };
}
