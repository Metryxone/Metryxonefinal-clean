import React from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabLayoutProps {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function TabLayout({ tabs, active, onChange, children, className = '' }: TabLayoutProps) {
  return (
    <div className={className}>
      <div className="flex gap-1 border-b border-gray-100 mb-5 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              active === t.id
                ? 'border-[#344E86] text-[#344E86]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}
