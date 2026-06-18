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

export default function MentorsPanel() {
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
                  {/* ── Section Sub-tab Bar ── */}
                  <div className="flex border-b border-[#E2E8F0] bg-white mb-4">
                    {([
                      { id: 'roster' as const, label: 'Roster & Profiles' },
                      { id: 'operations' as const, label: 'Operations' },
                    ] as const).map(st => (
                      <button key={st.id} onClick={() => setMentorSectionTab(st.id)}
                        className={`py-3 px-5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${mentorSectionTab === st.id ? 'border-[#344E86] text-[#344E86]' : 'border-transparent text-[#9AA4B2] hover:text-[#5F6C80]'}`}>
                        {st.label}
                      </button>
                    ))}
                  </div>

                  {mentorSectionTab === 'roster' && (
                    <div className="space-y-4">
                  {/* ── Hero Header ──────────────────────────────────────── */}
                  {(() => {
                    const MENTOR_AREAS: Record<string, { label: string; color: string; roles: string[] }> = {
                      lbi: { label: 'LBI / Schools', color: '#344E86', roles: ['subject_tutor','exam_strategist','performance_coach','psychological_counsellor'] },
                      employability: { label: 'Employability', color: '#10B981', roles: ['career_counsellor','employability_coach','interview_coach'] },
                      enterprise: { label: 'Enterprise', color: '#F97316', roles: ['leadership_coach','hr_consultant','corporate_trainer'] },
                    };
                    const ROLE_META: Record<string, { label: string; area: string; color: string }> = {
                      subject_tutor:            { label: 'Subject Tutor',            area: 'lbi',          color: '#344E86' },
                      exam_strategist:          { label: 'Exam Strategist',          area: 'lbi',          color: '#3B82F6' },
                      performance_coach:        { label: 'Performance Coach',        area: 'lbi',          color: '#6366F1' },
                      psychological_counsellor: { label: 'Psychological Counsellor', area: 'lbi',          color: '#8B5CF6' },
                      career_counsellor:        { label: 'Career Counsellor',        area: 'employability', color: '#10B981' },
                      employability_coach:      { label: 'Employability Coach',      area: 'employability', color: '#059669' },
                      interview_coach:          { label: 'Interview Coach',           area: 'employability', color: '#0D9488' },
                      leadership_coach:         { label: 'Leadership Coach',          area: 'enterprise',   color: '#F59E0B' },
                      hr_consultant:            { label: 'HR Consultant',             area: 'enterprise',   color: '#F97316' },
                      corporate_trainer:        { label: 'Corporate Trainer',         area: 'enterprise',   color: '#EF4444' },
                    };
                    const activeMentors  = mentors.filter((m: any) => m.status === 'active');
                    const verifiedCount  = mentors.filter((m: any) => m.isVerified).length;
                    const featuredCount  = mentors.filter((m: any) => m.isFeatured).length;
                    const totalSessions  = mentors.reduce((s: number, m: any) => s + (m.totalSessions || 0), 0);
                    const ratingsArr     = mentors.filter((m: any) => Number(m.rating) > 0).map((m: any) => Number(m.rating));
                    const avgRating      = ratingsArr.length ? (ratingsArr.reduce((a: number, b: number) => a + b, 0) / ratingsArr.length).toFixed(1) : '—';
                    const suspendedCount = mentors.filter((m: any) => m.status === 'suspended').length;

                    const heroStats = [
                      { label: 'Total Mentors',    value: mentors.length,      sub: 'registered profiles',    accent: BRAND.accent },
                      { label: 'Active',            value: activeMentors.length, sub: 'currently on-platform', accent: '#10B981' },
                      { label: 'Verified',          value: verifiedCount,       sub: 'KYC & docs approved',    accent: '#4ECDC4' },
                      { label: 'Featured',          value: featuredCount,       sub: 'highlighted on listings',accent: '#F59E0B' },
                      { label: 'Avg. Rating',       value: avgRating,           sub: 'across all reviews',     accent: '#8B5CF6' },
                      { label: 'Total Sessions',    value: totalSessions,       sub: 'completed on platform',  accent: '#F97316' },
                    ];

                    const filteredMentors = mentors.filter((m: any) => {
                      const q = mentorSearchQuery.toLowerCase();
                      const matchSearch = !q ||
                        m.fullName?.toLowerCase().includes(q) ||
                        m.displayName?.toLowerCase().includes(q) ||
                        m.mentorCode?.toLowerCase().includes(q) ||
                        m.specialization?.toLowerCase().includes(q) ||
                        m.title?.toLowerCase().includes(q) ||
                        m.city?.toLowerCase().includes(q);
                      const matchStatus = mentorStatusFilter === 'all' || m.status === mentorStatusFilter;
                      const matchArea   = mentorAreaFilter === 'all' || (m.mentorType && MENTOR_AREAS[mentorAreaFilter]?.roles.includes(m.mentorType));
                      const matchType   = mentorTypeFilter === 'all' || m.mentorType === mentorTypeFilter;
                      return matchSearch && matchStatus && matchArea && matchType;
                    });
                    const sortedMentors = [...filteredMentors].sort((a: any, b: any) => {
                      if (mentorSortBy === 'name') return (a.displayName||a.fullName||'').localeCompare(b.displayName||b.fullName||'');
                      if (mentorSortBy === 'rating') return (Number(b.rating)||0) - (Number(a.rating)||0);
                      if (mentorSortBy === 'sessions') return (Number(b.totalSessions)||0) - (Number(a.totalSessions)||0);
                      if (mentorSortBy === 'revenue') return (Number(b.hourlyRate)||0) - (Number(a.hourlyRate)||0);
                      if (mentorSortBy === 'phi') return (Number(b.performanceHealthIndex)||100) - (Number(a.performanceHealthIndex)||100);
                      if (mentorSortBy === 'joined') return (b.id||0) - (a.id||0);
                      return 0;
                    });

                    const activeAreaRoles = mentorAreaFilter !== 'all' ? MENTOR_AREAS[mentorAreaFilter].roles : Object.keys(ROLE_META);

                    return (
                      <>
                        {/* ── Clean Page Header ─────────────────────────── */}
                        <div className="bg-white rounded-xl border border-[#E2E8F0] px-6 py-4">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <GraduationCap size={16} style={{ color: BRAND.primary }} />
                                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400">Mentor Profiles</span>
                              </div>
                              <h2 className="text-xl font-extrabold tracking-tight" style={{ color: BRAND.primary }}>Mentor Roster</h2>
                              <p className="text-xs text-gray-400 mt-0.5">Post-onboarding marketplace profiles — verification, agreements &amp; performance</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => refetchMentors()}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-gray-500 border border-gray-200 hover:border-gray-300 hover:text-gray-700 transition-all bg-white"
                                data-testid="button-refresh-mentors">
                                <RefreshCw size={12} />
                                Refresh
                              </button>
                              <button onClick={() => setInviteMentorModal(true)}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 shadow-sm"
                                style={{ backgroundColor: BRAND.primary }}
                                data-testid="button-invite-mentor">
                                <UserPlus size={12} />
                                Invite Mentor
                              </button>
                            </div>
                          </div>
                          {/* ── Stat Strip ─── */}
                          <div className="grid grid-cols-6 gap-3">
                            {heroStats.map((s) => (
                              <div key={s.label} className="rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2.5 flex flex-col gap-1" style={{ borderLeftWidth: 3, borderLeftColor: s.accent }}>
                                <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-gray-400">{s.label}</span>
                                <span className="text-xl font-extrabold leading-none" style={{ color: s.accent }}>{s.value}</span>
                                <span className="text-[10px] text-gray-400 leading-tight">{s.sub}</span>
                              </div>
                            ))}
                          </div>
                          {suspendedCount > 0 && (
                            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
                              <svg className="h-3.5 w-3.5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                              <p className="text-xs font-semibold text-red-700">{suspendedCount} mentor{suspendedCount > 1 ? 's' : ''} suspended — review their profiles</p>
                            </div>
                          )}
                        </div>

                        {/* ── Area Filter Tabs ───────────────────────────── */}
                        <div className="bg-white rounded-xl border border-[#E2E8F0] px-4 py-3 space-y-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            {([
                              { id: 'all' as const, label: 'All Areas', color: BRAND.primary, cnt: mentors.length },
                              { id: 'lbi' as const, label: 'LBI / Schools', color: '#344E86', cnt: mentors.filter((m: any) => MENTOR_AREAS['lbi'].roles.includes(m.mentorType)).length },
                              { id: 'employability' as const, label: 'Employability', color: '#10B981', cnt: mentors.filter((m: any) => MENTOR_AREAS['employability'].roles.includes(m.mentorType)).length },
                              { id: 'enterprise' as const, label: 'Enterprise', color: '#F97316', cnt: mentors.filter((m: any) => MENTOR_AREAS['enterprise'].roles.includes(m.mentorType)).length },
                            ]).map(({ id, label, color, cnt }) => {
                              const isActive = mentorAreaFilter === id;
                              return (
                                <button key={id} onClick={() => { setMentorAreaFilter(id); setMentorTypeFilter('all'); }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all"
                                  style={{
                                    backgroundColor: isActive ? color : 'transparent',
                                    color: isActive ? '#fff' : '#64748b',
                                    borderColor: isActive ? color : '#e2e8f0',
                                  }}>
                                  {label}
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'}`}>{cnt}</span>
                                </button>
                              );
                            })}
                            {/* Status filter */}
                            <div className="ml-auto flex items-center gap-1.5">
                              {[{ v: 'all', label: 'All' }, { v: 'active', label: 'Active' }, { v: 'warning', label: 'Warning' }, { v: 'suspended', label: 'Suspended' }].map(({ v, label }) => (
                                <button key={v} onClick={() => setMentorStatusFilter(v)}
                                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all"
                                  style={{ backgroundColor: mentorStatusFilter === v ? BRAND.primary : 'transparent', color: mentorStatusFilter === v ? '#fff' : '#64748b', borderColor: mentorStatusFilter === v ? BRAND.primary : '#e2e8f0' }}>
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                          {/* Role sub-filters */}
                          {mentorAreaFilter !== 'all' && (
                            <div className="flex gap-1.5 flex-wrap">
                              <button onClick={() => setMentorTypeFilter('all')}
                                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${mentorTypeFilter === 'all' ? 'text-white border-transparent' : 'bg-transparent text-gray-500 border-gray-200 hover:border-gray-300'}`}
                                style={mentorTypeFilter === 'all' ? { backgroundColor: MENTOR_AREAS[mentorAreaFilter].color, borderColor: MENTOR_AREAS[mentorAreaFilter].color } : {}}>
                                All Roles
                              </button>
                              {activeAreaRoles.map((rk) => {
                                const rm = ROLE_META[rk];
                                if (!rm) return null;
                                const cnt = mentors.filter((m: any) => m.mentorType === rk).length;
                                const isSel = mentorTypeFilter === rk;
                                return (
                                  <button key={rk} onClick={() => setMentorTypeFilter(rk)}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all"
                                    style={{ backgroundColor: isSel ? rm.color : `${rm.color}12`, color: isSel ? '#fff' : rm.color, borderColor: isSel ? rm.color : `${rm.color}30` }}>
                                    {rm.label}
                                    {cnt > 0 && <span className={`text-[9px] font-bold px-1 rounded-full ${isSel ? 'bg-white/25' : 'bg-white/70'}`}>{cnt}</span>}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* ── Enterprise Toolbar ─────────────────────────── */}
                        <div className="bg-white rounded-xl border border-[#E2E8F0] px-4 py-3">
                          <div className="flex items-center gap-3 flex-wrap">
                            {/* Search */}
                            <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                              <Search size={13} className="text-gray-400 flex-shrink-0" />
                              <input
                                type="text"
                                placeholder="Search mentors by name, code, specialization…"
                                value={mentorSearchQuery}
                                onChange={e => setMentorSearchQuery(e.target.value)}
                                className="flex-1 bg-transparent text-xs text-gray-700 placeholder-gray-400 outline-none"
                                data-testid="input-mentor-search"
                              />
                              {mentorSearchQuery && (
                                <button onClick={() => setMentorSearchQuery('')} className="text-gray-400 hover:text-gray-600">
                                  <X size={11} />
                                </button>
                              )}
                            </div>
                            {/* Sort */}
                            <select value={mentorSortBy} onChange={e => setMentorSortBy(e.target.value as any)}
                              className="text-xs border border-gray-200 rounded-lg px-2.5 py-2 text-gray-600 bg-white outline-none cursor-pointer hover:border-gray-300">
                              <option value="name">Sort: Name</option>
                              <option value="rating">Sort: Rating</option>
                              <option value="sessions">Sort: Sessions</option>
                              <option value="phi">Sort: PHI</option>
                              <option value="revenue">Sort: Rate</option>
                              <option value="joined">Sort: Newest</option>
                            </select>
                            {/* Count */}
                            <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">
                              {filteredMentors.length} mentor{filteredMentors.length !== 1 ? 's' : ''}
                            </span>
                            {/* Divider */}
                            <div className="h-5 w-px bg-gray-200" />
                            {/* View toggle */}
                            <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden">
                              <button onClick={() => setMentorViewMode('grid')}
                                className={`px-2.5 py-1.5 transition-colors ${mentorViewMode === 'grid' ? 'text-white' : 'text-gray-400 hover:text-gray-600 bg-white'}`}
                                style={{ backgroundColor: mentorViewMode === 'grid' ? BRAND.primary : '' }}
                                title="Grid view" data-testid="button-mentor-grid-view">
                                <LayoutGrid size={13} />
                              </button>
                              <button onClick={() => setMentorViewMode('list')}
                                className={`px-2.5 py-1.5 transition-colors border-l border-gray-200 ${mentorViewMode === 'list' ? 'text-white' : 'text-gray-400 hover:text-gray-600 bg-white'}`}
                                style={{ backgroundColor: mentorViewMode === 'list' ? BRAND.primary : '' }}
                                title="List view" data-testid="button-mentor-list-view">
                                <LayoutList size={13} />
                              </button>
                            </div>
                            {/* Export */}
                            <button onClick={() => {
                              const rows = [
                                ['Name','Email','Code','Type','Status','Rating','Sessions','PHI'],
                                ...sortedMentors.map((m: any) => [
                                  m.displayName||m.fullName,'',m.mentorCode||'',
                                  m.mentorType?.replace(/_/g,' ')||'',m.status||'',
                                  m.rating||'0',m.totalSessions||0,m.performanceHealthIndex||100
                                ])
                              ];
                              const csv = rows.map((r: any[]) => r.map((c: any) => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
                              const blob = new Blob([csv], {type:'text/csv'});
                              const a = document.createElement('a');
                              a.href = URL.createObjectURL(blob);
                              a.download = `mentors-${new Date().toISOString().slice(0,10)}.csv`;
                              a.click();
                            }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-800 bg-white transition-all" data-testid="button-mentor-export">
                              <Download size={12} />
                              Export CSV
                            </button>
                          </div>
                          {/* Bulk action bar */}
                          {mentorSelectedIds.size > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3">
                              <span className="text-xs font-semibold text-gray-600">{mentorSelectedIds.size} selected</span>
                              <button onClick={() => setMentorSelectedIds(new Set())} className="text-xs text-gray-400 hover:text-gray-600 underline">Clear</button>
                              <div className="flex items-center gap-2 ml-auto">
                                <button disabled={mentorBulkActionLoading} onClick={() => {
                                  alert('Use the Notify button on individual mentor profiles to send targeted messages.');
                                }} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: BRAND.primary }}>Bulk Notify</button>
                                <button disabled={mentorBulkActionLoading} onClick={async () => {
                                  if (!confirm(`Suspend ${mentorSelectedIds.size} mentor(s)? This will restrict their access.`)) return;
                                  setMentorBulkActionLoading(true);
                                  await Promise.all(Array.from(mentorSelectedIds).map((id: any) => fetch(`/api/admin/mentors/${id}/status`, { method: 'PATCH', credentials: 'include', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ status: 'suspended' }) })));
                                  setMentorBulkActionLoading(false); setMentorSelectedIds(new Set()); refetchMentors();
                                }} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50">{mentorBulkActionLoading ? 'Processing…' : 'Suspend All'}</button>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}

                  {/* List + Detail Panel */}
                  {(() => {
                    const ROLE_META: Record<string, { label: string; area: string; color: string }> = {
                      subject_tutor:            { label: 'Subject Tutor',            area: 'LBI',          color: '#344E86' },
                      exam_strategist:          { label: 'Exam Strategist',          area: 'LBI',          color: '#3B82F6' },
                      performance_coach:        { label: 'Performance Coach',        area: 'LBI',          color: '#6366F1' },
                      psychological_counsellor: { label: 'Psychological Counsellor', area: 'LBI',          color: '#8B5CF6' },
                      career_counsellor:        { label: 'Career Counsellor',        area: 'Employability', color: '#10B981' },
                      employability_coach:      { label: 'Employability Coach',      area: 'Employability', color: '#059669' },
                      interview_coach:          { label: 'Interview Coach',           area: 'Employability', color: '#0D9488' },
                      leadership_coach:         { label: 'Leadership Coach',          area: 'Enterprise',   color: '#F59E0B' },
                      hr_consultant:            { label: 'HR Consultant',             area: 'Enterprise',   color: '#F97316' },
                      corporate_trainer:        { label: 'Corporate Trainer',         area: 'Enterprise',   color: '#EF4444' },
                    };
                    const MENTOR_AREAS: Record<string, string[]> = {
                      lbi: ['subject_tutor','exam_strategist','performance_coach','psychological_counsellor'],
                      employability: ['career_counsellor','employability_coach','interview_coach'],
                      enterprise: ['leadership_coach','hr_consultant','corporate_trainer'],
                    };
                    const filteredMentors = mentors.filter((m: any) => {
                      const q = mentorSearchQuery.toLowerCase();
                      const matchSearch = !q ||
                        m.fullName?.toLowerCase().includes(q) ||
                        m.displayName?.toLowerCase().includes(q) ||
                        m.mentorCode?.toLowerCase().includes(q) ||
                        m.specialization?.toLowerCase().includes(q) ||
                        m.title?.toLowerCase().includes(q) ||
                        m.city?.toLowerCase().includes(q);
                      const matchStatus = mentorStatusFilter === 'all' || m.status === mentorStatusFilter;
                      const matchArea   = mentorAreaFilter === 'all' || MENTOR_AREAS[mentorAreaFilter]?.includes(m.mentorType);
                      const matchType   = mentorTypeFilter === 'all' || m.mentorType === mentorTypeFilter;
                      return matchSearch && matchStatus && matchArea && matchType;
                    });

                    const sortedMentors = [...filteredMentors].sort((a: any, b: any) => {
                      if (mentorSortBy === 'name') return (a.displayName||a.fullName||'').localeCompare(b.displayName||b.fullName||'');
                      if (mentorSortBy === 'rating') return (Number(b.rating)||0) - (Number(a.rating)||0);
                      if (mentorSortBy === 'sessions') return (Number(b.totalSessions)||0) - (Number(a.totalSessions)||0);
                      if (mentorSortBy === 'revenue') return (Number(b.hourlyRate)||0) - (Number(a.hourlyRate)||0);
                      if (mentorSortBy === 'phi') return (Number(b.performanceHealthIndex)||100) - (Number(a.performanceHealthIndex)||100);
                      if (mentorSortBy === 'joined') return (b.id||0) - (a.id||0);
                      return 0;
                    });

                    const RatingStars = ({ rating: ratingRaw }: { rating: number | string | null | undefined }) => {
                      const rating = Number(ratingRaw) || 0;
                      return (
                        <div className="flex items-center gap-0.5">
                          {[1,2,3,4,5].map((s) => (
                            <svg key={s} className={`w-3 h-3 ${s <= Math.round(rating) ? 'text-amber-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                            </svg>
                          ))}
                          {rating > 0 && <span className="text-[10px] text-gray-500 ml-1">{rating.toFixed(1)}</span>}
                        </div>
                      );
                    };

                    return (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Mentor Grid / List */}
                        <div className={selectedMentor ? 'lg:col-span-1' : 'lg:col-span-3'}>
                          {filteredMentors.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-gray-200 p-12 text-center">
                              <GraduationCap className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                              <p className="text-gray-500 font-medium">No mentors match the current filters</p>
                              <p className="text-xs text-gray-400 mt-1">Try adjusting the area, role type, or status filters</p>
                            </div>
                          ) : selectedMentor ? (
                            /* Compact list when detail panel open */
                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                              <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{sortedMentors.length} mentors</p>
                                <span className="text-[10px] text-gray-400">sorted by <strong className="text-gray-600">{mentorSortBy}</strong></span>
                              </div>
                              <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                                {sortedMentors.map((mentor: any) => {
                                  const rm = ROLE_META[mentor.mentorType];
                                  const isSelected = selectedMentor?.id === mentor.id;
                                  const initials = (mentor.displayName || mentor.fullName || '?').split(' ').map((w: string) => w[0]).join('').slice(0,2).toUpperCase();
                                  const phi = Number(mentor.performanceHealthIndex ?? 100);
                                  const phiColor = phi >= 80 ? '#10B981' : phi >= 60 ? '#F59E0B' : '#EF4444';
                                  return (
                                    <div key={mentor.id} className={`px-3 py-2.5 cursor-pointer transition-all ${isSelected ? 'border-l-2' : 'hover:bg-gray-50 border-l-2 border-transparent'}`}
                                      style={{ borderLeftColor: isSelected ? BRAND.primary : 'transparent', backgroundColor: isSelected ? `${BRAND.primary}06` : '' }}
                                      onClick={() => { setSelectedMentor(mentor); setMentorProfileSubTab('profile'); }} data-testid={`mentor-profile-row-${mentor.id}`}>
                                      <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: rm?.color || BRAND.primary }}>{initials}</div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1">
                                            <p className="text-xs font-semibold text-gray-800 truncate">{mentor.displayName || mentor.fullName}</p>
                                            {mentor.isVerified && <svg className="h-3 w-3 text-teal-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
                                          </div>
                                          <div className="flex items-center gap-2 mt-0.5">
                                            {rm && <p className="text-[10px] text-gray-400">{rm.label}</p>}
                                            <span className="text-[9px] font-bold px-1 rounded" style={{ backgroundColor: `${phiColor}18`, color: phiColor }}>PHI {phi}%</span>
                                          </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-0.5">
                                          {getStatusBadge(mentor.status)}
                                          {Number(mentor.rating) > 0 && <span className="text-[10px] text-amber-500 font-bold">★ {Number(mentor.rating).toFixed(1)}</span>}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            /* Enterprise grid / list view when no mentor selected */
                            mentorViewMode === 'list' ? (
                            /* ─── LIST VIEW ─── */
                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-gray-100 bg-gray-50/80">
                                    <th className="px-3 py-3 w-8">
                                      <input type="checkbox" className="rounded cursor-pointer"
                                        checked={sortedMentors.length > 0 && sortedMentors.every((m: any) => mentorSelectedIds.has(m.id))}
                                        onChange={e => setMentorSelectedIds(e.target.checked ? new Set(sortedMentors.map((m: any) => m.id)) : new Set())} />
                                    </th>
                                    {[['Mentor','text-left'],['Role','text-left'],['Status','text-left'],['Rating','text-right'],['Sessions','text-right'],['Rate /hr','text-right'],['PHI','text-right'],['Actions','text-right']].map(([h, a]) => (
                                      <th key={h as string} className={`px-3 py-3 ${a} text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap`}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                  {sortedMentors.map((mentor: any) => {
                                    const rm = ROLE_META[mentor.mentorType];
                                    const initials = (mentor.displayName || mentor.fullName || '?').split(' ').map((w: string) => w[0]).join('').slice(0,2).toUpperCase();
                                    const phi = Number(mentor.performanceHealthIndex ?? 100);
                                    const phiColor = phi >= 80 ? '#10B981' : phi >= 60 ? '#F59E0B' : '#EF4444';
                                    const isBulkSel = mentorSelectedIds.has(mentor.id);
                                    return (
                                      <tr key={mentor.id} className={`transition-colors ${isBulkSel ? 'bg-blue-50/60' : 'hover:bg-gray-50/70'}`}>
                                        <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                                          <input type="checkbox" className="rounded cursor-pointer" checked={isBulkSel}
                                            onChange={e => { const s = new Set(mentorSelectedIds); e.target.checked ? s.add(mentor.id) : s.delete(mentor.id); setMentorSelectedIds(s); }} />
                                        </td>
                                        <td className="px-3 py-3">
                                          <div className="flex items-center gap-2.5 cursor-pointer group" onClick={() => { setSelectedMentor(mentor); setMentorProfileSubTab('profile'); }}>
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: rm?.color || BRAND.primary }}>{initials}</div>
                                            <div>
                                              <div className="flex items-center gap-1">
                                                <p className="text-xs font-semibold text-gray-800 group-hover:text-[#344E86] transition-colors">{mentor.displayName || mentor.fullName}</p>
                                                {mentor.isVerified && <svg className="h-3 w-3 text-teal-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
                                                {mentor.isFeatured && <svg className="h-3 w-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>}
                                              </div>
                                              {mentor.mentorCode && <code className="text-[9px] px-1 py-0.5 rounded font-mono font-bold" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }}>{mentor.mentorCode}</code>}
                                            </div>
                                          </div>
                                        </td>
                                        <td className="px-3 py-3">
                                          {rm && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor: `${rm.color}15`, color: rm.color }}>{rm.label}</span>}
                                        </td>
                                        <td className="px-3 py-3">{getStatusBadge(mentor.status)}</td>
                                        <td className="px-3 py-3 text-right">
                                          {Number(mentor.rating) > 0 ? <span className="text-xs font-bold text-amber-500 whitespace-nowrap">★ {Number(mentor.rating).toFixed(1)}</span> : <span className="text-[10px] text-gray-300">—</span>}
                                        </td>
                                        <td className="px-3 py-3 text-right"><span className="text-xs font-semibold text-gray-700">{mentor.totalSessions ?? 0}</span></td>
                                        <td className="px-3 py-3 text-right"><span className="text-xs font-semibold text-gray-700 whitespace-nowrap">₹{(mentor.hourlyRate || 0).toLocaleString()}</span></td>
                                        <td className="px-3 py-3 text-right">
                                          <div className="flex items-center justify-end gap-1.5">
                                            <span className="text-[11px] font-extrabold whitespace-nowrap" style={{ color: phiColor }}>{phi}%</span>
                                            <div className="w-12 h-1.5 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
                                              <div className="h-full rounded-full transition-all" style={{ width: `${phi}%`, backgroundColor: phiColor }} />
                                            </div>
                                          </div>
                                        </td>
                                        <td className="px-3 py-3 text-right">
                                          <div className="flex items-center justify-end gap-0.5">
                                            <button title="View Profile" onClick={() => { setSelectedMentor(mentor); setMentorProfileSubTab('profile'); }} className="p-1.5 rounded-lg hover:bg-[#344E86] hover:text-white text-gray-400 transition-colors" style={{ color: 'inherit' }}>
                                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                                            </button>
                                            <button title="Notify" onClick={() => { setSelectedMentor(mentor); setMentorNotifySubject(''); setMentorNotifyMessage(''); setMentorNotifyModal(true); }} className="p-1.5 rounded-lg hover:bg-teal-500 hover:text-white text-gray-400 transition-colors">
                                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                                            </button>
                                            <button title={mentor.status === 'active' ? 'Suspend mentor' : 'Activate mentor'}
                                              onClick={async () => {
                                                const ns = mentor.status === 'active' ? 'suspended' : 'active';
                                                if (!confirm(`${ns === 'suspended' ? 'Suspend' : 'Activate'} ${mentor.fullName}?`)) return;
                                                await fetch(`/api/admin/mentors/${mentor.id}/status`, { method: 'PATCH', credentials: 'include', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ status: ns }) });
                                                refetchMentors();
                                              }}
                                              className={`p-1.5 rounded-lg transition-colors ${mentor.status === 'active' ? 'hover:bg-red-500 hover:text-white text-gray-400' : 'hover:bg-green-500 hover:text-white text-gray-400'}`}>
                                              {mentor.status === 'active'
                                                ? <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                                                : <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                              }
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            ) : (
                            /* ─── GRID VIEW ─── */
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                              {sortedMentors.map((mentor: any) => {
                                const rm = ROLE_META[mentor.mentorType];
                                const initials = (mentor.displayName || mentor.fullName || '?').split(' ').map((w: string) => w[0]).join('').slice(0,2).toUpperCase();
                                const phi = Number(mentor.performanceHealthIndex ?? 100);
                                const phiColor = phi >= 80 ? '#10B981' : phi >= 60 ? '#F59E0B' : '#EF4444';
                                const isBulkSel = mentorSelectedIds.has(mentor.id);
                                return (
                                  <div key={mentor.id}
                                    className={`bg-white rounded-xl border hover:shadow-md transition-all flex flex-col overflow-hidden ${isBulkSel ? 'border-[#344E86] ring-1 ring-[#344E86]/20' : 'border-gray-200 hover:border-[#344E86]/40'}`}
                                    data-testid={`mentor-profile-row-${mentor.id}`}>
                                    {/* Card top accent bar */}
                                    <div className="h-1 w-full" style={{ backgroundColor: rm?.color || BRAND.primary }} />
                                    <div className="p-4 flex flex-col gap-3 flex-1">
                                      {/* Header row */}
                                      <div className="flex items-start gap-3">
                                        <div className="relative flex-shrink-0">
                                          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-extrabold text-white shadow-sm" style={{ backgroundColor: rm?.color || BRAND.primary }}>
                                            {initials}
                                          </div>
                                          <input type="checkbox" className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded cursor-pointer" checked={isBulkSel}
                                            onClick={e => e.stopPropagation()}
                                            onChange={e => { const s = new Set(mentorSelectedIds); e.target.checked ? s.add(mentor.id) : s.delete(mentor.id); setMentorSelectedIds(s); }} />
                                        </div>
                                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setSelectedMentor(mentor); setMentorProfileSubTab('profile'); }}>
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <p className="text-sm font-bold text-gray-900 leading-tight hover:text-[#344E86] transition-colors">{mentor.displayName || mentor.fullName}</p>
                                            {mentor.isVerified && <CheckCircle className="h-3.5 w-3.5 text-teal-500 flex-shrink-0" />}
                                            {mentor.isFeatured && <Star className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />}
                                          </div>
                                          {mentor.mentorCode && (
                                            <code className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }}>{mentor.mentorCode}</code>
                                          )}
                                        </div>
                                        {getStatusBadge(mentor.status)}
                                      </div>
                                      {/* Role + Area */}
                                      {rm && (
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ backgroundColor: `${rm.color}15`, color: rm.color }}>{rm.label}</span>
                                          <span className="text-[10px] text-gray-400">· {rm.area}</span>
                                        </div>
                                      )}
                                      {/* Title */}
                                      {mentor.title && <p className="text-xs text-gray-500 leading-snug line-clamp-2">{mentor.title}</p>}
                                      {/* Rating */}
                                      <div className="flex items-center justify-between">
                                        <RatingStars rating={mentor.rating || 0} />
                                        {mentor.totalReviews > 0 && <span className="text-[10px] text-gray-400">{mentor.totalReviews} review{mentor.totalReviews !== 1 ? 's' : ''}</span>}
                                      </div>
                                      {/* Key stats */}
                                      <div className="grid grid-cols-3 gap-2 py-2 border-t border-b border-gray-100">
                                        <div className="text-center">
                                          <p className="text-sm font-bold text-gray-800">{mentor.experienceYears ?? '—'}</p>
                                          <p className="text-[9px] text-gray-400 uppercase tracking-wide">Yrs Exp</p>
                                        </div>
                                        <div className="text-center border-x border-gray-100">
                                          <p className="text-sm font-bold text-gray-800">{mentor.totalSessions ?? 0}</p>
                                          <p className="text-[9px] text-gray-400 uppercase tracking-wide">Sessions</p>
                                        </div>
                                        <div className="text-center">
                                          <p className="text-sm font-bold text-gray-800">{mentor.hourlyRate ? `₹${mentor.hourlyRate}` : '—'}</p>
                                          <p className="text-[9px] text-gray-400 uppercase tracking-wide">/ hour</p>
                                        </div>
                                      </div>
                                      {/* Mode + City */}
                                      <div className="flex items-center gap-3 text-[11px] text-gray-500">
                                        {mentor.mode && (
                                          <span className="flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                                            {mentor.mode.charAt(0).toUpperCase() + mentor.mode.slice(1)}
                                          </span>
                                        )}
                                        {mentor.city && <span className="text-gray-400">· {mentor.city}</span>}
                                      </div>
                                      {/* PHI bar */}
                                      <div>
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Performance Health</span>
                                          <span className="text-[10px] font-bold" style={{ color: phiColor }}>{phi}%</span>
                                        </div>
                                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                          <div className="h-full rounded-full transition-all" style={{ width: `${phi}%`, backgroundColor: phiColor }} />
                                        </div>
                                      </div>
                                      {/* CTA row */}
                                      <div className="flex gap-1.5 mt-auto pt-1">
                                        <button className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 text-center" style={{ backgroundColor: BRAND.primary }}
                                          onClick={() => { setSelectedMentor(mentor); setMentorProfileSubTab('profile'); }}>
                                          View Profile
                                        </button>
                                        <button title="Send notification" onClick={e => { e.stopPropagation(); setSelectedMentor(mentor); setMentorNotifySubject(''); setMentorNotifyMessage(''); setMentorNotifyModal(true); }}
                                          className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-400 hover:border-teal-400 hover:text-teal-500 transition-colors">
                                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                                        </button>
                                        <button title={mentor.status === 'active' ? 'Suspend mentor' : 'Activate mentor'}
                                          onClick={async e => { e.stopPropagation(); const ns = mentor.status === 'active' ? 'suspended' : 'active'; if (!confirm(`${ns === 'suspended' ? 'Suspend' : 'Activate'} ${mentor.fullName}?`)) return; await fetch(`/api/admin/mentors/${mentor.id}/status`, { method: 'PATCH', credentials: 'include', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ status: ns }) }); refetchMentors(); }}
                                          className={`px-2.5 py-1.5 rounded-lg border transition-colors ${mentor.status === 'active' ? 'border-gray-200 text-gray-400 hover:border-red-400 hover:text-red-500' : 'border-gray-200 text-gray-400 hover:border-green-400 hover:text-green-500'}`}>
                                          {mentor.status === 'active'
                                            ? <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                                            : <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                          }
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            )
                          )}
                        </div>

                    {/* Profile Detail Panel */}
                    {selectedMentor && (
                      <div className="lg:col-span-2">
                        <Card>
                          <CardHeader className="border-b">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}15` }}>
                                  <GraduationCap className="h-7 w-7" style={{ color: BRAND.accent }} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <CardTitle>{selectedMentor.fullName}</CardTitle>
                                    {selectedMentor.isVerified && <CheckCircle className="h-4 w-4 text-teal-500" />}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    {selectedMentor.mentorCode && (
                                      <code className="text-xs px-2 py-0.5 rounded bg-gray-100 font-mono font-bold">{selectedMentor.mentorCode}</code>
                                    )}
                                    {getStatusBadge(selectedMentor.status)}
                                    {selectedMentor.isFeatured && (
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">Featured</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {onNavigate && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => onNavigate('mentor-marketplace')}
                                    className="text-xs"
                                    data-testid="button-view-mentor-marketplace"
                                  >
                                    <svg className="h-3.5 w-3.5 mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                    View Marketplace
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  style={{ borderColor: BRAND.accent, color: BRAND.accent }}
                                  data-testid="button-edit-marketplace-profile"
                                  onClick={async () => {
                                    try {
                                      const res = await fetch(`/api/admin/mentors/${selectedMentor.id}/profile`, { credentials: 'include' });
                                      const profile = res.ok ? await res.json() : {};
                                      setMentorProfileForm({
                                        displayName: profile.display_name || selectedMentor.fullName || '',
                                        title: profile.title || '',
                                        bio: profile.bio || '',
                                        mentorType: profile.mentor_type || 'subject_tutor',
                                        subjects: (profile.subjects || []).join(', '),
                                        psychologicalAreas: (profile.psychological_areas || []).join(', '),
                                        specializations: (profile.specializations || []).join(', '),
                                        languages: (profile.languages || []).join(', '),
                                        experienceYears: profile.experience_years || 0,
                                        hourlyRate: profile.hourly_rate || 0,
                                        currency: profile.currency || 'INR',
                                        mode: profile.mode || 'online',
                                        city: profile.city || '',
                                        certifications: (profile.certifications || []).join(', '),
                                        profileImageUrl: profile.profile_image_url || '',
                                        linkedinUrl: profile.linkedin_url || '',
                                        isVerified: profile.is_verified || false,
                                        isFeatured: profile.is_featured || false,
                                        status: profile.status || 'pending',
                                      });
                                      setMentorProfileModal({ open: true, mentor: selectedMentor });
                                    } catch {
                                      setMentorProfileForm({
                                        displayName: selectedMentor.fullName || '',
                                        mentorType: 'subject_tutor', mode: 'online',
                                        currency: 'INR', isVerified: false, isFeatured: false, status: 'pending',
                                      });
                                      setMentorProfileModal({ open: true, mentor: selectedMentor });
                                    }
                                  }}
                                >
                                  <Star className="h-4 w-4 mr-1" /> Edit Profile
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs"
                                  data-testid="button-notify-mentor"
                                  onClick={() => { setMentorNotifySubject(''); setMentorNotifyMessage(''); setMentorNotifyModal(true); }}
                                >
                                  <Bell className="h-3.5 w-3.5 mr-1" /> Notify
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs"
                                  data-testid="button-reset-mentor-password"
                                  onClick={async () => {
                                    if (!confirm(`Reset password for ${selectedMentor.fullName}? A new temporary password will be emailed to them.`)) return;
                                    try {
                                      const res = await fetch(`/api/admin/mentors/${selectedMentor.id}/reset-password`, { method: 'POST', credentials: 'include' });
                                      const d = await res.json();
                                      if (d.success) alert(`Password reset. Temp password: ${d.tempPassword}`);
                                      else alert(d.error || 'Failed');
                                    } catch { alert('Error resetting password'); }
                                  }}
                                >
                                  <Key className="h-3.5 w-3.5 mr-1" /> Reset Pwd
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs"
                                  data-testid="button-adjust-phi"
                                  onClick={() => { setMentorPhiValue(selectedMentor.performanceHealthIndex ?? 100); setMentorAdjPhiModal(true); }}
                                >
                                  <Activity className="h-3.5 w-3.5 mr-1" /> PHI
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedMentor(null)}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>

                          {/* Profile Sub-tabs — 8 tabs */}
                          <div className="border-b px-2 overflow-x-auto">
                            <div className="flex gap-1 min-w-max">
                              {([
                                { id: 'profile', label: 'Profile' },
                                { id: 'onboarding', label: 'Onboarding' },
                                { id: 'marketplace', label: 'Marketplace' },
                                { id: 'responsibilities', label: 'Responsibilities' },
                                { id: 'bookings', label: 'Bookings' },
                                { id: 'rating', label: 'Rating' },
                                { id: 'tasks', label: 'Tasks' },
                                { id: 'kpis', label: 'KPIs' },
                                { id: 'agreement', label: 'Agreement' },
                              ] as const).map(tab => (
                                <button
                                  key={tab.id}
                                  className={`py-3 px-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${mentorProfileSubTab === tab.id ? 'border-current' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                  style={{ color: mentorProfileSubTab === tab.id ? BRAND.primary : undefined }}
                                  onClick={() => setMentorProfileSubTab(tab.id)}
                                  data-testid={`tab-mentor-profile-${tab.id}`}
                                >
                                  {tab.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <CardContent className="p-4 max-h-[480px] overflow-y-auto">

                            {/* ── Profile Tab ── */}
                            {mentorProfileSubTab === 'profile' && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  {[
                                    { label: 'Email', value: selectedMentor.email },
                                    { label: 'Phone', value: selectedMentor.phone || 'N/A' },
                                    { label: 'Title', value: selectedMentor.title || 'N/A' },
                                    { label: 'Mentor Type', value: selectedMentor.mentorType?.replace(/_/g, ' ') || 'N/A' },
                                    { label: 'Specialization', value: selectedMentor.specialization || 'N/A' },
                                    { label: 'Qualifications', value: selectedMentor.qualifications || 'N/A' },
                                    { label: 'Experience', value: selectedMentor.experienceYears ? `${selectedMentor.experienceYears} years` : 'N/A' },
                                    { label: 'City', value: selectedMentor.city || 'N/A' },
                                    { label: 'Activated At', value: selectedMentor.activatedAt ? new Date(selectedMentor.activatedAt).toLocaleDateString() : 'Not yet' },
                                    { label: 'Profile Status', value: selectedMentor.profileStatus || selectedMentor.status || 'N/A' },
                                  ].map(({ label, value }) => (
                                    <div key={label} className="space-y-0.5">
                                      <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium">{label}</p>
                                      <p className="text-sm font-medium text-gray-800 capitalize">{value}</p>
                                    </div>
                                  ))}
                                </div>
                                {selectedMentor.bio && (
                                  <div className="space-y-1 pt-2 border-t border-gray-100">
                                    <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium">Bio</p>
                                    <p className="text-sm text-gray-700 leading-relaxed">{selectedMentor.bio}</p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* ── Onboarding Pipeline Tab ── */}
                            {mentorProfileSubTab === 'onboarding' && (() => {
                              const ob = mentorOnboarding;
                              const p = ob?.profile;
                              const STAGES = [
                                { key: 'application',        label: 'Application',         sub: 'Candidate applied and shortlisted' },
                                { key: 'training',           label: 'Training Programme',  sub: 'Paid training programme in progress' },
                                { key: 'assessment',         label: 'Assessment',          sub: 'Post-training evaluation conducted' },
                                { key: 'temp_code_generated',label: 'Temporary Code',      sub: 'Temporary mentor code issued' },
                                { key: 'kyc_upload',         label: 'KYC Documents',       sub: 'Identity and credential verification' },
                                { key: 'profiler',           label: 'Detailed Profiler',   sub: 'Core delivery areas completed' },
                                { key: 'activated',          label: 'Activated',           sub: 'Full platform access granted' },
                              ];
                              const currentIdx = STAGES.findIndex(s => s.key === p?.onboardingStage);
                              const nextStage = STAGES[currentIdx + 1];

                              const stageColor = (idx: number) => {
                                if (idx < currentIdx) return '#22c55e';
                                if (idx === currentIdx) return BRAND.primary;
                                return '#e5e7eb';
                              };
                              const stageLabelColor = (idx: number) => {
                                if (idx <= currentIdx) return '#111827';
                                return '#9ca3af';
                              };

                              return (
                                <div className="space-y-5">
                                  {/* Header actions */}
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm font-semibold text-gray-800">Onboarding Pipeline</p>
                                      <p className="text-xs text-gray-500 mt-0.5">Pre-activation journey for {selectedMentor.displayName || selectedMentor.fullName}</p>
                                    </div>
                                    <Button size="sm" variant="outline" onClick={() => refetchMentorOnboarding()} data-testid="button-refresh-onboarding">
                                      <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
                                    </Button>
                                  </div>

                                  {!ob ? (
                                    <div className="text-center py-8 text-gray-400 text-sm">Loading onboarding data...</div>
                                  ) : (
                                    <>
                                      {/* Stage Progress Tracker */}
                                      <div className="border border-gray-100 rounded-lg p-4 bg-gray-50">
                                        <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium mb-4">Pipeline Progress</p>
                                        <div className="relative">
                                          <div className="flex items-start justify-between gap-1">
                                            {STAGES.map((stage, idx) => (
                                              <div key={stage.key} className="flex-1 flex flex-col items-center gap-1">
                                                <div className="relative flex flex-col items-center w-full">
                                                  {idx < STAGES.length - 1 && (
                                                    <div
                                                      className="absolute top-4 left-1/2 w-full h-0.5 z-0"
                                                      style={{ backgroundColor: idx < currentIdx ? '#22c55e' : '#e5e7eb' }}
                                                    />
                                                  )}
                                                  <div
                                                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold z-10 relative border-2"
                                                    style={{
                                                      backgroundColor: idx <= currentIdx ? stageColor(idx) : '#f9fafb',
                                                      borderColor: stageColor(idx),
                                                      color: idx <= currentIdx ? '#fff' : '#9ca3af'
                                                    }}
                                                  >
                                                    {idx < currentIdx ? '✓' : idx + 1}
                                                  </div>
                                                </div>
                                                <p className="text-[10px] font-semibold text-center leading-tight mt-1" style={{ color: stageLabelColor(idx) }}>
                                                  {stage.label}
                                                </p>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Stage Details */}
                                      <div className="grid grid-cols-2 gap-3">
                                        {[
                                          { label: 'Current Stage', value: p?.onboardingStage?.replace(/_/g, ' ') || 'Application' },
                                          { label: 'Activated At', value: p?.activatedAt ? new Date(p.activatedAt).toLocaleDateString() : 'Not yet' },
                                          { label: 'Training Started', value: p?.trainingStartedAt ? new Date(p.trainingStartedAt).toLocaleDateString() : 'Not yet' },
                                          { label: 'Training Completed', value: p?.trainingCompletedAt ? new Date(p.trainingCompletedAt).toLocaleDateString() : 'Not yet' },
                                          { label: 'Assessment Completed', value: p?.assessmentCompletedAt ? new Date(p.assessmentCompletedAt).toLocaleDateString() : 'Not yet' },
                                          { label: 'Temp Code Issued', value: p?.tempCodeGeneratedAt ? new Date(p.tempCodeGeneratedAt).toLocaleDateString() : 'Not yet' },
                                        ].map(({ label, value }) => (
                                          <div key={label} className="p-3 rounded-lg border border-gray-100 bg-white space-y-0.5">
                                            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">{label}</p>
                                            <p className="text-xs font-semibold text-gray-800 capitalize">{value}</p>
                                          </div>
                                        ))}
                                      </div>

                                      {/* Temporary Mentor Code */}
                                      {p?.tempCode && (
                                        <div className="p-3 rounded-lg border border-amber-200 bg-amber-50">
                                          <p className="text-[10px] text-amber-600 uppercase tracking-wide font-medium mb-1">Temporary Mentor Code</p>
                                          <div className="flex items-center gap-3">
                                            <code className="text-sm font-mono font-bold text-amber-800 bg-amber-100 px-3 py-1.5 rounded">
                                              {p.tempCode}
                                            </code>
                                            <span className="text-[10px] text-amber-600">
                                              Issued: {p.tempCodeGeneratedAt ? new Date(p.tempCodeGeneratedAt).toLocaleDateString() : '—'}
                                            </span>
                                          </div>
                                          <p className="text-[10px] text-amber-600 mt-1">Valid until KYC verification and full activation. Not for public use.</p>
                                        </div>
                                      )}

                                      {/* Delivery Information */}
                                      <div className="p-3 rounded-lg border border-gray-100 bg-white space-y-1.5">
                                        <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Session Delivery</p>
                                        <div className="grid grid-cols-2 gap-3">
                                          <div>
                                            <p className="text-[10px] text-gray-400">Mode</p>
                                            <p className="text-xs font-semibold text-gray-800 capitalize">{p?.mode || selectedMentor.mode || 'Online'}</p>
                                          </div>
                                          <div>
                                            <p className="text-[10px] text-gray-400">Delivery Link</p>
                                            {p?.deliveryLink ? (
                                              <a href={p.deliveryLink} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blue-600 hover:underline truncate block max-w-[140px]">
                                                {p.deliveryLink}
                                              </a>
                                            ) : (
                                              <p className="text-xs text-gray-400 italic">Shared via email on activation</p>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      {/* KYC Documents */}
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                          <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium">KYC Documents</p>
                                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                            p?.kycStatus === 'verified' ? 'bg-green-100 text-green-700' :
                                            p?.kycStatus === 'submitted' ? 'bg-blue-100 text-blue-700' :
                                            'bg-gray-100 text-gray-500'
                                          }`}>
                                            {p?.kycStatus?.toUpperCase() || 'PENDING'}
                                          </span>
                                        </div>
                                        {p?.kycSubmittedAt && (
                                          <p className="text-[10px] text-gray-400">Submitted: {new Date(p.kycSubmittedAt).toLocaleDateString()}{p?.kycVerifiedAt ? ` · Verified: ${new Date(p.kycVerifiedAt).toLocaleDateString()}` : ''}</p>
                                        )}
                                        {(ob.kycDocuments || []).length > 0 ? (
                                          <div className="border border-gray-100 rounded-lg overflow-hidden">
                                            <table className="w-full text-xs">
                                              <thead className="bg-gray-50">
                                                <tr>
                                                  <th className="text-left px-3 py-2 text-[10px] text-gray-400 font-medium uppercase tracking-wide">Document</th>
                                                  <th className="text-left px-3 py-2 text-[10px] text-gray-400 font-medium uppercase tracking-wide">Type</th>
                                                  <th className="text-left px-3 py-2 text-[10px] text-gray-400 font-medium uppercase tracking-wide">Status</th>
                                                  <th className="text-left px-3 py-2 text-[10px] text-gray-400 font-medium uppercase tracking-wide">Date</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {(ob.kycDocuments || []).map((doc: any) => (
                                                  <tr key={doc.id} className="border-t border-gray-50">
                                                    <td className="px-3 py-2 font-medium text-gray-800">{doc.document_name}</td>
                                                    <td className="px-3 py-2 text-gray-500 capitalize">{doc.document_type?.replace(/_/g, ' ')}</td>
                                                    <td className="px-3 py-2">
                                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                                        doc.status === 'verified' ? 'bg-green-100 text-green-700' :
                                                        doc.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
                                                        'bg-gray-100 text-gray-500'
                                                      }`}>{doc.status}</span>
                                                    </td>
                                                    <td className="px-3 py-2 text-gray-400">{new Date(doc.created_at).toLocaleDateString()}</td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        ) : (
                                          <div className="p-3 rounded-lg border border-dashed border-gray-200 text-center">
                                            <p className="text-xs text-gray-400">No KYC documents uploaded yet.</p>
                                          </div>
                                        )}
                                      </div>

                                      {/* Detailed Profiler */}
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                          <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium">Detailed Profiler</p>
                                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                            p?.profilerStatus === 'completed' ? 'bg-green-100 text-green-700' :
                                            p?.profilerStatus === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                            'bg-gray-100 text-gray-500'
                                          }`}>
                                            {p?.profilerStatus === 'completed' ? 'COMPLETED' :
                                             p?.profilerStatus === 'in_progress' ? 'IN PROGRESS' : 'PENDING'}
                                          </span>
                                        </div>

                                        {/* Core Delivery Areas — no emojis */}
                                        <div className="border border-gray-100 rounded-lg overflow-hidden">
                                          <div className="bg-gray-50 px-3 py-2 border-b border-gray-100">
                                            <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">Core Delivery Areas</p>
                                          </div>
                                          <div className="divide-y divide-gray-50">
                                            {[
                                              { label: 'Subject Instruction', value: (p?.subjects || selectedMentor.subjects || []).join(', ') || 'Not assigned' },
                                              { label: 'Psychological Coaching', value: (p?.psychologicalAreas || selectedMentor.psychologicalAreas || []).join(', ') || 'Not assigned' },
                                              { label: 'Specialization Focus', value: p?.specialization || selectedMentor.specialization || 'Not specified' },
                                              { label: 'Delivery Mode', value: (() => { const m = p?.mode || selectedMentor.mode; return m ? m.charAt(0).toUpperCase() + m.slice(1) : 'Online'; })() },
                                            ].map(({ label, value }) => (
                                              <div key={label} className="flex items-start justify-between px-3 py-2.5">
                                                <p className="text-xs text-gray-500 font-medium w-40 flex-shrink-0">{label}</p>
                                                <p className="text-xs text-gray-800 font-semibold text-right flex-1">{value}</p>
                                              </div>
                                            ))}
                                          </div>
                                        </div>

                                        {/* Additional Profiler Fields */}
                                        <div className="border border-gray-100 rounded-lg overflow-hidden">
                                          <div className="bg-gray-50 px-3 py-2 border-b border-gray-100">
                                            <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">Professional Profile</p>
                                          </div>
                                          <div className="divide-y divide-gray-50">
                                            {[
                                              { label: 'Mentor Type', value: (p?.mentorType || selectedMentor.mentorType || '').replace(/_/g, ' ') || 'Not set' },
                                              { label: 'Area of Practice', value: selectedMentor.area || 'Not assigned' },
                                              { label: 'Qualifications', value: selectedMentor.qualifications || 'Not specified' },
                                              { label: 'Experience', value: selectedMentor.experienceYears ? `${selectedMentor.experienceYears} years` : 'Not specified' },
                                              { label: 'Agreement Status', value: (p?.agreementStatus || selectedMentor.agreementStatus || 'Not sent').replace(/_/g, ' ') },
                                            ].map(({ label, value }) => (
                                              <div key={label} className="flex items-start justify-between px-3 py-2.5">
                                                <p className="text-xs text-gray-500 font-medium w-40 flex-shrink-0">{label}</p>
                                                <p className="text-xs text-gray-800 font-semibold text-right flex-1 capitalize">{value}</p>
                                              </div>
                                            ))}
                                          </div>
                                        </div>

                                        {p?.profilerCompletedAt && (
                                          <p className="text-[10px] text-gray-400">Profiler completed: {new Date(p.profilerCompletedAt).toLocaleDateString()}</p>
                                        )}
                                      </div>

                                      {/* Advance Stage Action */}
                                      {nextStage && p?.onboardingStage !== 'activated' && (
                                        <div className="p-3 rounded-lg border border-blue-100 bg-blue-50">
                                          <p className="text-[10px] text-blue-600 uppercase tracking-wide font-medium mb-2">Next Action</p>
                                          <div className="flex items-center justify-between gap-3">
                                            <div>
                                              <p className="text-xs font-semibold text-blue-900">{nextStage.label}</p>
                                              <p className="text-[10px] text-blue-600">{nextStage.sub}</p>
                                            </div>
                                            <Button
                                              size="sm"
                                              onClick={() => advanceOnboardingStageMutation.mutate({ id: selectedMentor.id, stage: nextStage.key })}
                                              disabled={advanceOnboardingStageMutation.isPending}
                                              style={{ backgroundColor: BRAND.primary }}
                                              data-testid={`button-advance-stage-${nextStage.key}`}
                                            >
                                              {advanceOnboardingStageMutation.isPending ? 'Advancing...' : `Advance to ${nextStage.label}`}
                                            </Button>
                                          </div>
                                          {nextStage.key === 'activated' && (
                                            <p className="text-[10px] text-blue-500 mt-2">Activation will notify the mentor with their permanent code and dynamic session link via email.</p>
                                          )}
                                        </div>
                                      )}

                                      {p?.onboardingStage === 'activated' && (
                                        <div className="p-3 rounded-lg border border-green-200 bg-green-50">
                                          <div className="flex items-center gap-2">
                                            <CheckCircle className="h-4 w-4 text-green-600" />
                                            <div>
                                              <p className="text-xs font-semibold text-green-800">Mentor Fully Activated</p>
                                              <p className="text-[10px] text-green-600">All onboarding stages completed. Mentor has full platform access.</p>
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {/* Notification History */}
                                      {(ob.notifications || []).length > 0 && (
                                        <div className="space-y-2">
                                          <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium">Notification History</p>
                                          <div className="border border-gray-100 rounded-lg overflow-hidden">
                                            <div className="divide-y divide-gray-50 max-h-40 overflow-y-auto">
                                              {(ob.notifications || []).map((n: any) => (
                                                <div key={n.id} className="flex items-start justify-between px-3 py-2">
                                                  <div>
                                                    <p className="text-xs font-medium text-gray-700">{n.message}</p>
                                                    <p className="text-[10px] text-gray-400">{n.sent_to}</p>
                                                  </div>
                                                  <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                                                    {new Date(n.sent_at).toLocaleDateString()}
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {/* Application Record */}
                                      {ob.application && (
                                        <div className="space-y-1.5">
                                          <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium">Application Record</p>
                                          <div className="p-3 rounded-lg border border-gray-100 bg-white grid grid-cols-2 gap-3">
                                            {[
                                              { label: 'Applicant', value: ob.application.full_name },
                                              { label: 'Status at Hire', value: ob.application.status?.replace(/_/g, ' ') },
                                              { label: 'Applied On', value: new Date(ob.application.created_at).toLocaleDateString() },
                                              { label: 'Payment Confirmed', value: ob.application.membership_paid_at ? new Date(ob.application.membership_paid_at).toLocaleDateString() : 'N/A' },
                                            ].map(({ label, value }) => (
                                              <div key={label}>
                                                <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
                                                <p className="text-xs font-semibold text-gray-800 capitalize">{value}</p>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              );
                            })()}

                            {/* ── Marketplace Tab ── */}
                            {mentorProfileSubTab === 'marketplace' && (
                              <div className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="p-3 rounded-lg border border-gray-100 bg-gray-50 space-y-0.5">
                                    <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium">Hourly Rate</p>
                                    <p className="text-lg font-bold" style={{ color: BRAND.primary }}>
                                      {selectedMentor.hourlyRate ? `${selectedMentor.currency || '₹'} ${selectedMentor.hourlyRate}` : 'Not set'}
                                    </p>
                                  </div>
                                  <div className="p-3 rounded-lg border border-gray-100 bg-gray-50 space-y-0.5">
                                    <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium">Total Sessions</p>
                                    <p className="text-lg font-bold" style={{ color: BRAND.accent }}>{selectedMentor.totalSessions || 0}</p>
                                  </div>
                                  <div className="p-3 rounded-lg border border-gray-100 bg-gray-50 space-y-0.5">
                                    <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium">Platform Rating</p>
                                    <p className="text-lg font-bold text-amber-500">
                                      {selectedMentor.rating ? `${selectedMentor.rating} / 5` : '—'}
                                    </p>
                                    <p className="text-[10px] text-gray-400">{selectedMentor.totalReviews || 0} reviews</p>
                                  </div>
                                  <div className="p-3 rounded-lg border border-gray-100 bg-gray-50 space-y-0.5">
                                    <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium">Mode</p>
                                    <p className="text-sm font-bold capitalize text-gray-800">{selectedMentor.mode || 'N/A'}</p>
                                  </div>
                                </div>
                                <div className="flex gap-3">
                                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border flex-1 justify-center ${selectedMentor.isVerified ? 'bg-teal-50 border-teal-200' : 'bg-gray-50 border-gray-200'}`}>
                                    <CheckCircle className={`h-4 w-4 ${selectedMentor.isVerified ? 'text-teal-600' : 'text-gray-400'}`} />
                                    <span className={`text-xs font-semibold ${selectedMentor.isVerified ? 'text-teal-700' : 'text-gray-500'}`}>
                                      {selectedMentor.isVerified ? 'Verified' : 'Not Verified'}
                                    </span>
                                  </div>
                                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border flex-1 justify-center ${selectedMentor.isFeatured ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                                    <Star className={`h-4 w-4 ${selectedMentor.isFeatured ? 'text-amber-500' : 'text-gray-400'}`} />
                                    <span className={`text-xs font-semibold ${selectedMentor.isFeatured ? 'text-amber-700' : 'text-gray-500'}`}>
                                      {selectedMentor.isFeatured ? 'Featured' : 'Not Featured'}
                                    </span>
                                  </div>
                                </div>
                                {selectedMentor.subjects?.length > 0 && (
                                  <div className="space-y-2">
                                    <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium">Subjects</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {selectedMentor.subjects.map((s: string, i: number) => (
                                        <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">{s}</span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {selectedMentor.psychologicalAreas?.length > 0 && (
                                  <div className="space-y-2">
                                    <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium">Psychological Areas</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {selectedMentor.psychologicalAreas.map((a: string, i: number) => (
                                        <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">{a}</span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* ── Responsibilities Tab ── */}
                            {mentorProfileSubTab === 'responsibilities' && (
                              <div className="space-y-4">
                                <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                                  <p className="text-xs text-blue-700 font-medium">Responsibilities are derived from this mentor's profile configuration and platform assignments.</p>
                                </div>
                                {/* Core Delivery Areas */}
                                <div className="space-y-2">
                                  <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium">Core Delivery Areas</p>
                                  <div className="border border-gray-100 rounded-lg overflow-hidden">
                                    <div className="divide-y divide-gray-50">
                                      {[
                                        { label: 'Subject Instruction', value: selectedMentor.subjects?.join(', ') || 'Not assigned' },
                                        { label: 'Psychological Coaching', value: selectedMentor.psychologicalAreas?.join(', ') || 'Not assigned' },
                                        { label: 'Specialization Focus', value: selectedMentor.specialization || 'Not specified' },
                                        { label: 'Delivery Mode', value: selectedMentor.mode ? selectedMentor.mode.charAt(0).toUpperCase() + selectedMentor.mode.slice(1) : 'Not set' },
                                      ].map(({ label, value }) => (
                                        <div key={label} className="flex items-start justify-between px-3 py-2.5">
                                          <p className="text-xs text-gray-500 font-medium w-44 flex-shrink-0">{label}</p>
                                          <p className="text-xs font-semibold text-gray-800 text-right flex-1">{value}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                                {/* Platform Obligations */}
                                <div className="space-y-2">
                                  <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium">Platform Obligations</p>
                                  <div className="space-y-1.5">
                                    {[
                                      'Adhere to MetryxOne Code of Conduct at all times',
                                      'Complete assigned sessions punctually and professionally',
                                      'Submit session notes within 24 hours of each session',
                                      'Maintain student confidentiality and data privacy (DPDP compliant)',
                                      'Respond to admin queries within 48 hours',
                                      'Report safeguarding concerns immediately to the platform',
                                      'Keep qualifications and certifications up to date',
                                      'Participate in quarterly KPI reviews',
                                    ].map((item, i) => (
                                      <div key={i} className="flex items-start gap-2 py-1.5">
                                        <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                                        <p className="text-xs text-gray-600">{item}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                {/* Performance Targets */}
                                <div className="space-y-2">
                                  <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium">Performance Targets</p>
                                  <div className="grid grid-cols-2 gap-2">
                                    {[
                                      { label: 'Min. Student Satisfaction', target: '≥ 80%' },
                                      { label: 'Session Completion Rate', target: '≥ 90%' },
                                      { label: 'Outcome Improvement', target: '≥ 70%' },
                                      { label: 'Compliance Adherence', target: '100%' },
                                    ].map(({ label, target }) => (
                                      <div key={label} className="p-2.5 rounded-lg border border-gray-100 bg-gray-50">
                                        <p className="text-[10px] text-gray-400">{label}</p>
                                        <p className="text-sm font-bold" style={{ color: BRAND.primary }}>{target}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* ── Bookings Tab ── */}
                            {mentorProfileSubTab === 'bookings' && (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-semibold text-gray-700">{mentorBookings.length} Booking{mentorBookings.length !== 1 ? 's' : ''} found</p>
                                  <Button size="sm" variant="outline" onClick={() => refetchMentorBookings()} data-testid="button-refresh-bookings">
                                    <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
                                  </Button>
                                </div>
                                {mentorBookings.length === 0 ? (
                                  <div className="text-center py-10">
                                    <Calendar className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                                    <p className="text-sm text-gray-500">No bookings yet</p>
                                    <p className="text-xs text-gray-400 mt-1">Sessions booked by students will appear here</p>
                                  </div>
                                ) : (
                                  mentorBookings.map((booking: any) => (
                                    <div key={booking.id} className="p-3 border rounded-lg hover:border-gray-300 transition-colors">
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2">
                                            <p className="text-sm font-semibold text-gray-800">{booking.childName || 'Unknown Student'}</p>
                                            {booking.grade && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">Grade {booking.grade}</span>}
                                          </div>
                                          {booking.parentName && <p className="text-xs text-gray-500 mt-0.5">Parent: {booking.parentName}</p>}
                                          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{booking.slotDate ? new Date(booking.slotDate).toLocaleDateString() : 'N/A'}</span>
                                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{booking.startTime} – {booking.endTime}</span>
                                            <span className="capitalize">{booking.mode}</span>
                                          </div>
                                          {booking.notes && <p className="text-xs text-gray-400 mt-1 italic">{booking.notes}</p>}
                                        </div>
                                        <div className="ml-2 flex flex-col items-end gap-1">
                                          {getStatusBadge(booking.status)}
                                          {booking.sessionLink && (
                                            <a href={booking.sessionLink} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 underline">Join link</a>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}

                            {/* ── Rating Tab ── */}
                            {mentorProfileSubTab === 'rating' && (
                              <div className="space-y-4">
                                {/* Summary */}
                                <div className="p-4 rounded-xl border bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100">
                                  <div className="flex items-center gap-6">
                                    <div className="text-center">
                                      <p className="text-4xl font-black text-amber-500">
                                        {mentorReviewsData.averageRating ?? '—'}
                                      </p>
                                      <div className="flex items-center justify-center gap-0.5 mt-1">
                                        {[1, 2, 3, 4, 5].map(star => (
                                          <Star key={star} className={`h-3.5 w-3.5 ${star <= Math.round(mentorReviewsData.averageRating || 0) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
                                        ))}
                                      </div>
                                      <p className="text-[10px] text-gray-500 mt-1">out of 5</p>
                                    </div>
                                    <div className="flex-1 space-y-1.5">
                                      {[5, 4, 3, 2, 1].map(star => {
                                        const count = mentorReviewsData.reviews?.filter((r: any) => r.rating === star).length || 0;
                                        const pct = mentorReviewsData.totalReviews > 0 ? (count / mentorReviewsData.totalReviews) * 100 : 0;
                                        return (
                                          <div key={star} className="flex items-center gap-2">
                                            <span className="text-[10px] text-gray-500 w-3">{star}</span>
                                            <Star className="h-2.5 w-2.5 text-amber-400 fill-amber-400 flex-shrink-0" />
                                            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                              <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                                            </div>
                                            <span className="text-[10px] text-gray-400 w-4">{count}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <div className="text-center">
                                      <p className="text-2xl font-bold" style={{ color: BRAND.primary }}>{mentorReviewsData.totalReviews}</p>
                                      <p className="text-[10px] text-gray-400">Total Reviews</p>
                                    </div>
                                  </div>
                                </div>
                                {/* Review list */}
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-semibold text-gray-500">All Reviews</p>
                                  <Button size="sm" variant="outline" onClick={() => refetchMentorReviews()} data-testid="button-refresh-reviews">
                                    <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
                                  </Button>
                                </div>
                                {(!mentorReviewsData.reviews || mentorReviewsData.reviews.length === 0) ? (
                                  <div className="text-center py-8">
                                    <Star className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                                    <p className="text-sm text-gray-500">No reviews yet</p>
                                    <p className="text-xs text-gray-400 mt-1">Student reviews will appear here after completed sessions</p>
                                  </div>
                                ) : (
                                  mentorReviewsData.reviews.map((review: any) => (
                                    <div key={review.id} className="p-3 border rounded-lg">
                                      <div className="flex items-start justify-between">
                                        <div>
                                          <p className="text-sm font-semibold text-gray-800">{review.reviewerName || 'Anonymous'}</p>
                                          <div className="flex items-center gap-1 mt-0.5">
                                            {[1, 2, 3, 4, 5].map(s => (
                                              <Star key={s} className={`h-3 w-3 ${s <= Number(review.rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
                                            ))}
                                            <span className="text-[10px] text-gray-400 ml-1">{new Date(review.createdAt).toLocaleDateString()}</span>
                                          </div>
                                        </div>
                                        <span className="text-sm font-bold text-amber-500">{review.rating}/5</span>
                                      </div>
                                      {review.comment && <p className="text-xs text-gray-600 mt-2 leading-relaxed">{review.comment}</p>}
                                    </div>
                                  ))
                                )}
                              </div>
                            )}

                            {/* ── Tasks Tab ── */}
                            {mentorProfileSubTab === 'tasks' && (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-semibold text-gray-700">{mentorTasks.length} Task{mentorTasks.length !== 1 ? 's' : ''}</p>
                                  <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={() => refetchMentorTasks()} data-testid="button-refresh-tasks">
                                      <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
                                    </Button>
                                    <Button
                                      size="sm"
                                      style={{ backgroundColor: BRAND.primary }}
                                      className="text-white"
                                      onClick={() => setMentorDialog({ open: true, type: 'assign-task', mentor: selectedMentor })}
                                      data-testid="button-assign-task-profile"
                                    >
                                      <ClipboardList className="h-3.5 w-3.5 mr-1" /> Assign Task
                                    </Button>
                                  </div>
                                </div>
                                {mentorTasks.length === 0 ? (
                                  <div className="text-center py-10">
                                    <ClipboardList className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                                    <p className="text-sm text-gray-500">No tasks assigned</p>
                                    <p className="text-xs text-gray-400 mt-1">Use "Assign Task" to add a new task for this mentor</p>
                                  </div>
                                ) : (
                                  mentorTasks.map((task: any) => (
                                    <div key={task.id} className="p-3 border rounded-lg">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1">
                                          <p className="text-sm font-semibold text-gray-800">{task.title}</p>
                                          <p className="text-xs text-gray-500 capitalize mt-0.5">{task.taskType?.replace(/_/g, ' ')}</p>
                                          {task.scheduledDate && (
                                            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                                              <Calendar className="h-3 w-3" /> Due: {new Date(task.scheduledDate).toLocaleDateString()}
                                            </p>
                                          )}
                                          {task.description && <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{task.description}</p>}
                                        </div>
                                        {getStatusBadge(task.status)}
                                      </div>
                                      {task.completedAt && (
                                        <p className="text-[10px] text-green-600 mt-1.5 flex items-center gap-1">
                                          <CheckCircle className="h-3 w-3" /> Completed {new Date(task.completedAt).toLocaleDateString()}
                                        </p>
                                      )}
                                    </div>
                                  ))
                                )}
                              </div>
                            )}

                            {/* ── KPIs Tab ── */}
                            {mentorProfileSubTab === 'kpis' && (
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-semibold text-gray-700">{mentorKpis.length} KPI Period{mentorKpis.length !== 1 ? 's' : ''}</p>
                                  <p className="text-xs text-gray-400">PHI: <span className="font-bold" style={{ color: (selectedMentor.performanceHealthIndex ?? 100) >= 80 ? '#22c55e' : (selectedMentor.performanceHealthIndex ?? 100) >= 60 ? '#f59e0b' : '#ef4444' }}>{selectedMentor.performanceHealthIndex ?? 100}%</span></p>
                                </div>
                                {/* Current PHI bar */}
                                <div className="p-3 rounded-lg border bg-gray-50">
                                  <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium mb-2">Performance Health Index</p>
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                                      <div
                                        className="h-full rounded-full transition-all"
                                        style={{
                                          width: `${selectedMentor.performanceHealthIndex ?? 100}%`,
                                          backgroundColor: (selectedMentor.performanceHealthIndex ?? 100) >= 80 ? '#22c55e' : (selectedMentor.performanceHealthIndex ?? 100) >= 60 ? '#f59e0b' : '#ef4444'
                                        }}
                                      />
                                    </div>
                                    <span className="text-sm font-bold" style={{ color: (selectedMentor.performanceHealthIndex ?? 100) >= 80 ? '#22c55e' : (selectedMentor.performanceHealthIndex ?? 100) >= 60 ? '#f59e0b' : '#ef4444' }}>
                                      {selectedMentor.performanceHealthIndex ?? 100}%
                                    </span>
                                  </div>
                                </div>
                                {mentorKpis.length === 0 ? (
                                  <div className="text-center py-8">
                                    <TrendingUp className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                                    <p className="text-sm text-gray-500">No KPI records yet</p>
                                    <p className="text-xs text-gray-400 mt-1">KPI data will appear after each review period</p>
                                  </div>
                                ) : (
                                  mentorKpis.map((kpi: any) => (
                                    <div key={kpi.id} className="p-4 border rounded-lg">
                                      <div className="flex items-center justify-between mb-3">
                                        <p className="text-xs font-semibold text-gray-600">
                                          {new Date(kpi.periodStart).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })} – {new Date(kpi.periodEnd).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                                        </p>
                                        {kpi.alertLevel !== 'none' && (
                                          <Badge variant="destructive" className="text-[10px]">⚠ {kpi.alertLevel?.replace('_', ' ')}</Badge>
                                        )}
                                      </div>
                                      <div className="grid grid-cols-2 gap-3">
                                        {[
                                          { label: 'Student Satisfaction', value: kpi.studentSatisfaction, target: 80 },
                                          { label: 'Session Completion', value: kpi.sessionCompletionRate, target: 90 },
                                          { label: 'Outcome Improvement', value: kpi.outcomeImprovement, target: 70 },
                                          { label: 'Compliance', value: kpi.complianceAdherence, target: 100 },
                                        ].map(({ label, value, target }) => {
                                          const val = parseFloat(value) || 0;
                                          const color = val >= target ? '#22c55e' : val >= target * 0.75 ? '#f59e0b' : '#ef4444';
                                          return (
                                            <div key={label} className="space-y-1">
                                              <div className="flex justify-between">
                                                <p className="text-[10px] text-gray-400">{label}</p>
                                                <p className="text-[10px] font-bold" style={{ color }}>{val.toFixed(1)}%</p>
                                              </div>
                                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div className="h-full rounded-full" style={{ width: `${Math.min(val, 100)}%`, backgroundColor: color }} />
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}

                            {/* ── Agreement Tab ── */}
                            {mentorProfileSubTab === 'agreement' && (
                              <div className="space-y-4">
                                <div className={`p-4 rounded-lg border ${selectedMentor.agreementStatus === 'completed' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium">Agreement Status</p>
                                      <p className={`text-sm font-bold mt-0.5 capitalize ${
                                        selectedMentor.agreementStatus === 'completed' ? 'text-green-700' :
                                        selectedMentor.agreementStatus === 'acknowledged' ? 'text-blue-700' :
                                        selectedMentor.agreementStatus === 'sent' ? 'text-amber-700' : 'text-gray-600'
                                      }`}>
                                        {selectedMentor.agreementStatus?.replace(/_/g, ' ') || 'Not sent'}
                                      </p>
                                    </div>
                                    {selectedMentor.mentorCode && selectedMentor.agreementStatus !== 'completed' && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        data-testid="button-resend-agreement-profile"
                                        onClick={async () => {
                                          try {
                                            const res = await fetch(`/api/admin/mentors/${selectedMentor.mentorCode}/resend-agreement`, { method: 'POST', credentials: 'include' });
                                            const data = await res.json();
                                            if (res.ok) alert('Agreement email resent successfully.');
                                            else alert(data.message || 'Failed to resend agreement email.');
                                          } catch { alert('Network error. Please try again.'); }
                                        }}
                                      >
                                        <Mail className="h-4 w-4 mr-1" /> Resend Agreement
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-0.5">
                                    <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium">Activated At</p>
                                    <p className="text-sm font-medium">{selectedMentor.activatedAt ? new Date(selectedMentor.activatedAt).toLocaleDateString() : 'Not yet'}</p>
                                  </div>
                                  <div className="space-y-0.5">
                                    <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium">Mentor Code</p>
                                    <code className="text-sm font-mono font-bold" style={{ color: BRAND.primary }}>{selectedMentor.mentorCode || 'Not assigned'}</code>
                                  </div>
                                </div>
                                <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                                  <p className="text-xs text-blue-700 font-medium">Operational controls (PHI updates, warnings, suspensions, payouts) are available in HR &amp; Jobs → Mentors.</p>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>
                    );
                  })()}
                    </div>
                  )}

                  {mentorSectionTab === 'operations' && (
                    <div className="space-y-6">
                      {/* ── Header ── */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-xl font-bold" style={{ color: BRAND.primary }}>Mentor Operations Dashboard</h2>
                          <p className="text-sm text-gray-500 mt-1">Platform-wide session management, earnings tracking, and mentor analytics</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="text-xs px-3 py-1 font-semibold border-0 text-white" style={{ backgroundColor: BRAND.primary }}>Live</Badge>
                          <Button size="sm" variant="outline" onClick={() => { refetchMentorPlatformStats(); refetchMentorAllSessions(); refetchMentorLeaderboard(); }}>
                            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
                          </Button>
                        </div>
                      </div>
                  
                      {/* ── Stats tiles ── */}
                      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                        {[
                          { label: 'Total Sessions', value: mentorPlatformStats?.totalSessions ?? '—', sub: `${mentorPlatformStats?.completedSessions ?? 0} completed`, icon: BookOpen, color: BRAND.primary },
                          { label: 'Active Mentors', value: mentorPlatformStats?.activeMentors ?? mentors.filter((m: any) => m.status === 'active').length, sub: `of ${mentorPlatformStats?.totalMentors ?? mentors.length} total`, icon: UserCheck, color: BRAND.accent },
                          { label: 'Upcoming Sessions', value: mentorPlatformStats?.upcomingSessions ?? '—', sub: `${mentorPlatformStats?.pendingSessions ?? 0} pending`, icon: Calendar, color: '#6366F1' },
                          { label: 'Platform Revenue', value: mentorPlatformStats?.platformRevenue ? `₹${Number(mentorPlatformStats.platformRevenue).toLocaleString('en-IN')}` : '₹0', sub: 'from processed payouts', icon: DollarSign, color: '#16a34a' },
                          { label: 'Avg. Satisfaction', value: mentorPlatformStats?.avgSatisfaction ? `${mentorPlatformStats.avgSatisfaction}/5` : '—', sub: `${mentorPlatformStats?.totalReviews ?? 0} reviews`, icon: Star, color: '#eab308' },
                        ].map((stat, idx) => (
                          <Card key={idx}>
                            <CardContent className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${stat.color}15` }}>
                                  <stat.icon className="h-5 w-5" style={{ color: stat.color }} />
                                </div>
                                <div>
                                  <p className="text-[11px] text-gray-500 font-medium">{stat.label}</p>
                                  <p className="text-xl font-bold" style={{ color: BRAND.primary }}>{stat.value}</p>
                                  <p className="text-[10px] text-gray-400 mt-0.5">{stat.sub}</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                  
                      {/* ── All Sessions Table ── */}
                      <Card>
                        <CardHeader className="border-b">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle>Sessions Across Platform</CardTitle>
                              <CardDescription>All mentor sessions — latest 60 records</CardDescription>
                            </div>
                            <Badge className="text-xs px-2 py-1 font-medium border-0 text-white" style={{ backgroundColor: BRAND.accent }}>
                              {mentorAllSessions.length} records
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                            <table className="w-full text-sm">
                              <thead className="sticky top-0 z-10">
                                <tr className="border-b bg-gray-50">
                                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-left whitespace-nowrap">Mentor</th>
                                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-left whitespace-nowrap">Student</th>
                                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-left whitespace-nowrap">Date</th>
                                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-left whitespace-nowrap">Time</th>
                                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-left whitespace-nowrap">Mode</th>
                                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-left whitespace-nowrap">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {mentorAllSessions.length === 0 ? (
                                  <tr><td colSpan={6} className="py-10 text-center text-gray-400">No sessions recorded yet</td></tr>
                                ) : mentorAllSessions.map((s: any) => (
                                  <tr key={s.id} className="border-b hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-2.5">
                                      <p className="font-medium text-xs text-gray-900">{s.mentorName}</p>
                                      <p className="text-[10px] text-gray-400 capitalize">{s.mentorType?.replace(/_/g,' ')}</p>
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <p className="text-xs text-gray-800">{s.studentName || '—'}</p>
                                      {s.grade && <p className="text-[10px] text-gray-400">Grade {s.grade}</p>}
                                    </td>
                                    <td className="px-4 py-2.5 text-xs text-gray-700 whitespace-nowrap">
                                      {s.slotDate ? new Date(s.slotDate).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—'}
                                    </td>
                                    <td className="px-4 py-2.5 text-xs text-gray-700 whitespace-nowrap">
                                      {s.startTime ? s.startTime.substring(0,5) : '—'}{s.endTime ? ` – ${s.endTime.substring(0,5)}` : ''}
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <span className="text-[10px] capitalize px-2 py-0.5 rounded-full border font-medium"
                                        style={{ backgroundColor: s.mode === 'online' ? '#EFF6FF' : '#FFF7ED', color: s.mode === 'online' ? '#3B82F6' : '#EA580C', borderColor: s.mode === 'online' ? '#BFDBFE' : '#FDBA74' }}>
                                        {s.mode || 'N/A'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2.5">{getStatusBadge(s.status)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                  
                      {/* ── Leaderboard ── */}
                      <Card>
                        <CardHeader className="border-b">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-base">Top Performing Mentors</CardTitle>
                              <CardDescription>Ranked by completed sessions, rating, and revenue</CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-0">
                          {mentorLeaderboard.length === 0 ? (
                            <div className="py-10 text-center text-gray-400">No data available yet</div>
                          ) : (
                            <div className="divide-y">
                              {mentorLeaderboard.map((m: any, idx: number) => {
                                const initials = (m.displayName || m.fullName || '?').split(' ').map((w: string) => w[0]).join('').slice(0,2).toUpperCase();
                                return (
                                  <div key={m.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer"
                                    onClick={() => { setSelectedMentor(m); setMentorSectionTab('roster'); setMentorProfileSubTab('profile'); }}>
                                    <div className="flex items-center gap-4">
                                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-extrabold shrink-0"
                                        style={{ backgroundColor: idx === 0 ? '#F59E0B' : idx === 1 ? '#94A3B8' : idx === 2 ? '#CD7C2F' : BRAND.primary }}>
                                        {idx + 1}
                                      </div>
                                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: BRAND.primary }}>
                                        {initials}
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-1.5">
                                          <p className="font-semibold text-sm" style={{ color: BRAND.primary }}>{m.displayName || m.fullName}</p>
                                          {m.isVerified && <CheckCircle className="h-3 w-3 text-teal-500" />}
                                        </div>
                                        <p className="text-xs text-gray-500 capitalize">{m.mentorType?.replace(/_/g,' ')}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-6 text-xs">
                                      <div className="text-center">
                                        <p className="font-bold text-gray-800">{m.completedSessions}</p>
                                        <p className="text-gray-400">Sessions</p>
                                      </div>
                                      <div className="text-center">
                                        <p className="font-bold text-amber-500">{m.avgRating > 0 ? m.avgRating : '—'}</p>
                                        <p className="text-gray-400">Rating</p>
                                      </div>
                                      <div className="text-center">
                                        <p className="font-bold text-green-600">{m.totalRevenue > 0 ? `₹${Number(m.totalRevenue).toLocaleString('en-IN')}` : '—'}</p>
                                        <p className="text-gray-400">Revenue</p>
                                      </div>
                                      <div className="text-center">
                                        <p className="font-bold" style={{ color: m.phi >= 80 ? '#22c55e' : m.phi >= 60 ? '#f59e0b' : '#ef4444' }}>{m.phi}%</p>
                                        <p className="text-gray-400">PHI</p>
                                      </div>
                                      {getStatusBadge(m.status || 'active')}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
  );
}
