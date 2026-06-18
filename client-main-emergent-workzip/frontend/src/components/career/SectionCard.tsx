import React from 'react';
import { COLOR } from '@/design-system';

interface SectionCardProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function SectionCard({ title, icon, children, action, className = '' }: SectionCardProps) {
  return (
    <div className={`bg-white border border-gray-100 rounded-2xl p-5 shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span style={{ color: COLOR.primary }}>{icon}</span>
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
