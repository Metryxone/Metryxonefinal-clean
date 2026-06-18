export interface CareerPath {
  role: string;
  level: number;
  yearsExp: string;
  avgSalary: string;
  skills: string[];
  nextRoles: string[];
}

export interface CareerDomain {
  label: string;
  icon: string;
  paths: CareerPath[];
}

export const CAREER_DOMAINS: CareerDomain[] = [
  { label: 'Software Engineering', icon: '💻', paths: [
    { role: 'Junior Developer',     level: 1, yearsExp: '0–2 yrs',  avgSalary: '₹4–8 LPA',       skills: ['HTML/CSS','JavaScript','Git','SQL'],                         nextRoles: ['Software Developer','Frontend Developer'] },
    { role: 'Software Developer',   level: 2, yearsExp: '2–5 yrs',  avgSalary: '₹8–18 LPA',      skills: ['React/Node','APIs','Testing','Docker'],                      nextRoles: ['Senior Developer','Tech Lead'] },
    { role: 'Senior Developer',     level: 3, yearsExp: '5–8 yrs',  avgSalary: '₹18–35 LPA',     skills: ['System Design','Mentoring','CI/CD','Cloud'],                 nextRoles: ['Tech Lead','Engineering Manager'] },
    { role: 'Tech Lead',            level: 4, yearsExp: '7–10 yrs', avgSalary: '₹35–60 LPA',     skills: ['Architecture','Leadership','Strategy','Stakeholder Mgmt'],   nextRoles: ['Engineering Manager','CTO'] },
    { role: 'Engineering Manager',  level: 5, yearsExp: '10+ yrs',  avgSalary: '₹50–1.2 Cr',     skills: ['People Mgmt','Budget','OKRs','Hiring'],                      nextRoles: ['VP Engineering','CTO'] },
  ]},
  { label: 'Data Science / AI', icon: '🤖', paths: [
    { role: 'Data Analyst',         level: 1, yearsExp: '0–2 yrs',  avgSalary: '₹4–8 LPA',       skills: ['Excel','SQL','Python','Tableau'],                            nextRoles: ['Data Scientist','BI Analyst'] },
    { role: 'Data Scientist',       level: 2, yearsExp: '2–5 yrs',  avgSalary: '₹10–22 LPA',     skills: ['ML','Python','Statistics','Pandas'],                         nextRoles: ['Senior Data Scientist','ML Engineer'] },
    { role: 'Senior Data Scientist',level: 3, yearsExp: '5–8 yrs',  avgSalary: '₹22–45 LPA',     skills: ['Deep Learning','MLOps','A/B Testing','Research'],            nextRoles: ['Principal Scientist','ML Lead'] },
    { role: 'ML Engineer',          level: 4, yearsExp: '5–9 yrs',  avgSalary: '₹30–65 LPA',     skills: ['LLMs','Kubernetes','Feature Stores','Model Deployment'],      nextRoles: ['Staff ML Engineer','Head of AI'] },
    { role: 'Head of AI / Data',    level: 5, yearsExp: '10+ yrs',  avgSalary: '₹60–1.5 Cr',     skills: ['Strategy','Team Leadership','AI Governance','Roadmapping'],   nextRoles: ['VP Data','CDO'] },
  ]},
  { label: 'Product Management', icon: '🗂️', paths: [
    { role: 'Associate PM',          level: 1, yearsExp: '0–2 yrs',  avgSalary: '₹5–10 LPA',      skills: ['User Research','JIRA','Agile','Documentation'],              nextRoles: ['Product Manager'] },
    { role: 'Product Manager',       level: 2, yearsExp: '2–5 yrs',  avgSalary: '₹12–25 LPA',     skills: ['Roadmapping','Analytics','SQL','Stakeholder Mgmt'],          nextRoles: ['Senior PM','Growth PM'] },
    { role: 'Senior PM',             level: 3, yearsExp: '5–8 yrs',  avgSalary: '₹25–50 LPA',     skills: ['OKRs','P&L','Leadership','GTM Strategy'],                   nextRoles: ['Principal PM','Group PM'] },
    { role: 'Group PM / Principal PM',level:4, yearsExp: '8–12 yrs', avgSalary: '₹50–90 LPA',     skills: ['Portfolio Mgmt','Team Building','Strategic Vision','Partnerships'], nextRoles: ['Director of Product'] },
    { role: 'VP / Director of Product',level:5,yearsExp: '12+ yrs',  avgSalary: '₹80 LPA–2 Cr',   skills: ['Executive Presence','M&A','Company Strategy','Board Communication'], nextRoles: ['CPO','CEO'] },
  ]},
  { label: 'Design / UX', icon: '🎨', paths: [
    { role: 'Junior Designer',       level: 1, yearsExp: '0–2 yrs',  avgSalary: '₹3–6 LPA',       skills: ['Figma','Sketch','Wireframing','Visual Design'],              nextRoles: ['UX Designer','Product Designer'] },
    { role: 'UX / Product Designer', level: 2, yearsExp: '2–5 yrs',  avgSalary: '₹6–16 LPA',      skills: ['User Research','Prototyping','Design Systems','Usability Testing'], nextRoles: ['Senior Designer','Lead Designer'] },
    { role: 'Senior Designer',       level: 3, yearsExp: '5–8 yrs',  avgSalary: '₹16–32 LPA',     skills: ['Design Strategy','Mentoring','Cross-functional Collab','DesignOps'], nextRoles: ['Design Lead','UX Manager'] },
    { role: 'Design Lead / Manager', level: 4, yearsExp: '8–12 yrs', avgSalary: '₹32–60 LPA',     skills: ['Team Management','Brand Strategy','Executive Stakeholders','Hiring'], nextRoles: ['Head of Design'] },
    { role: 'Head of Design / VP Design',level:5,yearsExp:'12+ yrs', avgSalary: '₹55 LPA–1.5 Cr', skills: ['Vision Setting','P&L','Design Culture','Company Narrative'],   nextRoles: ['CPO','CEO'] },
  ]},
  { label: 'Marketing / Growth', icon: '📈', paths: [
    { role: 'Marketing Executive',   level: 1, yearsExp: '0–2 yrs',  avgSalary: '₹3–6 LPA',       skills: ['Social Media','Copywriting','Email Marketing','SEO'],        nextRoles: ['Marketing Manager'] },
    { role: 'Marketing Manager',     level: 2, yearsExp: '2–5 yrs',  avgSalary: '₹7–15 LPA',      skills: ['Campaign Strategy','SEM','Analytics','CRM'],                 nextRoles: ['Senior Manager','Growth Manager'] },
    { role: 'Senior Marketing Manager',level:3,yearsExp: '5–8 yrs',  avgSalary: '₹15–30 LPA',     skills: ['Brand Strategy','Performance Mktg','P&L','Team Leadership'],  nextRoles: ['Head of Marketing','Growth Director'] },
    { role: 'Director of Marketing', level: 4, yearsExp: '8–12 yrs', avgSalary: '₹30–60 LPA',     skills: ['GTM Strategy','Investor Relations','Partnerships','OKRs'],    nextRoles: ['VP Marketing'] },
    { role: 'VP / CMO',              level: 5, yearsExp: '12+ yrs',  avgSalary: '₹60 LPA–2 Cr',   skills: ['Corporate Strategy','Board Communication','M&A','Cultural Vision'], nextRoles: ['CEO','Board Advisor'] },
  ]},
];
