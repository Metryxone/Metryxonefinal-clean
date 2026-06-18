import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, CreditCard, Edit, Save, X, CheckCircle, Plus, Trash2, ToggleLeft, ToggleRight, Sparkles, Brain, TrendingUp, Layers, Award, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { useToast } from '@/hooks/use-toast';

const NAVY = '#344E86';
const TEAL = '#4ECDC4';

interface PricingRow {
  stage_code: string;
  stage_name: string;
  price: string;
  price_note: string;
  tag: string;
  description: string;
  benefits: string[];
  whatsapp_number: string;
  is_active: boolean;
  updated_at: string;
}

const STAGE_META: Record<string, { icon: React.ElementType; color: string; bg: string; border: string; order: number; note: string }> = {
  CAP_CUR: { icon: Brain,      color: NAVY,       bg: `${NAVY}0D`,      border: `${NAVY}30`,      order: 1, note: 'Entry stage — charged before the assessment begins' },
  CAP_INS: { icon: Sparkles,   color: '#8b5cf6',  bg: '#8b5cf608',      border: '#8b5cf630',      order: 2, note: 'First upgrade — offered after Curiosity report' },
  CAP_GRW: { icon: TrendingUp, color: '#10b981',  bg: '#10b98108',      border: '#10b98130',      order: 3, note: 'Second upgrade — offered after Insight report' },
  CAP_MAS: { icon: Award,      color: '#f59e0b',  bg: '#f59e0b08',      border: '#f59e0b30',      order: 4, note: 'Top tier — complete behavioural intelligence package' },
};

function BenefitEditor({ benefits, onChange }: { benefits: string[]; onChange: (b: string[]) => void }) {
  const add = () => onChange([...benefits, '']);
  const remove = (i: number) => onChange(benefits.filter((_, j) => j !== i));
  const update = (i: number, val: string) => onChange(benefits.map((b, j) => j === i ? val : b));
  return (
    <div className="space-y-2">
      {benefits.map((b, i) => (
        <div key={i} className="flex items-center gap-2">
          <CheckCircle size={12} style={{ color: TEAL, flexShrink: 0 }} />
          <input
            className="flex-1 text-sm border rounded-lg px-2.5 py-1.5 outline-none focus:ring-1"
            style={{ borderColor: '#E2E8F0', '--tw-ring-color': TEAL } as React.CSSProperties}
            value={b}
            onChange={e => update(i, e.target.value)}
            placeholder="Benefit description"
          />
          <button onClick={() => remove(i)} className="text-gray-400 hover:text-red-500 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button onClick={add} className="flex items-center gap-1.5 text-xs font-medium mt-1 transition-colors hover:opacity-80"
        style={{ color: TEAL }}>
        <Plus size={12} /> Add benefit
      </button>
    </div>
  );
}

function PricingCard({ plan, onSaved }: { plan: PricingRow; onSaved: () => void }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<PricingRow>({ ...plan, benefits: Array.isArray(plan.benefits) ? plan.benefits : [] });

  const meta = STAGE_META[plan.stage_code] || STAGE_META.CAP_INS;
  const Icon = meta.icon;

  const saveMutation = useMutation({
    mutationFn: async (data: PricingRow) => {
      const res = await fetch(`/api/admin/capadex/pricing/${data.stage_code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Save failed');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Saved', description: `${plan.stage_name} pricing updated.` });
      setEditing(false);
      onSaved();
    },
    onError: () => toast({ title: 'Error', description: 'Failed to save pricing.', variant: 'destructive' }),
  });

  const toggleActive = async () => {
    const updated = { ...form, is_active: !form.is_active };
    setForm(updated);
    await saveMutation.mutateAsync(updated);
  };

  const isCUR = plan.stage_code === 'CAP_CUR';

  return (
    <div className="rounded-2xl overflow-hidden border" style={{ borderColor: meta.border }}>
      {/* Header */}
      <div className="px-5 py-4 flex items-center gap-3" style={{ backgroundColor: meta.bg, borderBottom: `1px solid ${meta.border}` }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${meta.color}18` }}>
          <Icon size={16} style={{ color: meta.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[15px] font-bold leading-tight" style={{ color: '#0B1F3A' }}>{plan.stage_name}</h3>
            <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
              style={{ backgroundColor: `${meta.color}18`, color: meta.color }}>
              {plan.stage_code}
            </span>
            {isCUR && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                style={{ backgroundColor: '#FEF3C7', color: '#D97706', border: '1px solid #FCD34D' }}>
                Entry Stage
              </span>
            )}
            {plan.tag && !isCUR && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${meta.color}15`, color: meta.color }}>
                {plan.tag}
              </span>
            )}
          </div>
          <p className="text-[11px] mt-0.5" style={{ color: '#94A3B8' }}>{meta.note}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {/* Active toggle */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold" style={{ color: form.is_active ? '#10b981' : '#94A3B8' }}>
              {form.is_active ? 'Active' : 'Inactive'}
            </span>
            <button onClick={toggleActive} disabled={saveMutation.isPending}>
              {form.is_active
                ? <ToggleRight size={22} style={{ color: '#10b981' }} />
                : <ToggleLeft size={22} style={{ color: '#CBD5E1' }} />}
            </button>
          </div>
          {!editing ? (
            <Button variant="outline" size="sm" onClick={() => { setForm({ ...plan, benefits: Array.isArray(plan.benefits) ? plan.benefits : [] }); setEditing(true); }}
              className="h-7 px-3 text-xs gap-1.5">
              <Edit size={11} /> Edit
            </Button>
          ) : (
            <div className="flex gap-1.5">
              <Button size="sm" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}
                className="h-7 px-3 text-xs gap-1.5 text-white" style={{ backgroundColor: NAVY }}>
                {saveMutation.isPending ? <RefreshCw size={11} className="animate-spin" /> : <Save size={11} />}
                Save
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)} className="h-7 px-2">
                <X size={11} />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-5 bg-white">
        {!editing ? (
          /* View mode */
          <div className="space-y-4">
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-[28px] font-black" style={{ color: meta.color }}>{plan.price}</span>
              <span className="text-sm font-medium" style={{ color: '#64748B' }}>{plan.price_note}</span>
              {plan.tag && (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: `${meta.color}15`, color: meta.color }}>
                  {plan.tag}
                </span>
              )}
            </div>
            <p className="text-[13px] leading-relaxed" style={{ color: '#374151' }}>{plan.description}</p>
            <div className="space-y-2">
              {(Array.isArray(plan.benefits) ? plan.benefits : []).map((b, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle size={13} className="mt-0.5 shrink-0" style={{ color: TEAL }} />
                  <span className="text-[12.5px]" style={{ color: '#374151' }}>{b}</span>
                </div>
              ))}
            </div>
            {plan.whatsapp_number && (
              <p className="text-[11px] pt-2 border-t" style={{ color: '#94A3B8', borderColor: '#F1F5F9' }}>
                WhatsApp: +{plan.whatsapp_number}
              </p>
            )}
          </div>
        ) : (
          /* Edit mode */
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Price</label>
                <Input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="₹99" className="text-sm" />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Price Note</label>
                <Input value={form.price_note} onChange={e => setForm(f => ({ ...f, price_note: e.target.value }))}
                  placeholder="one-time · instant results" className="text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Tag / Badge</label>
                <Input value={form.tag} onChange={e => setForm(f => ({ ...f, tag: e.target.value }))}
                  placeholder="Entry Stage" className="text-sm" />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>WhatsApp Number</label>
                <Input value={form.whatsapp_number} onChange={e => setForm(f => ({ ...f, whatsapp_number: e.target.value }))}
                  placeholder="919999999999" className="text-sm" />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Description</label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2} className="text-sm resize-none" placeholder="What this stage provides…" />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide block mb-2" style={{ color: '#64748B' }}>Benefits (shown to users)</label>
              <BenefitEditor benefits={Array.isArray(form.benefits) ? form.benefits : []} onChange={b => setForm(f => ({ ...f, benefits: b }))} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CapadexPricingPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery<PricingRow[]>({
    queryKey: ['capadex-pricing-admin'],
    queryFn: () => fetch('/api/admin/capadex/pricing').then(r => r.json()),
  });

  const rows = (data || []).sort((a, b) => (STAGE_META[a.stage_code]?.order ?? 9) - (STAGE_META[b.stage_code]?.order ?? 9));
  const curRow = rows.find(r => r.stage_code === 'CAP_CUR');
  const upgradeRows = rows.filter(r => r.stage_code !== 'CAP_CUR');

  return (
    <div className="p-6 space-y-6 max-w-3xl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: NAVY }}>Assessment Pricing</h2>
          <p className="text-sm text-gray-500 mt-0.5">Configure pricing for all CAPADEX stages — changes take effect immediately</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* Info banner */}
      <div className="rounded-xl p-4 border flex items-start gap-3"
        style={{ backgroundColor: '#FFFBEB', borderColor: '#FCD34D' }}>
        <AlertCircle size={16} style={{ color: '#D97706', flexShrink: 0, marginTop: 1 }} />
        <div className="text-sm" style={{ color: '#92400E' }}>
          <strong>Curiosity is now a paid entry stage.</strong> Users are charged before completing the assessment. All four stages are independently priced and editable below.
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <RefreshCw className="w-6 h-6 animate-spin" style={{ color: NAVY }} />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>No pricing data found</p>
          <p className="text-xs mt-1">Restart the backend to seed default pricing</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Entry stage */}
          {curRow && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: '#94A3B8' }}>
                Entry Stage (Assessment Access)
              </p>
              <PricingCard plan={curRow} onSaved={refetch} />
            </div>
          )}

          {/* Upgrade stages */}
          {upgradeRows.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: '#94A3B8' }}>
                Upgrade Stages (Offered Post-Report)
              </p>
              <div className="space-y-4">
                {upgradeRows.map(plan => (
                  <PricingCard key={plan.stage_code} plan={plan} onSaved={refetch} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
