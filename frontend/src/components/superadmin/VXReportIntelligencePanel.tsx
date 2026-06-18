import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ReportOverview { templates_by_type: { report_type: string; count: number; white_label: number }[]; sections_by_content: { content_type: string; count: number }[]; narrative_rules_by_dimension: { dimension: string; rules: number }[]; generation_log_summary: { status: string; count: number }[]; }
interface Template { id: number; template_code: string; template_name: string; report_type: string; target_audience: string; sections: string[]; supported_languages: string[]; is_white_label: boolean; is_active: boolean; }
interface Section { id: number; section_code: string; section_name: string; content_type: string; data_source: string; order_index: number; is_optional: boolean; }
interface NarrativeRule { id: number; rule_code: string; dimension: string; score_band: string; band_min: number; band_max: number; tone: string; narrative_template: string; call_to_action: string; }

const CONTENT_TYPE_COLORS: Record<string, string> = { narrative: 'bg-blue-100 text-blue-800', score_card: 'bg-indigo-100 text-indigo-800', chart: 'bg-purple-100 text-purple-800', recommendation_list: 'bg-green-100 text-green-800', gap_analysis: 'bg-orange-100 text-orange-800', timeline: 'bg-cyan-100 text-cyan-800', comparison: 'bg-amber-100 text-amber-800' };
const TONE_COLORS: Record<string, string> = { encouraging: 'bg-green-100 text-green-700', developmental: 'bg-blue-100 text-blue-700', executive: 'bg-purple-100 text-purple-700', direct: 'bg-orange-100 text-orange-700', technical: 'bg-gray-100 text-gray-700' };
const AUDIENCE_COLORS: Record<string, string> = { candidate: 'bg-blue-100 text-blue-700', manager: 'bg-purple-100 text-purple-700', hr: 'bg-indigo-100 text-indigo-700', executive: 'bg-gray-100 text-gray-800' };

export default function VXReportIntelligencePanel() {
  const [tab, setTab] = useState<'overview' | 'templates' | 'sections' | 'narratives' | 'generate'>('overview');
  const [overview, setOverview] = useState<ReportOverview | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [narratives, setNarratives] = useState<NarrativeRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [genDim, setGenDim] = useState('employability');
  const [genScore, setGenScore] = useState('72');
  const [genResult, setGenResult] = useState<{ narrative: string; call_to_action: string; tone: string; score_band: string } | null>(null);
  const [genLoading, setGenLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/vx/reports/overview').then(r => r.json()).catch(() => null),
      fetch('/api/admin/vx/reports/templates').then(r => r.json()).catch(() => ({ templates: [] })),
      fetch('/api/admin/vx/reports/sections').then(r => r.json()).catch(() => ({ sections: [] })),
      fetch('/api/admin/vx/reports/narrative-rules').then(r => r.json()).catch(() => ({ rules: [] })),
    ]).then(([ov, t, s, n]) => {
      setOverview(ov);
      setTemplates(t.templates || []);
      setSections(s.sections || []);
      setNarratives(n.rules || []);
      setLoading(false);
    });
  }, []);

  const generateNarrative = () => {
    setGenLoading(true);
    fetch('/api/vx/reports/generate-narrative', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dimension: genDim, score: parseFloat(genScore), language: 'en' }),
    }).then(r => r.json()).then(d => { setGenResult(d); setGenLoading(false); }).catch(() => setGenLoading(false));
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Report Intelligence Platform…</div>;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Report Intelligence Platform <span className="text-sm font-normal text-gray-500 ml-2">VX-D21</span></h2>
          <p className="text-sm text-gray-500 mt-1">Report templates · narrative engine · section library · white-label · multi-language</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['overview', 'templates', 'sections', 'narratives', 'generate'] as const).map(t => (
            <Button key={t} variant={tab === t ? 'default' : 'outline'} size="sm" onClick={() => setTab(t)} className="capitalize">{t}</Button>
          ))}
        </div>
      </div>

      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Report Templates', value: templates.length },
            { label: 'Content Sections', value: sections.length },
            { label: 'Narrative Rules', value: narratives.length },
            { label: 'White-Label Templates', value: templates.filter(t => t.is_white_label).length },
          ].map(s => (
            <div key={s.label} className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="text-2xl font-bold text-indigo-700">{s.value}</div>
              <div className="text-sm text-gray-600 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'overview' && overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold mb-4">Templates by Report Type</h3>
            <div className="space-y-3">
              {(overview.templates_by_type || []).map(t => (
                <div key={t.report_type} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{t.report_type.replace(/_/g, ' ')}</span>
                  <div className="flex gap-2">
                    <Badge variant="outline">{t.count} templates</Badge>
                    {Number(t.white_label) > 0 && <Badge className="bg-purple-100 text-purple-700">{t.white_label} WL</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold mb-4">Narrative Rules by Dimension</h3>
            <div className="space-y-3">
              {(overview.narrative_rules_by_dimension || []).map(n => (
                <div key={n.dimension} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{n.dimension.replace(/_/g, ' ')}</span>
                  <Badge variant="outline">{n.rules} rules</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map(t => (
            <div key={t.id} className="bg-white border rounded-xl p-5 shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <div><div className="font-semibold text-gray-900">{t.template_name}</div><div className="text-xs font-mono text-gray-400">{t.template_code}</div></div>
                <div className="flex gap-2">
                  {t.is_white_label && <Badge className="bg-purple-100 text-purple-700">White-Label</Badge>}
                  <Badge className={AUDIENCE_COLORS[t.target_audience] || 'bg-gray-100'}>{t.target_audience}</Badge>
                </div>
              </div>
              <Badge variant="outline" className="capitalize text-xs">{t.report_type.replace(/_/g, ' ')}</Badge>
              <div className="flex flex-wrap gap-1 mt-3">
                {(t.sections || []).map(s => <Badge key={s} variant="outline" className="text-xs">{s}</Badge>)}
              </div>
              <div className="flex gap-2 mt-3">
                {(t.supported_languages || []).map(l => <Badge key={l} variant="outline" className="text-xs uppercase">{l}</Badge>)}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'sections' && (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>{['Order', 'Section Name', 'Content Type', 'Data Source', 'Optional'].map(h => <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>)}</tr></thead>
            <tbody className="divide-y">
              {sections.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400">{s.order_index}</td>
                  <td className="px-4 py-3"><div className="font-medium">{s.section_name}</div><div className="text-xs font-mono text-gray-400">{s.section_code}</div></td>
                  <td className="px-4 py-3"><Badge className={CONTENT_TYPE_COLORS[s.content_type] || 'bg-gray-100'}>{s.content_type.replace(/_/g, ' ')}</Badge></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{s.data_source || '—'}</td>
                  <td className="px-4 py-3">{s.is_optional ? <Badge variant="outline" className="text-xs">Optional</Badge> : <Badge className="bg-blue-100 text-blue-700 text-xs">Required</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'narratives' && (
        <div className="space-y-4">
          {narratives.map(n => (
            <div key={n.id} className="bg-white border rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <Badge variant="outline" className="capitalize">{n.dimension}</Badge>
                <Badge variant="outline">{n.score_band} ({n.band_min}–{n.band_max})</Badge>
                <Badge className={TONE_COLORS[n.tone] || 'bg-gray-100'}>{n.tone}</Badge>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{n.narrative_template}</p>
              {n.call_to_action && <div className="mt-3 bg-indigo-50 rounded-lg p-3 text-sm text-indigo-800"><strong>CTA:</strong> {n.call_to_action}</div>}
            </div>
          ))}
        </div>
      )}

      {tab === 'generate' && (
        <div className="space-y-6 max-w-2xl">
          <div className="bg-white border rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold mb-4">Narrative Engine — Live Test</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Dimension</label>
                  <Select value={genDim} onValueChange={setGenDim}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['employability', 'leadership', 'future_readiness', 'career'].map(d => <SelectItem key={d} value={d} className="capitalize">{d.replace(/_/g, ' ')}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Score (0–100)</label>
                  <Input value={genScore} onChange={e => setGenScore(e.target.value)} type="number" min="0" max="100" className="mt-1" />
                </div>
              </div>
              <Button onClick={generateNarrative} disabled={genLoading} className="w-full">{genLoading ? 'Generating…' : 'Generate Narrative'}</Button>
            </div>
          </div>
          {genResult && (
            <div className="bg-white border rounded-xl p-6 shadow-sm">
              <div className="flex gap-2 mb-4">
                <Badge variant="outline">{genResult.score_band}</Badge>
                <Badge className={TONE_COLORS[genResult.tone] || 'bg-gray-100'}>{genResult.tone}</Badge>
              </div>
              <p className="text-sm text-gray-800 leading-relaxed">{genResult.narrative}</p>
              {genResult.call_to_action && <div className="mt-4 bg-indigo-50 rounded-lg p-4 text-sm text-indigo-800"><strong>Recommended next step:</strong> {genResult.call_to_action}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
