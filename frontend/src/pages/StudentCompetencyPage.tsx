import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Progress } from '../components/ui/progress';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles, TrendingUp, Target, BookOpen, Users, Video, Award, RefreshCw, Compass, FileText, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { GeneratedReportBody } from '../components/reports/GeneratedReportBody';

type Item = {
  id: string; code: string; competency_code: string; competency_name: string;
  domain_code: string; domain_name: string; domain_color: string;
  question: string; expected_time: number;
  options: { id: string; text: string }[];
};

const STAGES = [
  { code: 'FOUND', name: 'Foundation (0-2y)' },
  { code: 'EXEC', name: 'Execution (2-5y)' },
  { code: 'LEAD', name: 'Lead (5-9y)' },
  { code: 'STRAT', name: 'Strategic (9-15y)' },
  { code: 'EXEC2', name: 'Executive (15+y)' },
];

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'हिन्दी (Hindi)' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'pt', name: 'Português' },
  { code: 'ar', name: 'العربية' },
  { code: 'zh', name: '中文 (Simplified)' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'ta', name: 'தமிழ்' },
  { code: 'te', name: 'తెలుగు' },
  { code: 'kn', name: 'ಕನ್ನಡ' },
  { code: 'mr', name: 'मराठी' },
  { code: 'bn', name: 'বাংলা' },
];

async function jget<T>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export default function StudentCompetencyPage({ onNavigate }: { onNavigate: (p: string) => void }) {
  const [phase, setPhase] = useState<'config' | 'taking' | 'results'>('config');
  const [stageCode, setStageCode] = useState('EXEC');
  const [roleCode, setRoleCode] = useState('SDE_L3');
  const [language, setLanguage] = useState('en');
  const [userId, setUserId] = useState<string>('me');
  const [responses, setResponses] = useState<Record<string, string>>({}); // itemId -> optionId

  // load current user id
  useQuery({
    queryKey: ['/api/user'],
    queryFn: async () => {
      const r = await fetch('/api/user', { credentials: 'include' });
      if (!r.ok) return null;
      const d = await r.json();
      if (d?.id) setUserId(d.id);
      return d;
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['/api/competency/role-weights', 'list'],
    queryFn: () => jget<{ role_code: string; role_name: string; competency_count: number }[]>('/api/competency/role-weights'),
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50/30 px-6 py-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => onNavigate('home')} data-testid="btn-back-home">
            <ArrowLeft className="h-4 w-4 mr-1.5" />Home
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight" data-testid="page-title">Career Competency Assessment</h1>
            <p className="text-sm text-gray-500 mt-0.5">Take a short self-assessment, get your Employability Index and a personalized growth path.</p>
          </div>
        </div>

        {phase === 'config' && (
          <ConfigCard
            roles={roles}
            stageCode={stageCode} setStageCode={setStageCode}
            roleCode={roleCode} setRoleCode={setRoleCode}
            language={language} setLanguage={setLanguage}
            onStart={() => { setResponses({}); setPhase('taking'); }}
          />
        )}
        {phase === 'taking' && (
          <TakingCard
            userId={userId} stageCode={stageCode} roleCode={roleCode} language={language}
            responses={responses} setResponses={setResponses}
            onSubmitted={() => setPhase('results')}
            onCancel={() => setPhase('config')}
          />
        )}
        {phase === 'results' && (
          <ResultsCard
            userId={userId} stageCode={stageCode} roleCode={roleCode}
            onRestart={() => { setResponses({}); setPhase('config'); }}
            onNavigate={onNavigate}
          />
        )}
      </div>
    </div>
  );
}

/* ---------------- Config phase ---------------- */
function ConfigCard({ roles, stageCode, setStageCode, roleCode, setRoleCode, language, setLanguage, onStart }: any) {
  return (
    <Card data-testid="card-config">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Compass className="h-5 w-5 text-indigo-600" />Tell us where you are</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium">Career stage</label>
          <Select value={stageCode} onValueChange={setStageCode}>
            <SelectTrigger className="mt-1" data-testid="select-stage"><SelectValue /></SelectTrigger>
            <SelectContent>{STAGES.map(s => <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Target role</label>
          <Select value={roleCode} onValueChange={setRoleCode}>
            <SelectTrigger className="mt-1" data-testid="select-role"><SelectValue placeholder="Pick the role you're benchmarking against" /></SelectTrigger>
            <SelectContent>
              {roles.map((r: any) => <SelectItem key={r.role_code} value={r.role_code}>{r.role_name} ({r.competency_count} competencies)</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500 mt-1">Your gaps and Employability Index will be calculated against this role.</p>
        </div>
        <div>
          <label className="text-sm font-medium">Preferred language</label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="mt-1" data-testid="select-language"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">{LANGUAGES.map(l => <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>)}</SelectContent>
          </Select>
          <p className="text-xs text-gray-500 mt-1">Items will be served in this language. If none are available yet, English fallback is used.</p>
        </div>
        <div className="bg-indigo-50/50 rounded-lg p-3 text-sm text-indigo-900 flex gap-2">
          <Sparkles className="h-4 w-4 mt-0.5 text-indigo-500 shrink-0" />
          <div>You'll answer ~20 short scenarios. Takes about 6–8 minutes. Be candid — there are no right answers.</div>
        </div>
        <Button onClick={onStart} disabled={!stageCode || !roleCode} className="w-full" size="lg" data-testid="btn-start-assessment">
          Start Assessment <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </CardContent>
    </Card>
  );
}

/* ---------------- Taking phase ---------------- */
function TakingCard({ userId, stageCode, roleCode, language, responses, setResponses, onSubmitted, onCancel }: any) {
  const { data, isLoading } = useQuery({
    queryKey: ['/api/competency/assessment/start', language],
    queryFn: async () => {
      // Try requested language first, fall back to en if zero items
      const r = await jget<{ items: Item[] }>(`/api/competency/assessment/start?limit=20&language=${language}`);
      if ((r.items || []).length === 0 && language !== 'en') {
        return jget<{ items: Item[] }>('/api/competency/assessment/start?limit=20&language=en');
      }
      return r;
    },
  });
  const items = data?.items || [];
  const [idx, setIdx] = useState(0);
  const submitMutation = useMutation({
    mutationFn: async (responses: Record<string, string>) => {
      const r = await fetch('/api/competency/assessment/submit', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          responses: Object.entries(responses).map(([item_id, option_id]) => ({ item_id, option_id })),
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });

  if (isLoading) return <div className="text-center py-12 text-gray-400">Loading assessment...</div>;
  if (!items.length) return (
    <Card>
      <CardContent className="py-12 text-center">
        <p className="text-gray-500">No assessment items available yet. Ask your administrator to import items first.</p>
        <Button variant="outline" className="mt-4" onClick={onCancel}>Back</Button>
      </CardContent>
    </Card>
  );

  const item = items[idx];
  const picked = responses[item.id];
  const progress = ((idx + 1) / items.length) * 100;
  const isLast = idx === items.length - 1;

  return (
    <Card data-testid="card-taking">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <Badge variant="outline" className="text-[10px] mb-2" style={{ borderColor: item.domain_color, color: item.domain_color }}>{item.domain_code}</Badge>
            <CardTitle className="text-base">{item.competency_name}</CardTitle>
          </div>
          <span className="text-xs text-gray-500">Question {idx + 1} of {items.length}</span>
        </div>
        <Progress value={progress} className="mt-3" />
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-base font-medium" data-testid="question-text">{item.question}</p>
        <div className="space-y-2" data-testid="options-list">
          {item.options.map((o, i) => (
            <button
              key={o.id}
              onClick={() => setResponses({ ...responses, [item.id]: o.id })}
              className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${picked === o.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
              data-testid={`option-${i}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-semibold ${picked === o.id ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-gray-300 text-gray-400'}`}>
                  {String.fromCharCode(65 + i)}
                </div>
                <span className="text-sm">{o.text}</span>
              </div>
            </button>
          ))}
        </div>
        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={() => idx === 0 ? onCancel() : setIdx(idx - 1)} data-testid="btn-prev">
            <ArrowLeft className="h-4 w-4 mr-1.5" />{idx === 0 ? 'Cancel' : 'Previous'}
          </Button>
          {isLast ? (
            <Button
              disabled={!picked || submitMutation.isPending}
              onClick={async () => {
                try {
                  await submitMutation.mutateAsync(responses);
                  toast.success('Submitted!');
                  onSubmitted();
                } catch (e: any) { toast.error(e.message); }
              }}
              data-testid="btn-submit"
            >
              {submitMutation.isPending ? <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
              {submitMutation.isPending ? 'Submitting...' : 'Submit Assessment'}
            </Button>
          ) : (
            <Button disabled={!picked} onClick={() => setIdx(idx + 1)} data-testid="btn-next">
              Next <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- Results phase ---------------- */
function ResultsCard({ userId, stageCode, roleCode, onRestart, onNavigate }: any) {
  const { data: score, isLoading: ls } = useQuery({
    queryKey: ['/api/competency/score', userId, stageCode, roleCode],
    queryFn: () => jget<any>(`/api/competency/score/${userId}?stage_code=${stageCode}&role_code=${roleCode}`),
  });
  const { data: idp } = useQuery({
    queryKey: ['/api/competency/idp', userId, stageCode, roleCode],
    queryFn: () => jget<any>(`/api/competency/idp/${userId}?stage_code=${stageCode}&role_code=${roleCode}`),
  });

  if (ls || !score) return <div className="text-center py-12 text-gray-400">Calculating your scores...</div>;

  const ei = score.employability_index;
  const tier = ei >= 80 ? { label: 'Top 10%', color: '#10b981' } : ei >= 65 ? { label: 'Strong', color: '#6366f1' } : ei >= 50 ? { label: 'Developing', color: '#f59e0b' } : { label: 'Foundation', color: '#ef4444' };
  // Group breakdown by domain for radar
  const domainAgg: Record<string, { sum: number; count: number; code: string }> = {};
  for (const b of score.breakdown || []) {
    const d = (b.code || '').split('_')[0];
    if (!domainAgg[d]) domainAgg[d] = { sum: 0, count: 0, code: d };
    domainAgg[d].sum += b.normalized || 0;
    domainAgg[d].count++;
  }
  const radar = Object.values(domainAgg).map(d => ({ code: d.code, value: Math.round((d.sum / d.count) * 100) || 0 }));

  return (
    <div className="space-y-4" data-testid="card-results">
      <Card className="border-2" style={{ borderColor: tier.color }}>
        <CardContent className="p-6 text-center">
          <Award className="h-10 w-10 mx-auto mb-2" style={{ color: tier.color }} />
          <p className="text-sm uppercase tracking-wider text-gray-500">Employability Index</p>
          <div className="text-6xl font-bold mt-2" style={{ color: tier.color }} data-testid="ei-score">{ei}</div>
          <Badge className="mt-2" style={{ backgroundColor: tier.color, color: 'white' }}>{tier.label}</Badge>
          <PercentileBadge userId={userId} stageCode={stageCode} roleCode={roleCode} />
          <div className="grid grid-cols-3 gap-2 mt-4 text-xs text-gray-500">
            <div><div className="font-semibold text-gray-700 text-base">{score.coverage?.total_attempts || 0}</div>responses</div>
            <div><div className="font-semibold text-gray-700 text-base">{Math.round((score.confidence || 0) * 100)}%</div>confidence</div>
            <div><div className="font-semibold text-gray-700 text-base">{score.coverage?.competencies_attempted || 0}/{score.coverage?.competencies_total || 0}</div>covered</div>
          </div>
        </CardContent>
      </Card>

      {/* Radar / domain summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-indigo-600" />Domain Strengths Radar</CardTitle>
        </CardHeader>
        <CardContent>
          <DomainRadar values={radar} />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mt-4">
            {radar.map(r => (
              <div key={r.code} className="border rounded-lg p-2 text-center" data-testid={`domain-${r.code}`}>
                <div className="text-xs font-mono text-gray-500">{r.code}</div>
                <div className="text-xl font-bold text-indigo-600">{r.value}%</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Diff card — comparison vs previous attempt */}
      <DiffCard userId={userId} stageCode={stageCode} roleCode={roleCode} />

      {/* Top strengths & gaps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-600" />Top Strengths</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2" data-testid="strengths-list">
              {(score.explainability?.top_strengths || []).map((s: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2 bg-emerald-50/50 rounded">
                  <div>
                    <div className="text-xs font-mono text-gray-500">{s.code}</div>
                    <div className="text-sm font-medium">{s.name}</div>
                  </div>
                  <Badge variant="outline" className="bg-white">{s.score?.toFixed?.(0) ?? s.score}/100</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-amber-600" />Top Gaps (Priority-Weighted)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2" data-testid="gaps-list">
              {(score.explainability?.top_gaps || []).map((g: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2 bg-amber-50/50 rounded">
                  <div>
                    <div className="text-xs font-mono text-gray-500">{g.code}</div>
                    <div className="text-sm font-medium">{g.name}</div>
                  </div>
                  <Badge variant="outline" className="bg-white">gap {g.gap?.toFixed?.(0) ?? g.gap}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* IDP — recommended actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4 text-fuchsia-600" />Your Individual Development Plan</CardTitle>
        </CardHeader>
        <CardContent>
          {idp?.top_gaps?.length ? (
            <div className="space-y-3" data-testid="idp-list">
              {idp.top_gaps.map((g: any, i: number) => (
                <div key={i} className="border rounded-lg p-3" data-testid={`idp-item-${i}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-xs font-mono text-gray-500">{g.code}</div>
                      <div className="text-sm font-semibold">{g.name}</div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">priority {Math.round(g.priority || 0)}</Badge>
                  </div>
                  {(g.recommendations || []).length > 0 ? (
                    <div className="space-y-1.5 mt-2">
                      {g.recommendations.map((r: any, j: number) => (
                        <a key={j} href={r.resource_link || '#'} target={r.resource_link ? '_blank' : undefined} rel="noreferrer"
                          className="flex items-center gap-2 text-xs text-indigo-600 hover:text-indigo-800">
                          {r.action_type === 'mentor' ? <Users className="h-3 w-3" /> :
                           r.action_type === 'video' ? <Video className="h-3 w-3" /> :
                           r.action_type === 'book' ? <BookOpen className="h-3 w-3" /> :
                           <Sparkles className="h-3 w-3" />}
                          <span className="capitalize">{r.action_type}</span> · {r.title}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 mt-1">No mapped resources yet for this competency.</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">No gaps identified — congrats!</p>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2 justify-center pt-2">
        <Button variant="outline" onClick={onRestart} data-testid="btn-restart"><RefreshCw className="h-4 w-4 mr-1.5" />Take Again</Button>
        <Button onClick={() => onNavigate('mentor-marketplace')} data-testid="btn-find-mentor"><Users className="h-4 w-4 mr-1.5" />Find a Mentor</Button>
      </div>

      <AnalyticsCard userId={userId} stageCode={stageCode} roleCode={roleCode} />

      <MyReportsCard />
    </div>
  );
}

/* My generated reports — candidate-facing on-screen view of report bodies
   (including the precise-vs-domain-proxy competency section). Scoped to the
   current user via /api/rf/my-reports; detail loaded from /api/rf/reports/:uuid
   which enforces ownership server-side. Honest empty/disabled states. */
function MyReportsCard() {
  const [openUuid, setOpenUuid] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, any>>({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['/api/rf/my-reports'],
    queryFn: async () => {
      const r = await fetch('/api/rf/my-reports?limit=50', { credentials: 'include' });
      if (r.status === 503) return { disabled: true, reports: [] };
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });

  const reports: any[] = Array.isArray(data?.reports) ? data.reports : [];
  const disabled = data?.disabled === true;

  const toggleView = async (uuid: string) => {
    if (openUuid === uuid) { setOpenUuid(null); return; }
    setOpenUuid(uuid);
    if (!detail[uuid]) {
      setDetailLoading(uuid);
      try {
        const r = await fetch(`/api/rf/reports/${uuid}`, { credentials: 'include' });
        const d = await r.json();
        setDetail(prev => ({ ...prev, [uuid]: r.ok ? (d.report ?? null) : null }));
      } catch {
        setDetail(prev => ({ ...prev, [uuid]: null }));
      } finally {
        setDetailLoading(null);
      }
    }
  };

  // Hide entirely when the feature is off or there's nothing to show — keeps the
  // results screen clean for users who have no generated reports.
  if (disabled || (!isLoading && !isError && reports.length === 0)) return null;

  return (
    <Card data-testid="card-my-reports">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-5 w-5 text-indigo-600" />My Reports
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="text-sm text-gray-400 text-center py-4">Loading your reports…</p>}
        {isError && <p className="text-sm text-gray-400 text-center py-4">Could not load your reports.</p>}
        {!isLoading && !isError && reports.map((r) => {
          const rep = detail[r.report_uuid];
          const sections: any[] = Array.isArray(rep?.generated_content?.sections) ? rep.generated_content.sections : [];
          const isOpen = openUuid === r.report_uuid;
          return (
            <div key={r.id} className="rounded-xl border overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
              <div className="p-3 cursor-pointer hover:bg-gray-50 flex items-start justify-between gap-2"
                onClick={() => toggleView(r.report_uuid)} data-testid={`my-report-${r.report_uuid}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-semibold text-gray-700 capitalize">{r.report_type} report</span>
                    <Badge variant="outline" className="capitalize">{r.status}</Badge>
                    <span className="text-gray-400 uppercase">{r.language}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(r.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span className="flex items-center gap-1 text-xs font-semibold text-indigo-600 shrink-0">
                  <Eye className="h-3.5 w-3.5" />{isOpen ? 'Hide' : 'View'}
                  {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </span>
              </div>
              {isOpen && (
                <div className="border-t px-3 py-3 bg-gray-50" style={{ borderColor: '#e5e7eb' }}>
                  {detailLoading === r.report_uuid && <p className="text-sm text-gray-400 text-center py-4">Loading…</p>}
                  {detailLoading !== r.report_uuid && rep === null && (
                    <p className="text-sm text-gray-400 text-center py-4">Could not load report content.</p>
                  )}
                  {detailLoading !== r.report_uuid && rep && <GeneratedReportBody sections={sections} />}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/* Analytics — EI trend + cohort benchmark */
function AnalyticsCard({ userId, stageCode, roleCode }: { userId: string; stageCode: string; roleCode: string }) {
  const { data: trend } = useQuery({
    queryKey: ['/api/competency/analytics/ei-trend', userId, stageCode, roleCode],
    queryFn: async () => {
      const r = await fetch(`/api/competency/analytics/ei-trend/${userId}?stage_code=${stageCode}&role_code=${roleCode}`, { credentials: 'include' });
      if (!r.ok) return null;
      return r.json();
    },
  });
  const { data: cohort } = useQuery({
    queryKey: ['/api/competency/analytics/cohort-benchmark', stageCode, roleCode],
    queryFn: async () => {
      const r = await fetch(`/api/competency/analytics/cohort-benchmark?stage_code=${stageCode}&role_code=${roleCode}`, { credentials: 'include' });
      if (!r.ok) return null;
      return r.json();
    },
  });

  const points = (trend?.trend || []) as Array<{ day: string; ei: number }>;
  const max = points.reduce((m, p) => Math.max(m, Number(p.ei) || 0), 100);
  // Build a simple SVG sparkline
  const W = 600, H = 80, pad = 4;
  const path = points.length > 1
    ? points.map((p, i) => {
        const x = pad + (i / (points.length - 1)) * (W - 2 * pad);
        const y = H - pad - ((Number(p.ei) || 0) / max) * (H - 2 * pad);
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      }).join(' ')
    : '';

  return (
    <Card data-testid="analytics-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-indigo-600" />Your Trend & Cohort Benchmark</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {points.length >= 2 ? (
          <div>
            <div className="text-xs text-gray-500 mb-1">Employability Index over time ({points.length} sessions)</div>
            <div className="bg-indigo-50/40 rounded-lg p-2">
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
                <path d={path} fill="none" stroke="#6366f1" strokeWidth={2} />
                {points.map((p, i) => {
                  const x = pad + (i / Math.max(1, points.length - 1)) * (W - 2 * pad);
                  const y = H - pad - ((Number(p.ei) || 0) / max) * (H - 2 * pad);
                  return <circle key={i} cx={x} cy={y} r={3} fill="#6366f1" />;
                })}
              </svg>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-500">Take a few more assessments to see your trend over time.</p>
        )}

        {cohort && (cohort.total_users ?? 0) > 0 && (
          <div>
            <div className="text-xs text-gray-500 mb-2">Where you stand vs cohort ({cohort.total_users} users on {stageCode} / {roleCode})</div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <CohortStat label="Mean"   value={Math.round(cohort.mean_ei || 0)} />
              <CohortStat label="Median" value={Math.round(cohort.median_ei || 0)} />
              <CohortStat label="Top 25%" value={Math.round(cohort.p25_ei || 0)} />
              <CohortStat label="Top 10%" value={Math.round(cohort.p90_ei || 0)} hi />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CohortStat({ label, value, hi }: { label: string; value: number; hi?: boolean }) {
  return (
    <div className={`rounded-lg p-2 ${hi ? 'bg-emerald-50' : 'bg-gray-50'}`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-xl font-bold ${hi ? 'text-emerald-700' : 'text-gray-800'}`}>{value}</div>
    </div>
  );
}

/* Social-proof percentile badge */
function PercentileBadge({ userId, stageCode, roleCode }: { userId: string; stageCode: string; roleCode: string }) {
  const { data } = useQuery({
    queryKey: ['/api/competency/score-percentile', userId, stageCode, roleCode],
    queryFn: async () => {
      const r = await fetch(`/api/competency/score/${userId}/percentile?stage_code=${stageCode}&role_code=${roleCode}`, { credentials: 'include' });
      if (!r.ok) return null;
      return r.json();
    },
  });
  if (!data || data.cohort_size < 2 || data.top_percent == null) return null;
  const tp = Math.max(1, Math.round(data.top_percent));
  const isElite = tp <= 25;
  return (
    <div className="mt-3 flex justify-center" data-testid="percentile-badge">
      <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${isElite ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm' : 'bg-indigo-50 text-indigo-700'}`}>
        <Sparkles className="h-3.5 w-3.5" />
        <span>You're in the <strong className="text-base mx-1">top {tp}%</strong> of {roleCode} at {stageCode}</span>
        <span className="opacity-70">· {data.cohort_size} peers</span>
      </div>
    </div>
  );
}

/* SVG radar chart for the 5 competency domains */
function DomainRadar({ values }: { values: { code: string; value: number }[] }) {
  if (!values.length) return <p className="text-xs text-gray-400 text-center py-4">No data yet</p>;
  const W = 360, H = 320;
  const cx = W / 2, cy = H / 2;
  const r = Math.min(W, H) / 2 - 40;
  const n = values.length;
  const angle = (i: number) => (-Math.PI / 2) + (i * 2 * Math.PI / n);
  const point = (i: number, scale: number) => {
    const a = angle(i);
    return [cx + Math.cos(a) * r * scale, cy + Math.sin(a) * r * scale];
  };
  // grid rings at 20/40/60/80/100
  const rings = [0.2, 0.4, 0.6, 0.8, 1.0];
  const pathFor = (scale: number | number[]) => values.map((_, i) => {
    const s = typeof scale === 'number' ? scale : (Math.max(0, Math.min(100, scale[i])) / 100);
    const [x, y] = point(i, s);
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ') + ' Z';

  return (
    <div className="flex justify-center" data-testid="domain-radar">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 380 }}>
        {/* Grid rings */}
        {rings.map((ring, i) => (
          <path key={i} d={pathFor(ring)} fill="none" stroke="#e5e7eb" strokeWidth={1} />
        ))}
        {/* Spokes */}
        {values.map((_, i) => {
          const [x, y] = point(i, 1);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e5e7eb" strokeWidth={1} />;
        })}
        {/* Data polygon */}
        <path d={pathFor(values.map(v => v.value))} fill="rgba(99,102,241,0.18)" stroke="#6366f1" strokeWidth={2} />
        {/* Data points */}
        {values.map((v, i) => {
          const [x, y] = point(i, Math.max(0, Math.min(100, v.value)) / 100);
          return <circle key={i} cx={x} cy={y} r={4} fill="#6366f1" />;
        })}
        {/* Labels */}
        {values.map((v, i) => {
          const [x, y] = point(i, 1.15);
          return (
            <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
              className="text-xs font-mono fill-gray-700">{v.code}</text>
          );
        })}
      </svg>
    </div>
  );
}

/* Diff card — compares latest vs previous assessment session */
function DiffCard({ userId, stageCode, roleCode }: { userId: string; stageCode: string; roleCode: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['/api/competency/score-diff', userId, stageCode, roleCode],
    queryFn: async () => {
      const r = await fetch(`/api/competency/score/${userId}/diff?stage_code=${stageCode}&role_code=${roleCode}`, { credentials: 'include' });
      if (!r.ok) return null;
      return r.json();
    },
  });
  if (isLoading) return null;
  if (!data?.has_diff) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Compass className="h-4 w-4 text-fuchsia-600" />Compared to Last Attempt</CardTitle></CardHeader>
        <CardContent><p className="text-xs text-gray-500">{data?.message || 'Take more assessments to see deltas.'}</p></CardContent>
      </Card>
    );
  }
  const delta = Number(data.delta_ei);
  const trend = delta >= 0 ? 'up' : 'down';
  const color = delta >= 0 ? 'text-emerald-600' : 'text-red-600';
  return (
    <Card data-testid="diff-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><Compass className="h-4 w-4 text-fuchsia-600" />Compared to Last Attempt</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between rounded-lg p-3 bg-fuchsia-50/30">
          <div>
            <div className="text-xs text-gray-500">Previous EI</div>
            <div className="text-2xl font-bold text-gray-700">{Number(data.previous.ei).toFixed(1)}</div>
          </div>
          <div className={`text-2xl font-bold ${color} flex items-center gap-1`}>
            {trend === 'up' ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}
          </div>
          <div>
            <div className="text-xs text-gray-500">Latest EI</div>
            <div className="text-2xl font-bold text-indigo-700">{Number(data.latest.ei).toFixed(1)}</div>
          </div>
        </div>
        {data.top_changes && data.top_changes.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-700 mb-2">Top changes per competency</div>
            <div className="space-y-1.5">
              {data.top_changes.slice(0, 5).map((c: any, i: number) => {
                const d = Number(c.delta);
                return (
                  <div key={i} className="flex items-center justify-between text-xs border-b last:border-0 pb-1.5">
                    <div>
                      <span className="font-mono text-gray-500">{c.code}</span> · <span>{c.name}</span>
                    </div>
                    <Badge variant="outline" className={d >= 0 ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-red-700 border-red-200 bg-red-50'}>
                      {d >= 0 ? '+' : ''}{d.toFixed(1)}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
