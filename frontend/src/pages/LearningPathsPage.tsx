import { useState, useRef, useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Screen } from '../App';
import {
  Target, BookOpen, GraduationCap, Briefcase, Brain, Star, ChevronRight,
  ChevronDown, Clock, MapPin, Award, Microscope, Scale, Shield, Code,
  Palette, TrendingUp, CheckCircle2, Lock, ArrowRight, Sparkles,
  BarChart3, Lightbulb, Rocket, Users, Heart, Zap, Globe2,
  Building2, Stethoscope, Gavel, Cpu, FlaskConical, PenTool, Swords,
  Calculator, Atom, TestTubes, FileText, Play, ChevronLeft, X
} from 'lucide-react';

const BRAND = { primary: '#344E86', accent: '#4ECDC4' };

interface CareerPath {
  id: string;
  title: string;
  icon: typeof Target;
  color: string;
  category: string;
  description: string;
  averageSalary: string;
  demandLevel: 'High' | 'Very High' | 'Growing' | 'Moderate';
  topExams: string[];
  keySubjects: string[];
  duration: string;
  milestones: Milestone[];
  skills: Skill[];
  topInstitutions: string[];
  relatedPaths: string[];
}

interface Milestone {
  id: string;
  title: string;
  description: string;
  grade: string;
  type: 'academic' | 'exam' | 'skill' | 'certification';
  status: 'locked' | 'current' | 'upcoming' | 'completed';
  items: string[];
}

interface Skill {
  name: string;
  category: 'core' | 'soft' | 'technical';
  importance: 'critical' | 'important' | 'helpful';
  currentLevel?: number;
}

const CAREER_CATEGORIES = [
  { id: 'all', label: 'All Paths', icon: Globe2 },
  { id: 'stem', label: 'STEM', icon: Atom },
  { id: 'medical', label: 'Medical', icon: Stethoscope },
  { id: 'business', label: 'Business', icon: Briefcase },
  { id: 'creative', label: 'Creative', icon: Palette },
  { id: 'government', label: 'Government', icon: Building2 },
  { id: 'technology', label: 'Technology', icon: Cpu },
];

const CAREER_PATHS: CareerPath[] = [
  {
    id: 'engineering',
    title: 'Engineering (IIT/NIT)',
    icon: Calculator,
    color: '#344E86',
    category: 'stem',
    description: 'Pursue B.Tech/B.E. from premier institutes through JEE Main & Advanced. Strong foundation in Mathematics, Physics, and problem-solving.',
    averageSalary: '₹8-25 LPA',
    demandLevel: 'Very High',
    topExams: ['JEE Main', 'JEE Advanced', 'BITSAT', 'VITEEE', 'WBJEE'],
    keySubjects: ['Mathematics', 'Physics', 'Chemistry'],
    duration: 'Class 8-12 + 4 years B.Tech',
    topInstitutions: ['IIT Bombay', 'IIT Delhi', 'IIT Madras', 'NIT Trichy', 'BITS Pilani'],
    relatedPaths: ['data-science', 'research'],
    milestones: [
      { id: 'e1', title: 'Foundation Building', description: 'Build strong basics in Mathematics and Science', grade: 'Class 8-9', type: 'academic', status: 'current', items: ['Master algebra, geometry, trigonometry basics', 'Understand Newtonian physics concepts', 'Develop logical reasoning skills', 'Start Olympiad preparation (NSO, IMO)'] },
      { id: 'e2', title: 'Pre-Foundation', description: 'Start JEE-oriented preparation alongside school curriculum', grade: 'Class 10', type: 'academic', status: 'upcoming', items: ['Complete NCERT thoroughly for all subjects', 'Begin JEE foundation modules', 'Practice board exam pattern questions', 'Score 90%+ in board exams'] },
      { id: 'e3', title: 'JEE Preparation Phase 1', description: 'Intensive JEE Main & Advanced preparation begins', grade: 'Class 11', type: 'exam', status: 'upcoming', items: ['Join reputed coaching/online program', 'Complete Class 11 syllabus for PCM', 'Practice previous year JEE questions', 'Take weekly mock tests', 'Focus on NCERT + reference books (HC Verma, RD Sharma)'] },
      { id: 'e4', title: 'JEE Final Push', description: 'Complete syllabus revision and intensive mock testing', grade: 'Class 12', type: 'exam', status: 'locked', items: ['Complete full syllabus revision', 'Attempt 50+ full-length mock tests', 'Board exam preparation (Jan-Feb)', 'JEE Main (Jan & Apr attempts)', 'JEE Advanced (May-Jun)'] },
      { id: 'e5', title: 'B.Tech Journey', description: 'Complete engineering degree with specialization', grade: '4 Years', type: 'certification', status: 'locked', items: ['Choose specialization (CS, EE, ME, etc.)', 'Summer internships at tech companies', 'Build projects and portfolio', 'Campus placements in final year'] },
    ],
    skills: [
      { name: 'Mathematical Reasoning', category: 'core', importance: 'critical' },
      { name: 'Physics Problem Solving', category: 'core', importance: 'critical' },
      { name: 'Chemical Analysis', category: 'core', importance: 'important' },
      { name: 'Logical Thinking', category: 'technical', importance: 'critical' },
      { name: 'Time Management', category: 'soft', importance: 'important' },
      { name: 'Coding Basics', category: 'technical', importance: 'helpful' },
      { name: 'Stress Management', category: 'soft', importance: 'important' },
    ],
  },
  {
    id: 'medical',
    title: 'Medical (NEET)',
    icon: Stethoscope,
    color: '#dc2626',
    category: 'medical',
    description: 'Become a doctor through NEET exam. Requires deep understanding of Biology, Chemistry, and Physics with years of dedicated preparation.',
    averageSalary: '₹10-50 LPA',
    demandLevel: 'Very High',
    topExams: ['NEET UG', 'AIIMS (via NEET)', 'JIPMER (via NEET)'],
    keySubjects: ['Biology', 'Chemistry', 'Physics'],
    duration: 'Class 9-12 + 5.5 years MBBS',
    topInstitutions: ['AIIMS Delhi', 'CMC Vellore', 'JIPMER', 'MAMC Delhi', 'KEM Mumbai'],
    relatedPaths: ['research', 'pharmacy'],
    milestones: [
      { id: 'm1', title: 'Biology Foundation', description: 'Build strong fundamentals in Biology and Science', grade: 'Class 9-10', type: 'academic', status: 'current', items: ['Master NCERT Biology thoroughly', 'Understand human anatomy basics', 'Strong foundation in organic chemistry', 'Practice Biology diagrams regularly'] },
      { id: 'm2', title: 'NEET Preparation Begins', description: 'Start focused NEET preparation with coaching', grade: 'Class 11', type: 'exam', status: 'upcoming', items: ['Complete Biology (Botany + Zoology) for Class 11', 'Physical & Inorganic Chemistry', 'Mechanics & Optics in Physics', 'NCERT line-by-line reading practice', 'Weekly chapter-wise tests'] },
      { id: 'm3', title: 'NEET Final Year', description: 'Complete syllabus and intensive testing phase', grade: 'Class 12', type: 'exam', status: 'locked', items: ['Complete full NEET syllabus', 'Solve 10,000+ MCQs across subjects', 'Full-length mock tests (50+)', 'Previous 10 years NEET papers', 'Board exam + NEET balance'] },
      { id: 'm4', title: 'MBBS Journey', description: 'Complete medical degree and internship', grade: '5.5 Years', type: 'certification', status: 'locked', items: ['Pre-clinical studies (Anatomy, Physiology, Biochemistry)', 'Clinical rotations', 'Hospital internship (1 year)', 'Choose specialization path (MD/MS)'] },
    ],
    skills: [
      { name: 'Biology Mastery', category: 'core', importance: 'critical' },
      { name: 'Chemical Concepts', category: 'core', importance: 'critical' },
      { name: 'Physics Fundamentals', category: 'core', importance: 'important' },
      { name: 'Memorization Techniques', category: 'technical', importance: 'critical' },
      { name: 'Empathy & Communication', category: 'soft', importance: 'important' },
      { name: 'Attention to Detail', category: 'soft', importance: 'critical' },
    ],
  },
  {
    id: 'civil-services',
    title: 'Civil Services (UPSC)',
    icon: Building2,
    color: '#7c3aed',
    category: 'government',
    description: 'Join the prestigious Indian Administrative Service (IAS), IPS, IFS through UPSC examination. Requires comprehensive knowledge and analytical skills.',
    averageSalary: '₹12-30 LPA + Benefits',
    demandLevel: 'High',
    topExams: ['UPSC CSE (Prelims)', 'UPSC CSE (Mains)', 'UPSC Interview'],
    keySubjects: ['General Studies', 'Current Affairs', 'Optional Subject', 'Essay Writing'],
    duration: 'Graduation + 1-3 years preparation',
    topInstitutions: ['LBSNAA Mussoorie', 'Delhi University', 'JNU', 'St. Stephens'],
    relatedPaths: ['law', 'public-policy'],
    milestones: [
      { id: 'c1', title: 'Academic Foundation', description: 'Build broad knowledge base across subjects', grade: 'Class 9-12', type: 'academic', status: 'current', items: ['Develop reading habit (newspapers, magazines)', 'Study History, Geography, Polity fundamentals', 'Strong English writing skills', 'Score well in board exams'] },
      { id: 'c2', title: 'Graduation', description: 'Complete any graduation degree while building UPSC foundation', grade: '3-4 Years', type: 'academic', status: 'upcoming', items: ['Choose graduation aligned with optional subject', 'Start reading The Hindu / Indian Express daily', 'Study NCERT books (Class 6-12) for all subjects', 'Join a UPSC foundation course', 'Participate in debates and essay competitions'] },
      { id: 'c3', title: 'UPSC Prelims', description: 'Clear the first screening stage', grade: 'Year 1-2', type: 'exam', status: 'locked', items: ['Master General Studies syllabus', 'Current affairs compilation (1 year)', 'CSAT (aptitude) preparation', 'Solve 5000+ MCQs', 'Full mock test series'] },
      { id: 'c4', title: 'UPSC Mains + Interview', description: 'Clear descriptive exam and personality test', grade: 'Year 2-3', type: 'exam', status: 'locked', items: ['Answer writing practice (daily)', 'Optional subject mastery', 'Ethics case studies', 'Essay writing practice', 'Mock interviews with panels'] },
    ],
    skills: [
      { name: 'Analytical Thinking', category: 'core', importance: 'critical' },
      { name: 'Current Affairs Awareness', category: 'core', importance: 'critical' },
      { name: 'Essay & Answer Writing', category: 'technical', importance: 'critical' },
      { name: 'General Knowledge', category: 'core', importance: 'important' },
      { name: 'Communication Skills', category: 'soft', importance: 'critical' },
      { name: 'Leadership', category: 'soft', importance: 'important' },
    ],
  },
  {
    id: 'data-science',
    title: 'Data Science & AI',
    icon: Cpu,
    color: '#059669',
    category: 'technology',
    description: 'Enter the fastest-growing tech field combining statistics, programming, and domain expertise. Build AI models that solve real-world problems.',
    averageSalary: '₹12-40 LPA',
    demandLevel: 'Very High',
    topExams: ['JEE Main/Advanced', 'GATE CS', 'GRE (for MS abroad)'],
    keySubjects: ['Mathematics', 'Statistics', 'Computer Science', 'Python Programming'],
    duration: 'Class 10-12 + 4 years B.Tech + Optional MS',
    topInstitutions: ['IIT Bombay', 'IISc Bangalore', 'IIIT Hyderabad', 'CMI Chennai', 'ISI Kolkata'],
    relatedPaths: ['engineering', 'research'],
    milestones: [
      { id: 'ds1', title: 'Mathematical Foundation', description: 'Build strong math and logical reasoning skills', grade: 'Class 9-10', type: 'academic', status: 'current', items: ['Excel in Mathematics and Statistics', 'Learn basics of coding (Python/Scratch)', 'Participate in math Olympiads', 'Develop logical puzzle-solving skills'] },
      { id: 'ds2', title: 'Programming & JEE Prep', description: 'Start coding and prepare for engineering entrance', grade: 'Class 11-12', type: 'academic', status: 'upcoming', items: ['JEE preparation (for CSE/IT branch)', 'Learn Python programming', 'Introduction to data structures', 'Statistics and probability concepts', 'Build small projects (calculators, games)'] },
      { id: 'ds3', title: 'B.Tech in CS/AI', description: 'Core computer science education with AI specialization', grade: '4 Years', type: 'certification', status: 'locked', items: ['Data Structures & Algorithms mastery', 'Machine Learning fundamentals', 'Deep Learning & Neural Networks', 'Big Data technologies (Spark, Hadoop)', 'Kaggle competitions and research papers', 'Industry internships at tech companies'] },
      { id: 'ds4', title: 'Career Launch', description: 'Enter industry or pursue higher studies', grade: 'Post-Grad', type: 'certification', status: 'locked', items: ['Data Scientist/ML Engineer roles', 'Optional: MS in AI/ML from top universities', 'Build portfolio on GitHub', 'Contribute to open-source AI projects'] },
    ],
    skills: [
      { name: 'Python Programming', category: 'technical', importance: 'critical' },
      { name: 'Statistics & Probability', category: 'core', importance: 'critical' },
      { name: 'Machine Learning', category: 'technical', importance: 'critical' },
      { name: 'Linear Algebra', category: 'core', importance: 'important' },
      { name: 'Data Visualization', category: 'technical', importance: 'important' },
      { name: 'Problem Solving', category: 'soft', importance: 'critical' },
    ],
  },
  {
    id: 'law',
    title: 'Law (CLAT/LSAT)',
    icon: Gavel,
    color: '#b45309',
    category: 'government',
    description: 'Pursue a career in law through National Law Universities. Become a lawyer, judge, or legal consultant with strong analytical and communication skills.',
    averageSalary: '₹8-35 LPA',
    demandLevel: 'High',
    topExams: ['CLAT', 'AILET', 'LSAT India', 'MH CET Law'],
    keySubjects: ['Legal Aptitude', 'English', 'Logical Reasoning', 'General Knowledge', 'Mathematics'],
    duration: 'Class 10-12 + 5 years BA LLB',
    topInstitutions: ['NLSIU Bangalore', 'NALSAR Hyderabad', 'NLU Delhi', 'NUJS Kolkata', 'GNLU Gandhinagar'],
    relatedPaths: ['civil-services'],
    milestones: [
      { id: 'l1', title: 'Language & Logic Foundation', description: 'Develop strong English and reasoning skills', grade: 'Class 9-10', type: 'academic', status: 'current', items: ['Extensive reading (novels, newspapers, editorials)', 'Grammar and vocabulary building', 'Logical reasoning practice', 'Develop debating skills', 'Study Indian Constitution basics'] },
      { id: 'l2', title: 'CLAT Preparation', description: 'Focused preparation for law entrance exams', grade: 'Class 11-12', type: 'exam', status: 'upcoming', items: ['CLAT-specific coaching/self-study', 'Legal awareness and aptitude', 'Current affairs (last 1 year)', 'Reading comprehension mastery', 'Mock tests (CLAT, AILET, LSAT)'] },
      { id: 'l3', title: 'BA LLB Journey', description: 'Complete integrated law degree', grade: '5 Years', type: 'certification', status: 'locked', items: ['Constitutional Law, Criminal Law, Contracts', 'Moot court competitions', 'Legal internships at law firms/courts', 'Specialize (Corporate, Criminal, IP, International)', 'Bar Council registration'] },
    ],
    skills: [
      { name: 'Legal Reasoning', category: 'core', importance: 'critical' },
      { name: 'English Proficiency', category: 'core', importance: 'critical' },
      { name: 'Logical Analysis', category: 'technical', importance: 'critical' },
      { name: 'Public Speaking', category: 'soft', importance: 'important' },
      { name: 'Research Skills', category: 'technical', importance: 'important' },
      { name: 'Argumentation', category: 'soft', importance: 'critical' },
    ],
  },
  {
    id: 'creative-design',
    title: 'Design & Creative Arts',
    icon: Palette,
    color: '#ec4899',
    category: 'creative',
    description: 'Pursue design thinking, UX/UI design, graphic design, animation, or fine arts. Combine creativity with technology for innovative career paths.',
    averageSalary: '₹6-25 LPA',
    demandLevel: 'Growing',
    topExams: ['NID DAT', 'UCEED', 'NIFT', 'CEED'],
    keySubjects: ['Design Thinking', 'Art & Aesthetics', 'Visual Communication', 'Digital Tools'],
    duration: 'Class 10-12 + 4 years B.Des',
    topInstitutions: ['NID Ahmedabad', 'IDC IIT Bombay', 'NIFT Delhi', 'Srishti Bangalore', 'MIT ID Pune'],
    relatedPaths: ['data-science'],
    milestones: [
      { id: 'cr1', title: 'Creative Exploration', description: 'Discover and develop creative abilities', grade: 'Class 9-10', type: 'academic', status: 'current', items: ['Regular sketching and drawing practice', 'Learn basics of digital design tools', 'Study color theory and composition', 'Build a personal portfolio', 'Visit art galleries and design exhibitions'] },
      { id: 'cr2', title: 'Design Entrance Prep', description: 'Prepare for design school entrance exams', grade: 'Class 11-12', type: 'exam', status: 'upcoming', items: ['NID/UCEED/NIFT entrance preparation', 'Design aptitude development', 'Situational drawing and sketching', 'Material handling and 3D visualization', 'Design portfolio building'] },
      { id: 'cr3', title: 'Design Degree', description: 'Complete B.Des with specialization', grade: '4 Years', type: 'certification', status: 'locked', items: ['UX/UI Design or Product Design specialization', 'Industry projects and internships', 'Learn Figma, Adobe Suite, Blender', 'Build professional portfolio', 'Freelance and real-world projects'] },
    ],
    skills: [
      { name: 'Visual Thinking', category: 'core', importance: 'critical' },
      { name: 'Design Tools (Figma, Adobe)', category: 'technical', importance: 'critical' },
      { name: 'Sketching & Drawing', category: 'core', importance: 'important' },
      { name: 'User Research', category: 'technical', importance: 'important' },
      { name: 'Creativity', category: 'soft', importance: 'critical' },
      { name: 'Presentation Skills', category: 'soft', importance: 'important' },
    ],
  },
  {
    id: 'business',
    title: 'Business & Management',
    icon: Briefcase,
    color: '#0891b2',
    category: 'business',
    description: 'Build a career in business management, entrepreneurship, or finance. Path through top B-schools after graduation via CAT/GMAT entrance exams.',
    averageSalary: '₹15-50 LPA',
    demandLevel: 'High',
    topExams: ['CAT', 'XAT', 'GMAT', 'SNAP', 'NMAT'],
    keySubjects: ['Mathematics', 'English', 'Economics', 'Business Studies'],
    duration: 'Class 10-12 + 3 years Graduation + 2 years MBA',
    topInstitutions: ['IIM Ahmedabad', 'IIM Bangalore', 'IIM Calcutta', 'ISB Hyderabad', 'XLRI Jamshedpur'],
    relatedPaths: ['data-science', 'law'],
    milestones: [
      { id: 'b1', title: 'Aptitude Building', description: 'Develop quantitative and verbal aptitude', grade: 'Class 9-12', type: 'academic', status: 'current', items: ['Excel in Mathematics and English', 'Develop reading and comprehension skills', 'Learn basics of economics and accounting', 'Participate in business quizzes', 'Start following business news'] },
      { id: 'b2', title: 'Graduation', description: 'Complete any undergraduate degree (B.Com, BBA, B.Tech, BA)', grade: '3-4 Years', type: 'academic', status: 'upcoming', items: ['Choose graduation stream (Commerce, Engineering, or Arts)', 'Start CAT preparation in final year', 'Build work experience through internships', 'Develop leadership through extra-curriculars', 'Quantitative aptitude and DILR practice'] },
      { id: 'b3', title: 'CAT & MBA Admission', description: 'Crack management entrance and secure IIM seat', grade: 'Final Year + 1', type: 'exam', status: 'locked', items: ['Intensive CAT preparation (6-8 months)', 'Mock test series (100+ tests)', 'WAT/GD/PI preparation', 'Apply to top 20 B-schools', 'Work experience preferred (0-3 years)'] },
      { id: 'b4', title: 'MBA Journey', description: 'Complete MBA with specialization', grade: '2 Years', type: 'certification', status: 'locked', items: ['Marketing, Finance, Operations, or Strategy', 'Summer internship at Fortune 500', 'Case study competitions', 'Leadership roles in campus clubs', 'Final placement (₹20-50 LPA average at IIMs)'] },
    ],
    skills: [
      { name: 'Quantitative Aptitude', category: 'core', importance: 'critical' },
      { name: 'Verbal Ability', category: 'core', importance: 'critical' },
      { name: 'Data Interpretation', category: 'technical', importance: 'important' },
      { name: 'Financial Literacy', category: 'technical', importance: 'important' },
      { name: 'Leadership', category: 'soft', importance: 'critical' },
      { name: 'Communication', category: 'soft', importance: 'important' },
    ],
  },
  {
    id: 'defence',
    title: 'Defence Forces',
    icon: Shield,
    color: '#166534',
    category: 'government',
    description: 'Serve the nation through Indian Army, Navy, or Air Force. Multiple entry paths through NDA, CDS, AFCAT with emphasis on physical fitness and leadership.',
    averageSalary: '₹8-20 LPA + Benefits',
    demandLevel: 'Moderate',
    topExams: ['NDA', 'CDS', 'AFCAT', 'SSB Interview'],
    keySubjects: ['Mathematics', 'General Knowledge', 'English', 'Physical Fitness'],
    duration: 'Class 10-12 + 3 years NDA/CDS training',
    topInstitutions: ['NDA Pune', 'IMA Dehradun', 'AFA Dundigal', 'INA Ezhimala', 'OTA Chennai'],
    relatedPaths: ['civil-services'],
    milestones: [
      { id: 'd1', title: 'Physical & Academic Base', description: 'Build fitness foundation and academic strength', grade: 'Class 9-10', type: 'academic', status: 'current', items: ['Regular physical training (running, swimming, sports)', 'Strong in Mathematics and English', 'Develop leadership qualities', 'NCC cadet enrollment', 'General knowledge building'] },
      { id: 'd2', title: 'NDA Preparation', description: 'Prepare for National Defence Academy entrance after Class 12', grade: 'Class 11-12', type: 'exam', status: 'upcoming', items: ['NDA written exam preparation (Math + GAT)', 'Physical fitness to SSB standards', 'SSB interview preparation (5-day process)', 'Board exam alongside NDA prep', 'Group discussion and leadership tasks practice'] },
      { id: 'd3', title: 'NDA/IMA Training', description: 'Intensive military training and education', grade: '3 Years', type: 'certification', status: 'locked', items: ['Physical training and drills', 'Military tactics and strategy', 'Weapon training', 'Leadership development', 'Graduation degree alongside training'] },
    ],
    skills: [
      { name: 'Physical Fitness', category: 'core', importance: 'critical' },
      { name: 'Leadership', category: 'soft', importance: 'critical' },
      { name: 'Mathematical Ability', category: 'core', importance: 'important' },
      { name: 'Team Work', category: 'soft', importance: 'critical' },
      { name: 'Discipline & Endurance', category: 'soft', importance: 'critical' },
      { name: 'Decision Making', category: 'technical', importance: 'important' },
    ],
  },
  {
    id: 'research',
    title: 'Research & Academia',
    icon: FlaskConical,
    color: '#6d28d9',
    category: 'stem',
    description: 'Pursue pure science research at IISc, IISERs, or global universities. Contribute to cutting-edge discoveries in physics, chemistry, biology, or mathematics.',
    averageSalary: '₹8-25 LPA',
    demandLevel: 'Growing',
    topExams: ['IAT (IISER)', 'KVPY', 'NEST', 'JEE Advanced', 'GATE', 'CSIR NET'],
    keySubjects: ['Physics', 'Chemistry', 'Biology', 'Mathematics'],
    duration: 'Class 10-12 + 5 years BS-MS + PhD',
    topInstitutions: ['IISc Bangalore', 'IISER Pune', 'TIFR Mumbai', 'HRI Allahabad', 'CMI Chennai'],
    relatedPaths: ['engineering', 'data-science'],
    milestones: [
      { id: 'r1', title: 'Science Exploration', description: 'Develop deep curiosity and scientific thinking', grade: 'Class 9-10', type: 'academic', status: 'current', items: ['Excel in all science subjects', 'Participate in Science Olympiads (NSO, INAO)', 'Build science projects for exhibitions', 'Read popular science books', 'Develop experimentation skills'] },
      { id: 'r2', title: 'Competitive Science Exams', description: 'Prepare for research-oriented entrance exams', grade: 'Class 11-12', type: 'exam', status: 'upcoming', items: ['KVPY/INSPIRE scholarship preparation', 'IAT (IISER) entrance exam', 'JEE Advanced for IISc', 'Science olympiad participation (national/international)', 'Research project under school guidance'] },
      { id: 'r3', title: 'BS-MS Integrated Program', description: 'Deep dive into pure science with research component', grade: '5 Years', type: 'certification', status: 'locked', items: ['Core subject specialization', 'Summer research internships', 'Master\'s thesis project', 'Publish research paper', 'Apply for PhD (India/abroad)'] },
    ],
    skills: [
      { name: 'Scientific Methodology', category: 'core', importance: 'critical' },
      { name: 'Critical Thinking', category: 'core', importance: 'critical' },
      { name: 'Research Writing', category: 'technical', importance: 'important' },
      { name: 'Data Analysis', category: 'technical', importance: 'important' },
      { name: 'Curiosity & Perseverance', category: 'soft', importance: 'critical' },
      { name: 'Presentation Skills', category: 'soft', importance: 'important' },
    ],
  },
];

const GRADE_OPTIONS = [
  'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
  'Class 11', 'Class 12', 'Graduation', 'Post-Graduation',
];

const DEMAND_COLORS: Record<string, { bg: string; text: string }> = {
  'Very High': { bg: 'rgba(5, 150, 105, 0.12)', text: '#059669' },
  'High': { bg: 'rgba(52, 78, 134, 0.12)', text: '#344E86' },
  'Growing': { bg: 'rgba(217, 119, 6, 0.12)', text: '#d97706' },
  'Moderate': { bg: 'rgba(107, 114, 128, 0.12)', text: '#6b7280' },
};

const IMPORTANCE_CONFIG: Record<string, { color: string; label: string }> = {
  critical: { color: '#dc2626', label: 'Must-Have' },
  important: { color: '#d97706', label: 'Important' },
  helpful: { color: '#059669', label: 'Good to Have' },
};

interface Props {
  onNavigate: (screen: Screen | string, data?: Record<string, unknown>) => void;
}

export function LearningPathsPage({ onNavigate }: Props) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPath, setSelectedPath] = useState<CareerPath | null>(null);
  const [selectedGrade, setSelectedGrade] = useState('Class 9');
  const [showGradeSelector, setShowGradeSelector] = useState(false);
  const [expandedMilestone, setExpandedMilestone] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [comparePaths, setComparePaths] = useState<string[]>([]);
  const roadmapRef = useRef<HTMLDivElement>(null);

  const filteredPaths = selectedCategory === 'all'
    ? CAREER_PATHS
    : CAREER_PATHS.filter(p => p.category === selectedCategory);

  useEffect(() => {
    if (selectedPath) {
      setExpandedMilestone(selectedPath.milestones[0]?.id || null);
    }
  }, [selectedPath]);

  const toggleCompare = (pathId: string) => {
    setComparePaths(prev => {
      if (prev.includes(pathId)) return prev.filter(id => id !== pathId);
      if (prev.length >= 3) return prev;
      return [...prev, pathId];
    });
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Navbar onNavigate={onNavigate} currentScreen="learning-paths" />

      {!selectedPath ? (
        <>
          <section className="pt-24 pb-16 px-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
            <div className="max-w-6xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6"
                style={{ backgroundColor: 'rgba(78, 205, 196, 0.12)', color: BRAND.accent }}>
                <Rocket size={14} />
                AI-Powered Career Guidance
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ color: 'var(--text-primary)' }} data-testid="text-learning-paths-title">
                Personalized Learning Paths
              </h1>
              <p className="text-lg md:text-xl max-w-3xl mx-auto mb-8" style={{ color: 'var(--text-secondary)' }}>
                Choose your dream career and get a step-by-step roadmap with milestones, 
                subjects, skills, and exam strategies tailored to your goals.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
                  style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                  <GraduationCap size={16} />
                  Your Grade:
                </div>
                <div className="relative">
                  <button
                    onClick={() => setShowGradeSelector(!showGradeSelector)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-colors"
                    style={{ borderColor: BRAND.primary, color: BRAND.primary, backgroundColor: 'rgba(52, 78, 134, 0.06)' }}
                    data-testid="btn-grade-selector"
                  >
                    {selectedGrade}
                    <ChevronDown size={14} />
                  </button>
                  {showGradeSelector && (
                    <div className="absolute top-full mt-1 left-0 z-50 rounded-xl border shadow-xl py-1 min-w-[160px]"
                      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}>
                      {GRADE_OPTIONS.map(grade => (
                        <button
                          key={grade}
                          onClick={() => { setSelectedGrade(grade); setShowGradeSelector(false); }}
                          className="w-full text-left px-4 py-2 text-sm transition-colors hover:bg-[var(--bg-secondary)]"
                          style={{ color: grade === selectedGrade ? BRAND.primary : 'var(--text-primary)', fontWeight: grade === selectedGrade ? 600 : 400 }}
                          data-testid={`btn-grade-${grade}`}
                        >
                          {grade}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="px-4 pb-6">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {CAREER_CATEGORIES.map(cat => {
                  const Icon = cat.icon;
                  const isActive = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all"
                      style={{
                        backgroundColor: isActive ? BRAND.primary : 'var(--bg-secondary)',
                        color: isActive ? '#fff' : 'var(--text-secondary)',
                      }}
                      data-testid={`btn-category-${cat.id}`}
                    >
                      <Icon size={15} />
                      {cat.label}
                    </button>
                  );
                })}
                <div className="flex-1" />
                <button
                  onClick={() => { setCompareMode(!compareMode); setComparePaths([]); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border"
                  style={{
                    borderColor: compareMode ? BRAND.accent : 'var(--border-subtle)',
                    backgroundColor: compareMode ? 'rgba(78, 205, 196, 0.12)' : 'transparent',
                    color: compareMode ? BRAND.accent : 'var(--text-secondary)',
                  }}
                  data-testid="btn-compare-mode"
                >
                  <BarChart3 size={15} />
                  Compare Paths
                </button>
              </div>
            </div>
          </section>

          {compareMode && comparePaths.length >= 2 && (
            <section className="px-4 pb-8">
              <div className="max-w-6xl mx-auto">
                <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Path Comparison</h3>
                    <button onClick={() => setComparePaths([])} className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      <X size={18} />
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                          <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>Criteria</th>
                          {comparePaths.map(id => {
                            const p = CAREER_PATHS.find(cp => cp.id === id)!;
                            return <th key={id} className="text-left px-4 py-3 font-semibold" style={{ color: p.color }}>{p.title}</th>;
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: 'Avg. Salary', key: 'averageSalary' },
                          { label: 'Demand Level', key: 'demandLevel' },
                          { label: 'Duration', key: 'duration' },
                          { label: 'Key Subjects', key: 'keySubjects' },
                          { label: 'Top Exams', key: 'topExams' },
                        ].map((row, i) => (
                          <tr key={row.key} style={{ backgroundColor: i % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)' }}>
                            <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-secondary)' }}>{row.label}</td>
                            {comparePaths.map(id => {
                              const p = CAREER_PATHS.find(cp => cp.id === id)!;
                              const val = (p as any)[row.key];
                              return (
                                <td key={id} className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                                  {Array.isArray(val) ? val.join(', ') : val}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="px-4 pb-20">
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredPaths.map((path) => {
                  const Icon = path.icon;
                  const demandStyle = DEMAND_COLORS[path.demandLevel];
                  const isCompareSelected = comparePaths.includes(path.id);
                  return (
                    <div
                      key={path.id}
                      className="rounded-2xl border overflow-hidden transition-all hover:shadow-lg group relative"
                      style={{ borderColor: isCompareSelected ? BRAND.accent : 'var(--border-subtle)', backgroundColor: 'var(--bg-primary)' }}
                      data-testid={`card-career-${path.id}`}
                    >
                      {compareMode && (
                        <button
                          onClick={() => toggleCompare(path.id)}
                          className="absolute top-3 right-3 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all"
                          style={{
                            borderColor: isCompareSelected ? BRAND.accent : 'var(--border-subtle)',
                            backgroundColor: isCompareSelected ? BRAND.accent : 'transparent',
                          }}
                          data-testid={`btn-compare-${path.id}`}
                        >
                          {isCompareSelected && <CheckCircle2 size={14} color="#fff" />}
                        </button>
                      )}

                      <div className="p-5">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${path.color}15` }}>
                            <Icon size={22} style={{ color: path.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-base leading-tight mb-1" style={{ color: 'var(--text-primary)' }}>
                              {path.title}
                            </h3>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: demandStyle.bg, color: demandStyle.text }}>
                                {path.demandLevel} Demand
                              </span>
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{path.averageSalary}</span>
                            </div>
                          </div>
                        </div>

                        <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
                          {path.description}
                        </p>

                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {path.keySubjects.map(sub => (
                            <span key={sub} className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                              {sub}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center gap-4 text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {path.duration}
                          </span>
                          <span className="flex items-center gap-1">
                            <Target size={12} />
                            {path.milestones.length} milestones
                          </span>
                        </div>

                        <button
                          onClick={() => !compareMode && setSelectedPath(path)}
                          className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
                          style={{
                            backgroundColor: compareMode ? 'var(--bg-secondary)' : path.color,
                            color: compareMode ? 'var(--text-secondary)' : '#fff',
                            opacity: compareMode ? 0.6 : 1,
                          }}
                          data-testid={`btn-explore-${path.id}`}
                        >
                          {compareMode ? 'Select to Compare' : 'Explore This Path'}
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className="pt-20 pb-20 px-4" ref={roadmapRef}>
          <div className="max-w-5xl mx-auto">
            <button
              onClick={() => setSelectedPath(null)}
              className="flex items-center gap-2 text-sm font-medium mb-6 transition-colors hover:opacity-80"
              style={{ color: BRAND.primary }}
              data-testid="btn-back-to-paths"
            >
              <ChevronLeft size={16} />
              Back to All Paths
            </button>

            <div className="flex flex-col md:flex-row md:items-start gap-6 mb-10">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: `${selectedPath.color}15` }}>
                    {(() => { const Icon = selectedPath.icon; return <Icon size={28} style={{ color: selectedPath.color }} />; })()}
                  </div>
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold" style={{ color: 'var(--text-primary)' }}
                      data-testid="text-selected-path-title">
                      {selectedPath.title}
                    </h1>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      Personalized roadmap based on {selectedGrade}
                    </p>
                  </div>
                </div>
                <p className="text-sm leading-relaxed max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
                  {selectedPath.description}
                </p>
              </div>

              <div className="flex flex-wrap gap-3 md:flex-col md:gap-2 md:min-w-[200px]">
                {[
                  { label: 'Avg. Salary', value: selectedPath.averageSalary, icon: TrendingUp },
                  { label: 'Demand', value: selectedPath.demandLevel, icon: BarChart3 },
                  { label: 'Duration', value: selectedPath.duration, icon: Clock },
                ].map(stat => (
                  <div key={stat.label} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    <stat.icon size={14} style={{ color: selectedPath.color }} />
                    <div>
                      <div className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: 'var(--text-muted)' }}>{stat.label}</div>
                      <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{stat.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <h2 className="text-lg font-bold mb-5 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <MapPin size={18} style={{ color: selectedPath.color }} />
                  Your Learning Roadmap
                </h2>

                <div className="relative">
                  <div className="absolute left-5 top-0 bottom-0 w-0.5"
                    style={{ backgroundColor: `${selectedPath.color}30` }} />

                  {selectedPath.milestones.map((milestone, idx) => {
                    const isExpanded = expandedMilestone === milestone.id;
                    const isCompleted = milestone.status === 'completed';
                    const isCurrent = milestone.status === 'current';
                    const isLocked = milestone.status === 'locked';

                    return (
                      <div key={milestone.id} className="relative pl-12 pb-8 last:pb-0" data-testid={`milestone-${milestone.id}`}>
                        <div className="absolute left-3 w-5 h-5 rounded-full border-2 flex items-center justify-center z-10"
                          style={{
                            borderColor: isCompleted ? '#059669' : isCurrent ? selectedPath.color : isLocked ? 'var(--border-subtle)' : selectedPath.color,
                            backgroundColor: isCompleted ? '#059669' : isCurrent ? selectedPath.color : 'var(--bg-primary)',
                          }}>
                          {isCompleted && <CheckCircle2 size={12} color="#fff" />}
                          {isCurrent && <div className="w-2 h-2 rounded-full bg-white" />}
                          {isLocked && <Lock size={10} style={{ color: 'var(--text-muted)' }} />}
                          {!isCompleted && !isCurrent && !isLocked && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedPath.color }} />}
                        </div>

                        <button
                          onClick={() => setExpandedMilestone(isExpanded ? null : milestone.id)}
                          className="w-full text-left rounded-xl border p-4 transition-all hover:shadow-md"
                          style={{
                            borderColor: isCurrent ? selectedPath.color : 'var(--border-subtle)',
                            backgroundColor: isCurrent ? `${selectedPath.color}08` : 'var(--bg-primary)',
                          }}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                  style={{
                                    backgroundColor: isCurrent ? `${selectedPath.color}20` : isCompleted ? 'rgba(5, 150, 105, 0.12)' : 'var(--bg-secondary)',
                                    color: isCurrent ? selectedPath.color : isCompleted ? '#059669' : 'var(--text-muted)',
                                  }}>
                                  {milestone.grade}
                                </span>
                                {isCurrent && (
                                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                    style={{ backgroundColor: `${selectedPath.color}20`, color: selectedPath.color }}>
                                    You are here
                                  </span>
                                )}
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full capitalize"
                                  style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                                  {milestone.type}
                                </span>
                              </div>
                              <h3 className="font-bold text-base" style={{ color: isLocked ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                                {milestone.title}
                              </h3>
                              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{milestone.description}</p>
                            </div>
                            <ChevronDown size={16} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              style={{ color: 'var(--text-muted)' }} />
                          </div>

                          {isExpanded && (
                            <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                              <ul className="space-y-2">
                                {milestone.items.map((item, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm"
                                    style={{ color: isLocked ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
                                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                                      style={{ backgroundColor: isLocked ? 'var(--text-muted)' : selectedPath.color }} />
                                    {item}
                                  </li>
                                ))}
                              </ul>
                              {isCurrent && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); onNavigate('pricing'); }}
                                  className="mt-4 flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg transition-all hover:opacity-90"
                                  style={{ backgroundColor: selectedPath.color, color: '#fff' }}
                                  data-testid={`btn-start-milestone-${milestone.id}`}
                                >
                                  <Sparkles size={12} />
                                  Get Assessment for This Stage
                                </button>
                              )}
                            </div>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-primary)' }}>
                  <h3 className="font-bold text-base mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Zap size={16} style={{ color: selectedPath.color }} />
                    Skills Required
                  </h3>
                  <div className="space-y-3">
                    {selectedPath.skills.map((skill) => {
                      const impConfig = IMPORTANCE_CONFIG[skill.importance];
                      const level = skill.currentLevel || Math.floor(Math.random() * 40) + 20;
                      return (
                        <div key={skill.name}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{skill.name}</span>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: `${impConfig.color}15`, color: impConfig.color }}>
                              {impConfig.label}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                            <div className="h-full rounded-full transition-all" style={{ width: `${level}%`, backgroundColor: selectedPath.color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => onNavigate('pricing')}
                    className="w-full mt-4 py-2 rounded-lg text-xs font-semibold transition-all border"
                    style={{ borderColor: selectedPath.color, color: selectedPath.color }}
                    data-testid="btn-take-skill-assessment"
                  >
                    Take Skill Assessment
                  </button>
                </div>

                <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-primary)' }}>
                  <h3 className="font-bold text-base mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Award size={16} style={{ color: selectedPath.color }} />
                    Top Exams
                  </h3>
                  <div className="space-y-2">
                    {selectedPath.topExams.map(exam => (
                      <div key={exam} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                        style={{ backgroundColor: 'var(--bg-secondary)' }}>
                        <FileText size={13} style={{ color: selectedPath.color }} />
                        <span style={{ color: 'var(--text-primary)' }}>{exam}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-primary)' }}>
                  <h3 className="font-bold text-base mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <GraduationCap size={16} style={{ color: selectedPath.color }} />
                    Top Institutions
                  </h3>
                  <div className="space-y-2">
                    {selectedPath.topInstitutions.map(inst => (
                      <div key={inst} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                        style={{ backgroundColor: 'var(--bg-secondary)' }}>
                        <Building2 size={12} style={{ color: selectedPath.color }} />
                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{inst}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedPath.relatedPaths.length > 0 && (
                  <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-primary)' }}>
                    <h3 className="font-bold text-base mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                      <Lightbulb size={16} style={{ color: BRAND.accent }} />
                      Related Paths
                    </h3>
                    <div className="space-y-2">
                      {selectedPath.relatedPaths.map(rpId => {
                        const rp = CAREER_PATHS.find(p => p.id === rpId);
                        if (!rp) return null;
                        const RpIcon = rp.icon;
                        return (
                          <button
                            key={rpId}
                            onClick={() => setSelectedPath(rp)}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-[var(--bg-secondary)] text-left"
                            data-testid={`btn-related-${rpId}`}
                          >
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${rp.color}15` }}>
                              <RpIcon size={14} style={{ color: rp.color }} />
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-xs" style={{ color: 'var(--text-primary)' }}>{rp.title}</div>
                              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{rp.averageSalary}</div>
                            </div>
                            <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="rounded-2xl p-5" style={{ backgroundColor: `${BRAND.accent}10`, border: `1px solid ${BRAND.accent}30` }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={16} style={{ color: BRAND.accent }} />
                    <h3 className="font-bold text-sm" style={{ color: BRAND.accent }}>MetryxOne Assessment</h3>
                  </div>
                  <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
                    Get a detailed behavioral and aptitude assessment to validate your career choice and identify areas of growth.
                  </p>
                  <button
                    onClick={() => onNavigate('pricing')}
                    className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
                    style={{ backgroundColor: BRAND.accent, color: '#fff' }}
                    data-testid="btn-get-assessment"
                  >
                    Explore Assessments
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <Footer onNavigate={onNavigate} />
    </div>
  );
}
