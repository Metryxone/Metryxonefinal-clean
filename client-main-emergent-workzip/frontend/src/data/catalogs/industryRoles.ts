// AUTO-GENERATED industry → department → sub-department → role taxonomy.
// Source: attached_assets/industrial_breakup_*.xlsx (extended as more industries are added).

export interface RoleNode { title: string; industry: string; department: string; subDepartment: string; }
export interface SubDepartment { name: string; roles: string[]; }
export interface Department { name: string; subDepartments: SubDepartment[]; }
export interface IndustryTaxonomy { name: string; departments: Department[]; }

export const INDUSTRY_TAXONOMY: IndustryTaxonomy[] = [
  {
    name: "Information Technology (IT / SaaS / AI)",
    departments: [
      {
        name: "Executive Management",
        subDepartments: [
          { name: "Strategy & Leadership", roles: ["Chief Executive Officer (CEO)","Founder","Co-Founder","Managing Director","President","Chief Technology Officer (CTO)","Chief Information Officer (CIO)","Chief Operating Officer (COO)","Chief Product Officer (CPO)","Chief Revenue Officer (CRO)","Chief Data Officer (CDO)","VP Engineering","VP Product","VP Technology","VP Operations","Director of Engineering","Director of Technology","Director of Product","Strategy Director","Corporate Strategy Manager","Transformation Manager","Business Operations Manager","Program Director","PMO Head","Enterprise Architect","Solutions Architect","Innovation Head","Executive Assistant","Strategy Coordinator","Operations Coordinator"] },
        ],
      },
      {
        name: "Human Resources",
        subDepartments: [
          { name: "Talent Acquisition", roles: ["Recruiter","Technical Recruiter","IT Recruiter","Executive Recruiter","Campus Recruiter","HR Business Partner (HRBP)","Talent Sourcer","Talent Acquisition Specialist","Talent Acquisition Manager","People Operations Specialist","HR Operations Executive","Employer Branding Specialist","Compensation & Benefits Analyst","HR Analyst","HR Assistant","Recruitment Coordinator","Office Admin","Onboarding Coordinator","Payroll Coordinator"] },
          { name: "Learning & Development", roles: ["L&D Specialist","Organizational Psychologist","Training Manager","Learning Experience Designer","Instructional Designer","Leadership Coach","Talent Development Manager","Organizational Development Consultant","Employee Engagement Specialist","Training Coordinator"] },
        ],
      },
      {
        name: "Finance",
        subDepartments: [
          { name: "FP&A", roles: ["Financial Analyst","Treasury Analyst","FP&A Manager","Finance Business Partner","Investment Analyst","Cost Analyst","Revenue Analyst","Budget Analyst","Commercial Finance Analyst","Accounts Executive"] },
          { name: "Accounting", roles: ["Chartered Accountant","Auditor","Payroll Specialist","Tax Consultant","Finance Controller","Accounts Payable Specialist","Accounts Receivable Specialist","GST Specialist","Compliance Accountant","Billing Executive","Accounts Assistant"] },
        ],
      },
      {
        name: "Engineering",
        subDepartments: [
          { name: "Frontend", roles: ["Frontend Engineer","Senior Frontend Engineer","React Developer","Angular Developer","Vue.js Developer","UI Engineer","Web Developer","Accessibility Engineer","JavaScript Developer","TypeScript Developer","Junior Developer","Frontend Intern"] },
          { name: "Backend", roles: ["Backend Engineer","Senior Backend Engineer","API Engineer","Node.js Developer","Java Developer","Python Developer","Golang Developer",".NET Developer"] },
        ],
      },
    ],
  },
];

// Flat role list with full taxonomy context (used by predictive search).
export const ALL_ROLES: RoleNode[] = INDUSTRY_TAXONOMY.flatMap(i =>
  i.departments.flatMap(d =>
    d.subDepartments.flatMap(s =>
      s.roles.map(r => ({ title: r, industry: i.name, department: d.name, subDepartment: s.name }))
    )
  )
);

export const ALL_INDUSTRIES = INDUSTRY_TAXONOMY.map(i => i.name);
export const ALL_DEPARTMENTS = Array.from(new Set(ALL_ROLES.map(r => r.department))).sort();
