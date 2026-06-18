import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface TenantVX { id: number; name: string; type: string; branding?: { white_label_mode: boolean; primary_color: string; logo_url: string } | null; }
interface TenantConfig { permissions: { permission_key: string; is_enabled: boolean }[]; assessment_config: { assessment_type: string; is_enabled: boolean; proctoring_enabled: boolean; adaptive_enabled: boolean }[]; ai_config: { ai_feature: string; is_enabled: boolean; model_preference: string }[]; branding: { primary_color: string; white_label_mode: boolean; font_family: string } | null; }
interface Overview { total_tenants: number; white_label_tenants: number; permission_adoption: { permission_key: string; enabled: number }[]; }

export default function VXTenantConfigurationPanel() {
  const [tenants, setTenants] = useState<TenantVX[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [tab, setTab] = useState<'overview' | 'tenants' | 'detail'>('overview');
  const [loading, setLoading] = useState(true);
  const [configLoading, setConfigLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/vx/tenants').then(r => r.json()).catch(() => ({ tenants: [] })),
      fetch('/api/admin/vx/tenants/overview').then(r => r.json()).catch(() => null),
    ]).then(([td, ov]) => {
      setTenants(td.tenants || []);
      setOverview(ov);
      setLoading(false);
    });
  }, []);

  const loadConfig = (id: number) => {
    setConfigLoading(true);
    fetch(`/api/admin/vx/tenants/${id}/full-config`).then(r => r.json()).then(d => { setConfig(d); setConfigLoading(false); }).catch(() => setConfigLoading(false));
    setSelected(id);
    setTab('detail');
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Tenant Configuration…</div>;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Multi-Tenant Configuration <span className="text-sm font-normal text-gray-500 ml-2">VX-D0</span></h2>
          <p className="text-sm text-gray-500 mt-1">Branding · permissions · assessment config · AI config per tenant</p>
        </div>
        <div className="flex gap-2">
          {(['overview', 'tenants'] as const).map(t => (
            <Button key={t} variant={tab === t ? 'default' : 'outline'} size="sm" onClick={() => setTab(t)} className="capitalize">{t}</Button>
          ))}
        </div>
      </div>

      {overview && (
        <div className="grid grid-cols-3 gap-4">
          {[{ label: 'Total Tenants', value: overview.total_tenants }, { label: 'White-Label Tenants', value: overview.white_label_tenants }, { label: 'Permission Modules', value: overview.permission_adoption?.length ?? 0 }].map(s => (
            <div key={s.label} className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="text-2xl font-bold text-indigo-700">{s.value}</div>
              <div className="text-sm text-gray-600 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'overview' && overview && (
        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4">Permission Module Adoption</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {(overview.permission_adoption || []).map(p => (
              <div key={p.permission_key} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                <span className="text-sm capitalize">{p.permission_key.replace(/_/g, ' ')}</span>
                <Badge variant="outline">{p.enabled} tenants</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'tenants' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tenants.length === 0 ? (
            <div className="col-span-2 text-center py-12 text-gray-400">No tenants configured yet</div>
          ) : tenants.map(t => (
            <div key={t.id} className="bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => loadConfig(t.id)}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-900">{t.name || `Tenant #${t.id}`}</span>
                <div className="flex gap-2">
                  {t.branding?.white_label_mode && <Badge className="bg-purple-100 text-purple-700">White-Label</Badge>}
                  <Badge variant="outline">{t.type || 'standard'}</Badge>
                </div>
              </div>
              {t.branding?.primary_color && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: t.branding.primary_color }} />
                  <span className="text-xs text-gray-500">{t.branding.primary_color}</span>
                </div>
              )}
              <Button size="sm" variant="outline" className="mt-3">View Full Config →</Button>
            </div>
          ))}
        </div>
      )}

      {tab === 'detail' && selected && (
        <div className="space-y-6">
          <Button variant="outline" size="sm" onClick={() => setTab('tenants')}>← Back to Tenants</Button>
          {configLoading ? <div className="text-center py-8 text-gray-400">Loading config…</div> : config ? (
            <>
              {config.branding && (
                <div className="bg-white border rounded-xl p-5 shadow-sm">
                  <h3 className="font-semibold mb-3">Branding</h3>
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full border-2" style={{ backgroundColor: config.branding.primary_color || '#4F46E5' }} />
                    <span className="text-sm">{config.branding.primary_color}</span>
                    <span className="text-sm">Font: {config.branding.font_family}</span>
                    {config.branding.white_label_mode && <Badge className="bg-purple-100 text-purple-700">White-Label Active</Badge>}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border rounded-xl p-5 shadow-sm">
                  <h3 className="font-semibold mb-3">Permissions ({config.permissions?.length ?? 0})</h3>
                  <div className="space-y-2">
                    {(config.permissions || []).map(p => (
                      <div key={p.permission_key} className="flex items-center justify-between">
                        <span className="text-sm capitalize">{p.permission_key.replace(/_/g, ' ')}</span>
                        <Badge className={p.is_enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>{p.is_enabled ? 'Enabled' : 'Disabled'}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white border rounded-xl p-5 shadow-sm">
                  <h3 className="font-semibold mb-3">AI Features ({config.ai_config?.length ?? 0})</h3>
                  <div className="space-y-2">
                    {(config.ai_config || []).map(a => (
                      <div key={a.ai_feature} className="flex items-center justify-between">
                        <span className="text-sm capitalize">{a.ai_feature.replace(/_/g, ' ')}</span>
                        <Badge className={a.is_enabled ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}>{a.is_enabled ? 'On' : 'Off'}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : <div className="text-center text-gray-400">Config unavailable</div>}
        </div>
      )}
    </div>
  );
}
