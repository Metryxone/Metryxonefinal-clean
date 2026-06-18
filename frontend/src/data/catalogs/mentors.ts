export interface MentorEntry {
  id: string;
  name: string;
  role: string;
  company: string;
  exp: string;
  skills: string[];
  rating: number;
  sessions: number;
  match: number;
  avatar: string;
  tag: string;
}

export const MENTORS: MentorEntry[] = [
  { id:'m1', name:'Priya Krishnamurthy', role:'Senior Data Scientist',  company:'Infosys',   exp:'9 years',  skills:['Python','ML','SQL','Tableau'],                              rating:4.9, sessions:142, match:94, avatar:'PK', tag:'AI/ML Expert'  },
  { id:'m2', name:'Rahul Bajaj',         role:'Engineering Manager',    company:'Flipkart',  exp:'12 years', skills:['Leadership','System Design','Java','Agile'],               rating:4.8, sessions:98,  match:88, avatar:'RB', tag:'Leadership'    },
  { id:'m3', name:'Sneha Iyer',          role:'Product Manager',        company:'Meesho',    exp:'7 years',  skills:['Product Strategy','Analytics','Communication','Roadmapping'],rating:4.7, sessions:76, match:82, avatar:'SI', tag:'Product'       },
  { id:'m4', name:'Arjun Mehta',         role:'Full Stack Developer',   company:'Razorpay',  exp:'6 years',  skills:['React','Node.js','MongoDB','AWS'],                          rating:4.9, sessions:203, match:91, avatar:'AM', tag:'Full Stack'    },
  { id:'m5', name:'Divya Nair',          role:'HR Business Partner',    company:'Wipro',     exp:'8 years',  skills:['Talent Acquisition','Compensation','L&D','HRIS'],          rating:4.6, sessions:55,  match:79, avatar:'DN', tag:'HR/Recruitment'},
  { id:'m6', name:'Karan Sethi',         role:'DevOps Engineer',        company:'Atlassian', exp:'5 years',  skills:['Docker','Kubernetes','CI/CD','Terraform'],                  rating:4.8, sessions:87,  match:86, avatar:'KS', tag:'DevOps'        },
];
