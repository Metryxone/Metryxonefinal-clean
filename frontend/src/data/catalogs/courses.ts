export interface CourseRec {
  title: string;
  provider: string;
  duration: string;
  level: string;
  skill: string;
  url: string;
  tag: string;
}

export const COURSE_RECS: CourseRec[] = [
  { title: 'Python for Data Science & AI',           provider: 'Coursera',          duration: '8 weeks',  level: 'Intermediate', skill: 'Python',           url: '#', tag: 'In-Demand'    },
  { title: 'SQL Bootcamp: Zero to Hero',             provider: 'Udemy',             duration: '5 weeks',  level: 'Beginner',     skill: 'SQL',              url: '#', tag: 'Quick Win'    },
  { title: 'React — The Complete Guide',             provider: 'Udemy',             duration: '10 weeks', level: 'Intermediate', skill: 'React',            url: '#', tag: 'Trending'     },
  { title: 'Machine Learning Specialization',        provider: 'Coursera',          duration: '3 months', level: 'Advanced',     skill: 'Machine Learning', url: '#', tag: 'High Value'   },
  { title: 'Docker & Kubernetes Complete Guide',     provider: 'Udemy',             duration: '6 weeks',  level: 'Intermediate', skill: 'Docker',           url: '#', tag: 'DevOps'       },
  { title: 'Communication Skills for Professionals', provider: 'LinkedIn Learning', duration: '2 weeks',  level: 'Beginner',     skill: 'Communication',    url: '#', tag: 'Soft Skill'   },
  { title: 'Data Analysis with Pandas & NumPy',     provider: 'DataCamp',          duration: '4 weeks',  level: 'Intermediate', skill: 'Data Analysis',    url: '#', tag: 'Analytics'    },
  { title: 'Leadership Fundamentals',               provider: 'edX',               duration: '6 weeks',  level: 'Beginner',     skill: 'Leadership',       url: '#', tag: 'Career Growth' },
  { title: 'AWS Certified Cloud Practitioner',      provider: 'AWS Training',      duration: '6 weeks',  level: 'Beginner',     skill: 'Cloud',            url: '#', tag: 'Certification' },
  { title: 'Agile & Scrum Masterclass',             provider: 'Udemy',             duration: '3 weeks',  level: 'Beginner',     skill: 'Agile',            url: '#', tag: 'Project Mgmt' },
];

export const COURSE_LEVELS   = ['Beginner', 'Intermediate', 'Advanced'] as const;
export const COURSE_TAGS     = Array.from(new Set(COURSE_RECS.map(c => c.tag)));
export const COURSE_SKILLS   = Array.from(new Set(COURSE_RECS.map(c => c.skill)));
