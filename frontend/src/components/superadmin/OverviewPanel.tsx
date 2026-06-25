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

export default function OverviewPanel() {
  const p = useAdminDashboard();
  const {
    isAuthenticated, activeTab, setActiveTab, crisisPending, psyActiveSection, setPsyActiveSection,
    pauseStats, pauseStatsLoading,
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
                <div className="space-y-6">

                  {/* ── KPI Strip ── */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                    {[
                      { icon: Baby,       label: 'Students',        value: stats?.totalStudents ?? 0,        sub: `${stats?.adultLearners ?? 0} adults`,             color: '#6366F1', tab: 'parents' },
                      { icon: Users,      label: 'Parents',         value: stats?.totalParents ?? 0,         sub: `${stats?.newUsersThisMonth ?? 0} new this month`,  color: BRAND.primary, tab: 'parents' },
                      { icon: UserCheck,  label: 'Mentors',         value: stats?.totalMentors ?? 0,         sub: 'Active coaches',                                   color: BRAND.accent, tab: 'mentors' },
                      { icon: Calendar,   label: 'Sessions',        value: stats?.totalBookings ?? 0,        sub: `${stats?.completedBookings ?? 0} completed`,       color: '#0EA5E9', tab: 'mentors' },
                      { icon: HeartPulse, label: 'Wellness',        value: stats?.wellnessCheckins ?? 0,     sub: 'Check-ins logged',                                 color: '#EF4444', tab: 'students' },
                      { icon: Brain,      label: 'LBI Sessions',    value: stats?.lbiSessions ?? 0,          sub: 'Assessments done',                                 color: '#8B5CF6', tab: 'students' },
                      { icon: CreditCard, label: 'Subscriptions',   value: stats?.activeSubscriptions ?? subscriptionStats?.activeSubscriptions ?? 0, sub: formatCurrency(stats?.totalRevenue ?? 0), color: '#059669', tab: 'pricing' },
                      { icon: Building2,  label: 'Institutions',    value: stats?.totalInstitutes ?? 0,      sub: `${stats?.pendingInstituteApprovals ?? 0} pending`,  color: '#F59E0B', tab: 'institutions' },
                    ].map((s, i) => (
                      <button key={i} onClick={() => setActiveTab(s.tab)}
                        className="bg-white border border-[#E2E8F0] rounded-xl p-4 text-left hover:shadow-md hover:border-[#344E86]/30 transition-all group">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2.5" style={{ backgroundColor: `${s.color}18` }}>
                          <s.icon className="h-4.5 w-4.5" style={{ color: s.color }} />
                        </div>
                        <p className="text-2xl font-bold text-[#2E3440] leading-none">{s.value}</p>
                        <p className="text-xs font-semibold text-[#5F6C80] mt-1">{s.label}</p>
                        <p className="text-[11px] text-[#9AA4B2] mt-0.5 truncate">{s.sub}</p>
                      </button>
                    ))}
                  </div>

                  {/* ── Service Pulse Row ── */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Mentor Booking Breakdown */}
                    <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <Calendar className="h-4 w-4 text-[#0EA5E9]" />
                        <p className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide">Mentor Sessions</p>
                      </div>
                      <div className="space-y-2.5">
                        {[
                          { label: 'Total Booked',  value: stats?.totalBookings ?? 0,     color: '#0EA5E9' },
                          { label: 'Completed',      value: stats?.completedBookings ?? 0,  color: '#059669' },
                          { label: 'Confirmed',      value: stats?.confirmedBookings ?? 0,  color: '#6366F1' },
                          { label: 'Pending',        value: stats?.pendingBookings ?? 0,    color: '#F59E0B' },
                          { label: 'This Month',     value: stats?.bookingsThisMonth ?? 0,  color: BRAND.primary },
                        ].map((r) => (
                          <div key={r.label} className="flex items-center justify-between">
                            <span className="text-xs text-[#5F6C80]">{r.label}</span>
                            <span className="text-sm font-bold" style={{ color: r.color }}>{r.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Consent Health */}
                    <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                        <p className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide">Consent Health</p>
                      </div>
                      <div className="flex items-end gap-2 mb-3">
                        <p className="text-3xl font-bold text-[#2E3440]">{stats?.consentedStudents ?? 0}</p>
                        <p className="text-sm text-[#9AA4B2] mb-1">/ {(stats?.consentedStudents ?? 0) + (stats?.notConsentedStudents ?? 0)} students</p>
                      </div>
                      {(() => {
                        const total = (stats?.consentedStudents ?? 0) + (stats?.notConsentedStudents ?? 0);
                        const pct = total > 0 ? Math.round(((stats?.consentedStudents ?? 0) / total) * 100) : 0;
                        return (
                          <>
                            <div className="w-full bg-[#F1F5F9] rounded-full h-2 mb-2">
                              <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            <p className="text-xs text-[#9AA4B2]">{pct}% consented · {stats?.notConsentedStudents ?? 0} pending</p>
                          </>
                        );
                      })()}
                      <div className="mt-3 pt-3 border-t border-[#F1F5F9]">
                        <p className="text-xs text-[#5F6C80]">DPDP Act 2023 compliance required for all children under 18.</p>
                      </div>
                    </div>

                    {/* Platform Users */}
                    <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="h-4 w-4 text-[#344E86]" />
                        <p className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide">Platform Users</p>
                      </div>
                      <div className="space-y-2.5">
                        {[
                          { label: 'Total Users',      value: stats?.totalUsers ?? 0,          color: BRAND.primary },
                          { label: 'Active',           value: stats?.activeUsers ?? 0,          color: '#059669' },
                          { label: 'Adult Learners',   value: stats?.adultLearners ?? 0,        color: '#6366F1' },
                          { label: 'New (30 days)',    value: stats?.newUsersThisMonth ?? 0,    color: BRAND.accent },
                          { label: 'Institutions',     value: stats?.totalInstitutes ?? 0,     color: '#F59E0B' },
                        ].map((r) => (
                          <div key={r.label} className="flex items-center justify-between">
                            <span className="text-xs text-[#5F6C80]">{r.label}</span>
                            <span className="text-sm font-bold" style={{ color: r.color }}>{r.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* ── Pending Approvals + Recent Sessions ── */}
                  <div className="grid lg:grid-cols-2 gap-4">

                    {/* Pending Approvals */}
                    <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9]">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-amber-500" />
                          <p className="text-sm font-semibold text-[#2E3440]">Pending Approvals</p>
                          {onboardingApprovals.filter((a: any) => a.status === 'pending').length > 0 && (
                            <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                              {onboardingApprovals.filter((a: any) => a.status === 'pending').length}
                            </span>
                          )}
                        </div>
                        <button onClick={() => { setActiveTab('usermgmt'); setUserMgmtView('onboarding'); }} className="text-xs font-medium text-[#344E86] hover:underline">View all</button>
                      </div>
                      <div className="divide-y divide-[#F8FAFC]">
                        {onboardingApprovals.filter((a: any) => a.status === 'pending').slice(0, 5).map((item: any) => (
                          <div key={item.id} className="flex items-center justify-between px-5 py-3 hover:bg-[#F8FAFC] transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                                <UserPlus className="h-4 w-4 text-amber-600" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-[#2E3440] truncate">{item.entityName}</p>
                                <p className="text-xs text-[#9AA4B2]">{formatEntityType(item.entityType)} · {formatDate(item.submittedAt)}</p>
                              </div>
                            </div>
                            <button onClick={() => { setActiveTab('usermgmt'); setUserMgmtView('onboarding'); }}
                              className="text-xs font-medium text-[#344E86] border border-[#E2E8F0] px-2.5 py-1 rounded-lg hover:bg-[#F5F7FA] flex-shrink-0">
                              Review
                            </button>
                          </div>
                        ))}
                        {onboardingApprovals.filter((a: any) => a.status === 'pending').length === 0 && (
                          <div className="px-5 py-10 text-center text-sm text-[#9AA4B2]">No pending approvals</div>
                        )}
                      </div>
                    </div>

                    {/* Recent Mentor Sessions */}
                    <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9]">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-[#0EA5E9]" />
                          <p className="text-sm font-semibold text-[#2E3440]">Recent Mentor Sessions</p>
                        </div>
                        <button onClick={() => setActiveTab('mentors')} className="text-xs font-medium text-[#344E86] hover:underline">View all</button>
                      </div>
                      <div className="divide-y divide-[#F8FAFC]">
                        {(stats?.recentBookings || []).length === 0 ? (
                          <div className="px-5 py-10 text-center text-sm text-[#9AA4B2]">No sessions booked yet</div>
                        ) : (stats?.recentBookings || []).map((b: any) => (
                          <div key={b.id} className="flex items-center justify-between px-5 py-3 hover:bg-[#F8FAFC] transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                                <UserCheck className="h-4 w-4 text-[#0EA5E9]" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-[#2E3440] truncate">{b.childName} <span className="text-[#9AA4B2] font-normal">with</span> {b.mentorName}</p>
                                <p className="text-xs text-[#9AA4B2]">{b.slotDate ? new Date(b.slotDate).toLocaleDateString('en-IN') : '—'} · {b.startTime} · <span className="capitalize">{b.mode}</span></p>
                              </div>
                            </div>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                              b.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                              b.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                              b.status === 'pending'   ? 'bg-amber-100 text-amber-700' :
                              'bg-gray-100 text-gray-500'}`}>{b.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* ── Quick Actions ── */}
                  <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Zap className="h-4 w-4 text-[#4ECDC4]" />
                      <p className="text-sm font-semibold text-[#2E3440]">Quick Actions</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                      {[
                        { label: 'Parent Registry',   icon: Users,        tab: 'parents',       color: BRAND.primary },
                        { label: 'Student Registry',  icon: Baby,         tab: 'students',      color: '#6366F1' },
                        { label: 'Mentor Roster',     icon: UserCheck,    tab: 'mentors',       color: BRAND.accent },
                        { label: 'Institutions',      icon: Building2,    tab: 'institutions',  color: '#F59E0B' },
                        { label: 'Subscriptions',     icon: CreditCard,   tab: 'pricing',       color: '#8B5CF6' },
                        { label: 'LBI Assessments',   icon: Brain,        tab: 'behavior',      color: '#8B5CF6' },
                        { label: 'Wellness Logs',     icon: HeartPulse,   tab: 'students',      color: '#EF4444' },
                        { label: 'Financials',        icon: DollarSign,   tab: 'financials',    color: '#059669' },
                      ].map((a, i) => (
                        <button key={i} onClick={() => setActiveTab(a.tab)}
                          className="flex flex-col items-center gap-2 p-3 rounded-xl border border-[#E2E8F0] hover:shadow-sm hover:border-[#344E86]/30 transition-all text-center group">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${a.color}18` }}>
                            <a.icon className="h-4 w-4" style={{ color: a.color }} />
                          </div>
                          <p className="text-[11px] font-medium text-[#5F6C80] leading-tight">{a.label}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── Subscription & LBI Vitals ── */}
                  <div className="grid lg:grid-cols-2 gap-4">
                    {/* Subscription breakdown */}
                    <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-[#8B5CF6]" />
                          <p className="text-sm font-semibold text-[#2E3440]">Subscription Overview</p>
                        </div>
                        <button onClick={() => setActiveTab('pricing')} className="text-xs font-medium text-[#344E86] hover:underline">Manage</button>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        {[
                          { label: 'Total Packages',  value: subscriptionStats.totalPackages,      color: '#8B5CF6', bg: 'bg-purple-50' },
                          { label: 'Active Packages', value: subscriptionStats.activePackages,     color: '#059669', bg: 'bg-emerald-50' },
                          { label: 'Total Subs',      value: stats?.totalSubscriptions ?? subscriptionStats.totalSubscriptions, color: BRAND.accent, bg: `bg-[${BRAND.accent}10]` },
                          { label: 'Active Subs',     value: stats?.activeSubscriptions ?? subscriptionStats.activeSubscriptions, color: BRAND.primary, bg: `bg-[${BRAND.primary}10]` },
                        ].map((c, i) => (
                          <div key={i} className={`text-center p-3 rounded-xl ${c.bg || 'bg-gray-50'}`}>
                            <p className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</p>
                            <p className="text-xs text-[#9AA4B2] mt-0.5">{c.label}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-[#344E86]/5 border border-[#344E86]/10">
                        <span className="text-xs font-semibold text-[#5F6C80]">Revenue from Active Subs</span>
                        <span className="text-base font-bold text-[#344E86]">{formatCurrency(stats?.totalRevenue ?? 0)}</span>
                      </div>
                    </div>

                    {/* Platform health */}
                    <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <Shield className="h-4 w-4 text-[#344E86]" />
                        <p className="text-sm font-semibold text-[#2E3440]">Platform Health</p>
                      </div>
                      <div className="space-y-2">
                        {[
                          { label: 'Documents on Record',   value: documentsData?.length || 0,       icon: FileText,    color: '#059669' },
                          { label: 'Security Incidents',    value: securityIncidents?.length || 0,   icon: Shield,      color: '#EF4444' },
                          { label: 'Audit Log Entries',     value: auditLogs?.length || 0,           icon: ScrollText,  color: BRAND.primary },
                          { label: 'Pending Onboarding',   value: (stats?.pendingInstituteApprovals ?? 0) + (stats?.pendingParentApprovals ?? 0), icon: Clock, color: '#F59E0B' },
                          { label: 'Consent Gaps',          value: stats?.notConsentedStudents ?? 0, icon: AlertTriangle, color: '#EF4444' },
                        ].map((row, i) => (
                          <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#F1F5F9]">
                            <div className="flex items-center gap-2">
                              <row.icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: row.color }} />
                              <span className="text-xs text-[#5F6C80]">{row.label}</span>
                            </div>
                            <span className="text-sm font-bold" style={{ color: row.color }}>{row.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* ── Pause Analytics ── */}
                  <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-[#4ECDC4]" />
                        <p className="text-sm font-semibold text-[#2E3440]">Pause Usage Trends</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="text-xs text-[#9AA4B2]">From</label>
                        <input
                          type="date"
                          value={pauseFrom}
                          onChange={e => setPauseFrom(e.target.value)}
                          className="text-xs border border-[#E2E8F0] rounded-lg px-2 py-1 text-[#2E3440] focus:outline-none focus:ring-1 focus:ring-[#344E86]"
                        />
                        <label className="text-xs text-[#9AA4B2]">To</label>
                        <input
                          type="date"
                          value={pauseTo}
                          onChange={e => setPauseTo(e.target.value)}
                          className="text-xs border border-[#E2E8F0] rounded-lg px-2 py-1 text-[#2E3440] focus:outline-none focus:ring-1 focus:ring-[#344E86]"
                        />
                      </div>
                    </div>

                    {pauseStatsLoading ? (
                      <div className="flex items-center justify-center py-10 text-sm text-[#9AA4B2]">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
                      </div>
                    ) : (
                      <>
                        {/* KPI row */}
                        <div className="grid grid-cols-3 gap-3 mb-5">
                          {[
                            { label: 'Sessions Started', value: pauseStats?.started ?? 0, color: '#344E86' },
                            { label: 'Sessions Completed', value: pauseStats?.completed ?? 0, color: '#059669' },
                            {
                              label: 'Completion Rate',
                              value: pauseStats && pauseStats.started > 0
                                ? `${Math.round((pauseStats.completed / pauseStats.started) * 100)}%`
                                : '—',
                              color: '#4ECDC4',
                            },
                          ].map(kpi => (
                            <div key={kpi.label} className="text-center p-3 rounded-xl bg-[#F8FAFC] border border-[#F1F5F9]">
                              <p className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
                              <p className="text-xs text-[#9AA4B2] mt-0.5">{kpi.label}</p>
                            </div>
                          ))}
                        </div>

                        {/* Daily trend chart */}
                        {(!pauseStats?.trend || pauseStats.trend.length === 0) ? (
                          <p className="text-center text-sm text-[#9AA4B2] py-6">No data for selected range</p>
                        ) : (
                          <div>
                            <p className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide mb-3">Daily Breakdown</p>
                            <div className="space-y-2">
                              {(() => {
                                const maxVal = Math.max(...(pauseStats?.trend ?? []).map(d => Math.max(d.started, d.completed)), 1);
                                return (pauseStats?.trend ?? []).map(day => {
                                  const completionRate = day.started > 0 ? Math.round((day.completed / day.started) * 100) : 0;
                                  return (
                                    <div key={day.date} className="flex items-center gap-2">
                                      <span className="text-[11px] text-[#9AA4B2] w-20 flex-shrink-0">{day.date.slice(5)}</span>
                                      <div className="flex-1 flex flex-col gap-0.5">
                                        <div className="h-3 rounded-full overflow-hidden bg-[#F1F5F9] relative">
                                          <div
                                            className="h-full rounded-full transition-all"
                                            style={{ width: `${Math.round((day.started / maxVal) * 100)}%`, backgroundColor: '#344E86' }}
                                          />
                                        </div>
                                        <div className="h-3 rounded-full overflow-hidden bg-[#F1F5F9] relative">
                                          <div
                                            className="h-full rounded-full transition-all"
                                            style={{ width: `${Math.round((day.completed / maxVal) * 100)}%`, backgroundColor: '#059669' }}
                                          />
                                        </div>
                                      </div>
                                      <span className="text-[11px] text-[#9AA4B2] w-12 text-right flex-shrink-0">{day.started}s / {day.completed}c</span>
                                      <span className="text-[11px] font-semibold w-8 text-right flex-shrink-0" style={{ color: '#4ECDC4' }}>{completionRate}%</span>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#F1F5F9]">
                              <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-[#344E86]" />
                                <span className="text-xs text-[#9AA4B2]">Started</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-[#059669]" />
                                <span className="text-xs text-[#9AA4B2]">Completed</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-[#4ECDC4]" />
                                <span className="text-xs text-[#9AA4B2]">Completion %</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                </div>
  );
}
