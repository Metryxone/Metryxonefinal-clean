import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Brain, 
  TrendingUp, 
  Target, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  BookOpen, 
  Lightbulb,
  BarChart3,
  Zap,
  Heart,
  Shield,
  Users,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Square,
  CheckSquare,
  Sparkles,
  Activity
} from "lucide-react";

interface LBIInsight {
  id?: string;
  studentId?: string;
  category: string;
  metric: string;
  value: number | null;
  description: string | null;
  recordedAt: string | Date;
}

interface StudyTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string;
}

interface AcademicPerformance {
  subject: string;
  avgScore: number;
  completionRate: number;
  trend: 'up' | 'down' | 'stable';
}

interface Props {
  childId: string;
  childName: string;
  insights: LBIInsight[];
  studyTasks: StudyTask[];
  academicData?: AcademicPerformance[];
}

const DOMAIN_SUB_METRICS: Record<string, { name: string; defaultScore: number }[]> = {
  'Discipline': [
    { name: 'Routine Adherence', defaultScore: 65 },
    { name: 'Rule Following', defaultScore: 72 },
    { name: 'Self-Control', defaultScore: 58 }
  ],
  'Emotional Intelligence': [
    { name: 'Self-Awareness', defaultScore: 70 },
    { name: 'Empathy', defaultScore: 75 },
    { name: 'Emotion Regulation', defaultScore: 62 }
  ],
  'Confidence': [
    { name: 'Self-Efficacy', defaultScore: 55 },
    { name: 'Public Speaking', defaultScore: 48 },
    { name: 'Decision Making', defaultScore: 60 }
  ],
  'Social Intelligence': [
    { name: 'Collaboration', defaultScore: 68 },
    { name: 'Communication', defaultScore: 72 },
    { name: 'Conflict Resolution', defaultScore: 55 }
  ],
  'Analytical Thinking': [
    { name: 'Logical Reasoning', defaultScore: 70 },
    { name: 'Pattern Recognition', defaultScore: 65 },
    { name: 'Problem Decomposition', defaultScore: 60 }
  ],
  'Time Management': [
    { name: 'Planning', defaultScore: 58 },
    { name: 'Prioritization', defaultScore: 62 },
    { name: 'Deadline Adherence', defaultScore: 50 }
  ],
  'Focus & Attention': [
    { name: 'Sustained Attention', defaultScore: 55 },
    { name: 'Selective Focus', defaultScore: 60 },
    { name: 'Distraction Resistance', defaultScore: 48 }
  ]
};

const DOMAIN_SUGGESTED_ACTIONS: Record<string, string[]> = {
  'Discipline': [
    'Set a fixed wake-up and study time every day',
    'Use a habit tracker to monitor daily routines',
    'Reward consistency with small incentives'
  ],
  'Emotional Intelligence': [
    'Practice naming emotions during daily check-ins',
    'Try journaling about feelings after school',
    'Role-play social scenarios to build empathy'
  ],
  'Confidence': [
    'Start with tasks that build quick wins',
    'Encourage presenting ideas in small group settings',
    'Celebrate effort and improvement, not just results'
  ],
  'Social Intelligence': [
    'Join a team-based extracurricular activity',
    'Practice active listening exercises at home',
    'Discuss different perspectives on everyday situations'
  ],
  'Analytical Thinking': [
    'Practice problem-solving exercises daily (15 min)',
    'Play logic-based games like Sudoku or chess',
    'Break complex homework into smaller steps'
  ],
  'Time Management': [
    'Use a visual planner or calendar for weekly tasks',
    'Practice the Pomodoro technique (25 min focus blocks)',
    'Review and plan the next day every evening'
  ],
  'Focus & Attention': [
    'Try mindfulness exercises before study sessions',
    'Remove phone and distractions during study time',
    'Take short breaks every 30 minutes to reset focus'
  ]
};

const DOMAIN_TRENDS: Record<string, 'up' | 'down' | 'stable'> = {
  'Discipline': 'up',
  'Emotional Intelligence': 'stable',
  'Confidence': 'up',
  'Social Intelligence': 'stable',
  'Analytical Thinking': 'up',
  'Time Management': 'down',
  'Focus & Attention': 'stable'
};

const LBI_CATEGORIES = {
  'Discipline': { icon: Shield, color: '#0B3C5D', bg: 'rgba(11, 60, 93, 0.06)' },
  'Emotional Intelligence': { icon: Heart, color: '#4ECDC4', bg: 'rgba(78, 205, 196, 0.06)' },
  'Confidence': { icon: Award, color: '#0B3C5D', bg: 'rgba(11, 60, 93, 0.06)' },
  'Social Intelligence': { icon: Users, color: '#4ECDC4', bg: 'rgba(78, 205, 196, 0.06)' },
  'Analytical Thinking': { icon: Brain, color: '#0B3C5D', bg: 'rgba(11, 60, 93, 0.06)' },
  'Time Management': { icon: Clock, color: '#4ECDC4', bg: 'rgba(78, 205, 196, 0.06)' },
  'Focus & Attention': { icon: Target, color: '#0B3C5D', bg: 'rgba(11, 60, 93, 0.06)' }
};

const PREVIOUS_CYCLE_DELTAS: Record<string, number> = {
  'Discipline': 5,
  'Emotional Intelligence': -2,
  'Confidence': 8,
  'Social Intelligence': 0,
  'Analytical Thinking': 3,
  'Time Management': -4,
  'Focus & Attention': 1
};

function AnimatedRing({ value, size = 80, strokeWidth = 6, color, label, icon: Icon }: { value: number; size?: number; strokeWidth?: number; color: string; label: string; icon: any }) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedValue / 100) * circumference;

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedValue(value), 100);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth={strokeWidth} />
          <circle
            cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)', filter: `drop-shadow(0 0 4px ${color}40)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon size={14} style={{ color, marginBottom: 1 }} />
          <span className="text-sm font-bold" style={{ color, fontFamily: "'Inter', sans-serif" }}>{animatedValue}%</span>
        </div>
      </div>
      <span className="text-[10px] font-semibold text-center leading-tight" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
  );
}

function RadarChart({ data, size = 220 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const [animatedData, setAnimatedData] = useState(data.map(d => ({ ...d, value: 0 })));
  const center = size / 2;
  const maxRadius = size / 2 - 30;
  const levels = [25, 50, 75, 100];

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedData(data), 200);
    return () => clearTimeout(timer);
  }, [data]);

  const getPoint = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / data.length - Math.PI / 2;
    const r = (value / 100) * maxRadius;
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
  };

  const polygonPoints = animatedData.map((d, i) => {
    const p = getPoint(i, d.value);
    return `${p.x},${p.y}`;
  }).join(' ');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
      {levels.map(level => {
        const points = data.map((_, i) => {
          const p = getPoint(i, level);
          return `${p.x},${p.y}`;
        }).join(' ');
        return <polygon key={level} points={points} fill="none" stroke="rgba(11, 60, 93, 0.08)" strokeWidth="1" />;
      })}
      {data.map((_, i) => {
        const p = getPoint(i, 100);
        return <line key={i} x1={center} y1={center} x2={p.x} y2={p.y} stroke="rgba(11, 60, 93, 0.1)" strokeWidth="1" />;
      })}
      <polygon
        points={polygonPoints}
        fill="rgba(78, 205, 196, 0.15)"
        stroke="#4ECDC4"
        strokeWidth="2"
        style={{ transition: 'all 1s cubic-bezier(0.4, 0, 0.2, 1)', filter: 'drop-shadow(0 0 6px rgba(78, 205, 196, 0.3))' }}
      />
      {animatedData.map((d, i) => {
        const p = getPoint(i, d.value);
        return <circle key={i} cx={p.x} cy={p.y} r="4" fill={d.color} stroke="white" strokeWidth="2" style={{ transition: 'all 1s cubic-bezier(0.4, 0, 0.2, 1)', filter: `drop-shadow(0 0 3px ${d.color}60)` }} />;
      })}
      {data.map((d, i) => {
        const p = getPoint(i, 115);
        const shortLabel = d.label.length > 10 ? d.label.substring(0, 9) + '...' : d.label;
        return (
          <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="600" fill="#0B3C5D" fontFamily="Inter, sans-serif">
            {shortLabel}
          </text>
        );
      })}
    </svg>
  );
}

function DomainHeatmap({ domains }: { domains: { name: string; score: number; trend: 'up' | 'down' | 'stable' }[] }) {
  const getHeatColor = (score: number) => {
    if (score >= 80) return { bg: 'rgba(78, 205, 196, 0.25)', border: 'rgba(78, 205, 196, 0.5)', text: '#4ECDC4' };
    if (score >= 65) return { bg: 'rgba(11, 60, 93, 0.15)', border: 'rgba(11, 60, 93, 0.3)', text: '#0B3C5D' };
    if (score >= 50) return { bg: 'rgba(217, 119, 6, 0.12)', border: 'rgba(217, 119, 6, 0.3)', text: '#d97706' };
    return { bg: 'rgba(220, 38, 38, 0.1)', border: 'rgba(220, 38, 38, 0.3)', text: '#dc2626' };
  };

  return (
    <div className="grid grid-cols-4 md:grid-cols-7 gap-1.5" data-testid="domain-heatmap">
      {domains.map((domain) => {
        const heat = getHeatColor(domain.score);
        return (
          <div
            key={domain.name}
            className="rounded-lg p-2 text-center transition-all hover:scale-105 cursor-default"
            style={{ backgroundColor: heat.bg, border: `1px solid ${heat.border}` }}
            title={`${domain.name}: ${domain.score}%`}
            data-testid={`heatmap-${domain.name.replace(/\s+/g, '-').toLowerCase()}`}
          >
            <p className="text-lg font-bold" style={{ color: heat.text, fontFamily: "'Inter', sans-serif" }}>{domain.score}</p>
            <p className="text-[8px] font-semibold uppercase tracking-wide leading-tight mt-0.5" style={{ color: heat.text }}>
              {domain.name.length > 12 ? domain.name.substring(0, 11) + '..' : domain.name}
            </p>
            <div className="mt-1">
              {domain.trend === 'up' && <ArrowUpRight size={10} style={{ color: '#4ECDC4', margin: '0 auto' }} />}
              {domain.trend === 'down' && <ArrowDownRight size={10} style={{ color: '#dc2626', margin: '0 auto' }} />}
              {domain.trend === 'stable' && <Minus size={10} style={{ color: '#d97706', margin: '0 auto' }} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AIInsightBanner({ childName, insights, avgScore }: { childName: string; insights: LBIInsight[]; avgScore: number }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 500);
    return () => clearTimeout(timer);
  }, []);

  const getInsightMessage = () => {
    if (insights.length === 0) {
      return `Start ${childName}'s first LBI assessment to unlock AI-powered behavioral insights and personalized growth recommendations.`;
    }
    const strongAreas = Object.entries(DOMAIN_TRENDS).filter(([_, t]) => t === 'up').map(([k]) => k);
    const weakAreas = Object.entries(DOMAIN_TRENDS).filter(([_, t]) => t === 'down').map(([k]) => k);
    
    if (weakAreas.length > 0 && strongAreas.length > 0) {
      return `${childName} shows strong improvement in ${strongAreas[0]}, but ${weakAreas[0]} needs attention. Focus on building daily habits to strengthen this area.`;
    }
    if (avgScore >= 70) {
      return `Excellent progress! ${childName}'s behavioral profile shows consistent growth across most domains. Keep reinforcing positive habits.`;
    }
    return `${childName}'s behavioral assessment reveals areas for targeted improvement. Review the action plan below for personalized next steps.`;
  };

  return (
    <div
      className="rounded-xl p-4 relative overflow-hidden transition-all duration-700"
      style={{
        backgroundColor: 'rgba(11, 60, 93, 0.04)',
        border: '1px solid rgba(11, 60, 93, 0.12)',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(10px)'
      }}
      data-testid="ai-insight-banner"
    >
      <div className="absolute top-2 right-3 opacity-10">
        <Brain size={48} style={{ color: '#0B3C5D' }} />
      </div>
      <div className="flex items-start gap-3 relative z-10">
        <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(78, 205, 196, 0.15)' }}>
          <Sparkles size={16} style={{ color: '#4ECDC4' }} />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#4ECDC4' }}>AI Behavioral Insight</p>
          <p className="text-xs leading-relaxed" style={{ color: '#0B3C5D' }}>{getInsightMessage()}</p>
        </div>
      </div>
    </div>
  );
}

function PulseTimeline({ milestones }: { milestones: { label: string; date: string; type: 'assessment' | 'milestone' | 'alert' }[] }) {
  return (
    <div className="relative pl-6" data-testid="pulse-timeline">
      <div className="absolute left-[11px] top-2 bottom-2 w-px" style={{ backgroundColor: 'rgba(11, 60, 93, 0.15)' }} />
      {milestones.map((m, idx) => (
        <div key={idx} className="relative flex items-start gap-3 mb-3 last:mb-0" data-testid={`timeline-item-${idx}`}>
          <div className="absolute left-[-13px] top-1.5">
            <div
              className="h-3 w-3 rounded-full border-2"
              style={{
                borderColor: m.type === 'assessment' ? '#4ECDC4' : m.type === 'alert' ? '#d97706' : '#0B3C5D',
                backgroundColor: m.type === 'assessment' ? 'rgba(78, 205, 196, 0.3)' : m.type === 'alert' ? 'rgba(217, 119, 6, 0.3)' : 'rgba(11, 60, 93, 0.3)',
                boxShadow: `0 0 6px ${m.type === 'assessment' ? 'rgba(78, 205, 196, 0.4)' : m.type === 'alert' ? 'rgba(217, 119, 6, 0.4)' : 'rgba(11, 60, 93, 0.4)'}`
              }}
            />
          </div>
          <div className="flex-1 ml-1">
            <p className="text-xs font-medium" style={{ color: '#0B3C5D' }}>{m.label}</p>
            <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{m.date}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function LBIEducationCorrelation({ childId, childName, insights, studyTasks, academicData = [] }: Props) {
  const [correlations, setCorrelations] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [checkedActions, setCheckedActions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    generateCorrelations();
    generateRecommendations();
  }, [insights, studyTasks, academicData]);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const toggleAction = (actionId: string) => {
    setCheckedActions(prev => ({ ...prev, [actionId]: !prev[actionId] }));
  };

  const generateCorrelations = () => {
    const newCorrelations: any[] = [];
    
    const disciplineScore = insights.find(i => i.category === 'Discipline')?.value || 0;
    const emotionalScore = insights.find(i => i.category === 'Emotional Intelligence')?.value || 0;
    const confidenceScore = insights.find(i => i.category === 'Confidence')?.value || 0;
    const analyticalScore = insights.find(i => i.category === 'Analytical Thinking')?.value || 0;

    const completedTasks = studyTasks.filter(t => t.status === 'Completed').length;
    const totalTasks = studyTasks.length;
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    if (disciplineScore >= 70 && completionRate >= 70) {
      newCorrelations.push({
        type: 'positive', lbi: 'Discipline', academic: 'Task Completion',
        insight: 'Strong discipline correlates with high task completion rate', strength: 85
      });
    } else if (disciplineScore < 50 && completionRate < 50) {
      newCorrelations.push({
        type: 'concern', lbi: 'Discipline', academic: 'Task Completion',
        insight: 'Lower discipline may be affecting task completion', strength: 40
      });
    }

    if (confidenceScore >= 60) {
      newCorrelations.push({
        type: 'positive', lbi: 'Confidence', academic: 'Academic Performance',
        insight: 'Good confidence supports academic engagement', strength: confidenceScore
      });
    }

    if (emotionalScore >= 70) {
      newCorrelations.push({
        type: 'positive', lbi: 'Emotional Intelligence', academic: 'Stress Management',
        insight: 'High EQ helps manage exam stress effectively', strength: emotionalScore
      });
    }

    if (analyticalScore >= 65) {
      newCorrelations.push({
        type: 'positive', lbi: 'Analytical Thinking', academic: 'Problem Solving',
        insight: 'Strong analytical skills support STEM subjects', strength: analyticalScore
      });
    }

    setCorrelations(newCorrelations);
  };

  const generateRecommendations = () => {
    const recs: any[] = [];
    
    const disciplineScore = insights.find(i => i.category === 'Discipline')?.value || 50;
    const confidenceScore = insights.find(i => i.category === 'Confidence')?.value || 50;
    const emotionalScore = insights.find(i => i.category === 'Emotional Intelligence')?.value || 50;
    
    const overdueTasks = studyTasks.filter(t => {
      if (!t.dueDate || t.status === 'Completed') return false;
      return new Date(t.dueDate) < new Date();
    }).length;

    if (disciplineScore < 60) {
      recs.push({
        type: 'behavior', priority: 'high', title: 'Build Study Routine',
        description: 'Create a consistent daily study schedule with small, achievable goals',
        impact: 'Improves task completion and reduces procrastination',
        actionItems: ['Set fixed study times', 'Use 25-minute focus sessions', 'Track daily progress']
      });
    }

    if (confidenceScore < 50) {
      recs.push({
        type: 'emotional', priority: 'medium', title: 'Boost Academic Confidence',
        description: 'Start with easier topics to build momentum and celebrate small wins',
        impact: 'Increases willingness to tackle challenging subjects',
        actionItems: ['Review mastered topics', 'Practice with solved examples first', 'Maintain a success journal']
      });
    }

    if (overdueTasks > 2) {
      recs.push({
        type: 'academic', priority: 'high', title: 'Clear Task Backlog',
        description: `${overdueTasks} overdue tasks need attention. Break them into smaller chunks.`,
        impact: 'Reduces stress and improves completion rate',
        actionItems: ['Prioritize by importance', 'Set realistic deadlines', 'Focus on one task at a time']
      });
    }

    if (emotionalScore >= 70 && disciplineScore >= 60) {
      recs.push({
        type: 'growth', priority: 'low', title: 'Ready for Advanced Challenges',
        description: 'Strong emotional and behavioral foundation supports advanced learning',
        impact: 'Can handle competitive exam preparation',
        actionItems: ['Introduce Olympiad prep', 'Try complex problem sets', 'Join study groups']
      });
    }

    setRecommendations(recs);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#4ECDC4';
    if (score >= 60) return '#0B3C5D';
    if (score >= 40) return '#d97706';
    return '#dc2626';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'rgba(22, 163, 74, 0.08)';
    if (score >= 60) return 'rgba(11, 60, 93, 0.08)';
    if (score >= 40) return 'rgba(217, 119, 6, 0.08)';
    return 'rgba(220, 38, 38, 0.08)';
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    if (trend === 'up') return <ArrowUpRight className="h-3.5 w-3.5" style={{ color: '#4ECDC4' }} />;
    if (trend === 'down') return <ArrowDownRight className="h-3.5 w-3.5" style={{ color: '#dc2626' }} />;
    return <Minus className="h-3.5 w-3.5" style={{ color: '#d97706' }} />;
  };

  const getTrendLabel = (trend: 'up' | 'down' | 'stable') => {
    if (trend === 'up') return 'Improving';
    if (trend === 'down') return 'Needs attention';
    return 'Stable';
  };

  const getTrendColor = (trend: 'up' | 'down' | 'stable') => {
    if (trend === 'up') return '#4ECDC4';
    if (trend === 'down') return '#dc2626';
    return '#d97706';
  };

  const groupedInsights = insights.reduce((acc, insight) => {
    if (!acc[insight.category]) {
      acc[insight.category] = [];
    }
    acc[insight.category].push(insight);
    return acc;
  }, {} as Record<string, LBIInsight[]>);

  const avgLBIScore = insights.length > 0 
    ? Math.round(insights.reduce((sum, i) => sum + (i.value || 0), 0) / insights.length) 
    : 0;

  const completedTasks = studyTasks.filter(t => t.status === 'Completed').length;
  const taskCompletionRate = studyTasks.length > 0 
    ? Math.round((completedTasks / studyTasks.length) * 100) 
    : 0;

  const getActionPlanItems = () => {
    const items: { id: string; text: string; category: string }[] = [];
    const weakCategories = Object.entries(groupedInsights)
      .map(([cat, catInsights]) => ({
        category: cat,
        avg: Math.round(catInsights.reduce((s, i) => s + (i.value || 0), 0) / catInsights.length)
      }))
      .filter(c => c.avg < 65)
      .sort((a, b) => a.avg - b.avg);

    weakCategories.forEach(({ category }) => {
      const actions = DOMAIN_SUGGESTED_ACTIONS[category] || [];
      actions.slice(0, 2).forEach((action, i) => {
        items.push({ id: `${category}-${i}`, text: action, category });
      });
    });

    if (items.length === 0) {
      items.push(
        { id: 'default-0', text: 'Review this week\'s learning goals and adjust priorities', category: 'General' },
        { id: 'default-1', text: 'Practice problem-solving exercises daily (15 min)', category: 'General' },
        { id: 'default-2', text: 'Try mindfulness exercises before study sessions', category: 'General' }
      );
    }

    return items;
  };

  const getCycleComparisonData = () => {
    const categories = Object.entries(groupedInsights)
      .map(([cat, catInsights]) => ({
        category: cat,
        currentScore: Math.round(catInsights.reduce((s, i) => s + (i.value || 0), 0) / catInsights.length),
        delta: PREVIOUS_CYCLE_DELTAS[cat] ?? 0
      }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 3);
    return categories;
  };

  const allDomains = Object.keys(LBI_CATEGORIES).map(name => {
    const catInsights = groupedInsights[name] || [];
    const score = catInsights.length > 0
      ? Math.round(catInsights.reduce((s, i) => s + (i.value || 0), 0) / catInsights.length)
      : DOMAIN_SUB_METRICS[name]
        ? Math.round(DOMAIN_SUB_METRICS[name].reduce((s, m) => s + m.defaultScore, 0) / DOMAIN_SUB_METRICS[name].length)
        : 50;
    return { name, score, trend: DOMAIN_TRENDS[name] || 'stable' as const, color: LBI_CATEGORIES[name as keyof typeof LBI_CATEGORIES]?.color || '#0B3C5D' };
  });

  const radarData = allDomains.map(d => ({ label: d.name, value: d.score, color: d.color }));

  const timelineMilestones = [
    { label: 'Discipline score improved to ' + (allDomains.find(d => d.name === 'Discipline')?.score || 0) + '%', date: '2 days ago', type: 'milestone' as const },
    { label: 'LBI Assessment Cycle 2 started', date: '1 week ago', type: 'assessment' as const },
    { label: 'Time Management flagged for review', date: '2 weeks ago', type: 'alert' as const },
    { label: 'Confidence score crossed 60%', date: '3 weeks ago', type: 'milestone' as const },
    { label: 'Initial LBI Assessment completed', date: '1 month ago', type: 'assessment' as const },
  ];

  const actionPlanItems = getActionPlanItems();
  const cycleComparisonData = getCycleComparisonData();

  return (
    <div className="space-y-5" data-testid="lbi-education-correlation">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#0B3C5D' }}>
          <Brain className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold" style={{ color: '#0B3C5D', fontFamily: "'Inter', sans-serif" }}>
            LBI-Academic Correlation
          </h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Behavioral insights linked to academic performance for {childName}
          </p>
        </div>
      </div>

      {/* AI Insight Banner */}
      <AIInsightBanner childName={childName} insights={insights} avgScore={avgLBIScore} />

      {/* Animated Score Rings Row */}
      <Card className="border shadow-sm" data-testid="lbi-score-rings">
        <CardContent className="py-5">
          <div className="flex items-center justify-around flex-wrap gap-4">
            <AnimatedRing value={avgLBIScore} color={getScoreColor(avgLBIScore)} label="Avg LBI Score" icon={Brain} />
            <AnimatedRing value={taskCompletionRate} color={getScoreColor(taskCompletionRate)} label="Task Completion" icon={CheckCircle2} />
            <div className="flex flex-col items-center gap-1.5">
              <div className="h-[80px] w-[80px] rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(11, 60, 93, 0.06)', border: '3px solid rgba(11, 60, 93, 0.15)' }}>
                <div className="text-center">
                  <BarChart3 size={14} style={{ color: '#0B3C5D', margin: '0 auto 2px' }} />
                  <span className="text-sm font-bold" style={{ color: '#0B3C5D', fontFamily: "'Inter', sans-serif" }}>{correlations.length}</span>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-center leading-tight" style={{ color: 'var(--text-muted)' }}>Correlations</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <div className="h-[80px] w-[80px] rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(78, 205, 196, 0.06)', border: '3px solid rgba(78, 205, 196, 0.15)' }}>
                <div className="text-center">
                  <Lightbulb size={14} style={{ color: '#4ECDC4', margin: '0 auto 2px' }} />
                  <span className="text-sm font-bold" style={{ color: '#4ECDC4', fontFamily: "'Inter', sans-serif" }}>{recommendations.length}</span>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-center leading-tight" style={{ color: 'var(--text-muted)' }}>Actions</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Radar Chart + Domain Heatmap Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border shadow-sm" data-testid="lbi-radar-chart">
          <CardHeader className="pb-1 pt-3 px-4">
            <div className="flex items-center gap-2">
              <Activity size={14} style={{ color: '#0B3C5D' }} />
              <CardTitle className="text-xs font-bold" style={{ color: '#0B3C5D' }}>Behavioral Fingerprint</CardTitle>
            </div>
            <CardDescription className="text-[10px]">7-domain radar profile</CardDescription>
          </CardHeader>
          <CardContent className="pb-3 px-2">
            <RadarChart data={radarData} size={220} />
          </CardContent>
        </Card>

        <Card className="border shadow-sm" data-testid="lbi-heatmap-card">
          <CardHeader className="pb-1 pt-3 px-4">
            <div className="flex items-center gap-2">
              <Target size={14} style={{ color: '#4ECDC4' }} />
              <CardTitle className="text-xs font-bold" style={{ color: '#0B3C5D' }}>Domain Strength Map</CardTitle>
            </div>
            <CardDescription className="text-[10px]">Color intensity = score strength</CardDescription>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <DomainHeatmap domains={allDomains} />
            <div className="flex items-center justify-center gap-3 mt-3">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(220, 38, 38, 0.15)' }} />
                <span className="text-[8px]" style={{ color: 'var(--text-muted)' }}>&lt;50</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(217, 119, 6, 0.15)' }} />
                <span className="text-[8px]" style={{ color: 'var(--text-muted)' }}>50-64</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(11, 60, 93, 0.2)' }} />
                <span className="text-[8px]" style={{ color: 'var(--text-muted)' }}>65-79</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(78, 205, 196, 0.3)' }} />
                <span className="text-[8px]" style={{ color: 'var(--text-muted)' }}>80+</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cycle Comparison */}
      {cycleComparisonData.length > 0 && (
        <Card className="border shadow-sm" data-testid="cycle-comparison-card">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" style={{ color: '#0B3C5D' }} />
              <CardTitle className="text-sm font-semibold" style={{ color: '#0B3C5D', fontFamily: "'Inter', sans-serif" }}>
                vs Previous Cycle
              </CardTitle>
            </div>
            <CardDescription className="text-xs">Score changes for top categories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {cycleComparisonData.map((item) => (
                <div
                  key={item.category}
                  className="rounded-lg p-3 text-center"
                  style={{ backgroundColor: 'rgba(11, 60, 93, 0.04)' }}
                  data-testid={`cycle-delta-${item.category.replace(/\s+/g, '-').toLowerCase()}`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                    {item.category}
                  </p>
                  <div className="flex items-center justify-center gap-1">
                    {item.delta > 0 ? (
                      <ArrowUpRight className="h-4 w-4" style={{ color: '#4ECDC4' }} />
                    ) : item.delta < 0 ? (
                      <ArrowDownRight className="h-4 w-4" style={{ color: '#dc2626' }} />
                    ) : (
                      <Minus className="h-4 w-4" style={{ color: '#d97706' }} />
                    )}
                    <span
                      className="text-lg font-bold"
                      style={{
                        color: item.delta > 0 ? '#4ECDC4' : item.delta < 0 ? '#dc2626' : '#d97706',
                        fontFamily: "'Inter', sans-serif"
                      }}
                      data-testid={`cycle-delta-value-${item.category.replace(/\s+/g, '-').toLowerCase()}`}
                    >
                      {item.delta > 0 ? '+' : ''}{item.delta}
                    </span>
                  </div>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Current: {item.currentScore}%
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="insights" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-10 p-1 rounded-xl bg-gray-100 gap-0.5">
          <TabsTrigger 
            value="insights" 
            className="rounded-lg text-xs font-medium text-gray-500 gap-1.5 transition-all hover:text-gray-700 data-[state=active]:bg-white data-[state=active]:text-[#0B3C5D] data-[state=active]:font-semibold data-[state=active]:shadow-sm"
            data-testid="tab-lbi-insights"
          >
            <Brain className="h-3.5 w-3.5" />
            LBI Insights
          </TabsTrigger>
          <TabsTrigger 
            value="correlations" 
            className="rounded-lg text-xs font-medium text-gray-500 gap-1.5 transition-all hover:text-gray-700 data-[state=active]:bg-white data-[state=active]:text-[#0B3C5D] data-[state=active]:font-semibold data-[state=active]:shadow-sm"
            data-testid="tab-correlations"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Correlations
          </TabsTrigger>
          <TabsTrigger 
            value="recommendations" 
            className="rounded-lg text-xs font-medium text-gray-500 gap-1.5 transition-all hover:text-gray-700 data-[state=active]:bg-white data-[state=active]:text-[#0B3C5D] data-[state=active]:font-semibold data-[state=active]:shadow-sm"
            data-testid="tab-recommendations"
          >
            <Lightbulb className="h-3.5 w-3.5" />
            Recommendations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="mt-4">
          {Object.entries(groupedInsights).length === 0 ? (
            <Card className="border border-dashed overflow-hidden" data-testid="lbi-empty-state">
              <CardContent className="py-10 text-center relative">
                <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Ccircle cx=\'10\' cy=\'10\' r=\'1\' fill=\'%230B3C5D\'/%3E%3C/svg%3E")', backgroundSize: '20px 20px' }} />
                <div className="relative z-10">
                  <div className="h-16 w-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'rgba(11, 60, 93, 0.06)', border: '2px dashed rgba(11, 60, 93, 0.15)' }}>
                    <Brain className="h-8 w-8" style={{ color: '#0B3C5D', opacity: 0.4 }} />
                  </div>
                  <p className="text-sm font-semibold mb-1" style={{ color: '#0B3C5D' }}>No behavioral insights available yet</p>
                  <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Complete LBI assessments to unlock your child's behavioral fingerprint</p>
                  <div className="flex items-center justify-center gap-6 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    <div className="flex items-center gap-1.5">
                      <div className="h-6 w-6 rounded-md flex items-center justify-center" style={{ backgroundColor: 'rgba(78, 205, 196, 0.1)' }}>
                        <Target size={12} style={{ color: '#4ECDC4' }} />
                      </div>
                      7 Domains
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-6 w-6 rounded-md flex items-center justify-center" style={{ backgroundColor: 'rgba(11, 60, 93, 0.1)' }}>
                        <BarChart3 size={12} style={{ color: '#0B3C5D' }} />
                      </div>
                      21+ Sub-metrics
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-6 w-6 rounded-md flex items-center justify-center" style={{ backgroundColor: 'rgba(78, 205, 196, 0.1)' }}>
                        <Sparkles size={12} style={{ color: '#4ECDC4' }} />
                      </div>
                      AI Insights
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(groupedInsights).map(([category, categoryInsights]) => {
                const categoryConfig = LBI_CATEGORIES[category as keyof typeof LBI_CATEGORIES] || 
                  { icon: Brain, color: '#0B3C5D', bg: 'rgba(11, 60, 93, 0.06)' };
                const Icon = categoryConfig.icon;
                const avgValue = Math.round(categoryInsights.reduce((sum, i) => sum + (i.value || 0), 0) / categoryInsights.length);
                const isExpanded = expandedCategories[category] || false;
                const subMetrics = DOMAIN_SUB_METRICS[category] || [];
                const suggestedActions = DOMAIN_SUGGESTED_ACTIONS[category] || [];
                const trend = DOMAIN_TRENDS[category] || 'stable';
                
                return (
                  <Card
                    key={category}
                    className="border shadow-sm transition-all duration-200 hover:shadow-md"
                    style={{ backgroundColor: categoryConfig.bg }}
                    data-testid={`domain-card-${category.replace(/\s+/g, '-').toLowerCase()}`}
                  >
                    <CardHeader
                      className="pb-2 cursor-pointer select-none"
                      onClick={() => toggleCategory(category)}
                      data-testid={`domain-toggle-${category.replace(/\s+/g, '-').toLowerCase()}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" style={{ color: categoryConfig.color }} />
                          <CardTitle className="text-sm font-semibold" style={{ color: categoryConfig.color, fontFamily: "'Inter', sans-serif" }}>
                            {category}
                          </CardTitle>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1" data-testid={`trend-indicator-${category.replace(/\s+/g, '-').toLowerCase()}`}>
                            {getTrendIcon(trend)}
                            <span className="text-[10px] font-medium" style={{ color: getTrendColor(trend) }}>
                              {getTrendLabel(trend)}
                            </span>
                          </div>
                          <Badge 
                            variant="outline" 
                            className="text-xs font-bold"
                            style={{ color: getScoreColor(avgValue), borderColor: getScoreColor(avgValue) }}
                          >
                            {avgValue}%
                          </Badge>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" style={{ color: 'var(--text-muted)' }} data-testid={`chevron-up-${category.replace(/\s+/g, '-').toLowerCase()}`} />
                          ) : (
                            <ChevronDown className="h-4 w-4" style={{ color: 'var(--text-muted)' }} data-testid={`chevron-down-${category.replace(/\s+/g, '-').toLowerCase()}`} />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Progress value={avgValue} className="h-1.5 mb-3" />
                      <div className="space-y-1.5">
                        {categoryInsights.slice(0, 2).map((insight, idx) => (
                          <p key={idx} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {insight.description || insight.metric}
                          </p>
                        ))}
                      </div>

                      {isExpanded && (
                        <div className="mt-4 space-y-4" data-testid={`domain-details-${category.replace(/\s+/g, '-').toLowerCase()}`}>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                              Sub-Metric Scores
                            </p>
                            <div className="space-y-2">
                              {subMetrics.map((sub, idx) => {
                                const matchingInsight = categoryInsights.find(i => i.metric === sub.name);
                                const score = matchingInsight?.value ?? sub.defaultScore;
                                return (
                                  <div key={idx} data-testid={`sub-metric-${sub.name.replace(/\s+/g, '-').toLowerCase()}`}>
                                    <div className="flex items-center justify-between mb-0.5">
                                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{sub.name}</span>
                                      <span className="text-xs font-semibold" style={{ color: getScoreColor(score) }}>{score}%</span>
                                    </div>
                                    <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.06)' }}>
                                      <div
                                        className="h-1.5 rounded-full transition-all duration-500"
                                        style={{ width: `${score}%`, backgroundColor: getScoreColor(score) }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                              Suggested Actions
                            </p>
                            <div className="space-y-1.5">
                              {suggestedActions.map((action, idx) => (
                                <div key={idx} className="flex items-start gap-2" data-testid={`suggested-action-${category.replace(/\s+/g, '-').toLowerCase()}-${idx}`}>
                                  <Zap className="h-3 w-3 mt-0.5 shrink-0" style={{ color: '#4ECDC4' }} />
                                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{action}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="correlations" className="mt-4">
          {correlations.length === 0 ? (
            <Card className="border border-dashed overflow-hidden">
              <CardContent className="py-10 text-center relative">
                <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Ccircle cx=\'10\' cy=\'10\' r=\'1\' fill=\'%230B3C5D\'/%3E%3C/svg%3E")', backgroundSize: '20px 20px' }} />
                <div className="relative z-10">
                  <div className="h-14 w-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: 'rgba(11, 60, 93, 0.06)', border: '2px dashed rgba(11, 60, 93, 0.15)' }}>
                    <BarChart3 className="h-7 w-7" style={{ color: '#0B3C5D', opacity: 0.4 }} />
                  </div>
                  <p className="text-sm font-semibold" style={{ color: '#0B3C5D' }}>Not enough data to generate correlations</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Complete more assessments and study tasks to reveal behavior-academic links</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {correlations.map((corr, idx) => (
                <Card 
                  key={idx} 
                  className="border shadow-sm transition-all duration-200 hover:shadow-md"
                  style={{ 
                    borderLeftWidth: '3px',
                    borderLeftColor: corr.type === 'positive' ? '#4ECDC4' : corr.type === 'concern' ? '#d97706' : '#0B3C5D',
                    backgroundColor: corr.type === 'positive' ? 'rgba(78, 205, 196, 0.04)' : corr.type === 'concern' ? 'rgba(217, 119, 6, 0.04)' : 'rgba(11, 60, 93, 0.04)'
                  }}
                >
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Badge variant="outline" className="text-[10px] font-semibold" style={{ color: '#0B3C5D', borderColor: '#0B3C5D' }}>
                            {corr.lbi}
                          </Badge>
                          <span style={{ color: 'var(--text-muted)' }}>→</span>
                          <Badge variant="outline" className="text-[10px] font-semibold" style={{ color: '#4ECDC4', borderColor: '#4ECDC4' }}>
                            {corr.academic}
                          </Badge>
                        </div>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{corr.insight}</p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-lg font-bold" style={{ color: getScoreColor(corr.strength), fontFamily: "'Inter', sans-serif" }}>
                          {corr.strength}%
                        </p>
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>strength</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="recommendations" className="mt-4">
          {recommendations.length === 0 ? (
            <Card className="border border-dashed overflow-hidden">
              <CardContent className="py-10 text-center relative">
                <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Ccircle cx=\'10\' cy=\'10\' r=\'1\' fill=\'%232FA36B\'/%3E%3C/svg%3E")', backgroundSize: '20px 20px' }} />
                <div className="relative z-10">
                  <div className="h-14 w-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: 'rgba(78, 205, 196, 0.06)', border: '2px dashed rgba(78, 205, 196, 0.15)' }}>
                    <Lightbulb className="h-7 w-7" style={{ color: '#4ECDC4', opacity: 0.4 }} />
                  </div>
                  <p className="text-sm font-semibold" style={{ color: '#0B3C5D' }}>No recommendations at this time</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Keep up the great work!</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {recommendations.map((rec, idx) => (
                <Card 
                  key={idx} 
                  className="border shadow-sm transition-all duration-200 hover:shadow-md"
                  style={{
                    borderLeftWidth: '3px',
                    borderLeftColor: rec.priority === 'high' ? '#dc2626' : rec.priority === 'medium' ? '#d97706' : '#4ECDC4'
                  }}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold" style={{ color: '#0B3C5D', fontFamily: "'Inter', sans-serif" }}>
                        {rec.title}
                      </CardTitle>
                      <Badge 
                        className="text-[10px] font-semibold text-white"
                        style={{ 
                          backgroundColor: rec.priority === 'high' ? '#dc2626' : rec.priority === 'medium' ? '#d97706' : '#4ECDC4'
                        }}
                      >
                        {rec.priority}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">{rec.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-lg p-3 mb-3" style={{ backgroundColor: 'rgba(78, 205, 196, 0.06)' }}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>Expected Impact</p>
                      <p className="text-xs font-medium" style={{ color: '#4ECDC4' }}>{rec.impact}</p>
                    </div>
                    {rec.actionItems && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Action Items</p>
                        <ul className="space-y-1">
                          {rec.actionItems.map((item: string, i: number) => (
                            <li key={i} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: '#4ECDC4' }} />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Activity Timeline + Action Plan Side by Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pulse Timeline */}
        <Card className="border shadow-sm" data-testid="lbi-activity-timeline">
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(78, 205, 196, 0.1)' }}>
                <Activity size={14} style={{ color: '#4ECDC4' }} />
              </div>
              <div>
                <CardTitle className="text-xs font-bold" style={{ color: '#0B3C5D' }}>Activity Timeline</CardTitle>
                <CardDescription className="text-[10px]">Recent LBI milestones</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <PulseTimeline milestones={timelineMilestones} />
          </CardContent>
        </Card>

        {/* Action Plan Checklist */}
        <Card className="border shadow-sm" data-testid="action-plan-section">
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(11, 60, 93, 0.08)' }}>
                <ClipboardList className="h-3.5 w-3.5" style={{ color: '#0B3C5D' }} />
              </div>
              <div>
                <CardTitle className="text-xs font-bold" style={{ color: '#0B3C5D' }}>Your Action Plan</CardTitle>
                <CardDescription className="text-[10px]">Daily habits to strengthen growth areas</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <div className="space-y-2">
              {actionPlanItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-all duration-200"
                  style={{
                    backgroundColor: checkedActions[item.id] ? 'rgba(78, 205, 196, 0.08)' : 'rgba(11, 60, 93, 0.03)'
                  }}
                  onClick={() => toggleAction(item.id)}
                  data-testid={`action-item-${item.id}`}
                >
                  <div className="mt-0.5 shrink-0">
                    {checkedActions[item.id] ? (
                      <CheckSquare className="h-4 w-4" style={{ color: '#4ECDC4' }} data-testid={`action-checked-${item.id}`} />
                    ) : (
                      <Square className="h-4 w-4" style={{ color: 'var(--text-muted)' }} data-testid={`action-unchecked-${item.id}`} />
                    )}
                  </div>
                  <div className="flex-1">
                    <p
                      className="text-[11px] font-medium"
                      style={{
                        color: checkedActions[item.id] ? 'var(--text-muted)' : 'var(--text-secondary)',
                        textDecoration: checkedActions[item.id] ? 'line-through' : 'none'
                      }}
                    >
                      {item.text}
                    </p>
                    <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {item.category}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t flex items-center justify-between">
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {Object.values(checkedActions).filter(Boolean).length} of {actionPlanItems.length} completed
              </p>
              <div className="w-24">
                <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.06)' }}>
                  <div
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: `${actionPlanItems.length > 0 ? (Object.values(checkedActions).filter(Boolean).length / actionPlanItems.length) * 100 : 0}%`,
                      backgroundColor: '#4ECDC4'
                    }}
                    data-testid="action-plan-progress"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
