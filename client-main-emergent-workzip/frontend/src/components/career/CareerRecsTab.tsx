import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, TrendingUp, BookOpen, BarChart3, ChevronDown, ChevronUp, Loader2, AlertCircle, ExternalLink, CheckCircle2 } from 'lucide-react';

function authHeader(): Record<string, string> {
  const t = localStorage.getItem('metryx_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

type RecType = 'role_move' | 'skill_build' | 'competency_develop' | 'market_signal';

interface CareerRecommendation {
  id: string;
  type: RecType;
  title: string;
  rationale: string;
  priority: 'high' | 'medium' | 'low';
  confidence: number;
  metadata: Record<string, unknown>;
}

interface LearningResource {
  id: number;
  title: string;
  resource_type: string;
  provider: string | null;
  url: string | null;
  duration_hours: number | null;
  cost_band: string;
  difficulty: string;
}

interface LearningRecommendation {
  resource: LearningResource;
  skill_key: string;
  skill_label: string;
  gap_severity: string;
  relevance_score: number;
}

const TYPE_META: Record<RecType, { label: string; color: string; Icon: React.ElementType }> = {
  role_move:           { label: 'Role move',    color: 'bg-indigo-100 text-indigo-700', Icon: TrendingUp },
  skill_build:         { label: 'Skill',        color: 'bg-blue-100 text-blue-700',    Icon: BarChart3 },
  competency_develop:  { label: 'Competency',   color: 'bg-violet-100 text-violet-700',Icon: Sparkles },
  market_signal:       { label: 'Market',       color: 'bg-amber-100 text-amber-700',  Icon: BarChart3 },
};
const PRIORITY_DOT: Record<string, string> = {
  high:   'bg-rose-500',
  medium: 'bg-amber-400',
  low:    'bg-slate-300',
};
const COST_BADGE: Record<string, string> = {
  free:    'bg-emerald-100 text-emerald-700',
  low:     'bg-blue-100 text-blue-700',
  mid:     'bg-amber-100 text-amber-700',
  premium: 'bg-slate-100 text-slate-600',
};
const SEV_BADGE: Record<string, string> = {
  critical: 'bg-rose-100 text-rose-700',
  moderate: 'bg-amber-100 text-amber-700',
  minor:    'bg-slate-100 text-slate-600',
};

function RecCard({ rec, onDismiss }: {
  rec: CareerRecommendation;
  onDismiss: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const meta = TYPE_META[rec.type] ?? TYPE_META.skill_build;
  const { Icon } = meta;

  const handleDismiss = () => {
    setDismissed(true);
    fetch('/api/career/recs/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ rec_id: rec.id, event_type: 'dismissed' }),
    }).catch(() => {});
    setTimeout(() => onDismiss(rec.id), 300);
  };

  if (dismissed) return null;

  return (
    <div className="group p-4 rounded-xl border border-slate-200 hover:border-indigo-200 hover:shadow-sm transition-all bg-white">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${meta.color.replace('text-', 'bg-').replace('700', '100')} shrink-0`}>
          <Icon size={14} className={meta.color.split(' ')[1]} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.color}`}>{meta.label}</span>
            <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[rec.priority] ?? PRIORITY_DOT.low}`} title={`${rec.priority} priority`} />
          </div>
          <p className="font-semibold text-slate-800 text-sm mt-1">{rec.title}</p>
          {expanded && (
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">{rec.rationale}</p>
          )}
          {rec.type === 'role_move' && rec.metadata.readiness_score !== undefined && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-400 to-violet-500 rounded-full"
                  style={{ width: `${Number(rec.metadata.readiness_score)}%` }}
                />
              </div>
              <span className="text-xs text-slate-500">{Number(rec.metadata.readiness_score)}% ready</span>
            </div>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => setExpanded(e => !e)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-lg text-slate-300 hover:text-rose-400 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100"
            title="Dismiss"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

function LearningCard({ rec }: { rec: LearningRecommendation }) {
  const costClass = COST_BADGE[rec.resource.cost_band] ?? COST_BADGE.free;
  const sevClass  = SEV_BADGE[rec.gap_severity] ?? SEV_BADGE.minor;
  return (
    <div className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-200 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${costClass}`}>
              {rec.resource.cost_band}
            </span>
            {rec.skill_label && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sevClass}`}>
                {rec.skill_label} gap
              </span>
            )}
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {rec.resource.resource_type}
            </span>
          </div>
          <p className="font-medium text-slate-800 text-sm leading-snug">{rec.resource.title}</p>
          {rec.resource.provider && (
            <p className="text-xs text-slate-400 mt-1">{rec.resource.provider}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
            {rec.resource.duration_hours && <span>{rec.resource.duration_hours}h</span>}
            <span className="capitalize">{rec.resource.difficulty}</span>
            <span className="ml-auto text-indigo-500">{Math.round(rec.relevance_score * 100)}% match</span>
          </div>
        </div>
        {rec.resource.url && (
          <a
            href={rec.resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 p-2 rounded-lg bg-slate-100 hover:bg-indigo-100 text-slate-500 hover:text-indigo-600 transition-colors"
          >
            <ExternalLink size={14} />
          </a>
        )}
      </div>
    </div>
  );
}

export default function CareerRecsTab({ userId }: { userId: string }) {
  const [recs, setRecs] = useState<CareerRecommendation[]>([]);
  const [learningRecs, setLearningRecs] = useState<LearningRecommendation[]>([]);
  const [roles, setRoles] = useState<Array<{ id: number; title: string }>>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingLearning, setLoadingLearning] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'recs' | 'learning'>('recs');

  const loadRecs = useCallback((roleId?: number) => {
    setLoading(true);
    const url = `/api/career/recs/me${roleId ? `?target_role_id=${roleId}` : ''}`;
    fetch(url, { headers: authHeader() })
      .then(r => r.json())
      .then(d => {
        if (d.ok) setRecs(d.recommendations ?? []);
        else setError(d.error ?? 'Could not load recommendations');
      })
      .catch(() => setError('Network error'))
      .finally(() => setLoading(false));
  }, []);

  const loadLearning = useCallback((roleId: number) => {
    setLoadingLearning(true);
    fetch(`/api/career/learning/${roleId}`, { headers: authHeader() })
      .then(r => r.json())
      .then(d => { if (d.ok) setLearningRecs(d.recommendations ?? []); })
      .catch(() => {})
      .finally(() => setLoadingLearning(false));
  }, []);

  useEffect(() => {
    loadRecs();
    fetch('/api/career/graph/roles', { headers: authHeader() })
      .then(r => r.json())
      .then(d => { if (d.ok) setRoles((d.roles ?? []).slice(0, 30)); })
      .catch(() => {});
  }, [loadRecs]);

  const handleRoleSelect = (roleId: number) => {
    setSelectedRoleId(roleId);
    loadRecs(roleId);
    loadLearning(roleId);
  };

  const dismissRec = (id: string) => {
    setRecs(prev => prev.filter(r => r.id !== id));
  };

  const highPriority = recs.filter(r => r.priority === 'high');
  const rest = recs.filter(r => r.priority !== 'high');

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-violet-100 rounded-lg"><Sparkles size={20} className="text-violet-600" /></div>
        <div>
          <h2 className="font-semibold text-slate-800 text-lg">Career Recommendations</h2>
          <p className="text-xs text-slate-500">Personalised guidance based on your profile and career graph</p>
        </div>
      </div>

      {/* Role filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">Target role:</span>
        <button
          onClick={() => { setSelectedRoleId(null); loadRecs(); }}
          className={`text-xs px-3 py-1.5 rounded-full transition-all ${
            !selectedRoleId ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Any role
        </button>
        {roles.slice(0, 8).map(role => (
          <button
            key={role.id}
            onClick={() => handleRoleSelect(role.id)}
            className={`text-xs px-3 py-1.5 rounded-full transition-all ${
              selectedRoleId === role.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {role.title}
          </button>
        ))}
      </div>

      {/* Tab switcher */}
      {selectedRoleId && (
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
          {(['recs', 'learning'] as const).map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`text-xs px-4 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t === 'recs' ? 'Recommendations' : 'Learning plan'}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading recommendations…
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          <AlertCircle size={16} />{error}
        </div>
      )}

      {/* Recommendations */}
      {!loading && !error && activeTab === 'recs' && (
        <div className="space-y-6">
          {highPriority.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <h3 className="text-sm font-semibold text-slate-700">High priority</h3>
                <span className="text-xs bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full">{highPriority.length}</span>
              </div>
              {highPriority.map(r => <RecCard key={r.id} rec={r} onDismiss={dismissRec} />)}
            </div>
          )}
          {rest.length > 0 && (
            <div className="space-y-3">
              {highPriority.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <h3 className="text-sm font-semibold text-slate-700">Other suggestions</h3>
                </div>
              )}
              {rest.map(r => <RecCard key={r.id} rec={r} onDismiss={dismissRec} />)}
            </div>
          )}
          {recs.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <CheckCircle2 size={28} className="mx-auto mb-3 text-emerald-300" />
              <p className="text-sm">No recommendations at the moment — your profile looks well-rounded!</p>
            </div>
          )}
        </div>
      )}

      {/* Learning plan */}
      {!loading && activeTab === 'learning' && (
        <div className="space-y-4">
          {loadingLearning ? (
            <div className="flex items-center justify-center py-8 text-slate-400">
              <Loader2 size={18} className="animate-spin mr-2" /> Building your learning plan…
            </div>
          ) : learningRecs.length > 0 ? (
            <>
              <div className="flex items-center gap-2">
                <BookOpen size={15} className="text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-700">Recommended resources</h3>
                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{learningRecs.length}</span>
              </div>
              {learningRecs.map(lr => <LearningCard key={`${lr.resource.id}-${lr.skill_key}`} rec={lr} />)}
            </>
          ) : (
            <div className="text-center py-12 text-slate-400">
              <BookOpen size={24} className="mx-auto mb-3 text-slate-200" />
              <p className="text-sm">No learning resources mapped for this role yet. Check back soon.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
