import { BRAND } from '@/design-system/tokens';
import { useState, useEffect } from 'react';
import { Lightbulb, BookOpen, Briefcase, Users, Clock, Zap, ArrowRight, BarChart3, Target } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Screen } from '../../App';



const apiFetch = async (url: string) => {
  const token = localStorage.getItem('metryx_token');
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

const TYPE_CONFIG: Record<string, { icon: typeof BookOpen; color: string; bg: string; label: string }> = {
  course:    { icon: BookOpen,  color: '#3b82f6', bg: '#eff6ff', label: 'Online Course' },
  project:   { icon: Briefcase, color: '#8b5cf6', bg: '#f5f3ff', label: 'Hands-on Project' },
  mentoring: { icon: Users,     color: '#10b981', bg: '#f0fdf4', label: 'Mentoring' },
};

const GAP_BADGE: Record<string, { bg: string; text: string }> = {
  critical: { bg: '#fef2f2', text: '#b91c1c' },
  high:     { bg: '#fff7ed', text: '#c2410c' },
  medium:   { bg: '#fefce8', text: '#854d0e' },
  low:      { bg: '#eff6ff', text: '#1d4ed8' },
};

export default function LearningPathsPage({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const [userId, setUserId] = useState('');

  useEffect(() => {
    apiFetch('/api/user').then((d: any) => { const u = d?.user ?? d; if (u?.id) setUserId(u.id); }).catch(() => {});
  }, []);

  const recoQuery = useQuery({
    queryKey: ['comp-reco', userId],
    queryFn: () => apiFetch(`/api/competency/interventions/${userId}`),
    enabled: !!userId,
  });

  const data = recoQuery.data;

  const grouped = data?.interventions?.reduce((acc: Record<string, any[]>, iv: any) => {
    const type = iv.type ?? 'course';
    if (!acc[type]) acc[type] = [];
    acc[type].push(iv);
    return acc;
  }, {});

  const totalWeeks = data?.interventions?.reduce((sum: number, iv: any) => sum + (iv.duration_weeks ?? 0), 0) ?? 0;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8fafc' }}>
      <Navbar onNavigate={onNavigate} currentScreen="competency-learning-paths" />

      {/* Page hero */}
      <section className="pt-24 pb-10 px-4 border-b border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.primary}15` }}>
              <Lightbulb className="h-4 w-4" style={{ color: BRAND.primary }} />
            </div>
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: BRAND.primary }}>
              Learning Intelligence
            </span>
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: BRAND.primary }}>
            Personalised Learning Paths
          </h1>
          <p className="text-sm text-gray-500 max-w-2xl">
            AI-generated interventions — courses, projects, and mentoring — prioritised by the gaps that matter most for your target role and career stage.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {!userId ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${BRAND.primary}12` }}>
              <Lightbulb className="h-8 w-8" style={{ color: BRAND.primary }} />
            </div>
            <h2 className="text-2xl font-bold mb-3" style={{ color: BRAND.primary }}>Your Personalised Learning Journey</h2>
            <p className="text-gray-500 text-sm max-w-xl mx-auto mb-8">
              Auto-generated learning interventions — courses, projects, and mentoring — prioritised by the gaps that matter most for your target role and career stage.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto mb-10">
              {Object.values(TYPE_CONFIG).map(({ icon: Icon, color, bg, label }) => (
                <Card key={label} className="border border-gray-100 shadow-sm">
                  <CardContent className="p-5 text-center">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: bg }}>
                      <Icon className="h-5 w-5" style={{ color }} />
                    </div>
                    <p className="text-sm font-semibold" style={{ color: BRAND.primary }}>{label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" onClick={() => onNavigate('registration')}
                className="text-white px-8" style={{ backgroundColor: BRAND.primary }}>
                Build My Learning Plan
              </Button>
              <Button size="lg" variant="outline" onClick={() => onNavigate('competency-intelligence')} className="px-8">
                Explore Full Platform
              </Button>
            </div>
          </div>
        ) : recoQuery.isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-3"
                style={{ borderColor: `${BRAND.accent} transparent transparent transparent` }} />
              <p className="text-sm text-gray-500">Building your learning path…</p>
            </div>
          </div>
        ) : recoQuery.isError ? (
          <div className="text-center py-16">
            <Lightbulb className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 mb-4">Could not load learning paths. Make sure your profile and assessment are complete.</p>
            <Button onClick={() => onNavigate('career-builder')} variant="outline">
              Go to Career Builder
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary KPIs */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total Interventions', value: data.interventions?.length ?? 0, color: BRAND.primary, icon: <BookOpen className="h-4 w-4" /> },
                { label: 'Total Weeks', value: totalWeeks, color: BRAND.accent, icon: <Clock className="h-4 w-4" /> },
                { label: 'Gaps Addressed', value: data.totalGapCount ?? 0, color: BRAND.orange, icon: <Target className="h-4 w-4" /> },
              ].map(({ label, value, color, icon }) => (
                <Card key={label} className="border border-gray-100 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span style={{ color }}>{icon}</span>
                      <p className="text-xs text-gray-400">{label}</p>
                    </div>
                    <p className="text-2xl font-extrabold" style={{ color }}>{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Interventions by type */}
            {grouped && Object.entries(grouped).map(([type, items]: [string, any]) => {
              const tc = TYPE_CONFIG[type] ?? TYPE_CONFIG.course;
              const Icon = tc.icon;
              return (
                <Card key={type} className="border border-gray-100 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: tc.bg }}>
                        <Icon className="h-3.5 w-3.5" style={{ color: tc.color }} />
                      </div>
                      {tc.label}s <span className="text-gray-400 font-normal">({items.length})</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {items.map((iv: any) => {
                      const gapStyle = GAP_BADGE[iv.gap_level] ?? GAP_BADGE.low;
                      return (
                        <div key={iv.id} className="p-3 rounded-xl border"
                          style={{ backgroundColor: tc.bg, borderColor: `${tc.color}20` }}>
                          <div className="flex items-start justify-between mb-1.5">
                            <p className="text-xs font-semibold" style={{ color: tc.color }}>{iv.title}</p>
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ml-1 flex-shrink-0"
                              style={{ backgroundColor: gapStyle.bg, color: gapStyle.text }}>
                              {iv.gap_level}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-500 mb-2 leading-relaxed">{iv.description}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-medium text-gray-500">{iv.competency_name}</span>
                            {iv.duration_weeks && (
                              <div className="flex items-center gap-1 text-[10px] text-gray-400">
                                <Clock className="h-3 w-3" />
                                {iv.duration_weeks}w
                              </div>
                            )}
                          </div>
                          {iv.provider && (
                            <p className="text-[10px] text-gray-400 mt-1">Provider: {iv.provider}</p>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })}

            {(!data.interventions || data.interventions.length === 0) && (
              <Card className="border border-gray-100 shadow-sm">
                <CardContent className="p-8 text-center">
                  <Zap className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 mb-4">
                    No interventions generated yet. Complete your competency assessment to get personalised recommendations.
                  </p>
                  <Button onClick={() => onNavigate('career-builder')} variant="outline">
                    Take Assessment <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Button onClick={() => onNavigate('competency-growth-simulation')}
                className="text-white" style={{ backgroundColor: BRAND.primary }}>
                Simulate My Growth <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
              <Button variant="outline" onClick={() => onNavigate('competency-gap-analysis')}>
                <BarChart3 className="h-4 w-4 mr-1" /> Review My Gaps
              </Button>
            </div>
          </div>
        )}
      </div>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}
