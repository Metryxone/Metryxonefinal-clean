import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield, Building2, Users, Briefcase, CreditCard,
  CheckCircle, XCircle, Clock, AlertTriangle, Settings,
  FileText, UserCheck, DollarSign, TrendingUp, Activity,
  Eye, UserPlus, Ban, RefreshCw, Search, Filter, LayoutGrid, LayoutList,
  Key, Lock, Unlock, ScrollText, BookOpen, Wallet, Receipt,
  Globe, Hash, GraduationCap, AlertCircle, ChevronDown,
  ChevronRight, Download, Upload, MoreHorizontal, LogOut,
  Fingerprint, ShieldCheck, Database, Server, BarChart3,
  PieChart, ArrowUpRight, ArrowDownRight, Building, Heart,
  FileCheck, UserCog, ClipboardList, Landmark, Scale,
  Plus, Trash2, Edit, Check, X, Bell, Menu, Home, RotateCcw, ArrowRight,
  Brain, Target, LineChart, Award, HelpCircle, Sparkles,
  Mail, Smartphone, Zap, Save, ToggleLeft, Loader2, Info, Send,
  Star, Calendar, MailCheck, History, Layers, Play,
  Crown, Package, Baby, UserCircle2, School, BookMarked,
  HeartPulse, Stethoscope, MapPin, Phone, Link2, ChevronLeft,
  ChevronUp, BadgeCheck, BadgeX, Clipboard, Repeat2, GitBranch,
  Calculator, SlidersHorizontal, FlaskConical, BarChart2, Percent,
  Cpu, Archive, Bot, Network
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import { Progress } from '../ui/progress';
import { ScrollArea } from '../ui/scroll-area';
import { Checkbox } from '../ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { useAdminDashboard } from '@/contexts/AdminDashboardContext';
const NAVY = '#344E86';

const BRAND = { primary: '#344E86', accent: '#4ECDC4', cyan: '#4ECDC4', lightBg: '#f8fafc', dark: '#1e293b', success: '#10b981', warning: '#f59e0b', danger: '#ef4444', purple: '#8b5cf6', indigo: '#6366f1' };
const PKG_CATEGORIES_DEFAULT = ['Psychometric', 'Academic', 'Counselling', 'Career', 'Wellness', 'Digital Skills', 'Leadership', 'Life Skills'];
const PKG_SUBCATEGORIES_DEFAULT = ['Entry', 'Standard', 'Premium', 'Enterprise'];

interface Category {
  id: number;
  cat_key: string;
  label: string;
  keywords: string;
  severity_high: string | null;
  severity_low: string | null;
  default_signals: string[];
  patterns: string[];
  subdomains: string[];
  preview_templates: string[];
  mirror_templates: string[];
  sort_order: number;
  is_active: boolean;
  updated_at?: string;
}

interface Question {
  id: number;
  question_key: string;
  category: string;
  persona: string | null;
  sort_order: number;
  question: string;
  options: string[];
  is_active: boolean;
  updated_at?: string;
}

const CAT_COLORS: Record<string, string> = {
  digital: '#6366f1',
  academic: '#0ea5e9',
  emotional: '#ec4899',
  behavioural: '#f59e0b',
  social: '#8b5cf6',
  career: '#10b981',
  wellness: '#14b8a6',
  general: NAVY,
};

const PERSONAS: { id: string | null; label: string }[] = [
  { id: null, label: 'Base (default)' },
  { id: 'parent', label: 'Parent' },
  { id: 'professional', label: 'Professional' },
  { id: 'campus', label: 'Campus' },
  { id: 'jobseeker', label: 'Jobseeker' },
  { id: 'teacher', label: 'Teacher' },
];

const arrToText = (a?: string[] | null): string => (Array.isArray(a) ? a.join('\n') : '');
const textToArr = (t: string): string[] => t.split('\n').map(s => s.trim()).filter(Boolean);

function formatEntityType(type?: string): string {
  if (!type) return '';
  switch (type.toLowerCase()) {
    case 'ngo': return 'NGO'; case 'lei': return 'LEI';
    default: return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
  }
}
function formatDate(d?: string | null) { if (!d) return '—'; try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; } }
function formatDateTime(d?: string | null) { if (!d) return '—'; try { return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return d; } }
function formatCurrency(n?: number | null) { if (n == null) return '—'; return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n); }
function getStatusBadge(status?: string) {
  const s = (status || '').toLowerCase();
  const map: Record<string, string> = { active: 'bg-green-100 text-green-800', inactive: 'bg-gray-100 text-gray-800', pending: 'bg-yellow-100 text-yellow-800', approved: 'bg-green-100 text-green-800', rejected: 'bg-red-100 text-red-800', suspended: 'bg-red-100 text-red-800', verified: 'bg-blue-100 text-blue-800' };
  return map[s] || 'bg-gray-100 text-gray-700';
}

export default function ConcernIntelligencePanel() {
  const [activeTab, setActiveTab] = useState<'categories' | 'questions'>('categories');
  const [categories, setCategories] = useState<Category[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [qSearch, setQSearch] = useState('');
  const [qCatFilter, setQCatFilter] = useState('');
  const [qPersonaFilter, setQPersonaFilter] = useState('');
  const [editQ, setEditQ] = useState<Question | null | 'new'>('new' as any);
  const [showModal, setShowModal] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadCategories = useCallback(async () => {
    const r = await fetch('/api/admin/ci/categories');
    if (!r.ok) throw new Error('Failed to load categories');
    setCategories(await r.json());
  }, []);

  const loadQuestions = useCallback(async () => {
    const r = await fetch('/api/admin/ci/questions');
    if (!r.ok) throw new Error('Failed to load questions');
    setQuestions(await r.json());
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadCategories(), loadQuestions()])
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [loadCategories, loadQuestions]);

  const saveCategory = async (key: string, data: Partial<Category>) => {
    const r = await fetch(`/api/admin/ci/categories/${key}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (!r.ok) { showToast('Error saving category'); return; }
    await loadCategories();
    showToast('Category saved successfully');
  };

  const saveQuestion = async (data: Partial<Question> & { id?: number }) => {
    const isEdit = data.id !== undefined;
    const r = await fetch(
      isEdit ? `/api/admin/ci/questions/${data.id}` : '/api/admin/ci/questions',
      { method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }
    );
    if (!r.ok) { const e = await r.json(); showToast(e.error || 'Error saving'); return; }
    await loadQuestions();
    setShowModal(false);
    showToast(isEdit ? 'Question updated' : 'Question added');
  };

  const deleteQuestion = async (id: number) => {
    if (!confirm('Delete this question?')) return;
    const r = await fetch(`/api/admin/ci/questions/${id}`, { method: 'DELETE' });
    if (!r.ok) { showToast('Error deleting'); return; }
    await loadQuestions();
    showToast('Question deleted');
  };

  const filteredQ = questions.filter(q => {
    const matchSearch = !qSearch || q.question.toLowerCase().includes(qSearch.toLowerCase()) || q.question_key.includes(qSearch.toLowerCase());
    const matchCat = !qCatFilter || q.category === qCatFilter;
    const matchPersona = !qPersonaFilter || (qPersonaFilter === 'base' ? q.persona === null : q.persona === qPersonaFilter);
    return matchSearch && matchCat && matchPersona;
  });

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${NAVY}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ color: '#64748b', fontSize: 13 }}>Loading intelligence engine…</p>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ padding: 24, background: 'rgba(220,38,38,0.06)', borderRadius: 12, border: '1px solid rgba(220,38,38,0.2)', margin: 24 }}>
      <p style={{ color: '#DC2626', fontWeight: 600, margin: 0 }}>Error: {error}</p>
      <p style={{ color: '#64748b', fontSize: 12, margin: '6px 0 0' }}>The concern intelligence tables may not exist yet. Run the migration SQL first.</p>
    </div>
  );

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1100, margin: '0 auto' }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 24, padding: '10px 18px', borderRadius: 10, background: NAVY, color: '#fff', fontSize: 13, fontWeight: 600, zIndex: 10000, boxShadow: '0 4px 20px rgba(52,78,134,0.3)', animation: 'mxMsgIn 0.2s ease' }}>
          {toast}
        </div>
      )}

      {showModal && (
        <QuestionModal
          q={editQ === 'new' ? null : editQ as Question}
          categories={categories}
          onSave={saveQuestion}
          onClose={() => setShowModal(false)}
        />
      )}

      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#1e293b', letterSpacing: '-0.3px' }}>Concern Intelligence Engine</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Manage categories, detection keywords, adaptive questions, and content templates powering the CAPADEX concern analyze flow.</p>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, padding: 4, background: '#f1f5f9', borderRadius: 10, width: 'fit-content' }}>
        {(['categories', 'questions'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, background: activeTab === tab ? '#fff' : 'transparent', color: activeTab === tab ? NAVY : '#64748b', boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s', textTransform: 'capitalize' }}>
            {tab === 'categories' ? `Categories (${categories.length})` : `Questions (${questions.length})`}
          </button>
        ))}
      </div>

      {activeTab === 'categories' && (
        <div>
          {categories.map(cat => (
            <CategoryCard key={cat.cat_key} cat={cat} onSave={saveCategory} />
          ))}
          {categories.length === 0 && (
            <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
              <p style={{ fontSize: 14 }}>No categories found. Run the migration SQL to seed initial data.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'questions' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 200px' }}>
              <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input value={qSearch} onChange={e => setQSearch(e.target.value)} placeholder="Search questions…"
                style={{ width: '100%', height: 34, borderRadius: 8, border: '1px solid #e2e8f0', paddingLeft: 28, fontSize: 12.5, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <select value={qCatFilter} onChange={e => setQCatFilter(e.target.value)}
              style={{ height: 34, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, padding: '0 10px', outline: 'none', minWidth: 140 }}>
              <option value=''>All Categories</option>
              {categories.map(c => <option key={c.cat_key} value={c.cat_key}>{c.label}</option>)}
            </select>
            <select value={qPersonaFilter} onChange={e => setQPersonaFilter(e.target.value)}
              style={{ height: 34, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, padding: '0 10px', outline: 'none', minWidth: 160 }}>
              <option value=''>All Personas</option>
              {PERSONAS.map(p => <option key={String(p.id)} value={p.id || 'base'}>{p.label}</option>)}
            </select>
            {(qSearch || qCatFilter || qPersonaFilter) && (
              <button onClick={() => { setQSearch(''); setQCatFilter(''); setQPersonaFilter(''); }}
                style={{ height: 34, padding: '0 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: 5 }}>
                <X size={12} /> Clear
              </button>
            )}
            <button onClick={() => { setEditQ(null); setShowModal(true); }}
              style={{ height: 34, padding: '0 16px', borderRadius: 8, border: 'none', background: NAVY, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <Plus size={13} /> Add Question
            </button>
          </div>

          <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Key', 'Category', 'Persona', 'Question', 'Options', 'Active', ''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredQ.map((q, idx) => {
                  const color = CAT_COLORS[q.category] || NAVY;
                  return (
                    <tr key={q.id} style={{ borderBottom: '1px solid #f0f4f8', background: idx % 2 === 0 ? '#fff' : '#fafbfe' }}>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 10.5, color: '#64748b', whiteSpace: 'nowrap' }}>{q.question_key}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 8, background: `${color}12`, color, fontSize: 10.5, fontWeight: 600 }}>{q.category}</span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 8, background: q.persona ? 'rgba(139,92,246,0.1)' : '#f1f5f9', color: q.persona ? '#7C3AED' : '#64748b', fontSize: 10.5, fontWeight: 600 }}>
                          {q.persona || 'base'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', maxWidth: 260 }}>
                        <p style={{ margin: 0, fontSize: 12.5, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.question}</p>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 11 }}>{q.options.length} options</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: q.is_active ? '#16A34A' : '#DC2626', display: 'inline-block' }} />
                      </td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        <button onClick={() => { setEditQ(q); setShowModal(true); }}
                          style={{ border: 'none', background: 'rgba(52,78,134,0.06)', color: NAVY, borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', marginRight: 5, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Edit size={10} /> Edit
                        </button>
                        <button onClick={() => deleteQuestion(q.id)}
                          style={{ border: 'none', background: 'rgba(220,38,38,0.07)', color: '#DC2626', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Trash2 size={10} /> Del
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredQ.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                      No questions match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 11, color: '#94a3b8' }}>Showing {filteredQ.length} of {questions.length} questions</p>
        </div>
      )}
    </div>
  );
}

// ─── Category editor card ─────────────────────────────────────────────────────
function CategoryCard({ cat, onSave }: { cat: Category; onSave: (key: string, data: Partial<Category>) => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(cat.label || '');
  const [keywords, setKeywords] = useState(cat.keywords || '');
  const [sevHigh, setSevHigh] = useState(cat.severity_high || '');
  const [sevLow, setSevLow] = useState(cat.severity_low || '');
  const [signals, setSignals] = useState(arrToText(cat.default_signals));
  const [patterns, setPatterns] = useState(arrToText(cat.patterns));
  const [subdomains, setSubdomains] = useState(arrToText(cat.subdomains));
  const [previewT, setPreviewT] = useState(arrToText(cat.preview_templates));
  const [mirrorT, setMirrorT] = useState(arrToText(cat.mirror_templates));
  const [isActive, setIsActive] = useState(cat.is_active !== false);
  const [saving, setSaving] = useState(false);

  const color = CAT_COLORS[cat.cat_key] || NAVY;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(cat.cat_key, {
        label,
        keywords,
        severity_high: sevHigh || null,
        severity_low: sevLow || null,
        default_signals: textToArr(signals),
        patterns: textToArr(patterns),
        subdomains: textToArr(subdomains),
        preview_templates: textToArr(previewT),
        mirror_templates: textToArr(mirrorT),
        is_active: isActive,
      });
    } finally {
      setSaving(false);
    }
  };

  const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 5px' };
  const inputStyle: React.CSSProperties = { width: '100%', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12.5, padding: '8px 10px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, marginBottom: 12, overflow: 'hidden', background: '#fff' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
      >
        <span style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{cat.label}</div>
          <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{cat.cat_key}</div>
        </div>
        {!isActive && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#DC2626', background: 'rgba(220,38,38,0.07)', padding: '2px 8px', borderRadius: 8 }}>Inactive</span>}
        {open ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
      </button>

      {open && (
        <div style={{ padding: '4px 16px 16px', borderTop: '1px solid #f0f4f8' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
            <div>
              <label style={fieldLabel}>Label</label>
              <input style={inputStyle} value={label} onChange={e => setLabel(e.target.value)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <span style={{ fontSize: 12.5, color: '#475569', paddingBottom: 2 }}>Active</span>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={fieldLabel}>Detection Keywords (regex, pipe-separated)</label>
              <textarea style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }} value={keywords} onChange={e => setKeywords(e.target.value)} />
            </div>
            <div>
              <label style={fieldLabel}>Severity — High</label>
              <input style={inputStyle} value={sevHigh} onChange={e => setSevHigh(e.target.value)} placeholder="optional" />
            </div>
            <div>
              <label style={fieldLabel}>Severity — Low</label>
              <input style={inputStyle} value={sevLow} onChange={e => setSevLow(e.target.value)} placeholder="optional" />
            </div>
            <div>
              <label style={fieldLabel}>Default Signals (one per line)</label>
              <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} value={signals} onChange={e => setSignals(e.target.value)} />
            </div>
            <div>
              <label style={fieldLabel}>Patterns (one per line)</label>
              <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} value={patterns} onChange={e => setPatterns(e.target.value)} />
            </div>
            <div>
              <label style={fieldLabel}>Subdomains (one per line)</label>
              <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} value={subdomains} onChange={e => setSubdomains(e.target.value)} />
            </div>
            <div>
              <label style={fieldLabel}>Preview Templates (one per line)</label>
              <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} value={previewT} onChange={e => setPreviewT(e.target.value)} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={fieldLabel}>Mirror Templates (one per line)</label>
              <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} value={mirrorT} onChange={e => setMirrorT(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ height: 36, padding: '0 18px', borderRadius: 8, border: 'none', background: NAVY, color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save Category
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Question create / edit modal ─────────────────────────────────────────────
function QuestionModal({ q, categories, onSave, onClose }: {
  q: Question | null;
  categories: Category[];
  onSave: (data: Partial<Question> & { id?: number }) => void | Promise<void>;
  onClose: () => void;
}) {
  const [questionKey, setQuestionKey] = useState(q?.question_key || '');
  const [category, setCategory] = useState(q?.category || categories[0]?.cat_key || '');
  const [persona, setPersona] = useState<string>(q?.persona || 'base');
  const [sortOrder, setSortOrder] = useState<number>(q?.sort_order ?? 0);
  const [question, setQuestion] = useState(q?.question || '');
  const [options, setOptions] = useState<string[]>(q?.options?.length ? [...q.options] : ['', '']);
  const [isActive, setIsActive] = useState(q?.is_active !== false);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const isEdit = !!q;

  const updateOption = (i: number, v: string) => setOptions(opts => opts.map((o, idx) => (idx === i ? v : o)));
  const addOption = () => setOptions(opts => [...opts, '']);
  const removeOption = (i: number) => setOptions(opts => opts.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    const cleanOpts = options.map(o => o.trim()).filter(Boolean);
    if (!questionKey.trim() || !category || !question.trim() || cleanOpts.length < 2) {
      setErr('Question key, category, question text, and at least 2 options are required.');
      return;
    }
    setErr('');
    setSaving(true);
    try {
      await onSave({
        ...(q?.id !== undefined ? { id: q.id } : {}),
        question_key: questionKey.trim(),
        category,
        persona: persona === 'base' ? null : persona,
        sort_order: Number(sortOrder) || 0,
        question: question.trim(),
        options: cleanOpts,
        ...(isEdit ? { is_active: isActive } : {}),
      });
    } finally {
      setSaving(false);
    }
  };

  const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 5px' };
  const inputStyle: React.CSSProperties = { width: '100%', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12.5, padding: '8px 10px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid #f0f4f8' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1e293b' }}>{isEdit ? 'Edit Question' : 'Add Question'}</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
        </div>

        <div style={{ padding: 20 }}>
          {err && (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', color: '#DC2626', fontSize: 12, marginBottom: 14 }}>{err}</div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={fieldLabel}>Question Key</label>
              <input style={{ ...inputStyle, fontFamily: 'monospace' }} value={questionKey} onChange={e => setQuestionKey(e.target.value)} placeholder="e.g. digital_duration" disabled={isEdit} />
            </div>
            <div>
              <label style={fieldLabel}>Category</label>
              <select style={inputStyle} value={category} onChange={e => setCategory(e.target.value)}>
                {categories.map(c => <option key={c.cat_key} value={c.cat_key}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label style={fieldLabel}>Persona</label>
              <select style={inputStyle} value={persona} onChange={e => setPersona(e.target.value)}>
                {PERSONAS.map(p => <option key={String(p.id)} value={p.id || 'base'}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label style={fieldLabel}>Sort Order</label>
              <input type="number" style={inputStyle} value={sortOrder} onChange={e => setSortOrder(parseInt(e.target.value) || 0)} />
            </div>
            {isEdit && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <span style={{ fontSize: 12.5, color: '#475569', paddingBottom: 2 }}>Active</span>
              </div>
            )}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={fieldLabel}>Question</label>
              <textarea style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }} value={question} onChange={e => setQuestion(e.target.value)} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={fieldLabel}>Options</label>
              {options.map((opt, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input style={inputStyle} value={opt} onChange={e => updateOption(i, e.target.value)} placeholder={`Option ${i + 1}`} />
                  <button
                    onClick={() => removeOption(i)}
                    disabled={options.length <= 1}
                    style={{ border: '1px solid #e2e8f0', background: '#fff', borderRadius: 8, padding: '0 10px', cursor: options.length <= 1 ? 'default' : 'pointer', color: '#DC2626', opacity: options.length <= 1 ? 0.4 : 1, flexShrink: 0 }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <button
                onClick={addOption}
                style={{ border: '1px dashed #cbd5e1', background: '#f8fafc', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, color: '#475569', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                <Plus size={13} /> Add Option
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 20px', borderTop: '1px solid #f0f4f8' }}>
          <button onClick={onClose} style={{ height: 36, padding: '0 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 12.5, fontWeight: 600, color: '#64748b', cursor: 'pointer' }}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ height: 36, padding: '0 18px', borderRadius: 8, border: 'none', background: NAVY, color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} {isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
