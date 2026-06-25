import { BRAND } from '@/design-system/tokens';
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

export default function CounsellorDirectoryPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Counsellor | undefined>(undefined);

  const { data, isLoading } = useQuery<{ counsellors: Counsellor[]; total: number }>({
    queryKey: ['counsellor-directory', search, showInactive],
    queryFn: () =>
      fetch(
        `/api/admin/rie/counsellors/directory?search=${encodeURIComponent(search)}&include_inactive=${showInactive}`,
        { credentials: 'include' }
      ).then(r => r.json()),
    staleTime: 10_000,
  });

  const toggleActive = useMutation({
    mutationFn: (c: Counsellor) =>
      fetch(`/api/admin/rie/counsellors/${c.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !c.active }),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['counsellor-directory'] });
      qc.invalidateQueries({ queryKey: ['rie-counsellors'] });
    },
    onError: () => toast({ title: 'Failed to update status', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin/rie/counsellors/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['counsellor-directory'] });
      qc.invalidateQueries({ queryKey: ['rie-counsellors'] });
      toast({ title: 'Counsellor removed' });
    },
    onError: () => toast({ title: 'Delete failed', variant: 'destructive' }),
  });

  const counsellors = data?.counsellors || [];

  function openAdd() {
    setEditing(undefined);
    setModalOpen(true);
  }

  function openEdit(c: Counsellor) {
    setEditing(c);
    setModalOpen(true);
  }

  function handleSaved() {
    qc.invalidateQueries({ queryKey: ['counsellor-directory'] });
    qc.invalidateQueries({ queryKey: ['rie-counsellors'] });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {modalOpen && (
        <CounsellorModal
          counsellor={editing}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-5 w-5" style={{ color: BRAND }} />
            Counsellor Directory
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Pre-register counsellors so the assignment dropdown is always ready
          </p>
        </div>
        <Button
          className="text-white text-sm flex items-center gap-1.5"
          style={{ backgroundColor: BRAND }}
          onClick={openAdd}
        >
          <Plus className="h-4 w-4" />
          Add Counsellor
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name or email…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
            <button
              onClick={() => setShowInactive(v => !v)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap"
            >
              {showInactive
                ? <ToggleRight className="h-4 w-4 text-blue-500" />
                : <ToggleLeft className="h-4 w-4" />}
              Show inactive
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : counsellors.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No counsellors found</p>
              <p className="text-xs text-gray-400 mt-1">
                Add counsellors above so they appear in the assignment dropdown
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-gray-500 uppercase tracking-wide">
                    <th className="text-left pb-2 font-medium">Name</th>
                    <th className="text-left pb-2 font-medium">Email</th>
                    <th className="text-left pb-2 font-medium">Specialisation</th>
                    <th className="text-left pb-2 font-medium">Status</th>
                    <th className="text-right pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {counsellors.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 font-medium text-gray-900">{c.name}</td>
                      <td className="py-3 text-gray-600">{c.email}</td>
                      <td className="py-3 text-gray-500 text-xs">{c.specialisation || '—'}</td>
                      <td className="py-3">
                        <Badge
                          variant="outline"
                          className="text-[10px]"
                          style={c.active
                            ? { borderColor: '#10B981', color: '#10B981' }
                            : { borderColor: '#9CA3AF', color: '#9CA3AF' }
                          }
                        >
                          {c.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(c)}
                            className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => toggleActive.mutate(c)}
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                            title={c.active ? 'Deactivate' : 'Activate'}
                          >
                            {c.active
                              ? <ToggleRight className="h-3.5 w-3.5 text-blue-500" />
                              : <ToggleLeft className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Permanently remove ${c.name} from the directory?\n\nTip: if you only want to stop them appearing in the assign dropdown, use the toggle to deactivate instead.`)) {
                                deleteMutation.mutate(c.id);
                              }
                            }}
                            className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                            title="Delete"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data?.total !== undefined && (
            <p className="text-[10px] text-gray-400 mt-3 text-right">
              {data.total} counsellor{data.total !== 1 ? 's' : ''} total
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
