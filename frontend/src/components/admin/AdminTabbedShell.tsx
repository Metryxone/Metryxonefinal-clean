/**
 * AdminTabbedShell — generic tabbed host for SuperAdmin "framework" groups
 * that do NOT use the config-driven FrameworkPanel (Career Builder,
 * Employer & Talent, Employability, Future Readiness, Assessment Factory).
 *
 * Mirrors FrameworkPanel's inner tab-bar styling so every collapsed domain
 * group looks identical. Each tab supplies its own already-wrapped node, so
 * per-panel layout is byte-identical to the legacy standalone branch.
 */
import { useState, type ReactNode } from 'react';

export type AdminShellTab = { id: string; label: string; icon: any; node: ReactNode };

export default function AdminTabbedShell({
  tabs,
  color = '#344E86',
  initialTabId,
}: {
  tabs: AdminShellTab[];
  color?: string;
  initialTabId?: string;
}) {
  const [tab, setTab] = useState<string>(initialTabId ?? tabs[0]?.id ?? '');

  if (import.meta.env.DEV) {
    const ids = tabs.map(t => t.id);
    const dup = ids.find((id, i) => ids.indexOf(id) !== i);
    if (dup) console.warn(`[AdminTabbedShell] duplicate tab id "${dup}"`);
  }

  const active = tabs.find(t => t.id === tab) ?? tabs[0];

  return (
    <div className="space-y-4">
      {/* Inner tab bar */}
      <div className="flex flex-wrap gap-1 border-b pb-0">
        {tabs.map(t => {
          const isActive = active?.id === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border-b-2 -mb-px transition-all"
              style={{
                borderBottomColor: isActive ? color : 'transparent',
                color: isActive ? color : '#6b7280',
              }}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div>{active?.node}</div>
    </div>
  );
}
