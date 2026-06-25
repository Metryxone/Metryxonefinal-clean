import { BRAND } from '@/design-system/tokens';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield, Building2, Users, Briefcase, CreditCard,
  CheckCircle, XCircle, Clock, AlertTriangle, Settings,
  FileText, UserCheck, DollarSign, TrendingUp, Activity,
  Eye, UserPlus, Ban, RefreshCw, Search, Filter, LayoutGrid, LayoutList,
  Key, KeyRound, Lock, Unlock, ScrollText, BookOpen, Wallet, Receipt,
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
import { VirtualizedTable } from './VirtualizedTable';


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

export default function SecurityPanel() {
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

  // STEP 12 (visibility-only) — read-only security surfaces.
  // Active sessions come from the live express-session store via the existing
  // (now repaired) /api/admin/sessions endpoint. No fabricated session rows.
  const { data: sessionData, isLoading: sessionsLoading, refetch: refetchSessions } = useQuery<any>({
    queryKey: ['/api/admin/sessions'],
    queryFn: async () => {
      const res = await fetch('/api/admin/sessions', { credentials: 'include' });
      if (!res.ok) return { sessions: [], total: 0, authenticatedCount: 0, anonymousCount: 0, empty: true };
      return res.json();
    },
    enabled: isAuthenticated && activeTab === 'security',
  });
  const activeSessions: any[] = Array.isArray(sessionData?.sessions) ? sessionData.sessions : [];

  // Permission matrix: formal RBAC tables surfaced as-is + the live super_admin
  // enforcement reality. Read-only; changes no access.
  const { data: permMatrix, isLoading: permLoading, refetch: refetchPermMatrix } = useQuery<any>({
    queryKey: ['/api/admin/security/permission-matrix'],
    queryFn: async () => {
      const res = await fetch('/api/admin/security/permission-matrix', { credentials: 'include' });
      if (!res.ok) return { roles: [], permissions: [], grants: [], liveReality: { rolesInUse: [] } };
      return res.json();
    },
    enabled: isAuthenticated && activeTab === 'security' && securityView === 'access',
  });

  return (
    <>
              {activeTab === 'security' && (
                <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-xl p-1 max-w-sm shadow-sm">
                  {([
                    { view: 'security' as const, Icon: ShieldCheck, label: 'Security' },
                    { view: 'audit'    as const, Icon: FileText,    label: 'Audit Logs' },
                    { view: 'access'   as const, Icon: Key,         label: 'Access Control' },
                  ]).map(({ view, Icon, label }) => (
                    <button
                      key={view}
                      onClick={() => setSecurityView(view)}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        securityView === view ? 'text-white shadow-sm' : 'text-gray-600 hover:text-gray-800'
                      }`}
                      style={securityView === view ? { backgroundColor: BRAND.primary } : {}}
                    >
                      <Icon className="h-4 w-4" /> {label}
                    </button>
                  ))}
                </div>
              )}

              {/* Security Tab - Enhanced SOC2/ISO Dashboard */}
              {activeTab === 'security' && securityView === 'security' && (() => {
                const activeIncidents = securityIncidents.filter((i: any) => i.status !== 'resolved' && i.status !== 'closed');
                const securityScore = securityConfig.length > 0
                  ? Math.round(securityConfig.filter((c: any) => c.configValue === 'true' || c.configValue === 'enabled').length / Math.max(securityConfig.length, 1) * 100)
                  : 0;
                return (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Security & Audit</h3>
                      <p className="text-sm text-gray-500">SOC2 Type II and ISO 27001 compliance dashboard</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        style={{ backgroundColor: BRAND.primary }}
                        className="text-white gap-1"
                        data-testid="button-report-incident"
                        onClick={() => setReportIncidentDialog(true)}
                      >
                        <Plus className="h-4 w-4" /> Report Incident
                      </Button>
                      <Badge variant="outline" className="gap-1 px-3 py-1" data-testid="badge-security-status">
                        <ShieldCheck className="h-4 w-4 text-green-500" />
                        {activeIncidents.length === 0 ? 'All Systems Secure' : `${activeIncidents.length} Active Incident${activeIncidents.length > 1 ? 's' : ''}`}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Security Score</p>
                            <p className="text-2xl font-bold text-green-600" data-testid="text-security-score">{securityScore}%</p>
                          </div>
                          <ShieldCheck className="h-8 w-8 text-green-500" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Active Incidents</p>
                            <p className="text-2xl font-bold text-orange-600" data-testid="text-active-incidents">{activeIncidents.length}</p>
                          </div>
                          <AlertTriangle className="h-8 w-8 text-orange-500" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Total Incidents</p>
                            <p className="text-2xl font-bold" style={{ color: BRAND.primary }} data-testid="text-total-incidents">{securityIncidents.length}</p>
                          </div>
                          <Lock className="h-8 w-8" style={{ color: BRAND.primary }} />
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Retention Policies</p>
                            <p className="text-2xl font-bold" style={{ color: BRAND.accent }} data-testid="text-retention-count">{retentionPolicies.length}</p>
                          </div>
                          <Database className="h-8 w-8" style={{ color: BRAND.accent }} />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2">
                            <Fingerprint className="h-5 w-5" style={{ color: BRAND.primary }} />
                            Active Sessions
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" data-testid="badge-session-count">{activeSessions.length} active</Badge>
                            <Button variant="ghost" size="sm" onClick={() => refetchSessions()} data-testid="button-refresh-sessions">
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-gray-400 mb-3">
                          Live from the server session store (unexpired sessions). User-agent/device details are not stored in this session store, so they are not shown.
                        </p>
                        <div className="space-y-3 max-h-80 overflow-y-auto">
                          {sessionsLoading ? (
                            <div className="p-6 text-center text-gray-400" data-testid="sessions-loading">
                              <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin" /> Loading sessions…
                            </div>
                          ) : activeSessions.length === 0 ? (
                            <div className="p-6 text-center text-gray-500" data-testid="text-no-sessions">
                              <Fingerprint className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                              No active sessions found
                            </div>
                          ) : (
                            activeSessions.map((s: any, idx: number) => (
                              <div key={s.sid || idx} className="flex items-center justify-between p-3 rounded-xl bg-gray-50" data-testid={`session-row-${idx}`}>
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: s.authenticated ? `${BRAND.accent}20` : '#e5e7eb' }}>
                                    {s.authenticated ? <UserCheck className="h-5 w-5" style={{ color: BRAND.accent }} /> : <UserCircle2 className="h-5 w-5 text-gray-400" />}
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm">{s.authenticated ? (s.email || s.fullName || s.userId) : 'Anonymous session'}</p>
                                    <p className="text-xs text-gray-500">
                                      {s.role ? `${s.role} • ` : ''}Expires {formatDateTime(s.expire)}
                                    </p>
                                  </div>
                                </div>
                                <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: s.authenticated ? `${BRAND.accent}20` : '#f3f4f6', color: s.authenticated ? BRAND.accent : '#6b7280' }}>
                                  {s.authenticated ? 'Authenticated' : 'Anonymous'}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-orange-500" />
                            Security Incidents
                          </CardTitle>
                          <Select value={securityIncidentFilter} onValueChange={setSecurityIncidentFilter}>
                            <SelectTrigger className="w-32" data-testid="select-incident-filter">
                              <SelectValue placeholder="Filter" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All</SelectItem>
                              <SelectItem value="investigating">Investigating</SelectItem>
                              <SelectItem value="monitoring">Monitoring</SelectItem>
                              <SelectItem value="resolved">Resolved</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {securityIncidents.length === 0 ? (
                            <div className="p-6 text-center text-gray-500" data-testid="text-no-incidents">
                              <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-green-300" />
                              No security incidents found
                            </div>
                          ) : (
                            securityIncidents.map((incident: any, index: number) => (
                              <div key={incident.id || index} className="flex items-center justify-between p-3 rounded-xl bg-gray-50" data-testid={`incident-row-${incident.id || index}`}>
                                <div className="flex items-center gap-3">
                                  <AlertTriangle className={`h-5 w-5 ${incident.severity === 'critical' || incident.severity === 'high' ? 'text-red-500' : incident.severity === 'medium' ? 'text-orange-500' : 'text-yellow-500'}`} />
                                  <div>
                                    <p className="font-medium text-sm">{incident.title || incident.incidentType || `INC-${String(index + 1).padStart(3, '0')}`}</p>
                                    <p className="text-xs text-gray-500">{incident.description || incident.incidentType}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant={incident.severity === 'critical' || incident.severity === 'high' ? 'destructive' : 'outline'}>{incident.severity}</Badge>
                                  <Badge variant="outline">{incident.status}</Badge>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className="border-b">
                      <CardTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5" style={{ color: BRAND.primary }} />
                        Data Retention Policies
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {retentionPolicies.length === 0 ? (
                        <div className="p-8 text-center text-gray-500" data-testid="text-no-retention-policies">
                          <Database className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                          No retention policies configured
                        </div>
                      ) : (
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Policy</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Data Type</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Retention Period</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {retentionPolicies.map((policy: any, index: number) => (
                            <tr key={policy.id || index} className="hover:bg-gray-50" data-testid={`retention-row-${policy.id || index}`}>
                              <td className="px-4 py-3 font-medium">{policy.policyName || policy.name}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{policy.dataType || policy.type}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{policy.retentionPeriod || policy.period}</td>
                              <td className="px-4 py-3">
                                <Badge variant="default" className={policy.status === 'active' ? 'bg-green-500' : ''}>{policy.status}</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      )}
                    </CardContent>
                  </Card>

                  <Dialog open={reportIncidentDialog} onOpenChange={setReportIncidentDialog}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Report Security Incident</DialogTitle>
                        <DialogDescription>Create a new security incident report</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Title</Label>
                          <Input
                            value={newIncidentData.title}
                            onChange={(e) => setNewIncidentData(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="Incident title"
                            data-testid="input-incident-title"
                          />
                        </div>
                        <div>
                          <Label>Type</Label>
                          <Input
                            value={newIncidentData.incidentType}
                            onChange={(e) => setNewIncidentData(prev => ({ ...prev, incidentType: e.target.value }))}
                            placeholder="e.g. Failed Login, Unauthorized Access"
                            data-testid="input-incident-type"
                          />
                        </div>
                        <div>
                          <Label>Severity</Label>
                          <Select value={newIncidentData.severity} onValueChange={(val) => setNewIncidentData(prev => ({ ...prev, severity: val }))}>
                            <SelectTrigger data-testid="select-incident-severity">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="critical">Critical</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Description</Label>
                          <Textarea
                            value={newIncidentData.description}
                            onChange={(e) => setNewIncidentData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Describe the security incident..."
                            data-testid="input-incident-description"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setReportIncidentDialog(false)} data-testid="button-cancel-incident">Cancel</Button>
                        <Button
                          style={{ backgroundColor: BRAND.primary }}
                          className="text-white"
                          data-testid="button-submit-incident"
                          onClick={async () => {
                            try {
                              const res = await fetch('/api/admin/security/incidents', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify(newIncidentData),
                              });
                              if (!res.ok) throw new Error('Failed to report incident');
                              queryClient.invalidateQueries({ queryKey: ['/api/admin/security/incidents'] });
                              toast({ title: 'Incident Reported', description: 'Security incident has been created successfully.' });
                              setReportIncidentDialog(false);
                              setNewIncidentData({ title: '', description: '', severity: 'low', incidentType: '' });
                            } catch (error: any) {
                              toast({ title: 'Error', description: error.message, variant: 'destructive' });
                            }
                          }}
                        >
                          Submit Report
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                );
              })()}

              {/* Audit Logs Tab */}
              {activeTab === 'security' && securityView === 'audit' && (() => {
                const todayStr = new Date().toISOString().split('T')[0];
                const todayLogs = auditLogs.filter((log: any) => log.createdAt && new Date(log.createdAt).toISOString().split('T')[0] === todayStr);
                const securityLogs = auditLogs.filter((log: any) => log.targetType === 'security' || log.actionType?.includes('security'));
                const filteredAuditLogs = auditLogs.filter((log: any) => {
                  if (auditDateFrom && log.createdAt && new Date(log.createdAt) < new Date(auditDateFrom)) return false;
                  if (auditDateTo && log.createdAt && new Date(log.createdAt) > new Date(auditDateTo + 'T23:59:59')) return false;
                  return true;
                });
                const handleExportAuditLogs = async () => {
                  try {
                    const params = new URLSearchParams();
                    params.append('format', auditExportFormat);
                    if (auditDateFrom) params.append('startDate', auditDateFrom);
                    if (auditDateTo) params.append('endDate', auditDateTo);
                    const res = await fetch(`/api/admin/audit/export?${params.toString()}`, { credentials: 'include' });
                    if (!res.ok) throw new Error('Export failed');
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `audit-logs-${todayStr}.${auditExportFormat}`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    toast({ title: 'Export Complete', description: `Audit logs exported as ${auditExportFormat.toUpperCase()}` });
                  } catch (error: any) {
                    toast({ title: 'Export Failed', description: error.message, variant: 'destructive' });
                  }
                };
                return (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Administrative Audit Trail</h3>
                      <p className="text-sm text-gray-500">Append-only record of administrative actions</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Total Logs</p>
                            <p className="text-2xl font-bold" data-testid="text-total-logs">{auditLogs.length.toLocaleString()}</p>
                          </div>
                          <FileText className="h-8 w-8" style={{ color: BRAND.primary }} />
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Today</p>
                            <p className="text-2xl font-bold text-green-600" data-testid="text-today-logs">{todayLogs.length}</p>
                          </div>
                          <Activity className="h-8 w-8 text-green-500" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Security Events</p>
                            <p className="text-2xl font-bold text-orange-600" data-testid="text-security-events">{securityLogs.length}</p>
                          </div>
                          <AlertTriangle className="h-8 w-8 text-orange-500" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className="border-b">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>Audit Logs</CardTitle>
                          <CardDescription>Complete trail of administrative actions</CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Select value={auditCategoryFilter} onValueChange={setAuditCategoryFilter}>
                            <SelectTrigger className="w-36" data-testid="select-audit-category">
                              <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Categories</SelectItem>
                              <SelectItem value="authentication">Authentication</SelectItem>
                              <SelectItem value="document">Document</SelectItem>
                              <SelectItem value="onboarding">Onboarding</SelectItem>
                              <SelectItem value="security">Security</SelectItem>
                              <SelectItem value="data_access">Data Access</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input type="date" className="w-36" value={auditDateFrom} onChange={(e) => setAuditDateFrom(e.target.value)} data-testid="input-audit-date-from" />
                          <Input type="date" className="w-36" value={auditDateTo} onChange={(e) => setAuditDateTo(e.target.value)} data-testid="input-audit-date-to" />
                          <Button variant="outline" onClick={() => refetchAuditLogs()} data-testid="button-refresh-audit">
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Select value={auditExportFormat} onValueChange={setAuditExportFormat}>
                            <SelectTrigger className="w-28" data-testid="select-export-format">
                              <SelectValue placeholder="Format" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="csv">CSV</SelectItem>
                              <SelectItem value="json">JSON</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button variant="outline" data-testid="button-export-logs" onClick={handleExportAuditLogs}>
                            <Download className="h-4 w-4 mr-2" /> Export
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <VirtualizedTable
                        items={filteredAuditLogs}
                        rowHeight={52}
                        height={Math.min(560, Math.max(160, filteredAuditLogs.length * 52))}
                        rowKey={(log: any) => log.id}
                        data-testid="virtualized-audit-logs"
                        header={
                          <div className="grid grid-cols-[100px_1fr_1fr_1fr_120px_170px_120px] px-4 py-3 text-left text-sm font-medium text-gray-500">
                            <div>Log ID</div><div>Action</div><div>Actor</div><div>Resource</div><div>Category</div><div>Timestamp</div><div>Hash</div>
                          </div>
                        }
                        emptyState={
                          <div className="px-4 py-12 text-center text-gray-500" data-testid="text-no-audit-logs">
                            <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                            No audit logs found{auditCategoryFilter !== 'all' || auditDateFrom || auditDateTo ? ' matching current filters' : ''}
                          </div>
                        }
                        renderRow={(log: any) => (
                          <div className="grid grid-cols-[100px_1fr_1fr_1fr_120px_170px_120px] items-center px-4 h-full border-b hover:bg-gray-50" data-testid={`audit-row-${log.id}`}>
                            <div className="font-mono text-xs truncate" style={{ color: BRAND.primary }}>{log.id?.slice(0, 8)}</div>
                            <div className="font-medium capitalize truncate pr-2">{log.actionType?.replace(/_/g, ' ') || 'Action'}</div>
                            <div className="text-sm text-gray-600 truncate pr-2">{log.actorName || 'System'}</div>
                            <div className="text-sm text-gray-600 truncate pr-2">{log.targetType || 'N/A'}</div>
                            <div><Badge variant="outline">{log.category || log.targetType || 'general'}</Badge></div>
                            <div className="text-sm text-gray-500 truncate pr-2">{formatDateTime(log.createdAt)}</div>
                            <div className="font-mono text-xs text-gray-400 truncate" title="Immutable hash">{log.logHash?.slice(0, 12) || '—'}</div>
                          </div>
                        )}
                      />
                      <div className="p-4 border-t flex items-center justify-between">
                        <p className="text-sm text-gray-500" data-testid="text-audit-count">Showing {filteredAuditLogs.length} of {auditLogs.length} logs</p>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" disabled>Previous</Button>
                          <Button variant="outline" size="sm" disabled={filteredAuditLogs.length <= 100}>Next</Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                </div>
                );
              })()}

              {activeTab === 'security' && securityView === 'access' && (
                <div className="space-y-6" data-testid="view-access-control">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <Key className="h-5 w-5" style={{ color: BRAND.primary }} />
                            Live Access Reality
                          </CardTitle>
                          <CardDescription>
                            Roles currently enforced by the running application (derived from real user accounts). Read-only.
                          </CardDescription>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => refetchPermMatrix()} data-testid="button-refresh-permmatrix">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {permLoading ? (
                        <div className="p-6 text-center text-gray-400" data-testid="permmatrix-loading">
                          <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin" /> Loading access model…
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-3" data-testid="roles-in-use">
                          {(permMatrix?.liveReality?.rolesInUse || []).length === 0 ? (
                            <span className="text-gray-500 text-sm">No role data available.</span>
                          ) : (
                            (permMatrix.liveReality.rolesInUse).map((r: any, i: number) => (
                              <div key={r.role || i} className="px-4 py-3 rounded-xl bg-gray-50 border" data-testid={`role-usage-${i}`}>
                                <p className="font-semibold capitalize" style={{ color: BRAND.primary }}>{(r.role || 'unknown').replace(/_/g, ' ')}</p>
                                <p className="text-xs text-gray-500">{r.users} user{r.users === 1 ? '' : 's'}</p>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5" style={{ color: BRAND.primary }} />
                        Formal Permission Matrix
                      </CardTitle>
                      <CardDescription>
                        Declared roles × permissions from the RBAC tables. The platform currently enforces a single super-admin model; an empty matrix here is an honest reflection that no granular RBAC grants are configured yet.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {permLoading ? (
                        <div className="p-6 text-center text-gray-400">
                          <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin" /> Loading matrix…
                        </div>
                      ) : (permMatrix?.roles || []).length === 0 || (permMatrix?.permissions || []).length === 0 ? (
                        <div className="p-8 text-center text-gray-500" data-testid="text-no-matrix">
                          <KeyRound className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                          No granular RBAC roles/permissions are configured.
                          <p className="text-xs text-gray-400 mt-1">Access is governed by the single super-admin model shown above.</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm border-collapse" data-testid="table-permission-matrix">
                            <thead>
                              <tr>
                                <th className="text-left p-2 border-b sticky left-0 bg-white">Role \ Permission</th>
                                {(permMatrix.permissions).map((perm: any) => (
                                  <th key={perm.id || perm.permission_key} className="p-2 border-b text-xs font-medium text-gray-600 whitespace-nowrap">{perm.display_name || perm.permission_key}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(permMatrix.roles).map((role: any) => {
                                const grantSet = new Set(
                                  (permMatrix.grants || [])
                                    .filter((g: any) => g.role_id === role.id || g.role_name === role.name)
                                    .map((g: any) => g.permission_id ?? g.permission_name)
                                );
                                return (
                                  <tr key={role.id || role.name} data-testid={`matrix-role-${role.id || role.name}`}>
                                    <td className="p-2 border-b font-medium capitalize sticky left-0 bg-white">{(role.name || role.role_name || '').replace(/_/g, ' ')}</td>
                                    {(permMatrix.permissions).map((perm: any) => {
                                      const granted = grantSet.has(perm.id) || grantSet.has(perm.name);
                                      return (
                                        <td key={perm.id || perm.name} className="p-2 border-b text-center">
                                          {granted ? <CheckCircle className="h-4 w-4 mx-auto text-green-600" /> : <span className="text-gray-300">—</span>}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

    </>
  );
}
