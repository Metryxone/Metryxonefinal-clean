import React from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Key, Upload, Brain, Sparkles, Users, FileText, BookOpen, BarChart3,
  Check, X, Download, Eye, RefreshCw, Trash2, Globe, Save, Plus, Edit2,
  AlertTriangle, ChevronDown, ChevronUp, Search, Filter, MoreVertical,
} from 'lucide-react';
import { BRAND } from '@/lib/behavioural-insights';

export function AdminDialogs(props: Record<string, unknown>) {
  const ctx = props;
  const {
    domainDialog, setDomainDialog, compDomainDialog, setCompDomainDialog,
    domainDeleteId, setDomainDeleteId, compDomainDeleteId, setCompDomainDeleteId,
    lbiQDialog, setLbiQDialog, behaviorUploadDialog, setBehaviorUploadDialog,
    examUploadDialog, setExamUploadDialog, curriculumImportDialog, setCurriculumImportDialog,
    aiGenerateDialog, setAiGenerateDialog, examQuestionsDialog, setExamQuestionsDialog,
    psychoQuestionsDialog, setPsychoQuestionsDialog, lbiQuestionsDialog, setLbiQuestionsDialog,
    qbUploadDialog, setQbUploadDialog, blueprintDialog, setBlueprintDialog,
    actionDialog, setActionDialog, mentorDialog, setMentorDialog,
    inviteMentorModal, setInviteMentorModal, mentorNotifyModal, setMentorNotifyModal,
    mentorAdjPhiModal, setMentorAdjPhiModal, mentorProfileModal, setMentorProfileModal,
    documentRequestDialog, setDocumentRequestDialog,
    domainFormData, setDomainFormData, domainSaving, setDomainSaving, domainDeleting, setDomainDeleting,
    compDomainFormData, setCompDomainFormData, compDomainSaving, setCompDomainSaving, compDomainDeleting, setCompDomainDeleting,
    lbiQFormData, setLbiQFormData, lbiQSaving, setLbiQSaving,
    refetchLbiDomains, refetchLbiStats, refetchLbiSubdomains, refetchLbiAdminQ, refetchCompetencyDomains,
    sendingDocRequest, setSendingDocRequest,
    importDialog, setImportDialog, importFile, setImportFile, importLoading, setImportLoading, importResult, setImportResult,
    toast, queryClient, handleLogout,
    formatDate, formatDateTime, formatCurrency,
    activeTab, setActiveTab,
  } = ctx;

  return (
    <>
      <Dialog open={domainDialog.open} onOpenChange={(o) => setDomainDialog(d => ({ ...d, open: o }))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{domainDialog.mode === 'create' ? 'Create Competency Domain' : 'Edit Domain'}</DialogTitle>
            <DialogDescription>{domainDialog.mode === 'create' ? 'Add a new competency domain to the assessment framework.' : 'Update this domain\'s details.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Domain Code <span className="text-red-500">*</span></label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm font-mono uppercase" placeholder="e.g. ACE" value={domainFormData.domain_code} onChange={e => setDomainFormData(d => ({ ...d, domain_code: e.target.value.toUpperCase() }))} maxLength={20} />
                <p className="text-[10px] text-gray-400 mt-0.5">Short uppercase identifier (max 20 chars)</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Sort Order</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={domainFormData.sort_order} onChange={e => setDomainFormData(d => ({ ...d, sort_order: Number(e.target.value) }))} min={0} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Domain Name <span className="text-red-500">*</span></label>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Adaptability & Courage Ethos" value={domainFormData.domain_name} onChange={e => setDomainFormData(d => ({ ...d, domain_name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Description</label>
              <textarea className="w-full border rounded-lg px-3 py-2 text-sm resize-none" rows={3} placeholder="Describe what this domain measures..." value={domainFormData.description} onChange={e => setDomainFormData(d => ({ ...d, description: e.target.value }))} />
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="domain-active" checked={domainFormData.is_active} onChange={e => setDomainFormData(d => ({ ...d, is_active: e.target.checked }))} />
              <label htmlFor="domain-active" className="text-sm text-gray-700">Active (visible in assessments)</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDomainDialog(d => ({ ...d, open: false }))}>Cancel</Button>
            <Button
              disabled={domainSaving || !domainFormData.domain_code.trim() || !domainFormData.domain_name.trim()}
              style={{ backgroundColor: BRAND.primary }}
              className="text-white"
              onClick={async () => {
                setDomainSaving(true);
                try {
                  const url = domainDialog.mode === 'edit' ? `/api/lbi/admin/domains/${domainDialog.domain.id}` : '/api/lbi/admin/domains';
                  const method = domainDialog.mode === 'edit' ? 'PUT' : 'POST';
                  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(domainFormData) });
                  const data = await res.json();
                  if (!res.ok) { toast({ title: 'Error', description: data.message || 'Failed to save domain', variant: 'destructive' }); return; }
                  toast({ title: domainDialog.mode === 'create' ? 'Domain Created' : 'Domain Updated', description: `${data.domain_name} (${data.domain_code})` });
                  setDomainDialog(d => ({ ...d, open: false }));
                  refetchLbiDomains(); refetchLbiStats();
                  if (domainDialog.mode === 'create') setSelectedDomainCode(data.domain_code);
                } catch { toast({ title: 'Error', description: 'Failed to save domain', variant: 'destructive' }); }
                finally { setDomainSaving(false); }
              }}
            >
              {domainSaving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              {domainDialog.mode === 'create' ? 'Create Domain' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Domain Delete Confirm Dialog ===== */}
      <Dialog open={!!domainDeleteId} onOpenChange={(o) => { if (!o) setDomainDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600"><Trash2 className="h-5 w-5" /> Delete Domain</DialogTitle>
            <DialogDescription>This will permanently delete the domain. Items linked to this domain by code will not be deleted but may lose their domain reference. This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDomainDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" disabled={domainDeleting} onClick={async () => {
              if (!domainDeleteId) return;
              setDomainDeleting(true);
              try {
                const res = await fetch(`/api/lbi/admin/domains/${domainDeleteId}`, { method: 'DELETE', credentials: 'include' });
                if (res.ok) {
                  toast({ title: 'Domain Deleted' });
                  if (selectedDomainCode === lbiDomains.find((d: any) => d.id === domainDeleteId)?.domain_code) setSelectedDomainCode(null);
                  setDomainDeleteId(null);
                  refetchLbiDomains(); refetchLbiStats();
                } else throw new Error();
              } catch { toast({ title: 'Error', description: 'Failed to delete domain', variant: 'destructive' }); }
              finally { setDomainDeleting(false); }
            }}>
              {domainDeleting ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Competency Domain Edit Dialog ===== */}
      <Dialog open={compDomainDialog.open} onOpenChange={(o) => setCompDomainDialog(d => ({ ...d, open: o }))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Professional Competency Domain</DialogTitle>
            <DialogDescription>Update the details of this domain. The domain code ({compDomainDialog.domain?.code}) cannot be changed.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Domain Code</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm font-mono uppercase bg-gray-50 text-gray-500" value={compDomainDialog.domain?.code || ''} disabled />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Sort Order</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={compDomainFormData.sort_order} onChange={e => setCompDomainFormData(d => ({ ...d, sort_order: Number(e.target.value) }))} min={0} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Domain Name <span className="text-red-500">*</span></label>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" value={compDomainFormData.name} onChange={e => setCompDomainFormData(d => ({ ...d, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Description</label>
              <textarea className="w-full border rounded-lg px-3 py-2 text-sm resize-none" rows={3} value={compDomainFormData.description} onChange={e => setCompDomainFormData(d => ({ ...d, description: e.target.value }))} />
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="comp-domain-active" checked={compDomainFormData.is_active} onChange={e => setCompDomainFormData(d => ({ ...d, is_active: e.target.checked }))} />
              <label htmlFor="comp-domain-active" className="text-sm text-gray-700">Active</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompDomainDialog(d => ({ ...d, open: false }))}>Cancel</Button>
            <Button
              disabled={compDomainSaving || !compDomainFormData.name.trim()}
              style={{ backgroundColor: BRAND.primary }}
              className="text-white"
              onClick={async () => {
                if (!compDomainDialog.domain) return;
                setCompDomainSaving(true);
                try {
                  const res = await fetch(`/api/competency/domains/${compDomainDialog.domain.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ name: compDomainFormData.name, description: compDomainFormData.description, sort_order: compDomainFormData.sort_order, is_active: compDomainFormData.is_active }),
                  });
                  const data = await res.json();
                  if (!res.ok) { toast({ title: 'Error', description: data.error || 'Failed to save', variant: 'destructive' }); return; }
                  toast({ title: 'Domain Updated', description: data.name });
                  setCompDomainDialog(d => ({ ...d, open: false }));
                  refetchCompetencyDomains();
                } catch { toast({ title: 'Error', description: 'Failed to save domain', variant: 'destructive' }); }
                finally { setCompDomainSaving(false); }
              }}
            >
              {compDomainSaving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Competency Domain Delete Confirm Dialog ===== */}
      <Dialog open={!!compDomainDeleteId} onOpenChange={(o) => { if (!o) setCompDomainDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600"><Trash2 className="h-5 w-5" /> Delete Competency Domain</DialogTitle>
            <DialogDescription>This will permanently delete the domain and all its subdomains. This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCompDomainDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" disabled={compDomainDeleting} onClick={async () => {
              if (!compDomainDeleteId) return;
              setCompDomainDeleting(true);
              try {
                const res = await fetch(`/api/competency/domains/${compDomainDeleteId}`, { method: 'DELETE', credentials: 'include' });
                if (res.ok) {
                  toast({ title: 'Domain Deleted' });
                  if (selectedDomainCode === (competencyDomains as any[]).find((d: any) => d.id === compDomainDeleteId)?.code) setSelectedDomainCode(null);
                  setCompDomainDeleteId(null);
                  refetchCompetencyDomains();
                } else {
                  const data = await res.json();
                  toast({ title: 'Error', description: data.error || 'Failed to delete', variant: 'destructive' });
                }
              } catch { toast({ title: 'Error', description: 'Failed to delete domain', variant: 'destructive' }); }
              finally { setCompDomainDeleting(false); }
            }}>
              {compDomainDeleting ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== LBI Question Create/Edit Dialog ===== */}
      <Dialog open={lbiQDialog.open} onOpenChange={(o) => setLbiQDialog(d => ({ ...d, open: o }))}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{lbiQDialog.mode === 'create' ? 'Add Assessment Item' : 'Edit Assessment Item'}</DialogTitle>
            <DialogDescription>Create or edit a psychometric assessment item (question) in the LBI item bank.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Item Code <span className="text-red-500">*</span></label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder="e.g. ACE.CON.A.001" value={lbiQFormData.question_code} onChange={e => setLbiQFormData(d => ({ ...d, question_code: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Item Type</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm" value={lbiQFormData.question_type} onChange={e => setLbiQFormData(d => ({ ...d, question_type: e.target.value }))}>
                  {['likert','mcq','true_false','rating'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Domain <span className="text-red-500">*</span></label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm" value={lbiQFormData.domain_code} onChange={e => {
                  const lbiD = lbiDomains.find((d: any) => d.domain_code === e.target.value);
                  const compD = competencyDomains.find((d: any) => d.code === e.target.value);
                  setLbiQFormData(f => ({ ...f, domain_code: e.target.value, domain_name: lbiD?.domain_name || compD?.name || '', subdomain_code: '', subdomain_name: '' }));
                }}>
                  <option value="">Select domain...</option>
                  <optgroup label="LBI Behavioural Framework">
                    {lbiDomains.map((d: any) => <option key={d.id} value={d.domain_code}>{d.domain_code} — {d.domain_name}</option>)}
                  </optgroup>
                  <optgroup label="Professional Competency Framework">
                    {competencyDomains.map((d: any) => <option key={d.id} value={d.code}>{d.code} — {d.name}</option>)}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Subdomain</label>
                {(() => {
                  const compD = competencyDomains.find((d: any) => d.code === lbiQFormData.domain_code);
                  const lbiSubs = lbiAdminSubdomains.filter((s: any) => s.domain_code === lbiQFormData.domain_code);
                  const subs: { code: string; name: string }[] = compD?.subdomains?.map((s: any) => ({ code: s.code, name: s.name })) || lbiSubs.map((s: any) => ({ code: s.subdomain_code, name: s.subdomain_name }));
                  if (subs.length > 0) {
                    return (
                      <select className="w-full border rounded-lg px-3 py-2 text-sm" value={lbiQFormData.subdomain_code} onChange={e => {
                        const s = subs.find(x => x.code === e.target.value);
                        setLbiQFormData(f => ({ ...f, subdomain_code: e.target.value, subdomain_name: s?.name || '' }));
                      }}>
                        <option value="">Select subdomain...</option>
                        {subs.map(s => <option key={s.code} value={s.code}>{s.code} — {s.name}</option>)}
                      </select>
                    );
                  }
                  return <input className="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder="e.g. CON01" value={lbiQFormData.subdomain_code} onChange={e => setLbiQFormData(d => ({ ...d, subdomain_code: e.target.value }))} />;
                })()}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Subdomain Name</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Auto-filled or enter name" value={lbiQFormData.subdomain_name} readOnly={!!competencyDomains.find((d: any) => d.code === lbiQFormData.domain_code) || lbiAdminSubdomains.some((s: any) => s.domain_code === lbiQFormData.domain_code)} onChange={e => setLbiQFormData(d => ({ ...d, subdomain_name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Age Band</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm" value={lbiQFormData.age_band_code} onChange={e => setLbiQFormData(d => ({ ...d, age_band_code: e.target.value }))}>
                  {lbiAgeBands.length > 0 ? lbiAgeBands.map((b: any) => <option key={b.id} value={b.band_code}>Band {b.band_code} ({b.min_age}–{b.max_age})</option>) : ['A','B','C'].map(b => <option key={b} value={b}>Band {b}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Item Text (Statement) <span className="text-red-500">*</span></label>
              <textarea className="w-full border rounded-lg px-3 py-2 text-sm resize-none" rows={3} placeholder="Enter the assessment statement or question..." value={lbiQFormData.question_text} onChange={e => setLbiQFormData(d => ({ ...d, question_text: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Difficulty</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm" value={lbiQFormData.difficulty} onChange={e => setLbiQFormData(d => ({ ...d, difficulty: e.target.value }))}>
                  {['EASY','MEDIUM','HARD'].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Status</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm" value={lbiQFormData.status} onChange={e => setLbiQFormData(d => ({ ...d, status: e.target.value }))}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Weight</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={lbiQFormData.weight} min={0} step={0.5} onChange={e => setLbiQFormData(d => ({ ...d, weight: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={lbiQFormData.is_anchor} onChange={e => setLbiQFormData(d => ({ ...d, is_anchor: e.target.checked }))} />
                <span className="text-sm text-gray-700">Anchor Item</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={lbiQFormData.reverse_scored} onChange={e => setLbiQFormData(d => ({ ...d, reverse_scored: e.target.checked }))} />
                <span className="text-sm text-gray-700">Reverse Scored</span>
              </label>
            </div>
            {/* Options (for likert/mcq) */}
            <div className="border rounded-lg p-3 bg-gray-50">
              <p className="text-xs font-medium text-gray-600 mb-2">Response Options & Scores</p>
              <div className="space-y-2">
                {(['a','b','c','d','e'] as const).map((opt) => (
                  <div key={opt} className="flex items-center gap-2">
                    <span className="text-xs font-bold w-4 text-gray-500">{opt.toUpperCase()}</span>
                    <input className="flex-1 border rounded px-2 py-1 text-sm" placeholder={`Option ${opt.toUpperCase()} text`} value={(lbiQFormData as any)[`option_${opt}`]} onChange={e => setLbiQFormData(d => ({ ...d, [`option_${opt}`]: e.target.value } as any))} />
                    <input type="number" className="w-16 border rounded px-2 py-1 text-sm" placeholder="Score" value={(lbiQFormData as any)[`option_${opt}_score`]} onChange={e => setLbiQFormData(d => ({ ...d, [`option_${opt}_score`]: Number(e.target.value) } as any))} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLbiQDialog(d => ({ ...d, open: false }))}>Cancel</Button>
            <Button
              disabled={lbiQSaving || !lbiQFormData.question_code.trim() || !lbiQFormData.domain_code || !lbiQFormData.question_text.trim()}
              style={{ backgroundColor: BRAND.primary }}
              className="text-white"
              onClick={async () => {
                setLbiQSaving(true);
                try {
                  const url = lbiQDialog.mode === 'edit' ? `/api/lbi/admin/questions/${lbiQDialog.question.id}` : '/api/lbi/admin/questions';
                  const method = lbiQDialog.mode === 'edit' ? 'PUT' : 'POST';
                  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(lbiQFormData) });
                  const data = await res.json();
                  if (!res.ok) { toast({ title: 'Error', description: data.message || 'Failed to save item', variant: 'destructive' }); return; }
                  toast({ title: lbiQDialog.mode === 'create' ? 'Item Created' : 'Item Updated', description: `${data.question_code}` });
                  setLbiQDialog(d => ({ ...d, open: false }));
                  refetchLbiAdminQ(); refetchLbiStats(); refetchLbiSubdomains();
                } catch { toast({ title: 'Error', description: 'Failed to save item', variant: 'destructive' }); }
                finally { setLbiQSaving(false); }
              }}
            >
              {lbiQSaving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              {lbiQDialog.mode === 'create' ? 'Create Item' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Behavior Upload Dialog */}
      <Dialog open={behaviorUploadDialog} onOpenChange={(open) => { setBehaviorUploadDialog(open); setBehaviorUploadFile(null); setBehaviorUploadProgress(0); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Behavioral Insights</DialogTitle>
            <DialogDescription>
              Upload a CSV file with behavioral assessment data. Download the template first.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
              {behaviorUploadFile ? (
                <div className="space-y-2">
                  <FileText className="h-12 w-12 mx-auto text-gray-400" />
                  <p className="font-medium">{behaviorUploadFile.name}</p>
                  <p className="text-sm text-gray-500">{(behaviorUploadFile.size / 1024).toFixed(1)} KB</p>
                  <Button variant="ghost" size="sm" onClick={() => setBehaviorUploadFile(null)}>
                    <X className="h-4 w-4 mr-1" /> Remove
                  </Button>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <Upload className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                  <p className="font-medium text-gray-700">Click to select file</p>
                  <p className="text-sm text-gray-500">CSV files only</p>
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setBehaviorUploadFile(file);
                    }}
                    data-testid="input-behavior-file-upload"
                  />
                </label>
              )}
            </div>
            {behaviorUploading && (
              <div className="space-y-2">
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full transition-all duration-300" style={{ width: `${behaviorUploadProgress}%`, backgroundColor: BRAND.accent }} />
                </div>
                <p className="text-sm text-center text-gray-500">Uploading... {behaviorUploadProgress}%</p>
              </div>
            )}
            <div className="text-xs text-gray-500 space-y-1">
              <p><strong>Required columns:</strong> studentId, category, metric, value</p>
              <p><strong>Optional columns:</strong> description, recordedAt</p>
              <p><strong>Categories:</strong> Focus & Attention, Emotional Regulation, Social Skills, Learning Motivation, Resilience</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBehaviorUploadDialog(false)}>Cancel</Button>
            <Button
              disabled={!behaviorUploadFile || behaviorUploading}
              style={{ backgroundColor: BRAND.primary }}
              className="text-white"
              onClick={async () => {
                if (!behaviorUploadFile) return;
                setBehaviorUploading(true);
                setBehaviorUploadProgress(10);
                try {
                  const formData = new FormData();
                  formData.append('file', behaviorUploadFile);
                  setBehaviorUploadProgress(30);
                  const res = await fetch('/api/admin/behavior-insights/upload', {
                    method: 'POST',
                    credentials: 'include',
                    body: formData
                  });
                  setBehaviorUploadProgress(80);
                  if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.message || 'Upload failed');
                  }
                  const result = await res.json();
                  setBehaviorUploadProgress(100);
                  toast({ title: 'Success', description: `Uploaded ${result.count} behavioral records` });
                  setBehaviorUploadDialog(false);
                  setBehaviorUploadFile(null);
                  refetchBehaviorData();
                } catch (error: any) {
                  toast({ title: 'Upload Failed', description: error.message, variant: 'destructive' });
                } finally {
                  setBehaviorUploading(false);
                  setBehaviorUploadProgress(0);
                }
              }}
              data-testid="btn-submit-behavior-upload"
            >
              {behaviorUploading ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exam Results Upload Dialog */}
      <Dialog open={examUploadDialog} onOpenChange={(open) => { setExamUploadDialog(open); setExamUploadFile(null); setExamUploadProgress(0); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Exam Results</DialogTitle>
            <DialogDescription>
              Upload a CSV file with exam results. Download the template first.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
              {examUploadFile ? (
                <div className="space-y-2">
                  <FileText className="h-12 w-12 mx-auto text-gray-400" />
                  <p className="font-medium">{examUploadFile.name}</p>
                  <p className="text-sm text-gray-500">{(examUploadFile.size / 1024).toFixed(1)} KB</p>
                  <Button variant="ghost" size="sm" onClick={() => setExamUploadFile(null)}>
                    <X className="h-4 w-4 mr-1" /> Remove
                  </Button>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <Upload className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                  <p className="font-medium text-gray-700">Click to select file</p>
                  <p className="text-sm text-gray-500">CSV files only</p>
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setExamUploadFile(file);
                    }}
                    data-testid="input-exam-file-upload"
                  />
                </label>
              )}
            </div>
            {examUploading && (
              <div className="space-y-2">
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full transition-all duration-300" style={{ width: `${examUploadProgress}%`, backgroundColor: BRAND.accent }} />
                </div>
                <p className="text-sm text-center text-gray-500">Uploading... {examUploadProgress}%</p>
              </div>
            )}
            <div className="text-xs text-gray-500 space-y-1">
              <p><strong>Required columns:</strong> childId, title, subject, score, totalMarks</p>
              <p><strong>Optional columns:</strong> grade, examType, status, dueDate, completedAt, improvedTopics (semicolon-separated), focusAreas (semicolon-separated)</p>
              <p><strong>Status values:</strong> pending, completed</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExamUploadDialog(false)}>Cancel</Button>
            <Button
              disabled={!examUploadFile || examUploading}
              style={{ backgroundColor: BRAND.primary }}
              className="text-white"
              onClick={async () => {
                if (!examUploadFile) return;
                setExamUploading(true);
                setExamUploadProgress(10);
                try {
                  const formData = new FormData();
                  formData.append('file', examUploadFile);
                  setExamUploadProgress(30);
                  const res = await fetch('/api/admin/exam-ready/upload', {
                    method: 'POST',
                    credentials: 'include',
                    body: formData
                  });
                  setExamUploadProgress(80);
                  if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.message || 'Upload failed');
                  }
                  const result = await res.json();
                  setExamUploadProgress(100);
                  toast({ title: 'Success', description: `Uploaded ${result.count} exam results` });
                  setExamUploadDialog(false);
                  setExamUploadFile(null);
                  refetchExamReadyData();
                } catch (error: any) {
                  toast({ title: 'Upload Failed', description: error.message, variant: 'destructive' });
                } finally {
                  setExamUploading(false);
                  setExamUploadProgress(0);
                }
              }}
              data-testid="btn-submit-exam-upload"
            >
              {examUploading ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Curriculum CSV Import Dialog */}
      <Dialog open={curriculumImportDialog} onOpenChange={(open) => { setCurriculumImportDialog(open); setCurriculumFile(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Curriculum from CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file with boards, classes, subjects, chapters, and topics.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
              {curriculumFile ? (
                <div className="space-y-2">
                  <FileText className="h-12 w-12 mx-auto text-gray-400" />
                  <p className="font-medium">{curriculumFile.name}</p>
                  <p className="text-sm text-gray-500">{(curriculumFile.size / 1024).toFixed(1)} KB</p>
                  <Button variant="ghost" size="sm" onClick={() => setCurriculumFile(null)}>
                    <X className="h-4 w-4 mr-1" /> Remove
                  </Button>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <Upload className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                  <p className="font-medium text-gray-700">Click to select file</p>
                  <p className="text-sm text-gray-500">CSV files only</p>
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setCurriculumFile(file);
                    }}
                    data-testid="input-curriculum-file"
                  />
                </label>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Download the template first, fill in your curriculum data, then upload the CSV file.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCurriculumImportDialog(false)}>Cancel</Button>
            <Button
              disabled={!curriculumFile || curriculumUploading}
              style={{ backgroundColor: BRAND.primary }}
              className="text-white"
              onClick={async () => {
                if (!curriculumFile) return;
                setCurriculumUploading(true);
                try {
                  const text = await curriculumFile.text();
                  const lines = text.split('\n').filter(l => l.trim() && !l.startsWith('#'));
                  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
                  const rows = lines.slice(1).map(line => {
                    const values = line.match(/("([^"]*)"|[^,]*)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || [];
                    const row: any = {};
                    headers.forEach((h, i) => { row[h] = values[i] || ''; });
                    return row;
                  });
                  const res = await fetch('/api/admin/curriculum/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ rows })
                  });
                  if (!res.ok) throw new Error((await res.json()).message || 'Import failed');
                  const result = await res.json();
                  toast({ 
                    title: 'Import Completed', 
                    description: `Created ${result.boards} boards, ${result.classes} classes, ${result.subjects} subjects, ${result.chapters} chapters, ${result.topics} topics` 
                  });
                  setCurriculumImportDialog(false);
                  setCurriculumFile(null);
                } catch (error: any) {
                  toast({ title: 'Import Failed', description: error.message, variant: 'destructive' });
                } finally {
                  setCurriculumUploading(false);
                }
              }}
              data-testid="btn-submit-curriculum-import"
            >
              {curriculumUploading ? 'Importing...' : 'Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Curriculum Generation Dialog */}
      <Dialog open={aiGenerateDialog} onOpenChange={(open) => { setAiGenerateDialog(open); setAiGenerateForm({ boardCode: '', classNumber: '', subjectName: '' }); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" style={{ color: BRAND.accent }} />
              AI Curriculum Generator
            </DialogTitle>
            <DialogDescription>
              Use AI to automatically generate chapters and topics for a subject. This uses your Replit credits.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Board Code</label>
              <Input
                placeholder="e.g., CBSE, ICSE, MAHA"
                value={aiGenerateForm.boardCode}
                onChange={(e) => setAiGenerateForm({ ...aiGenerateForm, boardCode: e.target.value.toUpperCase() })}
                data-testid="input-ai-board"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Class Number</label>
              <Input
                type="number"
                placeholder="e.g., 10"
                min={1}
                max={12}
                value={aiGenerateForm.classNumber}
                onChange={(e) => setAiGenerateForm({ ...aiGenerateForm, classNumber: e.target.value })}
                data-testid="input-ai-class"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Subject Name</label>
              <Input
                placeholder="e.g., Mathematics, Science, Physics"
                value={aiGenerateForm.subjectName}
                onChange={(e) => setAiGenerateForm({ ...aiGenerateForm, subjectName: e.target.value })}
                data-testid="input-ai-subject"
              />
            </div>
            <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
              <p className="font-medium">How it works:</p>
              <ul className="list-disc list-inside mt-1 text-xs space-y-1">
                <li>AI generates all chapters for the subject</li>
                <li>Each chapter includes 3-8 relevant topics</li>
                <li>Content follows the official syllabus structure</li>
                <li>Existing data won't be duplicated</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiGenerateDialog(false)}>Cancel</Button>
            <Button
              disabled={!aiGenerateForm.boardCode || !aiGenerateForm.classNumber || !aiGenerateForm.subjectName || aiGenerating}
              style={{ backgroundColor: BRAND.accent }}
              className="text-white"
              onClick={async () => {
                setAiGenerating(true);
                try {
                  const res = await fetch('/api/admin/curriculum/ai-generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                      boardCode: aiGenerateForm.boardCode,
                      classNumber: parseInt(aiGenerateForm.classNumber),
                      subjectName: aiGenerateForm.subjectName
                    })
                  });
                  if (!res.ok) throw new Error((await res.json()).message || 'Generation failed');
                  const result = await res.json();
                  toast({ 
                    title: 'AI Generation Completed', 
                    description: `Generated ${result.chapters} chapters and ${result.topics} topics` 
                  });
                  setAiGenerateDialog(false);
                  setAiGenerateForm({ boardCode: '', classNumber: '', subjectName: '' });
                } catch (error: any) {
                  toast({ title: 'Generation Failed', description: error.message, variant: 'destructive' });
                } finally {
                  setAiGenerating(false);
                }
              }}
              data-testid="btn-submit-ai-generate"
            >
              {aiGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Curriculum
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exam Questions Upload Dialog */}
      <Dialog open={examQuestionsDialog} onOpenChange={(open) => { setExamQuestionsDialog(open); setExamQuestionsFile(null); setExamQuestionsProgress(0); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Exam Questions</DialogTitle>
            <DialogDescription>
              Upload questions for exam readiness assessments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
              {examQuestionsFile ? (
                <div className="space-y-2">
                  <FileText className="h-12 w-12 mx-auto text-gray-400" />
                  <p className="font-medium">{examQuestionsFile.name}</p>
                  <p className="text-sm text-gray-500">{(examQuestionsFile.size / 1024).toFixed(1)} KB</p>
                  <Button variant="ghost" size="sm" onClick={() => setExamQuestionsFile(null)}>
                    <X className="h-4 w-4 mr-1" /> Remove
                  </Button>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <Upload className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                  <p className="font-medium text-gray-700">Click to select file</p>
                  <p className="text-sm text-gray-500">CSV files only</p>
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setExamQuestionsFile(file);
                    }}
                    data-testid="input-exam-questions-file"
                  />
                </label>
              )}
            </div>
            {examQuestionsUploading && (
              <div className="space-y-2">
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full transition-all duration-300" style={{ width: `${examQuestionsProgress}%`, backgroundColor: BRAND.accent }} />
                </div>
                <p className="text-sm text-center text-gray-500">Uploading... {examQuestionsProgress}%</p>
              </div>
            )}
            <div className="text-xs text-gray-500 space-y-1">
              <p><strong>All 28 columns:</strong> questionCode, questionType, difficultyLevel, questionText, optionA-E, correctOption, answerText, explanation, marks, negativeMarks, boardId, classId, subjectId, chapterId, topicId, assessmentType, assessmentCode, passageId, caseStudyId, diagramUrl, tags, language, isVerified, status</p>
              <p><strong>Question Types:</strong> MCQ, TrueFalse, FillBlank, ShortAnswer, LongAnswer, Numerical, CaseStudy, PassageBased, AssertionReason, MatchFollowing</p>
              <p><strong>Assessment Types:</strong> Practice, ChapterTest, UnitTest, SamplePaper, MockTest, Olympiad</p>
              <p><strong>Difficulty:</strong> Easy, Medium, Hard | <strong>Language:</strong> EN, HI, etc.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExamQuestionsDialog(false)}>Cancel</Button>
            <Button
              disabled={!examQuestionsFile || examQuestionsUploading}
              style={{ backgroundColor: BRAND.primary }}
              className="text-white"
              onClick={async () => {
                if (!examQuestionsFile) return;
                setExamQuestionsUploading(true);
                setExamQuestionsProgress(10);
                try {
                  const formData = new FormData();
                  formData.append('file', examQuestionsFile);
                  setExamQuestionsProgress(30);
                  const res = await fetch('/api/admin/exam-questions/upload', {
                    method: 'POST',
                    credentials: 'include',
                    body: formData
                  });
                  setExamQuestionsProgress(80);
                  if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.message || 'Upload failed');
                  }
                  const result = await res.json();
                  setExamQuestionsProgress(100);
                  toast({ title: 'Success', description: `Uploaded ${result.count} exam questions` });
                  setExamQuestionsDialog(false);
                  setExamQuestionsFile(null);
                } catch (error: any) {
                  toast({ title: 'Upload Failed', description: error.message, variant: 'destructive' });
                } finally {
                  setExamQuestionsUploading(false);
                  setExamQuestionsProgress(0);
                }
              }}
              data-testid="btn-submit-exam-questions"
            >
              {examQuestionsUploading ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Psychometric Questions Upload Dialog */}
      <Dialog open={psychoQuestionsDialog} onOpenChange={(open) => { setPsychoQuestionsDialog(open); setPsychoQuestionsFile(null); setPsychoUploadError(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload Psychometric Questions</DialogTitle>
            <DialogDescription>
              Upload questions for psychometric behavioral assessments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Error Display */}
            {psychoUploadError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4" data-testid="psycho-upload-error">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-red-800">{psychoUploadError.message}</p>
                    {psychoUploadError.errors && psychoUploadError.errors.length > 0 && (
                      <div className="mt-2 max-h-40 overflow-y-auto">
                        <p className="text-sm font-medium text-red-700 mb-1">Errors ({psychoUploadError.errors.length} total):</p>
                        <ul className="text-sm text-red-600 space-y-1">
                          {psychoUploadError.errors.slice(0, 10).map((err: any, idx: number) => (
                            <li key={idx} className="flex items-start gap-1">
                              <span className="font-mono bg-red-100 px-1 rounded">Row {err.row}</span>
                              <span>{err.error}</span>
                              {err.field && <span className="text-red-400">({err.field})</span>}
                            </li>
                          ))}
                          {psychoUploadError.errors.length > 10 && (
                            <li className="text-red-400 italic">...and {psychoUploadError.errors.length - 10} more errors</li>
                          )}
                        </ul>
                      </div>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="mt-2 text-red-600 hover:text-red-700 p-0 h-auto"
                      onClick={() => setPsychoUploadError(null)}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
              {psychoQuestionsFile ? (
                <div className="space-y-2">
                  <FileText className="h-12 w-12 mx-auto text-gray-400" />
                  <p className="font-medium">{psychoQuestionsFile.name}</p>
                  <p className="text-sm text-gray-500">{(psychoQuestionsFile.size / 1024).toFixed(1)} KB</p>
                  <Button variant="ghost" size="sm" onClick={() => { setPsychoQuestionsFile(null); setPsychoUploadError(null); }}>
                    <X className="h-4 w-4 mr-1" /> Remove
                  </Button>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <Upload className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                  <p className="font-medium text-gray-700">Click to select file</p>
                  <p className="text-sm text-gray-500">CSV files only</p>
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) { setPsychoQuestionsFile(file); setPsychoUploadError(null); }
                    }}
                    data-testid="input-psycho-questions-file"
                  />
                </label>
              )}
            </div>
            <div className="text-xs text-gray-500 space-y-1 bg-gray-50 p-3 rounded-lg">
              <p><strong>Required Columns:</strong> questionCode, domainCode, subdomainCode, ageBandCode, questionText, questionType, responseOptions, scoringLogic, reverseScored, difficulty, language</p>
              <p><strong>Question Types:</strong> Likert, MultipleChoice, TrueFalse, Rating, OpenEnded</p>
              <p><strong>Age Bands:</strong> A (8-9), B (10-11), C (12-13), D (14-15), E (16-18), E1 (19+)</p>
              <p><strong>Difficulty:</strong> Easy, Medium, Hard | <strong>Language:</strong> EN, HI, etc.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPsychoQuestionsDialog(false)}>Cancel</Button>
            <Button
              disabled={!psychoQuestionsFile || psychoQuestionsUploading}
              style={{ backgroundColor: BRAND.primary }}
              className="text-white"
              onClick={async () => {
                if (!psychoQuestionsFile) return;
                setPsychoQuestionsUploading(true);
                try {
                  const text = await psychoQuestionsFile.text();
                  const lines = text.split('\n').filter(l => l.trim());
                  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
                  const questions = [];
                  for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].match(/("([^"]*)"|[^,]+)/g)?.map(v => v.trim().replace(/^"|"$/g, '')) || [];
                    const obj: Record<string, string> = {};
                    headers.forEach((h, idx) => { obj[h] = values[idx] || ''; });
                    questions.push(obj);
                  }
                  const res = await fetch('/api/admin/psychometric/questions/bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ questions })
                  });
                  
                  const result = await res.json();
                  
                  if (!res.ok) {
                    if (res.status === 401) {
                      setIsAuthenticated(false);
                      setPsychoUploadError({ message: 'Session expired. Please login again.', errors: [] });
                      return;
                    }
                    // Show detailed error in the dialog
                    setPsychoUploadError({
                      message: result.message || 'Upload failed',
                      errors: result.errors || []
                    });
                    return;
                  }
                  
                  // Handle partial success with errors
                  if (result.errors && result.errors.length > 0) {
                    setPsychoUploadError({
                      message: `Partial success: ${result.inserted} inserted, ${result.skipped} skipped`,
                      errors: result.errors
                    });
                    refetchPsychoQuestions();
                  } else {
                    toast({ 
                      title: 'Upload Complete', 
                      description: `Successfully inserted ${result.inserted} questions.`
                    });
                    setPsychoQuestionsDialog(false);
                    setPsychoQuestionsFile(null);
                    setPsychoUploadError(null);
                    refetchPsychoQuestions();
                  }
                } catch (error: any) {
                  console.error('Upload error:', error);
                  setPsychoUploadError({
                    message: error.message || 'Unknown error occurred',
                    errors: []
                  });
                } finally {
                  setPsychoQuestionsUploading(false);
                }
              }}
              data-testid="btn-submit-psycho-questions"
            >
              {psychoQuestionsUploading ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* LBI Questions Upload Dialog */}
      <Dialog open={lbiQuestionsDialog} onOpenChange={(open) => { setLbiQuestionsDialog(open); setLbiQuestionsFile(null); setLbiUploadError(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Assessment Items</DialogTitle>
            <DialogDescription>
              Upload assessment items for competency domains and subdomains. Download the template first to see the required format.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {lbiUploadError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4" data-testid="lbi-upload-error">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-red-800">{lbiUploadError.message}</p>
                    {lbiUploadError.errors && lbiUploadError.errors.length > 0 && (
                      <div className="mt-2 max-h-40 overflow-y-auto">
                        <p className="text-sm font-medium text-red-700 mb-1">Errors ({lbiUploadError.errors.length}):</p>
                        <ul className="text-sm text-red-600 space-y-1">
                          {lbiUploadError.errors.slice(0, 10).map((err: any, idx: number) => (
                            <li key={idx} className="flex items-start gap-1">
                              <span className="font-mono bg-red-100 px-1 rounded">Row {err.row}</span>
                              <span>{err.message}</span>
                            </li>
                          ))}
                          {lbiUploadError.errors.length > 10 && (
                            <li className="text-red-400 italic">...and {lbiUploadError.errors.length - 10} more</li>
                          )}
                        </ul>
                      </div>
                    )}
                    <Button variant="ghost" size="sm" className="mt-2 text-red-600 hover:text-red-700 p-0 h-auto" onClick={() => setLbiUploadError(null)}>Dismiss</Button>
                  </div>
                </div>
              </div>
            )}
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
              {lbiQuestionsFile ? (
                <div className="space-y-2">
                  <FileText className="h-12 w-12 mx-auto text-gray-400" />
                  <p className="font-medium">{lbiQuestionsFile.name}</p>
                  <p className="text-sm text-gray-500">{(lbiQuestionsFile.size / 1024).toFixed(1)} KB</p>
                  <Button variant="ghost" size="sm" onClick={() => { setLbiQuestionsFile(null); setLbiUploadError(null); }}>
                    <X className="h-4 w-4 mr-1" /> Remove
                  </Button>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <Upload className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                  <p className="font-medium text-gray-700">Click to select CSV file</p>
                  <p className="text-sm text-gray-500">CSV files only</p>
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) { setLbiQuestionsFile(file); setLbiUploadError(null); }
                    }}
                    data-testid="input-lbi-questions-file"
                  />
                </label>
              )}
            </div>
            <div className="text-xs text-gray-500 space-y-1 bg-gray-50 p-3 rounded-lg">
              <p><strong>Required Columns:</strong> domainCode, subdomainCode, questionCode, ageBandCode, questionType, questionText</p>
              <p><strong>Optional Columns:</strong> domainName, subdomainName, passageText, keying, optionA-D, optionAScore-DScore, correctAnswer, explanation, anchor, status</p>
              <p><strong>Domain Codes:</strong> ACE, TQP, ESER, CSCC, ACC, SEI, DHC, CE, MVR, LPE, CER, IRCM, APRI, MSR, HSSU, AIM, TCA, TSIS, OCR</p>
              <p><strong>Subdomain Codes:</strong> ACE_SD01, ACE_SD02, ..., OCR_SD03 (see template for full list)</p>
              <p><strong>Age Bands:</strong> A (6-10), B (11-14), C (15-18), D (18-21), E (21-25), E1 (22-30)</p>
              <p><strong>Question Types:</strong> likert, multipleChoice, trueFalse</p>
              <p><strong>Keying:</strong> Positive (higher = better) or Negative (reverse scored)</p>
              <p><strong>Anchor:</strong> Yes or No (calibration/anchor item)</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLbiQuestionsDialog(false)}>Cancel</Button>
            <Button
              disabled={!lbiQuestionsFile || lbiQuestionsUploading}
              style={{ backgroundColor: BRAND.primary }}
              className="text-white"
              onClick={async () => {
                if (!lbiQuestionsFile) return;
                setLbiQuestionsUploading(true);
                setLbiUploadError(null);
                try {
                  const formData = new FormData();
                  formData.append('file', lbiQuestionsFile);
                  const res = await fetch('/api/admin/lbi-questions/upload', {
                    method: 'POST',
                    credentials: 'include',
                    body: formData
                  });
                  const result = await res.json();
                  if (!res.ok) {
                    if (res.status === 401) {
                      setIsAuthenticated(false);
                      setLbiUploadError({ message: 'Session expired. Please login again.', errors: [] });
                      return;
                    }
                    setLbiUploadError({ message: result.message || 'Upload failed', errors: result.errors || [] });
                    return;
                  }
                  if (result.errors && result.errors.length > 0) {
                    setLbiUploadError({ message: `Partial success: ${result.count} inserted, ${result.errors.length} errors`, errors: result.errors });
                  } else {
                    toast({ title: 'Upload Complete', description: `Successfully uploaded ${result.count} LBI questions.` });
                    setLbiQuestionsDialog(false);
                    setLbiQuestionsFile(null);
                    setLbiUploadError(null);
                  }
                } catch (error: any) {
                  setLbiUploadError({ message: error.message || 'Unknown error occurred', errors: [] });
                } finally {
                  setLbiQuestionsUploading(false);
                }
              }}
              data-testid="btn-submit-lbi-questions"
            >
              {lbiQuestionsUploading ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Question Bank Upload Dialog */}
      <Dialog open={qbUploadDialog} onOpenChange={(open) => { setQbUploadDialog(open); setQbUploadFile(null); setQbUploadProgress(0); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Questions</DialogTitle>
            <DialogDescription>
              Upload an Excel file with questions. Download the template first to ensure correct format.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
              {qbUploadFile ? (
                <div className="space-y-2">
                  <FileText className="h-12 w-12 mx-auto text-gray-400" />
                  <p className="font-medium">{qbUploadFile.name}</p>
                  <p className="text-sm text-gray-500">{(qbUploadFile.size / 1024).toFixed(1)} KB</p>
                  <Button variant="ghost" size="sm" onClick={() => setQbUploadFile(null)}>
                    <X className="h-4 w-4 mr-1" /> Remove
                  </Button>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <Upload className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                  <p className="font-medium text-gray-700">Click to select file</p>
                  <p className="text-sm text-gray-500">Excel files (.xlsx, .xls) or CSV</p>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setQbUploadFile(file);
                    }}
                    data-testid="input-file-upload"
                  />
                </label>
              )}
            </div>
            {qbUploading && (
              <div className="space-y-2">
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full transition-all duration-300" 
                    style={{ width: `${qbUploadProgress}%`, backgroundColor: BRAND.accent }} 
                  />
                </div>
                <p className="text-sm text-center text-gray-500">Uploading... {qbUploadProgress}%</p>
              </div>
            )}
            <div className="text-xs text-gray-500 space-y-1">
              <p><strong>Required columns:</strong> questionText, optionA, optionB, optionC, optionD, correctOption</p>
              <p><strong>Optional columns:</strong> explanation, difficulty, marks, boardCode, classNumber, subjectCode, chapterCode</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQbUploadDialog(false)}>Cancel</Button>
            <Button
              disabled={!qbUploadFile || qbUploading}
              style={{ backgroundColor: BRAND.primary }}
              className="text-white"
              onClick={async () => {
                if (!qbUploadFile) return;
                setQbUploading(true);
                setQbUploadProgress(10);
                try {
                  const formData = new FormData();
                  formData.append('file', qbUploadFile);
                  if (qbBoardFilter !== 'all') formData.append('boardId', qbBoardFilter);
                  if (qbClassFilter !== 'all') formData.append('classId', qbClassFilter);
                  if (qbSubjectFilter !== 'all') formData.append('subjectId', qbSubjectFilter);
                  
                  setQbUploadProgress(30);
                  const res = await fetch('/api/admin/question-bank/upload', {
                    method: 'POST',
                    credentials: 'include',
                    body: formData
                  });
                  setQbUploadProgress(80);
                  
                  if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.message || 'Upload failed');
                  }
                  
                  const result = await res.json();
                  setQbUploadProgress(100);
                  toast({ title: 'Success', description: `Uploaded ${result.count} questions successfully` });
                  setQbUploadDialog(false);
                  setQbUploadFile(null);
                  refetchQuestions();
                } catch (error: any) {
                  toast({ title: 'Upload Failed', description: error.message, variant: 'destructive' });
                } finally {
                  setQbUploading(false);
                  setQbUploadProgress(0);
                }
              }}
              data-testid="btn-submit-upload"
            >
              {qbUploading ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Blueprint Create Dialog */}
      <Dialog open={blueprintDialog} onOpenChange={setBlueprintDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Assessment Blueprint</DialogTitle>
            <DialogDescription>
              Define the paper structure for auto-generating tests from the question bank
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Blueprint Name</label>
                <Input
                  value={blueprintData.blueprintName}
                  onChange={(e) => setBlueprintData({ ...blueprintData, blueprintName: e.target.value })}
                  placeholder="e.g., CBSE Class 10 Math Sample Paper"
                  data-testid="input-blueprint-name"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Assessment Type</label>
                <Select value={blueprintData.assessmentType} onValueChange={(v) => setBlueprintData({ ...blueprintData, assessmentType: v })}>
                  <SelectTrigger data-testid="select-assessment-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Practice">Practice</SelectItem>
                    <SelectItem value="ChapterTest">Chapter Test</SelectItem>
                    <SelectItem value="UnitTest">Unit Test</SelectItem>
                    <SelectItem value="SamplePaper">Sample Paper</SelectItem>
                    <SelectItem value="MockTest">Mock Test</SelectItem>
                    <SelectItem value="Olympiad">Olympiad</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Board (optional)</label>
                <Select value={blueprintData.boardId || 'any'} onValueChange={(v) => setBlueprintData({ ...blueprintData, boardId: v === 'any' ? '' : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any Board" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any Board</SelectItem>
                    {boards.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.boardName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Class (optional)</label>
                <Select value={blueprintData.classId || 'any'} onValueChange={(v) => setBlueprintData({ ...blueprintData, classId: v === 'any' ? '' : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any Class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any Class</SelectItem>
                    {classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.className}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Subject (optional)</label>
                <Select value={blueprintData.subjectId || 'any'} onValueChange={(v) => setBlueprintData({ ...blueprintData, subjectId: v === 'any' ? '' : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any Subject" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any Subject</SelectItem>
                    {subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.subjectName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Total Marks</label>
                <Input
                  type="number"
                  value={blueprintData.totalMarks}
                  onChange={(e) => setBlueprintData({ ...blueprintData, totalMarks: parseInt(e.target.value) || 0 })}
                  data-testid="input-total-marks"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Duration (minutes)</label>
                <Input
                  type="number"
                  value={blueprintData.duration}
                  onChange={(e) => setBlueprintData({ ...blueprintData, duration: parseInt(e.target.value) || 0 })}
                  data-testid="input-duration"
                />
              </div>
            </div>

            {/* Sections */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900">Paper Sections</h4>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBlueprintData({
                    ...blueprintData,
                    sections: [...blueprintData.sections, {
                      sectionName: `Section ${String.fromCharCode(65 + blueprintData.sections.length)}`,
                      questionType: 'MCQ',
                      questionsCount: 10,
                      marksPerQuestion: 1,
                      difficultyMix: '30:50:20'
                    }]
                  })}
                  data-testid="btn-add-section"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Section
                </Button>
              </div>
              
              <div className="space-y-3">
                {blueprintData.sections.map((section, idx) => (
                  <div key={idx} className="p-3 border rounded-lg bg-gray-50">
                    <div className="grid grid-cols-5 gap-3">
                      <div>
                        <label className="text-xs text-gray-500">Section Name</label>
                        <Input
                          value={section.sectionName}
                          onChange={(e) => {
                            const updated = [...blueprintData.sections];
                            updated[idx].sectionName = e.target.value;
                            setBlueprintData({ ...blueprintData, sections: updated });
                          }}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Question Type</label>
                        <Select
                          value={section.questionType}
                          onValueChange={(v) => {
                            const updated = [...blueprintData.sections];
                            updated[idx].questionType = v;
                            setBlueprintData({ ...blueprintData, sections: updated });
                          }}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MCQ">MCQ</SelectItem>
                            <SelectItem value="TrueFalse">True/False</SelectItem>
                            <SelectItem value="FillBlank">Fill in Blank</SelectItem>
                            <SelectItem value="ShortAnswer">Short Answer</SelectItem>
                            <SelectItem value="LongAnswer">Long Answer</SelectItem>
                            <SelectItem value="Numerical">Numerical</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Questions</label>
                        <Input
                          type="number"
                          value={section.questionsCount}
                          onChange={(e) => {
                            const updated = [...blueprintData.sections];
                            updated[idx].questionsCount = parseInt(e.target.value) || 0;
                            setBlueprintData({ ...blueprintData, sections: updated });
                          }}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Marks Each</label>
                        <Input
                          type="number"
                          value={section.marksPerQuestion}
                          onChange={(e) => {
                            const updated = [...blueprintData.sections];
                            updated[idx].marksPerQuestion = parseInt(e.target.value) || 1;
                            setBlueprintData({ ...blueprintData, sections: updated });
                          }}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-red-600"
                          onClick={() => {
                            const updated = blueprintData.sections.filter((_, i) => i !== idx);
                            setBlueprintData({ ...blueprintData, sections: updated });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2">
                      <label className="text-xs text-gray-500">Difficulty Mix (Easy:Medium:Hard)</label>
                      <Input
                        value={section.difficultyMix}
                        onChange={(e) => {
                          const updated = [...blueprintData.sections];
                          updated[idx].difficultyMix = e.target.value;
                          setBlueprintData({ ...blueprintData, sections: updated });
                        }}
                        placeholder="30:50:20"
                        className="h-8 text-sm w-32"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlueprintDialog(false)}>Cancel</Button>
            <Button
              style={{ backgroundColor: BRAND.primary }}
              className="text-white"
              disabled={!blueprintData.blueprintName || blueprintData.sections.length === 0}
              onClick={async () => {
                try {
                  const res = await fetch('/api/admin/assessment-blueprints', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                      blueprintName: blueprintData.blueprintName,
                      boardId: blueprintData.boardId || null,
                      classId: blueprintData.classId || null,
                      subjectId: blueprintData.subjectId || null,
                      assessmentType: blueprintData.assessmentType,
                      totalMarks: blueprintData.totalMarks,
                      duration: blueprintData.duration,
                      status: 'Active',
                      sections: blueprintData.sections
                    })
                  });
                  if (res.ok) {
                    toast({ title: 'Success', description: 'Blueprint created successfully' });
                    setBlueprintDialog(false);
                    refetchBlueprints();
                  } else {
                    const err = await res.json();
                    throw new Error(err.message || 'Failed to create blueprint');
                  }
                } catch (error: any) {
                  toast({ title: 'Error', description: error.message, variant: 'destructive' });
                }
              }}
              data-testid="btn-save-blueprint"
            >
              Create Blueprint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Dialog */}
      <Dialog open={actionDialog.open} onOpenChange={(open) => { setActionDialog({ ...actionDialog, open }); setActionNotes(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.type === 'approve' && 'Approve Request'}
              {actionDialog.type === 'reject' && 'Reject Request'}
              {actionDialog.type === 'suspend' && 'Suspend Mentor'}
              {actionDialog.type === 'suspend-onboarding' && 'Suspend Entity'}
              {actionDialog.type === 'reinstate' && 'Reinstate Entity'}
              {actionDialog.type === 'generate-code' && 'Generate Entity Code'}
              {actionDialog.type === 'create-job' && 'Create New Job Posting'}
              {actionDialog.type === 'reject-application' && 'Reject Application'}
              {actionDialog.type === 'reject-job' && 'Reject Job Posting'}
              {actionDialog.type === 'maker-verify-kyc' && 'Maker Verify KYC'}
              {actionDialog.type === 'checker-approve-kyc' && 'Checker Approve KYC'}
              {actionDialog.type === 'reject-kyc' && 'Reject KYC Document'}
            </DialogTitle>
            <DialogDescription>
              {actionDialog.type === 'approve' && `Approve ${actionDialog.item?.entityName || 'this request'}?`}
              {actionDialog.type === 'reject' && 'Please provide a reason for rejection.'}
              {actionDialog.type === 'suspend' && 'Please provide a reason for suspension.'}
              {actionDialog.type === 'suspend-onboarding' && `Suspend ${actionDialog.item?.entityName}? They will lose access.`}
              {actionDialog.type === 'reinstate' && `Reinstate ${actionDialog.item?.entityName}?`}
              {actionDialog.type === 'generate-code' && 'Select entity type to generate a unique code.'}
              {actionDialog.type === 'create-job' && 'Fill in the job details to create a new posting.'}
              {actionDialog.type === 'reject-application' && `Reject application from ${actionDialog.item?.fullName}?`}
              {actionDialog.type === 'reject-job' && `Reject "${actionDialog.item?.title}" and return to draft?`}
              {actionDialog.type === 'maker-verify-kyc' && `Verify ${actionDialog.item?.documentType?.replace(/_/g, ' ')} for ${actionDialog.item?.entityName}?`}
              {actionDialog.type === 'checker-approve-kyc' && `Final approval for ${actionDialog.item?.documentType?.replace(/_/g, ' ')} - ${actionDialog.item?.entityName}?`}
              {actionDialog.type === 'reject-kyc' && 'Please provide a reason for rejection.'}
            </DialogDescription>
          </DialogHeader>
          
          {(actionDialog.type === 'reject' || actionDialog.type === 'suspend' || actionDialog.type === 'suspend-onboarding' || actionDialog.type === 'reject-job' || actionDialog.type === 'reject-kyc') && (
            <Textarea 
              placeholder="Enter reason..." 
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              data-testid="textarea-reason"
            />
          )}

          {(actionDialog.type === 'approve' || actionDialog.type === 'reinstate' || actionDialog.type === 'maker-verify-kyc' || actionDialog.type === 'checker-approve-kyc') && (
            <Textarea 
              placeholder="Optional notes..." 
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              data-testid="textarea-notes"
            />
          )}

          {actionDialog.type === 'generate-code' && (
            <div className="space-y-4">
              <Select onValueChange={(val) => setActionNotes(val)}>
                <SelectTrigger data-testid="select-code-entity-type">
                  <SelectValue placeholder="Select Entity Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mentor">Mentor</SelectItem>
                  <SelectItem value="institute">Institute</SelectItem>
                  <SelectItem value="ngo">NGO</SelectItem>
                  <SelectItem value="parent">Parent</SelectItem>
                  <SelectItem value="lei">LEI</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {actionDialog.type === 'create-job' && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <div>
                <label className="text-sm font-medium">Job Title *</label>
                <Input 
                  value={newJobData.title} 
                  onChange={(e) => setNewJobData({ ...newJobData, title: e.target.value })}
                  placeholder="e.g., Learning & Awareness Mentor"
                  data-testid="input-job-title"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <Select value={newJobData.roleCategory} onValueChange={(v) => setNewJobData({ ...newJobData, roleCategory: v })}>
                    <SelectTrigger data-testid="select-role-category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mentor">Mentor</SelectItem>
                      <SelectItem value="counselor">Counselor</SelectItem>
                      <SelectItem value="trainer">Trainer</SelectItem>
                      <SelectItem value="coordinator">Coordinator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Type</label>
                  <Select value={newJobData.employmentType} onValueChange={(v) => setNewJobData({ ...newJobData, employmentType: v })}>
                    <SelectTrigger data-testid="select-employment-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="part-time">Part-time</SelectItem>
                      <SelectItem value="full-time">Full-time</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="internship">Internship</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Mode</label>
                  <Select value={newJobData.workMode} onValueChange={(v) => setNewJobData({ ...newJobData, workMode: v })}>
                    <SelectTrigger data-testid="select-work-mode"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="remote">Remote</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                      <SelectItem value="field">Field</SelectItem>
                      <SelectItem value="onsite">On-site</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Location</label>
                  <Input 
                    value={newJobData.location} 
                    onChange={(e) => setNewJobData({ ...newJobData, location: e.target.value })}
                    placeholder="e.g., Mumbai, Delhi, Remote"
                    data-testid="input-location"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Salary Range</label>
                  <Input 
                    value={newJobData.salary} 
                    onChange={(e) => setNewJobData({ ...newJobData, salary: e.target.value })}
                    placeholder="e.g., ₹25,000 - ₹45,000/month"
                    data-testid="input-salary"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Eligibility</label>
                <Textarea 
                  value={newJobData.eligibility} 
                  onChange={(e) => setNewJobData({ ...newJobData, eligibility: e.target.value })}
                  placeholder="Minimum eligibility criteria..."
                  className="h-16"
                  data-testid="input-eligibility"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Qualifications</label>
                <Textarea 
                  value={newJobData.qualifications} 
                  onChange={(e) => setNewJobData({ ...newJobData, qualifications: e.target.value })}
                  placeholder="Required qualifications..."
                  className="h-16"
                  data-testid="input-qualifications"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Responsibilities</label>
                <Textarea 
                  value={newJobData.responsibilities} 
                  onChange={(e) => setNewJobData({ ...newJobData, responsibilities: e.target.value })}
                  placeholder="Key responsibilities..."
                  className="h-16"
                  data-testid="input-responsibilities"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Benefits</label>
                <Textarea 
                  value={newJobData.benefits} 
                  onChange={(e) => setNewJobData({ ...newJobData, benefits: e.target.value })}
                  placeholder="Health insurance, flexible hours, training allowance..."
                  className="h-16"
                  data-testid="input-benefits"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Job Poster Image</label>
                <div className="flex gap-2 mt-1">
                  <Input 
                    type="file"
                    accept="image/*"
                    className="flex-1"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setNewJobData({ ...newJobData, posterImage: file.name });
                    }}
                    data-testid="input-poster-image"
                  />
                  <Button variant="outline" size="sm" className="gap-1" data-testid="button-upload-poster"><Upload className="h-4 w-4" /> Upload</Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Upload a poster image for social media sharing (recommended: 1200x630px)</p>
              </div>
              <div className="border-t pt-4">
                <label className="text-sm font-medium flex items-center gap-2 mb-3">
                  <Globe className="h-4 w-4" style={{ color: BRAND.primary }} />
                  Posting Channels
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={newJobData.postToCareers} onChange={(e) => setNewJobData({ ...newJobData, postToCareers: e.target.checked })} className="w-4 h-4 accent-blue-600" data-testid="checkbox-post-careers" />
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" style={{ color: BRAND.primary }} />
                      <span className="text-sm font-medium">Careers Page</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={newJobData.postToLinkedIn} onChange={(e) => setNewJobData({ ...newJobData, postToLinkedIn: e.target.checked })} className="w-4 h-4 accent-blue-600" data-testid="checkbox-post-linkedin" />
                    <div className="flex items-center gap-2">
                      <svg className="h-5 w-5 text-blue-700" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                      <span className="text-sm font-medium">LinkedIn</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={newJobData.postToIndeed} onChange={(e) => setNewJobData({ ...newJobData, postToIndeed: e.target.checked })} className="w-4 h-4 accent-blue-600" data-testid="checkbox-post-indeed" />
                    <div className="flex items-center gap-2">
                      <svg className="h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor"><path d="M11.49 24h-.2c-3.93-.36-6.67-3.67-6.67-8.03V8.72c0-.19.13-.36.32-.4l6.39-1.27c.15-.03.3.02.4.13.1.11.15.26.12.41l-.69 4.29c-.01.08.03.16.1.2.07.04.16.04.22-.01l4.52-2.8c.17-.1.38-.06.5.1.48.62.87 1.3 1.18 2.03.05.12.03.25-.05.35l-4.91 5.97c-.05.07-.07.15-.04.23.03.08.1.14.18.16l5.15 1.15c.16.04.28.17.29.34.07 1.33-.17 2.53-.7 3.58-1.23 2.41-3.67 3.81-6.51 3.82z"/></svg>
                      <span className="text-sm font-medium">Indeed</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={newJobData.postToNaukri} onChange={(e) => setNewJobData({ ...newJobData, postToNaukri: e.target.checked })} className="w-4 h-4 accent-blue-600" data-testid="checkbox-post-naukri" />
                    <div className="flex items-center gap-2">
                      <svg className="h-5 w-5 text-blue-800" viewBox="0 0 24 24" fill="currentColor"><rect width="24" height="24" rx="4" /><text x="50%" y="60%" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">N</text></svg>
                      <span className="text-sm font-medium">Naukri</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={newJobData.postToFacebook} onChange={(e) => setNewJobData({ ...newJobData, postToFacebook: e.target.checked })} className="w-4 h-4 accent-blue-600" data-testid="checkbox-post-facebook" />
                    <div className="flex items-center gap-2">
                      <svg className="h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                      <span className="text-sm font-medium">Facebook</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={newJobData.postToWhatsApp} onChange={(e) => setNewJobData({ ...newJobData, postToWhatsApp: e.target.checked })} className="w-4 h-4 accent-blue-600" data-testid="checkbox-post-whatsapp" />
                    <div className="flex items-center gap-2">
                      <svg className="h-5 w-5 text-green-500" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      <span className="text-sm font-medium">WhatsApp</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={newJobData.postToInstagram} onChange={(e) => setNewJobData({ ...newJobData, postToInstagram: e.target.checked })} className="w-4 h-4 accent-blue-600" data-testid="checkbox-post-instagram" />
                    <div className="flex items-center gap-2">
                      <svg className="h-5 w-5 text-pink-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/></svg>
                      <span className="text-sm font-medium">Instagram</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={newJobData.postToTwitter} onChange={(e) => setNewJobData({ ...newJobData, postToTwitter: e.target.checked })} className="w-4 h-4 accent-blue-600" data-testid="checkbox-post-twitter" />
                    <div className="flex items-center gap-2">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                      <span className="text-sm font-medium">X (Twitter)</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {actionDialog.type === 'reject-application' && (
            <Textarea 
              placeholder="Enter rejection reason..." 
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              data-testid="textarea-rejection-reason"
            />
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionDialog({ open: false, type: '', item: null }); setActionNotes(''); }} data-testid="button-cancel">
              Cancel
            </Button>
            {actionDialog.type === 'approve' && (
              <Button 
                onClick={() => approveOnboardingMutation.mutate({ id: actionDialog.item?.id, notes: actionNotes })}
                style={{ backgroundColor: BRAND.accent }}
                disabled={approveOnboardingMutation.isPending}
                data-testid="button-confirm-approve"
              >
                {approveOnboardingMutation.isPending ? 'Approving...' : 'Approve'}
              </Button>
            )}
            {actionDialog.type === 'reject' && (
              <Button 
                variant="destructive"
                onClick={() => rejectOnboardingMutation.mutate({ id: actionDialog.item?.id, reason: actionNotes })}
                disabled={!actionNotes || rejectOnboardingMutation.isPending}
                data-testid="button-confirm-reject"
              >
                {rejectOnboardingMutation.isPending ? 'Rejecting...' : 'Reject'}
              </Button>
            )}
            {actionDialog.type === 'suspend' && (
              <Button 
                variant="destructive"
                onClick={() => suspendMentorMutation.mutate({ id: actionDialog.item?.id, reason: actionNotes })}
                disabled={!actionNotes || suspendMentorMutation.isPending}
                data-testid="button-confirm-suspend"
              >
                {suspendMentorMutation.isPending ? 'Suspending...' : 'Suspend'}
              </Button>
            )}
            {actionDialog.type === 'suspend-onboarding' && (
              <Button 
                variant="destructive"
                onClick={() => suspendOnboardingMutation.mutate({ id: actionDialog.item?.id, reason: actionNotes })}
                disabled={!actionNotes || suspendOnboardingMutation.isPending}
                data-testid="button-confirm-suspend-onboarding"
              >
                {suspendOnboardingMutation.isPending ? 'Suspending...' : 'Suspend Entity'}
              </Button>
            )}
            {actionDialog.type === 'reinstate' && (
              <Button 
                style={{ backgroundColor: BRAND.accent }}
                onClick={() => reinstateOnboardingMutation.mutate({ id: actionDialog.item?.id, notes: actionNotes })}
                disabled={reinstateOnboardingMutation.isPending}
                data-testid="button-confirm-reinstate"
              >
                {reinstateOnboardingMutation.isPending ? 'Reinstating...' : 'Reinstate'}
              </Button>
            )}
            {actionDialog.type === 'generate-code' && (
              <Button 
                style={{ backgroundColor: BRAND.primary }}
                onClick={() => generateCodeMutation.mutate({ entityType: actionNotes, entityId: `gen-${Date.now()}` })}
                disabled={!actionNotes || generateCodeMutation.isPending}
                data-testid="button-confirm-generate"
              >
                {generateCodeMutation.isPending ? 'Generating...' : 'Generate Code'}
              </Button>
            )}
            {actionDialog.type === 'create-job' && (
              <Button 
                style={{ backgroundColor: BRAND.primary }}
                onClick={() => {
                  createJobMutation.mutate(newJobData);
                  setNewJobData({ title: '', roleCategory: 'mentor', employmentType: 'part-time', workMode: 'remote', eligibility: '', qualifications: '', responsibilities: '', kpis: '', compensationModel: '', postToLinkedIn: true, postToIndeed: true, postToNaukri: true, postToFacebook: false, postToWhatsApp: false, postToInstagram: false, postToTwitter: false, postToCareers: true, posterImage: '', location: '', salary: '', benefits: '' });
                }}
                disabled={!newJobData.title || createJobMutation.isPending}
                data-testid="button-confirm-create-job"
              >
                {createJobMutation.isPending ? 'Creating...' : 'Create Job'}
              </Button>
            )}
            {actionDialog.type === 'reject-application' && (
              <Button 
                variant="destructive"
                onClick={() => rejectApplicationMutation.mutate({ id: actionDialog.item?.id, reason: actionNotes })}
                disabled={!actionNotes || rejectApplicationMutation.isPending}
                data-testid="button-confirm-reject-application"
              >
                {rejectApplicationMutation.isPending ? 'Rejecting...' : 'Reject Application'}
              </Button>
            )}
            {actionDialog.type === 'reject-job' && (
              <Button 
                variant="destructive"
                onClick={() => rejectJobMutation.mutate({ id: actionDialog.item?.id, reason: actionNotes })}
                disabled={!actionNotes || rejectJobMutation.isPending}
                data-testid="button-confirm-reject-job"
              >
                {rejectJobMutation.isPending ? 'Rejecting...' : 'Reject Job'}
              </Button>
            )}
            {actionDialog.type === 'maker-verify-kyc' && (
              <Button 
                onClick={() => makerVerifyKycMutation.mutate({ id: actionDialog.item?.id, notes: actionNotes })}
                style={{ backgroundColor: BRAND.primary }}
                disabled={makerVerifyKycMutation.isPending}
                data-testid="button-confirm-maker-verify"
              >
                {makerVerifyKycMutation.isPending ? 'Verifying...' : 'Maker Verify'}
              </Button>
            )}
            {actionDialog.type === 'checker-approve-kyc' && (
              <Button 
                onClick={() => checkerApproveKycMutation.mutate({ id: actionDialog.item?.id, notes: actionNotes })}
                style={{ backgroundColor: BRAND.accent }}
                disabled={checkerApproveKycMutation.isPending}
                data-testid="button-confirm-checker-approve"
              >
                {checkerApproveKycMutation.isPending ? 'Approving...' : 'Approve KYC'}
              </Button>
            )}
            {actionDialog.type === 'reject-kyc' && (
              <Button 
                variant="destructive"
                onClick={() => rejectKycMutation.mutate({ id: actionDialog.item?.id, reason: actionNotes })}
                disabled={!actionNotes || rejectKycMutation.isPending}
                data-testid="button-confirm-reject-kyc"
              >
                {rejectKycMutation.isPending ? 'Rejecting...' : 'Reject KYC'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mentor Action Dialogs */}
      <Dialog open={mentorDialog.open} onOpenChange={(open) => { setMentorDialog({ ...mentorDialog, open }); setMentorDialogData({}); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mentorDialog.type === 'warn' && 'Issue Warning'}
              {mentorDialog.type === 'reactivate' && 'Reactivate Mentor'}
              {mentorDialog.type === 'assign-task' && 'Assign Task'}
              {mentorDialog.type === 'report-violation' && 'Report Violation'}
              {mentorDialog.type === 'update-phi' && 'Update Performance Health Index'}
            </DialogTitle>
            <DialogDescription>
              {mentorDialog.type === 'warn' && `Issue a formal warning to ${mentorDialog.mentor?.fullName}`}
              {mentorDialog.type === 'reactivate' && `Reactivate ${mentorDialog.mentor?.fullName} and restore active status`}
              {mentorDialog.type === 'assign-task' && `Assign a new task to ${mentorDialog.mentor?.fullName}`}
              {mentorDialog.type === 'report-violation' && `Report a compliance violation for ${mentorDialog.mentor?.fullName}`}
              {mentorDialog.type === 'update-phi' && `Manually update PHI score for ${mentorDialog.mentor?.fullName}`}
            </DialogDescription>
          </DialogHeader>
          
          {/* Warn Form */}
          {mentorDialog.type === 'warn' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Warning Reason *</label>
                <Textarea 
                  placeholder="Describe the reason for this warning..."
                  value={mentorDialogData.reason || ''}
                  onChange={(e) => setMentorDialogData({ ...mentorDialogData, reason: e.target.value })}
                  data-testid="textarea-warn-reason"
                />
              </div>
            </div>
          )}

          {/* Reactivate Form */}
          {mentorDialog.type === 'reactivate' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Notes (optional)</label>
                <Textarea 
                  placeholder="Optional notes for reactivation..."
                  value={mentorDialogData.notes || ''}
                  onChange={(e) => setMentorDialogData({ ...mentorDialogData, notes: e.target.value })}
                  data-testid="textarea-reactivate-notes"
                />
              </div>
            </div>
          )}

          {/* Assign Task Form */}
          {mentorDialog.type === 'assign-task' && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="text-sm font-medium">Task Title *</label>
                <Input 
                  value={mentorDialogData.title || ''} 
                  onChange={(e) => setMentorDialogData({ ...mentorDialogData, title: e.target.value })}
                  placeholder="e.g., Conduct awareness session"
                  data-testid="input-task-title"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Task Type *</label>
                <Select value={mentorDialogData.taskType || ''} onValueChange={(v) => setMentorDialogData({ ...mentorDialogData, taskType: v })}>
                  <SelectTrigger data-testid="select-task-type"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online_coaching">Online Coaching</SelectItem>
                    <SelectItem value="tuition">Tuition</SelectItem>
                    <SelectItem value="counselling">Counselling</SelectItem>
                    <SelectItem value="workshop">Workshop</SelectItem>
                    <SelectItem value="awareness_session">Awareness Session</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea 
                  value={mentorDialogData.description || ''} 
                  onChange={(e) => setMentorDialogData({ ...mentorDialogData, description: e.target.value })}
                  placeholder="Describe the task..."
                  data-testid="textarea-task-description"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Scheduled Date</label>
                  <Input 
                    type="date"
                    value={mentorDialogData.scheduledDate || ''} 
                    onChange={(e) => setMentorDialogData({ ...mentorDialogData, scheduledDate: e.target.value })}
                    data-testid="input-task-date"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Duration (minutes)</label>
                  <Input 
                    type="number"
                    value={mentorDialogData.duration || ''} 
                    onChange={(e) => setMentorDialogData({ ...mentorDialogData, duration: parseInt(e.target.value) })}
                    placeholder="60"
                    data-testid="input-task-duration"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="isOnline"
                  checked={mentorDialogData.isOnline ?? true}
                  onChange={(e) => setMentorDialogData({ ...mentorDialogData, isOnline: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="isOnline" className="text-sm">Online Session</label>
              </div>
              {mentorDialogData.isOnline && (
                <div>
                  <label className="text-sm font-medium">Meeting Link</label>
                  <Input 
                    value={mentorDialogData.meetingLink || ''} 
                    onChange={(e) => setMentorDialogData({ ...mentorDialogData, meetingLink: e.target.value })}
                    placeholder="https://meet.google.com/..."
                    data-testid="input-task-meeting-link"
                  />
                </div>
              )}
              {!mentorDialogData.isOnline && (
                <div>
                  <label className="text-sm font-medium">Location</label>
                  <Input 
                    value={mentorDialogData.location || ''} 
                    onChange={(e) => setMentorDialogData({ ...mentorDialogData, location: e.target.value })}
                    placeholder="Enter physical location..."
                    data-testid="input-task-location"
                  />
                </div>
              )}
            </div>
          )}

          {/* Report Violation Form */}
          {mentorDialog.type === 'report-violation' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Violation Type *</label>
                <Select value={mentorDialogData.violationType || ''} onValueChange={(v) => setMentorDialogData({ ...mentorDialogData, violationType: v })}>
                  <SelectTrigger data-testid="select-violation-type"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ethical">Ethical Violation</SelectItem>
                    <SelectItem value="policy">Policy Violation</SelectItem>
                    <SelectItem value="performance">Performance Issue</SelectItem>
                    <SelectItem value="conduct">Conduct Issue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Severity *</label>
                <Select value={mentorDialogData.severity || ''} onValueChange={(v) => setMentorDialogData({ ...mentorDialogData, severity: v })}>
                  <SelectTrigger data-testid="select-violation-severity"><SelectValue placeholder="Select severity" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minor">Minor</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="major">Major</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Description *</label>
                <Textarea 
                  value={mentorDialogData.description || ''} 
                  onChange={(e) => setMentorDialogData({ ...mentorDialogData, description: e.target.value })}
                  placeholder="Describe the violation in detail..."
                  data-testid="textarea-violation-description"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Evidence URL (optional)</label>
                <Input 
                  value={mentorDialogData.evidenceUrl || ''} 
                  onChange={(e) => setMentorDialogData({ ...mentorDialogData, evidenceUrl: e.target.value })}
                  placeholder="Link to evidence..."
                  data-testid="input-evidence-url"
                />
              </div>
            </div>
          )}

          {/* Update PHI Form */}
          {mentorDialog.type === 'update-phi' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Current PHI: {mentorDialog.mentor?.performanceHealthIndex ?? 100}%</label>
                <div className="flex items-center gap-4 mt-2">
                  <Input 
                    type="number"
                    min="0"
                    max="100"
                    value={mentorDialogData.phi ?? mentorDialog.mentor?.performanceHealthIndex ?? 100} 
                    onChange={(e) => setMentorDialogData({ ...mentorDialogData, phi: parseInt(e.target.value) })}
                    className="w-24"
                    data-testid="input-phi-value"
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Reason for Change</label>
                <Textarea 
                  value={mentorDialogData.notes || ''} 
                  onChange={(e) => setMentorDialogData({ ...mentorDialogData, notes: e.target.value })}
                  placeholder="Explain why PHI is being updated..."
                  data-testid="textarea-phi-notes"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setMentorDialog({ open: false, type: '', mentor: null }); setMentorDialogData({}); }}>
              Cancel
            </Button>
            
            {mentorDialog.type === 'warn' && (
              <Button 
                className="bg-yellow-500 hover:bg-yellow-600"
                onClick={() => warnMentorMutation.mutate({ id: mentorDialog.mentor?.id, reason: mentorDialogData.reason })}
                disabled={!mentorDialogData.reason || warnMentorMutation.isPending}
                data-testid="button-confirm-warn"
              >
                {warnMentorMutation.isPending ? 'Issuing...' : 'Issue Warning'}
              </Button>
            )}

            {mentorDialog.type === 'reactivate' && (
              <Button 
                style={{ backgroundColor: '#22c55e' }}
                onClick={() => reactivateMentorMutation.mutate({ id: mentorDialog.mentor?.id, notes: mentorDialogData.notes })}
                disabled={reactivateMentorMutation.isPending}
                data-testid="button-confirm-reactivate"
              >
                {reactivateMentorMutation.isPending ? 'Reactivating...' : 'Reactivate'}
              </Button>
            )}

            {mentorDialog.type === 'assign-task' && (
              <Button 
                style={{ backgroundColor: BRAND.primary }}
                onClick={() => assignTaskMutation.mutate({ 
                  mentorId: mentorDialog.mentor?.id, 
                  task: {
                    taskType: mentorDialogData.taskType,
                    title: mentorDialogData.title,
                    description: mentorDialogData.description,
                    scheduledDate: mentorDialogData.scheduledDate,
                    duration: mentorDialogData.duration,
                    location: mentorDialogData.location,
                    isOnline: mentorDialogData.isOnline ?? true,
                    meetingLink: mentorDialogData.meetingLink
                  }
                })}
                disabled={!mentorDialogData.title || !mentorDialogData.taskType || assignTaskMutation.isPending}
                data-testid="button-confirm-assign-task"
              >
                {assignTaskMutation.isPending ? 'Assigning...' : 'Assign Task'}
              </Button>
            )}

            {mentorDialog.type === 'report-violation' && (
              <Button 
                variant="destructive"
                onClick={() => reportViolationMutation.mutate({ 
                  mentorId: mentorDialog.mentor?.id, 
                  violation: {
                    violationType: mentorDialogData.violationType,
                    severity: mentorDialogData.severity,
                    description: mentorDialogData.description,
                    evidenceUrl: mentorDialogData.evidenceUrl
                  }
                })}
                disabled={!mentorDialogData.violationType || !mentorDialogData.severity || !mentorDialogData.description || reportViolationMutation.isPending}
                data-testid="button-confirm-report-violation"
              >
                {reportViolationMutation.isPending ? 'Reporting...' : 'Report Violation'}
              </Button>
            )}

            {mentorDialog.type === 'update-phi' && (
              <Button 
                style={{ backgroundColor: BRAND.primary }}
                onClick={() => updatePhiMutation.mutate({ 
                  id: mentorDialog.mentor?.id, 
                  phi: mentorDialogData.phi ?? mentorDialog.mentor?.performanceHealthIndex ?? 100,
                  notes: mentorDialogData.notes
                })}
                disabled={updatePhiMutation.isPending}
                data-testid="button-confirm-update-phi"
              >
                {updatePhiMutation.isPending ? 'Updating...' : 'Update PHI'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Invite Mentor Modal ── */}
      <Dialog open={inviteMentorModal} onOpenChange={setInviteMentorModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite New Mentor</DialogTitle>
            <DialogDescription>Create a mentor account and send them an invitation email with login credentials.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Full Name *</label>
              <Input placeholder="Dr. Arjun Sharma" value={inviteForm.fullName} onChange={e => setInviteForm(f => ({ ...f, fullName: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Email Address *</label>
              <Input type="email" placeholder="mentor@example.com" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Mobile</label>
              <Input placeholder="+91 98765 43210" value={inviteForm.mobile} onChange={e => setInviteForm(f => ({ ...f, mobile: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Mentor Type</label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={inviteForm.mentorType} onChange={e => setInviteForm(f => ({ ...f, mentorType: e.target.value }))}>
                <option value="subject_tutor">Subject Tutor</option>
                <option value="exam_strategist">Exam Strategist</option>
                <option value="performance_coach">Performance Coach</option>
                <option value="psychological_counsellor">Psychological Counsellor</option>
                <option value="career_counsellor">Career Counsellor</option>
                <option value="employability_coach">Employability Coach</option>
                <option value="interview_coach">Interview Coach</option>
                <option value="leadership_coach">Leadership Coach</option>
                <option value="hr_consultant">HR Consultant</option>
                <option value="corporate_trainer">Corporate Trainer</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteMentorModal(false)}>Cancel</Button>
            <Button
              disabled={inviting || !inviteForm.fullName || !inviteForm.email}
              style={{ backgroundColor: BRAND.primary }}
              onClick={async () => {
                setInviting(true);
                try {
                  const res = await fetch('/api/admin/mentors/invite', {
                    method: 'POST', credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(inviteForm),
                  });
                  const d = await res.json();
                  if (res.ok) {
                    alert(`Mentor invited successfully! Temp password: ${d.tempPassword}`);
                    setInviteMentorModal(false);
                    setInviteForm({ fullName: '', email: '', mobile: '', mentorType: 'subject_tutor' });
                    refetchMentors();
                  } else {
                    alert(d.error || 'Failed to invite mentor');
                  }
                } catch { alert('Error sending invitation'); }
                finally { setInviting(false); }
              }}
            >
              {inviting ? 'Sending Invitation…' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Notify Mentor Modal ── */}
      <Dialog open={mentorNotifyModal} onOpenChange={setMentorNotifyModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Notify Mentor — {selectedMentor?.fullName}</DialogTitle>
            <DialogDescription>Send a direct email notification to this mentor.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Subject</label>
              <Input placeholder="Notification from MetryxOne Admin" value={mentorNotifySubject} onChange={e => setMentorNotifySubject(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Message *</label>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#344E86]"
                rows={5}
                placeholder="Type your message here…"
                value={mentorNotifyMessage}
                onChange={e => setMentorNotifyMessage(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMentorNotifyModal(false)}>Cancel</Button>
            <Button
              disabled={sendingMentorNotify || !mentorNotifyMessage.trim()}
              style={{ backgroundColor: BRAND.primary }}
              onClick={async () => {
                setSendingMentorNotify(true);
                try {
                  const res = await fetch(`/api/admin/mentors/${selectedMentor?.id}/notify`, {
                    method: 'POST', credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ subject: mentorNotifySubject, message: mentorNotifyMessage }),
                  });
                  const d = await res.json();
                  if (res.ok) { alert(`Notification sent to ${d.email}`); setMentorNotifyModal(false); }
                  else alert(d.error || 'Failed to send notification');
                } catch { alert('Error sending notification'); }
                finally { setSendingMentorNotify(false); }
              }}
            >
              {sendingMentorNotify ? 'Sending…' : 'Send Notification'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Adjust PHI Modal ── */}
      <Dialog open={mentorAdjPhiModal} onOpenChange={setMentorAdjPhiModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adjust Performance Health Index</DialogTitle>
            <DialogDescription>{selectedMentor?.fullName} — current PHI: {selectedMentor?.performanceHealthIndex ?? 100}%</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-4">
              <input
                type="range" min={0} max={100} step={1}
                value={mentorPhiValue}
                onChange={e => setMentorPhiValue(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-2xl font-extrabold w-14 text-center" style={{ color: mentorPhiValue >= 80 ? '#22c55e' : mentorPhiValue >= 60 ? '#f59e0b' : '#ef4444' }}>{mentorPhiValue}%</span>
            </div>
            <div className="flex gap-3 justify-center">
              {[100, 85, 70, 50, 25, 0].map(v => (
                <button key={v} onClick={() => setMentorPhiValue(v)} className="px-2.5 py-1 rounded text-xs font-semibold border transition-colors"
                  style={{ backgroundColor: mentorPhiValue === v ? BRAND.primary : 'transparent', color: mentorPhiValue === v ? 'white' : '#64748b', borderColor: mentorPhiValue === v ? BRAND.primary : '#e2e8f0' }}>
                  {v}%
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMentorAdjPhiModal(false)}>Cancel</Button>
            <Button
              disabled={savingMentorPhi}
              style={{ backgroundColor: BRAND.primary }}
              onClick={async () => {
                setSavingMentorPhi(true);
                try {
                  const res = await fetch(`/api/admin/mentors/${selectedMentor?.id}/phi`, {
                    method: 'PATCH', credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phi: mentorPhiValue }),
                  });
                  if (res.ok) {
                    alert(`PHI updated to ${mentorPhiValue}%`);
                    setMentorAdjPhiModal(false);
                    refetchMentors();
                  } else {
                    const d = await res.json();
                    alert(d.error || 'Failed to update PHI');
                  }
                } catch { alert('Error updating PHI'); }
                finally { setSavingMentorPhi(false); }
              }}
            >
              {savingMentorPhi ? 'Saving…' : 'Save PHI'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mentor Marketplace Profile Editor Modal */}
      <Dialog open={mentorProfileModal.open} onOpenChange={(open) => setMentorProfileModal({ open, mentor: mentorProfileModal.mentor })}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Marketplace Profile — {mentorProfileModal.mentor?.fullName}</DialogTitle>
            <DialogDescription>
              Edit the public marketplace profile for this mentor. This controls how they appear in the parent-facing Mentor Marketplace.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Display Name</label>
                <Input value={mentorProfileForm.displayName || ''} onChange={e => setMentorProfileForm((f: any) => ({ ...f, displayName: e.target.value }))} placeholder="Public name shown on marketplace" />
              </div>
              <div>
                <label className="text-sm font-medium">Title / Designation</label>
                <Input value={mentorProfileForm.title || ''} onChange={e => setMentorProfileForm((f: any) => ({ ...f, title: e.target.value }))} placeholder="e.g. IIT Alumni | 8+ yrs teaching" />
              </div>
            </div>
            {/* Mentor Type & Mode */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Mentor Type</label>
                <select
                  className="w-full border rounded px-3 py-2 text-sm mt-1"
                  value={mentorProfileForm.mentorType || 'subject_tutor'}
                  onChange={e => setMentorProfileForm((f: any) => ({ ...f, mentorType: e.target.value }))}
                >
                  <optgroup label="LBI — Academic &amp; Student Support">
                    <option value="subject_tutor">Subject Tutor</option>
                    <option value="exam_strategist">Exam Strategist</option>
                    <option value="performance_coach">Performance Coach</option>
                    <option value="psychological_counsellor">Psychological Counsellor</option>
                  </optgroup>
                  <optgroup label="Employability Index">
                    <option value="career_counsellor">Career Counsellor</option>
                    <option value="employability_coach">Employability Coach</option>
                    <option value="interview_coach">Interview Coach</option>
                  </optgroup>
                  <optgroup label="Enterprise Model">
                    <option value="leadership_coach">Leadership Coach</option>
                    <option value="hr_consultant">HR Consultant</option>
                    <option value="corporate_trainer">Corporate Trainer</option>
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Mode</label>
                <select
                  className="w-full border rounded px-3 py-2 text-sm mt-1"
                  value={mentorProfileForm.mode || 'online'}
                  onChange={e => setMentorProfileForm((f: any) => ({ ...f, mode: e.target.value }))}
                >
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Profile Status</label>
                <select
                  className="w-full border rounded px-3 py-2 text-sm mt-1"
                  value={mentorProfileForm.status || 'pending'}
                  onChange={e => setMentorProfileForm((f: any) => ({ ...f, status: e.target.value }))}
                >
                  <option value="pending">Pending</option>
                  <option value="active">Active (Visible)</option>
                  <option value="paused">Paused</option>
                  <option value="deactivated">Deactivated</option>
                </select>
              </div>
            </div>
            {/* Rate & Experience */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Hourly Rate</label>
                <Input type="number" value={mentorProfileForm.hourlyRate || 0} onChange={e => setMentorProfileForm((f: any) => ({ ...f, hourlyRate: e.target.value }))} placeholder="500" />
              </div>
              <div>
                <label className="text-sm font-medium">Currency</label>
                <select
                  className="w-full border rounded px-3 py-2 text-sm mt-1"
                  value={mentorProfileForm.currency || 'INR'}
                  onChange={e => setMentorProfileForm((f: any) => ({ ...f, currency: e.target.value }))}
                >
                  <option value="INR">INR ₹</option>
                  <option value="USD">USD $</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Years of Experience</label>
                <Input type="number" value={mentorProfileForm.experienceYears || 0} onChange={e => setMentorProfileForm((f: any) => ({ ...f, experienceYears: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">City</label>
              <Input value={mentorProfileForm.city || ''} onChange={e => setMentorProfileForm((f: any) => ({ ...f, city: e.target.value }))} placeholder="e.g. Hyderabad" />
            </div>
            {/* Bio */}
            <div>
              <label className="text-sm font-medium">Bio</label>
              <Textarea
                value={mentorProfileForm.bio || ''}
                onChange={e => setMentorProfileForm((f: any) => ({ ...f, bio: e.target.value }))}
                rows={4}
                placeholder="A concise bio shown to parents..."
              />
            </div>
            {/* Subjects & Specializations (comma-separated) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Subjects <span className="text-gray-400 font-normal">(comma-separated)</span></label>
                <Input value={mentorProfileForm.subjects || ''} onChange={e => setMentorProfileForm((f: any) => ({ ...f, subjects: e.target.value }))} placeholder="Maths, Physics, Chemistry" />
              </div>
              <div>
                <label className="text-sm font-medium">Specializations <span className="text-gray-400 font-normal">(comma-separated)</span></label>
                <Input value={mentorProfileForm.specializations || ''} onChange={e => setMentorProfileForm((f: any) => ({ ...f, specializations: e.target.value }))} placeholder="JEE Advanced, NEET" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Psychological Areas <span className="text-gray-400 font-normal">(comma-separated)</span></label>
                <Input value={mentorProfileForm.psychologicalAreas || ''} onChange={e => setMentorProfileForm((f: any) => ({ ...f, psychologicalAreas: e.target.value }))} placeholder="Anxiety, Focus, Confidence" />
              </div>
              <div>
                <label className="text-sm font-medium">Languages <span className="text-gray-400 font-normal">(comma-separated)</span></label>
                <Input value={mentorProfileForm.languages || ''} onChange={e => setMentorProfileForm((f: any) => ({ ...f, languages: e.target.value }))} placeholder="English, Telugu, Hindi" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Certifications <span className="text-gray-400 font-normal">(comma-separated)</span></label>
              <Input value={mentorProfileForm.certifications || ''} onChange={e => setMentorProfileForm((f: any) => ({ ...f, certifications: e.target.value }))} placeholder="NLP Practitioner, CBSE Master Trainer" />
            </div>
            {/* URLs */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">LinkedIn URL</label>
                <Input value={mentorProfileForm.linkedinUrl || ''} onChange={e => setMentorProfileForm((f: any) => ({ ...f, linkedinUrl: e.target.value }))} placeholder="https://linkedin.com/in/..." />
              </div>
              <div>
                <label className="text-sm font-medium">Profile Image URL</label>
                <Input value={mentorProfileForm.profileImageUrl || ''} onChange={e => setMentorProfileForm((f: any) => ({ ...f, profileImageUrl: e.target.value }))} placeholder="https://..." />
              </div>
            </div>
            {/* Toggles */}
            <div className="flex items-center gap-8">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!mentorProfileForm.isVerified}
                  onChange={e => setMentorProfileForm((f: any) => ({ ...f, isVerified: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">Verified Badge</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!mentorProfileForm.isFeatured}
                  onChange={e => setMentorProfileForm((f: any) => ({ ...f, isFeatured: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">Featured on Marketplace</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMentorProfileModal({ open: false, mentor: null })}>Cancel</Button>
            <Button
              style={{ backgroundColor: BRAND.primary }}
              disabled={savingMentorProfile}
              data-testid="button-save-mentor-profile"
              onClick={async () => {
                setSavingMentorProfile(true);
                try {
                  const splitTrim = (s: string) => (s || '').split(',').map((x: string) => x.trim()).filter(Boolean);
                  const payload = {
                    displayName: mentorProfileForm.displayName,
                    title: mentorProfileForm.title,
                    bio: mentorProfileForm.bio,
                    mentorType: mentorProfileForm.mentorType,
                    subjects: splitTrim(mentorProfileForm.subjects),
                    psychologicalAreas: splitTrim(mentorProfileForm.psychologicalAreas),
                    specializations: splitTrim(mentorProfileForm.specializations),
                    languages: splitTrim(mentorProfileForm.languages),
                    certifications: splitTrim(mentorProfileForm.certifications),
                    experienceYears: parseInt(mentorProfileForm.experienceYears) || 0,
                    hourlyRate: parseFloat(mentorProfileForm.hourlyRate) || 0,
                    currency: mentorProfileForm.currency || 'INR',
                    mode: mentorProfileForm.mode,
                    city: mentorProfileForm.city,
                    profileImageUrl: mentorProfileForm.profileImageUrl,
                    linkedinUrl: mentorProfileForm.linkedinUrl,
                    isVerified: mentorProfileForm.isVerified,
                    isFeatured: mentorProfileForm.isFeatured,
                    status: mentorProfileForm.status,
                  };
                  const res = await fetch(`/api/admin/mentors/${mentorProfileModal.mentor?.id}/profile`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(payload),
                  });
                  if (!res.ok) throw new Error(await res.text());
                  toast({ title: 'Profile saved', description: 'Marketplace profile updated successfully.' });
                  setMentorProfileModal({ open: false, mentor: null });
                  refetchMentors();
                } catch (err: any) {
                  toast({ title: 'Error', description: err.message, variant: 'destructive' });
                } finally {
                  setSavingMentorProfile(false);
                }
              }}
            >
              {savingMentorProfile ? 'Saving...' : 'Save Profile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Request Dialog */}
      <Dialog open={documentRequestDialog.open} onOpenChange={(open) => setDocumentRequestDialog({ ...documentRequestDialog, open })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Request Additional Documents</DialogTitle>
            <DialogDescription>
              Select documents to request from {documentRequestDialog.onboarding?.entityName}. An email with upload link will be sent.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Select Documents to Request</label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {((): { type: string; label: string }[] => {
                  const et = documentRequestDialog.onboarding?.entityType;
                  if (et === 'parent') return [
                    { type: 'identity_proof', label: 'Identity Proof (Aadhaar / Passport)' },
                    { type: 'pan_card', label: 'PAN Card' },
                    { type: 'address_proof', label: 'Address Proof' },
                    { type: 'parental_consent', label: 'Parental Consent Form' },
                    { type: 'child_birth_certificate', label: "Child's Birth Certificate" },
                  ];
                  if (et === 'mentor') return [
                    { type: 'identity_proof', label: 'Identity Proof (Aadhaar / Passport)' },
                    { type: 'pan_card', label: 'PAN Card' },
                    { type: 'address_proof', label: 'Address Proof' },
                    { type: 'qualification_certificate', label: 'Qualification Certificate' },
                    { type: 'experience_letter', label: 'Experience Letter' },
                    { type: 'police_clearance', label: 'Police Clearance Certificate' },
                  ];
                  if (et === 'ngo') return [
                    { type: 'registration_certificate', label: 'NGO Registration Certificate' },
                    { type: 'pan_card', label: 'PAN Card' },
                    { type: 'address_proof', label: 'Address Proof' },
                    { type: 'authorization_letter', label: 'Authorization Letter' },
                    { type: '80g_certificate', label: '80G / FCRA Certificate (if applicable)' },
                  ];
                  if (et === 'lei') return [
                    { type: 'registration_certificate', label: 'Company Registration Certificate' },
                    { type: 'pan_card', label: 'PAN Card' },
                    { type: 'gst_certificate', label: 'GST Certificate' },
                    { type: 'address_proof', label: 'Address Proof' },
                    { type: 'authorization_letter', label: 'Authorized Signatory Letter' },
                  ];
                  return [
                    { type: 'registration_certificate', label: 'Registration Certificate' },
                    { type: 'pan_card', label: 'PAN Card' },
                    { type: 'gst_certificate', label: 'GST Certificate' },
                    { type: 'address_proof', label: 'Address Proof' },
                    { type: 'authorization_letter', label: 'Authorization Letter' },
                  ];
                })().map((doc) => (
                  <label key={doc.type} className="flex items-center gap-3 p-2 rounded-lg border hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requestedDocs.includes(doc.type)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setRequestedDocs([...requestedDocs, doc.type]);
                        } else {
                          setRequestedDocs(requestedDocs.filter(d => d !== doc.type));
                        }
                      }}
                      className="w-4 h-4 accent-blue-600"
                      data-testid={`checkbox-request-${doc.type}`}
                    />
                    <span className="text-sm">{doc.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Custom Message (Optional)</label>
              <Textarea
                value={documentRequestMessage}
                onChange={(e) => setDocumentRequestMessage(e.target.value)}
                placeholder="Add a personalized message to the email..."
                className="h-20"
                data-testid="textarea-document-request-message"
              />
            </div>
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
              <p className="text-sm text-blue-700 font-medium mb-1">Upload Link Preview</p>
              <p className="text-xs font-mono text-blue-600 break-all">
                {generatedUploadUrl || `${window.location.origin}/upload/${documentRequestDialog.onboarding?.id || 'xxx'}/documents?token=<generated-on-send>`}
              </p>
              <p className="text-xs text-blue-600 mt-2">This link will expire in 7 days and be emailed to the applicant.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDocumentRequestDialog({ open: false, onboarding: null }); setGeneratedUploadUrl(''); }} data-testid="button-cancel-doc-request">
              Cancel
            </Button>
            <Button 
              style={{ backgroundColor: BRAND.primary }}
              disabled={requestedDocs.length === 0 || sendingDocRequest}
              data-testid="button-send-doc-request"
              onClick={async () => {
                if (!documentRequestDialog.onboarding?.id) return;
                setSendingDocRequest(true);
                try {
                  const res = await fetch(`/api/admin/onboarding/${documentRequestDialog.onboarding.id}/request-documents`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ requestedDocs, customMessage: documentRequestMessage }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.message || 'Failed to send request');
                  setGeneratedUploadUrl(data.uploadUrl);
                  toast({ title: 'Document Request Sent', description: `Upload link emailed to ${documentRequestDialog.onboarding?.entityEmail || 'applicant'}` });
                  setTimeout(() => {
                    setDocumentRequestDialog({ open: false, onboarding: null });
                    setGeneratedUploadUrl('');
                    setRequestedDocs([]);
                    setDocumentRequestMessage('');
                  }, 2000);
                } catch (err: any) {
                  toast({ title: 'Error', description: err.message || 'Failed to send document request', variant: 'destructive' });
                } finally {
                  setSendingDocRequest(false);
                }
              }}
            >
              {sendingDocRequest ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Sending…</> : <><Globe className="h-4 w-4 mr-2" /> Send Request Email</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editUserDialog.open} onOpenChange={(open) => { if (!open) setEditUserDialog({ open: false, user: null }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details for {editUserDialog.user?.full_name || editUserDialog.user?.username || 'this user'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium">Full Name</Label>
              <Input className="mt-1" value={editUserData.full_name || ''} onChange={(e) => setEditUserData({ ...editUserData, full_name: e.target.value })} />
            </div>
            <div>
              <Label className="text-sm font-medium">Email</Label>
              <Input className="mt-1" value={editUserData.email || ''} onChange={(e) => setEditUserData({ ...editUserData, email: e.target.value })} />
            </div>
            <div>
              <Label className="text-sm font-medium">Mobile</Label>
              <Input className="mt-1" value={editUserData.mobile || ''} onChange={(e) => setEditUserData({ ...editUserData, mobile: e.target.value })} />
            </div>
            <div>
              <Label className="text-sm font-medium">Role</Label>
              <Select value={editUserData.role || ''} onValueChange={(val) => setEditUserData({ ...editUserData, role: val })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="parent">Parent</SelectItem>
                  <SelectItem value="mentor">Mentor</SelectItem>
                  <SelectItem value="institute">Institute</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Active</Label>
              <Switch checked={editUserData.is_active ?? true} onCheckedChange={(checked) => setEditUserData({ ...editUserData, is_active: checked })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUserDialog({ open: false, user: null })}>Cancel</Button>
            <Button style={{ backgroundColor: BRAND.primary }} className="text-white" onClick={async () => {
              try {
                const res = await fetch(`/api/admin/users/${editUserDialog.user?.id}`, {
                  method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                  body: JSON.stringify(editUserData),
                });
                if (!res.ok) throw new Error('Failed to update user');
                queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
                try { refetchStudents(); } catch {}
                try { refetchUm(); } catch {}
                toast({ title: 'User Updated', description: `${editUserData.full_name || 'User'} has been updated.` });
                setEditUserDialog({ open: false, user: null });
              } catch (error: any) {
                toast({ title: 'Error', description: error.message, variant: 'destructive' });
              }
            }}>
              <Save className="h-4 w-4 mr-2" /> Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={umResetPwDialog.open} onOpenChange={(open) => { if (!open) { setUmResetPwDialog({ open: false, user: null }); setUmNewPassword(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Key className="h-5 w-5 text-orange-500" /> Reset Password</DialogTitle>
            <DialogDescription>Set a new password for {umResetPwDialog.user?.full_name || umResetPwDialog.user?.email || 'this user'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium">New Password</Label>
              <Input className="mt-1" type="password" placeholder="Min 6 characters" value={umNewPassword} onChange={(e) => setUmNewPassword(e.target.value)} />
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-sm text-orange-700">The user will need to log in with this new password. They won't be notified automatically.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUmResetPwDialog({ open: false, user: null }); setUmNewPassword(''); }}>Cancel</Button>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white" disabled={umNewPassword.length < 6} onClick={async () => {
              try {
                const res = await fetch(`/api/admin/users/${umResetPwDialog.user?.id}/reset-password`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                  body: JSON.stringify({ password: umNewPassword }),
                });
                if (!res.ok) { const data = await res.json(); throw new Error(data.message || 'Failed'); }
                toast({ title: 'Password Reset', description: `Password has been reset for ${umResetPwDialog.user?.full_name || 'user'}.` });
                setUmResetPwDialog({ open: false, user: null });
                setUmNewPassword('');
              } catch (error: any) {
                toast({ title: 'Error', description: error.message, variant: 'destructive' });
              }
            }}>
              <Key className="h-4 w-4 mr-2" /> Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog open={!!importDialog} onOpenChange={(o) => { if (!importLoading) setImportDialog(o); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" style={{ color: '#344E86' }} /> Import Assessment Items
            </DialogTitle>
            <DialogDescription>
              Upload a CSV file to bulk-import or update items. Existing items (matched by{' '}
              <code className="bg-gray-100 px-1 rounded text-xs">question_code</code>) will be updated; new codes will be inserted.
            </DialogDescription>
          </DialogHeader>

          {!importResult ? (
            <div className="space-y-4 py-2">
              <div className="rounded-xl border bg-blue-50 p-4 space-y-2">
                <p className="text-sm font-semibold text-blue-900">Standardised Column Format — all question types share the same columns:</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-blue-800">
                  {[
                    ['question_code *', 'Unique code e.g. ACE.EFF.A.001'],
                    ['domain_code *', 'Domain e.g. ACE'],
                    ['subdomain_code *', 'Subdomain e.g. EFF'],
                    ['age_band_code *', 'Band A / B / C / D / E1'],
                    ['question_text *', 'The statement or question'],
                    ['question_type', 'likert · mcq · true_false · rating · memory'],
                    ['passage_text', 'For memory tests: text to memorise'],
                    ['time_limit_seconds', 'For memory tests: display timer'],
                    ['option_a … option_e', 'Response options text'],
                    ['option_a_score … option_e_score', 'Integer scores per option'],
                    ['correct_answer', 'For MCQ/memory: a / b / c / d / e'],
                    ['difficulty', 'EASY · MEDIUM · HARD'],
                    ['keying', 'Positive · Negative'],
                    ['reverse_scored', 'true / false'],
                    ['is_anchor', 'true / false'],
                    ['weight', 'Numeric default 1.0'],
                  ].map(([col, desc]) => (
                    <div key={col} className="flex gap-1.5">
                      <code className="font-mono font-semibold shrink-0">{col}</code>
                      <span className="text-blue-700 truncate">{desc}</span>
                    </div>
                  ))}
                </div>
                <button className="text-xs text-blue-600 underline mt-1" onClick={() => window.open('/api/lbi/admin/questions/template', '_blank')}>
                  Download template with example rows for all 5 types →
                </button>
              </div>
              <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${importFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-300'}`}>
                {importFile ? (
                  <div className="space-y-2">
                    <Check className="h-8 w-8 mx-auto text-green-500" />
                    <p className="font-medium text-gray-900">{(importFile as File).name}</p>
                    <p className="text-sm text-gray-500">{((importFile as File).size / 1024).toFixed(1)} KB</p>
                    <button className="text-xs text-blue-600 underline" onClick={() => setImportFile(null)}>Remove</button>
                  </div>
                ) : (
                  <label className="cursor-pointer space-y-2 block">
                    <Upload className="h-8 w-8 mx-auto text-gray-400" />
                    <p className="text-sm font-medium text-gray-700">Click to select a CSV file</p>
                    <p className="text-xs text-gray-400">Maximum 10 MB · UTF-8 or UTF-8 BOM encoding</p>
                    <input type="file" accept=".csv,text/csv" className="hidden" onChange={e => setImportFile(e.target.files?.[0] || null)} />
                  </label>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Total Rows', value: (importResult as Record<string,number>).total, color: '#344E86' },
                  { label: 'Created', value: (importResult as Record<string,number>).created, color: '#10b981' },
                  { label: 'Updated', value: (importResult as Record<string,number>).updated, color: '#f59e0b' },
                  { label: 'Skipped', value: (importResult as Record<string,number>).skipped, color: '#ef4444' },
                ].map(s => (
                  <div key={s.label} className="text-center p-3 rounded-xl border">
                    <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              {((importResult as Record<string,unknown[]>).errors?.length > 0) && (
                <div className="border border-red-200 rounded-xl bg-red-50 p-3 max-h-48 overflow-y-auto space-y-1">
                  <p className="text-xs font-semibold text-red-700 mb-2">Row Errors ({(importResult as Record<string,unknown[]>).errors.length})</p>
                  {((importResult as Record<string,{row:number;code:string;error:string}[]>).errors).map((e, i) => (
                    <div key={i} className="text-xs text-red-600">
                      <span className="font-mono font-bold">Row {e.row}</span> [{e.code}] — {e.error}
                    </div>
                  ))}
                </div>
              )}
              {((importResult as Record<string,number>).created + (importResult as Record<string,number>).updated > 0) && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
                  <Check className="h-4 w-4 text-green-600 shrink-0" />
                  <p className="text-sm text-green-800">
                    {(importResult as Record<string,number>).created + (importResult as Record<string,number>).updated} items imported successfully. The item bank has been updated.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setImportDialog(false)} disabled={!!importLoading}>
              {importResult ? 'Close' : 'Cancel'}
            </Button>
            {importResult ? (
              <Button style={{ backgroundColor: '#344E86' }} className="text-white" onClick={() => { setImportFile(null); setImportResult(null); }}>
                Import Another File
              </Button>
            ) : (
              <Button
                disabled={!importFile || !!importLoading}
                style={{ backgroundColor: '#344E86' }}
                className="text-white"
                onClick={async () => {
                  if (!importFile) return;
                  setImportLoading(true);
                  try {
                    const fd = new FormData();
                    fd.append('file', importFile as File);
                    const res = await fetch('/api/lbi/admin/questions/import', { method: 'POST', credentials: 'include', body: fd });
                    const data = await res.json();
                    if (!res.ok) { toast({ title: 'Import Failed', description: data.message || data.error, variant: 'destructive' }); return; }
                    setImportResult(data);
                    refetchLbiAdminQ(); refetchLbiStats(); refetchLbiSubdomains(); refetchLbiDomains();
                  } catch { toast({ title: 'Error', description: 'Upload failed', variant: 'destructive' }); }
                  finally { setImportLoading(false); }
                }}
              >
                {importLoading
                  ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" /> Importing…</>
                  : <><Upload className="h-4 w-4 mr-2" /> Import {importFile ? `(${((importFile as File).size / 1024).toFixed(0)} KB)` : ''}</>
                }
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}
