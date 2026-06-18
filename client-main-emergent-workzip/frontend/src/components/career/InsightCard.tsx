import React from 'react';

interface InsightCardProps {
  title: string;
  body: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

const TYPE_STYLES = {
  info:    { bg: '#344E8610', border: '#344E8630', text: '#344E86' },
  success: { bg: '#2A9D8F10', border: '#2A9D8F30', text: '#2A9D8F' },
  warning: { bg: '#f4a26110', border: '#f4a26130', text: '#f4a261' },
  error:   { bg: '#e6394610', border: '#e6394630', text: '#e63946' },
};

export function InsightCard({ title, body, type = 'info', icon, action }: InsightCardProps) {
  const s = TYPE_STYLES[type];
  return (
    <div className="rounded-xl p-4 border" style={{ backgroundColor: s.bg, borderColor: s.border }}>
      <div className="flex items-start gap-3">
        {icon && <span style={{ color: s.text }}>{icon}</span>}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold" style={{ color: s.text }}>{title}</p>
          <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{body}</p>
        </div>
      </div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
