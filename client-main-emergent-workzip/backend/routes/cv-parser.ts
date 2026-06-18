import type { Express, Request, Response } from "express";
import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

interface ParsedCVProfile {
  personal: {
    name: string; email: string; phone: string; location: string;
    linkedin: string; github: string; website: string; portfolio: string;
  };
  summary: string;
  skills: { technical: string[]; soft: string[]; tools: string[]; languages: string[] };
  education: Array<{ institution: string; degree: string; field: string; startYear: string; endYear: string; grade: string }>;
  experience: Array<{ company: string; role: string; startDate: string; endDate: string; description: string; isCurrent: boolean }>;
  certifications: Array<{ name: string; issuer: string; year: string }>;
  projects: Array<{ name: string; description: string; tech: string[]; url: string }>;
  achievements: string[];
  spokenLanguages: string[];
  competencyProfile: { completeness: number; sectionsFilled: string[] };
}

async function extractText(file: Express.Multer.File): Promise<string> {
  const name = (file.originalname || "").toLowerCase();
  const mime = file.mimetype || "";

  if (name.endsWith(".pdf") || mime.includes("pdf")) {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(file.buffer) });
    try {
      const result = await parser.getText();
      return String((result as { text?: string }).text ?? "");
    } finally {
      await parser.destroy().catch(() => {});
    }
  }
  if (name.endsWith(".docx") || mime.includes("officedocument.wordprocessingml")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return String(result.value ?? "");
  }
  if (name.endsWith(".txt") || mime.startsWith("text/")) {
    return file.buffer.toString("utf8");
  }
  throw new Error("Unsupported file type. Please upload a PDF, DOCX, or TXT file.");
}

const TECH_SKILLS = [
  "JavaScript","TypeScript","Python","Java","C++","C#","Golang","Rust","Ruby","PHP","Swift","Kotlin","Scala","R","MATLAB",
  "React","Next.js","Vue","Angular","Svelte","Node.js","Express","Django","Flask","FastAPI",
  "Spring","Rails","Laravel","SQL","PostgreSQL","MySQL","MongoDB","Redis","Elasticsearch","Snowflake","BigQuery",
  "AWS","Azure","GCP","Docker","Kubernetes","Terraform","CI/CD","GitHub","GitLab","Bitbucket","GraphQL","REST","gRPC",
  "HTML","CSS","Tailwind","Sass","Webpack","Vite","Jest","Cypress","Playwright","Selenium",
  "TensorFlow","PyTorch","Pandas","NumPy","Scikit-learn","Machine Learning","Deep Learning","Data Science","NLP","LLM","Generative AI",
  // HR / People domain
  "Talent Acquisition","Talent Management","Performance Management","Compensation","Payroll","HRBP","HRIS",
  "Workforce Planning","Organizational Development","Employee Engagement","Learning & Development","L&D",
  "Diversity & Inclusion","DEI","Succession Planning","Compliance","Labour Law","Industrial Relations",
  "Change Management","Stakeholder Management","Strategic Planning","Business Strategy","P&L",
  "Recruitment","Onboarding","Talent Development","Coaching","Mentoring",
  // Product / Ops
  "Product Management","Project Management","Agile","Scrum","Kanban","Lean","Six Sigma","PMO",
  "Operations","Supply Chain","Vendor Management","Budgeting","Forecasting",
  // Marketing / Sales
  "Digital Marketing","Brand Management","SEO","SEM","Content Marketing","Sales","Business Development","CRM",
];
const SOFT_SKILLS = [
  "Leadership","Communication","Teamwork","Problem Solving","Critical Thinking","Adaptability","Resilience",
  "Creativity","Time Management","Collaboration","Mentoring","Presentation","Negotiation","Public Speaking",
  "Emotional Intelligence","Decision Making","Conflict Resolution","Strategic Thinking","Innovation","Empathy",
];
const TOOL_SKILLS = [
  "Jira","Confluence","Slack","Notion","Figma","Sketch","Photoshop","Illustrator","Canva",
  "Excel","PowerPoint","Word","Tableau","Power BI","Looker","Google Analytics",
  "Salesforce","HubSpot","SAP","Workday","SuccessFactors","BambooHR","Greenhouse","LinkedIn Recruiter",
  "Oracle","ServiceNow","Zoho","Asana","Trello","Monday.com",
];
const SPOKEN_LANGUAGES = [
  "English","Hindi","Tamil","Telugu","Kannada","Malayalam","Marathi","Bengali","Gujarati",
  "Punjabi","Urdu","Spanish","French","German","Mandarin","Japanese","Arabic","Portuguese",
];

function uniqueFind(text: string, vocabulary: string[]): string[] {
  const found = new Set<string>();
  const lower = text.toLowerCase();
  for (const term of vocabulary) {
    const escaped = term.replace(/[.+*?^$()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, "i");
    if (re.test(lower)) found.add(term);
  }
  return Array.from(found);
}

const SECTION_HEADERS: Record<string, RegExp> = {
  summary: /^\s*(?:professional\s+)?(?:summary|profile|objective|about\s*me|career\s+objective|executive\s+summary|profile\s+summary)\s*[:\-]?\s*$/i,
  education: /^\s*(?:education(?:\s+(?:&|and)\s+qualifications?)?|academic(?:s|\s+background|\s+qualifications?)?|qualifications?|educational\s+background)\s*[:\-]?\s*$/i,
  experience: /^\s*(?:experience|work\s+experience|employment(?:\s+history)?|professional\s+experience|career\s+history|career\s+summary|career\s+journey|career\s+progression|professional\s+journey|work\s+history|career\s+highlights)\s*[:\-]?\s*$/i,
  projects: /^\s*(?:projects?|notable\s+projects?|key\s+projects?|personal\s+projects?|select(?:ed)?\s+projects?)\s*[:\-]?\s*$/i,
  certifications: /^\s*(?:certifications?|certificates?|licenses?|accreditations?|professional\s+(?:certifications?|development))\s*[:\-]?\s*$/i,
  achievements: /^\s*(?:achievements?|awards?|honou?rs?|accomplishments?|recognition|key\s+achievements?|notable\s+achievements?)\s*[:\-]?\s*$/i,
  skills: /^\s*(?:skills?|technical\s+skills?|core\s+competenc(?:y|ies)|key\s+skills?|areas\s+of\s+expertise|expertise|competenc(?:y|ies))\s*[:\-]?\s*$/i,
  languages: /^\s*(?:languages?(?:\s+known)?|spoken\s+languages?)\s*[:\-]?\s*$/i,
};

interface SectionMap {
  summary?: string[];
  education?: string[];
  experience?: string[];
  projects?: string[];
  certifications?: string[];
  achievements?: string[];
  skills?: string[];
  languages?: string[];
}

function splitIntoSections(lines: string[]): SectionMap {
  const map: SectionMap = {};
  let current: keyof SectionMap | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    let matched: keyof SectionMap | null = null;
    for (const [key, re] of Object.entries(SECTION_HEADERS)) {
      if (re.test(line)) {
        matched = key as keyof SectionMap;
        break;
      }
    }
    if (matched) {
      current = matched;
      if (!map[current]) map[current] = [];
      continue;
    }
    if (current) {
      (map[current] as string[]).push(line);
    }
  }
  return map;
}

const DATE_RANGE = /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{1,2}\/\d{4}|\d{4})\s*(?:[-–—to]+)\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{1,2}\/\d{4}|\d{4}|Present|Current|Now|Ongoing)/i;
const YEAR_RANGE = /\b((?:19|20)\d{2})\b\s*(?:[-–—to]+)\s*\b((?:19|20)\d{2}|Present|Current|Now|Ongoing)\b/i;
const SINGLE_YEAR = /\b(?:19|20)\d{2}\b/;
const DEGREE_KEYWORDS = /\b(B\.?Tech|B\.?E\.?|BSc|B\.?Sc\.?|BCA|BCom|B\.?Com|BBA|BA|B\.?A\.?|MBA|MSc|M\.?Sc\.?|MCA|MTech|M\.?Tech|MA|M\.?A\.?|MCom|M\.?Com|PhD|Ph\.?D\.?|Diploma|Bachelor|Master|Doctorate|HSC|SSC|Class\s+(?:10|12|XII|X)|Higher\s+Secondary|Senior\s+Secondary)\b/i;
const FIELD_KEYWORDS = /\b(Computer\s+Science|Information\s+Technology|Software\s+Engineering|Electronics|Mechanical|Civil|Electrical|Chemical|Biotechnology|Mathematics|Physics|Chemistry|Biology|Commerce|Economics|Finance|Marketing|Management|Business|Arts|Humanities|Law|Medicine|Architecture|Design|Psychology|Sociology|History|English|Statistics|Data\s+Science|AI|Artificial\s+Intelligence|Machine\s+Learning)\b/i;
const GRADE_REGEX = /\b(?:CGPA|GPA|SGPA|Percentage|Score)\s*[:\-]?\s*([\d.]+\s*\/?\s*\d*\.?\d*|\d+(?:\.\d+)?%?)|(\d+(?:\.\d+)?\s*\/\s*10)|(\d+(?:\.\d+)?\s*%)/i;

const LOCATION_HINT = /\b(?:Bangalore|Bengaluru|Mumbai|Delhi|Hyderabad|Chennai|Kolkata|Pune|Noida|Gurgaon|Gurugram|Ahmedabad|Jaipur|Remote|Hybrid|Onsite|India|USA|UK|United\s+States|United\s+Kingdom|Singapore|Dubai|London|New\s+York|San\s+Francisco|Seattle|Toronto|Berlin|Sydney)\b/i;

function isLocationOnly(line: string): boolean {
  const t = line.trim();
  if (t.length > 60) return false;
  if (!LOCATION_HINT.test(t)) return false;
  return /^[A-Za-z ,.\-]+$/.test(t);
}

function isBulletLine(line: string): boolean {
  return /^[•\-*·]/.test(line.trim());
}
function isDateLine(line: string): boolean {
  const stripped = line.trim();
  if (DATE_RANGE.test(stripped) || YEAR_RANGE.test(stripped)) return true;
  return /^\(?\s*(?:\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{4})\s*(?:[-–—to]+\s*(?:\d{4}|Present|Current|Now|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}))?\s*\)?$/i.test(stripped);
}
function looksLikeTitle(line: string): boolean {
  const t = line.trim();
  if (!t || isBulletLine(t) || isDateLine(t)) return false;
  if (isLocationOnly(t)) return false;
  if (t.length > 120) return false;
  return /^[A-Z0-9]/.test(t);
}

function splitEntries(block: string[]): string[][] {
  const entries: string[][] = [];
  let current: string[] = [];
  let currentHasDate = false;
  let currentHasBullet = false;

  const flush = () => {
    if (current.length > 0) entries.push(current);
    current = [];
    currentHasDate = false;
    currentHasBullet = false;
  };

  for (const raw of block) {
    const line = raw.trim();
    if (!line) continue;

    const isTitle = looksLikeTitle(line);
    const hasDate = isDateLine(line) || YEAR_RANGE.test(line) || DATE_RANGE.test(line);
    const isBullet = isBulletLine(line);

    if (current.length === 0) {
      current.push(line);
      if (hasDate) currentHasDate = true;
      if (isBullet) currentHasBullet = true;
      continue;
    }

    const dateBoundary = isTitle && !hasDate && currentHasDate && !isBullet;
    const bulletBoundary = isTitle && !isBullet && currentHasBullet && !currentHasDate;
    if (dateBoundary || bulletBoundary) {
      flush();
      current.push(line);
      continue;
    }

    current.push(line);
    if (hasDate) currentHasDate = true;
    if (isBullet) currentHasBullet = true;
  }
  flush();
  return entries.filter((e) => e.length > 0);
}

function parseEducationEntries(block: string[]): ParsedCVProfile["education"] {
  if (!block.length) return [];
  const entries = splitEntries(block);
  const out: ParsedCVProfile["education"] = [];
  for (const entry of entries) {
    const joined = entry.join(" | ");
    const yr = joined.match(YEAR_RANGE) ?? joined.match(/(\d{4})\s*(?:[-–—to]+)\s*(\d{4}|Present|Current)/i);
    const years = joined.match(/\b(19|20)\d{2}\b/g) ?? [];
    const startYear = yr?.[1] ?? years[0] ?? "";
    const endYear = yr?.[2] ?? (years.length > 1 ? years[years.length - 1] : "");
    const degreeMatch = joined.match(DEGREE_KEYWORDS);
    const fieldMatch = joined.match(FIELD_KEYWORDS);
    const gradeMatch = joined.match(GRADE_REGEX);
    const institutionLine = entry.find((l) =>
      /\b(University|College|Institute|School|Academy|IIT|IIM|NIT|BITS|IISc)\b/i.test(l),
    ) ?? entry[0];
    const institution = institutionLine
      .replace(DATE_RANGE, "")
      .replace(YEAR_RANGE, "")
      .replace(/\|/g, "")
      .replace(/[,;–—-]+\s*$/g, "")
      .trim()
      .slice(0, 120);
    if (!institution && !degreeMatch) continue;
    out.push({
      institution,
      degree: degreeMatch?.[0] ?? "",
      field: fieldMatch?.[0] ?? "",
      startYear,
      endYear,
      grade: (gradeMatch?.[1] ?? gradeMatch?.[2] ?? gradeMatch?.[3] ?? "").trim(),
    });
  }
  return out.slice(0, 8);
}

function parseExperienceEntries(block: string[]): ParsedCVProfile["experience"] {
  if (!block.length) return [];
  const entries = splitEntries(block);
  const out: ParsedCVProfile["experience"] = [];
  for (const entry of entries) {
    const headerLine = entry[0] ?? "";
    const joined = entry.join(" ");
    const dateMatch =
      joined.match(DATE_RANGE) ??
      joined.match(/(\d{4})\s*(?:[-–—to]+)\s*(\d{4}|Present|Current|Now)/i);
    const startDate = dateMatch?.[1] ?? "";
    const endDate = dateMatch?.[2] ?? "";
    const isCurrent = /Present|Current|Now|Ongoing/i.test(endDate);

    const headerParts = headerLine
      .replace(DATE_RANGE, "")
      .split(/\s+(?:at|@|\||–|—|,)\s+/i)
      .map((s) => s.trim())
      .filter(Boolean);
    let role = headerParts[0] ?? "";
    let company = headerParts[1] ?? "";
    if (!company) {
      for (let i = 1; i < entry.length; i++) {
        const candidate = entry[i].replace(DATE_RANGE, "").trim();
        if (!candidate) continue;
        if (isBulletLine(candidate)) break;
        if (isDateLine(candidate)) continue;
        if (LOCATION_HINT.test(candidate) && candidate.length < 60) continue;
        if (candidate.length < 80) {
          company = candidate;
        }
        break;
      }
    }
    role = role.replace(/[,;–—-]+\s*$/g, "").slice(0, 120);
    company = company.replace(/[,;–—-]+\s*$/g, "").slice(0, 120);

    const descLines = entry
      .slice(1)
      .filter((l) => {
        const t = l.trim();
        if (!t) return false;
        if (t === company) return false;
        if (isDateLine(t)) return false;
        if (LOCATION_HINT.test(t) && t.length < 60) return false;
        return true;
      })
      .map((l) => l.replace(/^[•\-*·]\s*/, "").trim())
      .filter(Boolean);
    const description = descLines.join(" • ").slice(0, 600);

    if (!role && !company) continue;
    out.push({
      company,
      role,
      startDate,
      endDate: isCurrent ? "Present" : endDate,
      description,
      isCurrent,
    });
  }
  return out.slice(0, 12);
}

function parseProjectEntries(block: string[]): ParsedCVProfile["projects"] {
  if (!block.length) return [];
  const entries = splitEntries(block);
  const out: ParsedCVProfile["projects"] = [];
  for (const entry of entries) {
    const header = entry[0] ?? "";
    const name = header.replace(/[•\-*·]\s*/, "").replace(/\|.*$/, "").replace(/[,;]+\s*$/g, "").trim().slice(0, 120);
    if (!name) continue;
    const allText = entry.join(" ");
    const urlMatch = allText.match(/https?:\/\/[^\s)]+/);
    const tech = uniqueFind(allText, TECH_SKILLS);
    const description = entry
      .slice(1)
      .map((l) => l.replace(/^[•\-*·]\s*/, "").trim())
      .filter(Boolean)
      .join(" • ")
      .slice(0, 500);
    out.push({ name, description, tech, url: urlMatch?.[0] ?? "" });
  }
  return out.slice(0, 10);
}

function parseCertificationEntries(block: string[]): ParsedCVProfile["certifications"] {
  if (!block.length) return [];
  const out: ParsedCVProfile["certifications"] = [];
  for (const raw of block) {
    const line = raw.replace(/^[•\-*·]\s*/, "").trim();
    if (!line) continue;
    const yearMatch = line.match(SINGLE_YEAR);
    const issuerMatch = line.match(/(?:by|from|–|—|-|,|\|)\s*([A-Z][A-Za-z0-9 &.'/-]{2,60?})/);
    const name = line.split(/[–—|,]|(?:\s-\s)|(?:\sby\s)|(?:\sfrom\s)/i)[0].replace(/[,;]+\s*$/g, "").trim().slice(0, 120);
    if (!name) continue;
    out.push({
      name,
      issuer: (issuerMatch?.[1] ?? "").trim().slice(0, 80),
      year: yearMatch?.[0] ?? "",
    });
  }
  return out.slice(0, 15);
}

function parseAchievementLines(block: string[]): string[] {
  return block
    .map((l) => l.replace(/^[•\-*·]\s*/, "").trim())
    .filter((l) => l.length >= 5 && l.length <= 280)
    .slice(0, 15);
}

function heuristicParse(text: string): ParsedCVProfile {
  const cleaned = text.replace(/\r/g, "").trim();
  const lines = cleaned.split("\n").map((l) => l.trim()).filter(Boolean);

  const emailMatch = cleaned.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  const phoneMatch = (() => {
    const re = /(\+?\d{1,3}[\s.\-]?)?\(?\d{2,5}\)?[\s.\-]?\d{3,5}[\s.\-]?\d{3,5}/g;
    const candidates = cleaned.match(re) ?? [];
    for (const c of candidates) {
      const digits = c.replace(/\D/g, "");
      if (digits.length >= 10 && digits.length <= 15) return [c] as RegExpMatchArray;
    }
    return null;
  })();
  const linkedinMatch = cleaned.match(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s)]+/i);
  const githubMatch = cleaned.match(/https?:\/\/(?:www\.)?github\.com\/[^\s)]+/i);
  const websiteMatch = cleaned.match(/https?:\/\/(?!(?:www\.)?(?:linkedin|github)\.com)[^\s)]+/i);

  const nameLine = lines.find((l) =>
    l.length > 2 && l.length < 60 &&
    /^[A-Z][A-Za-z .'-]+(?:\s+[A-Z][A-Za-z .'-]+)+$/.test(l) &&
    !l.includes("@"),
  ) ?? "";

  const sections = splitIntoSections(lines);

  const skillsText = (sections.skills ?? []).join(" ") + " " + cleaned;
  const technicalVocab = uniqueFind(skillsText, TECH_SKILLS);
  const soft = uniqueFind(skillsText, SOFT_SKILLS);
  const tools = uniqueFind(skillsText, TOOL_SKILLS);

  // Direct skill phrases from a Skills/Expertise section — split by commas, pipes, bullets, semicolons
  const directSkillPhrases: string[] = [];
  const GARBAGE_SKILL = /^(?:page|p\.?|of|and|or|the|a|an|\d+\s*of\s*\d+|[-–—\s]+|\d+)$/i;
  for (const ln of sections.skills ?? []) {
    if (/page\s*\d|^\s*\d+\s*$|\bof\s+\d+\b/i.test(ln)) continue;
    const parts = ln
      .replace(/^[•\-*·●▪►]\s*/, "")
      .split(/[,;|•·●▪|]|(?:\s\u2013\s)|(?:\s-\s)/)
      .map((s) => s.replace(/^[-–—\s]+|[-–—\s]+$/g, "").trim())
      .filter((s) => {
        if (s.length < 2 || s.length > 60) return false;
        if (!/[A-Za-z]{2,}/.test(s)) return false;
        if (GARBAGE_SKILL.test(s)) return false;
        return true;
      });
    directSkillPhrases.push(...parts);
  }
  const SOFT_SET = new Set(SOFT_SKILLS.map((s) => s.toLowerCase()));
  const TOOL_SET = new Set(TOOL_SKILLS.map((s) => s.toLowerCase()));
  const seenSkill = new Set<string>([...technicalVocab, ...soft, ...tools].map((s) => s.toLowerCase()));
  const extraTechnical: string[] = [];
  for (const p of directSkillPhrases) {
    const key = p.toLowerCase();
    if (seenSkill.has(key)) continue;
    if (SOFT_SET.has(key) || TOOL_SET.has(key)) continue;
    if (!/[A-Za-z]/.test(p)) continue;
    seenSkill.add(key);
    extraTechnical.push(p);
  }
  const technical = [...technicalVocab, ...extraTechnical].slice(0, 40);
  const spokenFromSection = (sections.languages ?? []).join(" ");
  const spoken = uniqueFind(spokenFromSection || cleaned, SPOKEN_LANGUAGES);

  const summary = (() => {
    if (sections.summary && sections.summary.length) {
      return sections.summary.join(" ").slice(0, 1200);
    }
    const idx = cleaned.search(/(?:summary|profile|objective)\s*[:\-\n]/i);
    if (idx >= 0) {
      const tail = cleaned.slice(idx).split("\n").slice(1).join(" ").slice(0, 800).trim();
      if (tail.length > 20) return tail;
    }
    return lines.slice(1, 6).join(" ").slice(0, 600);
  })();

  const education = parseEducationEntries(sections.education ?? []);
  const experience = parseExperienceEntries(sections.experience ?? []);
  const projects = parseProjectEntries(sections.projects ?? []);
  const certifications = parseCertificationEntries(sections.certifications ?? []);
  const achievements = parseAchievementLines(sections.achievements ?? []);

  const locationMatch = cleaned.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?,\s*(?:[A-Z][a-z]+|[A-Z]{2,}))\b/);

  const sectionsFilled: string[] = [];
  if (nameLine) sectionsFilled.push("personal");
  if (emailMatch) sectionsFilled.push("email");
  if (phoneMatch) sectionsFilled.push("phone");
  if (linkedinMatch) sectionsFilled.push("linkedin");
  if (githubMatch) sectionsFilled.push("github");
  if (technical.length) sectionsFilled.push("technical_skills");
  if (soft.length) sectionsFilled.push("soft_skills");
  if (tools.length) sectionsFilled.push("tools");
  if (spoken.length) sectionsFilled.push("languages");
  if (summary) sectionsFilled.push("summary");
  if (education.length) sectionsFilled.push("education");
  if (experience.length) sectionsFilled.push("experience");
  if (projects.length) sectionsFilled.push("projects");
  if (certifications.length) sectionsFilled.push("certifications");
  if (achievements.length) sectionsFilled.push("achievements");

  const CORE_WEIGHTS: Record<string, number> = {
    personal: 12, email: 12, phone: 8, summary: 12,
    education: 14, experience: 18,
    technical_skills: 10, soft_skills: 8,
  };
  const BONUS_WEIGHTS: Record<string, number> = {
    phone: 0, linkedin: 4, github: 3, tools: 3, languages: 3,
    projects: 4, certifications: 4, achievements: 3,
  };
  let coreScore = 0;
  for (const s of sectionsFilled) coreScore += CORE_WEIGHTS[s] ?? 0;
  let bonusScore = 0;
  for (const s of sectionsFilled) bonusScore += BONUS_WEIGHTS[s] ?? 0;
  const completeness = Math.min(100, Math.round(coreScore + Math.min(bonusScore, 18)));

  return {
    personal: {
      name: nameLine,
      email: emailMatch?.[0] ?? "",
      phone: phoneMatch?.[0]?.trim() ?? "",
      location: locationMatch?.[1] ?? "",
      linkedin: linkedinMatch?.[0] ?? "",
      github: githubMatch?.[0] ?? "",
      website: websiteMatch?.[0] ?? "",
      portfolio: "",
    },
    summary,
    skills: { technical, soft, tools, languages: spoken },
    education,
    experience,
    certifications,
    projects,
    achievements,
    spokenLanguages: spoken,
    competencyProfile: { completeness, sectionsFilled },
  };
}

export function registerCvParserRoutes(app: Express): void {
  // Paste-text fallback — works for scanned PDFs, LinkedIn copy-paste, anything.
  app.post("/api/cv/parse-text", async (req: Request, res: Response) => {
    try {
      const text = String((req.body?.text ?? "")).trim();
      if (text.length < 30) {
        return res.status(400).json({
          success: false,
          message: "Please paste at least a few lines from your resume or LinkedIn profile.",
        });
      }
      if (text.length > 200_000) {
        return res.status(413).json({ success: false, message: "Text is too long. Please trim to under 200,000 characters." });
      }
      const profile = heuristicParse(text);
      return res.json({ success: true, profile });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[cv-parse-text] failed:", msg);
      return res.status(500).json({ success: false, message: `Could not parse text: ${msg}` });
    }
  });

  app.post(
    "/api/cv/parse",
    upload.single("cv"),
    async (req: Request, res: Response) => {
      try {
        const file = (req as any).file as Express.Multer.File | undefined;
        if (!file) {
          return res.status(400).json({ success: false, message: "No file uploaded. Field name must be 'cv'." });
        }

        let text: string;
        try {
          text = await extractText(file);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Could not read file";
          console.error("[cv-parse] extract failed:", msg, "file:", file.originalname, file.size, "bytes");
          return res.status(400).json({ success: false, message: msg });
        }

        if (!text || text.trim().length < 30) {
          console.warn("[cv-parse] empty text from", file.originalname, "— likely scanned image");
          return res.status(422).json({
            success: false,
            message: "We couldn't extract any text from this file. If it's a scanned image, please paste your details manually.",
          });
        }

        const profile = heuristicParse(text);
        return res.json({ success: true, profile });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("[cv-parse] failed:", msg);
        return res.status(500).json({ success: false, message: `CV parsing failed: ${msg}` });
      }
    },
  );
}
