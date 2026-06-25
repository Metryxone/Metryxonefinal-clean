import { useQuery } from '@tanstack/react-query';

interface AgeBand {
  code: string;
  ages: string;
  is_active: boolean;
  sort_order: number;
}

const TEAL = '#2EC4B6';
const TEAL_BG = '#E8FAF7';

export default function ActiveAgeBandsReflection({ onEdit }: { onEdit?: () => void }) {
  const q = useQuery<{ bands: AgeBand[] }>({
    queryKey: ['/api/short-assessments/age-bands'],
    queryFn: async () => {
      const r = await fetch('/api/short-assessments/age-bands', { credentials: 'include' });
      if (!r.ok) throw new Error('Failed to load bands');
      return r.json();
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const bands = q.data?.bands ?? [];
  const active = bands.filter(b => b.is_active);

  return (
    <div className="rounded-xl border bg-white p-3 flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-gray-700 mr-1">Active Age Bands:</span>
      {q.isLoading ? (
        <span className="text-xs text-gray-400">Loading…</span>
      ) : q.isError ? (
        <span className="text-xs text-red-600">Couldn't load data. Please try again.</span>
      ) : active.length === 0 ? (
        <span className="text-xs text-gray-400">None configured</span>
      ) : (
        active.map(b => (
          <span
            key={b.code}
            className="text-[11px] px-2 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: TEAL_BG, color: TEAL }}
          >
            {b.code}{b.ages ? ` · ${b.ages}` : ''}
          </span>
        ))
      )}
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="ml-auto text-[11px] underline text-gray-500 hover:text-gray-700"
        >
          Manage in Short Assessments
        </button>
      )}
    </div>
  );
}
