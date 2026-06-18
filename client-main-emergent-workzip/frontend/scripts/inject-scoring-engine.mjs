/**
 * Injects the Calculation & Norms Engine section into SuperAdminDashboard.tsx
 * Run: node scripts/inject-scoring-engine.mjs
 */
import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/components/SuperAdminDashboard.tsx';
let src = readFileSync(filePath, 'utf-8');

// ── 1. Add Calculator icon to imports ────────────────────────────────────────
src = src.replace(
  'GitBranch\n} from \'lucide-react\';',
  'GitBranch, Calculator, SlidersHorizontal, FlaskConical, BarChart2, Percent\n} from \'lucide-react\';'
);

// ── 2. Add scoringSubTab state after the last known state block ──────────────
src = src.replace(
  "const [seedingPackages, setSeedingPackages] = useState(false);",
  `const [seedingPackages, setSeedingPackages] = useState(false);
  const [scoringSubTab, setScoringSubTab] = useState('overview');
  const [calcModule, setCalcModule] = useState('les');
  const [calcInputs, setCalcInputs] = useState<Record<string,string>>({});
  const [calcResult, setCalcResult] = useState<any>(null);`
);

// ── 3. Add nav item in Assessment Modules group ──────────────────────────────
src = src.replace(
  `        { id: 'behavior', icon: Layers, label: 'Assessment Modules' },
      ]
    },
    {
      label: 'People',`,
  `        { id: 'behavior', icon: Layers, label: 'Assessment Modules' },
        { id: 'scoring', icon: Calculator, label: 'Norms & Scoring' },
      ]
    },
    {
      label: 'People',`
);

// ── 4. Build the full Scoring Engine section ─────────────────────────────────
const SCORING_SECTION = `
              {/* ═══════════════════════════════════════════════════════════════
                  CALCULATION & NORMS ENGINE
              ═══════════════════════════════════════════════════════════════ */}
              {activeTab === 'scoring' && (
                <div className="space-y-0">

                  {/* ── White Header ───────────────────────────────────────── */}
                  <div className="bg-white border-b px-6 py-5">
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                          <Calculator className="h-5 w-5" style={{ color: BRAND.primary }} />
                          Calculation &amp; Norms Engine
                        </h2>
                        <p className="text-sm text-gray-500 mt-0.5">
                          Configure scoring formulas, age-band percentile norms, domain weights, and band thresholds for all assessment modules
                        </p>
                      </div>
                      <Button size="sm" style={{ backgroundColor: BRAND.primary }} className="text-white gap-1.5">
                        <Save className="h-3.5 w-3.5" /> Save Configuration
                      </Button>
                    </div>

                    {/* KPI Strip */}
                    <div className="grid grid-cols-5 gap-0 divide-x divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                      {[
                        { label: 'Scoring Modules', value: '6', sub: 'LES · ATT · MEM · CU · STR · Academic' },
                        { label: 'Age Bands', value: '7', sub: 'A · B · C · D · E1 · E2 · E3' },
                        { label: 'Configurable Weights', value: '24', sub: 'formula parameters' },
                        { label: 'Percentile Tiers', value: '5', sub: 'per module (P20–P80)' },
                        { label: 'Last Calibrated', value: 'Jan 2025', sub: 'norm tables version 3.2' },
                      ].map((kpi, i) => (
                        <div key={i} className="text-center py-4 px-3 bg-white hover:bg-gray-50 transition-colors">
                          <p className="text-2xl font-bold" style={{ color: BRAND.primary }}>{kpi.value}</p>
                          <p className="text-xs font-semibold text-gray-700 mt-0.5">{kpi.label}</p>
                          <p className="text-[11px] text-gray-400">{kpi.sub}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── Sub-tab Bar ────────────────────────────────────────── */}
                  <div className="bg-white border-b px-6 flex gap-0">
                    {[
                      { id: 'overview',   label: 'Module Overview' },
                      { id: 'agebands',  label: 'Age Band Norms' },
                      { id: 'formulas',  label: 'Scoring Formulas' },
                      { id: 'calculator', label: 'Test Calculator' },
                    ].map(t => (
                      <button
                        key={t.id}
                        onClick={() => setScoringSubTab(t.id)}
                        className={\`px-5 py-3 text-sm font-medium border-b-2 transition-colors \${
                          scoringSubTab === t.id
                            ? 'text-blue-700'
                            : 'border-transparent text-gray-500 hover:text-gray-800'
                        }\`}
                        style={scoringSubTab === t.id ? { borderColor: BRAND.primary, color: BRAND.primary } : {}}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  <div className="p-6 space-y-6">

                    {/* ════════════════════════════════════════════
                        SUB-TAB: MODULE OVERVIEW
                    ════════════════════════════════════════════ */}
                    {scoringSubTab === 'overview' && (() => {
                      const modules = [
                        {
                          code: 'LES',
                          name: 'Learning Efficiency Score',
                          color: '#344E86',
                          icon: Brain,
                          formula: 'LES% = ((Raw − 7) ÷ 28) × 100',
                          dimensions: ['MMI – Meta-cognitive Awareness', 'MCI – Meta-cognitive Control'],
                          weights: [{ key: 'MMI weight', val: '50%' }, { key: 'MCI weight', val: '50%' }],
                          bands: ['Below 40 → Developing', '40–60 → Emerging', '60–75 → Proficient', '75–90 → Advanced', '90+ → Exceptional'],
                          status: 'Active',
                        },
                        {
                          code: 'ATT',
                          name: 'Task Attention Index',
                          color: '#4ECDC4',
                          icon: Target,
                          formula: 'ATI = (Stability × 0.6) + (Self-Report Avg × 8)',
                          dimensions: ['Stability Score (hit-rate vs false-alarms)', 'Self-Report Composite', 'Fatigue Sensitivity (1H vs 2H)'],
                          weights: [{ key: 'Stability', val: '60%' }, { key: 'Self-Report', val: '40%' }],
                          bands: ['< 30 → Very Low', '30–50 → Low', '50–65 → Moderate', '65–80 → High', '80+ → Very High'],
                          status: 'Active',
                        },
                        {
                          code: 'MEM',
                          name: 'Memory Effectiveness',
                          color: '#7C3AED',
                          icon: Sparkles,
                          formula: 'MEM = 0.4×Encoding + 0.4×Recognition + 0.2×Distortion Resistance',
                          dimensions: ['Encoding Accuracy (Recall)', 'Recognition Accuracy', 'Distortion Resistance'],
                          weights: [{ key: 'Encoding', val: '40%' }, { key: 'Recognition', val: '40%' }, { key: 'Distortion Res.', val: '20%' }],
                          bands: ['< 40 → Weak', '40–55 → Developing', '55–70 → Functional', '70–85 → Strong', '85+ → Exceptional'],
                          status: 'Active',
                        },
                        {
                          code: 'CU',
                          name: 'Conceptual Understanding',
                          color: '#D97706',
                          icon: Award,
                          formula: 'CU = Avg(CU1, CU2, CU3) · each scored 0–10',
                          dimensions: ['CU1 – Main Idea Identification', 'CU2 – Cause-Effect Reasoning', 'CU3 – Application & Transfer'],
                          weights: [{ key: 'CU1', val: '33%' }, { key: 'CU2', val: '33%' }, { key: 'CU3', val: '34%' }],
                          bands: ['0–4 → Below Basic', '4–6 → Basic', '6–7.5 → Developing', '7.5–9 → Proficient', '9+ → Advanced'],
                          status: 'Active',
                        },
                        {
                          code: 'STR',
                          name: 'Learning Strategy',
                          color: '#059669',
                          icon: GitBranch,
                          formula: 'V-score + R-score + P-score per response; Adaptability = switch rate across difficulty',
                          dimensions: ['Visual (V) – spatial/diagrammatic', 'Reading (R) – text-based', 'Practice (P) – hands-on/repetition'],
                          weights: [{ key: 'Dominant tag', val: '≥ 40%' }, { key: 'Adaptability', val: 'strategy switches' }],
                          bands: ['Single dominant → Rigid', 'Two strategies → Flexible', 'All three → Adaptive', 'Switch on hard items → High Adaptability'],
                          status: 'Active',
                        },
                        {
                          code: 'EXAM',
                          name: 'Exam Readiness (Academic)',
                          color: '#BE185D',
                          icon: GraduationCap,
                          formula: 'Domain% = (Σ option_score) ÷ max_possible × 100; Overall = weighted avg of subdomains',
                          dimensions: ['Domain-level scoring per subdomain', 'Readiness Level (0–100%)', 'Module score bands'],
                          weights: [{ key: 'Each subdomain', val: 'equal weight' }, { key: 'Board/Grade filter', val: 'applied' }],
                          bands: ['< 40 → Needs Support', '40–55 → Developing', '55–70 → Approaching', '70–85 → On Track', '85+ → Exam Ready'],
                          status: 'Active',
                        },
                      ];
                      return (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-base font-semibold text-gray-800">All Scoring Modules</h3>
                            <Badge variant="outline" className="text-xs">6 active modules</Badge>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {modules.map(m => {
                              const Icon = m.icon;
                              return (
                                <Card key={m.code} className="border overflow-hidden">
                                  <div className="flex items-center gap-3 px-4 pt-4 pb-2">
                                    <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: m.color + '18' }}>
                                      <Icon className="h-5 w-5" style={{ color: m.color }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold text-sm" style={{ color: m.color }}>{m.code}</span>
                                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-green-700 border-green-200 bg-green-50">{m.status}</Badge>
                                      </div>
                                      <p className="text-sm font-medium text-gray-800 truncate">{m.name}</p>
                                    </div>
                                  </div>
                                  <div className="px-4 pb-2">
                                    <div className="rounded-md bg-gray-50 px-3 py-2 border border-gray-100 mb-2">
                                      <p className="text-[11px] font-mono text-gray-600">{m.formula}</p>
                                    </div>
                                    <div className="space-y-1 mb-2">
                                      {m.dimensions.map((d, di) => (
                                        <div key={di} className="flex items-center gap-1.5 text-xs text-gray-600">
                                          <div className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
                                          {d}
                                        </div>
                                      ))}
                                    </div>
                                    <div className="flex flex-wrap gap-1 mb-2">
                                      {m.weights.map((w, wi) => (
                                        <span key={wi} className="text-[10px] px-2 py-0.5 rounded-full border" style={{ borderColor: m.color + '40', color: m.color, backgroundColor: m.color + '10' }}>
                                          {w.key}: {w.val}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="border-t bg-gray-50 px-4 py-2">
                                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Performance Bands</p>
                                    <div className="flex flex-wrap gap-1">
                                      {m.bands.map((b, bi) => (
                                        <span key={bi} className="text-[10px] text-gray-600 bg-white border border-gray-200 rounded px-1.5 py-0.5">{b}</span>
                                      ))}
                                    </div>
                                  </div>
                                </Card>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* ════════════════════════════════════════════
                        SUB-TAB: AGE BAND NORMS
                    ════════════════════════════════════════════ */}
                    {scoringSubTab === 'agebands' && (() => {
                      const bands = [
                        { code: 'A',  label: 'Band A',  grades: 'Grades 6–7',      ages: '11–13',   context: 'Middle school, early adolescent',    p20: 28, p40: 42, p60: 58, p80: 74 },
                        { code: 'B',  label: 'Band B',  grades: 'Grades 8–9',      ages: '13–15',   context: 'Late middle school / early high',    p20: 32, p40: 46, p60: 62, p80: 77 },
                        { code: 'C',  label: 'Band C',  grades: 'Grade 10',        ages: '15–16',   context: 'Board year — exam-prep critical',    p20: 35, p40: 50, p60: 65, p80: 80 },
                        { code: 'D',  label: 'Band D',  grades: 'Grades 11–12',    ages: '16–18',   context: 'Senior secondary, stream specific',  p20: 38, p40: 53, p60: 68, p80: 82 },
                        { code: 'E1', label: 'Band E1', grades: 'UG Year 1–2',     ages: '18–20',   context: 'Undergraduate early years',          p20: 40, p40: 55, p60: 70, p80: 84 },
                        { code: 'E2', label: 'Band E2', grades: 'UG Year 3+ / PG', ages: '20–23',   context: 'Undergraduate senior / postgrad',    p20: 42, p40: 57, p60: 72, p80: 86 },
                        { code: 'E3', label: 'Band E3', grades: 'Adult Learner',   ages: '23+',     context: 'Employed professionals / upskill',   p20: 44, p40: 59, p60: 74, p80: 88 },
                      ];
                      return (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-base font-semibold text-gray-800">Age Band Norm Tables</h3>
                              <p className="text-sm text-gray-500">Percentile cutoffs used to classify raw scores into performance bands per age cohort</p>
                            </div>
                            <Button variant="outline" size="sm" className="gap-1.5">
                              <Download className="h-3.5 w-3.5" /> Export Norms CSV
                            </Button>
                          </div>

                          {/* Legend */}
                          <div className="flex flex-wrap gap-2 items-center text-xs text-gray-600">
                            <span className="font-medium">Percentile tiers:</span>
                            {[['P20', 'bg-red-100 text-red-700'], ['P40', 'bg-orange-100 text-orange-700'], ['P60', 'bg-yellow-100 text-yellow-700'], ['P80', 'bg-green-100 text-green-700']].map(([l, cls]) => (
                              <span key={l} className={\`px-2 py-0.5 rounded font-medium \${cls}\`}>{l}</span>
                            ))}
                            <span className="text-gray-400">— lower boundary score for each percentile tier</span>
                          </div>

                          <Card>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b bg-gray-50">
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Band</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Grade Range</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Ages</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Context</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-red-600 uppercase tracking-wider">P20 Cutoff</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-orange-600 uppercase tracking-wider">P40 Cutoff</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-yellow-600 uppercase tracking-wider">P60 Cutoff</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-green-600 uppercase tracking-wider">P80 Cutoff</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {bands.map((b, bi) => (
                                    <tr key={b.code} className="hover:bg-gray-50 group">
                                      <td className="px-4 py-3">
                                        <span className="inline-flex items-center gap-1.5">
                                          <span className="h-6 w-6 rounded flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: BRAND.primary }}>{b.code}</span>
                                          <span className="font-medium text-gray-800">{b.label}</span>
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-gray-700">{b.grades}</td>
                                      <td className="px-4 py-3 text-gray-700">{b.ages} yrs</td>
                                      <td className="px-4 py-3 text-gray-500 text-xs">{b.context}</td>
                                      {[b.p20, b.p40, b.p60, b.p80].map((v, vi) => (
                                        <td key={vi} className="px-4 py-3 text-center">
                                          <input
                                            type="number"
                                            defaultValue={v}
                                            className="w-16 border rounded px-2 py-1 text-center text-sm font-mono focus:outline-none focus:ring-1"
                                            style={{ '--tw-ring-color': BRAND.primary } as React.CSSProperties}
                                          />
                                        </td>
                                      ))}
                                      <td className="px-4 py-3 text-center">
                                        <Button variant="ghost" size="sm" className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <Save className="h-3.5 w-3.5" />
                                        </Button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </Card>

                          {/* Per-module norm override notice */}
                          <Card className="border-amber-200 bg-amber-50">
                            <CardContent className="pt-4">
                              <div className="flex gap-3">
                                <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm font-medium text-amber-800">Module-Specific Norm Overrides</p>
                                  <p className="text-xs text-amber-700 mt-0.5">
                                    ATT, MEM, and STR modules use their own internal scaling before applying these age-band cutoffs.
                                    The ATT Fatigue Sensitivity flag and STR Adaptability score are additive adjustments applied on top of the base percentile.
                                    Changing cutoffs here affects all modules globally unless a module override is configured in Scoring Formulas.
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      );
                    })()}

                    {/* ════════════════════════════════════════════
                        SUB-TAB: SCORING FORMULAS
                    ════════════════════════════════════════════ */}
                    {scoringSubTab === 'formulas' && (() => {
                      const formulaModules = [
                        {
                          code: 'LES', name: 'Learning Efficiency Score', color: '#344E86',
                          file: 'server/src/scoring/les.ts',
                          steps: [
                            { step: 1, label: 'Sum all Likert responses', formula: 'Raw = Σ item_scores', note: 'Items 1–7: MMI (meta-cognitive awareness), Items 8–14: MCI (meta-cognitive control)' },
                            { step: 2, label: 'Normalize to 0–100 scale', formula: 'LES% = ((Raw − 7) ÷ 28) × 100', note: 'Min = 7 (all 1s), Max = 35 (all 5s) → 28-point range' },
                            { step: 3, label: 'Split MMI and MCI subscores', formula: 'MMI% = ((MMI_raw − 7) ÷ 28) × 100', note: 'Same formula applied to each 7-item subscale independently' },
                            { step: 4, label: 'Pattern detection', formula: 'if MMI > 70 and MCI < 50 → "Aware but Passive"', note: 'Cross-pattern flags combine subscores to diagnose learning style' },
                          ],
                          params: [
                            { key: 'item_count', label: 'Total items', value: '14', editable: false },
                            { key: 'min_raw', label: 'Minimum raw score', value: '7', editable: false },
                            { key: 'max_raw', label: 'Maximum raw score', value: '35', editable: false },
                            { key: 'mmi_items', label: 'MMI item count', value: '7', editable: true },
                            { key: 'mci_items', label: 'MCI item count', value: '7', editable: true },
                          ],
                        },
                        {
                          code: 'ATT', name: 'Task Attention Index', color: '#4ECDC4',
                          file: 'server/src/scoring/attention.ts',
                          steps: [
                            { step: 1, label: 'Calculate Stability Score', formula: 'Stability = Hit Rate − False Alarm Rate', note: 'Hit Rate = correct taps ÷ total targets; False Alarm = incorrect taps ÷ distractors' },
                            { step: 2, label: 'Average self-report items', formula: 'SR_avg = Σ self_report_scores ÷ n_items', note: 'Self-report Likert items (1–5 scale)' },
                            { step: 3, label: 'Composite ATI', formula: 'ATI = (Stability × 0.6) + (SR_avg × 8)', note: 'Stability is bounded 0–1; SR contribution scaled ×8 to align ranges' },
                            { step: 4, label: 'Fatigue Sensitivity flag', formula: 'Fatigue = First-Half Accuracy − Second-Half Accuracy > 15%', note: 'If gap > 15 percentage points → Fatigue Sensitivity flag raised' },
                          ],
                          params: [
                            { key: 'stability_weight', label: 'Stability weight', value: '0.60', editable: true },
                            { key: 'sr_scale', label: 'Self-report scale factor', value: '8', editable: true },
                            { key: 'fatigue_threshold', label: 'Fatigue flag threshold', value: '15%', editable: true },
                          ],
                        },
                        {
                          code: 'MEM', name: 'Memory Effectiveness', color: '#7C3AED',
                          file: 'server/src/scoring/mem.ts',
                          steps: [
                            { step: 1, label: 'Encoding score (recall)', formula: 'ENC = (Correct Recalls ÷ Total Targets) × 100', note: 'Measures immediate word/item recall accuracy' },
                            { step: 2, label: 'Recognition score', formula: 'REC = (True Positives ÷ (TP + FN)) × 100', note: 'Sensitivity = proportion of targets correctly recognized' },
                            { step: 3, label: 'Distortion resistance', formula: 'DR = 1 − (False Alarms ÷ Distractors)', note: 'Higher DR = less confused by lure items' },
                            { step: 4, label: 'Composite MEM', formula: 'MEM = (0.4 × ENC) + (0.4 × REC) + (0.2 × DR)', note: 'Weighted composite; all subscores normalized to 0–100 before combining' },
                          ],
                          params: [
                            { key: 'enc_weight', label: 'Encoding weight', value: '0.40', editable: true },
                            { key: 'rec_weight', label: 'Recognition weight', value: '0.40', editable: true },
                            { key: 'dr_weight', label: 'Distortion resistance weight', value: '0.20', editable: true },
                          ],
                        },
                        {
                          code: 'CU', name: 'Conceptual Understanding', color: '#D97706',
                          file: 'server/src/scoring/cu.ts',
                          steps: [
                            { step: 1, label: 'Score CU1 – Main Idea', formula: 'CU1 = sum of option_scores for Main Idea items (0–10)', note: 'Questions targeting text comprehension and main idea extraction' },
                            { step: 2, label: 'Score CU2 – Cause-Effect', formula: 'CU2 = sum of option_scores for Cause-Effect items (0–10)', note: 'Questions targeting inferential and causal reasoning' },
                            { step: 3, label: 'Score CU3 – Application', formula: 'CU3 = sum of option_scores for Application items (0–10)', note: 'Questions requiring transfer of concepts to novel contexts' },
                            { step: 4, label: 'Overall CU', formula: 'CU = (CU1 + CU2 + CU3) ÷ 3', note: 'Simple arithmetic mean of three dimension scores' },
                          ],
                          params: [
                            { key: 'cu1_max', label: 'CU1 max score', value: '10', editable: true },
                            { key: 'cu2_max', label: 'CU2 max score', value: '10', editable: true },
                            { key: 'cu3_max', label: 'CU3 max score', value: '10', editable: true },
                            { key: 'avg_method', label: 'Aggregation method', value: 'Mean', editable: false },
                          ],
                        },
                        {
                          code: 'STR', name: 'Learning Strategy', color: '#059669',
                          file: 'server/src/scoring/learningStrategy.ts',
                          steps: [
                            { step: 1, label: 'Tag each response', formula: 'Each option carries a tag: V (Visual), R (Reading), P (Practice)', note: 'Tags defined per question in the question bank' },
                            { step: 2, label: 'Sum tags per strategy', formula: 'V_total = Σ V-tagged answers, R_total = Σ R, P_total = Σ P', note: 'Counts how many times the student chose each strategy type' },
                            { step: 3, label: 'Identify dominant strategy', formula: 'Dominant = argmax(V_total, R_total, P_total)', note: 'Strategy with highest count; if tie → "Balanced"' },
                            { step: 4, label: 'Adaptability score', formula: 'Adaptability = (strategy switches on hard items) ÷ total_hard_items', note: 'Proportion of hard items where student switched away from dominant strategy' },
                          ],
                          params: [
                            { key: 'dominant_threshold', label: 'Dominant strategy threshold', value: '40%', editable: true },
                            { key: 'adaptability_min', label: 'Min switches for "Adaptive"', value: '30%', editable: true },
                          ],
                        },
                      ];

                      return (
                        <div className="space-y-6">
                          {formulaModules.map(m => (
                            <Card key={m.code} className="overflow-hidden">
                              <CardHeader className="pb-3 border-b" style={{ borderLeftWidth: 4, borderLeftColor: m.color }}>
                                <div className="flex items-center justify-between">
                                  <div>
                                    <CardTitle className="text-base flex items-center gap-2">
                                      <span className="font-bold" style={{ color: m.color }}>{m.code}</span>
                                      <span className="text-gray-800">{m.name}</span>
                                    </CardTitle>
                                    <CardDescription className="font-mono text-xs mt-0.5">{m.file}</CardDescription>
                                  </div>
                                  <Button variant="outline" size="sm" className="gap-1 text-xs">
                                    <Edit className="h-3 w-3" /> Edit Parameters
                                  </Button>
                                </div>
                              </CardHeader>
                              <CardContent className="pt-4">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                  {/* Calculation Steps */}
                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Calculation Steps</p>
                                    <div className="space-y-3">
                                      {m.steps.map(s => (
                                        <div key={s.step} className="flex gap-3">
                                          <div className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5" style={{ backgroundColor: m.color }}>
                                            {s.step}
                                          </div>
                                          <div className="flex-1">
                                            <p className="text-sm font-medium text-gray-800">{s.label}</p>
                                            <code className="text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 block mt-1 font-mono">{s.formula}</code>
                                            <p className="text-xs text-gray-500 mt-1">{s.note}</p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  {/* Configurable Parameters */}
                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Configurable Parameters</p>
                                    <div className="space-y-2">
                                      {m.params.map(p => (
                                        <div key={p.key} className="flex items-center gap-3">
                                          <div className="flex-1">
                                            <p className="text-xs font-medium text-gray-700">{p.label}</p>
                                            <p className="text-[10px] text-gray-400 font-mono">{p.key}</p>
                                          </div>
                                          {p.editable ? (
                                            <input
                                              type="text"
                                              defaultValue={p.value}
                                              className="w-20 border rounded px-2 py-1 text-sm text-center font-mono focus:outline-none focus:ring-1"
                                              style={{ '--tw-ring-color': m.color } as React.CSSProperties}
                                            />
                                          ) : (
                                            <span className="w-20 text-center text-sm font-mono text-gray-500 bg-gray-100 rounded px-2 py-1">{p.value}</span>
                                          )}
                                          {!p.editable && <span className="text-[10px] text-gray-400">fixed</span>}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      );
                    })()}

                    {/* ════════════════════════════════════════════
                        SUB-TAB: TEST CALCULATOR
                    ════════════════════════════════════════════ */}
                    {scoringSubTab === 'calculator' && (() => {
                      const modules = [
                        { id: 'les',  label: 'LES – Learning Efficiency',   inputs: [{ key: 'raw', label: 'Raw Total Score (7–35)', min: 7, max: 35 }, { key: 'mmi_raw', label: 'MMI Subscore (7–35)', min: 7, max: 35 }, { key: 'mci_raw', label: 'MCI Subscore (7–35)', min: 7, max: 35 }] },
                        { id: 'att',  label: 'ATT – Task Attention Index',  inputs: [{ key: 'stability', label: 'Stability Score (0–1)', min: 0, max: 1, step: 0.01 }, { key: 'sr_avg', label: 'Self-Report Avg (1–5)', min: 1, max: 5, step: 0.1 }, { key: 'h1_acc', label: '1st Half Accuracy %', min: 0, max: 100 }, { key: 'h2_acc', label: '2nd Half Accuracy %', min: 0, max: 100 }] },
                        { id: 'mem',  label: 'MEM – Memory Effectiveness',  inputs: [{ key: 'enc', label: 'Encoding Score (0–100)', min: 0, max: 100 }, { key: 'rec', label: 'Recognition Score (0–100)', min: 0, max: 100 }, { key: 'dr', label: 'Distortion Resistance (0–100)', min: 0, max: 100 }] },
                        { id: 'cu',   label: 'CU – Conceptual Understanding', inputs: [{ key: 'cu1', label: 'CU1 – Main Idea (0–10)', min: 0, max: 10, step: 0.5 }, { key: 'cu2', label: 'CU2 – Cause-Effect (0–10)', min: 0, max: 10, step: 0.5 }, { key: 'cu3', label: 'CU3 – Application (0–10)', min: 0, max: 10, step: 0.5 }] },
                      ];

                      const runCalc = () => {
                        const g = (k: string) => parseFloat(calcInputs[k] || '0');
                        let result: any = {};
                        if (calcModule === 'les') {
                          const les = ((g('raw') - 7) / 28) * 100;
                          const mmi = ((g('mmi_raw') - 7) / 28) * 100;
                          const mci = ((g('mci_raw') - 7) / 28) * 100;
                          const pattern = mmi > 70 && mci < 50 ? 'Aware but Passive' : mmi > 60 && mci > 60 ? 'Balanced Self-Regulated' : mmi < 50 && mci > 60 ? 'Regulated without Awareness' : 'Developing';
                          const band = les < 40 ? 'Developing' : les < 60 ? 'Emerging' : les < 75 ? 'Proficient' : les < 90 ? 'Advanced' : 'Exceptional';
                          result = { 'LES%': les.toFixed(1), 'MMI%': mmi.toFixed(1), 'MCI%': mci.toFixed(1), 'Pattern': pattern, 'Performance Band': band };
                        } else if (calcModule === 'att') {
                          const ati = (g('stability') * 0.6) + (g('sr_avg') * 8);
                          const fatigue = (g('h1_acc') - g('h2_acc')) > 15 ? 'YES — Fatigue Sensitivity Detected' : 'No fatigue pattern';
                          const band = ati < 30 ? 'Very Low' : ati < 50 ? 'Low' : ati < 65 ? 'Moderate' : ati < 80 ? 'High' : 'Very High';
                          result = { 'ATI Score': ati.toFixed(2), 'Performance Band': band, 'Fatigue Sensitivity': fatigue, 'Stability Contribution': (g('stability') * 0.6).toFixed(3), 'SR Contribution': (g('sr_avg') * 8).toFixed(2) };
                        } else if (calcModule === 'mem') {
                          const mem = (0.4 * g('enc')) + (0.4 * g('rec')) + (0.2 * g('dr'));
                          const band = mem < 40 ? 'Weak' : mem < 55 ? 'Developing' : mem < 70 ? 'Functional' : mem < 85 ? 'Strong' : 'Exceptional';
                          const flag = g('rec') > 80 && g('dr') < 40 ? 'Confusion Risk — high recognition but low distortion resistance' : g('enc') < 40 && g('rec') < 40 ? 'Consolidation Gap detected' : 'No memory pattern flags';
                          result = { 'MEM%': mem.toFixed(1), 'Performance Band': band, 'Flag': flag, 'Encoding (40%)': (0.4 * g('enc')).toFixed(1), 'Recognition (40%)': (0.4 * g('rec')).toFixed(1), 'Distortion Res. (20%)': (0.2 * g('dr')).toFixed(1) };
                        } else if (calcModule === 'cu') {
                          const cu = (g('cu1') + g('cu2') + g('cu3')) / 3;
                          const band = cu < 4 ? 'Below Basic' : cu < 6 ? 'Basic' : cu < 7.5 ? 'Developing' : cu < 9 ? 'Proficient' : 'Advanced';
                          result = { 'CU Score': cu.toFixed(2), 'CU1 Main Idea': g('cu1').toFixed(1), 'CU2 Cause-Effect': g('cu2').toFixed(1), 'CU3 Application': g('cu3').toFixed(1), 'Performance Band': band };
                        }
                        setCalcResult(result);
                      };

                      const activeModule = modules.find(m => m.id === calcModule) || modules[0];

                      return (
                        <div className="max-w-3xl space-y-5">
                          <div>
                            <h3 className="text-base font-semibold text-gray-800">Live Score Calculator</h3>
                            <p className="text-sm text-gray-500">Enter raw values to verify exactly what the scoring engine will output. Matches production backend formulas.</p>
                          </div>

                          {/* Module selector */}
                          <Card>
                            <CardContent className="pt-4">
                              <div className="flex flex-wrap gap-2 mb-5">
                                {modules.map(m => (
                                  <button
                                    key={m.id}
                                    onClick={() => { setCalcModule(m.id); setCalcInputs({}); setCalcResult(null); }}
                                    className={\`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all \${calcModule === m.id ? 'text-white border-transparent' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'}\`}
                                    style={calcModule === m.id ? { backgroundColor: BRAND.primary } : {}}
                                  >
                                    {m.label}
                                  </button>
                                ))}
                              </div>

                              {/* Inputs */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                                {activeModule.inputs.map(inp => (
                                  <div key={inp.key}>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">{inp.label}</label>
                                    <input
                                      type="number"
                                      min={inp.min}
                                      max={inp.max}
                                      step={(inp as any).step || 1}
                                      value={calcInputs[inp.key] || ''}
                                      onChange={e => setCalcInputs(p => ({ ...p, [inp.key]: e.target.value }))}
                                      placeholder={\`\${inp.min}–\${inp.max}\`}
                                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                                      style={{ '--tw-ring-color': BRAND.primary } as React.CSSProperties}
                                    />
                                    <p className="text-[10px] text-gray-400 mt-0.5">Range: {inp.min} – {inp.max}</p>
                                  </div>
                                ))}
                              </div>

                              <Button onClick={runCalc} style={{ backgroundColor: BRAND.primary }} className="text-white gap-2">
                                <Calculator className="h-4 w-4" /> Calculate Score
                              </Button>
                            </CardContent>
                          </Card>

                          {/* Results */}
                          {calcResult && (
                            <Card className="border-green-200 bg-green-50">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-green-800 flex items-center gap-2">
                                  <CheckCircle className="h-4 w-4" /> Calculation Result — {activeModule.label}
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                  {Object.entries(calcResult).map(([k, v]) => (
                                    <div key={k} className="bg-white rounded-lg border border-green-200 px-3 py-2">
                                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{k}</p>
                                      <p className="text-sm font-bold text-gray-900 mt-0.5">{String(v)}</p>
                                    </div>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      );
                    })()}

                  </div>
                </div>
              )}

`;

// ── 5. Insert before the Pricing tab ─────────────────────────────────────────
const ANCHOR = "              {/* Pricing & Packages Tab */}\n              {activeTab === 'pricing' && (";
const idx = src.indexOf(ANCHOR);
if (idx === -1) {
  console.error('ERROR: Anchor not found — check the pricing tab comment');
  process.exit(1);
}
src = src.slice(0, idx) + SCORING_SECTION + src.slice(idx);

writeFileSync(filePath, src);
console.log('✓ Calculation & Norms Engine injected into SuperAdminDashboard.tsx');
