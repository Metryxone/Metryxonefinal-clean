import type { Express } from 'express';

const INDUSTRY_SKILLS: Record<string, number> = {
  'JavaScript': 82, 'TypeScript': 71, 'Python': 78, 'React': 74, 'Node.js': 65,
  'SQL': 69, 'Docker': 62, 'AWS': 58, 'Kubernetes': 45, 'Git': 88,
  'Machine Learning': 42, 'Data Analysis': 57, 'Excel': 73, 'Communication': 91,
  'Leadership': 68, 'Problem Solving': 87, 'Agile': 72, 'REST APIs': 63,
  'MongoDB': 49, 'PostgreSQL': 52, 'Redis': 41, 'GraphQL': 38,
  'CI/CD': 55, 'Terraform': 32, 'Figma': 44, 'Product Management': 39,
  'System Design': 47, 'Microservices': 43, 'Power BI': 46, 'Tableau': 35,
};

const MARKET_SIGNALS = [
  { role:'Software Engineer',     demandScore:88, automationRisk:22, growth36mo:24, avgSalary:'₹8–35 LPA',  trend:'rising'  },
  { role:'Data Scientist',        demandScore:84, automationRisk:18, growth36mo:32, avgSalary:'₹10–40 LPA', trend:'rising'  },
  { role:'ML Engineer',           demandScore:90, automationRisk:15, growth36mo:38, avgSalary:'₹15–60 LPA', trend:'hot'     },
  { role:'Product Manager',       demandScore:76, automationRisk:25, growth36mo:20, avgSalary:'₹12–50 LPA', trend:'stable'  },
  { role:'DevOps Engineer',       demandScore:82, automationRisk:20, growth36mo:28, avgSalary:'₹10–38 LPA', trend:'rising'  },
  { role:'UX Designer',           demandScore:70, automationRisk:30, growth36mo:18, avgSalary:'₹6–28 LPA',  trend:'stable'  },
  { role:'Data Analyst',          demandScore:75, automationRisk:35, growth36mo:16, avgSalary:'₹5–20 LPA',  trend:'stable'  },
  { role:'Cloud Architect',       demandScore:86, automationRisk:16, growth36mo:30, avgSalary:'₹20–80 LPA', trend:'hot'     },
  { role:'Cybersecurity Engineer',demandScore:89, automationRisk:14, growth36mo:35, avgSalary:'₹12–55 LPA', trend:'hot'     },
  { role:'Engineering Manager',   demandScore:72, automationRisk:20, growth36mo:18, avgSalary:'₹25–90 LPA', trend:'stable'  },
  { role:'AI Engineer',           demandScore:93, automationRisk:12, growth36mo:45, avgSalary:'₹18–75 LPA', trend:'hot'     },
  { role:'Blockchain Developer',  demandScore:52, automationRisk:28, growth36mo:15, avgSalary:'₹12–50 LPA', trend:'cooling' },
  { role:'Marketing Manager',     demandScore:65, automationRisk:42, growth36mo:12, avgSalary:'₹7–25 LPA',  trend:'flat'    },
  { role:'HR Business Partner',   demandScore:60, automationRisk:38, growth36mo:10, avgSalary:'₹6–20 LPA',  trend:'flat'    },
  { role:'Finance Analyst',       demandScore:68, automationRisk:48, growth36mo:8,  avgSalary:'₹6–25 LPA',  trend:'flat'    },
];

function skillBenchmark(profile: Record<string, unknown>) {
  const userTech = ((profile?.skills as Record<string,string[]>)?.technical ?? []).map(s => s.toLowerCase());
  const userSoft = ((profile?.skills as Record<string,string[]>)?.soft ?? []).map(s => s.toLowerCase());
  const userAll  = new Set([...userTech, ...userSoft]);

  return Object.entries(INDUSTRY_SKILLS).map(([skill, industryPct]) => ({
    skill,
    industryPct,
    userHas:       userAll.has(skill.toLowerCase()),
    aboveBenchmark:userAll.has(skill.toLowerCase()),
    gap:           userAll.has(skill.toLowerCase()) ? 0 : industryPct,
  })).sort((a, b) => b.industryPct - a.industryPct);
}

export function registerCareerBenchmarkRoutes(app: Express): void {
  app.get('/api/career/benchmark/market', (_req, res) => {
    const avgDemand  = Math.round(MARKET_SIGNALS.reduce((s, r) => s + r.demandScore, 0) / MARKET_SIGNALS.length);
    const avgGrowth  = Math.round(MARKET_SIGNALS.reduce((s, r) => s + r.growth36mo, 0) / MARKET_SIGNALS.length);
    res.json({
      success: true,
      roles: MARKET_SIGNALS,
      summary: { avgDemand, avgGrowth, hotRoles: MARKET_SIGNALS.filter(r => r.trend === 'hot').length },
    });
  });

  app.post('/api/career/benchmark/skills', (req, res, next) => {
    try {
      const profile = req.body?.profile as Record<string, unknown> | undefined;
      if (!profile) return res.status(400).json({ error: 'profile is required' });

      const comparisons   = skillBenchmark(profile);
      const aboveCount    = comparisons.filter(c => c.aboveBenchmark).length;
      const coveragePct   = Math.round((aboveCount / comparisons.length) * 100);
      const opportunities = comparisons.filter(c => !c.userHas).sort((a, b) => b.gap - a.gap).slice(0, 8);

      return res.json({ success: true, comparisons, aboveCount, coveragePct, topOpportunities: opportunities });
    } catch (e) { next(e); }
  });

  app.get('/api/career/benchmark/demand/:role', (req, res) => {
    const role = MARKET_SIGNALS.find(r => r.role.toLowerCase().includes(req.params.role.toLowerCase()));
    if (!role) return res.status(404).json({ error: 'Role not found' });
    res.json({ success: true, ...role });
  });

  app.get('/api/career/benchmark/skill-list', (_req, res) => {
    res.json({ success: true, skills: Object.keys(INDUSTRY_SKILLS) });
  });
}
