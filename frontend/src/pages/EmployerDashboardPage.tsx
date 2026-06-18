import { lazy, Suspense, useState } from 'react';
import { Building2, BarChart3, Briefcase, Lock, ArrowLeft } from 'lucide-react';

type NavProps = { onNavigate?: (s: string) => void };

const WorkforceInsightsPage = lazy(() => import('./WorkforceInsightsPage'));
const EnterpriseWorkforceOSPage = lazy(() => import('./EnterpriseWorkforceOSPage'));

type View = 'workforce-insights' | 'enterprise-wos';

const TABS: { id: View; label: string; icon: JSX.Element; desc: string }[] = [
  { id: 'workforce-insights', label: 'Workforce Insights',
    icon: <BarChart3 size={16} />,
    desc: 'Capability heatmap across your org \u2014 layers \u00d7 competencies, leadership pipeline, distribution' },
  { id: 'enterprise-wos', label: 'Enterprise Workforce OS',
    icon: <Briefcase size={16} />,
    desc: 'Executive view \u2014 succession readiness, strategic capability gaps, methodology versions' },
];

export default function EmployerDashboardPage({ onNavigate }: NavProps) {
  const [view, setView] = useState<View>('workforce-insights');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          {onNavigate && (
            <button
              onClick={() => onNavigate('landing')}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800"
              data-testid="employer-back"
            >
              <ArrowLeft size={14} /> Back
            </button>
          )}
          <div className="flex items-center gap-2.5 flex-1">
            <div className="w-9 h-9 rounded-xl bg-[#344E86] text-white flex items-center justify-center">
              <Building2 size={18} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">Employer Dashboard</h1>
              <p className="text-xs text-gray-500">HR & People Analytics · workforce capability intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
            <Lock size={11} /> HR / org-admin view
          </div>
        </div>

        {/* Sub-tab strip */}
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            {TABS.map(t => {
              const active = view === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setView(t.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                    active
                      ? 'border-[#344E86] text-[#344E86]'
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                  data-testid={`employer-tab-${t.id}`}
                  title={t.desc}
                >
                  {t.icon}
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active sub-tab intro */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="text-[11px] text-gray-500 mb-4">
          {TABS.find(t => t.id === view)?.desc}
        </div>
        <Suspense fallback={<div className="text-xs text-gray-400 py-12 text-center">Loading…</div>}>
          {view === 'workforce-insights' && <WorkforceInsightsPage onNavigate={onNavigate} />}
          {view === 'enterprise-wos' && <EnterpriseWorkforceOSPage />}
        </Suspense>
      </div>

      {/* Access note */}
      <div className="max-w-7xl mx-auto px-6 pb-10">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-[11px] text-blue-900">
          <strong>Why you're seeing this:</strong> these views are for HR / People Analytics teams at customer
          organisations — not individual job-seekers, and not MetryxOne platform staff. Individual users see
          personal benchmarks under the Adaptive Intelligence section of CareerBuilder; MetryxOne staff use the
          SuperAdmin console. Role-based access for an Employer persona is a planned follow-up.
        </div>
      </div>
    </div>
  );
}
