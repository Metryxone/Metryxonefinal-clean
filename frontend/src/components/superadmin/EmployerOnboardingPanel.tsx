import { BRAND } from '@/design-system/tokens';
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Building2, UserPlus, RefreshCw, Copy, Check, KeyRound, Loader2,
  Eye, EyeOff, Briefcase, Users, ShieldCheck, AlertCircle, Wand2,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { useToast } from '@/hooks/use-toast';



type EmployerRow = {
  orgId: string;
  orgName: string;
  ownerId: string;
  adminEmail: string;
  adminName: string;
  accountType: string;
  industry: string;
  location: string;
  website: string;
  candidateCount: number;
  jobCount: number;
  createdAt: string | null;
};

type CreatedCreds = { adminEmail: string; adminPassword: string; companyName: string };

function genPassword(len = 14): string {
  const sets = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%&*';
  const arr = new Uint32Array(len);
  (window.crypto || (window as any).msCrypto).getRandomValues(arr);
  return Array.from(arr, (n) => sets[n % sets.length]).join('');
}

export default function EmployerOnboardingPanel() {
  const { toast } = useToast();
  const [form, setForm] = useState({
    companyName: '', industry: '', location: '', website: '',
    adminName: '', adminEmail: '', adminPassword: '',
  });
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedCreds | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset-password dialog state
  const [resetFor, setResetFor] = useState<EmployerRow | null>(null);
  const [resetPw, setResetPw] = useState('');
  const [resetting, setResetting] = useState(false);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<{ employers: EmployerRow[] }>({
    queryKey: ['/api/admin/employers'],
    queryFn: async () => {
      const res = await fetch('/api/admin/employers', { credentials: 'include' });
      if (!res.ok) throw new Error(`Failed to load employers (${res.status})`);
      return res.json();
    },
  });
  const employers = data?.employers ?? [];

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const formValid = useMemo(() => {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.adminEmail.trim());
    return form.companyName.trim().length > 0 && emailOk && form.adminPassword.length >= 8;
  }, [form]);

  const handleCreate = async () => {
    if (!formValid || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/employers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || `Onboarding failed (${res.status})`);
      setCreated({ adminEmail: form.adminEmail.trim().toLowerCase(), adminPassword: form.adminPassword, companyName: form.companyName.trim() });
      toast({ title: 'Employer onboarded', description: `${form.companyName.trim()} is ready. Share the credentials below.` });
      setForm({ companyName: '', industry: '', location: '', website: '', adminName: '', adminEmail: '', adminPassword: '' });
      refetch();
    } catch (e: any) {
      toast({ title: 'Could not onboard employer', description: e?.message ?? 'Unknown error', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (!resetFor || resetPw.length < 8 || resetting) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/admin/employers/${resetFor.orgId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ newPassword: resetPw }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || `Reset failed (${res.status})`);
      toast({ title: 'Password reset', description: `New password set for ${resetFor.adminEmail}.` });
      setResetFor(null);
      setResetPw('');
    } catch (e: any) {
      toast({ title: 'Could not reset password', description: e?.message ?? 'Unknown error', variant: 'destructive' });
    } finally {
      setResetting(false);
    }
  };

  const copyCreds = async () => {
    if (!created) return;
    const text = `Company: ${created.companyName}\nLogin role: Corporate\nEmail: ${created.adminEmail}\nPassword: ${created.adminPassword}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Copy failed', description: 'Copy the credentials manually.', variant: 'destructive' });
    }
  };

  return (
    <div className="h-full overflow-auto p-6 space-y-6" style={{ background: '#f8fafc' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ background: BRAND.primary + '15' }}>
            <Building2 size={22} style={{ color: BRAND.primary }} />
          </div>
          <div>
            <h1 className="text-xl font-semibold" style={{ color: BRAND.dark }}>Employer Onboarding</h1>
            <p className="text-sm text-slate-500">Provision an employer organization and create its admin login.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /> Refresh
        </Button>
      </div>

      {/* Just-created credentials callout */}
      {created && (
        <Card style={{ borderColor: BRAND.success }}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2" style={{ color: BRAND.success }}>
                  <ShieldCheck size={18} />
                  <span className="font-semibold">Credentials created — share securely</span>
                </div>
                <div className="text-sm space-y-1 text-slate-700">
                  <div><span className="text-slate-500">Company:</span> <strong>{created.companyName}</strong></div>
                  <div><span className="text-slate-500">Login role:</span> <strong>Corporate</strong></div>
                  <div><span className="text-slate-500">Email:</span> <code className="px-1.5 py-0.5 bg-slate-100 rounded">{created.adminEmail}</code></div>
                  <div><span className="text-slate-500">Password:</span> <code className="px-1.5 py-0.5 bg-slate-100 rounded">{created.adminPassword}</code></div>
                </div>
                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                  <AlertCircle size={12} /> This password is shown once. It is stored hashed and cannot be retrieved later — only reset.
                </p>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <Button size="sm" onClick={copyCreds}>
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setCreated(null)}>Dismiss</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Onboarding form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><UserPlus size={18} /> New employer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Company name <span className="text-red-500">*</span></Label>
              <Input value={form.companyName} onChange={set('companyName')} placeholder="Acme Corp" />
            </div>
            <div>
              <Label>Industry</Label>
              <Input value={form.industry} onChange={set('industry')} placeholder="Information Technology" />
            </div>
            <div>
              <Label>Location</Label>
              <Input value={form.location} onChange={set('location')} placeholder="Bengaluru, India" />
            </div>
            <div>
              <Label>Website</Label>
              <Input value={form.website} onChange={set('website')} placeholder="https://acme.com" />
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="text-sm font-medium text-slate-600 mb-3 flex items-center gap-2"><KeyRound size={15} /> Admin login</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Admin name</Label>
                <Input value={form.adminName} onChange={set('adminName')} placeholder="Jane Doe" />
              </div>
              <div>
                <Label>Admin email (login id) <span className="text-red-500">*</span></Label>
                <Input type="email" value={form.adminEmail} onChange={set('adminEmail')} placeholder="hr@acme.com" />
              </div>
              <div className="md:col-span-2">
                <Label>Password <span className="text-red-500">*</span> <span className="text-xs text-slate-400">(min 8 chars)</span></Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showPw ? 'text' : 'password'}
                      value={form.adminPassword}
                      onChange={set('adminPassword')}
                      placeholder="Set a strong password"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      onClick={() => setShowPw((s) => !s)}
                    >
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <Button type="button" variant="outline" onClick={() => { setForm((f) => ({ ...f, adminPassword: genPassword() })); setShowPw(true); }}>
                    <Wand2 size={14} /> Generate
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <span className="text-xs text-slate-400">Admin signs in by selecting the <strong>Corporate</strong> role.</span>
            <Button onClick={handleCreate} disabled={!formValid || submitting} style={{ background: BRAND.primary }}>
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} Onboard employer
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Existing employers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase size={18} /> Onboarded employers
            {!isLoading && <Badge variant="secondary">{employers.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-slate-500 py-8 justify-center"><Loader2 size={16} className="animate-spin" /> Loading…</div>
          ) : isError ? (
            <div className="flex items-center gap-2 text-red-500 py-8 justify-center"><AlertCircle size={16} /> Could not load employers.</div>
          ) : employers.length === 0 ? (
            <div className="text-center text-slate-400 py-10">
              <Building2 size={28} className="mx-auto mb-2 opacity-50" />
              No employers onboarded yet. Create one above.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Admin email</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead className="text-right"><Users size={13} className="inline" /> Candidates</TableHead>
                  <TableHead className="text-right"><Briefcase size={13} className="inline" /> Jobs</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employers.map((emp) => (
                  <TableRow key={emp.orgId}>
                    <TableCell>
                      <div className="font-medium text-slate-800">{emp.orgName || <span className="text-slate-400">—</span>}</div>
                      {emp.location && <div className="text-xs text-slate-400">{emp.location}</div>}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">{emp.adminEmail || <span className="text-slate-400">—</span>}</TableCell>
                    <TableCell className="text-sm text-slate-600">{emp.industry || <span className="text-slate-400">—</span>}</TableCell>
                    <TableCell className="text-right tabular-nums">{emp.candidateCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{emp.jobCount}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => { setResetFor(emp); setResetPw(''); }}>
                        <KeyRound size={13} /> Reset password
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Reset password dialog */}
      <Dialog open={!!resetFor} onOpenChange={(o) => { if (!o) { setResetFor(null); setResetPw(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset admin password</DialogTitle>
          </DialogHeader>
          {resetFor && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Set a new password for <strong>{resetFor.adminEmail}</strong> ({resetFor.orgName}).
                The current password will stop working immediately.
              </p>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={resetPw}
                  onChange={(e) => setResetPw(e.target.value)}
                  placeholder="New password (min 8 chars)"
                />
                <Button type="button" variant="outline" onClick={() => setResetPw(genPassword())}>
                  <Wand2 size={14} /> Generate
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setResetFor(null); setResetPw(''); }}>Cancel</Button>
            <Button onClick={handleReset} disabled={resetPw.length < 8 || resetting} style={{ background: BRAND.primary }}>
              {resetting ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />} Reset password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
