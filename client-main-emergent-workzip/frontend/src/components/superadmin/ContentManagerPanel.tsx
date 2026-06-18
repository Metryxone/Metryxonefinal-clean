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

const BRAND = { primary: '#344E86', accent: '#4ECDC4', cyan: '#4ECDC4', lightBg: '#f8fafc', dark: '#1e293b', success: '#10b981', warning: '#f59e0b', danger: '#ef4444', purple: '#8b5cf6', indigo: '#6366f1' };
const PKG_CATEGORIES_DEFAULT = ['Psychometric', 'Academic', 'Counselling', 'Career', 'Wellness', 'Digital Skills', 'Leadership', 'Life Skills'];
const PKG_SUBCATEGORIES_DEFAULT = ['Entry', 'Standard', 'Premium', 'Enterprise'];

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

export default function ContentManagerPanel() {
  const { toast } = useToast();

  const DEFAULT_SLIDES = [
    { id: 'schools',       title: 'Schools: Understand how students really learn',               caption: 'Cognitive readiness, exam patterns, and learning behaviour — decoded for teachers and parents.', theme: 'student',     videoUrl: '', link: '/request-demo' },
    { id: 'campus',        title: 'Campus Hiring: Smarter placement drives at scale',             caption: 'Screen candidates on cognitive ability, role-fit, and adaptability — not just marks.',              theme: 'parent',      videoUrl: '', link: '/request-demo' },
    { id: 'employability', title: 'Employability: Measure workforce readiness',                   caption: 'Identify skill gaps, thinking quality, and career-readiness for job seekers and skilling platforms.', theme: 'planning',   videoUrl: '', link: '/request-demo' },
    { id: 'enterprise',    title: 'Enterprise: Competency benchmarks that drive smarter hiring',  caption: 'Map 50 competencies against real industry cohorts. Identify gaps, predict role-fit, and simulate growth.', theme: 'institution', videoUrl: '', link: '/request-demo' },
    { id: 'competency',    title: 'Competency Intelligence: From gap to growth in one platform',  caption: 'Universal benchmarking, role transition scoring, hiring prediction, and personalised intervention paths.', theme: 'planning',  videoUrl: '', link: '/request-demo' },
  ];

  const DEFAULT_LINKS = [
    { id: 'cta-hero',       label: 'Hero CTA Button',         url: '/request-demo',   target: '_self' },
    { id: 'cta-nav-demo',   label: 'Nav — Book Demo',         url: '/request-demo',   target: '_self' },
    { id: 'cta-nav-login',  label: 'Nav — Login',             url: '/login',          target: '_self' },
    { id: 'cta-enterprise', label: 'Enterprise Contact',      url: '/request-demo',   target: '_self' },
    { id: 'cta-docs',       label: 'Documentation Link',      url: 'https://docs.metryxone.com', target: '_blank' },
  ];

  const [slides, setSlides]             = useState(DEFAULT_SLIDES);
  const [links, setLinks]               = useState(DEFAULT_LINKS);
  const [contentSubTab, setContentSubTab] = useState<'slides' | 'upload' | 'links'>('slides');
  const [editingSlide, setEditingSlide] = useState<string | null>(null);
  const [saving, setSaving]             = useState(false);
  const [addingLink, setAddingLink]     = useState(false);
  const [newLink, setNewLink]           = useState({ label: '', url: '', target: '_self' });

  const handleSlideChange = (id: string, field: string, value: string) => {
    setSlides(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 800));
    setSaving(false);
    toast({ title: 'Content saved', description: 'Landing page content has been updated successfully.' });
  };

  const handleVideoUpload = (slideId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    handleSlideChange(slideId, 'videoUrl', url);
    toast({ title: 'Video staged', description: `${file.name} ready to publish.` });
  };

  const THEME_OPTIONS = [
    { value: 'student',     label: 'Student (Dark blue)' },
    { value: 'parent',      label: 'Parent (Navy)' },
    { value: 'planning',    label: 'Planning (Dark teal)' },
    { value: 'institution', label: 'Institution (Midnight)' },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: BRAND.primary }}>Content Manager</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage video slides, uploads and landing page links.</p>
        </div>
        <Button onClick={handleSave} disabled={saving} style={{ backgroundColor: BRAND.primary }} className="text-white gap-2">
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> Save All Changes</>}
        </Button>
      </div>

      {/* Sub-tab bar */}
      <div className="flex gap-1 p-1 rounded-xl border bg-gray-50 w-fit">
        {([
          { key: 'slides', label: 'Video Slides',  icon: Play   },
          { key: 'upload', label: 'Video Upload',  icon: Upload  },
          { key: 'links',  label: 'Links & CTAs',  icon: Link2   },
        ] as const).map(t => (
          <button key={t.key}
            onClick={() => setContentSubTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${contentSubTab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── VIDEO SLIDES editor ── */}
      {contentSubTab === 'slides' && (
        <div className="space-y-4">
          <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">
            {slides.length} slides · Drag to reorder (coming soon)
          </p>
          {slides.map((slide, idx) => (
            <div key={slide.id} className="border rounded-2xl overflow-hidden bg-white shadow-sm">
              {/* Slide header row */}
              <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ backgroundColor: BRAND.primary }}>{idx + 1}</span>
                  <span className="font-semibold text-sm text-gray-800 truncate max-w-xs">{slide.title}</span>
                  {slide.videoUrl && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">Video set</span>}
                </div>
                <button
                  onClick={() => setEditingSlide(editingSlide === slide.id ? null : slide.id)}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all hover:bg-gray-100"
                  style={{ color: BRAND.primary, borderColor: BRAND.primary + '40' }}>
                  {editingSlide === slide.id ? <><X className="h-3 w-3" /> Collapse</> : <><Edit className="h-3 w-3" /> Edit</>}
                </button>
              </div>

              {/* Expanded editor */}
              {editingSlide === slide.id && (
                <div className="p-5 grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Slide Title</label>
                    <Input value={slide.title} onChange={e => handleSlideChange(slide.id, 'title', e.target.value)} className="text-sm" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Caption / Description</label>
                    <Textarea value={slide.caption} onChange={e => handleSlideChange(slide.id, 'caption', e.target.value)} rows={2} className="text-sm resize-none" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Colour Theme</label>
                    <select
                      value={slide.theme}
                      onChange={e => handleSlideChange(slide.id, 'theme', e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
                      {THEME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">CTA Link (click-through)</label>
                    <Input value={slide.link} onChange={e => handleSlideChange(slide.id, 'link', e.target.value)} placeholder="/request-demo" className="text-sm" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Video URL (YouTube / direct MP4)</label>
                    <div className="flex gap-2">
                      <Input value={slide.videoUrl} onChange={e => handleSlideChange(slide.id, 'videoUrl', e.target.value)} placeholder="https://youtube.com/embed/… or https://cdn.example.com/video.mp4" className="text-sm flex-1" />
                      <label className="cursor-pointer">
                        <input type="file" accept="video/*" className="hidden" onChange={e => handleVideoUpload(slide.id, e)} />
                        <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium text-gray-600 hover:bg-gray-50 transition-all whitespace-nowrap">
                          <Upload className="h-3.5 w-3.5" /> Browse file
                        </span>
                      </label>
                    </div>
                    {slide.videoUrl && (
                      <p className="text-[11px] text-green-600 mt-1">✓ Video staged: {slide.videoUrl.substring(0, 60)}{slide.videoUrl.length > 60 ? '…' : ''}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── VIDEO UPLOAD ── */}
      {contentSubTab === 'upload' && (
        <div className="space-y-4">
          <div className="rounded-2xl border-2 border-dashed p-8 text-center bg-gray-50">
            <Upload className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="font-semibold text-gray-700 mb-1">Upload Videos for Each Slide</h3>
            <p className="text-sm text-gray-400 mb-4">Supports MP4, WebM, MOV · Max 200 MB per file · 1920×1080 recommended</p>
            <label className="cursor-pointer">
              <input type="file" accept="video/*" multiple className="hidden"
                onChange={e => {
                  Array.from(e.target.files || []).forEach((file, fi) => {
                    if (fi < slides.length) {
                      const url = URL.createObjectURL(file);
                      handleSlideChange(slides[fi].id, 'videoUrl', url);
                    }
                  });
                  toast({ title: 'Videos staged', description: `${e.target.files?.length} file(s) ready to publish.` });
                }}
              />
              <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium cursor-pointer" style={{ backgroundColor: BRAND.primary }}>
                <Upload className="h-4 w-4" /> Select Video Files
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {slides.map((slide, idx) => (
              <div key={slide.id} className="flex items-center gap-4 p-4 rounded-xl border bg-white">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: BRAND.primary }}>{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{slide.title}</p>
                  {slide.videoUrl
                    ? <p className="text-xs text-green-600 mt-0.5">✓ {slide.videoUrl.startsWith('blob:') ? 'File staged (not yet saved)' : slide.videoUrl.substring(0, 55) + (slide.videoUrl.length > 55 ? '…' : '')}</p>
                    : <p className="text-xs text-gray-400 mt-0.5">No video assigned — slide shows dark background</p>}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Input
                    value={slide.videoUrl}
                    onChange={e => handleSlideChange(slide.id, 'videoUrl', e.target.value)}
                    placeholder="Paste URL…"
                    className="text-xs w-48"
                  />
                  <label className="cursor-pointer">
                    <input type="file" accept="video/*" className="hidden" onChange={e => handleVideoUpload(slide.id, e)} />
                    <span className="flex items-center gap-1 px-2.5 py-2 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-all whitespace-nowrap cursor-pointer">
                      <Upload className="h-3 w-3" /> Upload
                    </span>
                  </label>
                  {slide.videoUrl && (
                    <button onClick={() => handleSlideChange(slide.id, 'videoUrl', '')} className="p-2 rounded-lg border hover:bg-red-50 hover:border-red-200 transition-all">
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── LINKS & CTAs ── */}
      {contentSubTab === 'links' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">{links.length} configured links</p>
            <Button variant="outline" size="sm" onClick={() => setAddingLink(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add Link
            </Button>
          </div>

          {addingLink && (
            <div className="p-4 rounded-2xl border-2 border-dashed bg-blue-50 space-y-3">
              <p className="text-xs font-semibold text-blue-700">New Link</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Label</label>
                  <Input value={newLink.label} onChange={e => setNewLink(l => ({ ...l, label: e.target.value }))} placeholder="e.g. Nav Demo Button" className="text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">URL</label>
                  <Input value={newLink.url} onChange={e => setNewLink(l => ({ ...l, url: e.target.value }))} placeholder="/request-demo" className="text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Opens In</label>
                  <select value={newLink.target} onChange={e => setNewLink(l => ({ ...l, target: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
                    <option value="_self">Same tab</option>
                    <option value="_blank">New tab</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" style={{ backgroundColor: BRAND.primary }} className="text-white gap-1"
                  onClick={() => {
                    if (!newLink.label || !newLink.url) return;
                    setLinks(l => [...l, { id: `link-${Date.now()}`, ...newLink }]);
                    setNewLink({ label: '', url: '', target: '_self' });
                    setAddingLink(false);
                  }}>
                  <Check className="h-3.5 w-3.5" /> Add
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAddingLink(false)}>Cancel</Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {links.map(link => (
              <div key={link.id} className="flex items-center gap-4 px-4 py-3 rounded-xl border bg-white">
                <Link2 className="h-4 w-4 flex-shrink-0 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{link.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{link.url} · opens {link.target === '_blank' ? 'new tab' : 'same tab'}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Input
                    value={link.url}
                    onChange={e => setLinks(l => l.map(li => li.id === link.id ? { ...li, url: e.target.value } : li))}
                    className="text-xs w-48"
                  />
                  <select
                    value={link.target}
                    onChange={e => setLinks(l => l.map(li => li.id === link.id ? { ...li, target: e.target.value } : li))}
                    className="border rounded-lg px-2 py-1 text-xs bg-white">
                    <option value="_self">Same tab</option>
                    <option value="_blank">New tab</option>
                  </select>
                  <button onClick={() => setLinks(l => l.filter(li => li.id !== link.id))} className="p-2 rounded-lg border hover:bg-red-50 hover:border-red-200 transition-all">
                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

