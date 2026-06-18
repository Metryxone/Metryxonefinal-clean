import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Brain, BookOpen, Clock, Target, Star, BarChart3,
  Sparkles, RefreshCw, ChevronDown, ChevronUp, Calendar,
  TrendingUp, Lightbulb, CheckCircle2, AlertTriangle
} from "lucide-react";

interface Recommendation {
  id: number;
  category: string;
  priority: string;
  title: string;
  description: string;
  timeframe: string;
  icon: string;
}

interface WeeklyPlan {
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  sunday: string;
}

interface AIRecommendationsData {
  overallAssessment: string;
  strengthAreas: string[];
  improvementAreas: string[];
  recommendations: Recommendation[];
  weeklyPlan: WeeklyPlan;
  motivationalMessage: string;
  childName: string;
  generatedAt: string;
  performanceSnapshot: {
    avgScore: number;
    totalExams: number;
    subjectSummary: { subject: string; average: number; examCount: number }[];
  };
}

interface AIStudyRecommendationsProps {
  childId: string;
  childName: string;
  compact?: boolean;
}

const iconMap: Record<string, React.ReactNode> = {
  book: <BookOpen size={16} />,
  clock: <Clock size={16} />,
  target: <Target size={16} />,
  brain: <Brain size={16} />,
  star: <Star size={16} />,
  chart: <BarChart3 size={16} />,
};

const priorityConfig: Record<string, { color: string; bg: string; label: string }> = {
  high: { color: '#dc2626', bg: '#fef2f2', label: 'High' },
  medium: { color: '#d97706', bg: '#fffbeb', label: 'Medium' },
  low: { color: '#4ECDC4', bg: '#ecfdf5', label: 'Low' },
};

const categoryConfig: Record<string, { color: string; bg: string }> = {
  'Academic': { color: '#0B3C5D', bg: 'rgba(11, 60, 93, 0.1)' },
  'Study Habits': { color: '#4ECDC4', bg: 'rgba(78, 205, 196, 0.1)' },
  'Focus Area': { color: '#f59e0b', bg: '#fffbeb' },
  'Behavioral': { color: '#0B3C5D', bg: 'rgba(11,60,93,0.05)' },
  'Practice': { color: '#4ECDC4', bg: '#ecfdf5' },
};

function authFetch(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem('metryx_token');
  return fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) },
  });
}

export default function AIStudyRecommendations({ childId, childName, compact = false }: AIStudyRecommendationsProps) {
  const [data, setData] = useState<AIRecommendationsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [showWeeklyPlan, setShowWeeklyPlan] = useState(false);

  const fetchRecommendations = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch('/api/ai-study-recommendations', {
        method: 'POST',
        body: JSON.stringify({ childId }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to generate recommendations');
      }
      const result = await response.json();
      setData(result);
      setExpanded(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const dayLabels = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
  const dayShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  if (!data && !loading) {
    return (
      <Card className="border shadow-sm" data-testid="ai-recommendations-cta">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(78, 205, 196, 0.15)' }}>
                <Sparkles size={20} style={{ color: '#4ECDC4' }} />
              </div>
              <div>
                <h3 className="text-sm font-bold" style={{ color: '#0B3C5D' }}>AI Study Recommendations</h3>
                <p className="text-xs text-gray-500">Get personalized study plans powered by AI for {childName}</p>
              </div>
            </div>
            <Button
              onClick={fetchRecommendations}
              disabled={loading}
              className="gap-2 text-white text-xs"
              style={{ backgroundColor: '#0B3C5D' }}
              data-testid="btn-generate-recommendations"
            >
              <Sparkles size={14} />
              Generate
            </Button>
          </div>
          {error && (
            <div className="mt-3 p-2 rounded-md bg-red-50 border border-red-200">
              <p className="text-xs text-red-600 flex items-center gap-1.5">
                <AlertTriangle size={12} />
                {error}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="border shadow-sm" data-testid="ai-recommendations-loading">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center animate-pulse" style={{ backgroundColor: 'rgba(78, 205, 196, 0.15)' }}>
              <Brain size={20} style={{ color: '#4ECDC4' }} className="animate-spin" />
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: '#0B3C5D' }}>Analyzing {childName}'s Performance...</h3>
              <p className="text-xs text-gray-500">AI is reviewing exam scores, behavioral data, and learning patterns</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 rounded-lg animate-pulse" style={{ backgroundColor: 'rgba(11, 60, 93, 0.05)' }} />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card className="border shadow-sm overflow-hidden" data-testid="ai-recommendations-panel">
      <CardHeader className="pb-2 pt-4 px-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2" style={{ color: '#0B3C5D' }}>
            <Sparkles size={16} style={{ color: '#4ECDC4' }} />
            AI Study Recommendations - {data.childName}
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400">
              {new Date(data.generatedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchRecommendations}
              disabled={loading}
              className="h-7 w-7 p-0"
              data-testid="btn-refresh-recommendations"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} style={{ color: '#0B3C5D' }} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="h-7 w-7 p-0"
              data-testid="btn-toggle-recommendations"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-4">
        {/* Overall Assessment */}
        <div className="p-3 rounded-lg mb-3" style={{ backgroundColor: 'rgba(78, 205, 196, 0.08)' }}>
          <p className="text-xs leading-relaxed" style={{ color: '#0B3C5D' }}>
            <Lightbulb size={12} className="inline mr-1.5" style={{ color: '#4ECDC4' }} />
            {data.overallAssessment}
          </p>
        </div>

        {/* Strengths & Improvement Chips */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <p className="text-[10px] font-semibold mb-1.5 flex items-center gap-1" style={{ color: '#4ECDC4' }}>
              <TrendingUp size={10} /> Strengths
            </p>
            <div className="flex flex-wrap gap-1">
              {data.strengthAreas?.map((s, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                  {s}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold mb-1.5 flex items-center gap-1" style={{ color: '#d97706' }}>
              <Target size={10} /> Needs Improvement
            </p>
            <div className="flex flex-wrap gap-1">
              {data.improvementAreas?.map((a, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                  {a}
                </span>
              ))}
            </div>
          </div>
        </div>

        {expanded && (
          <>
            {/* Recommendations List */}
            <div className="space-y-2 mb-4" data-testid="recommendations-list">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Recommendations</p>
              {data.recommendations?.map((rec) => {
                const priority = priorityConfig[rec.priority] || priorityConfig.medium;
                const category = categoryConfig[rec.category] || categoryConfig['Academic'];
                return (
                  <div
                    key={rec.id}
                    className="p-3 rounded-lg border flex gap-3"
                    style={{ borderColor: 'rgba(11, 60, 93, 0.1)', backgroundColor: '#ffffff' }}
                    data-testid={`recommendation-${rec.id}`}
                  >
                    <div className="h-8 w-8 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: category.bg, color: category.color }}>
                      {iconMap[rec.icon] || <BookOpen size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-xs font-semibold" style={{ color: '#0B3C5D' }}>{rec.title}</p>
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 shrink-0" style={{ color: priority.color, borderColor: priority.color, backgroundColor: priority.bg }}>
                          {priority.label}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-gray-600 leading-relaxed">{rec.description}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: category.bg, color: category.color, fontWeight: 600 }}>
                          {rec.category}
                        </span>
                        <span className="text-[9px] text-gray-400 flex items-center gap-0.5">
                          <Clock size={8} /> {rec.timeframe}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Weekly Study Plan */}
            {data.weeklyPlan && (
              <div className="mb-3">
                <button
                  onClick={() => setShowWeeklyPlan(!showWeeklyPlan)}
                  className="flex items-center gap-2 w-full text-left mb-2"
                  data-testid="btn-toggle-weekly-plan"
                >
                  <Calendar size={12} style={{ color: '#0B3C5D' }} />
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Suggested Weekly Plan</span>
                  {showWeeklyPlan ? <ChevronUp size={12} className="text-gray-400" /> : <ChevronDown size={12} className="text-gray-400" />}
                </button>
                {showWeeklyPlan && (
                  <div className="grid grid-cols-7 gap-1" data-testid="weekly-plan-grid">
                    {dayLabels.map((day, idx) => (
                      <div key={day} className="p-2 rounded-md text-center" style={{ backgroundColor: idx < 5 ? 'rgba(11, 60, 93, 0.05)' : 'rgba(78, 205, 196, 0.08)' }}>
                        <p className="text-[9px] font-bold mb-1" style={{ color: '#0B3C5D' }}>{dayShort[idx]}</p>
                        <p className="text-[9px] text-gray-600 leading-tight">{data.weeklyPlan[day]}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Motivational Message */}
            {data.motivationalMessage && (
              <div className="p-3 rounded-lg border" style={{ backgroundColor: 'rgba(78, 205, 196, 0.06)', borderColor: 'rgba(78, 205, 196, 0.2)' }} data-testid="motivational-message">
                <p className="text-xs text-center italic" style={{ color: '#0B3C5D' }}>
                  <Star size={12} className="inline mr-1" style={{ color: '#4ECDC4' }} />
                  "{data.motivationalMessage}"
                </p>
              </div>
            )}
          </>
        )}

        {!expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="w-full text-center py-1.5 text-xs font-medium hover:underline"
            style={{ color: '#4ECDC4' }}
            data-testid="btn-expand-recommendations"
          >
            Show {data.recommendations?.length || 0} recommendations & weekly plan
          </button>
        )}
      </CardContent>
    </Card>
  );
}