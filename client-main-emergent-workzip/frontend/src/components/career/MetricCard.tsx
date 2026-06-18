import React from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  color?: string;
  trend?: 'up' | 'down' | 'flat';
  className?: string;
}

export function MetricCard({ label, value, sub, icon, color = '#344E86', trend, className = '' }: MetricCardProps) {
  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : null;
  const trendColor = trend === 'up' ? '#2A9D8F' : trend === 'down' ? '#e63946' : '#94a3b8';

  return (
    <div className={`bg-white border border-gray-100 rounded-2xl p-4 shadow-sm ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold mt-0.5" style={{ color }}>{value}</p>
          {sub && (
            <p className="text-[10px] text-gray-400 mt-0.5">
              {trendIcon && <span style={{ color: trendColor }}>{trendIcon} </span>}
              {sub}
            </p>
          )}
        </div>
        {icon && (
          <span className="p-2 rounded-xl" style={{ backgroundColor: `${color}12`, color }}>
            {icon}
          </span>
        )}
      </div>
    </div>
  );
}
