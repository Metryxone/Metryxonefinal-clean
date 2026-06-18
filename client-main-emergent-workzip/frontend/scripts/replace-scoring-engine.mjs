/**
 * Replaces the Calculation & Norms Engine section.
 * Reads the new section from scripts/scoring-section.txt to avoid backtick nesting issues.
 */
import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/components/SuperAdminDashboard.tsx';
let src = readFileSync(filePath, 'utf-8');
const newSection = readFileSync('scripts/scoring-section.txt', 'utf-8');

// ── 1. Ensure new state variables (replace old ones) ─────────────────────────
const OLD_STATE = `const [scoringSubTab, setScoringSubTab] = useState('overview');
  const [calcModule, setCalcModule] = useState('les');
  const [calcInputs, setCalcInputs] = useState<Record<string,string>>({});
  const [calcResult, setCalcResult] = useState<any>(null);`;

const NEW_STATE = `const [scoringSubTab, setScoringSubTab] = useState('registry');
  const [calcModule, setCalcModule] = useState('les');
  const [calcInputs, setCalcInputs] = useState<Record<string,string>>({});
  const [calcResult, setCalcResult] = useState<any>(null);
  const [expandedModule, setExpandedModule] = useState<string|null>(null);
  const [domainRows, setDomainRows] = useState([
    { id: 1, domain: 'Language & Literacy',  subdomain: 'Reading Comprehension', module: 'LES',  band: 'A\u2013D',   weight: 30, status: 'Active' },
    { id: 2, domain: 'Language & Literacy',  subdomain: 'Vocabulary Range',       module: 'CU',   band: 'A\u2013E3',  weight: 25, status: 'Active' },
    { id: 3, domain: 'Cognitive Abilities',  subdomain: 'Working Memory',          module: 'MEM',  band: 'B\u2013E2',  weight: 35, status: 'Active' },
    { id: 4, domain: 'Cognitive Abilities',  subdomain: 'Sustained Attention',     module: 'ATT',  band: 'C\u2013E3',  weight: 30, status: 'Active' },
    { id: 5, domain: 'Learning & Strategy',  subdomain: 'Study Strategy Profile',  module: 'STR',  band: 'D\u2013E3',  weight: 20, status: 'Draft'  },
    { id: 6, domain: 'Academic Readiness',   subdomain: 'Exam Preparedness',       module: 'EXAM', band: 'C\u2013E3',  weight: 40, status: 'Active' },
  ] as {id:number,domain:string,subdomain:string,module:string,band:string,weight:number,status:string}[]);
  const [normRows, setNormRows] = useState([
    { band:'A',  grades:'Gr 6\u20137',      ages:'11\u201313', p20:28, p40:42, p60:58, p80:74 },
    { band:'B',  grades:'Gr 8\u20139',      ages:'13\u201315', p20:32, p40:46, p60:62, p80:77 },
    { band:'C',  grades:'Gr 10',            ages:'15\u201316', p20:35, p40:50, p60:65, p80:80 },
    { band:'D',  grades:'Gr 11\u201312',    ages:'16\u201318', p20:38, p40:53, p60:68, p80:82 },
    { band:'E1', grades:'UG Yr 1\u20132',   ages:'18\u201320', p20:40, p40:55, p60:70, p80:84 },
    { band:'E2', grades:'UG Yr 3+/PG',      ages:'20\u201323', p20:42, p40:57, p60:72, p80:86 },
    { band:'E3', grades:'Adult',             ages:'23+',        p20:44, p40:59, p60:74, p80:88 },
  ] as {band:string,grades:string,ages:string,p20:number,p40:number,p60:number,p80:number}[]);
  const formulaRows = [
    { code:'LES',  name:'Learning Efficiency Score',  formula:'((Raw\u22127)\u00f728)\u00d7100',          weights:'MMI 50% / MCI 50%',          bands:'<40 Dev | 40\u201360 Emrg | 60\u201375 Prof | 75\u201390 Adv | 90+ Exc',      params:4, status:'Active', color:'#344E86' },
    { code:'ATT',  name:'Task Attention Index',        formula:'(Stability\u00d70.6)+(SR_avg\u00d78)',     weights:'Stability 60% / SR 40%',     bands:'<30 VLow | 30\u201350 Low | 50\u201365 Mod | 65\u201380 High | 80+ VHigh',  params:3, status:'Active', color:'#4ECDC4' },
    { code:'MEM',  name:'Memory Effectiveness',        formula:'0.4\u00d7ENC+0.4\u00d7REC+0.2\u00d7DR',  weights:'Enc 40% / Rec 40% / DR 20%', bands:'<40 Weak | 40\u201355 Dev | 55\u201370 Func | 70\u201385 Str | 85+ Exc',    params:3, status:'Active', color:'#7C3AED' },
    { code:'CU',   name:'Conceptual Understanding',    formula:'(CU1+CU2+CU3)\u00f73',                    weights:'CU1 33% / CU2 33% / CU3 34%',bands:'0\u20134 BelBas | 4\u20136 Bas | 6\u20137.5 Dev | 7.5\u20139 Prof | 9+ Adv',  params:4, status:'Active', color:'#D97706' },
    { code:'STR',  name:'Learning Strategy',           formula:'V+R+P tag sum \u2192 Dominant',            weights:'\u226540% dominant | switch rate',bands:'Single Rigid | Two Flex | All Adapt | Switch=HiAdapt',                     params:2, status:'Active', color:'#059669' },
    { code:'EXAM', name:'Exam Readiness',              formula:'(\u03a3 option_score\u00f7max)\u00d7100', weights:'Equal subdomain weight',      bands:'<40 Supp | 40\u201355 Dev | 55\u201370 Appr | 70\u201385 OnTrk | 85+ Ready',params:2, status:'Active', color:'#BE185D' },
  ];`;

if (src.includes(OLD_STATE)) {
  src = src.replace(OLD_STATE, NEW_STATE);
  console.log('✓ State variables replaced');
} else if (src.includes("useState('registry')")) {
  console.log('✓ State variables already updated');
} else {
  console.error('ERROR: could not find old state block');
  process.exit(1);
}

// ── 2. Splice in the new section ─────────────────────────────────────────────
const START_MARKER = `              {/* ═══════════════════════════════════════════════════════════════
                  CALCULATION & NORMS ENGINE`;
const END_MARKER   = `              {/* Pricing & Packages Tab */}`;

const startIdx = src.indexOf(START_MARKER);
const endIdx   = src.indexOf(END_MARKER);

if (startIdx === -1) { console.error('ERROR: start marker not found'); process.exit(1); }
if (endIdx   === -1) { console.error('ERROR: end marker not found');   process.exit(1); }

src = src.slice(0, startIdx) + newSection + '\n' + src.slice(endIdx);

writeFileSync(filePath, src);
console.log('✓ Compact Norms Engine section spliced in');
console.log('  File size:', Math.round(src.length / 1024), 'KB');
