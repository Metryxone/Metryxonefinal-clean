import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface SCOverview { reviews_by_status: { status: string; count: number }[]; members: { total: number; active: number }; cycles_by_status: { status: string; count: number }[]; rules_by_category: { rule_category: string; count: number }[]; }
interface Review { id: number; review_code: string; entity_type: string; entity_key: string; entity_name: string; review_type: string; status: string; priority: string; submitted_by: string; created_at: string; rationale: string; }
interface Member { id: number; full_name: string; role: string; expertise_areas: string[]; voting_rights: boolean; }
interface GovernanceRule { id: number; rule_code: string; rule_name: string; entity_type: string | null; rule_category: string; rule_value: Record<string, unknown>; is_mandatory: boolean; description: string; }
interface Cycle { id: number; cycle_code: string; cycle_name: string; cycle_type: string; status: string; scope: string[]; review_count: number; }

const STATUS_COLORS: Record<string, string> = { pending: 'bg-amber-100 text-amber-800', in_review: 'bg-blue-100 text-blue-800', approved: 'bg-green-100 text-green-800', rejected: 'bg-red-100 text-red-800', deferred: 'bg-gray-100 text-gray-700', retired: 'bg-slate-100 text-slate-600' };
const PRIORITY_COLORS: Record<string, string> = { urgent: 'bg-red-100 text-red-700', high: 'bg-orange-100 text-orange-700', medium: 'bg-blue-100 text-blue-700', low: 'bg-gray-100 text-gray-600' };
const CYCLE_STATUS: Record<string, string> = { active: 'bg-green-100 text-green-800', planned: 'bg-blue-100 text-blue-800', completed: 'bg-gray-100 text-gray-700', cancelled: 'bg-red-100 text-red-700' };

export default function VXCompetencyScienceCouncilPanel() {
  const [tab, setTab] = useState<'overview' | 'reviews' | 'members' | 'governance' | 'cycles'>('overview');
  const [overview, setOverview] = useState<SCOverview | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [rules, setRules] = useState<GovernanceRule[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/vx/science-council/overview').then(r => r.json()).catch(() => null),
      fetch('/api/admin/vx/science-council/reviews?limit=20').then(r => r.json()).catch(() => ({ reviews: [] })),
      fetch('/api/admin/vx/science-council/members').then(r => r.json()).catch(() => ({ members: [] })),
      fetch('/api/admin/vx/science-council/governance-rules').then(r => r.json()).catch(() => ({ rules: [] })),
      fetch('/api/admin/vx/science-council/cycles').then(r => r.json()).catch(() => ({ cycles: [] })),
    ]).then(([ov, rv, mb, gr, cy]) => {
      setOverview(ov);
      setReviews(rv.reviews || []);
      setMembers(mb.members || []);
      setRules(gr.rules || []);
      setCycles(cy.cycles || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Competency Science Council…</div>;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Competency Science Council <span className="text-sm font-normal text-gray-500 ml-2">VX-D25</span></h2>
          <p className="text-sm text-gray-500 mt-1">Governance · approval workflows · review cycles · psychometric oversight</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['overview', 'reviews', 'members', 'governance', 'cycles'] as const).map(t => (
            <Button key={t} variant={tab === t ? 'default' : 'outline'} size="sm" onClick={() => setTab(t)} className="capitalize">{t}</Button>
          ))}
        </div>
      </div>

      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Pending Reviews', value: overview.reviews_by_status.find(r => r.status === 'pending')?.count ?? 0, accent: 'text-amber-600' },
            { label: 'Active Members', value: overview.members?.active ?? 0, accent: 'text-green-600' },
            { label: 'Active Cycles', value: overview.cycles_by_status.find(c => c.status === 'active')?.count ?? 0, accent: 'text-blue-600' },
            { label: 'Governance Rules', value: overview.rules_by_category.reduce((s, r) => s + Number(r.count), 0), accent: 'text-purple-600' },
          ].map(s => (
            <div key={s.label} className="bg-white border rounded-xl p-4 shadow-sm">
              <div className={`text-2xl font-bold ${s.accent}`}>{s.value}</div>
              <div className="text-sm text-gray-600 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'overview' && overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4">Reviews by Status</h3>
            <div className="space-y-3">
              {overview.reviews_by_status.map(r => (
                <div key={r.status} className="flex items-center justify-between">
                  <Badge className={STATUS_COLORS[r.status] || 'bg-gray-100'}>{r.status.replace(/_/g, ' ')}</Badge>
                  <span className="font-semibold">{r.count}</span>
                </div>
              ))}
              {!overview.reviews_by_status.length && <div className="text-gray-400 text-sm">No reviews yet</div>}
            </div>
          </div>
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4">Governance Rules by Category</h3>
            <div className="space-y-3">
              {overview.rules_by_category.map(r => (
                <div key={r.rule_category} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{r.rule_category.replace(/_/g, ' ')}</span>
                  <Badge variant="outline">{r.count} rules</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'reviews' && (
        <div className="space-y-4">
          {reviews.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No reviews submitted yet. Submit entity approvals via the API.</div>
          ) : reviews.map(r => (
            <div key={r.id} className="bg-white border rounded-xl p-5 shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="font-mono text-xs text-gray-400">{r.review_code}</span>
                  <div className="font-semibold text-gray-900 mt-1">{r.entity_name || r.entity_key}</div>
                  <div className="text-xs text-gray-500 capitalize">{r.entity_type} · {r.review_type.replace(/_/g, ' ')}</div>
                </div>
                <div className="flex gap-2">
                  <Badge className={PRIORITY_COLORS[r.priority] || 'bg-gray-100'}>{r.priority}</Badge>
                  <Badge className={STATUS_COLORS[r.status] || 'bg-gray-100'}>{r.status.replace(/_/g, ' ')}</Badge>
                </div>
              </div>
              {r.rationale && <p className="text-sm text-gray-600 mt-2">{r.rationale}</p>}
              <div className="text-xs text-gray-400 mt-2">Submitted by {r.submitted_by} · {new Date(r.created_at).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'members' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {members.map(m => (
            <div key={m.id} className="bg-white border rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-gray-900">{m.full_name}</div>
                <Badge variant="outline" className="capitalize">{m.role.replace(/_/g, ' ')}</Badge>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {m.expertise_areas?.map(e => <Badge key={e} variant="outline" className="text-xs">{e.replace(/_/g, ' ')}</Badge>)}
              </div>
              {m.voting_rights && <div className="text-xs text-green-600 mt-2">✓ Voting rights</div>}
            </div>
          ))}
        </div>
      )}

      {tab === 'governance' && (
        <div className="space-y-4">
          {rules.map(r => (
            <div key={r.id} className="bg-white border rounded-xl p-5 shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-semibold text-gray-900">{r.rule_name}</div>
                  <div className="text-xs font-mono text-gray-400">{r.rule_code}</div>
                </div>
                <div className="flex gap-2">
                  {r.is_mandatory && <Badge className="bg-red-100 text-red-700">Mandatory</Badge>}
                  <Badge variant="outline" className="capitalize">{r.rule_category.replace(/_/g, ' ')}</Badge>
                  {r.entity_type && <Badge variant="outline" className="capitalize">{r.entity_type}</Badge>}
                </div>
              </div>
              <p className="text-sm text-gray-600">{r.description}</p>
              <div className="mt-3 bg-gray-50 rounded-lg p-3 text-xs font-mono text-gray-600 overflow-auto">
                {JSON.stringify(r.rule_value, null, 2)}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'cycles' && (
        <div className="space-y-4">
          {cycles.map(c => (
            <div key={c.id} className="bg-white border rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-semibold text-gray-900">{c.cycle_name}</div>
                  <div className="text-xs font-mono text-gray-400">{c.cycle_code} · {c.cycle_type}</div>
                </div>
                <div className="flex gap-2">
                  <Badge className={CYCLE_STATUS[c.status] || 'bg-gray-100'}>{c.status}</Badge>
                  <Badge variant="outline">{c.review_count} reviews</Badge>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {(c.scope || []).map(s => <Badge key={s} variant="outline" className="text-xs capitalize">{s}</Badge>)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
