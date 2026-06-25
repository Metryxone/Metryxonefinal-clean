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

export default function ParentsPanel() {
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

                const filteredParents = parents.filter(p => {
                  const matchSearch = !parentSearch ||
                    p.fullName?.toLowerCase().includes(parentSearch.toLowerCase()) ||
                    p.email?.toLowerCase().includes(parentSearch.toLowerCase()) ||
                    p.mobile?.includes(parentSearch);
                  const matchSub = parentSubFilter === 'all' ||
                    (parentSubFilter === 'active' && p.subscriptionStatus === 'active') ||
                    (parentSubFilter === 'expired' && p.subscriptionStatus !== 'active') ||
                    (parentSubFilter === 'no_sub' && !p.subscriptionPlan);
                  return matchSearch && matchSub;
                });
                return (
                  <div className="flex h-[calc(100vh-120px)] bg-[#F8F9FB]">
                    {/* Registry Panel */}
                    <div className="w-[300px] flex-shrink-0 border-r border-[#E2E8F0] bg-white flex flex-col">
                      <div className="px-4 py-4 border-b border-[#E2E8F0]">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide">Parent Registry</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[#9AA4B2] tabular-nums">{filteredParents.length} / {parents.length}</span>
                            <div className="relative group">
                              <button className="flex items-center gap-1 text-xs font-medium text-[#344E86] border border-[#344E86]/30 px-2 py-1 rounded-lg hover:bg-[#344E86]/5 transition-colors">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                                Export
                              </button>
                              <div className="absolute right-0 top-7 bg-white border border-[#E2E8F0] rounded-xl shadow-lg z-20 py-1 min-w-[120px] hidden group-hover:block">
                                {(['csv','xlsx','pdf'] as const).map(fmt => (
                                  <a key={fmt}
                                    href={`/api/admin/parents/export?format=${fmt}`}
                                    target="_blank" rel="noreferrer"
                                    className="flex items-center gap-2 px-3 py-2 text-xs text-[#2E3440] hover:bg-[#F5F7FA] transition-colors">
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${fmt === 'pdf' ? 'bg-red-100 text-red-700' : fmt === 'xlsx' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{fmt.toUpperCase()}</span>
                                    {fmt === 'csv' ? 'CSV File' : fmt === 'xlsx' ? 'Excel Workbook' : 'PDF Report'}
                                  </a>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                        <input
                          className="w-full text-sm rounded-lg border border-[#E2E8F0] px-3 py-2 focus:outline-none focus:border-[#344E86] focus:ring-2 focus:ring-[#344E86]/10 bg-[#F5F7FA] placeholder-[#9AA4B2] transition-all"
                          placeholder="Search name, email, mobile..."
                          value={parentSearch}
                          onChange={e => setParentSearch(e.target.value)}
                        />
                      </div>
                      <div className="px-4 py-2.5 border-b border-[#E2E8F0] flex gap-1.5 flex-wrap">
                        {[['all','All'],['active','Active'],['expired','Expired'],['no_sub','No Plan']].map(([v,l]) => (
                          <button key={v} onClick={() => setParentSubFilter(v)}
                            className={`text-xs font-medium px-3 py-1 rounded-full transition-all ${parentSubFilter === v ? 'bg-[#344E86] text-white shadow-sm' : 'bg-[#F5F7FA] text-[#5F6C80] hover:bg-[#E2E8F0]'}`}>
                            {l}
                          </button>
                        ))}
                      </div>
                      <div className="flex-1 overflow-y-auto">
                        {loadingParents ? (
                          <div className="py-16 text-center text-sm text-[#9AA4B2]">Loading...</div>
                        ) : filteredParents.length === 0 ? (
                          <div className="py-16 text-center text-sm text-[#9AA4B2]">No records found</div>
                        ) : filteredParents.map(parent => (
                          <button key={parent.id} onClick={() => { setSelectedParent(parent); setParentDetailTab('profile'); setConsentEmailResult(null); }}
                            className={`w-full text-left px-4 py-3 border-b border-[#F5F7FA] transition-all ${selectedParent?.id === parent.id ? 'bg-[#344E86]/[0.05] border-l-[3px] !border-l-[#344E86] pl-[13px]' : 'hover:bg-[#F5F7FA] border-l-[3px] border-l-transparent'}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-sm font-semibold text-[#2E3440] truncate">{parent.fullName || 'Unnamed Account'}</p>
                                  {parent.platformId && <span className="text-[9px] font-mono font-bold text-[#344E86] bg-[#344E86]/[0.07] px-1.5 py-0.5 rounded flex-shrink-0">{parent.platformId}</span>}
                                </div>
                                <p className="text-xs text-[#9AA4B2] truncate mt-0.5">{parent.email}</p>
                                <p className="text-xs text-[#9AA4B2] mt-0.5">{parent.childCount} child{parent.childCount !== 1 ? 'ren' : ''}{parent.subscriptionPlan ? ` · ${parent.subscriptionPlan}` : ''}</p>
                              </div>
                              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${parent.isActive ? 'text-emerald-700 bg-emerald-50' : 'text-[#9AA4B2] bg-[#F5F7FA]'}`}>
                                {parent.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Detail Area */}
                    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                      {!selectedParent ? (
                        <div className="flex-1 flex items-center justify-center h-full">
                          <div className="text-center">
                            <div className="w-16 h-16 rounded-2xl bg-[#344E86]/10 flex items-center justify-center mx-auto mb-4">
                              <span className="text-2xl font-black text-[#344E86]">P</span>
                            </div>
                            <p className="text-sm font-semibold text-[#5F6C80]">Select a parent to view their profile</p>
                            <p className="text-xs text-[#9AA4B2] mt-1">{parents.length} accounts in the registry</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* ── Parent header ── */}
                          <div className="bg-white border-b border-[#E2E8F0] px-6 pt-4 pb-0 flex-shrink-0">
                            <div className="flex items-start justify-between gap-4 pb-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                  <h2 className="text-lg font-bold text-[#2E3440]">{selectedParent.fullName || 'Unnamed Account'}</h2>
                                  {selectedParent.platformId && (
                                    <span className="text-xs font-mono font-bold text-[#344E86] bg-[#344E86]/[0.08] px-2.5 py-0.5 rounded-full">{selectedParent.platformId}</span>
                                  )}
                                  <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${selectedParent.isActive ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>{selectedParent.isActive ? 'Active' : 'Inactive'}</span>
                                  {selectedParent.isVerified && <span className="text-xs font-medium px-2.5 py-0.5 rounded-full text-[#344E86] bg-[#344E86]/10">Verified</span>}
                                  {selectedParent.subscriptionPlan && <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full capitalize ${selectedParent.subscriptionStatus === 'active' ? 'text-emerald-700 bg-emerald-50' : 'text-[#9AA4B2] bg-[#F5F7FA]'}`}>{selectedParent.subscriptionPlan}</span>}
                                  {parentDetailTab === 'kyc' && parentKyc?.status ? (
                                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full capitalize ${parentKyc.status === 'verified' ? 'text-emerald-700 bg-emerald-50' : parentKyc.status === 'rejected' ? 'text-red-600 bg-red-50' : parentKyc.status === 'submitted' ? 'text-blue-700 bg-blue-50' : 'text-amber-700 bg-amber-50'}`}>
                                      KYC {parentKyc.status}
                                    </span>
                                  ) : null}
                                </div>
                                <p className="text-sm text-[#5F6C80] truncate">{selectedParent.email}{selectedParent.mobile ? ` · ${selectedParent.mobile}` : ''}</p>
                              </div>

                              {/* Action buttons */}
                              <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                                {/* Toggle Active */}
                                <button
                                  disabled={parentActionLoading === 'toggle'}
                                  onClick={async () => {
                                    setParentActionLoading('toggle');
                                    setParentActionFeedback(null);
                                    try {
                                      const res = await fetch(`/api/admin/users/${selectedParent.id}/status`, {
                                        method: 'PATCH', credentials: 'include',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ is_active: !selectedParent.isActive }),
                                      });
                                      if (res.ok) {
                                        setSelectedParent({ ...selectedParent, isActive: !selectedParent.isActive });
                                        refetchParents();
                                        setParentActionFeedback({ ok: true, msg: `Account ${!selectedParent.isActive ? 'activated' : 'deactivated'} successfully` });
                                      } else {
                                        setParentActionFeedback({ ok: false, msg: 'Failed to update account status' });
                                      }
                                    } catch { setParentActionFeedback({ ok: false, msg: 'Network error' }); }
                                    finally { setParentActionLoading(null); setTimeout(() => setParentActionFeedback(null), 3500); }
                                  }}
                                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${selectedParent.isActive ? 'border-red-200 text-red-600 bg-red-50 hover:bg-red-100' : 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'}`}
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                    {selectedParent.isActive
                                      ? <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                                      : <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                    }
                                  </svg>
                                  {parentActionLoading === 'toggle' ? 'Updating...' : selectedParent.isActive ? 'Deactivate' : 'Activate'}
                                </button>

                                {/* Reset Password */}
                                <button
                                  onClick={() => { setParentResetPwdOpen(v => !v); setParentNotifOpen(false); setParentResetPwdValue(''); }}
                                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${parentResetPwdOpen ? 'border-[#344E86] text-[#344E86] bg-[#344E86]/5' : 'border-[#E2E8F0] text-[#5F6C80] hover:bg-[#F5F7FA]'}`}
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
                                  Reset Password
                                </button>

                                {/* Send Notification */}
                                <button
                                  onClick={() => { setParentNotifOpen(v => !v); setParentResetPwdOpen(false); setParentNotifMessage(''); }}
                                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${parentNotifOpen ? 'border-[#344E86] text-[#344E86] bg-[#344E86]/5' : 'border-[#E2E8F0] text-[#5F6C80] hover:bg-[#F5F7FA]'}`}
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                                  Notify
                                </button>

                                {/* Copy email */}
                                {selectedParent.email && (
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(selectedParent.email);
                                      setParentActionFeedback({ ok: true, msg: 'Email copied to clipboard' });
                                      setTimeout(() => setParentActionFeedback(null), 2000);
                                    }}
                                    title="Copy email"
                                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[#E2E8F0] text-[#5F6C80] hover:bg-[#F5F7FA] transition-colors"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                                    Copy Email
                                  </button>
                                )}

                                {/* Export this parent */}
                                <div className="relative group">
                                  <button className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[#E2E8F0] text-[#5F6C80] hover:bg-[#F5F7FA] transition-colors">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                                    Download
                                  </button>
                                  <div className="absolute right-0 top-8 bg-white border border-[#E2E8F0] rounded-xl shadow-lg z-20 py-1 min-w-[130px] hidden group-hover:block">
                                    {(['pdf','xlsx','csv'] as const).map(fmt => (
                                      <a key={fmt}
                                        href={`/api/admin/parents/${selectedParent.id}/export?format=${fmt}`}
                                        target="_blank" rel="noreferrer"
                                        className="flex items-center gap-2 px-3 py-2 text-xs text-[#2E3440] hover:bg-[#F5F7FA] transition-colors">
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${fmt === 'pdf' ? 'bg-red-100 text-red-700' : fmt === 'xlsx' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{fmt.toUpperCase()}</span>
                                        {fmt === 'pdf' ? 'PDF Report' : fmt === 'xlsx' ? 'Excel File' : 'CSV File'}
                                      </a>
                                    ))}
                                  </div>
                                </div>

                                {/* Refresh */}
                                <button onClick={() => refetchParents()} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[#E2E8F0] text-[#5F6C80] hover:bg-[#F5F7FA] transition-colors">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                                  Refresh
                                </button>
                              </div>
                            </div>

                            {/* Action feedback banner */}
                            {parentActionFeedback && (
                              <div className={`mx-0 mb-3 px-3 py-2 rounded-lg text-xs font-medium ${parentActionFeedback.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                                {parentActionFeedback.msg}
                              </div>
                            )}

                            {/* Reset Password Panel */}
                            {parentResetPwdOpen && (
                              <div className="mb-3 p-3 bg-[#F5F7FA] rounded-xl border border-[#E2E8F0]">
                                <p className="text-xs font-semibold text-[#5F6C80] mb-2">Set New Password for {selectedParent.fullName || selectedParent.email}</p>
                                <div className="flex gap-2">
                                  <input
                                    type="password"
                                    value={parentResetPwdValue}
                                    onChange={e => setParentResetPwdValue(e.target.value)}
                                    placeholder="New password (min 6 characters)"
                                    className="flex-1 text-xs border border-[#E2E8F0] rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#344E86]"
                                  />
                                  <button
                                    disabled={parentResetPwdValue.length < 6 || parentActionLoading === 'resetpwd'}
                                    onClick={async () => {
                                      setParentActionLoading('resetpwd');
                                      try {
                                        const res = await fetch(`/api/admin/users/${selectedParent.id}/reset-password`, {
                                          method: 'POST', credentials: 'include',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ password: parentResetPwdValue }),
                                        });
                                        const data = await res.json();
                                        setParentActionFeedback({ ok: res.ok, msg: res.ok ? 'Password reset successfully' : (data.message || 'Failed to reset password') });
                                        if (res.ok) { setParentResetPwdOpen(false); setParentResetPwdValue(''); }
                                      } catch { setParentActionFeedback({ ok: false, msg: 'Network error' }); }
                                      finally { setParentActionLoading(null); setTimeout(() => setParentActionFeedback(null), 3500); }
                                    }}
                                    className="text-xs font-medium px-3 py-2 rounded-lg bg-[#344E86] text-white hover:bg-[#2d4373] disabled:opacity-50 transition-colors whitespace-nowrap"
                                  >
                                    {parentActionLoading === 'resetpwd' ? 'Saving...' : 'Set Password'}
                                  </button>
                                  <button onClick={() => setParentResetPwdOpen(false)} className="text-xs font-medium px-3 py-2 rounded-lg border border-[#E2E8F0] text-[#9AA4B2] hover:bg-white transition-colors">Cancel</button>
                                </div>
                              </div>
                            )}

                            {/* Send Notification Panel */}
                            {parentNotifOpen && (
                              <div className="mb-3 p-3 bg-[#F5F7FA] rounded-xl border border-[#E2E8F0]">
                                <p className="text-xs font-semibold text-[#5F6C80] mb-2">Send Notification to {selectedParent.fullName || selectedParent.email}</p>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={parentNotifMessage}
                                    onChange={e => setParentNotifMessage(e.target.value)}
                                    placeholder="Enter notification message..."
                                    className="flex-1 text-xs border border-[#E2E8F0] rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#344E86]"
                                  />
                                  <button
                                    disabled={!parentNotifMessage.trim() || parentActionLoading === 'notify'}
                                    onClick={async () => {
                                      setParentActionLoading('notify');
                                      try {
                                        const res = await fetch('/api/admin/notifications/send', {
                                          method: 'POST', credentials: 'include',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            recipientId: selectedParent.id,
                                            title: 'Message from Admin',
                                            message: parentNotifMessage.trim(),
                                            type: 'info',
                                            category: 'general',
                                          }),
                                        });
                                        setParentActionFeedback({ ok: res.ok, msg: res.ok ? 'Notification sent successfully' : 'Failed to send notification' });
                                        if (res.ok) { setParentNotifOpen(false); setParentNotifMessage(''); }
                                      } catch { setParentActionFeedback({ ok: false, msg: 'Network error' }); }
                                      finally { setParentActionLoading(null); setTimeout(() => setParentActionFeedback(null), 3500); }
                                    }}
                                    className="text-xs font-medium px-3 py-2 rounded-lg bg-[#344E86] text-white hover:bg-[#2d4373] disabled:opacity-50 transition-colors whitespace-nowrap"
                                  >
                                    {parentActionLoading === 'notify' ? 'Sending...' : 'Send'}
                                  </button>
                                  <button onClick={() => setParentNotifOpen(false)} className="text-xs font-medium px-3 py-2 rounded-lg border border-[#E2E8F0] text-[#9AA4B2] hover:bg-white transition-colors">Cancel</button>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="bg-white border-b border-[#E2E8F0] px-6 flex-shrink-0">
                            <div className="flex">
                              {([
                                { id: 'profile', label: 'Profile' },
                                { id: 'children', label: 'Children' },
                                { id: 'bookings', label: 'Mentor Services' },
                                { id: 'subscription', label: 'Subscription' },
                                { id: 'briefings', label: 'Briefings' },
                                { id: 'activity', label: 'Activity' },
                                { id: 'consent', label: 'Consent' },
                                { id: 'kyc', label: 'KYC' },
                              ] as const).map(tab => (
                                <button key={tab.id} onClick={() => setParentDetailTab(tab.id)}
                                  className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${parentDetailTab === tab.id ? 'border-[#344E86] text-[#344E86]' : 'border-transparent text-[#9AA4B2] hover:text-[#5F6C80]'}`}>
                                  {tab.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="flex-1 overflow-y-auto p-6 bg-[#F5F7FA]">
                            {parentDetailTab === 'profile' && (
                              <div className="space-y-4 max-w-2xl">
                                <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5">
                                  <h3 className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide mb-4">Account Information</h3>
                                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                    {[
                                      { label: 'Parent ID', value: selectedParent.platformId || '—' },
                                      { label: 'Full Name', value: selectedParent.fullName || '—' },
                                      { label: 'Email Address', value: selectedParent.email || '—' },
                                      { label: 'Mobile', value: selectedParent.mobile || '—' },
                                      { label: 'Account Status', value: selectedParent.isActive ? 'Active' : 'Inactive' },
                                      { label: 'Email Verified', value: selectedParent.isVerified ? 'Yes' : 'No' },
                                      { label: 'Registered', value: selectedParent.createdAt ? new Date(selectedParent.createdAt).toLocaleDateString('en-IN') : '—' },
                                      { label: 'Children', value: `${selectedParent.childCount} registered` },
                                      { label: 'Subscription', value: selectedParent.subscriptionPlan ? `${selectedParent.subscriptionPlan} — ${selectedParent.subscriptionStatus}` : 'No plan' },
                                    ].map(({ label, value }) => (
                                      <div key={label}>
                                        <p className="text-xs font-medium text-[#9AA4B2] uppercase tracking-wide mb-1">{label}</p>
                                        <p className="text-sm font-medium text-[#2E3440]">{value}</p>
                                      </div>
                                    ))}
                                    <div>
                                      <p className="text-xs font-medium text-[#9AA4B2] uppercase tracking-wide mb-1">KYC Status</p>
                                      <button
                                        onClick={() => setParentDetailTab('kyc')}
                                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize transition-colors cursor-pointer ${
                                          !parentKyc?.status || parentKyc.status === 'pending' ? 'text-amber-700 bg-amber-50 hover:bg-amber-100' :
                                          parentKyc.status === 'verified' ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100' :
                                          parentKyc.status === 'rejected' ? 'text-red-600 bg-red-50 hover:bg-red-100' :
                                          'text-blue-700 bg-blue-50 hover:bg-blue-100'
                                        }`}>
                                        {parentKyc?.status ?? 'pending'} — view KYC tab
                                      </button>
                                    </div>
                                  </div>
                                </div>
                                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 text-sm text-amber-800 leading-relaxed">
                                  Parents access the platform on behalf of their registered children. Each parent's activity is tied to their children's progress and wellness data.
                                </div>
                              </div>
                            )}

                            {parentDetailTab === 'children' && (
                              <div className="max-w-2xl space-y-3">
                                <div className="flex items-center justify-between">
                                  <h3 className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide">{parentChildren.length} Registered Child{parentChildren.length !== 1 ? 'ren' : ''}</h3>
                                  <button onClick={() => refetchParentChildren()} className="text-xs font-medium text-[#5F6C80] border border-[#E2E8F0] px-3 py-1.5 rounded-lg hover:bg-[#F5F7FA] transition-colors">Refresh</button>
                                </div>
                                {parentChildren.length === 0 ? (
                                  <div className="py-16 text-center text-sm text-[#9AA4B2] rounded-xl border border-dashed border-[#E2E8F0] bg-white">No children registered under this account</div>
                                ) : parentChildren.map((child: any) => (
                                  <div key={child.id} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm px-5 py-4">
                                    <div className="flex items-start justify-between mb-3">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <p className="text-sm font-bold text-[#2E3440]">{child.name}</p>
                                          {child.platformId && <span className="text-[9px] font-mono font-bold text-[#4ECDC4] bg-[#4ECDC4]/10 px-1.5 py-0.5 rounded flex-shrink-0">{child.platformId}</span>}
                                          {child.gender && <span className="text-xs px-2 py-0.5 rounded-full bg-[#F5F7FA] text-[#5F6C80] capitalize">{child.gender}</span>}
                                          {child.age && <span className="text-xs text-[#9AA4B2]">Age {child.age}</span>}
                                        </div>
                                        {child.school && <p className="text-xs text-[#9AA4B2] mt-0.5 truncate">{child.school}{child.board ? ` · ${child.board}` : ''}</p>}
                                      </div>
                                      <div className="flex flex-col items-end gap-1.5 ml-4 flex-shrink-0">
                                        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${child.consentGiven ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
                                          {child.consentGiven ? 'Consent OK' : 'No Consent'}
                                        </span>
                                        {child.activePlan && (
                                          <span className="text-xs font-medium px-2.5 py-0.5 rounded-full text-blue-700 bg-blue-50 capitalize">{child.activePlan}</span>
                                        )}
                                        {!child.activePlan && child.latestSubStatus && (
                                          <span className="text-xs font-medium px-2.5 py-0.5 rounded-full text-amber-700 bg-amber-50 capitalize">{child.latestSubStatus}</span>
                                        )}
                                        {!child.activePlan && !child.latestSubStatus && (
                                          <span className="text-xs font-medium px-2.5 py-0.5 rounded-full text-[#9AA4B2] bg-[#F5F7FA]">No Plan</span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-4 gap-3 py-3 border-t border-[#F0F2F5]">
                                      {[
                                        { label: 'Grade', value: child.grade || '—' },
                                        { label: 'City', value: child.city || '—' },
                                        { label: 'Bookings', value: String(child.totalBookings || 0) },
                                        { label: 'LBI Sessions', value: String(child.lbiSessions || 0) },
                                        { label: 'Wellness', value: String(child.wellnessCheckins || 0) },
                                        { label: 'Subscriptions', value: String(child.subscriptionCount || 0) },
                                        { label: 'Last Mentor', value: child.lastMentorName || '—' },
                                        { label: 'Sub Expires', value: child.subExpiryDate ? new Date(child.subExpiryDate).toLocaleDateString('en-IN') : '—' },
                                      ].map(({ label, value }) => (
                                        <div key={label}>
                                          <p className="text-xs font-medium text-[#9AA4B2] uppercase tracking-wide">{label}</p>
                                          <p className="text-xs font-semibold text-[#5F6C80] mt-0.5 truncate">{value}</p>
                                        </div>
                                      ))}
                                    </div>
                                    {child.learningStyle && (
                                      <p className="text-xs text-[#9AA4B2] mt-2">Learning style: <span className="font-medium text-[#5F6C80] capitalize">{child.learningStyle}</span></p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {parentDetailTab === 'bookings' && (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <h3 className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide">{parentBookings.length} Mentor Session{parentBookings.length !== 1 ? 's' : ''} Across Children</h3>
                                  <button onClick={() => refetchParentBookings()} className="text-xs font-medium text-[#5F6C80] border border-[#E2E8F0] px-3 py-1.5 rounded-lg hover:bg-[#F5F7FA] transition-colors">Refresh</button>
                                </div>
                                {parentBookings.length === 0 ? (
                                  <div className="py-16 text-center text-sm text-[#9AA4B2] rounded-xl border border-dashed border-[#E2E8F0] bg-white">No mentor sessions booked for any child under this parent</div>
                                ) : (
                                  <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                                          <th className="text-left text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide px-4 py-3">Child</th>
                                          <th className="text-left text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide px-4 py-3">Mentor</th>
                                          <th className="text-left text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide px-4 py-3">Date</th>
                                          <th className="text-left text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide px-4 py-3">Time</th>
                                          <th className="text-left text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide px-4 py-3">Mode</th>
                                          <th className="text-left text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide px-4 py-3">Status</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-[#F1F5F9]">
                                        {parentBookings.map((b: any) => (
                                          <tr key={b.id} className="hover:bg-[#F8FAFC] transition-colors">
                                            <td className="px-4 py-3">
                                              <p className="font-medium text-[#2E3440]">{b.childName}</p>
                                              <p className="text-xs text-[#9AA4B2]">{b.childPlatformId}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                              <p className="font-medium text-[#2E3440]">{b.mentorName}</p>
                                              {b.specialization && <p className="text-xs text-[#9AA4B2]">{b.specialization}</p>}
                                            </td>
                                            <td className="px-4 py-3 text-[#5F6C80]">{b.slotDate ? new Date(b.slotDate).toLocaleDateString('en-IN') : '—'}</td>
                                            <td className="px-4 py-3 text-[#5F6C80] whitespace-nowrap">{b.startTime} – {b.endTime}</td>
                                            <td className="px-4 py-3">
                                              <span className="capitalize text-[#5F6C80]">{b.mode || '—'}</span>
                                            </td>
                                            <td className="px-4 py-3">{getStatusBadge(b.status)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            )}

                            {parentDetailTab === 'subscription' && (
                              <div className="max-w-2xl space-y-4">
                                <div className="flex items-center justify-between">
                                  <h3 className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide">{parentSubscription.length} Subscription{parentSubscription.length !== 1 ? 's' : ''} Across Children</h3>
                                  <button onClick={() => refetchParentSubscription()} className="text-xs font-medium text-[#5F6C80] border border-[#E2E8F0] px-3 py-1.5 rounded-lg hover:bg-[#F5F7FA] transition-colors">Refresh</button>
                                </div>

                                {/* Account-level plan summary */}
                                {selectedParent.subscriptionPlan && (
                                  <div className={`p-4 rounded-xl border shadow-sm flex items-center justify-between ${selectedParent.subscriptionStatus === 'active' ? 'bg-emerald-50 border-emerald-100' : 'bg-[#F5F7FA] border-[#E2E8F0]'}`}>
                                    <div>
                                      <p className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide mb-0.5">Account-Level Plan</p>
                                      <p className="text-base font-bold text-[#2E3440] capitalize">{selectedParent.subscriptionPlan}</p>
                                      {selectedParent.subscriptionExpiresAt && (
                                        <p className="text-xs text-[#9AA4B2] mt-0.5">Expires {new Date(selectedParent.subscriptionExpiresAt).toLocaleDateString('en-IN')}</p>
                                      )}
                                    </div>
                                    <span className={`text-xs font-medium px-3 py-1 rounded-full capitalize ${selectedParent.subscriptionStatus === 'active' ? 'text-emerald-700 bg-emerald-100' : 'text-[#9AA4B2] bg-white border border-[#E2E8F0]'}`}>{selectedParent.subscriptionStatus}</span>
                                  </div>
                                )}

                                {parentSubscription.length === 0 ? (
                                  <div className="py-12 text-center text-sm text-[#9AA4B2] rounded-xl border border-dashed border-[#E2E8F0] bg-white">No per-child subscription records found</div>
                                ) : parentSubscription.map((sub: any) => (
                                  <div key={sub.id} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5">
                                    <div className="flex items-start justify-between mb-3">
                                      <div>
                                        <p className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide mb-0.5">Child</p>
                                        <p className="text-sm font-bold text-[#2E3440]">{sub.childName || '—'}</p>
                                        {sub.childGrade && <p className="text-xs text-[#9AA4B2]">{sub.childGrade}{sub.childSchool ? ` · ${sub.childSchool}` : ''}</p>}
                                      </div>
                                      <div className="flex flex-col items-end gap-1">
                                        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full capitalize ${sub.status === 'active' ? 'text-emerald-700 bg-emerald-50' : sub.status === 'expired' ? 'text-red-600 bg-red-50' : 'text-amber-700 bg-amber-50'}`}>{sub.status || 'unknown'}</span>
                                        {sub.subscriptionType && <span className="text-xs text-[#9AA4B2] capitalize">{sub.subscriptionType}</span>}
                                      </div>
                                    </div>
                                    <div className="bg-[#F5F7FA] rounded-lg p-3 mb-3">
                                      <p className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide mb-0.5">Package</p>
                                      <p className="text-sm font-bold text-[#2E3440]">{sub.planName || 'Unnamed Package'}</p>
                                      {sub.planDescription && <p className="text-xs text-[#9AA4B2] mt-0.5 line-clamp-2">{sub.planDescription}</p>}
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                      {[
                                        { label: 'Price', value: sub.price != null ? `${sub.currency} ${sub.price}` : '—' },
                                        { label: 'Billing', value: sub.billingCycle || '—' },
                                        { label: 'Max Sessions', value: sub.maxSessions != null ? String(sub.maxSessions) : '—' },
                                        { label: 'Validity', value: sub.validityDays != null ? `${sub.validityDays} days` : '—' },
                                        { label: 'Start Date', value: sub.startDate ? new Date(sub.startDate).toLocaleDateString('en-IN') : '—' },
                                        { label: 'Expiry Date', value: sub.expiryDate ? new Date(sub.expiryDate).toLocaleDateString('en-IN') : '—' },
                                      ].map(({ label, value }) => (
                                        <div key={label}>
                                          <p className="text-xs font-medium text-[#9AA4B2] uppercase tracking-wide">{label}</p>
                                          <p className="text-xs font-semibold text-[#5F6C80] mt-0.5 capitalize">{value}</p>
                                        </div>
                                      ))}
                                    </div>
                                    {sub.notes && (
                                      <p className="text-xs text-[#9AA4B2] mt-3 border-t border-[#F0F2F5] pt-2">Note: {sub.notes}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {parentDetailTab === 'briefings' && (
                              <div className="max-w-2xl space-y-3">
                                <div className="flex items-center justify-between">
                                  <h3 className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide">{parentBriefings.length} Briefing{parentBriefings.length !== 1 ? 's' : ''}</h3>
                                  <button onClick={() => refetchParentBriefings()} className="text-xs font-medium text-[#5F6C80] border border-[#E2E8F0] px-3 py-1.5 rounded-lg hover:bg-[#F5F7FA] transition-colors">Refresh</button>
                                </div>
                                {parentBriefings.length === 0 ? (
                                  <div className="py-16 text-center text-sm text-[#9AA4B2] rounded-xl border border-dashed border-[#E2E8F0] bg-white">No briefings generated yet. Weekly briefings are auto-generated once sessions begin.</div>
                                ) : parentBriefings.map((briefing: any) => (
                                  <div key={briefing.id} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm px-5 py-4">
                                    <div className="flex items-start justify-between mb-3">
                                      <div>
                                        <p className="text-sm font-bold text-[#2E3440]">Week of {new Date(briefing.weekOf).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                        {briefing.childName && <p className="text-xs text-[#5F6C80] mt-0.5">For {briefing.childName}</p>}
                                      </div>
                                      <span className="text-xs text-[#9AA4B2]">{new Date(briefing.generatedAt).toLocaleDateString('en-IN')}</span>
                                    </div>
                                    {briefing.highlights?.length > 0 && (
                                      <div className="mb-3">
                                        <p className="text-xs font-medium text-[#9AA4B2] uppercase tracking-wide mb-2">Highlights</p>
                                        {briefing.highlights.slice(0, 3).map((h: string, i: number) => <p key={i} className="text-sm text-[#5F6C80] py-1.5 border-b border-[#F5F7FA] last:border-0">{h}</p>)}
                                      </div>
                                    )}
                                    {briefing.actionItems?.length > 0 && (
                                      <div>
                                        <p className="text-xs font-medium text-[#9AA4B2] uppercase tracking-wide mb-2">Action Items</p>
                                        {briefing.actionItems.slice(0, 2).map((a: any, i: number) => <p key={i} className="text-sm text-[#5F6C80] py-1.5 border-b border-[#F5F7FA] last:border-0">{typeof a === 'string' ? a : a?.action || ''}</p>)}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {parentDetailTab === 'activity' && (
                              <div className="max-w-2xl space-y-4">
                                <div className="flex items-center justify-between">
                                  <h3 className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide">Account Activity Summary</h3>
                                  <button onClick={() => refetchParentActivity()} className="text-xs font-medium text-[#5F6C80] border border-[#E2E8F0] px-3 py-1.5 rounded-lg hover:bg-[#F5F7FA] transition-colors">Refresh</button>
                                </div>

                                {/* Account metrics */}
                                <div className="grid grid-cols-4 gap-3">
                                  {[
                                    { label: 'Children', value: parentActivity?.account?.childCount ?? selectedParent.childCount ?? 0, color: '#344E86' },
                                    { label: 'Briefings', value: parentBriefings.length, color: '#4ECDC4' },
                                    { label: 'Notifications', value: parentActivity?.notifications?.total ?? 0, color: '#5F6C80' },
                                    { label: 'Read', value: parentActivity?.notifications?.readCount ?? 0, color: '#7B8FA1' },
                                  ].map(({ label, value, color }) => (
                                    <div key={label} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-4 text-center">
                                      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
                                      <p className="text-xs font-medium text-[#9AA4B2] uppercase tracking-wide mt-1">{label}</p>
                                    </div>
                                  ))}
                                </div>

                                {/* Account details */}
                                <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-4">
                                  <p className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide mb-3">Account Details</p>
                                  <div className="grid grid-cols-2 gap-3">
                                    {[
                                      { label: 'Joined', value: parentActivity?.account?.joinedAt ? new Date(parentActivity.account.joinedAt).toLocaleDateString('en-IN') : (selectedParent.createdAt ? new Date(selectedParent.createdAt).toLocaleDateString('en-IN') : '—') },
                                      { label: 'Status', value: (parentActivity?.account?.isActive ?? selectedParent.isActive) ? 'Active' : 'Inactive' },
                                      { label: 'Verified', value: (parentActivity?.account?.isVerified ?? selectedParent.isVerified) ? 'Yes' : 'Not Yet' },
                                      { label: 'Last Notification', value: parentActivity?.notifications?.lastNotificationAt ? new Date(parentActivity.notifications.lastNotificationAt).toLocaleDateString('en-IN') : '—' },
                                    ].map(({ label, value }) => (
                                      <div key={label} className="bg-[#F5F7FA] rounded-lg p-3">
                                        <p className="text-xs font-medium text-[#9AA4B2] uppercase tracking-wide">{label}</p>
                                        <p className="text-sm font-semibold text-[#2E3440] mt-0.5">{value}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Per-child activity breakdown */}
                                {parentActivity?.children?.length > 0 && (
                                  <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-4">
                                    <p className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide mb-3">Per-Child Activity</p>
                                    <div className="space-y-3">
                                      {parentActivity.children.map((ch: any) => (
                                        <div key={ch.id} className="flex items-center justify-between py-2 border-b border-[#F0F2F5] last:border-0">
                                          <div>
                                            <p className="text-sm font-semibold text-[#2E3440]">{ch.name}</p>
                                            {ch.grade && <p className="text-xs text-[#9AA4B2]">{ch.grade}</p>}
                                          </div>
                                          <div className="flex gap-4 text-right">
                                            {[
                                              { label: 'Bookings', val: ch.bookingCount },
                                              { label: 'Subscriptions', val: ch.subscriptionCount },
                                              { label: 'Wellness', val: ch.wellnessCheckins },
                                              { label: 'LBI', val: ch.lbiSessions },
                                            ].map(({ label, val }) => (
                                              <div key={label}>
                                                <p className="text-xs font-bold text-[#2E3440]">{val}</p>
                                                <p className="text-xs text-[#9AA4B2]">{label}</p>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Recent bookings through children */}
                                {parentActivity?.recentBookings?.length > 0 && (
                                  <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-4">
                                    <p className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide mb-3">Recent Mentor Bookings (via Children)</p>
                                    <div className="space-y-2">
                                      {parentActivity.recentBookings.map((bk: any) => (
                                        <div key={bk.id} className="flex items-center justify-between py-2 border-b border-[#F0F2F5] last:border-0">
                                          <div>
                                            <p className="text-xs font-semibold text-[#2E3440]">{bk.childName} · {bk.mentorName || 'Unknown mentor'}</p>
                                            <p className="text-xs text-[#9AA4B2]">{bk.bookingDate ? new Date(bk.bookingDate).toLocaleDateString('en-IN') : '—'}{bk.startTime ? ` at ${bk.startTime}` : ''}</p>
                                          </div>
                                          <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full capitalize ${bk.status === 'confirmed' ? 'text-emerald-700 bg-emerald-50' : bk.status === 'cancelled' ? 'text-red-600 bg-red-50' : 'text-amber-700 bg-amber-50'}`}>{bk.status}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {!parentActivity && (
                                  <div className="py-12 text-center text-sm text-[#9AA4B2] rounded-xl border border-dashed border-[#E2E8F0] bg-white">Loading activity data...</div>
                                )}
                              </div>
                            )}

                            {parentDetailTab === 'consent' && (() => {
                              const downloadConsentForm = () => {
                                const link = document.createElement('a');
                                link.href = `/api/admin/parents/${selectedParent.id}/consent-form`;
                                link.download = `consent-form-${selectedParent.fullName?.replace(/\s+/g, '-').toLowerCase() || 'parent'}.html`;
                                link.click();
                              };

                              const sendConsentEmail = async () => {
                                setConsentEmailSending(true);
                                setConsentEmailResult(null);
                                try {
                                  const res = await fetch(`/api/admin/parents/${selectedParent.id}/send-consent-email`, {
                                    method: 'POST', credentials: 'include',
                                  });
                                  const data = await res.json();
                                  setConsentEmailResult({ ok: res.ok, msg: res.ok ? data.message : (data.error || 'Failed to send email') });
                                } catch {
                                  setConsentEmailResult({ ok: false, msg: 'Network error — please try again' });
                                } finally {
                                  setConsentEmailSending(false);
                                }
                              };

                              return (
                                <div className="max-w-2xl space-y-5">
                                  {/* Per-child consent matrix */}
                                  {parentChildren.length > 0 && (
                                    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5">
                                      <p className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide mb-3">Children — Consent Status</p>
                                      <div className="space-y-2">
                                        {parentChildren.map((ch: any) => (
                                          <div key={ch.id} className="flex items-center justify-between py-2 border-b border-[#F0F2F5] last:border-0">
                                            <div>
                                              <p className="text-sm font-semibold text-[#2E3440]">{ch.name}</p>
                                              {ch.grade && <p className="text-xs text-[#9AA4B2]">{ch.grade}{ch.school ? ` · ${ch.school}` : ''}</p>}
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${ch.consentGiven ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
                                                {ch.consentGiven ? 'Consent Given' : 'Consent Pending'}
                                              </span>
                                              {ch.consentGivenAt && (
                                                <span className="text-xs text-[#9AA4B2]">{new Date(ch.consentGivenAt).toLocaleDateString('en-IN')}</span>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                      <div className="mt-3 pt-3 border-t border-[#F0F2F5] flex items-center gap-3 text-xs text-[#9AA4B2]">
                                        <span className="font-semibold text-emerald-700">{parentChildren.filter((c: any) => c.consentGiven).length} consented</span>
                                        <span>·</span>
                                        <span className="font-semibold text-red-600">{parentChildren.filter((c: any) => !c.consentGiven).length} pending</span>
                                        <span>·</span>
                                        <span>{parentChildren.length} total children</span>
                                      </div>
                                    </div>
                                  )}

                                  {/* Header + Actions */}
                                  <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5">
                                    <div className="flex items-start justify-between gap-4">
                                      <div>
                                        <p className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide mb-1">Explicit Consent Document</p>
                                        <p className="text-sm font-medium text-[#2E3440]">Parental Consent Form — DPDP Act 2023</p>
                                        <p className="text-xs text-[#9AA4B2] mt-1">
                                          Download a pre-filled consent form for {selectedParent.fullName || 'this parent'}, or send it directly to their registered email.
                                        </p>
                                      </div>
                                      <div className="flex flex-col gap-2 flex-shrink-0">
                                        <button
                                          onClick={downloadConsentForm}
                                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-[#344E86] text-white hover:bg-[#2d4373] transition-colors whitespace-nowrap"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                                          Download Form
                                        </button>
                                        <button
                                          onClick={sendConsentEmail}
                                          disabled={consentEmailSending}
                                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-[#E2E8F0] text-[#5F6C80] hover:bg-[#F5F7FA] disabled:opacity-50 transition-colors whitespace-nowrap"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                                          {consentEmailSending ? 'Sending...' : 'Send via Email'}
                                        </button>
                                      </div>
                                    </div>
                                    {consentEmailResult && (
                                      <div className={`mt-4 px-3 py-2.5 rounded-lg text-xs font-medium ${consentEmailResult.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                                        {consentEmailResult.ok ? '✓ ' : '✕ '}{consentEmailResult.msg}
                                      </div>
                                    )}
                                    <div className="mt-4 pt-4 border-t border-[#F5F7FA] flex items-center gap-2">
                                      <svg className="w-3.5 h-3.5 text-[#344E86] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                      <p className="text-xs text-[#9AA4B2]">The form is pre-filled with parent and child details. The parent should sign and return a copy for your records.</p>
                                    </div>
                                  </div>

                                  {/* Children Consent Status */}
                                  <div>
                                    <h3 className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide mb-3">Children's Consent Status</h3>
                                    {parentChildren.length === 0 ? (
                                      <div className="py-12 text-center text-sm text-[#9AA4B2] rounded-xl border border-dashed border-[#E2E8F0] bg-white">No children registered yet</div>
                                    ) : (
                                      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                                        {parentChildren.map((child: any, i: number) => (
                                          <div key={child.id} className={`flex items-center justify-between px-5 py-3.5 ${i > 0 ? 'border-t border-[#F5F7FA]' : ''}`}>
                                            <div>
                                              <p className="text-sm font-semibold text-[#2E3440]">{child.name}</p>
                                              <p className="text-xs text-[#9AA4B2] mt-0.5">{child.grade ? `Grade ${child.grade}` : ''}{child.age ? `${child.grade ? ' · ' : ''}Age ${child.age}` : ''}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                              {child.consentGivenAt && <span className="text-xs text-[#9AA4B2]">{new Date(child.consentGivenAt).toLocaleDateString('en-IN')}</span>}
                                              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${child.consentGiven ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
                                                {child.consentGiven ? 'Obtained' : 'Pending'}
                                              </span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* DPDP Notice */}
                                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-700 leading-relaxed">
                                    <strong className="font-semibold">DPDP Act 2023:</strong> Parental consent is required for all children under 18. Consent must be explicitly provided before any data collection or session initiation. Retain a signed copy of the consent form for audit purposes.
                                  </div>
                                </div>
                              );
                            })()}

                            {parentDetailTab === 'kyc' && (() => {
                              const kyc = parentKyc?.kyc;
                              const kycStatus: string = parentKyc?.status ?? 'pending';

                              const statusBadge = (s: string) => {
                                const map: Record<string, string> = {
                                  verified: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
                                  submitted: 'bg-blue-50 text-blue-700 border border-blue-100',
                                  rejected: 'bg-red-50 text-red-600 border border-red-100',
                                  pending: 'bg-amber-50 text-amber-700 border border-amber-100',
                                };
                                return map[s] ?? 'bg-gray-50 text-gray-600 border border-gray-100';
                              };

                              const relationshipLabels: Record<string, string> = {
                                parent: 'Parent (Biological / Adoptive)',
                                legal_guardian: 'Legal Guardian',
                                court_appointed_guardian: 'Court-Appointed Guardian',
                                other: 'Other Authorised Person',
                              };

                              const idTypeLabels: Record<string, string> = {
                                aadhaar: 'Aadhaar Card',
                                pan: 'PAN Card',
                                passport: 'Passport',
                                voter_id: 'Voter ID',
                                driving_licence: 'Driving Licence',
                              };

                              const handleKycAction = async () => {
                                if (!kycAdminAction) return;
                                if (kycAdminAction === 'reject' && !kycRejectionReason.trim()) {
                                  setKycActionFeedback({ ok: false, msg: 'Please provide a rejection reason before submitting.' });
                                  return;
                                }
                                setKycActionLoading(true);
                                setKycActionFeedback(null);
                                try {
                                  const res = await fetch(`/api/admin/parents/${selectedParent.id}/kyc`, {
                                    method: 'PATCH', credentials: 'include',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      action: kycAdminAction,
                                      rejectionReason: kycRejectionReason || undefined,
                                      adminNotes: kycAdminNotes || undefined,
                                    }),
                                  });
                                  const data = await res.json();
                                  if (res.ok) {
                                    setKycActionFeedback({ ok: true, msg: kycAdminAction === 'verify' ? 'KYC verified. Parent notified.' : 'KYC rejected. Parent notified.' });
                                    setKycAdminAction(null);
                                    setKycRejectionReason('');
                                    setKycAdminNotes('');
                                    refetchParentKyc();
                                  } else {
                                    setKycActionFeedback({ ok: false, msg: data.error ?? 'Action failed' });
                                  }
                                } catch {
                                  setKycActionFeedback({ ok: false, msg: 'Network error — please try again' });
                                } finally {
                                  setKycActionLoading(false);
                                }
                              };

                              return (
                                <div className="max-w-2xl space-y-5">

                                  {/* KYC Status Card */}
                                  <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5">
                                    <div className="flex items-center justify-between mb-4">
                                      <div>
                                        <p className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide mb-1">KYC Verification Status</p>
                                        <p className="text-sm font-semibold text-[#2E3440]">Parent / Guardian Identity Verification</p>
                                        <p className="text-xs text-[#9AA4B2] mt-1">Required under DPDP Act 2023 for access to a minor's personal data.</p>
                                      </div>
                                      <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${statusBadge(kycStatus)}`}>
                                        {kycStatus}
                                      </span>
                                    </div>
                                    {kyc?.submittedAt && (
                                      <div className="flex items-center gap-2 text-xs text-[#9AA4B2] border-t border-[#F5F7FA] pt-3">
                                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                                        Submitted {new Date(kyc.submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        {kyc.verifiedAt && (
                                          <><span className="text-[#E2E8F0]">·</span> Verified {new Date(kyc.verifiedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}{kyc.verifiedByName ? ` by ${kyc.verifiedByName}` : ''}</>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* Submitted KYC Details */}
                                  {kyc ? (
                                    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5">
                                      <p className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide mb-4">Submitted Details</p>
                                      <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                        <div>
                                          <p className="text-xs text-[#9AA4B2] mb-0.5">Full Legal Name</p>
                                          <p className="text-sm font-semibold text-[#2E3440]">{kyc.fullLegalName || '—'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-[#9AA4B2] mb-0.5">Relationship to Child</p>
                                          <p className="text-sm font-semibold text-[#2E3440]">{relationshipLabels[kyc.relationshipType] ?? kyc.relationshipType ?? '—'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-[#9AA4B2] mb-0.5">Date of Birth</p>
                                          <p className="text-sm font-semibold text-[#2E3440]">{kyc.dateOfBirth ? new Date(kyc.dateOfBirth).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-[#9AA4B2] mb-0.5">Government ID Type</p>
                                          <p className="text-sm font-semibold text-[#2E3440]">{idTypeLabels[kyc.idType] ?? kyc.idType ?? '—'}</p>
                                        </div>
                                        <div className="col-span-2">
                                          <p className="text-xs text-[#9AA4B2] mb-0.5">Government ID Number</p>
                                          <p className="text-sm font-mono font-semibold text-[#2E3440] tracking-wider">{kyc.idNumber || '—'}</p>
                                        </div>
                                        {kyc.adminNotes && (
                                          <div className="col-span-2">
                                            <p className="text-xs text-[#9AA4B2] mb-0.5">Admin Notes</p>
                                            <p className="text-sm text-[#5F6C80] bg-[#F5F7FA] rounded-lg px-3 py-2">{kyc.adminNotes}</p>
                                          </div>
                                        )}
                                        {kyc.rejectionReason && (
                                          <div className="col-span-2">
                                            <p className="text-xs text-red-500 mb-0.5">Rejection Reason</p>
                                            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-100">{kyc.rejectionReason}</p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-5 flex items-start gap-3">
                                      <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                                      <div>
                                        <p className="text-sm font-semibold text-amber-800">KYC Not Yet Submitted</p>
                                        <p className="text-xs text-amber-700 mt-1">This parent has not submitted KYC documents. A verification reminder was sent at registration. You may send another reminder via the notification panel.</p>
                                      </div>
                                    </div>
                                  )}

                                  {/* Admin Review Actions — only show if KYC submitted and not yet verified */}
                                  {kyc && kycStatus !== 'verified' && (
                                    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5">
                                      <p className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide mb-3">Admin Review</p>

                                      {kycActionFeedback && (
                                        <div className={`mb-3 px-3 py-2.5 rounded-lg text-xs font-medium ${kycActionFeedback.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                                          {kycActionFeedback.msg}
                                        </div>
                                      )}

                                      {!kycAdminAction && (
                                        <div className="flex gap-3">
                                          <button
                                            onClick={() => { setKycAdminAction('verify'); setKycActionFeedback(null); }}
                                            className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                                            Verify KYC
                                          </button>
                                          <button
                                            onClick={() => { setKycAdminAction('reject'); setKycActionFeedback(null); }}
                                            className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                                            Reject KYC
                                          </button>
                                        </div>
                                      )}

                                      {kycAdminAction && (
                                        <div className="space-y-3">
                                          <p className="text-xs font-semibold text-[#2E3440]">
                                            {kycAdminAction === 'verify' ? 'Confirm KYC Verification' : 'Reject KYC — Provide Reason'}
                                          </p>
                                          {kycAdminAction === 'reject' && (
                                            <textarea
                                              rows={2}
                                              value={kycRejectionReason}
                                              onChange={e => setKycRejectionReason(e.target.value)}
                                              placeholder="Rejection reason (required) — e.g. ID number mismatch, document unclear..."
                                              className="w-full text-xs border border-[#E2E8F0] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-400 text-[#2E3440] resize-none"
                                            />
                                          )}
                                          <textarea
                                            rows={2}
                                            value={kycAdminNotes}
                                            onChange={e => setKycAdminNotes(e.target.value)}
                                            placeholder="Admin notes (optional) — internal record only"
                                            className="w-full text-xs border border-[#E2E8F0] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#344E86] text-[#2E3440] resize-none"
                                          />
                                          <div className="flex items-center gap-2">
                                            <button
                                              disabled={kycActionLoading}
                                              onClick={handleKycAction}
                                              className={`text-xs font-semibold px-4 py-2 rounded-lg transition-colors text-white ${kycActionLoading ? 'opacity-60 cursor-not-allowed' : ''} ${kycAdminAction === 'verify' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}>
                                              {kycActionLoading ? 'Saving...' : kycAdminAction === 'verify' ? 'Confirm Verify' : 'Confirm Reject'}
                                            </button>
                                            <button
                                              onClick={() => { setKycAdminAction(null); setKycRejectionReason(''); setKycAdminNotes(''); setKycActionFeedback(null); }}
                                              className="text-xs font-medium px-3 py-2 rounded-lg border border-[#E2E8F0] text-[#9AA4B2] hover:text-[#5F6C80] transition-colors">
                                              Cancel
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Already verified */}
                                  {kycStatus === 'verified' && (
                                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-3">
                                      <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                      <p className="text-sm font-semibold text-emerald-800">KYC Verified — This parent's identity has been confirmed.</p>
                                    </div>
                                  )}

                                  {/* DPDP Notice */}
                                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-700 leading-relaxed">
                                    <strong className="font-semibold">Legal Basis (DPDP Act 2023):</strong> For students under 18, the platform is required to verify that the registering adult is the legal parent or guardian before collecting or processing the child's personal data. KYC confirmation must be retained in the parent's profile for audit purposes.
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
}
