import { BRAND_NAVY as BRAND } from '@/design-system/tokens';
import { Users, TrendingUp, Award, BookOpen, Brain } from 'lucide-react';

interface ChildSummary {
  id: string;
  name: string;
  grade?: string;
  avgScore?: number;
  completedExams?: number;
  lbiScore?: number;
  streak?: number;
  strengths?: string[];
}

interface Props {
  children: ChildSummary[];
  onSelectChild: (id: string) => void;
}



export function SiblingComparison({ children, onSelectChild }: Props) {
  if (children.length < 2) return null;

  const metrics = [
    { key: 'avgScore',       label: 'Avg Score',       icon: <TrendingUp size={13} />, suffix: '%', max: 100 },
    { key: 'completedExams', label: 'Assessments',      icon: <BookOpen size={13} />,   suffix: '',  max: 20  },
    { key: 'lbiScore',       label: 'LBI Score',        icon: <Brain size={13} />,       suffix: '%', max: 100 },
    { key: 'streak',         label: 'Activity Streak',  icon: <Award size={13} />,       suffix: 'd', max: 30  },
  ];

  const colors = ['#0B3C5D', '#4ECDC4', '#1B6B9A', '#1D8055'];

  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: 'rgba(11,60,93,0.1)' }}>
      <div className="px-5 py-3.5 flex items-center gap-2 border-b" style={{ borderColor: 'rgba(11,60,93,0.08)', background: 'rgba(11,60,93,0.03)' }}>
        <Users size={14} style={{ color: BRAND.primary }} />
        <span className="text-sm font-semibold" style={{ color: BRAND.primary }}>Sibling Comparison</span>
        <span className="text-xs text-gray-400 ml-auto">{children.length} children</span>
      </div>

      <div className="p-5">
        {/* Child name headers */}
        <div className="grid mb-5" style={{ gridTemplateColumns: `140px repeat(${children.length}, 1fr)` }}>
          <div />
          {children.map((child, ci) => (
            <button
              key={child.id}
              onClick={() => onSelectChild(child.id)}
              className="text-center group"
            >
              <div
                className="w-9 h-9 rounded-full mx-auto mb-1.5 flex items-center justify-center text-white text-sm font-bold group-hover:opacity-80 transition-opacity"
                style={{ background: colors[ci % colors.length] }}
              >
                {child.name.charAt(0)}
              </div>
              <div className="text-xs font-semibold truncate px-1" style={{ color: colors[ci % colors.length] }}>
                {child.name.split(' ')[0]}
              </div>
              <div className="text-[9px] text-gray-400">{child.grade || '–'}</div>
            </button>
          ))}
        </div>

        {/* Metric rows */}
        <div className="space-y-3.5">
          {metrics.map(metric => {
            const values = children.map(c => (c as any)[metric.key] ?? 0);
            const maxVal = Math.max(...values, 1);
            return (
              <div key={metric.key}>
                <div className="grid items-center mb-1" style={{ gridTemplateColumns: `140px repeat(${children.length}, 1fr)` }}>
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                    <span style={{ color: BRAND.primary }}>{metric.icon}</span>
                    {metric.label}
                  </div>
                  {children.map((child, ci) => {
                    const val = (child as any)[metric.key] ?? 0;
                    return (
                      <div key={child.id} className="text-center">
                        <span className="text-xs font-semibold" style={{ color: colors[ci % colors.length] }}>
                          {val}{metric.suffix}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="grid gap-1" style={{ gridTemplateColumns: `140px repeat(${children.length}, 1fr)` }}>
                  <div />
                  {children.map((child, ci) => {
                    const val = (child as any)[metric.key] ?? 0;
                    const pct = metric.max > 0 ? Math.min((val / metric.max) * 100, 100) : (val / maxVal) * 100;
                    return (
                      <div key={child.id} className="px-1">
                        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${pct}%`, background: colors[ci % colors.length] }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Strengths row */}
        <div className="mt-5 pt-4 border-t" style={{ borderColor: 'rgba(11,60,93,0.08)' }}>
          <div className="grid" style={{ gridTemplateColumns: `140px repeat(${children.length}, 1fr)` }}>
            <div className="text-[11px] text-gray-400 self-start pt-0.5">Top Strength</div>
            {children.map((child, ci) => (
              <div key={child.id} className="px-1 text-center">
                {child.strengths?.[0] ? (
                  <span
                    className="inline-block text-[9px] font-semibold px-2 py-0.5 rounded-full text-white"
                    style={{ background: colors[ci % colors.length] }}
                  >
                    {child.strengths[0]}
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-300">–</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
