import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Brain, Sparkles, BookOpen, Target, Clock, CheckCircle, AlertCircle, Loader2, Play, Save, ArrowRight, FileText, Zap, GraduationCap, Lightbulb, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { apiRequest } from '@/lib/queryClient';

const BRAND = {
  primary: '#0B3C5D',
  accent: '#4ECDC4',
};

interface Child {
  id: string;
  name: string;
  age: number;
  grade: string;
  weakSubjects?: string[];
  favoriteSubjects?: string[];
  educationBoard?: string;
}

interface GeneratedQuestion {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  explanation: string;
  difficulty: string;
  bloomsLevel: string;
  topic: string;
}

interface AITestResult {
  title: string;
  subject: string;
  description: string;
  questions: GeneratedQuestion[];
  estimatedDuration: number;
  totalMarks: number;
  passingMarks: number;
  generatedAt: string;
  personalizationNotes: string;
}

interface ScoreResult {
  totalQuestions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  score: number;
  percentage: number;
  passed: boolean;
  questionResults: {
    questionIndex: number;
    questionText: string;
    userAnswer: string | null;
    correctAnswer: string;
    isCorrect: boolean;
    explanation: string;
  }[];
  weakTopics: string[];
  strongTopics: string[];
  recommendations: string[];
}

interface Props {
  child: Child;
  onClose?: () => void;
}

const SUBJECTS_WITH_CHAPTERS: Record<string, { chapters: string[], topics: Record<string, string[]> }> = {
  'Mathematics': {
    chapters: ['Number Systems', 'Polynomials', 'Coordinate Geometry', 'Linear Equations', 'Quadratic Equations', 'Triangles', 'Circles', 'Surface Areas & Volumes', 'Statistics', 'Probability', 'Trigonometry', 'Mensuration'],
    topics: {
      'Number Systems': ['Real Numbers', 'Irrational Numbers', 'Rational Numbers', 'Laws of Exponents'],
      'Polynomials': ['Factorization', 'Zeros of Polynomial', 'Remainder Theorem', 'Factor Theorem'],
      'Quadratic Equations': ['Roots', 'Discriminant', 'Nature of Roots', 'Word Problems'],
      'Triangles': ['Similarity', 'Congruence', 'Pythagoras Theorem', 'Area of Triangle'],
      'Trigonometry': ['Ratios', 'Identities', 'Heights & Distances', 'Applications'],
    }
  },
  'Science': {
    chapters: ['Chemical Reactions', 'Acids Bases Salts', 'Metals and Non-metals', 'Life Processes', 'Control and Coordination', 'Heredity', 'Light', 'Electricity', 'Magnetic Effects', 'Sources of Energy'],
    topics: {
      'Chemical Reactions': ['Types of Reactions', 'Balancing Equations', 'Oxidation Reduction'],
      'Life Processes': ['Nutrition', 'Respiration', 'Transportation', 'Excretion'],
      'Light': ['Reflection', 'Refraction', 'Lenses', 'Human Eye'],
      'Electricity': ['Ohm\'s Law', 'Resistance', 'Power', 'Circuits'],
    }
  },
  'Physics': {
    chapters: ['Motion', 'Force and Laws of Motion', 'Gravitation', 'Work and Energy', 'Sound', 'Light', 'Electricity', 'Magnetism', 'Waves', 'Modern Physics'],
    topics: {
      'Motion': ['Speed', 'Velocity', 'Acceleration', 'Equations of Motion', 'Graphs'],
      'Force and Laws of Motion': ['Newton\'s Laws', 'Momentum', 'Friction', 'Circular Motion'],
      'Electricity': ['Current', 'Resistance', 'Ohm\'s Law', 'Power', 'Circuits'],
    }
  },
  'Chemistry': {
    chapters: ['Chemical Bonding', 'Periodic Table', 'Chemical Reactions', 'Acids Bases Salts', 'Metals', 'Carbon Compounds', 'Organic Chemistry', 'Electrochemistry'],
    topics: {
      'Chemical Bonding': ['Ionic Bonds', 'Covalent Bonds', 'Metallic Bonds', 'VSEPR Theory'],
      'Organic Chemistry': ['Hydrocarbons', 'Functional Groups', 'Isomerism', 'Reactions'],
    }
  },
  'Biology': {
    chapters: ['Cell Biology', 'Genetics', 'Evolution', 'Ecology', 'Human Physiology', 'Plant Physiology', 'Reproduction', 'Biotechnology'],
    topics: {
      'Cell Biology': ['Cell Structure', 'Cell Division', 'Cell Organelles', 'Transport'],
      'Genetics': ['DNA', 'Inheritance', 'Mutations', 'Genetic Disorders'],
      'Human Physiology': ['Digestion', 'Respiration', 'Circulation', 'Excretion', 'Nervous System'],
    }
  },
  'English': {
    chapters: ['Grammar', 'Comprehension', 'Writing Skills', 'Literature', 'Vocabulary'],
    topics: {
      'Grammar': ['Tenses', 'Voice', 'Narration', 'Articles', 'Prepositions', 'Subject-Verb Agreement'],
      'Writing Skills': ['Essay Writing', 'Letter Writing', 'Report Writing', 'Notices'],
    }
  },
  'Hindi': {
    chapters: ['व्याकरण', 'गद्य', 'पद्य', 'लेखन कौशल', 'अपठित गद्यांश'],
    topics: {}
  },
  'Social Studies': {
    chapters: ['History', 'Geography', 'Civics', 'Economics'],
    topics: {
      'History': ['Ancient India', 'Medieval India', 'Modern India', 'World History'],
      'Geography': ['Physical Geography', 'Human Geography', 'Maps', 'Climate'],
      'Civics': ['Constitution', 'Democracy', 'Rights', 'Government'],
    }
  },
  'History': {
    chapters: ['Ancient Civilizations', 'Medieval Period', 'Modern History', 'Indian National Movement', 'World Wars', 'Post-Independence India'],
    topics: {}
  },
  'Geography': {
    chapters: ['Physical Geography', 'Human Geography', 'Resources', 'Agriculture', 'Industries', 'Transport', 'Maps and Mapping'],
    topics: {}
  },
  'Computer Science': {
    chapters: ['Programming Basics', 'Data Structures', 'Databases', 'Networking', 'Web Development', 'Python', 'Java'],
    topics: {
      'Programming Basics': ['Variables', 'Loops', 'Conditionals', 'Functions', 'Arrays'],
      'Python': ['Syntax', 'Data Types', 'Functions', 'OOP', 'File Handling'],
    }
  },
  'Economics': {
    chapters: ['Microeconomics', 'Macroeconomics', 'Indian Economy', 'Statistics', 'Development'],
    topics: {}
  },
  'Accountancy': {
    chapters: ['Accounting Basics', 'Journal Entries', 'Ledger', 'Trial Balance', 'Financial Statements', 'Partnership Accounts', 'Company Accounts'],
    topics: {}
  },
  'Business Studies': {
    chapters: ['Nature of Business', 'Business Environment', 'Planning', 'Organizing', 'Marketing', 'Financial Management'],
    topics: {}
  },
};

const SUBJECTS = Object.keys(SUBJECTS_WITH_CHAPTERS);

const TEST_PRESETS = [
  { id: 'quick', name: 'Quick Practice', questions: 5, difficulty: 'medium' as const, icon: Zap, desc: '5 mins • Focus on basics', color: '#4ECDC4' },
  { id: 'chapter', name: 'Chapter Test', questions: 15, difficulty: 'mixed' as const, icon: BookOpen, desc: '15-20 mins • Comprehensive', color: '#0B3C5D' },
  { id: 'revision', name: 'Full Revision', questions: 25, difficulty: 'mixed' as const, icon: GraduationCap, desc: '30 mins • Exam prep', color: '#0B3C5D' },
  { id: 'custom', name: 'Custom Test', questions: 10, difficulty: 'medium' as const, icon: Settings2, desc: 'Configure everything', color: '#6B7280' },
];

const BLOOMS_LEVELS = [
  { id: 'remember', name: 'Remember', desc: 'Recall facts and basic concepts' },
  { id: 'understand', name: 'Understand', desc: 'Explain ideas or concepts' },
  { id: 'apply', name: 'Apply', desc: 'Use information in new situations' },
  { id: 'analyze', name: 'Analyze', desc: 'Draw connections among ideas' },
  { id: 'mixed', name: 'Mixed (Recommended)', desc: 'Blend of all levels' },
];

export function AITestGenerator({ child, onClose }: Props) {
  const [step, setStep] = useState<'config' | 'preview' | 'test' | 'results'>('config');
  const [selectedPreset, setSelectedPreset] = useState<string>('chapter');
  const [config, setConfig] = useState({
    subject: child.weakSubjects?.[0] || '',
    chapter: '',
    topic: '',
    questionCount: '15',
    difficulty: 'mixed' as 'easy' | 'medium' | 'hard' | 'mixed',
    bloomsLevel: 'mixed',
    includeExplanations: true,
    focusOnWeakAreas: true,
    timeLimit: 20,
  });
  const [generatedTest, setGeneratedTest] = useState<AITestResult | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);

  const availableChapters = config.subject ? SUBJECTS_WITH_CHAPTERS[config.subject]?.chapters || [] : [];
  const availableTopics = config.subject && config.chapter ? SUBJECTS_WITH_CHAPTERS[config.subject]?.topics?.[config.chapter] || [] : [];

  useEffect(() => {
    const preset = TEST_PRESETS.find(p => p.id === selectedPreset);
    if (preset && selectedPreset !== 'custom') {
      setConfig(prev => ({
        ...prev,
        questionCount: String(preset.questions),
        difficulty: preset.difficulty,
      }));
    }
  }, [selectedPreset]);

  useEffect(() => {
    setConfig(prev => ({ ...prev, chapter: '', topic: '' }));
  }, [config.subject]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const normalizeValue = (val: string) => (!val || val === 'all') ? undefined : val;
      const response = await apiRequest('POST', '/api/ai-tests/generate', {
        childId: child.id,
        subject: config.subject,
        chapter: normalizeValue(config.chapter),
        topic: normalizeValue(config.topic),
        questionCount: parseInt(config.questionCount),
        difficulty: config.difficulty,
        bloomsLevel: config.bloomsLevel,
        includeExplanations: config.includeExplanations,
        focusOnWeakAreas: config.focusOnWeakAreas,
        timeLimit: config.timeLimit,
      });
      return response.json();
    },
    onSuccess: (data: AITestResult) => {
      setGeneratedTest(data);
      setStep('preview');
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/ai-tests/save', {
        title: generatedTest?.title,
        subject: generatedTest?.subject,
        description: generatedTest?.description,
        questions: generatedTest?.questions,
        duration: generatedTest?.estimatedDuration,
        totalMarks: generatedTest?.totalMarks,
        passingMarks: generatedTest?.passingMarks,
        childId: child.id,
      });
      return response.json();
    },
  });

  const scoreMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/ai-tests/score', {
        questions: generatedTest?.questions,
        answers,
        childId: child.id,
        subject: generatedTest?.subject,
      });
      return response.json();
    },
    onSuccess: (data: ScoreResult) => {
      setScoreResult(data);
      setStep('results');
    },
  });

  const handleGenerate = () => {
    if (!config.subject) return;
    generateMutation.mutate();
  };

  const handleStartTest = () => {
    setCurrentQuestion(0);
    setAnswers({});
    setStep('test');
  };

  const handleAnswer = (option: string) => {
    setAnswers(prev => ({ ...prev, [currentQuestion]: option }));
  };

  const handleSubmitTest = () => {
    scoreMutation.mutate();
  };

  const handleSaveAndAssign = async () => {
    await saveMutation.mutateAsync();
    onClose?.();
  };

  if (step === 'config') {
    const estimatedTime = Math.ceil(parseInt(config.questionCount) * 1.5);
    
    return (
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}20` }}>
              <Sparkles size={24} style={{ color: BRAND.accent }} />
            </div>
            <div className="flex-1">
              <CardTitle style={{ color: BRAND.primary }}>AI Test Generator</CardTitle>
              <CardDescription>Create personalized practice tests for {child.name} ({child.grade})</CardDescription>
            </div>
            {child.educationBoard && (
              <Badge variant="outline" className="text-xs">{child.educationBoard}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Smart Recommendations Banner */}
          <div className="p-4 rounded-xl border-2" style={{ backgroundColor: `${BRAND.primary}08`, borderColor: `${BRAND.primary}15` }}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.accent}20` }}>
                <Lightbulb size={20} style={{ color: BRAND.accent }} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm mb-1" style={{ color: BRAND.primary }}>Smart Recommendations for {child.name}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {child.weakSubjects?.slice(0, 2).map(subj => (
                    <button
                      key={subj}
                      onClick={() => setConfig(p => ({ ...p, subject: subj }))}
                      className="px-3 py-1 rounded-full text-xs font-medium border-2 transition-all hover:scale-105"
                      style={{ 
                        backgroundColor: config.subject === subj ? BRAND.accent : 'white',
                        borderColor: BRAND.accent,
                        color: config.subject === subj ? 'white' : BRAND.accent
                      }}
                    >
                      Focus: {subj}
                    </button>
                  ))}
                  {(!child.weakSubjects || child.weakSubjects.length === 0) && (
                    <span className="text-xs text-gray-500">Complete a behavioral assessment to get personalized recommendations</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Preset Selection */}
          <div>
            <Label className="text-sm font-semibold mb-3 block" style={{ color: BRAND.primary }}>Choose Test Type</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {TEST_PRESETS.map(preset => {
                const Icon = preset.icon;
                const isSelected = selectedPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => setSelectedPreset(preset.id)}
                    className={`p-4 rounded-xl border-2 text-left transition-all hover:scale-[1.02] ${isSelected ? 'shadow-lg' : ''}`}
                    style={{ 
                      backgroundColor: isSelected ? `${preset.color}10` : 'white',
                      borderColor: isSelected ? preset.color : '#e5e7eb'
                    }}
                    data-testid={`preset-${preset.id}`}
                  >
                    <Icon size={24} style={{ color: preset.color }} className="mb-2" />
                    <p className="font-semibold text-sm" style={{ color: isSelected ? preset.color : '#374151' }}>{preset.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{preset.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subject Selection with Weak Subject Highlighting */}
          <div>
            <Label className="text-sm font-semibold" style={{ color: BRAND.primary }}>Subject *</Label>
            <Select value={config.subject} onValueChange={(v) => setConfig(p => ({ ...p, subject: v }))}>
              <SelectTrigger data-testid="select-subject" className="mt-1.5">
                <SelectValue placeholder="Select subject to practice" />
              </SelectTrigger>
              <SelectContent>
                {child.weakSubjects && child.weakSubjects.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-amber-600 bg-amber-50">Needs Practice</div>
                    {child.weakSubjects.filter(s => SUBJECTS.includes(s)).map(s => (
                      <SelectItem key={`weak-${s}`} value={s}>
                        <div className="flex items-center gap-2">
                          <Target size={14} className="text-amber-500" />
                          {s}
                        </div>
                      </SelectItem>
                    ))}
                    <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 mt-1">All Subjects</div>
                  </>
                )}
                {SUBJECTS.filter(s => !child.weakSubjects?.includes(s)).map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Chapter & Topic - Auto-populated based on subject */}
          {config.subject && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-semibold" style={{ color: BRAND.primary }}>Chapter</Label>
                <Select value={config.chapter} onValueChange={(v) => setConfig(p => ({ ...p, chapter: v, topic: '' }))}>
                  <SelectTrigger className="mt-1.5" data-testid="select-chapter">
                    <SelectValue placeholder="All chapters" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Chapters</SelectItem>
                    {availableChapters.map(ch => (
                      <SelectItem key={ch} value={ch}>{ch}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-semibold" style={{ color: BRAND.primary }}>Topic</Label>
                <Select 
                  value={config.topic} 
                  onValueChange={(v) => setConfig(p => ({ ...p, topic: v }))}
                  disabled={!config.chapter || config.chapter === 'all' || availableTopics.length === 0}
                >
                  <SelectTrigger className="mt-1.5" data-testid="select-topic">
                    <SelectValue placeholder={availableTopics.length > 0 ? "Select topic" : "All topics"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Topics</SelectItem>
                    {availableTopics.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Advanced Options (shown for Custom preset) */}
          {selectedPreset === 'custom' && (
            <div className="p-4 rounded-xl border bg-gray-50 space-y-4">
              <p className="text-sm font-semibold" style={{ color: BRAND.primary }}>Advanced Options</p>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Number of Questions</Label>
                  <Select value={config.questionCount} onValueChange={(v) => setConfig(p => ({ ...p, questionCount: v }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['5', '10', '15', '20', '25', '30'].map(n => (
                        <SelectItem key={n} value={n}>{n} questions</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Difficulty Level</Label>
                  <Select value={config.difficulty} onValueChange={(v: any) => setConfig(p => ({ ...p, difficulty: v }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy - Foundation</SelectItem>
                      <SelectItem value="medium">Medium - Standard</SelectItem>
                      <SelectItem value="hard">Hard - Challenge</SelectItem>
                      <SelectItem value="mixed">Mixed (Recommended)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs">Cognitive Level (Bloom's Taxonomy)</Label>
                <Select value={config.bloomsLevel} onValueChange={(v) => setConfig(p => ({ ...p, bloomsLevel: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BLOOMS_LEVELS.map(level => (
                      <SelectItem key={level.id} value={level.id}>
                        <div>
                          <span className="font-medium">{level.name}</span>
                          <span className="text-xs text-gray-500 ml-2">- {level.desc}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={config.focusOnWeakAreas} 
                    onCheckedChange={(v) => setConfig(p => ({ ...p, focusOnWeakAreas: v }))}
                  />
                  <Label className="text-xs">Focus on weak areas from LBI</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={config.includeExplanations} 
                    onCheckedChange={(v) => setConfig(p => ({ ...p, includeExplanations: v }))}
                  />
                  <Label className="text-xs">Include explanations</Label>
                </div>
              </div>
            </div>
          )}

          {/* Test Summary */}
          <div className="p-4 rounded-xl border-2 border-dashed" style={{ borderColor: `${BRAND.accent}40` }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold" style={{ color: BRAND.primary }}>{config.questionCount}</p>
                  <p className="text-xs text-gray-500">Questions</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold" style={{ color: BRAND.accent }}>~{estimatedTime}</p>
                  <p className="text-xs text-gray-500">Minutes</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold capitalize" style={{ color: config.difficulty === 'hard' ? '#ef4444' : config.difficulty === 'easy' ? '#4ECDC4' : BRAND.primary }}>
                    {config.difficulty}
                  </p>
                  <p className="text-xs text-gray-500">Difficulty</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-gray-400" />
                <span className="text-sm text-gray-600">Est. {estimatedTime} mins</span>
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <div className="flex gap-3 pt-2">
            <Button
              className="flex-1 font-semibold h-12 text-base"
              style={{ backgroundColor: BRAND.accent }}
              onClick={handleGenerate}
              disabled={!config.subject || generateMutation.isPending}
              data-testid="btn-generate-test"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={20} />
                  Generating Personalized Test...
                </>
              ) : (
                <>
                  <Sparkles size={20} className="mr-2" />
                  Generate AI Test
                </>
              )}
            </Button>
            {onClose && (
              <Button variant="outline" onClick={onClose} className="h-12">Cancel</Button>
            )}
          </div>

          {generateMutation.isError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              Failed to generate test. Please try again.
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (step === 'preview' && generatedTest) {
    return (
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle style={{ color: BRAND.primary }}>{generatedTest.title}</CardTitle>
              <CardDescription>{generatedTest.description}</CardDescription>
            </div>
            <Badge style={{ backgroundColor: `${BRAND.accent}20`, color: BRAND.accent }}>
              AI Generated
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="p-3 rounded-lg text-center" style={{ backgroundColor: `${BRAND.primary}10` }}>
              <FileText size={20} className="mx-auto mb-1" style={{ color: BRAND.primary }} />
              <div className="text-lg font-bold" style={{ color: BRAND.primary }}>{generatedTest.questions.length}</div>
              <div className="text-xs text-gray-500">Questions</div>
            </div>
            <div className="p-3 rounded-lg text-center" style={{ backgroundColor: `${BRAND.accent}10` }}>
              <Clock size={20} className="mx-auto mb-1" style={{ color: BRAND.accent }} />
              <div className="text-lg font-bold" style={{ color: BRAND.accent }}>{generatedTest.estimatedDuration}</div>
              <div className="text-xs text-gray-500">Minutes</div>
            </div>
            <div className="p-3 rounded-lg text-center bg-teal-50">
              <Target size={20} className="mx-auto mb-1 text-teal-600" />
              <div className="text-lg font-bold text-teal-600">{generatedTest.totalMarks}</div>
              <div className="text-xs text-gray-500">Total Marks</div>
            </div>
            <div className="p-3 rounded-lg text-center bg-amber-50">
              <CheckCircle size={20} className="mx-auto mb-1 text-amber-600" />
              <div className="text-lg font-bold text-amber-600">{generatedTest.passingMarks}</div>
              <div className="text-xs text-gray-500">Pass Marks</div>
            </div>
          </div>

          {generatedTest.personalizationNotes && (
            <div className="p-3 rounded-lg border" style={{ backgroundColor: `${BRAND.primary}05`, borderColor: `${BRAND.primary}20` }}>
              <div className="flex items-start gap-2 text-sm">
                <Brain size={16} className="mt-0.5" style={{ color: BRAND.primary }} />
                <div>
                  <div className="font-medium mb-1" style={{ color: BRAND.primary }}>Personalization</div>
                  <p className="text-gray-600">{generatedTest.personalizationNotes}</p>
                </div>
              </div>
            </div>
          )}

          <div className="border rounded-lg overflow-hidden">
            <div className="p-3 border-b bg-gray-50 font-medium text-sm" style={{ color: BRAND.primary }}>
              Question Preview (First 3)
            </div>
            <div className="divide-y max-h-60 overflow-y-auto">
              {generatedTest.questions.slice(0, 3).map((q, idx) => (
                <div key={idx} className="p-3">
                  <div className="flex items-start gap-2">
                    <span className="font-medium text-gray-400">{idx + 1}.</span>
                    <div>
                      <p className="text-sm text-gray-700">{q.questionText}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{q.difficulty}</Badge>
                        <Badge variant="outline" className="text-xs">{q.bloomsLevel}</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              className="flex-1 font-semibold"
              style={{ backgroundColor: BRAND.accent }}
              onClick={handleStartTest}
              data-testid="btn-start-test"
            >
              <Play size={18} className="mr-2" />
              Start Test Now
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleSaveAndAssign}
              disabled={saveMutation.isPending}
              data-testid="btn-save-assign"
            >
              {saveMutation.isPending ? <Loader2 className="animate-spin mr-2" size={18} /> : <Save size={18} className="mr-2" />}
              Save & Assign for Later
            </Button>
          </div>
          <Button variant="ghost" className="w-full" onClick={() => setStep('config')}>
            ← Back to Configuration
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === 'test' && generatedTest) {
    const question = generatedTest.questions[currentQuestion];
    const progress = ((currentQuestion + 1) / generatedTest.questions.length) * 100;

    return (
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg" style={{ color: BRAND.primary }}>
              Question {currentQuestion + 1} of {generatedTest.questions.length}
            </CardTitle>
            <Badge style={{ backgroundColor: `${BRAND.primary}15`, color: BRAND.primary }}>
              {question.difficulty}
            </Badge>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-2">
            <div 
              className="h-full transition-all duration-300" 
              style={{ width: `${progress}%`, backgroundColor: BRAND.accent }}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-800 font-medium">{question.questionText}</p>

          <RadioGroup
            value={answers[currentQuestion] || ''}
            onValueChange={handleAnswer}
            className="space-y-2"
          >
            {['A', 'B', 'C', 'D'].map((opt) => (
              <div
                key={opt}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  answers[currentQuestion] === opt 
                    ? 'border-2' 
                    : 'hover:bg-gray-50'
                }`}
                style={answers[currentQuestion] === opt ? { borderColor: BRAND.accent, backgroundColor: `${BRAND.accent}10` } : {}}
                onClick={() => handleAnswer(opt)}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value={opt} id={`opt-${opt}`} />
                  <Label htmlFor={`opt-${opt}`} className="flex-1 cursor-pointer">
                    <span className="font-medium mr-2">{opt}.</span>
                    {(question as any)[`option${opt}`]}
                  </Label>
                </div>
              </div>
            ))}
          </RadioGroup>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setCurrentQuestion(c => c - 1)}
              disabled={currentQuestion === 0}
            >
              Previous
            </Button>
            <div className="flex-1" />
            {currentQuestion < generatedTest.questions.length - 1 ? (
              <Button
                style={{ backgroundColor: BRAND.primary }}
                onClick={() => setCurrentQuestion(c => c + 1)}
              >
                Next <ArrowRight size={16} className="ml-1" />
              </Button>
            ) : (
              <Button
                style={{ backgroundColor: BRAND.accent }}
                onClick={handleSubmitTest}
                disabled={scoreMutation.isPending}
                data-testid="btn-submit-test"
              >
                {scoreMutation.isPending ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                Submit Test
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'results' && scoreResult) {
    return (
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-4 text-center">
          <div className={`w-20 h-20 rounded-full mx-auto mb-3 flex items-center justify-center ${scoreResult.passed ? 'bg-teal-100' : 'bg-red-100'}`}>
            <span className={`text-3xl font-bold ${scoreResult.passed ? 'text-teal-600' : 'text-red-600'}`}>
              {scoreResult.percentage}%
            </span>
          </div>
          <CardTitle className={scoreResult.passed ? 'text-teal-600' : 'text-red-600'}>
            {scoreResult.passed ? 'Congratulations!' : 'Keep Practicing!'}
          </CardTitle>
          <CardDescription>
            {scoreResult.correct} out of {scoreResult.totalQuestions} correct
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-2 text-center text-sm">
            <div className="p-2 rounded bg-teal-50">
              <div className="text-lg font-bold text-teal-600">{scoreResult.correct}</div>
              <div className="text-xs text-gray-500">Correct</div>
            </div>
            <div className="p-2 rounded bg-red-50">
              <div className="text-lg font-bold text-red-600">{scoreResult.incorrect}</div>
              <div className="text-xs text-gray-500">Incorrect</div>
            </div>
            <div className="p-2 rounded bg-gray-50">
              <div className="text-lg font-bold text-gray-600">{scoreResult.totalQuestions - scoreResult.attempted}</div>
              <div className="text-xs text-gray-500">Skipped</div>
            </div>
            <div className="p-2 rounded" style={{ backgroundColor: `${BRAND.primary}10` }}>
              <div className="text-lg font-bold" style={{ color: BRAND.primary }}>{scoreResult.score}/{scoreResult.totalQuestions}</div>
              <div className="text-xs text-gray-500">Score</div>
            </div>
          </div>

          {scoreResult.weakTopics.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
              <div className="font-medium text-amber-800 text-sm mb-1">Areas to Improve</div>
              <div className="flex flex-wrap gap-1">
                {scoreResult.weakTopics.map((t, i) => (
                  <Badge key={i} variant="outline" className="text-amber-700 border-amber-300">{t}</Badge>
                ))}
              </div>
            </div>
          )}

          {scoreResult.strongTopics.length > 0 && (
            <div className="p-3 rounded-lg bg-teal-50 border border-teal-200">
              <div className="font-medium text-teal-800 text-sm mb-1">Strong Areas</div>
              <div className="flex flex-wrap gap-1">
                {scoreResult.strongTopics.map((t, i) => (
                  <Badge key={i} variant="outline" className="text-teal-700 border-teal-300">{t}</Badge>
                ))}
              </div>
            </div>
          )}

          {scoreResult.recommendations.length > 0 && (
            <div className="p-3 rounded-lg border" style={{ backgroundColor: `${BRAND.primary}05`, borderColor: `${BRAND.primary}20` }}>
              <div className="font-medium mb-2 flex items-center gap-2" style={{ color: BRAND.primary }}>
                <Zap size={16} />
                AI Recommendations
              </div>
              <ul className="space-y-1 text-sm text-gray-600">
                {scoreResult.recommendations.map((r, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle size={14} className="mt-0.5 text-teal-500 shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setStep('config');
                setGeneratedTest(null);
                setScoreResult(null);
                setAnswers({});
              }}
            >
              Generate New Test
            </Button>
            <Button
              className="flex-1"
              style={{ backgroundColor: BRAND.accent }}
              onClick={onClose}
            >
              Done
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
