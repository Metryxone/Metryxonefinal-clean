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

export default function PricingPanel() {
  const p = useAdminDashboard();
  const {
    isAuthenticated, activeTab, setActiveTab, crisisPending, psyActiveSection, setPsyActiveSection,
    searchQuery, setSearchQuery, statusFilter, setStatusFilter, entityTypeFilter, setEntityTypeFilter,
    actionDialog, setActionDialog, actionNotes, setActionNotes, sidebarCollapsed, setSidebarCollapsed,
    userMgmtView, setUserMgmtView, securityView, setSecurityView, hrSubTab, setHrSubTab,
    newJobData, setNewJobData, selectedStudents, setSelectedStudents, instituteFilter, setInstituteFilter,
    financialSubTab, setFinancialSubTab, selectedMentor, setSelectedMentor,
    mentorStatusFilter, setMentorStatusFilter, mentorSearchQuery, setMentorSearchQuery,
    mentorTypeFilter, setMentorTypeFilter, mentorAreaFilter, setMentorAreaFilter,
    mentorDialog, setMentorDialog, documentRequestDialog, setDocumentRequestDialog,
    requestedDocs, setRequestedDocs, documentRequestMessage, setDocumentRequestMessage,
    sendingDocRequest, setSendingDocRequest, generatedUploadUrl, setGeneratedUploadUrl,
    mentorDialogData, setMentorDialogData, mentorDetailTab, setMentorDetailTab,
    mentorSectionTab, setMentorSectionTab, mentorViewMode, setMentorViewMode,
    mentorSortBy, setMentorSortBy, mentorSelectedIds, setMentorSelectedIds,
    mentorBulkActionLoading, setMentorBulkActionLoading, inviteMentorModal, setInviteMentorModal,
    inviteForm, setInviteForm, inviting, setInviting, mentorNotifyModal, setMentorNotifyModal,
    mentorNotifySubject, setMentorNotifySubject, mentorNotifyMessage, setMentorNotifyMessage,
    sendingMentorNotify, setSendingMentorNotify, mentorAdjPhiModal, setMentorAdjPhiModal,
    mentorPhiValue, setMentorPhiValue, savingMentorPhi, setSavingMentorPhi,
    mentorAssignTaskModal, setMentorAssignTaskModal, mentorTaskForm, setMentorTaskForm,
    savingMentorTask, setSavingMentorTask, mentorReportViolationModal, setMentorReportViolationModal,
    mentorViolationForm, setMentorViolationForm, savingMentorViolation, setSavingMentorViolation,
    mentorProfileSubTab, setMentorProfileSubTab, mentorProfileModal, setMentorProfileModal,
    mentorProfileForm, setMentorProfileForm, savingMentorProfile, setSavingMentorProfile,
    selectedParent, setSelectedParent, parentSearch, setParentSearch,
    parentSubFilter, setParentSubFilter, parentDetailTab, setParentDetailTab,
    kycAdminAction, setKycAdminAction, kycRejectionReason, setKycRejectionReason,
    kycAdminNotes, setKycAdminNotes, kycActionLoading, setKycActionLoading,
    kycActionFeedback, setKycActionFeedback, consentEmailSending, setConsentEmailSending,
    consentEmailResult, setConsentEmailResult, parentActionLoading, setParentActionLoading,
    parentActionFeedback, setParentActionFeedback, parentResetPwdOpen, setParentResetPwdOpen,
    parentResetPwdValue, setParentResetPwdValue, parentNotifOpen, setParentNotifOpen,
    parentNotifMessage, setParentNotifMessage, selectedStudent, setSelectedStudent,
    studentSearch, setStudentSearch, studentGradeFilter, setStudentGradeFilter,
    studentDetailTab, setStudentDetailTab, studentActionFeedback, setStudentActionFeedback,
    studentActionLoading, setStudentActionLoading, studentResetPwdOpen, setStudentResetPwdOpen,
    studentResetPwdValue, setStudentResetPwdValue, studentNotifOpen, setStudentNotifOpen,
    studentNotifMessage, setStudentNotifMessage, studentRegistryExportOpen, setStudentRegistryExportOpen,
    studentsView, setStudentsView, rosterSchoolFilter, setRosterSchoolFilter,
    rosterGradeFilter, setRosterGradeFilter, rosterSearch, setRosterSearch,
    rosterGroupBy, setRosterGroupBy, rosterExportOpen, setRosterExportOpen,
    selectedInstitution, setSelectedInstitution, institutionSearch, setInstitutionSearch,
    institutionTypeFilter, setInstitutionTypeFilter, institutionDetailTab, setInstitutionDetailTab,
    assigningInstCode, setAssigningInstCode, instStudentsSearch, setInstStudentsSearch,
    instStudentsGroupBy, setInstStudentsGroupBy, instAssignPlanModal, setInstAssignPlanModal,
    instAssignMentorModal, setInstAssignMentorModal, instSelectedPlanId, setInstSelectedPlanId,
    instSelectedMentorId, setInstSelectedMentorId, instMentorSlotDate, setInstMentorSlotDate,
    selectedOnboarding, setSelectedOnboarding, onboardingSearch, setOnboardingSearch,
    onboardingSubTab, setOnboardingSubTab, selectedEnrollmentKyc, setSelectedEnrollmentKyc,
    enrollmentKycSearchQuery, setEnrollmentKycSearchQuery, kycStatusFilter, setKycStatusFilter,
    broadcastCategory, setBroadcastCategory, broadcastTitle, setBroadcastTitle,
    broadcastMessage, setBroadcastMessage, broadcastPriority, setBroadcastPriority,
    broadcastTargetRoles, setBroadcastTargetRoles, broadcastActionUrl, setBroadcastActionUrl,
    broadcastSendEmail, setBroadcastSendEmail, notifSubTab, setNotifSubTab,
    pauseFrom, setPauseFrom, pauseTo, setPauseTo, templateSearch, setTemplateSearch,
    templateCategoryFilter, setTemplateCategoryFilter, templateExpandedId, setTemplateExpandedId,
    templateDialog, setTemplateDialog, templateFormData, setTemplateFormData,
    templateSaving, setTemplateSaving, quickSendTemplateId, setQuickSendTemplateId,
    quickSendRecipientId, setQuickSendRecipientId, quickSendContext, setQuickSendContext,
    quickSendSending, setQuickSendSending, notifLogCategoryFilter, setNotifLogCategoryFilter,
    notifLogTypeFilter, setNotifLogTypeFilter, notifLogPriorityFilter, setNotifLogPriorityFilter,
    notifLogExpandedId, setNotifLogExpandedId, reportIncidentDialog, setReportIncidentDialog,
    newIncidentData, setNewIncidentData, editPackageDialog, setEditPackageDialog,
    createPackageDialog, setCreatePackageDialog, pkgWizardStep, setPkgWizardStep,
    editPackageData, setEditPackageData, deleteConfirmId, setDeleteConfirmId,
    newPackageData, setNewPackageData, newPkgCatMode, setNewPkgCatMode,
    editPkgCatMode, setEditPkgCatMode, newPkgSubCatMode, setNewPkgSubCatMode,
    editPkgSubCatMode, setEditPkgSubCatMode, psychoQuestionFilter, setPsychoQuestionFilter,
    lbiQuestionFilter, setLbiQuestionFilter, bookingSearch, setBookingSearch,
    bookingStatusFilter, setBookingStatusFilter, showAssignDialog, setShowAssignDialog,
    assignChildId, setAssignChildId, assignPackageId, setAssignPackageId,
    assignAgeBandFilter, setAssignAgeBandFilter, assignSubTypeFilter, setAssignSubTypeFilter,
    assignInstitutionFilter, setAssignInstitutionFilter, assignStartDate, setAssignStartDate,
    assignNotes, setAssignNotes, assignSubmitting, setAssignSubmitting,
    assignSuccess, setAssignSuccess, assignConflict, setAssignConflict,
    assignPkgSearch, setAssignPkgSearch, assignMode, setAssignMode,
    assignChildSearch, setAssignChildSearch, assignPkgSort, setAssignPkgSort,
    seedingPackages, setSeedingPackages, scoringSubTab, setScoringSubTab,
    calcModule, setCalcModule, calcInputs, setCalcInputs, calcResult, setCalcResult,
    expandedModule, setExpandedModule, publishModalOpen, setPublishModalOpen,
    publishChoice, setPublishChoice, publishStatus, setPublishStatus,
    configVersion, configApproval, setConfigApproval, auditLog, setAuditLog,
    versionHistory, auditFilter, setAuditFilter, moduleHealth,
    domainRows, setDomainRows, selectedProductId, setSelectedProductId,
    productWeightConfig, setProductWeightConfig, domainSaveStatus, setDomainSaveStatus,
    normRows, setNormRows, normLocked, setNormLocked, batchMode, setBatchMode,
    batchCsv, setBatchCsv, batchResults, setBatchResults, diffExpanded, setDiffExpanded,
    importPreviewOpen, setImportPreviewOpen, importPreviewData, setImportPreviewData,
    alertRules, setAlertRules, formulaRows, setFormulaRows, scoringParams, setScoringParams,
    scoringConfigLoaded, setScoringConfigLoaded, studentsPage, setStudentsPage,
    studentsRoleFilter, setStudentsRoleFilter, studentsActiveFilter, setStudentsActiveFilter,
    editUserDialog, setEditUserDialog, editUserData, setEditUserData,
    umPage, setUmPage, umRoleFilter, setUmRoleFilter, umStatusFilter, setUmStatusFilter,
    umSearch, setUmSearch, umResetPwDialog, setUmResetPwDialog, umNewPassword, setUmNewPassword,
    scheduledJobStatusFilter, setScheduledJobStatusFilter,
    documentSearch, setDocumentSearch, documentStatusFilter, setDocumentStatusFilter,
    documentEntityFilter, setDocumentEntityFilter, settingsSubTab, setSettingsSubTab,
    stats, statsLoading, refetchStats, platformSettingsData, refetchSettings,
    onboardingApprovals, refetchOnboarding, entityCodes, refetchCodes,
    consents, refetchConsents, documentsData, documentsLoading, refetchDocuments,
    auditLogs, refetchAuditLogs, securityConfig, refetchSecurityConfig,
    securityIncidents, refetchSecurityIncidents, retentionPolicies, refetchRetentionPolicies,
    accessPolicies, refetchAccessPolicies, reconciliations, refetchReconciliations,
    learningPlans, refetchLearningPlans, behaviorData, refetchBehaviorData,
    psychoAgeBands, refetchAgeBands, psychoDomains, refetchDomains,
    psychoConfigs, refetchConfigs, psychoQuestions, refetchPsychoQuestions,
    lbiDomains, refetchLbiDomains, competencyDomains, refetchCompetencyDomains,
    lbiAgeBands, refetchLbiAgeBands, lbiQuestions, refetchLbiQuestions,
    lbiAdminQuestions, refetchLbiAdminQ, lbiAdminQLoading, customAssessmentModules, refetchCustomModules,
    lbiAdminSubdomains, refetchLbiSubdomains, sdiDomains, lbiAdminStats, refetchLbiStats,
    erqData, refetchErqData, examReadyData, refetchExamReadyData,
    subscriptionPackages, refetchSubscriptionPackages, subscriptionStats, refetchSubscriptionStats,
    lbiCatalog, moduleScoringCatalog, engineStats, assessmentProducts, refetchProducts,
    adminSubscriptions, refetchAdminSubscriptions, childrenList, assignChildActiveSubs,
    jobs, refetchJobs, mentors, refetchMentors, mentorKpis, mentorTasks, refetchMentorTasks,
    mentorPayouts, mentorViolations, refetchMentorViolations, mentorBookings, refetchMentorBookings,
    mentorReviewsData, refetchMentorReviews, mentorOnboarding, refetchMentorOnboarding,
    mentorPlatformStats, refetchMentorPlatformStats, mentorAllSessions, refetchMentorAllSessions,
    mentorLeaderboard, refetchMentorLeaderboard, parents, refetchParents, loadingParents,
    parentChildren, refetchParentChildren, parentBriefings, refetchParentBriefings,
    parentSubscription, refetchParentSubscription, parentActivity, refetchParentActivity,
    parentBookings, refetchParentBookings, parentKyc, refetchParentKyc,
    studentsList, refetchStudents, loadingStudents, classRosterRaw, refetchClassRoster, loadingClassRoster,
    studentWellness, refetchStudentWellness, studentLbi, refetchStudentLbi,
    studentBookings, refetchStudentBookings, studentSubscription, refetchStudentSub,
    selectedStudentDetail, institutionsList, refetchInstitutions, loadingInstitutions,
    instStudentsData, refetchInstStudents, instMentorsList, instPlansList,
    applications, refetchApplications, transactions, refetchTransactions, financialStats,
    institutes, usersData, studentsData, studentsLoading, refetchStudentsLegacy,
    umData, umLoading, refetchUm, onboardingStats, kycDocuments, refetchKyc,
    studentEnrollments, refetchEnrollments, enrollmentKycList, refetchEnrollmentKyc,
    mentorPipelineList, refetchMentorPipeline,
    approveOnboardingMutation, makerVerifyKycMutation, checkerApproveKycMutation,
    rejectKycMutation, rejectOnboardingMutation, verifyDocumentsMutation, verifyKycMutation,
    suspendOnboardingMutation, reinstateOnboardingMutation, generateCodeMutation, revokeCodeMutation,
    activateMentorMutation, suspendMentorMutation, warnMentorMutation, reactivateMentorMutation,
    advanceOnboardingStageMutation, assignTaskMutation, reportViolationMutation, updatePhiMutation,
    approveJobMutation, createJobMutation, submitJobMutation, approveJobStageMutation,
    publishJobMutation, closeJobMutation, rejectJobMutation, shortlistApplicationMutation,
    rejectApplicationMutation, advanceApplicationMutation, processPayoutMutation,
    toggleScenarioMutation, deleteScenarioMutation, cancelScheduledJobMutation,
    toast, queryClient, saveScoringDomains, saveScoringNorms, saveScoringParams, saveScoringModules,
    updateSetting, seedDefaultSettings, handleLogout, getSettingValue, getSettingBool,
    BRAND, formatDate, formatDateTime, formatCurrency, getStatusBadge, formatEntityType,
  } = p;

  return (
                <div className="space-y-0">
                  {/* Hero Header */}
                  {(() => {
                    const publishedCount   = subscriptionStats.activePackages;
                    const draftCount      = Math.max(0, subscriptionStats.totalPackages - publishedCount);
                    const recommendedCount = subscriptionPackages.filter((p: any) => p.isRecommended).length;
                    const pkgStats = [
                      {
                        label: 'All Packages',
                        value: subscriptionStats.totalPackages,
                        sub: 'across all categories',
                        icon: Package,
                        accent: BRAND.accent,
                        testid: 'stat-total-packages',
                      },
                      {
                        label: 'Saved as Draft',
                        value: draftCount,
                        sub: 'pending review / config',
                        icon: FileText,
                        accent: '#F59E0B',
                        testid: 'stat-draft-packages',
                      },
                      {
                        label: 'Published',
                        value: publishedCount,
                        sub: 'live & visible to users',
                        icon: CheckCircle,
                        accent: '#10B981',
                        testid: 'stat-published-packages',
                      },
                      {
                        label: 'Recommended',
                        value: recommendedCount,
                        sub: 'featured on listings',
                        icon: Star,
                        accent: '#8B5CF6',
                        testid: 'stat-recommended-packages',
                      },
                      {
                        label: 'Total Subscriptions',
                        value: subscriptionStats.totalSubscriptions,
                        sub: 'all-time purchases',
                        icon: Users,
                        accent: '#4ECDC4',
                        testid: 'stat-total-subs',
                      },
                      {
                        label: 'Active Subscribers',
                        value: subscriptionStats.activeSubscriptions,
                        sub: 'currently subscribed',
                        icon: TrendingUp,
                        accent: '#F97316',
                        testid: 'stat-active-subs',
                      },
                    ];
                    return (
                      <div className="rounded-xl overflow-hidden mb-6" style={{ backgroundColor: BRAND.primary }}>
                        <div className="relative px-8 pt-7 pb-6">
                          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '28px 28px' }} />
                          <div className="relative z-10">
                            {/* Breadcrumb */}
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/15 mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                              <CreditCard size={12} style={{ color: BRAND.accent }} />
                              <span className="text-[10px] font-semibold text-white/60 uppercase tracking-[0.12em]">Admin · Package Management</span>
                            </div>
                            {/* Title row */}
                            <div className="flex items-end justify-between mb-5">
                              <div>
                                <h2 className="text-[22px] font-extrabold text-white tracking-tight leading-none mb-1.5" data-testid="text-pricing-header">Pricing & Packages</h2>
                                <p className="text-sm text-white/50">Create, configure, and publish assessment packages across all service areas</p>
                              </div>
                            </div>
                            {/* Stat cards — 3+3 grid */}
                            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                              {pkgStats.map((s) => (
                                <div key={s.label} className="rounded-xl p-3 flex flex-col gap-1" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }} data-testid={s.testid}>
                                  <div className="flex items-center gap-1.5">
                                    <s.icon size={13} style={{ color: s.accent }} />
                                    <span className="text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.45)' }}>{s.label}</span>
                                  </div>
                                  <span className="text-2xl font-extrabold text-white leading-none">{s.value}</span>
                                  <span className="text-[10px] leading-tight" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.sub}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Action Bar: Category Tabs + Actions */}
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 px-1">
                    <div className="flex gap-1.5 p-1.5 rounded-2xl overflow-x-auto max-w-full" style={{ backgroundColor: '#f1f5f9' }} data-testid="pricing-category-tabs">
                      {['all', ...Array.from(new Set(subscriptionPackages.map((p: any) => p.category))).sort()].map((cat) => {
                        const isActive = pricingCategoryFilter === cat;
                        const count = cat === 'all' ? subscriptionPackages.length : subscriptionPackages.filter((p: any) => p.category === cat).length;
                        return (
                          <button
                            key={cat}
                            onClick={() => setPricingCategoryFilter(cat)}
                            className="relative px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0"
                            style={{
                              backgroundColor: isActive ? '#fff' : 'transparent',
                              color: isActive ? BRAND.primary : '#64748b',
                              boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                            }}
                            data-testid={`btn-pricing-cat-${cat.replace(/[^a-z]/gi, '-').toLowerCase()}`}
                          >
                            {cat === 'all' ? 'All' : cat}
                            {count > 0 && <span className="ml-1.5 text-[10px] opacity-60">({count})</span>}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9"
                        onClick={() => refetchSubscriptionPackages()}
                        data-testid="btn-refresh-packages"
                      >
                        <RefreshCw className="h-4 w-4 mr-1.5" />
                        Refresh
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9"
                        disabled={seedingPackages}
                        onClick={async () => {
                          setSeedingPackages(true);
                          try {
                            const res = await fetch('/api/admin/subscription-packages/seed', { method: 'POST', credentials: 'include' });
                            if (res.ok) {
                              const result = await res.json();
                              toast({ title: 'Packages Seeded', description: `Added ${result.inserted} packages` });
                              refetchSubscriptionPackages();
                              refetchSubscriptionStats();
                            } else throw new Error('Seed failed');
                          } catch (e) {
                            toast({ title: 'Error', description: 'Failed to seed packages', variant: 'destructive' });
                          } finally { setSeedingPackages(false); }
                        }}
                        data-testid="btn-seed-packages"
                      >
                        {seedingPackages ? <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" /> : <Database className="h-4 w-4 mr-1.5" />}
                        {seedingPackages ? 'Seeding...' : 'Seed Defaults'}
                      </Button>
                      {onNavigate && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9"
                          onClick={() => onNavigate('admin-pricing' as any)}
                          data-testid="btn-bulk-pricing"
                          title="Open advanced pricing manager with CSV import / export and revenue analytics"
                        >
                          <Upload className="h-4 w-4 mr-1.5" />
                          Bulk Pricing (CSV)
                        </Button>
                      )}
                      <Button
                        size="sm"
                        className="h-9 text-white"
                        style={{ backgroundColor: BRAND.primary }}
                        onClick={() => {
                          setNewPackageData({
                            productName: '',
                            category: '',
                            studentSegment: 'Any Class',
                            price: '',
                            domainsCovered: [],
                            reportType: 'Basic',
                            questionCount: '',
                            validityDays: '',
                            isRecommended: false,
                            isActive: true,
                            sortOrder: 0,
                          });
                          setNewPkgCatMode(false);
                          setCreatePackageDialog(true);
                        }}
                        data-testid="btn-create-package"
                      >
                        <Plus className="h-4 w-4 mr-1.5" />
                        Create Package
                      </Button>
                    </div>
                  </div>

                  {/* Active Category Info */}
                  {(() => {
                    const filtered = pricingCategoryFilter === 'all' ? subscriptionPackages : subscriptionPackages.filter((p: any) => p.category === pricingCategoryFilter);
                    const prices = filtered.filter((p: any) => p.price).map((p: any) => p.price);
                    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
                    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
                    const CATEGORY_ICONS: Record<string, any> = {
                      'all': CreditCard,
                      'Entry (Micro Check)': Zap,
                      'Exam-Season Special': Brain,
                      'Annual Core': Award,
                      'Premium / High-Pressure': Crown,
                      'Post-Exam / Transition': TrendingUp,
                    };
                    const CatIcon = CATEGORY_ICONS[pricingCategoryFilter] || BookOpen;
                    return (
                      <div className="flex items-center justify-between mb-5 px-1">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.primary}08` }}>
                            <CatIcon size={16} style={{ color: BRAND.primary }} />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-gray-900">
                              {pricingCategoryFilter === 'all' ? 'All Packages' : pricingCategoryFilter}
                            </h3>
                            <p className="text-[11px] text-gray-400">
                              {filtered.length} {filtered.length === 1 ? 'package' : 'packages'}
                              {prices.length === 0 ? ' · Custom pricing' :
                                minPrice === maxPrice ? ` · From ₹${minPrice.toLocaleString()}` :
                                ` · ₹${minPrice.toLocaleString()} – ₹${maxPrice.toLocaleString()}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-gray-400">
                          <span className="flex items-center gap-1"><Check size={10} style={{ color: BRAND.accent }} /> {subscriptionStats.activePackages} active</span>
                          <span className="flex items-center gap-1"><Check size={10} style={{ color: BRAND.accent }} /> One-time assessment</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Package Cards */}
                  {(() => {
                    const filtered = pricingCategoryFilter === 'all' ? subscriptionPackages : subscriptionPackages.filter((p: any) => p.category === pricingCategoryFilter);
                    if (filtered.length === 0) {
                      return (
                        <div className="text-center py-16 text-gray-500 bg-white rounded-2xl border shadow-sm mb-6">
                          <CreditCard className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                          <p className="font-medium">No packages found</p>
                          <p className="text-sm mt-1 mb-4">
                            {pricingCategoryFilter === 'all'
                              ? 'Click "Seed Defaults" to add the standard LBI packages'
                              : `No packages in this category yet`}
                          </p>
                        </div>
                      );
                    }
                    return (
                      <div className={`grid gap-4 mb-6 ${filtered.length === 1 ? 'max-w-md' : filtered.length === 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
                        {filtered.map((pkg: any) => (
                          <div
                            key={pkg.id}
                            className={`relative rounded-2xl border bg-white transition-all hover:shadow-lg flex flex-col ${pkg.isRecommended ? 'border-2 shadow-md' : 'shadow-sm'} ${!pkg.isActive ? 'opacity-60' : ''}`}
                            style={{ borderColor: pkg.isRecommended ? BRAND.accent : '#e5e7eb' }}
                            data-testid={`package-card-${pkg.id}`}
                          >
                            {pkg.isRecommended && (
                              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                                <span className="text-[9px] font-bold px-3 py-1 rounded-full text-white shadow-sm whitespace-nowrap" style={{ backgroundColor: BRAND.accent }}>
                                  Recommended
                                </span>
                              </div>
                            )}
                            {!pkg.isActive && (
                              <div className="absolute top-3 right-3 z-10">
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-500">Inactive</span>
                              </div>
                            )}

                            <div className="p-5 flex-1 flex flex-col">
                              <div className="flex items-start justify-between mb-1">
                                <h4 className="text-sm font-bold text-gray-900 leading-snug">{pkg.productName}</h4>
                                {pkg.price ? (
                                  <span className="text-lg font-extrabold shrink-0 ml-3" style={{ color: BRAND.primary }}>₹{pkg.price.toLocaleString()}</span>
                                ) : (
                                  <span className="text-[11px] text-gray-400 font-semibold shrink-0 ml-3">Custom</span>
                                )}
                              </div>

                              <p className="text-[11px] text-gray-400 mb-3">{pkg.studentSegment}</p>

                              <div className="flex items-center gap-2 mb-3">
                                <span className="text-[10px] px-2 py-0.5 rounded font-semibold" style={{ backgroundColor: `${BRAND.primary}08`, color: BRAND.primary }}>
                                  {pkg.reportType || 'Basic'}
                                </span>
                                <span className="text-[10px] text-gray-400">{pkg.domainsCovered?.length || 0} domains</span>
                                {pkg.questionCount && <span className="text-[10px] text-gray-400">{pkg.questionCount} Qs</span>}
                                {pkg.validityDays && <span className="text-[10px] text-gray-400">{pkg.validityDays}d</span>}
                              </div>

                              <ul className="space-y-1.5 mb-4 flex-1">
                                {pkg.domainsCovered?.slice(0, 4).map((d: string, i: number) => (
                                  <li key={i} className="flex items-center gap-2 text-[11px] text-gray-600">
                                    <Check size={11} className="shrink-0" style={{ color: BRAND.accent }} />
                                    <span className="truncate">{d}</span>
                                  </li>
                                ))}
                                {pkg.domainsCovered?.length > 4 && (
                                  <li className="text-[11px] pl-5 font-medium" style={{ color: BRAND.accent }}>
                                    +{pkg.domainsCovered.length - 4} more domains
                                  </li>
                                )}
                              </ul>

                              <div className="flex gap-1.5 pt-3 border-t border-gray-100">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 h-8 text-[11px] rounded-lg"
                                  onClick={() => {
                                    setEditPackageData({
                                      ...pkg,
                                      price: pkg.price ?? '',
                                      questionCount: pkg.questionCount ?? '',
                                      validityDays: pkg.validityDays ?? '',
                                      originalPrice: pkg.originalPrice ?? '',
                                      discountPct: pkg.discountPct ?? '',
                                      offerLabel: pkg.offerLabel ?? '',
                                      couponCode: pkg.couponCode ?? '',
                                      couponDiscountPct: pkg.couponDiscountPct ?? '',
                                      trialDays: pkg.trialDays ?? '',
                                      scholarshipEnabled: pkg.scholarshipEnabled ?? false,
                                      scholarshipPct: pkg.scholarshipPct ?? '',
                                      highlights: pkg.highlights || [],
                                      customModuleId: pkg.customModuleId ?? '',
                                      pkgStatus: pkg.pkgStatus || 'draft',
                                      frontendSections: pkg.frontendSections || [],
                                      reportConfig: pkg.reportConfig || {},
                                      category: pkg.category || '',
                                      subcategory: pkg.subcategory || '',
                                      _highlightInput: '',
                                    });
                                    setEditPkgCatMode(false);
                                    setEditPkgSubCatMode(false);
                                    setEditPackageDialog(true);
                                  }}
                                  data-testid={`btn-edit-pkg-${pkg.id}`}
                                >
                                  <Settings className="h-3.5 w-3.5 mr-1" />
                                  Configure
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-[11px] rounded-lg"
                                  style={{ borderColor: `${BRAND.primary}30`, color: BRAND.primary }}
                                  onClick={async () => {
                                    try {
                                      const res = await fetch(`/api/admin/package-domains/${pkg.id}`, { credentials: 'include' });
                                      const domains = res.ok ? await res.json() : [];
                                      setEditingPackageDomains({ packageId: pkg.id, packageName: pkg.productName, domainIds: domains.map((d: any) => d.id) });
                                    } catch { setEditingPackageDomains({ packageId: pkg.id, packageName: pkg.productName, domainIds: [] }); }
                                  }}
                                  data-testid={`btn-domains-pkg-${pkg.id}`}
                                >
                                  <Brain className="h-3.5 w-3.5 mr-1" />
                                  Domains
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className={`h-8 text-[11px] rounded-lg ${pkg.isActive ? 'text-amber-600 border-amber-200 hover:bg-amber-50' : 'text-green-600 border-green-200 hover:bg-green-50'}`}
                                  onClick={async () => {
                                    try {
                                      await fetch(`/api/admin/subscription-packages/${pkg.id}`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        credentials: 'include',
                                        body: JSON.stringify({ isActive: !pkg.isActive })
                                      });
                                      refetchSubscriptionPackages();
                                      refetchSubscriptionStats();
                                    } catch (e) {
                                      toast({ title: 'Error', description: 'Failed to toggle', variant: 'destructive' });
                                    }
                                  }}
                                >
                                  {pkg.isActive ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-[11px] rounded-lg text-red-500 border-red-200 hover:bg-red-50"
                                  onClick={() => setDeleteConfirmId(pkg.id)}
                                  data-testid={`btn-delete-pkg-${pkg.id}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Assessment Domains Section */}
                  <Card className="mb-6">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <Brain className="h-5 w-5" style={{ color: BRAND.primary }} />
                        Assessment Domains ({assessmentDomains.length})
                      </CardTitle>
                      <CardDescription>19 psychometric domains linked to packages. Click a domain to see subdomains.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b bg-gray-50">
                              <th className="text-left p-2.5 font-semibold text-gray-600 w-10">#</th>
                              <th className="text-left p-2.5 font-semibold text-gray-600">Code</th>
                              <th className="text-left p-2.5 font-semibold text-gray-600">Domain</th>
                              <th className="text-right p-2.5 font-semibold text-gray-600">Weight</th>
                              <th className="text-right p-2.5 font-semibold text-gray-600">Subdomains</th>
                              <th className="text-left p-2.5 font-semibold text-gray-600">Practical Outcome</th>
                            </tr>
                          </thead>
                          <tbody>
                            {assessmentDomains.map((d: any) => (
                              <React.Fragment key={d.id}>
                                <tr
                                  className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                                  onClick={async () => {
                                    if (expandedDomainId === d.id) { setExpandedDomainId(null); return; }
                                    setExpandedDomainId(d.id);
                                    if (!domainSubdomains[d.id]) {
                                      const res = await fetch(`/api/admin/assessment-domains/${d.id}/subdomains`, { credentials: 'include' });
                                      if (res.ok) {
                                        const subs = await res.json();
                                        setDomainSubdomains(prev => ({ ...prev, [d.id]: subs }));
                                      }
                                    }
                                  }}
                                >
                                  <td className="p-2.5 text-gray-500">{d.id}</td>
                                  <td className="p-2.5"><span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${BRAND.primary}10`, color: BRAND.primary }}>{d.domainCode}</span></td>
                                  <td className="p-2.5 font-medium text-gray-800">{d.domainName}</td>
                                  <td className="p-2.5 text-right font-semibold" style={{ color: BRAND.primary }}>{d.weightPercent > 0 ? `${d.weightPercent}%` : 'AI'}</td>
                                  <td className="p-2.5 text-right">{d.subdomainCount}</td>
                                  <td className="p-2.5 text-gray-600 max-w-[200px] truncate">{d.practicalOutcome}</td>
                                </tr>
                                {expandedDomainId === d.id && domainSubdomains[d.id] && (
                                  <tr className="bg-gray-50">
                                    <td colSpan={6} className="p-4">
                                      <div className="space-y-2">
                                        <p className="text-xs font-semibold text-gray-600 mb-2">Subdomains of {d.domainName}</p>
                                        {d.toolsMethods && (
                                          <p className="text-[10px] text-gray-500 mb-2"><strong>Tools:</strong> {d.toolsMethods}</p>
                                        )}
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                          {domainSubdomains[d.id].map((s: any) => (
                                            <div key={s.id} className="flex items-center justify-between p-2 rounded-lg border bg-white">
                                              <div>
                                                <span className="font-mono text-[9px] text-gray-400 mr-1">{s.id}</span>
                                                <span className="text-xs text-gray-800">{s.subdomainName}</span>
                                              </div>
                                              {s.weightInDomain > 0 && (
                                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }}>{s.weightInDomain}%</span>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            ))}
                            {assessmentDomains.length === 0 && (
                              <tr><td colSpan={6} className="text-center py-8 text-gray-400 text-sm">No domains found. Run migration to seed data.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Package–Domain Mapping Editor Dialog */}
                  {editingPackageDomains && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 mx-4 max-h-[80vh] overflow-y-auto">
                        <h3 className="text-lg font-semibold mb-1 flex items-center gap-2" style={{ color: BRAND.primary }}>
                          <Brain className="h-5 w-5" />
                          Edit Domains — {editingPackageDomains.packageName}
                        </h3>
                        <p className="text-xs text-gray-500 mb-4">Select which of the 19 domains are included in this package.</p>
                        <div className="space-y-1.5">
                          {assessmentDomains.map((d: any) => {
                            const isIncluded = editingPackageDomains.domainIds.includes(d.id);
                            return (
                              <label key={d.id} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${isIncluded ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                                <input
                                  type="checkbox"
                                  checked={isIncluded}
                                  onChange={() => {
                                    setEditingPackageDomains(prev => prev ? {
                                      ...prev,
                                      domainIds: isIncluded
                                        ? prev.domainIds.filter(id => id !== d.id)
                                        : [...prev.domainIds, d.id].sort((a, b) => a - b)
                                    } : null);
                                  }}
                                  className="rounded"
                                />
                                <div className="flex-1">
                                  <span className="text-xs font-semibold text-gray-800">{d.domainCode} — {d.domainName}</span>
                                  {d.weightPercent > 0 && <span className="text-[10px] text-gray-400 ml-2">({d.weightPercent}%)</span>}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                        <div className="flex justify-between items-center mt-4 pt-3 border-t">
                          <span className="text-xs text-gray-500">{editingPackageDomains.domainIds.length} domains selected</span>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setEditingPackageDomains(null)}>Cancel</Button>
                            <Button size="sm" className="text-white" style={{ backgroundColor: BRAND.primary }}
                              onClick={async () => {
                                try {
                                  const res = await fetch(`/api/admin/package-domains/${editingPackageDomains.packageId}`, {
                                    method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                                    body: JSON.stringify({ domainIds: editingPackageDomains.domainIds }),
                                  });
                                  if (!res.ok) throw new Error();
                                  toast({ title: 'Domains Updated', description: `${editingPackageDomains.domainIds.length} domains mapped to ${editingPackageDomains.packageName}` });
                                  setEditingPackageDomains(null);
                                } catch { toast({ title: 'Error', description: 'Failed to update domains', variant: 'destructive' }); }
                              }}>
                              Save Domains
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Booking & Assignments Section */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                          <Users className="h-5 w-5" style={{ color: BRAND.primary }} />
                          Booking & Assignments
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                            <Input
                              placeholder="Search by name..."
                              value={bookingSearch}
                              onChange={(e) => setBookingSearch(e.target.value)}
                              className="pl-9 h-9 w-48"
                              data-testid="input-booking-search"
                            />
                          </div>
                          <Select value={bookingStatusFilter} onValueChange={setBookingStatusFilter}>
                            <SelectTrigger className="h-9 w-36" data-testid="select-booking-status-filter">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Status</SelectItem>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="suspended">Suspended</SelectItem>
                              <SelectItem value="expired">Expired</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            onClick={() => setShowAssignDialog(true)}
                            style={{ backgroundColor: BRAND.primary }}
                            className="text-white"
                            data-testid="btn-assign-package"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Assign Package
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {adminSubscriptions.length === 0 ? (
                        <div className="text-center py-10 text-gray-500" data-testid="empty-booking-state">
                          <Users className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                          <p className="font-medium">No subscriptions found</p>
                          <p className="text-sm mt-1">Assign a package to a student to get started.</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm" data-testid="table-booking-assignments">
                            <thead>
                              <tr className="border-b text-left text-gray-500">
                                <th className="pb-2 pr-4 font-medium">Child Name</th>
                                <th className="pb-2 pr-4 font-medium">Package</th>
                                <th className="pb-2 pr-4 font-medium">Category</th>
                                <th className="pb-2 pr-4 font-medium">Status</th>
                                <th className="pb-2 pr-4 font-medium">Created</th>
                                <th className="pb-2 pr-4 font-medium">Expiry</th>
                                <th className="pb-2 font-medium">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {adminSubscriptions.map((sub: any) => (
                                <tr key={sub.id} className="border-b last:border-0" data-testid={`row-subscription-${sub.id}`}>
                                  <td className="py-3 pr-4 font-medium text-gray-900">{sub.childName || sub.childId}</td>
                                  <td className="py-3 pr-4">{sub.packageName || sub.packageId}</td>
                                  <td className="py-3 pr-4">
                                    <Badge variant="outline">{sub.category || '—'}</Badge>
                                  </td>
                                  <td className="py-3 pr-4">
                                    <Badge
                                      className="text-white"
                                      style={{
                                        backgroundColor:
                                          sub.status === 'active' ? '#22c55e' :
                                          sub.status === 'suspended' ? '#f59e0b' :
                                          sub.status === 'expired' ? '#ef4444' :
                                          '#9ca3af',
                                      }}
                                      data-testid={`badge-status-${sub.id}`}
                                    >
                                      {sub.status}
                                    </Badge>
                                  </td>
                                  <td className="py-3 pr-4 text-gray-500">
                                    {sub.createdAt ? new Date(sub.createdAt).toLocaleDateString() : '—'}
                                  </td>
                                  <td className="py-3 pr-4 text-gray-500">
                                    {sub.expiresAt ? new Date(sub.expiresAt).toLocaleDateString() : '—'}
                                  </td>
                                  <td className="py-3">
                                    <div className="flex gap-1">
                                      {sub.status === 'active' && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-xs text-yellow-600 border-yellow-300 hover:bg-yellow-50"
                                          data-testid={`btn-suspend-${sub.id}`}
                                          onClick={async () => {
                                            try {
                                              const res = await fetch(`/api/admin/student-subscriptions/${sub.id}`, {
                                                method: 'PATCH',
                                                headers: { 'Content-Type': 'application/json' },
                                                credentials: 'include',
                                                body: JSON.stringify({ status: 'suspended' }),
                                              });
                                              if (!res.ok) throw new Error('Failed to suspend');
                                              toast({ title: 'Suspended', description: 'Subscription suspended successfully.' });
                                              queryClient.invalidateQueries({ queryKey: ['/api/admin/student-subscriptions'] });
                                              queryClient.invalidateQueries({ queryKey: ['/api/admin/subscription-packages/stats'] });
                                            } catch {
                                              toast({ title: 'Error', description: 'Failed to suspend subscription.', variant: 'destructive' });
                                            }
                                          }}
                                        >
                                          <Ban className="h-3 w-3 mr-1" />
                                          Suspend
                                        </Button>
                                      )}
                                      {sub.status === 'suspended' && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-xs text-green-600 border-green-300 hover:bg-green-50"
                                          data-testid={`btn-reactivate-${sub.id}`}
                                          onClick={async () => {
                                            try {
                                              const res = await fetch(`/api/admin/student-subscriptions/${sub.id}`, {
                                                method: 'PATCH',
                                                headers: { 'Content-Type': 'application/json' },
                                                credentials: 'include',
                                                body: JSON.stringify({ status: 'active' }),
                                              });
                                              if (!res.ok) throw new Error('Failed to reactivate');
                                              toast({ title: 'Reactivated', description: 'Subscription reactivated successfully.' });
                                              queryClient.invalidateQueries({ queryKey: ['/api/admin/student-subscriptions'] });
                                              queryClient.invalidateQueries({ queryKey: ['/api/admin/subscription-packages/stats'] });
                                            } catch {
                                              toast({ title: 'Error', description: 'Failed to reactivate subscription.', variant: 'destructive' });
                                            }
                                          }}
                                        >
                                          <RefreshCw className="h-3 w-3 mr-1" />
                                          Reactivate
                                        </Button>
                                      )}
                                      {sub.status !== 'cancelled' && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-xs text-red-600 border-red-300 hover:bg-red-50"
                                          data-testid={`btn-revoke-${sub.id}`}
                                          onClick={async () => {
                                            try {
                                              const res = await fetch(`/api/admin/student-subscriptions/${sub.id}`, {
                                                method: 'PATCH',
                                                headers: { 'Content-Type': 'application/json' },
                                                credentials: 'include',
                                                body: JSON.stringify({ status: 'cancelled' }),
                                              });
                                              if (!res.ok) throw new Error('Failed to revoke');
                                              toast({ title: 'Revoked', description: 'Subscription cancelled successfully.' });
                                              queryClient.invalidateQueries({ queryKey: ['/api/admin/student-subscriptions'] });
                                              queryClient.invalidateQueries({ queryKey: ['/api/admin/subscription-packages/stats'] });
                                            } catch {
                                              toast({ title: 'Error', description: 'Failed to revoke subscription.', variant: 'destructive' });
                                            }
                                          }}
                                        >
                                          <XCircle className="h-3 w-3 mr-1" />
                                          Revoke
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Edit Package Dialog */}
                  <Dialog open={editPackageDialog} onOpenChange={setEditPackageDialog}>
                    <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Settings className="h-5 w-5" style={{ color: BRAND.primary }} />
                          Configure Package
                          {editPackageData?.pkgStatus === 'published' && (
                            <Badge className="bg-emerald-100 text-emerald-700 text-[10px] ml-1">● Published</Badge>
                          )}
                          {editPackageData?.pkgStatus === 'draft' && (
                            <Badge variant="outline" className="text-gray-500 text-[10px] ml-1">✎ Draft</Badge>
                          )}
                        </DialogTitle>
                        <DialogDescription>Module details, pricing, reports, and frontend publishing</DialogDescription>
                      </DialogHeader>
                      {editPackageData && (() => {
                        const publishedModules = (customAssessmentModules || []).filter((m: any) => m.status === 'published');
                        const linkedMod = publishedModules.find((m: any) => String(m.id) === String(editPackageData.customModuleId));
                        const isModuleLinked = !!linkedMod;
                        const offerPrice = (() => {
                          const base = parseFloat(editPackageData.price);
                          const orig = parseFloat(editPackageData.originalPrice);
                          if (!isNaN(base) && base > 0) return base;
                          if (!isNaN(orig) && !isNaN(parseFloat(editPackageData.discountPct))) {
                            return Math.round(orig * (1 - parseFloat(editPackageData.discountPct) / 100));
                          }
                          return null;
                        })();
                        const FRONTEND_SECTIONS = [
                          {
                            key: 'homepage_featured',
                            label: 'Homepage Featured',
                            desc: 'Pinned to the top of the homepage hero carousel and "Best Sellers" strip.',
                            audience: 'First-time visitors, organic traffic, referral clicks',
                            badge: 'Max Visibility',
                            badgeColor: '#8B5CF6',
                          },
                          {
                            key: 'pricing_page',
                            label: 'Pricing Page',
                            desc: 'Listed in the main Packages & Pricing grid — the primary purchase entry point.',
                            audience: 'Intent-driven buyers comparing plans',
                            badge: 'High Conversion',
                            badgeColor: '#10B981',
                          },
                          {
                            key: 'assessment_catalogue',
                            label: 'Assessment Catalogue',
                            desc: 'Discoverable in the full product catalogue with filter / search support.',
                            audience: 'Researchers, students browsing all options',
                            badge: 'Broad Reach',
                            badgeColor: BRAND.accent,
                          },
                          {
                            key: 'school_portal',
                            label: 'School / Institution Portal',
                            desc: 'Shown to school coordinators and campus admins under B2B offerings.',
                            audience: 'School admins, counsellors, institutional buyers',
                            badge: 'B2B',
                            badgeColor: '#344E86',
                          },
                          {
                            key: 'parent_portal',
                            label: 'Parent Portal',
                            desc: 'Surfaced in the parent dashboard under "Recommended for your child".',
                            audience: 'Parents of K-12 students, family decision-makers',
                            badge: 'Family Buyer',
                            badgeColor: '#F59E0B',
                          },
                          {
                            key: 'enterprise_section',
                            label: 'Enterprise / Corporate',
                            desc: 'Featured in the enterprise landing page for bulk & team licensing enquiries.',
                            audience: 'HR teams, L&D leads, corporate procurement',
                            badge: 'Enterprise',
                            badgeColor: '#F97316',
                          },
                          {
                            key: 'campus_placement',
                            label: 'Campus & Placement Cell',
                            desc: 'Promoted to TPOs and placement coordinators for final-year student prep.',
                            audience: 'College placement officers, final-year students',
                            badge: 'Campus',
                            badgeColor: '#06B6D4',
                          },
                          {
                            key: 'mentor_marketplace',
                            label: 'Mentor Marketplace',
                            desc: 'Paired with mentor profiles as a recommended add-on at purchase.',
                            audience: 'Students seeking guided assessment + coaching',
                            badge: 'Add-On Upsell',
                            badgeColor: '#EC4899',
                          },
                        ];
                        const REPORT_OPTIONS = [
                          { key: 'overall_summary', label: 'Overall Summary Report', desc: 'Single aggregate score and narrative' },
                          { key: 'domain_category', label: 'Domain-wise Category Report', desc: 'Separate report card per assessed domain' },
                          { key: 'subdomain_breakdown', label: 'Sub-domain Breakdown', desc: 'Detailed breakdown within each domain' },
                          { key: 'peer_comparison', label: 'Comparative / Peer Benchmarking', desc: 'Compare against cohort benchmarks' },
                          { key: 'mentor_report', label: 'Mentor & Coach Report', desc: 'Coaching-oriented insights for mentors' },
                          { key: 'parent_report', label: 'Parent Summary Report', desc: 'Simplified insights for parents' },
                        ];
                        const toggleSection = (key: string) => {
                          const cur = editPackageData.frontendSections || [];
                          setEditPackageData({ ...editPackageData, frontendSections: cur.includes(key) ? cur.filter((k: string) => k !== key) : [...cur, key] });
                        };
                        const toggleReport = (key: string) => {
                          const cur = editPackageData.reportConfig || {};
                          setEditPackageData({ ...editPackageData, reportConfig: { ...cur, [key]: !cur[key] } });
                        };
                        const savePackage = async (targetStatus: 'draft' | 'published') => {
                          try {
                            if (!editPackageData.productName?.trim() && !isModuleLinked) {
                              toast({ title: 'Validation Error', description: 'Display name is required', variant: 'destructive' });
                              return;
                            }
                            const parsedPrice = editPackageData.price !== '' && editPackageData.price != null ? parseFloat(editPackageData.price) : null;
                            const parsedValidity = editPackageData.validityDays !== '' && editPackageData.validityDays != null ? parseInt(editPackageData.validityDays) : null;
                            const parsedQuestions = isModuleLinked && linkedMod ? (linkedMod.total_questions || null) : (editPackageData.questionCount !== '' ? parseInt(editPackageData.questionCount) : null);
                            if (targetStatus === 'published' && !(editPackageData.frontendSections || []).length) {
                              toast({ title: 'Select Sections', description: 'Choose at least one frontend section before publishing', variant: 'destructive' });
                              return;
                            }
                            const displayName = isModuleLinked ? linkedMod.module_name : editPackageData.productName?.trim();
                            const domains = isModuleLinked ? (linkedMod.domain_selections || []).map((s: any) => s.domain_code).filter(Boolean) : (editPackageData.domainsCovered || []);
                            const updates: any = {
                              productName: displayName,
                              category: editPackageData.category || '',
                              studentSegment: editPackageData.studentSegment || '',
                              reportType: editPackageData.reportType,
                              domainsCovered: domains,
                              isRecommended: editPackageData.isRecommended,
                              isActive: targetStatus === 'published',
                              price: parsedPrice,
                              questionCount: parsedQuestions,
                              validityDays: parsedValidity,
                              originalPrice: editPackageData.originalPrice !== '' ? parseFloat(editPackageData.originalPrice) || null : null,
                              discountPct: editPackageData.discountPct !== '' ? parseFloat(editPackageData.discountPct) || null : null,
                              offerLabel: editPackageData.offerLabel?.trim() || null,
                              couponCode: editPackageData.couponCode?.trim() || null,
                              couponDiscountPct: editPackageData.couponDiscountPct !== '' ? parseFloat(editPackageData.couponDiscountPct) || null : null,
                              trialDays: editPackageData.trialDays !== '' ? parseInt(editPackageData.trialDays) || null : null,
                              highlights: editPackageData.highlights || [],
                              customModuleId: editPackageData.customModuleId || null,
                              pkgStatus: targetStatus,
                              frontendSections: editPackageData.frontendSections || [],
                              reportConfig: editPackageData.reportConfig || {},
                            };
                            const res = await fetch(`/api/admin/subscription-packages/${editPackageData.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              credentials: 'include',
                              body: JSON.stringify(updates),
                            });
                            if (!res.ok) throw new Error('Failed to update package');
                            toast({ title: targetStatus === 'published' ? 'Package Published' : 'Saved as Draft', description: targetStatus === 'published' ? `${displayName} is now live on the frontend.` : `${displayName} saved as draft.` });
                            refetchSubscriptionPackages();
                            refetchSubscriptionStats();
                            setEditPackageDialog(false);
                          } catch (e: any) {
                            toast({ title: 'Error', description: e.message || 'Failed to save package', variant: 'destructive' });
                          }
                        };
                        return (
                        <div className="space-y-5">

                          {/* ── Linked Assessment Module ────────────────────────── */}
                          <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                            <div className="flex items-center gap-2 border-b border-gray-100 pb-2.5 mb-1">
                              <div className="w-0.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: BRAND.primary }} />
                              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">Linked Assessment Module</p>
                            </div>
                            <div>
                              <Label className="text-xs text-gray-600 mb-1 block">Select Module</Label>
                              <Select
                                value={editPackageData.customModuleId || '__none__'}
                                onValueChange={(val) => {
                                  if (val === '__none__') { setEditPackageData({ ...editPackageData, customModuleId: '', productName: '' }); return; }
                                  setEditPackageData({ ...editPackageData, customModuleId: val });
                                }}
                              >
                                <SelectTrigger data-testid="select-edit-module">
                                  <SelectValue placeholder="Select a published module…" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">— Standalone package (no module) —</SelectItem>
                                  {publishedModules.map((m: any) => (
                                    <SelectItem key={m.id} value={String(m.id)}>
                                      <span className="font-medium">{m.module_name}</span>
                                      <span className="text-gray-400 ml-2 text-[11px]">{m.total_questions}Q · {(m.domain_selections||[]).length} domains</span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {publishedModules.length === 0 && <p className="text-[11px] text-amber-600 mt-1">No published modules — publish one in Module Management first.</p>}
                            </div>
                            {isModuleLinked && (
                              <div className="bg-white border border-blue-200 rounded-lg p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-blue-700">Module Details (read-only)</span>
                                  <Badge className="bg-blue-100 text-blue-700 text-[10px]">● Published</Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                                  <div><span className="text-gray-500">Name:</span> <span className="font-medium text-gray-800">{linkedMod.module_name}</span></div>
                                  <div><span className="text-gray-500">Questions:</span> <span className="font-medium text-gray-800">{linkedMod.total_questions}</span></div>
                                  <div className="col-span-2 flex flex-wrap gap-1 mt-0.5">
                                    {(linkedMod.domain_selections || []).map((s: any, i: number) => (
                                      <span key={i} className="px-1.5 py-0.5 bg-blue-50 border border-blue-200 rounded text-[10px] text-blue-700">{s.domain_code}</span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                            {!isModuleLinked && (
                              <div>
                                <Label className="text-xs text-gray-600 mb-1 block">Package Display Name</Label>
                                <Input value={editPackageData.productName || ''} onChange={(e) => setEditPackageData({ ...editPackageData, productName: e.target.value })} placeholder="e.g. Exam Readiness Bundle" data-testid="input-edit-product-name" />
                              </div>
                            )}
                          </div>

                          {/* ── Package Settings ────────────────────────────────── */}
                          <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                            <div className="flex items-center gap-2 border-b border-gray-100 pb-2.5 mb-1">
                              <div className="w-0.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: BRAND.primary }} />
                              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">Package Settings</p>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <Label className="text-xs text-gray-600 mb-1 block">Category</Label>
                                <Select
                                  value={editPkgCatMode ? '__new__' : (editPackageData.category || '')}
                                  onValueChange={(val) => {
                                    if (val === '__new__') { setEditPkgCatMode(true); setEditPackageData({ ...editPackageData, category: '' }); }
                                    else { setEditPkgCatMode(false); setEditPackageData({ ...editPackageData, category: val }); }
                                  }}
                                >
                                  <SelectTrigger className="text-sm" data-testid="input-edit-category"><SelectValue placeholder="Select a category…" /></SelectTrigger>
                                  <SelectContent>
                                    {Array.from(new Set([...PKG_CATEGORIES_DEFAULT, ...subscriptionPackages.map((p: any) => p.category).filter(Boolean)])).sort().map((c: string) => (
                                      <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                    <SelectSeparator />
                                    <SelectItem value="__new__" className="text-blue-600 font-medium">➕ Add new category</SelectItem>
                                  </SelectContent>
                                </Select>
                                {editPkgCatMode && (
                                  <Input
                                    autoFocus
                                    value={editPackageData.category}
                                    onChange={(e) => setEditPackageData({ ...editPackageData, category: e.target.value })}
                                    placeholder="Enter new category name…"
                                    className="text-sm mt-2"
                                  />
                                )}
                              </div>
                              <div>
                                <Label className="text-xs text-gray-600 mb-1 block">Subcategory</Label>
                                <Select
                                  value={editPkgSubCatMode ? '__new__' : (editPackageData.subcategory || '')}
                                  onValueChange={(val) => {
                                    if (val === '__new__') { setEditPkgSubCatMode(true); setEditPackageData({ ...editPackageData, subcategory: '' }); }
                                    else { setEditPkgSubCatMode(false); setEditPackageData({ ...editPackageData, subcategory: val }); }
                                  }}
                                >
                                  <SelectTrigger className="text-sm" data-testid="input-edit-subcategory"><SelectValue placeholder="Select a subcategory…" /></SelectTrigger>
                                  <SelectContent>
                                    {Array.from(new Set([...PKG_SUBCATEGORIES_DEFAULT, ...subscriptionPackages.map((p: any) => p.subcategory).filter(Boolean)])).sort().map((c: string) => (
                                      <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                    <SelectSeparator />
                                    <SelectItem value="__new__" className="text-blue-600 font-medium">➕ Add new subcategory</SelectItem>
                                  </SelectContent>
                                </Select>
                                {editPkgSubCatMode && (
                                  <Input
                                    autoFocus
                                    value={editPackageData.subcategory}
                                    onChange={(e) => setEditPackageData({ ...editPackageData, subcategory: e.target.value })}
                                    placeholder="Enter new subcategory name…"
                                    className="text-sm mt-2"
                                  />
                                )}
                              </div>
                              <div>
                                <Label className="text-xs text-gray-600 mb-1 block">Student Segment</Label>
                                <Input value={editPackageData.studentSegment || ''} onChange={(e) => setEditPackageData({ ...editPackageData, studentSegment: e.target.value })} placeholder="e.g. Classes 6–12, JEE Aspirants" data-testid="input-edit-segment" />
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              {!isModuleLinked && (
                                <div>
                                  <Label className="text-xs text-gray-600 mb-1 block">Questions</Label>
                                  <Input type="number" value={editPackageData.questionCount} onChange={(e) => setEditPackageData({ ...editPackageData, questionCount: e.target.value })} placeholder="50" data-testid="input-edit-questions" />
                                </div>
                              )}
                              <div>
                                <Label className="text-xs text-gray-600 mb-1 block">Validity (days)</Label>
                                <Input type="number" value={editPackageData.validityDays} onChange={(e) => setEditPackageData({ ...editPackageData, validityDays: e.target.value })} placeholder="365" data-testid="input-edit-validity" />
                              </div>
                              <div>
                                <Label className="text-xs text-gray-600 mb-1 block">Report Depth</Label>
                                <Select value={editPackageData.reportType || 'Basic'} onValueChange={(val) => setEditPackageData({ ...editPackageData, reportType: val })}>
                                  <SelectTrigger data-testid="select-edit-report-type"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Basic">Basic</SelectItem>
                                    <SelectItem value="Standard">Standard</SelectItem>
                                    <SelectItem value="Detailed">Detailed</SelectItem>
                                    <SelectItem value="Comprehensive">Comprehensive</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            {!isModuleLinked && (
                              <div>
                                <Label className="text-xs text-gray-600 mb-1 block">Domains Covered</Label>
                                <div className="flex flex-wrap gap-1 mb-2 min-h-[32px] p-2 border rounded-md bg-gray-50">
                                  {(editPackageData.domainsCovered || []).map((d: string, i: number) => (
                                    <Badge key={i} variant="outline" className="gap-1 text-xs">
                                      {d.length > 28 ? d.slice(0, 28) + '…' : d}
                                      <button onClick={() => setEditPackageData({ ...editPackageData, domainsCovered: (editPackageData.domainsCovered||[]).filter((_: any, idx: number) => idx !== i) })} className="text-red-400 hover:text-red-600 ml-1"><X className="h-3 w-3" /></button>
                                    </Badge>
                                  ))}
                                  {(!(editPackageData.domainsCovered) || editPackageData.domainsCovered.length === 0) && <span className="text-xs text-gray-400">No domains added</span>}
                                </div>
                                <Select onValueChange={(val) => { if (val && !(editPackageData.domainsCovered||[]).includes(val)) setEditPackageData({ ...editPackageData, domainsCovered: [...(editPackageData.domainsCovered||[]), val] }); }}>
                                  <SelectTrigger className="flex-1" data-testid="select-edit-add-domain"><SelectValue placeholder="Add domain…" /></SelectTrigger>
                                  <SelectContent>
                                    {(() => {
                                      const DOMAIN_GROUPS = [
                                        { label: 'LBI — Academic & Student Intelligence', items: [
                                          'Academic & Cognitive Efficiency','Thinking Quality Profiling','Emotional Self-Expression & Regulation','Communicating, Socializing & Conflict Coping','Academic & Cognitive Challenges','Social & Emotional Intelligence','Discipline, Habits & Commitment','Communication Effectiveness','Motivation, Values & Resilience','Lifestyle, Pressures & Environment','Optimism, Courage & Resilience','Adaptability & Integrity Management','Mindset & Self-Regulation','Academic Self-Concept & Identity','Competitive Exam Readiness','Examination Stress & Coping','Learning Efficiency & Memory','Root Cause Intelligence','Metacognition & Learning Strategy','Teacher–Student Dynamic',
                                        ]},
                                        { label: 'Employability Index', items: [
                                          'Communication & Presentation Skills','Critical Thinking & Problem Solving','Teamwork & Collaboration','Adaptability & Change Management','Leadership Potential','Work Ethics & Professionalism','Emotional Intelligence at Work','Digital Literacy & Tech Readiness','Time Management & Productivity','Customer Orientation & Service Mindset','Entrepreneurial Mindset','Interview Readiness Index','Campus-to-Corporate Transition','Workplace Stress Management','Goal Setting & Achievement Drive','Conflict Resolution Skills','Overall Employability Score',
                                        ]},
                                        { label: 'Enterprise Model', items: [
                                          'Leadership Effectiveness Index','Strategic Thinking Capacity','Team Dynamics & Culture Fit','Organizational Commitment','High-Performance Mindset','Executive Presence & Influence','Change Management Capability','Innovation & Creative Thinking','Cross-Functional Collaboration','Stakeholder Management Skills','Risk Tolerance & Decision Making','Workforce Resilience Index','Managerial Self-Awareness','Talent Potential Mapping','Culture Alignment Score','Employee Well-being Index',
                                        ]},
                                      ];
                                      return DOMAIN_GROUPS.flatMap((g, gi) => [
                                        <SelectItem key={`__hdr_${gi}`} value={`__hdr_${gi}`} disabled className="text-[10px] font-bold uppercase tracking-wider text-gray-400 py-1.5 cursor-default bg-gray-50">{g.label}</SelectItem>,
                                        ...g.items.filter(d => !(editPackageData.domainsCovered||[]).includes(d)).map(d => (
                                          <SelectItem key={d} value={d} className="pl-4">{d}</SelectItem>
                                        )),
                                      ]);
                                    })()}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                            <div className="flex items-center gap-2 pt-1">
                              <Switch checked={editPackageData.isRecommended} onCheckedChange={(c) => setEditPackageData({ ...editPackageData, isRecommended: c })} data-testid="switch-edit-recommended" />
                              <Label className="text-xs text-gray-600">Mark as Recommended</Label>
                            </div>
                          </div>

                          {/* ── Category Reports ────────────────────────────────── */}
                          <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                            <div className="border-b border-gray-100 pb-2.5">
                              <div className="flex items-center gap-2 mb-0.5">
                                <div className="w-0.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: BRAND.primary }} />
                                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">Category Reports</p>
                              </div>
                              <p className="text-[11px] text-gray-400 ml-3.5">Select which report types are generated when a respondent completes this package</p>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                              {REPORT_OPTIONS.map((opt) => (
                                <label key={opt.key} className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${(editPackageData.reportConfig||{})[opt.key] ? 'border-[#344E86]/30 bg-[#344E86]/5' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                                  <input type="checkbox" className="mt-0.5 accent-[#344E86]" checked={!!(editPackageData.reportConfig||{})[opt.key]} onChange={() => toggleReport(opt.key)} />
                                  <div>
                                    <p className="text-xs font-medium text-gray-800">{opt.label}</p>
                                    <p className="text-[11px] text-gray-500">{opt.desc}</p>
                                  </div>
                                </label>
                              ))}
                            </div>
                          </div>

                          {/* ── Pricing ─────────────────────────────────────────── */}
                          <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                            <div className="flex items-center gap-2 border-b border-gray-100 pb-2.5 mb-1">
                              <div className="w-0.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: BRAND.primary }} />
                              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">Pricing</p>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <Label className="text-xs text-gray-600 mb-1 block">Selling Price (₹)</Label>
                                <Input
                                  type="number"
                                  value={editPackageData.price}
                                  onChange={(e) => setEditPackageData({ ...editPackageData, price: e.target.value })}
                                  placeholder="299"
                                  data-testid="input-edit-price"
                                />
                              </div>
                              <div>
                                <Label className="text-xs text-gray-600 mb-1 block">Original / MRP (₹)</Label>
                                <Input
                                  type="number"
                                  value={editPackageData.originalPrice}
                                  onChange={(e) => {
                                    const orig = parseFloat(e.target.value);
                                    const sell = parseFloat(editPackageData.price);
                                    const auto = (!isNaN(orig) && !isNaN(sell) && orig > 0)
                                      ? Math.round(((orig - sell) / orig) * 100) : '';
                                    setEditPackageData({ ...editPackageData, originalPrice: e.target.value, discountPct: auto !== '' ? String(auto) : editPackageData.discountPct });
                                  }}
                                  placeholder="499"
                                  data-testid="input-edit-original-price"
                                />
                              </div>
                              <div>
                                <Label className="text-xs text-gray-600 mb-1 block">Discount %</Label>
                                <Input
                                  type="number"
                                  value={editPackageData.discountPct}
                                  onChange={(e) => setEditPackageData({ ...editPackageData, discountPct: e.target.value })}
                                  placeholder="40"
                                  data-testid="input-edit-discount-pct"
                                />
                              </div>
                            </div>
                            {offerPrice !== null && editPackageData.originalPrice && (
                              <div className="flex items-center gap-2 text-xs bg-white border border-amber-200 rounded-lg px-3 py-2">
                                <span className="text-gray-400 line-through">₹{parseFloat(editPackageData.originalPrice).toLocaleString()}</span>
                                <span className="font-bold text-emerald-600 text-sm">₹{offerPrice.toLocaleString()}</span>
                                {editPackageData.discountPct && <Badge className="bg-red-500 text-white text-[10px] px-1.5">{editPackageData.discountPct}% OFF</Badge>}
                              </div>
                            )}
                            <div>
                              <Label className="text-xs text-gray-600 mb-1 block">Offer Label</Label>
                              <Input
                                value={editPackageData.offerLabel || ''}
                                onChange={(e) => setEditPackageData({ ...editPackageData, offerLabel: e.target.value })}
                                placeholder="e.g. Launch Offer, Back to School, Season Special"
                                data-testid="input-edit-offer-label"
                              />
                            </div>
                          </div>

                          {/* ── Coupons & Promotions ──────────────────────────────── */}
                          <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                            <div className="flex items-center gap-2 border-b border-gray-100 pb-2.5 mb-1">
                              <div className="w-0.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: BRAND.primary }} />
                              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">Coupons & Promotions</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs text-gray-600 mb-1 block">Coupon Code</Label>
                                <Input
                                  value={editPackageData.couponCode || ''}
                                  onChange={(e) => setEditPackageData({ ...editPackageData, couponCode: e.target.value.toUpperCase() })}
                                  placeholder="SAVE20"
                                  data-testid="input-edit-coupon-code"
                                  className="font-mono tracking-wider"
                                />
                              </div>
                              <div>
                                <Label className="text-xs text-gray-600 mb-1 block">Coupon Discount %</Label>
                                <Input
                                  type="number"
                                  value={editPackageData.couponDiscountPct || ''}
                                  onChange={(e) => setEditPackageData({ ...editPackageData, couponDiscountPct: e.target.value })}
                                  placeholder="20"
                                  data-testid="input-edit-coupon-pct"
                                />
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs text-gray-600 mb-1 block">Free Trial (days)</Label>
                              <Input
                                type="number"
                                value={editPackageData.trialDays || ''}
                                onChange={(e) => setEditPackageData({ ...editPackageData, trialDays: e.target.value })}
                                placeholder="7"
                                data-testid="input-edit-trial-days"
                                className="max-w-[120px]"
                              />
                            </div>
                          </div>

                          {/* ── Scholarships ──────────────────────────────────────── */}
                          <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                            <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                              <div className="flex items-center gap-2">
                                <div className="w-0.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: BRAND.primary }} />
                                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">Scholarship / Need-Based Access</p>
                              </div>
                              <Switch checked={!!editPackageData.scholarshipEnabled} onCheckedChange={(v) => setEditPackageData({ ...editPackageData, scholarshipEnabled: v })} />
                            </div>
                            {editPackageData.scholarshipEnabled && (
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-xs text-gray-600 mb-1 block">Scholarship Discount %</Label>
                                  <Input type="number" value={editPackageData.scholarshipPct || ''} onChange={(e) => setEditPackageData({ ...editPackageData, scholarshipPct: e.target.value })} placeholder="100" className="text-sm" />
                                  <p className="text-[10px] text-gray-400 mt-1">100% = fully free for eligible students</p>
                                </div>
                                <div className="flex flex-col justify-center text-xs text-gray-500 pl-2 border-l border-green-100">
                                  <p className="font-medium text-green-700">How it works</p>
                                  <p className="mt-1">Eligible students receive a scholarship code granting this discount at checkout. Codes are managed under the Scholarships section.</p>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* ── Feature Highlights ────────────────────────────────── */}
                          <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                            <div className="flex items-center gap-2 border-b border-gray-100 pb-2.5 mb-1">
                              <div className="w-0.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: BRAND.primary }} />
                              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">Feature Highlights</p>
                            </div>
                            <div className="flex flex-wrap gap-1.5 min-h-[36px]">
                              {(editPackageData.highlights || []).map((h: string, i: number) => (
                                <span key={i} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700">
                                  {h}
                                  <button onClick={() => setEditPackageData({ ...editPackageData, highlights: editPackageData.highlights.filter((_: any, idx: number) => idx !== i) })} className="text-blue-400 hover:text-red-500 ml-0.5">
                                    <X className="h-3 w-3" />
                                  </button>
                                </span>
                              ))}
                              {(!editPackageData.highlights || editPackageData.highlights.length === 0) && (
                                <span className="text-xs text-gray-400">No highlights added yet</span>
                              )}
                            </div>
                            {/* Quick-select from preset list */}
                            <Select onValueChange={(val) => {
                              if (val && !(editPackageData.highlights || []).includes(val)) {
                                setEditPackageData({ ...editPackageData, highlights: [...(editPackageData.highlights || []), val] });
                              }
                            }}>
                              <SelectTrigger className="text-sm"><SelectValue placeholder="Quick-add from preset list…" /></SelectTrigger>
                              <SelectContent>
                                {(() => {
                                  const HIGHLIGHT_GROUPS = [
                                    { label: 'Assessment Format', items: [
                                      '15-minute quick assessment','30-minute standard assessment','45-minute extended assessment','60-minute deep assessment','Adaptive questioning format','Proctored online assessment','Multi-language assessment support',
                                    ]},
                                    { label: 'Intelligence Coverage', items: [
                                      '1 domain behavioral profile','3 domains behavioral profile','5 domains behavioral profile','8 domains behavioral profile','12 domains behavioral profile','19 domains full intelligence map','Cross-domain pattern analysis',
                                    ]},
                                    { label: 'Reporting', items: [
                                      'Basic behavioral insights report','Domain score breakdown','Subdomain-level analysis','Overall readiness score','Percentile benchmarking','Personalized action plan','Parent-facing report','HR / Manager-facing report','PDF + interactive report','Institution-level analytics dashboard','API report access',
                                    ]},
                                    { label: 'LBI — Academic Outcomes', items: [
                                      'Academic performance prediction','Learning style profiling','Competitive exam readiness score','Root cause of learning gaps','Metacognition & strategy insights','Examination stress indicators',
                                    ]},
                                    { label: 'Employability Outcomes', items: [
                                      'Employability readiness score','Career pathway recommendations','Competency gap mapping','Campus-to-corporate transition plan','Interview readiness index','Soft skills benchmarking',
                                    ]},
                                    { label: 'Enterprise Outcomes', items: [
                                      'Leadership potential score','Team fit compatibility report','Culture alignment assessment','Talent potential mapping','Workforce resilience index','Manager self-awareness profile',
                                    ]},
                                    { label: 'Wellness & Support', items: [
                                      'Mental health risk indicators','Emotional well-being assessment','Stress & burnout indicators','Resilience & coping analysis',
                                    ]},
                                    { label: 'Add-ons & Benefits', items: [
                                      '1 mentor session bundled','2 mentor sessions bundled','3 mentor sessions bundled','Retest after 90 days','Unlimited retests','Progress tracking over 12 months','Dedicated counsellor access','Priority support',
                                    ]},
                                    { label: 'Trust & Compliance', items: [
                                      'Certified behavioral assessment','Scientifically validated instrument','DPDP & FERPA compliant','93% predictive accuracy','Expert-reviewed insights','ISO-aligned data security',
                                    ]},
                                  ];
                                  return HIGHLIGHT_GROUPS.flatMap((g, gi) => [
                                    <SelectItem key={`__hhdr_${gi}`} value={`__hhdr_${gi}`} disabled className="text-[10px] font-bold uppercase tracking-wider text-gray-400 py-1.5 cursor-default bg-gray-50">{g.label}</SelectItem>,
                                    ...g.items.filter(h => !(editPackageData.highlights || []).includes(h)).map(h => (
                                      <SelectItem key={h} value={h} className="pl-4">{h}</SelectItem>
                                    )),
                                  ]);
                                })()}
                              </SelectContent>
                            </Select>
                            {/* Custom free-text input */}
                            <div className="flex gap-2">
                              <Input
                                value={editPackageData._highlightInput || ''}
                                onChange={(e) => setEditPackageData({ ...editPackageData, _highlightInput: e.target.value })}
                                placeholder="Or type a custom highlight…"
                                className="flex-1 text-sm"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const val = (editPackageData._highlightInput || '').trim();
                                    if (val && !(editPackageData.highlights || []).includes(val)) {
                                      setEditPackageData({ ...editPackageData, highlights: [...(editPackageData.highlights || []), val], _highlightInput: '' });
                                    }
                                  }
                                }}
                                data-testid="input-edit-highlight"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const val = (editPackageData._highlightInput || '').trim();
                                  if (val && !(editPackageData.highlights || []).includes(val)) {
                                    setEditPackageData({ ...editPackageData, highlights: [...(editPackageData.highlights || []), val], _highlightInput: '' });
                                  }
                                }}
                              >
                                Add
                              </Button>
                            </div>
                          </div>

                          {/* ── Distribution Channels ────────────────────────── */}
                          <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                            <div className="flex items-start gap-2.5 border-b border-gray-100 pb-3">
                              <div className="w-0.5 h-4 mt-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: BRAND.primary }} />
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">Distribution Channels</p>
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.primary}15`, color: BRAND.primary }}>
                                    {(editPackageData.frontendSections||[]).length} / {FRONTEND_SECTIONS.length} active
                                  </span>
                                </div>
                                <p className="text-[11px] text-gray-400 mt-0.5">Enable each channel where this package should be discoverable and purchasable</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {FRONTEND_SECTIONS.map((sec) => {
                                const active = (editPackageData.frontendSections || []).includes(sec.key);
                                return (
                                  <button key={sec.key} type="button" onClick={() => toggleSection(sec.key)}
                                    className={`flex flex-col gap-2 p-3 rounded-lg border text-left transition-all ${active ? 'border-[#344E86]/40 bg-[#344E86]/[0.04]' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/70'}`}
                                  >
                                    {/* Top row: badge + checkbox */}
                                    <div className="flex items-center justify-between w-full">
                                      <span className="text-[9px] font-bold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${sec.badgeColor}18`, color: sec.badgeColor }}>
                                        {sec.badge}
                                      </span>
                                      <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-all ${active ? 'border-[#344E86]' : 'border-gray-300 bg-white'}`} style={active ? { backgroundColor: BRAND.primary, borderColor: BRAND.primary } : {}}>
                                        {active && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                      </span>
                                    </div>
                                    {/* Channel name */}
                                    <p className={`text-xs font-semibold leading-snug ${active ? 'text-[#344E86]' : 'text-gray-700'}`}>{sec.label}</p>
                                    {/* Description */}
                                    <p className="text-[10px] text-gray-400 leading-relaxed">{sec.desc}</p>
                                    {/* Audience */}
                                    <div className="flex items-start gap-1 mt-0.5">
                                      <span className="text-[9px] font-bold uppercase tracking-wide text-gray-300 mt-px shrink-0">FOR</span>
                                      <span className="text-[10px] text-gray-500 leading-tight">{sec.audience}</span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                            {/* Summary footer */}
                            <div className="pt-2 border-t border-gray-100">
                              {(editPackageData.frontendSections || []).length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {(editPackageData.frontendSections||[]).map((k: string) => {
                                    const s = FRONTEND_SECTIONS.find(x => x.key === k);
                                    return s ? (
                                      <span key={k} className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border" style={{ borderColor: `${s.badgeColor}40`, color: s.badgeColor, backgroundColor: `${s.badgeColor}0D` }}>
                                        {s.label}
                                      </span>
                                    ) : null;
                                  })}
                                </div>
                              ) : (
                                <p className="text-[10px] text-gray-400 italic">No channels selected — this package will not be visible to buyers.</p>
                              )}
                            </div>
                          </div>

                        </div>
                        );
                      })()}
                      <DialogFooter className="flex-col sm:flex-row gap-2 mt-2">
                        <Button variant="outline" onClick={() => setEditPackageDialog(false)} data-testid="btn-cancel-edit-pkg" className="sm:mr-auto">Cancel</Button>
                        <Button variant="outline" className="border-gray-300 text-gray-700" data-testid="btn-save-draft-pkg"
                          onClick={async () => {
                            try {
                              const lm = (customAssessmentModules||[]).filter((m:any)=>m.status==='published').find((m:any)=>String(m.id)===String(editPackageData.customModuleId));
                              const dn = lm ? lm.module_name : editPackageData.productName?.trim();
                              if (!dn) { toast({ title: 'Validation Error', description: 'Link a module or enter a display name', variant: 'destructive' }); return; }
                              const updates: any = { productName: dn, category: editPackageData.category||'', subcategory: editPackageData.subcategory||'', studentSegment: editPackageData.studentSegment||'', reportType: editPackageData.reportType, domainsCovered: lm?(lm.domain_selections||[]).map((s:any)=>s.domain_code).filter(Boolean):(editPackageData.domainsCovered||[]), isRecommended: editPackageData.isRecommended, isActive: false, price: editPackageData.price!==''?parseFloat(editPackageData.price)||null:null, questionCount: lm?(lm.total_questions||null):(editPackageData.questionCount!==''?parseInt(editPackageData.questionCount)||null:null), validityDays: editPackageData.validityDays!==''?parseInt(editPackageData.validityDays)||null:null, originalPrice: editPackageData.originalPrice!==''?parseFloat(editPackageData.originalPrice)||null:null, discountPct: editPackageData.discountPct!==''?parseFloat(editPackageData.discountPct)||null:null, offerLabel: editPackageData.offerLabel?.trim()||null, couponCode: editPackageData.couponCode?.trim()||null, couponDiscountPct: editPackageData.couponDiscountPct!==''?parseFloat(editPackageData.couponDiscountPct)||null:null, trialDays: editPackageData.trialDays!==''?parseInt(editPackageData.trialDays)||null:null, scholarshipEnabled: editPackageData.scholarshipEnabled||false, scholarshipPct: editPackageData.scholarshipPct!==''?parseFloat(editPackageData.scholarshipPct)||null:null, highlights: editPackageData.highlights||[], customModuleId: editPackageData.customModuleId||null, pkgStatus: 'draft', frontendSections: editPackageData.frontendSections||[], reportConfig: editPackageData.reportConfig||{} };
                              const res = await fetch(`/api/admin/subscription-packages/${editPackageData.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(updates) });
                              if (!res.ok) throw new Error('Failed to save');
                              toast({ title: 'Saved as Draft', description: `${dn} saved as draft.` });
                              refetchSubscriptionPackages(); refetchSubscriptionStats(); setEditPackageDialog(false);
                            } catch (e: any) { toast({ title: 'Error', description: e.message||'Failed to save', variant: 'destructive' }); }
                          }}
                        >
                          <Save className="h-4 w-4 mr-1" />Save as Draft
                        </Button>
                        <Button style={{ backgroundColor: BRAND.primary }} className="text-white" data-testid="btn-publish-pkg"
                          onClick={async () => {
                            try {
                              const lm = (customAssessmentModules||[]).filter((m:any)=>m.status==='published').find((m:any)=>String(m.id)===String(editPackageData.customModuleId));
                              const dn = lm ? lm.module_name : editPackageData.productName?.trim();
                              if (!dn) { toast({ title: 'Validation Error', description: 'Link a module or enter a display name', variant: 'destructive' }); return; }
                              const sections = (editPackageData.frontendSections||[]).length ? editPackageData.frontendSections : ['pricing_page'];
                              const updates: any = { productName: dn, category: editPackageData.category||'', subcategory: editPackageData.subcategory||'', studentSegment: editPackageData.studentSegment||'', reportType: editPackageData.reportType, domainsCovered: lm?(lm.domain_selections||[]).map((s:any)=>s.domain_code).filter(Boolean):(editPackageData.domainsCovered||[]), isRecommended: editPackageData.isRecommended, isActive: true, price: editPackageData.price!==''?parseFloat(editPackageData.price)||null:null, questionCount: lm?(lm.total_questions||null):(editPackageData.questionCount!==''?parseInt(editPackageData.questionCount)||null:null), validityDays: editPackageData.validityDays!==''?parseInt(editPackageData.validityDays)||null:null, originalPrice: editPackageData.originalPrice!==''?parseFloat(editPackageData.originalPrice)||null:null, discountPct: editPackageData.discountPct!==''?parseFloat(editPackageData.discountPct)||null:null, offerLabel: editPackageData.offerLabel?.trim()||null, couponCode: editPackageData.couponCode?.trim()||null, couponDiscountPct: editPackageData.couponDiscountPct!==''?parseFloat(editPackageData.couponDiscountPct)||null:null, trialDays: editPackageData.trialDays!==''?parseInt(editPackageData.trialDays)||null:null, scholarshipEnabled: editPackageData.scholarshipEnabled||false, scholarshipPct: editPackageData.scholarshipPct!==''?parseFloat(editPackageData.scholarshipPct)||null:null, highlights: editPackageData.highlights||[], customModuleId: editPackageData.customModuleId||null, pkgStatus: 'published', frontendSections: sections, reportConfig: editPackageData.reportConfig||{} };
                              const res = await fetch(`/api/admin/subscription-packages/${editPackageData.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(updates) });
                              if (!res.ok) throw new Error('Failed to publish');
                              toast({ title: 'Package Published', description: `${dn} is now live on the Pricing & Packages page.` });
                              refetchSubscriptionPackages(); refetchSubscriptionStats(); setEditPackageDialog(false);
                            } catch (e: any) { toast({ title: 'Error', description: e.message||'Failed to publish', variant: 'destructive' }); }
                          }}
                        >
                          Publish to Pricing & Packages →
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* ── Package Builder Wizard ─────────────────────────────────── */}
                  <Dialog open={createPackageDialog} onOpenChange={(open) => { if (!open) { setCreatePackageDialog(false); setPkgWizardStep(0); setNewPackageData({ ...EMPTY_PKG }); setNewPkgCatMode(false); } }}>
                    <DialogContent className="max-w-2xl max-h-[92vh] overflow-hidden flex flex-col p-0">
                      {/* Header + Step indicator */}
                      <div className="px-6 pt-5 pb-4 border-b">
                        <DialogTitle className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: BRAND.primary + '15' }}>
                            <Plus className="h-4 w-4" style={{ color: BRAND.primary }} />
                          </div>
                          <span className="text-base font-semibold">Build New Assessment Package</span>
                        </DialogTitle>
                        <div className="flex items-center gap-1">
                          {['Identity', 'Targeting', 'Assessment', 'Mentor', 'Pricing'].map((label, i) => (
                            <div key={i} className="flex items-center gap-1 flex-1">
                              <div className="flex flex-col items-center flex-1">
                                <div
                                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${i < pkgWizardStep ? 'text-white' : i === pkgWizardStep ? 'text-white' : 'text-gray-400 bg-gray-100'}`}
                                  style={i <= pkgWizardStep ? { backgroundColor: BRAND.primary } : {}}
                                  onClick={() => i < pkgWizardStep && setPkgWizardStep(i)}
                                >{i < pkgWizardStep ? '✓' : i + 1}</div>
                                <span className={`text-[10px] mt-0.5 font-medium ${i === pkgWizardStep ? 'text-[#344E86]' : 'text-gray-400'}`}>{label}</span>
                              </div>
                              {i < 4 && <div className={`h-0.5 flex-1 mb-4 rounded ${i < pkgWizardStep ? 'bg-[#344E86]' : 'bg-gray-200'}`} />}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Step Content */}
                      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                        {/* ── STEP 0: Identity ─── */}
                        {pkgWizardStep === 0 && (
                          <div className="space-y-4">
                            <div>
                              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">Pick Module *</Label>
                              <Select
                                value={newPackageData.productName || ''}
                                onValueChange={(val) => {
                                  const mod = customAssessmentModules.find((m: any) => m.module_name === val);
                                  if (mod) {
                                    const s = mod.settings && typeof mod.settings === 'object' ? mod.settings : {};
                                    const ds: any[] = Array.isArray(mod.domain_selections) ? mod.domain_selections : [];
                                    const domainConfig = ds.map((d: any) => ({
                                      domainCode: d.domain_code,
                                      domainName: d.domain_name,
                                      subdomains: (d.subdomains || []).map((sd: any) => ({
                                        code: sd.subdomain_code,
                                        name: sd.subdomain_name,
                                        count: sd.question_count || 0,
                                      })),
                                    }));
                                    setNewPackageData(prev => ({
                                      ...prev,
                                      productName: val,
                                      description: mod.description || prev.description,
                                      category: mod.category || prev.category,
                                      subcategory: mod.subcategory || prev.subcategory,
                                      maxAttempts: s.max_attempts || prev.maxAttempts,
                                      ageBandCodes: Array.isArray(s.age_bands) && s.age_bands.length === 0 ? ['A','B','C','D','E','E1'] : Array.isArray(s.age_bands) && s.age_bands.length > 0 ? s.age_bands.map((b: string) => b === 'F' ? 'E1' : b) : ['A','B','C','D','E','E1'],
                                      domainConfig: domainConfig.length > 0 ? domainConfig : prev.domainConfig,
                                      domainsCovered: domainConfig.length > 0 ? domainConfig.map((d: any) => d.domainName) : prev.domainsCovered,
                                    }));
                                    if (mod.category) setNewPkgCatMode(false);
                                    if (mod.subcategory) setNewPkgSubCatMode(false);
                                  } else {
                                    setNewPackageData(prev => ({ ...prev, productName: val }));
                                  }
                                }}
                              >
                                <SelectTrigger className="text-sm"><SelectValue placeholder="Select a module…" /></SelectTrigger>
                                <SelectContent>
                                  {customAssessmentModules.length === 0
                                    ? <SelectItem value="__none__" disabled>No modules available — create one first</SelectItem>
                                    : customAssessmentModules.map((mod: any) => (
                                        <SelectItem key={mod.id} value={mod.module_name}>{mod.module_name}</SelectItem>
                                      ))
                                  }
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">Description</Label>
                              <textarea value={newPackageData.description} onChange={(e) => setNewPackageData({ ...newPackageData, description: e.target.value })} placeholder="Brief description of what this package includes and who it's for..." rows={3} className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">Category</Label>
                                <Select
                                  value={newPkgCatMode ? '__new__' : (newPackageData.category || '')}
                                  onValueChange={(val) => {
                                    if (val === '__new__') { setNewPkgCatMode(true); setNewPackageData({ ...newPackageData, category: '' }); }
                                    else { setNewPkgCatMode(false); setNewPackageData({ ...newPackageData, category: val }); }
                                  }}
                                >
                                  <SelectTrigger className="text-sm"><SelectValue placeholder="Select a category…" /></SelectTrigger>
                                  <SelectContent>
                                    {Array.from(new Set([...PKG_CATEGORIES_DEFAULT, ...subscriptionPackages.map((p: any) => p.category).filter(Boolean)])).sort().map((c: string) => (
                                      <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                    <SelectSeparator />
                                    <SelectItem value="__new__" className="text-blue-600 font-medium">➕ Add new category</SelectItem>
                                  </SelectContent>
                                </Select>
                                {newPkgCatMode && (
                                  <Input
                                    autoFocus
                                    value={newPackageData.category}
                                    onChange={(e) => setNewPackageData({ ...newPackageData, category: e.target.value })}
                                    placeholder="Enter new category name…"
                                    className="text-sm mt-2"
                                  />
                                )}
                              </div>
                              <div>
                                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">Subcategory</Label>
                                <Select
                                  value={newPkgSubCatMode ? '__new__' : (newPackageData.subcategory || '')}
                                  onValueChange={(val) => {
                                    if (val === '__new__') { setNewPkgSubCatMode(true); setNewPackageData({ ...newPackageData, subcategory: '' }); }
                                    else { setNewPkgSubCatMode(false); setNewPackageData({ ...newPackageData, subcategory: val }); }
                                  }}
                                >
                                  <SelectTrigger className="text-sm"><SelectValue placeholder="Select a subcategory…" /></SelectTrigger>
                                  <SelectContent>
                                    {Array.from(new Set([...PKG_SUBCATEGORIES_DEFAULT, ...subscriptionPackages.map((p: any) => p.subcategory).filter(Boolean)])).sort().map((c: string) => (
                                      <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                    <SelectSeparator />
                                    <SelectItem value="__new__" className="text-blue-600 font-medium">➕ Add new subcategory</SelectItem>
                                  </SelectContent>
                                </Select>
                                {newPkgSubCatMode && (
                                  <Input
                                    autoFocus
                                    value={newPackageData.subcategory}
                                    onChange={(e) => setNewPackageData({ ...newPackageData, subcategory: e.target.value })}
                                    placeholder="Enter new subcategory name…"
                                    className="text-sm mt-2"
                                  />
                                )}
                              </div>
                              <div>
                                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">Subscription Type</Label>
                                <Select value={newPackageData.subscriptionType} onValueChange={(val) => setNewPackageData({ ...newPackageData, subscriptionType: val })}>
                                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="one_time">One-Time Purchase</SelectItem>
                                    <SelectItem value="recurring">Recurring Subscription</SelectItem>
                                    <SelectItem value="institutional">Institutional Licence</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">Assessment Mode</Label>
                                <Select value={newPackageData.assessmentMode} onValueChange={(val) => setNewPackageData({ ...newPackageData, assessmentMode: val })}>
                                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="online">Online (Self-administered)</SelectItem>
                                    <SelectItem value="proctored">Proctored</SelectItem>
                                    <SelectItem value="hybrid">Hybrid</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">Max Attempts</Label>
                                <Input type="number" min={1} max={10} value={newPackageData.maxAttempts} onChange={(e) => setNewPackageData({ ...newPackageData, maxAttempts: parseInt(e.target.value) || 1 })} className="text-sm" />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* ── STEP 1: Student Targeting ─── */}
                        {pkgWizardStep === 1 && (
                          <div className="space-y-5">
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500 block">Age Band Targeting</Label>
                                {newPackageData.productName && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${BRAND.primary}15`, color: BRAND.primary }}>
                                    🔒 Locked from module
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-gray-400 mb-2">
                                {newPackageData.productName
                                  ? 'Age bands are set by the selected module and cannot be changed here.'
                                  : 'Select which age bands this package applies to. Multiple selections allowed.'}
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                {[
                                  { code: 'A', label: 'Band A — Primary', range: 'Ages 6–10', grades: 'Grades 1–5' },
                                  { code: 'B', label: 'Band B — Middle', range: 'Ages 11–14', grades: 'Grades 6–8' },
                                  { code: 'C', label: 'Band C — Secondary', range: 'Ages 15–18', grades: 'Grades 9–12' },
                                  { code: 'D', label: 'Band D — Senior', range: 'Ages 18–21', grades: 'UG Year 1–2' },
                                  { code: 'E', label: 'Band E — Young Adult', range: 'Ages 21–25', grades: 'UG/PG/Early Career' },
                                  { code: 'E1', label: 'Band E1 — Adult', range: 'Ages 22–30', grades: 'Working Professional' },
                                ].filter(band => !newPackageData.productName || (newPackageData.ageBandCodes || []).includes(band.code))
                                .map(band => {
                                  const _ageBands = newPackageData.ageBandCodes || [];
                                  const isSelected = _ageBands.includes(band.code);
                                  const locked = !!newPackageData.productName;
                                  return (
                                    <div
                                      key={band.code}
                                      onClick={() => {
                                        if (locked) return;
                                        const updated = isSelected ? _ageBands.filter((c: string) => c !== band.code) : [..._ageBands, band.code];
                                        setNewPackageData({ ...newPackageData, ageBandCodes: updated });
                                      }}
                                      className={`rounded-lg border-2 p-3 transition-all ${locked ? 'cursor-default' : 'cursor-pointer'} ${isSelected ? 'border-[#344E86] bg-[#344E86]/5' : 'border-gray-200'} ${!locked && !isSelected ? 'hover:border-gray-300' : ''}`}
                                    >
                                      <div className="flex items-center justify-between mb-1">
                                        <span className={`text-xs font-bold ${isSelected ? 'text-[#344E86]' : 'text-gray-400'}`}>{band.label}</span>
                                        {isSelected && <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: BRAND.primary }}>{locked ? '🔒' : '✓'}</div>}
                                      </div>
                                      <p className="text-[10px] text-gray-500">{band.range}</p>
                                      <p className="text-[10px] text-gray-400">{band.grades}</p>
                                    </div>
                                  );
                                })}
                              </div>
                              {(newPackageData.ageBandCodes || []).length === 0 && (
                                <p className="text-[11px] text-amber-600 mt-2">⚠ No age bands selected — package will be shown to all students</p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* ── STEP 2: Assessment Design ─── */}
                        {pkgWizardStep === 2 && (
                          <div className="space-y-5">
                            <div>
                              {/* Header — locked vs editable */}
                              <div className="flex items-center justify-between mb-1">
                                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500 block">
                                  {newPackageData.productName ? 'Assessment Design' : 'Select LBI Domains *'}
                                </Label>
                                {newPackageData.productName && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${BRAND.primary}15`, color: BRAND.primary }}>
                                    🔒 Locked from module
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-gray-400 mb-3">
                                {newPackageData.productName
                                  ? 'The data for this form is automatically populated from the selected module. Review only — not editable.'
                                  : 'Click domains to add them. Then configure subdomains and question counts for each.'}
                              </p>

                              {/* Domain picker — only shown when no module selected */}
                              {!newPackageData.productName && (
                                <div className="grid grid-cols-2 gap-1.5 mb-3 max-h-40 overflow-y-auto pr-1">
                                  {lbiCatalog.map((domain: any) => {
                                    const isSelected = (newPackageData.domainConfig || []).some((d: any) => d.domainCode === domain.code);
                                    return (
                                      <button
                                        key={domain.code}
                                        type="button"
                                        onClick={() => {
                                          if (isSelected) {
                                            setNewPackageData(prev => ({
                                              ...prev,
                                              domainConfig: (prev.domainConfig || []).filter((d: any) => d.domainCode !== domain.code),
                                              domainsCovered: (prev.domainsCovered || []).filter((n: string) => n !== domain.name),
                                            }));
                                          } else {
                                            const newDomain = {
                                              domainCode: domain.code,
                                              domainName: domain.name,
                                              subdomains: (domain.subdomains || []).map((sd: any) => ({ code: sd.code, name: sd.name, count: sd.defaultCount })),
                                            };
                                            setNewPackageData(prev => ({
                                              ...prev,
                                              domainConfig: [...(prev.domainConfig || []), newDomain],
                                              domainsCovered: [...(prev.domainsCovered || []), domain.name],
                                            }));
                                          }
                                        }}
                                        className={`text-left rounded-md border px-2.5 py-1.5 text-xs transition-all flex items-center gap-1.5 ${isSelected ? 'border-[#344E86] bg-[#344E86]/8 text-[#344E86] font-semibold' : 'border-gray-200 hover:border-gray-300 text-gray-600'}`}
                                      >
                                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isSelected ? 'bg-[#344E86]' : 'bg-gray-300'}`} />
                                        <span className="font-mono text-[10px] text-gray-400 flex-shrink-0">{domain.code}</span>
                                        <span className="truncate">{domain.name.length > 28 ? domain.name.slice(0, 28) + '…' : domain.name}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Empty state — module selected but no domain_selections configured */}
                              {newPackageData.productName && (newPackageData.domainConfig || []).length === 0 && (
                                <div className="border border-amber-200 rounded-lg p-4 bg-amber-50 text-center">
                                  <p className="text-xs font-semibold text-amber-700 mb-1">⚠ No domains configured in this module</p>
                                  <p className="text-[11px] text-amber-600">Open Module Management and add domain selections to this module first, then return here.</p>
                                </div>
                              )}

                              {/* Domain cards — read-only when locked, editable when not */}
                              {(newPackageData.domainConfig || []).length > 0 && (
                                <div className="space-y-3">
                                  <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    {newPackageData.productName ? 'Subdomains & Question Counts' : 'Configure Subdomains & Question Counts'}
                                  </Label>
                                  {(newPackageData.domainConfig || []).map((domain: any, di: number) => (
                                    <div key={domain.domainCode} className={`border rounded-lg p-3 ${newPackageData.productName ? 'bg-[#344E86]/3 border-[#344E86]/20' : 'bg-gray-50'}`}>
                                      <div className="flex items-center justify-between mb-2">
                                        <div>
                                          <span className="text-xs font-bold text-gray-700">{domain.domainName}</span>
                                          <span className="ml-2 text-[10px] font-mono text-gray-400">{domain.domainCode}</span>
                                        </div>
                                        <span className="text-[10px] text-gray-500 font-medium">
                                          {domain.subdomains.reduce((s: number, sd: any) => s + (sd.count || 0), 0)} Qs total
                                        </span>
                                      </div>
                                      <div className="space-y-1.5">
                                        {domain.subdomains.map((sd: any, si: number) => (
                                          <div key={sd.code} className="flex items-center gap-2">
                                            <span className="text-[11px] text-gray-600 flex-1 truncate">{sd.name}</span>
                                            {newPackageData.productName ? (
                                              <span className="w-14 text-xs text-center px-1 py-0.5 rounded font-semibold text-[#344E86]" style={{ backgroundColor: `${BRAND.primary}12` }}>{sd.count}</span>
                                            ) : (
                                              <input
                                                type="number"
                                                min={0}
                                                max={20}
                                                value={sd.count}
                                                onChange={(e) => {
                                                  const updated = [...newPackageData.domainConfig];
                                                  updated[di] = { ...updated[di], subdomains: updated[di].subdomains.map((s: any, idx: number) => idx === si ? { ...s, count: parseInt(e.target.value) || 0 } : s) };
                                                  setNewPackageData({ ...newPackageData, domainConfig: updated });
                                                }}
                                                className="w-14 text-xs text-center border rounded px-1 py-0.5 bg-white"
                                              />
                                            )}
                                            <span className="text-[10px] text-gray-400">Qs</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Question draw mode */}
                            <div>
                              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2 block">Question Draw Mode</Label>
                              <div className="grid grid-cols-3 gap-2">
                                {[
                                  { val: 'random', label: 'Random', desc: 'Randomly drawn from pool' },
                                  { val: 'fixed', label: 'Fixed', desc: 'Exact same questions always' },
                                  { val: 'weighted', label: 'Weighted', desc: 'By difficulty distribution' },
                                ].map(m => (
                                  <div
                                    key={m.val}
                                    onClick={() => setNewPackageData({ ...newPackageData, questionDrawMode: m.val })}
                                    className={`rounded-lg border-2 p-2.5 cursor-pointer text-center transition-all ${newPackageData.questionDrawMode === m.val ? 'border-[#344E86] bg-[#344E86]/5' : 'border-gray-200 hover:border-gray-300'}`}
                                  >
                                    <div className={`text-xs font-bold ${newPackageData.questionDrawMode === m.val ? 'text-[#344E86]' : 'text-gray-600'}`}>{m.label}</div>
                                    <div className="text-[10px] text-gray-400 mt-0.5">{m.desc}</div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Difficulty distribution */}
                            <div>
                              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2 block">Difficulty Distribution</Label>
                              <div className="space-y-2">
                                {(['easy', 'medium', 'hard'] as const).map(level => {
                                  const colors = { easy: '#22c55e', medium: '#f59e0b', hard: '#ef4444' };
                                  return (
                                    <div key={level} className="flex items-center gap-3">
                                      <span className="text-xs font-medium capitalize w-14" style={{ color: colors[level] }}>{level}</span>
                                      <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        value={(newPackageData.difficultyDistribution || EMPTY_PKG.difficultyDistribution)[level]}
                                        onChange={(e) => {
                                          const _d = newPackageData.difficultyDistribution || EMPTY_PKG.difficultyDistribution;
                                          const val = parseInt(e.target.value);
                                          const rest = 100 - val;
                                          const other = level === 'easy' ? ['medium', 'hard'] : level === 'medium' ? ['easy', 'hard'] : ['easy', 'medium'];
                                          const total = _d[other[0] as 'easy'|'medium'|'hard'] + _d[other[1] as 'easy'|'medium'|'hard'] || 1;
                                          setNewPackageData({
                                            ...newPackageData,
                                            difficultyDistribution: {
                                              ..._d,
                                              [level]: val,
                                              [other[0]]: Math.round(_d[other[0] as 'easy'|'medium'|'hard'] / total * rest),
                                              [other[1]]: Math.round(_d[other[1] as 'easy'|'medium'|'hard'] / total * rest),
                                            }
                                          });
                                        }}
                                        className="flex-1"
                                      />
                                      <span className="text-xs font-bold w-10 text-right" style={{ color: colors[level] }}>{(newPackageData.difficultyDistribution || EMPTY_PKG.difficultyDistribution)[level]}%</span>
                                    </div>
                                  );
                                })}
                                <div className="h-2 rounded-full overflow-hidden bg-gray-100 flex">
                                  <div className="h-full" style={{ width: `${(newPackageData.difficultyDistribution || EMPTY_PKG.difficultyDistribution).easy}%`, backgroundColor: '#22c55e' }} />
                                  <div className="h-full" style={{ width: `${(newPackageData.difficultyDistribution || EMPTY_PKG.difficultyDistribution).medium}%`, backgroundColor: '#f59e0b' }} />
                                  <div className="h-full" style={{ width: `${(newPackageData.difficultyDistribution || EMPTY_PKG.difficultyDistribution).hard}%`, backgroundColor: '#ef4444' }} />
                                </div>
                              </div>
                            </div>

                            {/* Anchor questions */}
                            <div className="flex items-center justify-between rounded-lg border p-3 bg-gray-50">
                              <div>
                                <div className="text-xs font-semibold text-gray-700">Include Anchor Questions</div>
                                <div className="text-[11px] text-gray-400">Standardised calibration questions included in every attempt</div>
                              </div>
                              <Switch checked={newPackageData.includeAnchorQuestions} onCheckedChange={(v) => setNewPackageData({ ...newPackageData, includeAnchorQuestions: v })} />
                            </div>
                          </div>
                        )}

                        {/* ── STEP 3: Mentor Add-On ─── */}
                        {pkgWizardStep === 3 && (() => {
                          const _m = newPackageData.mentorAddOn || EMPTY_PKG.mentorAddOn;
                          return (
                          <div className="space-y-5">
                            <div className="flex items-center justify-between rounded-xl border-2 p-4" style={{ borderColor: _m.enabled ? BRAND.primary : '#E2E8F0', backgroundColor: _m.enabled ? BRAND.primary + '08' : '#F8FAFC' }}>
                              <div>
                                <div className="text-sm font-semibold text-gray-800">Include Mentor Sessions</div>
                                <div className="text-xs text-gray-500 mt-0.5">Bundle mentoring sessions with this assessment package</div>
                              </div>
                              <Switch checked={_m.enabled} onCheckedChange={(v) => setNewPackageData({ ...newPackageData, mentorAddOn: { ..._m, enabled: v } })} />
                            </div>
                            {_m.enabled && (
                              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">Number of Sessions</Label>
                                    <div className="flex items-center gap-2">
                                      <button type="button" onClick={() => setNewPackageData({ ...newPackageData, mentorAddOn: { ..._m, sessions: Math.max(1, _m.sessions - 1) } })} className="w-8 h-8 rounded-md border flex items-center justify-center hover:bg-gray-50 text-lg font-bold text-gray-500">−</button>
                                      <span className="text-lg font-bold text-gray-800 w-8 text-center">{_m.sessions}</span>
                                      <button type="button" onClick={() => setNewPackageData({ ...newPackageData, mentorAddOn: { ..._m, sessions: Math.min(20, _m.sessions + 1) } })} className="w-8 h-8 rounded-md border flex items-center justify-center hover:bg-gray-50 text-lg font-bold text-gray-500">+</button>
                                    </div>
                                  </div>
                                  <div>
                                    <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">Duration per Session</Label>
                                    <Select value={String(_m.duration)} onValueChange={(val) => setNewPackageData({ ...newPackageData, mentorAddOn: { ..._m, duration: parseInt(val) } })}>
                                      <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="30">30 minutes</SelectItem>
                                        <SelectItem value="45">45 minutes</SelectItem>
                                        <SelectItem value="60">60 minutes (1 hr)</SelectItem>
                                        <SelectItem value="90">90 minutes (1.5 hr)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2 block">Mentor Type</Label>
                                  {(() => {
                                    const MT_GROUPS = [
                                      { key: 'LBI', label: 'LBI — Academic & Student Support', types: [
                                        { val: 'subject_tutor', label: 'Subject Tutor', desc: 'Subject expertise & academic instruction' },
                                        { val: 'exam_strategist', label: 'Exam Strategist', desc: 'JEE, NEET, Board & competitive prep' },
                                        { val: 'performance_coach', label: 'Performance Coach', desc: 'Study habits, discipline & productivity' },
                                        { val: 'psychological_counsellor', label: 'Psychological Counsellor', desc: 'Mental health & emotional well-being' },
                                      ]},
                                      { key: 'Employability', label: 'Employability Index', types: [
                                        { val: 'career_counsellor', label: 'Career Counsellor', desc: 'Pathways, career planning & guidance' },
                                        { val: 'employability_coach', label: 'Employability Coach', desc: 'Job readiness, workplace & soft skills' },
                                        { val: 'interview_coach', label: 'Interview Coach', desc: 'Interview prep & campus recruitment' },
                                      ]},
                                      { key: 'Enterprise', label: 'Enterprise Model', types: [
                                        { val: 'leadership_coach', label: 'Leadership Coach', desc: 'Leadership development & executive coaching' },
                                        { val: 'hr_consultant', label: 'HR Consultant', desc: 'Talent management & workforce development' },
                                        { val: 'corporate_trainer', label: 'Corporate Trainer', desc: 'L&D, team training & capability building' },
                                      ]},
                                    ];
                                    return MT_GROUPS.map(group => (
                                      <div key={group.key} className="mb-3">
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">{group.label}</p>
                                        <div className="grid grid-cols-2 gap-1.5">
                                          {group.types.map(mt => {
                                            const isMTSelected = _m.mentorType === mt.val;
                                            return (
                                              <div
                                                key={mt.val}
                                                onClick={() => setNewPackageData({ ...newPackageData, mentorAddOn: { ..._m, mentorType: mt.val } })}
                                                className={`rounded-lg border-2 p-2.5 cursor-pointer transition-all flex items-start gap-2 ${isMTSelected ? 'border-[#344E86] bg-[#344E86]/5' : 'border-gray-200 hover:border-gray-300'}`}
                                              >
                                                <div className={`mt-0.5 flex-shrink-0 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${isMTSelected ? 'border-[#344E86]' : 'border-gray-300'}`}>
                                                  {isMTSelected && <div className="w-1.5 h-1.5 rounded-full bg-[#344E86]" />}
                                                </div>
                                                <div>
                                                  <div className={`text-xs font-bold leading-tight ${isMTSelected ? 'text-[#344E86]' : 'text-gray-700'}`}>{mt.label}</div>
                                                  <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">{mt.desc}</div>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ));
                                  })()}
                                </div>
                                <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
                                  <p className="text-xs text-blue-700 font-medium">
                                    {_m.sessions} × {_m.duration}-min session{_m.sessions !== 1 ? 's' : ''} with a {_m.mentorType?.replace(/_/g, ' ')} will be bundled with this package.
                                  </p>
                                </div>
                              </div>
                            )}
                            {!_m.enabled && (
                              <div className="text-center py-8 text-gray-400">
                                <div className="text-3xl mb-2">🎓</div>
                                <p className="text-sm">Enable the mentor add-on above to bundle mentoring sessions with this package.</p>
                              </div>
                            )}
                          </div>
                          );
                        })()}

                        {/* ── STEP 4: Pricing & Launch ─── */}
                        {pkgWizardStep === 4 && (
                          <div className="space-y-5">
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">Price (₹)</Label>
                                <Input type="number" value={newPackageData.price} onChange={(e) => setNewPackageData({ ...newPackageData, price: e.target.value })} placeholder="1499" className="text-sm" />
                              </div>
                              <div>
                                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">Validity (days)</Label>
                                <Input type="number" value={newPackageData.validityDays} onChange={(e) => setNewPackageData({ ...newPackageData, validityDays: e.target.value })} placeholder="365" className="text-sm" />
                              </div>
                              <div>
                                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">Override Q-Count</Label>
                                <Input type="number" value={newPackageData.questionCount} onChange={(e) => setNewPackageData({ ...newPackageData, questionCount: e.target.value })} placeholder="Auto from domains" className="text-sm" />
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 block">Report Type</Label>
                              <Select value={newPackageData.reportType} onValueChange={(val) => setNewPackageData({ ...newPackageData, reportType: val })}>
                                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Basic">Basic — Summary only</SelectItem>
                                  <SelectItem value="Standard">Standard — Domain scores + insights</SelectItem>
                                  <SelectItem value="Detailed">Detailed — Subdomain breakdown + recommendations</SelectItem>
                                  <SelectItem value="Comprehensive">Comprehensive — Full diagnostic + action plan</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {/* ── Pricing Details ────────────────────────────── */}
                            <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                              <div className="flex items-center gap-2 border-b border-gray-100 pb-2.5 mb-1">
                                <div className="w-0.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: BRAND.primary }} />
                                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">Pricing Details</p>
                              </div>
                              <div className="grid grid-cols-3 gap-3">
                                <div>
                                  <Label className="text-xs text-gray-600 mb-1 block">Original / MRP (₹)</Label>
                                  <Input type="number" value={newPackageData.originalPrice} onChange={(e) => { const orig = parseFloat(e.target.value); const sell = parseFloat(newPackageData.price); const auto = (!isNaN(orig) && !isNaN(sell) && orig > 0) ? Math.round(((orig - sell) / orig) * 100) : ''; setNewPackageData({ ...newPackageData, originalPrice: e.target.value, discountPct: auto !== '' ? String(auto) : newPackageData.discountPct }); }} placeholder="1999" className="text-sm" />
                                </div>
                                <div>
                                  <Label className="text-xs text-gray-600 mb-1 block">Discount %</Label>
                                  <Input type="number" value={newPackageData.discountPct} onChange={(e) => setNewPackageData({ ...newPackageData, discountPct: e.target.value })} placeholder="25" className="text-sm" />
                                </div>
                                <div>
                                  <Label className="text-xs text-gray-600 mb-1 block">Offer Label</Label>
                                  <Input value={newPackageData.offerLabel} onChange={(e) => setNewPackageData({ ...newPackageData, offerLabel: e.target.value })} placeholder="Launch Offer" className="text-sm" />
                                </div>
                              </div>
                              {newPackageData.originalPrice && newPackageData.price && !isNaN(parseFloat(newPackageData.originalPrice)) && !isNaN(parseFloat(newPackageData.price)) && (
                                <div className="flex items-center gap-2 text-xs bg-white border border-amber-200 rounded-lg px-3 py-2">
                                  <span className="text-gray-400 line-through">₹{parseFloat(newPackageData.originalPrice).toLocaleString()}</span>
                                  <span className="font-bold text-emerald-600 text-sm">₹{parseFloat(newPackageData.price).toLocaleString()}</span>
                                  {newPackageData.discountPct && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-semibold">{newPackageData.discountPct}% OFF</span>}
                                  {newPackageData.offerLabel && <span className="text-amber-600 font-medium">{newPackageData.offerLabel}</span>}
                                </div>
                              )}
                            </div>

                            {/* ── Coupons & Promotions ───────────────────────── */}
                            <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                              <div className="flex items-center gap-2 border-b border-gray-100 pb-2.5 mb-1">
                                <div className="w-0.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: BRAND.primary }} />
                                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">Coupons & Promotions</p>
                              </div>
                              <div className="grid grid-cols-3 gap-3">
                                <div>
                                  <Label className="text-xs text-gray-600 mb-1 block">Coupon Code</Label>
                                  <Input value={newPackageData.couponCode} onChange={(e) => setNewPackageData({ ...newPackageData, couponCode: e.target.value.toUpperCase() })} placeholder="SAVE20" className="text-sm font-mono tracking-wider" />
                                </div>
                                <div>
                                  <Label className="text-xs text-gray-600 mb-1 block">Coupon Discount %</Label>
                                  <Input type="number" value={newPackageData.couponDiscountPct} onChange={(e) => setNewPackageData({ ...newPackageData, couponDiscountPct: e.target.value })} placeholder="20" className="text-sm" />
                                </div>
                                <div>
                                  <Label className="text-xs text-gray-600 mb-1 block">Free Trial (days)</Label>
                                  <Input type="number" value={newPackageData.trialDays} onChange={(e) => setNewPackageData({ ...newPackageData, trialDays: e.target.value })} placeholder="7" className="text-sm" />
                                </div>
                              </div>
                            </div>

                            {/* ── Scholarship ────────────────────────────────── */}
                            <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                              <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-0.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: BRAND.primary }} />
                                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">Scholarship / Need-Based Access</p>
                                </div>
                                <Switch checked={newPackageData.scholarshipEnabled} onCheckedChange={(v) => setNewPackageData({ ...newPackageData, scholarshipEnabled: v })} />
                              </div>
                              {newPackageData.scholarshipEnabled && (
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <Label className="text-xs text-gray-600 mb-1 block">Scholarship Discount %</Label>
                                    <Input type="number" value={newPackageData.scholarshipPct} onChange={(e) => setNewPackageData({ ...newPackageData, scholarshipPct: e.target.value })} placeholder="100" className="text-sm" />
                                    <p className="text-[10px] text-gray-400 mt-1">100% = fully free for eligible students</p>
                                  </div>
                                  <div className="flex flex-col justify-center text-xs text-gray-500 pl-2 border-l border-gray-100">
                                    <p className="font-medium text-gray-600">How it works</p>
                                    <p className="mt-1">Eligible students receive a scholarship code that grants this discount at checkout. Managed under the Scholarships tab.</p>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* ── Domains Covered ────────────────────────────── */}
                            <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
                              <div className="flex items-center gap-2 border-b border-gray-100 pb-2.5 mb-1">
                                <div className="w-0.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: BRAND.primary }} />
                                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">Domains Covered</p>
                              </div>
                              <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                                {(newPackageData.domainsCovered || []).map((d: string, i: number) => (
                                  <span key={i} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700">
                                    {d}
                                    <button onClick={() => setNewPackageData({ ...newPackageData, domainsCovered: newPackageData.domainsCovered.filter((_: any, idx: number) => idx !== i) })} className="text-indigo-300 hover:text-red-500 ml-0.5"><X className="h-3 w-3" /></button>
                                  </span>
                                ))}
                                {(!newPackageData.domainsCovered || newPackageData.domainsCovered.length === 0) && <span className="text-xs text-gray-400">No domains added yet</span>}
                              </div>
                              <Select onValueChange={(val) => { if (val && !(newPackageData.domainsCovered || []).includes(val)) setNewPackageData({ ...newPackageData, domainsCovered: [...(newPackageData.domainsCovered || []), val] }); }}>
                                <SelectTrigger className="text-sm"><SelectValue placeholder="Add domain…" /></SelectTrigger>
                                <SelectContent>
                                  {(() => {
                                    const DOMAIN_GROUPS = [
                                      { label: 'LBI — Academic & Student Intelligence', items: ['Academic & Cognitive Efficiency','Thinking Quality Profiling','Emotional Self-Expression & Regulation','Communicating, Socializing & Conflict Coping','Academic & Cognitive Challenges','Social & Emotional Intelligence','Discipline, Habits & Commitment','Communication Effectiveness','Motivation, Values & Resilience','Lifestyle, Pressures & Environment','Optimism, Courage & Resilience','Adaptability & Integrity Management','Mindset & Self-Regulation','Academic Self-Concept & Identity','Competitive Exam Readiness','Examination Stress & Coping','Learning Efficiency & Memory','Root Cause Intelligence','Metacognition & Learning Strategy','Teacher–Student Dynamic'] },
                                      { label: 'Employability Index', items: ['Communication & Presentation Skills','Critical Thinking & Problem Solving','Teamwork & Collaboration','Adaptability & Change Management','Leadership Potential','Work Ethics & Professionalism','Emotional Intelligence at Work','Digital Literacy & Tech Readiness','Time Management & Productivity','Customer Orientation & Service Mindset','Entrepreneurial Mindset','Interview Readiness Index','Campus-to-Corporate Transition','Workplace Stress Management','Goal Setting & Achievement Drive','Conflict Resolution Skills','Overall Employability Score'] },
                                      { label: 'Enterprise Model', items: ['Leadership Effectiveness Index','Strategic Thinking Capacity','Team Dynamics & Culture Fit','Organizational Commitment','High-Performance Mindset','Executive Presence & Influence','Change Management Capability','Innovation & Creative Thinking','Cross-Functional Collaboration','Stakeholder Management Skills','Risk Tolerance & Decision Making','Workforce Resilience Index','Managerial Self-Awareness','Talent Potential Mapping','Culture Alignment Score','Employee Well-being Index'] },
                                    ];
                                    return DOMAIN_GROUPS.flatMap((g, gi) => [
                                      <SelectItem key={`__dh_${gi}`} value={`__dh_${gi}`} disabled className="text-[10px] font-bold uppercase tracking-wider text-gray-400 py-1.5 cursor-default bg-gray-50">{g.label}</SelectItem>,
                                      ...g.items.filter(d => !(newPackageData.domainsCovered || []).includes(d)).map(d => <SelectItem key={d} value={d} className="pl-4">{d}</SelectItem>),
                                    ]);
                                  })()}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* ── Feature Highlights ─────────────────────────── */}
                            <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
                              <div className="flex items-center gap-2 border-b border-gray-100 pb-2.5 mb-1">
                                <div className="w-0.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: BRAND.primary }} />
                                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">Feature Highlights</p>
                              </div>
                              <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                                {(newPackageData.highlights || []).map((h: string, i: number) => (
                                  <span key={i} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700">
                                    {h}
                                    <button onClick={() => setNewPackageData({ ...newPackageData, highlights: newPackageData.highlights.filter((_: any, idx: number) => idx !== i) })} className="text-blue-300 hover:text-red-500 ml-0.5"><X className="h-3 w-3" /></button>
                                  </span>
                                ))}
                                {(!newPackageData.highlights || newPackageData.highlights.length === 0) && <span className="text-xs text-gray-400">No highlights added yet</span>}
                              </div>
                              <Select onValueChange={(val) => { if (val && !(newPackageData.highlights || []).includes(val)) setNewPackageData({ ...newPackageData, highlights: [...(newPackageData.highlights || []), val] }); }}>
                                <SelectTrigger className="text-sm"><SelectValue placeholder="Quick-add from preset list…" /></SelectTrigger>
                                <SelectContent>
                                  {(() => {
                                    const HIGHLIGHT_GROUPS = [
                                      { label: 'Assessment Format', items: ['15-minute quick assessment','30-minute standard assessment','45-minute extended assessment','60-minute deep assessment','Adaptive questioning format','Proctored online assessment','Multi-language assessment support'] },
                                      { label: 'Intelligence Coverage', items: ['1 domain behavioral profile','3 domains behavioral profile','5 domains behavioral profile','8 domains behavioral profile','12 domains behavioral profile','19 domains full intelligence map','Cross-domain pattern analysis'] },
                                      { label: 'Reporting', items: ['Basic behavioral insights report','Domain score breakdown','Subdomain-level analysis','Overall readiness score','Percentile benchmarking','Personalized action plan','Parent-facing report','HR / Manager-facing report','PDF + interactive report','Institution-level analytics dashboard','API report access'] },
                                      { label: 'LBI — Academic Outcomes', items: ['Academic performance prediction','Learning style profiling','Competitive exam readiness score','Root cause of learning gaps','Metacognition & strategy insights','Examination stress indicators'] },
                                      { label: 'Employability Outcomes', items: ['Employability readiness score','Career pathway recommendations','Competency gap mapping','Campus-to-corporate transition plan','Interview readiness index','Soft skills benchmarking'] },
                                      { label: 'Enterprise Outcomes', items: ['Leadership potential score','Team fit compatibility report','Culture alignment assessment','Talent potential mapping','Workforce resilience index','Manager self-awareness profile'] },
                                      { label: 'Wellness & Support', items: ['Mental health risk indicators','Emotional well-being assessment','Stress & burnout indicators','Resilience & coping analysis'] },
                                      { label: 'Add-ons & Benefits', items: ['1 mentor session bundled','2 mentor sessions bundled','3 mentor sessions bundled','Retest after 90 days','Unlimited retests','Progress tracking over 12 months','Dedicated counsellor access','Priority support'] },
                                      { label: 'Trust & Compliance', items: ['Certified behavioral assessment','Scientifically validated instrument','DPDP & FERPA compliant','93% predictive accuracy','Expert-reviewed insights','ISO-aligned data security'] },
                                    ];
                                    return HIGHLIGHT_GROUPS.flatMap((g, gi) => [
                                      <SelectItem key={`__hh_${gi}`} value={`__hh_${gi}`} disabled className="text-[10px] font-bold uppercase tracking-wider text-gray-400 py-1.5 cursor-default bg-gray-50">{g.label}</SelectItem>,
                                      ...g.items.filter(h => !(newPackageData.highlights || []).includes(h)).map(h => <SelectItem key={h} value={h} className="pl-4">{h}</SelectItem>),
                                    ]);
                                  })()}
                                </SelectContent>
                              </Select>
                              <div className="flex gap-2">
                                <Input value={newPackageData._highlightInput || ''} onChange={(e) => setNewPackageData({ ...newPackageData, _highlightInput: e.target.value })} placeholder="Or type a custom highlight…" className="flex-1 text-sm"
                                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const v = (newPackageData._highlightInput || '').trim(); if (v && !(newPackageData.highlights || []).includes(v)) setNewPackageData({ ...newPackageData, highlights: [...(newPackageData.highlights || []), v], _highlightInput: '' }); }}} />
                                <Button size="sm" variant="outline" onClick={() => { const v = (newPackageData._highlightInput || '').trim(); if (v && !(newPackageData.highlights || []).includes(v)) setNewPackageData({ ...newPackageData, highlights: [...(newPackageData.highlights || []), v], _highlightInput: '' }); }}>Add</Button>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="flex items-center justify-between rounded-lg border p-3">
                                <div>
                                  <div className="text-xs font-semibold text-gray-700">Mark as Recommended</div>
                                  <div className="text-[10px] text-gray-400">Highlighted with a "Recommended" badge</div>
                                </div>
                                <Switch checked={newPackageData.isRecommended} onCheckedChange={(v) => setNewPackageData({ ...newPackageData, isRecommended: v })} />
                              </div>
                              <div className="flex items-center justify-between rounded-lg border p-3">
                                <div>
                                  <div className="text-xs font-semibold text-gray-700">Active on Platform</div>
                                  <div className="text-[10px] text-gray-400">Visible and purchasable by parents</div>
                                </div>
                                <Switch checked={newPackageData.isActive} onCheckedChange={(v) => setNewPackageData({ ...newPackageData, isActive: v })} />
                              </div>
                            </div>

                            {/* Summary preview */}
                            <div className="rounded-xl border-2 border-dashed border-gray-200 p-4 bg-gray-50">
                              <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Package Summary</div>
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-gray-500 w-28">Name</span>
                                  <span className="text-xs font-semibold text-gray-800">{newPackageData.productName || '—'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-gray-500 w-28">Category</span>
                                  <span className="text-xs text-gray-700">{newPackageData.category}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-gray-500 w-28">Age Bands</span>
                                  <span className="text-xs text-gray-700">{(newPackageData.ageBandCodes || []).length > 0 ? (newPackageData.ageBandCodes || []).join(', ') : 'All bands'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-gray-500 w-28">Domains</span>
                                  <span className="text-xs text-gray-700">{(newPackageData.domainConfig || []).length} selected ({(newPackageData.domainConfig || []).reduce((s: number, d: any) => s + (d.subdomains || []).reduce((ss: number, sd: any) => ss + (sd.count || 0), 0), 0)} Qs)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-gray-500 w-28">Difficulty</span>
                                  <span className="text-xs text-gray-700">Easy {(newPackageData.difficultyDistribution || EMPTY_PKG.difficultyDistribution).easy}% / Medium {(newPackageData.difficultyDistribution || EMPTY_PKG.difficultyDistribution).medium}% / Hard {(newPackageData.difficultyDistribution || EMPTY_PKG.difficultyDistribution).hard}%</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-gray-500 w-28">Mentor Add-On</span>
                                  <span className="text-xs text-gray-700">{(newPackageData.mentorAddOn || EMPTY_PKG.mentorAddOn).enabled ? `${(newPackageData.mentorAddOn || EMPTY_PKG.mentorAddOn).sessions} sessions × ${(newPackageData.mentorAddOn || EMPTY_PKG.mentorAddOn).duration} min` : 'None'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-gray-500 w-28">Price</span>
                                  <span className="text-xs font-bold text-gray-800">{newPackageData.price ? `₹${parseFloat(newPackageData.price).toLocaleString('en-IN')}` : 'Free / Not set'}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Footer nav */}
                      <div className="border-t px-6 py-4 flex items-center justify-between bg-white">
                        <Button variant="outline" size="sm" onClick={() => { if (pkgWizardStep === 0) { setCreatePackageDialog(false); setNewPackageData({ ...EMPTY_PKG }); } else { setPkgWizardStep(pkgWizardStep - 1); } }}>
                          {pkgWizardStep === 0 ? 'Cancel' : '← Back'}
                        </Button>
                        <div className="flex items-center gap-2">
                          {pkgWizardStep < 4 ? (
                            <Button
                              size="sm"
                              style={{ backgroundColor: BRAND.primary }}
                              className="text-white"
                              disabled={pkgWizardStep === 0 && !newPackageData.productName.trim()}
                              onClick={() => {
                                if (pkgWizardStep === 2 && (newPackageData.domainConfig || []).length === 0) {
                                  if (newPackageData.productName) {
                                    toast({ title: 'Module has no domains configured', description: 'Go to Module Management and add domain selections to this module first', variant: 'destructive' });
                                  } else {
                                    toast({ title: 'Select at least one domain', description: 'Choose LBI domains to continue', variant: 'destructive' });
                                  }
                                  return;
                                }
                                setPkgWizardStep(pkgWizardStep + 1);
                              }}
                            >Next →</Button>
                          ) : (
                            <Button
                              size="sm"
                              style={{ backgroundColor: BRAND.primary }}
                              className="text-white"
                              disabled={!newPackageData.productName.trim() || (newPackageData.domainConfig || []).length === 0}
                              data-testid="btn-confirm-create-pkg"
                              onClick={async () => {
                                try {
                                  const parsedPrice = newPackageData.price ? parseFloat(newPackageData.price) : null;
                                  const parsedValidity = newPackageData.validityDays ? parseInt(newPackageData.validityDays) : null;
                                  const parsedQCount = newPackageData.questionCount ? parseInt(newPackageData.questionCount) : null;
                                  const autoQCount = (newPackageData.domainConfig || []).reduce((s: number, d: any) => s + (d.subdomains || []).reduce((ss: number, sd: any) => ss + (sd.count || 0), 0), 0);
                                  const maxSort = (subscriptionPackages as any[])?.reduce((max: number, p: any) => Math.max(max, p.sortOrder || 0), 0) || 0;
                                  const payload = {
                                    productName: newPackageData.productName.trim(),
                                    category: newPackageData.category,
                                    description: newPackageData.description,
                                    subscriptionType: newPackageData.subscriptionType,
                                    studentSegmentCode: newPackageData.studentSegmentCode,
                                    studentSegment: ({ UNIVERSAL: 'All Students', PRIMARY: 'Classes 1–5', MIDDLE: 'Classes 6–8', SECONDARY: 'Classes 9–12', COMPETITIVE: 'Competitive Exams', HIGHER_ED: 'Higher Education', WORKING: 'Working Professionals' } as Record<string, string>)[newPackageData.studentSegmentCode] || newPackageData.studentSegmentCode,
                                    ageBandCodes: newPackageData.ageBandCodes,
                                    domainConfig: newPackageData.domainConfig,
                                    domainsCovered: newPackageData.domainsCovered,
                                    highlights: newPackageData.highlights,
                                    originalPrice: newPackageData.originalPrice !== '' ? parseFloat(newPackageData.originalPrice) || null : null,
                                    discountPct: newPackageData.discountPct !== '' ? parseFloat(newPackageData.discountPct) || null : null,
                                    offerLabel: newPackageData.offerLabel?.trim() || null,
                                    couponCode: newPackageData.couponCode?.trim() || null,
                                    couponDiscountPct: newPackageData.couponDiscountPct !== '' ? parseFloat(newPackageData.couponDiscountPct) || null : null,
                                    trialDays: newPackageData.trialDays !== '' ? parseInt(newPackageData.trialDays) || null : null,
                                    scholarshipEnabled: newPackageData.scholarshipEnabled,
                                    scholarshipPct: newPackageData.scholarshipPct !== '' ? parseFloat(newPackageData.scholarshipPct) || null : null,
                                    questionDrawMode: newPackageData.questionDrawMode,
                                    difficultyDistribution: newPackageData.difficultyDistribution,
                                    includeAnchorQuestions: newPackageData.includeAnchorQuestions,
                                    mentorAddOn: newPackageData.mentorAddOn,
                                    maxAttempts: newPackageData.maxAttempts,
                                    assessmentMode: newPackageData.assessmentMode,
                                    reportType: newPackageData.reportType,
                                    isRecommended: newPackageData.isRecommended,
                                    isActive: newPackageData.isActive,
                                    sortOrder: maxSort + 1,
                                    price: parsedPrice,
                                    validityDays: parsedValidity,
                                    questionCount: parsedQCount || (autoQCount > 0 ? autoQCount : null),
                                  };
                                  const res = await fetch('/api/admin/subscription-packages', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    credentials: 'include',
                                    body: JSON.stringify(payload),
                                  });
                                  if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
                                  toast({ title: 'Package Created', description: `${newPackageData.productName} is now live on the platform.` });
                                  refetchSubscriptionPackages();
                                  refetchSubscriptionStats();
                                  setCreatePackageDialog(false);
                                  setPkgWizardStep(0);
                                  setNewPackageData({ ...EMPTY_PKG });
                                } catch (e: any) {
                                  toast({ title: 'Error', description: e.message || 'Failed to create package', variant: 'destructive' });
                                }
                              }}
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" />
                              Create Package
                            </Button>
                          )}
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* Delete Confirmation Dialog */}
                  <Dialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
                    <DialogContent className="max-w-sm">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                          <Trash2 className="h-5 w-5" />
                          Delete Package
                        </DialogTitle>
                        <DialogDescription>Are you sure you want to delete this package? This action cannot be undone. Active subscriptions using this package will be affected.</DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteConfirmId(null)} data-testid="btn-cancel-delete-pkg">Cancel</Button>
                        <Button
                          variant="destructive"
                          data-testid="btn-confirm-delete-pkg"
                          onClick={async () => {
                            try {
                              const res = await fetch(`/api/admin/subscription-packages/${deleteConfirmId}`, {
                                method: 'DELETE',
                                credentials: 'include',
                              });
                              if (!res.ok) throw new Error('Failed to delete package');
                              toast({ title: 'Package Deleted', description: 'Package has been removed.' });
                              refetchSubscriptionPackages();
                              refetchSubscriptionStats();
                              setDeleteConfirmId(null);
                            } catch (e: any) {
                              toast({ title: 'Error', description: e.message || 'Failed to delete package. It may have active subscriptions.', variant: 'destructive' });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* Assign Package Dialog */}
                  {showAssignDialog && (() => {
                    const AGE_BANDS = [
                      { code: 'A', label: 'A', range: '5–7 yrs' },
                      { code: 'B', label: 'B', range: '8–10 yrs' },
                      { code: 'C', label: 'C', range: '11–13 yrs' },
                      { code: 'D', label: 'D', range: '14–16 yrs' },
                      { code: 'E1', label: 'E1', range: '17–18 yrs' },
                    ];
                    const fmtDate = (d: Date | string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
                    // Filter + sort packages
                    const filteredPkgs = subscriptionPackages
                      .filter((pkg: any) => {
                        if (!pkg.isActive) return false;
                        if (assignAgeBandFilter && !pkg.ageBandCodes?.includes(assignAgeBandFilter)) return false;
                        if (assignSubTypeFilter && pkg.subscriptionType !== assignSubTypeFilter) return false;
                        if (assignPkgSearch) {
                          const s = assignPkgSearch.toLowerCase();
                          if (!pkg.productName?.toLowerCase().includes(s) && !pkg.category?.toLowerCase().includes(s)) return false;
                        }
                        return true;
                      })
                      .sort((a: any, b: any) => {
                        if (assignPkgSort === 'recommended') {
                          if (a.isRecommended && !b.isRecommended) return -1;
                          if (!a.isRecommended && b.isRecommended) return 1;
                          return (a.sortOrder || 0) - (b.sortOrder || 0);
                        }
                        if (assignPkgSort === 'price_asc') return (a.price ?? 0) - (b.price ?? 0);
                        if (assignPkgSort === 'price_desc') return (b.price ?? 0) - (a.price ?? 0);
                        return 0;
                      });
                    // Filter children
                    const filteredChildren = childrenList.filter((child: any) => {
                      if (assignInstitutionFilter) {
                        const inst = institutionsList.find((i: any) => i.id === assignInstitutionFilter);
                        if (inst && child.school && !child.school.toLowerCase().includes(inst.name?.toLowerCase()?.split(' ')[0] || '')) return false;
                      }
                      if (assignChildSearch) {
                        const s = assignChildSearch.toLowerCase();
                        if (!child.name?.toLowerCase().includes(s) && !child.grade?.toLowerCase().includes(s) && !child.school?.toLowerCase().includes(s)) return false;
                      }
                      return true;
                    });
                    const selectedPkg = subscriptionPackages.find((p: any) => p.id === assignPackageId);
                    const selectedChild = childrenList.find((c: any) => c.id === assignChildId);
                    const hasSamePkg = assignChildActiveSubs.some((s: any) => s.productName === selectedPkg?.productName);
                    const computedExpiry = (() => {
                      if (!selectedPkg?.validityDays) return null;
                      const start = assignStartDate ? new Date(assignStartDate) : new Date();
                      return new Date(start.getTime() + selectedPkg.validityDays * 86400000);
                    })();
                    const currentStep = !assignPackageId ? 0 : (assignMode === 'individual' && !assignChildId) ? 1 : 2;
                    const closeDialog = () => {
                      setShowAssignDialog(false);
                      setAssignChildId(''); setAssignPackageId('');
                      setAssignAgeBandFilter(''); setAssignSubTypeFilter('');
                      setAssignInstitutionFilter(''); setAssignStartDate('');
                      setAssignNotes(''); setAssignSubmitting(false);
                      setAssignSuccess(null); setAssignConflict(null);
                      setAssignPkgSearch(''); setAssignChildSearch('');
                      setAssignMode('individual'); setAssignPkgSort('recommended');
                    };
                    const handleAssign = async (force = false) => {
                      setAssignSubmitting(true);
                      setAssignConflict(null);
                      try {
                        if (assignMode === 'bulk') {
                          const res = await fetch('/api/admin/student-subscriptions/bulk', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                            body: JSON.stringify({ childIds: filteredChildren.map((c: any) => c.id), packageId: assignPackageId, institutionId: assignInstitutionFilter || undefined, targetAgeBand: assignAgeBandFilter || undefined, startDate: assignStartDate || undefined, notes: assignNotes || undefined, skipDuplicates: true }),
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.message || data.error || 'Failed');
                          setAssignSuccess({ bulk: true, ...data });
                        } else {
                          const res = await fetch('/api/admin/student-subscriptions', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                            body: JSON.stringify({ childId: assignChildId, packageId: assignPackageId, institutionId: assignInstitutionFilter || undefined, targetAgeBand: assignAgeBandFilter || undefined, startDate: assignStartDate || undefined, notes: assignNotes || undefined, force }),
                          });
                          const data = await res.json();
                          if (res.status === 409) { setAssignConflict(data); return; }
                          if (!res.ok) throw new Error(data.message || data.error || 'Failed');
                          setAssignSuccess(data);
                        }
                        queryClient.invalidateQueries({ queryKey: ['/api/admin/student-subscriptions'] });
                        queryClient.invalidateQueries({ queryKey: ['/api/admin/subscription-packages/stats'] });
                        queryClient.invalidateQueries({ queryKey: ['/api/admin/children-list'] });
                      } catch (err: any) {
                        toast({ title: 'Assignment Failed', description: err.message || 'Something went wrong.', variant: 'destructive' });
                      } finally {
                        setAssignSubmitting(false);
                      }
                    };
                    return (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm" data-testid="dialog-assign-package">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col" style={{ maxHeight: '92vh' }}>

                          {/* ── HEADER ── */}
                          <div className="px-6 py-4 border-b flex items-center justify-between shrink-0 rounded-t-2xl" style={{ background: `linear-gradient(135deg, ${BRAND.primary}15, ${BRAND.accent}10)` }}>
                            <div>
                              <h3 className="text-base font-bold flex items-center gap-2" style={{ color: BRAND.primary }}>
                                <Plus className="h-4 w-4" /> Assign Package
                              </h3>
                              <p className="text-[11px] text-gray-400 mt-0.5">Assign a subscription package to a student or institution</p>
                            </div>
                            <button onClick={closeDialog} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-white/60 text-xl leading-none transition-colors">&times;</button>
                          </div>



                          {/* ── STEP PROGRESS BAR ── */}
                          {!assignSuccess && (
                            <div className="px-6 pt-3 pb-2 shrink-0 border-b bg-gray-50/60">
                              <div className="flex items-center gap-1">
                                {['Filter', 'Package', 'Student', 'Confirm'].map((s, i) => {
                                  const done = i < currentStep;
                                  const active = i === currentStep;
                                  return (
                                    <React.Fragment key={s}>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors"
                                          style={done ? { backgroundColor: BRAND.accent, color: '#fff' } : active ? { backgroundColor: BRAND.primary, color: '#fff' } : { backgroundColor: '#e5e7eb', color: '#9ca3af' }}>
                                          {done ? '✓' : i + 1}
                                        </div>
                                        <span className="text-[11px] font-medium hidden sm:block"
                                          style={active ? { color: BRAND.primary } : done ? { color: BRAND.accent } : { color: '#9ca3af' }}>
                                          {s}
                                        </span>
                                      </div>
                                      {i < 3 && <div className="flex-1 h-px transition-colors" style={{ backgroundColor: done ? BRAND.accent : '#e5e7eb' }} />}
                                    </React.Fragment>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* ── SUCCESS SCREEN ── */}
                          {assignSuccess ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: `${BRAND.accent}20` }}>
                                <CheckCircle className="h-9 w-9" style={{ color: BRAND.accent }} />
                              </div>
                              {assignSuccess.bulk ? (
                                <>
                                  <h4 className="text-lg font-bold text-gray-900 mb-1">Bulk Assignment Complete</h4>
                                  <p className="text-sm text-gray-500 mb-5">{assignSuccess.packageName || selectedPkg?.productName}</p>
                                  <div className="flex gap-8 mb-6">
                                    <div className="text-center">
                                      <p className="text-3xl font-black" style={{ color: BRAND.accent }}>{assignSuccess.assigned ?? 0}</p>
                                      <p className="text-xs text-gray-400 mt-0.5">Assigned</p>
                                    </div>
                                    <div className="text-center">
                                      <p className="text-3xl font-black text-amber-500">{assignSuccess.skipped ?? 0}</p>
                                      <p className="text-xs text-gray-400 mt-0.5">Skipped (duplicate)</p>
                                    </div>
                                    {(assignSuccess.errors?.length ?? 0) > 0 && (
                                      <div className="text-center">
                                        <p className="text-3xl font-black text-red-500">{assignSuccess.errors.length}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">Errors</p>
                                      </div>
                                    )}
                                  </div>
                                </>
                              ) : (
                                <>
                                  <h4 className="text-lg font-bold text-gray-900 mb-1">Package Assigned!</h4>
                                  <p className="text-sm text-gray-500 mb-5">Successfully assigned to {assignSuccess.childName || selectedChild?.name || 'student'}</p>
                                  <div className="w-full rounded-xl p-4 text-left space-y-2 text-sm mb-5" style={{ backgroundColor: `${BRAND.primary}07`, border: `1px solid ${BRAND.primary}20` }}>
                                    <div className="flex justify-between"><span className="text-gray-500">Package</span><span className="font-semibold text-gray-800">{assignSuccess.packageName || selectedPkg?.productName}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="font-medium capitalize">{(assignSuccess.subscriptionType || selectedPkg?.subscriptionType || '').replace('_', ' ')}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">Started</span><span className="font-medium">{fmtDate(assignSuccess.start_date || assignSuccess.startDate || new Date())}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">Expires</span><span className="font-medium">{assignSuccess.expiryDate ? fmtDate(assignSuccess.expiryDate) : (computedExpiry ? fmtDate(computedExpiry) : 'No expiry')}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">Price</span><span className="font-bold" style={{ color: BRAND.primary }}>{selectedPkg?.price != null ? `₹${Number(selectedPkg.price).toLocaleString('en-IN')}` : 'Free'}</span></div>
                                  </div>
                                </>
                              )}
                              <div className="flex gap-3">
                                <Button variant="outline" onClick={() => { setAssignSuccess(null); setAssignChildId(''); setAssignPackageId(''); setAssignMode('individual'); }}>Assign Another</Button>
                                <Button onClick={closeDialog} style={{ backgroundColor: BRAND.primary }} className="text-white">Done</Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

                                {/* ── CONFLICT BANNER ── */}
                                {assignConflict && (
                                  <div className="rounded-xl p-4 border-2 border-amber-300 bg-amber-50">
                                    <p className="font-semibold text-amber-800 mb-1 flex items-center gap-1.5 text-sm">
                                      <span>⚠</span> Duplicate Subscription Detected
                                    </p>
                                    <p className="text-amber-700 text-xs mb-3">
                                      This student already has an active subscription for this package{assignConflict.expiryDate ? ` (expires ${fmtDate(assignConflict.expiryDate)})` : ''}.
                                    </p>
                                    <div className="flex gap-2">
                                      <button onClick={() => setAssignConflict(null)} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-amber-300 bg-white text-amber-700">Cancel</button>
                                      <button onClick={() => handleAssign(true)} disabled={assignSubmitting} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#F59E0B' }}>
                                        Force Re-assign Anyway
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* ── STEP 1: FILTERS ── */}
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: BRAND.primary }}>Step 1 — Filter packages</p>
                                  <div className="space-y-2">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="text-[11px] font-medium text-gray-400 w-20 shrink-0">Age Band</span>
                                      {[{ code: '', label: 'All' }, ...AGE_BANDS].map(b => (
                                        <button key={b.code} onClick={() => { setAssignAgeBandFilter(b.code); setAssignPackageId(''); }}
                                          className="px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all"
                                          style={assignAgeBandFilter === b.code
                                            ? { backgroundColor: b.code ? BRAND.accent : BRAND.primary, borderColor: b.code ? BRAND.accent : BRAND.primary, color: '#fff' }
                                            : { backgroundColor: '#fff', borderColor: '#e5e7eb', color: '#6b7280' }}>
                                          {b.label}{(b as any).range ? ` (${(b as any).range})` : ''}
                                        </button>
                                      ))}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="text-[11px] font-medium text-gray-400 w-20 shrink-0">Type</span>
                                      {[{ v: '', l: 'All Types' }, { v: 'one_time', l: 'One-Time' }, { v: 'subscription', l: 'Subscription' }].map(opt => (
                                        <button key={opt.v} onClick={() => { setAssignSubTypeFilter(opt.v); setAssignPackageId(''); }}
                                          className="px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all"
                                          style={assignSubTypeFilter === opt.v
                                            ? { backgroundColor: BRAND.primary, borderColor: BRAND.primary, color: '#fff' }
                                            : { backgroundColor: '#fff', borderColor: '#e5e7eb', color: '#6b7280' }}>
                                          {opt.l}
                                        </button>
                                      ))}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] font-medium text-gray-400 w-20 shrink-0">Institution</span>
                                      <select value={assignInstitutionFilter} onChange={e => { setAssignInstitutionFilter(e.target.value); setAssignChildId(''); setAssignChildSearch(''); }}
                                        className="flex-1 text-xs border rounded-lg px-3 py-1.5 text-gray-700 bg-white">
                                        <option value="">All Institutions</option>
                                        {institutionsList.map((inst: any) => (
                                          <option key={inst.id} value={inst.id}>{inst.name}{inst.city ? ` — ${inst.city}` : ''}</option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                </div>

                                {/* ── STEP 2: PACKAGE SELECTION ── */}
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: BRAND.primary }}>
                                      Step 2 — Select package <span className="ml-1 normal-case font-normal text-gray-400">({filteredPkgs.length} available)</span>
                                    </p>
                                    <div className="flex items-center gap-1">
                                      {[{ k: 'recommended', l: '⭐ Best' }, { k: 'price_asc', l: '₹↑' }, { k: 'price_desc', l: '₹↓' }].map(s => (
                                        <button key={s.k} onClick={() => setAssignPkgSort(s.k as any)}
                                          className="px-2 py-0.5 rounded text-[10px] font-medium border transition-all"
                                          style={assignPkgSort === s.k
                                            ? { backgroundColor: BRAND.primary, borderColor: BRAND.primary, color: '#fff' }
                                            : { backgroundColor: '#fff', borderColor: '#e5e7eb', color: '#6b7280' }}>
                                          {s.l}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="relative mb-2">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                    <input value={assignPkgSearch} onChange={e => setAssignPkgSearch(e.target.value)}
                                      placeholder="Search packages by name or category..."
                                      className="w-full text-xs border rounded-lg pl-8 pr-8 py-2 text-gray-700 bg-white" />
                                    {assignPkgSearch && <button onClick={() => setAssignPkgSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-base leading-none">&times;</button>}
                                  </div>
                                  {filteredPkgs.length === 0 ? (
                                    <div className="text-center py-8 border-2 border-dashed rounded-xl">
                                      <p className="text-gray-400 text-sm mb-1.5">No packages match the selected filters</p>
                                      <button onClick={() => { setAssignAgeBandFilter(''); setAssignSubTypeFilter(''); setAssignPkgSearch(''); }} className="text-xs font-semibold" style={{ color: BRAND.primary }}>Clear filters</button>
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-1 gap-2 max-h-44 overflow-y-auto pr-1">
                                      {filteredPkgs.map((pkg: any) => {
                                        const isSelected = pkg.id === assignPackageId;
                                        return (
                                          <button key={pkg.id} onClick={() => setAssignPackageId(isSelected ? '' : pkg.id)}
                                            className="text-left p-3 rounded-xl border-2 transition-all w-full relative"
                                            style={isSelected ? { borderColor: BRAND.accent, backgroundColor: `${BRAND.accent}10` } : { borderColor: '#f3f4f6', backgroundColor: '#f9fafb' }}
                                            data-testid={`pkg-card-${pkg.id}`}>
                                            {pkg.isRecommended && (
                                              <span className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}>★ Recommended</span>
                                            )}
                                            <div className="flex items-start justify-between gap-3 pr-24">
                                              <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-gray-900 truncate">{pkg.productName}</p>
                                                <p className="text-[11px] text-gray-400">{pkg.category}</p>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${pkg.subscriptionType === 'one_time' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'}`}>
                                                    {pkg.subscriptionType === 'one_time' ? 'One-Time' : 'Subscription'}
                                                  </span>
                                                  {(pkg.ageBandCodes || []).map((b: string) => <span key={b} className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-600">Band {b}</span>)}
                                                  {pkg.validityDays && <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700">{pkg.validityDays}d</span>}
                                                  {pkg.questionCount && <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-50 text-green-700">{pkg.questionCount}Q</span>}
                                                </div>
                                              </div>
                                              <div className="text-right shrink-0">
                                                <p className="text-base font-bold" style={{ color: BRAND.primary }}>
                                                  {pkg.price != null ? `₹${Number(pkg.price).toLocaleString('en-IN')}` : 'Free'}
                                                </p>
                                                {isSelected && <CheckCircle className="h-4 w-4 ml-auto mt-1" style={{ color: BRAND.accent }} />}
                                              </div>
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>

                                {/* ── STEP 3: ASSIGNMENT DETAILS ── */}
                                {assignPackageId && (
                                  <div className="space-y-4 pt-4 border-t">
                                    <div className="flex items-center justify-between">
                                      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: BRAND.primary }}>Step 3 — Assignment details</p>
                                      <div className="flex rounded-lg border overflow-hidden text-[11px] font-medium">
                                        {[{ k: 'individual', l: 'Individual' }, { k: 'bulk', l: `Bulk (${filteredChildren.length})` }].map(m => (
                                          <button key={m.k} onClick={() => { setAssignMode(m.k as any); setAssignChildId(''); }}
                                            className="px-3 py-1.5 transition-colors"
                                            style={assignMode === m.k ? { backgroundColor: BRAND.primary, color: '#fff' } : { backgroundColor: '#fff', color: '#6b7280' }}>
                                            {m.l}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    {assignMode === 'bulk' ? (
                                      <div className="rounded-xl p-4 border-2 border-dashed" style={{ borderColor: `${BRAND.primary}30`, backgroundColor: `${BRAND.primary}05` }}>
                                        <p className="text-sm font-semibold text-gray-800 mb-1">
                                          Bulk assignment to <span style={{ color: BRAND.primary }}>{filteredChildren.length} student{filteredChildren.length !== 1 ? 's' : ''}</span>
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          {assignInstitutionFilter
                                            ? `Assigns "${selectedPkg?.productName}" to all students from the selected institution.`
                                            : 'Assigns this package to all students in the system. Consider selecting an institution filter above.'}
                                          {' '}Duplicates will be skipped automatically.
                                        </p>
                                      </div>
                                    ) : (
                                      <div>
                                        <div className="flex items-center justify-between mb-1">
                                          <label className="text-xs font-medium text-gray-700">Select Student <span className="text-red-400">*</span></label>
                                          <span className="text-[11px] text-gray-400">{filteredChildren.length} available</span>
                                        </div>
                                        <div className="relative mb-2">
                                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                          <input value={assignChildSearch} onChange={e => { setAssignChildSearch(e.target.value); setAssignChildId(''); }}
                                            placeholder="Search by name, grade, or school..."
                                            className="w-full text-xs border rounded-lg pl-8 pr-3 py-2 text-gray-700" />
                                        </div>
                                        <Select value={assignChildId} onValueChange={setAssignChildId}>
                                          <SelectTrigger className="text-sm" data-testid="select-assign-child">
                                            <SelectValue placeholder={filteredChildren.length === 0 ? 'No students match filters' : 'Choose a student...'} />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {filteredChildren.length === 0
                                              ? <div className="px-3 py-4 text-center text-xs text-gray-400">No students found</div>
                                              : filteredChildren.map((child: any) => (
                                                <SelectItem key={child.id} value={child.id}>
                                                  <span className="flex items-center gap-2">
                                                    <span>{child.name}{child.grade ? ` — ${child.grade}` : ''}</span>
                                                    {child.activeSubscriptions > 0 && (
                                                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">{child.activeSubscriptions} active</span>
                                                    )}
                                                  </span>
                                                </SelectItem>
                                              ))
                                            }
                                          </SelectContent>
                                        </Select>
                                        {assignChildId && assignChildActiveSubs.length > 0 && (
                                          <div className="mt-2 rounded-lg p-3 bg-amber-50 border border-amber-200">
                                            <p className="text-[11px] font-semibold text-amber-700 mb-1">⚠ Student has {assignChildActiveSubs.length} active subscription{assignChildActiveSubs.length > 1 ? 's' : ''}</p>
                                            <div className="space-y-1">
                                              {assignChildActiveSubs.slice(0, 3).map((s: any) => (
                                                <p key={s.id} className="text-[10px] text-amber-600">• {s.productName}{s.expiryDate ? ` (expires ${fmtDate(s.expiryDate)})` : ''}</p>
                                              ))}
                                            </div>
                                            {hasSamePkg && (
                                              <p className="text-[11px] font-bold text-red-600 mt-1.5">⛔ Already has this exact package</p>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                                        <input type="date" value={assignStartDate} onChange={e => setAssignStartDate(e.target.value)}
                                          className="w-full text-sm border rounded-lg px-3 py-2 text-gray-700"
                                          min={new Date().toISOString().split('T')[0]} />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Age Band Context</label>
                                        <select value={assignAgeBandFilter} onChange={e => setAssignAgeBandFilter(e.target.value)}
                                          className="w-full text-sm border rounded-lg px-3 py-2 text-gray-700 bg-white">
                                          <option value="">Not specified</option>
                                          {AGE_BANDS.map(b => <option key={b.code} value={b.code}>Band {b.label} ({b.range})</option>)}
                                        </select>
                                      </div>
                                    </div>

                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">Internal Notes <span className="text-gray-400 font-normal">(optional)</span></label>
                                      <textarea value={assignNotes} onChange={e => setAssignNotes(e.target.value)}
                                        placeholder="Reason for assignment, special instructions, coordinator notes..."
                                        className="w-full text-sm border rounded-lg px-3 py-2 text-gray-700 resize-none" rows={2} />
                                    </div>

                                    {/* ── ASSIGNMENT PREVIEW CARD ── */}
                                    {selectedPkg && (
                                      <div className="rounded-xl p-3.5 text-xs border" style={{ backgroundColor: `${BRAND.primary}06`, borderColor: `${BRAND.primary}25` }}>
                                        <p className="font-bold text-gray-700 mb-2.5 flex items-center gap-1.5">
                                          <CheckCircle className="h-3.5 w-3.5" style={{ color: BRAND.accent }} /> Assignment Preview
                                        </p>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                          <div><p className="text-gray-400 mb-0.5">Package</p><p className="font-semibold text-gray-800">{selectedPkg.productName}</p></div>
                                          <div><p className="text-gray-400 mb-0.5">Type</p><p className="font-medium capitalize">{(selectedPkg.subscriptionType || '').replace('_', ' ')}</p></div>
                                          <div><p className="text-gray-400 mb-0.5">Price</p><p className="font-bold" style={{ color: BRAND.primary }}>{selectedPkg.price != null ? `₹${Number(selectedPkg.price).toLocaleString('en-IN')}` : 'Free'}</p></div>
                                          <div><p className="text-gray-400 mb-0.5">Expires</p><p className="font-medium">{computedExpiry ? fmtDate(computedExpiry) : 'No expiry'}</p></div>
                                          {assignMode === 'individual' && selectedChild && (
                                            <div className="col-span-2"><p className="text-gray-400 mb-0.5">Student</p><p className="font-semibold text-gray-800">{selectedChild.name}{selectedChild.grade ? ` — ${selectedChild.grade}` : ''}</p></div>
                                          )}
                                          {assignMode === 'bulk' && (
                                            <div className="col-span-2"><p className="text-gray-400 mb-0.5">Recipients</p><p className="font-semibold text-gray-800">{filteredChildren.length} student{filteredChildren.length !== 1 ? 's' : ''}</p></div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* ── FOOTER ── */}
                              <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between shrink-0 rounded-b-2xl">
                                <p className="text-[11px] text-gray-400">
                                  {filteredPkgs.length} pkg{filteredPkgs.length !== 1 ? 's' : ''}
                                  {assignInstitutionFilter ? ` · ${filteredChildren.length} student${filteredChildren.length !== 1 ? 's' : ''}` : ''}
                                </p>
                                <div className="flex gap-2">
                                  <Button variant="outline" onClick={closeDialog} data-testid="btn-cancel-assign">Cancel</Button>
                                  <Button
                                    disabled={assignSubmitting || !assignPackageId || (assignMode === 'individual' && !assignChildId)}
                                    style={{ backgroundColor: assignSubmitting ? '#9ca3af' : BRAND.primary }}
                                    className="text-white min-w-36"
                                    data-testid="btn-confirm-assign"
                                    onClick={() => handleAssign(false)}
                                  >
                                    {assignSubmitting ? (
                                      <span className="flex items-center gap-2">
                                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Assigning...
                                      </span>
                                    ) : (
                                      <span className="flex items-center gap-1.5">
                                        <CheckCircle className="h-4 w-4" />
                                        {assignMode === 'bulk' ? `Assign to ${filteredChildren.length}` : 'Assign Package'}
                                      </span>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
  );
}
