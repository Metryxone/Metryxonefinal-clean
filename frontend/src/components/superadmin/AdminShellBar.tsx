import { ChevronRight, LayoutDashboard, ArrowUp, CornerUpLeft, LayoutList } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ADMIN_UX } from './adminUx';

type NavItem = { id: string; icon: React.ElementType; label: string; external?: boolean };
type NavGroup = { label: string | null; items: NavItem[]; isLabs?: boolean };

interface AdminShellBarProps {
  activeTab: string;
  setActiveTab: (id: string) => void;
  navGroups: NavGroup[];
  /** Resolved label for the active tab (falls back when tab isn't in navGroups). */
  currentLabel: string;
  brandColor: string;
}

const ROOT_TAB = 'mission-control';

/**
 * Additive UX shell bar (STEP 10) — sticky sub-header rendered between the main
 * header and the panel content. Provides:
 *   • Breadcrumbs (Mission Control / Group / Current) derived from navGroups.
 *   • A context "Go to" menu listing sibling screens in the current section.
 *   • Back-to-Mission-Control + scroll-to-top quick actions.
 *
 * It NEVER rewrites or wraps panel internals — panels render unchanged below.
 */
export function AdminShellBar({ activeTab, setActiveTab, navGroups, currentLabel, brandColor }: AdminShellBarProps) {
  // Locate the active tab's group + item (may be absent for non-nav screens).
  let group: NavGroup | undefined;
  let item: NavItem | undefined;
  for (const g of navGroups) {
    const found = g.items.find((i) => i.id === activeTab);
    if (found) {
      group = g;
      item = found;
      break;
    }
  }

  const isRoot = activeTab === ROOT_TAB;
  const label = item?.label || currentLabel || 'Dashboard';
  const siblings = (group?.items || []).filter((i) => i.id !== activeTab && !i.external);

  const scrollTop = () => {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      window.scrollTo(0, 0);
    }
  };

  return (
    <div
      className="bg-white border-b"
      style={{ borderColor: '#eef1f6' }}
      data-testid="admin-shell-bar"
    >
      <div
        className="flex items-center justify-between"
        style={{ height: ADMIN_UX.bar.height, paddingLeft: ADMIN_UX.bar.padX, paddingRight: ADMIN_UX.bar.padX }}
      >
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1.5 min-w-0 text-[12.5px]" aria-label="Breadcrumb">
          <button
            onClick={() => setActiveTab(ROOT_TAB)}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 transition-colors shrink-0"
            data-testid="breadcrumb-root"
            disabled={isRoot}
            style={isRoot ? { color: brandColor, cursor: 'default' } : undefined}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            <span className="font-medium">Mission Control</span>
          </button>

          {!isRoot && group?.label && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
              <span className="text-slate-500 truncate">{group.label}</span>
            </>
          )}

          {!isRoot && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
              <span className="font-semibold truncate" style={{ color: brandColor }} data-testid="breadcrumb-current">
                {label}
              </span>
            </>
          )}
        </nav>

        {/* Context actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {siblings.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[12px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  style={{ borderColor: '#e7ebf1' }}
                  data-testid="button-section-jump"
                  title={`Jump to another screen in ${group?.label || 'this section'}`}
                >
                  <LayoutList className="h-3.5 w-3.5" />
                  <span>Go to…</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-[60vh] overflow-y-auto">
                <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-slate-400">
                  {group?.label || 'Section'}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {siblings.map((s) => {
                  const Icon = s.icon;
                  return (
                    <DropdownMenuItem
                      key={s.id}
                      onClick={() => setActiveTab(s.id)}
                      className="gap-2 text-[12.5px] cursor-pointer"
                      data-testid={`section-jump-${s.id}`}
                    >
                      {Icon ? <Icon className="h-3.5 w-3.5 text-slate-400" /> : null}
                      <span className="truncate">{s.label}</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {!isRoot && (
            <button
              onClick={() => setActiveTab(ROOT_TAB)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              data-testid="button-back-mission-control"
              title="Back to Mission Control"
            >
              <CornerUpLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Mission Control</span>
            </button>
          )}

          <button
            onClick={scrollTop}
            className="flex items-center justify-center h-7 w-7 rounded-md text-slate-500 hover:bg-slate-50 transition-colors"
            data-testid="button-scroll-top"
            title="Scroll to top"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
