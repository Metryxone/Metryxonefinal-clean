/**
 * AdminPricingPage — Super admin UI for managing MetryxOne subscription packages / pricing tiers.
 * Standalone page (does not modify SuperAdminDashboard.tsx per project rules).
 *
 * Routes used:
 *   GET    /api/admin/subscription-packages    (auth: super_admin)
 *   POST   /api/admin/subscription-packages    (create)
 *   PATCH  /api/admin/subscription-packages/:id (update)
 *   DELETE /api/admin/subscription-packages/:id (delete)
 *   POST   /api/admin/subscription-packages/seed (bulk seed defaults)
 */
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, Plus, Pencil, Trash2, Star, StarOff, Search, RefreshCw,
  CheckCircle2, XCircle, DatabaseZap, Loader2, Download, Upload,
  TrendingUp, IndianRupee, Users, Package as PackageIcon,
} from "lucide-react";

type Pkg = {
  id: string;
  category: string;
  studentSegment: string;
  productName: string;
  isRecommended: boolean;
  domainsCovered: string[];
  price: number | null;
  validityDays: number | null;
  questionCount: number | null;
  reportType: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type RevenueData = {
  summary: { totalRevenue: number; activeRevenue: number; totalCount: number; activeCount: number; arpu: number; arr: number };
  topPackages: { packageId: string; productName: string; count: number; revenue: number }[];
  monthly: { month: string; count: number; revenue: number }[];
  categories: { category: string; count: number; revenue: number }[];
};

const EMPTY: Omit<Pkg, "id" | "createdAt" | "updatedAt"> = {
  category: "Entry",
  studentSegment: "Any Class",
  productName: "",
  isRecommended: false,
  domainsCovered: [],
  price: null,
  validityDays: 365,
  questionCount: 40,
  reportType: "Basic",
  sortOrder: 0,
  isActive: true,
};

const CATEGORIES = [
  "Entry", "Micro Check", "Exam-Season Special", "Annual Core",
  "Premium", "Post-Exam", "Custom",
];
const REPORT_TYPES = ["Basic", "Detailed", "Comprehensive"];

interface Props { onBack?: () => void }

export default function AdminPricingPage({ onBack }: Props) {
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Pkg | null>(null);
  const [creating, setCreating] = useState(false);
  const [formState, setFormState] = useState<typeof EMPTY>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (kind: "ok" | "err", msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 3500);
  };

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/subscription-packages", {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Pkg[];
      setPkgs(data.sort((a, b) => a.sortOrder - b.sortOrder));
    } catch (e: any) {
      showToast("err", `Load failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); loadRevenue(); }, []);

  async function loadRevenue() {
    try {
      const res = await fetch("/api/admin/subscription-packages/revenue", { credentials: "include" });
      if (res.ok) setRevenue(await res.json());
    } catch { /* silent */ }
  }

  async function exportCsv() {
    try {
      const res = await fetch("/api/admin/subscription-packages/export.csv", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `metryxone-pricing-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast("ok", "CSV downloaded");
    } catch (e: any) {
      showToast("err", `Export failed: ${e.message}`);
    }
  }

  async function importCsv(file: File) {
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/subscription-packages/import", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      showToast(
        "ok",
        `Import done — ${data.inserted ?? 0} new, ${data.updated ?? 0} updated${
          data.errorCount > 0 ? `, ${data.errorCount} errors` : ""
        }`,
      );
      await load();
      await loadRevenue();
    } catch (e: any) {
      showToast("err", `Import failed: ${e.message}`);
    }
  }

  const filtered = pkgs.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.productName.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.studentSegment.toLowerCase().includes(q)
    );
  });

  function openEdit(p: Pkg) {
    setEditing(p);
    setCreating(false);
    setFormState({
      category: p.category,
      studentSegment: p.studentSegment,
      productName: p.productName,
      isRecommended: p.isRecommended,
      domainsCovered: p.domainsCovered || [],
      price: p.price,
      validityDays: p.validityDays,
      questionCount: p.questionCount,
      reportType: p.reportType,
      sortOrder: p.sortOrder,
      isActive: p.isActive,
    });
  }

  function openCreate() {
    setEditing(null);
    setCreating(true);
    setFormState(EMPTY);
  }

  function closeModal() {
    setEditing(null);
    setCreating(false);
    setFormState(EMPTY);
  }

  async function save() {
    setSaving(true);
    try {
      const url = editing
        ? `/api/admin/subscription-packages/${editing.id}`
        : "/api/admin/subscription-packages";
      const method = editing ? "PATCH" : "POST";
      const body = {
        ...formState,
        price: formState.price === null || (formState.price as any) === "" ? null : Number(formState.price),
        validityDays: formState.validityDays ? Number(formState.validityDays) : null,
        questionCount: formState.questionCount ? Number(formState.questionCount) : null,
        sortOrder: Number(formState.sortOrder) || 0,
        domainsCovered: Array.isArray(formState.domainsCovered)
          ? formState.domainsCovered
          : String(formState.domainsCovered).split(",").map((s) => s.trim()).filter(Boolean),
      };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || `HTTP ${res.status}`);
      }
      showToast("ok", editing ? "Package updated" : "Package created");
      closeModal();
      await load();
      await loadRevenue();
    } catch (e: any) {
      showToast("err", `Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this package? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/admin/subscription-packages/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast("ok", "Package deleted");
      await load();
    } catch (e: any) {
      showToast("err", `Delete failed: ${e.message}`);
    }
  }

  async function toggleActive(p: Pkg) {
    try {
      await fetch(`/api/admin/subscription-packages/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive: !p.isActive }),
      });
      await load();
    } catch {
      showToast("err", "Toggle failed");
    }
  }

  async function seedDefaults() {
    if (!confirm("Seed 13 default MetryxOne packages? Existing packages will remain.")) return;
    try {
      const res = await fetch("/api/admin/subscription-packages/seed", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      showToast("ok", `Seeded ${data.inserted ?? 0} packages (total ${data.total ?? "?"})`);
      await load();
    } catch {
      showToast("err", "Seed failed");
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-[#E8F8F7] dark:from-[#0B1220] dark:via-[#0D1627] dark:to-[#0A1F1D]">
      {/* ── Decorative background layers ──────────────────────────────── */}
      {/* Vivid color orbs */}
      <div aria-hidden className="pointer-events-none absolute -top-32 -left-32 h-[560px] w-[560px] rounded-full bg-[#4ECDC4]/45 blur-[100px] dark:bg-[#4ECDC4]/30" />
      <div aria-hidden className="pointer-events-none absolute -top-40 right-[-12rem] h-[600px] w-[600px] rounded-full bg-[#344E86]/45 blur-[110px] dark:bg-[#344E86]/45" />
      <div aria-hidden className="pointer-events-none absolute top-[40%] left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[#FFD166]/35 blur-[100px] dark:bg-[#F59E0B]/20" />
      <div aria-hidden className="pointer-events-none absolute bottom-[-10rem] left-[5%] h-[480px] w-[480px] rounded-full bg-[#FF6B9D]/30 blur-[100px] dark:bg-[#FF6B9D]/15" />

      {/* Aurora sweep line */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#4ECDC4] to-transparent opacity-70" />

      {/* Grid pattern */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.45] dark:opacity-[0.20]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(52,78,134,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(52,78,134,0.10) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage:
            "radial-gradient(ellipse 90% 70% at 50% 0%, black 35%, transparent 85%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 90% 70% at 50% 0%, black 35%, transparent 85%)",
        }}
      />

      {/* Concentric rings backdrop accent */}
      <div aria-hidden className="pointer-events-none absolute right-[-4rem] top-1/3 h-[440px] w-[440px] opacity-30">
        <div className="absolute inset-0 rounded-full border border-[#344E86]/30"></div>
        <div className="absolute inset-8 rounded-full border border-[#344E86]/25"></div>
        <div className="absolute inset-16 rounded-full border border-[#4ECDC4]/30"></div>
        <div className="absolute inset-24 rounded-full border border-[#4ECDC4]/35"></div>
      </div>

      {/* Subtle noise for depth */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.5'/></svg>\")",
        }}
      />

      {/* Floating animated specks */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span className="absolute left-[10%] top-[18%] block h-2.5 w-2.5 rounded-full bg-[#4ECDC4] shadow-[0_0_28px_8px_rgba(78,205,196,0.7)] animate-pulse" />
        <span className="absolute right-[14%] top-[40%] block h-2 w-2 rounded-full bg-[#344E86] shadow-[0_0_24px_6px_rgba(52,78,134,0.7)] animate-pulse [animation-delay:0.6s]" />
        <span className="absolute left-[38%] top-[78%] block h-1.5 w-1.5 rounded-full bg-[#FFD166] shadow-[0_0_22px_6px_rgba(255,209,102,0.75)] animate-pulse [animation-delay:1.4s]" />
        <span className="absolute right-[28%] top-[88%] block h-2 w-2 rounded-full bg-[#FF6B9D] shadow-[0_0_24px_6px_rgba(255,107,157,0.65)] animate-pulse [animation-delay:2s]" />
      </div>

      {/* ── Content (all above backdrop) ──────────────────────────────── */}
      <div className="relative z-10">
      {/* Header */}
      <div className="border-b border-white/40 bg-white/70 px-6 py-4 backdrop-blur-xl dark:border-white/5 dark:bg-slate-900/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                data-testid="admin-pricing-back"
                onClick={onBack}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
                Pricing & Subscription Packages
              </h1>
              <p className="text-xs text-slate-500">
                Super admin · Manage plans shown on /pricing and referenced by the AI coach
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              data-testid="admin-pricing-import-input"
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importCsv(f);
                e.target.value = "";
              }}
            />
            <button
              data-testid="admin-pricing-import-btn"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs font-medium text-slate-700 backdrop-blur hover:bg-white dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800"
              title="Import packages from CSV"
            >
              <Upload className="h-3.5 w-3.5" />
              Import CSV
            </button>
            <button
              data-testid="admin-pricing-export-btn"
              onClick={exportCsv}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs font-medium text-slate-700 backdrop-blur hover:bg-white dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800"
              title="Export current packages to CSV"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
            <button
              data-testid="admin-pricing-seed-btn"
              onClick={seedDefaults}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs font-medium text-slate-700 backdrop-blur hover:bg-white dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800"
              title="Seed 13 default packages"
            >
              <DatabaseZap className="h-3.5 w-3.5" />
              Seed defaults
            </button>
            <button
              data-testid="admin-pricing-refresh"
              onClick={load}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white/80 text-slate-600 backdrop-blur hover:bg-white dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800"
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              data-testid="admin-pricing-new-btn"
              onClick={openCreate}
              className="group relative flex items-center gap-1.5 overflow-hidden rounded-lg bg-gradient-to-r from-[#344E86] to-[#4ECDC4] px-3 py-2 text-xs font-semibold text-white shadow-[0_6px_24px_-6px_rgba(52,78,134,0.5)] transition-transform hover:scale-[1.02]"
            >
              <span aria-hidden className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <Plus className="relative h-3.5 w-3.5" />
              <span className="relative">New package</span>
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          data-testid={`admin-pricing-toast-${toast.kind}`}
          className={`fixed right-6 top-20 z-50 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-lg ${
            toast.kind === "ok"
              ? "bg-emerald-600 text-white"
              : "bg-rose-600 text-white"
          }`}
        >
          {toast.kind === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* Body */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Metric strip */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard label="Total packages" value={pkgs.length} tone="navy" />
          <MetricCard label="Active" value={pkgs.filter((p) => p.isActive).length} tone="teal" />
          <MetricCard label="Recommended" value={pkgs.filter((p) => p.isRecommended).length} tone="amber" />
          <MetricCard label="Priced" value={pkgs.filter((p) => p.price != null).length} tone="slate" />
        </div>

        {/* Revenue Analytics */}
        {revenue && (
          <div data-testid="admin-pricing-revenue-panel" className="mb-6 grid gap-4 lg:grid-cols-3">
            {/* Revenue summary */}
            <div className="overflow-hidden rounded-2xl border border-white/60 bg-white/85 p-5 shadow-[0_20px_60px_-25px_rgba(52,78,134,0.25)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <TrendingUp className="h-3.5 w-3.5 text-[#4ECDC4]" />
                Revenue overview
              </div>
              <div className="grid grid-cols-2 gap-3">
                <RevTile icon={<IndianRupee className="h-3.5 w-3.5" />} label="Total revenue" value={`₹${revenue.summary.totalRevenue.toLocaleString("en-IN")}`} />
                <RevTile icon={<IndianRupee className="h-3.5 w-3.5" />} label="Active revenue" value={`₹${revenue.summary.activeRevenue.toLocaleString("en-IN")}`} />
                <RevTile icon={<Users className="h-3.5 w-3.5" />} label="Subscriptions" value={`${revenue.summary.activeCount} / ${revenue.summary.totalCount}`} subLabel="active / total" />
                <RevTile icon={<TrendingUp className="h-3.5 w-3.5" />} label="ARPU" value={`₹${revenue.summary.arpu.toLocaleString("en-IN")}`} subLabel="avg per user" />
              </div>
              <div className="mt-3 rounded-xl bg-gradient-to-r from-[#344E86] to-[#4ECDC4] px-4 py-3 text-white">
                <div className="text-[10px] font-semibold uppercase tracking-wider opacity-85">Annualized run rate</div>
                <div className="mt-0.5 text-2xl font-bold tabular-nums">₹{revenue.summary.arr.toLocaleString("en-IN")}</div>
              </div>
            </div>

            {/* Top packages */}
            <div className="overflow-hidden rounded-2xl border border-white/60 bg-white/85 p-5 shadow-[0_20px_60px_-25px_rgba(52,78,134,0.25)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <PackageIcon className="h-3.5 w-3.5 text-[#344E86]" />
                Top packages by revenue
              </div>
              {revenue.topPackages.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No subscriptions yet. Sales data will appear here.
                </div>
              ) : (
                <div className="space-y-2">
                  {(() => {
                    const max = Math.max(...revenue.topPackages.map((p) => p.revenue), 1);
                    return revenue.topPackages.slice(0, 6).map((p) => (
                      <div key={p.packageId} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="truncate font-medium text-slate-700 dark:text-slate-200">{p.productName}</span>
                          <span className="font-semibold tabular-nums text-slate-900 dark:text-white">₹{p.revenue.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#344E86] to-[#4ECDC4] transition-all"
                            style={{ width: `${(p.revenue / max) * 100}%` }}
                          />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>

            {/* Monthly trend */}
            <div className="overflow-hidden rounded-2xl border border-white/60 bg-white/85 p-5 shadow-[0_20px_60px_-25px_rgba(52,78,134,0.25)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <TrendingUp className="h-3.5 w-3.5 text-[#FFD166]" />
                Last 12 months
              </div>
              {revenue.monthly.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No monthly data yet.
                </div>
              ) : (
                <div className="flex h-32 items-end gap-1.5">
                  {(() => {
                    const max = Math.max(...revenue.monthly.map((m) => m.revenue), 1);
                    return revenue.monthly.map((m) => (
                      <div key={m.month} className="group flex flex-1 flex-col items-center justify-end gap-1">
                        <div
                          className="w-full rounded-t-md bg-gradient-to-t from-[#344E86] to-[#4ECDC4] opacity-90 transition-opacity hover:opacity-100"
                          style={{ height: `${(m.revenue / max) * 100}%`, minHeight: "4px" }}
                          title={`${m.month}: ₹${m.revenue.toLocaleString("en-IN")} (${m.count} subs)`}
                        />
                        <div className="text-[8px] text-slate-400">{m.month.slice(5)}</div>
                      </div>
                    ));
                  })()}
                </div>
              )}
              {revenue.categories.length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Revenue by category</div>
                  <div className="flex flex-wrap gap-1.5">
                    {revenue.categories.slice(0, 6).map((c) => (
                      <span key={c.category} className="rounded-full bg-[#4ECDC4]/10 px-2 py-0.5 text-[10px] font-medium text-[#1D3E8B] dark:bg-[#4ECDC4]/20 dark:text-[#4ECDC4]">
                        {c.category} · ₹{c.revenue.toLocaleString("en-IN")}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Search & stats */}
        <div className="mb-5 flex items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              data-testid="admin-pricing-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product, category or segment…"
              className="w-full rounded-lg border border-white/60 bg-white/80 py-2 pl-9 pr-3 text-sm text-slate-800 placeholder-slate-400 outline-none backdrop-blur focus:border-[#4ECDC4] dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
            />
          </div>
          <div className="text-sm text-slate-500">
            {loading ? "Loading…" : `${filtered.length} of ${pkgs.length} packages`}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-white/60 bg-white/80 shadow-[0_20px_60px_-25px_rgba(52,78,134,0.25)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70">
          <table data-testid="admin-pricing-table" className="w-full text-sm">
            <thead className="bg-gradient-to-r from-slate-50/80 to-[#E8F8F7]/60 text-left text-xs uppercase tracking-wider text-slate-500 dark:from-slate-950/80 dark:to-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Segment</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Validity</th>
                <th className="px-4 py-3">Qs</th>
                <th className="px-4 py-3">Report</th>
                <th className="px-4 py-3">Rec.</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, idx) => (
                <tr
                  key={p.id}
                  data-testid={`admin-pricing-row-${p.id}`}
                  className="border-t border-slate-100/80 transition-colors hover:bg-gradient-to-r hover:from-[#4ECDC4]/5 hover:to-transparent dark:border-slate-800/80 dark:hover:from-[#4ECDC4]/10"
                >
                  <td className="px-4 py-3 text-slate-500">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                    {p.productName}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.category}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.studentSegment}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                    {p.price !== null && p.price !== undefined ? `₹${p.price}` : <span className="text-amber-500">Not set</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {p.validityDays ? `${p.validityDays}d` : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {p.questionCount ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {p.reportType ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {p.isRecommended ? (
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ) : (
                      <StarOff className="h-4 w-4 text-slate-300" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      data-testid={`admin-pricing-toggle-${p.id}`}
                      onClick={() => toggleActive(p)}
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        p.isActive
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {p.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        data-testid={`admin-pricing-edit-${p.id}`}
                        onClick={() => openEdit(p)}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-800 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        data-testid={`admin-pricing-delete-${p.id}`}
                        onClick={() => remove(p.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-rose-100 hover:text-rose-700 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-sm text-slate-500">
                    No packages match your search. Try <button className="text-[#4ECDC4] underline" onClick={openCreate}>creating one</button> or <button className="text-[#4ECDC4] underline" onClick={seedDefaults}>seeding defaults</button>.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>{/* /z-10 wrapper */}

      {/* Modal */}
      {(editing || creating) && (
        <div
          data-testid="admin-pricing-modal"
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          onClick={closeModal}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                {editing ? "Edit package" : "New package"}
              </h2>
              <button
                data-testid="admin-pricing-modal-close"
                onClick={closeModal}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="grid flex-1 gap-4 overflow-y-auto p-6 md:grid-cols-2">
              <Field label="Product name *">
                <input
                  data-testid="admin-pricing-form-product"
                  value={formState.productName}
                  onChange={(e) => setFormState((s) => ({ ...s, productName: e.target.value }))}
                  className="input-field"
                />
              </Field>

              <Field label="Category *">
                <select
                  data-testid="admin-pricing-form-category"
                  value={formState.category}
                  onChange={(e) => setFormState((s) => ({ ...s, category: e.target.value }))}
                  className="input-field"
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>

              <Field label="Student segment *">
                <input
                  data-testid="admin-pricing-form-segment"
                  value={formState.studentSegment}
                  onChange={(e) => setFormState((s) => ({ ...s, studentSegment: e.target.value }))}
                  placeholder="e.g. Class 10 Boards"
                  className="input-field"
                />
              </Field>

              <Field label="Price (₹)">
                <input
                  data-testid="admin-pricing-form-price"
                  type="number"
                  value={formState.price ?? ""}
                  onChange={(e) => setFormState((s) => ({ ...s, price: e.target.value === "" ? null : Number(e.target.value) }))}
                  placeholder="e.g. 499"
                  className="input-field"
                />
              </Field>

              <Field label="Validity (days)">
                <input
                  data-testid="admin-pricing-form-validity"
                  type="number"
                  value={formState.validityDays ?? ""}
                  onChange={(e) => setFormState((s) => ({ ...s, validityDays: e.target.value === "" ? null : Number(e.target.value) }))}
                  className="input-field"
                />
              </Field>

              <Field label="Question count">
                <input
                  data-testid="admin-pricing-form-qcount"
                  type="number"
                  value={formState.questionCount ?? ""}
                  onChange={(e) => setFormState((s) => ({ ...s, questionCount: e.target.value === "" ? null : Number(e.target.value) }))}
                  className="input-field"
                />
              </Field>

              <Field label="Report type">
                <select
                  data-testid="admin-pricing-form-report"
                  value={formState.reportType ?? "Basic"}
                  onChange={(e) => setFormState((s) => ({ ...s, reportType: e.target.value }))}
                  className="input-field"
                >
                  {REPORT_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>

              <Field label="Sort order">
                <input
                  data-testid="admin-pricing-form-sort"
                  type="number"
                  value={formState.sortOrder}
                  onChange={(e) => setFormState((s) => ({ ...s, sortOrder: Number(e.target.value) || 0 }))}
                  className="input-field"
                />
              </Field>

              <Field label="Domains covered (comma-separated)" wide>
                <input
                  data-testid="admin-pricing-form-domains"
                  value={Array.isArray(formState.domainsCovered) ? formState.domainsCovered.join(", ") : formState.domainsCovered}
                  onChange={(e) => setFormState((s) => ({ ...s, domainsCovered: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) }))}
                  placeholder="Focus, Memory, Confidence, Stress Management"
                  className="input-field"
                />
              </Field>

              <div className="md:col-span-2 flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    data-testid="admin-pricing-form-recommended"
                    type="checkbox"
                    checked={formState.isRecommended}
                    onChange={(e) => setFormState((s) => ({ ...s, isRecommended: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-[#4ECDC4] focus:ring-[#4ECDC4]"
                  />
                  Recommended (★)
                </label>

                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    data-testid="admin-pricing-form-active"
                    type="checkbox"
                    checked={formState.isActive}
                    onChange={(e) => setFormState((s) => ({ ...s, isActive: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-[#4ECDC4] focus:ring-[#4ECDC4]"
                  />
                  Active (shown on /pricing page & used by AI bot)
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-3 dark:border-slate-800 dark:bg-slate-950">
              <button
                data-testid="admin-pricing-form-cancel"
                onClick={closeModal}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                data-testid="admin-pricing-form-save"
                onClick={save}
                disabled={saving || !formState.productName.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#344E86] to-[#4ECDC4] px-4 py-2 text-sm font-semibold text-white shadow disabled:opacity-50"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {editing ? "Save changes" : "Create package"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .input-field {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid rgb(226 232 240 / 1);
          background: white;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: rgb(15 23 42 / 1);
          outline: none;
        }
        .input-field:focus { border-color: #4ECDC4; }
        .dark .input-field {
          background: rgb(15 23 42 / 1);
          border-color: rgb(51 65 85 / 1);
          color: rgb(241 245 249 / 1);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">{label}</label>
      {children}
    </div>
  );
}

function RevTile({ icon, label, value, subLabel }: { icon: React.ReactNode; label: string; value: string; subLabel?: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
        <span className="text-[#344E86] dark:text-[#4ECDC4]">{icon}</span>
        {label}
      </div>
      <div className="mt-1 text-base font-bold tabular-nums text-slate-900 dark:text-white">{value}</div>
      {subLabel && <div className="text-[10px] text-slate-400">{subLabel}</div>}
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: "navy" | "teal" | "amber" | "slate" }) {
  const tones: Record<string, { bg: string; text: string; shadow: string; glow: string }> = {
    navy: {
      bg: "linear-gradient(135deg, #344E86 0%, #4766A4 100%)",
      text: "#ffffff",
      shadow: "0 14px 40px -16px rgba(52,78,134,0.65)",
      glow: "rgba(255,255,255,0.25)",
    },
    teal: {
      bg: "linear-gradient(135deg, #4ECDC4 0%, #2AA7A0 100%)",
      text: "#ffffff",
      shadow: "0 14px 40px -16px rgba(78,205,196,0.65)",
      glow: "rgba(255,255,255,0.30)",
    },
    amber: {
      bg: "linear-gradient(135deg, #FFD166 0%, #F4A261 100%)",
      text: "#1f2937",
      shadow: "0 14px 40px -16px rgba(244,162,97,0.7)",
      glow: "rgba(255,255,255,0.45)",
    },
    slate: {
      bg: "linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)",
      text: "#0f172a",
      shadow: "0 14px 40px -16px rgba(15,23,42,0.20)",
      glow: "rgba(78,205,196,0.18)",
    },
  };
  const t = tones[tone];
  return (
    <div
      data-testid={`admin-pricing-metric-${tone}`}
      className="group relative overflow-hidden rounded-2xl p-4 ring-1 ring-white/30 backdrop-blur transition-transform hover:-translate-y-0.5"
      style={{ background: t.bg, color: t.text, boxShadow: t.shadow }}
    >
      <span aria-hidden className="absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl" style={{ background: t.glow }} />
      <div className="relative">
        <div className="text-[10px] font-semibold uppercase tracking-wider opacity-85">{label}</div>
        <div className="mt-1 text-3xl font-bold tabular-nums">{value}</div>
      </div>
    </div>
  );
}
