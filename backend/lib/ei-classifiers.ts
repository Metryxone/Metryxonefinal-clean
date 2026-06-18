/**
 * Shared EI classifiers — used by both the legacy ei-engine and MEI v2.
 * Single source of truth for degree, institution, and seniority classification.
 */

export function classifyDegreeLevel(degree: string): { level: 'phd'|'masters'|'bachelors'|'diploma'|'other'; mult: number } {
  const d = (degree ?? '').toLowerCase();
  if (!d) return { level: 'other', mult: 0.30 };
  if (/\b(phd|ph\.d|doctorate|d\.phil|dphil|md\b)/.test(d))                                                         return { level: 'phd',       mult: 1.00 };
  if (/\b(m\.tech|mtech|m\.e\b|m\.s\b|ms\b|m\.a\b|ma\b|m\.com|mcom|m\.sc|msc|mba|pgdm|pg diploma|master)/.test(d)) return { level: 'masters',   mult: 0.85 };
  if (/\b(b\.tech|btech|b\.e\b|be\b|b\.sc|bsc|b\.a\b|ba\b|b\.com|bcom|bba|bca|llb|mbbs|bachelor)/.test(d))         return { level: 'bachelors', mult: 0.65 };
  if (/\b(diploma|polytechnic)/.test(d))                                                                              return { level: 'diploma',   mult: 0.40 };
  return { level: 'other', mult: 0.30 };
}

const TIER1 = [
  'iit ','iit-','iitb','iitd','iitm','iitk','iitkgp','iith','iitr','iitg','iima','iimb','iimc','iiml',
  'iisc','indian institute of science','aiims','isb','indian school of business',
  'nlsiu','nujs','nalsar','national law school',
  'nit ','nit-','national institute of technology',
  'bits pilani','bits hyderabad','bits goa',
  'xlri','tiss','jnu','iiit hyderabad','iiit delhi','iiit bangalore',
  'stanford','harvard','mit ','oxford','cambridge','yale','princeton','columbia','wharton',
  'berkeley','uc berkeley','caltech','chicago booth','insead','london business school','lse','eth zurich',
  'nus','ntu singapore',
];

const TIER2 = [
  'vit','vellore institute','srm','manipal','amity','symbiosis',
  'christ university','anna university','osmania','jadavpur','bhu','banaras hindu',
  'spjimr','mdi','imt ghaziabad','iift','fms delhi','jbims','welingkar',
  'thapar','nirma','lovely professional','lpu',
  'university of california','university of texas','university of michigan',
  'university of melbourne','university of sydney','monash','mcgill',
  'university of edinburgh','manchester','warwick','kings college',
];

export function classifyInstitutionTier(name: string): { tier: 1|2|3; mult: number } {
  const n = (name ?? '').toLowerCase();
  if (!n) return { tier: 3, mult: 0.50 };
  if (TIER1.some(k => n.includes(k))) return { tier: 1, mult: 1.00 };
  if (TIER2.some(k => n.includes(k))) return { tier: 2, mult: 0.75 };
  return { tier: 3, mult: 0.50 };
}

export function classifySeniority(title: string): { level: string; mult: number } {
  const t = (title ?? '').toLowerCase();
  if (!t) return { level: 'associate', mult: 0.55 };
  if (/\b(ceo|cfo|cto|coo|cmo|ciso|chief|founder|president|svp|evp|vice president)\b/.test(t)) return { level: 'c_suite', mult: 1.00 };
  if (/\b(vp |vice president|group vp)\b/.test(t))    return { level: 'vp', mult: 1.00 };
  if (/\b(director|head of|head,|principal|partner|general manager|gm)\b/.test(t))             return { level: 'director', mult: 0.90 };
  if (/\b(manager|lead |team lead|engineering manager|product manager|scrum master)\b/.test(t)) return { level: 'manager',  mult: 0.80 };
  if (/\b(senior|sr\.|specialist|architect|consultant|strategist)\b/.test(t))                   return { level: 'senior',   mult: 0.70 };
  if (/\b(associate|analyst|executive |engineer|developer|designer)\b/.test(t))                 return { level: 'associate',mult: 0.55 };
  if (/\b(junior|jr\.|trainee|intern|fresher|apprentice|graduate)\b/.test(t))                   return { level: 'junior',   mult: 0.35 };
  return { level: 'associate', mult: 0.55 };
}
